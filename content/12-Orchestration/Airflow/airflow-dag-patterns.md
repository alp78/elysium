---
type: reference
category: orchestration
technology: [airflow, python]
tags: [orchestration, python, airflow]
aliases:
  - Dynamic DAGs
  - Airflow dynamic tasks
  - Airflow task groups
  - Airflow branching
  - BranchPythonOperator
  - trigger rules
  - Airflow SubDAGs
  - TaskGroups
  - Airflow backfill
  - parameterized DAGs
  - dataset-driven scheduling
  - data-aware scheduling
  - SLA monitoring
  - on_failure_callback
  - on_success_callback
  - Airflow idempotent
  - depends_on_past
  - cross_downstream
  - chain
keywords:
  - airflow dag patterns
  - dynamic dags
  - task groups
  - branching
  - BranchPythonOperator
  - trigger rules
  - all_success
  - all_failed
  - one_success
  - none_failed
  - all_done
  - SubDAGs deprecated
  - backfill
  - parameterized dag
  - dag run conf
  - dataset scheduling
  - data-aware scheduling
  - SLA
  - on_failure_callback
  - idempotent pipeline
  - depends_on_past
  - max_active_runs
  - chain operator
  - cross_downstream
  - medallion architecture airflow
description: "Comprehensive reference for Apache Airflow DAG patterns: task dependencies, task groups, dynamic DAG generation, branching, trigger rules, idempotency, backfill, parameterization, dataset-driven scheduling, and SLA/callback configuration."
related:
  - airflow-core-concepts
  - airflow-deployment
  - airflow-troubleshooting
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Airflow DAG Patterns

A reference for the most important Apache Airflow DAG authoring patterns used in production data engineering. This note covers how to express complex workflow logic in DAGs: dependencies, grouping, dynamic generation, branching, and scheduling strategies.

> [!tip] Prerequisites
> This note assumes familiarity with Airflow fundamentals. See [[airflow-core-concepts]] for DAG structure, Operators, Sensors, XComs, and the TaskFlow API before reading this reference.

---

## Task Dependencies

Task dependencies define the execution order. Airflow provides several syntaxes for expressing them.

### Bitshift Operators (`>>` and `<<`)

The primary, most readable syntax. `>>` means "runs before"; `<<` means "runs after".

```python
from airflow.operators.empty import EmptyOperator

# Sequential chain: A → B → C → D
task_a >> task_b >> task_c >> task_d

# Fan-out: A triggers B, C, and D in parallel
task_a >> [task_b, task_c, task_d]

# Fan-in: B, C, D must all complete before E runs
[task_b, task_c, task_d] >> task_e

# Combined fan-out then fan-in
task_a >> [task_b, task_c] >> task_d

# Reverse direction with <<
task_b << task_a  # Equivalent to task_a >> task_b
```

### `chain()` for Complex Linear Dependencies

Use `chain()` when you need to express a sequence involving lists without nesting `>>` multiple times. `chain()` zips lists together pairwise.

```python
from airflow.models.baseoperator import chain

# Equivalent to: a >> b >> c >> d
chain(task_a, task_b, task_c, task_d)

# chain() with lists — creates pairwise dependencies:
# extract_a >> transform_a, extract_b >> transform_b (NOT cross-product)
chain([extract_a, extract_b], [transform_a, transform_b])

# Full pattern: fan-out then pairwise chain then fan-in
chain(
    start,                              # start runs first
    [extract_a, extract_b],            # parallel extracts after start
    [transform_a, transform_b],        # pairwise: a→a, b→b
    join,                               # join waits for all transforms
)
```

### `cross_downstream()` for Full Cross-Product Dependencies

Use `cross_downstream()` when EVERY task in the upstream list must connect to EVERY task in the downstream list.

```python
from airflow.models.baseoperator import cross_downstream

# Every extract feeds every transform
# Creates: extract_a → transform_a, extract_a → transform_b,
#          extract_b → transform_a, extract_b → transform_b
cross_downstream(
    [extract_a, extract_b],
    [transform_a, transform_b],
)
```

