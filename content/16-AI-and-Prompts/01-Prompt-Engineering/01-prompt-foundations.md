---
title: "01 - Prompt Foundations"
tags: [ai, prompt-engineering]
aliases: [prompt engineering basics, prompt fundamentals, prompt principles, LLM input design, context hierarchy, token efficiency]
description: "Core principles of prompt engineering: what prompts are, how instruction hierarchy works, why grounding and output contracts matter, and how to write prompts that are understandable to both beginners and production systems."
created: 2026-03-22
updated: 2026-04-13
parent: "[[domain-prompt-craft]]"
links:
  - "[[02-prompt-architecture]]"
  - "[[03-applied-prompting]]"
  - "[[05-prompt-debugging]]"
status: complete
---

# Prompt Foundations

> [!abstract]- Summary
>
> This note establishes the production view of prompt engineering: prompts are instruction contracts that define task, evidence boundary, output shape, and uncertainty behavior so model outputs can be reviewed, validated, and safely embedded in larger workflows.
>
> **Prompt contract fundamentals**
> - Defines what a prompt is, how tokens and context windows shape prompt design, and why clarity, grounding, and explicit constraints matter more than clever phrasing.
> - Explains instruction hierarchy, context shaping, output contracts, and the role of examples or decomposition in making model behavior legible and repeatable.
>
> **Workflow fit and production use**
> - Shows how prompt foundations apply to ESG disclosure extraction, index-operations exception review, and other workflow-bound tasks where evidence boundaries and escalation behavior matter more than conversational polish.
> - Distinguishes assistive, evidence-backed prompting from open-ended prompting that leaves too much of the task definition to model inference.
>
> **Failure modes and evaluation signals**
> - Covers the foundational anti-patterns that create hallucination, schema drift, unsupported claims, unstable outputs, and unsafe prompt-layer confusion before retrieval, tooling, or model selection are even the main issue.
> - Connects foundational prompt quality to early metrics such as schema adherence, abstention quality, unsupported-claim rate, reviewer agreement, and run-to-run consistency.
>
> **Operations and safety**
> - Warnings: untrusted content must not be treated as policy, vague prompts increase hallucination risk, and fluent output is not evidence of grounded or safe behavior.
> - Recommendations: define the model's job, evidence boundary, output contract, and uncertainty behavior explicitly; separate policy from task data; and version prompts like code.

