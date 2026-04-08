---
title: "SQL Server Agent Jobs"
tags:
  - sql-server
  - administration
  - scheduling
aliases:
  - SQL Server Agent
  - Agent jobs
description: "SQL Server Agent on Linux: current instance state, enablement, Linux limitations, job creation, monitoring, and when Agent should or should not own scheduled work."
parent: "[[domain-server-operations]]"
links:
  - "[[server-configuration]]"
  - "[[backup-types-and-strategy]]"
  - "[[sqlcmd-connection-and-usage]]"
created: 2026-03-29
updated: 2026-04-08
status: complete
---

# SQL Server Agent Jobs

SQL Server Agent is SQL Server's built-in scheduler for maintenance and database-local automation. It is good at recurring T-SQL work and SQL Server-native maintenance. It is not a general orchestrator. On Linux, that boundary matters even more because Agent supports fewer job-step subsystems than it does on Windows.

---

## Current Instance State

Before designing jobs, verify whether Agent is actually enabled and whether `msdb` contains job metadata at all.

### Agent Presence

#### Current Agent-related state in `msdb`

> [!info]-
> This query returns three result sets that answer the first operational questions:
>
> - `job_count` shows how many Agent jobs exist in `msdb`
> - the second result set lists the actual jobs, if any
> - the third result set lists registered Agent subsystems from `msdb.dbo.syssubsystems`
>
> On an enabled and active Agent installation, `syssubsystems` should not be empty. An empty result usually means Agent is disabled or not initialized.
>
> *This query shows whether SQL Server Agent is currently populated and usable on the instance.*
>
```sql
SELECT COUNT(*) AS job_count
FROM msdb.dbo.sysjobs;

SELECT TOP (10)
    name,
    enabled,
    date_created,
    date_modified
FROM msdb.dbo.sysjobs
ORDER BY date_created DESC;

SELECT
    subsystem,
    agent_exe
FROM msdb.dbo.syssubsystems
ORDER BY subsystem;
```

| job_count |
|---:|
| 0 |

<!-- result-set-separator -->

| name | enabled | date_created | date_modified |
|---|---|---|---|

<!-- result-set-separator -->

| subsystem | agent_exe |
|---|---|

*This instance currently has no Agent jobs and no registered Agent subsystems visible in `msdb`. In practice, that means Agent is not currently configured as an active scheduling surface here. This matches the broader server baseline: the environment is running as a lab-style or manually operated instance rather than an Agent-driven maintenance server.*

#### Current `Agent XPs` configuration value

> [!info]-
> This query reads the `Agent XPs` configuration row from `sys.configurations`.
>
> - `value` is the configured metadata value.
> - `value_in_use` is the effective live value.
>
> When `Agent XPs = 0`, SQL Server Agent extended stored procedure support is disabled at the instance level.
>
> *This query checks whether SQL Server Agent extended procedure support is enabled in the running instance.*
>
```sql
SELECT
    name,
    value,
    value_in_use
FROM sys.configurations
WHERE name = 'Agent XPs';
```

| name | value | value_in_use |
|---|---:|---:|
| Agent XPs | 0 | 0 |

*`Agent XPs = 0` confirms the same story from the configuration side: Agent support is currently disabled in the running instance. Until Agent is enabled and initialized, there is no point troubleshooting missing jobs or empty history tables as though Agent were already operating.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `value_in_use` | `0` | Watch | Agent support disabled | Agent jobs and related procedures are not active |
| `value_in_use` | `1` | &#9989; when Agent is part of the design | Agent support enabled | `msdb` job metadata and scheduling surface should be present |

---

## Enabling Agent On Linux

SQL Server Agent on Linux is enabled outside T-SQL through `mssql-conf`, because the Linux packaging model differs from Windows service management.

### Linux Enablement Pattern

#### Enable Agent and restart the engine

> [!warning]
> This is a host-level change, not a database change. It affects the instance globally and requires a SQL Server restart, because Agent runs inside the SQL Server service process on Linux.
>
> [!success]
> Run it during a maintenance window or other restart-safe period. After the restart, verify `Agent XPs`, `msdb.dbo.syssubsystems`, and `msdb.dbo.sysjobs`.
>
> [!info]-
> On Linux, SQL Server Agent is enabled with `mssql-conf`, not with Windows service control tooling.
>
> - the first command sets `sqlagent.enabled = true`
> - the second restarts SQL Server so the Agent surface is initialized
>
> *This command pair enables SQL Server Agent on Linux and restarts the engine so Agent becomes active.*
>
```bash
sudo /opt/mssql/bin/mssql-conf set sqlagent.enabled true
sudo systemctl restart mssql-server
```

#### Linux subsystem boundary

> [!warning]
> Do not assume Windows-style Agent capabilities on Linux. Linux Agent does not give you the same job-step surface as Windows.
>
> [!success]
> Use Agent for T-SQL maintenance and SQL Server-native tasks. Move shell automation, Python, PowerShell, and multi-system orchestration into the external scheduler that owns those workloads.
>
| Capability area | Windows Agent | Linux Agent |
|---|---|---|
| T-SQL job steps | Yes | Yes |
| Replication-related job steps | Yes | Supported where the feature exists |
| CmdExec job steps | Yes | No |
| PowerShell job steps | Yes | No |
| SSIS job steps | Yes | No |
| General-purpose orchestration role | Limited | Even more limited |

