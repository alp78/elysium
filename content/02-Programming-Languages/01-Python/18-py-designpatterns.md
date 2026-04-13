---
title: "18 - Design Patterns - Python"
tags: [python, design-patterns]
aliases: [design patterns, singleton, factory, observer, strategy, repository, dependency injection]
description: "Python design patterns and architecture reference with executable examples and cell outputs — covers singleton, factory, observer, strategy, repository patterns, and dependency injection. See [18-cs-designpatterns](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/18-cs-designpatterns) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 18. Design Patterns & Architecture - Python

> [!quote]
> "When I see patterns in my programs, I consider it a sign of trouble. The shape of a program should reflect only the problem it needs to solve."
>
> — **Paul Graham**, *Revenge of the Nerds*, essay (2002)

> [!abstract]- Summary
>
> **Dependency Injection** — Constructor injection pattern: classes receive dependencies (`DataRepository`, `NotificationService`) via `__init__` rather than creating them internally. ABCs define contracts; production and test wiring differ only in the objects passed.
>
> **Design Patterns** — Six patterns with executable examples: Singleton (`__new__` override or module-level variable), Factory (dict-dispatch function returning the correct subclass), Observer (callback-list event bus with `subscribe`/`publish`), Strategy (injected algorithm object with a shared ABC interface), Decorator (composition-based class wrapping), Repository (ABC over data access, swappable via DI).
>
> **Data Validation** — Pydantic `BaseModel` validates field types, `Field()` constraints, and cross-field rules via `@model_validator` at construction time. `ValidationError` is raised at the boundary before bad data enters the pipeline.
>
> **Reflection / Introspection** — `type()`, `isinstance()`, `dir()`, `vars()`, `getattr()`, and the `inspect` module for runtime examination of classes, attributes, methods, and signatures.
>
> **Project Structure & Best Practices** — Layered package layout (`fetchers/`, `transforms/`, `loaders/`, `services/`), separation of concerns, boundary validation, environment-based config, and test strategy.
>
> **Summary** — Mermaid decision flowchart and quick-reference table mapping each pattern to its Python idiom and C# equivalent.

> [!note]- Glossary
>
> **Design pattern**
> - A named, reusable design approach for a recurring software-structure problem, described at the level of intent rather than tied to one exact implementation.
> - Used to give teams a shared vocabulary for discussing trade-offs and solutions without re-explaining the full structure every time.
>
> > [!tip] Patterns are a vocabulary, not a checklist
> >
> > A pattern is useful only when it fits the problem. Applying one because it is famous or fashionable usually adds indirection without solving anything important.
>
> ---
>
> **Dependency Injection (DI)**
> - Design approach in which an object receives the collaborators it depends on from outside, rather than constructing those collaborators internally.
> - Used to reduce coupling, improve testability, and make it easier to substitute implementations such as mocks, fakes, or alternative backends.
>
> > [!tip] Inject abstractions, not concretions
> >
> > Prefer depending on an interface, `Protocol`, or abstract contract rather than a concrete implementation class. That preserves substitutability and keeps the caller decoupled from implementation details.
>
> ---
>
> **Singleton**
> - Pattern that restricts a class or resource to a single shared instance within a chosen scope, often a process or application runtime.
> - Used for state or resources that should be coordinated centrally, such as a configuration object, cache, or connection pool handle.
>
> > [!warning] Thread safety and testability are the real risks
> >
> > Naive Singleton implementations are often unsafe under concurrency and awkward to reset in tests. In Python, a module-level shared object is usually simpler and clearer than a custom class-based Singleton.
>
> ---
>
> **Factory**
> - Function, method, or object whose responsibility is to create and return another object while hiding some or all construction details from the caller.
> - Used to centralize creation logic, choose implementations dynamically, and keep callers independent of concrete class names and setup details.
>
> > [!warning] A factory should not absorb unrelated business logic
> >
> > Creation decisions belong in the factory; domain decisions usually do not. Once the factory starts owning workflow policy, pricing rules, or business branching, it stops being just a creation abstraction.
>
> ---
>
> **Observer / Event bus**
> - Publish-subscribe design in which one component emits events and other components subscribe to be notified when those events occur.
> - Used to decouple event producers from event consumers so new reactions can be added without rewriting the producer.
>
> > [!warning] Subscription lifecycle matters
> >
> > If listeners are registered repeatedly and never removed, the same event may trigger duplicate callbacks and memory may grow unexpectedly. Always manage subscription and teardown deliberately.
>
> ---
>
> **Strategy**
> - Pattern that encapsulates interchangeable algorithms or behaviors behind a common contract so a caller can switch among them without changing its own structure.
> - Used when a system needs runtime-selectable behavior, such as scoring rules, validation policies, or output formats.
>
> > [!tip] Composition is usually cleaner than subclass proliferation
> >
> > Injecting a strategy keeps the host object stable while the algorithm varies independently. This is often easier to test and extend than creating deep subclass hierarchies.
>
> ---
>
> **Decorator pattern**
> - Pattern in which one object wraps another object that implements the same conceptual interface and adds behavior before or after delegating the call.
> - Used for cross-cutting concerns such as logging, caching, metrics, authorization, or retry behavior without modifying the wrapped class directly.
>
> > [!tip] Distinguish the pattern from Python decorator syntax
> >
> > Python's `@decorator` syntax is a language feature for transforming functions or classes. It can implement the Decorator idea in some cases, but it is not identical to the classic object-wrapper pattern.
>
> ---
>
> **Repository pattern**
> - Abstraction layer that exposes domain-oriented data access operations while hiding the details of the underlying storage mechanism.
> - Used to keep domain or service logic independent of whether data comes from SQL, an API, object storage, or an in-memory test implementation.
>
> > [!warning] Do not leak storage-specific details across the boundary
> >
> > If repository methods return ORM-specific rows or raise storage-driver-specific exceptions directly, the abstraction has failed. Translate infrastructure details into domain-friendly data and errors.
>
> ---
>
> **ABC (Abstract Base Class)**
> - Python mechanism for defining an explicit abstract contract using `abc.ABC` and `@abstractmethod`.
> - Used when a codebase wants enforced nominal inheritance and a clear, formal interface that subclasses must implement before they can be instantiated.
>
> > [!tip] ABC vs `Protocol`
> >
> > An ABC requires explicit inheritance. A `Protocol` supports structural subtyping, which is useful when you want interface-style compatibility without forcing a shared base class.
>
> ---
>
> **`__new__` vs `__init__`**
> - `__new__` creates and returns the instance object; `__init__` runs after creation to initialize that instance's state.
> - Used to explain object-construction control points, especially when implementing patterns such as Singleton or immutable object creation.
>
> > [!warning] `__init__` does not control allocation
> >
> > By the time `__init__` runs, the object already exists. Any logic that must decide whether a new instance should be created belongs in `__new__` or outside the class entirely.
>
> ---
>
> **Pydantic `BaseModel`**
> - Pydantic base class for defining typed data models with parsing, validation, and schema generation.
> - Used to validate input at system boundaries such as APIs, config loading, and file parsing, so downstream code can assume the data already satisfies declared constraints.
>
> > [!warning] Validation behavior depends on model configuration and operation
> >
> > Construction is validated by default, but not every later mutation is unless configured accordingly. Know the model's configuration before assuming post-construction assignments are automatically validated.
>
> ---
>
> **`getattr` / `setattr`**
> - Built-in Python functions for reading and writing object attributes dynamically by attribute name supplied as a string.
> - Used in reflective or metadata-driven infrastructure such as serializers, plugin dispatch, configuration loaders, and generic adapters.
>
> > [!warning] Dynamic attribute access can obscure control flow
> >
> > Overusing `getattr` and `setattr` inside domain logic makes code harder to trace, validate, and refactor. Keep this style mostly in infrastructure layers where the indirection is justified.
>
> ---
>
> **Module-level singleton**
> - Shared object created at module scope and reused through Python's module import cache, which normally executes a module once per interpreter process and then reuses it.
> - Used as the simplest Pythonic way to hold one shared instance of configuration or infrastructure state without implementing a custom Singleton class.
>
> > [!tip] Usually simpler than a class-based Singleton
> >
> > A module-level shared object avoids `__new__` tricks, repeated initialization guards, and extra boilerplate. Prefer it unless you specifically need lazy creation, explicit reset hooks, or more elaborate lifecycle control.

