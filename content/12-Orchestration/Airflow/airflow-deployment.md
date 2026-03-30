---
type: how-to
category: orchestration
technology: [airflow, docker, gcp]
tags: [orchestration, docker, airflow, gcp]
aliases:
  - Cloud Composer
  - Cloud Composer setup
  - Airflow Docker Compose
  - Airflow Docker
  - Airflow self-hosted
  - MWAA
  - Managed Workflows for Apache Airflow
  - Astronomer
  - Astro
  - Airflow Helm
  - Airflow Kubernetes deployment
  - Airflow GCE
  - Airflow configuration
  - airflow.cfg
  - Airflow secrets backend
  - GCP Secret Manager Airflow
  - Airflow DAG deployment
  - git sync DAGs
  - Airflow StatsD
  - Airflow monitoring
keywords:
  - airflow deployment
  - docker compose airflow
  - cloud composer
  - cloud composer 2
  - managed airflow gcp
  - MWAA
  - managed workflows apache airflow
  - astronomer astro
  - airflow helm chart
  - airflow kubernetes
  - airflow self-hosted
  - airflow gce
  - airflow postgresql
  - airflow.cfg settings
  - parallelism
  - dag_concurrency
  - max_active_runs_per_dag
  - airflow secrets
  - secret manager airflow
  - git sync dags
  - gcs bucket dags
  - airflow statsd metrics
  - airflow health check
  - airflow resource sizing
  - celery executor deployment
  - kubernetes executor deployment
description: "Step-by-step how-to guide for deploying Apache Airflow: local Docker Compose development setup, self-hosted on GCE, GCP Cloud Composer managed service, AWS MWAA, configuration of airflow.cfg, DAG deployment strategies, secrets management, and monitoring integration."
related:
  - airflow-core-concepts
  - airflow-dag-patterns
  - airflow-troubleshooting
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# How To: Deploy Apache Airflow

A practical how-to guide covering every major Airflow deployment option — from a local Docker Compose environment for development to managed cloud services for production. Includes configuration reference, DAG deployment strategies, secrets management, monitoring setup, and cost comparisons.

> [!tip] Prerequisites
> Familiarity with [airflow-core-concepts](/12-Orchestration/Airflow/airflow-core-concepts) (Executors, Scheduler, Workers, Metadata DB) is assumed. This note focuses on infrastructure — not DAG authoring.

---

## Option 1: Local Development with Docker Compose

Docker Compose is the fastest way to run a full Airflow environment locally. The official `docker-compose.yaml` from Apache runs all components in containers (see [docker-compose](/09-Docker/docker-compose) for foundational Compose concepts), making it easy to reproduce the production environment on a laptop.

### Step 1: Fetch the Official Docker Compose File

```bash
# Always use the specific version matching your target production version
AIRFLOW_VERSION=2.9.2

# Download the official docker-compose.yaml from Apache
curl -LfO "https://airflow.apache.org/docs/apache-airflow/${AIRFLOW_VERSION}/docker-compose.yaml"

# Create required directories
mkdir -p ./dags ./logs ./plugins ./config

# Set the Airflow UID to avoid permission issues on Linux
echo -e "AIRFLOW_UID=$(id -u)" > .env
```

### Step 2: Full `docker-compose.yaml` (Production-Like Local Setup)

The following is an annotated version of the official file with key customizations for data engineering workflows:

```yaml
# docker-compose.yaml
# Apache Airflow — Local development environment
# Based on: https://airflow.apache.org/docs/apache-airflow/2.9.2/docker-compose.yaml

version: '3.8'

# Shared environment variables for all Airflow containers
x-airflow-common: &airflow-common
  image: apache/airflow:2.9.2-python3.11  # Pin the version explicitly
  environment: &airflow-common-env
    # Core configuration
    AIRFLOW__CORE__EXECUTOR: LocalExecutor
    AIRFLOW__CORE__DAGS_FOLDER: /opt/airflow/dags
    AIRFLOW__CORE__PARALLELISM: 32          # Max tasks running across all DAGs
    AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG: 16
    AIRFLOW__CORE__MAX_ACTIVE_RUNS_PER_DAG: 3
    AIRFLOW__CORE__LOAD_EXAMPLES: 'false'   # Disable example DAGs

    # Database
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow

    # Scheduler
    AIRFLOW__SCHEDULER__ENABLE_HEALTH_CHECK: 'true'
    AIRFLOW__SCHEDULER__HEARTBEAT_SEC: 5
    AIRFLOW__SCHEDULER__MIN_FILE_PROCESS_INTERVAL: 30  # Parse DAG files every 30s

    # Webserver
    AIRFLOW__WEBSERVER__EXPOSE_CONFIG: 'true'     # Show config in UI (dev only)
    AIRFLOW__WEBSERVER__SECRET_KEY: 'dev-secret-key-change-in-prod'  # CHANGE IN PROD

    # Email (configure SMTP for local testing)
    AIRFLOW__EMAIL__EMAIL_BACKEND: airflow.utils.email.send_email_smtp
    AIRFLOW__SMTP__SMTP_HOST: mailhog        # Local SMTP mock (mailhog container)
    AIRFLOW__SMTP__SMTP_PORT: '1025'
    AIRFLOW__SMTP__SMTP_MAIL_FROM: airflow@example.com

    # Connections (set via env — avoids storing creds in the Metadata DB)
    AIRFLOW_CONN_GOOGLE_CLOUD_DEFAULT: 'google-cloud-platform://?project=my-project&key_path=/opt/secrets/sa-key.json'
    AIRFLOW_CONN_MY_POSTGRES: 'postgresql://user:pass@host:5432/mydb'

    # Variables
    AIRFLOW_VAR_ENVIRONMENT: development
    AIRFLOW_VAR_GCS_BUCKET: my-dev-bucket

    # GCP credentials (mount service account key)
    GOOGLE_APPLICATION_CREDENTIALS: /opt/secrets/sa-key.json

  volumes:
    - ${AIRFLOW_PROJ_DIR:-.}/dags:/opt/airflow/dags          # Your DAG files
    - ${AIRFLOW_PROJ_DIR:-.}/logs:/opt/airflow/logs          # Task logs
    - ${AIRFLOW_PROJ_DIR:-.}/config:/opt/airflow/config      # airflow.cfg overrides
    - ${AIRFLOW_PROJ_DIR:-.}/plugins:/opt/airflow/plugins    # Custom plugins
    - ./secrets:/opt/secrets:ro                               # GCP service account keys
  user: "${AIRFLOW_UID:-50000}:0"  # See [file-manipulation](/01-Shell/File-Operations/file-manipulation) for chown/chmod patterns when DAG file permissions cause issues
  depends_on: &airflow-common-depends-on
    postgres:
      condition: service_healthy

services:

  # --- Metadata Database ---
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    volumes:
      - postgres-db-volume:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "airflow"]
      interval: 10s
      retries: 5
      start_period: 5s
    restart: always

  # --- Airflow Scheduler ---
  airflow-scheduler:
    <<: *airflow-common
    command: scheduler
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8974/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always

  # --- Airflow Webserver ---
  airflow-webserver:
    <<: *airflow-common
    command: webserver
    ports:
      - "8080:8080"    # Airflow UI available at http://localhost:8080
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always

  # --- Airflow Init (one-shot setup container) ---
  airflow-init:
    <<: *airflow-common
    entrypoint: /bin/bash
    command:
      - -c
      - |
        # Initialize the Metadata DB and create the admin user
        airflow db migrate
        airflow users create \
          --username admin \
          --firstname Admin \
          --lastname User \
          --role Admin \
          --email admin@example.com \
          --password admin
    environment:
      <<: *airflow-common-env
      _AIRFLOW_DB_MIGRATE: 'true'

  # --- Local SMTP mock for testing email alerts ---
  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "8025:8025"    # MailHog UI at http://localhost:8025

volumes:
  postgres-db-volume:
```

