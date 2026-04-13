---
title: "03 - Self-Service Data Platform"
tags: [dataops]
aliases:
  - self-service data
  - data democratization
  - data products
  - data catalog
  - data platform
  - data literacy
  - data contracts
  - governed self-service
description: "Building self-service data platforms — from data catalogs and quality layers to governed access and data products, enabling non-engineers to use data without filing tickets."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Self-Service Data Platform

> [!quote]
> "The goal of a self-service data platform is not to eliminate data engineers — it is to eliminate the bottleneck where data engineers become request processors for work that capable users could do themselves."
>
> — **Zhamak Dehghani**, *Data Mesh* (2022)

> [!abstract]- Summary
>
> This note defines the self-service data platform as the governed layer that lets analysts, scientists, engineers, and business users explore trusted data without turning the data engineering team into a perpetual ticket queue, while making the freedom-versus-governance trade-off explicit instead of pretending one side can be ignored.
>
> **Self-service operating model and trust foundations**
> - Maps the self-service spectrum by persona, then explains why democratization fails when trust, literacy, governance, or discovery are weak.
> - Establishes the platform prerequisites for safe self-service: semantic consistency, documented ownership, catalog visibility, policy-driven access, and baseline data-literacy support.
>
> **Platform layers and discovery**
> - Breaks the platform into storage, transformation, discovery, quality, semantic, and consumption layers, with tool comparisons for catalogs, quality systems, semantic layers, and query interfaces.
> - Treats quality scores, catalog search, lineage, freshness, and SLA visibility as the infrastructure that makes self-service discoverable and trustworthy rather than merely accessible.
>
> **Data products, contracts, and governed access**
> - Defines data products, data contracts, governed self-service, access-request automation, cost governance, and the controls that let teams expose data widely without losing security, correctness, or budget discipline.
> - Connects these controls to literacy programs, adoption metrics, a multi-quarter implementation roadmap, and the platform role that underpins data-mesh-style domain ownership.
>
> **Operations and safety**
> - Warnings: premature democratization creates distrust, query freedom without cost controls creates runaway spend, and access without literacy or contracts creates conflicting metrics and unsafe reuse.
> - Recommendations: build trust and discoverability first, publish quality and ownership metadata with every promoted dataset, automate access and cost controls through the platform, and expand self-service in deliberate capability tiers.

