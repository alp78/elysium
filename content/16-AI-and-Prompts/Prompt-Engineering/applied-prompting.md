---
title: "Applied Prompting"
tags: [ai, prompt-engineering, python, sql, terraform, airflow, bigquery]
aliases: [applied prompt engineering, prompt engineering examples, before after prompts, prompt optimization examples, research prompts, code generation prompts, data extraction prompts, content creation prompts]
description: "Applied prompt engineering with complete before/after examples for four core domains: research and analysis, content creation, code and technical tasks, and data analysis and extraction. Every example includes the weak prompt, the optimized prompt, and the principle behind the improvement."
parent: "[[domain-prompt-craft]]"
links:
  - "[[prompt-foundations]]"
  - "[[prompt-architecture]]"
  - "[[model-specific-prompting]]"
  - "[[prompt-debugging]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Applied Prompt Engineering: Research, Code Generation, Data Analysis, and Creative Workflows

> [!quote]
> "The quality of the output is determined by the quality of the input. Prompt engineering is the art of asking the right question in the right way."
>
> — **Lilian Weng**, OpenAI

This note converts the foundational principles from [prompt-foundations](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-foundations) and the structural patterns from [prompt-architecture](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-architecture) into concrete, domain-specific prompt workflows. Every section includes a weak "before" prompt, an optimized "after" prompt, and an explanation of what changed and why. These are not templates — they are worked examples that demonstrate the reasoning behind each design choice.

---

## Research and Analysis

**Domain:** Gathering, synthesizing, and evaluating information.

### Before (weak research prompt)

```
Tell me about the European stock market.
```

**Why it's weak:** No scope, no format, no depth, no time frame. The model will produce a generic textbook overview.

### After (optimized research prompt)

```
Role: Senior equity research analyst covering European markets.

Task: Provide a current-state analysis of the Euro market index index
focusing on sector rotation trends over the past 6 months.

Structure:
1. Which sectors gained weight and which lost weight (table)
2. Key macro drivers behind the rotation (3-4 bullet points)
3. Comparison with how the same sectors performed in the project USA 50
4. One contrarian observation most analysts are missing

Constraints:
- Use only publicly available data
- State your knowledge cutoff if relevant data is beyond it
- No generic disclaimers about "consulting a financial advisor"
```

**What changed:** Role narrows the vocabulary. Task is time-bound and specific. Structure prevents rambling. Constraints block boilerplate.

> [!tip] Research Prompt Structure
> For any research task, the four-element pattern — role, time-bound task, enumerated structure, anti-boilerplate constraints — consistently outperforms open-ended prompts. The "contrarian observation" element is especially valuable: it forces the model past surface-level synthesis into genuinely differentiated analysis.

---

## Content Creation

**Domain:** Writing text for a specific audience and purpose.

### Before (weak content prompt)

```
Write a blog post about data pipelines.
```

### After (optimized content prompt)

```
Write a technical blog post titled "Why Your Data Pipeline Needs
a Medallion Architecture."

Audience: Mid-level data engineers who have built pipelines but
haven't used the bronze/silver/gold pattern.

Structure:
- Hook: A real-world failure scenario (corrupted data reaching dashboards)
- Problem: Why single-layer pipelines break at scale
- Solution: Medallion pattern with concrete examples (use Python + SQL Server)
- Each layer (bronze, silver, gold): one paragraph + one code snippet
- Conclusion: When to use it, when it's overkill

Tone: Conversational but technical. Like a senior colleague explaining
over coffee, not a textbook. Use "you" and "we."

Length: 1200-1500 words.

Do NOT include: generic introductions ("In today's data-driven world..."),
calls to action, author bios, or SEO keywords.
```

> [!tip] Audience specification matters
>
> "Mid-level data engineers who have built pipelines but haven't used the bronze/silver/gold pattern" tells the model exactly what to include (practical implementation) and what to skip (why pipelines matter in the first place). Audience anchoring is one of the highest-ROI additions to a content prompt.

> [!info] Medallion Architecture
> The blog post example references [medallion architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) (bronze/silver/gold layers). This is a real pattern relevant to data engineering content — see the linked note for technical context that could ground your prompt.

