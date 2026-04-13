---
title: "04 - Leadership and Collaboration"
tags: [python, sql, terraform, airflow, leadership]
aliases: [code review best practices, technical design document, ADR template, architecture decision record, blameless post-mortem, incident response, war room, technical debt management, RACI matrix, matrixed organization, mentoring junior engineers, stakeholder communication, senior engineer skills, staff engineer, data engineering leadership]
description: "Leadership and collaboration skills for senior data engineers at scale: the code review as a teaching tool (review pyramid, feedback principles), technical design documents, stakeholder expectation management, mentoring progression, navigating matrixed organizations (RACI), Architecture Decision Records (ADRs), managing technical debt (four quadrants, technical debt register, when to say no), and incident response with blameless post-mortems (war room roles, 5-whys RCA, Euro market index incident case study). Includes all templates and frameworks."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Leadership and Collaboration

> [!quote]
> "No pull request should ever be accepted unless the engineer can answer the question, 'How will I know if this breaks?'"
>
> — **Charity Majors**, charity.wtf (2019)

> [!abstract]- Summary
>
> This note defines the non-coding side of senior data-engineering leverage: using reviews, design artifacts, decision records, stakeholder management, mentoring, and incident leadership to improve systems and teams rather than only shipping individual changes faster.
>
> **Engineering judgment and design practice**
> - Covers code review as a teaching and safety mechanism, including the review pyramid, result-diff expectations for high-risk data changes, and the standards senior reviewers should enforce around idempotency, validation, rollback, and operational safety.
> - Includes templates and guidance for technical design documents so substantial work is shaped through explicit context, goals, trade-offs, operational plans, and reviewer input before implementation begins.
>
> **Stakeholder leadership and team growth**
> - Explains expectation management, status communication, mentoring progression, and the practical behaviors needed to operate in matrixed organizations where influence depends on written clarity, relationship building, and explicit ownership boundaries.
> - Uses RACI and related coordination patterns to turn ambiguous cross-functional work into decisions with named owners and visible escalation paths.
>
> **Decision records and technical debt management**
> - Introduces ADRs as the durable record for contested technical choices, then pairs them with a practical framework for naming, prioritizing, documenting, and pushing back on technical debt.
> - Treats “saying no” as a risk-management skill: frame the business impact, offer alternatives, document the decision, and keep a visible debt register instead of letting shortcuts disappear into memory.
>
> **Incident leadership and postmortems**
> - Covers war-room roles, severity handling, communication separation, a financial-data incident example, and the blameless postmortem process used to convert incidents into concrete systemic improvements.
> - Includes templates for RCA structure, action-item discipline, and the leadership behaviors that keep teams learning instead of hiding mistakes after production failures.
>
> **Operations and safety**
> - Warnings: approving data changes without representative validation, shipping without rollback plans, informal ownership inside matrixed orgs, undocumented debt trade-offs, and incident reviews that stop at blaming an engineer.
> - Recommendations: require evidence for risky changes, write design docs and ADRs for consequential work, keep debt visible with owners and follow-up dates, and separate debugging, coordination, and communications during incidents.

