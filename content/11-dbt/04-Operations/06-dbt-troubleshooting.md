---
title: "06 - dbt: Troubleshooting"
tags: [pipeline, dbt]
status: stable
updated: 2026-03-23
description: "Systematic diagnosis of dbt compilation errors, runtime failures, test failures, incremental drift, snapshot corruption, and a reference table of 12 common errors with causes and fixes."
---

# dbt: Troubleshooting

> [!quote]+
>
> "If you aren't testing in prod you aren't testing in reality -- just a weak dime store knockoff."
>
> Source: Charity Majors | charity.wtf (2018)

> [!abstract]- Summary
>
> Explains a layered dbt troubleshooting workflow that starts with narrow reproduction and then separates compilation, runtime, test, incremental, snapshot, and environment failures so fixes target the real layer instead of the loudest symptom.
>
> **First-response and failure classification**
> - Starts with the first-responder commands such as `dbt debug`, `dbt compile`, scoped `dbt run`, scoped `dbt test`, and source freshness checks to establish the smallest reliable reproduction path
> - Separates compilation, runtime, and test failures early so teams stop mixing Jinja, warehouse, and data-quality problems into one opaque incident category
>
> **Error patterns and diagnosis**
> - Covers Jinja syntax errors, missing refs or sources, circular dependencies, connection failures, warehouse SQL errors, timeouts, out-of-memory conditions, and test failures with their likely causes and fast diagnosis paths
> - Treats dbt troubleshooting as a model of layered systems: some failures belong to compilation, some to adapter connectivity, some to execution plans, and some to the data itself
>
> **Failure inspection and recovery guidance**
> - Covers stored failures, false positives, severity tuning, incremental drift, snapshot issues, and common recurring error signatures so engineers can move from symptom to verified fix systematically
> - Emphasizes verifying the repaired scope rather than rerunning the whole project blindly after every failure
>
> **Operations and safety**
> - Warnings: rerunning too much too early, debugging warehouse errors as if they were Jinja problems, ignoring stored-failure context, and masking real issues by downgrading severity instead of fixing the cause
> - Recommendations: narrow the scope first, classify the failure layer explicitly, inspect artifacts and stored failures before guessing, and treat repeated incidents as architecture feedback rather than isolated operator mistakes

