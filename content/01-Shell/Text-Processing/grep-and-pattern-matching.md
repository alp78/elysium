---
type: reference
category: shell
technology: [bash, powershell, grep]
tags: [shell, bash]
aliases:
  - grep
  - egrep
  - fgrep
  - rg
  - ripgrep
  - Select-String
  - sls
  - findstr
  - regex
  - regular expressions
  - pattern matching
  - text search
  - log search
keywords:
  - grep
  - egrep
  - fgrep
  - ripgrep
  - rg
  - Select-String
  - findstr
  - regex
  - regular expressions
  - pattern matching
  - text processing
  - log analysis
  - recursive search
  - case insensitive search
  - invert match
  - context lines
  - PCRE
  - perl compatible regex
  - character classes
  - lookahead
  - lookbehind
  - bash text search
  - powershell grep equivalent
  - zgrep
  - compressed file search
description: "Exhaustive reference for grep and pattern matching in bash and PowerShell, covering basic flags, regular expressions, advanced features, data engineering scenarios, and ripgrep. Every bash example paired with its PowerShell Select-String equivalent."
related:
  - "[[reading-file-contents]]"
  - "[[io-redirection]]"
  - "[[finding-files]]"
  - "[[command-chaining]]"
  - "[[process-substitution]]"
  - "[[brace-expansion-and-globbing]]"
  - "[[viewing-processes]]"
  - "[[defensive-scripting]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# grep and Pattern Matching

`grep` (Global Regular Expression Print) is the foundational text search tool in Unix/Linux environments and the daily workhorse of log analysis, pipeline debugging, and code archaeology for data engineers. This note covers `grep` exhaustively alongside PowerShell's `Select-String` equivalent, so every technique is immediately usable regardless of which environment you are working in.

---

## Basic Pattern Matching

### Syntax fundamentals

```bash
# Basic form: grep <options> <pattern> <file(s)>
grep 'pattern' file.txt

# Multiple files
grep 'pattern' file1.txt file2.txt

# With a glob (searches all .log files in current directory)
grep 'ERROR' *.log

# stdin — read from a pipe instead of a file
cat file.txt | grep 'pattern'
```

**PowerShell equivalents:**

```powershell
# Select-String (alias: sls) — the PowerShell grep
Select-String -Pattern 'pattern' -Path file.txt

# Multiple files via glob
Select-String -Pattern 'ERROR' -Path *.log

# Reading from pipeline (Get-Content replaces cat)
Get-Content file.txt | Select-String 'pattern'
```

---

### Case-insensitive search (`grep -i`)

```bash
# Match ERROR, error, Error, eRRoR — any case variation
grep -i 'error' application.log

# Case-insensitive recursive search
grep -ri 'password' /etc/
```

**PowerShell:**

```powershell
# Select-String is case-insensitive BY DEFAULT
Select-String -Pattern 'error' -Path application.log

# To force case-sensitive matching, add -CaseSensitive
Select-String -Pattern 'error' -Path application.log -CaseSensitive
```

> [!tip] grep is case-sensitive by default; PowerShell is the opposite
> `grep` requires `-i` to be case-insensitive. `Select-String` is case-insensitive by default and requires `-CaseSensitive` to enforce case. Keep this inverted default in mind when porting scripts.

---

### Whole-word matching (`grep -w`)

```bash
# Matches 'log' but NOT 'logfile', 'catalog', 'blog'
grep -w 'log' deployment.log

# Whole-word + case-insensitive
grep -wi 'error' app.log

# Whole-word match on 'DROP' — avoids matching 'DROPDOWN', 'TEARDROP'
grep -w 'DROP' schema_migration.sql
```

**PowerShell:**

```powershell
# Use word boundary anchors \b in the regex pattern
Select-String -Pattern '\blog\b' deployment.log

# Case-sensitive whole-word match
Select-String -Pattern '\bDROP\b' schema_migration.sql -CaseSensitive
```

---

### Line numbers (`grep -n`)

```bash
# Show line number before each matching line — essential for navigating large files
grep -n 'FAILED' etl_pipeline.log

# Combine with -i for case-insensitive with line numbers
grep -ni 'timeout' job.log
```

**PowerShell:**

```powershell
# Select-String always includes line numbers in its output object
# The LineNumber property is always populated; it shows in default output
Select-String -Pattern 'FAILED' etl_pipeline.log

# To see only the line number and matched line (similar to grep -n output):
Select-String -Pattern 'FAILED' etl_pipeline.log |
    Select-Object LineNumber, Line
```

---

### Count matches (`grep -c`)

```bash
# Print count of matching lines (not total matches — each line counts once)
grep -c 'ERROR' application.log

# Count across multiple files — prints filename:count for each file
grep -c 'ERROR' *.log

# Count non-matching lines (lines without ERROR)
grep -cv 'ERROR' application.log
```

**PowerShell:**

```powershell
# Count matching lines — pipeline the results to Measure-Object
(Select-String -Pattern 'ERROR' application.log).Count

# Count per file across multiple files
Get-ChildItem *.log | ForEach-Object {
    $count = (Select-String -Pattern 'ERROR' $_.FullName).Count
    [PSCustomObject]@{ File = $_.Name; Count = $count }
}
```

---

### Files with matches (`grep -l`) and files without (`grep -L`)

```bash
# Print only the filenames that contain the pattern — not the matching lines
grep -l 'api_key' *.py *.cfg *.env

# Print only the filenames that DO NOT contain the pattern
grep -L 'logging.basicConfig' *.py

# Find which log files have any errors today
grep -l 'ERROR' /var/log/myapp/*.log
```

**PowerShell:**

```powershell
# Files WITH matches — select unique Filename property
Select-String -Pattern 'api_key' -Path *.py, *.cfg |
    Select-Object -ExpandProperty Filename -Unique

# Files WITHOUT matches
$allFiles = Get-ChildItem *.py | Select-Object -ExpandProperty FullName
$withMatches = Select-String -Pattern 'logging.basicConfig' -Path *.py |
    Select-Object -ExpandProperty Filename -Unique
$allFiles | Where-Object { $_ -notin $withMatches }
```

---

### Recursive search (`grep -r` / `grep -R`)

