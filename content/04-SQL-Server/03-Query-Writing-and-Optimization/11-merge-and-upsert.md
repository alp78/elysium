---
title: "11 - MERGE and Upsert"
tags: [sql-server, tsql, query-writing, merge, upsert]
aliases: [MERGE, upsert, insert-or-update, INSERT WHERE NOT EXISTS, HOLDLOCK upsert, OUTPUT $action, SCD1, SCD2, staging table merge, sp_getapplock]
description: "Production T-SQL reference for upsert and merge patterns in SQL Server: INSERT WHERE NOT EXISTS with HOLDLOCK+UPDLOCK, UPDATE-then-INSERT, delete-and-reinsert refresh, full MERGE grammar (WHEN MATCHED with filter, WHEN NOT MATCHED BY TARGET, WHEN NOT MATCHED BY SOURCE), multiple WHEN MATCHED clauses, OUTPUT $action with audit sinks, error 8672 multi-row source match, missing-semicolon error 10713, MERGE concurrency race and the safer UPDATE+INSERT alternative, sp_getapplock serialization, SCD Type 1 via MERGE, SCD Type 2 via the two-step pattern, and the warehouse staging-table upsert."
created: 2026-03-22
updated: 2026-04-11
status: complete
---

# MERGE and Upsert

> [!abstract] Scope of this note
>
> This note owns every pattern for inserting-or-updating rows in T-SQL, plus the trade-offs between them:
>
> - **Pre-MERGE upsert patterns** — `INSERT WHERE NOT EXISTS` with lock hints, `UPDATE` then `INSERT` in one transaction, delete-and-reinsert slice refresh.
> - **Full MERGE grammar** — target and source forms, `ON` predicate, `WHEN MATCHED [AND filter]`, `WHEN NOT MATCHED BY TARGET`, `WHEN NOT MATCHED BY SOURCE`, multiple `WHEN MATCHED` clauses, and the `OUTPUT $action` column.
> - **MERGE error modes** — error 8672 multi-row source match and the `ROW_NUMBER()` deduplication fix, error 10713 missing semicolon, the implicit-ordering traps on multi-match sources.
> - **MERGE concurrency** — the default race narrative, why `HOLDLOCK` alone is insufficient in practice, the safer `UPDATE + INSERT WHERE NOT EXISTS` pattern with `UPDLOCK, HOLDLOCK` on the target, and `sp_getapplock` as a coarser serialization alternative.
> - **Slowly changing dimensions via MERGE** — SCD Type 1 (overwrite on change) as a single `MERGE` with `WHEN NOT MATCHED BY SOURCE ... DELETE`, and SCD Type 2 (effective-dated history) as the two-step `UPDATE` + `INSERT` pattern that a single `MERGE` cannot cleanly express.
> - **Warehouse staging-table upsert** — the canonical bulk-load → deduplicate → merge → truncate pattern used by every medallion pipeline.
> - **Decision guide** — when to use `MERGE`, when to use plain `INSERT ... WHERE NOT EXISTS`, when to use the two-step pattern, and when to reach for `sp_getapplock`.
>
> Basic `INSERT`, `UPDATE`, `DELETE`, the `OUTPUT` clause, composable DML, identity/SEQUENCE, transactions, and the `XACT_ABORT`/`TRY/CATCH` error-handling envelope belong to [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns). Lock compatibility theory, deadlock analysis, and row-versioning internals belong to the concurrency chapter.

## Upsert Patterns Before MERGE

Before reaching for `MERGE`, understand the three pre-MERGE upsert patterns. They are more verbose than `MERGE` but often clearer, easier to tune, and — under concurrent writers — safer. Every production engineer should reach for them first and use `MERGE` only when its declarative single-statement shape is genuinely valuable.

### INSERT WHERE NOT EXISTS — insert-only upsert

The simplest upsert is an `INSERT` guarded by a `NOT EXISTS` subquery: insert the rows from the source whose business key does not already exist in the target. This pattern handles the "new rows only" case without touching existing rows. When updates are not needed — for example, when the business rule is "never overwrite an existing row" or when duplicates in the source should be silently ignored — this is the cleanest form.

> [!info]- Clause-by-clause breakdown
>
> - `INSERT INTO silver.ohlcv_daily (...)` names the target table and its column list.
> - `SELECT s.symbol COLLATE DATABASE_DEFAULT, s.[date], ...` projects the source rows with the target's default collation coerced on the `symbol` string (the source and target databases use different collations, so the coercion is required for the `NOT EXISTS` comparison to bind).
> - `FROM stoxx.silver.eurostoxx50_ohlcv AS s` names the source — a table in a different database referenced via the three-part name.
> - `WHERE s.[date] = '2026-03-02'` restricts the source to the gap day we want to refill.
> - `AND NOT EXISTS (SELECT 1 FROM silver.ohlcv_daily AS t WHERE t.symbol = s.symbol COLLATE DATABASE_DEFAULT AND t.trade_date = s.[date])` is the guard: only insert rows whose `(symbol, trade_date)` business key is not already present in the target.

*Remove every row for 2026-03-02 from the target to simulate a gap before the refill.*

```sql
DELETE FROM silver.ohlcv_daily
WHERE trade_date = '2026-03-02';

SELECT COUNT(*) AS rows_total,
       SUM(CASE WHEN trade_date = '2026-03-02' THEN 1 ELSE 0 END) AS rows_on_gap_day
FROM silver.ohlcv_daily;
```

| rows_total | rows_on_gap_day |
|---|---|
| 2200 | 0 |

The target holds 2,200 rows, none for 2026-03-02 — the slice that the upsert will refill.

*Refill the gap with `INSERT ... WHERE NOT EXISTS`: only rows whose `(symbol, trade_date)` is missing from the target are inserted.*

```sql
INSERT INTO silver.ohlcv_daily (symbol, trade_date, [open], [high], [low], [close], adj_close, volume)
SELECT s.symbol COLLATE DATABASE_DEFAULT, s.[date], s.[open], s.[high], s.[low], s.[close],
       s.adj_close, s.volume
FROM stoxx.silver.eurostoxx50_ohlcv AS s
WHERE s.[date] = '2026-03-02'
  AND NOT EXISTS
  (
      SELECT 1
      FROM silver.ohlcv_daily AS t
      WHERE t.symbol     = s.symbol COLLATE DATABASE_DEFAULT
        AND t.trade_date = s.[date]
  );

SELECT COUNT(*) AS rows_total,
       SUM(CASE WHEN trade_date = '2026-03-02' THEN 1 ELSE 0 END) AS rows_on_refilled_day
FROM silver.ohlcv_daily;
```

| rows_total | rows_on_refilled_day |
|---|---|
| 2250 | 50 |

Fifty rows were inserted (the 50 constituents of the EuroStoxx 50 index on 2026-03-02), bringing the target to 2,250 rows. Running the same statement a second time would insert zero rows because the `NOT EXISTS` guard would reject every source row. This is the defining property of this pattern: **idempotent** at the row-identity level.

> [!warning] `NOT EXISTS` alone does not serialize concurrent writers
>
> Under concurrent writers, two sessions can both evaluate the `NOT EXISTS` subquery before either one commits, and both can decide the row is missing. Both then issue the `INSERT` and one of them raises a primary-key violation. This race is the reason the `HOLDLOCK, UPDLOCK` hints become mandatory on concurrent upsert paths — see the `## MERGE Concurrency` section for the full treatment.

### UPDATE then INSERT — full upsert without MERGE

When the pattern requires both **updating existing rows** and **inserting new rows**, split the work into two consecutive statements inside one explicit transaction. The `UPDATE` applies the source values to every matching row in the target; the `INSERT ... WHERE NOT EXISTS` then adds the rows that did not exist. Both statements share the same transaction boundary, so either both succeed or both are rolled back.

> [!info]- Clause-by-clause breakdown
>
> - `BEGIN TRAN` opens an explicit transaction.
> - The `UPDATE t FROM silver.ohlcv_daily AS t JOIN stoxx.silver.eurostoxx50_ohlcv AS s ON ...` is a T-SQL extended `UPDATE` that joins the target to the source and overwrites every matching row with the source values. See the `### UPDATE ... FROM ... JOIN` subsection of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns#update-from-join-t-sql-extension-for-joined-updates) for the extended syntax details.
> - `WHERE s.[date] = '2026-03-04'` restricts the update to one trade day.
> - The `INSERT` that follows pulls rows from the source where the target has no matching row, scoped to a different day.
> - `COMMIT` closes the transaction atomically.

*Simulate a stale target: delete one day and halve the close prices on another day.*

```sql
DELETE FROM silver.ohlcv_daily WHERE trade_date = '2026-03-03';

UPDATE silver.ohlcv_daily
SET [close] = [close] * 0.5
WHERE trade_date = '2026-03-04';

SELECT
    (SELECT COUNT(*) FROM silver.ohlcv_daily WHERE trade_date = '2026-03-03') AS rows_on_03,
    CAST((SELECT AVG([close]) FROM silver.ohlcv_daily WHERE trade_date = '2026-03-04') AS decimal(10,4)) AS avg_close_04_before;
```

| rows_on_03 | avg_close_04_before |
|---|---|
| 0 | 120.3378 |

