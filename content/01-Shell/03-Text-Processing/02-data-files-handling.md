---
title: "02 - Data Files Handling"
tags:
  - shell
  - text-processing
aliases:
  - data files
  - csv handling
  - json handling
  - parquet handling
  - avro handling
  - xml handling
keywords:
  - csv
  - json
  - parquet
  - avro
  - xml
  - text files
  - duckdb
  - pyarrow
  - fastavro
  - import-csv
  - convertfrom-json
  - select-xml
  - file handling
  - format-aware processing
description: "Production reference for inspecting, transforming, validating, converting, and safely rewriting CSV, JSON, Parquet, Avro, text, and XML files in Linux and PowerShell."
created: 2026-04-14
updated: 2026-04-14
status: complete
---

# Data Files Handling

Data engineering pipelines rarely fail because a file merely exists. They fail because the operator used a line-oriented tool on a structured payload, assumed the wrong delimiter, dropped headers while concatenating splits, or treated a binary container as if it were plain text. This note is the reference for choosing the right handling pattern before those mistakes reach production.

> [!abstract]- Summary
>
> Use text tools for text, format-aware tools for structured data, and binary-aware readers for Parquet and Avro.
>
> - Treat CSV as plain text only when the delimiter, quoting, encoding, and multiline behavior are controlled.
> - Treat JSON and XML as trees, not as lines, unless the payload is explicitly NDJSON or another line-delimited contract.
> - Treat Parquet and Avro as binary containers with embedded metadata and schema semantics.
> - Prefer read-only inspection first, then filter, transform, convert, and finally overwrite or append.
> - Make header handling explicit whenever you split or recombine tabular files.

## Definitions

The terms below appear repeatedly in the examples and decision guidance. Read them once and keep them nearby; almost every file-handling mistake is a mismatch between one of these concepts and the tool that was chosen.

| Term | Meaning | Why it matters operationally |
|---|---|---|
| `delimiter` | Character that separates fields inside a row, such as comma, tab, or semicolon. | The wrong delimiter shifts columns and produces silent data corruption. |
| `header row` | First record that contains column names instead of data. | Splitting or concatenating files without managing the header duplicates or removes schema labels. |
| `record` | One logical unit of data: one CSV row, one JSON object, one XML node, one Avro row. | Counting records is different from counting physical lines in multiline formats. |
| `field` | One named or positional value inside a record. | Selection, filtering, and renaming act on fields rather than raw lines. |
| `column` | Tabular field repeated across many records. | Column-oriented formats such as Parquet optimize column selection differently from row-oriented text files. |
| `key` | Name used to address a value inside a JSON object or similar map. | JSON extraction is key-aware, not delimiter-aware. |
| `value` | Data associated with a key, field, or attribute. | Null, numeric, and string values do not behave the same way during filtering and conversion. |
| `object` | JSON structure made of key-value pairs. | Arrays of objects need object-aware tools such as `ConvertFrom-Json`, `jq`, DuckDB, or Python parsers. |
| `array` | Ordered JSON list of values or objects. | Counting objects in an array is not the same as counting lines in the file. |
| `schema` | Structural contract for fields, types, nullability, and nesting. | Parquet and Avro embed schema information; CSV does not. |
| `encoding` | Byte-to-text mapping such as UTF-8. | Wrong encoding assumptions garble non-ASCII text and break downstream parsers. |
| `newline` | Line separator used by the file writer, such as `LF` or `CRLF`. | `wc -l` counts newline characters, not logical records in multiline formats. |
| `stream` | Data that flows through a pipeline without requiring the full file in memory. | Streaming tools are safer for large text files, but many structured parsers still materialize the payload. |
| `stdout` | Standard output stream from a command. | File-handling pipelines usually transform stdout into the next stage or redirect it into a new file. |
| `stderr` | Standard error stream from a command. | Diagnostics on stderr should not be mixed into structured output files. |
| `pipe` | Operator that feeds one command's stdout into another command's stdin. | Pipes are powerful for text streams, but they do not make a text tool schema-aware. |
| `append` | Write new output to the end of an existing file. | Appending to structured files is safe only when the format contract remains valid. |
| `overwrite` | Replace the existing contents of a file. | Overwrite must be deliberate because it destroys the previous payload. |
| `structured data` | Data whose shape is formally defined, such as Avro, Parquet, many JSON documents, and XML with schemas. | Structured data requires structure-aware tools for reliable filtering and transformation. |
| `semi-structured data` | Data with structure that is flexible or nested, such as JSON and XML without a strict relational schema. | Line tools can inspect snippets, but safe extraction still depends on keys, paths, or XPath. |
| `row group` | Parquet storage unit that groups rows together for columnar reads. | Row groups affect pruning, scan efficiency, and metadata inspection. |
| `compression codec` | Algorithm used to reduce file size, such as gzip or Parquet's internal codecs. | External compression is useful for text, but double-compressing Parquet or Avro is usually wasteful. |
| `XPath` | Query language for selecting XML nodes, attributes, and values. | Namespaced XML becomes impractical without XPath or an equivalent tree-aware selector. |
| `null` | Explicit missing value marker in formats that support it. | Null handling differs between JSON, PowerShell objects, Python values, and CSV empty strings. |
| `quoting` | CSV rule that lets delimiters and newlines appear inside field values. | `cut`, `awk`, and `split(',')` break as soon as quoting becomes significant. |
| `escaping` | Rule for representing special characters inside serialized content. | JSON strings, CSV quoted fields, and XML entities all escape content differently. |
| `multiline field` | Field whose logical value spans more than one physical line. | Multiline content invalidates naive line-counting and delimiter-splitting logic. |

## Prerequisites

The examples below use the real files under `C:\Users\aperi\My Drive\VAULT\data` and were captured on 2026-04-14. Linux commands ran through WSL against `/mnt/c/Users/aperi/My Drive/VAULT/data`. PowerShell commands ran against the Windows paths directly.

| Platform | Tooling used in captured examples | Why this toolchain was chosen |
|---|---|---|
| Linux / WSL | Core text tools, `python3`, and `~/.venvs/elysium-shell/bin/python` with `pyarrow`, `fastavro`, and `lxml` | The base WSL image had the core Unix text stack but not native Parquet, Avro, or XML tooling such as `jq`, `duckdb`, `xmlstarlet`, or `xmllint`. |
| PowerShell / Windows | Native PowerShell cmdlets plus `python` with `pyarrow`, `fastavro`, and `lxml` | PowerShell is strong for CSV, JSON, XML, and text, but Parquet and Avro still need binary-aware libraries. |

The sample set below is intentionally small enough to inspect live while still covering the failure modes that matter in production.

| Format | Representative sample files used here | Why they were chosen |
|---|---|---|
| CSV | `dim_country.csv`, `dim_country.tsv`, `dim_country.ssv`, `powershell-automation/incoming/signals_daily_sample.csv`, `powershell-automation/split/signals_daily_*.csv` | Small enough to inspect directly, but realistic enough to show dialect detection, projection, and header-safe recombination. |
| JSON | `dim_country.json`, `compression_results.json`, `powershell-automation/api/signals_daily_table.json`, `powershell-automation/logs/pipeline.ndjson` | Covers array JSON, nested object JSON, and newline-delimited JSON streams. |
| Parquet | `signals_daily.parquet` | Demonstrates binary identification, schema inspection, column projection, and filtered export. |
| Avro | `_generated/dim_country.avro` | Demonstrates schema-aware binary handling and conversion workflows. |
| Text | `powershell-automation/logs/pipeline.log` | Supports preview, regex search, aggregation, recursive search, rewrite, and compression examples. |
| XML | `signals_sample.xml`, `constituents_namespaced.xml`, `constituent_schema.xsd` | Covers simple XML, namespaced XML, XPath, attributes versus elements, and XSD validation. |

> [!info] Avro fixture source
>
> The `data` directory contained no native `.avro` file on 2026-04-14.
>
> The Avro examples therefore use `C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro`, generated from `dim_country.json` with `fastavro`, so the note still runs against a real file inside the source tree instead of a fabricated placeholder.

| File shape | Safe default | Fast but conditional shortcut | Main failure mode |
|---|---|---|---|
| Plain text log | `grep`, `awk`, `Select-String`, `Group-Object` | `cut`, `sort`, `uniq`, `sed`, `-replace` | Wrong field assumptions when whitespace or delimiters drift. |
| Simple CSV with known delimiter and no embedded quotes/newlines | `Import-Csv`, Python `csv`, DuckDB | `head`, `wc`, `cut`, `sort` | Text tools break once quoting, embedded delimiters, or multiline fields appear. |
| JSON array or nested object | PowerShell objects, Python `json`, DuckDB, `jq` if installed | `grep` only for quick triage on known literals | Keys, nesting, and nulls are lost when parsed as plain text. |
| NDJSON stream | Line tools plus JSON-aware per-line parsing | `grep` or `Select-String` for literal triage | Counting lines is acceptable, but filtering nested fields still needs JSON parsing. |
| Parquet | PyArrow, DuckDB, `parquet-tools` if installed | None | Text tools cannot read the binary container or schema. |
| Avro | Fastavro, official Avro tooling | None | Binary payload and embedded schema are invisible to text tools. |
| XML | `Select-Xml`, `[xml]`, `lxml`, `xq` if installed | `grep` only for coarse inspection | Namespaces, attributes, and tree structure disappear in line-oriented parsing. |

## Linux

Linux is strongest when the file is genuinely line-oriented or when a lightweight text filter can feed a format-aware parser. The examples below deliberately separate those cases so the command choice stays defensible under incident pressure.

### Linux | CSV | inspect, parse, and combine

CSV is not one format so much as a family of conventions. The safe question is not "is it comma-separated?" but "what is the delimiter, where is the header, can values contain quotes or newlines, and will line-based tools preserve the contract?" The examples here use `dim_country.csv` for inspection and `powershell-automation` split files for recombination.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `delimiter` | CSV dialect setting | Character that separates fields. | Treat it as an explicit producer contract, not a guess. |
| `quotechar` | CSV dialect setting | Character that protects embedded delimiters and newlines inside a field. | Any significant quoting makes naive `split(',')`, `cut`, and fixed-field `awk` unsafe. |
| `header row` | First CSV record | Schema labels for the file. | Preserve it once during recombination and rewrites. |
| `symbol` | `signals_daily_sample.csv` string field | Equity or index identifier. | Keep it as text so downstream tools do not coerce it. |
| `dividend_yield` | `signals_daily_sample.csv` numeric field | Yield percentage used for filtering. | Parse numerically before comparing or sorting. |
| `market_cap` | `signals_daily_sample.csv` integer-like field | Capitalization value written to the derived projection. | Preserve the original value without lossy text munging. |

> [!warning] Dialect sniffing is a first pass, not a production contract
>
> Python's `csv` documentation treats `Sniffer()` as a heuristic, and the same documentation requires `newline=''` when you open a file object for `csv.reader` or `csv.writer`.
>
> - Use sniffing to confirm a suspicion, not to define the long-term parser contract.
> - Lock delimiter, quoting, and header ownership down once the upstream producer is known.
> - Revalidate the dialect whenever a supplier changes locale, spreadsheet tooling, or export settings.

> [!success] Freeze the dialect and the write shape explicitly
>
> Open CSV files with `newline=''`, set the delimiter or dialect intentionally, and write derived files with a declared field order. When fragments are recombined, emit one canonical header first and append only data rows.

#### Linux | CSV | file / head / wc | Identify the file, preview it, and count data rows

Before you write a parser or feed the file into a downstream transformation. A staged CSV arrives and you need to confirm that quick text inspection is still safe. Read-only inspection against a UTF-8 CSV file. `wc -l` counts physical newline characters, so it is valid only because this file has one row per line. Confirm the file is text, preview the schema row, and measure row count without loading the file into an editor.

`file` tells you whether the payload is plain text. `head` exposes the header and first few rows. `tail -n +2 | wc -l` counts data rows without the header.

*Inspect the on-disk CSV and verify that it is a one-header, one-line-per-row text export.*

```bash
file "/mnt/c/Users/aperi/My Drive/VAULT/data/dim_country.csv"
head -n 5 "/mnt/c/Users/aperi/My Drive/VAULT/data/dim_country.csv"
tail -n +2 "/mnt/c/Users/aperi/My Drive/VAULT/data/dim_country.csv" | wc -l
```

```text
/mnt/c/Users/aperi/My Drive/VAULT/data/dim_country.csv: CSV Unicode text, UTF-8 text
country_name,iso_alpha2
Afghanistan,AF
Albania,AL
Algeria,DZ
American Samoa,AS
212
```

This file is simple enough that a bounded text preview is safe. That does not mean every CSV in the pipeline is safe for `cut` or `awk`; it only means this specific file is single-line, UTF-8 text with a visible header.

#### Linux | CSV | Python csv | Detect the dialect, filter rows, and write a projection