## Dependency Injection

> [!tip] Related pattern
>
> dbt's `ref()` and `source()` functions implement dependency injection at the SQL layer — models declare their dependencies explicitly rather than hardcoding table names, enabling the same swap-and-test pattern shown below. See [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts) for details.

A class receives its dependencies (DB connection, API client, logger) through its constructor, NOT by creating them internally. This enables testability (swap real DB for mock), flexibility (swap providers), and single responsibility. In Python, no framework is needed — just pass objects via `__init__`. C# equivalent: `Microsoft.Extensions.DependencyInjection` (`builder.Services.AddXxx`).

> [!warning] Anti-pattern — hardcoded dependencies
>
> ```python
> class PipelineService:
>     def __init__(self):
>         self.db = PostgresConnection("prod-host")  # hardcoded!
> ```
> Instead, inject via constructor: `def __init__(self, db, storage):`

> [!success] Inject dependencies via constructor
>
> ```python
> class PipelineService:
>     def __init__(self, db: DatabaseClient, storage: StorageClient):
>         self.db = db          # injected — swap for mock in tests
>         self.storage = storage
>
> # Production
> svc = PipelineService(db=PostgresConnection("prod-host"), storage=GCSClient())
> # Test
> svc = PipelineService(db=MockDatabase(), storage=MockStorage())
> ```

### Abstract base classes

ABCs define the contract. Every consumer — the pipeline service, tests, future implementations — programs against these rather than concrete classes.

#### DataRepository — data access contract

Declares `get_prices` and `save_scores`. Same signature whether the backend is SQL, BigQuery, or an in-memory mock.

```python
from abc import ABC, abstractmethod
from datetime import date
from pydantic import BaseModel, Field, model_validator, ValidationError
from typing import Callable
from typing import Optional
import inspect

class DataRepository(ABC):
    """Interface for data access — could be SQL, BigQuery, CSV, mock."""
    @abstractmethod
    def get_prices(self, ticker: str) -> list[dict]:
        ...

    @abstractmethod
    def save_scores(self, scores: list[dict]) -> int:
        ...
```

#### NotificationService — notification contract

Single-method contract for pipeline notifications.

```python
class NotificationService(ABC):
    """Interface for notifications — could be email, Slack, Pub/Sub, mock."""
    @abstractmethod
    def notify(self, message: str) -> None:
        ...
```

### Production implementations

Each concrete class implements one ABC and handles the actual I/O — database queries, Slack API calls, etc.

#### SqlRepository — database-backed data access

Connects to a SQL database and implements both retrieval and persistence. Connection string is injected. In production, `get_prices` would execute a parameterized query (`cursor.execute("SELECT * FROM prices WHERE ticker=?", ticker)`) — here it returns sample data for demonstration.

