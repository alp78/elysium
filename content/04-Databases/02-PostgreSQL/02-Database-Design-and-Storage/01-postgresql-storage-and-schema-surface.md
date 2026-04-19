---
title: "01 - Database Creation and Storage Layout"
tags:
  - postgresql
  - storage
  - schema-design
aliases:
  - CREATE DATABASE
  - PostgreSQL tablespaces
  - relation file layout
description: "Production PostgreSQL database-creation and storage-layout baseline for owners, templates, tablespaces, relation files, heap storage, and schema placement, grounded on the live stoxx database."
parent: "[[domain-postgresql-database-design-and-storage]]"
links:
  - "[[02-postgresql-storage-internals]]"
  - "[[03-postgresql-schemas-tables-and-constraints]]"
status: complete
---

# Database Creation and Storage Layout

Creating a PostgreSQL database is not just a `CREATE DATABASE` event. It fixes the owner boundary, template ancestry, encoding and locale rules, default tablespace, connection policy, and the file-system path pattern that every later table and index will inherit. The live `stoxx` database is small enough to inspect directly, which makes it a good baseline for mapping SQL Server file-layout thinking onto PostgreSQL's database OIDs, tablespaces, heap storage, and relation files.

> [!abstract]- Summary
>
> PostgreSQL does not have SQL Server-style filegroups, `.mdf` data files, or one log file per database. The equivalent design work happens through `CREATE DATABASE`, template selection, tablespaces, cluster-level WAL, heap-table storage, and per-database defaults such as owner, locale, and connection policy.
>
> **Reference baseline**
> - uses the live `stoxx` PostgreSQL 16 database to show what a created database actually owns: owner, encoding, locale, default tablespace, template inheritance, and connection policy
> - makes the cluster/file boundary explicit so the reader can separate database-local objects from cluster-wide assets such as WAL and tablespaces
>
> **Physical placement**
> - covers cluster paths, built-in tablespaces, relation file paths, database OIDs, and the way PostgreSQL stores user tables under `base/<database_oid>/<filenode>`
>
> **Storage architecture**
> - explains PostgreSQL's default heap storage model, preserved application schemas, and the current size footprint of the biggest user tables in `bronze`, `silver`, and `gold`
>
> **Operational design**
> - turns database creation into a placement and governance decision: when to stay on `pg_default`, when to introduce a dedicated tablespace, and which creation-time defaults should be left explicit rather than inherited accidentally

> [!note]- Glossary
>
> **`CREATE DATABASE`**
> - The SQL command that creates a new PostgreSQL database by cloning a template database and assigning owner, encoding, locale, tablespace, and optional connection limits.
> - It matters because PostgreSQL database creation is a clone-plus-metadata operation, not a blank file allocation event.
>
> > [!info] New databases come from a template
> >
> > PostgreSQL does not assemble a new database from nothing. It clones `template1` by default, or another template when requested explicitly.
>
> ---
>
> **Template database**
> - A database marked as reusable for cloning into new databases.
> - It matters because `template1` is the default parent of ordinary new databases, while `template0` remains the pristine fallback when local customizations must be avoided.
>
> > [!info] `template1` is inheritance, not decoration
> >
> > Objects or settings added to `template1` propagate into future databases unless creation explicitly targets another template.
>
> ---
>
> **Tablespace**
> - A cluster-wide file-system location where PostgreSQL can place table, index, or database files.
> - It matters because tablespaces are PostgreSQL's physical placement boundary. They are the closest analogue to SQL Server file-placement strategy, but they are coarser and cluster-wide.
>
> > [!info] Tablespaces are placement controls
> >
> > A tablespace decides where files live on disk. It does not create a separate database or a separate WAL stream.
>
> ---
>
> **Heap table**
> - PostgreSQL's default table storage model, where rows are stored in an unordered heap and indexes point back to tuple locations.
> - It matters because PostgreSQL does not use a clustered-index-as-table default model. The table is the heap, and index strategy is layered on top of it.
>
> > [!info] Heap is the normal table baseline
> >
> > When `default_table_access_method = heap`, ordinary `CREATE TABLE` statements produce heap-backed tables unless a different access method is requested.
>
> ---
>
> **Filenode**
> - The on-disk identifier PostgreSQL uses for a relation file inside the data directory or a tablespace path.
> - It matters because catalog names and file names are different things. `pg_relation_filenode()` and `pg_relation_filepath()` are the safe way to bridge them.
>
> > [!info] File names are catalog-resolved
> >
> > Do not guess relation paths from table names. PostgreSQL uses internal identifiers, not schema-qualified names, for the physical file names.
>
> ---

