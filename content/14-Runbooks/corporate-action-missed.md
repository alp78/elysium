---
tags:
  - sql
type: runbook
severity: sev2
technology: sql-server, gcp
status: stable
updated: 2026-03-23
---

# Corporate Action Missed

> **Trigger**: A stock split, merger, spin-off, or special dividend was not applied to the index
> **Severity**: Sev2 | **SLA**: 1 hr acknowledge, 4 hr resolve (same-day if pre-close)
> **Owner**: On-call engineer + Index Operations
> **EU BMR relevance**: Article 11 (methodology adherence), Annex I (audit trail for constituent changes)

---

## Symptoms

- A constituent's weight in the index jumped abnormally — a 2-for-1 split doubles share count but price should halve; if price adjustment is missing, weight doubles
- Index level shows an unexplained large single-day move not consistent with market conditions
- Client or index operations team flags that a known corporate action is not reflected in published values
- Quality gate fires: `daily_constituent_return > 15%` or `daily_index_return > 5%` for a low-volatility index
- Divisor comparison shows the post-event divisor did not change when it should have
- Datadog alert: `corporate_action.unapplied_count > 0` for today's ex_date

> [!warning] Time sensitivity
> Corporate actions must be applied before market open on ex_date. If ex_date was today and the index has already published, treat this as a Sev1 and follow [[data-restatement-procedure]] immediately after diagnosing here.

---

## Diagnosis

### Step 1 — Identify the suspect instrument and action

Start from the alert or client report. Confirm the ISIN and the expected ex_date.

```sql
-- Check whether the corporate action exists in the source table at all
SELECT
    ca.corporate_action_id,
    ca.instrument_isin,
    ca.action_type,            -- SPLIT, DIVIDEND, MERGER, SPINOFF, RIGHTS_ISSUE
    ca.ex_date,
    ca.record_date,
    ca.announcement_date,
    ca.raw_factor,             -- e.g. 2.0 for a 2-for-1 split
    ca.applied_flag,
    ca.applied_at,
    ca.source                  -- e.g. 'vendor_a', 'manual', 'exchange_feed'
FROM dbo.corporate_actions ca
WHERE ca.instrument_isin = '<ISIN>'
  AND ca.ex_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
ORDER BY ca.ex_date;
```

```sql
-- Check the corporate action audit log for this instrument
SELECT
    caa.instrument_isin,
    caa.ex_date,
    caa.action_type,
    caa.raw_factor,
    caa.applied_factor,
    caa.divisor_before,
    caa.divisor_after,
    caa.price_adjustment_factor,
    caa.applied_by,
    caa.applied_at,
    caa.pipeline_run_id
FROM dbo.corporate_action_audit caa
WHERE caa.instrument_isin = '<ISIN>'
  AND caa.ex_date BETWEEN '<YYYY-MM-DD>' AND '<YYYY-MM-DD>'
ORDER BY caa.ex_date;
```

> [!tip] Interpreting the results
> - Row exists in `dbo.corporate_actions` but `applied_flag = 0`: action was received but the application pipeline failed or never ran.
> - No row in `dbo.corporate_actions`: the action was never ingested — go to Step 2.
> - Row exists and `applied_flag = 1` but values still look wrong: the factor was applied incorrectly — go to Step 3.

### Step 2 — Check whether the file arrived in the landing zone

```bash
# Check the corporate actions landing zone for the expected delivery date
# Vendors typically deliver T-1; ex_date files arrive the day before
gcloud storage ls "gs://landing-zone/corporate-actions/$(date -d 'yesterday' +%Y/%m/%d)/" --recursive

# Check a wider window if the action was announced earlier
gcloud storage ls "gs://landing-zone/corporate-actions/" --recursive \
  | grep '<ISIN>'

# Inspect a specific file
gcloud storage cp \
  "gs://landing-zone/corporate-actions/<YYYY>/<MM>/<DD>/<filename>.csv" \
  /tmp/ca_inspect.csv

grep '<ISIN>' /tmp/ca_inspect.csv
```

### Step 3 — Check whether the ingestion pipeline ran

```sql
-- Find pipeline runs for corporate action ingestion around the ex_date
SELECT
    pl.run_id,
    pl.pipeline_name,
    pl.run_date,
    pl.input_source,
    pl.input_file_checksum,
    pl.status,
    pl.error_message,
    pl.started_at,
    pl.finished_at
FROM dbo.pipeline_lineage pl
WHERE pl.run_date BETWEEN DATEADD(day, -1, '<YYYY-MM-DD>') AND '<YYYY-MM-DD>'
  AND pl.pipeline_name LIKE '%corporate_action%'
ORDER BY pl.started_at DESC;
```

