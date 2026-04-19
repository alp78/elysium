---
title: "01 - Server Configuration"
tags:
  - postgresql
  - administration
  - configuration
aliases:
  - PostgreSQL configuration
  - shared_buffers
  - checkpoint tuning
description: "Production PostgreSQL instance-configuration baselines for memory, temp-file spill, WAL checkpoints, and Linux host settings, grounded on the current stoxx-postgres instance."
parent: "[[domain-postgresql-server-operations]]"
links:
  - "[[02-psql-connection-and-usage]]"
  - "[[03-postgresql-authentication]]"
  - "[[04-roles-users-and-privileges]]"
  - "[[01-postgresql-storage-and-schema-surface]]"
  - "[[01-postgresql-query-surface-and-planner-basics]]"
status: draft
---

# Server Configuration

This note establishes a production-oriented PostgreSQL baseline for shared memory, per-query memory, temp-file spill behavior, WAL checkpoint cadence, and Linux host settings, using the current `stoxx-postgres` PostgreSQL 16.13 container as the concrete reference point. The goal is the same as in the SQL Server chapter: separate product defaults from operationally safe defaults. The PostgreSQL equivalents are different because PostgreSQL relies on `postgresql.conf`, `pg_hba.conf`, `pg_settings`, and Linux kernel behavior rather than `sp_configure`, TempDB, and SQLOS memory brokers.

> [!abstract]- Summary
>
> Establishes a production-oriented PostgreSQL baseline for memory, temp-file spill, WAL checkpoints, and Linux host settings, using live outputs from the current `stoxx-postgres` PostgreSQL 16.13 environment as the reference point. The note exists to distinguish Docker-image defaults from deliberate operating choices on a Linux-hosted PostgreSQL instance with 16 visible CPUs, about 30.9 GB of visible memory, and a `stoxx` database that currently occupies about 44 MB.
>
> **Instance Baseline**
> - Audit the configuration settings that most often separate a safe PostgreSQL build from a default cluster: `shared_buffers`, `effective_cache_size`, `work_mem`, `maintenance_work_mem`, `max_connections`, `checkpoint_timeout`, `max_wal_size`, `min_wal_size`, `wal_level`, `track_io_timing`, `random_page_cost`, `effective_io_concurrency`, `huge_pages`, and the temp-file controls
> - Interpret those settings against PostgreSQL's configuration context model so it is clear which changes are session-local, reloadable, or restart-only
>
> **Temporary Workloads and WAL**
> - Verify the settings that govern spill behavior and checkpoint cadence because PostgreSQL has no TempDB equivalent; its pressure surface is `work_mem`, `temp_buffers`, temp files, and WAL churn
> - Use `log_temp_files`, `temp_file_limit`, `checkpoint_timeout`, `max_wal_size`, and `min_wal_size` deliberately so sort spills and checkpoint storms are visible instead of being inferred from symptoms
>
> **Linux Host Settings**
> - Check Linux host controls that materially affect PostgreSQL reliability, especially `vm.overcommit_memory`, `vm.swappiness`, and the current Transparent Huge Pages mode
> - Keep explicit huge pages, overcommit policy, and restart boundaries deliberate so PostgreSQL memory settings remain predictable under load

