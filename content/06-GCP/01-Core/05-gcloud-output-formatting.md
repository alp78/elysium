---
title: "05 - gcloud Output Formatting"
tags: [gcp, gcloud]
aliases: [gcloud format, gcloud filter, gcloud output, gcloud --format, gcloud --filter]
description: "How to use gcloud --format, --filter, projections, transform functions, and --uri to produce stable script-friendly output from live bq-wh-nb resources."
created: 2026-04-13
updated: 2026-04-13
status: complete
---

# gcloud Output Formatting

> [!abstract]- Summary
> `gcloud` returns structured API resources and only renders them into human-facing text at the final output step. `--format` controls how those resources are serialized, `--filter` controls which resources survive to that stage, and projections plus transform functions let you shape the result directly in the CLI instead of post-processing default tables with `grep`, `awk`, or ad hoc JSON parsing.
>
> This note focuses on building stable, script-friendly output contracts from live project data, including the Compute Engine VM `stoxx-vm` and the four current service accounts in `bq-wh-nb`. All live outputs were captured on April 13, 2026 with Google Cloud SDK `563.0.0`.

> [!note]- Glossary
> **`--format` flag**
>
> The `gcloud` flag that controls how returned resources are serialized on standard output.
>
> **`--filter` flag**
>
> The `gcloud` flag that applies a filter expression to listed resources before the final output is printed.
>
> **projection**
>
> The field list inside a format expression, such as `table(name,status)`, that selects which resource keys to emit.
>
> **transform function**
>
> A suffix such as `.basename()` or `.list()` that reshapes one projected value before it is printed.
>
> **server-side filter**
>
> A filter evaluated by the API service before the full result set is returned to the CLI.
>
> **client-side filter**
>
> A filter evaluated by the CLI after the response reaches the local machine.
>
> **resource URI**
>
> The canonical API path of a resource, such as a Compute Engine instance self link or a service account URI.
>
> **`basename()`**
>
> A transform function that returns the final path segment of a resource URI.
>
> **format expression language**
>
> The `gcloud` syntax model `NAME[ATTRIBUTES](PROJECTION)` used by the `--format` flag.
>
> **`gcloud topic formats`**
>
> The local supplementary help page that documents output formats and format-expression syntax.
>
> **`gcloud topic filters`**
>
> The local supplementary help page that documents the filter expression language.
>
> **`gcloud topic projections`**
>
> The local supplementary help page that documents projections and transform functions.

## PowerShell / Linux

The commands in this note are identical on PowerShell, Bash, and other shells because `gcloud` itself parses the `--format` and `--filter` expressions. The only platform-specific differences appear later when shell variables or quoting rules are involved in bigger scripts.

### gcloud | learn the format and filter language from the built-in topic system

The built-in topic system is the fastest authoritative reference when you forget the exact shape of a format expression or the behavior of a filter operator. These topic pages are local CLI help, so they work even when you are offline.

#### Read the format reference

**When to run:** Before building a non-trivial `--format` expression or when you need the exact syntax of projections and attributes.
**Trigger:** You remember that `table`, `json`, `csv`, or `value` exists, but not the exact expression grammar.
**Context:** Read-only local help command. No API call is made against the project.
**Purpose:** Show the formal `--format=NAME[ATTRIBUTES](PROJECTION)` syntax and point to related topic pages.

*Print the opening section of the local output-format reference.*

```bash
gcloud topic formats
```

```text
NAME
    gcloud topic formats - resource formats supplementary help

DESCRIPTION
    Most gcloud commands return a list of resources on success. By default they
    are pretty-printed on the standard output. The
    --format=NAME[ATTRIBUTES](PROJECTION) and --filter=EXPRESSION flags along
    with projections can be used to format and change the default output to a
    more meaningful result.

    Use the --format flag to change the default output format of a command.
    Resource formats are described in detail below.

    Use the --filter flag to select resources to be listed. For details run $
    gcloud topic filters.

    Use resource-keys to reach resource items through a unique path of names
    from the root. For details run $ gcloud topic resource-keys.

    Use projections to list a subset of resource keys in a resource. For
    details run $ gcloud topic projections.

    Note: To refer to a list of fields you can sort, filter, and format by for
    each resource, you can run a list command with the format set to text or
    json. For example, $ gcloud compute instances list --limit=1 --format=text.

  Formats
    A format expression is used to change the default output format of a
    command. Many output formats are available; some for pretty printing
    human-readable output and others for returning machine-readable output.
```

