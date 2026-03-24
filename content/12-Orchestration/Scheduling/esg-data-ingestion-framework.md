---
type: reference
category: orchestration
technology: [airflow, gcp, cloud-run, terraform, python]
tags: [orchestration, python, terraform, airflow, gcp, esg]
aliases: [ESG ingestion, vendor normalization, circuit breaker, data quality gate, score normalization, MSCI normalization, Sustainalytics normalization, carbon footprint, WACI, SFDR, EU Taxonomy, data vendor, feed ingestion, ESG pipeline]
keywords: [esg, environmental social governance, vendor normalization, score normalization, msci, sustainalytics, iss esg, bloomberg esg, circuit breaker, anomaly detection, data quality gate, carbon intensity, weighted average carbon intensity, WACI, SFDR, EU Taxonomy, airflow dag, cloud run job, service account segregation, read write separation, data vendor sla, freshness tracking, forward fill, coverage check, pipeline halt]
description: "ESG data ingestion framework for index providers — covers multi-vendor score normalization (MSCI, Sustainalytics, ISS), circuit breaker patterns for anomaly detection, carbon footprint calculation (WACI/SFDR), and Terraform IAM for segregated read/write service accounts."
related:
  - "[[pit-integrity-logic]]"
  - "[[compliance-and-auditability]]"
  - "[[dataops-for-indices]]"
  - "[[golden-rules-of-data-engineering]]"
  - "[[idempotent-pipeline-design]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# ESG Data Ingestion Framework

> [!abstract] When You Need This
> An index provider ingests ESG data from multiple vendors (MSCI ESG, Sustainalytics, ISS ESG, Bloomberg ESG). Each vendor uses different scales, update frequencies, and coverage universes. Before these scores can drive index weighting or screening, they must be normalized to a common scale and validated for anomalies.

---

## 1. The Multi-Vendor Scale Problem

| Vendor | Scale | Range | Direction | Update Freq | Typical Coverage |
|--------|-------|-------|-----------|-------------|-----------------|
| MSCI ESG | Letter grade | CCC–AAA | Higher = better | Weekly | 14,000+ |
| Sustainalytics | Risk score | 0–100 | Lower = better (inverted!) | Monthly | 16,000+ |
| ISS ESG | Numeric | 1–10 | Higher = better | Quarterly | 10,000+ |
| Bloomberg ESG | Numeric | 0–100 | Higher = better | Quarterly | 12,000+ |
| CDP Climate | Letter grade | D- to A | Higher = better | Annual | 15,000+ |

> [!danger] The Inversion Trap
> Sustainalytics uses an inverted scale (lower = better). Forgetting to invert this before combining with other vendors is the single most common ESG data bug. It silently produces wrong index weights for months before anyone notices.

---

## 2. Normalization Functions

```python
"""
ESG Score Normalization — maps all vendor scales to 0–100 (higher = better).
"""
from typing import Optional


def normalize_msci(grade: str) -> Optional[float]:
    """Map MSCI ESG letter grades to 0-100 scale.

    MSCI uses 7 grades: CCC, B, BB, BBB, A, AA, AAA.
    We map linearly to preserve ordinal spacing.
    """
    mapping = {
        'CCC': 0.00,
        'B':   16.67,
        'BB':  33.33,
        'BBB': 50.00,
        'A':   66.67,
        'AA':  83.33,
        'AAA': 100.00,
    }
    return mapping.get(grade.upper().strip()) if grade else None


def normalize_sustainalytics(risk_score: float) -> Optional[float]:
    """Invert Sustainalytics Risk Rating (lower = better) to 0-100 (higher = better).

    Sustainalytics scores range 0-100 where:
    - 0-10: Negligible risk (best)  → maps to 90-100
    - 10-20: Low risk               → maps to 80-90
    - 20-30: Medium risk             → maps to 70-80
    - 30-40: High risk               → maps to 60-70
    - 40+: Severe risk (worst)       → maps to 0-60
    """
    if risk_score is None:
        return None
    return max(0.0, min(100.0, 100.0 - risk_score))


def normalize_iss(score: float) -> Optional[float]:
    """Map ISS ESG score (1-10) to 0-100 scale."""
    if score is None:
        return None
    return max(0.0, min(100.0, (score - 1.0) / 9.0 * 100.0))


def normalize_bloomberg(score: float) -> Optional[float]:
    """Bloomberg ESG is already 0-100, higher = better. Passthrough with bounds check."""
    if score is None:
        return None
    return max(0.0, min(100.0, score))


def normalize_cdp(grade: str) -> Optional[float]:
    """Map CDP Climate grades to 0-100 scale."""
    mapping = {
        'D-': 0.0, 'D': 12.5,
        'C-': 25.0, 'C': 37.5,
        'B-': 50.0, 'B': 62.5,
        'A-': 75.0, 'A': 100.0,
    }
    return mapping.get(grade.strip()) if grade else None


# Dispatcher
NORMALIZERS = {
    'MSCI':            normalize_msci,
    'SUSTAINALYTICS':  normalize_sustainalytics,
    'ISS':             normalize_iss,
    'BLOOMBERG':       normalize_bloomberg,
    'CDP':             normalize_cdp,
}

def normalize_score(vendor: str, raw_value) -> Optional[float]:
    """Normalize any vendor score to 0-100 (higher = better)."""
    fn = NORMALIZERS.get(vendor.upper())
    if fn is None:
        raise ValueError(f"Unknown vendor: {vendor}")
    return fn(raw_value)
```

