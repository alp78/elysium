---
type: reference
category: programming-languages
technology: [python]
tags: [testing, python]
aliases: [unit testing, pytest, xUnit, NUnit, test driven development, mocking, assertions]
keywords: [pytest, unittest, mock, patch, fixture, parametrize, assert, coverage, TDD]
description: "Python testing reference with executable examples and cell outputs — covers pytest, unittest, fixtures, mocking, parametrize, and test-driven development patterns. See [[cs-12_Testing]] for the C# equivalent."
related:
  - "[[programming-languages-index]]"
  - "[[cs-12_Testing]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 12. Testing - Python

Topics covered:
- Unit Testing with pytest
- Assertions & Test Organization
- Fixtures & Parametrize
- Mocking & Patching
- Test Patterns for Data Engineering

## 1. Unit Testing with pytest


```python
# Unit Testing with pytest — the standard Python test framework
#
# KEY CONCEPTS:
# - pytest: third-party framework, the de-facto standard. Runs with `pytest` command.
#   C# equivalent: xUnit (with `dotnet test`).
# - Test discovery: pytest auto-discovers files named test_*.py or *_test.py,
#   and functions named test_*. No base class or decorator needed.
# - assert: plain Python assert — pytest rewrites it to show rich diffs on failure.
#   C# equivalent: Assert.Equal(), Assert.True(), etc.
#
# NOTEBOOK NOTE:
# pytest runs from the command line: `pytest test_mymodule.py`
# In a notebook, we use ipytest to run pytest cells interactively.
# In production, test files live in a tests/ directory.

import ipytest
ipytest.autoconfig()
import pytest

# ─── Basic test functions ───
# A test is just a function starting with test_ that uses assert.
# No class, no decorator, no self.

def test_price_calculation():
    """Test trade price computation: quantity * unit_price."""
    quantity = 150
    unit_price = 42.75
    total = quantity * unit_price
    assert total == 6412.50

def test_ticker_normalization():
    """Tickers should be uppercase and stripped."""
    raw_ticker = "  aapl  "
    assert raw_ticker.strip().upper() == "AAPL"

def test_portfolio_weights_sum():
    """Portfolio weights must sum to 1.0 (fully invested)."""
    weights = {"AAPL": 0.30, "MSFT": 0.25, "GOOG": 0.20, "AMZN": 0.25}
    assert pytest.approx(sum(weights.values())) == 1.0

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

# ─── Testing exceptions ───
# pytest.raises() asserts that an exception is raised.
# C# equivalent: Assert.Throws<ExceptionType>(() => ...)

def test_invalid_quantity_raises():
    """Negative trade quantity should raise ValueError."""
    def validate_trade(qty):
        if qty <= 0:
            raise ValueError(f"Invalid quantity: {qty}")
    with pytest.raises(ValueError, match="Invalid quantity"):
        validate_trade(-10)

def test_missing_ticker_raises():
    """Accessing missing key in position dict should raise KeyError."""
    positions = {"AAPL": 100, "MSFT": 50}
    with pytest.raises(KeyError):
        _ = positions["TSLA"]

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m                                                                                       [100%][0m
    [32m[32m[1m6 passed[0m[32m in 0.02s[0m[0m
    




    <ExitCode.OK: 0>



## 2. Assertions & Test Organization


```python
# Assertions — pytest rewrites plain `assert` for rich error messages.
# No assertEqual, assertTrue needed — just use assert.
#
# C# mapping:
#   assert x == y        → Assert.Equal(y, x)
#   assert x > 0         → Assert.True(x > 0)
#   assert x is None     → Assert.Null(x)
#   assert "foo" in bar  → Assert.Contains("foo", bar)
#   pytest.approx()      → Assert.Equal(expected, actual, precision)

import ipytest
ipytest.autoconfig()
import pytest

# ─── Numeric assertions ───

def test_pnl_calculation():
    """Profit & Loss: (exit_price - entry_price) * quantity."""
    entry = 150.25
    exit_ = 155.80
    qty = 200
    pnl = (exit_ - entry) * qty
    assert pnl == pytest.approx(1110.0)  # float tolerance

def test_basis_points():
    """1 basis point = 0.01%. 50 bps = 0.50%."""
    bps = 50
    rate = bps / 10_000
    assert rate == pytest.approx(0.005)

