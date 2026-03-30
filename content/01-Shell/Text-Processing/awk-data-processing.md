---
type: reference
category: shell
technology: [bash, powershell, awk]
tags: [shell, bash, linux, powershell]
aliases: [awk, gawk, mawk, field processing, column extraction, text transformation, csv processing, awk reference, awk cheatsheet, GNU awk]
keywords: [awk, gawk, mawk, field separator, record separator, NR, NF, BEGIN, END, print, printf, gsub, sub, split, substr, tolower, toupper, associative array, getline, FNR, OFS, ORS, RS, FS, pattern-action, csv parsing, log parsing, data aggregation, group-by, running total, pivot, text processing, shell scripting, PowerShell equivalent, Import-Csv, ConvertFrom-Csv, Select-Object, Where-Object, Measure-Object, ForEach-Object, data engineering, ETL, column extraction, delimiter conversion, TSV, pipe-delimited]
description: "Exhaustive awk/gawk reference for data engineers covering field extraction, filtering, aggregation, string functions, multi-file processing, advanced patterns, and PowerShell equivalents for every key technique."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# awk Data Processing Reference

> [!quote]
> "The goal was to see how much of programming we could stuff into one line."
> — **Brian Kernighan** (co-creator of awk)

awk (also gawk -- GNU awk, mawk -- faster awk) is a domain-specific language built for column-oriented text processing. It reads input record by record (lines by default), splits each record into fields, and applies pattern-action rules. For data engineers it is the fastest path from raw text files, logs, and CSVs to structured output without writing a full Python script.
> [!info] Which awk are you running?
>
> On macOS the default `awk` is BSD awk. On Linux it is usually gawk. On Windows you use PowerShell natively or install gawk via Chocolatey (`choco install gawk`) or Git Bash. All examples below work in gawk. BSD awk differences are noted inline.

---

## How awk Works

### Record and Field Model

awk reads input one **record** at a time. By default a record is a line. It then splits the record into **fields** using the field separator.

| Variable | Meaning                                      |
|----------|----------------------------------------------|
| `$0`     | The entire current record (the whole line)   |
| `$1`     | First field                                  |
| `$2`     | Second field                                 |
| `$NF`    | Last field (NF = number of fields)           |
| `$(NF-1)`| Second-to-last field                         |
| `NR`     | Current record number (global, across files) |
| `NF`     | Number of fields in the current record       |
| `FNR`    | Record number within the current file        |
| `FS`     | Input field separator (default: whitespace)  |
| `OFS`    | Output field separator (default: space)      |
| `RS`     | Input record separator (default: newline)    |
| `ORS`    | Output record separator (default: newline)   |

#### awk $0, $1, $2 — print whole line and specific fields
```bash
# $0 = full line, $1 = first whitespace-delimited token, $2 = second
echo "alice 42 engineer" | awk '{print $0}'    # alice 42 engineer
echo "alice 42 engineer" | awk '{print $1}'    # alice
echo "alice 42 engineer" | awk '{print $1,$2}' # alice 42
```

#### awk $NF, $(NF-1) — access last field regardless of column count
```bash
# $NF always resolves to the last field
echo "a b c d e" | awk '{print $NF}'    # e
echo "a b c d e" | awk '{print $(NF-1)}' # d
```

### Default Field Separator (Whitespace)

Without `-F`, awk treats any run of whitespace (spaces and tabs) as a single separator and trims leading/trailing whitespace. This makes it ideal for parsing `ps`, `df`, `ls -l`, and other command output.

```bash
# Consecutive spaces are treated as ONE separator — no empty fields
echo "  a   b   c  " | awk '{print NF}' # 3, not 8
```

### Setting the Field Separator with -F

```bash
# -F sets the input field separator
awk -F','  '{print $2}' data.csv      # comma-separated
awk -F'\t' '{print $3}' data.tsv      # tab-separated
awk -F'|'  '{print $1}' data.psv      # pipe-separated
awk -F':'  '{print $1}' /etc/passwd   # colon-separated

# FS can also be a regex
awk -F'[,;|]' '{print $2}' mixed.txt  # any of comma, semicolon, pipe
```

### Pattern-Action Structure

The fundamental awk program is a series of `pattern { action }` rules. awk evaluates every pattern against every record, and executes the action if the pattern matches.

```
awk 'pattern1 { action1 }
     pattern2 { action2 }
     pattern3 { action3 }' file
```

- If **pattern** is omitted, the action runs on every record.
- If **action** is omitted, the default action is `{print $0}`.
- Multiple rules can match the same record; all matching actions execute.

```bash
# Pattern only — print lines matching a regex
awk '/ERROR/'  app.log

# Action only — print field 1 for every line
awk '{print $1}' data.txt

# Pattern + action
awk '/ERROR/ {print NR, $0}' app.log

# Multiple rules
awk '/ERROR/ {errors++} /WARN/ {warns++} END {print errors, warns}' app.log
```

### BEGIN and END Blocks

`BEGIN` runs once before any input is read. `END` runs once after all input is consumed.

