---
type: reference
category: programming-languages
technology: [python]
tags: [python]
aliases: [generics, LINQ, type parameters, generic collections, comprehensions, functional programming]
keywords: [generics, TypeVar, Generic, Protocol, map, filter, reduce, itertools, functools, comprehension]
description: "Python generics and functional data processing reference with executable examples and cell outputs — covers TypeVar, Generic classes, Protocol, functional tools, and itertools. See [07_cs_generics_linq](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/07_cs_generics_linq) for the C# equivalent."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# 07. Generics & Functional Data Processing - Python

> [!quote]
> "All non-trivial abstractions, to some degree, are leaky."
> — **Joel Spolsky**

```python
from typing import TypeVar, Generic, Optional
from itertools import groupby
from collections import defaultdict
from functools import reduce
import pandas as pd
import numpy as np
import pyodbc
import polars as pl
```

## Generics

#### Duck typing — no generics needed

Python's dynamic typing means functions work on any iterable — list, tuple, string, set, generator — without type declarations. This is "duck typing": if it quacks like a duck, it's a duck. Simpler than C#/Java generics for most use cases. For public library APIs, add type hints for documentation and type checking.

```python
# Duck typing — Python functions already accept any type without generics
def first_element(items):
    """Works with ANY iterable — list, tuple, string, set..."""
    for item in items:
        return item
    return None

print(f"list:   {first_element([1, 2, 3])}")
print(f"string: {first_element('hello')}")
print(f"tuple:  {first_element((10, 20))}")
```

    list:   1
    string: h
    tuple:  10

#### TypeVar — generic type hints

```python
# TypeVar — generic type hints for type checkers (not enforced at runtime)

T = TypeVar("T")

def first(items: list[T]) -> Optional[T]:
    """Type hint says: list of T in → T out (same type)."""
    return items[0] if items else None

result_int: Optional[int] = first([1, 2, 3])
result_str: Optional[str] = first(["a", "b", "c"])
print(f"int: {result_int}, str: {result_str}")

# Constrained TypeVar — restrict T to specific types
Number = TypeVar("Number", int, float)

def add(a: Number, b: Number) -> Number:
    return a + b

print(f"int:   {add(3, 4)}")
print(f"float: {add(3.5, 4.5)}")
# add("a", "b")  # type checker would flag this (but Python still runs it)
```

    int: 1, str: a
    int:   7
    float: 8.0

#### Generic class — Generic[T]

Inherit from `Generic[T]` so the type checker tracks what's inside. Use for custom container classes and typed wrappers — when built-in containers (`list`, `dict`) suffice, no custom class is needed. Runtime `isinstance` checks on generic types are not supported (type erasure).

```python
# Generic class — inherit from Generic[T] so the type checker tracks what's inside

# Stack[T] — type checker knows push/pop/peek operate on T
class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> T:
        return self._items[-1]

    def __len__(self) -> int:
        return len(self._items)

    def __repr__(self) -> str:
        return f"Stack({self._items})"

int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push(2)
int_stack.push(3)
print(f"Stack: {int_stack}")
print(f"Pop:   {int_stack.pop()}")

str_stack: Stack[str] = Stack()
str_stack.push("hello")
str_stack.push("world")
print(f"Stack: {str_stack}")
```

    Stack: Stack([1, 2, 3])
    Pop:   3
    Stack: Stack(['hello', 'world'])

#### Built-in generic type hints — list[int], dict[str, T], Optional

| Type hint | Meaning |
|---|---|
| `list[int]` | Typed list |
| `dict[str, int]` | Typed dictionary |
| `set[str]` | Typed set |
| `tuple[int, str]` | Typed tuple |
| `Optional[str]` | `str` or `None` |
| `Callable[\[int], bool]` | Function signature |

## Pandas vs Polars Analytics

Side-by-side analytics on live SQL Server data. Each operation shown first in pandas,
then in Polars. Mirrors the C# notebook's LINQ vs Polars.NET section.

Tables: `silver.eurostoxx50_ohlcv` (66K rows), `gold.scores_daily` (466 rows).

#### Connect to SQL Server and load data

```python
# Connect via SQLAlchemy engine (suppresses pyodbc deprecation warning)
from sqlalchemy import create_engine
from urllib.parse import quote_plus

odbc_str = (
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=localhost,1434;DATABASE=stoxx;'
    'UID=sa;PWD=EsgDev2026Pass1;'
    'Encrypt=yes;TrustServerCertificate=yes;'
)
engine = create_engine(f'mssql+pyodbc:///?odbc_connect={quote_plus(odbc_str)}')

ohlcv = pd.read_sql('SELECT symbol, date, [open], high, low, [close], adj_close, volume FROM silver.eurostoxx50_ohlcv', engine)
scores = pd.read_sql('SELECT symbol, sector, country, composite_score, composite_rank, momentum_score, current_price, ytd_change_pct FROM gold.scores_daily', engine)

pldf = pl.read_parquet('C:/Users/aperi/DEV/LANG/data/eurostoxx50_ohlcv.parquet')

print(f'  Pandas: {len(ohlcv):,} rows, {ohlcv.symbol.nunique()} symbols')
print(f'  Polars: {pldf.height:,} rows')
print(f'  Date range: {ohlcv.date.min()} to {ohlcv.date.max()}')
```

      Pandas: 66,355 rows, 50 symbols
      Polars: 66,355 rows
      Date range: 2021-01-04 to 2026-03-12