> [!note]- Glossary
>
> **Review pyramid**
> - A prioritization model for code review that moves attention from style and readability up through correctness, data correctness, architecture, and operational safety.
> - It matters here because the note uses the pyramid to show that senior reviewers should spend their attention where the risk is highest, not where linters already do the job.
>
> > [!info] Review risk before style
> >
> > Style defects are cheap and automatable; unsafe data behavior and weak rollback paths are not.
>
> ---
>
> **Representative result diff**
> - Evidence comparing before-and-after outputs on realistic data to prove that a change preserved or intentionally altered behavior.
> - It matters here because the note treats result diffs as a required review artifact for gold-layer and calculation changes where tests alone may miss bad outcomes at scale.
>
> > [!warning] Passing tests can still hide wrong numbers
> >
> > For analytical and financial pipelines, correctness often has to be demonstrated on meaningful output samples, not inferred from code structure alone.
>
> ---
>
> **Design doc**
> - A structured proposal that captures the problem, goals, solution, alternatives, risks, and rollout plan for a significant piece of work.
> - It matters here because the note treats design docs as the mechanism that surfaces disagreement and operational consequences before implementation cost compounds.
>
> > [!info] Write before building
> >
> > The most valuable design docs are not polished essays; they are concise artifacts that make trade-offs reviewable early.
>
> ---
>
> **Architecture Decision Record / ADR**
> - A short record of a consequential technical decision, the context behind it, the alternatives considered, and the consequences accepted.
> - It matters here because ADRs preserve the rationale for choices that future engineers will otherwise revisit without the original constraints in view.
>
> > [!warning] Keep the trail intact
> >
> > Superseded ADRs still matter because they explain what changed in the environment or priorities that made a different decision correct later.
>
> ---
>
> **Matrixed organization**
> - An organizational model where engineers report through one management line while coordinating daily with several product, platform, compliance, or operations stakeholders.
> - It matters here because the note assumes senior engineers often need influence, clarity, and escalation discipline more than formal authority to get work unstuck.
>
> > [!warning] Ambiguity compounds quickly
> >
> > Matrixed teams slow down when ownership, approval rights, and communication paths are assumed instead of written down.
>
> ---
>
> **RACI matrix**
> - A responsibility framework that distinguishes who is Responsible, Accountable, Consulted, and Informed for a given activity.
> - It matters here because the note uses RACI to resolve the recurring ambiguity around who designs, approves, deploys, monitors, or responds during data-platform work.
>
> > [!info] Accountability must be singular
> >
> > The matrix only clarifies ownership when one person or role can actually make the final call and carry the outcome.
>
> ---
>
> **Technical debt register**
> - A visible inventory of known shortcuts, their impact, owners, effort, priority, and links to the design choices that created them.
> - It matters here because the note argues that debt becomes manageable only once it is documented, prioritized, and revisited intentionally.
>
> > [!warning] Invisible debt still accrues interest
> >
> > Teams often think they are moving fast when they are really borrowing against future incident load, rewrite cost, and engineering attention.
>
> ---
>
> **Rollback plan**
> - A concrete procedure for undoing a deployment or restoring a known-good state when a change causes harm.
> - It matters here because the note treats rollback readiness as part of the definition of safe delivery, especially for stateful data systems.
>
> > [!danger] Shipping without reversal is gambling
> >
> > If the team cannot explain how to undo the change, it has not finished the operational design of the change.
>
> ---
>
> **War room**
> - A focused incident-response channel or meeting where the active responders coordinate roles, decisions, status, and mitigation steps in real time.
> - It matters here because the note uses the war room as the operating context where leadership discipline matters most under pressure.
>
> > [!warning] Coordination is its own task
> >
> > Incidents become noisier and slower when nobody is explicitly managing roles, timeline, and decision flow while others debug.
>
> ---
>
> **Incident commander**
> - The person responsible for directing the incident response, assigning roles, controlling communication cadence, and making procedural decisions during an outage.
> - It matters here because the note separates incident command from hands-on debugging to preserve focus and keep stakeholders informed.
>
> > [!info] Command is not debugging
> >
> > A strong incident commander reduces confusion by owning coordination rather than trying to solve every technical detail personally.
>
> ---
>
> **Blameless postmortem**
> - A post-incident review method that focuses on systemic causes, timeline accuracy, and preventative action items instead of personal fault.
> - It matters here because the note treats blameless review as the mechanism that turns outages into process and platform improvements rather than fear-driven silence.
>
> > [!warning] Blameless is not consequence-free
> >
> > A blameless culture still expects rigorous follow-through; the absence of blame is only useful if the systemic fixes actually get implemented.
>
> ---
>
> **Stakeholder expectation management**
> - The practice of communicating impact, options, timing, and risk in a way that helps non-technical partners make informed decisions.
> - It matters here because the note frames expectation management as a core leadership skill for senior engineers who need to align business urgency with technical reality.
>
> > [!info] Lead with impact
> >
> > Stakeholders usually need the effect on time, money, accuracy, or customer commitments before they need the implementation detail.

> [!example] Leadership Leverage Fit
>
> > [!success] Appropriate
> >
> > - Use this note for senior and staff engineer development, review standards, design-review practice, project leadership, debt prioritization, and production-incident response design.
> > - Use it when the leverage point is better decisions, clearer ownership, stronger review discipline, and better incident learning rather than more individual coding throughput.
> > - Use it to formalize where written artifacts, mentoring, escalation paths, and postmortems actually improve engineering quality and team behavior.
>
> > [!failure] Inappropriate
> >
> > - Do not use this note as a substitute for technical depth; leadership artifacts do not compensate for weak engineering judgment.
> > - Do not add ceremony where the work is still small, reversible, and low risk.
> > - Do not turn design docs, ADRs, or postmortems into paperwork detached from real operational decisions and follow-through.

## The Code Review as a Teaching Tool

Code reviews are not quality gates — they are the primary mechanism through which engineering standards propagate across a team. A senior engineer's review should leave the author better equipped for their next PR.

#### The review pyramid (what to focus on, in order)