```python
class SqlRepository(DataRepository):
    """Real implementation — talks to a database."""
    def __init__(self, connection_string: str):
        self.conn_str = connection_string
        print(f"  SqlRepository connected to: {connection_string[:30]}...")

    def get_prices(self, ticker: str) -> list[dict]:
        return [{"ticker": ticker, "close": 178.50, "date": "2026-03-20"}]

    def save_scores(self, scores: list[dict]) -> int:
        print(f"  SqlRepository: saved {len(scores)} scores to database")
        return len(scores)
```

#### SlackNotifier — Slack notifications

Sends formatted pipeline notifications to Slack.

```python
class SlackNotifier(NotificationService):
    def notify(self, message: str) -> None:
        print(f"  Slack: {message}")
```

### Test doubles

Replace production dependencies with in-memory alternatives. No database, no network — tests run in milliseconds.

#### MockRepository — in-memory data access

Returns hardcoded prices, captures every saved score in a list. Inspect `saved` after the test.

```python
class MockRepository(DataRepository):
    """Test implementation — no database needed."""
    def __init__(self):
        self.saved: list[dict] = []

    def get_prices(self, ticker: str) -> list[dict]:
        return [{"ticker": ticker, "close": 100.0, "date": "2026-01-01"}]

    def save_scores(self, scores: list[dict]) -> int:
        self.saved.extend(scores)
        return len(scores)
```

#### MockNotifier — notification capture

Collects messages instead of sending them. Inspect `messages` after the run.

```python
class MockNotifier(NotificationService):
    def __init__(self):
        self.messages: list[str] = []
    def notify(self, message: str) -> None:
        self.messages.append(message)
```

### Pipeline service

The service class depends only on the two ABCs — it has no knowledge of SQL, Slack, or mocks.

#### PipelineService — constructor-injected orchestrator

Constructor receives both dependencies via `__init__`. `run()` orchestrates: fetch prices, compute score, persist, notify.

```python
class PipelineService:
    """Orchestrates the pipeline — dependencies injected via constructor."""
    def __init__(self, repo: DataRepository, notifier: NotificationService):
        self.repo = repo
        self.notifier = notifier

    def run(self, ticker: str) -> dict:
        prices = self.repo.get_prices(ticker)
        score = {"ticker": ticker, "momentum": 0.85, "rank": 1}
        self.repo.save_scores([score])
        self.notifier.notify(f"Pipeline done: {ticker} scored {score['momentum']}")
        return score
```

### Wiring — production vs. test

The same `PipelineService` class is used in both contexts. Only the objects passed to `__init__` change.

#### Production wiring

`SqlRepository` connects to prod database, `SlackNotifier` sends to team channel.

```python
prod_service = PipelineService(
    repo=SqlRepository("Server=prod-db;Database=stoxx"),
    notifier=SlackNotifier(),
)
result = prod_service.run("ASML.AS")
print(result)
```

```text
SqlRepository connected to: Server=prod-db;Database=stoxx...
SqlRepository: saved 1 scores to database
Slack: Pipeline done: ASML.AS scored 0.85
{'ticker': 'ASML.AS', 'momentum': 0.85, 'rank': 1}
```

#### Test wiring — swap mocks with zero code changes

Replace every dependency with a mock. `PipelineService.__init__` is identical. After the run, inspect the mock's captured state.

```python
mock_repo = MockRepository()
mock_notifier = MockNotifier()
test_service = PipelineService(repo=mock_repo, notifier=mock_notifier)
result = test_service.run("TEST.XX")
print(result)
print(mock_repo.saved)
print(mock_notifier.messages)
```

```text
{'ticker': 'TEST.XX', 'momentum': 0.85, 'rank': 1}
[{'ticker': 'TEST.XX', 'momentum': 0.85, 'rank': 1}]
['Pipeline done: TEST.XX scored 0.85']
```

## Design Patterns

Design patterns are reusable solutions to common software design problems. In data engineering, they structure pipelines for testability, extensibility, and separation of concerns. The patterns below — singleton, factory, observer, strategy, decorator, and repository — appear frequently in production index-calculation and ETL codebases. Python's first-class functions and duck typing make many patterns lighter than their C# counterparts.

### Singleton — ensure exactly one instance of a class

Ensures a class has exactly ONE instance — useful for database connection pools, configuration managers, or loggers. In Python, the `__new__` method controls instance creation (it runs *before* `__init__`): if an instance already exists, return it instead of creating a new one. The `__init__` guard (`if self._initialized: return`) prevents re-running setup on subsequent calls. Singletons make testing harder (global state) — prefer DI with a single instance when possible.

> [!tip] Modules are natural singletons
>
> In Python, a module is only imported once. A database connection created at module level (`conn = create_connection()`) is effectively a singleton. No pattern needed.

#### Config — singleton with \_\_new\_\_

A private `_instance` class variable stores the single instance. `__new__` checks whether an instance already exists — if so, returns the existing one. The `_initialized` guard in `__init__` prevents re-running setup on subsequent calls.

```python
class Config:
    """Singleton configuration — only one instance ever created."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.project_id = "index-lab-2"
        self.region = "europe-west1"
        self.batch_size = 5000
        print(f"  Config loaded (project={self.project_id})")
```

#### Verifying single-instance behavior

Both calls to `Config()` return the same object — `__init__` runs only on the first call (the `_initialized` guard skips re-execution). `is` confirms identity. A simpler alternative is a module-level variable — Python modules are imported once, making them natural singletons without any pattern.

```python
c1 = Config()
c2 = Config()
print(c1 is c2)
print(c1.project_id)
```

```text
Config loaded (project=index-lab-2)
True
index-lab-2
```