```bash
# Recursively search all files under a directory
grep -r 'TODO' ./src/

# -R follows symlinks; -r does not
grep -R 'TODO' ./src/

# Recursive + case-insensitive + line numbers — common combo for code archaeology
grep -rin 'deprecated' ./dags/

# Recursive search with file type filter (--include)
grep -r --include='*.py' 'def transform' ./pipelines/

# Exclude a directory from recursive search
grep -r --exclude-dir='.git' --exclude-dir='__pycache__' 'secret' .

# Multiple include patterns
grep -r --include='*.sql' --include='*.py' 'staging_table' ./
```

**PowerShell:**

```powershell
# Recursive search using Get-ChildItem -Recurse to feed Select-String
Get-ChildItem -Recurse -Filter *.py | Select-String -Pattern 'def transform'

# Recursive, all file types
Get-ChildItem -Recurse | Select-String -Pattern 'TODO'

# Recursive with directory exclusion
Get-ChildItem -Recurse |
    Where-Object { $_.FullName -notmatch '\\\.git\\|__pycache__' } |
    Select-String -Pattern 'secret'
```

---

### Invert match / exclude lines (`grep -v`)

```bash
# Print every line that does NOT match the pattern
grep -v 'DEBUG' application.log

# Exclude comment lines (lines starting with #) from a config file
grep -v '^#' my_config.ini | grep -v '^$'   # also removes blank lines

# The classic self-exclusion trick in process lists
ps aux | grep python | grep -v grep

# Exclude multiple patterns by chaining -v
grep -v 'INFO' app.log | grep -v 'DEBUG' | grep -v '^$'

# More elegant: use extended regex to exclude multiple patterns at once
grep -Ev 'INFO|DEBUG|^$' app.log
```

**PowerShell:**

```powershell
# Invert match with -NotMatch switch
Select-String -Pattern 'DEBUG' application.log -NotMatch

# Exclude comment lines and blank lines
Get-Content my_config.ini |
    Select-String -Pattern '^#' -NotMatch |
    Select-String -Pattern '^\s*$' -NotMatch

# Exclude multiple patterns — use alternation in one call
Select-String -Pattern 'INFO|DEBUG|^\s*$' application.log -NotMatch

# PowerShell pipeline self-exclusion (no need for grep -v grep trick)
Get-Process | Where-Object { $_.ProcessName -like '*python*' }
```

> [!tip] Chain grep -v calls vs. use -Ev for performance
> Two chained `grep -v` calls read the file twice through the pipe. Using `grep -Ev 'pattern1|pattern2'` applies both exclusions in a single pass, which matters on large log files.

---

## Regular Expression Patterns

### Basic regex (BRE — Basic Regular Expressions)

`grep` without `-E` uses Basic Regular Expressions (BRE). Some metacharacters require backslash escaping.

```bash
# . — matches any single character (except newline)
grep 'err.r' app.log          # matches 'error', 'err0r', 'err r', etc.

# * — zero or more of the preceding character
grep 'err*or' app.log         # matches 'eror', 'error', 'errror', etc.

# ^ — anchor to start of line
grep '^2026-03' app.log       # lines starting with 2026-03 (date prefix)

# $ — anchor to end of line
grep 'success$' app.log       # lines ending with 'success'

# ^$ — match completely blank lines
grep '^$' file.txt

# [] — character class (match any one character in the set)
grep '[Ee]rror' app.log       # matches 'Error' or 'error'
grep '[0-9]' data.csv         # any line containing a digit

# [^] — negated character class (match any character NOT in the set)
grep '[^0-9]' data.csv        # lines containing a non-digit character

# Escaping in BRE — these chars need backslash to be literal metacharacters
grep 'function\(\)' code.py   # match literal 'function()'
grep 'table_name\.' query.sql # match 'table_name.' (literal dot)

# Combining anchors and classes for strict matching
grep '^[A-Z]' names.txt       # lines starting with an uppercase letter
```

**PowerShell uses .NET regex (similar to PCRE) for all Select-String calls:**

```powershell
# .NET regex — the same metacharacters apply
Select-String -Pattern 'err.r' app.log
Select-String -Pattern '^2026-03' app.log
Select-String -Pattern '[Ee]rror' app.log
Select-String -Pattern '^$' file.txt

# Literal string match (no regex interpretation) — equivalent to grep -F
Select-String -Pattern 'function()' code.py -SimpleMatch
```

---

### Extended regex (`grep -E` / `egrep`)

Extended Regular Expressions (ERE) enable `+`, `?`, `|`, `()`, `{}` without backslash escaping. Always prefer `-E` over BRE for readability.

```bash
# + — one or more of the preceding element
grep -E 'err+or' app.log      # matches 'error', 'errror', but NOT 'eror'

# ? — zero or one of the preceding element (optional)
grep -E 'colou?r' docs.txt    # matches 'color' or 'colour'

# | — alternation (OR)
grep -E 'ERROR|FATAL|CRITICAL' app.log

# () — grouping
grep -E '(ERROR|WARN): ' app.log    # colon+space must follow the level word

# {} — quantifiers
grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' logs.txt   # ISO date YYYY-MM-DD
grep -E '[0-9]{1,3}' data.csv                     # 1, 2, or 3 digit number

# Combine grouping and quantifiers
grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' access.log  # rough IP address match

# egrep is identical to grep -E (deprecated in some systems; prefer grep -E)
egrep 'ERROR|WARN' app.log
```

**PowerShell (.NET regex — ERE-equivalent features are always available):**

```powershell
# All ERE features work natively in Select-String
Select-String -Pattern 'err+or' app.log
Select-String -Pattern 'colou?r' docs.txt
Select-String -Pattern 'ERROR|FATAL|CRITICAL' app.log
Select-String -Pattern '[0-9]{4}-[0-9]{2}-[0-9]{2}' logs.txt
Select-String -Pattern '([0-9]{1,3}\.){3}[0-9]{1,3}' access.log
```

---

### POSIX character classes

POSIX character classes work inside `[]` and are more portable than ASCII ranges.

```bash
# [:alpha:] — any letter (a-z, A-Z), locale-aware
grep '[[:alpha:]]' file.txt

# [:digit:] — any digit (0-9)
grep '[[:digit:]]' file.txt

# [:alnum:] — letters and digits
grep '[[:alnum:]]' file.txt

# [:space:] — space, tab, newline, carriage return, form feed, vertical tab
grep '[[:space:]]' file.txt

# [:upper:] / [:lower:]
grep '^[[:upper:]]' file.txt   # lines starting with uppercase

# [:punct:] — punctuation characters
grep '[[:punct:]]' file.txt

# [:blank:] — space and tab only (subset of space)
grep '[[:blank:]]' file.txt

# Practical: find CSV lines where first field is non-numeric
grep '^[[:alpha:]]' data.csv

# Find lines with leading whitespace (indented lines)
grep '^[[:space:]]' script.py
```

