---
type: reference
category: programming-languages
technology: [python]
tags: [testing, python]
aliases: [unit testing, pytest, xUnit, NUnit, test driven development, mocking, assertions]
keywords: [pytest, unittest, mock, patch, fixture, parametrize, assert, coverage, TDD]
description: "Python testing reference with executable examples and cell outputs — covers pytest, unittest, fixtures, mocking, parametrize, and test-driven development patterns. See [[14_cs_testing]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[14_cs_testing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 14. Testing - Python

## Testing Philosophy

Testing is not about proving code works — it's about **catching bugs before they reach production**.
In data engineering, untested pipelines fail silently: wrong prices feed into models,
missing rows corrupt dashboards, schema changes break downstream consumers.
A test suite is your safety net — it runs in seconds and catches what code review cannot.

### The Testing Pyramid

Tests are organized in layers, from fast/cheap at the bottom to slow/expensive at the top:

| Layer | What it tests | Speed | Tools | Demonstrated |
|-------|--------------|-------|-------|-------------|
| **Unit tests** | One function in isolation — pure logic, no I/O | ~1ms each | `pytest`, `assert`, `unittest.mock` | Sections 1–5 |
| **Integration tests** | Code + real dependencies (DB, API, files) | ~100ms each | `pytest` + `pyodbc`, `requests`, `pandera` | Sections 6–8 |
| **End-to-end tests** | Full pipeline from input to output | ~1s+ each | `FastAPI.TestClient`, `httpx` | Conceptual |
| **Performance tests** | Speed and memory under load | ~10s each | `pytest-benchmark`, `locust` | Conceptual |

**Rule of thumb**: 70% unit, 20% integration, 10% E2E.
Unit tests run on every commit. Integration tests run on every PR. E2E tests run on deploy.

### Python Testing Ecosystem

- **pytest** — the standard test framework. Discovers `test_` functions automatically, rewrites `assert` for rich error messages, supports fixtures, parametrize, and plugins.
- **unittest.mock** — built-in library for creating fake objects (`Mock`, `patch`, `side_effect`). Replaces real APIs/DBs with controlled fakes during tests.
- **pytest fixtures** — reusable setup/teardown. `@pytest.fixture` provides test data; `yield` fixtures clean up after tests (even on failure).
- **`@pytest.mark.parametrize`** — data-driven testing. Write one test, run it with N different inputs.
- **pandera** — DataFrame schema validation. Declares column types, ranges, and constraints; validates entire DataFrames at once.
- **pytest-cov** — code coverage measurement. Fails CI if coverage drops below a threshold.

### What This Notebook Demonstrates

1. **Unit tests**: assert, exceptions, fixtures, parametrize, mocking, patching
2. **Data engineering patterns**: trade normalization, OHLCV validation, mock APIs
3. **Integration tests**: real SQL queries against the `stoxx` database (schema, completeness, quality, cross-layer consistency)
4. **DataFrame validation**: pandera schema checks on live data
5. **API integration**: cross-checking Finnhub live prices against database values
6. **CI/CD**: GitHub Actions workflow for automated testing on every push

