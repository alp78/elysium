---
title: "04 - State Management"
tags: [terraform, iac]
aliases: [terraform state, terraform.tfstate, remote state, state locking, terraform backend, GCS backend]
description: "How Terraform state works, why remote state in GCS is essential, how state locking prevents concurrent applies, and the terraform state subcommands for safe state manipulation."
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# State Management

> [!quote]+
>
> "The source of truth is the single place where the system's current state is definitively recorded."
>
> — **Martin Kleppmann**, *Designing Data-Intensive Applications* (2017)

> [!abstract]- Summary
>
> Terraform State Management explains the operational center of Terraform: the state file that maps configuration to real infrastructure, the remote backend and locking model that keep teams from corrupting that mapping, and the CLI and language tools used to inspect, move, import, forget, and secure state safely over time.
>
> **State fundamentals**
> - covers what the state file records, how Terraform reconciles config versus state versus provider APIs, and why state becomes the source of truth for existing infrastructure
>
> **Remote backend and locking**
> - covers storing state in GCS, bootstrapping the state bucket, lock acquisition and release, stale-lock handling, and why concurrent applies against one state are unsafe
>
> **State manipulation workflow**
> - covers `terraform state` inspection commands, moving and removing addresses, importing existing resources, refresh-only drift detection, and advanced push/pull style operations
>
> **Verification, security, and lifecycle**
> - covers post-apply verification, state bucket protections, plaintext-secret risk, `removed` blocks, and workspace-based environment separation
>
> **Operations and safety**
> - Warnings: losing state causes duplicate or conflicting infrastructure, concurrent applies corrupt shared workflows, force-unlock is dangerous without verification, manual state editing is unsafe, `state rm` can create duplicates if config still exists, refresh-only does not fix configuration drift, `state push` can corrupt infrastructure, state stores plaintext secrets, and workspaces are not full isolation boundaries
> - Recommendations: use remote state with versioning, enforce one apply path per state, prefer `moved` and `removed` blocks over ad-hoc state surgery, verify imports and refresh-only runs before broader changes, and lock down the state bucket as a secret-bearing system of record