### Factory — create objects without specifying the exact class

Creates objects without specifying the exact class — select the right implementation based on config or environment. A factory function or method decides which class to instantiate based on input. `create_parser("csv")` returns a CSVParser; `create_parser("json")` returns a JSONParser. The caller doesn't need to know the concrete classes. In Python, use a function or `@classmethod` that returns the right subclass. C# equivalent: static factory method, or `IServiceProvider.GetService<T>()`.

#### StorageClient ABC and concrete backends

The abstract base class declares a single `upload` method. Three implementations — GCS, S3, and local filesystem — each format the upload result differently. Adding a new backend means adding one class and one entry in the factory.

```python
class StorageClient(ABC):
    @abstractmethod
    def upload(self, path: str, data: bytes) -> str: ...

class GCSClient(StorageClient):
    def upload(self, path: str, data: bytes) -> str:
        return f"gs://bucket/{path} ({len(data)} bytes)"

class S3Client(StorageClient):
    def upload(self, path: str, data: bytes) -> str:
        return f"s3://bucket/{path} ({len(data)} bytes)"

class LocalClient(StorageClient):
    def upload(self, path: str, data: bytes) -> str:
        return f"file://{path} ({len(data)} bytes)"
```

#### create_storage_client — factory function

Maps a provider string to a concrete class via dictionary dispatch. The caller gets back a `StorageClient` without knowing which class was instantiated.

```python
def create_storage_client(provider: str = "gcs") -> StorageClient:
    """Factory: create storage client based on provider name."""
    clients = {
        "gcs": GCSClient,
        "s3": S3Client,
        "local": LocalClient,
    }
    if provider not in clients:
        raise ValueError(f"Unknown provider: {provider}. Choose from: {list(clients.keys())}")
    return clients[provider]()
```

#### Provider-agnostic usage

The loop creates three clients through the factory. Each upload returns a provider-specific path — the consuming code is identical regardless of backend.

```python
for provider in ["gcs", "s3", "local"]:
    client = create_storage_client(provider)
    result = client.upload("bronze/data.csv", b"OHLCV data")
    print(f"  {provider:5s} -> {result}")
```

```text
gcs   -> gs://bucket/bronze/data.csv (10 bytes)
s3    -> s3://bucket/bronze/data.csv (10 bytes)
local -> file://bronze/data.csv (10 bytes)
```

### Observer — one-to-many event notification

One-to-many notification: when a subject changes state, all registered observers are notified. In Python, implement with callbacks (list of functions) or the built-in `property` setter that triggers notifications. Notifies multiple listeners when something happens — pipeline events (step completed, error occurred, data ready). Multiple consumers react to the same event without coupling. C# equivalent: `event`/`delegate` pattern, or `IObservable<T>`. GCP equivalent: Pub/Sub (same pattern, distributed).

#### PipelineEventBus — subject

The event bus maintains a dictionary of event names to subscriber lists. `subscribe()` registers a callback; `publish()` iterates all subscribers for that event type and invokes each one.

```python
class PipelineEventBus:
    """Simple observer/event bus — subscribe to events, publish notifications."""
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}

    def subscribe(self, event: str, callback: Callable) -> None:
        """Register a callback for an event type."""
        self._subscribers.setdefault(event, []).append(callback)

    def publish(self, event: str, data: dict) -> None:
        """Notify all subscribers of an event."""
        for callback in self._subscribers.get(event, []):
            callback(data)
```

#### Handler functions — observers

Three lightweight handlers subscribe to the same event type. `log_handler` prints every event, `metrics_handler` only fires when the event carries row counts, and `alert_handler` only fires on errors. Each handler is independent.

```python
def log_handler(data: dict):
    print(f"  [LOG]   {data}")

def alert_handler(data: dict):
    if data.get("status") == "error":
        print(f"  [ALERT] Pipeline error: {data.get('message')}")

def metrics_handler(data: dict):
    if "rows" in data:
        print(f"  [METRIC] rows_loaded = {data['rows']}")
```

#### Wiring subscribers and publishing events

All three handlers subscribe to `"step_completed"`. Publishing three pipeline events demonstrates selective handling — the ok events trigger LOG + METRIC, the error event triggers LOG + ALERT.

```python
bus = PipelineEventBus()
bus.subscribe("step_completed", log_handler)
bus.subscribe("step_completed", metrics_handler)
bus.subscribe("step_completed", alert_handler)

bus.publish("step_completed", {"step": "ohlcv_load", "status": "ok", "rows": 306})
bus.publish("step_completed", {"step": "silver_transform", "status": "ok", "rows": 306})
bus.publish("step_completed", {"step": "gold_score", "status": "error", "message": "BQ timeout"})
```

```text
[LOG]   {'step': 'ohlcv_load', 'status': 'ok', 'rows': 306}
[METRIC] rows_loaded = 306
[LOG]   {'step': 'silver_transform', 'status': 'ok', 'rows': 306}
[METRIC] rows_loaded = 306
[LOG]   {'step': 'gold_score', 'status': 'error', 'message': 'BQ timeout'}
[ALERT] Pipeline error: BQ timeout
```

### Strategy — swap algorithms at runtime

Swap algorithms at runtime by passing functions or objects with a common interface. Instead of if/else chains selecting a scoring method, accept the scoring function as a parameter. Python's first-class functions make this trivial: just pass the function directly. Useful for different scoring algorithms, export formats, or retry policies. The context class delegates to a strategy object. C# equivalent: interface + DI, or `Func<T>` delegate.

#### ScoringStrategy — algorithm contract

