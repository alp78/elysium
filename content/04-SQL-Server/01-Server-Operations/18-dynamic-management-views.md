---
title: "18 - Dynamic Management Views — Chapter Reference"
tags:
  - sql-server
  - reference
  - administration
aliases:
  - DMV reference
  - SQL Server DMV catalog
  - sys.dm reference
  - dynamic management views
description: "Complete chapter-wide reference for all 63 sys.dm_* DMVs, 8 sys.fn_* system functions, and catalog view/stored procedure index used across SQL Server chapter 04. Per-DMV column tables, purpose summaries, and cross-reference links to every vault page where each object appears."
created: 2026-04-12
updated: 2026-04-12
status: complete
---

# Dynamic Management Views — Chapter Reference

> [!abstract] Scope and purpose of this reference
>
> This page catalogs the **63 dynamic management views (DMVs)** and **8 system functions** used across the SQL Server chapter. Each entry documents purpose, required permissions, key columns with types and operational meaning, and cross-reference links to every vault page where the object appears. Two appendices index the **catalog views** and **system stored procedures** referenced in the chapter.

Dynamic management views and functions return server state information used to monitor instance health, diagnose performance problems, and tune queries. All DMVs and DMFs live in the `sys` schema and follow the naming convention `sys.dm_*`. They require `VIEW SERVER STATE` or `VIEW DATABASE STATE` permission depending on scope. Counter-based DMVs accumulate from instance startup and reset on restart unless otherwise noted.

> [!tip] How to use this page
>
> - **Quick lookup:** the index table below lists every DMV with its category, purpose, and source pages.
> - **Full reference:** scroll to the category section or use `Ctrl+F` to find a specific DMV name.
> - **Cross-references:** each entry links to every vault page where the DMV appears with a live query or detailed explanation.

## Quick-Lookup Index

**Source page legend — abbreviated codes map to page numbers within each subfolder:**

**SO (Server Operations):** 01 config · 02 sqlcmd · 03 auth · 04 roles · 05 agent · 06 dba-queries · 07 backup · 08 restore · 09 ha-overview · 10 always-on · 11 memory · 12 audit · 13 tde · 14 problems · 15 flowcharts · 16 perf-audit · 17 finops

**DDS (Database Design and Storage):** 01 file-layout · 02 internals · 03 schemas · 04 keys · 05 schema-layering · 06 index-types · 07 index-maint · 08 compression · 09 partitioning · 10 change-tracking

**QWO (Query Writing and Optimization):** 02 data-types · 04 ctes · 05 windows · 07 strings · 08 datetime · 09 json-xml · 10 insert-update-delete · 11 merge · 12 sargable · 13 exec-plans · 14 wait-stats · 15 sys-functions · 16 blocking · 17 deadlocks · 18 race-conditions · 19 stored-procs · 20 query-store

**APP (Applied Pipelines):** 01 loading · 02 bronze · 03 silver · 04 gold · 05 incremental · 06 pit-integrity · 07 devex · 08 anti-patterns

| DMV | Category | Purpose | Source Pages |
|---|---|---|---|
| `sys.dm_exec_requests` | Execution | Currently executing request state | SO:06,08,14,15,16 · DDS:04 · QWO:13,14,15,16 |
| `sys.dm_exec_sessions` | Execution | Authenticated session details | SO:02,03,06,11,16 · DDS:06 · QWO:13,15,16,18 · APP:07 |
| `sys.dm_exec_query_stats` | Execution | Aggregate performance stats for cached plans | SO:06,11,14,16 · DDS:06 · QWO:13 |
| `sys.dm_exec_sql_text` | Execution | SQL text for a given sql_handle | SO:06,11,14,15,16 · DDS:06 · QWO:15,16 · APP:07 |
| `sys.dm_exec_query_plan` | Execution | Showplan XML for a cached plan | SO:14,16 · DDS:06 · QWO:13 |
| `sys.dm_exec_cached_plans` | Execution | All plans in the plan cache | SO:11,16,17 · APP:07 |
| `sys.dm_exec_connections` | Execution | Physical connection details | SO:02,03 · QWO:15 |
| `sys.dm_exec_query_memory_grants` | Execution | Queries holding or waiting for memory grants | SO:11,16 |
| `sys.dm_exec_plan_attributes` | Execution | Plan cache entry attributes | SO:16 |
| `sys.dm_exec_query_optimizer_memory_gateways` | Execution | Concurrent query optimization memory | SO:11 |
| `sys.dm_exec_query_resource_semaphores` | Execution | Query memory grant semaphore state | SO:11 |
| `sys.dm_exec_query_plan_stats` | Execution | Last known actual execution plan | QWO:13 |
| `sys.dm_exec_query_statistics_xml` | Execution | In-flight runtime statistics as XML | QWO:13 |
| `sys.dm_os_wait_stats` | OS / Memory | Aggregate wait statistics since startup | SO:06,09,10,11,14,15,16,17 · DDS:01 · QWO:13,14,16 |
| `sys.dm_os_sys_info` | OS / Memory | Server-level hardware and config info | SO:01,06,11,16,17 · DDS:07 · QWO:13,14,15 |
| `sys.dm_os_memory_clerks` | OS / Memory | Active memory clerk allocations | SO:11,16,17 |
| `sys.dm_os_performance_counters` | OS / Memory | SQL Server performance counter values | SO:11,16 · QWO:14,15 |
| `sys.dm_os_buffer_descriptors` | OS / Memory | Buffer pool page inventory | SO:11,16 |
| `sys.dm_os_process_memory` | OS / Memory | SQL Server process memory from OS perspective | SO:11,17 |
| `sys.dm_os_sys_memory` | OS / Memory | System-wide physical memory state | SO:11,17 |
| `sys.dm_os_volume_stats` | OS / Memory | OS volume I/O statistics | SO:15,17 · QWO:14 |
| `sys.dm_os_memory_cache_counters` | OS / Memory | Cache health snapshot | SO:11 |
| `sys.dm_os_ring_buffers` | OS / Memory | Internal ring buffer records | QWO:15 |
| `sys.dm_os_workers` | OS / Memory | Worker thread state | QWO:15 |
| `sys.dm_db_index_physical_stats` | Indexes | Index size and fragmentation | SO:06,14,16 · DDS:01,02,03,04,06,07 |
| `sys.dm_db_index_operational_stats` | Indexes | Per-index I/O, locking, latching activity | SO:15 · DDS:02,06,07,08 · QWO:16 |
| `sys.dm_db_index_usage_stats` | Indexes | Index operation counts by type | SO:15,17 · DDS:06,07 · QWO:09,11,12,15 |
| `sys.dm_db_missing_index_details` | Indexes | Missing index column recommendations | SO:06,15 · DDS:06,07 · QWO:13 |
| `sys.dm_db_missing_index_group_stats` | Indexes | Missing index group impact stats | SO:06,15 · DDS:06,07 |
| `sys.dm_db_missing_index_groups` | Indexes | Missing index group membership | SO:06,15 · DDS:06,07 |
| `sys.dm_io_virtual_file_stats` | Files / Space | Data and log file I/O statistics | SO:06,14,16 · QWO:14,15 |
| `sys.dm_db_log_space_usage` | Files / Space | Transaction log space consumption | SO:06,14,17 · DDS:01,02,03 |
| `sys.dm_db_log_info` | Files / Space | Virtual log file (VLF) details | SO:08,16,17 · DDS:01,02 |
| `sys.dm_db_file_space_usage` | Files / Space | Data file space breakdown | SO:15,16 · DDS:02 |
| `sys.dm_db_log_stats` | Files / Space | Transaction log summary statistics | DDS:02 |
| `sys.dm_db_database_page_allocations` | Files / Space | Per-page allocation map | DDS:02 |
| `sys.dm_db_page_info` | Files / Space | Single-page metadata lookup | DDS:02 |
| `sys.dm_db_partition_stats` | Statistics | Partition-level page and row counts | SO:06 · DDS:08,09 |
| `sys.dm_db_stats_properties` | Statistics | Statistics object properties and staleness | SO:14,16 · DDS:07 |
| `sys.dm_db_column_store_row_group_physical_stats` | Statistics | Columnstore rowgroup health | SO:16 · DDS:03,06,07 |
| `sys.dm_db_persisted_sku_features` | Statistics | Edition-locked features in use | SO:17 |
| `sys.dm_db_xtp_hash_index_stats` | Statistics | In-Memory OLTP hash index stats | DDS:03 |
| `sys.dm_os_waiting_tasks` | Transactions | Tasks currently waiting on a resource | SO:06,14,15 · QWO:16 |
| `sys.dm_tran_active_transactions` | Transactions | Currently active transactions | SO:06,07,14,16 · QWO:15 |
| `sys.dm_tran_locks` | Transactions | Currently held lock resources | SO:15 · QWO:16,18 |
| `sys.dm_tran_session_transactions` | Transactions | Session-to-transaction correlation | SO:06,14 · QWO:15 |
| `sys.dm_tran_database_transactions` | Transactions | Database-level transaction state | SO:06,16 |
| `sys.dm_tran_version_store` | Transactions | Tempdb version store records | SO:11 |
| `sys.dm_tran_version_store_space_usage` | Transactions | Version store space per database | SO:14,16 · DDS:01 |
| `sys.dm_hadr_database_replica_states` | HADR | AG database replica health | SO:09,10,14,15 |
| `sys.dm_hadr_availability_replica_states` | HADR | AG replica connection and sync state | SO:09,10 |
| `sys.dm_hadr_cluster` | HADR | WSFC cluster-level info | SO:09 |
| `sys.dm_hadr_cluster_members` | HADR | Cluster node membership and state | SO:09 |
| `sys.dm_hadr_automatic_seeding` | HADR | Automatic seeding progress | SO:09,10 |
| `sys.dm_xe_sessions` | Audit / XE | Active Extended Event sessions | SO:14,15,16 · QWO:17 |
| `sys.dm_xe_session_targets` | Audit / XE | XE session target configuration | SO:14,15,16 · QWO:17 |
| `sys.dm_audit_actions` | Audit / XE | All audit action definitions | SO:12 |
| `sys.dm_audit_class_type_map` | Audit / XE | Audit class type mappings | SO:12 |
| `sys.dm_server_audit_status` | Audit / XE | Current server audit state | SO:12 |
| `sys.dm_database_encryption_keys` | Server State | Database encryption key state | SO:13,14 |
| `sys.dm_server_services` | Server State | SQL Server service information | DDS:01 |
| `sys.dm_server_suspend_status` | Server State | Server suspend state | SO:17 |
| `sys.dm_cdc_errors` | Server State | CDC log scan errors | DDS:10 |

---

## Execution and Query Runtime

> [!abstract] Session monitoring, query performance, and plan cache inspection
>
> The 13 DMVs in this category form the core diagnostic toolkit for understanding what the instance is doing right now, how queries have performed historically, and what sits in the plan cache. `dm_exec_requests` joined to `dm_exec_sessions` and cross-applied to `dm_exec_sql_text` is the foundational three-way pattern used throughout the chapter.

### SQL Server | sys.dm_exec_requests | currently executing request state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [restore-and-recovery](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/08-restore-and-recovery) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [keys-defaults-identity-and-sequences](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/04-keys-defaults-identity-and-sequences) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking)

Returns one row per currently executing request. The primary DMV for real-time session monitoring, blocking analysis, and wait diagnostics. Cross-apply with `sys.dm_exec_sql_text(sql_handle)` to resolve the executing statement and `sys.dm_exec_query_plan(plan_handle)` to retrieve the cached plan.

> [!info]- sys.dm_exec_requests — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | smallint | SPID of the session owning this request |
> | request_id | int | Request identifier within the session; 0 for the main request |
> | start_time | datetime | Timestamp when the request arrived |
> | status | nvarchar(30) | `running`, `runnable`, `suspended`, `sleeping`, or `background` |
> | command | nvarchar(32) | Current command type: `SELECT`, `INSERT`, `BACKUP DATABASE`, `DBCC`, etc. |
> | sql_handle | varbinary(64) | Hash token identifying the batch text; pass to `sys.dm_exec_sql_text()` |
> | statement_start_offset | int | Byte position within the batch where the current statement begins |
> | statement_end_offset | int | Byte position where the current statement ends; −1 means end of batch |
> | plan_handle | varbinary(64) | Hash token identifying the compiled plan; pass to `sys.dm_exec_query_plan()` |
> | database_id | smallint | Database context; join to `sys.databases` on `database_id` |
> | user_id | int | Submitting user; does not uniquely identify users across databases |
> | connection_id | uniqueidentifier | Physical connection identifier; join to `sys.dm_exec_connections` |
> | blocking_session_id | smallint | SPID of the session holding a conflicting lock; 0 = not blocked, −2 = orphaned distributed transaction, −3 = deferred recovery |
> | wait_type | nvarchar(60) | Current wait type if status = `suspended`; NULL when actively running |
> | wait_time | int | Milliseconds spent on the current wait; 0 when running |
> | last_wait_type | nvarchar(60) | Most recent wait type, even if the request is no longer waiting |
> | wait_resource | nvarchar(256) | Lock resource description when waiting on a lock; format varies by resource type |
> | open_transaction_count | int | Number of open transactions for this request |
> | transaction_id | bigint | Transaction under which the request executes; join to `sys.dm_tran_active_transactions` |
> | percent_complete | real | Completion percentage for `BACKUP`, `RESTORE`, `DBCC CHECKDB`, `ALTER INDEX REORGANIZE`, and a few other long-running commands |
> | estimated_completion_time | bigint | Estimated remaining time in milliseconds for commands that report `percent_complete` |
> | cpu_time | int | CPU time consumed by this request in milliseconds |
> | total_elapsed_time | int | Wall-clock time since `start_time` in milliseconds |
> | scheduler_id | int | ID of the scheduler (logical CPU) running this request |
> | reads | bigint | Physical reads performed by this request |
> | writes | bigint | Physical writes performed by this request |
> | logical_reads | bigint | Logical reads (buffer pool page lookups) by this request |
> | granted_query_memory | int | Number of 8 KB pages granted for query workspace memory |
> | row_count | bigint | Rows returned to the client so far |
> | nest_level | int | Current nesting level of stored procedure execution; 0 = top-level |
> | transaction_isolation_level | smallint | 0 = Unspecified, 1 = ReadUncommitted, 2 = ReadCommitted, 3 = RepeatableRead, 4 = Serializable, 5 = Snapshot |
> | lock_timeout | int | Lock timeout in milliseconds; −1 = wait indefinitely |
> | deadlock_priority | int | Session deadlock priority; range −10 to 10, default 0 |
> | query_hash | binary(8) | Hash of the query text; identical queries share this value regardless of literal values |
> | query_plan_hash | binary(8) | Hash of the execution plan shape |
> | dop | int | Degree of parallelism for this request |
> | parallel_worker_count | int | Number of reserved parallel workers |
> | page_resource | binary(8) | Page resource being waited on (SQL Server 2019+); decode with `sys.dm_db_page_info()` |
>
> SET option columns (`quoted_identifier`, `arithabort`, `ansi_nulls`, `ansi_warnings`, `ansi_padding`, `concat_null_yields_null`, `ansi_null_dflt_on`) are omitted — they reflect the session SET options active during request compilation and are rarely needed for diagnostics.

---

