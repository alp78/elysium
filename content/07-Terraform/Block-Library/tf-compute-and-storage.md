---
type: reference
category: terraform
technology:
  - terraform
  - gcp
tags: [infrastructure, terraform, iac, gcp]
aliases:
  - terraform-compute-storage
  - gcp-terraform-blocks
  - tf-gcp-vm
  - tf-gcs-bucket
keywords:
  - terraform
  - gcp
  - google cloud
  - compute engine
  - google_compute_instance
  - google_compute_disk
  - google_compute_snapshot
  - google_compute_resource_policy
  - google_compute_instance_template
  - google_compute_instance_group_manager
  - google_compute_autoscaler
  - google_compute_attached_disk
  - google_storage_bucket
  - google_storage_bucket_iam_member
  - google_storage_bucket_iam_binding
  - google_storage_bucket_object
  - google_storage_notification
  - persistent disk
  - pd-ssd
  - pd-balanced
  - shielded vm
  - spot vm
  - preemptible
  - managed instance group
  - autoscaler
  - lifecycle rule
  - nearline
  - coldline
  - archive
  - data lake
  - landing zone
  - terraform state backend
  - bucket versioning
  - uniform bucket access
  - pub/sub notification
  - startup script
  - service account
  - container-optimized os
  - ubuntu
description: >
  Atomic Terraform block library for GCP Compute Engine and Cloud Storage resources.
  Self-contained, heavily commented blocks covering VM instances (database server,
  orchestration, spot/preemptible, instance groups), disk management, snapshot
  policies, VM scheduling, GCS buckets (landing zone, data lake, Terraform state),
  IAM bindings, bucket objects, and Pub/Sub notifications.
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Block Library — GCP Compute & Storage

> [!quote]
> "The best infrastructure is the infrastructure you don't have to think about."
> — **Werner Vogels**

> Self-contained, heavily commented Terraform blocks for GCP Compute Engine and Cloud Storage.
> Each section includes a **when-to-use** note followed by the full resource block.
> Copy, rename, and wire variables — every argument is explained inline.

---

## Compute Engine Blocks

---

### VM Instance — Database Server

**When to use:** A long-lived, single-node database VM that needs private-only networking,
a dedicated SSD data disk, OS-level hardening (Shielded VM), and a service account
scoped to the minimum permissions required. Typical for SQL Server on Linux, PostgreSQL,
or MySQL instances that should never have a public IP.

```hcl
# ── data disk (separate lifecycle from the VM) ──────────────────────────────
resource "google_compute_disk" "db_data" {
  name    = "db-data-disk"           # disk name visible in the GCP console
  type    = "pd-ssd"                 # SSD persistent disk; use pd-balanced for lower cost
  zone    = var.zone                 # must match the VM zone exactly
  size    = 500                      # size in GiB; resize is non-destructive (grow only)

  labels = {
    env  = var.env                   # environment label (dev / staging / prod)
    role = "database"                # workload label for cost allocation
  }
}

# ── VM instance ──────────────────────────────────────────────────────────────
resource "google_compute_instance" "db_server" {
  name         = "${var.env}-db-server"       # VM name; must be unique within the project
  machine_type = "e2-standard-4"              # 4 vCPU, 16 GB RAM; e2 is cost-effective
  zone         = var.zone                     # single zone deployment; use MIG for HA
  tags         = ["db-server", "internal"]    # network tags used by VPC firewall rules

  # ── boot disk ─────────────────────────────────────────────────────────────
  boot_disk {
    auto_delete = true                        # delete boot disk when VM is deleted
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"   # Ubuntu 22.04 LTS image family
      size  = 50                                   # boot disk size in GiB
      type  = "pd-balanced"                        # pd-balanced is fine for the OS disk
    }
  }

  # ── attached data disk ────────────────────────────────────────────────────
  attached_disk {
    source      = google_compute_disk.db_data.self_link   # reference to the disk above
    device_name = "db-data"                               # device name inside the OS
    mode        = "READ_WRITE"                            # READ_WRITE (default) or READ_ONLY
  }

  # ── network interface — private only, no public IP ────────────────────────
  network_interface {
    network    = var.vpc_network                  # VPC network self_link or name
    subnetwork = var.subnetwork                   # subnet self_link or name
    # no access_config block → no ephemeral public IP (private-only VM)
  }

  # ── startup script — runs as root on first boot ───────────────────────────
  metadata = {
    startup-script = <<-SCRIPT
      #!/bin/bash
      set -euo pipefail
      # Format and mount the data disk (only if not already formatted)
      if ! blkid /dev/disk/by-id/google-db-data; then
        mkfs.ext4 -F /dev/disk/by-id/google-db-data
      fi
      mkdir -p /mnt/data
      mount /dev/disk/by-id/google-db-data /mnt/data
      echo "/dev/disk/by-id/google-db-data /mnt/data ext4 defaults,nofail 0 2" >> /etc/fstab
    SCRIPT

    enable-oslogin = "TRUE"                       # use IAP + OS Login instead of SSH keys
  }

  # ── service account — least privilege ─────────────────────────────────────
  service_account {
    email  = var.db_service_account_email         # dedicated SA for this VM
    scopes = ["cloud-platform"]                   # use IAM roles on the SA, not OAuth scopes
  }

  # ── shielded VM — hardware-level security ─────────────────────────────────
  shielded_instance_config {
    enable_secure_boot          = true    # verifies boot firmware hasn't been tampered with
    enable_vtpm                 = true    # virtual TPM for measured boot
    enable_integrity_monitoring = true    # alerts if boot measurements change
  }

  # ── scheduling — standard persistent VM ───────────────────────────────────
  scheduling {
    on_host_maintenance = "MIGRATE"      # live-migrate during host maintenance (not TERMINATE)
    automatic_restart   = true           # restart automatically after host failure
    preemptible         = false          # not a spot VM; keep running for stateful workloads
  }

  # ── prevent accidental deletion ───────────────────────────────────────────
  deletion_protection = true             # requires tf destroy -target + manual disable first

  labels = {
    env  = var.env
    role = "database"
  }

  lifecycle {
    ignore_changes = [metadata["startup-script"]]   # avoid drift from manual debug changes
  }
}
```