```bash
# BEGIN: print header; END: print summary
awk -F',' '
  BEGIN {
    print "Name,Total"                 # header
    OFS=","
  }
  NR > 1 {                             # skip header row
    total += $3
  }
  END {
    print "Grand total:", total        # summary after all rows
  }
' sales.csv
```

> [!tip] Embed multi-line awk programs
>
> For programs longer than one line, use single quotes on the command line or put the program in a file and invoke `awk -f program.awk data.txt`. For complex logic, `-f` is much more maintainable.

---

## Field Extraction and Formatting

### Print Specific Columns

```bash
# Print columns 1 and 3 (space-separated by default)
awk '{print $1, $3}' data.txt

# Print columns 1 and 3 with a custom literal separator
awk '{print $1 "|" $3}' data.txt

# Print column 2 from a CSV
awk -F',' '{print $2}' data.csv

# Skip the header row and print column 2
awk -F',' 'NR>1 {print $2}' data.csv
```

### Custom Output Field Separator (OFS)

```bash
# Change OFS so commas in output become tabs
awk -F',' -v OFS='\t' '{print $1,$3}' data.csv

# Rebuild $0 with a new separator by assigning any field
# Assigning $1=$1 forces awk to rebuild $0 using OFS
awk -F',' -v OFS='|' '{$1=$1; print}' data.csv

# Convert CSV to TSV (all columns)
awk -F',' -v OFS='\t' '{$1=$1; print}' data.csv > data.tsv
```

> [!warning] OFS and $0
>
> Printing `$0` always gives the original line, even if you set OFS. You must trigger a field rebuild by assigning any `$N = $N` or `$1=$1` before printing `$0` if you want OFS applied to the whole record.

### Printf for Formatted Output

`printf` works identically to C's printf. Use it when you need aligned columns, specific decimal places, or custom line endings.

```bash
# Format: left-aligned name (20 chars wide), right-aligned float (10 wide, 2 decimal)
awk '{printf "%-20s %10.2f\n", $1, $3}' data.txt

# Right-align integers in 8-char column
awk '{printf "%8d\n", $2}' counts.txt

# Print with no trailing newline (useful when piping)
awk '{printf "%s\t%s", $1, $2}' data.txt

# Print a CSV row with quoted string fields
awk -F',' '{printf "\"%s\",%s,\"%s\"\n", $1, $2, $3}' data.csv
```

#### awk printf format specifiers — %s, %d, %f, %-10s

| Specifier | Meaning                        |
|-----------|--------------------------------|
| `%s`      | String                         |
| `%d`      | Integer                        |
| `%f`      | Float                          |
| `%e`      | Scientific notation            |
| `%g`      | Shorter of `%f` or `%e`       |
| `%-20s`   | Left-aligned, 20 chars wide    |
| `%10.2f`  | 10 wide, 2 decimal places      |
| `%08d`    | Zero-padded to 8 digits        |

### Reorder Columns

```bash
# Input: name,date,amount — output: date,amount,name
awk -F',' -v OFS=',' '{print $2,$3,$1}' data.csv

# Reorder and add a literal new column
awk -F',' -v OFS=',' '{print $1,$3,"NEW_COL",$2}' data.csv

# Swap first and second columns in a TSV
awk -F'\t' -v OFS='\t' '{print $2,$1,$3,$4}' data.tsv
```

### Extract a Range of Fields

```bash
# Print fields 2 through 5 (awk has no built-in range, so loop)
awk '{for(i=2;i<=5;i++) printf "%s%s",$i,(i<5?OFS:ORS)}' data.txt

# Print all fields from field 3 onward
awk '{for(i=3;i<=NF;i++) printf "%s%s",$i,(i<NF?OFS:ORS)}' data.txt

# Print all except the first field (useful for removing a prefix)
awk '{$1=""; print}' data.txt  # note: leaves a leading space
awk '{$1=""; sub(/^ /,""); print}' data.txt  # trim the leading space
```

---

## Filtering and Conditions

### Pattern Matching (Regex)

```bash
# Print lines containing "ERROR"
awk '/ERROR/ {print}' app.log

# Shorter — default action is print
awk '/ERROR/' app.log

# Case-insensitive match (gawk)
awk 'tolower($0) ~ /error/' app.log

# Negate pattern — lines NOT matching
awk '!/ERROR/' app.log

# Match multiple patterns (OR)
awk '/ERROR|FATAL/' app.log

# Match exact word (word boundary via regex)
awk '/\bERROR\b/' app.log
```

### Field Conditions

```bash
# Numeric comparison on field 3
awk -F',' '$3 > 100 {print}' data.csv

# String equality on field 4
awk -F',' '$4 == "ACTIVE" {print}' data.csv

# Field 2 is not empty
awk -F',' '$2 != "" {print}' data.csv

# Multiple conditions (AND)
awk -F',' '$3 > 100 && $4 == "ACTIVE" {print}' data.csv

# Multiple conditions (OR)
awk -F',' '$3 < 0 || $3 > 1000 {print}' data.csv

# Field 1 matches a regex
awk -F',' '$1 ~ /^the data pipeline project/ {print}' data.csv

# Field 1 does NOT match a regex
awk -F',' '$1 !~ /^the data pipeline project/ {print}' data.csv
```