> [!info] POSIX classes vs \d \w \s
> POSIX character classes (`[:digit:]`, `[:alpha:]`) work in BRE and ERE. Perl-style shortcuts (`\d`, `\w`, `\s`) require `grep -P`. In PowerShell's .NET regex, `\d`, `\w`, `\s` are always available.

---

### Common data engineering regex patterns

**Match IPv4 addresses:**

```bash
# Strict IPv4 — each octet 0-255 (simplified to 1-3 digits for most log use)
grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' access.log

# More precise (rejects 999.999.999.999):
grep -E '\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b' access.log
```

```powershell
# PowerShell — precise IPv4
Select-String -Pattern '\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b' access.log
```

**Match ISO 8601 dates (YYYY-MM-DD):**

```bash
# ISO date — common in log timestamps and data files
grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' events.log

# Anchored: lines that START with an ISO date (typical log format)
grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' events.log

# ISO datetime with time component: 2026-03-22T14:30:00
grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' events.log
```

```powershell
Select-String -Pattern '^[0-9]{4}-[0-9]{2}-[0-9]{2}' events.log
```

**Match various date formats:**

```bash
# MM/DD/YYYY (US format)
grep -E '[0-9]{2}/[0-9]{2}/[0-9]{4}' report.log

# DD-Mon-YYYY (Oracle/SQL Server format: 22-Mar-2026)
grep -E '[0-9]{2}-[A-Za-z]{3}-[0-9]{4}' oracle.log

# Unix epoch timestamp (10 digits)
grep -E '\b[0-9]{10}\b' events.log
```

**Match email addresses:**

```bash
# Practical email match (not RFC-5321 compliant, but covers 99% of real cases)
grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.csv

# Find emails in Python source code
grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' --include='*.py' .
```

```powershell
Select-String -Pattern '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.csv
```

**Match SQL table names (schema.table format):**

```bash
# Match schema-qualified table references: dbo.fact_sales, raw.events
grep -E '\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b' query.sql

# Match CREATE TABLE statements
grep -iE '^[[:space:]]*CREATE[[:space:]]+TABLE' schema.sql

# Match INSERT INTO targets
grep -iE 'INSERT[[:space:]]+INTO[[:space:]]+[`"]?[a-zA-Z_][a-zA-Z0-9_.]*[`"]?' *.sql
```

```powershell
# SQL CREATE TABLE detection
Select-String -Pattern '(?i)^\s*CREATE\s+TABLE' schema.sql

# INSERT INTO targets
Select-String -Pattern '(?i)INSERT\s+INTO\s+[`"]?[a-zA-Z_][a-zA-Z0-9_.]*' *.sql
```

**Match JSON keys:**

```bash
# JSON key pattern: "key_name":
grep -E '"[a-zA-Z_][a-zA-Z0-9_]*"\s*:' response.json

# Find specific keys in JSON logs
grep -E '"(error|status|message)"\s*:' api_log.json

# Extract nested key paths (rudimentary — use jq for proper JSON parsing)
grep -oE '"[a-zA-Z_][a-zA-Z0-9_]*"\s*:\s*"[^"]*"' data.json
```

```powershell
Select-String -Pattern '"[a-zA-Z_][a-zA-Z0-9_]*"\s*:' response.json
```

> [!warning] Use jq for real JSON parsing
> `grep` can find JSON keys but cannot handle multiline JSON, nested structures, or arrays correctly. For structured JSON querying, use `jq` in bash or `ConvertFrom-Json` in PowerShell. Grep is appropriate for quick scans of NDJSON (newline-delimited JSON) log files.

**Match log levels:**

```bash
# Standard log levels — case-insensitive, word-bounded
grep -iE '\b(ERROR|FATAL|CRITICAL|WARN|WARNING|INFO|DEBUG|TRACE)\b' app.log

# Only high-severity lines
grep -E '\b(ERROR|FATAL|CRITICAL)\b' app.log

# Lines with log level at start (structured log format)
grep -E '^(ERROR|WARN|INFO|DEBUG)[[:space:]]' structured.log

# Count errors per log level
for level in ERROR WARN INFO DEBUG; do
    count=$(grep -c "\\b${level}\\b" app.log 2>/dev/null || echo 0)
    echo "${level}: ${count}"
done
```

```powershell
# High-severity log lines
Select-String -Pattern '\b(ERROR|FATAL|CRITICAL)\b' app.log

# Count per level
foreach ($level in @('ERROR','WARN','INFO','DEBUG')) {
    $count = (Select-String -Pattern "\b$level\b" app.log).Count
    [PSCustomObject]@{ Level = $level; Count = $count }
}
```

**Match numeric ranges:**

```bash
# Lines containing a 3-5 digit number (e.g., HTTP status codes, port numbers)
grep -E '\b[0-9]{3,5}\b' access.log

# HTTP 5xx errors specifically
grep -E '\b5[0-9]{2}\b' access.log

# Negative numbers (for detecting data quality issues)
grep -E '-[0-9]+' financial_data.csv

# Numbers with optional decimal (float values)
grep -E '\b[0-9]+(\.[0-9]+)?\b' metrics.log
```

---

## Advanced grep Usage

### Context lines (`grep -A`, `-B`, `-C`)

Context lines are critical for log analysis — the error message alone rarely tells the full story.

```bash
# -A N — print N lines AFTER each match (After)
grep -A 3 'EXCEPTION' app.log    # show the 3 lines of stack trace after the exception header

# -B N — print N lines BEFORE each match (Before)
grep -B 2 'Connection refused' app.log   # see what triggered the connection attempt

# -C N — print N lines before AND after each match (Context, symmetric)
grep -C 5 'OOM' worker.log       # 5 lines of context around out-of-memory events

# Context with multiple matches — grep separates blocks with '--'
grep -C 2 'FATAL' app.log

# Combine context with recursive search
grep -r -C 3 'raise ValueError' ./src/
```

**PowerShell:**

```powershell
# -Context takes two values: lines before, lines after
Select-String -Pattern 'EXCEPTION' app.log -Context 0,3    # 0 before, 3 after (= grep -A 3)
Select-String -Pattern 'Connection refused' app.log -Context 2,0   # 2 before, 0 after (= grep -B 2)
Select-String -Pattern 'OOM' worker.log -Context 5,5      # symmetric (= grep -C 5)

