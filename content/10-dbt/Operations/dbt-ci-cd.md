---
tags: [how-to, dbt]
type: how-to
technology: [dbt, github-actions]
status: stable
updated: 2026-03-23
description: "GitHub Actions CI with slim builds and manifest diffing, Workload Identity Federation, pre-commit hooks, and CD via Git pull or Docker rebuild."
related:
  - "[[github-actions-data-engineering]]"
  - "[[github-actions-patterns]]"
  - "[[dbt-core-concepts]]"
  - "[[dbt-airflow-integration]]"
  - "[[dbt-observability]]"
---

# dbt: CI/CD

A robust dbt CI/CD pipeline validates SQL correctness before merge, prevents regressions in data quality tests, and deploys only what changed. For financial index and ESG data pipelines the stakes are high: a broken model can silently corrupt benchmark calculations used for regulatory reporting.

---

## CI Goals

| Goal | Mechanism |
|------|-----------|
| Catch compilation errors on every PR | `dbt compile` against dev BigQuery dataset |
| Run only affected models and tests | Slim CI with `state:modified+` selector |
| Avoid full-project cost on each PR | Download production `manifest.json` as baseline |
| Enforce SQL style | sqlfluff pre-commit hook |
| Authenticate without long-lived keys | Workload Identity Federation |

---

## Slim Build: State-Based Selection

dbt compares the current project against a previously compiled manifest (`manifest.json`) and selects only the nodes that changed or depend on changed nodes.

```bash
# CI step: compile new code against the dev target
dbt compile --target dev

# Run and test only what changed relative to production
dbt build \
  --target dev \
  --select state:modified+ \
  --defer \
  --state ./prod-manifest
```

- `state:modified+` — changed models **plus** all downstream dependents.
- `--defer` — for upstream models that were not selected, dbt resolves references to the **production** relations instead of requiring them to exist in dev. This avoids re-materialising untouched staging models.
- `--state ./prod-manifest` — directory containing `manifest.json` from the last successful production run.

> [!tip] `state:modified+` is the single biggest CI cost-saver for large projects. A 300-model ESG project may touch only 4–8 models per PR, so CI runs in 2–3 minutes instead of 45.

---

## Manifest Management

### Saving After Production Run

Add a step at the end of the production Airflow DAG (or GitHub Actions CD workflow) that uploads `target/manifest.json` to GCS:

```bash
gsutil cp target/manifest.json \
  gs://fin-dbt-artifacts/prod/manifest.json
```

Tag with the run date for audit retention:

```bash
gsutil cp target/manifest.json \
  "gs://fin-dbt-artifacts/prod/manifest-$(date +%Y%m%d).json"
```

### Downloading in CI

```yaml
- name: Download production manifest
  run: |
    mkdir -p prod-manifest
    gsutil cp gs://fin-dbt-artifacts/prod/manifest.json prod-manifest/manifest.json
```

If the file does not exist (first run), fall back to a full build:

```bash
gsutil cp gs://fin-dbt-artifacts/prod/manifest.json prod-manifest/manifest.json \
  || echo '{"nodes":{}}' > prod-manifest/manifest.json
```

---

## Workload Identity Federation (Keyless GCP Auth)

Eliminate long-lived service-account JSON keys by federating GitHub Actions' OIDC token directly to GCP IAM.

### GCP Setup (one-time)

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-actions-pool" \
  --project="fin-data-prod" \
  --location="global"

# Create OIDC provider pointing at GitHub
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="fin-data-prod" \
  --location="global" \
  --workload-identity-pool="github-actions-pool" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Bind the service account to the pool (scoped to your repo)
gcloud iam service-accounts add-iam-policy-binding \
  dbt-ci@fin-data-prod.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/your-org/financial-indices-dbt"
```

### GitHub Actions Step

```yaml
- name: Authenticate to GCP
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: >-
      projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
    service_account: dbt-ci@fin-data-prod.iam.gserviceaccount.com
```

No secrets stored in GitHub. The OIDC token is short-lived and repo-scoped.

---

## Pre-Commit Hooks

Install hooks that run locally before a commit reaches CI, catching issues at the cheapest possible moment.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/sqlfluff/sqlfluff
    rev: 3.1.0
    hooks:
      - id: sqlfluff-lint
        args: [--dialect, bigquery]
        files: ^models/

  - repo: local
    hooks:
      - id: dbt-compile
        name: dbt compile (changed files only)
        language: system
        entry: bash -c 'dbt compile --target dev --select state:modified'
        pass_filenames: false
        files: ^models/
```

Install with:

```bash
pip install pre-commit sqlfluff
pre-commit install
```

> [!note] `dbt compile` in the pre-commit hook requires a working `profiles.yml` pointing at a dev target. Use environment variables so the hook works on every developer's machine without checking in credentials.

---

## Full CI Workflow: `.github/workflows/dbt-ci.yml`

