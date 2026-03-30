---
type: reference
category: observability
technology: [datadog, sql-server, t-sql]
tags: [monitoring, observability, sql, datadog]
aliases: [Custom SQL Metrics, Datadog custom_queries, DMV metrics]
keywords: [datadog custom queries, custom_queries, sqlserver, DMV, dm_exec_sessions, dm_os_performance_counters, connections by login, deadlock count, monotonic_count, gauge, tag column, metric prefix, sqlserver prefix]
description: "How to configure custom SQL Server DMV queries in the Datadog SQL Server integration to track connections by login and deadlock counts as custom metrics."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Custom SQL Server Metric Queries

> [!quote]
> "Not everything that counts can be counted, and not everything that can be counted counts."
> — **William Bruce Cameron**

Custom queries let you track application-specific metrics from SQL Server DMVs. They are defined in `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` under the `custom_queries` key within the instance block.

> [!warning] Metric Name Prefix
> The Datadog SQL Server integration automatically prepends `sqlserver.` to all custom query column names. To avoid a double prefix like `sqlserver.sqlserver.xyz`, name your columns **without** the `sqlserver.` prefix — e.g., `connections.by_login` becomes `sqlserver.connections.by_login` in Datadog.

---

## Query 1: Connections by Login Name

Tracks who is connected to SQL Server and from which application, tagged by `login_name` and `program_name`.

```yaml
custom_queries:
  - query: >
      SELECT login_name, program_name, COUNT(*) AS connections
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1
      GROUP BY login_name, program_name
    columns:
      - name: login_name
        type: tag
      - name: program_name
        type: tag
      - name: connections.by_login
        type: gauge
    tags:
      - query:custom_connections
```

**Metric in Datadog:** `sqlserver.connections.by_login` (gauge, tagged by `login_name` and `program_name`).

#### Expected idle values

| Login | Count | Source |
|-------|-------|--------|
| `sa` | 5-13 | Blazor dashboard connection pool + any SSMS sessions |
| `dd_agent` | 1 | Datadog agent polling |
| `nt_authority_system` | 1 | SQL Server internal |

Higher `sa` counts during active SSMS sessions are normal. Persistent high counts from unexpected logins warrant investigation.

---

### Query 2: SQL Server Deadlock Count Metric

Reads the cumulative deadlock counter from SQL Server's performance counters DMV. Uses `monotonic_count` type so Datadog reports the **rate of change** (deadlocks per collection interval) rather than the ever-increasing total.

```yaml
  - query: >
      SELECT
        cntr_value AS deadlock_count
      FROM sys.dm_os_performance_counters
      WHERE counter_name = 'Number of Deadlocks/sec'
        AND instance_name = '_Total'
    columns:
      - name: deadlocks.total
        type: monotonic_count
    min_collection_interval: 15
```

**Metric in Datadog:** `sqlserver.deadlocks.total` (monotonic_count, collected every 15 seconds).

> [!info] Why monotonic_count
>
> `sys.dm_os_performance_counters.cntr_value` for deadlocks is a cumulative counter — it only ever increases. Using `monotonic_count` tells Datadog to compute the delta between collections, giving you deadlocks-per-interval rather than a raw ever-growing number. This is what enables the deadlock alert monitor to trigger on **new** deadlocks.

---

### Full custom_queries Config Reference

Complete `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` with both custom queries:

```yaml
init_config:

instances:
  - host: localhost,1433
    username: dd_agent
    password: 'Dd@g3nt!Monitor'
    connector: odbc
    driver: '{ODBC Driver 18 for SQL Server}'
    connection_string: 'TrustServerCertificate=yes'
    tags:
      - env:prod
      - service:data-pipeline-sql
    custom_queries:
      - query: >
          SELECT login_name, program_name, COUNT(*) AS connections
          FROM sys.dm_exec_sessions
          WHERE is_user_process = 1
          GROUP BY login_name, program_name
        columns:
          - name: login_name
            type: tag
          - name: program_name
            type: tag
          - name: connections.by_login
            type: gauge
        tags:
          - query:custom_connections
      - query: >
          SELECT
            cntr_value AS deadlock_count
          FROM sys.dm_os_performance_counters
          WHERE counter_name = 'Number of Deadlocks/sec'
            AND instance_name = '_Total'
        columns:
          - name: deadlocks.total
            type: monotonic_count
        min_collection_interval: 15
```

---

### Applying Custom Query Config Changes

```bash
# Restart the agent to pick up config changes
sudo systemctl restart datadog-agent

# Wait a few seconds, then verify queries execute without errors
sudo datadog-agent check sqlserver 2>&1 | grep -i "deadlock|connections"

# If custom metrics don't appear, check for YAML syntax issues
sudo cat -A /etc/datadog-agent/conf.d/sqlserver.d/conf.yaml | head -40
# Tabs (^I) in YAML will silently break parsing — use spaces only
```

> [!tip] Custom Query Not Appearing
> If `sudo datadog-agent check sqlserver` shows built-in metrics but not custom ones, and there are no errors in the logs, restart the agent (`sudo systemctl restart datadog-agent`) and retry. Custom queries sometimes require a full restart to initialize, not just a config reload.

> [!tip] New Metrics in Datadog UI
> After deploying a new custom metric, Datadog won't show it in dropdown menus until the first data point arrives. If the metric doesn't appear in the UI, wait 1-2 minutes or press `Ctrl+Shift+R` to hard-refresh the browser.

---

### Datadog Column Type Reference for custom_queries

| Type | Use for | Datadog behavior |
|------|---------|-----------------|
| `tag` | Dimension columns (login name, database name) | Attached as tags to the metric, not reported as a value |
| `gauge` | Point-in-time values (connection count, ratio) | Reports current value, can go up and down |
| `monotonic_count` | Cumulative counters (deadlocks, errors) | Reports delta between collections (rate) |
| `rate` | Already-rate counters | Divides by time interval |

---

## Related

- [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration) — Base integration config that hosts these queries
- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — Agent management and restart commands
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Dashboard widgets consuming these custom metrics
- [datadog-alerting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-alerting) — Deadlock alert monitor using `sqlserver.deadlocks.total`
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — Raw DMV queries for manual investigation
