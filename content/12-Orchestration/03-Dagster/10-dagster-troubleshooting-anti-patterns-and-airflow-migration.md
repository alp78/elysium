---
title: "10 - Dagster Troubleshooting, Anti-Patterns, And Airflow Migration"
tags:
  - orchestration
  - dagster
description: "Operational failure modes, design mistakes, and migration guidance for teams moving from Airflow-style orchestration into Dagster's asset-first model."
created: 2026-04-15
updated: 2026-04-17
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[01-dagster-core-concepts]]"
  - "[[02-dagster-assets-and-lineage]]"
  - "[[03-dagster-resources-config-and-io-managers]]"
  - "[[04-dagster-ops-jobs-and-graphs]]"
  - "[[05-dagster-automation-and-partitions]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
---

# Dagster Troubleshooting, Anti-Patterns, And Airflow Migration

Dagster incidents are easier to fix than older schedulers only when the system preserves its own boundaries clearly. The important boundaries are definition loading, control-plane orchestration, step execution, and downstream trust. Most expensive Dagster mistakes blur those layers until every problem looks like "the pipeline failed," and most clumsy Airflow migrations do the same by carrying task-first habits into an asset-first platform.

> [!abstract]- Summary
>
> This note treats troubleshooting and migration as boundary discipline:
>
> - classify the failed layer before editing code
> - keep sensors, jobs, and assets narrow enough that ownership stays visible
> - use replay as a scoped recovery tool rather than as a panic response
> - migrate from Airflow by shifting observation and execution responsibilities deliberately, not by renaming DAGs

> [!abstract]- Key Terms
>
> **Code-location failure**
> - A failure while Dagster is loading user code and reconstructing the `Definitions` surface.
> - It explains missing assets, missing jobs, or a broken code location before any run begins.
> - It is a composition incident, not an execution incident.
>
> **Control-plane failure**
> - A failure in the orchestration layer after code has loaded but before or around execution progress.
> - Typical examples are queued runs that never start, a daemon that is down, or sensors that are not evaluating.
> - It often lives in service wiring and instance configuration rather than in asset logic.
>
> **Shadow orchestration**
> - Business workflow logic hidden in sensors, hooks, or side effects instead of expressed in assets, jobs, checks, and explicit state boundaries.
> - It makes incidents harder to classify because the real control flow is no longer visible in the graph.
> - It usually feels flexible until a replay or audit is needed.
>
> **Airlift**
> - Dagster's toolkit for integrating with Airflow and migrating incrementally.
> - It exists to support coexistence, observation, rollback, and staged transfer of execution responsibility.
> - It still requires Airflow REST API access and a deliberate migration plan.

## Dagster | incident triage

The first troubleshooting decision is which layer failed. A load failure, a run stuck in `QUEUED`, a step failure, and an approved dataset that never exported are not variants of the same problem. They leave different evidence and belong to different owners.

### Dagster | failure layers | loadability, control plane, execution, and trust

The correct first move is to ask what evidence already exists. If no run exists, the code location may not have loaded. If a run exists but never starts, the daemon and instance configuration come into focus. If the run failed, the event stream becomes primary. If the run succeeded but the export is still wrong, the incident has moved into checks, review state, or downstream contract enforcement.

#### Control plane | treat queued runs as orchestration incidents

Use this check when runs stay in `QUEUED`, sensors appear idle, or automation is visibly behind without an obvious step failure. The trigger is orchestration silence after Dagster has already accepted work. The configuration below is deployment wiring, not business logic. Its purpose is to remind you that webserver, daemon, and user-code loading are separate responsibilities with different failure modes.

*Read the `dagflow` Dagster services as three distinct operational owners.*

```yaml
dagster-user-code:
  command: >
    dagster api grpc
    -h 0.0.0.0
    -p 4000
    -m dagflow_dagster.definitions

dagster-webserver:
  command: >
    /bin/sh -c
    "cp /workspace/apps/dagster/dagster.yaml /opt/dagster/dagster_home/dagster.yaml
    && dagster-webserver -h 0.0.0.0 -p 3000 -w /workspace/apps/dagster/workspace.yaml"

dagster-daemon:
  command: >
    /bin/sh -c
    "cp /workspace/apps/dagster/dagster.yaml /opt/dagster/dagster_home/dagster.yaml
    && dagster-daemon run -w /workspace/apps/dagster/workspace.yaml"
```

