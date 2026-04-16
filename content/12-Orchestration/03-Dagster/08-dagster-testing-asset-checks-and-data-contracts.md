---
title: "08 - Dagster Testing, Asset Checks, And Data Contracts"
tags:
  - orchestration
  - dagster
description: "Testing strategies for Dagster projects, including fast in-process execution, asset checks, partition-aware validation, and executable data contracts."
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
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Testing, Asset Checks, And Data Contracts

Dagster becomes trustworthy only when code tests, runtime checks, and consumer-facing contracts work together. Fast tests protect orchestration logic. Asset checks protect produced data. Contracts protect downstream consumers from silent breakage.

> [!abstract]- Summary
>
> This note covers the quality-control layers around a Dagster project:
>
> - use fast in-process execution to test orchestration logic cheaply
> - model runtime data validation with asset checks instead of hidden assertions
> - make partition-aware behavior explicit before a backfill or replay depends on it
> - treat data contracts as executable promises, not just prose documentation

> [!info] Official References
>
> - [Testing assets](https://docs.dagster.io/guides/test)
> - [Asset checks](https://docs.dagster.io/guides/test/asset-checks)
> - [Unit testing assets and ops](https://docs.dagster.io/guides/test/unit-testing-assets-and-ops)
> - [Testing partitioned config and jobs](https://docs.dagster.io/guides/test/testing-partitioned-config-and-jobs)
> - [Data contracts](https://docs.dagster.io/guides/test/data-contracts)

> [!note]- Glossary
>
> **Fast in-process test**
> - A local Dagster execution that does not require the full deployment stack.
> - It catches orchestration regressions early and cheaply.
> - It does not prove production dependencies behave the same way.
>
> **Asset check**
> - A first-class validation rule attached to an asset.
> - It keeps data-quality state visible to the orchestrator.
> - A check only protects what it actually measures.
>
> **Data contract**
> - A consumer-facing guarantee about schema, semantics, or operational behavior.
> - It prevents silent breakage for downstream teams.
> - A contract that is not executed is only documentation.
>
> **Partition-aware test**
> - A test that validates one or more explicit partition boundaries.
> - It makes replay and backfill behavior safer.
> - It still depends on representative partition semantics.

## Test Dagster Logic Before You Hit Real Infrastructure

The cheapest failures are the ones that never leave the local process. A mature Dagster project treats small in-process runs as a normal testing tool, not as a last resort.

### Keep The Feedback Loop Narrow

If an asset or job can fail in isolation, it should fail in isolation before the team touches production-scale dependencies.

#### Execute a job in process as a fast test

Use `execute_in_process` when the goal is to validate orchestration logic, graph wiring, or local business rules without bringing up the full deployment stack. The trigger is any change that could break a job before real infrastructure ever becomes relevant. The purpose is to keep the test surface small and deterministic.

*Execute a tiny Dagster job in process and print the success flag plus the final node output.*

```python
import contextlib
import io

import dagster as dg

@dg.op
def extract():
    return [2, 4, 6]

@dg.op
def average(rows):
    return sum(rows) / len(rows)

@dg.graph
def metrics_graph():
    average(extract())

job = metrics_graph.to_job(name="metrics_job")

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = job.execute_in_process()

print(result.success)
print(result.output_for_node("average"))
```

```text
True
4.0
```

## Turn Data Validation Into Dagster State

A run can succeed while the produced data is still unacceptable. Asset checks exist so that data trust has its own explicit runtime object instead of being hidden inside transform code.

### Keep Quality Checks First-Class

Checks should live in the same orchestration surface as the assets they protect.

#### Evaluate an `@asset_check` and inspect the recorded result

Use an asset check when the validation should be visible in Dagster history and selectable independently of the producing asset. The trigger is a quality rule that operators or consumers need to trust explicitly. The purpose is to give the check its own execution record, metadata, and pass/fail state.

*Run an asset plus one asset check and print the asset key, pass flag, and recorded row count.*

```python
import contextlib
import io

import dagster as dg

@dg.asset
def orders():
    return [{"order_id": 1}, {"order_id": 2}]

@dg.asset_check(asset=orders)
def orders_not_empty():
    return dg.AssetCheckResult(passed=True, metadata={"row_count": 2})

job = dg.define_asset_job("orders_job", selection=dg.AssetSelection.assets(orders))
defs = dg.Definitions(assets=[orders], asset_checks=[orders_not_empty], jobs=[job])

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = defs.get_job_def("orders_job").execute_in_process()

check_event = [event for event in result.all_events if event.event_type_value == "ASSET_CHECK_EVALUATION"][0].event_specific_data

print(result.success)
print(check_event.asset_key.to_user_string())
print(check_event.passed)
print(check_event.metadata["row_count"].value)
```

```text
True
orders
True
2
```

## Make Historical Scope Testable Before Recovery Depends On It

Partition bugs usually hide until a replay, month boundary, or timezone edge exposes them. Partition-aware validation is the discipline that keeps historical repair from becoming a second incident.

### Treat Replay Boundaries As Test Data

If a partition key is operationally important, it should appear in the test surface directly.

#### Inspect the partition keys the test is supposed to protect

Use partition-aware validation when an asset's correctness depends on day, hour, tenant, or region boundaries. The trigger is any incremental asset that will eventually be backfilled or replayed. The purpose is to make the recovery boundary concrete before the first repair workflow depends on it.

*Create a daily partition definition and print the first available keys Dagster generates.*

```python
import dagster as dg

partitions = dg.DailyPartitionsDefinition(start_date="2026-04-13")
print(partitions.get_partition_keys()[:3])
```

```text
['2026-04-13', '2026-04-14']
```

## What To Remember

- Fast in-process execution is the cheapest place to catch Dagster graph and runtime mistakes.
- Asset checks make data quality visible to the orchestrator instead of burying it inside transform code.
- A successful run is not automatically a trusted output; checks and contracts decide that.
- Partition-aware validation should happen before the first historical replay depends on it.
- A data contract becomes real only when Dagster can execute it and surface failure explicitly.