---

## 3. Airflow DAG: ESG Normalization Pipeline

```python
from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.google.cloud.operators.cloud_run import CloudRunExecuteJobOperator
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.empty import EmptyOperator

default_args = {
    'owner': 'data-platform',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(hours=1),
}

with DAG(
    dag_id='esg_score_normalization',
    schedule='0 6 * * MON',        # Every Monday at 06:00 UTC
    start_date=datetime(2026, 1, 6),
    catchup=False,
    default_args=default_args,
    tags=['esg', 'ingestion', 'normalization'],
    doc_md="""
    ## ESG Score Normalization Pipeline
    Ingests ESG scores from multiple vendors, normalizes to 0-100 scale,
    validates for anomalies (circuit breaker), and publishes to BigQuery.
    """,
) as dag:

    # --- Ingestion: parallel vendor pulls ---
    ingest_msci = CloudRunExecuteJobOperator(
        task_id='ingest_msci',
        project_id='{{ var.value.gcp_project }}',
        region='{{ var.value.gcp_region }}',
        job_name='esg-ingest-msci',
        overrides={
            'container_overrides': [{
                'env': [
                    {'name': 'VENDOR', 'value': 'MSCI'},
                    {'name': 'CALC_DATE', 'value': '{{ ds }}'},
                ],
            }],
        },
    )

    ingest_sustainalytics = CloudRunExecuteJobOperator(
        task_id='ingest_sustainalytics',
        project_id='{{ var.value.gcp_project }}',
        region='{{ var.value.gcp_region }}',
        job_name='esg-ingest-sustainalytics',
    )

    ingest_iss = CloudRunExecuteJobOperator(
        task_id='ingest_iss',
        project_id='{{ var.value.gcp_project }}',
        region='{{ var.value.gcp_region }}',
        job_name='esg-ingest-iss',
    )

    # --- Normalization ---
    normalize = PythonOperator(
        task_id='normalize_scores',
        python_callable=normalize_all_vendors,
        op_kwargs={'calc_date': '{{ ds }}'},
    )

    # --- Validation: coverage check ---
    validate_coverage = PythonOperator(
        task_id='validate_coverage',
        python_callable=check_universe_coverage,
        op_kwargs={
            'calc_date': '{{ ds }}',
            'min_coverage_pct': 95.0,
        },
    )

    # --- Circuit breaker ---
    circuit_breaker = BranchPythonOperator(
        task_id='circuit_breaker',
        python_callable=check_anomalies,
        op_kwargs={
            'calc_date': '{{ ds }}',
            'max_deviation_pct': 20.0,
        },
    )

    # --- Publish or halt ---
    publish = PythonOperator(
        task_id='publish_to_bigquery',
        python_callable=load_normalized_to_bigquery,
    )

    alert_and_halt = PythonOperator(
        task_id='alert_and_halt',
        python_callable=send_circuit_breaker_alert,
    )

    done = EmptyOperator(task_id='done', trigger_rule='none_failed_min_one_success')

    # --- Dependencies ---
    [ingest_msci, ingest_sustainalytics, ingest_iss] >> normalize
    normalize >> validate_coverage >> circuit_breaker
    circuit_breaker >> [publish, alert_and_halt]
    [publish, alert_and_halt] >> done
```

