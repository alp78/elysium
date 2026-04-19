---
title: "10 - PostgreSQL Change Tracking and History Patterns"
tags:
  - postgresql
  - change-tracking
  - history
description: "Production guide to PostgreSQL row-history and change-capture patterns: explicit version columns, manual SCD2, trigger-driven state changes, and logical-decoding-style CDC boundaries, grounded in the live lab posture."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[09-postgresql-partitioning-strategies]]"
status: complete
---

# PostgreSQL Change Tracking and History Patterns

PostgreSQL does not have one built-in feature that cleanly replaces SQL Server `rowversion`, temporal tables, CDC, and Change Tracking all at once. The correct design question is narrower: do you need optimistic concurrency, full row history, downstream change feeds, or external warehouse snapshots? Each of those has a PostgreSQL-native pattern, and choosing the right one matters more than finding the most familiar name.

> [!abstract]- Summary
>
> This note replaces the SQL Server change-tracking chapter with PostgreSQL's real history and change-capture options:
>
> - **Current posture**
>   - shows that the live cluster is still at `wal_level = replica`, with no logical publications or logical replication slots
> - **Manual SCD2**
>   - demonstrates a warehouse-style row-history pattern with `valid_from`, `valid_to`, and a partial unique index on the current row
> - **Pull-based synchronization**
>   - demonstrates an explicit `version_no` and `updated_at` trigger pattern for application-facing change tokens
> - **Logical CDC**
>   - explains when publications, slots, and logical decoding become the right tool
> - **External patterns**
>   - closes with dbt snapshots and application event logging as valid alternatives

## Current Change-Capture Posture

### PostgreSQL | logical-change baseline | verify what the cluster can do today

#### Check whether the server is configured for logical change feeds yet

Run this before designing CDC or replication-style downstream consumption. It is typically triggered by pipeline design or source-system integration work. The query is read-only. Its purpose is to show whether the cluster is currently positioned for logical change capture at all.

```sql
SHOW wal_level;

SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication;

SELECT slot_name, plugin, slot_type, active, restart_lsn
FROM pg_replication_slots
WHERE slot_type = 'logical';
```

| wal_level |
|---|
| `replica` |

| pubname | puballtables | pubinsert | pubupdate | pubdelete | pubtruncate |
|---|---|---|---|---|---|
| *(0 rows)* |  |  |  |  |  |

| slot_name | plugin | slot_type | active | restart_lsn |
|---|---|---|---|---|
| *(0 rows)* |  |  |  |  |

This is the clean baseline for the current lab: physical replication posture exists, but logical CDC has not been enabled. That means any downstream history or sync pattern in this environment must currently be table-driven, trigger-driven, or external.

## Manual SCD Type 2

### PostgreSQL | warehouse history pattern | use explicit validity windows and one current row

#### Build SCD2 as an explicit data contract, not as a hidden engine feature

Use this when the warehouse owns row-history logic and needs full row versions over time. It is typically triggered by dimensional modeling or contract history requirements. The demo is state-changing but isolated to temporary objects inside one transaction and rolled back. Its purpose is to show the canonical PostgreSQL SCD2 pattern: surrogate key plus business key, validity window, current-row flag, and a partial unique index that guarantees only one current row per business key.

```sql
BEGIN;

CREATE TEMP TABLE note10_customer_dim (
  surrogate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_code text NOT NULL,
  customer_name text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  is_current boolean NOT NULL
);

CREATE UNIQUE INDEX note10_customer_dim_current_uk
  ON note10_customer_dim (customer_code)
  WHERE is_current;

INSERT INTO note10_customer_dim (customer_code, customer_name, valid_from, valid_to, is_current)
VALUES ('CUST-001','Alpha AG','2026-01-01 00:00:00+00', NULL, true);

UPDATE note10_customer_dim
SET valid_to = '2026-03-01 00:00:00+00',
    is_current = false
WHERE customer_code = 'CUST-001'
  AND is_current;

INSERT INTO note10_customer_dim (customer_code, customer_name, valid_from, valid_to, is_current)
VALUES ('CUST-001','Alpha AG Europe','2026-03-01 00:00:00+00', NULL, true);

SELECT surrogate_id, customer_code, customer_name, valid_from, valid_to, is_current
FROM note10_customer_dim
ORDER BY surrogate_id;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname LIKE 'pg_temp_%'
  AND tablename = 'note10_customer_dim';

ROLLBACK;
```