> [!note]- Glossary
>
> **Self-service data platform**
> - The shared infrastructure and governance layer that allows users to discover, query, and build on trusted data without requiring direct engineering intervention for every request.
> - It matters here because the note treats self-service as a platform capability that must balance access, trust, cost, and policy rather than as a single BI tool purchase.
>
> > [!info] Enable, do not abandon
> >
> > Good self-service removes repetitive request handling while still preserving clear standards, ownership, and support boundaries.
>
> ---
>
> **Self-service spectrum**
> - The range of access models from highly constrained dashboard consumption to open-ended notebook, SQL, or natural-language exploration.
> - It matters here because the note argues that different personas need different levels of freedom, tooling, and governance rather than one universal self-service model.
>
> > [!info] One platform, different trust tiers
> >
> > Executives, analysts, scientists, and engineers can all be self-service users while requiring very different interfaces and controls.
>
> ---
>
> **Data democratization**
> - The organizational goal of making data-driven decision-making broadly accessible beyond the specialist data team.
> - It matters here because the note distinguishes real democratization from naive access expansion that ignores trust, literacy, and governance prerequisites.
>
> > [!warning] Access alone is not democratization
> >
> > Giving users raw data without context or controls often creates more confusion and distrust than keeping access narrow for longer.
>
> ---
>
> **Data catalog**
> - A discovery system that helps users find datasets, understand ownership and lineage, and assess whether a dataset is trustworthy and appropriate for use.
> - It matters here because self-service fails quickly when users cannot find the right tables or judge their freshness, purpose, and consumers.
>
> > [!info] Discovery is part of the product
> >
> > A dataset that exists but cannot be found, understood, or trusted is effectively not self-service at all.
>
> ---
>
> **Quality score**
> - A summarized signal that combines measures such as freshness, completeness, uniqueness, validity, and consistency into a visible trust indicator.
> - It matters here because the note uses quality scores as a way to expose trust state directly in the catalog rather than hiding it in engineering-only dashboards.
>
> > [!warning] Invisible quality is guessed quality
> >
> > If users cannot see a dataset’s current health, they fill the gap with assumption or anecdote instead of evidence.
>
> ---
>
> **Semantic layer**
> - A shared business-logic layer that defines metrics, dimensions, and access rules consistently across downstream tools.
> - It matters here because the note treats semantic consistency as the control point that prevents each dashboard, notebook, and report from redefining core business concepts independently.
>
> > [!warning] One metric should mean one thing
> >
> > Without a semantic layer, teams often discover metric disagreement only after conflicting reports reach leadership.
>
> ---
>
> **Data product**
> - A curated dataset that is owned, documented, discoverable, SLA-backed, and managed with explicit consumer expectations.
> - It matters here because the note positions data products as the trustable unit of self-service publication, not just arbitrary warehouse tables.
>
> > [!info] Product implies accountability
> >
> > Once a dataset is treated as a product, the owning team is accountable for usability and reliability, not just for producing rows.
>
> ---
>
> **Data contract**
> - A machine-readable agreement that defines schema, semantics, quality expectations, and delivery terms between producers and consumers.
> - It matters here because governed self-service depends on stable interfaces that can be validated automatically before breaking changes reach users.
>
> > [!warning] Keep contracts lightweight
> >
> > Contracts become shelfware if updating them requires heavy approval bureaucracy instead of versioned automation and CI checks.
>
> ---
>
> **Row-level security / RLS**
> - A policy mechanism that filters visible rows based on the querying user’s role, region, or other authorization context.
> - It matters here because the note uses warehouse-level RLS as a core technique for widening data access without exposing every record to every user.
>
> > [!info] Govern once at the platform layer
> >
> > Security rules are more reliable when they apply regardless of whether the user arrives through BI, notebooks, or direct SQL.
>
> ---
>
> **Column masking**
> - A protection technique that obscures or tokenizes sensitive fields for users who are not authorized to view full values.
> - It matters here because self-service often needs broad analytical access while still preserving privacy and regulatory controls around PII or confidential data.
>
> > [!warning] Same table, different visibility
> >
> > Effective masking lets one dataset serve multiple audiences safely instead of forcing duplicate secured and unsecured copies.
>
> ---
>
> **Query budget controls**
> - Automated limits, estimates, alerts, or quotas that prevent self-service queries from creating uncontrolled cloud-warehouse spend.
> - It matters here because the note treats cost governance as part of the platform contract, not as an afterthought once usage scales.
>
> > [!warning] Freedom can be expensive
> >
> > A single unbounded query against a large warehouse can erase weeks of careful platform cost planning if no controls exist.
>
> ---
>
> **Data literacy**
> - The skill level required for a user to interpret data, choose the right tool, and ask or answer questions without misreading the results.
> - It matters here because the note argues that self-service only succeeds when the platform investment is matched by education and usage guidance.
>
> > [!info] Train the users you enable
> >
> > The platform becomes much more valuable when example queries, glossaries, office hours, and structured learning paths are part of the rollout.
>
> ---
>
> **Ticket deflection rate**
> - A measure of how many ad hoc requests no longer need direct data-engineering intervention because users can solve them through self-service tools.
> - It matters here because the note uses ticket deflection as one of the clearest indicators that the platform is actually reducing operational bottlenecks.
>
> > [!info] Use with trust metrics
> >
> > Deflecting tickets is only a success if users are also getting correct answers quickly instead of silently working around a broken experience.

> [!example] Governed Access Fit
>
> > [!success] Appropriate
> >
> > - Use this note for platform roadmap work, self-service strategy, catalog and semantic-layer design, access-governance planning, and scaling analyst capability without linear headcount growth.
> > - Use it when the real problem is how to widen access while preserving trust, discoverability, policy control, and cost discipline.
> > - Use it to stage self-service by persona and capability instead of pretending every user needs the same tools or the same freedom.
>
> > [!failure] Inappropriate
> >
> > - Do not use self-service language as an excuse to expose raw, undocumented, or poorly governed data before the trust foundation exists.
> > - Do not widen query freedom without ownership metadata, quality signals, contracts, and cost controls.
> > - Do not assume one catalog or BI tool alone creates self-service if literacy, support boundaries, and access workflows are still weak.

## The Self-Service Spectrum

Self-service is not binary. It exists on a spectrum from highly constrained (only approved dashboards) to fully open (direct database access for all employees). Different user personas need different points on this spectrum.

