---
type: reference
category: reference
technology: [terraform]
tags: [infrastructure, terraform, iac]
aliases: [Terraform cheat sheet, tf cheat sheet, Terraform quick reference]
keywords: [terraform, cheat sheet, quick reference, init, plan, apply, destroy, state, import, workspace, hcl]
description: "Exhaustive CLI reference for Terraform — every command, flag, HCL function, and common pattern in one place."
created: 2026-03-22
updated: 2026-03-23
status: stable
---

# Terraform Cheat Sheet

> [!quote]
> "Give me six hours to chop down a tree and I will spend the first four sharpening the axe."
> — **Abraham Lincoln**

Exhaustive CLI reference for Terraform. Every command, flag, HCL built-in function, and common coding pattern is documented here. Follow wikilinks for narrative explanations and deeper dives.

---

### CLI Anatomy

```
terraform [GLOBAL_OPTIONS] COMMAND [ARGS] [OPTIONS]
```

- **GLOBAL_OPTIONS** — flags that apply to every command (must come before the subcommand)
- **COMMAND** — the subcommand (init, plan, apply, …)
- **ARGS** — positional arguments required by a few commands (e.g. `import ADDRESS ID`)
- **OPTIONS** — command-specific flags (come after the subcommand)

---

### Global Options

These flags are accepted by every Terraform subcommand and must appear **before** the subcommand name.

| Flag | Type | Description |
|------|------|-------------|
| `-chdir=DIR` | string | Change the working directory to DIR before executing. Equivalent to `cd DIR && terraform …`. |
| `-help` | bool | Show help for the current command and exit. Also accessible as `terraform help COMMAND`. |
| `-version` | bool | Print the Terraform version and all provider versions, then exit. |
| `-no-color` | bool | Disable ANSI color codes in output. Useful for CI logs that do not support color. |

```bash
# Examples
terraform -version
terraform -no-color plan
terraform -chdir=environments/prod plan
terraform -help plan
```

---

## Core Workflow

```
init → validate → plan → apply → destroy
```

### terraform init

Downloads providers, initializes the backend, and installs modules. Must be run before any other command in a new workspace.

```
terraform init [OPTIONS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-backend=false` | bool | true | Skip backend initialization. State will remain local. |
| `-backend-config=PATH` | string | — | Path to a partial backend configuration file, or a `key=value` pair. May be repeated. Used to supply secrets (e.g. bucket name) without storing them in version control. |
| `-reconfigure` | bool | false | Ignore any existing `.terraform` directory and reconfigure from scratch. Does not migrate state. |
| `-migrate-state` | bool | false | Reconfigure the backend AND attempt to migrate existing state to the new backend. Mutually exclusive with `-reconfigure`. |
| `-upgrade` | bool | false | Upgrade all providers and modules to the latest version satisfying version constraints. |
| `-plugin-dir=PATH` | string | — | Override the plugin cache directory. May be repeated. Disables the registry. |
| `-lockfile=MODE` | string | `"update"` | Controls `.terraform.lock.hcl` behavior. Values: `update` (refresh lock file), `readonly` (fail if lock file would change — recommended in CI). |
| `-input=false` | bool | true | Disable interactive prompts for missing variables. |
| `-get=false` | bool | true | Skip downloading modules. |
| `-get-plugins=false` | bool | true | (deprecated) Skip downloading plugins. |

```bash
# Typical first run
terraform init

# CI — fail if lock file is out of date
terraform init -lockfile=readonly

# Reconfigure backend without migrating state
terraform init -reconfigure

# Migrate state to a new backend
terraform init -migrate-state

# Upgrade all providers
terraform init -upgrade

# Supply partial backend config at init time
terraform init \
  -backend-config="bucket=my-tfstate-bucket" \
  -backend-config="prefix=prod/terraform.tfstate"

# Offline init from local mirror
terraform init -plugin-dir=/opt/terraform-plugins
```

---

### terraform validate

Validates the syntax and internal consistency of Terraform configuration files. Does NOT access remote state or APIs.

```
terraform validate [OPTIONS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-json` | bool | false | Produce output in machine-readable JSON format. |
| `-no-color` | bool | false | Suppress color output. |

```bash
terraform validate
terraform validate -json
```

---

### terraform plan

Generates an execution plan showing what Terraform will do to reach the desired state. Does not make any changes.

```
terraform plan [OPTIONS]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-out=FILE` | string | — | Save the plan to FILE. Pass FILE to `terraform apply` to execute exactly this plan. |
| `-var='KEY=VALUE'` | string | — | Set a variable. May be repeated. |
| `-var-file=FILE` | string | — | Load variables from FILE (`.tfvars` or `.tfvars.json`). May be repeated. |
| `-target=ADDR` | string | — | Limit the plan to ADDR and its dependencies. May be repeated. |
| `-replace=ADDR` | string | — | Force replacement (destroy + create) of ADDR even if no changes detected. May be repeated. |
| `-refresh-only` | bool | false | Create a plan that only updates state to match real infrastructure — no resource changes. |
| `-refresh=false` | bool | true | Skip querying real infrastructure. Uses cached state. Faster but may be inaccurate. |
| `-destroy` | bool | false | Create a destroy plan (equivalent of `terraform destroy -target=…`). |
| `-parallelism=N` | int | 10 | Maximum number of concurrent operations. |
| `-lock=false` | bool | true | Disable state locking. Use only in emergency; risks state corruption. |
| `-lock-timeout=DURATION` | string | `"0s"` | Retry acquiring the lock for up to DURATION (e.g. `"30s"`, `"5m"`). |
| `-detailed-exitcode` | bool | false | Return exit code 2 when there are changes to apply (instead of 0). Useful in CI pipelines. |
| `-generate-config-out=FILE` | string | — | (TF 1.5+) When importing via `import` blocks, write generated HCL to FILE. |
| `-input=false` | bool | true | Disable interactive prompts. |
| `-no-color` | bool | false | Disable color output. |
| `-json` | bool | false | Produce JSON output (machine-readable). |
| `-compact-warnings` | bool | false | Show warnings as a summary rather than full detail. |

