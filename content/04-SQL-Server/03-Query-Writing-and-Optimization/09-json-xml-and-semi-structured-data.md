---
title: "09 - JSON, XML, and Semi-Structured Data"
tags: [sql, sql-server, tsql, json, xml, openjson, json-value, xml-nodes, semi-structured-data]
aliases: [OPENJSON, JSON_VALUE, JSON_QUERY, XML methods, nodes value query exist]
description: "T-SQL reference for SQL Server JSON and XML handling, including ISJSON, JSON_VALUE, JSON_QUERY, JSON_MODIFY, OPENJSON, FOR JSON, xml methods such as nodes(), value(), query(), exist(), and modify()."
created: 2026-04-08
updated: 2026-04-08
status: complete
---

# JSON, XML, and Semi-Structured Data

SQL Server supports semi-structured data in two different ways:

- JSON functions over `varchar(max)` or `nvarchar(max)` text
- a native `xml` data type with XQuery methods

These are useful for ingestion boundaries, flexible payloads, and interoperability. They are not a license to abandon relational modeling.

## JSON_VALUE, JSON_QUERY, JSON_MODIFY, and ISJSON

### ISJSON

Use `ISJSON` to validate whether text is valid JSON.

```sql
SELECT ISJSON(payload_json) AS is_valid_json
FROM staging.raw_events;
```

### JSON_VALUE and JSON_QUERY

- `JSON_VALUE` extracts a scalar value.
- `JSON_QUERY` extracts an object or array.

```sql
SELECT
    JSON_VALUE(payload_json, '$.symbol') AS symbol,
    JSON_QUERY(payload_json, '$.constituents') AS constituents_json
FROM staging.raw_events;
```

### JSON_MODIFY

`JSON_MODIFY` updates JSON text.

```sql
SELECT JSON_MODIFY(payload_json, '$.status', 'processed')
FROM staging.raw_events;
```

Use it for targeted transformations, not for high-churn OLTP updates that would be better modeled relationally.

## OPENJSON

### OPENJSON default schema

`OPENJSON` can shred JSON into rows.

```sql
DECLARE @json nvarchar(max) = N'[
  {"symbol":"SX5E","region":"EU"},
  {"symbol":"SPX","region":"US"}
]';

SELECT *
FROM OPENJSON(@json);
```

The default schema returns generic columns such as key, value, and type.

### OPENJSON WITH explicit schema

Use the `WITH` clause for production parsing.

```sql
DECLARE @json nvarchar(max) = N'[
  {"symbol":"SX5E","region":"EU"},
  {"symbol":"SPX","region":"US"}
]';

SELECT
    symbol,
    region
FROM OPENJSON(@json)
WITH
(
    symbol varchar(50) '$.symbol',
    region varchar(10) '$.region'
);
```

This is clearer, typed, and easier to integrate into joins and inserts.

## FOR JSON PATH and FOR JSON AUTO

### FOR JSON PATH

Use `FOR JSON PATH` when you need controlled JSON output.

```sql
SELECT
    symbol,
    [date],
    [close]
FROM silver.eurostoxx50_ohlcv
WHERE symbol = 'ASML.AS'
FOR JSON PATH;
```

`PATH` is the more deliberate and usually preferable mode.

### FOR JSON AUTO

`AUTO` derives structure from the query shape. It can be useful for quick output, but `PATH` is typically more predictable in APIs and integration code.

## XML Data Type and XQuery Methods

### nodes(), value(), query(), exist(), and modify()

SQL Server XML uses methods on the `xml` data type.

```sql
SELECT
    payload_xml.value('(/root/symbol/text())[1]', 'varchar(50)') AS symbol
FROM staging.raw_xml_events;
```

Common methods:

| Method | Use |
|---|---|
| `nodes()` | Shred repeating nodes into rows |
| `value()` | Extract one scalar value |
| `query()` | Return XML fragments |
| `exist()` | Test whether a path exists |
| `modify()` | Update XML |

### XML shredding pattern

```sql
SELECT
    x.n.value('(symbol/text())[1]', 'varchar(50)') AS symbol,
    x.n.value('(weight/text())[1]', 'decimal(10,4)') AS weight
FROM staging.raw_xml_events AS r
CROSS APPLY r.payload_xml.nodes('/constituents/constituent') AS x(n);
```

## JSON vs XML

| Aspect | JSON | XML |
|---|---|---|
| SQL Server storage model | Text plus JSON functions | Native `xml` type |
| Typical use | App payloads, APIs, lightweight documents | Rich structured documents, typed XML workflows |
| Query model | Path functions and OPENJSON | XQuery methods |
| Indexing strategy | Often computed columns + normal indexes | XML indexes when justified |

Practical rule:

- Choose JSON for modern API-style payloads and lightweight document extraction.
- Choose XML when the upstream contract is XML or when XQuery features are required.

## Practical Guidance

- Validate JSON before trusting it.
- Use `OPENJSON ... WITH` instead of the default schema for production pipelines.
- Use computed columns plus ordinary indexes for frequently accessed JSON properties.
- Use XML methods deliberately; `nodes()` + `value()` is the most common shredding pattern.
- Keep semi-structured payloads at the boundary when the data has a stable relational shape.