### Range Patterns

Range patterns match from the first record where pattern1 matches to the first record where pattern2 matches (inclusive).

```bash
# Print lines between START and END markers
awk '/START/,/END/' data.txt

# Print everything between two timestamps in a log
awk '/2026-03-22 08:00/,/2026-03-22 09:00/' app.log

# Range pattern with an action
awk '/BEGIN_BLOCK/,/END_BLOCK/ {print NR, $0}' data.txt
```

### NR and NF Based Filtering

```bash
# Skip header line (first record)
awk 'NR > 1 {print}' data.csv

# Print only the first 10 lines (like head)
awk 'NR <= 10' data.txt

# Print lines 5 through 15
awk 'NR>=5 && NR<=15' data.txt

# Print every other line (odd lines)
awk 'NR % 2 == 1' data.txt

# Skip lines with fewer than 3 fields (malformed rows)
awk 'NF >= 3 {print}' data.csv

# Print lines where field count equals exactly 5
awk 'NF == 5' data.csv
```

### Combined Pattern Examples

```bash
# Lines in a CSV where column 3 is numeric AND > 500, skipping header
awk -F',' 'NR>1 && $3+0 > 500 {print $1, $3}' data.csv

# Log lines that contain "PIPELINE" and where field 5 > 60 (duration seconds)
awk '/PIPELINE/ && $5 > 60 {print NR, $0}' pipeline.log

# First 20 CSV rows where status field (col 2) is "FAILED"
awk -F',' 'NR>1 && $2=="FAILED" && NR<=21' jobs.csv
```

> [!tip] Numeric vs string comparison
>
> In awk, `$3 > 100` does numeric comparison if `$3` looks like a number. `$3 > "100"` forces string comparison. This is usually intuitive but can surprise you with zero-padded strings like "007" vs "07".

---

## Data Transformation

### Arithmetic Operations

```bash
# Multiply field 2 by 100 (e.g., convert fraction to percentage)
awk '{print $1, $2 * 100}' data.txt

# Add two fields
awk -F',' '{print $1, $2 + $3}' data.csv

# Compute derived field: margin = (revenue - cost) / revenue
awk -F',' 'NR>1 {margin=($3-$4)/$3*100; printf "%s %.2f%%\n", $1, margin}' data.csv

# Integer division and modulo
awk '{print int($1/60), $1%60}' seconds.txt   # convert seconds to min:sec
```

### String Functions

```bash
# length() — number of characters in a string
awk '{print length($1), $1}' data.txt

# substr(string, start, length) — substring (1-indexed)
awk '{print substr($1, 1, 3)}' data.txt        # first 3 chars
awk '{print substr($1, 4)}' data.txt           # from char 4 to end
awk -F',' '{print substr($2, 1, 10)}' data.csv # truncate date to 10 chars

# index(string, target) — find position of target in string (0 = not found)
awk '{pos=index($1,"@"); if(pos>0) print substr($1,1,pos-1)}' emails.txt

# split(string, array, separator) — split a field into an array
awk '{n=split($1,a,"-"); print a[1], a[2], a[3]}' dates.txt  # split 2026-03-22

# sub(regex, replacement, target) — replace first occurrence in target
awk '{sub(/ERROR/, "CRITICAL", $0); print}' app.log

# gsub(regex, replacement, target) — replace ALL occurrences
awk '{gsub(/,/, "\t"); print}' data.csv          # CSV to TSV via gsub
awk '{gsub(/ /, "_", $1); print}' data.txt       # spaces to underscores in field 1
awk 'gsub(/\r/, "")' dos.txt                     # remove Windows carriage returns

# tolower() / toupper()
awk '{print tolower($0)}' data.txt
awk '{print toupper($1)}' data.txt
awk -F',' '{print $1, toupper($2)}' data.csv
```

> [!warning] sub() and gsub() target parameter
>
> If you omit the third argument, `sub()` and `gsub()` operate on `$0`. To modify a specific field, pass it as the third argument: `gsub(/x/, "y", $3)`. Remember that modifying `$0` or a field triggers a full record rebuild.

### Computing Aggregates

```bash
# Sum of field 3
awk -F',' '{sum+=$3} END {print "Total:", sum}' data.csv

# Count records (like wc -l but field-condition-aware)
awk -F',' '$4=="ACTIVE" {count++} END {print count}' data.csv

# Average of field 2
awk '{sum+=$2; count++} END {print "Average:", sum/count}' data.txt

# Min and max of field 3
awk -F',' 'NR==2{min=max=$3} NR>1{if($3<min) min=$3; if($3>max) max=$3} END{print "Min:", min, "Max:", max}' data.csv

# Count + sum + average in one pass
awk -F',' 'NR>1 {
  sum += $3
  count++
  if (count==1 || $3<min) min=$3
  if (count==1 || $3>max) max=$3
}
END {
  print "Count:", count
  print "Sum:", sum
  print "Avg:", sum/count
  print "Min:", min
  print "Max:", max
}' data.csv
```

### Running Totals and Cumulative Sums

