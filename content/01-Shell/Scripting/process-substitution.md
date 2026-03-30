---
type: concept
category: foundations
technology: [bash]
tags: [shell, bash, linux]
aliases: [process substitution, here document, here string, heredoc, herestring, advanced input output]
keywords: [process substitution, here document, heredoc, here string, herestring, diff command output, virtual file descriptor, multi-line input, EOF, stdin, temporary file elimination]
description: "Bash process substitution (<() and >()), here documents (<<EOF), and here strings (<<<) for treating command output as files and embedding multi-line strings in scripts."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Process Substitution and Here Documents — Advanced Input/Output

These features let you treat command output as files and embed multi-line strings directly in your scripts. They eliminate temporary files and make complex data pipeline scripts significantly cleaner.

> [!quote]
> "Simplicity is a great virtue but it requires hard work to achieve it and education to appreciate it."
> — **Edsger Dijkstra**

## Process Substitution

Process substitution creates a virtual file descriptor containing a command's output. No temporary files are created or cleaned up.

#### diff <(cmd) <(cmd) — compare command outputs as virtual files
```bash
# Compare the output of two commands as if they were files
diff <(sort file1.txt) <(sort file2.txt)
# <(command) = creates a virtual file descriptor containing the command's output
# diff sees two "files" — but they're actually live command output
# No temporary files created or cleaned up
```

#### diff <(sqlcmd) <(sqlcmd) — compare row counts between databases
```bash
# Production scenario: compare table row counts between two databases
diff <(sqlcmd -S prod-server -U sa -P "$PASS" -d analytics_db -Q "SELECT COUNT(*) FROM dbo.market_data" -h -1 -W) \
     <(sqlcmd -S staging-server -U sa -P "$PASS" -d analytics_db -Q "SELECT COUNT(*) FROM dbo.market_data" -h -1 -W)
# Instantly tells you if staging has the same data volume as production
```

#### paste <(cut) <(cut) — feed multiple inputs to a command
```bash
# Feed multiple inputs to a command
paste <(cut -d, -f1 stocks.csv) <(cut -d, -f3 stocks.csv)
# Extracts columns 1 and 3 from a CSV and pastes them side by side
```

#### tee >(gzip) >(wc -l) — write to multiple destinations simultaneously
```bash
# Write to multiple destinations simultaneously
tee >(gzip > data.gz) >(wc -l > count.txt) < data.csv > /dev/null
# tee copies stdin to each >(...) process substitution
# Result: data.csv is simultaneously compressed AND line-counted
```

## Here Documents

Here documents embed multi-line text directly in a script, feeding it as stdin to a command.

#### << 'EOF' here document — embed multi-line SQL in a script
```bash
# Here document — embed multi-line text in a script
sqlcmd -S 10.132.0.2 -U sa -P "$SA_PASSWORD" -d analytics_db << 'EOF'
SELECT symbol, date, close
FROM dbo.market_data
WHERE _index = 'market_index'
  AND date >= DATEADD(DAY, -30, GETDATE())
ORDER BY date DESC;
EOF
# << 'EOF' = start of here document (single quotes prevent variable expansion)
# << EOF = without quotes, $variables are expanded
# Everything between << and the delimiter is fed as stdin
```

#### << EOF with variable expansion — generate config files dynamically
```bash
# Here document with variable expansion
cat << EOF > config.env
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
PIPELINE_NAME=pipeline_daily
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
# Without quotes around EOF: variables and command substitutions are expanded
# Useful for generating config files dynamically
```

## Here Strings

Here strings feed a single-line string as stdin — cleaner than piping from echo.

#### <<< here string — feed single-line input to stdin
```bash
# Here string — single-line input
grep "ASML" <<< "ASML SAP SIE"
# <<< = feed the string as stdin to the command
# Cleaner than: echo "ASML SAP SIE" | grep "ASML"
```

## Related

- [io-redirection](https://alp78.github.io/elysium/01-Shell/Scripting/io-redirection) — Basic redirection operators
- [command-chaining](https://alp78.github.io/elysium/01-Shell/Scripting/command-chaining) — Connecting commands with pipes
- [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing) — Another argument generation technique
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — Using these patterns in production scripts

## References

- [GNU Bash Reference — Process Substitution](https://www.gnu.org/software/bash/manual/html_node/Process-Substitution.html)
- [GNU Bash Reference — Here Documents](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents)
