---
title: "MOC: AI & Prompts"
tags:
  - moc
  - ai
  - prompts
  - llm
---

# MOC: AI & Prompts

This section covers two complementary skill areas: using LLMs as tools within data engineering pipelines (RAG, corporate actions parsing, vector databases) and mastering prompt engineering as a discipline (foundations through debugging). Start with prompt foundations if you are new, or jump to AI-augmented data engineering for pipeline integration patterns.

## Prompt Engineering — Foundations Through Advanced System Design

A complete progression from core principles through structural patterns, model-specific strategies, real-world examples, and systematic debugging. Read in order for the full learning path.

* [[prompt-foundations]] — the three axioms of LLM completion, the four-level context hierarchy, clarity vs ambiguity, and how prompt structure shapes reasoning and factual outputs

* [[prompt-architecture]] — the 4-layer template (Role, Goal, Constraints, Format), modular structural formats (XML tags, JSON schemas, paragraph form), meta-prompting, and chain-of-thought structuring

* [[model-specific-prompting]] — behavioral profiles for Claude, GPT-4, Gemini, Grok, and Perplexity covering strengths, preferred formats, tone response, and cross-model portability tips

* [[applied-prompting]] — complete before/after worked examples across four domains: research and analysis, content creation, code generation, and data extraction with optimization rationale

* [[prompt-debugging]] — diagnosing weak outputs with the symptom-cause-fix table, intent misalignment, prompt rebuilding techniques, multi-agent workflows, memory layering, and building a reusable prompt library

## LLM-Powered Data Pipelines — RAG, Vector Databases, and AI-Assisted Engineering

Practical integration of LLMs into production data engineering workflows for financial data platforms.

* [[ai-augmented-data-engineering]] — LLM use cases for financial pipelines (corporate actions parsing, anomaly explanation, schema documentation), RAG architecture, vector database comparison (pgvector, ChromaDB, Pinecone, Weaviate, Qdrant), token cost budgeting, and AI-assisted development with Claude Code and Copilot