```bash
# Basic plan
terraform plan

# Save plan for later apply
terraform plan -out=tfplan

# Plan with variable overrides
terraform plan -var="project_id=my-project" -var-file="prod.tfvars"

# Target a single resource
terraform plan -target=google_compute_instance.web

# Force replacement
terraform plan -replace=google_compute_instance.web

# Refresh-only (detect drift without changing anything)
terraform plan -refresh-only

# Destroy plan
terraform plan -destroy

# CI-friendly: exit code 2 if changes exist
terraform plan -detailed-exitcode -out=tfplan
echo "Exit code: $?"   # 0=no changes, 1=error, 2=changes pending

# Generate HCL from import blocks (TF 1.5+)
terraform plan -generate-config-out=generated.tf
```

#### terraform plan — full anatomy of a plan invocation

```
terraform \
  -chdir=environments/prod \          # GLOBAL: working directory
  plan \                              # COMMAND
  -out=tfplan \                       # save plan artifact
  -var-file=prod.tfvars \             # variable overrides
  -var="image_tag=v1.2.3" \           # inline variable
  -target=google_cloud_run_v2_job.etl \ # scope to one resource
  -parallelism=20 \                   # concurrency
  -lock-timeout=60s \                 # retry lock acquisition
  -detailed-exitcode \                # CI exit codes
  -no-color                           # no ANSI for CI logs
```

---

### terraform apply

Executes the changes described in a plan (or generates + applies a new plan interactively).

```
terraform apply [OPTIONS] [PLANFILE]
```

Accepts all flags that `plan` accepts **except** `-out`. Additional apply-specific flags:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-auto-approve` | bool | false | Skip the interactive confirmation prompt. Required in non-interactive environments. |
| `PLANFILE` | positional | — | Path to a saved plan file produced by `terraform plan -out`. When provided, all plan-phase flags are ignored (the plan is already decided). |

```bash
# Interactive apply (prompts for confirmation)
terraform apply

# Non-interactive (CI/CD)
terraform apply -auto-approve

# Apply a saved plan exactly
terraform apply tfplan

# Apply with variable overrides (generates a new plan)
terraform apply -var="project_id=my-project" -auto-approve

# Apply only a specific resource
terraform apply -target=google_storage_bucket.data -auto-approve

# Apply with forced replacement
terraform apply -replace=google_compute_instance.bastion -auto-approve
```

#### terraform apply — full anatomy of an apply invocation

```
terraform \
  -chdir=environments/prod \
  apply \
  -auto-approve \
  -var-file=prod.tfvars \
  -parallelism=20 \
  -lock-timeout=60s \
  -no-color \
  tfplan                  # apply the saved plan
```

---

### terraform destroy

Destroys all resources managed by the current configuration. Equivalent to `terraform apply -destroy`.

```
terraform destroy [OPTIONS]
```

Accepts the same flags as `apply` (including `-auto-approve`, `-target`, `-var`, `-var-file`, `-parallelism`, `-lock`, etc.).

```bash
# Destroy everything (interactive confirmation)
terraform destroy

# Destroy without confirmation (dangerous)
terraform destroy -auto-approve

# Destroy only a specific resource
terraform destroy -target=google_compute_instance.bastion

# Destroy with variable file
terraform destroy -var-file=prod.tfvars -auto-approve
```

---

## State Commands

State commands manipulate the Terraform state file directly. Use with care — mistakes here can orphan or duplicate resources.

See [terraform-state-management](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-state-management) for narrative context.

### terraform state list

List all resource addresses tracked in state.

```
terraform state list [OPTIONS] [ADDRESS...]
```

| Flag | Description |
|------|-------------|
| `-state=FILE` | Use FILE as state instead of the configured backend. |
| `-id=ID` | Filter by provider-assigned resource ID. |

```bash
# List all resources
terraform state list

# List only Cloud Run resources
terraform state list | grep google_cloud_run

# Filter by resource ID
terraform state list -id=projects/my-project/regions/europe-west1/services/my-svc

# List resources matching an address prefix
terraform state list 'module.network.*'
```

---

### terraform state show

Display the attributes of a single resource as stored in state.

```
terraform state show [OPTIONS] ADDRESS
```

| Flag | Description |
|------|-------------|
| `-state=FILE` | Read from FILE instead of the configured backend. |

```bash
terraform state show google_compute_instance.web
terraform state show 'module.gke.google_container_cluster.primary'
terraform state show 'google_bigquery_dataset.analytics["eu"]'
```

---

### terraform state mv

Rename or move a resource within state (e.g. after a refactor). Does NOT touch real infrastructure.

```
terraform state mv [OPTIONS] SOURCE DESTINATION
```

| Flag | Description |
|------|-------------|
| `-backup=FILE` | Write a backup of state to FILE before modifying. |
| `-state=FILE` | Read/write FILE instead of the configured backend. |
| `-dry-run` | Show what would change without making changes. |

```bash
# Rename a resource
terraform state mv google_compute_instance.old google_compute_instance.new