```bash
# Print cumulative sum alongside each row
awk -F',' '{cumsum+=$3; print $0, cumsum}' OFS=',' data.csv

# Running average (rolling mean)
awk '{sum+=$1; printf "%.4f\n", sum/NR}' values.txt

# Percent of total (two-pass: first pass computes total, second prints percentages)
awk -F',' '{sum+=$3} END{print sum}' data.csv  # pass 1: get total
awk -F',' -v total=12345 '{printf "%s %.2f%%\n", $1, $3/total*100}' data.csv  # pass 2
```

### Group-By Operations

```bash
# Sum of field 3 grouped by field 1 (like SQL: SELECT field1, SUM(field3) GROUP BY field1)
awk -F',' 'NR>1 {sum[$1]+=$3} END {for(k in sum) print k, sum[k]}' data.csv

# Count per group
awk -F',' 'NR>1 {count[$2]++} END {for(k in count) print k, count[k]}' data.csv

# Average per group
awk -F',' 'NR>1 {
  sum[$1]+=$3
  cnt[$1]++
}
END {
  for(k in sum) printf "%s %.4f\n", k, sum[k]/cnt[k]
}' data.csv

# Min/Max per group
awk -F',' 'NR>1 {
  if(!($ 1 in mn) || $3<mn[$1]) mn[$1]=$3
  if(!($1 in mx) || $3>mx[$1]) mx[$1]=$3
}
END {
  for(k in mn) print k, mn[k], mx[k]
}' data.csv

# Multiple aggregations per group (count, sum, avg)
awk -F',' 'NR>1 {
  grp=$1
  sum[grp]+=$3
  cnt[grp]++
}
END {
  print "group,count,sum,avg"
  for(k in sum) printf "%s,%d,%.2f,%.4f\n", k, cnt[k], sum[k], sum[k]/cnt[k]
}' data.csv

# Sort the group-by output (pipe to sort)
awk -F',' 'NR>1 {sum[$1]+=$3} END {for(k in sum) print k, sum[k]}' data.csv | sort -k2 -rn
```

> [!tip] Associative array order
>
> In awk, `for(k in array)` does NOT guarantee any specific order. Pipe to `sort` when order matters. In gawk 4+ you can use `PROCINFO["sorted_in"] = "@ind_str_asc"` for sorted iteration.

### Pivot-Like Operations (Crosstab)

```bash
# Pivot: rows are field 1, columns are field 2, values are sum of field 3
# Input: product,region,sales → output: product east west north
awk -F',' 'NR>1 {
  pivot[$1][$2]+=$3        # gawk supports multi-dim arrays
  cols[$2]=1
  rows[$1]=1
}
END {
  # print header
  printf "Product"
  for(c in cols) printf ",%s", c
  print ""
  # print rows
  for(r in rows) {
    printf "%s", r
    for(c in cols) printf ",%s", pivot[r][c]+0
    print ""
  }
}' sales.csv
```

> [!info] Multi-dimensional arrays
>
> gawk supports true multi-dimensional arrays with `array[i][j]`. POSIX awk simulates them with `array[i,j]` (uses SUBSEP as key separator). For portability, use `array[i,j]` and split with `split(key, parts, SUBSEP)`.

---

## Data Engineering Scenarios

### Parse CSV Files

```bash
# Simple CSV (no quoted fields containing commas)
awk -F',' 'NR>1 {print $1, $3}' data.csv

# Strip leading/trailing whitespace from every field
awk -F',' '{
  for(i=1;i<=NF;i++) {
    gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i)  # trim each field
  }
  print
}' data.csv

# Replace empty fields with a placeholder
awk -F',' '{
  for(i=1;i<=NF;i++) if($i=="") $i="NULL"
  print
}' OFS=',' data.csv
```

> [!warning] Quoted fields with commas
>
> awk's `-F','` splits on every literal comma, including ones inside quoted fields like `"Smith, John"`. For proper RFC 4180 CSV parsing, use Python's `csv` module, `csvkit`, or `miller` (`mlr`). For simple CSVs without embedded commas, awk is fine.

### Extract Columns from `docker ps` Output

```bash
# docker ps output is fixed-width with spaces — use awk's default whitespace split
docker ps | awk 'NR>1 {print $1, $NF}'    # container ID and name

# Get running containers that use more than 200 MB memory
docker stats --no-stream | awk 'NR>1 && $4~/[0-9]/ {
  mem=$4
  gsub(/MiB/,"",mem)
  if(mem+0 > 200) print $2, $4     # name, memory usage
}'

# Extract image names from docker ps
docker ps --format '{{.Image}}\t{{.Names}}' | awk -F'\t' '{print $1}'
```

### Parse `ps aux` to Find Memory-Heavy Processes

```bash
# ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
# Find processes using more than 5% memory, sorted by memory desc
ps aux | awk 'NR>1 && $4>5 {print $4, $1, $11}' | sort -rn

# Sum memory usage by user
ps aux | awk 'NR>1 {mem[$1]+=$4} END {for(u in mem) printf "%.1f %s\n", mem[u], u}' | sort -rn

# List the top 10 processes by CPU
ps aux | awk 'NR>1 {print $3, $1, $11}' | sort -rn | head -10
```

### Transform Log Timestamps

