---
title: "09 - Dagster Deployment And Production Operations"
tags:
  - orchestration
  - dagster
description: "Production deployment patterns for Dagster, including local versus production control planes, `dagster.yaml`, daemon and webserver responsibilities, and concurrency controls."
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
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Deployment And Production Operations

Dagster becomes a platform design problem the moment the code location has to survive beyond one engineer's laptop. The graph can be perfectly modeled and still fail operationally if the deployment does not answer four concrete questions: where user code is loaded, which service evaluates automation, where run history and logs persist, and how shared systems are protected when several runs want the same resource at once.

> [!abstract]- Summary
>
> This note explains the operational shape a serious Dagster deployment needs:
>
> - the development command surface is useful, but it is not the same thing as a production topology
> - the webserver, daemon, and user-code server do different jobs and should be reasoned about separately
> - every service in one deployment must agree on one Dagster instance and one `dagster.yaml`
> - deployment-wide concurrency and per-resource pools solve different overload problems

> [!abstract]- Key Terms
>
> **Dagster instance**
> - Dagster's instance configuration defines where run history, event logs, compute logs, and launch policy live for one deployment.
> - It is deployment state, not project decoration.
> - If different services read different instance settings, they are not operating the same Dagster deployment.
>
> **User-code server**
> - The code server hosts the Python definitions that Dagster loads and inspects.
> - It is where assets, jobs, sensors, and resources are discovered from user code.
> - A healthy web UI does not prove the user-code server is loading the intended module.
>
> **Dagster webserver**
> - The webserver serves the UI and APIs over the shared instance state.
> - It lets operators inspect runs, assets, checks, and logs.
> - It is not the service that evaluates schedules and sensors.
>
> **Dagster daemon**
> - The daemon handles orchestration work such as schedules, sensors, and other background coordination.
> - If it is down, automation and queued work degrade even when the UI still loads.
> - The daemon must share the same instance and code locations as the rest of the deployment.
>
> **Concurrency pool**
> - A pool protects one shared external dependency across runs.
> - It is different from limiting total run count across the deployment.
> - Pools are useful when the warehouse, API, or cluster is the scarce resource, not CPU on one local process.

## Dagster | production topology

Dagster's local development surface is intentionally convenient. The production lesson is not to reject that convenience. It is to understand which responsibilities get collapsed together locally and which ones must be separated when the deployment becomes durable, multi-service, or team-operated.

### Dagster | control plane services | user-code server, webserver, and daemon

Production Dagster is not one long-running Python process with a browser attached. It is a set of cooperating services that share the same instance state and load the same code locations consistently.

#### gRPC user-code server | run user code behind a dedicated code server

Use this pattern when the deployment needs a stable boundary between orchestration services and the Python module that exposes `Definitions`. The trigger is any environment where the webserver and daemon should not directly act as the only hosts of user code. The code runs in infrastructure configuration rather than in business execution. Its purpose is to make code loading explicit and inspectable through a dedicated gRPC server.

*Expose the `dagflow` code location through a dedicated gRPC user-code server and point the workspace at it.*

```yaml
services:
  dagster-user-code:
    command: >
      dagster api grpc
      -h 0.0.0.0
      -p 4000
      -m dagflow_dagster.definitions

load_from:
  - grpc_server:
      host: dagster-user-code
      port: 4000
      location_name: dagflow_user_code
```

This split is operationally important because it gives the deployment a clean statement of what code location is being served. If the code server cannot load `dagflow_dagster.definitions`, the problem is in the code location boundary. If it can load but runs still fail, the investigation moves to execution evidence instead of discovery.

#### Services | keep the UI and background orchestration separate

Use this pattern when engineers need to distinguish browsing Dagster from running Dagster. The trigger is any deployment where schedules, sensors, or backfills must continue independently of one browser session or one interactive developer process. The configuration runs at service startup and is part of the deployment contract. Its purpose is to make it explicit which service serves the UI and which service evaluates automation.

*Start the webserver and daemon as separate services that share the same workspace and instance state.*

```yaml
services:
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

The webserver answers inspection questions. The daemon answers automation questions. That distinction matters in on-call practice. A working UI does not prove schedules are evaluating. A running daemon does not prove the UI or API layer is healthy.

## Dagster | shared instance state

The Dagster instance documentation is explicit on two points: the instance defines where run history, logs, and launch settings live, and all services in one deployment should share one instance config file named `dagster.yaml`. That is the difference between one coherent control plane and a cluster of processes that merely happen to have the same repo mounted.

### Dagster | `DAGSTER_HOME` and `dagster.yaml` | one deployment contract

If the code server, webserver, daemon, and CLI see different `DAGSTER_HOME` directories or different `dagster.yaml` contents, they are operating against different assumptions about history, logs, and launch policy.

#### Instance state | share one `DAGSTER_HOME` and one instance file

Use this pattern when moving from ephemeral local experimentation to a deployment where run history and automation state must survive one process restart. The trigger is any environment where more than one Dagster service is running. The configuration affects the instance boundary, not the business graph. Its purpose is to guarantee that every service is reading and writing the same deployment state.

*Mount a shared `DAGSTER_HOME` volume and load one `dagster.yaml` from it.*

```yaml
services:
  dagster-user-code:
    environment:
      DAGSTER_HOME: /opt/dagster/dagster_home
    volumes:
      - dagster-home:/opt/dagster/dagster_home

  dagster-webserver:
    environment:
      DAGSTER_HOME: /opt/dagster/dagster_home
    volumes:
      - dagster-home:/opt/dagster/dagster_home

  dagster-daemon:
    environment:
      DAGSTER_HOME: /opt/dagster/dagster_home
    volumes:
      - dagster-home:/opt/dagster/dagster_home
