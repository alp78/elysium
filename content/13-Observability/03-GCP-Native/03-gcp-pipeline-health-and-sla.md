---
title: "03 - GCP Pipeline Health and SLA"
tags: [monitoring, pipeline, observability, python, bash, gcp]
aliases:
  - pipeline health
  - SLA monitoring
  - data freshness
  - pipeline SLA
  - staleness check
  - freshness monitoring
  - pipeline heartbeat
  - dead man's switch
description: >
  End-to-end operational runbook for pipeline health monitoring and SLA tracking
  using GCP-native tooling. Covers data freshness, quality checks, SLA definition
  and measurement, alerting triage decision trees, on-call procedures, and
  self-healing automation patterns — no third-party APM required.
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Pipeline Health and SLA

> [!quote]
> "SRE is what happens when you ask a software engineer to design an operations function."
>
> — **Ben Treynor Sloss**, *Site Reliability Engineering* (2016)
>
> "There are only three kinds of valid monitoring output: alerts that require immediate human action, tickets for non-urgent issues, and logging for diagnostics."
>
> — **Ben Treynor Sloss**, *Site Reliability Engineering* (2016)

> [!abstract]- Summary
>
> This note turns GCP-native observability into a pipeline reliability loop: freshness, correctness, completeness, SLA tracking, heartbeat monitoring, operator runbooks, and self-healing automation are all treated as one operating model for deciding whether data is safe to publish and when humans need to intervene.
>
> **Health model**
> - Defines pipeline health through freshness, correctness, and completeness, then maps common failure modes onto those three questions.
> - Establishes a policy vocabulary so alerts and dashboards reflect business risk instead of only process exit codes.
>
> **Freshness and quality checks**
> - Covers freshness tables, custom metrics, metadata-driven freshness, and quality checks such as row counts, null rates, schema drift, duplicates, and value-distribution rules.
> - Treats data quality as an observability concern because a successful run can still publish unusable data.
>
> **SLA and heartbeat monitoring**
> - Explains SLA definition, tracking tables, reporting, dead man's switch patterns, and metric-absence detection for pipelines that silently stop running.
> - Brings schedule adherence and business timeliness into the same health model as data quality.
>
> **Response and automation**
> - Ends with the alerting runbook, on-call playbook, self-healing patterns, and dashboard guidance used once a health signal breaks.
> - When to use: the platform needs a full operational model for pipeline reliability, not just isolated metric examples.

> [!note]- Glossary
>
> **data freshness**
> - The age of the latest successful data relative to the expected update cadence.
> - It matters here because stale but technically successful data is one of the most dangerous pipeline failure modes.
>
> > [!info] Business-facing timeliness
> >
> > Infrastructure can look healthy while the product is already too old to trust.
>
> ---
>
> **SLA**
> - The explicit service-level promise about pipeline timeliness or reliability.
> - It matters here because the note treats pipeline reliability as a measurable commitment rather than an informal expectation.
>
> > [!tip] Reliability contract
> >
> > An SLA defines what counts as late or unacceptable before an incident begins.
>
> ---
>
> **heartbeat**
> - A recurring signal that proves a pipeline or watcher is still running as expected.
> - It matters here because some failures look like silence rather than errors.
>
> > [!info] Signal of life
> >
> > Missing expected activity can be just as operationally important as observed failure.
>
> ---
>
> **metric absence alert**
> - An alert condition that fires when an expected metric stops arriving.
> - It matters here because dead-man scenarios often have no error event to count.
>
> > [!tip] Silence is detectable
> >
> > Absence-based alerts are how monitoring catches things that simply stopped emitting.
>
> ---
>
> **row count validation**
> - A quality check that compares observed row counts against expected ranges or prior runs.
> - It matters here because pipelines can succeed operationally while writing far too little or too much data.
>
> > [!info] Cheap high-value quality gate
> >
> > Row counts are simple, but they catch many of the most damaging silent failures.
>
> ---
>
> **null-rate check**
> - A validation that measures whether the fraction of null values in a field exceeds the allowed threshold.
> - It matters here because pipelines often degrade gradually through missing data before they fail outright.
>
> > [!tip] Quality degradation signal
> >
> > Null inflation is often the earliest sign of an upstream contract problem.
>
> ---
>
> **schema drift**
> - A change in source or target structure that can break assumptions in downstream transformations or consumers.
> - It matters here because structural changes frequently produce silent bad data when they are not detected quickly.
>
> > [!info] Shape changed underneath you
> >
> > Schema drift is dangerous precisely because the pipeline may keep running while semantics break.
>
> ---
>
> **dead man's switch**
> - A monitoring pattern that alerts unless a scheduled process reports in within the expected window.
> - It matters here because pipelines that never start leave no normal failure trace behind.
>
> > [!tip] Alert on non-occurrence
> >
> > This pattern protects against the invisible failure where nothing happened at all.
>
> ---
>
> **auto-remediation**
> - An automated recovery action triggered by a detected failure condition.
> - It matters here because some pipeline faults can be handled faster and more safely by code than by waking a human immediately.
>
> > [!info] Automation after detection
> >
> > Self-healing helps most when the failure mode is well understood and the recovery action is safe to repeat.
>
> ---
>
> **on-call playbook**
> - The documented response sequence for investigating and mitigating a live pipeline incident.
> - It matters here because observability is only valuable if responders know what to do with the signal.
>
> > [!tip] Detection needs procedure
> >
> > Runbooks turn alerts from noise into action.

## Pipeline Health Monitoring Philosophy

Three questions answer whether a pipeline is healthy:

1. **Is data fresh?** — When did the last successful run complete, and is that recent enough?
2. **Is data correct?** — Are values in expected ranges? Null rates acceptable? No schema drift?
3. **Is data complete?** — Do all expected partitions, tables, and date ranges exist?

Every monitoring check maps to one of these. Build dashboards and alerts around all three axes, not just whether the pipeline process exited with code 0.

### Failure Mode Taxonomy

| Failure Mode | Question | Detection Method |
|---|---|---|
| Pipeline never started | Fresh? | Dead man's switch / heartbeat |
| Pipeline started, never finished | Fresh? | Execution duration alert |
| Pipeline finished but wrote wrong data | Correct? | Row count / null rate / distribution checks |
| Pipeline wrote partial data | Complete? | Partition existence checks |
| Pipeline wrote stale source data | Fresh? | Source-vs-destination lag check |
| Pipeline succeeded but silently corrupted | Correct? | Schema drift + value range alerts |

> [!tip] The silent failure problem
> A pipeline can exit 0 and write zero rows. Log-based failure detection misses this entirely. Row count and freshness checks are your second line of defense.

---

## Data Freshness Monitoring

### Pattern 1: Freshness Table in SQL Server

Maintain a lightweight state table that every pipeline updates. This gives you a single queryable source of truth for all pipeline statuses.

```sql
CREATE TABLE dbo.pipeline_freshness (
    pipeline_name    VARCHAR(100)  PRIMARY KEY,
    last_success_utc DATETIME2(0),
    last_attempt_utc DATETIME2(0),
    rows_processed   INT,
    duration_seconds INT,
    status           VARCHAR(20),   -- 'success', 'failed', 'running'
    error_message    VARCHAR(1000)
);
```