> [!tip] When to Use Each
> - `>>` / `<<`: simple sequential or fan-out/fan-in structures
> - `chain()`: long sequences or pairwise list dependencies
> - `cross_downstream()`: many-to-many (use sparingly — creates many edges)

---

## Task Groups

Task Groups (introduced in Airflow 2.0, replacing SubDAGs) allow you to visually group related tasks in the UI. They do not change execution semantics.

> [!warning] SubDAGs are deprecated
>
> SubDAGs (using `SubDagOperator`) are deprecated as of Airflow 2.0 and removed in later versions. They caused deadlocks, were difficult to debug, and had separate executors. Always use **TaskGroups** instead.

```python
from airflow.utils.task_group import TaskGroup
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator

with DAG("medallion_pipeline", schedule="@daily", start_date=datetime(2024, 1, 1), catchup=False) as dag:

    start = EmptyOperator(task_id="start")

    # --- Bronze Layer Task Group ---
    with TaskGroup(group_id="bronze", tooltip="Ingest raw data from sources") as bronze_group:

        ingest_crm = PythonOperator(
            task_id="ingest_crm",       # Becomes "bronze.ingest_crm" in the UI
            python_callable=lambda: print("Ingesting CRM"),
        )
        ingest_erp = PythonOperator(
            task_id="ingest_erp",       # Becomes "bronze.ingest_erp"
            python_callable=lambda: print("Ingesting ERP"),
        )
        # Tasks within the group run in parallel (no dependencies between them)

    # --- Silver Layer Task Group ---
    with TaskGroup(group_id="silver", tooltip="Clean and standardize data") as silver_group:

        clean_crm = PythonOperator(task_id="clean_crm", python_callable=lambda: None)
        clean_erp = PythonOperator(task_id="clean_erp", python_callable=lambda: None)
        clean_crm >> clean_erp          # Dependencies work normally inside groups

    # --- Gold Layer Task Group ---
    with TaskGroup(group_id="gold", tooltip="Build analytical models") as gold_group:

        build_customer = PythonOperator(task_id="build_customer_dim", python_callable=lambda: None)
        build_sales = PythonOperator(task_id="build_sales_fact", python_callable=lambda: None)
        build_customer >> build_sales

    end = EmptyOperator(task_id="end")

    # Chain the groups — groups act as single nodes for cross-group dependencies
    start >> bronze_group >> silver_group >> gold_group >> end
```

### Nested Task Groups

```python
# Task Groups can be nested up to any depth (keep it readable — max 2-3 levels)
with TaskGroup("data_quality") as dq_group:
    with TaskGroup("checks_crm") as crm_checks:
        check_nulls = PythonOperator(task_id="check_nulls", python_callable=lambda: None)
        check_schema = PythonOperator(task_id="check_schema", python_callable=lambda: None)
    with TaskGroup("checks_erp") as erp_checks:
        check_counts = PythonOperator(task_id="check_counts", python_callable=lambda: None)
```

---

## Dynamic DAGs

Dynamic DAG generation creates tasks programmatically — from a config file, database query, or API call — instead of hardcoding them. This is one of Airflow's most powerful features.

> [!warning] Keep DAG parsing fast
>
> DAG files are parsed by the Scheduler repeatedly (every 30s by default). Code that runs at module level (outside of tasks) runs during parsing. Never make database queries, API calls, or heavy computations at module level. Generate dynamic tasks from a static config file or lightweight Python list, not from live queries. See [[airflow-troubleshooting]] for slow DAG parsing symptoms.

### Pattern 1: Dynamic Tasks from a Config List