> [!note]- Glossary
>
> **`pg_settings`**
> - The system view that exposes PostgreSQL run-time parameters, their current value, boot default, change context, source, and restart requirement.
> - It matters because PostgreSQL configuration review starts here in the same way SQL Server configuration review starts with `sys.configurations`.
>
> > [!info] `SHOW` plus metadata
> >
> > `pg_settings` is more than `SHOW ALL`. It adds the metadata needed for operational decisions, especially `context`, `source`, `boot_val`, and `pending_restart`.
>
> ---
>
> **Configuration context**
> - The scope at which a PostgreSQL setting can take effect.
> - It matters because `context = postmaster` means restart-required, `context = sighup` means reloadable through `pg_reload_conf()`, and `context = user` means a session can override it locally with `SET`.
>
> > [!info] Same file, different activation path
> >
> > Two settings can both live in `postgresql.conf` and still have completely different activation rules. PostgreSQL context matters more than file location.
>
> ---
>
> **`shared_buffers`**
> - PostgreSQL's main shared-memory buffer cache for table and index pages.
> - It matters because it is the closest PostgreSQL equivalent to the central shared cache decision in SQL Server, and because it is one of the most important startup-only memory settings.
>
> > [!info] Bigger is not automatically better
> >
> > PostgreSQL also depends on the operating-system page cache. Treating `shared_buffers` like "give PostgreSQL almost all RAM" is usually the wrong model.
>
> ---
>
> **`effective_cache_size`**
> - The planner's estimate of how much file-system cache plus shared buffer cache is effectively available to a single query.
> - It matters because it changes plan choice, especially the planner's willingness to prefer index access paths over sequential scans.
>
> > [!info] Estimator, not allocation
> >
> > `effective_cache_size` does not reserve memory and does not enlarge PostgreSQL's buffer pool. It only changes planner expectations.
>
> ---
>
> **`work_mem`**
> - The base amount of memory one sort, hash, or similar executor node may use before spilling to temporary files.
> - It matters because PostgreSQL can consume this memory per operation, not per session and not per query, so unsafe values multiply quickly under concurrency.
>
> > [!info] Per operation, not per connection
> >
> > A single query can use several `work_mem` allocations at the same time. Raising it casually is one of the easiest ways to create memory pressure.
>
> ---
>
> **`checkpoint_timeout` and `max_wal_size`**
> - The two settings that most strongly shape checkpoint cadence and how much WAL PostgreSQL will tolerate before forcing another checkpoint.
> - They matter because frequent checkpoints increase write amplification and latency spikes, while excessively large WAL retention increases restart and recovery cost.
>
> > [!info] Time and volume both matter
> >
> > PostgreSQL starts a checkpoint when the timeout is reached or when WAL volume is about to exceed the maximum, whichever comes first.
>
> ---
>
> **`wal_level`**
> - The level of detail written into WAL.
> - It matters because `minimal`, `replica`, and `logical` are not cosmetic labels; they determine which recovery, replication, and decoding features are even possible.
>
> > [!info] Lowering it removes capability
> >
> > Treat `wal_level` as a feature boundary. Dropping it to `minimal` is not a neutral optimization when replication or PITR are part of the design.
>
> ---
>
> **`temp_file_limit` and `log_temp_files`**
> - The two settings that determine whether PostgreSQL temp spills are bounded and whether they are observable.
> - They matter because PostgreSQL has no TempDB file layout to inspect directly; temp-file safety depends on spill limits and logging.
>
> > [!info] Unlimited spill is still a decision
> >
> > `temp_file_limit = -1` does not mean "no problem." It means a single backend can keep consuming disk for temp files until some external constraint stops it.
>
> ---
>
> **`track_io_timing`**
> - The switch that tells PostgreSQL to collect timing data for database I/O calls.
> - It matters because it feeds `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_database`, and extension telemetry such as `pg_stat_statements`.
>
> > [!info] Useful, but not free
> >
> > PostgreSQL leaves it off by default because timing every I/O call can add measurable overhead on some systems.
>
> ---
>
> **`huge_pages`**
> - The setting that controls whether PostgreSQL requests explicit huge pages for the main shared memory area.
> - It matters because explicit huge pages are different from Transparent Huge Pages, and because the setting only takes effect at postmaster start.
>
> > [!info] Different from THP
> >
> > `huge_pages = try|on|off` controls PostgreSQL's explicit request for large pages. It is not the same thing as the Linux kernel's Transparent Huge Pages mode.
>
> ---

## Instance Baseline

Start by checking the small set of instance-level settings that most often separate a safe PostgreSQL build from a default cluster created by a package or Docker image.

### High-Impact Instance Settings

This subsection focuses on the settings that most directly affect shared memory, planner expectations, spill behavior, WAL checkpoint cadence, and instrumentation visibility. Before interpreting any query output, read the reference below so that every setting name and every configuration context carries operational meaning rather than just looking like another row in `pg_settings`.

| Setting | What it controls | Default | Possible values | Production guidance |
|---|---|---|---|---|
| `shared_buffers` | Main PostgreSQL shared buffer cache. | `128MB` in this PostgreSQL 16 build | Integer blocks in `8kB` units or memory units such as `MB` and `GB`. Startup-only. | On a dedicated host with at least 1 GB of RAM, PostgreSQL documentation recommends a starting point around 25% of system memory. Treat larger than 40% as exceptional and evidence-driven. |
| `effective_cache_size` | Planner estimate of total cache available to a query. | `4GB` | Integer blocks or memory units. Session-overridable. | Set it to a realistic estimate of `shared_buffers` plus the PostgreSQL-relevant portion of the OS page cache after accounting for concurrency. |
| `work_mem` | Memory per sort or hash operation before spill. | `4MB` | `64kB` to very large values. Session-overridable. | Keep conservative at the instance level. Raise locally for controlled statements rather than globally for every session. |
| `maintenance_work_mem` | Memory for maintenance operations such as `VACUUM`, `CREATE INDEX`, and `ALTER TABLE`. | `64MB` | `1MB` upward. Session-overridable. | Raise deliberately on systems that perform sizable vacuum or index-maintenance work; it is far safer to enlarge than `work_mem` because it is not multiplied across every executor node. |
| `max_connections` | Maximum concurrent backend processes. | `100` | `1` to `262143`, startup-only. | Do not raise casually. If concurrency pressure exists, prefer external pooling before turning PostgreSQL into a process farm. |
| `checkpoint_timeout` | Maximum time between automatic checkpoints. | `300s` (`5min`) | `30s` to `86400s`, reloadable. | `5min` is conservative. Busy OLTP or mixed workloads often benefit from a longer interval such as `15min` when paired with a larger `max_wal_size`. |
| `max_wal_size` | WAL volume threshold that can trigger checkpoints. | `1GB` | `2MB` upward, reloadable. | Raise together with `checkpoint_timeout` when checkpoints are too frequent. The setting should spread writes, not hide uncontrolled WAL growth. |
| `min_wal_size` | Lower bound to which WAL can shrink after checkpoint recycling. | `80MB` | `2MB` upward, reloadable. | Raise above the tiny default on systems with steady write volume so PostgreSQL stops oscillating between too little and too much retained WAL. |
| `wal_level` | WAL detail required for crash recovery, replication, and logical decoding. | `replica` | `minimal`, `replica`, `logical`, startup-only. | Keep at `replica` or higher on any estate where PITR, standby replicas, or future replication are realistic requirements. |
| `track_io_timing` | Whether PostgreSQL records I/O timings. | `off` | `off` or `on`, superuser-settable. | Enable deliberately once overhead has been accepted, because modern troubleshooting is much weaker without I/O timing. |
| `random_page_cost` | Planner cost estimate for nonsequential page access. | `4` | Any positive real number. | Lower on SSD-backed or heavily cached systems so index access is not penalized like spinning-disk random I/O. |
| `effective_io_concurrency` | Expected number of efficient concurrent storage I/O requests. | `1` on this Linux container | `0` to `1000`. | Raise on SSD or cloud block storage that can service parallel I/O well; `1` is usually too conservative for modern storage. |
| `huge_pages` | Whether PostgreSQL requests explicit huge pages. | `try` | `off`, `on`, `try`, startup-only. | `try` is a safe default. Use `on` only when huge-page allocation is guaranteed and start failure is an acceptable guardrail. |
| `temp_buffers` | Maximum temporary-buffer space per session for temporary tables. | `8MB` | `100` blocks upward, session-overridable before first temp-table use. | Keep moderate. This is not the main sort/hash spill control; it applies to temp tables only. |
| `temp_file_limit` | Maximum disk usage for temp files per backend. | `-1` (unlimited) | `-1` or any non-negative size. | Set a finite ceiling on production systems so one backend cannot consume unbounded temp space. |
| `log_temp_files` | Threshold above which temp-file creation is logged. | `-1` (disabled) | `-1`, `0`, or size in kB. | Set to a positive threshold so large spills become visible in logs before disk usage becomes mysterious. |

