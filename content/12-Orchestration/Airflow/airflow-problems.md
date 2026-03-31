---
tags: [orchestration, airflow]
type: reference
technology: airflow
status: stable
updated: 2026-03-23
description: "Comprehensive catalog of Airflow production problems — 25 issues ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures for data engineering teams."
---

# Airflow Production Problems

> [!quote]
> "Incidents are unplanned investments; their costs have already been incurred. Your org's challenge is to get ROI on those events."
>
> — **John Allspaw**, Velocity Conference (2012)
>
> "We have to take human performance seriously, and if we don't, we will continue to see brittle systems."
>
> — **John Allspaw**, Velocity Conference (2012)

Airflow is the de facto orchestrator for data pipelines, but its flexibility comes with operational complexity. In a financial index platform where missed SLAs mean regulatory exposure, every problem below has been encountered in production. This note catalogs each one, explains why it happens, and provides actionable prevention and fix protocols. The context throughout is self-hosted Airflow on Docker Compose, with SQL Server and BigQuery as data backends, GCP infrastructure, and strict publication SLAs for financial index and ESG data.

---

## Critical — Pipeline Outage / Data Loss Risk

---

### Scheduler Crash or Hang

**What happens**

The Airflow scheduler process crashes or enters an unresponsive state — no tasks are queued, no DAG runs trigger, and the system appears frozen. Operators discover the problem only when an index calculation DAG that should have started at 06:00 UTC hasn't produced any output by 07:30. The UI still shows the scheduler as "healthy" because the health endpoint caches its status.

**Root cause**

The scheduler parses every DAG file in the `dags_folder` on a loop. A single DAG that raises an unhandled exception at import time — a missing environment variable, a network call that times out, a syntax error introduced in a hurried hotfix — can crash the entire scheduler process. Before Airflow 2.4, a single scheduler process managed all DAGs; even after the HA scheduler was introduced, a bad DAG file can still consume enough memory or CPU during parsing to starve the event loop. Additionally, a deadlock in the metadata database (e.g., a stuck migration lock row) causes the scheduler to stop emitting heartbeats without crashing outright.

**Consequences**

- All DAG runs stop triggering across every pipeline, not just the broken one
- Index constituent data pipelines miss their calculation window; publication is delayed
- ESG data freshness degrades silently because no new runs are triggered
- Corporate action processing pipelines queue but never execute, causing stale price data
- On-call team wastes 30–60 minutes diagnosing before identifying the root cause DAG

**Prevention protocol**

1. Add DAG import validation to CI before every merge:
   ```bash
   # In CI pipeline (GitHub Actions, GitLab CI, etc.)
   pip install apache-airflow==2.9.3
   python -c "
   from airflow.models import DagBag
   bag = DagBag(dag_folder='./dags', include_examples=False)
   if bag.import_errors:
       print('DAG import errors:')
       for dag_id, err in bag.import_errors.items():
           print(f'  {dag_id}: {err}')
       exit(1)
   print(f'OK — {len(bag.dags)} DAGs loaded cleanly')
   "
   ```

2. Set a hard timeout for DAG imports in `airflow.cfg` or environment variables:
   ```ini
   [core]
   dagbag_import_timeout = 30
   dag_file_processor_timeout = 60
   ```
   ```bash
   # Equivalent as environment variables in docker-compose.yml
   AIRFLOW__CORE__DAGBAG_IMPORT_TIMEOUT: "30"
   AIRFLOW__CORE__DAG_FILE_PROCESSOR_TIMEOUT: "60"
   ```

3. Separate DAGs into subfolders and set `dags_folder` to include only validated subfolders. Use `.airflowignore` to exclude experimental work:
   ```
   # dags/.airflowignore
   sandbox/
   wip_*.py
   _draft_*.py
   ```

4. Deploy HA scheduler (two scheduler replicas) on any environment with SLA obligations:
   ```yaml
   # docker-compose.yml
   airflow-scheduler-1:
     <<: *airflow-common
     command: scheduler
     restart: always
   airflow-scheduler-2:
     <<: *airflow-common
     command: scheduler
     restart: always
   ```

5. Monitor heartbeat age with a Prometheus/Grafana alert:
   ```sql
   -- Alert if this returns a row older than 60 seconds
   SELECT latest_heartbeat, DATEDIFF(SECOND, latest_heartbeat, GETUTCDATE()) AS seconds_ago
   FROM job
   WHERE job_type = 'SchedulerJob'
   ORDER BY latest_heartbeat DESC
   LIMIT 1;
   ```

**Fix procedure**

1. Check recent scheduler logs for the error:
   ```bash
   docker logs airflow-scheduler --tail 100 2>&1 | grep -E "ERROR|CRITICAL|ImportError|Exception"
   ```

2. Identify bad DAG files:
   ```bash
   docker exec airflow-scheduler airflow dags list-import-errors
   ```
   Output example:
   ```
   filepath                          | error
   ----------------------------------|-------------------------------------------
   /opt/airflow/dags/esg_ingest.py   | ModuleNotFoundError: No module named 'pandas'
   ```

3. Move the offending DAG out of the dags folder (or add it to `.airflowignore`) without restarting:
   ```bash
   # On the Docker host
   mv ./dags/esg_ingest.py ./dags/_quarantine/esg_ingest.py
   # The file processor will stop picking it up within dag_file_processor_timeout seconds
   ```

4. Restart the scheduler container if it has crashed:
   ```bash
   docker compose restart airflow-scheduler
   ```

5. Verify the scheduler is heartbeating:
   ```bash
   docker exec airflow-scheduler airflow jobs check --job-type SchedulerJob --limit 1
   ```

6. Confirm DAGs are loading and runs are triggering:
   ```bash
   docker exec airflow-scheduler airflow dags list | head -20
   docker exec airflow-scheduler airflow dags trigger index_calculation_dag
   ```

---

### Zombie Tasks

**What happens**

A task shows status "running" in the Airflow UI, but the actual worker process no longer exists. The task was killed mid-execution — typically because the Docker container was OOM-killed, the worker host was preempted, or the network connection between the worker and metadata DB was severed. The index calculation DAG appears to be running, but no output is produced, and the DAG run never completes.

**Root cause**

Airflow tracks running tasks via a `LocalTaskJob` record in the metadata database. The worker process is expected to emit a heartbeat every `scheduler.local_task_job_heartbeat_sec` seconds. When the process dies abnormally (SIGKILL, OOM kill, Docker restart), it cannot update its heartbeat. The scheduler's zombie detection loop — running every `scheduler.zombie_detection_interval` seconds — compares the last heartbeat time against the current time. If the gap exceeds the threshold, the task is marked as a zombie and eventually fails. Until that detection fires, the DAG run is blocked.

**Consequences**

- DAG run hangs indefinitely, consuming a slot in `max_active_runs`
- Critical index publication window is missed while the system waits for a task that will never complete
- Operator must manually intervene, breaking any automated SLA monitoring
- If zombie detection fires but the task state is not correctly reset, downstream tasks may use stale or partial data
- Repeated OOM kills indicate undersized worker containers, which is a systemic capacity problem

**Prevention protocol**

1. Tune zombie detection to catch failures faster (default is too conservative):
   ```ini
   [scheduler]
   zombie_detection_interval = 30        # seconds between zombie checks (default 60)
   local_task_job_heartbeat_sec = 5      # how often workers heartbeat (default 5)
   scheduler_zombie_task_threshold = 120 # mark zombie if no heartbeat for this many seconds
   ```
   ```bash
   AIRFLOW__SCHEDULER__ZOMBIE_DETECTION_INTERVAL: "30"
   AIRFLOW__SCHEDULER__SCHEDULER_ZOMBIE_TASK_THRESHOLD: "120"
   ```

2. Set memory limits on worker containers so OOM kills are contained and logged:
   ```yaml
   # docker-compose.yml
   airflow-worker:
     <<: *airflow-common
     command: celery worker
     deploy:
       resources:
         limits:
           memory: 4G
         reservations:
           memory: 1G
   ```

3. Add a liveness probe to the worker so Docker restarts it cleanly on hang:
   ```yaml
   airflow-worker:
     healthcheck:
       test: ["CMD-SHELL", "celery --app airflow.executors.celery_executor.app inspect ping -d celery@$HOSTNAME"]
       interval: 30s
       timeout: 10s
       retries: 3
   ```

4. Query for zombie tasks proactively in monitoring:
   ```sql
   -- Find task instances that claim to be running but have no recent job heartbeat
   SELECT
       ti.dag_id,
       ti.task_id,
       ti.run_id,
       ti.state,
       j.latest_heartbeat,
       DATEDIFF(SECOND, j.latest_heartbeat, GETUTCDATE()) AS staleness_seconds
   FROM task_instance ti
   JOIN task_reschedule tr ON ti.task_id = tr.task_id  -- optional
   JOIN job j ON j.id = ti.queued_by_job_id
   WHERE ti.state = 'running'
     AND DATEDIFF(SECOND, j.latest_heartbeat, GETUTCDATE()) > 120
   ORDER BY staleness_seconds DESC;
   ```

**Fix procedure**

1. List running task instances to identify zombies:
   ```bash
   docker exec airflow-scheduler airflow tasks states-for-dag-run \
     --dag-id index_calculation_dag \
     --run-id scheduled__2026-03-22T06:00:00+00:00
   ```

2. Clear the zombie task to reset it to a schedulable state:
   ```bash
   docker exec airflow-scheduler airflow tasks clear \
     --dag-id index_calculation_dag \
     --task-id calculate_constituents \
     --run-id scheduled__2026-03-22T06:00:00+00:00 \
     --yes
   ```

3. If the entire DAG run is stuck, clear all failed/zombie tasks in the run:
   ```bash
   docker exec airflow-scheduler airflow dags clear \
     --dag-id index_calculation_dag \
     --run-id scheduled__2026-03-22T06:00:00+00:00 \
     --yes
   ```

4. If OOM was the cause, immediately scale up worker memory before re-triggering:
   ```bash
   # Edit docker-compose.yml memory limit, then:
   docker compose up -d --scale airflow-worker=2
   ```

5. Re-trigger or let the scheduler pick up the cleared tasks automatically. Verify completion:
   ```bash
   watch -n 10 'docker exec airflow-scheduler airflow dags list-runs \
     --dag-id index_calculation_dag --limit 5'
   ```

---

### Metadata Database Corruption

**What happens**

An Airflow version upgrade is initiated — `airflow db migrate` is run — and the process fails partway through. The database schema is now in a half-migrated state: some new tables or columns exist, some do not. Alternatively, two Airflow processes attempt to write to the metadata DB simultaneously during a rolling restart, causing a unique constraint violation or deadlock. The scheduler starts, then immediately crashes with a SQLAlchemy error referencing a missing column.

**Root cause**

Airflow's metadata database stores all state: DAG definitions, task instance records, connections, variables, XCom values, and job heartbeats. The schema evolves with every Airflow release via Alembic migrations. If a migration is interrupted (network timeout, container restart, disk full), Alembic may have written a partial schema while the `alembic_version` table still points to the previous revision — or worse, an intermediate revision that no longer matches any migration file. Unlike transactional DDL databases (PostgreSQL handles this well; some MySQL and SQL Server operations do not), the metadata DB can be left in a state that Airflow cannot recover from automatically.

**Consequences**

- Complete Airflow outage: scheduler, webserver, and workers all fail to start
- All in-flight task state is lost if the DB is unrecoverable
- Historical audit trail (task runs, task instance states) may be corrupted or inaccessible
- Financial regulators may require provenance of index calculation runs; corrupted history creates compliance risk
- Recovery requires a database restore, which means replaying all pipeline runs that occurred since the last backup

**Prevention protocol**

