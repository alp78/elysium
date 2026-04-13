---
title: "06 - Datadog GCP Integration"
tags: [monitoring, observability, terraform, datadog, gcp]
aliases: [Datadog GCP Integration, GCP Cloud Monitoring Integration, Datadog Cloud Run Metrics]
description: "How to set up the Datadog GCP Integration for the project — enables pulling Cloud Run job metrics (CPU, memory, execution count) from Google Cloud Monitoring into Datadog without running an agent in Cloud Run."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog GCP Integration

> [!quote]
> "When Netflix instrumented their services, they instrumented service patterns — so when you built a new service, the monitoring would already be there once you got it running."
>
> — **Adrian Cockcroft**

> [!abstract]- Summary
>
> This note explains the API-based half of the Datadog architecture: the GCP integration lets Datadog pull Cloud Run, Compute Engine, and other managed-service metrics from Google Cloud Monitoring, which is essential for ephemeral workloads that never host a resident agent.
>
> **Why the integration exists**
> - Explains the observability gap left by host agents alone and why Cloud Run job metrics have to come through Google's monitoring APIs.
> - Frames the integration as a complement to the VM agents rather than a competing path.
>
> **Setup and IAM**
> - Walks through the Datadog setup steps, the service-account identity, and the least-privilege GCP roles that support read-only collection.
> - Keeps the trust boundary explicit so the integration remains an observability identity, not an administrative one.
>
> **Metric use in dashboards**
> - Shows how Cloud Run metrics appear in Datadog, which namespaces and filters matter, and how those signals can feed dashboards alongside VM telemetry.
> - Helps the reader treat managed-service metrics as first-class inputs to the same operational view.
>
> **Verification and troubleshooting**
> - Ends with the checks used to confirm the integration is alive and the troubleshooting path when hosts or Cloud Run metrics do not show up.
> - When to use: the target workload lives in GCP-managed services and Datadog needs visibility without an in-guest agent.

> [!note]- Glossary
>
> **Cloud Monitoring API**
> - Google's metrics and monitoring interface that external systems can query for resource telemetry.
> - It matters here because Datadog relies on this API to ingest Cloud Run and other managed-service signals.
>
> > [!info] Managed metrics source
> >
> > No host agent exists for many GCP services, so the API becomes the telemetry source of record.
>
> ---
>
> **service account**
> - A GCP identity used by software to authenticate to Google APIs.
> - It matters here because Datadog authenticates as a dedicated service account with read-only permissions.
>
> > [!tip] Separate collector identity
> >
> > Observability integrations should have scoped machine identities, not borrowed human or admin credentials.
>
> ---
>
> **Resource Collection**
> - The Datadog option that imports GCP resource metadata so assets appear correctly in Datadog.
> - It matters here because metric ingestion is more useful when hosts and services are also discoverable as named resources.
>
> > [!info] Metrics plus inventory
> >
> > Resource metadata is what makes dashboards and infrastructure views navigable instead of anonymous.
>
> ---
>
> **GCE automuting**
> - The Datadog feature that suppresses host alerts automatically when a VM is intentionally stopped.
> - It matters here because it reduces false noise from planned infrastructure lifecycle events.
>
> > [!tip] Planned silence
> >
> > Alert quality improves when the platform can distinguish expected downtime from genuine incidents.
>
> ---
>
> **`gcp.run.job.*`**
> - The Cloud Run job metric namespace exposed through the Datadog GCP integration.
> - It matters here because these are the signals used to monitor the pipeline job's executions, CPU, and memory in Datadog.
>
> > [!info] Cloud Run signal family
> >
> > Using the right namespace and tags is the difference between an empty widget and a valid managed-workload chart.
>
> ---
>
> **`job_name` filter**
> - The Datadog tag key used to isolate a specific Cloud Run job's metrics.
> - It matters here because Cloud Run metrics are not filtered with the same service tags used by the traced pipeline code.
>
> > [!tip] Filter with the resource model
> >
> > Managed-service metrics often need provider-specific tags rather than application-level ones.
>
> ---
>
> **least privilege**
> - The principle of granting only the minimal permissions required for a task.
> - It matters here because the Datadog integration needs to read metrics and inventory, not mutate project resources.
>
> > [!info] Monitoring is not admin
> >
> > Keeping the integration read-only limits blast radius if the credentials are misused or leaked.
>
> ---
>
> **ephemeral workload**
> - A workload that starts for a run and then exits instead of living on a persistent host.
> - It matters here because ephemeral jobs break host-agent assumptions and force API-level observability patterns.
>
> > [!tip] No host to attach to
> >
> > Short-lived runtimes demand collection strategies that survive beyond the container's lifetime.

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
