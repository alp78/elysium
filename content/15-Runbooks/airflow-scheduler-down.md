---
tags: [orchestration, airflow]
type: runbook
severity: sev1
technology: airflow
status: stable
updated: 2026-03-23
---

# Airflow Scheduler Down

> **Trigger**: Airflow scheduler container not running or heartbeat missing
> **Severity**: Sev1 | **SLA**: 15 min acknowledge, resolve within 1 hr
> **Owner**: On-call data engineer
> **Paging**: Datadog alert `airflow.scheduler.heartbeat.missing` (no heartbeat for > 5 min)

---

## Symptoms

- **DAGs not triggering on schedule**: index load DAG has not run at its cron window; constituent refresh is overdue
- **Airflow webserver UI** shows red banner: `The scheduler does not appear to be running. Last heartbeat was received N minutes ago.`
- **Datadog alert**: `airflow.scheduler.heartbeat` metric absent for > 5 minutes; monitor `airflow.scheduler.heartbeat.missing` fires
- **Docker container status**: `docker ps -a` shows `airflow-scheduler` in status `Exited`, `Restarting`, or absent
- **Airflow log stream** in Cloud Logging shows no new entries from `airflow.scheduler` logger after a timestamp
- Downstream effects: BigQuery tables not updated, ESG score refresh stale, Pub/Sub events not triggering consumers

> [!tip] Related pattern
> If you are unfamiliar with how the scheduler, executor, and DAG parsing interact, review [[airflow-core-concepts]] before diving into diagnosis. Understanding the heartbeat mechanism will make the logs below much easier to interpret.

> [!warning] Data freshness impact
> A down scheduler stops all DAG scheduling. Pipelines feeding index constituent data and ESG factor calculations will silently fall behind. If the scheduler has been down more than 30 minutes, check what DAG runs were missed before declaring resolution — they will need manual backfill.

---

## Diagnosis

### Step 1 — SSH to the Airflow host VM

```bash
gcloud compute ssh airflow-vm --tunnel-through-iap --zone=europe-west1-b
```

### Step 2 — Check Docker container status

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}\t{{.RunningFor}}"
```

Look specifically for the `airflow-scheduler` row. For general guidance on interpreting [[container-lifecycle|container states and restart policies]], check the container lifecycle reference. Expected healthy state: `Up X hours`. Unhealthy states:

| Status | Meaning |
|--------|---------|
| `Exited (1) N minutes ago` | Crashed — check logs |
| `Restarting (137) N seconds ago` | OOM-killed or crash loop |
| `Restarting (1) N seconds ago` | Application error crash loop |
| Not listed | Container removed; needs `docker compose up` |

Also check all related containers:

```bash
docker ps -a --filter "name=airflow"
```

### Step 3 — Read scheduler logs

```bash
docker logs airflow-scheduler --tail 150 2>&1 | less
```

Key patterns to search for:

```bash
# Scan for Python exceptions
docker logs airflow-scheduler --tail 200 2>&1 | grep -E "ERROR|CRITICAL|Traceback|Exception"

# Scan for OOM signals
docker logs airflow-scheduler --tail 200 2>&1 | grep -i "killed|memory|oom"

# Scan for DB connection errors
docker logs airflow-scheduler --tail 200 2>&1 | grep -i "connection|psycopg2|OperationalError|timeout"
```

### Step 4 — Check metadata database connectivity

```bash
docker exec airflow-scheduler airflow db check
```

Expected output: `Connection successful.`

If this command fails or times out, the metadata database (PostgreSQL) is the root cause — see RC-3.

Also verify the PostgreSQL container is running:

```bash
docker ps --filter "name=postgres" --format "{{.Names}}\t{{.Status}}"
```

### Step 5 — Check disk space on the Airflow host

```bash
df -h
```

Critical paths to check:

| Path | Risk |
|------|------|
| `/var/lib/docker` | Docker overlay storage — fills from large log files or images |
| `/opt/airflow/logs` | Airflow task logs — can grow very large |
| `/` | Root filesystem |

If any mount is above 90%, disk fullness is likely causing the crash loop. See RC-4.

### Step 6 — Check the Docker daemon and host memory

Check that the Docker daemon itself is healthy using [[managing-services|systemd service management]]:

```bash
# Docker daemon health
systemctl status docker

# Host memory pressure
free -h

# OOM events in kernel log
dmesg | grep -i "oom|killed|out of memory" | tail -20