### SQL Server | sys.dm_exec_sessions | authenticated session details

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [sqlcmd-connection-and-usage](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/02-sqlcmd-connection-and-usage) · [sql-server-authentication](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/03-sql-server-authentication) · [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking) · [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/18-race-conditions) · [pipeline-integration-and-devex](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/07-pipeline-integration-and-devex)

Returns one row per authenticated session on the instance, including both user and system sessions. The most-referenced DMV in the chapter — it provides the identity, resource usage, and status baseline for every connected SPID.

> [!info]- sys.dm_exec_sessions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | smallint | Session SPID; system sessions are ≤ 50 |
> | login_time | datetime | Time the session was established |
> | host_name | nvarchar(128) | Client workstation name; NULL for internal sessions |
> | program_name | nvarchar(128) | Application name from the connection string |
> | host_process_id | int | Client OS process ID |
> | client_version | int | TDS protocol version of the client library |
> | client_interface_name | nvarchar(32) | Client library name (e.g., `.Net SqlClient Data Provider`, `ODBC`) |
> | security_id | varbinary(85) | Windows SID of the login principal |
> | login_name | nvarchar(128) | SQL Server login name or Windows principal |
> | nt_domain | nvarchar(128) | Windows domain for Windows Authentication logins |
> | nt_user_name | nvarchar(128) | Windows user name for Windows Authentication logins |
> | status | nvarchar(30) | `running`, `sleeping`, `dormant`, `preconnect` |
> | cpu_time | int | Cumulative CPU time in milliseconds across all requests in this session |
> | memory_usage | int | Number of 8 KB pages of memory used by this session |
> | total_scheduled_time | int | Total time the session and its requests were scheduled for execution, in milliseconds |
> | total_elapsed_time | int | Wall-clock time since the session was established, in milliseconds |
> | endpoint_id | int | Endpoint used for the connection |
> | last_request_start_time | datetime | Start time of the most recent request |
> | last_request_end_time | datetime | Completion time of the most recent request |
> | reads | bigint | Cumulative physical reads across all requests in this session |
> | writes | bigint | Cumulative physical writes |
> | logical_reads | bigint | Cumulative logical reads |
> | is_user_process | bit | 0 = system session, 1 = user session; filter on this for diagnostics |
> | transaction_isolation_level | smallint | Same encoding as `dm_exec_requests`: 1–5 |
> | lock_timeout | int | Lock timeout in milliseconds |
> | deadlock_priority | int | Deadlock priority; −10 to 10 |
> | row_count | bigint | Rows returned by the last completed request |
> | original_login_name | nvarchar(128) | Login name before any `EXECUTE AS` impersonation |
> | last_successful_logon | datetime | Last successful login time before the current session |
> | last_unsuccessful_logon | datetime | Last failed login attempt before the current session |
> | database_id | smallint | Current database context; 0 if no database selected |
> | open_transaction_count | int | Number of open transactions for the session |
> | group_id | int | Workload group ID for Resource Governor |
>
> SET option columns and `context_info` (varbinary(128) user-set session context) omitted for brevity.

---

### SQL Server | sys.dm_exec_query_stats | aggregate performance statistics for cached plans

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart or plan eviction
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans)

Returns one row per statement within a cached plan, with aggregate execution metrics since the plan was compiled. The primary DMV for identifying expensive queries, regression detection, and resource-consumption ranking. Cross-apply with `sys.dm_exec_sql_text(sql_handle)` and `sys.dm_exec_query_plan(plan_handle)` to resolve text and plan XML.

> [!info]- sys.dm_exec_query_stats — column reference
>
> **Identifier and metadata columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | sql_handle | varbinary(64) | Hash identifying the batch or stored procedure |
> | statement_start_offset | int | Byte offset within the batch where the statement begins |
> | statement_end_offset | int | Byte offset where the statement ends; −1 = end of batch |
> | plan_generation_num | bigint | Sequence number distinguishing recompiled plan versions |
> | plan_handle | varbinary(64) | Hash identifying the compiled plan |
> | creation_time | datetime | Time the plan was compiled |
> | last_execution_time | datetime | Last time the plan started executing |
> | execution_count | bigint | Number of executions since compilation |
> | query_hash | binary(8) | Hash of the query text; identical queries share this regardless of literal values |
> | query_plan_hash | binary(8) | Hash of the execution plan shape; identifies plan reuse across different parameter values |
>
> **Per-execution metric columns** — each metric has four variants: `total_*` (cumulative since compilation), `last_*` (most recent execution), `min_*` (lowest single execution), `max_*` (highest single execution). All are `bigint`.
>
> | Metric prefix | Unit | Meaning |
> |---|---|---|
> | worker_time | µs | CPU time consumed |
> | elapsed_time | µs | Wall-clock duration |
> | physical_reads | 8 KB pages | Pages read from disk |
> | logical_reads | 8 KB pages | Pages read from buffer pool |
> | logical_writes | 8 KB pages | Pages written |
> | clr_time | µs | Time spent in CLR objects |
> | rows | rows | Rows returned |
> | dop | degree | Degree of parallelism used |
> | grant_kb | KB | Memory grant size |
> | used_grant_kb | KB | Memory grant actually consumed |
> | ideal_grant_kb | KB | Memory needed to fit all data in memory |
> | reserved_threads | threads | Parallel threads reserved |
> | used_threads | threads | Parallel threads actually used |
> | columnstore_segment_reads | segments | Columnstore segments scanned |
> | columnstore_segment_skips | segments | Columnstore segments eliminated |
> | spills | count | Tempdb spills during execution |
> | num_physical_io_reads | pages | Physical I/O reads (Azure SQL Database / Managed Instance) |
> | page_server_reads | pages | Page server reads (Azure Hyperscale) |
>
> To rank the most expensive queries by CPU: `ORDER BY total_worker_time DESC`. To detect regressions: compare `last_elapsed_time` against `total_elapsed_time / execution_count`.

---

### SQL Server | sys.dm_exec_sql_text | SQL batch text retrieval

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking) · [pipeline-integration-and-devex](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/07-pipeline-integration-and-devex)

Table-valued function invoked as `CROSS APPLY sys.dm_exec_sql_text(sql_handle)`. Returns the full SQL text of a batch, stored procedure, or trigger identified by `sql_handle`.

> [!info]- sys.dm_exec_sql_text — parameter and column reference
>
> **Input parameter:**
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | sql_handle | varbinary(64) | Handle obtained from `dm_exec_requests.sql_handle`, `dm_exec_query_stats.sql_handle`, or `dm_exec_cached_plans` via `dm_exec_plan_attributes` |
>
> **Output columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | dbid | smallint | Database ID; NULL for ad-hoc and prepared statements |
> | objectid | int | Object ID of the stored procedure or trigger; NULL for ad-hoc batches |
> | number | smallint | Numbered procedure group (legacy); 1 for non-grouped procedures |
> | encrypted | bit | 1 = the source text is encrypted and not readable |
> | text | nvarchar(max) | Full SQL text of the batch or module; use `statement_start_offset` / `statement_end_offset` from `dm_exec_requests` or `dm_exec_query_stats` to extract the individual statement with `SUBSTRING` |

---

### SQL Server | sys.dm_exec_query_plan | cached execution plan XML

**Scope:** server-wide · **Permissions:** SHOWPLAN · **Type:** table-valued function
**Used in:** [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans)

Table-valued function invoked as `CROSS APPLY sys.dm_exec_query_plan(plan_handle)`. Returns the showplan XML for an entire cached batch. For statement-level plans, use `sys.dm_exec_text_query_plan` instead.

> [!info]- sys.dm_exec_query_plan — parameter and column reference
>
> **Input parameter:**
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | plan_handle | varbinary(64) | Handle from `dm_exec_requests.plan_handle`, `dm_exec_query_stats.plan_handle`, or `dm_exec_cached_plans.plan_handle` |
>
> **Output columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | dbid | smallint | Database context at compilation time |
> | objectid | int | Object ID if the plan belongs to a stored procedure or trigger |
> | number | smallint | Numbered procedure group (legacy) |
> | encrypted | bit | 1 = plan text is not retrievable because the source module is encrypted |
> | query_plan | xml | Showplan XML for the entire batch; NULL if the plan has been evicted or if the XML exceeds 2 MB (use `sys.dm_exec_text_query_plan` with statement offsets for large plans) |

---

### SQL Server | sys.dm_exec_cached_plans | plan cache inventory

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart or manual `DBCC FREEPROCCACHE`
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [pipeline-integration-and-devex](https://alp78.github.io/elysium/04-SQL-Server/04-Applied-SQL-Server-for-Data-Pipelines/07-pipeline-integration-and-devex)

Returns one row per cached plan entry. Used to audit plan cache size, detect single-use plan bloat, and identify forced plans. Join to `sys.dm_exec_query_stats` on `plan_handle` for per-statement metrics.

> [!info]- sys.dm_exec_cached_plans — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | bucketid | int | Hash bucket ID in the plan cache hash table |
> | refcounts | int | Number of cache objects referencing this plan; plan cannot be evicted while > 0 |
> | usecounts | int | Number of times the plan has been looked up; single-use plans have `usecounts = 1` |
> | size_in_bytes | bigint | Memory consumed by this cache entry |
> | memory_object_address | varbinary(8) | Memory address of the cache entry |
> | cacheobjtype | nvarchar(50) | `Compiled Plan`, `Compiled Plan Stub`, `Parse Tree`, `Extended Proc`, `CLR Compiled Func`, `CLR Compiled Proc` |
> | objtype | nvarchar(20) | Object type: `Proc` (stored procedure), `Adhoc` (ad-hoc batch), `Prepared` (parameterized), `Trigger`, `View`, `Check`, `Default`, `UsrTab`, `SysTab`, `ReplProc` |
> | plan_handle | varbinary(64) | Plan handle; pass to `dm_exec_query_plan()` or join to `dm_exec_query_stats` |
> | pool_id | int | Resource pool ID (Resource Governor) |
> | parent_plan_handle | varbinary(64) | Parent plan handle for nested cached plans |
> | is_forced_plan | bit | 1 = plan is being forced by Query Store `sp_query_store_force_plan` |

---

### SQL Server | sys.dm_exec_connections | physical connection details

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [sqlcmd-connection-and-usage](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/02-sqlcmd-connection-and-usage) · [sql-server-authentication](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/03-sql-server-authentication) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns one row per physical connection. Joins to `sys.dm_exec_sessions` on `session_id`. Provides transport-layer details including protocol, encryption, and network packet sizes.

> [!info]- sys.dm_exec_connections — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | int | Session SPID; join to `dm_exec_sessions` |
> | most_recent_session_id | int | Most recent SPID associated with this connection (connection pooling) |
> | connect_time | datetime | Timestamp when the physical connection was established |
> | net_transport | nvarchar(40) | Transport protocol: `TCP`, `Named pipe`, `Shared memory`, `Session`, `HTTP` |
> | protocol_type | nvarchar(40) | Protocol: `TSQL` or `SOAP` |
> | protocol_version | int | TDS protocol version number |
> | encrypt_option | nvarchar(40) | `TRUE` if connection is encrypted, `FALSE` otherwise |
> | auth_scheme | nvarchar(40) | `SQL`, `NTLM`, `KERBEROS`, or `NEGOTIATE` |
> | node_affinity | smallint | NUMA node the connection has affinity to |
> | num_reads | int | Packet reads on this connection |
> | num_writes | int | Packet writes on this connection |
> | last_read | datetime | Timestamp of last packet read |
> | last_write | datetime | Timestamp of last packet write |
> | net_packet_size | int | Network packet size in bytes used for data transfer |
> | client_net_address | nvarchar(48) | Client IP address |
> | local_net_address | nvarchar(48) | Server IP address for this connection |
> | local_tcp_port | int | Server TCP port |
> | connection_id | uniqueidentifier | Unique connection identifier |
> | most_recent_sql_handle | varbinary(64) | SQL handle of the last request on this connection |

---

### SQL Server | sys.dm_exec_query_memory_grants | memory grant queue and allocation

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook)

Returns one row per query that has acquired a memory grant or is waiting for one. Key DMV for diagnosing `RESOURCE_SEMAPHORE` waits and memory grant feedback issues.

> [!info]- sys.dm_exec_query_memory_grants — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | smallint | Session SPID |
> | request_id | int | Request within the session |
> | scheduler_id | int | Scheduler running the query |
> | dop | smallint | Degree of parallelism |
> | request_time | datetime | When the memory grant was requested |
> | grant_time | datetime | When the grant was fulfilled; NULL if still waiting |
> | requested_memory_kb | bigint | Total memory requested |
> | granted_memory_kb | bigint | Memory actually granted; NULL if waiting |
> | required_memory_kb | bigint | Minimum memory needed to run (hash/sort minimum) |
> | used_memory_kb | bigint | Memory currently in use |
> | max_used_memory_kb | bigint | Peak memory usage |
> | query_cost | float | Estimated query cost from the optimizer |
> | timeout_sec | int | Seconds before the request times out waiting |
> | resource_semaphore_id | smallint | Semaphore pool: 0 = regular, 1 = small-query |
> | queue_id | smallint | Queue within the semaphore |
> | wait_order | int | Position in the wait queue; NULL if grant already obtained |
> | is_next_candidate | bit | 1 = next in line for a grant |
> | wait_time_ms | bigint | Time spent waiting for the grant in milliseconds |
> | plan_handle | varbinary(64) | Plan handle; cross-apply to `dm_exec_query_plan` |
> | sql_handle | varbinary(64) | SQL handle; cross-apply to `dm_exec_sql_text` |
> | ideal_memory_kb | bigint | Memory grant that would eliminate all spills |
> | is_small | bit | 1 = uses the small-query resource semaphore |

---

### SQL Server | sys.dm_exec_plan_attributes | plan cache entry metadata

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook)

Table-valued function invoked as `CROSS APPLY sys.dm_exec_plan_attributes(plan_handle)`. Returns one row per attribute of a cached plan entry, including `dbid`, `objectid`, `set_options`, and `user_id`. Used to determine why two seemingly identical queries compiled into separate plan cache entries.

> [!info]- sys.dm_exec_plan_attributes — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | attribute | nvarchar(128) | Attribute name: `dbid`, `objectid`, `set_options`, `user_id`, `date_format`, `language_id`, etc. |
> | value | sql_variant | Attribute value; cast to appropriate type based on `attribute` name |
> | is_cache_key | bit | 1 = this attribute is part of the cache lookup key; differences cause separate cache entries |

---

### SQL Server | sys.dm_exec_query_optimizer_memory_gateways | optimizer memory concurrency

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool)

Returns the current status of resource semaphores used to throttle concurrent query optimization. Each gateway limits how many compilations can proceed simultaneously to prevent optimizer memory exhaustion.

> [!info]- sys.dm_exec_query_optimizer_memory_gateways — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | pool_id | int | Resource Governor pool ID |
> | name | nvarchar(128) | Gateway name: `Small Gateway`, `Medium Gateway`, `Big Gateway` |
> | max_count | int | Maximum concurrent optimizations allowed through this gateway |
> | active_count | int | Current number of optimizations using this gateway |
> | waiter_count | int | Number of optimizations waiting to enter this gateway |
> | threshold_factor | bigint | Memory threshold factor defining the gateway boundary |

---

### SQL Server | sys.dm_exec_query_resource_semaphores | memory grant semaphore state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool)

Returns the current resource semaphore state for each Resource Governor resource pool. Two semaphores per pool: one for regular queries, one for small queries. Diagnoses whether queries are being throttled on memory grants.

