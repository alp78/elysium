---
title: "07 - String Functions and Pattern Matching"
tags:
  - postgresql
  - query-optimization
  - sql
aliases:
  - PostgreSQL text functions
  - PostgreSQL LIKE and regex
  - PostgreSQL string_agg
  - PostgreSQL quote_ident
description: "PostgreSQL reference for text storage semantics, length functions, concatenation, extraction and substitution, pattern matching, regex handling, splitting, and identifier-safe string construction."
parent: "[[domain-postgresql-query-writing-and-optimization]]"
links:
  - "[[06-postgresql-numeric-and-aggregate-functions]]"
  - "[[08-postgresql-date-and-time-functions]]"
status: complete
---

# String Functions and Pattern Matching

String work in PostgreSQL is mostly about text semantics, not type-family gymnastics. PostgreSQL stores text according to the database encoding, so Unicode handling is built into `text` and `varchar`; there is no separate `nvarchar` family. The practical concerns are length in characters versus bytes, safe concatenation, parsing and normalization, and choosing between exact, wildcard, and regex-style matching.

> [!abstract] Scope
>
> This note mirrors the SQL Server string-function track with PostgreSQL equivalents. It covers text length semantics, concatenation and aggregation, extraction and substitution, wildcard and regex matching, splitting, and identifier-safe quoting.
>
> - **Text storage and length** cover `text`, `varchar`, `char`, `char_length`, and `octet_length`.
> - **Concatenation and aggregation** cover `concat_ws` and `string_agg`.
> - **Extraction and substitution** cover `split_part`, `replace`, `translate`, trimming, and case normalization.
> - **Pattern matching** covers `LIKE`, regex operators, and substring-position functions.
> - **Splitting and identifier safety** cover `string_to_array`, `unnest`, `quote_ident`, `quote_literal`, and `format`.

## Text Length and Storage Semantics

PostgreSQL's most important text boundary is not Unicode versus non-Unicode types. It is characters versus bytes. In UTF-8 databases, one human-readable character can consume more than one byte.

### Characters are not the same thing as bytes

`length(...)` and `char_length(...)` count characters. `octet_length(...)` counts bytes. That difference matters whenever multibyte characters are present.

#### Distinguish character count from byte count

Use this pattern when the query needs to audit text width, encoding footprint, or buffer size rather than visible character count alone. It is typically triggered by storage analysis and ingest validation. The query is read-only. Its purpose is to show the multibyte boundary directly on a live PostgreSQL string.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `sample_text` | string literal | text | Demonstration value containing a multibyte character. |
| `char_length` | `char_length(...)` | integer | Number of characters in the string. |
| `octet_length` | `octet_length(...)` | integer | Number of bytes used by the UTF-8 encoded string. |
| `length_alias` | `length(...)` | integer | PostgreSQL alias for character length on text input. |

*This query shows that `München` occupies seven characters but eight bytes in UTF-8.*

```sql
SELECT
    'München' AS sample_text,
    char_length('München') AS char_length,
    octet_length('München') AS octet_length,
    length('München') AS length_alias;
```

| sample_text | char_length | octet_length | length_alias |
|---|---:|---:|---:|
| München | 7 | 8 | 7 |

The umlauted `ü` is one character but two bytes in UTF-8, which is why the byte count is larger than the visible character count. That is the core measurement difference to keep in mind in PostgreSQL text work.

## Concatenation and Text Aggregation

Concatenation is safer and clearer when null handling and separator handling are explicit. PostgreSQL provides dedicated functions for both pairwise concatenation and rowset aggregation.

### Build labels and lists without manual separator logic

`concat_ws` is the easiest way to join several nullable text fragments with a separator. `string_agg` is the standard aggregate for turning many rows into one delimited string.

#### Use `string_agg` to turn grouped rows into one ordered list

Use `string_agg` when grouped output needs a report-style list of row values rather than one row per item. It is typically triggered by dashboards, audit summaries, and compact group labels. The query is read-only. Its purpose is to show ordered text aggregation on the live scoring tables.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `_index` | grouped `_index` key | varchar | Index whose top symbols are being aggregated. |
| `top_symbols` | `string_agg(symbol, ', ' ORDER BY composite_rank)` | text | Ordered comma-separated list of symbols within the group. |

*This query aggregates the top-three ranked symbols for two indexes into ordered label strings.*