```
                    SELF-SERVICE SPECTRUM
◄─────────────────────────────────────────────────────────────►
Constrained                                               Open

📊 Approved     🔍 Ad-hoc SQL    📓 Notebooks    💬 Natural
   Dashboards      in BI Tool       & Python        Language
                                                    Queries

Persona:       Persona:          Persona:         Persona:
Executive /    Business          Data Analyst /   Business
Operational    Analyst           Data Scientist   User (future)
Staff

Trust Level:   Trust Level:      Trust Level:     Trust Level:
No data        Some SQL          Full data        Platform-
literacy       literacy          literacy         managed trust

Governance:    Governance:       Governance:      Governance:
Platform       Row-level         Column masking,  Query budget
pre-curates    security          audit logging    limits
```

### Capability by User Persona

| User Type | What They Need | What They Should NOT Need | Primary Tools |
|-----------|---------------|--------------------------|---------------|
| **Executive** | Trusted KPIs, one version of truth | Any data engineering involvement | BI dashboards, embedded analytics |
| **Business Analyst** | Ad-hoc SQL on curated tables, drag-and-drop exploration | Knowing where the raw data lives | Looker, Mode, Hex, Metabase |
| **Data Analyst** | Direct SQL, notebook access, ability to build new metrics | Waiting weeks for new datasets | Jupyter, BigQuery console, Hex |
| **Data Scientist** | Raw table access, feature stores, ML compute | Data wrangling before every analysis | Jupyter, Vertex AI, Databricks |
| **Software Engineer** | Data APIs, real-time query endpoints | Understanding the analytics data model | REST/GraphQL APIs, streaming |
| **Business User (emerging)** | Natural language questions answered correctly | Any technical interface | AI-powered BI assistants |

---

## Data Democratization

Data democratization is the organizational philosophy that sits beneath the technology. The core claim: **data-driven decisions should be accessible to everyone in the organization**, not just data professionals.

### Why Democratization Fails

Most democratization initiatives fail not because of technology, but because of:

**1. Trust deficit.** Users don't trust the data. If two reports show different numbers for the same metric, users stop trusting both and stop using either. Self-service without a single source of truth is worse than no self-service.

**2. Literacy gap.** Users have access to the data but don't know how to interpret it correctly. Access without education leads to confident wrong conclusions.

**3. Governance vacuum.** Full access without guardrails leads to PII exposure, runaway query costs, and shadow analytics (everyone has their own version of the truth).

**4. Discovery problem.** Data exists but users can't find it. Without a data catalog, self-service is only theoretical.

### Democratization Prerequisites

Before investing in self-service tooling, ensure:

- [ ] A semantic/metrics layer exists — one definition of "revenue," "user," "conversion"
- [ ] Core datasets have owner, description, SLA, and quality status documented
- [ ] Access control is policy-driven, not ad-hoc
- [ ] A data catalog allows users to find what exists
- [ ] At least basic data literacy training exists for analysts

> [!warning] Premature Democratization Creates Distrust
> Giving users access to raw, undocumented, inconsistent data does more harm than good. They will produce analyses with wrong numbers, present them to leadership, get caught, and blame the data team. Self-service must be built on a trusted foundation.

> [!success] Fix: Gate Self-Service Access Behind a Quality Prerequisite
> Before opening any dataset to self-service access, require it to pass the democratization prerequisites checklist above: semantic layer defined, owner documented, quality status visible in the catalog, and at least basic data literacy training available. Only promote datasets to the "self-service" tier in the catalog once these gates are cleared.

---

### Platform Component Architecture

A complete self-service data platform has six layers. Each layer can be assembled from multiple tools; the choices below are a starting point, not a prescription.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONSUMPTION LAYER                                │
│     BI Tools │ Notebooks │ SQL Editors │ NL Query │ Data APIs           │
├─────────────────────────────────────────────────────────────────────────┤
│                         SEMANTIC LAYER                                  │
│         Metrics definitions │ Business logic │ Access policies          │
├─────────────────────────────────────────────────────────────────────────┤
│                      DATA QUALITY LAYER                                 │
│      Tests │ Monitoring │ SPC anomaly detection │ Quality scores        │
├─────────────────────────────────────────────────────────────────────────┤
│                       DISCOVERY LAYER                                   │
│      Data catalog │ Lineage │ Documentation │ Search │ Ownership        │
├─────────────────────────────────────────────────────────────────────────┤
│                      TRANSFORMATION LAYER                               │
│         Raw → Staging → Intermediate → Marts (dbt or equivalent)       │
├─────────────────────────────────────────────────────────────────────────┤
│                       STORAGE LAYER                                     │
│     Cloud Data Warehouse │ Object Storage │ Feature Store │ Cache       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Catalog Tools

