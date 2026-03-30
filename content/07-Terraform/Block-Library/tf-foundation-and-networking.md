---
type: reference
category: terraform
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform block library, terraform GCP blocks, terraform networking blocks, terraform foundation blocks, GCP terraform snippets, terraform copy-paste blocks]
keywords: [terraform, gcp, block library, google_compute_network, google_compute_subnetwork, google_compute_router, google_compute_router_nat, google_compute_firewall, google_compute_address, google_dns_managed_zone, google_dns_record_set, google_compute_network_peering, google_compute_shared_vpc_host_project, google_compute_shared_vpc_service_project, google_compute_global_address, google_service_networking_connection, VPC, subnet, Cloud NAT, firewall, IAP, Identity-Aware Proxy, CIDR, ingress, egress, static IP, DNS, private service connect, shared VPC, VPC peering, backend GCS, required_providers, terraform block, provider google, project_id, region, zone, environment, common_labels, locals, outputs, Cloud Router, health check, deny all, SQL Server, Airflow, APM, HTTP, HTTPS, SSH, compact concat, private Google access, secondary ranges, GKE pods, services range, NAT auto allocate]
description: "Atomic Terraform block library for GCP foundation and networking resources. Every block is self-contained, heavily commented, and copy-pasteable. Covers provider/backend setup, variables, outputs, locals, VPC, subnets, Cloud NAT, firewall rules, static IPs, DNS, VPC peering, Shared VPC, and Private Service Connect."
related:
  - "[terraform-networking](/07-Terraform/GCP-Resources/terraform-networking)"
  - "[terraform-providers-and-backend](/07-Terraform/Fundamentals/terraform-providers-and-backend)"
  - "[terraform-variables-and-outputs](/07-Terraform/Fundamentals/terraform-variables-and-outputs)"
  - "[terraform-compute](/07-Terraform/GCP-Resources/terraform-compute)"
  - "[terraform-iam-and-secrets](/07-Terraform/GCP-Resources/terraform-iam-and-secrets)"
  - "[hcl-syntax-basics](/07-Terraform/Fundamentals/hcl-syntax-basics)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Block Library — GCP Foundation and Networking

This is an atomic block library. Every section below is an independently copy-pasteable Terraform block. Each block is heavily commented so that every argument is self-explanatory, and each block is preceded by a short explanation of when a data engineer would reach for it. No block depends on another block in this file — treat each one as a standalone snippet.

---

## Foundation Blocks

### Provider and Backend

Use this block at the top of every GCP Terraform project. The `terraform {}` block pins the Terraform CLI version and declares the Google provider version so that upgrades do not happen silently. The `backend "gcs"` block stores state remotely so that the team shares a single source of truth and state locking prevents concurrent runs from corrupting each other.

```hcl
# ── terraform.tf ────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.7.0"  # minimum Terraform CLI version; fails fast if the engineer's local version is too old

  required_providers {
    google = {
      source  = "hashicorp/google"  # official Google provider from the Terraform registry
      version = "~> 6.0"           # allow 6.x patch/minor releases but not 7.x (semver constraint)
    }
  }

  backend "gcs" {
    bucket = "analytics-terraform-state"  # GCS bucket that stores the .tfstate file; must exist before first `terraform init`
    prefix = "foundation/networking"      # path prefix inside the bucket; use one prefix per environment or component
  }
}
```

```hcl
# ── provider.tf ─────────────────────────────────────────────────────────────

# configures the Google provider that all google_* resources use
provider "google" {
  project = var.project_id    # GCP project where all resources will be created
  region  = var.region        # default region for regional resources (subnets, VMs, etc.)
}
```

---

### Variables

Use this block in `variables.tf`. Declaring variables makes the configuration reusable across environments (dev, staging, prod) and projects. Mark sensitive inputs (like credentials) with `sensitive = true` to keep them out of plan output. Every variable without a `default` is required — Terraform will prompt for it or expect it in `terraform.tfvars`.

```hcl
# ── variables.tf ────────────────────────────────────────────────────────────

# the GCP project ID where all resources in this configuration are deployed
variable "project_id" {
  type        = string       # must be a string (GCP project IDs are alphanumeric with hyphens)
  description = "GCP project ID — required, no default"
  # no default — caller must supply this value; fails fast if missing
}

# the GCP region for all regional resources (subnets, NAT, VMs)
variable "region" {
  type        = string
  description = "GCP region for regional resources"
  default     = "europe-west1"  # western Europe (Belgium) — low latency for EU workloads
}

# the GCP zone for zonal resources (VMs, persistent disks)
variable "zone" {
  type        = string
  description = "GCP zone for zonal resources"
  default     = "europe-west1-b"  # zone b is generally the most stable in europe-west1
}

# logical environment name; used in resource names and label values
variable "environment" {
  type        = string
  description = "Deployment environment: prod, staging, or dev"
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)  # only these three values are valid
    error_message = "environment must be one of: prod, staging, dev."       # shown to the engineer on failure
  }
}

# labels applied to every resource; enables cost attribution and filtering in the console
variable "common_labels" {
  type        = map(string)            # key-value pairs; both keys and values must be strings
  description = "Labels applied to all resources for cost tracking and filtering"
  default = {
    managed-by  = "terraform"          # signals that the resource should not be edited in the console
    team        = "data-engineering"   # cost attribution to the DE team
    environment = "prod"               # duplicated here so labels are self-contained without var interpolation
  }
}

# CIDR range for the primary subnet; drives firewall rules and NAT config
variable "subnet_cidr" {
  type        = string
  description = "Primary subnet CIDR block"
  default     = "10.0.0.0/24"  # 256 addresses — sufficient for most small-to-medium data platform deployments
}

# admin CIDR for management traffic (e.g., your office IP for extra firewall rules)
variable "admin_cidr" {
  type        = string
  description = "Admin CIDR block allowed to reach management UIs"
  default     = ""  # empty by default — set in terraform.tfvars for your office IP
}
```

