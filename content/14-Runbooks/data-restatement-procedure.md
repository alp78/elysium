---
tags: []
type: runbook
severity: sev1
technology: sql-server, bigquery
status: stable
updated: 2026-03-23
---

# Data Restatement Procedure

> **Trigger**: Published index values need correction
> **Severity**: Sev1 | **SLA**: 15 min acknowledge, 4 hr resolve
> **Owner**: On-call engineer + Compliance
> **EU BMR relevance**: Article 11 (methodology), Article 13 (significant changes), Annex I (record-keeping)

---

## Symptoms

- Client reports index level does not match their independent calculation
- Internal reconciliation job shows SQL Server gold table diverges from BigQuery published dataset
- Corporate action was applied with a wrong adjustment factor (price series discontinuity visible in charts)
- Data vendor issued a formal data correction notice for a previously delivered file
- Datadog alert fires: `index.reconciliation.breach` or `index.level.delta_pct > 0.05`
- Compliance team flags a value in a regulatory submission that cannot be reproduced

> [!warning] Do not attempt a silent fix
> Every restatement affecting published values must be documented in the audit trail and — if material — notified to clients and regulators. Skipping this step is a BMR violation.

---

## Diagnosis

### Step 1 — Confirm the discrepancy exists and scope it

Run the reproducibility check against the suspect date range. Compare the stored published value against a fresh recalculation.

```sql
-- SQL Server: pull published vs. recalculated for a given index and date range
SELECT
    p.index_code,
    p.price_date,
    p.index_level          AS published_level,
    r.index_level          AS recalc_level,
    ABS(p.index_level - r.index_level) / p.index_level * 100  AS delta_pct
FROM dbo.index_levels_gold  p
JOIN dbo.index_levels_recalc r
    ON p.index_code = r.index_code
   AND p.price_date = r.price_date
WHERE p.index_code = '<INDEX_CODE>'
  AND p.price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
  AND ABS(p.index_level - r.index_level) / p.index_level * 100 > 0.0001
ORDER BY p.price_date;
```

```sql
-- Cross-check: does BigQuery agree with SQL Server gold?
-- Run in BigQuery console or via bq CLI
SELECT
    index_code,
    price_date,
    index_level          AS bq_level
FROM `<project>.published.index_levels`
WHERE index_code = '<INDEX_CODE>'
  AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
ORDER BY price_date;
```

```bash
# Export BigQuery result to compare locally
bq query --use_legacy_sql=false --format=csv \
  "SELECT index_code, price_date, index_level
   FROM \`<project>.published.index_levels\`
   WHERE index_code = '<INDEX_CODE>'
     AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
   ORDER BY price_date" \
  > /tmp/bq_levels.csv
```

### Step 2 — Identify affected dates and indices

```sql
-- Find all dates with a delta above the materiality threshold (0.01%)
SELECT
    p.index_code,
    p.price_date,
    p.index_level          AS published_level,
    r.index_level          AS recalc_level,
    ABS(p.index_level - r.index_level) / p.index_level * 100  AS delta_pct,
    CASE
        WHEN ABS(p.index_level - r.index_level) / p.index_level * 100 >= 0.5
            THEN 'MATERIAL — BMR Article 13 notification required'
        WHEN ABS(p.index_level - r.index_level) / p.index_level * 100 >= 0.01
            THEN 'SIGNIFICANT — client notification required'
        ELSE 'MINOR — internal correction only'
    END AS materiality_band
FROM dbo.index_levels_gold  p
JOIN dbo.index_levels_recalc r
    ON p.index_code = r.index_code
   AND p.price_date = r.price_date
WHERE ABS(p.index_level - r.index_level) / p.index_level * 100 > 0.0001
ORDER BY delta_pct DESC;
```

### Step 3 — Determine root cause

Check pipeline lineage for the affected dates:

```sql
-- What ran, in what order, and what was the input source?
SELECT
    run_id,
    pipeline_name,
    run_date,
    input_source,
    input_file_checksum,
    status,
    error_message,
    started_at,
    finished_at
FROM dbo.pipeline_lineage
WHERE run_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
  AND pipeline_name LIKE '%<INDEX_CODE>%'
ORDER BY started_at;
```

Check corporate action audit for incorrect adjustment factors:

