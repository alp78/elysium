---
title: "08 - Datadog Custom Queries"
tags: [monitoring, observability, sql, datadog]
aliases: [Custom SQL Metrics, Datadog custom_queries, DMV metrics]
description: "How to configure custom SQL Server DMV queries in the Datadog SQL Server integration to track connections by login and deadlock counts as custom metrics."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Custom Queries

> [!quote]+
> "Not everything that counts can be counted, and not everything that can be counted counts."
>
> — **William Bruce Cameron**, *Informal Sociology* (1963)

> [!abstract]- Summary
>
> This note extends the SQL Server integration beyond its built-in counters by teaching Datadog how to run targeted SQL queries and convert the result sets into custom metrics, which is how the platform exposes deadlocks, connection breakdowns, and other project-specific signals that the stock integration does not publish on its own.
>
> **Custom metric patterns**
> - Starts with concrete query patterns for connections by login and deadlock count, showing how SQL rowsets become Datadog metrics.
> - Uses those examples to demonstrate when custom queries are worth the extra configuration overhead.
>
> **Configuration schema**
> - Documents the full `custom_queries` structure, including metric naming, column handling, and query blocks inside the SQL Server integration file.
> - Keeps the focus on the translation layer between SQL results and Datadog metric types.
>
> **Apply and validate**
> - Covers the restart-and-verify cycle after configuration edits and calls out YAML formatting mistakes that silently break collection.
> - Makes the validation path explicit so custom metric failures are debugged from the host outward.
>
> **Type system**
> - Ends with the Datadog column type reference that controls how query outputs are interpreted as gauges, tags, or other metric fields.
> - When to use: built-in SQL Server metrics are healthy, but an operationally important question still lacks a first-class Datadog metric.

> [!note]- Glossary
>
> **custom query**
> - A SQL statement executed by the Datadog integration to emit metrics from the returned data.
> - It matters here because this is the extension mechanism for database signals that the default check does not expose.
>
> > [!info] Gap-filling mechanism
> >
> > Custom queries should answer a specific monitoring gap, not duplicate metrics Datadog already collects.
>
> ---
>
> **`custom_queries` block**
> - The integration config section that defines one or more SQL queries and how their outputs map into metrics.
> - It matters here because the entire custom-metric contract lives in this structure.
>
> > [!tip] Config is the mapping layer
> >
> > The query result alone is not enough; Datadog also needs the schema that explains what each returned column means.
>
> ---
>
> **metric name**
> - The Datadog identifier assigned to a numeric output from a custom query.
> - It matters here because stable metric names make dashboards and monitors durable over time.
>
> > [!info] Name for reuse
> >
> > A metric name should describe the signal, not the implementation detail of the SQL that produced it.
>
> ---
>
> **column type**
> - The Datadog declaration that tells the integration whether a returned column is a gauge, tag, or another supported field type.
> - It matters here because one bad type mapping can turn a valid result set into unusable telemetry.
>
> > [!tip] Schema drives meaning
> >
> > Datadog needs both the value and the semantic role of each column before it can index the result correctly.
>
> ---
>
> **tag column**
> - A query column whose values become metric tags rather than numeric datapoints.
> - It matters here because dimensions like login name are useful for breakdowns but are not themselves measures.
>
> > [!info] Dimension, not value
> >
> > Use tags for slicing and grouping; use metrics for counting or measuring.
>
> ---
>
> **agent restart**
> - The required reload step after editing the integration file that contains the custom query definitions.
> - It matters here because Datadog does not pick up new query blocks from disk automatically.
>
> > [!tip] Reload the collector
> >
> > If a new custom metric never appears, confirm the agent restarted before questioning the SQL.
>
> ---
>
> **YAML indentation**
> - The whitespace structure that determines nesting and validity inside the Datadog config file.
> - It matters here because malformed indentation or tabs can invalidate the custom query config without obvious SQL errors.
>
> > [!info] Formatting can break telemetry
> >
> > A syntactically correct SQL query still fails operationally if the YAML wrapper around it is malformed.
>
> ---
>
> **deadlock metric**
> - A custom metric that counts SQL Server deadlock events for monitoring and alerting.
> - It matters here because deadlocks are a concrete example of a high-value signal often implemented through custom query logic.
>
> > [!tip] Custom metrics should be actionable
> >
> > Choose extensions that feed real dashboards or alerts, not just interesting-but-unused measurements.

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
- [essential-dba-queries](https://alp78.github.io/elysium/04-Databases/01-SQL-Server/01-Server-Operations/essential-dba-queries) — Raw DMV queries for manual investigation
