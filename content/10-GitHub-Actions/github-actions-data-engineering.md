---
type: reference
category: github-actions
technology:
  - github
  - github-actions
  - python
  - gcp
  - terraform
  - dbt
  - docker
tags: [ci-cd, python, terraform, docker, dbt, gcp, github-actions]
aliases:
  - data pipeline CI/CD
  - dbt CI
  - SQL validation
  - Terraform automation
  - Cloud Run deploy
  - Workload Identity Federation
  - data quality gates
keywords:
  - data pipeline
  - ci cd
  - cloud run
  - workload identity federation
  - keyless auth
  - dbt
  - great expectations
  - data quality
  - airflow dag
  - sql validation
  - bigquery dry-run
  - schema migration
  - ruff
  - pytest
  - docker build
  - artifact registry
  - terraform plan
  - terraform apply
  - drift detection
  - slack notification
  - cost monitoring
  - secret rotation
  - ACTIONS_STEP_DEBUG
  - pipeline deployment
  - sql server parseonly
description: "GitHub Actions for data engineering — CI for pipelines, CD for Cloud Run, Terraform automation, dbt CI, data quality gates, and Workload Identity Federation."
related:
  - "[[github-actions-fundamentals]]"
  - "[[github-actions-patterns]]"
  - "[dbt-transformation-layer](/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions for Data Engineering

> [!abstract] Summary
> Practical GitHub Actions workflows for data engineering teams. Covers Python pipeline CI, Cloud Run CD, dbt CI, data quality gates, Workload Identity Federation (keyless GCP auth), Airflow DAG validation, and cost monitoring.

---

## CI for Data Pipelines

### Full Python Lint + Test Workflow

```yaml
# .github/workflows/pipeline-ci.yml
name: Pipeline CI

on:
  push:
    branches: [main, develop]
    paths:
      - "pipelines/**"
      - "src/**"
      - "tests/**"
      - "pyproject.toml"
      - "requirements*.txt"
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

env:
  PYTHON_VERSION: "3.12"

permissions:
  contents: read
  pull-requests: write
  checks: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - name: Install ruff
        run: pip install ruff

      - name: Ruff lint
        run: ruff check . --output-format=github

      - name: Ruff format check
        run: ruff format --check .

  validate-sql:
    name: Validate SQL
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Find SQL files
        id: find-sql
        run: |
          COUNT=$(find sql/ -name "*.sql" | wc -l)
          echo "count=$COUNT" >> $GITHUB_OUTPUT

      - name: Validate SQL syntax (sqlfluff)
        if: steps.find-sql.outputs.count != '0'
        run: |
          pip install sqlfluff
          sqlfluff lint sql/ --dialect bigquery --format github-annotation

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: [lint]
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - uses: actions/cache@v4
        with:
          path: .venv
          key: venv-${{ runner.os }}-py${{ env.PYTHON_VERSION }}-${{ hashFiles('pyproject.toml') }}

      - name: Install dependencies
        run: |
          python -m venv .venv
          . .venv/bin/activate
          pip install -e ".[dev]"

      - name: Run unit tests
        run: |
          . .venv/bin/activate
          pytest tests/unit/ \
            --cov=src \
            --cov-report=xml \
            --cov-report=term-missing \
            --junit-xml=test-results.xml \
            -v \
            --tb=short

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results.xml
          retention-days: 7

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage.xml
          retention-days: 7

  integration-test:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 30
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_CI }}

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - run: pip install -e ".[dev]"

      - name: Run integration tests
        run: |
          pytest tests/integration/ \
            --timeout=120 \
            -v \
            --tb=short
        env:
          GCP_PROJECT: ${{ secrets.GCP_PROJECT }}
          BQ_DATASET: ci_test_${{ github.run_id }}
```

### SQL Validation: BigQuery Dry-Run

```yaml
  validate-bq-sql:
    name: BigQuery SQL Dry-Run
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_CI }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Dry-run SQL files
        run: |
          ERRORS=0
          for f in $(find sql/ -name "*.sql"); do
            echo "Validating $f..."
            bq query \
              --project_id=${{ secrets.GCP_PROJECT }} \
              --dry_run \
              --use_legacy_sql=false \
              "$(cat $f)" || ERRORS=$((ERRORS+1))
          done
          if [ $ERRORS -gt 0 ]; then
            echo "::error::$ERRORS SQL file(s) failed validation"
            exit 1
          fi
```

