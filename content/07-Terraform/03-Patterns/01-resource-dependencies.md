---
title: "01 - Resource Dependencies"
tags: [terraform, iac]
aliases: [terraform dependencies, terraform dependency graph, depends_on, terraform parallelism, resource references]
description: "How Terraform builds and resolves the resource dependency graph — implicit dependencies from resource references, explicit depends_on, and how parallelism works during apply."
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# Resource Dependencies

> [!quote]+
>
> "Terraform allows you to reference the attribute of any resource within any other resource. That's how the dependency graph gets built."
>
> — **Mitchell Hashimoto**, HashiConf talk

> [!abstract]- Summary
>
> Resource Dependencies explains how Terraform turns references into a directed execution graph, why that graph controls ordering and parallelism more reliably than manual sequencing, and how dependency mistakes show up as cycles, cascaded replacements, or unsafe refactors during real infrastructure changes.
>
> **Graph fundamentals**
> - covers how Terraform builds the dependency graph, why destroy walks the graph in reverse, and how parallelism interacts with dependency depth
>
> **Implicit and explicit edges**
> - covers natural dependencies created by resource references, when `depends_on` is actually justified, and the special cases where data sources or side effects still need explicit ordering
>
> **Debugging graph behavior**
> - covers graph visualization, dependency troubleshooting, circular dependencies, and the practical techniques for breaking unsatisfied cycles
>
> **Refactoring and replacement safety**
> - covers cascading recreation, replacement propagation, and the role of `moved` blocks when addresses change but the underlying infrastructure should stay intact
>
> **Operations and safety**
> - Warnings: `depends_on` should stay a last resort, circular references make the graph unsolvable, forced recreation can propagate through downstream resources, and `moved` blocks do not solve cross-state migrations
> - Recommendations: prefer implicit dependencies from real references, inspect the graph when ordering feels surprising, use lifecycle controls to contain replacement blast radius, and declare `moved` blocks before address refactors become destructive applies

> [!note]- Glossary
>
> **Dependency graph / DAG**
> - The directed acyclic graph Terraform builds from references and explicit dependency declarations to determine execution order.
> - It matters because apply and destroy ordering come from the graph, not from file order or from the position of blocks in source files.
>
> > [!info] Order is computed, not scripted
> >
> > Terraform does not execute configuration top to bottom like a shell script. The graph is what tells Terraform which operations may run in parallel and which must wait.
>
> ---
>
> **Implicit dependency**
> - A dependency Terraform infers automatically because one resource directly references an attribute of another.
> - It matters because most correct Terraform ordering should come from real data flow rather than from manual ordering hints.
>
> > [!info] The safest dependency is the one Terraform can see
> >
> > When a resource reference expresses the real relationship, Terraform gains both ordering and clearer intent. That is usually stronger than an external comment or a hand-added dependency edge.
>
> ---
>
> **Explicit dependency / `depends_on`**
> - A Terraform meta-argument that forces one resource or module to wait for another even when there is no direct attribute reference.
> - It matters because some side effects or out-of-band behaviors still need ordering that Terraform cannot infer automatically.
>
> > [!warning] Extra edges reduce graph quality
> >
> > Overusing `depends_on` makes the graph less precise and can hide missing real references. It should express genuine dependency gaps, not become a substitute for understanding the resource model.
>
> ---
>
> **Parallelism**
> - Terraform's ability to execute independent graph nodes concurrently during apply or destroy.
> - It matters because graph quality directly influences how much safe concurrency Terraform can exploit.
>
> > [!warning] More concurrency is not always better
> >
> > Increasing `-parallelism` can speed up large applies, but it can also trigger provider rate limits or make failure analysis noisier. Graph concurrency and operational concurrency are related, not identical.
>
> ---
>
> **Graph visualization**
> - The process of rendering Terraform's dependency graph to inspect how Terraform understands the relationships between resources.
> - It matters because confusing ordering behavior is often easier to debug visually than by staring at many resource blocks.
>
> > [!info] Useful when intent and behavior diverge
> >
> > If Terraform is applying in an order that surprises you, the graph visualization usually reveals whether the issue is a missing reference, an unnecessary explicit edge, or a hidden cycle.
>
> ---
>
> **Circular dependency**
> - A dependency loop where two or more graph nodes require each other before any of them can be created or evaluated.
> - It matters because Terraform requires an acyclic graph and will fail when references or explicit edges create a loop.
>
> > [!danger] Cycles are unsatisfiable, not slow
> >
> > Terraform cannot "try harder" to resolve a cycle. The configuration has to be redesigned so that at least one edge is removed or replaced with a different pattern.
>
> ---
>
> **Replacement propagation**
> - The way a forced replacement of one resource can trigger changes or replacements in resources that depend on its attributes.
> - It matters because the blast radius of a small-looking change is often determined by the dependency edges leaving that resource.
>
> > [!warning] One immutable field can fan out widely
> >
> > If an upstream object's identity changes, downstream resources that key off that identity may also have to update or recreate. Dependency reasoning is therefore part of change-impact analysis.
>
> ---
>
> **Lifecycle meta-argument**
> - A Terraform configuration control such as `create_before_destroy` that changes how resources behave during replacement or deletion.
> - It matters because lifecycle rules are one of the main tools for reducing the operational damage of dependency-driven replacement waves.
>
> > [!info] Graph structure and lifecycle work together
> >
> > Dependencies decide who is connected; lifecycle rules influence how replacement unfolds across those connections. You often need both concepts to control risk.
>
> ---
>
> **`moved` block**
> - A Terraform language construct that tells Terraform a resource address has changed even though the underlying object should be treated as the same one.
> - It matters because dependency-safe refactoring often means changing addresses without destroying infrastructure.
>
> > [!warning] Address refactors are destructive without guidance
> >
> > If Terraform sees a new address and no `moved` block, it usually interprets the change as delete-old and create-new. That is why refactors need declarative migration metadata.
>
> ---
>
> **Cross-state move**
> - A refactor where a resource has to move between separate Terraform state files rather than just to a new address inside the same state.
> - It matters because `moved` blocks do not solve this class of migration, and operators often overestimate what address mapping can do.
>
> > [!warning] State boundaries are real boundaries
> >
> > Moving between states is not the same as renaming within one state. Cross-state migration needs explicit state operations or separate adoption workflows, not only in-configuration move declarations.