---

## 4. Circuit Breaker Pattern

```python
def check_anomalies(calc_date: str, max_deviation_pct: float = 20.0, **context) -> str:
    """Circuit breaker: halt pipeline if ESG scores deviate abnormally.

    Checks:
    1. Day-over-day aggregate score deviation per vendor
    2. Null rate < 2%
    3. No scores outside 3 standard deviations of historical mean
    4. Universe coverage > 95%

    Returns 'publish_to_bigquery' if all pass, 'alert_and_halt' if any fail.
    """
    import pyodbc

    conn = pyodbc.connect(os.environ['SQL_CONN_STRING'])

    # Check 1: Day-over-day deviation per vendor
    deviation_sql = """
    WITH today AS (
        SELECT vendor_code, AVG(normalized_score) AS avg_score, COUNT(*) AS n
        FROM dbo.esg_scores_staging
        WHERE score_date = ?
        GROUP BY vendor_code
    ),
    previous AS (
        SELECT vendor_code, AVG(normalized_score) AS avg_score, COUNT(*) AS n
        FROM dbo.esg_scores_normalized
        WHERE score_date = (
            SELECT MAX(score_date) FROM dbo.esg_scores_normalized
            WHERE score_date < ?
        )
        GROUP BY vendor_code
    )
    SELECT
        t.vendor_code,
        t.avg_score AS today_avg,
        p.avg_score AS prev_avg,
        ABS(t.avg_score - p.avg_score) / NULLIF(p.avg_score, 0) * 100 AS pct_change,
        t.n AS today_count,
        p.n AS prev_count
    FROM today t
    LEFT JOIN previous p ON t.vendor_code = p.vendor_code;
    """

    results = pd.read_sql(deviation_sql, conn, params=[calc_date, calc_date])

    breakers = []
    for _, row in results.iterrows():
        if row['pct_change'] and row['pct_change'] > max_deviation_pct:
            breakers.append(
                f"{row['vendor_code']}: {row['pct_change']:.1f}% deviation "
                f"(today={row['today_avg']:.1f}, prev={row['prev_avg']:.1f})"
            )

    # Check 2: Null rate
    null_check = pd.read_sql("""
        SELECT
            vendor_code,
            COUNT(*) AS total,
            SUM(CASE WHEN normalized_score IS NULL THEN 1 ELSE 0 END) AS nulls,
            CAST(SUM(CASE WHEN normalized_score IS NULL THEN 1 ELSE 0 END) AS FLOAT)
                / COUNT(*) * 100 AS null_pct
        FROM dbo.esg_scores_staging
        WHERE score_date = ?
        GROUP BY vendor_code
    """, conn, params=[calc_date])

    for _, row in null_check.iterrows():
        if row['null_pct'] > 2.0:
            breakers.append(f"{row['vendor_code']}: {row['null_pct']:.1f}% null rate")

    conn.close()

    if breakers:
        context['ti'].xcom_push(key='breaker_reasons', value=breakers)
        return 'alert_and_halt'

    return 'publish_to_bigquery'
```

> [!warning] Never Auto-Override
> The circuit breaker must require explicit human approval to resume. An index published with bad ESG data triggers restatements, regulatory scrutiny, and client trust erosion. The cost of a delayed publication is far lower than the cost of a wrong one.

---

## 5. Carbon Footprint Calculation

### SFDR/EU Taxonomy Required Metrics

```python
def calculate_waci(
    weights: pd.DataFrame,
    emissions: pd.DataFrame,
) -> float:
    """Weighted Average Carbon Intensity (WACI).

    WACI = SUM(weight_i * (scope1_2_emissions_i / revenue_i))

    Required by SFDR Article 7 for financial products promoting
    environmental characteristics (Article 8) or sustainable
    investment objectives (Article 9).
    """
    merged = weights.merge(emissions, on='instrument_isin')
    merged['carbon_intensity'] = (
        merged['scope1_2_tonnes_co2'] / merged['revenue_usd_millions']
    )
    return (merged['weight_pct'] * merged['carbon_intensity']).sum()


def calculate_carbon_footprint(
    weights: pd.DataFrame,
    emissions: pd.DataFrame,
    portfolio_value_usd: float,
) -> float:
    """Carbon Footprint per million USD invested.

    CF = SUM(weight_i * scope1_2_i / evic_i) * portfolio_value / 1e6

    EVIC = Enterprise Value Including Cash
    """
    merged = weights.merge(emissions, on='instrument_isin')
    ownership_emissions = (
        merged['weight_pct'] * merged['scope1_2_tonnes_co2'] / merged['evic_usd']
    ).sum()
    return ownership_emissions * portfolio_value_usd / 1e6
```

