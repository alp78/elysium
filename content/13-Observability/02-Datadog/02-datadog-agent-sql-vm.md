---
title: "02 - Datadog Agent: SQL VM"
tags: [monitoring, observability, sql, datadog, gcp]
aliases: [DD Agent SQL VM, Datadog SQL Server VM, datadog-agent systemd]
description: "How to set up the Datadog Agent as a systemd service on the example SQL Server VM (Ubuntu 22.04), covering automated bootstrap, manual install steps, and the dd_agent SQL login."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Agent: SQL VM

> [!quote]
> "Without monitoring, you are just guessing. With monitoring, you are making informed decisions."
>
> — **Tom Wilkie**, co-creator of Grafana Loki

> [!abstract]- Summary
>
> This note focuses on the SQL Server VM as a conventional Linux agent installation: Datadog runs as a systemd-managed package on Ubuntu, owns the host-level telemetry path, and pairs that with a low-privilege SQL login so database metrics and error logs can be collected without granting write access.
>
> **Bootstrap install path**
> - Shows how the startup script installs Agent 7, writes the main `datadog.yaml`, enables log collection, and seeds the SQL login needed for integration checks.
> - Uses the automated path as the baseline so the VM can come up observable on first boot instead of relying on later manual intervention.
>
> **Manual recovery path**
> - Walks through the manual install sequence for cases where the agent was skipped during bootstrap or the Datadog API key was not present at first boot.
> - Includes the SQL login creation and the handoff to the separate SQL Server integration config file.
>
> **Configuration layout**
> - Calls out the key config locations on the SQL VM so it is clear which file owns host settings and which file owns the SQL Server check.
> - Separates agent bootstrap concerns from integration concerns so troubleshooting stays targeted.
>
> **Operations and control**
> - Ends with the service-management commands used to restart, inspect, and verify the agent after config changes.
> - When to use: the goal is to make the SQL VM observable through the host package model rather than through container-specific guidance.

> [!note]- Glossary
>
> **systemd service**
> - The Linux service manager that starts, stops, and supervises the Datadog Agent on Ubuntu.
> - It matters here because the SQL VM uses the package model, so operational control happens through `systemctl` rather than Docker commands.
>
> > [!info] Package-managed lifecycle
> >
> > If the host uses systemd, restart and status checks belong at the service layer first.
>
> ---
>
> **`datadog.yaml`**
> - The main Datadog Agent configuration file that defines the site, API key, hostname, tags, and global features.
> - It matters here because the SQL VM's host identity and log settings are established here before any integration-specific file is read.
>
> > [!info] Global agent settings
> >
> > Think of this file as the agent bootstrap contract; per-product integrations extend it, they do not replace it.
>
> ---
>
> **`logs_enabled`**
> - The global switch that allows the agent to collect and forward logs.
> - It matters here because SQL Server errorlog tailing will never work if log collection is disabled at the root config level.
>
> > [!tip] Logs have two gates
> >
> > The source config can be correct and still stay silent if the global log feature was never enabled.
>
> ---
>
> **`dd_agent` login**
> - A dedicated SQL Server login used by Datadog to read DMVs and metadata for monitoring.
> - It matters here because the note intentionally uses a least-privilege login instead of reusing a broader admin credential.
>
> > [!info] Read-only observability identity
> >
> > Monitoring should explain the server, not own it. Separate the collector identity from operational admin logins.
>
> ---
>
> **`VIEW SERVER STATE`**
> - The SQL Server permission that allows reading many diagnostic DMVs and server-wide performance counters.
> - It matters here because Datadog depends on those internal views to collect wait stats, sessions, and performance data.
>
> > [!tip] Minimum useful visibility
> >
> > Without DMV visibility, the integration can connect successfully and still report very little of diagnostic value.
>
> ---
>
> **process collection**
> - An optional Datadog feature that inventories and reports running processes on the host.
> - It matters here because the SQL VM config enables it to expose the server process footprint alongside system metrics.
>
> > [!info] Host process visibility
> >
> > This complements CPU and memory charts by showing which processes are actually consuming the machine.
>
> ---
>
> **integration config**
> - A service-specific Datadog file under `conf.d` that defines how to monitor SQL Server itself.
> - It matters here because the agent install is only the transport layer; the SQL check still needs its own config to become useful.
>
> > [!tip] Agent first, check second
> >
> > A running agent with no service integration is healthy infrastructure with missing database telemetry.
>
> ---
>
> **agent status**
> - The Datadog diagnostic command output that lists running checks, log sources, and recent collection state.
> - It matters here because it is the primary local proof that the SQL Server integration is active after installation or a restart.
>
> > [!info] Local ground truth
> >
> > Before blaming dashboards, inspect the local status output to confirm whether the host is collecting the signal at all.

