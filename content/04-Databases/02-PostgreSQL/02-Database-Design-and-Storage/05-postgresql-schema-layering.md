---
title: "05 - PostgreSQL Schema Layering"
tags:
  - postgresql
  - schema-design
  - permissions
description: "Production guidance for organizing PostgreSQL databases and schemas in layered data systems, grounded in the live stoxx schema layout and focused on namespaces, ownership, search path, and cross-schema permission boundaries."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[04-postgresql-keys-defaults-identity-and-sequences]]"
  - "[[06-postgresql-index-types-and-strategy]]"
status: complete
---

# PostgreSQL Schema Layering

Schemas do more work in PostgreSQL than many teams admit. They are naming boundaries, ownership boundaries, search-path boundaries, and the first permission boundary inside one database. That makes schema design the simplest way to keep a layered warehouse legible without splitting into more databases than the workload actually needs.

> [!abstract]- Summary
>
> This note mirrors the SQL Server schema-layering chapter, but the PostgreSQL version centers on namespaces, `search_path`, ownership, and explicit schema grants:
>
> - **Live baseline**
>   - reads the current `stoxx` schema footprint and representative tables by schema
> - **Layering patterns**
>   - compares schema-per-layer, schema-per-domain, schema-per-source, and separate-database designs
> - **Control and contract surfaces**
>   - shows where control-plane, audit, and stable contract objects should live
> - **Security**
>   - demonstrates schema-scoped `USAGE` as the first in-database access boundary

## Live Baseline

### PostgreSQL | current schema footprint | verify the database already carries layer meaning

#### Read the current object layout before inventing a new taxonomy

Run this before proposing a new schema model so you do not redesign around assumptions that the database has already outgrown. It is typically triggered during platform review or medallion cleanup. The query is read-only. Its purpose is to show where real objects already live.

```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename
LIMIT 20;
```

| schemaname | tablename |
|---|---|
| `bronze` | `dim_country` |
| `bronze` | `dim_index` |
| `bronze` | `eurostoxx50_ohlcv` |
| `dbo` | `powershell_automation_chain_stage` |
| `demo_stc` | `employee` |
| `gold` | `index_performance` |

The shape is already visible without interpretation tricks: `bronze`, `silver`, and `gold` are meaningful pipeline layers; `demo_stc` is clearly sandbox/demo territory; `dbo` is legacy or compatibility debt rather than a PostgreSQL-native naming decision.

### PostgreSQL | schema ownership and ACLs | inspect the current boundary honestly

#### Read ownership and grants together

Run this when reviewing cross-schema security or deciding whether `public` is still too open. It is typically triggered by permission design or least-privilege review. The query is read-only. Its purpose is to show which schemas are owner-only today and where default grants still exist.

```sql
SELECT nspname AS schema_name,
       nspowner::regrole AS owner_name,
       COALESCE(array_to_string(nspacl, ', '), '(owner only)') AS acl
FROM pg_namespace
WHERE nspname IN ('public','bronze','silver','gold','demo_stc','dbo')
ORDER BY nspname;
```

| schema_name | owner_name | acl |
|---|---|---|
| `bronze` | `postgres` | `(owner only)` |
| `dbo` | `postgres` | `(owner only)` |
| `demo_stc` | `postgres` | `(owner only)` |
| `gold` | `postgres` | `(owner only)` |
| `public` | `pg_database_owner` | `pg_database_owner=UC/pg_database_owner, =U/pg_database_owner` |
| `silver` | `postgres` | `(owner only)` |

This is the key PostgreSQL security read: most application schemas are owner-only, but `public` still carries its default grant posture. If a team is serious about namespace discipline, `public` should be a deliberate choice, not an ambient fallback.

## Schema-Per-Layer As The Default

### PostgreSQL | medallion layering | keep bronze, silver, and gold readable

#### Use schemas when one database still makes operational sense

Schema-per-layer is the default recommendation when the same database can safely host raw, refined, and serving surfaces without requiring different recovery, HA, or lifecycle policies. It keeps joins simple and makes ownership obvious without multiplying database-level administration.

Current `stoxx` already validates the pattern:

| Layer schema | Current role in the database |
|---|---|
| `bronze` | raw and lightly normalized ingestion surfaces |
| `silver` | cleaned and modeled analytical tables |
| `gold` | small serving or score surfaces |

