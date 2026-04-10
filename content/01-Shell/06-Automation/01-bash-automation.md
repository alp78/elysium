---
title: "01 - Bash Automation for Data Engineering"
tags:
  - shell
  - automation
aliases: [bash automation, bash scripts, shell automation, data engineering bash]
keywords: [bash automation, shell scripts, CSV processing, JSON processing, API automation, database scripts, GCP automation, log parsing, cron, scheduling, retry, backoff, health check, data validation, ETL scripts, file intake, lock file, flock]
description: "28 production-ready Bash scripts for data engineering automation — file intake validation, data transformation, API interaction, database operations, GCP cloud ops, log parsing, environment pre-flight checks, and scheduling helpers."
parent: "[[domain-script-engineering]]"
links:
  - "[[02-command-history]]"
  - "[[03-io-redirection]]"
  - "[[04-command-chaining]]"
  - "[[06-process-substitution]]"
  - "[[05-brace-expansion-and-globbing]]"
  - "[[01-environment-variables]]"
  - "[[07-defensive-scripting]]"
  - "[[02-powershell-automation]]"
created: 2026-04-05
updated: 2026-04-05
status: complete
---

# Bash Automation for Data Engineering

Bash is one of the four core languages of the data engineer alongside SQL, Python, and a JVM language. These scripts automate the repetitive, error-prone tasks that sit between pipeline orchestration and raw shell commands: validating incoming files, transforming formats, querying APIs, checking database health, managing cloud resources, parsing logs, and wiring up scheduling.

Every script in this page follows the defensive scripting patterns documented in [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) and uses the command chaining operators explained in [command-chaining](https://alp78.github.io/elysium/01-Shell/Scripting/command-chaining). The PowerShell equivalent of every script exists at [powershell-automation](https://alp78.github.io/elysium/01-Shell/Automation/powershell-automation).

> [!quote]
> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
>
> — **Brian Kernighan**, *Unix for Beginners* (1979)

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#292e42','primaryTextColor': '#c0caf5','primaryBorderColor': '#565f89','lineColor': '#565f89','secondaryColor': '#1a1b26','tertiaryColor': '#24283b','noteTextColor': '#c0caf5','noteBkgColor': '#292e42','textColor': '#c0caf5','fontSize': '14px'}}}%%
flowchart LR
    A[File Intake\n& Validation] --> B[Data\nTransformation]
    B --> C[API\nInteraction]
    C --> D[Database\nOperations]
    D --> E[GCP Cloud\nOperations]
    E --> F[Log Parsing\n& Monitoring]
    F --> G[Environment\n& Pre-flight]
    G --> H[Scheduling\n& Orchestration]
    style A fill:#292e42,stroke:#7aa2f7
    style B fill:#292e42,stroke:#7aa2f7
    style C fill:#292e42,stroke:#7aa2f7
    style D fill:#292e42,stroke:#7aa2f7
    style E fill:#292e42,stroke:#9ece6a
    style F fill:#292e42,stroke:#9ece6a
    style G fill:#292e42,stroke:#9ece6a
    style H fill:#292e42,stroke:#9ece6a
```


## Key terms used in this note

| Term | Plain-English definition | Why it matters here | Common mistake / confusion |
|---|---|---|---|
| Bash script | A text file containing a sequence of bash commands executed by the bash interpreter. Starts with `#!/usr/bin/env bash`. | The standard automation language for Linux data engineering tasks: file processing, pipeline orchestration, scheduled jobs, and deployment. | Writing scripts without `set -euo pipefail`. Without strict mode, errors are silently ignored. |
| Shebang (`#!`) | The first line of a script (`#!/usr/bin/env bash`) that tells the OS which interpreter to use. | Determines whether the script runs in bash, sh, python, or another interpreter. | Using `#!/bin/bash` (hardcoded path) instead of `#!/usr/bin/env bash` (PATH-based lookup). |
| Idempotent script | A script that produces the same result whether run once or multiple times. Re-running does not create duplicates or fail on completed steps. | Production scripts must be idempotent because retries are common (network failures, timeouts, scheduler restarts). | Not checking for existing output before creating it. An idempotent `mkdir` uses `-p`; an idempotent insert checks for existing rows. |
| Exit code | The numeric value (0-255) a script returns. 0 = success; non-zero = failure. Checked by schedulers, CI/CD, and chaining operators. | Orchestrators use exit codes to determine task success. A script that fails but exits 0 causes silent pipeline corruption. | Not propagating errors. Catching an error, logging it, but exiting 0 hides the failure. |
| Parameter validation | Checking that required inputs (arguments, env vars, files) exist before the script performs any work. | Prevents running with missing configuration, which could produce corrupt output or delete wrong data. | Validating late in the script. Check all parameters in the first few lines, before any side effects. |
| Logging pattern | Writing timestamped messages to stderr so script data output on stdout remains clean for piping. | Enables debugging and audit trails. `log() { echo "[$(date)] $*" >&2; }` is the standard pattern. | Mixing log messages with data output on stdout. Downstream commands receive log noise instead of data. |

## What this note covers

- File intake, validation, and processing automation patterns
- Database interaction scripts (SQL Server via sqlcmd/bcp)
- API polling and data fetch automation
- Pipeline orchestration wrapper scripts
- Idempotent script design and error handling
- Production script template with logging, cleanup, and parameter validation

## File intake and validation

Incoming data is the single largest source of pipeline failures. A file that arrives with missing columns, null values in mandatory fields, or duplicate keys will propagate errors silently through every downstream transformation. These scripts catch problems at the gate, before any processing begins.

### Bash | CSV header validator

Compares the header row of an incoming CSV file against a golden schema file that defines the expected column names and order. If the headers do not match exactly, the script prints the diff and exits with a non-zero code, preventing the pipeline from processing a malformed file.

The golden schema file is a single line of comma-separated column names — the same format as the first row of the CSV.

```bash
#!/usr/bin/env bash
set -euo pipefail

GOLDEN_SCHEMA="${1:?Usage: $0 <schema_file> <csv_file>}"
CSV_FILE="${2:?Usage: $0 <schema_file> <csv_file>}"

expected=$(head -1 "$GOLDEN_SCHEMA")
actual=$(head -1 "$CSV_FILE")

if [[ "$expected" != "$actual" ]]; then
    echo "HEADER MISMATCH in $CSV_FILE"
    diff <(echo "$expected" | tr ',' '\n') <(echo "$actual" | tr ',' '\n')
    exit 1
fi

echo "OK — headers match schema"
```

```text
OK — headers match schema
```

### Bash | Null and empty field scanner

Scans a CSV file for rows where mandatory columns contain empty values. The script accepts a comma-separated list of column positions (1-indexed) that must not be empty. It reports every offending row number and the column that failed, making it easy to trace the problem back to the source system.

This uses `awk` field splitting — for a deeper reference on `awk` patterns, see [awk-data-processing](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing).

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <col1,col2,...>}"
MANDATORY_COLS="${2:?Comma-separated column positions (1-indexed)}"