---

### VM Instance — Orchestration Server (Airflow)

**When to use:** A single VM running Apache Airflow (or a similar orchestrator) via Docker
Compose. Container-Optimized OS handles Docker out of the box. A short-lived public IP
is acceptable here so the scheduler can reach external APIs; lock it down with firewall
tags. Use `pd-balanced` since the OS disk carries only container layers and logs.

```hcl
resource "google_compute_instance" "airflow" {
  name         = "${var.env}-airflow"          # orchestrator VM name
  machine_type = "e2-standard-2"               # 2 vCPU, 8 GB RAM; scale up if DAG count grows
  zone         = var.zone                      # zone for the instance
  tags         = ["airflow", "allow-iap"]      # firewall: allow IAP SSH, allow outbound HTTPS

  boot_disk {
    auto_delete = true                         # ephemeral boot disk; state lives in GCS/DB
    initialize_params {
      image = "cos-cloud/cos-stable"           # Container-Optimized OS — Docker pre-installed
      size  = 50                               # 50 GiB; adjust if pulling many large images
      type  = "pd-balanced"                    # balanced performance/cost for the OS disk
    }
  }

  network_interface {
    network    = var.vpc_network               # VPC network
    subnetwork = var.subnetwork                # subnetwork for this VM

    access_config {
      # ephemeral public IP — omit nat_ip to let GCP assign one automatically
      # remove this access_config block entirely for private-only networking
    }
  }

  metadata = {
    # cloud-init style key used by Container-Optimized OS to run Docker Compose on boot
    user-data = <<-CLOUDINIT
      #cloud-config
      runcmd:
        - docker-credential-gcr configure-docker
        - docker pull ${var.airflow_image}
        - docker run -d --name airflow --restart=unless-stopped \
            -p 8080:8080 \
            -e AIRFLOW__CORE__EXECUTOR=LocalExecutor \
            -e AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=${var.airflow_db_conn} \
            ${var.airflow_image}
    CLOUDINIT

    enable-oslogin = "TRUE"                    # IAP + OS Login; no static SSH keys needed
  }

  service_account {
    email  = var.airflow_service_account_email  # SA with GCS + BigQuery + Pub/Sub access
    scopes = ["cloud-platform"]                 # delegate permissions to IAM roles on the SA
  }

  scheduling {
    on_host_maintenance = "MIGRATE"             # keep running during GCP maintenance windows
    automatic_restart   = true                  # restart on unexpected host failure
    preemptible         = false                 # persistent; DAGs must not be interrupted
  }

  labels = {
    env  = var.env
    role = "orchestration"
  }
}
```

---

### VM Instance — Generic Spot / Preemptible Worker

**When to use:** Batch processing, CI runners, ML training jobs, or any fault-tolerant
workload where cost matters more than uptime. Spot VMs can be reclaimed by GCP at any
time with a 30-second notice. Always checkpoint work to GCS. Avoid for databases,
stateful services, or anything behind a synchronous API.

```hcl
resource "google_compute_instance" "spot_worker" {
  name         = "${var.env}-spot-worker"        # worker VM name
  machine_type = "n2-standard-8"                 # 8 vCPU, 32 GB RAM; N2 is good for compute
  zone         = var.zone                        # single zone; MIG spreads across zones
  tags         = ["spot-worker", "allow-iap"]    # firewall tags

  boot_disk {
    auto_delete = true                           # discard disk when VM is preempted/deleted
    initialize_params {
      image = "debian-cloud/debian-12"           # Debian 12; small and fast to boot
      size  = 100                                # enough for job artifacts; checkpoint to GCS
      type  = "pd-balanced"                      # balanced cost; pd-ssd if I/O bound
    }
  }

  network_interface {
    network    = var.vpc_network
    subnetwork = var.subnetwork
    # no access_config → private-only; use Cloud NAT for outbound internet
  }

  metadata = {
    startup-script = var.worker_startup_script    # inject job-specific bootstrap from variable
    enable-oslogin = "TRUE"
  }

  service_account {
    email  = var.worker_service_account_email     # SA with GCS write access for checkpoints
    scopes = ["cloud-platform"]
  }

  # ── spot / preemptible scheduling ─────────────────────────────────────────
  scheduling {
    preemptible                 = true           # enables spot pricing (~60-91% cheaper)
    on_host_maintenance         = "TERMINATE"    # spot VMs cannot live-migrate
    automatic_restart           = false          # do NOT auto-restart preemptible VMs
    provisioning_model          = "SPOT"         # SPOT = latest generation; use PREEMPTIBLE for legacy
  }

  labels = {
    env  = var.env
    role = "worker"
    type = "spot"
  }

  lifecycle {
    # Spot VMs may be recreated often; ignore GCP-managed scheduling changes
    ignore_changes = [scheduling]
  }
}
```

