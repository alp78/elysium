---
type: concept
category: prompt-engineering
technology: [claude, gpt-4, gemini, grok, llm]
tags: [ai, prompt-engineering]
aliases: [prompt engineering basics, prompt fundamentals, prompt principles, LLM input design, context hierarchy, token efficiency]
keywords: [prompt engineering, context hierarchy, system prompt, user prompt, token efficiency, clarity, specificity, intent alignment, ambiguity, structure, reasoning, creativity, factuality, completion engine, context window, front-load]
description: "Core principles of prompt engineering: the three axioms of LLM completion, the four-level context hierarchy (system → user → history → model knowledge), and how to achieve clarity, specificity, and intent alignment. Covers how prompt structure shapes reasoning, creative, and factual outputs."
related: [prompt-architecture, model-specific-prompting, applied-prompting, prompt-debugging]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Prompt Engineering Foundations: Core Principles, Context Hierarchy, Clarity, and Structure

Prompt engineering is the practice of designing inputs to AI models that produce predictable, high-quality outputs. It is not about tricks or hacks — it is about understanding how language models process instructions and structuring your communication accordingly. This note covers the foundational layer: the axioms that govern model behavior, the context hierarchy every prompt operates within, and how structure shapes the type of output you receive.

---

## Core Principles of Prompt Engineering

#### Three axioms

1. **Models are completion engines.** They predict what text should come next given everything before it. Your prompt is the "everything before." The better you set the stage, the better the performance.

2. **Ambiguity is the enemy.** A model will fill gaps with its best guess. If your prompt leaves room for interpretation, the model will interpret — and often not the way you intended.

3. **Structure is leverage.** A well-organized prompt outperforms a longer, rambling one. Structure reduces ambiguity and guides the model's attention to what matters.

> [!tip] The Core Mental Model
> Think of every prompt as setting a stage. You're writing the first act of a play. The model improvises from where you leave off — so the more precisely you set the scene, the more predictable (and useful) the improvisation.

---

### Context Hierarchy and Priority Levels

Every prompt operates within a context hierarchy. Understanding this hierarchy is essential because it determines what the model pays attention to and what it deprioritizes.

```
System Prompt (highest authority)
  └── Defines role, rules, constraints, tone
      └── User Prompt (task-level instructions)
          └── Defines what to do, with what data, in what format
              └── Conversation History (accumulated context)
                  └── Prior messages, corrections, clarifications
                      └── Model Knowledge (lowest authority)
                          └── Training data, general world knowledge
```

**Key insight:** When instructions conflict across levels, higher levels win. A system prompt saying "never use bullet points" overrides a user prompt saying "list the items." Understanding this hierarchy is critical when designing multi-turn conversations or agent systems.

**Context window is finite.** Every model has a maximum number of tokens it can process at once. As conversations grow, older context is compressed or dropped. Front-load the most important instructions — don't bury critical constraints at the end.

| Level | Controls | Persistence |
|-------|----------|-------------|
| System prompt | Role, rules, tone, boundaries | Entire conversation |
| User prompt | Task, data, format | Single turn |
| Conversation history | Accumulated Q&A, corrections | Decays as context fills |
| Model knowledge | Facts, patterns, language | Static (training cutoff) |

> [!warning] Context Decay
> As a conversation grows long, the model's effective "memory" of earlier instructions degrades. This is why critical constraints must appear in the system prompt (highest persistence), not just as a one-time user message. See [[prompt-debugging]] for how to reinforce constraints mid-conversation.

