---
title: "Deadlock Detection and Prevention"
tags: [sql-server, tsql]
aliases: [deadlocks, deadlock, error 1205, circular wait, deadlock victim, deadlock monitor, deadlock retry]
description: "SQL Server deadlock detection, prevention, and monitoring — what causes deadlocks, how to detect them with DMVs and Extended Events, RCSI as the primary prevention, and application-level retry logic."
parent: "[[domain-concurrency-and-security]]"
links:
  - "[[sql-server-authentication]]"
  - "[[tde-encryption]]"
  - "[[audit-logging]]"
  - "[[blocking-and-locking]]"
  - "[[race-conditions]]"
created: 2026-03-22
updated: 2026-04-04
status: complete
---

# Deadlock Detection and Prevention

> [!quote]
> "The order in which locks are acquired is the single most important factor in deadlock prevention."
>
> — **Jim Gray**, *Transaction Processing: Concepts and Techniques* (1992)

A deadlock occurs when two or more sessions each hold a lock that the other needs, creating a circular wait. Neither session can proceed because each is waiting for the other to release its lock. SQL Server's background **lock monitor thread** continuously checks for deadlocks and resolves them by killing the session with the lowest estimated rollback cost (the "deadlock victim"), which receives error 1205.

---

## Understanding Deadlocks

A deadlock is the most severe form of lock contention. Unlike regular blocking (where one session simply waits for another to finish), a deadlock creates a cycle that can never resolve on its own — SQL Server must intervene.

### What is a deadlock?

In the simplest case, two sessions each hold a lock that the other needs:

```text
Session A: holds EXCLUSIVE lock on Table1, waiting for lock on Table2
Session B: holds EXCLUSIVE lock on Table2, waiting for lock on Table1
→ Neither can continue → deadlock
```

The lock monitor thread detects this circular wait and chooses one session as the victim. The victim's transaction is rolled back (releasing all its locks), and the victim receives error 1205. The surviving session proceeds normally — it receives no notification that a deadlock occurred.

```text
Msg 1205, Level 13, State 51
Transaction (Process ID XX) was deadlocked on lock resources with another
process and has been chosen as the deadlock victim. Rerun the transaction.
```

For Python retry patterns around error 1205, see [08_py_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/Python/08_py_errorhandling); for C# `SqlException` retry wrappers, see [08_cs_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/08_cs_errorhandling).

> [!tip] Blocking vs Deadlock
>
> **Blocking**: Session A holds a lock, Session B waits. One-way dependency. B eventually proceeds when A commits. This is normal and expected — see [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking).
> **Deadlock**: Session A waits for B, and B waits for A. Circular dependency. Neither can ever proceed. SQL Server must intervene and kill one.

### Deadlock monitor thread behavior

The lock monitor thread runs in the background and performs periodic deadlock searches. The search interval is dynamic:

1. **Default interval:** 5 seconds between searches.
2. **After a deadlock is detected:** The interval drops to as low as **100 milliseconds**, depending on the frequency of deadlocks.
3. **When deadlocks stop occurring:** The interval gradually increases back to 5 seconds.
4. **Immediate trigger:** After a deadlock is detected, the very next lock wait triggers a deadlock search immediately rather than waiting for the timer.

### Deadlock victim selection

SQL Server selects the victim using these criteria, in order:

1. **Deadlock priority:** The session with the lower `DEADLOCK_PRIORITY` value is killed. Priority ranges from -10 (most likely to be killed) to 10 (least likely). `LOW` maps to -5, `NORMAL` to 0 (default), `HIGH` to 5.
2. **Rollback cost:** If both sessions have the same priority, the session with the fewest transaction log bytes written (cheapest to roll back) is killed.
3. **Random:** If priority and cost are equal, the victim is chosen randomly.

```sql
SET DEADLOCK_PRIORITY LOW;
```

> [!tip] Use DEADLOCK_PRIORITY in Pipeline Code
>
> Set `DEADLOCK_PRIORITY LOW` on pipeline sessions that have retry logic (e.g., Airflow tasks with automatic retries). Set `DEADLOCK_PRIORITY HIGH` on interactive or latency-sensitive sessions (e.g., API endpoints) that should survive a deadlock. This ensures the retry-capable process is killed first, minimizing user-facing impact.

