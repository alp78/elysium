---
title: "Domain: GCP Integration"
tags:
  - domain
  - programming-languages
---

# GCP Integration

Google Cloud Platform client libraries, security, data transfer, ingestion, and streaming in Python and C#.

```mermaid
mindmap
  ((GCP Integration))
    (GCP client libraries)
    (security setup)
    (security operations)
    (data transfer)
    (data ingestion)
    (streaming, real-time)
```

> [!abstract]- GCP Client Libraries
>
> - Authentication and setup — [[17_py_gcp#Authentication & Setup|py]] · [[17_cs_gcp#Authentication & Setup|cs]]
> - Cloud Storage (GCS) — [[17_py_gcp#Cloud Storage (GCS)|py]] · [[17_cs_gcp#Cloud Storage (GCS)|cs]]
> - BigQuery — [[17_py_gcp#BigQuery|py]] · [[17_cs_gcp#BigQuery|cs]]
> - Pub/Sub — [[17_py_gcp#Pub|py]] · [[17_cs_gcp#Pub|cs]]
> - Firestore — [[17_py_gcp#Firestore|py]] · [[17_cs_gcp#Firestore|cs]]
> - Secret Manager — [[17_py_gcp#Secret Manager|py]] · [[17_cs_gcp#Secret Manager|cs]]

> [!abstract]- Security Setup (Python only)
>
> - GCP project and billing — [[20_py_security_setup#GCP Project|py]]
> - Service account and IAM role bindings — [[20_py_security_setup#Service Account|py]]
> - Cloud KMS and Secret Manager — [[20_py_security_setup#Cloud KMS|py]]
> - Cloud Storage and Compute Engine — [[20_py_security_setup#Cloud Storage|py]]
> - Cloud SQL — [[20_py_security_setup#Cloud SQL|py]]
> - Workload Identity Federation — [[20_py_security_setup#Workload Identity Federation|py]]

> [!abstract]- Security Operations
>
> - Identity and authentication — [[21_py_security_operations#Identity and Authentication|py]] · [[21_cs_security_operations#Identity and Authentication|cs]]
> - Secret Manager lifecycle — [[21_py_security_operations#Secret Manager — Secure Secret Lifecycle|py]] · [[21_cs_security_operations#Secret Manager — Secure Secret Lifecycle|cs]]
> - Cloud KMS encryption and key management — [[21_py_security_operations#Cloud KMS — Encryption and Key Management|py]] · [[21_cs_security_operations#Cloud KMS — Encryption and Key Management|cs]]
> - Cloud SQL authentication and encryption — [[21_py_security_operations#Cloud SQL — SQL Server Authentication and Encryption|py]] · [[21_cs_security_operations#Cloud SQL — SQL Server Authentication and Encryption|cs]]
> - BigQuery secure data operations — [[21_py_security_operations#BigQuery — Secure Data Operations|py]] · [[21_cs_security_operations#BigQuery — Secure Data Operations|cs]]
> - Cloud Storage encryption and access control — [[21_py_security_operations#Cloud Storage — Encryption and Access Control|py]] · [[21_cs_security_operations#Cloud Storage — Encryption and Access Control|cs]]

> [!abstract]- Data Transfer
>
> - Upload files from local to GCS — [[22_py_data_transfer#Upload files from Local to GCS|py]] · [[22_cs_data_transfer#Data Transfer Methods|cs]]
> - Copy files from local to VM — [[22_py_data_transfer#Copy files from Local to VM|py]] · [[22_cs_data_transfer#Local → VM Transfer Benchmarks|cs]]
> - Transfer files from VM to GCS — [[22_py_data_transfer#Transfer files from VM to GCS|py]] · [[22_cs_data_transfer#Transfer files from VM to GCS|cs]]
> - Parallel transfer — [[22_py_data_transfer#Parallel Transfer|py]] · [[22_cs_data_transfer#Parallel Transfer|cs]]
> - File compression benchmarks — [[22_py_data_transfer#File Compression Benchmarks|py]] · [[22_cs_data_transfer#File Compression Benchmarks|cs]]

> [!abstract]- Data Ingestion
>
> - Local to SQL Server ingestion — [[23_py_data_ingestion#Local → SQL Server Ingestion|py]] · [[23_cs_data_ingestion#Local → SQL Server Ingestion|cs]]
> - Local to BigQuery ingestion — [[23_py_data_ingestion#Local → BigQuery Ingestion|py]] · [[23_cs_data_ingestion#Local → BigQuery Ingestion|cs]]
> - GCS to BigQuery ingestion — [[23_py_data_ingestion#GCS → BigQuery Ingestion|py]] · [[23_cs_data_ingestion#GCS → BigQuery Ingestion|cs]]
> - Cross-service transfers — [[23_py_data_ingestion#Cross-Service Transfers|py]] · [[23_cs_data_ingestion#Cross-Service Transfers|cs]]
> - Export — [[23_py_data_ingestion#Export|py]] · [[23_cs_data_ingestion#Export|cs]]

> [!abstract]- Streaming and Real-Time
>
> - WebSocket streaming — [[24_py_streaming_realtime#WebSocket Streaming|py]] · [[24_cs_streaming_realtime#WebSocket Streaming|cs]]
> - Server-Sent Events (SSE) — [[24_py_streaming_realtime#Server-Sent Events (SSE)|py]] · [[24_cs_streaming_realtime#Server-Sent Events (SSE)|cs]]
> - Google Cloud Pub/Sub — [[24_py_streaming_realtime#Google Cloud Pub|py]] · [[24_cs_streaming_realtime#Google Cloud Pub|cs]]
> - Firestore real-time listener — [[24_py_streaming_realtime#Firestore Real-Time Listener|py]] · [[24_cs_streaming_realtime#Firestore Real-Time Listener|cs]]
> - Latency comparison — [[24_py_streaming_realtime#Latency Comparison|py]] · [[24_cs_streaming_realtime#Latency Comparison|cs]]
