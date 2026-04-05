---
title: "Data Team Organization"
tags: [dataops]
aliases:
  - data team
  - team topology
  - data engineering career
  - RACI matrix
  - career ladder
  - team structure
description: "How to build, organize, and scale data engineering teams — team topologies, role definitions, career ladders, RACI matrices, and collaboration models."
parent: "[[domain-people-and-organization]]"
links:
  - "[[leadership-and-collaboration]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Data Team Organization

> [!quote]
> "A fast flow of change requires that teams are loosely coupled — each team should be able to deliver value without waiting on other teams."
>
> — **Matthew Skelton & Manuel Pais**, *Team Topologies* (2019)

How you organize your data team shapes everything: what gets built, how fast it ships, how reliable it is, and whether engineers stay or leave. There is no universally correct topology — but there are clear trade-offs, and the best teams are intentional about the model they choose.

> [!info] This Is a Living Decision
> Team topology is not a one-time architectural decision. It should evolve as the organization grows, as data maturity increases, and as the relationship between data teams and business teams changes. Revisit your model annually.

---

## Team Topology Models

Four primary models describe how data engineering capability is distributed across an organization. Each sits on a spectrum between **centralization** (one team serves all) and **distribution** (every business unit owns its own).

### Model 1: Centralized Data Team

All data engineers, analysts, and scientists sit in a single team — usually called the Data Engineering or Data Platform team — that serves the entire organization.

```
┌─────────────────────────────────────────────┐
│              Central Data Team              │
│  DE  DE  DE  AE  AE  DA  DA  DS  DS  Arch  │
└──────────────────┬──────────────────────────┘
                   │ serves
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
  Marketing    Engineering    Finance
  (consumer)   (consumer)    (consumer)
```

**Best for:** Early-stage organizations (< 50 analysts), companies where data is primarily analytical (not operational), situations where data standardization is critical.

### Model 2: Embedded Model

Data engineers and analysts are embedded within product or business teams. There is no central data team, or only a small platform team providing infrastructure.

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Marketing    │  │  Engineering  │  │   Finance     │
│  Team         │  │  Team         │  │   Team        │
│  DE  DA       │  │  DE  DA       │  │  DE  DA       │
└───────────────┘  └───────────────┘  └───────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              ┌─────────────────────┐
              │  Platform Team      │
              │  (infra only, tiny) │
              └─────────────────────┘
```

**Best for:** Organizations where data drives product decisions (not just reporting), fast-moving product teams that can't wait for a central queue, companies with strong domain ownership culture.

### Model 3: Hub-and-Spoke

A central "hub" team owns shared infrastructure and standards. Domain-embedded "spoke" engineers own domain-specific pipelines and work closely with their business teams — but they report to and align with the hub.

```
                  ┌─────────────────┐
                  │   Hub Team      │
                  │  Platform  Arch │
                  │  Standards CoE  │
                  └────────┬────────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │Marketing │    │Eng Spoke │    │ Finance  │
     │  Spoke   │    │  DE  DA  │    │  Spoke   │
     │  DE  DA  │    └──────────┘    │  DE  DA  │
     └──────────┘                   └──────────┘