Update on pipeline start:

```sql
MERGE dbo.pipeline_freshness AS target
USING (SELECT 'my_pipeline' AS pipeline_name) AS source
ON target.pipeline_name = source.pipeline_name
WHEN MATCHED THEN
    UPDATE SET status = 'running', last_attempt_utc = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (pipeline_name, status, last_attempt_utc)
    VALUES ('my_pipeline', 'running', SYSUTCDATETIME());
```

Update on success:

```sql
UPDATE dbo.pipeline_freshness
SET
    last_success_utc = SYSUTCDATETIME(),
    rows_processed   = @rows_processed,
    duration_seconds = @duration_seconds,
    status           = 'success',
    error_message    = NULL
WHERE pipeline_name = 'my_pipeline';
```

Query for stale pipelines — any pipeline that should have run within 2 hours but hasn't:

```sql
SELECT
    pipeline_name,
    last_success_utc,
    status,
    DATEDIFF(MINUTE, last_success_utc, SYSUTCDATETIME()) AS minutes_stale
FROM dbo.pipeline_freshness
WHERE DATEDIFF(MINUTE, last_success_utc, SYSUTCDATETIME()) > 120
   OR status = 'failed'
ORDER BY minutes_stale DESC;
```

> [!note] Use SYSUTCDATETIME() consistently
> Store all timestamps in UTC. Mixing UTC and local time in a freshness table produces wrong staleness calculations during DST transitions.

### Pattern 2: Custom Metric for Freshness

Push data age as a gauge metric to Cloud Monitoring. This enables alerting, dashboards, and SLO tracking in the same tool used for all other GCP metrics.

#### Python — write freshness metric

```python
from google.cloud import monitoring_v3
from datetime import datetime, timezone
import time

def push_freshness_metric(project_id: str, pipeline_name: str, last_success_epoch: float):
    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{project_id}"

    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/pipeline/data_freshness_seconds"
    series.metric.labels["pipeline_name"] = pipeline_name
    series.resource.type = "global"
    series.resource.labels["project_id"] = project_id

    now = time.time()
    freshness_seconds = now - last_success_epoch

    point = monitoring_v3.Point()
    point.value.double_value = freshness_seconds
    now_pb = monitoring_v3.TimeInterval()
    now_pb.end_time.seconds = int(now)
    point.interval = now_pb

    series.points = [point]
    client.create_time_series(name=project_name, time_series=[series])
    print(f"Pushed freshness: {freshness_seconds:.0f}s for {pipeline_name}")
```

#### Create alerting policy on freshness metric

```bash
# Create metric descriptor first (idempotent)
gcloud monitoring metrics-descriptors create \
  --project=PROJECT_ID \
  --type="custom.googleapis.com/pipeline/data_freshness_seconds" \
  --metric-kind=GAUGE \
  --value-type=DOUBLE \
  --description="Seconds since last successful pipeline completion" \
  --display-name="Pipeline Data Freshness"

# Create alert: fire when freshness > 7200 seconds (2 hours)
gcloud alpha monitoring policies create \
  --display-name="Pipeline Stale: data_freshness > 2h" \
  --condition-display-name="Freshness exceeded 2h" \
  --condition-filter='metric.type="custom.googleapis.com/pipeline/data_freshness_seconds"' \
  --condition-threshold-value=7200 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-duration=60s \
  --notification-channels=CHANNEL_ID \
  --project=PROJECT_ID
```

### Pattern 3: Freshness via BigQuery Metadata

BigQuery exposes table modification timestamps without any instrumentation on your part.

```sql
-- Last modified time for every table in a dataset
SELECT
    table_id,
    TIMESTAMP_MILLIS(last_modified_time) AS last_modified,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) AS hours_since_modified,
    row_count,
    size_bytes / POW(1024, 3) AS size_gb
FROM `PROJECT.DATASET.__TABLES__`
ORDER BY last_modified_time DESC;
```

```sql
-- Tables that haven't been updated in > 25 hours (missed daily run)
SELECT
    table_id,
    TIMESTAMP_MILLIS(last_modified_time) AS last_modified
FROM `PROJECT.DATASET.__TABLES__`
WHERE TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) > 25
ORDER BY last_modified_time ASC;
```

#### Automated freshness check script (Python)

```python
from google.cloud import bigquery
from datetime import datetime, timezone, timedelta

def check_bq_freshness(project: str, dataset: str, max_age_hours: int = 25) -> list[dict]:
    client = bigquery.Client(project=project)
    query = f"""
        SELECT
            table_id,
            TIMESTAMP_MILLIS(last_modified_time) AS last_modified,
            TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) AS hours_stale
        FROM `{project}.{dataset}.__TABLES__`
        WHERE TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) > {max_age_hours}
        ORDER BY hours_stale DESC
    """
    results = client.query(query).result()
    stale = []
    for row in results:
        stale.append({
            "table": f"{project}.{dataset}.{row.table_id}",
            "last_modified": row.last_modified.isoformat(),
            "hours_stale": row.hours_stale,
        })
    return stale

if __name__ == "__main__":
    stale_tables = check_bq_freshness("my-project", "my_dataset", max_age_hours=25)
    for t in stale_tables:
        print(f"STALE [{t['hours_stale']}h]: {t['table']} (last modified {t['last_modified']})")
    if stale_tables:
        exit(1)  # Non-zero exit triggers Cloud Scheduler alert or CI failure
```

> [!warning] __TABLES__ and streaming inserts
>
> `__TABLES__` reflects DML completion, not streaming inserts. For streaming-insert pipelines, `last_modified_time` updates only after a query or DML touches the table. Use `INFORMATION_SCHEMA.STREAMING_TIMELINE` or a custom freshness metric instead.

> [!success] Safe pattern for streaming pipelines
>
> Query `INFORMATION_SCHEMA.STREAMING_TIMELINE` for up-to-date ingestion stats on streaming-insert tables, or push a custom freshness metric after each streaming batch completes. This gives accurate freshness signals regardless of DML activity on the table.

---

## Data Quality Checks

### Row Count Validation

Row count is the fastest quality signal. Zero rows after a pipeline run is almost always wrong.

```python
from google.cloud import bigquery

def validate_row_count(
    project: str,
    table: str,
    partition_date: str,
    min_expected: int,
    max_expected: int,
) -> dict:
    client = bigquery.Client(project=project)
    query = f"""
        SELECT COUNT(*) AS row_count
        FROM `{table}`
        WHERE DATE(load_timestamp) = '{partition_date}'
    """
    row = next(client.query(query).result())
    actual = row.row_count
    passed = min_expected <= actual <= max_expected
    return {
        "table": table,
        "date": partition_date,
        "actual_rows": actual,
        "min_expected": min_expected,
        "max_expected": max_expected,
        "passed": passed,
        "message": "OK" if passed else f"Row count {actual} outside [{min_expected}, {max_expected}]",
    }
```

Alert thresholds:

