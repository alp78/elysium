---
title: "08 - Dagster Testing, Asset Checks, And Data Contracts"
tags:
  - orchestration
  - dagster
description: "Testing strategies for Dagster projects, including fast in-process execution, asset checks, partition-aware validation, and executable data contracts."
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
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Testing, Asset Checks, And Data Contracts

Dagster quality work is not one thing. A serious project needs at least four distinct answers: does the code location load, does a narrow execution path behave as intended, does the resulting asset satisfy explicit quality checks, and do downstream consumers still receive the structure and semantics they were promised. Treating all four as "tests" hides the real operational boundary between orchestration correctness and data trust.

> [!abstract]- Summary
>
> This note separates the main quality layers in a Dagster project:
>
> - composition tests prove the code location loads and exposes the intended operating surface
> - in-process execution tests catch graph and business-rule regressions without full infrastructure
> - asset checks turn data trust into Dagster-visible runtime state
> - data contracts define which structural and semantic changes downstream consumers are allowed to absorb

> [!info] Official References
>
> - [Testing assets](https://docs.dagster.io/guides/test)
> - [Asset checks](https://docs.dagster.io/guides/test/asset-checks)
> - [Unit testing assets and ops](https://docs.dagster.io/guides/test/unit-testing-assets-and-ops)
> - [Testing partitioned config and jobs](https://docs.dagster.io/guides/test/testing-partitioned-config-and-jobs)
> - [Data contracts](https://docs.dagster.io/guides/test/data-contracts)

> [!abstract]- Key Terms
>
> **Composition test**
> - A test that proves the code location can be loaded and exposes the expected Dagster objects.
> - It protects the discovery boundary before any run starts.
> - A failing composition test is usually a wiring, import, naming, or resource-requirement problem.
>
> **Fast in-process execution**
> - A local Dagster execution that stays inside the test process.
> - It is the cheapest useful rehearsal for graph logic, config handling, and small business rules.
> - It does not prove that production infrastructure, concurrency, or external systems behave the same way.
>
> **Asset check**
> - Dagster defines asset checks as tests that verify specific properties of data assets.
> - A good asset check protects one clearly named property so the failure signal stays interpretable over time.
> - The check becomes runtime state visible in the orchestrator instead of hidden assertion logic inside transforms.
>
> **Data contract**
> - A data contract is an agreement about structure, format, and quality that downstream consumers rely on.
> - In Dagster, contracts become executable when checks validate the actual asset against the promised shape or semantics.
> - A prose-only contract can describe intent, but it cannot stop breaking change from shipping.
>
> **Replay boundary**
> - The replay boundary is the unit of history the system expects to rerun safely, such as a day, hour, tenant, or business date.
> - Testing it early makes backfills and targeted repair less improvisational.
> - If the replay boundary is implicit, recovery is usually broader and riskier than the business actually needs.

## Dagster | composition and execution tests

Dagster quality work starts with the fastest reliable failures. That means composition tests first, then narrow in-process execution. Both stay close to the code location and keep the control plane from discovering basic breakage only after deployment.

### Dagster | loadability and in-process execution | fast tests near the composition root

A Dagster project that cannot be discovered and loaded is already broken, even if every individual asset body looks valid in isolation. Once the project loads, in-process execution becomes the next narrow rehearsal for graph wiring and local business rules before shared infrastructure enters the picture.

#### Tests | assert that the code location exposes the expected asset surface

Use this pattern when the team wants to fail fast on broken topology before debugging UI behavior, daemon behavior, or run behavior. The trigger is any change to the composition root, imported assets, attached checks, or code-location wiring. The code runs in a normal Python test process and is read-only with respect to business data. Its purpose is to prove that the Dagster operating surface exists before the control plane tries to use it.

*Assert that the loaded `Definitions` object exposes an asset graph with asset checks.*

```python
from dagflow_dagster.definitions import defs

def test_definitions_load_assets() -> None:
    assert defs is not None
    asset_graph = defs.get_repository_def().asset_graph
    assert asset_graph.asset_check_keys
```

This is the first useful test in the local `dagflow` repository because that project's value depends on the code location exposing dbt-backed assets, review snapshot assets, export assets, and check surfaces together. If that composition breaks, later tests about review approval or CSV export are already downstream of the wrong failure.

#### Jobs | execute a job in process before infrastructure enters the picture

Use `execute_in_process` when the goal is to validate graph wiring, config, or local business rules before warehouses, queues, and external services become relevant. The trigger is a code change that could break the execution path even if the code location still loads. The code runs in-process and changes only local runtime state. Its purpose is to keep the feedback loop narrow enough that one failing behavior can be explained without reconstructing a distributed incident.

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

## Dagster | asset checks

Asset checks exist because a run can succeed while the produced asset is still unusable. Dagster turns those data-trust assertions into first-class runtime objects so operators can reason about them historically, select them explicitly, and separate execution success from data acceptance.

### Dagster | data trust | protect one explicit property per check

Checks become noisy when they collapse many unrelated promises into one binary result. The stronger pattern is to name one specific claim about the asset and let Dagster track that claim as its own runtime object.

#### Asset checks | evaluate one asset check and inspect the result

Use an asset check when the validation should be visible in Dagster history and selectable independently of the producing asset. The trigger is a quality rule that operators or consumers need to trust explicitly after a run finishes. The code runs as ordinary Dagster execution and records check state alongside asset state. Its purpose is to promote one concrete quality claim into the orchestrator rather than burying it in ad hoc assertions or log inspection.

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

check_event = [
    event
    for event in result.all_events
    if event.event_type_value == "ASSET_CHECK_EVALUATION"
][0].event_specific_data

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

#### Asset checks | attach checks to review and export boundaries

Use this pattern when the system has governed states that downstream teams or workflows rely on directly. The trigger is a workflow where "rows were loaded," "review rows were published," or "the export file was written" are business-relevant claims in their own right. The code runs inside normal asset definitions and records checks at the same boundary where the state change occurs. Its purpose is to make those operational promises queryable in Dagster instead of leaving them implicit in side effects.

*Attach check specs to source capture, review publication, and CSV export assets.*

```python
@asset(
    key=SECURITY_MASTER_TICKERS_CAPTURE_ASSET_KEY,
    group_name="source_capture",
    check_specs=[
        AssetCheckSpec("rows_loaded", asset=SECURITY_MASTER_TICKERS_CAPTURE_ASSET_KEY)
    ],
)
def sec_company_tickers_capture(...):
    ...

@asset(
    key=SECURITY_MASTER_REVIEW_ASSET_KEY,
    deps=[dbt_asset_key("security_master", "dim_security")],
    group_name="review",
    check_specs=[
        AssetCheckSpec("review_rows_published", asset=SECURITY_MASTER_REVIEW_ASSET_KEY)
    ],
)
def security_master_review_snapshot(...):
    ...

@asset(
    key=SECURITY_MASTER_CSV_EXPORT_ASSET_KEY,
    deps=[dbt_asset_key("security_master", "security_master_final")],
    group_name="validated_export",
    check_specs=[
        AssetCheckSpec("csv_written", asset=SECURITY_MASTER_CSV_EXPORT_ASSET_KEY)
    ],
)
def security_master_csv_export(...):
    ...
```

That pattern is more than cosmetic. In `dagflow`, review publication and CSV export are governed state transitions. A missing review snapshot means the review workflow cannot begin. A missing CSV export means approval did not become delivery. Checks on those boundaries communicate operational truth, not merely developer preference.

## Dagster | data contracts

Data contracts exist because downstream consumers break when columns disappear, names change, types shift, or required fields arrive empty. In a Dagster system, a contract should become executable enough that breaking change is surfaced before downstream systems absorb it silently.

### Dagster | structural guarantees | enforce allowed change

The fastest way to weaken a contract is to describe it in prose and never execute it. The stronger pattern is to encode non-negotiable structure and quality guarantees as executable checks close to the asset surface.

#### dbt tests | express non-negotiable columns as executable tests

Use this pattern when the asset contract depends on fields that must remain unique, present, or semantically usable across runs. The trigger is any dataset consumed by other models, services, exports, or human review workflows. The code runs in the warehouse test layer and is read-only with respect to production data shape. Its purpose is to turn mandatory structural guarantees into executable assertions.

*Declare non-null and uniqueness guarantees for curated Dagflow models in dbt schema tests.*

```yaml
version: 2

models:
  - name: dim_security
    columns:
      - name: security_id
        tests:
          - not_null
      - name: ticker
        tests:
          - not_null

  - name: fact_shareholder_holding
    columns:
      - name: holding_id
        tests:
          - unique
          - not_null
      - name: security_id
        tests:
          - not_null
```

If `dim_security.security_id` stops being non-null, that is not only a warehouse defect. It is a broken contract for any downstream holdings model, review workflow, or export file that assumes each security is stably addressable.

#### DagsterDbtTranslator | surface warehouse contract tests as Dagster checks

Use this pattern when the contract is enforced in another system, such as dbt, but the orchestration layer still needs first-class visibility into failures. The trigger is a platform where transformation and orchestration are separate tools, yet operators need one place to read the health of governed assets. The code runs at translator or integration configuration time. Its purpose is to keep warehouse-native tests and Dagster-native operational visibility aligned.

*Enable dbt model tests and source tests as Dagster asset checks in the translator layer.*

```python
class DagflowDbtTranslator(DagsterDbtTranslator):
    def __init__(self) -> None:
        super().__init__(
            settings=DagsterDbtTranslatorSettings(
                enable_asset_checks=True,
                enable_source_tests_as_checks=True,
            )
        )
```

> [!example] A contract break should describe blast radius
>
> In `dagflow`, a failed uniqueness or non-null test on `holding_id` or `security_id` is not an abstract data-quality blemish. It means review rows may no longer map cleanly to curated facts, export rows may lose stable identity, and downstream consumers can no longer trust that one row still means one governed holding. That is exactly what a data contract should make visible.

## Dagster | replay-boundary testing

Historical repair is where hidden assumptions usually become expensive. Whether the recovery unit is a calendar partition, a tenant slice, or a business date carried through control-plane metadata, the workflow should be explicit and testable before the first incident forces the team to depend on it.

### Dagster | historical slices | test the unit you expect to rebuild

If the system intends to replay by day, test day boundaries. If it intends to replay by tenant, test tenant scope. Recovery usually goes wrong when the platform's real replay unit exists only in operator folklore.

#### Partitions | inspect the partition keys the recovery workflow depends on

Use partition-aware validation when an asset's correctness depends on an explicit historical slice such as one day, hour, or region. The trigger is any incremental asset that the team expects to backfill later rather than recomputing globally. The code is read-only metadata inspection. Its purpose is to make the replay boundary visible and testable before the first repair depends on it.

*Create a daily partition definition, anchor evaluation time explicitly, and print the first available keys Dagster generates.*

```python
from datetime import datetime

import dagster as dg

partitions = dg.DailyPartitionsDefinition(start_date="2026-04-13")
print(partitions.get_partition_keys(current_time=datetime(2026, 4, 16))[:3])
```

```text
['2026-04-13', '2026-04-14', '2026-04-15']
```

Not every incremental Dagster system has to use native partitioned assets. The local `dagflow` project currently scopes replay and export resume by `business_date` and `run_id` flowing through its control plane and sensor tags rather than by `DailyPartitionsDefinition`. The important point is not the specific mechanism. It is that the replay unit is explicit, stable, and testable.