After inspection confirms that the file is delimited text but you still need schema-aware handling. You need selected columns, numeric filtering, or a new output file without trusting manual delimiter splitting. Read-only on the source file and state-changing on the output file. Python's `csv` module is format-aware for delimiter and quoting behavior. Detect dialect conventions and produce a filtered output file whose header and field ordering are explicit.

The `csv.Sniffer` check confirms the delimiter for each sample dialect. The second block reads a real CSV sample, filters on `dividend_yield`, projects three fields, and writes a new CSV.

*Detect delimiter conventions before parsing, then write a filtered projection with a controlled header.*

```bash
python3 - <<'PY'
import csv
from pathlib import Path
base = Path("/mnt/c/Users/aperi/My Drive/VAULT/data")
for name in ["dim_country.csv", "dim_country.tsv", "dim_country.ssv"]:
    path = base / name
    sample = path.read_text(encoding="utf-8").splitlines()[:3]
    dialect = csv.Sniffer().sniff("\n".join(sample))
    print(f"{name}: delimiter={dialect.delimiter!r} quotechar={dialect.quotechar!r}")
PY

python3 - <<'PY'
import csv
from pathlib import Path
src = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/incoming/signals_daily_sample.csv")
out = Path("/tmp/elysium-signals-dividend-linux.csv")
with src.open(newline="", encoding="utf-8") as fh:
    rows = [r for r in csv.DictReader(fh) if float(r["dividend_yield"]) >= 0.04]
with out.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=["symbol", "dividend_yield", "market_cap"])
    writer.writeheader()
    writer.writerows({k: row[k] for k in writer.fieldnames} for row in rows)
print(out)
print(out.read_text(encoding="utf-8").strip())
PY
```

```text
dim_country.csv: delimiter=',' quotechar='"'
dim_country.tsv: delimiter='\t' quotechar='"'
dim_country.ssv: delimiter=';' quotechar='"'
/tmp/elysium-signals-dividend-linux.csv
symbol,dividend_yield,market_cap
ASML.AS,0.93,465699602432
MC.PA,2.59,251813134336
RMS.PA,0.92,202334076928
OR.PA,1.98,199794982912
SAP.DE,1.51,194931474432
SIE.DE,2.36,182411345920
ITX.MC,2.19,165977686016
DTE.DE,3.07,164294311936
SAN.MC,2.6,145955749888
SU.PA,1.66,145081614336
ALV.DE,4.81,138412933120
AIR.PA,1.82,139861278720
```

The delimiter scan tells you when `-d,` assumptions are wrong. The filtered projection writes a new file with a known header order, which is safer than ad hoc text slicing once types and delimiters matter.

#### Linux | CSV | Python | Recombine split files without duplicating the header row

After a CSV has been split into multiple fragments for transfer, staging, or parallel processing. You need to restore one canonical file for downstream loading or validation. State-changing write into `/tmp`. The source split files already contain their own headers, so naive concatenation would duplicate them. Rebuild one valid CSV with exactly one header row and all data rows preserved.

This pattern uses the dedicated header file and then skips the first line from each split fragment before appending the remaining rows.

*Recombine split CSV fragments while preserving exactly one header row.*

```bash
python3 - <<'PY'
from pathlib import Path
base = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation")
out = Path("/tmp/signals_daily_recombined_linux_fixed.csv")
header = (base / "schemas" / "signals_daily_header.csv").read_text(encoding="utf-8").rstrip("\n")
parts = sorted((base / "split").glob("signals_daily_*.csv"))
with out.open("w", encoding="utf-8", newline="") as fh:
    fh.write(header + "\n")
    for part in parts:
        lines = part.read_text(encoding="utf-8").splitlines()
        for line in lines[1:]:
            fh.write(line + "\n")
lines = out.read_text(encoding="utf-8").splitlines()
print(out)
print(f"rows_with_header={len(lines)}")
for line in lines[:4]:
    print(line)
PY
```

```text
/tmp/signals_daily_recombined_linux_fixed.csv
rows_with_header=467
id,_index,symbol,signal_date,current_price,forward_pe,price_to_book,ev_to_ebitda,dividend_yield,market_cap,beta,fifty_two_week_change,sandp_52_week_change,fifty_day_average,two_hundred_day_average,dist_from_52_week_high,target_median_price,recommendation_mean,upside_potential
"1","euro_stoxx_50","ASML.AS","2026-03-04","1199.8","32.141113","23.578196","35.801","0.93","465699602432","1.431","0.72707","0.16670573","1132.318","853.403","0.08607556368068248","1450.0","1.52273","0.20853475579263225"
"2","euro_stoxx_50","MC.PA","2026-03-04","507.4","18.85428","3.732941","13.311","2.59","251813134336","0.842","-0.24401623","0.16670573","579.204","543.584","0.255356618726152","640.0","2.11111","0.2613322822230981"
"3","euro_stoxx_50","RMS.PA","2026-03-04","1930.0","36.034904","10.741078","25.221","0.92","202334076928","0.942","-0.2898578","0.16670573","2099.75","2165.1626","0.29226255958929226","2355.0","2.18182","0.22020725388601026"
```

This is the production-safe pattern. `cat part*.csv > full.csv` would have produced duplicated header rows because the split files already carried the header.

| Flag | Syntax | Description |
|---|---|---|
| `-n` | `head -n 5 <csv>` | Limits the preview to a bounded number of rows. |
| `+2` | `tail -n +2 <csv>` | Starts at the second physical line so header counting stays separate from data counting. |
| `newline=""` | `open(..., newline="")` | Required by Python's `csv` module for correct newline handling on file objects. |
| `fieldnames=[...]` | `csv.DictWriter(..., fieldnames=[...])` | Freezes header order in the derived projection. |
| `glob("signals_daily_*.csv")` | `sorted((base / "split").glob(...))` | Recombines split fragments in a deterministic order. |

### Linux | JSON | inspect, extract, and summarize

JSON can be a top-level array, a single object with nested subdocuments, or an NDJSON stream that is safe to handle line by line. The operational question is always the same: are you working with keys and object structure, or are you only scanning for a known literal?

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `schema.fields` | Nested JSON array | List of field-definition objects in the table metadata document. | Traverse it as a structured array, not as formatted text. |
| `name` / `type` / `mode` | Field-definition object properties | Logical field name, declared type, and nullability mode. | Keep the three values together when documenting or validating a schema. |
| `method` / `tier` | `compression_results.json` object keys | Benchmark dimension fields. | Compare rows only after parsing the JSON into objects. |
| `compress_tp` / `decompress_tp` | Benchmark throughput strings | Measured compression and decompression throughput. | Preserve units when exporting or summarizing. |
| `level` | NDJSON event property | Event severity used for grouping. | Safe for line-by-line parsing only because the file is explicitly NDJSON. |
| `count` | Derived summary field | Aggregated number of events per severity. | Treat it as a generated metric, not source data. |

> [!warning] JSON documents are not self-framing streams
>
> Python's `json` documentation states that JSON is not a framed protocol, which means repeated `json.dump()` calls to the same file do not create one valid JSON document.
>
> - Write one complete JSON document per file when the contract is array or object JSON.
> - Use NDJSON only when the producer guarantees one complete JSON object per physical line.
> - Do not treat pretty-printed or nested JSON as line-oriented text just because it renders visibly.

> [!success] Keep the framing model explicit
>
> Choose between single-document JSON and NDJSON deliberately, then parse to objects before filtering, counting, or flattening. Once the framing contract is explicit, key paths, null handling, and aggregation logic become predictable.

#### Linux | JSON | python -m json.tool / Python json | Pretty-print the payload, count records, and inspect object boundaries

Before filtering or flattening a JSON payload from an API or benchmark output. A JSON file lands in staging and you need to know whether it is an array or an object. Read-only inspection. `python -m json.tool` reformats valid JSON but does not preserve original whitespace. Confirm structural shape and inspect the first and last objects without guessing from raw text.

The first command pretty-prints a nested object. The second block confirms that `dim_country.json` is an array with 212 objects and shows the first and last record.

*Pretty-print nested JSON and verify whether a file is an array of records or a single object.*

```bash
python3 -m json.tool "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/api/signals_daily_table.json" | head -n 18

python3 - <<'PY'
import json
from pathlib import Path
path = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/dim_country.json")
rows = json.loads(path.read_text(encoding="utf-8"))
print(len(rows))
print(rows[0])
print(rows[-1])
PY
```

```text
{
    "kind": "bigquery#table",
    "etag": "K+jt2ItmRqZMgVH2O5e8Ug==",
    "id": "bq-wh-nb:stoxx_silver.signals_daily",
    "selfLink": "https://bigquery.googleapis.com/bigquery/v2/projects/bq-wh-nb/datasets/stoxx_silver/tables/signals_daily",
    "tableReference": {
        "projectId": "bq-wh-nb",
        "datasetId": "stoxx_silver",
        "tableId": "signals_daily"
    },
    "schema": {
        "fields": [
            {
                "name": "id",
                "type": "INTEGER",
                "mode": "NULLABLE"
            },
            {
212
{'country_name': 'Afghanistan', 'iso_alpha2': 'AF'}
{'country_name': 'Zimbabwe', 'iso_alpha2': 'ZW'}
```

Once you know whether the root is an object or an array, later extraction logic becomes deterministic. Text search alone cannot give you that guarantee.

#### Linux | JSON | Python json | Extract nested schema fields and filter benchmark objects

Use this once the root shape is already confirmed and the next step is real field extraction. Table-definition JSON or benchmark results need an operator-facing summary based on nested fields rather than raw text search. Read-only parsing of JSON objects and arrays with key-aware traversal rather than line-oriented matching. Pull nested fields out of actual JSON objects and apply semantic filters to the records that matter.

The first block extracts nested BigQuery schema fields. The second block filters compression benchmark rows down to the `zstd` method and keeps only the operational throughput values.

*Read nested keys and filter object arrays without flattening the file into brittle text patterns.*

```bash
python3 - <<'PY'
import json
from pathlib import Path
path = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/api/signals_daily_table.json")
obj = json.loads(path.read_text(encoding="utf-8"))
for field in obj["schema"]["fields"][:6]:
    print("{}\t{}\t{}".format(field["name"], field["type"], field["mode"]))
PY

python3 - <<'PY'
import json
from pathlib import Path
path = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/compression_results.json")
rows = json.loads(path.read_text(encoding="utf-8"))
rows = [r for r in rows if r["method"] == "zstd"]
rows.sort(key=lambda r: r["tier"])
for row in rows:
    print("{}\t{}\t{}\t{}".format(row["method"], row["tier"], row["compress_tp"], row["decompress_tp"]))
PY
```

```text
id	INTEGER	NULLABLE
_index	STRING	NULLABLE
symbol	STRING	NULLABLE
signal_date	DATE	NULLABLE
current_price	FLOAT	NULLABLE
forward_pe	FLOAT	NULLABLE
zstd	1000_small	226.0 MB/s	784.7 MB/s
zstd	large	215.1 MB/s	705.7 MB/s
```

This is the right moment for JSON-aware tooling. `grep` might find `"method": "zstd"`, but it cannot guarantee object boundaries, nested path correctness, or null handling.

#### Linux | JSON | Python json / csv | Aggregate NDJSON by level and write a CSV summary

When the payload is one valid JSON object per line and line streaming is part of the contract. Log or event files arrive as NDJSON rather than a top-level array. Read-only on the source file and state-changing on the output CSV. This is safe because each line is parsed independently as JSON. Summarize a JSON stream while preserving structure-awareness per event.

`pipeline.ndjson` is line-delimited JSON, so line-wise ingestion is acceptable. The block below parses each line, groups by `level`, and writes a compact summary CSV.

*Aggregate a newline-delimited JSON log into a flat CSV summary.*

```bash
python3 - <<'PY'
import json, csv
from pathlib import Path
src = Path("/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.ndjson")
out = Path("/tmp/pipeline_levels_linux.csv")
rows = [json.loads(line) for line in src.read_text(encoding="utf-8").splitlines() if line.strip()]
summary = {}
for row in rows:
    summary[row["level"]] = summary.get(row["level"], 0) + 1
with out.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["level", "count"])
    for level in sorted(summary):
        writer.writerow([level, summary[level]])
print(out)
print(out.read_text(encoding="utf-8").strip())
PY
```

```text
/tmp/pipeline_levels_linux.csv
level,count
ERROR,2
INFO,1
WARN,2
```

NDJSON is the narrow case where line-oriented handling and JSON-aware parsing coexist cleanly. A top-level array JSON file does not have that property.

| Flag | Syntax | Description |
|---|---|---|
| `-m` | `python3 -m json.tool <file>` | Runs the standard-library JSON formatter and validator as a module. |
| `loads()` | `json.loads(text)` | Parses one JSON document into Python objects. |
| `splitlines()` | `text.splitlines()` | Produces one candidate record per physical line for NDJSON workflows. |
| `writerow([...])` | `csv.writer(...).writerow([...])` | Emits a controlled tabular summary after structured parsing. |
| `writerows(...)` | `csv.writer(...).writerows(...)` | Writes all generated summary rows in one pass. |

