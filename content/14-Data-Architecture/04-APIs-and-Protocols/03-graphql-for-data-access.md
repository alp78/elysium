---
title: "03 - GraphQL for Data Access"
tags: [data-architecture, graphql, api]
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
description: >
  Comprehensive reference on GraphQL for data engineers covering schema
  definition, resolvers, the N+1 problem and DataLoader, Relay-style
  pagination, authentication, federation, and real-world GitHub API examples
  for pipeline automation. Python implementations with Strawberry and Ariadne.
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# GraphQL for Data Access

> [!quote]
> "Think about describing the data, not the view. Model your data as objects in the graph — the API should expose data semantics, not feature-specific payloads."
>
> — **Lee Byron** (co-creator of GraphQL)

GraphQL is a query language for APIs and a runtime for executing those queries, developed by Facebook in 2012 and open-sourced in 2015. Unlike REST, where the server defines the shape of every response, GraphQL lets the client declare exactly what data it needs. For data engineers, this matters when building flexible data access layers that serve multiple consumers — dashboards, pipelines, ML feature stores — from a single endpoint.

> [!info] Core Idea
> A GraphQL API exposes a strongly typed schema. Clients send queries that mirror the shape of the data they want. The server resolves each field independently — against a SQL database, BigQuery, a REST API, or any other source. There is one endpoint, one schema, and complete client control over the response shape.

---

## What GraphQL Is

GraphQL is a query language for APIs, a type system for describing data, and a runtime for executing queries — developed by Facebook in 2012 and open-sourced in 2015. Unlike REST, the server exposes a schema and the client declares exactly what it needs; the server resolves each requested field independently against whatever data source backs it.

GraphQL is three things simultaneously:

**1. A query language** — clients write structured queries describing the data shape they need.

**2. A type system** — the schema is the contract between client and server, defining every type, field, and relationship.

**3. A runtime** — the server executes queries by calling resolver functions for each requested field.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#1a1b26", "primaryTextColor": "#c0caf5", "primaryBorderColor": "#414868", "lineColor": "#7aa2f7", "secondaryColor": "#16161e", "tertiaryColor": "#1a1b26", "clusterBkg": "#16161e", "titleColor": "#c0caf5", "edgeLabelBackground": "#1a1b26", "nodeTextColor": "#c0caf5"}}}%%
flowchart LR
    C["Client<br/>query { index(code:SPX)<br/>{ name constituents<br/>performance } }"]
    GQL["GraphQL Server<br/>/graphql<br/>One HTTP POST"]
    IR["IndexResolver"]
    CR["ConstituentResolver"]
    PR["PerformanceResolver"]
    PG[("PostgreSQL")]
    BQ[("BigQuery")]
    TS[("TimescaleDB")]

    C -->|POST /graphql| GQL
    GQL --> IR
    GQL --> CR
    GQL --> PR
    IR --> PG
    CR --> BQ
    PR --> TS
```

The single query above fetches data from three different storage systems in one round trip. The client specifies exactly which fields it needs — no more, no less.

> [!info] GraphQL Wire Format
> GraphQL runs over HTTP. Queries are typically sent as `POST /graphql` with a JSON body: `{"query": "...", "variables": {...}}`. Responses are JSON: `{"data": {...}, "errors": [...]}`. Unlike gRPC, there is no binary encoding by default. See [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) for encoding trade-offs.

---

## When Data Engineers Use GraphQL

**1. Flexible data access layers**
A financial analytics platform serves both a trading dashboard (needs real-time prices, risk metrics) and a regulatory reporting pipeline (needs positions, trades, reference data). Rather than building separate REST endpoints for each consumer, one GraphQL API serves both — each client requests only what it needs.

**2. Data mesh API layers**
In a [data mesh](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture), each domain exposes its data as a product. GraphQL is well-suited as the product interface because it is self-documenting, introspectable, and flexible enough to serve any consumer without versioning.

**3. Serving multiple consumers from one endpoint**
Mobile apps, web dashboards, Jupyter notebooks, and pipeline scripts all have different data needs. REST APIs accumulate bespoke endpoints over time. A GraphQL API stays clean — clients compose their own queries.

**4. GitHub API (data engineers use it daily)**
The GitHub GraphQL API is the canonical example of GraphQL at scale. Data engineers use it to automate pipeline deployments, track PR states, monitor CI runs, and extract repository metadata for reporting. It replaced the GitHub REST v3 API for most complex queries.

**5. Replacing multiple REST calls with one GraphQL query**
A pipeline that needs to fetch a company's profile, its recent filings, and the filing attachments from a REST API makes 3 round trips. The equivalent GraphQL query makes 1.

> [!guide] Real Pipeline Use Case
> An index rebalancing pipeline uses the GitHub GraphQL API to find the latest tagged release of a factor model repository, download the asset list CSV, and open a pull request with the new constituent weights — all in one script with three GraphQL mutations and queries.

---

## Schema Definition Language (SDL)

The SDL is the heart of a GraphQL API. It defines every type the API exposes.

### Scalar Types

GraphQL has five built-in scalars: `String` (UTF-8), `Int` (32-bit signed), `Float` (64-bit), `Boolean`, and `ID` (unique identifier, serialized as string). Custom scalars let you define domain-specific types like `Date`, `DateTime`, `Decimal`, and `JSON` — the implementation is server-side.

```graphql
String
Int
Float
Boolean
ID

