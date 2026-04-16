---
title: "03 - dbt: Observability"
tags: [pipeline, observability, dbt]
status: stable
updated: 2026-03-23
description: "Monitoring dbt runs with Datadog custom metrics, the elementary package for anomaly detection, artifact parsing, and Slack alerting for financial data pipelines."
---

# dbt: Observability

> [!quote]+
>
> "Monitoring is TDD for production. Observability is debugging for production -- give Future You the power to answer any question."
>
> Source: Charity Majors | charity.wtf (2018)

> [!abstract]- Summary
>
> Explains how to observe dbt operationally by turning execution artifacts into metrics, anomaly signals, schema-change alerts, and routed incidents across tools such as Elementary, Datadog, and Airflow callbacks.
>
> **Artifact-driven observability**
> - Covers the main dbt execution artifacts, especially `run_results.json`, and the key fields that reveal model status, runtime, row-level outcomes, and build metadata after every run
> - Shows how artifact parsing becomes the raw telemetry layer for run monitoring instead of relying only on whether the scheduler marked a task green or red
>
> **Package and platform integrations**
> - Covers Elementary installation, anomaly detection tests, schema-change tracking, CLI reporting, custom Python-to-DogStatsD metric shipping, and Datadog naming conventions so dbt results become searchable and alertable in the monitoring stack
> - Connects warehouse quality signals to generic infrastructure monitoring rather than isolating dbt health inside the transformation team
>
> **Alerting and incident routing**
> - Covers source freshness metrics, Airflow failure callbacks, Datadog monitors, and Slack-style escalation paths so dbt failures are routed before downstream consumers discover them manually
> - Frames observability as both metric collection and response design: the useful signal is the one that leads quickly to the right on-call action
>
> **Operations and safety**
> - Warnings: treating dbt success as binary without artifact detail, shipping noisy metrics without naming discipline, missing freshness alerts, and alerting paths that page too late or without enough execution context
> - Recommendations: parse artifacts systematically, make metric names stable, combine package-level and custom monitoring, and wire freshness, failures, and schema drift into the same incident response surface

> [!info]- Glossary
>
> **dbt artifact**
> - A structured file emitted by dbt after compilation or execution, containing metadata about the project, graph, and run results.
> - It matters here because observability starts from artifact parsing rather than from guessing what happened inside a black-box run.
>
> > [!info] Structured telemetry source
> >
> > Artifacts are valuable because they provide machine-readable run details. They let teams build monitoring on top of dbt's actual execution state, not just scheduler success flags.
>
> ---
>
> **`run_results.json`**
> - The dbt artifact that records per-node execution outcomes such as status, timing, and adapter responses for a run.
> - It matters here because most operational metrics and failure triage signals start from this file.
>
> > [!warning] Green run is not enough detail
> >
> > A run can succeed while still hiding slow models or warnings. `run_results.json` is what exposes the per-model story behind the top-level status.
>
> ---
>
> **Manifest**
> - The dbt artifact that describes project nodes, metadata, dependencies, and configuration state.
> - It matters here because observability and reporting often need both execution results and static graph context to explain what failed and why it matters.
>
> > [!info] Execution plus context
> >
> > Results without manifest context show what happened, but not always what the node represents or who depends on it. The manifest completes that picture.
>
> ---
>
> **Elementary**
> - A dbt-focused observability package and reporting tool that layers tests, anomaly detection, and reporting over dbt projects.
> - It matters here because it provides a ready-made observability surface instead of requiring every team to build all dbt monitoring primitives from scratch.
>
> > [!info] dbt-native observability layer
> >
> > Elementary is useful because it speaks dbt concepts directly. That can accelerate alerting and reporting compared with building every signal in a generic monitoring tool alone.
>
> ---
>
> **Anomaly detection**
> - The detection of unusual behavior in metrics such as row counts, freshness, or value distributions relative to historical baselines.
> - It matters here because many real data failures are not hard test failures; they are unusual shifts that need monitoring rather than strict assertions.
>
> > [!warning] Best when paired with context
> >
> > Anomaly alerts are useful only when someone can tell whether the shift is expected, benign, or production-impacting. Noise without context degrades trust quickly.
>
> ---
>
> **Schema change tracking**
> - The detection and reporting of changes in model or source column structure over time.
> - It matters here because schema drift is a major source of broken downstream jobs and often needs visibility even before it becomes a contract violation.
>
> > [!warning] Drift often starts quietly
> >
> > By the time a downstream consumer breaks, the schema change may already have propagated. Early visibility gives teams time to decide whether the change is intended or dangerous.
>
> ---
>
> **DogStatsD**
> - The metrics ingestion protocol commonly used to push custom metrics into Datadog.
> - It matters here because custom dbt runtime metrics often travel through DogStatsD before they appear in dashboards or monitors.
>
> > [!info] Metric transport layer
> >
> > DogStatsD is not the observability strategy by itself; it is the delivery mechanism that turns parsed dbt signals into monitorable platform metrics.
>
> ---
>
> **Datadog**
> - A monitoring platform used to collect metrics, create dashboards, and trigger alerts for dbt-related operational signals.
> - It matters here because the note shows how dbt observability becomes actionable only after metrics land in a shared monitoring surface.
>
> > [!warning] Naming discipline matters
> >
> > If metric names and tags are inconsistent, dashboards and alerts become hard to trust or reuse. Monitoring structure is part of observability quality.
>
> ---
>
> **Source freshness metric**
> - A monitoring signal derived from how old the latest loaded source data is relative to expected arrival thresholds.
> - It matters here because freshness is often the first signal that an upstream feed or ingestion job has failed before transformation logic even starts.
>
> > [!warning] Upstream failure arrives downstream fast
> >
> > Freshness alerts are some of the highest-value data alerts because they detect missing upstream inputs before marts and dashboards quietly age out.
>
> ---
>
> **Failure callback**
> - Scheduler-side logic, often in Airflow, that executes when a dbt-related task fails and can forward the event into alerting systems.
> - It matters here because observability is incomplete if execution failures are logged but never routed to the people responsible for recovery.
>
> > [!info] Signal routing layer
> >
> > A callback is what turns a failed task into an incident signal with context. Without it, failures remain visible only to whoever happens to inspect the scheduler UI.
>
> ---
>
> **Monitor**
> - A rules-based alert in a monitoring platform that evaluates metrics or events and decides when to notify responders.
> - It matters here because dbt observability only becomes operationally useful when the right thresholds and routing logic are defined on top of the collected signals.
>
> > [!warning] Thresholds shape pager quality
> >
> > Poorly tuned monitors create either silence or alert fatigue. Good observability depends on thresholds and routing being calibrated to real operational impact.