def test_sharpe_ratio_positive():
    """A positive Sharpe ratio means returns exceed the risk-free rate."""
    returns = [0.02, 0.01, -0.005, 0.03, 0.015]
    import statistics
    mean_ret = statistics.mean(returns)
    std_ret = statistics.stdev(returns)
    risk_free = 0.005
    sharpe = (mean_ret - risk_free) / std_ret
    assert sharpe > 0

# ─── Collection assertions ───

def test_index_constituents():
    """S&P 500 sector ETFs should contain known tickers."""
    tech_etf = {"AAPL", "MSFT", "GOOG", "NVDA", "META"}
    assert "AAPL" in tech_etf
    assert "TSLA" not in tech_etf

def test_ohlcv_bar():
    """OHLCV bar must have all required fields."""
    bar = {"open": 150.0, "high": 155.0, "low": 149.0, "close": 153.0, "volume": 1_200_000}
    assert bar["high"] >= bar["low"]
    assert bar["volume"] > 0
    assert all(k in bar for k in ["open", "high", "low", "close", "volume"])

# ─── String assertions ───

def test_isin_format():
    """ISIN: 2-letter country + 9 alphanum + 1 check digit = 12 chars."""
    isin = "US0378331005"  # Apple Inc.
    assert len(isin) == 12
    assert isin[:2].isalpha()  # country code
    assert isin[:2].isupper()

def test_trade_log_format():
    import re
    log = "2024-03-15T14:30:00Z | BUY | AAPL | 100 @ 178.50"
    assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", log)

# ─── Type & None assertions ───

def test_market_data_types():
    tick = {"price": 178.50, "size": 100, "exchange": "XNAS"}
    assert isinstance(tick["price"], float)
    assert isinstance(tick["size"], int)
    assert isinstance(tick["exchange"], str)