| Condition | Severity | Action |
|---|---|---|
| 0 rows | Critical | Page on-call immediately |
| Row count drops > 20% vs 7-day avg | Warning | Alert, investigate source |
| Row count spikes > 200% vs 7-day avg | Warning | Alert, check for duplicate loads |
| Row count drops > 50% vs 7-day avg | Critical | Page on-call |

#### day average comparison in BigQuery

```sql
WITH daily_counts AS (
    SELECT
        DATE(load_timestamp) AS load_date,
        COUNT(*) AS row_count
    FROM `PROJECT.DATASET.TABLE`
    WHERE DATE(load_timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
    GROUP BY 1
),
baseline AS (
    SELECT AVG(row_count) AS avg_7d
    FROM daily_counts
    WHERE load_date < CURRENT_DATE()
      AND load_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
),
today AS (
    SELECT row_count AS today_count
    FROM daily_counts
    WHERE load_date = CURRENT_DATE()
)
SELECT
    today_count,
    avg_7d,
    SAFE_DIVIDE(today_count - avg_7d, avg_7d) AS pct_change,
    CASE
        WHEN today_count = 0 THEN 'CRITICAL: zero rows'
        WHEN today_count < avg_7d * 0.8 THEN 'WARNING: count dropped >20%'
        WHEN today_count > avg_7d * 2.0 THEN 'WARNING: count spiked >100%'
        ELSE 'OK'
    END AS status
FROM today, baseline;
```

### Null Rate Monitoring

Track null rates on columns that must be populated. Push as a custom metric so you can trend over time.

```sql
SELECT
    COUNT(*)                                                                              AS total_rows,
    SUM(CASE WHEN important_column IS NULL THEN 1 ELSE 0 END)                            AS null_count,
    CAST(SUM(CASE WHEN important_column IS NULL THEN 1 ELSE 0 END) AS FLOAT64) / COUNT(*) AS null_rate
FROM `PROJECT.DATASET.TABLE`
WHERE DATE(load_timestamp) = CURRENT_DATE();
```

#### Push null rate as custom metric

```python
import time
from google.cloud import monitoring_v3, bigquery

def check_and_push_null_rate(project: str, table_fqn: str, column: str, threshold: float = 0.01):
    bq = bigquery.Client(project=project)
    dataset, tbl = table_fqn.split(".")[-2], table_fqn.split(".")[-1]

    query = f"""
        SELECT
            SAFE_DIVIDE(
                COUNTIF({column} IS NULL),
                COUNT(*)
            ) AS null_rate
        FROM `{table_fqn}`
        WHERE DATE(load_timestamp) = CURRENT_DATE()
    """
    row = next(bq.query(query).result())
    null_rate = row.null_rate or 0.0

    # Push metric
    mc = monitoring_v3.MetricServiceClient()
    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/pipeline/null_rate"
    series.metric.labels["table"] = f"{dataset}.{tbl}"
    series.metric.labels["column"] = column
    series.resource.type = "global"
    series.resource.labels["project_id"] = project

    point = monitoring_v3.Point()
    point.value.double_value = null_rate
    interval = monitoring_v3.TimeInterval()
    interval.end_time.seconds = int(time.time())
    point.interval = interval
    series.points = [point]
    mc.create_time_series(name=f"projects/{project}", time_series=[series])

    if null_rate > threshold:
        raise ValueError(f"Null rate {null_rate:.4%} on {column} exceeds threshold {threshold:.4%}")

    return null_rate
```

### Schema Drift Detection

Schema drift is a silent killer. A source system adds a column, renames one, or changes a type — your pipeline loads the data, but downstream queries break days later.

```python
from google.cloud import bigquery
import json

def check_schema_drift(project: str, dataset: str, table: str, expected_schema_path: str) -> list[dict]:
    client = bigquery.Client(project=project)
    table_ref = client.get_table(f"{project}.{dataset}.{table}")
    current_schema = {f.name: f.field_type for f in table_ref.schema}

    with open(expected_schema_path) as f:
        expected_schema = json.load(f)  # {"column_name": "STRING", ...}

    issues = []
    for col, dtype in expected_schema.items():
        if col not in current_schema:
            issues.append({"type": "REMOVED_COLUMN", "column": col, "expected_type": dtype})
        elif current_schema[col] != dtype:
            issues.append({
                "type": "TYPE_CHANGED",
                "column": col,
                "expected_type": dtype,
                "actual_type": current_schema[col],
            })

    for col in current_schema:
        if col not in expected_schema:
            issues.append({"type": "NEW_COLUMN", "column": col, "actual_type": current_schema[col]})

    return issues

def save_current_schema(project: str, dataset: str, table: str, output_path: str):
    client = bigquery.Client(project=project)
    table_ref = client.get_table(f"{project}.{dataset}.{table}")
    schema = {f.name: f.field_type for f in table_ref.schema}
    with open(output_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Schema saved to {output_path}")
```

#### gcloud shortcut to view current schema

```bash
bq show --schema --format=prettyjson PROJECT:DATASET.TABLE
```

> [!warning] Schema drift alert strategy
> Any NEW_COLUMN is informational. REMOVED_COLUMN or TYPE_CHANGED should be Critical. Automate this check as part of the pipeline post-load step, not as a separate scheduled job — catching drift at load time prevents downstream propagation.

> [!success] Implement drift detection as a post-load gate
>
> Save the expected schema to a JSON file with `save_current_schema()` after a known-good run. Run `check_schema_drift()` in the pipeline's post-load step, raise on REMOVED_COLUMN or TYPE_CHANGED, and log NEW_COLUMN as informational. This halts propagation before downstream queries break.

### Duplicate Detection

```sql
-- Find duplicates on natural key
SELECT
    id_column,
    COUNT(*) AS cnt
FROM `PROJECT.DATASET.TABLE`
WHERE DATE(load_timestamp) = CURRENT_DATE()
GROUP BY id_column
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 100;
```

```sql
-- Duplicate rate as a single metric
WITH dupes AS (
    SELECT id_column, COUNT(*) AS cnt
    FROM `PROJECT.DATASET.TABLE`
    WHERE DATE(load_timestamp) = CURRENT_DATE()
    GROUP BY id_column
    HAVING COUNT(*) > 1
)
SELECT
    (SELECT COUNT(*) FROM `PROJECT.DATASET.TABLE` WHERE DATE(load_timestamp) = CURRENT_DATE()) AS total_rows,
    SUM(cnt) AS duplicate_rows,
    SAFE_DIVIDE(SUM(cnt), (SELECT COUNT(*) FROM `PROJECT.DATASET.TABLE` WHERE DATE(load_timestamp) = CURRENT_DATE())) AS dupe_rate
FROM dupes;
```

### Value Distribution Checks

Catch outliers before they reach downstream consumers.

```sql
-- Distribution sanity check: are numeric columns in expected ranges?
SELECT
    MIN(amount)          AS min_amount,
    MAX(amount)          AS max_amount,
    AVG(amount)          AS avg_amount,
    STDDEV(amount)       AS stddev_amount,
    APPROX_QUANTILES(amount, 100)[OFFSET(50)]  AS p50,
    APPROX_QUANTILES(amount, 100)[OFFSET(95)]  AS p95,
    APPROX_QUANTILES(amount, 100)[OFFSET(99)]  AS p99,
    COUNTIF(amount < 0)  AS negative_count,
    COUNTIF(amount > 1000000) AS outlier_count
FROM `PROJECT.DATASET.TABLE`
WHERE DATE(load_timestamp) = CURRENT_DATE();
```