---

### Instance Template + Managed Instance Group + Autoscaler

**When to use:** Stateless, horizontally scalable services — web frontends, API backends,
data transformation workers. The instance template defines a reproducible VM blueprint;
the MIG creates and manages a fleet from that template; the autoscaler adjusts the fleet
size based on CPU utilization.

```hcl
# ── instance template — VM blueprint ────────────────────────────────────────
resource "google_compute_instance_template" "app" {
  name_prefix  = "${var.env}-app-template-"      # prefix; Terraform appends a hash suffix
  machine_type = "e2-standard-2"                 # VM size applied to every instance in the MIG
  region       = var.region                      # templates are regional, not zonal
  tags         = ["app-server", "allow-lb"]      # network tags; used by load balancer firewall rule

  # ── disk defined inline (templates cannot reference external disks) ────────
  disk {
    source_image = "ubuntu-os-cloud/ubuntu-2204-lts"   # base image for the boot disk
    auto_delete  = true                                 # delete disk when instance is removed
    boot         = true                                 # this is the boot disk
    disk_type    = "pd-balanced"                        # disk type for every instance's boot disk
    disk_size_gb = 30                                   # 30 GiB is usually enough for app + logs
  }

  network_interface {
    network    = var.vpc_network
    subnetwork = var.subnetwork
    # no access_config — instances behind a load balancer don't need public IPs
  }

  metadata = {
    startup-script = var.app_startup_script        # install app dependencies, pull binary, start service
    enable-oslogin = "TRUE"
  }

  service_account {
    email  = var.app_service_account_email         # SA with permissions for the app
    scopes = ["cloud-platform"]
  }

  scheduling {
    on_host_maintenance = "MIGRATE"                # allow live migration
    automatic_restart   = true
    preemptible         = false                    # set true for cost savings if workload tolerates restarts
  }

  labels = {
    env  = var.env
    role = "app"
  }

  lifecycle {
    create_before_destroy = true                   # create new template before destroying old one
                                                   # prevents downtime during template updates
  }
}

# ── managed instance group — fleet of VMs from the template ─────────────────
resource "google_compute_instance_group_manager" "app" {
  name               = "${var.env}-app-mig"        # MIG name
  base_instance_name = "${var.env}-app"             # prefix for individual VM names (app-abc123)
  zone               = var.zone                    # single-zone MIG; use regional MIG for HA
  target_size        = 2                           # initial number of instances; overridden by autoscaler

  # ── link to the instance template ─────────────────────────────────────────
  version {
    instance_template = google_compute_instance_template.app.id   # active template version
    name              = "primary"                                  # version label (for canary deployments)
  }

  # ── health check — required for auto-healing ───────────────────────────────
  auto_healing_policies {
    health_check      = google_compute_health_check.app.id   # replace unhealthy instances automatically
    initial_delay_sec = 120                                  # wait 120s before checking new instances
  }

  # ── rolling update strategy ───────────────────────────────────────────────
  update_policy {
    type                         = "PROACTIVE"        # PROACTIVE = update all; OPPORTUNISTIC = only on scale
    minimal_action               = "REPLACE"          # REPLACE recreates; RESTART just reboots
    max_surge_fixed              = 1                  # create 1 extra instance during update
    max_unavailable_fixed        = 0                  # never have 0 available (zero-downtime)
    replacement_method           = "SUBSTITUTE"       # SUBSTITUTE creates new before deleting old
  }

  named_port {
    name = "http"                                     # named port used by the load balancer backend
    port = 8080                                       # app listens on 8080
  }
}

# ── health check — used by both the MIG and the load balancer ───────────────
resource "google_compute_health_check" "app" {
  name                = "${var.env}-app-health-check"   # health check name
  check_interval_sec  = 10                              # check every 10 seconds
  timeout_sec         = 5                               # fail if no response within 5 seconds
  healthy_threshold   = 2                               # 2 successes → healthy
  unhealthy_threshold = 3                               # 3 failures → unhealthy → replace

  http_health_check {
    port         = 8080                                 # port to probe on each instance
    request_path = "/health"                            # endpoint that returns 200 when app is ready
  }
}

# ── autoscaler — adjust fleet size based on CPU utilization ─────────────────
resource "google_compute_autoscaler" "app" {
  name   = "${var.env}-app-autoscaler"                  # autoscaler name
  zone   = var.zone                                     # must match the MIG zone
  target = google_compute_instance_group_manager.app.id # MIG to scale

  autoscaling_policy {
    min_replicas    = 2                                 # never scale below 2 instances
    max_replicas    = 10                                # never scale above 10 instances
    cooldown_period = 60                                # wait 60s after scaling before next decision

    cpu_utilization {
      target = 0.7                                      # scale out when avg CPU > 70%
                                                        # scale in when avg CPU < 70%
    }
  }
}
```

