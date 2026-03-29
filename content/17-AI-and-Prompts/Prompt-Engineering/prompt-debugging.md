---
type: troubleshooting
category: prompt-engineering
technology: [claude, gpt-4, gemini, grok, llm]
tags: [ai, prompt-engineering]
aliases: [prompt debugging, prompt optimization, weak output diagnosis, intent misalignment, prompt system design, multi-agent prompting, prompt library, prompt mastery, feedback loop prompting, iterative refinement, memory layering, prompt workflows, prompt anti-patterns]
keywords: [prompt debugging, diagnosing weak outputs, intent misalignment, rebuilding prompts, contextual reinforcement, phrasing rephrasing, logic steps, cross-model testing, consistency, workflows chains loops, multi-agent systems, planner researcher executor reviewer, memory layering, iterative refinement, feedback integration, prompt library, meta-analysis, mastery checklist, anti-patterns, universal modifiers, 4-layer template, quick reference, CLAUDE.md, memory file]
description: "Complete guide to debugging weak AI prompts, diagnosing output failures, rebuilding prompts with three techniques (rephrasing, logic steps, contextual reinforcement), and designing prompt systems including workflows, loops, multi-agent architectures, memory layering, and feedback loops. Includes the full mastery checklist and prompt library structure."
related: [prompt-foundations, prompt-architecture, model-specific-prompting, applied-prompting]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Prompt Debugging, Optimization, and System Design

This note covers the diagnostic and system-level layer of prompt engineering: identifying why prompts fail, rebuilding them systematically, designing prompt workflows and multi-agent systems, managing memory across long conversations, and building a reusable prompt library. It also includes the full mastery checklist and quick reference card. For foundations, see [[prompt-foundations]]; for structural patterns, see [[prompt-architecture]].

---

## Debugging and Optimization

### Diagnosing Weak Outputs

When a model produces poor output, the problem is almost always in the prompt, not the model. Diagnose systematically:

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Too generic | Prompt lacks specificity | Add audience, depth, examples |
| Too long/verbose | No length constraint | Add "maximum N words/sentences/bullet points" |
| Wrong format | No format instruction | Add explicit format block with example |
| Off-topic drift | Goal is buried or unclear | Move the core task to the first sentence |
| Hallucinated facts | No grounding or uncertainty instruction | Add "only use provided data" + "say 'unknown' if unsure" |
| Contradicts itself | Conflicting instructions | Review prompt for ambiguity, test each section independently |
| Ignores a constraint | Constraint is too subtle or late | Move constraints to early in the prompt, use bold/caps for critical ones |
| Output is correct but unusable | Intent misalignment | Rethink what you actually need, not what you asked for |

> [!tip] Prompt First, Model Second
> Before blaming the model, audit the prompt. 90% of weak outputs have a diagnosable prompt cause. Use the symptom table above as a triage checklist before switching models or adding tokens.

---

> [!warning] Increasing Token Count Rarely Fixes a Broken Prompt
> When output is poor, the instinct is to add more instructions. But a 2,000-token prompt with contradictory constraints produces worse output than a 500-token prompt with clear structure. Before adding tokens, audit the existing prompt for (1) conflicting instructions, (2) buried goals, and (3) missing format specifications. Removing noise is often more effective than adding signal.

### Intent vs. Output Misalignment

The most subtle prompt failure is when the output is **technically correct but doesn't serve your goal.** This happens when you describe the task but not the purpose.

#### Example of intent misalignment

```
Prompt: "List the top 10 stocks by market cap in the Euro market index."
Output: A correct list of 10 stocks.
Problem: You wanted to display them in a dashboard card with flags
and price changes — a plain list is useless.
```

#### Fix — include the downstream use — Intent vs. Output Misalignment

```
"List the top 10 stocks by market cap in the Euro market index.
I need this for a dashboard card. For each stock include: symbol,
company name, country (ISO 2-letter code), market cap in billions,
and day change %. Format as a markdown table sorted by market cap desc."
```

**Principle:** Always tell the model **what you'll do with the output.** This context shapes every formatting and content decision.