> [!note]- Glossary
>
> **Terraform state**
> - The persisted mapping between Terraform configuration addresses and the real infrastructure objects Terraform manages.
> - It matters because every plan and apply depends on state to know what already exists, what changed, and which resource instance corresponds to which cloud object.
>
> > [!warning] State loss is operationally severe
> >
> > If Terraform loses its state, it loses the authoritative map between code and infrastructure. Recovery is possible, but it is usually slower and riskier than protecting state correctly in the first place.
>
> ---
>
> **State file / `terraform.tfstate`**
> - The JSON document where Terraform stores tracked resource data, metadata, and selected output values.
> - It matters because the contents of the state file determine how Terraform understands current infrastructure during subsequent operations.
>
> > [!warning] It is not a normal config artifact
> >
> > The state file is machine-managed operational data, not something to edit casually by hand. Treating it like a regular source file is one of the fastest ways to break a Terraform workflow.
>
> ---
>
> **Remote state**
> - A backend configuration where Terraform stores state in shared remote storage instead of in a local file on one machine.
> - It matters because teams, CI/CD, and recovery workflows all depend on state being durable and centrally accessible.
>
> > [!info] Remote state is the team default
> >
> > Once more than one operator or automation path touches the same infrastructure, local state stops being a safe default. Shared systems need shared state with access controls and recovery options.
>
> ---
>
> **GCS backend**
> - Terraform's Google Cloud Storage backend for storing remote state in a GCS bucket, usually namespaced by a prefix.
> - It matters because this note assumes GCP infrastructure and uses GCS as the durable, versionable state store.
>
> > [!warning] Backend infrastructure must pre-exist
> >
> > Terraform cannot rely on a GCS backend until the bucket has already been created. Backend bootstrap is therefore a separate step from ordinary day-to-day plans and applies.
>
> ---
>
> **State lock**
> - A coordination mechanism that prevents more than one Terraform operation from mutating the same state simultaneously.
> - It matters because concurrent applies against one state can create corruption, conflicting writes, or misleading plan results.
>
> > [!warning] Locks protect correctness, not convenience
> >
> > A lock error is not an annoyance to bulldoze automatically. It is Terraform telling you another actor may already be changing the source of truth.
>
> ---
>
> **`terraform force-unlock`**
> - A CLI command that removes a Terraform state lock when Terraform believes the lock is still held.
> - It matters because stale locks do happen after crashes, but unlocking the wrong state at the wrong time can let two applies overlap.
>
> > [!danger] Verify before unlocking
> >
> > Force-unlock is safe only when you have confirmed that no real apply is still in flight. Used carelessly, it defeats the exact protection the locking system is supposed to provide.
>
> ---
>
> **Drift**
> - The difference between desired configuration, stored state, and the actual infrastructure as observed from provider APIs.
> - It matters because state-management work often starts when drift has appeared due to manual changes, failed applies, imports, or provider-side mutation.
>
> > [!info] Drift has multiple sources
> >
> > Not all drift means someone edited cloud resources by hand. Partial applies, stale state, provider bugs, or missing imports can all produce the same symptom from Terraform's point of view.
>
> ---
>
> **`terraform state mv`**
> - A CLI command that reassigns an object from one Terraform address to another inside state without recreating the real infrastructure.
> - It matters because refactors such as renaming resources or moving them into modules often need an address change while preserving the same underlying cloud object.
>
> > [!info] Safer than destroy-and-recreate
> >
> > State moves let you evolve Terraform structure without forcing downtime just to satisfy a new address layout. They are an important bridge between refactoring and continuity.
>
> ---
>
> **`terraform state rm`**
> - A CLI command that tells Terraform to forget a tracked object without deleting the underlying cloud resource.
> - It matters because sometimes Terraform must stop managing an object even though that object should remain alive outside the current configuration.
>
> > [!warning] Forgetting is not deleting
> >
> > If the resource block still exists in configuration after `state rm`, Terraform will usually try to create a new copy on the next apply. The configuration and the forgetting step have to agree.
>
> ---
>
> **Import**
> - The process of bringing an existing real-world resource under Terraform management by associating it with a Terraform address in state.
> - It matters because teams often adopt Terraform after resources already exist or need to recover state for objects created outside Terraform.
>
> > [!warning] Import does not write full config for you
> >
> > Import connects Terraform state to an existing object, but the configuration still has to describe that object correctly. State adoption and configuration authoring are separate responsibilities.
>
> ---
>
> **Refresh-only apply**
> - A Terraform operation that updates state to match provider reality without proposing configuration-driven infrastructure changes.
> - It matters because it is a controlled way to observe and record drift before deciding whether configuration or infrastructure should change next.
>
> > [!warning] Observation is not repair
> >
> > Refresh-only can update Terraform's view of reality, but it does not reconcile bad configuration or fix unintended infrastructure changes by itself. It is diagnostic, not curative.
>
> ---
>
> **`removed` block**
> - A Terraform language feature for explicitly forgetting a resource from state, optionally with destroy intent, in version-controlled configuration.
> - It matters because newer Terraform versions let state-removal intent live in code instead of in one-off CLI history.
>
> > [!info] Prefer declarative forgetting
> >
> > A `removed` block is auditable and reproducible in a way that ad-hoc `state rm` commands are not. That makes it a better fit for team workflows and reviewed changes.
>
> ---
>
> **Workspace**
> - A named Terraform state instance within the same working directory and backend layout.
> - It matters because workspaces offer lightweight separation between environments without requiring separate code copies.
>
> > [!warning] Workspaces are not hard isolation
> >
> > Workspaces split state, but they still share the same configuration code and often the same backend bucket. They are useful boundaries, not complete tenancy isolation.