The query in the next subsection reads the current live values of these settings from `pg_settings` and reports the source and context of each one.

#### Current configuration values for the settings that matter first

On any new or inherited PostgreSQL instance, immediately after the first successful login as a superuser or privileged operator. It is typically triggered by first configuration audit, post-migration review, post-image-bootstrap verification, or incident response when unexpected planner or checkpoint behavior suggests a misconfiguration. Runs against any database, read-only against `pg_settings`, and is safest as a superuser because that guarantees visibility of source metadata. Surface the settings that most often separate a deliberate PostgreSQL build from image defaults so the reviewer can decide which values require follow-up through `ALTER SYSTEM`, configuration management, reload, or restart.

> [!info]- `pg_settings` columns explained
>
> `pg_settings` is PostgreSQL's run-time configuration view. It is functionally richer than `SHOW ALL` because it includes metadata needed for safe operations.
>
> - `name` is the parameter name exactly as PostgreSQL knows it.
> - `setting` is the current effective value for the session.
> - `unit` is the implicit unit for numeric settings when the raw stored value is not self-describing.
> - `context` is the most important operational column in the view. `postmaster` means the postmaster must restart before the new value can take effect. `sighup` means the value can be reloaded from configuration files. `superuser` means a superuser can change it with `SET` or `ALTER SYSTEM`. `user` means any session can override it locally.
> - `source` shows where the current value came from, for example `default` or `configuration file`.
> - `sourcefile` identifies the file from which the current value was read when the source is configuration-based.
> - `pending_restart = true` means a different value has been accepted into configuration metadata but the postmaster has not yet restarted to adopt it.
>
> PostgreSQL documentation explicitly states that `pg_settings` also exposes the boot default, allowed range, and enum values for each parameter, which makes it the right first stop for baseline review and not just a generic `SHOW` surface.
>
> *This query shows the effective values, scope, and source of the PostgreSQL settings that usually need deliberate production decisions rather than image defaults.*
>

```sql
SELECT
    name,
    setting,
    unit,
    context,
    source,
    sourcefile,
    pending_restart
FROM pg_settings
WHERE name IN
(
    'checkpoint_timeout',
    'effective_cache_size',
    'effective_io_concurrency',
    'huge_pages',
    'log_temp_files',
    'maintenance_work_mem',
    'max_connections',
    'max_wal_size',
    'min_wal_size',
    'random_page_cost',
    'shared_buffers',
    'shared_preload_libraries',
    'temp_buffers',
    'temp_file_limit',
    'track_io_timing',
    'wal_level',
    'work_mem'
)
ORDER BY name;
```