### SQL Validation: SQL Server PARSEONLY

```yaml
  validate-sql-server:
    name: SQL Server PARSEONLY
    runs-on: ubuntu-latest
    services:
      sqlserver:
        image: mcr.microsoft.com/mssql/server:2022-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: TestPassword123!
        ports:
          - 1433:1433
        options: >-
          --health-cmd "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P TestPassword123! -Q 'SELECT 1'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - name: Validate SQL syntax
        run: |
          pip install pyodbc
          python scripts/validate_sql_parseonly.py sql/
```

```python
# scripts/validate_sql_parseonly.py
import os, sys, glob
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost;UID=sa;PWD=TestPassword123!;"
    "TrustServerCertificate=yes"
)
cursor = conn.cursor()

errors = []
for path in glob.glob(f"{sys.argv[1]}/**/*.sql", recursive=True):
    sql = open(path).read()
    try:
        cursor.execute(f"SET PARSEONLY ON; {sql}; SET PARSEONLY OFF;")
    except Exception as e:
        errors.append(f"{path}: {e}")

for e in errors:
    print(f"::error::{e}")
sys.exit(len(errors))
```

---

### CD for Cloud Run Deployment

```yaml
# .github/workflows/deploy-cloud-run.yml
name: Deploy Data Pipeline to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "Dockerfile"
      - "pyproject.toml"

env:
  PROJECT_ID: my-data-project
  REGION: us-central1
  SERVICE: data-pipeline
  REGISTRY: us-central1-docker.pkg.dev
  REPO: data-pipelines

permissions:
  contents: read
  id-token: write

concurrency:
  group: deploy-production
  cancel-in-progress: false    # never cancel in-flight deploys

jobs:
  build:
    name: Build & Push
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.image.outputs.value }}
    steps:
      - uses: actions/checkout@v4

      - name: Auth to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_DEPLOY }}

      - name: Docker auth
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - uses: docker/setup-buildx-action@v3

      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: buildx-${{ github.sha }}
          restore-keys: buildx-

      - name: Set image name
        id: image
        run: |
          IMAGE="${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPO }}/${{ env.SERVICE }}:${{ github.sha }}"
          echo "value=$IMAGE" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ steps.image.outputs.value }}
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPO }}/${{ env.SERVICE }}:latest
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      - run: rm -rf /tmp/.buildx-cache && mv /tmp/.buildx-cache-new /tmp/.buildx-cache

  deploy:
    name: Deploy to Cloud Run
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - name: Auth to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_DEPLOY }}

      - name: Deploy
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ needs.build.outputs.image }}
          flags: >-
            --memory=2Gi
            --cpu=2
            --min-instances=0
            --max-instances=5
            --concurrency=10
            --timeout=3600
            --no-allow-unauthenticated
          env_vars: |
            ENVIRONMENT=production
            GCP_PROJECT=${{ env.PROJECT_ID }}
            LOG_LEVEL=INFO

      - name: Health check
        run: |
          URL="${{ steps.deploy.outputs.url }}/health"
          for i in 1 2 3; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
              "$URL")
            [ "$STATUS" = "200" ] && echo "Health OK" && exit 0
            echo "Attempt $i: HTTP $STATUS — retrying in 10s..."
            sleep 10
          done
          echo "::error::Health check failed after 3 attempts"
          exit 1
```

---

## Terraform Automation

### Terraform Plan as PR Comment