## The State File

The state file (`terraform.tfstate`) is a JSON document that maps every resource in your `.tf` files to its real cloud counterpart (resource IDs, IPs, URIs, etc.). When you run `terraform plan`, Terraform executes a four-step reconciliation cycle:

1. Reads the current state (remote or local)
2. Queries the provider API to see what actually exists
3. Computes the diff between your `.tf` files and the current state
4. Generates a plan showing what will change

> [!warning] The state file is sacred
>
> If you lose the state file, Terraform doesn't know what exists and will try to recreate everything — causing duplicates, conflicts, and potentially destroying running services. Always use remote state. Never delete the state file.

> [!success] Use remote state with versioning
>
> Configure the `backend "gcs"` block in `main.tf` to store state in a GCS bucket, and enable object versioning on that bucket. If the state file is corrupted or accidentally deleted, you can restore a previous version with `gcloud storage cp "gs://<bucket>/path/default.tfstate#<generation>" gs://<bucket>/path/default.tfstate`.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    A[terraform init] --> B[Read state<br/>from GCS]
    B --> C[Acquire lock]
    C --> D[terraform plan<br/>Diff: config vs state vs API]
    D --> E[terraform apply<br/>Create / Update / Destroy]
    E --> F[Write updated<br/>state to GCS]
    F --> G[Release lock]

    style A fill:#292e42,stroke:#565f89,color:#c0caf5
    style B fill:#292e42,stroke:#565f89,color:#c0caf5
    style C fill:#24283b,stroke:#f7768e,color:#c0caf5
    style D fill:#292e42,stroke:#565f89,color:#c0caf5
    style E fill:#292e42,stroke:#565f89,color:#c0caf5
    style F fill:#292e42,stroke:#565f89,color:#c0caf5
    style G fill:#24283b,stroke:#9ece6a,color:#c0caf5
```

## Remote State in GCS

The `backend "gcs"` block in `main.tf` stores state remotely in Google Cloud Storage. This is the recommended approach for any team or CI/CD-driven workflow — it centralizes state, enables locking, and protects against local machine failures. See [GCS buckets and lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) for the underlying GCS concepts (versioning, lifecycle rules, IAM).

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "data-pipeline-tf-state"
    prefix = "terraform/state"
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `bucket` | `data-pipeline-tf-state` | The GCS bucket name. This bucket must exist **before** `terraform init` — Terraform does not create it. |
| `prefix` | `terraform/state` | A path prefix inside the bucket. The actual state file is stored at `terraform/state/default.tfstate`. Using a prefix allows multiple Terraform configurations to share one bucket without colliding. |

### Why Remote State?

- If the state file is local, only one machine can run `terraform apply`
- With GCS backend, the state is centralized and locked during operations — preventing concurrent modifications
- The state survives if your laptop dies
- The GCS bucket access controls protect sensitive values stored in state (passwords, connection strings)

> [!info] GCS bucket must pre-exist
>
> Create the state bucket manually (or via a separate bootstrap Terraform config) before running `terraform init`. The GCS backend cannot create its own bucket.

> [!warning] Never run concurrent `terraform apply` on the same state
>
> Even with GCS locking, two engineers running `terraform plan` simultaneously can both see the same "clean" state, then apply conflicting changes. The second apply may overwrite the first's changes or corrupt state. Use CI/CD pipelines (GitHub Actions, Cloud Build) as the single point of entry for `terraform apply` in shared environments.

> [!success] Enforce a single apply path
>
> Designate one CI/CD pipeline (e.g., a Cloud Build trigger or a GitHub Actions workflow) as the only entry point for `terraform apply` in shared environments. Engineers run `terraform plan` locally to review changes, then merge to main and let the pipeline apply. This eliminates race conditions and ensures the state lock is always held by a single, serialized process.

### Bootstrap the State Bucket

The state bucket must exist before `terraform init` can configure the backend. Create it once, manually or via a separate bootstrap config. Link CI/CD as the single apply path — see [GitHub Actions workflows](https://alp78.github.io/elysium/10-CICD/moc-github-actions) for pipeline integration.

#### Create the GCS state bucket

*Create a GCS bucket with uniform access for storing Terraform state.*

```bash
gcloud storage buckets create gs://data-pipeline-tf-state \
  --location=europe-west1 \
  --uniform-bucket-level-access