Dagster's concurrency troubleshooting guide makes the same point operationally: in open-source deployments, queued runs most often come down to the daemon or shared instance configuration. In `dagflow`, the first checks are whether `dagster-daemon` is alive and whether the daemon and webserver are sharing the same `DAGSTER_HOME` and `dagster.yaml`.

#### Data trust | separate a successful run from a trustworthy export

Use this framing when a run finished green but downstream consumers still should not receive the output. The trigger is a dataset that was built successfully yet has not crossed the trust boundary required for delivery. The context is operational reasoning rather than a new API. Its purpose is to keep data trust incidents from being misclassified as orchestration success.

> [!example] Review state is part of the incident model
>
> In `dagflow`, a curated dataset can materialize successfully and still wait in `security_master_review_snapshot` or `shareholder_holdings_review_snapshot` before export is allowed. That means "the run is green" and "the data may be delivered" are separate claims. An index constituent pipeline with human approval would need the same distinction between machine-generated basket and approved basket.

## Dagster | anti-patterns

Dagster rarely becomes hard to operate because it lacks features. It becomes hard to operate when engineers hide too much responsibility inside the wrong primitive. The recurring anti-patterns all compress boundaries that should stay explicit.

### Dagster | sensors and assets | keep orchestration boundaries visible

Sensors should evaluate readiness and request work. Assets should describe durable states. Jobs should package execution slices. When those roles collapse into each other, the control plane becomes opaque.

#### Sensors | request work instead of performing it

Use this rule when a sensor starts accreting database writes, transformation logic, or branching business rules. The trigger is a sensor body that is becoming longer than the state check it was meant to perform. The code below is a healthy sensor shape: it inspects control-plane state and emits run requests. Its purpose is to keep orchestration logic visible and auditable.

*Keep the `dagflow` review-validation sensor focused on readiness detection and run emission.*

```python
approved_runs = control_plane.export_ready_runs(pipeline_code)
if not approved_runs:
    yield SkipReason(f"No validated {pipeline_code} review runs are waiting for export")
    return

for approved_run in approved_runs:
    validated_at = approved_run["validated_at"].isoformat()
    run_id = str(approved_run["run_id"])
    business_date = approved_run["business_date"].isoformat()
    yield RunRequest(
        run_key=f"{pipeline_code}:{run_id}:validated-export:{validated_at}",
        tags={
            "pipeline_code": pipeline_code,
            "dagflow_run_id": run_id,
            "dagflow_business_date": business_date,
            "validated_at": validated_at,
        },
    )
```

If the sensor were to load files, mutate review state, and write exports directly, Dagster would still "work," but the incident boundary would disappear. On-call engineers would no longer know whether a failure belonged to orchestration, transformation, or delivery.

#### Assets | avoid one asset impersonating an entire governed workflow

Use this check when a single asset starts mixing extraction, curation, approval state, export, and notification. The trigger is the appeal of a "simpler" one-node graph that hides the real lifecycle of the dataset. The context is graph design. Its purpose is to preserve targeted replay and trustworthy lineage under pressure.

*Read the `dagflow` security master as separate states instead of one monolithic asset.*

```text
sec_company_tickers_capture
  -> sec_company_tickers_raw
  -> stg_sec_company_tickers
  -> int_security_base
  -> int_security_attributes
  -> dim_security
  -> security_master_review_snapshot
  -> security_master_preview
  -> security_master_csv_export
```

That chain is not verbosity for its own sake. It is what allows the platform to distinguish capture failures, transformation defects, review backlog, and export delivery problems. A benchmark composition pipeline would need equally explicit boundaries if review and publication are separate operational acts.

## Dagster | replay strategy

