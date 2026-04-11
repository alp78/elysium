---
title: "Domain: Data and Files"
tags:
  - domain
  - shell
---

# Data and Files

Shell commands for navigating directories, reading and transforming file content, pattern matching, and transferring data across systems.

```mermaid
mindmap
  ((Data and Files))
    (navigation)
    (reading files)
    (grep, regex)
    (awk)
    (sed)
    (date, time)
    (finding files)
    (file manipulation)
    (compression)
    (data transfer)
```

> [!abstract]- [[01-navigation-and-listing]]
>
> - [[01-navigation-and-listing#Linux — ls, du, df, tree|Directory listing and disk usage]]
> - [[01-navigation-and-listing#du vs df discrepancy — why disk usage numbers don't match|du vs df discrepancy]]
> - [[01-navigation-and-listing#PowerShell — Get-ChildItem, Get-PSDrive|PowerShell equivalents]]

> [!abstract]- [[01-reading-file-contents]]
>
> - [[01-reading-file-contents#Linux — cat, head, tail, grep, awk|Reading and inspecting files]]
> - [[01-reading-file-contents#tail -f — follow a log file in real-time|Following logs in real-time]]
> - [[01-reading-file-contents#Analyzing a large log file during an incident — grep, awk, sort workflow|Large log file analysis]]
> - [[01-reading-file-contents#PowerShell — Get-Content -Wait, Select-String for log analysis|PowerShell equivalents]]

> [!abstract]- [[02-grep-and-pattern-matching]]
>
> - [[02-grep-and-pattern-matching#Basic Pattern Matching]]
> - [[02-grep-and-pattern-matching#Recursive search]]
> - [[02-grep-and-pattern-matching#Regular Expression Patterns]]
> - [[02-grep-and-pattern-matching#Common data engineering regex patterns|Data engineering regex patterns]]

> [!abstract]- [[04-awk-data-processing]]
>
> - [[04-awk-data-processing#Record and Field Model]]
> - [[04-awk-data-processing#Field Extraction and Formatting]]
> - [[04-awk-data-processing#Filtering and Conditions]]
> - [[04-awk-data-processing#Data Transformation]]
> - [[04-awk-data-processing#Data Engineering Scenarios]]

> [!abstract]- [[03-sed-stream-editing]]
>
> - [[03-sed-stream-editing#Basic Substitution]]
> - [[03-sed-stream-editing#In-Place Editing]]
> - [[03-sed-stream-editing#Line Selection and Addressing]]
> - [[03-sed-stream-editing#Advanced Substitution with Regex]]

> [!abstract]- [[05-date-and-time-handling]]
>
> - [[05-date-and-time-handling#ISO 8601 — the only date format you should use in pipelines|ISO 8601 formats]]
> - [[05-date-and-time-handling#Date format selection — which format for which context|Format selection by context]]
> - [[05-date-and-time-handling#Terminal — Linux (Bash)|Bash]]
> - [[05-date-and-time-handling#Terminal — PowerShell|PowerShell]]
> - [[05-date-and-time-handling#SQL Server (T-SQL)|SQL Server]]
> - [[05-date-and-time-handling#Python]]

> [!abstract]- [[03-finding-files]]
>
> - [[03-finding-files#find -mtime -mmin — find by modification time|Find by modification time]]
> - [[03-finding-files#find -size — find by file size|Find by file size]]
> - [[03-finding-files#find -exec, find -delete — find and execute on results|Find and execute on results]]
> - [[03-finding-files#find vs fd vs locate — tool comparison|find vs fd vs locate comparison]]
> - [[03-finding-files#PowerShell — Get-ChildItem, Where-Object, Select-String|PowerShell equivalents]]

> [!abstract]- [[02-file-manipulation]]
>
> - [[02-file-manipulation#Linux — cp, mv, rm, rsync|Copying, moving, deleting]]
> - [[02-file-manipulation#rm — safe delete pattern with trash directory|Safe delete pattern]]
> - [[02-file-manipulation#chmod — set file permissions with octal or symbolic notation|File permissions]]
> - [[02-file-manipulation#chown — change file ownership for Docker and multi-user environments|File ownership]]
> - [[02-file-manipulation#PowerShell — Copy-Item, Move-Item, Remove-Item, New-Item|PowerShell equivalents]]

> [!abstract]- [[04-compression]]
>
> - [[04-compression#gzip — compress and decompress files|gzip]]
> - [[04-compression#zstd — modern replacement with better ratio and faster speed|zstd]]
> - [[04-compression#tar — archiving and compression for directories|tar archives]]
> - [[04-compression#Compression strategy matrix — choosing the right algorithm for data pipelines|Strategy matrix]]
> - [[04-compression#PowerShell — Compress-Archive, 7-Zip, GZipStream|PowerShell equivalents]]

> [!abstract]- [[05-data-transfer]]
>
> - [[05-data-transfer#rsync — The Gold Standard for File Transfer|rsync]]
> - [[05-data-transfer#rsync trailing slash — source path determines copy behavior|Trailing slash gotcha]]
> - [[05-data-transfer#scp — Simple Remote Copy|scp]]
> - [[05-data-transfer#gcloud compute scp — GCE-Native File Transfer|GCE file transfer]]
> - [[05-data-transfer#gsutil and gcloud storage — Cloud Storage Transfers|Cloud Storage transfers]]