# Display the context lines alongside the match
Select-String -Pattern 'FATAL' app.log -Context 2,2 |
    ForEach-Object {
        $_.Context.PreContext  | ForEach-Object { "  $_" }
        $_.Line
        $_.Context.PostContext | ForEach-Object { "  $_" }
        '---'
    }
```

---

### Print only the matching part (`grep -o`)

```bash
# -o — print only the matched substring, one match per line (not the whole line)
grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' app.log     # extract all dates
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.txt  # extract emails
grep -oE '\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' access.log  # extract IPs

# Count unique values extracted with -o
grep -oE '\b5[0-9]{2}\b' access.log | sort | uniq -c | sort -rn

# Extract and deduplicate table names from SQL files
grep -ohE '\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b' *.sql | sort -u
```

**PowerShell:**

```powershell
# Use the Matches property of Select-String output to get captured text
(Select-String -Pattern '[0-9]{4}-[0-9]{2}-[0-9]{2}' app.log).Matches.Value

# Extract all matches from all lines
Select-String -Pattern '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.txt |
    ForEach-Object { $_.Matches } |
    Select-Object -ExpandProperty Value |
    Sort-Object -Unique

# Count unique HTTP status codes
Select-String -Pattern '\b[0-9]{3}\b' access.log |
    ForEach-Object { $_.Matches.Value } |
    Group-Object |
    Sort-Object Count -Descending
```

---

### Perl-compatible regex (`grep -P`)

`grep -P` enables PCRE (Perl-Compatible Regular Expressions), which adds lookahead, lookbehind, non-greedy quantifiers, and `\d`, `\w`, `\s` shortcuts. Not available on all systems (macOS `grep` does not support `-P`; install `ggrep` via Homebrew).

```bash
# \d — digit, \w — word character, \s — whitespace (PCRE shortcuts)
grep -P '\d{4}-\d{2}-\d{2}' events.log         # ISO date using \d
grep -P '\s+ERROR\s+' app.log                   # ERROR surrounded by whitespace

# Lookahead — match 'user' only when followed by '='
grep -P 'user(?==)' config.ini

# Negative lookahead — match 'password' NOT followed by '_hash'
grep -P 'password(?!_hash)' config.py

# Lookbehind — match a number only when preceded by 'port='
grep -oP '(?<=port=)\d+' config.ini

# Non-greedy quantifier *? — match the shortest possible string
echo '<tag>content</tag>' | grep -oP '<.*?>'   # matches <tag> and </tag> separately

# Named capture groups (with -o to extract)
grep -oP '(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})' events.log

# \b word boundary in PCRE
grep -P '\bETL\b' documentation.md    # avoids matching 'ETLX' or 'non-ETL'
```

**PowerShell (.NET regex always supports lookahead/lookbehind):**

```powershell
# \d, \w, \s are always available in PowerShell regex
Select-String -Pattern '\d{4}-\d{2}-\d{2}' events.log

# Lookahead
Select-String -Pattern 'user(?==)' config.ini

# Negative lookahead
Select-String -Pattern 'password(?!_hash)' config.py

# Lookbehind — extract port number
(Select-String -Pattern '(?<=port=)\d+' config.ini).Matches.Value

# Non-greedy
'<tag>content</tag>' | Select-String -Pattern '<.*?>' -AllMatches |
    ForEach-Object { $_.Matches.Value }
```

> [!warning] grep -P is not portable
> `grep -P` is GNU grep only. macOS's BSD grep does not support it. On macOS, install `grep` via Homebrew (`brew install grep`) and use `ggrep -P`, or use `perl -ne 'print if /pattern/'` as a portable alternative. In CI/CD pipelines targeting Linux, `-P` is safe.

---

### Patterns from a file (`grep -f`)

```bash
# Read patterns from a file — one pattern per line
cat error_patterns.txt
# EXCEPTION
# Connection refused
# OOM
# Segmentation fault

grep -f error_patterns.txt application.log

# Combine -f with other flags
grep -if error_patterns.txt application.log   # case-insensitive
grep -rf error_patterns.txt /var/log/         # recursive

# Useful for maintaining a curated watchlist of error signatures
# Keep error_patterns.txt in version control alongside your runbooks
```

**PowerShell:**

```powershell
# Read patterns from file and build alternation string
$patterns = Get-Content error_patterns.txt
$combined = $patterns -join '|'
Select-String -Pattern $combined application.log

# Or loop over each pattern:
$patterns | ForEach-Object {
    Select-String -Pattern $_ application.log
}
```

---

### File filtering in recursive search (`--include`, `--exclude`, `--exclude-dir`)

```bash
# Search only Python files
grep -r --include='*.py' 'import pandas' ./

# Search only SQL and Python files (multiple --include)
grep -r --include='*.sql' --include='*.py' 'staging_' ./pipelines/

# Exclude test files from search
grep -r --include='*.py' --exclude='test_*.py' 'def load' ./

# Exclude directories
grep -r --exclude-dir='.git' --exclude-dir='__pycache__' --exclude-dir='node_modules' 'TODO' .

# Exclude compiled/binary files
grep -r --exclude='*.pyc' --exclude='*.pyo' --exclude-dir='.git' 'connection_string' .
```

**PowerShell:**

```powershell
# Include filter via Get-ChildItem -Filter
Get-ChildItem -Recurse -Filter *.py | Select-String -Pattern 'import pandas'

# Multiple file types
Get-ChildItem -Recurse -Include *.sql, *.py | Select-String -Pattern 'staging_'

# Exclude directories
Get-ChildItem -Recurse -Filter *.py |
    Where-Object { $_.FullName -notmatch '\\\.git\\|__pycache__' } |
    Select-String -Pattern 'TODO'

# Exclude specific file name patterns
Get-ChildItem -Recurse -Filter *.py |
    Where-Object { $_.Name -notlike 'test_*' } |
    Select-String -Pattern 'def load'
```

---

### Null-delimited output (`grep -z`, `-Z`)

```bash
# -Z — print NUL byte after each filename (used with xargs -0 to handle spaces in paths)
grep -rlZ 'TODO' . | xargs -0 sed -i 's/TODO/FIXME/g'

# -z — treat input as NUL-delimited (for processing filenames with newlines/spaces)
find . -name '*.log' -print0 | xargs -0 grep -l 'ERROR'
```

---

### Combining grep with pipes

```bash
# The self-exclusion pattern — grep your own grep from ps output
ps aux | grep '[p]ython'         # bracket trick: avoids matching the grep process itself
ps aux | grep python | grep -v grep   # explicit exclusion (less elegant)