1. Always back up the metadata database before any upgrade or migration:
   ```bash
   # For PostgreSQL (recommended metadata DB)
   docker exec airflow-postgres pg_dump \
     -U airflow \
     -d airflow \
     --format=custom \
     --file=/backup/airflow_pre_upgrade_$(date +%Y%m%d_%H%M%S).pgdump

   # Copy backup off the container
   docker cp airflow-postgres:/backup/. ./backups/airflow/
   ```

2. Test migrations against a copy of production data in staging before applying to production:
   ```bash
   # Restore prod backup to staging DB
   docker exec -i staging-postgres pg_restore \
     -U airflow \
     -d airflow_staging \
     --clean \
     /backup/airflow_pre_upgrade_20260322.pgdump

   # Run migration on staging
   docker exec staging-airflow airflow db migrate

   # Validate
   docker exec staging-airflow airflow db check
   ```

3. Set up automated daily backups in Docker Compose with a cron sidecar:
   ```yaml
   airflow-db-backup:
     image: postgres:15
     volumes:
       - ./backups:/backups
       - postgres_data:/var/lib/postgresql/data:ro
     environment:
       PGPASSWORD: ${POSTGRES_PASSWORD}
     entrypoint: |
       sh -c 'while true; do
         pg_dump -h airflow-postgres -U airflow airflow \
           --format=custom \
           --file=/backups/airflow_$(date +%Y%m%d_%H%M%S).pgdump
         find /backups -name "*.pgdump" -mtime +7 -delete
         sleep 86400
       done'
   ```

4. Never run migrations with live traffic. Drain the scheduler and workers first:
   ```bash
   docker compose stop airflow-scheduler airflow-worker
   # wait for in-flight tasks to finish or timeout
   docker exec airflow-postgres psql -U airflow -c \
     "SELECT count(*) FROM task_instance WHERE state = 'running';"
   # Only proceed when count = 0
   docker exec airflow-scheduler airflow db migrate
   ```

**Fix procedure**

1. Check current Alembic revision and expected revision:
   ```bash
   docker exec airflow-scheduler airflow db check-migrations
   docker exec airflow-postgres psql -U airflow -c \
     "SELECT version_num FROM alembic_version;"
   ```

2. If migration failed partway, restore from backup:
   ```bash
   docker compose stop airflow-scheduler airflow-webserver airflow-worker

   docker exec -i airflow-postgres pg_restore \
     -U airflow \
     -d airflow \
     --clean \
     --if-exists \
     /backup/airflow_pre_upgrade_20260322.pgdump
   ```

3. Downgrade the Airflow image to the version matching the backup, start, and verify:
   ```bash
   # Edit docker-compose.yml to use the previous image tag
   docker compose up -d airflow-scheduler
   docker exec airflow-scheduler airflow db check
   ```

4. Re-attempt the upgrade, this time with the database fully stopped and backed up:
   ```bash
   docker compose stop
   # Take fresh backup
   docker exec airflow-postgres pg_dump -U airflow airflow \
     --format=custom --file=/backup/airflow_clean_$(date +%Y%m%d_%H%M%S).pgdump
   # Upgrade image tag in docker-compose.yml, then:
   docker compose up -d airflow-scheduler
   docker exec airflow-scheduler airflow db migrate
   docker exec airflow-scheduler airflow db check
   ```

---

### Catchup Storm

**What happens**

A new DAG is deployed with `catchup=True` (the Airflow default) and a `start_date` set weeks or months in the past. Within seconds of the DAG becoming active, Airflow queues hundreds of historical DAG runs — one for every scheduled interval between `start_date` and now. The worker queue fills up, legitimate production runs are starved of worker slots, and the ESG data ingestion DAG that runs every 15 minutes suddenly finds no available workers.

**Root cause**

`catchup=True` is Airflow's default behavior because it was designed for idempotent data pipelines where every historical interval should be processed. When a DAG is first loaded, the scheduler computes all intervals between `start_date` and the current date and queues them all immediately. With a daily DAG and a `start_date` 90 days in the past, this creates 90 simultaneous DAG run attempts, all competing for the same pool of worker slots. CeleryExecutor will happily queue all 90 into Redis; workers will pick them up and exhaust all capacity.

**Consequences**

- Worker queue saturated; production DAGs wait minutes or hours for slots
- Index calculation DAG misses its morning publication window
- ESG data freshness pipeline falls behind; downstream consumers see stale data
- Database connection pool may be exhausted by 90 concurrent tasks all trying to connect to SQL Server
- Operators must manually cancel hundreds of queued runs

**Prevention protocol**

1. Set `catchup=False` as the default for all DAGs in your environment:
   ```ini
   [core]
   dags_are_paused_at_creation = True
   ```
   ```python
   # In a shared DAG defaults file (dag_defaults.py)
   DEFAULT_ARGS = {
       "catchup": False,
       "start_date": pendulum.datetime(2026, 1, 1, tz="UTC"),
       "retries": 2,
       "retry_delay": timedelta(minutes=5),
   }
   ```

2. Always set `catchup=False` explicitly in DAG definitions:
   ```python
   with DAG(
       dag_id="index_calculation_dag",
       schedule="0 6 * * 1-5",  # 06:00 UTC, weekdays
       start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
       catchup=False,           # explicit, never rely on defaults
       max_active_runs=1,       # prevent multiple concurrent runs of same DAG
   ) as dag:
       ...
   ```

3. For DAGs that genuinely need catchup, always set `max_active_runs` to throttle:
   ```python
   with DAG(
       dag_id="historical_esg_backfill",
       schedule="@daily",
       start_date=pendulum.datetime(2025, 1, 1, tz="UTC"),
       catchup=True,
       max_active_runs=3,  # never more than 3 historical runs at once
   ) as dag:
       ...
   ```

4. Use `LatestOnlyOperator` as the first task for DAGs where running historical intervals makes no business sense:
   ```python
   from airflow.operators.latest_only import LatestOnlyOperator

   with DAG(..., catchup=True) as dag:
       latest_only = LatestOnlyOperator(task_id="latest_only")
       actual_work = PythonOperator(task_id="calculate_index", ...)
       latest_only >> actual_work
   ```

**Fix procedure**

1. Immediately pause the offending DAG to stop new runs from being queued:
   ```bash
   docker exec airflow-scheduler airflow dags pause index_calculation_dag
   ```

2. List all queued runs to understand the scope:
   ```bash
   docker exec airflow-scheduler airflow dags list-runs \
     --dag-id index_calculation_dag \
     --state queued \
     --limit 200
   ```

3. Delete all queued/running runs for the DAG (this deletes DAG run records, not the DAG itself):
   ```bash
   # For Airflow 2.x: use the REST API to delete runs in bulk
   # First, get all run IDs
   docker exec airflow-scheduler airflow dags list-runs \
     --dag-id historical_esg_backfill \
     --state queued \
     --output json | jq -r '.[].run_id'

   # Then delete each (or use the UI "Clear" on the DAG Runs view)
   # Or use the Airflow REST API:
   curl -X DELETE \
     "http://localhost:8080/api/v1/dags/historical_esg_backfill/dagRuns/scheduled__2025-01-01T00:00:00+00:00" \
     -H "Content-Type: application/json" \
     --user "airflow:airflow"
   ```

4. Fix `catchup=False` in the DAG file, redeploy, then unpause:
   ```bash
   docker exec airflow-scheduler airflow dags unpause index_calculation_dag
   ```

---

### Secret / Credential Expiry

**What happens**

A Google Cloud service account (SA) key used by the BigQuery operator expires or is rotated without updating the Airflow connection. At 06:00 UTC on index publication day, every task that touches BigQuery fails simultaneously with a `google.auth.exceptions.TransportError: 401 Unauthorized`. All 40 tasks in the index calculation DAG fail within the same two-minute window. No individual retry succeeds because the credential is invalid for all of them.

**Root cause**

Service account keys stored as static JSON in Airflow connections or environment variables have an expiry date (by default, GCP SA keys never expire, but organizational policy may enforce rotation every 90 days). When rotation occurs — or when a new environment is provisioned from an old secrets snapshot — the key embedded in the Airflow connection is stale. There is no native Airflow mechanism that detects a credential is about to expire and alerts operators. The failure mode is binary: all tasks using that connection fail simultaneously.

**Consequences**

- Simultaneous failure of all BigQuery-dependent tasks across all DAGs
- Index calculation halted; financial publication deadline missed
- ESG data pipeline and corporate action processor both fail in the same window
- Retry storms (see Problem 11) compound the outage
- Manual secret rotation under time pressure increases risk of further errors

**Prevention protocol**

1. Never store long-lived SA keys in Airflow connections. Use Workload Identity (on GKE) or the Metadata Server approach for GCP credentials:
   ```python
   # In any GCP operator, use the impersonation approach instead of key files
   from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator

   BigQueryInsertJobOperator(
       task_id="run_bq_query",
       configuration={...},
       gcp_conn_id="google_cloud_default",
       # No key file — uses the container's attached service account
   )
   ```

2. If keys must be used, store them in GCP Secret Manager and reference them dynamically:
   ```bash
   # In docker-compose.yml, set the Airflow connection to use Secret Manager
   AIRFLOW__SECRETS__BACKEND: "airflow.providers.google.cloud.secrets.secret_manager.CloudSecretManagerBackend"
   AIRFLOW__SECRETS__BACKEND_KWARGS: '{"project_id": "your-gcp-project", "connections_prefix": "airflow-connections", "variables_prefix": "airflow-variables"}'
   ```

3. Add a monitoring DAG that checks credential validity daily and alerts before expiry:
   ```python
   from google.oauth2 import service_account
   from google.auth.transport.requests import Request
   import pendulum

   def check_gcp_credentials(**context):
       from airflow.hooks.base import BaseHook
       conn = BaseHook.get_connection("google_cloud_default")
       # Attempt a lightweight API call to verify the credential
       import google.auth
       credentials, project = google.auth.default()
       credentials.refresh(Request())
       if not credentials.valid:
           raise ValueError("GCP credential is invalid or expired")

   credential_check = PythonOperator(
       task_id="validate_gcp_credentials",
       python_callable=check_gcp_credentials,
       dag=monitoring_dag,
   )
   ```

4. Set up a GCP key rotation policy and sync the rotation event to a CI/CD pipeline that updates the Airflow connection automatically:
   ```bash
   # In a key rotation script triggered by Cloud Scheduler or a secret version event
   NEW_KEY=$(gcloud iam service-accounts keys create - \
     --iam-account=airflow-sa@project.iam.gserviceaccount.com \
     --key-file-type=json 2>/dev/null)

   gcloud secrets versions add airflow-gcp-sa-key \
     --data-stdin <<< "$NEW_KEY"

   # Then trigger an Airflow connection update via the REST API
   ```

**Fix procedure**

1. Confirm the credential error is the root cause:
   ```bash
   docker logs airflow-worker --tail 50 2>&1 | grep -i "401|unauthorized|credential|expired"
   ```

2. Test the current connection:
   ```bash
   docker exec airflow-scheduler airflow connections test google_cloud_default
   ```

3. Rotate or update the connection with the new key:
   ```bash
   # Delete old connection and recreate with new key JSON
   docker exec airflow-scheduler airflow connections delete google_cloud_default

   docker exec airflow-scheduler airflow connections add google_cloud_default \
     --conn-type google_cloud_platform \
     --conn-extra '{"key_path": "/opt/airflow/secrets/new_sa_key.json", "project": "your-project"}'
   ```

4. Clear failed tasks and re-trigger:
   ```bash
   docker exec airflow-scheduler airflow dags clear \
     --dag-id index_calculation_dag \
     --start-date 2026-03-23 \
     --yes
   ```

