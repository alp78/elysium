---
title: "01 - dbt: Airflow Integration"
tags: [pipeline, orchestration, airflow, dbt]
status: stable
updated: 2026-03-23
description: "BashOperator, astronomer-cosmos, and CloudRunJobOperator patterns for orchestrating dbt in Airflow, with a full ESG pipeline DAG."
---

# dbt: Airflow Integration

> [!quote] Scheduler and transformer boundaries
>
> "It becomes even more important to have something like Airflow that brings everything together in a sane place where every little piece of the puzzle can be orchestrated properly."
>
> Source: Maxime Beauchemin | creator of Apache Airflow

> [!abstract]- Summary
>
> Explains how to orchestrate dbt from Airflow, comparing coarse and fine-grained execution patterns, isolated container runs, variable passing, failure callbacks, and partial rerun strategies so transformation control stays observable and recoverable.
>
> **Operator and orchestration patterns**
> - Compares BashOperator-wrapped dbt commands, Astronomer Cosmos model-level task generation, and isolated container execution with CloudRunJobOperator so teams can choose the right Airflow-to-dbt integration boundary
> - Connects orchestration granularity to retry behavior, observability, blast radius, and the practical tradeoff between simple DAGs and per-model visibility
>
> **Runtime inputs and execution context**
> - Covers passing values into dbt through `--vars`, environment variables, and XCom-mediated runtime context so DAG state can shape dbt runs without hard-coding operational parameters
> - Explains how orchestration context and dbt context meet at execution time, especially when date windows, backfills, or environment-specific settings must be injected safely
>
> **Failure handling and reruns**
> - Covers failure callbacks, alerting integration, partial reruns with Cosmos, and full end-to-end DAG composition from extract to dbt run to dbt test to publish
> - Emphasizes choosing an orchestration pattern that makes failure surfaces obvious and rerun scope controllable instead of opaque and expensive
>
> **Operations and safety**
> - Warnings: hiding dbt inside one opaque shell task, leaking credentials through variable passing, overusing per-model task expansion, and losing rerun precision by choosing the wrong operator pattern
> - Recommendations: match orchestration granularity to failure-recovery needs, isolate heavy runs when possible, pass runtime values explicitly, and wire failure callbacks into the team's alerting path early

> [!info]- Glossary
>
> **Airflow orchestration**
> - The scheduling, dependency, retry, and alerting layer that determines when and how dbt runs as part of a broader pipeline.
> - It matters here because the note is about choosing the right boundary between Airflow's control plane and dbt's internal DAG execution.
>
> > [!info] Orchestrate around the graph
> >
> > Airflow decides when a dbt run starts and how failures are handled operationally. dbt still decides the model execution order inside that run.
>
> ---
>
> **BashOperator**
> - An Airflow operator that runs shell commands directly, often used to wrap `dbt run`, `dbt test`, or related CLI calls.
> - It matters here because BashOperator is the simplest integration option and the baseline against which more granular dbt operators are compared.
>
> > [!warning] Simple but opaque
> >
> > BashOperator is easy to start with, but a single shell task can hide which model failed and make retries broader than they need to be.
>
> ---
>
> **Astronomer Cosmos**
> - An Airflow integration library that maps dbt nodes into Airflow tasks for finer-grained orchestration and visibility.
> - It matters here because Cosmos changes the operational granularity of dbt in Airflow from a few CLI steps to model-aware task orchestration.
>
> > [!warning] More visibility, more complexity
> >
> > Cosmos improves observability and retry scope, but it also expands DAG size and orchestration complexity. Use it because you need that control, not just because it exists.
>
> ---
>
> **CloudRunJobOperator**
> - An Airflow operator that triggers an isolated Cloud Run job, often used to execute dbt in a container outside the Airflow worker environment.
> - It matters here because container isolation can improve reproducibility and dependency control for dbt workloads.
>
> > [!info] Isolation as operational control
> >
> > Running dbt in an isolated job avoids polluting Airflow workers with dbt runtime dependencies and can make deployments cleaner across environments.
>
> ---
>
> **Task granularity**
> - The scope of work represented by one Airflow task, ranging from a full dbt run to a single model execution.
> - It matters here because orchestration design is largely a decision about how much visibility and retry control each task should provide.
>
> > [!warning] Granularity defines retry cost
> >
> > Coarse tasks are easier to manage but expensive to rerun; fine-grained tasks are observable but can bloat the DAG. Pick based on operational recovery needs.
>
> ---
>
> **`--vars`**
> - A dbt CLI mechanism for passing runtime YAML variables into a dbt invocation.
> - It matters here because Airflow often needs to inject schedule-derived or manually supplied values into dbt runs safely.
>
> > [!warning] Runtime input is part of reproducibility
> >
> > If vars are passed inconsistently or implicitly, reruns become hard to reproduce. Treat them as part of the run contract, not as ad hoc shell text.
>
> ---
>
> **Environment variable**
> - A process-level variable supplied to the dbt runtime for credentials, targets, or other execution context.
> - It matters here because Airflow and containerized dbt runs frequently rely on environment variables for secure configuration handoff.
>
> > [!danger] Secrets can leak here
> >
> > Environment variables are a practical secret-delivery channel, but they must still be handled carefully in logs, task definitions, and debugging output.
>
> ---
>
> **XCom**
> - Airflow's cross-task messaging mechanism for passing small pieces of runtime data between tasks.
> - It matters here because some dbt runs are parameterized from upstream Airflow outputs rather than static schedule context.
>
> > [!warning] Small control data only
> >
> > XCom is useful for runtime parameters, not for large payloads or hidden business state. Keep what flows into dbt explicit and minimal.
>
> ---
>
> **Failure callback**
> - An Airflow hook such as `on_failure_callback` that executes custom logic when a task fails.
> - It matters here because dbt orchestration is only operationally complete when failures trigger the right alerting and response path.
>
> > [!info] Failure handling is part of orchestration
> >
> > A failed task without a useful callback is just a red box in the UI. Callbacks are what turn failures into actionable operational signals.
>
> ---
>
> **Partial rerun**
> - A recovery pattern that retries only the affected portion of a dbt workflow rather than rerunning every upstream and downstream task.
> - It matters here because orchestration choices directly affect how expensive or precise recovery becomes after a failure.
>
> > [!warning] Recovery scope is a design decision
> >
> > If the orchestration layer cannot isolate reruns, teams often pay for broader reruns and slower recovery than the underlying dbt failure actually required.