```sql
SELECT
    ca.instrument_isin,
    ca.ex_date,
    ca.action_type,
    ca.raw_factor,
    ca.applied_factor,
    ca.divisor_before,
    ca.divisor_after,
    ca.applied_by,
    ca.applied_at
FROM dbo.corporate_action_audit ca
WHERE ca.ex_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
ORDER BY ca.ex_date, ca.instrument_isin;
```

Check the raw vendor file that was ingested on the affected date:

```bash
# List files that arrived in the landing zone on the suspect date
gcloud storage ls "gs://landing-zone/prices/<YYYY>/<MM>/<DD>/" --recursive

# Download the original file for manual inspection
gcloud storage cp \
  "gs://landing-zone/prices/<YYYY>/<MM>/<DD>/<filename>.csv" \
  /tmp/suspect_input.csv

# Compare file checksum against pipeline_lineage record
sha256sum /tmp/suspect_input.csv
```

---

## Resolution

> [!danger] Step 0 — HALT pending publications immediately
> Before touching any data, prevent any further automated publication of incorrect values.

### Step 0 — Halt the pipeline

```bash
# Pause the affected DAG in Airflow to prevent new publication runs
airflow dags pause index_publication_<INDEX_CODE>

# Confirm the DAG is paused
airflow dags list | grep index_publication_<INDEX_CODE>

# If a run is currently in-flight, mark it failed to stop downstream tasks
airflow dags list-runs --dag-id index_publication_<INDEX_CODE> --state running
airflow tasks clear index_publication_<INDEX_CODE> \
  --start-date <YYYY-MM-DD> \
  --end-date <YYYY-MM-DD> \
  --yes
```

### Step 1 — Document root cause in pipeline_lineage

```sql
INSERT INTO dbo.pipeline_lineage (
    run_id, pipeline_name, run_date, input_source,
    status, error_message, started_at, finished_at, notes
)
VALUES (
    NEWID(),
    'data_restatement',
    CAST(GETUTCDATE() AS DATE),
    'manual — restatement procedure',
    'in_progress',
    '<Describe root cause: e.g. vendor delivered wrong closing price for ISIN XS1234567890 on 2026-03-20>',
    GETUTCDATE(),
    NULL,
    'Restatement initiated by <engineer> at <HH:MM> UTC. Ticket: <TICKET_ID>'
);
```

### Step 2 — Calculate correct values in shadow environment

```bash
# Trigger the recalculation pipeline against the shadow/dev environment
# Pass the corrected input file if applicable
airflow dags trigger index_recalc_shadow \
  --conf '{"index_code": "<INDEX_CODE>", "start_date": "<YYYY-MM-DD>", "end_date": "<YYYY-MM-DD>", "input_override": "gs://landing-zone-dev/prices/<YYYY>/<MM>/<DD>/<corrected_file>.csv"}'
```

### Step 3 — Validate recalculated values

```sql
-- Weight sum must equal 1.0 for every date in the affected range
SELECT
    price_date,
    SUM(weight) AS total_weight,
    COUNT(*)    AS constituent_count
FROM dbo.index_constituents_shadow
WHERE index_code = '<INDEX_CODE>'
  AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
GROUP BY price_date
HAVING ABS(SUM(weight) - 1.0) > 0.00001
ORDER BY price_date;

-- Return continuity check: daily return must be within plausible bounds
SELECT
    price_date,
    index_level,
    LAG(index_level) OVER (ORDER BY price_date) AS prev_level,
    (index_level - LAG(index_level) OVER (ORDER BY price_date))
        / LAG(index_level) OVER (ORDER BY price_date) * 100 AS daily_return_pct
FROM dbo.index_levels_shadow
WHERE index_code = '<INDEX_CODE>'
  AND price_date BETWEEN DATEADD(day, -1, '<YYYY-MM-DD>') AND '<YYYY-MM-DD_end>'
ORDER BY price_date;

-- Cross-check shadow levels against vendor's published benchmark level (if available)
SELECT
    s.price_date,
    s.index_level  AS shadow_level,
    v.vendor_level,
    ABS(s.index_level - v.vendor_level) / v.vendor_level * 100 AS delta_pct
FROM dbo.index_levels_shadow s
JOIN dbo.vendor_benchmark_levels v
    ON s.index_code = v.index_code
   AND s.price_date = v.price_date
WHERE s.index_code = '<INDEX_CODE>'
  AND s.price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
ORDER BY s.price_date;
```

