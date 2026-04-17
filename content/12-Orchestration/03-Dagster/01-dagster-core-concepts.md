---
title: "01 - Dagster Core Concepts"
tags:
  - orchestration
  - dagster
description: "Dagster platform overview and foundational concepts, including code locations, assets, materializations, observations, runs, and when asset-first orchestration is the right fit."
created: 2026-04-15
updated: 2026-04-17
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[02-dagster-assets-and-lineage]]"
  - "[[03-dagster-resources-config-and-io-managers]]"
  - "[[04-dagster-ops-jobs-and-graphs]]"
  - "[[05-dagster-automation-and-partitions]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Core Concepts

Dagster is a data orchestrator built around named data assets, explicit execution history, and a control plane that can explain what changed, what depends on it, and what should be recomputed next. In practice, that means Dagster is not only a job launcher. It is a platform for loading user code from code locations, tracking runs and asset events in a shared instance, and using that state to drive jobs, schedules, sensors, checks, and targeted recovery.

This page introduces Dagster itself before the chapter moves into specialized topics. The goal is to establish the platform model, define the core objects, and explain why Dagster is strongest when the real problem is governed data state rather than simple timer-based task execution.

> [!abstract]- Summary
>
> This note establishes the Dagster model that the rest of the chapter assumes:
>
> - Dagster models orchestration around durable data assets and explicit control-plane state.
> - `Definitions` is the loadable composition root that code servers, tests, and deployment services must agree on.
> - assets, materializations, and runs answer what work happened, but they do not by themselves answer whether the resulting data is trustworthy.
> - source assets and observations keep external dependencies visible without pretending Dagster owns their compute.
> - Dagster is most justified when lineage-aware recovery and trust boundaries matter more than command order alone.

> [!abstract]- Key Terms
>
> **Definitions**
> - Dagster defines `Definitions` as the set of definitions explicitly available and loadable by Dagster tools.
> - In practice, it is the composition root that a code server, webserver, daemon, and tests all need to agree on.
> - If it fails to load, the incident is in discovery or composition before any run exists.
>
> **Asset**
> - An asset is a named durable data state Dagster can track for lineage, execution, checks, and targeted recovery.
> - The important boundary is not "one function equals one asset" but "one externally meaningful data state equals one asset."
> - Internal compute detail can remain behind the asset boundary when downstream systems do not need to reason about it directly.
>
> **Materialization**
> - A materialization is the event Dagster records when an asset is produced.
> - It proves that Dagster observed work completing for that asset in a run.
> - It does not by itself prove semantic correctness, contract compliance, or downstream acceptance.
>
> **Observation**
> - An observation records metadata about a dataset Dagster did not compute itself.
> - This preserves lineage and operational visibility across system boundaries.
> - Observation keeps the graph honest by separating visibility from ownership.
>
> **Run**
> - A run is one execution request against a job or asset selection.
> - It is the main execution record for logs, events, failures, and emitted asset state.
> - A successful run answers "what launched and finished," not automatically "should downstream consumers trust the result."

## Dagster | platform overview

This section introduces Dagster at the platform level before the note moves into individual objects such as `Definitions`, assets, and source assets. The key point is that Dagster is a control plane for data systems: it loads a declared code location, stores orchestration state in a shared instance, and uses that state to coordinate execution, lineage, checks, and recovery.

### Dagster | orchestrator model | assets, control plane, and execution

Dagster is easiest to understand as three connected layers. The first layer is user code, where engineers define assets, jobs, resources, checks, and automation rules. The second layer is the control plane, which loads those definitions, records runs and events, and decides when work should launch. The third layer is the actual compute, which may run in process, in subprocesses, or in external systems that Dagster observes and coordinates.

#### Dagster | define the platform scope

Dagster is appropriate when the orchestration layer needs to know more than whether a command succeeded. The platform tracks named assets, the dependencies between them, the runs that emitted materializations or observations, and the checks that qualify whether the resulting data should be trusted. That lets engineers ask operational questions such as which assets are stale, which downstream states depend on a corrected source, and which recovery path is narrower than a full rerun.

#### Dagster | compare asset-first and task-first orchestration

A task-first scheduler primarily models execution order: run task A, then task B, then task C. Dagster can represent step order too, but its main modeling surface is the asset graph. In an asset-first system, the important object is the durable state the business cares about, such as a curated mart, a reviewed snapshot, or a delivered export. Execution steps matter because they produce or validate those states, not because task order alone is the system's contract.

## Dagster | code locations and Definitions

Dagster uses a load boundary between the control plane and user code. The code server, webserver, daemon, and tests do not discover assets by scanning arbitrary runtime state. They load a declared code location and expect one coherent `Definitions` surface they can inspect, serialize, and execute against consistently.