A data catalog is the discovery layer that makes self-service possible. Without it, users don't know what data exists, where to find it, who owns it, or whether it can be trusted.

### What a Data Catalog Must Provide

- **Search:** Find tables, columns, and datasets by keyword or business term
- **Metadata:** Description, owner, data type, row count, last updated
- **Lineage:** Where does this data come from? What does it feed downstream? Tools like [gcp-data-lineage-and-catalog](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-data-lineage-and-catalog) provide automated cross-system lineage on GCP.
- **Quality status:** Is this dataset passing its quality checks?
- **SLA and freshness:** When should this data be updated? Is it currently fresh?
- **Access request:** How do I get access if I don't have it?

### Catalog Tool Comparison

| Tool | Model | Strengths | Weaknesses | Best For |
|------|-------|-----------|-----------|---------|
| **Google Dataplex** | Managed cloud-native | Deep GCP integration, automated metadata, policy enforcement, data quality built-in | GCP-only, less social metadata | Google Cloud shops |
| **DataHub (LinkedIn, OSS)** | Open-source | Rich lineage, active community, flexible ingestion, free | Operational overhead to self-host, UI less polished | Engineering-driven teams comfortable with OSS |
| **Amundsen (Lyft, OSS)** | Open-source | Good search experience, widely adopted | Less active development, limited lineage | Teams wanting search-first discovery |
| **Alation** | Commercial SaaS | Enterprise features, data stewardship workflows, behavioral analytics on query patterns | Expensive, SaaS lock-in | Large enterprises with compliance needs |
| **Collibra** | Commercial SaaS | Strongest governance and policy workflows, enterprise compliance | Very expensive, implementation-heavy | Regulated industries (finance, healthcare) |
| **Select Star** | Commercial SaaS | Automated documentation from query history, easy setup | Less configurable | Smaller teams wanting quick time-to-value |

> [!tip] Start with dbt Docs If You Use dbt
> If your transformation layer is dbt, `dbt docs generate` gives you a free, code-generated catalog with lineage, descriptions, and test status. It won't have everything a full catalog provides, but it is infinitely better than nothing and zero additional tooling cost. See [dbt-documentation-and-lineage](https://alp78.github.io/elysium/11-dbt/Operations/dbt-documentation-and-lineage) for how to maximize the value of dbt's built-in catalog features.

---

## Data Quality Layer

Data quality is the foundation of trust. Without it, self-service is dangerous — users draw conclusions from data they believe is correct but isn't.

### Quality Dimensions

| Dimension | Question | Example Test |
|-----------|----------|-------------|
| **Completeness** | Are all expected records present? | Row count within expected range |
| **Accuracy** | Does the value reflect reality? | Revenue sum matches finance system |
| **Freshness** | Is the data recent enough? | Last updated within SLA window |
| **Uniqueness** | Are primary keys actually unique? | No duplicate order IDs |
| **Validity** | Are values within expected domain? | Status is one of: active, inactive, pending |
| **Consistency** | Is the same fact consistent across datasets? | User count in events matches user count in CRM |
| **Referential integrity** | Do foreign keys resolve? | All order.customer_id values exist in customers table |

### Quality Tool Comparison

| Tool | Approach | Strengths | Weaknesses | Best For |
|------|----------|-----------|------------|---------|
| **dbt tests** | YAML-configured tests run at transformation time | Native to dbt, low friction, versioned in Git | Limited to transformation time; no custom Python | dbt shops |
| **Great Expectations** | Python-based expectation suites | Very flexible, runs anywhere (ingestion to serving), rich HTML reports | More complex to set up and maintain | Teams needing complex validation logic |
| **Soda Core / Soda Cloud** | SQL-native checks with SodaCL DSL | Easy DSL, cloud UI for monitoring, Slack/PD integration | Cost of cloud tier, less flexible than GX | Teams wanting out-of-box monitoring UI |
| **Monte Carlo** | ML-based anomaly detection | Automatic baselines, no rule authoring needed, fast time-to-value | Black-box ML, commercial SaaS cost | Teams wanting observability without manual rule-writing |
| **Bigeye** | Column-level monitoring | Fine-grained column monitoring, good alerting | Commercial, less integrated with dbt | Data warehouse-centric teams |

### Quality Score Framework

