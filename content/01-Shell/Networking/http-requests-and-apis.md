---
type: concept
category: foundations
technology: [bash, powershell]
tags: [api, shell, bash, linux, powershell]
aliases: [curl, wget, HTTP request, REST API, Invoke-RestMethod, Invoke-WebRequest]
keywords: [curl, wget, HTTP, REST API, GET request, POST request, JSON, bearer token, download file, retry, timeout, status code, timing breakdown, Invoke-RestMethod, Invoke-WebRequest, curl vs wget, connect-timeout, max-time, health check]
description: "Making HTTP requests from the command line with curl and PowerShell's Invoke-RestMethod. Covers headers, JSON bodies, authentication, file downloads with retry, timing breakdown for latency diagnosis, and when to use curl vs wget vs Python requests."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# HTTP Requests — Interacting with APIs and Services

Data pipelines frequently interact with REST APIs (financial data providers, cloud services, webhooks). `curl` is the command-line tool for making HTTP requests, and knowing its advanced flags can be the difference between a working integration and hours of debugging. For [REST API design patterns](https://alp78.github.io/elysium/14-Data-Architecture/APIs-and-Protocols/rest-api-design-and-consumption) including pagination, error handling, and idempotency, see the Data Architecture section.

> [!quote]
> "I just wanted it to do Internet transfers good, fast and reliably and that's what I worked on making reality."
>
> — **Daniel Stenberg** (creator of curl)

## Linux — curl

#### curl — basic GET requests

> [!info] curl basic usage
>
> `curl` prints the response body to stdout. Add `-v` for full request/response
> headers including TLS handshake — invaluable for debugging redirects, auth failures, and
> certificate issues.

```bash
curl https://api.example.com/data
curl -v https://api.example.com/data
```

#### curl -w "%{http_code}" — health check that returns only the status code

> [!info] Health check with status code
>
> `-s` silences progress, `-o /dev/null` discards the body, `-w` prints a format
> string. Use in scripts and monitoring to check HTTP status without processing the body.

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health
```

> [!warning] curl does not follow redirects
>
> A `301` or `302` response returns the redirect HTML, not the final resource. Add `-L`
> to follow redirects. Without `-L`, a health check against a load balancer that redirects
> HTTP → HTTPS returns `301`, not the actual health status.

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
>
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

> [!info] Timing breakdown interpretation
>
> - **DNS slow** — check `/etc/resolv.conf`, consider local DNS cache
> - **Connect slow** — network latency to the server
> - **TLS slow** — certificate chain is large or OCSP stapling is missing
> - **First byte - TLS slow** — server processing time is the bottleneck

### curl vs wget vs Python requests — tool selection

> [!tip] curl vs wget vs Python requests
>
> - **curl**: Best for one-off requests, debugging, health checks, and scripts. Supports every protocol. Use in bash scripts.
> - **wget**: Best for downloading files (automatic retry, resume, mirroring). `wget -c` resumes interrupted downloads. Use for large file transfers.
> - **Python requests**: Best for complex API interactions (pagination, OAuth flows, session management). Use in your pipeline code -- see [15_py_webapis](https://alp78.github.io/elysium/02-Programming-Languages/Python/15_py_webapis) for httpx, requests, and async HTTP patterns.
>
> In production scripts, always set `--retry`, `--connect-timeout`, and `--max-time` on curl. A hanging curl with no timeout can block your pipeline indefinitely.

### PowerShell — Invoke-RestMethod, Invoke-WebRequest for HTTP requests

#### Invoke-RestMethod — GET request with automatic JSON parsing

> [!info] Invoke-RestMethod auto-parses JSON
>
> `Invoke-RestMethod` auto-parses JSON into PowerShell objects — you get
> properties directly. Use `Invoke-WebRequest` when you need access to status codes,
> headers, or raw content.

```powershell
Invoke-RestMethod -Uri "https://api.example.com/data"
```

#### Invoke-WebRequest — GET with headers and status code access

```powershell
$response = Invoke-WebRequest -Uri "https://api.example.com/data" `
    -Headers @{Authorization = "Bearer $token"}
$response.StatusCode
$response.Content
```

#### Invoke-RestMethod -Method Post — send JSON body

> [!info] POST with JSON body
>
> Pipe a hashtable to `ConvertTo-Json` for the body. PowerShell handles
> serialization and content type.

```powershell
Invoke-RestMethod -Uri "https://api.example.com/webhook" -Method Post `
    -ContentType "application/json" `
    -Body (@{event="pipeline_complete"; status="success"} | ConvertTo-Json)
```

#### Invoke-WebRequest -OutFile — download with retry (PowerShell 7+)

> [!warning] Retry flags are PowerShell 7+ only
>
> `-MaximumRetryCount` and `-RetryIntervalSec` are PowerShell 7+ only.
> Windows PowerShell 5.1 has no built-in retry — wrap in a `for` loop with `try/catch`.

```powershell
Invoke-WebRequest -Uri "https://data-provider.com/latest.csv" -OutFile "data.csv" `
    -MaximumRetryCount 3 -RetryIntervalSec 5
```

## Related
- [connectivity-testing](https://alp78.github.io/elysium/01-Shell/Networking/connectivity-testing) — test TCP reachability before HTTP calls
- [firewalls](https://alp78.github.io/elysium/01-Shell/Networking/firewalls) — when curl returns "connection timed out" or "connection refused"
- [environment-variables](https://alp78.github.io/elysium/01-Shell/Scripting/environment-variables) — store `$API_TOKEN` securely in environment variables
- [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling) — calling services behind IAP with identity tokens

For invoking HTTP endpoints deployed as managed services, see [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) which covers Cloud Run HTTP triggers and authentication.