The important line is the syntax model itself: `NAME[ATTRIBUTES](PROJECTION)`. That is the grammar behind expressions such as `table(name,status)` or `csv[no-heading](email,displayName)`.

#### Read the projection reference

**When to run:** When you know the resource exists but do not know the exact field path or transform syntax you need.
**Trigger:** A command returns nested arrays, resource URIs, or repeated fields that the default table hides.
**Context:** Read-only local help command. No project resource is changed or queried.
**Purpose:** Show how projections select keys and how transform functions attach to those keys.

*Print the opening section of the projection reference.*

```bash
gcloud topic projections
```

```text
NAME
    gcloud topic projections - resource projections supplementary help

DESCRIPTION
    Most gcloud commands return a list of resources on success. By default they
    are pretty-printed on the standard output. The
    --format=NAME[ATTRIBUTES](PROJECTION) and --filter=EXPRESSION flags along
    with projections can be used to format and change the default output to a
    more meaningful result.

    Use the --format flag to change the default output format of a command. For
    details run $ gcloud topic formats.

    Use the --filter flag to select resources to be listed. For details run $
    gcloud topic filters.

    Use resource-keys to reach resource items through a unique path of names
    from the root. For details run $ gcloud topic resource-keys.

    Use projections to list a subset of resource keys in a resource. Resource
    projections are described in detail below.

  Projections
    A projection is a list of keys that selects resource data values.
    Projections are used in --format flag expressions. For example, the table
    format requires a projection that describes the table columns:

        table(name, network.ip.internal, network.ip.external, uri())

  Transforms
    A transform formats resource data values. Each projection key may have zero
    or more transform calls:
```

This topic is the authoritative explanation of the two most important concepts in the output language: projections choose fields, and transforms rewrite the chosen values before printing them.

#### Read the filter reference

**When to run:** Before writing a compound filter expression with Boolean logic, pattern matching, or range comparisons.
**Trigger:** You need to narrow a list command without downloading and parsing the full result set manually.
**Context:** Read-only local help command. It documents the filter language; it does not query a project API.
**Purpose:** Show the filter expression model and the important warning that filtering behavior depends on the server API.

*Print the opening section of the filter reference.*

```bash
gcloud topic filters
```

```text
NAME
    gcloud topic filters - resource filters supplementary help

DESCRIPTION
    Most gcloud commands return a list of resources on success. By default they
    are pretty-printed on the standard output. The
    --format=NAME[ATTRIBUTES](PROJECTION) and --filter=EXPRESSION flags along
    with projections can be used to format and change the default output to a
    more meaningful result.

    Use the --format flag to change the default output format of a command. For
    details run $ gcloud topic formats.

    Use the --filter flag to select resources to be listed. Resource filters
    are described in detail below.

    Use resource-keys to reach resource items through a unique path of names
    from the root. For details run $ gcloud topic resource-keys.

    Use projections to list a subset of resource keys in a resource. For
    details run $ gcloud topic projections.

    Note: To refer to a list of fields you can sort, filter, and format by for
    each resource, you can run a list command with the format set to text or
    json. For example, $ gcloud compute instances list --limit=1 --format=text.

    Note: Depending on the specific server API, filtering may be done entirely
    by the client, entirely by the server, or by a combination of both.
```

The last note matters operationally. `--filter` is not guaranteed to be purely server-side for every API. Some services apply it remotely, some locally, and some as a mixed pipeline.

| Topic | Command | Use |
|---|---|---|
| format language | `gcloud topic formats` | Learn the grammar and the built-in output formats. |
| projections | `gcloud topic projections` | Learn field selection and transform functions. |
| filters | `gcloud topic filters` | Learn Boolean filter expressions and operator behavior. |

### gcloud | choose the right output shape for humans, scripts, and exports

The default table is fine for interactive reading, but it is a weak contract for automation. Google documents in the scripting guide that default standard output can change across releases, which is why scripts should use explicit `--format` expressions instead of scraping human-oriented tables.

> [!warning] Default tables are not a stable scripting contract
>
> The Google Cloud scripting guide explicitly warns against depending on raw default output in automation. Default columns, labels, ordering, and spacing can change in later SDK versions.

