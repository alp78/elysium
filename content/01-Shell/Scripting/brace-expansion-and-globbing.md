---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
aliases: [brace expansion, globbing, extglob, globstar, failglob, shopt]
keywords: [brace expansion, globbing, extglob, globstar, failglob, shopt, wildcard, pattern matching, bash expansion, file patterns, recursive glob, exclude patterns]
description: "Brace expansion and globbing in Bash for generating multiple arguments from patterns, recursive file matching, and excluding file types. Includes shopt settings for production shells."
related: ["[[defensive-scripting]]", "[[io-redirection]]", "[[file-manipulation]]", "[[finding-files]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Brace Expansion and Globbing — Generating Arguments Efficiently

Brace expansion and shell globbing let you generate multiple arguments from compact patterns, match files by name across directory trees, and write commands that would otherwise require loops — all in a single expression. Enabling the right `shopt` options unlocks recursive globbing and prevents dangerous silent failures.

## Brace Expansion

Brace expansion generates a list of arguments from a pattern before the shell interprets anything else.

**Create a full medallion directory tree in one command:**

```bash
# Brace expansion — generate multiple arguments from a pattern
mkdir -p data/{bronze,silver,gold}/{raw,staging,final}
# Creates 9 directories in one command:
# data/bronze/raw, data/bronze/staging, data/bronze/final,
# data/silver/raw, data/silver/staging, data/silver/final,
# data/gold/raw, data/gold/staging, data/gold/final

# Numeric range
echo file{001..100}.parquet
# Generates: file001.parquet file002.parquet ... file100.parquet

# Backup before editing (common pattern)
cp config.yaml{,.bak}
# Expands to: cp config.yaml config.yaml.bak
# The comma with an empty left side = original name + .bak suffix
```

## Globbing — Extended Patterns

Standard globbing (`*`, `?`, `[abc]`) is built in. Extended globbing requires enabling `extglob`.

**Exclude patterns (requires `shopt -s extglob`):**

```bash
# Globbing — extended patterns (requires shopt -s extglob)
shopt -s extglob

ls !(*.log|*.tmp)         # list all files EXCEPT .log and .tmp
rm !(important.txt)       # delete everything except important.txt
```

**Recursive globbing (requires `shopt -s globstar`):**

```bash
# Globstar — recursive glob (requires shopt -s globstar)
shopt -s globstar

ls **/*.py                # all .py files in all subdirectories (recursive)
wc -l **/*.sql            # count lines in all SQL files in the entire tree

# Failglob — error on no matches (prevents rm * in empty directory bugs)
shopt -s failglob
rm *.csv                  # ERROR if no .csv files exist (instead of passing literal "*.csv")
```

> [!warning] The `failglob` Safety Net
> Without `failglob`, running `rm *.csv` in a directory with no CSV files passes the literal string `*.csv` to `rm`, which tries to delete a file named `*.csv`. With `failglob` enabled, the shell raises an error instead — a critical safety guard in scripts.

## Recommended `shopt` Settings for `.bashrc`

> [!tip] `shopt` Settings for Your `.bashrc`
> ```bash
> shopt -s extglob      # extended globbing (!(pattern), +(pattern), etc.)
> shopt -s globstar     # ** matches recursively through directories
> shopt -s failglob     # glob patterns that match nothing cause an error
> shopt -s nocaseglob   # case-insensitive globbing (useful on mixed-case filesystems)
> shopt -s cdspell      # auto-correct minor typos in cd arguments
> ```
> These are all safe to enable permanently. `failglob` is the most important — without it, `rm *.csv` in a directory with no CSV files passes the literal string `*.csv` to `rm`, which tries to delete a file named `*.csv`.

## PowerShell Equivalents

PowerShell has no brace expansion — use loops or arrays instead. Recursive globbing is built in.

```powershell
# No brace expansion in PowerShell — use loops or arrays instead
"bronze","silver","gold" | ForEach-Object {
    "raw","staging","final" | ForEach-Object -InputObject {
        New-Item -ItemType Directory -Path "data/$_/$using:_" -Force
    }
}

# Recursive globbing (built-in)
Get-ChildItem -Path . -Filter *.py -Recurse
# or: Get-ChildItem -Path . -Include *.py -Recurse

# Exclude patterns
Get-ChildItem -Path . -Exclude *.log,*.tmp
```

## Related
- [[defensive-scripting]] — `set -euo pipefail` pairs with `failglob` for safe scripts
- [[file-manipulation]] — `mkdir -p` with brace expansion for directory trees
- [[finding-files]] — `find` and `fd` for more complex file searches
- [[io-redirection]] — combining globs with redirection patterns
