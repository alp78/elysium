---
type: reference
category: reference
technology: [gcp, gcloud]
tags: [reference, cheat-sheet, gcp, gcloud]
aliases: [gcloud cheat sheet, gcloud quick reference, GCP CLI cheat sheet]
keywords: [gcloud, cheat sheet, quick reference, compute, bigquery, cloud run, storage, iam, pubsub, logging, gcp commands]
description: "Quick reference cheat sheet for the most common gcloud CLI commands across Compute Engine, BigQuery, Cloud Run, Storage, IAM, Pub/Sub, and Logging."
related:
  - "[[gcloud-authentication]]"
  - "[[gcloud-configurations]]"
  - "[[gcloud-output-formatting]]"
  - "[[vm-lifecycle]]"
  - "[[dataset-and-table-management]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# gcloud CLI Cheat Sheet

Quick reference for the most-used gcloud commands. For detailed explanations, follow the wikilinks to the full notes.

## Authentication and Config

```bash
gcloud auth login                              # Interactive browser login
gcloud auth application-default login          # ADC for client libraries
gcloud config set project PROJECT_ID           # Set default project
gcloud config set compute/region europe-west1  # Set default region
gcloud config configurations list              # List all configs
gcloud config configurations activate CONFIG   # Switch config
```

See [[gcloud-authentication]] and [[gcloud-configurations]].

## Compute Engine

```bash
gcloud compute instances list                                    # List all VMs
gcloud compute instances start INSTANCE --zone=ZONE              # Start VM
gcloud compute instances stop INSTANCE --zone=ZONE               # Stop VM
gcloud compute ssh INSTANCE --zone=ZONE --tunnel-through-iap     # SSH via IAP
gcloud compute scp LOCAL INSTANCE:REMOTE --zone=ZONE --tunnel-through-iap  # Copy file
gcloud compute start-iap-tunnel INSTANCE PORT --local-host-port=localhost:LOCAL_PORT --zone=ZONE
```

See [[vm-lifecycle]] and [[iap-tunneling]].

## BigQuery

```bash
bq ls                                          # List datasets
bq ls DATASET                                  # List tables in dataset
bq show --schema --format=prettyjson DATASET.TABLE  # Show schema
bq query --use_legacy_sql=false 'SELECT ...'   # Run query
bq query --dry_run --use_legacy_sql=false 'SELECT ...'  # Estimate cost
bq load --source_format=CSV DATASET.TABLE gs://BUCKET/file.csv  # Load from GCS
bq extract DATASET.TABLE gs://BUCKET/export.csv  # Export to GCS
```

See [[dataset-and-table-management]] and [[querying-and-cost-optimization]].

## Cloud Run

```bash
gcloud run jobs list                           # List jobs
gcloud run jobs execute JOB --region=REGION    # Execute job
gcloud run jobs executions list --job=JOB --region=REGION  # List executions
gcloud run services list                       # List services
gcloud run services update SERVICE --image=IMAGE --region=REGION  # Update service
```

See [[cloud-run-jobs-vs-services]].

## Cloud Storage

```bash
gcloud storage ls gs://BUCKET/                 # List objects
gcloud storage cp LOCAL gs://BUCKET/           # Upload
gcloud storage cp gs://BUCKET/FILE LOCAL       # Download
gcloud storage rsync LOCAL gs://BUCKET/ --recursive  # Sync directory
gcloud storage rm gs://BUCKET/FILE             # Delete object
```

See [[gcs-object-operations]] and [[gcs-buckets-and-lifecycle]].

## IAM

```bash
gcloud iam service-accounts list               # List service accounts
gcloud iam service-accounts create NAME        # Create SA
gcloud projects add-iam-policy-binding PROJECT --member=serviceAccount:SA --role=ROLE
gcloud iam service-accounts keys create key.json --iam-account=SA  # Create key (avoid)
```

See [[service-accounts-and-iam]].

## Pub/Sub

```bash
gcloud pubsub topics list                      # List topics
gcloud pubsub topics create TOPIC              # Create topic
gcloud pubsub subscriptions create SUB --topic=TOPIC  # Create subscription
gcloud pubsub subscriptions pull SUB --limit=5 --auto-ack  # Pull messages
```

See [[pubsub-topics-and-subscriptions]].

## Logging

```bash
gcloud logging read 'severity>=ERROR' --limit=50 --format=json
gcloud logging read 'resource.type="cloud_run_job" AND textPayload:"pipeline"' --limit=20
gcloud logging tail 'resource.type="gce_instance"'  # Real-time tail
```

See [[cloud-logging]].