---

### Disk Management

**When to use the standalone disk:** When you need a data volume that outlives its VM
(e.g., a database data directory, a shared NFS-style volume read by one VM at a time).
Always create data disks separately from the VM so they survive `terraform destroy` on
the instance.

```hcl
# ── standalone persistent disk ───────────────────────────────────────────────
resource "google_compute_disk" "data" {
  name                      = "${var.env}-data-disk"   # disk name
  type                      = "pd-ssd"                 # pd-ssd | pd-balanced | pd-standard | pd-extreme
  zone                      = var.zone                 # must match the VM it will be attached to
  size                      = 200                      # size in GiB; can increase but not decrease
  physical_block_size_bytes = 4096                     # 4096 (default) or 16384; match OS block size

  labels = {
    env  = var.env
    role = "data"
  }

  lifecycle {
    prevent_destroy = true                             # block accidental deletion of data disks
  }
}

# ── attach the disk to an existing VM ────────────────────────────────────────
resource "google_compute_attached_disk" "data_attach" {
  disk     = google_compute_disk.data.id               # disk to attach
  instance = google_compute_instance.db_server.id      # VM to attach it to
  zone     = var.zone                                  # zone (must match both disk and VM)
  mode     = "READ_WRITE"                              # READ_WRITE (default) or READ_ONLY
                                                       # READ_ONLY allows attaching to multiple VMs

  device_name = "data"                                 # device path in the OS: /dev/disk/by-id/google-data
}
```

---

### Compute Snapshot — Manual

**When to use:** Point-in-time backup before a risky operation (OS upgrade, schema migration).
Snapshots are incremental after the first. They are stored in Cloud Storage automatically
and charged at GCS rates. Automate recurring snapshots with `google_compute_resource_policy`.

```hcl
resource "google_compute_snapshot" "db_backup" {
  name        = "${var.env}-db-backup-manual"          # snapshot name
  source_disk = google_compute_disk.data.id            # disk to snapshot (boot or data disk)
  zone        = var.zone                               # zone of the source disk
  description = "Manual pre-migration snapshot"        # human-readable description

  # ── optional: encrypt with CMEK ───────────────────────────────────────────
  # snapshot_encryption_key {
  #   raw_key = var.snapshot_cmek_key                  # base64-encoded AES-256 key
  # }

  storage_locations = ["us"]                           # multi-region storage; omit for GCP default
                                                       # use ["us-central1"] for regional storage

  labels = {
    env    = var.env
    type   = "manual"
    source = "db-data-disk"
  }
}
```

---

### Compute Resource Policy — Scheduled Snapshot

**When to use:** Automated daily snapshots with retention so you don't have to create manual
snapshots. Attach the policy to any disk. GCP handles the schedule, incrementals, and
deletion of old snapshots.

```hcl
resource "google_compute_resource_policy" "daily_snapshot" {
  name   = "${var.env}-daily-snapshot-policy"    # policy name
  region = var.region                            # resource policies are regional

  snapshot_schedule_policy {
    # ── schedule: run once per day ──────────────────────────────────────────
    schedule {
      daily_schedule {
        days_in_cycle = 1                        # every 1 day (minimum value)
        start_time    = "04:00"                  # UTC time; pick off-peak for your region
      }
    }

    # ── retention: keep last 7 snapshots ────────────────────────────────────
    retention_policy {
      max_retention_days    = 7                  # delete snapshots older than 7 days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"   # keep snapshots even if the disk is deleted
                                                       # use APPLY_RETENTION_POLICY to delete them too
    }

    # ── snapshot properties ──────────────────────────────────────────────────
    snapshot_properties {
      labels = {
        policy     = "daily-snapshot"            # label on each auto-generated snapshot
        managed_by = "terraform"
      }
      storage_locations = ["us"]                 # where to store snapshots
      guest_flush       = false                  # true = flush OS buffers before snapshot
                                                 # requires QEMU guest agent on the VM
    }
  }
}

# Attach the policy to a disk
resource "google_compute_disk_resource_policy_attachment" "data_snapshot" {
  name = google_compute_resource_policy.daily_snapshot.name   # policy to attach
  disk = google_compute_disk.data.name                        # target disk
  zone = var.zone                                             # disk zone
}
```

---

### Instance Scheduling — VM Start/Stop Policy (Business Hours)

**When to use:** Dev/test VMs and non-critical batch VMs that only need to run during
business hours. Start/stop scheduling can cut compute costs by ~65% for a VM that runs
9 hours/day on weekdays instead of 24/7.

