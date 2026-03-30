---
type: reference
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform GCE, terraform VM, google_compute_instance, Container-Optimized OS, COS, startup script terraform]
keywords: [google_compute_instance, GCE, virtual machine, startup script, machine type, e2-medium, pd-ssd, pd-balanced, Container-Optimized OS, COS, Ubuntu, OS Login, Shielded VM, boot disk, network interface, service account, ephemeral IP, no public IP]
description: "Terraform configuration for GCE virtual machine instances: the Airflow VM (Container-Optimized OS, ephemeral public IP) and the SQL Server VM (Ubuntu, SSD, no public IP), with startup scripts, shielded instance config, and OS Login."
related:
  - "[[terraform-networking]]"
  - "[[terraform-iam-and-secrets]]"
  - "[[terraform-cloud-run]]"
  - "[SSH and scheduling](/12-Orchestration/Scheduling/linux-scheduling)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Compute — Virtual Machine Instances

This note covers the GCE VM definitions from `compute.tf`: the Airflow orchestrator VM and the SQL Server database VM. These are the two compute instances in the example infrastructure.

### Architecture Context

Two GCE instances share the same subnet (`10.0.0.0/24`) but differ significantly in their OS, disk, public IP assignment, and purpose. For the full [vm-lifecycle](/06-GCP/Compute/vm-lifecycle) of these instances -- starting, stopping, resizing, and live migration -- see the GCP Compute Engine notes.

| Aspect | Airflow VM | SQL VM |
|--------|-----------|--------|
| **Name** | `data-pipeline-airflow` | `data-pipeline-sql` |
| **OS** | Container-Optimized OS (COS) | Ubuntu 22.04 LTS |
| **Machine type** | `e2-medium` (2 vCPU, 4 GB RAM) | `e2-medium` (2 vCPU, 4 GB RAM) |
| **Disk type** | `pd-balanced`, 20 GB | `pd-ssd`, 30 GB |
| **Public IP** | Yes (ephemeral) | **No** |
| **Service account** | `data-pipeline-airflow` | `data-pipeline-pipeline` |
| **Network tags** | `["airflow"]` | `["sql"]` |
| **Workload** | 4-5 Docker containers (Airflow + PostgreSQL + Datadog) | SQL Server 2022 (native install) |

---

## Resource: Airflow VM

```hcl
resource "google_compute_instance" "airflow" {
  name         = "data-pipeline-airflow"
  machine_type = "e2-medium"
  zone         = var.zone
  tags         = ["airflow"]
  ...
}
```