IFS=',' read -ra COLS <<< "$MANDATORY_COLS"
header=$(head -1 "$CSV_FILE")

violations=0
awk -F',' -v cols="$MANDATORY_COLS" '
BEGIN { split(cols, c, ",") }
NR > 1 {
    for (i in c) {
        if ($c[i] == "" || $c[i] ~ /^[[:space:]]*$/) {
            printf "Row %d: column %d is empty\n", NR, c[i]
            v++
        }
    }
}
END { exit (v > 0 ? 1 : 0) }
' "$CSV_FILE"

echo "OK — no null values in mandatory columns"
```

```text
Row 14: column 3 is empty
Row 27: column 3 is empty
Row 41: column 1 is empty
```

### Bash | Duplicate key detector

Checks a CSV file for duplicate values in a specified key column. Data engineers loading into warehouses with primary key constraints need to detect duplicates before the load, not after a constraint violation crashes the job.

The script extracts the key column with `cut`, sorts it, and uses `uniq -d` to surface only the duplicated values. See [grep-and-pattern-matching](https://alp78.github.io/elysium/01-Shell/Text-Processing/grep-and-pattern-matching) for more on pattern-based filtering.

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <key_column_number>}"
KEY_COL="${2:?Column number (1-indexed)}"

dupes=$(tail -n +2 "$CSV_FILE" | cut -d',' -f"$KEY_COL" | sort | uniq -d)

if [[ -n "$dupes" ]]; then
    echo "DUPLICATE KEYS in column $KEY_COL:"
    echo "$dupes"
    count=$(echo "$dupes" | wc -l)
    echo "Total duplicated values: $count"
    exit 1
fi

echo "OK — no duplicate keys in column $KEY_COL"
```

```text
DUPLICATE KEYS in column 1:
1001
1042
Total duplicated values: 2
```

### Bash | File arrival SLA checker

Monitors a landing directory for the arrival of an expected file within a deadline. Data pipelines that depend on upstream file drops need an early alert when the file is late, rather than discovering the gap hours later when a downstream job fails.

The script checks whether any file matching a glob pattern has been modified within the last N minutes. If no matching file is found, it exits with a non-zero code and a message suitable for alerting. See [finding-files](https://alp78.github.io/elysium/01-Shell/File-Operations/finding-files) for more on `find` usage.

```bash
#!/usr/bin/env bash
set -euo pipefail

LANDING_DIR="${1:?Usage: $0 <landing_dir> <file_pattern> <max_age_minutes>}"
FILE_PATTERN="${2:?File glob pattern (e.g., 'sales_*.csv')}"
MAX_AGE="${3:?Maximum age in minutes}"

matches=$(find "$LANDING_DIR" -maxdepth 1 -name "$FILE_PATTERN" -mmin -"$MAX_AGE" -type f)

if [[ -z "$matches" ]]; then
    echo "SLA BREACH: no file matching '$FILE_PATTERN' in $LANDING_DIR within $MAX_AGE minutes"
    exit 1
fi

count=$(echo "$matches" | wc -l)
newest=$(echo "$matches" | xargs ls -t | head -1)
echo "OK — $count file(s) found, newest: $(basename "$newest")"
```

```text
OK — 1 file(s) found, newest: sales_20260405.csv
```

## Data transformation

Once a file passes validation, it often needs reshaping before it can be loaded into a target system. These scripts handle the most common format conversions and structural changes that data engineers perform daily — column selection, file splitting for parallel loads, and format conversion between CSV and JSON.

### Bash | CSV column extractor and reorderer

Selects specific columns from a CSV file and writes them in a new order. This is essential when a source system delivers 50 columns but the target table only needs 5, or when the column order must match a schema definition.

The script uses `awk` with a comma field separator. Column positions are passed as a comma-separated argument. See [awk-data-processing](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing) for comprehensive `awk` coverage.

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <col1,col2,...> <output_file>}"
COLUMNS="${2:?Comma-separated column positions (1-indexed)}"
OUTPUT="${3:?Output file path}"

awk -F',' -v cols="$COLUMNS" '
BEGIN { OFS=","; n = split(cols, c, ",") }
{
    out = ""
    for (i = 1; i <= n; i++) {
        out = (i == 1 ? $c[i] : out OFS $c[i])
    }
    print out
}
' "$CSV_FILE" > "$OUTPUT"

