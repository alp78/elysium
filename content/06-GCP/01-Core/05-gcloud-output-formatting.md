---
title: "05 - gcloud Output Formatting"
tags: [gcp, gcloud]
aliases: [gcloud format, gcloud filter, gcloud output, gcloud --format, gcloud --filter]
description: "How to use gcloud --format, --filter, projections, transform functions, and --uri to produce stable script-friendly output from live dagflow-poc resources."
created: 2026-04-13
updated: 2026-04-15
status: complete
---

# gcloud Output Formatting

> [!abstract]- Summary
> `gcloud` returns structured API resources and only renders them into human-facing text at the final output step. `--format` controls how those resources are serialized, `--filter` controls which resources survive to that stage, and projections plus transform functions let you shape the result directly in the CLI instead of post-processing default tables with `grep`, `awk`, or ad hoc JSON parsing.
>
> This note focuses on building stable, script-friendly output contracts from live project data, now using the readable `dagflow-poc` service-account inventory, enabled-service inventory, and selected project IAM bindings. The local help-topic excerpts and live resource outputs were refreshed on April 15, 2026 with Google Cloud SDK `563.0.0`.

> [!warning]- Live-run boundary
> On April 15, 2026 `gcloud compute instances list --project=dagflow-poc` returned `Listed 0 items.`. The live formatting examples in this note therefore moved from the older `stoxx-vm` walkthrough to the `dagflow-poc` service-account list, enabled services, and one filtered IAM policy binding that are all still readable today.

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

Before building a non-trivial `--format` expression or when you need the exact syntax of projections and attributes. It is typically triggered by you remember that `table`, `json`, `csv`, or `value` exists, but not the exact expression grammar. Read-only local help command. No API call is made against the project. Show the formal `--format=NAME[ATTRIBUTES](PROJECTION)` syntax and point to related topic pages.

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

When you know the resource exists but do not know the exact field path or transform syntax you need. It is typically triggered by A command returns nested arrays, resource URIs, or repeated fields that the default table hides. Read-only local help command. No project resource is changed or queried. Show how projections select keys and how transform functions attach to those keys.

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

Before writing a compound filter expression with Boolean logic, pattern matching, or range comparisons. It is typically triggered by you need to narrow a list command without downloading and parsing the full result set manually. Read-only local help command. It documents the filter language; it does not query a project API. Show the filter expression model and the important warning that filtering behavior depends on the server API.

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
| `name` | string | Full IAM resource name for the service account. |
| `email` | string | Service account email address. |
| `displayName` | string | Human-readable service account display name. |
| `disabled` | boolean | Whether the service account is disabled. |
| `projectId` | string | Project ID that owns the service account. |
| `uniqueId` | string | Numeric immutable identifier for the service account. |
| `description` | string | Free-form description stored on the service account. |
| `oauth2ClientId` | string | OAuth client ID associated with the service account. |

#### Use the default table when a human is reading the result

During ad-hoc inspection at the terminal when readability matters more than machine parsing. It is typically triggered by you want a quick inventory check and do not need to pipe the output into another tool. Read-only list command against IAM service accounts in project `dagflow-poc`. Show the built-in human-friendly table that `gcloud` prints when no explicit format is supplied.

*List the service-account inventory using the command's built-in default table.*

```bash
gcloud iam service-accounts list --project=dagflow-poc
```

```text
DISPLAY NAME                     EMAIL                                                        DISABLED
GitHub Actions Deployer          github-actions-deployer@dagflow-poc.iam.gserviceaccount.com  False
Default compute service account  462383815308-compute@developer.gserviceaccount.com           False
Terraform Deployer               terraform-deployer@dagflow-poc.iam.gserviceaccount.com       False
```

This output is easy to read, but it is not ideal for scripts because the header names, ordering, and spacing belong to the CLI presentation layer rather than to a stable machine contract.

#### Build a custom table projection with transform functions

When the default table is close to useful but you need to choose specific columns or clean up resource-name fields. It is typically triggered by you need a human-readable inventory with fewer columns, better labels, or transformed values. Read-only list command with a custom `table(...)` projection. The API response is unchanged; only the client-side rendering differs. Produce a readable table that shows exactly the fields you care about and applies transforms inline.

> [!info] Projection breakdown
>
> - `name.basename():label=EMAIL` trims the full IAM resource name down to the service-account email and relabels the column.
> - `displayName:label=DISPLAY_NAME` replaces the default heading with an automation-friendly column name.
> - `disabled.yesno(yes='disabled',no='enabled'):label=STATE` turns the Boolean into an operational state string and relabels the output.
> - `projectId` and `uniqueId` project stable ownership and identity fields directly into the table.

