---
tags: [infrastructure, terraform, iac]
aliases: [HCL, HashiCorp Configuration Language, HCL syntax, terraform syntax, tf syntax]
description: "HCL (HashiCorp Configuration Language) syntax fundamentals — blocks, arguments, resource naming, file organization, and the difference between Terraform-internal and GCP names."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# HCL Syntax Basics

> [!quote]
> "A language that doesn't affect the way you think about programming is not worth knowing."
>
> — **Alan Perlis**, *Epigrams on Programming* (1982)

HashiCorp Configuration Language (HCL) is a declarative language designed by HashiCorp specifically for infrastructure-as-code. Unlike imperative scripts (bash, Python), you describe _what_ you want and Terraform figures out _how_ to create it. HCL files use the `.tf` extension.

### Blocks and Arguments

HCL has two structural elements:

- **Block** — a container with a type, optional labels, and a body in braces. Example: `resource "google_compute_network" "main" { ... }`. This is a `resource` block with type `google_compute_network` and Terraform-internal name `main`.
- **Argument** — a key-value pair inside a block. Example: `name = "data-pipeline-vpc"`. Sets one property of the resource.

Blocks can be nested. For example, a `resource` block may contain a `template` block, which contains a `containers` block, which contains `env` blocks.

### File Naming and Organization

Terraform merges **all** `.tf` files in a directory into a single configuration. File names have **no impact** on behavior — you could rename `network.tf` to `dodo.tf` and everything would still work. Files are split purely for human readability and organization.

A typical file layout for a GCP project:

| File | Resources | Purpose |
|------|-----------|---------|
| `main.tf` | `terraform`, `provider` | Provider version, GCS backend |
| `variables.tf` | 6 variables | Inputs: project, region, zone, passwords, labels |
| `network.tf` | VPC, subnet, router, NAT, 5 firewall rules | Network isolation and traffic control |
| `compute.tf` | 2 GCE instances | SQL Server VM + Airflow VM |
| `iam.tf` | 3 service accounts, 8 IAM bindings, 4 conditional Datadog bindings | Identity and access management |
| `secrets.tf` | 2 secrets, 2 secret versions | Database password + Datadog API key |
| `registry.tf` | 1 Artifact Registry repository | Docker image storage with cleanup |
| `run.tf` | 1 Cloud Run service, 2 Cloud Run jobs, 1 IAM binding, locals | Dashboard + pipeline + setup |
| `ci.tf` | 1 service account, 4 IAM bindings | GitHub Actions deployment permissions |
| `outputs.tf` | 6 outputs | URLs and IPs for provisioned resources |

## Terraform Name vs GCP Name

Every resource has two names:

#### resource "type" "name" — Terraform-internal name vs GCP name
```hcl
resource "google_compute_firewall" "allow_sql" {   # "allow_sql" = Terraform-internal name
  name = "allow-sql-from-airflow"                          # "allow-sql-from-airflow" = actual name in GCP
}
```

| Name | Where it lives | Used for |
|------|---------------|----------|
| `"allow_sql"` | Terraform only | Referencing this resource in other `.tf` files (e.g., `google_compute_firewall.allow_sql.id`) |
| `"allow-sql-from-airflow"` | GCP | What appears in the Console, `gcloud` commands, and API calls |

They don't have to match.

### Block Types

The `variable` and `output` blocks below are covered in depth in [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs), which extends HCL syntax with parameterization, type constraints, and validation rules.

The most common block types in Terraform:

| Block Type | Purpose | Example |
|------------|---------|---------|
| `terraform` | Top-level configuration — version constraints, backend | `terraform { required_version = ">= 1.5" }` |
| `provider` | Configures a cloud provider | `provider "google" { project = var.project_id }` |
| `resource` | Declares an infrastructure object | `resource "google_compute_network" "main" { ... }` |
| `variable` | Declares an input parameter | `variable "project_id" { type = string }` |
| `output` | Exposes a value after apply | `output "url" { value = resource.uri }` |
| `locals` | Defines computed values | `locals { sql_ip = resource.network_interface[0].network_ip }` |
| `data` | Reads existing infrastructure (not created by this config) | `data "google_project" "current" {}` |

### Declarative vs Imperative

Terraform is declarative: you describe the desired end state, and Terraform computes the steps to reach it. This is fundamentally different from imperative tools like bash scripts or Ansible playbooks, which describe the sequence of actions to perform.

**Declarative (Terraform):** "There should be a VM named data-pipeline-sql with these properties."
**Imperative (bash):** "Run `gcloud compute instances create data-pipeline-sql ...` with these flags."

The declarative approach means Terraform can determine whether a resource already exists, needs updating, or needs to be recreated — and it can handle all three cases automatically.

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

## File Organization Reference

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

- [terraform-providers-and-backend](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-providers-and-backend) — Configuring where Terraform connects and stores state
- [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) — Parameterizing HCL with variables, locals, and outputs
- [terraform-plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-plan-apply-destroy) — The workflow that turns HCL into real infrastructure
- [terraform-state-management](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-state-management) — How Terraform tracks what it has created

## References

- [HCL Native Syntax Specification](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md)
- [Terraform Configuration Language](https://developer.hashicorp.com/terraform/language)