## Airflow BashOperator Wrapping dbt run

The simplest approach: invoke the dbt CLI as a shell command from within an Airflow task. The entire dbt project runs as a single Airflow task.

```python
from airflow.operators.bash import BashOperator

dbt_run = BashOperator(
    task_id="dbt_run",
    bash_command=(
        "cd /opt/dbt/financial_indices && "
        "dbt run --target prod --vars '{run_date: {{ ds }}}'"
    ),
    env={
        "DBT_BIGQUERY_PROJECT": "fin-data-prod",
        "DBT_BIGQUERY_DATASET": "esg_transformed",
        "GOOGLE_APPLICATION_CREDENTIALS": "/secrets/sa-key.json",
    },
)
```

**Pros**

- Zero extra dependencies beyond the dbt CLI on the worker.
- Fast to implement; works with any dbt adapter.

**Cons**

- One monolithic task: a single model failure fails the entire block.
- No per-model retry, duration metrics, or partial re-run from Airflow.
- Log output is a single stream; hard to isolate failures.

> [!tip] When to use the single-task approach
>
> Use it for non-critical pipelines or when the dbt project is small enough that one coarse retry surface is operationally acceptable.

---

## Option 2: astronomer-cosmos (Each Model = Airflow Task)

[astronomer-cosmos](https://github.com/astronomer/astronomer-cosmos) parses the dbt project's `manifest.json` at DAG parse time and generates one Airflow task per dbt node (model, seed, snapshot, test). Dependencies between tasks mirror the dbt DAG.

### Airflow astronomer-cosmos Installation

```bash
pip install astronomer-cosmos[dbt-bigquery]
```

### Airflow astronomer-cosmos DAG Definition

```python
from datetime import datetime
from datetime import timedelta
from pathlib import Path

from airflow import DAG
from cosmos import DbtDag, ProjectConfig, ProfileConfig, ExecutionConfig
from cosmos.profiles import GoogleCloudOauthProfileMapping

profile_config = ProfileConfig(
    profile_name="financial_indices",
    target_name="prod",
    profile_mapping=GoogleCloudOauthProfileMapping(
        conn_id="google_cloud_default",
        profile_args={
            "project": "fin-data-prod",
            "dataset": "esg_transformed",
            "location": "EU",
        },
    ),
)

esg_dbt_dag = DbtDag(
    dag_id="esg_dbt_cosmos",
    project_config=ProjectConfig(Path("/opt/dbt/financial_indices")),
    profile_config=profile_config,
    execution_config=ExecutionConfig(dbt_executable_path="/usr/local/bin/dbt"),
    operator_args={
        "vars": {"run_date": "{{ ds }}"},
        "retries": 2,
        "retry_delay": timedelta(seconds=30),
    },
    schedule="0 4 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
)
```

**Pros**

- Full per-model task observability in the Airflow UI.
- Retry individual failed models without re-running the whole project.
- Test nodes appear as separate tasks immediately downstream of their model.

**Cons**

- DAG parse time increases with project size (mitigate with `dbt ls` caching).
- Requires the manifest to be present at parse time; coordinate with CI/CD.
- Additional dependency (`astronomer-cosmos`) must be pinned and managed.

> [!info] Cosmos load modes
>
> Cosmos supports `LoadMode.DBT_LS` for runtime discovery and `LoadMode.MANIFEST` for pre-built metadata. Prefer `MANIFEST` in production when you want predictable DAG parse behavior and fewer moving parts on the scheduler.

---

## Airflow CloudRunJobOperator (Isolated Container)

Run dbt inside a Cloud Run Job, treating the entire dbt invocation as a containerised ephemeral workload. Airflow submits the job and polls for completion.

```python
from airflow.providers.google.cloud.operators.cloud_run import CloudRunExecuteJobOperator

dbt_cloud_run = CloudRunExecuteJobOperator(
    task_id="dbt_run_container",
    project_id="fin-data-prod",
    region="europe-west1",
    job_name="dbt-esg-transformer",
    overrides={
        "containerOverrides": [
            {
                "name": "dbt-runner",
                "args": ["run", "--target", "prod", "--vars", "{run_date: {{ ds }}}"],
                "env": [
                    {"name": "RUN_DATE", "value": "{{ ds }}"},
                ],
            }
        ]
    },
    gcp_conn_id="google_cloud_default",
)
```

**Pros**

- Complete isolation: no dbt installation on Airflow workers.
- Independently scalable compute; Cloud Run handles cold start automatically.
- Container image version is pinned, enabling atomic rollbacks.

**Cons**

- Cold start latency (10–30 s per invocation) adds to total pipeline duration.
- Observability is limited to Airflow task-level (pass/fail), not per-model.
- Cloud Run Job logs must be viewed separately in Cloud Logging.

---

## Airflow dbt Operator Comparison Table

| Dimension         | BashOperator        | astronomer-cosmos          | CloudRunJobOperator      |
|-------------------|---------------------|----------------------------|--------------------------|
| Complexity        | Low                 | Medium                     | Medium–High              |
| Per-model retry   | No                  | Yes                        | No                       |
| Observability     | Stream log only     | Per-task in Airflow UI     | Job-level pass/fail      |
| Isolation         | Shared worker env   | Shared worker env          | Dedicated container      |
| Cost              | Minimal             | Minimal (worker CPU only)  | Cloud Run compute + egress |
| Rollback          | Re-run DAG          | Re-run specific tasks      | Pin image version        |
| Best for          | Small projects      | Large projects, on-call    | Regulated/isolated envs  |

---

## Full DAG: Extract to dbt Cosmos to dbt test to Publish

This pattern represents a complete ESG data pipeline: raw provider data lands in GCS, dbt transforms it, tests validate quality, and a downstream publish step refreshes the index calculation API.

```python
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from cosmos import DbtTaskGroup, ProjectConfig, ProfileConfig, ExecutionConfig
from cosmos.profiles import GoogleCloudOauthProfileMapping

default_args = {
    "owner": "data-engineering",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["data-oncall@example.com"],
}

profile_config = ProfileConfig(
    profile_name="financial_indices",
    target_name="prod",
    profile_mapping=GoogleCloudOauthProfileMapping(
        conn_id="google_cloud_default",
        profile_args={
            "project": "fin-data-prod",
            "dataset": "esg_transformed",
            "location": "EU",
        },
    ),
)

def extract_esg_provider_data(**context):
    """Pull raw ESG scores from provider SFTP into GCS staging bucket."""
    run_date = context["ds"]
    # ... provider client logic omitted
    context["ti"].xcom_push(key="raw_gcs_uri", value=f"gs://fin-raw/esg/{run_date}/")

def publish_index_snapshot(**context):
    """Notify downstream API that new index data is available."""
    run_date = context["ds"]
    raw_uri = context["ti"].xcom_pull(task_ids="extract_esg", key="raw_gcs_uri")
    # ... API call or Pub/Sub publish omitted

with DAG(
    dag_id="esg_index_pipeline",
    default_args=default_args,
    schedule="0 5 * * 1-5",          # weekdays at 05:00 UTC
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["esg", "dbt", "production"],
) as dag:

    extract = PythonOperator(
        task_id="extract_esg",
        python_callable=extract_esg_provider_data,
    )

    dbt_transform = DbtTaskGroup(
        group_id="dbt_transform",
        project_config=ProjectConfig(Path("/opt/dbt/financial_indices")),
        profile_config=profile_config,
        execution_config=ExecutionConfig(dbt_executable_path="/usr/local/bin/dbt"),
        operator_args={
            "vars": {"run_date": "{{ ds }}"},
            "select": "tag:esg",          # only ESG-tagged models
        },
    )

    dbt_test = DbtTaskGroup(
        group_id="dbt_test",
        project_config=ProjectConfig(Path("/opt/dbt/financial_indices")),
        profile_config=profile_config,
        execution_config=ExecutionConfig(dbt_executable_path="/usr/local/bin/dbt"),
        operator_args={
            "select": "tag:esg",
            "store_failures": True,
        },
    )

    publish = PythonOperator(
        task_id="publish_index_snapshot",
        python_callable=publish_index_snapshot,
    )

    extract >> dbt_transform >> dbt_test >> publish
```

---

## Passing Variables to dbt

### `--vars` flag (inline YAML)

```python
operator_args={"vars": {"run_date": "{{ ds }}", "provider": "msci"}}
```

Rendered at runtime by Airflow's Jinja engine before dbt receives the string.

### Environment Variables

dbt reads `env_var('KEY')` calls from `profiles.yml` and model SQL. Pass secrets as environment variables rather than embedding them in `--vars`.

```yaml
# profiles.yml
financial_indices:
  target: "{{ env_var('DBT_TARGET', 'dev') }}"
  outputs:
    prod:
      type: bigquery
      project: "{{ env_var('DBT_BQ_PROJECT') }}"
      dataset: "{{ env_var('DBT_BQ_DATASET') }}"
```

```python
env={"DBT_BQ_PROJECT": "fin-data-prod", "DBT_BQ_DATASET": "esg_transformed"}
```

### XComs to dbt via `--vars`

When an upstream task computes a value (e.g., a reference date from a vendor feed), pass it into dbt via `--vars` using Airflow's template syntax:

```python
bash_command=(
    "dbt run --vars '{cutoff_date: {{ ti.xcom_pull(task_ids=\"extract_esg\", "
    "key=\"cutoff_date\") }}}'"
)
```

> [!warning] XCom variable constraints
>
> XCom values pulled into `--vars` must be strings or simple scalars. Never pass secrets through XComs; use Airflow Connections or Secret Manager instead.

> [!success] Safe variable passing
>
> Pass secrets to dbt via environment variables using Airflow's `env` parameter on `BashOperator`, sourced from an Airflow Connection or Secret Manager backend. Use `--vars` only for non-sensitive runtime parameters such as `run_date` or `provider_code`.

---

## Handling dbt Failures in Airflow

### dbt Airflow Failure Callback — on_failure_callback

```python
from airflow.models import TaskInstance

def on_dbt_failure(context: dict):
    ti: TaskInstance = context["task_instance"]
    dag_id = context["dag"].dag_id
    run_id = context["run_id"]
    # Post to Slack, Datadog, or PagerDuty
    send_alert(f"dbt failed in DAG {dag_id} | run {run_id} | task {ti.task_id}")

default_args = {"on_failure_callback": on_dbt_failure}
```

### Partial Re-runs with Cosmos

Because each model is a separate task, you can clear and re-run only failed tasks from the Airflow UI without re-executing upstream models that succeeded. This dramatically reduces re-run cost for large ESG transformation projects with hundreds of company-level models.

### Exit Code Handling

dbt exits with a non-zero code on test failures as well as runtime errors. Distinguish them by parsing `run_results.json` in a `TriggerRule.ALL_DONE` downstream task:

```python
from airflow.utils.trigger_rule import TriggerRule

check_results = PythonOperator(
    task_id="check_dbt_results",
    python_callable=parse_run_results,      # reads /opt/dbt/target/run_results.json
    trigger_rule=TriggerRule.ALL_DONE,      # runs even if dbt_run failed
)
```

---

## Related

- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts)
- [airflow-dag-patterns](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-dag-patterns)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-ci-cd](https://alp78.github.io/elysium/11-dbt/Operations/dbt-ci-cd)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
