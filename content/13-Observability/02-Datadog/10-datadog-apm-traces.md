---
title: "10 - Datadog APM Traces"
tags: [monitoring, observability, python, docker, datadog, gcp]
aliases: [Datadog APM, ddtrace, Pipeline Traces, APM Instrumentation]
description: "How ddtrace APM instrumentation works in the data pipeline — auto-instruments pyodbc and requests, creates per-step flame graphs, and injects trace IDs into logs for correlation."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog APM Traces

> [!quote]
> "I think of monitoring as TDD for production. And observability as debugging for production — give Future You the power to answer any question."
>
> — **Charity Majors**, charity.wtf (2018)

> [!abstract]- Summary
>
> This note covers the request-level side of the observability stack: the pipeline code is instrumented with `ddtrace-run`, spans are emitted from Cloud Run through the Datadog agent, and trace IDs are reused in logs so performance, SQL calls, and failures can be followed as one correlated execution path rather than as disconnected metrics and log lines.
>
> **Instrumentation model**
> - Explains Datadog auto-instrumentation, the Dockerfile entrypoint, and the environment variables that make tracing active in Cloud Run.
> - Keeps the trace path grounded in deployable runtime configuration rather than in abstract APM concepts.
>
> **Trace flow and spans**
> - Shows how spans move from the pipeline runtime to the local agent and what a useful pipeline trace should contain at the step level.
> - Connects end-to-end traces to concrete pipeline stages and SQL activity so latency can be localized.
>
> **Correlation and local behavior**
> - Covers manual spans, log-to-trace correlation, and the behavior of local development runs when no Datadog agent is present.
> - Helps the reader reason about when traces should exist and when their absence is expected.
>
> **Search and shutdown**
> - Ends with trace search patterns and the settings used to disable tracing when needed.
> - When to use: the goal is to understand runtime flow, latency, and per-step execution details beyond what metrics alone can show.

> [!note]- Glossary
>
> **APM trace**
> - An end-to-end record of one request or job execution composed of multiple timed spans.
> - It matters here because the pipeline is easier to diagnose when one run can be followed across all of its stages.
>
> > [!info] Execution storyline
> >
> > A trace explains sequence and latency, not just whether a counter went up.
>
> ---
>
> **span**
> - A timed unit of work inside a trace, such as one pipeline stage or SQL call.
> - It matters here because useful traces depend on spans that align with real operational steps.
>
> > [!tip] Smallest trace unit
> >
> > If spans are too coarse, root-cause localization gets blurry; if they are too fine, the trace becomes noisy.
>
> ---
>
> **`ddtrace-run`**
> - The Datadog wrapper that enables auto-instrumentation for supported Python libraries at process startup.
> - It matters here because this is how tracing is activated for the pipeline without rewriting every library call manually.
>
> > [!info] Bootstrap tracer
> >
> > The entrypoint changes the runtime behavior before application code starts executing.
>
> ---
>
> **auto-instrumentation**
> - The automatic creation of spans for supported frameworks and libraries.
> - It matters here because pyodbc, requests, and other libraries can produce useful spans without hand-written tracing code everywhere.
>
> > [!tip] Coverage with low friction
> >
> > Auto-instrumentation gets you baseline visibility quickly, then manual spans fill the business-specific gaps.
>
> ---
>
> **manual span**
> - A trace span created explicitly in application code around a custom operation.
> - It matters here because pipeline stages are often more meaningful than the library calls inside them.
>
> > [!info] Business-level trace boundary
> >
> > Manual spans are how the trace learns the language of the pipeline rather than only the language of its dependencies.
>
> ---
>
> **trace correlation ID**
> - The trace and span identifiers injected into logs so a log entry can be tied back to a specific trace.
> - It matters here because log-to-trace navigation depends on those IDs being present and indexed.
>
> > [!tip] Bridge logs and traces
> >
> > Correlation IDs turn logs from isolated text into clickable evidence attached to one execution.
>
> ---
>
> **trace agent endpoint**
> - The Datadog agent network endpoint that receives spans from the instrumented application.
> - It matters here because traces can disappear if the application points at the wrong host or port even when instrumentation is enabled.
>
> > [!info] Transport path matters
> >
> > A traced application with no reachable agent behaves like instrumentation that never ran.
>
> ---
>
> **sampling**
> - The practice of keeping only some traces or spans rather than every possible execution record.
> - It matters here because cost and volume management become relevant once tracing is broadly enabled.
>
> > [!tip] Volume control lever
> >
> > Tracing every request is not always necessary; choose visibility depth deliberately.

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