```

## State Locking

GCS backend supports automatic state locking during operations. When `terraform plan` or `terraform apply` runs, Terraform creates a `.tflock` file in the same GCS bucket alongside the state file. Any concurrent operation that attempts to acquire the lock will fail immediately with a lock error, preventing two processes from modifying state simultaneously.

If Terraform crashes mid-operation (e.g., network failure during `terraform apply`), the lock file remains in GCS because the process never completed its cleanup. This is called a stale lock — Terraform did not release it gracefully, and no operation is actually holding it.

### Lock Errors and Force-Unlock

#### Lock error output

```text
Error acquiring the state lock
Lock Info:
  ID:        abc-123-def
  Path:      gs://data-pipeline-tf-state/terraform/state/default.tflock
  Operation: OperationTypePlan
  Who:       user@machine
  Created:   2026-03-22 14:00:00
```

### Force-Unlock

When a Terraform process crashes or is terminated mid-operation, the lock file persists in GCS. Use `terraform force-unlock` to manually remove it. The `LOCK_ID` is the `ID` field shown in the lock error output above.

#### Remove a stale lock

*Release a stale lock using the lock ID from the error output above.*

```bash
terraform force-unlock <LOCK_ID>
```

> [!warning] Force-unlock carefully
>
> Only force-unlock if you are certain no other `terraform apply` is running. Unlocking while an apply is in progress can corrupt the state file.

> [!success] Verify before unlocking
>
> Before running `terraform force-unlock`, confirm that no pipeline, CI job, or team member is currently running an apply. Check your CI/CD platform's active job list and verify the GCS lock file timestamp. Only proceed with the unlock if the holding process has clearly crashed or been terminated.

## terraform state Commands

Use `terraform state` subcommands to inspect and manipulate state without modifying real infrastructure.

### Inspecting State

These read-only commands let you examine what Terraform is currently managing without modifying state or infrastructure. Use them to verify state contents after imports, moves, or applies.

#### List all managed resources

`terraform state list` prints every resource address in state — one per line. Use it to get a quick inventory of what Terraform controls.

*List all resources currently tracked in the state file.*

```bash
terraform -chdir=infra state list
```

```text
google_artifact_registry_repository.data-pipeline
google_cloud_run_v2_job.pipeline
google_cloud_run_v2_job.setup
google_cloud_run_v2_service.dashboard
google_cloud_run_v2_service_iam_member.dashboard_public
google_compute_firewall.allow_apm
google_compute_firewall.allow_airflow_ui
google_compute_firewall.allow_iap
google_compute_firewall.allow_sql
google_compute_firewall.deny_all_ingress
google_compute_instance.airflow
google_compute_instance.sql
google_compute_network.main
google_compute_router.main
google_compute_router_nat.main
google_compute_subnetwork.main
google_iam_service_account.airflow
google_iam_service_account.pipeline
google_secret_manager_secret.db_password
google_secret_manager_secret_version.db_password
```

#### Show details of a specific resource

`terraform state show` prints all attributes Terraform has recorded for a single resource — IDs, IPs, URIs, computed values, and metadata. This is useful for debugging or verifying that an import captured the correct values.

*Show all recorded attributes for the Cloud Run dashboard service.*

```bash
terraform -chdir=infra state show google_cloud_run_v2_service.dashboard
```

#### Show the full state in human-readable format

`terraform show` renders the entire state file in a readable format. For large states, pipe through `less` or redirect to a file.

*Render the full state file in human-readable format.*

```bash
terraform -chdir=infra show
```

### Moving Resources in State

`terraform state mv` renames a resource in state without destroying and recreating it. Use this when refactoring `.tf` files — for example, renaming a resource's Terraform-internal name or moving a resource into a module. The real infrastructure is untouched; only the state mapping changes.

After running `state mv`, update your `.tf` files to use the new resource name, then run `terraform plan` to confirm "No changes."

#### Rename a resource with terraform state mv

*Rename the Terraform-internal name from `project_sql` to `sql` without destroying the VM.*

```bash
terraform state mv google_compute_instance.project_sql google_compute_instance.sql
```

#### Declarative alternative — moved block (Terraform 1.1+)

Instead of running a CLI command, you can declare the rename directly in your `.tf` files using a `moved` block. Terraform processes the move automatically on the next `plan` or `apply`, then you can remove the `moved` block once the migration is complete.

> [!info] Requires Terraform 1.1+
>
> The `moved` block was introduced in Terraform 1.1. For older versions, use `terraform state mv` instead. From Terraform 1.8, `moved` blocks can also change resource types (e.g., migrating from `null_resource` to `terraform_data`).

*Declare the rename in HCL — Terraform processes it automatically on next plan/apply.*

```hcl
moved {
  from = google_compute_instance.project_sql
  to   = google_compute_instance.sql
}
```

> [!tip] Prefer `moved` blocks over CLI `state mv`
>
> `moved` blocks are version-controlled, self-documenting, and apply consistently across all team members' environments. They also work across module boundaries (moving a resource into or out of a module). Reserve `terraform state mv` for one-off fixes or when you need to move resources between entirely separate state files.

### Removing Resources from State

`terraform state rm` removes a resource from state without destroying the real cloud resource. Use this when you want Terraform to "forget" about a resource — for example, when migrating it to a different Terraform configuration or handing it off to manual management.

After running `state rm`, Terraform no longer tracks that resource. A subsequent `terraform plan` will show the resource definition in your `.tf` files as a new resource to create, since it no longer exists in state.

#### Detach a resource from Terraform management

*Remove the Airflow VM from state without destroying the GCE instance.*

```bash
terraform state rm google_compute_instance.airflow
```

> [!warning] Never edit state manually
>
> Never edit `terraform.tfstate` directly in a text editor. Use `terraform state mv` and `terraform state rm` for all state manipulation. Manual edits corrupt the state and can cause all resources to be destroyed on the next apply.

> [!success] Use state subcommands for safe manipulation
>
> Use `terraform state mv <old> <new>` to rename a resource's Terraform-internal name after refactoring, and `terraform state rm <resource>` to detach a resource from management. Both commands update state safely without touching the real infrastructure.

> [!danger] `state rm` followed by `apply` creates duplicates or errors
>
> If you `terraform state rm` a resource and then run `terraform apply`, Terraform sees the resource definition in your `.tf` files but not in state, so it tries to create a new one. If the resource already exists in GCP (which it does -- you just removed it from state), the apply either fails with a "resource already exists" error or, worse, creates a duplicate. Always pair `terraform state rm` with either removing the resource block from `.tf` files or immediately importing it back into a different state.

> [!success] Remove the block or re-import immediately
>
> After `terraform state rm <resource>`, immediately either delete the corresponding resource block from your `.tf` files (if you no longer want Terraform to manage it) or run `terraform import <resource_type>.<name> <gcp_id>` to re-attach it to the correct state. Run `terraform plan` after either action and confirm "No changes" before proceeding.

### Importing Existing Resources

When a resource was created outside Terraform (manually, via `gcloud`, or by another tool), use `terraform import` to bring it under Terraform management without recreating it. The command takes two arguments: the Terraform resource address (`<type>.<name>`) and the cloud resource ID.

You must have a corresponding `resource` block in your `.tf` files before importing — Terraform needs a target address to map the real resource to.

#### Import a GCE instance

*Import an existing Compute Engine VM into Terraform state by its full resource path.*

```bash
terraform import google_compute_instance.project_sql \
  projects/data-platform-prod/zones/europe-west1-b/instances/data-pipeline-sql
