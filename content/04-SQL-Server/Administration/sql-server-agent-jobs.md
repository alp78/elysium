---
title: "SQL Server Agent Jobs"
tags:
  - sql-server
  - tsql
  - administration
  - scheduling
  - agent
  - cdc
  - airflow
  - gcp
aliases: [SQL Server Agent, Agent Jobs, Job Scheduling, Task Scheduling SQL Server]
description: "SQL Server Agent job scheduling — enabling on Linux, creating jobs, built-in CDC/backup agents, and a complete comparison of all five job triggering methods in the GCP + SQL Server + Airflow stack."
created: 2026-03-29
updated: 2026-03-29
status: complete
---

# SQL Server Agent Jobs — Built-In Task Scheduling

> [!quote]
> "If you're doing something more than once, automate it. The first rule of ops is: never do manually what a scheduled job can do for you."
>
> — **Tom Limoncelli**, *The Practice of System and Network Administration*

SQL Server Agent is the native job scheduler built into SQL Server. It runs maintenance tasks, CDC log readers, backup schedules, and custom ETL steps. On Linux, it requires explicit enabling. Understanding when to use Agent vs [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) vs cron is essential for a clean operations architecture.

---

## SQL Server Agent on Linux — Enabling and Configuring

### mssql-conf set sqlagent.enabled — enable Agent on Linux

> [!info] Agent is Disabled by Default
>
> SQL Server on Linux ships with Agent disabled. You must explicitly enable it and restart the service. Without Agent, CDC log reader jobs, backup schedules, and index maintenance jobs will not run.

```bash
# Enable SQL Server Agent
sudo /opt/mssql/bin/mssql-conf set sqlagent.enabled true

# Restart SQL Server (required for the change to take effect)
sudo systemctl restart mssql-server

# Verify Agent is running
sudo systemctl status mssql-server
```

#### SELECT syssubsystems — verify Agent subsystems are loaded

```sql
-- Should return rows for T-SQL and CmdExec subsystems
SELECT subsystem, description_id, agent_exe
FROM msdb.dbo.syssubsystems;
```

> [!warning] Agent on Linux limitations
>
> SQL Server Agent on Linux supports only T-SQL and CmdExec (bash) job steps. No SSIS packages, no PowerShell, no ActiveX scripts. If your job needs Python, .NET, or GCP SDK calls — it does not belong in Agent.

> [!success] Use Airflow for Non-T-SQL Automation
>
> If a task requires Python, GCP SDK calls, or multi-system coordination, move it to Airflow. Airflow's `BashOperator` can call any shell script, `PythonOperator` runs Python directly, and `MsSqlOperator` executes T-SQL — covering everything Agent supports and more, with dependency tracking and alerting.

### Docker Environment Variable — Agent in containers

> [!info] Docker Configuration
>
> For containerized SQL Server (e.g., on Cloud Run or local dev), set the environment variable at container startup.

```bash
docker run -e "ACCEPT_EULA=Y" \
    -e "MSSQL_SA_PASSWORD=YourPassword" \
    -e "MSSQL_AGENT_ENABLED=true" \
    -p 1433:1433 \
    mcr.microsoft.com/mssql/server:2022-latest
```

---

## Agent Architecture

### Jobs, Steps, Schedules, Operators — the four components

> [!info] Agent Object Model
>
> Every Agent job has four components. All metadata lives in the `msdb` database — querying `msdb` is how you monitor and debug Agent.

- **Job:** a named unit of work (e.g., "Nightly Backup")
- **Step:** one action within a job (T-SQL script, bash command). Jobs can have multiple steps with success/failure routing
- **Schedule:** when the job runs (cron-like syntax: daily, weekly, every N minutes)
- **Operator:** who to notify on success/failure (email via Database Mail)

---

## Creating and Managing Jobs

### sp_add_job + sp_add_jobstep — create a maintenance job

> [!info] Job Creation DDL
>
> Use the `sp_add_*` stored procedures to create jobs programmatically. This is the pattern for all maintenance jobs — backups, index rebuilds, statistics updates.

