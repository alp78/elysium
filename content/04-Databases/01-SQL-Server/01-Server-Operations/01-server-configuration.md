---
title: "01 - Server Configuration"
tags:
  - sql-server
  - administration
  - configuration
aliases:
  - SQL Server configuration
  - max server memory
  - TempDB configuration
description: "Production SQL Server instance-configuration baselines for memory, parallelism, TempDB, and Linux host settings, grounded on the current stoxx instance."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# Server Configuration

> [!abstract]- Summary
>
> Establishes a production-oriented SQL Server instance baseline for memory, parallelism, TempDB, and Linux host settings, using live outputs from the current `stoxx` environment as the concrete reference point. The note exists to separate product defaults from operationally safe defaults on a Linux-hosted SQL Server 2022 CU23 Developer Edition instance with 16 visible CPUs and about 24.7 GB of host memory.
>
> **Instance Baseline**
> - Audit the nine instance settings that most often distinguish a lab default from a production baseline: `Agent XPs`, `backup compression default`, `contained database authentication`, `cost threshold for parallelism`, `max degree of parallelism`, `max server memory (MB)`, `min server memory (MB)`, `optimize for ad hoc workloads`, and `remote admin connections`
> - Interpret those settings against CPU count and committed-versus-target memory from `sys.dm_os_sys_info`, then apply deliberate remediation batches for memory caps, backup compression, ad hoc plan-cache protection, and parallelism defaults
>
> **TempDB**
> - Verify TempDB data-file count, equal sizing, fixed autogrowth, and log-file layout so allocation concurrency and growth behavior are explicit rather than assumed
> - Add additional TempDB data files only when the current layout is undersized or when measured `PAGELATCH` contention justifies expansion, keeping all data files parity-aligned
>
> **Linux Host Settings**
> - Check Linux host controls that materially affect SQL Server behavior, especially `vm.swappiness`, Transparent Huge Pages, and the SSD I/O scheduler state
> - Apply the Microsoft-recommended Linux baseline deliberately so the host does not undermine SQL Server memory behavior or introduce latency spikes under pressure

> [!note]- Glossary
>
> **`sys.configurations`**
> - The instance-wide catalog view that stores SQL Server configuration options surfaced through `sp_configure`.
> - It matters because the note’s first audit query pulls the production-critical settings directly from this catalog and compares configured values with values currently in use.
>
> > [!info] Metadata and runtime both matter
> >
> > The difference between `value` and `value_in_use` is operationally important. A setting can be configured in metadata but still not be active yet.
>
> ---
>
> **`max server memory (MB)`**
> - The upper bound on the main SQL Server memory clerks, especially the buffer pool, expressed in MiB.
> - It matters because leaving it effectively unlimited is one of the most common ways to let SQL Server starve the operating system on a production host.
>
> > [!warning] Product default is not a production baseline
> >
> > `2147483647` is effectively uncapped. On a real host, that is a risk decision, not a neutral default.
>
> ---
>
> **`min server memory (MB)`**
> - The floor below which SQL Server will not shrink once it has already grown past that point.
> - It matters because it changes how aggressively SQL Server yields memory back under host pressure and is sometimes used to protect SQL from noisy neighbors.
>
> > [!warning] It does not pre-allocate memory
> >
> > `min server memory` is a retention floor, not an immediate reservation. Misunderstanding that leads to incorrect capacity assumptions.
>
> ---
>
> **Cost threshold for parallelism**
> - The optimizer cost threshold above which SQL Server will even consider producing a parallel plan.
> - It matters because the shipped default of `5` is usually too permissive on modern hardware and causes trivial queries to be considered for parallelism too cheaply.
>
> > [!warning] Cost units are not seconds
> >
> > The threshold is based on SQL Server’s internal optimizer cost model, not elapsed time. Treating it like a duration leads to bad tuning decisions.
>
> ---
>
> **MAXDOP / `max degree of parallelism`**
> - The ceiling on how many schedulers a single parallel plan is allowed to use.
> - It matters because parallel query width needs to be a deliberate instance-level decision relative to CPU and NUMA layout, not an accidental inheritance from the default `0`.
>
> > [!warning] `0` means "no explicit ceiling"
> >
> > It does not mean "use zero CPUs." It means SQL Server is left to its own defaults within its internal parallelism rules.
>
> ---
>
> **`optimize for ad hoc workloads`**
> - A setting that stores a lightweight plan stub on first execution of an ad hoc batch and only caches the full plan on the second execution.
> - It matters because it reduces plan-cache waste in workloads with many one-off ad hoc queries.
>
> > [!info] Cache protection, not query acceleration
> >
> > The benefit is lower cache bloat, not faster execution of a single query. It is mainly a plan-cache hygiene setting.
>
> ---
>
> **`backup compression default`**
> - A setting that makes SQL Server compress backups by default unless a backup command explicitly disables compression.
> - It matters because backup size, write volume, and restore behavior are strongly affected by whether compression is the default stance or the exception.
>
> > [!warning] CPU tradeoff is real
> >
> > Compression usually improves storage and throughput characteristics, but it consumes more CPU during backup creation. That is usually acceptable, not always free.
>
> ---
>
> **Dedicated Admin Connection (DAC) / `remote admin connections`**
> - The emergency administrative connection path that can bypass normal connectivity starvation, plus the setting that controls whether it is reachable remotely.
> - It matters because incident response is materially easier when the DAC is deliberately enabled for remote use and protected appropriately.
>
> > [!warning] Emergency access should still be controlled
> >
> > Remote DAC is valuable, but it widens an administrative entry point. Enable it deliberately alongside firewall and permission controls.
>
> ---
>
> **`Agent XPs`**
> - The instance setting that exposes the extended stored procedures SQL Server Agent relies on.
> - It matters because Agent job execution, schedules, alerts, and maintenance plans depend on this surface being available when Agent is actually part of the operational model.
>
> > [!info] Service state often drives the value
> >
> > On many systems, `Agent XPs` is not a setting you toggle manually first. It is enabled when Agent is intentionally installed and started.
>
> ---
>
> **Contained database authentication**
> - The instance setting that allows databases to authenticate users at the database level without relying exclusively on server logins.
> - It matters because contained users change the security boundary and login-audit model of the instance.
>
> > [!warning] Security model changes with it
> >
> > This is not just a compatibility toggle. Enabling contained authentication changes how identities are managed and audited.
>
> ---
>
> **TempDB**
> - The system database used for temporary objects, worktables, sorts, hash spills, version store activity, and many internal engine operations.
> - It matters because TempDB layout is one of the few engine-level physical designs that still has a direct impact on concurrency and stability.
>
> > [!warning] Misconfiguration hurts under load
> >
> > TempDB problems often stay invisible in a quiet lab and then become severe under concurrency, especially when file layout and growth behavior are poor.
>
> ---
>
> **TempDB file parity**
> - The practice of keeping TempDB data files the same size and the same fixed autogrowth increment.
> - It matters because equal-sized files let proportional fill distribute allocations more evenly and reduce classic allocation bottlenecks.
>
> > [!warning] More files is not automatically better
> >
> > Additional files help only when the layout is actually undersized or contention evidence supports the change. Over-provisioning adds management overhead without guaranteed benefit.
>
> ---
>
> **`PAGELATCH` allocation contention**
> - In-memory latch contention on allocation-map pages such as PFS, GAM, and SGAM, often surfacing in TempDB-heavy workloads.
> - It matters because it is one of the main empirical reasons to revisit TempDB data-file count and allocation layout.
>
> > [!warning] This is not storage I/O latency
> >
> > `PAGELATCH` waits are memory-structure synchronization waits, not disk-read waits. Treating them like slow storage leads to the wrong fix.
>
> ---
>
> **`vm.swappiness`**
> - The Linux kernel control that governs how aggressively anonymous memory is pushed toward swap.
> - It matters because SQL Server already manages its own memory aggressively, and heavy kernel swapping of SQL memory causes severe latency and unpredictability.
>
> > [!warning] Distribution defaults are often wrong for SQL Server
> >
> > A default such as `60` is normal for general-purpose Linux behavior, not for a dedicated database host where SQL memory should stay resident.
>
> ---
>
> **Transparent Huge Pages (THP)**
> - A Linux memory feature that coalesces smaller pages into larger ones automatically.
> - It matters because background THP activity can introduce latency spikes for large database processes under memory pressure.
>
> > [!warning] Automatic huge pages are not automatically good
> >
> > SQL Server on Linux generally prefers THP disabled for predictable latency. Memory features that help other workloads can hurt database stability.
>
> ---
>
> **I/O scheduler**
> - The Linux block-layer policy that decides how disk requests are queued and ordered.
> - It matters because SSD-backed SQL Server hosts usually want a no-op or minimal scheduler policy rather than one designed for spinning-disk seek optimization.
>
> > [!info] Storage type changes the right default
> >
> > The scheduler choice that makes sense for HDDs is often wrong for SSD-backed database volumes, where extra scheduling can add overhead with little benefit.
>
> ---