| name | setting | unit | context | source | sourcefile | pending_restart |
|---|---|---|---|---|---|---|
| checkpoint_timeout | 300 | s | sighup | default |  | `f` |
| effective_cache_size | 524288 | 8kB | user | default |  | `f` |
| effective_io_concurrency | 1 |  | user | default |  | `f` |
| huge_pages | try |  | postmaster | default |  | `f` |
| log_temp_files | -1 | kB | superuser | default |  | `f` |
| maintenance_work_mem | 65536 | kB | user | default |  | `f` |
| max_connections | 100 |  | postmaster | configuration file | `/var/lib/postgresql/data/postgresql.conf` | `f` |
| max_wal_size | 1024 | MB | sighup | configuration file | `/var/lib/postgresql/data/postgresql.conf` | `f` |
| min_wal_size | 80 | MB | sighup | configuration file | `/var/lib/postgresql/data/postgresql.conf` | `f` |
| random_page_cost | 4 |  | user | default |  | `f` |
| shared_buffers | 16384 | 8kB | postmaster | configuration file | `/var/lib/postgresql/data/postgresql.conf` | `f` |
| shared_preload_libraries |  |  | postmaster | default |  | `f` |
| temp_buffers | 1024 | 8kB | user | default |  | `f` |
| temp_file_limit | -1 | kB | superuser | default |  | `f` |
| track_io_timing | off |  | superuser | default |  | `f` |
| wal_level | replica |  | postmaster | default |  | `f` |
| work_mem | 4096 | kB | user | default |  | `f` |

*This is mostly a Docker-image default configuration, not a production baseline. The most important drifts are `shared_buffers = 128 MB` on a host that exposes about 30.9 GB of memory to the container, `effective_cache_size = 4 GB` as a generic planner estimate, `work_mem = 4 MB` and `maintenance_work_mem = 64 MB` as conservative defaults, `effective_io_concurrency = 1` on modern storage, `track_io_timing = off`, and fully unbounded spill visibility with `log_temp_files = -1` and `temp_file_limit = -1`. `wal_level = replica` is already a sensible default, and the cluster has no pending restart work at the moment.* 

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `context` | `postmaster` | Restart boundary | Setting only changes at postmaster start | `ALTER SYSTEM` or file edits alone are not enough; restart planning is required |
| `context` | `sighup` | Reload boundary | Setting changes after configuration reload | `pg_reload_conf()` or a SIGHUP is the right activation path |
| `context` | `superuser` | Controlled session override | Superusers can change it in-session | Useful for diagnostics, but estate-wide defaults still belong in configuration |
| `context` | `user` | Session-local override allowed | Any session can change it locally | Global defaults should stay conservative because application code can raise them for one session |
| `source` | `default` | Watch | PostgreSQL is still using packaged defaults | Good for labs, weak for production hardening |
| `source` | `configuration file` | Context | Value is explicitly set in `postgresql.conf` or an included file | Baseline is deliberate rather than inherited |
| `pending_restart` | `t` | Watch | Metadata and running state diverge | A restart-only setting has been changed and is waiting to become active |
| `pending_restart` | `f` | `✓` | Running state matches accepted configuration | No latent restart work for the audited settings |

### CPU And Memory Context

Configuration values are not meaningful without the host context they run in. A `shared_buffers` value of `8GB` is sensible on one host and reckless on another. A `work_mem` value of `16MB` can be conservative on a lightly pooled application and dangerous on a server that allows hundreds of active backends to build several hash tables at once. This subsection shows the CPU count and memory visible to the PostgreSQL container so the rest of the note has operational scale attached to it.

| Field | Source command | Unit | Meaning |
|---|---|---|---|
| CPU count | `nproc` | integer | Number of CPUs visible to the PostgreSQL container. PostgreSQL itself does not expose an equivalent one-row catalog view for this, so the host shell is the right source of truth. |
| `total` memory | `free -m` | MiB | Total memory visible inside the container's Linux environment. In this Dockerized lab, that corresponds to the memory envelope seen by PostgreSQL. |
| `used` memory | `free -m` | MiB | Currently used memory on the Linux host environment, inclusive of non-PostgreSQL processes and cache. |
| `buff/cache` memory | `free -m` | MiB | Memory currently serving as buffer cache and reclaimable page cache. This is part of the reason `effective_cache_size` must consider both PostgreSQL buffers and the OS cache. |
| `available` memory | `free -m` | MiB | Kernel estimate of memory available for new allocations without heavy reclaim or swap pressure. |

#### CPU count and host memory visible to the PostgreSQL container

Any time a memory-related or concurrency-related decision is on the table, especially sizing `shared_buffers`, setting `effective_cache_size`, reviewing `work_mem`, or deciding whether the current default `max_connections` is tolerable. It is typically triggered by first baseline audit, capacity planning, post-host-resize verification, or incident response after OOM or spill-heavy behavior. Runs in the Linux shell of the PostgreSQL host or container runtime, not in SQL. Read-only. Provide the CPU and memory envelope visible to PostgreSQL so configuration values in this note have real operational scale.

> [!info]- Host commands explained
>
> PostgreSQL does not expose a direct SQL equivalent to SQL Server's `sys.dm_os_sys_info` for host CPU count and host-visible memory. The operational equivalent is to query the Linux environment that the postmaster actually runs in.
>
> - `nproc` returns the number of processing units available to the current process.
> - `free -m` reports memory in mebibytes, broken down into total, used, free, shared, buffer/cache, and available.
>
> In this lab, the commands were run inside the `stoxx-postgres` container. Because Linux containers share the host kernel, these values represent the runtime environment that PostgreSQL itself actually sees.
>
> *These commands show the CPU and memory envelope available to the PostgreSQL runtime so memory and spill settings can be evaluated against real scale.*
>

```bash
nproc
free -m
```

