---
type: concept
category: data-architecture
technology: []
tags: [data-architecture, data-engineering, architecture]
aliases: [golden rules, engineering principles, data engineering philosophy, first principles, trade-off analysis, YAGNI, KISS, build vs buy, undifferentiated heavy lifting, reversible decisions, two-way doors]
keywords: [golden rules, data engineering principles, first principles, trade-off analysis, decision framework, YAGNI, KISS, build vs buy, undifferentiated heavy lifting, reversible decisions, two-way doors, boring technology, innovation tokens, schema evolution, idempotent pipelines, raw data preservation, bronze layer, complexity debt, cloud cost optimization, observability, automation, infrastructure as code, CI/CD, shadow pipelines, canary deployments, blue-green deployments, resume-driven development, tight coupling, loose coupling, expand and contract, premature optimization, operational pragmatism, dimensional clarity, lifecycle thinking, data engineering philosophy, simplicity, reliability, cost awareness, anti-patterns]
description: "The golden rules of data engineering — ten foundational principles that guide every architectural decision, technology choice, and trade-off evaluation. Inspired by Reis & Housley, Kleppmann, Kimball, Densmore, and the five pillars of senior data engineering."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# The Golden Rules of Data Engineering

> [!quote]
> "A data engineer's job is to get data into a state where it can create value, not to build the most sophisticated pipeline possible."
>
> — **Joe Reis & Matt Housley**, *Fundamentals of Data Engineering* (2022)

Every discipline has its load-bearing principles — the handful of truths that, once internalized, make thousands of smaller decisions nearly automatic. Medicine has "first, do no harm." Engineering has "measure twice, cut once." Data engineering has these ten rules.

These are not commandments handed down from a conference keynote. They are patterns distilled from painful production incidents, surprise cloud bills, 3 AM pages, migrations that took three times longer than estimated, and the quiet satisfaction of systems that just work, month after month, without anyone thinking about them. That last part — the not thinking about it — is the goal.

The intellectual lineage here is worth naming. Joe Reis and Matt Housley gave us lifecycle thinking: the idea that data engineering is not about tools but about the journey data takes from source to value. Martin Kleppmann taught us to understand trade-offs at the systems level — that every design choice is a bet, and you should know what you are betting on. Ralph Kimball gave us dimensional clarity — the discipline of modeling data so that humans can actually understand it. Matt Densmore gave us operational pragmatism — the reminder that a pipeline is not done when it runs once; it is done when it runs reliably without you. And the [five pillars](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering) — reliability, observability, efficiency, security, and operability — provide the structural framework that these rules reinforce.

This note is the philosophical foundation. It does not tell you which tool to use. It tells you how to think about which tool to use.

---

## Rule 1: Serve the Business, Not the Technology

Technology is a means. It is never an end. Every technical decision you make must trace back, through however many layers of abstraction, to a business outcome that someone is willing to pay for.

This sounds obvious. It is not practiced as often as it is preached.

### The Principle

The job of a data engineer is not to build pipelines. It is to deliver reliable, timely, trustworthy data to the people and systems that need it to make decisions. The pipeline is an implementation detail. If the same outcome could be achieved with a spreadsheet and a weekly manual export, and the volume and frequency justify that approach, then that is the right architecture.

Reis and Housley put it plainly: "The data engineer's job is to move data from point A to point B reliably, securely, and cost-effectively." Not elegantly. Not impressively. Reliably, securely, and cost-effectively.

### What This Looks Like in Practice

- Before writing any code, articulate the business question the pipeline answers.
- If you cannot explain the architecture to a non-technical stakeholder in two minutes, the architecture is probably too complex for the problem.
- The CFO test: "If I explain this architecture to the CFO, does it sound proportionate to the business problem?" A streaming pipeline for data that is consumed in weekly reports fails this test.
- Technology choices should be justified by requirements, not by interest. "We chose Kafka because we need sub-second event delivery to three independent consumers" is a justification. "We chose Kafka because it's industry standard" is not.

### The Anti-Pattern: Resume-Driven Development

Resume-Driven Development (RDD) is the practice of choosing technologies because they look good on a resume rather than because they solve the problem at hand. It is the single most expensive anti-pattern in data engineering, not because the technology is bad, but because the operational cost of technology that exceeds the problem's complexity is paid every single day in maintenance, debugging, hiring, and cognitive load.

> [!warning] The Resume-Driven Development Test
> If you removed the technology from your resume, would you still choose it for this problem? If the answer is no, you are optimizing for your career at the expense of your employer's money. That is a conflict of interest.

### Decision Test

> [!question] Rule 1 Decision Test
> "Why are we building this?" — and the answer must be something a non-technical stakeholder understands and agrees is worth paying for.

---

## Rule 2: Choose Boring Technology

Dan McKinley's essay "Choose Boring Technology" introduced the concept of innovation tokens. The idea is simple and profound: every organization has a limited capacity to absorb new technology. Each unfamiliar tool in your stack consumes part of that capacity — capacity that could be spent on solving actual business problems.

### The Principle

A team gets roughly three to four innovation tokens. Each token represents the team's ability to adopt, learn, debug, and operate one piece of unfamiliar technology. Spend them where they create real competitive advantage. Everywhere else, use the boring thing.