```sql
SELECT
    _index,
    string_agg(symbol, ', ' ORDER BY composite_rank) AS top_symbols
FROM (
    SELECT
        _index,
        symbol,
        composite_rank
    FROM gold.scores_daily
    WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
      AND composite_rank <= 3
      AND _index IN ('euro_stoxx_50', 'stoxx_usa_50')
) AS q
GROUP BY _index
ORDER BY _index;
```

| _index | top_symbols |
|---|---|
| euro_stoxx_50 | BNP.PA, TTE.PA, ENI.MI |
| stoxx_usa_50 | MU, AMD, AVGO |

The `ORDER BY` inside `string_agg` is what makes the output deterministic. Without it, the concatenation order is not guaranteed.

#### Use `concat_ws` to build readable labels while skipping nulls

Use `concat_ws` when multiple text fragments should be joined with a separator and nullable fields should not create doubled or dangling delimiters. It is typically triggered by display labels, export formatting, and compact descriptive strings. The query is read-only. Its purpose is to show PostgreSQL's null-skipping concatenation pattern.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol row being formatted. |
| `display_label` | `concat_ws(' | ', short_name, country, currency)` | text | Composite label built from three text columns. |

*This query builds display-friendly labels from short name, country, and currency.*

```sql
SELECT
    symbol,
    concat_ws(' | ', short_name, country, currency) AS display_label
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND symbol IN ('ASML.AS', 'BNP.PA', 'TTE.PA')
ORDER BY symbol;
```

| symbol | display_label |
|---|---|
| ASML.AS | ASML HOLDING \| Netherlands \| EUR |
| BNP.PA | BNP PARIBAS ACT.A \| France \| EUR |
| TTE.PA | TOTALENERGIES \| France \| EUR |

This is safer than manual `||` chains when some inputs may be null, because `concat_ws` omits null arguments and separator clutter automatically.

## Extraction and Substitution

Text parsing in PostgreSQL is often cleaner than it looks because the core function set is small and composable: split by delimiter, replace or translate characters, trim unwanted edges, then normalize case.

### Parse structured text and normalize it deliberately

The main practical cases are ticker parsing, label cleanup, and lightweight canonicalization before matching or display.

#### Parse a dot-delimited ticker with `split_part`

Use `split_part` when the text format is delimiter-based and the position of each token is stable. It is typically triggered by ticker parsing, file-name decomposition, and dotted identifiers. The query is read-only. Its purpose is to show the simplest PostgreSQL parsing pattern for exchange-suffixed symbols.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Original ticker symbol. |
| `symbol_root` | `split_part(symbol, '.', 1)` | text | Root symbol before the first dot. |
| `exchange_suffix` | `NULLIF(split_part(symbol, '.', 2), '')` | text | Exchange suffix after the dot, or `NULL` when none exists. |

*This query splits symbols into root and exchange suffix without regex machinery.*

```sql
SELECT
    symbol,
    split_part(symbol, '.', 1) AS symbol_root,
    NULLIF(split_part(symbol, '.', 2), '') AS exchange_suffix
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND symbol IN ('ASML.AS', 'BNP.PA', 'TTE.PA', 'AAPL')
ORDER BY symbol;
```

| symbol | symbol_root | exchange_suffix |
|---|---|---|
| AAPL | AAPL |  |
| ASML.AS | ASML | AS |
| BNP.PA | BNP | PA |
| TTE.PA | TTE | PA |

This is the clean delimiter case where `split_part` is preferable to a more expensive regex.

#### Normalize text with trimming, replacement, and translation

Use this pattern when the text must be cleaned or normalized before display, comparison, or export. It is typically triggered by label preparation and lightweight canonicalization. The query is read-only. Its purpose is to show how the core normalization functions compose on real warehouse strings.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `short_name` | `gold.scores_daily.short_name` | varchar | Original company label. |
| `trimmed_name` | `btrim(short_name)` | text | Short name with leading and trailing whitespace removed. |
| `upper_country` | `upper(country)` | text | Country normalized to upper case. |
| `replaced_name` | `replace(short_name, ' ', '_')` | text | Spaces rewritten as underscores. |
| `normalized_currency` | `translate(currency, 'EURUSD', 'eurusd')` | text | Character-by-character translation of the currency code. |

*This query trims, case-normalizes, replaces delimiters, and translates characters on a small live slice.*

```sql
SELECT
    short_name,
    btrim(short_name) AS trimmed_name,
    upper(country) AS upper_country,
    replace(short_name, ' ', '_') AS replaced_name,
    translate(currency, 'EURUSD', 'eurusd') AS normalized_currency
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND symbol IN ('ASML.AS', 'BNP.PA', 'TTE.PA')
ORDER BY symbol;
```

