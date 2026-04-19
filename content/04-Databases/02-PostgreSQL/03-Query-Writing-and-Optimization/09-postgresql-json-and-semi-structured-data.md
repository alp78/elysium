---
title: "09 - JSON and Semi-Structured Data"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL jsonb
  - PostgreSQL semi-structured data
  - PostgreSQL xpath
  - PostgreSQL GIN jsonb
description: "PostgreSQL reference for json and jsonb, JSONB extraction and mutation, shredding documents into rows, JSONB indexing, XML extraction with xpath, and practical guidance for semi-structured storage."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[08-postgresql-date-and-time-functions]]"
  - "[[10-postgresql-insert-update-delete-patterns]]"
status: complete
---

# JSON and Semi-Structured Data

PostgreSQL has a much stronger native JSON story than SQL Server's pre-2025 text-plus-functions model. `json` and `jsonb` are real data types, `jsonb` is indexable, and the operator surface is broad enough that most app-facing semi-structured work stays inside JSONB. PostgreSQL also has an `xml` type and XPath support, but XML is a secondary surface here: it is useful for contracts that are already XML-shaped, not the default choice for new operational designs.

> [!abstract] Scope
>
> This note mirrors the SQL Server semi-structured track with PostgreSQL equivalents. It covers `json` versus `jsonb`, JSONB extraction and mutation, row shredding, JSONB indexing, XML extraction, and generation of JSON or XML output from relational rows.
>
> - **Decision model** covers when JSONB is the default, when plain `json` is justified, and when XML still has a role.
> - **JSONB read and write patterns** cover extraction operators, containment, existence, and `jsonb_set`.
> - **JSONB shredding and indexing** cover `jsonb_to_recordset`, `jsonb_array_elements`, and `GIN` indexes.
> - **XML support** covers `xmlparse`, `xpath`, and row expansion from XML fragments.
> - **Output generation** covers `jsonb_build_object`, `jsonb_agg`, and `xmlelement` or `xmlforest`.

## Decision Model

Semi-structured storage is justified at the ingestion boundary or when the payload really is document-shaped. If the shape is stable and queried heavily, relational columns are still cheaper and easier to index than repeated document parsing.

### Prefer `jsonb` unless exact text preservation matters

In PostgreSQL, `jsonb` is usually the default because it is binary-normalized, operator-rich, and index-friendly. Plain `json` is mainly for cases where exact input formatting, key order, or duplicate-key preservation matters more than indexing and structural operators.

## JSONB Reading and Writing

JSONB work typically starts by building or receiving a document, then extracting scalars or fragments, then testing or mutating selected paths.

### Build, extract, test, and modify document paths

The core operator family is compact: `->` and `->>` for field access, `#>` and `#>>` for nested paths, `?` for key existence, `@>` for containment, and `jsonb_set` for targeted mutation.

#### Build JSONB objects directly from relational rows

Use this pattern when a query needs document-shaped output but the source data is relational. It is typically triggered by API payload generation, event emission, and debug snapshots. The query is read-only. Its purpose is to show the PostgreSQL-native JSON constructor surface on live warehouse rows.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Source row key used for ordering and display. |
| `payload` | `jsonb_build_object(...)` | jsonb | JSONB document constructed from relational columns. |

*This query emits the top three latest Euro Stoxx 50 rows as compact JSONB documents.*

```sql
SELECT
    symbol,
    jsonb_build_object(
        'symbol', symbol,
        'country', country,
        'current_price', current_price,
        'composite_score', ROUND(composite_score::numeric, 4)
    ) AS payload
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'euro_stoxx_50'
ORDER BY composite_rank
LIMIT 3;
```

| symbol | payload |
|---|---|
| BNP.PA | {"symbol": "BNP.PA", "country": "France", "current_price": 83.72, "composite_score": 0.5967} |
| TTE.PA | {"symbol": "TTE.PA", "country": "France", "current_price": 79.26, "composite_score": 0.4954} |
| ENI.MI | {"symbol": "ENI.MI", "country": "Italy", "current_price": 24.885, "composite_score": 0.4807} |

This is the common output-building pattern in PostgreSQL: build JSON at the edge from strongly typed relational values, rather than storing documents prematurely just to reshape them later.

#### Extract scalars and nested values from JSONB