```text
16
               total        used        free      shared  buff/cache   available
Mem:           30914        6094        3012         194       22362       24819
Swap:           8192          15        8176
```

*The PostgreSQL runtime currently sees 16 CPUs and about 30.9 GB of memory, with about 24.8 GB reported as available. That context makes the default `shared_buffers = 128 MB` obviously conservative and makes the default `effective_cache_size = 4 GB` look like a generic estimate rather than a host-specific planner value. The current database size is only about 44 MB, so the lab is not memory-constrained today, but the configuration still reflects packaged defaults rather than an intentionally tuned production baseline.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| CPU count | `16` | Context | Host exposes 16 processing units to PostgreSQL | Plenty of concurrency headroom; connection count and I/O behavior matter more than CPU scarcity in this lab |
| `available` memory | `24819 MB` | Context | Roughly 24.2 GB is currently available | Raising `shared_buffers` materially above `128 MB` is feasible without immediate host pressure |
| `buff/cache` | `22362 MB` | Context | Linux is already using a large page-cache footprint | Planner cache estimates should not be based on PostgreSQL shared memory alone |
| Swap | Mostly unused | `✓` | Host is not currently paging heavily | Good current state, but default policy can still be wrong for production |

### Recommended Configuration Actions

The current baseline calls for a small number of concrete changes before this instance would qualify as production-hardened.

#### Set planner, spill, and I/O timing defaults deliberately

After the audit query above has confirmed that `effective_cache_size`, `work_mem`, `maintenance_work_mem`, `random_page_cost`, `effective_io_concurrency`, `track_io_timing`, `log_temp_files`, and `temp_file_limit` are still at packaged defaults. It is typically triggered by initial production hardening of a new PostgreSQL build, post-migration cleanup, or remediation after planner misestimation, hidden temp spills, or weak I/O diagnostics. Runs as a superuser or a role allowed to change these settings with `ALTER SYSTEM`. These settings are either reloadable or session-level, so `pg_reload_conf()` is sufficient after the file update. Apply the lowest-risk, highest-value baseline improvements first: a realistic planner cache estimate, safer spill observability, more realistic storage-cost assumptions, and I/O timing instrumentation.

> [!warning] `work_mem` multiplies faster than people expect
>
> Do not treat `work_mem` like a per-connection memory reservation. A single complex query can consume several `work_mem` allocations at once. Keep the instance default conservative and use session-local overrides for exceptional statements.

> [!success] Make spills visible before raising memory
>
> Enable `track_io_timing` and `log_temp_files`, set a finite `temp_file_limit`, and only then consider raising `work_mem`. That sequence makes bad spill behavior measurable instead of speculative.

> [!info]- `ALTER SYSTEM` and reload behavior
>
> `ALTER SYSTEM` writes configuration changes to `postgresql.auto.conf`, not directly to the main `postgresql.conf`. PostgreSQL then merges those values at startup or reload time.
>
> This batch deliberately changes only settings whose operational activation path does not require a postmaster restart:
>
> - `effective_cache_size = '24GB'` is a planner estimate aligned to a host that exposes about 30.9 GB of memory, while still leaving room for concurrency and non-PostgreSQL memory use.
> - `work_mem = '8MB'` is a cautious starting point above the `4MB` default, but still small enough to avoid explosive worst-case multiplication under concurrency.
> - `maintenance_work_mem = '512MB'` gives vacuum and index maintenance enough room to stop behaving like a lab image on a machine with tens of GB of RAM.
> - `random_page_cost = '1.1'` is a typical SSD-oriented starting point when storage is not spinning-disk random I/O.
> - `effective_io_concurrency = '32'` reflects modern SSD or cloud block storage much better than the default `1`.
> - `track_io_timing = 'on'`, `log_temp_files = '65536'`, and `temp_file_limit = '4GB'` together make temp spills observable and bounded.
>
> PostgreSQL documentation states that `track_io_timing` is off by default because it can add overhead, so enabling it is a deliberate observability tradeoff rather than a no-cost toggle.
>
> *This batch applies the most common first-round PostgreSQL corrections for planner realism, spill observability, and I/O diagnostics without requiring a restart.*
>

```sql
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '32';
ALTER SYSTEM SET track_io_timing = 'on';
ALTER SYSTEM SET log_temp_files = '65536';
ALTER SYSTEM SET temp_file_limit = '4GB';

SELECT pg_reload_conf();
```

> [!info] Live state of these settings on stoxx-postgres
>
> The audit query at the top of this section already captures the live values on `stoxx-postgres` — `effective_cache_size = 4GB`, `work_mem = 4MB`, `maintenance_work_mem = 64MB`, `effective_io_concurrency = 1`, `random_page_cost = 4`, `track_io_timing = off`, and both temp-file controls disabled or unlimited. The batch above is shown as the intended remediation pattern and has not been executed against the lab, so the note preserves a clean "before" baseline.

#### Set shared memory and preload settings deliberately

After the audit query has confirmed that startup-only settings such as `shared_buffers`, `huge_pages`, and `shared_preload_libraries` are still at image defaults or unset. It is typically triggered by initial production hardening, deliberate observability enablement, or a host resize that changes what a sensible shared-memory budget looks like. Runs as a superuser. These settings are `postmaster` context settings, so `ALTER SYSTEM` only writes the values; a full PostgreSQL restart is still required before they become effective. Replace tiny image defaults with deliberate shared-memory settings and preload only the extensions that are actually part of the operational model.

