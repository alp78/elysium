---
type: reference
category: observability
technology:
  - bigquery
  - datadog
  - python
  - csharp
  - sql-server
tags: [monitoring, observability, python, csharp, sql, bigquery, datadog]
aliases:
  - compliance
  - audit trail
  - data lineage
  - corporate action
  - stock split
  - merger
  - price adjustment factor
  - divisor
  - EU BMR
keywords:
  - compliance
  - audit trail
  - data lineage
  - corporate actions
  - EU BMR
  - stock split
  - reverse split
  - special dividend
  - spin-off
  - merger
  - rights issue
  - price adjustment factor
  - divisor adjustment
  - restatement
  - record retention
  - oversight function
  - complaint handling
  - shadow calculation
  - materiality threshold
  - index calculation
  - financial index
  - pipeline lineage
  - reproducibility test
  - data quality
  - monitoring
  - alerting
  - BigQuery
  - Datadog
  - SQL Server
  - Python
  - C#
  - Dapper
  - GCS
  - SFTP
  - SHA-256
  - Bronze Silver Gold
  - run_id
  - calc_date
  - BMR Article 11
  - BMR Article 21
  - five year retention
related:
  - "[[pit-integrity-logic]]"
  - "[[esg-data-ingestion-framework]]"
  - "[[dataops-for-indices]]"
  - "[[index-maintenance-and-corporate-actions]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Compliance and Auditability — Financial Index Calculation

This reference covers the full compliance and auditability surface for a production index calculation platform: end-to-end data lineage, corporate action processing with complete audit trails, EU Benchmarks Regulation (BMR) obligations, restatement procedures, and Datadog integration patterns for continuous compliance monitoring. The [[audit-logging|SQL Server audit logging]] configuration captures database-level access events that feed directly into the audit trail described here.

---

### Table of Contents