### Common deadlock scenarios

| Scenario | Example |
|----------|---------|
| Two pipeline steps updating the same tables in different order | Step 1 writes silver then gold, step 2 writes gold then silver |
| Dashboard reads blocking pipeline writes | Reader takes shared lock on index, writer needs exclusive lock, and vice versa on another resource |
| Concurrent MERGE/UPDATE on overlapping rows | Two processes upsert to the same table with overlapping key ranges |
| Index maintenance + queries | A query locks data pages while an index rebuild locks index pages, and they cross |
| Clustered + nonclustered index cross-locking | An UPDATE modifies a column that belongs to both a clustered index key and a nonclustered index; one session locks the clustered page first, another locks the nonclustered page first |

---

## Detecting Deadlocks

SQL Server provides multiple tools for detecting deadlocks, from quick cumulative counters to persistent Extended Events capture. The approaches below are ordered from simplest (one-off checks) to most comprehensive (persistent file-backed monitoring). For most production environments, a persistent Extended Events session is the minimum baseline.

### Quick Check — Total Deadlocks Since Last Restart

```sql
SELECT cntr_value AS deadlock_count
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec'
  AND instance_name = '_Total';
```

### Recent Deadlocks via system_health Session

> [!warning] Ring Buffer Has Limited Capacity
>
> The `system_health` ring buffer holds only a few MB of events. Under heavy deadlock activity, older reports are silently evicted. If you investigate a deadlock reported hours ago, the graph may already be gone. Set up a persistent Extended Events session (below) for any database that has ever had a production deadlock.

> [!success] Fix — Create a Persistent Extended Events Session
>
> Create a dedicated `deadlock_monitor` Extended Events session that writes to an `.xel` file on disk (see the session definition below). Set `STARTUP_STATE = ON` so it survives restarts. File-backed sessions retain the full history up to the configured `max_file_size` limit regardless of ring buffer eviction.

SQL Server's built-in `system_health` Extended Events session captures deadlock reports automatically:

```sql
;WITH deadlocks AS (
    SELECT
        xdr.value('@timestamp', 'datetime2') AS deadlock_time,
        xdr.query('.') AS deadlock_graph
    FROM (
        SELECT CAST(target_data AS XML) AS target_data
        FROM sys.dm_xe_sessions s
        JOIN sys.dm_xe_session_targets t
            ON s.address = t.event_session_address
        WHERE s.name = 'system_health'
          AND t.target_name = 'ring_buffer'
    ) AS data
    CROSS APPLY target_data.nodes(
        'RingBufferTarget/event[@name="xml_deadlock_report"]'
    ) AS x(xdr)
)
SELECT TOP 10 deadlock_time, deadlock_graph
FROM deadlocks
ORDER BY deadlock_time DESC;
```

### Trace Flags 1204 and 1222 (legacy)

Before Extended Events, trace flags were the primary method for capturing deadlock details. Trace flag **1204** reports deadlock information formatted by each node involved. Trace flag **1222** formats output in an XML-like structure with three sections: the deadlock victim, then processes, then resources. Both write to the SQL Server error log when a deadlock occurs.

> [!warning] Avoid Trace Flags on Workload-Intensive Systems
>
> Trace flags 1204 and 1222 can introduce performance overhead on high-throughput systems. Microsoft recommends using the `xml_deadlock_report` Extended Event instead — it captures the same information with lower overhead and writes to a file target rather than the error log.