def test_optional_field():
    """Missing optional fields should be None."""
    order = {"ticker": "AAPL", "limit_price": None}
    assert order["limit_price"] is None

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m                                                                              [100%][0m
    [32m[32m[1m15 passed[0m[32m in 0.02s[0m[0m
    




    <ExitCode.OK: 0>



## 3. Fixtures & Parametrize


```python
# Fixtures — reusable test setup/teardown.
# @pytest.fixture marks a function that provides test data or resources.
# Tests declare the fixture as a parameter — pytest injects it automatically.
# C# equivalent: constructor injection in xUnit + IDisposable for teardown.
#
# yield separates setup (before) from teardown (after).
# scope: how long the fixture lives — "function" (default), "module", "session".

import ipytest
ipytest.autoconfig()
import pytest
import tempfile, os, json

# ─── Fixture: sample trade data ───

@pytest.fixture
def sample_trades():
    """Provide sample trade records — reused across multiple tests."""
    return [
        {"trade_id": "TRD_001", "ticker": "AAPL", "side": "BUY",  "qty": 100, "price": 178.50},
        {"trade_id": "TRD_002", "ticker": "MSFT", "side": "BUY",  "qty":  50, "price": 415.20},
        {"trade_id": "TRD_003", "ticker": "AAPL", "side": "SELL", "qty":  30, "price": 180.00},
        {"trade_id": "TRD_004", "ticker": "GOOG", "side": "BUY",  "qty":  20, "price": 172.30},
    ]

def test_trade_count(sample_trades):
    assert len(sample_trades) == 4

def test_all_trades_have_ticker(sample_trades):
    for trade in sample_trades:
        assert "ticker" in trade
        assert len(trade["ticker"]) > 0

def test_net_aapl_position(sample_trades):
    """Net position = sum of BUY qty - sum of SELL qty for a ticker."""
    net = sum(
        t["qty"] if t["side"] == "BUY" else -t["qty"]
        for t in sample_trades if t["ticker"] == "AAPL"
    )
    assert net == 70  # bought 100, sold 30

# ─── Fixture with teardown (yield) ───

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
    yield path  # ← test runs here
    # TEARDOWN: runs even if test fails
    if os.path.exists(path):
        os.unlink(path)

def test_load_positions(temp_positions_file):
    with open(temp_positions_file) as f:
        positions = [json.loads(line) for line in f]
    assert len(positions) == 3
    assert positions[0]["ticker"] == "AAPL"

def test_total_market_value(temp_positions_file):
    with open(temp_positions_file) as f:
        positions = [json.loads(line) for line in f]
    total = sum(p["shares"] * p["avg_cost"] for p in positions)
    assert total == pytest.approx(500*165.0 + 200*380.5 + 100*140.25)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m                                                                         [100%][0m
    [32m[32m[1m20 passed[0m[32m in 0.03s[0m[0m
    




    <ExitCode.OK: 0>




```python
# @pytest.mark.parametrize — run one test with multiple inputs.
# Write the test once, supply N parameter sets → N test runs.
# C# equivalent: [Theory] + [InlineData(...)] in xUnit.

import ipytest
ipytest.autoconfig()
import pytest

# ─── Parametrize: validate ticker formats ───

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

# ─── Parametrize: OHLCV bar validation ───

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

# ─── Parametrize: fee tier calculation ───

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

# ─── Parametrize: currency conversions ───

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

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m                                                          [100%][0m
    [32m[32m[1m35 passed[0m[32m in 0.04s[0m[0m
    




    <ExitCode.OK: 0>



## 4. Mocking & Patching


```python
# Mocking — replace real dependencies with fakes during tests.
#
# KEY CONCEPTS:
# - unittest.mock: Python's built-in mocking library (works with pytest).
# - Mock(): flexible fake that records all calls.
# - MagicMock(): Mock with magic methods pre-configured.
# - patch(): temporarily replace a real object in a module.
#   C# equivalent: Moq library — mock.Setup(...).Returns(...)
#
# WHY MOCK?
# - Don't call real Bloomberg API / exchange / database in tests.
# - Tests must be fast, isolated, and deterministic.
# - Mock the boundary (API client), test the logic (transform, validate).

import ipytest
ipytest.autoconfig()
import pytest
from unittest.mock import Mock, MagicMock, patch, call

# ─── Mock a market data client ───

def test_mock_market_data():
    mock_client = Mock()
    mock_client.get_quote.return_value = {
        "ticker": "AAPL", "bid": 178.40, "ask": 178.60, "last": 178.50
    }

    quote = mock_client.get_quote("AAPL")
    assert quote["last"] == 178.50
    assert quote["ask"] > quote["bid"]  # spread must be positive
    mock_client.get_quote.assert_called_once_with("AAPL")

def test_mock_order_submission():
    """Verify that our order function calls the broker API correctly."""
    mock_broker = Mock()
    mock_broker.submit_order.return_value = {"order_id": "ORD_123", "status": "FILLED"}

    # Code under test
    result = mock_broker.submit_order(
        ticker="AAPL", side="BUY", qty=100, order_type="LIMIT", limit_price=178.00
    )

    assert result["status"] == "FILLED"
    mock_broker.submit_order.assert_called_once_with(
        ticker="AAPL", side="BUY", qty=100, order_type="LIMIT", limit_price=178.00
    )

def test_mock_side_effect_retries():
    """Simulate transient failures from an exchange gateway."""
    mock_gw = Mock()
    mock_gw.send.side_effect = [
        ConnectionError("gateway timeout"),    # 1st attempt fails
        ConnectionError("gateway timeout"),    # 2nd attempt fails
        {"ack": True, "seq": 42},              # 3rd attempt succeeds
    ]

    # Retry loop
    result: dict = {}
    for attempt in range(3):
        try:
            result = mock_gw.send({"type": "NEW_ORDER", "ticker": "MSFT"})
            break
        except ConnectionError:
            continue

    assert result.get("ack") is True
    assert mock_gw.send.call_count == 3

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m                                                       [100%][0m
    [32m[32m[1m38 passed[0m[32m in 0.05s[0m[0m
    




    <ExitCode.OK: 0>




```python
# patch() — temporarily replace real objects with mocks.
#
# IMPORTANT: patch where the object is USED, not where it's DEFINED.
# If my_module.py does `from datetime import datetime`,
# patch "my_module.datetime", NOT "datetime.datetime".

import ipytest
ipytest.autoconfig()
import pytest
from unittest.mock import patch, Mock
from datetime import datetime
import os

# ─── Function under test: market hours check ───

def is_market_open():
    """Check if NYSE is open (weekday, 9:30-16:00 ET). Simplified."""
    now = datetime.now()
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now.replace(hour=9, minute=30, second=0)
    market_close = now.replace(hour=16, minute=0, second=0)
    return market_open <= now <= market_close

@patch("datetime.datetime")
def test_market_open_during_hours(mock_dt):
    # Wednesday at 11:00 AM
    mock_dt.now.return_value = datetime(2024, 3, 13, 11, 0, 0)  # Wednesday
    assert is_market_open() is True

@patch("datetime.datetime")
def test_market_closed_weekend(mock_dt):
    # Saturday at 11:00 AM
    mock_dt.now.return_value = datetime(2024, 3, 16, 11, 0, 0)  # Saturday
    assert is_market_open() is False

@patch("datetime.datetime")
def test_market_closed_after_hours(mock_dt):
    # Wednesday at 18:00
    mock_dt.now.return_value = datetime(2024, 3, 13, 18, 0, 0)
    assert is_market_open() is False

# ─── Patch environment variables ───

def get_exchange_config():
    """Read exchange config from env vars (Docker/K8s deployment)."""
    return {
        "host": os.environ.get("EXCHANGE_HOST", "localhost"),
        "port": int(os.environ.get("EXCHANGE_PORT", "8080")),
        "api_key": os.environ.get("EXCHANGE_API_KEY", ""),
    }

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

def test_default_exchange_config():
    config = get_exchange_config()
    assert config["host"] == "localhost"
    assert config["port"] == 8080

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[31mF[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[31m                                                  [100%][0m
    ============================================ FAILURES =============================================
    [31m[1m__________________________________ test_market_open_during_hours __________________________________[0m
    
    mock_dt = <MagicMock name='datetime' id='1885787100496'>
    
        [0m[37m@patch[39;49;00m([33m"[39;49;00m[33mdatetime.datetime[39;49;00m[33m"[39;49;00m)[90m[39;49;00m
        [94mdef[39;49;00m[90m [39;49;00m[92mtest_market_open_during_hours[39;49;00m(mock_dt):[90m[39;49;00m
            [90m# Wednesday at 11:00 AM[39;49;00m[90m[39;49;00m
            mock_dt.now.return_value = datetime([94m2024[39;49;00m, [94m3[39;49;00m, [94m13[39;49;00m, [94m11[39;49;00m, [94m0[39;49;00m, [94m0[39;49;00m)  [90m# Wednesday[39;49;00m[90m[39;49;00m
    >       [94massert[39;49;00m is_market_open() [95mis[39;49;00m [94mTrue[39;49;00m[90m[39;49;00m
    [1m[31mE       assert False is True[0m
    [1m[31mE        +  where False = is_market_open()[0m
    
    [1m[31mC:\Users\aperi\AppData\Local\Temp\ipykernel_19860\1075022477.py[0m:29: AssertionError
    [36m[1m===================================== short test summary info =====================================[0m
    [31mFAILED[0m t_08ee30587d5a4f5698b86159cdc4837e.py::[1mtest_market_open_during_hours[0m - assert False is True
    [31m[31m[1m1 failed[0m, [32m42 passed[0m[31m in 0.16s[0m[0m
    




    <ExitCode.TESTS_FAILED: 1>



## 5. Test Patterns for Data Engineering & Finance


```python
# DE/Finance test patterns — testing pipelines, transforms, data quality.
#
# KEY PATTERNS:
# 1. Test transform functions (pure logic, no mocks needed).
# 2. Mock external systems (exchange APIs, databases, cloud storage).
# 3. Fixtures for sample market data, trade records, temp files.
# 4. Parametrize for edge cases (splits, dividends, halts, holidays).

import ipytest
ipytest.autoconfig()
import pytest
from unittest.mock import Mock, patch
import json, tempfile, os
from datetime import datetime, date

# ─── Pattern 1: Test a data transform ───

def normalize_trades(raw_trades: list[dict]) -> list[dict]:
    """Clean and normalize raw trade data from exchange feed.
    - Strip and uppercase tickers
    - Convert string prices to float
    - Drop trades with missing IDs
    - Add notional value (qty * price)
    """
    cleaned = []
    for t in raw_trades:
        if not t.get("trade_id"):
            continue
        cleaned.append({
            "trade_id": t["trade_id"].strip(),
            "ticker": t["ticker"].strip().upper(),
            "side": t["side"].strip().upper(),
            "qty": int(t["qty"]),
            "price": float(t["price"]),
            "notional": int(t["qty"]) * float(t["price"]),
        })
    return cleaned

def test_normalize_trades_basic():
    raw = [
        {"trade_id": "TRD_001", "ticker": " aapl ", "side": "buy", "qty": "100", "price": "178.50"},
        {"trade_id": "TRD_002", "ticker": "MSFT",   "side": "SELL", "qty": "50",  "price": "415.20"},
    ]
    result = normalize_trades(raw)
    assert len(result) == 2
    assert result[0]["ticker"] == "AAPL"       # uppercased
    assert result[0]["price"] == 178.50          # float
    assert result[0]["notional"] == pytest.approx(17850.0)  # qty * price
    assert result[1]["side"] == "SELL"           # uppercased

def test_normalize_trades_drops_missing_id():
    raw = [
        {"trade_id": "", "ticker": "AAPL", "side": "BUY", "qty": "100", "price": "178.50"},
        {"trade_id": None, "ticker": "MSFT", "side": "BUY", "qty": "50", "price": "415.20"},
        {"trade_id": "TRD_003", "ticker": "GOOG", "side": "BUY", "qty": "20", "price": "172.30"},
    ]
    result = normalize_trades(raw)
    assert len(result) == 1
    assert result[0]["trade_id"] == "TRD_003"

def test_normalize_trades_empty():
    assert normalize_trades([]) == []

# ─── Pattern 2: Mock an external API ───

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

# ─── Pattern 3: Test data quality checks ───

def validate_eod_prices(prices: list[dict]) -> list[str]:
    """Run data quality checks on end-of-day price data.
    Returns list of error messages (empty = all good).
    """
    errors = []
    for p in prices:
        if p["close"] <= 0:
            errors.append(f"{p['ticker']}: non-positive close price {p['close']}")
        if p["high"] < p["low"]:
            errors.append(f"{p['ticker']}: high ({p['high']}) < low ({p['low']})")
        if p["volume"] < 0:
            errors.append(f"{p['ticker']}: negative volume {p['volume']}")
        # Circuit breaker: flag >20% daily move
        if p["prev_close"] > 0:
            daily_return = abs(p["close"] - p["prev_close"]) / p["prev_close"]
            if daily_return > 0.20:
                errors.append(f"{p['ticker']}: suspicious daily move {daily_return:.1%}")
    return errors

def test_valid_eod_data():
    prices = [
        {"ticker": "AAPL", "close": 178.50, "high": 180.0, "low": 176.0, "volume": 50_000_000, "prev_close": 177.00},
        {"ticker": "MSFT", "close": 415.20, "high": 418.0, "low": 412.0, "volume": 25_000_000, "prev_close": 413.00},
    ]
    assert validate_eod_prices(prices) == []

def test_catches_invalid_prices():
    prices = [
        {"ticker": "BAD1", "close": -5.0,  "high": 10.0, "low": 8.0,  "volume": 1000, "prev_close": 10.0},
        {"ticker": "BAD2", "close": 100.0, "high": 90.0, "low": 95.0, "volume": 1000, "prev_close": 100.0},
        {"ticker": "BAD3", "close": 150.0, "high": 155.0, "low": 145.0, "volume": 1000, "prev_close": 100.0},
    ]
    errors = validate_eod_prices(prices)
    assert len(errors) == 3
    assert any("non-positive" in e for e in errors)
    assert any("high" in e and "< low" in e for e in errors)
    assert any("suspicious daily move" in e for e in errors)

ipytest.run()
```

    [32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[31mF[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[32m.[0m[31mF[0m[31m                                            [100%][0m
    ============================================ FAILURES =============================================
    [31m[1m__________________________________ test_market_open_during_hours __________________________________[0m
    
    mock_dt = <MagicMock name='datetime' id='1885787099056'>
    
        [0m[37m@patch[39;49;00m([33m"[39;49;00m[33mdatetime.datetime[39;49;00m[33m"[39;49;00m)[90m[39;49;00m
        [94mdef[39;49;00m[90m [39;49;00m[92mtest_market_open_during_hours[39;49;00m(mock_dt):[90m[39;49;00m
            [90m# Wednesday at 11:00 AM[39;49;00m[90m[39;49;00m
            mock_dt.now.return_value = datetime([94m2024[39;49;00m, [94m3[39;49;00m, [94m13[39;49;00m, [94m11[39;49;00m, [94m0[39;49;00m, [94m0[39;49;00m)  [90m# Wednesday[39;49;00m[90m[39;49;00m
    >       [94massert[39;49;00m is_market_open() [95mis[39;49;00m [94mTrue[39;49;00m[90m[39;49;00m
    [1m[31mE       assert False is True[0m
    [1m[31mE        +  where False = is_market_open()[0m
    
    [1m[31mC:\Users\aperi\AppData\Local\Temp\ipykernel_19860\1075022477.py[0m:29: AssertionError
    [31m[1m___________________________________ test_catches_invalid_prices ___________________________________[0m
    
        [0m[94mdef[39;49;00m[90m [39;49;00m[92mtest_catches_invalid_prices[39;49;00m():[90m[39;49;00m
            prices = [[90m[39;49;00m
                {[33m"[39;49;00m[33mticker[39;49;00m[33m"[39;49;00m: [33m"[39;49;00m[33mBAD1[39;49;00m[33m"[39;49;00m, [33m"[39;49;00m[33mclose[39;49;00m[33m"[39;49;00m: -[94m5.0[39;49;00m,  [33m"[39;49;00m[33mhigh[39;49;00m[33m"[39;49;00m: [94m10.0[39;49;00m, [33m"[39;49;00m[33mlow[39;49;00m[33m"[39;49;00m: [94m8.0[39;49;00m,  [33m"[39;49;00m[33mvolume[39;49;00m[33m"[39;49;00m: [94m1000[39;49;00m, [33m"[39;49;00m[33mprev_close[39;49;00m[33m"[39;49;00m: [94m10.0[39;49;00m},[90m[39;49;00m
                {[33m"[39;49;00m[33mticker[39;49;00m[33m"[39;49;00m: [33m"[39;49;00m[33mBAD2[39;49;00m[33m"[39;49;00m, [33m"[39;49;00m[33mclose[39;49;00m[33m"[39;49;00m: [94m100.0[39;49;00m, [33m"[39;49;00m[33mhigh[39;49;00m[33m"[39;49;00m: [94m90.0[39;49;00m, [33m"[39;49;00m[33mlow[39;49;00m[33m"[39;49;00m: [94m95.0[39;49;00m, [33m"[39;49;00m[33mvolume[39;49;00m[33m"[39;49;00m: [94m1000[39;49;00m, [33m"[39;49;00m[33mprev_close[39;49;00m[33m"[39;49;00m: [94m100.0[39;49;00m},[90m[39;49;00m
                {[33m"[39;49;00m[33mticker[39;49;00m[33m"[39;49;00m: [33m"[39;49;00m[33mBAD3[39;49;00m[33m"[39;49;00m, [33m"[39;49;00m[33mclose[39;49;00m[33m"[39;49;00m: [94m150.0[39;49;00m, [33m"[39;49;00m[33mhigh[39;49;00m[33m"[39;49;00m: [94m155.0[39;49;00m, [33m"[39;49;00m[33mlow[39;49;00m[33m"[39;49;00m: [94m145.0[39;49;00m, [33m"[39;49;00m[33mvolume[39;49;00m[33m"[39;49;00m: [94m1000[39;49;00m, [33m"[39;49;00m[33mprev_close[39;49;00m[33m"[39;49;00m: [94m100.0[39;49;00m},[90m[39;49;00m
            ][90m[39;49;00m
            errors = validate_eod_prices(prices)[90m[39;49;00m
    >       [94massert[39;49;00m [96mlen[39;49;00m(errors) == [94m3[39;49;00m[90m[39;49;00m
    [1m[31mE       AssertionError: assert 4 == 3[0m
    [1m[31mE        +  where 4 = len(['BAD1: non-positive close price -5.0', 'BAD1: suspicious daily move 150.0%', 'BAD2: high (90.0) < low (95.0)', 'BAD3: suspicious daily move 50.0%'])[0m
    
    [1m[31mC:\Users\aperi\AppData\Local\Temp\ipykernel_19860\4100240988.py[0m:127: AssertionError
    [36m[1m===================================== short test summary info =====================================[0m
    [31mFAILED[0m t_08ee30587d5a4f5698b86159cdc4837e.py::[1mtest_market_open_during_hours[0m - assert False is True
    [31mFAILED[0m t_08ee30587d5a4f5698b86159cdc4837e.py::[1mtest_catches_invalid_prices[0m - AssertionError: assert 4 == 3
    [31m[31m[1m2 failed[0m, [32m47 passed[0m[31m in 0.07s[0m[0m
    




    <ExitCode.TESTS_FAILED: 1>



## 6. CI/CD — Running Tests in GitHub Actions


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
# C# EQUIVALENTS:
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
    
    
