---
type: concept
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform variables, tfvars, terraform outputs, HCL variables, input variables]
keywords: [terraform, variables, outputs, tfvars, terraform.tfvars, variable types, sensitive, default, locals, TF_VAR, output values, terraform output command]
description: "How to define and use Terraform input variables (variables.tf) and output values (outputs.tf), including sensitive variables, defaults, and the locals vs variables distinction."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Variables and Outputs

> [!quote]
> "A good name is the best documentation."
>
> — **Dave Thomas & Andy Hunt**, *The Pragmatic Programmer* (1999)

Terraform's input variables and output values are the primary mechanism for making infrastructure configurations reusable and parameterized. Variables let callers supply values at runtime; outputs surface resource attributes after apply.

## Input Variables — variables.tf

Variables are Terraform's parameters. They are set via `terraform.tfvars` (gitignored), command-line flags (`-var`), or environment variables (`TF_VAR_*`).

#### variable "name" { type, default, description } — minimum declaration

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}
```

### Full Variable Set

The data pipeline project uses six variables covering project identity, network configuration, credentials, and optional integrations:

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all regional resources"
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "GCP zone for zonal resources (VMs)"
  type        = string
  default     = "europe-west1-b"
}

variable "db_password" {
  description = "SQL Server SA password"
  type        = string
  sensitive   = true
}

variable "admin_ip" {
  description = "Admin public IPv4 for Airflow UI access (empty = IAP only)"
  type        = string
  default     = ""
}

variable "dd_api_key" {
  description = "Datadog API key (empty = Datadog resources skipped)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "labels" {
  description = "Resource labels for cost tracking"
  type        = map(string)
  default     = { project = "data-pipeline", managed-by = "terraform" }
}
```

### Variable Reference Table

| Variable | Type | Default | Sensitive | Purpose |
|----------|------|---------|-----------|---------|
| `project_id` | `string` | *(none — required)* | No | GCP project ID. No default forces the user to explicitly provide it, preventing accidental deployment to the wrong project. |
| `region` | `string` | `europe-west1` | No | GCP region for all regional resources (Cloud Run, Artifact Registry, subnet). |
| `zone` | `string` | `europe-west1-b` | No | GCP zone for zonal resources (VMs). A zone is a physical datacenter within a region. |
| `db_password` | `string` | *(none — required)* | **Yes** | SQL Server SA password. Marked `sensitive = true` so Terraform never prints it in logs, plans, or state output. |
| `admin_ip` | `string` | `""` (empty) | No | When set, a firewall rule allows this IP to access the Airflow UI on port 8080. When empty, only IAP tunnel access is permitted. |
| `dd_api_key` | `string` | `""` (empty) | **Yes** | When empty, all Datadog-related resources are skipped entirely via `count = var.dd_api_key != "" ? 1 : 0`. |
| `labels` | `map(string)` | `{project="data-pipeline", managed-by="terraform"}` | No | Key-value labels applied to resources for cost tracking. |

### Key Concepts

**`type`** — Terraform's type system. `string` is text, `map(string)` is a dictionary of string key-value pairs. Types are enforced at plan time — passing a number where a string is expected fails immediately.

**`sensitive`** — When `true`, Terraform redacts the value from all CLI output. It still appears in the state file (which is why the state file itself must be secured — hence the GCS backend with access controls).

**`default`** — If a variable has no default, Terraform prompts for it interactively or fails if not provided via `tfvars`. Variables with defaults are optional.

### Setting Variable Values

#### terraform.tfvars — recommended variable values file (gitignored)

```hcl
project_id  = "data-platform-prod"
db_password = "YourSecurePassword"
admin_ip    = "203.0.113.42"
dd_api_key  = "your-datadog-key"
```

#### -var and -var-file — command-line variable overrides

```bash
terraform apply -var="project_id=data-platform-prod" -var="db_password=secret"
```

#### TF_VAR_ environment variables — set variables from shell

```bash
export TF_VAR_project_id="data-platform-prod"
export TF_VAR_db_password="secret"
terraform apply
```

> [!warning] Gitignore terraform.tfvars
>
> Always add `terraform.tfvars` to `.gitignore`. It contains passwords and API keys. If it is ever committed, rotate all credentials immediately.

