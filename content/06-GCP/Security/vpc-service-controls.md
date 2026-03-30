---
type: concept
category: gcp
technology: [gcp, security, vpc]
tags: [infrastructure, gcp, security, iam]
aliases: [VPC Service Controls, VPC-SC, service perimeter, access context manager, data exfiltration prevention, GCP data perimeter]
keywords: [VPC service controls, VPC-SC, access context manager, service perimeter, access policy, ingress policy, egress policy, access level, data exfiltration, perimeter, restricted services, violation reason, RESOURCES_NOT_IN_SAME_SERVICE_PERIMETER, NO_MATCHING_ACCESS_LEVEL, financial data security, Terraform VPC-SC, gcloud access-context-manager]
description: "How VPC Service Controls create a data perimeter that prevents exfiltration of BigQuery and GCS data — even for users with IAM admin permissions — and how to configure, audit, and debug VPC-SC violations."
related: [service-accounts-and-iam, gcloud-authentication, cloud-logging, dataset-and-table-management, gcs-buckets-and-lifecycle]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# VPC Service Controls — Preventing Data Exfiltration

IAM controls *who* can access resources. VPC Service Controls (VPC-SC) control *where* data can flow — even if someone has valid IAM permissions. For a data platform project, this is the difference between "an engineer can query BigQuery" and "an engineer can query BigQuery *but cannot copy the results to their personal GCP project*." VPC-SC enforces this at the network level, regardless of IAM role. Even `roles/owner` cannot exfiltrate data past a properly configured perimeter.

### The Data Exfiltration Threat Model

```text
Without VPC-SC:
  Engineer with BigQuery access → runs query → exports results to personal GCS bucket
  Compromised service account → reads GCS → copies data to attacker's project
  Supply chain attack → malicious dependency → exfiltrates data via API call

With VPC-SC:
  All of the above are BLOCKED at the network level, regardless of IAM permissions.
  Data cannot leave the perimeter — even if the requester has roles/owner.
```

## Setting Up a VPC-SC Perimeter

#### gcloud access-context-manager policies create — org-level access policy
```bash
gcloud access-context-manager policies create \
  --organization=123456789 \
  --title="Data Platform Data Protection"
```

#### gcloud access-context-manager levels create — define access level
```bash
gcloud access-context-manager levels create data-pipeline-trusted-engineers \
  --policy=POLICY_ID \
  --title="Data Platform Trusted Engineers" \
  --basic-level-spec=access-level.yaml
  # access-level.yaml defines: specific IP ranges, device policies, identity groups
```

#### gcloud access-context-manager perimeters create — service perimeter
```bash
gcloud access-context-manager perimeters create data-pipeline-data-perimeter \
  --policy=POLICY_ID \
  --title="Data Platform Data Perimeter" \
  --resources="projects/123456789" \
  --restricted-services="bigquery.googleapis.com,storage.googleapis.com,compute.googleapis.com" \
  --access-levels="accessPolicies/POLICY_ID/accessLevels/data-pipeline-trusted-engineers"
```

> [!abstract] What the Perimeter Enforces
>
> - BigQuery, GCS, and Compute Engine are now inside the perimeter
> - Data cannot be copied or exported outside the project
> - Even `roles/owner` cannot exfiltrate data to another project
> - Only engineers matching the access level can reach services from outside

### Terraform Pattern for VPC-SC in Production

```hcl
# vpc_sc.tf — define the security perimeter
resource "google_access_context_manager_service_perimeter" "data_perimeter" {
  parent = "accessPolicies/${var.access_policy_id}"
  name   = "accessPolicies/${var.access_policy_id}/servicePerimeters/project_data_perimeter"
  title  = "Data Platform Data Perimeter"

  status {
    resources = [
      "projects/${data.google_project.data-pipeline.number}"
    ]

    restricted_services = [
      "bigquery.googleapis.com",
      "storage.googleapis.com",
      "compute.googleapis.com",
      "secretmanager.googleapis.com",
    ]

    # Allow specific access levels (trusted networks, managed devices)
    access_levels = [
      google_access_context_manager_access_level.trusted_engineers.name
    ]

    # Ingress policy: allow Airflow VM to call BigQuery
    ingress_policies {
      ingress_from {
        identity_type = "ANY_SERVICE_ACCOUNT"
        sources {
          resource = "projects/${data.google_project.data-pipeline.number}"
        }
      }
      ingress_to {
        resources = ["projects/${data.google_project.data-pipeline.number}"]
        operations {
          service_name = "bigquery.googleapis.com"
          method_selectors { method = "*" }
        }
      }
    }

    # Egress policy: allow pipeline to write to a specific partner bucket
    egress_policies {
      egress_from {
        identity_type = "ANY_SERVICE_ACCOUNT"
      }
      egress_to {
        resources = ["projects/${var.partner_project_number}"]
        operations {
          service_name = "storage.googleapis.com"
          method_selectors { method = "google.storage.objects.create" }
        }
      }
    }
  }
}

resource "google_access_context_manager_access_level" "trusted_engineers" {
  parent = "accessPolicies/${var.access_policy_id}"
  name   = "accessPolicies/${var.access_policy_id}/accessLevels/trusted_engineers"
  title  = "Trusted Engineers"

  basic {
    conditions {
      ip_subnetworks = [
        "203.0.113.0/24",  # Frankfurt office IP range
        "198.51.100.0/24"  # London office IP range
      ]
      required_access_levels = []
    }
  }
}
```