> [!warning] The Most Expensive Mistake
> Intent misalignment is expensive because the output looks plausible. You spend time reviewing "correct" content before realizing it can't be used. Always specify the downstream use — whether that's a dashboard, a JSON parser, a client presentation, or a code file.

---

### Rebuilding Prompts: Phrasing, Logic Steps, Reinforcement

When a prompt isn't working, don't just add more words. Rebuild it using three techniques:

#### Technique 1: Rephrase for the Model's Strengths

Models are better at some framings than others:

| Weaker framing | Stronger framing |
|---------------|-----------------|
| "Don't be verbose" | "Maximum 3 sentences" |
| "Be accurate" | "Use only the provided data. If unsure, say 'insufficient data'" |
| "Write good code" | "Write code that handles: empty input, null values, and network timeouts" |
| "Be creative" | "Give me 5 different approaches, from conventional to unusual" |

**Why:** Negative instructions ("don't do X") are weaker than positive instructions ("do Y instead"). Specific metrics ("3 sentences") are stronger than adjectives ("concise").

#### Technique 2: Add Explicit Logic Steps

When the model skips reasoning or jumps to conclusions, add numbered steps:

#### Before — Rebuilding Prompts: Phrasing, Logic Steps, Reinforcement
```
Should we migrate from Cloud SQL to a self-hosted VM?
```

#### After — explicit logic steps for Cloud SQL vs VM migration analysis
```
Evaluate migrating from Cloud SQL to a self-hosted SQL Server VM.

Step 1: List the current Cloud SQL costs (assume db-custom-1-3840, 10GB SSD)
Step 2: Estimate equivalent VM costs (e2-medium, 30GB pd-ssd, europe-west1)
Step 3: Compare operational overhead (backups, patching, monitoring)
Step 4: Identify risks of each approach
Step 5: Recommendation with break-even timeline
```

> [!tip] Chain of Thought as a Debugging Tool
> When you don't know *why* the model is wrong, ask it to show its work: "Walk me through your reasoning step by step before giving the final answer." The reasoning trace often reveals the incorrect assumption.

#### Technique 3: Contextual Reinforcement

When the model drifts from a constraint mid-output, reinforce the constraint at multiple points — both early and late in the prompt:

#### Prompt with contextual reinforcement for bug-only code review
```
Role: You are a code reviewer. You ONLY review for bugs.

Task: Review this function.

Rules:
- Only flag correctness bugs (logic errors, edge cases, race conditions)
- Do NOT comment on style, naming, formatting, or documentation
- If there are no bugs, say "No bugs found" and nothing else

Remember: style and naming feedback is explicitly excluded from this review.
```

The last line is **contextual reinforcement** — restating a critical constraint near the end of the prompt, where it has the strongest influence on the beginning of the output.

> [!tip] Why Reinforcement Works
> Models weight content near the beginning of their output generation most heavily against the most recent context. The final sentence before the task body is the last thing the model "reads" before generating — so a constraint restatement there directly influences the opening lines of the response.

---

### Testing Across Models and Measuring Consistency

A robust prompt should produce acceptable output across multiple models. If it only works on one model, it's likely over-fitted to that model's quirks.

#### Testing Protocol

1. **Baseline:** Run the prompt on your primary model. Score the output 1-5 on: accuracy, format compliance, constraint adherence, usefulness.
2. **Cross-model:** Run the exact same prompt on 2-3 other models.
3. **Compare:** If another model fails, identify which part of the prompt was model-dependent.
4. **Generalize:** Refactor the prompt to be model-agnostic (usually means making implicit assumptions explicit).

#### Consistency Checklist

| Dimension | Test |
|-----------|------|
| Format | Does every model return the same structure? |
| Length | Are outputs within 50% of each other in word count? |
| Factual | Do all models agree on verifiable facts? |
| Interpretation | Do all models interpret ambiguous instructions the same way? |
| Constraints | Do all models respect every constraint? |

If any dimension fails, the prompt needs tightening in that area — not model-specific tuning.

For model-specific strengths and preferred formats, see [[model-specific-prompting]].

---

## System Design Thinking