---

## SLA Monitoring and Reporting

### Defining Pipeline SLAs

Every pipeline should have a documented SLA with three components:

- **Freshness target**: data must be available within N hours/minutes of source event
- **Availability target**: pipeline must succeed on X% of scheduled runs
- **Quality target**: null rate / duplicate rate / completeness within thresholds

| Pipeline | Freshness SLA | Availability SLA | Quality SLA |
|---|---|---|---|
| Daily ingest | < 2 hours after market close | 99.5% (miss ≤ 2 days/year) | < 0.1% null rate on key columns |
| Quarterly refresh | < 24 hours after quarter end | 99% | All expected segments populated |
| Real-time feed | < 5 minutes latency | 99.9% | < 0.01% data loss |
| Weekly report | < 4 hours after business open | 98% | All dimension joins resolve |

> [!tip] SLA vs SLO vs SLI
> **SLI** (indicator) = the measurement (e.g., data_freshness_seconds). **SLO** (objective) = the target (e.g., freshness < 7200s, 99.5% of the time). **SLA** (agreement) = the contract with consequences if SLO is breached. For internal data pipelines, you often only need SLIs and SLOs — SLAs imply penalties.

### SLA Tracking Table

```sql
CREATE TABLE dbo.pipeline_sla_log (
    id               INT IDENTITY PRIMARY KEY,
    pipeline_name    VARCHAR(100),
    run_date         DATE,
    scheduled_utc    DATETIME2(0),   -- When it was supposed to finish
    actual_utc       DATETIME2(0),   -- When it actually finished (NULL if failed)
    freshness_ok     BIT,            -- Finished within freshness SLA?
    quality_ok       BIT,            -- Quality checks passed?
    sla_met          BIT,            -- All components met?
    failure_reason   VARCHAR(500)
);
```

#### Python — SLA check function

```python
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
from typing import Optional

@dataclass
class PipelineSLA:
    pipeline_name: str
    freshness_sla_minutes: int
    availability_sla_pct: float     # e.g. 0.995
    max_null_rate: float            # e.g. 0.001
    scheduled_time: datetime        # UTC

def check_sla(sla: PipelineSLA, run_result: dict) -> dict:
    """
    run_result: {
        'completed_at': datetime (UTC) or None,
        'null_rate': float,
        'rows': int,
    }
    """
    now = datetime.now(timezone.utc)

    # Freshness check
    if run_result["completed_at"] is None:
        freshness_ok = False
        freshness_seconds = None
    else:
        freshness_seconds = (run_result["completed_at"] - sla.scheduled_time).total_seconds()
        freshness_ok = freshness_seconds <= sla.freshness_sla_minutes * 60

    # Quality check
    quality_ok = (
        run_result["null_rate"] <= sla.max_null_rate
        and run_result["rows"] > 0
    )

    sla_met = freshness_ok and quality_ok

    return {
        "pipeline": sla.pipeline_name,
        "run_date": sla.scheduled_time.date().isoformat(),
        "freshness_ok": freshness_ok,
        "freshness_seconds": freshness_seconds,
        "quality_ok": quality_ok,
        "null_rate": run_result["null_rate"],
        "rows": run_result["rows"],
        "sla_met": sla_met,
    }
```

#### Push SLA compliance as custom metric

```python
def push_sla_metric(project: str, pipeline_name: str, sla_met: bool):
    from google.cloud import monitoring_v3
    import time

    client = monitoring_v3.MetricServiceClient()
    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/pipeline/sla_compliance"
    series.metric.labels["pipeline_name"] = pipeline_name
    series.resource.type = "global"
    series.resource.labels["project_id"] = project

    point = monitoring_v3.Point()
    point.value.int64_value = 1 if sla_met else 0
    interval = monitoring_v3.TimeInterval()
    interval.end_time.seconds = int(time.time())
    point.interval = interval
    series.points = [point]

    client.create_time_series(name=f"projects/{project}", time_series=[series])
```

### Weekly SLA Report

```python
from google.cloud import bigquery
from datetime import date, timedelta

def generate_weekly_sla_report(project: str, dataset: str) -> str:
    client = bigquery.Client(project=project)
    week_start = date.today() - timedelta(days=7)

    query = f"""
        SELECT
            pipeline_name,
            COUNT(*) AS total_runs,
            COUNTIF(sla_met) AS runs_met,
            SAFE_DIVIDE(COUNTIF(sla_met), COUNT(*)) AS availability_pct,
            AVG(freshness_seconds) AS avg_freshness_s,
            MAX(freshness_seconds) AS max_freshness_s,
            AVG(null_rate) AS avg_null_rate
        FROM `{project}.{dataset}.sla_log`
        WHERE run_date >= '{week_start}'
        GROUP BY pipeline_name
        ORDER BY availability_pct ASC
    """
    rows = list(client.query(query).result())

    lines = [f"# Weekly SLA Report — {week_start} to {date.today()}", ""]
    for row in rows:
        status = "OK" if row.availability_pct >= 0.995 else "BREACH"
        lines.append(
            f"[{status}] {row.pipeline_name}: "
            f"{row.availability_pct:.2%} availability, "
            f"avg freshness {row.avg_freshness_s/60:.1f}m, "
            f"avg null rate {row.avg_null_rate:.4%}"
        )

    report = "\n".join(lines)
    print(report)
    return report
```

---

## Dead Man's Switch (Heartbeat Monitoring)

The hardest failure to detect: a pipeline that was supposed to run but never started. Log-based failure detection, Cloud Monitoring uptime checks, and alert-on-absence patterns all miss this without explicit heartbeat instrumentation.

### Strategy 1: HTTP Heartbeat Endpoint

Deploy a minimal Cloud Run service that stores the last heartbeat timestamp and responds to health checks.

```python
# heartbeat_service/main.py
import os
import time
from flask import Flask, jsonify, request
from google.cloud import firestore

app = Flask(__name__)
db = firestore.Client()

@app.route("/heartbeat", methods=["POST"])
def receive_heartbeat():
    pipeline = request.json.get("pipeline_name", "unknown")
    db.collection("heartbeats").document(pipeline).set({
        "last_beat": firestore.SERVER_TIMESTAMP,
        "pipeline_name": pipeline,
    })
    return jsonify({"status": "ok", "pipeline": pipeline})

@app.route("/health", methods=["GET"])
def health():
    # Cloud Monitoring uptime check hits this
    pipeline = request.args.get("pipeline", "daily_ingest")
    doc = db.collection("heartbeats").document(pipeline).get()
    if not doc.exists:
        return jsonify({"status": "no_data"}), 503

    data = doc.to_dict()
    age_seconds = time.time() - data["last_beat"].timestamp()
    max_age = int(request.args.get("max_age_seconds", 7200))

    if age_seconds > max_age:
        return jsonify({
            "status": "stale",
            "age_seconds": age_seconds,
            "pipeline": pipeline,
        }), 503

    return jsonify({"status": "ok", "age_seconds": age_seconds})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
```

