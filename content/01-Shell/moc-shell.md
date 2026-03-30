---
title: "MOC: Shell"
tags:
  - moc
  - shell
  - bash
  - linux
---

# MOC: Shell

Command-line fluency for data engineers working across Linux and PowerShell. This map covers everything from reading files and transforming text, through writing production-safe scripts, to monitoring systems and securing network access on GCP infrastructure. Each page pairs bash commands with PowerShell equivalents so the same technique works regardless of environment.

## Data & Files — Find It, Read It, Transform It, Move It

Navigating filesystems, reading and transforming data with the classic Unix text-processing toolkit, locating files at scale, and moving data between machines and cloud storage.

* [[navigation-and-listing]] — ls flags for data engineers (-lhrt for recent files last), du for directory-level disk usage, df for filesystem capacity, and the du-vs-df discrepancy explained

* [[reading-file-contents]] — cat, head, tail for quick inspection, tail -f for real-time log following during incidents, less for paging large files, wc -l for row counts, and grep performance flags for multi-GB log files

* [[grep-and-pattern-matching]] — Basic and extended regex with grep, case-insensitive and inverted matching, context lines, recursive search, PCRE lookahead/lookbehind, ripgrep for speed, zgrep for compressed files, and PowerShell Select-String equivalents

* [[awk-data-processing]] — Field extraction, delimiter conversion, filtering and pattern-action rules, BEGIN/END blocks, associative arrays for group-by aggregation, printf formatting, multi-file processing, and PowerShell Import-Csv equivalents

* [[sed-stream-editing]] — Substitution with regex capture groups, in-place editing with -i, address ranges for targeted edits, line deletion and insertion, BOM removal, CRLF-to-LF conversion, ANSI stripping, and PII sanitisation patterns

* [[date-and-time-handling]] — ISO 8601 format variants, timezone management and DST pitfalls, naive vs aware datetimes, date arithmetic and parsing across bash, PowerShell, SQL Server T-SQL, Python, and C#

* [[finding-files]] — find by name, size, and modification time, fd for faster interactive search, locate for instant lookups, xargs for parallel processing of results, and PowerShell Get-ChildItem filtering

* [[file-manipulation]] — Safe cp, mv, rm patterns for production, archive copy with metadata preservation, chmod octal notation, chown for Docker and Airflow containers, mkdir -p, and the trash-directory safe-delete pattern

* [[compression]] — gzip for universal compatibility, zstd for high-performance pipelines, tar for directory archiving, compression level trade-offs, and a strategy matrix for choosing algorithms across pipeline intermediates, Parquet, and database backups

* [[data-transfer]] — rsync delta transfers with resume, scp for quick copies, gcloud compute scp for GCE VMs, gsutil and gcloud storage for GCS, bcp for SQL Server bulk export/import, and the trailing-slash gotcha that silently changes directory structure

## Script Engineering — Write Production-Safe Automation

Building reliable shell scripts from basic operator mechanics through advanced input patterns to hardened production templates.

* [[command-history]] — Reverse search with Ctrl+R, history grep for past commands, !!/!$ bang shortcuts, HISTSIZE and HISTCONTROL tuning, and PowerShell PSReadLine predictive IntelliSense

* [[io-redirection]] — Stdout, stderr, and stdin redirection to files, the 2>&1 merge pattern, appending vs overwriting, /dev/null for silencing output, tee for logging while watching, and production log-capture patterns

* [[command-chaining]] — How exit codes drive && (fail-fast), || (fallback), ; (unconditional), and | (pipe) operators, with real deployment script examples showing why operator choice prevents silent failures

* [[process-substitution]] — Treating command output as virtual files with <() for diff comparisons, here documents (<<EOF) for embedding multi-line strings, here strings (<<<) for single-line stdin, and eliminating temporary files from scripts

* [[brace-expansion-and-globbing]] — Brace expansion for directory trees and backup copies, glob wildcards, extglob for exclude patterns, globstar for recursive matching, and failglob to prevent dangerous silent no-match behavior

* [[environment-variables]] — The parent-to-child propagation model, export vs shell-only variables, .bashrc vs .profile persistence, secure credential handling patterns, PATH construction, and the "works in terminal but not in cron" debugging checklist

* [[defensive-scripting]] — set -euo pipefail as the mandatory first line, what each flag prevents (silent errors, unset variables, hidden pipe failures), trap for cleanup on exit, and a production script template

## System & Network Operations — Monitor, Diagnose, Secure

Diagnosing performance problems, managing services, and establishing secure network connectivity to GCP infrastructure.

* [[viewing-processes]] — ps aux column meanings (RSS vs VSZ, STAT codes), htop for real-time monitoring, pstree for process hierarchy, the D-state (uninterruptible sleep) that cannot be killed, and docker stats for container resource usage

* [[system-resources]] — free -h and the available-vs-free memory distinction, lscpu and load average interpretation, vmstat for CPU and swap pressure, iostat and iotop for disk I/O saturation, and OOM killer diagnosis

* [[killing-processes]] — The correct escalation sequence (SIGTERM then wait then SIGKILL), pkill -f for pattern-based termination, killing process groups by PGID, strace for diagnosing stuck processes, and lock file cleanup after force kills

* [[managing-services]] — systemctl start/stop/restart/reload/enable for systemd services, journalctl for reading service logs with time filters, diagnosing OOM kills in journal output, and PowerShell Start-Service/Stop-Service equivalents

* [[connectivity-testing]] — Systematic layer-by-layer debugging: DNS with dig, TCP reachability with netcat, traceroute and mtr for path analysis, the "connection refused vs timed out" distinction, and PowerShell Test-NetConnection

* [[socket-inspection]] — Reading ss -tlnp output to diagnose listening ports, ESTABLISHED vs TIME-WAIT states, loopback (127.0.0.1) vs all-interface (0.0.0.0) binding, ephemeral port exhaustion, and connection pool monitoring for SQL Server

* [[http-requests-and-apis]] — curl GET/POST with headers and JSON bodies, bearer token authentication, file downloads with retry and resume, timing breakdown (-w) for latency diagnosis, health-check scripts, and PowerShell Invoke-RestMethod

* [[firewalls]] — ufw for Linux host-level rules, GCP VPC firewall rules with source ranges and target tags, Windows Firewall equivalents, the defense-in-depth model (VPC + OS + auth + no public IP), and the IAP IP range (35.235.240.0/20)

* [[iap-tunneling]] — How Identity-Aware Proxy works at the network level, gcloud start-iap-tunnel for SQL Server and SSH, debugging common IAP failures (403, timeout, slow tunnel), and comparison with Cloud VPN and bastion hosts

* [[connecting-to-gcp-resources]] — Connection commands for every GCP service type: SSH to Compute Engine, SQL Server via IAP tunnel, BigQuery direct API, Cloud Run HTTPS, Airflow webserver, Datadog agent, and a quick-reference connection matrix
