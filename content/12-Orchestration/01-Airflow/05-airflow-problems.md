---
title: "05 - Airflow Problems"
tags:
  - orchestration
  - airflow
description: "Real production problems and anti-patterns observed while bringing the STOXX Airflow platform online, with symptoms, root causes, remediations, and permanent guardrails."
created: 2026-03-22
updated: 2026-04-13
status: complete
parent: "[[domain-airflow]]"
links:
  - "[[01-airflow-core-concepts]]"
  - "[[02-airflow-dag-patterns]]"
  - "[[03-airflow-deployment]]"
  - "[[04-airflow-troubleshooting]]"
---

# Airflow Problems

The most useful Airflow problem catalog is the one created by real rollout pain. This note does not rank fictional incident types. It captures the concrete mistakes, wrong assumptions, and brittle choices that surfaced while deploying and extending the STOXX Airflow platform on `stoxx-airflow`.

## What This Note Covers

This note turns the rollout and troubleshooting history into platform guardrails.

- The control-plane mistakes that made the Airflow runtime look broken when it was actually incomplete or misconfigured.
- The integration mistakes that caused Cloud Run, SQL Server, and BigQuery failures after Airflow had already done its job.
- The operational anti-patterns that created false alarms or avoidable deployment friction.

## Glossary / Key Terms

> [!info] Key Terms
>
> | Term | Definition | Why it matters here | Caveat |
> |---|---|---|---|
> | Guardrail | A standard that prevents a known failure mode from recurring. | Every problem in this note ends with a guardrail. | A guardrail is only useful if it becomes part of the standard deployment sequence. |
> | Hidden dependency | A requirement that exists even when it is not obvious from the task code. | `google_cloud_default`, IAM roles, DAG pause state, and service-agent propagation were all hidden dependencies. | Hidden dependencies usually appear only during the first failure. |
> | Drift | The runtime no longer matches the intended configuration. | A blank `SERVING_JOB` default created configuration drift during restart. | Drift often produces noisy partial failures rather than a single clean error. |
> | False incident | An alert or failure signal produced by the diagnostic tooling rather than the platform itself. | The broken SQL-monitor loop created a false Airflow outage signal. | False incidents are expensive because they redirect attention away from the real system state. |
> | Integration boundary | The point where Airflow hands work to another service. | Most real failures happened at boundaries with Cloud Run, SQL Server, BigQuery, or Firestore. | Airflow can only expose these failures cleanly; it cannot fix them by itself. |

## Critical Control-Plane Problems

These problems directly affected Airflow's ability to schedule or to be trusted as an orchestration surface.

### Problem 1: Assuming VM Credentials Make Airflow Connections Optional

The first important mistake was confusing Google credentials with Airflow connection metadata.

#### Symptom

The Google operator path was not usable on a fresh bootstrap even though the VM already had a valid service account.

#### Root Cause

Application Default Credentials solved the credential source, but Airflow still expected the `google_cloud_default` connection object to exist in the metadata database.

#### Remediation

Create the connection explicitly:

```text
airflow connections add google_cloud_default --conn-uri 'google-cloud-platform://'
```

#### Guardrail

Add connection seeding to every new Airflow environment bootstrap. Treat provider connection objects as first-class deployment assets, not as optional UI metadata.

> [!danger] Credential Source And Airflow Metadata Are Not The Same Thing
>
> A VM service account can be perfectly valid while Airflow still fails because the expected connection record does not exist.
>
> [!success] Seed Both Layers
>
> Bootstrap the Airflow connection catalog and then validate that the provider resolves credentials through the intended source.

### Problem 2: Assuming A Visible DAG Is Runnable

This was the most misleading pure-Airflow state problem encountered during rollout.

#### Symptom

`stoxx_stage_yfinance` appeared in the DAG catalog, but the run still did not advance as expected.

#### Root Cause

The DAG was visible but paused. Airflow had parsed it correctly and still refused to schedule it.

#### Remediation

Check visibility and pause state separately. Unpause the DAG explicitly after deployment.

#### Guardrail

Make `airflow dags list | grep <dag_id>` and an explicit pause-state check part of the mandatory post-deploy validation. Never stop at “the DAG shows up in the UI.”

### Problem 3: Allowing Required Runtime Variables To Default To Blank

This problem did not destroy the stack outright, but it made the platform noisy and fragile at exactly the wrong moment.

#### Symptom

The Airflow containers restarted with repeated warnings:

```text
The "SERVING_JOB" variable is not set. Defaulting to a blank string.
```

and several services sat in `health: starting`.

#### Root Cause

The Compose file depended on an environment variable that was not always populated. That created drift between the intended DAG behavior and the actual runtime environment.

#### Remediation

Bake the safe default directly into Compose:

```yaml
SERVING_JOB: ${SERVING_JOB:-stoxx-serving}
```

#### Guardrail

Every environment variable that identifies an external dependency should either be required and prevalidated or have a safe default in the deployment manifest itself.

## High-Impact Integration Problems

These problems happened after Airflow had already done its job of scheduling a task. The failures lived at service boundaries.

### Problem 4: Treating Cloud Run Networking As A Naming Exercise

The first serving rollout failed before the container code even started.

#### Symptom

Cloud Run job execution failed with:

```text
VPC connector projects/bq-wh-nb/locations/europe-west1/connectors/default does not exist
```

#### Root Cause

The job configuration referenced a VPC connector as if it were interchangeable with the default VPC network and subnet. It was not.

#### Remediation

Redeploy the job using the actual networking mode in use:

- `--network=default`
- `--subnet=default`
- `--vpc-egress=private-ranges-only`

#### Guardrail

