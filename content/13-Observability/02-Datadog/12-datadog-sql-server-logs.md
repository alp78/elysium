---
title: "12 - Datadog SQL Server Logs"
tags: [monitoring, observability, sql, datadog, gcp]
aliases: [SQL Server Log Collection, Datadog SQL Logs, SQL Server Errorlog Datadog]
description: "How to configure Datadog Agent to collect SQL Server errorlog entries from the example SQL VM — including the logs.yaml setup, permission fix, and how to test that logs are flowing."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog SQL Server Logs

> [!quote]
> "A log is a record of what happened. A good log is a record of what happened that you can actually understand six months later at 3 AM."
>
> — **Bryan Cantrill**, CTO of Oxide Computer

> [!abstract]- Summary
>
> This note narrows the broader log-management model down to one source: the SQL Server errorlog on the Ubuntu VM. It shows how Datadog tails that file, how to validate that bytes are actually being read, which events are worth searching for, and how to keep the log path separate from the metrics-side SQL integration config.
>
> **Source configuration**
> - Shows the SQL Server log source definition that tells the agent which file to tail and how to tag it.
> - Keeps this file-level setup distinct from the SQL metrics integration so the two telemetry paths are not conflated.
>
> **Validation flow**
> - Covers the checks used to prove the agent is reading the errorlog and the practical ways to force sample entries into the file.
> - Uses local validation first so empty searches in Datadog are traced back to the host state quickly.
>
> **Search and troubleshooting**
> - Explains what SQL Server writes into the errorlog, how to query for those events, and what to inspect when byte counts stay at zero.
> - Treats the errorlog as a targeted operational source rather than as a replacement for all SQL diagnostics.
>
> **Boundary with metrics config**
> - Ends by making the separation from the SQL Server metrics integration explicit.
> - When to use: the problem is specific to SQL Server log collection rather than to general Datadog log onboarding.

> [!note]- Glossary
>
> **SQL Server errorlog**
> - The database engine's rolling text log for startup messages, checkpoints, failed logins, and other server events.
> - It matters here because this is the specific file Datadog tails to expose SQL operational events.
>
> > [!info] Engine event stream
> >
> > The errorlog is the authoritative text source for many server-level events that metrics cannot describe.
>
> ---
>
> **file source config**
> - The Datadog log-collection block that defines one tailed file and its tags.
> - It matters here because the agent needs an explicit source definition before it will read the SQL Server errorlog.
>
> > [!tip] Explicit tail target
> >
> > The agent does not infer which database files matter; the source must be declared.
>
> ---
>
> **bytes read**
> - The Datadog status indicator that shows whether the agent has actually consumed log data from the configured file.
> - It matters here because it is one of the fastest local checks when logs are missing in Datadog.
>
> > [!info] Read proof
> >
> > A zero-byte reader usually points to a path, permission, or file-state problem before anything reaches Log Explorer.
>
> ---
>
> **checkpoint entry**
> - A SQL Server log message written when the engine performs a checkpoint.
> - It matters here because forcing a checkpoint is one easy way to generate a known-good test event.
>
> > [!tip] Controlled test signal
> >
> > Synthetic but safe events are useful when validating the log pipeline end to end.
>
> ---
>
> **failed login event**
> - A SQL Server errorlog record generated when authentication fails.
> - It matters here because it provides another deterministic way to prove log tailing works.
>
> > [!info] High-signal test case
> >
> > Authentication failures are useful validation events because they are easy to search and operationally recognizable.
>
> ---
>
> **log search query**
> - The filter expression used in Datadog Log Explorer to isolate SQL Server events of interest.
> - It matters here because ingestion success still needs a practical search pattern to become useful during incidents.
>
> > [!tip] Search makes collection useful
> >
> > A collected log source is only valuable if responders know how to cut through volume quickly.
>
> ---
>
> **path ownership**
> - The file path and permission context that determine whether the agent can open and tail the target log.
> - It matters here because SQL log collection failures are often mundane filesystem problems rather than Datadog-side indexing issues.
>
> > [!info] Filesystem reality
> >
> > When the host cannot read the file, no amount of dashboard work will surface the missing logs.
>
> ---
>
> **metrics versus logs config**
> - The separation between the SQL integration file for metrics and the file-source block for errorlog tailing.
> - It matters here because these two collection paths fail independently and should be debugged independently.
>
> > [!tip] Separate telemetry layers
> >
> > A healthy SQL metric check does not prove the errorlog source is healthy, and vice versa.

### Configure the SQL Server Log Source

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

### Verify SQL Server Log Collection

```bash
sudo datadog-agent status | grep -A 10 "Integrations" | grep -A 5 "sqlserver"
```

You should see `Status: OK` and `Inputs: /var/opt/mssql/log/errorlog`.

---

### What Gets Logged from SQL Server Errorlog

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

### Troubleshooting If Bytes Read Stays at 0

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

### SQL Server Log Search Queries in Datadog

In **Datadog > Logs > Explorer:**

```
host:data-pipeline-sql source:sqlserver                  # All SQL Server logs
host:data-pipeline-sql service:data-pipeline-sql status:error    # Errors only
host:data-pipeline-sql "Login failed"                    # Failed login events
```

---

### Separation of Logs from Metrics Config

SQL Server **metrics** (connections, buffer pool, waits) are collected by the `sqlserver` integration check via ODBC. **Logs** (errorlog) are collected by the separate `logs.yaml` file tailing mechanism. These are independent:

- Metrics: `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml`
- Logs: `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml`

Both must be configured separately. See [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) for the metrics integration config and [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) for custom SQL queries.

---

## Related Notes

- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — full SQL VM agent setup including metrics integration
- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — observability architecture overview
- [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) — custom SQL queries for connections and deadlocks
- common pipeline errors — troubleshooting "no SQL Server logs in Log Explorer"