*Project selected fields into a custom table and transform the full resource name inline.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --format="table(name.basename():label=EMAIL,displayName:label=DISPLAY_NAME,projectId:label=PROJECT,uniqueId:label=UNIQUE_ID,disabled.yesno(yes='disabled',no='enabled'):label=STATE)"
```

```text
EMAIL                                                        DISPLAY_NAME                     PROJECT      UNIQUE_ID              STATE
github-actions-deployer@dagflow-poc.iam.gserviceaccount.com  GitHub Actions Deployer          dagflow-poc  108397796108109846813  enabled
462383815308-compute@developer.gserviceaccount.com           Default compute service account  dagflow-poc  116178860353002034854  enabled
terraform-deployer@dagflow-poc.iam.gserviceaccount.com       Terraform Deployer               dagflow-poc  111463851582255539946  enabled
```

This is the practical form of projections and transforms working together. The API still returned the full service-account resource names and Boolean state, but the format expression rendered them in a shorter operational view.

#### Emit projected JSON for downstream tools

When the next consumer is `jq`, Python, PowerShell JSON parsing, or another programmatic tool. It is typically triggered by you need structured machine-readable output instead of aligned columns or plain strings. Read-only list command. JSON serialization happens client-side after the resource list is returned. Produce a predictable JSON array containing only the requested fields.

*Project the service-account list into a reduced JSON payload.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --format="json(name,email,displayName,disabled,projectId,uniqueId)"
```

```text
[
  {
    "disabled": false,
    "displayName": "GitHub Actions Deployer",
    "email": "github-actions-deployer@dagflow-poc.iam.gserviceaccount.com",
    "name": "projects/dagflow-poc/serviceAccounts/github-actions-deployer@dagflow-poc.iam.gserviceaccount.com",
    "projectId": "dagflow-poc",
    "uniqueId": "108397796108109846813"
  },
  {
    "disabled": false,
    "displayName": "Default compute service account",
    "email": "462383815308-compute@developer.gserviceaccount.com",
    "name": "projects/dagflow-poc/serviceAccounts/462383815308-compute@developer.gserviceaccount.com",
    "projectId": "dagflow-poc",
    "uniqueId": "116178860353002034854"
  },
  {
    "disabled": false,
    "displayName": "Terraform Deployer",
    "email": "terraform-deployer@dagflow-poc.iam.gserviceaccount.com",
    "name": "projects/dagflow-poc/serviceAccounts/terraform-deployer@dagflow-poc.iam.gserviceaccount.com",
    "projectId": "dagflow-poc",
    "uniqueId": "111463851582255539946"
  }
]
```

Projected JSON keeps machine-readability without forcing you to accept the full raw resource payload. It also preserves field names exactly, which is why it is a good handoff format for downstream tooling.

#### Extract scalar values for shell loops and tabular pipelines

When a script needs one or more scalar fields per resource with no headers or formatting decoration. It is typically triggered by you are feeding the output into a loop, `ForEach-Object`, `xargs`, or another CLI stage. Read-only list command with the `value(...)` format. Print a clean row-oriented stream that scripts can consume without stripping headers.

*Emit the service-account email, display name, and disabled flag as a tab-separated value stream.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --format="value(email,displayName,disabled)"
```

```text
github-actions-deployer@dagflow-poc.iam.gserviceaccount.com	GitHub Actions Deployer	False
462383815308-compute@developer.gserviceaccount.com	Default compute service account	False
terraform-deployer@dagflow-poc.iam.gserviceaccount.com	Terraform Deployer	False
```

`value(...)` emits one row per resource and uses tabs between projected fields. That makes it safer for shell automation than parsing a human-readable table.

#### Export CSV for spreadsheets and inventory files

When the result needs to move into a spreadsheet, CSV-aware import tool, or flat-file inventory. It is typically triggered by A consumer outside the CLI expects comma-separated rows with a header line. Read-only list command against IAM service accounts. Serialize selected service account metadata as CSV.

*Export the service-account inventory as CSV.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --format="csv(email,displayName,disabled)"
```

```text
email,display name,disabled
github-actions-deployer@dagflow-poc.iam.gserviceaccount.com,GitHub Actions Deployer,False
462383815308-compute@developer.gserviceaccount.com,Default compute service account,False
terraform-deployer@dagflow-poc.iam.gserviceaccount.com,Terraform Deployer,False
```

CSV is the simplest bridge into spreadsheets or ingestion utilities, but it is still only as stable as the explicit projection you choose. Keep the projection list fixed if downstream tooling depends on column order.

#### Render YAML for configuration review

When you want a compact, review-friendly representation of selected resource fields. It is typically triggered by A human needs to compare resource configuration values or copy a concise configuration snapshot into a ticket or note. Read-only describe command against one service account. Serialize selected account fields in a nested text format that remains easy to diff and read.

*Describe selected service-account fields in YAML.*

