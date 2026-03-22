---
tags: [how-to, operations, quick-reference]
type: how-to
technology: []
status: stable
updated: 2026-03-23
---

# Common Tasks

Quick routing guide for everyday operations. Each entry tells you where to go for the full procedure.

## Index and Data Operations

**How do I add a new stock to the index universe?**
Update the constituent list in the index methodology YAML, run the rebalancing pipeline, and verify weights sum to 1.0. See [[pit-integrity-logic]] for weight normalization and [[index-maintenance-and-corporate-actions]] for the full reconstitution process.

**How do I backfill N months of historical data?**
Use the idempotent backfill pattern with chunked date ranges and rollback checkpoints. See [[idempotent-pipeline-design]] and [[migration-idempotency-backfills]] for the chunking strategy and exactly-once patterns.

**How do I add a new ESG data vendor?**
Add the vendor normalization function, configure the Airflow ingestion task, update the circuit breaker thresholds, and register the vendor in the data contract. See [[esg-data-ingestion-framework]] for the full vendor onboarding workflow.

**How do I investigate why an index value looks wrong today?**
Run the reproducibility test to trace the published level back to its input prices and weights. See [[compliance-and-auditability]] for the step-by-step reproducibility script and [[data-restatement-procedure]] if a correction is needed.

## Infrastructure

**How do I deploy a new Airflow DAG to production?**
Push the DAG file to the repo, merge to main, and the Docker image rebuild picks it up. See [[airflow-dag-patterns]] for DAG design and [[airflow-deployment]] for the deployment workflow.

**How do I resize the SQL Server VM?**
Stop the VM, change the machine type, restart. For disk resize (online), see [[sql-server-disk-full]] runbook. For right-sizing recommendations, see [[gcp-cost-monitoring-and-budgets]].

**How do I add a new BigQuery dataset and table?**
Define it in Terraform using the `google_bigquery_dataset` and `google_bigquery_table` resources. See [[tf-data-services]] for copy-paste Terraform blocks and [[dataset-and-table-management]] for the gcloud/bq CLI approach.

**How do I create a new Terraform resource?**
Find the resource type in [[tf-foundation-and-networking]], [[tf-compute-and-storage]], [[tf-iam-secrets-serverless]], or [[tf-data-services]]. Copy the block, customize, run `terraform plan`, review, `terraform apply`.

**How do I set up a new GCP project/environment?**
Use the Terraform foundation blocks to create the project, enable APIs, set up networking, and configure IAM. See [[tf-foundation-and-networking]] for the provider and project setup.

## Security and Operations

**How do I rotate a service account key?**
Create a new key, update all references (Secret Manager, Airflow connections), verify the new key works, then delete the old key. See [[secrets-management]] for the full rotation procedure.

**How do I run a backup restore drill?**
Follow the [[backup-restore-drill]] runbook: restore to a test instance, run integrity checks, compare row counts, measure RTO, and document results.

**How do I add a new Datadog monitor?**
Define the monitor in the Datadog UI or via Terraform. See [[datadog-alerting]] for monitor types and thresholds, and [[tf-data-services]] for the Terraform `datadog_monitor` pattern.

**How do I replay failed Pub/Sub messages?**
Inspect the dead letter topic, identify poison messages, fix the consumer, then replay. See [[pubsub-dead-letter-backup]] runbook for the step-by-step procedure.

**How do I run a cost review?**
Check the billing dashboard, review Recommender suggestions, audit idle resources, and compare month-over-month spend. See [[gcp-cost-monitoring-and-budgets]] for the weekly checklist and [[gcp-total-cost-of-ownership]] for reference architecture costs.

## Related

- [[Dashboard]] — Main navigation hub
- [[runbooks-index]] — Incident response procedures
- [[golden-rules-of-data-engineering]] — Decision-making principles
- [[technology-selection-matrices]] — Which tool for which task