> [!success] Make the output contract explicit
>
> For any script, use an explicit shape such as `value(...)`, `json(...)`, `csv(...)`, `yaml(...)`, `table(...)`, or `--uri` so the CLI prints exactly the fields you expect.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Resource name of the VM instance. |
| `zone` | URI | Full Compute Engine zone resource path for the instance. |
| `status` | enum-like string | Current lifecycle state of the instance. |
| `machineType` | URI | Full machine-type resource path for the instance. |
| `networkInterfaces[0].networkIP` | IPv4 string | Primary internal IPv4 address on the first network interface. |
| `labels.app` | string | Instance label that identifies the application role. |
| `labels.env` | string | Instance label that identifies the environment. |
| `tags.items` | string array | Network tags attached to the instance. |
| `email` | string | Service account email address. |
| `displayName` | string | Human-readable service account display name. |
| `disabled` | boolean | Whether the service account is disabled. |

#### Use the default table when a human is reading the result

**When to run:** During ad-hoc inspection at the terminal when readability matters more than machine parsing.
**Trigger:** You want a quick health check of resources and do not need to pipe the output into another tool.
**Context:** Read-only list command against Compute Engine in project `bq-wh-nb`.
**Purpose:** Show the built-in human-friendly table that `gcloud` prints when no explicit format is supplied.

*List the VM inventory using the command's built-in default table.*

```bash
gcloud compute instances list --project=bq-wh-nb
```

```text
NAME      ZONE            MACHINE_TYPE  PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP  STATUS
stoxx-vm  europe-west1-b  e2-medium                  10.132.0.8                RUNNING
```

This output is easy to read, but it is not ideal for scripts because the header names, ordering, and spacing belong to the CLI presentation layer rather than to a stable machine contract.

#### Build a custom table projection with transform functions

**When to run:** When the default table is close to useful but you need to choose specific columns or clean up URI-based fields.
**Trigger:** You need a human-readable inventory that includes labels, tags, or URI-derived values the default table does not expose clearly.
**Context:** Read-only list command with a custom `table(...)` projection. The API response is unchanged; only the client-side rendering differs.
**Purpose:** Produce a readable table that shows exactly the fields you care about and applies transforms inline.

> [!info] Projection breakdown
>
> - `zone.basename()` trims the full zone URI down to `europe-west1-b`.
> - `machineType.basename()` trims the full machine-type URI down to `e2-medium`.
> - `tags.items.list()` collapses the string array into one comma-delimited cell.
> - `labels.app` and `labels.env` project label values directly into separate columns.

*Project selected fields into a custom table and transform URI and list fields inline.*

```bash
gcloud compute instances list --project=bq-wh-nb --format="table(name,zone.basename(),status,machineType.basename(),labels.app,labels.env,tags.items.list())"
```

```text
NAME      ZONE            STATUS   MACHINE_TYPE  APP       ENV  ITEMS
stoxx-vm  europe-west1-b  RUNNING  e2-medium     stoxx-db  dev  iap-ssh,sql-server
```

This is the practical form of projections and transforms working together. The API still returned the full URIs and list fields, but the format expression rendered them in a shorter operational view.

#### Emit projected JSON for downstream tools

**When to run:** When the next consumer is `jq`, Python, PowerShell JSON parsing, or another programmatic tool.
**Trigger:** You need structured machine-readable output instead of aligned columns or plain strings.
**Context:** Read-only list command. JSON serialization happens client-side after the resource list is returned.
**Purpose:** Produce a predictable JSON array containing only the requested fields.

*Project the instance list into a reduced JSON payload.*

```bash
gcloud compute instances list --project=bq-wh-nb --format="json(name,status,zone,machineType,networkInterfaces[0].networkIP)"
```

```text
[
  {
    "machineType": "https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b/machineTypes/e2-medium",
    "name": "stoxx-vm",
    "networkInterfaces": [
      {
        "networkIP": "10.132.0.8"
      }
    ],
    "status": "RUNNING",
    "zone": "https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b"
  }
]
```

Projected JSON keeps machine-readability without forcing you to accept the full raw resource payload. The nested array under `networkInterfaces` also shows why JSON is often the easiest intermediate format when fields are repeated.

#### Extract scalar values for shell loops and tabular pipelines

**When to run:** When a script needs one or more scalar fields per resource with no headers or formatting decoration.
**Trigger:** You are feeding the output into a loop, `ForEach-Object`, `xargs`, or another CLI stage.
**Context:** Read-only list command with the `value(...)` format.
**Purpose:** Print a clean row-oriented stream that scripts can consume without stripping headers.

*Emit the instance name and internal IP as a tab-separated value stream.*

