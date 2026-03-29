---
type: reference
category: shell
technology: [bash, powershell, sed]
tags: [shell, bash, linux, powershell]
aliases: [sed, stream editor, find and replace, text substitution, in-place editing, -i flag]
keywords:
  - sed
  - stream editor
  - text substitution
  - find and replace
  - regex replace
  - in-place editing
  - -i flag
  - bash text processing
  - PowerShell replace
  - line deletion
  - pattern matching
  - capture groups
  - back-references
  - global substitution
  - address range
  - POSIX sed
  - GNU sed
  - extended regex
  - ETL text transformation
  - log file processing
  - CSV manipulation
  - BOM removal
  - ANSI strip
  - CRLF to LF
description: "Exhaustive reference for sed (stream editor) covering substitution, deletion, insertion, addressing, regex capture groups, and in-place file editing — with PowerShell equivalents for every command. Includes data engineering scenarios such as CSV header fixes, BOM removal, CRLF conversion, SQL migration edits, PII sanitisation, and ANSI colour stripping."
related:
  - "[[reading-file-contents]]"
  - "[[awk-data-processing]]"
  - "[[grep-and-pattern-matching]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# sed — Stream Editor Reference

`sed` (stream editor) is a non-interactive, line-oriented text transformation tool. It processes input one line at a time, applies a sequence of editing commands, and writes results to standard output. Used by data engineers daily for log cleaning, SQL migration file edits, CSV header fixes, config file patching, and bulk in-place file edits across entire codebases.

> [!info] Scope of This Note
> This note covers GNU sed (Linux default) and BSD sed (macOS default), with explicit callouts where behaviour differs. PowerShell equivalents are provided for every major command pattern so Windows-native pipelines are fully covered.

---

## How sed Works

### Stream Processing Model

sed operates on a cycle: for each line of input, it executes this sequence:

```
Read one line into pattern space
↓
Apply all commands that match (address + command)
↓
Print pattern space to stdout (unless -n suppresses it)
↓
Clear pattern space
↓
Repeat for next line
```

#### sed pattern space vs hold space

| Space | Purpose |
|---|---|
| Pattern space | The current line being processed — this is where substitutions happen |
| Hold space | A persistent scratch buffer that survives across lines (advanced use) |

#### sed invocation forms — command-line, file, stdin

```bash
# Command-line expression
sed 'command' file

# Multiple expressions
sed -e 'command1' -e 'command2' file

# Read commands from a script file
sed -f script.sed file

# Suppress default output (print only what you explicitly p-rint)
sed -n 'command' file

# In-place edit (GNU sed)
sed -i 'command' file

# In-place edit with backup (GNU sed)
sed -i.bak 'command' file
```

### Address Types

Every sed command can be preceded by an address that controls which lines it applies to. Without an address, the command applies to every line.

| Address form | Meaning |
|---|---|
| `5` | Line 5 only |
| `$` | Last line |
| `1~2` | Every odd line (GNU sed only) |
| `0~2` | Every even line (GNU sed only) |
| `/pattern/` | Every line matching the regex |
| `5,10` | Lines 5 through 10 inclusive |
| `/start/,/end/` | From first match of `start` to next match of `end` |
| `5,/pattern/` | From line 5 to the first line matching pattern |
| `addr!` | Negate — every line NOT matching addr |

> [!tip] Zero Address
> GNU sed supports address `0` in range `0,/pattern/` so the range can match from the very first line, even if it matches the opening pattern.

---

## Basic Substitution

The substitution command `s` is the most used sed command:

```
s/pattern/replacement/flags
```

**Pattern** is a POSIX Basic Regular Expression (BRE) by default; `sed -E` enables Extended Regular Expression (ERE).
**Replacement** is literal text plus special sequences: `&` (entire match), `\1`–`\9` (capture groups), `\n` (newline in GNU sed).
**Flags** modify behaviour.

### Substitution Flags

| Flag | Meaning |
|---|---|
| `g` | Global — replace all occurrences on the line (default: first only) |
| `i` or `I` | Case-insensitive match (GNU sed only) |
| `N` (integer) | Replace only the Nth occurrence |
| `p` | Print the line if a substitution was made |
| `w file` | Write the line to file if a substitution was made |

### First Occurrence Per Line (Default)

```bash
# Replace the first occurrence of 'ERROR' with 'WARN' on each line
sed 's/ERROR/WARN/' application.log

# Replace only the first occurrence of a delimiter in a CSV
sed 's/,/|/' data.csv
```

### Global Replacement

```bash
# Replace ALL occurrences on each line — the flag you almost always want
sed 's/old_schema/new_schema/g' migration.sql

# Replace all tabs with four spaces
sed 's/\t/    /g' messy.py

# Remove all double quotes from a CSV field
sed 's/"//g' quoted.csv
```

### Case-Insensitive Global Replacement

```bash
# Match 'error', 'ERROR', 'Error', 'ErRoR' — all replaced (GNU sed)
sed 's/error/WARN/gi' application.log

# Case-insensitive match for config key regardless of casing
sed 's/db_host/DB_HOST/gi' legacy.conf
```

### Replace the Nth Occurrence Only

```bash
# Replace only the second comma on each line (e.g., to split a 3-column CSV at column 2)
sed 's/,/|/2' three-col.csv

# Replace only the third occurrence
sed 's/foo/bar/3' input.txt
```

### Alternative Delimiters

When the pattern or replacement contains forward slashes (common in file paths, URLs, schema names), swap the `/` delimiter for any other character to avoid escaping.