```

#### Import a Cloud Run service

*Import an existing Cloud Run service into state.*

```bash
terraform import google_cloud_run_v2_service.dashboard \
  projects/data-platform-prod/locations/europe-west1/services/data-pipeline-dashboard
```

#### Import a Secret Manager secret

*Import an existing Secret Manager secret into state.*

```bash
terraform import google_secret_manager_secret.db_password \
  projects/data-platform-prod/secrets/data-pipeline-db-password
```

> [!todo] Post-import workflow
>
> 1. Run `terraform plan` — Terraform shows the diff between your `.tf` config and the actual resource
> 2. Update `.tf` arguments to match the real resource (close all diffs)
> 3. Run `terraform plan` again — confirm "No changes" before proceeding

#### Declarative alternative — import block (Terraform 1.5+)

Instead of running `terraform import` from the CLI, you can declare imports directly in your `.tf` files using an `import` block. Terraform processes the import on the next `plan` or `apply`, then you can remove the `import` block once the resource is in state.

> [!info] Requires Terraform 1.5+
>
> The `import` block was introduced in Terraform 1.5. For older versions, use `terraform import` CLI instead. From Terraform 1.6+, the `id` field supports variables and data source references for dynamic import targets. From Terraform 1.7+, `import` blocks support `for_each` for bulk imports.

*Declare the import in HCL — reviewable in a PR before apply.*

```hcl
import {
  to = google_compute_instance.project_sql
  id = "projects/data-platform-prod/zones/europe-west1-b/instances/data-pipeline-sql"
}
```

> [!tip] Prefer `import` blocks for reproducibility
>
> `import` blocks are version-controlled and can be reviewed in a PR before applying. They also support `terraform plan` preview — you can see exactly what Terraform will import and what diffs it detects before running `apply`. The CLI `terraform import` command modifies state immediately with no preview step.

### Drift Detection with Refresh-Only Apply

When infrastructure is modified outside Terraform (manual console changes, `gcloud` commands, another tool), the state file becomes stale — it no longer reflects reality. Use `terraform apply -refresh-only` to update state to match actual infrastructure without making any changes.

> [!info] Replaces the deprecated `terraform refresh`
>
> The standalone `terraform refresh` command was deprecated in Terraform 0.15.4. Use `terraform apply -refresh-only` instead — it provides the same functionality but shows a plan preview and requires explicit approval before modifying state.

#### Detect and reconcile drift

*Update state to match actual infrastructure without creating, modifying, or destroying resources.*

```bash
terraform apply -refresh-only
```

Terraform queries the provider API for every resource in state, compares actual attributes to stored attributes, and shows what state values will be updated. No infrastructure is created, modified, or destroyed — only the state file changes.

> [!warning] Refresh-only does not fix config drift
>
> `terraform apply -refresh-only` updates state to match reality, but it does not update your `.tf` files. After a refresh-only apply, run `terraform plan` to see if your config now differs from the refreshed state — then update `.tf` files to close the gap.

> [!success] Run refresh-only before plan in shared environments
>
> In CI/CD pipelines or multi-engineer teams, run `terraform apply -refresh-only -auto-approve` before `terraform plan` to ensure the plan is computed against the actual current state, not a stale snapshot from a previous apply.

### Advanced State Operations

`terraform state pull` and `terraform state push` allow direct manipulation of the state file as JSON. These are low-level commands intended for state migrations, debugging, or disaster recovery — not routine operations.

#### Download state as JSON

`terraform state pull` downloads the current state from the backend and prints it to stdout as JSON.

*Download the current remote state and save it as a local JSON backup.*

```bash
terraform state pull > state-backup.json
```

#### Upload a modified state file

`terraform state push` uploads a local state file to the backend, replacing the current state. Terraform validates the serial number to prevent accidental overwrites — the pushed state must have a serial equal to or greater than the current remote state.

*Push a locally modified state file back to the remote backend.*

```bash
terraform state push state-backup.json
```

> [!danger] State push can corrupt your infrastructure
>
> Pushing an outdated or incorrectly modified state file can cause Terraform to destroy or recreate resources on the next apply. The serial number check prevents accidental rollbacks, but it cannot detect logical errors in the state content.

> [!success] Always pull before push
>
> If you need to modify state manually: (1) pull the current state, (2) make targeted edits to the JSON, (3) push it back. Never edit a locally cached state file that may be out of date. Prefer `terraform state mv` and `terraform state rm` over direct JSON edits whenever possible.

---

## Verification After Apply

After `terraform apply`, run these commands to confirm the state reflects reality and no configuration drift remains. A clean apply should produce "No changes" on a subsequent plan.

### Post-Apply Verification Commands

#### View all outputs

*Print all output values after apply.*

```bash
terraform -chdir=infra output
```

#### View a specific output

*Print only the dashboard URL.*

```bash
terraform -chdir=infra output dashboard_url
```

#### Confirm no drift remains

*Run a plan to verify the configuration matches the current state — should show "No changes."*

```bash
terraform -chdir=infra plan
```

#### Validate configuration syntax

*Check `.tf` file syntax and internal consistency without accessing any remote API.*

```bash
terraform -chdir=infra validate
```

## State Security

Terraform stores all resource attributes in state — including database passwords, API keys, and secret values passed via `google_secret_manager_secret_version`. The state file must be treated with the same security posture as your secret manager. See [service accounts and IAM](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) for GCP IAM fundamentals, and [secrets management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) for how secrets flow through infrastructure.

### Essential Security Controls

Three controls are essential for the state bucket:

1. **Restrict access** — only the Terraform service account and human administrators should have IAM permissions on the state bucket
2. **Enable versioning** — GCS bucket versioning lets you recover a corrupted state file from a previous version
3. **Enable object encryption** — GCS encrypts at rest by default; optionally use CMEK for compliance requirements

> [!danger] State contains plaintext secrets
>
> Anyone with read access to the GCS state bucket can extract every secret in your infrastructure — database passwords, API keys, connection strings. Never grant `allUsers` or `allAuthenticatedUsers` access. Enable GCS audit logging so every state file read is recorded in Cloud Audit Logs. Never download state files to local machines.

> [!success] Lock down the state bucket
>
> Apply three controls to the state bucket: (1) restrict IAM to the Terraform service account and named admins only; (2) enable GCS audit logging so every state file read is recorded in Cloud Audit Logs; (3) enable bucket versioning for state recovery. Use `uniform_bucket_level_access = true` and `public_access_prevention = "enforced"` in the bucket's Terraform definition.

#### Enable versioning on the state bucket

*Turn on object versioning for the state bucket to enable point-in-time recovery.*

```bash
gcloud storage buckets update gs://data-pipeline-tf-state --versioning
```

#### Recover a previous state version

If the current state is corrupted, list all object versions to find the last known good generation, then overwrite the current state file with it.

*List all versions of the state file to find the last known good generation number.*

```bash
gcloud storage objects list gs://data-pipeline-tf-state/terraform/state/ --all-versions
```

*Restore a specific state version by copying it over the current state file.*

```bash
gcloud storage cp "gs://data-pipeline-tf-state/terraform/state/default.tfstate#<generation>" \
  gs://data-pipeline-tf-state/terraform/state/default.tfstate