```bash
# Log line: 2026-03-22T08:15:32Z INFO pipeline started
# Extract and reformat: 2026-03-22 08:15:32
awk '{
  ts=$1
  gsub(/T/," ",ts)  # replace T with space
  gsub(/Z/,"",ts)   # remove trailing Z
  print ts, $2, $3, $4
}' app.log

# Extract hour from timestamp for hourly bucketing
awk '{
  split($1, t, /[T:]/)  # split on T or :
  hour=t[2]             # t[2] is the hour component
  counts[hour]++
}
END {
  for(h in counts) print h, counts[h]
}' app.log | sort -n
```

### Calculate Pipeline Execution Duration from Logs

```bash
# Log format: TIMESTAMP PIPELINE_NAME STATUS
# START and END events pair up by pipeline name
awk '{
  name=$2; ts=$1; status=$3
  if(status=="START") start[name]=ts
  if(status=="END" && name in start) {
    # assumes timestamps are seconds-since-epoch (use date +%s for real logs)
    duration=ts - start[name]
    print name, duration "s"
    delete start[name]
  }
}' pipeline.log

# Calculate duration between two ISO timestamps using shell date (gawk extension)
awk '{
  cmd="date -d \"" $1 "\" +%s"
  cmd | getline epoch_start; close(cmd)
  cmd="date -d \"" $2 "\" +%s"
  cmd | getline epoch_end; close(cmd)
  print $3, epoch_end - epoch_start, "seconds"
}' durations.txt
```

### Generate SQL INSERT Statements from CSV

```bash
# Input CSV: id,name,amount (with header)
# Output: INSERT INTO sales (id,name,amount) VALUES (1,'Alice',500.00);
awk -F',' '
NR==1 {
  # capture header for column names
  cols=$0
  next
}
{
  printf "INSERT INTO sales (%s) VALUES (%s,'"'"'%s'"'"',%.2f);\n", cols, $1, $2, $3
}' data.csv

# Simpler version for known columns
awk -F',' 'NR>1 {
  printf "INSERT INTO sales VALUES (%d, '"'"'%s'"'"', %.2f);\n", $1, $2, $3
}' data.csv
```

### Aggregate Daily Row Counts from Pipeline Logs

```bash
# Log: 2026-03-22T08:15:32Z LOAD table_name 5000 rows
# Goal: sum rows loaded per day per table
awk '{
  split($1, dt, "T")   # extract date part before T
  day=dt[1]
  table=$3
  rows=$4
  daily[day][table]+=rows
}
END {
  for(d in daily)
    for(t in daily[d])
      print d, t, daily[d][t]
}' pipeline.log | sort
```

### Parse JSON-Like Key=Value Pairs

```bash
# Input: key1=val1 key2=val2 key3=val3 (common in structured logs)
# Extract value for a specific key
awk '{
  for(i=1;i<=NF;i++) {
    split($i, kv, "=")  # split each token on =
    if(kv[1]=="status") print kv[2]
  }
}' structured.log

# Build a key-value map for each record
awk '{
  for(i=1;i<=NF;i++) {
    n=split($i, kv, "=")
    if(n==2) kv_map[kv[1]]=kv[2]
  }
  print kv_map["user"], kv_map["action"], kv_map["duration"]
  delete kv_map  # reset for next line
}' structured.log
```

### Detect Duplicate Rows

```bash
# Detect exact duplicate lines (print only duplicates)
awk 'seen[$0]++ == 1 {print "DUPLICATE:", $0}' data.txt

# Count occurrences of each line
awk '{count[$0]++} END {for(line in count) if(count[line]>1) print count[line], line}' data.txt

# Find duplicate values in column 1 of a CSV
awk -F',' 'NR>1 {count[$1]++} END {for(k in count) if(count[k]>1) print k, count[k]}' data.csv

# Remove duplicates (keep first occurrence)
awk '!seen[$0]++' data.txt

# Remove duplicates by key column 1 (keep first occurrence of each key)
awk -F',' '!seen[$1]++' data.csv
```

### Summarize Disk Usage by Directory

```bash
# du -s output: size  path
# Sum sizes by top-level directory
du -sk /data/* | awk '{
  split($2, parts, "/")  # split path on /
  dir=parts[3]           # third segment = top-level dir name
  total[dir]+=$1
}
END {
  for(d in total) printf "%10d KB  %s\n", total[d], d
}' | sort -rn

# Find directories over 1 GB (1048576 KB)
du -sk /* 2>/dev/null | awk '$1 > 1048576 {print $2, int($1/1048576) "GB"}'
```

### Convert Between Delimiters

```bash
# CSV to TSV
awk -F',' -v OFS='\t' '{$1=$1; print}' data.csv > data.tsv

# TSV to pipe-delimited
awk -F'\t' -v OFS='|' '{$1=$1; print}' data.tsv > data.psv

# Pipe-delimited to CSV
awk -F'|' -v OFS=',' '{$1=$1; print}' data.psv > data.csv

# Remove all double quotes (useful for cleaning CSV before awk processing)
awk -F',' '{gsub(/"/, ""); print}' quoted.csv

# Handle Windows CRLF line endings (remove \r)
awk '{gsub(/\r/, ""); print}' windows.csv
```

