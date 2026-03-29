---
type: troubleshooting
category: orchestration
technology: [airflow, python]
tags: [orchestration, python, airflow]
aliases:
  - Airflow DAG import errors
  - Airflow task failure
  - Airflow scheduler stuck
  - Airflow scheduler not picking up DAGs
  - Airflow tasks stuck in queued
  - Airflow tasks stuck in running
  - Airflow connection refused metadata database
  - Airflow XCom too large
  - Airflow deadlock metadata DB
  - Airflow worker killed OOM
  - Airflow zombie task
  - Airflow debugging
  - airflow tasks test
  - airflow dags list
  - airflow tasks clear
  - Airflow log locations
  - Airflow DAG serialization
  - Airflow slow DAG parsing
  - Airflow webserver port 8080
  - airflow db check
  - airflow db clean
keywords:
  - airflow troubleshooting
  - dag import error
  - airflow syntax error
  - missing module airflow
  - task non-zero exit code
  - scheduler not picking up dags
  - tasks stuck queued
  - tasks stuck running
  - connection refused postgres
  - xcom too large
  - xcom size limit
  - airflow deadlock
  - worker killed OOM
  - out of memory celery worker
  - zombie task
  - airflow dags list
  - airflow tasks test
  - airflow tasks run
  - airflow tasks clear
  - airflow dags trigger
  - airflow log location
  - dag serialization error
  - airflow db maintenance
  - scheduler heartbeat
  - slow dag parsing
  - too many dags
  - airflow performance
  - airflow webserver not starting
description: "Comprehensive Airflow troubleshooting guide covering the most common errors with exact error messages and fixes: DAG import errors, stuck tasks, scheduler issues, XCom size limits, metadata DB deadlocks, OOM worker kills, and slow DAG parsing. Includes the full debugging CLI reference."
related:
  - airflow-core-concepts
  - airflow-dag-patterns
  - airflow-deployment
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Airflow Troubleshooting Guide

A reference for diagnosing and fixing the most common Apache Airflow problems encountered in production data engineering. Each issue includes the exact error message or symptom, root cause analysis, and step-by-step resolution. To test your troubleshooting skills against realistic scenarios, work through [[airflow-problems]].