# Move resource into a module
terraform state mv google_storage_bucket.raw 'module.storage.google_storage_bucket.raw'

# Move resource out of a module
terraform state mv 'module.storage.google_storage_bucket.raw' google_storage_bucket.raw

# Dry run first
terraform state mv -dry-run google_compute_instance.old google_compute_instance.new
```

---

### terraform state rm

Remove a resource from state without destroying it in real infrastructure. The resource becomes unmanaged by Terraform.

```
terraform state rm [OPTIONS] ADDRESS...
```

| Flag | Description |
|------|-------------|
| `-backup=FILE` | Write a backup of state before removing. |
| `-dry-run` | Show what would be removed without making changes. |

```bash
# Remove a single resource
terraform state rm google_compute_instance.legacy

# Remove multiple resources
terraform state rm google_compute_instance.legacy google_storage_bucket.old

# Remove all resources in a module
terraform state rm 'module.old_network'

# Dry run
terraform state rm -dry-run google_compute_instance.legacy
```

---

### terraform state pull

Download and print the current state to stdout as JSON.

```
terraform state pull
```

```bash
# Print state
terraform state pull

# Save state to a local file
terraform state pull > terraform.tfstate.backup

# Inspect a specific resource using jq
terraform state pull | jq '.resources[] | select(.type == "google_compute_instance")'
```

---

### terraform state push

Upload a local state file to the configured backend. Use with extreme caution — this overwrites remote state.

```
terraform state push [OPTIONS] FILE
```

| Flag | Description |
|------|-------------|
| `-force` | Push even if the serial number does not match (risky). |

```bash
terraform state push terraform.tfstate.backup
terraform state push -force terraform.tfstate.repaired
```

---

### terraform state replace-provider

Replace the provider source for all resources that currently use one provider with a different provider. Used when migrating from a community to an official provider.

```
terraform state replace-provider [OPTIONS] FROM TO
```

| Flag | Description |
|------|-------------|
| `-auto-approve` | Skip confirmation prompt. |
| `-backup=FILE` | Write state backup to FILE. |

```bash
# Migrate from hashicorp/google to registry.terraform.io/hashicorp/google
terraform state replace-provider \
  'registry.terraform.io/hashicorp/google-beta' \
  'registry.terraform.io/hashicorp/google'
```

---

## Resource Targeting

Targeting lets you scope a `plan`, `apply`, or `destroy` operation to one or more specific resources and their dependencies/dependents.

### -target syntax

```
-target=RESOURCE_TYPE.RESOURCE_NAME
-target=module.MODULE_NAME
-target=module.MODULE_NAME.RESOURCE_TYPE.RESOURCE_NAME
-target='RESOURCE_TYPE.RESOURCE_NAME["KEY"]'   # for_each key — quotes required in most shells
-target='RESOURCE_TYPE.RESOURCE_NAME[INDEX]'   # count index
```

```bash
# Single VM
terraform plan -target=google_compute_instance.bastion

# Entire module
terraform plan -target=module.network

# Resource inside a module
terraform plan -target=module.gke.google_container_cluster.primary

# for_each resource with string key
terraform plan -target='google_bigquery_dataset.datasets["analytics"]'

# count resource at index 0
terraform plan -target='google_compute_instance.workers[0]'

# Multiple targets
terraform apply \
  -target=google_compute_instance.web \
  -target=google_storage_bucket.assets \
  -auto-approve
```

### -replace syntax

Forces a resource to be destroyed and recreated even when Terraform would otherwise make an in-place update.

```bash
terraform plan -replace=google_compute_instance.web
terraform apply -replace=google_compute_instance.web -auto-approve

# Combination: replace inside a module
terraform apply \
  -replace='module.gke.google_container_node_pool.primary_nodes' \
  -auto-approve
```

---

## Import

Bring existing infrastructure under Terraform management by linking a real resource to a state address.

### CLI import (TF < 1.5 style, still valid)

```
terraform import [OPTIONS] ADDRESS ID
```

| Flag | Description |
|------|-------------|
| `-var='KEY=VALUE'` | Set a variable (may be repeated). |
| `-var-file=FILE` | Load variables from FILE. |
| `-input=false` | Disable interactive prompts. |
| `-lock=false` | Disable state locking. |
| `-lock-timeout=DURATION` | Retry lock for DURATION. |
| `-no-color` | Disable color output. |
| `-allow-missing-config` | Import even if no corresponding config block exists (creates a dangling state entry). |

#### terraform import — full anatomy of an import invocation

```
terraform \
  -chdir=environments/prod \           # GLOBAL: working directory
  import \                             # COMMAND
  -var-file=prod.tfvars \              # supply variables needed by provider
  -lock-timeout=30s \                  # retry lock acquisition
  -no-color \                          # CI-friendly output
  google_compute_instance.web \        # ADDRESS: where in state to place it
  projects/my-project/zones/europe-west1-b/instances/my-vm   # ID: provider-specific