---

## Advanced awk

### Associative Arrays (Dictionaries)

Associative arrays are the most powerful feature for data engineering use cases. Keys are always strings; awk auto-creates array entries on first access.

```bash
# Basic: count occurrences of each value in column 1
awk '{count[$1]++} END {for(k in count) print k, count[k]}' data.txt

# Check if a key exists before accessing it
awk '{if($1 in myarray) print "exists"; else myarray[$1]=1}' data.txt

# Delete a key
awk '{delete myarray[$1]}' data.txt

# Delete entire array
awk 'END {delete myarray}' data.txt

# Build a lookup table from file1, apply it to file2
awk -F',' '
  FNR==NR {lookup[$1]=$2; next}  # load file1 into lookup table
  {print $0, lookup[$1]}          # for file2 rows, append lookup value
' lookup.csv data.csv

# Simulate a SET (track unique values)
awk -F',' '{seen[$1]=1} END {print length(seen), "unique values"}' data.csv
```

### Multi-File Processing: FNR vs NR

```bash
# NR = global record number (keeps incrementing across files)
# FNR = per-file record number (resets to 1 for each new file)

# Process file1 and file2 differently using FNR==NR trick
awk '
  FNR==NR {                # this block runs ONLY for the first file
    lookup[$1]=$2
    next                   # skip the second block for first file
  }
  {                        # this block runs for all subsequent files
    print $0, lookup[$1]
  }
' file1.csv file2.csv

# Print filename with each record using FILENAME built-in
awk '{print FILENAME, FNR, $0}' file1.txt file2.txt

# Process a header from each file independently
awk 'FNR==1 {print "=== " FILENAME " ==="}; FNR>1 {print}' *.csv
```

### Getline (Reading from Files or Commands Within awk)

```bash
# Read next line from input explicitly
awk '/START/ {getline nextline; print "After START:", nextline}' data.txt

# Read a specific file inside awk
awk 'BEGIN {
  while((getline line < "config.txt") > 0) {
    split(line, kv, "=")
    config[kv[1]]=kv[2]
  }
  close("config.txt")
}
{print $0, config["timezone"]}' data.txt

# Execute a shell command and capture output
awk '{
  cmd="date -d \"" $1 "\" +%Y-%m-%d"
  cmd | getline formatted_date
  close(cmd)
  print formatted_date, $2
}' timestamps.txt
```

> [!warning] Getline and shell injection
>
> When using `getline` with dynamically constructed shell commands, sanitize any user-controlled input to prevent shell injection. Prefer to pre-process with shell pipelines when possible.

### Custom Record Separator (RS)

```bash
# Process paragraph-delimited records (blank line = record separator)
awk 'BEGIN{RS=""} {print NR, NF, $0}' paragraphs.txt

# Process records separated by "---"
awk 'BEGIN{RS="---"} {print NR, $0}' data.txt

# Process a file where records are delimited by a specific marker line
awk 'BEGIN{RS="RECORD_DELIMITER\n"} NR>1{print "Record:", NR-1, $0}' data.txt

# Multi-character RS (gawk only — POSIX awk only supports single-char RS)
awk 'BEGIN{RS="\n\n+"} {print "Block", NR}' data.txt  # one or more blank lines
```

### OFMT for Numeric Formatting

```bash
# OFMT controls the format when awk auto-converts numbers to strings via print
awk 'BEGIN{OFMT="%.4f"} {x=$1+0; print x}' data.txt

# CONVFMT controls intermediate string conversions
awk 'BEGIN{CONVFMT="%.2f"} {x=$1+0; a[x]=1; for(k in a) print k}' data.txt

# Explicit formatting is more predictable — prefer printf over OFMT
awk '{printf "%.6f\n", $1}' data.txt
```

### Executing Shell Commands with system()

```bash
# Execute a shell command from within awk (output goes to stdout)
awk '{system("mkdir -p /data/" $1)}' dirs.txt

# system() returns the exit code
awk '{
  ret=system("test -f " $1)
  if(ret==0) print $1, "exists"
  else print $1, "MISSING"
}' filelist.txt

# Pipe output from awk into a shell command per-line (print | "command")
awk '{print $1, $2 | "sort -k2 -rn > output.txt"}' data.txt
# Note: the pipe stays open until closed or awk exits — close explicitly when looping
awk '{print | "tee -a output.txt"}' data.txt

# Close a pipe to flush and reset it within a loop
awk '{
  print | "gzip > chunk_" NR ".gz"
  if(NR%1000==0) close("gzip > chunk_" NR ".gz")
}' bigfile.txt
```

### Practical: Put awk Program in a File

```bash
# program.awk — group-by aggregation script
# Usage: awk -F',' -f program.awk data.csv

# program.awk:
BEGIN {
    OFS=","
    print "category,count,total,avg"
}
NR > 1 {
    cat=$1
    val=$3+0
    sum[cat]+=val
    cnt[cat]++
}
END {
    for(c in sum)
        printf "%s,%d,%.2f,%.4f\n", c, cnt[c], sum[c], sum[c]/cnt[c]
}
```

