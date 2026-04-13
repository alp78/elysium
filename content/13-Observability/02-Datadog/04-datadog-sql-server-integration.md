---
title: "04 - Datadog SQL Server Integration"
tags: [monitoring, observability, sql, datadog]
aliases: [SQL Server Integration, sqlserver check, Datadog SQL integration]
description: "Complete configuration reference for the Datadog SQL Server integration on the example SQL VM — connection setup, ODBC driver, and the full conf.yaml with custom queries."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog SQL Server Integration

> [!quote]
> "Monitoring tells you whether a system is working, observability lets you ask why it isn't working."
>
> — **Baron Schwartz**

> [!abstract]- Summary
>
> This note narrows from the SQL VM host agent to the SQL Server check itself: the agent already runs on the host, but the actual database telemetry only appears once the `sqlserver.d/conf.yaml` file defines the target instance, credentials, and collection behavior for the engine-level metrics.
>
> **Configuration contract**
> - Shows the integration config file and the connection parameters that tell the host agent how to reach the local SQL Server instance.
> - Separates engine-monitoring configuration from the broader host-agent bootstrap so each layer stays easy to reason about.
>
> **Built-in metric surface**
> - Lists the built-in SQL Server metrics that Datadog collects out of the box, such as connections, waits, buffer pool indicators, and other server-health counters.
> - Makes clear where the default integration is sufficient and where custom queries are needed later.
>
> **Verification workflow**
> - Uses the agent status output and related checks to confirm that the SQL integration is running and reporting rather than merely installed on disk.
> - Keeps the verification step local first so configuration errors are caught before dashboard queries are debugged.
>
> **Restart discipline**
> - Covers the required restart after config edits and the follow-up validation path that proves the change was actually loaded.
> - When to use: the agent is already present on the SQL VM and the next task is to enable or adjust SQL Server telemetry itself.

> [!note]- Glossary
>
> **SQL Server integration**
> - The Datadog check that connects to SQL Server and emits engine-specific metrics through the local agent.
> - It matters here because host installation alone does not create database observability.
>
> > [!info] Service telemetry layer
> >
> > The host agent is the transport; the SQL integration is the domain-specific collector.
>
> ---
>
> **`sqlserver.d/conf.yaml`**
> - The Datadog integration file that defines how the SQL Server check should connect and what it should collect.
> - It matters here because this file is the real contract between the agent and the database engine.
>
> > [!info] Integration owns behavior
> >
> > If SQL metrics are wrong or missing, this file is the first place to inspect.
>
> ---
>
> **instance block**
> - The config section that describes one monitored SQL Server target with its host, port, and credentials.
> - It matters here because Datadog can only collect from instances that are explicitly declared.
>
> > [!tip] Explicit targets
> >
> > A running agent never guesses database endpoints; every monitored instance must be named in config.
>
> ---
>
> **built-in metrics**
> - The default metrics a Datadog integration emits without any custom query extension.
> - It matters here because the note separates native coverage from the later custom metric work.
>
> > [!info] Default before custom
> >
> > Use built-in metrics first, then add custom queries only for gaps that matter operationally.
>
> ---
>
> **service check**
> - A Datadog status signal that reports whether a check can reach and evaluate a target successfully.
> - It matters here because an integration can fail before it ever produces meaningful metrics.
>
> > [!tip] Health of the collector
> >
> > A red service check tells you the monitoring path is broken even before charts go blank.
>
> ---
>
> **agent status output**
> - The local diagnostic report that lists configured checks, recent runs, and collection errors.
> - It matters here because it confirms whether the SQL integration loaded and executed after a config change.
>
> > [!info] Trust local diagnostics first
> >
> > Dashboards lag and filters mislead; the host status output is the first source of truth.
>
> ---
>
> **restart requirement**
> - The need to restart the Datadog Agent after editing integration config files.
> - It matters here because changes on disk do not become active until the running agent reloads them.
>
> > [!tip] Config is not live by default
> >
> > A correct file with no restart looks exactly like a bad configuration from the dashboard side.
>
> ---
>
> **custom query extension**
> - The optional Datadog mechanism for adding SQL queries that emit extra metrics beyond the built-in set.
> - It matters here because the note positions custom queries as an extension point, not part of the baseline integration contract.
>
> > [!info] Extend after baseline
> >
> > First make the default check healthy, then layer on custom metrics for deadlocks, login breakdowns, or other project-specific views.

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

