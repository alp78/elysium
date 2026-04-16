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

Dagster's resources and I/O APIs describe two different runtime boundaries. A resource is the dependency an asset or op uses to reach something outside its own body. An I/O manager is the storage contract Dagster uses when one step hands data to another. Keeping those ideas separate is what prevents a code location from dissolving into hidden client construction, ad hoc environment logic, and unclear persistence.

> [!abstract]- Summary
>
> This note frames Dagster runtime wiring as boundary design:
>
> - resources hold infrastructure knowledge so assets can stay about data state
> - typed config changes runtime behavior without forking the code path
> - I/O managers matter when Dagster itself owns the handoff between compute stages
> - the main failure mode at this layer is invisible side effects, not missing abstraction

> [!info] Official References
>
> - [Dagster resources API](https://docs.dagster.io/api/dagster/resources)
> - [Dagster I/O managers API](https://docs.dagster.io/api/dagster/io-managers)
> - [Dagster overview](https://docs.dagster.io/)

> [!note]- Glossary
>
> **Resource**
> - A dependency Dagster injects into assets, ops, sensors, or checks.
> - It is the right place for client setup, connection policy, and secret-backed configuration.
> - If an asset has to discover its own infrastructure at runtime, the boundary is already leaking.
>
> **Config**
> - Structured runtime input that changes how a definition runs without changing its source code.
> - It is appropriate for knobs such as limits, modes, and validated options for one run.
> - It becomes dangerous when it starts encoding whole branches of business logic.
>
> **I/O manager**
> - The object Dagster uses to store outputs and reload them as downstream inputs.
> - It answers the question, "where does this value live between compute stages?"
> - It is a storage boundary, not a place to hide domain semantics.
>
> **Secret boundary**
> - The line between application code and environment-owned credentials.
> - Rotating a secret should not require editing asset bodies.
> - Environment variables are only the transport; the design question is still where credential use is centralized.

## A Resource Is Where Infrastructure Knowledge Belongs

Dagster's `ConfigurableResource` exists so infrastructure access can be modeled explicitly instead of rediscovered inside every asset. That is not only cleaner code. It also makes load-time composition, testing, and operational review far easier because the code location shows which external capabilities it expects.

### Ask For A Capability Instead Of Constructing A Client Inside The Asset

An asset should express what it needs to do, not how to bootstrap the world around it. The more connection logic that lives inside asset bodies, the less clearly the codebase explains where secrets, endpoints, and retries are actually controlled.

#### Inject the runtime capability instead of hard-coding the target

Use a resource when several assets need the same client, session rule, or secret-backed endpoint. The trigger is repeated infrastructure access across the code location. The code runs as normal asset execution, but the dependency object is composed ahead of time. Its purpose is to keep asset logic focused on the produced dataset rather than on client construction.

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
    result = dg.materialize(
        [modeled_orders],
        resources={"warehouse": WarehouseResource(target_schema="analytics")},
    )

print(result.success)
print(stdout.getvalue().strip())
```

```text
True
analytics.orders_clean
```

#### Publish the shared runtime dependencies from one composition root

Use this pattern when the code location has crossed from a tutorial into a platform that must expose its real external dependencies in one place. The trigger is the need for tests, local runs, and deployed services to agree on the same resource inventory. The code runs at composition time, not during business execution. Its purpose is to make the runtime contract inspectable before any asset body runs.

*Expose the `dagflow` resource surface from one factory instead of scattering client construction across assets.*

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
            sec_13f_lookback_days=settings.sec_13f_lookback_days,
            sec_13f_filing_limit=settings.sec_13f_filing_limit,
            sec_security_focus_limit=settings.sec_security_focus_limit,
            openfigi_api_key=settings.openfigi_api_key,
            finnhub_api_key=settings.finnhub_api_key,
        ),
        "dbt": DbtCliResource(
            project_dir=dbt_project,
            dbt_executable=str(dbt_executable),
        ),
    }
```

In `dagflow`, that one factory makes the system boundary legible. Assets do not open ad hoc database connections or discover the dbt executable on their own. They receive a control-plane capability and a dbt capability from one published composition surface.

## Config Should Change The Run, Not Rewrite The System

Config is most valuable when it keeps one definition reusable across different run circumstances while still failing fast on malformed input. It is less valuable when it becomes a loose dictionary of implicit modes that only the original author understands.

### Typed Config Makes Runtime Choices Explicit

The goal is not to make every parameter configurable. The goal is to make the few runtime choices that genuinely vary visible, validated, and reviewable.

#### Validate the runtime choice before expensive work starts

Use Dagster config when one run needs a bounded, typed choice such as a limit, processing mode, or replay parameter. The trigger is a value that should vary between runs but should still fail early if it is invalid. The code runs at execution time and consumes validated config rather than raw dictionaries. Its purpose is to separate stable business logic from run-specific inputs.

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
    result = dg.materialize(
        [sample_orders],
        run_config={"ops": {"sample_orders": {"config": {"limit": 3}}}},
    )

print(result.success)
print(result.output_for_node("sample_orders"))
```

```text
True
[0, 1, 2]
```

That distinction matters in production data platforms. In an index or benchmark workflow, "business date to process" is a config-like runtime choice. The database URL, export root, and identity used to reach external systems are not. Those belong in resources or environment-backed settings.

## An I/O Manager Matters Only When Dagster Owns The Handoff

The Dagster docs define I/O managers as the objects that store outputs and load them as downstream inputs. That is an important mechanism, but it only deserves emphasis when Dagster itself is the thing carrying values across compute boundaries. In warehouse-first systems, the real handoff may already live in explicit tables, files, or external tools.

### Use One When Dagster Must Carry Values Between Steps

When upstream and downstream compute exchange Python values through Dagster, the I/O manager is the correct place to define that storage rule once.

#### Persist the handoff through a custom I/O manager

Use a custom I/O manager when several assets share the same storage and reload rule inside Dagster's own execution model. The trigger is repeated handoff logic between upstream and downstream compute. The code runs during execution and intercepts how Dagster stores and reloads values. Its purpose is to make the storage boundary explicit rather than leaving it to implicit defaults.

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
    result = dg.materialize(
        [staged_orders, order_count],
        resources={"memory_io": memory_io_manager},
    )

print(result.success)
print(store)
```

```text
True
{'staged_orders': ['o-1', 'o-2'], 'order_count': 2}
```

#### Notice when no custom I/O manager is the correct design

Use this judgment when a system's real persistence boundaries are already explicit in warehouses, landed files, dbt models, review tables, or export artifacts. The trigger is a temptation to add an abstraction simply because Dagster supports it. The context is architectural choice rather than API usage. Its purpose is to avoid hiding storage semantics behind a custom layer that adds indirection without clarifying ownership.

> [!example] `dagflow` is explicit about storage without a custom I/O manager
>
> The `dagflow` code location does not make a custom I/O manager the center of its design, and that is the right choice. Its meaningful handoffs are already named in domain terms:
>
> - landed source files on the filesystem
> - raw contract tables in Postgres
> - dbt-built warehouse models
> - review snapshot tables
> - validated export files
>
> A custom I/O manager would not explain those boundaries better. It would risk obscuring them.