---

## High — Data Quality / SLA Risk

---

### Sensor Deadlocks

**What happens**

A GCS sensor is waiting for a file to arrive — say, a corporate action feed that usually lands by 05:30 UTC. It is configured in `poke` mode. With 20 such sensors running simultaneously across different pipelines, they collectively hold 20 worker slots permanently. When the index calculation DAG tries to start at 06:00, all available CeleryExecutor worker slots are occupied by blocking sensors, and the calculation tasks can never be scheduled. The system deadlocks: sensors wait for files, calculation waits for slots, slots are held by sensors.

**Root cause**

In `poke` mode, an Airflow sensor occupies a worker slot for its entire lifetime — it runs continuously in a tight sleep-check loop. This is correct for short-lived waits but catastrophic when many sensors wait simultaneously or when wait times are long. The CeleryExecutor has a finite pool of workers. If more sensors are in `poke` mode than there are workers, the system deadlocks because no new tasks (including the calculation tasks the sensors are waiting to unblock) can ever run.

**Consequences**

- Complete scheduling deadlock: no tasks execute
- Corporate action data not processed; index weights calculated incorrectly
- Data quality issue may not be detected until after publication
- Sensors time out eventually, but by then the index publication window has passed
- Every pipeline that depends on file arrival is affected simultaneously

**Prevention protocol**

1. Always use `mode="reschedule"` for sensors that may wait more than a few minutes:
   ```python
   from airflow.providers.google.cloud.sensors.gcs import GCSObjectExistenceSensor

   wait_for_corporate_actions = GCSObjectExistenceSensor(
       task_id="wait_for_corporate_actions",
       bucket="financial-data-feeds",
       object="corporate_actions/{{ ds }}/ca_feed.csv",
       mode="reschedule",          # releases the worker slot while waiting
       poke_interval=60,           # check every 60 seconds
       timeout=3600,               # fail after 1 hour, don't wait forever
       soft_fail=False,            # hard fail so alert fires
       gcp_conn_id="google_cloud_default",
   )
   ```

2. Set a meaningful `timeout` on every sensor — never let a sensor wait indefinitely:
   ```python
   # Bad: no timeout
   GCSObjectExistenceSensor(task_id="wait", bucket="b", object="f", mode="reschedule")

   # Good: explicit timeout with a business-meaningful value
   GCSObjectExistenceSensor(
       task_id="wait_for_esg_feed",
       bucket="esg-data-bucket",
       object="feeds/{{ ds }}/esg_scores.parquet",
       mode="reschedule",
       timeout=7200,    # 2 hours — if not here by then, fail and alert
       poke_interval=120,
       on_failure_callback=notify_on_call_team,
   )
   ```

3. Dedicate a pool specifically for sensors, separate from compute workers:
   ```bash
   # Create a sensor pool with limited slots
   docker exec airflow-scheduler airflow pools set sensor_pool 10 "Dedicated pool for file sensors"
   ```
   ```python
   GCSObjectExistenceSensor(
       task_id="wait_for_feed",
       pool="sensor_pool",  # sensors compete only with each other
       mode="reschedule",
       ...
   )
   ```

**Fix procedure**

1. Identify sensors holding slots:
   ```bash
   docker exec airflow-scheduler airflow tasks states-for-dag-run \
     --dag-id corporate_actions_dag \
     --run-id scheduled__2026-03-23T00:00:00+00:00
   ```

2. If deadlocked, kill the blocking sensors by clearing them:
   ```bash
   docker exec airflow-scheduler airflow tasks clear \
     --dag-id corporate_actions_dag \
     --task-id wait_for_corporate_actions \
     --yes
   ```

3. Fix sensor mode in the DAG file (`poke` → `reschedule`), redeploy the DAG, and re-trigger the DAG run manually.

4. Consider adding a `reschedule` check across all sensors in your DAG folder:
   ```bash
   grep -rn "mode=['\"]poke['\"]" ./dags/ | grep -i sensor
   # Review each hit and convert to reschedule mode
   ```

---

### XCom Overload

**What happens**

A pipeline developer uses XCom to pass a Pandas DataFrame between tasks — the result of a large SQL Server query containing 500,000 rows of constituent data. This DataFrame is serialized to the Airflow metadata database on every task run. After three months, the `xcom` table in the metadata DB occupies 40 GB. The web UI becomes slow to navigate; the scheduler spends seconds per task instance just fetching XCom values. Eventually the metadata DB disk fills and the scheduler crashes.

**Root cause**

XCom (Cross-Communication) is Airflow's mechanism for passing small metadata between tasks. Values are stored as serialized blobs in the `xcom` table of the metadata database. The default XCom backend imposes no size limit — developers can push arbitrarily large objects, including entire DataFrames, lists of millions of records, or large JSON blobs. These accumulate over time and are not cleaned up automatically unless `xcom_expire_seconds` is configured (Airflow 2.5+) or a periodic cleanup is run.

**Consequences**

- Metadata DB grows without bound; disk fills within weeks or months
- Scheduler performance degrades as XCom fetches add latency to every task
- Large XCom values slow DAG run pages in the UI (the values are rendered inline)
- If the metadata DB uses SQL Server, large binary columns can cause page overflow issues
- Passing DataFrames via XCom creates an implicit coupling between tasks that breaks when data volume grows

**Prevention protocol**

1. Never pass data between tasks via XCom. Pass only pointers (GCS URIs, BigQuery table names, file paths):
   ```python
   # Bad: passing actual data
   def compute_constituents(**context):
       df = query_sql_server()
       context['task_instance'].xcom_push(key='result', value=df.to_dict())  # NEVER DO THIS

   # Good: pass a pointer to where the data was written
   def compute_constituents(**context):
       df = query_sql_server()
       gcs_path = f"gs://index-scratch/constituents/{{ ds }}/result.parquet"
       df.to_parquet(gcs_path)
       context['task_instance'].xcom_push(key='output_path', value=gcs_path)
   ```

2. Implement a custom GCS XCom backend that stores large values in GCS automatically:
   ```python
   # custom_xcom_backend.py
   from airflow.models.xcom import BaseXCom
   from google.cloud import storage
   import json, pickle

   class GCSXComBackend(BaseXCom):
       GCS_BUCKET = "airflow-xcom-store"
       GCS_PREFIX = "xcom"

       @staticmethod
       def serialize_value(value, **kwargs):
           if isinstance(value, (dict, list)) and len(str(value)) > 65536:
               # Store large values in GCS
               client = storage.Client()
               bucket = client.bucket(GCSXComBackend.GCS_BUCKET)
               key = f"{GCSXComBackend.GCS_PREFIX}/{kwargs.get('dag_id')}/{kwargs.get('task_id')}.pickle"
               blob = bucket.blob(key)
               blob.upload_from_string(pickle.dumps(value))
               return BaseXCom.serialize_value(f"gcs://{GCSXComBackend.GCS_BUCKET}/{key}")
           return BaseXCom.serialize_value(value)
   ```
   ```ini
   [core]
   xcom_backend = custom_xcom_backend.GCSXComBackend
   ```

3. Configure XCom expiry (Airflow 2.5+):
   ```ini
   [core]
   xcom_expire_seconds = 604800  # expire XCom values after 7 days
   ```

4. Add periodic XCom cleanup to your maintenance DAG:
   ```python
   from airflow.operators.bash import BashOperator

   clean_xcom = BashOperator(
       task_id="clean_old_xcoms",
       bash_command="""
           airflow db clean \
             --tables xcom \
             --clean-before-timestamp '{{ macros.ds_add(ds, -30) }}' \
             --yes
       """,
   )
   ```

**Fix procedure**

1. Check XCom table size:
   ```sql
   -- PostgreSQL
   SELECT pg_size_pretty(pg_total_relation_size('xcom')) AS xcom_size;
   SELECT count(*), sum(length(value)) / 1048576 AS total_mb FROM xcom;

   -- SQL Server
   SELECT
       COUNT(*) AS xcom_count,
       SUM(DATALENGTH(value)) / 1048576 AS total_mb
   FROM xcom;
   ```

2. Delete old XCom records immediately to free space:
   ```bash
   docker exec airflow-scheduler airflow db clean \
     --tables xcom \
     --clean-before-timestamp "2026-02-01 00:00:00" \
     --yes
   ```

3. Identify which tasks are pushing large XCom values:
   ```sql
   SELECT dag_id, task_id, key, length(value) AS value_bytes
   FROM xcom
   ORDER BY value_bytes DESC
   LIMIT 20;
   ```

4. Fix the offending tasks to use GCS pointers instead of inline data. Redeploy.

---

### DAG Parse Time Explosion

**What happens**

A DAG file that generates tasks dynamically makes a SQL Server database call at module level to fetch the list of index families. Every time the DAG processor scans the file (every `min_file_process_interval` seconds, default 30), it opens a database connection and executes a query. With 50 DAG files in the folder, the DAG processor is making hundreds of database calls per minute, saturating the SQL Server connection pool. The DAG processor timeout fires, DAGs appear to "disappear" from the UI intermittently, and the scheduler logs fill with parse timeout warnings.

**Root cause**

Airflow's DAG processor imports every Python file in `dags_folder` as a module repeatedly, looking for DAG objects. Any code at the module level (outside functions and classes) executes every time the file is imported. This includes `import` statements that trigger network calls, database queries that fetch dynamic task configurations, API calls to fetch secret values, and `Variable.get()` calls that query the metadata DB. Parse time compounds with the number of DAG files.

**Consequences**

- DAGs appear and disappear in the UI (parse timeout exceeded)
- Metadata DB connection pool exhausted by DAG parsing, affecting actual task execution
- Scheduler logs fill with `DagFileProcessorProcess` timeout warnings
- Adding new DAGs makes the problem worse, not better
- Developer feedback loop is slow: a changed DAG takes minutes to appear in the UI

**Prevention protocol**

1. Move all database calls and API calls inside task callables, never at module level:
   ```python
   # Bad: DB call at module level (runs on every parse)
   from sqlserver_utils import get_index_families
   INDEX_FAMILIES = get_index_families()  # executes on import!

   for family in INDEX_FAMILIES:
       PythonOperator(task_id=f"process_{family}", ...)

   # Good: DB call inside the task callable
   def process_index_family(family_name, **context):
       # This runs only when the task executes, not on parse
       from sqlserver_utils import get_index_families
       families = get_index_families()
       ...
   ```

2. Use `Variable.get()` with a default to avoid metadata DB calls during parse:
   ```python
   # Bad: fails and blocks if the Variable doesn't exist
   MY_CONFIG = Variable.get("index_config")

   # Good: use default, defer to task execution
   def my_task(**context):
       config = Variable.get("index_config", default_var="{}")
       ...
   ```

3. Cache dynamic DAG configurations using a JSON or YAML file instead of a live DB call:
   ```python
   # Generate config file in a separate process, read it statically during parse
   import json
   from pathlib import Path

   CONFIG_PATH = Path("/opt/airflow/dags/config/index_families.json")
   with open(CONFIG_PATH) as f:
       INDEX_FAMILIES = json.load(f)  # file read, not DB call — fast and safe
   ```

4. Measure parse time explicitly to catch regressions in CI:
   ```bash
   time docker exec airflow-scheduler airflow dags list --verbose 2>&1 | grep "DagBag"
   # Target: under 5 seconds total for the entire DAG folder
   # Alert: over 30 seconds indicates a problem
   ```

5. Set a strict import timeout:
   ```ini
   [core]
   dagbag_import_timeout = 15     # fail import if it takes longer than 15 seconds
   min_file_process_interval = 60 # only re-parse DAG files every 60 seconds
   ```

**Fix procedure**

