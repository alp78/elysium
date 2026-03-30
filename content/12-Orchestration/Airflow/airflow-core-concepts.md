---
type: concept
category: orchestration
technology: [airflow, python]
tags: [orchestration, python, airflow]
aliases:
  - Apache Airflow
  - Airflow
  - DAG
  - Directed Acyclic Graph
  - Airflow Operator
  - Airflow Task
  - Airflow Sensor
  - Airflow Hook
  - Airflow Connection
  - XCom
  - Cross-task communication
  - Airflow Executor
  - Airflow Scheduler
  - Airflow Worker
  - Airflow Webserver
  - Metadata Database
  - TaskFlow API
  - Airflow Variables
  - Airflow Connections
  - CeleryExecutor
  - KubernetesExecutor
  - LocalExecutor
  - SequentialExecutor
keywords:
  - airflow
  - apache airflow
  - DAG
  - directed acyclic graph
  - operator
  - task
  - sensor
  - hook
  - connection
  - xcom
  - executor
  - scheduler
  - worker
  - metadata database
  - taskflow
  - python decorator
  - workflow orchestration
  - pipeline orchestration
  - BashOperator
  - PythonOperator
  - KubernetesPodOperator
  - celery
  - dag scheduling
  - airflow architecture
description: "Comprehensive reference for Apache Airflow core concepts: architecture (Scheduler, Webserver, Worker, Metadata DB, Executor), DAGs, Operators, Sensors, Hooks, XComs, the TaskFlow API, and a comparison of all Executor types."
related:
  - airflow-dag-patterns
  - airflow-deployment
  - airflow-troubleshooting
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Apache Airflow Core Concepts

Apache Airflow is an open-source **workflow orchestration platform** for programmatically authoring, scheduling, monitoring, and managing data pipelines. Pipelines are defined as Python code, making them version-controllable, testable, and dynamically generated.

> [!warning] What Airflow is NOT
>
> Airflow is **not a data processing framework**. It does not move or transform data itself — it **orchestrates** tools that do. Think of Airflow as the conductor, not the orchestra. Data processing happens in Spark, dbt, BigQuery, or Python scripts that Airflow triggers. Treating Airflow as a data-processing engine (e.g., loading large DataFrames into XComs) is the single most common architectural mistake.

---

## Architecture Overview

Airflow has five core components that work together. Understanding each is essential for deployment, debugging, and performance tuning.

```
┌────────────────────────────────────────────────────────┐
│                      Airflow Architecture               │
│                                                        │
│  ┌──────────┐   schedules   ┌──────────────────────┐  │
│  │Scheduler │──────────────►│  Executor             │  │
│  │          │               │  (Local/Celery/K8s)   │  │
│  └──────┬───┘               └──────────┬────────────┘  │
│         │                              │               │
│         ▼                              ▼               │
│  ┌──────────────┐           ┌──────────────────────┐  │
│  │ Metadata DB  │◄─────────►│  Workers             │  │
│  │ (PostgreSQL) │           │  (run task instances) │  │
│  └──────────────┘           └──────────────────────┘  │
│         ▲                                              │
│         │                                              │
│  ┌──────┴───┐                                          │
│  │Webserver │  (UI + REST API)                        │
│  └──────────┘                                          │
└────────────────────────────────────────────────────────┘
```

### Scheduler

The Scheduler is the brain of Airflow. It continuously:

1. Parses DAG files from the DAGs folder on a configurable interval (`min_file_process_interval`, default 30 s)
2. Determines which DAG Runs to create based on `schedule` and `start_date`
3. Determines which Tasks are eligible to run (dependencies met, slots available)
4. Submits eligible Task Instances to the Executor

> [!info] Scheduler HA
> In Airflow 2.0+, you can run **multiple Scheduler instances** for high availability. Use `scheduler_heartbeat_sec` to configure the heartbeat. Only one scheduler actively creates DAG Runs at a time — the others act as hot standbys.

### Webserver

A Flask/Gunicorn web application that provides:
- The Airflow UI (DAG grid view, Gantt chart, Graph view, Log viewer)
- A REST API (Airflow 2.x stable API at `/api/v1/`)
- Flower UI (if using CeleryExecutor)

The webserver reads from the Metadata DB — it does **not** schedule tasks.

### Workers