```hcl
resource "google_compute_resource_policy" "business_hours" {
  name   = "${var.env}-business-hours-schedule"    # policy name
  region = var.region                              # must match the VM's region

  instance_schedule_policy {
    time_zone = "America/New_York"                 # IANA timezone for start/stop times
                                                   # use "UTC" to avoid DST surprises

    vm_start_schedule {
      schedule = "0 8 * * MON-FRI"                # cron: start at 08:00 Mon–Fri (local time)
    }

    vm_stop_schedule {
      schedule = "0 19 * * MON-FRI"               # cron: stop at 19:00 Mon–Fri (local time)
    }
  }
}

# ── attach the schedule to a VM ──────────────────────────────────────────────
resource "google_compute_instance_iam_member" "schedule_actor" {
  # The resource policy needs permission to start/stop the VM
  # Grant the Compute Engine service account the compute.instances.start/stop roles
  instance_name = google_compute_instance.db_server.name
  zone          = var.zone
  role          = "roles/compute.instanceAdmin.v1"
  member        = "serviceAccount:${var.project_number}@cloudservices.gserviceaccount.com"
}

resource "google_compute_resource_policy_attachment" "biz_hours_attach" {
  name     = google_compute_resource_policy.business_hours.name   # policy to attach
  instance = google_compute_instance.db_server.name               # VM to schedule
  zone     = var.zone                                             # VM zone
}
```

---

## Cloud Storage Blocks

---

### GCS Bucket — General Purpose (Versioning + Lifecycle)

**When to use:** A versatile bucket for application artifacts, exports, or backups where
you want versioning (recover accidentally overwritten objects) and automatic lifecycle
tiering to control storage costs over time.

```hcl
resource "google_storage_bucket" "general" {
  name                        = "${var.project_id}-${var.env}-general"   # globally unique bucket name
  location                    = var.region                               # us-central1, EU, US, ASIA, etc.
  storage_class               = "STANDARD"                               # STANDARD | NEARLINE | COLDLINE | ARCHIVE
  uniform_bucket_level_access = true                                     # disable ACLs; use IAM only (recommended)
  force_destroy               = false                                    # true = terraform destroy deletes objects too
                                                                         # DANGEROUS; only set true for ephemeral buckets

  # ── versioning — keep history of every object ────────────────────────────
  versioning {
    enabled = true                                                        # enables object versioning
  }

  # ── lifecycle rules — auto-transition and delete old data ─────────────────
  lifecycle_rule {
    action {
      type          = "SetStorageClass"                                   # change storage class (tiering)
      storage_class = "NEARLINE"                                          # NEARLINE: good for data accessed <1/month
    }
    condition {
      age = 30                                                            # transition after 30 days
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"                                          # COLDLINE: good for data accessed <1/quarter
    }
    condition {
      age = 90                                                            # transition after 90 days
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"                                           # ARCHIVE: good for data accessed <1/year
    }
    condition {
      age = 365                                                           # transition after 1 year
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"                                                     # delete old non-current versions
    }
    condition {
      num_newer_versions = 3                                              # keep only the 3 newest versions
      with_state         = "ARCHIVED"                                     # only applies to non-current (archived) versions
    }
  }

  # ── CORS — allow browser uploads if needed ───────────────────────────────
  # cors {
  #   origin          = ["https://app.example.com"]
  #   method          = ["GET", "PUT", "POST"]
  #   response_header = ["Content-Type"]
  #   max_age_seconds = 3600
  # }

  labels = {
    env         = var.env
    managed_by  = "terraform"
  }
}
```

---

### GCS Bucket — Landing Zone (Data Ingestion)

**When to use:** Entry point for raw, untransformed data coming from external producers
(APIs, SFTP uploads, IoT devices, event streams). Keep objects as STANDARD for the first
30 days (frequent access during initial processing), then move to NEARLINE for cheaper
retention. Abort incomplete multipart uploads to avoid paying for partial data.

```hcl
resource "google_storage_bucket" "landing_zone" {
  name                        = "${var.project_id}-${var.env}-landing"   # bucket name; globally unique
  location                    = var.region                               # same region as your Dataflow/Dataproc
  storage_class               = "STANDARD"                               # raw ingest: access is frequent
  uniform_bucket_level_access = true                                     # IAM-only access control
  force_destroy               = false                                    # protect raw data from accidental wipe

  versioning {
    enabled = false                                                       # no versioning for landing; raw files are append-only
  }

  # ── transition to nearline after initial processing window ────────────────
  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"                                          # cheaper after processing is done
    }
    condition {
      age = 30                                                            # 30 days: enough time to reprocess if pipeline fails
    }
  }

  # ── abort stale incomplete uploads ────────────────────────────────────────
  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"                             # clean up failed uploads automatically
    }
    condition {
      age = 1                                                             # abort uploads that have been in progress > 1 day
    }
  }

  # ── delete old raw files after retention window ───────────────────────────
  lifecycle_rule {
    action {
      type = "Delete"                                                     # remove raw files after they've been processed
    }
    condition {
      age = 180                                                           # 6 months; adjust to your compliance requirement
    }
  }

  labels = {
    env         = var.env
    role        = "landing-zone"
    managed_by  = "terraform"
  }
}
```

---

### GCS Bucket — Terraform State Backend

**When to use:** Store Terraform remote state. This bucket must exist *before* your
Terraform backend configuration references it (bootstrap it with a separate root module
or create it manually once). Key requirements: versioning on (recover corrupted state),
no public access, uniform IAM, lifecycle to prune old state versions.

