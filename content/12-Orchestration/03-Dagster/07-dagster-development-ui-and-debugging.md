---
title: "07 - Dagster Development, UI, And Debugging"
tags:
  - orchestration
  - dagster
description: "Daily engineering workflow in Dagster, including `Definitions` smoke tests, local development with `dagster dev`, and the separation between code-loading failures and run failures."
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
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Development, UI, And Debugging

Dagster's webserver documentation describes the UI as the interface for viewing and interacting with Dagster objects, and it notes that `dg dev` launches both the webserver and the daemon for local use. That is the right starting point for development work: the UI is a read model of a deployment, not a substitute for reasoning about how user code was loaded, which process is responsible for automation, or where a failure actually occurred.

> [!abstract]- Summary
>
> This note treats day-to-day Dagster development as boundary inspection:
>
> - prove the code location loads before treating the browser as evidence
> - read workspace and service boundaries when the UI is incomplete or misleading
> - use the local UI after composition is healthy, not as the first debugging tool
> - once a run exists, follow event logs, compute logs, and daemon state instead of rewriting topology blindly

> [!abstract]- Key Terms
>
> **Code location**
> - A loadable unit of Dagster user code that the webserver and daemon inspect through a defined boundary.
> - If it does not load, the UI cannot truthfully show the project surface.
> - A code-location failure happens before execution evidence exists.
>
> **Workspace**
> - The configuration that tells an open-source Dagster deployment where code locations live.
> - It is how the webserver learns which gRPC servers or Python modules to inspect.
> - A healthy webserver with a wrong workspace can still produce a misleadingly empty UI.
>
> **`dg dev`**
> - The local development entry point that starts a small Dagster deployment for interactive work.
> - It is convenient because it launches both the webserver and the daemon together.
> - It does not erase the underlying service boundaries; it only hides their startup ceremony.
>
> **Event log**
> - The ordered stream of run events Dagster records during execution.
> - It is the main source of truth once work has actually launched.
> - It should be read as execution evidence, not as generic UI noise.
>
> **Compute logs**
> - The stdout and stderr captured for executed steps.
> - They are useful only after the run boundary has been crossed.
> - Missing compute logs usually point to instance or process wiring, not to asset semantics.

## Dagster | UI and loadability

The Dagster UI is a read model of what the deployment managed to load. That means the first debugging question is not what the Asset Catalog happens to show. It is what definitions the deployment actually discovered from the configured code locations and workspace.

### Dagster | code locations and workspace wiring | prove what the deployment loaded

If import resolution, resource composition, or repository construction is broken, the browser is only showing the consequences of an earlier load failure. This is why loadability checks and workspace wiring come before UI interpretation.

#### Tests | smoke-test the composition root before opening the UI

Use a loadability test in local development and CI whenever imports, dependencies, or composition code change. The trigger is any edit that could alter how the code location is reconstructed. The code runs as a plain Python test rather than as a Dagster run. Its purpose is to classify failures at the load boundary before the control plane gets involved.

*Import the real `dagflow` composition root and assert that the repository exposes asset checks.*

```python
from dagflow_dagster.definitions import defs


def test_definitions_load_assets() -> None:
    assert defs is not None
    asset_graph = defs.get_repository_def().asset_graph
    assert asset_graph.asset_check_keys
```

That test is small, but it answers an essential question cheaply: can the code location be imported and resolved at all? If the answer is no, there is no value in debugging the UI yet.

#### Workspace | follow the workspace indirection when a code location is missing

Use this check when the webserver is running but the expected code location, assets, or jobs are absent. The trigger is a partial or empty UI surface rather than a Python import traceback. The code is deployment configuration, not business logic. Its purpose is to show exactly where the webserver expects user code to live.

*Point the Dagster webserver at the `dagflow` gRPC user-code server through `workspace.yaml`.*

```yaml
load_from:
  - grpc_server:
      host: dagster-user-code
      port: 4000
      location_name: dagflow_user_code
```

If that mapping is wrong or the gRPC server is unavailable, the webserver can still start while exposing an incomplete or stale project surface. That is a workspace incident, not an asset incident.

## Dagster | local development topology

`dg dev` is convenient because it starts a local Dagster deployment quickly, but it does not erase the underlying service boundaries. Even in local development, Dagster still has distinct responsibilities for loading user code, serving the UI, evaluating automation, and storing shared instance state.

### Dagster | local services | read the process boundary behind `dg dev`

A missing code location, a sensor that never fires, and a run with no logs do not have the same owner. The faster a team maps the symptom to the responsible process, the faster the local debugging loop becomes.

#### Services | read the Dagster service split

Use this framing when local development starts to feel opaque and every failure is blamed on "Dagster." The trigger is confusion about whether the user-code process, webserver, or daemon is responsible for the observed behavior. The code is deployment wiring. Its purpose is to make the service boundaries explicit again.

*Read the three Dagster services in `dagflow` as three different operational responsibilities.*

