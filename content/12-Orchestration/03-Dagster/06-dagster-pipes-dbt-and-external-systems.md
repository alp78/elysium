---
title: "06 - Dagster Pipes, dbt, And External Systems"
tags:
  - orchestration
  - dagster
description: "Production integration patterns for Dagster, including Dagster Pipes, dagster-dbt resources, external compute boundaries, and the separation between control-plane logic and remote execution."
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
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Pipes, dbt, And External Systems

Dagster becomes most valuable in mixed-compute systems when it refuses to impersonate the runtime that should actually execute the work. The orchestrator should know what data state was produced, what metadata came back, and which downstream assets now depend on it. That does not mean every warehouse transform, Spark job, or review export needs to run inside the Dagster process itself.

> [!abstract]- Summary
>
> This note covers the main integration boundaries around a Dagster project:
>
> - Dagster Pipes exists for workloads that should stay in another process or execution environment
> - dbt should appear in Dagster as a graph of models, sources, and checks, not as one opaque shell command
> - resources and translators define how another system becomes visible to Dagster
> - a clean orchestration boundary preserves both observability and ownership of compute semantics

> [!info] Official References
>
> - [Using Dagster Pipes](https://docs.dagster.io/integrations/external-pipelines/using-dagster-pipes)
> - [Dagster Pipes library](https://docs.dagster.io/integrations/libraries/pipes)
> - [Dagster and dbt](https://docs.dagster.io/integrations/libraries/dbt)
> - [Dagster dbt examples](https://docs.dagster.io/examples/full-pipelines/dbt)

> [!note]- Glossary
>
> **Dagster Pipes**
> - The Dagster Pipes guide defines it as a way to run a subprocess with a given command and environment while sending structured metadata and logs back to Dagster.
> - It preserves orchestration visibility without forcing the compute into the control plane process.
> - Pipes is most useful when the runtime boundary is already real and should remain real.
>
> **External runtime**
> - An external runtime is any process, container, cluster, or managed system outside the Dagster process.
> - It may own dependency isolation, hardware profile, or language/runtime constraints that Dagster should not absorb.
> - Orchestration still needs visibility into what that runtime produced and whether it is safe to retry.
>
> **`DbtCliResource`**
> - `DbtCliResource` is the Dagster resource boundary around a dbt project and executable.
> - It lets Dagster orchestrate dbt as structured asset work instead of as a shell string with no lineage.
> - The resource is only trustworthy if the dbt project, manifest, and profile state are themselves valid.
>
> **Dagster dbt translator**
> - The translator decides how dbt nodes become Dagster asset keys, groups, metadata, tags, and checks.
> - This is where a project chooses whether dbt assets should mirror business domains, warehouse layers, or both.
> - A weak translator gives the platform opaque assets with poor operational meaning.

## The Orchestrator Should Observe Remote Compute, Not Absorb It

The Pipes documentation is explicit about the central idea: Dagster can launch external work and still receive structured metadata and logs back into the Dagster UI. That is the right pattern when the work belongs to another execution boundary for real engineering reasons rather than as an accident of history.

### Pipes Exists For A Real Runtime Boundary

If the code should live in another process, container, cluster, or managed platform, the goal is not to collapse that boundary. The goal is to make the boundary observable and controllable from Dagster.

#### Launch a subprocess through Dagster Pipes without hiding the boundary

Use Pipes when the compute environment is intentionally separate from the Dagster process. The trigger is work that needs its own dependency set, system image, or runtime isolation. The asset runs in Dagster, but the real compute happens in another process launched through a Pipes client. Its purpose is to let the external code remain external while still reporting structured metadata and logs back to Dagster.

*Define an asset that delegates work to a child process through `PipesSubprocessClient`.*

```python
from pathlib import Path
import sys

import dagster as dg
from dagster._core.pipes.subprocess import PipesSubprocessClient

CHILD = Path("pipes_child.py")

@dg.asset
def remote_table(
    context: dg.AssetExecutionContext,
    pipes_client: PipesSubprocessClient,
):
    yield from pipes_client.run(
        context=context,
        command=[sys.executable, str(CHILD)],
    ).get_results()
```

This is the right model for a future index-composition or benchmark-build workload that might run in Spark, Databricks, or another specialized runtime while Dagster still needs the resulting asset state, metadata, and lineage. The local `dagflow` repository does not currently use Pipes, which is itself instructive: Pipes should appear only when the compute boundary is genuinely external, not as a default integration reflex.

## dbt Should Appear As Structured Asset Topology

Dagster's dbt integration is valuable because it understands dbt work at the level of individual models, sources, seeds, snapshots, and checks. That is the opposite of orchestrating `dbt build` as one opaque process with no internal lineage or selective recovery surface.

### Treat The dbt Project As Part Of The Asset Graph

Once dbt is in the platform, the professional question is not merely whether the command runs. It is whether Dagster can reason about the resulting nodes as first-class state in the graph.

#### Construct `DbtCliResource` in the resource layer, not inside asset bodies

Use `DbtCliResource` when the project needs Dagster to orchestrate a real dbt project with an explicit executable, manifest state, and profile location. The trigger is a warehouse transformation surface that should become part of the platform's controlled runtime. The resource is built in shared dependency configuration, not ad hoc inside one asset body. Its purpose is to publish the dbt boundary once and reuse it consistently across dbt-backed assets.

*Build the shared `dbt` resource in `dagflow` alongside the control-plane resource.*

```python
def build_resources() -> dict[str, ConfigurableResource | DbtCliResource]:
    settings = get_settings()
    dbt_executable = Path(sys.executable).with_name("dbt")
    dbt_project = get_dbt_project()
    return {
        "control_plane": ControlPlaneResource(
            direct_database_url=settings.direct_database_url,
            export_root_dir=settings.export_root_dir,
            landing_root_dir=str(settings.resolved_landing_root_dir),
            edgar_identity=settings.edgar_identity,
        ),
        "dbt": DbtCliResource(
            project_dir=dbt_project,
            dbt_executable=str(dbt_executable),
        ),
    }
```

The important point is not that `DbtCliResource` exists. It is that the dbt project becomes part of the same explicit runtime contract as the rest of the Dagster resources. If the executable path, profiles directory, or project manifest changes, that change happens in one resource boundary instead of being rediscovered by each asset separately.

#### Turn dbt models, sources, and tests into Dagster-visible assets and checks

Use a translator when the team needs dbt nodes to land in Dagster with meaningful asset keys, groups, tags, and checks. The trigger is a project where raw dbt defaults do not communicate enough operational meaning about domain, layer, or ownership. The translator runs at definition time and shapes how Dagster sees the dbt project. Its purpose is to make dbt topology legible to Dagster operators rather than leaving it as a flat imported graph.

*Translate dbt nodes into domain-prefixed asset keys and enable dbt tests as Dagster checks.*

```python
class DagflowDbtTranslator(DagsterDbtTranslator):
    def __init__(self) -> None:
        super().__init__(
            settings=DagsterDbtTranslatorSettings(
                enable_asset_checks=True,
                enable_source_tests_as_checks=True,
            )
        )

    def get_asset_key(self, dbt_resource_props: Mapping[str, Any]) -> dg.AssetKey:
        if dbt_resource_props.get("resource_type") == "source":
            return super().get_asset_key(dbt_resource_props)
        return dbt_asset_key(
            pipeline_for_resource(dbt_resource_props), str(dbt_resource_props["name"])
        )
```

This is where `dagflow` makes dbt assets operationally meaningful. `dim_security` does not appear as a detached dbt node. It appears inside a pipeline-prefixed asset namespace such as `security_master__dim_security`, alongside checks and metadata that tell the control plane where in the warehouse layer the node belongs.

### Connect dbt To Upstream Dagster State Deliberately

Dagster's dbt documentation emphasizes that dbt sources can be connected to upstream Dagster assets through `meta.dagster.asset_key`. That is the mechanism that turns warehouse sources and review tables into explicit dependencies in the Dagster graph instead of leaving the dependency relationship hidden inside SQL only.

#### Map dbt sources to upstream Dagster asset keys

Use source mapping when dbt models depend on data states that Dagster already models elsewhere, such as raw landing assets or governed review tables. The trigger is a need for lineage that crosses tool boundaries honestly. The mapping lives in dbt project metadata, not in a side spreadsheet or mental model. Its purpose is to let Dagster understand that a dbt source is the same operational state as an upstream Dagster asset.

*Map raw tables and review tables to the Dagster assets that own those states.*

```yaml
version: 2

sources:
  - name: raw
    schema: raw
    tables:
      - name: sec_company_tickers
        meta:
          dagster:
            asset_key: ["security_master__sec_company_tickers_raw"]

  - name: review
    schema: review
    tables:
      - name: security_master_daily
        meta:
          dagster:
            asset_key: ["security_master__review_snapshot"]
```

That mapping is what lets `dagflow` express an export model as depending on the reviewed state, not only on the most recent warehouse transform. It is also what keeps the asset graph honest across the full governed lifecycle: raw landing, curated transforms, review snapshot, export preview, and final CSV delivery.

## Keep Compute Semantics And Orchestration State In The Right Place

The control plane should decide what to run, record what happened, and expose lineage and checks. The external system should remain the owner of its own compute semantics. Blurring those responsibilities is the integration mistake that turns mixed-compute platforms into opaque debugging exercises.

### A Governed Pipeline Needs Visible Handoffs

The best external-system integrations do not hide the handoff between systems. They make it explicit enough that blast radius, reruns, and state transitions stay explainable.

#### Build export work from reviewed state instead of from raw transform success

Use this pattern when the pipeline includes a governed review boundary between transformation and delivery. The trigger is any workflow where a human-approved or policy-approved state is materially different from the latest machine-computed state. The export asset is still orchestrated by Dagster, but it should depend on the reviewed source of truth. Its purpose is to ensure that delivery reflects the approved dataset, not merely the most recent transform run.

*Select dbt export assets and CSV export assets from the reviewed state boundary in one asset job.*

```python
security_master_export_job = define_asset_job(
    name="security_master_export_job",
    executor_def=in_process_executor,
    selection=AssetSelection.assets(security_master_csv_export)
    | build_dbt_asset_selection([security_master_export_assets]),
)
```

> [!example] The approved review state is the real delivery contract
>
> In `dagflow`, the export models read from review tables that are mapped back to Dagster review-snapshot assets. That means the exported security master or shareholder holdings file is not "whatever dbt most recently computed." It is the reviewer-approved state that survived a governed handoff. That is exactly the kind of cross-system boundary Dagster should make visible rather than flatten into one shell step.