```
                    ┌─────────────┐
                    │   Style     │  ← Automated (linter handles this)
                   ┌┴─────────────┴┐
                   │  Readability   │  ← Quick comments, naming, structure
                  ┌┴───────────────┴┐
                  │   Correctness    │  ← Does it do what it claims?
                 ┌┴─────────────────┴┐
                 │  Data Correctness  │  ← Financial-specific: is the calculation right?
                ┌┴───────────────────┴┐
                │    Architecture      │  ← Does this fit the system? Will it scale?
               ┌┴─────────────────────┴┐
               │  Operational Safety    │  ← Can we deploy, rollback, and monitor this?
               └───────────────────────┘
```

> [!warning] Approve-without-running risk
>
> In data engineering, the most dangerous PRs look correct in review but produce wrong results at scale. A SQL query that works on 1,000 rows may produce duplicates or incorrect aggregations on 10M rows. For any PR that modifies a gold-layer query or calculation, request that the author include a diff of before/after query results on a representative dataset -- not just "tests pass."

> [!success] Fix: Require a Row-Count or Result Diff in Gold-Layer PRs
> Add a PR template checklist item for any gold-layer or calculation change: "Include a before/after row count, aggregate diff, or spot-check table for a representative date range." Make this a blocking check in code review — the test suite passing is necessary but not sufficient for financial calculation changes.

#### What senior reviewers look for in data pipeline PRs

| Check | Good | Bad |
|---|---|---|
| Idempotency | `MERGE` or delete-insert pattern | Raw `INSERT` that creates duplicates on retry |
| Error handling | Specific exceptions caught, meaningful logging | Bare `except: pass` |
| Transaction scope | One logical unit per transaction | 50 tables updated in a single transaction (lock escalation) |
| Data validation | Row counts, NULL checks, range checks after load | No validation -- assumes data is correct |
| Rollback plan | PR description explains how to undo | No rollback mentioned |
| Naming | `compute_momentum_z_scores()` | `process_data()` |
| SQL safety | Parameterized queries, explicit column lists | `SELECT *`, string-concatenated SQL |
| Test coverage | Unit tests for business logic, integration test for pipeline | No tests -- "I tested manually" |

#### How to give good review feedback

```markdown
# Bad review comment:
"This is wrong."

# Good review comment:
"This INSERT will create duplicates if the DAG retries after a partial failure.
Consider using a MERGE or wrapping in a delete-insert transaction.
See our silver layer pattern in dags/common/sql_helpers.py:42 for an example."
```

#### Principles

- Comment on the *code*, never the *person*
- Suggest alternatives, don't just point out problems
- Use "we" language: "We prefer MERGE here because..." not "You should use MERGE"
- Approve with comments for minor issues; block only for correctness or safety
- Review within 24 hours — stale PRs kill velocity (see [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) for the full review workflow and PR template)

## Technical Design Documents

Before building a significant feature (> 1 week of work), write a design doc. This prevents wasted effort, surfaces disagreements early, and creates a record of architectural decisions.

#### Template for data engineering design docs

```markdown
# Design Doc: [Feature Name]
**Author:** [Name] | **Date:** [Date] | **Status:** Draft → Review → Approved → Implemented

## Context and Problem Statement
What business need or technical problem does this solve?
Why is the current approach insufficient?

## Goals and Non-Goals
#### Goals
- [Specific, measurable outcomes]

#### Non-Goals (explicitly out of scope)
- [What this design will NOT do]

## Proposed Solution
Architecture diagram (ASCII or image).
Data flow: source → ingestion → transform → storage → consumption.
Key design decisions and trade-offs.

## Alternatives Considered
| Option | Pros | Cons | Why Not |
|---|---|---|---|

## Data Model Changes
New tables, modified columns, migration plan.
Impact on downstream consumers.

## Operational Considerations
- Deployment plan (zero-downtime? Blue-green?)
- Monitoring: what metrics/alerts are needed?
- Rollback plan: how to undo if something goes wrong?
- Performance impact: estimated load, query patterns

## Security and Compliance
- Data classification (PII, financial, public)
- Access control changes
- Regulatory implications (BMR, ESMA)

## Timeline and Milestones
| Week | Deliverable |
|---|---|

## Open Questions
- [Unresolved decisions that need input from reviewers]
```

## Managing Stakeholder Expectations

As a senior engineer, you are the bridge between technical reality and business expectations. The most common failure mode is not technical — it is mismatched expectations.

#### The status update framework

| Situation | What to Communicate | When |
|---|---|---|
| On track | Brief update: "Migration Phase 2 on schedule, 7/12 pipelines migrated" | Weekly (standup or Slack) |
| Minor delay | Impact + mitigation: "Bloomberg SFTP key rotation delayed ingestion by 2 hours, resolved, data now current" | Same day |
| Major risk | Early warning + options: "The reconstitution pipeline needs 3 more weeks. Options: (A) delay launch, (B) manual process for Q1, (C) reduce scope" | As soon as known |
| Incident | Facts only: "Index calculation delayed by 15 minutes due to exchange data feed outage. Resolved at 09:47 CET. No data loss." | During + post-incident review |

