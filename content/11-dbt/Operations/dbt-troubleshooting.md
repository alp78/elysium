---
title: "dbt: Troubleshooting"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Systematic diagnosis of dbt compilation errors, runtime failures, test failures, incremental drift, snapshot corruption, and a reference table of 12 common errors with causes and fixes."
parent: "[[domain-operations-and-adapters]]"
links:
  - "[[dbt-airflow-integration]]"
  - "[[dbt-ci-cd]]"
  - "[[dbt-documentation-and-lineage]]"
  - "[[dbt-observability]]"
  - "[[dbt-performance-tuning]]"
  - "[[dbt-bigquery-adapter]]"
  - "[[dbt-sqlserver-adapter]]"
  - "[[dbt-cross-adapter-patterns]]"
---

# dbt: Troubleshooting

> [!quote]
> "If you aren't testing in prod you aren't testing in reality -- just a weak dime store knockoff."
>
> — **Charity Majors**, charity.wtf (2018)

Effective dbt troubleshooting follows a consistent pattern: reproduce the error with the smallest possible scope, use `dbt debug` and `dbt compile` to isolate the layer where it originates (Jinja, compilation, or runtime), then fix and verify.

---

### dbt First Responder Commands

```bash
# Validate profiles.yml connection and project structure
dbt debug

# Compile a single model to check Jinja rendering without executing SQL
dbt compile --select fct_esg_scores

# Run a single model with verbose output
dbt run --select fct_esg_scores --log-level debug

# Run tests for a single model
dbt test --select fct_esg_scores --store-failures

# Check source freshness
dbt source freshness --select source:esg_provider
```

---

## Compilation Errors

Compilation errors occur before any SQL reaches the warehouse. They are dbt or Jinja problems, not adapter problems.

### Jinja Syntax Errors

#### Symptom — Jinja Syntax Errors
```
Compilation Error in model fct_esg_scores
  unexpected end of template, expected 'endif'
  File "models/marts/esg/fct_esg_scores.sql", line 12
```

**Cause:** An `{% if %}` block is not closed with `{% endif %}`, or a `{{ }}` expression contains an unmatched brace.

**Fix:** Use `dbt compile --select <model>` to get the exact line. Common mistakes:

```jinja
{# WRONG — missing endif #}
{% if is_incremental() %}
WHERE score_date >= '{{ var("run_date") }}'

{# CORRECT #}
{% if is_incremental() %}
WHERE score_date >= '{{ var("run_date") }}'
{% endif %}
```

### Missing `ref()` / `source()`

#### Symptom — Missing ref() / source()
```
Compilation Error in model fct_esg_scores
  'stg_esg_msci' is undefined
```

**Cause:** `{{ ref('stg_esg_msci') }}` was written as `{{ ref('stg_esg_MSCI') }}` (case mismatch) or the model file does not exist.

#### Fix — Missing ref() / source()
```bash
# List all nodes matching a pattern
dbt ls --select "*msci*"
```

Verify the model file name matches the string inside `ref()`. dbt model names are derived from the file name without the `.sql` extension.

### Circular Dependencies

#### Symptom — Circular Dependencies
```
Found a cycle: model.financial_indices.int_esg_scored
  --> model.financial_indices.fct_esg_scores
  --> model.financial_indices.int_esg_scored
```

**Cause:** Model A references Model B, and Model B (directly or transitively) references Model A.

#### Diagnosis — Circular Dependencies
```bash
dbt ls --select +int_esg_scored   # all upstream
dbt ls --select int_esg_scored+   # all downstream
```

Look for a node that appears in both lists. Break the cycle by extracting the shared logic into a new intermediate model that neither A nor B depends on.

---

## Runtime Errors

Runtime errors occur after compilation succeeds. The SQL reaches the warehouse and is rejected or times out.

### Connection Failures

#### Symptom — Connection Failures
```
Runtime Error
  Database error while running model fct_esg_scores
  Could not connect to BigQuery: 403 Access denied: project fin-data-prod
```

#### Fix — Connection Failures

```bash
# Test connection independently
dbt debug

# Check active credentials
gcloud auth list
gcloud config get-value project

# For service-account-based profiles, verify key path
echo $GOOGLE_APPLICATION_CREDENTIALS
cat $GOOGLE_APPLICATION_CREDENTIALS | python -m json.tool | grep client_email
```

### SQL Errors in the Warehouse

#### Symptom — SQL Errors in the Warehouse
```
Database Error in model fct_esg_scores
  Syntax error: Unexpected keyword RANGE at [47:5]
```

**Fix:** Compile the model and inspect the generated SQL:

```bash
dbt compile --select fct_esg_scores
cat target/compiled/financial_indices/models/marts/esg/fct_esg_scores.sql
```

Paste the compiled SQL directly into the BigQuery console or SQL Server Management Studio to get the full error context, which often includes column names and line numbers that dbt's error output truncates.

### Query Timeout

#### Symptom — Query Timeout
```
Database Error in model fct_index_constituent_history
  Operation timed out after 3600 seconds
```

