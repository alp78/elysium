---
type: concept
category: ai-and-prompts
technology: [python, bigquery, gcp]
tags: [ai, llm, rag, embeddings, vector-databases, python, data-engineering, prompt-engineering]
aliases: [LLM data pipelines, RAG architecture, retrieval augmented generation, vector database, embeddings, AI-assisted development, Claude Code, GitHub Copilot, AI data engineering, LLM pipeline, corporate actions parsing with LLM, ESG extraction LLM, anomaly explanation LLM, Apache Iceberg AI, pgvector, ChromaDB, Pinecone, token budgeting]
keywords: [LLM, RAG, retrieval augmented generation, embeddings, vector database, pgvector, ChromaDB, Pinecone, Weaviate, Qdrant, AlloyDB AI, langchain, VertexAI, text-embedding, Claude, Anthropic, GitHub Copilot, AI-assisted, corporate actions, press release parsing, anomaly explanation, data quality, schema documentation, SQL generation, token cost, daily budget, Iceberg, Apache Iceberg, structured unstructured, semantic search, AI productivity, hallucination, code review AI]
description: "AI-augmented data engineering: practical LLM use cases (corporate actions parsing, anomaly explanation, schema documentation), RAG architecture for financial document retrieval, vector database comparison (pgvector, ChromaDB, Pinecone, Weaviate, Qdrant, AlloyDB AI), cost management and token budgeting, Apache Iceberg + AI hybrid architecture, and AI-assisted development workflow with Claude Code and GitHub Copilot. Includes all code examples."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# AI-Augmented Data Engineering: LLM and RAG Pipelines

By 2026, senior data engineers are expected to transition from "builders" to "strategists" who integrate AI capabilities into data platforms. This does not mean becoming a machine learning engineer — it means understanding how to build the data infrastructure that powers LLM applications and how to use LLMs as tools within data pipelines.

## 34.1 Where LLMs Fit in Data Engineering

LLMs are not replacements for SQL transforms or Airflow DAGs. They are specialized tools for tasks where rules-based logic fails — natural language understanding, unstructured data classification, and intelligent data quality explanations.

**Practical LLM use cases for financial data engineers:**

| Use Case | Input | LLM Task | Output |
|---|---|---|---|
| **Corporate actions parsing** | Press release text | Extract: action type, ratio, effective date | Structured corporate action record |
| **Regulatory filing classification** | SEC/ESMA filing PDF | Classify: material change, routine, amendment | Category tag + confidence score |
| **Anomaly explanation** | "SAP dropped 15% today" + news | Generate explanation for data quality alert | Human-readable anomaly report |
| **Data quality remediation** | Failed validation rules + data sample | Suggest fix: is this a data error or a real event? | Remediation recommendation |
| **Schema documentation** | Table DDL + sample data | Generate column descriptions | Auto-populated data catalog entries |
| **Query generation** | Natural language question | Generate SQL | Validated SQL query |

## 34.2 RAG Architecture: Retrieval-Augmented Generation

RAG is the pattern of combining a retrieval system (search over your own documents/data) with an LLM (generation). It is how you give an LLM access to your internal documentation, pipeline logs, and data catalog without fine-tuning.

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│   User       │     │  RETRIEVAL        │     │  GENERATION  │
│   Question   │────▶│                   │────▶│              │
│              │     │  1. Embed query   │     │  4. LLM      │
│ "Why did the │     │  2. Search vector │     │     combines  │
│  Euro the data pipeline project  │     │     store for     │     │     retrieved │
│  50 drop 3%  │     │     relevant docs │     │     context + │
│  yesterday?" │     │  3. Return top-K  │     │     question  │
│              │     │     chunks        │     │  5. Generate  │
└──────────────┘     └───────────────────┘     │     answer    │
                                                └──────┬───────┘
                                                       │
                                                       ▼
                                               "The Euro market index
                                                dropped 2.8% due to
                                                SAP's earnings miss
                                                (-8.2%) and Deutsche
                                                Bank downgrade. SAP
                                                contributes 9.8% of
                                                the index weight..."
```

**The data engineering pipeline for RAG:**

```python
# Step 1: Document ingestion (data engineer's job)
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Load corporate announcements, regulatory filings, earnings transcripts
loader = PyPDFLoader("press_releases/sap_q4_2025.pdf")
documents = loader.load()

# Chunk documents (critical parameter: too small = lost context, too large = irrelevant noise)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # characters per chunk
    chunk_overlap=200,      # overlap between chunks (preserves context at boundaries)
    separators=["\n\n", "\n", ". ", " "]
)
chunks = splitter.split_documents(documents)