```bash
gcloud compute instances list --project=bq-wh-nb --format="value(name,networkInterfaces[0].networkIP)"
```

```text
stoxx-vm	10.132.0.8
```

`value(...)` emits one row per resource and uses tabs between projected fields. That makes it safer for shell automation than parsing a human-readable table.

#### Export CSV for spreadsheets and inventory files

**When to run:** When the result needs to move into a spreadsheet, CSV-aware import tool, or flat-file inventory.
**Trigger:** A consumer outside the CLI expects comma-separated rows with a header line.
**Context:** Read-only list command against IAM service accounts.
**Purpose:** Serialize selected service account metadata as CSV.

*Export the service account inventory as CSV.*

```bash
gcloud iam service-accounts list --project=bq-wh-nb --format="csv(email,displayName,disabled)"
```

```text
email,display name,disabled
pipeline-state-writer@bq-wh-nb.iam.gserviceaccount.com,Pipeline State Writer,False
github-actions-sa@bq-wh-nb.iam.gserviceaccount.com,GitHub Actions (git-lab),False
bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com,BQ WH SA,False
348557092514-compute@developer.gserviceaccount.com,Compute Engine default service account,False
```

CSV is the simplest bridge into spreadsheets or ingestion utilities, but it is still only as stable as the explicit projection you choose. Keep the projection list fixed if downstream tooling depends on column order.

#### Render YAML for configuration review

**When to run:** When you want a compact, review-friendly representation of selected resource fields.
**Trigger:** A human needs to compare resource configuration values or copy a concise configuration snapshot into a ticket or note.
**Context:** Read-only describe command against one VM instance.
**Purpose:** Serialize selected instance fields in a nested text format that remains easy to diff and read.

*Describe selected instance fields in YAML.*

```bash
gcloud compute instances describe stoxx-vm --zone=europe-west1-b --project=bq-wh-nb --format="yaml(name,status,zone,machineType,tags.items,disks[0].boot)"
```

```text
disks:
- boot: true
machineType: https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b/machineTypes/e2-medium
name: stoxx-vm
status: RUNNING
tags:
  items:
  - iap-ssh
  - sql-server
zone: https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b
```

YAML preserves nesting more readably than flattened text while remaining lighter than full JSON for manual review. In this example, the boot-disk flag and tag list remain structurally visible.

#### Print resource URIs directly

**When to run:** When another command or API call needs the canonical resource URI rather than a short display name.
**Trigger:** You are chaining commands or documenting exact resource identities.
**Context:** Read-only list command with the global `--uri` flag.
**Purpose:** Emit only canonical resource URIs with no extra presentation formatting.

*Print the instance URI rather than a table of display fields.*

```bash
gcloud compute instances list --project=bq-wh-nb --uri
```

```text
https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b/instances/stoxx-vm
```

`--uri` is useful when another tool or another `gcloud` command wants the exact resource path. It also makes the "resource URI" concept concrete: this is the canonical identifier the API itself understands.

| Format or flag | Syntax | Description |
|---|---|---|
| `table(...)` | `--format="table(name,status)"` | Human-readable aligned table with selected fields. |
| `json(...)` | `--format="json(name,status)"` | Machine-readable JSON array containing only projected fields. |
| `value(...)` | `--format="value(name,networkInterfaces[0].networkIP)"` | Headerless scalar or tab-separated row output for scripts. |
| `csv(...)` | `--format="csv(email,displayName,disabled)"` | Comma-separated output with a header row. |
| `yaml(...)` | `--format="yaml(name,status,tags.items)"` | Nested YAML for human review or text diffing. |
| `flattened(...)` | `--format="flattened(labels,tags.items)"` | Dot-path key/value output for nested-field discovery. |
| `--uri` | `gcloud compute instances list --uri` | Print canonical resource URIs instead of a formatted table. |

### gcloud | discover nested keys and transform complex fields

Nested arrays and nested objects are where most `gcloud` formatting confusion starts. `flattened(...)` helps you discover exact field paths, and transform functions help you turn awkward raw values such as URIs or repeated arrays into compact operational output.