### Dagster | code locations | loadability and composition

This is why loadability comes before execution in any real Dagster project. If the code location does not resolve, there is no valid asset graph, no trustworthy UI surface, and no meaningful automation discussion yet. Schedules, sensors, checks, and runs all depend on the composition root loading first.

#### Definitions | compose one explicit object

Use this pattern when a project is moving from loose scripts to a code location that CI, local tests, and the Dagster control plane must all load consistently. The trigger is usually the moment assets, jobs, or resources have multiplied enough that implicit wiring becomes harder to reason about than explicit composition. The code runs in user-code space and is load-time configuration, not business execution. Its purpose is to publish one authoritative inventory of assets and related executable objects.

*Build a minimal `Definitions` object and print the asset keys Dagster resolves from it.*

```python
import dagster as dg

@dg.asset
def raw_orders():
    return [1, 2, 3]

@dg.asset(deps=[raw_orders])
def daily_revenue():
    return 42

defs = dg.Definitions(assets=[raw_orders, daily_revenue])
print([spec.key.to_user_string() for spec in defs.resolve_all_asset_specs()])
```

```text
['daily_revenue', 'raw_orders']
```

In a real production code location, that composition root is where the platform's operational shape becomes explicit. In the local `dagflow` repository, one `Definitions` object exposes two governed pipelines, four asset jobs, review-resume sensors, dbt-backed assets, and shared resources in one loadable module. The important lesson is not the number of objects. It is that every Dagster tool can discover the same operating surface from one agreed entry point.

#### Definitions | publish the full operating surface

Use this pattern once the code location has crossed from a teaching example into a platform that must expose launchable slices, automation surfaces, and resource boundaries together. The trigger is a need to explain not only what data states exist, but also which executable selections, sensors, and shared dependencies govern them. The code still runs at composition time rather than as business workload. Its purpose is to make the control plane load the same topology engineers read in code review.

*Define one code location that exposes asset jobs, review-resume sensors, and shared resources.*

```python
from dagster import AssetSelection, Definitions, define_asset_job, in_process_executor
from dagster_dbt import build_dbt_asset_selection

security_master_job = define_asset_job(
    name="security_master_job",
    executor_def=in_process_executor,
    selection=AssetSelection.assets(
        sec_company_tickers_capture,
        sec_company_facts_capture,
        sec_company_tickers_raw,
        sec_company_facts_raw,
        security_master_review_snapshot,
    )
    | build_dbt_asset_selection([security_master_transform_assets]),
)

defs = Definitions(
    assets=[
        sec_company_tickers_capture,
        sec_company_tickers_raw,
        security_master_transform_assets,
        security_master_review_snapshot,
        security_master_export_assets,
        security_master_csv_export,
    ],
    jobs=[security_master_job, security_master_export_job],
    sensors=[build_review_validation_sensor(security_master_export_job, "security_master")],
    resources=build_resources(),
)
```

## Dagster | assets, runs, and trust

Dagster's asset model is the core reason the platform feels different from a task scheduler. A task scheduler mainly answers which command should run next. Dagster still launches work, but it first asks which durable data state exists, which downstream states depend on it, and which state now needs to be rebuilt, checked, or withheld from consumers.

### Dagster | assets and materializations | durable state in the graph

An asset is a named durable state Dagster can track across lineage, runs, materializations, checks, and retries. Good asset boundaries follow the states operators and downstream consumers actually care about. If a reviewer, analyst, or on-call engineer would ask whether a dataset exists or can be replayed safely, that state belongs in the graph.

#### Assets | inspect emitted materializations

Use this pattern when the code location already loads and the next question is what durable state Dagster recorded for one execution. The trigger is a need to move from static topology into run evidence. The code runs as a normal in-process materialization and changes runtime state by producing assets. Its purpose is to show that a run is meaningful in Dagster because it emits asset events tied to named data states.

*Materialize two dependent assets and print the run result plus the asset keys Dagster recorded as materialized.*

```python
import contextlib
import io

import dagster as dg

@dg.asset
def raw_orders():
    return [1, 2, 3]

@dg.asset(deps=[raw_orders])
def daily_revenue():
    return 42

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([raw_orders, daily_revenue])

print(result.success)
print(
    [
        event.materialization.asset_key.to_user_string()
        for event in result.get_asset_materialization_events()
    ]
)
```

```text
True
['raw_orders', 'daily_revenue']
```

