---
title: "02 - Dagster Assets And Lineage"
tags:
  - orchestration
  - dagster
description: "Dagster's software-defined asset model, including dependencies, asset selection, multi-assets, external assets, and how lineage becomes an operational surface."
created: 2026-04-15
updated: 2026-04-16
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[01-dagster-core-concepts]]"
  - "[[03-dagster-resources-config-and-io-managers]]"
  - "[[04-dagster-ops-jobs-and-graphs]]"
  - "[[05-dagster-automation-and-partitions]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Assets And Lineage

Dagster's asset graph is the reason the platform feels different from task-first schedulers. A good graph models durable contracts that matter to downstream consumers, not temporary implementation steps that only exist because one function happens to call another.

> [!abstract]- Summary
>
> This note focuses on the asset graph as an operating surface:
>
> - model durable outputs as assets with explicit dependencies
> - use selection to rerun only the affected slice of the graph
> - use multi-assets only when one compute boundary truly emits several durable outputs
> - keep external or upstream-owned datasets visible without pretending Dagster owns their compute

> [!info] Official References
>
> - [Dagster assets API](https://docs.dagster.io/api/dagster/assets)
> - [Dagster asset checks API](https://docs.dagster.io/api/dagster/asset-checks)
> - [Dagster components guide](https://docs.dagster.io/guides/build/components)

> [!note]- Glossary
>
> **Asset key**
> - The unique identity of an asset in the Dagster graph.
> - Stable keys keep lineage and history intelligible.
> - Casual renames create migration churn and broken expectations.
>
> **Asset dependency**
> - The declared upstream relationship between assets.
> - It drives impact analysis and targeted reruns.
> - It should represent data dependence, not mere code reuse.
>
> **Asset selection**
> - A subset of the graph chosen for execution.
> - This is how operators rerun only the blast radius that matters.
> - Selection quality depends on clean asset boundaries.
>
> **Multi-asset**
> - One compute boundary that materializes multiple assets.
> - Useful when one job naturally emits several durable outputs together.
> - Overuse makes retries and checks harder to localize.
>
> **External asset**
> - A dataset Dagster tracks without owning the execution that produces it.
> - It keeps lineage honest across tools and teams.
> - Visibility is not the same thing as operational control.

## Model Dependencies As Data Contracts

The asset graph should answer a business-facing question: which produced object depends on which upstream object? If a node exists only because a script had an internal step, it usually belongs under ops or a graph-backed asset instead of in the public graph.

### Make The Graph Explicit

The first improvement over task-first orchestration is naming the durable outputs and wiring them together directly.

#### Declare an upstream chain and inspect the graph keys

Use this pattern when moving from a task list to a lineage-aware platform. The trigger is a need to explain what downstream objects must be rebuilt after an upstream fix. The purpose is to make the dependency chain visible in Dagster before introducing checks, schedules, or sensors.

*Define a three-asset chain and print the resolved asset keys from `Definitions`.*

```python
import dagster as dg

@dg.asset
def raw_orders():
    return 1

@dg.asset(deps=[raw_orders])
def cleaned_orders():
    return 1

@dg.asset(deps=[cleaned_orders])
def daily_revenue():
    return 1

defs = dg.Definitions(assets=[raw_orders, cleaned_orders, daily_revenue])
print([spec.key.to_user_string() for spec in defs.resolve_all_asset_specs()])
```

```text
['raw_orders', 'cleaned_orders', 'daily_revenue']
```

#### Use `AssetSelection` to target the affected slice

Use asset selection when the incident is partial rather than platform-wide. The trigger is an upstream fix, schema correction, or scoped replay. The purpose is to target only the relevant downstream chain instead of replaying unrelated assets.

*Build an upstream selection from `daily_revenue` and print the selection type Dagster creates.*

```python
import dagster as dg

@dg.asset
def raw_orders():
    return 1

@dg.asset(deps=[raw_orders])
def cleaned_orders():
    return 1

@dg.asset(deps=[cleaned_orders])
def daily_revenue():
    return 1

selection = dg.AssetSelection.assets(daily_revenue).upstream()
print(type(selection).__name__)
```

```text
UpstreamAssetSelection
```

## Scale The Graph Without Hiding Reality

The graph should stay legible under growth. Factories, external assets, and multi-assets are useful only when they preserve asset identity and retry boundaries.

### Match The Asset Shape To The Compute Boundary

One compute boundary can produce several assets, but that should be a property of the real runtime, not a shortcut for collapsing unrelated work.

#### Materialize two assets from one shared compute boundary

Use a multi-asset when one warehouse statement, Spark job, or external pipeline naturally emits several durable outputs together. The trigger is a shared retry boundary that already exists outside Dagster. The purpose is to mirror that runtime truth without inventing fake intermediate assets.

*Materialize a `@multi_asset` and print the run success flag plus the emitted asset keys.*

```python
import contextlib
import io

import dagster as dg

@dg.multi_asset(specs=[dg.AssetSpec("silver_orders"), dg.AssetSpec("silver_customers")])
def build_silver():
    yield dg.MaterializeResult(asset_key="silver_orders", metadata={"rows": 10})
    yield dg.MaterializeResult(asset_key="silver_customers", metadata={"rows": 5})

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([build_silver])

print(result.success)
print([event.materialization.asset_key.to_user_string() for event in result.get_asset_materialization_events()])
```

```text
True
['silver_orders', 'silver_customers']
```

#### Keep upstream-owned datasets in the same lineage surface

Use `SourceAsset` when a dependency is operationally important but produced by another tool or team. The trigger is a warehouse table, SaaS landing zone, or external model output that downstream Dagster assets consume. The purpose is to keep blast-radius reasoning honest across system boundaries.

*Declare an external asset and print the Dagster type and key it exposes.*

```python
import dagster as dg

crm_snapshot = dg.SourceAsset("crm_snapshot")
print(type(crm_snapshot).__name__)
print(crm_snapshot.key.to_user_string())
```

```text
SourceAsset
crm_snapshot
```

## What To Remember

- Assets should represent durable data contracts, not internal implementation trivia.
- Asset selection is how you convert lineage into safe reruns and scoped recovery.
- Multi-assets are correct only when the shared compute boundary is real and the retry scope is shared.
- External assets belong in the graph when downstream consumers depend on them, even if Dagster does not own the compute.
- A useful graph is one operators can read under pressure and act on without reconstructing the platform from logs.