---

### Outputs

Use `outputs.tf` to expose resource attributes that downstream configurations or humans need. Outputs are the "public interface" of a Terraform module or root configuration — they show up in `terraform output` and can be consumed by other modules via `terraform_remote_state`. Always output the IDs and self-links of network resources because compute configurations almost always reference them.

```hcl
# ── outputs.tf ──────────────────────────────────────────────────────────────

# exposes the VPC network self-link so compute resources in other configs can attach to it
output "vpc_self_link" {
  description = "Self-link of the VPC network"
  value       = google_compute_network.main.self_link  # full URL; required by resources that take a network reference
}

# exposes the subnet self-link; VMs and GKE node pools reference this to join the subnet
output "subnet_self_link" {
  description = "Self-link of the primary subnet"
  value       = google_compute_subnetwork.main.self_link
}

# exposes the subnet CIDR so firewall rules in other configs can use it as a source range
output "subnet_cidr" {
  description = "Primary subnet CIDR block"
  value       = google_compute_subnetwork.main.ip_cidr_range
}

# exposes the static NAT IP so it can be allowlisted in external systems (e.g., database firewalls)
output "nat_ip" {
  description = "Reserved static IP used by Cloud NAT for outbound traffic"
  value       = google_compute_address.nat_ip.address  # the actual dotted-quad IP string
}

# exposes the DNS zone name so record sets can be added in other configurations
output "dns_zone_name" {
  description = "Name of the managed DNS zone"
  value       = google_dns_managed_zone.main.name
}
```

---

### Locals

Use `locals {}` to compute derived values once and reference them throughout the configuration. Locals eliminate repetition and make the configuration easier to refactor — change one local and all references update. Common uses are building resource name prefixes, constructing connection strings, and computing Artifact Registry URLs.

```hcl
# ── locals.tf ───────────────────────────────────────────────────────────────

locals {
  # consistent name prefix for every resource in this configuration
  # pattern: {team}-{environment} → "analytics-prod", "analytics-staging"
  name_prefix = "analytics-${var.environment}"

  # Artifact Registry Docker repository URL; used in CI pipelines and Cloud Run image references
  # format: {region}-docker.pkg.dev/{project}/{repo}
  registry_url = "${var.region}-docker.pkg.dev/${var.project_id}/${local.name_prefix}-registry"

  # Cloud SQL connection string for app configuration; avoids hardcoding in multiple places
  # format: {project}:{region}:{instance-name}
  db_connection_name = "${var.project_id}:${var.region}:${local.name_prefix}-db"

  # merged labels: merge common_labels with resource-specific additions
  # common_labels are the base; per-resource labels override if keys collide
  base_labels = merge(var.common_labels, {
    component = "networking"  # identifies which Terraform component manages this resource
  })

  # GCP health check IP ranges — used in firewall rules to allow load balancer health checks
  # these ranges are published by Google and do not change often; hardcoded here for clarity
  health_check_ranges = ["35.191.0.0/16", "130.211.0.0/22"]

  # IAP TCP forwarding range — Google's proxy range for IAP-tunneled SSH/RDP
  # all IAP traffic appears to originate from this range inside GCP
  iap_range = "35.235.240.0/20"
}
```

---

## Networking Blocks

### VPC Network

Use this block to create a custom-mode VPC — the network container that all your GCP resources will live in. Every GCP project needs exactly one VPC per network topology (you may have multiple VPCs for environment isolation or peering scenarios). Custom mode means you define every subnet explicitly; this is always preferred over auto-mode for production because auto-mode creates subnets in every region automatically, which wastes IPs and creates an uncontrolled attack surface.

```hcl
# ── network.tf — VPC ────────────────────────────────────────────────────────

# creates the project VPC network — the top-level network container for all resources
resource "google_compute_network" "main" {
  name                    = "data-platform-vpc"  # network name visible in the GCP console and used in references
  auto_create_subnetworks = false                # disables automatic subnet creation in every region (custom mode)
  description             = "Primary VPC for the data platform"  # human-readable description shown in the console
  routing_mode            = "REGIONAL"           # REGIONAL: routes only within the region; GLOBAL: routes across regions
}
```

---

### Subnet

