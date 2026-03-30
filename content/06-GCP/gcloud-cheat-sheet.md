---
type: reference
category: reference
technology: [gcp, gcloud]
tags: [infrastructure, gcp, gcloud]
aliases: [gcloud cheat sheet, gcloud quick reference, GCP CLI cheat sheet]
keywords: [gcloud, cheat sheet, quick reference, compute, bigquery, cloud run, storage, iam, pubsub, logging, gcp commands, bq, gsutil, gcloud storage, secret manager, firestore, scheduler, cloud run jobs]
description: "Exhaustive CLI reference for gcloud, bq, and gcloud storage — the one page a senior Data Engineer bookmarks for all GCP command-line work."
related:
  - "[gcloud-authentication](/06-GCP/Core/gcloud-authentication)"
  - "[[gcloud-configurations]]"
  - "[[gcloud-output-formatting]]"
  - "[[vm-lifecycle]]"
  - "[[dataset-and-table-management]]"
  - "[[querying-and-cost-optimization]]"
  - "[[cloud-run-jobs-vs-services]]"
  - "[[gcs-object-operations]]"
  - "[[gcs-buckets-and-lifecycle]]"
  - "[[service-accounts-and-iam]]"
  - "[[pubsub-topics-and-subscriptions]]"
  - "[[cloud-logging]]"
  - "[iap-tunneling](/01-Shell/Networking/iap-tunneling)"
created: 2026-03-22
updated: 2026-03-23
status: stable
---

# gcloud CLI Cheat Sheet

> The single reference page for all `gcloud`, `bq`, and `gcloud storage` work.
> Financial domain context throughout — pipelines, datasets, service accounts, and jobs are named accordingly.

---

## Table of Contents

