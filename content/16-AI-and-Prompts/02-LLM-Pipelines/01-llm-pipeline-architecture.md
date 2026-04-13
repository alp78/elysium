---
title: "01 - LLM Pipeline Architecture"
tags: [ai, llm, pipelines]
created: 2026-04-13
updated: 2026-04-13
parent: "[[domain-ai-platform-patterns]]"
links:
  - "[[02-rag-retrieval-and-tool-use]]"
  - "[[03-modern-ai-tooling-landscape]]"
  - "[[01-ai-evaluation-and-quality-assurance]]"
  - "[[02-ai-observability-and-operations]]"
  - "[[01-ai-governance-and-security]]"
status: complete
---

# LLM Pipeline Architecture

> [!abstract]- Summary
>
> This note defines production LLM pipelines as controlled request, retrieval, inference, validation, and execution flows so AI features can be routed, replayed, and governed in analyst support, ESG extraction, and index-operations workflows.
>
> **Pipeline structure and control**
> - Defines the LLM pipeline as the full application path around a model call, then separates request path, retrieval path, and execution path so intent handling, evidence gathering, and side-effecting work are not blurred together.
> - Uses the three-path mental model to show where routing, validation, approval boundaries, and observability belong when the system must stay legible under missing data, provider issues, or ambiguous evidence.
>
> **Workflow patterns and architecture choices**
> - Covers interactive assistant, batch extraction and enrichment, tool-using, and hybrid pipeline shapes, including how conversation state, schema-bound outputs, checkpointing, and reviewer-facing responses change the design.
> - Distinguishes batch versus interactive operation and explains where retries, caching, idempotency, fallbacks, and safe degradation fit in production AI systems.
>
> **Production applications and evaluation**
> - Maps the pipeline patterns to ESG document ingestion, index-operations support, and AI-assisted data-quality triage, with emphasis on evidence retention, read-only tooling, and review packets instead of autonomous mutation.
> - Frames evaluation by stage across request classification, retrieval quality, extraction or answer quality, schema validity, tool-call correctness, escalation quality, latency, and route-level cost.
>
> **Operations and safety**
> - Warnings: ambiguous retrieval must not flow into actions, semantic mistakes should not be retried like transport failures, and duplicate-write risk remains unless idempotency is engineered outside the model.
> - Recommendations: design request, retrieval, and execution paths explicitly; keep validation deterministic where possible; choose batch, interactive, or hybrid architecture deliberately; and define safe degradation before incidents force it.
> - Troubleshooting: 4 failure modes covering unsupported output, timeout pressure, duplicate writes, and reviewer override that signals the execution path is overreaching.