Use this pattern when a query needs a few scalar values from a nested document without shredding the whole payload. It is typically triggered by lightweight document inspection and path-based projection. The query is read-only. Its purpose is to show the basic JSONB extraction operators.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `index_key` | `payload ->> 'index'` | text | Scalar text value from a top-level JSON key. |
| `as_of_text` | `payload ->> 'as_of'` | text | Scalar string value from a top-level key. |
| `first_symbol` | `payload #>> '{top_symbols,0,symbol}'` | text | Scalar string from a nested array element. |
| `second_score` | `payload #>> '{top_symbols,1,score}'` | text | Scalar nested value rendered as text. |

*This query reads both top-level keys and nested array elements from one JSONB document.*

```sql
WITH doc AS (
    SELECT '{"index":"euro_stoxx_50","as_of":"2026-04-08","top_symbols":[{"symbol":"BNP.PA","score":0.5967},{"symbol":"TTE.PA","score":0.4954}]}'::jsonb AS payload
)
SELECT
    payload ->> 'index' AS index_key,
    payload ->> 'as_of' AS as_of_text,
    payload #>> '{top_symbols,0,symbol}' AS first_symbol,
    payload #>> '{top_symbols,1,score}' AS second_score
FROM doc;
```

| index_key | as_of_text | first_symbol | second_score |
|---|---|---|---|
| euro_stoxx_50 | 2026-04-08 | BNP.PA | 0.4954 |

The `->>` and `#>>` forms return text, which is usually what projection queries need. Use `->` or `#>` instead when the result should stay JSONB.

#### Test key existence and structural containment

Use this pattern when the question is about document shape rather than scalar extraction. It is typically triggered by document validation, feature-flag checks, and tag membership queries. The query is read-only. Its purpose is to show the existence and containment operators that make JSONB practical for structural predicates.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `has_symbol_key` | `payload ? 'symbol'` | boolean | Whether the top-level key exists. |
| `contains_value_tag` | `payload @> '{"tags":["value"]}'::jsonb` | boolean | Whether the document contains the requested subdocument. |
| `contains_quality_tag` | containment test | boolean | Whether the requested tag is absent or present. |

*This query checks JSONB key existence and tag containment directly in the document structure.*

```sql
WITH doc AS (
    SELECT '{"symbol":"BNP.PA","tags":["value","momentum"]}'::jsonb AS payload
)
SELECT
    payload ? 'symbol' AS has_symbol_key,
    payload @> '{"tags":["value"]}'::jsonb AS contains_value_tag,
    payload @> '{"tags":["quality"]}'::jsonb AS contains_quality_tag
FROM doc;
```

| has_symbol_key | contains_value_tag | contains_quality_tag |
|---|---|---|
| true | true | false |

This is one of the biggest JSONB advantages over plain text JSON: document-shape predicates are first-class operators rather than string parsing tricks.

#### Modify a nested value with `jsonb_set`

Use `jsonb_set` when one path inside a JSONB document needs to change while the rest of the document stays intact. It is typically triggered by enrichment, patching, and document-stage transformations. The query is read-only here because it updates an inline value, not a table row. Its purpose is to show path-targeted JSONB mutation.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `original_doc` | JSONB literal | jsonb | Original source document before the path update. |
| `updated_doc` | `jsonb_set(...)` result | jsonb | Document after the nested score field has been replaced. |

*This query updates one nested metric value without rebuilding the whole document manually.*

```sql
WITH doc AS (
    SELECT '{"symbol":"BNP.PA","metrics":{"score":0.5967,"rank":1}}'::jsonb AS payload
)
SELECT
    payload AS original_doc,
    jsonb_set(payload, '{metrics,score}', to_jsonb(0.7000::numeric), false) AS updated_doc
FROM doc;
```

| original_doc | updated_doc |
|---|---|
| {"symbol": "BNP.PA", "metrics": {"rank": 1, "score": 0.5967}} | {"symbol": "BNP.PA", "metrics": {"rank": 1, "score": 0.7000}} |

`jsonb_set` is the direct PostgreSQL equivalent of "surgically replace one path." It avoids brittle text replacement and keeps the result structurally valid JSONB.

## JSONB Shredding and Indexing

Documents become operational SQL only when the query can turn arrays and objects into rows and columns, and when hot predicates have an index strategy instead of repeated full-document scans.

### Turn arrays into rowsets, then index the structural predicates

For stable document arrays, `jsonb_to_recordset` gives typed rows. For hot containment searches, `GIN` is the default JSONB index family.

#### Shred an array of objects into typed rows

