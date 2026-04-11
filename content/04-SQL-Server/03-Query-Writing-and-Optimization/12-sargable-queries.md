---
title: "11 - SARGable Queries"
tags: [sql, sql-server, tsql, sargable, predicates, implicit-conversion, index-seek, where-clause]
aliases: [SARGable, search argument, index seek, non-sargable, predicate]
description: "T-SQL reference for writing SARGable predicates in SQL Server: bare-column comparisons, date-range rewrites, prefix searches, implicit conversion traps, and computed-column or filtered-index escape hatches."
created: 2026-03-22
updated: 2026-04-08
status: complete
---

# SARGable Queries

SARGability is a query-writing property, not an index-maintenance feature and not an execution-plan workflow.

A predicate is SARGable when SQL Server can use the indexed key values directly to navigate to the relevant rows instead of scanning and evaluating an expression row by row.

## What Makes A Predicate SARGable

### Bare-column comparisons

The core rule is simple:

- keep the column exposed
- move transformation to the literal, parameter, or boundary value side

Good:

```sql
WHERE trade_date >= '2025-01-01'
  AND trade_date < '2026-01-01'
```

Bad:

```sql
WHERE YEAR(trade_date) = 2025
```

## Common Non-SARGable Patterns

### Functions on columns

| Non-SARGable | SARGable rewrite |
|---|---|
| `WHERE YEAR(trade_date) = 2025` | `WHERE trade_date >= '2025-01-01' AND trade_date < '2026-01-01'` |
| `WHERE LEFT(symbol, 3) = 'ASM'` | `WHERE symbol LIKE 'ASM%'` |
| `WHERE CAST(event_time AS date) = @d` | `WHERE event_time >= @d AND event_time < DATEADD(DAY, 1, @d)` |

### Arithmetic on columns

| Non-SARGable | SARGable rewrite |
|---|---|
| `WHERE price * 1.2 > 100` | `WHERE price > 100 / 1.2` |
| `WHERE DATEDIFF(DAY, trade_date, SYSUTCDATETIME()) <= 7` | `WHERE trade_date >= DATEADD(DAY, -7, SYSUTCDATETIME())` |

### Implicit conversions

Implicit conversions often break SARGability silently.

Examples:

- `nvarchar` parameter against `varchar` column
- string comparison against numeric column
- mismatched collations or text types in joins

Practical rule:

- Match parameter types to column types.
- Convert the parameter or literal, not the indexed column.

### Leading wildcard LIKE

| Pattern | Usually SARGable? |
|---|---|
| `LIKE 'ABC%'` | Yes |
| `LIKE '%ABC'` | No |
| `LIKE '%ABC%'` | No |

### Composite index left-prefix rule

For an index like `(symbol, trade_date, source_id)`:

- predicates on `symbol` can seek
- predicates on `symbol` + `trade_date` can seek deeper
- a predicate on `trade_date` alone cannot use the full composite seek path

SARGability is not just about one predicate. It is also about whether the predicate aligns with key order.

## Date-Range Rewrites

### Safe date equality against datetime columns

Avoid:

```sql
WHERE CAST(event_time AS date) = @d
```

Prefer:

```sql
WHERE event_time >= @d
  AND event_time < DATEADD(DAY, 1, @d)
```

### Rolling windows

Avoid:

```sql
WHERE DATEDIFF(DAY, event_time, SYSUTCDATETIME()) <= 30
```

Prefer:

```sql
WHERE event_time >= DATEADD(DAY, -30, SYSUTCDATETIME())
```

## Prefix Search Rewrites

Avoid:

```sql
WHERE LEFT(symbol, 4) = 'ASML'
```

Prefer:

```sql
WHERE symbol LIKE 'ASML%'
```

This is one of the most common production rewrites because it preserves prefix seekability.

## When You Cannot Rewrite The Query

### Computed columns

If a third-party query insists on `LEFT(symbol, 4)`, a persisted computed column indexed on that expression may be the only realistic fix.

### Filtered indexes

If the query always targets a narrow subset such as `is_current = 1`, a filtered index can reduce work even when the broader table is much larger.

Use these as controlled design responses, not as excuses to keep writing weak predicates.

## Review Checklist

Before calling a predicate "done," check:

- Is the indexed column wrapped in a function?
- Is arithmetic being applied to the indexed column?
- Is the parameter type exactly compatible with the column type?
- Is a prefix `LIKE` possible instead of a substring search?
- Does the predicate align with the leftmost keys of the relevant index?
- Is the date logic written as a half-open range?

## Scope Boundary

This note owns predicate-writing patterns.

It does not own:

- execution-plan capture
- plan-cache mining
- wait-stats analysis
- parameter-sniffing remediation workflows

Those topics belong in the Execution Plans and Query Store notes, and the Performance folder.