```yaml
dagster-user-code:
  command: >
    dagster api grpc
    -h 0.0.0.0
    -p 4000
    -m dagflow_dagster.definitions

dagster-webserver:
  command: >
    /bin/sh -c
    "cp /workspace/apps/dagster/dagster.yaml /opt/dagster/dagster_home/dagster.yaml
    && dagster-webserver -h 0.0.0.0 -p 3000 -w /workspace/apps/dagster/workspace.yaml"

dagster-daemon:
  command: >
    /bin/sh -c
    "cp /workspace/apps/dagster/dagster.yaml /opt/dagster/dagster_home/dagster.yaml
    && dagster-daemon run -w /workspace/apps/dagster/workspace.yaml"
```

`dg dev` collapses the startup experience, but not the logic of these boundaries. User code still has to load, the daemon still has to evaluate automation, and the webserver still has to present a coherent view of the same instance.

#### Instance state | keep shared state and compute logs on one base

Use this check when the UI loads but logs are missing, runs behave inconsistently across processes, or automation appears to read a different world than the webserver. The trigger is a disagreement between services rather than a clear code error. The configuration is Dagster instance state, not project logic. Its purpose is to prove that the deployment shares one storage and log boundary.

*Configure local artifact storage and compute logs under one `DAGSTER_HOME`.*

```yaml
local_artifact_storage:
  module: dagster._core.storage.root
  class: LocalArtifactStorage
  config:
    base_dir: /opt/dagster/dagster_home

compute_logs:
  module: dagster._core.storage.local_compute_log_manager
  class: LocalComputeLogManager
  config:
    base_dir: /opt/dagster/dagster_home/compute_logs

scheduler:
  module: dagster._core.scheduler
  class: DagsterDaemonScheduler
```

This is the same class of issue the Dagster concurrency troubleshooting guide warns about: queued runs and missing progress in open-source deployments often come down to the daemon and webserver not sharing the same instance storage and `dagster.yaml`.

## Dagster | runtime debugging

Once Dagster has created a run, the load boundary has already succeeded. At that point the debugging method changes. Run events, compute logs, and daemon behavior become more informative than reopening topology code without evidence.

### Dagster | event logs, compute logs, and sensors | classify the evidence

A failed step, a silent sensor, and an untrusted dataset are three different incident classes. Treating them as one generic failure wastes time and often leads to edits in the wrong layer of the system.

#### Runs | treat a failed run as runtime evidence

Use run-level debugging once Dagster has already launched work. The trigger is a failed run, a suspicious event sequence, or a step that emitted logs before failing. The code runs as a normal materialization, but the debugging value comes from the resulting event stream. Its purpose is to show that runtime evidence exists only after the composition boundary has already held.

*Fail one asset intentionally and print the run success flag plus the failure event types Dagster emitted.*

```python
import contextlib
import io

import dagster as dg

@dg.asset
def broken_asset():
    raise RuntimeError("warehouse timeout during build")

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([broken_asset], raise_on_error=False)

print(result.success)
print(
    [
        event.event_type_value
        for event in result.all_events
        if "FAILURE" in event.event_type_value
    ]
)
```

```text
False
['STEP_FAILURE', 'PIPELINE_FAILURE']
```

#### Sensors | interpret a quiet sensor before rewriting the graph

Use this check when a reviewed dataset is ready but no follow-on run appears. The trigger is automation silence rather than an explicit run failure. The code is sensor logic that consults operational state and emits `RunRequest`s. Its purpose is to show whether the problem is in sensor evaluation, control-plane state, or downstream execution.

*Resume export in `dagflow` only when the control plane says a validated review run is waiting.*

```python
approved_runs = control_plane.export_ready_runs(pipeline_code)
if not approved_runs:
    yield SkipReason(f"No validated {pipeline_code} review runs are waiting for export")
    return

for approved_run in approved_runs:
    validated_at = approved_run["validated_at"].isoformat()
    run_id = str(approved_run["run_id"])
    business_date = approved_run["business_date"].isoformat()
    yield RunRequest(
        run_key=f"{pipeline_code}:{run_id}:validated-export:{validated_at}",
        tags={
            "pipeline_code": pipeline_code,
            "dagflow_run_id": run_id,
            "dagflow_business_date": business_date,
            "validated_at": validated_at,
        },
    )
```

If the review row is approved but no export run appears, the first questions are whether the daemon is evaluating sensors and whether the control plane is returning the expected pending run. Rewriting asset lineage at that point would be debugging the wrong layer.

## Dagster | references

This section collects the official Dagster documentation links most relevant to development, the UI, and debugging.

- [Dagster webserver and UI](https://docs.dagster.io/guides/operate/webserver)
- [Projects and workspaces](https://docs.dagster.io/guides/build/projects)
- [Transitioning from development to production](https://docs.dagster.io/guides/operate/dev-to-prod)
- [Dagster definitions API](https://docs.dagster.io/api/dagster/definitions)