Use this block whenever you need to carve out an IP range within the VPC for a specific region. A subnet is required before any VM, GKE node pool, or Cloud SQL instance can be placed in a region. Enable `private_ip_google_access` on any subnet where VMs do not have public IPs — without it, those VMs cannot reach Google APIs (Secret Manager, GCS, Artifact Registry). The secondary IP ranges are required if GKE is running in this subnet; they provide address space for pods and services, which need many more IPs than nodes.

```hcl
# ── network.tf — Subnet ─────────────────────────────────────────────────────

# creates the primary regional subnet inside the VPC
resource "google_compute_subnetwork" "main" {
  name          = "data-platform-subnet"            # subnet name; must be unique within the region
  ip_cidr_range = var.subnet_cidr                   # primary IP range for VMs in this subnet (e.g., 10.0.0.0/24)
  region        = var.region                        # region where this subnet lives; must match the region of VMs using it
  network       = google_compute_network.main.id    # parent VPC; references the network resource created above

  # allows VMs with no public IP to reach Google APIs over Google's internal backbone
  # without this, private VMs cannot call Secret Manager, GCS, Artifact Registry, etc.
  private_ip_google_access = true

  # secondary IP ranges are required for GKE clusters in VPC-native mode
  # GKE allocates pod and service IPs from these ranges (not from the primary range)
  secondary_ip_range {
    range_name    = "data-platform-pods"     # name used when configuring the GKE cluster's pod range
    ip_cidr_range = "10.1.0.0/16"           # /16 gives 65536 pod IPs — standard for medium GKE clusters
  }

  secondary_ip_range {
    range_name    = "data-platform-services" # name used when configuring the GKE cluster's service range
    ip_cidr_range = "10.2.0.0/20"           # /20 gives 4096 service IPs — sufficient for hundreds of K8s services
  }
}
```

---

### Cloud NAT

Use this block whenever VMs in the subnet have no public IP address but need to make outbound internet connections — for example, to run `apt-get`, pull Docker images from Docker Hub, or reach external APIs. Cloud NAT is a managed, highly available NAT gateway — you do not need to run a NAT VM yourself. The Cloud Router is a required dependency; it advertises the VPC's routes and connects to the NAT gateway. Without NAT, private VMs are completely isolated from the internet (outbound blocked), even though egress from GCP is technically permitted by firewall rules.

```hcl
# ── network.tf — Cloud Router ────────────────────────────────────────────────

# Cloud Router is a prerequisite for Cloud NAT; it manages BGP sessions and route advertisements
resource "google_compute_router" "main" {
  name    = "data-platform-router"             # router name; scoped to the region
  region  = var.region                         # must be in the same region as the NAT gateway and subnet
  network = google_compute_network.main.id     # attaches the router to the VPC
  description = "Cloud Router for NAT gateway" # human-readable; shows intent in the console
}
```

```hcl
# ── network.tf — Cloud NAT ──────────────────────────────────────────────────

# Cloud NAT gateway; translates outbound traffic from private VMs to a public IP
resource "google_compute_router_nat" "main" {
  name                               = "data-platform-nat"                         # NAT gateway name
  router                             = google_compute_router.main.name              # must reference the Cloud Router in the same region
  region                             = var.region                                   # same region as the router and subnet
  nat_ip_allocate_option             = "AUTO_ONLY"                                  # AUTO_ONLY: GCP allocates ephemeral IPs automatically; use MANUAL_ONLY to reserve static IPs
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"                        # only NAT the subnets explicitly listed below (more secure than ALL_SUBNETWORKS)

  subnetwork {
    name                    = google_compute_subnetwork.main.id                     # subnet whose traffic goes through this NAT
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]                                     # NAT all IPs in the subnet's primary and secondary ranges
  }

  log_config {
    enable = true            # enables NAT logging to Cloud Logging; useful for debugging connectivity issues
    filter = "ERRORS_ONLY"  # log only failed NAT translations; ALL logs every packet (very verbose)
  }
}
```

---

## Firewall Rules

All firewall rules below are atomic. Each one targets the same VPC (`google_compute_network.main`). Combine only the rules your workload needs.

---

### Allow SSH from IAP

Use this rule to allow `gcloud compute ssh` (Identity-Aware Proxy tunneling) to reach VMs. IAP is the secure alternative to opening port 22 to the public internet. When an engineer runs `gcloud compute ssh`, Google's IAP service authenticates the request using their Google identity, then proxies the TCP connection from the `35.235.240.0/20` range to the VM. This rule only needs to exist once per VPC — it applies to all VMs with the `iap-ssh` network tag.