```python
# dags/dynamic_from_config.py
# Generate one task per data source from a static configuration dict.

from airflow.decorators import dag, task
from datetime import datetime

# This config is evaluated at parse time — keep it simple and static
DATA_SOURCES = [
    {"name": "crm", "table": "customers", "partition_col": "updated_at"},
    {"name": "erp", "table": "orders",    "partition_col": "order_date"},
    {"name": "pos", "table": "transactions", "partition_col": "txn_date"},
]

@dag(
    dag_id="dynamic_ingestion",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["dynamic", "ingestion"],
)
def dynamic_ingestion():

    from airflow.operators.python import PythonOperator
    from airflow.operators.empty import EmptyOperator

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end", trigger_rule="none_failed_min_one_success")

    for source in DATA_SOURCES:
        # Each iteration creates a distinct task with a unique task_id
        extract_task = PythonOperator(
            task_id=f"extract_{source['name']}",
            python_callable=lambda s=source, **ctx: print(f"Extracting {s['table']} for {ctx['ds']}"),
            # Note: use default argument (s=source) to capture loop variable correctly
        )
        validate_task = PythonOperator(
            task_id=f"validate_{source['name']}",
            python_callable=lambda s=source, **ctx: print(f"Validating {s['table']}"),
        )
        # Chain: start → extract_X → validate_X → end
        start >> extract_task >> validate_task >> end

dynamic_ingestion()
```

### Pattern 2: Dynamic Tasks with TaskFlow API

```python
# dags/dynamic_taskflow.py
# TaskFlow-style dynamic task expansion (Airflow 2.3+ dynamic task mapping)

from airflow.decorators import dag, task
from datetime import datetime

@dag(schedule="@daily", start_date=datetime(2024, 1, 1), catchup=False)
def dynamic_taskflow():

    @task
    def get_sources() -> list:
        """Return a list of sources to process. Can be dynamic at runtime."""
        # In real usage: could read from a config file, not a live DB query
        return ["crm", "erp", "pos"]

    @task
    def process_source(source_name: str, ds=None) -> dict:
        """Process a single source. This task is dynamically mapped."""
        print(f"Processing {source_name} for {ds}")
        return {"source": source_name, "status": "success"}

    @task
    def aggregate_results(results: list) -> None:
        """Collect results from all dynamically mapped tasks."""
        print(f"All results: {results}")
        successes = [r for r in results if r["status"] == "success"]
        print(f"{len(successes)}/{len(results)} sources processed successfully")

    # .expand() creates one task instance per element in the list
    sources = get_sources()
    results = process_source.expand(source_name=sources)
    aggregate_results(results)

dynamic_taskflow()
```

> [!info] Dynamic Task Mapping (Airflow 2.3+)
> `.expand()` is the modern way to create dynamic tasks. It maps a task function over a list, creating one Task Instance per element. The mapped tasks run in parallel (subject to concurrency limits) and the downstream task receives a list of all results. This is cleaner than loop-generated tasks because the number of tasks can be determined at runtime.

### Pattern 3: DAG Factory (Multiple DAGs from Config)

```python
# dags/dag_factory.py
# Generate multiple DAGs from a YAML config — one DAG per business unit.

import yaml
from pathlib import Path
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

# Load config at module level (static file — parse-safe)
CONFIG_PATH = Path(__file__).parent / "configs" / "business_units.yaml"

def create_dag(unit_config: dict) -> DAG:
    """Factory function: build and return a DAG object for one business unit."""
    unit_name = unit_config["name"]

    dag = DAG(
        dag_id=f"ingest_{unit_name}",
        schedule=unit_config.get("schedule", "@daily"),
        start_date=datetime(2024, 1, 1),
        catchup=False,
        tags=["generated", unit_name],
    )

    with dag:
        PythonOperator(
            task_id="ingest",
            python_callable=lambda cfg=unit_config: print(f"Ingesting {cfg['name']}"),
        )

    return dag

# This runs at module level during DAG parsing
if CONFIG_PATH.exists():
    with open(CONFIG_PATH) as f:
        config = yaml.safe_load(f)
    for unit in config.get("business_units", []):
        # Each DAG must be assigned to a module-level variable for Airflow to discover it
        globals()[f"dag_{unit['name']}"] = create_dag(unit)
```

---