> [!success] Preferred Approach — Use Extended Events
>
> The `system_health` session captures deadlock graphs by default (no setup needed). For persistent capture with configurable retention, create a dedicated Extended Events session as shown in the [next section](#extended-events-session-for-persistent-capture).

### Current Blocking Chains (Deadlock Precursor)

Blocking chains are a precursor to deadlocks — if two blocking chains form a cycle, a deadlock results. This query shows all currently blocked sessions. If you see the same sessions repeatedly blocking each other in different orders, a deadlock is likely imminent.

```sql
SELECT
    r.session_id      AS blocked_session,
    r.blocking_session_id AS blocking_session,
    r.wait_type,
    r.wait_time / 1000 AS wait_seconds,
    SUBSTRING(st.text, 1, 200) AS blocked_query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE r.blocking_session_id > 0;
```

---

## Extended Events Session for Persistent Capture

The `system_health` ring buffer has limited capacity. For persistent deadlock capture, create a dedicated Extended Events session that writes to an `.xel` file on disk.

### Create a persistent deadlock capture session

This session captures every `xml_deadlock_report` event to a file. The `max_file_size` controls the maximum size per `.xel` file (10 MB in this example). `STARTUP_STATE = ON` ensures the session starts automatically after an instance restart, so no deadlocks are missed.

```sql
CREATE EVENT SESSION [deadlock_monitor] ON SERVER
ADD EVENT sqlserver.xml_deadlock_report
ADD TARGET package0.event_file (
    SET filename = N'/var/opt/mssql/log/deadlocks.xel',
        max_file_size = 10
)
WITH (
    MAX_MEMORY = 4096 KB,
    STARTUP_STATE = ON
);

ALTER EVENT SESSION [deadlock_monitor] ON SERVER STATE = START;
```

> [!tip] Azure SQL Database Uses a Different Event Name
>
> On Azure SQL Database, the event is `database_xml_deadlock_report` (scoped to the database) rather than `sqlserver.xml_deadlock_report` (scoped to the server instance). Adjust the `ADD EVENT` line when creating a session on Azure SQL Database.

### Querying captured deadlock events

Once the persistent session is running, use `sys.fn_xe_file_target_read_file` to read the captured events from the `.xel` file. The `deadlock_xml` column contains the full deadlock graph in XML format, which shows the involved sessions, the SQL text each was executing, the lock types held and requested, and which session was chosen as the victim.

```sql
SELECT
    event_data.value('(event/@timestamp)[1]', 'datetime2') AS deadlock_time,
    event_data.value(
        '(event/data[@name="xml_report"]/value)[1]', 'nvarchar(max)'
    ) AS deadlock_xml
FROM (
    SELECT CAST(event_data AS XML) AS event_data
    FROM sys.fn_xe_file_target_read_file(
        '/var/opt/mssql/log/deadlocks*.xel', NULL, NULL, NULL
    )
) AS data
ORDER BY deadlock_time DESC;
```

### Reading the deadlock graph XML

The deadlock XML report contains three top-level nodes:

1. **`victim-list`:** Identifies which process was selected as the deadlock victim (by physical memory address of the task).
2. **`process-list`:** Each participating session with its full execution context. Key attributes per process:
   - `spid` — session ID
   - `isolationlevel` — the transaction isolation level in effect
   - `logused` — transaction log bytes written (determines rollback cost for victim selection)
   - `waitresource` — the specific resource the process is waiting for
   - `waittime` — milliseconds spent waiting
   - `lastbatchstarted` / `lastbatchcompleted` — timestamps for diagnosing idle sessions holding locks
   - `inputbuf` — the SQL text being executed
3. **`resource-list`:** The locked resources (tables, indexes, pages, keys) with the lock modes currently held and requested by each process. Each resource entry shows the `owner` (process holding the lock) and `waiter` (process requesting the lock).

To identify the root cause, follow this sequence: (1) check which tables appear in the `resource-list` to understand the contention surface, (2) compare lock modes held vs requested — S held + X requested indicates a reader-writer conflict, while X held + X requested indicates writer-writer, and (3) read the `inputbuf` in each process node to determine the table access order that created the cycle.

> [!tip] Visualize Deadlock Graphs in SSMS
>
> Save the XML from the `deadlock_xml` column to a file with a `.xdl` extension, then open it in SQL Server Management Studio. SSMS renders it as a visual graph showing the processes, resources, and the circular wait — far easier to interpret than raw XML.

---

## Preventing Deadlocks

Deadlock prevention is about eliminating the conditions that create circular waits. The strategies below are ordered by effectiveness — apply from the top down.

### Prevention strategies

| Strategy | What it does | Impact |
|----------|-------------|--------|
| **Enable RCSI** | Readers use row-version snapshots instead of shared locks — eliminates reader/writer deadlocks entirely | **High** — fixes the most common deadlock type |
| **Consistent access order** | All code accesses tables in the same order (e.g., always silver → gold, never gold → silver) | **High** — breaks the circular dependency that causes writer/writer deadlocks |
| **Keep transactions short** | Commit as soon as possible — shorter lock duration means smaller deadlock window | **High** — reduces opportunity for overlap |
| **SET DEADLOCK_PRIORITY** | Mark retry-capable sessions as `LOW` priority so they are killed first | **Medium** — controls which session survives, doesn't prevent the deadlock |
| **Add covering indexes** | Queries lock fewer pages when they can use an index instead of scanning the table | **Medium** — reduces lock surface area |
| **Retry on error 1205** | Catch the deadlock error in application code and retry the transaction | **Safety net** — doesn't prevent, but handles gracefully |

> [!info] SQL Server 2022+ / Azure SQL Database — Optimized Locking Reduces Deadlocks
>
> Optimized locking (TID locking + Lock After Qualification) can avoid certain types of deadlocks because row and page locks are released immediately after modification rather than held until `COMMIT`. With fewer locks held concurrently, the window for circular waits shrinks significantly. Optimized locking is always enabled in Azure SQL Database and available in SQL Server 2022 (16.x) and later. See [blocking-and-locking > Optimized Locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking#sql-server-2022--azure-sql-database--optimized-locking) for the full explanation.

> [!tip] Related pattern: Airflow task retries
>
> When deadlocks occur during orchestrated pipeline runs, [airflow-troubleshooting](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-troubleshooting) covers configuring Airflow task-level retries with exponential back-off for transient database errors like 1205.

> [!tip] The Single Most Effective Prevention
>
> Enable [Read Committed Snapshot Isolation (RCSI)](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration). With RCSI, the dashboard (reader) never competes with the pipeline (writer) for locks:
> ```sql
> ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
> ```

---

## Application-Level Retry Logic

Deadlocks are transient errors — the same transaction will usually succeed on retry because the other session has completed and released its locks. Every application that writes to SQL Server should include retry logic for error 1205.

### C# | Dapper | centralized deadlock retry helper

```csharp
public class DbConnectionFactory
{
    private const int DeadlockErrorNumber = 1205;
    private const int MaxRetries = 3;
    private readonly string _connectionString;

    public DbConnectionFactory(string connectionString)
        => _connectionString = connectionString;

    public IDbConnection Create() => new SqlConnection(_connectionString);

    /// <summary>
    /// Executes a database operation with automatic retry on deadlock (error 1205).
    /// Uses incremental back-off: 100ms, 200ms, 300ms between retries.
    /// </summary>
    public async Task<T> WithDeadlockRetryAsync<T>(
        Func<IDbConnection, Task<T>> operation)
    {
        for (int attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                using var conn = Create();
                return await operation(conn);
            }
            catch (SqlException ex)
                when (ex.Number == DeadlockErrorNumber && attempt < MaxRetries)
            {
                await Task.Delay(attempt * 100); // 100ms, 200ms back-off
            }
        }
        // Final attempt — let exceptions propagate
        using var finalConn = Create();
        return await operation(finalConn);
    }
}
```

This ensures: transparent recovery, incremental back-off, bounded retries (no infinite loops), and fresh connection per retry.

> [!warning] Retry Must Re-execute the Entire Transaction
>
> A deadlock rolls back the entire transaction, not just the last statement. If your retry logic only re-executes the failed statement, the preceding statements in the transaction are lost and the data ends up inconsistent. Always wrap the complete `BEGIN TRAN...COMMIT` sequence inside the retry loop.

> [!success] Safe Pattern — Wrap the Full Transaction in the Retry Loop
>
> Structure the retry helper so the entire operation (all statements from BEGIN TRAN to COMMIT) is passed as a single delegate or callable. The `WithDeadlockRetryAsync` pattern above demonstrates this correctly: the `operation` lambda receives a fresh connection on each attempt and executes the full transactional unit, not individual statements.

---

## Reproducing a Deadlock for Testing

Reproducing deadlocks in a controlled environment is essential for validating retry logic and understanding deadlock graph output. The pattern below creates a classic writer/writer deadlock using opposite access order on two tables.

### Setup — create test tables

Create two tables and insert a single row into each. Open two separate query windows in SSMS — one for Session 1 and one for Session 2.

```sql
USE analytics_db;
GO
CREATE TABLE dbo.deadlock_test_a (id INT PRIMARY KEY, val VARCHAR(50));
CREATE TABLE dbo.deadlock_test_b (id INT PRIMARY KEY, val VARCHAR(50));
INSERT INTO dbo.deadlock_test_a VALUES (1, 'init');
INSERT INTO dbo.deadlock_test_b VALUES (1, 'init');
GO
```

### Session 1 — lock table A, then request table B

Run this in the first query window. The `WAITFOR DELAY` holds the exclusive lock on table A open for 2 minutes, giving you time to start Session 2.

```sql
BEGIN TRAN;
UPDATE dbo.deadlock_test_a SET val = 'session1' WHERE id = 1;
WAITFOR DELAY '00:02:00';
UPDATE dbo.deadlock_test_b SET val = 'session1' WHERE id = 1;
COMMIT;
```

### Session 2 — lock table B, then request table A (deadlock)

Run this in the second query window while Session 1 is waiting. The first UPDATE succeeds (acquires X lock on table B). The second UPDATE hangs — waiting for Session 1's X lock on table A. SQL Server detects the circular wait within seconds and kills one session.

```sql
BEGIN TRAN;
UPDATE dbo.deadlock_test_b SET val = 'session2' WHERE id = 1;
UPDATE dbo.deadlock_test_a SET val = 'session2' WHERE id = 1;
COMMIT;
```

> [!warning] RCSI Does Not Prevent Writer/Writer Deadlocks
>
> RCSI eliminates reader/writer deadlocks (because readers use row-version snapshots instead of shared locks), but the writer/writer pattern above works regardless of isolation level. Two sessions both acquiring exclusive locks in different order will deadlock under any isolation level.

> [!success] Safe Pattern — Use a Dedicated Test Database
>
> Run deadlock reproduction tests in an isolated test database. Never disable RCSI on a production database just to reproduce a reader/writer deadlock.

> [!danger] RCSI Has a Hidden tempdb Cost
>
> Enabling RCSI stores row versions in `tempdb`. Under heavy write load (bulk inserts, MERGE operations), `tempdb` can grow dramatically and become the new bottleneck. Monitor `tempdb` size and I/O after enabling RCSI — especially during pipeline runs that INSERT/UPDATE millions of rows. If `tempdb` runs out of space, all transactions across all databases on the instance fail.

> [!success] Fix — Size tempdb Appropriately and Monitor Version Store
>
> Pre-size `tempdb` data files to accommodate expected version store growth before enabling RCSI. Monitor version store size with `SELECT SUM(version_store_reserved_page_count) * 8 / 1024 AS version_store_mb FROM sys.dm_db_file_space_usage` (run in `tempdb`). If the version store grows beyond 1 GB, investigate long-running transactions that are preventing cleanup using `sys.dm_tran_active_snapshot_database_transactions`.

### Cleanup — drop test tables

```sql
DROP TABLE IF EXISTS dbo.deadlock_test_a;
DROP TABLE IF EXISTS dbo.deadlock_test_b;
```

---

## Related

- [blocking-and-locking](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/blocking-and-locking) — Lock types, compatibility matrix, isolation levels, RCSI, and lock escalation
- [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) — When concurrent access produces wrong data (not stuck processes)
- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Where deadlock retry fits in the broader error classification and retry strategy framework
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — RCSI and other server settings that prevent deadlocks
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — LCK_M wait types indicate lock contention