#### Rules for technical communication with non-technical stakeholders

1. Lead with the business impact, not the technical details
2. Provide options, not problems
3. Use time and money as units (not "rows" or "latency")
4. Never say "it should work" — say "we verified it works" or "we need to verify"
5. Under-promise, over-deliver on timelines (add 30% buffer to estimates)

## Mentoring Junior Engineers

A senior engineer who does not grow their team is a bottleneck, not a leader. Effective mentoring is not lecturing — it is creating situations where juniors develop judgment through guided experience.

#### The mentoring progression

```
Level 1: Pair programming (week 1-2)
   └─▶ Junior watches you work, asks questions
   └─▶ You explain not just WHAT you're doing but WHY

Level 2: Guided tasks (week 3-8)
   └─▶ Junior implements, you review closely
   └─▶ Intentionally assign tasks slightly above their level
   └─▶ Review within hours, not days

Level 3: Independent with guardrails (month 2-6)
   └─▶ Junior owns a pipeline end-to-end
   └─▶ You review PRs, they handle on-call for their pipeline
   └─▶ Let them make small mistakes (wrong index on a dev table = learning)
   └─▶ Prevent large mistakes (never let them push to prod without review)

Level 4: Delegation (month 6+)
   └─▶ Junior designs a solution, you review the design doc
   └─▶ They review other juniors' PRs (and you review their reviews)
   └─▶ They present at team meetings
```

#### What to teach first (highest ROI for a data engineering team)

1. **[Idempotency](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/migration-idempotency-backfills)** — most bugs in junior-written pipelines come from non-idempotent transforms
2. **SQL fundamentals** — window functions, CTEs, MERGE statements, execution plans
3. **Git discipline** — meaningful commits, atomic PRs, rebasing, conflict resolution
4. **Monitoring before shipping** — "if you can't see it breaking, you can't fix it"
5. **Reading before writing** — understand existing code before changing it

## Navigating a Matrixed Organization

Large financial data companies and similar organizations operate in a **matrix structure** — you report to an engineering manager but collaborate with product managers, index analysts, compliance officers, and SREs across different teams, offices, and time zones.

#### How to be effective in a matrix

| Challenge | Strategy |
|---|---|
| Multiple stakeholders with conflicting priorities | Escalate to your manager with a clear recommendation, not just the conflict |
| Cross-team dependencies blocking your work | Build relationships before you need them. Coffee chats > formal requests |
| Ownership ambiguity ("who owns this pipeline?") | Propose a RACI matrix and get agreement in writing |
| Decision paralysis (too many approvers) | Write a design doc with a recommendation, set a decision deadline |
| Remote/async collaboration (Frankfurt + Bangalore + NYC) | Over-communicate in writing. Assume nothing is obvious. Record decisions in Slack/Confluence, not hallways |

#### The RACI matrix for a data pipeline

| Activity | Data Engineer | Product Manager | DBA | SRE | Compliance |
|---|---|---|---|---|---|
| Pipeline design | **R**esponsible | **C**onsulted | **C**onsulted | **I**nformed | **I**nformed |
| Schema migration | **R** | **I** | **A**ccountable | **C** | **I** |
| Deployment to prod | **R** | **I** | **I** | **A** | **I** |
| Data quality monitoring | **R** | **I** | **C** | **A** | **C** |
| Regulatory audit | **C** | **I** | **C** | **I** | **A** |
| Incident response | **R** | **I** | **C** | **A** | **I** |

> [!tip] Related pattern
> For detailed on-call procedures and escalation paths that complement this RACI matrix, see the on call guide. For financial-specific incidents such as incorrect published index values, the data restatement procedure documents the end-to-end correction workflow.

## Architecture Decision Records (ADRs)

When you make an architectural decision that future engineers will question ("why did we use SQL Server instead of PostgreSQL?"), write an ADR. It is a short document that captures the context, decision, and consequences.

#### ADR template