```bash
# BAD: lots of backslash noise
sed 's/\/var\/log\/old/\/var\/log\/new/g' paths.conf

# GOOD: use | as delimiter — identical behaviour
sed 's|/var/log/old|/var/log/new|g' paths.conf

# Using # as delimiter (common for SQL paths and URLs)
sed 's#https://old.example.com#https://new.example.com#g' bookmarks.sql

# Using @ for file paths on systems where | conflicts with shell
sed 's@/data/raw@/data/processed@g' pipeline.sh
```

> [!tip] Any Byte Can Be a Delimiter
> sed accepts any byte after `s` as the delimiter. Conventionally `|`, `#`, `@`, `,`, and `!` are used when the pattern contains `/`. Pick one that never appears in your pattern or replacement.

---

## In-Place Editing

By default sed writes to stdout and leaves the source file untouched. The `-i` flag edits the file in place.

> [!warning] GNU sed vs BSD sed (macOS) Difference
> **GNU sed (Linux):** `sed -i 's/old/new/g' file` — the suffix for the backup is optional. Omitting it means no backup is made.
> **BSD sed (macOS):** `sed -i '' 's/old/new/g' file` — the suffix argument is mandatory; pass an empty string `''` for no backup. Omitting the `''` causes a syntax error.
> Use `sed -i.bak` when you need behaviour identical on both platforms.

### Edit File Directly (Linux/GNU sed)

```bash
# Edit in place with no backup — be certain before running
sed -i 's/localhost/prod-db-host/g' application.properties

# Multiple expressions in one in-place pass
sed -i -e 's/old_schema/new_schema/g' -e 's/old_owner/new_owner/g' schema.sql
```

### Edit File Directly (macOS/BSD sed)

```bash
# The empty string '' is mandatory on macOS
sed -i '' 's/localhost/prod-db-host/g' application.properties

# Multiple expressions on macOS
sed -i '' -e 's/old_schema/new_schema/g' -e 's/old_owner/new_owner/g' schema.sql
```

### Create Backup Before Editing

```bash
# Creates file.bak before modifying file
sed -i.bak 's/old/new/g' config.yaml

# Works identically on GNU and BSD sed
sed -i.bak 's/localhost/10.0.0.1/g' database.conf

# After verifying, remove backups
rm *.bak
```

### Edit Multiple Files in a Single Pass

```bash
# Apply the same substitution to every Python file in current directory
sed -i 's/import old_module/import new_module/g' *.py

# Recursively edit all SQL files (requires find + xargs, or GNU sed with find)
find . -name '*.sql' -print0 | xargs -0 sed -i 's/dbo\./schema_name\./g'

# Edit all YAML config files under a directory tree
find ./config -name '*.yaml' -print0 | xargs -0 sed -i 's/v1\.0/v2\.0/g'

# GNU sed can take multiple file arguments directly — all edited in place
sed -i 's/DEBUG/INFO/g' service-a.log service-b.log service-c.log
```

> [!warning] No Undo for In-Place Edits
> `sed -i` modifies files immediately. Always test with `sed 's/old/new/g' file | head` before committing to `-i`. Use `-i.bak` for safety on large or critical files.

---

## Line Selection and Addressing

### By Specific Line Number

```bash
# Substitute only on line 1 (e.g., fix a CSV header without touching data rows)
sed '1s/timestamp/event_time/' events.csv

# Substitute only on the last line
sed '$s/old/new/' file.txt

# Substitute on lines 10 through 20
sed '10,20s/old/new/g' large_file.txt
```

### By Pattern Match

```bash
# Apply substitution only to lines containing the word ERROR
sed '/ERROR/s/localhost/prod-host/g' app.log

# Apply substitution only to lines containing a SQL SELECT statement
sed '/^SELECT/s/dbo\./reporting\./g' queries.sql

# Delete all lines that match a pattern
sed '/^#/d' config.conf          # Remove comment lines
sed '/^$/d' data.csv             # Remove blank lines
sed '/^[[:space:]]*$/d' data.txt # Remove lines with only whitespace
```

### By Pattern Range

```bash
# Apply command from the line matching START through the line matching END (inclusive)
sed '/BEGIN TRANSACTION/,/COMMIT/s/old_table/new_table/g' migration.sql

# Delete everything between (and including) the marker lines
sed '/<!-- START REMOVE -->/,/<!-- END REMOVE -->/d' template.html

# Strip the header block from a file (lines 1 through the first blank line)
sed '1,/^$/d' report.txt
```

### Negation (Operate on Non-Matching Lines)

```bash
# Delete all lines that do NOT contain 'ERROR' or 'WARN' (keep only those two)
sed '/ERROR|WARN/!d' app.log

# Suppress blank lines (print only non-blank lines)
sed '/^$/d' file.txt

# Apply substitution to every line EXCEPT the header (line 1)
sed '1!s/,/|/g' data.csv

# Apply substitution to every line that does NOT start with #
sed '/^#/!s/old/new/g' config.file
```

### Step Addressing (GNU sed Only)

```bash
# Every 2nd line starting from line 1 (odd lines): 1, 3, 5, ...
sed -n '1~2p' file.txt

# Every 2nd line starting from line 2 (even lines): 2, 4, 6, ...
sed -n '2~2p' file.txt

# Every 5th line
sed -n '0~5p' file.txt

# Process only even data rows in a CSV (skip odd rows)
sed -n '1p; 0~2p' data.csv    # Keep header (line 1) + all even lines
```

---

## Deletion, Insertion, and Append

### Delete Lines