> [!note]- Glossary
>
> **LLM pipeline**
> - The end-to-end workflow around a model call, including context assembly, routing, validation, fallbacks, and delivery or execution of the result.
> - It matters here because the note treats the pipeline, not the prompt or model in isolation, as the real production unit that must be designed and governed.
>
> > [!warning] Beyond one inference
> >
> > Pipelines fail at handoffs between stages as often as they fail inside generation, so a strong prompt alone does not make the system reliable.
>
> ---
>
> **Request path**
> - The part of the pipeline that accepts the incoming user request or system event, interprets intent, and applies the first routing and permission decisions.
> - It matters here because the rest of the pipeline inherits its task framing, so a bad request path cannot be rescued downstream by better retrieval.
>
> > [!warning] Intent errors propagate
> >
> > If the request is classified incorrectly at the start, every later stage will optimize for the wrong job.
>
> ---
>
> **Retrieval path**
> - The stage that gathers documents, records, metadata, or prior context to ground the model in evidence.
> - It matters here because evidence quality, source relevance, and citation integrity are established before the model begins to answer.
>
> > [!info] Evaluate separately
> >
> > Retrieval quality should be measured on its own instead of being hidden inside final answer scores.
>
> ---
>
> **Execution path**
> - The stage that handles tool calls, validators, approvals, and any workflow step that can change state or trigger operational side effects.
> - It matters here because this is where AI systems become operationally risky and where permission scoping has to be strongest.
>
> > [!warning] Action is the hazard
> >
> > Read-only assistance and state-changing execution should not share the same trust boundary.
>
> ---
>
> **Routing**
> - The logic that chooses which model, workflow branch, or fallback path should handle a request.
> - It matters here because production pipelines need to adapt by risk level, latency budget, and task type instead of treating every request the same.
>
> > [!info] Routing needs feedback
> >
> > A route is only useful if the team can later compare quality, latency, and cost for that choice.
>
> ---
>
> **Validation**
> - Deterministic checking of outputs, tool arguments, or state transitions outside the model itself.
> - It matters here because pipelines stay governable only when critical correctness checks are enforced by code or rules rather than by model self-assessment.
>
> > [!warning] Keep checks external
> >
> > If the model is asked to validate its own critical output, the system loses a reliable control layer.
>
> ---
>
> **Idempotency**
> - The property that rerunning the same operation does not create duplicate or inconsistent state.
> - It matters here because batch enrichment, retries, and replay all require stable write guards even when AI participates in the workflow.
>
> > [!warning] Retries can corrupt state
> >
> > Without deterministic idempotency keys, a transient retry can create duplicate records or duplicate downstream actions.
>
> ---
>
> **Safe degradation**
> - A planned fallback to a simpler or safer behavior when the preferred AI path is unavailable, uncertain, or too risky.
> - It matters here because resilient AI systems must remain usable during outages, weak evidence conditions, or provider failures.
>
> > [!info] Decide before incidents
> >
> > Safe degradation should be part of the design, not an emergency improvisation during a production outage.
>
> ---
>
> **Fallback**
> - An alternate route such as a smaller model, retrieval-only answer, deterministic template, or human review path that activates when the main path is unsuitable.
> - It matters here because fallbacks turn uncertainty or provider disruption into controlled behavior instead of silent failure or fabricated output.
>
> > [!info] Fallbacks need boundaries
> >
> > A fallback should clearly trade capability for safety or availability rather than hiding a degraded result behind the same interface.
>
> ---
>
> **Interactive assistant pipeline**
> - A low-latency workflow designed for chat, analyst support, or operator-facing question answering with conversation state and explicit escalation.
> - It matters here because interactive flows optimize for response speed, context control, and reviewer-facing usefulness rather than bulk throughput.
>
> > [!warning] Do not over-automate
> >
> > Interactive assistants should usually stop at explanation and recommendation unless a human has approved the next step.
>
> ---
>
> **Batch extraction and enrichment pipeline**
> - A queued or scheduled workflow that processes many records or documents with checkpointing, retries, and schema-bound outputs.
> - It matters here because extraction, classification, and enrichment tasks in ESG or data platforms need replayability and deterministic write behavior at scale.
>
> > [!info] Throughput changes design
> >
> > Batch systems can tolerate higher latency than chat systems, but they need stronger replay, monitoring, and idempotency controls.
>
> ---
>
> **Reviewer packet**
> - A structured set of findings, evidence, and suggested next checks prepared for a human reviewer instead of an automatic action.
> - It matters here because high-stakes workflows often need the AI system to accelerate review rather than make the final decision.
>
> > [!info] Assistive, not autonomous
> >
> > Reviewer packets preserve the productivity benefit of AI while keeping accountability with the operator or analyst.
>
> ---
>
> **Approval boundary**
> - The explicit point where a human or deterministic policy must authorize the workflow before state changes or high-stakes decisions can continue.
> - It matters here because approval boundaries keep assistive reasoning separate from autonomous execution in regulated or sensitive workflows.
>
> > [!warning] Hidden approval is no approval
> >
> > If a workflow implies approval without a visible checkpoint, operators cannot reliably tell when the system has crossed into action-taking behavior.


## Why this topic matters

The common failure in AI programs is to design the model call first and the system around it later. That produces applications that look capable in a demo but have no stable behavior under missing data, ambiguous retrieval, partial tool failure, or provider disruption.

Chroma sources and current platform guidance converge on the same production reality: robust LLM systems are multi-stage systems. They separate retrieval from generation, generation from validation, and assistive reasoning from autonomous action. That separation is what makes the pipeline testable and governable.

## Conceptual model / diagrams

The three-path view is a useful way to reason about where the real risk sits.

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
flowchart LR
    A[Incoming request or event] --> B[Request path]
    B --> C[Retrieval path]
    C --> D[Model inference]
    D --> E[Execution path]
    E --> F[Validation]
    F --> G[User response or system action]