Pipeline sends heartbeat on completion:

```python
import requests

def send_heartbeat(heartbeat_url: str, pipeline_name: str):
    resp = requests.post(
        f"{heartbeat_url}/heartbeat",
        json={"pipeline_name": pipeline_name},
        timeout=10,
    )
    resp.raise_for_status()
```

Create Cloud Monitoring uptime check on the health endpoint:

```bash
gcloud monitoring uptime-checks create http \
  --display-name="Pipeline Heartbeat: daily_ingest" \
  --uri="https://HEARTBEAT_SERVICE_URL/health?pipeline=daily_ingest&max_age_seconds=7200" \
  --check-interval=300s \
  --timeout=10s \
  --project=PROJECT_ID
```

> [!important] Uptime check alert setup
> The uptime check alone does not alert. Create an alerting policy on `monitoring.googleapis.com/uptime_check/check_passed` filtered to your check ID. Set threshold: any failure over a 5-minute window.

### Strategy 2: Missing Metric Alert

If a custom metric (e.g., rows_processed) stops arriving, Cloud Monitoring can alert on metric absence.

```bash
# Alert when expected metric has had no data points for 60 minutes
# This uses the "metric absence" condition type
gcloud alpha monitoring policies create \
  --display-name="Pipeline metric absent: rows_processed" \
  --condition-display-name="No data for 60 minutes" \
  --condition-filter='metric.type="custom.googleapis.com/pipeline/rows_processed" metric.label.pipeline_name="daily_ingest"' \
  --condition-absent-duration=3600s \
  --notification-channels=CHANNEL_ID \
  --project=PROJECT_ID
```

### Strategy 3: Cloud Scheduler + Validation Job

Schedule a validation Cloud Run job to run 30 minutes after each pipeline is expected to complete. If the freshness metric is not within SLA, it fires an alert.

```bash
# Scheduled health check — runs at 02:30 UTC, pipeline expected by 02:00 UTC
gcloud scheduler jobs create http validate-daily-ingest \
  --location=us-central1 \
  --schedule="30 2 * * *" \
  --uri="https://VALIDATE_SERVICE_URL/check" \
  --message-body='{"pipeline":"daily_ingest","freshness_sla_minutes":120}' \
  --oidc-service-account-email=SCHEDULER_SA@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID
```

---

## Alerting Runbook for Data Engineers

### Alert Triage Decision Tree

```
Alert fires
│
├─ Freshness / staleness alert?
│   ├─ Check Cloud Run job history
│   │     gcloud run jobs executions list --job=JOB_NAME --region=REGION
│   ├─ Check most recent execution logs
│   │     gcloud logging read 'resource.type="cloud_run_job" resource.labels.job_name="JOB_NAME"' \
│   │       --order=desc --limit=50 --format=json
│   ├─ Check if upstream source was available
│   │     (source system health, upstream Pub/Sub message count)
│   └─ Check Airflow DAG status (if applicable)
│
├─ Quality / null rate alert?
│   ├─ Check source data: did schema change? Run schema drift check.
│   ├─ Check for recent pipeline code deploys (Cloud Run image tag, Artifact Registry)
│   ├─ Check infrastructure: is VM healthy? Disk full?
│   └─ Rerun quality check manually to confirm it's not a transient issue
│
└─ Infrastructure alert?
    ├─ VM down → gcloud compute instances describe INSTANCE --zone=ZONE
    ├─ Disk full → gcloud compute disks describe DISK --zone=ZONE
    └─ Network / firewall → gcloud compute firewall-rules list --filter="network=NETWORK"
```

### Common Alert Response Procedures

#### Pipeline Failed

#### Immediate triage — Common Alert Response Procedures

```bash
# List recent executions and their status
gcloud run jobs executions list \
  --job=JOB_NAME \
  --region=REGION \
  --limit=10 \
  --format="table(name, completionTime, status.conditions[0].type, status.conditions[0].status)"

# Get logs for the failed execution
gcloud run jobs executions describe EXECUTION_NAME --region=REGION
gcloud logging read \
  'resource.type="cloud_run_job" resource.labels.execution_name="EXECUTION_NAME"' \
  --order=desc --limit=100
```

#### Common causes and fixes — Common Alert Response Procedures

| Cause | Signal | Fix |
|---|---|---|
| OOM killed | Log: "Container killed due to memory" | Increase `--memory` on job |
| Timeout | Execution duration = max timeout | Increase `--task-timeout` or optimize query |
| Source unavailable | Connection timeout in logs | Check source system; add retry |
| Bad data from source | Parsing error in logs | Add input validation; alert source owner |
| Dependency missing | Import error / missing file | Check Cloud Storage path; check config |
| Auth failure | 403 / permission denied | Check service account roles |

#### Re-trigger manually

```bash
gcloud run jobs execute JOB_NAME \
  --region=REGION \
  --wait \
  --project=PROJECT_ID
```

#### Data is Stale

```bash
# Check if job ran at all today
gcloud run jobs executions list \
  --job=JOB_NAME \
  --region=REGION \
  --filter="completionTime>$(date -u -d 'today' +%Y-%m-%dT00:00:00Z)" \
  --format="table(name, completionTime)"

# Check Cloud Scheduler triggered the run
gcloud scheduler jobs describe JOB_SCHEDULE_NAME --location=REGION
gcloud logging read \
  'resource.type="cloud_scheduler_job" resource.labels.job_id="SCHEDULER_JOB_NAME"' \
  --order=desc --limit=5

# Check BigQuery table last modified time
bq show --format=prettyjson PROJECT:DATASET.TABLE | python3 -c \
  "import json,sys,datetime; d=json.load(sys.stdin); \
   ts=int(d['lastModifiedTime'])/1000; \
   print(datetime.datetime.utcfromtimestamp(ts))"
```

#### Dependency chain investigation

```bash
# Check if Pub/Sub has unprocessed messages (pipeline waiting on upstream)
gcloud pubsub subscriptions describe SUBSCRIPTION_NAME \
  --format="table(name, numUndeliveredMessages, oldestUnackedMessageAge)"
```

#### BigQuery Cost Spike

```sql
-- Find most expensive jobs in the last 24 hours
SELECT
    job_id,
    user_email,
    query,
    total_bytes_processed / POW(1024, 4) AS tb_processed,
    total_slot_ms / 1000 AS slot_seconds,
    creation_time
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND job_type = 'QUERY'
  AND state = 'DONE'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

```sql
-- Identify which tables are being scanned fully (no partition filter)
SELECT
    referenced_table.table_id,
    COUNT(*) AS scan_count,
    SUM(total_bytes_processed) / POW(1024, 4) AS total_tb
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT,
     UNNEST(referenced_tables) AS referenced_table
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY 1
ORDER BY total_tb DESC
LIMIT 20;
```

**Fix options:** Add `WHERE DATE(_PARTITIONTIME) = ...` clause, require partition filter (`require_partition_filter=TRUE` on table), or reduce scheduling frequency.

#### Pub/Sub Backlog Growing

```bash
# Check subscription state
gcloud pubsub subscriptions describe SUBSCRIPTION_NAME