## Automated Setup (via Startup Script)

The startup script (`infra/scripts/sql-startup.sh`) installs the agent on first boot:

#### Install the Datadog Agent 7

```bash
DD_API_KEY="${DD_API_KEY}" DD_SITE="datadoghq.eu" \
  bash -c "$(curl -fsSL https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
```

#### Write the main agent config

```yaml
# /etc/datadog-agent/datadog.yaml
api_key: <API_KEY>
site: datadoghq.eu
hostname: data-pipeline-sql
tags:
  - env:prod
  - service:data-pipeline-sql
logs_enabled: true
process_config:
  process_collection:
    enabled: true
```

#### Create the `dd_agent` SQL Server login with read-only permissions

```sql
CREATE LOGIN dd_agent WITH PASSWORD = 'Dd@g3nt!Monitor';
GRANT VIEW SERVER STATE TO dd_agent;
GRANT VIEW ANY DEFINITION TO dd_agent;
```

> [!info] Minimal Permissions
> `VIEW SERVER STATE` grants access to DMVs like `sys.dm_exec_sessions`, `sys.dm_os_performance_counters`, and `sys.dm_os_wait_stats`. `VIEW ANY DEFINITION` allows reading object metadata. No write permissions are granted.

#### Write the SQL Server integration config to

`/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` — see [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration) for the full config.

---

### Datadog Agent Manual Install on SQL VM

If the Datadog Agent was not installed during VM bootstrap (e.g., `dd-api-key` metadata was not set at first boot), install it manually:

```bash
# 1. SSH into the SQL VM
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap

# 2. Set your Datadog API key
export DD_API_KEY="<your-datadog-api-key>"

# 3. Install the agent
DD_API_KEY="$DD_API_KEY" DD_SITE="datadoghq.eu" \
  bash -c "$(curl -fsSL https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"

# 4. Write agent config
sudo tee /etc/datadog-agent/datadog.yaml <<EOF
api_key: ${DD_API_KEY}
site: datadoghq.eu
hostname: data-pipeline-sql
tags:
  - env:prod
  - service:data-pipeline-sql
logs_enabled: true
process_config:
  process_collection:
    enabled: true
EOF

# 5. Create dd_agent SQL login
SA_PWD=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/sa-password")

/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PWD" -C -Q "
  IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'dd_agent')
  BEGIN
    CREATE LOGIN dd_agent WITH PASSWORD = 'Dd@g3nt!Monitor';
    GRANT VIEW SERVER STATE TO dd_agent;
    GRANT VIEW ANY DEFINITION TO dd_agent;
  END
"

# 6. Configure SQL Server integration
sudo mkdir -p /etc/datadog-agent/conf.d/sqlserver.d
sudo tee /etc/datadog-agent/conf.d/sqlserver.d/conf.yaml <<EOF
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
EOF

# 7. Fix permissions and start
sudo usermod -aG root dd-agent
sudo systemctl enable datadog-agent
sudo systemctl restart datadog-agent

# 8. Verify
sudo datadog-agent status
```

> [!tip] Persist API Key in Metadata
> After manual install, run `terraform apply` to persist `dd-api-key` in the VM metadata for future reboots. Without this, the key won't be available on next boot and the agent won't auto-configure.

---

### Datadog Agent Config File Locations on SQL VM

| File | Purpose |
|------|---------|
| `/etc/datadog-agent/datadog.yaml` | Main agent config (API key, hostname, tags) |
| `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` | SQL Server integration (connection, custom queries) |
| `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml` | SQL Server log collection |

---

### Datadog Agent Management Commands on SQL VM

SSH into the VM first:

```powershell
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
```

| Task | Command |
|------|---------|
| Full agent status | `sudo datadog-agent status` |
| Check SQL Server integration | `sudo datadog-agent check sqlserver` |
| View agent logs | `sudo journalctl -u datadog-agent --no-pager -n 50` |
| Restart agent | `sudo systemctl restart datadog-agent` |
| Stop agent | `sudo systemctl stop datadog-agent` |
| Start agent | `sudo systemctl start datadog-agent` |

---

## Related

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — Full observability topology
- [datadog-sql-server-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-integration) — SQL Server integration config detail
- [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) — Custom DMV metric queries
- [datadog-log-management](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-log-management) — Errorlog collection configuration
- [datadog-troubleshooting](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-troubleshooting) — Common issues including missing agent after bootstrap
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/server-configuration) — SQL Server VM configuration reference
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/essential-dba-queries) — DMV queries useful for debugging SQL Server health