### Linux | Parquet | inspect, filter, and export

Parquet is a binary, columnar container. The operator goal is not to "cat the file" but to inspect schema, project only the columns needed, filter rows with typed predicates, and export a smaller artifact when a text consumer still needs one.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `schema_arrow` | `ParquetFile` schema object | Logical column schema exposed by PyArrow. | Inspect it before deciding which columns to project. |
| `num_rows` | Parquet metadata integer | Total rows stored in the file. | Use it as a transfer and extraction sanity check. |
| `num_row_groups` | Parquet metadata integer | Physical grouping of rows inside the file. | Row-group layout affects pruning and how localized corruption can be. |
| `columns=[...]` | `read_table()` parameter | Explicit projected column list. | Read only the fields the workflow actually needs. |
| `dividend_yield` | Numeric column | Filter predicate used in the examples. | Guard for nulls before comparing. |
| `market_cap` | Numeric column | Value carried into the derived CSV. | Keep Parquet as source of truth and treat CSV as derivative. |

> [!warning] Parquet is strongest when you keep the native container intact
>
> Parquet's file-format documentation treats row groups and column chunks as first-class physical structures, and PyArrow exposes selective reads directly.
>
> - Binary inspection should begin with metadata, not with text tooling.
> - Blanket CSV export throws away types, encodings, and pruning benefits.
> - A single row group is simple here, but it gives less pruning flexibility than a more segmented dataset.

> [!success] Inspect metadata first and export only at the consumer boundary
>
> Read schema and row-group metadata before choosing a predicate, project only the needed columns, and keep the Parquet file as the durable contract unless the receiving tool truly needs text.

#### Linux | Parquet | file / PyArrow | Identify the container and inspect schema metadata

Before opening a Parquet file in an analysis or ingestion workflow. A binary analytics extract lands in staging and you need to confirm the format and shape. Read-only. `file` uses signatures; PyArrow reads metadata without converting the full file to text. Confirm the container type, fields, row count, and row-group structure.

*Classify the binary file and inspect the first six columns from its embedded schema.*

```bash
file "/mnt/c/Users/aperi/My Drive/VAULT/data/signals_daily.parquet"

~/.venvs/elysium-shell/bin/python - <<'PY'
import pyarrow.parquet as pq
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/signals_daily.parquet"
pf = pq.ParquetFile(path)
for i, field in enumerate(pf.schema_arrow):
    if i == 6:
        break
    print("{}\t{}".format(field.name, field.type))
print("rows={}".format(pf.metadata.num_rows))
print("row_groups={}".format(pf.num_row_groups))
PY
```

```text
/mnt/c/Users/aperi/My Drive/VAULT/data/signals_daily.parquet: Apache Parquet
id	int64
_index	string
symbol	string
signal_date	date32[day]
current_price	double
forward_pe	double
rows=466
row_groups=1
```

Parquet exposes both field types and row-group metadata. That is the information you need to reason about column projection and scan cost.

#### Linux | Parquet | PyArrow | Project columns and filter high-yield rows

After schema inspection confirms the columns and types you need. You need only a few fields from a wider Parquet file or a filtered analytical slice. Read-only projection against a binary columnar file. The predicate is applied after reading the projected columns into Python. Keep binary reads narrow and produce a typed result set instead of scanning the full row shape blindly.

*Select three columns from Parquet and keep only rows whose dividend yield is at least 4%.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
import pyarrow.parquet as pq
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/signals_daily.parquet"
rows = pq.read_table(path, columns=["symbol", "forward_pe", "dividend_yield"]).to_pylist()
rows = [r for r in rows if r["dividend_yield"] is not None and r["dividend_yield"] >= 4]
rows.sort(key=lambda r: (-r["dividend_yield"], r["symbol"]))
for row in rows[:8]:
    print("{}\t{}\t{}".format(row["symbol"], row["forward_pe"], row["dividend_yield"]))
PY
```

```text
BNP.PA	6.7327175	11.43
BNP.PA	6.9642887	11.27
ISP.MI	8.3515215	7.15
ISP.MI	8.701373	7.14
VOW.DE	3.5628338	6.7
VOW.DE	3.4232497	6.68
MBG.DE	6.9037566	6.29
MBG.DE	7.123044	6.28
```

This is where Parquet's columnar design pays off. The read stays limited to the columns you asked for instead of materializing the entire schema.

#### Linux | Parquet | PyArrow / csv | Export a filtered Parquet subset to CSV

When a downstream consumer needs text output even though the source of truth is Parquet. A spreadsheet, shell audit, or upload step still requires CSV. State-changing write into `/tmp`. Exporting to CSV discards Parquet typing and compression advantages. Produce a narrow interoperability file while keeping the source Parquet intact.

*Write the filtered Parquet subset to a CSV file for text-based consumers.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
import csv
from pathlib import Path
import pyarrow.parquet as pq
src = "/mnt/c/Users/aperi/My Drive/VAULT/data/signals_daily.parquet"
out = Path("/tmp/high_dividend_signals_linux.csv")
rows = pq.read_table(src, columns=["symbol", "dividend_yield", "market_cap"]).to_pylist()
rows = [r for r in rows if r["dividend_yield"] is not None and r["dividend_yield"] >= 4]
rows.sort(key=lambda r: (-r["dividend_yield"], r["symbol"]))
with out.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=["symbol", "dividend_yield", "market_cap"])
    writer.writeheader()
    writer.writerows(rows[:8])
print(out)
print(out.read_text(encoding="utf-8").strip())
PY
```

```text
/tmp/high_dividend_signals_linux.csv
symbol,dividend_yield,market_cap
BNP.PA,11.43,96434364416
BNP.PA,11.27,99751215104
ISP.MI,7.15,90478108672
ISP.MI,7.14,94268317696
VOW.DE,6.7,45768257536
VOW.DE,6.68,47923826688
MBG.DE,6.29,48471580672
MBG.DE,6.28,50011205632
```

Conversion is appropriate at interoperability boundaries, not as a default storage downgrade. Keep the Parquet source when schema, type fidelity, or scan efficiency still matter.

| Flag | Syntax | Description |
|---|---|---|
| `columns=[...]` | `pq.read_table(path, columns=["symbol", ...])` | Restricts the read to the named Parquet columns. |
| `metadata.num_rows` | `pf.metadata.num_rows` | Returns total row count from metadata. |
| `num_row_groups` | `pf.num_row_groups` | Reports the physical row-group count. |
| `to_pylist()` | `pq.read_table(...).to_pylist()` | Materializes the projected table into Python records for filtering. |
| `DictWriter` | `csv.DictWriter(..., fieldnames=[...])` | Writes a controlled CSV export when text output is required. |

### Linux | Avro | inspect, filter, and convert

Avro is row-oriented, self-describing, and binary. The embedded schema is the first thing to inspect, because field names and types live inside the container rather than beside it in a sidecar file.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `writer_schema` | Avro container metadata | Schema embedded in the file by the producer. | Inspect it before assuming reader compatibility. |
| `fields` | Writer-schema array | Ordered list of field definitions. | Treat the field names and types as the contract for filtering and conversion. |
| `country_name` | Avro string field | Primary filter field in the examples. | Filter on the parsed field value, not on raw bytes. |
| `iso_alpha2` | Avro string field | Short country code emitted in projections. | Preserve it as the canonical short identifier. |
| `reader()` | `fastavro.reader` iterator | Record iterator over the Avro container. | Use it whenever you need row-aware access instead of text inspection. |

> [!warning] Avro interoperability depends on schema resolution, not on the file name alone
>
> The Avro specification defines compatibility between a writer's schema and a reader's schema, including how names and default values participate in resolution.
>
> - A consumer that assumes the wrong schema can misread or reject the file.
> - JSON conversion is convenient for humans but weaker than the original Avro container.
> - Container inspection belongs before any filter or export step.

> [!success] Read the embedded schema before you transform the payload
>
> Verify the writer schema, test filters on real parsed records, and convert to JSON only when a downstream consumer cannot accept Avro directly.

#### Linux | Avro | file / fastavro | Identify the container and inspect the writer schema

Before reading Avro records or converting the file for another consumer. An Avro payload appears in staging and you need to understand its schema contract. Read-only inspection. The file used here is a generated-in-tree fixture because the source tree originally had no Avro sample. Confirm that the payload is Avro and expose the embedded field definitions.

*Classify the Avro file and print the field names stored in its writer schema.*

```bash
file "/mnt/c/Users/aperi/My Drive/VAULT/data/_generated/dim_country.avro"

~/.venvs/elysium-shell/bin/python - <<'PY'
from fastavro import reader
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/_generated/dim_country.avro"
with open(path, "rb") as fh:
    av = reader(fh)
    for field in av.writer_schema["fields"]:
        print("{}\t{}".format(field["name"], field["type"]))
PY
```

```text
/mnt/c/Users/aperi/My Drive/VAULT/data/_generated/dim_country.avro: Apache Avro version 1
country_name	string
iso_alpha2	string
```

The schema is part of the file contract. That is the main operational difference from CSV, where the file itself cannot tell you whether a blank field means empty string, null, or a parsing failure.

#### Linux | Avro | fastavro | Filter records by field values

After schema inspection confirms the field names and types you want to filter on. You need a subset of rows or a sanity check against actual record values. Read-only stream over Avro records. This is record-aware rather than line-aware processing. Demonstrate that Avro rows are accessed through the schema contract, not through delimiter positions.

*Read Avro records and keep only countries whose names start with `A`.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
from fastavro import reader
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/_generated/dim_country.avro"
with open(path, "rb") as fh:
    rows = [r for r in reader(fh) if r["country_name"].startswith("A")][:8]
for row in rows:
    print("{}\t{}".format(row["country_name"], row["iso_alpha2"]))
PY
```

```text
Afghanistan	AF
Albania	AL
Algeria	DZ
American Samoa	AS
Andorra	AD
Angola	AO
Anguilla	AI
Antarctica	AQ
```

This is the Avro equivalent of row filtering in a typed container. Plain text tools cannot safely recover this structure from the binary payload.

#### Linux | Avro | fastavro / Python json | Convert a filtered Avro slice to JSON

When a consumer can read JSON but not Avro. A troubleshooting step, API handoff, or human-readable artifact is required. State-changing write into `/tmp`. The conversion is lossy with respect to Avro container metadata and codec details. Materialize a readable interchange file without mutating the source Avro payload.

*Convert a filtered Avro slice into a JSON document.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
import json
from pathlib import Path
from fastavro import reader
src = "/mnt/c/Users/aperi/My Drive/VAULT/data/_generated/dim_country.avro"
out = Path("/tmp/dim_country_a_linux.json")
with open(src, "rb") as fh:
    rows = [r for r in reader(fh) if r["country_name"].startswith("A")][:5]
out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(out)
print(out.read_text(encoding="utf-8").strip())
PY
```

```text
/tmp/dim_country_a_linux.json
[
  {
    "country_name": "Afghanistan",
    "iso_alpha2": "AF"
  },
  {
    "country_name": "Albania",
    "iso_alpha2": "AL"
  },
  {
    "country_name": "Algeria",
    "iso_alpha2": "DZ"
  },
  {
    "country_name": "American Samoa",
    "iso_alpha2": "AS"
  },
  {
    "country_name": "Andorra",
    "iso_alpha2": "AD"
  }
]
```

Conversion is a boundary step. Keep Avro in Avro when schema evolution, binary efficiency, or upstream compatibility still matter.

| Flag | Syntax | Description |
|---|---|---|
| `writer_schema` | `reader(fh).writer_schema` | Reads the embedded schema from the Avro container. |
| `fields` | `writer_schema["fields"]` | Lists declared field definitions in writer order. |
| `reader(fh)` | `for row in reader(fh): ...` | Iterates Avro records safely through the schema-aware reader. |
| `startswith("A")` | `row["country_name"].startswith("A")` | Demonstrates record-level filtering on a parsed field. |
| `json.dumps(..., indent=2)` | `json.dumps(rows, indent=2)` | Produces a readable JSON export when an interoperability file is required. |

### Linux | Text | search, aggregate, and rewrite

Plain text logs are where shell pipelines are at their best. The main hazards are field-position assumptions, accidental rewrites in place, and confusing recursive scans with structured parsing when the payload is actually JSON, XML, Parquet, or Avro.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `ERROR|WARN` | Regex pattern | Severity tokens used to surface urgent lines. | Regex is safe here because the file contract is genuinely line-oriented text. |
| `level` | Derived token from log line position | Severity segment extracted for aggregation. | Document the positional assumption whenever you parse plain text. |
| `-print0` / `-0` | `find` / `xargs` safety options | Null-delimited path transport across the pipeline. | Use them whenever file names can contain spaces. |
| `sed` substitution | Stream rewrite expression | Token replacement in a copied log file. | Write to a new file or stdout first so the source remains recoverable. |
| `gzip` / `zcat` | Compression round-trip | Archive and verify plain text without losing readability. | Keep compression as a wrapper around text, not as a parser. |