Expose a quality score to users in the data catalog so they can make informed decisions about trust:

```
Quality Score = weighted average of:
  - Freshness (30%): Is data within SLA?
  - Completeness (25%): Row count within expected range?
  - Uniqueness (20%): Primary key violations?
  - Validity (15%): Values within expected domains?
  - Consistency (10%): Cross-dataset reconciliation?

Score 90-100: Green — fully trusted
Score 70-89:  Yellow — use with caution; known issues
Score < 70:   Red — do not use for decisions; incident open
```

> [!info] Expose Quality Scores in the Catalog
> Quality scores are only useful if users can see them. Integrate your quality tool with your data catalog so that every dataset shows its current quality status alongside its description and owner. This is the fastest way to build user trust.

---

## Semantic Layer

The semantic layer (also called the metrics layer or headless BI) sits between the physical data warehouse and the consumption tools. It defines business metrics, dimensions, and access policies in one place — and serves them consistently to any downstream tool.

### Why the Semantic Layer Matters

Without a semantic layer:

- "Revenue" means something different in Looker, in the Python notebook, and in the finance team's SQL query
- Business logic is duplicated across dozens of dashboards and reports
- Changing a metric definition requires touching every report that uses it
- Access policies are applied inconsistently across tools

With a semantic layer:

- One definition of "revenue" is served to all consumers consistently
- Metric changes propagate automatically to all downstream reports
- Access policies are enforced at the semantic layer, not per-tool

### Semantic Layer Tool Comparison

| Tool | Model | Strengths | Weaknesses | Best For |
|------|-------|-----------|-----------|---------|
| **Looker (LookML)** | Commercial SaaS, code-defined | Mature, powerful access control, explore UI | Expensive, LookML learning curve, closed ecosystem | Large enterprises with BI-first self-service |
| **dbt Semantic Layer** | OSS + dbt Cloud | Native to dbt workflow, Git-versioned metrics, growing ecosystem | Newer, ecosystem still maturing | dbt-centric teams |
| **Cube.dev** | OSS + commercial | Multi-tool support (connects to BI + APIs), REST/GraphQL APIs, caching | More complex to operate | Teams serving multiple consumption tools including APIs |
| **MetricFlow** | OSS (dbt acquisition) | Open spec, Git-native, flexible join paths | Still evolving | Teams wanting open-source semantic layer |
| **AtScale** | Commercial | Universal semantic layer across multiple warehouses | Expensive | Multi-cloud enterprises |

### Core Semantic Layer Concepts

**Metrics:** Named, versioned calculations with clear business definitions.

```yaml
# Example metric definition (MetricFlow / dbt Semantic Layer style)
metric:
  name: monthly_recurring_revenue
  label: Monthly Recurring Revenue (MRR)
  description: Sum of recognized monthly contract value for active subscriptions
  type: simple
  type_params:
    measure: contract_monthly_value
  filter: |
    {{ Dimension('subscription__status') }} = 'active'
```

**Dimensions:** Attributes that metrics can be sliced by (date, region, product, customer segment).

**Grain:** The level of granularity at which a metric is defined (per user per day, per transaction, per subscription).

---

### Query and Exploration Tools

| Tool | Type | Strengths | Best For |
|------|------|-----------|---------|
| **BigQuery Console** | Cloud warehouse UI | Direct SQL, serverless, fast | Analysts comfortable with SQL |
| **Jupyter Notebooks** | Python notebook | Full Python ecosystem, ML-ready | Data scientists, complex analysis |
| **Hex** | Collaborative notebook | SQL + Python + BI in one, shareable | Analyst-scientist collaboration |
| **Mode** | SQL + BI hybrid | SQL-first, charting, report sharing | SQL-proficient analysts |
| **Metabase** | Open-source BI | Easy self-serve, embedded analytics, free tier | SMBs, cost-sensitive teams |
| **Streamlit** | Python app framework | Build internal data apps quickly | Engineers building internal tools |
| **Redash** | Open-source BI | Simple SQL-based dashboards | Basic self-service on a budget |

---

## Data Products

A **data product** is a curated, trustworthy, documented, and SLA-backed dataset made available to consumers — treated with the same product rigor as a software product or API.

The term comes from the data mesh paradigm but applies even outside a full mesh architecture. Any team can adopt the data product mindset without restructuring the entire organization.

### What Makes a Dataset a Data Product

A raw table in the warehouse is not a data product. A data product has:

