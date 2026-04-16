---
title: "07 - Dagster Development, UI, And Debugging"
tags:
  - orchestration
  - dagster
description: "Daily engineering workflow in Dagster, including `Definitions` smoke tests, local development with `dagster dev`, and the separation between code-loading failures and run failures."
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
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Development, UI, And Debugging

Dagster is unusually inspectable for a data orchestrator, but that only helps if the team debugs the right layer first. The fastest feedback loop comes from proving the code location loads, then proving a narrow run behaves the way the graph says it should.

> [!abstract]- Summary
>
> This note focuses on the day-to-day engineering loop:
>
> - smoke-test `Definitions` before the UI ever tries to load the code location
> - use `dagster dev` to boot a local deployment when the project already loads
> - separate code-loading problems from run failures and from bad data after a green run

> [!info] Official References
>
> - [Dagster webserver and UI](https://docs.dagster.io/guides/operate/webserver)
> - [Logging and debugging pipelines](https://docs.dagster.io/guides/log-debug)
> - [Projects and workspaces](https://docs.dagster.io/guides/build/projects)
> - [Converting an existing project](https://docs.dagster.io/guides/build/projects/moving-to-components/migrating-project)

> [!note]- Glossary
>
> **Code location**
> - A loadable unit of Dagster user code.
> - If it fails to load, the UI cannot even show the project correctly.
> - A code-location failure is not the same thing as a failed run.
>
> **`dagster dev`**
> - The local development command that starts the webserver and daemon together.
> - It is the fastest way to browse a project locally after loadability is proven.
> - It is a development surface, not the production deployment model.
>
> **Event log**
> - The ordered stream of run events emitted during execution.
> - It tells you where the run actually failed and which owner should respond.
> - It only helps if the team reads it as execution evidence, not just UI noise.
>
> **Asset selection**
> - A subset of the graph used for local reruns and focused debugging.
> - It keeps the feedback loop small.
> - A sloppy selection can still drag in too much downstream scope.

## Prove The Code Loads Before You Open The UI

The first development question is not "what does the UI show?" It is "can Dagster load the project at all?"

### Treat Loadability As Part Of Correctness

A broken `Definitions` object is a packaging or composition failure, not an execution failure.

#### Smoke-test the `Definitions` object directly

Use a `Definitions` smoke test in local development and CI before trying to diagnose UI behavior. The trigger is any change to project structure, imports, resources, or graph composition. The purpose is to fail on code discovery problems before the project reaches the control plane.

*Build a minimal `Definitions` object and print the asset count, asset key, and Dagster type.*

```python
import dagster as dg

@dg.asset
def hello():
    return "world"

defs = dg.Definitions(assets=[hello])
print(len(defs.resolve_all_asset_specs()))
print(defs.resolve_all_asset_specs()[0].key.to_user_string())
print(type(defs).__name__)
```

```text
1
hello
Definitions
```

## Use The Local Control Plane Deliberately

Once the code location loads, the local Dagster deployment is the right place to inspect graph state, run state, and logs together.

### Know What `dagster dev` Actually Starts

The command is a local deployment, not just a UI shortcut.

#### Inspect the local development command surface

Use `dagster dev --help` when setting up or troubleshooting the local environment. The trigger is a need to confirm how Dagster starts the local webserver, daemon, and code servers. The purpose is to make the development control plane explicit instead of treating it as a black box.

*Print the first lines of `dagster dev --help`.*

```bash
& 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\dagster.exe' dev --help
```

```text
Usage: dagster dev [OPTIONS]

  Start a local deployment of Dagster, including dagster-webserver running on
  localhost and the dagster-daemon running in the background
```

## Debug The Right Failure Class

The main operational mistake is collapsing all problems into "Dagster failed." Load failures, run failures, and bad data after a green run are different incidents with different owners.

### Separate Run Evidence From Code Discovery

If a run exists, the project already loaded. That alone changes where you should look.

#### Treat a failed run as runtime evidence, not a load problem

Use run-level debugging once Dagster has already launched work. The trigger is a failed run, stuck run, or suspicious event stream. The purpose is to inspect execution evidence first instead of changing project topology blindly.

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
print([event.event_type_value for event in result.all_events if "FAILURE" in event.event_type_value])
```

```text
False
['STEP_FAILURE', 'PIPELINE_FAILURE']
```

## What To Remember

- Smoke-test `Definitions` before opening the UI or diagnosing run behavior.
- `dagster dev` starts a local deployment surface that includes more than just the web UI.
- If a run exists, the code location already loaded and the problem has moved into runtime evidence.
- The event log is where Dagster tells you which boundary failed.
- A green run still does not prove trusted data unless checks and metadata support that conclusion.