| short_name | trimmed_name | upper_country | replaced_name | normalized_currency |
|---|---|---|---|---|
| ASML HOLDING | ASML HOLDING | NETHERLANDS | ASML_HOLDING | eur |
| BNP PARIBAS ACT.A | BNP PARIBAS ACT.A | FRANCE | BNP_PARIBAS_ACT.A | eur |
| TOTALENERGIES | TOTALENERGIES | FRANCE | TOTALENERGIES | eur |

`replace` works on substrings, while `translate` applies a one-to-one character mapping. That distinction matters whenever the transformation is character-based rather than token-based.

## Pattern Matching and Regular Expressions

Not every text search is the same. PostgreSQL offers position-based search, SQL wildcard matching, case-insensitive matching with `ILIKE`, and full regex operators such as `~` and `regexp_replace`.

### Exact position, wildcard search, and regex checks

The right operator depends on the question: find a substring position, test a wildcard pattern, or apply a regular expression.

#### Use `position`, `LIKE`, and regex checks for different matching questions

Use this pattern when a query needs to know whether a substring exists, whether a wildcard expression matches, or whether the text conforms to a regex rule. It is typically triggered by parsing, text-quality checks, and lightweight classification. The query is read-only. Its purpose is to show the different semantics side by side.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Symbol row being inspected. |
| `short_name` | `gold.scores_daily.short_name` | varchar | Company label tested by the string predicates. |
| `pos_ag` | `position('AG' IN short_name)` | integer | One-based position of the substring, or `0` when absent. |
| `like_contains_ag` | `short_name LIKE '%AG%'` | boolean | Whether the wildcard expression matched. |
| `all_caps_regex` | `short_name ~ '^[A-Z ]+$'` | boolean | Whether the label contains only uppercase letters and spaces. |

*This query contrasts substring position, wildcard containment, and regex validation on live names.*

```sql
SELECT
    symbol,
    short_name,
    position('AG' IN short_name) AS pos_ag,
    short_name LIKE '%AG%' AS like_contains_ag,
    short_name ~ '^[A-Z ]+$' AS all_caps_regex
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND symbol IN ('ASML.AS', 'BAYN.DE', 'BNP.PA', 'TTE.PA')
ORDER BY symbol;
```

| symbol | short_name | pos_ag | like_contains_ag | all_caps_regex |
|---|---|---:|---|---|
| ASML.AS | ASML HOLDING | 0 | false | true |
| BAYN.DE | Bayer AG | 7 | true | false |
| BNP.PA | BNP PARIBAS ACT.A | 0 | false | false |
| TTE.PA | TOTALENERGIES | 0 | false | true |

The three predicates are answering different questions. `position` tells where the match starts. `LIKE` answers yes or no with wildcard syntax. The regex checks a full-shape rule for the whole string.

#### Use regex replacement when pattern-based cleanup is easier than delimiter logic

Use `regexp_replace` when the cleanup rule is driven by a text pattern rather than a fixed literal delimiter. It is typically triggered by ticker cleanup, format normalization, and character-class removal. The query is read-only. Its purpose is to show the regex-based alternative to plain `replace`.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `gold.scores_daily.symbol` | varchar | Original ticker symbol. |
| `stripped_symbol` | `regexp_replace(symbol, '\\.[A-Z]+$', '')` | text | Symbol with a trailing exchange suffix removed. |
| `alnum_name` | `regexp_replace(short_name, '[^A-Za-z0-9 ]', '', 'g')` | text | Company name with punctuation stripped. |

*This query removes trailing exchange suffixes and punctuation by applying regex rules instead of literal replacements.*

```sql
SELECT
    symbol,
    regexp_replace(symbol, '\.[A-Z]+$', '') AS stripped_symbol,
    regexp_replace(short_name, '[^A-Za-z0-9 ]', '', 'g') AS alnum_name
FROM gold.scores_daily
WHERE score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
  AND symbol IN ('ASML.AS', 'BNP.PA', 'TTE.PA')
ORDER BY symbol;
```

| symbol | stripped_symbol | alnum_name |
|---|---|---|
| ASML.AS | ASML | ASML HOLDING |
| BNP.PA | BNP | BNP PARIBAS ACTA |
| TTE.PA | TTE | TOTALENERGIES |

Regex replacement is especially useful when the undesirable part has a structural shape such as "dot followed by uppercase suffix" rather than a single literal token.

## Splitting and Identifier Safety