# Chain to narrow down progressively
cat access.log | grep 'POST' | grep '/api/' | grep '500'

# Count after filtering
grep 'ERROR' app.log | grep '2026-03-22' | wc -l

# Extract fields after pattern match (grep + cut)
grep 'user_id' events.log | cut -d'=' -f2 | sort -u

# Combine with awk for field extraction
grep 'FAILED' pipeline.log | awk '{print $NF}'   # last field of each matched line

# Find and immediately display with head (stop after first few matches)
grep -r 'deprecated_function' ./src/ | head -20
```

**PowerShell:**

```powershell
# Progressive narrowing via pipeline
Get-Content access.log |
    Select-String 'POST' |
    Select-String '/api/' |
    Select-String '500'

# Count after filtering
(Get-Content app.log | Select-String 'ERROR' | Select-String '2026-03-22').Count

# Extract fields after match — split on delimiter
Select-String 'user_id' events.log |
    ForEach-Object { ($_.Line -split '=')[1].Trim() } |
    Sort-Object -Unique

# Equivalent of grep + head
Select-String -Pattern 'deprecated_function' (Get-ChildItem -Recurse -Filter *.py) |
    Select-Object -First 20
```

---

## Data Engineering Scenarios

### Search log files for errors

```bash
# Find any high-severity log line across all logs in a directory
grep -rE '\b(ERROR|FATAL|CRITICAL|EXCEPTION)\b' /var/log/myapp/

# Find errors in today's log file (if logs are named by date)
grep -E '\b(ERROR|FATAL)\b' /var/log/myapp/app-$(date +%Y-%m-%d).log

# Find errors from the last hour (using timestamp pattern — adjust format to your logs)
grep -E '^2026-03-22 1[4-5]:' app.log | grep -E 'ERROR|FATAL'

# Tail-and-grep in real time
tail -f /var/log/myapp/app.log | grep --line-buffered -E 'ERROR|FATAL'

# Count errors per hour from a day's log
grep 'ERROR' app.log | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}' | sort | uniq -c
```

**PowerShell:**

```powershell
# Real-time monitoring equivalent of tail -f | grep
Get-Content -Path app.log -Wait -Tail 0 | Select-String -Pattern 'ERROR|FATAL'

# Errors from today's log
$today = (Get-Date).ToString('yyyy-MM-dd')
Select-String -Pattern 'ERROR|FATAL' -Path "app-$today.log"
```

---

### Find SQL deadlocks in logs

```bash
# SQL Server deadlock evidence in application logs
grep -iE 'deadlock|lock timeout|transaction.*rolled back|1205' sqlserver.log

# SQL Server deadlock XML events (if captured from Extended Events)
grep -n 'deadlock-list' *.xel.txt

# PostgreSQL deadlock detection
grep -iE 'deadlock detected|process.*waits for' /var/log/postgresql/postgresql-*.log

# Find deadlock candidates by looking for conflicting lock waits
grep -B5 'deadlock' sqlserver.log   # show 5 lines before each deadlock mention
```

**PowerShell:**

```powershell
Select-String -Pattern '(?i)deadlock|lock timeout|transaction.*rolled back' sqlserver.log -Context 5,0
```

---

### Search pipeline code for table references

```bash
# Find all references to a specific table across all Python, SQL, and config files
grep -rE '\bfact_sales\b' --include='*.py' --include='*.sql' --include='*.yaml' ./

# Find all tables in a schema that are referenced
grep -rE '\braw\.[a-zA-Z_]+\b' --include='*.sql' . | grep -oE '\braw\.[a-zA-Z_]+\b' | sort -u

# Find hardcoded table names (potential issue for multi-environment pipelines)
grep -rE '"(dev|staging|prod)\.' --include='*.py' ./dags/

# Find all INSERT/UPDATE/DELETE DML touching a table
grep -iE '(INSERT INTO|UPDATE|DELETE FROM)[[:space:]]+[`"]?orders[`"]?' *.sql
```

**PowerShell:**

```powershell
# Find all table references across code files
Get-ChildItem -Recurse -Include *.py, *.sql, *.yaml |
    Select-String -Pattern '\bfact_sales\b'

# Deduplicated raw-schema references
Get-ChildItem -Recurse -Filter *.sql |
    Select-String -Pattern '\braw\.[a-zA-Z_]+\b' |
    ForEach-Object { $_.Matches.Value } |
    Sort-Object -Unique
```

---

### Find environment variable usage across configs

```bash
# Find all environment variable reads in Python code
grep -rE 'os\.environ|os\.getenv' --include='*.py' ./

# Find references to a specific env var
grep -rE '\bDB_PASSWORD\b|\bDATABASE_URL\b' --include='*.py' --include='*.env.example' .

# Find .env files (potential credential exposure)
find . -name '*.env' | xargs grep -l 'password\|secret\|key' 2>/dev/null

# Find hardcoded credential patterns in source code
grep -rE '(password|secret|api_key|token)\s*=\s*["\x27][^"\x27]+["\x27]' \
    --include='*.py' --include='*.js' --include='*.yaml' .
```

**PowerShell:**

```powershell
# Find env var usage in Python files
Get-ChildItem -Recurse -Filter *.py |
    Select-String -Pattern 'os\.environ|os\.getenv'

# Credential pattern detection
Get-ChildItem -Recurse -Include *.py, *.yaml, *.json |
    Select-String -Pattern '(password|secret|api_key|token)\s*=\s*["\x27][^"\x27]+'
```

> [!warning] Never commit real credentials
> When searching for credential patterns to audit, run the search BEFORE a `git add` and add detected files to `.gitignore`. If credentials already appear in git history, use `git filter-repo` (not `git filter-branch`) to purge them.

---

### Extract specific fields from CSV using grep + cut

```bash
# Extract email column (column 3) from lines where status is 'active'
grep 'active' users.csv | cut -d',' -f3

# Extract rows where revenue column (col 5) is above a threshold
# (grep can't do math — use awk for numeric comparisons, grep to pre-filter)
grep '2026-03' sales.csv | awk -F',' '$5 > 10000 {print $0}'

# Extract rows matching a date prefix
grep '^2026-03-22' timeseries.csv | cut -d',' -f1,4,5

# Find CSV rows with empty mandatory fields (consecutive commas)
grep ',,' required_fields.csv