```markdown
# ADR-007: Use SQL Server 2022 Developer Edition on GCE Instead of Cloud SQL

**Status:** Accepted | **Date:** 2025-06-15 | **Author:** [Name]

## Context
We need a relational database for the financial data platform that supports:
- Sub-second dashboard reads
- SCD Type 2 for dimension tracking
- MERGE statements for idempotent upserts
- Windows authentication or SQL auth over VPC

## Decision
Deploy SQL Server 2022 Developer Edition on an e2-standard-2 GCE VM with pd-ssd.

## Rationale
- **Cost:** Developer Edition is free for non-production workloads (our use case). Cloud SQL for SQL Server starts at ~$300/month for comparable specs.
- **Control:** Full admin access — can configure memory, tempdb files, trace flags, and backup schedules.
- **Performance:** pd-ssd directly attached gives predictable I/O, vs Cloud SQL's managed storage which can have latency spikes during maintenance.

## Alternatives Rejected
| Alternative | Reason |
|---|---|
| Cloud SQL for SQL Server | 4-5x more expensive for equivalent specs |
| PostgreSQL on GCE | Team expertise is SQL Server; MERGE syntax differs significantly |
| BigQuery | Sub-second reads for single-row lookups are not BigQuery's strength |
| AlloyDB | PostgreSQL-compatible, same migration cost as PostgreSQL |

## Consequences
- **Positive:** ~$2,400/year saved vs Cloud SQL. Full control over backups, upgrades, and tuning.
- **Negative:** We own the VM — patching, backups, and monitoring are our responsibility. No managed failover (acceptable for this workload).
- **Follow-up:** Implement automated backups to GCS (ADR-008).
```

Store ADRs in `docs/adr/` in the repository. Number them sequentially. Never delete an ADR — superseded decisions are marked `Status: Superseded by ADR-XXX`.

## Managing Technical Debt: The Guide to Saying "No"

Technical debt is inevitable. The question is not whether you accumulate it, but whether you manage it intentionally. A senior data engineer's most valuable skill is not writing code — it is knowing when to push back on shortcuts that will cost the team ten times more to fix later.

#### The four types of technical debt in data platforms

```
                    Intentional                     Unintentional
              ┌─────────────────────┬─────────────────────────────┐
  Prudent     │ "We know this is a  │ "We didn't know there was   │
              │  shortcut. We'll    │  a better pattern. Now we   │
              │  pay it back in     │  do."                        │
              │  Sprint 5."        │                              │
              ├─────────────────────┼─────────────────────────────┤
  Reckless    │ "We don't have time │ "What's idempotency?"       │
              │  for tests."       │                              │
              └─────────────────────┴─────────────────────────────┘
```

Only the top-left quadrant is acceptable. All others are engineering failures.

**Scenario: "Just use a cron script for the new ESG index"**

```
Product Manager: "We need to launch the new ESG-tilted index in 3 weeks.
                  Can you just add a Python script with a cron job?"

BAD response: "Sure, I'll hack something together."
  → Result: No error handling, no monitoring, no idempotency.
  → 6 months later: 3 AM pages, data corruption, 2 weeks to rewrite properly.

BAD response: "No, that's not how we do things."
  → Result: PM escalates. You look inflexible. Management overrides you.

GOOD response: "I can deliver this in 3 weeks with a phased approach:
  Week 1: Pipeline MVP — loads ESG data, computes tilted weights, writes to gold table.
           Uses our existing Airflow DAGs and MERGE patterns. Tested with 1 year of data.
  Week 2: Validation — automated checks (weights sum to 100%, no NULL scores).
           Shadow comparison against a manual spreadsheet calculation.
  Week 3: Dashboard + monitoring — Blazor page with the tilted index chart.
           Datadog alerts for data freshness.

  What I won't do: skip testing, hardcode credentials, or bypass our data quality checks.
  Here's an ADR documenting the tradeoffs we're accepting for the 3-week timeline."
```

#### The technical debt register — make it visible

```markdown
# Technical Debt Register (maintained in docs/tech-debt.md)

| ID | Description | Impact | Effort | Priority | Owner | ADR |
|---|---|---|---|---|---|---|
| TD-001 | ESG pipeline uses pandas instead of Polars | Slow: 45s for 500 rows | 2 days | LOW | @alex | — |
| TD-002 | No retry logic in Yahoo Finance API loader | Pipeline fails on transient 429 errors | 4 hours | HIGH | @alex | ADR-012 |
| TD-003 | Dashboard reads directly from silver tables | Tight coupling, no caching layer | 1 week | MEDIUM | @alex | — |
| TD-004 | Backup script has no alerting on failure | Silent backup failures → data loss risk | 2 hours | CRITICAL | @alex | ADR-009 |
| TD-005 | Corporate actions applied in pandas, not SQL | Cannot audit transformation logic | 3 days | HIGH | @alex | ADR-015 |
```

#### When to say "no" — the decision framework