Boring technology is boring because it works. PostgreSQL has been around since 1996. Cron has been scheduling jobs since 1975. Python has been gluing systems together for three decades. SQL has been querying relational data since the 1970s. These tools have decades of Stack Overflow answers, battle-tested edge case handling, and operational playbooks that exist because millions of people hit the same problems before you.

### The Innovation Token Budget

| Category | Boring Choice | Exciting Choice | When to Spend the Token |
|----------|--------------|-----------------|------------------------|
| Scheduling | cron, Windows Task Scheduler | Airflow, Prefect, Dagster | When you have 10+ interdependent DAGs with complex dependencies |
| Messaging | Database polling, file drops | Kafka, Pub/Sub, RabbitMQ | When you need real-time delivery to multiple independent consumers |
| Orchestration | Shell scripts, Python scripts | Kubernetes, Docker Swarm | When you need auto-scaling across dozens of microservices |
| Storage | PostgreSQL, SQL Server | Cassandra, DynamoDB, CockroachDB | When relational models genuinely cannot handle your access patterns |
| Processing | Pandas, SQL | Spark, Flink, Beam | When your data exceeds single-machine memory |
| Serving | REST API with Flask | GraphQL, gRPC | When you have complex nested queries or need binary protocol speed |

### What Boring Looks Like at Scale

This is not an argument against sophisticated technology. It is an argument for proportionality. Netflix uses Kafka because they process billions of events per day across hundreds of microservices. You are not Netflix. If you have three data sources and five dashboards, PostgreSQL and cron will serve you well for years.

The moment you genuinely outgrow the boring tool — when cron cannot express your dependency graph, when PostgreSQL cannot handle your write volume, when pandas runs out of memory — that is the moment to spend an innovation token. Not before.

> [!tip] The Boring Technology Litmus Test
> Can you solve this with tools your team already knows and operates? If yes, do that. The best technology is the technology your team can debug at 2 AM without reading documentation.

### Decision Test

> [!question] Rule 2 Decision Test
> "Can I solve this with tools my team already knows?" If yes, any other choice requires explicit justification that outweighs the learning, operational, and hiring costs of the alternative.

---

## Rule 3: Optimize for Change, Not for Now

The only constant in data engineering is change. Source systems get replaced. APIs change their schemas. New business requirements demand new fields, new granularities, new consumers. The pipeline you build today will need to accommodate changes you cannot predict.

### The Principle

Kleppmann dedicates significant portions of "Designing Data-Intensive Applications" to this idea: systems must evolve. The question is not whether your system will need to change, but whether you have designed it so that change is cheap and safe rather than expensive and dangerous.

This means:
- **Loose coupling** between pipeline stages. Each stage should communicate through well-defined interfaces (files, APIs, message queues) rather than direct database connections or shared mutable state.
- **Schema evolution** through the expand-and-contract pattern: add the new column, migrate consumers, then remove the old column. Never break existing consumers with a schema change.
- **Idempotent pipelines** that can be safely re-run without duplicating data or corrupting state. [Idempotency](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) is so fundamental that it could be a golden rule on its own — see the dedicated note for the full treatment.
- **Versioned interfaces** so that consumers can migrate at their own pace rather than being forced to update in lockstep.

### Expand-and-Contract in Practice

The expand-and-contract pattern is the schema evolution strategy that prevents breaking changes:

```
Phase 1 — Expand:
  - Add new column (customer_email_v2) alongside old column (customer_email)
  - Write to both columns
  - Existing consumers continue reading old column

Phase 2 — Migrate:
  - Update consumers one by one to read from new column
  - Monitor for any remaining reads of old column

Phase 3 — Contract:
  - Once no consumers read old column, drop it
  - Total downtime: zero
  - Total breakage: zero
```

### Loose Coupling: The Interface Hierarchy

From loosest to tightest coupling:

1. **File-based** (CSV, Parquet, JSON in cloud storage) — producer and consumer never communicate directly
2. **Message queue** (Kafka, Pub/Sub, RabbitMQ) — asynchronous, buffered, decoupled in time
3. **REST API** — synchronous but versioned, consumer controls when to call
4. **Shared database** — dangerous; both sides depend on the same schema, the same instance, the same performance envelope
5. **Direct function calls** — tightest coupling; any change to the function signature breaks all callers

> [!warning] The Shared Database Anti-Pattern
> When two systems communicate through a shared database, every schema change, every index addition, every performance regression in one system directly affects the other. This is not integration — it is entanglement. Use it only when both systems are owned by the same team and deployed together.

### Decision Test

> [!question] Rule 3 Decision Test
> "If the source system changes its schema tomorrow, how many things break?" If the answer is "everything," your architecture is too tightly coupled. If the answer is "just the ingestion layer, and we have a contract test that catches it," you are in good shape.

---

## Rule 4: Make Reversible Decisions Quickly, Irreversible Decisions Carefully

Jeff Bezos distinguishes between two types of decisions. Type 1 decisions are one-way doors: once you walk through, you cannot easily walk back. Type 2 decisions are two-way doors: if you don't like what you see on the other side, you can step back through and try something else.

### The Principle

