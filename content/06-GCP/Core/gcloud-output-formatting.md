---
tags: [infrastructure, gcp, gcloud]
aliases: [gcloud format, gcloud filter, gcloud output, gcloud --format, gcloud --filter]
description: "How to use gcloud --format and --filter flags to extract structured data from GCP APIs, enabling scriptable output in table, value, CSV, JSON, and flattened formats."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# gcloud Output Formatting and Filtering

> [!quote]
> "The difference between a gcloud command that works in a script and one that doesn't is the --format flag."
>
> — **Ahmet Alp Balkan**, Google Cloud developer tools engineer

The `--format` and `--filter` flags are the most underused features of the [gcloud CLI](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication). They transform gcloud from a human-readable tool into a scriptable data extraction engine, enabling you to pipe exact field values into shell scripts, build inventory automation, and run server-side filtered queries instead of grepping local output.

### Why gcloud Output Formatting Matters

Without `--format`, gcloud outputs human-readable tables that are difficult to parse programmatically. Without `--filter`, you must download all results and filter locally. Together these flags let you:
- Extract single fields as newline-separated values for shell loops
- Push filtering to the API server (faster, fewer bytes transferred)
- Output CSV or JSON for downstream processing
- Test IAM permissions by impersonating a service account

## Output Format Options

#### --format default table — human-readable output
```bash
gcloud compute instances list
# NAME        ZONE             MACHINE_TYPE  STATUS
# data-pipeline-sql   europe-west1-b   e2-standard-2 RUNNING
# data-pipeline-air   europe-west1-b   e2-medium     RUNNING
```

#### --format=json — programmatic output for jq parsing
```bash
gcloud compute instances list --format=json
# Full JSON output with every field — pipe to jq for extraction
```

#### --format="value(field)" — extract a single field for scripting
```bash
gcloud compute instances list --format="value(name)"
# Output: data-pipeline-sql\nproject-air
# "value()" = extract raw field value, one per line, no headers
# CRITICAL for scripting: for vm in $(gcloud compute instances list --format="value(name)"); do ...
```

#### --format="table(field.basename())" — multiple fields with transforms
```bash
gcloud compute instances list --format="table(name,zone.basename(),status,machineType.basename())"
# table() = formatted table with headers
# .basename() = extract just the last part of a URL path
#   (machineType is a full URL like .../machineTypes/e2-medium — basename extracts "e2-medium")
```

#### --format="csv(fields)" — CSV output for spreadsheets
```bash
gcloud compute instances list --format="csv(name,zone.basename(),status)"
```

#### --format="flattened(field)" — expand nested structures
```bash
gcloud compute instances describe data-pipeline-sql --zone=europe-west1-b --format="flattened(networkInterfaces)"
# Flattened = dot-notation for nested fields
# networkInterfaces[0].accessConfigs[0].natIP: 34.76.xxx.xxx
```

## Server-Side Filtering with `--filter`

> [!info] Filter operators
> - `=` — exact match
> - `~` — regex match
> - `:` — substring match
> - `AND` / `OR` / `NOT` — logical operators
> - Faster than piping to `grep` because the API returns only matching results

```bash
gcloud compute instances list --filter="status=RUNNING AND name~data-pipeline"
```

#### --filter + --format — combine filtering and formatting for scripts
```bash
gcloud compute instances list --filter="status=RUNNING" --format="value(name,networkInterfaces[0].networkIP)"
# Returns: name and internal IP of all running VMs, tab-separated, no headers
# Perfect for: building inventory scripts, feeding into other commands
```

### Service Account Impersonation with gcloud

```bash
# Service account impersonation (act as a service account without a key file)
gcloud compute instances list --impersonate-service-account=pipeline-sa@project.iam.gserviceaccount.com
# Tests what the service account can see — without needing its key file
# Use case: "Can the pipeline service account list VMs?" (testing IAM permissions)
```

> [!info] Full Format Expression Language
>
> The `--format` specification is a complete expression language supporting:
> - **Projections:** `table(name, status)` — select specific fields
> - **Transformations:** `.basename()`, `.date()`, `.len()`, `.yesno()` — modify values
> - **Conditionals:** `table(name, status.color(green=RUNNING,red=TERMINATED))` — colorize output
> - **Sorting:** `table(name, status:sort=1)` — sort by column
> - **URI parsing:** `.scope()` extracts project/zone from resource URIs
>
> Read the full reference: `gcloud topic formats`

### Common gcloud Format Transformation Functions

| Function | What it does | Example |
|---|---|---|
| `.basename()` | Last path segment from a URL | `machineType.basename()` → `e2-medium` |
| `.date()` | Format a timestamp | `creationTimestamp.date()` |
| `.len()` | Length of a list | `disks.len()` |
| `.yesno()` | Boolean to yes/no string | `deletionProtection.yesno()` |
| `.scope()` | Extract project/zone scope | `selfLink.scope(zones)` |

## Related

- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication) — How authentication tokens work with formatted output
- [gcloud-configurations](https://alp78.github.io/elysium/06-GCP/Core/gcloud-configurations) — Switching projects before running formatted queries
- [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis) — Listing projects and enabled APIs with formatted output
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — Impersonating service accounts to test permissions

---

### Useful gcloud One-Liners

Compound commands for daily GCP operations — project info, failed job lookup, IAM auditing, BigQuery slot usage, storage inspection.

```bash
# Current project, account, and active config
gcloud config list --format="value(core.project,core.account)"

# Cloud Run jobs that failed in the last 24 hours
gcloud logging read \
  'resource.type="cloud_run_job" AND severity=ERROR' \
  --freshness=24h --limit=50 --format=json \
  | jq '.[] | {job: .resource.labels.job_name, time: .timestamp, msg: .textPayload}'

# All service accounts with creation dates
gcloud iam service-accounts list \
  --format="table(email,displayName,oauth2ClientId)"

# Roles assigned to a specific service account
gcloud projects get-iam-policy fin-prod-project \
  --format=json | jq \
  '.bindings[] | select(.members[] | contains("pipeline-sa@fin-prod-project")) | .role'

# BigQuery slot utilisation for today
bq query --use_legacy_sql=false --format=prettyjson '
  SELECT job_id, user_email, total_slot_ms, total_bytes_processed
  FROM `region-EU.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
  WHERE DATE(creation_time) = CURRENT_DATE()
  ORDER BY total_slot_ms DESC LIMIT 20'

# Largest objects in a GCS bucket
gcloud storage ls -l 'gs://fin-datalake-bucket/**' \
  | sort -rn -k1 | head -20

# Firewall rules allowing ingress from 0.0.0.0/0
gcloud compute firewall-rules list \
  --filter="direction=INGRESS AND sourceRanges:0.0.0.0/0" \
  --format="table(name,network,allowed[].ports,targetTags)"

# Call a private Cloud Run service with identity token
TOKEN=$(gcloud auth print-identity-token)
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  https://prices-api-xyz-ew.a.run.app/v1/prices/AAPL
```

## References

- `gcloud topic formats` — full format expression language reference
- `gcloud topic filters` — full filter expression language reference
