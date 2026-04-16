---
title: "01 - Dagster Core Concepts"
tags:
  - orchestration
  - dagster
description: "Foundational Dagster vocabulary and mental models, including assets, definitions, materializations, observations, runs, and the shift from task-first orchestration to asset-first orchestration."
created: 2026-04-15
updated: 2026-04-16
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

Dagster becomes easier to reason about once its vocabulary is read as operating vocabulary rather than decorator vocabulary. The platform asks four concrete questions: what durable data state exists, which downstream states depend on it, whether the code location is even loadable, and what execution evidence Dagster recorded when work ran. Those questions matter because Dagster keeps user code behind a code-location boundary and treats data products, not task shells, as the center of orchestration.

> [!abstract]- Summary
>
> This note establishes the core Dagster model that the rest of the chapter assumes:
>
> - `Definitions` is the loadable composition root Dagster tools discover and inspect.
> - assets are durable states in the graph, not just Python functions with decorators.
> - materializations and runs are execution evidence, but they do not settle whether the data is acceptable.
> - observations keep externally managed datasets visible without pretending Dagster owns their compute.

> [!info] Official References
>
> - [Dagster overview](https://docs.dagster.io/)
> - [Dagster definitions API](https://docs.dagster.io/api/dagster/definitions)
> - [Dagster assets API](https://docs.dagster.io/api/dagster/assets)
> - [Deployment overview](https://docs.dagster.io/deployment)

> [!note]- Glossary
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

## The Code Location Is A Load Boundary

Dagster's own `Definitions` documentation is explicit about the load model: system tools do not simply import arbitrary user code and execute it in-process. They discover a loadable module and expect to find a top-level `Definitions` object they can reconstruct across a serialization boundary. That makes loadability a first-order correctness concern, not a packaging afterthought.

### Loadability Comes Before Execution

The first operational question in a Dagster project is whether the code location resolves cleanly. Only after that boundary holds does it make sense to discuss schedules, sensors, retries, or production incidents.

#### Compose one explicit `Definitions` object

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

#### Publish the whole operating surface, not only the assets

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

## Durable State Sits At The Center Of The Model

Dagster's asset API exists because the platform wants the graph to describe durable states that engineers and downstream systems can name under pressure. This is the real conceptual move away from task-first orchestration. A task scheduler primarily answers "what should run next?" Dagster asks that question too, but only after it has modeled which data state is stale, rebuilt, observed, or still untrusted.

### The Graph Should Name States The Business Would Recognize

If a downstream team, reviewer, or on-call engineer would ask about a dataset by name, that dataset probably belongs in the asset graph. If no one outside the implementation cares about an intermediate step, it may belong behind the asset boundary instead.

#### Inspect the asset events a run actually emitted

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

### A Green Run And A Trusted Dataset Are Different Claims

Materialization means Dagster observed an asset being produced. It does not mean the dataset satisfies business rules, schema expectations, or consumer contracts. A run can finish successfully while still producing data that should not propagate.

#### Separate execution success from downstream trust

Use this framing when a team is tempted to equate "the run is green" with "the data is ready." The trigger is usually a post-incident conversation in which execution completed, but the produced state later proved wrong, incomplete, or out of contract. The context is operational reasoning rather than a new API surface. Its purpose is to establish that checks, review boundaries, and downstream acceptance belong on top of materialization, not inside the definition of materialization itself.

> [!example] A review snapshot is a real state boundary
>
> In the `dagflow` market-data pipeline, dbt transforms can finish successfully and still leave the dataset in a state that requires governed review before export. The review snapshot is therefore not cosmetic metadata around a run. It is a durable operational state between transformation and delivery. That is exactly the kind of boundary Dagster's asset model is meant to expose.

## Observation Begins Where Ownership Ends

Dagster does not require every important upstream system to run inside Dagster. It does require the graph to stay honest about whether Dagster computes a dataset or merely tracks its condition. That is the role of source assets and observations.

### Visibility Still Matters Across System Boundaries

An upstream warehouse table, vendor feed, or partner-owned dataset can still be critical to blast-radius reasoning even if another system produced it. Excluding it from the graph makes downstream lineage less truthful at the moment it becomes most operationally important.

#### Declare an upstream dataset without claiming rerun authority

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

## Dagster Earns Its Cost When Recovery Scope Matters

The wrong way to evaluate Dagster is to compare it to `cron` on a feature checklist. The right evaluation is to ask whether the system needs lineage-aware recovery, explicit trust signals, and a control plane that can explain which data states changed and why. If those questions do not matter, Dagster is often unnecessary machinery. If they do matter, a task-only scheduler usually forces the team to rebuild those answers elsewhere.

### The Real Decision Is Governed Data State Versus Timer-Driven Execution

The platform is strongest when engineers need to reason about stale assets, partial rebuilds, external dependencies, review boundaries, checks, and blast radius. It is weakly justified when the only requirement is "run this script every night and alert if it crashes."

#### Choose Dagster when stale data matters more than command order

Use this decision boundary when selecting an orchestrator for a new workflow or deciding whether an existing script should graduate into a managed data platform. The trigger is architectural evaluation rather than day-to-day operation. The context is comparative design: what does the system need the orchestrator to explain, recover, and govern? Its purpose is to avoid both over-engineering simple timers and under-engineering governed data systems.

> [!question] Where Dagster changes the answer
>
> A nightly one-step export that only has to finish by 02:00 usually does not justify Dagster. A governed pipeline such as `dagflow`, where raw landing, curated marts, review snapshots, approval, and export are separate named states, is a different problem. There the business needs to know which state is waiting, which state is safe to replay, and which state has already been approved. That is the operational territory where Dagster's model becomes materially better than task ordering alone.
