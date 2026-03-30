---
type: reference
category: observability
technology: [datadog, sql-server, airflow]
tags: [monitoring, observability, sql, airflow, datadog]
aliases: [Datadog Monitors, Datadog Alerts, Deadlock Alert, Airflow Monitors]
keywords: [datadog monitors, alerts, deadlock alert, scheduler down, airflow monitor, metric monitor, change alert, notification, email alert, P1 critical, P2 high, conditional formatting, monitor message, recovery]
description: "Recommended Datadog monitors for the data platform — deadlock detection on SQL Server, Airflow scheduler health, task failure alerts, and pool starvation warnings."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Alerting — Monitors and Notification Channels

Datadog monitors watch metrics over time and trigger notifications when conditions are met. The data platform uses monitors for SQL Server deadlock detection and Airflow scheduler health.

---

## SQL Server DBA Monitors

### Deadlock Alert Monitor

The most critical SQL Server monitor — triggers an email alert whenever a deadlock occurs.

#### Setup

1. Go to **Monitors > New Monitor > Metric**
2. **Detection method:** Change Alert
3. **Metric:** `sqlserver.deadlocks.total`
4. **Alert condition:** change over `last 5 minutes` is above **0**
5. **Title:** "SQL Server Deadlock Detected"
6. **Message:**

```
{{#is_alert}}
Deadlock detected on {{host.name}}.

1. Check active locks: SELECT * FROM sys.dm_tran_locks WHERE request_status = 'WAIT'
2. Review Extended Events deadlock graph
3. Identify conflicting queries and fix access order
{{/is_alert}}

{{#is_recovery}}
Deadlock alert resolved on {{host.name}}.
{{/is_recovery}}

Notify: @oncall-team@example.com
```

7. **Tags:** `env:prod`, `service:data-pipeline-sql`
8. Click **Create**

The monitor triggers immediately when a deadlock occurs and sends an email with remediation steps. It auto-resolves when no new deadlocks are detected in the evaluation window. When a P1 or P2 alert fires, follow the response procedures in the on call guide to ensure consistent triage and escalation.

### Testing the Deadlock Alert

To verify the full pipeline (deadlock → metric → monitor → email):

1. Create a deadlock using the procedure in the SQL Server Tuning Guide, Section 5.8
2. Wait 15-30 seconds for the Datadog agent to collect the updated counter
3. The monitor should trigger and send an email within 1-2 minutes
4. The Deadlock Count widget on the [SQL Server DBA dashboard](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) should increment

> [!info] Why change alert
>
> `sqlserver.deadlocks.total` is a `monotonic_count` — it resets to 0 each collection cycle when no new deadlocks occur. A **Change Alert** detects when the value increases from 0, which is more reliable than a threshold alert for delta-based metrics.

---

> [!danger] Monitor evaluation delay
>
> Datadog evaluates monitors on a fixed interval (typically 60 seconds). A deadlock that occurs and resolves within one evaluation cycle may never trigger the alert. For critical monitors, set the evaluation window to the smallest supported interval and consider enabling `require_full_window: false` so partial data triggers the alert rather than waiting for a full window.

> [!warning] Recovery notification flood
>
> When a monitor recovers, Datadog sends a recovery notification to all channels. If a flapping metric (e.g., scheduler heartbeat on a slow VM) triggers and recovers repeatedly, the on-call engineer receives dozens of notifications. Use `notify_no_data: true` with `no_data_timeframe: 10` (minutes) instead of a tight threshold to reduce noise for heartbeat-style monitors.

## Airflow Orchestration Monitors

Create these in **Monitors → New Monitor → Metric**:

| Monitor | Metric | Condition | Severity |
|---------|--------|-----------|----------|
| Scheduler Down | `airflow.scheduler_heartbeat` | No data for 5 min | P1 (Critical) — see airflow scheduler down |
| DAG Parse Error | `airflow.dag_processing.import_errors` | > 0 for 5 min | P2 (High) |
| Task Failure | `airflow.ti.finish.*.failed` | > 0 within 15 min | P2 (High) |
| Pool Starvation | `airflow.pool.starving_tasks.default_pool` | > 0 for 10 min | P3 (Medium) |
| DAG Duration Anomaly | `airflow.dagrun.duration.success.pipeline_pulse.avg` | > 2x baseline for 3 consecutive runs | P3 (Medium) |
| Queued Duration Spike | `airflow.dag.*.queued_duration.95percentile` | > 60,000,000 (60s) | P4 (Low) |
| Triggerer Down | `airflow.triggerer_heartbeat` | No data for 5 min | P3 (Medium) |

### Airflow Monitor Priority Guide

| Priority | Use For | Response Time |
|----------|---------|---------------|
| P1 (Critical) | Scheduler down — pipeline is completely blocked (see also sql server disk full for disk-related critical alerts) | Immediate |
| P2 (High) | DAG parse errors, task failures — pipeline quality at risk | Within 30 min |
| P3 (Medium) | Pool starvation, triggerer down, duration anomaly | Within 2 hours |
| P4 (Low) | Queued duration spikes — performance degradation only | Next business day |

> [!info] Airflow Duration Units
> Airflow emits durations in **microseconds**. The Queued Duration Spike threshold of 60,000,000 equals 60 seconds. Adjust based on your typical DAG run times from the [Airflow dashboard](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards).

---

## Dashboard Conditional Formatting

In addition to monitors (which send notifications), the SQL Server DBA dashboard uses **conditional formatting** on Query Value widgets for at-a-glance status:

### Deadlock Count Widget

| Condition | Background |
|-----------|-----------|
| value = 0 | Green |
| value > 0 | Red |

### Buffer Cache Hit Ratio Widget

| Condition | Background |
|-----------|-----------|
| value > 99 | Green |
| value > 95 | Yellow |
| value ≤ 95 | Red |

---

### GCE Host Automuting in Datadog

When GCE Automuting is enabled in the [GCP Integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration), monitors are automatically muted when a VM is stopped in GCP. This prevents false alerts during intentional maintenance or off-hours cost reduction when the SQL or Airflow VM is stopped.

Enable in: **Integrations > Google Cloud Platform > Edit > GCE Automuting = ON**

---

## Related

- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Dashboard widgets with conditional formatting
- [datadog-custom-queries](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-custom-queries) — `sqlserver.deadlocks.total` metric source
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — StatsD source for Airflow scheduler metrics
- [datadog-gcp-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration) — GCE Automuting for VM stop/start
- [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/Administration/essential-dba-queries) — Manual queries to investigate after a deadlock alert
