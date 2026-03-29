---
tags: [runbook, incident]
type: runbook
technology: []
status: stable
updated: 2026-03-23
---

# On-Call Guide

> This guide is for anyone on the data platform on-call rotation. Read this before your first shift.

### Severity definitions — Sev1 Sev2 Sev3 classification

| Severity | Definition | Response SLA | Notification | Escalation |
|----------|-----------|-------------|-------------|------------|
| **Sev1** | Index publication at risk. Clients cannot receive data on time. | 15 min acknowledge, 1 hr resolve | PagerDuty + Slack #incidents | Immediately to Engineering Lead |
| **Sev2** | Data quality degraded. Publication possible but may contain stale or incomplete data. | 1 hr acknowledge, 4 hr resolve | Slack #incidents | After 2 hrs to Engineering Lead |
| **Sev3** | Non-urgent operational issue. No client impact. | Next business day | Slack #ops-alerts | Weekly review |

> [!danger] Clock Starts at Alert Time, Not When You See It
> Sev1 SLA is 15 minutes from alert trigger to acknowledgment. If PagerDuty/Slack notifications are delayed due to phone DND mode or routing issues, the clock still starts when the monitor fired. Configure PagerDuty to override DND settings for Sev1 alerts. Test the escalation path during every on-call handoff.

### First 5 minutes checklist -- initial incident triage

1. **Acknowledge** the alert in PagerDuty/Slack
2. **Check Datadog dashboard** — is the issue isolated or systemic? See [[datadog-alerting]] for how alerts are configured and which monitors map to which runbooks.
   - Pipeline Health: `https://app.datadoghq.eu/dashboard/pipeline-health`
   - Infrastructure: `https://app.datadoghq.eu/infrastructure`
3. **Check Airflow** — are DAGs running? Any failed tasks?
   ```bash
   # SSH to Airflow VM
   gcloud compute ssh airflow-vm --zone=europe-west1-b --tunnel-through-iap
   docker ps  # Is the scheduler running?
   ```
4. **Check SQL Server** — is the database responsive?
   ```bash
   gcloud compute ssh sql-vm --zone=europe-west1-b --tunnel-through-iap
   sqlcmd -S localhost -U sa -Q "SELECT 1"
   ```
5. **Identify the runbook** — match symptoms to the table below and follow the procedure

### Symptom to runbook routing table

| Symptom | Likely Runbook |
|---------|---------------|
| Airflow DAG failed, index not calculated | [[index-calculation-failure]] |
| ESG pipeline halted with "CIRCUIT_BREAK" | [[esg-circuit-breaker-fired]] |
| SQL Server errors, "disk full" in logs | [[sql-server-disk-full]] |
| BigQuery jobs queued or failing with quota errors | [[bigquery-quota-exceeded]] |
| Airflow webserver unreachable, scheduler not running | [[airflow-scheduler-down]] |
| Pub/Sub dead letter topic growing | [[pubsub-dead-letter-backup]] |
| Client reports wrong index value | [[data-restatement-procedure]] |
| Missing corporate action in index composition | [[corporate-action-missed]] |
| Vendor data file not arrived | [[vendor-file-late-or-missing]] |

### Escalation matrix — on-call contacts

| Role | Contact | When to Engage |
|------|---------|----------------|
| On-Call Engineer | Current rotation | First responder for all alerts |
| Engineering Lead | (placeholder) | Sev1 immediately, Sev2 after 2 hrs |
| Index Operations | (placeholder) | Any issue affecting index publication |
| Client Relations | (placeholder) | Any client-visible delay or error |
| Compliance Officer | (placeholder) | Any restatement or EU BMR filing |

## Communication Templates

### Client-Facing Delay Notice

```
Subject: [INDEX_CODE] — Publication Delay Notice

Dear Client,

We are experiencing a delay in the publication of [INDEX_CODE] values
for [DATE]. Our engineering team is actively investigating the issue.

Expected resolution: [TIME] UTC
Impact: [DESCRIPTION]

We will provide an update within [TIMEFRAME] or upon resolution.

Regards,
Index Operations Team
```

### Internal Sev1 Incident Channel Message

```
@here SEV-1 INCIDENT — [TITLE]
Trigger: [ALERT/SYMPTOM]
Impact: [WHAT IS AFFECTED]
Status: Investigating
On-call: [NAME]
Runbook: the relevant runbook
Thread for updates below ↓
```

### Post-incident review (PIR) template — blameless postmortem

The PIR process follows the blameless postmortem principles described in [[leadership-and-collaboration]]. Focus on systemic improvements, not individual blame.

```markdown
# PIR: [Incident Title]

**Date**: YYYY-MM-DD
**Severity**: Sev1/2/3
**Duration**: HH:MM (detect → resolve)
**Impact**: [What was affected, for how long]

## Timeline
- HH:MM — Alert fired
- HH:MM — Acknowledged by [name]
- HH:MM — Root cause identified
- HH:MM — Fix applied
- HH:MM — Verified and closed

## Root Cause
[What actually broke and why]

## What Went Well
- [List]

## What Went Poorly
- [List]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Fix] | [Name] | [Date] | Open |

## Monitoring Gaps
[What alert should have existed but didn't?]
```

## Related

- [[runbooks-index]] — All runbooks
- [[compliance-and-auditability]] — Audit trail requirements
- [[dataops-for-indices]] — SEV classification and incident response
- [[golden-rules-of-data-engineering]] — Rule 10: Observability Is Not Optional