```bash
# Run it
awk -F',' -f program.awk data.csv | sort -t',' -k3 -rn
```

---

## PowerShell Equivalents

PowerShell's pipeline model is object-based rather than text-based, which makes many awk patterns more verbose but also type-safe and composable with .NET.

### Field Extraction

**awk:** Print columns 1 and 3 from a CSV.
```bash
awk -F',' '{print $1,$3}' data.csv
```

#### PowerShell Import-Csv + Select-Object — field extraction
```powershell
# Import-Csv parses the header row and creates objects with named properties
Import-Csv data.csv | Select-Object Column1, Column3

# If columns have no header, use ConvertFrom-Csv with explicit headers
Get-Content data.csv | ConvertFrom-Csv -Header id,name,amount | Select-Object id, amount

# Raw split approach (mirrors awk field splitting)
Get-Content data.csv | ForEach-Object {
    $fields = $_ -split ','          # -split operator, equivalent to FS
    "$($fields[0]),$($fields[2])"   # fields are 0-indexed in PowerShell
}
```

### Filtering Rows

**awk:** Print rows where column 3 > 100.
```bash
awk -F',' '$3 > 100 {print}' data.csv
```

#### PowerShell Where-Object — filtering rows
```powershell
Import-Csv data.csv | Where-Object { [int]$_.amount -gt 100 }

# String-based approach with -split
Get-Content data.csv | Where-Object {
    $f = $_ -split ','
    [double]$f[2] -gt 100
}
```

### Counting and Aggregation

**awk:** Count records matching a condition.
```bash
awk -F',' '$4=="ACTIVE" {count++} END {print count}' data.csv
```

#### PowerShell Measure-Object — counting and aggregation
```powershell
(Import-Csv data.csv | Where-Object { $_.status -eq 'ACTIVE' }).Count

# Measure-Object for numeric aggregation
Import-Csv data.csv | Measure-Object -Property amount -Sum -Average -Minimum -Maximum
```

### Group-By

**awk:** Sum of field 3 grouped by field 1.
```bash
awk -F',' 'NR>1 {sum[$1]+=$3} END {for(k in sum) print k, sum[k]}' data.csv
```

#### PowerShell Group-Object — group-by aggregation
```powershell
Import-Csv data.csv |
    Group-Object -Property category |
    ForEach-Object {
        [PSCustomObject]@{
            Category = $_.Name
            Total    = ($_.Group | Measure-Object -Property amount -Sum).Sum
            Count    = $_.Count
        }
    }
```

### String Transformation

**awk:** Uppercase field 2.
```bash
awk -F',' '{print $1, toupper($2)}' data.csv
```

#### PowerShell Select-Object @{Expression} — string transformation
```powershell
Import-Csv data.csv | Select-Object id, @{Name='name'; Expression={ $_.name.ToUpper() }}
```

### Adding Calculated Columns

**awk:** Add a margin column.
```bash
awk -F',' 'NR>1 {margin=($3-$4)/$3*100; printf "%s,%.2f\n", $1, margin}' data.csv
```

#### PowerShell calculated properties — adding computed columns
```powershell
Import-Csv data.csv | Select-Object name, @{
    Name       = 'margin_pct'
    Expression = { [math]::Round(([double]$_.revenue - [double]$_.cost) / [double]$_.revenue * 100, 2) }
}
```

### Removing Duplicates

**awk:** Remove duplicate lines.
```bash
awk '!seen[$0]++' data.txt
```

#### PowerShell Select-Object -Unique — removing duplicates
```powershell
Get-Content data.txt | Select-Object -Unique

# Deduplicate CSV by key column
Import-Csv data.csv | Sort-Object id -Unique
```

### Generating SQL Inserts

**awk:** Generate INSERT statements from CSV.
```bash
awk -F',' 'NR>1 {printf "INSERT INTO t VALUES (%d,'"'"'%s'"'"',%.2f);\n", $1,$2,$3}' data.csv
```

#### PowerShell ForEach-Object — generating SQL INSERT statements
```powershell
Import-Csv data.csv | ForEach-Object {
    "INSERT INTO t VALUES ($($_.id), '$($_.name)', $([math]::Round([double]$_.amount, 2)));"
}
```

### Delimiter Conversion

**awk:** CSV to TSV.
```bash
awk -F',' -v OFS='\t' '{$1=$1; print}' data.csv
```

#### PowerShell Export-Csv -Delimiter — delimiter conversion
```powershell
# Using Import-Csv then Export-Csv with tab delimiter
Import-Csv data.csv | Export-Csv -NoTypeInformation -Delimiter "`t" output.tsv

# String replace approach
Get-Content data.csv | ForEach-Object { $_ -replace ',', "`t" } | Set-Content output.tsv
```

### Quick Pattern Comparisons

```bash
# awk: skip header
awk 'NR>1' data.csv

# awk: print every Nth line (every 5th)
awk 'NR%5==0' data.txt

# awk: print last field
awk '{print $NF}' data.txt

# awk: count unique values in col 1
awk -F',' '!seen[$1]++ {count++} END {print count}' data.csv