The ABC declares two methods: `score()` takes a price list and returns a float, `name()` identifies the strategy. Every concrete strategy implements both.

```python
class ScoringStrategy(ABC):
    """Interface for different scoring algorithms."""
    @abstractmethod
    def score(self, prices: list[float]) -> float: ...

    @abstractmethod
    def name(self) -> str: ...
```

#### MomentumStrategy

Scores based on the latest price relative to the mean — positive means the latest is above average, suggesting upward momentum.

```python
class MomentumStrategy(ScoringStrategy):
    """Score based on price momentum (last vs average)."""
    def score(self, prices: list[float]) -> float:
        if not prices: return 0.0
        avg = sum(prices) / len(prices)
        return (prices[-1] - avg) / avg
    def name(self) -> str: return "Momentum"
```

#### VolatilityStrategy

Computes coefficient of variation (std dev / mean), negated so lower volatility yields a higher (less negative) score.

```python
class VolatilityStrategy(ScoringStrategy):
    """Score based on price volatility (lower = better)."""
    def score(self, prices: list[float]) -> float:
        if len(prices) < 2: return 0.0
        avg = sum(prices) / len(prices)
        variance = sum((p - avg) ** 2 for p in prices) / len(prices)
        return -(variance ** 0.5 / avg)  # negative: lower vol = higher score
    def name(self) -> str: return "Volatility"
```

#### MeanReversionStrategy

Scores based on distance below the mean — the farther the latest price is below average, the higher the score, betting on reversion to the mean.

```python
class MeanReversionStrategy(ScoringStrategy):
    """Score based on distance from mean (farther below = higher score)."""
    def score(self, prices: list[float]) -> float:
        if not prices: return 0.0
        avg = sum(prices) / len(prices)
        return (avg - prices[-1]) / avg  # below avg = positive score
    def name(self) -> str: return "MeanReversion"
```

#### StockScorer — strategy consumer

The context class receives any `ScoringStrategy` via `__init__`. `evaluate()` delegates to the injected strategy — the scorer does not know or care which algorithm it uses.

```python
class StockScorer:
    """Scores stocks using a pluggable strategy."""
    def __init__(self, strategy: ScoringStrategy):
        self.strategy = strategy  # injected

    def evaluate(self, ticker: str, prices: list[float]) -> dict:
        return {
            "ticker": ticker,
            "strategy": self.strategy.name(),
            "score": round(self.strategy.score(prices), 4),
        }
```

#### Evaluating with different strategies

The same ASML.AS price series is scored with all three strategies. Momentum and Volatility return small negatives; MeanReversion returns a small positive since the latest price is below average.

```python
prices = [685.0, 690.0, 680.0, 695.0, 710.0, 700.0, 685.0]

for strategy in [MomentumStrategy(), VolatilityStrategy(), MeanReversionStrategy()]:
    scorer = StockScorer(strategy)
    result = scorer.evaluate("ASML.AS", prices)
    print(f"  {result['strategy']:15s} score={result['score']:+.4f}")
```

```text
Momentum        score=-0.0103
Volatility      score=-0.0138
MeanReversion   score=+0.0103
```

### Decorator — wrap an object with additional behavior

Not to be confused with Python's `@decorator` syntax (which is a language feature). The decorator PATTERN wraps an object with additional behavior while keeping the same interface. Example: a `LoggingConnection` wraps a `DatabaseConnection`, adding logging to every query without modifying the original class. In Python, function decorators (`@functools.wraps`) are the most common form, but the OOP pattern applies when you need to compose behaviors on class instances.

### Repository — abstract data access behind a clean interface

Abstracts data access behind a clean interface. `repo.get_prices(symbol, date)` works whether the data comes from SQL Server, BigQuery, a CSV file, or a mock. The pipeline code depends on the interface, not the storage technology. Combined with dependency injection, this is the foundation for testable data pipelines — swap `SqlRepository` for `MockRepository` in tests without changing any pipeline logic.

## Data Validation

Pydantic validates data at construction time using Python type hints — if the input doesn't match the schema, a `ValidationError` is raised before bad data enters the pipeline. This catches problems at the boundary (API input, file parse, config load) rather than deep inside transformation logic where the root cause is harder to trace.

> [!info] Pydantic data validation
>
> - Define data shape with type hints — validates on construction, raises `ValidationError` if invalid
> - `Field()` — adds constraints (min, max, regex, default)
> - `model_validate()` — parses dict → model
> - `model_dump()` — serializes model → dict
> - Catches bad data at the boundary (API input, file load, config parse) before it flows into pipelines
> - C# equivalent: `DataAnnotations` (`[Required]`, `[Range]`) + FluentValidation

### Pydantic model validation

Pydantic validates data at construction time. Define the schema as a class with type hints and `Field` constraints — if input violates any rule, a `ValidationError` is raised immediately.

#### OhlcvRecord — validated price model

Each field uses `Field()` with constraints: `min_length`/`max_length` for strings, `gt`/`ge` for numeric bounds. The `@model_validator` adds a cross-field check ensuring High >= Low.

```python
class OhlcvRecord(BaseModel):
    """Validated OHLCV record — catches bad data before pipeline ingestion."""
    symbol: str = Field(..., min_length=1, max_length=20, description="Ticker symbol")
    trade_date: date = Field(..., description="Trading date")
    open: float = Field(..., gt=0, description="Opening price")
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    close: float = Field(..., gt=0)
    volume: int = Field(..., ge=0)

    @model_validator(mode="after")
    def high_gte_low(self):
        if self.high < self.low:
            raise ValueError(f"high ({self.high}) must be >= low ({self.low})")
        return self
```