| Pressure | Question to Ask | If Yes → Say No | If No → Negotiate |
|---|---|---|---|
| "Skip the tests" | Will this code handle financial data? | Never skip tests for financial calculations | Reduce scope: test happy path now, edge cases in Sprint N+1 |
| "Deploy to prod today" | Is there a rollback plan? | Never deploy without a rollback path | Deploy with a feature flag, monitor for 24h before enabling |
| "Use this vendor's API directly" | Does this bypass our data contracts? | Protect the schema boundary | Add a thin adapter layer now, integrate properly later |
| "Copy the production database" | Does it contain PII? | Never copy PII to dev without masking | Set up a masked copy with synthetic data |
| "Just add a column" | Is this a schema change to a shared table? | Requires contract review | Propose [expand-and-contract migration](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/migration-idempotency-backfills) |

#### How to escalate effectively

```
1. FRAME the problem in business terms:
   "If we skip validation, a bad ESG score could propagate to client portfolios
    worth €2B. The regulatory fine alone would be €5M."

2. OFFER alternatives (always bring solutions, not just problems):
   "Option A: 3 weeks with full validation (recommended).
    Option B: 2 weeks with partial validation, remaining checks in Sprint N+1.
    Option C: 1 week with no validation (I am documenting this as a risk in ADR-016)."

3. DOCUMENT the decision:
   If management chooses Option C, write the ADR. You are not being political —
   you are creating a paper trail that protects both you and the company.

4. FOLLOW UP:
   Add TD entries for every shortcut. Schedule the payback in the next sprint.
   "We shipped Option B. TD-007 and TD-008 are scheduled for Sprint 14."
```

#### The ratchet principle — never go backward

Every sprint should reduce total technical debt, not increase it. Treat the tech debt register like a financial ledger:

- **New feature** that adds debt: acceptable if documented with a payback plan
- **Bug fix** that adds debt: unacceptable — fix it properly or don't fix it
- **Refactoring** sprint: schedule one every 4-6 sprints to pay down accumulated debt
- **Incident postmortem** reveals debt: promote the related TD item to CRITICAL priority

> [!tip] The Political Reality of "No"
> In a matrixed organization, saying "no" to a Product Manager or a Director requires diplomatic skill. You are not saying "no" to the business goal — you are saying "yes, but with guardrails." Frame every pushback as risk management, not obstruction. The PM's incentive is to ship fast; your incentive is to ship safely. The ADR is the artifact that bridges these incentives: it documents the decision, the risk, the alternatives rejected, and who made the call. If it goes wrong, the ADR shows you raised the concern. If it goes right, the ADR shows the team made a deliberate tradeoff. Either way, the organization learns.

## The War Room: Incident Response and Blameless Post-Mortems

A senior data engineer's career is defined not by how many incidents they prevent (that is invisible work), but by how they lead the team *during* and *after* an outage. Incident response is a skill that must be practiced deliberately — you cannot learn it the first time production breaks.

#### The incident timeline — what a senior engineer does at each phase

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INCIDENT LIFECYCLE                                │
│                                                                          │
│  DETECT          TRIAGE           MITIGATE          RESOLVE              │
│  (0-5 min)       (5-15 min)       (15-60 min)       (1-4 hours)         │
│                                                                          │
│  ● Alert fires   ● Assess blast   ● Stop the        ● Root cause        │
│  ● Page on-call     radius           bleeding          identified        │
│  ● Acknowledge   ● Assign roles   ● Communicate     ● Permanent fix     │
│    the incident  ● Open war room     to stakeholders    deployed          │
│                  ● Start timeline ● Temporary fix    ● Monitoring        │
│                                     deployed            confirmed        │
│                                                                          │
│  POST-INCIDENT                                                           │
│  (24-72 hours after resolution)                                          │
│                                                                          │
│  ● Blameless post-mortem meeting                                        │
│  ● RCA document written and reviewed                                     │
│  ● Action items assigned with deadlines                                  │
│  ● Monitoring gaps addressed                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

#### War room roles (assign immediately, even if it is a 2-person team)

| Role | Responsibility | Who |
|---|---|---|
| **Incident Commander (IC)** | Coordinates response, makes decisions, controls communication | Senior engineer or on-call lead |
| **Technical Lead** | Investigates root cause, implements fixes | Engineer closest to the affected system |
| **Communications Lead** | Updates stakeholders, writes status page updates | PM or senior engineer (not the person debugging) |
| **Scribe** | Records timeline, decisions, and actions in real-time | Any team member (critical for post-mortem) |

> [!warning] Separate debugging from communication
>
> The golden rule: never let the person debugging also communicate. Debugging requires focus. Status updates require context switching. Assign different people.

> [!success] Fix: Assign Roles Before Debugging Starts
> The first 60 seconds of a war room must produce three named role assignments: Incident Commander, Technical Lead, Communications Lead. Use a Slack message template: "IC: @name | Tech Lead: @name | Comms: @name — scribe thread starts now." The IC owns all status updates; the Tech Lead never types in the main channel until the fix is deployed.

#### Incident severity levels for a financial data platform