> [!info]- Glossary
>
> **Troubleshooting workflow**
> - The repeatable process of reproducing a failure narrowly, isolating its layer, applying a fix, and verifying the result.
> - It matters here because the note is fundamentally about disciplined diagnosis rather than memorizing one-off fixes.
>
> > [!info] Sequence matters
> >
> > The order of operations matters in troubleshooting. Small, layer-specific checks usually reveal the cause faster than immediately rerunning the whole project.
>
> ---
>
> **`dbt debug`**
> - A dbt command that validates profile selection, connection settings, and project parsing prerequisites.
> - It matters here because many apparent model failures are actually environment or credential issues that this command surfaces early.
>
> > [!warning] Fix environment first
> >
> > If `dbt debug` is failing, later warehouse or model errors are often secondary noise. Clear the environment and connection layer before deeper debugging.
>
> ---
>
> **`dbt compile`**
> - A dbt command that renders models and macros into SQL without executing them in the warehouse.
> - It matters here because it cleanly isolates Jinja and graph problems from warehouse runtime failures.
>
> > [!info] Fastest layer separator
> >
> > Compile is one of the best first cuts in dbt debugging because it tells you whether the failure exists before any warehouse execution begins.
>
> ---
>
> **Compilation error**
> - A failure that occurs while dbt is parsing Jinja, resolving refs, or building the model graph before SQL is sent to the warehouse.
> - It matters here because compilation issues require a very different debugging path from runtime SQL failures.
>
> > [!warning] Warehouse never saw the query
> >
> > When the error is truly a compilation failure, looking at execution plans or warehouse performance is wasted effort. Stay in the dbt and Jinja layer first.
>
> ---
>
> **Runtime error**
> - A failure that occurs after dbt has compiled SQL and the warehouse rejects or cannot complete execution.
> - It matters here because runtime errors are where adapter behavior, database permissions, resource limits, and SQL validity all start to matter.
>
> > [!warning] Now the warehouse is in play
> >
> > Runtime errors require reading both dbt context and warehouse behavior. The fix may live in credentials, SQL shape, resource limits, or physical design.
>
> ---
>
> **Circular dependency**
> - A graph error where two or more dbt nodes depend on each other in a cycle, making execution order impossible.
> - It matters here because graph structure mistakes are common and can look confusing until they are recognized as dependency design problems.
>
> > [!warning] Extract the shared logic
> >
> > Cycles are usually solved by introducing a new lower-level model that both sides depend on, not by trying to trick dbt into an execution order it cannot represent.
>
> ---
>
> **Stored failure**
> - A persisted table of rows that failed a dbt test when `--store-failures` is enabled.
> - It matters here because debugging test failures is much faster when the exact offending records can be queried directly.
>
> > [!info] Best evidence for data-quality incidents
> >
> > Stored failures turn an abstract failing assertion into inspectable data. That often shortens the path from symptom to root cause dramatically.
>
> ---
>
> **False positive**
> - A test or alert failure that reflects an expected or acceptable data condition rather than a real defect.
> - It matters here because not every failing rule is wrong data; sometimes the rule itself is too broad or applied at the wrong layer.
>
> > [!warning] Fix the rule, not just the data
> >
> > If the same false positive recurs, the testing policy may be wrong. Repeatedly suppressing expected cases is a sign the assertion needs redesign.
>
> ---
>
> **Severity**
> - The failure policy for a dbt test, usually `warn` or `error`, that controls whether a run stops.
> - It matters here because troubleshooting often reveals whether the current severity still matches the real operational impact of the issue.
>
> > [!warning] Severity is an operational contract
> >
> > Downgrading severity can reduce noise, but it can also silently accept real risk. Change severity only when the incident pattern justifies it.
>
> ---
>
> **Incremental drift**
> - The accumulation of incorrect or incomplete state in an incremental model when its selection logic no longer matches real data arrival or correction patterns.
> - It matters here because some dbt failures present as missing or stale data even though the run itself technically succeeded.
>
> > [!warning] Success can still be wrong
> >
> > Incremental models can fail semantically without throwing runtime errors. Troubleshooting has to include data-shape validation, not just process status.
>
> ---
>
> **Snapshot corruption**
> - A historical-state problem where snapshot logic, keys, or change detection produce incorrect or duplicated temporal records.
> - It matters here because snapshots can fail in ways that are not obvious from a simple green or red run status.
>
> > [!warning] History bugs linger
> >
> > Snapshot issues are dangerous because they accumulate over time and are harder to repair once downstream consumers trust the historical record.
>
> ---
>
> **Scoped reproduction**
> - The practice of rerunning the smallest relevant model, test, or selector needed to reproduce a failure.
> - It matters here because controlled troubleshooting starts by shrinking blast radius and feedback time before attempting full-project reruns.
>
> > [!info] Smallest failing surface wins
> >
> > A narrow reproduction is usually the fastest route to clarity. Broad reruns add latency and noise without necessarily adding understanding.

## dbt First Responder Commands

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
>
> Schedule `--full-refresh` in an off-peak window, notify downstream consumers in advance, and use `dbt run --full-refresh --select <model>` rather than `<model>+` when you can limit scope safely. Verify row counts match the expected full-history baseline before reopening the table to consumers.

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
>
> Before running `--full-refresh` on a snapshot, archive the existing table to a backup such as `CREATE TABLE snap_issuer_details_bak AS SELECT * FROM snap_issuer_details`. Confirm the source system holds the complete change history, obtain data-governance sign-off, and then rebuild. Restore from backup if the rebuilt snapshot diverges from expectations.

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
# Compile against a dev target and inspect the rendered SQL
dbt compile --select fct_esg_scores --target dev
```

`is_incremental()` is decided by dbt's execution context and whether the target relation already exists; you cannot force it by passing a regular `var()`. To inspect incremental behavior, compile or run against an environment where the model already exists, or inspect the compiled SQL from a real incremental run artifact.

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