```

## Core patterns or workflows

This section outlines the pipeline families that appear most often in production.

### Interactive assistant pipelines

These handle chat, analyst support, or operator assistance. They usually prioritize:

- latency-aware retrieval
- conversation state control
- reviewer-facing outputs
- explicit abstention or escalation paths

They are appropriate for QA, exception analysis, document interpretation, and investigation support.

### Batch extraction and enrichment pipelines

These process queues, documents, or datasets in bulk. They usually prioritize:

- deterministic batching and retry behavior
- schema-bound outputs
- checkpointing
- idempotent writes
- offline evaluation and replay

This pattern is a strong fit for ESG disclosure extraction, report classification, and metadata enrichment.

### Tool-using pipelines

These let the model trigger external functions or workflows. They should separate:

- tool selection
- tool argument validation
- tool execution
- result interpretation
- final user-facing response

That separation is critical because the model can be assistive during selection while deterministic code remains responsible for execution safety.

### Routing, retries, caching, and fallbacks

Production AI pipelines need the same resilience patterns as other data systems:

- **Routing** to choose the model or pathway by task type, risk level, and latency budget.
- **Retries** only for transient failures such as provider timeouts, not for semantically bad answers.
- **Caching** for embeddings, repeated retrieval results, and sometimes stable answers.
- **Fallbacks** to smaller models, retrieval-only answers, deterministic templates, or human review.

Safe degradation is especially important. If a benchmark-support assistant cannot explain a change confidently, it should produce a review packet or abstain, not fabricate continuity.

### Batch versus interactive design

Choose the mode based on the operational need:

- Use **interactive** flows for analyst support, investigations, or operator-facing copilots.
- Use **batch** flows for large-scale document processing, backfills, periodic enrichment, and nightly QA packs.
- Use **hybrid** designs when batch extraction creates structured records that later power interactive review.

In most regulated financial settings, hybrid designs are the safest because they separate heavy extraction from human review.

## Production examples

### ESG document-ingestion pipeline

An ESG batch pipeline often looks like:

- ingest reports and filings
- parse and chunk documents
- classify relevant disclosure sections
- extract structured fields with evidence
- validate schema and units
- route ambiguous cases to review
- write approved records to downstream stores

This pattern is better than asking an interactive chatbot to interpret an entire reporting corpus on demand.

### Index-operations assistant

An interactive benchmark assistant usually needs:

- a request path that defines the operator's question
- a retrieval path over methodology, corporate actions, and point-in-time files
- an execution path limited to read-only tools unless a human explicitly approves a next step
- a final answer that cites the rule, event, or uncertainty

### AI-assisted data-quality triage

For pipeline incidents, the assistant should:

- retrieve logs, lineage context, and rule failures
- draft likely causes and next checks
- never mutate production state automatically
- produce a reviewer packet that can be attached to the incident record

## Risks / anti-patterns

- Treating the model call as the pipeline and ignoring everything around it.
- Letting ambiguous retrieval results flow directly into autonomous actions.
- Retrying semantically bad answers as though they were transport errors.
- Skipping idempotency because the task is "just AI enrichment."
- Using agent-style execution paths where a retrieval or reviewer workflow would be safer.

## Recommendations / operating rules

- Design request, retrieval, and execution paths explicitly.
- Keep validation outside the model whenever deterministic checks are possible.
- Default high-stakes actions to human approval.
- Choose batch, interactive, or hybrid architecture deliberately.
- Log enough metadata to replay failures and compare versions.

## Domain-specific applications

- ESG analytics relies heavily on batch extraction, replayability, and evidence retention.
- Index engineering needs read-heavy retrieval, reviewer packets, and strict action boundaries.
- Data engineering copilots need assistive flows that stay inside existing observability and incident processes.

## Evaluation / validation considerations

Evaluate the pipeline by stage:

- request classification quality
- retrieval relevance
- extraction or answer quality
- schema validity
- tool-call correctness
- escalation quality
- latency and cost by route

If the system is judged only on the final prose answer, pipeline defects remain hidden.

## Troubleshooting / failure modes

- If the output is unsupported, inspect retrieval before rewriting the prompt.
- If the system times out, inspect routing, context size, and tool latency before changing models.
- If duplicate writes appear, the batch pipeline lacks deterministic idempotency.
- If reviewers keep overriding the assistant, the execution path is overreaching its approval boundary.

## Related notes

- [[02-rag-retrieval-and-tool-use]]
- [[03-modern-ai-tooling-landscape]]
- [[01-ai-evaluation-and-quality-assurance]]
- [[02-ai-observability-and-operations]]
- [[01-ai-governance-and-security]]
- [[01-ai-augmented-data-engineering]]

## References

- ChromaDB enrichment: `Designing Large Language Model Applications.epub`
- ChromaDB enrichment: `Raieli S. Building AI Agents.pdf`
- ChromaDB enrichment: `Ultimate Agentic AI with AutoGen for Enterprise Automation.epub`
- LangSmith | [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