## Schema-Per-Domain And Schema-Per-Source

### PostgreSQL | alternate layering patterns | use them only when the boundary is real

#### Add more schemas only when they carry real operational meaning

Use schema-per-domain when ownership, permissions, or deployment cadence differ by business domain. Use schema-per-source when raw ingestion from many source systems would otherwise become unreadable inside one staging layer. Do not add schemas simply to make the diagram look advanced.

Good reasons to add schemas:

| Pattern | Good trigger |
|---|---|
| schema-per-domain | teams truly own different table sets and permission boundaries |
| schema-per-source | many raw feeds would clutter a single bronze namespace |
| dedicated `control` or `meta` schema | pipeline state, watermarks, and operational metadata need isolation |

## Control, Audit, And Contract Schemas

### PostgreSQL | control-plane schemas | separate system state from business tables

#### Keep operational tables out of the core analytical layers

Control-plane objects such as watermarks, run history, schema-version markers, and data-quality state deserve their own schema because they are neither bronze nor gold. The same is true for explicit audit/history tables and stable contract views that shield consumers from physical table churn.

Recommended pattern:

| Schema | Purpose |
|---|---|
| `control` or `meta` | ETL state, watermarks, run metadata |
| `audit` or `history` | append-only business or operational history where needed |
| `contract` or curated views in serving schema | stable consumer-facing projections |

## Cross-Schema Security

### PostgreSQL | schema grants | prove how `USAGE` scopes access

#### Use schema-level `USAGE` as the first access gate

Run this when designing least-privilege access for readers or service roles. It is typically triggered during role design or onboarding a new consumer. The demo is transactional and rolled back. Its purpose is to show that schema access is explicit: a role with `USAGE` on one schema does not automatically see the others.

```sql
BEGIN;

CREATE ROLE note05_reader NOLOGIN;
GRANT USAGE ON SCHEMA bronze TO note05_reader;

SELECT nspname AS schema_name,
       has_schema_privilege('note05_reader', nspname, 'USAGE') AS note05_reader_can_use
FROM pg_namespace
WHERE nspname IN ('bronze','silver','gold')
ORDER BY nspname;

ROLLBACK;
```

| schema_name | note05_reader_can_use |
|---|---|
| `bronze` | `t` |
| `gold` | `f` |
| `silver` | `f` |

This is the behavior you want for layered systems: explicit access to the namespace you meant to expose, and nothing ambient beyond that.

## Decision Guide

### PostgreSQL | choose the smallest boundary that solves the real problem

#### Prefer schemas until a stronger boundary is required

| If you need... | Prefer... |
|---|---|
| simple layer separation with shared recovery and HA | schemas in one database |
| different backup, failover, or lifecycle policies by layer | separate databases |
| stable source-scoped raw ingestion | source-specific bronze schemas |
| shared control-plane state across layers | dedicated `control` schema |

## Anti-Patterns

### PostgreSQL | layering mistakes | avoid boundaries that confuse more than they protect

#### Keep the model operationally legible

| Anti-pattern | Why it hurts |
|---|---|
| dumping everything into `public` | destroys namespace and permission clarity |
| creating many schemas with no ownership or grant distinctions | adds ceremony without real boundary value |
| copying SQL Server's `dbo` default mentally into PostgreSQL | hides the fact that PostgreSQL namespaces are more explicit and customizable |
| mixing control metadata into analytical schemas | blurs operational and business contracts |

## Current Recommendation For `stoxx`

### PostgreSQL | recommended layering posture | keep the medallion meaning visible

#### Clean up the edge cases, not the core model

The live database already supports schema-per-layer as the default design. The immediate improvement is not to redesign the whole namespace map. It is to tighten the exceptions:

| Observation | Recommendation |
|---|---|
| `bronze`, `silver`, `gold` are already legible | keep them as the main layer boundary |
| `demo_stc` is clearly non-production | keep it isolated from core analytical flows |
| `dbo` exists in a PostgreSQL database | treat it as compatibility or migration debt and avoid expanding it |
| `public` still has default visibility posture | decide explicitly whether to keep, restrict, or empty it |

Next: [[06-postgresql-index-types-and-strategy]] moves from namespace design to access-path design: B-tree, GIN, GiST, BRIN, partial and expression indexes, and how PostgreSQL index families map to real query patterns.