**Full config with custom queries** — see [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) for the complete file including both custom query blocks.

---

### SQL Server Integration Connection Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `host` | `localhost,1433` | Comma-separated host and port (not colon) — SQL Server ODBC convention |
| `connector` | `odbc` | Uses the system ODBC driver manager |
| `driver` | `{ODBC Driver 18 for SQL Server}` | Must be installed via `msodbcsql18` package |
| `connection_string` | `TrustServerCertificate=yes` | Required for self-signed dev certificate on SQL Server 2022 Developer edition |
| `username` / `password` | `dd_agent` | Read-only login with `VIEW SERVER STATE` — see [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) |

> [!warning] TrustServerCertificate
> SQL Server 2022 uses a self-signed certificate by default. Without `TrustServerCertificate=yes`, the ODBC driver will refuse to connect. Do not use this in production environments with real certificates — instead, configure a proper certificate and remove this setting. See [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/server-configuration) for the full SQL Server instance setup including certificate and network configuration.

> [!success] Production Certificate Setup
> Provision a CA-signed certificate for SQL Server, configure it in SQL Server Configuration Manager, then remove `TrustServerCertificate=yes` from `connection_string`. This ensures the ODBC driver validates the certificate and the connection is genuinely encrypted.

---

### Built-in SQL Server Metrics Collected by Datadog

The integration automatically collects these metric groups from SQL Server DMVs:

| Metric | Description |
|--------|-------------|
| `sqlserver.stats.connections` | Total active connections |
| `sqlserver.stats.batch_requests` | Batch requests per second (overall throughput) |
| `sqlserver.stats.lock_waits` | Lock waits per second — correlates with [wait types](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/wait-stats-analysis) like `LCK_M_*` |
| `sqlserver.buffer.cache_hit_ratio` | Buffer cache hit ratio (%) — target > 99% |
| `sqlserver.buffer.page_life_expectancy` | Seconds a page stays in buffer pool — target > 300 |
| `sqlserver.buffer.checkpoint_pages` | Checkpoint pages flushed per second |
| `sqlserver.buffer.pool_size` | Buffer pool size in pages |

> [!tip] Buffer Cache Hit Ratio
> Should stay above 99%. Drops below 95% indicate memory pressure — SQL Server is reading from disk instead of RAM. See [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/essential-dba-queries) for DMV queries to diagnose memory pressure.

> [!tip] Page Life Expectancy
> Higher is better. Drops below 300 seconds indicate memory pressure and frequent page evictions from the buffer pool.

---

> [!danger] Missing VIEW SERVER STATE permission
>
> If the `dd_agent` SQL login lacks `VIEW SERVER STATE` permission, the Datadog agent connects successfully but returns zero values for most metrics (connections, buffer pool, waits). The agent logs no error -- it simply reports `0` for every DMV-backed metric. Always verify with `SELECT HAS_PERMS_BY_NAME(null, null, 'VIEW SERVER STATE')` from the `dd_agent` session.

> [!success] Fix: Grant VIEW SERVER STATE
> Connect as `sa` and run: `GRANT VIEW SERVER STATE TO dd_agent;`. Restart the Datadog agent, then verify with `sudo datadog-agent check sqlserver` — metric values should now be non-zero.

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

> [!success] Fix: Replace Tabs with Spaces
> Run `sudo sed -i 's/\t/  /g' /etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` to replace all tab characters with two spaces. Re-verify with `cat -A`, then restart the agent with `sudo systemctl restart datadog-agent`.

---

## Related

- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — How the agent is installed and managed
- [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) — Adding custom DMV metric queries to this config
- [datadog-log-management](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-log-management) — Separate config for SQL Server errorlog collection
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Dashboard widgets using these metrics
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/essential-dba-queries) — DMV queries for manual SQL Server health checks
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/server-configuration) — SQL Server VM setup and configuration