```yaml
# .github/workflows/terraform-ci.yml
name: Terraform CI

on:
  pull_request:
    paths: ["infra/**"]

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  plan:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra/
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"
          terraform_wrapper: false   # needed to capture plan output

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.TF_SA }}

      - name: Init
        run: terraform init -input=false

      - name: Validate
        run: terraform validate -no-color

      - name: Plan
        id: plan
        run: |
          terraform plan -no-color -input=false -out=tfplan 2>&1 | tee plan.txt
          echo "exitcode=${PIPESTATUS[0]}" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Comment Plan
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infra/plan.txt', 'utf8');
            const truncated = plan.length > 60000
              ? plan.substring(0, 60000) + '\n\n... [truncated]'
              : plan;
            const outcome = '${{ steps.plan.outputs.exitcode }}';
            const icon = outcome === '0' ? '✅' : outcome === '2' ? '⚠️' : '❌';

            const body = `## ${icon} Terraform Plan

            | Step | Result |
            |------|--------|
            | Init | ✅ |
            | Validate | ✅ |
            | Plan | ${icon} exitcode \`${outcome}\` |

            <details><summary>Plan output</summary>

            \`\`\`hcl
            ${truncated}
            \`\`\`

            </details>

            *SHA: \`${{ github.sha }}\` | [Run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})*`;

            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number
            });

            const existing = comments.find(c =>
              c.user.type === 'Bot' && c.body.includes('Terraform Plan'));

            const params = {
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            };

            if (existing) {
              await github.rest.issues.updateComment({
                ...params,
                comment_id: existing.id
              });
            } else {
              await github.rest.issues.createComment({
                ...params,
                issue_number: context.issue.number
              });
            }

      - name: Fail on error
        if: steps.plan.outputs.exitcode == '1'
        run: exit 1

      - uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: infra/tfplan
          retention-days: 7
```

### Terraform Apply on Merge

```yaml
# .github/workflows/terraform-apply.yml
name: Terraform Apply

on:
  push:
    branches: [main]
    paths: ["infra/**"]

permissions:
  contents: read
  id-token: write

jobs:
  apply:
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: infra/
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.TF_SA }}
      - run: terraform init -input=false
      - run: terraform apply -auto-approve -input=false -no-color
```

---

## dbt CI

The workflows below implement the [dbt CI/CD patterns](/11-dbt/Operations/dbt-ci-cd) specific to BigQuery, running `dbt build` against an ephemeral CI schema and cleaning up afterward.

### dbt Build Against Dev Schema

```yaml
# .github/workflows/dbt-ci.yml
name: dbt CI

on:
  pull_request:
    branches: [main]
    paths:
      - "dbt/**"
      - ".github/workflows/dbt-ci.yml"

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  dbt-ci:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      DBT_PROJECT_DIR: dbt/
      DBT_TARGET: ci
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: dbt-${{ hashFiles('dbt/requirements.txt') }}

      - run: pip install dbt-bigquery

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_DBT_CI }}

      - name: dbt deps
        working-directory: ${{ env.DBT_PROJECT_DIR }}
        run: dbt deps

      - name: dbt parse (syntax check)
        working-directory: ${{ env.DBT_PROJECT_DIR }}
        run: dbt parse --target ${{ env.DBT_TARGET }}

      - name: dbt build (CI schema)
        working-directory: ${{ env.DBT_PROJECT_DIR }}
        run: |
          dbt build \
            --target ${{ env.DBT_TARGET }} \
            --vars "{'ci_schema': 'dbt_ci_${{ github.run_id }}'}" \
            --exclude tag:skip_ci
        env:
          DBT_BIGQUERY_PROJECT: ${{ secrets.GCP_PROJECT }}

      - name: dbt docs generate
        working-directory: ${{ env.DBT_PROJECT_DIR }}
        run: dbt docs generate --target ${{ env.DBT_TARGET }}
        if: always()

      - name: Upload dbt artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dbt-artifacts
          path: |
            dbt/target/run_results.json
            dbt/target/manifest.json
          retention-days: 7

      - name: Clean up CI schema
        if: always()
        working-directory: ${{ env.DBT_PROJECT_DIR }}
        run: |
          bq rm -r -f --dataset \
            "${{ secrets.GCP_PROJECT }}:dbt_ci_${{ github.run_id }}" || true

      - name: Comment dbt results on PR
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(
              fs.readFileSync('dbt/target/run_results.json', 'utf8'));
            const total = results.results.length;
            const passed = results.results.filter(r => r.status === 'success' || r.status === 'pass').length;
            const failed = total - passed;
            const icon = failed === 0 ? '✅' : '❌';
            const body = `## ${icon} dbt CI Results
            | Metric | Value |
            |--------|-------|
            | Total | ${total} |
            | Passed | ${passed} |
            | Failed | ${failed} |
            | Duration | ${results.elapsed_time.toFixed(1)}s |`;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body
            });