Zero rows for 2026-03-03 (they will need an `INSERT`) and an artificially low average close of €120.34 on 2026-03-04 (they will need an `UPDATE`). The two-statement upsert below resolves both.

*UPDATE then INSERT in one transaction: update 2026-03-04 with fresh source values, then insert the 2026-03-03 rows that are missing.*

```sql
BEGIN TRAN;

UPDATE t
SET t.[open]     = s.[open],
    t.[high]     = s.[high],
    t.[low]      = s.[low],
    t.[close]    = s.[close],
    t.adj_close  = s.adj_close,
    t.volume     = s.volume
FROM silver.ohlcv_daily AS t
JOIN stoxx.silver.eurostoxx50_ohlcv AS s
    ON t.symbol     = s.symbol COLLATE DATABASE_DEFAULT
   AND t.trade_date = s.[date]
WHERE s.[date] = '2026-03-04';

INSERT INTO silver.ohlcv_daily (symbol, trade_date, [open], [high], [low], [close], adj_close, volume)
SELECT s.symbol COLLATE DATABASE_DEFAULT, s.[date], s.[open], s.[high], s.[low], s.[close], s.adj_close, s.volume
FROM stoxx.silver.eurostoxx50_ohlcv AS s
WHERE s.[date] = '2026-03-03'
  AND NOT EXISTS
  (
      SELECT 1
      FROM silver.ohlcv_daily AS t
      WHERE t.symbol     = s.symbol COLLATE DATABASE_DEFAULT
        AND t.trade_date = s.[date]
  );

COMMIT;

SELECT
    (SELECT COUNT(*) FROM silver.ohlcv_daily WHERE trade_date = '2026-03-03') AS rows_on_03_after,
    CAST((SELECT AVG([close]) FROM silver.ohlcv_daily WHERE trade_date = '2026-03-04') AS decimal(10,4)) AS avg_close_04_after;
```

| rows_on_03_after | avg_close_04_after |
|---|---|
| 50 | 240.6756 |

The 50 missing rows on 2026-03-03 were inserted, and the average close on 2026-03-04 doubled back to its true value of €240.68 — exactly twice the stale value, as expected from the `* 0.5` corruption. Both changes happened inside the same transaction, so a concurrent reader would see either the pre-upsert state (50 × 0, average €120) or the post-upsert state (50 × 50, average €240.68) — never a partial mix.

This pattern is the foundation of the safer concurrent upsert discussed in the `## MERGE Concurrency` section. Adding `WITH (UPDLOCK, HOLDLOCK)` to both the `UPDATE` and the `NOT EXISTS` probe produces a race-free upsert that is immune to the `MERGE` concurrency issues without depending on `MERGE` syntax.

### Delete-and-reinsert refresh — slice rebuild

A third pattern is common in warehouse pipelines: **delete every row in a known slice and reinsert from the source**. This is not technically an "upsert" — it is a destructive slice refresh — but it solves the same business requirement whenever the slice boundary is unambiguous (one trade day, one symbol-date partition, one quarter of history). The advantage is that the refresh is trivially idempotent: running it twice produces the same result, and you never need to reason about the difference between "update" and "insert" cases. The disadvantage is that every row in the slice is rewritten even when nothing has changed, which wastes log volume and can bloat the transaction log on large slices.

*Rebuild 2026-03-05 by deleting the slice and reinserting it from the source, all inside one transaction.*

```sql
BEGIN TRAN;

DELETE FROM silver.ohlcv_daily
WHERE trade_date = '2026-03-05';

INSERT INTO silver.ohlcv_daily (symbol, trade_date, [open], [high], [low], [close], adj_close, volume)
SELECT symbol COLLATE DATABASE_DEFAULT, [date], [open], [high], [low], [close], adj_close, volume
FROM stoxx.silver.eurostoxx50_ohlcv
WHERE [date] = '2026-03-05';

COMMIT;

SELECT COUNT(*) AS rows_on_05 FROM silver.ohlcv_daily WHERE trade_date = '2026-03-05';
```

| rows_on_05 |
|---|
| 50 |

Fifty rows in the slice — the target matches the source exactly. Use this pattern when:

- the slice boundary is a natural business boundary (trade day, quarter, batch id)
- the source is the authoritative snapshot for that slice
- the slice is small enough that rewriting all of it is cheap
- the update-set would otherwise touch most of the rows anyway

Avoid this pattern when the slice is very large, when the target carries columns that are not in the source (they would be lost), or when a concurrent reader cannot tolerate briefly seeing an empty slice.

## MERGE Syntax and Clauses

`MERGE` combines `INSERT`, `UPDATE`, and `DELETE` into a single declarative statement that joins a source rowset to a target table and applies one of several actions per row based on the match state. The Microsoft [MERGE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql) reference is the authoritative syntax source; this section covers the forms you will actually use in production and the traps that trip up the rest.

> [!abstract] MERGE clause matrix
>
> Every `MERGE` statement has one or more `WHEN` clauses. The Microsoft reference names three high-level clause families, each with optional filter predicates:
>
> | Clause | Row state | Allowed actions |
> |---|---|---|
> | `WHEN MATCHED [AND filter] THEN` | Row exists in both source and target | `UPDATE SET ...` or `DELETE` |
> | `WHEN NOT MATCHED [BY TARGET] [AND filter] THEN` | Row exists in source but not in target | `INSERT (...) VALUES (...)` |
> | `WHEN NOT MATCHED BY SOURCE [AND filter] THEN` | Row exists in target but not in source | `UPDATE SET ...` or `DELETE` |
>
> A single `MERGE` can have up to two `WHEN MATCHED` clauses (one `UPDATE` and one `DELETE` with different filters), one `WHEN NOT MATCHED BY TARGET` clause, and up to two `WHEN NOT MATCHED BY SOURCE` clauses. The order in which they are written matters for evaluation precedence: the first matching `WHEN MATCHED` clause wins per row.

### Basic MERGE: INSERT + UPDATE in one statement

The canonical `MERGE` upsert has two clauses: `WHEN MATCHED THEN UPDATE` to overwrite existing rows with source values, and `WHEN NOT MATCHED BY TARGET THEN INSERT` to add the new rows. This is the direct one-statement equivalent of the UPDATE-then-INSERT pattern documented above, and it is what every "upsert" tutorial teaches. It is also the version that has the most to lose from the concurrency issues covered in the `## MERGE Concurrency` section — use this shape for single-writer batch loads, not for high-concurrency OLTP upserts.

> [!info]- Clause-by-clause breakdown
>
> - `MERGE silver.ohlcv_daily AS target` — the target table with an alias.
> - `USING (SELECT ...) AS source` — the source rowset. It can be a table, a derived table, a CTE, or a `VALUES` constructor. Here it is a filtered query over a cross-database source.
> - `ON target.symbol = source.symbol AND target.trade_date = source.trade_date` — the `ON` predicate that defines "matching" rows. It must uniquely identify each target row; non-unique predicates risk error 8672.
> - `WHEN MATCHED THEN UPDATE SET target.col = source.col, ...` — for every matching row, overwrite the target columns with the source values.
> - `WHEN NOT MATCHED BY TARGET THEN INSERT (...) VALUES (source.col, ...)` — for every source row that has no matching target row, insert it with the specified column list.
> - The closing semicolon is **mandatory**; see `### Missing semicolon raises error 10713` below.

*Dirty one ASML.AS row (set close to 0) and delete another (2026-03-09) so the MERGE has both UPDATE and INSERT work to do.*

```sql
UPDATE silver.ohlcv_daily
SET [close] = 0
WHERE symbol = 'ASML.AS' AND trade_date = '2026-03-06';

DELETE FROM silver.ohlcv_daily
WHERE symbol = 'ASML.AS' AND trade_date = '2026-03-09';

SELECT trade_date, [close]
FROM silver.ohlcv_daily
WHERE symbol = 'ASML.AS'
  AND trade_date BETWEEN '2026-03-06' AND '2026-03-09'
ORDER BY trade_date;
```

| trade_date | close |
|---|---|
| 2026-03-06 | 0.0 |

Only one row remains in the window — 2026-03-06 with its close corrupted to zero. 2026-03-09 is missing (will need an INSERT), and 2026-03-06 needs an UPDATE. 2026-03-07 and 2026-03-08 are weekend dates and do not exist in the source either.

*Merge the correct source rows back into the window. One statement performs both the UPDATE and the INSERT.*

```sql
MERGE silver.ohlcv_daily AS target
USING
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, [date] AS trade_date,
           [open], [high], [low], [close], adj_close, volume
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
      AND [date] BETWEEN '2026-03-06' AND '2026-03-09'
) AS source
    ON  target.symbol     = source.symbol
    AND target.trade_date = source.trade_date
WHEN MATCHED THEN
    UPDATE SET
        target.[open]    = source.[open],
        target.[high]    = source.[high],
        target.[low]     = source.[low],
        target.[close]   = source.[close],
        target.adj_close = source.adj_close,
        target.volume    = source.volume
WHEN NOT MATCHED BY TARGET THEN
    INSERT (symbol, trade_date, [open], [high], [low], [close], adj_close, volume)
    VALUES (source.symbol, source.trade_date, source.[open], source.[high], source.[low],
            source.[close], source.adj_close, source.volume);

SELECT trade_date, [close]
FROM silver.ohlcv_daily
WHERE symbol = 'ASML.AS'
  AND trade_date BETWEEN '2026-03-06' AND '2026-03-09'
ORDER BY trade_date;
```