1. Identify slow-parsing DAGs:
   ```bash
   docker exec airflow-scheduler airflow dags list-import-errors
   docker logs airflow-dag-processor --tail 200 2>&1 | grep -i "timeout|slow|exceeded"
   ```

2. Profile parse time per file:
   ```python
   # run_parse_profile.py — run inside the scheduler container
   import time
   from airflow.models import DagBag

   start = time.time()
   bag = DagBag(dag_folder='/opt/airflow/dags/index_calculation_dag.py',
                include_examples=False)
   elapsed = time.time() - start
   print(f"Parse time: {elapsed:.2f}s — DAGs: {list(bag.dags.keys())}")
   ```

3. Move offending DB/API calls inside task functions and redeploy.

---

### Trigger Rule Confusion

**What happens**

A cleanup task is supposed to run at the end of every DAG run — success or failure — to remove temporary GCS files created during index calculation. The cleanup task uses the default trigger rule `all_success`. When the upstream calculation task fails (because the SQL Server query returned no rows), the cleanup task is marked as "skipped" automatically. Temporary files accumulate in GCS for weeks, incurring storage costs and sometimes causing conflicts with subsequent runs that expect the temporary namespace to be clean.

**Root cause**

Airflow's trigger rules determine when a task is eligible to run based on the states of its upstream tasks. The default rule, `all_success`, means a task only runs if every upstream task succeeded. This makes sense for computation tasks but breaks for housekeeping tasks that must run regardless of upstream outcomes. The available rules are: `all_success`, `all_failed`, `all_done`, `all_skipped`, `one_success`, `one_failed`, `one_done`, `none_failed`, `none_failed_min_one_success`, `none_skipped`, and `always`. The wrong choice silently skips critical tasks.

**Consequences**

- Cleanup tasks never run after failures, leaving temporary data in GCS/SQL Server
- Notification tasks that should alert on failure are silently skipped
- End-of-pipeline audit logging tasks are bypassed when any upstream task fails
- Debugging failures is harder because post-failure diagnostics tasks were skipped

**Prevention protocol**

1. Use the right trigger rule for the right purpose — reference table:

   | Use case | Trigger rule | Rationale |
   |---|---|---|
   | Normal computation task | `all_success` (default) | Only run if everything before succeeded |
   | Cleanup / teardown task | `all_done` | Run after all upstreams complete, regardless of state |
   | Notification on failure | `one_failed` | Trigger alert only if something failed |
   | Final audit / summary task | `none_failed` | Run if nothing failed (includes skips) |
   | Branching join task | `none_failed_min_one_success` | At least one branch succeeded |

2. Always set `trigger_rule` explicitly on cleanup and notification tasks:
   ```python
   from airflow.utils.trigger_rule import TriggerRule

   cleanup_gcs_temp = PythonOperator(
       task_id="cleanup_gcs_temp",
       python_callable=remove_temp_files,
       trigger_rule=TriggerRule.ALL_DONE,  # runs even if upstream failed
   )

   notify_failure = PythonOperator(
       task_id="notify_on_call",
       python_callable=send_pagerduty_alert,
       trigger_rule=TriggerRule.ONE_FAILED,  # only runs if something failed
   )
   ```

3. Draw your DAG on paper before coding it. Mark each task with its intended trigger rule. If a task is downstream of a branch operator, it almost certainly needs a non-default trigger rule.

**Fix procedure**

1. Identify tasks incorrectly skipped after a failure:
   ```bash
   docker exec airflow-scheduler airflow tasks states-for-dag-run \
     --dag-id index_calculation_dag \
     --run-id scheduled__2026-03-22T06:00:00+00:00
   # Look for tasks in "skipped" state that should have run
   ```

2. Update the task's `trigger_rule` in the DAG file. Redeploy.

3. To re-run only the skipped tasks (e.g., the cleanup task) without re-running everything:
   ```bash
   docker exec airflow-scheduler airflow tasks clear \
     --dag-id index_calculation_dag \
     --task-id cleanup_gcs_temp \
     --run-id scheduled__2026-03-22T06:00:00+00:00 \
     --yes
   ```

---

### Backfill vs Production Collision

**What happens**

An analyst needs to reprocess three months of ESG scoring data due to a methodology change. They trigger a backfill DAG. The backfill uses `max_active_runs=10` (the default) and immediately saturates all available worker slots. The production index calculation DAG, which runs at 06:00 UTC and has a hard publication deadline at 08:00 UTC, cannot start because all 10 worker slots are occupied by backfill tasks processing data from November 2025.

**Root cause**

By default, all DAGs share the same pool of worker slots (`default_pool`). Backfill DAGs and production DAGs compete equally for these slots. Backfill jobs are typically I/O-heavy and long-running, which means they hold slots for extended periods. Without priority weighting or dedicated pools, Airflow's scheduler does not distinguish between "this task is needed for a regulatory deadline" and "this task is reprocessing historical data for analytics."

**Consequences**

- Production index calculation delayed or missed entirely
- Financial publication deadline breached; regulatory reporting exposure
- Backfill blocks all other pipeline progress, not just the competing DAG
- Manual cancellation of backfill mid-run may leave data in a partially processed state
- Analysts and engineers both frustrated: backfill cancelled, index delayed

**Prevention protocol**

1. Create dedicated pools for backfill and production:
   ```bash
   docker exec airflow-scheduler airflow pools set default_pool 8 "Default pool for production tasks"
   docker exec airflow-scheduler airflow pools set backfill_pool 4 "Pool for backfill and reprocessing tasks"
   docker exec airflow-scheduler airflow pools set critical_pool 4 "High-priority pool for index publication"
   ```

2. Assign the appropriate pool in every DAG or task:
   ```python
   # Production index calculation — always gets critical_pool slots
   calculate_index = BigQueryInsertJobOperator(
       task_id="calculate_index_constituents",
       pool="critical_pool",
       priority_weight=100,  # highest priority
       ...
   )

   # Backfill tasks use the dedicated backfill pool
   reprocess_esg = PythonOperator(
       task_id="reprocess_esg_score",
       pool="backfill_pool",
       priority_weight=10,  # low priority
       ...
   )
   ```

3. Set `max_active_runs` conservatively on backfill DAGs:
   ```python
   with DAG(
       dag_id="esg_methodology_backfill",
       max_active_runs=2,   # never run more than 2 concurrent historical runs
       max_active_tasks=4,  # never more than 4 active tasks across all runs
       ...
   ) as dag:
       ...
   ```

4. Schedule backfill operations outside production windows:
   ```bash
   # Trigger backfill only during off-peak hours (14:00-04:00 UTC)
   # Use a wrapper DAG that checks the current time before triggering backfill
   ```

**Fix procedure**

1. Pause the backfill DAG immediately:
   ```bash
   docker exec airflow-scheduler airflow dags pause esg_methodology_backfill
   ```

2. Clear the backfill tasks that are currently holding slots:
   ```bash
   docker exec airflow-scheduler airflow dags clear \
     --dag-id esg_methodology_backfill \
     --start-date 2025-11-01 \
     --end-date 2025-11-30 \
     --yes
   ```

3. Verify production DAG can now acquire slots and trigger it manually if needed:
   ```bash
   docker exec airflow-scheduler airflow dags trigger index_calculation_dag
   ```

4. After the production run completes, resume backfill at reduced concurrency.

---

### Task Retry Storm

**What happens**

The SQL Server database hosting index constituent data goes offline for planned maintenance at 06:30 UTC. At that moment, 50 tasks across 8 different DAGs are all attempting to connect to SQL Server. Every task fails with a connection timeout. Airflow respects the `retries=3` configuration on each task, scheduling 3 retries per task with exponential backoff. Within 20 minutes, 150 retry tasks are queued, all attempting to connect to a database that is still offline. When SQL Server comes back online at 07:00, all 150 tasks flood the database simultaneously with connection requests, causing it to crash again.

**Root cause**

Airflow's retry mechanism operates at the individual task level with no coordination across tasks. If 50 tasks share a dependency on a failed system (a database, an API, a file system), each task independently retries on its own schedule. With default exponential backoff, retries cluster in waves. The resulting connection storm can overwhelm the recovered system — a secondary failure caused by the remediation effort itself.

**Consequences**

- Recovery from the original outage triggers a secondary outage
- Total downtime is extended significantly beyond the original maintenance window
- SQL Server connection pool exhausted; all pipelines fail together
- ESG and index calculation data both affected, broadening the incident scope
- The retry storm is difficult to stop without clearing all queued tasks manually

**Prevention protocol**

1. Implement a circuit breaker callback that pauses a DAG after N consecutive task failures:
   ```python
   def pause_dag_on_repeated_failure(context):
       """Pause the DAG if more than 5 tasks have failed in this run."""
       dag_run = context['dag_run']
       failed_tasks = [
           ti for ti in dag_run.get_task_instances()
           if ti.state == 'failed'
       ]
       if len(failed_tasks) >= 5:
           dag_run.dag.set_is_paused(is_paused=True)
           # Send a single alert
           notify_on_call(
               f"DAG {dag_run.dag_id} paused after {len(failed_tasks)} failures. "
               f"Suspected infrastructure issue. Manual investigation required."
           )

   # Apply to all tasks
   DEFAULT_ARGS = {
       "on_failure_callback": pause_dag_on_repeated_failure,
   }
   ```

2. Limit the total number of active tasks per DAG to reduce storm intensity:
   ```python
   with DAG(
       dag_id="index_calculation_dag",
       max_active_tasks=10,  # never more than 10 concurrent tasks from this DAG
       ...
   ) as dag:
       ...
   ```

3. Use jitter in retry delays to spread out reconnection attempts:
   ```python
   import random
   from datetime import timedelta

   def jittered_retry_delay():
       base = 300  # 5 minutes
       jitter = random.randint(0, 120)  # up to 2 minutes of randomness
       return timedelta(seconds=base + jitter)

   DEFAULT_ARGS = {
       "retries": 2,
       "retry_delay": timedelta(minutes=5),
       "retry_exponential_backoff": True,
       "max_retry_delay": timedelta(minutes=30),
   }
   ```

4. Set `max_active_tasks_per_dag` globally to cap storm size:
   ```ini
   [core]
   max_active_tasks_per_dag = 16
   ```

**Fix procedure**

1. Pause all affected DAGs immediately to stop new retries from being queued:
   ```bash
   for dag_id in index_calculation_dag esg_ingestion_dag corporate_actions_dag; do
     docker exec airflow-scheduler airflow dags pause $dag_id
   done
   ```

2. Wait for SQL Server to be fully healthy and accepting connections.

3. Clear all failed and queued retry tasks across the affected DAGs:
   ```bash
   docker exec airflow-scheduler airflow tasks clear \
     --dag-id index_calculation_dag \
     --state failed \
     --start-date 2026-03-23 \
     --yes
   ```

4. Unpause DAGs one at a time, with a 2-minute gap between each:
   ```bash
   docker exec airflow-scheduler airflow dags unpause index_calculation_dag
   sleep 120
   docker exec airflow-scheduler airflow dags unpause esg_ingestion_dag
   sleep 120
   docker exec airflow-scheduler airflow dags unpause corporate_actions_dag
   ```

---

## Moderate — Operational Pain

---

### DAG Visibility Issues (Import Errors)

**What happens**

A developer deploys a new DAG file with a typo in the Python syntax. The DAG processor fails to import the file and logs the error — but critically, in Airflow 2.x, all other DAGs in the same folder continue to load correctly. However, in older configurations where a `__init__.py` or shared utility module is broken, all DAGs that import that module fail together. A new DAG deployed three days ago simply does not appear in the UI; the developer assumes the deployment worked and moves on. The DAG never runs.

**Root cause**