#### PipelineConfig — validated configuration

Configuration model with a regex pattern on `name`, bounded `batch_size` and `max_retries`, and a `dry_run` flag. Invalid config is caught before the pipeline starts.

```python
class PipelineConfig(BaseModel):
    """Validated pipeline configuration."""
    name: str = Field(..., pattern=r"^[a-z][a-z0-9_]*$")
    batch_size: int = Field(default=5000, ge=100, le=100_000)
    max_retries: int = Field(default=3, ge=0, le=10)
    source_bucket: str = Field(..., min_length=3)
    destination_table: str
    dry_run: bool = False
```

#### Valid data — passes all constraints

A well-formed OHLCV record and pipeline config. Pydantic returns the validated model; `model_dump()` serializes to dict.

```python
record = OhlcvRecord(
    symbol="ASML.AS", trade_date=date(2026, 3, 20),
    open=685.0, high=710.0, low=680.0, close=700.0, volume=1_500_000
)
print(record)
print(record.model_dump())

config = PipelineConfig(
    name="events_etl",
    source_bucket="index-lab-2-data",
    destination_table="index_data.bronze_ohlcv",
)
print(config)
```

```text
symbol='ASML.AS' trade_date=datetime.date(2026, 3, 20) open=685.0 high=710.0 low=680.0 close=700.0 volume=1500000
{'symbol': 'ASML.AS', 'trade_date': datetime.date(2026, 3, 20), 'open': 685.0, 'high': 710.0, 'low': 680.0, 'close': 700.0, 'volume': 1500000}
name='events_etl' batch_size=5000 max_retries=3 source_bucket='index-lab-2-data' destination_table='index_data.bronze_ohlcv' dry_run=False
```

#### Invalid data — caught at the boundary

Each invalid input triggers a different rule: negative price fails `gt=0`, High < Low fails the `model_validator`, empty symbol fails `min_length`, bad config name fails the regex pattern.

```python
bad_inputs = [
    {"label": "Negative price", "data": {"symbol": "X", "trade_date": "2026-01-01", "open": -5, "high": 10, "low": 8, "close": 9, "volume": 100}},
    {"label": "High < Low", "data": {"symbol": "X", "trade_date": "2026-01-01", "open": 10, "high": 5, "low": 8, "close": 9, "volume": 100}},
    {"label": "Empty symbol", "data": {"symbol": "", "trade_date": "2026-01-01", "open": 10, "high": 12, "low": 8, "close": 11, "volume": 100}},
    {"label": "Bad config name", "data": {"name": "Bad-Name!", "source_bucket": "b", "destination_table": "t"}},
]

for case in bad_inputs:
    try:
        if "symbol" in case["data"]:
            OhlcvRecord(**case["data"])
        else:
            PipelineConfig(**case["data"])
        print(f"  {case['label']}: PASSED (unexpected)")
    except ValidationError as e:
        print(f"  {case['label']}: CAUGHT — {e.errors()[0]['msg']}")
```

```text
Negative price: CAUGHT — Input should be greater than 0
High < Low: CAUGHT — Value error, high (5.0) must be >= low (8.0)
Empty symbol: CAUGHT — String should have at least 1 character
Bad config name: CAUGHT — String should match pattern '^[a-z][a-z0-9_]*$'
```

## Reflection / Introspection

Python is deeply introspective — you can inspect any object's type, attributes, methods, source code, and module at runtime. C# equivalent: `System.Reflection` (`typeof`, `GetType`, `GetProperties`, `GetMethods`). Use cases include plugin systems, serializers, ORMs, debugging, and documentation generation.

### Inspecting objects at runtime

Python's introspection tools operate on any object. The `TradeOrder` class below serves as the inspection target for every example in this section.

#### TradeOrder — inspection target

A trade model with a class attribute `MAX_QUANTITY`, four instance attributes set in `__init__`, a computed `notional()` method, and a custom `__repr__`.

```python
class TradeOrder:
    """Sample class to inspect."""
    MAX_QUANTITY = 1_000_000

    def __init__(self, ticker: str, side: str, quantity: int, price: float):
        self.ticker = ticker
        self.side = side
        self.quantity = quantity
        self.price = price

    def notional(self) -> float:
        return self.quantity * self.price

    def __repr__(self) -> str:
        return f"TradeOrder({self.ticker}, {self.side}, {self.quantity}, {self.price})"

order = TradeOrder("ASML.AS", "BUY", 100, 685.40)
```

#### type() and isinstance()

`type()` returns the class object itself, `type().__name__` gives the string name, `isinstance()` checks membership in a class hierarchy.

```python
print(type(order))
print(type(order).__name__)
print(isinstance(order, TradeOrder))
```

```text
<class '__main__.TradeOrder'>
TradeOrder
True
```

#### dir() — list public attributes and methods

`dir()` returns all attributes; filtering out dunder names shows the public API: class attributes, instance attributes, and methods together.

```python
public = [m for m in dir(order) if not m.startswith("_")]
print(public)
```

```text
['MAX_QUANTITY', 'notional', 'price', 'quantity', 'side', 'ticker']
```

#### vars() — instance attributes only

`vars()` returns the instance's `__dict__` — only attributes set in `__init__`, not class attributes or methods.

```python
print(vars(order))
```

```text
{'ticker': 'ASML.AS', 'side': 'BUY', 'quantity': 100, 'price': 685.4}
```

#### getattr() — dynamic attribute access

`getattr(obj, name)` retrieves an attribute by string name — Python's equivalent of C#'s reflection `GetProperty().GetValue()`. Combined with `callable()`, it distinguishes data attributes from methods.