```bash
# Delete lines matching a pattern
sed '/^DEBUG/d' verbose.log

# Delete a range of lines by number
sed '1,5d' file.txt           # Delete first 5 lines (skip a header block)

# Delete the last line
sed '$d' file.txt

# Delete all blank lines
sed '/^$/d' file.txt

# Delete trailing whitespace (not the line, just the whitespace at line end)
sed 's/[[:space:]]*$//' file.txt

# Delete lines that contain only whitespace
sed '/^[[:space:]]*$/d' file.txt

# Delete lines between two patterns (inclusive)
sed '/^---BEGIN---/,/^---END---/d' report.md
```

### Insert Before a Line

```bash
# Insert a new line BEFORE line 3
sed '3i\This is inserted before line 3' file.txt

# Insert before the first line matching a pattern
sed '/^CREATE TABLE/i\-- Migration: run as data_owner' schema.sql

# Insert a blank line before every section header
sed '/^## /i\\' document.md
```

### Append After a Line

```bash
# Append a new line AFTER line 3
sed '3a\This is appended after line 3' file.txt

# Append after the last line
sed '$a\-- End of migration script' migration.sql

# Append after every line matching a pattern
sed '/^COMMIT/a\-- Transaction complete' script.sql
```

### Replace an Entire Line

```bash
# Replace the entire content of any line matching a pattern
sed '/^DB_HOST=.*/c\DB_HOST=prod-db.internal' .env

# Replace line 1 entirely (e.g., rewrite a shebang)
sed '1c\#!/usr/bin/env python3' old_script.py

# Replace the last line
sed '$c\-- generated by migration tool' migration.sql
```

---

## Advanced Substitution with Regex

### Capture Groups and Back-References (BRE — Default)

In basic regex mode (default, no `-E`), group with `\(` and `\)` and back-reference with `\1`, `\2`.

```bash
# Swap the key and value around an equals sign
# Input:  name=Alice
# Output: Alice=name
sed 's/\(.*\)=\(.*\)/\2=\1/' keyvalue.txt

# Reformat a date from YYYY-MM-DD to DD/MM/YYYY
# Input:  2024-03-15
# Output: 15/03/2024
sed 's/\([0-9]\{4\}\)-\([0-9]\{2\}\)-\([0-9]\{2\}\)/\3\/\2\/\1/' dates.txt

# Extract the value from a key=value line and wrap it in quotes
# Input:  DB_NAME=analytics
# Output: DB_NAME="analytics"
sed 's/\(DB_NAME=\)\(.*\)/\1"\2"/' config.env

# Prefix every captured SQL table name with a schema
# Input:  FROM orders WHERE
# Output: FROM dw.orders WHERE
sed 's/FROM \([a-z_]*\)/FROM dw.\1/g' query.sql
```

### Extended Regex (ERE) with -E

With `sed -E`, use `(` and `)` without backslashes, and gain `+`, `?`, `|`, `{n,m}`.

```bash
# Using alternation: replace either 'foo' or 'bar' with 'baz'
sed -E 's/(foo|bar)/baz/g' input.txt

# Match one or more digits (+ requires -E)
sed -E 's/[0-9]+/NUM/g' log.txt

# Optional character (? requires -E)
sed -E 's/colou?r/color/g' british.txt    # Matches 'colour' and 'color'

# Named groups are NOT supported by sed; use positional \1, \2
# Capture the first word and repeat it
sed -E 's/^([a-z]+).*/\1 \1/' file.txt

# Reformat log lines: extract level and message
# Input:  [2024-03-15 12:00:00] [ERROR] Something failed
# Output: ERROR: Something failed
sed -E 's/^\[[^]]+\] \[([A-Z]+)\] (.*)/\1: \2/' app.log
```

### The & Special Replacement Token

`&` in the replacement string stands for the entire matched text. Use it to wrap matches without restating the pattern.

```bash
# Wrap every number in the line with square brackets
sed 's/[0-9]\+/[&]/g' numbers.txt

# Quote every word that starts with uppercase (BRE)
sed 's/[A-Z][a-z]*/\"&\"/g' proper_nouns.txt

# Surround each comma-separated value with single quotes
sed "s/[^,]*/'&'/g" flat.csv

# Add parentheses around a matched IP address
sed -E 's/([0-9]{1,3}\.){3}[0-9]{1,3}/(&)/g' access.log
```

---

## Print, Quiet Mode, and Line Extraction

```bash
# -n suppresses default output; p explicitly prints matched lines (like grep)
sed -n '/ERROR/p' app.log

# Print only line 5
sed -n '5p' file.txt

# Print lines 5 through 10
sed -n '5,10p' file.txt

# Print from pattern to end of file
sed -n '/START SECTION/,$p' report.txt

# Print lines between two patterns (inclusive)
sed -n '/BEGIN/,/END/p' script.sql

# Extract a value from key=value (like grep + cut in one command)
# Input: DB_HOST=prod-db.internal
# Output: prod-db.internal
sed -n 's/^DB_HOST=//p' .env

# Print line numbers alongside lines (with = command)
sed -n '/ERROR/{=; p}' app.log    # Prints line number, then the line
```

> [!tip] sed as a grep Replacement
> `sed -n '/pattern/p'` is equivalent to `grep 'pattern'`. The advantage is that you can chain it with substitutions in the same pass — e.g., find lines matching a pattern AND transform them simultaneously.

---

## Multi-Command and Script Files

### Multiple -e Expressions

```bash
# Chain two substitutions in one sed call (single pass through the file)
sed -e 's/\r$//' -e 's/[[:space:]]*$//' windows_file.txt

# Three operations: fix schema, fix owner, add comment header
sed -e 's/dbo\./reporting\./g' \
    -e 's/sa/data_owner/g' \
    -e '1i\-- Patched by migration script' \
    schema.sql

# Remove comments and blank lines from a config in one pass
sed -e '/^#/d' -e '/^$/d' application.conf
```

