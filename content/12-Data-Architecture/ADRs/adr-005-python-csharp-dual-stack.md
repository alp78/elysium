---
tags: [adr, python, csharp]
type: reference
status: accepted
updated: 2026-03-23
---

# ADR-005: Python + C# Dual Language Stack

## Status
Accepted | 2026-03-23

## Context
The platform uses Python for pipelines and C# for serving. Should we consolidate to one language?

## Decision
Maintain the dual stack with clear role separation.

**Role separation:**
- Python owns: ingestion, transformation, orchestration, Cloud Run batch jobs, Airflow DAGs
- C# owns: serving APIs (Dapper), dashboards (Blazor), Windows-specific tasks

**Why:**
- Python excels at data manipulation (pandas/Polars), GCP client libraries, rapid prototyping
- C# excels at high-performance APIs, Blazor dashboards, strong typing at scale
- Team has expertise in both; forcing consolidation loses the best tool for each job
- GCP SDKs available in both; no platform lock-in

## Consequences
- **Easier:** Each language used where it excels
- **Harder:** Two dependency ecosystems, two CI/CD pipelines
- **Hiring:** Need engineers comfortable with both, or clearly delineated roles

## Alternatives Considered
- **Python only:** Viable for pipelines but inferior for high-performance APIs and Blazor-style dashboards
- **C# only:** Viable for APIs but weaker data manipulation, no native Airflow support
- **Go:** Fast and simple but no team expertise, weaker data libraries

## Related
- [[programming-languages-index]]
- [[technology-selection-matrices]]
- [[golden-rules-of-data-engineering]]
