---
type: concept
category: gcp
technology: [gcp, cloud-storage]
tags: [infrastructure, gcp, gcs]
aliases: [GCS buckets, GCS lifecycle, GCS storage classes, GCS versioning, Cloud Storage lifecycle rules, STANDARD NEARLINE COLDLINE ARCHIVE]
keywords: [GCS bucket, cloud storage, storage class, STANDARD, NEARLINE, COLDLINE, ARCHIVE, lifecycle rules, versioning, SetStorageClass, auto-transition, auto-delete, uniform bucket level access, location, data residency, lifecycle.json, cost optimization, retrieval cost]
description: "How to create GCS buckets with appropriate storage classes and configure lifecycle rules to automatically transition objects through STANDARD → NEARLINE → COLDLINE → ARCHIVE, reducing storage costs for aging pipeline data."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCS Buckets and Lifecycle — Storage Classes and Cost Management

Cloud Storage pricing is not uniform — there are four storage classes with different monthly storage costs and retrieval costs. The pattern is: lower storage cost = higher retrieval cost. Lifecycle rules automate the transition of objects through these classes as data ages, and automatic deletion at the end of the retention period. Aligning lifecycle deletion ages with your [backup retention policy](https://alp78.github.io/elysium/04-SQL-Server/Administration/backup-types-and-strategy) ensures you never delete data that hasn't been backed up elsewhere. Configuring lifecycle rules on pipeline buckets is a one-time setup that permanently reduces storage costs without any ongoing maintenance.

### Creating GCS Buckets with gcloud storage

```bash
# Create a bucket
gcloud storage buckets create gs://data-pipeline-pipeline-data \
  --location=EU --default-storage-class=STANDARD --uniform-bucket-level-access
# --location = EU (multi-region), europe-west1 (single region), or dual-region
# --default-storage-class = STANDARD | NEARLINE | COLDLINE | ARCHIVE
# --uniform-bucket-level-access = simplified IAM (recommended, disable ACLs)
```

> [!tip] Use Uniform Bucket-Level Access
>
> Always Use Uniform Bucket-Level Access.
> `--uniform-bucket-level-access` disables per-object ACLs and enforces IAM-only access control. This is simpler to manage, audit, and secure. It is the recommended setting for all new buckets. Once enabled, it cannot be disabled for 90 days.

### GCS Storage Classes and Cost Trade-offs

Lower storage cost = higher retrieval cost. Match class to access pattern — a single class change on a multi-TB bucket can save thousands per month.

| Class | Storage cost | Min storage duration | Retrieval cost | Best for |
|---|---|---|---|---|
| STANDARD | $0.020/GB/mo | None | None | Active pipeline data |
| NEARLINE | $0.010/GB/mo | 30 days | $0.01/GB | Monthly reports, staging |
| COLDLINE | $0.004/GB/mo | 90 days | $0.02/GB | Quarterly backups |
| ARCHIVE | $0.001/GB/mo | 365 days | $0.05/GB | Legal hold, long-term |

Choosing the right storage class is one of the most impactful [finops-cost-optimization](https://alp78.github.io/elysium/04-SQL-Server/Administration/finops-cost-optimization) levers available in GCP -- a single class change on a multi-TB bucket can save thousands per month.

> [!warning] Minimum Duration Charges
>
> Minimum Storage Duration Charges.
> Moving an object to NEARLINE before 30 days charges you for the full 30 days regardless. COLDLINE has a 90-day minimum, ARCHIVE has 365 days. Only transition objects when you are confident they won't need to be deleted before the minimum duration expires.

### GCS Lifecycle Rules for Auto-Tiering

Lifecycle rules automate object transitions and deletions. Define rules in a JSON file and apply to the bucket.

```bash
# Lifecycle rules (auto-transition and auto-delete)
cat > lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
      "condition": {"age": 30}
    },
    {
      "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
      "condition": {"age": 90}
    },
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}
EOF
gcloud storage buckets update gs://data-pipeline-pipeline-data --lifecycle-file=lifecycle.json
# Objects are automatically transitioned: STANDARD → NEARLINE (30d) → COLDLINE (90d) → deleted (365d)
# Set and forget — GCS handles the transitions automatically
```

> [!tip] Lifecycle Rules Are Automatic
>
> Lifecycle Rules Are "Set and Forget".
> Once configured, lifecycle rules run automatically with no ongoing maintenance. They are evaluated daily. For pipeline staging buckets, a common pattern is: STANDARD for 30 days (active pipeline window) → NEARLINE for 60 days (occasional re-processing) → COLDLINE for 275 days (compliance retention) → deleted at 365 days.

### GCS Object Versioning

```bash
# Enable versioning (protect against accidental overwrites)
gcloud storage buckets update gs://data-pipeline-pipeline-data --versioning
# Every overwrite creates a new version instead of replacing the object
# Retrieve old versions: gcloud storage ls -a gs://bucket/file.csv (shows all versions)
```

> [!info] Versioning with Lifecycle Rules
>
> Versioning and Lifecycle Rules Together.
> When versioning is enabled, overwritten objects become "noncurrent" versions rather than being deleted. Lifecycle rules can be configured to delete noncurrent versions after N days using the `"isLive": false` condition, preventing unbounded storage growth while retaining a short recovery window.

> [!tip] Related pattern
>
> For reproducible bucket provisioning with lifecycle rules baked in, use [Terraform storage blocks](https://alp78.github.io/elysium/07-Terraform/Block-Library/tf-compute-and-storage) instead of manual `gcloud` commands.

### GCS Bucket Location and Data Residency

The `--location` flag determines where data is physically stored:
- **Multi-region** (`EU`, `US`, `ASIA`) — data replicated across multiple regions, highest availability
- **Dual-region** (`EUR4`, `NAM4`) — two specific regions, good for disaster recovery
- **Single region** (`europe-west1`) — lowest latency within that region, lowest cost

For data residency compliance (GDPR, financial regulations), use a specific region or `EU` multi-region. Location cannot be changed after bucket creation.

## Related

- [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations) — Uploading, syncing, moving, and deleting objects within these buckets
- [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export) — Loading bucket contents into BigQuery; exporting BigQuery to buckets
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — `roles/storage.objectAdmin` on specific buckets (not the project)
- [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis) — `storage.googleapis.com` is usually enabled by default

## References

- [Storage classes](https://cloud.google.com/storage/docs/storage-classes)
- [Lifecycle configuration](https://cloud.google.com/storage/docs/lifecycle)
- [Object versioning](https://cloud.google.com/storage/docs/object-versioning)