# Find rows with the wrong number of columns (should be 7 fields = 6 commas)
grep -v '^[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*$' data.csv
```

**PowerShell:**

```powershell
# Import-Csv is far superior for structured CSV work
$active = Import-Csv users.csv | Where-Object { $_.status -eq 'active' } | Select-Object email

# Find rows with empty mandatory fields
Get-Content required_fields.csv | Select-String -Pattern ',,'

# Wrong column count (6 commas = 7 fields)
Get-Content data.csv | Where-Object { ($_ -split ',').Count -ne 7 }
```

> [!tip] Use Import-Csv for structured CSV work in PowerShell
> PowerShell's `Import-Csv` turns every row into a typed object with named properties. This is almost always better than `grep | cut` for CSV manipulation. Use `Select-String` on CSVs only for quick keyword scans where you don't need field-level access.

---

### Search compressed log files (`zgrep`)

```bash
# zgrep — transparent grep over gzip-compressed files
zgrep 'ERROR' application.log.gz

# Works with multiple compressed files
zgrep -E 'ERROR|FATAL' /var/log/myapp/app.log.*.gz

# With line numbers
zgrep -n 'EXCEPTION' archive.log.gz

# Combine with regular grep for mixed compressed/uncompressed
{ zgrep 'ERROR' old.log.gz; grep 'ERROR' current.log; } | sort

# bzgrep for bzip2, xzgrep for xz-compressed files
bzgrep 'ERROR' archive.log.bz2
xzgrep 'ERROR' archive.log.xz
```

**PowerShell:**

```powershell
# Expand-Archive for .zip; for .gz use a .NET approach or external tool
# Option 1: Use 7-Zip (if installed) to decompress and pipe
& 7z e -so application.log.gz | Select-String 'ERROR'

# Option 2: .NET GZipStream
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = [System.IO.File]::OpenRead('application.log.gz')
$gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
$reader = New-Object System.IO.StreamReader($gz)
while ($null -ne ($line = $reader.ReadLine())) {
    if ($line -match 'ERROR') { Write-Output $line }
}
$reader.Close()
```

---

### Count error frequency

```bash
# Count total ERROR occurrences in a log
grep -c 'ERROR' app.log

# Count errors per type (extract the error code/class after ERROR:)
grep 'ERROR' app.log | grep -oE 'ERROR: \w+' | sort | uniq -c | sort -rn

# Count errors per minute (for spike detection)
grep 'ERROR' app.log | grep -oE '[0-9]{2}:[0-9]{2}' | sort | uniq -c

# Count errors per source file in a recursive search
grep -rc 'ERROR' /var/log/myapp/ | grep -v ':0$' | sort -t: -k2 -rn
```

**PowerShell:**

```powershell
# Count per error type
Select-String -Pattern 'ERROR' app.log |
    ForEach-Object { [regex]::Match($_.Line, 'ERROR: \w+').Value } |
    Where-Object { $_ } |
    Group-Object |
    Sort-Object Count -Descending

# Count per minute
Select-String -Pattern 'ERROR' app.log |
    ForEach-Object { [regex]::Match($_.Line, '\d{2}:\d{2}').Value } |
    Group-Object |
    Sort-Object Name
```

---

### Find files containing credential patterns

```bash
# Search for potential secrets across a codebase
grep -r 'password\|secret\|api_key\|token\|private_key' \
    --include='*.py' --include='*.yaml' --include='*.json' \
    --include='*.env' --include='*.config' . | grep -v '#'   # skip comment lines

# Looks for patterns that look like assigned secrets (not just the word)
grep -rE '(password|passwd|secret|api_key|apikey|token|auth)\s*[=:]\s*["\x27][^"\x27]{8,}' \
    --include='*.py' --include='*.js' .

# Find AWS key patterns
grep -rE 'AKIA[0-9A-Z]{16}' .

# Find private key headers
grep -rE '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' .

# Print only the filenames (not the secrets themselves) to avoid log exposure
grep -rl 'password.*=.*["\x27]' --include='*.py' .
```

**PowerShell:**

```powershell
# Find credential patterns — filenames only
Get-ChildItem -Recurse -Include *.py, *.yaml, *.json, *.config |
    Select-String -Pattern '(password|secret|api_key)\s*[=:]\s*["\x27][^"\x27]{8,}' |
    Select-Object -ExpandProperty Filename -Unique

# AWS key pattern
Get-ChildItem -Recurse | Select-String -Pattern 'AKIA[0-9A-Z]{16}' |
    Select-Object Filename, LineNumber
```

---

## Performance and Alternatives

### Fixed-string search (`grep -F` / `fgrep`)

```bash
# -F treats pattern as a fixed string — no regex interpretation
# Significantly faster when you know the exact string (no regex engine overhead)
grep -F 'SELECT * FROM orders WHERE' query_log.txt

# Useful when the pattern contains regex metacharacters you want literally
grep -F 'price * quantity' formulas.txt      # the * is literal, not a quantifier
grep -F 'error.log' file_list.txt            # the . is literal, not "any char"
grep -F '(production)' environment.txt       # parens are literal

# fgrep is identical to grep -F (deprecated name, prefer grep -F)
fgrep 'literal string' file.txt

# -F with -i for case-insensitive fixed string
grep -Fi 'select * from' query_log.txt
```

**PowerShell:**

```powershell
# -SimpleMatch flag disables regex and treats pattern as literal string
Select-String -Pattern 'SELECT * FROM orders' query_log.txt -SimpleMatch

# Case-sensitive literal match
Select-String -Pattern 'price * quantity' formulas.txt -SimpleMatch -CaseSensitive
```

---

### ripgrep (`rg`) — the modern alternative

`ripgrep` (`rg`) is a Rust-based tool that is 5–10x faster than GNU grep for recursive searches. It respects `.gitignore` by default, has better Unicode support, and provides a cleaner output format.

```bash
# Install
# Ubuntu/Debian: apt install ripgrep
# macOS: brew install ripgrep
# Windows: winget install BurntSushi.ripgrep.MSVC  (or via Scoop/Chocolatey)

# Basic usage — same syntax as grep
rg 'ERROR' app.log

# Recursive search (default — no -r flag needed)
rg 'def transform' ./pipelines/

# Case insensitive
rg -i 'error' app.log

# Fixed string (no regex)
rg -F 'literal string' file.txt

# With line numbers (on by default in rg)
rg 'FATAL' app.log

# Show only filenames
rg -l 'TODO' ./