```bash
# Check Airflow task logs for the ingestion DAG
airflow tasks logs ingest_corporate_actions wait_for_file <YYYY-MM-DD>
airflow tasks logs ingest_corporate_actions parse_and_load <YYYY-MM-DD>

# List recent DAG runs for corporate action ingestion
airflow dags list-runs --dag-id ingest_corporate_actions --limit 10
```

### Step 4 — Verify the divisor

The divisor must be adjusted on ex_date to prevent a discontinuity in the index level.

```sql
-- Compare divisor values around the ex_date
SELECT
    price_date,
    index_code,
    divisor,
    LAG(divisor) OVER (PARTITION BY index_code ORDER BY price_date) AS prev_divisor,
    (divisor - LAG(divisor) OVER (PARTITION BY index_code ORDER BY price_date))
        / LAG(divisor) OVER (PARTITION BY index_code ORDER BY price_date) * 100
        AS divisor_change_pct
FROM dbo.index_levels_gold
WHERE index_code = '<INDEX_CODE>'
  AND price_date BETWEEN DATEADD(day, -3, '<YYYY-MM-DD>') AND DATEADD(day, 3, '<YYYY-MM-DD>')
ORDER BY price_date;
```

Expected: divisor changes on the ex_date by a factor consistent with the corporate action. If divisor is unchanged on ex_date, the action was not applied.

### Step 5 — Quantify the impact

```sql
-- Measure the price discontinuity for the affected constituent
SELECT
    price_date,
    instrument_isin,
    close_price,
    LAG(close_price) OVER (PARTITION BY instrument_isin ORDER BY price_date) AS prev_close,
    (close_price - LAG(close_price) OVER (PARTITION BY instrument_isin ORDER BY price_date))
        / LAG(close_price) OVER (PARTITION BY instrument_isin ORDER BY price_date) * 100
        AS daily_return_pct
FROM dbo.prices_gold
WHERE instrument_isin = '<ISIN>'
  AND price_date BETWEEN DATEADD(day, -3, '<YYYY-MM-DD>') AND DATEADD(day, 3, '<YYYY-MM-DD>')
ORDER BY price_date;
```

---

## Resolution

### Step 1 — Source the missing or corrected corporate action data

If the action is absent from the landing zone, source it manually:

- Vendor portal / data terminal: download the corporate action record
- Exchange website (e.g., Euronext, LSE, XETRA): check official announcements
- Bloomberg or Refinitiv terminal: pull action details (factor, type, ex_date, record_date)

Key fields needed:
| Field | Example |
|---|---|
| `instrument_isin` | `GB0009252882` |
| `action_type` | `SPLIT` |
| `ex_date` | `2026-03-20` |
| `record_date` | `2026-03-19` |
| `raw_factor` | `2.0` (shares multiplied by 2) |
| `price_adjustment_factor` | `0.5` (price divided by 2) |

### Step 2 — Insert the corporate action record

```sql
-- Insert with idempotency: check for duplicates first
IF NOT EXISTS (
    SELECT 1 FROM dbo.corporate_actions
    WHERE instrument_isin = '<ISIN>'
      AND ex_date = '<YYYY-MM-DD>'
      AND action_type = '<ACTION_TYPE>'
)
BEGIN
    INSERT INTO dbo.corporate_actions (
        corporate_action_id,
        instrument_isin,
        action_type,
        ex_date,
        record_date,
        announcement_date,
        raw_factor,
        price_adjustment_factor,
        applied_flag,
        source,
        created_at,
        created_by,
        notes
    )
    VALUES (
        NEWID(),
        '<ISIN>',
        '<SPLIT | DIVIDEND | MERGER | SPINOFF | RIGHTS_ISSUE>',
        '<YYYY-MM-DD>',   -- ex_date
        '<YYYY-MM-DD>',   -- record_date
        '<YYYY-MM-DD>',   -- announcement_date
        <raw_factor>,     -- e.g. 2.0 for 2-for-1 split
        <price_adj_factor>, -- e.g. 0.5 for 2-for-1 split
        0,                -- applied_flag: not yet applied
        'manual — runbook procedure',
        GETUTCDATE(),
        '<engineer_id>',
        'Manually inserted during incident <TICKET_ID>. Source: <vendor/exchange>.'
    );
END
```