total=$(wc -l < "$OUTPUT")
echo "OK — wrote $total rows with $(echo "$COLUMNS" | tr ',' '\n' | wc -l) columns to $OUTPUT"
```

```text
OK — wrote 10001 rows with 5 columns to output.csv
```

### Bash | Large CSV splitter

Splits a large CSV file into smaller chunks of N rows each, preserving the header row in every chunk. This is critical for parallel loading into databases or cloud storage systems that have per-file size limits (e.g., BigQuery recommends files under 5 GB for optimal load performance).

The script strips the header, splits the body with `split`, then prepends the header to each chunk.

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <rows_per_chunk> <output_prefix>}"
CHUNK_SIZE="${2:?Rows per chunk}"
PREFIX="${3:?Output file prefix}"

header=$(head -1 "$CSV_FILE")
tail -n +2 "$CSV_FILE" | split -l "$CHUNK_SIZE" -d --additional-suffix=.csv - "${PREFIX}_"

for chunk in "${PREFIX}_"*.csv; do
    tmp=$(mktemp)
    echo "$header" > "$tmp"
    cat "$chunk" >> "$tmp"
    mv "$tmp" "$chunk"
done

count=$(ls "${PREFIX}_"*.csv | wc -l)
echo "OK — split into $count chunks of $CHUNK_SIZE rows each"
```

```text
OK — split into 10 chunks of 100000 rows each
```

### Bash | JSON to CSV flattener

Converts a JSON array of flat objects into a CSV file. Many APIs return JSON, but warehouse bulk-load tools (BigQuery `bq load`, PostgreSQL `\COPY`) expect CSV. This script uses `jq` to extract keys as the header row and values as data rows.

> [!warning] Nested objects
> This script handles flat JSON objects only. Nested objects or arrays in values will be serialized as raw JSON strings in the CSV cell, which may break downstream parsers.

> [!success] For nested JSON
> Pre-flatten with `jq '[.[] | {key: .parent.child}]'` before piping to this script, or use Python's `pandas.json_normalize()` for complex hierarchies.

```bash
#!/usr/bin/env bash
set -euo pipefail

JSON_FILE="${1:?Usage: $0 <json_file> <output_csv>}"
OUTPUT="${2:?Output CSV file path}"

jq -r '
  (.[0] | keys_unsorted) as $keys |
  ($keys | join(",")) ,
  (.[] | [ .[$keys[]] ] | map(tostring) | join(","))
' "$JSON_FILE" > "$OUTPUT"

rows=$(($(wc -l < "$OUTPUT") - 1))
cols=$(head -1 "$OUTPUT" | tr ',' '\n' | wc -l)
echo "OK — wrote $rows rows with $cols columns to $OUTPUT"
```

```text
OK — wrote 250 rows with 8 columns to output.csv
```

### Bash | CSV to NDJSON converter

Converts a CSV file to newline-delimited JSON (NDJSON), the format required by BigQuery streaming inserts and many modern data tools. Each CSV row becomes a single JSON object on its own line.

The script reads the header row to build key names, then converts each subsequent row into a JSON object using `jq`.

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <output_ndjson>}"
OUTPUT="${2:?Output NDJSON file path}"

IFS=',' read -ra HEADERS < <(head -1 "$CSV_FILE")
num_cols=${#HEADERS[@]}

tail -n +2 "$CSV_FILE" | while IFS=',' read -ra VALUES; do
    json="{"
    for ((i=0; i<num_cols; i++)); do
        [[ $i -gt 0 ]] && json+=","
        json+="\"${HEADERS[$i]}\":\"${VALUES[$i]}\""
    done
    json+="}"
    echo "$json"
done | jq -c '.' > "$OUTPUT"

rows=$(wc -l < "$OUTPUT")
echo "OK — wrote $rows NDJSON records to $OUTPUT"
```

```text
OK — wrote 10000 NDJSON records to output.ndjson
```

## API interaction

Data pipelines frequently pull data from REST APIs — financial data providers, internal microservices, SaaS platforms. These scripts handle the mechanical concerns that every API integration must address: retries with backoff, pagination, token management, and integrity verification. See [http-requests-and-apis](https://alp78.github.io/elysium/01-Shell/Networking/http-requests-and-apis) for foundational `curl` usage.

### Bash | REST GET with retry and backoff

Fetches a URL with configurable retry count and exponential backoff. Transient failures (network blips, 502/503 responses) are the norm when calling external APIs. Without retries, a single timeout kills an entire pipeline run.

The script doubles the wait time after each failure (1s → 2s → 4s → 8s) up to a configurable maximum. It exits with the HTTP status code on permanent failure.

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${1:?Usage: $0 <url> [max_retries] [output_file]}"
MAX_RETRIES="${2:-5}"
OUTPUT="${3:-/dev/stdout}"

attempt=0
delay=1

while (( attempt < MAX_RETRIES )); do
    http_code=$(curl -s -o "$OUTPUT" -w "%{http_code}" "$URL") || true

    if [[ "$http_code" =~ ^2 ]]; then
        echo "OK — HTTP $http_code after $((attempt + 1)) attempt(s)"
        exit 0
    fi

    attempt=$((attempt + 1))
    echo "Attempt $attempt/$MAX_RETRIES failed (HTTP $http_code), retrying in ${delay}s..."
    sleep "$delay"
    delay=$((delay * 2))
done

echo "FAILED — all $MAX_RETRIES attempts exhausted, last HTTP $http_code"
exit 1
```

```text
Attempt 1/5 failed (HTTP 503), retrying in 1s...
Attempt 2/5 failed (HTTP 503), retrying in 2s...
OK — HTTP 200 after 3 attempt(s)
```

### Bash | Paginated API fetcher

Collects all pages from a cursor-based or offset-based paginated API into a single output file. Most APIs limit response size to 100–1000 records per call. This script follows the pagination chain until no `next` cursor is returned, merging all results into one JSON array.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?Usage: $0 <base_url> <output_file> [cursor_field] [data_field]}"
OUTPUT="${2:?Output file path}"
CURSOR_FIELD="${3:-next_cursor}"
DATA_FIELD="${4:-data}"

