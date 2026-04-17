---
title: "05 - Dagster Automation And Partitions"
tags:
  - orchestration
  - dagster
description: "Dagster automation patterns for schedules, sensors, declarative automation, partitioned assets, and safe historical replay."
created: 2026-04-15
updated: 2026-04-17
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[01-dagster-core-concepts]]"
  - "[[02-dagster-assets-and-lineage]]"
  - "[[03-dagster-resources-config-and-io-managers]]"
  - "[[04-dagster-ops-jobs-and-graphs]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Automation And Partitions

Automation is where Dagster stops being only a description of asset dependencies and becomes an active control plane. The key design question is not whether Dagster can launch something. It is what fact should cause the launch: a clock boundary, an external event, or state Dagster already knows from the asset graph itself. Historical replay is a second question layered on top of that, not a side effect of whichever automation surface happened to be used first.

> [!abstract]- Summary
>
> This note separates the main automation decisions Dagster asks you to make:
>
> - schedules are for time being the contract
> - sensors are for external facts that Dagster must observe and translate into runs
> - declarative automation is for asset-native policy Dagster can already evaluate from its own state
> - partitions and backfills are about recovery scope, not about choosing a trigger

> [!abstract]- Key Terms
>
> **Schedule**
> - The schedules API describes schedules as Dagster's way to support traditional automation on a regular cadence.
> - A schedule is correct when the clock itself is the readiness signal.
> - It does not prove upstream data is present or complete.
>
> **Sensor**
> - A sensor is a user-defined evaluation function that decides whether to launch work based on observed state.
> - It is appropriate when the trigger is outside Dagster's own asset state.
> - A sensor that re-implements logic Dagster already knows is hidden orchestration debt.
>
> **Automation condition**
> - An automation condition expresses a declarative asset rule such as eager downstream updates.
> - It keeps policy near the graph instead of scattering it across polling code.
> - It only helps when the necessary readiness information is already present inside Dagster's state model.
>
> **Partition**
> - A partition is one named slice of an asset, such as a day, hour, tenant, or region.
> - It defines the unit of replay and historical scope.
> - A partition scheme that does not match the real recovery unit becomes operational noise.
>
> **Backfill**
> - A backfill is controlled historical replay across one set of partitions or assets.
> - It is a recovery workflow, not merely a larger scheduled run.
> - Backfills need the same concurrency and blast-radius discipline as steady-state traffic.

## Dagster | automation triggers

Dagster has several automation surfaces because readiness can come from different kinds of truth. Sometimes the trigger is the clock. Sometimes it is an external event. Sometimes Dagster already has enough asset state to decide what should run next without imperative polling code.

### Dagster | schedules, sensors, and automation conditions | match the readiness signal

The correct automation surface follows the real readiness signal. If readiness comes from the wall clock, use a schedule. If another system owns the fact, use a sensor. If Dagster already has the necessary state in the asset graph, use an automation condition. Problems begin when one surface is forced to impersonate another.

#### Schedules | use a schedule when the clock is the contract

Use a schedule when business readiness is defined by time, such as market close, a daily reporting cutoff, or a fixed publication hour. The trigger is the cadence itself rather than a separately observed upstream event. The definition lives in the orchestration layer and is read-only until a run is actually launched. Its purpose is to make both cadence and timezone explicit so automation means the same thing in code, in the UI, and during daylight-saving transitions.

*Define a daily schedule with an explicit timezone and inspect its launch parameters.*

```python
import dagster as dg

@dg.asset
def revenue_snapshot():
    return 1

job = dg.define_asset_job(
    "revenue_job",
    selection=dg.AssetSelection.assets(revenue_snapshot),
)
schedule = dg.ScheduleDefinition(
    job=job,
    cron_schedule="0 2 * * *",
    execution_timezone="Europe/Prague",
)

print(schedule.cron_schedule)
print(schedule.execution_timezone)
```

```text
0 2 * * *
Europe/Prague
```

#### Sensors | use a sensor when another system owns readiness

Use a sensor when Dagster must observe an external fact and translate it into a run request. The trigger is a file arrival, watermark row, approval state, callback, or any other event Dagster cannot infer from asset state alone. The sensor runs in the daemon's evaluation loop and is read-only until it yields a `RunRequest`. Its purpose is to turn an external fact into an explicit run key, tags, and executable slice.

*Resume export only after the control plane records a validated review state.*

```python
def build_review_validation_sensor(job: Any, pipeline_code: str) -> Any:
    @sensor(
        name=f"{pipeline_code}_review_validation_sensor",
        job=job,
        default_status=DefaultSensorStatus.RUNNING,
        required_resource_keys={"control_plane"},
    )
    def _sensor(context: SensorEvaluationContext) -> Any:
        control_plane = context.resources.control_plane
        approved_runs = control_plane.export_ready_runs(pipeline_code)
        if not approved_runs:
            yield SkipReason(
                f"No validated {pipeline_code} review runs are waiting for export"
            )
            return

        for approved_run in approved_runs:
            yield RunRequest(
                run_key=(
                    f"{pipeline_code}:{approved_run['run_id']}:"
                    f"validated-export:{approved_run['validated_at'].isoformat()}"
                ),
                tags={
                    "dagflow_run_id": str(approved_run["run_id"]),
                    "dagflow_business_date": approved_run["business_date"].isoformat(),
                    "validated_at": approved_run["validated_at"].isoformat(),
                },
            )

    return _sensor
```

