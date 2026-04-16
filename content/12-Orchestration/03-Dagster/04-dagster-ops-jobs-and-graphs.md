---
title: "04 - Dagster Ops, Jobs, And Graphs"
tags:
  - orchestration
  - dagster
description: "Dagster's lower-level orchestration primitives, including ops, graphs, graph-backed assets, and jobs, with guidance on when they should complement asset-first modeling."
created: 2026-04-15
updated: 2026-04-16
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

Dagster is asset-first, but not asset-only. Ops, graphs, and jobs exist for the moments when the execution shape matters more than exposing every internal step as a first-class durable contract.

> [!abstract]- Summary
>
> This note covers the lower-level Dagster surface:
>
> - ops as units of compute rather than public data contracts
> - graphs as reusable internal execution shapes
> - jobs as the executable boundary that carries runtime policy
> - graph-backed assets as the clean bridge between internal step detail and external asset identity

> [!info] Official References
>
> - [Dagster ops API](https://docs.dagster.io/api/dagster/ops)
> - [Dagster jobs API](https://docs.dagster.io/api/dagster/jobs)
> - [Dagster graphs API](https://docs.dagster.io/api/dagster/graphs)

> [!note]- Glossary
>
> **Op**
> - A unit of computation in Dagster's lower-level model.
> - It keeps internal execution steps explicit without promoting all of them to assets.
> - An op is not automatically a durable business-facing output.
>
> **Graph**
> - A composition of ops wired together by dependencies.
> - It captures reusable execution flow inside one computational boundary.
> - A graph full of implementation-only detail should not replace the public asset graph.
>
> **Job**
> - The executable boundary Dagster launches.
> - Jobs carry config, tags, executors, retries, and operational launch policy.
> - A job is often a wrapper around asset selection rather than the main design surface.
>
> **Graph-backed asset**
> - A public asset implemented by a graph of internal ops.
> - It keeps internal compute visible to engineers without exposing it as public lineage.
> - If every asset becomes a graph of dozens of ops, the codebase is probably too low level.

## Use Lower-Level Primitives When Execution Detail Matters

The key decision is not "assets or ops?" It is "does the rest of the platform need a durable asset contract here, or only a reusable execution boundary?"

### Keep Internal Compute Explicit Without Polluting The Asset Graph

Ops and graphs are right when the implementation has multiple phases that matter for retries, logging, or testing, but the rest of the platform only needs the final result.

#### Compose ops into a graph and execute the job in process

Use this pattern when the runtime steps matter more than exposing each step as a durable asset. The trigger is a multi-step transformation, reconciliation, or repair workflow. The purpose is to preserve explicit execution structure without bloating the asset catalog.

*Execute an `@op` + `@graph` job and print the normalized output returned by the final op.*

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

### Keep The Public Contract Asset-First

If downstream consumers care about one durable output, expose one durable asset and keep the internal steps behind that boundary.

#### Implement one durable asset with a graph-backed asset

Use a graph-backed asset when several internal steps produce one public dataset. The trigger is a need for internal execution detail without fragmenting the external lineage surface. The purpose is to preserve a clean asset contract while still making the implementation testable and readable.

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
print([event.materialization.asset_key.to_user_string() for event in result.get_asset_materialization_events()])
```

```text
True
['sales_summary']
```

#### Put runtime throttling on the executable boundary

Use job and op metadata when the concern is runtime policy rather than data modeling. The trigger is contention against a shared warehouse, API, or cluster. The purpose is to attach the operational rule at the execution boundary instead of burying it inside business logic.

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

## What To Remember

- Ops and graphs are execution abstractions; assets remain the public durable contract.
- Jobs are where runtime policy becomes concrete: tags, retries, executors, and throttling belong there.
- Graph-backed assets are the cleanest hybrid pattern when one durable output has several meaningful internal steps.
- If every public dataset disappears into deep op wiring, the team is recreating a task-first orchestrator inside Dagster.
- Keep the public graph high signal and let lower-level primitives carry only the internal detail that operators actually need.