## Branching

Branching allows a DAG to follow different paths based on runtime conditions.

### BranchPythonOperator

```python
from airflow.operators.python import BranchPythonOperator
from airflow.operators.empty import EmptyOperator

def choose_path(**context):
    """
    Must return the task_id (string) or a list of task_ids to follow.
    Tasks NOT returned are SKIPPED (not failed).
    """
    execution_date = context["logical_date"]
    day_of_week = execution_date.weekday()  # 0=Monday, 6=Sunday

    if day_of_week == 0:  # Monday — run full weekly refresh
        return "run_weekly_refresh"
    elif context["params"].get("force_full", False):
        return "run_full_load"
    else:
        return ["run_incremental_load", "run_data_quality"]  # Multiple branches

branch = BranchPythonOperator(
    task_id="choose_branch",
    python_callable=choose_path,
)

weekly = PythonOperator(task_id="run_weekly_refresh", python_callable=lambda: None)
full   = PythonOperator(task_id="run_full_load",       python_callable=lambda: None)
incr   = PythonOperator(task_id="run_incremental_load", python_callable=lambda: None)
dq     = PythonOperator(task_id="run_data_quality",    python_callable=lambda: None)

# Join point — use none_failed to handle skipped branches
join = EmptyOperator(task_id="join", trigger_rule="none_failed_min_one_success")

branch >> [weekly, full, incr, dq] >> join
```

### TaskFlow Branching (`@task.branch`)

```python
from airflow.decorators import dag, task
from airflow.operators.empty import EmptyOperator

@dag(schedule="@daily", start_date=datetime(2024, 1, 1), catchup=False)
def branching_example():

    @task.branch
    def decide(ds=None):
        """Return the task_id string to execute."""
        from datetime import datetime
        if datetime.strptime(ds, "%Y-%m-%d").day == 1:
            return "monthly_report"
        return "daily_report"

    @task
    def daily_report():
        print("Daily report")

    @task
    def monthly_report():
        print("Monthly report")

    join = EmptyOperator(task_id="join", trigger_rule="none_failed_min_one_success")

    decide() >> [daily_report(), monthly_report()] >> join

branching_example()
```

---

### Airflow Trigger Rules Reference

Trigger rules control **when a task is allowed to run** based on the state of its upstream tasks. The default is `all_success`.

```python
from airflow.utils.trigger_rule import TriggerRule
from airflow.operators.python import PythonOperator

# --- Trigger Rule Reference ---

# all_success (default): Run only if ALL upstream tasks succeeded
standard_task = PythonOperator(
    task_id="standard",
    python_callable=lambda: None,
    trigger_rule=TriggerRule.ALL_SUCCESS,   # Default — no need to specify
)

# all_failed: Run only if ALL upstream tasks failed (e.g., alert on total failure)
failure_alert = PythonOperator(
    task_id="send_failure_alert",
    python_callable=lambda: print("ALL upstream tasks failed — critical alert!"),
    trigger_rule=TriggerRule.ALL_FAILED,
)

# one_success: Run if at least one upstream task succeeded
partial_success = PythonOperator(
    task_id="partial_success_handler",
    python_callable=lambda: None,
    trigger_rule=TriggerRule.ONE_SUCCESS,
)

# one_failed: Run if at least one upstream task failed (e.g., partial failure alert)
partial_failure_alert = PythonOperator(
    task_id="partial_failure_alert",
    python_callable=lambda: print("At least one upstream task failed"),
    trigger_rule=TriggerRule.ONE_FAILED,
)

# none_failed: Run if no upstream tasks failed (success OR skipped are OK)
# Most useful for joining branches where some may be skipped
join_after_branch = EmptyOperator(
    task_id="join",
    trigger_rule=TriggerRule.NONE_FAILED,
)

# none_failed_min_one_success: Run if no tasks failed AND at least one succeeded
# The recommended choice for branch join points
safe_join = EmptyOperator(
    task_id="safe_join",
    trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
)

# all_done: Run when all upstream tasks are done, regardless of state
# Useful for cleanup tasks that must always run
cleanup = PythonOperator(
    task_id="cleanup_temp_files",
    python_callable=lambda: print("Always cleaning up"),
    trigger_rule=TriggerRule.ALL_DONE,
)
```