```hcl
# ── firewall.tf — SSH via IAP ───────────────────────────────────────────────

# allows IAP to forward SSH (port 22) connections to tagged VMs
resource "google_compute_firewall" "allow_ssh_iap" {
  name    = "data-platform-allow-ssh-iap"          # firewall rule name; must be unique within the project
  network = google_compute_network.main.name        # the VPC this rule applies to

  description = "Allow SSH from Google IAP proxy range to instances with the iap-ssh tag"

  direction = "INGRESS"          # ingress: controls traffic arriving at VMs
  priority  = 1000               # evaluated before the deny-all rule at 65000 (lower number = higher priority)

  allow {
    protocol = "tcp"  # SSH is TCP-based
    ports    = ["22"] # standard SSH port
  }

  # the IAP proxy always originates from this CIDR — Google publishes this range
  # do NOT expand this range; it would allow arbitrary internet traffic on port 22
  source_ranges = ["35.235.240.0/20"]

  # only VMs with this network tag receive the traffic
  # add this tag to a VM: network_tags = ["iap-ssh"] in google_compute_instance
  target_tags = ["iap-ssh"]
}
```

---

### Allow SQL Server

Use this rule when a SQL Server instance (port 1433) runs on a VM and application VMs in the same subnet need to connect to it. Restrict the source range to the subnet CIDR — never open 1433 to the internet. This rule uses a network tag on both the source (application VMs) and the target (SQL Server VM), but a simpler alternative is to just restrict by subnet CIDR as shown below.

```hcl
# ── firewall.tf — SQL Server ────────────────────────────────────────────────

# allows TCP 1433 (SQL Server) traffic from within the subnet to SQL Server VMs
resource "google_compute_firewall" "allow_sql_server" {
  name    = "data-platform-allow-sql-server"   # unique rule name within the project
  network = google_compute_network.main.name    # VPC this rule applies to

  description = "Allow SQL Server port 1433 from subnet CIDR to sql-server-tagged VMs"

  direction = "INGRESS"  # incoming traffic to the SQL Server VM
  priority  = 1000       # evaluated before deny-all at 65000

  allow {
    protocol = "tcp"      # SQL Server uses TCP
    ports    = ["1433"]   # default SQL Server port; change if using a non-standard port
  }

  # restrict source to the subnet range — only VMs in the same subnet can connect
  # alternatively, use source_tags = ["app-server"] to restrict by VM tag rather than CIDR
  source_ranges = [var.subnet_cidr]

  # only VMs tagged "sql-server" receive this traffic
  # apply this tag in google_compute_instance: network_tags = ["sql-server"]
  target_tags = ["sql-server"]
}
```

---

### Allow HTTP and HTTPS

Use this rule when a VM or load balancer needs to serve web traffic on ports 80 and 443. For internet-facing services, the source is `0.0.0.0/0` (all IPs). For internal services, restrict the source to the subnet CIDR or a specific tag. If using a GCP external load balancer, the load balancer itself handles the public IP — you should apply this rule to the backend VMs so the load balancer can forward traffic to them.

```hcl
# ── firewall.tf — HTTP and HTTPS ────────────────────────────────────────────

# allows inbound HTTP (80) and HTTPS (443) traffic from the internet to web-tagged VMs
resource "google_compute_firewall" "allow_http_https" {
  name    = "data-platform-allow-http-https"   # unique rule name
  network = google_compute_network.main.name    # VPC this rule belongs to

  description = "Allow HTTP 80 and HTTPS 443 from the internet to web-server-tagged VMs"

  direction = "INGRESS"  # inbound traffic from the internet
  priority  = 1000       # standard priority; evaluated before deny-all at 65000

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]  # HTTP and HTTPS; add "8080" here for alternate HTTP if needed
  }

  source_ranges = ["0.0.0.0/0"]  # open to the internet; restrict to subnet CIDR for internal-only services

  target_tags = ["web-server"]  # only VMs with this tag receive the traffic; add to VM: network_tags = ["web-server"]
}
```

---

### Allow Specific Port from Specific Source (Parameterized Pattern)

Use this pattern when you need a flexible, reusable firewall block for a port and source range that varies by environment or use case. This is the generic form — parameterize it using `for_each` over a map of rule definitions to generate multiple rules from a single block (see the `for_each` pattern in the Patterns notes).

```hcl
# ── firewall.tf — Parameterized allow rule ──────────────────────────────────

# allows a specific port from a specific CIDR — generic pattern for custom application ports
resource "google_compute_firewall" "allow_custom_port" {
  name    = "data-platform-allow-custom-${var.environment}"  # use environment in the name for uniqueness across workspaces
  network = google_compute_network.main.name                  # VPC this rule applies to

  description = "Allow custom application port from defined source range"

  direction = "INGRESS"  # inbound; for outbound restrictions use EGRESS
  priority  = 1000       # overrides the deny-all rule at 65000

  allow {
    protocol = "tcp"
    ports    = ["8080"]  # replace with your application port; use a variable for reusability
  }

  # replace with the specific CIDR that should be allowed
  # examples: subnet CIDR for internal, office IP for VPN-less admin, 0.0.0.0/0 for public
  source_ranges = ["10.0.0.0/24"]

  target_tags = ["analytics-app"]  # only VMs with this tag are affected; acts as a firewall selector
}
```

---

### Allow Airflow UI from IAP and Admin IP

Use this block when the Airflow webserver UI (typically port 8080) should be accessible through IAP tunneling and optionally from a fixed admin IP (your office or VPN). The `compact(concat(...))` pattern removes empty strings from the list — this is the standard Terraform idiom for optional source ranges: if `var.admin_cidr` is an empty string, `compact()` drops it, leaving only the IAP range. This avoids needing to write conditional logic with `count` or `dynamic` blocks.