Use this pattern when a JSONB array needs to participate in normal relational joins, filters, or aggregates. It is typically triggered by ingest-boundary shredding and analytics over nested arrays. The query is read-only. Its purpose is to show PostgreSQL's typed JSONB-to-rows function.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `jsonb_to_recordset` output | text | Symbol extracted from each array object. |
| `score` | `jsonb_to_recordset` output | numeric | Numeric score extracted from each array object. |

*This query converts a JSONB array of objects into a relational two-column rowset.*

```sql
WITH doc AS (
    SELECT '[{"symbol":"BNP.PA","score":0.5967},{"symbol":"TTE.PA","score":0.4954},{"symbol":"ENI.MI","score":0.4807}]'::jsonb AS arr
)
SELECT *
FROM jsonb_to_recordset((SELECT arr FROM doc)) AS x(symbol text, score numeric);
```

| symbol | score |
|---|---:|
| BNP.PA | 0.5967 |
| TTE.PA | 0.4954 |
| ENI.MI | 0.4807 |

This is the PostgreSQL analogue to SQL Server's explicit-schema `OPENJSON`: declare the output columns and types up front, then let the function emit typed rows.

#### Index JSONB containment with `GIN`

Use `GIN` when a JSONB column is queried repeatedly with containment or existence predicates. It is typically triggered by document-tag lookups, event routing, and metadata filters. The script is state-changing inside a transaction and rolls back at the end. Its purpose is to show the baseline JSONB index family in PostgreSQL.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `indexname` | `pg_indexes.indexname` | text | Name of the JSONB `GIN` index created for the temp table. |
| `id` | temp table row id | integer | Identifier of the demo document that matched the containment predicate. |
| `symbol` | `payload ->> 'symbol'` | text | Symbol extracted from the matching JSONB document. |

*This transaction creates a temp JSONB table, adds a `GIN` index, proves the index exists in the temp schema, and then runs a containment predicate.*

```sql
BEGIN;

CREATE TEMP TABLE note09_jsonb_demo (
    id integer,
    payload jsonb
) ON COMMIT DROP;

INSERT INTO note09_jsonb_demo VALUES
    (1, '{"symbol":"BNP.PA","tags":["value","bank"]}'::jsonb),
    (2, '{"symbol":"TTE.PA","tags":["energy","momentum"]}'::jsonb),
    (3, '{"symbol":"MU","tags":["tech","value"]}'::jsonb);

CREATE INDEX note09_jsonb_demo_payload_gin
    ON note09_jsonb_demo
    USING gin (payload jsonb_path_ops);

SELECT indexname
FROM pg_indexes
WHERE schemaname LIKE 'pg_temp%'
  AND tablename = 'note09_jsonb_demo'
ORDER BY indexname;

SELECT
    id,
    payload ->> 'symbol' AS symbol
FROM note09_jsonb_demo
WHERE payload @> '{"tags":["value"]}'::jsonb
ORDER BY id;

ROLLBACK;
```

```text
BEGIN
CREATE TABLE
INSERT 0 3
CREATE INDEX
```

| indexname |
|---|
| note09_jsonb_demo_payload_gin |

| id | symbol |
|---:|---|
| 1 | BNP.PA |
| 3 | MU |

```text
ROLLBACK
```

The teaching boundary is the index family, not the tiny rowset. In production, `GIN` is the default answer for broad JSONB containment and existence queries, while scalar-path hot spots often deserve expression indexes on extracted values.

## XML Support

PostgreSQL's XML surface is real but smaller than its JSONB surface. Use it when the upstream contract is XML or XPath semantics are the natural fit. Unlike SQL Server, PostgreSQL does not have a parallel family of dedicated XML indexes in core; the normal approach is to shred XML into relational form or index extracted scalar expressions.

### Extract values and rows with XPath

The XML workflow is usually: parse or store XML, extract scalar fragments with `xpath`, and unnest repeating nodes when rows are needed.

#### Extract scalar values from an XML document

Use this pattern when a query needs only a few scalar values from one XML document. It is typically triggered by contract inspection and targeted attribute reads. The query is read-only. Its purpose is to show the minimal XPath extraction path in PostgreSQL.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol_attr` | `xpath('/quote/@symbol', payload)` | text | Symbol attribute extracted from the XML element. |
| `country_text` | `xpath('/quote/country/text()', payload)` | text | Country element text extracted from the XML document. |
| `score_text` | `xpath('/quote/score/text()', payload)` | text | Score element text extracted from the XML document. |

*This query extracts one attribute and two element values from an XML document literal.*

```sql
WITH doc AS (
    SELECT xmlparse(document '<quote symbol="BNP.PA"><country>France</country><score>0.5967</score></quote>') AS payload
)
SELECT
    (xpath('/quote/@symbol', payload))[1]::text AS symbol_attr,
    (xpath('/quote/country/text()', payload))[1]::text AS country_text,
    (xpath('/quote/score/text()', payload))[1]::text AS score_text