```

---

## Data Quality Gates

### Great Expectations

```yaml
# .github/workflows/data-quality.yml
name: Data Quality Gate

on:
  schedule:
    - cron: "0 7 * * *"    # 07:00 UTC daily, after overnight pipeline
  workflow_dispatch:
    inputs:
      datasource:
        type: string
        required: true
        default: "daily_aggregates"

permissions:
  id-token: write
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - run: pip install great-expectations[bigquery]

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_GE }}

      - name: Run Great Expectations checkpoint
        id: ge
        run: |
          great_expectations checkpoint run daily_quality_checkpoint \
            --datasource-name "${{ inputs.datasource || 'daily_aggregates' }}" \
            2>&1 | tee ge_output.txt
          echo "exitcode=${PIPESTATUS[0]}" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Upload validation results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ge-results
          path: great_expectations/uncommitted/data_docs/
          retention-days: 7

      - name: Alert on failure
        if: steps.ge.outputs.exitcode != '0'
        run: |
          curl -X POST '${{ secrets.SLACK_WEBHOOK }}' \
            -H 'Content-type: application/json' \
            --data '{
              "text": "Data quality gate FAILED for ${{ inputs.datasource || '\''daily_aggregates'\'' }}",
              "attachments": [{
                "color": "danger",
                "text": "Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
              }]
            }'
          exit 1
```

### Custom SQL Checks

```yaml
  custom-sql-checks:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_CI }}
      - uses: google-github-actions/setup-gcloud@v2

      - name: Run SQL quality checks
        run: python scripts/run_sql_checks.py
        env:
          GCP_PROJECT: ${{ secrets.GCP_PROJECT }}
```

```python
# scripts/run_sql_checks.py
from google.cloud import bigquery
import json, sys, os

client = bigquery.Client(project=os.environ["GCP_PROJECT"])

CHECKS = [
    {
        "name": "no_null_user_ids",
        "sql": "SELECT COUNT(*) as cnt FROM `project.dataset.events` WHERE user_id IS NULL",
        "assertion": lambda cnt: cnt == 0,
        "message": "Found NULL user_ids in events table",
    },
    {
        "name": "row_count_today",
        "sql": """SELECT COUNT(*) as cnt FROM `project.dataset.events`
                  WHERE DATE(event_timestamp) = CURRENT_DATE()""",
        "assertion": lambda cnt: cnt > 1000,
        "message": "Event count below threshold (expected >1000)",
    },
    {
        "name": "no_duplicate_events",
        "sql": """SELECT MAX(cnt) as max_cnt FROM (
                    SELECT event_id, COUNT(*) as cnt
                    FROM `project.dataset.events`
                    GROUP BY event_id HAVING COUNT(*) > 1
                  )""",
        "assertion": lambda cnt: cnt is None or cnt == 0,
        "message": "Duplicate event_ids detected",
    },
]

failures = []
for check in CHECKS:
    result = client.query(check["sql"]).result()
    row = next(iter(result))
    value = row[0]
    if not check["assertion"](value):
        failures.append(f"FAILED [{check['name']}]: {check['message']} (value={value})")
        print(f"::error::{check['name']}: {check['message']} (value={value})")
    else:
        print(f"PASSED [{check['name']}]: value={value}")

sys.exit(len(failures))
```

---

### Airflow DAG Validation in CI

Validating [DAG structure](/12-Orchestration/Airflow/airflow-dag-patterns) in CI catches import errors and dependency cycles before they reach the scheduler. The workflow below installs Airflow with version constraints, imports every DAG file, and runs structural assertions.

```yaml
# .github/workflows/dag-validation.yml
name: Airflow DAG Validation

on:
  pull_request:
    paths:
      - "dags/**"
      - "plugins/**"