## Instance Baseline

Start by checking the small set of instance-level settings that most often separate a safe production build from a lab default.

### High-Impact Instance Settings

This subsection focuses on the nine instance settings that most directly affect memory pressure, parallelism, backup behavior, ad hoc plan-cache waste, emergency access, and Agent availability. Before interpreting any query output, read the reference below so that each setting name and each numeric value carries meaning, not just a shape.

| Setting | What it controls | Default | Possible values | Production guidance |
|---|---|---|---|---|
| `Agent XPs` | Exposes the extended stored procedures that SQL Server Agent needs to run jobs, alerts, schedules, and maintenance plans. SQL Server Agent itself is a separate service. | `0` | `0` = feature disabled, Agent XPs are hidden from the surface area. `1` = feature enabled. The value auto-flips to `1` the first time the Agent service starts on Windows; on Linux, it is only on when the mssql-server-agent package is installed and running. | Leave at `0` when Agent is not in use; let the Agent service flip it on the first start rather than forcing it manually. |
| `backup compression default` | Whether `BACKUP DATABASE`, `BACKUP LOG`, and differential backups compress their output without an explicit `WITH COMPRESSION` clause. | `0` | `0` = backups uncompressed unless the command specifies `WITH COMPRESSION`. `1` = backups compressed unless the command specifies `WITH NO_COMPRESSION`. | Set to `1` on almost every estate. Compressed backups are smaller, write less, and restore slightly faster. The cost is additional backup-time CPU, which is usually acceptable on production hardware. |
| `contained database authentication` | Whether the instance permits *contained databases* — databases that carry their own users, authenticated at the database level rather than against a server login. | `0` | `0` = contained DB authentication disabled; creating or attaching a contained database fails. `1` = contained DB authentication permitted. | Leave at `0` unless there is a deliberate requirement for contained databases. Contained users bypass server-level login audit trails, so enable only after the security model is understood. |
| `cost threshold for parallelism` | The minimum estimated query cost (in the optimizer's internal abstract cost unit, not seconds) at which a parallel plan is even considered. Queries below this threshold always run single-threaded. | `5` | Integer from `0` to `32767`. Lower values let parallelism kick in earlier and more often; higher values keep more queries single-threaded. | `5` is the original default from a much older hardware generation and is almost always too low on modern servers. Typical production starting points are between `25` and `50`, tuned against actual workload patterns. |
| `max degree of parallelism` | The hard ceiling on how many schedulers (logical CPUs) a single parallel query plan is allowed to use. Does not affect whether parallelism happens — only how wide it can go. | `0` | `0` = no explicit ceiling; the engine uses up to the lesser of the logical CPU count and internal NUMA rules. `1` = force serial execution for every query. Any integer `2`-`32767` = explicit ceiling. | Pick a deliberate value. Microsoft KB 2806535 is the traditional reference: for NUMA nodes with fewer than 8 logical processors, set to the number of logical processors per NUMA node; for 8 or more, start at `8` or half the cores per node. |
| `max server memory (MB)` | Upper bound on the memory SQL Server's main memory clerks — especially the buffer pool — are allowed to take. Does not cover every allocation, but covers the vast majority on modern versions. | `2147483647` (effectively unlimited) | Integer between `128` and `2147483647`. The value is in MiB, not GiB. | Always set to a finite value on production. A common pattern on dedicated SQL hosts is to leave roughly 2-4 GB for the OS plus allowances for HA, backup, and monitoring tooling, then give the rest to SQL Server. Never leave at default on a production instance. |
| `min server memory (MB)` | The floor below which SQL Server will refuse to release memory back to the OS once it has grown past that point. Does not force immediate allocation — it only prevents shrinking. | `0` | Integer between `0` and `2147483647`, in MiB. Must be less than or equal to `max server memory (MB)`. | Usually stays at `0` on dedicated SQL hosts. Useful on shared hosts or servers with aggressive non-SQL memory pressure, where the floor prevents SQL Server from being starved into paging its own buffer pool. |
| `optimize for ad hoc workloads` | Whether SQL Server stores a lightweight *plan stub* on the first execution of an ad hoc batch and only promotes it to a full cached plan on the second execution. Affects the plan cache, not query behavior. | `0` | `0` = every ad hoc batch is fully cached on first compile. `1` = first execution stores only a stub, second execution promotes it to a full plan. | Enable (`1`) on almost every instance, particularly any workload that sees a lot of one-shot ad hoc queries. It materially reduces plan-cache bloat with no downside for repeated queries. |
| `remote admin connections` | Whether the Dedicated Admin Connection (DAC) — the emergency administrative connection that bypasses normal scheduler starvation — is reachable from the network or only from the host itself. | `0` | `0` = DAC listens on the loopback interface only. `1` = DAC is reachable over the network from remote clients. | Set to `1` when remote DBA response to incidents is expected. Combine with firewall rules and endpoint permissions; the DAC is the single most valuable tool in an "the server is unreachable" situation, so remote access is usually worth enabling deliberately. |

The query in the next subsection reads these nine settings from `sys.configurations` and reports the current state of each one on this instance.

#### Current configuration values for the settings that matter first

On any new or inherited SQL Server instance, immediately after the first successful login. It is typically triggered by first configuration audit, post-migration review, post-patch verification, or incident response when an unexpected behavior suggests a misconfiguration. Runs in any database, read-only against `sys.configurations`, no special permission beyond `VIEW SERVER STATE`. Surface the nine most commonly misconfigured instance settings in one pass so the reviewer can decide which ones require a follow-up `sp_configure` change.

> [!info]- `sys.configurations` columns explained
>
> `sys.configurations` is the instance-wide catalog that backs `sp_configure`. Every row is one configurable setting.
>
> - `name` is the `sp_configure` option name, exactly as used in the set command.
> - `value` is the configured value stored in metadata — the value the administrator asked for.
> - `value_in_use` is the effective running value. For dynamic settings, it matches `value` immediately after `RECONFIGURE`. For restart-required settings, it may differ from `value` until the instance restarts.
> - `is_dynamic = 1` means the change can take effect without an engine restart (after `RECONFIGURE`). `is_dynamic = 0` means a full instance restart is required for the new value to take effect.
> - `is_advanced = 1` means the setting is hidden until `sp_configure 'show advanced options', 1; RECONFIGURE;` has been run in the current session.
>
> Two columns exist on `sys.configurations` but are not shown in this filtered query: `configuration_id` (internal integer ID) and `description` (short human-readable text for each option). They are rarely needed once the `name` is already known.
>
> The `WHERE name IN (...)` filter intentionally narrows the catalog from roughly 80 visible rows down to the nine that most often need review on a new or inherited production instance.
>
> *This query shows the effective values of the instance settings that usually need explicit production decisions rather than product defaults.*
>

```sql
SELECT
    name,
    value,
    value_in_use,
    is_dynamic,
    is_advanced
FROM sys.configurations
WHERE name IN
(
    'Agent XPs',
    'backup compression default',
    'contained database authentication',
    'cost threshold for parallelism',
    'max degree of parallelism',
    'max server memory (MB)',
    'min server memory (MB)',
    'optimize for ad hoc workloads',
    'remote admin connections'
)
ORDER BY name;
```

| name | value | value_in_use | is_dynamic | is_advanced |
|---|---:|---:|---:|---:|
| Agent XPs | 0 | 0 | 1 | 1 |
| backup compression default | 0 | 0 | 1 | 0 |
| contained database authentication | 0 | 0 | 1 | 0 |
| cost threshold for parallelism | 5 | 5 | 1 | 1 |
| max degree of parallelism | 0 | 0 | 1 | 1 |
| max server memory (MB) | 2147483647 | 2147483647 | 1 | 1 |
| min server memory (MB) | 0 | 16 | 1 | 1 |
| optimize for ad hoc workloads | 0 | 0 | 1 | 1 |
| remote admin connections | 0 | 0 | 1 | 0 |

*This is a lab-default configuration, not a production baseline. The most important problems are `max server memory (MB) = 2147483647`, which leaves SQL Server effectively uncapped, `cost threshold for parallelism = 5`, which is the overly permissive product default, `max degree of parallelism = 0`, which defers the decision entirely to SQL Server defaults, and `optimize for ad hoc workloads = 0`, which allows more plan-cache waste from single-use ad hoc plans. `backup compression default = 0` means backups do not compress unless the command explicitly asks for it. `remote admin connections = 0` means the DAC is local-only. `Agent XPs = 0` aligns with the current instance state where Agent is not enabled.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `name` | `max server memory (MB)` with a finite cap | &#9989; | SQL Server memory ceiling is explicit | Prevents the engine from consuming nearly all host memory |
| `name` | `max server memory (MB) = 2147483647` | &#10060; | Effectively uncapped | High risk of OS memory starvation |
| `name` | `cost threshold for parallelism = 5` | &#10060; in most production systems | Product default | Parallel plans are considered too cheaply |
| `name` | `max degree of parallelism = 0` | Watch | Product default behavior | May be acceptable in limited cases, but should be a deliberate decision |
| `name` | `optimize for ad hoc workloads = 1` | &#9989; for ad hoc-heavy estates | Store plan stub on first execution | Reduces plan-cache waste from one-off queries |
| `name` | `backup compression default = 1` | &#9989; in most estates | Backups compress unless overridden | Reduces backup size and storage cost |
| `name` | `remote admin connections = 1` | Context dependent | DAC accessible remotely | Useful for remote incident response, but widen access carefully |
| `value` vs `value_in_use` | Different | Watch | Configured and effective values diverge | Restart or `RECONFIGURE` requirement may still be pending |

### CPU And Memory Context

Configuration values are not meaningful without the host context they run in. A `max degree of parallelism` of `8` is meaningless until the reader knows whether the host has 4 CPUs or 64. A `max server memory (MB)` of `18432` is meaningless until the reader knows whether the host has 24 GB or 512 GB. This subsection shows how much CPU and target memory SQL Server actually sees so that every setting value in the note has operational scale attached to it.

| Field | Source column | Unit | Meaning |
|---|---|---|---|
| `sqlserver_start_time` | `sys.dm_os_sys_info.sqlserver_start_time` | `datetime` | The timestamp at which the current `sqlservr` process started. Every DMV that accumulates counters (waits, I/O, buffer usage, plan cache) resets at this moment, so any "since last restart" analysis must anchor to this value. |
| `cpu_count` | `sys.dm_os_sys_info.cpu_count` | integer | The number of logical CPUs visible to the SQL Server process — not necessarily the number of physical cores on the host, and not necessarily the number of CPUs assigned to the operating system if affinity masking is in use. This is the upper bound the engine will ever consider for scheduling. |
| `scheduler_count` | `sys.dm_os_sys_info.scheduler_count` | integer | The number of SQLOS schedulers that SQL Server has created. On a healthy instance without affinity masking, this matches `cpu_count`. A lower value indicates that CPU affinity or core licensing has restricted the engine to a subset of visible CPUs. |
| `committed_mb` | `sys.dm_os_sys_info.committed_kb / 1024` | MiB | Memory SQL Server has currently committed — that is, has actually reserved and backed with physical pages. This is *not* the buffer pool size in isolation; it is total committed memory across all memory clerks. |
| `committed_target_mb` | `sys.dm_os_sys_info.committed_target_kb / 1024` | MiB | The amount of memory SQL Server is currently allowed to grow to, based on `max server memory (MB)`, available OS memory, and internal memory-pressure feedback. If `committed_mb` keeps approaching `committed_target_mb`, the engine is fully utilizing its allowed footprint. |
| `visible_target_mb` | `sys.dm_os_sys_info.visible_target_kb / 1024` | MiB | The upper memory bound as the engine sees it, which may differ from `committed_target_mb` under AWE, locked pages, or memory-pressure throttling. On modern 64-bit SQL Server without AWE, these two are usually equal. |

#### CPU count and current committed versus target memory

Any time a memory-related decision is on the table — sizing `max server memory (MB)`, reviewing `MAXDOP`, investigating an OOM incident, or planning a workload migration. It is typically triggered by sizing exercise, capacity planning, incident triage, or post-restart verification. Runs in any database, read-only against `sys.dm_os_sys_info`, requires `VIEW SERVER STATE`. Provide the engine-side view of host CPU and memory so that `sp_configure` values in the rest of the note have operational scale. Without this query, a memory cap is just a number.

> [!info]- `sys.dm_os_sys_info` columns explained
>
> `sys.dm_os_sys_info` is a single-row DMV that exposes internal SQLOS bookkeeping at the instance level. The `_kb` columns are reported in kibibytes and are divided by `1024` in the `SELECT` list to produce a more readable MiB figure.
>
> - `cpu_count` and `scheduler_count` together confirm whether the engine is scheduling across every visible logical CPU or a restricted subset.
> - `committed_kb` is the live committed memory footprint, converted in-query to `committed_mb`.
> - `committed_target_kb` is the engine's target — the ceiling the memory broker is currently aiming for. Treat it as the effective `max server memory` view, because the engine's broker will clamp it to the configured cap and to OS headroom.
> - `visible_target_kb` is the same value from the engine's perspective including any AWE/locked-pages adjustments. On Linux and on modern Windows, it usually matches `committed_target_kb`.
>
> Together, these values are the context for `max degree of parallelism` and `max server memory`. Without them, a configuration value has no operational scale.
>
> *This query shows the CPU footprint and the memory target SQL Server is currently aiming for on this host.*
>

```sql
SELECT
    sqlserver_start_time,
    cpu_count,
    scheduler_count,
    committed_kb / 1024 AS committed_mb,
    committed_target_kb / 1024 AS committed_target_mb,
    visible_target_kb / 1024 AS visible_target_mb
FROM sys.dm_os_sys_info;
```

| sqlserver_start_time | cpu_count | scheduler_count | committed_mb | committed_target_mb | visible_target_mb |
|---|---:|---:|---:|---:|---:|
| 2026-04-11 11:24:45.59 | 16 | 16 | 2277 | 22926 | 22926 |

*SQL Server currently sees 16 logical CPUs and a memory target of about 22.4 GB, while only about 2.2 GB is committed at this moment. That combination matters: the engine is allowed to grow much larger than its current usage, and because `max server memory` is effectively uncapped, SQL Server could continue expanding toward the host-visible target unless external pressure stops it. This is exactly the kind of instance where a production memory cap should be deliberate, not left at the product default.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `sqlserver_start_time` | Recent | Context | Process started recently | DMV counters are still warming up; "since restart" metrics may underrepresent normal load |
| `sqlserver_start_time` | Old (weeks/months) | Context | Process has been running a long time | DMV counters represent a stable picture; safe baseline for wait stats and plan cache analysis |
| `cpu_count` | `16` | Context | Visible logical CPU count | Useful for MAXDOP and TempDB sizing decisions |
| `scheduler_count` | Close to `cpu_count` | &#9989; | Expected scheduler visibility | Normal engine scheduling surface |
| `scheduler_count` | Significantly less than `cpu_count` | &#10060; | Affinity mask or licensing limits the engine | The instance is not using all available CPUs; verify it is intentional |
| `committed_mb` | Far below `committed_target_mb` | Context | SQL Server is not yet using all target memory | Memory is available for workload growth |
| `committed_mb` | Near `committed_target_mb` | Watch | Engine is near its target | Normal on busy instances, but check OS headroom |
| `committed_target_mb` | Equals `max server memory (MB)` | &#9989; | Cap is the binding constraint | The engine has been told an explicit ceiling and is honoring it |
| `committed_target_mb` | Below `max server memory (MB)` | Watch | OS or pressure broker is pulling the target down | External memory pressure is in effect; investigate other processes on the host |
| `visible_target_mb` | Equals `committed_target_mb` | &#9989; | Standard 64-bit, non-AWE configuration | Normal engine memory model |
| `visible_target_mb` | Differs from `committed_target_mb` | Watch | AWE, locked pages, or pressure adjustments are active | Verify memory configuration deliberately |

### Recommended Configuration Actions

The current baseline calls for a small number of concrete changes before this instance can be called production-safe.

#### Set a memory cap, backup compression, and ad hoc plan protection

After the audit query above has confirmed that `max server memory (MB)` is at the default `2147483647`, that `backup compression default` is `0`, and that `optimize for ad hoc workloads` is `0`. Do not run blindly — first verify the current state. It is typically triggered by initial production hardening of a new instance, post-migration cleanup, or remediation following an OOM incident or plan-cache bloat investigation. Runs in any database, requires `ALTER SETTINGS` server-level permission (held by `sysadmin` and `serveradmin`). All three settings here are dynamic, so no restart is required after `RECONFIGURE`. The numeric memory value must be adjusted for the actual host before running — never copy verbatim between servers. Apply the three lowest-risk, highest-value `sp_configure` changes in a single batch: cap memory growth, enable backup compression, and protect the plan cache from ad hoc bloat.

> [!warning] Memory cap values do not transfer between servers
>
> Do not copy these values blindly between servers. `max server memory (MB)` must be sized against the real host memory, other resident processes, and HA tooling. A bad memory cap can starve either SQL Server or the operating system.

> [!success] Use as pattern then adjust per host
>
> Use these commands as a pattern, then adjust the numeric memory value for the actual server. On this host, a cap in the high teens of GB would be a more realistic starting point than leaving the engine uncapped.

> [!info]- Settings changed and why
>
> This batch enables advanced options, then changes three settings that are usually safe production improvements on SQL Server estates:
>
> - `max server memory (MB)` sets an explicit memory ceiling. The example value `18432` MiB equals 18 GiB; on a host with ~24 GB visible memory, this leaves roughly 6 GB for the OS, monitoring agents, and HA tooling.
> - `backup compression default` makes compression the default behavior for full, differential, and log backups unless a backup command overrides it with `WITH NO_COMPRESSION`.
> - `optimize for ad hoc workloads` reduces plan-cache waste by storing a stub on first execution of one-off ad hoc batches; only the second execution of the same batch promotes it to a fully cached plan.
>
> The first `sp_configure 'show advanced options', 1` is required because `max server memory (MB)`, `optimize for ad hoc workloads`, and most other interesting settings are flagged advanced and would otherwise raise error 15123 ("The configuration option does not exist").
>
> All three settings are dynamic and take effect after `RECONFIGURE`. No service restart is required.
>
> *This batch applies the most common first-round production configuration corrections for memory governance, backup storage efficiency, and ad hoc plan-cache hygiene.*
>

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'max server memory (MB)', 18432;
EXEC sp_configure 'backup compression default', 1;
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

> [!info] Live state of these settings on stoxx
>
> The audit query at the top of this section already captures the current value of `max server memory (MB)`, `backup compression default`, and `optimize for ad hoc workloads` on the live `stoxx` instance — they are at the product defaults `2147483647`, `0`, and `0` respectively. The batch above is shown as the *intended remediation*, not as something that has been executed against `stoxx` in this note. The instance is left at its lab-default configuration on purpose so the audit query continues to teach the "this is what an unconfigured instance looks like" baseline.

#### Set parallelism defaults deliberately

After the audit query has confirmed `max degree of parallelism = 0` and `cost threshold for parallelism = 5` (the shipped defaults), and after a deliberate decision about MAXDOP based on the host's CPU and NUMA layout. It is typically triggered by initial production hardening, evidence of `CXPACKET` or `CXCONSUMER` waits in the wait stats, or workload migration to a host with a different CPU topology. Runs in any database, requires `ALTER SETTINGS` server-level permission. Both settings are dynamic; no restart required. The MAXDOP value chosen here (`8`) is suitable only for hosts with at least 8 visible logical CPUs and a single NUMA node; multi-NUMA hosts and very small VMs need different values. Replace two of the most consistently misconfigured defaults — unbounded MAXDOP and cost threshold `5` — with deliberate starting values that can then be tuned against real workload telemetry.

> [!warning] These values are starting points, not constants
>
> Do not treat `MAXDOP = 8` and `cost threshold for parallelism = 50` as universal truth. They are common starting points, not magical constants.

> [!success] Validate against real evidence
>
> Use them as a starting baseline, then validate with wait stats, CPU pressure, and actual plan behavior. If the server has a different NUMA layout or workload class, tune from evidence rather than dogma.

> [!info]- Settings changed and why
>
> This batch sets the two instance-level parallelism defaults that are most often left at unsafe product defaults:
>
> - `max degree of parallelism` limits how many schedulers a single parallel plan can use. The example value `8` is the traditional Microsoft starting point for hosts with 8 or more logical CPUs per NUMA node.
> - `cost threshold for parallelism` controls how expensive a query must appear (in the optimizer's abstract cost units) before the engine even considers a parallel plan. The example value `50` is a common modern starting point that prevents trivial queries from being parallelized.
>
> The shipped default of `5` for cost threshold dates from a generation of much slower CPUs and is now widely considered too low.
>
> Both settings are advanced, so the batch enables `show advanced options` first.
>
> *This batch sets an explicit starting baseline for SQL Server parallelism instead of relying on the product defaults.*
>

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;

EXEC sp_configure 'max degree of parallelism', 8;
EXEC sp_configure 'cost threshold for parallelism', 50;
RECONFIGURE;
```

> [!info] Live state of these settings on stoxx
>
> The audit query at the top of this section already captures the current value of `max degree of parallelism` and `cost threshold for parallelism` on the live `stoxx` instance — they are at the product defaults `0` and `5` respectively. The batch above is shown as the *intended remediation*, not as something that has been executed against `stoxx` in this note. Leaving the instance at its lab defaults preserves the teaching value of the audit query as a "before" snapshot.

---

## TempDB

TempDB configuration is one of the few engine-level areas where file layout still matters materially for concurrency and operational stability.

### File Layout

This subsection verifies the number of TempDB files, their size parity, and their growth pattern. Before reading the query, the columns it returns must be understood — every diagnosis below depends on what each one means.

| Field | Source column | Unit | Meaning |
|---|---|---|---|
| `file_id` | `sys.database_files.file_id` | integer | The database-scoped identifier of the file. `1` is always the primary data file; `2` is the first log file when the database has the typical default layout. Numbers above `2` are additional ROWS files added with `ALTER DATABASE`. |
| `name` | `sys.database_files.name` | sysname | The logical file name as it is referenced from T-SQL (`MODIFY FILE`, `RESIZE`, `REMOVE FILE`). It is independent of the physical filename and stays stable when the file is moved on disk. |
| `type_desc` | `sys.database_files.type_desc` | text | The file type. The two values that matter for TempDB are `ROWS` (a data file backing tables, indexes, and the version store) and `LOG` (the transaction log file). Other values exist (`FILESTREAM`, `FULLTEXT`) but are not relevant to TempDB. |
| `physical_name` | `sys.database_files.physical_name` | text | The OS-level path to the file as the engine sees it. On Linux, this is the absolute Linux path (e.g. `/var/opt/mssql/data/tempdb.mdf`); on Windows, the absolute Windows path. Useful for confirming that all TempDB files live on the right volume. |
| `size_mb` | `sys.database_files.size * 8.0 / 1024` | MiB | Current allocated file size. The base column `size` is in 8 KiB pages, so the formula `size * 8 / 1024` converts pages to MiB. This is the on-disk size, not the free space inside the file. |
| `growth` | `sys.database_files.growth` | varies | The autogrowth increment. The unit depends on `is_percent_growth`: when `is_percent_growth = 0`, `growth` is in 8 KiB pages (so `8192` pages = 64 MiB); when `is_percent_growth = 1`, `growth` is a percentage of the current file size. |
| `is_percent_growth` | `sys.database_files.is_percent_growth` | bit | `0` = `growth` is a fixed page count (preferred for TempDB). `1` = `growth` is a percentage of current size, which means each growth event becomes larger than the previous one — undesirable for TempDB because growth pauses block waiting sessions. |

#### Current TempDB data-file and log-file layout

During initial production hardening, immediately after a TempDB-related incident (PAGELATCH contention on `2:1:1`, `2:1:3`, or `2:1:128/129`), or whenever a new instance is inherited. It is typically triggered by initial baseline check, contention investigation, or post-migration verification that TempDB layout was not lost during the move. Runs against `tempdb`, read-only, requires `VIEW DEFINITION` on the database. Safe to run at any time on any workload. Confirm whether TempDB has the expected number of equally sized data files with fixed-size autogrowth, which is the standard baseline for avoiding allocation contention.

> [!info]- `tempdb.sys.database_files` columns explained
>
> `sys.database_files` is the per-database catalog of physical files. The query targets `tempdb.sys.database_files` explicitly so the result is scoped to the TempDB files even when the current database is something else.
>
> - Data-file count and size parity matter because the engine uses *proportional fill* to distribute allocations across files based on free space. If one file is much larger than the others, allocations skew toward it and the benefit of multiple files is lost.
> - Equal file sizes and equal fixed autogrowth increments are the standard baseline because they keep proportional fill balanced even after growth events.
> - Percentage growth (`is_percent_growth = 1`) is undesirable for TempDB because the absolute size of each growth event increases over time, and each growth event briefly suspends sessions waiting on space in TempDB.
>
> *This query verifies whether TempDB is laid out with equal-sized data files and fixed-size growth increments.*
>

```sql
SELECT
    file_id,
    name,
    type_desc,
    physical_name,
    CAST(size * 8.0 / 1024 AS decimal(12,2)) AS size_mb,
    growth,
    is_percent_growth
FROM tempdb.sys.database_files
ORDER BY file_id;
```

| file_id | name | type_desc | physical_name | size_mb | growth | is_percent_growth |
|---:|---|---|---|---:|---:|---:|
| 1 | tempdev | ROWS | /var/opt/mssql/data/tempdb.mdf | 136.00 | 8192 | 0 |
| 2 | templog | LOG | /var/opt/mssql/data/templog.ldf | 8.00 | 8192 | 0 |
| 3 | tempdev2 | ROWS | /var/opt/mssql/data/tempdb2.ndf | 136.00 | 8192 | 0 |
| 4 | tempdev3 | ROWS | /var/opt/mssql/data/tempdb3.ndf | 136.00 | 8192 | 0 |
| 5 | tempdev4 | ROWS | /var/opt/mssql/data/tempdb4.ndf | 136.00 | 8192 | 0 |
| 6 | tempdev5 | ROWS | /var/opt/mssql/data/tempdb5.ndf | 136.00 | 8192 | 0 |
| 7 | tempdev6 | ROWS | /var/opt/mssql/data/tempdb6.ndf | 136.00 | 8192 | 0 |
| 8 | tempdev7 | ROWS | /var/opt/mssql/data/tempdb7.ndf | 136.00 | 8192 | 0 |
| 9 | tempdev8 | ROWS | /var/opt/mssql/data/tempdb8.ndf | 136.00 | 8192 | 0 |

*This TempDB layout is already in good shape. There are eight equal-sized data files, which is the usual starting point for a 16-CPU host, and every file uses fixed-size autogrowth. That means TempDB is not currently suffering from the classic single-file or uneven-growth layout mistake.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `type_desc` | `ROWS` on multiple equal files | &#9989; | Multiple TempDB data files exist | Better concurrency on TempDB allocations |
| `type_desc` | Single `ROWS` file only | &#10060; | Single TempDB data-file layout | Greater risk of allocation contention under concurrency |
| `is_percent_growth` | `0` | &#9989; | Fixed-size growth | Predictable growth events |
| `is_percent_growth` | `1` | &#10060; | Percentage-based growth | Increasingly large and less predictable growth operations |

#### Add TempDB files when the layout is undersized

Only after the audit query has shown that the current TempDB data-file count is below the threshold suggested by the host's CPU count, or after measured allocation contention (`PAGELATCH_UP` waits on TempDB GAM/SGAM/PFS pages) has confirmed that more files are warranted. It is typically triggered by observed PAGELATCH contention on TempDB system pages, an undersized inherited instance, or a planned scale-up that adds CPUs to the host. Runs in any database, requires `ALTER` on `tempdb` (held by `sysadmin`). The new file is created online with no service interruption, but allocations into it are gradual until proportional fill rebalances usage. The new file's size and growth must match the existing data files exactly. Add one additional TempDB data file that is parity-aligned with the existing files so the engine can spread allocations across one more parallel allocation surface.

> [!warning] Do not over-provision TempDB files
>
> Do not keep adding TempDB files just because "more must be better." Each additional file consumes disk space and management overhead. Add files only when the current layout is actually undersized or when contention evidence justifies it.

> [!success] Keep parity across all data files
>
> When more files are warranted, keep all TempDB data files the same size and the same fixed autogrowth increment so proportional fill keeps allocations balanced.

> [!info]- `ALTER DATABASE ADD FILE` clauses explained
>
> The `ALTER DATABASE tempdb ADD FILE` statement attaches one new physical file to the TempDB primary filegroup. Each clause in the file specification carries a specific meaning:
>
> - `NAME` is the logical file name used in subsequent T-SQL operations against the file. By convention, TempDB additional files are named `tempdev2`, `tempdev3`, and so on.
> - `FILENAME` is the absolute OS path where the file will be created. On Linux, this is the Linux path; on Windows, the Windows path. The directory must already exist and be writable by the SQL Server service account.
> - `SIZE` is the initial size in MiB. To preserve proportional fill, this must match the existing data files exactly.
> - `FILEGROWTH` is the autogrowth increment. To preserve parity, this must match the existing data files exactly. A unit suffix (`MB`, `KB`, `GB`) is required when the value is in bytes; without a suffix, the value is interpreted as 8 KiB pages.
>
> *This command pattern adds one additional TempDB data file with the same size and growth behavior as the existing data files.*
>

```sql
ALTER DATABASE tempdb ADD FILE
(
    NAME = 'tempdev9',
    FILENAME = '/var/opt/mssql/data/tempdb9.ndf',
    SIZE = 328MB,
    FILEGROWTH = 64MB
);
```

> [!info] Live state of TempDB on stoxx
>
> The TempDB file-layout query at the top of this section already captures the current state on the live `stoxx` instance — eight equally sized data files (`tempdev` through `tempdev8`) plus one log file, all using fixed-size autogrowth. Adding a ninth data file is not warranted on this instance, so the `ALTER DATABASE` above is shown as a reference pattern only and has not been executed against `stoxx` in this note. The example values (`SIZE = 136MB`, `FILEGROWTH = 64MB`) would need to match the existing file sizes (`136 MB` per the audit query) on the target instance before being run for real.

---

## Linux Host Settings

The SQL Server instance in this environment runs on Linux, so there are a few host-level checks that still matter even though they are outside T-SQL.

### Host Checks

These commands must be run on the Linux host that runs SQL Server, not from SSMS. They read pseudo-files under `/proc` and `/sys` that expose live kernel state. Each one corresponds to a specific kernel knob that materially affects SQL Server latency or memory behavior.

| Field | Source path | Possible values | Meaning for SQL Server |
|---|---|---|---|
| Swap aggressiveness | `/proc/sys/vm/swappiness` | Integer `0`-`200` (`0`-`100` on older kernels). Default on most distributions is `60`. | Controls how willingly the kernel swaps anonymous memory pages out to disk to free RAM for the page cache. SQL Server already manages its own buffer pool — letting the kernel swap it out causes severe latency spikes. The Microsoft recommendation is `1` on dedicated SQL hosts. |
| Transparent Huge Pages | `/sys/kernel/mm/transparent_hugepage/enabled` | One of `[always]`, `[madvise]`, `[never]`. The bracketed value is the active one. | THP transparently coalesces 4 KiB pages into 2 MiB pages. The coalescing pass (`khugepaged`) can stall allocation paths under memory pressure, causing latency spikes for large database processes. Microsoft recommends disabling THP (`never`) for production SQL Server on Linux. |
| Block device scheduler | `/sys/block/sdb/queue/scheduler` | One of `[none]`, `[mq-deadline]`, `[bfq]`, `[kyber]`. The bracketed value is the active one. The path uses `sdb` as the example device — the actual device name depends on the host (`nvme0n1`, `sda`, etc.). | Controls the order in which the kernel issues I/O requests to the underlying device. Modern SSD and NVMe storage benefits from `none` (or `mq-deadline` for some workloads), because the device's internal scheduler is faster than the kernel's. Spinning disks may benefit from `mq-deadline` or `bfq`. |

#### Verify Linux memory and I/O settings on the SQL Server host

During initial host validation of a new Linux SQL Server deployment, after a kernel upgrade, or during latency-spike investigation when buffer-pool or storage behavior is suspect. It is typically triggered by new build, post-upgrade verification, OOM event, latency spike with no obvious query-side cause, or compliance check against the platform standard. Runs on the Linux host shell (SSH session), not in SSMS or `sqlcmd`. Read-only — these `cat` commands cannot change anything. No privilege escalation required for read. Record the current value of three kernel knobs that most often affect SQL Server latency on Linux, so the operator can decide whether the host matches the platform standard before changing anything.

> [!warning] Host-level commands, not T-SQL
>
> These are host-level commands. They do not run inside SQL Server and they should not be tested blindly on unrelated Linux machines.

> [!success] Verify before changing
>
> Run them only on the SQL Server host and treat them as verification commands first. Change values only when you understand the current host baseline and the platform standard for that fleet.

> [!info]- The three checks explained
>
> Each `cat` command reads one kernel pseudo-file:
>
> - `/proc/sys/vm/swappiness` returns a single integer, the current swap aggressiveness. Microsoft recommends `1` for SQL Server on Linux to suppress almost all anonymous-memory swapping.
> - `/sys/kernel/mm/transparent_hugepage/enabled` returns the THP mode with the active value in square brackets. Microsoft recommends `never` to avoid latency spikes from background coalescing.
> - `/sys/block/sdb/queue/scheduler` returns the I/O scheduler list with the active value in square brackets. The `sdb` element of the path is the example block device — substitute the actual data-disk device name on the host. Modern NVMe and SSD storage typically performs best with `none`.
>
> *These commands verify the Linux host settings that most often matter to SQL Server latency and memory behavior on Linux.*
>

```bash
cat /proc/sys/vm/swappiness
cat /sys/kernel/mm/transparent_hugepage/enabled
cat /sys/block/sdb/queue/scheduler
```

```text
60
always [madvise] never
[none] mq-deadline kyber
```

*Output captured from inside the `stoxx-db` Docker container (`docker exec stoxx-db cat ...`), which exposes the kernel of the underlying Linux host on which SQL Server is actually running. The active value in each multi-option file is shown in square brackets.*

| Reading | Live value on stoxx host | Microsoft recommendation | Action |
|---|---|---|---|
| `vm.swappiness` | `60` | `1` | Drift — the host is at the distribution default. Set to `1` via `sysctl` and persist in `/etc/sysctl.d/`. |
| THP `enabled` | `[madvise]` | `never` | Drift — the host uses on-demand THP via `madvise`. SQL Server itself does not call `madvise(MADV_HUGEPAGE)`, so the practical impact is small, but the platform standard is `never` to eliminate background coalescing entirely. |
| `sdb` scheduler | `[none]` | `none` (or `mq-deadline`) | Already optimal — the no-op scheduler is selected, which is the recommended setting for SSD/NVMe storage. No change needed. |

> [!info] Container vs host kernel
>
> Because `stoxx-db` is a Docker container, the values above reflect the kernel of the Docker host (a WSL2 VM on this machine), not the Windows host. Container processes share the host kernel, so the values SQL Server sees inside the container are the same values that would matter if SQL Server were running directly on a bare-metal Linux host. On a real production Linux deployment, run the `cat` commands directly on the host OS.

#### Configure the Linux host baseline when needed

Only after the verification commands above have shown that the host does not match the platform standard, and only after the change has been validated against the configuration-management path for the fleet. It is typically triggered by drift from the platform standard, new host build before SQL Server is put under load, or remediation following a documented latency or OOM incident traced to one of these settings. Runs on the Linux host shell as a privileged user (`sudo`). The `sysctl` change is live-applied to the running kernel; the `tee` writes to `/sys` are also live but do not survive reboot unless persisted. Ad hoc changes drift quickly — always persist through the configuration-management tool that controls the host (Ansible, Puppet, cloud-init, kickstart, etc.). Apply the Microsoft-recommended Linux host baseline for SQL Server on Linux: minimal swappiness, THP disabled, and the no-op I/O scheduler on SSD-backed storage.

> [!warning] Changes affect the host globally
>
> These changes affect the Linux host globally, not only SQL Server. They should be applied through the host configuration standard for the environment, not as ad hoc shell changes that drift from configuration management.

> [!success] Persist through configuration management
>
> Persist them through the host's normal configuration-management path so the settings survive reboot and remain auditable.

> [!info]- Each command explained
>
> - `sudo sysctl vm.swappiness=1` writes `1` to `/proc/sys/vm/swappiness` immediately. To make the change survive reboot, the same setting must also be added to `/etc/sysctl.conf` or to a file under `/etc/sysctl.d/`.
> - `echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled` writes `never` to the THP mode pseudo-file. This is also non-persistent across reboot; the platform standard usually persists it through a `tuned` profile, a `systemd` unit, or a kernel boot parameter.
> - `echo none | sudo tee /sys/block/sdb/queue/scheduler` selects the no-op I/O scheduler on the `sdb` block device. Replace `sdb` with the actual device backing SQL Server data files. Persistent configuration is usually applied via a `udev` rule.
>
> *This command set shows the common Linux-host pattern for reducing swap aggressiveness, disabling THP, and using the `none` scheduler on SSD-backed devices.*
>

```bash
sudo sysctl vm.swappiness=1
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo none | sudo tee /sys/block/sdb/queue/scheduler
```

---