### Step 4 — Apply correction to SQL Server gold tables (idempotent MERGE)

```sql
BEGIN TRANSACTION;

-- Idempotent MERGE: updates existing rows, inserts if somehow missing
MERGE dbo.index_levels_gold AS target
USING (
    SELECT index_code, price_date, index_level, divisor, updated_at, updated_by
    FROM dbo.index_levels_shadow
    WHERE index_code = '<INDEX_CODE>'
      AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
) AS source
ON target.index_code = source.index_code
   AND target.price_date = source.price_date
WHEN MATCHED THEN
    UPDATE SET
        index_level = source.index_level,
        divisor     = source.divisor,
        updated_at  = GETUTCDATE(),
        updated_by  = '<engineer_id>',
        restatement_flag = 1,
        restatement_reason = '<brief description>'
WHEN NOT MATCHED BY TARGET THEN
    INSERT (index_code, price_date, index_level, divisor, updated_at, updated_by, restatement_flag, restatement_reason)
    VALUES (source.index_code, source.price_date, source.index_level, source.divisor, GETUTCDATE(), '<engineer_id>', 1, '<brief description>');

-- Verify row count affected
SELECT @@ROWCOUNT AS rows_merged;

-- Do NOT commit until Step 5 BigQuery is also ready — hold the transaction open
-- COMMIT TRANSACTION;  -- uncomment after BQ validation
-- ROLLBACK TRANSACTION; -- use this to abort if anything looks wrong
```

> [!caution] Hold this transaction open in a separate session while you prepare the BigQuery update. Commit both within the same change window to minimise the window of inconsistency.

### Step 5 — Apply correction to BigQuery

```bash
# Method A: MERGE (preferred — atomic, auditable)
bq query --use_legacy_sql=false --location=EU <<'EOF'
MERGE `<project>.published.index_levels` AS T
USING (
  SELECT
    '<INDEX_CODE>'          AS index_code,
    price_date,
    index_level,
    divisor,
    CURRENT_TIMESTAMP()     AS updated_at,
    '<engineer_id>'         AS updated_by,
    TRUE                    AS restatement_flag,
    '<brief description>'   AS restatement_reason
  FROM `<project>.shadow.index_levels`
  WHERE index_code = '<INDEX_CODE>'
    AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD_end>'
) AS S
ON T.index_code = S.index_code AND T.price_date = S.price_date
WHEN MATCHED THEN
  UPDATE SET
    index_level        = S.index_level,
    divisor            = S.divisor,
    updated_at         = S.updated_at,
    updated_by         = S.updated_by,
    restatement_flag   = S.restatement_flag,
    restatement_reason = S.restatement_reason
WHEN NOT MATCHED THEN
  INSERT ROW;
EOF
```

```bash
# Method B: DELETE + INSERT (use only if MERGE quota is a concern)
bq query --use_legacy_sql=false --location=EU \
  "DELETE FROM \`<project>.published.index_levels\`
   WHERE index_code = '<INDEX_CODE>'
     AND price_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD_end>'"

bq load --source_format=CSV --skip_leading_rows=1 \
  <project>:published.index_levels \
  gs://staging-bucket/restatement/<INDEX_CODE>_corrected.csv \
  index_code:STRING,price_date:DATE,index_level:FLOAT64,divisor:FLOAT64
```

### Step 6 — Commit SQL Server transaction and update audit trail

```sql
-- In the SQL Server session still holding the transaction:
COMMIT TRANSACTION;

-- Now insert into the restatement log
INSERT INTO dbo.restatement_log (
    restatement_id,
    index_code,
    affected_start_date,
    affected_end_date,
    root_cause_category,
    root_cause_detail,
    max_delta_pct,
    materiality_band,
    corrected_by,
    corrected_at,
    ticket_id,
    bmr_notification_required,
    bmr_notification_sent_at,
    client_notification_required,
    client_notification_sent_at
)
VALUES (
    NEWID(),
    '<INDEX_CODE>',
    '<YYYY-MM-DD>',          -- first affected date
    '<YYYY-MM-DD>',          -- last affected date
    '<bad_input_data | calculation_bug | missed_corporate_action | vendor_correction>',
    '<Detailed description of what was wrong and how it was fixed>',
    <max_delta_pct_value>,
    '<MATERIAL | SIGNIFICANT | MINOR>',
    '<engineer_id>',
    GETUTCDATE(),
    '<TICKET_ID>',
    <1 or 0>,                -- 1 if BMR notification required
    NULL,                    -- fill in after notification sent
    <1 or 0>,                -- 1 if client notification required
    NULL                     -- fill in after notification sent
);
```

