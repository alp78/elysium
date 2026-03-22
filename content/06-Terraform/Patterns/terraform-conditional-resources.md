---
type: concept
category: infrastructure
technology: [terraform]
tags: [terraform, patterns, conditional, count, for_each, infrastructure-as-code]
aliases: [terraform conditional, terraform count, terraform for_each, optional resources terraform, terraform ternary]
keywords: [count, for_each, conditional resource creation, ternary operator, optional resources, "count = 0", "count = 1", conditional index notation, "resource[0]", compact, concat, terraform functions, dynamic blocks]
description: "How Terraform uses count and for_each to conditionally create resources or create multiple instances, enabling optional integrations (like Datadog) and parameterized infrastructure."
related:
  - "[[terraform-variables-and-outputs]]"
  - "[[terraform-resource-dependencies]]"
  - "[[terraform-iam-and-secrets]]"
  - "[[hcl-syntax-basics]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Conditional Resources

Terraform uses `count` for conditional resource creation and `for_each` for creating multiple instances from a collection. These are the primary mechanisms for parameterized, reusable infrastructure configurations.

## count — Conditional Creation

Terraform uses `count` for conditional creation:

```hcl
count = var.dd_api_key != "" ? 1 : 0   # 1 instance if key provided, 0 if not
```

When `count = 0`, the resource is not created at all. References to conditional resources use index notation: `google_service_account.datadog[0].email`.

### Real Example: Optional Datadog Integration

The data pipeline project makes Datadog entirely optional — when `dd_api_key` is empty, no Datadog resources are created:

```hcl
resource "google_service_account" "datadog" {
  count        = var.dd_api_key != "" ? 1 : 0
  account_id   = "data-pipeline-datadog"
  display_name = "Datadog GCP Integration"
}
```

All IAM bindings for Datadog also use `count`:

```hcl
resource "google_project_iam_member" "datadog_monitoring" {
  count   = var.dd_api_key != "" ? 1 : 0
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.datadog[0].email}"
}
```

Note the `[0]` index on `google_service_account.datadog[0].email` — when a resource uses `count`, you must index into it even when `count = 1`.

### Conditional Secret Version

The Datadog secret container is always created (so the slot exists), but the version (actual key value) is only created when the key is provided:

```hcl
resource "google_secret_manager_secret_version" "dd_api_key" {
  count       = var.dd_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.dd_api_key.id
  secret_data = var.dd_api_key
}
```

This pattern — always create the container, conditionally create the value — means enabling Datadog later requires only one `terraform apply`, not a refactor.

---

## Conditional Firewall with Dynamic IP

The Airflow UI firewall rule conditionally includes the admin's IP:

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
  target_tags = ["airflow"]
}
```

**Function chain breakdown:**

| Function | Input | Output |
|----------|-------|--------|
| `var.admin_ip != "" ? ["${var.admin_ip}/32"] : []` | `"203.0.113.42"` | `["203.0.113.42/32"]` |
| `var.admin_ip != "" ? ["${var.admin_ip}/32"] : []` | `""` | `[]` (empty list) |
| `concat(["35.235.240.0/20"], [...])` | Two lists | Merged list |
| `compact([...])` | List with possible empty strings | List with empty strings removed |

Result: `source_ranges` always contains IAP (`35.235.240.0/20`) and optionally the admin IP.

---

## for_each — Multiple Instances from a Collection

`for_each` creates one resource instance per element in a map or set:

```hcl
variable "environments" {
  default = {
    dev  = "europe-west1"
    prod = "europe-west1"
  }
}

resource "google_bigquery_dataset" "env_dataset" {
  for_each   = var.environments
  dataset_id = "pipeline_${each.key}"
  location   = each.value
}
```

This creates two datasets: `pipeline_dev` and `pipeline_prod`.

**Accessing for_each resources:**

```hcl
# Reference a specific instance
google_bigquery_dataset.env_dataset["prod"].dataset_id

# In outputs, iterate over all instances
output "dataset_ids" {
  value = { for k, v in google_bigquery_dataset.env_dataset : k => v.dataset_id }
}
```

---

## count vs for_each Comparison

| | `count` | `for_each` |
|--|---------|------------|
| **Use case** | Conditional (0 or 1) or simple repetition | Multiple instances with distinct identifiers |
| **Index** | Numeric: `resource[0]`, `resource[1]` | String key: `resource["dev"]`, `resource["prod"]` |
| **Removal behavior** | Removing an element renumbers all subsequent instances | Removing a key deletes only that instance |
| **Refactoring** | Risky — index shift destroys and recreates | Safe — key changes are explicit |

> [!warning] count Index Shift
> If you use `count = 3` to create 3 instances and then remove the first, Terraform renumbers index `[1]` to `[0]` and `[2]` to `[1]`, causing TWO resources to be destroyed and recreated. Use `for_each` with a map whenever the instances have distinct identities.

---

## Dynamic Blocks

For nested blocks that vary in count, use `dynamic`:

```hcl
resource "google_compute_firewall" "example" {
  name    = "allow-ports"
  network = google_compute_network.main.name

  dynamic "allow" {
    for_each = var.allowed_ports
    content {
      protocol = "tcp"
      ports    = [allow.value]
    }
  }

  source_ranges = ["0.0.0.0/0"]
}
```

With `var.allowed_ports = ["80", "443", "8080"]`, this creates three `allow` blocks.

---

## Ternary Operator Patterns

**String interpolation:**
```hcl
name = "data-pipeline-${var.environment == "prod" ? "api" : "api-dev"}"
```

**Boolean flag:**
```hcl
deletion_protection = var.environment == "prod" ? true : false
```

**Resource count based on variable:**
```hcl
count = var.enable_monitoring ? 1 : 0
```

**Nested ternary (use sparingly — becomes unreadable):**
```hcl
machine_type = var.environment == "prod" ? "e2-standard-4" : (var.environment == "staging" ? "e2-standard-2" : "e2-medium")
```

---

## Referencing Conditional Resources

When using `count`, always guard references with conditional expressions:

```hcl
# DON'T: This errors when count = 0 and datadog SA doesn't exist
member = "serviceAccount:${google_service_account.datadog.email}"

# DO: Use the [0] index and only reference when count > 0
resource "google_project_iam_member" "datadog_monitoring" {
  count   = var.dd_api_key != "" ? 1 : 0
  # ...
  member  = "serviceAccount:${google_service_account.datadog[0].email}"
}
```

---

## Summary: When to Use Each

| Scenario | Pattern |
|----------|---------|
| Optional integration (e.g., Datadog) | `count = var.api_key != "" ? 1 : 0` |
| Multiple environments (dev/prod) | `for_each = toset(["dev", "prod"])` |
| Conditional firewall rule IP | `compact(concat(base_ips, var.ip != "" ? [var.ip] : []))` |
| Multiple similar resources (e.g., datasets) | `for_each = var.dataset_map` |
| Variable number of nested blocks | `dynamic` block with `for_each` |

## Related

- [[terraform-variables-and-outputs]] — the variables that drive `count` conditions
- [[terraform-resource-dependencies]] — how Terraform resolves dependencies for conditional resources
- [[terraform-iam-and-secrets]] — real-world use of conditional Datadog resources
- [[terraform-networking]] — the conditional admin IP firewall rule

## References

- [Terraform count meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/count)
- [Terraform for_each meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/for_each)
- [Terraform dynamic blocks](https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks)
