---
type: concept
category: python
technology: [python]
tags: [pipeline, python]
aliases: [Python pipeline, cProfile, memory profiler, ruff, mypy, running pipelines]
keywords: [python, pipeline, run, execute, profiling, cProfile, memory profiler, linting, ruff, mypy, type checking, environment variables, module execution]
description: "Running Python data pipelines — module execution, environment variable configuration, CPU profiling with cProfile, memory profiling, and code quality with ruff and mypy."
related:
  - "[[python-virtual-environments]]"
  - "the pipeline steps"
  - "[[linux-scheduling|cron and crontab]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Python Pipeline Execution

How to run, profile, and lint Python data pipelines in production.

## Running Pipelines

```bash
# Run a Python module as a script
python3 -m pipeline.run
# -m = run as module (uses the package's __main__.py)
# Preferred over: python3 pipeline/run.py (which can cause import path issues)

# Run with environment variables
DB_HOST=10.132.0.2 DB_NAME=data-pipeline LOG_LEVEL=DEBUG python3 -m pipeline.run
# Environment variables are the standard way to pass configuration
```

See [[environment-variables]] for how environment variable propagation works.

## CPU Profiling

```bash
# Run with profiling (where is time being spent?)
python3 -m cProfile -s cumulative pipeline/run.py 2>&1 | head -30
# cProfile = built-in profiler
# -s cumulative = sort by total time in each function
# Shows: which function calls are consuming the most time
```

## Memory Profiling

```bash
# Memory profiling (is the pipeline leaking memory?)
pip install memory-profiler
python3 -m memory_profiler pipeline/run.py
# Shows: memory usage line-by-line
# Add @profile decorator to functions you want to trace
```

## Linting and Type Checking

```bash
# Lint and type check
pip install ruff mypy
ruff check pipeline/                    # fast linter (replaces flake8, pylint)
mypy pipeline/ --ignore-missing-imports # static type checking
```

## Related

- [[python-virtual-environments]] — Environment isolation and dependency management
- the pipeline steps — data pipeline execution details
- [[linux-scheduling|cron and crontab]] — Scheduling pipeline runs
