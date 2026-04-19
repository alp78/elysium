---
title: "Domain: Applied PostgreSQL Pipelines"
tags:
  - domain
  - postgresql
  - data-engineering
---

# Applied PostgreSQL Pipelines

This domain applies PostgreSQL to pipeline construction rather than to generic DBA or query-writing work. It owns ingestion patterns, incremental movement, medallion implementation, point-in-time correctness, and pipeline-specific operational guidance.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
mindmap
  ((Applied PostgreSQL Pipelines))
    (loading patterns)
    (incremental transforms)
    (pipeline anti-patterns)
    (bronze layer)
    (silver layer)
    (gold layer)
    (pipeline devex)
    (PIT integrity)
```

## Loading and Incremental Movement

> [!abstract]- [[01-postgresql-loading-patterns-and-idempotency]]

> [!abstract]- [[05-postgresql-incremental-transforms]]

> [!abstract]- [[08-postgresql-pipeline-anti-patterns]]

## Bronze, Silver, and Gold Implementation

> [!abstract]- [[02-postgresql-bronze-layer-loading]]

> [!abstract]- [[03-postgresql-silver-transforms]]

> [!abstract]- [[04-postgresql-gold-transforms]]

## Operability, Observability, and Historical Correctness

> [!abstract]- [[07-postgresql-pipeline-integration-and-devex]]

> [!abstract]- [[06-postgresql-pit-integrity-logic]]