### Workflows, Loops, and Multi-Agent Systems

A single prompt handles a single task. **Prompt systems** handle workflows — sequences of tasks where the output of one prompt feeds into the next.

#### Linear Workflows (Chains)

#### Example: Earnings newsletter generation chain

```
Prompt 1: "Extract all company names and tickers from this earnings calendar."
    → Output: JSON list of {name, ticker}

Prompt 2: "For each company, generate a one-paragraph earnings preview
           using the provided analyst consensus data."
    → Output: Array of previews

Prompt 3: "Compile these previews into a formatted newsletter with
           sections grouped by sector."
    → Output: Final newsletter
```

**Why chain instead of one prompt?** Each step is testable, debuggable, and replaceable independently. If the extraction step fails, you fix it without touching the newsletter formatting.

#### Loops (Iterative Refinement)

#### Example: Iterative product description refinement loop

```
Prompt: "Write a product description."
    → Output: First draft

Prompt: "Evaluate this description against these criteria:
         [accuracy, tone, length, CTA clarity]. Score each 1-5."
    → Output: Scores + feedback

Prompt: "Rewrite the description incorporating this feedback:
         [paste feedback]. Keep everything scored 4+ unchanged."
    → Output: Improved draft

(Repeat until all scores >= 4)
```

**Key principle:** The evaluation prompt must be **different from the generation prompt.** A model evaluating its own output with the same framing tends to confirm itself. Change the role: if the generator is a "copywriter," make the evaluator a "brand manager."

> [!warning] Self-Evaluation Bias
> Never use the same role and framing for both generation and evaluation. The model will find its own output acceptable. Use a different persona with different evaluation criteria. This is the single most common error in loop-based prompt systems.

#### Multi-Agent Systems

In agent architectures, different prompts act as specialized workers:

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| **Planner** | Break task into steps | User request | Ordered task list |
| **Researcher** | Gather information | Task from planner | Facts, data, context |
| **Executor** | Perform the action | Task + research | Code, text, analysis |
| **Reviewer** | Quality check | Executor's output | Pass/fail + feedback |
| **Router** | Decide next step | Current state | Next agent to invoke |

**Claude Code itself is a multi-agent system:** the main conversation handles planning and execution, while sub-agents (via the Agent tool) handle exploration and parallel research.

> [!info] Multi-Agent System Design
> Each agent in a multi-agent system has its own system prompt that defines its specialization. The orchestrator (planner/router) coordinates by passing structured outputs between agents. The key design principle: agents should have narrow, non-overlapping responsibilities.

---

### Memory Layering and Iterative Refinement

In multi-turn conversations, memory management determines output quality over time. Not everything should persist equally.

#### Memory Hierarchy

| Layer | Persistence | Examples |
|-------|-------------|---------|
| **Permanent** | Entire project lifetime | CLAUDE.md, project conventions, architecture decisions |
| **Session** | Current conversation | Task context, decisions made, files read |
| **Working** | Current task | Intermediate results, draft outputs |
| **Ephemeral** | Single turn | Tool results, search outputs |

#### Practical Memory Techniques

**Explicit summaries** — At natural breakpoints, ask the model to summarize what's been decided:

```
"Before we continue, summarize our decisions so far:
- Architecture choices made
- Open questions remaining
- Next steps agreed on"
```

**Memory files** — For long-running projects, maintain a memory file (like `CLAUDE.md` or `MEMORY.md`) with stable decisions:

```markdown
## Confirmed Decisions
- Database: SQL Server 2022 on GCE VM (not Cloud SQL)
- Dashboard: Blazor Server (.NET 9)
- Pipeline: Python 3.12 + pyodbc
- No SCD Type 2 in bronze layer

## Preferences
- Commit format: category: one-line description
- Never add Co-Authored-By trailers
- Run all commands from project root
```

> [!warning] Context Window Anti-Pattern
> Do not rely on the model to "remember" everything from earlier in a long conversation. Context windows are finite. Important information should be in files or re-stated at the beginning of the current prompt. This is especially true for architectural decisions that must be consistent across many tasks.