# awk: sum col 3 where col 4 = "X"
awk -F',' '$4=="X" {sum+=$3} END {print sum}' data.csv
```

```powershell
# PS: skip header (Import-Csv handles it automatically)
Import-Csv data.csv

# PS: print every 5th line
Get-Content data.txt | Where-Object { [array]::IndexOf((Get-Content data.txt), $_) % 5 -eq 4 }
# Better approach for large files:
$i=0; Get-Content data.txt | ForEach-Object { $i++; if($i % 5 -eq 0) { $_ } }

# PS: print last field (split and take last)
Get-Content data.txt | ForEach-Object { ($_ -split '\s+')[-1] }

# PS: count unique values in col 1
(Import-Csv data.csv | Select-Object -ExpandProperty Column1 -Unique).Count

# PS: sum col 3 where col 4 = "X"
(Import-Csv data.csv | Where-Object { $_.status -eq 'X' } | Measure-Object -Property amount -Sum).Sum
```

### Comparison Table: awk vs PowerShell

| Task | awk | PowerShell |
|------|-----|------------|
| Parse CSV | `awk -F','` | `Import-Csv` |
| Filter rows | `$3 > 100 {print}` | `Where-Object { [int]$_.col -gt 100 }` |
| Select columns | `{print $1,$3}` | `Select-Object col1, col3` |
| Count rows | `END {print NR}` | `Measure-Object` / `.Count` |
| Sum a column | `{sum+=$3} END{print sum}` | `Measure-Object -Sum` |
| Group-by | Associative array | `Group-Object` |
| Add calc column | `{print $1, $2*$3}` | `Select-Object` with `@{Name=...; Expression={...}}` |
| Dedup rows | `!seen[$0]++` | `Select-Object -Unique` |
| String replace | `gsub(/x/,"y")` | `-replace 'x','y'` |
| Uppercase | `toupper($1)` | `$_.col.ToUpper()` |
| Convert delimiters | `awk -F',' OFS='\t' '{$1=$1;print}'` | `Import-Csv | Export-Csv -Delimiter` |
| Run per 100 rows | `NR%100==0 {print}` | `Where-Object { $i++ % 100 -eq 0 }` |
| Join two files | `FNR==NR` trick | `Join-Object` module or hash table lookup |
| Write to file | `print > "out.txt"` | `| Out-File` / `| Set-Content` |

---

## Quick Reference Card

### One-Liners for Data Engineering

```bash
# Print the Nth column of a file
awk '{print $N}' file                        # replace N with column number

# Count lines matching a pattern
awk '/PATTERN/ {c++} END {print c}' file

# Print lines longer than 100 characters
awk 'length > 100' file

# Print duplicate lines only (second and subsequent occurrences)
awk 'seen[$0]++ > 0' file

# Remove blank lines
awk 'NF > 0' file

# Print line numbers with content
awk '{print NR": "$0}' file

# Sum the numbers in a single-column file
awk '{s+=$1} END{print s}' file

# Divide each number by 1024 (bytes to KB)
awk '{print $1/1024, "KB"}' file

# Print first and last field of a CSV
awk -F',' '{print $1, $NF}' file

# Extract lines 100-200 from a large file
awk 'NR>=100 && NR<=200' file

# Find the maximum value in column 2
awk 'NR==1{max=$2} $2>max{max=$2} END{print max}' file

# Print fields in reverse order
awk '{for(i=NF;i>=1;i--) printf "%s%s",$i,(i>1?OFS:ORS)}' file

# Transpose: rows become columns (for small files)
awk '{for(i=1;i<=NF;i++) row[i]=row[i] (NR==1?"":OFS) $i} END{for(i=1;i<=NF;i++) print row[i]}' file

# Word frequency count
awk '{for(i=1;i<=NF;i++) freq[$i]++} END{for(w in freq) print freq[w], w}' file | sort -rn | head -20

# Validate that every row has exactly N fields
awk -F',' 'NF != 5 {print "BAD ROW:", NR, NF, $0}' file

# Print every unique value of column 2 (deduped)
awk -F',' '!seen[$2]++ {print $2}' file
```

> [!tip] Debugging awk programs
>
> Add `{print NR, NF, $0}` as your first rule to see the record number, field count, and raw content. This quickly reveals parsing issues like unexpected field separators, extra whitespace, or CRLF endings from Windows files.

> [!tip] Performance: mawk vs gawk
>
> For pure text processing on very large files (multi-GB logs), `mawk` is often 2–5x faster than `gawk` because it has a leaner runtime. Use `mawk` for speed-critical pipelines if extended gawk features (multi-dim arrays, PROCINFO, gensub) are not needed.

---

The filtering and aggregation patterns here (pattern-action rules, group-by with associative arrays) have direct DataFrame equivalents -- see [02_py_explore_select_filter](https://alp78.github.io/elysium/03-Dataframes/Dataframes-Python/02_py_explore_select_filter) for the Pandas approach to the same column filtering and selection workflows.

## Related Notes

- [reading-file-contents](https://alp78.github.io/elysium/01-Shell/Text-Processing/reading-file-contents) — Reading files in shell (cat, head, tail, less)
- [moc-shell](https://alp78.github.io/elysium/01-Shell/moc-shell) — Shell scripting section index