```

### Import ID format by GCP resource type

| Resource type | Example import ID |
|---------------|-------------------|
| `google_compute_instance` | `projects/PROJECT/zones/ZONE/instances/INSTANCE` |
| `google_compute_network` | `projects/PROJECT/global/networks/NETWORK` |
| `google_compute_subnetwork` | `projects/PROJECT/regions/REGION/subnetworks/SUBNET` |
| `google_compute_firewall` | `projects/PROJECT/global/firewalls/FIREWALL` |
| `google_storage_bucket` | `BUCKET_NAME` |
| `google_bigquery_dataset` | `projects/PROJECT/datasets/DATASET` |
| `google_bigquery_table` | `projects/PROJECT/datasets/DATASET/tables/TABLE` |
| `google_pubsub_topic` | `projects/PROJECT/topics/TOPIC` |
| `google_pubsub_subscription` | `projects/PROJECT/subscriptions/SUBSCRIPTION` |
| `google_cloud_run_v2_service` | `projects/PROJECT/locations/REGION/services/SERVICE` |
| `google_cloud_run_v2_job` | `projects/PROJECT/locations/REGION/jobs/JOB` |
| `google_service_account` | `projects/PROJECT/serviceAccounts/SA_EMAIL` |
| `google_project_iam_member` | `PROJECT ROLE member` (space-separated) |
| `google_secret_manager_secret` | `projects/PROJECT/secrets/SECRET` |
| `google_secret_manager_secret_version` | `projects/PROJECT/secrets/SECRET/versions/VERSION` |
| `google_container_cluster` | `projects/PROJECT/locations/LOCATION/clusters/CLUSTER` |
| `google_container_node_pool` | `projects/PROJECT/locations/LOCATION/clusters/CLUSTER/nodePools/POOL` |
| `google_sql_database_instance` | `projects/PROJECT/instances/INSTANCE` |
| `google_redis_instance` | `projects/PROJECT/locations/REGION/instances/INSTANCE` |
| `google_artifact_registry_repository` | `projects/PROJECT/locations/REGION/repositories/REPO` |
| `google_logging_project_sink` | `projects/PROJECT/sinks/SINK` |

```bash
# Examples
terraform import google_compute_instance.web \
  projects/my-project/zones/europe-west1-b/instances/my-vm

terraform import google_storage_bucket.raw my-raw-bucket

terraform import google_bigquery_dataset.analytics \
  projects/my-project/datasets/analytics

terraform import google_pubsub_topic.events \
  projects/my-project/topics/events

terraform import google_cloud_run_v2_job.etl \
  projects/my-project/locations/europe-west1/jobs/etl-job

terraform import google_service_account.deployer \
  projects/my-project/serviceAccounts/deployer@my-project.iam.gserviceaccount.com

terraform import google_secret_manager_secret.db_password \
  projects/my-project/secrets/db-password
```

---

### Import block (TF 1.5+)

Declarative import — define the import in HCL so it is version-controlled and repeatable.

```hcl
# import.tf
import {
  to = google_compute_instance.web
  id = "projects/my-project/zones/europe-west1-b/instances/my-vm"
}

import {
  to = google_storage_bucket.raw
  id = "my-raw-bucket"
}
```

Then run:

```bash
# Generate the resource config automatically (TF 1.5+)
terraform plan -generate-config-out=generated.tf

# Review generated.tf, then apply
terraform apply
```

After the first successful apply, remove the `import` blocks — they are no longer needed.

---

### Workspace Commands

Workspaces allow multiple state files in the same configuration. Useful for lightweight environment separation (though module-per-environment is often preferred for production).

```
terraform workspace SUBCOMMAND [OPTIONS] [NAME]
```

| Subcommand | Description |
|------------|-------------|
| `list` | List all workspaces. The active workspace is marked with `*`. |
| `new NAME` | Create and switch to a new workspace named NAME. |
| `select NAME` | Switch to an existing workspace named NAME. |
| `show` | Print the name of the current workspace. |
| `delete NAME` | Delete workspace NAME (must not be active; state must be empty or `-force`). |

```bash
# List workspaces
terraform workspace list

# Create dev workspace and switch to it
terraform workspace new dev

# Switch to prod
terraform workspace select prod

# Show current workspace
terraform workspace show

# Delete an unused workspace
terraform workspace delete dev

# Force-delete a workspace with state
terraform workspace delete -force dev
```

Reference the current workspace in HCL:

```hcl
locals {
  env = terraform.workspace   # "default", "dev", "prod", …
}

resource "google_storage_bucket" "data" {
  name = "myapp-${local.env}-data"
}
```

---

## Output and Formatting Commands

### terraform output

Print output values from state.

```
terraform output [OPTIONS] [NAME]
```

| Flag | Description |
|------|-------------|
| `-json` | Print all outputs as a JSON object. |
| `-raw` | Print a single output value with no quoting (useful in shell scripts). |
| `-no-color` | Disable color. |
| `-state=FILE` | Read outputs from FILE instead of the configured backend. |

```bash
# Print all outputs
terraform output

# Print a specific output
terraform output bucket_name

# Raw value for scripting
terraform output -raw bucket_name

# JSON for scripting
terraform output -json

# Extract one field with jq
terraform output -json | jq -r '.bucket_name.value'
```

---

### terraform console

Open an interactive REPL to evaluate HCL expressions against the current state and variables.

```
terraform console [OPTIONS]
```

| Flag | Description |
|------|-------------|
| `-var='KEY=VALUE'` | Set a variable. |
| `-var-file=FILE` | Load variables from FILE. |
| `-state=FILE` | Read state from FILE. |

```bash
terraform console

# Inside the REPL:
> 2 + 2
4
> format("hello %s", "world")
"hello world"
> length(["a","b","c"])
3
> cidrsubnet("10.0.0.0/16", 8, 1)
"10.0.1.0/24"
> exit
```

---

### terraform fmt

Format HCL files to the canonical style. Rewrites files in place.

```
terraform fmt [OPTIONS] [DIR|FILE]
```

| Flag | Description |
|------|-------------|
| `-recursive` | Also format files in subdirectories. |
| `-check` | Return a non-zero exit code if any files need formatting (do not write). Useful in CI. |
| `-diff` | Display a diff of changes instead of writing files. |
| `-list=false` | Do not list formatted files. |
| `-write=false` | Do not write files; only check or show diff. |

```bash
# Format current directory
terraform fmt