```hcl
# ── firewall.tf — Airflow UI ─────────────────────────────────────────────────

# allows Airflow webserver UI (port 8080) from IAP and optionally from an admin CIDR
resource "google_compute_firewall" "allow_airflow_ui" {
  name    = "data-platform-allow-airflow-ui"   # unique rule name
  network = google_compute_network.main.name    # VPC this rule targets

  description = "Allow Airflow UI port 8080 from IAP range and optional admin CIDR"

  direction = "INGRESS"  # inbound to the Airflow VM
  priority  = 1000       # before deny-all at 65000

  allow {
    protocol = "tcp"
    ports    = ["8080"]  # Airflow default webserver port; change if configured differently
  }

  # compact() removes any empty strings from the list (i.e., when admin_cidr is "")
  # concat() merges the IAP range with the admin_cidr variable into a single list
  # result: ["35.235.240.0/20"] when admin_cidr is empty, or ["35.235.240.0/20", "203.0.113.0/24"] when set
  source_ranges = compact(concat(
    ["35.235.240.0/20"],  # always include the IAP proxy range for gcloud tunneling
    [var.admin_cidr],     # optionally include the admin CIDR; empty string is removed by compact()
  ))

  target_tags = ["airflow"]  # only VMs tagged "airflow" receive this rule
}
```

---

### Allow APM and Monitoring Ports

Use this block when running a Datadog or OpenTelemetry agent on VMs that needs to receive traces from application processes. Port 8126 is the Datadog APM trace receiver. The source is restricted to the subnet so only internal VMs can send traces to the agent — tracing data should never be exposed to the internet.

```hcl
# ── firewall.tf — APM / monitoring ─────────────────────────────────────────

# allows Datadog APM trace ingestion port 8126 from within the subnet
resource "google_compute_firewall" "allow_apm" {
  name    = "data-platform-allow-apm"          # unique rule name in the project
  network = google_compute_network.main.name    # VPC this rule targets

  description = "Allow Datadog APM trace receiver port 8126 from subnet CIDR"

  direction = "INGRESS"  # inbound traffic from application VMs to the agent
  priority  = 1000       # before deny-all at 65000

  allow {
    protocol = "tcp"
    ports    = ["8126"]  # Datadog APM agent TCP receiver; also open 8125 (UDP) for StatsD metrics if needed
  }

  source_ranges = [var.subnet_cidr]  # only VMs in the same subnet can send traces; never open to internet

  target_tags = ["apm-agent"]  # only VMs running the Datadog agent need this tag
}
```

---

### Deny All Ingress (Default Deny)

Use this block as the last firewall rule in every VPC. It creates an explicit deny-all catch-all at priority 65000 — any traffic that is not matched by a higher-priority allow rule is dropped. GCP already has an implicit deny-all, but creating it explicitly serves two purposes: it is visible in the console so that auditors can confirm the intent, and it generates logs that show you what traffic is being blocked (useful for debugging connectivity issues).

```hcl
# ── firewall.tf — Deny all ingress ──────────────────────────────────────────

# explicit deny-all ingress rule at lowest priority — catches any traffic not matched by allow rules above
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "data-platform-deny-all-ingress"   # unique rule name
  network = google_compute_network.main.name    # VPC this rule applies to

  description = "Default deny-all ingress — blocks any traffic not explicitly allowed by higher-priority rules"

  direction = "INGRESS"  # applies to all inbound traffic
  priority  = 65000      # lowest standard priority; evaluated last; all allow rules default to 1000

  deny {
    protocol = "all"  # denies TCP, UDP, ICMP, and all other protocols
  }

  source_ranges = ["0.0.0.0/0"]  # matches all source IPs; combined with priority 65000, acts as a catch-all

  # no target_tags — applies to ALL VMs in the VPC regardless of tags
}
```

---

### Allow Health Checks

Use this rule whenever a GCP load balancer (HTTP(S), TCP, or SSL proxy) sends health checks to backend VMs. GCP's health checkers originate from two fixed CIDR ranges — if these ranges are blocked by a deny-all rule, the load balancer marks all backends as unhealthy and stops sending traffic to them. This rule must be present on any VPC that uses a GCP load balancer.

```hcl
# ── firewall.tf — Health checks ─────────────────────────────────────────────

# allows GCP load balancer health check probes to reach backend VMs
resource "google_compute_firewall" "allow_health_checks" {
  name    = "data-platform-allow-health-checks"  # unique rule name
  network = google_compute_network.main.name      # VPC this rule targets

  description = "Allow GCP load balancer health check probes from Google's published health check ranges"

  direction = "INGRESS"  # health checks are inbound probes from Google's infrastructure
  priority  = 1000       # must be higher priority (lower number) than deny-all at 65000

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]  # the ports your backend services listen on; adjust to match your app's health check endpoint
  }

  # these two ranges are published by Google and cover all regional and global load balancer health checkers
  # 35.191.0.0/16 — global HTTP(S) load balancer health checkers
  # 130.211.0.0/22 — legacy and regional load balancer health checkers
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]

  target_tags = ["load-balanced"]  # apply this tag to backend VM instances managed by a load balancer
}
```