```

## The removed Block (Terraform 1.7+)

The `removed` block is the declarative alternative to `terraform state rm`. Instead of running a CLI command that immediately modifies state, you declare the removal in HCL — Terraform processes it on the next `plan`/`apply`, making the operation reviewable, version-controlled, and consistent across team members.

### Forget a resource without destroying it

The `destroy = false` argument tells Terraform to remove the resource from state but leave the actual cloud resource untouched.

*Remove the Airflow VM from Terraform management without destroying it in GCP.*

```hcl
removed {
  from = google_compute_instance.airflow

  lifecycle {
    destroy = false
  }
}
```

After `apply`, remove the `removed` block — it is only needed for the transition.

### Destroy and remove

When `destroy` is omitted or set to `true`, Terraform destroys the resource and removes it from state in a single operation.

*Destroy the legacy firewall rule and remove it from state.*

```hcl
removed {
  from = google_compute_firewall.legacy_allow_all
}
```

> [!tip] Prefer `removed` blocks over `terraform state rm`
>
> `removed` blocks are version-controlled, show up in `terraform plan` output for review, and apply consistently across all environments. Reserve `terraform state rm` for emergency fixes where you cannot modify the `.tf` files.

## Workspaces

Terraform workspaces allow multiple distinct state files within a single configuration directory. Each workspace has its own state, so resources in one workspace are invisible to another. The default workspace is named `default` and cannot be deleted.

*Create a new workspace for the staging environment.*

```bash
terraform workspace new staging
```

*Switch to an existing workspace.*

```bash
terraform workspace select staging
```

*List all workspaces — the active one is marked with `*`.*

```bash
terraform workspace list
```

Inside HCL, `terraform.workspace` returns the current workspace name. Use it to parameterize resources per environment:

*Use the workspace name to prefix resource names and select environment-specific configurations.*

```hcl
locals {
  env_prefix = terraform.workspace
  is_prod    = terraform.workspace == "prod"
}