| Field or function | Type | Meaning |
|---|---|---|
| `labels` | object | Resource key/value metadata labels. |
| `tags.items` | string array | Network tags attached to the instance. |
| `serviceAccounts[]` | object array | Service accounts attached to the instance. |
| `serviceAccounts[0].email` | string | Email of the first attached service account. |
| `serviceAccounts[0].scopes[0]` | URI | Full OAuth scope URI granted to that service account. |
| `.basename()` | transform | Returns the last segment of a URI. |
| `.list()` | transform | Joins an array into one delimited printable value. |
| `.date()` | transform | Renders timestamps with a chosen format or timezone. |
| `.yesno()` | transform | Converts Boolean values to `yes` or `no`. |
| `.scope()` | transform | Extracts a named scope segment from a resource URI. |

#### Flatten nested fields to learn the projection paths

**When to run:** When you do not yet know the exact nested field path you need for `table(...)`, `json(...)`, or `value(...)`.
**Trigger:** A default table hides nested labels, tags, service accounts, or list elements.
**Context:** Read-only describe command with the `flattened(...)` format. It changes presentation only.
**Purpose:** Reveal the concrete dot-path keys that later projections can reference directly.

*Flatten selected nested fields from the instance description.*

```bash
gcloud compute instances describe stoxx-vm --zone=europe-west1-b --project=bq-wh-nb --format="flattened(labels,tags.items,serviceAccounts[])"
```

```text
labels.app:                   stoxx-db
labels.env:                   dev
serviceAccounts[0].email:     bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com
serviceAccounts[0].scopes[0]: https://www.googleapis.com/auth/cloud-platform
tags.items[0]:                iap-ssh
tags.items[1]:                sql-server
```

This is the most practical discovery output in the note. It exposes the exact paths later used in projections such as `labels.app`, `tags.items.list()`, and `serviceAccounts[0].email`.

#### Transform nested values after the paths are known

**When to run:** After field discovery, when you need a short printable value rather than the raw nested URI or array element.
**Trigger:** The projected value is technically correct but too verbose for terminal output or scripting.
**Context:** Read-only describe command with a `value(...)` projection and an inline transform.
**Purpose:** Show how discovered nested fields can be shortened into operationally useful scalar output.

*Project the attached service account email and trim its OAuth scope URI to the final segment.*

```bash
gcloud compute instances describe stoxx-vm --zone=europe-west1-b --project=bq-wh-nb --format="value(serviceAccounts[0].email,serviceAccounts[0].scopes[0].basename())"
```

```text
bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com	cloud-platform
```

Without `.basename()`, the second field would be the full scope URI. With the transform, the value becomes the operationally meaningful suffix `cloud-platform`.

| Transform | Syntax | Description |
|---|---|---|
| `.basename()` | `zone.basename()` | Returns the final URI segment, such as `europe-west1-b`. |
| `.list()` | `tags.items.list()` | Joins array elements into one printable list cell. |
| `.date()` | `creationTimestamp.date(tz=LOCAL)` | Renders a timestamp in a chosen timezone or format. |
| `.yesno()` | `deletionProtection.yesno()` | Converts Boolean values to `yes` or `no`. |
| `.scope()` | `selfLink.scope(zones)` | Extracts a named scope segment from a resource URI. |

### gcloud | filter before you format

Filtering and formatting solve different problems and should be combined deliberately. `--filter` decides which resources survive the selection stage. `--format` decides how the survivors are serialized. The official scripting guide recommends using both so automation receives a smaller, predictable output contract.

> [!warning] Filter execution is API-dependent
>
> The `gcloud topic filters` help explicitly states that filtering may happen entirely on the client, entirely on the server, or as a combination of both depending on the backing API.

> [!success] Treat `--filter` as selection, not as a performance guarantee
>
> Use `--filter` to make intent explicit, but still combine it with explicit projections and sensible `--limit` or `--sort-by` values when output volume matters.

| Field | Type | Meaning |
|---|---|---|
| `status` | enum-like string | Instance lifecycle state used in Compute Engine list filters. |
| `name` | string | Resource name, commonly filtered with substring or regex operators. |
| `email` | string | Service account email used for IAM list filters. |
| `displayName` | string | Human-readable service account name. |
| `disabled` | boolean | Service account enabled or disabled state. |

#### Filter the instance list to the running stoxx VM

**When to run:** When you already know the resource family and want to reduce the result set before inspecting it.
**Trigger:** The unfiltered list would include more resources than the current operational question needs.
**Context:** Read-only Compute Engine list command with a filter expression.
**Purpose:** Return only the instance rows that match the requested name pattern and runtime state.

*Filter the instance list to resources named like `stoxx` that are currently running.*

```bash
gcloud compute instances list --project=bq-wh-nb --filter="name:stoxx AND status=RUNNING"
```

