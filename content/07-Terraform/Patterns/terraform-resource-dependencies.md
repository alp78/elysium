---
type: concept
category: infrastructure
technology: [terraform]
tags: [infrastructure, terraform]
aliases: [terraform dependencies, terraform dependency graph, depends_on, terraform parallelism, resource references]
keywords: [dependency graph, implicit dependency, explicit dependency, depends_on, resource reference, parallel creation, terraform plan order, ".id", ".name", ".email", "network_interface[0]"]
description: "How Terraform builds and resolves the resource dependency graph — implicit dependencies from resource references, explicit depends_on, and how parallelism works during apply."
related:
  - "[[terraform-resource-dependencies]]"
  - "[[terraform-conditional-resources]]"
  - "[[hcl-syntax-basics]]"
  - "[[terraform-plan-apply-destroy]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Resource Dependencies

Terraform automatically builds a dependency graph from your resource references. Understanding how it works prevents ordering issues during apply and explains why some resources are created in parallel while others wait. To practice dependency graph reasoning and other Terraform scenarios, work through [[terraform-problems]].

## How the Dependency Graph Works

When you reference one resource inside another (e.g., `network = google_compute_network.main.id`), Terraform records that dependency. During `apply`:

- Resources with no dependencies are created **immediately and in parallel**
- Resources with dependencies wait until all their dependencies are created
- Terraform maximizes parallelism — it never waits unnecessarily

This is fundamentally different from scripts where you control order with `&&`. Terraform computes the optimal creation order automatically.

---

## Implicit Dependencies — Resource References

The most common way to create a dependency is by referencing a resource attribute:

```hcl
resource "google_compute_subnetwork" "main" {
  name          = "data-pipeline-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id   # implicit dependency on VPC
}
```

`google_compute_network.main.id` tells Terraform: "this subnet needs the VPC to exist first, and I need its ID." Terraform will:
1. Create the VPC (`google_compute_network.main`)
2. Wait for the VPC to finish
3. Create the subnet with the resolved ID

#### .id, .name, .self_link — the three most common attribute references

| Reference pattern | What it gets |
|------------------|-------------|
| `resource_type.name.id` | The resource's full GCP resource path (e.g., `projects/data-pipeline-.../networks/data-pipeline-vpc`) |
| `resource_type.name.name` | The GCP-visible name (e.g., `data-pipeline-vpc`) |
| `resource_type.name.email` | For service accounts: `data-pipeline-pipeline@<project>.iam.gserviceaccount.com` |

---

## The Dependency Graph

Terraform automatically resolves dependencies from resource references. This is the effective creation order:

```
variables.tf (inputs)
    │
    ├── google_compute_network.main (VPC)
    │   ├── google_compute_subnetwork.main (subnet)
    │   ├── google_compute_router.main → google_compute_router_nat.main (NAT)
    │   └── google_compute_firewall.* (5 rules)
    │
    ├── google_service_account.* (pipeline, dashboard, airflow, ci, datadog)
    │   └── google_*_iam_member.* (all IAM bindings)
    │
    ├── google_secret_manager_secret.* → google_secret_manager_secret_version.*
    │
    ├── google_artifact_registry_repository.data-pipeline
    │
    ├── google_compute_instance.sql (depends on: subnet, pipeline SA)
    │   └── google_cloud_run_v2_service.dashboard (depends on: sql VM, subnet)
    │   └── google_cloud_run_v2_job.pipeline (depends on: sql VM, subnet)
    │   └── google_cloud_run_v2_job.setup (depends on: sql VM, subnet)
    │
    └── google_compute_instance.airflow (depends on: subnet, airflow SA)
```

Resources at the same level with no mutual references are created in parallel.

**Example of parallelism in the project:** Service accounts, the VPC, and the Artifact Registry all have no dependencies on each other. Terraform creates all of them simultaneously.

---

## Traversing Nested Attributes

Resource attributes can be nested. Use bracket notation for lists:

```hcl
locals {
  sql_ip   = google_compute_instance.sql.network_interface[0].network_ip
  airflow_ip = google_compute_instance.airflow.network_interface[0].access_config[0].nat_ip
}
```

#### resource.name.block[0].attribute — traversing nested attributes
- `google_compute_instance.sql` — the resource
- `.network_interface` — a list of network interfaces (most VMs have one)
- `[0]` — the first (and only) interface
- `.network_ip` — the private IP assigned from the subnet

For the Airflow VM's public IP:
- `.access_config` — a list of access configs (the empty `access_config {}` block in the Terraform config)
- `[0]` — the first access config
- `.nat_ip` — the ephemeral public IP assigned by GCP

These locals are then used in Cloud Run environment variables, so they create an implicit dependency chain: Cloud Run depends on the SQL VM existing (because it needs the private IP).

---

## Explicit Dependencies — depends_on

Sometimes a dependency exists that Terraform cannot see from references alone. Use `depends_on` explicitly:

```hcl
resource "google_project_iam_member" "pipeline_bq_access" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.pipeline.email}"

  depends_on = [google_service_account.pipeline]
  # Usually this reference creates the dependency implicitly.
  # Use explicit depends_on when Terraform misses the dependency.
}
```

#### depends_on — when to use explicit dependencies
- When a dependency exists through data that Terraform doesn't track (e.g., a secret value in an external system)
- When ordering is required but no attribute reference expresses it
- When a resource reads from another indirectly (e.g., via `data` sources)

> [!warning] depends_on Is a Last Resort
> Overusing `depends_on` creates unnecessary serialization, slowing down your apply. Use resource references wherever possible — they both express the dependency AND give you the attribute value.

---

## Viewing the Dependency Graph

Terraform can export the dependency graph in DOT format for visualization:

```bash
# Generate the dependency graph (requires graphviz installed)
terraform graph | dot -Tsvg > graph.svg

# Or just view the text output
terraform graph
```

The output shows every resource and every arrow between them. Useful when debugging unexpected resource ordering.

---

## Circular Dependencies

Terraform will fail with an error if it detects a circular dependency (A depends on B, B depends on A). This is usually a sign of a design problem. Common causes:

- Two resources that both reference each other's IDs
- A module that outputs a value that its own input variable depends on

**Fix:** Break the cycle by introducing an intermediate resource, or by restructuring which resource holds the reference.

---

## Resource Replacement vs In-Place Update

Some changes can be applied in-place (updating an attribute without recreating the resource). Others require destroying and recreating:

| Change type | Terraform behavior |
|------------|-------------------|
| Update `description` or `labels` | In-place update (`~`) |
| Change `machine_type` | Destroy + recreate (`-/+`) |
| Change `image` on boot_disk | Destroy + recreate (`-/+`) |
| Add a new `env` variable to Cloud Run | New revision created (zero-downtime) |

> [!warning] Forced Recreation Propagates
> If resource A is destroyed and recreated, any resource B that depends on A's ID will also be recreated (because A gets a new ID). This cascade can be surprising — destroying a VPC triggers recreation of all subnets, firewalls, VMs, and Cloud Run services that reference it.

## Related

- [[terraform-conditional-resources]] — how `count` and `for_each` interact with the dependency graph
- [[terraform-plan-apply-destroy]] — reading the plan to understand what will be created, updated, or destroyed
- [[hcl-syntax-basics]] — HCL syntax for resource references
- [[terraform-state-management]] — how state tracks the real resource IDs that references resolve to

## References

- [Terraform Resource Graph](https://developer.hashicorp.com/terraform/internals/graph)
- [Terraform depends_on](https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on)