## How the Dependency Graph Works

When you reference one resource inside another (e.g., `network = google_compute_network.main.id`), Terraform records that dependency. During `terraform plan`, Terraform builds a directed acyclic graph (DAG) of all resources in the configuration, then walks the graph to determine the correct operation order. During `terraform apply`:

- Resources with no dependencies are created **immediately and in parallel**
- Resources with dependencies wait until all their dependencies are created
- Terraform maximizes parallelism — it never waits unnecessarily
- During `terraform destroy`, Terraform walks the same graph **in reverse order** — resources that depend on others are destroyed first, then their dependencies

This is fundamentally different from scripts where you control order with `&&`. Terraform computes the optimal creation and destruction order automatically.

> [!info] Parallelism control
>
> By default, Terraform processes up to **10 resource operations concurrently** (`-parallelism=10`). For large configurations with many independent resources, increasing this value (e.g., `-parallelism=30`) can speed up applies. For rate-limited APIs, decrease it to avoid `429 Too Many Requests` errors. Set it on any walk command: `terraform apply -parallelism=20` or `terraform destroy -parallelism=5`.

The following diagram shows the effective dependency graph for a typical GCP data engineering project. Resources at the same horizontal level with no edges between them are created in parallel. Service accounts, the VPC, secrets, and the Artifact Registry all have no dependencies on each other — Terraform creates all of them simultaneously.

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
flowchart TD
    vars["variables.tf<br/>(inputs)"]

    vars --> vpc["google_compute_network.main<br/>VPC"]
    vars --> sa["google_service_account.*<br/>pipeline, dashboard, airflow, ci, datadog"]
    vars --> secrets["google_secret_manager_secret.*"]
    vars --> ar["google_artifact_registry_repository<br/>data-pipeline"]

    vpc --> subnet["google_compute_subnetwork.main"]
    vpc --> fw["google_compute_firewall.*<br/>5 rules"]
    vpc --> router["google_compute_router.main"]
    router --> nat["google_compute_router_nat.main"]

    sa --> iam["google_*_iam_member.*<br/>all IAM bindings"]
    secrets --> versions["google_secret_manager_secret_version.*"]

    subnet --> sql["google_compute_instance.sql"]
    sa --> sql
    subnet --> airflow["google_compute_instance.airflow"]
    sa --> airflow

    sql --> dashboard["google_cloud_run_v2_service.dashboard"]
    sql --> pipeline["google_cloud_run_v2_job.pipeline"]
    sql --> setup["google_cloud_run_v2_job.setup"]
    subnet --> dashboard
    subnet --> pipeline
    subnet --> setup

    style vars fill:#1a1b26,stroke:#7aa2f7,color:#c0caf5
    style vpc fill:#292e42,stroke:#7aa2f7,color:#c0caf5
    style sa fill:#292e42,stroke:#9ece6a,color:#c0caf5
    style secrets fill:#292e42,stroke:#bb9af7,color:#c0caf5
    style ar fill:#292e42,stroke:#e0af68,color:#c0caf5
    style sql fill:#24283b,stroke:#f7768e,color:#c0caf5
    style airflow fill:#24283b,stroke:#f7768e,color:#c0caf5
    style dashboard fill:#24283b,stroke:#7dcfff,color:#c0caf5
    style pipeline fill:#24283b,stroke:#7dcfff,color:#c0caf5
    style setup fill:#24283b,stroke:#7dcfff,color:#c0caf5