| surrogate_id | customer_code | customer_name | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| `1` | `CUST-001` | `Alpha AG` | `2026-01-01 00:00:00+00` | `2026-03-01 00:00:00+00` | `f` |
| `2` | `CUST-001` | `Alpha AG Europe` | `2026-03-01 00:00:00+00` |  | `t` |

| indexname | indexdef |
|---|---|
| `note10_customer_dim_pkey` | `CREATE UNIQUE INDEX note10_customer_dim_pkey ON pg_temp.note10_customer_dim USING btree (surrogate_id)` |
| `note10_customer_dim_current_uk` | `CREATE UNIQUE INDEX note10_customer_dim_current_uk ON pg_temp.note10_customer_dim USING btree (customer_code) WHERE is_current` |

The partial unique index is the important operational rule. Without it, two "current" rows for the same business key can slip in silently.

## Pull-Based Synchronization

### PostgreSQL | explicit version columns | use your own change token, not `xmin`

#### Keep synchronization tokens in the schema you control

Use this when consumers poll for changed rows and do not need full logical decoding. It is typically triggered by service-to-service synchronization or incremental pulls into another store. The demo is transactional and rolled back. Its purpose is to show the simple, explicit pattern: `updated_at` plus an integer version that increments on update.

```sql
BEGIN;

CREATE TEMP TABLE note10_orders (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_no bigint NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION pg_temp.note10_touch_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version_no := OLD.version_no + 1;
  RETURN NEW;
END
$$;

CREATE TRIGGER note10_touch_version
BEFORE UPDATE ON note10_orders
FOR EACH ROW
EXECUTE FUNCTION pg_temp.note10_touch_version();

INSERT INTO note10_orders(status)
VALUES ('new')
RETURNING id, status, updated_at, version_no;

UPDATE note10_orders
SET status = 'shipped'
WHERE id = 1
RETURNING id, status, updated_at, version_no;

ROLLBACK;
```

| id | status | updated_at | version_no |
|---|---|---|---|
| `1` | `new` | `2026-04-19 00:27:07.479045+00` | `1` |

| id | status | updated_at | version_no |
|---|---|---|---|
| `1` | `shipped` | `2026-04-19 00:27:07.479045+00` | `2` |

The important signal is `version_no` moving from `1` to `2`. That is a real business-controlled token. PostgreSQL's internal `xmin` is not a safe substitute for that contract.

## Logical CDC

### PostgreSQL | publications and logical slots | use them when downstream consumers need row-level change streams

#### Move to logical decoding only when the consumer really needs it

Logical CDC becomes the right tool when downstream systems need insert, update, and delete events from the source database rather than periodic snapshots or polling by `updated_at`. The enabling boundary is explicit:

| Requirement | PostgreSQL surface |
|---|---|
| row-level logical stream | `wal_level = logical` |
| publisher object | `CREATE PUBLICATION` |
| retained decoding position | logical replication slot |
| external connector | built-in logical replication or a consumer such as Debezium |

Until those pieces exist, do not describe the cluster as CDC-enabled.

## External History Patterns

### PostgreSQL | externalized history | keep history where the consumer or warehouse owns it

#### Not every history problem belongs inside the source database

Two common alternatives are still valid:

| Pattern | Best use |
|---|---|
| dbt snapshot or warehouse snapshot logic | analytics layer owns historical comparison |
| application event logging | business event matters more than row image |

These are not lesser solutions. They are different ownership choices.

## Current Recommendation For `stoxx`

### PostgreSQL | history and change-capture choice | use the lightest pattern that satisfies the need

#### Match the tool to the consumer

| Need | Recommended pattern on the current lab |
|---|---|
| warehouse history of dimensions | manual SCD2 with partial unique index |
| application pull sync | explicit `updated_at` + `version_no` |
| downstream event stream | enable logical decoding deliberately later |
| audit or compliance history | explicit history tables or application events, not vague reliance on internals |

With that, the new-note sequence for this folder is complete. The remaining work in `02-Database-Design-and-Storage` is the final refinement pass on existing notes `01` and `02`, then the folder can be closed cleanly before moving to `03-Query-Writing-and-Optimization`.