> [!info]- sys.dm_exec_query_resource_semaphores — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | resource_semaphore_id | smallint | 0 = regular query pool, 1 = small-query pool |
> | target_memory_kb | bigint | Memory target for this semaphore based on current workload |
> | max_target_memory_kb | bigint | Maximum possible target memory |
> | total_memory_kb | bigint | Memory currently held by all granted queries |
> | available_memory_kb | bigint | Memory available for new grants |
> | granted_memory_kb | bigint | Total memory granted across all active queries |
> | used_memory_kb | bigint | Memory physically in use |
> | grantee_count | int | Number of queries with active grants |
> | waiter_count | int | Number of queries waiting for a grant |
> | timeout_error_count | bigint | Cumulative timeout errors since startup |
> | forced_grant_count | bigint | Grants forced below requested amount |
> | pool_id | int | Resource Governor pool |

---

### SQL Server | sys.dm_exec_query_plan_stats | last known actual execution plan

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans)

Table-valued function returning the last known actual execution plan equivalent for a previously executed query. Requires `LAST_QUERY_PLAN_STATS` database-scoped configuration to be enabled, or the `QUERY_PLAN_PROFILE` Extended Event / `query_post_execution_plan_profile` lightweight profiling to be active.

> [!info]- sys.dm_exec_query_plan_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | dbid | smallint | Database ID at compilation time |
> | objectid | int | Object ID of stored procedure or trigger |
> | number | smallint | Numbered procedure group (legacy) |
> | encrypted | bit | 1 = plan not retrievable due to source encryption |
> | query_plan | xml | Last known actual execution plan XML with runtime statistics embedded (actual rows, actual executions, memory grant info, tempdb spills) |

---

### SQL Server | sys.dm_exec_query_statistics_xml | in-flight runtime statistics

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans)

Table-valued function invoked as `CROSS APPLY sys.dm_exec_query_statistics_xml(session_id)`. Returns the in-flight actual execution plan for a currently running query. Lightweight profiling infrastructure must be active (enabled by default in SQL Server 2019+).

> [!info]- sys.dm_exec_query_statistics_xml — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | smallint | Target session SPID |
> | request_id | int | Request identifier |
> | sql_handle | varbinary(64) | SQL handle for the executing batch |
> | plan_handle | varbinary(64) | Plan handle for the executing plan |
> | query_plan | xml | Live execution plan XML with actual row counts, memory grant usage, and runtime warnings as they accumulate |

---

## OS and Memory

> [!abstract] Wait statistics, memory allocation, buffer pool, and system-level counters
>
> The 11 DMVs in this category expose the operating system abstraction layer that SQL Server uses to manage scheduling, memory, and I/O. `dm_os_wait_stats` is the single most-referenced DMV in the entire chapter — it appears in 13 source pages.

### SQL Server | sys.dm_os_wait_stats | aggregate wait statistics since startup

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart or `DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR)`
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview) · [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/10-always-on-availability-groups) · [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking)

Returns one row per wait type with cumulative wait counts and durations since the last reset. The foundation of wait-based performance tuning methodology. Filter out benign background waits (`BROKER_TASK_STOP`, `CLR_SEMAPHORE`, `LAZYWRITER_SLEEP`, `SLEEP_TASK`, `WAITFOR`, etc.) to surface actionable wait types.

> [!info]- sys.dm_os_wait_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | wait_type | nvarchar(60) | Wait type name (e.g., `PAGEIOLATCH_SH`, `LCK_M_X`, `CXPACKET`, `SOS_SCHEDULER_YIELD`) |
> | waiting_tasks_count | bigint | Number of waits on this type since startup; high counts on lock waits signal contention |
> | wait_time_ms | bigint | Total wait time in milliseconds including signal wait; the primary metric for ranking |
> | max_wait_time_ms | bigint | Maximum single-wait duration; spikes indicate outlier events |
> | signal_wait_time_ms | bigint | Time between being signaled (resource available) and actually running; high values indicate CPU pressure (scheduler queuing) |
>
> **Derived metric:** `resource_wait_time_ms = wait_time_ms - signal_wait_time_ms` gives the time spent waiting purely for the resource (disk, lock, memory), excluding scheduler queuing.

---

### SQL Server | sys.dm_os_sys_info | server-level hardware and configuration

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/01-server-configuration) · [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns a single row with instance-level hardware visibility: CPU count, memory, scheduler count, and startup time. Used as a baseline denominator for per-core or per-GB metrics.

> [!info]- sys.dm_os_sys_info — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | cpu_ticks | bigint | Current CPU tick counter |
> | ms_ticks | bigint | Milliseconds since the computer started |
> | cpu_count | int | Number of logical CPUs visible to SQL Server (after affinity mask) |
> | hyperthread_ratio | int | Ratio of logical to physical cores; 2 = hyperthreading enabled |
> | physical_memory_kb | bigint | Total physical RAM on the machine in KB |
> | virtual_memory_kb | bigint | Total virtual address space available to the process |
> | committed_kb | bigint | Committed memory in KB from the memory manager |
> | committed_target_kb | bigint | Target committed memory based on `max server memory` |
> | visible_target_kb | bigint | Visible target memory (limited by VAS on 32-bit; same as committed_target_kb on 64-bit) |
> | stack_size_in_bytes | int | Worker thread stack size |
> | os_quantum | bigint | OS time quantum for non-preemptive scheduling |
> | os_error_mode | int | OS error mode |
> | os_priority | int | SQL Server process priority |
> | max_workers_count | int | Maximum number of worker threads |
> | scheduler_count | int | Number of user schedulers (maps to logical CPUs) |
> | scheduler_total_count | int | Total schedulers including system/DAC |
> | deadlock_monitor_serial_number | bigint | Deadlock monitor cycle counter |
> | sqlserver_start_time_ms_ticks | bigint | `ms_ticks` value at SQL Server startup |
> | sqlserver_start_time | datetime | SQL Server instance start time |
> | affinity_type | int | 0 = AUTO, 1 = MANUAL |
> | affinity_type_desc | nvarchar(60) | `AUTO` or `MANUAL` |
> | process_kernel_time_ms | bigint | Cumulative kernel-mode CPU time |
> | process_user_time_ms | bigint | Cumulative user-mode CPU time |
> | socket_count | int | Number of processor sockets |
> | cores_per_socket | int | Physical cores per socket |
> | numa_node_count | int | Number of NUMA nodes |

---

### SQL Server | sys.dm_os_memory_clerks | memory clerk allocation breakdown

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization)

Returns one row per memory clerk with its current allocation. Memory clerks are the internal consumers that request pages from the buffer pool or memory nodes. The top consumers by `pages_kb` reveal where memory is going — `MEMORYCLERK_SQLBUFFERPOOL` (buffer pool), `CACHESTORE_SQLCP` (plan cache), `OBJECTSTORE_LOCK_MANAGER` (lock memory), etc.

> [!info]- sys.dm_os_memory_clerks — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | memory_clerk_address | varbinary(8) | Internal address of the clerk |
> | type | nvarchar(60) | Clerk type name (e.g., `MEMORYCLERK_SQLBUFFERPOOL`, `CACHESTORE_SQLCP`, `MEMORYCLERK_SQLQUERYEXEC`) |
> | name | nvarchar(256) | Internal name of the clerk instance |
> | memory_node_id | smallint | NUMA node hosting this clerk; 64 = non-NUMA aware |
> | pages_kb | bigint | Memory currently allocated to this clerk in KB; primary metric for sizing |
> | virtual_memory_reserved_kb | bigint | Virtual memory reserved by this clerk |
> | virtual_memory_committed_kb | bigint | Virtual memory committed |
> | awe_allocated_kb | bigint | Memory allocated via AWE (32-bit legacy); 0 on 64-bit |
> | shared_memory_reserved_kb | bigint | Shared memory reserved |
> | shared_memory_committed_kb | bigint | Shared memory committed |
> | page_size_in_bytes | bigint | Page size for this allocation: 8192 (regular) or larger (large page allocations) |

---

### SQL Server | sys.dm_os_performance_counters | SQL Server performance counter values

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns one row per performance counter exposed by SQL Server. Counter semantics depend on `cntr_type` — raw values, per-second rates, or ratios requiring a base counter.

> [!info]- sys.dm_os_performance_counters — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | object_name | nchar(128) | Performance object (e.g., `SQLServer:Buffer Manager`, `SQLServer:SQL Statistics`) |
> | counter_name | nchar(128) | Counter name (e.g., `Page life expectancy`, `Batch Requests/sec`, `Buffer cache hit ratio`) |
> | instance_name | nchar(128) | Counter instance; `_Total` for aggregates, database name for per-database counters |
> | cntr_value | bigint | Current counter value; interpretation depends on `cntr_type` |
> | cntr_type | int | Windows performance counter type: 65536 = absolute value, 272696576 = per-second rate (delta between two snapshots), 537003264 = ratio numerator (pair with 1073939712 base) |

---

### SQL Server | sys.dm_os_buffer_descriptors | buffer pool page inventory

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook)

Returns one row per data page currently in the buffer pool. Aggregate by `database_id` and `allocation_unit_id` to determine which databases and tables consume the most buffer pool memory. Expensive on large buffer pools — snapshot can take seconds on instances with hundreds of GB of memory.

> [!info]- sys.dm_os_buffer_descriptors — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database owning this page |
> | file_id | int | File ID within the database |
> | page_id | int | Page number within the file |
> | page_level | int | B-tree level of the page (0 = leaf) |
> | allocation_unit_id | bigint | Allocation unit; join to `sys.allocation_units` to resolve table/index |
> | page_type | nvarchar(60) | `DATA_PAGE`, `INDEX_PAGE`, `IAM_PAGE`, `TEXT_MIX_PAGE`, etc. |
> | row_count | int | Rows on the page |
> | free_space_in_bytes | int | Free space remaining on the page |
> | is_modified | bit | 1 = dirty page (modified since last checkpoint) |
> | numa_node | int | NUMA node hosting the buffer |
> | read_microsec | bigint | Time to read the page from disk into the buffer pool |

---

### SQL Server | sys.dm_os_process_memory | SQL Server process memory from OS

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization)

Returns the process-level memory state from the OS perspective. Complements `dm_os_sys_memory` (system-wide) and `dm_os_memory_clerks` (internal breakdown).

> [!info]- sys.dm_os_process_memory — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | physical_memory_in_use_kb | bigint | Process working set reported by the OS |
> | large_page_allocations_kb | bigint | Memory allocated via large pages (requires Lock Pages in Memory) |
> | locked_page_allocations_kb | bigint | Memory locked in physical RAM |
> | total_virtual_address_space_kb | bigint | Total virtual address space |
> | virtual_address_space_reserved_kb | bigint | Virtual address space reserved |
> | virtual_address_space_committed_kb | bigint | Virtual address space committed |
> | virtual_address_space_available_kb | bigint | Virtual address space available for new allocations |
> | page_fault_count | bigint | Page faults incurred by the process |
> | memory_utilization_percentage | int | Percentage of committed memory in the working set |
> | available_commit_limit_kb | bigint | Available memory for commit from the process perspective |
> | process_physical_memory_low | bit | 1 = process is responding to low physical memory notification from OS |
> | process_virtual_memory_low | bit | 1 = low virtual memory condition detected |

---

### SQL Server | sys.dm_os_sys_memory | system-wide physical memory state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization)

Returns a single row reflecting the OS-reported memory state. Distinct from `dm_os_process_memory` (SQL Server process only) and `dm_os_sys_info` (hardware topology).

> [!info]- sys.dm_os_sys_memory — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | total_physical_memory_kb | bigint | Total physical RAM on the machine |
> | available_physical_memory_kb | bigint | Physical RAM currently available (not committed) |
> | total_page_file_kb | bigint | Total page file size (swap) |
> | available_page_file_kb | bigint | Available page file space |
> | system_cache_kb | bigint | System file cache size |
> | kernel_paged_pool_kb | bigint | Kernel paged pool |
> | kernel_nonpaged_pool_kb | bigint | Kernel nonpaged pool |
> | system_high_memory_signal_state | bit | 1 = Windows high memory resource notification is set (plenty of memory) |
> | system_low_memory_signal_state | bit | 1 = Windows low memory resource notification is set (memory pressure) |
> | system_memory_state_desc | nvarchar(256) | `Available physical memory is high`, `Physical memory usage is steady`, or `Available physical memory is low` |

---

### SQL Server | sys.dm_os_volume_stats | OS volume I/O statistics

**Scope:** database-level · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis)

Table-valued function invoked as `CROSS APPLY sys.dm_os_volume_stats(database_id, file_id)`. Returns OS-level volume information for the drive hosting a database file. Used to check disk free space and volume configuration.

