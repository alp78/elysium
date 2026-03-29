---
type: concept
category: foundations
technology: [bash, powershell]
tags: [api, shell, bash, linux, powershell]
aliases: [curl, wget, HTTP request, REST API, Invoke-RestMethod, Invoke-WebRequest]
keywords: [curl, wget, HTTP, REST API, GET request, POST request, JSON, bearer token, download file, retry, timeout, status code, timing breakdown, Invoke-RestMethod, Invoke-WebRequest, curl vs wget, connect-timeout, max-time, health check]
description: "Making HTTP requests from the command line with curl and PowerShell's Invoke-RestMethod. Covers headers, JSON bodies, authentication, file downloads with retry, timing breakdown for latency diagnosis, and when to use curl vs wget vs Python requests."
related: ["[[connectivity-testing]]", "[[firewalls]]", "[[iap-tunneling]]", "[[environment-variables]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# HTTP Requests — Interacting with APIs and Services

Data pipelines frequently interact with REST APIs (financial data providers, cloud services, webhooks). `curl` is the command-line tool for making HTTP requests, and knowing its advanced flags can be the difference between a working integration and hours of debugging. For [[rest-api-design-and-consumption|REST API design patterns]] including pagination, error handling, and idempotency, see the Data Architecture section.

## Linux — curl

#### curl — basic GET requests

```bash
# Basic GET request
curl https://api.example.com/data
# Prints the response body to stdout

# GET with headers visible
curl -v https://api.example.com/data
# -v = verbose — shows request headers, TLS handshake, response headers, body
# Invaluable for debugging: "Is the server returning a 301 redirect? A 403 forbidden?"

# Only show the HTTP status code (health checks)
curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health
# -s = silent, -o /dev/null = discard body, -w = print format string
```

#### curl -X POST — send JSON body

```bash
# POST with JSON body
curl -X POST https://api.example.com/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"event": "pipeline_complete", "status": "success"}'
# -X POST = HTTP method
# -H = add header (repeat for multiple headers)
# -d = request body
```

#### curl --retry --connect-timeout — download with retry and timeout

> [!info] Production download flags
> - `-f` — fail on server errors (non-zero exit code instead of HTML error page)
> - `-S` — show errors even in silent mode
> - `-L` — follow redirects (3xx → follow the Location header)
> - `--retry 3` — retry up to 3 times on transient failures
> - `--retry-delay 5` — wait 5 seconds between retries
> - `--connect-timeout 10` — give up connecting after 10 seconds
> - `--max-time 300` — total time limit of 5 minutes (including transfer)

```bash
curl -fSL --retry 3 --retry-delay 5 --connect-timeout 10 --max-time 300 \
  -o data.csv https://data-provider.com/export/latest.csv

# Upload a file
curl -X PUT -T backup.sql.gz https://storage.example.com/backups/
```

#### curl -w — timing breakdown to diagnose latency

```bash
curl -s -o /dev/null -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nFirst byte: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://api.example.com/health
```

> [!info] Interpreting the timing breakdown
> - **DNS slow** — check `/etc/resolv.conf`, consider local DNS cache
> - **Connect slow** — network latency to the server
> - **TLS slow** — certificate chain is large or OCSP stapling is missing
> - **First byte - TLS slow** — server processing time is the bottleneck

### curl vs wget vs Python requests — tool selection

> [!tip] `curl` vs `wget` vs Python `requests`
> - **curl**: Best for one-off requests, debugging, health checks, and scripts. Supports every protocol. Use in bash scripts.
> - **wget**: Best for downloading files (automatic retry, resume, mirroring). `wget -c` resumes interrupted downloads. Use for large file transfers.
> - **Python requests**: Best for complex API interactions (pagination, OAuth flows, session management). Use in your pipeline code -- see [[15_py_webapis]] for httpx, requests, and async HTTP patterns.
>
> In production scripts, always set `--retry`, `--connect-timeout`, and `--max-time` on curl. A hanging curl with no timeout can block your pipeline indefinitely.

### PowerShell — Invoke-RestMethod, Invoke-WebRequest for HTTP requests

```powershell
# GET request
Invoke-RestMethod -Uri "https://api.example.com/data"
# Invoke-RestMethod = auto-parses JSON response into PowerShell objects
# Use Invoke-WebRequest if you need access to headers and status code

# GET with headers
$response = Invoke-WebRequest -Uri "https://api.example.com/data" `
    -Headers @{Authorization = "Bearer $token"}
$response.StatusCode    # 200
$response.Content       # body as string

# POST with JSON
Invoke-RestMethod -Uri "https://api.example.com/webhook" -Method Post `
    -ContentType "application/json" `
    -Body (@{event="pipeline_complete"; status="success"} | ConvertTo-Json)

# Download file
Invoke-WebRequest -Uri "https://data-provider.com/latest.csv" -OutFile "data.csv"

# With retry (PowerShell 7+)
Invoke-WebRequest -Uri "https://data-provider.com/latest.csv" -OutFile "data.csv" `
    -MaximumRetryCount 3 -RetryIntervalSec 5
```

## Related
- [[connectivity-testing]] — test TCP reachability before HTTP calls
- [[firewalls]] — when curl returns "connection timed out" or "connection refused"
- [[environment-variables]] — store `$API_TOKEN` securely in environment variables
- [[iap-tunneling]] — calling services behind IAP with identity tokens

For invoking HTTP endpoints deployed as managed services, see [[cloud-run-jobs-vs-services]] which covers Cloud Run HTTP triggers and authentication.