### Step 3: Start and Verify

```bash
# Initialize the database and create the admin user (run once)
docker compose up airflow-init

# Start all services in the background
docker compose up -d

# Verify all containers are healthy
docker compose ps

# Tail the scheduler logs
docker compose logs -f airflow-scheduler

# Open the Airflow UI
open http://localhost:8080  # macOS; use xdg-open on Linux
# Default credentials: admin / admin

# Stop all services
docker compose down

# Stop AND delete volumes (clean slate — destroys all metadata and logs)
docker compose down -v
```

> [!tip] Custom Python Packages
> Add packages to a `requirements.txt` file and reference it in a custom Dockerfile that extends the official image. Do not install packages into the running container — they won't persist across restarts.

```dockerfile
# Dockerfile — extend the official image with custom packages
FROM apache/airflow:2.9.2-python3.11

# Copy and install additional Python packages
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt
```

```bash
# requirements.txt — packages for your DAGs
google-cloud-bigquery==3.15.0
google-cloud-storage==2.14.0
pandas==2.2.0
dbt-bigquery==1.7.2
apache-airflow-providers-google==10.13.0
apache-airflow-providers-postgres==5.10.0
```

---

## Option 2: Self-Hosted on Google Compute Engine (GCE)

For teams that need more control than managed services provide, or want to minimize cloud-managed service costs. VM provisioning can be automated with [terraform-compute](/07-Terraform/GCP-Resources/terraform-compute).

### Architecture

```
┌─────────────────────────────────────────┐
│  GCE VM (e2-standard-4 or larger)       │
│                                         │
│  ┌────────────┐  ┌──────────────────┐  │
│  │ Scheduler  │  │   Webserver      │  │
│  │ (systemd)  │  │   (systemd)      │  │
│  └────────────┘  └──────────────────┘  │
│         │                │              │
│  ┌──────▼──────────────────────────┐   │
│  │  LocalExecutor (subprocess)     │   │
│  └──────────────────────────────┐  │   │
│                                  │  │   │
│  ┌─────────────────────────────┐ │  │   │
│  │  Cloud SQL (PostgreSQL)     │◄┘  │   │
│  │  (Managed Metadata DB)      │    │   │
│  └─────────────────────────────┘    │   │
└─────────────────────────────────────────┘
         │
         ▼
  GCS bucket (DAG sync, logs)
```

### Install Airflow on a GCE VM

```bash
# 1. Install system dependencies
sudo apt-get update && sudo apt-get install -y \
    python3.11 python3.11-dev python3.11-venv \
    libpq-dev build-essential git curl

# 2. Create a dedicated airflow user
sudo useradd -m -s /bin/bash airflow
sudo su - airflow

# 3. Create a virtual environment
python3.11 -m venv ~/airflow-venv
source ~/airflow-venv/bin/activate

# 4. Install Airflow with constraints for reproducibility
AIRFLOW_VERSION=2.9.2
PYTHON_VERSION=3.11
CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"

pip install "apache-airflow[postgres,google,celery]==${AIRFLOW_VERSION}" \
    --constraint "${CONSTRAINT_URL}"

# 5. Configure Airflow home
export AIRFLOW_HOME=/opt/airflow
mkdir -p $AIRFLOW_HOME/dags $AIRFLOW_HOME/logs $AIRFLOW_HOME/plugins

# 6. Set the database connection to Cloud SQL
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN="postgresql+psycopg2://airflow:PASSWORD@/airflow?host=/cloudsql/PROJECT:REGION:INSTANCE"

# 7. Initialize the database
airflow db migrate

# 8. Create admin user
airflow users create \
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com \
    --password SECURE_PASSWORD
```

### Systemd Service Files

