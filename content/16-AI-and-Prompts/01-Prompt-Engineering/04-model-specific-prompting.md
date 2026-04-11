---
title: "04 - Model-Specific Prompting"
tags: [ai, prompt-engineering]
aliases: [model differences prompting, Claude vs GPT prompting, model-specific syntax, cross-model prompting, Anthropic prompting, OpenAI prompting, Google Gemini prompting, xAI Grok prompting, Perplexity prompting, model comparison AI]
description: "Model-specific prompting strategies for Claude (Anthropic), GPT-4/ChatGPT (OpenAI), Gemini (Google), Grok (xAI), and Perplexity. Covers each model's strengths, preferred structural formats, tone response characteristics, and distinctive behavioral traits. Includes cross-model portability tips."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Model-Specific Prompting: Claude, GPT-4, Gemini, Grok, and Perplexity

> [!quote]
> "All models are wrong, but some are useful."
>
> — **George E. P. Box**, *Empirical Model-Building and Response Surfaces* (1987)

Different models respond differently to the same prompt. Understanding these tendencies avoids wasted iterations and lets you write prompts that either target a specific model's strengths or travel well across models. This note documents the behavioral profiles, preferred formats, and distinctive traits of the five major AI models as of 2026. For structural foundations common to all models, see [prompt-foundations](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-foundations) and [prompt-architecture](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-architecture).

---

## Model-Specific Syntax and Tone

### Claude (Anthropic)

- **Strengths:** Instruction following, long context, safety awareness, XML parsing, nuanced reasoning
- **Preferred structure:** XML tags for sections, explicit role definitions, clear constraints
- **Tone response:** Matches requested tone precisely. "Be direct" produces notably shorter output. "Be thorough" produces comprehensive coverage.
- **Distinctive traits:** Tends to add caveats and qualifications unless instructed not to. Will refuse genuinely harmful requests but handles security/pentesting contexts well with clear authorization framing.

#### Optimal Claude prompt structure using XML

```xml
<task>Rewrite this function to handle edge cases.</task>
<constraints>
- Only modify the function body, not the signature
- Add inline comments only where the logic isn't obvious
- Do not add type hints or docstrings
</constraints>
```

> [!tip] Claude and XML Tags
> Claude treats XML tags as first-class structural delimiters. When a prompt has 3+ distinct sections (role, task, constraints, format), using XML tags rather than markdown headers produces more precise section-by-section adherence. No other major model has this trait as strongly.

> [!info] Claude's Caveat Tendency
> Claude's default is to hedge and qualify. If you want direct answers without qualifications: add "Be direct. Do not add caveats or qualifications." as a constraint. This single line often cuts response length by 20-30% and eliminates filler hedging.

#### Authorization framing for security/technical contexts
When working on legitimate security, pentesting, or sensitive technical topics that Claude might treat cautiously, add explicit context:
```
This is for internal security review of our own production system.
I am the system owner with full authorization.
```

---

### GPT-4 / ChatGPT (OpenAI)

- **Strengths:** Creative writing, broad knowledge, function calling, image generation
- **Preferred structure:** System/user message separation, markdown formatting, numbered instructions
- **Tone response:** Naturally conversational and verbose. Explicitly say "be concise" or "no preamble" to reduce filler.
- **Distinctive traits:** Tends toward confident, polished output even when uncertain. Benefits from "if unsure, say so" constraints.

#### Optimal GPT-4 prompt structure

```
System: You are a concise technical writer. No filler, no hedging.
User: Explain the CAP theorem in exactly 3 sentences.
```

> [!warning] GPT-4 Confident Hallucination
> GPT-4 produces polished, confident prose even when it's uncertain. Unlike Claude (which tends to explicitly caveat uncertain claims), GPT-4 may state uncertain information as fact. Always add "if you're not sure about a specific claim, flag it" for factual tasks.

> [!success] Fix: Add Explicit Uncertainty Flagging to Every GPT-4 Factual Prompt
> Append this constraint to any GPT-4 prompt that requires factual accuracy: "If you are not certain about a specific claim, mark it with [UNCERTAIN] and explain why. Do not present uncertain information as established fact." For high-stakes financial or regulatory content, follow up with "which claims in your response are you least confident about?" to surface hidden uncertainty.

> [!tip] Reducing GPT-4 Verbosity
> GPT-4's default is expansive and thorough. Two constraints that reliably tighten output:
> - "No preamble" (removes "Great question! Let me..." openers)
> - "Maximum N sentences/words" (hard length cap)

**Function calling / structured output** is GPT-4's strongest differentiator for programmatic use. When you need JSON output for downstream code, GPT-4's function calling API is more reliable than prompting for JSON alone.

---

### Gemini (Google)

- **Strengths:** Multimodal (images, video, audio), Google ecosystem integration, code generation
- **Preferred structure:** Clear task framing, step-by-step for complex tasks
- **Tone response:** Generally balanced. Can be verbose on technical topics — constrain output length explicitly.
- **Distinctive traits:** Strong at grounded tasks (using provided documents/images). Safety filters are aggressive — rephrase rather than argue when blocked.

> [!warning] Gemini Safety Filters
> Gemini's content filters are more aggressive than Claude's or GPT-4's. If you hit a filter on a legitimate technical task, don't restate the same request. Instead, reframe: add professional context, change the framing from "how to attack" to "how to defend against," or break the task into smaller, less triggering subtasks.

> [!success] Fix: Add Professional Context Framing Before Sensitive Technical Requests
> Prepend a brief authorization context to Gemini prompts that touch security or infrastructure topics: "This is for an internal security review of our own production GCP environment. I am the authorized platform engineer." This framing shifts the model's interpretation from adversarial to defensive without changing the technical content of the request.