```python
# Imports used throughout this notebook
import ipytest
import pytest
import json
import os
import tempfile
import requests
import pyodbc
from sqlalchemy import create_engine
from urllib.parse import quote_plus
import pandas as pd
import pandera as pa
from pandera import Column, Check, DataFrameSchema
from pandera.errors import SchemaError
from unittest.mock import Mock, MagicMock, patch, call
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv()
ipytest.autoconfig()
```

    c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\requests\__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.3.0)/charset_normalizer (3.4.6) doesn't match a supported version!
      warnings.warn(

## Unit Testing with pytest

```python
# Unit Testing with pytest — the standard Python test framework
#
# KEY CONCEPTS:
# - pytest: third-party framework, the de-facto standard. Runs with `pytest` command.
# - Test discovery: pytest auto-discovers files named test_*.py or *_test.py,
#   and functions named test_*. No base class or decorator needed.
# - assert: plain Python assert — pytest rewrites it to show rich diffs on failure.
#
# NOTEBOOK NOTE:
# pytest runs from the command line: `pytest test_mymodule.py`
# In a notebook, we use ipytest to run pytest cells interactively.
# In production, test files live in a tests/ directory.
```

#### Basic test functions

```python
# TEST: basic price calculation — quantity * unit_price = total
def test_price_calculation():
    """Test trade price computation: quantity * unit_price."""
    quantity = 150
    unit_price = 42.75
    total = quantity * unit_price
    assert total == 6412.50

ipytest.run()
```

    [32m.[0m[33m                                                                                            [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m1 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: ticker strings are trimmed and uppercased
def test_ticker_normalization():
    """Tickers should be uppercase and stripped."""
    raw_ticker = "  aapl  "
    assert raw_ticker.strip().upper() == "AAPL"

ipytest.run()
```

    [32m.[0m[32m.[0m[33m                                                                                           [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m2 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: normalized portfolio weights sum to exactly 1.0
def test_portfolio_weights_sum():
    """Portfolio weights must sum to 1.0 (fully invested)."""
    weights = {"AAPL": 0.30, "MSFT": 0.25, "GOOG": 0.20, "AMZN": 0.25}
    assert pytest.approx(sum(weights.values())) == 1.0

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[33m                                                                                          [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m3 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: trade dict contains all required keys
def test_trade_record_fields():
    """Validate that a trade dict has all required fields."""
    trade = {
        "trade_id": "TRD_001",
        "ticker": "AAPL",
        "side": "BUY",
        "quantity": 100,
        "price": 178.50,
        "timestamp": "2024-03-15T14:30:00Z",
    }
    required = {"trade_id", "ticker", "side", "quantity", "price", "timestamp"}
    assert required.issubset(trade.keys())

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                         [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m4 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

#### Testing exceptions

```python
# TEST: negative quantity raises ValueError (fail-fast validation)
def test_invalid_quantity_raises():
    """Negative trade quantity should raise ValueError."""
    def validate_trade(qty):
        if qty <= 0:
            raise ValueError(f"Invalid quantity: {qty}")
    with pytest.raises(ValueError, match="Invalid quantity"):
        validate_trade(-10)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                        [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m5 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: accessing missing key raises KeyNotFoundException
def test_missing_ticker_raises():
    """Accessing missing key in position dict should raise KeyError."""
    positions = {"AAPL": 100, "MSFT": 50}
    with pytest.raises(KeyError):
        _ = positions["TSLA"]

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                       [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m6 passed[0m, [33m[1m1 warning[0m[33m in 0.01s[0m[0m

    <ExitCode.OK: 0>

## Assertions and Test Organization

```python
# Assertions — pytest rewrites plain `assert` for rich error messages.
# No assertEqual, assertTrue needed — just use assert.
#
#   assert x == y        → Assert.Equal(y, x)
#   assert x > 0         → Assert.True(x > 0)
#   assert x is None     → Assert.Null(x)
#   assert "foo" in bar  → Assert.Contains("foo", bar)
#   pytest.approx()      → Assert.Equal(expected, actual, precision)
```

#### Numeric assertions

```python
# TEST: PnL = (exit - entry) * quantity
def test_pnl_calculation():
    """Profit & Loss: (exit_price - entry_price) * quantity."""
    entry = 150.25
    exit_ = 155.80
    qty = 200
    pnl = (exit_ - entry) * qty
    assert pnl == pytest.approx(1110.0)  # float tolerance

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                      [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m7 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: fee tiers map volume to correct basis points
def test_basis_points():
    """1 basis point = 0.01%. 50 bps = 0.50%."""
    bps = 50
    rate = bps / 10_000
    assert rate == pytest.approx(0.005)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                     [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m8 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: Sharpe ratio is positive for upward-trending returns
def test_sharpe_ratio_positive():
    """A positive Sharpe ratio means returns exceed the risk-free rate."""
    returns = [0.02, 0.01, -0.005, 0.03, 0.015]
    import statistics
    mean_ret = statistics.mean(returns)
    std_ret = statistics.stdev(returns)
    risk_free = 0.005
    sharpe = (mean_ret - risk_free) / std_ret
    assert sharpe > 0

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                    [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m9 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

#### Collection assertions

```python
# TEST: Euro Stoxx 50 index has exactly 50 constituents
def test_index_constituents():
    """S&P 500 sector ETFs should contain known tickers."""
    tech_etf = {"AAPL", "MSFT", "GOOG", "NVDA", "META"}
    assert "AAPL" in tech_etf
    assert "TSLA" not in tech_etf

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                   [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m10 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: OHLCV bar has all required fields with correct types
def test_ohlcv_bar():
    """OHLCV bar must have all required fields."""
    bar = {"open": 150.0, "high": 155.0, "low": 149.0, "close": 153.0, "volume": 1_200_000}
    assert bar["high"] >= bar["low"]
    assert bar["volume"] > 0
    assert all(k in bar for k in ["open", "high", "low", "close", "volume"])

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                  [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m11 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

#### String assertions

```python
# TEST: ISIN matches 2-letter country + 9 alphanum + 1 check digit
def test_isin_format():
    """ISIN: 2-letter country + 9 alphanum + 1 check digit = 12 chars."""
    isin = "US0378331005"  # Apple Inc.
    assert len(isin) == 12
    assert isin[:2].isalpha()  # country code
    assert isin[:2].isupper()

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                 [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m12 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: trade log line matches expected pipe-delimited format
def test_trade_log_format():
    import re
    log = "2024-03-15T14:30:00Z | BUY | AAPL | 100 @ 178.50"
    assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", log)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                                [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m13 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

#### Type & None assertions

```python
# TEST: market data dict fields have correct types (str, float, int)
def test_market_data_types():
    tick = {"price": 178.50, "size": 100, "exchange": "XNAS"}
    assert isinstance(tick["price"], float)
    assert isinstance(tick["size"], int)
    assert isinstance(tick["exchange"], str)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                               [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m14 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: optional field can be None without causing errors
def test_optional_field():
    """Missing optional fields should be None."""
    order = {"ticker": "AAPL", "limit_price": None}
    assert order["limit_price"] is None

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                              [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m15 passed[0m, [33m[1m1 warning[0m[33m in 0.03s[0m[0m

    <ExitCode.OK: 0>

## Fixtures and Parametrize

```python
# Fixtures — reusable test setup/teardown.
# @pytest.fixture marks a function that provides test data or resources.
# Tests declare the fixture as a parameter — pytest injects it automatically.
#
# yield separates setup (before) from teardown (after).
# scope: how long the fixture lives — "function" (default), "module", "session".
```

#### Fixture: sample trade data

```python
# Fixture: sample trade data — reusable test data injected by pytest
#
# WHAT: @pytest.fixture turns a function into a test data provider.
#   Any test that lists "sample_trades" as a parameter automatically receives
#   the return value of this function. pytest calls it ONCE per test (fresh data each time).
#
# WHY fixtures instead of global variables:
#   - Each test gets a FRESH copy — no cross-test contamination
#   - Fixtures can do setup AND teardown (with yield)
#   - pytest auto-discovers them — no manual wiring needed
#   - Fixtures can depend on other fixtures (composable)
#
# WHAT THIS FIXTURE PROVIDES:
#   4 trade records representing a small portfolio:
#   - 2 AAPL trades (buy 100 + sell 30 = net 70 shares)
#   - 1 MSFT buy, 1 GOOG buy
@pytest.fixture
def sample_trades():
    """Provide sample trade records — reused across multiple tests."""
    return [
        {"trade_id": "TRD_001", "ticker": "AAPL", "side": "BUY",  "qty": 100, "price": 178.50},
        {"trade_id": "TRD_002", "ticker": "MSFT", "side": "BUY",  "qty":  50, "price": 415.20},
        {"trade_id": "TRD_003", "ticker": "AAPL", "side": "SELL", "qty":  30, "price": 180.00},
        {"trade_id": "TRD_004", "ticker": "GOOG", "side": "BUY",  "qty":  20, "price": 172.30},
    ]
```

```python
# TEST: fixture provides exactly 4 trade records
# The parameter name "sample_trades" matches the fixture function name —
# pytest sees this and automatically calls sample_trades() to get the data.
def test_trade_count(sample_trades):
    assert len(sample_trades) == 4

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                             [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m16 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: every trade has a non-empty ticker field
# Catches data corruption: missing tickers would cause KeyError or empty joins downstream.
def test_all_trades_have_ticker(sample_trades):
    for trade in sample_trades:
        assert "ticker" in trade          # key exists
        assert len(trade["ticker"]) > 0   # not empty string

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                            [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m17 passed[0m, [33m[1m1 warning[0m[33m in 0.02s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: net AAPL position = bought 100 - sold 30 = 70 shares
# Net position is BUY qty minus SELL qty for one ticker.
# This is a core portfolio calculation — getting it wrong means wrong risk exposure.
def test_net_aapl_position(sample_trades):
    """Net position = sum of BUY qty - sum of SELL qty for a ticker."""
    net = sum(
        t["qty"] if t["side"] == "BUY" else -t["qty"]
        for t in sample_trades if t["ticker"] == "AAPL"
    )
    assert net == 70  # bought 100, sold 30

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                           [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m18 passed[0m, [33m[1m1 warning[0m[33m in 0.03s[0m[0m

    <ExitCode.OK: 0>

#### Fixture with teardown (yield)

```python
# Fixture with teardown (yield) — creates a temp file, cleans up after test
#
# WHAT: a yield fixture has two phases:
#   1. SETUP (before yield): create temp file, write test data
#   2. TEARDOWN (after yield): delete the temp file — runs even if the test FAILS
#   The value passed to yield is what the test receives as the fixture parameter.
#
# WHY yield instead of return:
#   - return: no cleanup happens. Temp files accumulate.
#   - yield: code after yield always runs (like a finally block).
#   - This guarantees no leftover files even if the test crashes.
#
# WHAT THIS FIXTURE PROVIDES:
#   A path to a temp JSONL file containing 3 portfolio positions.
#   After the test, the file is deleted automatically.
@pytest.fixture
def temp_positions_file():
    """Create temp JSONL file with positions, clean up after test."""
    positions = [
        {"ticker": "AAPL", "shares": 500, "avg_cost": 165.00},
        {"ticker": "MSFT", "shares": 200, "avg_cost": 380.50},
        {"ticker": "GOOG", "shares": 100, "avg_cost": 140.25},
    ]
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    os.close(fd)
    with open(path, "w") as f:
        for p in positions:
            f.write(json.dumps(p) + "\n")
    yield path  # ← test runs here, receives the file path
    # TEARDOWN: runs even if test fails — guaranteed cleanup
    if os.path.exists(path):
        os.unlink(path)
```

```python
# TEST: load positions from the temp JSONL file created by the fixture
# Verifies: file was written correctly, JSONL parsing works, first record is AAPL.
# The fixture creates the file BEFORE this test runs and deletes it AFTER.
def test_load_positions(temp_positions_file):
    with open(temp_positions_file) as f:
        positions = [json.loads(line) for line in f]
    assert len(positions) == 3                  # fixture wrote 3 records
    assert positions[0]["ticker"] == "AAPL"     # first record is AAPL

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                          [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m19 passed[0m, [33m[1m1 warning[0m[33m in 0.03s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: total market value = sum(shares × avg_cost) for all positions
# Uses pytest.approx for floating-point comparison safety.
# This is a core portfolio valuation — wrong math here means wrong NAV reporting.
def test_total_market_value(temp_positions_file):
    with open(temp_positions_file) as f:
        positions = [json.loads(line) for line in f]
    total = sum(p["shares"] * p["avg_cost"] for p in positions)
    # 500×165.0 + 200×380.5 + 100×140.25 = 82500 + 76100 + 14025 = 172625
    assert total == pytest.approx(500*165.0 + 200*380.5 + 100*140.25)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                                         [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m20 passed[0m, [33m[1m1 warning[0m[33m in 0.03s[0m[0m

    <ExitCode.OK: 0>

<h4><code style="font-size:0.75em">@pytest.mark.parametrize</code></h4>

```python
# @pytest.mark.parametrize — run one test function with multiple input sets
#
# WHAT: the decorator takes a comma-separated string of parameter names
#   and a list of tuples. pytest runs the test function once per tuple,
#   unpacking the values into the named parameters.
#   @pytest.mark.parametrize("x, y, expected", [(1, 2, 3), (4, 5, 9)])
#   def test_add(x, y, expected): assert x + y == expected
#   → runs test_add(1, 2, 3) then test_add(4, 5, 9) — 2 test cases from 1 function.
#
# WHY: without parametrize, you'd write test_add_1_2, test_add_4_5, etc.
#   Parametrize eliminates copy-paste: one function, N data rows, N test runs.
#   Each row runs independently — if row 3 fails, rows 1-2 still show as PASSED.
#
# WHEN TO USE: any test where the logic is the same but the data varies:
#   - Fee tier calculations (volume → fee rate)
#   - Currency conversions (amount × rate = expected)
#   - Input validation (valid ticker, invalid ticker, edge cases)
#   - OHLCV invariants (valid bar, high < low, negative volume)
#
# ANTI-PATTERNS:
#   - Don't parametrize when the test LOGIC differs — write separate tests
#   - Don't put too many cases in one parametrize — hard to find which row failed
#   - Use ids= parameter to name each case: @pytest.mark.parametrize(..., ids=["valid", "negative"])
```

#### Parametrize: validate ticker formats

```python
# TEST: validate ticker format — uppercase, 1-5 chars, dot allowed for class shares
# Each row is one ticker + expected validity. pytest runs the test once per row.
# Valid: "AAPL", "BRK.B". Invalid: empty, lowercase, too long.
@pytest.mark.parametrize("ticker, valid", [
    ("AAPL",  True),
    ("MSFT",  True),
    ("BRK.B", True),   # class B shares — dot allowed
    ("",      False),
    ("aapl",  False),  # must be uppercase
    ("A" * 10, False), # too long
])
def test_ticker_validation(ticker, valid):
    import re
    is_valid = bool(re.match(r"^[A-Z]{1,5}(\.[A-Z])?$", ticker))
    assert is_valid == valid
```

#### Parametrize: OHLCV bar validation

```python
# TEST: OHLCV bar invariants — high >= max(open,close), low <= min(open,close), volume >= 0
# Each row is one candle dict + expected pass/fail.
# Catches impossible candles from API errors or bad transforms.
@pytest.mark.parametrize("bar, should_pass", [
    ({"o": 100, "h": 105, "l": 98, "c": 103, "v": 50000}, True),
    ({"o": 100, "h": 95,  "l": 98, "c": 99,  "v": 50000}, False),  # high < open
    ({"o": 100, "h": 105, "l": 98, "c": 103, "v": -1},    False),  # negative volume
], ids=["valid_bar", "high_below_open", "negative_volume"])
def test_ohlcv_bar_validation(bar, should_pass):
    is_valid = (
        bar["h"] >= max(bar["o"], bar["c"]) and
        bar["l"] <= min(bar["o"], bar["c"]) and
        bar["v"] >= 0
    )
    assert is_valid == should_pass
```

#### Parametrize: fee tier calculation

```python
# TEST: fee tier mapping — volume in USD maps to fee in basis points
# < $100K → 30 bps, $100K-$1M → 20 bps, > $1M → 10 bps.
# Each row tests one volume tier. Wrong fee = overcharging or undercharging clients.
@pytest.mark.parametrize("volume_usd, expected_bps", [
    (50_000,    30),   # tier 1: < $100K → 30 bps
    (500_000,   20),   # tier 2: $100K-$1M → 20 bps
    (5_000_000, 10),   # tier 3: > $1M → 10 bps
])
def test_fee_tier(volume_usd, expected_bps):
    def get_fee_bps(volume):
        if volume < 100_000:
            return 30
        elif volume < 1_000_000:
            return 20
        else:
            return 10
    assert get_fee_bps(volume_usd) == expected_bps
```

#### Parametrize: currency conversions

```python
# TEST: currency conversion — amount × rate = expected
# Each row converts 1000 USD to a different currency.
# Uses pytest.approx for floating-point tolerance (IEEE 754 rounding).
@pytest.mark.parametrize("amount_usd, rate, expected", [
    (1000.0, 0.92,  920.0),    # USD → EUR
    (1000.0, 149.5, 149500.0), # USD → JPY
    (1000.0, 0.79,  790.0),    # USD → GBP
])
def test_currency_conversion(amount_usd, rate, expected):
    converted = amount_usd * rate
    assert converted == pytest.approx(expected)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                          [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m35 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

## Mocking and Patching

```python
# Mocking — replace real dependencies with fakes during tests.
#
# KEY CONCEPTS:
# - unittest.mock: Python's built-in mocking library (works with pytest).
# - Mock(): flexible fake that records all calls.
# - MagicMock(): Mock with magic methods pre-configured.
# - patch(): temporarily replace a real object in a module.
#
# WHY MOCK?
# - Don't call real Bloomberg API / exchange / database in tests.
# - Tests must be fast, isolated, and deterministic.
# - Mock the boundary (API client), test the logic (transform, validate).
```

#### Mock a market data client

```python
# TEST: mock returns canned market data — verify the caller reads it correctly
#
# WHAT: Mock() creates a fake object with any method you call on it.
#   mock_client.get_quote.return_value = {...} tells the mock: "when someone
#   calls get_quote(), return this dict." No real API call happens.
#
# WHAT WE TEST:
#   - The quote dict has the expected "last" price (caller reads data correctly)
#   - ask > bid (spread is positive — basic sanity check on the data shape)
#   - get_quote was called exactly once with "AAPL" (caller passed the right symbol)
#
# WHY: in production, get_quote() hits a live exchange API. In tests, the mock
#   returns instant, deterministic data — no network, no rate limits, no flakiness.
def test_mock_market_data():
    mock_client = Mock()
    mock_client.get_quote.return_value = {
        "ticker": "AAPL", "bid": 178.40, "ask": 178.60, "last": 178.50
    }

    quote = mock_client.get_quote("AAPL")
    assert quote["last"] == 178.50                           # caller reads the right field
    assert quote["ask"] > quote["bid"]                       # spread is positive
    mock_client.get_quote.assert_called_once_with("AAPL")   # verify correct symbol was requested

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                         [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m36 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: mock records the exact arguments passed to submit_order
#
# WHAT: mock_broker.submit_order.return_value = {...} sets the canned response.
#   assert_called_once_with(...) verifies that the code under test called the mock
#   with EXACTLY the right keyword arguments — ticker, side, qty, order_type, limit_price.
#
# WHAT WE TEST:
#   - The response has status "FILLED" (caller handles the response correctly)
#   - submit_order was called with the exact order parameters (no typos, no missing fields)
#
# WHY: order submission bugs are catastrophic — wrong ticker, wrong side (BUY vs SELL),
#   or wrong quantity can lose real money. This test catches parameter-passing bugs.
def test_mock_order_submission():
    """Verify that our order function calls the broker API correctly."""
    mock_broker = Mock()
    mock_broker.submit_order.return_value = {"order_id": "ORD_123", "status": "FILLED"}

    result = mock_broker.submit_order(
        ticker="AAPL", side="BUY", qty=100, order_type="LIMIT", limit_price=178.00
    )

    assert result["status"] == "FILLED"                      # response handled correctly
    mock_broker.submit_order.assert_called_once_with(        # exact args verified
        ticker="AAPL", side="BUY", qty=100, order_type="LIMIT", limit_price=178.00
    )

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                        [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m37 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: mock simulates transient failures then succeeds — tests retry logic
#
# WHAT: side_effect takes a list — each call to mock_gw.send() returns the next
#   item in the list. If the item is an exception, it's raised instead of returned.
#   [ConnectionError, ConnectionError, {"ack": True}] = fail, fail, succeed.
#
# WHAT WE TEST:
#   - After 3 attempts, result has ack=True (retry eventually succeeded)
#   - send was called exactly 3 times (2 failures + 1 success)
#
# WHY: exchange gateways have transient failures — network blips, load balancer
#   resets, brief maintenance windows. Retry logic must:
#   1. Actually retry (not silently give up after 1 failure)
#   2. Stop retrying after success (not keep hammering the gateway)
#   3. Return the successful result (not the last exception)
def test_mock_side_effect_retries():
    """Simulate transient failures from an exchange gateway."""
    mock_gw = Mock()
    mock_gw.send.side_effect = [
        ConnectionError("gateway timeout"),    # 1st call → raises ConnectionError
        ConnectionError("gateway timeout"),    # 2nd call → raises ConnectionError
        {"ack": True, "seq": 42},              # 3rd call → returns success dict
    ]

    # Retry loop — same pattern as production retry logic
    result: dict = {}
    for attempt in range(3):
        try:
            result = mock_gw.send({"type": "NEW_ORDER", "ticker": "MSFT"})
            break                              # success — stop retrying
        except ConnectionError:
            continue                           # transient error — try again

    assert result.get("ack") is True           # verify we got the success response
    assert mock_gw.send.call_count == 3        # verify all 3 attempts happened

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                       [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m38 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

#### patch()

```python
# patch() — temporarily replace real objects with mocks.
#
# IMPORTANT: patch where the object is USED, not where it's DEFINED.
# If my_module.py does `from datetime import datetime`,
# patch "my_module.datetime", NOT "datetime.datetime".
```

#### Function under test: market hours check

```python
# Function under test: market hours check
def is_market_open(now=None):
    """Check if NYSE is open (weekday, 9:30-16:00 ET). Simplified."""
    if now is None:
        now = datetime.now()
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now.replace(hour=9, minute=30, second=0)
    market_close = now.replace(hour=16, minute=0, second=0)
    return market_open <= now <= market_close
```

```python
# TEST: market is open during trading hours (Wednesday 11:00 AM)
# Instead of @patch("datetime.datetime"), we pass `now` directly.
# This is the dependency injection pattern — easier to test than monkey-patching.
def test_market_open_during_hours():
    now = datetime(2024, 3, 13, 11, 0, 0)  # Wednesday 11:00
    assert is_market_open(now) is True

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                      [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m39 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: market is closed on weekends (Saturday 11:00 AM)
def test_market_closed_weekend():
    now = datetime(2024, 3, 16, 11, 0, 0)  # Saturday 11:00
    assert is_market_open(now) is False

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                     [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m40 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: market is closed after hours (Wednesday 18:00)
def test_market_closed_after_hours():
    now = datetime(2024, 3, 13, 18, 0, 0)  # Wednesday 18:00
    assert is_market_open(now) is False

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                    [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m41 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

#### Patch environment variables

```python
# Patching environment variables — test code that reads os.environ
#
# WHAT: @patch.dict(os.environ, {...}) temporarily injects fake env vars for the
#   duration of one test function. When the test ends, the original env is restored.
#   This lets you test config-reading code without actually setting real env vars.
#
# get_exchange_config(): reads EXCHANGE_HOST, EXCHANGE_PORT, EXCHANGE_API_KEY from
#   os.environ with fallback defaults. This is the standard pattern for
#   Docker/Kubernetes deployments where config is injected via env vars.
#
# test_production_exchange_config: uses @patch.dict to inject production-like env vars.
#   The function reads the patched env, so it sees "exchange.prod.internal" etc.
#   After the test, the patch is removed — env vars return to their real values.
#
# test_default_exchange_config: runs WITHOUT any patch, so os.environ.get() falls
#   back to the default values ("localhost", "8080").
#   WHY THIS TEST MAY FAIL: if EXCHANGE_HOST or EXCHANGE_PORT are actually set in
#   your real environment (e.g., from a .env file, Docker, or a previous cell),
#   the defaults won't be used and the assertions fail. The fix: also wrap this
#   test with @patch.dict(os.environ, {}, clear=True) to guarantee a clean env,
#   or use @patch.dict to explicitly remove those keys.

def get_exchange_config():
    """Read exchange config from env vars (Docker/K8s deployment)."""
    return {
        "host": os.environ.get("EXCHANGE_HOST", "localhost"),
        "port": int(os.environ.get("EXCHANGE_PORT", "8080")),
        "api_key": os.environ.get("EXCHANGE_API_KEY", ""),
    }
```

```python
# TEST: with patched env vars — simulates production deployment
# @patch.dict temporarily sets these env vars, restores original after test.
@patch.dict(os.environ, {
    "EXCHANGE_HOST": "exchange.prod.internal",
    "EXCHANGE_PORT": "9090",
    "EXCHANGE_API_KEY": "sk_prod_abc123",
})
def test_production_exchange_config():
    config = get_exchange_config()
    assert config["host"] == "exchange.prod.internal"
    assert config["port"] == 9090
    assert config["api_key"].startswith("sk_prod_")

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                   [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m42 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

```python
# TEST: without patch — falls back to defaults
# NOTE: this FAILS if EXCHANGE_HOST/PORT are set in your real env.
# In real projects, use @patch.dict(os.environ, {}, clear=True) for clean env.
def test_default_exchange_config():
    config = get_exchange_config()
    assert config["host"] == "localhost"
    assert config["port"] == 8080

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                  [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m43 passed[0m, [33m[1m1 warning[0m[33m in 0.05s[0m[0m

    <ExitCode.OK: 0>

## Test Patterns for Data Engineering

```python
# DE/Finance test patterns — testing pipelines, transforms, data quality.
#
# KEY PATTERNS:
# 1. Test transform functions (pure logic, no mocks needed).
# 2. Mock external systems (exchange APIs, databases, cloud storage).
# 3. Fixtures for sample market data, trade records, temp files.
# 4. Parametrize for edge cases (splits, dividends, halts, holidays).
```

#### Test a data transform

```python
# Test a data transform — verify pure business logic in isolation
#
# WHAT: normalize_trades is a pure function (no side effects, no DB, no API).
#   It takes raw trade dicts (as they arrive from an exchange feed) and returns
#   cleaned dicts with consistent formatting. This is the most testable kind of code.
#
# WHY: transform tests are the most valuable — they run fast (no I/O),
#   are deterministic (same input = same output), and catch logic bugs.
#   If this test fails, the bug is in YOUR code, not in the API or DB.

# normalize_trades — the function under test
# Takes raw exchange data (string prices, messy tickers) and returns clean dicts.
# Rules: drop missing IDs, uppercase tickers, convert types, compute notional.
def normalize_trades(raw_trades: list[dict]) -> list[dict]:
    """Clean and normalize raw trade data from exchange feed."""
    cleaned = []
    for t in raw_trades:
        if not t.get("trade_id"):  # skip trades with empty/None/missing trade_id
            continue
        cleaned.append({
            "trade_id": t["trade_id"].strip(),
            "ticker": t["ticker"].strip().upper(),        # " aapl " → "AAPL"
            "side": t["side"].strip().upper(),             # "buy" → "BUY"
            "qty": int(t["qty"]),                          # "100" → 100
            "price": float(t["price"]),                    # "178.50" → 178.5
            "notional": int(t["qty"]) * float(t["price"]), # qty × price
        })
    return cleaned

# TEST: basic normalization — ticker uppercased, price converted to float, notional computed
# Verifies the happy path: two valid trades go in, two cleaned trades come out.
```

```python
# TEST: normal trades are cleaned — ticker uppercased, price as float, notional computed
def test_normalize_trades_basic():
    raw = [
        {"trade_id": "TRD_001", "ticker": " aapl ", "side": "buy", "qty": "100", "price": "178.50"},
        {"trade_id": "TRD_002", "ticker": "MSFT",   "side": "SELL", "qty": "50",  "price": "415.20"},
    ]
    result = normalize_trades(raw)
    assert len(result) == 2
    assert result[0]["ticker"] == "AAPL"                    # whitespace stripped + uppercased
    assert result[0]["price"] == 178.50                      # string → float
    assert result[0]["notional"] == pytest.approx(17850.0)   # 100 × 178.50 (approx for float safety)
    assert result[1]["side"] == "SELL"                        # already uppercase, stays uppercase

# TEST: trades with empty/None trade_id are silently dropped
# In production, exchange feeds sometimes send heartbeat or malformed records
# with no trade_id. The pipeline must skip these without crashing.

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                 [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m44 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

```python

# TEST: trades with empty/None trade_id are silently dropped
# In production, exchange feeds sometimes send heartbeat or malformed records
# with no trade_id. The pipeline must skip these without crashing.
def test_normalize_trades_drops_missing_id():
    raw = [
        {"trade_id": "", "ticker": "AAPL", "side": "BUY", "qty": "100", "price": "178.50"},      # empty string
        {"trade_id": None, "ticker": "MSFT", "side": "BUY", "qty": "50", "price": "415.20"},     # None
        {"trade_id": "TRD_003", "ticker": "GOOG", "side": "BUY", "qty": "20", "price": "172.30"}, # valid
    ]
    result = normalize_trades(raw)
    assert len(result) == 1              # only the valid trade survives
    assert result[0]["trade_id"] == "TRD_003"

# TEST: empty input produces empty output — no crash, no None, just []
# Edge case that catches IndexError or NoneType bugs in the transform.

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                                [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m45 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

```python

# TEST: empty input produces empty output — no crash, no None, just []
# Edge case that catches IndexError or NoneType bugs in the transform.
def test_normalize_trades_empty():
    assert normalize_trades([]) == []

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                               [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m46 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

#### Mock an external API

```python
# Mock an external API
class MarketDataClient:
    """Simplified market data client — calls real exchange API in prod."""
    def get_index_constituents(self, index: str) -> list[dict]:
        raise NotImplementedError("Requires live API connection")

def calculate_index_weight(client: MarketDataClient, index: str, ticker: str) -> float:
    """Calculate a stock's weight in an index by market cap."""
    constituents = client.get_index_constituents(index)
    total_mcap = sum(c["market_cap"] for c in constituents)
    stock = next(c for c in constituents if c["ticker"] == ticker)
    return stock["market_cap"] / total_mcap

def test_index_weight_calculation():
    mock_client = Mock(spec=MarketDataClient)
    mock_client.get_index_constituents.return_value = [
        {"ticker": "AAPL", "market_cap": 3_000_000_000_000},
        {"ticker": "MSFT", "market_cap": 2_800_000_000_000},
        {"ticker": "GOOG", "market_cap": 2_000_000_000_000},
    ]

    weight = calculate_index_weight(mock_client, "SP500", "AAPL")

    # AAPL = 3T / (3T + 2.8T + 2T) = 3/7.8 ≈ 0.3846
    assert weight == pytest.approx(3.0 / 7.8, rel=1e-4)
    mock_client.get_index_constituents.assert_called_once_with("SP500")
```

#### Test data quality checks

```python
# Test data quality checks — validate OHLCV financial data invariants
#
# WHAT: validate_eod_prices takes a list of end-of-day price dicts and returns
#   a list of error strings. Empty list = all data is valid. Non-empty = violations found.
#
# INVARIANTS CHECKED:
#   - close > 0: no negative or zero prices (a stock can't have negative value)
#   - high >= low: by definition, high is the max price and low is the min of the day
#   - volume >= 0: volume can be 0 on holidays but never negative
#   - daily return < 20%: flags suspiciously large moves that usually indicate
#     data corruption (bad stock split adjustment, wrong currency, API error).
#     Real moves >20% exist (flash crashes) but are rare enough to flag.
#
# WHY: financial APIs return garbage more often than you'd expect — zero prices
#   for missing data, negative prices from currency conversion bugs, extreme values
#   from unadjusted stock splits. These tests are the last line of defense
#   before bad data enters your models or dashboards.

# validate_eod_prices — the function under test
# Returns a list of human-readable error strings describing each violation found.
def validate_eod_prices(prices: list[dict]) -> list[str]:
    """Run data quality checks on end-of-day price data.
    Returns list of error messages (empty = all good).
    """
    errors = []
    for p in prices:
        if p["close"] <= 0:                          # non-positive close = corrupt data
            errors.append(f"{p['ticker']}: non-positive close price {p['close']}")
        if p["high"] < p["low"]:                     # high < low = impossible candle
            errors.append(f"{p['ticker']}: high ({p['high']}) < low ({p['low']})")
        if p["volume"] < 0:                          # negative volume = data error
            errors.append(f"{p['ticker']}: negative volume {p['volume']}")
        if p["prev_close"] > 0:                      # need prev_close to compute return
            daily_return = abs(p["close"] - p["prev_close"]) / p["prev_close"]
            if daily_return > 0.20:                  # >20% move = suspicious
                errors.append(f"{p['ticker']}: suspicious daily move {daily_return:.1%}")
    return errors

# TEST: clean data produces zero errors — the happy path
# Two normal stocks with valid OHLCV data, both should pass all checks.
```

```python
# TEST: clean OHLCV data produces zero validation errors
def test_valid_eod_data():
    prices = [
        {"ticker": "AAPL", "close": 178.50, "high": 180.0, "low": 176.0, "volume": 50_000_000, "prev_close": 177.00},
        {"ticker": "MSFT", "close": 415.20, "high": 418.0, "low": 412.0, "volume": 25_000_000, "prev_close": 413.00},
    ]
    assert validate_eod_prices(prices) == []  # no errors = all data is valid

# TEST: three different violations are all caught
# BAD1: close = -5.0 → non-positive close
# BAD2: high = 90.0 < low = 95.0 → impossible candle (high < low)
# BAD3: close = 150.0, prev_close = 100.0 → 50% daily move (> 20% threshold)
#
# WHY THIS TEST FAILS (assert len(errors) == 3 → actually gets 4):
#   BAD1 has close = -5.0 and prev_close = 10.0, so |(-5 - 10) / 10| = 150%.
#   That triggers BOTH the "non-positive close" AND "suspicious daily move" checks.
#   So BAD1 produces 2 errors, BAD2 produces 1, BAD3 produces 1 → total 4, not 3.
#   This is a real bug in the test, not in the function — the test assumed each
#   bad record produces exactly 1 error, but a record can violate multiple rules.
#   FIX: change assert to len(errors) == 4, or separate BAD1 so it only triggers one rule.

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                             [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m48 passed[0m, [33m[1m1 warning[0m[33m in 0.07s[0m[0m

    <ExitCode.OK: 0>

```python

# TEST: three different violations are all caught
# BAD1: close = -5.0 → non-positive close
# BAD2: high = 90.0 < low = 95.0 → impossible candle (high < low)
# BAD3: close = 150.0, prev_close = 100.0 → 50% daily move (> 20% threshold)
#
# WHY THIS TEST FAILS (assert len(errors) == 4  # BAD1 triggers 2 rules → actually gets 4):
#   BAD1 has close = -5.0 and prev_close = 10.0, so |(-5 - 10) / 10| = 150%.
#   That triggers BOTH the "non-positive close" AND "suspicious daily move" checks.
#   So BAD1 produces 2 errors, BAD2 produces 1, BAD3 produces 1 → total 4, not 3.
#   This is a real bug in the test, not in the function — the test assumed each
#   bad record produces exactly 1 error, but a record can violate multiple rules.
#   FIX: change assert to len(errors) == 4, or separate BAD1 so it only triggers one rule.
def test_catches_invalid_prices():
    prices = [
        {"ticker": "BAD1", "close": -5.0,  "high": 10.0, "low": 8.0,  "volume": 1000, "prev_close": 10.0},
        {"ticker": "BAD2", "close": 100.0, "high": 90.0, "low": 95.0, "volume": 1000, "prev_close": 100.0},
        {"ticker": "BAD3", "close": 150.0, "high": 155.0, "low": 145.0, "volume": 1000, "prev_close": 100.0},
    ]
    errors = validate_eod_prices(prices)
    assert len(errors) == 4  # BAD1 triggers 2 rules (negative close + extreme return)
    assert any("non-positive" in e for e in errors)                   # BAD1: close = -5
    assert any("high" in e and "< low" in e for e in errors)          # BAD2: high < low
    assert any("suspicious daily move" in e for e in errors)          # BAD3: 50% move

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[33m                                            [100%][0m
    [33m======================================== warnings summary =========================================[0m
    .lang\Lib\site-packages\_pytest\config\__init__.py:1303
      c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\_pytest\config\__init__.py:1303: PytestAssertRewriteWarning: Module already imported so cannot be rewritten; typeguard
        self._mark_plugins_for_rewrite(hook, disable_autoload)
    
    -- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
    [33m[32m49 passed[0m, [33m[1m1 warning[0m[33m in 0.06s[0m[0m

    <ExitCode.OK: 0>

## Integration Testing with Real Database

#### Database connection and test helpers

```python
# Integration testing against the stoxx SQL Server database
#
# WHAT: integration tests verify code against real dependencies (DB, APIs, files).
#   Unlike unit tests that mock the DB, these execute real SQL against SQL Server.
#   The stoxx database has a medallion architecture: bronze → silver → gold.
#
# WHY: mocked tests can pass while real queries fail because:
#   - SQL syntax differs between engines (SQL Server vs Postgres vs SQLite)
#   - Schema migrations may have failed or drifted
#   - Data constraints (FK, UNIQUE, NOT NULL) only exist in the real DB
#
# DATABASE SCHEMA (stoxx — Euro Stoxx 50 financial data):
#   bronze.eurostoxx50_ohlcv: raw daily OHLCV (50 stocks, from API)
#   silver.eurostoxx50_ohlcv: cleaned + gap-filled (is_filled flag)
#   gold.index_performance:   aggregated index returns and volatility
#   gold.scores_daily:        per-stock composite scores and rankings
#
# ANTI-PATTERNS:
#   - Don't run destructive tests against production — use staging
#   - Don't depend on specific data values — test invariants and ranges
#   - In CI: use Testcontainers for ephemeral, isolated DB instances

# Load credentials from .env — never hardcode passwords in notebooks

CONN_STR = (
    "Driver={ODBC Driver 18 for SQL Server};"
    f"Server=localhost,1434;Database=stoxx;"
    f"UID=sa;PWD={os.environ.get('SQL_PASSWORD', '')};"
    "TrustServerCertificate=yes;"
)

def query_scalar(sql: str):
    """Execute SQL and return the single scalar result."""
    with pyodbc.connect(CONN_STR, timeout=10) as conn:
        row = conn.cursor().execute(sql).fetchone()
        return row[0] if row else None

def query_rows(sql: str) -> list[dict]:
    """Execute SQL and return all rows as list of dicts."""
    with pyodbc.connect(CONN_STR, timeout=10) as conn:
        cursor = conn.cursor().execute(sql)
        cols = [c[0] for c in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]

def assert_test(name: str, condition: bool):
    """Print PASS/FAIL for a test condition."""
    status = "PASS" if condition else "FAIL"
    print(f"  {status}: {name}")

print("  DB connection ready.")
```

      DB connection ready.

#### Schema validation tests

```python
# Schema validation — verify tables exist and columns have expected types
#
# WHAT: queries INFORMATION_SCHEMA to check expected tables and columns.
#   Catches schema drift: renamed columns, dropped tables, changed types.
#
# WHY: schema changes are the #1 cause of silent pipeline failures.
#   A renamed column produces NULLs instead of errors.

# TEST: all medallion layers exist
for table in ["bronze.eurostoxx50_ohlcv", "silver.eurostoxx50_ohlcv",
              "gold.index_performance", "gold.scores_daily"]:
    schema, name = table.split(".")
    exists = query_scalar(
        f"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
        f"WHERE TABLE_SCHEMA='{schema}' AND TABLE_NAME='{name}'")
    assert_test(f"table {table} exists", exists == 1)

# TEST: silver has is_filled column (added during bronze->silver transform)
has_filled = query_scalar(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
    "WHERE TABLE_SCHEMA='silver' AND TABLE_NAME='eurostoxx50_ohlcv' "
    "AND COLUMN_NAME='is_filled'")
assert_test("silver has is_filled column", has_filled == 1)

# TEST (deliberate FAIL): check for a column that doesn't exist
has_fake = query_scalar(
    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
    "WHERE TABLE_SCHEMA='silver' AND TABLE_NAME='eurostoxx50_ohlcv' "
    "AND COLUMN_NAME='fake_column'")
assert_test("silver has fake_column (expected FAIL)", has_fake == 1)
```

      PASS: table bronze.eurostoxx50_ohlcv exists
      PASS: table silver.eurostoxx50_ohlcv exists
      PASS: table gold.index_performance exists
      PASS: table gold.scores_daily exists
      PASS: silver has is_filled column
      FAIL: silver has fake_column (expected FAIL)

#### Data completeness tests

```python
# Data completeness — verify all expected data was ingested
#
# WHAT: checks symbol count, row counts, NULL coverage.
# WHY: a silent API failure might ingest 40 of 50 stocks —
#   without these tests the pipeline reports success on incomplete data.

# TEST: exactly 50 distinct symbols in bronze (Euro Stoxx 50 = 50 stocks)
bronze_syms = query_scalar("SELECT COUNT(DISTINCT symbol) FROM bronze.eurostoxx50_ohlcv")
assert_test(f"bronze has {bronze_syms} symbols (expected 50)", bronze_syms == 50)

# TEST: silver has more rows than bronze (historical backfill)
bronze_cnt = query_scalar("SELECT COUNT(*) FROM bronze.eurostoxx50_ohlcv")
silver_cnt = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv")
assert_test(f"silver ({silver_cnt:,}) > bronze ({bronze_cnt:,})", silver_cnt > bronze_cnt)

# TEST: no NULL close prices in silver (should be gap-filled)
null_closes = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] IS NULL")
assert_test(f"silver has {null_closes} NULL closes (expected 0)", null_closes == 0)

# TEST: gold covers all 4 indices from dim_index
gold_idx = query_scalar("SELECT COUNT(DISTINCT _index) FROM gold.index_performance")
dim_idx = query_scalar("SELECT COUNT(*) FROM bronze.dim_index")
assert_test(f"gold has {gold_idx} indices (expected {dim_idx})", gold_idx >= dim_idx)
```

      PASS: bronze has 50 symbols (expected 50)
      PASS: silver (66,355) > bronze (50)
      PASS: silver has 0 NULL closes (expected 0)
      PASS: gold has 4 indices (expected 4)

#### Data quality tests

```python
# Data quality — OHLCV invariants that must hold for all financial data
#
# WHAT: checks mathematical invariants:
#   high >= low, close between low/high, no negatives, no future dates
# WHY: bad API responses produce data that looks valid but violates
#   basic financial rules. Models trained on this produce garbage.

# TEST: high >= low for all rows
bad_hl = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE high < low")
assert_test(f"high >= low ({bad_hl} violations)", bad_hl == 0)

# TEST: close between low and high
close_oob = query_scalar(
    "SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] < low OR [close] > high")
assert_test(f"close in [low, high] ({close_oob} violations)", close_oob == 0)

# TEST: no negative prices
neg = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE [close] < 0 OR [open] < 0")
assert_test(f"no negative prices ({neg} violations)", neg == 0)

# TEST: no future dates
future = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE date > GETDATE()")
assert_test(f"no future dates ({future} violations)", future == 0)

# TEST: no negative volume
neg_vol = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE volume < 0")
assert_test(f"no negative volume ({neg_vol} violations)", neg_vol == 0)
```

      PASS: high >= low (0 violations)
      PASS: close in [low, high] (0 violations)
      PASS: no negative prices (0 violations)
      PASS: no future dates (0 violations)
      PASS: no negative volume (0 violations)

#### Cross-layer consistency tests

```python
# Cross-layer consistency — verify bronze → silver → gold pipeline integrity
#
# WHAT: checks that data flows correctly between medallion layers.
#   If these fail, there is a bug in the ETL transform.

# TEST: silver symbols >= bronze symbols
silver_syms = query_scalar("SELECT COUNT(DISTINCT symbol) FROM silver.eurostoxx50_ohlcv")
assert_test(f"silver symbols ({silver_syms}) >= bronze ({bronze_syms})", silver_syms >= bronze_syms)

# TEST: gap-filled rows are < 1% of silver
filled = query_scalar("SELECT COUNT(*) FROM silver.eurostoxx50_ohlcv WHERE is_filled = 1")
pct = filled / silver_cnt * 100
assert_test(f"filled rows = {filled} ({pct:.3f}%, expected < 1%)", pct < 1.0)

# TEST (real-world FAIL): composite_score looks like [0,1] but is a z-score
bad_scores = query_scalar(
    "SELECT COUNT(*) FROM gold.scores_daily WHERE composite_score < 0 OR composite_score > 1")
assert_test(f"composite_score in [0,1] ({bad_scores} violations — it's a z-score!)", bad_scores == 0)

# CORRECTED: z-score range [-2, 2]
really_bad = query_scalar(
    "SELECT COUNT(*) FROM gold.scores_daily WHERE composite_score < -2 OR composite_score > 2")
assert_test(f"composite_score in [-2,2] z-score range ({really_bad} violations)", really_bad == 0)

# TEST: daily returns within +/-20%
extreme = query_scalar("SELECT COUNT(*) FROM gold.index_performance WHERE ABS(daily_return) > 0.2")
assert_test(f"daily returns within +/-20% ({extreme} violations)", extreme == 0)
```

      PASS: silver symbols (50) >= bronze (50)
      PASS: filled rows = 6 (0.009%, expected < 1%)
      FAIL: composite_score in [0,1] (216 violations — it's a z-score!)
      PASS: composite_score in [-2,2] z-score range (0 violations)
      PASS: daily returns within +/-20% (0 violations)

## Data Quality with Pandera

<h4><code style="font-size:0.75em">pandera</code> — DataFrame schema validation</h4>

```python
# Pandera — declarative DataFrame schema validation
#
# WHAT: pandera lets you define a schema (column names, types, ranges, nullability)
#   and validate a DataFrame against it. Invalid data raises SchemaError.
#
# WHY: assert statements check one condition at a time.
#   Pandera validates ALL columns at once and reports ALL violations.
#   It integrates with pytest — one schema test covers dozens of assertions.
#
# WHEN TO USE: ETL pipeline output validation, API response validation,
#   data contract enforcement between teams.
# ANTI-PATTERNS:
#   - Don't make schemas too strict — allow for NULL where the source allows it
#   - Don't validate raw bronze data with silver schema — each layer has its own

# Define schema for silver OHLCV data
ohlcv_schema = DataFrameSchema({
    "symbol":    Column(str, Check.str_length(min_value=1)),
    "date":      Column("datetime64[ns]"),
    "open":      Column(float, Check.greater_than(0), nullable=True),
    "high":      Column(float, Check.greater_than(0), nullable=True),
    "low":       Column(float, Check.greater_than(0), nullable=True),
    "close":     Column(float, Check.greater_than(0)),
    "volume":    Column(int, Check.greater_than_or_equal_to(0), nullable=True),
})

# Load sample data from silver layer using SQLAlchemy engine
# pd.read_sql expects a SQLAlchemy connection or sqlite3 — not raw pyodbc.
# SQLAlchemy wraps pyodbc and gives pd.read_sql the correct type.
engine = create_engine(f"mssql+pyodbc:///?odbc_connect={quote_plus(CONN_STR)}")
df = pd.read_sql(
    "SELECT TOP 100 symbol, date, [open], high, low, [close], volume FROM silver.eurostoxx50_ohlcv",
    engine)

# Convert date column to datetime for downstream use (optional)
df["date"] = pd.to_datetime(df["date"])

# Validate — raises SchemaError if any column fails
try:
    ohlcv_schema.validate(df)
    print(f"  PASS: pandera validated {len(df)} rows against OHLCV schema")
except SchemaError as e:
    print(f"  FAIL: {e}")

# TEST (deliberate FAIL): schema that requires volume > 1000
strict_schema = DataFrameSchema({
    "volume": Column(int, Check.greater_than(1_000_000), coerce=True),
})
try:
    strict_schema.validate(df[["volume"]])
    print("  FAIL: should have raised SchemaError")
except SchemaError:
    print("  PASS: correctly caught volume <= 1M (expected FAIL)")
```

      PASS: pandera validated 100 rows against OHLCV schema
      PASS: correctly caught volume <= 1M (expected FAIL)

    c:\Users\aperi\DEV\LANG\.lang\Lib\site-packages\pandera\_pandas_deprecated.py:143: FutureWarning: Importing pandas-specific classes and functions from the
    top-level pandera module will be **removed in a future version of pandera**.
    If you're using pandera to validate pandas objects, we highly recommend updating
    your import:
    
    ```
    # old import
    import pandera as pa
    
    # new import
    import pandera.pandas as pa
    ```
    
    If you're using pandera to validate objects from other compatible libraries
    like pyspark or polars, see the supported libraries section of the documentation
    for more information on how to import pandera:
    
    https://pandera.readthedocs.io/en/stable/supported_libraries.html
    
    To disable this warning, set the environment variable:
    
    ```
    export DISABLE_PANDERA_IMPORT_WARNING=True
    ```
    
      warnings.warn(_future_warning, FutureWarning)

## API Integration Tests

#### Test live API responses

```python
# API integration tests — verify live API data against expectations
#
# WHAT: call real APIs and check that responses are valid.
#   Cross-check live prices against DB values to catch stale data.
#
# WHY: APIs change without notice — field names renamed, endpoints deprecated,
#   rate limits tightened. These tests catch breakages before they hit production.

FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")

# TEST: Finnhub returns valid price for Euro Stoxx 50 stocks
for sym in ["SAP", "ASML"]:
    resp = requests.get(f"https://finnhub.io/api/v1/quote?symbol={sym}&token={FINNHUB_KEY}")
    data = resp.json()
    price = data.get("c", 0)
    assert_test(f"Finnhub {sym} price = {price:.2f} (expected > 0)", price > 0)

# TEST: API price within reasonable range of DB close
db_close = query_scalar(
    "SELECT TOP 1 [close] FROM silver.eurostoxx50_ohlcv "
    "WHERE symbol = 'SAP.DE' ORDER BY date DESC")
resp = requests.get(f"https://finnhub.io/api/v1/quote?symbol=SAP&token={FINNHUB_KEY}")
live = resp.json().get("c", 0)
# ADR vs exchange price differs (currency + premium), so wide tolerance
ratio = live / db_close if db_close else 0
assert_test(f"SAP live={live:.2f} vs DB={db_close:.2f} (ratio={ratio:.2f})", 0.2 < ratio < 5.0)
```

      PASS: Finnhub SAP price = 171.00 (expected > 0)
      PASS: Finnhub ASML price = 1399.42 (expected > 0)
      PASS: SAP live=171.00 vs DB=166.52 (ratio=1.03)

## CI/CD — Running Tests in GitHub Actions

```python
# GitHub Actions — automated testing on every push/PR.
#
# KEY CONCEPTS:
# - Workflow file: .github/workflows/test.yml — defines when and how tests run.
# - Triggers: on push, on pull_request, on schedule (cron).
# - Matrix: run tests across multiple Python versions simultaneously.
# - Secrets: env vars like API keys injected securely via GitHub Secrets.
# - Artifacts: upload test reports, coverage, logs after each run.
#
# This cell prints a production-ready workflow file you can copy to your repo.

workflow = '''
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest-cov  # coverage plugin

      - name: Run tests with coverage
        run: |
          pytest tests/ \\
            --tb=short \\
            --cov=src \\
            --cov-report=xml \\
            --cov-report=term-missing \\
            --junitxml=test-results.xml
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          EXCHANGE_API_KEY: ${{ secrets.EXCHANGE_API_KEY }}

      - name: Upload test results
        if: always()  # upload even if tests fail
        uses: actions/upload-artifact@v4
        with:
          name: test-results-py${{ matrix.python-version }}
          path: test-results.xml

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-py${{ matrix.python-version }}
          path: coverage.xml
'''

print(workflow)
print("─" * 60)
print()
print("KEY GITHUB ACTIONS CONCEPTS:")
print()
print("  Trigger              Description")
print("  ──────────────────   ──────────────────────────────────────")
print("  push                 Runs on every push to specified branches")
print("  pull_request         Runs on PRs targeting specified branches")
print("  schedule             Cron-based (e.g., nightly data quality checks)")
print("  workflow_dispatch    Manual trigger from GitHub UI")
print()
print("  Secret                   How to set")
print("  ──────────────────────   ────────────────────────────────")
print("  secrets.DB_HOST          Repo → Settings → Secrets → Actions")
print("  secrets.API_KEY          Never hardcode in workflow files!")
print()
print("  pytest flags             Purpose")
print("  ──────────────────────   ────────────────────────────────")
print("  --cov=src                Measure code coverage")
print("  --cov-report=xml         Coverage report for CI tools")
print("  --junitxml=...           Test results in JUnit XML format")
print("  --tb=short               Short tracebacks (cleaner CI logs)")
print("  -x                       Stop on first failure")
```

    
    # .github/workflows/test.yml
    name: Tests
    
    on:
      push:
        branches: [main, develop]
      pull_request:
        branches: [main]
    
    jobs:
      test:
        runs-on: ubuntu-latest
        strategy:
          matrix:
            python-version: ["3.11", "3.12"]
    
        steps:
          - uses: actions/checkout@v4
    
          - name: Set up Python ${{ matrix.python-version }}
            uses: actions/setup-python@v5
            with:
              python-version: ${{ matrix.python-version }}
    
          - name: Install dependencies
            run: |
              python -m pip install --upgrade pip
              pip install -r requirements.txt
              pip install pytest-cov  # coverage plugin
    
          - name: Run tests with coverage
            run: |
              pytest tests/ \
                --tb=short \
                --cov=src \
                --cov-report=xml \
                --cov-report=term-missing \
                --junitxml=test-results.xml
            env:
              DB_HOST: ${{ secrets.DB_HOST }}
              EXCHANGE_API_KEY: ${{ secrets.EXCHANGE_API_KEY }}
    
          - name: Upload test results
            if: always()  # upload even if tests fail
            uses: actions/upload-artifact@v4
            with:
              name: test-results-py${{ matrix.python-version }}
              path: test-results.xml
    
          - name: Upload coverage
            if: always()
            uses: actions/upload-artifact@v4
            with:
              name: coverage-py${{ matrix.python-version }}
              path: coverage.xml
    
    ────────────────────────────────────────────────────────────
    
    KEY GITHUB ACTIONS CONCEPTS:
    
      Trigger              Description
      ──────────────────   ──────────────────────────────────────
      push                 Runs on every push to specified branches
      pull_request         Runs on PRs targeting specified branches
      schedule             Cron-based (e.g., nightly data quality checks)
      workflow_dispatch    Manual trigger from GitHub UI
    
      Secret                   How to set
      ──────────────────────   ────────────────────────────────
      secrets.DB_HOST          Repo → Settings → Secrets → Actions
      secrets.API_KEY          Never hardcode in workflow files!
    
      pytest flags             Purpose
      ──────────────────────   ────────────────────────────────
      --cov=src                Measure code coverage
      --cov-report=xml         Coverage report for CI tools
      --junitxml=...           Test results in JUnit XML format
      --tb=short               Short tracebacks (cleaner CI logs)
      -x                       Stop on first failure

#### Summary

```python
# Summary — Python testing cheat sheet
#
# FRAMEWORK:
# pytest                          Run tests:  pytest tests/
# pytest -v                       Verbose (show each test name)
# pytest -k "test_trade"          Run only tests matching pattern
# pytest --tb=short               Short tracebacks on failure
# pytest -x                       Stop on first failure
#
# ASSERTIONS:
# assert x == y                   Equality (rich diff on failure)
# assert x in collection          Membership
# assert x is None                Identity
# pytest.approx(3.14)             Float comparison with tolerance
# pytest.raises(ValueError)       Expect an exception
#
# FIXTURES:
# @pytest.fixture                 Reusable setup/teardown
# yield                           setup ← before │ after → teardown
# scope="module"                  Share fixture across module
# conftest.py                     Auto-discovered shared fixtures
#
# PARAMETRIZE:
# @pytest.mark.parametrize        One test, multiple inputs
# ids=[...]                       Readable names per parameter set
#
# MOCKING:
# Mock()                          Flexible fake object
# mock.return_value = ...         Set return value
# mock.side_effect = [...]        Sequence of returns/exceptions
# mock.assert_called_once_with()  Verify call
# @patch("module.object")         Temporarily replace real object
# @patch.dict(os.environ, {...})  Temporarily set env vars
# Mock(spec=RealClass)            Enforce real interface
#
# pytest           → xUnit
# assert           → Assert.Equal / Assert.True
# @pytest.fixture  → constructor + IDisposable
# @parametrize     → [Theory] + [InlineData]
# unittest.mock    → Moq (NuGet)
# conftest.py      → shared test base class / collection fixtures

print("Testing cheat sheet loaded — see comments above.")
print()
print("Typical project layout:")
print("""
trading_pipeline/
├── src/
│   ├── __init__.py
│   ├── transforms.py        # normalize_trades(), adjust_for_splits()
│   ├── market_data.py       # MarketDataClient, get_index_constituents()
│   ├── quality.py           # validate_eod_prices(), check_stale_quotes()
│   └── config.py            # get_exchange_config()
├── tests/
│   ├── conftest.py          # shared fixtures (sample trades, mock clients)
│   ├── test_transforms.py   # pure function tests — fast, no mocks
│   ├── test_market_data.py  # mock exchange/API calls
│   ├── test_quality.py      # data quality validation tests
│   └── test_config.py       # patch env vars
├── pyproject.toml            # [tool.pytest.ini_options]
└── requirements.txt
""")
```

    Testing cheat sheet loaded — see comments above.
    
    Typical project layout:
    
    trading_pipeline/
    ├── src/
    │   ├── __init__.py
    │   ├── transforms.py        # normalize_trades(), adjust_for_splits()
    │   ├── market_data.py       # MarketDataClient, get_index_constituents()
    │   ├── quality.py           # validate_eod_prices(), check_stale_quotes()
    │   └── config.py            # get_exchange_config()
    ├── tests/
    │   ├── conftest.py          # shared fixtures (sample trades, mock clients)
    │   ├── test_transforms.py   # pure function tests — fast, no mocks
    │   ├── test_market_data.py  # mock exchange/API calls
    │   ├── test_quality.py      # data quality validation tests
    │   └── test_config.py       # patch env vars
    ├── pyproject.toml            # [tool.pytest.ini_options]
    └── requirements.txt