That distinction matters in production systems because the most important state change is not always the final file export. In `dagflow`, a review snapshot is itself a first-class asset because downstream approval, editing, and export all depend on that persisted review state. The asset graph therefore names `security_master_review_snapshot` and `shareholder_holdings_review_snapshot` explicitly instead of hiding them as incidental internal steps.

### Dagster | runs and data trust | execution evidence versus acceptance

Runs and materializations answer what Dagster executed and what state it observed being produced. They do not automatically answer whether the output is semantically correct, policy-compliant, or safe for downstream delivery. That trust boundary belongs to checks, review stages, and explicit acceptance logic layered on top of execution evidence.

#### Runs | separate execution success from data trust

Use this framing when a team is tempted to equate "the run is green" with "the data is ready." The trigger is usually a post-incident conversation in which execution completed, but the produced state later proved wrong, incomplete, or out of contract. The context is operational reasoning rather than a new API surface. Its purpose is to establish that checks, review boundaries, and downstream acceptance belong on top of materialization, not inside the definition of materialization itself.

> [!example] A review snapshot is a real state boundary
>
> In the `dagflow` market-data pipeline, dbt transforms can finish successfully and still leave the dataset in a state that requires governed review before export. The review snapshot is therefore not cosmetic metadata around a run. It is a durable operational state between transformation and delivery. That is exactly the kind of boundary Dagster's asset model is meant to expose.

## Dagster | source assets and observations

Dagster does not assume every important upstream system runs inside Dagster. It does, however, need the graph to stay honest about ownership. Source assets and observations exist so external warehouse tables, vendor feeds, and partner-owned datasets remain visible in lineage without implying that Dagster can rebuild them itself.

### Dagster | external dependencies | visibility without ownership

External dependencies still matter for blast-radius analysis, freshness reasoning, and downstream trust. If a downstream asset depends on an upstream dataset, the graph should show that dependency even when the authoritative compute happens elsewhere. That visibility is what lets Dagster stay operationally useful across system boundaries.

#### Source assets | declare an upstream dependency

Use this pattern when downstream assets depend on data that exists outside Dagster's execution boundary. The trigger is a need to preserve lineage and dependency reasoning without implying that Dagster can rebuild the upstream data on demand. The code is read-only topology definition. Its purpose is to model dependency honestly while keeping ownership boundaries explicit.

*Declare an external source asset and print the Dagster type and asset key it exposes.*

```python
import dagster as dg

upstream_feed = dg.SourceAsset("upstream_feed")

print(type(upstream_feed).__name__)
print(upstream_feed.key.to_user_string())
```

```text
SourceAsset
upstream_feed
```

When the upstream system can be actively inspected, Dagster's observable source asset pattern goes further by letting the observation function return metadata about the current external state. That is the right model for a dataset that Dagster does not compute but does need to monitor, freshness-check, or expose to downstream assets as a visible dependency.

## Dagster | adoption criteria

Dagster is not automatically the right answer for every scheduled workload. The useful evaluation is whether the system needs lineage-aware recovery, explicit trust signals, external-dependency visibility, and a control plane that can explain which named data states changed and why. If those answers are unnecessary, simpler schedulers are often enough. If they are necessary, Dagster's model usually pays for itself.

### Dagster | orchestrator selection | recovery scope and governance

Dagster is strongest when engineers need to reason about stale assets, partial rebuilds, review boundaries, checks, and blast radius across several dependent data states. It is weakly justified when the only requirement is to run one script on a timer and alert if the command exits non-zero. The distinction is governed data state versus timer-driven task execution.

#### Dagster | choose Dagster when stale data matters more than command order

Use this decision boundary when selecting an orchestrator for a new workflow or deciding whether an existing script should graduate into a managed data platform. The trigger is architectural evaluation rather than day-to-day operation. The context is comparative design: what does the system need the orchestrator to explain, recover, and govern? Its purpose is to avoid both over-engineering simple timers and under-engineering governed data systems.

> [!question] Where Dagster changes the answer
>
> A nightly one-step export that only has to finish by 02:00 usually does not justify Dagster. A governed pipeline such as `dagflow`, where raw landing, curated marts, review snapshots, approval, and export are separate named states, is a different problem. There the business needs to know which state is waiting, which state is safe to replay, and which state has already been approved. That is the operational territory where Dagster's model becomes materially better than task ordering alone.

## Dagster | references

This section collects the official Dagster documentation links most relevant to the concepts introduced on this page.

- [Dagster overview](https://docs.dagster.io/)
- [Dagster definitions API](https://docs.dagster.io/api/dagster/definitions)
- [Dagster assets API](https://docs.dagster.io/api/dagster/assets)
- [Deployment overview](https://docs.dagster.io/deployment)