## Reference Database Baseline

The first design question is not "how many files should I create?" but "what did PostgreSQL actually create for this database?" The current `stoxx` lab already answers that through `pg_database`, `pg_tablespace`, and the cluster settings exposed by `current_setting()`.

### Database identity and creation defaults

This subsection establishes the immutable or hard-to-change properties that matter immediately after creation: owner, encoding, locale, default tablespace, template ancestry, and connection policy.

#### Inspect the current owner, encoding, locale, and tablespace

Use this query during first inventory of a new database, after a migration, or before comparing two PostgreSQL databases that appear similar at the application layer but may differ in operational defaults. It is typically triggered by baseline review, cross-environment drift checking, or any design discussion that needs the exact owner and locale boundary before objects are added. The query runs read-only against `pg_database` and `pg_tablespace`. Its purpose is to surface the database properties that `CREATE DATABASE` either set explicitly or inherited from a template.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `datname` | `pg_database.datname` | name | Database name. |
| `owner` | `pg_database.datdba` via `pg_get_userbyid()` | text | Role that owns the database. |
| `tablespace_name` | `pg_tablespace.spcname` | name | Default tablespace used by the database. |
| `encoding` | `pg_database.encoding` via `pg_encoding_to_char()` | text | Server-side encoding used by the database. |
| `datcollate` | `pg_database.datcollate` | text | Collation rule used for string ordering. |
| `datctype` | `pg_database.datctype` | text | Character-classification locale used by the database. |
| `datconnlimit` | `pg_database.datconnlimit` | integer | Per-database connection limit, where `-1` means no per-database cap. |
| `datistemplate` | `pg_database.datistemplate` | boolean | Whether the database can be cloned as a template. |
| `datallowconn` | `pg_database.datallowconn` | boolean | Whether ordinary sessions are allowed to connect. |

*This query returns the current creation-time identity surface of the live `stoxx` database.*

```sql
SELECT
    d.datname,
    pg_get_userbyid(d.datdba) AS owner,
    t.spcname AS tablespace_name,
    pg_encoding_to_char(d.encoding) AS encoding,
    d.datcollate,
    d.datctype,
    d.datconnlimit,
    d.datistemplate,
    d.datallowconn
FROM pg_database AS d
LEFT JOIN pg_tablespace AS t
    ON t.oid = d.dattablespace
WHERE d.datname = 'stoxx';
```

| datname | owner | tablespace_name | encoding | datcollate | datctype | datconnlimit | datistemplate | datallowconn |
|---|---|---|---|---|---|---:|---|---|
| stoxx | postgres | pg_default | UTF8 | en_US.utf8 | en_US.utf8 | -1 | `f` | `t` |

`stoxx` is a normal, connectable database owned by `postgres`, stored in `pg_default`, using UTF-8 with `en_US.utf8` locale rules. Nothing here suggests a specialized creation path: there is no dedicated tablespace, no database-local connection ceiling, and no template behavior. That is a valid lab starting point, but it also means all placement and governance decisions were kept at the cluster default.

| Column | Value | Watch | Meaning | Implication |
|---|---|---|---|---|
| `datconnlimit` | `-1` | Context | No per-database connection cap | Connection pressure is controlled elsewhere, typically by global limits or pooling |
| `datistemplate` | `f` | `✓` | This is an ordinary database, not a cloning template | Future databases will not inherit from `stoxx` by accident |
| `datallowconn` | `t` | `✓` | Normal sessions may connect | The database is operationally online for clients |

#### Compare `stoxx` with `postgres` and the template databases