```hcl
resource "google_storage_bucket" "tf_state" {
  name                        = "${var.project_id}-terraform-state"      # keep the name predictable and stable
  location                    = "US"                                     # multi-region for resilience; or use a single region
  storage_class               = "STANDARD"                               # state files are accessed frequently during applies
  uniform_bucket_level_access = true                                     # no ACLs; IAM only
  force_destroy               = false                                    # NEVER set true for state buckets

  # ── versioning — critical for state recovery ──────────────────────────────
  versioning {
    enabled = true                                                        # must be on; allows rollback to previous state
  }

  # ── public access prevention ──────────────────────────────────────────────
  public_access_prevention = "enforced"                                  # block all public access at the bucket level

  # ── retain only recent state versions ────────────────────────────────────
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 10                                             # keep last 10 versions of each state file
      with_state         = "ARCHIVED"                                     # only non-current versions
    }
  }

  # ── abort incomplete uploads ──────────────────────────────────────────────
  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 1
    }
  }

  labels = {
    purpose    = "terraform-state"
    managed_by = "terraform"
  }
}

# Reference in backend.tf (after the bucket is created):
# terraform {
#   backend "gcs" {
#     bucket = "<project-id>-terraform-state"
#     prefix = "terraform/state"
#   }
# }
```

---

### GCS Bucket — Data Lake

**When to use:** Central repository for all analytical data — raw, curated, and
aggregated layers. Auto-tiering lifecycle moves objects through storage classes
automatically based on access patterns, eliminating the need to predict access frequency.
Folder structure convention is baked in via example objects (see Bucket Object section).

```hcl
resource "google_storage_bucket" "data_lake" {
  name                        = "${var.project_id}-${var.env}-data-lake"  # globally unique bucket name
  location                    = var.region                                # co-locate with BigQuery dataset
  storage_class               = "STANDARD"                                # default class for new objects
  uniform_bucket_level_access = true                                      # enforce IAM, no ACLs
  force_destroy               = false                                     # protect production data

  versioning {
    enabled = true                                                         # version curated objects; protect against overwrites
  }

  # ── auto-tiering: GCP moves objects to cheaper classes automatically ──────
  # Using explicit age rules here for predictability:

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age                        = 30                                      # 30 days since last modification
      matches_storage_class      = ["STANDARD"]                            # only objects currently in STANDARD
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
    condition {
      age                   = 90
      matches_storage_class = ["NEARLINE"]                                 # objects that were already tiered to NEARLINE
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
    condition {
      age                   = 365
      matches_storage_class = ["COLDLINE"]
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 5                                               # keep only 5 non-current versions
      with_state         = "ARCHIVED"
    }
  }

  lifecycle_rule {
    action {
      type = "AbortIncompleteMultipartUpload"
    }
    condition {
      age = 2                                                              # clean up stalled large-file uploads
    }
  }

  labels = {
    env        = var.env
    role       = "data-lake"
    managed_by = "terraform"
  }
}

# ── folder structure placeholders ────────────────────────────────────────────
# GCS is flat but tools treat "/" as a folder separator.
# Create placeholder objects to materialise the expected folder hierarchy.

resource "google_storage_bucket_object" "raw_placeholder" {
  name    = "raw/.keep"                                                    # raw/ layer: data as received from source
  bucket  = google_storage_bucket.data_lake.name
  content = "placeholder"                                                  # tiny content; just to create the "folder"
}

resource "google_storage_bucket_object" "curated_placeholder" {
  name    = "curated/.keep"                                                # curated/ layer: cleaned, validated data
  bucket  = google_storage_bucket.data_lake.name
  content = "placeholder"
}

resource "google_storage_bucket_object" "aggregated_placeholder" {
  name    = "aggregated/.keep"                                             # aggregated/ layer: ready for dashboards/BI
  bucket  = google_storage_bucket.data_lake.name
  content = "placeholder"
}
```

---

### Bucket IAM — Grant Access to Members

**When to use `iam_member`:** Grant a single role to a single member without affecting
other bindings. This is additive and is the preferred pattern in Terraform (avoids
unintentional permission revocation). Use when different teams/modules manage different
roles.

**When to use `iam_binding`:** You need to manage the *entire* list of members for a
given role in one place. This is authoritative for that role — it will remove any
members not listed in Terraform. Use when the team that owns the bucket also owns all
access grants for a given role.

```hcl
# ── iam_member — additive, one member at a time ───────────────────────────────

# Grant objectViewer to a service account (read-only access to objects)
resource "google_storage_bucket_iam_member" "reader" {
  bucket = google_storage_bucket.data_lake.name                # target bucket
  role   = "roles/storage.objectViewer"                        # can list and get objects; cannot write or delete
  member = "serviceAccount:${var.reader_service_account}"      # format: serviceAccount:, user:, group:, domain:
}

# Grant objectAdmin to a service account (full object CRUD, no bucket-level admin)
resource "google_storage_bucket_iam_member" "writer" {
  bucket = google_storage_bucket.data_lake.name
  role   = "roles/storage.objectAdmin"                         # create, read, update, delete objects
  member = "serviceAccount:${var.writer_service_account}"      # pipeline SA that writes to the bucket
}

# Grant legacyBucketReader to a group (list bucket contents)
resource "google_storage_bucket_iam_member" "group_list" {
  bucket = google_storage_bucket.data_lake.name
  role   = "roles/storage.legacyBucketReader"                  # allows gsutil ls; does NOT allow object reads
  member = "group:${var.data_team_group}"                      # format: group:team@example.com
}

# ── iam_binding — authoritative for a single role ────────────────────────────

# Authoritative binding for objectViewer: exactly these members get this role.
# Any member with objectViewer not in this list will be REMOVED.
resource "google_storage_bucket_iam_binding" "landing_readers" {
  bucket = google_storage_bucket.landing_zone.name
  role   = "roles/storage.objectViewer"                        # authoritative for this role on this bucket

  members = [
    "serviceAccount:${var.etl_service_account}",               # ETL pipeline that reads raw files
    "serviceAccount:${var.dataflow_service_account}",          # Dataflow worker SA
    "group:${var.analytics_group}",                            # analytics team group
  ]
}
```