scalar Date
scalar DateTime
scalar Decimal
scalar JSON
```

### Object Types

Object types define the data nodes in the graph. The `!` suffix marks a field as non-null; omitting it means the field is nullable. Fields can take arguments for filtering, pagination, and parameterization — these become part of the schema contract.

```graphql
type Index {
  code:         String!
  name:         String!
  description:  String
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
  weight:     Float!
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

Interfaces define shared fields that multiple types must implement — use them when different types have a common shape but differ in additional fields. Unions are looser: a union field can return one of several types that share no fields, requiring inline fragments to select type-specific data.

```graphql
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

Directives annotate fields and types with additional behavior. The built-in `@include` and `@skip` conditionally include fields at query time. Custom directives declared in the schema (`@auth`, `@cached`, `@rateLimit`) are implemented server-side and enforce cross-cutting concerns without coupling them to resolver logic.

```graphql
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

Queries are read-only operations. A client declares the exact fields it needs, and the server resolves each field independently — no more, no less data is returned.

### Basic Query

A named query with no variables, selecting specific fields from a specific index.

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

Variables are passed as a separate JSON object alongside the query string, allowing the same named query to be reused with different inputs. This is the standard pattern for parameterized queries in pipeline scripts.

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

Aliases let you call the same field multiple times in one request with different arguments. Each alias becomes a key in the response object. This replaces three separate REST calls with a single round trip.

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

Fragments define a named set of fields that can be spread into multiple queries with `...FragmentName`, reducing duplication when the same field selection appears in many places.

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

When a field returns a union or interface, inline fragments select type-specific fields. The `__typename` meta-field lets the client determine which concrete type was returned.

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

Mutations are write operations — creating, updating, or deleting data. They return the modified object, so the client can refresh its state in the same round trip without a follow-up query.

```graphql
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
> GraphQL subscriptions are WebSocket-based and not appropriate for high-throughput data (thousands of events per second). For real-time market data feeds, use [gRPC server streaming](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/grpc-for-data-pipelines) or a message broker from [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture). Use GraphQL subscriptions for user-facing real-time updates at human-readable frequencies.

> [!success] Right Tool for Each Frequency
> Use GraphQL subscriptions for dashboard-level updates (portfolio value refreshing every few seconds, pipeline status notifications) where human-readable frequency is sufficient. For tick-level market data or high-throughput pipeline events (>100 events/sec), route through gRPC server streaming or a Pub/Sub topic and expose a separate WebSocket or SSE endpoint — keeping the GraphQL API clean for query-oriented use cases.

---

## Resolvers

Resolvers are the functions that execute when a field is requested. Each field in the schema maps to a resolver.

### Resolver Execution Model

The execution engine calls the root resolver first, then calls child resolvers for each requested field — passing the parent object's result as the first argument. Execution is depth-first; each level is resolved before moving deeper.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#1a1b26", "primaryTextColor": "#c0caf5", "primaryBorderColor": "#414868", "lineColor": "#7aa2f7", "secondaryColor": "#16161e", "tertiaryColor": "#1a1b26", "clusterBkg": "#16161e", "titleColor": "#c0caf5", "edgeLabelBackground": "#1a1b26", "nodeTextColor": "#c0caf5"}}}%%
flowchart TD
    Q["query { index(code: SPX) }"]
    IR["indexResolver(code)"]
    N["field: name"]
    CR["constituentsResolver(index)"]
    SYM["field: symbol"]
    WGT["field: weight"]
    PR["priceResolver(constituent)"]
    CUR["field: current"]

    Q --> IR
    IR --> N
    IR --> CR
    CR --> SYM
    CR --> WGT
    CR --> PR
    PR --> CUR
### SQL Resolver Example

Root resolvers receive `_` (parent, which is `None` for root fields), `info` (execution context carrying the request, auth user, and injected clients), and any field arguments. Child resolvers receive the parent object as the first positional argument.

```python
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


schema = strawberry.Schema(query=Query, mutation=Mutation)


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

When resolving a list of N items, each item's child resolver fires independently — one database query per item. For 500 constituents each requesting a price, that is 502 total queries.

```graphql
query {
  index(code: "SPX") {
    constituents(limit: 500) {
      symbol
      price {
        current
        changePct
      }
    }
  }
}
```

> [!danger] N+1 Without DataLoader in Production
> An unguarded GraphQL API serving 500 constituents will fire 502 database queries per request. At any meaningful load, this collapses the database. Unlike REST endpoints where the developer controls exactly what the query fetches, GraphQL resolvers compose dynamically — the N+1 explosion is invisible until it hits production. Always attach DataLoaders before exposing any list field that has a child resolver.

> [!success] Fix
> DataLoader batches all individual loads that occur in the same async "tick" into a single `WHERE symbol = ANY($1)` query. 500 price lookups become 1 query.

### DataLoader Pattern

DataLoader batches all individual loads that occur in the same tick of the event loop into a single batched query.

```python
# dataloader.py
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

import asyncpg


class PriceLoader:
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
    return PriceLoader(pool)
```

> [!tip] strawberry-django and DataLoader
> Strawberry integrates with `strawberry-django` and `strawberry-graphql-django` which auto-generate DataLoaders for Django ORM relationships. For raw SQL or BigQuery, write your own as above.

### BigQuery DataLoader

The same batching pattern applied to BigQuery. Because the BigQuery client is synchronous, the batch fetch runs in a thread executor to avoid blocking the async event loop.

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

The Relay schema wraps each item in an `Edge` that carries both the data `node` and an opaque `cursor`. `PageInfo` exposes navigation state. Clients use `first`/`after` for forward pagination and `last`/`before` for backward.

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

Cursors encode the sort key (weight + symbol for tie-breaking) as base64 JSON. The resolver fetches `page_size + 1` rows to detect whether a next page exists, then trims back to `page_size` before building edges.

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

A pipeline script follows cursors until `hasNextPage` is false, collecting all pages into a flat list.

```python
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

GraphQL has no built-in auth layer. Authentication is handled in the context function that runs before any resolver; authorization is enforced inside individual resolvers or via declarative permission classes. Both happen at the application layer, not the transport layer.

### GraphQL Authentication — Context-Based Auth

The context function decodes the JWT from the `Authorization` header and attaches the user object. Every resolver then reads from `info.context["user"]` — no middleware required.

```python
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

Strawberry's `BasePermission` classes let you declare access requirements directly on any field via `permission_classes=[...]`. The framework calls `has_permission` before the resolver; returning `False` adds a GraphQL error without a stack trace.

```python
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

Some access rules are data-specific: a user can only see their own portfolios. This filtering belongs in the resolver query, not in middleware — the resolver has the user context and can scope the SQL `WHERE` clause accordingly.

```python
async def resolve_portfolios(_, info) -> list[dict]:
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

## GraphQL Introspection

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

> [!danger] Introspection in Production
> Introspection reveals every type, field, argument, and resolver in your schema — a complete map for attackers to enumerate attack surface. Disable it in production after documenting your API:
> ```python
> schema = strawberry.Schema(query=Query, introspection=False)
> ```

> [!success] Alternative for Internal Teams
> Use a schema registry (Apollo Studio, GraphQL Inspector) to give internal teams schema documentation without exposing introspection to the public endpoint.

---

## GraphQL vs REST Comparison

Both GraphQL and REST run over HTTP and return JSON. The choice depends on consumer diversity and response shape stability — not on performance or security.

> [!question] GraphQL or REST?
> - **Multiple consumers needing different projections** (dashboard vs pipeline vs notebook) → GraphQL: each composes its own query, no endpoint accumulation
> - **Public API with stable, well-defined response shapes** → REST: simpler, natively cacheable, lower learning curve
> - **Aggressive HTTP caching required** (CDN, ETags) → REST: GraphQL POST queries bypass standard HTTP caches
> - **File uploads or binary payloads** → REST: GraphQL multipart is awkward
> - **High-throughput streaming** (>100 events/sec) → neither; use gRPC or Pub/Sub
> - **Small team, CRUD operations only** → REST: GraphQL overhead (SDL, resolvers, DataLoader) is not justified

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
> Use GraphQL when different consumers need different shapes of the same data, or when you want to aggregate multiple data sources into one query. Use REST when responses are stable, caching is important, or the API is public-facing with simple operations. See [rest-api-design-and-consumption](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption) for REST patterns.

---

## GraphQL Federation

Federation lets you compose a unified GraphQL schema from multiple independent subgraph services — the foundation of a [data mesh](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) API layer. Each domain team owns and deploys its own subgraph; a gateway composes them into a single supergraph schema that clients query as one API.

> [!question] Single Server or Federation?
> - **Single team, one data domain** → single Strawberry/Ariadne server; federation adds deployment complexity without benefit
> - **Multiple domain teams, each owning a slice of the schema** → federation: teams evolve their subgraph independently, types can span services via entity references
> - **Data mesh product interfaces** → federation maps naturally to the "data as a product" principle — each domain publishes a typed subgraph
> - **Early-stage product** → start with a monolith and migrate to federation later; premature federation is over-engineering

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#1a1b26", "primaryTextColor": "#c0caf5", "primaryBorderColor": "#414868", "lineColor": "#7aa2f7", "secondaryColor": "#16161e", "tertiaryColor": "#1a1b26", "clusterBkg": "#16161e", "titleColor": "#c0caf5", "edgeLabelBackground": "#1a1b26", "nodeTextColor": "#c0caf5"}}}%%
flowchart LR
    C["Client"]
    GW["API Gateway<br/>(supergraph)"]
    IS["Index Subgraph<br/>owns: Index, Constituent"]
    PS["Pricing Subgraph<br/>owns: Price, PriceHistory"]
    PF["Portfolio Subgraph<br/>owns: Portfolio, Position"]
    RS["Risk Subgraph<br/>owns: RiskMetrics, VaR"]

    C --> GW
    GW --> IS
    GW --> PS
    GW --> PF
    GW --> RS
```

### GraphQL Federation — Subgraph Schema (Index Service)

The index subgraph declares `Index` and `Constituent` as entities with `@key` — the field(s) that uniquely identify them. Other subgraphs reference these entities by key to extend them with additional fields.

```graphql
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

### GraphQL Federation — Subgraph Schema (Pricing Service)

The pricing subgraph extends `Constituent` with price-related fields. It references `symbol` as the entity key (`@external`) without owning the type definition — the gateway merges both subgraph schemas at query time.

```graphql
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

### GraphQL Federation — Python Subgraph with Strawberry

`@strawberry.federation.type(keys=["symbol"])` marks the type as a federated entity. `resolve_reference` is called by the gateway when it needs to hydrate an entity from its key fields — the pricing subgraph receives a `Constituent` stub with only `symbol` populated and loads the rest.

```python
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

### GitHub GraphQL API — Setup and Authentication

A minimal async client wrapping `httpx`. All GitHub GraphQL requests authenticate with a `Bearer` token from the environment and raise on both HTTP errors and GraphQL-level errors.

```python
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

### GitHub GraphQL API — Find Latest Release of a Factor Model

Fetches the latest published release of a repository, returning the tag name, publish date, and download URLs for all attached release assets — useful for pulling versioned model files in a pipeline.

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

### GitHub GraphQL API — Find Open PRs with a Specific Label

Lists open pull requests carrying a specific label, ordered by creation date. Used to audit pipeline-update PRs or trigger automation on labeled branches.

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

### GitHub GraphQL API — Create a Pull Request Programmatically

Opens a PR from a given head branch to a base branch. The `repositoryId` is a node ID retrieved from a separate `repository` query. The mutation returns the PR number and URL for logging and notification.

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

### GitHub GraphQL API — Monitor CI Status

Polls the check run rollup for a branch until the CI state resolves to `SUCCESS`, `FAILURE`, or `ERROR`. Used to gate downstream pipeline steps on CI passing.

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
> **High-throughput data streaming**: GraphQL subscriptions are WebSocket-based and JSON-encoded. For thousands of events per second, use [gRPC server streaming](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/grpc-for-data-pipelines) or Apache Kafka from [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture). GraphQL subscriptions are for human-scale real-time updates.
>
> **File uploads**: The GraphQL multipart request spec is awkward. Use signed cloud storage URLs (GCS, S3) or a dedicated REST endpoint for uploads.
>
> **Teams unfamiliar with the N+1 problem**: An unoptimized GraphQL API can be dramatically slower than REST because of accidental N+1 queries. The DataLoader pattern must be applied diligently. REST endpoints are easier to profile.
>
> **Public APIs requiring aggressive HTTP caching**: Because GraphQL queries are typically POST requests with unique query strings, standard HTTP caching (ETags, CDNs) does not apply without specialized tooling like persisted queries. REST APIs on GET endpoints cache naturally.

> [!success] When GraphQL Is the Right Choice
> GraphQL excels when multiple consumer teams need different projections of the same data — a trading dashboard, a regulatory pipeline, and a Jupyter notebook each compose their own query without requiring new REST endpoints. Pair it with DataLoaders from day one, enable introspection in development and disable in production, and use persisted queries if aggressive HTTP caching is required. For file uploads, use signed GCS URLs and call the GraphQL mutation with the URL only, never the file bytes.

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

- [rest-api-design-and-consumption](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption) — REST patterns and comparison with GraphQL
- [grpc-for-data-pipelines](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/grpc-for-data-pipelines) — gRPC server streaming as the alternative for high-throughput real-time data
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) — JSON, protobuf, Avro; encoding trade-offs for API payloads
- [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — Federation as the data mesh API layer pattern
- [streaming-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/streaming-architecture) — When to use streaming (Kafka, gRPC) instead of GraphQL subscriptions