> [!warning] Restart-only settings need a real maintenance window
>
> `shared_buffers`, `huge_pages`, and `shared_preload_libraries` do not take effect on reload. Treat them like any other restart-scoped production change.

> [!success] Validate with `pg_settings` before and after restart
>
> Write the settings, reload to confirm syntax, restart the postmaster in a controlled window, and then re-run the baseline audit to prove the running values changed and `pending_restart` returned to `false`.

> [!info]- Why these startup-only settings matter
>
> PostgreSQL documentation recommends a starting point around 25% of system memory for `shared_buffers` on a dedicated database host with at least 1 GB of RAM. On this host that yields a starting point around 7.7 GB, so the example rounds to `8GB`.
>
> - `shared_buffers = '8GB'` moves the cluster away from the tiny packaged default of `128MB`.
> - `huge_pages = 'try'` keeps the safer default posture of requesting explicit huge pages when available without refusing to start if allocation fails.
> - `shared_preload_libraries = 'pg_stat_statements'` preloads the extension most estates want for statement-level observability. Because the setting is global and restart-only, only preload extensions that are actually operationally required.
>
> `pg_file_settings` on the current lab shows that only `max_connections`, `shared_buffers`, `max_wal_size`, and `min_wal_size` are presently set in `postgresql.conf`, which confirms how close the cluster still is to package defaults.
>
> *This batch turns startup-only shared-memory and preload settings into explicit operational choices instead of image inheritance.*
>

```sql
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET huge_pages = 'try';
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

SELECT pg_reload_conf();
```

> [!info] Live state of these settings on stoxx-postgres
>
> The live cluster currently shows `shared_buffers = 128MB`, `huge_pages = try`, and an empty `shared_preload_libraries` value. The example above is a production-style pattern only; it has not been executed against the lab. If it were, `shared_buffers` and `shared_preload_libraries` would remain pending until a restart, which the audit query would reflect through `pending_restart = true`.

---

## Temporary Workloads And WAL

PostgreSQL has no TempDB equivalent. The nearest operational surface is the combination of per-operation work memory, per-session temp buffers, temporary-file spill limits, and the WAL/checkpoint settings that determine how aggressively dirty work is forced to disk.

### Spill And Checkpoint Controls

This subsection verifies the settings that govern temp spills and checkpoint cadence. Before reading the query, the settings it returns must be understood, because PostgreSQL temp behavior is controlled through configuration rather than by inspecting a separate temp database file layout.

| Field | Source setting | Unit | Meaning |
|---|---|---|---|
| `work_mem` | `pg_settings.work_mem` | kB or memory units | Base memory available to a sort, hash, materialize, or similar executor node before it spills to temp files. |
| `temp_buffers` | `pg_settings.temp_buffers` | blocks or memory units | Per-session buffer budget for temporary tables only. This is distinct from sort/hash temp spills. |
| `log_temp_files` | `pg_settings.log_temp_files` | kB | Threshold above which PostgreSQL logs temp-file creation. `-1` disables the logging completely. |
| `temp_file_limit` | `pg_settings.temp_file_limit` | kB | Maximum temp-file space allowed per backend process. `-1` means no limit. |
| `checkpoint_timeout` | `pg_settings.checkpoint_timeout` | seconds | Time-based upper bound on how long PostgreSQL waits between automatic checkpoints. |
| `max_wal_size` | `pg_settings.max_wal_size` | MB | Volume-based checkpoint trigger. PostgreSQL checkpoints early if WAL growth is about to exceed this size. |
| `min_wal_size` | `pg_settings.min_wal_size` | MB | Lower bound for WAL recycling after checkpoint. |
| `wal_level` | `pg_settings.wal_level` | enum | The feature boundary for replication and recovery capability. |

#### Current temp-file and WAL control surface

During initial production hardening, immediately after a spill-related incident, or whenever checkpoint behavior feels more aggressive than expected. It is typically triggered by unexplained disk growth in `base/pgsql_tmp`, slow sorts and hashes, checkpoint spikes in logs, or first-pass verification after a cluster build. Runs in any database, read-only against `pg_settings`. Confirm whether PostgreSQL is still running with unbounded temp-file behavior and conservative checkpoint defaults, which is the standard packaged posture but not necessarily a production baseline.

> [!info]- Temp files and WAL in PostgreSQL
>
> PostgreSQL writes executor spill files behind the scenes when memory available to a sort, hash, or similar node is exhausted. Those files are not temporary tables and they are not governed by `temp_buffers`.
>
> WAL is a different surface again: every data change is written to WAL for crash safety, and checkpoints determine how often dirty pages are forced so recovery does not begin from an unbounded distance in the log.
>
> - `work_mem` governs when executor nodes start to spill.
> - `log_temp_files` governs whether those spills are visible.
> - `temp_file_limit` governs whether one backend can spill without bound.
> - `checkpoint_timeout`, `max_wal_size`, and `min_wal_size` govern checkpoint cadence and WAL recycling behavior.
>
> *This query verifies whether PostgreSQL temp spills are visible and bounded, and whether checkpoint cadence is still close to the packaged defaults.*
>