Replay strategy is where Dagster's modeling decisions either help or hurt operations. Full reruns are sometimes necessary, but they are often a sign that the graph does not express the real recovery boundary. The larger the replay scope, the more the system is paying for modeling shortcuts taken earlier.

### Dagster | scoped recovery | match replay scope to the damaged state

#### Jobs | use scoped jobs instead of reflexive full-platform reruns

Use this judgment when a correction affects one slice of lineage rather than the whole estate. The trigger is a replay request following a review fix, a corrected upstream source file, or a single export issue. The code is job definition, not runtime troubleshooting. Its purpose is to keep recovery proportional to the damaged state.

*Resume only the export slice in `dagflow` after approval rather than replaying capture and transform again.*

```python
security_master_export_job = define_asset_job(
    name="security_master_export_job",
    executor_def=in_process_executor,
    selection=AssetSelection.assets(security_master_csv_export)
    | build_dbt_asset_selection([security_master_export_assets]),
)
```

When teams reach for full reruns by habit, the problem is often not the incident. The problem is that the graph never exposed the narrower state boundary that needed repair.

## Dagster | Airflow migration

Dagster's Airflow migration guidance and Airlift docs are explicit that coexistence is normal. The goal is not to rewrite everything at once. The goal is to shift observation and execution responsibilities in a sequence that preserves rollback and keeps lineage intelligible.

### Dagster | staged migration with Airlift | observe first, migrate second

This is the part most hurried migrations get wrong. They move code before they have established how Dagster will observe the legacy estate, model the resulting assets, and limit rollback risk.

#### Airlift | connect to Airflow explicitly

Use Airlift when the migration must begin with coexistence, observability, and phased handoff rather than with an immediate cutover. The trigger is a live Airflow estate that still owns some execution. The code below establishes the control-plane connection to Airflow. Its purpose is to make observation and migration a first-class integration instead of a pile of one-off scripts.

*Declare the Airflow instance Dagster should observe and migrate incrementally.*

```python
from dagster_airlift.core import AirflowBasicAuthBackend, AirflowInstance

airflow = AirflowInstance(
    name="legacy_airflow",
    auth_backend=AirflowBasicAuthBackend(
        webserver_url="http://airflow.local:8080",
        username="svc_dagster",
        password="***",
    ),
)
```

The connection object is not the migration itself. It is the prerequisite that lets Dagster observe Airflow runs, preserve history, and take over execution deliberately.

#### Migration plan | move responsibility in stages, not in one rename exercise

Use this plan when an Airflow DAG already embodies business-critical workflows such as benchmark construction, pricing quality review, or regulated export delivery. The trigger is a migration large enough that rollback risk matters. The guidance below follows the staged model Dagster documents for Airlift. Its purpose is to move control-plane responsibility without forcing a stop-the-world rewrite.

> [!tip] A staged Airlift migration
>
> - **Peer first.** Connect Dagster to the live Airflow instance so the existing estate becomes visible before any execution is moved.
> - **Observe next.** Map the Airflow DAG into Dagster assets so lineage becomes explicit while Airflow still owns execution.
> - **Migrate selectively.** Move tasks or whole DAG slices into Dagster only where rollback and recovery remain tractable.
> - **Decommission last.** Remove Airflow execution only after Dagster has proven it can own the workflow, checks, and replay boundaries cleanly.
>
> For an index constituent pipeline, that often means observing the legacy Airflow DAG first, then moving the curated constituent build into Dagster, then adding the review and export boundaries, and only then retiring the original DAG.

## Dagster | references

This section collects the official Dagster documentation links most relevant to troubleshooting, anti-patterns, and Airflow migration.

- [Airflow to Dagster migration](https://docs.dagster.io/migration/airflow-to-dagster)
- [Dagster & Airlift](https://docs.dagster.io/integrations/libraries/airlift)
- [Airlift migration guide](https://docs.dagster.io/migration/airflow-to-dagster/airlift-v1)
- [Troubleshooting concurrency issues](https://docs.dagster.io/guides/operate/managing-concurrency/troubleshooting-concurrency)
