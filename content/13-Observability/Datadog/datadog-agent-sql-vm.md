---
title: "Datadog Agent: SQL VM"
tags: [monitoring, observability, sql, datadog, gcp]
aliases: [DD Agent SQL VM, Datadog SQL Server VM, datadog-agent systemd]
description: "How to set up the Datadog Agent as a systemd service on the example SQL Server VM (Ubuntu 22.04), covering automated bootstrap, manual install steps, and the dd_agent SQL login."
parent: "[[domain-datadog-platform]]"
links:
  - "[[datadog-architecture-overview]]"
  - "[[datadog-agent-airflow-vm]]"
  - "[[datadog-gcp-integration]]"
  - "[[datadog-sql-server-integration]]"
  - "[[datadog-custom-queries]]"
  - "[[datadog-log-management]]"
  - "[[datadog-sql-server-logs]]"
  - "[[datadog-apm-traces]]"
  - "[[datadog-dashboards]]"
  - "[[datadog-alerting]]"
  - "[[datadog-airflow-observability]]"
  - "[[datadog-cost-optimization]]"
  - "[[datadog-troubleshooting]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Agent Setup — SQL Server VM (systemd on Ubuntu)

> [!quote]
> "Without monitoring, you are just guessing. With monitoring, you are making informed decisions."
>
> — **Tom Wilkie**, co-creator of Grafana Loki

The SQL VM runs Ubuntu 22.04, so the Datadog Agent is installed as a system package managed by systemd — not Docker. This is the standard Linux installation method and gives the agent access to OS-level metrics, SQL Server integration checks, and file tailing for the errorlog.

---

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
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — SQL Server VM configuration reference
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — DMV queries useful for debugging SQL Server health