```sql
SELECT
    name,
    setting,
    unit,
    context,
    source
FROM pg_settings
WHERE name IN
(
    'checkpoint_timeout',
    'log_temp_files',
    'max_wal_size',
    'min_wal_size',
    'temp_buffers',
    'temp_file_limit',
    'wal_level',
    'work_mem'
)
ORDER BY name;
```

| name | setting | unit | context | source |
|---|---|---|---|---|
| checkpoint_timeout | 300 | s | sighup | default |
| log_temp_files | -1 | kB | superuser | default |
| max_wal_size | 1024 | MB | sighup | configuration file |
| min_wal_size | 80 | MB | sighup | configuration file |
| temp_buffers | 1024 | 8kB | user | default |
| temp_file_limit | -1 | kB | superuser | default |
| wal_level | replica |  | postmaster | default |
| work_mem | 4096 | kB | user | default |

*This control surface is still close to a generic package baseline. `work_mem = 4MB` and `temp_buffers = 8MB` are conservative defaults, which is safe, but PostgreSQL is currently blind to large temp spills because `log_temp_files = -1` and it does not cap per-backend spill growth because `temp_file_limit = -1`. The checkpoint settings are also at conservative defaults: `checkpoint_timeout = 5min`, `max_wal_size = 1GB`, and `min_wal_size = 80MB`. Those are acceptable for a tiny 44 MB lab database, but they are not a deliberate production posture for a write-heavy system.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `log_temp_files` | `-1` | `✗` | Temp-file logging disabled | Large spills can happen with no log evidence |
| `temp_file_limit` | `-1` | `✗` | No per-backend spill cap | One backend can consume arbitrary temp space |
| `checkpoint_timeout` | `300s` | Watch | Conservative checkpoint cadence | Fine for tiny systems, often too eager for busier ones |
| `max_wal_size` | `1GB` | Watch | Small WAL budget before checkpoint pressure increases | Can force frequent checkpoints on sustained-write workloads |
| `wal_level` | `replica` | `✓` | Recovery and physical replication capability preserved | Good default stance for most estates |

#### Set a spill-safe and checkpoint-friendly baseline

After the audit query has confirmed that temp-file logging is disabled, temp-file growth is unbounded, and checkpoint cadence is still near the packaged defaults. It is typically triggered by first hardening pass, temp-disk incident review, or sustained-write workloads that are checkpointing too often. Runs as a superuser. All settings in this batch are reloadable, so `pg_reload_conf()` is sufficient after the change. Make PostgreSQL temp spills visible and bounded, and spread checkpoints more deliberately across time and WAL volume.

> [!warning] Bigger WAL windows are not a free performance button
>
> Raising `checkpoint_timeout` and `max_wal_size` can reduce checkpoint pressure, but it also lengthens crash-recovery distance and increases the amount of WAL that must be retained or archived.

> [!success] Increase observability before increasing memory
>
> Enable temp-file logging and set a finite `temp_file_limit` before reacting to slow sorts by raising `work_mem`. That sequence tells you whether the issue is truly spill-driven and how large the spills actually are.

> [!info]- Why these values are a reasonable starting pattern
>
> - `log_temp_files = '65536'` logs temp spills larger than 64 MB, which is a practical threshold for finding meaningful offenders without turning the logs into noise.
> - `temp_file_limit = '4GB'` prevents a single backend from consuming the entire temp volume through one pathological statement.
> - `checkpoint_timeout = '15min'`, `max_wal_size = '4GB'`, and `min_wal_size = '512MB'` are common starting points that reduce checkpoint churn relative to the tiny packaged defaults.
>
> These are starting values, not constants. The correct numbers depend on write volume, recovery objectives, and available disk.
>
> *This batch applies the common PostgreSQL baseline for observable, bounded temp spills and less eager checkpointing.*
>

```sql
ALTER SYSTEM SET log_temp_files = '65536';
ALTER SYSTEM SET temp_file_limit = '4GB';
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET min_wal_size = '512MB';

SELECT pg_reload_conf();
```

> [!info] Live state of temp and WAL controls on stoxx-postgres
>
> The audit query above already captures the live state of the lab — logging disabled, spill unlimited, and checkpoints still near the packaged defaults. The batch above is the intended production pattern and has not been executed against `stoxx-postgres`, so the lab remains a clean default baseline for teaching.

---

## Linux Host Settings

The PostgreSQL instance in this environment runs on Linux inside Docker, so a few host-level checks still matter even though they are outside SQL.

### Host Checks

These commands must be run on the Linux host or container runtime that runs PostgreSQL. They read pseudo-files under `/proc` and `/sys` that expose live kernel state. For PostgreSQL, the most important Linux-memory checks are the overcommit policy, swap aggressiveness, and current Transparent Huge Pages mode.