### Locals — Computed Values

`locals` are derived values that cannot be overridden from outside the configuration. They are evaluated once after dependencies are resolved and are ideal for transforming resource attributes into reusable expressions.

```hcl
locals {
  registry = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.data-pipeline.repository_id}"
  sql_ip   = google_compute_instance.sql.network_interface[0].network_ip
  sql_user = "sa"
}
```

### locals vs variables Comparison

| | `locals` | `variables` (tfvars) |
|--|---------|---------------------|
| **Set by** | Computed from other resources | Static user input |
| **Overridable** | No — evaluated once internally | Yes — via `terraform.tfvars`, `-var`, or `TF_VAR_*` |
| **Use case** | Derived values like `sql_ip = google_compute_instance.sql.network_interface[0].network_ip` | Configuration inputs like `project_id`, `db_password` |
| **When evaluated** | During `apply`, after dependencies are resolved | Before `apply`, as input parameters |

---

## Output Values — outputs.tf

Outputs are **optional** — they don't affect resource creation. They surface values at the end of `terraform apply` and are queryable at any time with `terraform output`.

```text
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.

Outputs:

dashboard_url = "https://data-pipeline-dashboard-xxxxx-ew.a.run.app"
sql_vm_ip     = "10.0.0.2"
```

### Output Definitions

```hcl
output "dashboard_url" {
  value = google_cloud_run_v2_service.dashboard.uri
}

output "sql_vm_ip" {
  value = local.sql_ip
}

output "registry" {
  value = local.registry
}

output "airflow_ip" {
  value = google_compute_instance.airflow.network_interface[0].access_config[0].nat_ip
}

output "pipeline_job" {
  value = google_cloud_run_v2_job.pipeline.name
}

output "setup_job" {
  value = google_cloud_run_v2_job.setup.name
}
```

### Output Reference Table

| Output | Example Value | Purpose |
|--------|---------------|---------|
| `dashboard_url` | `https://data-pipeline-dashboard-gm73yy25cq-ew.a.run.app` | Public URL of the dashboard. |
| `sql_vm_ip` | `10.0.0.2` | SQL Server's private IP. Used in connection strings. |
| `registry` | `europe-west1-docker.pkg.dev/data-pipeline-.../data-pipeline` | Full registry path for `docker push`. |
| `airflow_ip` | `35.233.102.234` | Airflow VM's public IP (ephemeral — changes on restart). |
| `pipeline_job` | `data-pipeline-pipeline` | Job name for `gcloud run jobs execute data-pipeline-pipeline`. |
| `setup_job` | `data-pipeline-setup` | Job name for initial setup execution. |

The `airflow_ip` path `network_interface[0].access_config[0].nat_ip` navigates: first network interface → first access config → the NAT (public) IP assigned by GCP.

### Querying Outputs

```bash
# View all outputs after apply
terraform -chdir=infra output

# View a specific output value
terraform -chdir=infra output dashboard_url

# Output as JSON (useful for scripting)
terraform -chdir=infra output -json
```

> [!tip] Outputs without Re-applying
>
> You can retrieve outputs at any time without re-running `terraform apply`: `terraform -chdir=infra output`. This is useful for scripting CI/CD workflows that need the Cloud Run URL or VM IP without modifying infrastructure.

## Related

- [terraform-providers-and-backend](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-providers-and-backend) — how the backend and provider are configured
- [terraform-plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-plan-apply-destroy) — the workflow that uses these variables
- [terraform-conditional-resources](https://alp78.github.io/elysium/07-Terraform/Patterns/terraform-conditional-resources) — using variables with `count` to skip resources
- [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) — how `db_password` flows into Secret Manager
- [hcl-syntax-basics](https://alp78.github.io/elysium/07-Terraform/Fundamentals/hcl-syntax-basics) — HCL syntax fundamentals

## References

- [Terraform Input Variables](https://developer.hashicorp.com/terraform/language/values/variables)
- [Terraform Output Values](https://developer.hashicorp.com/terraform/language/values/outputs)
- [Terraform Local Values](https://developer.hashicorp.com/terraform/language/values/locals)