# Monitor backlog metric directly
gcloud monitoring read \
  --project=PROJECT_ID \
  --freshness=5m \
  "metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\" \
   resource.labels.subscription_id=\"SUBSCRIPTION_NAME\""

# Check consumer Cloud Run service scaling
gcloud run services describe CONSUMER_SERVICE \
  --region=REGION \
  --format="table(name, status.observedGeneration, status.traffic[0].revisionName)"
```

#### Common causes — Common Alert Response Procedures

| Cause | Fix |
|---|---|
| Consumer crashed | Check consumer logs; restart |
| Consumer too slow | Increase `--max-instances` on Cloud Run; increase concurrency |
| Message format changed | Check for schema errors in consumer logs |
| IAM permission revoked | Verify service account has `pubsub.subscriber` role |

```bash
# Temporarily scale up consumer (Cloud Run)
gcloud run services update CONSUMER_SERVICE \
  --region=REGION \
  --max-instances=20 \
  --concurrency=10
```

#### VM Unreachable

```bash
# Check VM status
gcloud compute instances describe INSTANCE_NAME \
  --zone=ZONE \
  --format="table(name, status, lastStartTimestamp)"

# Attempt to start if stopped
gcloud compute instances start INSTANCE_NAME --zone=ZONE

# Connect via IAP if SSH is broken
gcloud compute ssh INSTANCE_NAME \
  --zone=ZONE \
  --tunnel-through-iap

# View serial console output (useful when SSH fails entirely)
gcloud compute instances get-serial-port-output INSTANCE_NAME --zone=ZONE

# Check recent system events
gcloud logging read \
  'resource.type="gce_instance" resource.labels.instance_id="INSTANCE_ID"' \
  --order=desc --limit=50
```

#### Cloud Run Cold Start Spike

```bash
# Check current instance count and min-instances setting
gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --format="yaml(spec.template.metadata.annotations)"

# Set minimum instances to eliminate cold starts for critical services
gcloud run services update SERVICE_NAME \
  --region=REGION \
  --min-instances=1

# View startup latency in logs
gcloud logging read \
  'resource.type="cloud_run_revision" httpRequest.latency>"5s"' \
  --order=desc --limit=20
```

#### Disk Space Critical

```bash
# Check disk usage on VM
gcloud compute ssh INSTANCE_NAME --zone=ZONE -- df -h

# Check disk size
gcloud compute disks describe DISK_NAME --zone=ZONE \
  --format="table(name, sizeGb, status)"

# Quick cleanup: rotate logs and clear temp files
gcloud compute ssh INSTANCE_NAME --zone=ZONE -- \
  "sudo journalctl --vacuum-time=7d && sudo find /tmp -mtime +1 -delete"

# Resize disk (online resize, no downtime on ext4)
gcloud compute disks resize DISK_NAME \
  --zone=ZONE \
  --size=200GB

# After resize, grow partition inside VM
gcloud compute ssh INSTANCE_NAME --zone=ZONE -- \
  "sudo resize2fs /dev/sda1"
```

### On-Call Playbook

When an SLA breach triggers a page, the responder should follow the on call guide for initial acknowledgement and escalation before diving into technical triage below.

#### First 5 minutes — Acknowledge and assess

1. Acknowledge the alert in your notification channel
2. Open the relevant Cloud Monitoring dashboard
3. Determine scope: one pipeline or multiple? One region or global?
4. Check if there is an ongoing GCP incident: `https://status.cloud.google.com`
5. Post initial status to team channel: "Investigating [alert name] — scope TBD"

#### Next 15 minutes — Root cause and initial fix

1. Follow the decision tree for the alert type above
2. Check for recent deploys (Cloud Run image updates, config changes)
3. If root cause is clear: apply fix, monitor recovery
4. If root cause is unclear: escalate to senior engineer or service owner
5. Update team channel with findings and ETA

#### Communication template — On-Call Playbook

```
[INCIDENT UPDATE - T+15min]
Alert: <alert name>
Status: Investigating / Fixing / Resolved
Impact: <what's affected, since when>
Root cause: <what we know so far>
Action taken: <what we did>
Next update: <time>
```

#### Post-incident (within 24 hours)

1. Write a brief RCA (root cause, timeline, fix, prevention)
2. Add or tune the alert if it was noisy or missed something
3. Update the runbook if the procedure was unclear or wrong
4. File a follow-up task if a longer-term fix is needed

---

## Automation: Self-Healing Pipelines

### Auto-Retry Patterns

#### Cloud Run Jobs — built-in retry

```bash
gcloud run jobs create JOB_NAME \
  --image=IMAGE_URL \
  --region=REGION \
  --max-retries=3 \
  --task-timeout=3600s \
  --project=PROJECT_ID
```

#### Airflow — task-level retry

```python
from datetime import timedelta
from airflow.decorators import task

@task(
    retries=3,
    retry_delay=timedelta(minutes=5),
    retry_exponential_backoff=True,
    max_retry_delay=timedelta(minutes=60),
)
def ingest_data(**context):
    # Pipeline logic here
    pass
```

#### Python — custom exponential backoff decorator

```python
import functools
import time
import random
import logging

log = logging.getLogger(__name__)

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,),
):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = base_delay
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries:
                        log.error(f"All {max_retries} retries exhausted for {func.__name__}: {e}")
                        raise
                    jitter = random.uniform(0, delay * 0.1)
                    sleep_time = min(delay + jitter, max_delay)
                    log.warning(
                        f"Attempt {attempt + 1}/{max_retries} failed: {e}. "
                        f"Retrying in {sleep_time:.1f}s..."
                    )
                    time.sleep(sleep_time)
                    delay = min(delay * 2, max_delay)
        return wrapper
    return decorator

# Usage
@retry_with_backoff(max_retries=3, base_delay=2.0, exceptions=(ConnectionError, TimeoutError))
def fetch_source_data(url: str) -> dict:
    # Fetch logic
    pass
```

### Auto-Remediation via Cloud Functions

When an alert fires, a Pub/Sub notification can trigger a Cloud Function that takes automated corrective action. This works for deterministic failure modes: pipeline never started, VM stopped, disk space low.

#### Architecture — Auto-Remediation via Cloud Functions

```
Alert Policy → Notification Channel (Pub/Sub) → Cloud Function → Remediation Action
```

#### Create notification channel targeting Pub/Sub

```bash
# Create Pub/Sub topic for alert notifications
gcloud pubsub topics create pipeline-alerts --project=PROJECT_ID

# Create notification channel
gcloud alpha monitoring channels create \
  --display-name="Pipeline Alert Channel" \
  --type=pubsub \
  --channel-labels=topic=projects/PROJECT_ID/topics/pipeline-alerts \
  --project=PROJECT_ID
```

#### Cloud Function — restart failed Cloud Run job