# Count matches
rg -c 'ERROR' *.log

# Context lines
rg -C 3 'EXCEPTION' app.log

# Only matching part (like grep -o)
rg -o '[0-9]{4}-[0-9]{2}-[0-9]{2}' events.log

# File type filter (rg has built-in type definitions)
rg --type py 'import pandas' ./
rg --type sql 'CREATE TABLE' ./

# Show available types
rg --type-list | grep sql

# Ignore specific files/dirs (in addition to .gitignore)
rg 'secret' --glob '!*.test.py' --glob '!node_modules'

# Search hidden files (rg ignores hidden files by default)
rg --hidden 'password' .

# Search inside .gitignore'd files (bypasses .gitignore)
rg --no-ignore 'TODO' .

# Multiline matching
rg --multiline 'BEGIN.*\nCOMMIT' transactions.sql

# PCRE2 for advanced regex (lookahead, lookbehind)
rg -P '(?<=user=)\w+' config.ini

# Output as JSON (useful for scripting)
rg --json 'ERROR' app.log | jq '.data.lines.text // empty'
```

**ripgrep in PowerShell:**

```powershell
# rg works identically on Windows — install via winget or scoop
rg 'ERROR' app.log
rg -l 'TODO' ./src
rg --type py 'def transform' ./

# Combine with PowerShell pipeline
rg --json 'ERROR' app.log | ConvertFrom-Json | Where-Object { $_.type -eq 'match' }
```

---

### grep vs rg vs ag comparison

| Feature | `grep` | `rg` (ripgrep) | `ag` (silver searcher) |
|---|---|---|---|
| Speed (recursive) | Baseline | 5–10x faster | 3–5x faster |
| Respects `.gitignore` | No | Yes (default) | Yes (default) |
| Regex engine | BRE/ERE/PCRE | Rust regex (PCRE2 optional) | PCRE |
| Unicode support | Limited | Full | Good |
| Binary file handling | Searches (slow) | Skips (fast) | Skips |
| Install | Pre-installed everywhere | Must install | Must install |
| Parallel search | No | Yes (automatic) | Yes |
| Config file | No | `~/.ripgreprc` | `~/.agignore` |
| File type filtering | `--include` glob | `--type` named types | `--python`, etc. |
| Multiline matching | No (single-line only) | `--multiline` flag | Limited |
| PCRE2 lookahead | `grep -P` (GNU only) | `rg -P` | Yes |
| Windows support | Via Git Bash/WSL | Native | Via WSL/Cygwin |
| Output colorization | Yes | Yes (better) | Yes |

> [!tip] When to use grep vs rg
> - Use `grep` when it is already available and the task is simple (single file, small file, already in a pipe).
> - Use `rg` for any recursive codebase search — its speed and `.gitignore` awareness make it the clear choice.
> - Use `grep -F` / `rg -F` for literal string searches where regex overhead is unnecessary.
> - Use `grep -P` or `rg -P` when you need lookahead/lookbehind — but prefer `rg -P` as it works on macOS too.

---

## PowerShell Equivalents

### Complete flag comparison table

| bash `grep` flag | Description | PowerShell `Select-String` equivalent |
|---|---|---|
| (none) | Case-sensitive search | `-CaseSensitive` (default is insensitive) |
| `-i` | Case-insensitive | (default behavior — no flag needed) |
| `-v` | Invert match | `-NotMatch` |
| `-n` | Line numbers | Always shown via `.LineNumber` property |
| `-c` | Count matches | `(...).Count` |
| `-l` | Files with matches | `... \| Select-Object -ExpandProperty Filename -Unique` |
| `-L` | Files without matches | Requires set subtraction (see above) |
| `-r` / `-R` | Recursive | `Get-ChildItem -Recurse \| Select-String` |
| `-E` | Extended regex | (default — .NET regex always supports ERE features) |
| `-P` | Perl regex (PCRE) | (default — .NET regex supports lookahead/lookbehind) |
| `-F` | Fixed/literal string | `-SimpleMatch` |
| `-w` | Whole word | Use `\b` word boundary in pattern |
| `-o` | Only matching part | `.Matches.Value` on result objects |
| `-A N` | N lines after | `-Context 0,N` |
| `-B N` | N lines before | `-Context N,0` |
| `-C N` | N lines context | `-Context N,N` |
| `-f file` | Patterns from file | Build combined pattern: `(Get-Content f) -join '\|'` |
| `--include='*.py'` | Include file glob | `Get-ChildItem -Filter *.py` |
| `--exclude-dir=d` | Exclude directory | `Where-Object { $_.FullName -notmatch 'd' }` |
| `-h` | Suppress filenames | `.Line` property only |
| `-H` | Force filenames | `.Filename` property |
| `-m N` | Stop after N matches | `Select-Object -First N` |
| `-q` | Quiet (exit code only) | `[bool](Select-String ...)` |
| `-s` | Suppress error messages | `2>$null` or `-ErrorAction SilentlyContinue` |
| `-z` / `-Z` | Null-delimited | Not needed in PowerShell (objects, not text) |

---

### findstr — the legacy Windows alternative

`findstr` is the built-in Windows command-line string search tool (predates PowerShell). It is less capable than `grep` but available on every Windows system without any installation, including contexts where PowerShell is restricted.

```powershell
# Basic literal string search
findstr "ERROR" application.log

# Case-insensitive (findstr is case-insensitive by default for literal strings)
findstr /I "error" application.log

# Regular expression search (/R flag)
findstr /R "ERR[0-9][0-9]" application.log

# Recursive search through directories (/S flag)
findstr /S "password" C:\Projects\*.py

# Search multiple files with wildcard
findstr "FATAL" *.log

# Print line numbers (/N flag)
findstr /N "EXCEPTION" application.log

# Match only whole words (/W flag)
findstr /W "log" application.log

# Invert match — lines NOT containing pattern (/V flag)
findstr /V "DEBUG" application.log

# Patterns from file (/G flag)
findstr /G:patterns.txt application.log

# Literal search (no regex interpretation) (/C flag)
findstr /C:"literal string with spaces" application.log

# Show only filenames (/M flag)
findstr /S /M "api_key" C:\Projects\*.py

# Multiple search strings (must be space-separated, matches any)
findstr "ERROR FATAL CRITICAL" application.log