# Format recursively
terraform fmt -recursive

# CI: fail if any file is not formatted
terraform fmt -check -recursive

# Show what would change
terraform fmt -diff
```

---

### terraform graph

Generate a DOT-format dependency graph of resources.

```
terraform graph [OPTIONS]
```

| Flag | Description |
|------|-------------|
| `-type=TYPE` | Graph type: `plan`, `plan-destroy`, `apply`, `validate`, `input`, `refresh`. Default: `apply`. |
| `-draw-cycles` | Highlight cycles in the graph (useful for debugging). |
| `-plan=FILE` | Use the plan at FILE instead of generating a new one. |

```bash
terraform graph | dot -Tsvg > graph.svg
terraform graph -type=plan | dot -Tpng > plan.png
```

---

### terraform show

Print human-readable output from a plan file or the current state.

```
terraform show [OPTIONS] [PLANFILE|STATEFILE]
```

| Flag | Description |
|------|-------------|
| `-json` | Output in JSON format. |
| `-no-color` | Disable color. |

```bash
# Show current state
terraform show

# Show a saved plan
terraform show tfplan

# JSON output for scripting
terraform show -json tfplan | jq '.resource_changes[].change.actions'
```

---

## Provider and Module Commands

### terraform providers

Print a tree of provider requirements for the current configuration.

```
terraform providers [OPTIONS]
```

```bash
terraform providers
terraform providers lock        # Update the lock file
terraform providers mirror DIR  # Download providers to DIR for air-gapped use
terraform providers schema -json > providers_schema.json
```

### terraform force-unlock

Manually release a stuck state lock. Use only when certain that no other operation is running.

```
terraform force-unlock [OPTIONS] LOCK_ID
```

| Flag | Description |
|------|-------------|
| `-force` | Skip the interactive confirmation prompt. |

```bash
terraform force-unlock 5e4d6f78-abcd-1234-efgh-000000000000
terraform force-unlock -force 5e4d6f78-abcd-1234-efgh-000000000000
```

### terraform get

Download and install modules referenced in configuration. `terraform init` does this automatically; use `terraform get` to refresh modules without reinitializing the backend.

```
terraform get [OPTIONS]
```

| Flag | Description |
|------|-------------|
| `-update` | Check for newer versions of installed modules. |

```bash
terraform get
terraform get -update
```

### terraform taint / untaint (deprecated in TF 0.15.2+)

Use `-replace` flag on `plan`/`apply` instead.

```bash
# Old way (deprecated)
terraform taint google_compute_instance.web
terraform untaint google_compute_instance.web

