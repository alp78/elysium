---
type: reference
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform VPC, terraform networking, GCP VPC terraform, firewall rules terraform, Cloud NAT terraform]
keywords: [VPC, subnet, Cloud NAT, firewall, IAP, Identity-Aware Proxy, google_compute_network, google_compute_subnetwork, google_compute_router_nat, google_compute_firewall, CIDR, ingress, egress, network topology, private IP]
description: "Terraform configuration for GCP networking: VPC, subnet, Cloud Router, Cloud NAT, and firewall rules for SQL Server, Airflow UI, APM, IAP SSH, and deny-all ingress."
related:
  - "[[terraform-compute]]"
  - "[[terraform-iam-and-secrets]]"
  - "[[terraform-cloud-run]]"
  - "[[hcl-syntax-basics]]"
  - "[[terraform-providers-and-backend]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Networking — VPC, Subnet, NAT, and Firewall Rules

This note covers the complete GCP network topology for a production data engineering project defined in `network.tf`. Every resource communicates through this VPC.

## Networking Concepts

**VPC (Virtual Private Cloud)** — an isolated private network within GCP. All resources (VMs, Cloud Run services) communicate through it using private IPs instead of going over the public internet. A VPC is a logical container — it cannot hold resources directly; you need at least one subnet.

**Subnet** — a contiguous block of IP addresses within a VPC, scoped to a single region. VMs get their private IPs from the subnet's range. You can have multiple subnets in different regions within the same VPC (e.g., `10.0.0.0/24` in `europe-west1` and `10.0.1.0/24` in `us-central1`).

**NAT (Network Address Translation)** — allows resources with only private IPs to make **outbound** requests to the internet by routing traffic through a shared public IP managed by GCP. Incoming traffic from the internet is still blocked — NAT only handles outbound. All VMs in the VPC share the same NAT gateway. Used when VMs need to download packages (`apt-get`), pull Docker images, or call Google APIs.

**IAP (Identity-Aware Proxy)** — Google's managed tunnel service. IAP authenticates you with your Google identity, then forwards traffic to your VM from the `35.235.240.0/20` range. Your actual IP never reaches the VM — Google's IAP service acts as a proxy. This is how `gcloud compute ssh` works without exposing SSH to the internet. IAP is a separate path from NAT — it does not use or depend on NAT.

#### Ingress vs Egress — traffic direction in GCP firewall rules

| Direction | What it means | Default in GCP |
|-----------|---------------|----------------|
| **Ingress** | Traffic coming **into** a VM from outside | **Denied** (must explicitly allow) |
| **Egress** | Traffic going **out** from a VM to the internet | **Allowed** (all outbound permitted) |

Egress happens when a VM initiates an outbound connection: `apt-get update`, pulling Docker images, calling Cloud Run APIs, reaching Google APIs (Secret Manager, Cloud Logging), DNS lookups, NTP sync. Traffic between VMs on the VPC via private IPs stays **internal** and is not considered egress.

**Firewall Priority** — lower number = higher priority = evaluated first. The deny-all rule at priority 65000 acts as a catch-all fallback. Allow rules at the default priority 1000 are evaluated first and let through specific traffic. If deny-all had a higher priority (lower number) than allow rules, nothing would get through.

---

### Architecture Overview

```text
GCP Project (europe-west1)
│
├── VPC: data-pipeline-vpc (10.0.0.0/24)
│   ├── Cloud NAT (outbound internet for private VMs)
│   ├── Firewall: SQL (1433), Airflow UI (8080), APM (8126), SSH (22), deny-all
│   │
│   ├── GCE VM: data-pipeline-sql (no public IP, uses NAT for outbound)
│   └── GCE VM: data-pipeline-airflow (ephemeral public IP)
```

---

### Resource: VPC Network

```hcl
resource "google_compute_network" "main" {
  name                    = "data-pipeline-vpc"
  auto_create_subnetworks = false
}
```

