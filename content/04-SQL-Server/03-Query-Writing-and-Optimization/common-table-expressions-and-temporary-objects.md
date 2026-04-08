---
title: "Common Table Expressions and Temporary Objects"
tags: [sql, sql-server, tsql, cte, recursive-cte, temp-table, table-variable, tvp, derived-table]
aliases: [CTE reference, temp tables, table variables, TVPs, derived tables]
description: "T-SQL reference for common table expressions, recursive CTEs, derived tables, VALUES constructors, temp tables, table variables, and table-valued parameters."
parent: "[[domain-query-writing-and-optimization]]"
links:
  - "[[select-and-query-basics]]"
  - "[[joins-subqueries-and-apply]]"
  - "[[window-functions]]"
  - "[[stored-procedures-dynamic-sql-and-error-handling]]"
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# Common Table Expressions and Temporary Objects

This note covers the temporary and intermediate shapes you build inside T-SQL:

- derived tables
- `VALUES` constructors
- common table expressions
- recursive CTEs
- temporary tables
- table variables
- table-valued parameters

## Derived Tables and VALUES Constructors

### Derived table

A derived table is a subquery in the `FROM` clause.

```sql
SELECT
    x.symbol,
    x.avg_close
FROM
(
    SELECT
        symbol,
        AVG([close]) AS avg_close
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
) AS x
WHERE x.avg_close > 100;
```

Use a derived table when the intermediate result is needed only once and keeping the logic close to its consumer improves readability.

### VALUES constructor

`VALUES` is useful for inline rowsets, parameter tables, and small mappings.

```sql
SELECT *
FROM
(
    VALUES
        ('EU', 'Europe'),
        ('US', 'United States'),
        ('AS', 'Asia')
) AS x(region_code, region_name);
```

## Common Table Expressions

### WITH common_table_expression

A CTE names an intermediate result set for the next single statement.

```sql
;WITH latest_prices AS
(
    SELECT
        symbol,
        MAX([date]) AS latest_date
    FROM silver.eurostoxx50_ohlcv
    GROUP BY symbol
)
SELECT
    p.symbol,
    p.[date],
    p.[close]
FROM silver.eurostoxx50_ohlcv AS p
JOIN latest_prices AS l
    ON p.symbol = l.symbol
   AND p.[date] = l.latest_date;
```

CTE rules that matter:

- The statement before `WITH` must be terminated, or the CTE must start with `;WITH`.
- A CTE exists only for the immediately following statement.
- A CTE improves readability, not materialization. SQL Server may inline it.

### Multiple CTEs

You can chain several CTEs in one `WITH` block.

```sql
;WITH base AS
(
    SELECT symbol, [date], [close]
    FROM silver.eurostoxx50_ohlcv
),
latest AS
(
    SELECT symbol, MAX([date]) AS latest_date
    FROM base
    GROUP BY symbol
)
SELECT b.*
FROM base AS b
JOIN latest AS l
    ON b.symbol = l.symbol
   AND b.[date] = l.latest_date;
```

Use this when each CTE has a clear semantic role. If the chain becomes difficult to name or reason about, consider a temp table.

## Recursive CTE

### Recursive CTE syntax

Recursive CTEs are for hierarchical or iterative result construction.

```sql
;WITH dates AS
(
    SELECT CAST('2025-01-01' AS date) AS d
    UNION ALL
    SELECT DATEADD(DAY, 1, d)
    FROM dates
    WHERE d < '2025-01-07'
)
SELECT d
FROM dates
OPTION (MAXRECURSION 100);
```

Key rules:

- one anchor member
- one recursive member
- `UNION ALL` almost always, not `UNION`
- recursion stops when the recursive member returns no rows

### MAXRECURSION

`MAXRECURSION` protects the session from accidental infinite recursion.

- Default is 100.
- Use `OPTION (MAXRECURSION n)` when a legitimate depth is greater than 100.
- `MAXRECURSION 0` means no enforced limit; use cautiously.

## Temporary Tables

### Local temp tables `#temp`

Local temp tables live in `tempdb` and are scoped to the session.

```sql
CREATE TABLE #latest_prices
(
    symbol varchar(50) NOT NULL,
    latest_date date NOT NULL,
    PRIMARY KEY (symbol)
);

INSERT INTO #latest_prices (symbol, latest_date)
SELECT
    symbol,
    MAX([date])
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;

SELECT *
FROM #latest_prices;
```

Use temp tables when:

- the intermediate result is reused several times
- row counts are large enough that statistics matter
- indexing the intermediate result helps the next step

### Global temp tables `##temp`

Global temp tables are visible to all sessions while they exist. They are rarely the right default in application code and are mainly useful for controlled DBA or orchestration scenarios.

## Table Variables

### DECLARE @table

Table variables are scoped like variables, not like normal tables.

```sql
DECLARE @latest_prices TABLE
(
    symbol varchar(50) PRIMARY KEY,
    latest_date date NOT NULL
);

INSERT INTO @latest_prices (symbol, latest_date)
SELECT
    symbol,
    MAX([date])
FROM silver.eurostoxx50_ohlcv
GROUP BY symbol;
```

Production guidance:

- Table variables are convenient for small rowsets.
- They are not a universal replacement for temp tables.
- For nontrivial row counts or joins, temp tables are usually easier to reason about and optimize.

## Temp Tables vs Table Variables

| Pattern | Prefer | Why |
|---|---|---|
| Small, short-lived parameter-like rowset | Table variable | Light syntax, simple scope |
| Large intermediate ETL step | Temp table | Better indexing and optimizer behavior |
| Intermediate result reused multiple times | Temp table | Easier to inspect, index, and reuse |
| Stored procedure input list from app code | TVP | Clean contract from caller to procedure |

## Table-Valued Parameters

### User-defined table type and READONLY parameter

TVPs let a caller pass a rowset into a procedure.

```sql
CREATE TYPE dbo.SymbolList AS TABLE
(
    symbol varchar(50) PRIMARY KEY
);
GO

CREATE OR ALTER PROCEDURE dbo.usp_get_latest_prices
    @symbols dbo.SymbolList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.symbol,
        p.[date],
        p.[close]
    FROM silver.eurostoxx50_ohlcv AS p
    JOIN @symbols AS s
        ON p.symbol = s.symbol;
END;
GO
```

TVP rules:

- TVPs must use a user-defined table type.
- TVP parameters are `READONLY`.
- They are excellent for batching IDs, codes, or small-to-medium caller-supplied rowsets.

## Practical Guidance

- Use a CTE to make one statement clearer.
- Use a temp table when the intermediate result has operational weight.
- Use table variables for small scoped rowsets, not as a blanket ETL pattern.
- Use recursive CTEs for true hierarchy/recursion problems, not as a generic sequence generator when a calendar table already exists.
- Start the first CTE with `;WITH` when there is any ambiguity about statement termination.

## Related

- [[select-and-query-basics]]
- [[joins-subqueries-and-apply]]
- [[window-functions]]
- [[stored-procedures-dynamic-sql-and-error-handling]]

