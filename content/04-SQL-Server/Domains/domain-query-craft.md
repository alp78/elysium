---
title: "Domain: Query Craft"
tags:
  - domain
  - sql-server
---

# Query Craft

T-SQL query writing and performance tuning from SARGability and execution plans through wait stats, memory diagnostics, and pipeline integration.

```mermaid
mindmap
  ((Query Craft and Performance))
    (SARGable queries)
    (MERGE and upsert)
    (date and time functions)
    (execution plans)
    (query plan analysis)
    (wait stats analysis)
    (memory and buffer pool)
    (index maintenance)
    (performance audit)
    (pipeline integration)
    (PIT integrity logic)
```

> [!abstract]- [[sargable-queries]]
>
> - [[sargable-queries#SARGable vs Non-SARGable — Functions on Columns|Functions on columns]]
> - [[sargable-queries#Detecting Non-SARGable Predicates in Execution Plans|Detecting in execution plans]]
> - [[sargable-queries#Implicit Conversions — The Silent Killer|Implicit conversions]]
> - [[sargable-queries#SARGability Quick Reference for the Pipeline|Pipeline quick reference]]

> [!abstract]- [[merge-and-upsert]]
>
> - [[merge-and-upsert#The Four Load Patterns at a Glance|Four load patterns]]
> - [[merge-and-upsert#Strategy 3: SCD Type 2 — Close Old, Insert New (Silver Dimensions)|SCD Type 2 pattern]]
> - [[merge-and-upsert#T-SQL MERGE Statement (Atomic Upsert)|T-SQL MERGE statement]]
> - [[merge-and-upsert#Transaction Management|Transaction management]]

> [!abstract]- [[date-and-time-functions]]
>
> - [[date-and-time-functions#ISO 8601 — The Only Date Format You Should Use|ISO 8601 formats]]
> - [[date-and-time-functions#Parsing and Formatting|Parsing and formatting]]
> - [[date-and-time-functions#Timezone Conversion with AT TIME ZONE|Timezone conversion]]
> - [[date-and-time-functions#Practical Pipeline Date Patterns|Pipeline date patterns]]
> - [[date-and-time-functions#DST Pitfalls That Break Pipelines|DST pitfalls]]

> [!abstract]- [[execution-plans]]
>
> - [[execution-plans#Reading the Visual Tree in SSMS|Reading the visual tree]]
> - [[execution-plans#Getting Plans from the Pipeline (Non-SSMS)|Getting plans from the pipeline]]
> - [[execution-plans#Cost Analysis — Finding the Most Expensive Operator|Cost analysis]]
> - [[execution-plans#Cardinality Estimation — Detecting Bad Row Count Guesses|Cardinality estimation]]
> - [[execution-plans#Parameter Sniffing|Parameter sniffing]]
> - [[execution-plans#Batch Mode Execution|Batch mode execution]]

> [!abstract]- [[query-plan-analysis]]
>
> - [[query-plan-analysis#How to Read an Execution Plan|Reading an execution plan]]
> - [[query-plan-analysis#Capturing Plans from the Pipeline (Without SSMS)|Capturing plans programmatically]]
> - [[query-plan-analysis#Cardinality Estimation — Detecting Bad Row Count Guesses|Cardinality estimation]]
> - [[query-plan-analysis#Parameter Sniffing|Parameter sniffing]]
> - [[query-plan-analysis#Query Store Setup and Regression Detection|Query Store regression detection]]

> [!abstract]- [[wait-stats-analysis]]
>
> - [[wait-stats-analysis#System Health Dashboard — First Check|System health dashboard]]
> - [[wait-stats-analysis#Top Waits Query — The Primary Diagnostic|Top waits query]]
> - [[wait-stats-analysis#Top Resource-Consuming Queries|Top resource consumers]]
> - [[wait-stats-analysis#TempDB Contention Detection|TempDB contention]]
> - [[wait-stats-analysis#Query Store — Regression Detection|Query Store regression detection]]

> [!abstract]- [[memory-and-buffer-pool]]
>
> - [[memory-and-buffer-pool#Memory Sizing Rule|Memory sizing rule]]
> - [[memory-and-buffer-pool#Page Life Expectancy (PLE)|Page life expectancy]]
> - [[memory-and-buffer-pool#Memory Clerks — Where Memory Is Being Used|Memory clerks]]
> - [[memory-and-buffer-pool#Pending Memory Grants|Pending memory grants]]
> - [[memory-and-buffer-pool#Memory Pressure Diagnosis Flow|Memory pressure diagnosis]]

> [!abstract]- [[index-maintenance]]
>
> - [[index-maintenance#Fragmentation Detection|Fragmentation detection]]
> - [[index-maintenance#REORGANIZE — Online, Lightweight|REORGANIZE]]
> - [[index-maintenance#REBUILD — Heavier, More Thorough|REBUILD]]
> - [[index-maintenance#Automated Maintenance Script|Automated maintenance script]]
> - [[index-maintenance#Pipeline Maintenance Schedule|Pipeline maintenance schedule]]
> - [[index-maintenance#Index Discovery|Index discovery queries]]

> [!abstract]- [[performance-audit-playbook]]
>
> - [[performance-audit-playbook#Phase 1: Instance Overview|Instance overview]]
> - [[performance-audit-playbook#Phase 2: Memory Pressure|Memory pressure]]
> - [[performance-audit-playbook#Phase 3: Wait Statistics|Wait statistics]]
> - [[performance-audit-playbook#Phase 5: Expensive Queries|Expensive queries]]
> - [[performance-audit-playbook#Phase 6: Index Health|Index health]]
> - [[performance-audit-playbook#DBCC and Trace Flag Reference|DBCC and trace flags]]

> [!abstract]- [[pipeline-integration-and-devex]]
>
> - [[pipeline-integration-and-devex#Query Tagging for Airflow Correlation|Query tagging for Airflow]]
> - [[pipeline-integration-and-devex#Connection Pool Management|Connection pool management]]
> - [[pipeline-integration-and-devex#Datadog SQL Server Agent — Full Configuration|Datadog agent configuration]]

> [!abstract]- [[pit-integrity-logic]]
>
> - [[pit-integrity-logic#Effective-Dated Constituent Lists|Effective-dated constituent lists]]
> - [[pit-integrity-logic#Bi-Temporal Model|Bi-temporal model]]
> - [[pit-integrity-logic#Weight Normalization|Weight normalization]]
> - [[pit-integrity-logic#Performance Tuning for Large-Scale Joins|Large-scale join tuning]]
> - [[pit-integrity-logic#Reconciliation Queries|Reconciliation queries]]