#### Fix — Query Timeout
- For BigQuery: increase `job_timeout_ms` in the model config or profile.
- For SQL Server: increase `query_timeout` in `profiles.yml`.
- Longer term: see [dbt-performance-tuning](https://alp78.github.io/elysium/11-dbt/Operations/dbt-performance-tuning) for model splitting strategies.

```yaml
# BigQuery — per-model timeout override
{{
  config(
    job_timeout_ms = 7200000   # 2 hours
  )
}}
```

### Out-of-Memory (OOM)

#### Symptom (BigQuery) — Out-of-Memory (OOM)
```
Resources exceeded during query execution: Out of memory; ...
```

#### Fix — Out-of-Memory (OOM)
1. Check if the model performs a large cross-join or missing join predicate.
2. Enable `allow_large_results` and switch to a temporary table:

```sql
{{
  config(
    allow_large_results = true,
    use_legacy_sql = false
  )
}}
```

3. Break the model into smaller intermediate models (see [dbt-performance-tuning](https://alp78.github.io/elysium/11-dbt/Operations/dbt-performance-tuning)).

---

## Test Failures

### Inspecting Stored Failures

Run tests with `--store-failures` to persist failing rows to a table in the warehouse:

```bash
dbt test --select fct_esg_scores --store-failures
```

dbt creates a table at `<database>.<schema>_dbt_test__audit.<test_name>`. Query it directly:

```sql
-- BigQuery
SELECT *
FROM `fin-data-dev`.`esg_transformed_dbt_test__audit`.`not_null_fct_esg_scores_issuer_id`
LIMIT 100;
```

This reveals the actual failing rows, which is essential for understanding whether a test failure is a data quality issue or a logic bug.

### False Positives

**Symptom:** A `unique` test fails on `fct_esg_scores.issuer_id` but the data looks correct.

**Cause:** The model is partitioned by `score_date`, and `issuer_id` is unique per date but not globally. The test is defined at the wrong grain.

**Fix:** Compose the unique key:

```yaml
models:
  - name: fct_esg_scores
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [issuer_id, score_date, provider_code]
```

### Test Severity and Warn Thresholds

Avoid blocking the pipeline for minor data quality deviations. Use `warn_if` and `error_if`:

```yaml
columns:
  - name: environmental_score
    tests:
      - not_null:
          config:
            severity: warn
            warn_if: ">10"    # warn if more than 10 nulls
            error_if: ">100"  # hard fail if more than 100 nulls
```

---

## Incremental Drift

Incremental models can diverge from a full-refresh rebuild over time. This is called incremental drift and is most common when:
- The model's SQL logic changed but the table was not full-refreshed.
- Late-arriving data was not captured by the incremental filter.
- A bug existed in the incremental logic that has since been fixed.

### Detecting Drift

Use `dbt-audit-helper` to compare the incremental table against a full-refresh build on a shadow table:

```bash
# Build a full-refresh shadow
dbt run --full-refresh --select fct_esg_scores \
  --vars '{target_schema: esg_shadow}'
```

```sql
-- analyses/audit_incremental_drift.sql
{{
  audit_helper.compare_relations(
    a_relation = ref('fct_esg_scores'),
    b_relation = ref('fct_esg_scores_shadow'),
    primary_key = 'surrogate_key'
  )
}}
```

### Repair: Targeted Full-Refresh

```bash
# Full-refresh the drifted model only
dbt run --full-refresh --select fct_esg_scores

# Full-refresh the model and all its dependents
dbt run --full-refresh --select fct_esg_scores+
```

> [!warning] Full-refresh drops the table
>
> `--full-refresh` on an incremental model drops and recreates the table. Schedule it during a maintenance window for large tables to avoid breaking downstream queries mid-execution.

> [!success] Safe full-refresh procedure
> Schedule `--full-refresh` in an off-peak window, notify downstream consumers in advance, and use `dbt run --full-refresh --select <model>` (not `<model>+`) to limit scope. Verify row counts match the expected full-history baseline before re-opening the table to consumers.

---

## Snapshot Corruption

dbt snapshots track slowly-changing dimensions (e.g., issuer legal entity details, index constituent eligibility flags). They are the hardest models to recover from once corrupted.

### Common Causes

| Cause | Symptom |
|-------|---------|
| `unique_key` column changed | Duplicate `dbt_scd_id` values; rows not closed |
| Source data reloaded with different IDs | All rows expire and re-open as new |
| Snapshot run skipped for > 1 day | Gaps in `dbt_valid_from` / `dbt_valid_to` |
| `updated_at` strategy — timestamp column changed type | Rows never expire (always equal) |

### Diagnosis

```sql
-- Rows with open end date (dbt_valid_to IS NULL) per unique key
SELECT unique_key, COUNT(*) AS open_records
FROM {{ ref('snap_issuer_details') }}
WHERE dbt_valid_to IS NULL
GROUP BY unique_key
HAVING COUNT(*) > 1
ORDER BY open_records DESC;
```

More than one open record per `unique_key` means the snapshot has duplicate open rows.

### Repair Procedure

For minor corruption (a few bad rows):

```sql
-- Manually close duplicate open rows, keeping the latest
UPDATE snap_issuer_details
SET dbt_valid_to = CURRENT_TIMESTAMP()
WHERE dbt_scd_id IN (
    SELECT dbt_scd_id
    FROM (
        SELECT dbt_scd_id,
               ROW_NUMBER() OVER (PARTITION BY unique_key ORDER BY dbt_updated_at DESC) AS rn
        FROM snap_issuer_details
        WHERE dbt_valid_to IS NULL
    ) ranked
    WHERE rn > 1
);
```

For severe corruption, drop and rebuild from scratch:

```bash
dbt snapshot --full-refresh --select snap_issuer_details
```

> [!warning] Full-refresh destroys snapshot history
>
> `--full-refresh` on a snapshot drops the full history. Only do this if the source system retains the full history of changes. Coordinate with the data governance team before destroying SCD history in regulated environments.

> [!success] Safe snapshot recovery
> Before running `--full-refresh` on a snapshot, archive the existing table to a backup (`CREATE TABLE snap_issuer_details_bak AS SELECT * FROM snap_issuer_details`). Confirm the source system holds the complete change history, obtain data-governance sign-off, then rebuild. Restore from backup if the rebuilt snapshot diverges from expectations.

---

## `dbt debug` and `dbt compile` for Diagnosis

### `dbt debug`

Checks:
1. `dbt_project.yml` is parseable.
2. `profiles.yml` exists and the active profile is valid.
3. Warehouse connection succeeds (executes a `SELECT 1`).
4. Required packages are installed.

```bash
dbt debug --profiles-dir /opt/dbt/profiles --target dev
```

Output on failure:

```
Connection:
  account: fin-data-prod
  user: dbt-service@fin-data-prod.iam
  database: fin-data-prod
  schema: esg_dev
  warehouse: N/A (BigQuery)
  role: N/A (BigQuery)
  Connection test: ERROR

1 check failed:
  Connection test: Could not connect to BigQuery [403 Access denied]
```

### `dbt compile`

Renders all Jinja and produces plain SQL in `target/compiled/`. Use it to:
- Verify `var()` and `env_var()` resolution.
- Inspect the final SQL before executing.
- Check `is_incremental()` branches in development.

```bash
# Force incremental branch even in dev (where the table doesn't exist yet)
dbt compile --select fct_esg_scores \
  --vars '{is_incremental: true}'
```

---

### dbt Common Errors Reference Table

| # | Error Message (abbreviated) | Cause | Fix |
|---|----------------------------|-------|-----|
| 1 | `'model_name' is undefined` | `ref()` argument does not match any model file name | Check spelling and case; run `dbt ls --select "*name*"` |
| 2 | `unexpected end of template, expected 'endif'` | Unclosed `{% if %}` Jinja block | Add `{% endif %}`; use `dbt compile` to find the line |
| 3 | `Cycle detected` | Two models reference each other | Extract shared logic into a third model with no circular dependency |
| 4 | `Could not find profile named 'X'` | `profile:` in `dbt_project.yml` does not match a key in `profiles.yml` | Align the profile name; run `dbt debug` to confirm |
| 5 | `403 Access Denied` on BigQuery | Service account lacks BigQuery Data Editor or Job User role | Grant IAM roles; check `GOOGLE_APPLICATION_CREDENTIALS` |
| 6 | `Table not found: schema.stg_esg_msci` | Dev dataset does not exist; or model has never been run | Run the model first; verify target dataset exists |
| 7 | `Resources exceeded: Out of memory` | Query contains implicit cross-join or very large sort/hash | Add a join predicate; split into intermediate models |
| 8 | `Got N results, configured to fail if != 0` | A dbt `unique` or `not_null` test found violations | Query the `_dbt_test__audit` table to inspect bad rows |
| 9 | `Operation timed out after 3600 seconds` | Model executes longer than the adapter timeout | Increase `job_timeout_ms`; optimise the query; partition |
| 10 | `Schema 'X' does not exist` | Target schema has not been created; Terraform/DDL not applied | Pre-create the dataset; or add `+on-schema-change: append_new_columns` |
| 11 | `Variable 'run_date' not found` | `--vars` not passed at runtime; var has no default | Add `default` to `var()` call: `{{ var('run_date', 'today') }}`; or always pass `--vars` |
| 12 | `Duplicate key value violates unique constraint` | `merge` strategy on a warehouse that enforces PKs (e.g., AlloyDB) | Deduplicate the source CTE before the merge; or use `delete+insert` strategy |

---

### Incremental unique_key Mis-Match

If `unique_key` in an incremental model's config references a column that is NULL or not unique in the source, the merge either fails or silently duplicates rows.

```bash
# Check for nulls in the unique key before running
dbt run --select stg_esg_provider_raw
dbt test --select stg_esg_provider_raw --models "not_null_stg_esg_provider_raw_record_id"
```

Fix the source deduplication first, then full-refresh the incremental model.

---

## Related

- [airflow-troubleshooting](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-troubleshooting)
- [dbt-cli-reference](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-cli-reference)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
- [dbt-performance-tuning](https://alp78.github.io/elysium/11-dbt/Operations/dbt-performance-tuning)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
