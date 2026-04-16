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

Serious Dagster platforms do not force every workload into the Dagster process. They keep heavy or specialized compute where it belongs and let Dagster own the orchestration, lineage, metadata, and blast-radius reasoning around that compute.

> [!abstract]- Summary
>
> This note covers the boundary between Dagster and the rest of the stack:
>
> - use Dagster Pipes when remote code should stay remote but still stream metadata back into Dagster
> - treat dbt as a lineage-aware transformation system instead of a black-box shell step
> - keep remote idempotency in the remote system and orchestration visibility in Dagster
> - avoid making the control plane impersonate the runtime that should execute the work

> [!info] Official References
>
> - [Using Dagster Pipes](https://docs.dagster.io/integrations/external-pipelines/using-dagster-pipes)
> - [Dagster Pipes library](https://docs.dagster.io/integrations/libraries/pipes)
> - [Dagster and dbt](https://docs.dagster.io/integrations/libraries/dbt)
> - [Dagster dbt examples](https://docs.dagster.io/examples/full-pipelines/dbt)

> [!note]- Glossary
>
> **Dagster Pipes**
> - Dagster's pattern for launching external code while receiving logs and metadata back into the orchestrator.
> - It preserves observability without forcing heavy compute into the control plane.
> - Pipes still assumes the remote job is safe to retry.
>
> **External runtime**
> - A process, container, cluster, or managed service outside the Dagster process.
> - Many data workloads belong there for isolation or dependency reasons.
> - Remote execution does not excuse weak logging or weak idempotency.
>
> **`DbtCliResource`**
> - Dagster's resource wrapper around a dbt project and executable.
> - It lets Dagster treat dbt work as a first-class orchestration boundary.
> - Dagster still depends on a valid dbt project, profile, and adapter.
>
> **Orchestration boundary**
> - The line between "Dagster decides and records" and "another system computes."
> - This is the main design boundary in mixed-compute platforms.
> - Blurring it makes retries and failures opaque.

## Keep Heavy Compute Outside The Control Plane

Dagster should usually launch, annotate, and observe heavy remote work rather than host it inline. The orchestrator should know what happened, not become the runtime for everything.

### Use Pipes When The Runtime Belongs Somewhere Else

Pipes is the right answer when the code already belongs in another process, container, cluster, or managed platform.

#### Launch a remote process through `PipesSubprocessClient`

Use Pipes when the compute boundary is real and should stay real. The trigger is a workload that needs its own environment, dependency stack, or runtime isolation. The purpose is to keep the execution remote while still letting Dagster record the resulting materialization and metadata.

*Launch a child Python process through Dagster Pipes and print the resulting asset key and metadata keys that Dagster recorded.*

```python
import contextlib
import io

import dagster as dg
from dagster._core.pipes.subprocess import PipesSubprocessClient

PY = r"C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\python.exe"
CHILD = r"C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\pipes_child_quiet.py"

@dg.asset
def remote_table(context: dg.AssetExecutionContext, pipes_client: PipesSubprocessClient):
    yield from pipes_client.run(context=context, command=[PY, CHILD]).get_results()

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([remote_table], resources={"pipes_client": PipesSubprocessClient()})

print(result.success)
print([event.materialization.asset_key.to_user_string() for event in result.get_asset_materialization_events()])
print(sorted(result.get_asset_materialization_events()[0].materialization.metadata.keys()))
```

```text
True
['remote_table']
['rows']
```

### Keep dbt As Structured Transformation State

If dbt is part of the platform, it should show up as structured transformation work and lineage, not as one opaque shell command that hides which models actually changed.

#### Construct a real `DbtCliResource`

Use `DbtCliResource` when the team needs Dagster to point at a real dbt project and a real dbt executable. The trigger is a warehouse transformation surface that Dagster should orchestrate explicitly. The purpose is to keep the project directory, profiles directory, and dbt executable visible and validated in one resource boundary.

*Instantiate `DbtCliResource` against a minimal local dbt project and print the resource type and project directory.*

```python
from pathlib import Path

from dagster_dbt import DbtCliResource

dbt = DbtCliResource(
    project_dir=Path(r"C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo"),
    profiles_dir=Path(r"C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo"),
    dbt_executable=Path(r"C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\dbt.exe"),
)

print(type(dbt).__name__)
print(dbt.project_dir)
```

```text
DbtCliResource
C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo
```

#### Verify the dbt project before Dagster builds against it

Use `dbt parse` or an equivalent validation step before Dagster starts orchestrating a dbt project. The trigger is any change to the dbt graph, profile, or project layout. The purpose is to fail on project invalidity before the Dagster run reaches downstream orchestration logic.

*Run `dbt parse` against the same local project and print the first lines of the command output.*

```bash
& 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\dbt.exe' parse `
  --project-dir 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo' `
  --profiles-dir 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo'
```

```text
22:33:33  Running with dbt=1.11.8
22:33:33  Registered adapter: sqlite=1.10.0
22:33:33  Performance info: C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\dbt-demo\target\perf_info.json
```

## What To Remember

- Pipes is the right model when remote code should stay remote but Dagster still needs structured metadata back.
- The remote system owns compute semantics and idempotency; Dagster owns orchestration state and blast-radius reasoning.
- `DbtCliResource` is the explicit boundary between Dagster and a dbt project.
- A dbt project should be validated as a dbt project before Dagster treats it as orchestrated work.
- The main integration failure is blurring control-plane and data-plane responsibilities into one opaque step.