> [!note]- Glossary
>
> **Prompt**
> - The full instruction and context package sent to a model, not just the last user sentence.
> - It matters here because the note treats prompts as application-level contracts that define task, evidence, and output behavior.
>
> > [!info] More than wording
> >
> > In production, a prompt is part of the system design, so it should be reviewed, versioned, and tested instead of improvised per request.
>
> ---
>
> **Instruction contract**
> - The explicit specification of what the model should do, what it may use, and what kind of response it must produce.
> - It matters here because prompt engineering becomes reliable only when the task is expressed as a contract rather than as a vague request.
>
> > [!warning] Implicit contracts drift
> >
> > If the task boundary lives only in the writer's head, the model will fill the gap differently across runs and inputs.
>
> ---
>
> **Token**
> - A model-sized unit of text used to account for prompt and response length.
> - It matters here because token usage affects cost, latency, and how much relevant context can fit into a request.
>
> > [!warning] Budget starts at input
> >
> > Long prompts consume context and cost before the model has generated any useful output.
>
> ---
>
> **Context window**
> - The maximum amount of prompt, history, retrieval content, and tool output a model can process in one inference.
> - It matters here because prompt design has to choose which evidence to include and which to leave out.
>
> > [!info] Bigger is not cleaner
> >
> > A larger context window helps only when the added material is relevant; irrelevant context still dilutes the signal.
>
> ---
>
> **Instruction hierarchy**
> - The layered priority order in which system instructions, task instructions, context inputs, and history influence model behavior.
> - It matters here because stable policy and volatile request data belong in different prompt layers if the system is expected to behave consistently.
>
> > [!warning] Do not let context impersonate policy
> >
> > Untrusted retrieved or user-provided text should never be mixed into the highest-priority instruction layer.
>
> ---
>
> **Grounding**
> - Constraining the model to supplied evidence, tools, or records instead of allowing unsupported recall to drive the answer.
> - It matters here because grounded prompting is the main control against hallucinated claims in production workflows.
>
> > [!warning] Evidence can still be bad
> >
> > Grounding improves auditability, but it does not guarantee correctness if the supplied evidence is stale, partial, or wrong.
>
> ---
>
> **Evidence boundary**
> - The explicit limit on which documents, records, snippets, or tool outputs the model is allowed to rely on.
> - It matters here because many prompt failures are actually failures to define where valid evidence stops.
>
> > [!info] Boundaries create auditability
> >
> > If reviewers cannot tell what the model was allowed to use, they cannot explain or trust why it answered the way it did.
>
> ---
>
> **Context shaping**
> - The process of choosing which facts to include, exclude, emphasize, or ignore in the prompt context.
> - It matters here because good prompting depends as much on controlled omission as on inclusion.
>
> > [!warning] More context can be worse
> >
> > Adding loosely relevant material often changes the model's task interpretation rather than improving answer quality.
>
> ---
>
> **Output contract**
> - The required response shape, such as narrative sections, labels, ranked items, JSON fields, or evidence-backed tables.
> - It matters here because the model should not have to invent both the answer and the structure of the answer at the same time.
>
> > [!info] Shape supports validation
> >
> > Structured or tightly sectioned outputs are easier to parse, test, and route than freeform prose.
>
> ---
>
> **Decomposition**
> - Splitting a multi-step task into separate stages instead of asking the model to retrieve, reason, classify, and decide in one response.
> - It matters here because staged tasks are easier to debug and safer to validate than monolithic prompts.
>
> > [!info] Stage failures separately
> >
> > If extraction, reasoning, and decisioning are separated, each stage can have its own validator and escalation rule.
>
> ---
>
> **Hallucination**
> - A fluent but unsupported or false output generated without adequate evidence.
> - It matters here because hallucination is one of the main reasons prompt design must include evidence boundaries, abstention rules, and downstream checks.
>
> > [!danger] Confidence is not proof
> >
> > Hallucinated outputs often sound more authoritative when the task is vague, which makes them especially risky in analyst-facing workflows.
>
> ---
>
> **Abstention behavior**
> - The rule that tells the model when to say `unknown`, decline to infer, or escalate instead of fabricating an answer.
> - It matters here because safe prompts need failure behavior, not just success behavior.
>
> > [!warning] Silence is sometimes correct
> >
> > A system that cannot admit uncertainty will often produce polished guesses exactly where the workflow most needs caution.


## Why this topic matters

Prompt engineering is often framed as a collection of tricks. That framing is wrong for production work. The real job is to make model behavior legible enough that a human reviewer, an eval suite, and a downstream system can all understand what the model was asked to do.

Chroma enrichment repeatedly surfaced the same pattern across prompt-engineering and LLM-application sources: useful prompts combine three things clearly, namely the instruction, the relevant context, and the required output shape. Current Anthropic guidance reinforces that prompt work should begin only after the team has defined success criteria and a way to test them empirically, which is the correct production starting point rather than ad-hoc chatting.

## Conceptual model / diagrams

The prompt is only one layer of the full inference context, but it is the layer where the application turns business intent into model-readable structure.

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
    A[Business intent] --> B[Prompt contract]
    B --> C[Model inference]
    C --> D[Raw output]
    D --> E[Validation and routing]
    E --> F[Human use or system action]