| Property | Description | Example |
|----------|-------------|---------|
| **Owner** | A named person or team accountable for quality and SLAs | "@analytics-team owns this dataset" |
| **Documentation** | Clear description, column definitions, business context | "This table contains one row per daily active user session" |
| **Quality SLA** | Committed quality level and what happens when violated | "99.5% freshness SLA; alert fires if data is > 2 hours late" |
| **Freshness SLA** | How current the data will be | "Updated by 07:00 UTC daily" |
| **Versioning** | Breaking changes are versioned; consumers are notified | v1, v2 with migration guide |
| **Discoverability** | Registered in the data catalog, searchable | Found in the catalog under "User Behavior" |
| **Access path** | Clear process to request access | Self-service request in catalog, auto-approved for analysts |
| **Consumer visibility** | Producer knows who consumes the data | Catalog shows downstream consumers and their tools |

### Data Product SLA Template

```yaml
data_product:
  name: user_sessions_daily
  owner: analytics-engineering
  description: Daily aggregated user session metrics per user per day

  sla:
    freshness_target: "07:00 UTC daily"
    freshness_tolerance: "2 hours"
    quality_target: 99.5%
    availability_target: 99.9%

  quality_checks:
    - not_null: [user_id, session_date, session_count]
    - unique: [user_id, session_date]
    - freshness: max_age_hours: 26
    - row_count_range: [min: 100000, max: 10000000]

  versioning:
    current_version: v2
    breaking_change_policy: "90-day deprecation notice, migration guide provided"

  consumers:
    - team: marketing-analytics
      tool: Looker
      use_case: Daily active user reporting
    - team: product
      tool: Jupyter
      use_case: Retention cohort analysis
```

> [!info] Data Products Align Incentives
> When a team owns a data product (not just a pipeline), they are accountable for consumer outcomes, not just pipeline execution. This shifts the incentive from "pipeline ran successfully" to "consumers got trustworthy data on time."

---

## Data Contracts

A data contract is a formal, machine-readable agreement between a data producer and its consumers specifying the schema, semantics, quality, SLA, and access expectations for a dataset.

### Why Data Contracts Matter

Without contracts, schema changes break downstream consumers silently. With contracts, breaking changes are detected before deployment, consumers are notified proactively, and both sides have clear expectations.

### Data Contract Structure

```yaml
# Data Contract Example (following open-standards format)
dataContractSpecification: 0.9.0
id: user-sessions-daily-v2
info:
  title: User Sessions Daily
  version: 2.0.0
  status: active
  owner: analytics-engineering
  contact: data-contracts@company.com

servers:
  production:
    type: BigQuery
    project: data-warehouse-prod
    dataset: analytics
    table: user_sessions_daily

schema:
  type: dbt
  specification:
    models:
      - name: user_sessions_daily
        columns:
          - name: user_id
            type: STRING
            description: Unique identifier for the user
            constraints: [not_null, unique_with: session_date]
          - name: session_date
            type: DATE
            description: UTC date of the session
            constraints: [not_null]
          - name: session_count
            type: INTEGER
            description: Number of sessions on this date
            constraints: [not_null, minimum: 0]

quality:
  type: SodaCL
  specification: |
    checks for user_sessions_daily:
      - freshness(session_date) < 26h
      - row_count > 100000
      - duplicate_count(user_id, session_date) = 0

sla:
  availability: 99.9%
  freshness: data available by 07:00 UTC daily
  quality: 99.5% checks passing

terms:
  usage: Internal analytics only
  limitations: Contains anonymized data only; no PII
  billing: Charged to consuming team's data budget
```

### Data Contract Enforcement

[Data contracts](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-contracts) should be:

- **Versioned in Git** alongside the transformation code
- **Validated in CI** — a PR that breaks a contract schema fails CI
- **Checked at runtime** — the pipeline validates the contract before serving data
- **Communicated to consumers** — breaking changes trigger automated notifications

> [!warning] Don't Let Contracts Become Bureaucracy
> Data contracts are valuable when they are lightweight and machine-enforceable. Contracts that require a committee, a PDF, and three signature approvals to update will be ignored. Start simple: schema + SLA + owner. Automate enforcement.

> [!success] Fix: Start with a Minimal YAML Contract in Git
> Define each contract as a YAML file in the repository with three mandatory fields only: `owner`, `schema` (column names and types), and `sla.freshness_target`. Add CI validation that checks contract syntax on every PR. Expand the contract schema incrementally as teams prove they use the existing fields.