#### Linux | Text | head / grep | Preview the log and search for warning or error lines

At the start of triage on a plain text log. A pipeline run reports failure, latency, or unexpected warnings. Read-only inspection of a line-oriented log file. Regex search is appropriate because this file is genuinely plain text. Bound the scope quickly and surface the lines that deserve deeper investigation.

*Preview the first log lines and isolate warnings and errors with line numbers.*

```bash
head -n 5 "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log"
grep -nE "ERROR|WARN" "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log"
```

```text
2026-04-14 08:00:00 INFO Starting stoxx-to-bigquery sync
2026-04-14 08:00:02 INFO Exported 12 rows from silver.eurostoxx50_ohlcv
2026-04-14 08:00:05 WARN BigQuery dry run estimated 98506 bytes scanned
2026-04-14 08:00:07 INFO Uploaded eurostoxx50_ohlcv.csv to gs://stoxx-bq-bucket/exports/
2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
3:2026-04-14 08:00:05 WARN BigQuery dry run estimated 98506 bytes scanned
5:2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
7:2026-04-14 08:00:15 WARN Pub/Sub backlog check returned 0 undelivered messages
9:2026-04-14 08:00:20 ERROR Checksum validation failed on stale local copy
11:2026-04-14 08:00:25 WARN Service account key older than threshold: 3166c79513e7
```

This is the strongest case for plain text tooling: genuine one-line log events with predictable tokens and no nested structure.

#### Linux | Text | awk / find / xargs | Aggregate levels and search a directory tree safely

After initial triage shows a pattern worth quantifying or searching across multiple files. You need counts by level or you need to know whether the same failure appears elsewhere in the log tree. Read-only aggregation and recursive search. `find -print0 | xargs -0` is chosen to preserve file names safely. Turn a log from anecdote into counts and extend the search scope without losing line numbers or file paths.

*Count log levels and recurse through the log tree for every `ERROR` hit.*

```bash
awk "{count[\$3]++} END {for (level in count) print level, count[level]}" "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log" | sort
find "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs" -type f -name "*.log" -print0 | xargs -0 grep -Hn "ERROR"
```

```text
ERROR 2
INFO 7
WARN 3
/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log:5:2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log:9:2026-04-14 08:00:20 ERROR Checksum validation failed on stale local copy
```

This is still line-oriented processing, but it is now using safe file-name handling and explicit field selection rather than an ad hoc search across a shell glob.

#### Linux | Text | sed / gzip / zcat | Rewrite a token and round-trip the log through compression

When you need a transformed copy of a text file or you need to validate that compressed transport still preserves readability. A downstream tool expects normalized log tokens or you want to compress archival text safely. `sed` here writes to stdout only; the source file is not changed. The gzip example writes a temporary compressed copy and reads it back. Show the safe pattern for substitution and compression without destroying the original log.

*Create a transformed view of the log and verify that a gzip round-trip preserves the payload.*

```bash
sed "s/WARN/WARNING/g" "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log" | head -n 4
gzip -c "/mnt/c/Users/aperi/My Drive/VAULT/data/powershell-automation/logs/pipeline.log" > /tmp/pipeline.log.gz && zcat /tmp/pipeline.log.gz | tail -n 3
```

```text
2026-04-14 08:00:00 INFO Starting stoxx-to-bigquery sync
2026-04-14 08:00:02 INFO Exported 12 rows from silver.eurostoxx50_ohlcv
2026-04-14 08:00:05 WARNING BigQuery dry run estimated 98506 bytes scanned
2026-04-14 08:00:07 INFO Uploaded eurostoxx50_ohlcv.csv to gs://stoxx-bq-bucket/exports/
2026-04-14 08:00:22 INFO Re-downloaded eurostoxx50_ohlcv.csv and verified SHA-256
2026-04-14 08:00:25 WARN Service account key older than threshold: 3166c79513e7
2026-04-14 08:00:27 INFO Completed stoxx-to-bigquery sync
```

Rewrite into a new file or stdout first. In-place edits are appropriate only when the file is disposable or versioned elsewhere.

| Flag | Syntax | Description |
|---|---|---|
| `-n` | `head -n 5 <log>` | Limits preview to the first few log lines. |
| `-E` | `grep -E 'ERROR|WARN' <log>` | Enables extended regex syntax for grouped search patterns. |
| `-print0` | `find ... -print0` | Emits null-delimited file names for safe piping. |
| `-0` | `xargs -0 grep -Hn 'ERROR'` | Consumes null-delimited file names without splitting on spaces. |
| `-c` | `gzip -c <log> > <archive>` | Writes compressed output to stdout so the source file stays untouched. |
| `-n` | `zcat <archive> | tail -n 3` | Limits the decompressed preview to the last lines you need. |

### Linux | XML | query, validate, and flatten

XML is structured, hierarchical, and often namespaced. The shell is still useful around it, but the selector must understand elements, attributes, and namespaces or the query will silently miss the target nodes.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `idx` / `cst` | Namespace-prefix bindings | Aliases used to address the two XML namespaces in XPath. | Bind them explicitly before querying namespaced elements. |
| `symbol` / `country` / `sector` | Constituent attributes | Business attributes emitted in the flattened projection. | Preserve them exactly when exporting to CSV. |
| `weight` | Constituent element value | Numeric weight associated with the constituent. | Treat it as structured node data, not as a text fragment. |
| `XMLSchema.validate()` | `lxml` validation method | Structural validation of a node tree against the XSD. | Run it before flattening or loading when a schema contract exists. |
| `xpath(..., namespaces=...)` | XPath call with namespace map | Namespace-aware node selection. | Use it instead of namespace-blind search. |

> [!warning] Namespace-blind XML queries often fail silently
>
> XML namespace handling is explicit by design, and Python's XML documentation also warns that untrusted XML deserves a security review before parsing.
>
> - An XPath that ignores namespaces can return zero nodes even when the document is populated.
> - Text search does not preserve element scope, attributes, or schema rules.
> - Validation belongs before flattening when an XSD exists.

> [!success] Bind namespaces and validate before you flatten
>
> Define the namespace map up front, query the tree with XPath, and validate the business nodes against the XSD before exporting only the fields a CSV consumer can retain.

#### Linux | XML | head / lxml | Preview the namespaced document and select constituent nodes

Before writing XPath or schema validation logic against a new XML payload. An XML file arrives from a vendor or index process and you need to confirm structure and namespaces. Read-only inspection. The preview uses text, but the selection uses `lxml` and explicit namespace bindings. Confirm the document shape and prove that namespace-aware XPath selects the intended nodes.

*Preview the XML header and extract four constituent rows with their sectors and weights.*

```bash
head -n 12 "/mnt/c/Users/aperi/My Drive/VAULT/data/constituents_namespaced.xml"

~/.venvs/elysium-shell/bin/python - <<'PY'
from lxml import etree
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/constituents_namespaced.xml"
ns = {
    "idx": "https://elysium.local/schemas/index/v1",
    "cst": "https://elysium.local/schemas/constituent/v1",
}
root = etree.parse(path)
rows = root.xpath("//cst:constituent", namespaces=ns)
for node in rows[:4]:
    print("{}\t{}\t{}".format(node.get("symbol"), node.get("sector"), node.findtext("cst:weight", namespaces=ns)))
PY
```

```text
<?xml version="1.0" encoding="UTF-8"?>
<idx:index xmlns:idx="https://elysium.local/schemas/index/v1"
           xmlns:cst="https://elysium.local/schemas/constituent/v1"
           code="SX5E" asof="2026-03-31" currency="EUR">
  <idx:name>Euro Stoxx 50</idx:name>
  <idx:provider>Elysium Indices</idx:provider>
  <idx:constituents count="6">
    <cst:constituent symbol="ASML.AS" country="NL" sector="Information Technology">
      <cst:weight>0.0812</cst:weight>
      <cst:shares>395000000</cst:shares>
      <cst:price currency="EUR">851.45</cst:price>
    </cst:constituent>
ASML.AS	Information Technology	0.0812
SAP.DE	Information Technology	0.0654
MC.PA	Consumer Discretionary	0.0591
NESN.SW	Consumer Staples	0.0483
```

The preview tells you the payload is namespaced. The XPath block is the proof that your namespace map is correct.

#### Linux | XML | lxml | Aggregate sectors and validate constituent nodes against XSD

After basic node selection works and you need either summary metrics or structural validation. You need to sanity-check business distribution or confirm that XML nodes still match the schema contract. Read-only parsing and validation. The XSD validates the constituent elements rather than the outer index wrapper. Quantify the payload and verify that the repeated business nodes remain schema-compliant.

*Count sectors in a simple XML feed and validate every namespaced constituent node against the XSD.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
from collections import Counter
from lxml import etree
path = "/mnt/c/Users/aperi/My Drive/VAULT/data/signals_sample.xml"
root = etree.parse(path)
counts = Counter(root.xpath("//signal/sector/text()"))
for sector, count in sorted(counts.items()):
    print("{}\t{}".format(sector, count))
PY

~/.venvs/elysium-shell/bin/python - <<'PY'
from lxml import etree
xml = etree.parse("/mnt/c/Users/aperi/My Drive/VAULT/data/constituents_namespaced.xml")
xsd = etree.parse("/mnt/c/Users/aperi/My Drive/VAULT/data/constituent_schema.xsd")
schema = etree.XMLSchema(xsd)
ns = {"cst": "https://elysium.local/schemas/constituent/v1"}
valid = 0
for node in xml.xpath("//cst:constituent", namespaces=ns):
    doc = etree.ElementTree(node)
    if schema.validate(doc):
        valid += 1
print("valid_constituents={}".format(valid))
print("total_constituents={}".format(len(xml.xpath("//cst:constituent", namespaces=ns))))
PY
```

```text
Consumer Discretionary	2
Consumer Staples	2
Energy	1
Financials	2
Health Care	1
Industrials	2
Information Technology	2
valid_constituents=6
total_constituents=6
```

Validation is the line between "the XML parses" and "the XML still matches the contract the downstream system expects."

#### Linux | XML | lxml / csv | Flatten namespaced XML into a CSV projection

When an XML source must feed a tabular downstream step. A load process, spreadsheet handoff, or audit extract expects CSV. State-changing write into `/tmp`. Flattening discards hierarchy, namespace details, and attribute structure not explicitly selected. Materialize a controlled tabular view instead of relying on ad hoc text scraping.

*Extract a CSV projection from the namespaced constituents document.*

```bash
~/.venvs/elysium-shell/bin/python - <<'PY'
import csv
from pathlib import Path
from lxml import etree
src = "/mnt/c/Users/aperi/My Drive/VAULT/data/constituents_namespaced.xml"
out = Path("/tmp/constituents_linux.csv")
ns = {"cst": "https://elysium.local/schemas/constituent/v1"}
xml = etree.parse(src)
rows = []
for node in xml.xpath("//cst:constituent", namespaces=ns):
    rows.append({
        "symbol": node.get("symbol"),
        "country": node.get("country"),
        "sector": node.get("sector"),
        "weight": node.findtext("cst:weight", namespaces=ns),
    })