### sed Script Files

For complex or reusable transformations, write commands in a `.sed` file.

```sed
# normalize-log.sed
# Remove ANSI escape codes
s/\x1b\[[0-9;]*m//g
# Convert CRLF to LF
s/\r$//
# Normalise log level labels
s/\[INFORMATION\]/[INFO]/g
s/\[WARNING\]/[WARN]/g
# Strip trailing whitespace
s/[[:space:]]*$//
# Delete debug lines
/\[DEBUG\]/d
```

```bash
# Apply the script file
sed -f normalize-log.sed raw.log > clean.log

# Apply in-place
sed -i -f normalize-log.sed raw.log
```

### Combining Addresses and Commands with Braces

```bash
# Apply multiple commands only to lines matching a pattern
sed '/ERROR/ {
  s/old_host/new_host/g
  s/port 5432/port 5433/g
}' app.log

# Within a line range, apply multiple transformations
sed '/BEGIN_BLOCK/,/END_BLOCK/ {
  /^#/d
  s/old/new/g
}' mixed.conf
```

---

## Hold Space — Advanced Multi-Line Operations

The hold space lets sed carry information across line boundaries.

| Command | Action |
|---|---|
| `h` | Copy pattern space to hold space (overwrite) |
| `H` | Append pattern space to hold space |
| `g` | Copy hold space to pattern space (overwrite) |
| `G` | Append hold space to pattern space |
| `x` | Exchange pattern space and hold space |

```bash
# Reverse the order of two consecutive lines:
# When we see line N, hold it; print line N+1 first, then line N
sed -n 'h; n; p; g; p' pairs.txt

# Delete duplicate consecutive lines (keep first occurrence)
sed '$!N; /^\(.*\)\n\1$/!P; D' file.txt

# Join every pair of lines with a comma
sed 'N; s/\n/,/' pairs.txt

# Append a blank line after every 5th line (for visual grouping)
sed '5~5G' long_file.txt      # GNU sed only
```

> [!info] Hold Space Is an Advanced Feature
> Most day-to-day sed work never touches the hold space. It becomes useful for multi-line context operations where awk or Python would be cleaner. If a hold-space solution is hard to read, prefer `awk` or a short Python script.

---

## Data Engineering Scenarios

This section covers the patterns data engineers reach for most often. Every command is production-ready.

### Fix CSV Headers

```bash
# Rename a single column header (line 1 only, safe for data rows)
sed '1s/timestamp/event_time/' events.csv
sed '1s/user_id/userId/' api-export.csv

# Rename multiple headers in one pass
sed '1s/ts/timestamp/; 1s/uid/user_id/; 1s/val/value/' raw.csv

# Lowercase all header names
sed '1s/.*/\L&/' data.csv            # GNU sed — \L lowercases entire match

# Add a new column header to the end of the header row
sed '1s/$/,loaded_at/' incremental.csv

# Remove a trailing comma from the header (common export artifact)
sed '1s/,$//' exported.csv
```

> [!warning] CSV with Quoted Fields
> sed operates on raw text and does not understand CSV quoting rules. If your CSV has quoted fields that may contain commas or newlines, use Python's `csv` module or `awk` with FPAT instead.

### Remove BOM from UTF-8 Files

Many Windows tools add a Byte Order Mark (BOM: `EF BB BF`) to UTF-8 files. This breaks `head` comparisons, SQL loaders, and Python readers.

```bash
# Remove the UTF-8 BOM from the first line of a file (GNU sed)
sed -i '1s/^\xEF\xBB\xBF//' file_with_bom.csv

# Verify BOM is gone (should show no output if clean)
head -c 3 file_with_bom.csv | xxd

# Remove BOM from all CSV files in a directory
find . -name '*.csv' -print0 | xargs -0 sed -i '1s/^\xEF\xBB\xBF//'
```

### Strip Trailing Whitespace

```bash
# Remove trailing spaces and tabs from every line
sed 's/[[:space:]]*$//' file.py

# In-place (common before committing code)
sed -i 's/[[:space:]]*$//' *.py *.sql *.yaml

# POSIX portable alternative (avoids [[:space:]] where not supported)
sed 's/[ \t]*$//' file.txt
```

### Convert Windows Line Endings (CRLF → LF)

```bash
# Remove carriage return (\r) from end of each line
sed 's/\r$//' windows_export.csv

# In-place conversion (Linux target)
sed -i 's/\r$//' windows_export.csv

# Process multiple files
find . -name '*.sql' -print0 | xargs -0 sed -i 's/\r$//'

# Verify: should show no ^M characters after
cat -A clean.csv | head -3
```

> [!tip] dos2unix Shortcut
> If `dos2unix` is installed, `dos2unix file.txt` is shorter. Use sed when `dos2unix` is unavailable (containers, minimal images) or when you need to combine CRLF conversion with other transforms in one pass.

### Add Prefix or Suffix to Every Line (Bulk INSERT Generation)

```bash
# Wrap each line as a SQL INSERT values row
sed "s/^/INSERT INTO events (data) VALUES ('/; s/$/');" raw_values.txt

# Add a tab prefix to every line (indent a block of SQL)
sed 's/^/\t/' subquery.sql

# Add a suffix comment to every line
sed 's/$/ -- auto-generated/' generated.sql

# Wrap each filename in single quotes and add a comma (build a SQL IN list)
sed "s/^/'/; s/$/',/" filenames.txt
```