> [!info] Structure
> Issues are organized by symptom. Use `Ctrl+F` to search for an exact error message. For CLI commands used in debugging, see the [[#CLI Debugging Reference]] section.

---

> [!danger] DAG Import Errors Are Silent in the Scheduler Logs
> When a DAG file has a Python syntax error or missing import, the Scheduler logs a warning but continues processing other DAGs. The broken DAG simply vanishes from the UI with no alert. If you rely on DAG-level failure callbacks for alerting, they will NOT fire for import errors because the DAG never loads. Monitor the `airflow.dag_processing.import_errors` metric in Datadog and alert when it exceeds 0.

## Issue 1: DAG Import Errors

**Symptom:** The Airflow UI shows a red banner: `DAG Import Errors` on the DAGs list page, or a specific DAG has an "Import Error" badge. The DAG does not appear as runnable.

#### Where to look first

```bash
# List all current import errors
airflow dags list-import-errors

# Or check the scheduler log — import errors appear here as they are parsed
journalctl -u airflow-scheduler -n 200 | grep -i "import error|broken dag|error loading"

# For Docker Compose setups
docker compose logs airflow-scheduler | grep -i "error|import"
```

### Root Cause 1a: Python Syntax Error

#### Error message in logs — Root Cause 1a: Python Syntax Error
```
Broken DAG: [/opt/airflow/dags/my_dag.py] Traceback (most recent call last):
  File "/opt/airflow/dags/my_dag.py", line 24
    from airflow.operators.python import PythonOperator
    ^
SyntaxError: invalid syntax
```

**Fix:** Validate the file before deploying.

```bash
# Check Python syntax without importing Airflow
python -m py_compile /opt/airflow/dags/my_dag.py
echo $?  # 0 = OK, 1 = syntax error

# Get the full error
python -c "import ast; ast.parse(open('/opt/airflow/dags/my_dag.py').read())"

# In CI/CD — always run this before deploying
find ./dags -name "*.py" -exec python -m py_compile {} \; && echo "All DAGs syntax OK"
```

### Root Cause 1b: Missing Python Module

#### Error message — Root Cause 1b: Missing Python Module
```
Broken DAG: [/opt/airflow/dags/my_dag.py] Traceback (most recent call last):
  File "/opt/airflow/dags/my_dag.py", line 3, in <module>
    from google.cloud import bigquery
ModuleNotFoundError: No module named 'google.cloud.bigquery'
```

**Fix:** Install the missing package in all Airflow components (Scheduler, Webserver, Workers all need it).

```bash
# For Docker Compose: add to requirements.txt and rebuild
echo "google-cloud-bigquery==3.15.0" >> requirements.txt
docker compose build
docker compose up -d

# For Cloud Composer: install via gcloud
gcloud composer environments update my-env \
    --location us-central1 \
    --update-pypi-package google-cloud-bigquery==3.15.0

# For self-hosted: install in the Airflow virtual environment
source ~/airflow-venv/bin/activate
pip install google-cloud-bigquery==3.15.0
# Then restart the scheduler and webserver
sudo systemctl restart airflow-scheduler airflow-webserver
```

### Root Cause 1c: Import at Module Level (Parse-Time Error)

**Symptom:** The DAG has a database call, API call, or slow/failing import at module level (outside any function), which fails during the Scheduler's parse cycle.

#### Error message — Root Cause 1c: Import at Module Level (Parse-Time Error)
```
Broken DAG: [/opt/airflow/dags/my_dag.py]
  File "/opt/airflow/dags/my_dag.py", line 8, in <module>
    config = requests.get("http://config-service/api/config").json()
ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
```

**Fix:** Move all I/O and imports inside task callables or factory functions, never at module level.

```python
# WRONG — this runs every time the DAG file is parsed (every 30 seconds!)
import requests
config = requests.get("http://config-service/api/config").json()  # Fails if service is down

with DAG("my_dag", ...) as dag:
    PythonOperator(task_id="task", python_callable=lambda: config["value"])

# CORRECT — I/O happens inside the task, not during parsing
with DAG("my_dag", ...) as dag:
    def my_task():
        import requests  # Import inside the function
        config = requests.get("http://config-service/api/config").json()
        return config["value"]

    PythonOperator(task_id="task", python_callable=my_task)
```

### Root Cause 1d: No DAG Object Found

#### Error message — Root Cause 1d: No DAG Object Found
```
Failed to import: /opt/airflow/dags/my_dag.py
The DAG file doesn't contain valid DAG, it may be a utility module.
```

**Fix:** Ensure the file contains a `DAG` object at module level with an `@dag`-decorated function call or `with DAG(...)` context manager.

```python
# WRONG — DAG is defined but never instantiated
def create_dag():
    with DAG("my_dag", ...) as dag:
        ...
    return dag
# Airflow cannot find the DAG because create_dag() is never called

# CORRECT — call the factory function at module level
def create_dag():
    with DAG("my_dag", ...) as dag:
        ...
    return dag

dag = create_dag()  # This line makes the DAG discoverable

# OR use the @dag decorator pattern which instantiates automatically
@dag(dag_id="my_dag", ...)
def my_dag():
    ...

my_dag()  # Always call the decorated function at module level
```

---

## Issue 2: Task Fails with Non-Zero Exit Code

**Symptom:** A task shows `failed` status in the UI. The task log ends with:

```
Command exited with return code 1
```

or for PythonOperator:

```
airflow.exceptions.AirflowException: Task failed with return code 1
```

#### Debugging steps — Root Cause 1d: No DAG Object Found

```bash
# Step 1: Read the full task log in the UI
# Airflow UI → DAG → Grid view → click the failed task square → Log

# Step 2: Run the task in test mode (executes the task without changing state in the DB)
# This is the fastest way to reproduce and debug a failing task
airflow tasks test my_dag_id my_task_id 2024-01-15

# Step 3: Run interactively with debug logging
airflow tasks test my_dag_id my_task_id 2024-01-15 --verbose

# Step 4: Check environment inside the container/venv where the task runs
docker compose exec airflow-scheduler bash
# Then try to run the command manually
python /opt/scripts/extract.py --date 2024-01-15
```

### Common Sub-Causes

**BashOperator: command not found**

```
bash: /opt/scripts/extract.py: No such file or directory
```

Fix: Verify the file exists in the container/VM at the exact path. Check volume mounts in Docker Compose.

**PythonOperator: unhandled exception**

```python
# The task log will show the full Python traceback
# Read it carefully — the root cause is always in the last few lines before "Command exited with return code 1"

# Fix: Add try/except to distinguish expected vs unexpected failures
def my_task(**context):
    try:
        result = do_work()
        return result
    except MyExpectedError as e:
        # Log and skip (soft fail pattern)
        print(f"Expected error: {e} — marking as skipped")
        raise AirflowSkipException(str(e))
    except Exception as e:
        # Unexpected — fail the task with a clear message
        raise AirflowException(f"Unexpected error in my_task: {e}") from e
```

**Permission denied**

```
PermissionError: [Errno 13] Permission denied: '/data/output/2024-01-15/'
```

Fix: Check that the Airflow user (default UID 50000) has write access to the output path. In Docker Compose, check volume mount permissions.

---

## Issue 3: Scheduler Not Picking Up New DAGs

**Symptom:** You added a new DAG file to the `dags/` folder but it does not appear in the Airflow UI after several minutes.

#### Diagnosis — Common Sub-Causes

```bash
# Step 1: Verify the file is in the correct dags_folder
airflow config get-value core dags_folder
# Should match where you deployed the file

# Step 2: Check if the file has a syntax error preventing parsing
airflow dags list-import-errors

# Step 3: Force immediate re-parse of a specific file
airflow dags reserialize

# Step 4: Check the scheduler is running and processing files
airflow jobs check --job-type SchedulerJob --allow-multiple --limit 10

# Step 5: Watch the scheduler log for the specific file
docker compose logs -f airflow-scheduler | grep "my_new_dag.py"
```

#### Common root causes — Common Sub-Causes

| Root Cause | Symptom in Logs | Fix |
|---|---|---|
| Import error in the new file | `Broken DAG` in scheduler log | Fix the syntax/import error |
| File not in the correct folder | File not mentioned in any scheduler log | Check `dags_folder` config |
| Scheduler is not running | No scheduler heartbeat in logs | Restart the scheduler |
| Parse interval too slow | File appears but takes > 5 min | Reduce `min_file_process_interval` |
| DAG is paused | Appears in UI with pause icon | Click the toggle to unpause |

```ini
# airflow.cfg — reduce parse interval for faster DAG discovery in development
[scheduler]
min_file_process_interval = 10   # Parse every 10 seconds (default: 30)
dag_dir_list_interval = 30       # Rescan the dags folder every 30 seconds (default: 300)
```

> [!warning] Parse Interval in Production
> Setting `min_file_process_interval` very low (< 10s) in production with many DAG files will overload the Scheduler CPU. The Scheduler spends significant time parsing — balance discovery speed against resource usage.

---

## Issue 4: Tasks Stuck in Queued or Running State

**Symptom:** One or more tasks show `queued` or `running` state in the UI for far longer than expected. The task never actually executes (queued) or never finishes (running).

### Stuck in Queued

**Root Cause 1: No worker capacity (all slots used)**

```bash
# Check how many tasks are running vs the parallelism limit
airflow tasks states-for-dag-run my_dag manual__2024-01-15

# Check pool slot usage (if using task pools)
airflow pools list

# Check the global parallelism setting
airflow config get-value core parallelism
```

#### Fix — Stuck in Queued

```bash
# Temporarily increase parallelism (hot-reload not always supported — may require restart)
airflow config set core parallelism 64

# Or add more capacity to the pool being used
airflow pools set default_pool 32 "Default pool"
```

**Root Cause 2: CeleryExecutor — no Celery workers running**

```bash
# Check if Celery workers are running
docker compose ps | grep worker
celery -A airflow.executors.celery_executor.app status

# Start a worker if none are running
docker compose up -d airflow-worker
# Or for self-hosted:
airflow celery worker --concurrency 8
```

**Root Cause 3: Task dependencies not met**

A task stays queued if its upstream tasks are not in `success` state. Check the task's direct upstream tasks in the Graph view.

```bash
# Check the state of all tasks in a DAG Run
airflow tasks states-for-dag-run my_dag scheduled__2024-01-15T00:00:00+00:00
```

### Stuck in Running (Zombie Tasks)

A task shows `running` in the UI but the actual worker process is dead (killed by OOM, VM restart, etc.). Airflow's Zombie Detector eventually marks these as failed (after `scheduler_zombie_task_threshold` seconds, default 300s), but you can fix them immediately.

```bash
# List running task instances that may be zombies
airflow tasks states-for-dag-run my_dag run_id

# Clear the stuck task — sets it back to None (will be re-queued)
airflow tasks clear my_dag \
    --task-ids my_stuck_task \
    --start-date 2024-01-15 \
    --end-date 2024-01-15 \
    --yes

# If many tasks are stuck across many DAG Runs — use the UI's "Clear" on the Grid view
# Select the task → Clear → Set end date to today → Yes
```

> [!tip] Prevent Zombie Tasks
> Set `execution_timeout` on long-running tasks. Airflow will kill the task process and mark it as `failed` (triggering retries) instead of leaving it stuck in `running` forever.

```python
PythonOperator(
    task_id="long_running_task",
    python_callable=my_function,
    execution_timeout=timedelta(hours=4),  # Kill if not done in 4 hours
)
```

---

## Issue 5: Connection Refused to Metadata Database

**Symptom:** The Scheduler, Webserver, or Workers fail to start with:

```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) connection to server at "postgres" (172.18.0.2),
port 5432 failed: Connection refused
    Is the server running on that host and accepting TCP/IP connections?
```

#### Diagnosis and Fix — Stuck in Running (Zombie Tasks)

```bash
# Step 1: Verify the Metadata DB is running
docker compose ps postgres          # Docker Compose
systemctl status postgresql         # Self-hosted

# Step 2: Test the connection manually
psql -h localhost -U airflow -d airflow -c "SELECT 1"

# Step 3: Verify the connection string
airflow config get-value database sql_alchemy_conn

# Step 4: Check for Cloud SQL proxy (if using Cloud SQL from GCE)
# The Cloud SQL Auth Proxy must be running before Airflow starts
systemctl status cloud-sql-proxy
```

**For Docker Compose:** The most common cause is the `postgres` container not being healthy when `airflow-scheduler` starts. Ensure `depends_on` is set correctly.

```yaml
# docker-compose.yaml — ensure scheduler waits for DB to be healthy
airflow-scheduler:
  depends_on:
    postgres:
      condition: service_healthy   # NOT just "service_started" — wait for health check
```

**For Cloud SQL:** The Cloud SQL Auth Proxy must use the correct instance connection name and the service account must have `roles/cloudsql.client`.

```bash
# Start the Cloud SQL Auth Proxy before Airflow
cloud-sql-proxy --port 5432 my-project:us-central1:my-airflow-db &

# Verify it's listening
nc -zv 127.0.0.1 5432

# Verify the IAM binding
gcloud projects get-iam-policy my-project \
    --filter="bindings.members:airflow-sa@my-project.iam.gserviceaccount.com"
```

---

## Issue 6: XCom Too Large

**Symptom:** A task fails with:

```
airflow.exceptions.AirflowException: Task with id 'extract' failed to serialize return value: Object of type DataFrame is not JSON serializable
```

or the task succeeds but a downstream task fails with:

```
_pickle.UnpicklingError: invalid load key, ' '.
```

or for very large XComs against a MySQL backend:

```
mysql.connector.errors.DataError: 1406 (22001): Data too long for column 'value' at row 1
```

**Root Cause:** XComs are stored in the Metadata DB. The `value` column is a `LargeBinary` field, but pushing large objects (DataFrames, file contents, query results) hits practical limits and causes serialization failures or DB errors.

#### Fix — Pass Paths, Not Data — Stuck in Running (Zombie Tasks)

```python
# WRONG — pushing a DataFrame as XCom
def extract(**context):
    import pandas as pd
    df = pd.read_csv("gs://bucket/large-file.csv")  # Could be millions of rows
    return df  # This DataFrame gets pickled and stored in the DB — WILL FAIL or cause issues

# CORRECT — push the GCS path, not the data
def extract(**context):
    import pandas as pd
    from google.cloud import storage

    ds = context["ds"]
    df = pd.read_csv("gs://bucket/source/large-file.csv")

    # Write to GCS
    output_path = f"gs://my-bucket/staging/{ds}/extracted.parquet"
    df.to_parquet(output_path, index=False)

    # Push only the path (tiny string)
    return output_path  # XCom value is now just a string path

def transform(**context):
    import pandas as pd

    # Pull the path from XCom
    input_path = context["task_instance"].xcom_pull(task_ids="extract")

    # Read from GCS — data never touches the Metadata DB
    df = pd.read_parquet(input_path)
    # ... transform ...
```

> [!info] XCom Size Limits by Backend
> - **PostgreSQL** (recommended): XComs stored as `bytea`. Practical limit ~1 MB before performance degrades. Hard limit ~1 GB (but never push anywhere near this).
> - **MySQL**: `MEDIUMBLOB` column, limit = 16 MB. Smaller than PostgreSQL.
> - **Custom XCom backends**: Airflow 2.0+ supports custom backends (e.g., GCS-backed XComs) that remove size limits entirely. See the Airflow docs for `AIRFLOW__CORE__XCOM_BACKEND`.

#### Optional: GCS-backed XCom Backend (Airflow 2.0+)

```python
# plugins/gcs_xcom_backend.py
# Store all XCom values in GCS — unlimited size
from airflow.models.xcom import BaseXCom
from google.cloud import storage
import json, pickle

class GCSXComBackend(BaseXCom):
    PREFIX = "xcom_gcs://"
    BUCKET = "my-airflow-xcom-bucket"

    @staticmethod
    def serialize_value(value, **kwargs):
        if not isinstance(value, (str, int, float, bool, type(None))):
            # Large object — write to GCS
            client = storage.Client()
            bucket = client.bucket(GCSXComBackend.BUCKET)
            run_id = kwargs.get("run_id", "unknown")
            task_id = kwargs.get("task_id", "unknown")
            key = f"xcoms/{run_id}/{task_id}.pkl"
            bucket.blob(key).upload_from_string(pickle.dumps(value))
            value = GCSXComBackend.PREFIX + key
        return BaseXCom.serialize_value(value)

    @staticmethod
    def deserialize_value(result):
        value = BaseXCom.deserialize_value(result)
        if isinstance(value, str) and value.startswith(GCSXComBackend.PREFIX):
            key = value[len(GCSXComBackend.PREFIX):]
            client = storage.Client()
            data = client.bucket(GCSXComBackend.BUCKET).blob(key).download_as_bytes()
            value = pickle.loads(data)
        return value
```

```ini
# airflow.cfg — use the custom backend
[core]
xcom_backend = plugins.gcs_xcom_backend.GCSXComBackend
```

---

## Issue 7: Deadlock Detected in Metadata Database

Database deadlocks in Airflow share root causes with broader [[deadlock-detection-and-prevention]] patterns in SQL Server and PostgreSQL.

**Symptom:** Scheduler or Worker logs contain:

```
sqlalchemy.exc.OperationalError: (psycopg2.errors.DeadlockDetected) ERROR: deadlock detected
DETAIL: Process 12345 waits for ShareLock on transaction 67890; blocked by process 23456.
        Process 23456 waits for ShareLock on transaction 12345; blocked by process 12345.
```

#### Deadlock in Metadata Database — Root Causes and Fixes

**Root Cause 1: Too many concurrent database writes**

With a high `parallelism` setting and many task instances completing simultaneously, the Metadata DB receives concurrent `UPDATE task_instance` statements that deadlock.

```ini
# airflow.cfg — reduce pool size and concurrency to reduce DB pressure
[database]
sql_alchemy_pool_size = 5          # Reduce from default (5-10)
sql_alchemy_max_overflow = 10      # Reduce from default (10-20)

[core]
parallelism = 16                   # Reduce total parallelism if deadlocks persist
```

**Root Cause 2: Database maintenance required**

PostgreSQL accumulates dead tuples from frequent `UPDATE` operations on `task_instance`. Run `VACUUM` to reclaim space and prevent deadlocks.

```bash
# Connect to the Metadata DB
psql -h localhost -U airflow -d airflow

-- Check table bloat
SELECT schemaname, tablename, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;

-- Run VACUUM on the most bloated tables
VACUUM ANALYZE task_instance;
VACUUM ANALYZE dag_run;
VACUUM ANALYZE xcom;

-- Enable autovacuum for Airflow tables (should already be enabled — verify)
SELECT reloptions FROM pg_class WHERE relname = 'task_instance';
```

**Root Cause 3: Too many scheduler instances (HA setup)**

Running too many Scheduler instances on a small database increases contention.

```bash
# Check how many scheduler jobs are running
airflow jobs check --job-type SchedulerJob

# For small deployments, run only 1 scheduler
# For HA, limit to 2-3 schedulers
```

---

## Issue 8: Worker Killed (OOM on CeleryExecutor)

**Symptom:** A task disappears from the `running` state without setting `failed`. The Celery worker log shows:

```
[2024-01-15 06:35:22,113: ERROR/MainProcess] Task airflow.executors.celery_executor.execute_command[abc-123] raised unexpected: WorkerLostError('Worker exited prematurely: signal 9 (SIGKILL) Job: 42.')
```

On Linux: `dmesg | grep -i "out of memory"` shows the OOM killer targeting the Celery worker process.

**Root Cause:** A task loaded too much data into memory (e.g., a large Pandas DataFrame), causing the Celery worker process to exceed available RAM. The Linux OOM killer terminates the process with SIGKILL (signal 9), bypassing Python exception handling — hence no clean `failed` state.

#### Fix — Immediate — Stuck in Running (Zombie Tasks)

```bash
# The task will be marked as zombie and eventually fail via the Zombie Detector
# Speed it up by clearing the task manually
airflow tasks clear my_dag --task-ids memory_heavy_task --start-date 2024-01-15 --yes

# Restart the killed Celery worker
docker compose restart airflow-worker
# Or for self-hosted:
sudo systemctl restart airflow-worker
```

#### Fix — Structural (prevent recurrence) — Stuck in Running (Zombie Tasks)

```python
# 1. Profile memory usage before scaling up
import tracemalloc
tracemalloc.start()
# ... your code ...
current, peak = tracemalloc.get_traced_memory()
print(f"Peak memory: {peak / 1024 / 1024:.1f} MB")
tracemalloc.stop()

# 2. Process data in chunks instead of loading it all at once
def process_large_file(**context):
    """Process a large CSV in 100k-row chunks to stay within memory limits."""
    import pandas as pd

    CHUNK_SIZE = 100_000  # Adjust based on available worker memory
    output_rows = 0

    for chunk in pd.read_csv("gs://bucket/large-file.csv", chunksize=CHUNK_SIZE):
        # Process one chunk at a time
        processed = chunk[chunk["status"] == "active"].copy()
        processed.to_parquet(
            f"gs://bucket/output/{context['ds']}/part_{output_rows}.parquet"
        )
        output_rows += len(processed)
        del chunk, processed  # Explicitly free memory between chunks

    return {"rows_processed": output_rows}

# 3. Use KubernetesPodOperator for memory-intensive tasks
# This gives each task its own pod with configurable memory limits
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from kubernetes.client import models as k8s

memory_task = KubernetesPodOperator(
    task_id="memory_heavy_task",
    image="my-repo/heavy-task:latest",
    resources=k8s.V1ResourceRequirements(
        requests={"memory": "4Gi"},
        limits={"memory": "8Gi"},  # Task is killed if it exceeds 8 GB
    ),
    # The pod is isolated — killing it doesn't affect the Airflow worker
)
```

```ini
# airflow.cfg — reduce Celery worker concurrency to leave more RAM per task
[celery]
worker_concurrency = 4   # Fewer concurrent tasks per worker = more RAM per task
```

---

## CLI Debugging Reference

The Airflow CLI is the primary debugging tool. All commands below assume Airflow is installed and `AIRFLOW_HOME` is set correctly.

### DAG Commands

```bash
# List all DAGs (shows pause status, schedule, and last run)
airflow dags list

# List DAGs matching a filter
airflow dags list | grep "my_pipeline"

# Show all import errors
airflow dags list-import-errors

# Show details about a specific DAG
airflow dags show my_dag_id

# Trigger a DAG Run manually (for schedule=None DAGs)
airflow dags trigger my_dag_id

# Trigger with custom config
airflow dags trigger my_dag_id --conf '{"param1": "value1"}'

# Trigger with a specific execution date
airflow dags trigger my_dag_id --exec-date 2024-01-15T00:00:00+00:00

# Pause a DAG (prevent Scheduler from creating new runs)
airflow dags pause my_dag_id

# Unpause a DAG
airflow dags unpause my_dag_id

# Delete a DAG and all its history from the Metadata DB
airflow dags delete my_dag_id --yes

# Force re-serialization of all DAGs
airflow dags reserialize

# Backfill a date range
airflow dags backfill my_dag_id --start-date 2024-01-01 --end-date 2024-01-31
```

### Task Commands

```bash
# List all tasks in a DAG
airflow tasks list my_dag_id

# List tasks with dependencies shown as a tree
airflow tasks list my_dag_id --tree

# TEST a specific task instance (does NOT record result in the Metadata DB)
# This is the single most useful debugging command — use it before clearing/retrying
airflow tasks test my_dag_id my_task_id 2024-01-15

# TEST with verbose logging
airflow tasks test my_dag_id my_task_id 2024-01-15 --verbose

# RUN a specific task instance and record the result in the Metadata DB
# Use this to re-run a specific failed task after fixing it
airflow tasks run my_dag_id my_task_id 2024-01-15 --local

# CLEAR task state (reset to None — task will be re-queued on next Scheduler cycle)
airflow tasks clear my_dag_id \
    --task-ids my_task_id \
    --start-date 2024-01-15 \
    --end-date 2024-01-15 \
    --yes

# Clear all failed tasks in a DAG Run
airflow tasks clear my_dag_id \
    --only-failed \
    --start-date 2024-01-15 \
    --end-date 2024-01-15 \
    --yes

# Clear a task AND all its downstream tasks (cascade)
airflow tasks clear my_dag_id \
    --task-ids my_task_id \
    --downstream \
    --start-date 2024-01-15 \
    --end-date 2024-01-15 \
    --yes

# Get the state of a specific task instance
airflow tasks state my_dag_id my_task_id 2024-01-15

# Get states of all task instances in a DAG Run
airflow tasks states-for-dag-run my_dag_id manual__2024-01-15T00:00:00+00:00

# Render Jinja template for a task (useful for debugging template values)
airflow tasks render my_dag_id my_bash_task 2024-01-15
```

### DAG Run Commands

```bash
# List DAG Runs for a specific DAG
airflow dags list-runs --dag-id my_dag_id

# List runs with date filter
airflow dags list-runs --dag-id my_dag_id \
    --start-date 2024-01-01 \
    --end-date 2024-01-31

# Delete a specific DAG Run (does not re-run it — permanently removes history)
airflow dags delete-run my_dag_id scheduled__2024-01-15T00:00:00+00:00
```

### Connection and Variable Commands

```bash
# List all connections
airflow connections list

# Test a connection
airflow connections test my_postgres_conn

# Add a connection
airflow connections add my_postgres \
    --conn-type postgres \
    --conn-host localhost \
    --conn-login user \
    --conn-password secret \
    --conn-port 5432 \
    --conn-schema mydb

# Delete a connection
airflow connections delete my_postgres

# List all variables
airflow variables list

# Get a variable value
airflow variables get my_variable_key

# Set a variable
airflow variables set my_variable_key "my_value"

# Export all variables to a JSON file (for backup/migration)
airflow variables export variables.json

# Import variables from a JSON file
airflow variables import variables.json
```

### Database Maintenance Commands

```bash
# Check the Metadata DB connection and schema version
airflow db check

# Run database migrations (after upgrading Airflow)
airflow db migrate

# Clean up old records from the Metadata DB
# Keeps the last N days of DAG Runs, Task Instances, XComs, logs
airflow db clean \
    --clean-before-timestamp "2024-01-01 00:00:00" \
    --tables dag_run,task_instance,xcom,log \
    --dry-run   # First: see what would be deleted

airflow db clean \
    --clean-before-timestamp "2024-01-01 00:00:00" \
    --tables dag_run,task_instance,xcom,log \
    --yes       # Then: actually delete

# Reset the database (DESTRUCTIVE — deletes ALL data)
# Only for development! This wipes all history, runs, connections, variables
airflow db reset --yes
```

---

## Issue 9: Log Locations and Reading Task Logs

### Default Log Locations

```bash
# Local logs (Docker Compose or self-hosted)
# Pattern: $AIRFLOW_HOME/logs/dag_id/task_id/YYYY-MM-DDTHH:MM:SS+00:00/attempt_number.log

ls $AIRFLOW_HOME/logs/my_dag_id/my_task_id/
# 2024-01-15T06:00:00+00:00/
#   1.log    <- First attempt
#   2.log    <- Second attempt (retry)

# Read the log for a specific attempt
cat "$AIRFLOW_HOME/logs/my_dag_id/my_task_id/2024-01-15T06:00:00+00:00/1.log"

# For Docker Compose
docker compose exec airflow-scheduler \
    cat /opt/airflow/logs/my_dag_id/my_task_id/2024-01-15T06:00:00+00:00/1.log
```

### Remote Logs (GCS)

```bash
# If remote logging is enabled (recommended for production)
# Logs are written to: gs://BUCKET/REMOTE_LOG_FOLDER/dag_id/task_id/run_id/attempt.log

# View a log from GCS
gsutil cat "gs://my-airflow-logs-bucket/airflow-logs/my_dag_id/my_task_id/scheduled__2024-01-15T06:00:00+00:00/1.log"

# List all logs for a DAG
gsutil ls -r "gs://my-airflow-logs-bucket/airflow-logs/my_dag_id/"
```

### Scheduler Logs

```bash
# Docker Compose
docker compose logs -f airflow-scheduler
docker compose logs airflow-scheduler | grep -E "ERROR|WARNING|CRITICAL" | tail -100

# Systemd (self-hosted) — see [[managing-services]] for systemd fundamentals
journalctl -u airflow-scheduler -n 500
journalctl -u airflow-scheduler -f                           # Follow
journalctl -u airflow-scheduler --since "2024-01-15 06:00"  # Since a specific time

# Webserver logs
journalctl -u airflow-webserver -n 100
```

---

## Issue 10: DAG Serialization Issues

**Symptom:** After enabling DAG serialization (default in Airflow 2.0+), tasks fail with:

```
airflow.exceptions.SerializationError: Failed to serialize DAG
AttributeError: 'MyCustomOperator' object has no attribute 'serialize'
```

**Root Cause:** DAG serialization stores DAG definitions in the Metadata DB as JSON, allowing the Webserver to display DAGs without parsing Python files. Custom Operators or objects that are not JSON-serializable break this.

#### Fix — DAG Serialization Issues

```python
# Custom Operators must inherit from BaseOperator properly
from airflow.models import BaseOperator

class MyCustomOperator(BaseOperator):
    # Declare template_fields for Jinja templating
    template_fields = ["my_arg"]

    def __init__(self, my_arg: str, **kwargs):
        super().__init__(**kwargs)
        self.my_arg = my_arg  # Store as instance attribute

    def execute(self, context):
        # Task logic here
        print(f"Running with {self.my_arg} for {context['ds']}")

# WRONG — passing non-serializable objects as constructor args
import pandas as pd
my_df = pd.DataFrame(...)  # Not JSON-serializable

MyCustomOperator(
    task_id="bad",
    my_arg=my_df,  # This will fail serialization
)

# CORRECT — pass serializable values only
MyCustomOperator(
    task_id="good",
    my_arg="gs://bucket/data.parquet",  # String path — serializable
)
```

---

## Issue 11: Slow DAG Parsing / Scheduler Performance

**Symptom:** The Scheduler is consuming high CPU. New DAGs take minutes to appear. The UI shows an old `Last Parsed` time in the DAG list. If the scheduler process has stopped entirely, follow the [[airflow-scheduler-down]] runbook.

#### Diagnosis — Scheduler Logs

```bash
# Check scheduler parsing times per DAG file
# Look for "Processing file" lines with timing info
docker compose logs airflow-scheduler | grep "Processing file|finish processing file" | tail -50

# Count how many DAG files are being parsed
ls -la $AIRFLOW_HOME/dags/*.py | wc -l

# Check the scheduler's own heartbeat rate
airflow jobs check --job-type SchedulerJob
```

#### Common Causes and Fixes — Scheduler Logs

#### Too many DAG files

```ini
# airflow.cfg — limit the file parsing worker pool
[scheduler]
parsing_processes = 4      # Number of processes for parallel DAG parsing
                           # Set to number of CPU cores available to scheduler
                           # Increase for faster parsing of many files
```

#### Expensive module-level code

```python
# WRONG — slow code at module level runs every 30 seconds during parsing
from my_heavy_library import HeavyClass  # Slow import
import pandas as pd
LARGE_CONFIG = pd.read_csv("/data/config.csv")  # I/O at parse time

# CORRECT — lazy imports and load config inside tasks only
def my_task():
    from my_heavy_library import HeavyClass  # Import at task runtime, not parse time
    config = pd.read_csv("/data/config.csv")  # I/O at task runtime
```

#### Too many XCom entries slowing DB queries

```bash
# Run airflow db clean to remove old XComs
airflow db clean \
    --clean-before-timestamp "$(date -d '30 days ago' '+%Y-%m-%d 00:00:00')" \
    --tables xcom \
    --yes
```

---

## Issue 12: Webserver Not Starting (Port 8080)

#### Symptom — Scheduler Logs

```
[2024-01-15 06:00:01,123] {manager.py:92} ERROR - Webserver exited with return code 1
OSError: [Errno 98] Address already in use
```

#### Fix — Scheduler Logs

```bash
# Find what is using port 8080
lsof -i :8080
ss -tlnp | grep 8080

# Kill the process using the port
kill -9 $(lsof -t -i:8080)

# Or change the webserver port
airflow webserver --port 8081

# Set permanently in airflow.cfg or environment variable
export AIRFLOW__WEBSERVER__WEB_SERVER_PORT=8081
```

#### Flask secret key warning (non-fatal but important)

```
[WARNING] No SECRET_KEY found. Falling back to a random key - sessions will be lost between Webserver restarts.
```

#### Fix — Scheduler Logs

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_hex(32))"
# Add to airflow.cfg:
# [webserver]
# secret_key = <generated-key>

# Or set via environment variable (preferred)
export AIRFLOW__WEBSERVER__SECRET_KEY="your-generated-key"
```

---

## Issue 13: Database Maintenance and Health

Regular Metadata DB maintenance prevents performance degradation and disk growth.

```bash
# Check database connection and schema version
airflow db check
# Expected output: "Connection to the database successful"

# Check current Alembic schema version
airflow db show-migrations

# Run pending migrations (after Airflow version upgrade)
airflow db migrate

# Automated cleanup script (run weekly via cron or a maintenance DAG)
# Remove data older than 90 days
airflow db clean \
    --clean-before-timestamp "$(date -d '90 days ago' '+%Y-%m-%d %H:%M:%S')" \
    --tables dag_run,task_instance,xcom,log,import_error,job \
    --yes

# PostgreSQL-specific: rebuild table statistics after cleanup
psql -h localhost -U airflow -d airflow -c "ANALYZE task_instance; ANALYZE dag_run; ANALYZE xcom;"
```

#### Maintenance DAG pattern

```python
# dags/airflow_db_maintenance.py
# Run weekly Airflow DB cleanup via a DAG (so it's scheduled and logged)

from airflow.decorators import dag, task
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

@dag(
    dag_id="airflow_db_maintenance",
    schedule="@weekly",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["maintenance", "airflow-internal"],
    default_args={"owner": "platform-team"},
)
def maintenance():

    clean_old_records = BashOperator(
        task_id="clean_old_db_records",
        bash_command="""
        airflow db clean \
            --clean-before-timestamp "$(date -d '90 days ago' '+%Y-%m-%d %H:%M:%S')" \
            --tables dag_run,task_instance,xcom,log \
            --yes
        """,
    )

    @task
    def report_db_size():
        """Log current Metadata DB table sizes."""
        from airflow.settings import Session
        from sqlalchemy import text
        with Session() as session:
            result = session.execute(text("""
                SELECT relname AS table_name,
                       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY pg_total_relation_size(relid) DESC
                LIMIT 10
            """))
            for row in result:
                print(f"{row.table_name}: {row.total_size}")

    clean_old_records >> report_db_size()

maintenance()
```

---

### Airflow Task State Machine Reference

Understanding task states is essential for diagnosing stuck or unexpected behavior.

```
           ┌─────────────────────────────────────────────────────┐
           │              TASK STATE MACHINE                      │
           │                                                       │
           │  None ──► queued ──► running ──► success             │
           │    │                    │                             │
           │    │                    ├──► failed ──► up_for_retry  │
           │    │                    │         └──► queued (retry) │
           │    │                    │                             │
           │    │                    └──► up_for_reschedule        │
           │    │                         (Sensor reschedule mode) │
           │    │                                                   │
           │    ├──► skipped  (BranchOperator skip)                │
           │    │                                                   │
           │    └──► removed  (task removed from DAG definition)   │
           └─────────────────────────────────────────────────────┘
```

| State | Meaning | Action |
|---|---|---|
| `none` | Not yet scheduled | Normal — Scheduler will queue when ready |
| `queued` | Waiting for a worker slot | Normal — or check parallelism limits |
| `scheduled` | About to be queued | Transient — usually resolves in seconds |
| `running` | Worker is executing | Normal — or zombie if worker died |
| `success` | Completed successfully | No action needed |
| `failed` | Failed, no retries left | Check task log; fix then clear |
| `up_for_retry` | Failed, retry pending | Normal — will retry after `retry_delay` |
| `skipped` | Skipped by BranchOperator | Normal — expected for non-chosen branches |
| `up_for_reschedule` | Sensor waiting to re-check | Normal for `mode="reschedule"` sensors |
| `removed` | Task no longer in DAG | DAG was modified while run was active |
| `shutdown` | Task was manually stopped | Cleared via UI or CLI |

---

## Related Notes

- [[airflow-core-concepts]] — Architecture, Executors, XCom mechanics, connection setup
- [[airflow-dag-patterns]] — Dynamic DAG issues, trigger rule bugs, backfill problems
- [[airflow-deployment]] — Deployment-specific issues: Docker Compose, Cloud Composer, secrets

## References

- [Airflow Troubleshooting Guide](https://airflow.apache.org/docs/apache-airflow/stable/troubleshooting.html)
- [Airflow CLI Reference](https://airflow.apache.org/docs/apache-airflow/stable/cli-and-env-variables-ref.html)
- [Airflow Best Practices](https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)
- [Airflow FAQ](https://airflow.apache.org/docs/apache-airflow/stable/faq.html)