```ini
# /etc/systemd/system/airflow-scheduler.service
[Unit]
Description=Airflow Scheduler
After=network.target postgresql.service
Requires=network.target

[Service]
User=airflow
Group=airflow
Type=simple
Environment="AIRFLOW_HOME=/opt/airflow"
Environment="AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://..."
ExecStart=/home/airflow/airflow-venv/bin/airflow scheduler
Restart=on-failure
RestartSec=5s
# Send logs to journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=airflow-scheduler

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/airflow-webserver.service
[Unit]
Description=Airflow Webserver
After=network.target airflow-scheduler.service

[Service]
User=airflow
Group=airflow
Type=simple
Environment="AIRFLOW_HOME=/opt/airflow"
Environment="AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://..."
ExecStart=/home/airflow/airflow-venv/bin/airflow webserver --port 8080
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=airflow-webserver

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the services
sudo systemctl daemon-reload
sudo systemctl enable airflow-scheduler airflow-webserver
sudo systemctl start airflow-scheduler airflow-webserver

# Check status
sudo systemctl status airflow-scheduler
journalctl -u airflow-scheduler -f  # Follow logs
```

---

## Option 3: GCP Cloud Composer

Google Cloud Composer is the fully managed Airflow service on GCP. It handles Scheduler, Webserver, Workers, and Metadata DB. You only manage DAGs and configuration.

### Cloud Composer 2 vs Cloud Composer 1

| Feature | Composer 1 | Composer 2 |
|---|---|---|
| Executor | CeleryExecutor | LocalKubernetesExecutor |
| Worker sizing | Fixed VMs | Auto-scaling pods |
| Environment updates | Slow (GKE node pool) | Fast (pod replacement) |
| Price | Per worker VM | Per vCPU-hour used |
| Python version support | Limited | Python 3.8–3.11 |
| Recommendation | Legacy | **Use Composer 2** |

### Creating a Cloud Composer 2 Environment

```bash
# Create a Cloud Composer 2 environment via gcloud CLI
gcloud composer environments create my-airflow-env \
    --location us-central1 \
    --image-version composer-2.6.6-airflow-2.7.3 \
    --environment-size SMALL \                  # SMALL / MEDIUM / LARGE
    --scheduler-count 1 \                       # Number of scheduler replicas
    --scheduler-cpu 0.5 \
    --scheduler-memory 1.875GB \
    --web-server-cpu 0.5 \
    --web-server-memory 1.875GB \
    --worker-cpu 0.5 \
    --worker-memory 1.875GB \
    --min-workers 1 \                           # Min workers (auto-scales)
    --max-workers 6 \
    --service-account composer-sa@my-project.iam.gserviceaccount.com \
    --network my-vpc \
    --subnetwork my-subnet \
    --enable-private-endpoint \                 # Private IP — recommended for production
    --enable-ip-masq-agent

# Get the DAGs GCS bucket path (deploy DAGs here)
gcloud composer environments describe my-airflow-env \
    --location us-central1 \
    --format="value(config.dagGcsPrefix)"
# Output: gs://us-central1-my-airflow-env-XXXXX-bucket/dags

# Get the Airflow web UI URL
gcloud composer environments describe my-airflow-env \
    --location us-central1 \
    --format="value(config.airflowUri)"
```

### When to Use Cloud Composer

#### Use Cloud Composer when
- You need a fully managed, enterprise-grade Airflow with GCP IAM integration
- Your team cannot or should not manage Airflow infrastructure
- You need GCP-native features: IAP for UI access, VPC-SC, Audit Logs
- Budget allows (~$300-1500+/month depending on size)

#### Do NOT use Cloud Composer when
- You have fewer than 5-10 DAGs (massive over-engineering)
- Budget is very tight (a single GCE e2-standard-4 + Cloud SQL is far cheaper)
- You need executor customization (Composer fixes the executor)