1. [Command Structure](#command-structure)
2. [Global Flags](#global-flags)
3. [Authentication and Configuration](#authentication-and-configuration)
4. [Projects and APIs](#projects-and-apis)
5. [Compute Engine](#compute-engine)
6. [BigQuery (bq CLI)](#bigquery-bq-cli)
7. [Cloud Run](#cloud-run)
8. [Cloud Storage (gcloud storage)](#cloud-storage-gcloud-storage)
9. [Pub/Sub](#pubsub)
10. [IAM](#iam)
11. [Logging](#logging)
12. [Cloud Scheduler](#cloud-scheduler)
13. [Secret Manager](#secret-manager)
14. [Firestore](#firestore)

---

### gcloud Command Structure and Anatomy

Every `gcloud` invocation follows this anatomy:

```
gcloud [GROUP] [SUBGROUP] [ACTION] [POSITIONAL_ARGS] [FLAGS]
```

| Segment | Description | Example |
|---|---|---|
| `GROUP` | Top-level product area | `compute`, `run`, `iam`, `pubsub` |
| `SUBGROUP` | Resource type within the group | `instances`, `jobs`, `service-accounts` |
| `ACTION` | Verb | `create`, `list`, `describe`, `delete`, `update` |
| `POSITIONAL_ARGS` | Resource name(s), varies by command | `my-instance`, `my-topic` |
| `FLAGS` | Named parameters prefixed with `--` | `--zone=us-central1-a` |

```bash
# Anatomy example: create a VM
gcloud   compute   instances   create   prices-etl-vm   \
  --zone=europe-west1-b   \
  --machine-type=e2-standard-4   \
  --image-family=debian-12   \
  --image-project=debian-cloud
#  GROUP    SUBGROUP  ACTION  POSITIONAL            FLAGS...
```

`bq` follows a slightly different convention:

```
bq [GLOBAL_FLAGS] COMMAND [FLAGS] [ARGS]
```

```bash
bq --project_id=fin-prod-project   query   --use_legacy_sql=false   'SELECT ...'
#  GLOBAL_FLAG                     COMMAND  FLAG                      ARG
```

---

### gcloud Global Flags Reference

These flags apply to nearly every `gcloud` command. Combine freely.

| Flag | Values / Description | Example |
|---|---|---|
| `--project` | Override the active project for this invocation | `--project=fin-prod-project` |
| `--account` | Override the active account | `--account=svc@fin-prod.iam.gserviceaccount.com` |
| `--configuration` | Use a named configuration | `--configuration=prod` |
| `--format` | Output format: `json`, `yaml`, `csv`, `table`, `value(FIELD)`, `text`, `flattened` | `--format=json` |
| `--filter` | Server-side or client-side filter expression | `--filter="status=RUNNING"` |
| `--limit` | Maximum number of resources to list | `--limit=20` |
| `--sort-by` | Field(s) to sort by; prefix `~` for descending | `--sort-by=~createTime` |
| `--quiet` | Disable interactive prompts; assume yes | `--quiet` |
| `--verbosity` | Log level: `debug`, `info`, `warning`, `error`, `critical`, `none` | `--verbosity=debug` |
| `--impersonate-service-account` | Impersonate a SA for the call (requires `roles/iam.serviceAccountTokenCreator`) | `--impersonate-service-account=deploy-sa@proj.iam.gserviceaccount.com` |
| `--log-http` | Log all HTTP requests and responses to stderr | `--log-http` |
| `--flatten` | Flatten a repeated field into multiple rows | `--flatten="networkInterfaces[].accessConfigs[]"` |

```bash
# List all running VMs in prod, showing only name and zone, sorted by name
gcloud compute instances list \
  --project=fin-prod-project \
  --filter="status=RUNNING" \
  --format="table(name,zone)" \
  --sort-by=name

# Get just the external IP of a single instance as a plain value
gcloud compute instances describe prices-etl-vm \
  --zone=europe-west1-b \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)"

# Pipe JSON output into jq
gcloud run jobs list --region=europe-west1 --format=json | jq '.[].metadata.name'
```

---

## Authentication and Configuration

### gcloud auth — Authentication Commands

| Command | Description |
|---|---|
| `gcloud auth login` | Interactive OAuth2 login via browser — sets user credentials |
| `gcloud auth application-default login` | Set Application Default Credentials (ADC) used by client libraries |
| `gcloud auth activate-service-account` | Activate a SA key file for CLI use |
| `gcloud auth revoke` | Revoke credentials for an account |
| `gcloud auth list` | List all credentialed accounts and show which is active |
| `gcloud auth print-access-token` | Print a short-lived OAuth2 access token (bearer token) |
| `gcloud auth print-identity-token` | Print an OIDC identity token (for Cloud Run/IAP-authenticated endpoints) |

```bash
# Standard developer login
gcloud auth login

# ADC for local development (used by Python/Go/Java client libraries)
gcloud auth application-default login

# Activate a downloaded SA key (CI/CD pipelines, local impersonation)
gcloud auth activate-service-account \
  deploy-sa@fin-prod-project.iam.gserviceaccount.com \
  --key-file=/path/to/key.json

# Activate SA and set project in one block (useful in shell scripts)
gcloud auth activate-service-account \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --key-file="${GOOGLE_APPLICATION_CREDENTIALS}"
gcloud config set project fin-prod-project

# Revoke a specific account
gcloud auth revoke user@example.com

# Revoke all credentials
gcloud auth revoke --all

# List credentialed accounts
gcloud auth list

# Get an access token for manual curl requests
TOKEN=$(gcloud auth print-access-token)
curl -H "Authorization: Bearer ${TOKEN}" https://bigquery.googleapis.com/bigquery/v2/projects/fin-prod-project/datasets

# Get an identity token for calling a Cloud Run service
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer ${TOKEN}" https://prices-api-xyz-ew.a.run.app/health
```

#### gcloud auth application-default login — ADC flags reference

| Flag | Description |
|---|---|
| `--scopes` | Comma-separated OAuth2 scopes. Default covers most GCP APIs |
| `--impersonate-service-account` | Have ADC impersonate a SA instead of using your user credentials |
| `--no-launch-browser` | Print the URL instead of opening a browser (headless environments) |
| `--project` | Set the quota project for ADC |

```bash
# ADC with SA impersonation (recommended over key files in dev)
gcloud auth application-default login \
  --impersonate-service-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com

# ADC in a headless/SSH environment
gcloud auth application-default login --no-launch-browser
```

---

### gcloud config

#### gcloud config set/unset/list — manage configuration properties

```bash
# Set properties
gcloud config set project fin-prod-project
gcloud config set compute/region europe-west1
gcloud config set compute/zone europe-west1-b
gcloud config set run/region europe-west1
gcloud config set core/account user@example.com

# Unset a property (revert to no default)
gcloud config unset compute/zone

# List all active properties
gcloud config list

# Get a single property value
gcloud config get-value project
gcloud config get-value compute/region
```

---

### gcloud config configurations

Named configurations let you switch quickly between projects/accounts (e.g. dev vs prod).

| Command | Description |
|---|---|
| `configurations create NAME` | Create a new named configuration |
| `configurations activate NAME` | Switch to a configuration |
| `configurations delete NAME` | Delete a configuration |
| `configurations list` | List all configurations |
| `configurations describe NAME` | Show properties of a configuration |

```bash
# Create and configure a prod profile
gcloud config configurations create prod
gcloud config set project fin-prod-project
gcloud config set account prod-user@example.com
gcloud config set compute/region europe-west1

# Create and configure a dev profile
gcloud config configurations create dev
gcloud config set project fin-dev-project
gcloud config set account dev-user@example.com
gcloud config set compute/region europe-west4

# Switch between profiles
gcloud config configurations activate prod
gcloud config configurations activate dev

# List all configurations (asterisk marks active)
gcloud config configurations list

# Use a specific config for one command without switching
gcloud compute instances list --configuration=prod
```

---

## Projects and APIs

### Projects

List, describe, create, and delete GCP projects.

```bash
gcloud projects list
gcloud projects list --format="table(projectId,name,projectNumber)"

# Describe a project
gcloud projects describe fin-prod-project

# Create a project
gcloud projects create fin-staging-project \
  --name="Financial Staging" \
  --labels=env=staging,team=dataeng

# Delete a project (sends to trash, recoverable for 30 days)
gcloud projects delete fin-staging-project

# Get the numeric project number
gcloud projects describe fin-prod-project --format="value(projectNumber)"
```

### Services (APIs)

Enable, disable, and list GCP service APIs for a project.

```bash
gcloud services list --enabled

# List all available APIs (very long)
gcloud services list --available --filter="name:bigquery"

# Enable APIs (can enable multiple at once)
gcloud services enable bigquery.googleapis.com
gcloud services enable \
  bigquery.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  pubsub.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  compute.googleapis.com

# Disable an API
gcloud services disable bigquery.googleapis.com --force

# Check whether a specific API is enabled
gcloud services list --enabled --filter="name:run.googleapis.com"
```

### Project-level IAM bindings

Grant and revoke IAM roles to users, groups, and service accounts at the project level.

```bash
gcloud projects add-iam-policy-binding fin-prod-project \
  --member="serviceAccount:pipeline-sa@fin-prod-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# Grant to a user
gcloud projects add-iam-policy-binding fin-prod-project \
  --member="user:analyst@example.com" \
  --role="roles/bigquery.dataViewer"

# Grant to a group
gcloud projects add-iam-policy-binding fin-prod-project \
  --member="group:data-engineers@example.com" \
  --role="roles/bigquery.jobUser"

# Remove a binding
gcloud projects remove-iam-policy-binding fin-prod-project \
  --member="serviceAccount:old-sa@fin-prod-project.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# View the full IAM policy
gcloud projects get-iam-policy fin-prod-project
gcloud projects get-iam-policy fin-prod-project --format=json | jq '.bindings[] | select(.role | contains("bigquery"))'
```

---

## Compute Engine

### Anatomy: gcloud compute instances create

```
gcloud compute instances create INSTANCE_NAME [INSTANCE_NAME ...] [FLAGS]
```

#### gcloud compute instances create — required and common flags

| Flag | Description | Default |
|---|---|---|
| `--zone` | Zone where the instance is created | From config or prompted |
| `--machine-type` | Machine type (`e2-micro`, `e2-standard-4`, `n2-standard-8`, `c2-standard-4`, `t2d-standard-1`) | `n1-standard-1` |
| `--image-family` | Image family to boot from (`debian-12`, `ubuntu-2204-lts`, `cos-stable`) | — |
| `--image-project` | Project that owns the image family (`debian-cloud`, `ubuntu-os-cloud`, `cos-cloud`) | — |
| `--image` | Specific image name (alternative to `--image-family`) | — |

#### --boot-disk-size, --boot-disk-type — VM disk flags

| Flag | Description | Default |
|---|---|---|
| `--boot-disk-size` | Boot disk size, e.g. `50GB`, `200GB` | `10GB` |
| `--boot-disk-type` | `pd-standard`, `pd-balanced`, `pd-ssd`, `pd-extreme` | `pd-balanced` |
| `--boot-disk-auto-delete` / `--no-boot-disk-auto-delete` | Delete boot disk when instance is deleted | auto-delete enabled |

#### --network, --subnet, --no-address — VM network and security flags

| Flag | Description |
|---|---|
| `--network` | VPC network name |
| `--subnet` | Subnet name |
| `--network-tier` | `PREMIUM` or `STANDARD` |
| `--no-address` | Do not assign an external IP (private-only VM) |
| `--tags` | Network tags for firewall rules, comma-separated |
| `--service-account` | SA email to attach to the instance |
| `--scopes` | OAuth2 scopes (use `cloud-platform` for full access, or list individual scopes) |
| `--shielded-secure-boot` | Enable Shielded VM secure boot |
| `--shielded-vtpm` | Enable virtual TPM |
| `--shielded-integrity-monitoring` | Enable integrity monitoring |

#### --metadata, --labels — VM metadata and labeling flags

| Flag | Description |
|---|---|
| `--metadata` | Key=value metadata pairs, comma-separated |
| `--metadata-from-file` | Key=file path, e.g. `startup-script=/path/to/script.sh` |
| `--labels` | Resource labels, comma-separated key=value pairs |

#### --preemptible, --deletion-protection, --shielded-secure-boot — other VM flags

| Flag | Description |
|---|---|
| `--preemptible` | Create a preemptible (spot) instance — cheaper, may be terminated |
| `--provisioning-model` | `SPOT` for Spot VMs (successor to preemptible) |
| `--min-cpu-platform` | Minimum CPU platform, e.g. `Intel Cascade Lake` |
| `--accelerator` | Attach GPU, e.g. `type=nvidia-tesla-t4,count=1` |
| `--reservation` | Consume from a specific reservation |
| `--deletion-protection` | Prevent accidental deletion |
| `--description` | Human-readable description |

```bash
# --- Minimal: quick dev VM ---
gcloud compute instances create prices-dev-vm \
  --zone=europe-west1-b \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud

# --- Production: private VM, custom SA, startup script, labels ---
gcloud compute instances create prices-etl-vm \
  --zone=europe-west1-b \
  --machine-type=n2-standard-8 \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --no-address \
  --network=fin-vpc \
  --subnet=fin-subnet-euw1 \
  --service-account=etl-runner-sa@fin-prod-project.iam.gserviceaccount.com \
  --scopes=cloud-platform \
  --tags=allow-iap,allow-internal \
  --metadata-from-file=startup-script=/ops/startup.sh \
  --labels=env=prod,team=dataeng,cost-center=market-data \
  --shielded-secure-boot \
  --deletion-protection

# --- Spot VM for batch workloads ---
gcloud compute instances create batch-spot-vm \
  --zone=europe-west1-b \
  --machine-type=c2-standard-16 \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=50GB \
  --provisioning-model=SPOT \
  --instance-termination-action=DELETE \
  --no-address \
  --service-account=batch-sa@fin-prod-project.iam.gserviceaccount.com \
  --scopes=cloud-platform
```

---

### Instances: lifecycle commands

List, describe, start, stop, delete, resize, and label Compute Engine instances.

```bash
gcloud compute instances list
gcloud compute instances list --filter="zone:europe-west1 AND status=RUNNING"
gcloud compute instances list --format="table(name,zone,machineType,status,networkInterfaces[0].accessConfigs[0].natIP)"

# Describe a single instance
gcloud compute instances describe prices-etl-vm --zone=europe-west1-b
gcloud compute instances describe prices-etl-vm --zone=europe-west1-b --format=json

# Start / stop / reset
gcloud compute instances start prices-etl-vm --zone=europe-west1-b
gcloud compute instances stop prices-etl-vm --zone=europe-west1-b
gcloud compute instances reset prices-etl-vm --zone=europe-west1-b  # Hard reboot

# Delete (add --keep-disks=boot to retain disk)
gcloud compute instances delete prices-etl-vm --zone=europe-west1-b --quiet

# Change machine type (instance must be stopped)
gcloud compute instances stop prices-etl-vm --zone=europe-west1-b
gcloud compute instances set-machine-type prices-etl-vm \
  --zone=europe-west1-b \
  --machine-type=n2-standard-16

# Add labels to a running instance
gcloud compute instances add-labels prices-etl-vm \
  --zone=europe-west1-b \
  --labels=version=2,updated=20260323

# Remove labels
gcloud compute instances remove-labels prices-etl-vm \
  --zone=europe-west1-b \
  --labels=version

# Tail the serial port output (boot logs, startup script output)
gcloud compute instances tail-serial-port-output prices-etl-vm \
  --zone=europe-west1-b

# Get serial port output (full dump)
gcloud compute instances get-serial-port-output prices-etl-vm \
  --zone=europe-west1-b

# Update metadata
gcloud compute instances add-metadata prices-etl-vm \
  --zone=europe-west1-b \
  --metadata=enable-oslogin=TRUE
```

---

### SSH and SCP

SSH into instances (optionally via IAP tunnel) and copy files with SCP.

```bash
gcloud compute ssh prices-etl-vm --zone=europe-west1-b

# SSH via IAP (no external IP needed — tunnels through Google's infra)
gcloud compute ssh prices-etl-vm \
  --zone=europe-west1-b \
  --tunnel-through-iap

# SSH as a different OS user
gcloud compute ssh prices-etl-vm \
  --zone=europe-west1-b \
  --tunnel-through-iap \
  --ssh-flag="-l ubuntu"

# Run a remote command without opening a shell
gcloud compute ssh prices-etl-vm \
  --zone=europe-west1-b \
  --tunnel-through-iap \
  --command="tail -100 /var/log/pipeline.log"

# SCP: copy a file to the VM
gcloud compute scp ./config.yaml prices-etl-vm:/home/user/config.yaml \
  --zone=europe-west1-b \
  --tunnel-through-iap

# SCP: copy a directory to the VM
gcloud compute scp --recurse ./scripts/ prices-etl-vm:/home/user/scripts/ \
  --zone=europe-west1-b \
  --tunnel-through-iap

# SCP: download a file from the VM
gcloud compute scp prices-etl-vm:/home/user/output.csv ./output.csv \
  --zone=europe-west1-b \
  --tunnel-through-iap
```

#### --tunnel-through-iap prerequisites — IAP API, firewall, IAM roles
1. `compute.googleapis.com` and `iap.googleapis.com` enabled.
2. Your account/SA has `roles/iap.tunnelResourceAccessor` on the instance or project.
3. Firewall rule allows ingress from `35.235.240.0/20` on port 22 (or target port).

---

### IAP Tunnels (non-SSH)

Open TCP tunnels through IAP to reach internal VM ports (databases, web UIs) without an external IP.

```bash
gcloud compute start-iap-tunnel sql-proxy-vm 5432 \
  --local-host-port=localhost:5432 \
  --zone=europe-west1-b

# Open a tunnel to an Airflow webserver on port 8080
gcloud compute start-iap-tunnel airflow-vm 8080 \
  --local-host-port=localhost:8080 \
  --zone=europe-west1-b

# Open a tunnel to SQL Server on 1433
gcloud compute start-iap-tunnel sqlserver-vm 1433 \
  --local-host-port=localhost:1433 \
  --zone=europe-west1-b

# Run tunnel in background (background process; kill with Ctrl+C or pkill)
gcloud compute start-iap-tunnel airflow-vm 8080 \
  --local-host-port=localhost:8080 \
  --zone=europe-west1-b &
```

---

### Disks

List, create, attach, detach, resize, snapshot, and delete persistent disks.

```bash
gcloud compute disks list
gcloud compute disks list --filter="zone:europe-west1-b"

# Describe a disk
gcloud compute disks describe prices-etl-vm --zone=europe-west1-b

# Create a blank data disk
gcloud compute disks create data-disk-001 \
  --zone=europe-west1-b \
  --size=500GB \
  --type=pd-ssd \
  --labels=env=prod,purpose=data

# Attach a disk to an instance
gcloud compute instances attach-disk prices-etl-vm \
  --disk=data-disk-001 \
  --zone=europe-west1-b \
  --mode=rw

# Detach a disk
gcloud compute instances detach-disk prices-etl-vm \
  --disk=data-disk-001 \
  --zone=europe-west1-b

# Resize a disk (can only grow, not shrink)
gcloud compute disks resize data-disk-001 \
  --zone=europe-west1-b \
  --size=1000GB

# Create a disk from a snapshot
gcloud compute disks create restored-disk \
  --zone=europe-west1-b \
  --source-snapshot=prices-etl-snap-20260301 \
  --type=pd-ssd

# Delete a disk
gcloud compute disks delete data-disk-001 --zone=europe-west1-b --quiet

# Create a snapshot of a disk
gcloud compute disks snapshot prices-etl-vm \
  --zone=europe-west1-b \
  --snapshot-names=prices-etl-snap-20260323 \
  --description="Pre-deploy snapshot"
```

---

### Snapshots

List, describe, and delete disk snapshots.

```bash
gcloud compute snapshots list
gcloud compute snapshots list --filter="name~prices-etl"

# Describe a snapshot
gcloud compute snapshots describe prices-etl-snap-20260323

# Delete a snapshot
gcloud compute snapshots delete prices-etl-snap-20260323 --quiet
```

---

### Firewall Rules

List, create, update, and delete VPC firewall rules.

```bash
gcloud compute firewall-rules list
gcloud compute firewall-rules list --filter="network=fin-vpc"
gcloud compute firewall-rules list --format="table(name,network,direction,priority,sourceRanges,allowed)"

# Describe a rule
gcloud compute firewall-rules describe allow-iap-ssh

# Create: allow IAP SSH (required for --tunnel-through-iap)
gcloud compute firewall-rules create allow-iap-ssh \
  --network=fin-vpc \
  --direction=INGRESS \
  --priority=1000 \
  --action=ALLOW \
  --rules=tcp:22 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=allow-iap

# Create: allow internal traffic
gcloud compute firewall-rules create allow-internal \
  --network=fin-vpc \
  --direction=INGRESS \
  --priority=1000 \
  --action=ALLOW \
  --rules=tcp,udp,icmp \
  --source-ranges=10.0.0.0/8 \
  --target-tags=allow-internal

# Create: allow HTTP/HTTPS from the internet (e.g. load balancer health checks)
gcloud compute firewall-rules create allow-http-https \
  --network=fin-vpc \
  --direction=INGRESS \
  --priority=1000 \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server

# Update: change priority
gcloud compute firewall-rules update allow-iap-ssh --priority=900

# Delete
gcloud compute firewall-rules delete allow-iap-ssh --quiet
```

---

### Static Addresses

Reserve, list, describe, and release static external IPs (regional and global).

```bash
gcloud compute addresses create prices-api-ip \
  --region=europe-west1 \
  --description="Static IP for prices API load balancer"

# Reserve a global static IP (for global load balancers)
gcloud compute addresses create prices-api-global-ip --global

# List addresses
gcloud compute addresses list
gcloud compute addresses list --filter="region:europe-west1"

# Describe
gcloud compute addresses describe prices-api-ip --region=europe-west1

# Get just the IP value
gcloud compute addresses describe prices-api-ip \
  --region=europe-west1 \
  --format="value(address)"

# Release (delete) an address
gcloud compute addresses delete prices-api-ip --region=europe-west1 --quiet
```

---

## BigQuery (bq CLI)

### BigQuery bq CLI — Anatomy

```
bq [GLOBAL_FLAGS] COMMAND [COMMAND_FLAGS] [ARGS]
```

#### bq global flags — --project_id, --format, --headless

| Flag | Description | Example |
|---|---|---|
| `--project_id` | Override active project | `--project_id=fin-prod-project` |
| `--dataset_id` | Default dataset for unqualified table references | `--dataset_id=market_data` |
| `--format` | Output: `json`, `prettyjson`, `csv`, `sparse`, `pretty` | `--format=prettyjson` |
| `--headless` | Disable interactive prompts (CI/CD use) | `--headless` |
| `--synchronous_mode` | Wait for job to complete (default true) | `--nosynchronous_mode` |
| `--location` | Multi-region or region, e.g. `EU`, `US`, `europe-west1` | `--location=EU` |

---

### bq query

#### bq query anatomy
```
bq [--project_id=PROJECT] query [FLAGS] 'SQL_STRING'
```

#### bq query flags — --use_legacy_sql, --max_rows, --destination_table

| Flag | Description | Default |
|---|---|---|
| `--use_legacy_sql` | Use legacy SQL dialect. Always set to `false` | `true` |
| `--dry_run` | Estimate bytes processed without running the query | `false` |
| `--destination_table` | Write results to `dataset.table` | — |
| `--replace` | Overwrite the destination table | `false` |
| `--append_table` | Append to the destination table | `false` |
| `--maximum_bytes_billed` | Fail the query if it would scan more than this many bytes | — |
| `--parameter` | Named parameter for parameterised queries: `name:type:value` | — |
| `--format` | Output format: `json`, `prettyjson`, `csv`, `sparse` | `sparse` |
| `--nouse_cache` | Disable query cache | — |
| `--batch` | Run as a batch job (lower priority, cheaper) | `false` |
| `--allow_large_results` | Allow arbitrarily large results (requires destination table) | `false` |
| `--flatten_results` | Flatten nested/repeated fields | `true` |
| `--time_partitioning_field` | Partition the destination table on this column | — |
| `--clustering_fields` | Cluster the destination table on these columns (comma-separated) | — |
| `--job_id` | Assign a custom job ID | — |
| `--label` | Attach a label to the job: `key:value` | — |

```bash
# --- Minimal: interactive query ---
bq query --use_legacy_sql=false '
  SELECT trade_date, SUM(notional_usd) AS total_notional
  FROM fin-prod-project.market_data.trades
  WHERE trade_date = CURRENT_DATE()
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 20
'

# --- Dry run: estimate cost before running ---
bq query --use_legacy_sql=false --dry_run '
  SELECT *
  FROM fin-prod-project.market_data.price_history
  WHERE asset_class = "equity"
'
# Output: Query successfully validated. Assuming the tables are not modified,
#         running this query will process 4.2 GB of data.

# --- Write to table, partitioned, clustered ---
bq query \
  --use_legacy_sql=false \
  --destination_table=fin-prod-project:market_data.daily_pnl \
  --replace \
  --time_partitioning_field=trade_date \
  --clustering_fields=portfolio_id,asset_class \
  --maximum_bytes_billed=10000000000 \
  --label=pipeline:daily-pnl \
  --label=env:prod \
  '
    SELECT
      trade_date,
      portfolio_id,
      asset_class,
      SUM(pnl_usd) AS total_pnl_usd
    FROM fin-prod-project.market_data.trades
    GROUP BY 1, 2, 3
  '

# --- Parameterised query ---
bq query \
  --use_legacy_sql=false \
  --parameter=start_date:DATE:2026-01-01 \
  --parameter=end_date:DATE:2026-03-23 \
  --parameter=min_notional:FLOAT64:1000000.0 \
  '
    SELECT trade_id, trade_date, notional_usd
    FROM fin-prod-project.market_data.trades
    WHERE trade_date BETWEEN @start_date AND @end_date
      AND notional_usd >= @min_notional
  '

# --- Append results to an existing table ---
bq query \
  --use_legacy_sql=false \
  --destination_table=fin-prod-project:market_data.audit_log \
  --append_table \
  'SELECT CURRENT_TIMESTAMP() AS run_ts, "daily-pnl" AS pipeline, 0 AS error_count'

# --- Disable cache (force re-execution) ---
bq query --use_legacy_sql=false --nouse_cache '
  SELECT COUNT(*) FROM fin-prod-project.market_data.trades
'

# --- Batch mode (lower priority, no SLA) ---
bq query \
  --use_legacy_sql=false \
  --batch \
  --destination_table=fin-prod-project:market_data.heavy_aggregation \
  --replace \
  'SELECT ... FROM very_large_table ...'
```

---

### bq load

#### bq load anatomy
```
bq load [FLAGS] DESTINATION_TABLE SOURCE_URI [SCHEMA]
```

#### bq load flags — --source_format, --autodetect, --write_disposition

| Flag | Description | Default |
|---|---|---|
| `--source_format` | `CSV`, `NEWLINE_DELIMITED_JSON`, `AVRO`, `PARQUET`, `ORC`, `DATASTORE_BACKUP` | `CSV` |
| `--autodetect` | Infer schema automatically | `false` |
| `--schema` | Path to JSON schema file or inline `field:type,...` | — |
| `--skip_leading_rows` | Number of header rows to skip (CSV only) | `0` |
| `--field_delimiter` | Field delimiter for CSV | `,` |
| `--null_marker` | String representing NULL in CSV | `""` |
| `--quote` | Quote character for CSV fields | `"` |
| `--encoding` | File encoding: `UTF-8`, `ISO-8859-1` | `UTF-8` |
| `--write_disposition` | `WRITE_TRUNCATE`, `WRITE_APPEND`, `WRITE_EMPTY` | `WRITE_APPEND` |
| `--replace` | Shorthand for `--write_disposition=WRITE_TRUNCATE` | — |
| `--time_partitioning_type` | `DAY`, `HOUR`, `MONTH`, `YEAR` | — |
| `--time_partitioning_field` | Column to use as partition column | — |
| `--clustering_fields` | Comma-separated clustering columns (up to 4) | — |
| `--max_bad_records` | Max number of bad records before failing | `0` |
| `--ignore_unknown_values` | Ignore extra fields in source | `false` |
| `--allow_jagged_rows` | Allow missing trailing columns in CSV | `false` |
| `--hive_partitioning_mode` | `AUTO`, `STRINGS`, `CUSTOM` for Hive-partitioned GCS data | — |
| `--hive_partitioning_source_uri_prefix` | GCS prefix for Hive partition detection | — |
| `--location` | Dataset location: `US`, `EU`, `europe-west1` | from dataset |

```bash
# --- Minimal: CSV with autodetect ---
bq load \
  --source_format=CSV \
  --autodetect \
  fin-prod-project:market_data.raw_prices \
  gs://fin-landing-bucket/prices/2026-03-23/*.csv

# --- CSV with explicit schema, skip header, truncate ---
bq load \
  --source_format=CSV \
  --schema=./schemas/prices.json \
  --skip_leading_rows=1 \
  --write_disposition=WRITE_TRUNCATE \
  --max_bad_records=10 \
  fin-prod-project:market_data.prices \
  gs://fin-landing-bucket/prices/2026-03-23/*.csv

# --- Parquet with partitioning and clustering ---
bq load \
  --source_format=PARQUET \
  --time_partitioning_type=DAY \
  --time_partitioning_field=trade_date \
  --clustering_fields=portfolio_id,asset_class \
  --write_disposition=WRITE_APPEND \
  fin-prod-project:market_data.trades \
  gs://fin-datalake-bucket/trades/date=2026-03-23/*.parquet

# --- JSON with Hive partitioning ---
bq load \
  --source_format=NEWLINE_DELIMITED_JSON \
  --hive_partitioning_mode=AUTO \
  --hive_partitioning_source_uri_prefix=gs://fin-datalake-bucket/events/ \
  --autodetect \
  fin-prod-project:events.raw_events \
  'gs://fin-datalake-bucket/events/date=2026-03-23/*.json'

# --- Avro (schema embedded in file) ---
bq load \
  --source_format=AVRO \
  --write_disposition=WRITE_APPEND \
  fin-prod-project:market_data.tick_data \
  gs://fin-datalake-bucket/ticks/2026-03-23/*.avro
```

---

### bq extract

#### bq extract anatomy
```
bq extract [FLAGS] SOURCE_TABLE DESTINATION_URI
```

| Flag | Description | Default |
|---|---|---|
| `--destination_format` | `CSV`, `NEWLINE_DELIMITED_JSON`, `AVRO`, `PARQUET` | `CSV` |
| `--compression` | `GZIP`, `DEFLATE`, `SNAPPY`, `ZSTD`, `NONE` | `NONE` |
| `--field_delimiter` | Delimiter for CSV output | `,` |
| `--print_header` | Include header row in CSV | `true` |
| `--use_avro_logical_types` | Use Avro logical types for dates/times | `false` |

```bash
# Export to CSV (sharded — BQ writes multiple files for large tables)
bq extract \
  --destination_format=CSV \
  --compression=GZIP \
  --print_header=true \
  fin-prod-project:market_data.daily_pnl \
  gs://fin-exports-bucket/daily_pnl/2026-03-23/pnl_*.csv.gz

# Export to Parquet (preferred for large analytical exports)
bq extract \
  --destination_format=PARQUET \
  --compression=SNAPPY \
  fin-prod-project:market_data.trades \
  gs://fin-exports-bucket/trades/2026-03-23/trades_*.parquet

# Export to JSON
bq extract \
  --destination_format=NEWLINE_DELIMITED_JSON \
  --compression=GZIP \
  fin-prod-project:market_data.positions \
  gs://fin-exports-bucket/positions/positions_*.json.gz
```

---

### BigQuery Datasets — bq mk, bq ls, bq show

List, create, describe, update, and delete BigQuery datasets.

```bash
bq ls
bq ls --project_id=fin-prod-project
bq ls --all  # Include hidden datasets
bq ls --format=prettyjson

# Create a dataset
bq mk \
  --dataset \
  --location=EU \
  --description="Market data — raw and processed price feeds" \
  --default_table_expiration=0 \
  fin-prod-project:market_data

# Create dataset with default table expiration (7 days, useful for staging)
bq mk \
  --dataset \
  --location=EU \
  --default_table_expiration=604800 \
  fin-staging-project:staging

# Show dataset details (location, labels, access, default expiration)
bq show --format=prettyjson fin-prod-project:market_data

# Update dataset: change description and default table expiration
bq update \
  --description="Market data — equities, FX, rates" \
  --default_table_expiration=0 \
  fin-prod-project:market_data

# Delete dataset (must be empty unless --recursive)
bq rm --dataset fin-staging-project:staging
bq rm --recursive --dataset fin-staging-project:old_staging

# Grant dataset access to a SA
bq show --format=prettyjson fin-prod-project:market_data > /tmp/dataset.json
# Edit /tmp/dataset.json to add access entry, then:
bq update --source /tmp/dataset.json fin-prod-project:market_data
```

---

### BigQuery Tables — bq mk, bq show, bq head, bq rm

List, create, preview, copy, update, and delete BigQuery tables.

```bash
bq ls fin-prod-project:market_data
bq ls --max_results=100 fin-prod-project:market_data

# Show table schema and metadata
bq show fin-prod-project:market_data.trades
bq show --schema --format=prettyjson fin-prod-project:market_data.trades
bq show --format=prettyjson fin-prod-project:market_data.trades | jq '.numBytes, .numRows'

# Create a table from a schema file
bq mk \
  --table \
  --schema=./schemas/trades.json \
  --time_partitioning_type=DAY \
  --time_partitioning_field=trade_date \
  --clustering_fields=portfolio_id,asset_class \
  --description="Daily trade records" \
  --label=env:prod \
  fin-prod-project:market_data.trades

# Create a table from a SQL query (CREATE TABLE AS SELECT)
bq mk \
  --table \
  --schema=./schemas/summary.json \
  fin-prod-project:market_data.portfolio_summary

# Preview rows
bq head --max_rows=20 fin-prod-project:market_data.trades
bq head --max_rows=10 --start_row=100 fin-prod-project:market_data.trades
bq head --selected_fields=trade_id,trade_date,notional_usd \
  --max_rows=50 fin-prod-project:market_data.trades

# Copy a table
bq cp \
  fin-prod-project:market_data.trades \
  fin-staging-project:market_data.trades_copy

# Copy with append/overwrite
bq cp --append_table \
  fin-prod-project:market_data.trades_2025 \
  fin-prod-project:market_data.trades_archive

bq cp --force \
  fin-staging-project:market_data.trades_new \
  fin-prod-project:market_data.trades

# Update table description and labels
bq update \
  --description="Partitioned daily trade records, schema v2" \
  fin-prod-project:market_data.trades

# Set table expiration (epoch seconds from now, 0 = no expiration)
bq update --expiration=0 fin-prod-project:market_data.trades

# Delete table
bq rm --table fin-staging-project:market_data.old_table
bq rm -f --table fin-staging-project:market_data.old_table  # Skip confirmation
```

---

### BigQuery Jobs — bq ls -j, bq show, bq cancel

List, inspect, and cancel BigQuery jobs.

```bash
bq ls -j
bq ls -j --max_results=20
bq ls -j --all  # Include other users' jobs (requires project-level access)
bq ls -j --filter=status:done
bq ls -j --filter=status:running

# Show job details
bq show -j bqjob_r12345abcde_00000192a1234b_1_1

# Cancel a running job
bq cancel bqjob_r12345abcde_00000192a1234b_1_1
```

---

## Cloud Run

### Anatomy: gcloud run services deploy

```
gcloud run services deploy SERVICE_NAME [FLAGS]
```

#### gcloud run deploy flags — --image, --region, --allow-unauthenticated

| Flag | Description |
|---|---|
| `--image` | Container image URI (Artifact Registry or Docker Hub) |
| `--region` | Region to deploy to |
| `--platform` | `managed` (default), `gke`, or `kubernetes` |
| `--concurrency` | Max concurrent requests per container instance |
| `--cpu` | Number of vCPUs per instance: `1`, `2`, `4`, `8` |
| `--memory` | Memory per instance: `512Mi`, `1Gi`, `2Gi`, `4Gi`, `8Gi` |
| `--min-instances` | Minimum number of running instances (0 = scale to zero) |
| `--max-instances` | Maximum number of instances |
| `--timeout` | Request timeout, e.g. `300s`, `60m` |
| `--service-account` | SA email for the service |
| `--set-env-vars` | Comma-separated `KEY=VALUE` environment variables |
| `--set-secrets` | Mount secrets: `ENV_VAR=SECRET_NAME:VERSION` |
| `--no-allow-unauthenticated` | Require authentication (default for new services) |
| `--allow-unauthenticated` | Allow public access |
| `--ingress` | `all`, `internal`, `internal-and-cloud-load-balancing` |
| `--vpc-connector` | Serverless VPC connector name |
| `--vpc-egress` | `all-traffic` or `private-ranges-only` |
| `--port` | Container port (default 8080) |
| `--tag` | Traffic tag for canary deployments |
| `--labels` | Resource labels |

```bash
# --- Minimal: deploy a public API ---
gcloud run services deploy prices-api \
  --image=europe-west1-docker.pkg.dev/fin-prod-project/apps/prices-api:latest \
  --region=europe-west1 \
  --allow-unauthenticated

# --- Production: private service, SA, secrets, VPC, scaling ---
gcloud run services deploy prices-api \
  --image=europe-west1-docker.pkg.dev/fin-prod-project/apps/prices-api:v2.3.1 \
  --region=europe-west1 \
  --no-allow-unauthenticated \
  --ingress=internal-and-cloud-load-balancing \
  --service-account=prices-api-sa@fin-prod-project.iam.gserviceaccount.com \
  --cpu=2 \
  --memory=2Gi \
  --concurrency=100 \
  --min-instances=1 \
  --max-instances=20 \
  --timeout=60s \
  --set-env-vars=PROJECT_ID=fin-prod-project,DATASET=market_data,ENV=prod \
  --set-secrets=DB_PASSWORD=db-password:latest,API_KEY=bloomberg-api-key:latest \
  --vpc-connector=fin-vpc-connector \
  --vpc-egress=private-ranges-only \
  --labels=env=prod,team=dataeng,version=v2-3-1

# --- Canary: send 10% of traffic to new revision ---
gcloud run services update-traffic prices-api \
  --region=europe-west1 \
  --to-revisions=prices-api-00050-xyz=10,LATEST=0
```

---

### Services: management commands

List, describe, update, and delete Cloud Run services and their revisions.

```bash
gcloud run services list --region=europe-west1
gcloud run services list --platform=managed

# Describe a service
gcloud run services describe prices-api --region=europe-west1
gcloud run services describe prices-api --region=europe-west1 --format=json

# Get the URL of a service
gcloud run services describe prices-api \
  --region=europe-west1 \
  --format="value(status.url)"

# Update a running service (partial update — only changed flags applied)
gcloud run services update prices-api \
  --region=europe-west1 \
  --memory=4Gi \
  --max-instances=50

# Update environment variables (replaces all env vars with --set-env-vars)
gcloud run services update prices-api \
  --region=europe-west1 \
  --update-env-vars=LOG_LEVEL=DEBUG

# Delete a service
gcloud run services delete prices-api --region=europe-west1 --quiet

# List revisions
gcloud run revisions list --service=prices-api --region=europe-west1

# Delete an old revision
gcloud run revisions delete prices-api-00040-abc --region=europe-west1 --quiet
```

---

### Jobs: create and execute

#### gcloud run jobs create/execute anatomy
```
gcloud run jobs create JOB_NAME [FLAGS]
gcloud run jobs execute JOB_NAME [FLAGS]
```

| Flag (create/update) | Description |
|---|---|
| `--image` | Container image URI |
| `--region` | Region |
| `--service-account` | SA email |
| `--cpu` | vCPUs per task |
| `--memory` | Memory per task |
| `--task-timeout` | Max wall-clock time per task, e.g. `3600s`, `24h` |
| `--tasks` | Number of parallel tasks to run |
| `--max-retries` | Max retries per failed task (0-10) |
| `--parallelism` | Max simultaneously running tasks |
| `--set-env-vars` | Environment variables |
| `--set-secrets` | Secret env vars |
| `--vpc-connector` | Serverless VPC connector |
| `--labels` | Resource labels |

| Flag (execute) | Description |
|---|---|
| `--region` | Region |
| `--wait` | Wait for execution to complete |
| `--args` | Override the container CMD args |
| `--update-env-vars` | Override env vars for this execution only |

```bash
# --- Create a job ---
gcloud run jobs create daily-pnl-job \
  --image=europe-west1-docker.pkg.dev/fin-prod-project/pipelines/pnl-runner:v1.0.0 \
  --region=europe-west1 \
  --service-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --cpu=4 \
  --memory=8Gi \
  --task-timeout=3600s \
  --tasks=1 \
  --max-retries=2 \
  --set-env-vars=PROJECT_ID=fin-prod-project,DATASET=market_data,ENV=prod \
  --set-secrets=BQ_SA_KEY=bq-pipeline-sa-key:latest \
  --vpc-connector=fin-vpc-connector \
  --labels=env=prod,team=dataeng,pipeline=daily-pnl

# --- Execute a job (fire and forget) ---
gcloud run jobs execute daily-pnl-job --region=europe-west1

# --- Execute and wait for completion ---
gcloud run jobs execute daily-pnl-job \
  --region=europe-west1 \
  --wait

# --- Execute with env var override (one-off run with different date) ---
gcloud run jobs execute daily-pnl-job \
  --region=europe-west1 \
  --update-env-vars=RUN_DATE=2026-03-01 \
  --wait

# --- List jobs ---
gcloud run jobs list --region=europe-west1

# --- Describe a job ---
gcloud run jobs describe daily-pnl-job --region=europe-west1

# --- List executions for a job ---
gcloud run jobs executions list --job=daily-pnl-job --region=europe-west1

# --- Describe a specific execution ---
gcloud run jobs executions describe daily-pnl-job-execution-abc123 --region=europe-west1

# --- Describe and stream logs from an execution ---
gcloud run jobs executions describe daily-pnl-job-execution-abc123 \
  --region=europe-west1 \
  --format=json | jq '.status'

# --- Cancel a running execution ---
gcloud run jobs executions cancel daily-pnl-job-execution-abc123 --region=europe-west1

# --- Update a job (e.g. new image) ---
gcloud run jobs update daily-pnl-job \
  --image=europe-west1-docker.pkg.dev/fin-prod-project/pipelines/pnl-runner:v1.1.0 \
  --region=europe-west1

# --- Delete a job ---
gcloud run jobs delete daily-pnl-job --region=europe-west1 --quiet
```

---

## Cloud Storage (gcloud storage)

> `gcloud storage` is the modern replacement for `gsutil`. Use it for all new scripts.
> Legacy `gsutil` still works but is deprecated for most operations.

### Anatomy: gcloud storage cp

```
gcloud storage cp [FLAGS] SOURCE [SOURCE ...] DESTINATION
```

| Flag | Description |
|---|---|
| `--recursive` / `-r` | Copy directories recursively |
| `--no-clobber` | Do not overwrite existing destination files |
| `--preserve-posix` | Preserve POSIX file attributes |
| `--storage-class` | Override storage class: `STANDARD`, `NEARLINE`, `COLDLINE`, `ARCHIVE` |
| `--content-type` | Override MIME type |
| `--cache-control` | Set Cache-Control header |
| `--metadata` | Custom metadata key-value pairs |
| `--gzip-local` | Gzip files before upload |
| `--gzip-in-flight` | Gzip data during transfer |
| `--checksums-only` | Only validate checksums, do not transfer |
| `--print-created-message` | Print URI of each created object |

### Anatomy: gcloud storage rsync

```
gcloud storage rsync [FLAGS] SOURCE DESTINATION
```

| Flag | Description |
|---|---|
| `--recursive` / `-r` | Sync subdirectories |
| `--delete-unmatched-destination-objects` | Delete destination files not in source |
| `--exclude` | Regex pattern of files to exclude |
| `--include` | Regex pattern of files to include (overrides exclude) |
| `--dry-run` | Show what would be transferred without doing it |
| `--no-clobber` | Skip files that already exist at destination |
| `--checksums-only` | Use checksums rather than size/mtime to decide what to copy |

```bash
# --- cp: upload a single file ---
gcloud storage cp ./prices_2026-03-23.csv gs://fin-landing-bucket/prices/

# --- cp: upload with explicit path ---
gcloud storage cp ./prices_2026-03-23.csv \
  gs://fin-landing-bucket/prices/2026-03-23/prices.csv

# --- cp: upload a directory recursively ---
gcloud storage cp --recursive ./data/ gs://fin-landing-bucket/data/

# --- cp: download a file ---
gcloud storage cp gs://fin-datalake-bucket/exports/pnl_2026-03-23.parquet ./

# --- cp: download all files matching a pattern ---
gcloud storage cp 'gs://fin-landing-bucket/prices/2026-03-23/*.csv' ./local-prices/

# --- cp: copy between buckets ---
gcloud storage cp \
  gs://fin-landing-bucket/prices/2026-03-23/prices.csv \
  gs://fin-archive-bucket/prices/2026/03/23/prices.csv

# --- rsync: sync local directory to GCS (one-way, non-destructive) ---
gcloud storage rsync --recursive ./reports/ gs://fin-reports-bucket/2026/03/

# --- rsync: mirror (delete files in destination not in source) ---
gcloud storage rsync \
  --recursive \
  --delete-unmatched-destination-objects \
  ./reports/ gs://fin-reports-bucket/2026/03/

# --- rsync: dry run first ---
gcloud storage rsync \
  --recursive \
  --delete-unmatched-destination-objects \
  --dry-run \
  ./reports/ gs://fin-reports-bucket/2026/03/

# --- rsync: exclude certain files ---
gcloud storage rsync \
  --recursive \
  --exclude='^.*\.tmp$|^.*\.log$' \
  ./data/ gs://fin-landing-bucket/data/
```

---

### Other object operations

List, move, delete, cat, hash, and measure disk usage of GCS objects.

```bash
gcloud storage ls gs://fin-landing-bucket/
gcloud storage ls 'gs://fin-landing-bucket/prices/**'
gcloud storage ls -l gs://fin-landing-bucket/prices/2026-03-23/  # With size/date

# Move / rename
gcloud storage mv \
  gs://fin-landing-bucket/prices/2026-03-23/raw.csv \
  gs://fin-archive-bucket/prices/2026/03/23/raw.csv

# Delete objects
gcloud storage rm gs://fin-landing-bucket/prices/2026-03-23/raw.csv
gcloud storage rm 'gs://fin-landing-bucket/prices/2026-03-22/**'  # Delete a prefix
gcloud storage rm --recursive gs://fin-old-bucket/  # Delete all objects in bucket

# Cat (print object contents to stdout)
gcloud storage cat gs://fin-landing-bucket/config/pipeline.yaml

# Cat with byte range (first 1000 bytes)
gcloud storage cat --range=0-999 gs://fin-landing-bucket/large-file.csv

# Compute checksums
gcloud storage hash gs://fin-landing-bucket/prices/2026-03-23/prices.csv

# Disk usage of a prefix
gcloud storage du gs://fin-datalake-bucket/trades/
gcloud storage du --summarize gs://fin-datalake-bucket/  # Total only
gcloud storage du --readable-sizes gs://fin-datalake-bucket/  # Human-readable
```

---

### Buckets

Create, describe, update, delete, and manage IAM on GCS buckets.

```bash
gcloud storage buckets list
gcloud storage buckets list --project=fin-prod-project
gcloud storage buckets list --format="table(name,location,storageClass)"

# Create a bucket
gcloud storage buckets create gs://fin-landing-bucket \
  --project=fin-prod-project \
  --location=EU \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access \
  --labels=env=prod,team=dataeng,purpose=landing

# Create a bucket with retention policy (30 days minimum retention)
gcloud storage buckets create gs://fin-audit-bucket \
  --project=fin-prod-project \
  --location=EU \
  --uniform-bucket-level-access \
  --retention-period=30d

# Describe a bucket
gcloud storage buckets describe gs://fin-landing-bucket

# Update: enable versioning
gcloud storage buckets update gs://fin-landing-bucket --versioning

# Update: disable versioning
gcloud storage buckets update gs://fin-landing-bucket --no-versioning

# Update: set a lifecycle configuration
gcloud storage buckets update gs://fin-landing-bucket \
  --lifecycle-file=./lifecycle.json

# Delete an empty bucket
gcloud storage buckets delete gs://fin-old-bucket

# Grant a SA access to a bucket (bucket-level IAM)
gcloud storage buckets add-iam-policy-binding gs://fin-landing-bucket \
  --member=serviceAccount:etl-runner-sa@fin-prod-project.iam.gserviceaccount.com \
  --role=roles/storage.objectCreator

# Grant objectViewer to a group
gcloud storage buckets add-iam-policy-binding gs://fin-datalake-bucket \
  --member=group:data-engineers@example.com \
  --role=roles/storage.objectViewer

# View IAM policy on a bucket
gcloud storage buckets get-iam-policy gs://fin-landing-bucket
```

#### lifecycle.json template — NEARLINE after 30d, COLDLINE after 90d, delete after 365d

```json
{
  "lifecycle": {
    "rule": [
      {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
       "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}},
      {"action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
       "condition": {"age": 90, "matchesStorageClass": ["NEARLINE"]}},
      {"action": {"type": "Delete"},
       "condition": {"age": 365}}
    ]
  }
}
```

---

## Pub/Sub

### Anatomy: gcloud pubsub subscriptions create

```
gcloud pubsub subscriptions create SUBSCRIPTION [FLAGS]
```

| Flag | Description | Default |
|---|---|---|
| `--topic` | Topic to subscribe to (required) | — |
| `--topic-project` | Project of the topic (if different) | active project |
| `--ack-deadline` | Acknowledgement deadline in seconds (10–600) | `10` |
| `--message-retention-duration` | How long unacked messages are retained: `10m`–`7d` | `7d` |
| `--retain-acked-messages` | Retain acknowledged messages (for replay) | `false` |
| `--expiration-period` | Auto-delete subscription after inactivity: `30d`, `never` | `never` |
| `--push-endpoint` | HTTPS endpoint for push subscriptions | — |
| `--push-auth-service-account` | SA for OIDC token in push auth header | — |
| `--push-auth-token-audience` | Audience for the OIDC token | — |
| `--dead-letter-topic` | Topic for undeliverable messages | — |
| `--max-delivery-attempts` | Max attempts before sending to dead-letter topic | — |
| `--min-retry-delay` | Min delay between delivery attempts | `10s` |
| `--max-retry-delay` | Max delay between delivery attempts | `600s` |
| `--filter` | Server-side message filter expression | — |
| `--labels` | Resource labels | — |

```bash
# --- Minimal: pull subscription ---
gcloud pubsub subscriptions create trades-sub \
  --topic=trades-topic

# --- Production: pull subscription with DLQ, retention, labels ---
gcloud pubsub subscriptions create trades-processor-sub \
  --topic=trades-topic \
  --topic-project=fin-prod-project \
  --ack-deadline=60 \
  --message-retention-duration=7d \
  --retain-acked-messages \
  --dead-letter-topic=trades-dlq-topic \
  --max-delivery-attempts=5 \
  --min-retry-delay=10s \
  --max-retry-delay=300s \
  --labels=env=prod,team=dataeng

# --- Push subscription to a Cloud Run service ---
gcloud pubsub subscriptions create trades-push-sub \
  --topic=trades-topic \
  --push-endpoint=https://prices-api-xyz-ew.a.run.app/pubsub/trades \
  --push-auth-service-account=pubsub-invoker-sa@fin-prod-project.iam.gserviceaccount.com \
  --ack-deadline=300

# --- Filtered subscription (only equity trades) ---
gcloud pubsub subscriptions create equity-trades-sub \
  --topic=trades-topic \
  --filter='attributes.asset_class = "equity"' \
  --ack-deadline=60
```

---

### Topics

Create, describe, publish to, and delete Pub/Sub topics.

```bash
gcloud pubsub topics list
gcloud pubsub topics list --format="table(name)"

# Create a topic
gcloud pubsub topics create trades-topic \
  --labels=env=prod,team=dataeng

# Create a topic with a message retention policy (7 days)
gcloud pubsub topics create trades-topic \
  --message-retention-duration=7d \
  --labels=env=prod

# Describe a topic
gcloud pubsub topics describe trades-topic

# List subscriptions on a topic
gcloud pubsub topics list-subscriptions trades-topic

# Publish a test message
gcloud pubsub topics publish trades-topic \
  --message='{"trade_id":"T001","notional_usd":1500000}' \
  --attribute=asset_class=equity,source=test

# Publish from a file
gcloud pubsub topics publish trades-topic \
  --message="$(cat ./test-message.json)"

# Delete a topic
gcloud pubsub topics delete trades-topic --quiet

# Grant publish access to a SA
gcloud pubsub topics add-iam-policy-binding trades-topic \
  --member=serviceAccount:producer-sa@fin-prod-project.iam.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

---

### Subscriptions: management and consumption

List, describe, pull, ack, seek (replay), update, and delete Pub/Sub subscriptions.

```bash
gcloud pubsub subscriptions list
gcloud pubsub subscriptions list --format="table(name,topic,ackDeadlineSeconds)"

# Describe a subscription
gcloud pubsub subscriptions describe trades-processor-sub

# Pull messages (synchronous, for testing/debugging)
gcloud pubsub subscriptions pull trades-processor-sub --limit=5
gcloud pubsub subscriptions pull trades-processor-sub --limit=5 --auto-ack

# Acknowledge a message by ack ID
gcloud pubsub subscriptions ack trades-processor-sub \
  --ack-ids=ACK_ID_1,ACK_ID_2

# Seek subscription to a snapshot (replay)
gcloud pubsub snapshots create trades-snap \
  --subscription=trades-processor-sub
gcloud pubsub subscriptions seek trades-processor-sub \
  --snapshot=trades-snap

# Seek to a point in time (replay last 6 hours)
gcloud pubsub subscriptions seek trades-processor-sub \
  --time=$(date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ)

# Update subscription ack deadline
gcloud pubsub subscriptions update trades-processor-sub \
  --ack-deadline=120

# Delete a subscription
gcloud pubsub subscriptions delete trades-processor-sub --quiet
```

---

## IAM

### Anatomy: gcloud iam service-accounts create

```
gcloud iam service-accounts create SA_NAME [FLAGS]
```

| Flag | Description |
|---|---|
| `--display-name` | Human-readable display name |
| `--description` | Description |
| `--project` | Project (defaults to active project) |

```bash
# --- Minimal ---
gcloud iam service-accounts create pipeline-sa \
  --project=fin-prod-project

# --- With display name and description ---
gcloud iam service-accounts create pipeline-sa \
  --display-name="Pipeline Runner SA" \
  --description="Service account for daily ETL pipelines — BigQuery + GCS" \
  --project=fin-prod-project
```

**Full SA email format:** `SA_NAME@PROJECT_ID.iam.gserviceaccount.com`

---

### Service Accounts: management

List, describe, enable/disable, delete, update, and manage impersonation for IAM service accounts.

```bash
gcloud iam service-accounts list
gcloud iam service-accounts list --project=fin-prod-project
gcloud iam service-accounts list --format="table(email,displayName,disabled)"

# Describe a SA
gcloud iam service-accounts describe \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com

# Enable / disable a SA
gcloud iam service-accounts enable \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com
gcloud iam service-accounts disable \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com

# Delete a SA
gcloud iam service-accounts delete \
  old-sa@fin-prod-project.iam.gserviceaccount.com --quiet

# Undelete a SA (within 30 days)
gcloud iam service-accounts undelete SA_UNIQUE_ID

# Update display name
gcloud iam service-accounts update \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --display-name="Pipeline Runner SA v2"

# Get the IAM policy on a SA (who can act as it)
gcloud iam service-accounts get-iam-policy \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com

# Allow another SA to impersonate this SA (Workload Identity / chained impersonation)
gcloud iam service-accounts add-iam-policy-binding \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --member=serviceAccount:run-job-sa@fin-prod-project.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator

# Allow a user to impersonate a SA
gcloud iam service-accounts add-iam-policy-binding \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --member=user:developer@example.com \
  --role=roles/iam.serviceAccountTokenCreator
```

---

### Service Account Keys

> Avoid key files where possible. Prefer Workload Identity Federation or ADC impersonation.

```bash
# Create a key (downloads to current directory)
gcloud iam service-accounts keys create ./pipeline-sa-key.json \
  --iam-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --key-file-type=json

# List keys for a SA
gcloud iam service-accounts keys list \
  --iam-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com

# Delete a key by key ID
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com --quiet
```

---

### Workload Identity Federation

Bind a Kubernetes SA (GKE / Autopilot) to a GCP SA — no key files needed.

```bash
# 1. Allow the Kubernetes SA to impersonate the GCP SA
gcloud iam service-accounts add-iam-policy-binding \
  pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:fin-prod-project.svc.id.goog[NAMESPACE/KSA_NAME]"

# 2. Annotate the Kubernetes SA (run against the cluster)
kubectl annotate serviceaccount KSA_NAME \
  --namespace=NAMESPACE \
  iam.gke.io/gcp-service-account=pipeline-sa@fin-prod-project.iam.gserviceaccount.com
```

---

### Roles

List and describe predefined roles, and create or update custom roles.

```bash
gcloud iam roles list --filter="name:roles/bigquery"
gcloud iam roles list --filter="name:roles/run"

# Describe a role (shows included permissions)
gcloud iam roles describe roles/bigquery.dataEditor

# Create a custom role from a YAML definition
gcloud iam roles create pipelineRunner \
  --project=fin-prod-project \
  --file=./custom-role.yaml

# List custom roles in a project
gcloud iam roles list --project=fin-prod-project

# Update a custom role
gcloud iam roles update pipelineRunner \
  --project=fin-prod-project \
  --file=./custom-role-v2.yaml
```

---

## Logging

### gcloud logging read

#### gcloud logging read — full anatomy and filter syntax

```
gcloud logging read FILTER [FLAGS]
```

| Flag | Description | Default |
|---|---|---|
| `--limit` | Maximum number of log entries to return | `1000` |
| `--format` | Output format: `json`, `yaml`, `text`, `table(...)` | text |
| `--order` | `desc` (newest first) or `asc` | `desc` |
| `--freshness` | Only return logs from the last N duration: `1h`, `2d` | `1d` |
| `--project` | Project to read logs from | active project |
| `--folder` | Folder to read logs from | — |
| `--organization` | Organization to read logs from | — |
| `--resource-names` | Specific log names or resource names | — |

#### Cloud Logging filter syntax — resource.type, severity, textPayload

Examples covering severity, resource type, resource labels, log names, text and JSON payload search, time ranges, and compound filters.

```bash
# --- By severity ---
gcloud logging read 'severity>=ERROR' --limit=50
gcloud logging read 'severity=CRITICAL' --limit=10 --format=json
gcloud logging read 'severity>=WARNING AND severity<=ERROR' --limit=100

# --- By resource type ---
gcloud logging read 'resource.type="cloud_run_job"' --limit=50
gcloud logging read 'resource.type="cloud_run_revision"' --limit=50
gcloud logging read 'resource.type="gce_instance"' --limit=50
gcloud logging read 'resource.type="bigquery_resource"' --limit=50
gcloud logging read 'resource.type="pubsub_subscription"' --limit=50
gcloud logging read 'resource.type="cloud_scheduler_job"' --limit=50
gcloud logging read 'resource.type="k8s_container"' --limit=50

# --- By resource labels ---
gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="daily-pnl-job"' --limit=100
gcloud logging read 'resource.type="gce_instance" AND resource.labels.instance_id="1234567890"' --limit=50

# --- By log name ---
gcloud logging read 'logName="projects/fin-prod-project/logs/cloudaudit.googleapis.com%2Factivity"' --limit=50
gcloud logging read 'logName=~"stdout"' --limit=50  # All stdout logs

# --- Text payload search ---
gcloud logging read 'textPayload:"pipeline failed"' --limit=20
gcloud logging read 'textPayload=~"ERROR|FATAL"' --limit=50
gcloud logging read 'resource.type="cloud_run_job" AND textPayload:"pipeline"' --limit=20

# --- JSON payload fields ---
gcloud logging read 'jsonPayload.level="error"' --limit=50
gcloud logging read 'jsonPayload.pipeline_name="daily-pnl"' --limit=50
gcloud logging read 'jsonPayload.trade_count>0' --limit=50

# --- By time range ---
gcloud logging read 'timestamp>="2026-03-23T00:00:00Z" AND timestamp<"2026-03-23T23:59:59Z"' \
  --limit=500 --format=json

# --- Combine resource, severity, and text ---
gcloud logging read \
  'resource.type="cloud_run_job"
   AND resource.labels.job_name="daily-pnl-job"
   AND severity>=ERROR' \
  --limit=50 --format=json

# --- Audit logs: who called BigQuery ---
gcloud logging read \
  'logName=~"cloudaudit.googleapis.com%2Factivity"
   AND protoPayload.serviceName="bigquery.googleapis.com"
   AND protoPayload.methodName="google.cloud.bigquery.v2.JobService.InsertJob"' \
  --limit=20 --format=json

# --- Audit logs: IAM policy changes ---
gcloud logging read \
  'logName=~"cloudaudit.googleapis.com%2Factivity"
   AND protoPayload.methodName:"SetIamPolicy"' \
  --limit=20

# --- Cloud Scheduler job failures ---
gcloud logging read \
  'resource.type="cloud_scheduler_job"
   AND severity>=ERROR' \
  --limit=20 --freshness=1d

# --- Recent logs with freshness ---
gcloud logging read 'resource.type="cloud_run_job"' \
  --freshness=2h \
  --limit=200 \
  --format=json

# --- Pipe JSON logs to jq for processing ---
gcloud logging read \
  'resource.type="cloud_run_job" AND severity>=ERROR' \
  --limit=50 \
  --format=json | jq '.[] | {time: .timestamp, msg: .textPayload}'
```

---

### Logging: tail, write, and sinks

Stream logs in real time with `gcloud logging tail`, write test entries, and create sinks to route logs to BigQuery, GCS, or Pub/Sub.

```bash
# Real-time log tail (streaming)
gcloud logging tail 'resource.type="cloud_run_job"'
gcloud logging tail 'resource.type="gce_instance" AND severity>=WARNING'
gcloud logging tail 'resource.type="cloud_run_job" AND resource.labels.job_name="daily-pnl-job"'

# Write a log entry (useful for testing sinks / alerting)
gcloud logging write my-test-log 'Test log entry from CLI' \
  --severity=INFO \
  --payload-type=text

gcloud logging write my-test-log '{"event":"test","pipeline":"daily-pnl","status":"ok"}' \
  --severity=INFO \
  --payload-type=json

# List log sinks
gcloud logging sinks list
gcloud logging sinks describe my-bq-sink

# Create a sink to BigQuery (audit logs)
gcloud logging sinks create audit-to-bq \
  bigquery.googleapis.com/projects/fin-prod-project/datasets/audit_logs \
  --log-filter='logName=~"cloudaudit.googleapis.com"' \
  --use-partitioned-tables \
  --description="Audit logs to BigQuery"

# Create a sink to GCS
gcloud logging sinks create all-errors-to-gcs \
  storage.googleapis.com/fin-audit-bucket \
  --log-filter='severity>=ERROR' \
  --description="All ERROR+ logs to GCS"

# Create a sink to Pub/Sub
gcloud logging sinks create run-errors-to-pubsub \
  pubsub.googleapis.com/projects/fin-prod-project/topics/pipeline-errors \
  --log-filter='resource.type="cloud_run_job" AND severity>=ERROR'

# After creating a sink, grant the sink's writer SA the correct role:
# gcloud logging sinks describe SINK_NAME --format="value(writerIdentity)"
# Then:
# gcloud projects add-iam-policy-binding fin-prod-project \
#   --member=serviceAccount:WRITER_SA \
#   --role=roles/bigquery.dataEditor  # (or storage.objectCreator, pubsub.publisher)

# Delete a sink
gcloud logging sinks delete audit-to-bq --quiet
```

---

## Cloud Scheduler

### Anatomy: gcloud scheduler jobs create http

```
gcloud scheduler jobs create http JOB_NAME [FLAGS]
```

| Flag | Description |
|---|---|
| `--schedule` | Cron expression: `"0 6 * * 1-5"` |
| `--uri` | HTTP endpoint to call |
| `--http-method` | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD` |
| `--location` | Region, e.g. `europe-west1` |
| `--message-body` | Request body (string) |
| `--message-body-from-file` | Request body from a file |
| `--headers` | HTTP headers: `KEY=VALUE,...` |
| `--oidc-service-account-email` | SA for OIDC auth (Cloud Run / IAP targets) |
| `--oidc-token-audience` | Audience for the OIDC token |
| `--oauth-service-account-email` | SA for OAuth2 token (Google APIs) |
| `--time-zone` | Timezone for the schedule: `Europe/London`, `UTC` |
| `--attempt-deadline` | Request timeout, e.g. `180s` |
| `--description` | Human-readable description |
| `--max-retry-attempts` | Number of retries on failure (0-5) |
| `--min-backoff-duration` | Min retry backoff: `5s` |
| `--max-backoff-duration` | Max retry backoff: `1h` |
| `--max-doublings` | Max doublings for exponential backoff |

```bash
# --- Trigger a Cloud Run job daily at 06:00 London time ---
gcloud scheduler jobs create http daily-pnl-trigger \
  --location=europe-west1 \
  --schedule="0 6 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://europe-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/fin-prod-project/jobs/daily-pnl-job:run" \
  --http-method=POST \
  --oidc-service-account-email=scheduler-sa@fin-prod-project.iam.gserviceaccount.com \
  --oidc-token-audience="https://europe-west1-run.googleapis.com/" \
  --attempt-deadline=180s \
  --description="Trigger daily PnL Cloud Run job on weekdays at 06:00 London" \
  --max-retry-attempts=2 \
  --min-backoff-duration=30s

# --- Trigger a Cloud Run service endpoint ---
gcloud scheduler jobs create http prices-refresh-trigger \
  --location=europe-west1 \
  --schedule="*/15 7-20 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://prices-api-xyz-ew.a.run.app/refresh" \
  --http-method=POST \
  --message-body='{"source":"eod","validate":true}' \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email=scheduler-sa@fin-prod-project.iam.gserviceaccount.com \
  --attempt-deadline=60s

# --- Manage scheduler jobs ---
gcloud scheduler jobs list --location=europe-west1
gcloud scheduler jobs describe daily-pnl-trigger --location=europe-west1
gcloud scheduler jobs run daily-pnl-trigger --location=europe-west1  # Force trigger now
gcloud scheduler jobs pause daily-pnl-trigger --location=europe-west1
gcloud scheduler jobs resume daily-pnl-trigger --location=europe-west1
gcloud scheduler jobs update http daily-pnl-trigger \
  --location=europe-west1 \
  --schedule="0 7 * * 1-5"
gcloud scheduler jobs delete daily-pnl-trigger --location=europe-west1 --quiet
```

---

## Secret Manager

### Anatomy: gcloud secrets create / versions add / versions access

Create secrets, add and access versions, manage lifecycle (disable/destroy), delete secrets, and grant IAM access.

```bash
# --- Create a new secret (empty, no version yet) ---
gcloud secrets create bloomberg-api-key \
  --project=fin-prod-project \
  --replication-policy=automatic \
  --labels=env=prod,team=dataeng

# --- Create a secret with a value immediately ---
echo -n "MY_SECRET_VALUE" | gcloud secrets create bloomberg-api-key \
  --project=fin-prod-project \
  --data-file=- \
  --replication-policy=automatic \
  --labels=env=prod

# --- Create from a file ---
gcloud secrets create db-password \
  --project=fin-prod-project \
  --data-file=./db-password.txt \
  --replication-policy=automatic

# --- Create with user-managed replication (specific regions) ---
gcloud secrets create pricing-model-key \
  --project=fin-prod-project \
  --replication-policy=user-managed \
  --locations=europe-west1,europe-west4

# --- Add a new version to an existing secret ---
echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add bloomberg-api-key \
  --project=fin-prod-project \
  --data-file=-

gcloud secrets versions add bloomberg-api-key \
  --project=fin-prod-project \
  --data-file=./new-api-key.txt

# --- Access (read) a secret version ---
gcloud secrets versions access latest \
  --secret=bloomberg-api-key \
  --project=fin-prod-project

gcloud secrets versions access 3 \
  --secret=bloomberg-api-key \
  --project=fin-prod-project

# Assign to shell variable
BLOOMBERG_KEY=$(gcloud secrets versions access latest \
  --secret=bloomberg-api-key \
  --project=fin-prod-project)

# --- List secrets ---
gcloud secrets list --project=fin-prod-project
gcloud secrets list --filter="labels.env=prod"

# --- List versions of a secret ---
gcloud secrets versions list bloomberg-api-key --project=fin-prod-project

# --- Describe a secret ---
gcloud secrets describe bloomberg-api-key --project=fin-prod-project

# --- Disable / enable a version ---
gcloud secrets versions disable 2 \
  --secret=bloomberg-api-key \
  --project=fin-prod-project

gcloud secrets versions enable 2 \
  --secret=bloomberg-api-key \
  --project=fin-prod-project

# --- Destroy a version (permanent, cannot access value afterwards) ---
gcloud secrets versions destroy 1 \
  --secret=bloomberg-api-key \
  --project=fin-prod-project --quiet

# --- Delete a secret (destroys all versions) ---
gcloud secrets delete bloomberg-api-key \
  --project=fin-prod-project --quiet

# --- Grant a SA access to a secret ---
gcloud secrets add-iam-policy-binding bloomberg-api-key \
  --project=fin-prod-project \
  --member=serviceAccount:pipeline-sa@fin-prod-project.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# --- Update secret labels ---
gcloud secrets update bloomberg-api-key \
  --project=fin-prod-project \
  --update-labels=version=v2,rotated=20260323
```

---

## Firestore

### Firestore Databases — gcloud firestore databases list, create, delete

List, describe, create (Native or Datastore mode), and delete Firestore databases.

```bash
gcloud firestore databases list --project=fin-prod-project

# Describe a database
gcloud firestore databases describe \
  --database=fin-events-db \
  --project=fin-prod-project

# Create a Firestore database (Native mode)
gcloud firestore databases create \
  --project=fin-prod-project \
  --location=europe-west1 \
  --database=fin-events-db \
  --type=firestore-native

# Create a Firestore database (Datastore mode)
gcloud firestore databases create \
  --project=fin-prod-project \
  --location=europe-west1 \
  --database=fin-legacy-db \
  --type=datastore-mode

# Delete a Firestore database
gcloud firestore databases delete \
  --database=fin-events-db \
  --project=fin-prod-project
```

---

### Firestore Indexes — gcloud firestore indexes composite list, create

List, create, describe, and delete composite indexes and field-level index exemptions.

```bash
gcloud firestore indexes composite list \
  --project=fin-prod-project \
  --database=fin-events-db

# List field-level index exemptions
gcloud firestore indexes fields list \
  --project=fin-prod-project \
  --database=fin-events-db

# Create a composite index (via YAML definition)
# Write index definition to indexes.yaml, then deploy:
gcloud firestore indexes composite create \
  --project=fin-prod-project \
  --database=fin-events-db \
  --collection-group=trades \
  --query-scope=COLLECTION \
  --field-config=order=ASCENDING,field-path=portfolio_id \
  --field-config=order=DESCENDING,field-path=trade_date

# Describe a composite index
gcloud firestore indexes composite describe INDEX_ID \
  --project=fin-prod-project \
  --database=fin-events-db

# Delete a composite index
gcloud firestore indexes composite delete INDEX_ID \
  --project=fin-prod-project \
  --database=fin-events-db --quiet
```

---

### Firestore Export and Import — gcloud firestore export, import

Firestore export/import writes to GCS and is used for backups and cross-project migrations.

```bash
# Export entire database to GCS
gcloud firestore export \
  gs://fin-backup-bucket/firestore/$(date +%Y-%m-%d) \
  --project=fin-prod-project \
  --database=fin-events-db

# Export specific collection groups only
gcloud firestore export \
  gs://fin-backup-bucket/firestore/trades-only/$(date +%Y-%m-%d) \
  --project=fin-prod-project \
  --database=fin-events-db \
  --collection-ids=trades,positions

# Import from a GCS export
gcloud firestore import \
  gs://fin-backup-bucket/firestore/2026-03-22 \
  --project=fin-prod-project \
  --database=fin-events-db

# Import only specific collection groups
gcloud firestore import \
  gs://fin-backup-bucket/firestore/2026-03-22 \
  --project=fin-prod-project \
  --database=fin-events-db \
  --collection-ids=trades

# The export/import operations are long-running. Check operation status:
gcloud firestore operations list --project=fin-prod-project
gcloud firestore operations describe OPERATION_NAME --project=fin-prod-project
```

---

### Quick Reference: Useful gcloud One-Liners

Handy compound commands for daily GCP operations -- project info, failed job lookup, IAM auditing, BigQuery slot usage, storage inspection, and more.

```bash
# Get your current project, account, and active config
gcloud config list --format="value(core.project,core.account,core.properties._section)"

# Find all Cloud Run jobs that failed in the last 24 hours
gcloud logging read \
  'resource.type="cloud_run_job" AND severity=ERROR' \
  --freshness=24h --limit=50 --format=json \
  | jq '.[] | {job: .resource.labels.job_name, time: .timestamp, msg: .textPayload}'

# List all service accounts with their creation dates
gcloud iam service-accounts list \
  --format="table(email,displayName,oauth2ClientId)" \
  --project=fin-prod-project

# Check what roles a SA has at project level
gcloud projects get-iam-policy fin-prod-project \
  --format=json | jq \
  '.bindings[] | select(.members[] | contains("pipeline-sa@fin-prod-project")) | .role'

# Get BigQuery slot utilisation for a project
bq query --use_legacy_sql=false --format=prettyjson '
  SELECT job_id, user_email, total_slot_ms, total_bytes_processed,
         creation_time, end_time
  FROM `fin-prod-project.region-EU.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
  WHERE DATE(creation_time) = CURRENT_DATE()
  ORDER BY total_slot_ms DESC LIMIT 20
'

# Estimate the size of all tables in a dataset
bq query --use_legacy_sql=false '
  SELECT table_id,
         ROUND(size_bytes / POW(1024,3), 2) AS size_gb,
         row_count
  FROM fin-prod-project.market_data.__TABLES__
  ORDER BY size_bytes DESC
'

# Find the largest objects in a GCS bucket
gcloud storage ls -l 'gs://fin-datalake-bucket/**' \
  | sort -rn -k1 | head -20

# Pull and pretty-print the latest Pub/Sub message without acking
gcloud pubsub subscriptions pull trades-processor-sub \
  --limit=1 --format=json | jq '.[0].message.data' -r | base64 -d | jq .

# List all firewall rules that allow ingress from 0.0.0.0/0
gcloud compute firewall-rules list \
  --filter="direction=INGRESS AND allowed[].ports:* AND sourceRanges:0.0.0.0/0" \
  --format="table(name,network,allowed[].ports,targetTags)"

# Get the access token and call a private Cloud Run service manually
TOKEN=$(gcloud auth print-identity-token)
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  https://prices-api-xyz-ew.a.run.app/v1/prices/AAPL

# Show top 10 most recently modified objects in a bucket
gcloud storage ls -l 'gs://fin-landing-bucket/**' \
  | sort -rk2 | head -10
```

---

## Related

- [gcloud-authentication](/06-GCP/Core/gcloud-authentication) — OAuth2, ADC, SA keys, Workload Identity
- [[gcloud-configurations]] — Named configurations and multi-project setup
- [[gcloud-output-formatting]] — `--format`, `--filter`, `--flatten`, jq patterns
- [[vm-lifecycle]] — VM create/start/stop/delete patterns and startup scripts
- [[dataset-and-table-management]] — BigQuery dataset and table DDL operations
- [[querying-and-cost-optimization]] — BQ cost control, dry runs, reservations
- [[cloud-run-jobs-vs-services]] — When to use jobs vs services
- [[gcs-object-operations]] — cp, rsync, lifecycle, retention
- [[gcs-buckets-and-lifecycle]] — Bucket creation, IAM, lifecycle policies
- [[service-accounts-and-iam]] — SA design, least-privilege, custom roles
- [[pubsub-topics-and-subscriptions]] — Topic/subscription patterns, DLQ, push vs pull
- [[cloud-logging]] — Log filter syntax, sinks, log-based metrics
- [iap-tunneling](/01-Shell/Networking/iap-tunneling) — IAP SSH and TCP tunnels for private VMs