| Field | Source path | Possible values | Meaning for PostgreSQL |
|---|---|---|---|
| Overcommit policy | `/proc/sys/vm/overcommit_memory` | `0`, `1`, or `2` | PostgreSQL documentation explicitly warns that Linux memory overcommit can let the OOM killer terminate the postmaster. `2` is the strict mode recommended for more robust PostgreSQL behavior on dedicated hosts. |
| Swap aggressiveness | `/proc/sys/vm/swappiness` | Integer kernel policy value | Controls how aggressively the kernel prefers swapping anonymous memory. A value like `60` is a general-purpose default, not a database-specific one. |
| Transparent Huge Pages | `/sys/kernel/mm/transparent_hugepage/enabled` | `[always]`, `[madvise]`, `[never]` | Shows the kernel's THP mode. This is separate from PostgreSQL's own `huge_pages` setting and needs to be treated as a host policy choice, not a PostgreSQL GUC. |

#### Verify Linux memory policy on the PostgreSQL host

During initial host validation of a new PostgreSQL deployment, after a kernel upgrade, or during OOM and latency investigations when PostgreSQL configuration alone does not explain the behavior. It is typically triggered by first build validation, unexplained postmaster exits, memory-pressure incidents, or compliance checks against a database-host standard. Runs on the Linux shell, read-only, no SQL involved. Record the current Linux memory-policy values that most directly affect PostgreSQL reliability so the operator can decide whether the host matches the intended baseline before changing anything.

> [!warning] Host-level commands, not PostgreSQL SQL
>
> These commands inspect the Linux kernel environment. They do not run inside PostgreSQL itself and they should not be confused with `SHOW` or `SELECT current_setting(...)`.

> [!success] Distinguish PostgreSQL GUCs from kernel policy
>
> Treat `huge_pages`, `work_mem`, and `checkpoint_timeout` as PostgreSQL settings, and `vm.overcommit_memory`, `vm.swappiness`, and THP mode as Linux-host policy. Good operations depend on knowing which layer owns the behavior.

> [!info]- The three checks explained
>
> - `/proc/sys/vm/overcommit_memory` is the strongest PostgreSQL-specific host check here. PostgreSQL documentation recommends strict overcommit mode (`2`) to reduce the chance that the Linux OOM killer terminates the postmaster.
> - `/proc/sys/vm/swappiness` is a general Linux pressure signal. The value is not a PostgreSQL GUC, but a high default usually means the host is still configured as a general-purpose Linux system.
> - `/sys/kernel/mm/transparent_hugepage/enabled` reports the active THP mode in brackets. This is separate from PostgreSQL's own explicit `huge_pages` setting.
>
> *These commands verify the Linux memory-policy settings that most often matter when PostgreSQL reliability issues originate below the SQL layer.*
>

```bash
cat /proc/sys/vm/overcommit_memory
cat /proc/sys/vm/swappiness
cat /sys/kernel/mm/transparent_hugepage/enabled
```

```text
1
60
always [madvise] never
```

*Output captured from inside the `stoxx-postgres` Docker container, which shares the host kernel. The active value in the THP file is shown in square brackets.*

| Reading | Live value on stoxx-postgres host | Recommended direction | Action |
|---|---|---|---|
| `vm.overcommit_memory` | `1` | Move to `2` on a dedicated PostgreSQL host | Drift from the PostgreSQL-doc-recommended strict overcommit posture |
| `vm.swappiness` | `60` | Lower from general-purpose default when the host is database-dedicated | Context drift — acceptable for a generic Linux build, not an explicit database baseline |
| THP mode | `[madvise]` | Keep explicit and deliberate | Better than `[always]`, but still a host-policy choice that should not be accidental |

#### Configure the Linux host baseline when needed

Only after the verification commands above have shown that the host does not match the platform standard, and only after the change has been validated against the configuration-management path for the fleet. It is typically triggered by baseline drift, new-host preparation before PostgreSQL is put under sustained load, or remediation after a documented OOM or latency incident. Runs on the Linux host shell as a privileged user. The `sysctl` changes are live-applied to the running kernel; writing to the THP pseudo-file is also live but is not persistent unless configuration management enforces it. Apply the dedicated-host Linux baseline deliberately rather than inheriting a general-purpose kernel profile.

> [!warning] These are host-wide changes
>
> These commands affect the Linux host globally, not only PostgreSQL. Apply them through the host's normal configuration-management path so they remain persistent and auditable.

> [!success] Persist the baseline, not just the live value
>
> Use the shell commands to confirm the intended live effect, then persist them through `/etc/sysctl.d/`, systemd, cloud-init, or the estate's normal configuration-management tooling.

> [!info]- Why these commands are shown together
>
> - `vm.overcommit_memory = 2` is the explicitly documented PostgreSQL recommendation for reducing OOM-killer risk on Linux.
> - A lower `vm.swappiness` is a general dedicated-database-host pattern that reduces the tendency to treat database memory like ordinary anonymous memory under pressure.
> - Writing `never` to the THP mode file is a common dedicated-host policy when the estate wants to avoid automatic huge-page promotion and rely only on explicit huge pages.
>
> *This command set shows the common Linux-host pattern for putting PostgreSQL on an explicit memory-policy baseline instead of a general-purpose one.*
>

```bash
sudo sysctl vm.overcommit_memory=2
sudo sysctl vm.swappiness=1
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
```

---