## dbt Artifacts Overview

| File | Generated by | Key Contents |
|------|-------------|--------------|
| `manifest.json` | `dbt compile`, `dbt run`, `dbt docs generate` | Full DAG: nodes, sources, exposures, SQL, metadata |
| `run_results.json` | `dbt run`, `dbt test`, `dbt build` | Per-node execution time, status, adapter response |
| `catalog.json` | `dbt docs generate` | Column types and row counts from warehouse info schema |
| `sources.json` | `dbt source freshness` | Source freshness check results |

All files land in the `target/` directory. In CI/CD they are uploaded to GCS for retention and cross-job sharing.

### dbt Artifacts — Key Fields in run_results.json

```json
{
  "metadata": {"dbt_version": "1.8.3", "generated_at": "2026-03-23T05:12:44Z"},
  "results": [
    {
      "unique_id": "model.financial_indices.fct_esg_scores",
      "status": "success",
      "execution_time": 47.3,
      "adapter_response": {"rows_affected": 182400},
      "failures": null,
      "message": "CREATE TABLE (182400 rows, 2.1 GB processed)"
    },
    {
      "unique_id": "test.financial_indices.not_null_fct_esg_scores_issuer_id",
      "status": "fail",
      "execution_time": 3.1,
      "failures": 12,
      "message": "Got 12 results, configured to fail if != 0"
    }
  ]
}
```

---

### Python Script: Push dbt Results to DogStatsD

Parse `run_results.json` after each dbt run and emit custom metrics to the Datadog Agent's DogStatsD UDP endpoint.