> [!tip] Branching + Trigger Rules
> When using `BranchPythonOperator` or `@task.branch`, tasks that are NOT chosen are **skipped**. A downstream join task with the default `all_success` trigger rule will also be skipped (because not all upstream tasks succeeded). Set the join task to `none_failed_min_one_success` to handle this correctly.

---

## Idempotent DAGs

An idempotent pipeline produces the same result whether run once or multiple times for the same time period. This is essential for safe retries and backfills. For a deeper treatment of idempotency beyond Airflow, see [idempotent-pipeline-design](/14-Data-Architecture/Pipeline-Patterns/idempotent-pipeline-design).

### Key Idempotency Settings

```python
with DAG(
    dag_id="idempotent_pipeline",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),

    # CRITICAL: Only one DAG Run active at a time
    # Prevents parallel runs from corrupting shared resources (a form of [race-conditions](/04-SQL-Server/Concurrency/race-conditions) prevention)
    max_active_runs=1,

    catchup=False,  # Don't auto-backfill — use explicit backfill commands
) as dag:
    pass
```

### `depends_on_past`

```python
# depends_on_past=True: a task only runs if the same task in the PREVIOUS
# DAG Run succeeded. Ensures strict ordering of incremental loads.

incremental_load = PythonOperator(
    task_id="incremental_load",
    python_callable=load_function,
    depends_on_past=True,   # Do not run today if yesterday failed
    # Use sparingly — creates a chain of dependencies that can block DAGs
    # if the first run ever fails. Hard to recover from without clearing tasks.
)
```

> [!warning] depends_on_past pitfalls
>
> `depends_on_past=True` is powerful but creates a chain-of-dependency that must be manually broken if the first historical run fails. Never use it without a plan for recovery (use `airflow tasks clear` to reset the chain). Prefer idempotent `MERGE`/`UPSERT` logic in the task itself over `depends_on_past`.

> [!danger] Non-transactional DELETE + INSERT
>
> If the pipeline crashes between DELETE and INSERT, the partition is empty. Always wrap delete-then-insert in a single transaction. In BigQuery, use scripted transactions (`BEGIN TRANSACTION ... COMMIT`). In SQL Server, use explicit `BEGIN TRAN ... COMMIT`. The MERGE pattern below is inherently atomic and preferred.

### Idempotent Task Design

```python
def idempotent_load(**context):
    """
    This task is idempotent: running it twice for the same date
    produces the same result as running it once.
    """
    ds = context["ds"]  # "2024-01-15"
    bq_hook = BigQueryHook()
```

```python
    # PATTERN 1: Delete-then-insert (partition overwrite)
    bq_hook.run_query(f"""
        DELETE FROM `project.dataset.table`
        WHERE DATE(created_at) = '{ds}'
    """, use_legacy_sql=False)

    bq_hook.run_query(f"""
        INSERT INTO `project.dataset.table`
        SELECT * FROM `project.dataset.staging_{ds.replace('-', '')}`
    """, use_legacy_sql=False)
```

```python
    # PATTERN 2: MERGE/UPSERT (safer for fact tables -- atomic)
    bq_hook.run_query(f"""
        MERGE `project.dataset.target` T
        USING (SELECT * FROM `project.dataset.staging`
               WHERE date = '{ds}') S
        ON T.id = S.id AND T.date = S.date
        WHEN MATCHED THEN
          UPDATE SET T.value = S.value,
                     T.updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
          INSERT (id, date, value, updated_at)
          VALUES (S.id, S.date, S.value, CURRENT_TIMESTAMP())
    """, use_legacy_sql=False)
```

---

### Airflow Backfill — Historical DAG Runs

