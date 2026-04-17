---
title: "04 - Dagster Ops, Jobs, And Graphs"
tags:
  - orchestration
  - dagster
description: "Dagster's lower-level orchestration primitives, including ops, graphs, graph-backed assets, and jobs, with guidance on when they should complement asset-first modeling."
created: 2026-04-15
updated: 2026-04-17
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[01-dagster-core-concepts]]"
  - "[[02-dagster-assets-and-lineage]]"
  - "[[03-dagster-resources-config-and-io-managers]]"
  - "[[05-dagster-automation-and-partitions]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Ops, Jobs, And Graphs

Dagster's docs describe an op as the foundational unit of computation, a graph as the connected structure of ops, and a job as the executable object that binds the graph and its resources. Those definitions are accurate, but they are easy to misread in an asset-first codebase. The important distinction is that these lower-level primitives shape execution, while assets usually carry the durable business-facing contract.

> [!abstract]- Summary
>
> This note explains where lower-level Dagster primitives still matter:
>
> - ops capture units of compute, not durable business states
> - graphs describe internal step structure when execution detail matters
> - jobs package launchable slices and carry runtime policy
> - graph-backed assets are the clean bridge when one public dataset needs several internal steps

> [!abstract]- Key Terms
>
> **Op**
> - A unit of computation in Dagster's lower-level model.
> - It is the right abstraction when engineers need explicit step boundaries, retries, or logs.
> - It should not be mistaken for a durable downstream data contract.
>
> **Graph**
> - A composition of ops wired together by dependencies.
> - It explains how internal compute flows.
> - It should not replace the public asset graph when downstream systems care about named data states.
>
> **Job**
> - The executable boundary Dagster launches.
> - Jobs carry runtime policy such as executor choice, selection, config, and tags.
> - In asset-first systems, a job often packages a slice of the asset graph rather than defining the business model itself.
>
> **Graph-backed asset**
> - A public asset implemented by a graph of internal ops.
> - It preserves one durable external identity while allowing richer step structure internally.
> - It is useful when internal phases matter, but only one public dataset should appear in lineage.

## Dagster | jobs

Jobs are Dagster's executable boundary. In an asset-first codebase, they usually do not define the business model by themselves. Instead, they package the exact slice of the asset graph that should launch under a given operational condition.

### Dagster | asset jobs | executable slices of the asset graph

A code location may expose many assets, but operators rarely want to launch the entire location as one unit. The more useful question is which specific slice should run when a source lands, a review is approved, or an export must resume after a governed handoff.

#### Jobs | package an operational slice with `define_asset_job`

Use this pattern when the public model is already asset-first and the next requirement is a launchable boundary with its own executor, tags, and scheduling surface. The trigger is a need to run one coherent portion of the graph without promoting jobs to the primary modeling layer. The code runs at composition time and publishes an executable object. Its purpose is to bind operational launch policy to an explicit asset selection.

*Define the `dagflow` security master job as a selection of capture, raw, review, and dbt transform assets.*

```python
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
```

This is more representative of modern Dagster practice than a toy `@job` wrapping two ops. The job is important, but its meaning comes from the asset slice it launches, not from job structure alone.

## Dagster | ops and graphs

Ops and graphs still matter whenever a single public outcome depends on several internal phases that engineers need to test, log, or retry separately. The important design choice is to keep that internal execution detail visible without polluting the public asset catalog with every implementation step.

### Dagster | internal execution structure | step boundaries without public assets

If downstream consumers never need to ask whether an intermediate step exists as a durable state, that step usually belongs in an op graph rather than as a first-class asset. Ops and graphs are the right abstractions when engineers need execution structure more than downstream lineage.

#### Graphs | compose internal steps into a graph job

Use this pattern when the computation has multiple phases that matter operationally, but the rest of the platform does not need each phase exposed as a first-class asset. The trigger is a multi-step transformation, repair, or normalization routine. The code runs as a normal Dagster job built from ops. Its purpose is to preserve explicit execution structure without polluting public lineage.

*Execute an `@op` plus `@graph` job and print the output returned by the final op.*

```python
import contextlib
import io

import dagster as dg

@dg.op
def extract():
    return ["a", "b"]

@dg.op
def normalize(rows):
    return [row.upper() for row in rows]

@dg.graph
def normalize_graph():
    normalize(extract())

job = normalize_graph.to_job(name="normalize_job")

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = job.execute_in_process()

print(result.success)
print(result.output_for_node("normalize"))
```

```text
True
['A', 'B']
```

#### Graph-backed assets | keep one public asset with several internal steps

Use a graph-backed asset when the internal step structure matters to engineers, but downstream consumers should still see one durable dataset. The trigger is a computation with several meaningful phases that nevertheless culminates in one named data product. The code runs as asset execution while preserving graph structure internally. Its purpose is to keep the external lineage surface clean without flattening the implementation into one unreadable function.

*Materialize a graph-backed asset and print the recorded asset key from the run result.*

```python
import contextlib
import io

import dagster as dg

@dg.op
def extract_sales():
    return [10, 15, 17]

@dg.op
def summarize_sales(rows):
    return {"total": sum(rows), "max": max(rows)}

@dg.graph_asset
def sales_summary():
    return summarize_sales(extract_sales())

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([sales_summary])

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
['sales_summary']
```

> [!question] One boundary question
>
> If a downstream team needs to ask whether a state exists, whether it passed checks, or whether it is safe to replay, make that state an asset. If only engineers need step-level logs and retries inside one computation, keep it behind ops or a graph.

## Dagster | execution policy

Jobs and ops are also where launch policy becomes concrete. Concurrency, executor choice, and retry behavior are execution concerns, so they should be visible on the executable boundary instead of being buried inside business code or hidden in retry loops.

### Dagster | pools, executors, and retries | launch-time control

This is why jobs and ops remain important in asset-first systems. They are the surfaces where an engineer can declare how a slice should run, not only what durable state the slice represents.

#### Ops | attach throttling at the compute boundary

Use this pattern when the operational problem is contention against a shared warehouse, API, or cluster. The trigger is not a data-modeling change but a launch-policy concern such as concurrency control. The code runs at definition time and annotates the executable unit. Its purpose is to move runtime throttling into a visible execution boundary instead of smuggling it into domain code.

*Define an op with a concurrency pool and print the pool name Dagster records on the op definition.*

```python
import dagster as dg

@dg.op(pool="warehouse")
def warehouse_mutation():
    return "done"

print(warehouse_mutation.pool)
print(warehouse_mutation.name)
```

```text
warehouse
warehouse_mutation
```

## Dagster | references

This section collects the official Dagster documentation links most relevant to ops, jobs, and graphs.

- [Dagster ops API](https://docs.dagster.io/api/dagster/ops)
- [Dagster jobs API](https://docs.dagster.io/api/dagster/jobs)
- [Dagster graphs API](https://docs.dagster.io/api/dagster/graphs)