Airflow loads DAGs by treating the `dags_folder` as a Python package. If a DAG file contains a syntax error, an import of a missing module, or any exception raised at the module level during import, the `DagBag` catches the exception and records it as an import error for that file only. The file is excluded from the active DAG list. The error is visible in `airflow dags list-import-errors` and the UI's "Import Errors" section, but only if someone looks there. There is no alert by default.

**Consequences**

- New pipeline never runs; data goes unprocessed without anyone noticing
- If the broken file contains a shared utility import, multiple DAGs may silently disappear
- Developers waste time debugging deployment tooling when the issue is a Python error
- SLA obligations for a new data product are missed from day one
- Import errors in production are only discovered reactively, often via data consumers

**Prevention protocol**

1. Add import error validation to every CI pipeline before deployment:
   ```bash
   # ci-validate-dags.sh
   #!/bin/bash
   set -e

   pip install apache-airflow==$(cat .airflow-version) \
     apache-airflow-providers-google \
     apache-airflow-providers-microsoft-mssql \
     --quiet

   python << 'EOF'
   from airflow.models import DagBag

   bag = DagBag(dag_folder='./dags', include_examples=False)
   errors = bag.import_errors

   if errors:
       print(f"FAIL: {len(errors)} DAG import error(s) found:")
       for filepath, error in errors.items():
           print(f"  {filepath}: {error}")
       exit(1)

   print(f"OK: {len(bag.dags)} DAGs loaded without errors")
   EOF
   ```

2. Add a monitoring DAG that checks for import errors and sends an alert:
   ```python
   def check_import_errors(**context):
       from airflow.models import DagBag
       bag = DagBag(include_examples=False)
       if bag.import_errors:
           error_summary = "\n".join(
               f"  {f}: {e}" for f, e in bag.import_errors.items()
           )
           raise ValueError(
               f"Airflow DAG import errors detected:\n{error_summary}\n"
               f"These DAGs will not run until fixed."
           )

   PythonOperator(
       task_id="check_dag_import_errors",
       python_callable=check_import_errors,
       dag=monitoring_dag,  # runs every 15 minutes
   )
   ```

3. Use separate DAG subfolders for different teams; a broken DAG in one team's folder does not affect another team's imports.

**Fix procedure**

1. Check for import errors:
   ```bash
   docker exec airflow-scheduler airflow dags list-import-errors
   ```

2. Fix the Python error in the DAG file. Use a linter to catch common issues:
   ```bash
   pip install pyflakes
   pyflakes ./dags/broken_dag.py
   python -m py_compile ./dags/broken_dag.py && echo "Syntax OK"
   ```

3. Redeploy and verify:
   ```bash
   # After redeploying the fixed file:
   docker exec airflow-scheduler airflow dags list | grep broken_dag
   docker exec airflow-scheduler airflow dags list-import-errors
   ```

---

### Docker Compose Instability

**What happens**

The official Airflow Docker Compose file is designed for local development, but the team has deployed it directly to a production VM. After six weeks, the PostgreSQL volume fills up (task instance logs and XCom data), causing the metadata DB container to restart in a crash loop. Meanwhile, worker containers have no resource limits and occasionally consume all available host memory, triggering the kernel OOM killer on the scheduler container. There are no health checks defined, so the web UI shows all components as healthy even when containers have been restarting every 20 minutes.

**Root cause**

The official `docker-compose.yaml` in the Airflow repository is explicitly documented as a reference for local development. It has no resource limits, no log rotation, permissive health checks, no volume size management, and relies on `restart: always` as its sole reliability mechanism. In a production environment, these omissions cause slow-accumulating failures: disk fills, memory exhaustion, and undetected container restarts.

**Consequences**

- Scheduler or worker restarts interrupt in-flight tasks, creating zombie tasks
- Disk exhaustion crashes the metadata database, causing a full outage
- No observability: containers restart silently; operators don't know until pipelines fail
- Uncontrolled resource usage on the host VM starves other processes
- Log files grow without bound, making diagnosis of actual problems difficult

**Prevention protocol**

1. Add resource limits to every Airflow container:
   ```yaml
   # docker-compose.yml — production hardening
   x-airflow-common:
     &airflow-common
     image: apache/airflow:2.9.3
     deploy:
       resources:
         limits:
           cpus: '2.0'
           memory: 4G
         reservations:
           cpus: '0.5'
           memory: 1G
   ```

2. Configure Docker log rotation to prevent disk fill:
   ```yaml
   x-airflow-common:
     &airflow-common
     logging:
       driver: "json-file"
       options:
         max-size: "100m"
         max-file: "5"
   ```

3. Add meaningful health checks to each service:
   ```yaml
   airflow-scheduler:
     healthcheck:
       test: ["CMD-SHELL", "airflow jobs check --job-type SchedulerJob --hostname \"$(hostname)\""]
       interval: 30s
       timeout: 10s
       retries: 5
       start_period: 30s

   airflow-webserver:
     healthcheck:
       test: ["CMD", "curl", "--fail", "http://localhost:8080/health"]
       interval: 30s
       timeout: 10s
       retries: 5

   airflow-postgres:
     healthcheck:
       test: ["CMD", "pg_isready", "-U", "airflow"]
       interval: 10s
       timeout: 5s
       retries: 5
   ```

4. Mount volumes with explicit size limits using named volumes and monitoring:
   ```yaml
   volumes:
     postgres_data:
       driver: local
       driver_opts:
         o: size=50g  # limit if using tmpfs; otherwise monitor with cron
     airflow_logs:
       driver: local
   ```
   ```bash
   # Add to host cron: alert if volume exceeds 80% capacity
   df -h /var/lib/docker/volumes/ | awk 'NR>1 && $5+0 > 80 {print "WARN: "$0}'
   ```

5. Enable remote logging to GCS so local log accumulation is not a concern:
   ```yaml
   AIRFLOW__LOGGING__REMOTE_LOGGING: "True"
   AIRFLOW__LOGGING__REMOTE_BASE_LOG_FOLDER: "gs://your-airflow-logs-bucket/logs"
   AIRFLOW__LOGGING__REMOTE_LOG_CONN_ID: "google_cloud_default"
   ```

**Fix procedure**

1. When the metadata DB volume is full:
   ```bash
   # Check volume usage
   docker exec airflow-postgres df -h /var/lib/postgresql/data

   # Clean up old task instance records
   docker exec airflow-scheduler airflow db clean \
     --clean-before-timestamp "2026-01-01 00:00:00" \
     --tables task_instance,xcom,log \
     --yes
   ```

2. If containers are restart-looping, check the specific exit code:
   ```bash
   docker inspect airflow-scheduler --format='{{.State.ExitCode}} {{.State.Error}}'
   docker logs airflow-scheduler --tail 50
   ```

3. Apply resource limits and restart the stack:
   ```bash
   docker compose down
   # Edit docker-compose.yml to add resource limits
   docker compose up -d
   docker compose ps  # verify all services are healthy
   ```

---

### Web UI Slow or Unresponsive

**What happens**

The Airflow web UI takes 30+ seconds to load the DAG list page. Clicking into a DAG's task instance grid times out with a 504 error from the Nginx reverse proxy. The metadata database has accumulated 50 million task instance records over two years of operation, and every UI query does full table scans because query optimization for the `task_instance` table was never considered. During index publication mornings, when engineers are actively monitoring pipeline progress, the UI is completely unusable.

**Root cause**

Airflow's web UI queries the metadata database for every page render: the DAG list, the task grid, the DAG run list, and the log viewer all issue SQL queries. As the `task_instance`, `dag_run`, `log`, and `xcom` tables grow into the tens of millions of rows, these queries become progressively slower. The default Airflow configuration does not enforce any data retention policy. SQL Server and PostgreSQL alike struggle with unindexed range scans over large time-partitioned data.

**Consequences**

- Engineers cannot monitor pipeline status during critical publication windows
- Timeout errors in the UI mask actual task failures (the UI shows nothing, not an error)
- Alert fatigue as engineers fall back to querying the database directly
- New team members cannot use the UI effectively for debugging
- The slow UI is often misdiagnosed as a scheduler problem

**Prevention protocol**

1. Set up automated database cleanup on a weekly maintenance DAG:
   ```bash
   # Run weekly to purge records older than 90 days
   docker exec airflow-scheduler airflow db clean \
     --clean-before-timestamp "$(date -d '90 days ago' '+%Y-%m-%d %H:%M:%S')" \
     --tables dag_run,task_instance,xcom,log,job,sla_miss \
     --do-not-pause-dag \
     --yes
   ```

2. Configure page size limits in the web UI:
   ```ini
   [webserver]
   page_size = 100       # default is 100, reduce to 25 for very large installations
   dag_default_view = grid
   ```

3. Add database indexes on the most-queried columns (if not present):
   ```sql
   -- PostgreSQL: add missing indexes for common query patterns
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_instance_dag_run
     ON task_instance (dag_id, run_id, state);

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dag_run_dag_id_state
     ON dag_run (dag_id, state, execution_date);
   ```

4. Set UI session timeout to reduce open connection count:
   ```ini
   [webserver]
   web_server_worker_timeout = 120
   workers = 4
   ```

**Fix procedure**

1. Immediately check the size of key tables:
   ```sql
   -- PostgreSQL
   SELECT relname AS table_name,
          pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
          reltuples::bigint AS row_estimate
   FROM pg_class
   WHERE relname IN ('task_instance', 'dag_run', 'xcom', 'log', 'job')
   ORDER BY pg_total_relation_size(oid) DESC;
   ```

2. Run an aggressive cleanup:
   ```bash
   docker exec airflow-scheduler airflow db clean \
     --clean-before-timestamp "2025-06-01 00:00:00" \
     --yes
   ```

3. Run `VACUUM ANALYZE` on PostgreSQL after the delete:
   ```bash
   docker exec airflow-postgres psql -U airflow -c "VACUUM ANALYZE task_instance;"
   docker exec airflow-postgres psql -U airflow -c "VACUUM ANALYZE dag_run;"
   ```

4. Restart the webserver to clear any cached slow queries:
   ```bash
   docker compose restart airflow-webserver
   ```

---

### Timezone Confusion

**What happens**

A daily index calculation DAG is configured with `start_date=datetime(2026, 3, 1, 6, 0)` using Python's naive `datetime`. The developer intends the DAG to run at 06:00 UTC. But Airflow interprets naive datetimes in the server's local timezone — which is UTC+2 (CET). The DAG actually triggers at 04:00 UTC. During British Summer Time transitions, the offset changes and the DAG suddenly triggers at a different wall-clock time. Index constituents are calculated with incomplete data because the corporate action feed doesn't arrive until 05:30 UTC.

**Root cause**

Airflow internally operates in UTC, but `datetime` objects without timezone information (naive datetimes) are ambiguous. Airflow's behavior with naive datetimes depends on the `default_timezone` setting and the local system timezone, which varies across environments. Additionally, `schedule` expressions using cron syntax are evaluated in UTC by default, but if developers think in local time, the cron expression is wrong. The mismatch between developer intention and system behavior is silent — no error is raised.

**Consequences**

- DAG triggers at the wrong time, silently
- Data dependencies (upstream feeds) may not be ready when the DAG runs
- Daylight saving time changes cause one-hour drift twice a year
- Inconsistent behavior across development (local machine), staging, and production environments
- Historical `execution_date` values are ambiguous, making replay and debugging difficult

**Prevention protocol**

1. Always use `pendulum` for all date/time values in Airflow DAGs — never use Python's `datetime`:
   ```python
   # Bad: naive datetime, timezone-dependent behavior
   from datetime import datetime
   start_date = datetime(2026, 3, 1, 6, 0)

   # Good: timezone-aware with pendulum
   import pendulum
   start_date = pendulum.datetime(2026, 3, 1, 6, 0, tz="UTC")
   ```