```python
#!/usr/bin/env python3
"""post_run_metrics.py — emit dbt run results as Datadog custom metrics."""

import json
import sys
import time
from datadog import initialize, statsd

RUN_RESULTS_PATH = sys.argv[1] if len(sys.argv) > 1 else "target/run_results.json"
DD_HOST = "localhost"
DD_PORT = 8125

initialize(statsd_host=DD_HOST, statsd_port=DD_PORT)

with open(RUN_RESULTS_PATH) as f:
    run_results = json.load(f)

generated_at = run_results["metadata"]["generated_at"]
dbt_version = run_results["metadata"]["dbt_version"]

for result in run_results["results"]:
    unique_id = result["unique_id"]
    node_type = unique_id.split(".")[0]   # "model", "test", "snapshot"
    node_name = unique_id.split(".")[-1]
    status = result["status"]             # success | error | fail | warn | skipped
    execution_time = result.get("execution_time", 0)
    failures = result.get("failures") or 0

    base_tags = [
        f"node_type:{node_type}",
        f"node_name:{node_name}",
        f"status:{status}",
        f"dbt_version:{dbt_version}",
        "pipeline:esg_transformer",
    ]

    # Execution duration per model
    statsd.gauge(
        "dbt.model.execution_time_seconds",
        execution_time,
        tags=base_tags,
    )

    # Test failure count (0 = passing)
    if node_type == "test":
        statsd.gauge(
            "dbt.test.failure_count",
            failures,
            tags=base_tags,
        )

    # Increment success/failure counters
    if status == "success":
        statsd.increment("dbt.node.success", tags=base_tags)
    elif status in ("error", "fail"):
        statsd.increment("dbt.node.failure", tags=base_tags)

# Emit overall pipeline status
all_statuses = {r["status"] for r in run_results["results"]}
pipeline_success = 1 if all_statuses <= {"success", "warn", "skipped"} else 0
statsd.gauge("dbt.pipeline.success", pipeline_success, tags=["pipeline:esg_transformer"])

print(f"Emitted metrics for {len(run_results['results'])} nodes.")
```

Invoke in the Airflow DAG after dbt completes:

```python
from airflow.operators.bash import BashOperator

emit_metrics = BashOperator(
    task_id="emit_dbt_metrics",
    bash_command="python /opt/scripts/post_run_metrics.py /opt/dbt/financial_indices/target/run_results.json",
    trigger_rule="all_done",   # run even if dbt failed
)
```

---

## elementary Package