1. [[#1. End-to-End Data Lineage]]
2. [[#2. Corporate Action Processing]]
3. [[#3. EU BMR Compliance]]
4. [[#4. Restatement Procedures]]
5. [[#5. Datadog Integration for Compliance Monitoring]]

---

## End-to-End Data Lineage

### The Lineage Chain

Every published index level must be traceable from its final value back to the original vendor file byte-for-byte. The canonical lineage chain is:

```
Raw vendor file (SFTP / API)
        │
        ▼  immutable, timestamped
GCS Landing Zone  (gs://landing-zone/YYYY/MM/DD/<vendor>/<filename>)
        │
        ▼  ingestion pipeline writes SHA-256 hash + row count
SQL Server  ─►  Bronze  (raw copy, no transformations)
                  │
                  ▼  validated, normalised
                Silver  (cleansed, typed, de-duplicated)
                  │
                  ▼  business logic applied
                 Gold   (constituent weights, adjusted prices)
        │
        ▼  batch export
BigQuery  (index_gold dataset — append-only partitioned tables)
        │
        ▼  calculation engine
Published Index Level  (index_levels table + downstream distribution)
```

Key invariants:
- GCS objects are **write-once**. No pipeline stage overwrites a landing file; all corrections produce a new versioned object.
- Every Bronze row carries the `source_file_path` and `source_file_hash` columns inherited from the landing record.
- Every Gold row carries the `pipeline_run_id` that produced it, enabling a single JOIN back to the lineage metadata table.

### BigQuery: Tracing a Table Back to Source Jobs

Use `INFORMATION_SCHEMA.JOBS` to reconstruct which job wrote a given destination table and when.

```sql
-- Trace all jobs that wrote to a specific destination table
-- within the last 90 days.
-- Replace <project> and <dataset>.<table> with actual values.
SELECT
    job_id,
    creation_time,
    start_time,
    end_time,
    user_email,
    statement_type,
    destination_table.project_id  AS dest_project,
    destination_table.dataset_id  AS dest_dataset,
    destination_table.table_id    AS dest_table,
    ARRAY_LENGTH(referenced_tables) AS referenced_table_count,
    referenced_tables,
    total_bytes_processed,
    total_slot_ms,
    labels
FROM
    `<project>`.`region-eu`.INFORMATION_SCHEMA.JOBS
WHERE
    DATE(creation_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND destination_table.dataset_id = '<dataset>'
    AND destination_table.table_id   = '<table>'
    AND state = 'DONE'
    AND error_result IS NULL
ORDER BY
    creation_time DESC;
```

To walk the full graph (destination → referenced tables → their source jobs), wrap the above in a recursive CTE or call it iteratively per referenced table. For automated lineage crawling, use the [BigQuery Data Lineage API](https://cloud.google.com/data-catalog/docs/reference/data-lineage/rest) (Cloud Data Catalog).

```sql
-- Cross-reference a job_id with the pipeline lineage metadata table
-- to retrieve the original vendor file hash.
SELECT
    j.job_id,
    j.creation_time,
    l.source_file_path,
    l.source_file_hash,
    l.source_row_count,
    l.bronze_row_count,
    l.pipeline_status
FROM
    `<project>`.`region-eu`.INFORMATION_SCHEMA.JOBS AS j
    INNER JOIN pipeline_lineage_metadata AS l
        ON l.bq_job_id = j.job_id
WHERE
    j.job_id = '<job_id_to_investigate>';
```

### Datadog APM Trace Linking

Every pipeline stage emits a Datadog APM span. Spans within the same logical pipeline run share three mandatory tags so that the full execution can be reconstructed from any single span.

```python
"""
pipeline_tracing.py
Centralised trace context for index calculation pipelines.
"""

import hashlib
import os
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from ddtrace import tracer, Pin
from ddtrace.ext import SpanTypes


@dataclass
class PipelineContext:
    """Immutable context propagated across all stages of a single pipeline run."""

    run_id: str               # UUID4, generated once per logical run
    calc_date: date           # Business date being calculated
    index_code: str           # e.g. "EQUITY_LARGE_CAP_USD"
    vendor: str               # e.g. "REFINITIV", "BLOOMBERG"
    environment: str = field(default_factory=lambda: os.getenv("ENV", "production"))

    def as_dd_tags(self) -> dict:
        return {
            "run_id":     self.run_id,
            "calc_date":  self.calc_date.isoformat(),
            "index_code": self.index_code,
            "vendor":     self.vendor,
            "env":        self.environment,
        }


def traced_stage(stage_name: str, ctx: PipelineContext, resource: Optional[str] = None):
    """
    Context manager that wraps a pipeline stage in a Datadog APM span,
    automatically applying all mandatory compliance tags.

    Usage:
        with traced_stage("silver_transform", ctx, resource="price_normalisation"):
            do_work()
    """
    tags = ctx.as_dd_tags()
    tags["pipeline.stage"] = stage_name

    span = tracer.start_span(
        name=f"index.pipeline.{stage_name}",
        service="index-calculation-engine",
        resource=resource or stage_name,
        span_type=SpanTypes.SQL if "sql" in stage_name.lower() else SpanTypes.WORKER,
    )
    for k, v in tags.items():
        span.set_tag(k, v)

    class _Ctx:
        def __enter__(self):
            return span

        def __exit__(self, exc_type, exc_val, exc_tb):
            if exc_type:
                span.set_tag("error", True)
                span.set_tag("error.type", exc_type.__name__)
                span.set_tag("error.msg", str(exc_val))
            span.finish()
            return False  # do not suppress exceptions

    return _Ctx()


# ---------------------------------------------------------------------------
# Example: ingestion stage
# ---------------------------------------------------------------------------

def ingest_vendor_file(ctx: PipelineContext, file_path: str, row_count: int) -> str:
    """Returns SHA-256 hex digest of the ingested file."""
    with traced_stage("ingestion", ctx, resource="vendor_file_download") as span:
        sha256 = _compute_sha256(file_path)
        span.set_tag("file.path",      file_path)
        span.set_tag("file.sha256",    sha256)
        span.set_tag("file.row_count", row_count)
        return sha256


def _compute_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65_536), b""):
            h.update(chunk)
    return h.hexdigest()
```

### Pipeline Lineage Metadata Table (T-SQL)

```sql
-- ============================================================
-- Pipeline Lineage Metadata
-- One row per pipeline run per source file.
-- Append-only — updates are NEVER performed; corrections are
-- new rows with a corrected_run_id reference.
-- ============================================================

CREATE TABLE dbo.pipeline_lineage_metadata
(
    lineage_id          BIGINT          NOT NULL IDENTITY(1,1)  PRIMARY KEY,

    -- Run identification
    run_id              UNIQUEIDENTIFIER NOT NULL,               -- UUID4
    parent_run_id       UNIQUEIDENTIFIER NULL,                   -- set for reruns / corrections
    corrected_run_id    UNIQUEIDENTIFIER NULL,                   -- set on original row when superseded

    -- Business context
    calc_date           DATE            NOT NULL,
    index_code          NVARCHAR(64)    NOT NULL,
    vendor              NVARCHAR(64)    NOT NULL,
    pipeline_stage      NVARCHAR(32)    NOT NULL,                -- INGESTION | BRONZE | SILVER | GOLD | BQ_EXPORT

    -- Source file provenance
    source_file_path    NVARCHAR(1024)  NOT NULL,               -- GCS URI
    source_file_hash    CHAR(64)        NOT NULL,               -- SHA-256 hex
    source_file_size_b  BIGINT          NULL,

    -- Row counts at each layer
    source_row_count    INT             NULL,
    bronze_row_count    INT             NULL,
    silver_row_count    INT             NULL,
    gold_row_count      INT             NULL,
    rejected_row_count  INT             NULL DEFAULT 0,

    -- BigQuery cross-reference
    bq_job_id           NVARCHAR(256)   NULL,
    bq_dataset          NVARCHAR(256)   NULL,
    bq_table            NVARCHAR(256)   NULL,

    -- Timing
    pipeline_start_utc  DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    pipeline_end_utc    DATETIME2(3)    NULL,
    duration_ms         AS DATEDIFF(MILLISECOND, pipeline_start_utc, pipeline_end_utc) PERSISTED,

    -- Status
    pipeline_status     NVARCHAR(16)    NOT NULL DEFAULT 'RUNNING',   -- RUNNING | SUCCESS | FAILED | SUPERSEDED
    error_message       NVARCHAR(MAX)   NULL,

    -- Audit
    created_by          NVARCHAR(128)   NOT NULL DEFAULT SYSTEM_USER,
    created_utc         DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT CK_plm_status CHECK (pipeline_status IN ('RUNNING','SUCCESS','FAILED','SUPERSEDED')),
    CONSTRAINT CK_plm_stage  CHECK (pipeline_stage  IN ('INGESTION','BRONZE','SILVER','GOLD','BQ_EXPORT'))
);

CREATE UNIQUE INDEX UX_plm_run_stage
    ON dbo.pipeline_lineage_metadata (run_id, pipeline_stage);

CREATE INDEX IX_plm_calc_date_index
    ON dbo.pipeline_lineage_metadata (calc_date, index_code)
    INCLUDE (pipeline_status, source_file_hash);
```

### Reproducibility Test

Given a published index level, this script retrieves the exact inputs that produced it and re-runs the calculation to verify the result matches within floating-point tolerance.

```python
"""
reproducibility_test.py

Usage:
    python reproducibility_test.py \
        --index-code EQUITY_LARGE_CAP_USD \
        --calc-date  2026-03-20 \
        --tolerance  1e-8
"""

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List

import pyodbc
import sqlalchemy as sa
from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


@dataclass
class Constituent:
    security_id:      str
    adjusted_price:   Decimal
    shares_in_index:  Decimal
    fx_rate:          Decimal          # local currency → index currency
    market_cap:       Decimal = Decimal("0")

    def __post_init__(self):
        self.market_cap = (
            self.adjusted_price * self.shares_in_index * self.fx_rate
        )


def fetch_published_level(
    bq_client: bigquery.Client,
    index_code: str,
    calc_date: date,
) -> Decimal:
    query = """
        SELECT index_level
        FROM `index_gold.index_levels`
        WHERE index_code = @index_code
          AND calc_date  = @calc_date
          AND is_official = TRUE
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("index_code", "STRING", index_code),
            bigquery.ScalarQueryParameter("calc_date",  "DATE",   calc_date.isoformat()),
        ]
    )
    rows = list(bq_client.query(query, job_config=job_config).result())
    if not rows:
        raise ValueError(f"No published level found for {index_code} on {calc_date}")
    return Decimal(str(rows[0]["index_level"]))


def fetch_constituents(
    bq_client: bigquery.Client,
    index_code: str,
    calc_date: date,
) -> List[Constituent]:
    """Retrieve the gold-layer constituent snapshot that was used for the published level."""
    query = """
        SELECT
            security_id,
            adjusted_price,
            shares_in_index,
            fx_rate_to_index_ccy
        FROM `index_gold.constituent_snapshots`
        WHERE index_code = @index_code
          AND calc_date  = @calc_date
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("index_code", "STRING", index_code),
            bigquery.ScalarQueryParameter("calc_date",  "DATE",   calc_date.isoformat()),
        ]
    )
    rows = list(bq_client.query(query, job_config=job_config).result())
    if not rows:
        raise ValueError(f"No constituent snapshot for {index_code} on {calc_date}")

    return [
        Constituent(
            security_id=r["security_id"],
            adjusted_price=Decimal(str(r["adjusted_price"])),
            shares_in_index=Decimal(str(r["shares_in_index"])),
            fx_rate=Decimal(str(r["fx_rate_to_index_ccy"])),
        )
        for r in rows
    ]


def fetch_divisor(
    bq_client: bigquery.Client,
    index_code: str,
    calc_date: date,
) -> Decimal:
    query = """
        SELECT divisor
        FROM `index_gold.divisor_history`
        WHERE index_code   = @index_code
          AND effective_date <= @calc_date
        ORDER BY effective_date DESC
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("index_code", "STRING", index_code),
            bigquery.ScalarQueryParameter("calc_date",  "DATE",   calc_date.isoformat()),
        ]
    )
    rows = list(bq_client.query(query, job_config=job_config).result())
    if not rows:
        raise ValueError(f"No divisor found for {index_code} on or before {calc_date}")
    return Decimal(str(rows[0]["divisor"]))


def calculate_index_level(
    constituents: List[Constituent],
    divisor: Decimal,
) -> Decimal:
    """
    Standard market-cap-weighted index formula:
        Level = Sum(adjusted_price × shares_in_index × fx_rate) / divisor
    """
    total_market_cap = sum(c.market_cap for c in constituents)
    return (total_market_cap / divisor).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


def run_reproducibility_test(
    index_code: str,
    calc_date: date,
    tolerance: float,
    bq_project: str,
) -> bool:
    bq_client = bigquery.Client(project=bq_project)

    log.info("Fetching published level …")
    published = fetch_published_level(bq_client, index_code, calc_date)
    log.info("  Published level : %s", published)

    log.info("Fetching constituent snapshot …")
    constituents = fetch_constituents(bq_client, index_code, calc_date)
    log.info("  Constituent count : %d", len(constituents))

    log.info("Fetching divisor …")
    divisor = fetch_divisor(bq_client, index_code, calc_date)
    log.info("  Divisor : %s", divisor)

    log.info("Re-calculating index level …")
    recalculated = calculate_index_level(constituents, divisor)
    log.info("  Re-calculated level : %s", recalculated)

    diff = abs(float(published) - float(recalculated))
    rel_diff = diff / float(published) if float(published) != 0 else diff
    log.info("  Absolute difference : %.10f", diff)
    log.info("  Relative difference : %.4e", rel_diff)

    passed = rel_diff <= tolerance
    if passed:
        log.info("PASS — reproduced within tolerance (%.2e)", tolerance)
    else:
        log.error(
            "FAIL — relative difference %.4e exceeds tolerance %.2e",
            rel_diff, tolerance,
        )
    return passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reproducibility test for published index levels")
    parser.add_argument("--index-code", required=True)
    parser.add_argument("--calc-date",  required=True, type=date.fromisoformat)
    parser.add_argument("--tolerance",  type=float, default=1e-8)
    parser.add_argument("--bq-project", default=None)
    args = parser.parse_args()

    ok = run_reproducibility_test(
        index_code=args.index_code,
        calc_date=args.calc_date,
        tolerance=args.tolerance,
        bq_project=args.bq_project,
    )
    sys.exit(0 if ok else 1)
```

---

## Corporate Action Processing

### Corporate Action Type Reference

| Action Type | Price Impact | Shares Impact | Weight Impact | Divisor Impact |
|---|---|---|---|---|
| **Stock Split (N:1)** | Price ÷ N | Shares × N | Neutral (if adjusted) | None if prices adjusted; otherwise recalculated |
| **Reverse Split (1:N)** | Price × N | Shares ÷ N | Neutral (if adjusted) | None if prices adjusted; otherwise recalculated |
| **Special Cash Dividend** | Price − dividend per share | None | Decreases (market cap falls) | Adjusted to hold index level constant |
| **Spin-Off** | Parent price adjusted for spun-off value | New entity added at ex-date weight | Redistributed | Adjusted to hold level constant |
| **Merger / Removal** | Removed at last price or merger consideration | Set to zero | Redistributed to survivors or cash | Adjusted downward |
| **Rights Issue** | Theoretical ex-rights price (TERP) applied | New shares added at subscription price | Changes with new market cap | Adjusted if dilutive |

> [!important] Divisor Integrity Rule
> The divisor must be adjusted **before** the market opens on the ex-date so that the index level does not jump discontinuously. Divisor changes are logged in `divisor_history` with the effective date, reason, and authorising analyst.

### Python: Price Adjustment Factor Calculations

```python
"""
corporate_actions.py

Price adjustment factor (PAF) and theoretical ex-rights price (TERP)
calculations for all standard corporate action types.

All monetary values in the same currency. Ratios are dimensionless.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from enum import Enum
from typing import Optional


class CorporateActionType(str, Enum):
    STOCK_SPLIT     = "STOCK_SPLIT"
    REVERSE_SPLIT   = "REVERSE_SPLIT"
    SPECIAL_DIVIDEND = "SPECIAL_DIVIDEND"
    SPIN_OFF        = "SPIN_OFF"
    MERGER_REMOVAL  = "MERGER_REMOVAL"
    RIGHTS_ISSUE    = "RIGHTS_ISSUE"


@dataclass(frozen=True)
class StockSplitParams:
    split_ratio_numerator:   int    # new shares issued
    split_ratio_denominator: int    # old shares


@dataclass(frozen=True)
class SpecialDividendParams:
    dividend_per_share: Decimal     # gross dividend in local currency


@dataclass(frozen=True)
class SpinOffParams:
    spun_off_value_per_parent_share: Decimal  # fair value at ex-date


@dataclass(frozen=True)
class RightsIssueParams:
    subscription_price:  Decimal    # price at which new shares are offered
    rights_ratio:        Decimal    # new shares per existing share  e.g. 0.25 = 1 new per 4 old


PRECISION = Decimal("0.00000001")   # 8 decimal places for PAF


def paf_stock_split(pre_ex_price: Decimal, params: StockSplitParams) -> Decimal:
    """
    PAF = denominator / numerator
    Adjusted price = pre_ex_price × PAF
    """
    if params.split_ratio_numerator <= 0 or params.split_ratio_denominator <= 0:
        raise ValueError("Split ratio components must be positive integers")
    paf = Decimal(params.split_ratio_denominator) / Decimal(params.split_ratio_numerator)
    return paf.quantize(PRECISION, rounding=ROUND_HALF_UP)


def paf_reverse_split(pre_ex_price: Decimal, params: StockSplitParams) -> Decimal:
    """
    Reverse split: PAF = numerator / denominator  (price increases)
    """
    if params.split_ratio_numerator <= 0 or params.split_ratio_denominator <= 0:
        raise ValueError("Split ratio components must be positive integers")
    paf = Decimal(params.split_ratio_numerator) / Decimal(params.split_ratio_denominator)
    return paf.quantize(PRECISION, rounding=ROUND_HALF_UP)


def paf_special_dividend(pre_ex_price: Decimal, params: SpecialDividendParams) -> Decimal:
    """
    PAF = (pre_ex_price − dividend_per_share) / pre_ex_price
    Applied to historical prices to remove the dividend distortion.
    """
    if pre_ex_price <= 0:
        raise ValueError("pre_ex_price must be positive")
    if params.dividend_per_share < 0:
        raise ValueError("dividend_per_share must be non-negative")
    if params.dividend_per_share >= pre_ex_price:
        raise ValueError("dividend_per_share must be less than pre_ex_price")
    paf = (pre_ex_price - params.dividend_per_share) / pre_ex_price
    return paf.quantize(PRECISION, rounding=ROUND_HALF_UP)


def paf_spin_off(pre_ex_price: Decimal, params: SpinOffParams) -> Decimal:
    """
    PAF = (pre_ex_price − spun_off_value_per_parent_share) / pre_ex_price
    """
    if pre_ex_price <= 0:
        raise ValueError("pre_ex_price must be positive")
    if params.spun_off_value_per_parent_share < 0:
        raise ValueError("spun_off_value_per_parent_share must be non-negative")
    paf = (pre_ex_price - params.spun_off_value_per_parent_share) / pre_ex_price
    return paf.quantize(PRECISION, rounding=ROUND_HALF_UP)


def terp(pre_ex_price: Decimal, params: RightsIssueParams) -> Decimal:
    """
    Theoretical Ex-Rights Price (TERP):
        TERP = (pre_ex_price + rights_ratio × subscription_price) / (1 + rights_ratio)

    PAF for rights issue = TERP / pre_ex_price
    """
    if pre_ex_price <= 0:
        raise ValueError("pre_ex_price must be positive")
    if params.subscription_price < 0:
        raise ValueError("subscription_price must be non-negative")
    if params.rights_ratio <= 0:
        raise ValueError("rights_ratio must be positive")
    terp_price = (
        pre_ex_price + params.rights_ratio * params.subscription_price
    ) / (Decimal("1") + params.rights_ratio)
    return terp_price.quantize(PRECISION, rounding=ROUND_HALF_UP)


def paf_rights_issue(pre_ex_price: Decimal, params: RightsIssueParams) -> Decimal:
    terp_price = terp(pre_ex_price, params)
    paf = terp_price / pre_ex_price
    return paf.quantize(PRECISION, rounding=ROUND_HALF_UP)


def adjusted_shares_stock_split(current_shares: Decimal, params: StockSplitParams) -> Decimal:
    """Shares after a forward split."""
    return (
        current_shares
        * Decimal(params.split_ratio_numerator)
        / Decimal(params.split_ratio_denominator)
    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def adjusted_shares_rights_issue(current_shares: Decimal, params: RightsIssueParams) -> Decimal:
    """Shares after a rights issue."""
    return (current_shares * (Decimal("1") + params.rights_ratio)).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )


def new_divisor_for_market_cap_change(
    old_divisor: Decimal,
    old_total_market_cap: Decimal,
    new_total_market_cap: Decimal,
) -> Decimal:
    """
    Adjust the index divisor to neutralise a market-cap change caused by a
    corporate action (special dividend, spin-off, merger removal, rights issue).

        new_divisor = old_divisor × (new_total_market_cap / old_total_market_cap)

    The index level is held constant across the divisor change.
    """
    if old_total_market_cap <= 0:
        raise ValueError("old_total_market_cap must be positive")
    ratio = new_total_market_cap / old_total_market_cap
    return (old_divisor * ratio).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
```

### C#: CorporateActionProcessor

```csharp
// CorporateActionProcessor.cs
// Adjusts historical prices and shares in SQL Server for a given
// corporate action. Uses Dapper for all database access.

using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace IndexCalculation.CorporateActions
{
    public enum CorporateActionType
    {
        StockSplit,
        ReverseSplit,
        SpecialDividend,
        SpinOff,
        MergerRemoval,
        RightsIssue
    }

    public record CorporateActionEvent(
        Guid   ActionId,
        string SecurityId,
        string IndexCode,
        CorporateActionType ActionType,
        DateOnly ExDate,
        DateOnly AnnouncementDate,
        decimal PriceAdjustmentFactor,   // PAF to apply to pre-ex prices
        decimal SharesMultiplier,        // multiplier for shares in index
        decimal? OldDivisor,
        decimal? NewDivisor,
        string  AuthorisedBy,
        string  Notes
    );

    public class CorporateActionProcessor
    {
        private readonly string _connectionString;
        private readonly ILogger<CorporateActionProcessor> _logger;

        public CorporateActionProcessor(
            string connectionString,
            ILogger<CorporateActionProcessor> logger)
        {
            _connectionString = connectionString ?? throw new ArgumentNullException(nameof(connectionString));
            _logger           = logger           ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Applies a corporate action to all historical price and share records
        /// for the affected security that pre-date the ex-date. Writes an audit
        /// log row for every record modified.
        /// </summary>
        public async Task<int> ProcessAsync(CorporateActionEvent action)
        {
            _logger.LogInformation(
                "Processing {ActionType} for {SecurityId} in {IndexCode}, ex-date {ExDate}",
                action.ActionType, action.SecurityId, action.IndexCode, action.ExDate);

            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted);

            try
            {
                // 1. Log the corporate action event before touching any data.
                await InsertAuditEventAsync(connection, (SqlTransaction)transaction, action);

                // 2. Adjust historical prices (all records BEFORE the ex-date).
                int priceRowsAffected = await AdjustHistoricalPricesAsync(
                    connection, (SqlTransaction)transaction, action);

                // 3. Adjust shares in index if required.
                int shareRowsAffected = 0;
                if (action.SharesMultiplier != 1m)
                {
                    shareRowsAffected = await AdjustSharesInIndexAsync(
                        connection, (SqlTransaction)transaction, action);
                }

                // 4. Record the new divisor if the action requires one.
                if (action.NewDivisor.HasValue)
                {
                    await RecordDivisorChangeAsync(
                        connection, (SqlTransaction)transaction, action);
                }

                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Action {ActionId} committed: {PriceRows} price rows and {ShareRows} share rows adjusted.",
                    action.ActionId, priceRowsAffected, shareRowsAffected);

                return priceRowsAffected + shareRowsAffected;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing action {ActionId}; rolling back.", action.ActionId);
                await transaction.RollbackAsync();
                throw;
            }
        }

        private static async Task InsertAuditEventAsync(
            IDbConnection conn, IDbTransaction tx, CorporateActionEvent action)
        {
            const string sql = """
                INSERT INTO dbo.corporate_action_audit_log
                    (action_id, security_id, index_code, action_type, ex_date,
                     announcement_date, price_adjustment_factor, shares_multiplier,
                     old_divisor, new_divisor, authorised_by, notes, logged_utc)
                VALUES
                    (@ActionId, @SecurityId, @IndexCode, @ActionType, @ExDate,
                     @AnnouncementDate, @PriceAdjustmentFactor, @SharesMultiplier,
                     @OldDivisor, @NewDivisor, @AuthorisedBy, @Notes, SYSUTCDATETIME())
                """;

            await conn.ExecuteAsync(sql, new
            {
                action.ActionId,
                action.SecurityId,
                action.IndexCode,
                ActionType            = action.ActionType.ToString(),
                ExDate                = action.ExDate.ToDateTime(TimeOnly.MinValue),
                AnnouncementDate      = action.AnnouncementDate.ToDateTime(TimeOnly.MinValue),
                action.PriceAdjustmentFactor,
                action.SharesMultiplier,
                action.OldDivisor,
                action.NewDivisor,
                action.AuthorisedBy,
                action.Notes
            }, transaction: tx);
        }

        private static async Task<int> AdjustHistoricalPricesAsync(
            IDbConnection conn, IDbTransaction tx, CorporateActionEvent action)
        {
            // Prices before the ex-date are multiplied by the PAF.
            // The original value is preserved in adjusted_price_pre_action.
            const string sql = """
                UPDATE dbo.security_prices
                SET
                    adjusted_price_pre_action = close_price,
                    close_price               = close_price * @PAF,
                    action_id                 = @ActionId,
                    modified_utc              = SYSUTCDATETIME()
                WHERE
                    security_id = @SecurityId
                    AND price_date < @ExDate
                    AND action_id IS NULL      -- idempotency guard
                """;

            return await conn.ExecuteAsync(sql, new
            {
                PAF        = action.PriceAdjustmentFactor,
                action.ActionId,
                action.SecurityId,
                ExDate     = action.ExDate.ToDateTime(TimeOnly.MinValue)
            }, transaction: tx);
        }

        private static async Task<int> AdjustSharesInIndexAsync(
            IDbConnection conn, IDbTransaction tx, CorporateActionEvent action)
        {
            const string sql = """
                UPDATE dbo.constituent_shares
                SET
                    shares_pre_action = shares_in_index,
                    shares_in_index   = shares_in_index * @SharesMultiplier,
                    action_id         = @ActionId,
                    modified_utc      = SYSUTCDATETIME()
                WHERE
                    security_id  = @SecurityId
                    AND index_code   = @IndexCode
                    AND effective_date < @ExDate
                    AND action_id IS NULL
                """;

            return await conn.ExecuteAsync(sql, new
            {
                action.SharesMultiplier,
                action.ActionId,
                action.SecurityId,
                action.IndexCode,
                ExDate = action.ExDate.ToDateTime(TimeOnly.MinValue)
            }, transaction: tx);
        }

        private static async Task RecordDivisorChangeAsync(
            IDbConnection conn, IDbTransaction tx, CorporateActionEvent action)
        {
            const string sql = """
                INSERT INTO dbo.divisor_history
                    (index_code, effective_date, old_divisor, new_divisor,
                     reason, action_id, authorised_by, created_utc)
                VALUES
                    (@IndexCode, @EffectiveDate, @OldDivisor, @NewDivisor,
                     @Reason, @ActionId, @AuthorisedBy, SYSUTCDATETIME())
                """;

            await conn.ExecuteAsync(sql, new
            {
                action.IndexCode,
                EffectiveDate = action.ExDate.ToDateTime(TimeOnly.MinValue),
                action.OldDivisor,
                action.NewDivisor,
                Reason        = $"{action.ActionType}: {action.Notes}",
                action.ActionId,
                action.AuthorisedBy
            }, transaction: tx);
        }
    }
}
```

### T-SQL: Divisor Adjustment Stored Procedure

```sql
-- ============================================================
-- usp_AdjustDivisor
--
-- Calculates and records the new divisor required to hold the
-- index level constant across a corporate action that changes
-- the total market capitalisation of the index.
--
-- Formula:
--   New Divisor = Old Divisor × (New Total MCap / Old Total MCap)
--
-- Parameters:
--   @IndexCode        : the index being adjusted
--   @ExDate           : business date on which action takes effect
--   @ActionId         : FK to corporate_action_audit_log
--   @AuthorisedBy     : analyst / system initiating the change
--   @NewDivisor       : OUTPUT — computed new divisor
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.usp_AdjustDivisor
    @IndexCode      NVARCHAR(64),
    @ExDate         DATE,
    @ActionId       UNIQUEIDENTIFIER,
    @AuthorisedBy   NVARCHAR(128),
    @NewDivisor     DECIMAL(28,10) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE
        @OldDivisor         DECIMAL(28,10),
        @OldTotalMCap       DECIMAL(38,10),
        @NewTotalMCap       DECIMAL(38,10),
        @Ratio              DECIMAL(28,10),
        @ActionDescription  NVARCHAR(256);

    -- ----------------------------------------------------------------
    -- 1. Retrieve the current (old) divisor — the most recent entry
    --    effective on or before the ex-date.
    -- ----------------------------------------------------------------
    SELECT TOP 1
        @OldDivisor = new_divisor
    FROM
        dbo.divisor_history
    WHERE
        index_code     = @IndexCode
        AND effective_date <= @ExDate
    ORDER BY
        effective_date DESC, created_utc DESC;

    IF @OldDivisor IS NULL
    BEGIN
        THROW 50001, 'No divisor history found for the specified index and date.', 1;
    END

    -- ----------------------------------------------------------------
    -- 2. Calculate old total market cap (pre-action, pre-ex-date).
    --    Uses the constituent snapshot as it stood BEFORE the action.
    -- ----------------------------------------------------------------
    SELECT
        @OldTotalMCap = SUM(
            cs.shares_pre_action       -- restored original shares
            * sp.adjusted_price_pre_action  -- restored original price
            * fx.fx_rate
        )
    FROM
        dbo.constituent_shares AS cs
        INNER JOIN dbo.security_prices AS sp
            ON sp.security_id = cs.security_id
            AND sp.price_date  = DATEADD(DAY, -1, @ExDate)  -- T-1 price
        INNER JOIN dbo.fx_rates AS fx
            ON fx.security_id  = cs.security_id
            AND fx.rate_date   = DATEADD(DAY, -1, @ExDate)
    WHERE
        cs.index_code      = @IndexCode
        AND cs.action_id   = @ActionId;    -- only rows affected by this action

    -- ----------------------------------------------------------------
    -- 3. Calculate new total market cap (post-action values).
    -- ----------------------------------------------------------------
    SELECT
        @NewTotalMCap = SUM(
            cs.shares_in_index
            * sp.close_price
            * fx.fx_rate
        )
    FROM
        dbo.constituent_shares AS cs
        INNER JOIN dbo.security_prices AS sp
            ON sp.security_id = cs.security_id
            AND sp.price_date  = DATEADD(DAY, -1, @ExDate)
        INNER JOIN dbo.fx_rates AS fx
            ON fx.security_id  = cs.security_id
            AND fx.rate_date   = DATEADD(DAY, -1, @ExDate)
    WHERE
        cs.index_code = @IndexCode;

    IF @OldTotalMCap IS NULL OR @OldTotalMCap = 0
    BEGIN
        THROW 50002, 'Old total market cap is zero or NULL — cannot compute divisor.', 1;
    END

    -- ----------------------------------------------------------------
    -- 4. Compute new divisor and persist.
    -- ----------------------------------------------------------------
    SET @Ratio      = @NewTotalMCap / @OldTotalMCap;
    SET @NewDivisor = @OldDivisor * @Ratio;

    SET @ActionDescription = CONCAT(
        'Divisor adjusted from ', CAST(@OldDivisor AS NVARCHAR(40)),
        ' to ', CAST(@NewDivisor AS NVARCHAR(40)),
        ' (ratio ', CAST(@Ratio AS NVARCHAR(40)), ')'
    );

    INSERT INTO dbo.divisor_history
        (index_code, effective_date, old_divisor, new_divisor,
         reason, action_id, authorised_by, created_utc)
    VALUES
        (@IndexCode, @ExDate, @OldDivisor, @NewDivisor,
         @ActionDescription, @ActionId, @AuthorisedBy, SYSUTCDATETIME());

    -- Return the new divisor via output parameter so the caller can
    -- verify or pass it downstream.
    SELECT @NewDivisor AS new_divisor;
END;
GO
```

### Corporate Action Audit Log Table (T-SQL DDL)

```sql
-- ============================================================
-- Corporate Action Audit Log
-- Append-only. One row per corporate action per security
-- per index. No UPDATE or DELETE is ever performed on this table.
-- ============================================================

CREATE TABLE dbo.corporate_action_audit_log
(
    log_id                  BIGINT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    action_id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),

    -- What was actioned
    security_id             NVARCHAR(32)    NOT NULL,
    index_code              NVARCHAR(64)    NOT NULL,
    action_type             NVARCHAR(32)    NOT NULL,

    -- Key dates
    announcement_date       DATE            NULL,
    ex_date                 DATE            NOT NULL,
    record_date             DATE            NULL,
    payment_date            DATE            NULL,

    -- Adjustment factors applied
    price_adjustment_factor DECIMAL(20, 10) NOT NULL,   -- PAF
    shares_multiplier       DECIMAL(20, 10) NOT NULL DEFAULT 1.0,

    -- Divisor before and after (NULL if action did not change divisor)
    old_divisor             DECIMAL(28, 10) NULL,
    new_divisor             DECIMAL(28, 10) NULL,

    -- Computed impact metrics (for materiality assessment)
    affected_price_rows     INT             NULL,
    affected_share_rows     INT             NULL,
    pre_action_mcap         DECIMAL(38, 10) NULL,
    post_action_mcap        DECIMAL(38, 10) NULL,
    index_level_before      DECIMAL(20, 6)  NULL,
    index_level_after       DECIMAL(20, 6)  NULL,

    -- Source of truth
    vendor_reference        NVARCHAR(256)   NULL,   -- vendor-supplied action ID
    data_source             NVARCHAR(64)    NULL,   -- e.g. REFINITIV, BLOOMBERG
    source_document_url     NVARCHAR(1024)  NULL,   -- link to filing / announcement

    -- Governance
    authorised_by           NVARCHAR(128)   NOT NULL,
    reviewed_by             NVARCHAR(128)   NULL,
    notes                   NVARCHAR(MAX)   NULL,
    is_overridden           BIT             NOT NULL DEFAULT 0,
    override_reason         NVARCHAR(MAX)   NULL,

    -- Audit timestamps
    logged_utc              DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    processed_utc           DATETIME2(3)    NULL,
    reviewed_utc            DATETIME2(3)    NULL,

    CONSTRAINT CK_caal_action_type CHECK (action_type IN (
        'STOCK_SPLIT', 'REVERSE_SPLIT', 'SPECIAL_DIVIDEND',
        'SPIN_OFF', 'MERGER_REMOVAL', 'RIGHTS_ISSUE'
    )),
    CONSTRAINT CK_caal_paf CHECK (price_adjustment_factor > 0),
    CONSTRAINT CK_caal_shares_mult CHECK (shares_multiplier > 0)
);

CREATE UNIQUE INDEX UX_caal_action_security_index
    ON dbo.corporate_action_audit_log (action_id, security_id, index_code);

CREATE INDEX IX_caal_ex_date_index
    ON dbo.corporate_action_audit_log (ex_date, index_code)
    INCLUDE (action_type, price_adjustment_factor, new_divisor);
```

### End-to-End Example: 2:1 Stock Split

The following walkthrough traces a 2:1 stock split (company issues one additional share per existing share) from announcement through to index publication.

**T−5 (Announcement Date)**

The vendor data feed delivers a corporate action notification. The ingestion pipeline writes a row to `corporate_action_audit_log` with `action_type = 'STOCK_SPLIT'`, `ex_date = T`, `shares_multiplier = 2.0`, `price_adjustment_factor = 0.5`.

```python
# At announcement time — pre-computation only, no data modified yet
from decimal import Decimal
from corporate_actions import StockSplitParams, paf_stock_split, adjusted_shares_stock_split

params = StockSplitParams(split_ratio_numerator=2, split_ratio_denominator=1)

pre_ex_price     = Decimal("100.00")
current_shares   = Decimal("1_000_000")

paf    = paf_stock_split(pre_ex_price, params)          # → 0.50000000
shares = adjusted_shares_stock_split(current_shares, params)  # → 2,000,000

print(f"PAF              : {paf}")        # 0.50000000
print(f"Post-split shares: {shares:,}")  # 2,000,000
# Market cap check: 100 × 1,000,000 = 50 × 2,000,000 = 100,000,000 ✓
```

**T−1 (Eve of Ex-Date) — Divisor Verification**

Because the 2:1 split is a pure price/share adjustment (market cap unchanged), the divisor does not change. The index team verifies this is correctly flagged in the audit log (`old_divisor IS NULL`, `new_divisor IS NULL`).

**T (Ex-Date) — Historical Price Adjustment**

```python
# Simplified call — the CorporateActionProcessor handles the database writes
import asyncio
from datetime import date
from uuid import uuid4
from corporate_actions import CorporateActionType, CorporateActionEvent

action = CorporateActionEvent(
    ActionId                = uuid4(),
    SecurityId              = "SEC_000001",
    IndexCode               = "EQUITY_LARGE_CAP_USD",
    ActionType              = CorporateActionType.STOCK_SPLIT,
    ExDate                  = date(2026, 3, 20),
    AnnouncementDate        = date(2026, 3, 15),
    PriceAdjustmentFactor   = Decimal("0.5"),
    SharesMultiplier        = Decimal("2.0"),
    OldDivisor              = None,   # no divisor change for pure split
    NewDivisor              = None,
    AuthorisedBy            = "index.operations@example.com",
    Notes                   = "2:1 stock split per board resolution dated 2026-03-10"
)

# processor = CorporateActionProcessor(connection_string, logger)
# asyncio.run(processor.ProcessAsync(action))
```

**T (Ex-Date) — Calculation Engine Run**

The nightly calculation runs with the adjusted prices and the doubled share count. Total market cap is identical to T−1. The published index level shows no discontinuity.

**T+1 — Lineage Verification**

The reproducibility test is executed. The `pipeline_lineage_metadata` row for the ex-date run references the `action_id`. An auditor can join through `corporate_action_audit_log` to retrieve the original announcement document URL, the authorising analyst, and the precise PAF applied.

---

## EU BMR Compliance

> [!warning] EU BMR regulatory requirement
>
> The European Benchmarks Regulation (EU 2016/1011) applies to administrators of benchmarks used in financial instruments, financial contracts, or investment funds within the EU. Non-compliance can result in withdrawal of the index from use in new EU financial instruments. This section summarises operational obligations; it is not legal advice. Always consult your compliance and legal teams. For a detailed breakdown of the regulation's scope and applicability, see [[eu-bmr-benchmark-regulation]].

### EU BMR Compliance — Article 11 Input Data Governance

> [!important] Article 11(1) sufficiency
>
> Input data must be sufficient and representative of the economic reality the benchmark is intended to measure. The administrator must document the criteria for selecting input data and the hierarchy of data sources.

Operational controls required:

| Control | Implementation |
|---|---|
| Primary data source documented | Methodology document (version-controlled in Git) |
| Fallback hierarchy defined | `data_source_hierarchy` table with priority ranking |
| Actual source recorded per calculation | `pipeline_lineage_metadata.vendor` column |
| Staleness check | Pipeline rejects prices older than N business days |
| Outlier detection | Z-score and IQR checks in the Silver transform stage |
| Missing data threshold | Calculation aborts if > X% of constituents lack prices |

> [!important] Article 11(3) input data waterfall
>
> If transaction data is not available, the administrator must apply a pre-defined hierarchy: observed transaction data → firm quotes → committed quotes → indicative quotes → modelled prices. Each level must be documented and the level actually used recorded per security per date.

```sql
-- Record the data tier used for each security on each calculation date.
CREATE TABLE dbo.input_data_tier_log
(
    log_id          BIGINT  NOT NULL IDENTITY(1,1) PRIMARY KEY,
    calc_date       DATE    NOT NULL,
    index_code      NVARCHAR(64)    NOT NULL,
    security_id     NVARCHAR(32)    NOT NULL,
    data_tier       TINYINT NOT NULL,  -- 1=transaction, 2=firm quote, 3=committed, 4=indicative, 5=modelled
    data_source     NVARCHAR(64)    NOT NULL,
    price_used      DECIMAL(20,6)   NOT NULL,
    logged_utc      DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_idtl_tier CHECK (data_tier BETWEEN 1 AND 5)
);

CREATE INDEX IX_idtl_calc_date ON dbo.input_data_tier_log (calc_date, index_code);
```

### EU BMR Compliance — Article 21 Record Retention

> [!warning] Five-year minimum retention
>
> Article 21 requires administrators to retain records for at least five years. Records must include: all input data, the methodology and its basis, all calculations and their results, subscriber identity, and any identified significant changes to the benchmark.

Retention implementation:

```python
"""
retention_policy.py

Enforces 5-year minimum retention on GCS, SQL Server, and BigQuery.
Run as a scheduled job; it only EXTENDS retention, never shortens it.
"""

from datetime import date, timedelta
from google.cloud import storage

MINIMUM_RETENTION_DAYS = 5 * 365 + 2   # 5 years + 2 leap-year days

def enforce_gcs_retention(bucket_name: str) -> None:
    """
    Set the GCS bucket retention policy to at least MINIMUM_RETENTION_DAYS.
    Will not reduce an existing longer retention period.
    """
    client  = storage.Client()
    bucket  = client.get_bucket(bucket_name)
    policy  = bucket.retention_policy

    current_days = (policy.retention_period or 0) // 86_400

    if current_days < MINIMUM_RETENTION_DAYS:
        bucket.retention_policy_effective_time  # noqa: ensure policy loaded
        bucket.retention_period = MINIMUM_RETENTION_DAYS * 86_400
        bucket.patch()
        print(f"Updated {bucket_name} retention: {current_days}d → {MINIMUM_RETENTION_DAYS}d")
    else:
        print(f"{bucket_name} retention {current_days}d already meets requirement.")
```

```sql
-- BigQuery dataset-level retention (run via bq CLI or Terraform):
-- bq update --default_table_expiration=0 <project>:<dataset>
-- Expiration is managed at table level via a policy tag; audit tables never expire.

-- SQL Server: ensure no automated purge job targets audit tables.
-- Verify via:
SELECT
    j.name          AS job_name,
    s.step_name,
    s.command
FROM
    msdb.dbo.sysjobs     AS j
    INNER JOIN msdb.dbo.sysjobsteps AS s ON s.job_id = j.job_id
WHERE
    s.command LIKE '%DELETE%'
    OR s.command LIKE '%TRUNCATE%'
ORDER BY
    j.name, s.step_id;
```

### EU BMR Compliance — Oversight Function

> [!important] BMR Article 5 oversight function
>
> The administrator must establish and maintain a permanent and effective oversight function. The oversight function must oversee all aspects of the benchmark provision and, in particular, any outsourced functions.

Minimum oversight controls:

- Independent validation team runs the shadow calculation daily and reconciles against the production level.
- Oversight committee reviews methodology changes and approves deviations above the materiality threshold.
- Outsourced data vendors are subject to annual due diligence reviews documented in the vendor management register.
- Oversight committee minutes are retained for 5 years minimum.

```sql
-- Oversight sign-off table: daily attestation by the oversight function.
CREATE TABLE dbo.oversight_signoff
(
    signoff_id      BIGINT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    calc_date       DATE            NOT NULL,
    index_code      NVARCHAR(64)    NOT NULL,
    shadow_level    DECIMAL(20,6)   NOT NULL,
    production_level DECIMAL(20,6)  NOT NULL,
    abs_diff        AS ABS(production_level - shadow_level) PERSISTED,
    rel_diff_bps    AS ABS(production_level - shadow_level) / NULLIF(production_level, 0) * 10000 PERSISTED,
    within_threshold BIT            NOT NULL,
    signed_off_by   NVARCHAR(128)   NOT NULL,
    signed_off_utc  DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    comments        NVARCHAR(MAX)   NULL,
    CONSTRAINT UX_os_date_index UNIQUE (calc_date, index_code)
);
```

### EU BMR Compliance — Complaint Handling

> [!important] BMR Article 14 complaints
>
> The administrator must have a written complaints procedure allowing benchmark users to submit complaints about whether a benchmark is representative, the methodology, proposed changes, and their application in specific cases. Complaints and the administrator's responses must be retained.

```sql
CREATE TABLE dbo.bmr_complaints
(
    complaint_id        BIGINT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    complaint_ref       NVARCHAR(32)    NOT NULL UNIQUE,   -- e.g. COMP-2026-0001
    received_date       DATE            NOT NULL,
    complainant_type    NVARCHAR(32)    NOT NULL,           -- SUBSCRIBER | ISSUER | OTHER
    index_code          NVARCHAR(64)    NULL,
    complaint_category  NVARCHAR(64)    NOT NULL,           -- METHODOLOGY | REPRESENTATIVENESS | CHANGE | APPLICATION
    description         NVARCHAR(MAX)   NOT NULL,
    assigned_to         NVARCHAR(128)   NULL,
    status              NVARCHAR(16)    NOT NULL DEFAULT 'OPEN',  -- OPEN | UNDER_REVIEW | RESOLVED | ESCALATED
    resolution_date     DATE            NULL,
    resolution_summary  NVARCHAR(MAX)   NULL,
    escalated_to_regulator BIT          NOT NULL DEFAULT 0,
    created_utc         DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_utc         DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_complaints_status CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','ESCALATED'))
);
```

### EU BMR Compliance — Annual Review Checklist

> [!note] Annual methodology review
>
> BMR Article 11(1)(e) requires the administrator to review the methodology at least once a year and document the review outcome.

**Annual Compliance Review — Index Calculation Platform**

- [ ] Methodology document reviewed and version-bumped (Git tag `methodology-vYYYY`)
- [ ] Input data representativeness assessed against economic reality test
- [ ] Data source hierarchy validated and signed off by oversight function
- [ ] Vendor due diligence completed for all input data providers
- [ ] Record retention policy verified — GCS, SQL Server, BigQuery all ≥ 5 years
- [ ] Complaint register reviewed; all open complaints resolved or escalated
- [ ] Shadow calculation reconciliation statistics reviewed (P99 divergence vs threshold)
- [ ] Corporate action log reviewed for completeness and authorisation compliance
- [ ] Divisor history table reviewed — no unexplained changes
- [ ] Oversight committee composition reviewed — independence confirmed
- [ ] Staff training records updated for all index operations personnel
- [ ] Business continuity plan tested — failover calculation environment exercised
- [ ] Code of conduct attestations collected from all relevant staff
- [ ] Outsourced function oversight reports reviewed and filed
- [ ] Regulatory disclosures published (benchmark statement, methodology document)
- [ ] ESMA register entry verified as current

---

## Restatement Procedures

### Restatement Decision Framework

When an error is discovered in a published index level, the following process governs the response. The data restatement procedure provides the operational runbook that implements the framework below, including subscriber notification templates and approval workflows.

```
Error Discovered
      │
      ▼
Root Cause Analysis
  ├─ Data error (wrong price, missing constituent, bad FX rate)
  ├─ Corporate action applied incorrectly
  ├─ Divisor error
  └─ Calculation engine bug
      │
      ▼
Materiality Assessment
  ├─ < 0.01%  → Minor; note in oversight log; no restatement required
  ├─ 0.01%–0.10% → Moderate; notify affected subscribers; optional restatement
  └─ > 0.10%  → Material; mandatory restatement; regulatory notification may apply
      │
      ▼
Calculate Corrected Values
  (re-run calculation engine with corrected inputs)
      │
      ▼
Internal Approval
  (oversight function sign-off)
      │
      ▼
Notify Subscribers
  (within 1 business day of approval)
      │
      ▼
Publish Restatement
  (append-only restatement record; original record marked superseded)
      │
      ▼
Update Audit Trail
  (link restatement to root cause, corrected run_id, original run_id)
```

### Materiality Threshold Configuration

```python
# restatement_config.py

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class MaterialityThresholds:
    minor_bps:    Decimal = Decimal("1")    # < 1 bps  → no restatement
    moderate_bps: Decimal = Decimal("10")   # 1–10 bps → discretionary
    material_bps: Decimal = Decimal("10")   # > 10 bps → mandatory


def classify_error(
    published_level: Decimal,
    corrected_level: Decimal,
    thresholds: MaterialityThresholds = MaterialityThresholds(),
) -> str:
    """
    Returns 'MINOR', 'MODERATE', or 'MATERIAL'.
    """
    if published_level == 0:
        raise ValueError("published_level must not be zero")

    diff_bps = abs(published_level - corrected_level) / published_level * Decimal("10000")

    if diff_bps < thresholds.minor_bps:
        return "MINOR"
    elif diff_bps < thresholds.material_bps:
        return "MODERATE"
    else:
        return "MATERIAL"
```

### T-SQL: Restatement Workflow

```sql
-- ============================================================
-- usp_PublishRestatement
--
-- Marks the original index level record as superseded and inserts
-- the corrected value. Fully append-only; the original data row
-- is never deleted.
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.usp_PublishRestatement
    @IndexCode          NVARCHAR(64),
    @CalcDate           DATE,
    @CorrectedLevel     DECIMAL(20,6),
    @CorrectedRunId     UNIQUEIDENTIFIER,   -- run_id of the re-calculation
    @RootCause          NVARCHAR(MAX),
    @MaterialityClass   NVARCHAR(16),       -- MINOR | MODERATE | MATERIAL
    @AuthorisedBy       NVARCHAR(128),
    @RestatementId      UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OriginalRunId UNIQUEIDENTIFIER;
    DECLARE @PublishedLevel DECIMAL(20,6);

    BEGIN TRANSACTION;

    -- 1. Fetch the current official record.
    SELECT
        @OriginalRunId  = run_id,
        @PublishedLevel = index_level
    FROM
        dbo.index_levels
    WHERE
        index_code  = @IndexCode
        AND calc_date   = @CalcDate
        AND is_official = 1
        AND is_superseded = 0;

    IF @OriginalRunId IS NULL
    BEGIN
        ROLLBACK;
        THROW 50010, 'No official non-superseded level found for the specified index and date.', 1;
    END

    -- 2. Mark the original as superseded (never delete).
    UPDATE dbo.index_levels
    SET
        is_superseded      = 1,
        superseded_utc     = SYSUTCDATETIME(),
        superseded_by_run  = @CorrectedRunId
    WHERE
        index_code  = @IndexCode
        AND calc_date   = @CalcDate
        AND run_id      = @OriginalRunId;

    -- 3. Insert the corrected level as the new official record.
    INSERT INTO dbo.index_levels
        (run_id, index_code, calc_date, index_level, is_official,
         is_restatement, original_run_id, restatement_reason,
         materiality_class, authorised_by, published_utc)
    VALUES
        (@CorrectedRunId, @IndexCode, @CalcDate, @CorrectedLevel, 1,
         1, @OriginalRunId, @RootCause,
         @MaterialityClass, @AuthorisedBy, SYSUTCDATETIME());

    -- 4. Write a restatement audit record.
    SET @RestatementId = NEWID();

    INSERT INTO dbo.restatement_log
        (restatement_id, index_code, calc_date,
         original_run_id, corrected_run_id,
         published_level, corrected_level,
         abs_diff, rel_diff_bps,
         root_cause, materiality_class,
         authorised_by, created_utc)
    VALUES
        (@RestatementId, @IndexCode, @CalcDate,
         @OriginalRunId, @CorrectedRunId,
         @PublishedLevel, @CorrectedLevel,
         ABS(@PublishedLevel - @CorrectedLevel),
         ABS(@PublishedLevel - @CorrectedLevel) / NULLIF(@PublishedLevel, 0) * 10000,
         @RootCause, @MaterialityClass,
         @AuthorisedBy, SYSUTCDATETIME());

    COMMIT;

    SELECT @RestatementId AS restatement_id;
END;
GO


-- ============================================================
-- Restatement Log DDL
-- ============================================================

CREATE TABLE dbo.restatement_log
(
    log_id              BIGINT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    restatement_id      UNIQUEIDENTIFIER NOT NULL UNIQUE,
    index_code          NVARCHAR(64)    NOT NULL,
    calc_date           DATE            NOT NULL,
    original_run_id     UNIQUEIDENTIFIER NOT NULL,
    corrected_run_id    UNIQUEIDENTIFIER NOT NULL,
    published_level     DECIMAL(20,6)   NOT NULL,
    corrected_level     DECIMAL(20,6)   NOT NULL,
    abs_diff            DECIMAL(20,6)   NOT NULL,
    rel_diff_bps        DECIMAL(10,4)   NOT NULL,
    root_cause          NVARCHAR(MAX)   NOT NULL,
    materiality_class   NVARCHAR(16)    NOT NULL,
    subscriber_notified BIT             NOT NULL DEFAULT 0,
    notified_utc        DATETIME2(3)    NULL,
    regulatory_notified BIT             NOT NULL DEFAULT 0,
    regulatory_notif_utc DATETIME2(3)  NULL,
    authorised_by       NVARCHAR(128)   NOT NULL,
    created_utc         DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_rl_materiality CHECK (materiality_class IN ('MINOR','MODERATE','MATERIAL'))
);
```

### Python: Restatement Workflow Orchestrator

```python
"""
restatement_workflow.py

Orchestrates the full restatement process for a material error in a
published index level: re-calculates, validates, persists, and
triggers subscriber notifications.
"""

import logging
import smtplib
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from email.mime.text import MIMEText
from typing import List, Optional

import pyodbc
import sqlalchemy as sa

from reproducibility_test import (
    PipelineContext,
    fetch_constituents,
    fetch_divisor,
    calculate_index_level,
)

log = logging.getLogger(__name__)


@dataclass
class RestatementResult:
    restatement_id:    str
    index_code:        str
    calc_date:         date
    published_level:   Decimal
    corrected_level:   Decimal
    abs_diff:          Decimal
    rel_diff_bps:      Decimal
    materiality_class: str


def run_restatement(
    index_code:       str,
    calc_date:        date,
    root_cause:       str,
    authorised_by:    str,
    sql_conn_str:     str,
    bq_project:       str,
    smtp_host:        str,
    subscriber_emails: List[str],
    materiality_thresholds_bps: dict = None,
) -> RestatementResult:
    """
    Full restatement workflow. Raises on any failure so the caller
    can decide whether to retry or escalate.
    """
    thresholds = materiality_thresholds_bps or {"minor": 1, "material": 10}

    # ----------------------------------------------------------------
    # Step 1: Re-run calculation with current (corrected) inputs.
    # ----------------------------------------------------------------
    from google.cloud import bigquery
    bq_client = bigquery.Client(project=bq_project)

    log.info("Fetching corrected constituents …")
    constituents = fetch_constituents(bq_client, index_code, calc_date)
    divisor      = fetch_divisor(bq_client, index_code, calc_date)
    corrected    = calculate_index_level(constituents, divisor)
    log.info("Corrected level: %s", corrected)

    # ----------------------------------------------------------------
    # Step 2: Fetch the published (erroneous) level.
    # ----------------------------------------------------------------
    engine = sa.create_engine(f"mssql+pyodbc:///?odbc_connect={sql_conn_str}")
    with engine.begin() as conn:
        row = conn.execute(
            sa.text("""
                SELECT index_level, run_id
                FROM dbo.index_levels
                WHERE index_code    = :ic
                  AND calc_date     = :cd
                  AND is_official   = 1
                  AND is_superseded = 0
            """),
            {"ic": index_code, "cd": calc_date},
        ).fetchone()

    if row is None:
        raise ValueError(f"No official level found for {index_code} {calc_date}")

    published = Decimal(str(row.index_level))
    log.info("Published level: %s", published)

    # ----------------------------------------------------------------
    # Step 3: Materiality classification.
    # ----------------------------------------------------------------
    abs_diff     = abs(published - corrected)
    rel_diff_bps = abs_diff / published * Decimal("10000")
    log.info("Difference: %s bps", rel_diff_bps)

    if rel_diff_bps < thresholds["minor"]:
        materiality = "MINOR"
    elif rel_diff_bps < thresholds["material"]:
        materiality = "MODERATE"
    else:
        materiality = "MATERIAL"

    log.info("Materiality: %s", materiality)

    # ----------------------------------------------------------------
    # Step 4: Persist the restatement via the stored procedure.
    # ----------------------------------------------------------------
    corrected_run_id = uuid.uuid4()

    with engine.begin() as conn:
        result = conn.execute(
            sa.text("""
                DECLARE @rid UNIQUEIDENTIFIER;
                EXEC dbo.usp_PublishRestatement
                    @IndexCode        = :ic,
                    @CalcDate         = :cd,
                    @CorrectedLevel   = :cl,
                    @CorrectedRunId   = :crid,
                    @RootCause        = :rc,
                    @MaterialityClass = :mc,
                    @AuthorisedBy     = :ab,
                    @RestatementId    = @rid OUTPUT;
                SELECT @rid AS restatement_id;
            """),
            {
                "ic":   index_code,
                "cd":   calc_date,
                "cl":   float(corrected),
                "crid": str(corrected_run_id),
                "rc":   root_cause,
                "mc":   materiality,
                "ab":   authorised_by,
            },
        ).fetchone()

    restatement_id = str(result.restatement_id)
    log.info("Restatement persisted: %s", restatement_id)

    # ----------------------------------------------------------------
    # Step 5: Notify subscribers (if moderate or material).
    # ----------------------------------------------------------------
    if materiality in ("MODERATE", "MATERIAL") and subscriber_emails:
        _notify_subscribers(
            smtp_host      = smtp_host,
            recipients     = subscriber_emails,
            index_code     = index_code,
            calc_date      = calc_date,
            published      = published,
            corrected      = corrected,
            rel_diff_bps   = rel_diff_bps,
            materiality    = materiality,
            restatement_id = restatement_id,
            root_cause     = root_cause,
        )

    return RestatementResult(
        restatement_id    = restatement_id,
        index_code        = index_code,
        calc_date         = calc_date,
        published_level   = published,
        corrected_level   = corrected,
        abs_diff          = abs_diff,
        rel_diff_bps      = rel_diff_bps,
        materiality_class = materiality,
    )


def _notify_subscribers(
    smtp_host:      str,
    recipients:     List[str],
    index_code:     str,
    calc_date:      date,
    published:      Decimal,
    corrected:      Decimal,
    rel_diff_bps:   Decimal,
    materiality:    str,
    restatement_id: str,
    root_cause:     str,
) -> None:
    body = (
        f"RESTATEMENT NOTICE\n"
        f"{'='*60}\n\n"
        f"Index         : {index_code}\n"
        f"Calculation Date : {calc_date.isoformat()}\n"
        f"Restatement ID   : {restatement_id}\n"
        f"Materiality      : {materiality}\n\n"
        f"Published Level  : {published:.6f}\n"
        f"Corrected Level  : {corrected:.6f}\n"
        f"Difference (bps) : {rel_diff_bps:.4f}\n\n"
        f"Root Cause:\n{root_cause}\n\n"
        f"This notice is sent in accordance with our restatement policy.\n"
        f"Please update any systems consuming this index level accordingly.\n"
    )
    msg = MIMEText(body)
    msg["Subject"] = f"[{materiality}] Restatement: {index_code} {calc_date.isoformat()}"
    msg["From"]    = "index-operations@example.com"
    msg["To"]      = ", ".join(recipients)

    with smtplib.SMTP(smtp_host) as server:
        server.sendmail(msg["From"], recipients, msg.as_string())

    log.info("Subscriber notification sent to %d recipients.", len(recipients))
```

---

## Datadog Integration for Compliance Monitoring

### Compliance Monitoring — Custom Metrics in Datadog

All metrics are emitted as `GAUGE` or `COUNT` with mandatory tags `index_code`, `calc_date`, `env`, and `run_id`. This ensures every metric can be correlated back to the specific pipeline run that produced it.

```python
"""
dd_metrics.py

Datadog custom metric emission for index calculation compliance monitoring.
Uses the DogStatsD client for low-latency, high-throughput metric emission.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import List

from datadog import initialize, statsd
from datadog.api import Metric


def init_datadog(api_key: str, app_key: str, statsd_host: str = "localhost", statsd_port: int = 8125) -> None:
    initialize(api_key=api_key, app_key=app_key, statsd_host=statsd_host, statsd_port=statsd_port)


@dataclass
class IndexCalculationMetrics:
    index_code:         str
    calc_date:          str     # ISO format YYYY-MM-DD
    run_id:             str
    env:                str

    # Calculation outputs
    index_level:        float
    shadow_level:       float
    constituent_count:  int
    weight_sum:         float   # should be ~1.0 for a capped weight-normalised index

    # Pipeline timing
    calc_duration_ms:   float

    def _base_tags(self) -> List[str]:
        return [
            f"index_code:{self.index_code}",
            f"calc_date:{self.calc_date}",
            f"run_id:{self.run_id}",
            f"env:{self.env}",
        ]

    def emit_all(self) -> None:
        tags = self._base_tags()

        # Core calculation metrics
        statsd.gauge("index.calc.level",             self.index_level,        tags=tags)
        statsd.gauge("index.calc.shadow_level",      self.shadow_level,       tags=tags)
        statsd.gauge("index.calc.constituent_count", self.constituent_count,  tags=tags)
        statsd.gauge("index.calc.weight_sum",        self.weight_sum,         tags=tags)
        statsd.gauge("index.calc.duration_ms",       self.calc_duration_ms,   tags=tags)

        # Derived compliance metric: shadow divergence in basis points
        if self.shadow_level != 0:
            divergence_bps = abs(self.index_level - self.shadow_level) / self.shadow_level * 10_000
        else:
            divergence_bps = 0.0
        statsd.gauge("index.calc.shadow_divergence_bps", divergence_bps, tags=tags)

        # Boolean flag: 1 if weight_sum is within tolerance of 1.0
        weight_sum_ok = 1 if abs(self.weight_sum - 1.0) < 0.001 else 0
        statsd.gauge("index.calc.weight_sum_valid", weight_sum_ok, tags=tags)


def emit_corporate_action_processed(
    index_code:   str,
    action_type:  str,
    security_id:  str,
    env:          str,
) -> None:
    statsd.increment(
        "index.corporate_action.processed",
        tags=[
            f"index_code:{index_code}",
            f"action_type:{action_type}",
            f"security_id:{security_id}",
            f"env:{env}",
        ],
    )


def emit_restatement_published(
    index_code:        str,
    materiality_class: str,
    env:               str,
) -> None:
    statsd.increment(
        "index.restatement.published",
        tags=[
            f"index_code:{index_code}",
            f"materiality:{materiality_class}",
            f"env:{env}",
        ],
    )


def emit_pipeline_stage_complete(
    stage:   str,
    run_id:  str,
    env:     str,
    success: bool,
) -> None:
    statsd.increment(
        "index.pipeline.stage_complete",
        tags=[
            f"stage:{stage}",
            f"run_id:{run_id}",
            f"env:{env}",
            f"success:{str(success).lower()}",
        ],
    )
```

### Datadog Monitor: Shadow Divergence Alert

```python
"""
dd_monitors.py

Creates Datadog monitors for index calculation compliance.
Run once during environment bootstrap or via CI/CD on change.
"""

from datadog import initialize, api


SHADOW_DIVERGENCE_MONITOR = {
    "name": "Index Calc — Shadow Divergence Exceeds 0.01%",
    "type": "metric alert",
    "query": (
        "avg(last_5m):avg:index.calc.shadow_divergence_bps{env:production} by {index_code} > 1"
    ),
    # 1 basis point = 0.01%
    "message": (
        "{{#is_alert}}\n"
        "**COMPLIANCE ALERT**: The published index level for {{index_code.name}} "
        "diverges from the shadow calculation by more than 0.01% (1 basis point).\n\n"
        "Published level: {{index.calc.level}}\n"
        "Shadow level:    {{index.calc.shadow_level}}\n"
        "Divergence:      {{value}} bps\n\n"
        "Immediate investigation required. Notify index operations on-call.\n"
        "@pagerduty-index-operations @slack-index-alerts\n"
        "{{/is_alert}}\n\n"
        "{{#is_recovery}}\n"
        "Shadow divergence for {{index_code.name}} has returned within tolerance.\n"
        "{{/is_recovery}}"
    ),
    "tags": ["compliance", "index-calculation", "shadow-calc", "bmr"],
    "options": {
        "thresholds":             {"critical": 1.0, "warning": 0.5},
        "notify_no_data":         True,
        "no_data_timeframe":      30,    # alert if no data for 30 minutes
        "renotify_interval":      60,
        "escalation_message":     "Shadow divergence still exceeds 0.01% after 60 minutes — escalate to oversight function.",
        "evaluation_delay":       0,
        "require_full_window":    False,
        "include_tags":           True,
        "new_host_delay":         0,
    },
}


CONSTITUENT_COUNT_MONITOR = {
    "name": "Index Calc — Constituent Count Anomaly",
    "type": "metric alert",
    "query": (
        "change(avg(last_5m),last_1d):avg:index.calc.constituent_count"
        "{env:production} by {index_code} > 5"
    ),
    "message": (
        "{{#is_alert}}\n"
        "**ANOMALY**: The constituent count for {{index_code.name}} has changed "
        "by more than 5 since yesterday.\n\n"
        "This may indicate an unexpected corporate action, data error, or "
        "index rebalance without corresponding announcement.\n\n"
        "Verify corporate action audit log and pipeline lineage metadata.\n"
        "@slack-index-alerts\n"
        "{{/is_alert}}"
    ),
    "tags": ["compliance", "index-calculation", "constituent-count"],
    "options": {
        "thresholds":      {"critical": 5.0, "warning": 3.0},
        "notify_no_data":  True,
        "no_data_timeframe": 60,
        "include_tags":    True,
    },
}


WEIGHT_SUM_MONITOR = {
    "name": "Index Calc — Weight Sum Not Equal to 1.0",
    "type": "metric alert",
    "query": (
        "avg(last_5m):avg:index.calc.weight_sum{env:production} by {index_code} > 1.001"
    ),
    "message": (
        "{{#is_alert}}\n"
        "**DATA QUALITY**: Weight sum for {{index_code.name}} = {{value}} "
        "(expected 1.000 ± 0.001).\n\n"
        "Check the weight normalisation step in the Gold transform.\n"
        "@slack-index-alerts\n"
        "{{/is_alert}}"
    ),
    "tags": ["compliance", "index-calculation", "weight-sum", "data-quality"],
    "options": {
        "thresholds":      {"critical": 1.001, "warning": 1.0005},
        "include_tags":    True,
        "notify_no_data":  True,
        "no_data_timeframe": 60,
    },
}


def create_all_monitors(api_key: str, app_key: str) -> None:
    initialize(api_key=api_key, app_key=app_key)
    for monitor_def in [
        SHADOW_DIVERGENCE_MONITOR,
        CONSTITUENT_COUNT_MONITOR,
        WEIGHT_SUM_MONITOR,
    ]:
        result = api.Monitor.create(**monitor_def)
        print(f"Created monitor id={result['id']} name={result['name']}")
```

### Datadog Dashboard Design

The compliance dashboard is structured in four horizontal bands, each corresponding to a phase of the daily calculation workflow.

**Band 1 — Pipeline Execution Timeline**

A `TopList` widget showing the last execution time and status for each index code, colour-coded by `pipeline_status`. Below it, a `Timeseries` widget showing `index.calc.duration_ms` per stage (ingestion, bronze, silver, gold, bq_export) stacked by stage. This band answers: "Did all pipelines complete, and how long did each stage take?"

**Band 2 — Calculation Output Quality**

- `Timeseries`: `index.calc.level` vs `index.calc.shadow_level` overlaid on a single axis, one graph per index code. The two lines should be indistinguishable at 6 decimal places.
- `Timeseries`: `index.calc.shadow_divergence_bps`. Reference lines at 0.5 bps (warning) and 1 bps (critical).
- `Timeseries`: `index.calc.constituent_count`. Day-over-day change annotated with corporate action events.

**Band 3 — Data Quality Metrics**

- `Query Value`: `index.calc.weight_sum` — should display as 1.000.
- `TopList`: Securities with the highest data tier used (tier 4 or 5 = modelled prices). These require heightened scrutiny under BMR Article 11.
- `Timeseries`: Count of rejected rows per pipeline stage per day.

**Band 4 — Compliance Events**

- `Event Stream` widget filtered on tags `compliance` and `index-calculation` showing corporate action processing events, restatement notices, and oversight sign-off confirmations.
- `Timeseries`: `index.restatement.published` count by `materiality` tag.
- `Timeseries`: `index.corporate_action.processed` count by `action_type` tag.

```python
"""
dd_dashboard.py

Programmatically creates the compliance dashboard.
Simplified — full widget JSON would be expanded per production requirements.
"""

from datadog import initialize, api


def create_compliance_dashboard(api_key: str, app_key: str) -> str:
    initialize(api_key=api_key, app_key=app_key)

    dashboard = api.Dashboard.create(
        title="Index Calculation — Compliance & Auditability",
        description=(
            "Production compliance dashboard: pipeline execution timeline, "
            "shadow calculation divergence, data quality, and audit events."
        ),
        layout_type="ordered",
        is_read_only=False,
        notify_list=["@slack-index-alerts"],
        template_variables=[
            {"name": "env",        "prefix": "env",        "default": "production"},
            {"name": "index_code", "prefix": "index_code", "default": "*"},
        ],
        widgets=[
            # ── Band 1: Pipeline Execution ──────────────────────────
            {
                "definition": {
                    "type":    "timeseries",
                    "title":   "Pipeline Stage Duration (ms)",
                    "requests": [{
                        "q":           "avg:index.calc.duration_ms{$env,$index_code} by {stage}",
                        "display_type": "bars",
                        "style":       {"palette": "cool"},
                    }],
                    "yaxis": {"min": "0"},
                }
            },
            # ── Band 2: Shadow Divergence ────────────────────────────
            {
                "definition": {
                    "type":  "timeseries",
                    "title": "Shadow Divergence (bps) — Alert at 1 bps",
                    "requests": [{
                        "q":            "avg:index.calc.shadow_divergence_bps{$env,$index_code} by {index_code}",
                        "display_type": "line",
                        "style":        {"line_width": "normal", "palette": "warm"},
                    }],
                    "markers": [
                        {"value": "y = 1",   "display_type": "error dashed",   "label": "Critical (1 bps)"},
                        {"value": "y = 0.5", "display_type": "warning dashed", "label": "Warning (0.5 bps)"},
                    ],
                }
            },
            # ── Band 2: Index Level vs Shadow ────────────────────────
            {
                "definition": {
                    "type":  "timeseries",
                    "title": "Published Level vs Shadow Level",
                    "requests": [
                        {
                            "q":            "avg:index.calc.level{$env,$index_code} by {index_code}",
                            "display_type": "line",
                            "style":        {"palette": "purple"},
                        },
                        {
                            "q":            "avg:index.calc.shadow_level{$env,$index_code} by {index_code}",
                            "display_type": "line",
                            "style":        {"palette": "orange", "line_type": "dashed"},
                        },
                    ],
                }
            },
            # ── Band 3: Constituent Count ────────────────────────────
            {
                "definition": {
                    "type":  "timeseries",
                    "title": "Constituent Count",
                    "requests": [{
                        "q":            "avg:index.calc.constituent_count{$env,$index_code} by {index_code}",
                        "display_type": "line",
                    }],
                }
            },
            # ── Band 3: Weight Sum ───────────────────────────────────
            {
                "definition": {
                    "type":  "query_value",
                    "title": "Weight Sum (target: 1.000)",
                    "requests": [{
                        "q":          "avg:index.calc.weight_sum{$env,$index_code}",
                        "aggregator": "last",
                    }],
                    "precision": 6,
                }
            },
            # ── Band 4: Corporate Action Events ─────────────────────
            {
                "definition": {
                    "type":  "timeseries",
                    "title": "Corporate Actions Processed",
                    "requests": [{
                        "q":            "sum:index.corporate_action.processed{$env,$index_code} by {action_type}.as_count()",
                        "display_type": "bars",
                        "style":        {"palette": "classic"},
                    }],
                }
            },
            # ── Band 4: Restatements ─────────────────────────────────
            {
                "definition": {
                    "type":  "timeseries",
                    "title": "Restatements Published",
                    "requests": [{
                        "q":            "sum:index.restatement.published{$env,$index_code} by {materiality}.as_count()",
                        "display_type": "bars",
                        "style":        {"palette": "warm"},
                    }],
                }
            },
        ],
    )

    url = f"https://app.datadoghq.com/dashboard/{dashboard['id']}"
    print(f"Dashboard created: {url}")
    return url
```

### Alerting Integration with PagerDuty

> [!note] On-Call Routing
> The shadow divergence monitor routes to the `index-operations` PagerDuty service. The restatement monitor routes to `index-operations` AND `compliance-oversight`. All monitors include a runbook link in the message body pointing to the internal restatement procedures documentation.

```python
"""
dd_alert_routing.py

Validates that all compliance-critical monitors have correct
PagerDuty routing. Run as part of the CI/CD pipeline.
"""

from datadog import initialize, api


REQUIRED_COMPLIANCE_MONITORS = {
    "Index Calc — Shadow Divergence Exceeds 0.01%": {
        "required_tags":    ["compliance", "bmr"],
        "required_mention": "@pagerduty-index-operations",
    },
    "Index Calc — Constituent Count Anomaly": {
        "required_tags":    ["compliance"],
        "required_mention": "@slack-index-alerts",
    },
    "Index Calc — Weight Sum Not Equal to 1.0": {
        "required_tags":    ["data-quality"],
        "required_mention": "@slack-index-alerts",
    },
}


def validate_monitor_routing(api_key: str, app_key: str) -> bool:
    initialize(api_key=api_key, app_key=app_key)
    monitors = api.Monitor.get_all(tags="compliance")

    all_ok = True
    for monitor in monitors:
        name = monitor.get("name", "")
        if name not in REQUIRED_COMPLIANCE_MONITORS:
            continue

        requirements  = REQUIRED_COMPLIANCE_MONITORS[name]
        monitor_tags  = monitor.get("tags", [])
        monitor_msg   = monitor.get("message", "")

        for required_tag in requirements["required_tags"]:
            if required_tag not in monitor_tags:
                print(f"FAIL [{name}]: missing tag '{required_tag}'")
                all_ok = False

        mention = requirements["required_mention"]
        if mention not in monitor_msg:
            print(f"FAIL [{name}]: missing mention '{mention}' in message")
            all_ok = False

    if all_ok:
        print("All compliance monitors validated successfully.")
    return all_ok
```

---

### Appendix A: Compliance Schema Quick Reference

| Table | Purpose | Retention |
|---|---|---|
| `dbo.pipeline_lineage_metadata` | One row per pipeline run per stage | 5 years |
| `dbo.corporate_action_audit_log` | All corporate actions, append-only | 5 years |
| `dbo.divisor_history` | Complete divisor change history | Indefinite |
| `dbo.input_data_tier_log` | Data tier used per security per date | 5 years |
| `dbo.oversight_signoff` | Daily shadow reconciliation attestation | 5 years |
| `dbo.bmr_complaints` | BMR complaint register | 5 years |
| `dbo.restatement_log` | All restatement events | 5 years |
| `dbo.index_levels` | Published and superseded index levels | Indefinite |
| `dbo.constituent_shares` | Historical constituent share counts | Indefinite |
| `dbo.security_prices` | Historical adjusted prices | Indefinite |

### Appendix B: Key Regulatory References

| Regulation | Article | Topic |
|---|---|---|
| EU BMR (2016/1011) | Article 5 | Governance and conflicts of interest |
| EU BMR (2016/1011) | Article 11 | Input data |
| EU BMR (2016/1011) | Article 12 | Methodology |
| EU BMR (2016/1011) | Article 14 | Complaints procedure |
| EU BMR (2016/1011) | Article 21 | Record keeping |
| EU BMR (2016/1011) | Article 24 | Authorisation of administrator |
| IOSCO Principles | Principle 5 | Quality of the benchmark |
| IOSCO Principles | Principle 11 | Audit trail |

## Appendix C: Related Notes

- [[pit-integrity-logic]] — Point-in-time correctness for historical constituent data
- [[esg-data-ingestion-framework]] — ESG data lineage and vendor governance
- [[dataops-for-indices]] — Pipeline orchestration, testing, and deployment
- [[index-maintenance-and-corporate-actions]] — Operational runbooks for specific action types