2. Document and enforce a team timezone policy:
   ```python
   # In shared dag_defaults.py
   import pendulum

   PIPELINE_TZ = "UTC"  # ALL times in this codebase are UTC. No exceptions.

   def make_start_date(year: int, month: int, day: int) -> pendulum.DateTime:
       """Create a timezone-aware start date in UTC."""
       return pendulum.datetime(year, month, day, tz=PIPELINE_TZ)
   ```

3. Set Airflow's default timezone explicitly:
   ```ini
   [core]
   default_timezone = utc
   ```

4. Set the Airflow UI display timezone to match your team's convention:
   ```ini
   [webserver]
   default_ui_timezone = UTC
   ```

5. In CI, run a check that all `start_date` values use pendulum:
   ```bash
   grep -rn "datetime(" ./dags/ | grep -v "pendulum" | grep "start_date"
   # Any matches should be reviewed and converted
   ```

**Fix procedure**

1. Identify DAGs with potentially wrong trigger times:
   ```bash
   docker exec airflow-scheduler airflow dags list --output json | \
     python3 -c "
   import json, sys
   dags = json.load(sys.stdin)
   for d in dags:
       print(d['dag_id'], d.get('next_dagrun'), d.get('schedule_interval'))
   "
   ```

2. Fix the `start_date` to use `pendulum.datetime(..., tz='UTC')` and redeploy.

3. After redeployment, verify the next scheduled run time is correct:
   ```bash
   docker exec airflow-scheduler airflow dags next-execution index_calculation_dag
   ```

---

### Upgrade Path Complexity (2.x → 3.x)

**What happens**

The team decides to upgrade from Airflow 2.9 to Airflow 3.0. After the upgrade, dozens of DAGs fail with `ImportError: cannot import name 'PythonOperator' from 'airflow.operators.python_operator'` — the old module path. Other DAGs silently change behavior because `execution_date` semantics changed. The metadata database migration takes 45 minutes on production data, during which Airflow is completely offline. The team rolls back but finds that the pre-upgrade backup was not taken.

**Root cause**

Airflow 3.x introduced breaking changes: module paths reorganized (providers moved out of core), the `execution_date` concept replaced by `data_interval_start/end`, deprecated operators removed, and the TaskFlow API became the preferred pattern. The migration script (`airflow db migrate`) is not instantaneous on large databases. The combination of code changes and database migration, without a tested rollback plan, is a high-risk operation.

**Consequences**

- All DAGs fail to import after upgrade if they use deprecated module paths
- Production pipelines offline during migration window
- Without a backup, rollback is impossible; the team is forced forward
- Subtle behavior changes (trigger rules, XCom behavior) cause silent data quality issues
- Team velocity drops for weeks as deprecated patterns are refactored

**Prevention protocol**

1. Maintain a pre-upgrade checklist:
   ```markdown
   Before every major Airflow upgrade:
   - [ ] Take a full metadata DB backup (pg_dump)
   - [ ] Test migration on a copy of production data in staging
   - [ ] Run all DAGs through CI import validation against the new version
   - [ ] Check the Airflow migration guide for your version pair
   - [ ] Update all import paths from old module names to new ones
   - [ ] Schedule a maintenance window with SLA-holder sign-off
   ```

2. Fix common 2.x → 3.x import path changes:
   ```python
   # Old paths (2.x) → New paths (3.x)
   # from airflow.operators.python_operator import PythonOperator
   from airflow.operators.python import PythonOperator

   # from airflow.operators.bash_operator import BashOperator
   from airflow.operators.bash import BashOperator

   # from airflow.operators.dummy_operator import DummyOperator
   from airflow.operators.empty import EmptyOperator

   # from airflow.contrib.operators.bigquery_operator import BigQueryOperator
   from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
   ```

3. Run old and new Airflow in parallel in staging before cutting over production:
   ```bash
   # Staging runs new Airflow version against a copy of production DAGs
   # Production continues on old version until staging is validated
   # Cut over only after all DAGs pass in staging for one full week
   ```

**Fix procedure**

1. If the upgrade broke DAG imports, identify all broken paths:
   ```bash
   docker exec airflow-scheduler airflow dags list-import-errors 2>&1 | \
     grep "ImportError" | sort -u
   ```

2. Run automated import path migration:
   ```bash
   # Use sed to fix the most common old module paths
   find ./dags -name "*.py" -exec sed -i \
     's/from airflow.operators.python_operator import/from airflow.operators.python import/g' {} \;
   find ./dags -name "*.py" -exec sed -i \
     's/from airflow.operators.bash_operator import/from airflow.operators.bash import/g' {} \;
   find ./dags -name "*.py" -exec sed -i \
     's/from airflow.operators.dummy_operator import DummyOperator/from airflow.operators.empty import EmptyOperator/g' {} \;
   ```

3. Run CI validation against the new Airflow version after fixes.

4. If the migration must be rolled back and a backup exists:
   ```bash
   docker compose stop
   docker exec airflow-postgres pg_restore -U airflow -d airflow --clean \
     /backup/pre_upgrade_backup.pgdump
   # Revert image tag in docker-compose.yml
   docker compose up -d
   ```

---

### Connection and Variable Management Drift

**What happens**

The team manually adds database connections and API keys via the Airflow UI in production. Six months later, a new staging environment is provisioned. None of the connections exist in staging. DAGs deployed to staging all fail immediately with `AirflowNotFoundException: The conn_id 'sqlserver_index_db' isn't defined`. The team spends two days reconstructing which connections exist, what their values are, and which DAGs depend on which connections. Two connections that existed in production are forgotten and never recreated.

**Root cause**

Airflow stores connections and variables in the metadata database. The UI provides a convenient way to add them, but changes made through the UI are not tracked in version control. When a new environment is provisioned or the metadata DB is rebuilt, all UI-defined connections are lost. There is no diff, no history, and no declarative source of truth for what connections should exist.

**Consequences**

- New environments require manual reconstruction of all connections
- Connections differ between development, staging, and production, causing environment-specific bugs
- Connection credentials may be lost if only stored in the metadata DB
- Team has no audit trail for when a connection was created or changed
- Onboarding a new engineer requires tribal knowledge transfer of what connections exist

**Prevention protocol**

1. Define all connections as environment variables using the `AIRFLOW_CONN_` pattern — these take precedence over the metadata DB:
   ```bash
   # In .env file (committed to version control without secrets)
   # Actual values injected by CI/CD from Vault or Secret Manager

   AIRFLOW_CONN_SQLSERVER_INDEX_DB="mssql+pyodbc://user:password@server:1433/IndexDB?driver=ODBC+Driver+17+for+SQL+Server"
   AIRFLOW_CONN_GOOGLE_CLOUD_DEFAULT="google-cloud-platform://?project=your-project&key_path=/secrets/sa_key.json"
   AIRFLOW_CONN_BQ_INDEX_WAREHOUSE="bigquery://?project=your-project"
   ```

2. Use Terraform to manage Airflow connections as code:
   ```hcl
   # airflow_connections.tf
   resource "google_secret_manager_secret" "airflow_conn_sqlserver" {
     secret_id = "airflow-connections-sqlserver_index_db"
     project   = var.gcp_project
   }

   resource "google_secret_manager_secret_version" "airflow_conn_sqlserver_v1" {
     secret = google_secret_manager_secret.airflow_conn_sqlserver.id
     secret_data = "mssql+pyodbc://${var.sqlserver_user}:${var.sqlserver_pass}@${var.sqlserver_host}/IndexDB?..."
   }
   ```

3. Export and commit current connections (without secret values) as documentation:
   ```bash
   docker exec airflow-scheduler airflow connections export \
     --file-format json \
     /tmp/connections_export.json

   # Sanitize secret values before committing
   cat /tmp/connections_export.json | \
     python3 -c "
   import json, sys
   conns = json.load(sys.stdin)
   for c in conns:
       c['password'] = 'REDACTED'
       c['extra'] = 'REDACTED'
   print(json.dumps(conns, indent=2))
   " > ./config/connections_reference.json
   ```

**Fix procedure**

1. Import connections from a backup export:
   ```bash
   docker exec airflow-scheduler airflow connections import \
     /opt/airflow/config/connections_backup.json
   ```

2. List currently defined connections and compare with the reference:
   ```bash
   docker exec airflow-scheduler airflow connections list --output json | \
     python3 -c "import json,sys; [print(c['conn_id']) for c in json.load(sys.stdin)]" | sort
   ```

3. Add any missing connections via environment variables in `docker-compose.yml` and restart.

---

### Log Storage Fills Disk

**What happens**

Airflow writes task logs to `/opt/airflow/logs` on the worker container's filesystem. After three months, this directory has grown to 120 GB. The Docker host's root partition fills up. Docker stops being able to write any files — including container logs, Airflow task logs, and the PostgreSQL WAL files. The metadata database crashes due to disk-full errors on WAL writes. Everything fails simultaneously.

**Root cause**

By default, Airflow writes task execution logs as flat files under `{logs_folder}/{dag_id}/{task_id}/{execution_date}/{try_number}.log`. There is no built-in log rotation or expiry for these files. In a busy environment running hundreds of tasks per day, log volume grows at multiple gigabytes per week. When task logs are stored inside Docker containers or on volumes mounted from the host, they compete with Docker's own overlay filesystem and other services for disk space.

**Consequences**

- Disk exhaustion triggers cascading failures across all services on the host
- Metadata DB may corrupt if disk fills during a write transaction
- Task logs become unavailable for debugging past incidents
- Recovery requires manual disk cleanup under time pressure

**Prevention protocol**

1. Enable remote logging to GCS as the primary log store:
   ```yaml
   # docker-compose.yml
   AIRFLOW__LOGGING__REMOTE_LOGGING: "True"
   AIRFLOW__LOGGING__REMOTE_BASE_LOG_FOLDER: "gs://your-project-airflow-logs/logs"
   AIRFLOW__LOGGING__REMOTE_LOG_CONN_ID: "google_cloud_default"
   AIRFLOW__LOGGING__ENCRYPT_S3_LOGS: "False"
   AIRFLOW__LOGGING__DELETE_LOCAL_LOGS: "True"  # delete local copy after upload
   ```

2. Set GCS log bucket lifecycle rules to auto-delete old logs:
   ```bash
   # Create a lifecycle rule to delete logs older than 90 days
   cat > /tmp/lifecycle.json << 'EOF'
   {
     "rule": [
       {
         "action": {"type": "Delete"},
         "condition": {"age": 90}
       }
     ]
   }
   EOF
   gsutil lifecycle set /tmp/lifecycle.json gs://your-project-airflow-logs
   ```

3. If remote logging is not yet configured, set up a cron job on the Docker host to rotate logs:
   ```bash
   # Add to host crontab: run at 01:00 UTC daily
   0 1 * * * find /var/lib/docker/volumes/airflow_logs/_data -name "*.log" \
     -mtime +30 -delete && \
     find /var/lib/docker/volumes/airflow_logs/_data -empty -type d -delete
   ```

4. Configure log retention in `airflow.cfg`:
   ```ini
   [core]
   log_file_retention_days = 30
   ```

**Fix procedure**

1. Check disk usage immediately:
   ```bash
   df -h /
   du -sh /var/lib/docker/volumes/airflow_logs/_data/
   du -sh /var/lib/docker/volumes/postgres_data/_data/
   ```

2. If disk is critically full (>95%), emergency log cleanup:
   ```bash
   # Delete logs older than 7 days immediately
   find /var/lib/docker/volumes/airflow_logs/_data \
     -name "*.log" -mtime +7 -delete

   # Remove empty directories
   find /var/lib/docker/volumes/airflow_logs/_data \
     -empty -type d -delete
   ```