cursor=""
page=0
echo "[" > "$OUTPUT"

while true; do
    page=$((page + 1))
    if [[ -n "$cursor" ]]; then
        url="${BASE_URL}?cursor=${cursor}"
    else
        url="$BASE_URL"
    fi

    response=$(curl -sf "$url")
    records=$(echo "$response" | jq -c ".${DATA_FIELD}[]")

    if [[ $page -gt 1 ]]; then
        sed -i '$ s/$/,/' "$OUTPUT"
    fi
    echo "$records" >> "$OUTPUT"

    cursor=$(echo "$response" | jq -r ".${CURSOR_FIELD} // empty")
    if [[ -z "$cursor" ]]; then
        break
    fi
    echo "Page $page fetched, next cursor: ${cursor:0:20}..."
done

echo "]" >> "$OUTPUT"
total=$(jq 'length' "$OUTPUT")
echo "OK — fetched $page page(s), $total total records to $OUTPUT"
```

```text
Page 1 fetched, next cursor: eyJsYXN0X2lkIjox...
Page 2 fetched, next cursor: eyJsYXN0X2lkIjoy...
OK — fetched 3 page(s), 287 total records to output.json
```

### Bash | Bearer token refresh wrapper

Obtains an OAuth2 bearer token using client credentials grant, caches it in a variable, and re-authenticates when the token expires or a 401 response is received. This pattern is standard for service-to-service API calls where tokens have a limited TTL (typically 3600 seconds).

```bash
#!/usr/bin/env bash
set -euo pipefail

TOKEN_URL="${1:?Usage: $0 <token_url> <client_id> <client_secret> <api_url>}"
CLIENT_ID="${2:?Client ID}"
CLIENT_SECRET="${3:?Client secret}"
API_URL="${4:?Target API URL}"

get_token() {
    response=$(curl -sf -X POST "$TOKEN_URL" \
        -d "grant_type=client_credentials" \
        -d "client_id=$CLIENT_ID" \
        -d "client_secret=$CLIENT_SECRET")
    echo "$response" | jq -r '.access_token'
}

TOKEN=$(get_token)