jobs:
  validate-dags:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: airflow-${{ hashFiles('requirements-airflow.txt') }}

      - name: Install Airflow (constrained)
        run: |
          AIRFLOW_VERSION=2.9.0
          PYTHON_VERSION=$(python --version | cut -d' ' -f2 | cut -d'.' -f1,2)
          CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"
          pip install "apache-airflow==${AIRFLOW_VERSION}" \
            --constraint "$CONSTRAINT_URL"

      - name: Syntax check (import)
        run: |
          export AIRFLOW_HOME=$(pwd)/airflow_home
          airflow db init
          ERRORS=0
          for dag_file in $(find dags/ -name "*.py"); do
            echo "Checking $dag_file..."
            python -c "
          import importlib.util, sys
          spec = importlib.util.spec_from_file_location('dag', '$dag_file')
          mod = importlib.util.module_from_spec(spec)
          spec.loader.exec_module(mod)
          print('OK')
          " || ERRORS=$((ERRORS+1))
          done
          exit $ERRORS

      - name: Load DAGs test
        run: |
          export AIRFLOW_HOME=$(pwd)/airflow_home
          python -c "
          from airflow.models import DagBag
          bag = DagBag(dag_folder='dags/', include_examples=False)
          if bag.import_errors:
              for path, err in bag.import_errors.items():
                  print(f'::error file={path}::{err}')
              raise SystemExit(len(bag.import_errors))
          print(f'Loaded {len(bag.dags)} DAG(s) successfully')
          "

      - name: DAG structure tests
        run: pytest tests/dag_tests/ -v
```

---

## Workload Identity Federation (Keyless GCP Auth)

> [!important] No more JSON keys
>
> Workload Identity Federation lets GitHub Actions authenticate to GCP using OIDC tokens -- no long-lived keys to rotate or accidentally expose.

> [!danger] Missing attribute_condition risk
>
> The `--attribute-condition` in the OIDC provider setup restricts which GitHub repositories can request tokens. If you omit this condition or set it to a wildcard, ANY public GitHub repository can authenticate as your service account and access your GCP resources. Always restrict to your specific org/repo: `assertion.repository=='my-org/my-repo'`. For additional safety, add `assertion.ref=='refs/heads/main'` to restrict to the main branch only.

### One-Time GCP Setup

```bash
# Variables
PROJECT_ID="my-project"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
POOL_ID="github-actions"
PROVIDER_ID="github-provider"
SA_EMAIL="gh-actions-ci@${PROJECT_ID}.iam.gserviceaccount.com"
REPO="my-org/my-repo"

# 1. Create Workload Identity Pool
gcloud iam workload-identity-pools create $POOL_ID \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# 2. Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL_ID \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create Service Account
gcloud iam service-accounts create gh-actions-ci \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions CI"

# 4. Bind Service Account to Workload Identity Pool
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"

# 5. Grant SA permissions (example)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.dataEditor"

# 6. Get provider resource name (save as GitHub secret WIF_PROVIDER)
gcloud iam workload-identity-pools providers describe $PROVIDER_ID \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$POOL_ID \
  --format='value(name)'
# → projects/123456/locations/global/workloadIdentityPools/github-actions/providers/github-provider
```

### GitHub Secrets to Set

| Secret Name | Value |
|-------------|-------|
| `WIF_PROVIDER` | Full provider resource name from step 6 |
| `WIF_SA` | `gh-actions-ci@my-project.iam.gserviceaccount.com` |

### Using in Workflow

```yaml
permissions:
  id-token: write     # REQUIRED for OIDC
  contents: read

steps:
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
      service_account: ${{ secrets.WIF_SA }}

  # After auth, gcloud and client libraries work automatically
  - run: gcloud storage ls gs://my-bucket/
  - run: python pipeline.py   # ADC picks up WIF credentials
```

### Restricting by Branch or Tag

```bash
# Only allow main branch to use this SA
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.ref/refs/heads/main"
```

---

### Secret Rotation Workflow

```yaml
# .github/workflows/rotate-secrets.yml
name: Rotate Secrets

on:
  schedule:
    - cron: "0 2 1 * *"   # 02:00 UTC on the 1st of every month
  workflow_dispatch:
    inputs:
      secret_name:
        type: string
        required: true

permissions:
  id-token: write
  contents: read