Validate networking assumptions directly against the target service. Do not wire Airflow to a Cloud Run job definition that has never been tested with the real network mode.

### Problem 5: Using A Pipeline Login Without Testing The Full Transform Privilege Surface

This is a classic data-platform error: the login can connect, but it still cannot execute the real workload.

#### Symptom

The transform job failed with SQL Server error `229`:

```text
The SELECT permission was denied on the object 'eurostoxx50_ohlcv', database 'stoxx', schema 'silver'.
```

#### Root Cause

The service login `stoxx_pipeline` had an incomplete permission model. It could reach the database, but it did not have all the schema-level privileges needed by the transform path.

#### Remediation

Grant the missing select and write permissions needed by the transform job's real read and write pattern.

#### Guardrail

For every service principal, test the exact path it will execute in production. “Can connect” is not a useful acceptance test for a transform identity.

### Problem 6: Shipping BigQuery SQL Into Airflow Before Validating It Against BigQuery

Airflow is the wrong place to discover SQL engine limitations.

#### Symptom

`build_bigquery_marts` failed with:

```text
Correlated subqueries that reference other tables are not supported unless they can be de-correlated
```

#### Root Cause

The mart SQL was analytically correct in intent but invalid for BigQuery's execution model.

#### Remediation

Rewrite the factsheet mart using pre-aggregated CTEs and arrays instead of correlated subqueries.

#### Guardrail

Directly execute every non-trivial warehouse query on the target engine before scheduling it through Airflow. Airflow should orchestrate validated SQL, not act as the first compiler.

> [!warning] Airflow Does Not Simplify Cross-Engine SQL
>
> When a query is invalid for BigQuery, wrapping it in a Cloud Run job and an Airflow task only delays the moment you learn that the SQL shape is unsupported.
>
> [!success] Validate Close To The Engine
>
> Test warehouse SQL directly against the warehouse, then schedule the proven statement through Airflow.

### Problem 7: Treating Publication As “Just Another Transform”

The STOXX serving chain proved that analytical completion and serving completion are not the same event.

#### Symptom

The pipeline still had meaningful failure modes after SQL gold was complete: BigQuery marts could fail, Firestore publish could fail, and Eventarc control-document delivery could fail.

#### Root Cause

Publication is a different operational phase with different systems, schemas, permissions, and validation requirements. It is not just an extra transform at the end of the SQL chain.

#### Remediation

Expose publication as separate Airflow tasks:

- `sync_gold_to_bigquery`
- `build_bigquery_marts`
- `publish_serving_to_firestore`
- `validate_serving_layer`

#### Guardrail

Model serving publication as a first-class pipeline phase with its own validation step and its own operational checkpoints.

## Moderate Operational Problems

These problems did not always stop the platform, but they created deployment friction or wasted incident time.

### Problem 8: Copying DAG Files Directly Into A Host-Mounted Directory

This was a simple deployment mistake with an annoying blast radius.

#### Symptom

Direct `scp` into `/home/alexper_recovery_gmail_com/app/dags` failed with `permission denied`.

#### Root Cause

The host-mounted DAG directory ownership matched the container runtime requirements rather than the workstation user's write permissions.

#### Remediation

Copy to a temporary writable location first, then install the file into the DAG directory using explicit ownership and mode.

#### Guardrail

Standardize DAG delivery through `install` or `mv` with known ownership. Do not rely on ad-hoc direct copies into mounted runtime directories.

### Problem 9: Trusting A Custom Monitor More Than Native Airflow State

This problem did not break Airflow, but it produced a fake incident.

#### Symptom

The monitoring loop emitted repeated errors:

```text
syntax error at or near "stoxx_stage_yfinance"
```

and looked like a persistent runtime failure.

#### Root Cause

The SQL in the custom monitor loop was quoted incorrectly. The diagnostic code was broken, not the DAG run.

#### Remediation

Switch back to native verification using `airflow tasks states-for-dag-run` and other built-in Airflow CLI commands.

#### Guardrail

When a custom monitor claims the platform is broken, verify the same state with a native CLI before escalating. Treat monitoring helpers as fallible software, not as truth.

### Problem 10: Misreading Startup Health As Steady-State Failure

This problem showed up after container restarts and looked worse than it was.

#### Symptom

`airflow-dag-processor` and `airflow-triggerer` appeared in `health: starting` immediately after restart.

#### Root Cause

The services were still inside their normal health-check startup window, and the restart happened during a noisy configuration-drift event.

#### Remediation

Wait for the health window, then re-check the stack after the services have had enough time to pass their probes.

#### Guardrail

Separate startup-state observation from steady-state diagnosis. A container that has been up for seconds should not be judged by the same standard as one that has been up for minutes.

## Cross-Cutting Lessons

The same themes repeated across the rollout:

- Airflow problems often originate outside Airflow.
- Most “Airflow is broken” moments are really hidden dependency problems.
- The safest platform is the one with the fewest invisible assumptions.

### The Most Important Architectural Lesson

The live platform worked best when Airflow remained a thin, explicit orchestrator and every external boundary was named, validated, and independently testable.

That principle drove the best outcomes:

- explicit task boundaries
- explicit Cloud Run job names
- explicit validation tasks
- explicit Firestore control-document publication
- explicit post-fix run-state validation

## What To Remember

The problems that mattered most were not exotic Airflow edge cases. They were ordinary but costly engineering mistakes:

- assuming one layer implicitly solved another
- skipping direct validation at integration boundaries
- trusting visibility more than state
- allowing hidden defaults and drift into the runtime

Those mistakes are now documented. The value of this note is that the next rollout does not need to rediscover them.