> [!tip] The CLAUDE.md Pattern
> The `CLAUDE.md` file in the vault root (and in code project roots) is the canonical implementation of the permanent memory layer. It contains conventions the model should know and follow throughout the project. Keep it updated as decisions are made.

---

### Feedback Integration for Scalable Results

The fastest way to improve AI output quality is a **tight feedback loop:**

```
1. Prompt → Output
2. Evaluate output (human or automated)
3. Identify the GAP between desired and actual
4. Modify the PROMPT (not just the output)
5. Re-run
```

**Critical insight:** Most people fix the output manually and move on. This solves today's problem but not tomorrow's. **Fix the prompt** — that's the reusable artifact.

#### Feedback Types

| Type | When to use | Example |
|------|-------------|---------|
| **Correction** | Output is factually wrong | "The formula for RSI is wrong. Here's the correct one: [formula]. Update your calculation." |
| **Refinement** | Output is correct but not useful | "This is accurate but too academic. Rewrite for a practitioner audience." |
| **Constraint addition** | Output does something unwanted | "Good, but stop including disclaimers. Add to constraints: no disclaimers." |
| **Example provision** | Output format is wrong | "Here's an example of what I want: [paste example]. Match this format exactly." |
| **Scope change** | Output is too broad or too narrow | "Focus only on the Euro market index, not all three indices." |

---

## Documentation and Mastery Loop

### Building a Prompt Library

A prompt library is a curated collection of tested, tagged, reusable prompts. It is the highest-leverage artifact of prompt engineering.

#### Prompt Library Directory Structure

```
prompt-library/
├── code-review/
│   ├── bug-detection.md        # Bugs only, no style
│   ├── security-audit.md       # OWASP top 10 focus
│   └── performance-review.md   # Big-O, memory, I/O
├── data-analysis/
│   ├── anomaly-detection.md
│   ├── report-extraction.md
│   └── time-series-summary.md
├── content/
│   ├── technical-blog.md
│   ├── api-documentation.md
│   └── release-notes.md
└── system/
    ├── agent-planner.md
    ├── code-agent.md
    └── reviewer-agent.md
```

#### Template for Each Prompt Library Entry

```markdown
# [Prompt Name]

**Use case:** When to use this prompt
**Model tested on:** Claude Opus 4, GPT-4o, Gemini Pro
**Last updated:** 2026-03-07

## Prompt

[The full prompt text]

## Variables

| Variable | Description | Example |
|----------|-------------|---------|
| {language} | Programming language | Python |
| {focus} | Review focus area | security |

## Example Output

[A representative output showing what good looks like]

## Notes

- Works best with code under 500 lines
- GPT-4 tends to add style comments despite constraint — reinforce
- Add `<constraints>` XML tags for Claude, numbered list for GPT
```

---

### Meta-Analysis: What Worked, What Didn't

After each significant prompting session, run a brief retrospective:

| Question | Purpose |
|----------|---------|
| What was the final prompt vs. the first attempt? | Shows your iteration pattern |
| Which change had the biggest impact? | Identifies your highest-leverage technique |
| Did the model surprise you (positively or negatively)? | Reveals model blind spots and strengths |
| What would you do differently from the start? | Builds intuition for future sessions |
| Is this prompt reusable? Should it go in the library? | Captures institutional knowledge |

#### Common Patterns from Retrospectives

| Pattern | Lesson |
|---------|--------|
| "I kept adding more detail and it got worse" | You were over-constraining. Simplify. |
| "It worked perfectly on the third try" | Your first attempts lacked format or constraints. Start with the 4-layer template. |
| "It works on Claude but not GPT" | You're using model-specific syntax (XML tags, specific phrasing). Generalize. |
| "The output was great but I couldn't use it" | Intent misalignment. Next time, describe the downstream use. |
| "I interrupted it 5 times mid-output" | Your prompt was unclear enough that early output went wrong. Invest more time upfront. |

> [!tip] The Prompt is the Reusable Artifact
> The discipline of documenting the *final* prompt (not the output) is what separates prompt engineering from prompt guessing. Each session should produce at minimum: a saved prompt, a note on what changed from v1 to final, and a decision on whether it belongs in the library.