---

## Static IP

### Reserved External IP Address

Use this block whenever a resource needs a stable, predictable public IP address that persists across reboots and recreations. Ephemeral IPs (the default) change every time a VM is stopped and restarted — this breaks DNS records, TLS certificates, and any external allowlists pointing to your IP. Reserve a static IP and attach it to the resource so the IP never changes. This is also used as the IP for Cloud NAT when you need your outbound traffic to come from a known, allowlistable IP.

```hcl
# ── network.tf — Static IP ──────────────────────────────────────────────────

# reserves a regional static external IP address
resource "google_compute_address" "main" {
  name         = "data-platform-static-ip"    # name for the reserved address; shown in the console and used in references
  region       = var.region                    # regional address; use google_compute_global_address for global load balancers
  address_type = "EXTERNAL"                    # EXTERNAL: routable from the internet; INTERNAL: private IP within the VPC
  description  = "Reserved static IP for the data platform ingress"  # documents purpose; helps auditors and future engineers

  labels = var.common_labels  # apply standard labels for cost tracking
}
```

```hcl
# ── network.tf — NAT Static IP (optional, if you want a fixed outbound IP) ──

# reserves a static IP specifically for use as the Cloud NAT outbound IP
# use this when external systems (e.g., SaaS APIs, banking APIs) require your IP to be allowlisted
resource "google_compute_address" "nat_ip" {
  name         = "data-platform-nat-ip"       # separate address for NAT to keep concerns distinct
  region       = var.region                    # must be in the same region as the NAT gateway
  address_type = "EXTERNAL"                    # NAT outbound IPs are always external
  description  = "Static IP for Cloud NAT outbound traffic — allowlist this IP in external services"
}
```

---

## DNS

### Managed DNS Zone

Use this block to create a private or public DNS zone that GCP manages. A managed zone is required before you can create DNS records. Use a private zone (`visibility = "private"`) for internal service discovery — VMs in the VPC can resolve names like `db.internal.example.com` without going to the public internet. Use a public zone (`visibility = "public"`) for internet-facing domains. You must own the domain and have delegated the NS records to Google's nameservers for a public zone.

```hcl
# ── dns.tf — Managed zone ───────────────────────────────────────────────────

# creates a Cloud DNS managed zone to host DNS records for a domain
resource "google_dns_managed_zone" "main" {
  name        = "data-platform-zone"           # internal name for the zone in GCP; used in resource references
  dns_name    = "data.analytics.example.com."  # the DNS domain this zone is authoritative for; must end with a dot
  description = "Primary DNS zone for the data platform"

  visibility = "public"  # "public" for internet-accessible domains; "private" for internal VPC-only resolution

  # for private zones, specify which VPCs can resolve this zone
  # remove this block entirely for public zones
  # private_visibility_config {
  #   networks {
  #     network_url = google_compute_network.main.id  # VPC allowed to resolve this private zone
  #   }
  # }

  labels = var.common_labels  # apply standard labels
}
```

---

### DNS A Record

Use this block to point a hostname to a static IP address. The most common use case in data engineering is pointing a subdomain (e.g., `airflow.data.analytics.example.com`) to the reserved static IP of a VM or load balancer. The TTL controls how long DNS resolvers cache the record — use a short TTL (60-300 seconds) while actively making changes, and a longer TTL (300-3600 seconds) in stable production to reduce DNS query volume.

```hcl
# ── dns.tf — A record ───────────────────────────────────────────────────────

# creates a DNS A record pointing a hostname to a static IP address
resource "google_dns_record_set" "main" {
  name         = "airflow.${google_dns_managed_zone.main.dns_name}"  # FQDN; appends the zone's domain; trailing dot is inherited
  type         = "A"                                                   # A record maps a hostname to an IPv4 address
  ttl          = 300                                                   # time-to-live in seconds; resolvers cache this record for 5 minutes
  managed_zone = google_dns_managed_zone.main.name                    # the zone this record belongs to

  # list of IP addresses for this record; multiple IPs enable round-robin DNS load balancing
  rrdatas = [google_compute_address.main.address]  # points to the reserved static IP defined above
}
```

---

## VPC Peering

### Peer Two VPCs

Use this block when two VPCs in the same or different GCP projects need to communicate over private IPs without going through the internet. Common use cases: peering a shared services VPC with project VPCs, connecting a data platform VPC to a partner team's VPC, or enabling cross-project communication for Cloud SQL. VPC peering is non-transitive — if VPC A peers with VPC B, and VPC B peers with VPC C, VPC A cannot reach VPC C. You must create two peering resources, one from each side, for the peering to be active.