### Comment and Uncomment Lines in Config Files

```bash
# Comment out all lines containing 'debug' in an Airflow config
sed -i '/debug/s/^/# /' airflow.cfg

# Uncomment lines (remove leading # and optional space)
sed -i 's/^# *//' commented_block.conf

# Toggle: uncomment only lines that match a specific pattern
sed -i '/^#.*MAX_CONNECTIONS/s/^#[[:space:]]*//' postgresql.conf

# Comment out a specific named key
sed -i 's/^\(LOG_LEVEL=\)/#\1/' .env
```

### Extract Values from key=value Config Files

```bash
# Print the value of DB_HOST from a .env file
sed -n 's/^DB_HOST=//p' .env

# Extract multiple keys in one pass
sed -n -e 's/^DB_HOST=//p' -e 's/^DB_PORT=//p' .env

# Extract and export as shell variables
eval "$(sed -n 's/^DB_HOST=\(.*\)/DB_HOST=\1/p' .env)"

# Extract value regardless of surrounding whitespace
sed -n 's/^[[:space:]]*DB_HOST[[:space:]]*=[[:space:]]*//p' .env
```

### Modify SQL Migration Files

```bash
# Rename a schema across an entire SQL file
sed -i 's/\bdbo\b/reporting/g' migration_v2.sql

# Add a table prefix to all table names in FROM and JOIN clauses
sed -i -E 's/(FROM|JOIN)[[:space:]]+([a-z_]+)/\1 staging.\2/gi' etl.sql

# Replace a deprecated function name
sed -i 's/GETDATE()/CURRENT_TIMESTAMP/g' stored_procs.sql

# Update a database name reference
sed -i 's/USE \[OldDatabase\]/USE [NewDatabase]/g' *.sql

# Strip square brackets from SQL Server identifiers (for BigQuery migration)
sed -i 's/\[\([^]]*\)\]/`\1`/g' mssql_to_bq.sql

# Add schema qualification to bare table names (simple cases)
sed -E -i 's/\bFROM ([a-z_]+)\b/FROM myschema.\1/g' query.sql
```

### Fix YAML Frontmatter

```bash
# Remove # prefix accidentally added to tags (Obsidian frontmatter repair)
sed -i '/^tags:/,/^[^[:space:]]/ s/#//g' note.md

# Normalise tag format: remove spaces after commas in a tags list
sed -i 's/tags: \[/tags: [/; s/, /,/g' note.md

# Update the 'updated' date in frontmatter to today
sed -i "s/^updated: .*/updated: $(date +%Y-%m-%d)/" note.md

# Remove a frontmatter field entirely
sed -i '/^draft: /d' published_note.md

# Add a status field after the type field
sed -i '/^type: /a\status: complete' note.md
```

### Clean Log Files — Strip ANSI Colour Codes

ANSI escape sequences appear as `\e[31m` (red), `\e[0m` (reset), etc. They corrupt log parsing and grep output.

```bash
# Remove all ANSI escape sequences from a log file (GNU sed)
sed 's/\x1b\[[0-9;]*[mGKHF]//g' coloured.log

# In-place strip (then re-open with less or grep normally)
sed -i 's/\x1b\[[0-9;]*[mGKHF]//g' app.log

# More aggressive — strip any ESC sequence
sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b[^[]*\[[0-9;]*[a-zA-Z]//g' log.txt

# Verify result is clean
grep -P '\x1b' cleaned.log | wc -l   # Should return 0
```

### Transform Date Formats in Data Files

```bash
# US date MM/DD/YYYY → ISO 8601 YYYY-MM-DD
sed -E 's|([0-9]{2})/([0-9]{2})/([0-9]{4})|\3-\1-\2|g' us_dates.csv

# ISO date YYYY-MM-DD → BigQuery DATETIME literal
sed -E "s/([0-9]{4}-[0-9]{2}-[0-9]{2})/DATETIME '\1'/g" bq_query.sql

# Remove time component from datetime — keep only date part
sed -E 's/([0-9]{4}-[0-9]{2}-[0-9]{2})T[0-9:]+Z?/\1/g' events.jsonl

# Convert epoch seconds to a string placeholder for reprocessing
sed -E 's/[0-9]{10}/EPOCH_TS/g' raw.json
```

### Bulk Rename Patterns in Terraform Files

```bash
# Rename a Terraform resource type across all .tf files
find . -name '*.tf' -print0 | xargs -0 sed -i 's/google_bigquery_dataset_access/google_bigquery_dataset_iam_binding/g'

# Update a variable name referenced across modules
find . -name '*.tf' -print0 | xargs -0 sed -i 's/var\.project_id/var.gcp_project_id/g'

# Rename a module source path
sed -i 's|source = "./modules/old-name"|source = "./modules/new-name"|g' main.tf

# Update Terraform required_version constraint
sed -i 's/required_version = ">= 1\.3"/required_version = ">= 1.6"/' versions.tf

# Replace a hardcoded region with a variable reference
find . -name '*.tf' -print0 | xargs -0 sed -i 's/"europe-west1"/var.region/g'
```

### Sanitise PII from Log Output