This is the automation pattern that matters most in `dagflow`. Approval is not a schedule. It is not asset-native automation either, because the decisive fact lives in workflow state maintained by the control plane. The sensor exists to watch that external persisted fact and resume only the export slice once the review boundary has been crossed.

#### Automation conditions | use declarative automation when Dagster already has the state

Use declarative automation when the policy can be derived from Dagster's own graph state, such as "run downstream eagerly when upstream changes." The trigger is already represented inside the orchestrator rather than in a partner database or side channel. The policy attaches directly to the asset definition. Its purpose is to keep asset-native automation close to the graph and reduce the amount of custom polling code the team has to own.

*Attach an eager automation condition directly to an asset definition.*

```python
import dagster as dg

@dg.asset(
    deps=["upstream"],
    automation_condition=dg.AutomationCondition.eager(),
)
def eager_asset() -> None:
    ...
```

## Dagster | partitions and backfills

Automation surfaces answer why Dagster should launch work now. Partitions and backfills answer what slice of history the system expects to rebuild when something goes wrong. Keeping those ideas separate makes both the trigger model and the recovery model much easier to reason about.

### Dagster | replay boundaries | partition scope and historical repair

The partition model is correct when one partition key corresponds to one meaningful repair boundary. It becomes weak when the scheme exists only because the data happens to be date-shaped or because the UI looks cleaner with slices.

#### Partitions | inspect a partition definition at an explicit evaluation time

Use a partition definition when the asset is genuinely produced in independent historical slices such as one day, hour, or tenant. The trigger is a need for targeted replay that is narrower than a full rebuild. The code is metadata inspection, not state change. Its purpose is to make the replay unit explicit enough that tests, backfills, and run tagging can all refer to the same slice of history.

*Create a daily partition definition, anchor evaluation time explicitly, and inspect the available keys.*

```python
from datetime import datetime

import dagster as dg

partitions = dg.DailyPartitionsDefinition(start_date="2026-04-13")
print(partitions.get_partition_keys(current_time=datetime(2026, 4, 16))[:3])
```

```text
['2026-04-13', '2026-04-14', '2026-04-15']
```

#### Partitions | recognize an explicit replay boundary without native partitions

Use this framing when the system clearly has a replay unit, but the current implementation represents it through control-plane state, tags, or business dates rather than through Dagster's partition APIs. The trigger is a platform that still needs scoped repair even though it is not yet modeled as a partitioned asset graph. The context is architectural interpretation rather than a new API surface. Its purpose is to keep the replay boundary intelligible until or unless native partitions become the right fit.

> [!example] `business_date` can be a real replay unit
>
> The local `dagflow` repository currently scopes ingestion, review publication, and export resume by `business_date` and `run_id` carried through the control plane and sensor tags. That is already a real recovery boundary even though the assets are not modeled with `DailyPartitionsDefinition`. The important operational question is not "did we use the partition API?" It is "can we explain exactly which historical slice will rerun and why?"

### Dagster | backfills | deliberate historical traffic

Once the replay boundary is explicit, a backfill becomes deliberate historical traffic with its own blast radius. It should not be treated as a harmless extension of the steady-state launch policy or as an afterthought once an incident is already underway.

#### Backfills | design capacity before the first repair depends on it

Use this planning boundary when a dataset may eventually need historical repair over many slices at once. The trigger is any pipeline where the combination of normal traffic and replay traffic could overwhelm shared systems or create hidden duplicate work. The context spans automation and operations together. Its purpose is to make backfills an intentional recovery workflow instead of an improvised storm of reruns.

> [!question] What happens if approval resumes and replay start at the same time?
>
> In a governed pipeline, it is common for ordinary daily work, review-resume sensors, and historical repair to coexist. If a backfill can relaunch a month of slices while validated review runs are simultaneously resuming export, the automation surface is only half the design. The other half is deployment concurrency: which runs can launch together, and which shared systems need pools or global limits before historical traffic becomes a second incident.

## Dagster | references

This section collects the official Dagster documentation links most relevant to automation, partitions, and backfills.

- [Schedules and sensors API](https://docs.dagster.io/api/dagster/schedules-sensors)
- [Partitions API](https://docs.dagster.io/api/dagster/partitions)
- [Declarative Automation guide](https://docs.dagster.io/guides/automate/declarative-automation)
- [Migrating from sensors to Declarative Automation](https://docs.dagster.io/guides/automate/declarative-automation/migrating-from-sensors)
