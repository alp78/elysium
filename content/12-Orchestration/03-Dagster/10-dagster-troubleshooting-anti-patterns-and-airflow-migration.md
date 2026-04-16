---
title: "10 - Dagster Troubleshooting, Anti-Patterns, And Airflow Migration"
tags:
  - orchestration
  - dagster
description: "Operational failure modes, design mistakes, and migration guidance for teams moving from Airflow-style orchestration into Dagster's asset-first model."
created: 2026-04-15
updated: 2026-04-16
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

Most Dagster incidents become manageable once the team classifies them correctly. The main buckets are code loading, runtime execution, and data trust. Most migration mistakes come from carrying task-first habits into a platform that expects assets, lineage, and explicit recovery scope.

> [!abstract]- Summary
>
> This note groups the common operational and migration mistakes:
>
> - classify incidents by failure layer before changing code
> - avoid hidden complexity such as monolithic assets and shadow orchestration in sensors
> - treat historical repair as targeted replay rather than reflexive full reruns
> - map Airflow responsibility into Dagster deliberately, especially when using Airlift

> [!info] Official References
>
> - [Airflow to Dagster migration](https://docs.dagster.io/migration/airflow-to-dagster)
> - [Dagster and Airlift](https://docs.dagster.io/integrations/libraries/airlift)
> - [Airlift migration guide](https://docs.dagster.io/migration/airflow-to-dagster/airlift-v1)
> - [Troubleshooting concurrency](https://docs.dagster.io/guides/operate/managing-concurrency/troubleshooting-concurrency)

> [!note]- Glossary
>
> **Code-location failure**
> - A failure while Dagster is loading user code and `Definitions`.
> - It explains missing assets, missing jobs, or a broken UI surface before execution starts.
> - It is not the same thing as a run failure.
>
> **Runtime failure**
> - A failure after Dagster successfully launched work.
> - It tells you the project loaded and the incident moved into execution evidence.
> - Runtime success still does not guarantee trusted data.
>
> **Shadow orchestration**
> - Workflow logic reimplemented in ad hoc sensors, hooks, or side effects instead of in the asset graph.
> - It makes the platform hard to reason about under pressure.
> - It often looks flexible until the first large incident.
>
> **Airlift**
> - Dagster's toolkit for integrating with and migrating from Airflow.
> - It enables phased coexistence instead of one all-at-once rewrite.
> - It depends on Airflow-side access and still requires a clear migration plan.

## Troubleshoot By Failure Layer First

The most expensive debugging mistake is changing topology before you have classified the incident. If the code location did not load, the problem is packaging or composition. If a run exists, the project already loaded and the problem moved into runtime evidence.

### Treat Runtime Failures As Runtime Evidence

Once Dagster has started a run, the event stream is the source of truth.

#### Fail one asset intentionally and inspect the failure events

Use this pattern when teaching on-call engineers how Dagster expresses a runtime failure. The trigger is a run that already exists and failed after launch. The purpose is to show that the platform can separate step failure from the overall pipeline failure without confusing the incident with code-location loading.

*Materialize one broken asset with `raise_on_error=False` and print the success flag plus the failure event types.*

```python
import contextlib
import io

import dagster as dg

@dg.asset
def broken_asset():
    raise RuntimeError("warehouse timeout during build")

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([broken_asset], raise_on_error=False)

print(result.success)
print([event.event_type_value for event in result.all_events if "FAILURE" in event.event_type_value])
```

```text
False
['STEP_FAILURE', 'PIPELINE_FAILURE']
```

## Avoid Dagster-Specific Design Traps

The worst Dagster codebases are not usually missing abstractions. They have the wrong abstractions in the wrong layer: giant assets that hide too much, sensors that recreate dependency logic, and replay policies that are broader than the blast radius they are trying to repair.

### Keep The Control Plane Thin

Dagster should know how to request work and record what happened. It should not become a second hidden compute platform or a second hidden scheduler inside Python side effects.

The practical anti-patterns to watch for are:

- a single asset that mixes extraction, validation, publication, and notification side effects
- sensors that duplicate asset-state logic Dagster could already express declaratively
- backfills launched as full replays because no one modeled the real dependency scope
- large data movement pushed through the local Dagster process by habit instead of through the system that should own compute

## Migrate Airflow By Responsibility, Not By Name

The goal is not to recreate Airflow concepts with Dagster vocabulary. The goal is to preserve the durable contract and move execution concerns into the Dagster model that matches them best.

### Use Airlift For Phased Coexistence

Large Airflow estates rarely benefit from a stop-the-world rewrite. Airlift exists so the migration can be staged.

#### Construct the core Airlift connection objects

Use Airlift when the migration needs observation and coexistence before full decommissioning. The trigger is an estate large enough that Airflow and Dagster will live side by side for some period. The purpose is to make the Airflow control-plane connection explicit inside Dagster instead of treating migration as undocumented glue code.

*Create an Airlift basic-auth backend and an `AirflowInstance`, then print the resulting types and connection values.*

```python
from dagster_airlift.core import AirflowBasicAuthBackend, AirflowInstance

auth = AirflowBasicAuthBackend(
    webserver_url="http://airflow.local:8080",
    username="svc_dagster",
    password="***",
)

instance = AirflowInstance(name="legacy_airflow", auth_backend=auth)

print(type(auth).__name__)
print(type(instance).__name__)
print(instance.name)
print(auth.get_webserver_url())
```

```text
AirflowBasicAuthBackend
AirflowInstance
legacy_airflow
http://airflow.local:8080
```

## What To Remember

- Classify incidents first: code loading, runtime execution, or data trust.
- A run failure proves the project loaded; a code-location failure proves it did not.
- The main Dagster anti-patterns are hidden side effects, shadow orchestration, and replay scope that is broader than the real blast radius.
- Airflow migration should translate responsibilities into assets, ops, jobs, and explicit replay boundaries rather than porting task names one to one.
- Airlift is for phased coexistence and observation, not just for renaming Airflow objects inside Dagster.