# Combine flags: recursive, case-insensitive, line numbers
findstr /S /I /N "password" C:\Projects\*.cfg
```

> [!tip] Prefer Select-String over findstr in modern PowerShell
> `findstr` has quirks: its regex flavor is non-standard (limited character classes, no `+` or `?` quantifiers in basic mode), and piping its output into further processing is error-prone due to encoding issues. Use `Select-String` for all PowerShell scripting. Reserve `findstr` only for `.bat` files or contexts where PowerShell is unavailable.

---

### Select-String output object structure

Understanding the `MatchInfo` object that `Select-String` returns enables powerful downstream processing.

```powershell
# Capture a result and inspect its properties
$result = Select-String -Pattern 'ERROR' app.log | Select-Object -First 1

$result.Filename        # Name of the file (without path)
$result.Path            # Full path to the file
$result.LineNumber      # Line number of the match
$result.Line            # Full text of the matching line
$result.Matches         # Collection of System.Text.RegularExpressions.Match objects
$result.Matches[0].Value       # The matched text
$result.Matches[0].Index       # Character position within the line
$result.Matches[0].Groups      # Named/numbered capture groups
$result.Context                # PreContext and PostContext lines (if -Context was used)
$result.Context.PreContext     # Array of lines before the match
$result.Context.PostContext    # Array of lines after the match

# Build a structured report from Select-String output
Select-String -Pattern '(ERROR|FATAL)' app.log |
    Select-Object Filename, LineNumber,
        @{Name='Level'; Expression={ $_.Matches[0].Value }},
        @{Name='Message'; Expression={ $_.Line.Trim() }} |
    Format-Table -AutoSize

# Export to CSV for analysis
Select-String -Pattern 'ERROR' *.log |
    Select-Object Filename, LineNumber, Line |
    Export-Csv -Path errors_report.csv -NoTypeInformation
```

---

### AllMatches — find multiple matches per line

```powershell
# By default, Select-String returns one MatchInfo per LINE (not per match)
# -AllMatches makes it capture every match within each line

$line = '192.168.1.1 GET /api/v1 200 192.168.1.2 GET /api/v2 404'

# Without -AllMatches: finds first IP only
$line | Select-String -Pattern '\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b' |
    ForEach-Object { $_.Matches.Value }
# Output: 192.168.1.1

# With -AllMatches: finds all IPs on the line
$line | Select-String -Pattern '\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b' -AllMatches |
    ForEach-Object { $_.Matches } |
    Select-Object -ExpandProperty Value
# Output: 192.168.1.1, 192.168.1.2

# Real use case: extract all table names from a SQL file (multiple per line possible)
Select-String -Pattern '\b[a-zA-Z_]\w*\.[a-zA-Z_]\w*\b' query.sql -AllMatches |
    ForEach-Object { $_.Matches.Value } |
    Sort-Object -Unique
```

---

## Quick Reference Card

### Most-used grep one-liners for data engineers

```bash
# ── Log analysis ──────────────────────────────────────────────────────────────

# Show all errors with 5 lines of context for stack traces
grep -C 5 'ERROR\|EXCEPTION' app.log

# Count errors by type, sorted by frequency
grep 'ERROR' app.log | grep -oE 'ERROR [A-Za-z]+' | sort | uniq -c | sort -rn

# Watch logs for errors in real time
tail -f app.log | grep --line-buffered -E 'ERROR|FATAL|CRITICAL'

# Find the first and last occurrence of a pattern
grep -n 'STARTED' pipeline.log | head -1   # first
grep -n 'STARTED' pipeline.log | tail -1   # last

# ── Code archaeology ──────────────────────────────────────────────────────────

# Find all TODO/FIXME/HACK comments across a project
grep -rn 'TODO\|FIXME\|HACK\|XXX\|BUG' --include='*.py' ./

# Find all functions in Python that start with 'load_'
grep -rn 'def load_' --include='*.py' ./

# Find all SQL files that reference a specific table
grep -rl 'orders' --include='*.sql' ./

# ── Data quality checks ───────────────────────────────────────────────────────

# Find CSV rows with empty fields (consecutive commas)
grep ',,' data.csv | head -20

# Find CSV rows with non-standard characters
grep -P '[^\x00-\x7F]' data.csv   # non-ASCII characters

# Find potential duplicates by looking for repeated IDs
grep -oE '^[0-9]+' records.csv | sort | uniq -d   # duplicated IDs

# ── Security audits ───────────────────────────────────────────────────────────

# Find hardcoded secrets (filenames only — don't log the secrets)
grep -rl 'password.*=.*["\x27]' --include='*.py' .

# Find AWS access keys
grep -rE 'AKIA[0-9A-Z]{16}' .

# Find open TODO security notes
grep -rn 'TODO.*security\|FIXME.*auth\|HACK.*password' .
```

```powershell
# ── PowerShell quick reference ────────────────────────────────────────────────

# Real-time error monitoring
Get-Content app.log -Wait -Tail 0 | Select-String 'ERROR|FATAL'

# Recursive code search with clean output
Get-ChildItem -Recurse -Filter *.py |
    Select-String 'def load_' |
    Select-Object Filename, LineNumber, Line

# Export error report to CSV
Select-String 'ERROR' *.log |
    Select-Object Filename, LineNumber, Line |
    Export-Csv errors.csv -NoTypeInformation

# Find files by content pattern
Get-ChildItem -Recurse -Filter *.sql |
    Select-String 'fact_sales' |
    Select-Object -ExpandProperty Filename -Unique
```

---

## Related Notes

- [[reading-file-contents]] — `cat`, `head`, `tail`, `less` for viewing files before grepping
- [[io-redirection]] — Redirect grep output to files, suppress stderr with `2>/dev/null`
- [[finding-files]] — `find` and `Get-ChildItem` to locate files before grepping
- [[command-chaining]] — Pipe grep output into `sort`, `uniq`, `wc`, `awk`, `cut`
- [[process-substitution]] — Use `<(grep ...)` to feed grep output as a file argument
- [[brace-expansion-and-globbing]] — Glob patterns for targeting multiple files in grep
- [[viewing-processes]] — `ps aux | grep` patterns for finding processes
- [[defensive-scripting]] — Handle grep exit codes (0 = match found, 1 = no match, 2 = error)

> [!info] grep exit codes matter in scripts
> `grep` returns exit code `0` if at least one match is found, `1` if no matches, and `2` on error (e.g., file not found). In bash scripts, use `if grep -q 'pattern' file; then` to branch on whether a match exists without printing output (`-q` suppresses all output). In PowerShell, `Select-String` returns `$null` when there are no matches, which is falsy — use `if (Select-String ...)` directly.