jobs:
  rotate:
    runs-on: ubuntu-latest
    environment: secret-rotation   # require approval
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_SECRET_MANAGER }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Rotate secret in Secret Manager
        run: |
          SECRET="${{ inputs.secret_name || 'my-api-key' }}"
          NEW_VALUE=$(python scripts/generate_secret.py)
          echo -n "$NEW_VALUE" | gcloud secrets versions add $SECRET --data-file=-

      - name: Update GitHub secret
        uses: actions/github-script@v7
        env:
          NEW_VALUE: ${{ steps.generate.outputs.value }}
        with:
          github-token: ${{ secrets.GH_PAT }}  # PAT with secrets:write scope
          script: |
            // Note: requires nacl for encryption
            const { execSync } = require('child_process');
            // Use gh CLI for simplicity
            execSync(`gh secret set MY_API_KEY --body "$NEW_VALUE"`, {
              env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN }
            });

      - name: Notify rotation complete
        run: |
          curl -X POST '${{ secrets.SLACK_WEBHOOK }}' \
            -d '{"text":"Secret rotation complete for ${{ inputs.secret_name }}"}'
```

---

### Cost Monitoring: BigQuery Billing Query to Slack

```yaml
# .github/workflows/cost-monitor.yml
name: BigQuery Cost Monitor

on:
  schedule:
    - cron: "0 9 * * 1-5"   # 09:00 UTC weekdays
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  cost-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_BILLING }}

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - run: pip install google-cloud-bigquery pandas

      - name: Query billing
        id: billing
        run: python scripts/bq_cost_report.py
        env:
          BILLING_PROJECT: ${{ secrets.BILLING_PROJECT }}
          BILLING_DATASET: ${{ secrets.BILLING_DATASET }}
          SLACK_WEBHOOK: ${{ secrets.SLACK_COST_WEBHOOK }}
          THRESHOLD_USD: "100"
```

```python
# scripts/bq_cost_report.py
from google.cloud import bigquery
import os, json
import urllib.request

client = bigquery.Client(project=os.environ["BILLING_PROJECT"])
threshold = float(os.environ.get("THRESHOLD_USD", "100"))

query = f"""
SELECT
  service.description AS service,
  ROUND(SUM(cost), 2) AS total_cost_usd,
  ROUND(SUM(cost) / 30, 2) AS daily_avg_usd
FROM `{os.environ["BILLING_PROJECT"]}.{os.environ["BILLING_DATASET"]}.gcp_billing_export_v1_*`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10
"""

results = list(client.query(query).result())
total = sum(r.total_cost_usd for r in results)

lines = [f"*GCP Cost Report — Last 30 days*", f"Total: *${total:.2f}*", ""]
for r in results:
    lines.append(f"• {r.service}: ${r.total_cost_usd:.2f} (${r.daily_avg_usd:.2f}/day)")

alert = " :rotating_light: *Over threshold!*" if total > threshold else ""
message = {"text": "\n".join(lines) + alert}

req = urllib.request.Request(
    os.environ["SLACK_WEBHOOK"],
    data=json.dumps(message).encode(),
    headers={"Content-Type": "application/json"}
)
urllib.request.urlopen(req)
print(f"Cost report sent. Total: ${total:.2f}")
```

---

### End-to-End Pipeline: PR to Lint to Test to Build to Deploy to Verify

```yaml
# .github/workflows/e2e-pipeline.yml
name: End-to-End Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.12"
  SERVICE: data-pipeline
  REGION: us-central1
  PROJECT: my-data-project
  REGISTRY: us-central1-docker.pkg.dev
  REPO: data

permissions:
  contents: read
  pull-requests: write
  id-token: write
  checks: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  # ─── CI ───────────────────────────────────────────────────────────
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip
      - run: pip install ruff
      - run: ruff check . --output-format=github
      - run: ruff format --check .

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip
      - run: pip install -e ".[dev]"
      - run: pytest tests/unit/ --cov=src --cov-report=xml -v
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage.xml

  # ─── CD (only on main) ───────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    outputs:
      image: ${{ steps.image.outputs.value }}
    steps:
      - uses: actions/checkout@v4
      - id: image
        run: echo "value=${{ env.REGISTRY }}/${{ env.PROJECT }}/${{ env.REPO }}/${{ env.SERVICE }}:${{ github.sha }}" >> $GITHUB_OUTPUT
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet
      - uses: docker/setup-buildx-action@v3
      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: buildx-${{ github.sha }}
          restore-keys: buildx-
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.image.outputs.value }}
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
      - run: rm -rf /tmp/.buildx-cache && mv /tmp/.buildx-cache-new /tmp/.buildx-cache

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - uses: google-github-actions/deploy-cloudrun@v2
        id: deploy
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ needs.build.outputs.image }}

  verify:
    name: Verify
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - run: pip install requests
      - name: Smoke test
        run: python scripts/smoke_test.py
        env:
          SERVICE_URL: ${{ needs.deploy.outputs.url }}

  notify:
    name: Notify
    runs-on: ubuntu-latest
    needs: [deploy, verify]
    if: always()
    steps:
      - name: Slack notification
        run: |
          STATUS="${{ needs.verify.result }}"
          if [ "$STATUS" = "success" ]; then
            COLOR="good"
            TEXT="Deployment successful: ${{ env.SERVICE }} @ ${{ github.sha }}"
          else
            COLOR="danger"
            TEXT="Deployment FAILED: ${{ env.SERVICE }} @ ${{ github.sha }}"
          fi
          curl -X POST '${{ secrets.SLACK_WEBHOOK }}' \
            -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$COLOR\",\"text\":\"$TEXT\"}]}"
