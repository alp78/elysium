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

Dagster's assets API defines an asset as an object in persistent storage and an asset definition as the code description of how that object should exist and be updated. That wording is more consequential than it first appears. It means lineage is not decorative metadata around Python functions. It is the operating picture of which durable states exist, which ones depend on each other, and how far a repair or replay should travel.

> [!abstract]- Summary
>
> This note treats the asset graph as a recovery and trust surface:
>
> - assets should name durable states the business can recognize under pressure
> - lineage edges should mean data dependence, not incidental function order
> - selection is the mechanism that turns lineage into scoped replay
> - external and human-governed states belong in the graph when downstream trust depends on them

> [!info] Official References
>
> - [Dagster assets API](https://docs.dagster.io/api/dagster/assets)
> - [Dagster overview](https://docs.dagster.io/)

> [!note]- Glossary
>
> **Asset key**
> - The stable identity Dagster uses to track history, lineage, and checks for one durable state.
> - Good keys survive refactors because they name the data product, not the current implementation detail.
> - Casual renames break continuity in the graph rather than merely changing display text.
>
> **Asset dependency**
> - The declared upstream relationship between two durable states.
> - Its meaning should be "this dataset depends on that dataset," not "this function happened to call that helper."
> - Clean dependencies are what make impact analysis and scoped reruns credible.
>
> **Asset selection**
> - The slice of the graph chosen for execution.
> - This is where lineage becomes operational: a team can replay only the affected surface instead of relaunching everything.
> - Selection is only as useful as the asset boundaries beneath it.
>
> **Multi-asset**
> - One compute boundary that emits several assets.
> - It is appropriate when the runtime already has one shared retry boundary.
> - It is a poor fit when it collapses unrelated outputs merely to shorten code.
>
> **Source asset**
> - A dataset Dagster tracks without claiming responsibility for producing it.
> - It keeps lineage honest across warehouse, vendor, and cross-team boundaries.
> - Visibility into a dependency is not the same thing as rerun authority over it.

## A Useful Graph Names States Someone Would Actually Ask About

Lineage earns its cost only when the nodes correspond to states an operator, reviewer, or downstream consumer can actually name. If the graph is filled with implementation-only steps, it becomes noisy at exactly the moment it should be helping someone decide what to repair.

### A Dependency Edge Should Answer A Rebuild Question

The right dependency is one that helps a team answer, "if this state changes, which downstream states are now suspect?" That is a stricter test than simple code reuse, and it keeps the public graph aligned with actual operational reasoning.

#### Declare the durable states before you talk about reruns

Use this pattern when a workflow is moving from script order to lineage-aware operation. The trigger is usually an upstream correction or a request to explain downstream blast radius clearly. The code runs at composition time and defines topology rather than business execution. Its purpose is to publish the durable states Dagster should track before any schedule, sensor, or check tries to act on them.

*Define a three-asset chain and print the asset keys Dagster resolves from the code location.*

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

In a real financial pipeline, the same principle is what keeps the graph readable under pressure. The `dagflow` security master does not stop at "raw data landed" or "dbt finished." It names the reviewed state and the delivered state separately, because those are different operational claims.

#### Turn one corrected state into a scoped execution slice

Use asset selection when the incident is local and the repair should stay local. The trigger is an upstream fix, a corrected review decision, or a replay that should begin from one known state rather than from the top of the platform. The code is executable topology: it defines which lineage slice a job is allowed to launch. Its purpose is to convert dependency knowledge into a bounded run surface.

*Select only the export slice in `dagflow` instead of rebuilding capture and transform assets again.*

```python
security_master_export_job = define_asset_job(
    name="security_master_export_job",
    executor_def=in_process_executor,
    selection=AssetSelection.assets(security_master_csv_export)
    | build_dbt_asset_selection([security_master_export_assets]),
)
```

That selection is the practical meaning of lineage. Once review has approved the dataset, `dagflow` can resume from the export boundary instead of replaying source capture, raw loads, and mart construction a second time.

## The Review Queue Is Part Of The Lineage, Not Commentary Around It

Human review often gets documented as a side process outside the orchestrator. In governed data systems that is too weak. Once approval changes whether a downstream consumer may trust a dataset, the review state has become part of the lineage surface and should be modeled that way.

### Human Approval Creates A Real Downstream State

The difference between "calculated" and "approved for publication" is not editorial decoration. It changes which data may flow into export, reporting, or further derivations.

#### Treat the review snapshot as a first-class asset

Use this framing when a pipeline includes human validation, exception handling, or sign-off before release. The trigger is a system where machine-calculated output still needs governed acceptance before delivery. The context is operational modeling rather than API novelty. Its purpose is to make the trust boundary visible in the graph instead of burying it in external process notes.

*Read the review-to-export segment of the `dagflow` security master as lineage, not as workflow commentary.*

```text
dim_security
  -> dim_security_snapshot
  -> security_master_review_snapshot
  -> security_master_preview
  -> security_master_csv_export
```

That pattern generalizes cleanly to index data work. In an index constituent or benchmark composition pipeline, the machine-generated basket and the reviewer-approved basket are different downstream states. Treating them as the same node would erase the very boundary an operator most needs to see.

## External Ownership Should Still Be Visible

A dataset does not stop being important because Dagster did not compute it. Vendor files, upstream warehouse tables, and cross-team reference datasets can still determine downstream freshness, correctness, and replay scope.

### A Source Asset Admits Dependency Without Claiming Rerun Authority

This distinction keeps the graph honest. Dagster can show that a downstream asset depends on an upstream state while remaining explicit that the upstream system is owned elsewhere.

#### Declare the upstream dataset without pretending Dagster can rebuild it

Use this pattern when downstream assets rely on a warehouse table, vendor extract, or externally scheduled feed. The trigger is a dependency that clearly affects downstream trust but is not produced by the current code location. The code is topology-only and does not run any external workload. Its purpose is to preserve truthful lineage while keeping ownership boundaries explicit.

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

For an index pipeline, this is the right model for something like an external corporate actions feed or a benchmark provider file. Dagster should show the dependency, but it should not imply that a rerun inside the current code location can recreate that upstream data.

## A Multi-Asset Should Mirror One Retry Boundary

Dagster supports multi-assets because some runtimes genuinely emit several durable outputs together. The danger is using that feature as a convenience wrapper for unrelated outputs, which destroys retry clarity and makes checks harder to interpret.

### Shared Compute Is The Only Good Reason To Collapse Outputs

If the runtime already has one shared execution boundary, a multi-asset can mirror that truth faithfully. If not, separate assets keep ownership, checks, and replay scope cleaner.

#### Materialize several assets only when the runtime emits them together

Use a multi-asset when one warehouse statement, Spark job, or external build naturally produces several durable outputs as one unit of work. The trigger is a shared compute boundary that already exists outside Dagster. The code runs as business execution and emits multiple materializations from one function. Its purpose is to mirror a real retry boundary instead of inventing separate orchestration events that do not exist in the underlying runtime.

*Materialize a `@multi_asset` and print the run status plus the emitted asset keys.*

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
print(
    [
        event.materialization.asset_key.to_user_string()
        for event in result.get_asset_materialization_events()
    ]
)
```

```text
True
['silver_orders', 'silver_customers']
```