```bash
# Redact email addresses
sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/EMAIL_REDACTED/g' app.log

# Redact key=value pairs for sensitive keys
sed 's/email=[^ ]*/email=REDACTED/g' query.log
sed 's/password=[^ &]*/password=REDACTED/g' access.log
sed 's/api_key=[^ &]*/api_key=REDACTED/g' api.log

# Redact credit card numbers (16-digit groups)
sed -E 's/\b[0-9]{4}[[:space:]-]?[0-9]{4}[[:space:]-]?[0-9]{4}[[:space:]-]?[0-9]{4}\b/CARD_REDACTED/g' transactions.log

# Redact IPv4 addresses
sed -E 's/\b([0-9]{1,3}\.){3}[0-9]{1,3}\b/IP_REDACTED/g' access.log

# Redact bearer tokens
sed -E 's/Bearer [A-Za-z0-9._-]+/Bearer TOKEN_REDACTED/g' api.log

# Multi-pattern PII scrub in one pass
sed -E \
  -e 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/EMAIL_REDACTED/g' \
  -e 's/password=[^ &]*/password=REDACTED/g' \
  -e 's/Bearer [A-Za-z0-9._-]+/Bearer TOKEN_REDACTED/g' \
  raw_api.log > sanitised_api.log
```

> [!warning] PII Regex Is Not a Substitute for Proper Data Governance
> Regex-based redaction handles common patterns but will miss obfuscated or unusual formats. Use a dedicated PII detection library (e.g., Google Cloud DLP, Microsoft Presidio) for compliance-critical use cases. sed redaction is appropriate for quick local log inspection, not production pipelines.

### Idempotent Pipeline: Normalise Input Before Loading

```bash
# Full normalisation pipeline — chain multiple sed passes or use -e flags
sed \
  -e 's/\r$//' \               # Strip CRLF
  -e 's/[[:space:]]*$//' \     # Strip trailing whitespace
  -e '/^$/d' \                 # Remove blank lines
  -e '1s/^\xEF\xBB\xBF//' \   # Remove UTF-8 BOM
  raw_export.csv > normalised.csv

# Make the pipeline idempotent — running it twice produces the same output
# (all transforms above are already idempotent by nature)
```

---

## PowerShell Equivalents

PowerShell uses the `-replace` operator, which accepts .NET regular expressions (a superset of POSIX ERE). All substitutions are regex-based by default.

> [!info] PowerShell Regex Is .NET Regex
> .NET regex is more powerful than POSIX: named groups `(?<name>...)`, lookaheads, lookbehinds, and non-greedy quantifiers are all supported. The `-replace` operator is case-insensitive by default; use `-creplace` for case-sensitive matching.

### Basic Substitution

```powershell
# Replace first occurrence (PowerShell -replace replaces ALL by default)
(Get-Content file.txt) -replace 'old','new' | Set-Content file.txt

# Global replacement — same as above (all occurrences, PowerShell default)
(Get-Content data.csv) -replace 'old_schema','new_schema' | Set-Content data.csv

# Case-sensitive replacement
(Get-Content file.txt) -creplace 'Old','NEW' | Set-Content file.txt

# Case-insensitive (default in PowerShell, explicit for clarity)
(Get-Content file.txt) -replace '(?i)error','WARN' | Set-Content file.txt
```

### In-Place Editing

```powershell
# PowerShell equivalent of sed -i (read → transform → write back)
$content = Get-Content 'config.yaml'
$content -replace 'localhost','prod-db-host' | Set-Content 'config.yaml'

# One-liner using pipeline
(Get-Content '.\app.properties') -replace 'DEBUG','INFO' | Set-Content '.\app.properties'

# With backup (copy first)
Copy-Item 'schema.sql' 'schema.sql.bak'
(Get-Content 'schema.sql') -replace 'dbo\.','reporting.' | Set-Content 'schema.sql'
```

### Multiple Files

```powershell
# Apply same replacement to all .py files in current directory
Get-ChildItem -Filter '*.py' | ForEach-Object {
    (Get-Content $_.FullName) -replace 'import old_module','import new_module' |
    Set-Content $_.FullName
}

# Recursive across all subdirectories
Get-ChildItem -Recurse -Filter '*.sql' | ForEach-Object {
    (Get-Content $_.FullName) -replace 'dbo\.','schema_name.' |
    Set-Content $_.FullName
}
```

### Line Filtering (Deletion)

```powershell
# Delete lines matching a pattern (equivalent to sed '/pattern/d')
(Get-Content file.log) | Where-Object { $_ -notmatch '^DEBUG' } | Set-Content clean.log

# Delete blank lines
(Get-Content file.txt) | Where-Object { $_ -ne '' } | Set-Content file.txt

# Delete lines not matching a pattern (keep only matching lines)
(Get-Content app.log) | Where-Object { $_ -match 'ERROR|WARN' } | Set-Content filtered.log
```

### Line Selection and Extraction

```powershell
# Print only lines matching a pattern (like sed -n '/pattern/p')
Select-String -Pattern 'ERROR' -Path app.log | Select-Object -ExpandProperty Line

# Print lines 5 through 10 (1-indexed)
(Get-Content file.txt)[4..9]   # PowerShell arrays are 0-indexed

# Extract a value from key=value
$val = (Get-Content .env | Select-String '^DB_HOST=') -replace '^DB_HOST=',''

# Print only the first match
Select-String -Pattern '^DB_PORT=' .env | Select-Object -First 1 -ExpandProperty Line |
  ForEach-Object { $_ -replace '^DB_PORT=','' }
```

### Capture Groups and Back-References

PowerShell uses `$1`, `$2` (not `\1`, `\2`) in the replacement string for capture groups.