```

## Implicit Dependencies

The most common way to create a dependency is by referencing a resource attribute. When Terraform encounters an attribute reference like `google_compute_network.main.id`, it records a dependency edge in the graph: the referencing resource depends on the referenced resource.

### Attribute References

*Create a subnet that implicitly depends on the VPC via the `network` attribute reference.*

```hcl
resource "google_compute_subnetwork" "main" {
  name          = "data-pipeline-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}
```

The `network` argument references `google_compute_network.main.id`, which tells Terraform: "this subnet needs the VPC to exist first, and I need its ID." Terraform will:

1. Create the VPC (`google_compute_network.main`)
2. Wait for the VPC to finish and capture its `id` output attribute
3. Create the subnet with the resolved ID

The three most common attribute reference patterns in the GCP provider:

| Reference Pattern | What It Returns | Example Value |
|---|---|---|
| `resource_type.name.id` | The resource's full GCP resource path | `projects/data-pipeline-.../networks/data-pipeline-vpc` |
| `resource_type.name.name` | The GCP-visible name | `data-pipeline-vpc` |
| `resource_type.name.email` | Service account email | `data-pipeline-pipeline@<project>.iam.gserviceaccount.com` |

### Traversing Nested Attributes

Resource attributes can be nested several levels deep. Use bracket notation to traverse lists:

*Extract the SQL VM's private IP and the Airflow VM's public IP from nested resource attributes.*

```hcl
locals {
  sql_ip     = google_compute_instance.sql.network_interface[0].network_ip
  airflow_ip = google_compute_instance.airflow.network_interface[0].access_config[0].nat_ip
}
```

Breaking down the traversal for the SQL VM's private IP:

- `google_compute_instance.sql` — the resource
- `.network_interface` — a list of network interfaces (most VMs have one)
- `[0]` — the first (and only) interface
- `.network_ip` — the private IP assigned from the subnet

For the Airflow VM's public IP:

- `.access_config` — a list of access configs (the empty `access_config {}` block in the Terraform config)
- `[0]` — the first access config
- `.nat_ip` — the ephemeral public IP assigned by GCP

These locals are then used in Cloud Run environment variables, creating an implicit dependency chain: Cloud Run depends on the SQL VM existing because it needs the private IP.

## Explicit Dependencies

Sometimes a dependency exists that Terraform cannot see from resource attribute references alone. The `depends_on` meta-argument lets you declare these hidden dependencies explicitly.

### depends_on

*Declare an explicit ordering dependency on the pipeline service account.*

```hcl
resource "google_project_iam_member" "pipeline_bq_access" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.pipeline.email}"

  depends_on = [google_service_account.pipeline]
}
```

In this example, the `member` interpolation already creates an implicit dependency on `google_service_account.pipeline`, making the `depends_on` redundant. The real use cases for `depends_on` are:

- When a dependency exists through data that Terraform does not track (e.g., a resource that must exist before an external API call succeeds)
- When ordering is required but no attribute reference expresses it (e.g., an IAM binding must propagate before a Cloud Run service can start)
- When a `data` source reads from a resource indirectly — the data source does not reference the resource, but the resource must exist first for the data source query to return results

> [!warning] `depends_on` is a last resort
>
> Overusing `depends_on` creates unnecessary serialization, slowing down your apply. Every `depends_on` edge forces Terraform to wait even when it could otherwise parallelize. Use resource references wherever possible — they both express the dependency AND give you the attribute value.

> [!success] Safe pattern — prefer implicit dependencies via references
>
> Let resource attribute references drive the dependency graph. Instead of `depends_on = [google_service_account.pipeline]`, use `member = "serviceAccount:${google_service_account.pipeline.email}"` — this both expresses the dependency and provides the value. Reserve `depends_on` for cases where a dependency exists through external state or data sources that Terraform cannot track.

### Data Source Dependencies

`data` blocks participate in the dependency graph the same way as `resource` blocks — if a data source references a resource attribute, Terraform creates an implicit dependency. However, data sources are **read during planning**, which means `depends_on` on a data source forces Terraform to defer the read until the apply phase:

*Defer reading the VM data source until after the VM is created during apply.*

```hcl
data "google_compute_instance" "sql" {
  name    = "sql-server-vm"
  zone    = var.zone

  depends_on = [google_compute_instance.sql]
}
```

Without `depends_on`, Terraform would attempt to read this data source during `plan` — before the VM exists. The explicit dependency tells Terraform: "wait until the VM is created during apply, then read its attributes."

> [!tip] When data sources need `depends_on`
>
> If a data source queries a resource that Terraform itself creates in the same configuration, you almost certainly need `depends_on`. If the data source queries a resource that already exists outside your Terraform configuration, `depends_on` is unnecessary.

## Visualizing the Dependency Graph

Terraform can export the dependency graph in DOT format for visualization with Graphviz.

### terraform graph Command

*Export the dependency graph as SVG using Graphviz.*

```bash
terraform graph | dot -Tsvg > graph.svg
```

This generates an SVG image of the full resource dependency graph. To view the raw text DAG without Graphviz:

*Print the raw DAG text to stdout.*

```bash
terraform graph
```

The `-type` flag controls which graph to display: `terraform graph -type=plan` (default — shows the plan graph), `terraform graph -type=apply` (the apply-time graph), or `terraform graph -type=destroy` (the reverse-order destruction graph). Add `-draw-cycles` to highlight cyclic edges when diagnosing circular dependency errors. The output shows every resource as a node and every dependency as a directed edge.

> [!tip] Debugging dependency issues
>
> When a resource is being created or destroyed in an unexpected order, generate the graph and look for missing or extra edges. A missing edge means Terraform does not know about a dependency you expect. An extra edge (often from `depends_on`) means unnecessary serialization.

## Circular Dependencies

Terraform will fail with a clear error if it detects a circular dependency — resource A depends on B, and B depends on A, forming a cycle in the DAG.

> [!danger] Circular dependency error
>
> ```text
> Error: Cycle: google_compute_instance.a, google_compute_instance.b
> ```
>
> Terraform cannot resolve a cycle and will refuse to plan or apply. This error always indicates a design problem in your configuration, not a Terraform bug.

> [!success] Breaking dependency cycles
>
> Common causes and fixes:
> - **Two resources referencing each other's IDs** — restructure so only one holds the reference, or introduce an intermediate resource (e.g., a `locals` block or a third resource that both depend on).
> - **A module that outputs a value its own input depends on** — extract the shared value into a separate module or use a `data` source.
> - **`depends_on` creating a hidden cycle** — remove the explicit dependency and find an alternative ordering mechanism.

## Resource Replacement and Cascading Recreation

Some changes can be applied in-place (updating an attribute without recreating the resource). Others require Terraform to destroy and recreate the resource, which is called **force-replacement**. The `terraform plan` output marks these with `-/+` (destroy then create) or `+/-` (create then destroy, when `create_before_destroy` is set).

| Change Type | Terraform Behavior | Plan Symbol |
|---|---|---|
| Update `description` or `labels` | In-place update | `~` |
| Change `machine_type` on a VM | Destroy + recreate | `-/+` |
| Change `image` on `boot_disk` | Destroy + recreate | `-/+` |
| Add a new `env` variable to Cloud Run | New revision (zero-downtime) | `~` |
| Change `location` on a BigQuery dataset | Destroy + recreate (data loss) | `-/+` |

> [!warning] Forced recreation propagates through the graph
>
> If resource A is destroyed and recreated, it gets a new `id`. Any resource B that references `A.id` will also be updated or recreated to use the new value. This cascade can be surprising — force-replacing a VPC triggers recreation of all subnets, firewalls, VMs, and Cloud Run services that reference it.

> [!success] Safe pattern — lifecycle meta-arguments
>
> For stable foundational resources (VPCs, subnets, service accounts), add `lifecycle { prevent_destroy = true }` to block accidental Terraform-driven destruction. For mutable attributes managed outside Terraform (e.g., `labels` set by other tools), use `lifecycle { ignore_changes = [labels] }`. Always run `terraform plan` and inspect `-/+` lines before every apply to detect unexpected recreation cascades.

### replace_triggered_by

Introduced in **Terraform 1.2**, `replace_triggered_by` is a lifecycle meta-argument that forces a resource to be replaced when a referenced resource or attribute changes, even if the resource's own arguments have not changed:

*Force a new Cloud Run deployment whenever the database password secret version changes.*

```hcl
resource "google_cloud_run_v2_service" "dashboard" {
  name     = "dashboard"
  location = var.region

  lifecycle {
    replace_triggered_by = [
      google_secret_manager_secret_version.db_password.id
    ]
  }
}
```

When the secret version changes (a new version is created), Cloud Run gets a new deployment even though its own configuration did not change. This is useful for resources that consume external state — the dependency exists but Terraform would not otherwise detect the need for replacement. Note that `replace_triggered_by` only accepts references to **managed resources** — plain `local` values and input `variable` references are not valid. To trigger on a plain value change, wrap it in a `terraform_data` resource and reference that instead.

## Refactoring Dependencies with moved Blocks

Introduced in **Terraform 1.1**, `moved` blocks let you rename or reorganize resources in your configuration without destroying and recreating them. When you refactor resource names, module paths, or move resources between modules, Terraform normally sees the old name as "deleted" and the new name as "created." A `moved` block tells Terraform that these are the same resource:

*Tell Terraform the resource was renamed, not deleted and recreated.*

```hcl
moved {
  from = google_compute_instance.main
  to   = google_compute_instance.sql
}
```

Terraform updates the state to reflect the new address without any infrastructure changes. The dependency graph is recalculated using the new names. Remove the `moved` block after everyone on the team has applied it — removing it before that point is a breaking change (anyone who hasn't applied will see a destroy + create instead of a rename).

> [!warning] `moved` blocks do not handle cross-state moves
>
> `moved` blocks only work within a single Terraform state file. To move a resource between separate state files (e.g., splitting a monolith into modules with their own state), use `terraform state mv` with the `-state` and `-state-out` flags.

> [!success] Safe refactoring pattern
>
> 1. Add the `moved` block with `from` and `to` addresses.
> 2. Rename the resource in the configuration to match the `to` address.
> 3. Run `terraform plan` — it should show `# has moved to` with zero infrastructure changes.
> 4. Apply, then remove the `moved` block in the next commit.