| Severity | Definition | Response | Example |
|---|---|---|---|
| **SEV-1** | Published index value is incorrect or delayed past SLA | All hands, immediate escalation to management | Euro market index index published with yesterday's prices |
| **SEV-2** | Data pipeline is down, index will be affected if not fixed within 2 hours | On-call team + backup engineer | Airflow scheduler crashed, no DAGs running |
| **SEV-3** | Data quality issue detected but index not yet published | On-call engineer, normal priority | 3 of 50 constituent prices are stale (using previous close) |
| **SEV-4** | Non-critical system degraded | Fix during business hours | Dashboard loading slowly, monitoring gap in one metric |

**Financial-specific incident scenario: Wrong index value published**

```
09:00 UTC — EOD pipeline runs, calculates Euro market index value
09:05 UTC — Index value published to downstream consumers (ETF providers, Bloomberg, Reuters)
09:12 UTC — Datadog alert: "constituent_weight_sum_check FAILED: weights sum to 87.3%, expected ~100%"
09:14 UTC — On-call engineer acknowledges alert, opens war room Slack channel

TRIAGE (IC assessment):
  - 6 constituents have NULL weights (data feed returned empty for those symbols)
  - Published index value is ~13% lower than expected
  - Impact: ETF NAV calculations based on this value will be wrong
  - Severity: SEV-1

MITIGATE (stop the bleeding):
  09:18 UTC — IC sends correction notice to all downstream consumers:
              "Euro market index value for 2026-03-10 is under review. Do not use for NAV calculations.
               Corrected value will be issued by 10:00 UTC."
  09:22 UTC — Technical lead identifies: Yahoo Finance API returned 429 (rate limited)
              for 6 symbols. Pipeline loaded NULLs instead of using previous day's close.
  09:30 UTC — Manual fix: populate the 6 missing prices from Bloomberg terminal
  09:35 UTC — Re-run gold layer calculation
  09:38 UTC — Validation passes: weights sum to 100.0%, index value within 0.01% of Bloomberg

RESOLVE:
  09:42 UTC — Corrected index value published with amendment flag
  09:45 UTC — Downstream consumers notified: "Corrected value issued. Root cause: temporary
              data feed outage for 6 constituents."
  10:00 UTC — Incident closed. Post-mortem scheduled for tomorrow 14:00 UTC.
```

#### The Blameless Post-Mortem — RCA template

```markdown
# Post-Mortem: Euro market index Incorrect Index Value (2026-03-10)

**Date:** 2026-03-10 | **Duration:** 43 minutes (09:05 → 09:48 UTC)
**Severity:** SEV-1 | **Incident Commander:** [Name]
**Author:** [Name] | **Reviewers:** [Team]

## Summary
The Euro market index index value published at 09:05 UTC was 13% lower than correct
due to 6 constituent prices being NULL. The data feed (Yahoo Finance API) returned
HTTP 429 (rate limited) for these symbols. The pipeline loaded NULLs instead of
falling back to previous day's closing prices.

## Impact
- **Duration:** 43 minutes of incorrect published value
- **Consumers affected:** 12 ETF providers, 3 data vendors (Bloomberg, Reuters, Refinitiv)
- **Financial impact:** No direct financial loss (correction issued before NAV cut-off)
- **Reputational impact:** Medium (amendment notice sent to all consumers)

## Timeline
| Time (UTC) | Event |
|---|---|
| 08:55 | EOD pipeline triggered by Airflow |
| 09:00 | Yahoo Finance API returns 429 for SAP, ASML, LVMH, TotalEnergies, Siemens, Allianz |
| 09:01 | Pipeline logs WARNING but continues (no halt-on-error for transient API failures) |
| 09:02 | Gold layer calculation runs with 6 NULL prices → weights sum to 87.3% |
| 09:05 | Index value published to downstream consumers |
| 09:12 | Datadog alert fires: weight_sum_check FAILED |
| 09:14 | On-call engineer acknowledges, opens war room |
| 09:18 | Correction notice sent to consumers |
| 09:30 | Missing prices populated manually from Bloomberg |
| 09:42 | Corrected value published |
| 09:48 | Incident closed |

## Root Cause Analysis (5 Whys)

1. **Why was the index value wrong?**
   Because 6 constituent prices were NULL.

2. **Why were the prices NULL?**
   Because the Yahoo Finance API returned HTTP 429 (rate limited).

3. **Why didn't the pipeline retry or use fallback prices?**
   Because the retry logic only handles HTTP 500 errors, not 429.
   The pipeline treats NULL prices as "no trade today" rather than "data unavailable."

4. **Why wasn't this caught before publication?**
   The weight_sum_check runs AFTER publication, not before.
   There is no pre-publication gate that blocks publishing if data is incomplete.

5. **Why was there no pre-publication gate?**
   The pipeline was originally designed for a single index with stable data sources.
   As we added indices and data providers, the validation layer was not updated.

## Root Cause
**Systemic:** The pipeline lacks a pre-publication validation gate. Data quality checks
run post-hoc rather than blocking publication. The retry logic does not handle HTTP 429
(rate limiting), which is the most common transient failure mode for the Yahoo Finance API.

## What Went Well
- Alert fired within 7 minutes of incorrect publication
- Correction issued within 43 minutes (well within the 2-hour correction SLA)
- Clear communication to downstream consumers
- Manual remediation was fast (Bloomberg terminal as backup source)

## What Went Poorly
- 6 NULL prices should have halted the pipeline, not proceeded silently
- Weight sum validation ran after publication instead of before
- No automated fallback to previous day's close when API returns 429

## Action Items

| # | Action | Owner | Priority | Deadline |
|---|---|---|---|---|
| 1 | Add pre-publication gate: block publish if weight_sum < 99% | @alex | CRITICAL | 2026-03-14 |
| 2 | Add HTTP 429 to retry logic with exponential backoff | @alex | HIGH | 2026-03-17 |
| 3 | Implement fallback: use previous close if API fails after 3 retries | @alex | HIGH | 2026-03-17 |
| 4 | Move all data quality checks to run BEFORE gold layer publication | @alex | HIGH | 2026-03-21 |
| 5 | Add Datadog monitor: alert if any constituent price is NULL before publish | @alex | MEDIUM | 2026-03-14 |
| 6 | Document incident in runbook: "What to do when Yahoo Finance API is rate-limited" | @alex | LOW | 2026-03-28 |

## Lessons Learned
- **Post-hoc validation is not validation — it is damage detection.** Checks must run
  before publication, not after.
- **NULL is not the same as zero, and not the same as "no data."** The pipeline must
  distinguish between "stock did not trade today" and "we failed to fetch the price."
- **Transient API failures are not edge cases.** 429 errors happen weekly. The retry
  logic must handle them.
```