```sql
-- Create the job
EXEC msdb.dbo.sp_add_job
    @job_name = N'Weekly Index Maintenance',
    @enabled = 1,
    @description = N'Rebuild fragmented indexes on silver and gold schemas';

-- Add a T-SQL step
EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'Weekly Index Maintenance',
    @step_name = N'Rebuild silver indexes',
    @subsystem = N'TSQL',
    @command = N'
        ALTER INDEX ALL ON silver.index_dim REBUILD
            WITH (ONLINE = ON, MAXDOP = 2);
        ALTER INDEX ALL ON silver.signals_daily REBUILD
            WITH (ONLINE = ON, MAXDOP = 2);
    ',
    @database_name = N'analytics_db';
```

### sp_add_schedule — schedule the job

```sql
-- Run every Sunday at 03:00
EXEC msdb.dbo.sp_add_schedule
    @schedule_name = N'Weekly Sunday 3am',
    @freq_type = 8,            -- weekly
    @freq_interval = 1,        -- Sunday
    @active_start_time = 030000;   -- 03:00:00

-- Attach schedule to job
EXEC msdb.dbo.sp_attach_schedule
    @job_name = N'Weekly Index Maintenance',
    @schedule_name = N'Weekly Sunday 3am';

-- Assign to local server
EXEC msdb.dbo.sp_add_jobserver
    @job_name = N'Weekly Index Maintenance';
```

### Nightly Backup Job — full DDL example

> [!info] Automated Backup Job
>
> See [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) for backup theory and the 3-2-1 rule. This job automates the nightly full backup.

```sql
EXEC msdb.dbo.sp_add_job @job_name = N'Nightly Full Backup';

EXEC msdb.dbo.sp_add_jobstep
    @job_name = N'Nightly Full Backup',
    @step_name = N'Backup analytics_db',
    @subsystem = N'TSQL',
    @command = N'
        BACKUP DATABASE analytics_db
        TO DISK = N''/var/opt/mssql/backup/analytics_db_full.bak''
        WITH INIT, COMPRESSION, CHECKSUM;
    ',
    @database_name = N'master';

EXEC msdb.dbo.sp_add_schedule
    @schedule_name = N'Nightly 2am',
    @freq_type = 4,
    @freq_interval = 1,
    @active_start_time = 020000;

EXEC msdb.dbo.sp_attach_schedule
    @job_name = N'Nightly Full Backup',
    @schedule_name = N'Nightly 2am';

EXEC msdb.dbo.sp_add_jobserver
    @job_name = N'Nightly Full Backup';
```

### Viewing Job History — msdb.dbo.sysjobhistory

#### SELECT sysjobhistory — check recent job execution results

```sql
-- Recent job history (last 7 days)
SELECT j.name AS job_name,
       h.step_name,
       h.run_status,       -- 0=Failed, 1=Succeeded, 2=Retry, 3=Canceled
       h.run_date,
       h.run_time,
       h.run_duration,     -- HHMMSS format
       h.message
FROM msdb.dbo.sysjobhistory h
JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
WHERE h.run_date >= CONVERT(INT, CONVERT(VARCHAR(8), DATEADD(DAY, -7, GETDATE()), 112))
ORDER BY h.run_date DESC, h.run_time DESC;
```

### Monitoring Running Jobs — sp_help_jobactivity

```sql
-- Currently running jobs
EXEC msdb.dbo.sp_help_jobactivity;
```

---

## Built-In Agent Jobs (Created by Other Features)

### CDC, Backup, and AG Jobs — what Agent runs automatically

> [!warning] Don't Disable These Jobs
>
> These jobs are created automatically by SQL Server features. Disabling or deleting them breaks the feature they support.

> [!success] Verify Built-In Jobs Are Running After Every Restart
>
> Add a post-restart check to your runbook: `SELECT name, enabled FROM msdb.dbo.sysjobs WHERE name LIKE 'cdc%' OR name LIKE '%backup%';` — all built-in CDC and backup jobs must show `enabled = 1`. If any are disabled, re-enable them with `EXEC msdb.dbo.sp_update_job @job_name = N'...', @enabled = 1;`.

| Feature | Jobs Created | What Happens If Stopped |
|---------|-------------|------------------------|
| CDC (`sp_cdc_enable_db`) | CDC log reader, CDC cleanup | Changes accumulate in transaction log → log fills up |
| Log Shipping | Copy job, Restore job | Secondary database falls behind, DR gap grows |
| Availability Groups | AG health check | AG monitoring goes blind, failover detection delayed |