---

## Governed Self-Service

Governed self-service resolves the tension between openness and control by applying governance automatically through the platform — not through human approval processes.

### Governance Mechanisms

**Row-level security (RLS):** Users only see rows they are authorized to see. Implemented at the warehouse level (BigQuery row-level security, Snowflake row access policies) so it applies regardless of which tool the user queries from.

```sql
-- Example: User can only see their own region's data
CREATE ROW ACCESS POLICY region_access
  GRANT TO ("roles/analyst")
  FILTER USING (region = SESSION_USER_REGION());
```

**Column-level masking:** PII and sensitive columns are masked or tokenized for users without explicit access. Full values are only visible to authorized roles.

**Dynamic data masking:** Analysts see `XXXX-XXXX-XXXX-1234` for credit card numbers; finance can see full numbers. Same dataset, different views based on role.

**Query budget controls:** Automatically cancel or warn on queries exceeding cost thresholds. Prevents a single errant query from burning thousands of dollars.

**Audit logging:** Every query is logged with user, timestamp, tables accessed, and data volume scanned. Enables compliance review and access pattern analysis.

### Access Request Automation

Manual access requests (email to data team → data team manually grants → 3 days later) are a bottleneck. Automate:

1. User searches catalog and finds dataset they need
2. User clicks "Request Access" in catalog
3. Platform evaluates: does user's team have a standing approval policy for this data classification?
   - Yes → Access granted automatically, audit log entry created
   - No → Approval request sent to data owner, auto-approved or denied within 24 hours
4. Access is time-limited (e.g., 90 days), then auto-expires and requires re-request

---

## Cost Governance

Self-service without cost governance leads to runaway query costs. Cloud data warehouses charge by compute or by data scanned — a single poorly written query can cost hundreds of dollars.

### Cost Control Mechanisms

| Mechanism | Description | Tool |
|-----------|-------------|------|
| **Query cost estimation** | Show estimated cost before executing query | BigQuery dry run, Snowflake cost estimator |
| **User-level spending limits** | Cap per-user query spend per day/month | BigQuery custom quotas, Snowflake resource monitors |
| **Team billing attribution** | Tag queries to teams for chargeback | BigQuery labels, Snowflake query tags |
| **Expensive query alerts** | Alert when a query exceeds cost threshold | Cloud monitoring, Billing export to BigQuery |
| **Table partitioning enforcement** | Require partition filters on large tables | BigQuery `require_partition_filter` |
| **Query result caching** | Cache frequent query results to avoid re-scanning | BigQuery BI Engine, Looker caching, cube.dev |
| **Auto-suspend idle compute** | Suspend warehouse when idle | Snowflake auto-suspend |

### Cost Visibility Dashboard

Every self-service platform needs a cost visibility dashboard showing:

- Total spend by team per week/month
- Top 10 most expensive queries and their owners
- Cost per query type (exploration vs. scheduled reports)
- Month-over-month trend and forecast
- Tables with highest scan cost (candidates for optimization)

> [!tip] Make Cost Visible Before Making It Painful
> Start by showing teams their costs (visibility). Only add hard limits after teams have had time to understand and optimize. Hard limits applied before visibility leads to frustrated engineers hitting unexpected blocks.

---

## Data Literacy and Training

Self-service only succeeds if users have the skills to use it well. A platform investment without a literacy investment is wasted.

### Data Literacy Levels

| Level | Description | Who Is Here | What They Need |
|-------|-------------|-------------|----------------|
| 0 | **No data skills** | Most business users | Basic data concepts, trusting dashboards, when to escalate |
| 1 | **Dashboard consumer** | Operational managers | How to interpret charts, when to trust vs. question data |
| 2 | **SQL user** | Business analysts | SQL fundamentals, data warehouse concepts, avoiding pitfalls |
| 3 | **Data practitioner** | Power analysts, analytics engineers | Advanced SQL, data modeling, testing, Python basics |
| 4 | **Data engineer** | Data engineers | Full technical stack, pipeline design, infrastructure |

### Training Programs

#### Self-paced resources

- Internal data wiki: How our data platform works, what tables exist, how to get access
- SQL learning path: Recommended external resources (Mode SQL Tutorial, Codecademy) + internal practice datasets
- Recorded walkthroughs: 15–30 minute videos of "How to analyze X" using the platform

#### Live programs

- Monthly "Data Office Hours" — any employee can ask questions of the data team
- Quarterly SQL workshop for analysts new to SQL
- Onboarding buddy: New analysts are paired with an analytics engineer for 2 weeks