```bash
gcloud iam service-accounts describe github-actions-deployer@dagflow-poc.iam.gserviceaccount.com --project=dagflow-poc --format="yaml(name,email,displayName,description,oauth2ClientId,projectId,uniqueId,disabled)"
```

```text
description: Impersonated by GitHub Actions through Workload Identity Federation
displayName: GitHub Actions Deployer
email: github-actions-deployer@dagflow-poc.iam.gserviceaccount.com
name: projects/dagflow-poc/serviceAccounts/github-actions-deployer@dagflow-poc.iam.gserviceaccount.com
oauth2ClientId: '108397796108109846813'
projectId: dagflow-poc
uniqueId: '108397796108109846813'
```

YAML preserves key names readably while remaining lighter than full JSON for manual review. In this example, the account description, OAuth client ID, and immutable identifiers remain easy to scan.

#### Print resource URIs directly

When another command or API call needs the canonical resource URI rather than a short display name. It is typically triggered by you are chaining commands or documenting exact resource identities. Read-only list command with the global `--uri` flag. Emit only canonical resource URIs with no extra presentation formatting.

*Print the service-account URIs rather than a table of display fields.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --uri
```

```text
https://iam.googleapis.com/v1/projects/dagflow-poc/serviceAccounts/108397796108109846813
https://iam.googleapis.com/v1/projects/dagflow-poc/serviceAccounts/116178860353002034854
https://iam.googleapis.com/v1/projects/dagflow-poc/serviceAccounts/111463851582255539946
```

`--uri` is useful when another tool or another `gcloud` command wants the exact resource path. It also makes the "resource URI" concept concrete: this is the canonical identifier the API itself understands.

| Format or flag | Syntax | Description |
|---|---|---|
| `table(...)` | `--format="table(email,displayName,disabled)"` | Human-readable aligned table with selected fields. |
| `json(...)` | `--format="json(email,displayName,disabled)"` | Machine-readable JSON array containing only projected fields. |
| `value(...)` | `--format="value(email,displayName,disabled)"` | Headerless scalar or tab-separated row output for scripts. |
| `csv(...)` | `--format="csv(email,displayName,disabled)"` | Comma-separated output with a header row. |
| `yaml(...)` | `--format="yaml(name,email,displayName,uniqueId)"` | Nested YAML for human review or text diffing. |
| `flattened(...)` | `--format="flattened(bindings)"` | Dot-path key/value output for nested-field discovery. |
| `--uri` | `gcloud iam service-accounts list --uri` | Print canonical resource URIs instead of a formatted table. |

### gcloud | discover nested keys and transform complex fields

Nested arrays and nested objects are where most `gcloud` formatting confusion starts. `flattened(...)` helps you discover exact field paths, and transform functions help you turn repeated values such as IAM member arrays into compact operational output.

| Field or function | Type | Meaning |
|---|---|---|
| `bindings[]` | object array | IAM policy bindings returned by `get-iam-policy`. |
| `bindings.role` | string | IAM role attached to one binding. |
| `bindings.members[]` | string array | Principals attached to one binding. |
| `bindings.members[0]` | string | First principal in the binding. |
| `.list()` | transform | Joins an array into one delimited printable value. |
| `.basename()` | transform | Returns the last segment of a resource path. |
| `.date()` | transform | Renders timestamps with a chosen format or timezone. |
| `.yesno()` | transform | Converts Boolean values to `yes` or `no`. |
| `.scope()` | transform | Extracts a named scope segment from a resource URI when applicable. |

#### Flatten nested fields to learn the projection paths

When you do not yet know the exact nested field path you need for `table(...)`, `json(...)`, or `value(...)`. It is typically triggered by A policy or resource contains repeated arrays that the default output hides or condenses. Read-only IAM policy command with the `flattened(...)` format. It changes presentation only. Reveal the concrete dot-path keys that later projections can reference directly.

*Flatten one filtered IAM policy binding to reveal the nested member paths.*

```bash
gcloud projects get-iam-policy dagflow-poc --flatten="bindings[]" --filter="bindings.role:roles/run.admin" --format="flattened(bindings)"
```

```text
bindings.members[0]: serviceAccount:github-actions-deployer@dagflow-poc.iam.gserviceaccount.com
bindings.members[1]: serviceAccount:terraform-deployer@dagflow-poc.iam.gserviceaccount.com
bindings.role:       roles/run.admin
```

This is the most practical discovery output in the note. It exposes the exact paths later used in projections such as `bindings.role` and `bindings.members.list()`.

#### Transform nested values after the paths are known

After field discovery, when you need a short printable value rather than the raw array layout. It is typically triggered by the projected value is technically correct but too verbose for terminal output or scripting. Read-only IAM policy command with a `value(...)` projection and an inline transform. Show how discovered nested fields can be shortened into operationally useful scalar output.

*Project the filtered IAM role and collapse its member array into one scalar field.*

```bash
gcloud projects get-iam-policy dagflow-poc --flatten="bindings[]" --filter="bindings.role:roles/run.admin" --format="value(bindings.role,bindings.members.list())"
```

```text
roles/run.admin	serviceAccount:github-actions-deployer@dagflow-poc.iam.gserviceaccount.com,serviceAccount:terraform-deployer@dagflow-poc.iam.gserviceaccount.com
```

Without `.list()`, the second field would remain a repeated array in the raw policy structure. With the transform, the member list becomes one compact scalar that is easy to log or pass downstream.

| Transform | Syntax | Description |
|---|---|---|
| `.basename()` | `name.basename()` | Returns the final resource-path segment, such as a service-account email. |
| `.list()` | `bindings.members.list()` | Joins array elements into one printable list cell. |
| `.date()` | `creationTimestamp.date(tz=LOCAL)` | Renders a timestamp in a chosen timezone or format. |
| `.yesno()` | `deletionProtection.yesno()` | Converts Boolean values to `yes` or `no`. |
| `.scope()` | `selfLink.scope(zones)` | Extracts a named scope segment from a resource URI when the field is URI-shaped. |

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
| `email` | string | Service account email used for IAM list filters. |
| `displayName` | string | Human-readable service account name. |
| `disabled` | boolean | Service account enabled or disabled state. |
| `config.name` | string | Canonical API service name used in Service Usage filters. |
| `config.title` | string | Human-readable API title used in Service Usage filters. |

#### Filter the service-account list to deployer identities

When you already know the resource family and want to reduce the result set before inspecting it. It is typically triggered by the unfiltered list would include more resources than the current operational question needs. Read-only IAM service-account list command with a filter expression. Return only the account rows that match the requested pattern.

*Filter the service-account list to identities whose email contains `deployer`.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --filter="email:deployer"
```