# New way (preferred)
terraform apply -replace=google_compute_instance.web
```

### terraform login / logout

Authenticate with Terraform Cloud / HCP Terraform.

```bash
terraform login
terraform login app.terraform.io
terraform logout
terraform logout app.terraform.io
```

---

## HCL Functions Reference

All functions are available in any HCL expression context. Test them interactively with `terraform console`.

### String Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `format` | `format(spec, args…)` | `format("%-10s %d", "id", 42)` | `"id         42"` |
| `join` | `join(sep, list)` | `join(", ", ["a","b","c"])` | `"a, b, c"` |
| `split` | `split(sep, str)` | `split(",", "a,b,c")` | `["a","b","c"]` |
| `replace` | `replace(str, search, replace)` | `replace("hello world", "world", "HCL")` | `"hello HCL"` |
| `trimspace` | `trimspace(str)` | `trimspace("  hi  ")` | `"hi"` |
| `lower` | `lower(str)` | `lower("Hello")` | `"hello"` |
| `upper` | `upper(str)` | `upper("hello")` | `"HELLO"` |
| `regex` | `regex(pattern, str)` | `regex("[0-9]+", "abc123")` | `"123"` |
| `regexall` | `regexall(pattern, str)` | `regexall("[0-9]+", "a1b22")` | `["1","22"]` |
| `substr` | `substr(str, offset, length)` | `substr("hello", 1, 3)` | `"ell"` |
| `startswith` | `startswith(str, prefix)` | `startswith("terraform", "terra")` | `true` |
| `endswith` | `endswith(str, suffix)` | `endswith("main.tf", ".tf")` | `true` |
| `title` | `title(str)` | `title("hello world")` | `"Hello World"` |
| `indent` | `indent(spaces, str)` | `indent(2, "a\nb")` | `"a\n  b"` |
| `chomp` | `chomp(str)` | `chomp("hello\n")` | `"hello"` |
| `trimprefix` | `trimprefix(str, prefix)` | `trimprefix("hello", "hel")` | `"lo"` |
| `trimsuffix` | `trimsuffix(str, suffix)` | `trimsuffix("hello", "lo")` | `"hel"` |

---

### Collection Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `length` | `length(collection)` | `length(["a","b","c"])` | `3` |
| `lookup` | `lookup(map, key, default)` | `lookup({a=1}, "b", 0)` | `0` |
| `merge` | `merge(maps…)` | `merge({a=1},{b=2})` | `{a=1,b=2}` |
| `keys` | `keys(map)` | `keys({a=1,b=2})` | `["a","b"]` |
| `values` | `values(map)` | `values({a=1,b=2})` | `[1,2]` |
| `flatten` | `flatten(list)` | `flatten([[1,2],[3]])` | `[1,2,3]` |
| `distinct` | `distinct(list)` | `distinct(["a","b","a"])` | `["a","b"]` |
| `concat` | `concat(lists…)` | `concat(["a"],["b","c"])` | `["a","b","c"]` |
| `element` | `element(list, index)` | `element(["a","b","c"], 1)` | `"b"` |
| `contains` | `contains(list, value)` | `contains(["a","b"], "a")` | `true` |
| `zipmap` | `zipmap(keys, values)` | `zipmap(["a","b"],[1,2])` | `{a=1,b=2}` |
| `toset` | `toset(list)` | `toset(["a","b","a"])` | `{"a","b"}` |
| `tolist` | `tolist(set)` | `tolist(toset(["b","a"]))` | `["a","b"]` |
| `tomap` | `tomap(object)` | `tomap({a="x",b="y"})` | `{a="x",b="y"}` |
| `index` | `index(list, value)` | `index(["a","b","c"],"b")` | `1` |
| `slice` | `slice(list, start, end)` | `slice(["a","b","c"],1,3)` | `["b","c"]` |
| `reverse` | `reverse(list)` | `reverse([1,2,3])` | `[3,2,1]` |
| `sort` | `sort(list)` | `sort(["c","a","b"])` | `["a","b","c"]` |
| `chunklist` | `chunklist(list, size)` | `chunklist([1,2,3,4],2)` | `[[1,2],[3,4]]` |
| `transpose` | `transpose(map_of_lists)` | `transpose({a=["x","y"]})` | `{x=["a"],y=["a"]}` |
| `matchkeys` | `matchkeys(vals, keys, search)` | see docs | filtered list |
| `one` | `one(list)` | `one(["a"])` | `"a"` |
| `range` | `range(start, limit, step)` | `range(0, 4, 1)` | `[0,1,2,3]` |
| `alltrue` | `alltrue(list)` | `alltrue([true,true])` | `true` |
| `anytrue` | `anytrue(list)` | `anytrue([false,true])` | `true` |

---

### Numeric Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `min` | `min(numbers…)` | `min(3,1,2)` | `1` |
| `max` | `max(numbers…)` | `max(3,1,2)` | `3` |
| `ceil` | `ceil(number)` | `ceil(1.2)` | `2` |
| `floor` | `floor(number)` | `floor(1.9)` | `1` |
| `abs` | `abs(number)` | `abs(-5)` | `5` |
| `signum` | `signum(number)` | `signum(-3)` | `-1` |
| `log` | `log(number, base)` | `log(8, 2)` | `3` |
| `pow` | `pow(base, exp)` | `pow(2, 10)` | `1024` |
| `parseint` | `parseint(str, base)` | `parseint("ff", 16)` | `255` |

---

### Date/Time Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `timestamp` | `timestamp()` | `timestamp()` | `"2026-03-23T00:00:00Z"` |
| `formatdate` | `formatdate(spec, timestamp)` | `formatdate("YYYY-MM-DD", timestamp())` | `"2026-03-23"` |
| `timeadd` | `timeadd(timestamp, duration)` | `timeadd(timestamp(), "24h")` | tomorrow's timestamp |
| `timecmp` | `timecmp(ts_a, ts_b)` | `timecmp("2026-01-01T00:00:00Z","2025-01-01T00:00:00Z")` | `1` |

---

### Filesystem Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `file` | `file(path)` | `file("${path.module}/script.sh")` | file contents as string |
| `filebase64` | `filebase64(path)` | `filebase64("cert.pem")` | base64-encoded file |
| `templatefile` | `templatefile(path, vars)` | `templatefile("startup.sh.tpl", {project=var.project})` | rendered template string |
| `fileset` | `fileset(base, pattern)` | `fileset("${path.module}/sql", "*.sql")` | set of matching filenames |
| `fileexists` | `fileexists(path)` | `fileexists("optional.tf")` | bool |
| `pathexpand` | `pathexpand("~/.kube/config")` | — | expanded path string |

---

### Encoding Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `jsonencode` | `jsonencode(value)` | `jsonencode({a=1})` | `"{\"a\":1}"` |
| `jsondecode` | `jsondecode(str)` | `jsondecode("{\"a\":1}")` | object `{a=1}` |
| `yamlencode` | `yamlencode(value)` | `yamlencode({a=1,b="x"})` | YAML string |
| `yamldecode` | `yamldecode(str)` | `yamldecode(file("config.yaml"))` | HCL object |
| `base64encode` | `base64encode(str)` | `base64encode("hello")` | `"aGVsbG8="` |
| `base64decode` | `base64decode(str)` | `base64decode("aGVsbG8=")` | `"hello"` |
| `base64gzip` | `base64gzip(str)` | `base64gzip(file("big.txt"))` | gzip+base64 |
| `csvdecode` | `csvdecode(str)` | `csvdecode(file("data.csv"))` | list of maps |
| `textencodebase64` | `textencodebase64(str, enc)` | `textencodebase64("hi","UTF-16LE")` | base64 of re-encoded string |
| `urlencode` | `urlencode(str)` | `urlencode("hello world")` | `"hello+world"` |

---

### IP / CIDR Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `cidrsubnet` | `cidrsubnet(prefix, newbits, netnum)` | `cidrsubnet("10.0.0.0/16", 8, 1)` | `"10.0.1.0/24"` |
| `cidrhost` | `cidrhost(prefix, hostnum)` | `cidrhost("10.0.1.0/24", 5)` | `"10.0.1.5"` |
| `cidrnetmask` | `cidrnetmask(prefix)` | `cidrnetmask("10.0.0.0/16")` | `"255.255.0.0"` |
| `cidrsubnets` | `cidrsubnets(prefix, newbits…)` | `cidrsubnets("10.0.0.0/8",8,8,8)` | list of 3 subnets |
| `cidrcontains` | `cidrcontains(cidr, ip)` | `cidrcontains("10.0.0.0/8","10.1.2.3")` | `true` |

---

### Crypto / Hash Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `sha256` | `sha256(str)` | `sha256("hello")` | hex SHA-256 digest |
| `sha512` | `sha512(str)` | `sha512("hello")` | hex SHA-512 digest |
| `sha1` | `sha1(str)` | `sha1("hello")` | hex SHA-1 digest |
| `md5` | `md5(str)` | `md5("hello")` | hex MD5 digest |
| `uuid` | `uuid()` | `uuid()` | random UUID v4 string |
| `uuidv5` | `uuidv5(namespace, name)` | `uuidv5("dns","example.com")` | deterministic UUID v5 |
| `bcrypt` | `bcrypt(str, cost?)` | `bcrypt("pass",10)` | bcrypt hash (avoid in state) |
| `filesha256` | `filesha256(path)` | `filesha256("lambda.zip")` | SHA-256 of file |
| `filemd5` | `filemd5(path)` | `filemd5("object.bin")` | MD5 of file |

---

### Type Conversion and Safety Functions

| Function | Signature | Example | Result |
|----------|-----------|---------|--------|
| `try` | `try(exprs…)` | `try(var.opt.field, "default")` | first non-erroring expression |
| `can` | `can(expr)` | `can(tonumber(var.x))` | `true` if expr succeeds |
| `nonsensitive` | `nonsensitive(value)` | `nonsensitive(var.password)` | strips sensitive marking |
| `sensitive` | `sensitive(value)` | `sensitive(local.token)` | marks value as sensitive |
| `tostring` | `tostring(value)` | `tostring(42)` | `"42"` |
| `tonumber` | `tonumber(value)` | `tonumber("3.14")` | `3.14` |
| `tobool` | `tobool(value)` | `tobool("true")` | `true` |
| `type` | `type(value)` | (console only) | prints type of value |

---

## Common Patterns

These patterns recur in almost every real-world configuration. Each is shown as a minimal, copy-pasteable snippet.

### Conditional resource (count)

Create the resource only when a condition is true.

```hcl
resource "google_compute_instance" "bastion" {
  count = var.enable_bastion ? 1 : 0
  name  = "bastion"
  # …
}
```

Reference it safely: `google_compute_instance.bastion[0].name` (only when `enable_bastion = true`).

---

### Conditional resource (for_each)

Use an empty set to disable a resource cleanly.

```hcl
resource "google_storage_bucket" "backup" {
  for_each = var.enable_backup ? toset(["backup"]) : toset([])
  name     = "myapp-${each.key}"
}
```

---

### Conditional attribute

Omit or set an attribute based on a condition.

```hcl
resource "google_cloud_run_v2_service" "app" {
  name     = "my-app"
  location = var.region

  template {
    containers {
      image = var.image

      # Only set CPU limit when performance tier is requested
      resources {
        limits = var.high_perf ? { cpu = "4", memory = "8Gi" } : { cpu = "1", memory = "512Mi" }
      }
    }
  }
}
```

---

### for_each from a list

Convert a list to a set so for_each can use it.

```hcl
variable "regions" {
  type    = list(string)
  default = ["europe-west1", "us-central1"]
}