[elementary-data](https://docs.elementary-data.com/) is an open-source dbt package that adds:

- Anomaly detection on metric values, row counts, null rates, and schema.
- A metadata schema inside your warehouse for storing test results.
- A CLI report (`edr`) for browsing historical test results.

### Installation

```yaml
# packages.yml
packages:
  - package: elementary-data/elementary
    version: [">=0.14.0", "<0.15.0"]
```

```yaml
# dbt_project.yml — elementary schema in its own dataset
models:
  elementary:
    +schema: elementary
    +materialized: table
```

```bash
dbt deps && dbt run --select elementary
```

### Anomaly Detection Tests

```yaml
# models/marts/esg/schema.yml
models:
  - name: fct_esg_scores
    columns:
      - name: environmental_score
        tests:
          - elementary.column_anomalies:
              column_anomalies:
                - null_count
                - null_percent
                - average
                - standard_deviation
              timestamp_column: score_date
              days_back: 30
              time_bucket:
                period: day
                count: 1

  - name: fct_index_composition
    tests:
      - elementary.table_anomalies:
          table_anomalies:
            - row_count
            - freshness
          timestamp_column: composition_date
          days_back: 14
```

### Schema Change Tracking

```yaml
models:
  - name: stg_esg_provider_raw
    tests:
      - elementary.schema_changes
      - elementary.schema_changes_from_baseline:
          fail_on_added: false
          fail_on_removed: true
```

`schema_changes_from_baseline` is critical for ESG provider feeds: if a provider silently drops a column (e.g., `governance_controversy_score`), the test fails immediately rather than silently propagating nulls into benchmark calculations.

### elementary CLI Report

```bash
pip install elementary-data[bigquery]
edr report --project-dir /opt/dbt/financial_indices --days-back 7
```

Generates an HTML report with test result history, anomaly trend charts, and model run durations.

---

## Monitoring dbt in Datadog

### dbt Datadog Monitoring — Custom Metric Naming Convention

```
dbt.model.execution_time_seconds   (gauge)   — tagged: node_name, status
dbt.test.failure_count             (gauge)   — tagged: node_name, test_type
dbt.node.success                   (count)   — tagged: node_type
dbt.node.failure                   (count)   — tagged: node_type
dbt.pipeline.success               (gauge)   — 1 = success, 0 = failure
dbt.source.freshness_minutes_lag   (gauge)   — from sources.json
```

### dbt Datadog Monitoring — Source Freshness Metric

```python
import json
from datadog import statsd

with open("target/sources.json") as f:
    sources = json.load(f)

for source_name, result in sources.get("sources", {}).items():
    max_loaded = result.get("max_loaded_at")
    if max_loaded:
        import datetime, pytz
        loaded_dt = datetime.datetime.fromisoformat(max_loaded.replace("Z", "+00:00"))
        lag_minutes = (datetime.datetime.now(pytz.utc) - loaded_dt).total_seconds() / 60
        statsd.gauge(
            "dbt.source.freshness_minutes_lag",
            lag_minutes,
            tags=[f"source:{source_name}", "pipeline:esg_transformer"],
        )
```

---

## Alerting: Airflow Callback → Datadog → Slack

### dbt Alerting — Airflow Failure Callback to Datadog

```python
import os
import requests

def notify_datadog_and_slack(context: dict):
    task_id = context["task_instance"].task_id
    dag_id = context["dag"].dag_id
    run_id = context["run_id"]
    log_url = context["task_instance"].log_url

    # Post event to Datadog
    requests.post(
        "https://api.datadoghq.eu/api/v1/events",
        headers={"DD-API-KEY": os.environ["DD_API_KEY"]},
        json={
            "title": f"dbt failure: {dag_id}.{task_id}",
            "text": f"Run ID: {run_id}\nLogs: {log_url}",
            "alert_type": "error",
            "tags": ["pipeline:esg_transformer", "source:airflow"],
        },
    )

    # Post to Slack via webhook
    requests.post(
        os.environ["SLACK_WEBHOOK_URL"],
        json={
            "text": (
                f":x: *dbt failure* in `{dag_id}.{task_id}`\n"
                f"Run: `{run_id}`\n"
                f"<{log_url}|View logs>"
            )
        },
    )

default_args = {"on_failure_callback": notify_datadog_and_slack}
```

### Datadog Monitor for Pipeline Failure

Create a Datadog monitor on `dbt.pipeline.success` that pages the on-call engineer if the metric drops to `0` for two consecutive checks:

```json
{
  "name": "ESG dbt pipeline failed",
  "type": "metric alert",
  "query": "min(last_2):avg:dbt.pipeline.success{pipeline:esg_transformer} < 1",
  "message": "@pagerduty-data-oncall Pipeline failure detected. Check Airflow for details.",
  "thresholds": {"critical": 1}
}
```

---

## Dashboard Template: Model Durations, Test Failures, Freshness

### Widgets to Include

| Widget | Metric / Source | Visualisation |
|--------|----------------|---------------|
| Pipeline success rate | `dbt.pipeline.success` | SLO widget (28-day window) |
| Top 10 slowest models (today) | `dbt.model.execution_time_seconds` | Horizontal bar, grouped by `node_name` |
| Test failure count by model | `dbt.test.failure_count` | Heat map — model × day |
| Source freshness lag | `dbt.source.freshness_minutes_lag` | Time series — threshold line at SLA |
| Daily node success/failure | `dbt.node.success`, `dbt.node.failure` | Stacked bar chart |
| Elementary anomalies | elementary schema in BQ | BigQuery widget / iframe |
| Recent pipeline events | Datadog Events | Event stream widget |

### Terraform Snippet (Datadog Dashboard)

```hcl
resource "datadog_dashboard" "dbt_observability" {
  title       = "dbt — ESG Pipeline Observability"
  layout_type = "ordered"

  widget {
    timeseries_definition {
      title = "Model Execution Time (top 15)"
      request {
        q            = "top(avg:dbt.model.execution_time_seconds{pipeline:esg_transformer} by {node_name}, 15, 'mean', 'desc')"
        display_type = "bars"
      }
    }
  }

  widget {
    query_value_definition {
      title = "Pipeline Success (today)"
      request {
        q          = "min:dbt.pipeline.success{pipeline:esg_transformer}"
        aggregator = "min"
      }
      precision = 0
    }
  }
}
```

---

## Related

- [moc-observability](https://alp78.github.io/elysium/13-Observability/moc-observability)
- [datadog-dashboards](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-dashboards)
- [dbt-packages](https://alp78.github.io/elysium/11-dbt/Advanced/dbt-packages)
- [dbt-airflow-integration](https://alp78.github.io/elysium/11-dbt/Operations/dbt-airflow-integration)
- [dbt-ci-cd](https://alp78.github.io/elysium/11-dbt/Operations/dbt-ci-cd)