http_code=$(curl -s -o /tmp/api_response.json -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" "$API_URL")

if [[ "$http_code" == "401" ]]; then
    echo "Token expired, refreshing..."
    TOKEN=$(get_token)
    http_code=$(curl -s -o /tmp/api_response.json -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" "$API_URL")
fi

if [[ "$http_code" =~ ^2 ]]; then
    echo "OK — HTTP $http_code"
    cat /tmp/api_response.json
else
    echo "FAILED — HTTP $http_code"
    exit 1
fi
```

```text
Token expired, refreshing...
OK — HTTP 200
```

### Bash | Download with checksum verification

Downloads a file and verifies its SHA-256 hash against an expected value. Data integrity is non-negotiable when downloading datasets, model artifacts, or binary dependencies. A corrupted file that passes silently can produce wrong results that are far harder to detect than a failed download.

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${1:?Usage: $0 <url> <output_file> <expected_sha256>}"
OUTPUT="${2:?Output file path}"
EXPECTED_HASH="${3:?Expected SHA-256 hash}"

curl -sfL -o "$OUTPUT" "$URL"

actual_hash=$(sha256sum "$OUTPUT" | cut -d' ' -f1)

if [[ "$actual_hash" != "$EXPECTED_HASH" ]]; then
    echo "CHECKSUM MISMATCH"
    echo "Expected: $EXPECTED_HASH"
    echo "Actual:   $actual_hash"
    rm -f "$OUTPUT"
    exit 1
fi

size=$(stat --format="%s" "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT")
echo "OK — downloaded $(basename "$OUTPUT") ($size bytes), checksum verified"
```

```text
OK — downloaded dataset_v3.parquet (42917632 bytes), checksum verified
```

## Database operations

Every data pipeline eventually touches a database — loading data, exporting query results, or checking that a load completed correctly. These scripts handle the three most common database automation tasks: connectivity verification, query execution with export, and post-load reconciliation.

> [!info] Database clients
> These scripts use `psql` (PostgreSQL) as the example client. Replace with `mysql`, `sqlcmd`, or `bq` for other databases — the wrapper pattern is identical.

### Bash | Database connectivity health check

Tests whether a database is reachable and responsive by executing a trivial query and measuring the round-trip time. This is the first check in any pipeline that depends on a database — there is no point starting a multi-hour ETL job if the target is unreachable.

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${1:?Usage: $0 <host> <port> <dbname> <user>}"
DB_PORT="${2:-5432}"
DB_NAME="${3:-postgres}"
DB_USER="${4:-$USER}"

start_ms=$(date +%s%N)

result=$(psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" \
    -tAc "SELECT 1" 2>&1) || {
    echo "FAILED — cannot connect to $DB_HOST:$DB_PORT/$DB_NAME"
    echo "Error: $result"
    exit 1
}

end_ms=$(date +%s%N)
latency_ms=$(( (end_ms - start_ms) / 1000000 ))

echo "OK — connected to $DB_HOST:$DB_PORT/$DB_NAME in ${latency_ms}ms"
```

```text
OK — connected to db.example.com:5432/warehouse in 23ms
```

### Bash | Query to CSV exporter

Executes a SQL file against a database and writes the result set to a CSV file. This is the standard extraction step in any EL(T) pipeline — pull data from a source database into a portable format for transfer or transformation.

```bash
#!/usr/bin/env bash
set -euo pipefail

SQL_FILE="${1:?Usage: $0 <sql_file> <output_csv> <host> <dbname> <user>}"
OUTPUT="${2:?Output CSV file path}"
DB_HOST="${3:?Database host}"
DB_NAME="${4:?Database name}"
DB_USER="${5:-$USER}"

psql -h "$DB_HOST" -d "$DB_NAME" -U "$DB_USER" \
    --csv -f "$SQL_FILE" > "$OUTPUT"

rows=$(($(wc -l < "$OUTPUT") - 1))
cols=$(head -1 "$OUTPUT" | tr ',' '\n' | wc -l)
echo "OK — exported $rows rows with $cols columns to $OUTPUT"
```

```text
OK — exported 48231 rows with 12 columns to extract_20260405.csv
```

### Bash | Row count reconciliation

Compares the number of data rows in a source CSV file against the row count in the target database table after a load. A mismatch means rows were lost or duplicated during the load — either case is a data quality incident that must be caught immediately.

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <csv_file> <table_name> <host> <dbname> <user>}"
TABLE="${2:?Target table name}"
DB_HOST="${3:?Database host}"
DB_NAME="${4:?Database name}"
DB_USER="${5:-$USER}"

file_rows=$(($(wc -l < "$CSV_FILE") - 1))

db_rows=$(psql -h "$DB_HOST" -d "$DB_NAME" -U "$DB_USER" \
    -tAc "SELECT COUNT(*) FROM $TABLE")

if [[ "$file_rows" -ne "$db_rows" ]]; then
    echo "ROW COUNT MISMATCH"
    echo "Source file: $file_rows rows"
    echo "Target table: $db_rows rows"
    echo "Difference: $((file_rows - db_rows))"
    exit 1
fi

echo "OK — $file_rows rows in file match $db_rows rows in $TABLE"
```

```text
OK — 48231 rows in file match 48231 rows in warehouse.sales_daily
```

## GCP cloud operations

These scripts automate the most common Google Cloud Platform tasks that data engineers perform outside of orchestration tools. They use the `gcloud`, `gsutil`, and `bq` command-line tools, which work identically on Linux and macOS. The difference between Bash and PowerShell scripts for GCP is entirely in how output is parsed — the CLI commands are the same.

> [!tip] Cross-platform GCP CLI
> `gcloud`, `gsutil`, and `bq` are fully cross-platform. On Linux, pipe JSON output to `jq`. On PowerShell, pipe to `ConvertFrom-Json`. The CLI flags and behavior are identical. See [connecting-to-gcp-resources](https://alp78.github.io/elysium/01-Shell/Networking/connecting-to-gcp-resources) for authentication setup.

### Bash | GCS stale object reporter

Lists objects in a GCS bucket that are older than a specified number of days. Stale data accumulates in landing buckets when upstream systems stop cleaning up, leading to unexpected storage costs and confusion about which files are current. This script surfaces objects past their expected retention.

```bash
#!/usr/bin/env bash
set -euo pipefail

BUCKET="${1:?Usage: $0 <bucket_url> <max_age_days>}"
MAX_AGE_DAYS="${2:?Maximum age in days}"

cutoff=$(date -d "$MAX_AGE_DAYS days ago" +%s)

gsutil ls -l "$BUCKET" | grep -v "TOTAL:" | while read -r size date_str path; do
    [[ -z "$path" ]] && continue
    obj_epoch=$(date -d "$date_str" +%s 2>/dev/null) || continue
    if (( obj_epoch < cutoff )); then
        age_days=$(( ($(date +%s) - obj_epoch) / 86400 ))
        printf "%-60s %10s bytes  %d days old\n" "$path" "$size" "$age_days"
    fi
done

echo "--- Objects older than $MAX_AGE_DAYS days listed above ---"
```

```text
gs://landing-bucket/sales_20260101.csv          1048576 bytes  94 days old
gs://landing-bucket/sales_20260115.csv          2097152 bytes  80 days old
--- Objects older than 60 days listed above ---
```

### Bash | BigQuery dry-run cost estimator

Estimates the bytes that a BigQuery query will scan before actually running it. BigQuery charges per byte scanned ($6.25/TB in on-demand pricing as of 2026). Running a `--dry_run` first prevents expensive mistakes like querying a multi-terabyte table without a partition filter.

```bash
#!/usr/bin/env bash
set -euo pipefail

SQL_FILE="${1:?Usage: $0 <sql_file> [project_id]}"
PROJECT="${2:-$(gcloud config get-value project)}"

bytes=$(bq query --project_id="$PROJECT" \
    --use_legacy_sql=false \
    --dry_run \
    --format=json \
    < "$SQL_FILE" | jq -r '.statistics.totalBytesProcessed')

gb=$(echo "scale=2; $bytes / 1073741824" | bc)
cost=$(echo "scale=4; $gb * 6.25 / 1024" | bc)

echo "Query: $(basename "$SQL_FILE")"
echo "Bytes to scan: $bytes ($gb GB)"
echo "Estimated cost: \$$cost (on-demand pricing)"
```

```text
Query: monthly_aggregation.sql
Bytes to scan: 5368709120 (5.00 GB)
Estimated cost: $0.0305 (on-demand pricing)
```

### Bash | Pub/Sub backlog monitor

Checks the number of undelivered messages across one or more Pub/Sub subscriptions and alerts if any exceed a threshold. A growing backlog means consumers are falling behind — this is often the first sign of a processing bottleneck or a crashed subscriber.

```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD="${1:?Usage: $0 <threshold> <subscription1> [subscription2 ...]}"
shift
SUBSCRIPTIONS=("$@")

exit_code=0

for sub in "${SUBSCRIPTIONS[@]}"; do
    backlog=$(gcloud pubsub subscriptions describe "$sub" \
        --format="value(numUndeliveredMessages)" 2>/dev/null || echo "N/A")

    if [[ "$backlog" == "N/A" ]]; then
        echo "WARN — subscription $sub not found"
        continue
    fi

    if (( backlog > THRESHOLD )); then
        echo "ALERT — $sub: $backlog undelivered messages (threshold: $THRESHOLD)"
        exit_code=1
    else
        echo "OK — $sub: $backlog undelivered messages"
    fi
done

exit "$exit_code"
```

```text
OK — orders-sub: 12 undelivered messages
ALERT — events-sub: 8542 undelivered messages (threshold: 1000)
OK — logs-sub: 0 undelivered messages
```

### Bash | Service account key age checker

Lists all keys for a service account and flags any that are older than a specified number of days (default: 90). Google recommends rotating service account keys every 90 days. Forgotten keys are a security risk — this script provides the visibility that manual key management lacks.

```bash
#!/usr/bin/env bash
set -euo pipefail

SA_EMAIL="${1:?Usage: $0 <service_account_email> [max_age_days]}"
MAX_AGE="${2:-90}"

cutoff=$(date -d "$MAX_AGE days ago" +%Y-%m-%dT%H:%M:%SZ)

gcloud iam service-accounts keys list \
    --iam-account="$SA_EMAIL" \
    --format=json | jq -r --arg cutoff "$cutoff" '
    .[] |
    select(.keyType == "USER_MANAGED") |
    select(.validAfterTime < $cutoff) |
    "ROTATE — key \(.keyId[0:12])... created \(.validAfterTime)"
'

gcloud iam service-accounts keys list \
    --iam-account="$SA_EMAIL" \
    --format=json | jq -r --arg cutoff "$cutoff" '
    .[] |
    select(.keyType == "USER_MANAGED") |
    select(.validAfterTime >= $cutoff) |
    "OK — key \(.keyId[0:12])... created \(.validAfterTime)"
'
```

```text
ROTATE — key a1b2c3d4e5f6... created 2025-12-01T10:30:00Z
OK — key f6e5d4c3b2a1... created 2026-03-15T14:22:00Z
```

## Log parsing and monitoring

Pipeline logs contain the earliest signal of problems — error spikes, latency changes, and unexpected patterns. These scripts extract actionable information from log files without requiring a full observability stack, making them suitable for lightweight monitoring, ad-hoc investigation, and environments where Grafana or Datadog are not yet deployed.

### Bash | Error rate calculator

Counts occurrences of each log level (ERROR, WARN, INFO) in a log file and reports percentages. An error rate above 5% is typically cause for investigation; above 10% indicates a systemic problem. This script provides the quick triage numbers that determine whether to escalate.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:?Usage: $0 <log_file>}"

total=$(wc -l < "$LOG_FILE")
errors=$(grep -c "ERROR" "$LOG_FILE" || true)
warns=$(grep -c "WARN" "$LOG_FILE" || true)
infos=$(grep -c "INFO" "$LOG_FILE" || true)

echo "Log: $(basename "$LOG_FILE") ($total lines)"
echo "---"
printf "ERROR: %d (%.1f%%)\n" "$errors" "$(echo "scale=1; $errors * 100 / $total" | bc)"
printf "WARN:  %d (%.1f%%)\n" "$warns" "$(echo "scale=1; $warns * 100 / $total" | bc)"
printf "INFO:  %d (%.1f%%)\n" "$infos" "$(echo "scale=1; $infos * 100 / $total" | bc)"

error_pct=$(echo "scale=1; $errors * 100 / $total" | bc)
if (( $(echo "$error_pct > 5" | bc -l) )); then
    echo "--- ALERT: error rate ${error_pct}% exceeds 5% threshold ---"
    exit 1
fi
```

```text
Log: pipeline.log (14832 lines)
---
ERROR: 247 (1.6%)
WARN:  1891 (12.7%)
INFO:  12694 (85.5%)
```

### Bash | Structured JSON log filter

Extracts log entries from an NDJSON (newline-delimited JSON) log file that match a specified severity level and fall within a time window. Modern applications emit structured logs in JSON format. Filtering these with `grep` loses the structure — `jq` preserves it and enables precise time-range queries.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:?Usage: $0 <ndjson_log> <level> <start_time> <end_time>}"
LEVEL="${2:?Log level (ERROR, WARN, INFO)}"
START="${3:?Start time (ISO 8601)}"
END="${4:?End time (ISO 8601)}"

jq -c --arg level "$LEVEL" --arg start "$START" --arg end "$END" '
    select(
        .level == $level and
        .timestamp >= $start and
        .timestamp <= $end
    )
' "$LOG_FILE" | while read -r line; do
    echo "$line" | jq '.'
done

count=$(jq -c --arg level "$LEVEL" --arg start "$START" --arg end "$END" '
    select(.level == $level and .timestamp >= $start and .timestamp <= $end)
' "$LOG_FILE" | wc -l)

echo "--- $count $LEVEL entries between $START and $END ---"
```

```text
{
  "timestamp": "2026-04-05T03:12:44Z",
  "level": "ERROR",
  "message": "Connection pool exhausted",
  "service": "ingest-worker"
}
--- 3 ERROR entries between 2026-04-05T03:00:00Z and 2026-04-05T04:00:00Z ---
```

### Bash | Log rotation and compression

Compresses log files older than N days and deletes those older than M days. Without rotation, log directories grow unbounded until they fill the disk and crash the application. This script implements the two-stage lifecycle (compress → delete) that `logrotate` handles on managed systems, but works anywhere without configuration files.

See [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) for detailed coverage of `gzip` options.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${1:?Usage: $0 <log_dir> <compress_after_days> <delete_after_days>}"
COMPRESS_DAYS="${2:?Compress logs older than N days}"
DELETE_DAYS="${3:?Delete logs older than M days}"

if (( DELETE_DAYS <= COMPRESS_DAYS )); then
    echo "ERROR: delete_after_days ($DELETE_DAYS) must be greater than compress_after_days ($COMPRESS_DAYS)"
    exit 1
fi

compressed=0
deleted=0

while IFS= read -r -d '' file; do
    gzip "$file"
    compressed=$((compressed + 1))
done < <(find "$LOG_DIR" -name "*.log" -mtime +"$COMPRESS_DAYS" -type f -print0)

while IFS= read -r -d '' file; do
    rm -f "$file"
    deleted=$((deleted + 1))
done < <(find "$LOG_DIR" -name "*.log.gz" -mtime +"$DELETE_DAYS" -type f -print0)

echo "OK — compressed $compressed log(s), deleted $deleted archive(s)"
```

```text
OK — compressed 14 log(s), deleted 7 archive(s)
```

## Environment and pre-flight checks

These scripts run before a pipeline starts to verify that the execution environment is correctly configured. A missing CLI tool, an unset credential, or a full disk will cause a pipeline to fail partway through, leaving partial state that is harder to clean up than a clean abort at the start.

### Bash | Dependency checker

Verifies that all required command-line tools are installed and available on `$PATH` before a pipeline runs. This prevents the frustrating scenario where a job runs for 30 minutes before failing because `jq` is not installed on the new build agent.

```bash
#!/usr/bin/env bash
set -euo pipefail

REQUIRED_TOOLS=(gcloud gsutil bq jq curl psql python3)

missing=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &>/dev/null; then
        missing+=("$tool")
    fi
done

if (( ${#missing[@]} > 0 )); then
    echo "MISSING DEPENDENCIES:"
    printf "  - %s\n" "${missing[@]}"
    exit 1
fi

echo "OK — all ${#REQUIRED_TOOLS[@]} required tools are available"
```

```text
OK — all 8 required tools are available
```

### Bash | Dotenv file loader

Parses a `.env` file and exports each key-value pair as an environment variable, skipping comments and blank lines. Environment variables are the standard way to pass configuration to scripts and containers without hardcoding secrets. This loader makes `.env` files usable outside of Docker Compose.

> [!danger] Secrets in `.env` files
> Never commit `.env` files to version control. Add `.env` to `.gitignore` and use a secrets manager (GCP Secret Manager, HashiCorp Vault) for production credentials.

> [!success] Safe secret injection
> Use `gcloud secrets versions access latest --secret=MY_SECRET` to inject secrets at runtime instead of storing them in files.

```bash
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: $ENV_FILE not found"
    exit 1
fi

count=0
while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    export "$key=$value"
    count=$((count + 1))
done < "$ENV_FILE"

echo "OK — loaded $count variable(s) from $ENV_FILE"
```

```text
OK — loaded 7 variable(s) from .env
```

### Bash | Disk space pre-flight

Checks all mounted filesystems and aborts if any exceed a usage threshold (default: 80%). A full disk during a pipeline run causes silent data corruption, truncated files, and database crashes. This check takes milliseconds and prevents hours of recovery.

```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD="${1:-80}"

breached=0

df -h --output=pcent,target | tail -n +2 | while read -r usage mount; do
    pct="${usage%\%}"
    pct="${pct// /}"
    if (( pct > THRESHOLD )); then
        echo "ALERT — $mount is ${pct}% full (threshold: ${THRESHOLD}%)"
        breached=1
    fi
done

if (( breached )); then
    exit 1
fi

echo "OK — all filesystems below ${THRESHOLD}% usage"
```

```text
OK — all filesystems below 80% usage
```

## Scheduling and orchestration helpers

These scripts solve the glue problems around job scheduling: preventing overlapping runs, retrying flaky commands, and alerting on outcomes. They complement orchestrators like Airflow (see [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns)) by handling concerns that cron and Task Scheduler do not address natively.

### Bash | Lock file wrapper

Prevents overlapping executions of the same job by acquiring an exclusive file lock before running the command. Without this, a cron job that takes longer than its interval will spawn a second instance, leading to duplicate data, race conditions, or resource exhaustion.

The script uses `flock` (part of `util-linux`) which is atomic and safe for concurrent access.

```bash
#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="${1:?Usage: $0 <lock_file> <command> [args...]}"
shift
COMMAND=("$@")

exec 200>"$LOCK_FILE"

if ! flock -n 200; then
    echo "SKIPPED — another instance is already running (lock: $LOCK_FILE)"
    exit 0
fi

echo "Lock acquired, running: ${COMMAND[*]}"
"${COMMAND[@]}"
status=$?

echo "OK — command completed with exit code $status"
exit "$status"
```

```text
Lock acquired, running: /opt/pipeline/daily_load.sh
OK — command completed with exit code 0
```

### Bash | Generic retry wrapper

Wraps any command with configurable retry count and exponential backoff. This is a reusable building block for any operation that may fail transiently — database connections, API calls, file transfers. The backoff prevents hammering a recovering service.

```bash
#!/usr/bin/env bash
set -euo pipefail

MAX_RETRIES="${1:?Usage: $0 <max_retries> <command> [args...]}"
shift
COMMAND=("$@")

attempt=0
delay=1

while (( attempt < MAX_RETRIES )); do
    if "${COMMAND[@]}"; then
        echo "OK — succeeded on attempt $((attempt + 1))"
        exit 0
    fi

    attempt=$((attempt + 1))
    echo "Attempt $attempt/$MAX_RETRIES failed, retrying in ${delay}s..."
    sleep "$delay"
    delay=$((delay * 2))
done

echo "FAILED — all $MAX_RETRIES attempts exhausted"
exit 1
```

```text
Attempt 1/3 failed, retrying in 1s...
Attempt 2/3 failed, retrying in 2s...
OK — succeeded on attempt 3
```

### Bash | Run and alert pattern

Executes a command and sends a notification to a Slack webhook (or any HTTP endpoint) with the outcome — success or failure. This is the simplest possible alerting layer for cron jobs that run unattended. Without it, a nightly job can fail silently for days before anyone notices.

The script captures both the exit code and the last N lines of output for the notification payload.

```bash
#!/usr/bin/env bash
set -uo pipefail

WEBHOOK_URL="${1:?Usage: $0 <webhook_url> <job_name> <command> [args...]}"
JOB_NAME="${2:?Job name for the notification}"
shift 2
COMMAND=("$@")

LOGFILE=$(mktemp)

"${COMMAND[@]}" > "$LOGFILE" 2>&1
EXIT_CODE=$?

TAIL_OUTPUT=$(tail -5 "$LOGFILE")

if (( EXIT_CODE == 0 )); then
    STATUS="SUCCESS"
    COLOR="#36a64f"
else
    STATUS="FAILURE"
    COLOR="#ff0000"
fi

PAYLOAD=$(jq -n \
    --arg status "$STATUS" \
    --arg job "$JOB_NAME" \
    --arg output "$TAIL_OUTPUT" \
    --arg color "$COLOR" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
        attachments: [{
            color: $color,
            title: ($job + " — " + $status),
            text: $output,
            footer: ("Completed at " + $ts)
        }]
    }')

curl -sf -X POST -H "Content-Type: application/json" \
    -d "$PAYLOAD" "$WEBHOOK_URL" || echo "WARN — webhook notification failed"

rm -f "$LOGFILE"

echo "$STATUS — $JOB_NAME exited with code $EXIT_CODE"
exit "$EXIT_CODE"
```

```text
SUCCESS — daily_etl exited with code 0
```


## When to use bash automation

- **File intake and validation** -- checking for expected files, validating row counts, detecting encoding issues before processing.
- **Database operations** -- wrapping sqlcmd/bcp calls with error checking, retry logic, and logging for scheduled ETL.
- **Deployment scripts** -- git pull, build, test, restart sequences that must fail fast on any error.
- **Scheduled data processing** -- cron or Airflow BashOperator tasks that run daily data quality checks or report generation.
- **Glue scripts** -- short scripts coordinating between tools (download from API, transform with awk, upload to GCS).

## When not to use bash automation

- **Complex business logic** -- if the script needs data structures, error handling with retries, or API pagination, use Python or C#.
- **Cross-platform scripts** -- bash is Linux-only. For Windows+Linux, use PowerShell 7 or Python.
- **Scripts longer than 200 lines** -- long bash scripts become unmaintainable. Refactor into a proper programming language.
- **Anything handling JSON/XML** -- bash has no native structured data support. Use Python with `json`/`xml` modules or `jq`.

## Warnings

> [!danger] Scripts without `set -euo pipefail` silently ignore errors
>
> A failed command in the middle of a script does not stop execution. Subsequent commands run on corrupted or missing input. Every production script must start with `set -euo pipefail`.

> [!warning] Logging to stdout contaminates pipeline data
>
> If a script writes both log messages and data to stdout, downstream commands receive mixed content. Write logs to stderr: `echo "[INFO] message" >&2`.

> [!warning] Non-idempotent scripts fail on retry
>
> A script that creates a file without checking if it already exists fails on the second run. All production scripts must be idempotent.

## Recommendations

| Scenario | Recommendation |
|---|---|
| Script header | `#!/usr/bin/env bash` followed by `set -euo pipefail`. |
| Logging | `log() { echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $*" >&2; }` |
| Parameter validation | `DB_HOST="${DB_HOST:?ERROR: DB_HOST must be set}"` |
| Cleanup | `trap cleanup EXIT` to guarantee temp file removal. |
| File existence checks | `[[ -f "$input_file" ]] || { log "Input missing"; exit 1; }` |
| Idempotent output | `[[ -f "$output" ]] && { log "Exists, skipping"; exit 0; }` |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Script succeeds in terminal but fails in cron/Airflow | Missing environment variables. Cron does not source .bashrc. | Define variables in the cron/Airflow environment, or source the profile at script start. |
| Script fails silently with no error | `set -e` not enabled. Errors ignored and execution continues. | Add `set -euo pipefail` at the top. |
| Log messages appear in output data | Logging to stdout instead of stderr. | Redirect log functions to stderr: `>&2`. |
| Script fails on second run | Non-idempotent operations (file exists, row already inserted). | Add existence checks and skip-if-done logic. |
| "unbound variable" on optional parameter | `set -u` is active and the variable is not set. | Use `${VAR:-default}` for optional variables. |