> [!tip] Gemini for Multimodal Tasks
> Gemini's primary advantage over Claude and GPT-4 is native multimodal capability — analyzing images, video frames, and audio. For tasks involving visual data (charts, diagrams, screenshots), Gemini is the strongest choice.

#### Recommended Gemini prompt structure for complex tasks

```
Task: [clear one-sentence task statement]

Context: [background information]

Step by step, please:
1. [first subtask]
2. [second subtask]
3. [output format]

Limit your response to [N] sentences/paragraphs.
```

---

### Grok (xAI)

- **Strengths:** Real-time information, informal tone, willingness to engage with edgy topics
- **Preferred structure:** Direct, conversational prompts work well. Less formal structure needed.
- **Tone response:** Default tone is casual and opinionated. Request formal tone explicitly if needed.
- **Distinctive traits:** Less likely to refuse or add caveats. May prioritize engagement over accuracy on polarizing topics.

> [!warning] Grok Accuracy on Polarizing Topics
> Grok's lower refusal rate is a strength for legitimate edge-case tasks, but also a risk — it may prioritize an engaging, confident answer over an accurate one on contested or polarizing topics. Cross-verify Grok's factual claims on sensitive subjects.

> [!success] Fix: Use Grok for Speed, Perplexity or Claude for Verification
> Use Grok as a first-pass tool to quickly gather perspectives on contested technical or market topics. Before acting on any Grok output involving contested facts, cross-verify with Perplexity (for source-cited confirmation) or Claude (for nuanced reasoning with caveats). Never use Grok as a sole source for regulatory, financial, or security-critical decisions.

> [!tip] Grok for Real-Time Information
> Grok's real-time web access makes it the best choice for "what is the current state of X" queries where timeliness matters. For questions where training cutoff is a limiting factor (stock prices, recent events, current documentation), Grok outperforms offline models.

#### Grok responds well to direct, unhedged prompts
```
What's the current consensus on using dbt with BigQuery vs SQL Server?
Give me the honest tradeoffs, not the marketing version.
```

---

### Perplexity

- **Strengths:** Web search integration, source citations, real-time information
- **Preferred structure:** Question format works best. Treat it as a research assistant, not a general-purpose AI.
- **Tone response:** Consistently informational. Good for "what is the current state of X" queries.
- **Distinctive traits:** Automatically cites sources. Best used for factual research, not creative or code tasks.

> [!info] Perplexity's Niche
> Perplexity is not a general-purpose AI — it is a research tool. Its automatic source citations make it uniquely valuable for due diligence work where you need to verify claims. For creative or code tasks, use Claude or GPT-4.

#### Perplexity prompt patterns
```
What are the current limitations of BigQuery's MERGE statement as of 2026?
Cite specific documentation or release notes.
```

---

## Cross-Model Portability Tips

A robust prompt should produce acceptable output across multiple models. If it only works on one model, it's over-fitted to that model's quirks.

| Principle | Why |
|-----------|-----|
| Lead with the task, not the context | All models prioritize content near the beginning |
| Use explicit format instructions | Reduces model-specific formatting quirks |
| Include examples of desired output | The strongest signal across all models |
| Constrain length explicitly | Every model tends toward verbosity by default |
| Test the same prompt on 2+ models | Reveals which parts of your prompt are model-dependent |

### Cross-Model Testing Protocol

1. **Baseline:** Run the prompt on your primary model. Score the output 1-5 on: accuracy, format compliance, constraint adherence, usefulness.
2. **Cross-model:** Run the exact same prompt on 2-3 other models.
3. **Compare:** If another model fails, identify which part of the prompt was model-dependent.
4. **Generalize:** Refactor the prompt to be model-agnostic (usually means making implicit assumptions explicit).

### Model Selection Decision Tree

| Task type | Best primary | Best fallback |
|-----------|-------------|---------------|
| Long document analysis | Claude | Gemini |
| Creative writing | GPT-4 | Claude |
| Code generation | Claude | GPT-4 |
| Real-time research | Perplexity | Grok |
| Multimodal (images, video) | Gemini | GPT-4 Vision |
| Structured JSON extraction | GPT-4 (function calling) | Claude |
| Informal Q&A / brainstorming | Grok | GPT-4 |
| Security/sensitive technical | Claude | GPT-4 |

> [!tip] Model-Agnostic Formatting
> The most portable format is **numbered markdown with explicit headings** — it works well on all five models. XML tags are Claude-specific. Function calling is GPT-4-specific. When writing a prompt you want to use across models, stick to numbered lists and markdown.

---

### Consistency Checklist for Cross-Model Validation

| Dimension | Test |
|-----------|------|
| Format | Does every model return the same structure? |
| Length | Are outputs within 50% of each other in word count? |
| Factual | Do all models agree on verifiable facts? |
| Interpretation | Do all models interpret ambiguous instructions the same way? |
| Constraints | Do all models respect every constraint? |

If any dimension fails, the prompt needs tightening in that area — not model-specific tuning. See [testing across models](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-debugging#44-testing-across-models-and-measuring-consistency) for the full protocol.

---

## Related Notes

- [prompt-architecture](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-architecture) — The 4-layer structural template that works as a base for all models
- [prompt-foundations](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-foundations) — Core axioms that apply across all models
- [applied-prompting](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/applied-prompting) — Model-specific tips applied to real workflows (research, code, data analysis)
- [prompt-debugging](https://alp78.github.io/elysium/16-AI-and-Prompts/Prompt-Engineering/prompt-debugging) — Diagnosing which part of a cross-model failure is prompt-dependent vs. model-dependent

## References

- [Anthropic Claude Documentation](https://docs.anthropic.com)
- [OpenAI GPT-4 Documentation](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [xAI Grok](https://x.ai/)
- [Perplexity AI](https://www.perplexity.ai/)