## Related

**Terraform Patterns:**

- [conditional-resources](https://alp78.github.io/elysium/07-Terraform/Patterns/conditional-resources) — how `count` and `for_each` interact with the dependency graph
- [module-composition](https://alp78.github.io/elysium/07-Terraform/Patterns/module-composition) — module boundaries and inter-module dependency passing

**Terraform Fundamentals:**

- [plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/plan-apply-destroy) — reading the plan to understand what will be created, updated, or destroyed
- [hcl-syntax-basics](https://alp78.github.io/elysium/07-Terraform/Fundamentals/hcl-syntax-basics) — HCL syntax for resource references and attribute access
- [state-management](https://alp78.github.io/elysium/07-Terraform/Fundamentals/state-management) — how state tracks the real resource IDs that references resolve to

**GCP Services:**

- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — IAM bindings and service accounts referenced in the dependency graph

**CI/CD:**

- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — CI/CD pipelines running `terraform plan` and `terraform apply`

## References

- [Terraform Resource Graph — Internals](https://developer.hashicorp.com/terraform/internals/graph)
- [Terraform depends_on — Meta-Argument](https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on)
- [Terraform lifecycle — Meta-Arguments](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle)
- [Terraform moved Blocks](https://developer.hashicorp.com/terraform/language/moved)
- [Terraform graph Command](https://developer.hashicorp.com/terraform/cli/commands/graph)