Backfill runs a DAG for a historical date range. Use it for initial data loads, re-processing after bug fixes, or adding new pipeline coverage.

```bash
# Trigger a backfill for a date range
# Airflow creates DAG Runs for every scheduled interval in the range
airflow dags backfill \
    --dag-id my_pipeline \
    --start-date 2024-01-01 \
    --end-date 2024-03-31 \
    --reset-dagruns          # Re-run even if a DAG Run already exists for that date

# Dry run — show what would be backfilled without running anything
airflow dags backfill \
    --dag-id my_pipeline \
    --start-date 2024-01-01 \
    --end-date 2024-03-31 \
    --dry-run

# Run with limited parallelism to avoid overwhelming the target system
airflow dags backfill \
    --dag-id my_pipeline \
    --start-date 2024-01-01 \
    --end-date 2024-01-31 \
    --max-jobs 2             # Max 2 DAG Runs in parallel

# Mark a date range as success WITHOUT running tasks (when data already exists)
airflow dags backfill \
    --dag-id my_pipeline \
    --start-date 2024-01-01 \
    --end-date 2024-01-31 \
    --mark-success
```

> [!tip] Backfill and catchup=False
>
> Setting `catchup=False` does NOT prevent `airflow dags backfill` from working. It only prevents the Scheduler from automatically creating historical DAG Runs when a DAG is unpaused. Explicit backfills always work regardless of `catchup`.

---

## Parameterized DAGs

DAGs can accept runtime parameters via `dag_run.conf` (triggered via UI, CLI, or API).

### Params (Airflow 2.2+)

```python
from airflow import DAG
from airflow.models.param import Param

with DAG(
    dag_id="parameterized_pipeline",
    schedule=None,  # Manual trigger only
    start_date=datetime(2024, 1, 1),
    params={
        # Params define expected parameters with types and defaults
        "start_date": Param(
            default="2024-01-01",
            type="string",
            description="Start date for processing (YYYY-MM-DD)",
        ),
        "end_date": Param(
            default="2024-01-31",
            type="string",
        ),
        "target_dataset": Param(
            default="production",
            enum=["production", "staging", "dev"],
            description="Target BigQuery dataset",
        ),
        "dry_run": Param(default=False, type="boolean"),
    },
) as dag:

    def run_with_params(**context):
        # Access params via context["params"]
        params = context["params"]
        start = params["start_date"]
        end = params["end_date"]
        dataset = params["target_dataset"]
        dry_run = params["dry_run"]
        print(f"Processing {start} to {end} → {dataset} (dry_run={dry_run})")

    PythonOperator(task_id="run", python_callable=run_with_params)
```

#### Triggering with custom params

```bash
# CLI: pass params as JSON
airflow dags trigger parameterized_pipeline \
    --conf '{"start_date": "2024-06-01", "end_date": "2024-06-30", "target_dataset": "staging"}'

# REST API
curl -X POST "http://airflow:8080/api/v1/dags/parameterized_pipeline/dagRuns" \
    -H "Content-Type: application/json" \
    -u "admin:password" \
    -d '{"conf": {"start_date": "2024-06-01", "target_dataset": "staging"}}'
```

---

### Dataset-Driven Scheduling (Airflow 2.4+)

Data-aware scheduling allows a DAG to trigger when upstream DAGs produce a **Dataset** (a logical URI representing a data asset). This decouples producer and consumer DAGs.

```python
# dags/producer_dag.py
# Producer: this DAG "produces" a Dataset when it completes successfully

from airflow import DAG
from airflow.datasets import Dataset
from airflow.operators.python import PythonOperator
from datetime import datetime

# Define the Dataset — a logical URI (no actual file validation)
CUSTOMER_DATASET = Dataset("gs://my-bucket/data/customers/")
ORDERS_DATASET   = Dataset("gs://my-bucket/data/orders/")

with DAG(
    dag_id="produce_customers",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
) as dag:

    # outlets: declares that this task produces these Datasets on success
    PythonOperator(
        task_id="load_customers",
        python_callable=lambda: print("Loading customers"),
        outlets=[CUSTOMER_DATASET],  # Signals the Dataset as updated on task success
    )
```