Parsing inbound lists and constructing SQL-safe identifiers are both common operational tasks. PostgreSQL keeps them separate: parse data values into rowsets, and quote identifiers with identifier-aware functions instead of manual punctuation.

### Expand lists into rowsets and quote identifiers safely

Arrays and `unnest` are the natural PostgreSQL replacement for comma-split rowsets, while `quote_ident`, `quote_literal`, and `format` handle SQL-safe text construction.

#### Turn a delimited list into rows with `string_to_array` and `unnest`

Use this pattern when a small caller-supplied list must become a joinable rowset inside SQL. It is typically triggered by notebook filters, ad-hoc diagnostics, and application-side batches. The query is read-only. Its purpose is to show the clean PostgreSQL list-to-rows pattern.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `symbol` | `unnest(string_to_array(...))` | text | Caller-supplied symbol expanded into rows. |
| `composite_score` | `gold.scores_daily.composite_score` | numeric | Latest score for that symbol. |
| `composite_rank` | `gold.scores_daily.composite_rank` | smallint | Current rank for that symbol. |

*This query converts a comma-delimited symbol list into rows and joins it to the latest scores.*

```sql
WITH input_symbols AS (
    SELECT unnest(string_to_array('ASML.AS,BNP.PA,TTE.PA', ',')) AS symbol
)
SELECT
    i.symbol,
    ROUND(s.composite_score::numeric, 4) AS composite_score,
    s.composite_rank
FROM input_symbols AS i
JOIN gold.scores_daily AS s
  ON s.symbol = i.symbol
WHERE s.score_date = (SELECT MAX(score_date) FROM gold.scores_daily)
ORDER BY s.composite_rank;
```

| symbol | composite_score | composite_rank |
|---|---:|---:|
| BNP.PA | 0.5967 | 1 |
| TTE.PA | 0.4954 | 2 |
| ASML.AS | 0.0156 | 28 |

This is the PostgreSQL-native small-batch parsing pattern. For larger batches or reusable workflows, arrays usually give way to temp tables or staged file loads.

#### Quote identifiers and literals with SQL-aware functions

Use this pattern when SQL text must be constructed safely from identifier or literal fragments. It is typically triggered by administrative SQL generation, dynamic object naming, and debugging of safe quoting boundaries. The query is read-only. Its purpose is to show that identifiers and literals require different escaping rules.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `quoted_identifier` | `quote_ident(...)` | text | Identifier safely wrapped and escaped for SQL. |
| `qualified_identifier` | `format('%I.%I', ...)` | text | Schema-qualified identifier built with identifier-aware formatting. |
| `quoted_literal` | `quote_literal(...)` | text | String literal safely quoted for SQL text. |

*This query shows the safe text-construction helpers PostgreSQL provides for identifiers and literals.*

```sql
SELECT
    quote_ident('Order Details') AS quoted_identifier,
    format('%I.%I', 'gold', 'scores_daily') AS qualified_identifier,
    quote_literal('O''Reilly') AS quoted_literal;
```

| quoted_identifier | qualified_identifier | quoted_literal |
|---|---|---|
| "Order Details" | gold.scores_daily | 'O''Reilly' |

Identifiers and literals are not interchangeable quoting problems. `quote_ident` protects object names. `quote_literal` protects value text. `format('%I', ...)` and `format('%L', ...)` keep that distinction explicit when building larger SQL fragments.

## Practical Rules

In PostgreSQL, string work is usually a matter of choosing the right text operator rather than the right Unicode type family.

| Need | PostgreSQL pattern | Why |
|---|---|---|
| Count visible characters | `char_length` or `length` | Character count, not byte count. |
| Count bytes on disk | `octet_length` | Important for multibyte UTF-8 text. |
| Build labels with nullable inputs | `concat_ws` | Skips nulls and separator clutter. |
| Aggregate many values into one list | `string_agg(... ORDER BY ...)` | Deterministic grouped text aggregation. |
| Split delimiter-based text | `split_part` | Simpler than regex for positional tokens. |
| Replace whole substrings | `replace` | Literal substring substitution. |
| Replace character-by-character | `translate` | One-to-one character mapping. |
| Wildcard match | `LIKE` or `ILIKE` | SQL-pattern matching, with `ILIKE` for case-insensitive checks. |
| Regex validation or cleanup | `~`, `~*`, `regexp_replace` | Full regular-expression semantics. |
| Safely build identifier text | `quote_ident`, `format('%I', ...)` | Protects SQL object names correctly. |