#### The blameless principle — why it matters

```
BLAME-FULL post-mortem:                   BLAMELESS post-mortem:
"Alex forgot to add retry logic."         "The system lacked retry logic for
                                           HTTP 429 responses."
Result: Alex feels defensive.              Result: The team discusses how to
        Team stops reporting issues.               detect similar gaps proactively.
        Same class of bug happens again.           Action items prevent recurrence.
```

#### Rules for running a blameless post-mortem

1. **No "who"** — replace every instance of a person's name with "the engineer" or "the system." The RCA identifies *systemic* failures, not human error.
2. **Everyone who was involved attends** — including the person who introduced the bug. They have the most context.
3. **Focus on the 5 Whys** — keep asking "why?" until you reach a systemic cause (process, tooling, architecture), not a human cause ("I made a mistake").
4. **Action items must be concrete, assigned, and deadlined** — "improve monitoring" is not an action item. "Add Datadog monitor for NULL constituent prices, assigned to @alex, due March 14" is.
5. **Review action item completion** — in the next team meeting, verify that every action item is in progress or completed. Unfinished action items from post-mortems are the #1 reason incidents repeat.
6. **Publish the RCA internally** — other teams learn from your incidents. An RCA that sits in a private Slack thread teaches nothing.

> [!tip] The Post-Mortem Is a Leadership Test
> How you run a post-mortem reveals your leadership character. If you blame the junior engineer who pushed the bad code, you teach the team to hide mistakes. If you focus on why the system allowed the bad code to reach production (missing tests, no pre-publish gate, inadequate review), you teach the team to build resilient systems. The best senior engineers I have worked with always start the post-mortem by saying: "The system failed, not the person. Let us figure out how to make the system better." That single sentence sets the tone for everything that follows.

## Related

- [index-maintenance-and-corporate-actions](https://alp78.github.io/elysium/index-maintenance-and-corporate-actions) — Financial domain context including EU BMR regulatory obligations driving the audit and incident response needs
- [migration-idempotency-backfills](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/migration-idempotency-backfills) — Technical patterns (idempotency, data contracts, schema evolution) that feed into the code review checklist
- [ai-augmented-data-engineering](https://alp78.github.io/elysium/16-AI-and-Prompts/LLM-Pipelines/ai-augmented-data-engineering) — AI-assisted code review and documentation patterns

## References

- Google SRE Book — Incident Management: https://sre.google/sre-book/managing-incidents/
- Accelerate (Nicole Forsgren et al.): https://itrevolution.com/product/accelerate/
- Trunk-Based Development: https://trunkbaseddevelopment.com/
- DORA Metrics: https://dora.dev/research/
