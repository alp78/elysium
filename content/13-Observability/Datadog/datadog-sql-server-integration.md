---
type: reference
category: observability
technology: [datadog, sql-server]
tags: [monitoring, observability, sql, datadog]
aliases: [SQL Server Integration, sqlserver check, Datadog SQL integration]
keywords: [datadog, sql server integration, sqlserver check, odbc, odbc driver 18, conf.yaml, dd_agent, connections, buffer pool, waits, batch requests, page life expectancy, DMV, TrustServerCertificate, custom_queries]
description: "Complete configuration reference for the Datadog SQL Server integration on the example SQL VM — connection setup, ODBC driver, and the full conf.yaml with custom queries."
related:
  - datadog-agent-sql-vm
  - datadog-custom-queries
  - datadog-dashboards
  - datadog-log-management
  - server-configuration
  - essential-dba-queries
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog SQL Server Integration

The Datadog SQL Server integration (`sqlserver` check) connects to SQL Server using ODBC and collects built-in metrics from DMVs — connections, buffer pool stats, lock waits, batch requests, and query statistics. It runs on the [[datadog-agent-sql-vm|SQL VM agent]] as a scheduled check every 15 seconds. Many of these metrics automate the same health checks you would run manually with [[essential-dba-queries]], but with continuous collection and alerting instead of ad-hoc diagnosis.

---

## Integration Config File

Written to `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml`:

#### Minimal config (integration only, no custom queries)

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
```

**Full config with custom queries** — see [[datadog-custom-queries]] for the complete file including both custom query blocks.

---

### SQL Server Integration Connection Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `host` | `localhost,1433` | Comma-separated host and port (not colon) — SQL Server ODBC convention |
| `connector` | `odbc` | Uses the system ODBC driver manager |
| `driver` | `{ODBC Driver 18 for SQL Server}` | Must be installed via `msodbcsql18` package |
| `connection_string` | `TrustServerCertificate=yes` | Required for self-signed dev certificate on SQL Server 2022 Developer edition |
| `username` / `password` | `dd_agent` | Read-only login with `VIEW SERVER STATE` — see [[datadog-agent-sql-vm]] |

> [!warning] TrustServerCertificate
> SQL Server 2022 uses a self-signed certificate by default. Without `TrustServerCertificate=yes`, the ODBC driver will refuse to connect. Do not use this in production environments with real certificates — instead, configure a proper certificate and remove this setting. See [[server-configuration]] for the full SQL Server instance setup including certificate and network configuration.

---

### Built-in SQL Server Metrics Collected by Datadog

The integration automatically collects these metric groups from SQL Server DMVs:

| Metric | Description |
|--------|-------------|
| `sqlserver.stats.connections` | Total active connections |
| `sqlserver.stats.batch_requests` | Batch requests per second (overall throughput) |
| `sqlserver.stats.lock_waits` | Lock waits per second — correlates with [[wait-stats-analysis|wait types]] like `LCK_M_*` |
| `sqlserver.buffer.cache_hit_ratio` | Buffer cache hit ratio (%) — target > 99% |
| `sqlserver.buffer.page_life_expectancy` | Seconds a page stays in buffer pool — target > 300 |
| `sqlserver.buffer.checkpoint_pages` | Checkpoint pages flushed per second |
| `sqlserver.buffer.pool_size` | Buffer pool size in pages |

> [!tip] Buffer Cache Hit Ratio
> Should stay above 99%. Drops below 95% indicate memory pressure — SQL Server is reading from disk instead of RAM. See [[essential-dba-queries]] for DMV queries to diagnose memory pressure.

> [!tip] Page Life Expectancy
> Higher is better. Drops below 300 seconds indicate memory pressure and frequent page evictions from the buffer pool.

---

> [!danger] dd_agent Login Must Have VIEW SERVER STATE -- Without It Metrics Are Silently Empty
> If the `dd_agent` SQL login lacks `VIEW SERVER STATE` permission, the Datadog agent connects successfully but returns zero values for most metrics (connections, buffer pool, waits). The agent logs no error -- it simply reports `0` for every DMV-backed metric. Always verify with `SELECT HAS_PERMS_BY_NAME(null, null, 'VIEW SERVER STATE')` from the `dd_agent` session.

### Verifying the SQL Server Integration

```bash
# Check SQL Server integration status
sudo datadog-agent check sqlserver

# Check integration status in the full status output
sudo datadog-agent status | grep -A 10 "Integrations" | grep -A 5 "sqlserver"
```

Expected: `Status: OK` with metric counts listed.

---

### Restarting After SQL Server Config Changes

```bash
# Restart the agent to pick up config changes
sudo systemctl restart datadog-agent

# Wait a few seconds, then verify
sudo datadog-agent check sqlserver 2>&1 | grep -i "error|ok|instance"
```

> [!warning] YAML Tabs
> YAML does not allow tab characters. If the config file was edited in an editor that inserted tabs, the agent will silently fail to load it. Check with:
> ```bash
> sudo cat -A /etc/datadog-agent/conf.d/sqlserver.d/conf.yaml | head -40
> ```
> Tabs appear as `^I`. Replace all with spaces.

---

## Related

- [[datadog-agent-sql-vm]] — How the agent is installed and managed
- [[datadog-custom-queries]] — Adding custom DMV metric queries to this config
- [[datadog-log-management]] — Separate config for SQL Server errorlog collection
- [[datadog-dashboards]] — Dashboard widgets using these metrics
- [[essential-dba-queries]] — DMV queries for manual SQL Server health checks
- [[server-configuration]] — SQL Server VM setup and configuration