```powershell
# Swap key and value around = sign
# Input: name=Alice  →  Output: Alice=name
(Get-Content file.txt) -replace '^(.*)=(.*)','$2=$1' | Set-Content file.txt

# Reformat date YYYY-MM-DD → DD/MM/YYYY
(Get-Content dates.txt) -replace '(\d{4})-(\d{2})-(\d{2})','$3/$2/$1' | Set-Content dates.txt

# Add schema prefix to table names after FROM
(Get-Content query.sql) -replace '(?i)\bFROM\s+(\w+)','FROM reporting.$1' | Set-Content query.sql

# Wrap matched numbers in brackets
(Get-Content numbers.txt) -replace '\d+','[$0]' | Set-Content numbers.txt
# $0 = entire match (equivalent to sed's &)
```

### Advanced: [regex]::Replace() for Complex Patterns

```powershell
# Named capture groups — not available in -replace operator directly, use [regex]
$pattern = '(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})'
$replacement = '${day}/${month}/${year}'
(Get-Content dates.txt) | ForEach-Object {
    [regex]::Replace($_, $pattern, $replacement)
} | Set-Content reformatted.txt

# Non-greedy match — use *? instead of *
(Get-Content html.txt) -replace '<.*?>','' | Set-Content stripped.txt

# Multiline mode — ^ and $ match start/end of each line
$content = Get-Content -Raw file.txt
[regex]::Replace($content, '(?m)^#.*$', '') | Set-Content cleaned.txt

# Callback replacement — run a scriptblock for each match
$content = Get-Content -Raw file.txt
$result = [regex]::Replace($content, '\d+', { param($m) [int]$m.Value * 2 })
$result | Set-Content doubled.txt
```

### CRLF to LF Conversion

```powershell
# Convert CRLF to LF (PowerShell is Windows-native — requires explicit handling)
(Get-Content file.txt -Raw) -replace "`r`n","`n" | Set-Content -NoNewline file_lf.txt

# Alternative using StreamReader/StreamWriter for large files
$reader = [System.IO.StreamReader]::new('big_file.txt')
$writer = [System.IO.StreamWriter]::new('big_file_lf.txt', $false, [System.Text.Encoding]::UTF8, 65536)
$writer.NewLine = "`n"
while (-not $reader.EndOfStream) { $writer.WriteLine($reader.ReadLine()) }
$reader.Close(); $writer.Close()
```

### Strip ANSI Colour Codes

```powershell
# Remove ANSI escape sequences
(Get-Content coloured.log) -replace '\x1b\[[0-9;]*[mGKHF]','' | Set-Content clean.log

# Using [regex] for the same pattern
$ansi = [regex]'\x1b\[[0-9;]*[a-zA-Z]'
(Get-Content coloured.log) | ForEach-Object { $ansi.Replace($_,'') } | Set-Content clean.log
```

### PII Redaction

```powershell
# Redact email addresses
(Get-Content api.log) -replace '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}','EMAIL_REDACTED' |
  Set-Content sanitised.log

# Redact sensitive query parameters
(Get-Content access.log) -replace 'password=[^& ]*','password=REDACTED' |
  -replace 'api_key=[^& ]*','api_key=REDACTED' |
  Set-Content sanitised.log

# Multiple replacements chained
(Get-Content app.log) |
  ForEach-Object {
    $_ -replace '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}','EMAIL_REDACTED' `
       -replace 'Bearer [A-Za-z0-9._-]+','Bearer TOKEN_REDACTED' `
       -replace 'password=[^ &]*','password=REDACTED'
  } | Set-Content sanitised.log
