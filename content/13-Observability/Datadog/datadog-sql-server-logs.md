---
type: how-to
category: observability
technology: [datadog, sql-server, gcp]
tags: [observability, sql, datadog, gcp]
aliases: [SQL Server Log Collection, Datadog SQL Logs, SQL Server Errorlog Datadog]
keywords: [logs.yaml, errorlog, "/var/opt/mssql/log/errorlog", start_position beginning, Bytes Read 0, log collection, logs_enabled, dd-agent mssql group, source sqlserver, failed login, CHECKPOINT, log tailing, agent tails, "host:sql-vm", "service:sql-server", log explorer]
description: "How to configure Datadog Agent to collect SQL Server errorlog entries from the example SQL VM — including the logs.yaml setup, permission fix, and how to test that logs are flowing."
related: [datadog-architecture-overview, datadog-agent-sql-vm, datadog-custom-queries, data-pipeline-common-errors]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog SQL Server Log Collection

The Datadog Agent collects SQL Server metrics by default, but **log collection requires a separate config file**. Without it, no logs appear in Datadog's Log Explorer. This note documents the setup, permission requirements, and how to test that logs are flowing.

---

## Configure the Log Source

SSH into the SQL VM and create the log collection config:

```bash
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap

sudo mkdir -p /etc/datadog-agent/conf.d/sqlserver.d
sudo tee /etc/datadog-agent/conf.d/sqlserver.d/logs.yaml <<EOF
logs:
  - type: file
    path: /var/opt/mssql/log/errorlog
    service: data-pipeline-sql
    source: sqlserver
EOF

sudo chown -R dd-agent:dd-agent /etc/datadog-agent/conf.d/sqlserver.d/
sudo usermod -aG mssql dd-agent
sudo systemctl restart datadog-agent
```

The `usermod -aG mssql dd-agent` step is required — the SQL Server errorlog is owned by the `mssql` group, and the agent needs group membership to read it.

---

## Verify

```bash
sudo datadog-agent status | grep -A 10 "Integrations" | grep -A 5 "sqlserver"
```

You should see `Status: OK` and `Inputs: /var/opt/mssql/log/errorlog`.

---

## What Gets Logged

SQL Server only writes to its error log on significant events — startups, failed logins, errors, backups, checkpoints. A simple `SELECT` query does **not** generate an error log entry.

To test that logs are flowing:

```bash
SA_PWD=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/sa-password")

# Force a checkpoint (writes to errorlog)
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PWD" -C -Q "CHECKPOINT"

# Or trigger a failed login (guaranteed log entry)
/opt/mssql-tools18/bin/sqlcmd -S localhost -U fakeuser -P "wrong" -C -Q "SELECT 1" 2>/dev/null
```

Logs should appear in **Datadog > Logs > Explorer** within 1–2 minutes, filterable by `host:data-pipeline-sql` or `service:data-pipeline-sql`.

---

## If Bytes Read Stays at 0

The agent tails from the **end** of the file by default. If the file had no new entries since the agent started, `Bytes Read` stays at 0. Force it to read existing content:

```bash
sudo tee /etc/datadog-agent/conf.d/sqlserver.d/logs.yaml <<EOF
logs:
  - type: file
    path: /var/opt/mssql/log/errorlog
    service: data-pipeline-sql
    source: sqlserver
    start_position: beginning
EOF

sudo systemctl restart datadog-agent
```

After reading the existing log, remove `start_position: beginning` if you don't want to re-read the entire log on every restart.

---

## Log Search Queries

In **Datadog > Logs > Explorer:**

```
host:data-pipeline-sql source:sqlserver                  # All SQL Server logs
host:data-pipeline-sql service:data-pipeline-sql status:error    # Errors only
host:data-pipeline-sql "Login failed"                    # Failed login events
```

---

## Separation from Metrics

SQL Server **metrics** (connections, buffer pool, waits) are collected by the `sqlserver` integration check via ODBC. **Logs** (errorlog) are collected by the separate `logs.yaml` file tailing mechanism. These are independent:

- Metrics: `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml`
- Logs: `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml`

Both must be configured separately. See [[datadog-agent-sql-vm]] for the metrics integration config and [[datadog-custom-queries]] for custom SQL queries.

---

## Related Notes

- [[datadog-agent-sql-vm]] — full SQL VM agent setup including metrics integration
- [[datadog-architecture-overview]] — observability architecture overview
- [[datadog-custom-queries]] — custom SQL queries for connections and deadlocks
- common pipeline errors — troubleshooting "no SQL Server logs in Log Explorer"