---

### Bucket Object — Upload a File

**When to use:** Seed a bucket with a configuration file, a SQL script, a requirements
file, or any small artifact that Terraform should manage alongside the infrastructure.
Avoid for large binary files — use `null_resource` + `gsutil` for those.

```hcl
# ── upload a local file to GCS ───────────────────────────────────────────────
resource "google_storage_bucket_object" "config" {
  name   = "config/app-config.json"                             # object name (path within the bucket)
  bucket = google_storage_bucket.general.name                   # target bucket

  source       = "${path.module}/files/app-config.json"         # local file path relative to the module root
  content_type = "application/json"                             # MIME type; set correctly for browser downloads

  # metadata = {                                                # optional: custom HTTP headers
  #   "Cache-Control" = "no-cache"
  # }
}

# ── upload inline content (no local file needed) ─────────────────────────────
resource "google_storage_bucket_object" "seed_sql" {
  name    = "seeds/initial-schema.sql"                          # path within the bucket
  bucket  = google_storage_bucket.general.name
  content = <<-SQL
    CREATE TABLE IF NOT EXISTS events (
      id         SERIAL PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      created_at TIMESTAMP  NOT NULL DEFAULT NOW()
    );
  SQL
  content_type = "text/plain"                                   # plain text for SQL files
}
```

---

### Bucket Notification — Trigger Pub/Sub on Object Finalize

**When to use:** Event-driven data ingestion pipelines. When a file lands in the landing
zone bucket, publish a message to Pub/Sub so a Cloud Function or Dataflow job can process
it immediately — no polling required. This is the preferred pattern for near-real-time
file processing.

```hcl
# ── pub/sub topic — receives bucket events ───────────────────────────────────
resource "google_pubsub_topic" "bucket_events" {
  name    = "${var.env}-bucket-events"                          # topic name; subscribers read from this
  project = var.project_id

  message_retention_duration = "86600s"                         # retain messages for ~24h if no subscriber ACKs
}

# ── grant GCS permission to publish to the topic ─────────────────────────────
# GCS uses a project-level service account to publish notifications.
# This account must have publisher access on the topic.
data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id                                      # fetch the GCS service account email for this project
}

resource "google_pubsub_topic_iam_member" "gcs_publisher" {
  topic  = google_pubsub_topic.bucket_events.id
  role   = "roles/pubsub.publisher"                             # allow GCS to publish messages
  member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}

# ── bucket notification ───────────────────────────────────────────────────────
resource "google_storage_notification" "landing_notify" {
  bucket         = google_storage_bucket.landing_zone.name      # bucket to watch
  payload_format = "JSON_API_V1"                                # JSON_API_V1 (full metadata) or NONE (no payload)
  topic          = google_pubsub_topic.bucket_events.id         # destination Pub/Sub topic

  event_types = [
    "OBJECT_FINALIZE",      # triggered when an upload completes (most common for ingestion)
    # "OBJECT_DELETE",      # triggered on deletion (uncomment if you need delete events)
    # "OBJECT_ARCHIVE",     # triggered when a live version is replaced (versioned buckets)
    # "OBJECT_METADATA_UPDATE", # triggered when object metadata changes
  ]

  # ── filter by object name prefix ──────────────────────────────────────────
  object_name_prefix = "raw/"                                   # only notify for objects under raw/
                                                                # omit to notify for ALL objects in the bucket

  # ── custom attributes added to every Pub/Sub message ─────────────────────
  custom_attributes = {
    source      = "landing-zone"                                # helps consumers identify the event source
    environment = var.env                                       # useful when multiple envs share a topic
  }

  depends_on = [google_pubsub_topic_iam_member.gcs_publisher]   # ensure IAM is set before creating notification
}

# ── subscription — pull-based consumer of bucket events ─────────────────────
resource "google_pubsub_subscription" "landing_events_sub" {
  name    = "${var.env}-landing-events-sub"                     # subscription name
  topic   = google_pubsub_topic.bucket_events.id                # subscribe to the bucket events topic
  project = var.project_id

  ack_deadline_seconds       = 60                               # consumer must ACK within 60s or message is redelivered
  message_retention_duration = "3600s"                          # retain unACKed messages for 1 hour
  retain_acked_messages      = false                            # discard ACKed messages immediately

  expiration_policy {
    ttl = "86400s"                                              # subscription expires after 24h of inactivity
                                                                # set to "" (empty string) for no expiration
  }

  retry_policy {
    minimum_backoff = "10s"                                     # wait at least 10s before redelivering
    maximum_backoff = "300s"                                    # wait at most 5min before redelivering
  }
}
```