# Check cgroup memory limit for the scheduler container
docker inspect airflow-scheduler | jq '.[0].HostConfig | {Memory, MemorySwap, OomKillDisable}'
```

If `Memory` is a low non-zero value (e.g., `536870912` = 512 MB) and the scheduler is managing many DAGs, the container is memory-constrained.

---

## Resolution

### RC-1: Scheduler Crashed — Simple Restart

If the container exited cleanly (exit code 0 or 1 with a recoverable error) and the metadata DB is healthy:

```bash
# Navigate to the Docker Compose project directory
cd /opt/airflow

docker compose restart airflow-scheduler
```

Watch the restart succeed:

```bash
docker logs airflow-scheduler --follow --tail 50
```

Wait for the log line:

```
[SCHEDULER] Starting the scheduler loop
```

Or the heartbeat confirmation:

```
[SCHEDULER] Heartbeat sent at ...
```

If `docker compose` is not in the PATH:

```bash
docker-compose restart airflow-scheduler
```

### RC-2: Full Docker Compose Restart

Use this when multiple containers are in a bad state or after a host reboot left containers in an inconsistent state:

```bash
cd /opt/airflow

# Graceful stop
docker compose down

# Brief pause to allow network interfaces to reset
sleep 5

# Start all services
docker compose up -d

# Watch startup logs for all containers
docker compose logs --follow --tail 50
```

Confirm all containers are healthy:

```bash
docker compose ps
```

Expected: all services `Up (healthy)` or `Up`.

### RC-3: Metadata Database Connection Lost

If `airflow db check` fails, the PostgreSQL container or its network is the issue:

```bash
# Check PostgreSQL container
docker ps --filter "name=postgres"
docker logs postgres --tail 50

# Restart just PostgreSQL
docker compose restart postgres

# Wait 15 seconds for PostgreSQL to fully start, then check again
sleep 15
docker exec airflow-scheduler airflow db check
```

If PostgreSQL restarts but the scheduler cannot connect, check network and credentials:

```bash
# Verify environment variables are set correctly
docker exec airflow-scheduler env | grep -E "AIRFLOW__DATABASE|POSTGRES|SQL_ALCHEMY"

# Test connection string manually from inside the scheduler container
docker exec airflow-scheduler python -c "
import sqlalchemy
engine = sqlalchemy.create_engine('postgresql+psycopg2://airflow:airflow@postgres/airflow')
conn = engine.connect()
print('Connected successfully')
conn.close()
"
```

If the metadata DB data is corrupt (e.g., from an ungraceful shutdown during a write):

```bash
# Run DB upgrade/repair (safe, non-destructive)
docker exec airflow-scheduler airflow db upgrade
```

> [!danger] Do not use airflow db reset unless explicitly directed
> `airflow db reset` drops and recreates all tables, permanently deleting all DAG run history, XCom values, task logs references, and variable/connection records. This is only appropriate for a fresh environment, never production. If DB corruption is confirmed, restore from the most recent PostgreSQL dump in GCS instead.

### RC-4: Disk Full on Airflow Host

If `/opt/airflow/logs` or `/var/lib/docker` is full:

```bash
# Check Airflow log volume
du -sh /opt/airflow/logs/

# Remove task logs older than 30 days
find /opt/airflow/logs -type f -name "*.log" -mtime +30 -delete

# Remove empty log directories
find /opt/airflow/logs -type d -empty -delete

# Prune unused Docker resources (stopped containers, dangling images, unused volumes)
docker system prune -f

# Check space reclaimed
df -h
```

After freeing space, restart the scheduler:

```bash
cd /opt/airflow && docker compose restart airflow-scheduler
```

### RC-5: OOM-Killed Scheduler

If `dmesg` shows the scheduler was OOM-killed:

**Immediate mitigation** — increase the memory limit in `docker-compose.yml`:

```yaml
# docker-compose.yml — airflow-scheduler service
services:
  airflow-scheduler:
    image: apache/airflow:2.8.1
    mem_limit: 4g          # Increase from previous value
    memswap_limit: 4g
    environment:
      AIRFLOW__SCHEDULER__PARSING_PROCESSES: "2"  # Reduce if DAG parsing is the culprit
      AIRFLOW__SCHEDULER__MAX_DAGRUNS_PER_LOOP_TO_SCHEDULE: "16"
```

Apply the change:

```bash
cd /opt/airflow
docker compose up -d airflow-scheduler
```

#### ps aux --sort=-rss — identify scheduler memory consumers

```bash
# Live memory stats for the scheduler container
docker stats airflow-scheduler --no-stream

# Check DAG parsing memory (parsing_processes config)
docker exec airflow-scheduler airflow config get-value scheduler parsing_processes
```

If DAG count is large (> 200 DAGs), consider splitting into multiple Airflow environments or pruning unused DAGs.

### RC-6: Scheduler in Crash Loop — DAG Import Error

A single broken DAG file can prevent the scheduler from starting if it raises an exception at import time:

```bash
# Check for DAG import errors
docker exec airflow-scheduler airflow dags list-import-errors
```

Output lists the filename and the Python exception. Fix or temporarily remove the offending DAG:

```bash
# Move the broken DAG file out of the dags directory
mv /opt/airflow/dags/broken_esg_dag.py /tmp/broken_esg_dag.py.bak

