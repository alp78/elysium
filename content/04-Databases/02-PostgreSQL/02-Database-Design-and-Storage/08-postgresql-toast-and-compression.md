---
title: "08 - PostgreSQL TOAST and Compression"
tags:
  - postgresql
  - storage
  - compression
description: "Production guide to PostgreSQL TOAST, storage attributes, and column compression, including the real boundary where PostgreSQL does not mirror SQL Server row/page compression and a live pglz-versus-lz4 demo."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[07-postgresql-index-maintenance]]"
  - "[[09-postgresql-partitioning-strategies]]"
status: complete
---

# PostgreSQL TOAST and Compression

PostgreSQL does not offer SQL Server-style row and page compression knobs on ordinary heap pages. The nearest native storage-reduction surface is TOAST: large values can be compressed and/or moved out of line, and the compression method can be chosen per column when the build supports it. That is a different design space, and it changes both what operators can optimize and what they should not promise.

> [!abstract]- Summary
>
> This note replaces the SQL Server table-compression chapter with PostgreSQL's real storage-reduction surface:
>
> - **Conceptual boundary**
>   - explains why TOAST and per-column compression are not the same thing as SQL Server row/page compression
> - **Current posture**
>   - confirms the current cluster default for `default_toast_compression`
> - **Live demo**
>   - shows `pglz` and `lz4` on the same value using column-level compression settings and catalog inspection
> - **Operational guidance**
>   - closes with rules for when compression helps, when it does not, and what cost it still imposes

## Compression Boundary

### PostgreSQL | storage model | understand what TOAST does and does not do

#### Translate the storage problem correctly before tuning it

Run this design check before promising storage savings from "table compression." It is typically triggered by cross-platform migration or disk-pressure reviews. The context is conceptual. Its purpose is to keep SQL Server row/page expectations from being copied onto PostgreSQL unchanged.

| SQL Server concept | PostgreSQL reality |
|---|---|
| row compression | no direct ordinary-table equivalent |
| page compression | no direct ordinary-table equivalent |
| columnstore archive compression | separate analytical storage family, not the same as heap TOAST |
| TOAST and column compression | PostgreSQL-native reduction for large compressible values |

PostgreSQL compression is column- and value-oriented. It mostly matters for large TOAST-able datums such as long `text`, `jsonb`, or `bytea` values. Small scalar rows will not suddenly become compact because a database-wide compression switch was enabled. No such switch exists in core PostgreSQL.

## Current Compression Posture

### PostgreSQL | `default_toast_compression` | read the cluster default first

#### Check the default before changing column-level behavior

Run this before altering table or column storage attributes so you know what the cluster is already doing by default. It is typically triggered during storage review or when comparing two environments. The query is read-only. Its purpose is to show which TOAST compression method newly inserted values will prefer when no column override exists.

```sql
SHOW default_toast_compression;
```

| default_toast_compression |
|---|
| `pglz` |

This means the current cluster still defaults to `pglz`. That does not tell you whether other methods are supported; it only tells you what the server will choose unless a column says otherwise.

## Live Compression Demo

### PostgreSQL | `pglz` versus `lz4` | compare column-level compression methods on the same value

#### Use one disposable row to prove both catalog metadata and stored-size impact

Use this when you need to verify that the build supports more than the default algorithm and to see whether a more modern codec changes stored size for a compressible value. It is typically triggered during storage tuning or platform qualification. The demo is state-changing but isolated to a temporary table inside one transaction and rolled back. Its purpose is to show both the catalog-level compression flag and the effective stored size for the same repeated payload.

```sql
BEGIN;

CREATE TEMP TABLE note08_compression_demo (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload_pglz text COMPRESSION pglz,
  payload_lz4 text COMPRESSION lz4
);

INSERT INTO note08_compression_demo(payload_pglz, payload_lz4)
SELECT repeat('compress-me-', 800),
       repeat('compress-me-', 800);

SELECT c.relname AS table_name,
       a.attname AS column_name,
       a.attstorage,
       a.attcompression
FROM pg_class AS c
JOIN pg_attribute AS a
  ON a.attrelid = c.oid
 AND a.attnum > 0
 AND NOT a.attisdropped
WHERE c.relname = 'note08_compression_demo'
ORDER BY a.attnum;

SELECT id,
       pg_column_compression(payload_pglz) AS pglz_method,
       pg_column_compression(payload_lz4) AS lz4_method,
       pg_column_size(payload_pglz) AS pglz_size,
       pg_column_size(payload_lz4) AS lz4_size
FROM note08_compression_demo;

ROLLBACK;
```

| table_name | column_name | attstorage | attcompression |
|---|---|---|---|
| `note08_compression_demo` | `id` | `p` |  |
| `note08_compression_demo` | `payload_pglz` | `x` | `p` |
| `note08_compression_demo` | `payload_lz4` | `x` | `l` |

| id | pglz_method | lz4_method | pglz_size | lz4_size |
|---|---|---|---|---|
| `1` | `pglz` | `lz4` | `134` | `67` |

The practical read is strong:

| Signal | Meaning |
|---|---|
| `attstorage = 'x'` | both columns allow full TOAST behavior (`EXTENDED`) |
| `attcompression = 'p'` and `'l'` | one column is pinned to `pglz`, the other to `lz4` |
| `67` bytes versus `134` bytes | on this payload, `lz4` stored a meaningfully smaller compressed datum than `pglz` |

This does not make `lz4` universally better. It proves only that compression behavior is workload-specific and measurable.

## Storage Attributes

### PostgreSQL | storage policy | choose storage behavior deliberately for wide columns

#### Use storage attributes when the column shape really justifies them

PostgreSQL storage attributes matter mainly for large TOAST-able columns:

| Storage policy | Meaning |
|---|---|
| `PLAIN` | keep inline, no compression or out-of-line storage |
| `MAIN` | allow compression, prefer keeping inline |
| `EXTERNAL` | allow out-of-line storage without compression |
| `EXTENDED` | allow both compression and out-of-line storage; the default for most TOAST-able types |

The wrong habit is to treat these as routine knobs for every table. They matter for wide values, not for every narrow OLTP row.

## Operational Recommendations

### PostgreSQL | compression rules | optimize the columns that deserve it

#### Measure first, then choose the smallest change that helps

| Rule | Why |
|---|---|
| do not promise SQL Server-style table compression in PostgreSQL core | the feature model is different |
| check `default_toast_compression` before assuming the current algorithm | defaults vary by build and configuration |
| override compression per column only for columns whose size and workload justify it | complexity should buy something measurable |
| keep backup compression and TOAST compression mentally separate | one affects stored column values, the other affects backup artifacts |
| remember that compression trades CPU for storage and I/O | savings are never free |

Next: [[09-postgresql-partitioning-strategies]] turns from row and value storage to table layout over time: declarative partitioning, pruning, attach/detach workflows, and retention windows.