FROM doc;
```

| symbol_attr | country_text | score_text |
|---|---|---|
| BNP.PA | France | 0.5967 |

The result comes back as XML nodes first, which is why the query selects the first match and casts it to text. That is the main PostgreSQL XML extraction idiom.

#### Unnest repeated XML nodes into rows

Use this pattern when an XML document contains a repeating collection that must be processed relationally. It is typically triggered by batch ingest, nested payload shredding, and downstream joins. The query is read-only. Its purpose is to show the XML analogue to JSON array shredding.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `xpath('/item/@symbol', node)` | text | Symbol attribute extracted from each XML node. |
| `score` | `xpath('/item/@score', node)` | text | Score attribute extracted from each XML node. |

*This query turns an XML collection of `<item>` elements into one row per item.*

```sql
WITH doc AS (
    SELECT xmlparse(document '<top_symbols><item symbol="BNP.PA" score="0.5967"/><item symbol="TTE.PA" score="0.4954"/><item symbol="ENI.MI" score="0.4807"/></top_symbols>') AS payload
)
SELECT
    array_to_string(xpath('/item/@symbol', x.node)::text[], '') AS symbol,
    array_to_string(xpath('/item/@score', x.node)::text[], '') AS score
FROM doc
CROSS JOIN LATERAL unnest(xpath('/top_symbols/item', payload)) AS x(node);
```

| symbol | score |
|---|---|
| BNP.PA | 0.5967 |
| TTE.PA | 0.4954 |
| ENI.MI | 0.4807 |

The pattern is the same as every semi-structured shred: expand the repeating nodes first, then project typed columns from each node.

## Building Semi-Structured Output

Semi-structured support is not only about reading documents. PostgreSQL also builds JSON and XML cleanly from relational rows, which is often the right boundary for exports and API responses.

### Emit JSONB or XML from relational rows at the edge

The cleanest architecture is usually relational storage plus semi-structured output generation only where a consumer actually needs it.

#### Build XML output with `xmlelement` and `xmlforest`

Use this pattern when a query must emit an XML fragment from relational values without storing the payload as XML first. It is typically triggered by export interfaces and contract-bound integrations. The query is read-only. Its purpose is to show PostgreSQL's direct XML output builders.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `xml_payload` | `xmlelement(... xmlforest(...))` | xml | XML fragment emitted from one relational row. |

*This query renders the top-ranked Euro Stoxx 50 row as a small XML fragment.*

```sql
SELECT
    xmlelement(
        NAME top_symbol,
        xmlforest(symbol AS symbol, country AS country, current_price AS current_price)
    ) AS xml_payload
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND _index = 'euro_stoxx_50'
ORDER BY composite_rank
LIMIT 1;
```

| xml_payload |
|---|
| <top_symbol><symbol>BNP.PA</symbol><country>France</country><current_price>83.72</current_price></top_symbol> |

The point is the boundary choice: relational input, XML output only where needed. That is usually cheaper and more maintainable than storing XML in the core warehouse unless XML is the natural ingestion format.

## Practical Rules

Choose the semi-structured surface that matches the operational requirement instead of translating SQL Server document features literally.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| General-purpose app-facing document storage | `jsonb` | Binary-normalized, rich operator surface, index-friendly. |
| Preserve exact input text or key order | `json` | Retains input text semantics at the cost of weaker indexing. |
| Extract a few scalar values | `->>`, `#>>` | Fast path-based JSONB scalar extraction. |
| Test document shape | `?`, `@>` | First-class existence and containment operators. |
| Patch a nested JSON value | `jsonb_set` | Targeted document mutation without text surgery. |
| Shred JSON arrays into rows | `jsonb_to_recordset`, `jsonb_array_elements` | Typed relational expansion from document arrays. |
| Accelerate broad JSONB containment queries | `GIN` on `jsonb` | Default JSONB index family. |
| Work with XML contracts | `xmlparse`, `xpath`, `xmlelement` | PostgreSQL XML surface for XPath-based reads and XML output. |
| Index hot XML lookups | Functional indexes on extracted values or relational shredding | Core PostgreSQL has no SQL Server-style XML index family. |