Use this query when the design discussion turns from one live database to the creation model of the cluster as a whole. It is typically triggered by questions such as "what would a new database inherit here?" or "what exactly is special about `template0` and `template1`?" The query runs read-only against `pg_database`. Its purpose is to show that PostgreSQL database creation is fundamentally a template-clone operation.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `datname` | `pg_database.datname` | name | Database name. |
| `owner` | `pg_database.datdba` via `pg_get_userbyid()` | text | Owning role. |
| `encoding` | `pg_database.encoding` via `pg_encoding_to_char()` | text | Database encoding. |
| `datcollate` | `pg_database.datcollate` | text | Database collation locale. |
| `datctype` | `pg_database.datctype` | text | Character-classification locale. |
| `datistemplate` | `pg_database.datistemplate` | boolean | Whether PostgreSQL considers the database a cloneable template. |
| `datallowconn` | `pg_database.datallowconn` | boolean | Whether ordinary connections are allowed. |

*This query compares the current working database to the cluster's built-in template lineage.*

```sql
SELECT
    datname,
    pg_get_userbyid(datdba) AS owner,
    pg_encoding_to_char(encoding) AS encoding,
    datcollate,
    datctype,
    datistemplate,
    datallowconn
FROM pg_database
WHERE datname IN ('template0', 'template1', 'postgres', 'stoxx')
ORDER BY datname;
```

| datname | owner | encoding | datcollate | datctype | datistemplate | datallowconn |
|---|---|---|---|---|---|---|
| postgres | postgres | UTF8 | en_US.utf8 | en_US.utf8 | `f` | `t` |
| stoxx | postgres | UTF8 | en_US.utf8 | en_US.utf8 | `f` | `t` |
| template0 | postgres | UTF8 | en_US.utf8 | en_US.utf8 | `t` | `f` |
| template1 | postgres | UTF8 | en_US.utf8 | en_US.utf8 | `t` | `t` |

The important boundary is that `template1` is connectable and cloneable, while `template0` is cloneable but not meant for ordinary sessions. That is why modifying `template1` has cluster-wide design consequences for future databases, while `template0` remains the clean fallback when a database must avoid local template customizations.

### Tablespaces and physical paths

Once the logical identity is clear, the next question is where the files actually live. PostgreSQL answers that through cluster paths, database OIDs, tablespaces, and relation filenodes rather than through human-readable file names.

#### Enumerate the cluster tablespaces visible to this database

Use this query during storage-placement review, before introducing a new tablespace, or when verifying whether a database really uses any non-default physical placement. It is typically triggered by migrations from systems that rely heavily on filegroups or by capacity work that needs to know whether PostgreSQL is still entirely on `pg_default`. The query reads `pg_tablespace` only. Its purpose is to show the cluster-level placement options that currently exist.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `spcname` | `pg_tablespace.spcname` | name | Tablespace name. |
| `location` | `pg_tablespace_location(oid)` | text | External file-system location for the tablespace, when applicable. |
| `options` | `pg_tablespace.spcoptions` | text[] | Per-tablespace storage options, if any. |

*This query lists the tablespaces currently registered in the cluster that hosts `stoxx`.*

```sql
SELECT
    t.spcname,
    pg_tablespace_location(t.oid) AS location,
    COALESCE(array_to_string(t.spcoptions, ', '), '') AS options
FROM pg_tablespace AS t
ORDER BY t.spcname;
```

| spcname | location | options |
|---|---|---|
| pg_default |  |  |
| pg_global |  |  |

This cluster is currently as simple as it can be: user objects live in `pg_default`, while shared system catalogs live in `pg_global`. No custom tablespace exists yet, which means the PostgreSQL chapter can teach non-default tablespace use as a deliberate operational decision instead of pretending the lab already needs one.

#### Resolve one real table to its database OID and relation path

Use this query when the reader needs to connect catalog identity to actual on-disk placement. It is typically triggered by file-layout questions, forensic storage review, or any situation where "where does this table live?" must be answered without guessing file names. The query joins `pg_database`, `pg_tablespace`, and `pg_class`. It is read-only. Its purpose is to prove how PostgreSQL maps a user table to `base/<database_oid>/<filenode>` inside the active tablespace.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `database_oid` | `pg_database.oid` | oid | Internal identifier of the current database. |
| `database_tablespace` | `pg_tablespace.spcname` | name | Default tablespace of the current database. |
| `table_name` | `pg_class.relname` | name | Catalog name of the target relation. |
| `filenode` | `pg_relation_filenode(c.oid)` | oid | Physical filenode identifier used on disk. |
| `relation_path` | `pg_relation_filepath(c.oid)` | text | Relative path to the relation file under the data directory or tablespace target. |