#### Documentation standards

- Every data product in the catalog has a "How to use this dataset" section with example queries
- Common analysis patterns are documented as templates in Hex / Jupyter
- Glossary of business terms with their metric definitions

---

## Success Metrics for Self-Service

Track these to know if your self-service investment is working:

### Adoption Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Self-service query rate** | % of analytical queries run by non-engineers | > 60% at maturity |
| **Active catalog users** | % of analysts visiting catalog weekly | > 70% |
| **Ticket deflection rate** | Reduction in ad-hoc data requests to DE team | 50%+ reduction in 12 months |
| **Time to first query** | How long for a new analyst to run their first self-service query | < 1 day |
| **Dataset utilization** | % of published datasets queried at least once per month | > 80% |

### Quality and Trust Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Data trust score** | User-reported trust in data (survey) | NPS > 40 |
| **"One version of truth" incidents** | Incidents caused by metric disagreement across reports | Decreasing trend |
| **Documentation coverage** | % of datasets with complete description + owner | > 90% |
| **Quality SLA adherence** | % of data products meeting their quality SLA | > 95% |

### Efficiency Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **DE time on ad-hoc requests** | % of DE time spent on reactive requests | < 20% |
| **Access request cycle time** | Time from access request to access granted | < 24 hours |
| **Query cost per analyst** | Average monthly compute cost per analyst | Stable or decreasing despite growing usage |

---

### Connection to Data Mesh

The self-service data platform is the enabling technology for a [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture). Data mesh cannot function without:

- A self-service platform that allows domain teams to publish data products without central engineering
- A data catalog where products are discoverable across domains
- Data contracts that enforce interoperability between domains
- Cost governance that assigns costs to the right domain teams
- Quality standards that all domain products must meet

In a data mesh, the **platform team** (not the domain teams) owns and operates the self-service platform. Domain teams are the customers of the platform. The platform team's job is to make it so easy to publish a high-quality data product that domain teams choose to do it over building their own shadow infrastructure.

> [!info] Self-Service Is Not Just Data Mesh
> You do not need to adopt data mesh to benefit from self-service infrastructure. A centralized data team can and should build self-service capabilities to scale its impact. Self-service reduces the bottleneck regardless of your team topology.

---

## Implementation Roadmap

Building a self-service platform is a multi-quarter investment. A pragmatic sequence:

### Quarter 1: Foundation

- [ ] Implement semantic layer (dbt metrics or Looker LookML)
- [ ] Stand up a data catalog (dbt docs as a starting point)
- [ ] Define quality standards and add tests to top 10 most-used datasets
- [ ] Document the top 20 tables that analysts use most
- [ ] Create a data glossary with 30–50 key business terms

### Quarter 2: Discovery and Trust

- [ ] Deploy a full data catalog with search and lineage
- [ ] Expose quality scores in catalog
- [ ] Automate access request workflow
- [ ] Publish first formal data products with SLAs
- [ ] Run first SQL workshop for business analysts

### Quarter 3: Self-Service Enablement

- [ ] Deploy query tool accessible to analysts (Hex, Mode, or BigQuery console)
- [ ] Implement row-level security and column masking for PII
- [ ] Stand up cost visibility dashboard
- [ ] Create self-paced training library
- [ ] Launch data office hours program

### Quarter 4: Maturity and Scale

- [ ] Implement data contracts for most-consumed datasets
- [ ] Add ML-based anomaly detection layer
- [ ] User-level query budget controls
- [ ] Measure and publish self-service adoption metrics
- [ ] Retrospective and roadmap for next year

---

## Related Concepts

- [dataops-principles-and-practices](https://alp78.github.io/elysium/15-DataOps/dataops-principles-and-practices) — the DataOps practices that the self-service platform operationalizes
- [data-team-organization](https://alp78.github.io/elysium/15-DataOps/data-team-organization) — how team structure must evolve to support self-service
- [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — the federated organizational pattern that self-service platforms enable
- [dbt-transformation-layer](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) — the transformation and semantic layer that sits at the heart of the platform
- [data quality](https://alp78.github.io/elysium/15-DataOps/dataops-principles-and-practices) — detailed breakdown of quality tools and testing strategies
- [orchestration selection](https://alp78.github.io/elysium/14-Data-Architecture/Decision-Frameworks/technology-selection-matrices) — orchestration layer that keeps data products fresh
