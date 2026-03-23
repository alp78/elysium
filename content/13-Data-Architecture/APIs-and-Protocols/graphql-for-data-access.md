---
type: reference
category: data-architecture
technology:
  - python
  - graphql
tags:
  - reference
  - data-architecture
  - graphql
  - query-language
  - api
  - schema
  - resolver
aliases:
  - GraphQL
  - GQL
  - query language
  - schema definition
  - resolver
  - mutation
  - subscription
  - introspection
  - fragment
  - federation
  - Apollo
  - Strawberry
  - Ariadne
keywords:
  - graphql
  - gql
  - query language
  - schema
  - resolver
  - mutation
  - subscription
  - introspection
  - fragment
  - federation
  - strawberry
  - ariadne
  - apollo
  - dataloader
  - n+1 problem
  - pagination
  - cursor
  - relay
  - overfetching
  - underfetching
  - type system
  - sdl
  - schema definition language
  - directive
  - union
  - interface
  - authentication
  - authorization
  - data mesh
  - github api
  - bigquery
  - sql resolver
description: >
  Comprehensive reference on GraphQL for data engineers covering schema
  definition, resolvers, the N+1 problem and DataLoader, Relay-style
  pagination, authentication, federation, and real-world GitHub API examples
  for pipeline automation. Python implementations with Strawberry and Ariadne.
related:
  - "[[rest-api-design-and-consumption]]"
  - "[[serialization-formats]]"
  - "[[fastapi-and-polars]]"
  - "[[streaming-architecture]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GraphQL for Data Access

GraphQL is a query language for APIs and a runtime for executing those queries, developed by Facebook in 2012 and open-sourced in 2015. Unlike REST, where the server defines the shape of every response, GraphQL lets the client declare exactly what data it needs. For data engineers, this matters when building flexible data access layers that serve multiple consumers — dashboards, pipelines, ML feature stores — from a single endpoint.

> [!abstract] Core Idea
> A GraphQL API exposes a strongly typed schema. Clients send queries that mirror the shape of the data they want. The server resolves each field independently — against a SQL database, BigQuery, a REST API, or any other source. There is one endpoint, one schema, and complete client control over the response shape.

---

## Table of Contents

