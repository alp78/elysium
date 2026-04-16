---
title: "03 - Dagster Resources, Config, And IO Managers"
tags:
  - orchestration
  - dagster
description: "Runtime building blocks for production Dagster projects, including resources, typed config, secret boundaries, and I/O managers that define how data moves between compute and storage."
created: 2026-04-15
updated: 2026-04-16
status: complete
parent: "[[domain-dagster]]"
links:
  - "[[01-dagster-core-concepts]]"
  - "[[02-dagster-assets-and-lineage]]"
  - "[[04-dagster-ops-jobs-and-graphs]]"
  - "[[05-dagster-automation-and-partitions]]"
  - "[[06-dagster-pipes-dbt-and-external-systems]]"
  - "[[07-dagster-development-ui-and-debugging]]"
  - "[[08-dagster-testing-asset-checks-and-data-contracts]]"
  - "[[09-dagster-deployment-and-production-operations]]"
  - "[[10-dagster-troubleshooting-anti-patterns-and-airflow-migration]]"
---

# Dagster Resources, Config, And IO Managers

Assets describe what the platform produces. Resources, config, and I/O managers describe how the code reaches external systems, how behavior changes between environments, and how outputs cross runtime boundaries safely.

> [!abstract]- Summary
>
> This note focuses on the runtime contract around Dagster code:
>
> - resources inject clients, secrets, and shared infrastructure behavior
> - typed config keeps runtime choices explicit and validated
> - I/O managers define where outputs land and how downstream steps reload them
> - the main design risk is hidden side effects, not missing abstraction

> [!info] Official References
>
> - [Dagster resources API](https://docs.dagster.io/api/dagster/resources)
> - [Dagster I/O managers API](https://docs.dagster.io/api/dagster/io-managers)
> - [Dagster configuration guide](https://docs.dagster.io/guides/operate/configuration)
> - [Environment variables and secrets](https://docs.dagster.io/guides/operate/configuration/using-environment-variables-and-secrets)

> [!note]- Glossary
>
> **Resource**
> - A Dagster-provided dependency used by assets, ops, or checks.
> - It centralizes infrastructure setup and credential use.
> - If resources hide too much global behavior, incidents become harder to trace.
>
> **Config**
> - Runtime input that changes behavior without changing code.
> - It lets one asset body run across local, staging, and production.
> - Config should not become a second programming language.
>
> **I/O manager**
> - The boundary that stores outputs and reloads them for downstream steps.
> - It defines whether handoff is in memory, on disk, or in a warehouse.
> - Bad I/O choices create hidden cost and latency spikes.
>
> **Secret boundary**
> - The line between code and environment-owned credentials.
> - Rotating credentials should not require editing asset code.
> - Environment variables alone are not a full secrets strategy.

## Inject Dependencies Deliberately

The runtime contract should be boring: assets ask for dependencies, resources provide them, and nothing discovers its own infrastructure ad hoc inside the asset body.

### Keep Clients And Secrets Out Of Asset Logic

The first production upgrade in a Dagster project is almost always moving connection logic out of the asset body and into a resource.

#### Inject a warehouse resource instead of hard-coding the target

Use a resource when several assets need the same client, session policy, or secret-backed endpoint. The trigger is repeated infrastructure access across the codebase. The purpose is to keep asset logic focused on the produced data product instead of client construction.

*Materialize an asset that receives a typed warehouse resource and prints the target table name.*

```python
import contextlib
import io

import dagster as dg

class WarehouseResource(dg.ConfigurableResource):
    target_schema: str

    def target_table(self, name: str) -> str:
        return f"{self.target_schema}.{name}"

@dg.asset
def modeled_orders(warehouse: WarehouseResource):
    print(warehouse.target_table("orders_clean"))
    return 1

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([modeled_orders], resources={"warehouse": WarehouseResource(target_schema="analytics")})

print(result.success)
print(stdout.getvalue().strip())
```

```text
True
analytics.orders_clean
```

#### Validate typed config before the asset runs

Use Dagster config when the behavior should vary by environment, partition, or replay mode without changing the code body. The trigger is a runtime choice that should fail fast if it is malformed. The purpose is to move environment-specific behavior into a validated interface instead of loose dictionaries.

*Define a typed config object, execute the asset with `limit=3`, and print the returned rows.*

```python
import contextlib
import io

import dagster as dg

class OrdersConfig(dg.Config):
    limit: int

@dg.asset
def sample_orders(config: OrdersConfig):
    return list(range(config.limit))

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([sample_orders], run_config={"ops": {"sample_orders": {"config": {"limit": 3}}}})

print(result.success)
print(result.output_for_node("sample_orders"))
```

```text
True
[0, 1, 2]
```

## Make Data Handoff Explicit

Most Dagster performance problems are really hidden handoff problems. If the team cannot say where outputs live between steps, it cannot reason about retries, cost, or blast radius clearly.

### Use I/O Managers To Define The Real Storage Boundary

The I/O manager should describe where the output goes, not hide business logic the asset graph needs to see.

#### Persist asset outputs through a custom I/O manager

Use a custom I/O manager when several assets need the same storage rule or reload rule. The trigger is a repeated handoff pattern between upstream and downstream compute. The purpose is to define the storage boundary once and keep the asset bodies free of persistence plumbing.

*Materialize two assets through a custom in-memory I/O manager and print the stored values.*

```python
import contextlib
import io

import dagster as dg

store = {}

@dg.io_manager
def memory_io_manager():
    class MemoryIOManager(dg.IOManager):
        def handle_output(self, context, obj):
            store[context.asset_key.to_user_string()] = obj

        def load_input(self, context):
            return store[context.upstream_output.asset_key.to_user_string()]

    return MemoryIOManager()

@dg.asset(io_manager_key="memory_io")
def staged_orders():
    return ["o-1", "o-2"]

@dg.asset(io_manager_key="memory_io")
def order_count(staged_orders):
    return len(staged_orders)

stdout = io.StringIO()
stderr = io.StringIO()
with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
    result = dg.materialize([staged_orders, order_count], resources={"memory_io": memory_io_manager})

print(result.success)
print(store)
```

```text
True
{'staged_orders': ['o-1', 'o-2'], 'order_count': 2}
```

## What To Remember

- Resources are the correct place for clients, credentials, and shared infrastructure behavior.
- Typed config should validate runtime choices before an asset reaches expensive systems.
- I/O managers define the storage boundary between upstream and downstream compute.
- If a secret rotation or endpoint change requires editing asset bodies, the runtime contract is already wrong.
- Hidden side effects are the main design failure at this layer, so keep storage and dependency rules explicit.