3. Restart the metadata DB if it crashed due to disk-full WAL errors:
   ```bash
   docker compose restart airflow-postgres
   docker exec airflow-scheduler airflow db check
   ```

4. Enable remote logging before the disk fills again.

---

## Low — Annoyances / Team Friction

---

### DAG Deployment Coordination

**What happens**

Three engineers simultaneously merge DAG changes to the main branch. The git-sync sidecar on the Airflow server pulls the latest changes. One engineer's merge introduced a DAG rename that breaks a `TriggerDagRunOperator` reference in another DAG. A second engineer's change introduced a new connection that doesn't exist in production yet. All three changes land simultaneously, making root cause diagnosis difficult. Operators don't know which change caused which failure.

**Root cause**

Without a structured deployment strategy, DAG changes go live as soon as code is pushed to the watched branch. Multiple concurrent changes compound each other. The lack of atomicity in git-sync deployments means that partially-merged changes can break interdependencies between DAGs.

**Consequences**

- Multiple simultaneous failures make root cause isolation difficult
- A broken `TriggerDagRunOperator` reference silently prevents cross-DAG orchestration
- Missing connections cause immediate failures for newly deployed DAGs
- On-call team spends time bisecting which of three simultaneous changes caused the issue
- Team loses confidence in the deployment process

**Prevention protocol**

1. Use git-sync with a specific release branch, not main:
   ```yaml
   # docker-compose.yml
   airflow-git-sync:
     image: registry.k8s.io/git-sync/git-sync:v4.1.0
     environment:
       GITSYNC_REPO: "https://github.com/your-org/airflow-dags"
       GITSYNC_BRANCH: "release/production"  # not main
       GITSYNC_PERIOD: "60s"
       GITSYNC_ROOT: "/opt/airflow/dags"
   ```

2. Enforce a PR review and staging validation gate before merging to the release branch:
   ```yaml
   # .github/workflows/validate-dags.yml
   on:
     pull_request:
       paths: ['dags/**']
   jobs:
     validate:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Validate DAG imports
           run: ./ci/validate_dags.sh
         - name: Check for connection references
           run: python ./ci/check_connections.py
   ```

3. Alternatively, use Docker image pinning: DAGs are baked into the image, and deployment requires an explicit image tag bump:
   ```bash
   # Deployment is explicit: bump the image tag in docker-compose.yml
   # Then: docker compose up -d --no-deps airflow-scheduler airflow-worker
   # This creates a clear, reviewable deployment artifact
   ```

**Fix procedure**

1. Use `git log` to identify which changes landed in the last deployment:
   ```bash
   git -C /opt/airflow/dags log --oneline -10
   ```

2. Revert the release branch to the last known good commit:
   ```bash
   git -C /opt/airflow/dags checkout <last-good-commit>
   ```

3. Re-deploy changes one at a time, validating each before proceeding.

---

### SubDAG and TaskGroup Confusion

**What happens**

A legacy DAG uses `SubDagOperator` to encapsulate a group of related tasks (e.g., "download, validate, transform" as a sub-unit). The SubDAG creates a separate DAG Run entry in the metadata DB. When the parent DAG has `max_active_runs=1`, the SubDAG's own scheduler slot conflicts with the parent's, causing a deadlock where the parent waits for the SubDAG to complete, but the SubDAG can never get a slot because the parent is holding the only allowed run.

**Root cause**

`SubDagOperator` was Airflow's original mechanism for task grouping. It creates a fully independent DAG with its own scheduler entry, which introduces a second layer of scheduling, a second set of `max_active_runs` constraints, and a deadlock-prone interaction with the parent DAG's concurrency settings. `SubDagOperator` was deprecated in Airflow 2.2 and removed in Airflow 3.0. `TaskGroup` is the correct replacement — it is a UI grouping only, with no scheduling overhead.

**Consequences**

- Deadlocks that are very difficult to diagnose
- Double entries in the DAG list (parent DAG + every SubDAG appear separately)
- SubDAG state is tracked separately, making the overall DAG Run status confusing
- Airflow 3.0 removes SubDagOperator entirely; teams on legacy code are blocked from upgrading

**Prevention protocol**

1. Migrate all SubDAGs to TaskGroups:
   ```python
   # Old SubDAG pattern (DEPRECATED — DO NOT USE)
   from airflow.operators.subdag import SubDagOperator

   subdag_task = SubDagOperator(
       task_id="process_index_family",
       subdag=create_index_subdag("parent_dag", "process_index_family"),
   )

   # New TaskGroup pattern (correct approach)
   from airflow.utils.task_group import TaskGroup

   with TaskGroup(group_id="process_index_family") as process_group:
       download = PythonOperator(task_id="download_data", ...)
       validate = PythonOperator(task_id="validate_data", ...)
       transform = PythonOperator(task_id="transform_data", ...)
       download >> validate >> transform
   ```

2. Add a CI check that rejects any new use of SubDagOperator:
   ```bash
   if grep -rn "SubDagOperator|subdag" ./dags/ --include="*.py" | grep -v "^Binary|#.*SubDag"; then
       echo "FAIL: SubDagOperator usage detected. Use TaskGroup instead."
       exit 1
   fi
   ```

**Fix procedure**

1. Identify SubDAG deadlocks:
   ```bash
   docker exec airflow-scheduler airflow dags list | grep "parent_dag\."
   # SubDAGs appear as "parent_dag.subdag_task_id" in the DAG list
   ```

2. Clear the deadlocked SubDAG run:
   ```bash
   docker exec airflow-scheduler airflow dags clear \
     --dag-id parent_dag.process_index_family \
     --yes
   ```

3. Migrate to TaskGroup and remove the SubDag DAG entries from the metadata DB.

---

### Executor Choice Paralysis

**What happens**

A growing data engineering team is debating whether to add Celery/Redis to their Docker Compose stack, move to Kubernetes, or stay on LocalExecutor. The debate delays infrastructure decisions for months. Meanwhile, the team running LocalExecutor on a single VM hits the limits of single-node concurrency during peak periods (month-end index rebalancing), causing SLA breaches. By the time the team decides on CeleryExecutor, the setup is rushed and poorly configured.

**Root cause**

Airflow supports multiple executors with very different operational characteristics. LocalExecutor runs tasks as subprocesses on the scheduler host — simple, no dependencies, but single-node. CeleryExecutor distributes tasks to a fleet of workers via a broker (Redis or RabbitMQ) — scalable, but adds operational complexity. KubernetesExecutor spins up a Pod per task — excellent isolation, scales to zero, but requires a Kubernetes cluster. The right choice depends on team size, workload patterns, and infrastructure investment.

**Consequences**

- Wrong executor choice limits scale or adds unnecessary complexity
- LocalExecutor hits memory/CPU limits during peak processing
- CeleryExecutor requires Redis and multiple workers to maintain
- KubernetesExecutor requires Kubernetes expertise the team may not have
- Switching executors later requires a deployment change and potential metadata migration

**Prevention protocol**

Choose the executor based on team context:

| Scenario | Recommended executor | Rationale |
|---|---|---|
| Solo developer, <10 DAGs | LocalExecutor | No broker needed, simple |
| Small team, <50 DAGs, predictable load | LocalExecutor + larger VM | Cheaper than Celery |
| Team of 3+, 50-200 DAGs, variable load | CeleryExecutor | Worker scaling, task isolation |
| Bursty workloads (month-end rebalancing) | CeleryExecutor with autoscaling | Scale workers up for peaks |
| Strong k8s team, high task isolation needs | KubernetesExecutor | Best isolation, true autoscaling |
| Any size team using GCP | Cloud Composer or Cloud Run Jobs | Managed infrastructure, no ops |

For financial index platforms with strict SLAs and burst patterns (index rebalancing, ESG score updates):
- **Recommended**: CeleryExecutor with 2 worker nodes minimum, autoscaled to 5 during peak

**Fix procedure**

To migrate from LocalExecutor to CeleryExecutor:
1. Add Redis and Celery worker to `docker-compose.yml`
2. Update Airflow config: `AIRFLOW__CORE__EXECUTOR: CeleryExecutor`
3. Add `AIRFLOW__CELERY__BROKER_URL: redis://redis:6379/0`
4. Restart the stack: `docker compose up -d`
5. Verify workers are registered: `docker exec airflow-worker celery --app airflow.executors.celery_executor.app inspect active`

---

### Pool Exhaustion

**What happens**

A DAG implementing a full historical backfill of ESG data is configured with no pool assignment. It defaults to `default_pool` and immediately acquires all 16 available slots. The index calculation DAG, which also uses `default_pool`, cannot start at 06:00 UTC because no slots are available. The index publication deadline is missed. The ESG backfill was triggered by a junior engineer who did not realize it would starve all other pipelines.

**Root cause**

Airflow's default pool (`default_pool`) has a fixed number of slots (128 by default) shared by every task that does not explicitly specify a pool. Without pool assignment or priority weighting, any DAG that generates many tasks will consume slots indiscriminately. Critical pipelines and low-priority backfills compete equally.

**Consequences**

- Critical index calculation blocked by low-priority backfill
- All pipelines sharing `default_pool` are affected simultaneously
- No visibility: operators don't know a pool is exhausted until tasks stop running
- Manual intervention required to clear the blocking tasks

**Prevention protocol**

1. Create named pools for different pipeline priorities:
   ```bash
   docker exec airflow-scheduler airflow pools set default_pool 8 "General purpose pool"
   docker exec airflow-scheduler airflow pools set critical_pool 8 "Index calculation and publication"
   docker exec airflow-scheduler airflow pools set backfill_pool 4 "Historical backfills and reprocessing"
   docker exec airflow-scheduler airflow pools set sensor_pool 10 "File and condition sensors"
   ```

2. Assign pools in all DAG definitions:
   ```python
   # Default args for critical pipeline tasks
   CRITICAL_TASK_DEFAULTS = {
       "pool": "critical_pool",
       "priority_weight": 100,
   }

   BACKFILL_TASK_DEFAULTS = {
       "pool": "backfill_pool",
       "priority_weight": 10,
   }
   ```

3. Add a monitoring alert when any pool utilization exceeds 80%:
   ```sql
   -- Query pool utilization
   SELECT
       pool,
       slots_total,
       slots_used,
       slots_running,
       CAST(slots_used AS FLOAT) / NULLIF(slots_total, 0) * 100 AS utilization_pct
   FROM slot_pool
   WHERE CAST(slots_used AS FLOAT) / NULLIF(slots_total, 0) > 0.8;
   ```

**Fix procedure**

1. Check pool utilization:
   ```bash
   docker exec airflow-scheduler airflow pools list
   ```

2. Identify which tasks are consuming the full pool:
   ```bash
   docker exec airflow-scheduler airflow tasks list --dag-id esg_backfill_dag
   docker exec airflow-scheduler airflow dags list-runs --dag-id esg_backfill_dag --state running
   ```

3. Pause the backfill DAG and clear its running tasks:
   ```bash
   docker exec airflow-scheduler airflow dags pause esg_backfill_dag
   docker exec airflow-scheduler airflow dags clear --dag-id esg_backfill_dag --yes
   ```

4. Assign the backfill DAG to `backfill_pool` in the DAG file and redeploy before unpausing.

---

### Email and Alert Fatigue

**What happens**

The team configures `email_on_failure=True` and `email_on_retry=True` on all tasks with `retries=3`. When a transient SQL Server timeout causes 20 tasks to fail across 3 DAG runs, the on-call engineer receives 60 failure emails and 60 retry emails — 120 emails — within 30 minutes. The on-call engineer's inbox is flooded, critical alerts are buried, and the team starts filtering Airflow emails to a folder they never check. Real incidents go unnoticed.