# Step 2: Generate embeddings (convert text to vectors)
from langchain.embeddings import VertexAIEmbeddings

embeddings = VertexAIEmbeddings(model_name="text-embedding-005")
vectors = embeddings.embed_documents([chunk.page_content for chunk in chunks])

# Step 3: Store in vector database
import chromadb

client = chromadb.PersistentClient(path="/data/vector_store")
collection = client.get_or_create_collection(
    name="financial_documents",
    metadata={"hnsw:space": "cosine"}
)

collection.add(
    documents=[c.page_content for c in chunks],
    metadatas=[c.metadata for c in chunks],
    ids=[f"chunk_{i}" for i in range(len(chunks))],
    embeddings=vectors
)
```

## 34.3 Using LLMs in Data Pipelines

**Corporate actions extraction from press releases:**

```python
from anthropic import Anthropic

client = Anthropic()

def extract_corporate_action(press_release_text: str) -> dict:
    """
    Extract structured corporate action data from a press release.
    This replaces hours of manual data entry with seconds of LLM processing.
    """
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""Extract the corporate action from this press release.
Return a JSON object with these fields:
- company_name: string
- symbol: string (stock ticker)
- action_type: one of [SPLIT, DIVIDEND, MERGER, SPINOFF, RIGHTS_ISSUE]
- effective_date: YYYY-MM-DD
- ratio_numerator: integer (for splits)
- ratio_denominator: integer (for splits)
- dividend_amount: decimal (for dividends)
- currency: 3-letter code
- description: one-sentence summary

Press release:
{press_release_text}

Return ONLY valid JSON, no markdown formatting."""
        }]
    )

    import json
    return json.loads(response.content[0].text)

# Usage in pipeline:
action = extract_corporate_action("""
Deutsche Telekom AG announces a 1:4 stock split effective March 10, 2026.
Shareholders will receive 3 additional shares for each share held.
The ex-date is March 10, 2026. Trading on the adjusted basis begins
on the same date.
""")
# Returns: {"company_name": "Deutsche Telekom AG", "symbol": "DTE.DE",
#           "action_type": "SPLIT", "effective_date": "2026-03-10",
#           "ratio_numerator": 1, "ratio_denominator": 4, ...}
```

**Data quality anomaly explanation:**

```python
def explain_anomaly(symbol: str, metric: str, value: float, expected_range: tuple,
                    recent_news: list[str]) -> str:
    """
    When a data quality check flags an anomaly, use an LLM to determine
    if it's a real event or a data error.
    """
    news_context = "\n".join(f"- {n}" for n in recent_news[:5])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": f"""A data quality alert was triggered:
Stock: {symbol}
Metric: {metric}
Value: {value}
Expected range: {expected_range[0]} to {expected_range[1]}

Recent news for {symbol}:
{news_context}