```python
# dags/consumer_dag.py
# Consumer: triggers when ALL listed Datasets have been updated

from airflow import DAG
from airflow.datasets import Dataset
from airflow.operators.python import PythonOperator
from datetime import datetime

CUSTOMER_DATASET = Dataset("gs://my-bucket/data/customers/")
ORDERS_DATASET   = Dataset("gs://my-bucket/data/orders/")

with DAG(
    dag_id="build_customer_orders_report",
    # This DAG runs when BOTH datasets have been updated in the same scheduling cycle
    schedule=[CUSTOMER_DATASET, ORDERS_DATASET],
    start_date=datetime(2024, 1, 1),
    catchup=False,
) as dag:

    PythonOperator(
        task_id="build_report",
        python_callable=lambda: print("Building customer-orders report"),
    )
```

> [!info] Dataset Scheduling Semantics
> The consumer DAG triggers once ALL listed Datasets have been updated (at least once) since the last consumer DAG Run. It does NOT trigger once per producer run — it batches updates. The Scheduler checks Dataset updates and creates a consumer DAG Run when all conditions are met. This replaces polling with `ExternalTaskSensor` for many use cases.

---

## SLA Monitoring and Callbacks

### SLA (Service Level Agreement)

An SLA defines the maximum acceptable elapsed time from the scheduled time for a task to complete. If exceeded, Airflow sends an alert (email and/or callback).

```python
from datetime import timedelta

with DAG(
    dag_id="sla_monitored_pipeline",
    schedule="0 6 * * *",    # Scheduled at 06:00 UTC
    start_date=datetime(2024, 1, 1),
    # DAG-level SLA: alert if the DAG hasn't finished within 2 hours of its schedule
    # Note: DAG-level SLA is set per-task, not on the DAG object itself
) as dag:

    PythonOperator(
        task_id="critical_load",
        python_callable=lambda: None,
        sla=timedelta(hours=2),  # Alert if this task hasn't finished by 08:00 UTC
    )
```

### Callbacks

Callbacks are Python functions called by Airflow on specific task/DAG events. Use them for alerting (Slack, PagerDuty), logging to external systems, or triggering recovery workflows.

```python
def on_task_failure(context):
    """Called when any task in the DAG fails (if set in default_args)."""
    task_id = context["task_instance"].task_id
    dag_id = context["dag"].dag_id
    execution_date = context["execution_date"]
    exception = context.get("exception")

    # Example: send Slack notification
    send_slack_alert(
        channel="#data-alerts",
        message=f":red_circle: Task `{task_id}` in `{dag_id}` failed on {execution_date}\nError: {exception}",
    )

def on_task_success(context):
    """Called when a specific task succeeds."""
    rows = context["task_instance"].xcom_pull(key="return_value")
    print(f"Task succeeded, processed {rows} rows")

def on_dag_success(context):
    """Called when the entire DAG Run succeeds (dag-level callback)."""
    dag_run = context["dag_run"]
    print(f"DAG Run {dag_run.run_id} completed successfully")

def on_sla_miss(dag, task_list, blocking_task_list, slas, blocking_tis):
    """Called when an SLA is missed. Different signature from other callbacks."""
    print(f"SLA missed for tasks: {[t.task_id for t in task_list]}")
    send_pagerduty_alert(f"SLA miss in DAG {dag.dag_id}")

# Apply callbacks in default_args (apply to all tasks) or per-task
default_args = {
    "on_failure_callback": on_task_failure,
    "on_success_callback": on_task_success,  # Use sparingly — fires for every task
    "on_retry_callback": lambda ctx: print(f"Retrying task {ctx['task_instance'].task_id}"),
}

with DAG(
    dag_id="callback_example",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    default_args=default_args,
    on_success_callback=on_dag_success,     # DAG-level: fires when whole run succeeds
    on_failure_callback=on_task_failure,    # DAG-level: fires when any task fails and DAG Run fails
    sla_miss_callback=on_sla_miss,          # SLA miss callback (DAG-level only)
) as dag:

    critical_task = PythonOperator(
        task_id="critical",
        python_callable=lambda: None,
        sla=timedelta(hours=1),
        # Task-level callback overrides default_args callback for this task
        on_failure_callback=lambda ctx: print("CRITICAL task failed — paging on-call"),
    )
```