**Root cause**

Airflow's built-in `email_on_failure` and `email_on_retry` operate at the task level: one email per task failure, one per retry. In a DAG with 20 tasks and 3 retries, a single DAG-level failure generates up to 80 emails (20 initial failures + 60 retries). This per-task granularity made sense in an era of simple pipelines but creates noise at production scale.

**Consequences**

- On-call engineer's email inbox flooded, critical alerts missed
- Team disables all Airflow email alerts, losing visibility entirely
- Incidents are discovered late — by data consumers, not the engineering team
- Alert channel (email) loses credibility and is ignored

**Prevention protocol**

1. Disable `email_on_failure` and `email_on_retry` globally:
   ```ini
   [email]
   email_on_failure = False
   email_on_retry = False
   ```

2. Use a DAG-level `on_failure_callback` that sends one alert per DAG run, not per task:
   ```python
   import requests

   def notify_slack_on_dag_failure(context):
       """Send a single Slack alert per DAG run failure."""
       dag_run = context['dag_run']
       task_instance = context['task_instance']

       # Only alert once per DAG run (on the first failure)
       failed_tasks = [
           ti for ti in dag_run.get_task_instances()
           if ti.state == 'failed'
       ]
       if len(failed_tasks) > 1:
           return  # Already notified for this run

       message = {
           "text": (
               f":red_circle: *DAG Failure*: `{dag_run.dag_id}`\n"
               f"Run: `{dag_run.run_id}`\n"
               f"Failed task: `{task_instance.task_id}`\n"
               f"Log: {task_instance.log_url}\n"
               f"Execution date: {context['execution_date'].isoformat()}"
           )
       }
       requests.post(os.environ["SLACK_WEBHOOK_URL"], json=message)

   with DAG(
       dag_id="index_calculation_dag",
       on_failure_callback=notify_slack_on_dag_failure,  # DAG-level callback
       ...
   ) as dag:
       ...
   ```

3. For Datadog integration, use a metric callback instead of email:
   ```python
   from datadog import initialize, statsd

   def send_datadog_metric_on_failure(context):
       initialize(api_key=os.environ["DD_API_KEY"])
       statsd.event(
           title=f"Airflow DAG Failure: {context['dag'].dag_id}",
           text=f"Task {context['task_instance'].task_id} failed",
           alert_type="error",
           tags=[
               f"dag:{context['dag'].dag_id}",
               f"task:{context['task_instance'].task_id}",
               f"env:production",
           ]
       )
   ```

**Fix procedure**

1. Disable email alerts globally if currently flooding:
   ```bash
   docker exec airflow-scheduler airflow config get-value email email_on_failure
   # Add to docker-compose.yml:
   # AIRFLOW__EMAIL__EMAIL_ON_FAILURE: "False"
   docker compose up -d
   ```

2. Implement the Slack callback above and add it to all critical DAGs.

3. Set up a Datadog or Prometheus alert rule that fires once per DAG run, not per task.

---

### Dependency Hell

**What happens**

The index calculation pipeline requires `google-cloud-bigquery==3.13.0` and `pandas==2.1.0`. Airflow 2.9 is pinned to `google-cloud-bigquery==3.9.0` via its provider package. Installing the pipeline's version breaks the Airflow provider. Installing Airflow's version breaks the pipeline's data processing logic. The team spends two days trying different combinations of `pip install --constraint` before giving up and running the pipeline code inside a Docker container via `DockerOperator`.

**Root cause**

Airflow has a large dependency tree — it pins specific versions of `google-cloud-*`, `apache-beam`, `grpcio`, and dozens of other packages. Data pipeline code often requires different versions of the same packages for new features or bug fixes. Since everything runs in the same Python environment (the Airflow worker), version conflicts are inevitable as both Airflow's requirements and pipeline requirements evolve over time.

**Consequences**

- Time-consuming dependency resolution (hours to days)
- Airflow upgrades become blocked by pipeline code dependencies
- Pipeline code upgrades break Airflow functionality
- Pipelines locked to outdated library versions, missing security patches
- The development environment never exactly matches production

**Prevention protocol**

1. Adopt the principle that Airflow only orchestrates; execution happens in isolated containers:
   ```python
   # Airflow task: delegate to a Cloud Run Job with its own Docker image
   from airflow.providers.google.cloud.operators.cloud_run import CloudRunExecuteJobOperator

   run_index_calculation = CloudRunExecuteJobOperator(
       task_id="run_index_calculation",
       project_id="your-gcp-project",
       region="europe-west1",
       job_name="index-calculation-job",
       # The Cloud Run Job image has its own requirements.txt
       # Airflow doesn't need pandas or google-cloud-bigquery at all
       gcp_conn_id="google_cloud_default",
   )
   ```

2. For Docker Compose environments, use `DockerOperator` with dedicated task images:
   ```python
   from airflow.providers.docker.operators.docker import DockerOperator

   calculate_esg_scores = DockerOperator(
       task_id="calculate_esg_scores",
       image="your-registry/esg-calculator:1.4.2",  # pinned version
       command="python calculate_esg.py --date {{ ds }}",
       docker_url="unix://var/run/docker.sock",
       network_mode="bridge",
       environment={
           "BQ_PROJECT": "your-project",
           "GCS_BUCKET": "esg-output-bucket",
       },
       auto_remove=True,
   )
   ```

3. For `KubernetesPodOperator`, each task runs in its own Pod with its own image:
   ```python
   from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator

   process_constituents = KubernetesPodOperator(
       task_id="process_index_constituents",
       image="your-registry/index-processor:2.1.0",
       cmds=["python", "-m", "index_processor.main"],
       arguments=["--date", "{{ ds }}", "--index", "MSCI_WORLD"],
       namespace="airflow-tasks",
       name="index-constituents-{{ ds_nodash }}",
       get_logs=True,
       is_delete_operator_pod=True,
   )
   ```

**Fix procedure**

1. If currently in dependency conflict, use `pip check` to identify the conflict:
   ```bash
   docker exec airflow-worker pip check 2>&1 | head -20
   ```

2. Find the conflicting package versions:
   ```bash
   docker exec airflow-worker pip show google-cloud-bigquery apache-airflow-providers-google
   ```

3. Migrate the conflicting pipeline code to a `DockerOperator` or `CloudRunExecuteJobOperator`, removing the direct dependency from the Airflow environment.

---

### `execution_date` Confusion

**What happens**

An engineer writes a task that queries BigQuery for `WHERE date = '{{ execution_date.strftime("%Y-%m-%d") }}'`. The daily DAG is scheduled to process the previous day's data. On 2026-03-23, the DAG run for `execution_date=2026-03-22` queries for `date = '2026-03-22'` — which is correct. But the engineer tells the data science team "the 2026-03-23 DAG run has completed," and the data science team queries for `date = '2026-03-23'` and finds no data. The miscommunication sends the team on a two-hour debugging detour.

Additionally, a new engineer writes `start_date=pendulum.today(tz='UTC')`, expecting the first DAG run to happen immediately. But the first actual run triggers for the next scheduled interval after `start_date`, which means the first run happens one day later than expected.

**Root cause**

`execution_date` in Airflow represents the **start of the data interval**, not the time when the task actually runs. A daily DAG scheduled at `0 6 * * *` with `start_date=2026-03-01`:
- The run that **executes on 2026-03-02 at 06:00 UTC** has `execution_date=2026-03-01T00:00:00`
- Airflow waits for the entire interval to complete before running: the DAG covering March 1 data runs on March 2

This is intentional — Airflow was designed for batch data pipelines where you process data from the previous interval. But this design is deeply counterintuitive and causes widespread confusion.

#### Airflow 2.2+ data interval terminology

| Old term | New term | Meaning |
|---|---|---|
| `execution_date` | `data_interval_start` | Start of the data interval being processed |
| `next_execution_date` | `data_interval_end` | End of the data interval being processed |
| `{{ ds }}` | `{{ ds }}` (unchanged) | `data_interval_start` formatted as `YYYY-MM-DD` |
| `{{ next_ds }}` | `{{ data_interval_end | ds }}` | `data_interval_end` formatted as `YYYY-MM-DD` |
| `execution_date` in Python | `context['data_interval_start']` | Access in task callable |

**Consequences**

- Queries filter on wrong dates, producing empty or incorrect results
- Data scientists and engineers use different terminology for the same concept
- Manually triggered DAG runs have `execution_date=now`, breaking date-based logic
- `start_date` confusion causes the first expected DAG run to be skipped
- Backfills produce results for different date ranges than expected

**Prevention protocol**

1. Use `data_interval_start` and `data_interval_end` in all new DAGs (Airflow 2.2+):
   ```python
   def query_index_data(**context):
       # Use the new, explicit terminology
       interval_start = context['data_interval_start']
       interval_end = context['data_interval_end']

       query = f"""
       SELECT constituent_id, weight, close_price
       FROM index_constituents
       WHERE trade_date >= '{interval_start.date()}'
         AND trade_date < '{interval_end.date()}'
       """
       return run_bigquery_query(query)
   ```

2. In Jinja templates, use the explicit variables:
   ```python
   # Old (ambiguous)
   bash_command = "python process.py --date {{ ds }}"

   # New (explicit about what the date means)
   bash_command = "python process.py --interval-start {{ data_interval_start | ds }} --interval-end {{ data_interval_end | ds }}"
   ```

3. Add a comment block to every DAG explaining its scheduling semantics:
   ```python
   """
   Index Calculation DAG

   Scheduling:
     - Schedule: 0 6 * * 1-5 (06:00 UTC, Mon-Fri)
     - data_interval_start: The trading day being processed (e.g., 2026-03-22)
     - data_interval_end: The next trading day (e.g., 2026-03-23)
     - Actual run time: 06:00 UTC on data_interval_end
     - Example: On 2026-03-23 at 06:00, this DAG processes data for 2026-03-22

   Do NOT confuse the logical date (data_interval_start) with the run date.
   """
   ```

4. Create a team glossary entry documenting the Airflow scheduling model:
   ```
   Airflow Data Interval Model:
   - "The 2026-03-22 run" means data_interval_start=2026-03-22
   - This run EXECUTES on 2026-03-23 at 06:00 UTC
   - It processes data FROM 2026-03-22
   - Always clarify: "the run FOR [date]" vs "the run ON [date]"
   ```

**Fix procedure**

1. If a DAG is querying the wrong date, identify where `execution_date` or `{{ ds }}` is used:
   ```bash
   grep -rn "execution_date|{{ ds }}|{{ next_ds }}" ./dags/index_calculation_dag.py
   ```

2. For a manual re-run covering a specific data date, use `--execution-date` explicitly:
   ```bash
   # Re-run the index calculation for 2026-03-22 data
   docker exec airflow-scheduler airflow dags trigger \
     index_calculation_dag \
     --execution-date 2026-03-22T00:00:00+00:00 \
     --conf '{"reason": "manual_rerun_data_correction"}'
   ```

3. Update the task code to use `data_interval_start` instead of `execution_date` and redeploy.

---

## Related

- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) — DAG fundamentals, operators, connections
- [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns) — Reusable DAG design patterns
- [airflow-deployment](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-deployment) — Docker Compose setup and hardening
- [airflow-troubleshooting](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-troubleshooting) — Quick diagnostic reference

---

## Sources

- Shopify: Lessons Learned Running Airflow at Scale
- Astronomer: 7 Common Debugging Errors in Airflow DAGs
- Apache Airflow Official Troubleshooting Guide
- Apache Airflow Best Practices Documentation
- GCP Cloud Composer Troubleshooting Guide
- Airflow Summit 2026: Bad vs Best Practices in Production