```yaml
name: dbt CI

on:
  pull_request:
    branches: [main]
    paths:
      - "models/**"
      - "macros/**"
      - "dbt_project.yml"
      - "packages.yml"

permissions:
  contents: read
  id-token: write        # required for Workload Identity Federation

env:
  DBT_TARGET: dev
  DBT_BQ_PROJECT: fin-data-dev
  DBT_BQ_DATASET: esg_ci_${{ github.event.pull_request.number }}
  DBT_BQ_LOCATION: EU

jobs:
  dbt-ci:
    name: Compile and slim build
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements-ci.txt   # dbt-bigquery, sqlfluff

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Install dbt packages
        run: dbt deps

      - name: Lint SQL with sqlfluff
        run: sqlfluff lint models/ --dialect bigquery --format github-annotation
        continue-on-error: false

      - name: Download production manifest
        run: |
          mkdir -p prod-manifest
          gsutil cp gs://fin-dbt-artifacts/prod/manifest.json prod-manifest/manifest.json \
            || echo '{"nodes":{}}' > prod-manifest/manifest.json

      - name: dbt compile (full project)
        run: dbt compile --target dev

      - name: dbt build (slim — changed + downstream)
        run: |
          dbt build \
            --target dev \
            --select state:modified+ \
            --defer \
            --state prod-manifest \
            --vars "{run_date: $(date +%Y-%m-%d)}"

      - name: Upload CI artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: dbt-ci-artifacts
          path: |
            target/run_results.json
            target/manifest.json
          retention-days: 7

      - name: Drop CI dataset
        if: always()
        run: |
          bq rm -r -f --dataset ${{ env.DBT_BQ_PROJECT }}:${{ env.DBT_BQ_DATASET }} \
            || true
```

---

## Full CD Workflow: `.github/workflows/dbt-cd.yml`

```yaml
name: dbt CD

on:
  push:
    branches: [main]
    paths:
      - "models/**"
      - "macros/**"
      - "dbt_project.yml"
      - "packages.yml"

permissions:
  contents: read
  id-token: write

env:
  DBT_TARGET: prod
  DBT_BQ_PROJECT: fin-data-prod
  DBT_BQ_DATASET: esg_transformed
  DBT_BQ_LOCATION: EU

jobs:
  dbt-cd:
    name: Deploy to production
    runs-on: ubuntu-latest
    timeout-minutes: 60
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements-ci.txt

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Install dbt packages
        run: dbt deps

      - name: dbt run (full production)
        run: |
          dbt run \
            --target prod \
            --vars "{run_date: $(date +%Y-%m-%d)}"

      - name: dbt test
        run: dbt test --target prod --store-failures

      - name: Upload manifest to GCS
        if: success()
        run: |
          gsutil cp target/manifest.json \
            gs://fin-dbt-artifacts/prod/manifest.json
          gsutil cp target/manifest.json \
            "gs://fin-dbt-artifacts/prod/manifest-$(date +%Y%m%d-%H%M%S).json"

      - name: Upload run artifacts to GCS
        if: always()
        run: |
          RUN_TS=$(date +%Y%m%d-%H%M%S)
          gsutil cp target/run_results.json \
            "gs://fin-dbt-artifacts/runs/${RUN_TS}/run_results.json"

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: ${{ secrets.SLACK_DATA_CHANNEL }}
          slack-message: "dbt CD failed on `main` — <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View run>"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

## CD via Airflow: Git Pull vs Docker Rebuild

### Pattern A: Git Pull on Worker

The Airflow worker clones or pulls the latest `main` branch before each DAG run. Simple, but couples Airflow worker access to GitHub.

```python
from airflow.operators.bash import BashOperator

pull_dbt = BashOperator(
    task_id="git_pull_dbt",
    bash_command="cd /opt/dbt/financial_indices && git pull origin main",
)
```

**Risk:** A broken commit on `main` breaks the next scheduled run. Mitigate by tagging releases and checking out tags instead of `main`.

### Pattern B: Docker Image Rebuild

The CD workflow builds a new Docker image with the dbt project baked in, pushes it to Artifact Registry, and updates the Cloud Run Job or KubernetesPodOperator image reference.

```bash
# In dbt-cd.yml after dbt tests pass
docker build -t europe-west1-docker.pkg.dev/fin-data-prod/dbt/runner:${{ github.sha }} .
docker push europe-west1-docker.pkg.dev/fin-data-prod/dbt/runner:${{ github.sha }}

gcloud run jobs update dbt-esg-transformer \
  --image europe-west1-docker.pkg.dev/fin-data-prod/dbt/runner:${{ github.sha }} \
  --region europe-west1
```

This is the preferred pattern for regulated environments: every production run is tied to an immutable image SHA.

---

## Related

- [[github-actions-data-engineering]]
- [[github-actions-patterns]]
- [[dbt-core-concepts]]
- [[dbt-airflow-integration]]
- [[dbt-observability]]