### Step 3 — Calculate and verify the adjustment factor

For a **stock split** (N-for-M):
- Price adjustment factor = M / N  (e.g., 1-for-2 split: factor = 0.5)
- Share count factor = N / M

For a **cash dividend**:
- Price adjustment factor = (P - D) / P, where P = pre-dividend close, D = dividend per share
- No share count change

For a **merger / absorption**:
- Constituent is removed from index on ex_date
- Divisor adjusted to keep index level continuous

```sql
-- Verify the factor looks mathematically consistent
-- For a 2-for-1 split: price on ex_date should be ~50% of prior close
SELECT
    p_before.close_price AS price_before_ex_date,
    p_after.close_price  AS price_on_ex_date,
    p_after.close_price / p_before.close_price AS observed_ratio,
    <price_adjustment_factor>                   AS expected_factor,
    ABS(p_after.close_price / p_before.close_price - <price_adjustment_factor>) AS discrepancy
FROM
    (SELECT close_price FROM dbo.prices_gold
     WHERE instrument_isin = '<ISIN>'
       AND price_date = DATEADD(day, -1, '<YYYY-MM-DD>')) p_before,
    (SELECT close_price FROM dbo.prices_gold
     WHERE instrument_isin = '<ISIN>'
       AND price_date = '<YYYY-MM-DD>') p_after;
```

### Step 4 — Apply retroactive price adjustment to historical prices before ex_date

> [!danger] This modifies the time series permanently. Run in a transaction and validate before committing.

```sql
BEGIN TRANSACTION;

-- Back-adjust all prices before ex_date by the price adjustment factor
-- This preserves return continuity when looking at the adjusted series
UPDATE dbo.prices_adjusted
SET
    close_price_adj  = close_price_adj * <price_adjustment_factor>,
    high_price_adj   = high_price_adj  * <price_adjustment_factor>,
    low_price_adj    = low_price_adj   * <price_adjustment_factor>,
    open_price_adj   = open_price_adj  * <price_adjustment_factor>,
    updated_at       = GETUTCDATE(),
    updated_by       = '<engineer_id>',
    adjustment_factor_applied = <price_adjustment_factor>,
    adjustment_reason = 'Corporate action: <ACTION_TYPE> on <YYYY-MM-DD>. Ticket: <TICKET_ID>'
WHERE instrument_isin = '<ISIN>'
  AND price_date < '<YYYY-MM-DD>'   -- strictly before ex_date
  AND is_adjusted = 1;

SELECT @@ROWCOUNT AS rows_adjusted;

-- Spot-check a few rows
SELECT TOP 10
    price_date,
    close_price_adj,
    adjustment_factor_applied
FROM dbo.prices_adjusted
WHERE instrument_isin = '<ISIN>'
ORDER BY price_date DESC;

-- ROLLBACK TRANSACTION;  -- uncomment to abort if spot-check fails
COMMIT TRANSACTION;
```

### Step 5 — Recalculate the divisor from ex_date forward

The divisor is recalculated using the standard chain-linking formula. Run the divisor recalculation stored procedure or the Airflow task:

```sql
-- Execute the divisor recalculation procedure for the affected index from ex_date
EXEC dbo.usp_recalculate_divisor
    @index_code  = '<INDEX_CODE>',
    @from_date   = '<YYYY-MM-DD>',   -- ex_date
    @to_date     = CAST(GETUTCDATE() AS DATE),
    @operator    = '<engineer_id>',
    @ticket_id   = '<TICKET_ID>';
```

```bash
# Alternatively, trigger the divisor recalc task in Airflow
airflow tasks run index_calculation_<INDEX_CODE> recalculate_divisor <YYYY-MM-DD> \
  --local \
  --conf '{"from_date": "<YYYY-MM-DD>", "ticket_id": "<TICKET_ID>"}'
```

### Step 6 — Recalculate index levels from ex_date forward

```bash
# Trigger full index recalculation from ex_date to today
airflow dags trigger index_recalc_<INDEX_CODE> \
  --conf '{
    "start_date": "<YYYY-MM-DD>",
    "end_date": "<TODAY_YYYY-MM-DD>",
    "reason": "corporate_action_retroactive_fix",
    "ticket_id": "<TICKET_ID>"
  }'

# Monitor progress
airflow dags list-runs --dag-id index_recalc_<INDEX_CODE> --state running
```

### Step 7 — Run weight validation