```

## Core patterns or workflows

This section defines the prompt-level concepts that stay relevant even when the model, provider, or framework changes.

### Instruction hierarchy

Models do not treat every input line equally. They process a layered instruction hierarchy:

- **System or application instructions** define the enduring behavior, allowed tools, safety boundaries, and output constraints.
- **Task instructions** describe what the current request is actually trying to achieve.
- **Context inputs** provide the evidence or data needed for the task.
- **Conversation history** adds continuity, but only if it remains relevant and well-managed.

The practical rule is simple: stable policy belongs high in the hierarchy, volatile request data belongs low in the hierarchy, and untrusted content should never be allowed to masquerade as policy.

### Context shaping

Good prompts control both inclusion and exclusion. The prompt should include the facts that matter and exclude distracting or unsafe material that changes the model's interpretation of the task.

Context shaping usually means:

- specifying the business objective
- naming the evidence source the model may use
- defining what the model must ignore
- stating when the model must admit uncertainty
- constraining the response format

In ESG and index workflows, context shaping is often the difference between "summarize this report" and "extract only auditable fields from the provided document fragment and return `unknown` when the value is not explicit."

### Output contracts

A prompt without an output contract forces the model to decide both the answer and the shape of the answer. That is wasteful. The prompt should tell the model what the deliverable is:

- narrative explanation
- classification label
- ranked list
- structured JSON object
- evidence-backed table
- tool selection request

When the output feeds a pipeline, the contract should be as machine-readable as the task allows. Chroma results and current provider guidance both point in the same direction here: structured outputs, schemas, and explicit field descriptions materially reduce downstream ambiguity.

### Examples and decomposition

Examples help the model infer the expected level of detail, tone, and transformation pattern. Decomposition helps the model handle multi-step tasks without blending extraction, reasoning, and decisioning into one opaque response.

Use examples when:

- the desired transformation is easier to show than describe
- the difference between good and bad output is subtle
- the output must follow a narrow house style or schema

Use decomposition when:

- the task mixes retrieval, interpretation, and scoring
- the task can fail independently at different stages
- you need separate validation for each stage

For production pipelines, decomposition at the application layer is usually safer than asking the model to do everything in one monolithic prompt.

## Production examples

These examples show how prompt foundations become operational rules rather than generic wording advice.

### ESG disclosure extraction

An unsafe prompt says "read this sustainability report and summarize emissions." A production-safe prompt says:

- extract only emissions values explicitly stated in the supplied pages
- return source snippets or page references with each field
- distinguish issuer-level values from segment-level values
- use `unknown` when the document is silent
- do not infer totals from unrelated metrics

The second version is better not because it is longer, but because it defines the evidence boundary and failure behavior.

### Index operations exception review

An unsafe prompt says "explain why the index changed." A production-safe prompt says:

- compare yesterday's and today's constituent files
- use the supplied methodology excerpt and corporate actions feed only
- classify the change as expected, suspicious, or unsupported
- name the rule or event that explains the change
- escalate to human review if the rule mapping is unclear

That prompt keeps the model in an assistive role instead of letting it invent rationale for benchmark-affecting changes.

## Risks / anti-patterns

- Treating prompt engineering as a substitute for missing data contracts, retrieval, or validation logic.
- Asking for precision without specifying the evidence source or output shape.
- Hiding several separate jobs inside one prompt, then being unable to tell which step failed.
- Letting retrieved text or user input override policy-level instructions.
- Rewarding fluent narrative when the actual business need is a checked field or decision recommendation.

## Recommendations / operating rules

- Write prompts as if a future engineer will have to debug them without you present.
- Define the model's job, evidence boundary, output contract, and uncertainty behavior explicitly.
- Prefer deterministic post-validation over persuasive prompt wording.
- Separate policy, task, evidence, and user data into different layers.
- Version prompts and test them against known cases before rollout.

## Domain-specific applications

Prompt foundations matter most when the task uses ambiguous language from documents or human analysts:

- ESG report extraction where the model has to distinguish policy statements from measurable disclosures.
- Corporate actions parsing where terms like split, bonus, spin-off, and tender can be confused if the evidence boundary is weak.
- Data-quality incident support where the model must explain anomalies without being allowed to mutate production data or override deterministic rules.

## Evaluation / validation considerations

Foundational prompt quality is visible in early metrics:

- schema adherence
- unsupported-claim rate
- abstention quality when evidence is missing
- reviewer agreement on whether the answer addressed the actual task
- consistency across repeated runs with stable settings

If these fail, changing the model rarely fixes the real problem. The prompt contract is still underspecified.

## Troubleshooting / failure modes

- If the output is fluent but irrelevant, the task statement is underspecified.
- If the output is plausible but unsupported, the evidence boundary is underspecified.
- If the output is structurally inconsistent, the output contract is underspecified.
- If the answer changes sharply with small wording changes, the prompt relies on implicit assumptions the model is filling differently each time.
- If the model follows malicious text found in retrieved content, the system has confused untrusted context with trusted instructions.

## Related notes

- [[02-prompt-architecture]]
- [[03-applied-prompting]]
- [[04-model-specific-prompting]]
- [[05-prompt-debugging]]
- [[01-llm-pipeline-architecture]]
- [[01-ai-governance-and-security]]

## References

- ChromaDB enrichment: `Prompt Engineering for LLMs The Art and Science of Building Large Language Model-Based Applications.epub`
- ChromaDB enrichment: `Prompt Design Patterns Mastering the Art and Science of Prompt Engineering.epub`
- ChromaDB enrichment: `Google Prompt Engineering - 2025.pdf`
- Anthropic | [Prompt engineering overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview)
- OWASP | [Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