Workers are processes (or pods) that **execute Task Instances**. What "worker" means depends on the Executor:
- **LocalExecutor**: subprocesses on the Scheduler machine
- **CeleryExecutor**: Celery worker processes on separate machines
- **KubernetesExecutor**: ephemeral Kubernetes pods, each following its own [container-lifecycle](/09-Docker/container-lifecycle)

### Metadata Database

PostgreSQL (recommended) or MySQL database that stores:
- DAG definitions (serialized)
- DAG Run history
- Task Instance state (queued, running, success, failed, skipped)
- XComs
- Variables and Connections
- User/Role/Permission data

> [!warning] Database is Critical
> The Metadata DB is a single point of failure. Use a managed database (Cloud SQL, RDS, AlloyDB) in production with automated backups and HA failover.

### Executor

The Executor determines **how** tasks are run. See the [[#Executors Comparison Table]] section below.

---

## DAGs: Directed Acyclic Graphs

A DAG (Directed Acyclic Graph) is the core abstraction in Airflow. It represents a workflow as a set of tasks with dependencies between them. The graph must be **acyclic** — no circular dependencies.

### DAG File Structure

Airflow discovers DAGs by scanning Python files in the `dags_folder` (default: `$AIRFLOW_HOME/dags`). A file is a valid DAG file if it contains a `DAG` object at the module level.

#### Minimal valid DAG

```python
# dags/minimal_example.py
# This is the simplest possible valid Airflow DAG.
from airflow import DAG
from airflow.operators.empty import EmptyOperator
from datetime import datetime

with DAG(
    dag_id="minimal_example",
    start_date=datetime(2024, 1, 1),
    schedule="@daily",
) as dag:
    EmptyOperator(task_id="start")
```

### Complete DAG with All Common Parameters

```python
# dags/comprehensive_example.py
# Production-quality DAG template demonstrating all common parameters.

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago
from datetime import datetime, timedelta

# default_args apply to every task in the DAG unless overridden at the task level
default_args = {
    "owner": "data-engineering",           # Owner shown in the UI
    "depends_on_past": False,              # Task does not wait for previous run's same task to succeed
    "email": ["alerts@example.com"],       # Email list for notifications
    "email_on_failure": True,             # Send email when a task fails
    "email_on_retry": False,              # Do NOT email on every retry (noisy)
    "retries": 3,                         # Number of retry attempts on failure
    "retry_delay": timedelta(minutes=5),  # Wait 5 minutes between retries
    "retry_exponential_backoff": False,    # Use fixed delay (not exponential)
    "execution_timeout": timedelta(hours=2),  # Kill task if it runs longer than 2h
    "sla": timedelta(hours=4),            # Alert if task hasn't finished within 4h of scheduled time
}

with DAG(
    dag_id="comprehensive_example",        # Unique identifier — shown in the UI
    description="Demonstrates all common DAG parameters",
    schedule="0 6 * * *",                 # Run at 06:00 UTC daily (cron expression)
    start_date=datetime(2024, 1, 1),      # First logical date to run
    end_date=None,                         # Run indefinitely (set a date to stop)
    catchup=False,                         # IMPORTANT: do NOT backfill missed runs automatically
    max_active_runs=1,                     # Only 1 DAG Run active at a time (prevents overlap)
    max_active_tasks=16,                   # Max concurrent tasks across all active runs
    default_args=default_args,
    tags=["example", "data-engineering"], # Tags for filtering in the UI
    doc_md="""
    ## Comprehensive Example DAG

    This DAG demonstrates all common parameters.
    It runs daily at 06:00 UTC and processes data for the previous day.
    """,
    params={                               # User-overridable runtime parameters
        "environment": "production",
        "dry_run": False,
    },
    render_template_as_native_obj=False,   # Keep Jinja-rendered values as strings (default)
    is_paused_upon_creation=True,          # DAG starts paused — must be manually unpaused
) as dag:

    # EmptyOperator: a no-op task used as a start/end marker or join point
    start = EmptyOperator(task_id="start")

    # BashOperator: runs a shell command
    extract = BashOperator(
        task_id="extract_data",
        bash_command="python /opt/scripts/extract.py --date {{ ds }}",
        # {{ ds }} is the execution date in YYYY-MM-DD format (Jinja templating)
        env={"GOOGLE_APPLICATION_CREDENTIALS": "/opt/secrets/sa-key.json"},
    )

    def transform_data(**context):
        """Transform function — receives the Airflow context dict."""
        execution_date = context["ds"]
        logical_date = context["logical_date"]
        print(f"Transforming data for {execution_date}")
        return {"rows_processed": 1000}  # Automatically pushed to XCom

    # PythonOperator: runs a Python callable
    transform = PythonOperator(
        task_id="transform_data",
        python_callable=transform_data,
        provide_context=True,  # Pass the Airflow context dict as **kwargs
    )

    load = BashOperator(
        task_id="load_data",
        bash_command="bq load --source_format=NEWLINE_DELIMITED_JSON "
                     "dataset.table gs://bucket/data/{{ ds }}/*.json",
    )

    end = EmptyOperator(task_id="end")

    # Task dependency chain using >> (bitshift operator)
    start >> extract >> transform >> load >> end
```

> [!tip] catchup=False is almost always right
>
> With `catchup=True` (the default), Airflow creates a DAG Run for every missed interval between `start_date` and now when the DAG is first unpaused. For a DAG with `start_date=2024-01-01` and `schedule="@daily"`, that could be hundreds of runs. Always set `catchup=False` unless you explicitly need historical backfill, and use `airflow dags backfill` for intentional backfills.

### Schedule Values

```python
# All valid forms of the `schedule` parameter

schedule="@daily"          # Alias: run once per day at midnight UTC
schedule="@hourly"         # Alias: run once per hour
schedule="@weekly"         # Alias: run once per week (Sunday midnight)
schedule="@monthly"        # Alias: run once per month (1st day, midnight)
schedule="@once"           # Run exactly once
schedule=None              # Never scheduled — trigger manually only

# Cron expressions (minute hour day-of-month month day-of-week)
schedule="0 6 * * *"       # 06:00 UTC every day
schedule="0 */6 * * *"     # Every 6 hours
schedule="30 4 1 * *"      # 04:30 UTC on the 1st of every month
schedule="0 8 * * 1-5"     # 08:00 UTC weekdays only

# Timedelta (Airflow 2.4+)
from datetime import timedelta
schedule=timedelta(hours=6)  # Every 6 hours from start_date

# Dataset-driven scheduling (Airflow 2.4+) — see airflow-dag-patterns
from airflow.datasets import Dataset
schedule=[Dataset("gs://my-bucket/input/")]
```

---

## Operators

An Operator defines a **single unit of work** in a DAG. Each Operator becomes one Task in the DAG. Operators are templates — instantiating one creates a Task Instance when a DAG Run executes.

### BashOperator

Runs a bash command or script. The most versatile operator for calling external scripts.

```python
from airflow.operators.bash import BashOperator

# Run an inline bash command with Jinja templating
run_script = BashOperator(
    task_id="run_etl_script",
    bash_command="python /opt/etl/load_bq.py --date {{ ds }} --env {{ params.environment }}",
    cwd="/opt/etl",                      # Working directory for the command
    env={"MY_VAR": "value"},             # Additional environment variables
    append_env=True,                     # Keep existing env vars (don't replace)
    output_encoding="utf-8",
    skip_on_exit_code=[99],              # Exit code 99 causes task to SKIP instead of fail
    do_xcom_push=True,                   # Push stdout to XCom key "return_value"
)
```

### PythonOperator

Calls a Python function. Pass arguments via `op_kwargs` or read from XCom via context.

```python
from airflow.operators.python import PythonOperator

def my_python_function(param1, param2, **context):
    """
    context contains: ds, ts, logical_date, dag, task, run_id, etc.
    Return value is pushed to XCom as "return_value".
    """
    from google.cloud import bigquery
    client = bigquery.Client()
    # ... do work ...
    return {"rows_inserted": 500}

run_python = PythonOperator(
    task_id="run_python",
    python_callable=my_python_function,
    op_kwargs={                          # Keyword arguments passed to the callable
        "param1": "value1",
        "param2": "{{ ds }}",           # Jinja templating works in op_kwargs
    },
)
```

### DockerOperator

Runs a Docker container. Ideal for isolating dependencies per task.

```python
from airflow.providers.docker.operators.docker import DockerOperator

run_container = DockerOperator(
    task_id="run_docker_task",
    image="my-registry/etl-image:1.2.3",  # Docker image to run
    command="python /app/process.py --date {{ ds }}",
    docker_url="unix://var/run/docker.sock",
    network_mode="bridge",
    environment={"DATE": "{{ ds }}"},
    auto_remove=True,                    # Remove container after execution
    mount_tmp_dir=False,
)
```

### KubernetesPodOperator

Runs a Kubernetes Pod. The preferred operator for GCP Cloud Composer and self-managed K8s Airflow.

> [!warning] KubernetesPodOperator Image Tag :latest Causes Silent Stale Deploys
> Using `:latest` as the image tag means Kubernetes may use a cached image from the node instead of pulling the newest version. Pin image tags to a specific version or SHA digest (e.g., `etl:1.2.3` or `etl@sha256:abc...`). Set `image_pull_policy="Always"` if you must use `:latest` during development.

```python
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from kubernetes.client import models as k8s

run_pod = KubernetesPodOperator(
    task_id="run_k8s_task",
    name="etl-task-pod",                # Pod name prefix
    namespace="airflow",                # K8s namespace
    image="gcr.io/my-project/etl:latest",
    cmds=["python"],
    arguments=["/app/process.py", "--date", "{{ ds }}"],
    env_vars=[
        k8s.V1EnvVar(name="DATE", value="{{ ds }}"),
    ],
    resources=k8s.V1ResourceRequirements(
        requests={"memory": "512Mi", "cpu": "500m"},
        limits={"memory": "2Gi", "cpu": "2"},
    ),
    in_cluster=True,                    # True when Airflow itself runs in K8s
    get_logs=True,                      # Stream pod logs to Airflow task logs
    is_delete_operator_pod=True,        # Clean up pod after completion
    startup_timeout_seconds=300,
)
```

### EmptyOperator

A no-op task. Used for start/end markers, fan-out/fan-in join points, and conditional branching targets.

```python
from airflow.operators.empty import EmptyOperator

# Use as a join point after parallel branches
join = EmptyOperator(
    task_id="join",
    trigger_rule="none_failed_min_one_success",  # Proceed if at least one branch succeeded
)
```

---

### Airflow Sensors — Poke and Reschedule Modes

Sensors are a special type of Operator that **poke** an external system until a condition is met, then succeed. They block a task slot while waiting.

> [!warning] Sensor Mode: Poke vs Reschedule
> Default sensor mode is `poke` — the sensor holds a worker slot the entire time it waits. For long-running sensors (hours), use `mode="reschedule"` — the sensor releases the slot between checks and reacquires it only to check again. This is critical for preventing slot starvation.

```python
from airflow.sensors.filesystem import FileSensor
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.sensors.http import HttpSensor
from airflow.providers.common.sql.sensors.sql import SqlSensor

# Wait for a file to exist on the filesystem
wait_for_file = FileSensor(
    task_id="wait_for_input_file",
    filepath="/data/input/{{ ds }}/ready.flag",
    fs_conn_id="fs_default",
    mode="reschedule",               # Release slot between checks
    poke_interval=60,                # Check every 60 seconds
    timeout=3600,                    # Fail after 1 hour of waiting
    soft_fail=False,                 # True = SKIP instead of FAIL on timeout
)

# Wait for another DAG's task to complete
wait_for_upstream = ExternalTaskSensor(
    task_id="wait_for_upstream_dag",
    external_dag_id="upstream_pipeline",
    external_task_id="load_complete",       # None = wait for whole DAG Run
    execution_date_fn=None,                 # Use same execution date by default
    mode="reschedule",
    poke_interval=120,
    timeout=7200,
    check_existence=True,                   # Fail if the external DAG doesn't exist
)

# Wait for an HTTP endpoint to return 200
wait_for_api = HttpSensor(
    task_id="wait_for_api_ready",
    http_conn_id="my_api",
    endpoint="/health",
    request_params={},
    response_check=lambda response: response.json()["status"] == "ready",
    mode="reschedule",
    poke_interval=30,
)

# Wait for a SQL query to return rows
wait_for_data = SqlSensor(
    task_id="wait_for_data_loaded",
    conn_id="my_postgres",
    sql="SELECT COUNT(*) FROM staging.events WHERE date = '{{ ds }}'",
    success=lambda result: result[0][0] > 0,  # Succeed when count > 0
    mode="reschedule",
    poke_interval=300,
)
```

---

## Hooks and Connections

### Connections

A **Connection** stores credentials for external systems (databases, APIs, cloud services). Stored in the Metadata DB (encrypted) or externally (Secret Manager, env vars).

#### Setting a connection via environment variable (preferred for secrets -- see [environment-variables](/01-Shell/Scripting/environment-variables) for general env var patterns)

```bash
# Format: AIRFLOW_CONN_{CONN_ID} = URI or JSON
# URI format: conn-type://login:password@host:port/schema?extra=value

export AIRFLOW_CONN_MY_POSTGRES="postgresql://user:pass@localhost:5432/mydb"
export AIRFLOW_CONN_BIGQUERY_DEFAULT='{"conn_type": "google_cloud_platform", "project": "my-project", "keyfile_path": "/opt/secrets/sa.json"}'

# Or set via CLI
airflow connections add my_postgres \
    --conn-type postgres \
    --conn-host localhost \
    --conn-login user \
    --conn-password secret \
    --conn-port 5432 \
    --conn-schema mydb
```

#### Setting a connection via the Airflow UI
Admin → Connections → + (Add) → Fill in conn_id, conn_type, host, login, password, port, schema, Extra (JSON).

### Hooks

A **Hook** is a Python class that wraps a Connection and provides methods for interacting with an external system. Operators use Hooks internally. You can also use Hooks directly in PythonOperator callables.

```python
# Using hooks directly inside a PythonOperator callable
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.google.cloud.hooks.bigquery import BigQueryHook
from airflow.providers.google.cloud.hooks.gcs import GCSHook

def load_postgres_to_bq(**context):
    """Extract from Postgres and load to BigQuery using hooks."""

    # PostgresHook uses the "my_postgres" connection
    pg_hook = PostgresHook(postgres_conn_id="my_postgres")
    records = pg_hook.get_records(
        sql="SELECT id, name, value FROM source.table WHERE date = %(date)s",
        parameters={"date": context["ds"]},
    )

    # GCSHook for writing intermediate files
    gcs_hook = GCSHook(gcp_conn_id="google_cloud_default")
    gcs_hook.upload(
        bucket_name="my-bucket",
        object_name=f"staging/{context['ds']}/data.json",
        data=str(records).encode(),
        mime_type="application/json",
    )

    # BigQueryHook for running queries
    bq_hook = BigQueryHook(gcp_conn_id="google_cloud_default")
    bq_hook.run_query(
        sql=f"CALL my_dataset.load_procedure('{context['ds']}')",
        use_legacy_sql=False,
    )
```

---

### XComs — Cross-Task Communication

XComs (Cross-Communications) allow tasks to exchange small messages via the Metadata DB. A task **pushes** a value; downstream tasks **pull** it.

> [!warning] XCom Size Limit
> XComs are stored in the Metadata DB. The default serialization backend (pickle/JSON) has a practical limit of **~48 KB** in most configurations. Do NOT use XComs to pass DataFrames, file contents, or large result sets. Instead, write data to GCS/S3 and pass the **path** as the XCom value. See [[airflow-troubleshooting]] for the "XCom too large" error.

```python
# --- Pushing XComs ---

def push_xcom(**context):
    """Multiple ways to push XComs."""

    # Method 1: Return value (automatically pushed as key="return_value")
    return {"rows_processed": 500, "output_path": "gs://bucket/data/2024-01-01/"}

def push_xcom_explicit(**context):
    """Method 2: Explicit push with custom key."""
    context["task_instance"].xcom_push(
        key="output_path",
        value="gs://bucket/data/2024-01-01/",
    )
    context["task_instance"].xcom_push(
        key="row_count",
        value=500,
    )

# --- Pulling XComs ---

def pull_xcom(**context):
    """Pull XComs from upstream tasks."""
    ti = context["task_instance"]

    # Pull the return value (key="return_value") from a specific task
    result = ti.xcom_pull(task_ids="push_task")

    # Pull a specific key from a specific task
    output_path = ti.xcom_pull(task_ids="push_task", key="output_path")

    # Pull from multiple tasks
    all_paths = ti.xcom_pull(task_ids=["task_a", "task_b"], key="output_path")

    print(f"Processing file: {output_path}")

# XComs are also available in Jinja templates:
load_task = BashOperator(
    task_id="load",
    bash_command="gsutil cp {{ ti.xcom_pull(task_ids='extract', key='output_path') }} /tmp/",
)
```

---

### TaskFlow API — Decorator-Based DAG Authoring

Introduced in Airflow 2.0, the TaskFlow API uses Python decorators to define tasks and automatically handle XCom push/pull. It dramatically reduces boilerplate.

```python
# dags/taskflow_example.py
# TaskFlow API: cleaner syntax for Python-heavy DAGs

from airflow.decorators import dag, task
from datetime import datetime

@dag(
    dag_id="taskflow_example",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["example", "taskflow"],
)
def taskflow_pipeline():
    """
    A TaskFlow DAG. Each @task function becomes an Airflow task.
    Return values are automatically pushed/pulled as XComs.
    """

    @task
    def extract(ds=None):
        """Extract data — ds is auto-injected from context."""
        print(f"Extracting data for {ds}")
        # Return value is automatically pushed as an XCom
        return {"data_path": f"gs://bucket/raw/{ds}/data.json", "record_count": 1000}

    @task
    def transform(extract_result: dict) -> dict:
        """Transform — extract_result is automatically pulled from XCom."""
        path = extract_result["data_path"]
        count = extract_result["record_count"]
        print(f"Transforming {count} records from {path}")
        return {"output_path": path.replace("/raw/", "/transformed/"), "count": count}

    @task
    def load(transform_result: dict) -> None:
        """Load — no return value needed."""
        print(f"Loading {transform_result['count']} records from {transform_result['output_path']}")

    # TaskFlow wires dependencies automatically via XCom
    raw = extract()
    transformed = transform(raw)
    load(transformed)

# Instantiate the DAG
taskflow_pipeline()
```

```python
# TaskFlow: branching with @task.branch
from airflow.decorators import dag, task
from airflow.operators.empty import EmptyOperator

@dag(schedule="@daily", start_date=datetime(2024, 1, 1), catchup=False)
def branching_taskflow():

    @task.branch
    def choose_branch(ds=None):
        """Return the task_id of the branch to follow."""
        from datetime import datetime
        day_of_week = datetime.strptime(ds, "%Y-%m-%d").weekday()
        if day_of_week == 0:  # Monday
            return "run_weekly_report"
        return "run_daily_report"

    @task
    def run_daily_report():
        print("Running daily report")

    @task
    def run_weekly_report():
        print("Running weekly report")

    join = EmptyOperator(task_id="join", trigger_rule="none_failed_min_one_success")

    branch = choose_branch()
    [run_daily_report(), run_weekly_report()] >> join

branching_taskflow()
```

---

## Variables and Connections

> [!warning] Variable.get() at Module Level Runs on Every DAG Parse (Every 30s)
> Code at module level runs during DAG parsing, not during task execution. A `Variable.get()` at module level hits the Metadata DB every 30 seconds per DAG file. With 50 DAG files, that is 100 DB queries per minute just for variable resolution. Always call `Variable.get()` inside task callables, never at the top of the DAG file.

### Variables

Key-value pairs stored in the Metadata DB. Used for configuration that needs to change without modifying DAG code.

```python
from airflow.models import Variable

# In a task callable -- fetches from DB on each call
def use_variable(**context):
    # Get a variable (raises KeyError if missing)
    env = Variable.get("environment")

    # Get with default (never raises)
    dry_run = Variable.get("dry_run", default_var="false")

    # Get JSON variable (deserialize automatically)
    config = Variable.get("pipeline_config", deserialize_json=True)
    batch_size = config["batch_size"]
```

#### Setting variables

```bash
# CLI
airflow variables set environment production
airflow variables set pipeline_config '{"batch_size": 1000, "timeout": 300}'

# Environment variable (overrides DB — preferred for secrets)
export AIRFLOW_VAR_ENVIRONMENT=production
export AIRFLOW_VAR_PIPELINE_CONFIG='{"batch_size": 1000}'
```

> [!tip] Variable Caching
> Each `Variable.get()` call hits the Metadata DB. In large DAGs with many tasks, this adds up. Use `Variable.get()` once per task, or fetch at module level with caution (DAG-level fetches run during parsing, not execution).

---

## Executors Comparison Table

The Executor determines how Airflow runs tasks. Choose based on your scale, infrastructure, and operational requirements.

| Executor | Parallelism | Infrastructure | Best For | Limitations |
|---|---|---|---|---|
| **SequentialExecutor** | 1 task at a time | None (SQLite default) | Local dev/testing only | Not for production; single-threaded |
| **LocalExecutor** | Multiple (configurable) | PostgreSQL/MySQL required | Small/medium teams, single machine | Limited by one machine's resources |
| **CeleryExecutor** | Horizontal scale | Redis/RabbitMQ + worker fleet | Large scale, many concurrent tasks | Complex ops: Celery + message broker |
| **KubernetesExecutor** | Horizontal scale | Kubernetes cluster | Cloud-native, task isolation, dynamic resources | K8s overhead, cold start latency per task |
| **CeleryKubernetesExecutor** | Hybrid | Celery + Kubernetes | Mixed workloads | Most complex to operate |
| **LocalKubernetesExecutor** | Hybrid | Kubernetes | Cloud Composer (managed) | Managed only; not self-hosted |

### LocalExecutor

```ini
# airflow.cfg
[core]
executor = LocalExecutor

[database]
sql_alchemy_conn = postgresql+psycopg2://airflow:airflow@localhost/airflow

[core]
parallelism = 32                    # Max tasks running across all DAGs
max_active_tasks_per_dag = 16       # Max tasks per DAG Run
```

### CeleryExecutor

```ini
# airflow.cfg
[core]
executor = CeleryExecutor

[celery]
broker_url = redis://redis:6379/0
result_backend = db+postgresql://airflow:airflow@postgres/airflow
worker_concurrency = 16             # Tasks per Celery worker process
```

### KubernetesExecutor

```ini
# airflow.cfg
[core]
executor = KubernetesExecutor

[kubernetes]
namespace = airflow
in_cluster = True
worker_container_repository = apache/airflow
worker_container_tag = 2.9.0
delete_worker_pods = True
```

> [!info] Cloud Composer Uses LocalKubernetesExecutor
> Google Cloud Composer (managed Airflow) uses the `LocalKubernetesExecutor` by default, which routes tasks either to local workers or K8s pods based on configuration. You cannot change the executor in Cloud Composer. See [[airflow-deployment]] for Cloud Composer specifics.

> [!tip] Related pattern
> Most local and self-hosted Airflow deployments use [docker-compose](/09-Docker/docker-compose) to run the Scheduler, Webserver, and Metadata DB as coordinated containers. The [[airflow-deployment]] note walks through the full `docker-compose.yaml` setup.

---

### Jinja Templating in Airflow Operators

Airflow uses Jinja2 templating in `template_fields` of Operators. Common template variables:

```python
# Common Jinja template variables available in Operators
"{{ ds }}"                     # Execution date: "2024-01-15"
"{{ ds_nodash }}"              # Execution date no dashes: "20240115"
"{{ ts }}"                     # Timestamp: "2024-01-15T06:00:00+00:00"
"{{ logical_date }}"           # Pendulum datetime object
"{{ data_interval_start }}"    # Start of the data interval
"{{ data_interval_end }}"      # End of the data interval
"{{ run_id }}"                 # Run ID string: "scheduled__2024-01-15T06:00:00+00:00"
"{{ dag.dag_id }}"             # DAG ID
"{{ task.task_id }}"           # Task ID
"{{ params.my_param }}"        # Access DAG/run params
"{{ var.value.my_var }}"       # Access Airflow Variables
"{{ conn.my_conn.host }}"      # Access Connection fields
"{{ ti.xcom_pull('task_id') }}"  # Pull XCom in template
```

---

## Related Notes

- [error-handling-and-retry-patterns](/14-Data-Architecture/Pipeline-Patterns/error-handling-and-retry-patterns) — Error classification, retry strategies, and failure propagation theory behind Airflow's retry mechanics
- [[airflow-dag-patterns]] — Task dependencies, dynamic DAGs, branching, trigger rules
- [[airflow-deployment]] — Docker Compose, Cloud Composer, CI/CD for DAGs
- [[airflow-troubleshooting]] — Common errors, debugging CLI commands, log locations

## References

- [Apache Airflow Official Documentation](https://airflow.apache.org/docs/)
- [Airflow REST API Reference](https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html)
- [TaskFlow API Tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
- [Airflow Best Practices](https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)