```hcl
# ── peering.tf — VPC peering (side A → side B) ──────────────────────────────

# establishes VPC peering from the data platform VPC to the analytics VPC
# note: a matching peering resource must also be created in the analytics project (side B → side A)
resource "google_compute_network_peering" "data_to_analytics" {
  name                 = "data-platform-to-analytics"       # unique peering connection name within the VPC
  network              = google_compute_network.main.id     # the local VPC initiating the peering
  peer_network         = "projects/analytics-project-id/global/networks/analytics-vpc"  # full resource URL of the peer VPC; must include project and network name

  export_custom_routes = false  # false: do not advertise custom routes to the peer; true: share BGP routes (used with Cloud Router)
  import_custom_routes = false  # false: do not accept custom routes from the peer; set true only if the peer exports routes you need
}
```

```hcl
# ── peering.tf — VPC peering (side B → side A) ──────────────────────────────

# the reverse peering — must be applied in the analytics project for the peering to become ACTIVE
# both sides must accept each other; without this, the peering stays in INACTIVE state
resource "google_compute_network_peering" "analytics_to_data" {
  name         = "analytics-to-data-platform"               # unique within the analytics VPC
  network      = "projects/analytics-project-id/global/networks/analytics-vpc"  # the analytics VPC (local side of this resource)
  peer_network = google_compute_network.main.id             # reference back to the data platform VPC

  export_custom_routes = false  # symmetric with the other side; both must agree on route exchange settings
  import_custom_routes = false
}
```

---

## Shared VPC (Enterprise)

### Host and Service Project Configuration

Use these blocks in enterprise environments where multiple GCP projects share a single centrally managed VPC. The **host project** owns the VPC and all its subnets; **service projects** are GCP projects (dev, staging, prod, or team-specific) that are granted permission to use the host's subnets to deploy their resources. This pattern enforces network governance centrally — networking engineers manage the host project and control which subnets each service project can use, while application teams deploy into their service projects without needing to manage networking.

```hcl
# ── shared-vpc.tf — Host project ─────────────────────────────────────────────

# enables the Shared VPC host configuration on the host project
# this project owns the VPC; service projects attach to it
# apply this resource in the HOST project's Terraform configuration
resource "google_compute_shared_vpc_host_project" "host" {
  project = "data-platform-host-project-id"  # the GCP project ID that will act as the Shared VPC host
  # note: enabling this is a one-time action per project; it cannot be undone without detaching all service projects first
}
```

```hcl
# ── shared-vpc.tf — Service project attachment ───────────────────────────────

# attaches a service project to the Shared VPC host project
# after this, the service project's resources can use subnets from the host VPC
# create one of these blocks for each service project that should attach to the host
resource "google_compute_shared_vpc_service_project" "service" {
  host_project    = google_compute_shared_vpc_host_project.host.project  # references the host project ID defined above
  service_project = "data-platform-analytics-project-id"                  # the service project that will use the shared VPC

  # the service project's Compute Engine service account must be granted
  # roles/compute.networkUser on the specific subnets it should use (done separately via IAM bindings)
}
```

---

## Private Service Connect

### Private IP Range for Managed Services

Use these two blocks together when a Cloud SQL instance, Memorystore (Redis), or any other Google-managed service needs to be accessible via a private IP from within your VPC. Without Private Service Connect (formerly VPC Service Networking), managed services only have public IPs. These blocks allocate a private IP range from your VPC's address space and establish a peering connection between your VPC and Google's managed services network. After this, Cloud SQL instances created with `private_network` set to this VPC get an IP from the allocated range instead of a public IP.

```hcl
# ── psc.tf — Global private address allocation ──────────────────────────────

# allocates a block of private IP addresses within the VPC for use by managed services (Cloud SQL, Memorystore, etc.)
# this range must not overlap with any existing subnet or secondary range in your VPC
resource "google_compute_global_address" "private_services" {
  name          = "data-platform-private-services-range"  # name for the allocated range
  purpose       = "VPC_PEERING"                           # VPC_PEERING: reserves this range for service networking peering (required value)
  address_type  = "INTERNAL"                              # INTERNAL: private IPs, not routable from the internet
  prefix_length = 16                                      # /16 allocates 65536 addresses for managed services; use /20 for smaller deployments

  network = google_compute_network.main.id  # the VPC this private range is carved from

  # GCP will allocate an IP range starting from this address if available
  # leave address unset to let GCP choose automatically, or set it to enforce a specific range
  # address = "10.100.0.0"  # uncomment and set if you need a specific starting address
}
```

```hcl
# ── psc.tf — Service networking connection ──────────────────────────────────

# establishes the peering connection between your VPC and Google's managed services network
# required: enable the servicenetworking.googleapis.com API in your project before applying this
resource "google_service_networking_connection" "private_services" {
  network = google_compute_network.main.id  # your VPC that will peer with the managed services network

  # the service that provides the networking connection; always this value for Cloud SQL, Memorystore, etc.
  service = "servicenetworking.googleapis.com"

  # the reserved IP ranges that managed services will use for their private IPs
  # must reference the global address name (not the self_link or id)
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  # after this resource is created, Cloud SQL instances created with:
  #   private_network = google_compute_network.main.id
  # will receive a private IP from the reserved range and be reachable from the VPC without a public IP
}
```

---

### Complete Example: Wiring It All Together