```python
# main.py for Cloud Function (Python 3.11, trigger: Pub/Sub)
import base64
import json
import logging
from google.cloud import run_v2

log = logging.getLogger(__name__)

def handle_alert(event, context):
    """Triggered by Pub/Sub message from Cloud Monitoring alert."""
    payload = base64.b64decode(event["data"]).decode("utf-8")
    data = json.loads(payload)

    incident = data.get("incident", {})
    policy_name = incident.get("policy_name", "")
    condition_name = incident.get("condition_name", "")
    state = incident.get("state", "")

    log.info(f"Alert received: policy={policy_name}, state={state}")

    # Only act on OPEN incidents (not resolutions)
    if state != "open":
        log.info("Incident closed — no action needed")
        return

    # Map policy names to remediation functions
    if "daily_ingest" in policy_name.lower() and "stale" in condition_name.lower():
        restart_cloud_run_job(
            project="PROJECT_ID",
            region="us-central1",
            job_name="daily-ingest-job",
        )

def restart_cloud_run_job(project: str, region: str, job_name: str):
    client = run_v2.JobsClient()
    job_path = f"projects/{project}/locations/{region}/jobs/{job_name}"

    request = run_v2.RunJobRequest(name=job_path)
    operation = client.run_job(request=request)
    execution = operation.result(timeout=60)
    log.info(f"Restarted job: {execution.name}")
```

#### Deploy the Cloud Function

```bash
gcloud functions deploy handle-pipeline-alert \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=handle_alert \
  --trigger-topic=pipeline-alerts \
  --service-account=FUNCTION_SA@PROJECT_ID.iam.gserviceaccount.com \
  --memory=256MB \
  --timeout=120s \
  --project=PROJECT_ID
```

> [!warning] Auto-remediation guard rails
> Auto-remediation should only restart clearly safe operations (rerun idempotent pipeline, scale up consumers). Never auto-delete data, roll back schema, or auto-escalate costs. Log every automated action with full context.

> [!success] Safe auto-remediation scope
>
> Limit automated actions to: re-executing idempotent Cloud Run jobs, scaling up Cloud Run max-instances, and publishing alert summaries to Slack. Gate every automated action behind a check that verifies the pipeline is truly idempotent before triggering, and log the `alert_policy`, `incident_id`, and `action_taken` to a `remediation_log` table for post-incident review.

### Scheduled Health Checks

A scheduled health check job runs every 15 minutes and validates the entire pipeline ecosystem. Results go to Firestore (for state) and Cloud Monitoring (for alerting/dashboards).

```python
# health_check.py — runs as Cloud Run Job, scheduled every 15 min
import time
import json
import logging
from datetime import datetime, timezone
from google.cloud import bigquery, monitoring_v3, firestore, pubsub_v1

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='{"severity":"%(levelname)s","message":"%(message)s"}')

PROJECT = "PROJECT_ID"
DATASET = "my_dataset"

PIPELINES = [
    {
        "name": "daily_ingest",
        "bq_table": f"{PROJECT}.{DATASET}.main_table",
        "freshness_sla_hours": 2,
    },
    {
        "name": "weekly_summary",
        "bq_table": f"{PROJECT}.{DATASET}.summary_table",
        "freshness_sla_hours": 4,
    },
]

PUBSUB_SUBSCRIPTIONS = [
    "projects/PROJECT_ID/subscriptions/event-stream-sub",
]

def check_bq_freshness(bq: bigquery.Client, table: str, sla_hours: int) -> dict:
    query = f"""
        SELECT TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), TIMESTAMP_MILLIS(last_modified_time), HOUR) AS hours_stale
        FROM `{table.split('.')[0]}.{table.split('.')[1]}.__TABLES__`
        WHERE table_id = '{table.split('.')[-1]}'
    """
    row = next(bq.query(query).result(), None)
    if row is None:
        return {"ok": False, "hours_stale": None, "reason": "table not found"}
    ok = row.hours_stale <= sla_hours
    return {"ok": ok, "hours_stale": row.hours_stale, "reason": None if ok else f"stale by {row.hours_stale - sla_hours}h"}

def check_pubsub_backlog(sub_name: str, max_messages: int = 100000) -> dict:
    from google.cloud import monitoring_v3
    # Use monitoring API to get current backlog
    mc = monitoring_v3.MetricServiceClient()
    sub_id = sub_name.split("/")[-1]
    results = mc.list_time_series(
        request={
            "name": f"projects/{PROJECT}",
            "filter": f'metric.type="pubsub.googleapis.com/subscription/num_undelivered_messages" resource.labels.subscription_id="{sub_id}"',
            "interval": {"end_time": {"seconds": int(time.time())}, "start_time": {"seconds": int(time.time()) - 300}},
        }
    )
    backlog = 0
    for ts in results:
        if ts.points:
            backlog = int(ts.points[0].value.int64_value)
    ok = backlog < max_messages
    return {"ok": ok, "backlog": backlog, "reason": None if ok else f"backlog {backlog:,} exceeds {max_messages:,}"}

def push_health_metric(project: str, check_name: str, ok: bool):
    mc = monitoring_v3.MetricServiceClient()
    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/pipeline/health_check"
    series.metric.labels["check_name"] = check_name
    series.resource.type = "global"
    series.resource.labels["project_id"] = project
    point = monitoring_v3.Point()
    point.value.int64_value = 1 if ok else 0
    interval = monitoring_v3.TimeInterval()
    interval.end_time.seconds = int(time.time())
    point.interval = interval
    series.points = [point]
    mc.create_time_series(name=f"projects/{project}", time_series=[series])

def save_to_firestore(db: firestore.Client, check_name: str, result: dict):
    db.collection("health_checks").document(check_name).set({
        **result,
        "checked_at": firestore.SERVER_TIMESTAMP,
    })

def main():
    bq = bigquery.Client(project=PROJECT)
    db = firestore.Client(project=PROJECT)
    all_ok = True

    for pipeline in PIPELINES:
        result = check_bq_freshness(bq, pipeline["bq_table"], pipeline["freshness_sla_hours"])
        check_name = f"freshness_{pipeline['name']}"
        log.info(json.dumps({"check": check_name, **result}))
        push_health_metric(PROJECT, check_name, result["ok"])
        save_to_firestore(db, check_name, result)
        if not result["ok"]:
            all_ok = False

    for sub in PUBSUB_SUBSCRIPTIONS:
        result = check_pubsub_backlog(sub)
        check_name = f"backlog_{sub.split('/')[-1]}"
        log.info(json.dumps({"check": check_name, **result}))
        push_health_metric(PROJECT, check_name, result["ok"])
        save_to_firestore(db, check_name, result)
        if not result["ok"]:
            all_ok = False

    if not all_ok:
        log.error("One or more health checks failed")
        exit(1)

if __name__ == "__main__":
    main()
```

#### Schedule the health check

```bash
# Create the Cloud Run Job
gcloud run jobs create pipeline-health-check \
  --image=IMAGE_URL \
  --region=us-central1 \
  --service-account=HEALTH_CHECK_SA@PROJECT_ID.iam.gserviceaccount.com \
  --memory=512Mi \
  --task-timeout=300s \
  --max-retries=0 \
  --project=PROJECT_ID

# Schedule every 15 minutes
gcloud scheduler jobs create http pipeline-health-check-schedule \
  --location=us-central1 \
  --schedule="*/15 * * * *" \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/pipeline-health-check:run" \
  --oauth-service-account-email=SCHEDULER_SA@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID
```

---

