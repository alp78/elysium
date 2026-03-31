---
type: concept
category: sql-server
technology: [sql-server, csharp]
tags: [csharp, sql, sql-server, tsql]
aliases: [deadlocks, deadlock, error 1205, circular wait, deadlock victim, deadlock monitor, deadlock retry]
keywords: [deadlock, detection, prevention, monitoring, error 1205, circular wait, RCSI, read committed snapshot isolation, extended events, blocking, lock, exclusive lock, shared lock, deadlock graph, retry logic, back-off]
description: "SQL Server deadlock detection, prevention, and monitoring — what causes deadlocks, how to detect them with DMVs and Extended Events, RCSI as the primary prevention, and application-level retry logic."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Deadlock Detection and Prevention

> [!quote]
> "The order in which locks are acquired is the single most important factor in deadlock prevention."
> — **Jim Gray**, *Transaction Processing: Concepts and Techniques* (1992)

A deadlock occurs when two or more sessions each hold a lock that the other needs, creating a circular wait. Neither session can proceed because each is waiting for the other to release its lock. SQL Server's background deadlock monitor thread checks every 5 seconds and kills the session with the lowest estimated rollback cost (the "victim"), which receives error 1205.

### What Is a Deadlock?

```text
Session A: holds EXCLUSIVE lock on Table1, waiting for lock on Table2
Session B: holds EXCLUSIVE lock on Table2, waiting for lock on Table1
→ Neither can continue → deadlock
```

The surviving session proceeds normally — it is not notified that a deadlock occurred. The victim receives error 1205, which must be handled with retry logic in application code. For Python retry patterns around this error, see [08_py_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/Python/08_py_errorhandling); for C# `SqlException` retry wrappers, see [08_cs_errorhandling](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/08_cs_errorhandling).

```text
Msg 1205, Level 13, State 51
Transaction (Process ID XX) was deadlocked on lock resources with another
process and has been chosen as the deadlock victim. Rerun the transaction.
```

### When Do Deadlocks Happen?

| Scenario | Example |
|----------|---------|
| Two pipeline steps updating the same tables in different order | Step 1 writes silver then gold, step 2 writes gold then silver |
| Dashboard reads blocking pipeline writes | Reader takes shared lock on index, writer needs exclusive lock, and vice versa on another resource |
| Concurrent MERGE/UPDATE on overlapping rows | Two processes upsert to the same table with overlapping key ranges |
| Index maintenance + queries | A query locks data pages while an index rebuild locks index pages, and they cross |

> [!tip] Blocking vs Deadlock
>
> **Blocking**: Session A holds a lock, Session B waits. One-way wait. B eventually proceeds when A commits. This is normal and expected.
> **Deadlock**: Session A waits for B, and B waits for A. Circular wait. Neither can ever proceed. SQL Server must intervene and kill one.

## Detecting Deadlocks

### Quick Check — Total Deadlocks Since Last Restart

```sql
SELECT cntr_value AS deadlock_count
FROM sys.dm_os_performance_counters
WHERE counter_name = 'Number of Deadlocks/sec'
  AND instance_name = '_Total';
```

### Recent Deadlocks via system_health Session

> [!warning] Ring Buffer Limited Capacity
>
> system_health Ring Buffer Has Limited Capacity.
> The `system_health` ring buffer holds only a few MB of events. Under heavy deadlock activity, older reports are silently evicted. If you investigate a deadlock reported hours ago, the graph may already be gone. Set up a persistent Extended Events session (below) for any database that has ever had a production deadlock.

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

### Current Blocking Chains (Deadlock Precursor)

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

## Extended Events Session for Persistent Capture

The `system_health` ring buffer has limited capacity. For persistent deadlock capture:

```sql
CREATE EVENT SESSION [deadlock_monitor] ON SERVER
ADD EVENT sqlserver.xml_deadlock_report
ADD TARGET package0.event_file (
    SET filename = N'/var/opt/mssql/log/deadlocks.xel',
        max_file_size = 10  -- MB per file
)
WITH (
    MAX_MEMORY = 4096 KB,
    STARTUP_STATE = ON       -- survives restarts
);

ALTER EVENT SESSION [deadlock_monitor] ON SERVER STATE = START;
```

#### sys.fn_xe_file_target_read_target_data — query captured deadlock events

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

### Preventing Deadlocks