```

#### `dagster.yaml` | describe real operational responsibilities

Use `dagster.yaml` when the deployment needs to state where artifacts live, where raw compute logs land, and which service is responsible for orchestration work such as schedules. The trigger is a deployment that has stopped being disposable. The configuration is shared control-plane state. Its purpose is to make storage and orchestration responsibilities explicit instead of leaving them to implicit defaults.

*Declare local artifact storage, compute-log storage, and the scheduler explicitly in `dagster.yaml`.*

```yaml
telemetry:
  enabled: false

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

This `dagflow` configuration is still closer to local durable development than to a fully externalized production control plane because it keeps artifact and compute-log storage on a shared local volume. The important lesson is that the deployment has at least made those boundaries explicit. From there, moving to Postgres-backed run history or remote compute-log storage is an infrastructure decision, not a mysterious side effect.

#### Storage | replace ephemeral defaults before calling the deployment durable

Use this pattern when the Dagster instance must survive node restarts, support several operators, or preserve history for incident review. The trigger is any environment where local filesystem defaults are no longer acceptable for operational recovery. The configuration is deployment state and may require extra instance libraries such as `dagster-postgres`. Its purpose is to externalize run and event-log history into durable shared infrastructure.

*Configure the Dagster instance to persist storage in Postgres using environment-backed credentials.*

```yaml
storage:
  postgres:
    postgres_db:
      username:
        env: DAGSTER_PG_USERNAME
      password:
        env: DAGSTER_PG_PASSWORD
      hostname:
        env: DAGSTER_PG_HOST
      db_name:
        env: DAGSTER_PG_DB
      port: 5432
```

## Dagster | concurrency controls

The concurrency guide distinguishes between limiting total run pressure and protecting one specific shared system. Conflating those two concerns usually leads to a deployment that is either underutilized or still able to overload the one resource that actually matters.

### Dagster | run limits and pools | separate total traffic from shared-resource contention

Deployment-wide run limits answer how much total work the control plane should launch at once. Pools answer how many assets or ops should be allowed to hit one constrained dependency across runs. Those are related, but they solve different failure classes.

#### Concurrency | set deployment-level run limits

Use deployment-level concurrency when backfills, sensors, and ordinary traffic could together launch more total work than the environment can safely sustain. The trigger is usually infrastructure saturation rather than one specific downstream system failing. The configuration runs at the instance layer. Its purpose is to cap overall pressure before too many runs are in flight at once.

*Configure deployment-level run limits and a default pool limit in the Dagster instance.*

```yaml
concurrency:
  runs:
    max_concurrent_runs: 10
  pools:
    default_limit: 3
```

This is the right kind of control when the platform needs to prevent a bulk replay from overwhelming the deployment as a whole. In a governed data platform such as `dagflow`, that matters when ordinary daily ingestion and review-resume exports coexist with historical repair traffic.

#### Pools | put pools on the assets or ops that share a scarce system

Use a pool when the scarce resource is specific: one warehouse, one rate-limited vendor API, one export cluster, or one expensive shared service. The trigger is contention that should remain visible on the executable boundary rather than inside retry loops or sleep logic. The code is part of the asset or op definition, but the effect is cross-run coordination. Its purpose is to make Dagster queue work at the same boundary where engineers reason about the contested resource.

*Attach a pool to one executable boundary that competes for a shared warehouse.*

```python
import dagster as dg

@dg.asset(pool="warehouse")
def publish_review_snapshot():
    ...
```

> [!example] Separate total traffic from shared-resource protection
>
> If a review-validation sensor resumes export for several approved runs while a historical backfill is also rebuilding curated assets, one control usually is not enough. A deployment-wide run limit keeps the control plane from launching too much total work. A `warehouse` or `export` pool then prevents the specific downstream system from being flooded even within that bounded set of runs.

## Dagster | references

This section collects the official Dagster documentation links most relevant to deployment and production operations.

- [Deployment overview](https://docs.dagster.io/deployment)
- [About Dagster+](https://docs.dagster.io/deployment/dagster-plus)
- [OSS instance configuration](https://docs.dagster.io/deployment/oss/oss-instance-configuration)
- [Execution](https://docs.dagster.io/deployment/execution)
- [Managing concurrency](https://docs.dagster.io/guides/operate/managing-concurrency)