```

---

## Troubleshooting

### Enable Debug Logging

```yaml
# Option 1: Set repository secret
# ACTIONS_STEP_DEBUG = true
# ACTIONS_RUNNER_DEBUG = true

# Option 2: Re-run with debug (UI: Re-run jobs → Enable debug logging)

# Option 3: In workflow
- name: Debug info
  run: |
    echo "Event: ${{ github.event_name }}"
    echo "Ref: ${{ github.ref }}"
    echo "Actor: ${{ github.actor }}"
    echo "SHA: ${{ github.sha }}"
    env | sort
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied to ...` | GITHUB_TOKEN lacks permission | Add `permissions:` block |
| `Process completed with exit code 1` | Non-zero exit in `run:` | Check step logs; add `set -x` to shell |
| `Resource not accessible by integration` | Missing token permission | Add specific permission |
| `Context access might be invalid: secrets` | Using secrets in unsupported context | Secrets not available in `if:` conditions |
| `Error: Artifact ... was not found` | Cross-run artifact reference | Artifacts expire after retention period |
| `OIDC token request failed` | Missing `id-token: write` | Add to `permissions:` block |
| `The process '/usr/bin/git' failed with exit code 128` | Shallow clone for git operations | Add `fetch-depth: 0` to checkout |
| `Cannot find module` | Missing `npm install` or wrong working-dir | Check `defaults.run.working-directory` |

### Debugging WIF Auth Failures

```yaml
- name: Debug WIF token
  run: |
    echo "OIDC token subject:"
    curl -sS -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://iam.googleapis.com/${{ secrets.WIF_PROVIDER }}" \
      | python3 -c "import sys,json,base64; t=json.load(sys.stdin)['value']; print(json.dumps(json.loads(base64.b64decode(t.split('.')[1]+'==')), indent=2))"
```

### Common WIF Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Workload Identity token exchange failed` | Wrong provider format | Use full resource name, not URL |
| `IAM permission denied` | SA not bound to pool | Re-run `add-iam-policy-binding` |
| `Attribute condition failed` | Repo name mismatch | Check `assertion.repository` value |
| `id-token: write not set` | Missing permission | Add `permissions: id-token: write` |

### Step-Level Debugging

```yaml
steps:
  - name: Debug failing step
    run: |
      set -x              # print every command
      set -e              # exit on error
      set -u              # error on undefined variable
      ./my-script.sh
    env:
      ACTIONS_STEP_DEBUG: true
```

---

### Quick Reference: Data Engineering CI/CD Checklist

```yaml
# Minimal data pipeline CI template
name: Pipeline CI
on:
  pull_request:
    branches: [main]
    paths: ["src/**", "tests/**", "pyproject.toml"]

permissions:
  contents: read
  id-token: write

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }
      - run: pip install ruff pytest
      - run: ruff check . --output-format=github
      - run: pytest tests/unit/ -v
```

---

### See Also

- [[github-actions-fundamentals]] — workflow anatomy, triggers, runners, GITHUB_TOKEN
- [[github-actions-patterns]] — matrix builds, reusable workflows, deployment patterns
- [dbt-transformation-layer](/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) — dbt project structure and development workflow
- [data-pipeline-testing-strategy](/14-Data-Architecture/Pipeline-Patterns/data-pipeline-testing-strategy) — Which tests to run at each CI/CD stage