# Restart the scheduler
docker compose restart airflow-scheduler

# After scheduler is running, investigate and fix the DAG in version control before restoring
```

---

## Backfill Missed DAG Runs

After the scheduler is confirmed healthy, determine what DAG runs were missed during the outage window:

```bash
# List recent DAG run states for the most critical DAGs
docker exec airflow-scheduler airflow dags list-runs \
  --dag-id index_constituent_load \
  --start-date 2026-03-23T00:00:00 \
  --end-date 2026-03-23T23:59:59

docker exec airflow-scheduler airflow dags list-runs \
  --dag-id esg_score_refresh \
  --start-date 2026-03-23T00:00:00 \
  --end-date 2026-03-23T23:59:59
```

Backfill any missed runs:

```bash
# Backfill a specific DAG for the missed window
docker exec airflow-scheduler airflow dags backfill \
  --dag-id index_constituent_load \
  --start-date 2026-03-23 \
  --end-date 2026-03-23 \
  --reset-dagruns

# Trigger a one-off run for the ESG refresh immediately
docker exec airflow-scheduler airflow dags trigger esg_score_refresh \
  --conf '{"triggered_by": "incident_recovery"}'
```

> [!tip] Backfill vs trigger
> Use `backfill` when you need to recreate runs for a historical window with the correct logical date. Use `dags trigger` when you simply need to start a run now with `execution_date = now`.

---

## Verification

```bash
# 1. Confirm scheduler container is running and stable
docker ps --filter "name=airflow-scheduler" --format "{{.Status}}"
# Expected: Up X minutes (healthy)

# 2. Check scheduler heartbeat from inside the container
docker exec airflow-scheduler airflow jobs check --job-type SchedulerJob --hostname "$(hostname)"

# 3. Watch for DAGs being scheduled (live log tail)
docker logs airflow-scheduler --follow --tail 20

# 4. Confirm webserver no longer shows the "Scheduler not running" banner
# Open Airflow UI in browser and check top banner

# 5. Verify Datadog heartbeat metric resumes
# In Datadog: search for metric airflow.scheduler.heartbeat — should have data points within the last 5 minutes

# 6. Trigger a test DAG and confirm it runs end-to-end
docker exec airflow-scheduler airflow dags trigger \
  --dag-id health_check_dag \
  --conf '{"test": true}'
```

---

## Escalation

| Condition | Action |
|-----------|--------|
| Scheduler will not start after 3 restart attempts | Escalate to infra lead; check host VM health, kernel logs |
| Metadata DB corrupted and no recent backup | Escalate to DBA; restore PostgreSQL from GCS dump |
| Backfill of missed runs spans > 4 hours of data | Notify data consumers; validate downstream BigQuery tables manually |
| Multiple Airflow services down (webserver, triggerer, workers) | Treat as full Airflow outage; escalate immediately, initiate full `docker compose down && up` |

---

## Post-Incident

- [ ] Send resolution notice to #data-engineering-incidents with outage duration and missed DAG runs list
- [ ] Confirm all missed DAG runs have been backfilled and succeeded
- [ ] Validate BigQuery gold-layer tables are current (check `updated_at` timestamps)
- [ ] Confirm ESG score and index constituent data freshness in downstream dashboards
- [ ] Schedule PIR within 48 hours
- [ ] Review Docker resource limits and host VM sizing
- [ ] Add DAG import error alerting to Datadog if not present

---

## Long-Term Prevention

| Action | Owner | Priority |
|--------|-------|----------|
| Add Datadog process check for `airflow-scheduler` container | Infra | High |
| Increase scheduler container memory limit proactively | Infra | High |
| Implement log rotation for `/opt/airflow/logs` (logrotate or Airflow's built-in cleanup) | Data Eng | High |
| Add `healthcheck` to `airflow-scheduler` in `docker-compose.yml` | Infra | Medium |
| Configure Airflow log shipping to Cloud Logging (structured JSON) | Infra | Medium |
| Evaluate migrating to Cloud Composer for managed scheduler resilience | Data Lead | Low |
| Set up automated PostgreSQL dump to GCS nightly | DBA | High |

---

## Related

- [[on-call-guide]]
- [[runbooks-index]]
- [[airflow-dag-patterns|DAG standards]]
- [[sql-server-disk-full]]
- [[pubsub-dead-letter-backup]]
- [[docker-compose|Docker Compose]]
