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

Dagster is easiest to read when you treat the asset graph as the public contract and the execution plan as the implementation detail. The core vocabulary exists to answer four operational questions: what durable state exists, what depends on it, what just ran, and whether the produced state should be trusted.

> [!abstract]- Summary
>
> This note defines the Dagster primitives that appear in every serious project:
>
> - `Definitions` as the composition root for a code location.
> - assets, materializations, and observations as the durable state model.
> - runs as the execution record that explains what Dagster actually launched.
> - the boundary between Dagster's control plane and the systems that compute data.

> [!info] Official References
>
> - [Dagster overview](https://docs.dagster.io/)
> - [Dagster definitions API](https://docs.dagster.io/api/dagster/definitions)
> - [Dagster assets API](https://docs.dagster.io/api/dagster/assets)
> - [Deployment overview](https://docs.dagster.io/deployment)

> [!note]- Glossary
>
> **Asset**
> - A durable data product or externally meaningful state tracked by Dagster.
> - It is the main operating object for lineage, checks, and targeted reruns.
> - Not every internal compute step deserves to become an asset.
>
> **Materialization**
> - The event that records an asset was produced.
> - It proves that Dagster saw work complete for that asset.
> - A materialization does not prove the data is semantically correct.
>
> **Observation**
> - Metadata recorded about an asset Dagster does not recompute itself.
> - It keeps externally managed datasets visible in the same graph.
> - Observation preserves visibility, not ownership of the upstream runtime.
>
> **Definitions**
> - The composition root that gathers assets, jobs, schedules, sensors, checks, and resources.
> - If `Definitions` fails to load, the code location is broken before any run starts.
> - A load failure is a discovery problem, not a run failure.
>
> **Run**
> - One execution request against a job or asset selection.
> - Runs are where you inspect what Dagster launched and what failed.
> - Run success still needs checks before the output should be trusted.

## Build The Smallest Useful Dagster Project

Dagster becomes concrete as soon as you can point at a `Definitions` object and a pair of assets with an explicit dependency. That is the minimum shape of a code location worth operating.

### Compose Assets Before Thinking About Automation

Start with the durable contract. Once the asset graph is explicit, everything else in the platform has a stable object to reason about.

#### Compose assets inside `Definitions`

Use this pattern when the team is moving from loose scripts to a loadable Dagster project. The trigger is a need for one composition root that code review, CI, and the Dagster UI can all inspect. The purpose is to make asset identity and dependency order explicit before adding schedules, sensors, or deployment concerns.

*Build a two-asset graph and print the asset keys Dagster resolves from `Definitions`.*

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

#### Materialize assets and inspect the recorded state

Use materialization output when the question is no longer "did the code load?" but "what durable objects did Dagster record for this run?" The context is runtime evidence. The purpose is to keep the distinction clear between a valid code location and a successful execution.

*Materialize the same two assets and print the run success flag plus the materialized asset keys.*

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
print([event.materialization.asset_key.to_user_string() for event in result.get_asset_materialization_events()])
```

```text
True
['raw_orders', 'daily_revenue']
```

## Distinguish Owned Compute From Observed State

Dagster is strongest when it tracks what the platform cares about without pretending it executes every upstream system. That is why observations exist alongside materializations.

### Keep Externally Managed Data Honest

An external dataset should still appear in the graph if downstream assets depend on it, but the graph must say whether Dagster observed the state or computed it.

#### Declare an observed upstream dataset explicitly

Use an observable source asset when the upstream system is real, important, and outside Dagster's direct execution boundary. The trigger is a dependency on vendor data, ingestion tooling, or another platform team. The purpose is to keep lineage and metadata visible without claiming rerun authority over the upstream workload.

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

## Decide When Dagster Fits

Dagster fits when the data platform needs lineage-aware reruns, data-quality controls, partition-aware recovery, and a single control plane for heterogeneous compute. It is usually the wrong tool for one isolated recurring script with no meaningful downstream graph.

The practical test is simple:

- if the business cares which dataset is stale, broken, or missing, Dagster's asset model is usually worth it
- if the business only cares that one script runs at 02:00, a simpler scheduler is usually the better engineering choice

## What To Remember

- `Definitions` is the composition root that must load before anything else in Dagster can work.
- Assets are the durable contract; runs are the execution record; checks and metadata determine trust.
- Materialization means Dagster recorded a produced asset, not that the asset is automatically accepted.
- Observable source assets keep externally managed data visible without lying about who owns the compute.
- The platform should model business-relevant state, not every implementation detail.