| Strategy | What it does | Impact |
|----------|-------------|--------|
| **Enable RCSI** | Readers use row-version snapshots instead of shared locks — eliminates reader/writer deadlocks entirely | **High** — fixes the most common deadlock type |
| **Consistent access order** | All code accesses tables in the same order (e.g., always silver → gold, never gold → silver) | **High** — breaks the circular dependency |
| **Keep transactions short** | Commit as soon as possible — shorter lock duration means smaller deadlock window | **High** — reduces opportunity for overlap |
| **Use NOLOCK for reports** | Dashboard reads don't take locks at all (accepts dirty reads) | **Medium** — only appropriate for non-critical reads |
| **Add covering indexes** | Queries lock fewer pages when they can use an index instead of scanning the table | **Medium** — reduces lock surface area |
| **Retry on error 1205** | Catch the deadlock error in application code and retry the transaction | **Safety net** — doesn't prevent, but handles gracefully |

> [!tip] Related pattern: Airflow task retries
>
> When deadlocks occur during orchestrated pipeline runs, [airflow-troubleshooting](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-troubleshooting) covers configuring Airflow task-level retries with exponential back-off for transient database errors like 1205.

> [!tip] The Single Most Effective Prevention
>
> Enable [Read Committed Snapshot Isolation (RCSI)](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration). With RCSI, the dashboard (reader) never competes with the pipeline (writer) for locks:
> ```sql
> ALTER DATABASE analytics_db SET READ_COMMITTED_SNAPSHOT ON;
> ```

## Application-Level Retry Logic

#### C# Dapper ExecuteWithRetry — centralized deadlock retry helper

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

> [!warning] Retry Must Re-execute Entire Transaction
>
> Retry Logic Must Re-execute the Entire Transaction.
> A deadlock rolls back the entire transaction, not just the last statement. If your retry logic only re-executes the failed statement, the preceding statements in the transaction are lost and the data ends up inconsistent. Always wrap the complete BEGIN TRAN...COMMIT sequence inside the retry loop.

## Reproducing a Deadlock for Testing

#### CREATE TABLE — step 1: set up deadlock reproduction tables
```sql
USE analytics_db
GO
CREATE TABLE dbo.deadlock_test_a (id INT PRIMARY KEY, val VARCHAR(50))
CREATE TABLE dbo.deadlock_test_b (id INT PRIMARY KEY, val VARCHAR(50))
INSERT INTO dbo.deadlock_test_a VALUES (1, 'init')
INSERT INTO dbo.deadlock_test_b VALUES (1, 'init')
GO
```

#### BEGIN TRAN — step 2: session 1 locks table A then requests B
```sql
BEGIN TRAN
UPDATE dbo.deadlock_test_a SET val = 'session1' WHERE id = 1
WAITFOR DELAY '00:02:00'  -- holds the lock open
UPDATE dbo.deadlock_test_b SET val = 'session1' WHERE id = 1  -- will try to get lock on B
COMMIT
```

#### BEGIN TRAN — step 3: session 2 locks table B then requests A (deadlock)
```sql
BEGIN TRAN
UPDATE dbo.deadlock_test_b SET val = 'session2' WHERE id = 1  -- succeeds, holds lock on B
UPDATE dbo.deadlock_test_a SET val = 'session2' WHERE id = 1  -- HANGS — waiting for Session 1's lock on A
COMMIT
```

SQL Server detects the circular wait within 5 seconds and kills one session.

> [!warning] RCSI and Deadlock Testing
>
> If RCSI is enabled, reader/writer deadlocks cannot be reproduced because readers use row-version snapshots. The writer/writer pattern above still works regardless of isolation level.

> [!danger] RCSI Has a Hidden tempdb Cost
>
> Enabling RCSI stores row versions in `tempdb`. Under heavy write load (bulk inserts, MERGE operations), `tempdb` can grow dramatically and become the new bottleneck. Monitor `tempdb` size and I/O after enabling RCSI -- especially during pipeline runs that INSERT/UPDATE millions of rows. If `tempdb` runs out of space, all transactions across all databases on the instance fail.

#### DROP TABLE — cleanup deadlock test tables
```sql
DROP TABLE IF EXISTS dbo.deadlock_test_a
DROP TABLE IF EXISTS dbo.deadlock_test_b
```

### Related

- [error-handling-and-retry-patterns](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Where deadlock retry fits in the broader error classification and retry strategy framework
- [race-conditions](https://alp78.github.io/elysium/04-SQL-Server/Concurrency/race-conditions) — When concurrent access produces wrong data (not stuck processes)
- [server-configuration](https://alp78.github.io/elysium/04-SQL-Server/Administration/server-configuration) — RCSI and other server settings that prevent deadlocks
- [wait-stats-analysis](https://alp78.github.io/elysium/04-SQL-Server/Performance/wait-stats-analysis) — LCK_M wait types indicate lock contention