---

## Creating Jobs

Once Agent is enabled, job creation is still straightforward because `msdb.dbo.sp_add_*` procedures work the same general way as on Windows for supported step types.

### T-SQL Job Pattern

#### Create a simple recurring T-SQL maintenance job

> [!info]-
> This example creates a job container, adds a T-SQL step, defines a schedule, attaches the schedule, and binds the job to the local server.
>
> Because Linux Agent should be treated primarily as a T-SQL scheduler, the step deliberately uses the `TSQL` subsystem only.
>
> *This command sequence creates a minimal recurring SQL Server Agent job for T-SQL maintenance work.*
>
```sql
EXEC msdb.dbo.sp_add_job
    @job_name = N'Nightly Full Backup',
    @enabled = 1,
    @description = N'Nightly full backup for the stoxx database';

EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'Nightly Full Backup',
    @step_name = N'Backup stoxx',
    @subsystem = N'TSQL',
    @command = N'
        BACKUP DATABASE stoxx
        TO DISK = N''/var/opt/mssql/backup/stoxx_full.bak''
        WITH INIT, COMPRESSION, CHECKSUM, STATS = 10;
    ',
    @database_name = N'master';

EXEC msdb.dbo.sp_add_schedule
    @schedule_name = N'Nightly 02:00',
    @freq_type = 4,
    @freq_interval = 1,
    @active_start_time = 020000;

EXEC msdb.dbo.sp_attach_schedule
    @job_name = N'Nightly Full Backup',
    @schedule_name = N'Nightly 02:00';

EXEC msdb.dbo.sp_add_jobserver
    @job_name = N'Nightly Full Backup';
```

#### Key schedule values to remember

| Parameter | Meaning |
|---|---|
| `@freq_type = 4` | Daily schedule |
| `@freq_type = 8` | Weekly schedule |
| `@active_start_time = 020000` | 02:00:00 |
| `@enabled = 1` | Job or schedule is active |

---

## Monitoring And History

If Agent owns production maintenance, `msdb` must be part of your observability surface.

### Job History

#### Check recent job history

> [!info]-
> This query joins `msdb.dbo.sysjobhistory` to `msdb.dbo.sysjobs`.
>
> - `run_status` is the important first column: `0 = failed`, `1 = succeeded`, `2 = retry`, `3 = canceled`, `4 = in progress`
> - `step_id = 0` rows are job-level summary rows
> - `run_date` and `run_time` are stored as integers, not datetime
>
> *This query shows recent Agent execution outcomes from `msdb` once Agent is part of the operational model.*
>
```sql
SELECT
    j.name AS job_name,
    h.step_id,
    h.step_name,
    h.run_status,
    h.run_date,
    h.run_time,
    h.run_duration,
    h.message
FROM msdb.dbo.sysjobhistory AS h
JOIN msdb.dbo.sysjobs AS j
    ON j.job_id = h.job_id
ORDER BY h.instance_id DESC;
```

| Result |
|---|
| No rows returned |

*No job history exists because no Agent jobs exist on this instance yet. In a production estate where Agent owns backups, integrity checks, or index maintenance, an empty history table would itself be suspicious. Here it simply confirms the current state: Agent is not yet part of routine operations on this server.*

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `Result` | `No rows returned` with Agent intentionally unused | &#9989; here | No job executions exist yet | Consistent with current non-Agent posture |
| `run_status` | `1` | &#9989; | Step or job succeeded | Normal healthy execution |
| `run_status` | `0` | &#10060; | Step or job failed | Investigate the failing step, job owner, and output |
| `run_status` | `2` | Watch | Step is retrying | Failure already happened once |

---

## Choosing The Right Scheduler

Agent is not the right owner for every scheduled task in a data platform.

### Ownership Boundary

#### When Agent is the right tool

Use Agent when the work is:

- SQL Server-native
- T-SQL-centric
- maintenance-oriented
- acceptable as a flat recurring job without cross-system dependency management

Typical examples:

- full, differential, and log backups
- `DBCC CHECKDB`
- index maintenance
- statistics maintenance

#### When Agent is the wrong tool

Use Airflow, cron, Cloud Scheduler, or another orchestrator when the work is:

- multi-system
- dependency-driven
- shell or Python heavy
- cloud-API heavy
- part of an end-to-end data pipeline

Typical examples:

- SQL Server plus object storage plus warehouse replication
- Python ETL scripts
- GCP SDK operations
- DAG-style workflows with retries and dependency graphs

| Task pattern | Better owner |
|---|---|
| SQL Server backup or integrity check | Agent |
| Multi-step data pipeline | Airflow or another orchestrator |
| Host-level cleanup script | cron or host scheduler |
| Cloud API automation | External orchestrator or cloud-native scheduler |

---

## Related

- [[server-configuration]] for the current `Agent XPs` and related instance settings
- [[backup-types-and-strategy]] for one of the most common job types Agent should own
- [[sqlcmd-connection-and-usage]] for shell-driven alternatives when Agent is not the right scheduler