### Basic Operations

### Subsetting

#### Pandas — Subset rows by slicing with iloc[]

```python
# Pandas: iloc[] — positional slicing (rows 100-102)
ohlcv.iloc[100:103]
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>100</th>
      <td>ASML.AS</td>
      <td>2021-05-26</td>
      <td>549.7</td>
      <td>549.7</td>
      <td>538.8</td>
      <td>541.9</td>
      <td>518.6536</td>
      <td>538666</td>
      <td>924</td>
    </tr>
    <tr>
      <th>101</th>
      <td>ASML.AS</td>
      <td>2021-05-27</td>
      <td>542.3</td>
      <td>547.3</td>
      <td>537.8</td>
      <td>544.0</td>
      <td>520.6634</td>
      <td>1123807</td>
      <td>115</td>
    </tr>
    <tr>
      <th>102</th>
      <td>ASML.AS</td>
      <td>2021-05-28</td>
      <td>544.8</td>
      <td>553.0</td>
      <td>542.1</td>
      <td>552.3</td>
      <td>528.6074</td>
      <td>562085</td>
      <td>869</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset rows by slicing with slice()

```python
# Polars: slice(offset, length) — positional slicing (rows 100-102)
pldf.slice(100, 3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21261</td><td>&quot;ABI.BR&quot;</td><td>2021-05-27</td><td>61.8</td><td>62.64</td><td>61.73</td><td>62.13</td><td>58.6795</td><td>1796477</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21262</td><td>&quot;ABI.BR&quot;</td><td>2021-05-28</td><td>62.14</td><td>62.58</td><td>61.96</td><td>62.34</td><td>58.8779</td><td>1004125</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Subset columns with [[columns]] bracket notation

```python
# Pandas: [[col_list]] — select columns by name
ohlcv[['symbol', 'date', 'close', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>406.25</td>
      <td>789502</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.90</td>
      <td>798787</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>402.85</td>
      <td>875711</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>403.90</td>
      <td>874780</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>416.05</td>
      <td>975243</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset columns with select()

```python
# Polars: select() — select columns by name
pldf.select('symbol', 'date', 'close', 'volume').head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td><td>1513937</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td><td>1382722</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td><td>1370204</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td><td>1469911</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td><td>1428681</td></tr></tbody></table></div>

#### Pandas — Subset single row with iloc[n]

```python
# Pandas: iloc[n] — single row by position (returns Series)
ohlcv.iloc[0]
```

    symbol          ASML.AS
    date         2021-01-04
    open              404.0
    high              411.0
    low              402.25
    close            406.25
    adj_close       387.709
    volume           789502
    vol_rank            392
    Name: 0, dtype: object

#### Polars — Subset single row with row()

```python
# Polars: row(n, named=True) — single row by position (returns dict)
pldf.row(0, named=True)
```

    {'id': 21160,
     'symbol': 'ABI.BR',
     'date': datetime.date(2021, 1, 4),
     'open': 58.15,
     'high': 58.85,
     'low': 56.78,
     'close': 57.21,
     'adj_close': 53.5761,
     'volume': 1513937,
     'dividends': 0.0,
     'stock_splits': 0.0,
     'is_filled': False}

#### Pandas — Subset with loc[] label filter

```python
# Pandas: loc[condition, columns] — label-based filter + column selection
ohlcv.loc[ohlcv.symbol == 'ASML.AS', ['date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2021-01-04</td>
      <td>406.25</td>
    </tr>
    <tr>
      <th>1</th>
      <td>2021-01-05</td>
      <td>406.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>2021-01-06</td>
      <td>402.85</td>
    </tr>
    <tr>
      <th>3</th>
      <td>2021-01-07</td>
      <td>403.90</td>
    </tr>
    <tr>
      <th>4</th>
      <td>2021-01-08</td>
      <td>416.05</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset with filter() + select()

```python
# Polars: filter() + select() — expression-based filter + column selection
pldf.filter(pl.col('symbol') == 'ASML.AS').select('date', 'close').head(5)
```

<div>
<!-- shape: (5, 2) --><table><thead><tr><th>date</th><th>close</th></tr><tr><td>date</td><td>f64</td></tr></thead><tbody><tr><td>2021-01-04</td><td>406.25</td></tr><tr><td>2021-01-05</td><td>406.9</td></tr><tr><td>2021-01-06</td><td>402.85</td></tr><tr><td>2021-01-07</td><td>403.9</td></tr><tr><td>2021-01-08</td><td>416.05</td></tr></tbody></table></div>

#### Pandas — Subset multiple rows with iloc index

```python
# Pandas: iloc[navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — multiple rows by position
ohlcv.iloc[[0, 50, 100, 500]]
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>404.0</td>
      <td>411.0</td>
      <td>402.25</td>
      <td>406.25</td>
      <td>387.7090</td>
      <td>789502</td>
      <td>392</td>
    </tr>
    <tr>
      <th>50</th>
      <td>ASML.AS</td>
      <td>2021-03-15</td>
      <td>448.0</td>
      <td>455.1</td>
      <td>446.45</td>
      <td>453.95</td>
      <td>433.2320</td>
      <td>632242</td>
      <td>706</td>
    </tr>
    <tr>
      <th>100</th>
      <td>ASML.AS</td>
      <td>2021-05-26</td>
      <td>549.7</td>
      <td>549.7</td>
      <td>538.80</td>
      <td>541.90</td>
      <td>518.6536</td>
      <td>538666</td>
      <td>924</td>
    </tr>
    <tr>
      <th>500</th>
      <td>ASML.AS</td>
      <td>2022-12-09</td>
      <td>573.0</td>
      <td>579.2</td>
      <td>569.80</td>
      <td>577.30</td>
      <td>560.7872</td>
      <td>618610</td>
      <td>743</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Subset multiple rows with index list

```python
# Polars: gather([list]) — multiple rows by position
pldf[[0, 50, 100, 500]]
```

<div>
<!-- shape: (4, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21210</td><td>&quot;ABI.BR&quot;</td><td>2021-03-15</td><td>52.32</td><td>53.05</td><td>52.18</td><td>52.29</td><td>48.9686</td><td>1253312</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21260</td><td>&quot;ABI.BR&quot;</td><td>2021-05-26</td><td>61.99</td><td>62.39</td><td>61.83</td><td>62.12</td><td>58.6701</td><td>940186</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21660</td><td>&quot;ABI.BR&quot;</td><td>2022-12-09</td><td>56.64</td><td>56.96</td><td>56.54</td><td>56.88</td><td>54.2262</td><td>1098905</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Select columns

```python
# Pandas: select columns
ohlcv[['symbol', 'date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>406.25</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>402.85</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>403.90</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>416.05</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Select columns

```python
# Polars: select columns
pldf.select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>57.21</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>57.18</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>58.77</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-07</td><td>58.4</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>2021-01-08</td><td>57.86</td></tr></tbody></table></div>

#### Pandas — Filter rows

```python
# Pandas: filter rows
ohlcv[(ohlcv.symbol == 'ASML.AS') & (ohlcv['close'] > 600)][['symbol', 'date', 'close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>135</th>
      <td>ASML.AS</td>
      <td>2021-07-14</td>
      <td>609.1</td>
    </tr>
    <tr>
      <th>141</th>
      <td>ASML.AS</td>
      <td>2021-07-22</td>
      <td>620.8</td>
    </tr>
    <tr>
      <th>142</th>
      <td>ASML.AS</td>
      <td>2021-07-23</td>
      <td>638.8</td>
    </tr>
    <tr>
      <th>143</th>
      <td>ASML.AS</td>
      <td>2021-07-26</td>
      <td>638.0</td>
    </tr>
    <tr>
      <th>144</th>
      <td>ASML.AS</td>
      <td>2021-07-27</td>
      <td>623.0</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Filter rows

```python
# Polars: filter rows
pldf.filter((pl.col('symbol') == 'ASML.AS') & (pl.col('close') > 600)).select('symbol', 'date', 'close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-14</td><td>609.1</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-22</td><td>620.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-23</td><td>638.8</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-26</td><td>638.0</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-07-27</td><td>623.0</td></tr></tbody></table></div>

#### Pandas — Sort

```python
# Pandas: sort
ohlcv.sort_values('volume', ascending=False)[['symbol', 'date', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>31077</th>
      <td>ISP.MI</td>
      <td>2023-08-08</td>
      <td>376391539</td>
    </tr>
    <tr>
      <th>10782</th>
      <td>SAN.MC</td>
      <td>2021-10-20</td>
      <td>367211467</td>
    </tr>
    <tr>
      <th>31028</th>
      <td>ISP.MI</td>
      <td>2023-05-31</td>
      <td>317362978</td>
    </tr>
    <tr>
      <th>30974</th>
      <td>ISP.MI</td>
      <td>2023-03-13</td>
      <td>311886033</td>
    </tr>
    <tr>
      <th>10792</th>
      <td>SAN.MC</td>
      <td>2021-11-03</td>
      <td>306973344</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Sort

```python
# Polars: sort
pldf.sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-05-31</td><td>317362978</td></tr><tr><td>&quot;ISP.MI&quot;</td><td>2023-03-13</td><td>311886033</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-11-03</td><td>306973344</td></tr></tbody></table></div>

#### Pandas — Add computed column

```python
# Pandas: add computed column
ohlcv.assign(range=ohlcv.high - ohlcv.low)[['symbol', 'close', 'range']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>close</th>
      <th>range</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>406.25</td>
      <td>8.75</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>406.90</td>
      <td>10.90</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>402.85</td>
      <td>8.00</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>403.90</td>
      <td>7.45</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>416.05</td>
      <td>5.70</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Add computed column

```python
# Polars: add computed column
pldf.with_columns((pl.col('high') - pl.col('low')).alias('range')).select('symbol', 'close', 'range').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>close</th><th>range</th></tr><tr><td>str</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ABI.BR&quot;</td><td>57.21</td><td>2.07</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.18</td><td>1.23</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.77</td><td>1.55</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>58.4</td><td>0.98</td></tr><tr><td>&quot;ABI.BR&quot;</td><td>57.86</td><td>0.97</td></tr></tbody></table></div>

### Aggregations

#### Pandas — GroupBy with aggregates

```python
# Pandas: groupby + agg
ohlcv.groupby('symbol').agg(
    avg_close=('close', 'mean'),
    total_vol=('volume', 'sum'),
    days=('close', 'count')
).sort_values('avg_close', ascending=False).head(5).round(2)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>avg_close</th>
      <th>total_vol</th>
      <th>days</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>RMS.PA</th>
      <td>1761.56</td>
      <td>81633862</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>ADYEN.AS</th>
      <td>1545.98</td>
      <td>110400463</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>ASML.AS</th>
      <td>671.35</td>
      <td>945070720</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>MC.PA</th>
      <td>662.40</td>
      <td>557855567</td>
      <td>1331</td>
    </tr>
    <tr>
      <th>RHM.DE</th>
      <td>544.66</td>
      <td>308359744</td>
      <td>1324</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — GroupBy with aggregates

```python
# Polars: group_by + agg
pldf.group_by('symbol').agg(
    pl.col('close').mean().alias('avg_close'),
    pl.col('volume').sum().alias('total_vol'),
    pl.col('close').count().alias('days')
).sort('avg_close', descending=True).head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>total_vol</th><th>days</th></tr><tr><td>str</td><td>f64</td><td>i64</td><td>u32</td></tr></thead><tbody><tr><td>&quot;RMS.PA&quot;</td><td>1761.555748</td><td>81633862</td><td>1331</td></tr><tr><td>&quot;ADYEN.AS&quot;</td><td>1545.976409</td><td>110400463</td><td>1331</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>671.348911</td><td>945070720</td><td>1331</td></tr><tr><td>&quot;MC.PA&quot;</td><td>662.404508</td><td>557855567</td><td>1331</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>544.661533</td><td>308359744</td><td>1324</td></tr></tbody></table></div>

#### Pandas — HAVING

```python
# Pandas: filter after groupby = HAVING
avg_vol = ohlcv.groupby('symbol')['volume'].mean()
avg_vol[avg_vol > 5_000_000].sort_values(ascending=False).to_frame('avg_volume')
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>avg_volume</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>ISP.MI</th>
      <td>8.758860e+07</td>
    </tr>
    <tr>
      <th>SAN.MC</th>
      <td>4.177099e+07</td>
    </tr>
    <tr>
      <th>ENEL.MI</th>
      <td>2.467870e+07</td>
    </tr>
    <tr>
      <th>BBVA.MC</th>
      <td>1.665446e+07</td>
    </tr>
    <tr>
      <th>UCG.MI</th>
      <td>1.390371e+07</td>
    </tr>
    <tr>
      <th>ENI.MI</th>
      <td>1.297621e+07</td>
    </tr>
    <tr>
      <th>INGA.AS</th>
      <td>1.280359e+07</td>
    </tr>
    <tr>
      <th>IBE.MC</th>
      <td>1.203484e+07</td>
    </tr>
    <tr>
      <th>DTE.DE</th>
      <td>7.575084e+06</td>
    </tr>
    <tr>
      <th>NDA-FI.HE</th>
      <td>5.375454e+06</td>
    </tr>
    <tr>
      <th>TTE.PA</th>
      <td>5.138099e+06</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — HAVING

```python
# Polars: group_by + agg + filter
pldf.group_by('symbol').agg(
    pl.col('volume').mean().alias('avg_vol')
).filter(pl.col('avg_vol') > 5_000_000).sort('avg_vol', descending=True)
```

<div>
<!-- shape: (11, 2) --><table><thead><tr><th>symbol</th><th>avg_vol</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>8.7589e7</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>4.1771e7</td></tr><tr><td>&quot;ENEL.MI&quot;</td><td>2.4679e7</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>1.6654e7</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>1.3904e7</td></tr><tr><td>&hellip;</td><td>&hellip;</td></tr><tr><td>&quot;INGA.AS&quot;</td><td>1.2804e7</td></tr><tr><td>&quot;IBE.MC&quot;</td><td>1.2035e7</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>7.5751e6</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>5.3755e6</td></tr><tr><td>&quot;TTE.PA&quot;</td><td>5.1381e6</td></tr></tbody></table></div>

### Window Functions

#### Pandas — Window Function LAG()

```python
# Pandas: LAG()
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['prev_close'] = asml['close'].shift(1)
asml['return_pct'] = ((asml['close'] - asml['prev_close']) / asml['prev_close'] * 100).round(2)
asml[['date', 'close', 'prev_close', 'return_pct']].tail(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>prev_close</th>
      <th>return_pct</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1186.0</td>
      <td>-3.29</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1147.0</td>
      <td>0.05</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1147.6</td>
      <td>4.57</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1200.0</td>
      <td>-0.10</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1198.8</td>
      <td>-0.67</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function LAG()

```python
# Polars: LAG()
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('close').shift(1).over('symbol').alias('prev_close')
).with_columns(
    ((pl.col('close') - pl.col('prev_close')) / pl.col('prev_close') * 100).alias('return_pct')
).select('date', 'close', 'prev_close', 'return_pct').tail(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>date</th><th>close</th><th>prev_close</th><th>return_pct</th></tr><tr><td>date</td><td>f64</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>1147.0</td><td>1186.0</td><td>-3.288364</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1147.0</td><td>0.05231</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1147.6</td><td>4.566051</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1200.0</td><td>-0.1</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1198.8</td><td>-0.667334</td></tr></tbody></table></div>

#### Pandas — Window Function Cumulative SUM()

```python
# Pandas: Cumulative SUM()
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['cum_vol'] = asml['volume'].cumsum()
asml[['date', 'volume', 'cum_vol']].tail(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>volume</th>
      <th>cum_vol</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>857271</td>
      <td>942889692</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>689086</td>
      <td>943578778</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>800815</td>
      <td>944379593</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>562904</td>
      <td>944942497</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>128223</td>
      <td>945070720</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function Cumulative SUM()

```python
# Polars: Cumulative SUM()
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('volume').cum_sum().over('symbol').alias('cum_vol')
).select('date', 'volume', 'cum_vol').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>volume</th><th>cum_vol</th></tr><tr><td>date</td><td>i64</td><td>i64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>857271</td><td>942889692</td></tr><tr><td>2026-03-09</td><td>689086</td><td>943578778</td></tr><tr><td>2026-03-10</td><td>800815</td><td>944379593</td></tr><tr><td>2026-03-11</td><td>562904</td><td>944942497</td></tr><tr><td>2026-03-12</td><td>128223</td><td>945070720</td></tr></tbody></table></div>

#### Pandas — Window Function AVG() Moving Average

```python
# Pandas: AVG() Moving Average
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['sma_20'] = asml['close'].rolling(20).mean()
asml[['date', 'close', 'sma_20']].tail(5).round(2)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>close</th>
      <th>sma_20</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>64731</th>
      <td>2026-03-06</td>
      <td>1147.0</td>
      <td>1214.02</td>
    </tr>
    <tr>
      <th>66155</th>
      <td>2026-03-09</td>
      <td>1147.6</td>
      <td>1211.16</td>
    </tr>
    <tr>
      <th>66156</th>
      <td>2026-03-10</td>
      <td>1200.0</td>
      <td>1211.51</td>
    </tr>
    <tr>
      <th>66157</th>
      <td>2026-03-11</td>
      <td>1198.8</td>
      <td>1211.06</td>
    </tr>
    <tr>
      <th>66305</th>
      <td>2026-03-12</td>
      <td>1190.8</td>
      <td>1211.61</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function AVG() Moving Average

```python
# Polars: AVG() Moving Average
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('close').rolling_mean(20).over('symbol').alias('sma_20')
).select('date', 'close', 'sma_20').tail(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>close</th><th>sma_20</th></tr><tr><td>date</td><td>f64</td><td>f64</td></tr></thead><tbody><tr><td>2026-03-06</td><td>1147.0</td><td>1214.02</td></tr><tr><td>2026-03-09</td><td>1147.6</td><td>1211.16</td></tr><tr><td>2026-03-10</td><td>1200.0</td><td>1211.51</td></tr><tr><td>2026-03-11</td><td>1198.8</td><td>1211.06</td></tr><tr><td>2026-03-12</td><td>1190.8</td><td>1211.61</td></tr></tbody></table></div>

#### Pandas — Window Function ROW_NUMBER()

```python
# Pandas: ROW_NUMBER()
ohlcv['vol_rank'] = ohlcv.groupby('symbol')['volume'].rank(ascending=False, method='first').astype(int)
ohlcv[ohlcv.vol_rank == 1].sort_values('volume', ascending=False)[['symbol', 'date', 'volume']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>volume</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>31077</th>
      <td>ISP.MI</td>
      <td>2023-08-08</td>
      <td>376391539</td>
    </tr>
    <tr>
      <th>10782</th>
      <td>SAN.MC</td>
      <td>2021-10-20</td>
      <td>367211467</td>
    </tr>
    <tr>
      <th>22666</th>
      <td>BBVA.MC</td>
      <td>2021-09-17</td>
      <td>228528294</td>
    </tr>
    <tr>
      <th>46685</th>
      <td>NDA-FI.HE</td>
      <td>2022-09-16</td>
      <td>140675854</td>
    </tr>
    <tr>
      <th>33211</th>
      <td>PRX.AS</td>
      <td>2021-08-17</td>
      <td>114772834</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function ROW_NUMBER()

```python
# Polars: ROW_NUMBER()
pldf.with_columns(
    pl.col('volume').rank(descending=True).over('symbol').alias('vol_rank')
).filter(pl.col('vol_rank') == 1).sort('volume', descending=True).select('symbol', 'date', 'volume').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>volume</th></tr><tr><td>str</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>&quot;ISP.MI&quot;</td><td>2023-08-08</td><td>376391539</td></tr><tr><td>&quot;SAN.MC&quot;</td><td>2021-10-20</td><td>367211467</td></tr><tr><td>&quot;BBVA.MC&quot;</td><td>2021-09-17</td><td>228528294</td></tr><tr><td>&quot;NDA-FI.HE&quot;</td><td>2022-09-16</td><td>140675854</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>2021-08-17</td><td>114772834</td></tr></tbody></table></div>

#### Pandas — Window Function LEAD()

```python
# Pandas: LEAD()
asml = ohlcv[ohlcv.symbol == 'ASML.AS'].sort_values('date').copy()
asml['next_date'] = asml['date'].shift(-1)
asml['gap_days'] = (pd.to_datetime(asml['next_date']) - pd.to_datetime(asml['date'])).dt.days
asml[asml.gap_days > 3][['date', 'next_date', 'gap_days']].sort_values('gap_days', ascending=False).head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>date</th>
      <th>next_date</th>
      <th>gap_days</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>63</th>
      <td>2021-04-01</td>
      <td>2021-04-06</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>331</th>
      <td>2022-04-14</td>
      <td>2022-04-19</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>583</th>
      <td>2023-04-06</td>
      <td>2023-04-11</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>766</th>
      <td>2023-12-22</td>
      <td>2023-12-27</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>1101</th>
      <td>2025-04-17</td>
      <td>2025-04-22</td>
      <td>5.0</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Window Function LEAD()

```python
# Polars: LEAD()
pldf.filter(pl.col('symbol') == 'ASML.AS').sort('date').with_columns(
    pl.col('date').shift(-1).over('symbol').alias('next_date')
).with_columns(
    (pl.col('next_date') - pl.col('date')).dt.total_days().alias('gap_days')
).filter(pl.col('gap_days') > 3).sort('gap_days', descending=True).select('date', 'next_date', 'gap_days').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>date</th><th>next_date</th><th>gap_days</th></tr><tr><td>date</td><td>date</td><td>i64</td></tr></thead><tbody><tr><td>2021-04-01</td><td>2021-04-06</td><td>5</td></tr><tr><td>2022-04-14</td><td>2022-04-19</td><td>5</td></tr><tr><td>2023-04-06</td><td>2023-04-11</td><td>5</td></tr><tr><td>2023-12-22</td><td>2023-12-27</td><td>5</td></tr><tr><td>2024-03-28</td><td>2024-04-02</td><td>5</td></tr></tbody></table></div>

### Joins

#### Pandas — JOIN

```python
# Pandas: merge (inner join on symbol)
avg_df = ohlcv.groupby('symbol')['close'].mean().round(2).reset_index(name='avg_close')
avg_df.merge(scores[['symbol', 'sector', 'composite_rank']], on='symbol').sort_values('composite_rank').head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>avg_close</th>
      <th>sector</th>
      <th>composite_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>44</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>43</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>42</th>
      <td>BNP.PA</td>
      <td>60.94</td>
      <td>Financial Services</td>
      <td>1</td>
    </tr>
    <tr>
      <th>60</th>
      <td>DTE.DE</td>
      <td>22.43</td>
      <td>Communication Services</td>
      <td>2</td>
    </tr>
    <tr>
      <th>59</th>
      <td>DTE.DE</td>
      <td>22.43</td>
      <td>Communication Services</td>
      <td>2</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — JOIN

```python
# Polars: join
pl_avg = pldf.group_by('symbol').agg(pl.col('close').mean().alias('avg_close'))
pl_scores = pl.DataFrame({
    'symbol': scores['symbol'].tolist(),
    'sector': scores['sector'].tolist(),
    'composite_rank': scores['composite_rank'].tolist(),
})
pl_avg.join(pl_scores, on='symbol').sort('composite_rank').head(5)
```

<div>
<!-- shape: (5, 4) --><table><thead><tr><th>symbol</th><th>avg_close</th><th>sector</th><th>composite_rank</th></tr><tr><td>str</td><td>f64</td><td>str</td><td>i64</td></tr></thead><tbody><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;BNP.PA&quot;</td><td>60.937712</td><td>&quot;Financial Services&quot;</td><td>1</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>22.430097</td><td>&quot;Communication Services&quot;</td><td>2</td></tr><tr><td>&quot;DTE.DE&quot;</td><td>22.430097</td><td>&quot;Communication Services&quot;</td><td>2</td></tr></tbody></table></div>

#### Pandas — STDEV()

```python
# Pandas: annualized volatility = std(daily_return) * sqrt(252)
returns = ohlcv.sort_values(['symbol', 'date']).groupby('symbol')['close'].pct_change()
vol = returns.groupby(ohlcv['symbol']).std() * np.sqrt(252) * 100
vol.sort_values(ascending=False).head(10).round(2).to_frame('annual_vol_%')
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>annual_vol_%</th>
    </tr>
    <tr>
      <th>symbol</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>ADYEN.AS</th>
      <td>50.30</td>
    </tr>
    <tr>
      <th>ENR.DE</th>
      <td>50.05</td>
    </tr>
    <tr>
      <th>RHM.DE</th>
      <td>40.85</td>
    </tr>
    <tr>
      <th>PRX.AS</th>
      <td>39.72</td>
    </tr>
    <tr>
      <th>ARGX.BR</th>
      <td>39.31</td>
    </tr>
    <tr>
      <th>ASML.AS</th>
      <td>37.62</td>
    </tr>
    <tr>
      <th>IFX.DE</th>
      <td>37.25</td>
    </tr>
    <tr>
      <th>UCG.MI</th>
      <td>35.55</td>
    </tr>
    <tr>
      <th>VOW.DE</th>
      <td>35.51</td>
    </tr>
    <tr>
      <th>ADS.DE</th>
      <td>34.37</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — STDEV()

```python
# Polars: annualized volatility
pldf.sort('symbol', 'date').with_columns(
    pl.col('close').pct_change().over('symbol').alias('ret')
).group_by('symbol').agg(
    (pl.col('ret').std() * (252 ** 0.5) * 100).alias('annual_vol_%')
).sort('annual_vol_%', descending=True).head(10)
```

<div>
<!-- shape: (10, 2) --><table><thead><tr><th>symbol</th><th>annual_vol_%</th></tr><tr><td>str</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ADYEN.AS&quot;</td><td>50.295865</td></tr><tr><td>&quot;ENR.DE&quot;</td><td>50.045128</td></tr><tr><td>&quot;RHM.DE&quot;</td><td>40.84623</td></tr><tr><td>&quot;PRX.AS&quot;</td><td>39.715469</td></tr><tr><td>&quot;ARGX.BR&quot;</td><td>39.305925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>37.624556</td></tr><tr><td>&quot;IFX.DE&quot;</td><td>37.249051</td></tr><tr><td>&quot;UCG.MI&quot;</td><td>35.550249</td></tr><tr><td>&quot;VOW.DE&quot;</td><td>35.509649</td></tr><tr><td>&quot;ADS.DE&quot;</td><td>34.372174</td></tr></tbody></table></div>

### CRUD-like Operations

#### Pandas — Add rows

```python
# Pandas: add rows
new_row = pd.DataFrame([{'symbol': 'TEST.XX', 'date': '2025-01-01', 'open': 100, 'high': 105,
    'low': 95, 'close': 102, 'adj_close': 102, 'volume': 50000}])
pd.concat([ohlcv, new_row], ignore_index=True).tail(3)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>66353</th>
      <td>WKL.AS</td>
      <td>2026-03-12</td>
      <td>67.000</td>
      <td>67.54</td>
      <td>66.28</td>
      <td>67.32</td>
      <td>67.32</td>
      <td>210379</td>
      <td>1312.0</td>
    </tr>
    <tr>
      <th>66354</th>
      <td>DSY.PA</td>
      <td>2026-03-12</td>
      <td>18.075</td>
      <td>18.39</td>
      <td>18.02</td>
      <td>18.37</td>
      <td>18.37</td>
      <td>434417</td>
      <td>1327.0</td>
    </tr>
    <tr>
      <th>66355</th>
      <td>TEST.XX</td>
      <td>2025-01-01</td>
      <td>100.000</td>
      <td>105.00</td>
      <td>95.00</td>
      <td>102.00</td>
      <td>102.00</td>
      <td>50000</td>
      <td>NaN</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Add rows

```python
# Polars: add rows
# Polars: vstack — vertically stacks DataFrames (must match schema)
new_row = pldf.head(1).with_columns(
    pl.lit('TEST.XX').alias('symbol'), pl.lit(102.0).alias('close'), pl.lit(50000).cast(pl.Int64).alias('volume'))
pldf.vstack(new_row).tail(3)
```

<div>
<!-- shape: (3, 12) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th><th>dividends</th><th>stock_splits</th><th>is_filled</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td><td>f64</td><td>f64</td><td>bool</td></tr></thead><tbody><tr><td>66877</td><td>&quot;WKL.AS&quot;</td><td>2026-03-11</td><td>67.5</td><td>69.6</td><td>67.02</td><td>67.22</td><td>67.22</td><td>1142531</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>66929</td><td>&quot;WKL.AS&quot;</td><td>2026-03-12</td><td>67.0</td><td>67.54</td><td>66.28</td><td>67.32</td><td>67.32</td><td>210379</td><td>0.0</td><td>0.0</td><td>false</td></tr><tr><td>21160</td><td>&quot;TEST.XX&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>102.0</td><td>53.5761</td><td>50000</td><td>0.0</td><td>0.0</td><td>false</td></tr></tbody></table></div>

#### Pandas — Update column

```python
# Pandas: update column
ohlcv[ohlcv.symbol == 'ASML.AS'].assign(adj_close=lambda d: d['close'] * 1.05)[['symbol', 'date', 'adj_close']].head(5)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>adj_close</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>426.5625</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>427.2450</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>422.9925</td>
    </tr>
    <tr>
      <th>3</th>
      <td>ASML.AS</td>
      <td>2021-01-07</td>
      <td>424.0950</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ASML.AS</td>
      <td>2021-01-08</td>
      <td>436.8525</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Update column

```python
# Polars: update column
pldf.filter(pl.col('symbol') == 'ASML.AS').with_columns(
    (pl.col('close') * 1.05).alias('adj_close')
).select('symbol', 'date', 'adj_close').head(5)
```

<div>
<!-- shape: (5, 3) --><table><thead><tr><th>symbol</th><th>date</th><th>adj_close</th></tr><tr><td>str</td><td>date</td><td>f64</td></tr></thead><tbody><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-04</td><td>426.5625</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-05</td><td>427.245</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-06</td><td>422.9925</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-07</td><td>424.095</td></tr><tr><td>&quot;ASML.AS&quot;</td><td>2021-01-08</td><td>436.8525</td></tr></tbody></table></div>

#### Pandas — Delete rows

```python
# Pandas: delete rows
filtered = ohlcv[ohlcv.symbol != 'ASML.AS']
print(f'  {len(ohlcv)} - ASML rows = {len(filtered)} remaining')
```

      66355 - ASML rows = 65024 remaining

#### Polars — Delete rows

```python
# Polars: delete rows
filtered = pldf.filter(pl.col('symbol') != 'ASML.AS')
print(f'  {pldf.height} - ASML rows = {filtered.height} remaining')
```

      66355 - ASML rows = 65024 remaining

#### Pandas — Drop column

```python
# Pandas: drop column
ohlcv.drop(columns=['dividends', 'stock_splits', 'is_filled'], errors='ignore').head(3)
```

<div>
<table>
  <thead>
    <tr>
      <th></th>
      <th>symbol</th>
      <th>date</th>
      <th>open</th>
      <th>high</th>
      <th>low</th>
      <th>close</th>
      <th>adj_close</th>
      <th>volume</th>
      <th>vol_rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>ASML.AS</td>
      <td>2021-01-04</td>
      <td>404.00</td>
      <td>411.00</td>
      <td>402.25</td>
      <td>406.25</td>
      <td>387.7090</td>
      <td>789502</td>
      <td>392</td>
    </tr>
    <tr>
      <th>1</th>
      <td>ASML.AS</td>
      <td>2021-01-05</td>
      <td>406.55</td>
      <td>412.05</td>
      <td>401.15</td>
      <td>406.90</td>
      <td>388.3294</td>
      <td>798787</td>
      <td>381</td>
    </tr>
    <tr>
      <th>2</th>
      <td>ASML.AS</td>
      <td>2021-01-06</td>
      <td>406.80</td>
      <td>407.20</td>
      <td>399.20</td>
      <td>402.85</td>
      <td>384.4644</td>
      <td>875711</td>
      <td>276</td>
    </tr>
  </tbody>
</table>
</div>

#### Polars — Drop column

```python
# Polars: drop column
pldf.drop('dividends', 'stock_splits', 'is_filled').head(3)
```

<div>
<!-- shape: (3, 9) --><table><thead><tr><th>id</th><th>symbol</th><th>date</th><th>open</th><th>high</th><th>low</th><th>close</th><th>adj_close</th><th>volume</th></tr><tr><td>i64</td><td>str</td><td>date</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>f64</td><td>i64</td></tr></thead><tbody><tr><td>21160</td><td>&quot;ABI.BR&quot;</td><td>2021-01-04</td><td>58.15</td><td>58.85</td><td>56.78</td><td>57.21</td><td>53.5761</td><td>1513937</td></tr><tr><td>21161</td><td>&quot;ABI.BR&quot;</td><td>2021-01-05</td><td>56.9</td><td>57.98</td><td>56.75</td><td>57.18</td><td>53.548</td><td>1382722</td></tr><tr><td>21162</td><td>&quot;ABI.BR&quot;</td><td>2021-01-06</td><td>57.96</td><td>58.94</td><td>57.39</td><td>58.77</td><td>55.037</td><td>1370204</td></tr></tbody></table></div>

## Pandas vs Polars — Comparison Matrix

| Feature | Pandas | Polars |
|---------|--------|--------|
| **Engine** | C + Cython (NumPy) | Rust (Apache Arrow) |
| **Memory model** | Copy-heavy, mutable | Zero-copy, immutable |
| **Index** | Row labels (`.loc`, `.iloc`) | No index — positional only |
| **Lazy evaluation** | No — every operation materializes | Yes — `.lazy()` builds a query plan, `.collect()` executes |
| **Multithreading** | Single-threaded (GIL) | Multi-threaded by default |
| **String handling** | Python `object` dtype (slow) | Arrow `Utf8` (fast, zero-copy) |
| **Missing values** | `NaN` (float only), `None`, `pd.NA` | `null` (first-class, any type) |
| **GroupBy** | Split-apply-combine | Hash-based, parallelized |
| **Window functions** | `.shift()`, `.rolling()`, `.rank()` | `.over()` expressions (partition without materializing groups) |
| **Joins** | `.merge(on=, how=)` | `.join(on=, how=)` — same API, faster execution |
| **SQL support** | Via `pandasql` (slow) | Built-in `pl.sql()` on DataFrames |
| **Streaming** | No | `pl.scan_*()` + `.collect(streaming=True)` for larger-than-RAM |
| **Ecosystem** | Massive — scikit-learn, matplotlib, seaborn all expect pandas | Growing — `.to_pandas()` bridge available |
| **Learning curve** | Lower — 10+ years of tutorials, Stack Overflow answers | Steeper — expression API is powerful but different |

### When to use Pandas

- **Prototyping and exploration** — familiar API, instant Stack Overflow answers
- **Interop with ML libraries** — scikit-learn, XGBoost, statsmodels all expect pandas DataFrames
- **Small data** (< 1M rows) — performance difference is negligible
- **Row-label semantics** — time-series with DatetimeIndex, multi-level hierarchical indices
- **Legacy codebases** — existing pandas pipelines that work and don't need optimization

### When to use Polars

- **Large datasets** (1M–100M+ rows) — 10–100x faster than pandas due to Rust engine + multithreading
- **ETL pipelines** — lazy evaluation optimizes the query plan before execution (predicate pushdown, projection pushdown)
- **Memory-constrained environments** — Arrow columnar format uses 2–5x less RAM than pandas
- **Streaming / larger-than-RAM** — `scan_parquet().collect(streaming=True)` processes data in chunks
- **Reproducibility** — immutable DataFrames prevent accidental mutation bugs
- **Cloud-native pipelines** — reads/writes Parquet, IPC, NDJSON natively without conversion

### Gotchas

| Gotcha | Pandas | Polars |
|--------|--------|--------|
| **SettingWithCopyWarning** | Modifying a view vs copy is ambiguous — use `.copy()` or `.loc[]` | Not an issue — DataFrames are immutable |
| **dtype coercion** | Silently upcasts int to float when NaN is present | Keeps int + null separate (no silent coercion) |
| **Chained indexing** | `df[cond][col]` may return copy or view unpredictably | Not possible — use `.filter().select()` (always predictable) |
| **Memory spikes** | `.apply()` and `.iterrows()` create Python objects per row | Expressions stay in Rust — no per-row Python overhead |
| **Column order** | Preserved but fragile after joins/concats | Preserved, deterministic |
| **Datetime handling** | `pd.Timestamp` (nanosecond precision, Y2262 overflow) | Arrow temporal types (microsecond default, configurable) |
| **No index in Polars** | — | If you rely on `.loc[label]`, you need `.filter()` instead |
| **Ecosystem gaps** | — | Some viz/ML libraries don't accept Polars — use `.to_pandas()` |