| trade_date | close |
|---|---|
| 2026-03-06 | 1147.0 |
| 2026-03-09 | 1147.6 |

Both rows are in their correct state after the merge: 2026-03-06 has been updated from `0.0` to the true close `1147.0`, and 2026-03-09 has been reinserted with close `1147.6`. The result is indistinguishable from the UPDATE-then-INSERT two-statement form, but the MERGE scans the source exactly once instead of twice — the optimizer materializes the source join once and routes each row to the correct branch of the `WHEN` tree.

### WHEN MATCHED with a filter predicate

A common refinement is to **only update rows where something has actually changed**. A `MERGE` with `WHEN MATCHED AND target.col <> source.col THEN UPDATE` skips rows whose target already matches the source, producing both a smaller log footprint (because unchanged rows are not rewritten) and a smaller `OUTPUT` result set (because unchanged rows do not trigger the `UPDATE` branch).

*Dirty only one ASML.AS row (2026-03-10 close cut 10%) and leave the rest clean, then run a filtered MERGE.*

```sql
UPDATE silver.ohlcv_daily
SET [close] = [close] * 0.9
WHERE symbol = 'ASML.AS' AND trade_date = '2026-03-10';

SELECT trade_date, [close]
FROM silver.ohlcv_daily
WHERE symbol = 'ASML.AS'
  AND trade_date BETWEEN '2026-03-06' AND '2026-03-12'
ORDER BY trade_date;
```

| trade_date | close |
|---|---|
| 2026-03-06 | 1147.0 |
| 2026-03-09 | 1147.6 |
| 2026-03-10 | 1080.0 |
| 2026-03-11 | 1198.8 |
| 2026-03-12 | 1190.8 |

Five rows in the window. Four of them already match the source exactly (the merge from the previous demo); only 2026-03-10 differs (`1080.0` instead of the true `1200.0`).

*Run a filtered `MERGE` that only touches rows where the close price actually differs. `OUTPUT $action` returns one row per touched row.*

```sql
MERGE silver.ohlcv_daily AS target
USING
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, [date] AS trade_date, [close]
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS'
      AND [date] BETWEEN '2026-03-06' AND '2026-03-12'
) AS source
    ON  target.symbol     = source.symbol
    AND target.trade_date = source.trade_date
WHEN MATCHED AND target.[close] <> source.[close] THEN
    UPDATE SET target.[close] = source.[close]
OUTPUT $action AS merge_action, inserted.trade_date, deleted.[close] AS old_close, inserted.[close] AS new_close;
```

| merge_action | trade_date | old_close | new_close |
|---|---|---|---|
| UPDATE | 2026-03-10 | 1080.0 | 1200.0 |

Exactly one row was updated — the 2026-03-10 row — and the `OUTPUT` clause reports the `UPDATE` action with both the pre-image (`deleted.[close] = 1080.0`) and the post-image (`inserted.[close] = 1200.0`). The four clean rows were silently skipped because their target value already matched the source, so `WHEN MATCHED AND target.[close] <> source.[close]` evaluated to `FALSE` on them. On a 1,000-row window where only 3 rows have changed, this filter drops the update-log volume by roughly 997× compared to an unfiltered `WHEN MATCHED`.

> [!tip] Filter WHEN MATCHED to avoid no-op writes
>
> Unfiltered `WHEN MATCHED` rewrites every matching row, whether the data changed or not. The rewrite generates a log record, fires any `AFTER UPDATE` trigger, bumps `rowversion`/`timestamp` columns, and resets any `sys.dm_db_index_usage_stats.user_updates` counters. Adding `AND target.col <> source.col` (one predicate per column that matters) is the idiomatic way to make the merge a true differential update.

### WHEN NOT MATCHED BY SOURCE — full-refresh semantics

The third clause family, `WHEN NOT MATCHED BY SOURCE`, handles target rows whose business key is **absent from the source**. This is the "mirror" case: the source is treated as the authoritative set, and any target row that does not appear in it is either deleted (strict mirror) or soft-deleted (flagged as inactive). This clause must be used with care — it is only appropriate when the source represents the complete comparison set for the business rule. If the source is filtered (for example, "only this date" or "only this sector"), any `WHEN NOT MATCHED BY SOURCE` action will affect rows outside the intended scope unless the clause carries its own filter predicate.

*Insert a rogue row that does not exist in the source, then use `WHEN NOT MATCHED BY SOURCE ... DELETE` to remove it.*

```sql
INSERT INTO silver.ohlcv_daily (symbol, trade_date, [open], [high], [low], [close], adj_close, volume)
VALUES ('FAKE.XX', '2026-03-06', 100, 110, 95, 105, 105, 1000);

SELECT symbol, trade_date FROM silver.ohlcv_daily
WHERE symbol IN ('FAKE.XX') ORDER BY trade_date;
```

| symbol | trade_date |
|---|---|
| FAKE.XX | 2026-03-06 |

The rogue row is in place.

*Run `MERGE` with a scoped `WHEN NOT MATCHED BY SOURCE` clause: delete target rows whose `(symbol, trade_date)` is missing from the source, but only within 2026-03-06.*

```sql
MERGE silver.ohlcv_daily AS target
USING
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, [date] AS trade_date
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE [date] = '2026-03-06'
) AS source
    ON  target.symbol     = source.symbol
    AND target.trade_date = source.trade_date
WHEN NOT MATCHED BY SOURCE AND target.trade_date = '2026-03-06' THEN
    DELETE
OUTPUT $action AS merge_action, deleted.symbol, deleted.trade_date;
```

| merge_action | symbol | trade_date |
|---|---|---|
| DELETE | FAKE.XX | 2026-03-06 |

Exactly one row was deleted — the rogue `FAKE.XX` row — and no other 2026-03-06 target row was touched because all of them had a matching source row. The `target.trade_date = '2026-03-06'` predicate on the `WHEN NOT MATCHED BY SOURCE` clause is **essential**: without it, the delete would affect every target row for every date missing from the filtered source, which in this example is every date outside 2026-03-06. That would be catastrophic.

> [!danger] `WHEN NOT MATCHED BY SOURCE` without a scope filter will delete unrelated rows
>
> The default scope of `WHEN NOT MATCHED BY SOURCE` is **the entire target table**, not the slice implied by the source query. If the source is filtered (for example to one day or one symbol), the `NOT MATCHED BY SOURCE` set includes every target row outside that filter — and the delete action will silently remove them.

> [!success] Scope `WHEN NOT MATCHED BY SOURCE` with an explicit `AND target.<partition_column>` predicate
>
> Always add a scope predicate to the `WHEN NOT MATCHED BY SOURCE` clause that matches the filter applied to the source. For a per-day merge, include `AND target.trade_date = '2026-03-06'`. For a per-symbol merge, include `AND target.symbol = source.symbol_or_literal`. The clause then only affects target rows in the slice the merge is actually responsible for.

### Multiple WHEN MATCHED clauses

`MERGE` supports up to two `WHEN MATCHED` clauses with different filter predicates: one `DELETE` and one `UPDATE`, in any order. SQL Server evaluates them top-to-bottom per row and applies the **first** clause whose filter predicate evaluates to true. This is the idiomatic way to route soft-deleted rows to a `DELETE` action while routing normally-changed rows to an `UPDATE` action, all inside one statement.

*Mark SAP.DE with a soft-delete sentinel (`current_price = -1`) so the next merge will route it to the DELETE clause.*

```sql
DECLARE @sd date = (SELECT MAX(signal_date) FROM silver.signals_daily);

UPDATE silver.signals_daily
SET current_price = -1
WHERE symbol = 'SAP.DE' AND signal_date = @sd;

SELECT symbol, signal_date, current_price
FROM silver.signals_daily
WHERE symbol IN ('SAP.DE','SIE.DE')
  AND signal_date = @sd
ORDER BY symbol;
```

| symbol | signal_date | current_price |
|---|---|---|
| SAP.DE | 2026-04-08 | -1.0 |
| SIE.DE | 2026-04-08 | 210.0 |

SAP.DE carries the sentinel, SIE.DE has its normal price.

*Run a MERGE with two WHEN MATCHED clauses: the first routes sentinel rows to DELETE, the second routes value-drift rows to UPDATE.*

```sql
DECLARE @sd date = (SELECT MAX(signal_date) FROM silver.signals_daily);

MERGE silver.signals_daily AS target
USING
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, signal_date, current_price
    FROM stoxx.silver.signals_daily
    WHERE symbol IN ('SAP.DE','SIE.DE')
      AND signal_date = @sd
) AS source
    ON  target.symbol      = source.symbol
    AND target.signal_date = source.signal_date
WHEN MATCHED AND target.current_price = -1 THEN
    DELETE
WHEN MATCHED AND target.current_price <> source.current_price THEN
    UPDATE SET target.current_price = source.current_price
OUTPUT $action AS merge_action,
       ISNULL(inserted.symbol, deleted.symbol) AS symbol,
       deleted.current_price AS old_price,
       inserted.current_price AS new_price;
```

