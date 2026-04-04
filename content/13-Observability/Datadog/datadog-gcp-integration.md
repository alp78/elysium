---
tags: [monitoring, observability, terraform, datadog, gcp]
aliases: [Datadog GCP Integration, GCP Cloud Monitoring Integration, Datadog Cloud Run Metrics]
description: "How to set up the Datadog GCP Integration for the project — enables pulling Cloud Run job metrics (CPU, memory, execution count) from Google Cloud Monitoring into Datadog without running an agent in Cloud Run."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog GCP Integration Setup

> [!quote]
> "When Netflix instrumented their services, they instrumented service patterns — so when you built a new service, the monitoring would already be there once you got it running."
>
> — **Adrian Cockcroft**

The GCP Integration enables Datadog to pull metrics from Cloud Run, Compute Engine, and other GCP services via the Cloud Monitoring API. This is how Cloud Run job metrics (CPU, memory, execution count) appear in Datadog — since Cloud Run jobs are ephemeral, no Datadog agent can run inside them.

---

### Why the Datadog GCP Integration Is Needed

The [Airflow VM agent](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) and [SQL VM agent](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) cover the GCE VMs. But the `data-pipeline-pipeline` Cloud Run job has no persistent host — each execution runs in a fresh container and exits. The only way to get Cloud Run metrics is via the GCP Integration, which pulls them directly from Google Cloud Monitoring.

---

### GCP Integration Setup Steps

1. In Datadog, go to **Integrations > Google Cloud Platform**
2. Choose **Manual** setup method
3. Enter the service account email:
   ```
   data-pipeline-datadog@data-platform-prod.iam.gserviceaccount.com
   ```
4. When prompted for "Generate Principal", use the SA impersonation flow
5. Enable **GCE Automuting** (auto-mutes monitors when VM is stopped)
6. Enable **Resource Collection** (discovers GCP resources in Datadog)
7. Save the integration

> [!info] Service Account Permissions
> The Datadog SA has `monitoring.viewer`, `compute.viewer`, and `cloudasset.viewer` roles — it can read metrics but cannot modify any GCP resources. See [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) for the broader IAM model and least-privilege principles applied across the project.

---

### Terraform Resources for GCP Integration

The service account is created conditionally in `infra/iam.tf`:

```hcl
resource "google_service_account" "datadog" {
  count        = var.dd_api_key != "" ? 1 : 0
  account_id   = "data-pipeline-datadog"
  display_name = "Datadog Integration"
}
```

---

### Verify Datadog GCP Integration

After setup, go to **Infrastructure > Host Map** in Datadog. You should see GCE VMs listed. Cloud Run metrics appear under **Cloud > GCP > Cloud Run**.

---

## Using Cloud Run Metrics in Dashboards

Cloud Run job metrics use the `gcp.run.job.*` namespace. Key metric names:

| Metric | Description |
|--------|-------------|
| `gcp.run.job.completed_execution_count` | Number of job executions completed |
| `gcp.run.container.cpu.utilizations.avg` | CPU utilization during execution |
| `gcp.run.container.memory.usage` | Memory usage during execution — these same metrics are available natively in [GCP Cloud Monitoring](https://alp78.github.io/elysium/06-GCP/Logging/cloud-monitoring-metrics) |

**Filter by job name:** Use `job_name:data-pipeline-pipeline` (not `service:data-pipeline-pipeline`).

#### Query example (Pipeline Runs widget)

```
sum:gcp.run.job.completed_execution_count{job_name:data-pipeline-pipeline}.as_count()
```

> [!tip] Query Value vs Timeseries for Cloud Run Jobs
> Cloud Run jobs are ephemeral (1-2 min runtime), so timeseries charts show tiny blips. **Query Value** with `max` aggregator is more informative for showing peak CPU and memory usage.

---

## Troubleshooting

#### Cloud Run metrics not showing

1. Verify GCP Integration is set up (Integrations > Google Cloud Platform)
2. Check the Datadog SA has `monitoring.viewer` role
3. GCP metrics can take 5-10 minutes to appear after integration setup
4. Use `job_name:data-pipeline-pipeline` as the filter (not `service:data-pipeline-pipeline`)

#### Pipeline logs not in Datadog
Cloud Run job logs go to **GCP Cloud Logging**, not through dd-agent. They are not available in Datadog's Log Explorer. View them via:

```powershell
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=data-pipeline-pipeline" \
  --limit=50 --format="table(timestamp,textPayload)"
```

---

## Related Notes

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — full observability architecture
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — agent on the Airflow VM
- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — agent on the SQL VM
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards) — Pipeline Watch dashboard using Cloud Run metrics
- the GCP resources — GCP resource inventory