- **CDC log reader:** reads the transaction log and populates `cdc.*` change tables. See [sql-server-change-tracking > Change Data Capture (CDC)](https://alp78.github.io/elysium/04-SQL-Server/Patterns/sql-server-change-tracking#change-data-capture-cdc) for CDC details
- **CDC cleanup:** purges change table rows older than the configured retention. Without it, change tables grow unbounded
- **Monitor with:** `SELECT * FROM msdb.dbo.cdc_jobs;` to check CDC job status

---

## Job Triggering in the GCP + SQL Server Stack

This is the most important section of the page. Five different ways to trigger work exist in this stack. Each has a legitimate use case. Using the wrong one creates operational confusion, split ownership, and debugging nightmares.

### The Five Triggering Methods — Full Comparison

> [!info] Triggering methods in the stack
>
> Each method has different strengths. The comparison below covers not just what they CAN do, but what they SHOULD do given the rest of the stack.

| Method | Where It Runs | Trigger Types | Retry | Dependencies | Observability |
|--------|---------------|---------------|-------|-------------|---------------|
| **SQL Server Agent** | Inside SQL Server | Schedule, Alert, T-SQL | Basic (retry count) | None (flat list) | msdb + Datadog |
| **Linux cron** | VM OS | Schedule only | None | None | syslog |
| **Airflow** | Airflow VM | Schedule, API, sensor, dataset | Full (exp. backoff) | DAG dependencies | Airflow UI + Datadog |
| **Cloud Scheduler + Cloud Run** | GCP serverless | Schedule, Pub/Sub, HTTP | Built-in | Via Pub/Sub | Cloud Logging |
| **Cloud Functions** | GCP serverless | Pub/Sub, Firestore, HTTP, GCS | Built-in | Event-driven only | Cloud Logging |

### When to Use Each — Scenario-Based Decision

> [!tip] The ownership principle
>
> Each job has exactly ONE owner. If you can't immediately answer "who is responsible for this job?" — you have an ownership problem. The decision framework below assigns ownership clearly.

**SQL Server Agent — things only SQL Server can do:**

- CDC log reader and cleanup (Agent owns these — created by `sp_cdc_enable_db`)
- Nightly `BACKUP DATABASE` to local disk (the backup command is SQL Server-internal)
- Weekly `ALTER INDEX REBUILD` / `UPDATE STATISTICS` (must run inside SQL Server)
- Database mail alerts on error conditions
- Any T-SQL job that MUST run even if Airflow is down

**Linux cron — OS-level tasks unrelated to SQL Server or pipelines:**

- Log rotation (`logrotate`, `find -mtime +30 -delete`)
- Disk space monitoring scripts
- `gcloud` snapshot automation (if not Terraformed)
- `certbot` TLS certificate renewal

> [!warning] cron is invisible
>
> cron has no UI, no alerting, no retry, no dependency management. A failed cron job disappears into syslog. Use cron only for tasks where failure is obvious (disk fills up) or non-critical (cleanup). Never use cron for pipeline-critical tasks.

> [!success] Make cron Failures Visible
>
> For any cron job that must not silently fail, add a notification line: `your-script.sh || echo "FAILURE: script failed at $(date)" | mail -s "cron alert" ops@company.com`. For pipeline-critical tasks, move the job to Airflow instead — even a single-task DAG gives you retry, logging, and a visible failure state in the UI.

**Airflow — anything that orchestrates multiple systems or needs dependencies:**

This is the primary orchestrator in the stack. [Airflow](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) owns:

- Bronze loading pipelines (fetch from yfinance → load to SQL Server)
- Silver/gold transforms (trigger Python scripts that read/write SQL Server)
- Cross-system workflows (SQL Server → BigQuery replication, SQL Server → Firestore sync)
- dbt runs (`BashOperator` or `DbtCloudRunJobOperator`)
- Any multi-step process where step 2 depends on step 1 succeeding
- Any job that needs alerting, SLA monitoring, or retry with backoff

> [!danger] Do not split pipeline ownership
>
> If Airflow loads bronze and Agent runs silver transforms, you have TWO systems to debug when the pipeline fails. One person checks the Airflow UI and sees green. Another checks Agent history and sees red. Neither sees the full picture. Rule: if a task is PART of a pipeline, Airflow owns it — even if the task itself is a T-SQL script. Airflow can execute T-SQL via `MsSqlOperator` or by calling a Python script that uses pyodbc.

> [!success] Consolidate Pipeline Steps in Airflow
>
> If you have Agent jobs that are part of the pipeline (silver transforms, statistics updates after load), migrate them to Airflow tasks in the same DAG. Use `MsSqlOperator` or a `PythonOperator` calling pyodbc. The Agent jobs can remain for non-pipeline maintenance (CDC, backup, index rebuild), but the pipeline chain must be a single unbroken Airflow DAG.

**Cloud Scheduler + Cloud Run — serverless batch tasks outside the pipeline:**

- Lightweight periodic jobs that run a Docker container (e.g., a Python script that checks an API)
- Tasks that must run even if the Airflow VM is stopped (cost-saving weekends)
- Jobs that scale to zero between runs (no idle VM cost)
- HTTP-triggered tasks that other GCP services need to invoke

```bash
# Cloud Scheduler → Pub/Sub → Cloud Run Job
gcloud scheduler jobs create pubsub nightly-export \
    --schedule="0 2 * * *" \
    --topic=pipeline-triggers \
    --message-body='{"task": "export-to-bigquery"}' \
    --time-zone="Europe/Prague"
```

> [!tip] Cloud Run vs Airflow for batch jobs
>
> Cloud Run Jobs are cheaper for infrequent, isolated tasks (runs 5 minutes once a day = pennies). But they have no dependency graph — if task B depends on task A, you need to wire that yourself via Pub/Sub or Workflows. If you already have Airflow running, just add a task to the DAG. Cloud Run Jobs shine for jobs OUTSIDE the main pipeline — monitoring scripts, cleanup routines, one-off data exports.

**Cloud Functions — event-driven reactions, not scheduled work:**

- Firestore trigger: stock metadata changes → Cloud Function → rebuild a cache
- Pub/Sub trigger: CDC message arrives → Cloud Function → write to BigQuery
- GCS trigger: new file lands in bucket → Cloud Function → notify Airflow
- HTTP trigger: external webhook → Cloud Function → insert into SQL Server

```python
# Cloud Function triggered by Firestore document change
@functions_framework.cloud_event
def on_stock_update(cloud_event):
    """Triggered when a document in 'stocks' collection changes."""
    data = cloud_event.data
    symbol = data["value"]["fields"]["symbol"]["stringValue"]
    sector = data["value"]["fields"]["sector"]["stringValue"]

    # Push to Pub/Sub for downstream consumers
    publisher = pubsub_v1.PublisherClient()
    topic = publisher.topic_path("my-project", "dimension-changes")
    publisher.publish(topic, json.dumps({
        "symbol": symbol, "sector": sector
    }).encode("utf-8"))
```

> [!warning] Cloud Functions are not orchestrators
>
> Cloud Functions react to events. They don't manage dependencies, retries with backoff, or SLAs. If a Function fails, it retries (or doesn't, depending on trigger type) — but nobody gets paged. Use Functions as the glue between events, not as pipeline steps.