*This query resolves a real application table into its database OID and physical relation path.*

```sql
SELECT
    d.oid AS database_oid,
    t.spcname AS database_tablespace,
    c.relname AS table_name,
    pg_relation_filenode(c.oid) AS filenode,
    pg_relation_filepath(c.oid) AS relation_path
FROM pg_database AS d
JOIN pg_tablespace AS t
    ON t.oid = d.dattablespace
JOIN pg_class AS c
    ON c.oid = 'silver.stoxxusa50_ohlcv'::regclass
WHERE d.datname = current_database();
```

| database_oid | database_tablespace | table_name | filenode | relation_path |
|---|---|---|---:|---|
| 16384 | pg_default | stoxxusa50_ohlcv | 24872 | base/16384/24872 |

This is the PostgreSQL file-layout equivalent of resolving a SQL Server table into a database file and filegroup. The database OID `16384` names the database directory under `base/`, and filenode `24872` names the physical relation file inside it. The path is compact because `stoxx` still uses the default tablespace; a custom tablespace would change the root of the path, not the logical table name.

## Storage Architecture

PostgreSQL's physical model is simpler than SQL Server's file/filegroup vocabulary, but it is not less important. The key shift is from "which data files hold this table?" to "which tablespace and relation files hold this heap and its indexes?"

### Heap storage and size footprint

The live lab is currently using PostgreSQL's standard heap access method and default tablespace placement. That makes the current top-table footprint easy to inspect and reason about before the chapter moves into MVCC internals, TOAST, and index families.

#### Measure the largest user tables across bronze, silver, and gold

Use this query when establishing which user tables dominate current storage, after a migration, or before choosing which relations deserve deeper storage and indexing analysis first. It is typically triggered by a new environment walkthrough or by a "where is the space going?" question. The query reads `pg_class`, `pg_namespace`, and the size functions `pg_relation_size()` and `pg_total_relation_size()`. It is read-only. Its purpose is to distinguish heap size from total relation size, which includes indexes and TOAST.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `schema_name` | `pg_namespace.nspname` | name | Schema that owns the table. |
| `table_name` | `pg_class.relname` | name | Table name. |
| `relkind` | `pg_class.relkind` | char | Relation type, where `r` means ordinary table. |
| `heap_size` | `pg_relation_size(c.oid)` | text | Size of the main heap relation only. |
| `total_size` | `pg_total_relation_size(c.oid)` | text | Heap plus indexes and TOAST. |

*This query reports the heaviest ordinary user tables currently present in the medallion schemas.*

```sql
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relkind,
    pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class AS c
JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
WHERE n.nspname IN ('bronze', 'silver', 'gold')
  AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 12;
```

| schema_name | table_name | relkind | heap_size | total_size |
|---|---|---|---|---|
| silver | eurostoxx50_ohlcv | r | 8000 kB | 9520 kB |
| silver | stoxxusa50_ohlcv | r | 8000 kB | 9496 kB |
| silver | stoxxasia50_ohlcv | r | 7488 kB | 8960 kB |
| silver | oil20_ohlcv | r | 2944 kB | 3544 kB |
| bronze | trading_calendar | r | 1728 kB | 2424 kB |
| gold | index_performance | r | 648 kB | 816 kB |
| bronze | index_dim | r | 512 kB | 576 kB |
| gold | scores_daily | r | 384 kB | 448 kB |
| silver | index_dim | r | 288 kB | 352 kB |
| silver | signals_daily | r | 128 kB | 184 kB |
| bronze | signals_daily | r | 40 kB | 80 kB |
| gold | scores_quarterly | r | 40 kB | 80 kB |

The storage footprint is still modest. The whole `stoxx` database is only `44 MB`, and the largest tables are the three silver OHLCV histories at roughly `9 MB` each including indexes. That makes this a safe lab for exploring storage semantics, but it also means some production-only placement patterns, such as custom tablespaces, should be taught as deliberate future choices rather than as something the current dataset already forces.

### Schema surface and placement discipline

The migrated dataset preserved the medallion schemas from SQL Server. That is useful because PostgreSQL schema qualification, default search path behavior, and object placement can now be taught on real business objects instead of synthetic examples.

#### Inventory the preserved application schemas