| merge_action | symbol | old_price | new_price |
|---|---|---|---|
| DELETE | SAP.DE | -1.0 | NULL |

One `DELETE` action fired for SAP.DE (because its sentinel value matched the first clause's filter), and zero `UPDATE` actions fired — SIE.DE was not updated because its target value `210.0` already matched the source and no `WHEN MATCHED` clause evaluated to true for it. Note that the `OUTPUT` row for the `DELETE` branch has `inserted.current_price = NULL`: the `INSERTED` pseudo-table is empty for deletes, so the `new_price` projection wraps both sides in `ISNULL` where applicable.

The **order of the `WHEN MATCHED` clauses matters**: if you wrote `WHEN MATCHED AND target.current_price <> source.current_price THEN UPDATE` first and the sentinel clause second, SAP.DE would match the first clause (`-1 <> source_value` is `TRUE`) and get updated, not deleted. Always put the most specific clause first.

## OUTPUT $action and MERGE Auditing

`MERGE` supports the `OUTPUT` clause with a special pseudo-column called `$action` that returns the string `'INSERT'`, `'UPDATE'`, or `'DELETE'` for each affected row — identifying which branch of the `WHEN` tree produced the row. This is the single feature `MERGE` has that the separate-statements alternative cannot match: an atomic per-row audit trail that distinguishes all three action types in one round trip. The three demos below build a persistent audit table, route `$action`-labelled rows into it, and then report per-action counts.

The audit table `dbo.audit_merge_actions` is deliberately defined without triggers, without foreign keys, and without check constraints — the same restrictions that apply to any `OUTPUT INTO` target. See the `### OUTPUT ... INTO audit table` subsection of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns#output---into-audit-table-capture-affected-rows-into-a-persistent-audit-trail) for the full restriction list.

### Dirty the target so the MERGE has INSERT and UPDATE work

*Lower three symbols' current_price by 50% and delete a fourth row so the upcoming MERGE will produce both UPDATE and INSERT actions.*

```sql
DECLARE @sd date = (SELECT MAX(signal_date) FROM silver.signals_daily);

UPDATE silver.signals_daily
SET current_price = current_price * 0.5
WHERE symbol IN ('ASML.AS','MC.PA','SAP.DE') AND signal_date = @sd;

DELETE FROM silver.signals_daily WHERE symbol = 'ALV.DE' AND signal_date = @sd;

SELECT symbol, signal_date, CAST(current_price AS decimal(10,4)) AS current_price
FROM silver.signals_daily
WHERE symbol IN ('ASML.AS','MC.PA','SAP.DE','ALV.DE')
  AND signal_date = @sd
ORDER BY symbol;
```

| symbol | signal_date | current_price |
|---|---|---|
| ASML.AS | 2026-04-08 | 556.9000 |
| MC.PA | 2026-04-08 | 233.4250 |
| SAP.DE | 2026-04-08 | 72.6100 |

Three dirty rows; ALV.DE is absent from the window (will need an INSERT). The baseline is now set up for the audited merge.

### MERGE with OUTPUT $action INTO dbo.audit_merge_actions

*Run a MERGE that updates the three dirty symbols and inserts the missing one, routing every affected row to the audit table with its `$action` label.*

```sql
DECLARE @sd date = (SELECT MAX(signal_date) FROM silver.signals_daily);

MERGE silver.signals_daily AS target
USING
(
    SELECT s.symbol COLLATE DATABASE_DEFAULT AS symbol,
           s.signal_date,
           s.current_price,
           s._index COLLATE DATABASE_DEFAULT AS _index
    FROM stoxx.silver.signals_daily AS s
    WHERE s.signal_date = @sd
      AND s.symbol IN ('ASML.AS','MC.PA','SAP.DE','ALV.DE')
) AS source
    ON  target.symbol      = source.symbol
    AND target.signal_date = source.signal_date
WHEN MATCHED AND target.current_price <> source.current_price THEN
    UPDATE SET target.current_price = source.current_price
WHEN NOT MATCHED BY TARGET THEN
    INSERT (_index, symbol, signal_date, current_price)
    VALUES (source._index, source.symbol, source.signal_date, source.current_price)
OUTPUT
    $action,
    ISNULL(inserted.symbol, deleted.symbol),
    ISNULL(inserted.signal_date, deleted.signal_date),
    deleted.current_price,
    inserted.current_price
INTO dbo.audit_merge_actions (action_type, symbol, signal_date, old_price, new_price);

SELECT TOP (5) audit_id, action_type, symbol, signal_date,
       CAST(old_price AS decimal(10,4)) AS old_price,
       CAST(new_price AS decimal(10,4)) AS new_price
FROM dbo.audit_merge_actions
ORDER BY audit_id DESC;
```

| audit_id | action_type | symbol | signal_date | old_price | new_price |
|---|---|---|---|---|---|
| 4 | UPDATE | SAP.DE | 2026-04-08 | 72.6100 | 145.2200 |
| 3 | UPDATE | MC.PA | 2026-04-08 | 233.4250 | 466.8500 |
| 2 | UPDATE | ASML.AS | 2026-04-08 | 556.9000 | 1113.8000 |
| 1 | INSERT | ALV.DE | 2026-04-08 | NULL | 367.2000 |

Four rows landed in the audit table: three `UPDATE` actions (each with a populated `old_price` from `DELETED` and a new `new_price` from `INSERTED`) and one `INSERT` action (with `old_price = NULL` because the `DELETED` pseudo-table is empty for inserts). The `ISNULL(inserted.col, deleted.col)` trick in the `OUTPUT` projection is important for `WHEN NOT MATCHED BY TARGET` rows: the `deleted` pseudo-table is empty for those rows, so projecting `deleted.symbol` alone would return `NULL`. Coalescing with `inserted.symbol` gives a non-null identifier regardless of which branch fired.

> [!warning] `OUTPUT INTO` is bound by the same restrictions as other DML
>
> The target of `OUTPUT INTO` cannot have enabled triggers, cannot participate on either side of a foreign key, and cannot have enabled `CHECK` constraints or rules. `dbo.audit_merge_actions` is deliberately built without any of these.

### Per-action counts from the audit sink

*Count per-action rows written to the audit table from the merge above.*

```sql
SELECT
    COUNT(*)                                                AS audit_total,
    SUM(CASE WHEN action_type = 'INSERT' THEN 1 ELSE 0 END) AS inserts,
    SUM(CASE WHEN action_type = 'UPDATE' THEN 1 ELSE 0 END) AS updates,
    SUM(CASE WHEN action_type = 'DELETE' THEN 1 ELSE 0 END) AS deletes
FROM dbo.audit_merge_actions;
```

| audit_total | inserts | updates | deletes |
|---|---|---|---|
| 4 | 1 | 3 | 0 |

Four audit rows: 1 insert, 3 updates, 0 deletes. This is the canonical pattern for reporting "what did the merge actually do" — the `@@ROWCOUNT` variable only reports the total (`4`), so a downstream auditor cannot distinguish between the three action types without the `$action` column.

> [!danger] `OUTPUT` rows are still returned when the MERGE rolls back
>
> As with all other DML, `OUTPUT` rows reach the client even if the statement encounters an error and rolls back. Always pair `OUTPUT` with `SET XACT_ABORT ON` + `TRY/CATCH` and only trust the `OUTPUT` result after a successful `COMMIT`. See the `## Transactions, Errors, and Halloween Protection` section of [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns#transactions-errors-and-halloween-protection).

## MERGE Error Modes

`MERGE` has several distinct parse-time and runtime errors that no other DML statement produces. The three below are the ones you will meet in production.

### Error 8672 — multi-row source match

> [!danger] Source rows with duplicate business keys raise error 8672
>
> The Microsoft [MERGE (Transact-SQL)](https://learn.microsoft.com/en-us/sql/t-sql/statements/merge-transact-sql) reference states that a single target row may be matched by **at most one** source row per statement. If two or more source rows have the same business key and both match a target row, `MERGE` raises error 8672 "The MERGE statement attempted to UPDATE or DELETE the same row more than once" and rolls back the entire statement.

*Force the multi-row source match by unioning the same row twice in the source CTE.*

```sql
;WITH dup_src AS
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, [date] AS trade_date, [close]
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND [date] = '2026-03-10'
    UNION ALL
    SELECT symbol COLLATE DATABASE_DEFAULT, [date], [close] * 0.5
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND [date] = '2026-03-10'
)
MERGE silver.ohlcv_daily AS target
USING dup_src AS source
    ON  target.symbol     = source.symbol
    AND target.trade_date = source.trade_date
WHEN MATCHED THEN
    UPDATE SET target.[close] = source.[close];
```

```text
Msg 8672, Level 16, State 1
The MERGE statement attempted to UPDATE or DELETE the same row more than once.
This happens when a target row matches more than one source row. A MERGE
statement cannot UPDATE/DELETE the same row of the target table multiple times.
Refine the ON clause to ensure a target row matches at most one source row,
or use the GROUP BY clause to group the source rows.
```

The two-row source would have asked the merge engine to update `(ASML.AS, 2026-03-10)` with two different close values (`1200.0` and `600.0`), and the engine refuses. The whole statement is rolled back — no rows are modified.

> [!success] Deduplicate the source with `ROW_NUMBER()` before the MERGE
>
> The canonical fix is to wrap the source in a `ROW_NUMBER()` CTE that picks exactly one row per business key based on a deterministic ordering (timestamp, priority, load batch). The `MERGE` then consumes only the surviving rows and error 8672 disappears. This pattern is also used for the warehouse staging-table upsert in the `## Staging Table Upsert Pattern` section.

*Rewrite the same source with a `ROW_NUMBER()` CTE that picks the lowest `load_priority` per key.*

```sql
;WITH dup_src AS
(
    SELECT symbol COLLATE DATABASE_DEFAULT AS symbol, [date] AS trade_date, [close], 1 AS load_priority
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND [date] = '2026-03-10'
    UNION ALL
    SELECT symbol COLLATE DATABASE_DEFAULT, [date], [close] * 0.5, 2
    FROM stoxx.silver.eurostoxx50_ohlcv
    WHERE symbol = 'ASML.AS' AND [date] = '2026-03-10'
),
deduped AS
(
    SELECT symbol, trade_date, [close],
           ROW_NUMBER() OVER (PARTITION BY symbol, trade_date ORDER BY load_priority ASC) AS rn
    FROM dup_src
)
MERGE silver.ohlcv_daily AS target
USING
(
    SELECT symbol, trade_date, [close]
    FROM deduped
    WHERE rn = 1
) AS source
    ON  target.symbol     = source.symbol
    AND target.trade_date = source.trade_date
WHEN MATCHED THEN
    UPDATE SET target.[close] = source.[close]
OUTPUT $action AS merge_action, inserted.trade_date, deleted.[close] AS old_close, inserted.[close] AS new_close;
```

| merge_action | trade_date | old_close | new_close |
|---|---|---|---|
| UPDATE | 2026-03-10 | 1200.0 | 1200.0 |

Exactly one `UPDATE` action fired. The `ROW_NUMBER() OVER (PARTITION BY key ORDER BY load_priority)` expression keeps the row with `load_priority = 1` (the authoritative row) and discards the `load_priority = 2` duplicate. This is the idiomatic dedup pattern for every MERGE that consumes a staging table — always build a `ROW_NUMBER()` CTE keyed on the business-key tuple, with a deterministic `ORDER BY` expression that decides which duplicate wins.

### Error 10713 — missing terminating semicolon

> [!failure] A `MERGE` statement must be terminated by a semicolon
>
> Unlike every other T-SQL statement, `MERGE` **requires** a terminating semicolon. Omitting it produces parse-time error 10713 "A MERGE statement must be terminated by a semi-colon (;)". The requirement exists because the SQL-2003 spec allows an optional `WHEN NOT MATCHED` clause to span multiple `THEN` branches, and the parser needs a definite end-of-statement marker.

*A MERGE directly followed by another statement with no semicolon between them.*

```sql
MERGE silver.signals_daily AS target
USING
(
    SELECT symbol, signal_date, current_price
    FROM silver.signals_daily
    WHERE symbol = 'ASML.AS'
) AS source
    ON  target.symbol      = source.symbol
    AND target.signal_date = source.signal_date
WHEN MATCHED THEN
    UPDATE SET target.current_price = source.current_price
SELECT 'next statement not separated from MERGE' AS note;
```

```text
Msg 10713, Level 15, State 1
A MERGE statement must be terminated by a semi-colon (;).
```

Adding `;` after the last `WHEN` clause (on its own line or at the end of it) resolves the error. Many T-SQL style guides recommend ending **every** statement with a semicolon, not just `MERGE` and CTEs, because the semicolon will eventually be mandatory for all statements in a future SQL Server version (Microsoft has been deprecating semicolon-optional syntax since SQL Server 2005).

> [!success] Always terminate every statement with `;`
>
> Never write `MERGE` without a trailing semicolon. The habit generalizes: end every T-SQL statement with `;`, which also makes CTE boundaries unambiguous (since a CTE requires a semicolon on the previous statement) and futureproofs your code against the semicolon-required deprecation.

### Error 3989 and other trigger-interaction errors

`MERGE` is the **only** statement that can fire `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` triggers in a single execution. The triggers fire in an **unspecified order**, and each trigger sees its own subset of the `INSERTED`/`DELETED` pseudo-tables. This creates two traps:

- If two triggers need to agree on "which rows did the merge touch," they cannot coordinate via the pseudo-tables alone — they must use a shared audit table or session-scoped temp table.
- If a trigger raises an error (`RAISERROR` or `THROW`), the whole `MERGE` is rolled back including the other triggers' effects.

A related error is **3989** ("The action taken by this trigger statement is not allowed due to previous action taken on this target table") — raised when a trigger attempts a DML operation on the same table that the outer `MERGE` is targeting, under specific recursion configurations. The fix is to redesign the trigger to target a different table or to disable `RECURSIVE_TRIGGERS` on the database.

For any `MERGE` that targets a table with multiple triggers, prefer the `OUTPUT ... INTO dbo.audit_*` pattern documented above over trigger-based auditing — explicit `OUTPUT` is both visible in the statement and immune to trigger order ambiguity.

## MERGE Concurrency

`MERGE` is famously difficult to get right under concurrent writers. The issue is not with the `UPDATE` or `INSERT` actions themselves but with the implicit **read-then-write** decision the engine makes while evaluating the `ON` predicate: two sessions can both read the target, both decide that a row is missing, and both try to insert it. Only one will succeed — the other raises a primary-key violation or, under specific plan shapes, silently inserts a duplicate that the `MERGE` engine fails to catch.

The `MERGE` concurrency issue has been documented in depth by Aaron Bertrand ("Use Caution with SQL Server's MERGE Statement") and Paul White ("UPDATE performance with an explicit transaction"). Both articles are worth reading in full; this section documents the operational consequences and the safer pattern that production code should use instead.

> [!danger] Default MERGE under concurrent writers is not serializable
>
> Two concurrent sessions running the same `MERGE` against the same business key can interleave such that:
>
> - Session A evaluates `WHEN NOT MATCHED BY TARGET`, decides the row is missing, and locks its `INSERT` intention.
> - Session B evaluates the same `WHEN NOT MATCHED BY TARGET`, decides the row is missing (because session A has not committed yet), and also locks its `INSERT` intention.
> - Both sessions reach the `INSERT` step. One of them raises primary-key violation error 2627 or 2601; the other commits silently.
>
> Under some plan shapes (notably with a narrow `MERGE` that uses a nested-loops join over a non-unique `ON` predicate), the engine can even produce silent duplicate rows without raising any error at all. This is the reason most senior SQL Server practitioners advise against `MERGE` for OLTP upsert paths.

### HOLDLOCK is necessary but not sufficient

The first reflex is to add `WITH (HOLDLOCK)` to the target table reference. `HOLDLOCK` is a shorthand for the `SERIALIZABLE` isolation level at the object scope — it acquires range locks on the `ON` predicate range so another session reading the same range blocks until the first session commits. This stops the most obvious race (both sessions reading "missing" at the same time) but does **not** stop all of them — the Bertrand/White analysis documents specific plan shapes under which `MERGE` + `HOLDLOCK` still allows primary-key violations, most often when the target has a unique clustered index and the source is a filtered scan.

A robust production upsert path should not rely on `MERGE + HOLDLOCK` alone. The safer alternative is to split the upsert back into two explicit statements — `UPDATE` then `INSERT WHERE NOT EXISTS` — and apply `WITH (UPDLOCK, HOLDLOCK)` on both sides inside an explicit transaction. This is the pattern every high-concurrency upsert should default to.

### The safer alternative: UPDATE + INSERT with UPDLOCK, HOLDLOCK

The `UPDLOCK, HOLDLOCK` combination acquires an update lock on matched rows and a range lock on the predicate range. Update locks are incompatible with other update locks, so two concurrent sessions cannot both "see the row is missing" simultaneously. The first session acquires the update lock on the key range, the second session blocks until the first commits, and when the second resumes it correctly observes whatever the first session did.

*Delete MC.PA so the INSERT branch has work, then run the safer upsert pattern.*

```sql
DECLARE @sd date = (SELECT MAX(signal_date) FROM silver.signals_daily);
DELETE FROM silver.signals_daily WHERE symbol = 'MC.PA' AND signal_date = @sd;

SELECT symbol, signal_date, current_price
FROM silver.signals_daily
WHERE symbol IN ('ASML.AS','MC.PA')
  AND signal_date = @sd
ORDER BY symbol;
```

| symbol | signal_date | current_price |
|---|---|---|
| ASML.AS | 2026-04-08 | 1113.8 |

ASML.AS exists (will be updated), MC.PA is missing (will be inserted).

*Safer upsert: `UPDATE WITH (UPDLOCK, HOLDLOCK)` followed by `INSERT WHERE NOT EXISTS` (also with `UPDLOCK, HOLDLOCK` on the probe) inside one explicit transaction.*

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE t WITH (UPDLOCK, HOLDLOCK)
SET t.current_price = s.current_price
FROM silver.signals_daily AS t
JOIN stoxx.silver.signals_daily AS s
    ON t.symbol      = s.symbol COLLATE DATABASE_DEFAULT
   AND t.signal_date = s.signal_date
WHERE s.symbol IN ('ASML.AS','MC.PA')
  AND s.signal_date = (SELECT MAX(signal_date) FROM stoxx.silver.signals_daily);

INSERT INTO silver.signals_daily (_index, symbol, signal_date, current_price)
SELECT s._index COLLATE DATABASE_DEFAULT, s.symbol COLLATE DATABASE_DEFAULT, s.signal_date, s.current_price
FROM stoxx.silver.signals_daily AS s
WHERE s.symbol IN ('ASML.AS','MC.PA')
  AND s.signal_date = (SELECT MAX(signal_date) FROM stoxx.silver.signals_daily)
  AND NOT EXISTS
  (
      SELECT 1
      FROM silver.signals_daily AS t WITH (UPDLOCK, HOLDLOCK)
      WHERE t.symbol      = s.symbol COLLATE DATABASE_DEFAULT
        AND t.signal_date = s.signal_date
  );

COMMIT;

SELECT symbol, signal_date, current_price
FROM silver.signals_daily
WHERE symbol IN ('ASML.AS','MC.PA')
  AND signal_date = (SELECT MAX(signal_date) FROM silver.signals_daily)
ORDER BY symbol;
```

| symbol | signal_date | current_price |
|---|---|---|
| ASML.AS | 2026-04-08 | 1113.8 |
| MC.PA | 2026-04-08 | 466.85 |

Both rows are in their correct state. Critical details in this pattern:

- **`SET XACT_ABORT ON`** guarantees that any run-time error (deadlock victim, constraint violation, etc.) aborts the whole transaction instead of leaving it in a partial state.
- **`UPDLOCK` on the `UPDATE`** acquires update locks on the matched rows as they are scanned, upgrading to exclusive locks at modification time. Update locks serialize concurrent update attempts on the same key range.
- **`HOLDLOCK` on both the `UPDATE` and the `NOT EXISTS` probe** holds the acquired locks to the end of the transaction (range lock semantics). This prevents a second session from inserting into the same range between phase 1 and phase 2.
- **`NOT EXISTS` with `WITH (UPDLOCK, HOLDLOCK)`** probes the target under the same lock semantics so the insert decision is serialized with any concurrent upsert.
- **One explicit transaction** wraps both statements. Either both succeed or both roll back.

Benchmarks by Aaron Bertrand show that the two-statement pattern has **equal or better** throughput than `MERGE + HOLDLOCK` on any concurrency level above about 8 simultaneous upserts, because the `UPDATE`/`INSERT` split allows the optimizer to choose better plans for each half. There is essentially no reason to prefer `MERGE` over this pattern on OLTP workloads.

### sp_getapplock for coarse serialization

When the upsert must serialize across a **set** of business keys rather than one key at a time — for example, "one reload per symbol at a time, across multiple competing schedulers" — the range-lock approach becomes unwieldy because the predicate range can span many rows. The alternative is `sp_getapplock`, a session-scoped application lock keyed on an arbitrary string. Any session calling `sp_getapplock` with the same resource name blocks until the first one commits or rolls back. This gives full mutual exclusion on the logical business-key name without taking row locks at all.

*Run an upsert inside a transaction that holds an application lock keyed on the business concept being updated.*

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @rc int;
EXEC @rc = sp_getapplock
    @Resource     = N'signals_daily_upsert_MC.PA',
    @LockMode     = N'Exclusive',
    @LockOwner    = N'Transaction',
    @LockTimeout  = 5000;

IF @rc < 0
BEGIN
    RAISERROR('Could not acquire app lock (rc=%d)', 16, 1, @rc);
    ROLLBACK;
    RETURN;
END;

UPDATE t
SET t.current_price = s.current_price
FROM silver.signals_daily AS t
JOIN stoxx.silver.signals_daily AS s
    ON t.symbol      = s.symbol COLLATE DATABASE_DEFAULT
   AND t.signal_date = s.signal_date
WHERE s.symbol = 'MC.PA';

SELECT @@ROWCOUNT AS rows_updated_under_applock;

COMMIT;
```

| rows_updated_under_applock |
|---|
| 4 |

Four rows updated under the application lock. The lock is held for the duration of the transaction (`@LockOwner = N'Transaction'`), so the `COMMIT` releases it automatically. Any second session running the same procedure with the same `@Resource` name blocks until the first commits, up to the `@LockTimeout = 5000` millisecond deadline — after which the second session's `sp_getapplock` returns a negative code and the `IF @rc < 0 RAISERROR` block aborts the transaction.

`sp_getapplock` is the right tool when:

- the resource being protected is a logical concept (a symbol, a batch ID, a job queue) rather than a physical row range
- concurrent writers should queue rather than race
- the lock scope is wider than what `UPDLOCK, HOLDLOCK` can cheaply cover
- a coarse-grained mutex is acceptable in exchange for simpler code

It is **not** a replacement for row-level serialization on hot rows. Row locks scale better when many sessions touch disjoint row sets; application locks scale better when many sessions touch the **same** logical resource one at a time.

## Slowly Changing Dimensions via MERGE

The single most common real-world use of `MERGE` in a warehouse pipeline is maintaining a **slowly changing dimension** (SCD) table. Two SCD variants are interesting here: Type 1 overwrites dimension attributes in place when they change, losing the history; Type 2 keeps every historical version of every row, with effective-dated `valid_from` / `valid_to` columns. Type 1 is a natural fit for a single `MERGE` statement; Type 2 requires a **two-step** pattern that a single `MERGE` cannot cleanly express.

### SCD Type 1: overwrite on change via a single MERGE

A Type 1 dimension stores one row per business key with the current value of every attribute. When an attribute changes, the row is overwritten in place and the previous value is lost. A single `MERGE` with three clauses does the whole job: `WHEN NOT MATCHED BY TARGET` adds new rows, `WHEN MATCHED AND changed` overwrites existing rows, and `WHEN NOT MATCHED BY SOURCE AND retired` removes rows that are no longer in the source.

*Create a Type 1 country dimension with a deliberately stale row and one "to be removed" row, then run a three-clause MERGE against the authoritative source.*

```sql
IF OBJECT_ID('silver.country_dim_t1','U') IS NOT NULL DROP TABLE silver.country_dim_t1;

CREATE TABLE silver.country_dim_t1
(
    iso_alpha2   char(2) NOT NULL PRIMARY KEY,
    country_name nvarchar(200) NOT NULL,
    last_update  datetime2(3) NOT NULL CONSTRAINT DF_cdt1 DEFAULT SYSUTCDATETIME()
);

INSERT INTO silver.country_dim_t1 (iso_alpha2, country_name)
VALUES
    ('FR', N'Fance'),
    ('DE', N'Germany'),
    ('IT', N'Italy'),
    ('XX', N'To be removed');

SELECT iso_alpha2, country_name FROM silver.country_dim_t1 ORDER BY iso_alpha2;
```

| iso_alpha2 | country_name |
|---|---|
| DE | Germany |
| FR | Fance |
| IT | Italy |
| XX | To be removed |

The starting state: FR has a typo, DE and IT are correct, XX is a row that should not exist.

*Run the Type 1 MERGE against `bronze.dim_country` filtered to five European countries. Three WHEN clauses handle the full SCD1 lifecycle.*

```sql
MERGE silver.country_dim_t1 AS target
USING
(
    SELECT iso_alpha2, country_name
    FROM bronze.dim_country
    WHERE iso_alpha2 IN ('FR','DE','IT','ES','NL')
) AS source
    ON target.iso_alpha2 = source.iso_alpha2
WHEN MATCHED AND target.country_name <> source.country_name THEN
    UPDATE SET
        target.country_name = source.country_name,
        target.last_update  = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (iso_alpha2, country_name)
    VALUES (source.iso_alpha2, source.country_name)
WHEN NOT MATCHED BY SOURCE AND target.iso_alpha2 = 'XX' THEN
    DELETE
OUTPUT $action AS merge_action,
       ISNULL(inserted.iso_alpha2, deleted.iso_alpha2) AS iso_alpha2;
```

| merge_action | iso_alpha2 |
|---|---|
| INSERT | ES |
| UPDATE | FR |
| INSERT | NL |
| DELETE | XX |

Four actions in one statement:

- `ES` and `NL` are `INSERT` rows — they are in the source but not in the target.
- `FR` is an `UPDATE` row — the target name `'Fance'` differs from the source name `'France'`, so the filter predicate evaluates to `TRUE` and the `WHEN MATCHED AND` clause fires.
- `XX` is a `DELETE` row — it is in the target but not in the source's five-country filter, and the scoped `target.iso_alpha2 = 'XX'` predicate allows the delete.
- `DE` and `IT` produce **no** action because their target name already matches the source, so `WHEN MATCHED AND target.country_name <> source.country_name` is `FALSE`.

*Verify the final state of the dimension.*

```sql
SELECT iso_alpha2, country_name
FROM silver.country_dim_t1
ORDER BY iso_alpha2;
```

| iso_alpha2 | country_name |
|---|---|
| DE | Germany |
| ES | Spain |
| FR | France |
| IT | Italy |
| NL | Netherlands |

Five rows, all with their correct names. The FR typo is fixed, XX is gone, ES and NL are present. This is a clean single-statement SCD1 refresh — `MERGE` is at its best in this shape.

> [!warning] Scope the `WHEN NOT MATCHED BY SOURCE` clause to avoid collateral deletes
>
> In the demo above, the delete is narrowed to `target.iso_alpha2 = 'XX'`. Without this predicate, the clause would delete every target row whose `iso_alpha2` is not in the filtered source (`FR`, `DE`, `IT`, `ES`, `NL`) — including any rows the reader never intended to touch. Always scope the `NOT MATCHED BY SOURCE` clause to whatever partition the source represents.

### SCD Type 2: the two-step pattern

A Type 2 dimension keeps **every** historical version of every row, with `valid_from` / `valid_to` / `is_current` columns and a surrogate key that uniquely identifies each version. When an attribute changes, the existing "current" row must be **closed** (its `valid_to` set, `is_current` flipped to 0) and a **new** row must be inserted with the new values and `is_current = 1`. A single `MERGE` cannot cleanly do this because the same source row must produce both an `UPDATE` (to close the old version) and an `INSERT` (to create the new version), and `MERGE` only supports one action per source-target match.

The canonical fix is a **two-step pattern** inside one transaction: an `UPDATE` that closes the stale versions, followed by an `INSERT ... WHERE NOT EXISTS` that inserts the new versions for both changed rows and brand-new rows. Some references propose a more complex single-MERGE pattern using `OUTPUT ... INTO` and composable DML, but the two-step form is more readable, easier to debug, and produces better query plans. The theoretical elegance of "do it all in one statement" is not worth the loss of clarity.

*Create a Type 2 symbol dimension with three current versions, one of which has a deliberately wrong sector.*

```sql
IF OBJECT_ID('silver.symbol_dim_t2','U') IS NOT NULL DROP TABLE silver.symbol_dim_t2;

CREATE TABLE silver.symbol_dim_t2
(
    surrogate_id int IDENTITY(1,1) PRIMARY KEY,
    symbol       varchar(20) NOT NULL,
    sector       nvarchar(100) NULL,
    country      nvarchar(100) NULL,
    valid_from   datetime2(3) NOT NULL,
    valid_to     datetime2(3) NULL,
    is_current   bit NOT NULL
);

INSERT INTO silver.symbol_dim_t2 (symbol, sector, country, valid_from, valid_to, is_current)
VALUES
    ('ASML.AS', N'Technology',        N'Netherlands', '2021-01-01', NULL, 1),
    ('MC.PA',   N'Consumer Cyclical', N'France',      '2021-01-01', NULL, 1),
    ('SAP.DE',  N'Old Sector Name',   N'Germany',     '2021-01-01', NULL, 1);

SELECT symbol, sector, country, valid_from, valid_to, is_current
FROM silver.symbol_dim_t2
ORDER BY symbol;
```

| symbol | sector | country | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| ASML.AS | Technology | Netherlands | 2021-01-01 00:00:00 | NULL | 1 |
| MC.PA | Consumer Cyclical | France | 2021-01-01 00:00:00 | NULL | 1 |
| SAP.DE | Old Sector Name | Germany | 2021-01-01 00:00:00 | NULL | 1 |

ASML.AS and MC.PA already match `silver.index_dim`, but SAP.DE carries the wrong sector — that row should be closed and replaced.

> [!info]- Two-step SCD2 walkthrough
>
> - **Step 1** is an `UPDATE` that closes the target row for every symbol whose current attributes have drifted from the authoritative source. `valid_to` is set to `SYSUTCDATETIME()` and `is_current` flips to `0`. The predicate `t.sector <> s.sector OR t.country <> s.country` is the change detector.
> - **Step 2** is an `INSERT ... WHERE NOT EXISTS` that adds a new current version for every symbol the source considers "current" whose attributes do not already match an active target row. This second step handles both the "changed" case (step 1 closed the old row, step 2 adds the new one) and the "brand new symbol" case (step 1 was a no-op, step 2 adds the first version).
> - Both steps are wrapped in one explicit transaction with `SET XACT_ABORT ON`. A concurrent reader sees either the pre-refresh state or the post-refresh state but never a partial mix with both the old version closed and the new version missing.

*Run the two-step SCD2 pattern: close stale versions, then insert new current versions, all in one transaction.*

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE t
SET t.valid_to   = SYSUTCDATETIME(),
    t.is_current = 0
FROM silver.symbol_dim_t2 AS t
JOIN silver.index_dim AS s
    ON t.symbol = s.symbol AND s.is_current = 1
WHERE t.is_current = 1
  AND (t.sector <> s.sector OR t.country <> s.country);

INSERT INTO silver.symbol_dim_t2 (symbol, sector, country, valid_from, valid_to, is_current)
SELECT s.symbol, s.sector, s.country, SYSUTCDATETIME(), NULL, 1
FROM silver.index_dim AS s
WHERE s.is_current = 1
  AND s.symbol IN ('ASML.AS','MC.PA','SAP.DE')
  AND NOT EXISTS
  (
      SELECT 1
      FROM silver.symbol_dim_t2 AS t
      WHERE t.symbol     = s.symbol
        AND t.is_current = 1
        AND t.sector     = s.sector
        AND t.country    = s.country
  );

COMMIT;

SELECT surrogate_id, symbol, sector,
       valid_from, valid_to, is_current
FROM silver.symbol_dim_t2
ORDER BY symbol, valid_from;
```

| surrogate_id | symbol | sector | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| 1 | ASML.AS | Technology | 2021-01-01 00:00:00 | NULL | 1 |
| 2 | MC.PA | Consumer Cyclical | 2021-01-01 00:00:00 | NULL | 1 |
| 3 | SAP.DE | Old Sector Name | 2021-01-01 00:00:00 | 2026-04-11 12:29:35.19 | 0 |
| 4 | SAP.DE | Technology | 2026-04-11 12:29:35.19 | NULL | 1 |

Four rows now exist in the dimension: the two unchanged `ASML.AS` and `MC.PA` versions (`is_current = 1`, `valid_to = NULL`), the closed-out SAP.DE version (`is_current = 0`, `valid_to = 2026-04-11 12:29:35.19`), and the new SAP.DE version (`is_current = 1`, `valid_from = 2026-04-11 12:29:35.19`, same timestamp as the close-out). The effective-dated history is complete: at any point in time, the dimension can be joined on `t.valid_from <= @as_of < t.valid_to` (with `NULL` treated as "+∞") to recover the attribute values that were in effect at that instant.

> [!tip] Prefer the two-step pattern over a single `MERGE` for SCD2
>
> Several tutorials document a single-MERGE pattern that uses `OUTPUT ... INTO` inside a composable DML wrapper to produce the SCD2 effect. The pattern exists and works, but it is 2× the code, 3× harder to debug, and the optimizer often produces a worse plan for it than for the two-step form. There is no operational reason to prefer it — use the two-step pattern and document it clearly in comments.

## Staging Table Upsert Pattern

The production-grade pattern for bulk loading changes into a target table is the **staging-table upsert**: load raw rows into a staging table (via `BULK INSERT`, `OPENROWSET(BULK ...)`, or an application-level bulk-copy operation), optionally enrich or validate them, deduplicate on the business key with `ROW_NUMBER()`, merge the surviving rows into the target, and truncate the staging table. Every warehouse pipeline in every medallion architecture uses some variant of this shape.

### Load raw rows into staging (including an intentional duplicate)

*Populate `stg.signals` from the source and add a duplicate row plus a new synthetic symbol.*

```sql
TRUNCATE TABLE stg.signals;

INSERT INTO stg.signals (_index, symbol, signal_date, current_price, forward_pe)
SELECT _index COLLATE DATABASE_DEFAULT, symbol COLLATE DATABASE_DEFAULT,
       signal_date, current_price, forward_pe
FROM stoxx.silver.signals_daily
WHERE signal_date = (SELECT MAX(signal_date) FROM stoxx.silver.signals_daily)
  AND symbol IN ('ASML.AS','MC.PA','SAP.DE','ALV.DE','SIE.DE','NEW.SYM');

INSERT INTO stg.signals (_index, symbol, signal_date, current_price, forward_pe)
SELECT _index, symbol, signal_date, current_price * 1.01, forward_pe
FROM stg.signals
WHERE symbol = 'ASML.AS';

INSERT INTO stg.signals (_index, symbol, signal_date, current_price, forward_pe)
VALUES ('euro_stoxx_50', 'NEW.SYM',
        (SELECT MAX(signal_date) FROM stoxx.silver.signals_daily),
        999.99, 42.0);

SELECT symbol, CAST(current_price AS decimal(10,4)) AS current_price, load_ts
FROM stg.signals
ORDER BY symbol, load_ts;
```

| symbol | current_price | load_ts |
|---|---|---|
| ALV.DE | 367.2000 | 2026-04-11 12:29:35.199 |
| ASML.AS | 1113.8000 | 2026-04-11 12:29:35.199 |
| ASML.AS | 1124.9380 | 2026-04-11 12:29:35.204 |
| MC.PA | 466.8500 | 2026-04-11 12:29:35.199 |
| NEW.SYM | 999.9900 | 2026-04-11 12:29:35.204 |
| SAP.DE | 145.2200 | 2026-04-11 12:29:35.199 |
| SIE.DE | 210.0000 | 2026-04-11 12:29:35.199 |

Seven staging rows: five genuine rows, one duplicate (`ASML.AS` at a newer `load_ts` with a higher `current_price`), and one brand-new symbol (`NEW.SYM`). In a real pipeline the duplicate typically comes from a source system that retries a failed row — the staging layer must tolerate it without either dropping the correct version or raising a PK violation.

### Merge staging into target with dedupe and TRUNCATE

*Deduplicate staging rows with `ROW_NUMBER()`, `MERGE` the survivors into the target under `HOLDLOCK`, `TRUNCATE` staging, and `COMMIT` atomically.*

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

;WITH deduped AS
(
    SELECT _index, symbol, signal_date, current_price, forward_pe,
           ROW_NUMBER() OVER (PARTITION BY symbol, signal_date ORDER BY load_ts DESC) AS rn
    FROM stg.signals
)
MERGE silver.signals_daily WITH (HOLDLOCK) AS target
USING
(
    SELECT _index, symbol, signal_date, current_price, forward_pe
    FROM deduped
    WHERE rn = 1
) AS source
    ON  target.symbol      = source.symbol
    AND target.signal_date = source.signal_date
WHEN MATCHED AND
     (target.current_price <> source.current_price OR ISNULL(target.forward_pe,-1) <> ISNULL(source.forward_pe,-1)) THEN
    UPDATE SET
        target.current_price = source.current_price,
        target.forward_pe    = source.forward_pe
WHEN NOT MATCHED BY TARGET THEN
    INSERT (_index, symbol, signal_date, current_price, forward_pe)
    VALUES (source._index, source.symbol, source.signal_date, source.current_price, source.forward_pe);

TRUNCATE TABLE stg.signals;

COMMIT;

SELECT symbol, signal_date,
       CAST(current_price AS decimal(10,4)) AS current_price,
       CAST(forward_pe    AS decimal(10,4)) AS forward_pe
FROM silver.signals_daily
WHERE symbol IN ('ASML.AS','MC.PA','SAP.DE','ALV.DE','SIE.DE','NEW.SYM')
  AND signal_date = (SELECT MAX(signal_date) FROM silver.signals_daily)
ORDER BY symbol;
```

| symbol | signal_date | current_price | forward_pe |
|---|---|---|---|
| ALV.DE | 2026-04-08 | 367.2000 | 10.9980 |
| ASML.AS | 2026-04-08 | 1124.9380 | 29.5217 |
| MC.PA | 2026-04-08 | 466.8500 | 17.5444 |
| NEW.SYM | 2026-04-08 | 999.9900 | 42.0000 |
| SAP.DE | 2026-04-08 | 145.2200 | 17.0514 |
| SIE.DE | 2026-04-08 | 210.0000 | 16.4837 |

Six rows in the target after the merge. The `ASML.AS` row carries `1124.9380` — the **newer** duplicate value, selected by `ROW_NUMBER() OVER (PARTITION BY symbol, signal_date ORDER BY load_ts DESC)` which sorts `load_ts` descending and keeps the newest row (`rn = 1`). The `NEW.SYM` row was inserted by the `WHEN NOT MATCHED BY TARGET` branch.

The final `TRUNCATE TABLE stg.signals` inside the transaction empties the staging table. If the `MERGE` or any subsequent step raises an error, the `XACT_ABORT ON` + `BEGIN TRAN` envelope rolls back the whole transaction including the truncate, so the staging rows remain available for a retry. This atomicity is the single most important property of the pattern — it is what makes the pipeline **resumable**. A failed load leaves the staging table unchanged and the next run can safely retry.

> [!tip] Always dedupe staging inside the MERGE, not before
>
> It is tempting to `DELETE` the duplicates out of the staging table before the `MERGE`. Do not — the deduplication should happen in the `MERGE`'s source query via a `ROW_NUMBER()` CTE. Reasons:
>
> - The staging table retains the full audit trail of every row that was loaded (useful for debugging "which source version won").
> - The dedup logic lives in the same statement as the merge, so the "tie-breaker" rule is visible in one place.
> - The transaction can still roll back cleanly if the `MERGE` fails, without leaving an intermediate "partially deduped staging" state.

## When Not to Use MERGE

`MERGE` is tempting because it collapses an upsert into one statement, but it is often not the right choice. Prefer the simpler alternatives when any of the following apply:

- **The logic is insert-only.** A plain `INSERT ... WHERE NOT EXISTS` is simpler, equally fast, and immune to most `MERGE` concurrency bugs.
- **The logic is update-only.** A plain `UPDATE ... FROM ... JOIN` with a `WHERE` predicate is clearer and easier to tune.
- **The workload has concurrent writers on the same business keys.** Prefer the `UPDATE + INSERT WHERE NOT EXISTS` pattern with `UPDLOCK, HOLDLOCK`. The known `MERGE` races make it unsafe as a default choice for OLTP upserts.
- **The source may contain duplicates on the business key and the dedup rule is non-trivial.** Separate statements make the dedup step explicit and debuggable.
- **Each action type requires different auditing.** Three separate statements can each write to a different audit table without the `$action` routing logic.
- **A trigger already handles part of the workflow.** `MERGE` fires all three trigger types in unspecified order, which is harder to reason about than a single-statement DML firing one trigger.
- **The target is a remote or linked-server table.** `MERGE` against remote tables can produce extremely poor plans — separate statements are both faster and more predictable.
- **The team is not experienced with `MERGE`.** Code that senior reviewers cannot quickly verify is a liability. The separate-statements pattern is readable by any T-SQL engineer without special knowledge.

`MERGE` is strongest when:

- the logic genuinely needs all three actions (INSERT / UPDATE / DELETE) in a single atomic statement
- the source is already deduplicated and the dedup step is trivial
- the workload is a single-writer batch load (no concurrency)
- the operational requirement for `$action`-routed auditing outweighs the complexity cost

## Decision Guide

A short checklist for choosing the right upsert pattern.

| Scenario | Recommended pattern | See subsection |
|---|---|---|
| Insert rows only if missing (no updates) | `INSERT ... WHERE NOT EXISTS` | `### INSERT WHERE NOT EXISTS` |
| Full upsert with separate transactions needed per action type | Explicit `UPDATE` + `INSERT ... WHERE NOT EXISTS` in one `BEGIN TRAN` | `### UPDATE then INSERT` |
| Periodic slice refresh (per-day reload, per-quarter rebuild) | `DELETE` + `INSERT ... SELECT` in one `BEGIN TRAN` | `### Delete-and-reinsert refresh` |
| Full upsert, single writer, batch load | `MERGE` with `WHEN MATCHED` + `WHEN NOT MATCHED BY TARGET` | `### Basic MERGE` |
| Differential update (skip no-op rewrites) | `MERGE` with `WHEN MATCHED AND col <> col` filter | `### WHEN MATCHED with a filter predicate` |
| Full mirror (source is authoritative, target must match exactly) | `MERGE` with all three clauses, `WHEN NOT MATCHED BY SOURCE` scoped | `### WHEN NOT MATCHED BY SOURCE` |
| Upsert with routed audit trail (INSERT / UPDATE / DELETE) | `MERGE` with `OUTPUT $action INTO dbo.audit_*` | `### MERGE with OUTPUT $action INTO ...` |
| Source has duplicate business keys | `ROW_NUMBER()` CTE then `MERGE` | `### Error 8672` / `### Dedupe with ROW_NUMBER` |
| Concurrent writers on the same business key (OLTP upsert) | `UPDATE + INSERT WHERE NOT EXISTS` with `WITH (UPDLOCK, HOLDLOCK)` | `### The safer alternative: UPDATE + INSERT` |
| Coarse mutual exclusion on a logical resource | `sp_getapplock` inside the transaction | `### sp_getapplock for coarse serialization` |
| SCD Type 1 (overwrite on change) | Single three-clause `MERGE` | `### SCD Type 1` |
| SCD Type 2 (effective-dated history) | Two-step `UPDATE` + `INSERT` pattern | `### SCD Type 2: the two-step pattern` |
| Bulk warehouse load from a staging table | `BULK INSERT` → `ROW_NUMBER()` dedupe → `MERGE` → `TRUNCATE` staging | `## Staging Table Upsert Pattern` |

## Cross-references

- [10-insert-update-delete-patterns](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/10-insert-update-delete-patterns) — the sibling note that owns basic `INSERT`, `UPDATE`, `DELETE`, the `OUTPUT` clause, composable DML, identity/SEQUENCE, transactions, `TRY/CATCH`, and Halloween protection.
- [03-joins-subqueries-and-apply](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/03-joins-subqueries-and-apply#anti-joins-and-semi-joins) — `EXISTS` and `NOT EXISTS` semantics used in the `WHERE NOT EXISTS` upsert pattern.
- [05-window-functions](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/05-window-functions) — `ROW_NUMBER()` for staging-table deduplication.
- [02-data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-sql-server/03-query-writing-and-optimization/02-data-types-conversion-and-null-handling) — `COLLATE DATABASE_DEFAULT` for cross-database string comparisons, `ISNULL`/`COALESCE` semantics used in `OUTPUT` projections.
- Concurrency chapter notes (`16-blocking-and-locking`, `17-deadlock-detection-and-prevention`, `18-race-conditions`) — lock compatibility theory, deadlock analysis, and full race-condition treatment for the MERGE concurrency issues described in the `## MERGE Concurrency` section.