The Airflow orchestrator VM. Runs 4-5 Docker containers: webserver, scheduler, triggerer, PostgreSQL, and optionally the Datadog Agent.

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-airflow` | VM instance name. Used in `gcloud compute ssh data-pipeline-airflow`. |
| `machine_type` | `e2-medium` | **E2 series** — cost-optimized, shared-core. `medium` = 2 vCPUs, 4 GB RAM. ~$25/month. The E2 series uses dynamic resource scaling — your VM can burst above baseline when other VMs on the host are idle. |
| `zone` | `var.zone` | `europe-west1-b`. VMs are zonal (tied to a specific datacenter), unlike Cloud Run which is regional. |
| `tags` | `["airflow"]` | **Network tags** — firewall rules target VMs by tag, not by name. This VM matches rules with `target_tags = ["airflow"]` (ports 8080, 8126, 22). |

### Boot Disk — Container-Optimized OS

```hcl
boot_disk {
  initialize_params {
    image = "projects/cos-cloud/global/images/family/cos-stable"
    size  = 20
    type  = "pd-balanced"
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `image` | `projects/cos-cloud/global/images/family/cos-stable` | **Container-Optimized OS (COS)** — a minimal, hardened Linux distribution by Google designed to run Docker containers. No package manager, no SSH server by default — just Docker and a minimal kernel. Automatic security updates. |
| `size` | `20` | Disk size in GB. Holds the OS, Docker images, Airflow logs, and PostgreSQL metadata database. |
| `type` | `pd-balanced` | **Persistent Disk type**. `pd-balanced` offers a middle ground between `pd-standard` (HDD, cheapest) and `pd-ssd` (fastest). Airflow's workload is mostly network I/O — disk speed is not critical. |

### Network Interface — With Public IP

```hcl
network_interface {
  subnetwork = google_compute_subnetwork.main.id

  access_config {
    # Ephemeral public IP for SSH + Airflow UI
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `subnetwork` | `google_compute_subnetwork.main.id` | Places the VM in the `data-pipeline-subnet` (10.0.0.0/24). It receives a private IP like `10.0.0.2`. |
| `access_config {}` | *(empty block)* | An empty `access_config` block requests an **ephemeral public IP**. This IP changes on VM restart. Needed for direct browser access to the Airflow UI and for SSH. If this block is omitted entirely (as in the SQL VM), the VM has no public IP. |

### Service Account

```hcl
service_account {
  email  = google_service_account.airflow.email
  scopes = ["cloud-platform"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `email` | `google_service_account.airflow.email` | The GCP service account this VM runs as. All API calls from the VM (e.g., triggering Cloud Run jobs) use this identity. |
| `scopes` | `["cloud-platform"]` | **OAuth scopes** — a legacy access control layer. `cloud-platform` is the broadest scope (all GCP APIs). Actual permissions are controlled by IAM roles on the service account, not scopes. Setting `cloud-platform` here is standard practice — it means "let IAM decide." |

### Metadata — Startup Script and OS Login

```hcl
metadata = {
  startup-script = replace(file("${path.module}/scripts/airflow-startup.sh"), "\r\n", "\n")
  enable-oslogin = "TRUE"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `startup-script` | File contents | GCE runs this script as root on every boot. `file()` reads the file at plan time. `replace(..., "\r\n", "\n")` converts Windows line endings (CRLF) to Unix (LF) — critical because bash scripts fail with `\r` in them. `${path.module}` is the directory containing the `.tf` file (`infra/`). |
| `enable-oslogin` | `TRUE` | **OS Login** — uses GCP IAM to manage SSH access instead of project-wide SSH keys. Users authenticate with `gcloud compute ssh` using their GCP identity. More secure than static SSH keys. |

### Airflow Startup Script Execution Flow

The startup script (`airflow-startup.sh`) runs on every boot and is idempotent — skips containers that are already running:

1. **Kill stale containers** — removes leftover containers from previous boot (handles reboot/reset)
2. **Create directories** — `/home/airflow/dags`, `/logs`, `/pgdata` with correct ownership (UID 50000 for Airflow, UID 999 for PostgreSQL)
3. **Pull images** — `apache/airflow:2.10.5-python3.12` and `postgres:16-alpine`
4. **Create Docker network** — `airflow-net` for inter-container communication
5. **Start Datadog Agent** (conditional) — reads API key from instance metadata; skips if empty
6. **Start PostgreSQL** — metadata storage for Airflow (DAG runs, task states, connections)
7. **Wait for PostgreSQL** — polls `pg_isready` for up to 60 seconds
8. **Run DB migration** — `airflow db migrate` (idempotent schema updates) + create admin user
9. **Start webserver** — port 8080, serves the Airflow UI
10. **Start scheduler** — picks up DAGs, creates task instances, assigns them to executors
11. **Start triggerer** — handles deferred tasks (async operators like `CloudRunExecuteJobOperator`)

#### metadata_startup_script — key Airflow VM startup details

| Aspect | Value | Why |
|--------|-------|-----|
| `--restart unless-stopped` | Docker restart policy | Containers restart automatically if they crash, but not after `docker stop`. Survives OOM kills and transient failures. |
| `AIRFLOW__CORE__EXECUTOR=LocalExecutor` | Executor type | Runs tasks as subprocesses on the same machine. CeleryExecutor would require Redis/RabbitMQ — overkill for this workload. |
| `AIRFLOW__CORE__DEFAULT_TIMEZONE=Europe/Paris` | Timezone | DAG schedules are defined in UTC but the UI displays in CET/CEST. |
| Datadog labels (`com.datadoghq.ad.*`) | Autodiscovery annotations | The Datadog Agent reads these Docker labels to auto-configure log collection and integrations without a config file. |

### Shielded Instance Config

```hcl
shielded_instance_config {
  enable_secure_boot          = true
  enable_vtpm                 = true
  enable_integrity_monitoring = true
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `enable_secure_boot` | `true` | **Secure Boot** — verifies that all boot software is signed by a trusted authority. Prevents boot-level rootkits. |
| `enable_vtpm` | `true` | **Virtual Trusted Platform Module** — a virtualized hardware chip that stores encryption keys and validates the boot chain. Required for integrity monitoring. |
| `enable_integrity_monitoring` | `true` | **Integrity Monitoring** — compares the boot sequence against a known-good baseline. Alerts in Cloud Monitoring if the boot process is tampered with. |

### Allow Stopping for Update

```hcl
allow_stopping_for_update = true
```

When `true`, Terraform can stop the VM to apply changes that require a restart (e.g., changing `machine_type`). Without this, Terraform would fail on any change that requires a VM stop.

---

## Resource: SQL Server VM

```hcl
resource "google_compute_instance" "sql" {
  name         = "data-pipeline-sql"
  machine_type = "e2-medium"
  zone         = var.zone
  tags         = ["sql"]
  ...
}
```

The SQL Server database VM. Runs SQL Server 2022 Developer Edition directly on Ubuntu (not in Docker). For the post-provisioning database configuration (memory limits, TempDB, backup schedules), see [server-configuration](/04-SQL-Server/Administration/server-configuration).

| Field | Value | Meaning |
|-------|-------|---------|
| `tags` | `["sql"]` | Matches firewall rules for port 1433 (SQL) and port 22 (SSH via IAP). |

### Boot Disk — Ubuntu with SSD

```hcl
boot_disk {
  initialize_params {
    image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts"
    size  = 30
    type  = "pd-ssd"
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `image` | `ubuntu-2204-lts` | Full Ubuntu with `apt` — needed because SQL Server is installed as a system package, not a Docker container. |
| `size` | `30` | Larger disk for database files. SQL Server data, logs, and tempdb live here. |
| `type` | `pd-ssd` | **SSD persistent disk** — faster IOPS than `pd-balanced`. Database workloads benefit from low-latency random reads/writes. |

### Network Interface — No Public IP

```hcl
network_interface {
  subnetwork = google_compute_subnetwork.main.id
  # No access_config — no public IP
}
```

No `access_config` block means **no public IP at all**. The SQL VM is only reachable from within the VPC (port 1433 for queries, port 22 via IAP tunnel for SSH). Outbound internet access is provided by [[terraform-networking#Resource: Cloud NAT|Cloud NAT]] for package installation.

### Metadata — Startup Script with Credentials

```hcl
metadata = {
  startup-script = replace(file("${path.module}/scripts/sql-startup.sh"), "\r\n", "\n")
  sa-password    = var.db_password
  dd-api-key     = var.dd_api_key
  enable-oslogin = "TRUE"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `sa-password` | `var.db_password` | The SA password is passed to the VM via **instance metadata** — a GCP key-value store accessible from within the VM at `http://metadata.google.internal/computeMetadata/v1/instance/attributes/sa-password`. The startup script reads it with `curl` to configure SQL Server. Only accessible from inside the VM itself. |
| `dd-api-key` | `var.dd_api_key` | The Datadog API key, passed via instance metadata. The startup script reads it and installs the Datadog Agent if non-empty. Same opt-in pattern as the Airflow VM. |

### SQL Server Startup Script Execution Flow

The script (`sql-startup.sh`) runs once on first boot, using a marker file (`/var/lib/sql-setup-done`) to skip on subsequent boots:

1. **Check marker file** — if present, just start the SQL Server service and exit
2. **Add Microsoft GPG key** — authenticates the package repository
3. **Add apt repositories** — SQL Server 2022 + SQL command-line tools
4. **Install packages** — `mssql-server`, `mssql-tools18`, `unixodbc-dev`
5. **Read SA password** — from instance metadata via `curl` to the metadata server
6. **Configure SQL Server** — Developer edition (free, full features), accepts EULA
7. **Enable and start service** — `systemctl enable` ensures it starts on boot
8. **Install Datadog Agent** (conditional) — uses official install script for native Ubuntu install
9. **Configure agent** — writes `datadog.yaml`, enables SQL Server integration
10. **Create SQL Server monitoring login** — `dd_agent` with `VIEW SERVER STATE` (read-only metrics)
11. **Start agent** — enables and starts the `datadog-agent` systemd service
12. **Create marker file** — prevents re-running the installation

---

### gcloud Verification Commands

```bash
# List all VMs
gcloud compute instances list --filter="name~data-pipeline"

# Describe a VM (shows IPs, tags, service account, machine type)
gcloud compute instances describe data-pipeline-sql --zone=europe-west1-b
gcloud compute instances describe data-pipeline-airflow --zone=europe-west1-b

# Get SQL VM private IP
gcloud compute instances describe data-pipeline-sql --zone=europe-west1-b --format="value(networkInterfaces[0].networkIP)"

# Get Airflow VM public IP
gcloud compute instances describe data-pipeline-airflow --zone=europe-west1-b --format="value(networkInterfaces[0].accessConfigs[0].natIP)"

# SSH into a VM via IAP tunnel
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
```

## Related

- [[terraform-networking]] — the VPC and firewall rules these VMs attach to
- [[terraform-iam-and-secrets]] — the service accounts assigned to these VMs
- [SSH and scheduling](/12-Orchestration/Scheduling/linux-scheduling) — how SSH tunneling via IAP works
- [docker-compose](/09-Docker/docker-compose) — the Docker containers running on the Airflow VM
- [[terraform-cloud-run]] — the Cloud Run resources that connect to the SQL VM's private IP

## References

- [google_compute_instance](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_instance)
- [Container-Optimized OS](https://cloud.google.com/container-optimized-os/docs)
- [OS Login](https://cloud.google.com/compute/docs/oslogin)
- [Shielded VMs](https://cloud.google.com/compute/shielded-vm/docs/shielded-vm)