Use this query when checking whether a migration preserved the intended schema boundary, before documenting search-path behavior, or when validating that the lab still matches the expected bronze/silver/gold shape. It is typically triggered by onboarding into the database or by a note that needs to refer to concrete schema ownership rather than generic examples. The query reads `information_schema.tables`. It is read-only. Its purpose is to show the current application schema surface and how many base tables each schema contains.

| Field | Source | Type | Meaning |
|---|---|---|---|
| `schema_name` | `information_schema.tables.table_schema` | text | Application schema name. |
| `table_count` | `COUNT(*)` | bigint | Number of base tables currently present in that schema. |

*This query inventories the preserved application schemas inside the PostgreSQL `stoxx` database.*

```sql
SELECT
    table_schema AS schema_name,
    COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema IN ('bronze', 'silver', 'gold', 'dbo', 'demo_stc')
  AND table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY table_schema;
```

| schema_name | table_count |
|---|---:|
| bronze | 12 |
| dbo | 2 |
| demo_stc | 5 |
| gold | 3 |
| silver | 7 |

The schema boundary survived the migration cleanly. That gives the PostgreSQL chapter a real object-placement surface for teaching explicit qualification, search-path caution, and the distinction between business schemas such as `bronze` and `silver` versus compatibility or demo schemas such as `dbo` and `demo_stc`.

## Creation and Placement Guidance

The live catalog queries above are enough to define the operational baseline. The next step is deciding which PostgreSQL creation-time choices should remain defaulted and which ones should always be explicit in production notes and templates.

### What `CREATE DATABASE` decides in PostgreSQL

PostgreSQL database creation should be treated as a small set of high-leverage decisions rather than a long storage script.

| Decision | PostgreSQL control | Current `stoxx` value | Why it matters |
|---|---|---|---|
| Owner | `OWNER` | `postgres` | Controls who can drop, alter, and govern the database. Production ownership should normally be a stable administrative role, not whichever superuser happened to create it. |
| Template ancestry | `TEMPLATE` | implied `template1` clone | Decides which objects and defaults are inherited at creation time. |
| Encoding | `ENCODING` | `UTF8` | Shapes text representation and interoperability. |
| Locale | `LC_COLLATE`, `LC_CTYPE` | `en_US.utf8` | Affects sort order, text comparisons, and some index behavior. |
| Default tablespace | `TABLESPACE` | `pg_default` | Sets the physical placement baseline for the database. |
| Connection ceiling | `CONNECTION LIMIT` | `-1` | Applies a per-database cap when operational isolation requires it. |

For most ordinary transactional or analytical PostgreSQL databases, the right day-one posture is still simple: explicit owner, explicit template choice when needed, UTF-8 encoding, deliberate locale, and `pg_default` until a real placement boundary exists.

### When to introduce non-default tablespaces

Staying on `pg_default` is the correct answer until the workload creates a measurable placement need, such as isolating a very large cold archive, steering a specific index family to different storage, or separating temporary or bulk-ingest pressure from the main heap area with an operational reason that can be defended.

> [!warning]- Tablespaces are an operational boundary, not a decorative one
>
> PostgreSQL tablespaces change physical placement and operational procedures. They should appear only when there is a real storage or lifecycle reason to carry that extra complexity.
>
> > [!danger] Splitting placement without a measurable need
> >
> > Adding tablespaces because SQL Server used filegroups, or because "more storage objects must be better", creates operational overhead without improving the workload. Backup, restore, failover, and filesystem provisioning all become more complicated immediately.
>
> > [!success] Add a tablespace only for a real placement policy
> >
> > Introduce a custom tablespace when there is a concrete storage boundary to enforce: separate retention tiers, different I/O classes, or a specific object family whose placement must differ from the default. Then keep the rule explicit in DDL and automation.

### Anti-patterns to avoid

- Treating PostgreSQL tablespaces as one-to-one replacements for SQL Server filegroups. They are useful, but the operational model is different and much coarser.
- Modifying `template1` casually. Any site-local object or setting added there silently becomes future database policy.
- Guessing file paths from schema and table names instead of resolving them through `pg_relation_filepath()`.
- Assuming WAL is per database. PostgreSQL WAL is cluster-wide, so one database's heavy writes can still create cluster-level log pressure.
- Leaving owner choice implicit in production automation. The creating role becomes the owner unless the script says otherwise.