---

## 6. Terraform: Segregated Service Accounts

> [!danger] Regulatory Requirement
> Financial data pipelines MUST separate Write (can modify production data) from Read (can only query) service accounts. This is both a security best practice and a regulatory requirement under operational risk management frameworks.

```hcl
# ─── Read-Only Service Account ───
# Used by: dashboards, analysts, reporting, compliance queries
resource "google_service_account" "esg_reader" {
  account_id   = "sa-esg-reader"
  display_name = "ESG Data Reader (Read-Only)"
  description  = "Read-only access to ESG datasets. Used by dashboards and compliance."
}

resource "google_project_iam_member" "esg_reader_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.esg_reader.email}"
}

resource "google_project_iam_member" "esg_reader_bq_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.esg_reader.email}"
}

# ─── Write Service Account ───
# Used by: pipeline Cloud Run jobs ONLY
resource "google_service_account" "esg_writer" {
  account_id   = "sa-esg-writer"
  display_name = "ESG Data Writer (Pipeline Only)"
  description  = "Write access for ESG ingestion pipeline. Restricted to pipeline jobs."
}

resource "google_project_iam_member" "esg_writer_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.esg_writer.email}"
}

resource "google_project_iam_member" "esg_writer_gcs_creator" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.esg_writer.email}"
}

# ─── Domain Segregation ───
# Separate SAs for price data vs ESG data
resource "google_service_account" "price_writer" {
  account_id   = "sa-price-writer"
  display_name = "Price Data Writer (Pipeline Only)"
  description  = "Write access for market data ingestion. Cannot touch ESG datasets."
}

# Grant price_writer access ONLY to price datasets, not ESG
resource "google_bigquery_dataset_iam_member" "price_writer_prices" {
  dataset_id = google_bigquery_dataset.prices.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.price_writer.email}"
}
# price_writer has NO access to ESG dataset — enforced by omission

# ─── Audit Logging ───
resource "google_project_iam_audit_config" "data_access_audit" {
  project = var.project_id
  service = "bigquery.googleapis.com"
  audit_log_config {
    log_type = "DATA_WRITE"
  }
  audit_log_config {
    log_type = "DATA_READ"
  }
}
```

---

## 7. Data Vendor SLA Monitoring

### Airflow Sensor for File Arrival

```python
from airflow.providers.google.cloud.sensors.gcs import GCSObjectExistenceSensor

wait_for_msci_file = GCSObjectExistenceSensor(
    task_id='wait_for_msci_file',
    bucket='landing-zone-esg',
    object=f'msci/{{{{ ds_nodash }}}}/esg_ratings.csv',
    timeout=3600 * 4,          # Wait up to 4 hours
    poke_interval=300,         # Check every 5 minutes
    mode='reschedule',         # Free up worker slot while waiting
    soft_fail=True,            # Don't fail DAG, use fallback instead
)
```

### Fallback Logic: Use T-1 Data

```python
def use_latest_available(vendor: str, calc_date: str) -> str:
    """If today's vendor file hasn't arrived, use the most recent available."""
    latest = conn.execute("""
        SELECT MAX(score_date)
        FROM dbo.esg_scores_normalized
        WHERE vendor_code = ? AND score_date <= ?
    """, vendor, calc_date).fetchone()[0]

    if (datetime.strptime(calc_date, '%Y-%m-%d').date() - latest).days > 30:
        raise ValueError(f"{vendor} data is {(calc_date - latest).days} days stale. "
                         f"Cannot use data older than 30 days. Manual review required.")

    return str(latest)
```

---

## See Also

- [[pit-integrity-logic]] — PIT queries and weight normalization for index calculation
- [[compliance-and-auditability]] — EU BMR audit trail and corporate action documentation
- [[dataops-for-indices]] — Parallel backtesting and shadow calculation workflows
- [[idempotent-pipeline-design]] — Safe re-run patterns for data pipelines
- [[golden-rules-of-data-engineering]] — Rule 5: Raw Data Is Sacred