---

### Medallion Architecture DAG — Bronze to Silver to Gold

A full medallion architecture DAG using Task Groups, trigger rules, and callbacks. The bronze layer tasks here follow the patterns described in [bronze-layer-loading](/04-SQL-Server/Medallion-Project/bronze-layer-loading).

```python
# dags/medallion_pipeline.py
# Full Bronze → Silver → Gold pattern with quality gates

from airflow.decorators import dag, task
from airflow.utils.task_group import TaskGroup
from airflow.operators.empty import EmptyOperator
from airflow.utils.trigger_rule import TriggerRule
from datetime import datetime, timedelta

def alert_failure(context):
    """Send alert on any task failure."""
    ti = context["task_instance"]
    print(f"ALERT: {ti.dag_id}.{ti.task_id} failed on {context['ds']}")

@dag(
    dag_id="medallion_pipeline",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    default_args={
        "retries": 2,
        "retry_delay": timedelta(minutes=5),
        "on_failure_callback": alert_failure,
    },
    tags=["medallion", "data-platform"],
)
def medallion_pipeline():

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    with TaskGroup("bronze", tooltip="Raw ingestion from source systems") as bronze:

        @task(task_id="ingest_crm")
        def ingest_crm(ds=None):
            print(f"Ingesting CRM raw data for {ds}")
            return "gs://bucket/bronze/crm/" + ds

        @task(task_id="ingest_erp")
        def ingest_erp(ds=None):
            print(f"Ingesting ERP raw data for {ds}")
            return "gs://bucket/bronze/erp/" + ds

        crm_path = ingest_crm()
        erp_path = ingest_erp()

    with TaskGroup("silver", tooltip="Clean, validate, standardize") as silver:

        @task(task_id="clean_crm")
        def clean_crm(raw_path: str):
            print(f"Cleaning CRM from {raw_path}")
            return raw_path.replace("/bronze/", "/silver/")

        @task(task_id="clean_erp")
        def clean_erp(raw_path: str):
            print(f"Cleaning ERP from {raw_path}")
            return raw_path.replace("/bronze/", "/silver/")

        @task(task_id="quality_gate", trigger_rule=TriggerRule.ALL_SUCCESS)
        def quality_gate(crm_path: str, erp_path: str):
            print(f"Quality gate: validating {crm_path} and {erp_path}")
            return True

        clean_crm_result = clean_crm(crm_path)
        clean_erp_result = clean_erp(erp_path)
        quality_gate(clean_crm_result, clean_erp_result)

    with TaskGroup("gold", tooltip="Build analytical models") as gold:

        @task(task_id="build_customer_dim")
        def build_customer_dim():
            print("Building customer dimension")

        @task(task_id="build_sales_fact")
        def build_sales_fact():
            print("Building sales fact table")

        build_customer_dim() >> build_sales_fact()

    start >> bronze >> silver >> gold >> end

medallion_pipeline()
```

---

## Related Notes

- [[airflow-core-concepts]] — DAG structure, Operators, Sensors, XComs, TaskFlow API
- [[airflow-deployment]] — Docker Compose setup, Cloud Composer, CI/CD for DAGs
- [[airflow-troubleshooting]] — Debugging dynamic DAGs, trigger rule issues, backfill problems

## References

- [Airflow DAG documentation](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
- [Dynamic Task Mapping](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/dynamic-task-mapping.html)
- [Dataset Scheduling](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/datasets.html)
- [Trigger Rules](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#trigger-rules)
- [Task Groups](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#taskgroups)