> [!warning] Cloud Composer Costs
> Cloud Composer is expensive relative to self-hosted. A SMALL environment is ~$300-500/month. A MEDIUM environment with multiple workers can exceed $1500/month. Always set `--min-workers 1` and `--max-workers N` to enable auto-scaling and control costs. See the [[#Cost Comparison]] section below.

### Installing PyPI Packages in Cloud Composer

```bash
# Install Python packages (triggers environment update — takes 5-20 minutes)
gcloud composer environments update my-airflow-env \
    --location us-central1 \
    --update-pypi-package google-cloud-bigquery==3.15.0 \
    --update-pypi-package pandas==2.2.0

# Or use a requirements file
gcloud composer environments update my-airflow-env \
    --location us-central1 \
    --update-pypi-packages-from-file requirements.txt
```

---

### AWS MWAA — Managed Airflow on AWS

Amazon Managed Workflows for Apache Airflow (MWAA) is AWS's equivalent to Cloud Composer.

| Feature | Cloud Composer 2 | AWS MWAA |
|---|---|---|
| Platform | GCP | AWS |
| Executor | LocalKubernetesExecutor | CeleryExecutor |
| Worker sizing | Auto-scaling K8s pods | Fixed environment class |
| Startup time | ~15 min to create | ~20-30 min to create |
| S3 integration | Via GCS hook | Native (DAGs in S3 bucket) |
| Minimum cost | ~$300/month | ~$400/month (mw1.small) |
| Best for | GCP-primary shops | AWS-primary shops |

MWAA DAGs are deployed by uploading to an S3 bucket (configured at environment creation time). Package management uses a `requirements.txt` in S3 + a custom Docker image for plugins.

---

### Astronomer Astro — SaaS Airflow Platform

Astronomer provides a SaaS Airflow platform (Astro) with:
- Managed Airflow clusters in any cloud (GCP, AWS, Azure)
- Built-in CI/CD for DAG deployment (git push → deploy)
- The `astro` CLI for local development (replaces Docker Compose for Airflow dev)
- Alerts, observability, and role-based access built-in

**When to consider Astronomer:** When you want managed Airflow but need more flexibility than Cloud Composer (custom executors, bring-your-own Docker images, multi-cloud) and your company uses dbt Core + Airflow heavily.

```bash
# Install the Astro CLI for local development
brew install astro  # macOS

# Initialize a new Astro project
mkdir my-airflow-project && cd my-airflow-project
astro dev init

# Start a local Airflow environment (replaces docker compose)
astro dev start
# Opens Airflow UI at http://localhost:8080, admin/admin

# Deploy to Astro Cloud (requires account)
astro deploy
```

---

### Key airflow.cfg Configuration Settings

The most important settings for performance and reliability. All can be set via environment variables using the pattern `AIRFLOW__SECTION__KEY`.

```ini
# airflow.cfg — Key production settings
# Equivalent env var format: AIRFLOW__CORE__PARALLELISM=32

[core]
# Max tasks running simultaneously across ALL DAG Runs
parallelism = 32

# Max tasks running simultaneously within a single DAG Run
max_active_tasks_per_dag = 16

# Max concurrent DAG Runs for a single DAG
max_active_runs_per_dag = 3

# How often to re-scan the dags folder for new/changed DAG files (seconds)
min_file_process_interval = 30

# How long to keep task logs (days)
# Important: logs grow fast — archive to GCS and set a short local retention
log_file_max = 30

# Executor type — the most impactful single setting
executor = LocalExecutor

[scheduler]
# Scheduler heartbeat interval (seconds)
heartbeat_sec = 5

# How many seconds to wait before considering a task "zombie" (not reporting)
# Tasks that fail silently without updating the DB are cleaned up after this
scheduler_zombie_task_threshold = 300

# Catch up on missed DAG Runs at startup (usually False — use catchup=False in DAGs)
catchup_by_default = False

[webserver]
# Number of Gunicorn worker processes for the webserver
workers = 4

# Session timeout (seconds) — set to 0 to never expire
web_server_worker_timeout = 120

[database]
# Connection string for the Metadata DB
sql_alchemy_conn = postgresql+psycopg2://airflow:password@postgres:5432/airflow

# Connection pool size — increase if you see "QueuePool limit" errors
sql_alchemy_pool_size = 5
sql_alchemy_max_overflow = 10

[celery]
# Only applies to CeleryExecutor
broker_url = redis://redis:6379/0
result_backend = db+postgresql://airflow:password@postgres/airflow
worker_concurrency = 16    # Tasks per Celery worker process
```

---

## DAG Deployment Strategies

How DAG files get from your code editor to the Airflow Scheduler's `dags_folder`.

### Strategy 1: GCS Bucket Sync (Cloud Composer — Built-In)

Cloud Composer automatically syncs DAGs from a GCS bucket. Deploy by copying files to the bucket.

```bash
# Deploy a single DAG to Cloud Composer
gcloud composer environments storage dags import \
    --environment my-airflow-env \
    --location us-central1 \
    --source my_dag.py

# Deploy all DAGs from a local directory
gsutil -m cp -r ./dags/* gs://us-central1-my-env-XXXXX-bucket/dags/

# CI/CD pipeline step (GitHub Actions, Cloud Build, etc.)
gsutil rsync -r -d ./dags gs://us-central1-my-env-XXXXX-bucket/dags/
# -d: delete from destination if not in source (keeps bucket in sync)
```

### Strategy 2: Git Sync (Self-Hosted with git-sync Sidecar)

The `git-sync` container clones a git repository and keeps it updated at a configurable interval. Mount the synced folder as the `dags_folder`.

```yaml
# docker-compose.yaml addition for git-sync
services:
  git-sync:
    image: registry.k8s.io/git-sync/git-sync:v4.2.1
    environment:
      GITSYNC_REPO: "https://github.com/my-org/airflow-dags.git"
      GITSYNC_BRANCH: "main"
      GITSYNC_ROOT: "/git"
      GITSYNC_LINK: "dags"
      GITSYNC_PERIOD: "60s"              # Sync every 60 seconds
      GITSYNC_USERNAME: "git-user"
      GITSYNC_PASSWORD_FILE: "/secrets/git-token"
    volumes:
      - dags-volume:/git
      - ./secrets/git-token:/secrets/git-token:ro
    restart: always

  airflow-scheduler:
    volumes:
      - dags-volume:/opt/airflow/dags    # Shared volume from git-sync
```

### Strategy 3: CI/CD Pipeline Push

The most production-grade approach: DAG files are tested in CI and deployed automatically on merge to main.

```yaml
# .github/workflows/deploy-dags.yml
# GitHub Actions: test then deploy DAGs on push to main

name: Deploy DAGs

on:
  push:
    branches: [main]
    paths: ['dags/**', 'plugins/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install apache-airflow pytest

      - name: Validate DAG syntax
        run: |
          # Parse all DAG files — fails if any have syntax errors
          python -c "
          import glob, importlib.util, sys
          for f in glob.glob('dags/*.py'):
              spec = importlib.util.spec_from_file_location('dag', f)
              mod = importlib.util.module_from_spec(spec)
              try:
                  spec.loader.exec_module(mod)
                  print(f'OK: {f}')
              except Exception as e:
                  print(f'FAIL: {f}: {e}')
                  sys.exit(1)
          "

      - name: Run DAG unit tests
        run: pytest tests/ -v

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy DAGs to Cloud Composer
        run: |
          gsutil rsync -r -d ./dags \
            gs://us-central1-my-env-XXXXX-bucket/dags/
```

---

## Secrets Management

### Option 1: Environment Variables (Simplest)

```bash
# Set connections and variables via environment variables
# These override any values in the Metadata DB — preferred for secrets

# Connections
export AIRFLOW_CONN_MY_DB="postgresql://user:pass@host:5432/db"

# Variables
export AIRFLOW_VAR_API_KEY="super-secret-key"
```

### Option 2: GCP Secret Manager Backend

Configure Airflow to read secrets from GCP Secret Manager instead of the Metadata DB. Secrets never touch the Airflow DB.

```ini
# airflow.cfg — enable Secret Manager backend
[secrets]
backend = airflow.providers.google.cloud.secrets.secret_manager.CloudSecretManagerBackend
backend_kwargs = {"project_id": "my-gcp-project", "connections_prefix": "airflow-connections", "variables_prefix": "airflow-variables", "sep": "-"}
```

```bash
# Create a connection secret in Secret Manager
# The secret name must match: {connections_prefix}{sep}{conn_id}
# e.g., "airflow-connections-my-postgres"

echo -n "postgresql://user:pass@host:5432/mydb" | \
    gcloud secrets create airflow-connections-my-postgres \
        --data-file=- \
        --replication-policy=automatic

# Create a variable secret
echo -n "my-secret-api-key" | \
    gcloud secrets create airflow-variables-api-key \
        --data-file=- \
        --replication-policy=automatic

# Grant the Airflow service account access to read secrets
gcloud projects add-iam-policy-binding my-gcp-project \
    --member="serviceAccount:airflow-sa@my-gcp-project.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### Option 3: HashiCorp Vault Backend

```ini
# airflow.cfg
[secrets]
backend = airflow.providers.hashicorp.secrets.vault.VaultBackend
backend_kwargs = {"connections_path": "airflow/connections", "variables_path": "airflow/variables", "url": "http://vault:8200", "token": "vault-token"}
```

> [!warning] No secrets in DAG files
>
> Never hardcode passwords, API keys, or service account JSON in DAG code. Use environment variables, Secret Manager, or the Connections/Variables store. DAG files are typically version-controlled and visible to all developers.

---

## Monitoring

### Health Check Endpoint

Airflow exposes a health check endpoint. Use it in load balancer health checks and alerting.

```bash
# Scheduler health
curl http://airflow-scheduler:8974/health
# Returns: {"metadatabase":{"status":"healthy"},"scheduler":{"status":"healthy","latest_scheduler_heartbeat":"2024-01-15T06:00:05+00:00"}}

# Webserver health
curl http://airflow-webserver:8080/health

# Configure in Cloud Monitoring, Datadog, or Prometheus to alert on health check failures
```

### StatsD Metrics

Airflow emits metrics via StatsD. Configure Prometheus + Grafana or Datadog to scrape them.

```ini
# airflow.cfg — enable StatsD
[metrics]
statsd_on = True
statsd_host = statsd-exporter           # StatsD exporter container hostname
statsd_port = 8125
statsd_prefix = airflow
```

#### Key metrics to alert on

```
# Task metrics
airflow.task_instance.duration         # Task execution time
airflow.task_instance.failures         # Task failure count
airflow.task_instance.successes        # Task success count

# Scheduler metrics
airflow.scheduler.heartbeat            # Scheduler alive (alert if missing)
airflow.scheduler.tasks_executable     # Tasks waiting to be executed
airflow.scheduler.tasks_running        # Tasks currently running

# DAG metrics
airflow.dagrun.duration.success        # DAG Run duration on success
airflow.dagrun.duration.failed         # DAG Run duration on failure

# Pool metrics
airflow.pool.open_slots                # Available task slots
airflow.pool.used_slots                # Slots in use
```

### Datadog Integration

```python
# requirements.txt — add Datadog integration
datadog==0.47.0
apache-airflow-providers-datadog==3.3.0

# In airflow.cfg
# [metrics]
# statsd_on = True
# statsd_host = datadog-agent
# statsd_port = 8125
```

### Log Management

```ini
# airflow.cfg — remote logging to GCS (recommended for production)
[logging]
remote_logging = True
remote_log_conn_id = google_cloud_default
remote_base_log_folder = gs://my-bucket/airflow-logs
encrypt_s3_logs = False

# Retention: task logs are written locally AND uploaded to GCS
# Set a short local retention to save disk space
logging_level = INFO
log_file_max = 7          # Keep local logs for 7 days only
```

---

## Resource Sizing Guide

### Executor Choice vs Workload

| Workload Profile | Recommended Executor | Reasoning |
|---|---|---|
| < 50 concurrent tasks | LocalExecutor | Simple, no broker, single machine |
| 50-200 concurrent tasks | CeleryExecutor | Horizontal workers, predictable latency |
| Variable/bursty workloads | KubernetesExecutor | Scales to zero, full isolation per task |
| Cloud Composer | LocalKubernetesExecutor | Managed, auto-scaling |

### Memory and CPU Guidelines

```
Scheduler:
  Minimum:     2 vCPU, 4 GB RAM
  Production:  4 vCPU, 8 GB RAM
  HA (x2):     4 vCPU, 8 GB RAM each

Webserver:
  Minimum:     1 vCPU, 2 GB RAM
  Production:  2 vCPU, 4 GB RAM

Workers (LocalExecutor — same VM as scheduler):
  Budget:      4 vCPU, 16 GB RAM (total for scheduler + workers)
  Production:  8 vCPU, 32 GB RAM

Workers (CeleryExecutor — separate VMs):
  Per worker:  4 vCPU, 8 GB RAM (adjust per task memory requirements)
  Concurrency: 8-16 tasks per worker (lower for memory-heavy tasks)

Metadata DB:
  Minimum:     db-f1-micro (dev only)
  Production:  db-n1-standard-2 (2 vCPU, 7.5 GB) with HA
```

---

### Airflow Hosting Cost Comparison

Approximate monthly costs for running Airflow at small/medium scale (us-central1, March 2024 pricing):

| Option | Setup | Est. Monthly Cost | Best For |
|---|---|---|---|
| Local Docker Compose | 5 min | $0 | Development only |
| Self-hosted GCE (e2-standard-4) + Cloud SQL (db-n1-standard-2) | 2-4 hours | ~$150-250 | Cost-sensitive small teams |
| Cloud Composer 2 (SMALL, min-workers=1) | 15-30 min | ~$300-600 | GCP-native, managed |
| Cloud Composer 2 (MEDIUM, max-workers=6) | 15-30 min | ~$700-1500 | Production, auto-scaling |
| AWS MWAA (mw1.small) | 20-30 min | ~$400-600 | AWS-primary teams |
| Astronomer Astro | Variable | ~$500+ | Enterprise, dbt-heavy |

> [!tip] Self-hosted wins at small scale
>
> For teams with < 100 DAG Runs/day and strong infra skills, self-hosted on a single GCE VM with Cloud SQL is often the right choice. You get full control and pay ~$200/month instead of $600+. The operational cost is the Airflow knowledge required — not the infra.

---

## Related Notes

- [airflow-core-concepts](/12-Orchestration/Airflow/airflow-core-concepts) — Architecture, Executors, DAG structure
- [airflow-dag-patterns](/12-Orchestration/Airflow/airflow-dag-patterns) — Dynamic DAGs, idempotency, backfill patterns
- [airflow-troubleshooting](/12-Orchestration/Airflow/airflow-troubleshooting) — Debugging deployment issues, health checks, log analysis

## References

- [Airflow Docker Compose quick-start](https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html)
- [Cloud Composer documentation](https://cloud.google.com/composer/docs)
- [Airflow Helm Chart](https://airflow.apache.org/docs/helm-chart/stable/index.html)
- [Airflow Configuration Reference](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html)
- [GCP Secret Manager backend](https://airflow.apache.org/docs/apache-airflow-providers-google/stable/secrets-backends/google-cloud-secret-manager-backend.html)

## Related
- [environment-management-strategy](/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — How Airflow connections and deployment fit into the full dev/staging/prod strategy