## Dashboard Setup

### Core Dashboard Panels

Every data pipeline dashboard should have these panels as a minimum:

**1. Pipeline Freshness Heatmap**

```bash
# View freshness metric in Cloud Monitoring console:
# Metric: custom.googleapis.com/pipeline/data_freshness_seconds
# Group by: pipeline_name
# Threshold line at SLA boundary
```

**2. SLA Compliance Gauge (7-day rolling)**

```sql
-- Query for Looker Studio / dashboard
SELECT
    pipeline_name,
    SAFE_DIVIDE(COUNTIF(sla_met), COUNT(*)) AS compliance_rate_7d
FROM `PROJECT.DATASET.sla_log`
WHERE run_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY pipeline_name
```

**3. BigQuery Slot Usage**

```bash
# In Cloud Monitoring:
# Metric: bigquery.googleapis.com/reservation/slot_capacity
# Metric: bigquery.googleapis.com/job/slots_ms_used
```

**4. Pub/Sub Backlog Trend**

```bash
# Metric: pubsub.googleapis.com/subscription/num_undelivered_messages
# Filter by subscription, show 24h trend
# Alert threshold line
```

**5. Cloud Run Job Success Rate**

```bash
# Metric: run.googleapis.com/job/completed_task_count
# Filter: status != "succeeded"
# Group by: job_name
```

### Create Dashboard via gcloud

```bash
# Export an existing dashboard definition and modify for new pipeline
gcloud monitoring dashboards list --project=PROJECT_ID

gcloud monitoring dashboards describe DASHBOARD_ID \
  --project=PROJECT_ID \
  --format=json > dashboard_template.json

# Modify and import
gcloud monitoring dashboards create \
  --config-from-file=pipeline_health_dashboard.json \
  --project=PROJECT_ID
```

---

## Log Sink for Long-Term Analysis

Structured pipeline logs are most valuable when you can query them historically. Route to BigQuery for retention beyond the 30-day Cloud Logging default.

```bash
# Create BigQuery dataset for logs
bq mk --dataset --location=US PROJECT_ID:pipeline_logs

# Create log sink — route all pipeline logs to BigQuery
gcloud logging sinks create pipeline-logs-to-bq \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/pipeline_logs \
  --log-filter='jsonPayload.pipeline_name!="" OR labels.pipeline_name!=""' \
  --use-partitioned-tables \
  --project=PROJECT_ID

# Grant the sink's service account write access to the dataset
gcloud logging sinks describe pipeline-logs-to-bq --project=PROJECT_ID
# Copy the writerIdentity, then:
bq add-iam-policy-binding \
  --member=serviceAccount:WRITER_IDENTITY \
  --role=roles/bigquery.dataEditor \
  PROJECT_ID:pipeline_logs
```

#### Query historical pipeline performance

```sql
-- Average pipeline duration by week for the past 3 months
SELECT
    DATE_TRUNC(DATE(timestamp), WEEK) AS week,
    JSON_VALUE(json_payload, '$.pipeline_name') AS pipeline_name,
    AVG(CAST(JSON_VALUE(json_payload, '$.duration_seconds') AS INT64)) AS avg_duration_s,
    COUNTIF(JSON_VALUE(json_payload, '$.status') = 'success') AS successes,
    COUNTIF(JSON_VALUE(json_payload, '$.status') = 'failed') AS failures
FROM `PROJECT_ID.pipeline_logs.run_logs_*`
WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND JSON_VALUE(json_payload, '$.stage') = 'pipeline_complete'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

---

## Complete Monitoring Setup Checklist

Use this checklist when onboarding a new data pipeline to the monitoring stack.

### Logging

- [ ] Structured logging configured — JSON output with `pipeline_name`, `run_id`, `stage`, `status`
- [ ] Log severity used correctly (`INFO` for progress, `WARNING` for recoverable issues, `ERROR` for failures)
- [ ] Log sink to BigQuery configured for long-term retention
- [ ] Sensitive data (PII, credentials) excluded from log payloads

### Custom Metrics

- [ ] `custom.googleapis.com/pipeline/rows_processed` — pushed on each successful run
- [ ] `custom.googleapis.com/pipeline/execution_duration_seconds` — pushed on completion
- [ ] `custom.googleapis.com/pipeline/data_freshness_seconds` — pushed after each run
- [ ] `custom.googleapis.com/pipeline/null_rate` — pushed per critical column
- [ ] `custom.googleapis.com/pipeline/sla_compliance` — pushed as 1/0 after each run

### Freshness Tracking

- [ ] Freshness state table or Firestore document updated on every run (success and failure)
- [ ] Last success timestamp, row count, duration, status all recorded
- [ ] BQ `__TABLES__` freshness check added to scheduled validation job

### Dashboards

- [ ] Pipeline freshness panel (custom metric, time series)
- [ ] SLA compliance rate (7-day rolling)
- [ ] BigQuery slot usage and cost trend
- [ ] Pub/Sub backlog (if applicable)
- [ ] VM health metrics (CPU, disk, memory) — if VM-based pipeline
- [ ] Cloud Run job success/failure rate

### Alerts

- [ ] Pipeline failure alert (log-based or execution status metric)
- [ ] Data staleness alert (freshness metric threshold)
- [ ] Cost spike alert (BigQuery bytes billed)
- [ ] Disk space critical alert (> 85% used)
- [ ] VM down / unreachable alert
- [ ] Null rate threshold alert
- [ ] Row count anomaly alert (drop > 20% or spike > 200% vs 7-day avg)
- [ ] Schema drift alert (automated check + notification)

### SLA and Heartbeat

- [ ] SLA definition documented (freshness target, availability target, quality target)
- [ ] SLA tracking implemented (log to sla_log table, push metric)
- [ ] Dead man's switch configured (uptime check on heartbeat endpoint, or metric absence alert)
- [ ] Weekly SLA report automated (Cloud Scheduler → Cloud Run → email/Slack)

### On-Call Readiness

- [ ] Runbook for each alert type written and linked in alert description
- [ ] Notification channels configured (email, PagerDuty, Slack)
- [ ] Alert descriptions include direct links to relevant dashboards and runbooks
- [ ] Escalation path documented

### Self-Healing

- [ ] Idempotent pipeline design verified (safe to rerun without duplicating data)
- [ ] Retry configured (Cloud Run `--max-retries` or Airflow `retries`)
- [ ] Auto-remediation function deployed for deterministic failure modes (optional)

## Related

- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Error classification, retry strategies, circuit breakers, and alerting thresholds that this monitoring enforces
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — Idempotency enables safe retries and reruns
- [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) — Airflow retry configuration and SLA callbacks
- [sql-server-pipeline-anti-patterns](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/sql-server-pipeline-anti-patterns) — Pipeline mistakes that monitoring should detect
- [data-pipeline-testing-strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy) — How production monitoring complements pre-deployment testing
- [ ] Scheduled health check job running every 15 minutes

> [!tip] Checklist in practice
> Run this checklist at pipeline design time, not after the first incident. The patterns that hurt most — missing heartbeat checks, no staleness alerting, no SLA definition — all feel optional until a pipeline silently fails for 48 hours before anyone notices.