```text
DISPLAY NAME             EMAIL                                                        DISABLED
GitHub Actions Deployer  github-actions-deployer@dagflow-poc.iam.gserviceaccount.com  False
Terraform Deployer       terraform-deployer@dagflow-poc.iam.gserviceaccount.com       False
```

The filter kept only the two deployer identities. This is the same inventory command as before, but now the selection logic is explicit and machine-reproducible.

#### Combine filtering with scalar output for automation

When a script needs only the filtered subset and only a few scalar fields from that subset. It is typically triggered by you are turning the filtered result into a downstream loop, inventory file, or access-review check. Read-only IAM service-account list command combining `--filter` with `value(...)`. Produce the minimum viable machine-readable output for a filtered resource subset.

*Filter the deployer accounts and emit only email and display name.*

```bash
gcloud iam service-accounts list --project=dagflow-poc --filter="email:deployer" --format="value(email,displayName)"
```

```text
github-actions-deployer@dagflow-poc.iam.gserviceaccount.com	GitHub Actions Deployer
terraform-deployer@dagflow-poc.iam.gserviceaccount.com	Terraform Deployer
```

This is the stable scripting form of the same query. The resource selection happens first, and the remaining rows are reduced to tab-separated scalars.

#### Filter enabled services and format the reduced result

When you need a targeted API inventory instead of the full enabled-service list. It is typically triggered by you care about one subset of services, such as the BigQuery surface or storage APIs. Read-only Service Usage list command. The filter expression is applied to the list result before formatting. Narrow the enabled-service inventory to matching APIs and print only the requested metadata columns.

*Filter the enabled services to the BigQuery family and print only name and title.*

```bash
gcloud services list --enabled --project=dagflow-poc --filter="config.title:BigQuery" --format="table(config.name,config.title)"
```

```text
NAME                                 TITLE
bigquery.googleapis.com              BigQuery API
bigqueryconnection.googleapis.com    BigQuery Connection API
bigquerydatapolicy.googleapis.com    BigQuery Data Policy API
bigquerydatatransfer.googleapis.com  BigQuery Data Transfer API
bigquerymigration.googleapis.com     BigQuery Migration API
bigqueryreservation.googleapis.com   BigQuery Reservation API
bigquerystorage.googleapis.com       BigQuery Storage API
```

This is the pattern you want in automation and reviews: explicit selection logic plus explicit output columns. Nothing else from the enabled-service inventory leaks into the result.

| Flag or operator | Syntax | Description |
|---|---|---|
| `--filter` | `--filter="email:deployer"` | Applies a filter expression to list results. |
| `=` | `disabled=False` | Exact equality comparison. |
| `:` | `email:deployer` | Pattern or substring-style match in the filter language. |
| `~` | `email~'.*-deployer@.*'` | Regular-expression match. |
| `AND` | `disabled=False AND email:deployer` | Both terms must match. |
| `OR` | `email:github-actions OR email:terraform-deployer` | Either term may match. |
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
