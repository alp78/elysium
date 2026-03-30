---
type: reference
category: observability
technology: [datadog, python, gcp, docker]
tags: [monitoring, observability, python, docker, datadog, gcp]
aliases: [Datadog APM, ddtrace, Pipeline Traces, APM Instrumentation]
keywords: [ddtrace, ddtrace-run, APM traces, auto-instrumentation, monkey-patch, pyodbc, requests, flame graph, pipeline.step, tracer.trace, DD_TRACE_AGENT_URL, DD_SERVICE, data-pipeline-pipeline, log-to-trace correlation, dd.trace_id, dd.span_id, JSON logger, import error guard, local development, no impact SQL Server]
description: "How ddtrace APM instrumentation works in the data pipeline — auto-instruments pyodbc and requests, creates per-step flame graphs, and injects trace IDs into logs for correlation."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog APM Traces — Pipeline Instrumentation

The `data-pipeline-pipeline` Cloud Run job uses `ddtrace` for APM instrumentation. No significant code changes are needed — `ddtrace` auto-instruments Python libraries at import time and creates per-step flame graphs showing SQL query durations, HTTP call latency, and overall step timing.

---

### How ddtrace Works (APM Auto-Instrumentation)

1. The pipeline runs Python with `ddtrace-run` (or imports `ddtrace.auto`). That's the only setup needed.
2. `ddtrace` **monkey-patches Python libraries at import time** — it wraps functions in `pyodbc`, `requests`, `urllib3`, etc. with instrumentation.
3. Every `cursor.execute("SELECT ...")` gets automatically wrapped to record the SQL query text, start/end timestamps, duration, and success/error status.
4. It batches these "spans" and sends them to the Datadog Agent on port 8126 (`DD_TRACE_AGENT_URL`), which forwards to Datadog.

**It's not SQL-specific.** `ddtrace` has dedicated integrations for dozens of Python libraries:

| Library | What ddtrace captures |
|---------|----------------------|
| `pyodbc` / `pymssql` | SQL query text, database name, row count |
| `requests` / `urllib3` | URL, HTTP method, status code, response size |
| `psycopg2` | SQL query, database name, table |
| `boto3` | AWS service name, operation, bucket/queue name |
| `grpc` | Service, method, status code |

**No impact on SQL Server:** `ddtrace` instruments the Python function calls, not the database itself. The actual SQL execution is unchanged — zero overhead on the database side.

---

### Dockerfile Entrypoint for ddtrace-run

```dockerfile
# docker/pipeline.Dockerfile
ENTRYPOINT ["ddtrace-run", "python", "utils/run_pipeline.py"]
```

---

### Cloud Run APM Environment Variables

Set in `infra/run.tf`:

```hcl
env { name = "DD_SERVICE";         value = "data-pipeline-pipeline" }
env { name = "DD_ENV";             value = "prod" }
env { name = "DD_TRACE_AGENT_URL"; value = "http://<VM_PRIVATE_IP>:8126" }
env { name = "DD_API_KEY";         value = var.dd_api_key }
env { name = "LOG_FORMAT";         value = "json" }
```

---

### APM Trace Flow from Pipeline to Datadog

```
Cloud Run Job             Airflow VM              Datadog
┌──────────────────┐    ┌──────────┐        ┌─────────┐
│ Python + ddtrace │─8126─▶ dd-agent │──HTTPS──▶  APM   │
│ (auto-instruments│    └──────────┘        └─────────┘
│  pyodbc, requests)│
└──────────────────┘
```

Requirements:
- VPC access on Cloud Run with `egress = "PRIVATE_RANGES_ONLY"`
- Firewall rule `data-pipeline-allow-apm` allowing TCP 8126 from `10.0.0.0/24` to tag `airflow`
- dd-agent with `-p 8126:8126` (host port mapping) and `DD_APM_NON_LOCAL_TRAFFIC=true`

---

### What a Datadog APM Trace Looks Like

Each pipeline step is a root span, with auto-instrumented SQL queries as child spans:

```
transform_index_performance (4.45s total)
├── SELECT MAX(perf_date) FROM gold.index_performance (3.7ms)
├── SELECT symbol, date, [close] FROM silver.index_usa_ohlcv (101ms)
├── DELETE FROM gold.index_performance WHERE _index = ? (4.9ms)
├── INSERT INTO gold.index_performance (4.1ms)
└── pyodbc.connection.commit (2.6ms)
```

This flame graph shows exactly which SQL queries are slow and where time is spent within each pipeline step.

---

### Manual Spans per Pipeline Step

Each pipeline step is wrapped in a trace span in `utils/run_pipeline.py`:

```python
try:
    from ddtrace import tracer
except ImportError:
    tracer = None

# In the main loop:
if tracer:
    with tracer.trace("pipeline.step", service="data-pipeline-pipeline",
                      resource=name) as span:
        span.set_tag("step.num", num)
        span.set_tag("step.name", name)
        fn()
else:
    fn()
```

This creates a flame graph in APM showing each step's duration, plus auto-instrumented child spans for SQL queries (via pyodbc). The `try/except ImportError` guard means the code works identically without ddtrace installed (local development).

---

### Log-to-Trace Correlation with dd.trace_id

The JSON log formatter (`utils/logger.py`) injects trace IDs into every log line:

```python
try:
    from ddtrace import tracer
    span = tracer.current_span()
    if span:
        log["dd.trace_id"] = str(span.trace_id)
        log["dd.span_id"] = str(span.span_id)
except ImportError:
    pass
```

In Datadog, this enables clicking from a log line directly to the corresponding APM trace. The `LOG_FORMAT=json` environment variable on the Cloud Run Job must be set for this to work.

---

### Local Development Behavior without Datadog Agent

The `try/except ImportError` guard in the tracer setup means:

- **Without ddtrace installed** (local dev): tracer is `None`, the `if tracer:` block is skipped, the code runs identically with no tracing overhead
- **With ddtrace installed** (GCP / production): full tracing activates automatically

This means you don't need to install `ddtrace` locally unless you want to test the APM integration.

---

### APM Trace Search Queries in Datadog

In **APM > Traces** (or **APM > Trace Search**):

```
service:data-pipeline-pipeline @duration:>30s            # Slow pipeline steps
service:data-pipeline-pipeline status:error              # Failed steps
service:data-pipeline-pipeline resource_name:transform_index_performance  # Specific step
```

---

### Disabling APM Tracing in the Pipeline

If you want to remove Datadog/ddtrace:

1. Revert the Dockerfile entrypoint:
   ```dockerfile
   ENTRYPOINT ["python", "utils/run_pipeline.py"]
   ```
2. Remove `ddtrace>=2.10.0` from `requirements.txt`
3. Rebuild and push the pipeline image
4. The logger and run_pipeline trace code no-ops automatically (`ImportError` guard)

---

## Related Notes

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — full observability architecture
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — the dd-agent that receives traces on port 8126
- [datadog-sql-server-logs](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-logs) — companion: logs from SQL Server errorlog
- the pipeline steps — what each pipeline step does
- common pipeline errors — APM traces missing troubleshooting