```

---

## sed vs PowerShell Comparison Table

| sed command | PowerShell equivalent | Notes |
|---|---|---|
| `sed 's/old/new/g' file` | `(GC file) -replace 'old','new'` | Both replace all occurrences |
| `sed -i 's/old/new/g' file` | `(GC file) -replace 'old','new' | SC file` | PowerShell: read then write |
| `sed -i.bak 's/old/new/g' file` | `Copy-Item file file.bak; (GC file) -replace 'old','new' | SC file` | Manual backup in PS |
| `sed 's/old/new/gi' file` | `(GC file) -replace 'old','new'` | PS -replace is case-insensitive by default |
| `sed 's/old/new/' file` | `(GC file) | %{ $_ -replace 'old','new' }` | Both replace first on line (PS replaces all) |
| `sed '/pattern/d' file` | `(GC file) | ?{ $_ -notmatch 'pattern' }` | Where-Object filter |
| `sed -n '/pattern/p' file` | `(GC file) | ?{ $_ -match 'pattern' }` | Keep matching lines |
| `sed -n '5,10p' file` | `(GC file)[4..9]` | PS 0-indexed arrays |
| `sed '1d' file` | `(GC file) | Select-Object -Skip 1` | Skip first line |
| `sed '$d' file` | `(GC file) | Select-Object -SkipLast 1` | Skip last line |
| `sed 's/\(a\)\(b\)/\2\1/' file` | `(GC file) -replace '(a)(b)','$2$1'` | PS uses $1,$2; sed uses \1,\2 |
| `sed 's/.*/[&]/' file` | `(GC file) -replace '.*','[$0]'` | & in sed = $0 in PS |
| `sed -E 's/(foo|bar)/baz/' file` | `(GC file) -replace 'foo|bar','baz'` | PS regex always ERE-equivalent |
| `sed '/^$/d' file` | `(GC file) | ?{ $_ -ne '' }` | Remove blank lines |
| `sed 's/[[:space:]]*$//' file` | `(GC file) -replace '\s+$',''` | Trailing whitespace |
| `sed 's/\r$//' file` | `(GC file -Raw) -replace "\r\n","\n"` | CRLF → LF |
| `sed -n 's/^KEY=//p' file` | `(GC file | SS '^KEY=').Line -replace '^KEY=',''` | Extract config value |
| `sed '3i\new line' file` | Requires `[System.Collections.Generic.List[string]]` loop | No direct equivalent |
| `sed '3a\new line' file` | Requires list insertion loop | No direct equivalent |
| `sed '/pattern/c\replacement' file` | `(GC file) | %{ if($_ -match 'pattern'){'replacement'}else{$_} }` | Line replacement |
| `sed -n '=; p' file` | `(GC file) | %{ $n++; "$n"; $_ }` | Print line numbers |
| `sed -f script.sed file` | Script file with `ForEach-Object` blocks | No direct -f equivalent |
| `find . -name '*.sql' | xargs sed -i 's/a/b/g'` | `GCI -R -Filter '*.sql' | %{ (GC $_.FullName) -replace 'a','b' | SC $_.FullName }` | Recursive multi-file edit |

**Abbreviations in table:** `GC` = `Get-Content`, `SC` = `Set-Content`, `SS` = `Select-String`, `GCI` = `Get-ChildItem`, `?{` = `Where-Object {`, `%{` = `ForEach-Object {`

---

## Portability Notes

### GNU sed vs BSD sed (macOS) Key Differences

| Feature | GNU sed (Linux) | BSD sed (macOS) |
|---|---|---|
| `-i` in-place | `sed -i 's/a/b/' file` | `sed -i '' 's/a/b/' file` (empty suffix required) |
| `\+` one-or-more | Supported | Not supported (use `\{1,\}` or `-E`) |
| `|` alternation in BRE | Supported | Not supported (use `-E`) |
| `\w`, `\d` shorthand | Supported | Not supported (use `[[:alnum:]_]`, `[0-9]`) |
| `\n` in replacement | Supported | Not supported (use `$'\n'` workaround) |
| `\L`, `\U` case conversion | Supported | Not supported |
| `0` address | Supported | Not supported |
| `1~2` step address | Supported | Not supported |

> [!tip] Cross-Platform sed Scripts
> For scripts that must run on both Linux and macOS:
> 1. Always use `-i.bak` (or handle the suffix in a conditional)
> 2. Prefer `-E` for extended regex instead of BRE `\+`, `|`
> 3. Avoid `\w`, `\d` — use POSIX classes `[[:alpha:]]`, `[0-9]`
> 4. Test on both platforms before automating

### Minimal Portable One-Liners

```bash
# Cross-platform in-place edit (works on both GNU and BSD sed)
# Method 1: use .bak and then delete it
sed -i.bak 's/old/new/g' file && rm file.bak

# Method 2: detect OS
if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' 's/old/new/g' file
else
    sed -i 's/old/new/g' file
fi

# Method 3: use a temp file (most portable of all)
sed 's/old/new/g' file > file.tmp && mv file.tmp file
```

---

## Character Classes Reference

POSIX character classes work in both GNU and BSD sed, unlike `\w`, `\d` shorthand.

| Class | Matches | Example |
|---|---|---|
| `[[:alpha:]]` | Letters a-z A-Z | `sed 's/[[:alpha:]]//g'` |
| `[[:digit:]]` | Digits 0-9 | `sed 's/[[:digit:]]//g'` |
| `[[:alnum:]]` | Letters and digits | `sed 's/[[:alnum:]]//g'` |
| `[[:space:]]` | Space, tab, newline, etc. | `sed 's/[[:space:]]//g'` |
| `[[:blank:]]` | Space and tab only | `sed 's/[[:blank:]]//g'` |
| `[[:upper:]]` | Uppercase letters | `sed 's/[[:upper:]]/X/g'` |
| `[[:lower:]]` | Lowercase letters | `sed 's/[[:lower:]]/x/g'` |
| `[[:punct:]]` | Punctuation characters | `sed 's/[[:punct:]]//g'` |
| `[[:print:]]` | Printable characters | `sed '/[^[:print:]]/d'` |
| `[[:graph:]]` | Printable non-space characters | — |

---

## Quick Reference Card

```
SUBSTITUTION
  s/pat/rep/       Replace first match per line
  s/pat/rep/g      Replace all matches per line
  s/pat/rep/2      Replace 2nd match per line
  s/pat/rep/gi     Case-insensitive, all matches
  s/pat/rep/p      Replace and print if changed

DELETION
  /pat/d           Delete lines matching pat
  1,5d             Delete lines 1-5
  /a/,/b/d         Delete from line matching a to line matching b
  /^$/d            Delete blank lines

INSERTION
  3i\text          Insert text before line 3
  3a\text          Append text after line 3
  /pat/c\text      Replace entire matching line with text

ADDRESSING
  5                Line 5 only
  $                Last line
  /pat/            Lines matching pat
  5,10             Lines 5 through 10
  /a/,/b/          Lines from match of a to match of b
  addr!            Negate address

PRINT / EXTRACT
  -n '/pat/p'      Print only matching lines (like grep)
  -n '5,10p'       Print lines 5-10
  -n 's/^KEY=//p'  Extract value from key=value

FLAGS
  -n               Suppress default output
  -i               In-place edit (GNU: no suffix; BSD: requires '')
  -i.bak           In-place with backup
  -e 'cmd'         Add expression (multiple allowed)
  -E               Extended regex (ERE)
  -f file          Read commands from file

SPECIAL REPLACEMENT TOKENS
  &                Entire matched text
  \1 ... \9        Capture group back-references (BRE)
  $1 ... $9        Capture group back-references (PowerShell -replace)
```

---

## Related Notes

- [[reading-file-contents]] — Reading files with cat, head, tail, less
- [[awk-data-processing]] — awk for column-based processing and multi-line operations
- [[grep-and-pattern-matching]] — grep for pattern searching and filtering
