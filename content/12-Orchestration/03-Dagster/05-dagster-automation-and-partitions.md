---
title: "05 - Dagster Automation And Partitions"
tags:
  - orchestration
  - dagster
description: "Dagster automation patterns for schedules, sensors, declarative automation, partitioned assets, and safe historical replay."
created: 2026-04-15
updated: 2026-04-16
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

Automation is where Dagster turns from a static graph into an operating system for data. The platform decides what should run, when it should run, and which historical slices need replay after something breaks.

> [!abstract]- Summary
>
> This note covers the execution policy surface around assets:
>
> - use schedules when time is the truth
> - use sensors when an external event is the truth
> - prefer declarative automation when Dagster already knows the relevant asset state
> - treat partitions and backfills as explicit recovery scope, not as incidental scheduler behavior

> [!info] Official References
>
> - [Schedules and sensors API](https://docs.dagster.io/api/dagster/schedules-sensors)
> - [Partitions API](https://docs.dagster.io/api/dagster/partitions)
> - [Declarative Automation guide](https://docs.dagster.io/guides/automate/declarative-automation)
> - [Migrating from sensors to Declarative Automation](https://docs.dagster.io/guides/automate/declarative-automation/migrating-from-sensors)

> [!note]- Glossary
>
> **Schedule**
> - Time-based launch logic.
> - Best when the business boundary is the clock itself.
> - A schedule does not prove upstream data is logically complete.
>
> **Sensor**
> - Imperative code that turns an observed event into a run request.
> - Useful for object-store drops, callbacks, or external readiness markers.
> - Overuse creates a second orchestration layer hidden in polling code.
>
> **Automation condition**
> - A declarative rule for when an asset or check should run.
> - It keeps asset-driven policy close to the asset graph.
> - The right condition still depends on cost and blast radius.
>
> **Partition**
> - A logical slice of an asset such as one day, hour, tenant, or region.
> - It is the unit of replay and scoped recovery.
> - Over-partitioning increases metadata and queue overhead.
>
> **Backfill**
> - Historical replay over a set of partitions or assets.
> - It is the safe repair tool after a bug or source-data correction.
> - Backfills without concurrency controls can become a second incident.

## Choose The Simplest Launch Policy That Matches Reality

The professional question is not "can Dagster launch this?" It is "which launch policy matches the real readiness signal without creating unnecessary operational state?"

### Use Time, Events, And Asset State For Different Reasons

Each automation surface exists because the source of truth is different.

#### Define a schedule with an explicit timezone

Use a schedule when the trigger is a business clock boundary such as local midnight, market close, or a fixed reporting hour. The purpose is to make the launch policy explicit about both `cron` and timezone, because "02:00" without a timezone is a twice-a-year daylight-saving bug waiting to happen.

*Define a daily schedule and print its `cron` expression and execution timezone.*

```python
import dagster as dg

@dg.asset
def revenue_snapshot():
    return 1

job = dg.define_asset_job("revenue_job", selection=dg.AssetSelection.assets(revenue_snapshot))
schedule = dg.ScheduleDefinition(job=job, cron_schedule="0 2 * * *", execution_timezone="Europe/Prague")

print(schedule.cron_schedule)
print(schedule.execution_timezone)
```

```text
0 2 * * *
Europe/Prague
```

#### Emit a stable `RunRequest` from a sensor

Use a sensor when an external event is the readiness signal and the sensor must translate that event into a run. The trigger is an upstream file, webhook, watermark row, or completion marker that Dagster cannot infer from asset state alone. The purpose is to make the deduplication handle explicit through `run_key`.

*Define a sensor, yield one `RunRequest`, and print the run key and partition key it would launch.*

```python
import dagster as dg

@dg.asset
def revenue_snapshot():
    return 1

job = dg.define_asset_job("revenue_job", selection=dg.AssetSelection.assets(revenue_snapshot))

@dg.sensor(job=job)
def upstream_ready_sensor():
    yield dg.RunRequest(run_key="orders/2026-04-15", partition_key="2026-04-15")

requests = list(upstream_ready_sensor(None))
print(len(requests))
print(requests[0].run_key)
print(requests[0].partition_key)
```

```text
1
orders/2026-04-15
2026-04-15
```

## Partition Only What You Intend To Replay

Partitions are valuable because they define recovery scope explicitly. They are harmful when they exist only to create more knobs.

### Design Historical Scope Before You Need It

The best time to decide the replay boundary is before the first incident, not during it.

#### Inspect partition keys and the default eager automation label

Use a partition definition when the asset is truly produced in independent slices such as days, hours, or tenants. Use declarative automation when Dagster already knows the asset-state rule and the team does not need a custom polling loop. The purpose is to keep both historical scope and launch policy explicit in code.

*Create a daily partition definition, inspect the first keys, and print the label on `AutomationCondition.eager()`.*

```python
import dagster as dg

partitions = dg.DailyPartitionsDefinition(start_date="2026-04-13")
condition = dg.AutomationCondition.eager()

print(partitions.get_partition_keys()[:2])
print(condition.label)
print(type(condition).__name__)
```

```text
['2026-04-13', '2026-04-14']
eager
AndAutomationCondition
```

## What To Remember

- Use schedules when time is the real trigger, sensors when an external event is the real trigger, and automation conditions when asset state already expresses the rule.
- `run_key` is the deduplication handle that keeps sensors from relaunching the same event.
- Partitions should match a real replay boundary, not just a conceptual data shape.
- Declarative automation reduces orchestration noise when the policy is already asset-native.
- Backfills are controlled historical traffic and should be designed with the same care as steady-state workloads.