1. [[#What GraphQL Is]]
2. [[#When Data Engineers Use GraphQL]]
3. [[#Schema Definition Language (SDL)]]
4. [[#Queries]]
5. [[#Mutations]]
6. [[#Subscriptions]]
7. [[#Resolvers]]
8. [[#Python GraphQL Server with Strawberry]]
9. [[#Python GraphQL Server with Ariadne]]
10. [[#N+1 Query Problem and DataLoader]]
11. [[#Pagination: Relay-Style Cursor Connections]]
12. [[#Authentication and Authorization in Resolvers]]
13. [[#Introspection]]
14. [[#GraphQL vs REST Comparison]]
15. [[#GraphQL Federation]]
16. [[#Real-World: GitHub GraphQL API for Pipeline Automation]]
17. [[#When NOT to Use GraphQL]]

---

## What GraphQL Is

GraphQL is three things simultaneously:

**1. A query language** — clients write structured queries describing the data shape they need.

**2. A type system** — the schema is the contract between client and server, defining every type, field, and relationship.

**3. A runtime** — the server executes queries by calling resolver functions for each requested field.

```
Client                       GraphQL Server                  Data Sources
──────                       ──────────────                  ────────────
query {                  ┌─► IndexResolver ──────────────► PostgreSQL
  index(code: "SPX") {   │   ConstituentResolver ─────────► BigQuery
    name                 │   PerformanceResolver ──────────► TimescaleDB
    constituents {       │
      symbol             │
      weight             │
    }                    │
    performance(         │
      from: "2025-01-01" │
      to: "2025-03-22"   │
    ) {                  │
      date               │
      returnPct          │
    }                    │
  }                      │
}                        │
         ────────────────┘
         One HTTP POST to /graphql
```

The single query above fetches data from three different storage systems in one round trip. The client specifies exactly which fields it needs — no more, no less.

> [!info] GraphQL Wire Format
> GraphQL runs over HTTP. Queries are typically sent as `POST /graphql` with a JSON body: `{"query": "...", "variables": {...}}`. Responses are JSON: `{"data": {...}, "errors": [...]}`. Unlike gRPC, there is no binary encoding by default. See [[serialization-formats]] for encoding trade-offs.

---

## When Data Engineers Use GraphQL

**1. Flexible data access layers**
A financial analytics platform serves both a trading dashboard (needs real-time prices, risk metrics) and a regulatory reporting pipeline (needs positions, trades, reference data). Rather than building separate REST endpoints for each consumer, one GraphQL API serves both — each client requests only what it needs.

**2. Data mesh API layers**
In a [[streaming-architecture|data mesh]], each domain exposes its data as a product. GraphQL is well-suited as the product interface because it is self-documenting, introspectable, and flexible enough to serve any consumer without versioning.

**3. Serving multiple consumers from one endpoint**
Mobile apps, web dashboards, Jupyter notebooks, and pipeline scripts all have different data needs. REST APIs accumulate bespoke endpoints over time. A GraphQL API stays clean — clients compose their own queries.

**4. GitHub API (data engineers use it daily)**
The GitHub GraphQL API is the canonical example of GraphQL at scale. Data engineers use it to automate pipeline deployments, track PR states, monitor CI runs, and extract repository metadata for reporting. It replaced the GitHub REST v3 API for most complex queries.

**5. Replacing multiple REST calls with one GraphQL query**
A pipeline that needs to fetch a company's profile, its recent filings, and the filing attachments from a REST API makes 3 round trips. The equivalent GraphQL query makes 1.

> [!example] Real Pipeline Use Case
> An index rebalancing pipeline uses the GitHub GraphQL API to find the latest tagged release of a factor model repository, download the asset list CSV, and open a pull request with the new constituent weights — all in one script with three GraphQL mutations and queries.

---

## Schema Definition Language (SDL)

The SDL is the heart of a GraphQL API. It defines every type the API exposes.

### Scalar Types

```graphql
# Built-in scalars
String     # UTF-8 string
Int        # 32-bit signed integer
Float      # 64-bit float
Boolean    # true / false
ID         # Unique identifier (serialized as String)

# Custom scalars (implemented in server code)
scalar Date       # "2025-03-22"
scalar DateTime   # "2025-03-22T14:30:00Z"
scalar Decimal    # High-precision number (e.g., for currency)
scalar JSON       # Arbitrary JSON blob
```

### Object Types

```graphql
type Index {
  code:         String!               # ! = non-null
  name:         String!
  description:  String                # nullable
  assetClass:   AssetClass!
  constituents(
    sector:     String
    minWeight:  Float
    limit:      Int = 100
  ): [Constituent!]!
  performance(
    from:       Date!
    to:         Date!
    frequency:  Frequency = DAILY
  ): [DailyPerformance!]!
  lastRebalanced: Date
  totalReturn(from: Date!, to: Date!): Float
}

type Constituent {
  symbol:     String!
  name:       String!
  weight:     Float!         # percentage, e.g., 7.23
  sector:     String!
  industry:   String
  country:    String!
  marketCap:  Float
  price:      Price
}

type Price {
  current:     Float!
  open:        Float
  high:        Float
  low:         Float
  previousClose: Float
  change:      Float
  changePct:   Float
  asOf:        DateTime!
}

type DailyPerformance {
  date:        Date!
  returnPct:   Float!        # daily return as percentage
  cumulativePct: Float!      # cumulative return from query start date
  indexLevel:  Float!
  volume:      Int
}

enum AssetClass {
  EQUITY
  FIXED_INCOME
  COMMODITY
  FX
  CRYPTO
  MULTI_ASSET
}

enum Frequency {
  DAILY
  WEEKLY
  MONTHLY
  QUARTERLY
}
```

### Interfaces and Unions

```graphql
# Interface: shared fields across multiple types
interface SecurityBase {
  symbol:    String!
  name:      String!
  currency:  String!
  exchange:  String!
}

type Equity implements SecurityBase {
  symbol:    String!
  name:      String!
  currency:  String!
  exchange:  String!
  sector:    String
  eps:       Float
  pe:        Float
  dividendYield: Float
}

type Bond implements SecurityBase {
  symbol:    String!
  name:      String!
  currency:  String!
  exchange:  String!
  coupon:    Float!
  maturity:  Date!
  duration:  Float
  yieldToMaturity: Float
}

# Union: a field that could be one of several types
union SearchResult = Equity | Bond | Index | Fund

type Query {
  search(query: String!, assetClasses: [AssetClass!]): [SearchResult!]!
}
```

### Input Types

Input types are used for mutation arguments and complex query parameters.

```graphql
input DateRange {
  from: Date!
  to:   Date!
}

input PositionInput {
  symbol:   String!
  quantity: Float!
  costBasis: Float
  purchasedAt: Date
}

input PortfolioInput {
  name:      String!
  currency:  String!
  positions: [PositionInput!]!
}

type Mutation {
  createPortfolio(input: PortfolioInput!): Portfolio!
  addPosition(portfolioId: ID!, position: PositionInput!): Portfolio!
  removePosition(portfolioId: ID!, symbol: String!): Portfolio!
}
```

### Directives

```graphql
# Built-in directives
query GetIndex($includePerformance: Boolean = false) {
  index(code: "SPX") {
    name
    constituents { symbol weight }
    performance(from: "2025-01-01", to: "2025-03-22")
      @include(if: $includePerformance) {
      date returnPct
    }
  }
}

# Custom directives (defined in schema)
directive @deprecated(reason: String) on FIELD_DEFINITION
directive @auth(roles: [String!]!) on FIELD_DEFINITION | OBJECT
directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
directive @cached(ttl: Int!) on FIELD_DEFINITION

type Query {
  index(code: String!): Index @cached(ttl: 60)
  adminStats: AdminStats @auth(roles: ["ADMIN"])
  legacyPrice(symbol: String!): Float
    @deprecated(reason: "Use index(code).constituents.price instead")
}
```

---

## Queries

### Basic Query

```graphql
query GetSPXConstituents {
  index(code: "SPX") {
    name
    constituents(sector: "Technology", limit: 10) {
      symbol
      name
      weight
      sector
    }
  }
}
```

Response:
```json
{
  "data": {
    "index": {
      "name": "S&P 500",
      "constituents": [
        { "symbol": "AAPL", "name": "Apple Inc.", "weight": 7.23, "sector": "Technology" },
        { "symbol": "MSFT", "name": "Microsoft Corp.", "weight": 6.85, "sector": "Technology" }
      ]
    }
  }
}
```

### Query with Variables

```graphql
query GetIndexPerformance($code: String!, $range: DateRange!) {
  index(code: $code) {
    name
    performance(from: $range.from, to: $range.to) {
      date
      returnPct
      cumulativePct
      indexLevel
    }
  }
}
```

Variables:
```json
{
  "code": "NDX",
  "range": { "from": "2025-01-01", "to": "2025-03-22" }
}
```

### Aliases (Multiple Queries in One Request)

```graphql
query CompareIndices {
  spx: index(code: "SPX") {
    name
    totalReturn(from: "2025-01-01", to: "2025-03-22")
  }
  ndx: index(code: "NDX") {
    name
    totalReturn(from: "2025-01-01", to: "2025-03-22")
  }
  ftse: index(code: "FTSE100") {
    name
    totalReturn(from: "2025-01-01", to: "2025-03-22")
  }
}
```

### Fragments (Reusable Field Sets)

```graphql
fragment ConstituentFields on Constituent {
  symbol
  name
  weight
  sector
  price {
    current
    changePct
    asOf
  }
}

query TechHeavyIndices {
  spx: index(code: "SPX") {
    constituents(sector: "Technology") {
      ...ConstituentFields
    }
  }
  ndx: index(code: "NDX") {
    constituents(sector: "Technology") {
      ...ConstituentFields
    }
  }
}
```

### Inline Fragments for Unions

```graphql
query SearchSecurities {
  search(query: "Apple", assetClasses: [EQUITY]) {
    __typename
    ... on Equity {
      symbol
      name
      sector
      pe
      dividendYield
    }
    ... on Bond {
      symbol
      name
      coupon
      maturity
      yieldToMaturity
    }
    ... on Index {
      code
      name
      assetClass
    }
  }
}
```

---

## Mutations

```graphql
# Create a portfolio
mutation CreatePortfolio {
  createPortfolio(input: {
    name: "Tech Growth Q1 2026"
    currency: "USD"
    positions: [
      { symbol: "AAPL", quantity: 100, costBasis: 185.50, purchasedAt: "2026-01-15" }
      { symbol: "MSFT", quantity: 50,  costBasis: 420.00, purchasedAt: "2026-01-15" }
      { symbol: "NVDA", quantity: 30,  costBasis: 875.00, purchasedAt: "2026-02-01" }
    ]
  }) {
    id
    name
    positions {
      symbol
      quantity
      costBasis
      currentValue
      unrealizedPnl
      unrealizedPnlPct
    }
    totalValue
    totalUnrealizedPnl
  }
}

# Trigger a data pipeline run
mutation TriggerRebalance {
  triggerIndexRebalance(
    indexCode: "SPX"
    effectiveDate: "2026-03-31"
    dryRun: false
  ) {
    jobId
    status
    scheduledAt
    estimatedCompletionAt
    addedConstituents { symbol weight }
    removedConstituents { symbol }
    weightChanges { symbol oldWeight newWeight delta }
  }
}
```

---

## Subscriptions

GraphQL subscriptions push real-time data over WebSocket (or SSE).

```graphql
# Schema
type Subscription {
  priceUpdated(symbols: [String!]!): PriceUpdate!
  indexLevelChanged(code: String!): IndexLevel!
  portfolioValueChanged(portfolioId: ID!): PortfolioUpdate!
}

type PriceUpdate {
  symbol:    String!
  price:     Float!
  bid:       Float!
  ask:       Float!
  changePct: Float!
  timestamp: DateTime!
}
```

```graphql
# Client subscription query
subscription WatchPortfolio($portfolioId: ID!) {
  portfolioValueChanged(portfolioId: $portfolioId) {
    totalValue
    dayChangePct
    positions {
      symbol
      currentValue
      unrealizedPnl
    }
  }
}
```

> [!warning] Subscriptions vs. gRPC Streaming
> GraphQL subscriptions are WebSocket-based and not appropriate for high-throughput data (thousands of events per second). For real-time market data feeds, use [[grpc-for-data-pipelines|gRPC server streaming]] or a message broker from [[streaming-architecture]]. Use GraphQL subscriptions for user-facing real-time updates at human-readable frequencies.

---

## Resolvers

Resolvers are the functions that execute when a field is requested. Each field in the schema maps to a resolver.

### Resolver Execution Model

```
Query:                          Resolver chain:
index(code: "SPX") {            indexResolver("SPX")
  name                           └─► field: name  (trivial, returns index.name)
  constituents {                 └─► constituentsResolver(index)
    symbol                             └─► field: symbol
    weight                             └─► field: weight
    price {                            └─► priceResolver(constituent)
      current                                └─► field: current
    }                                  }
  }                              }
}
```

### SQL Resolver Example

```python
# resolvers/index_resolver.py
import asyncpg
from dataclasses import dataclass
from typing import Optional


@dataclass
class IndexRow:
    code: str
    name: str
    description: Optional[str]
    asset_class: str
    last_rebalanced: Optional[str]


async def resolve_index(_, info, code: str) -> Optional[IndexRow]:
    """Root resolver for index(code: ...) query."""
    pool: asyncpg.Pool = info.context["db_pool"]

    row = await pool.fetchrow(
        """
        SELECT code, name, description, asset_class, last_rebalanced
        FROM indices
        WHERE code = $1 AND is_active = TRUE
        """,
        code,
    )
    if row is None:
        return None
    return IndexRow(**row)


async def resolve_constituents(
    index: IndexRow,
    info,
    sector: Optional[str] = None,
    min_weight: Optional[float] = None,
    limit: int = 100,
) -> list[dict]:
    """Child resolver: fetches constituents for a given index."""
    pool: asyncpg.Pool = info.context["db_pool"]

    query = """
        SELECT
            c.symbol,
            s.name,
            ic.weight,
            s.sector,
            s.industry,
            s.country,
            s.market_cap
        FROM index_constituents ic
        JOIN constituents c ON c.id = ic.constituent_id
        JOIN securities s ON s.symbol = c.symbol
        WHERE ic.index_code = $1
          AND ic.is_current = TRUE
    """
    params = [index.code]
    idx = 2

    if sector:
        query += f" AND s.sector = ${idx}"
        params.append(sector)
        idx += 1

    if min_weight is not None:
        query += f" AND ic.weight >= ${idx}"
        params.append(min_weight)
        idx += 1

    query += f" ORDER BY ic.weight DESC LIMIT ${idx}"
    params.append(limit)

    rows = await pool.fetch(query, *params)
    return [dict(r) for r in rows]


async def resolve_performance(
    index: IndexRow,
    info,
    from_: str,
    to: str,
    frequency: str = "DAILY",
) -> list[dict]:
    """Child resolver: fetches performance time series from BigQuery."""
    bq_client = info.context["bq_client"]

    query = f"""
        SELECT
            date,
            daily_return_pct   AS return_pct,
            cumulative_pct,
            index_level,
            total_volume       AS volume
        FROM `project.finance.index_performance`
        WHERE index_code = @index_code
          AND date BETWEEN @from_date AND @to_date
        ORDER BY date
    """
    job_config = bq_client.QueryJobConfig(
        query_parameters=[
            bq_client.ScalarQueryParameter("index_code", "STRING", index.code),
            bq_client.ScalarQueryParameter("from_date", "DATE", from_),
            bq_client.ScalarQueryParameter("to_date",   "DATE", to),
        ]
    )
    result = bq_client.query(query, job_config=job_config).result()
    return [dict(r) for r in result]
```

---

## Python GraphQL Server with Strawberry

Strawberry is a code-first GraphQL library for Python. You define types as Python dataclasses decorated with `@strawberry.type`.

```python
# schema.py
from __future__ import annotations

import asyncio
from datetime import date
from typing import Optional, Annotated

import strawberry
from strawberry import auto
from strawberry.types import Info


# ── Types ─────────────────────────────────────────────────────────────────────

@strawberry.enum
class AssetClass:
    EQUITY      = "EQUITY"
    FIXED_INCOME = "FIXED_INCOME"
    COMMODITY   = "COMMODITY"
    FX          = "FX"
    CRYPTO      = "CRYPTO"


@strawberry.type
class Price:
    current:       float
    previous_close: Optional[float]
    change:        Optional[float]
    change_pct:    Optional[float]
    as_of:         str


@strawberry.type
class Constituent:
    symbol:     str
    name:       str
    weight:     float
    sector:     str
    industry:   Optional[str]
    country:    str
    market_cap: Optional[float]

    @strawberry.field
    async def price(self, info: Info) -> Optional[Price]:
        # DataLoader batches all price requests in one query
        loader = info.context["price_loader"]
        return await loader.load(self.symbol)


@strawberry.type
class DailyPerformance:
    date:           str
    return_pct:     float
    cumulative_pct: float
    index_level:    float
    volume:         Optional[int]


@strawberry.type
class Index:
    code:        str
    name:        str
    description: Optional[str]
    asset_class: AssetClass

    @strawberry.field
    async def constituents(
        self,
        info: Info,
        sector: Optional[str] = None,
        min_weight: Optional[float] = strawberry.UNSET,
        limit: int = 100,
    ) -> list[Constituent]:
        from resolvers.index_resolver import resolve_constituents
        rows = await resolve_constituents(self, info, sector, min_weight, limit)
        return [Constituent(**r) for r in rows]

    @strawberry.field
    async def performance(
        self,
        info: Info,
        from_: Annotated[str, strawberry.argument(name="from")],
        to: str,
    ) -> list[DailyPerformance]:
        from resolvers.index_resolver import resolve_performance
        rows = await resolve_performance(self, info, from_, to)
        return [DailyPerformance(**r) for r in rows]

    @strawberry.field
    async def total_return(
        self,
        info: Info,
        from_: Annotated[str, strawberry.argument(name="from")],
        to: str,
    ) -> Optional[float]:
        perf = await self.performance(info, from_, to)
        if not perf:
            return None
        return perf[-1].cumulative_pct


# ── Input Types ───────────────────────────────────────────────────────────────

@strawberry.input
class PositionInput:
    symbol:     str
    quantity:   float
    cost_basis: Optional[float] = None


@strawberry.input
class PortfolioInput:
    name:      str
    currency:  str
    positions: list[PositionInput]


@strawberry.type
class Portfolio:
    id:          str
    name:        str
    currency:    str
    total_value: float
    created_at:  str


# ── Query root ────────────────────────────────────────────────────────────────

@strawberry.type
class Query:
    @strawberry.field
    async def index(self, info: Info, code: str) -> Optional[Index]:
        from resolvers.index_resolver import resolve_index
        row = await resolve_index(None, info, code)
        if row is None:
            return None
        return Index(
            code=row.code,
            name=row.name,
            description=row.description,
            asset_class=AssetClass(row.asset_class),
        )

    @strawberry.field
    async def indices(
        self,
        info: Info,
        asset_class: Optional[AssetClass] = None,
    ) -> list[Index]:
        pool = info.context["db_pool"]
        query = "SELECT code, name, description, asset_class FROM indices WHERE is_active = TRUE"
        params = []
        if asset_class:
            query += " AND asset_class = $1"
            params.append(asset_class.value)
        rows = await pool.fetch(query, *params)
        return [Index(code=r["code"], name=r["name"], description=r["description"],
                      asset_class=AssetClass(r["asset_class"])) for r in rows]


# ── Mutation root ─────────────────────────────────────────────────────────────

@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_portfolio(
        self, info: Info, input: PortfolioInput
    ) -> Portfolio:
        pool = info.context["db_pool"]
        import uuid, datetime

        portfolio_id = str(uuid.uuid4())
        now = datetime.datetime.utcnow().isoformat()

        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "INSERT INTO portfolios (id, name, currency, created_at) VALUES ($1, $2, $3, $4)",
                    portfolio_id, input.name, input.currency, now,
                )
                for pos in input.positions:
                    await conn.execute(
                        "INSERT INTO positions (portfolio_id, symbol, quantity, cost_basis) VALUES ($1, $2, $3, $4)",
                        portfolio_id, pos.symbol, pos.quantity, pos.cost_basis,
                    )

        return Portfolio(
            id=portfolio_id,
            name=input.name,
            currency=input.currency,
            total_value=0.0,
            created_at=now,
        )


# ── Schema ────────────────────────────────────────────────────────────────────

schema = strawberry.Schema(query=Query, mutation=Mutation)


# ── FastAPI integration ───────────────────────────────────────────────────────

from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter

app = FastAPI()

async def get_context() -> dict:
    import asyncpg
    from google.cloud import bigquery

    pool = await asyncpg.create_pool(dsn="postgresql://user:pass@localhost/finance")
    bq   = bigquery.Client()

    return {
        "db_pool":     pool,
        "bq_client":   bq,
        "price_loader": create_price_loader(pool),
    }

graphql_app = GraphQLRouter(schema, context_getter=get_context)
app.include_router(graphql_app, prefix="/graphql")
```

---

## Python GraphQL Server with Ariadne

Ariadne is a schema-first (SDL-first) alternative. You write the SDL, then bind resolvers.

```python
# ariadne_server.py
from ariadne import QueryType, MutationType, ObjectType, make_executable_schema
from ariadne.asgi import GraphQL

# Load schema from file
with open("schema.graphql") as f:
    type_defs = f.read()

# ── Bind resolvers ────────────────────────────────────────────────────────────

query = QueryType()
mutation = MutationType()
index_type = ObjectType("Index")
constituent_type = ObjectType("Constituent")


@query.field("index")
async def resolve_query_index(_, info, code: str):
    pool = info.context["db_pool"]
    row = await pool.fetchrow(
        "SELECT code, name, description, asset_class FROM indices WHERE code = $1",
        code,
    )
    return dict(row) if row else None


@index_type.field("constituents")
async def resolve_index_constituents(index, info, sector=None, limit=100):
    pool = info.context["db_pool"]
    rows = await pool.fetch(
        """
        SELECT c.symbol, s.name, ic.weight, s.sector
        FROM index_constituents ic
        JOIN constituents c ON c.id = ic.constituent_id
        JOIN securities s ON s.symbol = c.symbol
        WHERE ic.index_code = $1 AND ic.is_current = TRUE
        ORDER BY ic.weight DESC LIMIT $2
        """,
        index["code"], limit,
    )
    return [dict(r) for r in rows]


@constituent_type.field("price")
async def resolve_constituent_price(constituent, info):
    loader = info.context["price_loader"]
    return await loader.load(constituent["symbol"])


schema = make_executable_schema(type_defs, query, mutation, index_type, constituent_type)

app = GraphQL(schema, debug=True)
```

---

## N+1 Query Problem and DataLoader

The N+1 problem is the most important performance issue in GraphQL. It occurs when resolving a list of N items each triggers an individual database query, resulting in N+1 total queries.

### The Problem

```graphql
query {
  index(code: "SPX") {
    constituents(limit: 500) {
      symbol
      price {          # ← This resolver fires 500 times, one query each
        current
        changePct
      }
    }
  }
}
# Result: 1 query for index + 1 query for constituents + 500 queries for prices = 502 queries
```

### DataLoader Pattern

DataLoader batches all individual loads that occur in the same "tick" of the event loop into a single batched query.

```python
# dataloader.py
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

import asyncpg


class PriceLoader:
    """
    Batches individual price lookups into a single SQL query.

    Usage:
        loader = PriceLoader(pool)
        price = await loader.load("AAPL")      # batched with all other loads in same tick
    """

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool
        self._batch: dict[str, asyncio.Future] = {}
        self._scheduled = False

    async def load(self, symbol: str) -> dict | None:
        if symbol not in self._batch:
            loop = asyncio.get_event_loop()
            future: asyncio.Future = loop.create_future()
            self._batch[symbol] = future

            if not self._scheduled:
                self._scheduled = True
                loop.call_soon(self._dispatch)

        return await self._batch[symbol]

    def _dispatch(self) -> None:
        batch = self._batch
        self._batch = {}
        self._scheduled = False
        asyncio.create_task(self._fetch_batch(batch))

    async def _fetch_batch(self, batch: dict[str, asyncio.Future]) -> None:
        symbols = list(batch.keys())
        try:
            rows = await self._pool.fetch(
                """
                SELECT
                    symbol,
                    last_price       AS current,
                    previous_close,
                    last_price - previous_close AS change,
                    ROUND(
                        (last_price - previous_close) / previous_close * 100,
                        4
                    ) AS change_pct,
                    as_of
                FROM live_prices
                WHERE symbol = ANY($1::text[])
                """,
                symbols,
            )
            results = {r["symbol"]: dict(r) for r in rows}
        except Exception as exc:
            for fut in batch.values():
                if not fut.done():
                    fut.set_exception(exc)
            return

        for symbol, future in batch.items():
            if not future.done():
                future.set_result(results.get(symbol))


def create_price_loader(pool: asyncpg.Pool) -> PriceLoader:
    """Create a new loader per request (not shared across requests)."""
    return PriceLoader(pool)


# With DataLoader: 500 constituent prices = 1 batched SQL query (instead of 500)
# Query: SELECT ... FROM live_prices WHERE symbol = ANY($1)
```

> [!tip] strawberry-django and DataLoader
> Strawberry integrates with `strawberry-django` and `strawberry-graphql-django` which auto-generate DataLoaders for Django ORM relationships. For raw SQL or BigQuery, write your own as above.

### BigQuery DataLoader

```python
class BigQueryPriceLoader:
    """Batch historical price lookups against BigQuery."""

    def __init__(self, bq_client, as_of_date: str) -> None:
        self._bq = bq_client
        self._as_of = as_of_date
        self._batch: dict[str, asyncio.Future] = {}
        self._scheduled = False

    async def load(self, symbol: str) -> dict | None:
        if symbol not in self._batch:
            loop = asyncio.get_event_loop()
            self._batch[symbol] = loop.create_future()
            if not self._scheduled:
                self._scheduled = True
                loop.call_soon(self._dispatch)
        return await self._batch[symbol]

    def _dispatch(self) -> None:
        batch = self._batch
        self._batch = {}
        self._scheduled = False
        asyncio.create_task(self._fetch(batch))

    async def _fetch(self, batch: dict[str, asyncio.Future]) -> None:
        symbols = list(batch.keys())
        query = """
            SELECT symbol, close_price, open_price, high_price, low_price, volume
            FROM `project.finance.daily_prices`
            WHERE symbol IN UNNEST(@symbols)
              AND price_date = @as_of
        """
        job_config = self._bq.QueryJobConfig(
            query_parameters=[
                self._bq.ArrayQueryParameter("symbols", "STRING", symbols),
                self._bq.ScalarQueryParameter("as_of", "DATE", self._as_of),
            ]
        )

        def _run():
            return {
                r["symbol"]: dict(r)
                for r in self._bq.query(query, job_config=job_config).result()
            }

        loop = asyncio.get_event_loop()
        try:
            results = await loop.run_in_executor(None, _run)
        except Exception as exc:
            for fut in batch.values():
                if not fut.done():
                    fut.set_exception(exc)
            return

        for symbol, fut in batch.items():
            if not fut.done():
                fut.set_result(results.get(symbol))
```

---

## Pagination: Relay-Style Cursor Connections

Relay-style cursor pagination is the GraphQL standard. It handles arbitrary sort orders safely, unlike offset pagination.

### Schema

```graphql
type ConstituentConnection {
  edges:    [ConstituentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ConstituentEdge {
  node:   Constituent!
  cursor: String!       # opaque base64-encoded cursor
}

type PageInfo {
  hasNextPage:     Boolean!
  hasPreviousPage: Boolean!
  startCursor:     String
  endCursor:       String
}

type Query {
  # Forward pagination: after + first
  # Backward pagination: before + last
  constituents(
    indexCode: String!
    first:     Int
    after:     String
    last:      Int
    before:    String
    sector:    String
  ): ConstituentConnection!
}
```

### Resolver Implementation

```python
import base64
import json


def encode_cursor(symbol: str, weight: float) -> str:
    """Encode a stable cursor from the sort key."""
    payload = json.dumps({"symbol": symbol, "weight": weight})
    return base64.b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> dict:
    payload = base64.b64decode(cursor.encode()).decode()
    return json.loads(payload)


async def resolve_constituents_connection(
    _,
    info,
    index_code: str,
    first: int | None = None,
    after: str | None = None,
    last: int | None = None,
    before: str | None = None,
    sector: str | None = None,
) -> dict:
    pool = info.context["db_pool"]

    # Determine pagination direction
    page_size = first or last or 20
    is_forward = first is not None or (first is None and last is None)

    query = """
        SELECT c.symbol, s.name, ic.weight, s.sector, s.country
        FROM index_constituents ic
        JOIN constituents c ON c.id = ic.constituent_id
        JOIN securities s ON s.symbol = c.symbol
        WHERE ic.index_code = $1 AND ic.is_current = TRUE
    """
    params = [index_code]
    idx = 2

    if sector:
        query += f" AND s.sector = ${idx}"
        params.append(sector)
        idx += 1

    if after:
        cursor = decode_cursor(after)
        query += f" AND (ic.weight < ${idx} OR (ic.weight = ${idx} AND c.symbol > ${idx+1}))"
        params.extend([cursor["weight"], cursor["weight"], cursor["symbol"]])
        idx += 2

    query += " ORDER BY ic.weight DESC, c.symbol ASC"
    query += f" LIMIT ${idx}"
    params.append(page_size + 1)  # fetch one extra to detect hasNextPage

    rows = await pool.fetch(query, *params)
    has_next = len(rows) > page_size
    rows = rows[:page_size]

    total = await pool.fetchval(
        "SELECT COUNT(*) FROM index_constituents WHERE index_code = $1 AND is_current = TRUE",
        index_code,
    )

    edges = [
        {
            "node": dict(r),
            "cursor": encode_cursor(r["symbol"], r["weight"]),
        }
        for r in rows
    ]

    return {
        "edges": edges,
        "totalCount": total,
        "pageInfo": {
            "hasNextPage": has_next,
            "hasPreviousPage": after is not None,
            "startCursor": edges[0]["cursor"] if edges else None,
            "endCursor": edges[-1]["cursor"] if edges else None,
        },
    }
```

### Client Pagination Loop

```python
# Pipeline script: paginate through all constituents
import httpx
import json

QUERY = """
query GetConstituents($indexCode: String!, $after: String) {
  constituents(indexCode: $indexCode, first: 100, after: $after) {
    edges {
      node { symbol name weight sector }
      cursor
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
"""

async def fetch_all_constituents(base_url: str, index_code: str) -> list[dict]:
    all_nodes = []
    cursor = None

    async with httpx.AsyncClient() as client:
        while True:
            response = await client.post(
                f"{base_url}/graphql",
                json={"query": QUERY, "variables": {"indexCode": index_code, "after": cursor}},
            )
            data = response.json()["data"]["constituents"]

            all_nodes.extend(edge["node"] for edge in data["edges"])
            print(f"  Fetched {len(all_nodes)}/{data['totalCount']}")

            if not data["pageInfo"]["hasNextPage"]:
                break
            cursor = data["pageInfo"]["endCursor"]

    return all_nodes
```

---

## Authentication and Authorization in Resolvers

### Context-Based Auth

```python
# context.py — attach the authenticated user to every request
from fastapi import Request, HTTPException
import jwt  # PyJWT

ALLOWED_ROLES = {"analyst", "trader", "admin"}


async def get_context(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["RS256"])
            user = {
                "sub":   payload["sub"],
                "email": payload["email"],
                "roles": payload.get("roles", []),
            }
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "db_pool":     db_pool,
        "bq_client":   bq_client,
        "price_loader": PriceLoader(db_pool),
        "user":        user,
    }
```

### Field-Level Authorization

```python
# strawberry permission classes
import strawberry
from strawberry.permission import BasePermission
from strawberry.types import Info


class IsAuthenticated(BasePermission):
    message = "Authentication required"

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context["user"] is not None


class HasRole(BasePermission):
    message = "Insufficient permissions"

    def __init__(self, *roles: str) -> None:
        self._roles = set(roles)

    def has_permission(self, source, info: Info, **kwargs) -> bool:
        user = info.context["user"]
        if user is None:
            return False
        return bool(self._roles & set(user.get("roles", [])))


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def index(self, info: Info, code: str) -> Optional[Index]:
        ...

    @strawberry.field(permission_classes=[HasRole("admin", "risk_manager")])
    async def portfolio_risk_metrics(self, info: Info, portfolio_id: str) -> RiskMetrics:
        ...

    @strawberry.field(permission_classes=[HasRole("admin")])
    async def system_stats(self, info: Info) -> SystemStats:
        ...
```

### Row-Level Security in Resolvers

```python
async def resolve_portfolios(_, info) -> list[dict]:
    """Users can only see their own portfolios; admins see all."""
    user = info.context["user"]
    pool = info.context["db_pool"]

    if user is None:
        raise PermissionError("Authentication required")

    if "admin" in user["roles"]:
        rows = await pool.fetch("SELECT * FROM portfolios ORDER BY created_at DESC")
    else:
        rows = await pool.fetch(
            "SELECT * FROM portfolios WHERE owner_id = $1 ORDER BY created_at DESC",
            user["sub"],
        )

    return [dict(r) for r in rows]
```

---

## Introspection

GraphQL schemas are self-documenting. Clients can query the schema itself.

```graphql
# Discover all types in the schema
query IntrospectSchema {
  __schema {
    types {
      name
      kind
      description
      fields {
        name
        type { name kind ofType { name kind } }
        description
        args { name type { name } defaultValue }
      }
    }
  }
}

# Discover a specific type
query IntrospectIndex {
  __type(name: "Index") {
    name
    description
    fields {
      name
      description
      type {
        name
        kind
        ofType { name kind }
      }
    }
  }
}
```

```python
# Generate documentation from introspection in a pipeline script
import httpx
import json


async def get_schema_types(base_url: str) -> list[dict]:
    query = """
    {
      __schema {
        types {
          name kind description
          fields { name description type { name kind ofType { name } } }
        }
      }
    }
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/graphql",
            json={"query": query},
        )
    schema = response.json()["data"]["__schema"]
    # Filter out intrinsic types (starting with __)
    return [t for t in schema["types"] if not t["name"].startswith("__")]
```

> [!info] Disabling Introspection in Production
> Introspection can leak schema details to attackers. In production, disable it after documenting your API:
> ```python
> schema = strawberry.Schema(query=Query, introspection=False)
> ```
> Use schema registries (Apollo Studio, GraphQL Inspector) for internal teams instead.

---

## GraphQL vs REST Comparison

| Dimension | GraphQL | REST |
|---|---|---|
| **Endpoint count** | One (`/graphql`) | Many (`/indices`, `/prices`, `/portfolios`) |
| **Overfetching** | Never (client specifies fields) | Common (fixed response shape) |
| **Underfetching** | Never (nested queries, one round trip) | Common (multiple requests needed) |
| **Type system** | Built-in (SDL) | Optional (OpenAPI/Swagger) |
| **Versioning** | Schema evolution with deprecations | URL versioning (`/v1`, `/v2`) |
| **Caching** | Difficult (POST, dynamic queries) | Built-in HTTP caching |
| **File uploads** | Awkward (multipart spec) | Native multipart |
| **Streaming** | Subscriptions (WebSocket) | SSE, WebSocket, chunked transfer |
| **Error handling** | `errors` array alongside data | HTTP status codes |
| **Tooling** | GraphiQL, Apollo Studio, Rover | Postman, curl, SwaggerUI |
| **Learning curve** | Higher (SDL, resolvers, DataLoader) | Lower |
| **Browser caching** | Not via HTTP Cache | ETags, Cache-Control |
| **N+1 risk** | High without DataLoader | Controlled at endpoint level |
| **Performance** | JSON over HTTP (same as REST) | JSON over HTTP |
| **Real-time** | Subscriptions | Webhooks, SSE |
| **Self-documenting** | Yes (introspection) | With OpenAPI |

> [!tip] Decision Rule
> Use GraphQL when different consumers need different shapes of the same data, or when you want to aggregate multiple data sources into one query. Use REST when responses are stable, caching is important, or the API is public-facing with simple operations. See [[rest-api-design-and-consumption]] for REST patterns.

---

## GraphQL Federation

Federation lets you compose a unified GraphQL schema from multiple independent subgraph services — the foundation of a data mesh API layer.

```
Client → API Gateway (supergraph)
            ├── Index Subgraph     (owns: Index, Constituent)
            ├── Pricing Subgraph   (owns: Price, PriceHistory)
            ├── Portfolio Subgraph (owns: Portfolio, Position)
            └── Risk Subgraph      (owns: RiskMetrics, VaR)
```

### Subgraph Schema (Index Service)

```graphql
# index-subgraph/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0")

type Index @key(fields: "code") {
  code:  String!
  name:  String!
  constituents: [Constituent!]!
}

type Constituent @key(fields: "symbol") {
  symbol: String!
  weight: Float!
  sector: String!
}
```

### Subgraph Schema (Pricing Service)

```graphql
# pricing-subgraph/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0")

# Extend Constituent type defined in index subgraph
type Constituent @key(fields: "symbol") {
  symbol:  String! @external
  price:   Price
  history(from: Date!, to: Date!): [DailyPrice!]!
}

type Price {
  current:   Float!
  changePct: Float!
  asOf:      DateTime!
}
```

### Python Subgraph with Strawberry Federation

```python
# pricing_subgraph.py
import strawberry
from strawberry.federation import Schema


@strawberry.federation.type(keys=["symbol"])
class Constituent:
    symbol: strawberry.ID

    @classmethod
    def resolve_reference(cls, symbol: strawberry.ID) -> "Constituent":
        return cls(symbol=symbol)

    @strawberry.field
    async def price(self, info) -> Optional[Price]:
        loader = info.context["price_loader"]
        return await loader.load(str(self.symbol))

    @strawberry.field
    async def history(
        self, info, from_: str, to: str
    ) -> list[DailyPrice]:
        pool = info.context["db_pool"]
        rows = await pool.fetch(
            "SELECT date, close_price FROM daily_prices WHERE symbol = $1 AND date BETWEEN $2 AND $3",
            str(self.symbol), from_, to,
        )
        return [DailyPrice(date=str(r["date"]), close=r["close_price"]) for r in rows]


schema = Schema(query=Query, types=[Constituent])
```

---

## Real-World: GitHub GraphQL API for Pipeline Automation

Data engineers use the GitHub GraphQL API daily. Examples below show common automation patterns.

### Setup

```python
# github_client.py
import httpx
import os

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_API = "https://api.github.com/graphql"


async def github_query(query: str, variables: dict = None) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_API,
            headers={"Authorization": f"Bearer {GITHUB_TOKEN}"},
            json={"query": query, "variables": variables or {}},
        )
        response.raise_for_status()
        result = response.json()
        if "errors" in result:
            raise RuntimeError(f"GraphQL errors: {result['errors']}")
        return result["data"]
```

### Find Latest Release of a Factor Model

```graphql
query GetLatestRelease($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    latestRelease {
      tagName
      publishedAt
      releaseAssets(first: 20) {
        nodes {
          name
          downloadUrl
          size
        }
      }
    }
  }
}
```

```python
async def get_latest_model_release(owner: str, repo: str) -> dict:
    QUERY = """
    query GetLatestRelease($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        latestRelease {
          tagName
          publishedAt
          releaseAssets(first: 20) {
            nodes { name downloadUrl size }
          }
        }
      }
    }
    """
    data = await github_query(QUERY, {"owner": owner, "repo": repo})
    release = data["repository"]["latestRelease"]
    assets = {
        asset["name"]: asset["downloadUrl"]
        for asset in release["releaseAssets"]["nodes"]
    }
    return {"tag": release["tagName"], "published": release["publishedAt"], "assets": assets}
```

### Find Open PRs with a Specific Label

```graphql
query GetPipelinePRs($owner: String!, $repo: String!, $label: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      states: [OPEN]
      labels: [$label]
      first: 50
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      nodes {
        number
        title
        author { login }
        createdAt
        headRefName
        mergeable
        statusCheckRollup {
          state
        }
        files(first: 10) {
          nodes { path additions deletions }
        }
      }
    }
  }
}
```

```python
async def get_pipeline_prs(owner: str, repo: str) -> list[dict]:
    QUERY = """... (above query) ..."""
    data = await github_query(QUERY, {"owner": owner, "repo": repo, "label": "pipeline-update"})
    return data["repository"]["pullRequests"]["nodes"]
```

### Create a Pull Request Programmatically

```graphql
mutation CreatePR(
  $repositoryId: ID!
  $title:        String!
  $body:         String!
  $headRef:      String!
  $baseRef:      String!
) {
  createPullRequest(input: {
    repositoryId: $repositoryId
    title:        $title
    body:         $body
    headRefName:  $headRef
    baseRefName:  $baseRef
  }) {
    pullRequest {
      number
      url
      title
      createdAt
    }
  }
}
```

```python
async def create_rebalance_pr(
    repo_id: str,
    branch: str,
    index_code: str,
    effective_date: str,
    changes_summary: str,
) -> dict:
    MUTATION = """
    mutation CreatePR($repositoryId: ID!, $title: String!, $body: String!,
                      $headRef: String!, $baseRef: String!) {
      createPullRequest(input: {
        repositoryId: $repositoryId
        title: $title
        body: $body
        headRefName: $headRef
        baseRefName: $baseRef
      }) {
        pullRequest { number url title createdAt }
      }
    }
    """
    variables = {
        "repositoryId": repo_id,
        "title": f"[{index_code}] Rebalance effective {effective_date}",
        "body": f"## Index Rebalance\n\n{changes_summary}\n\nEffective: {effective_date}",
        "headRef": branch,
        "baseRef": "main",
    }
    data = await github_query(MUTATION, variables)
    return data["createPullRequest"]["pullRequest"]
```

### Monitor CI Status

```graphql
query GetCIStatus($owner: String!, $repo: String!, $branch: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $branch) {
      target {
        ... on Commit {
          statusCheckRollup {
            state
            contexts(first: 20) {
              nodes {
                ... on CheckRun {
                  name
                  status
                  conclusion
                  startedAt
                  completedAt
                }
              }
            }
          }
        }
      }
    }
  }
}
```

```python
async def wait_for_ci(owner: str, repo: str, branch: str, timeout: int = 600) -> str:
    import asyncio, time

    QUERY = """... (above query) ..."""
    start = time.monotonic()

    while time.monotonic() - start < timeout:
        data = await github_query(QUERY, {"owner": owner, "repo": repo, "branch": f"refs/heads/{branch}"})
        ref = data["repository"]["ref"]
        if ref and ref["target"].get("statusCheckRollup"):
            state = ref["target"]["statusCheckRollup"]["state"]
            if state in ("SUCCESS", "FAILURE", "ERROR"):
                return state
            print(f"  CI state: {state} — waiting...")

        await asyncio.sleep(30)

    raise TimeoutError(f"CI did not complete within {timeout}s")
```

---

## When NOT to Use GraphQL

> [!warning] Avoid GraphQL in These Scenarios
>
> **Simple CRUD APIs**: If every endpoint returns the same shape every time (list users, get user by ID, update user), REST is simpler. GraphQL's flexibility adds overhead (resolver setup, DataLoader, schema design) that is not justified.
>
> **High-throughput data streaming**: GraphQL subscriptions are WebSocket-based and JSON-encoded. For thousands of events per second, use [[grpc-for-data-pipelines|gRPC server streaming]] or Apache Kafka from [[streaming-architecture]]. GraphQL subscriptions are for human-scale real-time updates.
>
> **File uploads**: The GraphQL multipart request spec is awkward. Use signed cloud storage URLs (GCS, S3) or a dedicated REST endpoint for uploads.
>
> **Teams unfamiliar with the N+1 problem**: An unoptimized GraphQL API can be dramatically slower than REST because of accidental N+1 queries. The DataLoader pattern must be applied diligently. REST endpoints are easier to profile.
>
> **Public APIs requiring aggressive HTTP caching**: Because GraphQL queries are typically POST requests with unique query strings, standard HTTP caching (ETags, CDNs) does not apply without specialized tooling like persisted queries. REST APIs on GET endpoints cache naturally.

---

## Quick Reference

```python
# Install Strawberry + FastAPI
pip install strawberry-graphql[fastapi] asyncpg httpx

# Minimal Strawberry schema
import strawberry
from strawberry.fastapi import GraphQLRouter
from fastapi import FastAPI

@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"

schema = strawberry.Schema(query=Query)
app = FastAPI()
app.include_router(GraphQLRouter(schema), prefix="/graphql")

# Query a GraphQL API
import httpx
response = httpx.post(
    "http://localhost:8000/graphql",
    json={"query": "{ hello }"},
)
print(response.json())  # {"data": {"hello": "world"}}
```

---

## Related Notes

- [[rest-api-design-and-consumption]] — REST patterns and comparison with GraphQL
- [[serialization-formats]] — JSON, protobuf, Avro; encoding trade-offs for API payloads
- [[fastapi-and-polars]] — Building the HTTP server that hosts your GraphQL schema
- [[streaming-architecture]] — When to use streaming (Kafka, gRPC) instead of GraphQL subscriptions