> [!info] Multi-Agent Context
> In [[prompt-debugging#5.1 Workflows Loops and Multi-Agent Systems|multi-agent systems]], each agent has its own context hierarchy. A sub-agent's system prompt is set by the orchestrator — not the human user. This matters for designing agent architectures.

---

## Clarity, Specificity, and Intent Alignment

**Clarity** means the model cannot misinterpret what you're asking. **Specificity** means the model knows exactly how far to go. **Intent alignment** means the output serves your actual goal, not just the literal request.

### Clarity: Eliminating Ambiguity

| Unclear | Clear |
|---------|-------|
| "Tell me about Python" | "Explain Python's GIL and how it affects multi-threaded CPU-bound workloads" |
| "Make this better" | "Rewrite this paragraph to be more concise — remove filler words, combine redundant sentences, keep the same meaning" |
| "Help with my code" | "This Python function raises a KeyError on line 12 when the input dict is missing the 'name' key. Add a guard clause that returns None instead" |

### Specificity: Defining Scope, Format, and Depth

Specificity is about **scope, format, and depth**:

- **Scope:** "Summarize this article" vs. "Summarize this article in 3 bullet points, each under 20 words, covering only the financial impact"
- **Format:** "Give me a list" vs. "Give me a markdown table with columns: Term, Definition, Example"
- **Depth:** "Explain DNS" vs. "Explain DNS to a senior backend engineer who understands TCP/IP but has never configured DNS records"

### Intent Alignment: Matching Output to Actual Need

Sometimes what you ask for is not what you actually need:

| What you asked | What you meant | Better prompt |
|----------------|----------------|---------------|
| "Write a README" | A README that matches my project structure | "Write a README for this repo. Here is the file structure: [tree]. Cover: what it does, how to run, how to deploy." |
| "Optimize this query" | Make it faster for my specific data distribution | "This SQL query runs in 12s on a table with 50M rows. The WHERE clause filters on `created_at` (indexed) and `status` (not indexed). Suggest optimizations." |
| "Review my code" | Find bugs, not style issues | "Review this code for correctness bugs only. Ignore style, naming, and formatting. Focus on logic errors, edge cases, and potential runtime exceptions." |

> [!tip] Always State the Downstream Use
> Tell the model what you'll **do** with the output. "List the top 10 stocks by market cap" produces a plain list. "List the top 10 stocks by market cap — I need this for a dashboard card" produces output shaped for that use. See [[applied-prompting#3.4 Data Analysis and Extraction|data extraction examples]] for more.

---

## How Structure Affects Reasoning, Creativity, and Factuality

The structure of your prompt directly shapes the type of output you get. This is not metaphorical — different structures activate different patterns in how the model generates text.

### Reasoning Tasks: Explicit Step-by-Step Instructions

**Reasoning tasks** benefit from explicit step-by-step instructions:

```
Analyze whether Company X should enter the Japanese market.

Think through this step by step:
1. Market size and growth trajectory
2. Competitive landscape (existing players, barriers to entry)
3. Regulatory environment
4. Company X's current capabilities vs. market requirements
5. Financial projection (best case, worst case, expected)
6. Final recommendation with confidence level
```

### Creative Tasks: Constraints That Channel Creativity

**Creative tasks** benefit from constraints that channel creativity, not remove it:

```
Write a product description for a noise-cancelling headphone.

Constraints:
- Tone: premium but approachable (think Apple, not luxury watch)
- Length: exactly 3 sentences
- Must mention: battery life, comfort, sound quality
- Must NOT mention: competitors, price, technical specs
- End with a subtle call to action that doesn't feel like one
```

> [!tip] Constraints Unlock Creativity
> Counter-intuitively, giving the model more constraints for creative tasks produces better output than giving it freedom. Open-ended creative prompts produce generic output; constrained ones produce distinctive output.

### Factual Tasks: Source Grounding and Uncertainty Handling

**Factual tasks** benefit from grounding and source awareness:

```
Based ONLY on the following financial report excerpt, answer the question.
Do not use outside knowledge. If the answer is not in the text, say
"Not found in the provided data."

[paste report excerpt]

Question: What was the year-over-year revenue growth in Q3?
```

### Summary: Structure by Task Type

| Goal | Structure that helps | Structure that hurts |
|------|---------------------|---------------------|
| Reasoning | Step-by-step, numbered stages, "think before answering" | Open-ended "what do you think" |
| Creativity | Constraints, persona, tone, anti-examples | Over-specification, rigid templates |
| Factuality | Source grounding, "only use X," explicit uncertainty handling | No source context, no uncertainty framing |

> [!warning] Hallucination Risk on Factual Tasks
> Without source grounding, models will confidently invent facts. Always include "use only the provided data" and "say 'unknown' if unsure" for any factual extraction task. See [[prompt-debugging#4.1 Diagnosing Weak Outputs|diagnosing hallucinated facts]] for the full fix.

---

## Related Notes

- [[prompt-architecture]] — The 4-layer structural system (Role, Goal, Constraints, Format) that operationalizes these foundations
- [[model-specific-prompting]] — How Claude, GPT-4, Gemini, and Grok respond differently to structure
- [[applied-prompting]] — Research, code, data extraction, and content creation workflows
- [[prompt-debugging]] — Diagnosing and fixing weak prompts; building prompt systems

## References

- [Anthropic Claude Documentation](https://docs.anthropic.com)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Quartz v4 FlexSearch](https://quartz.jzhao.xyz/) — search optimization principles applied here mirror prompt optimization