> [!info]- sys.dm_os_volume_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | file_id | int | File ID within the database |
> | volume_mount_point | nvarchar(256) | Volume mount point (e.g., `C:\`, `/var/opt/mssql/`) |
> | volume_id | nvarchar(256) | OS volume GUID |
> | logical_volume_name | nvarchar(256) | Volume label |
> | file_system_type | nvarchar(256) | File system: `NTFS`, `FAT32`, `ReFS`, `ext4`, `xfs` |
> | total_bytes | bigint | Total volume capacity in bytes |
> | available_bytes | bigint | Free space on the volume in bytes |
> | supports_compression | bit | 1 = volume supports file compression |
> | supports_alternate_streams | bit | 1 = volume supports alternate data streams |
> | supports_sparse_files | bit | 1 = volume supports sparse files |
> | is_read_only | bit | 1 = volume is read-only |

---

### SQL Server | sys.dm_os_memory_cache_counters | cache health snapshot

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool)

Returns a snapshot row per cache store (plan cache, token cache, metadata cache, etc.). Useful for identifying cache pressure when `pages_kb` is high but `entries_count` is low (large cached objects) or when `entries_in_use_count` is much smaller than `entries_count` (cache bloat).

> [!info]- sys.dm_os_memory_cache_counters — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | cache_address | varbinary(8) | Internal cache address |
> | name | nvarchar(256) | Cache name |
> | type | nvarchar(60) | Cache type: `CACHESTORE_SQLCP` (SQL plans), `CACHESTORE_OBJCP` (object plans), `CACHESTORE_PHDR` (parse headers), etc. |
> | single_pages_kb | bigint | Single-page allocations in KB |
> | multi_pages_kb | bigint | Multi-page allocations in KB |
> | single_pages_in_use_kb | bigint | Single-page allocations currently in use |
> | multi_pages_in_use_kb | bigint | Multi-page allocations currently in use |
> | entries_count | bigint | Total entries in the cache |
> | entries_in_use_count | bigint | Entries currently being used |

---

### SQL Server | sys.dm_os_ring_buffers | internal ring buffer records

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns internal ring buffer records used for lightweight diagnostics. Records are XML-based and cover connectivity, memory state, scheduler state, and security events. Useful for post-mortem analysis when other DMVs have been reset.

> [!info]- sys.dm_os_ring_buffers — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | ring_buffer_address | varbinary(8) | Address of the ring buffer entry |
> | ring_buffer_type | nvarchar(60) | Ring type: `RING_BUFFER_CONNECTIVITY`, `RING_BUFFER_MEMORY_BROKER`, `RING_BUFFER_SCHEDULER_MONITOR`, `RING_BUFFER_SECURITY_ERROR`, etc. |
> | timestamp | bigint | Internal timestamp (convert relative to `dm_os_sys_info.ms_ticks`) |
> | record | nvarchar(max) | XML record containing the diagnostic payload |

---

### SQL Server | sys.dm_os_workers | worker thread state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns one row per active worker thread. Workers map 1:1 to tasks — each task gets one worker from the thread pool. Monitor `state` and `is_preemptive` to diagnose thread pool exhaustion or extended preemptive waits (external calls like linked servers, CLR, `xp_cmdshell`).

> [!info]- sys.dm_os_workers — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | worker_address | varbinary(8) | Memory address of the worker |
> | status | int | Worker status: 0 = initialized, 1 = running, 2 = runnable, 3 = suspended |
> | is_preemptive | bit | 1 = worker is in preemptive scheduling mode (external call in progress) |
> | is_fiber | bit | 1 = fiber mode (lightweight pooling); deprecated |
> | is_sick | bit | 1 = worker is stuck trying to obtain a spinlock |
> | is_in_cc_exception | bit | 1 = worker is processing a non-SQL exception |
> | is_fatal_exception | bit | 1 = worker received a fatal exception |
> | is_inside_catch | bit | 1 = worker is inside a TRY/CATCH block |
> | context_switch_count | bigint | Number of scheduler context switches |
> | pending_io_count | int | Number of pending physical I/Os |
> | pending_io_byte_count | bigint | Bytes of pending I/O |
> | pending_io_byte_average | int | Average bytes per pending I/O |
> | scheduler_address | varbinary(8) | Scheduler this worker is assigned to |
> | task_bound_result_set | bit | 1 = worker is bound to a result set |
> | processor_group | smallint | Processor group for NUMA |

---

## Database — Indexes

> [!abstract] Index fragmentation, usage tracking, and missing index recommendations
>
> Six DMVs cover the full index lifecycle: physical health (`dm_db_index_physical_stats`), runtime I/O and contention (`dm_db_index_operational_stats`), seek/scan/lookup counters (`dm_db_index_usage_stats`), and the three-part missing index chain (`details` → `groups` → `group_stats`).

### SQL Server | sys.dm_db_index_physical_stats | index size and fragmentation

**Scope:** database or server-wide · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout) · [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals) · [schemas-tables-and-constraints](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/03-schemas-tables-and-constraints) · [keys-defaults-identity-and-sequences](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/04-keys-defaults-identity-and-sequences) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance)

Table-valued function: `sys.dm_db_index_physical_stats(db_id, object_id, index_id, partition_number, mode)`. Returns size, fragmentation, and page density for indexes. The `mode` parameter controls scan depth: `LIMITED` (fast, heap/B-tree page count only), `SAMPLED` (1% leaf-level sample), `DETAILED` (full scan — expensive on large indexes).

> [!info]- sys.dm_db_index_physical_stats — parameter and column reference
>
> **Input parameters:**
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | database_id | smallint | NULL = all databases |
> | object_id | int | NULL = all objects in the database |
> | index_id | int | NULL = all indexes on the object; 0 = heap |
> | partition_number | int | NULL = all partitions |
> | mode | nvarchar(20) | `LIMITED`, `SAMPLED`, or `DETAILED`; NULL defaults to `LIMITED` |
>
> **Output columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Database containing the index |
> | object_id | int | Table or view object ID |
> | index_id | int | Index ID; 0 = heap, 1 = clustered |
> | partition_number | int | 1-based partition number |
> | index_type_desc | nvarchar(60) | `HEAP`, `CLUSTERED INDEX`, `NONCLUSTERED INDEX`, `COLUMNSTORE`, etc. |
> | alloc_unit_type_desc | nvarchar(60) | `IN_ROW_DATA`, `LOB_DATA`, or `ROW_OVERFLOW_DATA` |
> | index_depth | tinyint | Number of index levels including leaf |
> | index_level | tinyint | Current level; 0 = leaf |
> | avg_fragmentation_in_percent | float | Logical fragmentation percentage; > 30% → rebuild, 10–30% → reorganize |
> | fragment_count | bigint | Number of fragments (groups of consecutive pages) at the leaf level |
> | avg_fragment_size_in_pages | float | Average pages per fragment |
> | page_count | bigint | Total pages at the scanned level |
> | avg_page_space_used_in_percent | float | Average page fullness; low values indicate wasted space (requires `SAMPLED` or `DETAILED`) |
> | record_count | bigint | Total records at the scanned level |
> | ghost_record_count | bigint | Ghost records pending cleanup by the ghost cleanup task |
> | version_ghost_record_count | bigint | Ghost records retained by active snapshot transactions |
> | min_record_size_in_bytes | int | Minimum record size |
> | max_record_size_in_bytes | int | Maximum record size |
> | avg_record_size_in_bytes | float | Average record size |
> | forwarded_record_count | bigint | Forwarded records in a heap (rows that moved due to update); high values degrade heap scan performance |
> | compressed_page_count | bigint | Pages using page compression |
> | columnstore_delete_buffer_state_desc | nvarchar(60) | Columnstore delete buffer state (SQL Server 2016+) |

---

### SQL Server | sys.dm_db_index_operational_stats | per-index I/O, locking, and latching

**Scope:** database or server-wide · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function · **Resets:** instance restart
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance) · [table-compression](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/08-table-compression) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking)

Table-valued function: `sys.dm_db_index_operational_stats(db_id, object_id, index_id, partition_number)`. Returns cumulative low-level I/O, row-lock, page-lock, latch, and insert/update/delete activity per index partition. Key DMV for identifying hot indexes causing lock contention or latch waits.

> [!info]- sys.dm_db_index_operational_stats — column reference (key columns)
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Database ID |
> | object_id | int | Table or indexed view |
> | index_id | int | Index ID |
> | partition_number | int | Partition number |
> | leaf_insert_count | bigint | Cumulative leaf-level inserts |
> | leaf_delete_count | bigint | Cumulative leaf-level deletes |
> | leaf_update_count | bigint | Cumulative leaf-level updates |
> | leaf_ghost_count | bigint | Leaf-level ghost records |
> | nonleaf_insert_count | bigint | Non-leaf (intermediate level) inserts |
> | nonleaf_delete_count | bigint | Non-leaf deletes |
> | nonleaf_update_count | bigint | Non-leaf updates |
> | leaf_allocation_count | bigint | Page allocations at leaf level |
> | nonleaf_allocation_count | bigint | Page allocations at non-leaf level |
> | leaf_page_merge_count | bigint | Page merges at leaf (from deletes shrinking pages) |
> | nonleaf_page_merge_count | bigint | Non-leaf page merges |
> | range_scan_count | bigint | Range or table scans started on the index |
> | singleton_lookup_count | bigint | Single-row lookups (seeks) |
> | forwarded_fetch_count | bigint | Rows fetched through a forwarding pointer (heap only) |
> | lob_fetch_in_pages | bigint | LOB pages fetched |
> | lob_fetch_in_bytes | bigint | LOB bytes fetched |
> | lob_orphan_create_count | bigint | Orphan LOB values created |
> | lob_orphan_insert_count | bigint | Orphan LOB values inserted |
> | row_overflow_fetch_in_pages | bigint | Row-overflow pages fetched |
> | row_overflow_fetch_in_bytes | bigint | Row-overflow bytes fetched |
> | row_lock_count | bigint | Cumulative row locks requested |
> | row_lock_wait_count | bigint | Row lock waits (blocking occurred) |
> | row_lock_wait_in_ms | bigint | Total row lock wait time |
> | page_lock_count | bigint | Cumulative page locks requested |
> | page_lock_wait_count | bigint | Page lock waits |
> | page_lock_wait_in_ms | bigint | Total page lock wait time |
> | index_lock_promotion_attempt_count | bigint | Lock escalation attempts |
> | index_lock_promotion_count | bigint | Successful lock escalations |
> | page_latch_wait_count | bigint | Page latch waits (in-memory contention) |
> | page_latch_wait_in_ms | bigint | Total page latch wait time |
> | page_io_latch_wait_count | bigint | Page I/O latch waits (disk read contention) |
> | page_io_latch_wait_in_ms | bigint | Total page I/O latch wait time |
> | tree_page_latch_wait_count | bigint | B-tree page latch waits |
> | tree_page_latch_wait_in_ms | bigint | B-tree page latch wait time |
> | tree_page_io_latch_wait_count | bigint | B-tree I/O latch waits |
> | tree_page_io_latch_wait_in_ms | bigint | B-tree I/O latch wait time |
> | page_compression_attempt_count | bigint | Pages evaluated for page compression |
> | page_compression_success_count | bigint | Pages successfully page-compressed |

---

### SQL Server | sys.dm_db_index_usage_stats | index operation counts by type

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart, database detach, or database offline
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance) · [json-xml-and-semi-structured-data](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/09-json-xml-and-semi-structured-data) · [merge-and-upsert](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/11-merge-and-upsert) · [sargable-queries](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/12-sargable-queries) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns cumulative seek, scan, lookup, and update counters per index. An index with high `user_updates` but zero `user_seeks` and `user_scans` is a candidate for removal — it consumes write overhead without serving reads.

> [!info]- sys.dm_db_index_usage_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Database ID |
> | object_id | int | Table or indexed view |
> | index_id | int | Index ID |
> | user_seeks | bigint | Index seeks from user queries |
> | user_scans | bigint | Index scans (full or range) from user queries |
> | user_lookups | bigint | Key lookups from user queries (nonclustered → clustered) |
> | user_updates | bigint | Index updates from user INSERT, UPDATE, DELETE, MERGE |
> | last_user_seek | datetime | Timestamp of last user seek |
> | last_user_scan | datetime | Timestamp of last user scan |
> | last_user_lookup | datetime | Timestamp of last user lookup |
> | last_user_update | datetime | Timestamp of last user update |
> | system_seeks | bigint | Seeks by internal system queries (auto-stats, DBCC) |
> | system_scans | bigint | Scans by system queries |
> | system_lookups | bigint | Lookups by system queries |
> | system_updates | bigint | Updates by system queries |
> | last_system_seek | datetime | Timestamp of last system seek |
> | last_system_scan | datetime | Timestamp of last system scan |
> | last_system_lookup | datetime | Timestamp of last system lookup |
> | last_system_update | datetime | Timestamp of last system update |

---

### SQL Server | sys.dm_db_missing_index_details | missing index column recommendations

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance) · [execution-plans](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/13-execution-plans)

Returns one row per missing index identified by the query optimizer during compilation. Join to `sys.dm_db_missing_index_groups` (on `index_handle`) and then to `sys.dm_db_missing_index_group_stats` (on `group_handle`) for impact metrics.

> [!info]- sys.dm_db_missing_index_details — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | index_handle | int | Unique identifier for a missing index; join key to `dm_db_missing_index_groups` |
> | database_id | smallint | Database where the missing index was identified |
> | object_id | int | Table needing the index |
> | equality_columns | nvarchar(4000) | Comma-separated list of columns used in `=` predicates |
> | inequality_columns | nvarchar(4000) | Columns used in `<`, `>`, `BETWEEN`, `!=` predicates |
> | included_columns | nvarchar(4000) | Columns needed as INCLUDE columns for covering |
> | statement | nvarchar(4000) | Fully qualified table name (`database.schema.table`) |

---

### SQL Server | sys.dm_db_missing_index_group_stats | missing index group impact

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance)

Returns aggregate impact statistics for each missing index group. The `avg_total_user_cost * avg_user_impact * (user_seeks + user_scans)` formula ranks missing indexes by potential benefit.

> [!info]- sys.dm_db_missing_index_group_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | group_handle | int | Missing index group identifier; join key to `dm_db_missing_index_groups` |
> | unique_compiles | bigint | Number of distinct compilations that would benefit |
> | user_seeks | bigint | User-query seeks the missing index would have served |
> | user_scans | bigint | User-query scans the missing index would have served |
> | last_user_seek | datetime | Last time a user query would have used this index for a seek |
> | last_user_scan | datetime | Last time a user query would have used this index for a scan |
> | avg_total_user_cost | float | Average query cost that would be reduced |
> | avg_user_impact | float | Estimated percentage cost reduction (0–100) |
> | system_seeks | bigint | System-query seeks |
> | system_scans | bigint | System-query scans |
> | last_system_seek | datetime | Last system seek |
> | last_system_scan | datetime | Last system scan |
> | avg_total_system_cost | float | Average system query cost reduction |
> | avg_system_impact | float | System cost reduction percentage |

---

### SQL Server | sys.dm_db_missing_index_groups | missing index group membership

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Resets:** instance restart
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance)

Bridge table linking `dm_db_missing_index_group_stats.group_handle` to `dm_db_missing_index_details.index_handle`. Each group typically contains one missing index, but the optimizer may group related missing indexes together.

> [!info]- sys.dm_db_missing_index_groups — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | index_group_handle | int | Group identifier; join to `dm_db_missing_index_group_stats.group_handle` |
> | index_handle | int | Missing index identifier; join to `dm_db_missing_index_details.index_handle` |

---

## Database — Files and Space

> [!abstract] Transaction log health, data file utilization, and I/O statistics
>
> Seven DMVs cover file-level diagnostics: I/O latency per file (`dm_io_virtual_file_stats`), transaction log VLF layout and space consumption (`dm_db_log_info`, `dm_db_log_space_usage`, `dm_db_log_stats`), data file space breakdown (`dm_db_file_space_usage`), and low-level page allocation inspection (`dm_db_database_page_allocations`, `dm_db_page_info`).

### SQL Server | sys.dm_io_virtual_file_stats | data and log file I/O statistics

**Scope:** database or server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function · **Resets:** instance restart
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/14-wait-stats-analysis) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Table-valued function: `sys.dm_io_virtual_file_stats(database_id, file_id)`. Returns cumulative I/O statistics per database file. The go-to DMV for diagnosing storage latency — compute average read/write latency as `io_stall_read_ms / num_of_reads` and `io_stall_write_ms / num_of_writes`.

> [!info]- sys.dm_io_virtual_file_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Database ID |
> | file_id | smallint | File ID within the database |
> | sample_ms | bigint | Milliseconds since instance startup; use as a delta denominator |
> | num_of_reads | bigint | Cumulative physical reads issued against the file |
> | num_of_bytes_read | bigint | Total bytes read |
> | io_stall_read_ms | bigint | Total time users waited for reads on this file |
> | num_of_writes | bigint | Cumulative physical writes |
> | num_of_bytes_written | bigint | Total bytes written |
> | io_stall_write_ms | bigint | Total time users waited for writes |
> | io_stall | bigint | Total I/O stall time (read + write) |
> | size_on_disk_bytes | bigint | File size on disk in bytes |
> | io_stall_queued_read_ms | bigint | I/O stall time for reads in the Resource Governor I/O queue |
> | io_stall_queued_write_ms | bigint | I/O stall time for writes in the Resource Governor I/O queue |
>
> **Latency thresholds:** average read latency > 20 ms or write latency > 5 ms on data files, or > 2 ms on log files, warrants investigation of storage subsystem or I/O patterns.

---

### SQL Server | sys.dm_db_log_space_usage | transaction log space consumption

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout) · [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals) · [schemas-tables-and-constraints](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/03-schemas-tables-and-constraints)

Returns a single row with log space usage for the current database context. Quick check for log fullness without the overhead of `DBCC SQLPERF(LOGSPACE)`.

> [!info]- sys.dm_db_log_space_usage — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | total_log_size_in_bytes | bigint | Total log file size |
> | used_log_space_in_bytes | bigint | Log space currently in use |
> | used_log_space_in_percent | float | Percentage of log space used; > 80% signals potential log-full risk |
> | log_space_in_bytes_since_last_backup | bigint | Log generated since the last log backup |

---

### SQL Server | sys.dm_db_log_info | virtual log file (VLF) details

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [restore-and-recovery](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/08-restore-and-recovery) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization) · [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout) · [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Returns one row per VLF in the transaction log. Replaces the undocumented `DBCC LOGINFO`. High VLF counts (> 1000) degrade log management operations like backup, restore, and recovery.

> [!info]- sys.dm_db_log_info — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | file_id | smallint | Log file ID |
> | vlf_begin_offset | bigint | Byte offset where this VLF starts within the log file |
> | vlf_size_mb | float | Size of this VLF in MB |
> | vlf_sequence_number | bigint | VLF sequence number; monotonically increasing |
> | vlf_active | bit | 1 = this VLF contains active log records |
> | vlf_status | int | 0 = inactive (reusable), 2 = active (in use) |
> | vlf_parity | tinyint | Parity bit for recovery; alternates between 64 and 128 |
> | vlf_first_lsn | nvarchar(48) | First LSN in this VLF |
> | vlf_create_lsn | nvarchar(48) | LSN of the log record that created this VLF |
> | vlf_encryptor_thumbprint | varbinary(20) | TDE certificate thumbprint if the VLF is encrypted |

---

### SQL Server | sys.dm_db_file_space_usage | data file space breakdown

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Returns one row per data file showing the breakdown of allocated vs. unallocated space. Particularly useful for `tempdb` to identify version store, internal object, and user object consumption.

> [!info]- sys.dm_db_file_space_usage — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Database ID |
> | file_id | smallint | File ID |
> | filegroup_id | smallint | Filegroup containing this file |
> | total_page_count | bigint | Total pages in the file |
> | allocated_extent_page_count | bigint | Pages in allocated extents |
> | unallocated_extent_page_count | bigint | Pages in unallocated extents (free space) |
> | version_store_reserved_page_count | bigint | Pages reserved for version store (tempdb only) |
> | user_object_reserved_page_count | bigint | Pages reserved by user objects like temp tables (tempdb) |
> | internal_object_reserved_page_count | bigint | Pages reserved by internal objects like sort spills (tempdb) |
> | mixed_extent_page_count | bigint | Allocated pages in mixed extents |
> | modified_extent_page_count | bigint | Pages modified since last full backup (supports differential sizing) |

---

### SQL Server | sys.dm_db_log_stats | transaction log summary statistics

**Scope:** database · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function
**Used in:** [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Table-valued function: `sys.dm_db_log_stats(database_id)`. Returns a single row with summary transaction log statistics including recovery model, backup timestamps, and log reuse wait reason. Provides a superset of information compared to `sys.databases` log columns.

> [!info]- sys.dm_db_log_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | recovery_model | nvarchar(60) | `SIMPLE`, `FULL`, or `BULK_LOGGED` |
> | log_min_lsn | nvarchar(24) | Current start-of-active-log LSN |
> | log_end_lsn | nvarchar(24) | LSN of the last log record |
> | current_vlf_sequence_number | bigint | Current VLF sequence number at the time of call |
> | current_vlf_size_mb | float | Size of the current active VLF |
> | total_vlf_count | bigint | Total VLFs in the log |
> | total_log_size_mb | float | Total transaction log size |
> | active_vlf_count | bigint | Active VLFs |
> | active_log_size_mb | float | Active log size |
> | log_truncation_holdup_reason | nvarchar(60) | Why the log cannot truncate: `LOG_BACKUP`, `ACTIVE_TRANSACTION`, `REPLICATION`, `DATABASE_MIRRORING`, `DATABASE_SNAPSHOT_CREATION`, etc. |
> | log_backup_time | datetime | Last log backup completion time |
> | log_backup_lsn | nvarchar(24) | Last log backup LSN |
> | log_since_last_log_backup_mb | float | Log generated since last log backup |
> | log_checkpoint_lsn | nvarchar(24) | LSN of last checkpoint |
> | log_since_last_checkpoint_mb | float | Log generated since last checkpoint |
> | log_recovery_lsn | nvarchar(24) | Recovery LSN |
> | log_recovery_size_mb | float | Log that would need to be redone during recovery |
> | recovery_vlf_count | bigint | VLFs that would need processing during recovery |

---

### SQL Server | sys.dm_db_database_page_allocations | per-page allocation map

**Scope:** database · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function
**Used in:** [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Undocumented table-valued function: `sys.dm_db_database_page_allocations(db_id, object_id, index_id, partition_id, mode)`. Returns one row per allocated page. Use `mode = 'DETAILED'` for full metadata or `'LIMITED'` for faster results. Extremely expensive on large databases — use only for targeted investigations.

> [!info]- sys.dm_db_database_page_allocations — column reference (key columns)
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | object_id | int | Object owning the page |
> | index_id | int | Index owning the page |
> | partition_id | bigint | Partition ID |
> | allocation_unit_id | bigint | Allocation unit |
> | allocation_unit_type_desc | nvarchar(60) | `IN_ROW_DATA`, `ROW_OVERFLOW_DATA`, `LOB_DATA` |
> | allocated_page_file_id | int | File containing the page |
> | allocated_page_page_id | int | Page number |
> | page_type_desc | nvarchar(60) | `DATA_PAGE`, `INDEX_PAGE`, `IAM_PAGE`, `TEXT_MIX_PAGE`, `PFS_PAGE`, `GAM_PAGE`, `SGAM_PAGE` |
> | is_allocated | bit | 1 = page is allocated |
> | is_iam_page | bit | 1 = page is an IAM page |
> | is_mixed_page_allocation | bit | 1 = page is in a mixed extent |
> | is_page_compressed | bit | 1 = page uses page compression |
> | has_ghost_records | bit | 1 = page contains ghost records |
> | extent_page_id | int | First page of the extent containing this page |

---

### SQL Server | sys.dm_db_page_info | single-page metadata lookup

**Scope:** database · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function
**Used in:** [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Table-valued function: `sys.dm_db_page_info(database_id, file_id, page_id, mode)`. Returns metadata for a single page without the overhead of `DBCC PAGE`. SQL Server 2019+ only. Useful for decoding `page_resource` from `dm_exec_requests` during latch contention analysis.

> [!info]- sys.dm_db_page_info — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | file_id | int | File ID |
> | page_id | int | Page number |
> | page_header_version | int | Page header version |
> | page_type | int | Internal page type code |
> | page_type_desc | nvarchar(64) | `DATA_PAGE`, `INDEX_PAGE`, `IAM_PAGE`, etc. |
> | page_flag_bits | int | Page flags bitmap |
> | page_flag_bits_desc | nvarchar(256) | Decoded flag descriptions |
> | page_level | tinyint | B-tree level; 0 = leaf |
> | object_id | int | Object owning the page |
> | index_id | int | Index owning the page |
> | partition_id | bigint | Partition ID |
> | allocation_unit_id | bigint | Allocation unit |
> | is_encrypted | bit | 1 = page is TDE-encrypted |
> | has_checksum | bit | 1 = page has a checksum |
> | is_iam_pg | bit | 1 = IAM page |
> | is_mixed_ext | bit | 1 = page is in a mixed extent |
> | pfs_page_id | int | PFS page tracking this page |
> | gam_page_id | int | GAM page tracking this page |
> | sgam_page_id | int | SGAM page tracking this page |
> | diff_map_page_id | int | Differential bitmap page |
> | ml_map_page_id | int | Minimally logged bitmap page |

---

## Database — Statistics and Storage

> [!abstract] Partition row counts, statistics staleness, columnstore health, and edition features
>
> Five DMVs for physical storage diagnostics beyond indexes: partition-level sizing (`dm_db_partition_stats`), statistics freshness (`dm_db_stats_properties`), columnstore rowgroup state (`dm_db_column_store_row_group_physical_stats`), edition-locked features (`dm_db_persisted_sku_features`), and In-Memory OLTP hash index stats (`dm_db_xtp_hash_index_stats`).

### SQL Server | sys.dm_db_partition_stats | partition-level page and row counts

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [table-compression](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/08-table-compression) · [partitioning-strategies](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/09-partitioning-strategies)

Returns row and page counts per partition per index. More accurate than `sys.partitions.rows` because it includes in-row, LOB, and row-overflow pages. The lightweight alternative to querying `dm_db_index_physical_stats` when you only need sizes.

> [!info]- sys.dm_db_partition_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | partition_id | bigint | Partition ID; join to `sys.partitions` |
> | object_id | int | Table or indexed view |
> | index_id | int | Index ID; 0 = heap, 1 = clustered |
> | partition_number | int | 1-based partition number |
> | in_row_data_page_count | bigint | Pages used for in-row data |
> | in_row_used_page_count | bigint | Total in-row pages including internal |
> | in_row_reserved_page_count | bigint | Reserved in-row pages (includes free space) |
> | lob_used_page_count | bigint | Pages for LOB storage |
> | lob_reserved_page_count | bigint | Reserved LOB pages |
> | row_overflow_used_page_count | bigint | Row overflow pages |
> | row_overflow_reserved_page_count | bigint | Reserved row overflow pages |
> | used_page_count | bigint | Total used pages across all allocation types |
> | reserved_page_count | bigint | Total reserved pages |
> | row_count | bigint | Approximate row count in this partition |

---

### SQL Server | sys.dm_db_stats_properties | statistics object properties and staleness

**Scope:** database · **Permissions:** VIEW DATABASE STATE · **Type:** table-valued function
**Used in:** [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance)

Table-valued function: `sys.dm_db_stats_properties(object_id, stats_id)`. Returns when a statistics object was last updated, how many rows were sampled, and modification counters. Essential for detecting stale statistics that cause poor query plan choices.

> [!info]- sys.dm_db_stats_properties — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | object_id | int | Object owning the statistics |
> | stats_id | int | Statistics ID; join to `sys.stats` |
> | last_updated | datetime2 | Last time statistics were updated |
> | rows | bigint | Total rows in the table at time of last update |
> | rows_sampled | bigint | Rows sampled during the last update; `rows_sampled / rows` = sample rate |
> | steps | int | Number of histogram steps (max 200) |
> | unfiltered_rows | bigint | Total rows before applying any filter predicate |
> | modification_counter | bigint | Row modifications since last update; high values relative to `rows` indicate stale statistics |
> | persisted_sample_percent | float | Explicitly set sample percentage (SQL Server 2016 SP1+); 0 = auto |

---

### SQL Server | sys.dm_db_column_store_row_group_physical_stats | columnstore rowgroup health

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [schemas-tables-and-constraints](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/03-schemas-tables-and-constraints) · [index-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/06-index-types-and-strategy) · [index-maintenance](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/07-index-maintenance)

Returns one row per rowgroup in a columnstore index with physical state, row counts, and size. Key diagnostic for determining when to run `ALTER INDEX REORGANIZE` (to compress open delta stores or remove deleted rows) or `ALTER INDEX REBUILD`.

> [!info]- sys.dm_db_column_store_row_group_physical_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | object_id | int | Table containing the columnstore index |
> | index_id | int | Columnstore index ID |
> | partition_number | int | Partition number |
> | row_group_id | int | Rowgroup ID within the partition |
> | delta_store_hobt_id | bigint | HoBT ID if this is a delta store rowgroup |
> | state | tinyint | 0 = INVISIBLE, 1 = OPEN (delta store), 2 = CLOSED (delta, ready for compression), 3 = COMPRESSED, 4 = TOMBSTONE |
> | state_desc | nvarchar(60) | Readable state description |
> | total_rows | bigint | Total rows stored in the rowgroup |
> | deleted_rows | bigint | Rows logically deleted but not yet removed; `deleted_rows / total_rows` > 10% = reorganize |
> | size_in_bytes | bigint | Physical size of the rowgroup |
> | trim_reason | tinyint | Reason the rowgroup was compressed before reaching 1,048,576 rows: 1 = DICTIONARY_SIZE, 2 = MEMORY_LIMITATION, 3 = RESIDUAL_ROW_GROUP, 4 = STATS_MISMATCH, 5 = SPILLOVER, 6 = NO_TRIM |
> | trim_reason_desc | nvarchar(60) | Readable trim reason |
> | transition_to_compressed_state | tinyint | How the rowgroup was compressed: 1 = INDEX_BUILD, 2 = TUPLE_MOVER, 3 = REORG_NORMAL, 4 = REORG_FORCED, 5 = BULKLOAD, 6 = MERGE |
> | transition_to_compressed_state_desc | nvarchar(60) | Readable transition description |
> | has_vertipaq_optimization | bit | 1 = vertipaq optimization applied for improved compression |
> | generation | bigint | Generation number associated with this rowgroup |
> | created_time | datetime2 | When the rowgroup was created |
> | closed_time | datetime2 | When the rowgroup was closed (delta stores) |

---

### SQL Server | sys.dm_db_persisted_sku_features | edition-locked features in use

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization)

Returns one row per Enterprise-only feature actively used in the current database. Used during FinOps review to determine if a database can be migrated to Standard Edition or if Enterprise features are blocking a license downgrade.

> [!info]- sys.dm_db_persisted_sku_features — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | feature_name | nvarchar(128) | Feature requiring Enterprise: `Compression`, `Partitioning`, `ColumnStoreIndex`, `InMemoryOLTP`, `Transparent Data Encryption`, etc. |
> | feature_id | int | Feature ID |

---

### SQL Server | sys.dm_db_xtp_hash_index_stats | In-Memory OLTP hash index stats

**Scope:** current database · **Permissions:** VIEW DATABASE STATE
**Used in:** [schemas-tables-and-constraints](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/03-schemas-tables-and-constraints)

Returns hash index statistics for memory-optimized tables. Key diagnostic for detecting undersized bucket counts (high `avg_chain_length`) or oversized allocations (very low `empty_bucket_percent` is bad, but > 90% empty is wasted memory).

> [!info]- sys.dm_db_xtp_hash_index_stats — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | object_id | int | Memory-optimized table |
> | xtp_object_id | int | Internal XTP object identifier |
> | index_id | int | Hash index ID |
> | total_bucket_count | bigint | Configured bucket count (should be 1–2× expected distinct key values) |
> | empty_bucket_count | bigint | Empty buckets; compute `empty_bucket_count / total_bucket_count` for utilization |
> | avg_chain_length | bigint | Average chain length; > 10 signals undersized bucket count causing linear scans |
> | max_chain_length | bigint | Maximum chain length |

---

## Transactions and Locking

> [!abstract] Active transactions, lock inventory, version store, and task-level wait detail
>
> Seven DMVs for transaction lifecycle and concurrency monitoring. `dm_tran_locks` identifies what is locked and by whom; `dm_os_waiting_tasks` shows who is waiting and for what resource right now; `dm_tran_active_transactions` + `dm_tran_session_transactions` + `dm_tran_database_transactions` form a three-table join chain from transaction → session → database-level activity. The version store DMVs track tempdb consumption under snapshot isolation and read-committed snapshot.

### SQL Server | sys.dm_os_waiting_tasks | tasks currently waiting on a resource

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking)

Returns one row per task that is currently waiting. Unlike `dm_os_wait_stats` (aggregate since startup), this shows the real-time wait picture. Joins to `dm_exec_sessions` on `session_id` and to `dm_exec_requests` for full context.

> [!info]- sys.dm_os_waiting_tasks — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | waiting_task_address | varbinary(8) | Address of the waiting task |
> | session_id | smallint | Session SPID owning the task |
> | exec_context_id | int | Execution context (parallel thread index); 0 = coordinator |
> | wait_duration_ms | bigint | Total wait time in milliseconds for the current wait |
> | wait_type | nvarchar(60) | Type of wait (e.g., `LCK_M_X`, `PAGEIOLATCH_SH`, `CXPACKET`) |
> | resource_address | varbinary(8) | Address of the resource being waited on |
> | blocking_task_address | varbinary(8) | Address of the task holding the resource; NULL if not blocked |
> | blocking_session_id | smallint | SPID of the blocking session; NULL if not blocked by another session |
> | blocking_exec_context_id | int | Execution context of the blocker |
> | resource_description | nvarchar(3072) | Description of the waited resource; format depends on wait type |

---

### SQL Server | sys.dm_tran_active_transactions | currently active transactions

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [backup-types-and-strategy](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/07-backup-types-and-strategy) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Returns one row per active transaction. Join to `dm_tran_session_transactions` on `transaction_id` to find the owning session, then to `dm_tran_database_transactions` for database-level impact. Long-running transactions block log truncation and version store cleanup.

> [!info]- sys.dm_tran_active_transactions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | transaction_id | bigint | Transaction ID; primary key and join key |
> | name | nvarchar(32) | Transaction name; `user_transaction` for explicit, `implicit_transaction` for implicit mode |
> | transaction_begin_time | datetime | When the transaction started |
> | transaction_type | int | 1 = read/write, 2 = read-only, 3 = system, 4 = distributed |
> | transaction_uow | uniqueidentifier | Unit of work for distributed transactions; NULL for local |
> | transaction_state | int | 0 = not fully initialized, 1 = initialized but not started, 2 = active, 3 = ended (read-only), 4 = commit initiated (distributed), 5 = prepared, 6 = committed, 7 = rolling back, 8 = rolled back |
> | dtc_state | int | DTC state for distributed transactions |
> | dtc_status | int | DTC status code |
> | dtc_isolation_level | int | DTC isolation level |
> | filestream_transaction_id | varbinary(128) | FILESTREAM transaction identifier |

---

### SQL Server | sys.dm_tran_locks | currently held lock resources

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/16-blocking-and-locking) · [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/18-race-conditions)

Returns one row per currently active lock manager request. The definitive view for understanding blocking chains — filter on `request_status = 'WAIT'` to find blocked requests, then trace `resource_associated_entity_id` to identify the contested object.

> [!info]- sys.dm_tran_locks — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | resource_type | nvarchar(60) | `DATABASE`, `FILE`, `OBJECT`, `PAGE`, `KEY`, `EXTENT`, `RID`, `APPLICATION`, `METADATA`, `HOBT`, `ALLOCATION_UNIT` |
> | resource_subtype | nvarchar(60) | Lock resource subtype |
> | resource_database_id | int | Database owning the resource |
> | resource_description | nvarchar(256) | Resource description; format varies by `resource_type` |
> | resource_associated_entity_id | bigint | Entity ID: `object_id` for OBJECT locks, `hobt_id` for PAGE/KEY/RID locks |
> | resource_lock_partition | int | Lock partition for partitioned lock resources |
> | request_mode | nvarchar(60) | Lock mode requested: `S` (shared), `X` (exclusive), `IS`, `IX`, `SIX`, `U` (update), `Sch-S`, `Sch-M`, `BU` |
> | request_type | nvarchar(60) | `LOCK` or `CONVERT` |
> | request_status | nvarchar(60) | `GRANT` (held), `WAIT` (blocked), `CONVERT` (upgrading) |
> | request_reference_count | smallint | Number of times the same requestor has requested this lock |
> | request_lifetime | int | Lifetime indicator |
> | request_session_id | int | Session SPID holding or requesting the lock |
> | request_exec_context_id | int | Execution context of the requesting task |
> | request_request_id | int | Request ID within the session |
> | lock_owner_address | varbinary(8) | Internal address of the lock owner |

---

### SQL Server | sys.dm_tran_session_transactions | session-to-transaction correlation

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [system-functions-and-session-metadata](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/15-system-functions-and-session-metadata)

Bridge table linking sessions to their transactions. One session can have multiple transactions (nested, savepoints); one transaction maps to exactly one session (excluding distributed transactions).

> [!info]- sys.dm_tran_session_transactions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | int | Session SPID |
> | transaction_id | bigint | Transaction ID; join to `dm_tran_active_transactions` |
> | transaction_descriptor | binary(8) | Transaction descriptor used internally by the client library |
> | enlist_count | int | Number of active requests in the session working on this transaction |
> | is_user_transaction | bit | 1 = initiated by a user request |
> | is_local | bit | 1 = local transaction (not distributed) |
> | is_enlisted | bit | 1 = transaction is enlisted in a distributed transaction |
> | is_bound | bit | 1 = transaction is connected to another session via bound sessions |
> | open_transaction_count | int | Number of open transactions for this session-transaction pair |

---

### SQL Server | sys.dm_tran_database_transactions | database-level transaction state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [essential-dba-queries](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/06-essential-dba-queries) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook)

Returns one row per transaction per database showing log usage, tempdb usage, and the longest-running transaction in each database. Critical for understanding log space consumption and identifying transactions blocking log truncation.

> [!info]- sys.dm_tran_database_transactions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | transaction_id | bigint | Transaction ID |
> | database_id | int | Database ID |
> | database_transaction_begin_time | datetime | When the transaction started modifying this database; NULL = read-only participation |
> | database_transaction_type | int | 1 = read/write, 2 = read-only, 3 = system |
> | database_transaction_state | int | 1–13 encoding transaction lifecycle states |
> | database_transaction_log_record_count | bigint | Log records generated |
> | database_transaction_replicate_record_count | int | Log records replicated |
> | database_transaction_log_bytes_used | bigint | Log bytes consumed |
> | database_transaction_log_bytes_reserved | bigint | Log bytes reserved |
> | database_transaction_log_bytes_used_system | int | System transaction log bytes |
> | database_transaction_log_bytes_reserved_system | int | System reserved log bytes |
> | database_transaction_begin_lsn | numeric(25,0) | Start LSN of the transaction in this database |
> | database_transaction_last_lsn | numeric(25,0) | Most recent LSN of the transaction |
> | database_transaction_most_recent_savepoint_lsn | numeric(25,0) | Most recent savepoint LSN |
> | database_transaction_commit_lsn | numeric(25,0) | Commit LSN |
> | database_transaction_last_rollback_lsn | numeric(25,0) | Last rollback LSN |
> | database_transaction_next_undo_lsn | numeric(25,0) | Next undo LSN during rollback |

---

### SQL Server | sys.dm_tran_version_store | tempdb version store records

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [memory-and-buffer-pool](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/11-memory-and-buffer-pool)

Returns one row per version record in the tempdb version store. The version store supports snapshot isolation, read committed snapshot, online index operations, triggers (for `INSERTED`/`DELETED`), and MARS. Use `dm_tran_version_store_space_usage` for per-database space totals instead of scanning this entire set.

> [!info]- sys.dm_tran_version_store — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | transaction_sequence_num | bigint | Sequence number of the transaction that generated the version |
> | version_sequence_num | bigint | Version record sequence number within the transaction |
> | database_id | smallint | Source database of the versioned row |
> | rowset_id | bigint | Rowset (HoBT) containing the original row |
> | status | tinyint | 0 = normal, 1 = linked to another version record |
> | min_length_in_bytes | int | Minimum record length |
> | record_length_first_part_in_bytes | int | First part length of the version record |
> | record_image_first_part | varbinary(8000) | Binary image of the version record |
> | record_image_second_part | varbinary(8000) | Second part if the record exceeds 8000 bytes |

---

### SQL Server | sys.dm_tran_version_store_space_usage | version store space per database

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout)

Returns the total version store space consumed in tempdb per database. Lightweight alternative to scanning `dm_tran_version_store`. Use this to identify which database is driving tempdb version store growth during snapshot isolation workloads.

> [!info]- sys.dm_tran_version_store_space_usage — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | smallint | Source database generating version records |
> | reserved_page_count | bigint | Pages reserved in tempdb for this database's version records |
> | reserved_space_kb | bigint | Space reserved in KB |

---

## High Availability (HADR)

> [!abstract] Always On AG replica state, cluster topology, and seeding progress
>
> Five DMVs expose the Always On Availability Groups subsystem. `dm_hadr_database_replica_states` is the primary health check — it reports synchronization state, redo queue, and send queue per database replica. The cluster DMVs (`dm_hadr_cluster`, `dm_hadr_cluster_members`) report WSFC topology.

### SQL Server | sys.dm_hadr_database_replica_states | AG database replica health

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview) · [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/10-always-on-availability-groups) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts)

Returns one row per database replica in each AG. The primary DMV for AG health monitoring — watch `synchronization_state_desc`, `redo_queue_size`, and `log_send_queue_size` for replication lag.

> [!info]- sys.dm_hadr_database_replica_states — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID (local to this replica) |
> | group_id | uniqueidentifier | AG group identifier |
> | replica_id | uniqueidentifier | Replica identifier; join to `sys.availability_replicas` |
> | group_database_id | uniqueidentifier | AG-level database identifier |
> | is_local | bit | 1 = this row describes the local replica |
> | is_primary_replica | bit | 1 = local replica is currently primary |
> | synchronization_state | tinyint | 0 = NOT SYNCHRONIZING, 1 = SYNCHRONIZING, 2 = SYNCHRONIZED, 3 = REVERTING, 4 = INITIALIZING |
> | synchronization_state_desc | nvarchar(60) | Readable state description |
> | is_commit_participant | bit | 1 = transaction commits are synchronized to this replica |
> | synchronization_health | tinyint | 0 = NOT_HEALTHY, 1 = PARTIALLY_HEALTHY, 2 = HEALTHY |
> | synchronization_health_desc | nvarchar(60) | Readable health description |
> | database_state | tinyint | 0 = ONLINE, 1 = RESTORING, 6 = OFFLINE |
> | database_state_desc | nvarchar(60) | Readable database state |
> | is_suspended | bit | 1 = data movement is suspended |
> | suspend_reason | tinyint | Reason for suspension if `is_suspended = 1` |
> | suspend_reason_desc | nvarchar(60) | Readable suspend reason |
> | recovery_lsn | numeric(25,0) | Primary: NULL. Secondary: current recovery target |
> | truncation_lsn | numeric(25,0) | Minimum log truncation LSN; log cannot truncate past this on primary |
> | last_sent_lsn | numeric(25,0) | Last log block sent to this secondary |
> | last_sent_time | datetime | Time of last log send |
> | last_received_lsn | numeric(25,0) | Last log block received by this secondary |
> | last_received_time | datetime | Time of last log receive |
> | last_hardened_lsn | numeric(25,0) | Last LSN hardened (written to log) on the secondary |
> | last_hardened_time | datetime | Time of last hardening |
> | last_redone_lsn | numeric(25,0) | Last LSN redone (applied) on the secondary |
> | last_redone_time | datetime | Time of last redo |
> | log_send_queue_size | bigint | Primary → secondary log send queue in KB; growing = network lag |
> | log_send_rate | bigint | Log send rate in KB/sec |
> | redo_queue_size | bigint | Redo queue on secondary in KB; growing = CPU/IO lag on secondary |
> | redo_rate | bigint | Redo rate in KB/sec |
> | filestream_send_rate | bigint | FILESTREAM send rate |
> | end_of_log_lsn | numeric(25,0) | End of log LSN |
> | last_commit_lsn | numeric(25,0) | Last committed transaction LSN |
> | last_commit_time | datetime | Time of last commit |
> | low_water_mark_for_ghosts | bigint | Ghost cleanup low water mark |
> | secondary_lag_seconds | bigint | Seconds the secondary lags behind the primary (SQL Server 2016+) |

---

### SQL Server | sys.dm_hadr_availability_replica_states | AG replica connection and sync state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview) · [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/10-always-on-availability-groups)

Returns one row per replica in each AG with connection state and role. Complements the database-level detail in `dm_hadr_database_replica_states` with replica-level aggregates.

> [!info]- sys.dm_hadr_availability_replica_states — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | replica_id | uniqueidentifier | Replica identifier |
> | group_id | uniqueidentifier | AG group identifier |
> | is_local | bit | 1 = describes the local replica |
> | role | tinyint | 0 = RESOLVING, 1 = PRIMARY, 2 = SECONDARY |
> | role_desc | nvarchar(60) | Readable role |
> | operational_state | tinyint | 0 = pending failover, 1 = pending, 2 = online, 3 = offline, 4 = failed, 5 = failed no quorum |
> | operational_state_desc | nvarchar(60) | Readable operational state |
> | connected_state | tinyint | 0 = DISCONNECTED, 1 = CONNECTED |
> | connected_state_desc | nvarchar(60) | Readable connection state |
> | recovery_health | tinyint | 0 = IN_PROGRESS, 1 = ONLINE |
> | recovery_health_desc | nvarchar(60) | Readable recovery health |
> | synchronization_health | tinyint | 0 = NOT_HEALTHY, 1 = PARTIALLY_HEALTHY, 2 = HEALTHY |
> | synchronization_health_desc | nvarchar(60) | Aggregate synchronization health across all databases in this replica |
> | last_connect_error_number | int | Last connection error number |
> | last_connect_error_description | nvarchar(1024) | Last connection error message |
> | last_connect_error_timestamp | datetime | Timestamp of last connection error |

---

### SQL Server | sys.dm_hadr_cluster | WSFC cluster-level information

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview)

Returns a single row with Windows Server Failover Clustering information for the node hosting this SQL Server instance.

> [!info]- sys.dm_hadr_cluster — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | cluster_name | nvarchar(128) | WSFC cluster name |
> | quorum_type | tinyint | 0 = UNKNOWN, 1 = NODE_MAJORITY, 2 = NODE_AND_DISK_MAJORITY, 3 = NODE_AND_FILE_SHARE_MAJORITY, 4 = NO_MAJORITY (disk only), 5 = CLOUD_WITNESS |
> | quorum_type_desc | nvarchar(50) | Readable quorum type |
> | quorum_state | tinyint | 0 = UNKNOWN, 1 = NORMAL, 2 = FORCED |
> | quorum_state_desc | nvarchar(50) | Readable quorum state |

---

### SQL Server | sys.dm_hadr_cluster_members | cluster node membership

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview)

Returns one row per WSFC cluster member (nodes and witnesses) with vote weight and state.

> [!info]- sys.dm_hadr_cluster_members — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | member_name | nvarchar(128) | Node or witness name |
> | member_type | tinyint | 0 = WSFC node, 1 = disk witness, 2 = file share witness |
> | member_type_desc | nvarchar(50) | Readable member type |
> | member_state | tinyint | 0 = offline, 1 = online |
> | member_state_desc | nvarchar(60) | Readable state |
> | number_of_quorum_votes | int | Number of quorum votes owned by this member |

---

### SQL Server | sys.dm_hadr_automatic_seeding | automatic seeding progress

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview) · [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/10-always-on-availability-groups)

Returns one row per automatic seeding operation. Automatic seeding (SQL Server 2016+) eliminates the need for manual backup/restore when adding replicas.

> [!info]- sys.dm_hadr_automatic_seeding — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | ag_id | uniqueidentifier | AG group identifier |
> | ag_db_id | uniqueidentifier | AG database identifier |
> | ag_remote_replica_id | uniqueidentifier | Remote replica being seeded |
> | is_source | bit | 1 = this replica is the source (sender) |
> | current_state | nvarchar(60) | Current seeding state: `SEEDING_IN_PROGRESS`, `SEEDING_SUCCEEDED`, `SEEDING_FAILED` |
> | performed_seeding | bit | 1 = seeding has been performed at least once |
> | failure_state | int | Failure code if seeding failed |
> | failure_state_desc | nvarchar(128) | Readable failure description |
> | error_code | int | OS or SQL error code |
> | number_of_attempts | int | Number of seeding attempts |
> | start_time | datetime | When the current seeding operation started |
> | end_time | datetime | When the seeding completed or failed |

---

## Audit and Extended Events

> [!abstract] Audit definitions, Extended Event session state, and session target configuration
>
> Five DMVs support the SQL Server audit and Extended Events infrastructure. The audit DMVs (`dm_audit_actions`, `dm_audit_class_type_map`, `dm_server_audit_status`) provide metadata for building and monitoring audit specifications. The XE DMVs (`dm_xe_sessions`, `dm_xe_session_targets`) expose active session state.

### SQL Server | sys.dm_xe_sessions | active Extended Event sessions

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/17-deadlock-detection-and-prevention)

Returns one row per active XE session. The `system_health` session is always active by default and captures deadlocks, severe errors, and memory issues.

> [!info]- sys.dm_xe_sessions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | address | varbinary(8) | Session memory address |
> | name | nvarchar(256) | Session name (e.g., `system_health`, `AlwaysOn_health`) |
> | pending_buffers | int | Number of full buffers waiting to be processed |
> | total_regular_buffers | int | Total regular buffers allocated |
> | regular_buffer_size | bigint | Size of each regular buffer in bytes |
> | total_large_buffers | int | Total large buffers |
> | large_buffer_size | bigint | Large buffer size in bytes |
> | total_buffer_size | bigint | Total memory allocated to the session |
> | buffer_policy_flags | int | Buffer policy: 0 = no event loss, 1 = allow event loss |
> | buffer_policy_desc | nvarchar(256) | `No event loss`, `Allow event loss (event count)`, or `Allow event loss (event data)` |
> | flags | int | Session flags bitmap |
> | flag_desc | nvarchar(256) | Readable flags |
> | dropped_event_count | int | Events dropped due to buffer pressure |
> | dropped_buffer_count | int | Buffers dropped |
> | blocked_event_fire_time | bigint | Time events were blocked during buffer contention |
> | create_time | datetime | When the session was created |
> | largest_event_dropped_size | int | Largest event that was dropped |

---

### SQL Server | sys.dm_xe_session_targets | XE session target configuration

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems) · [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/17-deadlock-detection-and-prevention)

Returns one row per target attached to an active XE session. The `target_data` column contains the buffered XML payload — for the `ring_buffer` target this is the in-memory event data; for `event_file` it contains the file path.

> [!info]- sys.dm_xe_session_targets — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | event_session_address | varbinary(8) | Session address; join to `dm_xe_sessions.address` |
> | target_name | nvarchar(256) | Target name: `ring_buffer`, `event_file`, `event_counter`, `histogram`, `event_pairing`, `etw_classic_sync_target` |
> | target_package_guid | uniqueidentifier | Package GUID |
> | execution_count | bigint | Number of times the target has processed events |
> | execution_duration_ms | bigint | Total time spent processing events |
> | target_data | nvarchar(max) | XML payload; content depends on target type — cast and query with XQuery for `ring_buffer`, or parse file path for `event_file` |
> | bytes_written | bigint | Bytes written to the target |

---

### SQL Server | sys.dm_audit_actions | audit action definitions

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [audit-logging](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/12-audit-logging)

Returns one row per audit action that can be used in server or database audit specifications. Reference table for building `ADD (action_id)` clauses in `CREATE SERVER AUDIT SPECIFICATION` and `CREATE DATABASE AUDIT SPECIFICATION`.

> [!info]- sys.dm_audit_actions — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | action_id | varchar(4) | Action identifier (e.g., `SL` = SELECT, `IN` = INSERT, `DL` = DELETE, `UP` = UPDATE, `EX` = EXECUTE) |
> | action_in_log | bit | 1 = action can be written to the audit log |
> | name | nvarchar(128) | Human-readable action name |
> | class_desc | nvarchar(60) | Class of the auditable object: `SERVER`, `DATABASE`, `OBJECT`, `SCHEMA`, etc. |
> | parent_class_desc | nvarchar(60) | Parent class |
> | covering_parent_action_name | nvarchar(128) | Parent audit action that covers this action |
> | configuration_level | nvarchar(128) | `SERVER`, `DATABASE`, or `ACTION_GROUP` |
> | containing_group_name | nvarchar(128) | Audit action group containing this action |

---

### SQL Server | sys.dm_audit_class_type_map | audit class type mappings

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [audit-logging](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/12-audit-logging)

Returns the mapping between audit `class_type` codes (2-character codes in audit logs) and the corresponding `securable_class_desc` names. Used to decode the `class_type` field in audit log output.

> [!info]- sys.dm_audit_class_type_map — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | class_type | varchar(2) | Two-character class type code (e.g., `U` = Table, `V` = View, `P` = Stored Procedure) |
> | class_type_desc | nvarchar(128) | Class type description |
> | securable_class_desc | nvarchar(60) | Securable class: `OBJECT`, `DATABASE`, `SERVER`, `SCHEMA`, etc. |

---

### SQL Server | sys.dm_server_audit_status | current server audit state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [audit-logging](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/12-audit-logging)

Returns one row per server audit with its current operational status. Use to verify that audits are actively collecting events and to check for failures.

> [!info]- sys.dm_server_audit_status — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | audit_id | int | Audit ID |
> | name | nvarchar(128) | Audit name |
> | status | smallint | 0 = not started, 1 = started |
> | status_desc | nvarchar(256) | `NOT_STARTED` or `STARTED` |
> | status_time | datetime2 | Timestamp of last status change |
> | event_session_address | varbinary(8) | XE session address backing this audit |
> | audit_file_path | nvarchar(256) | Full path to the current audit file |
> | audit_file_size | bigint | Current audit file size in bytes |

---

## Server State and Encryption

> [!abstract] Service information, encryption keys, CDC errors, and server suspend state
>
> Four DMVs that don't fit neatly into the other categories: SQL Server service details (`dm_server_services`), TDE key state (`dm_database_encryption_keys`), CDC log scan errors (`dm_cdc_errors`), and server suspend status (`dm_server_suspend_status`).

### SQL Server | sys.dm_database_encryption_keys | database encryption key state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [tde-encryption](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/13-tde-encryption) · [sql-server-problems](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/14-sql-server-problems)

Returns one row per database that has a database encryption key (DEK), regardless of whether TDE is active. The `encryption_state` column tracks the full TDE lifecycle from unencrypted through encryption scan to fully encrypted.

> [!info]- sys.dm_database_encryption_keys — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | database_id | int | Database ID |
> | encryption_state | int | 0 = no DEK, 1 = unencrypted, 2 = encryption in progress, 3 = encrypted, 4 = key change in progress, 5 = decryption in progress, 6 = protection change in progress |
> | create_date | datetime | DEK creation date |
> | regenerate_date | datetime | DEK regeneration date |
> | modify_date | datetime | DEK last modification date |
> | set_date | datetime | DEK set date |
> | opened_date | datetime | When the DEK was last opened |
> | key_algorithm | nvarchar(32) | Algorithm: `AES_128`, `AES_192`, `AES_256`, `TRIPLE_DES_3KEY` |
> | key_length | int | Key length in bits |
> | encryptor_thumbprint | varbinary(20) | Certificate or asymmetric key thumbprint protecting the DEK |
> | encryptor_type | nvarchar(32) | `CERTIFICATE` or `ASYMMETRIC KEY` |
> | percent_complete | real | Encryption/decryption scan progress (0–100) |
> | encryption_state_desc | nvarchar(32) | Readable encryption state (SQL Server 2019+) |
> | encryption_scan_state | int | 0 = no scan, 1 = scan in progress, 2 = scan complete |
> | encryption_scan_state_desc | nvarchar(32) | Readable scan state |
> | encryption_scan_modify_date | datetime | Last scan state change |

---

### SQL Server | sys.dm_server_services | SQL Server service information

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [database-creation-and-file-layout](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/01-database-creation-and-file-layout)

Returns one row per SQL Server-related service (Database Engine, Agent, Full-Text, etc.) with service account, startup type, PID, and installation path.

> [!info]- sys.dm_server_services — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | servicename | nvarchar(256) | Service name |
> | startup_type | int | 0 = other, 2 = automatic, 3 = manual, 4 = disabled |
> | startup_type_desc | nvarchar(256) | Readable startup type |
> | status | int | 1 = stopped, 4 = running |
> | status_desc | nvarchar(256) | Readable status |
> | process_id | int | OS process ID |
> | last_startup_time | datetimeoffset | Last service start time |
> | service_account | nvarchar(256) | Service account identity |
> | filename | nvarchar(256) | Full path to the service executable |
> | is_clustered | nvarchar(1) | `Y` or `N` |
> | cluster_nodename | nvarchar(256) | Node owning the clustered service |
> | instant_file_initialization_enabled | nvarchar(1) | `Y` = IFI is enabled (requires Volume Maintenance Tasks privilege) |

---

### SQL Server | sys.dm_server_suspend_status | server suspend state

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/17-finops-cost-optimization)

Returns information about whether the SQL Server instance is in a suspended state. Relevant for Azure SQL Managed Instance serverless tier and SQL Server 2022+ suspend/resume functionality.

> [!info]- sys.dm_server_suspend_status — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | is_suspended | bit | 1 = instance is suspended |
> | suspend_start_time | datetime | When the suspend state began |
> | suspend_type | int | Type of suspension |
> | suspend_type_desc | nvarchar(256) | Readable suspension type |

---

### SQL Server | sys.dm_cdc_errors | CDC log scan error information

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE
**Used in:** [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/10-sql-server-change-tracking)

Returns one row per error encountered by the CDC log scan process. CDC relies on a background agent job reading the transaction log — errors here can silently stall change data capture. Check this DMV when CDC consumers report missing changes.

> [!info]- sys.dm_cdc_errors — column reference
>
> | Column | Type | Meaning |
> |---|---|---|
> | session_id | int | CDC log scan session ID |
> | phase_number | int | Phase during which the error occurred |
> | entry_time | datetime | When the error was logged |
> | error_number | int | SQL Server error number |
> | error_severity | int | Error severity |
> | error_state | int | Error state |
> | error_message | nvarchar(1024) | Error message text |
> | start_lsn | binary(10) | Start LSN of the log scan batch being processed |
> | begin_lsn | binary(10) | Begin LSN of the transaction causing the error |
> | sequence_value | binary(10) | Sequence value within the log scan |

---

## System Functions (sys.fn_*)

> [!abstract] Table-valued and scalar functions in the sys schema used alongside DMVs
>
> Eight system functions referenced across the chapter. These are not DMVs but frequently appear in the same diagnostic queries. Each entry lists input parameters, return columns, and cross-references.

### SQL Server | sys.fn_get_audit_file | read audit file records

**Scope:** server-wide · **Permissions:** CONTROL SERVER · **Type:** table-valued function
**Used in:** [sql-server-authentication](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/03-sql-server-authentication) · [audit-logging](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/12-audit-logging)

Reads SQL Server audit log files (`.sqlaudit`) and returns the events as a result set. The primary way to query audit data programmatically. `sys.fn_get_audit_file_v2` (SQL Server 2022+) adds `sequence_group_id` for reliable ordering.

> [!info]- sys.fn_get_audit_file — parameter and column reference
>
> **Input parameters:**
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | file_pattern | nvarchar(260) | Path with wildcards (e.g., `C:\Audit\*.sqlaudit`) |
> | initial_file_name | nvarchar(260) | Starting file name to begin reading from; NULL = start from earliest |
> | audit_record_offset | bigint | Starting offset within the file; NULL = start from beginning |
>
> **Key output columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | event_time | datetime2 | UTC timestamp of the audited event |
> | action_id | varchar(4) | Audit action code (e.g., `SL`, `IN`, `DL`) |
> | succeeded | bit | 1 = the action succeeded |
> | session_id | int | Session SPID that triggered the event |
> | server_principal_name | nvarchar(128) | Login name |
> | database_name | nvarchar(128) | Database context |
> | schema_name | nvarchar(128) | Schema of the target object |
> | object_name | nvarchar(128) | Target object name |
> | statement | nvarchar(4000) | T-SQL statement that triggered the event |
> | additional_information | nvarchar(4000) | XML with extra context |
> | file_name | nvarchar(260) | Source audit file |
> | audit_file_offset | bigint | Offset within the file |
> | class_type | varchar(2) | Class type code; decode with `dm_audit_class_type_map` |

---

### SQL Server | sys.fn_xe_file_target_read_file | read XE event_file target

**Scope:** server-wide · **Permissions:** VIEW SERVER STATE · **Type:** table-valued function
**Used in:** [troubleshooting-flowcharts](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/15-troubleshooting-flowcharts) · [performance-audit-playbook](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/16-performance-audit-playbook) · [deadlock-detection-and-prevention](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/17-deadlock-detection-and-prevention)

Reads Extended Events `.xel` files and returns each event as an XML row. Standard way to consume persisted XE data for deadlock analysis, query timeouts, and error diagnostics.

> [!info]- sys.fn_xe_file_target_read_file — parameter and column reference
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | path | nvarchar(260) | Path with wildcards to `.xel` files |
> | mdpath | nvarchar(260) | Metadata file path; NULL for SQL Server 2012+ |
> | initial_file_name | nvarchar(260) | Starting file; NULL = earliest |
> | initial_offset | bigint | Starting offset; NULL = beginning |
>
> | Column | Type | Meaning |
> |---|---|---|
> | module_guid | uniqueidentifier | Module GUID |
> | package_guid | uniqueidentifier | Package GUID |
> | object_name | nvarchar(256) | Event name (e.g., `xml_deadlock_report`, `query_post_execution_showplan`) |
> | event_data | nvarchar(max) | XML payload containing the full event data |
> | file_name | nvarchar(260) | Source `.xel` file |
> | file_offset | bigint | Offset in the file |

---

### SQL Server | sys.fn_hadr_backup_is_preferred_replica | AG backup preference check

**Scope:** database · **Permissions:** PUBLIC · **Type:** scalar function
**Used in:** [high-availability-overview](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/09-high-availability-overview) · [always-on-availability-groups](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/10-always-on-availability-groups)

Returns 1 if the current replica is the preferred backup replica for the specified database, based on the AG's `AUTOMATED_BACKUP_PREFERENCE` setting. Used in backup job logic to ensure only the designated replica runs backups.

> [!info]- sys.fn_hadr_backup_is_preferred_replica — parameter reference
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | database_name | sysname | Database name to check |
>
> **Returns:** `int` — 1 = this replica is preferred, 0 = not preferred.

---

### SQL Server | sys.fn_cdc_get_max_lsn | current maximum CDC LSN

**Scope:** database · **Permissions:** PUBLIC · **Type:** scalar function
**Used in:** [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/10-sql-server-change-tracking)

Returns the maximum LSN from the `cdc.lsn_time_mapping` table, representing the upper boundary of captured changes. Used as the `@to_lsn` parameter when calling `cdc.fn_cdc_get_all_changes_*` or `cdc.fn_cdc_get_net_changes_*`.

> [!info]- sys.fn_cdc_get_max_lsn — reference
>
> **Parameters:** none.
> **Returns:** `binary(10)` — the maximum captured LSN. Returns `0x00000000000000000000` if CDC is enabled but no changes have been captured.

---

### SQL Server | sys.fn_cdc_get_min_lsn | minimum valid CDC LSN for a capture instance

**Scope:** database · **Permissions:** PUBLIC · **Type:** scalar function
**Used in:** [sql-server-change-tracking](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/10-sql-server-change-tracking)

Returns the minimum valid LSN for a specific capture instance, representing the lower boundary of available change data. Changes before this LSN have been cleaned up by the CDC cleanup job.

> [!info]- sys.fn_cdc_get_min_lsn — parameter reference
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | capture_instance_name | nvarchar(128) | Capture instance name (default: `schema_table`) |
>
> **Returns:** `binary(10)` — the minimum valid LSN. Use as the `@from_lsn` parameter for change queries.

---

### SQL Server | sys.fn_dblog | transaction log reader (undocumented)

**Scope:** current database · **Permissions:** sysadmin · **Type:** table-valued function
**Used in:** [storage-internals](https://alp78.github.io/elysium/04-SQL-Server/02-Database-Design-and-Storage/02-storage-internals)

Undocumented function that reads the active portion of the transaction log and returns individual log records. Used for forensic analysis and understanding log record structure. Not supported in production and subject to change.

> [!info]- sys.fn_dblog — parameter and column reference
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | start_lsn | nvarchar(25) | Starting LSN; NULL = beginning of active log |
> | end_lsn | nvarchar(25) | Ending LSN; NULL = end of active log |
>
> **Key output columns (partial — returns 100+ columns):**
>
> | Column | Type | Meaning |
> |---|---|---|
> | Current LSN | nvarchar(48) | Log sequence number of this record |
> | Operation | nvarchar(31) | Operation type: `LOP_INSERT_ROWS`, `LOP_MODIFY_ROW`, `LOP_DELETE_ROWS`, `LOP_BEGIN_XACT`, `LOP_COMMIT_XACT` |
> | Context | nvarchar(31) | Context: `LCX_HEAP`, `LCX_CLUSTERED`, `LCX_INDEX_LEAF` |
> | Transaction ID | nvarchar(14) | Transaction ID |
> | AllocUnitName | nvarchar(max) | Schema.table.index |
> | Page ID | nvarchar(max) | File:page address |
> | Slot ID | int | Slot within the page |
> | Log Record Length | int | Size of this log record in bytes |

---

### SQL Server | sys.fn_builtin_permissions | built-in permission definitions

**Scope:** server-wide · **Permissions:** PUBLIC · **Type:** table-valued function
**Used in:** [users-logins-roles-permissions](https://alp78.github.io/elysium/04-SQL-Server/01-Server-Operations/04-users-logins-roles-permissions)

Returns the full permission hierarchy — one row per permission per securable class. Used to discover all available permissions for a given class (`SERVER`, `DATABASE`, `OBJECT`, `SCHEMA`, etc.) and to understand permission implication chains.

> [!info]- sys.fn_builtin_permissions — parameter and column reference
>
> | Parameter | Type | Meaning |
> |---|---|---|
> | securable_class | nvarchar(60) | Filter by class: `SERVER`, `DATABASE`, `OBJECT`, `SCHEMA`, etc.; NULL = all |
>
> **Key output columns:**
>
> | Column | Type | Meaning |
> |---|---|---|
> | class_desc | nvarchar(60) | Securable class |
> | permission_name | nvarchar(128) | Permission name (e.g., `SELECT`, `EXECUTE`, `ALTER`, `CONTROL`) |
> | type | varchar(4) | Permission type code |
> | covering_permission_name | nvarchar(128) | Higher-level permission that implies this one |
> | parent_class_desc | nvarchar(60) | Parent securable class |
> | parent_covering_permission_name | nvarchar(128) | Parent covering permission |

---

### SQL Server | sys.fn_helpcollations | available collation list

**Scope:** server-wide · **Permissions:** PUBLIC · **Type:** table-valued function
**Used in:** [data-types-conversion-and-null-handling](https://alp78.github.io/elysium/04-SQL-Server/03-Query-Writing-and-Optimization/02-data-types-conversion-and-null-handling)

Returns one row per collation supported by the SQL Server instance, with name and description. Used when selecting collations for database or column creation.

> [!info]- sys.fn_helpcollations — column reference
>
> **Parameters:** none.
>
> | Column | Type | Meaning |
> |---|---|---|
> | name | nvarchar(128) | Collation name (e.g., `SQL_Latin1_General_CP1_CI_AS`, `Latin1_General_100_CI_AS_SC_UTF8`) |
> | description | nvarchar(1000) | Human-readable description of the collation rules |

---

## Appendix — Catalog Views Quick Index

> [!abstract] Summary of all sys.* catalog views referenced in the chapter
>
> Catalog views expose persisted metadata (objects, columns, indexes, permissions, configurations) as opposed to DMVs which expose runtime state. This appendix lists every catalog view referenced in the chapter, grouped by category, with source pages. For per-column documentation, see the vault pages listed in each entry — catalog view columns are documented inline where they are queried.

### Object Model

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.objects` | All schema-scoped objects | SO:14,17 · DDS:01,03,05,06,08 · QWO:15 |
| `sys.all_objects` | All objects including system objects | DDS:02,07 · QWO:19 |
| `sys.tables` | User tables | SO:06,14,17 · DDS:01,03,05,09,10 · QWO:09,16,19 · APP:01,02,03,04,06,08 |
| `sys.views` | User views | DDS:03 |
| `sys.schemas` | Schemas | SO:17 · DDS:03,05 · QWO:09,16,19 · APP:01,02,03,04,06,08 |
| `sys.columns` | Table and view columns | SO:14 · DDS:03,04,05,06,07,10 · QWO:02,07,09,15 · APP:05,06 |
| `sys.computed_columns` | Computed columns | DDS:03 |
| `sys.identity_columns` | Identity columns | DDS:03,04 |
| `sys.types` | System and user-defined data types | SO:14 · DDS:03,04 · QWO:02,07,15 |
| `sys.parameters` | Stored procedure and function parameters | QWO:15 |
| `sys.sql_modules` | SQL module definitions (views, procs, triggers) | SO:02,14 |

### Indexes and Statistics

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.indexes` | All indexes on tables and views | SO:06,14,15,16,17 · DDS:01,03,06,07,08,09,10 · QWO:04,09,12,15,16,20 · APP:05,06,08 |
| `sys.index_columns` | Index key and included columns | DDS:03,06,07 · QWO:09,12 · APP:05,06 |
| `sys.index_resumable_operations` | In-progress resumable index operations | DDS:07 |
| `sys.stats` | Statistics objects | SO:14,16 · DDS:07,09 |
| `sys.partitions` | Table and index partitions | SO:14,17 · DDS:01,03,05,06,08,09 · QWO:09,13,15,16 · APP:01,03 |

### Constraints and Keys

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.key_constraints` | Primary key and unique constraints | DDS:03 |
| `sys.foreign_keys` | Foreign key relationships | DDS:03 |
| `sys.foreign_key_columns` | Foreign key column mappings | DDS:03 |
| `sys.check_constraints` | CHECK constraints | DDS:03 · QWO:09 |
| `sys.default_constraints` | DEFAULT constraints | DDS:03,04,05 |
| `sys.sequences` | Sequence objects | DDS:04 |

### Database and Files

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.databases` | All databases on the instance | SO:02,03,05,06,07,08,09,10,13,14,16,17 · DDS:01,02,07,10 · QWO:05,13,14,16,18 · APP:01,02 |
| `sys.database_files` | Files in the current database | SO:01,14,15,16,17 · DDS:01,02 · QWO:14 |
| `sys.master_files` | All files across all databases | SO:06,07,14,16,17 · DDS:01 · QWO:14 |
| `sys.filegroups` | Filegroups in the current database | DDS:01 |
| `sys.allocation_units` | Allocation units | SO:14,17 · DDS:01 |
| `sys.data_spaces` | Data spaces (filegroups and partition schemes) | DDS:09 |
| `sys.database_scoped_configurations` | Database-scoped configuration options | SO:11 |
| `sys.database_query_store_options` | Query Store configuration | SO:14 · DDS:01 · QWO:20 |
| `sys.database_automatic_tuning_options` | Automatic tuning settings | SO:14 |
| `sys.database_ledger_transactions` | Ledger transaction history | DDS:03 |

### Server Configuration

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.configurations` | Instance-level sp_configure settings | SO:01,02,05,11,14,16,17 · DDS:07 |
| `sys.servers` | Linked servers | SO:05 |
| `sys.endpoints` | Server endpoints | SO:09 |
| `sys.endpoint_permissions` | Endpoint permissions | SO:09 |
| `sys.tcp_endpoints` | TCP endpoint details | SO:09 |

### Security and Authentication

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.server_principals` | Server-level logins and roles | SO:03,04,16 · QWO:15 |
| `sys.server_permissions` | Server-level permissions | SO:03 |
| `sys.server_role_members` | Server role membership | SO:03,16 |
| `sys.sql_logins` | SQL Authentication logins | SO:03,04 |
| `sys.database_principals` | Database-level users and roles | SO:03,04,16 · DDS:03,05 · QWO:15 |
| `sys.database_permissions` | Database-level permissions | SO:03,05,16 · DDS:05 |
| `sys.database_role_members` | Database role membership | SO:04 |
| `sys.security_policies` | Row-level security policies | SO:04 |
| `sys.credentials` | Server credentials | SO:07,08 |
| `sys.certificates` | Certificates | SO:07,09,10,13,14 |
| `sys.symmetric_keys` | Symmetric keys | SO:07,13 |
| `sys.asymmetric_keys` | Asymmetric keys | SO:14 |
| `sys.database_mirroring_endpoints` | Mirroring endpoints | SO:09 |

### Audit

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.server_audits` | Server audit definitions | SO:03,12 |
| `sys.server_audit_specifications` | Server audit specifications | SO:03,12 |
| `sys.server_audit_specification_details` | Server audit spec details | SO:12 |
| `sys.database_audit_specifications` | Database audit specifications | SO:12 |
| `sys.database_audit_specification_details` | Database audit spec details | SO:12 |
| `sys.server_file_audits` | File-based audit targets | SO:12 |

### Availability Groups

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.availability_groups` | AG definitions | SO:09,15 |
| `sys.availability_replicas` | AG replica configuration | SO:09,10,15 |
| `sys.availability_read_only_routing_lists` | Read-only routing configuration | SO:09,10 |

### Partitioning

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.partition_functions` | Partition function definitions | DDS:01,09 |
| `sys.partition_schemes` | Partition scheme definitions | DDS:01,09 |
| `sys.partition_range_values` | Partition boundary values | DDS:01,09 |

### Change Tracking and CDC

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.change_tracking_databases` | Databases with CT enabled | DDS:10 |
| `sys.change_tracking_tables` | Tables with CT enabled | DDS:10 |
| `sys.syscommittab` | CT commit tracking table | DDS:10 |

### Query Store

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.query_store_query` | Query objects in Query Store | SO:14 · QWO:13,14,20 · APP:07 |
| `sys.query_store_query_text` | Query text in Query Store | SO:14,16 · QWO:13,14,20 · APP:07 |
| `sys.query_store_plan` | Execution plans in Query Store | SO:14 · QWO:13,14,20 |
| `sys.query_store_runtime_stats` | Runtime statistics per plan | SO:14,16 · QWO:13,14,20 |
| `sys.query_store_runtime_stats_interval` | Statistics collection intervals | QWO:20 |
| `sys.query_store_wait_stats` | Per-query wait statistics | SO:06,16 · QWO:20 |
| `sys.query_store_query_hints` | Query Store hints | QWO:13,20 |
| `sys.query_store_plan_feedback` | Plan feedback entries | QWO:13 |
| `sys.plan_persist_plan` | Persisted plan data | SO:06 |

### XML

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.xml_indexes` | XML indexes | QWO:09 |
| `sys.xml_schema_collections` | Registered XML schema collections | QWO:09 |
| `sys.xml_schema_namespaces` | XML schema namespaces | QWO:09 |

### Miscellaneous

| Catalog View | Purpose | Source Pages |
|---|---|---|
| `sys.time_zone_info` | Time zone definitions available to AT TIME ZONE | QWO:08 |
| `sys.sysprocesses` | Legacy process view (use dm_exec_sessions/requests instead) | SO:02 |
| `sys.syslanguages` | Language definitions | QWO:15 |

---

## Appendix — System Stored Procedures

> [!abstract] System stored procedures referenced in the chapter
>
> This appendix lists the `sys.sp_*` and `sys.xp_*` procedures used across the chapter. For parameter documentation, see the vault pages listed in each entry.

### CDC Procedures

| Procedure | Purpose | Source Pages |
|---|---|---|
| `sys.sp_cdc_enable_db` | Enable CDC on a database | DDS:10 |
| `sys.sp_cdc_disable_db` | Disable CDC on a database | DDS:10 |
| `sys.sp_cdc_enable_table` | Enable CDC on a table | DDS:10 |
| `sys.sp_cdc_disable_table` | Disable CDC on a table | DDS:10 |
| `sys.sp_cdc_scan` | Manually trigger a CDC log scan (when Agent is unavailable) | DDS:10 |
| `sys.sp_cdc_change_job` | Modify CDC capture or cleanup job parameters | DDS:10 |

### Query Store Procedures

| Procedure | Purpose | Source Pages |
|---|---|---|
| `sys.sp_query_store_force_plan` | Force a specific execution plan for a query | SO:14 · QWO:20 |
| `sys.sp_query_store_unforce_plan` | Remove a forced plan | SO:14 · QWO:20 |
| `sys.sp_query_store_flush_db` | Flush in-memory Query Store data to disk | QWO:20 |
| `sys.sp_query_store_set_hints` | Apply Query Store hints to a query | QWO:20 |
| `sys.sp_query_store_clear_hints` | Remove Query Store hints | QWO:20 |

### General System Procedures

| Procedure | Purpose | Source Pages |
|---|---|---|
| `sys.sp_executesql` | Execute parameterized dynamic SQL | QWO:19 |
| `sys.sp_getapplock` | Acquire an application-level lock | QWO:18 |
| `sys.sp_set_session_context` | Set session context key-value pairs | QWO:15 |
| `sys.sp_helpdb` | Database summary information | SO:02 |
| `sys.sp_databases` | List accessible databases | QWO:10 |
| `sys.sp_sequence_get_range` | Preallocate a range of sequence values | DDS:04 |
| `sys.sp_cleanup_temporal_history` | Clean up temporal table history | DDS:10 |

### Extended Stored Procedures

| Procedure | Purpose | Source Pages |
|---|---|---|
| `sys.xp_readerrorlog` | Read SQL Server error log entries | SO:02 |
| `sys.xp_fileexist` | Check if a file exists on disk | SO:13 |