```

**Best for:** Mid-to-large organizations that need both speed (spoke autonomy) and consistency (hub standards), companies going through DataOps maturity improvement.

### Model 4: Federated / Data Mesh

Fully autonomous domain teams own their entire data lifecycle — ingestion, transformation, quality, and serving — as "data products." A thin platform team provides enabling infrastructure, not services. Governance is federated through computational policies.

```
┌──────────────────────────────────────────────────────────┐
│                  Data Platform Team                       │
│    (self-service tooling, storage, compute, policies)    │
└──────────────────────────────────────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Domain A     │  │  Domain B     │  │  Domain C     │
│  (owns data   │  │  (owns data   │  │  (owns data   │
│   as product) │  │   as product) │  │   as product) │
│  DE DA DS PM  │  │  DE DA DS PM  │  │  DE DA DS PM  │
└───────────────┘  └───────────────┘  └───────────────┘
```

**Best for:** Large organizations (1000+ employees) with strong domain boundaries, companies with multiple business units that have genuinely different data needs, mature data cultures.

See [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) for a deep dive on federated teams.

### Topology Comparison Table

| Dimension | Centralized | Embedded | Hub-and-Spoke | Federated |
|-----------|------------|---------|---------------|-----------|
| **Speed to deliver** | Slow (queue) | Fast | Medium-Fast | Fast |
| **Consistency / standards** | High | Low | High | Medium (policy-enforced) |
| **Domain expertise** | Low | High | Medium | High |
| **Operational overhead** | Low | High | Medium | High |
| **Coordination cost** | Low | High | Medium | Very High |
| **Data duplication risk** | Low | High | Medium | Medium |
| **Autonomy for domains** | Low | High | Medium | Very High |
| **Hiring complexity** | Simple | Complex | Medium | Complex |
| **Best org size** | Small–Medium | Medium | Medium–Large | Large |
| **DataOps maturity needed** | Low | Medium | Medium | High |

> [!tip] Start Centralized, Evolve to Hub-and-Spoke
> Most organizations should start centralized and evolve to hub-and-spoke as domain teams prove they can own data quality. Jumping directly to federated without the platform maturity to support it is a common failure mode.

---

## Role Definitions

Data teams are not monolithic. Multiple distinct roles exist, and conflating them leads to wrong expectations, poor hiring, and frustrated engineers.

### Core Roles

**Data Engineer (DE)**
Builds and maintains data pipelines, infrastructure, and the systems that move and transform data at scale. Primary focus: reliability, scalability, and correctness of data movement.

- Typical skills: Python/Scala, SQL, distributed systems, orchestration, cloud data warehouses
- Outputs: Pipelines, DAGs, ingestion connectors, infrastructure
- Does not own: business logic, reporting, ML model training

**Analytics Engineer (AE)**
Owns the transformation layer between raw data and analytical consumption. Applies software engineering discipline to SQL-based transformations. The "translator" between data engineers and analysts.

- Typical skills: Advanced SQL, dbt, data modeling, dimensional modeling, Kimball/Data Vault
- Outputs: Semantic models, metrics definitions, clean curated datasets
- Does not own: infrastructure, ML, raw ingestion

**Data Analyst (DA)**
Answers business questions using data. Builds reports and dashboards. Collaborates closely with stakeholders to define questions and interpret answers.

- Typical skills: SQL, BI tools (Looker, Tableau, Power BI), statistics, communication
- Outputs: Dashboards, ad-hoc analyses, insights, requirements for new data
- Does not own: pipeline reliability, model building

**Data Scientist (DS)**
Applies statistical and machine learning methods to solve business problems. Works with analysts on problem framing and with engineers on model deployment.

- Typical skills: Python, statistics, machine learning, experimentation, feature engineering
- Outputs: Models, experiments, predictions, recommendations
- Does not own: production pipelines, BI dashboards

**Data Architect**
Designs the overall data platform architecture: storage patterns, integration patterns, governance frameworks, technology choices. Sets the standards that others implement.

- Typical skills: System design, deep knowledge of multiple data technologies, vendor evaluation, cost modeling
- Outputs: Architecture documents, standards, reference implementations
- Does not own: day-to-day pipeline operations

**Data Platform Engineer**
Builds and maintains the internal developer platform that data engineers use: orchestration, CI/CD, observability tooling, self-service infrastructure. The "platform team" in hub-and-spoke.

- Typical skills: DevOps, Kubernetes, cloud infrastructure, Python, open-source data tooling
- Outputs: Developer platform, CI/CD pipelines, observability dashboards, self-service tooling
- Does not own: domain-specific pipelines or business logic

**Data Product Manager (DPM)**
Owns the roadmap and strategy for data products and the data platform. Prioritizes work, manages stakeholder relationships, and ensures data investments deliver business value.

- Typical skills: Product management, data literacy, stakeholder management, prioritization
- Outputs: Roadmaps, product specs, OKRs, stakeholder communication
- Does not own: technical implementation

### Role Comparison Table

| Dimension | Data Engineer | Analytics Engineer | Data Analyst | Data Scientist | Platform Engineer |
|-----------|--------------|-------------------|-------------|----------------|------------------|
| **Primary language** | Python / Scala | SQL | SQL | Python / R | Python / Go |
| **Primary tool** | Airflow / Spark | dbt | Looker / Tableau | Jupyter / MLflow | Terraform / K8s |
| **Focus** | Infrastructure | Modeling | Insights | Prediction | Developer platform |
| **Key output** | Pipelines | Semantic models | Dashboards | ML models | Platform tooling |
| **Closest analogy** | Backend engineer | Full-stack (data) | Business analyst | Research engineer | DevOps / SRE |
| **Typical demand** | High | Very high | Very high | High | Medium |
| **Avg. seniority at hire** | Mid | Mid-Senior | Junior-Mid | Mid-Senior | Senior |

> [!info] Analytics engineer role
>
> The analytics engineer role (coined by dbt Labs around 2019) fills the gap between raw data engineering and business analytics. In organizations without this role, analytics engineers either don't exist (causing poor model quality) or data engineers do their job (causing context switching and slow delivery).

---

### The T-Shaped Engineer

The T-shaped model describes an engineer with:
- **Broad knowledge** across the data engineering landscape (the horizontal bar of the T)
- **Deep expertise** in one or two specific areas (the vertical bar of the T)

```
Broad: SQL  Python  Cloud  Orchestration  BI  ML  Governance  Streaming
         ─────────────────────────────────────────────────────────────
                              │ Deep: dbt + data modeling │
                              │                           │
                              │                           │
