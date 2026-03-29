---
type: concept
category: gcp
technology: [gcp, bigquery]
tags: [infrastructure, bigquery, gcp]
aliases: [BigQuery jobs, bq jobs, bq cancel, bq show job, BigQuery job listing]
keywords: [bq jobs, job management, bq ls -j, bq show -j, bq cancel, job id, job errors, bytes processed, query history, cancel query, runaway query, job details]
description: "How to list, inspect, and cancel BigQuery jobs using the bq CLI — essential for diagnosing failed queries, understanding cost history, and stopping accidental large scans."
related: [querying-and-cost-optimization, data-loading-and-export, dataset-and-table-management, cloud-logging, cloud-monitoring-metrics]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# BigQuery Job Management

Every BigQuery operation — query, load, export, copy — creates a job. Jobs are the unit of work in BigQuery. Understanding how to list jobs, inspect their details (including errors and bytes processed), and cancel runaway jobs is essential for incident response and cost governance. The job history is also your primary audit trail for understanding what ran, who ran it, and how much it cost.

### Listing Recent BigQuery Jobs

```bash
# List recent jobs
bq ls -j --max_results=10
# -j = list jobs (not datasets)
```

### Inspecting BigQuery Job Details

```bash
# Show job details (query text, bytes processed, errors)
bq show -j <job_id> --format=prettyjson
```

The job detail output includes:
- **`configuration.query.query`** — the full SQL text that was executed
- **`statistics.query.totalBytesProcessed`** — bytes scanned (convert to cost)
- **`status.state`** — `RUNNING`, `DONE`, `PENDING`
- **`status.errors`** — error messages if the job failed
- **`statistics.creationTime`** / **`statistics.endTime`** — timing information

### Canceling a Running BigQuery Query

```bash
# Cancel a running query
bq cancel <job_id>
# Use case: accidentally kicked off a SELECT * on a petabyte table
```

> [!tip] Cancel Before the Bill Arrives
>
> BigQuery charges are based on bytes *scanned*, which accumulates as a query runs. Canceling a query mid-execution stops the scan and limits the charge to bytes processed up to that point. If you catch an accidental large scan quickly, you can significantly reduce the cost.

### Finding the BigQuery Job ID

Job IDs appear in:
- The output of `bq query` (printed when the query starts)
- `bq ls -j` listings
- The BigQuery console (job history tab)
- [[cloud-logging|Cloud Logging]] entries for BigQuery audit logs (resource type `bigquery_resource`)

### BigQuery Job States Reference

| State | Meaning |
|---|---|
| `PENDING` | Queued, waiting for slot allocation |
| `RUNNING` | Currently executing |
| `DONE` | Completed (check `status.errors` for failures) |

### Cost Recovery by Querying BigQuery Job History with SQL

For a more powerful view of job history and cost, use `INFORMATION_SCHEMA.JOBS` directly in BigQuery SQL (see [[querying-and-cost-optimization]] for the full query). The `bq ls -j` command is useful for quick command-line checks, but SQL against `INFORMATION_SCHEMA` gives you full analytical power over the job history.

## Related

- [[querying-and-cost-optimization]] — Dry runs before execution and INFORMATION_SCHEMA cost queries
- [[data-loading-and-export]] — Load and export operations also create BQ jobs
- [[cloud-logging]] — BigQuery jobs emit audit logs visible in Cloud Logging
- [[cloud-monitoring-metrics]] — `bigquery.googleapis.com/query/count` and slot usage metrics

## References

- [BigQuery job management](https://cloud.google.com/bigquery/docs/managing-jobs)
- [INFORMATION_SCHEMA.JOBS](https://cloud.google.com/bigquery/docs/information-schema-jobs)
