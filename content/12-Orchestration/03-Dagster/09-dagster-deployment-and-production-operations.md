---
title: "09 - Dagster Deployment And Production Operations"
tags:
  - orchestration
  - dagster
description: "Production deployment patterns for Dagster, including local versus production control planes, `dagster.yaml`, daemon and webserver responsibilities, and concurrency controls."
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
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Deployment And Production Operations

Dagster becomes a platform question at deployment time. The code can be clean and still fail operationally if the team has not decided who owns the control plane, where the instance state lives, how runs are launched, and how shared resources are protected under load.

> [!abstract]- Summary
>
> This note covers the operational surface around a Dagster deployment:
>
> - distinguish the development command surface from the production control plane
> - keep instance configuration explicit through `dagster.yaml`
> - understand the daemon, webserver, and run-launch boundary as separate responsibilities
> - use queue limits and pools to protect shared systems under backfills and normal traffic

> [!info] Official References
>
> - [Deployment overview](https://docs.dagster.io/deployment)
> - [About Dagster+](https://docs.dagster.io/deployment/dagster-plus)
> - [OSS instance configuration](https://docs.dagster.io/deployment/oss/oss-instance-configuration)
> - [Execution](https://docs.dagster.io/deployment/execution)
> - [Managing concurrency](https://docs.dagster.io/guides/operate/managing-concurrency)

> [!note]- Glossary
>
> **Dagster OSS**
> - A self-managed Dagster deployment.
> - The team controls infrastructure, storage, and launch policy.
> - The team also owns upgrades, recovery, and operational burden.
>
> **Dagster+**
> - Dagster's managed control-plane offering.
> - It reduces self-managed orchestration overhead.
> - It changes the ownership boundary, not the need for clean asset design.
>
> **Dagster daemon**
> - The background service that handles schedules, sensors, and other orchestration work.
> - If it is unhealthy, automation and coordination degrade immediately.
> - A working web UI does not prove the daemon is healthy.
>
> **Run launcher**
> - The component that starts work in the chosen execution environment.
> - It defines where code actually executes.
> - A poor launcher boundary creates scaling and isolation problems.
>
> **Concurrency pool**
> - A named throttle for work that competes for one scarce dependency.
> - It prevents one class of run from overwhelming a shared warehouse or API.
> - Pools that are too broad destroy throughput; pools that are too narrow do nothing useful.

## Separate The Development Surface From The Production Surface

`dagster dev` is useful, but it is not the production architecture. A real deployment needs explicit ownership of instance state, orchestration services, and execution boundaries.

### Know What Dagster You Are Actually Running

The first deployment fact is the version and command surface you are operating.

#### Check the Dagster CLI version

Use the CLI version when validating a local environment, reproducing a bug, or comparing one deployment to another. The trigger is any ambiguity about which Dagster release the platform is using. The purpose is to anchor debugging and documentation to a real binary rather than assumption.

*Print the installed Dagster CLI version from the local sandbox.*

```bash
& 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\dagster.exe' --version
```

```text
dagster, version 1.13.0
```

#### Inspect what `dagster dev` starts locally

Use `dagster dev --help` when the team needs to confirm what the local command actually boots. The trigger is confusion about whether the local setup includes only the UI or a fuller orchestration surface. The purpose is to distinguish a development deployment from the production services that should be operated separately.

*Print the opening lines of `dagster dev --help`.*

```bash
& 'C:\Users\aperi\AppData\Local\Temp\dagster-rewrite-20260416\Scripts\dagster.exe' dev --help
```

```text
Usage: dagster dev [OPTIONS]

  Start a local deployment of Dagster, including dagster-webserver running on
  localhost and the dagster-daemon running in the background
```

## Keep Instance State Explicit

A production deployment needs durable orchestration state and one shared instance configuration that every service agrees on.

### Treat `dagster.yaml` As Control-Plane State

`dagster.yaml` is not decorative configuration. It is part of the instance contract.

#### Declare persistent instance storage in `dagster.yaml`

Use `dagster.yaml` when the team is moving from local experimentation to a persistent Dagster OSS deployment. The trigger is any environment where run history, event logs, schedules, or sensors matter after the current machine disappears. The purpose is to make the instance state durable and shared across the webserver, daemon, and CLI.

*Define Postgres-backed run, event-log, and schedule storage in `dagster.yaml`.*

```yaml
storage:
  postgres:
    postgres_db:
      hostname: dagster-postgres.internal
      username: dagster
      password:
        env: DAGSTER_POSTGRES_PASSWORD
      db_name: dagster

run_queue:
  max_concurrent_runs: 8
```

```text
storage backend -> postgres
run queue cap -> 8 concurrent runs
```

## Protect Shared Systems Under Load

Queueing alone is not enough. Production Dagster has to express contention explicitly, especially when live workloads and backfills compete for the same warehouse, API, or cluster.

### Put Throttles On The Execution Boundary

Concurrency rules belong where execution is launched, not inside business logic.

#### Attach a concurrency pool to an op

Use a pool when several runs compete for one shared dependency that can be overwhelmed. The trigger is contention against a warehouse, rate-limited API, or constrained cluster. The purpose is to make the throttle visible in Dagster rather than burying it in retry loops or ad hoc sleep logic.

*Define an op with pool-based throttling and print the pool name Dagster records on the op definition.*

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

- `dagster dev` is a development command surface, not the final production architecture.
- A production Dagster OSS deployment needs persistent instance state and one shared `dagster.yaml`.
- The webserver, daemon, and run-launch boundary are separate operational responsibilities.
- Run queues limit overall traffic; pools protect a specific shared dependency.
- A good deployment is boring under stress: durable state, explicit throttles, and clear service ownership.