resource "google_pubsub_topic" "regional" {
  for_each = toset(var.regions)
  name     = "events-${each.key}"
}
```

---

### for_each from a map

When you need both a key and structured attributes per item.

```hcl
variable "buckets" {
  type = map(object({
    location      = string
    storage_class = string
  }))
  default = {
    raw  = { location = "EU",   storage_class = "STANDARD" }
    cold = { location = "EU",   storage_class = "COLDLINE"  }
  }
}

resource "google_storage_bucket" "store" {
  for_each      = var.buckets
  name          = "myapp-${each.key}"
  location      = each.value.location
  storage_class = each.value.storage_class
}
```

---

### Dynamic blocks

Avoid repeating nested blocks when the number of items is variable.

```hcl
resource "google_compute_firewall" "allow" {
  name    = "allow-ingress"
  network = "default"

  dynamic "allow" {
    for_each = var.allowed_ports
    content {
      protocol = allow.value.protocol
      ports    = allow.value.ports
    }
  }
}

variable "allowed_ports" {
  type = list(object({
    protocol = string
    ports    = list(string)
  }))
  default = [
    { protocol = "tcp", ports = ["80", "443"] },
    { protocol = "icmp", ports = [] },
  ]
}
```

---

### locals

Compute derived values once and reference them everywhere.

```hcl
locals {
  project     = var.project_id
  env         = terraform.workspace
  name_prefix = "${local.project}-${local.env}"

  # Map from list of objects
  bucket_names = { for b in var.buckets : b.key => b.name }

  # Conditional local
  sa_email = var.use_custom_sa ? var.custom_sa_email : google_service_account.default.email
}
```

---

### Data source lookup

Fetch a resource by its existing properties without managing it.

```hcl
data "google_compute_network" "shared_vpc" {
  name    = "shared-vpc"
  project = var.host_project_id
}