Is this anomaly likely a REAL MARKET EVENT or a DATA ERROR?
Explain in 2-3 sentences. End with a recommendation: ACCEPT (real event) or INVESTIGATE (possible error)."""
        }]
    )
    return response.content[0].text
```

## 34.4 Vector Databases for Financial Data

| Database | Type | Best For | Deployment |
|---|---|---|---|
| **pgvector** | PostgreSQL extension | Teams already using PostgreSQL, moderate scale | Self-hosted or Cloud SQL |
| **ChromaDB** | Embedded/client-server | Prototyping, small-medium datasets | Embedded in Python or Docker |
| **Pinecone** | Managed SaaS | Production at scale, low operational overhead | Fully managed |
| **Weaviate** | Open source + cloud | Hybrid search (vector + keyword), multi-modal | Self-hosted or Weaviate Cloud |
| **Qdrant** | Open source + cloud | High performance, filtering, Rust-based | Self-hosted or Qdrant Cloud |
| **AlloyDB AI** | Managed (GCP) | GCP-native, integrated with Vertex AI | Fully managed |

> [!tip] GCP Vector Database Recommendation
> For a financial data platform on GCP: Start with pgvector (if you already run PostgreSQL for Airflow metadata) or AlloyDB AI (managed, GCP-native). Move to Pinecone or Weaviate when you need >10M vectors or sub-10ms latency.

## 34.5 Cost Management and Token Budgeting

LLM API calls cost real money. A pipeline that processes 1,000 corporate action filings per day at $0.003/1K input tokens can run up significant costs if not managed.

**Cost control patterns:**

```python
import tiktoken

def estimate_cost(text: str, model: str = "claude-sonnet-4-6") -> float:
    """Estimate API cost before making the call."""
    # Approximate token count (Claude uses ~4 chars per token)
    input_tokens = len(text) / 4
    output_tokens = 500  # estimated response

    # Claude Sonnet pricing (approximate)
    input_cost = (input_tokens / 1_000_000) * 3.00   # $3/M input tokens
    output_cost = (output_tokens / 1_000_000) * 15.00  # $15/M output tokens

    return input_cost + output_cost

# Budget enforcement
DAILY_BUDGET = 50.00  # $50/day max
daily_spend = 0.0

def call_llm_with_budget(text: str) -> str:
    global daily_spend
    estimated = estimate_cost(text)

    if daily_spend + estimated > DAILY_BUDGET:
        raise RuntimeError(f"Daily LLM budget exceeded: ${daily_spend:.2f} / ${DAILY_BUDGET}")

    response = client.messages.create(...)
    actual_cost = (response.usage.input_tokens / 1e6 * 3.0 +
                   response.usage.output_tokens / 1e6 * 15.0)
    daily_spend += actual_cost

    return response.content[0].text
```

**When NOT to use LLMs:**

| Task | Use LLM? | Better Alternative |
|---|---|---|
| Parsing structured data (CSV, JSON, XML) | No | Python standard libraries |
| Calculating index values | No | SQL / Python (deterministic math) |
| Validating data types | No | Pydantic, Great Expectations |
| Extracting dates from free text | Maybe | regex first, LLM as fallback |
| Classifying unstructured documents | **Yes** | LLM excels here |
| Generating natural language summaries | **Yes** | LLM excels here |
| Understanding press releases | **Yes** | LLM excels here |

## 34.6 Apache Iceberg + AI: The Emerging Pattern

The combination of Iceberg (structured data) and vector databases (unstructured data) is the emerging architecture for AI-augmented data platforms:

```
┌─────────────────────────────────────────────────────────────┐
│                  STRUCTURED DATA (Iceberg)                   │
│  daily_ohlcv │ index_constituents │ corporate_actions        │
│  ─── SQL queries, window functions, aggregations ───         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  AI Layer   │
                    │  (LLM API)  │
                    └──────┬──────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               UNSTRUCTURED DATA (Vector DB)                  │
│  press_releases │ earnings_transcripts │ regulatory_filings  │
│  ─── semantic search, similarity, RAG retrieval ───          │
└─────────────────────────────────────────────────────────────┘
```

A query like "What factors contributed to the Euro market index underperforming the S&P 500 last quarter?" requires:
1. Structured data: index returns, constituent weights, sector breakdown (SQL on Iceberg)
2. Unstructured data: earnings call transcripts, analyst reports (vector search)
3. Generation: combine both into a coherent narrative (LLM)

## 34.7 AI-Assisted Workflow: Senior Productivity with Claude Code and GitHub Copilot

AI coding assistants are not a replacement for engineering skill — they are a force multiplier that lets senior engineers focus on architecture and decisions while delegating routine implementation. By 2026, engineers who use AI tools effectively are 30-50% more productive than those who do not.

**The productivity spectrum — where AI helps most:**

| Task | AI Assistance Level | Tool | Time Saved |
|---|---|---|---|
| Writing unit tests for existing code | **High** — AI reads the code and generates test cases | Claude Code, Copilot | 60-80% |
| Documenting complex SQL | **High** — AI explains what the query does in plain language | Claude Code | 70-90% |
| Refactoring legacy code | **Medium** — AI suggests improvements, human validates | Claude Code, Copilot | 30-50% |
| Debugging pipeline failures | **Medium** — AI analyzes logs, suggests root cause | Claude Code | 20-40% |
| Designing system architecture | **Low** — AI can draft, but human judgment is essential | Claude Code (plan mode) | 10-20% |
| Writing production business logic | **Low** — AI generates code, but correctness requires deep review | Copilot | 10-30% |

**Pattern 1: Generating unit tests with Claude Code**

```bash
# In your project directory, ask Claude Code to generate tests
# Claude reads your source code and generates comprehensive test cases

# Example: generate tests for a corporate actions processor
claude "Read dags/transforms/corporate_actions.py and write comprehensive
unit tests in tests/test_corporate_actions.py. Cover:
- Stock split (1:4) adjusting historical prices
- Reverse split (5:1)
- Cash dividend with reinvestment
- Edge cases: split ratio of 1:1 (no-op), zero dividend amount
- Error handling: missing price data, invalid split ratio
Use pytest fixtures for database connections."
```

**Pattern 2: Documenting complex SQL pipelines**

```bash
# Ask Claude Code to explain and document an existing complex query
claude "Read sql/gold/compute_index_performance.sql and:
1. Add a block comment at the top explaining what this query does,
   its inputs, outputs, and assumptions
2. Add inline comments for each CTE explaining the business logic
3. Create a markdown file docs/index_performance_calculation.md
   with a plain-language explanation suitable for a product manager"
```

**Pattern 3: Refactoring legacy Python code**

```bash
# Modernize a legacy pandas pipeline to Polars
claude "Read dags/transforms/legacy_momentum_calc.py and refactor it:
- Replace pandas with Polars (lazy evaluation)
- Replace iterrows() loops with vectorized expressions
- Add type hints to all functions
- Keep the exact same input/output contract — tests must still pass
- Do NOT change the business logic or calculation methodology"
```

**Pattern 4: SQL optimization with AI assistance**

```bash
# Profile a slow query and get optimization suggestions
claude "This query in sql/gold/daily_signals.sql takes 45 seconds.
Read the query, analyze the execution plan (I'll paste it),
and suggest optimizations:
- Index recommendations
- Query rewrite opportunities
- Partitioning suggestions
Don't change the output schema."
```

**GitHub Copilot — inline code completion for data engineering:**

Copilot excels at repetitive, pattern-following code. In data engineering, this means:

```python
# Type the first test, Copilot generates the rest:
def test_stock_split_adjusts_prices():
    """Test that a 1:4 split divides all historical prices by 4."""
    prices = pd.DataFrame({
        'symbol': ['SAP'] * 5,
        'close_price': [400, 410, 420, 430, 440],
        'trade_date': pd.date_range('2026-01-01', periods=5)
    })
    result = apply_stock_split(prices, ratio=4, effective_date='2026-01-03')
    assert result.loc[0, 'close_price'] == 100  # 400/4
    assert result.loc[1, 'close_price'] == 102.5  # 410/4
    assert result.loc[2, 'close_price'] == 420  # on effective date, no adjustment
    # Copilot auto-generates the remaining assertions...

# Type the function signature, Copilot writes the body:
def validate_index_weights(weights: pd.Series, index_key: str,
                           tolerance: float = 0.01) -> bool:
    """Validate that index weights sum to 1.0 within tolerance."""
    # Copilot completes: return abs(weights.sum() - 1.0) < tolerance
```

**When AI coding tools fail — and how to catch it:**

| Failure Mode | Example | Mitigation |
|---|---|---|
| **Hallucinated APIs** | Generates `pd.DataFrame.merge_asof()` with wrong parameters | Always run the generated code; review against docs |
| **Subtle logic errors** | Applies split adjustment *including* the effective date instead of *before* | Business logic tests with known expected outputs |
| **Outdated patterns** | Uses deprecated `pd.append()` or old API versions | Keep AI tools updated; specify library versions in prompts |
| **Security issues** | Generates SQL with string formatting instead of parameterized queries | Security-focused code review; use linters (bandit, semgrep) |
| **Over-engineering** | Creates abstract factory pattern for a simple data transform | Review for simplicity; specify "keep it simple" in prompts |

**The AI-assisted development workflow:**

```
1. DESIGN    → Human architects the solution (what tables, what transforms)
2. SCAFFOLD  → AI generates boilerplate (models, tests, docs)
3. IMPLEMENT → AI + human write the code together (Copilot inline, Claude for blocks)
4. REVIEW    → Human reviews ALL AI-generated code for correctness and security
5. TEST      → Run existing tests + AI-generated tests against known data
6. DOCUMENT  → AI generates docs from final code, human reviews for accuracy
```

> [!warning] AI Tools Are Junior Developers, Not Senior Architects
> Treat AI-generated code the way you would treat a junior engineer's PR: assume it is probably correct for common patterns but might miss edge cases, security implications, or financial domain nuances. Never merge AI-generated code without a thorough review. The productivity gain comes from the speed of generation, not from skipping review. An AI that writes 10 tests in 30 seconds saves you time even if you spend 5 minutes reviewing and fixing 2 of them.

## Related

- [[index-maintenance-and-corporate-actions]] — ESG data extraction from PDFs using LLMs (Section 32.10)
- [[migration-idempotency-backfills]] — Data platform patterns that AI tools help build and document
- [[leadership-and-collaboration]] — AI-assisted code review and technical writing at scale

## References

- Anthropic Claude API: https://docs.anthropic.com/
- LangChain documentation: https://python.langchain.com/docs/
- ChromaDB documentation: https://docs.trychroma.com/
- Vertex AI Embeddings: https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings/get-text-embeddings
- GitHub Copilot: https://github.com/features/copilot
- Apache Iceberg: https://iceberg.apache.org/docs/latest/