with out.open("w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=["symbol", "country", "sector", "weight"])
    writer.writeheader()
    writer.writerows(rows)
print(out)
print(out.read_text(encoding="utf-8").strip())
PY
```

```text
/tmp/constituents_linux.csv
symbol,country,sector,weight
ASML.AS,NL,Information Technology,0.0812
SAP.DE,DE,Information Technology,0.0654
MC.PA,FR,Consumer Discretionary,0.0591
NESN.SW,CH,Consumer Staples,0.0483
TTE.PA,FR,Energy,0.0412
SIE.DE,DE,Industrials,0.0398
```

Flatten only the fields you actually need. XML can carry more hierarchy than a CSV target can represent.

| Flag | Syntax | Description |
|---|---|---|
| `-n` | `head -n 12 <xml>` | Previews the declaration and root structure without opening an editor. |
| `namespaces={...}` | `xml.xpath('//cst:constituent', namespaces=ns)` | Supplies the namespace map required for namespaced XPath. |
| `XMLSchema(xsd)` | `schema = etree.XMLSchema(xsd)` | Builds the validator from the XSD document. |
| `validate(doc)` | `schema.validate(doc)` | Returns whether the XML node tree satisfies the schema contract. |
| `DictWriter` | `csv.DictWriter(..., fieldnames=[...])` | Writes a controlled flattened projection to CSV. |

## PowerShell

PowerShell gives you object-native handling for CSV, JSON, XML, and text. The main decision is therefore not "can PowerShell parse this?" but "do I stay in native cmdlets, or do I switch to Python because the payload is a binary analytic format such as Parquet or Avro?"

### PowerShell | CSV | inspect, parse, and combine

PowerShell's CSV stack is strong as long as you tell it the real delimiter and keep header handling explicit. The examples below mirror the Linux section: inspect the source, parse with schema awareness, and recombine split files without duplicating the header row.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `-Delimiter` | `Import-Csv` / `Export-Csv` parameter | Explicit field separator for non-comma dialects. | Use it whenever the producer is tab-, semicolon-, or culture-delimited. |
| `header row` | First CSV record | Column names used to create object properties. | Recombine split files only after deciding which header is authoritative. |
| `symbol` | `signals_daily_sample.csv` property | Equity or index identifier. | Keep it as text through import and export. |
| `dividend_yield` | Imported CSV property | Yield field used in `Where-Object`. | Cast it before numeric comparison so text ordering cannot leak into the predicate. |
| `market_cap` | Imported CSV property | Capitalization field kept in the projection. | Preserve the original value shape when exporting. |
| `-LiteralPath` | File-path parameter | Exact path binding without wildcard expansion. | Prefer it for paths that contain spaces or literal metacharacters. |

> [!warning] PowerShell will honor the schema contract you give it, even when it is wrong
>
> `Import-Csv` assumes the delimiter you specify or the default comma, and Microsoft Learn documents that `Export-Csv -Append -Force` writes only matching properties when schemas drift.
>
> - A wrong delimiter turns one logical row into the wrong object shape.
> - Blind append logic can discard new columns instead of preserving them.
> - Recombined fragments need one authoritative header, not whatever happened to be appended first.

> [!success] Keep delimiter, quoting, and append behavior explicit
>
> Set `-Delimiter` when the producer is not standard comma CSV, export with an intentional column list, and append only when the existing header is known to match the incoming object shape. When in doubt, write a new file and validate it before replacing the old one.

#### PowerShell | CSV | Get-Item / Get-Content / Measure-Object | Identify the file, preview it, and count data rows

Before you transform or load a CSV on Windows. A CSV, TSV, or semicolon-separated export arrives in a landing directory. Read-only inspection. `Get-Content` previews text; `Import-Csv` plus `Measure-Object` counts objects rather than raw lines. Confirm the file footprint, preview the header, and count records with object-aware parsing.

*Inspect the incoming CSV and count records through `Import-Csv` rather than raw line counting.*

```powershell
Get-Item -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\dim_country.csv' | Select-Object Name,Length,Extension
Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\dim_country.csv' -TotalCount 5
(Import-Csv -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\dim_country.csv' | Measure-Object).Count
```

```text
Name            Length Extension
----            ------ ---------
dim_country.csv   2896 .csv
country_name,iso_alpha2
Afghanistan,AF
Albania,AL
Algeria,DZ
American Samoa,AS
212
```

`Import-Csv` counts parsed objects, which is safer than assuming physical lines equal logical rows once quoting or multiline content enters the picture.

#### PowerShell | CSV | Import-Csv / Export-Csv | Detect delimiters, filter rows, and write a projection

After inspection shows that the file is delimited text but you need reliable field-level work. You need selected columns, numeric filtering, or a new CSV with a controlled header. Read-only on the source files and state-changing on the new output file. `Import-Csv` uses the delimiter you specify; `Export-Csv` writes the output contract explicitly. Parse the correct dialect and produce a filtered, reproducible CSV artifact.

The first command proves that tab-delimited input still parses correctly when you set `-Delimiter`. The second block filters a real sample file and writes a projected CSV.

*Use the correct delimiter and export a filtered projection with an explicit header.*

```powershell
Import-Csv -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\dim_country.tsv' -Delimiter "`t" | Select-Object -First 4

$src = 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\incoming\signals_daily_sample.csv'
$out = Join-Path $env:TEMP 'signals_dividend_ps.csv'
Import-Csv -LiteralPath $src |
    Where-Object { [double]$_.dividend_yield -ge 0.04 } |
    Select-Object symbol, dividend_yield, market_cap |
    Export-Csv -LiteralPath $out -NoTypeInformation
$out
Get-Content -LiteralPath $out -TotalCount 13
```

```text
country_name   iso_alpha2
------------   ----------
Afghanistan    AF
Albania        AL
Algeria        DZ
American Samoa AS
C:\Users\aperi\AppData\Local\Temp\signals_dividend_ps.csv
"symbol","dividend_yield","market_cap"
"ASML.AS","0.93","465699602432"
"MC.PA","2.59","251813134336"
"RMS.PA","0.92","202334076928"
"OR.PA","1.98","199794982912"
"SAP.DE","1.51","194931474432"
"SIE.DE","2.36","182411345920"
"ITX.MC","2.19","165977686016"
"DTE.DE","3.07","164294311936"
"SAN.MC","2.6","145955749888"
"SU.PA","1.66","145081614336"
"ALV.DE","4.81","138412933120"
"AIR.PA","1.82","139861278720"
```

PowerShell's object model makes column selection clean, but the parse still depends on the delimiter contract being correct.

#### PowerShell | CSV | Set-Content / Add-Content | Recombine split files without duplicating the header row

After a CSV has been split into fragments for transport or batching. A downstream load step expects one reconstructed file. State-changing write into `$env:TEMP`. The source parts already include their own headers, so recombination must skip them deliberately. Restore one valid CSV with one header row and all data rows present exactly once.

*Recombine split CSV fragments while skipping duplicate headers from each part.*

```powershell
$base = 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation'
$out = Join-Path $env:TEMP 'signals_daily_recombined_ps_fixed.csv'
$header = (Get-Content -LiteralPath (Join-Path $base 'schemas\signals_daily_header.csv') -Raw).TrimEnd("`r","`n")
$parts = Get-ChildItem -LiteralPath (Join-Path $base 'split') -Filter 'signals_daily_*.csv' | Sort-Object Name
Set-Content -LiteralPath $out -Value $header
foreach ($part in $parts) {
    Get-Content -LiteralPath $part.FullName | Select-Object -Skip 1 | Add-Content -LiteralPath $out
}
$lines = Get-Content -LiteralPath $out
$out
"rows_with_header=$($lines.Count)"
$lines | Select-Object -First 4
```

```text
C:\Users\aperi\AppData\Local\Temp\signals_daily_recombined_ps_fixed.csv
rows_with_header=467
id,_index,symbol,signal_date,current_price,forward_pe,price_to_book,ev_to_ebitda,dividend_yield,market_cap,beta,fifty_two_week_change,sandp_52_week_change,fifty_day_average,two_hundred_day_average,dist_from_52_week_high,target_median_price,recommendation_mean,upside_potential
"1","euro_stoxx_50","ASML.AS","2026-03-04","1199.8","32.141113","23.578196","35.801","0.93","465699602432","1.431","0.72707","0.16670573","1132.318","853.403","0.08607556368068248","1450.0","1.52273","0.20853475579263225"
"2","euro_stoxx_50","MC.PA","2026-03-04","507.4","18.85428","3.732941","13.311","2.59","251813134336","0.842","-0.24401623","0.16670573","579.204","543.584","0.255356618726152","640.0","2.11111","0.2613322822230981"
"3","euro_stoxx_50","RMS.PA","2026-03-04","1930.0","36.034904","10.741078","25.221","0.92","202334076928","0.942","-0.2898578","0.16670573","2099.75","2165.1626","0.29226255958929226","2355.0","2.18182","0.22020725388601026"
```

This is the safe recombination pattern on Windows. The header is written once, and every part contributes only data rows.

| Flag | Syntax | Description |
|---|---|---|
| `-LiteralPath` | `Import-Csv -LiteralPath <path>` | Uses the path exactly as written, which is safer for paths with spaces. |
| `-Delimiter` | `Import-Csv -Delimiter "`t"` <path>` | Parses TSV or other non-comma dialects correctly. |
| `-NoTypeInformation` | `Export-Csv -NoTypeInformation <path>` | Keeps legacy `#TYPE` metadata out of the CSV output. |
| `-Append` | `Export-Csv -Append <path>` | Adds rows to an existing CSV instead of replacing it. |
| `-Force` | `Export-Csv -Append -Force <path>` | Allows append across mismatched properties, discarding non-matching columns. |
| `-UseQuotes` | `Export-Csv -UseQuotes AsNeeded <path>` | Controls when quotes are emitted around fields. |
| `-QuoteFields` | `Export-Csv -QuoteFields "Date","DateTime" <path>` | Restricts forced quoting to the listed columns. |
| `-NoHeader` | `Export-Csv -NoHeader <path>` | Suppresses the header row when an existing header must be preserved. |

### PowerShell | JSON | inspect, extract, and summarize

PowerShell turns JSON into objects quickly, but the right mental model is still structural. Array files, nested object documents, and NDJSON logs are related formats, not interchangeable text blobs.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `-Raw` | `Get-Content` parameter | Reads the whole file as one string before parsing. | Use it for single-document JSON, not for very large or untrusted payloads by default. |
| `-NoEnumerate` | `ConvertFrom-Json` parameter | Preserves arrays as one object instead of auto-enumerating their elements. | Required when a single-item array must round-trip back to JSON unchanged. |
| `-AsHashtable` | `ConvertFrom-Json` parameter | Converts JSON to an ordered hashtable instead of `PSCustomObject`. | Useful when duplicate-case keys or empty-string keys would break object conversion. |
| `-DateKind` | `ConvertFrom-Json` parameter | Controls how timestamp strings are converted. | Use it when local/UTC/offset preservation affects downstream behavior. |
| `schema.fields` | Nested JSON property | Array of field metadata objects in the sample API document. | Traverse it as properties, not as formatted text. |
| `level` | NDJSON property | Event severity used for grouping. | Parse one JSON object per line only when the file is explicitly NDJSON. |

> [!warning] Some JSON edge cases disappear silently in object conversion
>
> Microsoft Learn documents that `ConvertFrom-Json` keeps only the last duplicate key name, and that single-element arrays need `-NoEnumerate` to round-trip correctly.
>
> - Duplicate keys should be treated as malformed or at least suspicious input.
> - Array semantics can collapse if you forget `-NoEnumerate`.
> - Timestamp parsing can change behavior across environments if `-DateKind` is left implicit.

> [!success] Preserve semantics before you transform the document
>
> Use `Get-Content -Raw` for one-document JSON, `ConvertFrom-Json -NoEnumerate` when array shape matters, `-AsHashtable` when object conversion would lose fidelity, and `-DateKind` when time-zone handling must stay explicit.

#### PowerShell | JSON | Get-Content / ConvertFrom-Json | Pretty-print the payload, count records, and inspect object boundaries

Before any filtering or flattening logic on a JSON file. A JSON document lands from an API, benchmark run, or metadata export. Read-only inspection. `ConvertFrom-Json` materializes objects in memory, which is appropriate here because the sample files are small. Confirm whether the root shape is an array or an object and inspect representative records.

*Preview nested JSON and confirm the record count and object boundaries of a JSON array.*

```powershell
Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\api\signals_daily_table.json' -TotalCount 18

$rows = Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\dim_country.json' -Raw | ConvertFrom-Json
$rows.Count
$rows | Select-Object -First 1
$rows | Select-Object -Last 1
```

```text
{
  "kind": "bigquery#table",
  "etag": "K+jt2ItmRqZMgVH2O5e8Ug==",
  "id": "bq-wh-nb:stoxx_silver.signals_daily",
  "selfLink": "https://bigquery.googleapis.com/bigquery/v2/projects/bq-wh-nb/datasets/stoxx_silver/tables/signals_daily",
  "tableReference": {
    "projectId": "bq-wh-nb",
    "datasetId": "stoxx_silver",
    "tableId": "signals_daily"
  },
  "schema": {
    "fields": [
      {
        "name": "id",
        "type": "INTEGER",
        "mode": "NULLABLE"
      },
      {
212
country_name iso_alpha2
------------ ----------
Afghanistan  AF
Zimbabwe     ZW
```

The top snippet proves the file is a nested object. The object count and first/last row prove that `dim_country.json` is an array of records rather than an NDJSON stream.

#### PowerShell | JSON | ConvertFrom-Json | Extract nested schema fields and filter benchmark objects

Use this once the root shape is known and the next step is path-aware extraction. Metadata documents or benchmark results need an operator or loader summary based on nested properties. Read-only traversal of PowerShell objects produced by `ConvertFrom-Json` instead of regex-based line scraping. Reach nested fields directly and filter JSON records by meaning instead of by text position.

*Select nested schema fields and isolate only the `zstd` benchmark rows.*

```powershell
(Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\api\signals_daily_table.json' -Raw | ConvertFrom-Json).schema.fields |
    Select-Object -First 6 name, type, mode

Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\compression_results.json' -Raw |
    ConvertFrom-Json |
    Where-Object method -eq 'zstd' |
    Sort-Object tier |
    Select-Object method, tier, compress_tp, decompress_tp
```

```text
name          type    mode
----          ----    ----
id            INTEGER NULLABLE
_index        STRING  NULLABLE
symbol        STRING  NULLABLE
signal_date   DATE    NULLABLE
current_price FLOAT   NULLABLE
forward_pe    FLOAT   NULLABLE
method tier       compress_tp decompress_tp
------ ----       ----------- -------------
zstd   1000_small 226.0 MB/s  784.7 MB/s
zstd   large      215.1 MB/s  705.7 MB/s
```

This is the PowerShell equivalent of key-aware JSON extraction. The property access path is the contract, not the physical position of a line in the file.

#### PowerShell | JSON | ConvertFrom-Json / Group-Object | Aggregate NDJSON by level

Use this when the file contract is explicitly one JSON object per line. Event, webhook, or pipeline logs arrive as NDJSON and need a quick level summary. Read-only line streaming with one `ConvertFrom-Json` parse per line before grouping on the `level` property. Show where line streaming and JSON-aware parsing safely meet.

*Parse an NDJSON log line by line and aggregate event counts by level.*

```powershell
$src = 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.ndjson'
Get-Content -LiteralPath $src |
    ForEach-Object { $_ | ConvertFrom-Json } |
    Group-Object level |
    Sort-Object Name |
    Select-Object Name, Count
```

```text
Name  Count
----  -----
ERROR     2
INFO      1
WARN      2
```

The line boundary is safe here because each line is a complete JSON document. That does not generalize to array JSON files or multiline objects.

| Flag | Syntax | Description |
|---|---|---|
| `-Raw` | `Get-Content -Raw <file>` | Reads a single JSON document as one string for safe parsing. |
| `-AsHashtable` | `ConvertFrom-Json -AsHashtable` | Preserves key order and handles inputs that do not fit `PSCustomObject` cleanly. |
| `-NoEnumerate` | `ConvertFrom-Json -NoEnumerate` | Prevents single-element arrays from collapsing during round-trip. |
| `-DateKind` | `ConvertFrom-Json -DateKind Utc` | Forces explicit timestamp-conversion behavior. |
| `-Depth` | `ConvertFrom-Json -Depth 256` | Raises or constrains the maximum parse depth for nested documents. |
| `-First` | `Select-Object -First 6` | Limits schema or object previews to a bounded sample. |

### PowerShell | Parquet | inspect, filter, and export

PowerShell does not natively parse Parquet, but it can still orchestrate a clean workflow around binary inspection, Python-based schema reads, and controlled export for text consumers.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `Format-Hex` | PowerShell cmdlet | Reads the file header bytes for quick container identification. | Use it to verify `PAR1` before invoking a binary-aware reader. |
| `schema_arrow` | PyArrow schema object | Logical Parquet schema exposed through Python. | Inspect it before projection or export. |
| `num_rows` | Parquet metadata integer | Total rows stored in the file. | Sanity-check it after transfer or regeneration. |
| `num_row_groups` | Parquet metadata integer | Physical grouping of rows. | More row groups improve pruning flexibility; one row group is coarser. |
| `columns=[...]` | `read_table()` parameter | Explicit column projection list. | Keep reads narrow and type-aware. |
| `market_cap` | Exported numeric column | Column retained in the derived CSV. | Treat the CSV as a downstream artifact, not the source of truth. |

> [!warning] The easiest Parquet mistake on Windows is to downgrade it to text too early
>
> Parquet keeps schema and physical layout in the binary container, and PyArrow exposes that metadata directly.
>
> - `Format-Hex` is for identification, not for parsing.
> - CSV export is appropriate for interoperability, not for routine analysis.
> - Row-group layout influences how selectively the file can be read later.

> [!success] Let PowerShell orchestrate and let PyArrow parse
>
> Verify the signature, inspect schema metadata through Python, project only the needed columns, and emit CSV only when the receiving tool cannot consume Parquet directly.

#### PowerShell | Parquet | Get-Item / Format-Hex / Python | Identify the container and inspect schema metadata

Before reading Parquet into an analytical or data-loading step on Windows. A `.parquet` file arrives and you need to confirm both the binary signature and the column contract. Read-only. `Format-Hex` verifies the magic bytes; Python with PyArrow reads embedded schema metadata. Prove the file type and expose the fields, row count, and row-group metadata without converting the file to text.

*Inspect the Parquet file footprint, verify the `PAR1` magic bytes, and read the first six schema fields.*

```powershell
Get-Item -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet' | Select-Object Name,Length,Extension
Format-Hex -Path 'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet' -Count 4
@'
import pyarrow.parquet as pq
path = r'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet'
pf = pq.ParquetFile(path)
for i, field in enumerate(pf.schema_arrow):
    if i == 6:
        break
    print(f'{field.name}\t{field.type}')
print(f'rows={pf.metadata.num_rows}')
print(f'row_groups={pf.num_row_groups}')
'@ | python -
```

```text
Name                  Length Extension
----                  ------ ---------
signals_daily.parquet  60836 .parquet
Label: C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet
          Offset Bytes                                          Ascii
          ------ ----------------------------------------------- -----
0000000000000000 50 41 52 31                                     PAR1
id	int64
_index	string
symbol	string
signal_date	date32[day]
current_price	double
forward_pe	double
rows=466
row_groups=1
```

The hex signature proves you are dealing with a Parquet container, not mislabeled text. The schema metadata tells you how to read it safely.

#### PowerShell | Parquet | Python | Project columns and filter high-yield rows

After schema inspection confirms which columns and types matter. An investigation or export needs only a narrow subset of the Parquet payload. Read-only typed projection through PyArrow. The filtered result is still derived from the binary source of truth. Avoid full-row scans and produce a precise analytical slice.

*Read only three Parquet columns and keep rows whose dividend yield is at least 4%.*

```powershell
@'
import pyarrow.parquet as pq
path = r'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet'
rows = pq.read_table(path, columns=['symbol','forward_pe','dividend_yield']).to_pylist()
rows = [r for r in rows if r['dividend_yield'] is not None and r['dividend_yield'] >= 4]
rows.sort(key=lambda r: (-r['dividend_yield'], r['symbol']))
for row in rows[:8]:
    print(f"{row['symbol']}\t{row['forward_pe']}\t{row['dividend_yield']}")
'@ | python -
```

```text
BNP.PA	6.7327175	11.43
BNP.PA	6.9642887	11.27
ISP.MI	8.3515215	7.15
ISP.MI	8.701373	7.14
VOW.DE	3.5628338	6.7
VOW.DE	3.4232497	6.68
MBG.DE	6.9037566	6.29
MBG.DE	7.123044	6.28
```

Projection is the core Parquet performance habit. Read only the columns you need, then filter with typed predicates.

#### PowerShell | Parquet | Python / Export-Csv | Export a filtered Parquet subset to CSV

When a downstream step still needs text output even though the source is Parquet. A spreadsheet, upload step, or shell audit expects CSV. State-changing write into `$env:TEMP`. The export is an interoperability artifact, not the source of truth. Materialize a narrow CSV slice while preserving the original Parquet file.

*Write the filtered Parquet subset to a CSV file for text-oriented consumers.*

```powershell
@'
import csv
from pathlib import Path
import pyarrow.parquet as pq
src = r'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet'
out = Path.home() / 'AppData' / 'Local' / 'Temp' / 'high_dividend_signals_ps.csv'
rows = pq.read_table(src, columns=['symbol','dividend_yield','market_cap']).to_pylist()
rows = [r for r in rows if r['dividend_yield'] is not None and r['dividend_yield'] >= 4]
rows.sort(key=lambda r: (-r['dividend_yield'], r['symbol']))
with out.open('w', newline='', encoding='utf-8') as fh:
    writer = csv.DictWriter(fh, fieldnames=['symbol','dividend_yield','market_cap'])
    writer.writeheader()
    writer.writerows(rows[:8])
print(out)
print(out.read_text(encoding='utf-8').strip())
'@ | python -
```

```text
C:\Users\aperi\AppData\Local\Temp\high_dividend_signals_ps.csv
symbol,dividend_yield,market_cap
BNP.PA,11.43,96434364416
BNP.PA,11.27,99751215104
ISP.MI,7.15,90478108672
ISP.MI,7.14,94268317696
VOW.DE,6.7,45768257536
VOW.DE,6.68,47923826688
MBG.DE,6.29,48471580672
MBG.DE,6.28,50011205632
```

Export Parquet only when the consumer truly needs CSV. Otherwise, keep the Parquet payload because it is the stronger contract.

| Flag | Syntax | Description |
|---|---|---|
| `-Count` | `Format-Hex -Count 4 <parquet>` | Limits the hex dump to the magic bytes used for file identification. |
| `schema_arrow` | `pf.schema_arrow` | Returns the logical Parquet schema through PyArrow. |
| `metadata.num_rows` | `pf.metadata.num_rows` | Returns total row count from metadata. |
| `num_row_groups` | `pf.num_row_groups` | Reports the physical row-group count. |
| `columns=[...]` | `pq.read_table(path, columns=[...])` | Projects only the named columns during the read. |
| `DictWriter` | `csv.DictWriter(..., fieldnames=[...])` | Writes a controlled CSV export when text output is required. |

### PowerShell | Avro | inspect, filter, and convert

Avro is another case where PowerShell should orchestrate rather than pretend the payload is text. Use PowerShell to identify the file and Python to read the embedded schema and records safely.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `Format-Hex` | PowerShell cmdlet | Reads the file header bytes for container identification. | Use it to confirm the `Obj` magic bytes before parsing. |
| `writer_schema` | Avro container metadata | Embedded producer schema. | Inspect it before assuming downstream compatibility. |
| `fields` | Writer-schema array | Ordered field definitions declared in the file. | Use them as the contract for filters and conversions. |
| `country_name` | Avro string field | Primary filter field in the sample workflow. | Filter on parsed records, not raw bytes. |
| `iso_alpha2` | Avro string field | Companion short code preserved in exports. | Keep it unchanged through derived artifacts. |
| `reader()` | `fastavro` iterator | Record iterator over the Avro container. | Use it whenever row-aware access is needed. |

> [!warning] Avro compatibility lives or dies on schema compatibility
>
> The Avro specification defines compatibility through writer-schema and reader-schema resolution, including how default values participate in that process.
>
> - Reading the wrong schema is a contract problem, not a text-parsing problem.
> - JSON exports are convenient for humans but weaker than the original Avro container.
> - Container inspection belongs before any conversion step.

> [!success] Verify the embedded schema before handing the file to another tool
>
> Confirm the magic bytes, read the writer schema, test filters on actual parsed records, and convert to JSON only when a consumer cannot handle Avro natively.

#### PowerShell | Avro | Get-Item / Format-Hex / Python | Identify the container and inspect the writer schema

Before reading or converting an Avro payload on Windows. A `.avro` file appears in staging and you need to confirm that the embedded schema matches expectations. Read-only inspection. `Obj` in the magic bytes identifies the Avro container; Python exposes the writer schema. Prove the file type and inspect the embedded field definitions.

*Inspect the Avro file footprint, verify its magic bytes, and print the writer schema fields.*

```powershell
Get-Item -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro' | Select-Object Name,Length,Extension
Format-Hex -Path 'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro' -Count 4
@'
from fastavro import reader
path = r'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro'
with open(path, 'rb') as fh:
    av = reader(fh)
    for field in av.writer_schema['fields']:
        print(f"{field['name']}\t{field['type']}")
'@ | python -
```

```text
Name             Length Extension
----             ------ ---------
dim_country.avro   2895 .avro
Label: C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro
          Offset Bytes                                          Ascii
          ------ ----------------------------------------------- -----
0000000000000000 4F 62 6A 01                                     Obj�
country_name	string
iso_alpha2	string
```

This is the essential Avro inspection pattern on Windows: identify the container and then read the embedded schema, not the raw bytes.

#### PowerShell | Avro | Python | Filter records by field values

After schema inspection confirms the field names you intend to use. A troubleshooting or validation step needs a subset of Avro rows. Read-only record iteration through `fastavro`. This is row-aware binary parsing. Demonstrate how Avro records are filtered by schema-defined fields rather than by textual position.

*Read Avro records and keep only countries whose names start with `A`.*

```powershell
@'
from fastavro import reader
path = r'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro'
with open(path, 'rb') as fh:
    rows = [r for r in reader(fh) if r['country_name'].startswith('A')][:8]
for row in rows:
    print(f"{row['country_name']}\t{row['iso_alpha2']}")
'@ | python -
```

```text
Afghanistan	AF
Albania	AL
Algeria	DZ
American Samoa	AS
Andorra	AD
Angola	AO
Anguilla	AI
Antarctica	AQ
```

The filter is field-aware and typed. Text search against the raw Avro file would not be reliable.

#### PowerShell | Avro | Python / JSON | Convert a filtered Avro slice to JSON

When a downstream Windows tool can read JSON but not Avro. You need a readable handoff file or quick inspection artifact. State-changing write into `$env:TEMP`. The output keeps the data values but not the full Avro container metadata. Materialize a readable interchange document while leaving the Avro source unchanged.

*Convert a filtered Avro slice into JSON for human or tool consumption.*

```powershell
@'
import json
from pathlib import Path
from fastavro import reader
src = r'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro'
out = Path.home() / 'AppData' / 'Local' / 'Temp' / 'dim_country_a_ps.json'
with open(src, 'rb') as fh:
    rows = [r for r in reader(fh) if r['country_name'].startswith('A')][:5]
out.write_text(json.dumps(rows, indent=2), encoding='utf-8')
print(out)
print(out.read_text(encoding='utf-8').strip())
'@ | python -
```

```text
C:\Users\aperi\AppData\Local\Temp\dim_country_a_ps.json
[
  {
    "country_name": "Afghanistan",
    "iso_alpha2": "AF"
  },
  {
    "country_name": "Albania",
    "iso_alpha2": "AL"
  },
  {
    "country_name": "Algeria",
    "iso_alpha2": "DZ"
  },
  {
    "country_name": "American Samoa",
    "iso_alpha2": "AS"
  },
  {
    "country_name": "Andorra",
    "iso_alpha2": "AD"
  }
]
```

Use this only when the consumer boundary requires JSON. Otherwise, keep Avro as the system-of-record format.

| Flag | Syntax | Description |
|---|---|---|
| `-Count` | `Format-Hex -Count 4 <avro>` | Limits the hex dump to the Avro magic bytes. |
| `writer_schema` | `reader(fh).writer_schema` | Returns the schema embedded in the Avro container. |
| `fields` | `writer_schema["fields"]` | Lists the declared field definitions. |
| `reader(fh)` | `for row in reader(fh): ...` | Iterates Avro records safely through the schema-aware reader. |
| `json.dumps(..., indent=2)` | `json.dumps(rows, indent=2)` | Produces a readable JSON export when conversion is necessary. |

### PowerShell | Text | search, aggregate, and rewrite

PowerShell is effective on text because it can stay line-oriented where that is correct and object-oriented where grouping and projection make the results easier to reason about.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `ERROR|WARN` | Regex pattern | Severity search used to surface urgent lines. | Safe because the file contract is plain text. |
| `LineNumber` | `Select-String` match property | Original line number of a hit. | Keep it in the rendered output so follow-up navigation stays precise. |
| `Name` / `Count` | `Group-Object` output fields | Derived severity name and aggregated frequency. | Treat them as summary metrics, not as source columns. |
| `-replace` | PowerShell operator | Token substitution in a copied text file. | Write to a new file first and validate before replacing the source. |
| `Compress-Archive` | Packaging cmdlet | Wraps the log in a zip container for transfer. | Use it after validation, not as a substitute for parsing. |

#### PowerShell | Text | Get-Content / Select-String | Preview the log and search for warning or error lines

Use this at the start of an incident or validation pass on a text log. A failed job run or warning review needs a bounded preview and immediate pattern search. Read-only inspection of a genuinely line-oriented log with preserved file path and line-number metadata. Bound the log quickly, surface the important lines, and keep line numbers for follow-up navigation.

*Preview the first log lines and isolate warnings and errors with path and line number.*

```powershell
Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log' -TotalCount 5
Select-String -Path 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log' -Pattern 'ERROR|WARN' |
    ForEach-Object { '{0}:{1}:{2}' -f $_.Path, $_.LineNumber, $_.Line }
```

```text
2026-04-14 08:00:00 INFO Starting stoxx-to-bigquery sync
2026-04-14 08:00:02 INFO Exported 12 rows from silver.eurostoxx50_ohlcv
2026-04-14 08:00:05 WARN BigQuery dry run estimated 98506 bytes scanned
2026-04-14 08:00:07 INFO Uploaded eurostoxx50_ohlcv.csv to gs://stoxx-bq-bucket/exports/
2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:3:2026-04-14 08:00:05 WARN BigQuery dry run estimated 98506 bytes scanned
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:5:2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:7:2026-04-14 08:00:15 WARN Pub/Sub backlog check returned 0 undelivered messages
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:9:2026-04-14 08:00:20 ERROR Checksum validation failed on stale local copy
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:11:2026-04-14 08:00:25 WARN Service account key older than threshold: 3166c79513e7
```

This is the direct PowerShell equivalent of the Linux preview-plus-search workflow. The result keeps path and line metadata intact.

#### PowerShell | Text | Group-Object / Select-String | Aggregate levels and recurse through the log tree

After initial search finds a pattern worth counting or broadening. You need event counts by level or you need to know whether `ERROR` appears anywhere else under the log root. Read-only aggregation and recursive search. The grouping logic is explicit about field position inside the log line. Quantify the log and expand the search scope without losing file or line context.

*Count event levels and recurse through the log directory for every `ERROR` line.*

```powershell
Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log' |
    ForEach-Object { ($_ -split ' ')[2] } |
    Group-Object |
    Sort-Object Name |
    Select-Object Name,Count

Get-ChildItem -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs' -Recurse -File -Filter '*.log' |
    Select-String -Pattern 'ERROR' |
    ForEach-Object { '{0}:{1}:{2}' -f $_.Path, $_.LineNumber, $_.Line }
```

```text
Name  Count
----  -----
ERROR     2
INFO      7
WARN      3
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:5:2026-04-14 08:00:11 ERROR First webhook notification attempt timed out
C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log:9:2026-04-14 08:00:20 ERROR Checksum validation failed on stale local copy
```

This is the point where PowerShell's object pipeline helps: grouped counts are still easy to read, and recursive search still preserves the original file context.

#### PowerShell | Text | Set-Content / Compress-Archive | Rewrite a token and round-trip the log through compression

When you need a transformed copy of a text file or you need to package it for archival transfer. A consumer expects normalized tokens or an archive artifact is required. State-changing writes into `$env:TEMP`. The source file is not modified. Show the safe overwrite pattern and verify that a zip round-trip preserves the text payload.

*Write a transformed copy of the log and confirm that a compressed archive expands back to the same text.*

```powershell
$out = Join-Path $env:TEMP 'pipeline-warning.log'
(Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log') -replace 'WARN','WARNING' |
    Set-Content -LiteralPath $out
$out
Get-Content -LiteralPath $out -TotalCount 4

$zip = Join-Path $env:TEMP 'pipeline-log.zip'
$extract = Join-Path $env:TEMP 'pipeline-log-unzipped'
Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\powershell-automation\logs\pipeline.log' -DestinationPath $zip
Expand-Archive -LiteralPath $zip -DestinationPath $extract
Get-Content -LiteralPath (Join-Path $extract 'pipeline.log') -Tail 3
```

```text
C:\Users\aperi\AppData\Local\Temp\pipeline-warning.log
2026-04-14 08:00:00 INFO Starting stoxx-to-bigquery sync
2026-04-14 08:00:02 INFO Exported 12 rows from silver.eurostoxx50_ohlcv
2026-04-14 08:00:05 WARNING BigQuery dry run estimated 98506 bytes scanned
2026-04-14 08:00:07 INFO Uploaded eurostoxx50_ohlcv.csv to gs://stoxx-bq-bucket/exports/
2026-04-14 08:00:22 INFO Re-downloaded eurostoxx50_ohlcv.csv and verified SHA-256
2026-04-14 08:00:25 WARN Service account key older than threshold: 3166c79513e7
2026-04-14 08:00:27 INFO Completed stoxx-to-bigquery sync
```

Rewrite to a new file first. That keeps the source stable while you verify the transformed output and the compressed round-trip.

| Flag | Syntax | Description |
|---|---|---|
| `-LiteralPath` | `Get-Content -LiteralPath <path>` | Binds the path exactly as written. |
| `-TotalCount` | `Get-Content -TotalCount 5 <path>` | Limits the preview to an explicit number of lines. |
| `-Pattern` | `Select-String -Pattern 'ERROR|WARN'` | Supplies the literal or regex pattern to search for. |
| `-Recurse` | `Get-ChildItem -Recurse -File` | Traverses a directory tree to find additional logs. |
| `-replace` | `$_ -replace 'WARN','WARNING'` | Rewrites matching tokens while leaving the source file unchanged. |
| `-DestinationPath` | `Compress-Archive -DestinationPath <zip>` | Specifies the zip artifact that will hold the copied log. |

### PowerShell | XML | query, validate, and flatten

PowerShell has first-class XML handling, but namespaced documents still require explicit namespace bindings. The safe habit is the same as on Linux: use a tree-aware selector, validate when a schema exists, and flatten only the fields the downstream target can actually preserve.

| Field or parameter | Source / type | Meaning | Operational guidance |
|---|---|---|---|
| `-Namespace` | `Select-Xml` parameter | Hashtable that maps XPath prefixes to namespace URIs. | Mandatory for reliable namespaced XPath on Windows. |
| `idx` / `cst` | Namespace aliases | Prefixes used to address the index and constituent namespaces. | Keep them stable so XPath stays readable. |
| `symbol` / `country` / `sector` | Constituent attributes | Business attributes emitted in the flattened export. | Preserve them exactly when creating the CSV derivative. |
| `weight` | Constituent element value | Numeric element selected for flattened output. | Treat it as node data, not as string-scraped text. |
| `valid_constituents` / `total_constituents` | Derived validation counters | Counts emitted by the XSD validation step. | Use them to confirm schema coverage before exporting. |
| `Export-Csv` | Output cmdlet | Produces the flattened tabular artifact. | Keep the XML source as the authoritative hierarchical document. |

> [!warning] Namespace mistakes usually look like empty results, not loud failures
>
> Microsoft Learn documents explicit namespace maps for `Select-Xml`, and XML parsing guidance in Python also treats untrusted XML as a security-sensitive input class.
>
> - An XPath without namespace bindings can return zero nodes even though the document is valid.
> - Flattening before validation can hide structural errors that the XSD would have caught.
> - The CSV export keeps only the fields you choose; it cannot preserve hierarchy or namespace context.

> [!success] Bind namespaces, validate, and then flatten
>
> Build the namespace map first, confirm the node selection, validate the business nodes against the XSD, and export only the subset of fields that the tabular consumer truly needs.

#### PowerShell | XML | Get-Content / Select-Xml | Preview the namespaced document and select constituent nodes

Before deeper XPath or schema work on a new XML payload. A vendor or index XML document lands and you need to confirm structure and namespaces. Read-only inspection. `Select-Xml` uses an explicit namespace map so XPath matches namespaced elements correctly. Verify the document header and confirm that namespace-aware selection returns the intended nodes.

*Preview the XML header and extract four constituent nodes with their sectors and weights.*

```powershell
Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\constituents_namespaced.xml' -TotalCount 12
$path = 'C:\Users\aperi\My Drive\VAULT\data\constituents_namespaced.xml'
$ns = @{ idx='https://elysium.local/schemas/index/v1'; cst='https://elysium.local/schemas/constituent/v1' }
Select-Xml -Path $path -XPath '//cst:constituent' -Namespace $ns |
    Select-Object -First 4 |
    ForEach-Object {
        $node = $_.Node
        "{0}`t{1}`t{2}" -f $node.symbol, $node.sector, $node.weight
    }
```

```text
<?xml version="1.0" encoding="UTF-8"?>
<idx:index xmlns:idx="https://elysium.local/schemas/index/v1"
           xmlns:cst="https://elysium.local/schemas/constituent/v1"
           code="SX5E" asof="2026-03-31" currency="EUR">
  <idx:name>Euro Stoxx 50</idx:name>
  <idx:provider>Elysium Indices</idx:provider>
  <idx:constituents count="6">
    <cst:constituent symbol="ASML.AS" country="NL" sector="Information Technology">
      <cst:weight>0.0812</cst:weight>
      <cst:shares>395000000</cst:shares>
      <cst:price currency="EUR">851.45</cst:price>
    </cst:constituent>
ASML.AS	Information Technology	0.0812
SAP.DE	Information Technology	0.0654
MC.PA	Consumer Discretionary	0.0591
NESN.SW	Consumer Staples	0.0483
```

Namespace-aware selection is the dividing line between a correct XML query and a query that silently returns nothing.

#### PowerShell | XML | [xml] / Group-Object / Python | Aggregate sectors and validate constituent nodes against XSD

After node selection works and you need business or structural verification. You need category counts or proof that the XML still matches its schema contract. Read-only parsing. PowerShell's `[xml]` cast is used for aggregation; Python with `lxml` performs XSD validation. Summarize the payload and validate the repeated business nodes before flattening or loading them.

*Count sectors in a simple XML feed and validate every namespaced constituent against the XSD.*

```powershell
[xml]$xml = Get-Content -LiteralPath 'C:\Users\aperi\My Drive\VAULT\data\signals_sample.xml'
$xml.signals.signal | Group-Object sector | Sort-Object Name | Select-Object Name,Count

@'
from lxml import etree
xml = etree.parse(r'C:\Users\aperi\My Drive\VAULT\data\constituents_namespaced.xml')
xsd = etree.parse(r'C:\Users\aperi\My Drive\VAULT\data\constituent_schema.xsd')
schema = etree.XMLSchema(xsd)
ns = {'cst': 'https://elysium.local/schemas/constituent/v1'}
valid = 0
for node in xml.xpath('//cst:constituent', namespaces=ns):
    doc = etree.ElementTree(node)
    if schema.validate(doc):
        valid += 1
print(f'valid_constituents={valid}')
print(f'total_constituents={len(xml.xpath("//cst:constituent", namespaces=ns))}')
'@ | python -
```

```text
Name                  Count
----                  -----
Consumer Discretionary     2
Consumer Staples           2
Energy                     1
Financials                 2
Health Care                1
Industrials                2
Information Technology     2
valid_constituents=6
total_constituents=6
```

Counting by sector is a business sanity check. XSD validation is the structural sanity check. They answer different operational questions and both matter.

#### PowerShell | XML | [xml] / Export-Csv | Flatten namespaced XML into a CSV projection

When an XML source must feed a tabular downstream system on Windows. A load, audit, or ad hoc handoff requires CSV rather than XML. State-changing write into `$env:TEMP`. Flattening preserves only the selected attributes and elements. Produce a controlled tabular view instead of scraping XML with plain text tools.

*Export a CSV projection from the namespaced constituents document.*

```powershell
$xmlPath = 'C:\Users\aperi\My Drive\VAULT\data\constituents_namespaced.xml'
$out = Join-Path $env:TEMP 'constituents_ps.csv'
[xml]$xml = Get-Content -LiteralPath $xmlPath
$rows = foreach ($node in $xml.index.constituents.constituent) {
    [pscustomobject]@{
        symbol = $node.symbol
        country = $node.country
        sector = $node.sector
        weight = $node.weight
    }
}
$rows | Export-Csv -LiteralPath $out -NoTypeInformation
$out
Get-Content -LiteralPath $out -TotalCount 7
```

```text
C:\Users\aperi\AppData\Local\Temp\constituents_ps.csv
"symbol","country","sector","weight"
"ASML.AS","NL","Information Technology","0.0812"
"SAP.DE","DE","Information Technology","0.0654"
"MC.PA","FR","Consumer Discretionary","0.0591"
"NESN.SW","CH","Consumer Staples","0.0483"
"TTE.PA","FR","Energy","0.0412"
"SIE.DE","DE","Industrials","0.0398"
```

Flatten the XML intentionally. If you need hierarchy, namespaces, or mixed content later, keep the XML source and treat the CSV only as a derivative artifact.

| Flag | Syntax | Description |
|---|---|---|
| `-LiteralPath` | `Get-Content -LiteralPath <xml>` | Reads the exact XML path without wildcard expansion. |
| `-Path` | `Select-Xml -Path <xml> -XPath ...` | Specifies the XML file to query. |
| `-XPath` | `Select-Xml -XPath '//cst:constituent'` | Supplies the XPath expression that selects the target nodes. |
| `-Namespace` | `Select-Xml -Namespace $ns` | Binds namespace prefixes so the XPath matches namespaced elements. |
| `-NoTypeInformation` | `Export-Csv -NoTypeInformation <csv>` | Keeps legacy type metadata out of the flattened CSV output. |
| `-First` | `Select-Object -First 4` | Limits the preview to a bounded node sample. |

## Decision Guidance

Choose the parser by the record boundary and the preservation requirement, not by the habit of the last successful one-liner. The checks below are quick enough to run during triage and explicit enough to defend in production.

### Decision Guidance | identify the real record boundary

The first question is whether one physical line equals one logical record. If not, line tools become preview tools rather than parsers.

#### Decision Guidance | Python | Distinguish line-oriented, document-oriented, and binary payloads before picking the toolchain

Quoted CSV, NDJSON, and Parquet can all arrive as files, but they do not expose the same record boundary. This probe shows why the parser choice has to follow the contract rather than the extension alone.

*Probe three payload shapes before selecting the parser family.*

```python
import csv
import io
import json
from pathlib import Path

csv_payload = 'id,comment\n1,"line one\nline two"\n2,"single line"\n'
rows = list(csv.reader(io.StringIO(csv_payload)))
ndjson_payload = '{"level":"INFO"}\n{"level":"ERROR"}\n'
events = [json.loads(line) for line in ndjson_payload.splitlines() if line]
parquet_magic = Path(r'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet').read_bytes()[:4].decode('ascii')

print(f'csv_physical_lines={len(csv_payload.splitlines())}')
print(f'csv_records={len(rows) - 1}')
print(f'ndjson_lines={len(ndjson_payload.splitlines())}')
print(f'ndjson_records={len(events)}')
print(f'parquet_magic={parquet_magic}')
```

```text
csv_physical_lines=4
csv_records=2
ndjson_lines=2
ndjson_records=2
parquet_magic=PAR1
```

The CSV sample has four physical lines but only two data records because one field spans lines. The NDJSON sample keeps one record per line, and the Parquet file identifies itself immediately as a binary container through the `PAR1` signature.

> [!warning] Physical lines are not always logical records
>
> A file that renders line by line can still require a structure-aware parser if `quotechar`, nested objects, or binary metadata define the real record boundary.

> [!success] Promote the tool as soon as the contract stops being line-oriented
>
> Use line tools for preview and bounded search, then switch to `csv`, `json`, `Select-Xml`, PyArrow, or Fastavro as soon as the payload stops being one-record-per-line text.

### Decision Guidance | preserve native containers until the consumer boundary

The second question is whether the downstream tool can use the native format. If it can, keep the richer contract and export to text only as a deliberate compatibility step.

#### Decision Guidance | Python | Keep Parquet and Avro native until a consumer actually requires text

Schema-carrying binary formats give you field types and structural metadata that disappear the moment you flatten them into CSV or ad hoc JSON. Inspect the native contract first and export only when a consumer cannot use it directly.

*Inspect the native schema surfaces before choosing an export format.*

```python
import pyarrow.parquet as pq
from fastavro import reader

path_parquet = r'C:\Users\aperi\My Drive\VAULT\data\signals_daily.parquet'
path_avro = r'C:\Users\aperi\My Drive\VAULT\data\_generated\dim_country.avro'
pf = pq.ParquetFile(path_parquet)

print('parquet_columns=' + str([pf.schema_arrow.field(i).name for i in range(3)]))
print(f'parquet_row_groups={pf.num_row_groups}')

with open(path_avro, 'rb') as fh:
    av = reader(fh)
    print('avro_fields=' + str([field["name"] for field in av.writer_schema["fields"]]))

print('native_formats_preserve_schema=true')
```

```text
parquet_columns=['id', '_index', 'symbol']
parquet_row_groups=1
avro_fields=['country_name', 'iso_alpha2']
native_formats_preserve_schema=true
```

Parquet exposes projected columns and row-group layout, while Avro exposes its writer schema. Those structural surfaces are the reason the native formats are operationally stronger than an early CSV or JSON downgrade.

> [!warning] Text export is a lossy downgrade
>
> CSV and ad hoc JSON exports are useful compatibility artifacts, but they do not preserve the full schema surface of Parquet or Avro.

> [!success] Export only when the receiver cannot use the native container
>
> Inspect and filter the native file first, keep it as the durable source, and generate text only for spreadsheet, shell, or API boundaries that genuinely require it.

## Warnings And Anti-Patterns

Operational mistakes in file handling are usually contract mistakes, not syntax mistakes. The checks below show the failure mode and the safe alternative with live output instead of generic advice.

### Warnings And Anti-Patterns | CSV splitting and header drift

The common failure is treating CSV as delimiter-separated plain text even after quoting and fragment headers become significant.

#### Warnings And Anti-Patterns | Python | Delimiter splitting and naive recombination corrupt CSV shape

Naive string splitting miscounts fields once a quoted delimiter appears, and naive concatenation duplicates header rows. Both errors are subtle enough to survive a quick visual skim.

*Demonstrate field-splitting failure and header duplication in a tiny CSV workflow.*

```python
import csv
from io import StringIO

csv_payload = 'symbol,comment\nABC,"alpha,beta"\n'
naive_fields = csv_payload.splitlines()[1].split(',')
parsed_fields = next(csv.reader(StringIO(csv_payload.splitlines()[1])))

parts = ['symbol,value\nA,1\n', 'symbol,value\nB,2\n']
bad = ''.join(parts)
good = parts[0] + ''.join(part.splitlines(True)[1] for part in parts[1:])

print(f'naive_split_fields={len(naive_fields)}')
print(f'csv_module_fields={len(parsed_fields)}')
print(f'bad_recombine_header_count={bad.count("symbol,value")}')
print(f'good_recombine_header_count={good.count("symbol,value")}')
```

```text
naive_split_fields=3
csv_module_fields=2
bad_recombine_header_count=2
good_recombine_header_count=1
```

The quoted comma produces an extra field for naive splitting, and the recombination example shows exactly why fragment headers have to be skipped after the canonical header is written.

> [!failure] Text splitting and raw concatenation corrupt valid CSV
>
> `split(',')`, `cut`, or unconditional `cat part*.csv` can silently change the record shape or insert schema rows into the middle of the file.

> [!success] Parse with CSV semantics and own the header explicitly
>
> Use `csv.reader`, `Import-Csv`, or another dialect-aware parser for field access, then write one canonical header and append only data rows when fragments are recombined.

### Warnings And Anti-Patterns | JSON framing and namespace-blind XML

The next class of bugs is silent structure loss: duplicate JSON keys, pseudo-documents created by repeated dumps, or XPath expressions that ignore namespaces.

#### Warnings And Anti-Patterns | Python / PowerShell | JSON duplicate keys, array round-trips, and XML namespaces can fail quietly

These failure modes do not always throw obvious errors. Some only degrade the structure, which is worse because the pipeline may continue with the wrong meaning.

*Show silent-structure failures in JSON framing and XML namespace selection.*

```python
import io
import json
from lxml import etree

buf = io.StringIO()
json.dump({'level': 'INFO'}, buf)
json.dump({'level': 'ERROR'}, buf)

framed = 'valid'
try:
    json.loads(buf.getvalue())
except json.JSONDecodeError:
    framed = 'invalid'

duplicate_value = json.loads('{"level": 1, "level": 2}')['level']
xml = etree.parse(r'C:\Users\aperi\My Drive\VAULT\data\constituents_namespaced.xml')
without_ns = len(xml.xpath('//constituent'))
with_ns = len(xml.xpath('//cst:constituent', namespaces={'cst': 'https://elysium.local/schemas/constituent/v1'}))

print(f'duplicate_key_value={duplicate_value}')
print(f'json_multi_dump_document={framed}')
print(f'xml_without_namespace={without_ns}')
print(f'xml_with_namespace={with_ns}')
```

```text
duplicate_key_value=2
json_multi_dump_document=invalid
xml_without_namespace=0
xml_with_namespace=6
```

*Show the PowerShell array-round-trip edge case that requires `-NoEnumerate`.*

```powershell
Write-Output ('with_noenumerate=' + ('[1]' | ConvertFrom-Json -NoEnumerate | ConvertTo-Json -Compress))
Write-Output ('without_noenumerate=' + ('[1]' | ConvertFrom-Json | ConvertTo-Json -Compress))
```

```text
with_noenumerate=[1]
without_noenumerate=1
```

The Python check shows that the last duplicate JSON key wins, repeated `json.dump()` calls do not create one valid JSON document, and namespace-blind XPath returns no constituent nodes. The PowerShell check shows why single-item arrays need `-NoEnumerate` if the array shape itself matters.

> [!warning] Silent structure loss is worse than an immediate parser error
>
> Duplicate keys, collapsed arrays, and namespace-blind queries can all let the workflow continue with the wrong meaning rather than stopping loudly.

> [!success] Make framing, array shape, and namespace maps explicit
>
> Keep one JSON document per file unless the contract is NDJSON, preserve array semantics with `-NoEnumerate` when needed, and bind namespace prefixes explicitly before running XPath against namespaced XML.

## Cross-References

- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) - bounded reads before deeper parsing
- [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) - literal and regex search once the file is confirmed to be text
- [sed-stream-editing](https://alp78.github.io/elysium/01-Shell/Text-Processing/sed-stream-editing) - text substitution patterns and in-place editing cautions
- [awk-data-processing](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing) - line-oriented aggregation and field logic for genuine text files
- [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) - compression strategy when the payload is text rather than a schema-aware binary container
- [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer) - moving large data files safely after local validation
- [serialization-formats](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/serialization-formats) - architectural tradeoffs between CSV, JSON, Parquet, and Avro