```text
NAME      ZONE            MACHINE_TYPE  PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP  STATUS
stoxx-vm  europe-west1-b  e2-medium                  10.132.0.8                RUNNING
```

The filter kept only the one VM that matches both conditions. This is the same inventory command as before, but now the selection logic is explicit and machine-reproducible.

#### Combine filtering with scalar output for automation

**When to run:** When a script needs only the filtered subset and only a few scalar fields from that subset.
**Trigger:** You are turning the filtered result into a downstream loop, SSH target list, or inventory file.
**Context:** Read-only Compute Engine list command combining `--filter` with `value(...)`.
**Purpose:** Produce the minimum viable machine-readable output for a filtered resource subset.

*Filter the running stoxx instance and emit only name, zone, and machine type.*

```bash
gcloud compute instances list --project=bq-wh-nb --filter="name:stoxx AND status=RUNNING" --format="value(name,zone.basename(),machineType.basename())"
```

```text
stoxx-vm	europe-west1-b	e2-medium
```

This is the stable scripting form of the same query. The resource selection happens first, and the remaining row is reduced to three tab-separated scalars.

#### Filter service accounts and format the reduced result

**When to run:** When you need a targeted IAM inventory instead of the full account list.
**Trigger:** You care about one subset of service accounts, such as CI identities or a specific application identity.
**Context:** Read-only IAM service account list command. The filter expression is applied to the list result before formatting.
**Purpose:** Narrow the service account inventory to matching identities and print only the requested metadata columns.

*Filter the service account list to the GitHub Actions and warehouse identities.*

```bash
gcloud iam service-accounts list --project=bq-wh-nb --filter="email:github-actions-sa OR email:bq-wh-sa" --format="table(email,displayName,disabled)"
```

```text
EMAIL                                               DISPLAY NAME              DISABLED
github-actions-sa@bq-wh-nb.iam.gserviceaccount.com  GitHub Actions (git-lab)  False
bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com           BQ WH SA                  False
```

This is the pattern you want in access reviews: explicit selection logic plus explicit output columns. Nothing else from the IAM inventory leaks into the result.

| Flag or operator | Syntax | Description |
|---|---|---|
| `--filter` | `--filter="status=RUNNING"` | Applies a filter expression to list results. |
| `=` | `status=RUNNING` | Exact equality comparison. |
| `:` | `name:stoxx` | Pattern or substring-style match in the filter language. |
| `~` | `name~'^stoxx-.*'` | Regular-expression match. |
| `AND` | `status=RUNNING AND name:stoxx` | Both terms must match. |
| `OR` | `email:bq-wh-sa OR email:github-actions-sa` | Either term may match. |
| `NOT` | `NOT disabled` | Negates the following term or expression. |
| `--limit` | `--limit=10` | Restricts the number of listed resources after sort and filter processing. |
| `--sort-by` | `--sort-by=name` | Sorts list results by one or more fields before the final output is printed. |

## Related

- [gcloud-cli-setup](https://alp78.github.io/elysium/06-GCP/01-Core/00-gcloud-cli-setup) — Install the CLI and verify the local SDK before relying on formatted output
- [gcp-resource-hierarchy](https://alp78.github.io/elysium/06-GCP/01-Core/01-gcp-resource-hierarchy) — Inspect project metadata that can also be projected and filtered
- [gcp-apis-and-services](https://alp78.github.io/elysium/06-GCP/01-Core/02-gcp-apis-and-services) — List and filter enabled APIs with the same output-language patterns
- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/01-Core/03-gcloud-authentication) — Authentication and service-account impersonation belong here, not in an output-formatting note
- [gcloud-configurations](https://alp78.github.io/elysium/06-GCP/01-Core/04-gcloud-configurations) — Set the active project and account that formatted commands will inherit
- [gcloud-help-and-discovery](https://alp78.github.io/elysium/06-GCP/01-Core/06-gcloud-help-and-discovery) — Use help topics and release tracks to discover more `gcloud` surfaces safely

## References

- [Scripting gcloud CLI commands](https://docs.cloud.google.com/sdk/docs/scripting-gcloud)
- [gcloud topic formats reference](https://cloud.google.com/sdk/gcloud/reference/topic/formats)
- [gcloud topic filters reference](https://cloud.google.com/sdk/gcloud/reference/topic/filters)
- [gcloud topic projections reference](https://cloud.google.com/sdk/gcloud/reference/topic/projections)