resource "google_compute_instance" "sql" {
  name = "${local.env_prefix}-sql-server"
  # ...
}
```

> [!warning] Workspaces share the same backend bucket
>
> Each workspace stores its state at `<prefix>/<workspace>/default.tfstate` within the same GCS bucket. Workspaces do not provide IAM-level isolation — any identity with access to the bucket can read all workspace states. For strong environment isolation, use separate backend buckets or separate Terraform configurations.

> [!success] Use workspaces for lightweight environment separation
>
> Workspaces work well for dev/staging/prod environments that share the same configuration with different variable values. For environments with significantly different resource sets or strict security boundaries, use separate root modules with distinct backend configurations instead.

## Related

- [providers-and-backend](https://alp78.github.io/elysium/07-Terraform/Fundamentals/providers-and-backend) — backend "gcs" block configuration
- [plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/plan-apply-destroy) — the workflow that reads and updates state
- [variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/variables-and-outputs) — outputs extracted from state after apply
- [GCS buckets and lifecycle](https://alp78.github.io/elysium/06-GCP/Storage/gcs-buckets-and-lifecycle) — GCS concepts underpinning the state backend (versioning, lifecycle, IAM)
- [Service accounts and IAM](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — IAM controls for the Terraform service account and state bucket
- [Secrets management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) — secrets that appear as plaintext in state

## Terraform State Management References

- [Terraform State](https://developer.hashicorp.com/terraform/language/state)
- [GCS Backend](https://developer.hashicorp.com/terraform/language/backend/gcs)
- [terraform state commands](https://developer.hashicorp.com/terraform/cli/commands/state)
- [moved blocks](https://developer.hashicorp.com/terraform/language/moved) — declarative resource renames, cross-type refactoring (1.8+)
- [import blocks](https://developer.hashicorp.com/terraform/language/import) — declarative imports, `for_each` support (1.7+)
- [removed blocks](https://dev.to/lykins/terraform-removed-block-4j27) — declarative `state rm` replacement (Terraform 1.7+)
- [Terraform Workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces)
- ChromaDB: *Mastering Terraform* (Ch. 17 — state management, access control, encryption, backup strategies)
- ChromaDB: *Terraform Cookbook* (Ch. 6 — advanced state management, HCP Terraform)