### What VPC-SC Blocks vs Allows

| Scenario | Without VPC-SC | With VPC-SC |
|---|---|---|
| Engineer runs `bq extract` to personal bucket | Succeeds (IAM allows) | **BLOCKED** (bucket outside perimeter) |
| Cloud Function tries to call external API | Succeeds | **BLOCKED** (egress to internet denied unless explicitly allowed) |
| Compromised service account copies GCS data | Succeeds (SA has storage admin) | **BLOCKED** (destination project not in perimeter) |
| Airflow DAG queries BigQuery internally | Succeeds | Succeeds (same project, inside perimeter) |
| Dashboard reads from Cloud Run | Succeeds | Succeeds (same project, inside perimeter) |
| Partner receives daily data export | N/A | Succeeds (explicit egress policy for partner project) |

### Debugging VPC-SC Denial Errors

VPC-SC denials appear in [[cloud-logging|Cloud Audit Logs]] with a specific violation type:

```bash
gcloud logging read 'protoPayload.status.code=7 AND
  protoPayload.metadata.@type="type.googleapis.com/google.cloud.audit.VpcServiceControlAuditMetadata"' \
  --project=data-platform-prod \
  --format="table(timestamp, protoPayload.methodName, protoPayload.metadata.violationReason, protoPayload.metadata.resourceNames)" \
  --limit=20
```

> [!info] Common VPC-SC Violation Reasons
>
> - `RESOURCES_NOT_IN_SAME_SERVICE_PERIMETER` -- trying to access a resource outside the perimeter
> - `NO_MATCHING_ACCESS_LEVEL` -- caller does not meet access level criteria (wrong IP, no managed device)

> [!warning] VPC-SC Is Non-Negotiable
>
> VPC-SC Is Non-Negotiable for Sensitive Data.
> On a data platform, the processed and enriched data is among the most commercially sensitive assets in the system. A single leak of data before public release could have significant consequences. VPC-SC ensures that even an insider with admin-level IAM permissions cannot exfiltrate this data to an external project or bucket. Implement it from day one — retrofitting a perimeter onto existing services is significantly harder than designing with it.

> [!danger] VPC-SC Dry Run First
>
> VPC-SC Dry Run Mode Before Enforcement.
> Deploying VPC-SC in enforce mode without testing will instantly break every cross-project API call, Cloud Build trigger, and external service integration. Always start in **dry run mode** (`--perimeter-type=PERIMETER_TYPE_REGULAR --spec-type=DRY_RUN`) and monitor Cloud Audit Logs for would-be violations for at least one full pipeline cycle before switching to enforce. A single missing ingress rule can take down your entire data platform.

> [!warning] VPC-SC Skips Insider Access
>
> VPC-SC Does Not Protect Against Insider Data Access.
> VPC-SC prevents data from leaving the perimeter, but it does not restrict what users can see within the perimeter. An engineer with BigQuery read access can still query all tables and view all results inside the project. For column-level and row-level restrictions within the perimeter, use BigQuery column-level security and authorized views.

### VPC-SC Ingress and Egress Policies

- **Ingress policies** define what can enter the perimeter from outside. Example: your on-premises Airflow connecting to BigQuery must be declared as an ingress rule.
- **Egress policies** define what data can leave the perimeter. Example: a partner data delivery that writes to an external GCS bucket must be an explicit egress rule.
- Without explicit ingress/egress rules, all cross-perimeter traffic is blocked, regardless of IAM.

## Related

- [[service-accounts-and-iam]] — IAM is the "who"; VPC-SC is the "where" — both layers work together
- [gcloud-authentication](/06-GCP/Core/gcloud-authentication) — Understanding which identity is making requests is essential for debugging VPC-SC
- [[cloud-logging]] — VPC-SC violations appear in Cloud Audit Logs; query them with `gcloud logging read`
- [[dataset-and-table-management]] — BigQuery is one of the primary services protected by VPC-SC
- [[gcs-buckets-and-lifecycle]] — GCS is the other primary service protected by VPC-SC

## References

- [VPC Service Controls overview](https://cloud.google.com/vpc-service-controls/docs/overview)
- [Troubleshooting VPC-SC](https://cloud.google.com/vpc-service-controls/docs/troubleshooting)
- [Ingress and egress rules](https://cloud.google.com/vpc-service-controls/docs/ingress-egress-rules)