---

### Variables Reference

The blocks above assume the following input variables. Define them in your `variables.tf`:

```hcl
variable "project_id" {
  description = "GCP project ID"                               # used in resource names and references
  type        = string
}

variable "project_number" {
  description = "GCP project number (numeric)"                  # used for service account emails
  type        = string
}

variable "env" {
  description = "Environment name: dev, staging, or prod"       # used as a prefix/label throughout
  type        = string
}

variable "region" {
  description = "GCP region (e.g. us-central1)"                 # for regional resources
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone (e.g. us-central1-a)"                 # for zonal resources
  type        = string
  default     = "us-central1-a"
}

variable "vpc_network" {
  description = "VPC network self_link or name"                  # used in network_interface blocks
  type        = string
}

variable "subnetwork" {
  description = "Subnetwork self_link or name"                   # used in network_interface blocks
  type        = string
}

variable "db_service_account_email" {
  description = "Service account email for the database VM"      # e.g. db-sa@project.iam.gserviceaccount.com
  type        = string
}

variable "airflow_service_account_email" {
  description = "Service account email for the Airflow VM"
  type        = string
}

variable "airflow_image" {
  description = "Docker image for Airflow (full registry path)"  # e.g. apache/airflow:2.9.0
  type        = string
  default     = "apache/airflow:2.9.0"
}

variable "airflow_db_conn" {
  description = "SQLAlchemy connection string for Airflow metadata DB"
  type        = string
  sensitive   = true                                             # marks output as sensitive; won't appear in plan
}

variable "worker_service_account_email" {
  description = "Service account email for spot worker VMs"
  type        = string
}

variable "worker_startup_script" {
  description = "Startup script for the generic worker VM"
  type        = string
  default     = "#!/bin/bash\necho 'worker ready'"
}

variable "app_service_account_email" {
  description = "Service account email for app servers in the MIG"
  type        = string
}

variable "app_startup_script" {
  description = "Startup script for app server VMs in the MIG"
  type        = string
}

variable "reader_service_account" {
  description = "Service account email for read-only bucket access"
  type        = string
}

variable "writer_service_account" {
  description = "Service account email for read-write bucket access"
  type        = string
}

variable "data_team_group" {
  description = "Google group email for the data team (e.g. data-team@example.com)"
  type        = string
}

variable "etl_service_account" {
  description = "Service account email for the ETL pipeline"
  type        = string
}

variable "dataflow_service_account" {
  description = "Service account email for Dataflow workers"
  type        = string
}

variable "analytics_group" {
  description = "Google group email for analytics users"
  type        = string
}
```

---

### Quick-Reference — Resource Cheat Sheet

| Resource                                | Use Case                             | Key Arguments                                                  |
| --------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `google_compute_instance`               | Single VM                            | `machine_type`, `boot_disk`, `network_interface`, `scheduling` |
| `google_compute_disk`                   | Standalone data disk                 | `type`, `size`, `zone`                                         |
| `google_compute_attached_disk`          | Attach disk to VM                    | `disk`, `instance`, `mode`                                     |
| `google_compute_snapshot`               | Manual point-in-time backup          | `source_disk`, `storage_locations`                             |
| `google_compute_resource_policy`        | Scheduled snapshots or VM start/stop | `snapshot_schedule_policy` or `instance_schedule_policy`       |
| `google_compute_instance_template`      | Reusable VM blueprint for MIGs       | `disk`, `network_interface`, `metadata`                        |
| `google_compute_instance_group_manager` | Managed fleet of identical VMs       | `version`, `auto_healing_policies`, `update_policy`            |
| `google_compute_autoscaler`             | CPU-based scaling for a MIG          | `autoscaling_policy.cpu_utilization.target`                    |
| `google_storage_bucket`                 | Any GCS bucket                       | `location`, `uniform_bucket_level_access`, `lifecycle_rule`    |
| `google_storage_bucket_iam_member`      | Additive IAM grant                   | `bucket`, `role`, `member`                                     |
| `google_storage_bucket_iam_binding`     | Authoritative IAM for a role         | `bucket`, `role`, `members`                                    |
| `google_storage_bucket_object`          | Upload file or inline content        | `name`, `bucket`, `source` or `content`                        |
| `google_storage_notification`           | Pub/Sub trigger on bucket events     | `event_types`, `topic`, `object_name_prefix`                   |

---

### Storage Class Decision Guide

| Class | Min Storage | Retrieval Cost | Use When |
|---|---|---|---|
| STANDARD | None | Free | Accessed daily or hourly |
| NEARLINE | 30 days | Low | Accessed < once per month |
| COLDLINE | 90 days | Medium | Accessed < once per quarter |
| ARCHIVE | 365 days | High | Accessed < once per year (compliance, DR) |

> Rule of thumb: lifecycle rules should align to your actual access patterns.
> Over-tiering causes high retrieval costs; under-tiering means paying for STANDARD unnecessarily.