```sql
-- Weight sum must equal exactly 1.0 for every date in the recalculated range
SELECT
    price_date,
    SUM(weight)      AS total_weight,
    COUNT(*)         AS constituent_count,
    CASE WHEN ABS(SUM(weight) - 1.0) > 0.00001 THEN 'FAIL' ELSE 'PASS' END AS weight_check
FROM dbo.index_constituents_gold
WHERE index_code = '<INDEX_CODE>'
  AND price_date BETWEEN '<YYYY-MM-DD>' AND CAST(GETUTCDATE() AS DATE)
GROUP BY price_date
ORDER BY price_date;

-- Also check the affected constituent's weight looks plausible post-action
SELECT
    price_date,
    instrument_isin,
    weight,
    shares_in_index,
    close_price_adj
FROM dbo.index_constituents_gold
WHERE index_code   = '<INDEX_CODE>'
  AND instrument_isin = '<ISIN>'
  AND price_date BETWEEN DATEADD(day, -3, '<YYYY-MM-DD>') AND DATEADD(day, 3, '<YYYY-MM-DD>')
ORDER BY price_date;
```

### Step 8 — Update the corporate action audit log

```sql
-- Mark the action as applied and log all relevant details
INSERT INTO dbo.corporate_action_audit (
    audit_id,
    instrument_isin,
    ex_date,
    action_type,
    raw_factor,
    applied_factor,
    price_adjustment_factor,
    divisor_before,
    divisor_after,
    indices_affected,
    applied_by,
    applied_at,
    pipeline_run_id,
    ticket_id,
    notes
)
SELECT
    NEWID(),
    '<ISIN>',
    '<YYYY-MM-DD>',
    '<ACTION_TYPE>',
    <raw_factor>,
    <applied_factor>,
    <price_adjustment_factor>,
    <divisor_before>,   -- retrieve from pre-recalc snapshot or pipeline_lineage
    <divisor_after>,    -- retrieve from post-recalc query
    '<INDEX_CODE>',
    '<engineer_id>',
    GETUTCDATE(),
    '<pipeline_run_id>',
    '<TICKET_ID>',
    'Applied retroactively during incident <TICKET_ID>. Source: <vendor/exchange>.';

-- Mark the source record as applied
UPDATE dbo.corporate_actions
SET
    applied_flag = 1,
    applied_at   = GETUTCDATE()
WHERE instrument_isin = '<ISIN>'
  AND ex_date = '<YYYY-MM-DD>'
  AND action_type = '<ACTION_TYPE>';
```

### Step 9 — If published values were affected, trigger restatement

If the missed corporate action affected index values that were already published to clients or regulatory feeds, immediately follow the full [[data-restatement-procedure]].

```sql
-- Quick check: were any published values produced for the affected date range?
SELECT COUNT(*) AS published_rows_affected
FROM dbo.publication_log
WHERE index_code = '<INDEX_CODE>'
  AND price_date >= '<YYYY-MM-DD>'   -- ex_date or first affected date
  AND publication_status = 'published';
```

If this returns > 0, open [[data-restatement-procedure]] as a parallel workstream.

---

## Escalation

| Condition | Escalate to | SLA |
|---|---|---|
| Corporate action affects a constituent > 5% weight | Head of Index Operations | Within 30 min |
| Published values are wrong and clients have already consumed them | On-call lead + Compliance | Immediately |
| Merger/acquisition removes a constituent entirely | Index methodology team for eligibility review | Within 1 hr |
| Vendor delivered a wrong factor | Vendor relationship manager | Within 1 hr |
| Divisor calculation cannot be reproduced | Senior data engineer + Index methodology | Immediately |

---

## Post-Incident Checklist

- [ ] `dbo.corporate_actions.applied_flag = 1` for the affected action
- [ ] `dbo.corporate_action_audit` row inserted with all factor and divisor values
- [ ] `dbo.index_constituents_gold` weight check passes (SUM = 1.0) for all affected dates
- [ ] `dbo.index_levels_gold` updated and verified against shadow recalculation
- [ ] If published: [[data-restatement-procedure]] completed and audit trail updated
- [ ] Airflow DAG re-enabled and next scheduled run succeeds
- [ ] Monitoring rule added or tuned to catch this action type earlier
- [ ] PIR scheduled within 48 hours

---

## Related

- [[data-restatement-procedure]]
- [[compliance-and-auditability]]
- [[vendor-file-late-or-missing]]
- [[on-call-guide]]
- [[runbooks-index]]