---

## Code and Technical Tasks

**Domain:** Writing, reviewing, debugging, or explaining code.

### Before (weak code prompt)

```
Write a Python function to load data into SQL Server.
```

### After (optimized code generation prompt)

#### Write a Python upsert function for SQL Server using pyodbc with batch commits

```
Write a Python function `load_signals_daily(conn, df, index_key)`
that upserts rows from a pandas DataFrame into
`bronze.signals_daily` in SQL Server.

Requirements:
- Use pyodbc with parameterized queries (? placeholders)
- Upsert logic: INSERT if (symbol, date) not exists, UPDATE if values differ
- Batch commits every 5000 rows
- Wrap in try/except: rollback on failure, log the error, re-raise
- The function receives an open connection (don't create one)
- Return a dict: {"inserted": int, "updated": int, "skipped": int}

DataFrame columns: symbol, date, rsi_14, ma_50, ma_200,
analyst_target_upside, recommendation_mean

Table schema:
  symbol VARCHAR(20) NOT NULL
  date DATE NOT NULL
  rsi_14 FLOAT
  ma_50 FLOAT
  ma_200 FLOAT
  analyst_target_upside FLOAT
  recommendation_mean FLOAT
  index_key VARCHAR(50) NOT NULL
  loaded_at DATETIME2 DEFAULT GETUTCDATE()
  PRIMARY KEY (symbol, date, index_key)

Do not add logging, docstrings, or type hints beyond what's
functionally necessary.
```

> [!tip] Include the actual schema
>
> Paste the actual table schema. "A table with date, symbol, and metrics columns" produces generic code that won't match your primary key constraints or column types. The schema is the ground truth — include it verbatim.

> [!warning] The "Don't Add X" Constraint for Code
> Without "Do not add logging, docstrings, or type hints beyond what's functionally necessary," the model will produce a heavily annotated function twice as long as needed. Be explicit about what you do not want added.

> [!success] Fix: Add an Explicit Exclusion Block to Every Code Prompt
> End your code generation prompt with a dedicated "Do NOT include" section listing unwanted additions. Example: "Do NOT include: logging calls, docstrings, type hints beyond function signatures, try/except around the main logic, or inline comments for obvious operations." This single block cuts generated noise by 30–50% and produces code closer to your team's actual style guide.

### Code Review Prompt Pattern

#### Review for correctness bugs only (exclude style)

```
Review this REST API design for a stock data service.
Focus only on: 1) URL naming conventions, 2) HTTP method correctness,
3) error response consistency.
Do NOT suggest GraphQL, gRPC, or architecture changes.
Just review what's here.
```

**Principle:** Constraints prevent the model from "helpfully" redesigning everything instead of reviewing what you asked.

---

## Data Analysis and Extraction

**Domain:** Extracting structured information from unstructured text.

### Before (weak extraction prompt)

```
Analyze this financial report.
```

### After (optimized JSON extraction prompt)

#### Extract structured metrics from a quarterly financial report

```
Extract the following metrics from the attached quarterly report.
Return a JSON object for each metric.

Metrics to extract:
- Revenue (in millions, local currency)
- Operating margin (percentage)
- Free cash flow (in millions)
- Headcount change vs. prior quarter
- Forward guidance (raised/maintained/lowered/not mentioned)

Rules:
- If a metric is not explicitly stated, return null
- If a range is given (e.g., "revenue between 450-470M"), return
  the midpoint and note the range in a "note" field
- Dates should be ISO 8601 (YYYY-MM-DD)
- Do not calculate derived metrics — only extract what's stated

Output format:
{
  "company": "...",
  "period": "Q3 2025",
  "metrics": {
    "revenue_m": 462,
    "operating_margin_pct": 18.3,
    "fcf_m": null,
    "headcount_delta": -120,
    "guidance": "raised"
  },
  "notes": ["Revenue range 450-470M, midpoint used"]
}
```

> [!tip] Null Over Invention
> The instruction "If a metric is not explicitly stated, return null" is essential for extraction prompts. Without it, models will calculate, estimate, or infer metrics that weren't in the source — and you won't know. Explicit null semantics give you clean, trustworthy structured data.