---

### Mastery Checklist

Use this checklist to evaluate any prompt before sending it:

#### Fundamentals — Mastery Checklist

- [ ] The task is stated in the first 1-2 sentences
- [ ] The role (if any) is specific and relevant
- [ ] The audience/expertise level is defined
- [ ] The output format is explicitly specified
- [ ] Length or scope is constrained

#### Precision — Mastery Checklist

- [ ] No ambiguous words ("good," "better," "proper," "appropriate")
- [ ] Negative constraints are paired with positive alternatives
- [ ] Examples are provided for complex or ambiguous formats
- [ ] Edge cases are mentioned (empty input, missing data, etc.)

#### Robustness — Mastery Checklist

- [ ] Critical constraints appear early AND are reinforced late
- [ ] The prompt works on at least 2 different models
- [ ] Uncertainty handling is defined ("say 'unknown' if unsure")
- [ ] The downstream use of the output is mentioned

#### System Thinking

- [ ] The prompt is decomposed if the task has multiple independent parts
- [ ] Evaluation criteria are separate from generation instructions
- [ ] The prompt is saved in the library with tags and test results
- [ ] A meta-note captures what was learned from this session

---

## Quick Reference Card

### The 4-Layer Template

```
Role: [Who the model is — expertise, perspective, anti-role]

Task: [One clear sentence — what to accomplish]

Constraints:
- [Scope boundary]
- [Depth/length limit]
- [What NOT to do]
- [Uncertainty handling]

Format:
- [Output structure — table, list, JSON, paragraphs]
- [Length — words, sentences, items]
- [Example if complex]
```

### Universal Modifiers

| Modifier | Add to any prompt | Effect |
|----------|-------------------|--------|
| "Think step by step" | Before a reasoning task | Forces explicit reasoning chain |
| "Before answering, identify 3 possible interpretations of this question" | Before an ambiguous question | Surfaces hidden assumptions |
| "Maximum N sentences/words/items" | End of any prompt | Controls verbosity |
| "If unsure, say so" | End of factual prompts | Reduces hallucination |
| "Do not explain your reasoning" | When you just need the answer | Eliminates preamble |
| "Here is an example of the desired output: [example]" | When format is critical | Strongest format signal |
| "What's wrong with this prompt?" | Meta-prompt for self-improvement | Debug your own prompts |

### Anti-Patterns to Avoid

| Anti-pattern | Why it fails | Fix |
|-------------|-------------|-----|
| "Be concise but thorough" | Contradictory instructions | Choose one. Add specific length. |
| Starting with "I want you to..." | Wastes tokens on obvious framing | Start with the task directly |
| "Do your best" | No signal — the model always "does its best" | Define what "best" looks like with criteria |
| Pasting entire files with "analyze this" | No focus — model analyzes everything superficially | Specify exactly what to look for |
| 10+ constraints in a flat list | Model deprioritizes later items | Group constraints by type, bold the critical ones |
| "As an AI language model..." | Priming the model to be generic | Never remind the model it's an AI — give it a specific role |

> [!warning] Contradictory Instructions Kill Output Quality
> "Be concise but thorough" forces the model into an unresolvable tradeoff and produces mediocre output in both directions. Every pair of constraints must be compatible. When you notice a tension, resolve it in the prompt by specifying which dimension takes priority.

> [!tip] The Fastest Path to Better Output
> Add one universal modifier before sending any prompt: "Here is an example of what I want: [paste a representative example]." This single addition outperforms any amount of verbal description. Output examples are the highest-signal instruction a model can receive.

---

## Related Notes

- [[prompt-foundations]] — The three axioms and context hierarchy that define why prompts fail
- [[prompt-architecture]] — The 4-layer template in full structural detail
- [[model-specific-prompting]] — Per-model strengths, quirks, and debugging adjustments
- [[applied-prompting]] — Real-world before/after examples to practice against

## References

- [Anthropic Claude Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Quartz v4 Documentation](https://quartz.jzhao.xyz/) — search and publishing infrastructure for this vault
