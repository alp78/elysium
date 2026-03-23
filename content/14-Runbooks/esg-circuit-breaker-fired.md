---
tags: [data-quality, airflow, esg]
type: runbook
severity: sev2
technology: airflow
status: stable
updated: 2026-03-23
---

# ESG Circuit Breaker Fired

> **Trigger**: ESG normalization pipeline circuit breaker halted publication
> **Severity**: Sev2 | **SLA**: 1 hr acknowledge, 4 hr resolve
> **Owner**: On-call data engineer + ESG data analyst

## Symptoms

- Airflow DAG `esg_score_normalization` task `circuit_breaker` returned `alert_and_halt`
- Slack alert: "ESG Circuit Breaker — publication halted"
- No new rows in `dbo.esg_scores_normalized` for today's score_date
- Datadog metric `esg.circuit_breaker.fired` incremented

## Diagnosis

1. **Read the breaker reasons from Airflow XCom**
   ```bash
   docker exec airflow-scheduler airflow tasks render esg_score_normalization circuit_breaker $(date +%Y-%m-%d) --map-index -1
   
   # Or check XCom directly
   docker exec airflow-scheduler airflow tasks test esg_score_normalization circuit_breaker $(date +%Y-%m-%d) 2>&1 | grep "breaker_reasons"
   ```

2. **Check vendor-level deviations**
   ```sql
   -- Compare today's staging scores vs last published scores
   WITH today AS (
       SELECT vendor_code, AVG(normalized_score) AS avg_score, COUNT(*) AS n
       FROM dbo.esg_scores_staging
       WHERE score_date = CAST(GETDATE() AS DATE)
       GROUP BY vendor_code
   ),
   previous AS (
       SELECT vendor_code, AVG(normalized_score) AS avg_score, COUNT(*) AS n
       FROM dbo.esg_scores_normalized
       WHERE score_date = (SELECT MAX(score_date) FROM dbo.esg_scores_normalized)
       GROUP BY vendor_code
   )
   SELECT t.vendor_code,
          t.avg_score AS today_avg, p.avg_score AS prev_avg,
          ABS(t.avg_score - p.avg_score) / NULLIF(p.avg_score, 0) * 100 AS pct_change,
          t.n AS today_count, p.n AS prev_count
   FROM today t LEFT JOIN previous p ON t.vendor_code = p.vendor_code
   ORDER BY pct_change DESC;
   ```

3. **Check for vendor scale changes**
   ```sql
   -- Did the vendor change their scoring methodology?
   SELECT vendor_code, MIN(normalized_score) AS min_score,
          MAX(normalized_score) AS max_score,
          AVG(normalized_score) AS avg_score
   FROM dbo.esg_scores_staging
   WHERE score_date = CAST(GETDATE() AS DATE)
   GROUP BY vendor_code;
   -- Compare ranges against expected: MSCI 0-100, Sustainalytics 0-100 (inverted), ISS 0-100
   ```

4. **Check null rate**
   ```sql
   SELECT vendor_code,
          COUNT(*) AS total,
          SUM(CASE WHEN normalized_score IS NULL THEN 1 ELSE 0 END) AS nulls,
          CAST(SUM(CASE WHEN normalized_score IS NULL THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 AS null_pct
   FROM dbo.esg_scores_staging
   WHERE score_date = CAST(GETDATE() AS DATE)
   GROUP BY vendor_code;
   ```

## Resolution

### Genuine vendor data issue

If the deviation is caused by a real vendor methodology change or data quality issue:

1. Contact the vendor to confirm the change
2. If confirmed: update normalization parameters, document the change
3. Re-run the normalization pipeline with updated parameters

### False positive (legitimate market-wide ESG shift)

If the deviation is explainable (e.g., regulatory reclassification affecting many companies):

1. **Get approval** from ESG data analyst or Index Operations manager
2. **Override the circuit breaker** with documentation:
   ```bash
   # Set Airflow variable to skip circuit breaker for this run
   docker exec airflow-scheduler airflow variables set esg_circuit_breaker_override "true"
   
   # Clear and retry from normalize step
   docker exec airflow-scheduler airflow tasks clear esg_score_normalization -t normalize_scores -s $(date +%Y-%m-%d) -e $(date +%Y-%m-%d) --yes --downstream
   
   # Remove override after successful run
   docker exec airflow-scheduler airflow variables set esg_circuit_breaker_override "false"
   ```
3. **Document the decision** in the audit trail:
   ```sql
   INSERT INTO dbo.pipeline_lineage (pipeline_name, calc_date, status, error_message)
   VALUES ('esg_score_normalization', CAST(GETDATE() AS DATE), 'OVERRIDE',
           'Circuit breaker overridden. Reason: [EXPLANATION]. Approved by: [NAME].');
   ```

### Use T-1 fallback data

If the issue cannot be resolved before the publication deadline:

```sql
-- Copy last known good scores as fallback
INSERT INTO dbo.esg_scores_normalized (instrument_isin, vendor_code, normalized_score, score_date, loaded_at)
SELECT instrument_isin, vendor_code, normalized_score,
       CAST(GETDATE() AS DATE) AS score_date, SYSUTCDATETIME()
FROM dbo.esg_scores_normalized
WHERE score_date = (SELECT MAX(score_date) FROM dbo.esg_scores_normalized
                    WHERE score_date < CAST(GETDATE() AS DATE));
```

Document in audit trail with reason "T-1 fallback due to circuit breaker".

## Escalation

- If vendor confirms methodology change: escalate to ESG Product Manager for normalization parameter update
- If override is needed: requires approval from Index Operations or ESG Data Analyst (not on-call alone)
- If unresolved after 2 hours: escalate to Engineering Lead

## Post-Incident

- [ ] Document the circuit breaker reason and resolution in audit trail (EU BMR requirement)
- [ ] If override was used: file the override decision with Compliance
- [ ] Review circuit breaker thresholds — should they be adjusted?
- [ ] If vendor issue: open a ticket with the vendor and track resolution
- [ ] Schedule PIR if this caused a delayed publication

## Related

- [[esg-data-ingestion-framework]] — Circuit breaker implementation details
- [[vendor-file-late-or-missing]] — If the root cause is missing vendor data
- [[compliance-and-auditability]] — EU BMR audit trail requirements
- [[on-call-guide]] — Severity definitions and escalation