resource "google_compute_subnetwork" "app" {
  name    = "app-subnet"
  network = data.google_compute_network.shared_vpc.self_link
  # …
}
```

---

### Output a sensitive value

Mark outputs as sensitive to prevent them from appearing in `plan` and `apply` logs.

```hcl
output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
```

Retrieve it explicitly when needed:

```bash
terraform output -raw db_password
```

---

### depends_on — explicit dependency

Force ordering between resources that have no implicit reference.

```hcl
resource "google_project_service" "run" {
  service = "run.googleapis.com"
}

resource "google_cloud_run_v2_service" "app" {
  depends_on = [google_project_service.run]
  # …
}
```

---

### lifecycle rules

```hcl
resource "google_storage_bucket" "artifacts" {
  name = "my-artifacts"

  lifecycle {
    # Prevent accidental deletion
    prevent_destroy = true

    # Ignore changes made outside Terraform
    ignore_changes = [labels, cors]

    # Create replacement before destroying original
    create_before_destroy = true

    # Replace when this expression becomes true
    replace_triggered_by = [google_service_account.deployer.email]
  }
}
```

---

### moved block (TF 1.1+)

Rename a resource in state without destroy/recreate.

```hcl
moved {
  from = google_storage_bucket.data
  to   = google_storage_bucket.raw_data
}
```

---

### check block (TF 1.5+)

Post-apply assertions that warn (not error) when conditions fail.

```hcl
check "bucket_versioning" {
  data "google_storage_bucket" "main" {
    name = google_storage_bucket.main.name
  }

  assert {
    condition     = data.google_storage_bucket.main.versioning[0].enabled
    error_message = "Bucket versioning must be enabled."
  }
}
```

---

### templatefile pattern

Render a startup script or config from a template file.

```hcl
resource "google_compute_instance" "app" {
  name         = "app-vm"
  machine_type = "e2-medium"
  zone         = "europe-west1-b"

  metadata = {
    startup-script = templatefile("${path.module}/startup.sh.tpl", {
      project_id = var.project_id
      bucket     = google_storage_bucket.data.name
    })
  }
}
```

`startup.sh.tpl`:
```bash
#!/bin/bash
gsutil cp gs://${bucket}/config.json /etc/app/config.json
```

---

### for expression — transform a collection inline

```hcl
locals {
  # List → list: uppercase all names
  upper_names = [for n in var.names : upper(n)]

  # List → map: index by name
  name_map = { for n in var.names : n => upper(n) }

  # Map → filtered map: keep only prod resources
  prod_only = { for k, v in var.resources : k => v if v.env == "prod" }
}
```

---

### Quick Reference: Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success / no changes |
| `1` | Error |
| `2` | Success with changes pending (only with `-detailed-exitcode`) |

---

### Quick Reference: Environment Variables

| Variable | Description |
|----------|-------------|
| `TF_LOG` | Log level: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `OFF` |
| `TF_LOG_PATH` | Write logs to this file instead of stderr |
| `TF_VAR_name` | Set variable `name` (overrides `.tfvars` files) |
| `TF_CLI_ARGS` | Default CLI flags appended to every command |
| `TF_CLI_ARGS_plan` | Default flags for `terraform plan` only |
| `TF_CLI_ARGS_apply` | Default flags for `terraform apply` only |
| `TF_DATA_DIR` | Override the `.terraform` directory path |
| `TF_WORKSPACE` | Set the active workspace |
| `TF_IN_AUTOMATION` | Set to any non-empty value to suppress interactive prompts and adjust output for CI |
| `TF_INPUT` | Set to `0` to disable interactive prompts globally |
| `TF_REGISTRY_DISCOVERY_RETRY` | Number of registry discovery retries |
| `GOOGLE_CREDENTIALS` | Path to a GCP service account key JSON file |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path used by Application Default Credentials |
| `GOOGLE_PROJECT` | Default GCP project ID for the google provider |
| `GOOGLE_REGION` | Default GCP region for the google provider |

```bash
# Enable trace logging to a file
TF_LOG=TRACE TF_LOG_PATH=terraform.log terraform plan

# Set a variable via environment
TF_VAR_project_id=my-project terraform plan

# CI mode
TF_IN_AUTOMATION=1 TF_INPUT=0 terraform apply -auto-approve
```

---

### File Organization Reference

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, backend block |
| `variables.tf` | Input variable declarations |
| `outputs.tf` | Output value declarations |
| `locals.tf` | Local value definitions |
| `versions.tf` | `terraform {}` block with required_version and required_providers |
| `network.tf` | VPC, subnets, firewall rules, Cloud NAT |
| `compute.tf` | Compute Engine VMs, instance templates, managed groups |
| `iam.tf` | Service accounts, IAM bindings and members |
| `run.tf` | Cloud Run V2 services and jobs |
| `storage.tf` | GCS buckets, lifecycle rules |
| `data.tf` | `data {}` blocks — lookups for existing resources |
| `import.tf` | `import {}` blocks (TF 1.5+) |
| `*.tfvars` | Variable value files (do not commit secrets) |
| `*.tfvars.json` | JSON format variable value files |
| `override.tf` | Local overrides (do not commit — add to `.gitignore`) |
| `.terraform.lock.hcl` | Provider lock file — always commit to version control |
| `.terraform/` | Local cache — add to `.gitignore` |

---

## Related

- [terraform-plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-plan-apply-destroy) — detailed workflow narrative
- [terraform-state-management](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-state-management) — state backends, locking, and recovery
- [hcl-syntax-basics](https://alp78.github.io/elysium/07-Terraform/Fundamentals/hcl-syntax-basics) — HCL language fundamentals
- [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) — variable types, validation, sensitive values
