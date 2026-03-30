---
title: "MOC: Orchestration"
tags:
  - moc
  - orchestration
  - airflow
  - scheduling
---

# MOC: Orchestration

Orchestration determines when pipelines run, in what order, and what happens when they fail. These notes cover Apache Airflow for complex DAG-based workflows, platform-native scheduling tools for simpler recurring jobs, and a domain-specific ESG ingestion framework that ties both together.

## Airflow — DAGs, Patterns, Deployment, and Operations

Apache Airflow for programmatic workflow orchestration: architecture, DAG authoring, production deployment, common failure modes, and troubleshooting.

* [[airflow-core-concepts]] — Airflow architecture (Scheduler, Webserver, Worker, Metadata DB), DAG structure, Operators (Bash, Python, Kubernetes), Sensors, Hooks, XComs for cross-task communication, the TaskFlow API, Connections and Variables, and a comparison of all Executor types (Sequential, Local, Celery, Kubernetes)

* [[airflow-dag-patterns]] — task dependency syntax (bitshift operators, chain, cross_downstream), TaskGroups for visual grouping, dynamic DAG generation, BranchPythonOperator for conditional paths, trigger rules (all_success, none_failed, all_done), idempotent pipeline design, backfill strategies, parameterized DAGs with dag_run.conf, dataset-driven scheduling, and SLA/callback configuration

* [[airflow-deployment]] — local Docker Compose setup, self-hosted Airflow on GCE, GCP Cloud Composer (managed), AWS MWAA, airflow.cfg configuration reference, DAG deployment strategies (git-sync, GCS bucket), secrets management with GCP Secret Manager, monitoring with StatsD, and cost comparisons across deployment options

* [[airflow-problems]] — 25 production problems ranked by severity including scheduler crash/hang, zombie tasks, tasks stuck in queued, metadata DB deadlocks, worker OOM kills, DAG import errors at scale, and prevention protocols for financial pipeline SLAs

* [[airflow-troubleshooting]] — DAG import error diagnosis, task failure debugging, scheduler not picking up DAGs, tasks stuck in queued or running, metadata DB connection refused, XCom size limits, worker OOM, zombie task cleanup, and key CLI commands (dags list, tasks test, tasks clear, db check)

## Scheduling — Cron, Systemd, Cloud Scheduler, and Windows Task Scheduler

Platform-native scheduling tools for recurring jobs that do not require a full orchestration framework: Linux cron and systemd timers, GCP Cloud Scheduler and Cloud Workflows, and Windows Task Scheduler.

* [[linux-scheduling]] — cron syntax and crontab management, systemd timers with OnCalendar, at/batch for one-time jobs, anacron for intermittent machines, overlap prevention with flock, cron environment and PATH gotchas, SSH configuration for remote scheduling, and a decision table for cron vs Airflow vs Cloud Scheduler

* [[gcp-scheduling]] — Cloud Scheduler (managed cron-as-a-service) with HTTP, Pub/Sub, and App Engine targets, Cloud Tasks for durable rate-limited queues, Cloud Workflows for multi-step serverless orchestration, Eventarc for event-driven triggers, wiring patterns for Cloud Run jobs and Cloud Functions, and a cost/capability comparison across all four services

* [[windows-scheduling]] — schtasks.exe (legacy CLI), PowerShell ScheduledTasks module (Register-ScheduledTask, triggers, settings), PSScheduledJob for native PowerShell output, data engineering patterns for SSIS/sqlcmd/Python pipelines, event-based triggers (ONLOGON, ONEVENT), and a mapping to Linux cron equivalents

## Data Ingestion Patterns — ESG Framework and Circuit Breakers

A domain-specific ingestion framework for multi-vendor ESG data that combines scheduling, quality gates, and anomaly detection into a production pipeline pattern.

* [[esg-data-ingestion-framework]] — multi-vendor ESG score normalization (MSCI, Sustainalytics, ISS, Bloomberg), the Sustainalytics inversion trap, circuit breaker patterns for anomaly detection, carbon footprint calculation (WACI/SFDR), coverage checks, forward-fill strategies, Terraform IAM for segregated read/write service accounts, and Airflow DAG orchestration for the full ingestion flow

## Cross-References

- [[moc-data-architecture|Data Architecture]] — pipeline patterns that Airflow orchestrates
- [[docker-compose]] — running Airflow locally via Docker Compose
- [[cloud-run-jobs-vs-services]] — serverless targets Airflow triggers
- [[datadog-airflow-observability]] — monitoring Airflow with Datadog
- [[github-actions-ci-cd]] — deploying DAGs automatically via CI/CD
- [[dbt-airflow-integration]] — running dbt in Airflow DAGs (BashOperator, Cosmos, Cloud Run)