> [!success] Wire Cloud Functions to Pub/Sub Alerting
>
> For any Cloud Function doing important work (writing to SQL Server, publishing to downstream topics), add a dead-letter topic and a Cloud Monitoring alert on the DLQ message count. This gives visibility when Functions fail silently. For multi-step logic, use Cloud Workflows or move the orchestration to Airflow.

### The Architecture Diagram

> [!info] Job triggering architecture
>
> Each system has a clear lane. Overlap between lanes is where incidents happen.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Job Triggering Architecture                   │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ SQL Server   │  Agent: CDC, backups, index maintenance       │
│  │ Agent        │  (things only SQL Server can do)              │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │ Airflow      │────►│ SQL Server   │────►│ BigQuery     │    │
│  │ (DAGs)       │     │ (pyodbc)     │     │ (bq client)  │    │
│  │              │────►│ dbt run      │────►│ Firestore    │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│   Primary orchestrator for all pipeline tasks                   │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │ Cloud        │────►│ Cloud Run    │  Serverless batch tasks  │
│  │ Scheduler    │     │ Jobs         │  outside the pipeline    │
│  └──────────────┘     └──────────────┘                         │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │ Firestore /  │────►│ Cloud        │  Event-driven reactions  │
│  │ Pub/Sub /    │     │ Functions    │  (glue, not pipeline)    │
│  │ GCS triggers │     └──────────────┘                         │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Linux cron   │  OS tasks: log rotation, disk cleanup         │
│  └──────────────┘  (not pipeline, not SQL Server)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns in Job Triggering