A **Virtual Private Cloud** — an isolated private network in GCP. All VMs, Cloud Run services, and internal traffic flow through this network.

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-vpc` | Display name in GCP console and used by other resources to reference this network. |
| `auto_create_subnetworks` | `false` | **Custom mode VPC**. When `true`, GCP automatically creates one subnet per region — but you lose control over IP ranges. Setting `false` means we define our own subnets explicitly (see next resource). Production best practice. |

---

### Resource: Subnet

```hcl
resource "google_compute_subnetwork" "main" {
  name          = "data-pipeline-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}
```

A **subnet** — a contiguous block of private IP addresses within the VPC, scoped to a single region.

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-subnet` | Identifier for this subnet. |
| `ip_cidr_range` | `10.0.0.0/24` | **CIDR notation** defining the IP range. `/24` means the first 24 bits are the network prefix, leaving 8 bits for hosts = **256 addresses** (10.0.0.0 through 10.0.0.255). GCP reserves 4 addresses, so 252 are usable. More than enough for 2 VMs + Cloud Run connectors. |
| `region` | `var.region` | `europe-west1`. Subnets are regional — VMs in any zone within this region can use this subnet. |
| `network` | `google_compute_network.main.id` | **Resource reference** — links this subnet to the VPC created above. Terraform resolves `.id` to the network's full resource path at apply time. This also creates an implicit dependency: the VPC must exist before the subnet. |

---

### Resource: Cloud Router

```hcl
resource "google_compute_router" "main" {
  name    = "data-pipeline-router"
  region  = var.region
  network = google_compute_network.main.id
}
```

A **Cloud Router** — a virtual router that provides dynamic routing for the VPC. Required by Cloud NAT.

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-router` | Router identifier. |
| `region` | `var.region` | Routers are regional. Must be in the same region as the subnet it serves. |
| `network` | `google_compute_network.main.id` | The VPC this router belongs to. |

---

### Resource: Cloud NAT

```hcl
resource "google_compute_router_nat" "main" {
  name                               = "data-pipeline-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
```

**Cloud NAT** — allows VMs without public IPs to make outbound connections to the internet. The SQL Server VM has no public IP but needs to download packages during bootstrap.

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-nat` | NAT gateway identifier. |
| `router` | `google_compute_router.main.name` | The Cloud Router this NAT attaches to. |
| `nat_ip_allocate_option` | `AUTO_ONLY` | GCP automatically allocates external IP addresses for NAT. The alternative `MANUAL_ONLY` lets you specify your own static IPs — useful when a firewall allowlist needs a fixed source IP. |
| `source_subnetwork_ip_ranges_to_nat` | `ALL_SUBNETWORKS_ALL_IP_RANGES` | Every subnet in the VPC can use this NAT gateway. Could be restricted to specific subnets, but with only one subnet, this is fine. |

> [!info] Why Cloud NAT Over Public IPs
>
> Why Cloud NAT instead of public IPs?.
> The SQL VM must never be directly reachable from the internet. Cloud NAT provides outbound-only connectivity — external traffic can flow out (for package downloads, API calls) but nothing can initiate a connection in.

> [!warning] Cloud NAT Port Exhaustion
>
> Cloud NAT Port Exhaustion Under High Concurrency.
> Cloud NAT allocates 64 ports per VM by default. If a pipeline opens many concurrent outbound connections (e.g., hundreds of parallel API calls), you can exhaust the NAT port pool and see `RESOURCE_EXHAUSTED` errors. Increase the minimum ports per VM with `min_ports_per_vm` in the NAT config, or use `enable_dynamic_port_allocation = true` for bursty workloads.

---

## Firewall Rules

GCP firewalls are **stateful** -- if outbound traffic is allowed, the return traffic is automatically allowed. Rules are evaluated by priority (lower number = higher priority). The default is to deny all ingress and allow all egress. Note that these VPC-level firewall rules complement any OS-level [firewalls](/01-Shell/Networking/firewalls) configured inside the VMs themselves.

### Rule: allow_sql — SQL Server Port 1433

```hcl
resource "google_compute_firewall" "allow_sql" {
  name    = "allow-sql-from-airflow"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["1433"]
  }

  source_ranges = ["10.0.0.0/24"]
  target_tags   = ["sql"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `protocol` | `tcp` | SQL Server uses TCP for database connections. |
| `ports` | `["1433"]` | Standard SQL Server port. |
| `source_ranges` | `["10.0.0.0/24"]` | Only traffic originating from within the VPC subnet can reach port 1433. This means Cloud Run services (connected via direct VPC) and the Airflow VM can query the database, but nothing from the public internet can. |
| `target_tags` | `["sql"]` | This rule only applies to VMs tagged `"sql"`. Tags are assigned in the VM definition (`compute.tf`). A VM without this tag ignores this rule entirely. |

### Rule: allow_airflow_ui — Airflow Web UI Port 8080

```hcl
resource "google_compute_firewall" "allow_airflow_ui" {
  name    = "data-pipeline-allow-airflow"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["8080"]
  }

  source_ranges = compact(concat(
    ["35.235.240.0/20"],
    var.admin_ip != "" ? ["${var.admin_ip}/32"] : []
  ))
  target_tags   = ["airflow"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `ports` | `["8080"]` | Airflow web UI port. |
| `source_ranges` | Dynamic list | **`compact(concat(...))`** — Terraform function chain: `concat` merges two lists, `compact` removes empty strings. The result: always includes `35.235.240.0/20` (Google's **IAP tunnel** range) and optionally includes the admin's public IP if `var.admin_ip` is set. |
| `35.235.240.0/20` | — | **Identity-Aware Proxy (IAP)** — Google's managed tunnel service. SSH and TCP forwarding through IAP originate from this CIDR. Allows `gcloud compute ssh` access without exposing the VM's SSH port to the world. |
| `${var.admin_ip}/32` | — | The `/32` suffix means exactly one IP address (all 32 bits are the network prefix). Allows direct browser access to the Airflow UI from the admin's home/office IP. |
| `target_tags` | `["airflow"]` | Only applies to the Airflow VM. |

### Rule: allow_apm — Datadog APM Port 8126

```hcl
resource "google_compute_firewall" "allow_apm" {
  name    = "data-pipeline-allow-apm"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["8126"]
  }

  source_ranges = ["10.0.0.0/24"]
  target_tags   = ["airflow"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `ports` | `["8126"]` | Datadog APM trace intake port. The Datadog Agent listens on this port on the Airflow VM. |
| `source_ranges` | `["10.0.0.0/24"]` | Cloud Run pipeline jobs (connected to the VPC) send APM traces to this port. Only internal VPC traffic is allowed. |
| `target_tags` | `["airflow"]` | The Datadog Agent runs on the Airflow VM — that's where traces are received. |

### Rule: allow_iap — SSH via IAP Tunnel Port 22

```hcl
resource "google_compute_firewall" "allow_iap" {
  name    = "data-pipeline-allow-iap"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["airflow", "sql"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `ports` | `["22"]` | SSH port. |
| `source_ranges` | `["35.235.240.0/20"]` | IAP tunnel range only. SSH is not open to the internet -- the only way to SSH into either VM is through `gcloud compute ssh`, which routes through IAP. See [iap-tunneling](/01-Shell/Networking/iap-tunneling) for the full IAP connection workflow and troubleshooting. |
| `target_tags` | `["airflow", "sql"]` | Both VMs accept SSH through IAP. |

### Rule: deny_all_ingress — Belt-and-Suspenders Catch-All

```hcl
resource "google_compute_firewall" "deny_all_ingress" {
  name     = "data-pipeline-deny-all-ingress"
  network  = google_compute_network.main.name
  priority = 65000

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `priority` | `65000` | Lower number = higher priority. GCP's default implicit deny is at 65534. This explicit deny at 65000 is a **belt-and-suspenders** safety net — it blocks everything not explicitly allowed by higher-priority rules (which default to 1000). |
| `protocol` | `all` | TCP, UDP, ICMP — everything. |
| `source_ranges` | `["0.0.0.0/0"]` | All IPv4 addresses (the entire internet). |

> [!info] Firewall Evaluation Order
>
> GCP evaluates all rules in priority order. The `allow_sql` rule (priority 1000, the default) takes precedence over `deny_all_ingress` (priority 65000). If a packet matches an allow rule first, it's admitted. If no allow rule matches, this deny catches it.

> [!danger] Overly Broad Source Ranges
>
> Overly Broad `source_ranges` Are the Number One Firewall Mistake.
> Setting `source_ranges = ["0.0.0.0/0"]` on any allow rule exposes that port to the entire internet. This is the most common cause of database breaches in cloud environments. Always restrict source ranges to known CIDR blocks (VPC subnet, IAP range, office IP). If you need temporary access, use IAP tunneling instead of opening ports.

---

## gcloud Verification Commands

#### gcloud compute networks/firewall-rules list — verify after terraform apply

```bash
# List VPCs
gcloud compute networks list --filter="name=data-pipeline-vpc"

# List subnets
gcloud compute networks subnets list --filter="network:data-pipeline-vpc"

# List firewall rules
gcloud compute firewall-rules list --filter="network:data-pipeline-vpc" --format="table(name, direction, priority, sourceRanges, allowed)"

# Describe a specific firewall rule
gcloud compute firewall-rules describe allow-sql-from-airflow

# List NAT gateways
gcloud compute routers nats list --router=data-pipeline-router --region=europe-west1
```

## Related

- [[terraform-compute]] — the VMs that attach to this network
- [[terraform-cloud-run]] — Cloud Run direct VPC egress using this subnet
- [[terraform-iam-and-secrets]] — service accounts used by the VMs
- [[terraform-conditional-resources]] — the conditional admin_ip firewall rule

## References

- [google_compute_network](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_network)
- [google_compute_firewall](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/compute_firewall)
- [Cloud NAT overview](https://cloud.google.com/nat/docs/overview)
- [IAP TCP forwarding](https://cloud.google.com/iap/docs/using-tcp-forwarding)