This section shows a minimal but complete `network.tf` that combines the most common blocks. Copy this as a starting point and remove the sections your workload does not need.

```hcl
# ── complete network.tf ─────────────────────────────────────────────────────
# combines: VPC, subnet, Cloud Router, Cloud NAT, and the four most common firewall rules
# delete sections that do not apply to your workload

# 1. VPC — always required; everything else lives inside it
resource "google_compute_network" "main" {
  name                    = "analytics-vpc"   # replace "analytics" with your team or project prefix
  auto_create_subnetworks = false             # custom mode; always use this for production
}

# 2. Subnet — required before any VM or GKE cluster can be placed in the region
resource "google_compute_subnetwork" "main" {
  name                     = "analytics-subnet"
  ip_cidr_range            = "10.0.0.0/24"          # primary VM IP range
  region                   = var.region
  network                  = google_compute_network.main.id
  private_ip_google_access = true                     # essential for VMs without public IPs to reach Google APIs
}

# 3. Cloud Router — prerequisite for NAT
resource "google_compute_router" "main" {
  name    = "analytics-router"
  region  = var.region
  network = google_compute_network.main.id
}

# 4. Cloud NAT — outbound internet for private VMs
resource "google_compute_router_nat" "main" {
  name                               = "analytics-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"             # let GCP manage NAT IPs; switch to MANUAL_ONLY + reserved address for a fixed outbound IP
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.main.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"  # change to "ALL" temporarily when debugging NAT connectivity
  }
}

# 5. Firewall — IAP SSH (required for secure SSH without a bastion host)
resource "google_compute_firewall" "allow_ssh_iap" {
  name          = "analytics-allow-ssh-iap"
  network       = google_compute_network.main.name
  direction     = "INGRESS"
  priority      = 1000
  source_ranges = ["35.235.240.0/20"]  # GCP IAP proxy range — do not widen this
  target_tags   = ["iap-ssh"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

# 6. Firewall — deny all ingress (catch-all at lowest priority)
resource "google_compute_firewall" "deny_all_ingress" {
  name          = "analytics-deny-all-ingress"
  network       = google_compute_network.main.name
  direction     = "INGRESS"
  priority      = 65000      # lowest; evaluated last; only traffic not matched by rules above reaches here
  source_ranges = ["0.0.0.0/0"]

  deny {
    protocol = "all"  # drop everything that was not explicitly allowed
  }
}
```

---

### Quick Reference: Firewall Source Ranges

| Use case | Source range |
|---|---|
| IAP SSH / TCP tunneling | `35.235.240.0/20` |
| GCP health checkers (global LB) | `35.191.0.0/16` |
| GCP health checkers (regional LB) | `130.211.0.0/22` |
| All internet traffic | `0.0.0.0/0` |
| Same subnet only | `var.subnet_cidr` (e.g., `10.0.0.0/24`) |
| All RFC 1918 private ranges | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` |

### Quick Reference: Common Ports

| Service | Port | Protocol |
|---|---|---|
| SSH | 22 | TCP |
| HTTP | 80 | TCP |
| HTTPS | 443 | TCP |
| SQL Server | 1433 | TCP |
| PostgreSQL | 5432 | TCP |
| MySQL | 3306 | TCP |
| Airflow webserver | 8080 | TCP |
| Datadog APM | 8126 | TCP |
| Datadog StatsD | 8125 | UDP |
| Redis / Memorystore | 6379 | TCP |
| Elasticsearch | 9200 | TCP |

---

### Pitfalls and Notes

**VPC peering is non-transitive.** If A peers with B and B peers with C, A cannot reach C. You must create explicit peering between A and C if they need to communicate.

**Shared VPC IAM is required after attachment.** Creating `google_compute_shared_vpc_service_project` is not enough — the service project's Compute Engine service account still needs `roles/compute.networkUser` on the specific subnets it uses.

**Private Service Connect requires the API to be enabled.** Run `gcloud services enable servicenetworking.googleapis.com --project=YOUR_PROJECT` before applying the `google_service_networking_connection` resource or it will fail.

**`compact(concat(...))` is idiomatic for optional source ranges.** The pattern handles the case where an optional CIDR variable is set to an empty string — `compact()` removes empty strings before the list is used. This avoids the "invalid CIDR" error that would occur if an empty string were passed as a source range.

**Firewall rules without `target_tags` apply to ALL VMs in the VPC.** The deny-all rule intentionally omits `target_tags` so that it catches traffic to every VM. Allow rules should always use `target_tags` to limit their scope to only the VMs that need the access.

**Cloud NAT `AUTO_ONLY` vs `MANUAL_ONLY`.** `AUTO_ONLY` lets GCP assign ephemeral public IPs for NAT — these IPs can change. If external services need to allowlist your outbound IP (e.g., banking APIs, SaaS vendors), use `MANUAL_ONLY` with a `google_compute_address` resource and reference it in the `nat_ips` argument.

**Static IPs are billed when not attached.** GCP charges a small fee for reserved static IPs that are not in use. If you destroy a VM or load balancer that uses a static IP, either destroy the `google_compute_address` resource or reassign the IP immediately.
```