### Step 7 — Re-enable the pipeline and verify end-to-end

```bash
# Unpause the DAG
airflow dags unpause index_publication_<INDEX_CODE>

# Trigger a fresh publication run for the corrected date range
airflow dags trigger index_publication_<INDEX_CODE> \
  --conf '{"start_date": "<YYYY-MM-DD>", "end_date": "<YYYY-MM-DD>", "restatement": true}'

# Monitor the run
airflow dags list-runs --dag-id index_publication_<INDEX_CODE> --state running
```

### Step 8 — Notify subscribers

Send a restatement notice to all downstream clients subscribed to the affected index. Use the standard email template:

```
Subject: [DATA CORRECTION] <INDEX_CODE> — Index Level Restatement <YYYY-MM-DD> to <YYYY-MM-DD>

Dear <Client Name>,

We are writing to notify you of a correction to published values for <INDEX_CODE>
for the period <YYYY-MM-DD> to <YYYY-MM-DD>.

Root cause: <one-sentence summary>

Affected values:
  Date          | Previously published | Corrected value | Delta (%)
  <YYYY-MM-DD>  | <old_level>          | <new_level>     | <delta_pct>%
  ...

Corrected values are now live in all delivery channels. Please update any
downstream models or reports that consumed the previously published values.

If you have questions, please contact your account manager or reply to this email.

Reference: Ticket <TICKET_ID> | Restatement ID: <restatement_id>
```

### Step 9 — EU BMR Article 13 notification (if materiality threshold exceeded)

> [!important] BMR Article 13 trigger
> If any single-day delta exceeds **0.5%** of the published index level, or if the correction affects a value used in a regulated financial instrument (ETF, structured product, derivative), notify the oversight function within **24 hours** of discovery.

```sql
-- Update restatement_log with notification timestamps
UPDATE dbo.restatement_log
SET
    bmr_notification_sent_at   = GETUTCDATE(),
    client_notification_sent_at = GETUTCDATE()
WHERE restatement_id = '<restatement_id>';
```

File the following with the Benchmark Oversight Committee:

- Restatement log record (export from `dbo.restatement_log`)
- Input data evidence (original vs. corrected vendor file checksums)
- Calculation audit trail from `dbo.pipeline_lineage`
- List of financial instruments known to reference this index

---

## Escalation

| Condition | Escalate to | SLA |
|---|---|---|
| delta_pct >= 0.5% on any date | Compliance + Head of Index Ops | Immediately |
| Regulated financial instrument affected | Legal + Oversight Committee | < 2 hours |
| Client threatening dispute or legal action | Head of Index Ops + Legal | Immediately |
| Root cause is vendor-side data error | Vendor relationship manager | < 1 hour |
| Unable to reproduce correct values after 2 hours | Senior data engineer + Index methodology team | Immediately |

---

## Post-Incident Checklist

- [ ] COMMIT transaction confirmed on SQL Server and BigQuery MERGE succeeded
- [ ] `dbo.restatement_log` row inserted with all timestamps filled in
- [ ] Airflow DAG re-enabled and a clean publication run completed successfully
- [ ] Client notification email sent and delivery confirmed
- [ ] BMR Article 13 filing submitted to oversight function (if material)
- [ ] `dbo.pipeline_lineage` updated with `status = 'completed'` for the restatement run
- [ ] Blameless PIR scheduled within 48 hours
- [ ] Monitoring gap identified and JIRA ticket raised to add detection coverage
- [ ] If vendor-caused: formal SLA breach notice sent with reference to contract clause

---

## Related

- [[corporate-action-missed]]
- [[compliance-and-auditability]]
- [[vendor-file-late-or-missing]]
- [[on-call-guide]]
- [[runbooks-index]]