```python
for attr in ["ticker", "side", "quantity", "notional"]:
    if hasattr(order, attr):
        val = getattr(order, attr)
        if callable(val):
            print(f"  {attr}() = {val()}")
        else:
            print(f"  {attr} = {val}")
```

```text
ticker = ASML.AS
side = BUY
quantity = 100
notional() = 68540.0
```

#### inspect module — deeper introspection

The `inspect` module examines classes and functions: `isclass()` checks type, `getmembers()` finds methods, `getfile()` locates the source, and `signature()` extracts parameter names and type annotations.

```python
print(inspect.isclass(TradeOrder))
print([m[0] for m in inspect.getmembers(order, predicate=inspect.ismethod)])
try:
    print(f"  Source file: {inspect.getfile(TradeOrder)}")
except OSError:
    print("  Source file: <notebook cell> (no file on disk)")

sig = inspect.signature(TradeOrder.__init__)
for name, param in sig.parameters.items():
    if name == "self": continue
    print(f"  {name}: {param.annotation.__name__ if param.annotation != inspect.Parameter.empty else 'Any'}")
```

```text
True
['__init__', '__repr__', 'notional']
<notebook cell> (no file on disk)

ticker: str
side: str
quantity: int
price: float
```

## Project Structure & Best Practices

A well-organized Python project separates concerns by responsibility (fetching, transforming, loading), keeps configuration external, and mirrors the source layout in tests. The structure below follows the package conventions used in production index-calculation pipelines.

### Recommended project layout

```text
index-pipeline/
├── pyproject.toml           # Project metadata, dependencies, tool config
├── requirements.txt         # Pinned dependencies (pip freeze)
├── .env                     # Local env vars (NEVER commit)
├── .gitignore               # Ignore .env, __pycache__, .venv, *.pyc
│
├── src/                     # Source code
│   ├── __init__.py
│   ├── config.py            # Configuration (env vars, defaults)
│   ├── models.py            # Pydantic models (OhlcvRecord, PipelineConfig)
│   ├── db.py                # Database connection factory
│   │
│   ├── fetchers/            # Data ingestion
│   │   ├── __init__.py
│   │   ├── ohlcv.py         # yfinance OHLCV fetcher
│   │   └── signals.py       # Daily/quarterly signal fetcher
│   │
│   ├── transforms/          # Bronze → Silver → Gold
│   │   ├── __init__.py
│   │   ├── clean.py         # Bronze → Silver (dedup, gap-fill)
│   │   └── score.py         # Silver → Gold (z-scores, ranks)
│   │
│   ├── loaders/             # Write to storage/DB
│   │   ├── __init__.py
│   │   ├── bigquery.py      # BigQuery loader
│   │   └── firestore.py     # Firestore writer
│   │
│   └── services/            # Business logic
│       ├── __init__.py
│       └── pipeline.py      # PipelineService (DI, orchestration)
│
├── tests/                   # Test code (mirrors src/)
│   ├── conftest.py          # Shared fixtures
│   ├── test_transforms.py   # Pure function tests
│   ├── test_loaders.py      # Mock external services
│   └── test_pipeline.py     # Integration tests
│
└── scripts/                 # CLI entry points
    ├── run_pipeline.py      # python scripts/run_pipeline.py --step ohlcv
    └── setup_index.py       # One-time index setup
```

### Key principles

**Separation of concerns** — `fetchers/` only fetch, `transforms/` only transform, `loaders/` only write. No fetcher should know about BigQuery. No loader should know about yfinance.

**Dependency injection** — `PipelineService` receives `DataRepository` and `NotificationService` via `__init__`. Tests swap in `MockRepository`. Production wires `SqlRepository`.

**Validate at boundaries** — Use Pydantic models when data enters the system (API input, file parse, config). Internal code trusts the validated models — no redundant checks downstream.

**Configuration from environment** — Never hardcode credentials, hosts, or bucket names. Use `os.environ.get()` with defaults, or Pydantic `BaseSettings` for typed config with automatic env-var binding.

**Test the transform, mock the boundary** — Transforms are pure functions — test directly with known inputs and expected outputs. Loaders and fetchers touch external systems — mock them with `unittest.mock` or `pytest-mock`.

## Summary

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
flowchart TD
    A["Which pattern?"] --> B{"Need exactly<br/>one instance?"}
    A --> C{"Need to create objects<br/>without knowing the class?"}
    A --> D{"Need to notify<br/>multiple listeners?"}
    A --> E{"Need to swap<br/>algorithms at runtime?"}
    A --> F{"Need to add behavior<br/>without modifying a class?"}
    A --> G{"Need to abstract<br/>data access?"}

    B -->|Yes| B1["<b>Singleton</b><br/>__new__ or module-level<br/>variable"]
    C -->|Yes| C1["<b>Factory</b><br/>dict dispatch<br/>{'gcs': GCS}[t]()"]
    D -->|Yes| D1["<b>Observer</b><br/>callback list<br/>bus.publish()"]
    E -->|Yes| E1["<b>Strategy</b><br/>inject via __init__<br/>self.strategy.score()"]
    F -->|Yes| F1["<b>Decorator</b><br/>@functools.wraps or<br/>class wrapping"]
    G -->|Yes| G1["<b>Repository</b><br/>ABC + __init__ DI<br/>swap impl in tests"]