```

For data engineers, common "vertical bars" (deep specializations):
- Streaming and real-time pipelines (Kafka, Flink)
- Data modeling and dimensional design
- Data platform and infrastructure
- ML infrastructure and feature stores
- Data governance and catalog management
- Performance optimization (query tuning, partitioning)

> [!tip] Hire for T-Shape, Train for Breadth
> When hiring, prioritize depth in at least one area and genuine curiosity about others. An engineer who is shallow in everything is hard to rely on. An engineer who is deep in one area and curious about others will grow quickly.

---

## Career Progression

Data engineering careers follow a progression from individual contributor execution to increasing scope, influence, and leverage.

### Individual Contributor (IC) Track

| Level | Title | Scope | Autonomy | Key Behaviors |
|-------|-------|-------|----------|---------------|
| 1 | **Junior Data Engineer** | Single pipeline or task | Works under guidance | Learns quickly, delivers assigned work, asks good questions |
| 2 | **Data Engineer** | Multiple pipelines, one domain | Works independently | Owns work end-to-end, participates in design, mentors interns |
| 3 | **Senior Data Engineer** | Domain or system | Leads small projects | Sets technical direction for domain, unblocks others, improves team process |
| 4 | **Staff Data Engineer** | Cross-domain or platform | Leads multi-team efforts | Defines standards, solves org-wide problems, drives architectural decisions |
| 5 | **Principal Data Engineer** | Organization-wide | Sets direction | Defines long-term technical strategy, external thought leadership, evaluates new technologies |

### Management Track

| Level | Title | Typical Team Size | Key Responsibilities |
|-------|-------|------------------|----------------------|
| M1 | **Engineering Manager** | 4–8 engineers | Delivery, people development, process, hiring |
| M2 | **Senior Engineering Manager** | 2–3 teams | Cross-team coordination, org design, strategic planning |
| M3 | **Director of Data Engineering** | Full data function | Organizational strategy, executive partnership, budget |
| M4 | **VP / Head of Data** | Multi-functional (DE + DS + DA) | Company-level data strategy, executive leadership |

> [!info] IC vs. Management Is Not a Promotion
> Moving to management is a career change, not a promotion. Many organizations have parallel IC and management tracks at equal seniority and compensation. A Principal Engineer and an Engineering Manager at the same level should have equal impact — in different directions.

### What Changes at Each Level

| What | Junior | Senior | Staff | Principal |
|------|--------|--------|-------|-----------|
| **Time horizon** | Days to weeks | Weeks to months | Quarters | Years |
| **Failure domain** | Own task | Own team delivery | Cross-team system | Organization |
| **Communication** | Receive direction | Give direction within team | Align multiple teams | Set organizational direction |
| **Technical breadth needed** | Narrow (one domain) | Medium (one system) | Wide (multiple systems) | Full stack |
| **Meeting load** | Low | Medium | High | Very High |
| **Code contribution** | Primary activity | Primary + review | Secondary (reviews, spikes) | Tertiary (influence > code) |

---

## Collaboration Models

### Data Team ↔ Business Team Collaboration

The relationship between data teams and their stakeholders defines delivery speed and alignment. Three models exist:

#### Order-taking model (anti-pattern)
Business teams file tickets. Data team processes them in order received. No prioritization, no context, no partnership. Result: slow delivery, wrong priorities, frustrated stakeholders.

#### Embedded partnership model
Data engineers and analysts attend business team standups, participate in business planning, and have direct relationships with decision-makers. Work is pulled from a shared prioritized backlog.

#### Shared OKR model
Data team and business team share outcome-based OKRs. Both teams are accountable for business results, not just data delivery. This is the highest-maturity collaboration model.

> [!tip] Move Toward Shared OKRs
> The shift from "data team delivers dashboards" to "data team and marketing team jointly own the activation rate metric" fundamentally changes how work gets prioritized and how impact gets measured.

### Internal Data Team Collaboration

**Daily standups:** 15 minutes. What did I do yesterday? What am I doing today? What's blocking me? No deep discussions — take them offline.

**Sprint planning:** Bi-weekly. What work gets pulled from the backlog into this sprint? Does everyone have capacity? Are dependencies clear?

**Architecture reviews:** For any significant design decision, a structured review with senior engineers before implementation. Documented with decision records (ADRs).

**Code review:** All code goes through peer review before merging. Review is not optional. Review comments are discussions, not edicts.

**Retrospectives:** At the end of each sprint or monthly. What went well? What didn't? What one thing will we change next sprint?

---

## RACI Matrix

RACI defines **Responsible** (does the work), **Accountable** (owns the outcome, one person), **Consulted** (provides input before the decision), and **Informed** (notified of the outcome).

### RACI for Common Data Engineering Activities

#### Legend
- R = Responsible (does the work)
- A = Accountable (owns outcome)
- C = Consulted
- I = Informed

| Activity | Data Eng | Analytics Eng | Data Analyst | Data Scientist | Platform Eng | Data Arch | Data PM | Stakeholder |
|----------|----------|---------------|-------------|----------------|-------------|-----------|---------|-------------|
| **Pipeline deployment to production** | R/A | C | I | I | C | I | I | I |
| **Schema change to source table** | C | R | C | C | I | A | I | C |
| **Data quality incident response** | R | R | C | I | C | A | I | I |
| **Quality fix (model logic bug)** | C | R/A | C | I | I | C | I | I |
| **New data source onboarding** | R | C | C | I | C | A | R | C |
| **Dashboard publish** | I | C | R/A | I | I | I | I | C |
| **Data contract definition** | C | R | C | C | I | A | C | R |
| **Access policy change** | C | C | I | I | R | A | C | C |
| **Analytics engineering model refactor** | C | R/A | C | I | I | C | I | I |
| **ML model deployment** | C | C | I | R | C | I | A | I |
| **Data catalog entry** | C | R | R | C | I | A | I | I |
| **Infrastructure provisioning** | C | I | I | I | R/A | C | I | I |
| **Sprint prioritization** | C | C | C | C | C | C | R/A | C |

> [!warning] One Accountable Owner Per Activity
> The most common RACI failure is having multiple "Accountable" owners, which means nobody is truly accountable. If multiple teams share accountability, you need to pick one — and ensure that person has the authority to make decisions.

> [!success] Fix: Assign Accountability Before Work Begins
> During sprint planning or project kick-off, explicitly name a single accountable owner for each activity in the RACI matrix. Record the assignment in writing. If two teams both claim accountability, escalate to a manager to arbitrate — do not leave it unresolved.

---

## On-Call and Incident Management

Data teams need an on-call rotation, just like software engineering teams. Data incidents — silent data errors, broken pipelines, freshness violations — erode stakeholder trust faster than anything else.

### On-Call Structure

**Primary on-call:** One engineer who is the first responder for any data incident during their rotation. Carries the pager. Available to respond within 15 minutes during business hours, 30 minutes outside.

**Secondary on-call:** Backup if primary is unreachable. Often the previous primary.

#### Escalation path
```
Alert fires → Primary on-call → (if no response in 15 min) Secondary → (if no response) Engineering Manager → Director
```

### Incident Severity Levels

| Severity | Description | Example | Response Time | Who Is Notified |
|----------|-------------|---------|--------------|-----------------|
| **P0 (Critical)** | Production data is wrong, stakeholders are making bad decisions | Revenue numbers wrong in finance dashboard | Immediate (< 15 min) | On-call + Manager + Stakeholders |
| **P1 (High)** | Data is delayed beyond SLA, widely used pipeline is down | Daily sales pipeline 4 hours late | < 1 hour | On-call + Manager |
| **P2 (Medium)** | Partial data issue, workaround exists | One segment missing from cohort analysis | Next business day | On-call |
| **P3 (Low)** | Minor issue, minimal impact | Non-critical report showing stale data | Scheduled work | Ticket |

### Blameless Postmortem Template

For P0 and P1 incidents, run a blameless postmortem within 48 hours:

1. **Timeline** — Exact chronology of what happened, minute by minute
2. **Root cause** — The actual systemic cause (not "human error")
3. **Impact** — Who was affected? What decisions were made on bad data?
4. **Detection** — How was the incident detected? How long before detection?
5. **Response** — What was done to mitigate and resolve?
6. **Action items** — Concrete prevention and detection improvements, with owners and due dates
7. **What went well** — Even in incidents, something went right

> [!info] Human error is never root cause
>
> If your postmortem concludes "the engineer made a mistake," you have not found the root cause. Ask "why was it possible for that mistake to cause this incident?" The root cause is always a process, system, or architectural failure that allowed the human error to propagate.

---

## Building a Data Team from Scratch

If you are the first data hire, or building a data team at an early-stage company, here is a recommended sequencing:

### Stage 1: Foundation (Hire 1–3)

First hire: **Data Engineer with analytics engineering skills.** This person sets up the data warehouse, builds the first ingestion pipelines, and creates the first semantic models in dbt. They own everything.

Second hire: **Data Analyst.** The engineer is now spending too much time answering ad-hoc questions. The analyst takes over stakeholder-facing work, freeing the engineer to build infrastructure.

Third hire: **Another Data Engineer or Analytics Engineer.** By now you have real scale requirements and the first engineer is the bottleneck on everything.

### Stage 2: Scale (Hire 4–8)

Add specialization: a dedicated analytics engineer, a second data analyst per domain, and a first data platform/infrastructure engineer when the platform starts to be a bottleneck.

Establish practices: code review, CI/CD, on-call rotation, sprint process.

### Stage 3: Maturity (8+)

Add: data architects, data scientists, data product managers. Consider moving to hub-and-spoke. Invest heavily in self-service so you can scale analyst capability without linear headcount growth. See [self-service-data-platform](https://alp78.github.io/elysium/15-DataOps/self-service-data-platform).

### Hiring Anti-Patterns

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| **Hiring a data scientist before data engineering** | No reliable data to train on; DS wastes time on data wrangling |
| **Hiring an analyst before a data engineer** | Analyst can't do anything without pipelines and models |
| **Treating all data roles as interchangeable** | Wrong expectations, wrong tools, burnout |
| **Hiring for current tools, not fundamentals** | Tools change; fundamentals don't |
| **Under-leveling to save cost** | Senior engineers don't do the same work as junior engineers; false economy |
| **Building a team with no senior anchor** | No one to set technical direction; technical debt accumulates immediately |

---

## Remote and Distributed Data Teams

Most modern data teams are partially or fully distributed. Specific practices help distributed teams succeed:

### Async-First Communication

- Bias toward written documentation over verbal explanation
- Use recorded video (Loom) for complex explanations that would otherwise be calls
- Make decisions in writing (GitHub PRs, Confluence, Notion) — not in calls that some people can't attend
- Set clear response time expectations (e.g., "Slack messages during working hours, response within 4 hours")

### Overlap Windows

Ensure every pair of engineers has at least 3 hours of daily overlap, even across time zones. This enables real-time unblocking without making someone work outside normal hours.

### Documentation Standards for Distributed Teams

Documentation becomes load-bearing for distributed teams in a way it isn't for co-located teams:

- Every pipeline must have a README: what it does, why it exists, how to run it, how to debug it
- Every architectural decision must have an ADR (Architecture Decision Record)
- On-call runbooks must exist for every alert
- Onboarding documentation must be self-sufficient — the new hire should be able to get productive without a week of 1:1s

### Async Standups

For highly distributed teams (multiple time zones), written async standups (Geekbot, Standuply, or a Slack thread) can replace or supplement synchronous standups. Each engineer posts: Yesterday / Today / Blockers. Blockers get immediate async responses.

---

## Team Metrics

Track these metrics to understand team health and improve continuously:

### Delivery Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Deployment frequency** | How often pipelines are deployed to production | Weekly or more frequently |
| **Lead time** | Time from requirement to production | < 2 weeks for standard work |
| **Sprint velocity** | Story points completed per sprint | Stable and predictable (not maximized) |
| **Backlog age** | Average age of items in the backlog | < 90 days (older items need re-evaluation) |

### Quality Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Incident rate** | P0/P1 incidents per month | Decreasing trend |
| **MTTR** | Mean time to recover from incidents | < 1 hour |
| **Change failure rate** | % of deploys causing incidents | < 10% |
| **Test coverage** | % of models with automated tests | > 80% |

### Team Health Metrics

| Metric | Description | How to Measure |
|--------|-------------|----------------|
| **On-call burden** | Average hours per engineer per month on incidents | Incident tracking system |
| **Stakeholder satisfaction** | How satisfied are data consumers? | Quarterly NPS survey |
| **Engineer satisfaction** | Are engineers happy and engaged? | Monthly eNPS or retrospective |
| **Unplanned work ratio** | % of sprint capacity consumed by unplanned work | Sprint tracking |
| **Attrition rate** | % of team leaving annually | HR data |

> [!warning] Don't Optimize for Velocity Alone
> A team that maximizes story points by cutting corners on testing, documentation, and code review will appear high-performing in the short term and will collapse in the medium term. Velocity is a leading indicator; quality and reliability are the outcomes that matter.

> [!success] Fix: Track Quality Metrics Alongside Velocity
> Balance your sprint dashboard with paired metrics: velocity alongside change failure rate, and story points alongside MTTR. Set a team policy that velocity targets can only be met if quality thresholds (e.g., test coverage > 80%, change failure rate < 10%) are also maintained.

---

## Related Concepts

- [dataops-principles-and-practices](https://alp78.github.io/elysium/15-DataOps/dataops-principles-and-practices) — the practices this team structure exists to execute
- [self-service-data-platform](https://alp78.github.io/elysium/15-DataOps/self-service-data-platform) — how to scale data capability without scaling headcount linearly
- [leadership-and-collaboration](https://alp78.github.io/elysium/15-DataOps/leadership-and-collaboration) — broader principles of engineering leadership
- [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — the fully federated team model at large scale