Most decisions in data engineering are two-way doors. The file format for your staging area. The Python library for your API calls. The name of a column in a silver table. The dashboard tool for a prototype. These can all be changed later at modest cost. Make them quickly. Do not convene a committee. Do not write a design document. Just decide, implement, and move on.

A small number of decisions are one-way doors. The cloud provider for your production infrastructure. The grain of your primary fact table (Kimball's most consequential design decision). The choice to delete raw data. The primary database engine. These are expensive or impossible to reverse. Take time with them. Get input. Write the design document. Sleep on it.

### The Decision Classification

| Decision Type | Examples | Approach | Time Budget |
|--------------|----------|----------|-------------|
| **Two-way door** | File format (CSV vs Parquet), API framework (Flask vs FastAPI), column naming convention, dashboard tool, dev environment setup | Decide in minutes to hours. Bias toward action. | Hours |
| **One-way door** | Cloud provider, primary database engine, data model grain, deletion of raw data, choice of data warehouse, SLA commitments | Gather input. Write a one-pager. Consider second-order effects. | Days to weeks |
| **Appears one-way but is two-way** | Most technology choices (you can migrate), most architectural patterns (you can refactor), most team processes (you can change them) | Recognize these for what they are. Do not over-deliberate. | Hours to days |
| **Appears two-way but is one-way** | Promising a data format to external consumers, publishing an API that others depend on, choosing a partition key in a distributed database | Recognize the hidden lock-in. Treat as one-way. | Days |

### The Danger of Treating Two-Way Doors as One-Way

Analysis paralysis is the most common failure mode here. Teams spend weeks evaluating orchestration tools when they have three pipelines. They write RFCs for choosing between Parquet and CSV when they can switch in an afternoon. They debate column naming conventions for a table that has four columns.

Every hour spent deliberating on a two-way door decision is an hour not spent building. And the information you gain by building is almost always more valuable than the information you gain by deliberating.

### The Danger of Treating One-Way Doors as Two-Way

The inverse failure is equally damaging. Choosing a data warehouse on a Friday afternoon because "we can always migrate later" ignores the reality that migrations are measured in months and engineer-years, not days and engineer-hours. Deleting raw data because "we've already transformed it" ignores the reality that you might need to re-derive everything if a bug is found in the transformation logic.

> [!important] The Grain Decision
> Kimball identified the grain of a fact table as the single most important decision in dimensional modeling. The grain determines what each row represents, and every other design choice flows from it. Choosing the wrong grain means rebuilding the entire model. This is a one-way door. Get it right.

### Decision Test

> [!question] Rule 4 Decision Test
> "Can I undo this in a day, or am I stuck for years?" If you can undo it in a day, decide now. If you are stuck for years, take a week to get it right.

---

## Rule 5: Raw Data Is Sacred — Never Lose the Source

This is the rule that, when violated, causes the most regret. Not the most immediate pain — that belongs to monitoring failures (Rule 10). But the most lasting, irreversible damage.

### The Principle

The bronze layer in a [medallion architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) exists for exactly one reason: to preserve raw data exactly as received from the source system. The [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) is the standard architectural pattern that embodies this rule across all three layers. No transformations. No filtering. No deduplication. No "helpful" type conversions. The data lands in bronze looking exactly the way it looked when it left the source.

Why? Because you can always re-derive silver and gold from bronze. You can apply new transformations, fix bugs in old transformations, add new columns, change aggregation logic — all from the same raw data. But you can never re-derive bronze from gold. The transformation is lossy by definition. Information is destroyed at every layer of abstraction.

### What "Sacred" Means in Practice

- **Store it as received.** If the API returns JSON, store JSON. If the file is CSV, store CSV. Do not parse, clean, or restructure in the landing step.
- **Compression is fine.** Gzip, Snappy, ZSTD — these are lossless. The data is preserved exactly. Compress aggressively. Storage is cheap but not free.
- **Transformation is not fine.** Not in bronze. No column renames. No type casts. No null handling. No deduplication. These belong in silver.
- **Add metadata, do not modify data.** Append ingestion timestamp, source identifier, batch ID, file path — these are metadata columns that aid debugging without altering the source data.
- **Retention should be generous.** Err on the side of keeping too much for too long. The cost of storing an extra year of compressed raw data is negligible compared to the cost of re-ingesting it (if even possible).

### The Re-Derivation Guarantee

This is the acid test of a well-designed medallion architecture:

> [!tip] The Re-Derivation Guarantee
> If every silver table, every gold table, and every dashboard were deleted today, could you rebuild everything from bronze? If yes, your architecture is resilient. If no, you have a single point of failure somewhere in your transformation layer.

This guarantee is what makes the medallion architecture powerful. It means bugs are fixable, business logic is changeable, and new requirements can be met retroactively. Without it, every transformation bug becomes a permanent scar in your data.

### When Source Data Disappears

Some sources do not offer historical re-extraction. APIs return only current state. Vendor systems overwrite records. External partners send files once and delete them. In these cases, your bronze layer is not just a convenience — it is the only copy of that data that will ever exist.

> [!danger] The Deletion Anti-Pattern
> Never delete raw data to save storage costs without explicit sign-off from the data owner AND a documented analysis showing that re-ingestion is possible if needed. "We can always pull it again" is only true if you have verified that the source retains history. Many do not.

### The Cost Argument

"But storage costs money." Yes. Let us do the math.

- 1 TB of compressed Parquet in Google Cloud Storage (Standard): ~$20/month
- 1 TB of compressed Parquet in Azure Blob Storage (Hot): ~$18/month
- 1 TB of compressed Parquet in AWS S3 Standard: ~$23/month

Now compare that to:
- One engineer spending one week re-ingesting data from a source that may or may not still have it: $3,000-$6,000 in labor alone
- The business impact of a dashboard showing incorrect data for the period where raw data was lost: incalculable

Storage is the cheapest insurance policy in all of engineering.

### Decision Test

> [!question] Rule 5 Decision Test
> "If every downstream table is wrong, can I rebuild from raw?" If the answer is yes, your architecture is sound. If the answer is no, you are one bug away from a data crisis.

---

## Rule 6: Complexity Is Debt — Simplicity Is a Feature

Complexity is not a sign of sophistication. It is a sign that the problem has not been fully understood, or that the solution has outgrown the problem. Every component, every dependency, every integration point, every configuration option is a future maintenance burden that will be paid by someone — often someone who did not create it.

### The Principle

Software engineers talk about technical debt as if it is always code quality. In data engineering, the most dangerous form of technical debt is architectural complexity. A pipeline with twelve steps, three orchestrators, two message queues, and a custom framework is not impressive — it is fragile. Every connection point is a potential failure point. Every dependency is a version conflict waiting to happen. Every abstraction layer is a place where bugs hide.

Simplicity is not the absence of capability. It is the presence of clarity. A simple system is one where every component has an obvious purpose, every data flow is traceable, and a new team member can understand the architecture in an afternoon.

### The Hierarchy of Simplicity

From simplest to most complex, prefer solutions higher on this list:

1. **No code at all.** Can this be solved with a configuration change? A managed service? A SaaS tool?
2. **A SQL query.** SQL is declarative, testable, versionable, and understood by nearly everyone in data.
3. **A Python script.** When SQL cannot express the logic, Python with well-known libraries (pandas, requests, pyodbc) is the next step.
4. **A scheduled job.** Cron, Windows Task Scheduler, or a simple cloud scheduler. No framework overhead.
5. **An orchestration framework.** Airflow, Prefect, Dagster. Use when you have genuine dependency graphs that cron cannot express.
6. **A distributed system.** Spark, Flink, Kafka. Use when single-machine processing genuinely cannot keep up.
7. **A custom framework.** Almost never the right answer. If you are building a framework, you are probably solving the wrong problem.

### Practical Simplicity Guidelines

**Three lines of duplicated code are better than a premature abstraction.** The DRY (Don't Repeat Yourself) principle is good advice taken too far. If you extract a shared function for logic that is used in two places and those two places might diverge in the future, you have created coupling where none was needed. Wait until you see the pattern three times before abstracting.

**A single SQL query is better than a Python script that calls SQL.** If the logic can be expressed in SQL, express it in SQL. Python adds a runtime, a connection library, error handling, and logging that SQL Server or PostgreSQL would handle natively.

**A cron job is better than Airflow if you have three DAGs.** Airflow is a fantastic orchestration tool. It is also a web server, a metadata database, a scheduler, and a worker pool. If you have three scheduled jobs, that infrastructure is not justified. When you have thirty DAGs with complex dependencies, Airflow earns its keep.

**A monolith is better than microservices if one team maintains it.** The overhead of service boundaries, API contracts, independent deployments, and distributed tracing is justified when multiple teams need to deploy independently. For a single team, a well-structured monolith is simpler in every dimension.

> [!tip] The Simplicity Razor
> When comparing two solutions that both meet the requirements, the simpler one is almost always correct. The burden of proof is on complexity — you must justify why the simple approach is insufficient, not why the complex approach is desirable.

### The YAGNI Principle

YAGNI — You Aren't Gonna Need It — is the antidote to speculative engineering. Do not build for scale you do not have. Do not add features nobody has requested. Do not design for edge cases that have not materialized.

This does not mean ignoring the future. It means distinguishing between designing for change (Rule 3 — good) and building for imagined requirements (YAGNI violation — bad). Loose coupling is designing for change. Building a streaming pipeline for batch data because "we might need real-time someday" is a YAGNI violation.

### Decision Test

> [!question] Rule 6 Decision Test
> "Is this simpler than the previous approach, or am I adding complexity?" If you cannot articulate why the added complexity is necessary to meet a specific, current requirement, you are adding debt.

---

## Rule 7: Cost Is a First-Class Architectural Concern

Cloud computing did not eliminate infrastructure costs. It converted capital expenditure into operational expenditure and made the billing granular enough that every poor architectural decision shows up as a line item. This is actually a gift — if you pay attention.

### The Principle

Cloud bills are production metrics. They belong on dashboards next to latency, error rates, and throughput. Every query, every storage bucket, every running instance has a price, and that price is directly influenced by architectural decisions.

This is not about penny-pinching. It is about proportionality. A $500/month BigQuery bill for a system that generates $50,000/month in business value is a rounding error. A $500/month BigQuery bill for a system that nobody uses is waste. The absolute number matters less than the ratio of cost to value.

### Know Your Cost Drivers

| Service | Cost Driver | What You Control |
|---------|-------------|-----------------|
| BigQuery | Bytes scanned per query | Partitioning, clustering, materialized views, column selection |
| Snowflake | Warehouse size x time running | Auto-suspend, right-sizing, query optimization |
| Cloud Storage / S3 / Blob | Storage volume + egress | Compression, lifecycle policies, storage classes |
| Compute (VMs) | Instance size x uptime | Right-sizing, auto-scaling, spot/preemptible instances |
| Kafka / Pub/Sub | Messages x retention | Retention policies, message batching, dead letter handling |
| Dataflow / EMR | Worker count x time | Autoscaling, right-sizing, job optimization |

### The Right-Sizing Discipline

Do not start with the largest instance and scale down. Start with the smallest instance and scale up when monitoring tells you to.

- **Compute:** Start with e2-medium / t3.medium. Monitor CPU and memory. Upgrade when utilization consistently exceeds 70%.
- **Storage:** Start with standard storage. Move to nearline/infrequent access when access patterns stabilize.
- **Databases:** Start with the smallest tier. Vertically scale when query performance degrades.
- **Warehouses:** Use auto-suspend aggressively. A Snowflake warehouse that runs 24/7 for queries that come in during business hours is wasting 16 hours of compute per day.

### The Per-Query Cost Mindset

BigQuery charges approximately $6.25 per TB scanned (on-demand pricing). A query that does `SELECT *` from a 2 TB table costs $12.50. The same query with column selection and a partition filter might scan 50 GB and cost $0.31. Same result. Forty times cheaper.

This is not optimization. This is basic hygiene. Know the cost of your most frequent queries. Partition your tables by the most common filter column (usually date). Cluster by the next most common filter columns. Materialize results that are queried repeatedly.

> [!important] The Cloud Cost Visibility Rule
> If you cannot answer "What does this pipeline cost per month?" within 60 seconds, you do not have adequate cost visibility. Set up billing alerts, per-project budgets, and cost dashboards before your first production deployment.

### Undifferentiated Heavy Lifting

Werner Vogels (Amazon CTO) uses the phrase "undifferentiated heavy lifting" to describe work that is necessary but does not create competitive advantage. Managing servers, patching operating systems, configuring load balancers — these are undifferentiated. Your company's unique data transformations, business logic, and analytical models — these are differentiated.

Use managed services for the undifferentiated work. Spend your engineering time on the differentiated work. Cloud Functions over self-managed servers. BigQuery over self-managed Hadoop. Cloud Composer over self-managed Airflow (unless the cost premium is truly unjustifiable).

### Decision Test

> [!question] Rule 7 Decision Test
> "What does this cost per month, and who approved that budget?" If nobody knows the answer to either question, you are one billing cycle away from a very unpleasant conversation.

---

## Rule 8: Test in Production (Safely)

This rule makes some people uncomfortable. Good. Discomfort with production testing usually means either (a) you do not have the safety mechanisms to do it well, or (b) you are conflating "testing in production" with "deploying untested code to production." They are very different things.

### The Principle

You cannot replicate production in a development environment. Not the data volumes. Not the timing. Not the edge cases. Not the concurrent access patterns. Not the network latency. Not the load. Your staging environment is a polite fiction — useful for catching obvious bugs but fundamentally unable to simulate the conditions where the subtle bugs live.

Densmore is blunt about this: pipelines must be tested where they run. The question is not whether to test in production, but how to test in production safely.

### The Safety Mechanisms

**Shadow pipelines (dark launches).** Run the new pipeline alongside the old one. Both process the same input. Only the old pipeline's output is used. Compare results. When the new pipeline's output matches for a sufficient period, switch over.

**Canary deployments.** Route a small percentage of traffic (or data) through the new version. Monitor error rates, latency, and output quality. Gradually increase the percentage. If anything degrades, roll back automatically.

**Feature flags.** Wrap new logic in a feature flag. Deploy the code to production but keep the flag off. Turn it on for a subset of pipelines or consumers. Monitor. Expand or roll back.

**Blue-green deployments.** Maintain two identical production environments. Deploy to the inactive one (green). Run validation. Switch traffic from blue to green. If anything goes wrong, switch back to blue.

**Version your data.** This is the data engineering equivalent of a deployment rollback. If your gold layer tables are versioned (by partition date, by snapshot ID, or by maintaining previous versions), a bad transformation can be fixed by reverting to the previous version while you investigate.

### The Rollback Imperative

Every production deployment — every one — must have a documented rollback plan. Not "we'll figure it out." Not "we'll restore from backup." A specific, tested plan:

1. What is the trigger for rollback? (Error rate above X, data quality check fails, SLA breach)
2. Who decides to roll back? (On-call engineer, team lead, automated system)
3. How is the rollback executed? (Switch blue/green, revert feature flag, restore from snapshot)
4. How long does rollback take? (This must be measured in minutes, not hours)
5. What data is affected? (Do consumers need to be notified? Do downstream systems need to reprocess?)

> [!warning] The 15-Minute Recovery Standard
> If your rollback takes more than 15 minutes, your deployment strategy is too risky for the rollback mechanism you have. Either make rollback faster or make deployments more conservative (smaller changes, more canary time, shadow pipelines).

### What This Does NOT Mean

Testing in production does not mean:
- Deploying code without any prior testing (unit tests, integration tests, code review still happen)
- Running experimental queries against production databases without resource limits
- Making schema changes to production tables without expand-and-contract
- Treating production as your development environment

It means: after all the testing you can do in non-production environments, you use safe deployment strategies to validate that the system works under real conditions before fully committing to the change.

### Decision Test

> [!question] Rule 8 Decision Test
> "If this fails in production, can I recover in under 15 minutes?" If yes, deploy with confidence. If no, add safety mechanisms until the answer is yes.

---

## Rule 9: Automate Everything You Do Twice

The first time you do something manually, you are learning. You are exploring the problem space, understanding the steps, feeling the edges. This is valuable. The second time you do it manually, you are wasting time. And you are creating a process that is invisible, unrepeatable, and untestable.

### The Principle

Manual processes have three fatal flaws:

1. **They are invisible.** Nobody knows the process exists until the person who does it is unavailable.
2. **They are unrepeatable.** No two manual executions are exactly identical. Small variations introduce small inconsistencies that accumulate.
3. **They are untestable.** You cannot write a test for a process that lives in someone's head and is executed through a GUI.

Automation solves all three: the process is defined in code (visible), executed identically every time (repeatable), and can be validated before execution (testable).

### The Automation Stack

| Domain | Manual Approach | Automated Approach |
|--------|----------------|-------------------|
| Infrastructure | Click through cloud console | Terraform, Pulumi, CloudFormation |
| Deployment | SSH into server, run commands | CI/CD pipeline (GitHub Actions, GitLab CI, Azure DevOps) |
| Scheduling | Remember to run the script | Cron, Airflow, Cloud Scheduler |
| Data validation | Manually spot-check results | dbt tests, Great Expectations, custom SQL assertions |
| Schema changes | Run ALTER statements by hand | Migration frameworks (Alembic, Flyway, dbmate) |
| Monitoring | Check dashboards periodically | Automated alerting (PagerDuty, Datadog, Cloud Monitoring) |
| Documentation | Write it once, forget to update | Auto-generated from code, schema, and metadata |

### Infrastructure as Code: Non-Negotiable

If your infrastructure is not defined in code, it does not exist in any reproducible sense. A Terraform configuration that creates your entire pipeline environment — databases, storage buckets, service accounts, network rules, monitoring dashboards — means:

- A new environment can be created in minutes, not days
- The production environment can be exactly replicated for testing
- Infrastructure changes are reviewed in pull requests, just like code
- Disaster recovery is "terraform apply" rather than "reconstruct from memory"

### The New Team Member Test

The best test of automation is onboarding. When a new team member joins:

- Can they set up their development environment by running a single script?
- Can they deploy to a test environment by pushing to a branch?
- Can they understand the pipeline by reading the DAG definition?
- Can they run the full pipeline locally (or in a dev environment) without asking anyone?

If any of these require tribal knowledge — "oh, you need to manually create that table first" or "you have to set that environment variable that isn't documented anywhere" — you have automation gaps.

> [!tip] The Bus Factor Automation Test
> If the person who built the pipeline is unavailable (vacation, sick, departed), can the rest of the team operate, debug, and deploy changes to the pipeline? If not, the automation is incomplete. See also: [Operability (Pillar 5)](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering).

### Decision Test

> [!question] Rule 9 Decision Test
> "Could a new team member reproduce this without asking me?" If the answer is no, the process needs to be automated and documented in code.

---

## Rule 10: Observability Is Not Optional

A pipeline without observability is not a pipeline. It is a hope. Hope is not a strategy.

### The Principle

If you cannot see it, you cannot fix it. If you cannot measure it, you cannot improve it. Every pipeline, every data flow, every transformation step needs enough instrumentation that when something goes wrong — and something will go wrong — you can answer three questions:

1. **What happened?** (Logs)
2. **When did it start?** (Metrics)
3. **Where did time go?** (Traces)

These are the three pillars of observability, and they apply to data engineering just as much as they apply to web services. See [Observability (Pillar 2)](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering). [DataOps](https://alp78.github.io/elysium/15-DataOps/dataops-principles-and-practices) codifies these rules into repeatable team practices — CI/CD for data, automated testing, and monitoring-as-code.

### The Minimum Observability Bar

Every pipeline in production must have, at minimum:

| Signal | Implementation | Why |
|--------|---------------|-----|
| **Success/failure alerting** | Pipeline completion status sent to Slack/PagerDuty/email | You should not learn about failures from downstream consumers |
| **Freshness tracking** | Timestamp of last successful load per table | Stale data is wrong data if consumers assume it is current |
| **Row count monitoring** | Expected vs actual row counts, with thresholds | A pipeline that succeeds but loads zero rows is a silent failure |
| **Schema change detection** | Compare current source schema to expected schema | Source changes break pipelines; early detection prevents data corruption |
| **Duration tracking** | Pipeline runtime over time | Gradual slowdowns indicate growing data, inefficient queries, or resource contention |
| **Data quality checks** | Null rates, uniqueness constraints, range validations | Bad data that passes through bronze to gold erodes trust in every report |

### The Cost of Missing Observability

The $50/month you save by skipping monitoring will cost you $50,000 in a missed SLA. This is not hyperbole. Here is the failure cascade:

1. Pipeline silently fails at 3 AM on a Saturday
2. Nobody notices until Monday morning when a dashboard shows stale data
3. Stakeholder reports the issue; engineering investigates
4. Root cause analysis reveals the failure happened 60 hours ago
5. All dashboards and reports generated since Saturday are potentially wrong
6. Trust in the data platform is damaged — this takes months to rebuild
7. Stakeholders start maintaining their own spreadsheets "just in case"
8. The data team now has two problems: fixing the pipeline and winning back trust

All of this is preventable with a $0.10 Cloud Monitoring alert that fires when the pipeline does not complete by 4 AM.

### Data Observability vs Infrastructure Observability

Traditional observability (Datadog, Prometheus, Grafana) monitors infrastructure: CPU, memory, disk, network, application error rates. Data observability monitors the data itself:

- **Freshness:** Is the data arriving on schedule?
- **Volume:** Are we getting the expected number of records?
- **Schema:** Has the structure of the data changed?
- **Distribution:** Are the values within expected ranges? Are null rates normal?
- **Lineage:** Where did this data come from, and what depends on it?

Both are necessary. Infrastructure observability tells you the pipeline ran. Data observability tells you the pipeline produced correct results.

> [!danger] The Silent Failure Problem
> The most dangerous pipeline failure is the one that does not throw an error. The pipeline runs, returns exit code 0, loads data into the table — but the data is wrong. Maybe the source sent an empty file. Maybe a filter condition excluded all rows. Maybe a type mismatch caused silent truncation. Only data quality checks catch these failures.

### Decision Test

> [!question] Rule 10 Decision Test
> "If this pipeline silently fails at 3 AM, how long until someone notices?" If the answer is "when a stakeholder complains on Monday," your observability is insufficient. The answer should be "within 15 minutes, because an alert fires."

---

### Data Engineering Anti-Patterns — What These Rules Prevent

These rules exist because each one was learned the hard way. The following table maps common anti-patterns to the rules they violate and the consequences they produce:

| Anti-Pattern | Violated Rule | What Happens | The Fix |
|---|---|---|---|
| **Resume-Driven Development** | Rule 1, Rule 2 | Overengineered stack nobody can maintain. Hiring becomes impossible because candidates need 15 niche skills. | Start from the business problem. Choose boring technology. Spend innovation tokens deliberately. |
| **Raw data thrown away after transform** | Rule 5 | Impossible to debug transformation bugs retroactively. Cannot meet new business requirements for historical data. Re-ingestion may be impossible. | Preserve bronze layer indefinitely. Compression over deletion. Storage is cheap. |
| **No monitoring** | Rule 10 | Silent failures. Stale dashboards. Stakeholders lose trust and build shadow data systems. Engineering learns about outages from business users. | Minimum observability bar for every pipeline. Alerting on failure, freshness, volume, and quality. |
| **Manual deployments** | Rule 9 | "It works on my machine." Inconsistent environments. Deployments that only one person can perform. Configuration drift between environments. | CI/CD for every deployment. Infrastructure as code. Automated testing in the deployment pipeline. |
| **Premature optimization** | Rule 6, Rule 4 | Complexity for problems that do not exist yet. Over-abstracted code. Systems designed for 10x scale that will never reach 2x. | YAGNI. Optimize when monitoring tells you to, not when imagination tells you to. |
| **Ignoring cloud costs** | Rule 7 | Surprise $20K bills. Budget fights with finance. Emergency cost-cutting that compromises reliability. | Cost dashboards. Per-query cost awareness. Right-sizing. Billing alerts. |
| **Tight coupling** | Rule 3 | One schema change cascades through every downstream system. Deployments require coordinated releases across teams. Testing requires the entire stack. | Loose coupling through interfaces. Expand-and-contract for schema changes. Contract testing. |
| **Big-bang migrations** | Rule 4, Rule 8 | All-or-nothing risk. No rollback. Extended downtime. If anything goes wrong, everything is wrong. | Incremental migration. Shadow pipelines. Blue-green cutover. Always have a rollback plan. |
| **Premature microservices** | Rule 6, Rule 2 | Distributed system complexity for a problem that fits in a monolith. Network calls where function calls would suffice. Debugging across service boundaries. | Start with a monolith. Extract services only when team boundaries or scale demand it. |
| **Goldplating** | Rule 1, Rule 6 | Features nobody asked for. Configuration options nobody uses. Abstraction layers that abstract nothing. Extra weeks of development for marginal benefit. | Build what is needed. Ship. Get feedback. Iterate. |

---

## Applying the Rules: A Decision Framework

When facing any architectural decision, run through this checklist:

### The Ten-Question Checklist

1. **Business value** (Rule 1): What business outcome does this serve? Can I explain it to a non-technical stakeholder?
2. **Technology choice** (Rule 2): Is this the simplest technology that solves the problem? Am I spending an innovation token, and is it justified?
3. **Change tolerance** (Rule 3): If requirements change next quarter, how much rework does this decision cause?
4. **Reversibility** (Rule 4): Is this a one-way or two-way door? Am I spending an appropriate amount of time given the reversibility?
5. **Data preservation** (Rule 5): Does raw data survive this architecture? Can I rebuild everything from source?
6. **Complexity budget** (Rule 6): Am I adding complexity? Is that complexity justified by a specific, current requirement?
7. **Cost awareness** (Rule 7): What does this cost per month? Is that proportionate to the value delivered?
8. **Production safety** (Rule 8): How will this be deployed? What is the rollback plan? How long does recovery take?
9. **Automation** (Rule 9): Will this require manual steps? If so, when will those be automated?
10. **Observability** (Rule 10): How will I know if this is working? How will I know if it fails?

> [!tip] The Architecture Review Shortcut
> You do not need to formally answer all ten questions for every decision. But if you cannot quickly answer any one of them, that is the question that needs the most attention. The gaps in your thinking are where the production incidents hide.

### The Rules in Tension

These rules sometimes pull in different directions. That is by design — engineering is the art of managing trade-offs, not eliminating them.

**Rule 2 (boring technology) vs Rule 3 (optimize for change):** Sometimes the boring technology is less flexible than the newer alternative. PostgreSQL is boring and great, but if your data access patterns genuinely need a document store, choosing PostgreSQL for boringness alone violates Rule 3. The resolution: use boring technology as the default, but upgrade when a specific, demonstrated requirement demands it.

**Rule 6 (simplicity) vs Rule 10 (observability):** Adding monitoring adds components, dashboards, alert rules, and dependencies. It adds complexity. But the complexity is justified because without it, you are flying blind. The resolution: observability complexity is the one form of complexity that always pays for itself.

**Rule 7 (cost) vs Rule 5 (raw data preservation):** Keeping all raw data forever costs money. But the cost of losing raw data (Rule 5) almost always exceeds the cost of storing it (Rule 7). The resolution: use lifecycle policies and cold storage tiers to manage cost, but do not delete raw data to save money.

**Rule 4 (decide quickly on reversible decisions) vs Rule 1 (serve the business):** Sometimes making a quick technology decision leads to a choice that does not optimally serve the business. The resolution: quick does not mean careless. The two-way door framework says to decide quickly, not blindly. Five minutes of thought is "quick" for a two-way door.

---

## The Philosophical Foundation

These rules, taken together, express a philosophy of data engineering that can be summarized in three statements:

### Data Engineering Is a Service Discipline

You exist to serve the people and systems that consume data. Your aesthetic preferences, your technology interests, your desire for intellectual challenge — these are valid human motivations, but they are not architectural requirements. The system that best serves its consumers is the right system, regardless of how it looks on a resume or how interesting it was to build.

### The Best System Is the One Nobody Thinks About

A truly well-engineered data platform is invisible. Data arrives on time. Dashboards are fresh. Reports are accurate. Queries are fast. Nobody pages the data team. Nobody asks "is this data right?" Nobody maintains a parallel spreadsheet.

This invisibility is the highest compliment. It means every rule was followed: the technology serves the business (Rule 1), the stack is maintainable (Rule 2), the architecture absorbs change (Rule 3), decisions were well-calibrated (Rule 4), raw data is safe (Rule 5), the system is appropriately simple (Rule 6), costs are proportionate (Rule 7), deployments are safe (Rule 8), processes are automated (Rule 9), and failures are detected before anyone notices (Rule 10).

### Every Decision Is a Trade-Off

There are no perfect architectures. There are no universally correct technology choices. There are only trade-offs — and the quality of an engineer is measured by how well they understand, communicate, and manage those trade-offs.

Kleppmann's entire book is organized around this principle. Every chapter presents a technology or approach, explains what it is good at, and then honestly explains what it sacrifices. CAP theorem is the most famous trade-off in distributed systems, but trade-offs exist at every level: cost vs performance, simplicity vs flexibility, speed vs correctness, automation vs human judgment.

The golden rules do not eliminate trade-offs. They give you a framework for navigating them. When you are unsure, they tell you which direction to lean. When trade-offs are in tension, they tell you which concerns take priority. And when the rules themselves conflict, they remind you that engineering judgment — informed by experience, context, and honest analysis — is the ultimate arbiter.

> [!abstract] The One Rule That Contains All the Others
> Build systems that serve the business, are simple enough to understand, cheap enough to justify, resilient enough to survive change, observable enough to trust, and automated enough to operate without heroics. Then go home and do something that is not data engineering. The best systems do not need you to be there.

---

## Related Notes

- [five-pillars-of-data-engineering](https://alp78.github.io/elysium/14-Data-Architecture/five-pillars-of-data-engineering) — The structural framework (reliability, observability, efficiency, security, operability) that these rules reinforce
- [idempotent-pipeline-design](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design) — The practical implementation of Rule 3's emphasis on safe re-execution
- [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) — The architectural pattern that embodies Rule 5's raw data preservation
- [context-and-metadata-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/context-and-metadata-architecture) — The metadata layer that supports Rule 10's observability requirements
- [data-warehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture) — The structural decisions (grain, dimensions, facts) where Rule 4's one-way door framework matters most
- [environment-management-strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — Dev/staging/prod separation strategy that implements Rule 9 (Automate Everything)