```

> [!abstract]- Design Patterns Quick Reference
>
> | Pattern | Python | Usage |
> |---|---|---|
> | **Dependency Injection** | `def __init__(self, repo)` | Inject via constructor; `Service(SqlRepo())` in prod, `Service(MockRepo())` in test |
> | **Singleton** | `def __new__(cls)` | Create once, return same. Better: module-level variable (modules ARE singletons) |
> | **Factory** | `def create_client(t)` | `return {"gcs": GCS, "s3": S3}[t]()` — return right subclass |
> | **Observer** | `bus.subscribe("event", cb)` | Register listeners, `bus.publish("event", data)` notifies all |
> | **Strategy** | `def __init__(self, strategy)` | Inject algorithm, delegate via `self.strategy.evaluate()` |
> | **Decorator** | `class Wrapper(Interface)` | Wraps inner instance via composition, or `@functools.wraps` for functions |
> | **Repository** | `class Repo(ABC)` | Abstract data access, swap `SqlRepo` / `MockRepo` via DI |
> | **Validation** | `class Model(BaseModel)` | Pydantic auto-validates on creation with type hints + `Field()` |
> | **Reflection** | `type()`, `dir()`, `getattr()` | Type checking, attribute listing, dynamic access, `inspect.signature()` |
>
> **C# equivalents:** `ABC`/`abstractmethod` → `interface` | `__init__(dep)` → constructor injection | `AddSingleton<T>()` → DI lifetime | `Pydantic` → DataAnnotations + FluentValidation | `inspect` → `System.Reflection`

## Warnings

> [!warning] Singleton via `__init__` does not work
> Implementing Singleton logic inside `__init__` has no effect — by the time `__init__` runs, a new object already exists. Override `__new__` to intercept creation, or prefer a module-level variable, which Python's import cache makes automatically singleton.

> [!success] Correct pattern — module-level singleton
> Declare the shared resource once at module scope (`_pool = ConnectionPool()`). Every importer gets the same object. No `__new__` override, no lock, no boilerplate.

> [!warning] Injecting concrete classes breaks substitutability
> Typing a constructor parameter as `SqlRepository` means tests must spin up a real database. Define the parameter as an `ABC` (or `Protocol`) so any conforming implementation — including `MockRepository` — can be passed in without subclassing.

> [!success] Correct pattern — inject abstractions
> `class ReportService: def __init__(self, repo: IRepository): ...` — the type hint documents the contract; callers pass `SqlRepository()` in production and `MockRepository()` in tests, with no changes to `ReportService`.

> [!warning] Observer callbacks accumulate silently
> If a subscriber registers its callback each time a module is reloaded or a test runs without tearing down the bus, the same handler fires multiple times per event. Always provide a matching `unsubscribe` or use weak references for long-lived buses.

> [!success] Correct pattern — guard subscriptions
> Check whether the callback is already registered before appending: `if cb not in self._listeners[event]: self._listeners[event].append(cb)`. In tests, call `bus.unsubscribe(event, cb)` in `tearDown`.

> [!warning] Factory leaking construction details
> A factory whose body contains conditional business logic (`if tier == "premium": apply_discount()`) violates single responsibility. Factories create objects; they do not process them.

> [!success] Correct pattern — factories only construct
> `return {"gcs": GCSClient, "s3": S3Client}[storage_type]()` — one lookup, one instantiation. Post-creation configuration belongs in the caller or in the created class's `__init__`.

## Recommendations

- Use constructor injection as the default DI mechanism — it makes dependencies explicit, type-checkable, and mockable without any framework.
- Prefer the module-level singleton idiom over class-based `__new__` singletons unless you need lazy initialisation or inheritance.
- Define repository and service contracts as `ABC` subclasses with `@abstractmethod`; this enforces interface compliance at instantiation time and fails fast.
- Keep Pydantic models at the boundary (API request/response, config); do not let them leak into domain logic or database layers.
- Use `Protocol` (structural subtyping) when you cannot or do not want to inherit from an ABC — it enables duck-typed DI without a shared base class.
- Limit `getattr`/`setattr` reflection to infrastructure code (config loaders, serialisers); avoid it in domain logic where explicit attribute access is safer and more readable.
- When adding cross-cutting behaviour (logging, timing, retries), prefer the Decorator pattern over subclassing — composition is easier to test and combine.
- Review `inspect.signature()` usages in production paths; introspection adds runtime overhead and can break under `@functools.wraps` if not applied correctly.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `TypeError: Can't instantiate abstract class X` | Subclass does not implement every `@abstractmethod` | Check `X.__abstractmethods__` to see which methods are missing and implement them |
| Singleton returns a new instance in tests | Test creates instance before module cache is populated, or test resets `_instance` between runs | Use `importlib.reload()` carefully; prefer module-level singletons that tests do not reset |
| Pydantic `ValidationError` on nested model | Inner model receives a `dict` instead of a model instance | Pass the nested dict — Pydantic will coerce it; or call `InnerModel(**data)` explicitly |
| Factory raises `KeyError` for a valid type string | Type string has unexpected casing or whitespace | Normalise with `.lower().strip()` before the dict lookup; log unknown types before raising |
| Observer handler fires twice per event | Handler registered more than once (e.g., on each test setup) | Guard registration with an `if cb not in listeners` check; tear down bus state in `tearDown` |
| `getattr(obj, name)` returns wrong value after `setattr` | Object has `__slots__` or a descriptor that intercepts attribute access | Inspect `type(obj).__dict__` for descriptors; avoid `setattr` on slotted or frozen dataclasses |
| Strategy produces wrong result after swap | New strategy class does not match expected interface (method name or signature differs) | Define the strategy contract as an `ABC`; add a unit test that exercises every concrete strategy |
| Repository mock not called in unit test | Test injects the wrong instance (e.g., real repo leaked via default argument) | Never use mutable defaults in constructors; always inject explicitly in test setup |