> [!warning] Derived Metrics
> "Do not calculate derived metrics — only extract what's stated" prevents the model from silently computing values (e.g., subtracting costs to derive margin) when you expected direct extraction. Silent calculation produces data that looks correct but can't be traced back to the source.

> [!success] Fix: Distinguish Extracted vs. Computed Fields in the Schema
> Add a `"source": "extracted | computed"` field to every output schema. For extracted fields, require the model to include `"verbatim_quote": "..."` with the exact text from the source. For computed fields, include `"formula": "..."`. Any field returned with `source: computed` that you did not explicitly authorize should be treated as a hallucination risk and flagged for human review.

---

## Before/After Optimization Examples

Three additional optimization patterns with the principle behind each.

### Example 1: Vague to Specific — Anchor to Existing Knowledge

| Before | After |
|--------|-------|
| "Explain Kubernetes" | "Explain Kubernetes to a developer who uses Docker Compose for local dev and is about to deploy their first production app. Cover only: pods, services, deployments, and ingress. Skip theory — show the equivalent of what they already know in Compose." |

**Principle:** Anchor to the reader's existing knowledge. Constrain scope to what's immediately useful.

### Example 2: Missing Format — Force Structured Comparison

| Before | After |
|--------|-------|
| "Compare React and Svelte" | "Compare React and Svelte in a table with columns: Feature, React, Svelte, Winner. Cover: learning curve, bundle size, state management, ecosystem maturity, SSR support, hiring availability. After the table, write one paragraph on which to choose for a small team building a data dashboard." |

**Principle:** Tables force the model into structured comparison instead of meandering paragraphs.

### Example 3: No Constraints — Scope the Review

| Before | After |
|--------|-------|
| "Review my API design" | "Review this REST API design for a stock data service. Focus only on: 1) URL naming conventions, 2) HTTP method correctness, 3) error response consistency. Do NOT suggest GraphQL, gRPC, or architecture changes. Just review what's here." |

**Principle:** Constraints prevent the model from "helpfully" redesigning everything instead of reviewing what you asked.

> [!tip] The Downstream Use Principle
> All these optimization patterns share one meta-principle: telling the model what you'll do with the output shapes every subsequent decision. "I need this for a dashboard card" changes format. "This is for a technical blog post" changes tone and depth. "This feeds into a JSON parser" changes structure. Always include the downstream use. See [intent alignment](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-foundations#13-clarity-specificity-and-intent-alignment) for the theoretical grounding.

---

## Applied Prompting Checklist

Before sending any applied prompt, verify:

#### Research and analysis
- [ ] Role is domain-specific and time-bound
- [ ] Structure is enumerated (numbered steps or sections)
- [ ] Anti-boilerplate constraint is included ("no generic disclaimers")
- [ ] Comparison or contrarian element is requested if relevant

#### Content creation
- [ ] Audience is specified with their current knowledge level
- [ ] Tone is described with a concrete analogy (not just adjectives)
- [ ] Length is an explicit range (not "appropriate length")
- [ ] Prohibited content is listed explicitly

#### Code and technical
- [ ] Function signature is specified
- [ ] All column names, types, and constraints are included
- [ ] Error handling requirements are listed
- [ ] "Do not add X" clauses cover docstrings, type hints, logging
- [ ] Return type/format is specified

#### Data extraction
- [ ] Every field has null semantics defined
- [ ] Derived vs. extracted distinction is explicit
- [ ] Output format is shown as a complete JSON example
- [ ] Range/uncertainty handling is specified

---

## Related Notes

- [prompt-foundations](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-foundations) — The axioms and intent alignment principles behind these examples
- [prompt-architecture](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-architecture) — The 4-layer template used in the research and code prompts above
- [model-specific-prompting](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/model-specific-prompting) — How to adapt these prompts for Claude vs. GPT-4 vs. Gemini
- [prompt-debugging](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-debugging) — When these patterns don't work and how to diagnose why

## References

- [Anthropic Prompt Engineering Cookbook](https://github.com/anthropics/anthropic-cookbook)
- [OpenAI Cookbook](https://cookbook.openai.com/)