> [!danger] Job triggering anti-patterns
>
> Each of these has been seen in production. Each one caused an incident.

> [!success] Apply the One-Orchestrator Rule
>
> Audit your current job inventory: list every scheduled task (Agent, cron, Airflow, Cloud Scheduler) in a single spreadsheet with its owner, trigger, and dependencies. Any pipeline task not in Airflow is a candidate for migration. Any cron job touching the database is a candidate for Agent or Airflow. Resolve ambiguity before the next incident — not during it.

- **Pipeline steps split between Agent and Airflow:** bronze loads in Airflow, silver transforms in Agent. When silver fails, the Airflow DAG shows green. Nobody notices for days. Rule: entire pipeline in ONE orchestrator
- **cron for pipeline-critical tasks:** cron has no alerting, no retry, no UI. A cron job failing at 3am is invisible until the dashboard shows stale data the next morning
- **Cloud Functions as pipeline steps:** Functions are stateless, have 9-minute timeout (gen1) or 60-minute (gen2), and have no dependency graph. A five-step pipeline in Cloud Functions is five independent retry-or-fail endpoints with no coordination
- **Agent jobs calling external APIs:** Agent CmdExec steps running `curl` or `python3` scripts that call GCP APIs. If the script fails, Agent logs show "step failed" with no detail. Move the script to Airflow where logs are first-class and retries are configurable
- **Overlapping schedules:** Agent backup at 02:00, Airflow index rebuild at 02:05, cron disk cleanup at 02:10. All compete for disk I/O on the same VM. Stagger schedules and document them in a single schedule registry

---

## Monitoring Agent Jobs from GCP

### SQL Server → Cloud Logging → Datadog

> [!info] Agent Observability
>
> SQL Server Agent writes job results to `msdb.dbo.sysjobhistory`. Forward these to GCP Cloud Logging via the SQL Server error log, then to Datadog for unified alerting.

- **Agent job failures** appear in the SQL Server error log → captured by Cloud Logging agent → visible in Cloud Logging console
- **Datadog SQL Server integration** monitors agent job status natively: `sqlserver.agent.job.failed` metric
- **Custom alerting:** query `sysjobhistory` for `run_status = 0` (failed) and push to Pub/Sub for alerting

#### SELECT failed jobs — alert query for monitoring

```sql
-- Failed jobs in the last 24 hours
SELECT j.name, h.step_name, h.message, h.run_date, h.run_time
FROM msdb.dbo.sysjobhistory h
JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
WHERE h.run_status = 0
  AND h.run_date >= CONVERT(INT, CONVERT(VARCHAR(8), DATEADD(DAY, -1, GETDATE()), 112));
```

---

## Agent Job Anti-Patterns

### Running ETL in Agent When Airflow Should Own It

Agent has no dependency management. If your transform_silver job depends on load_bronze completing first, Agent can't express that dependency. You end up with fragile time-based scheduling ("run silver 30 minutes after bronze") that breaks when bronze takes longer than expected. Use Airflow for anything with dependencies.

### No Alerting on Job Failures

Agent jobs fail silently by default — the result goes into `sysjobhistory` but nobody is notified. Configure Database Mail + Operators, or forward failures to Cloud Logging. A job that fails silently for weeks is worse than a job that doesn't exist.

### CmdExec Steps with Hardcoded Paths

Agent CmdExec steps with `/home/alex/scripts/backup.sh` break on VM migration, OS upgrade, or user change. Use full paths from environment variables or store scripts in a well-known location (`/opt/mssql/scripts/`).

### Scheduling Overlapping Resource-Intensive Jobs

Agent backup at 02:00 and Airflow pipeline at 02:05 both hit the same disk. The backup holds locks on data files while the pipeline tries to write. Stagger schedules with at least 30-minute gaps between resource-intensive jobs, and document all schedules in a single registry (spreadsheet, Confluence page, or Terraform config).
