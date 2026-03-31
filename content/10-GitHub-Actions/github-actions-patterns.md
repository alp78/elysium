---
type: reference
category: github-actions
technology:
  - github
  - github-actions
  - docker
  - terraform
  - gcp
tags: [ci-cd, terraform, docker, gcp, github-actions]
aliases:
  - matrix builds
  - reusable workflows
  - composite actions
  - environment protection
  - deployment workflows
  - monorepo CI
keywords:
  - matrix builds
  - reusable workflows
  - composite actions
  - docker actions
  - environment protection
  - deployment workflow
  - terraform ci cd
  - docker build
  - artifact registry
  - multi-environment
  - monorepo
  - path filters
  - branch protection
  - release automation
  - semantic versioning
  - self-hosted runners
  - cost optimization
  - workflow_call
  - inputs
  - outputs
  - dorny paths-filter
  - cloud run
  - required reviewers
  - changelog
  - skip ci
description: "Advanced GitHub Actions patterns — matrix builds, reusable workflows, composite actions, deployment strategies, Terraform CI/CD, Docker builds, and monorepo patterns."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions Patterns

> [!quote]
> "The third time you do something, it should be done using an automated process."
>
> — **Jez Humble**, *Continuous Delivery* (2010)

> [!abstract] Summary
> Reusable patterns for production-grade GitHub Actions workflows. Covers matrix builds, reusable workflows, deployment strategies, Terraform automation, Docker builds, monorepo CI, and cost optimization. Many shell steps rely on [defensive scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) practices (`set -euo pipefail`, error trapping) to fail fast and surface problems clearly. To practice applying these patterns in realistic scenarios, work through [github-actions-problems](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-problems).

---

## Matrix Builds

### Python Version × OS Matrix

```yaml
# .github/workflows/test-matrix.yml
name: Test Matrix

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Python ${{ matrix.python-version }} / ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false          # continue other matrix cells on failure
      max-parallel: 6
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
        os: [ubuntu-latest, windows-latest, macos-latest]
        include:
          # add extra variable for specific combination
          - python-version: "3.12"
            os: ubuntu-latest
            upload-coverage: true
        exclude:
          # skip expensive combos
          - python-version: "3.10"
            os: macos-latest
          - python-version: "3.10"
            os: windows-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip

      - run: pip install -e ".[dev]"

      - run: pytest tests/ --cov=src --cov-report=xml

      - name: Upload coverage (only for flagged cell)
        if: matrix.upload-coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage.xml
```

### Dynamic Matrix from Script

```yaml
jobs:
  set-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.compute.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: compute
        run: |
          # Build matrix JSON dynamically
          MATRIX=$(python scripts/compute_matrix.py)
          echo "matrix=$MATRIX" >> $GITHUB_OUTPUT

  test:
    needs: set-matrix
    strategy:
      matrix: ${{ fromJSON(needs.set-matrix.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo "Testing ${{ matrix.service }}"
```

### Matrix with Services (Databases)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        db: [postgres, mysql]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - run: pytest tests/db/ --db=${{ matrix.db }}
```

---

## Reusable Workflows

A reusable workflow is a complete workflow file called from another workflow.

### Defining a Reusable Workflow

```yaml
# .github/workflows/_reusable-test.yml   (prefix _ = internal)
name: Reusable — Test

on:
  workflow_call:
    inputs:
      python-version:
        required: false
        type: string
        default: "3.12"
      working-directory:
        required: false
        type: string
        default: "."
      coverage-threshold:
        required: false
        type: number
        default: 80
    secrets:
      CODECOV_TOKEN:
        required: false
    outputs:
      coverage-pct:
        description: "Coverage percentage"
        value: ${{ jobs.test.outputs.coverage-pct }}

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.working-directory }}
    outputs:
      coverage-pct: ${{ steps.coverage.outputs.pct }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ inputs.python-version }}
          cache: pip

      - run: pip install -e ".[dev]"

      - run: |
          pytest tests/ \
            --cov=src \
            --cov-report=xml \
            --cov-fail-under=${{ inputs.coverage-threshold }}

      - id: coverage
        run: |
          PCT=$(python -c "import xml.etree.ElementTree as ET; t=ET.parse('coverage.xml').getroot(); print(round(float(t.get('line-rate'))*100))")
          echo "pct=$PCT" >> $GITHUB_OUTPUT
```

### Calling a Reusable Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test-api:
    uses: ./.github/workflows/_reusable-test.yml
    with:
      python-version: "3.12"
      working-directory: api/
      coverage-threshold: 85
    secrets:
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

  test-worker:
    uses: ./.github/workflows/_reusable-test.yml
    with:
      working-directory: worker/

  # Cross-org reusable workflow
  test-shared:
    uses: my-org/shared-workflows/.github/workflows/test.yml@main
    with:
      python-version: "3.12"
    secrets: inherit           # pass all caller secrets to callee
```

> [!note] Secrets inheritance
> `secrets: inherit` passes all caller secrets to the reusable workflow. Use specific secret mapping to be explicit.

---

## Composite Actions

Composite actions bundle multiple steps into a reusable action you call with `uses:`.

### Creating a Composite Action

```
.github/actions/setup-python-env/action.yml
```

```yaml
# .github/actions/setup-python-env/action.yml
name: Setup Python Environment
description: Install Python and project dependencies with caching

inputs:
  python-version:
    description: Python version
    required: false
    default: "3.12"
  install-extras:
    description: pip extras to install (e.g. "dev,test")
    required: false
    default: "dev"

outputs:
  cache-hit:
    description: Whether the cache was restored
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: composite
  steps:
    - uses: actions/setup-python@v5
      with:
        python-version: ${{ inputs.python-version }}

    - uses: actions/cache@v4
      id: cache
      with:
        path: .venv
        key: ${{ runner.os }}-py${{ inputs.python-version }}-${{ hashFiles('**/pyproject.toml', '**/requirements*.txt') }}
        restore-keys: |
          ${{ runner.os }}-py${{ inputs.python-version }}-

    - name: Install dependencies
      if: steps.cache.outputs.cache-hit != 'true'
      shell: bash
      run: |
        python -m venv .venv
        . .venv/bin/activate
        pip install -e ".[${{ inputs.install-extras }}]"
```

### Using the Composite Action

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: ./.github/actions/setup-python-env
    with:
      python-version: "3.11"
      install-extras: "dev,test"

  - run: |
      . .venv/bin/activate
      pytest tests/
```

---

### Docker Container Actions

```yaml
# .github/actions/run-sql-lint/action.yml
name: SQL Lint
description: Run sqlfluff on SQL files

inputs:
  dialect:
    description: SQL dialect
    required: false
    default: bigquery
  path:
    description: Path to lint
    required: false
    default: "."

runs:
  using: docker
  image: Dockerfile
  args:
    - ${{ inputs.dialect }}
    - ${{ inputs.path }}
```

---

## Environment Protection (Staging → Production)

### Define Environments in GitHub

Go to **Settings → Environments** and create:
- `staging` — no protection rules
- `production` — required reviewers, deployment branch `main` only

### Deployment Workflow with Gate

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.build.outputs.image }}
    steps:
      - uses: actions/checkout@v4
      - id: build
        run: echo "image=myapp:${{ github.sha }}" >> $GITHUB_OUTPUT

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.myapp.com
    steps:
      - name: Deploy to staging
        run: |
          echo "Deploying ${{ needs.build.outputs.image }} to staging"
          ./scripts/deploy.sh staging ${{ needs.build.outputs.image }}

  integration-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest tests/integration/ --base-url=https://staging.myapp.com

  deploy-production:
    needs: [build, integration-test]
    runs-on: ubuntu-latest
    environment:
      name: production           # triggers required reviewer approval
      url: https://myapp.com
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying ${{ needs.build.outputs.image }} to production"
          ./scripts/deploy.sh production ${{ needs.build.outputs.image }}
```

---

### Deployment to Cloud Run

Workflow secrets like `WIF_PROVIDER` and service account emails are stored through [GitHub's encrypted secrets](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) mechanism and injected at runtime.

```yaml
# .github/workflows/deploy-cloud-run.yml
name: Build and Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: my-gcp-project
  REGION: us-central1
  SERVICE: my-service
  REGISTRY: us-central1-docker.pkg.dev
  REPO: my-repo

permissions:
  contents: read
  id-token: write              # required for Workload Identity

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.image.outputs.value }}
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3

      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

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
          tags: ${{ steps.image.outputs.value }}
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      - name: Move cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Deploy to Cloud Run
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ needs.build.outputs.image }}
          flags: >-
            --memory=1Gi
            --cpu=1
            --min-instances=1
            --max-instances=10
            --concurrency=80
            --timeout=300
          env_vars: |
            ENVIRONMENT=production
            LOG_LEVEL=INFO

      - name: Verify deployment
        run: |
          URL=${{ steps.deploy.outputs.url }}
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL/health)
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed: HTTP $STATUS"
            exit 1
          fi
          echo "Deployment verified: $URL"
```

---

## Terraform CI/CD

### Terraform CI/CD — Plan on PR (with Comment)

```yaml
# .github/workflows/terraform-plan.yml
name: Terraform Plan

on:
  pull_request:
    paths:
      - "infra/**"
      - ".github/workflows/terraform*.yml"

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

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.TF_SERVICE_ACCOUNT }}

      - name: Terraform Init
        id: init
        run: terraform init

      - name: Terraform Validate
        id: validate
        run: terraform validate -no-color

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan 2>&1
        continue-on-error: true   # capture output even on failure

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const plan = `${{ steps.plan.outputs.stdout }}`;
            const status = '${{ steps.plan.outcome }}';
            const body = `## Terraform Plan
            **Status:** ${status === 'success' ? '✅ Success' : '❌ Failed'}

            <details><summary>Show Plan</summary>

            \`\`\`terraform
            ${plan}
            \`\`\`

            </details>

            *Workflow: \`${{ github.workflow }}\` | Run: \`${{ github.run_id }}\`*`;

            // Find existing bot comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const botComment = comments.find(c =>
              c.user.type === 'Bot' && c.body.includes('Terraform Plan'));

            if (botComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body,
              });
            }

      - name: Fail if plan failed
        if: steps.plan.outcome == 'failure'
        run: exit 1

      - uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: infra/tfplan
          retention-days: 7
```

> [!danger] Auto-approve can destroy resources
>
> The `apply` job below runs `terraform apply -auto-approve` on merge to main. A bad Terraform change that passes plan review can still destroy resources if state drift occurred between plan and apply. Mitigations: (1) always use the `production` environment with required reviewers, (2) pin `terraform_version` to avoid behavior changes, (3) consider downloading the plan artifact from the PR workflow and running `terraform apply tfplan` instead of a fresh apply.

### Terraform CI/CD — Apply on Merge to Main

```yaml
# .github/workflows/terraform-apply.yml
name: Terraform Apply

on:
  push:
    branches: [main]
    paths:
      - "infra/**"

permissions:
  contents: read
  id-token: write

jobs:
  apply:
    runs-on: ubuntu-latest
    environment: production     # requires approval
    defaults:
      run:
        working-directory: infra/
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.TF_SERVICE_ACCOUNT }}

      - run: terraform init
      - run: terraform apply -auto-approve -no-color
```

### Terraform CI/CD — Drift Detection (Scheduled)

```yaml
# .github/workflows/terraform-drift.yml
name: Terraform Drift Detection

on:
  schedule:
    - cron: "0 8 * * 1-5"    # 08:00 UTC weekdays
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra/
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.TF_SERVICE_ACCOUNT }}
      - run: terraform init
      - name: Detect drift
        id: plan
        run: |
          terraform plan -detailed-exitcode -no-color 2>&1
          echo "exitcode=$?" >> $GITHUB_OUTPUT
        continue-on-error: true
      - name: Alert on drift
        if: steps.plan.outputs.exitcode == '2'
        run: |
          echo "DRIFT DETECTED — notify Slack or create issue"
          # curl -X POST ${{ secrets.SLACK_WEBHOOK }} ...
```

---

### Docker Build and Push to Artifact Registry

```yaml
# .github/workflows/docker-build.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: us-central1-docker.pkg.dev
  PROJECT: my-project
  REPO: docker-repo
  IMAGE: my-app

permissions:
  contents: read
  id-token: write

jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Compute tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.PROJECT }}/${{ env.REPO }}/${{ env.IMAGE }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-,format=short

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}

      - name: Configure Docker auth
        run: gcloud auth configure-docker ${{ env.REGISTRY }} --quiet

      - uses: docker/setup-buildx-action@v3

      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            GIT_SHA=${{ github.sha }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
          provenance: false      # smaller image, no SBOM by default

      - run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

---

### Multi-Environment Deployment

```yaml
# .github/workflows/multi-env-deploy.yml
name: Multi-Environment Deploy

on:
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, prod]
        required: true

jobs:
  set-env:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.name }}
      url: ${{ steps.env.outputs.url }}
    steps:
      - id: env
        run: |
          if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
            NAME="${{ inputs.environment }}"
          elif [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            NAME="staging"
          else
            NAME="dev"
          fi
          declare -A URLS=([dev]="https://dev.myapp.com" [staging]="https://staging.myapp.com" [prod]="https://myapp.com")
          echo "name=$NAME" >> $GITHUB_OUTPUT
          echo "url=${URLS[$NAME]}" >> $GITHUB_OUTPUT

  deploy:
    needs: set-env
    runs-on: ubuntu-latest
    environment:
      name: ${{ needs.set-env.outputs.environment }}
      url: ${{ needs.set-env.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: |
          ENV="${{ needs.set-env.outputs.environment }}"
          echo "Deploying to $ENV at ${{ needs.set-env.outputs.url }}"
```

---

## Monorepo: Path Filters

### Using dorny/paths-filter

```yaml
# .github/workflows/monorepo-ci.yml
name: Monorepo CI

on:
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      worker: ${{ steps.filter.outputs.worker }}
      infra: ${{ steps.filter.outputs.infra }}
      shared: ${{ steps.filter.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'services/api/**'
              - 'shared/**'
            worker:
              - 'services/worker/**'
              - 'shared/**'
            infra:
              - 'infra/**'
            shared:
              - 'shared/**'

  test-api:
    needs: detect-changes
    if: needs.detect-changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/api/
    steps:
      - uses: actions/checkout@v4
      - run: pip install -e ".[dev]"
      - run: pytest

  test-worker:
    needs: detect-changes
    if: needs.detect-changes.outputs.worker == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/worker/
    steps:
      - uses: actions/checkout@v4
      - run: pip install -e ".[dev]"
      - run: pytest

  terraform-plan:
    needs: detect-changes
    if: needs.detect-changes.outputs.infra == 'true'
    uses: ./.github/workflows/_reusable-terraform-plan.yml
    secrets: inherit
```

---

### Branch Protection and Required Status Checks

Configure in **Settings → Branches → Add rule**:
- Require status checks: `lint`, `test (3.12)`, `build-check`
- Require branches to be up to date
- Require linear history
- Restrict pushes to `main`

For monorepos, use required status checks that always run even when skipped:

```yaml
# Always-pass job when changes not detected (satisfies required check)
test-api:
  needs: detect-changes
  if: always()          # always run
  runs-on: ubuntu-latest
  steps:
    - name: Run tests
      if: needs.detect-changes.outputs.api == 'true'
      run: pytest
    - name: Skip (no changes)
      if: needs.detect-changes.outputs.api != 'true'
      run: echo "No API changes — skipping tests"
```

---

## Release Automation

### Semantic Versioning + Changelog

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Release Please
        uses: google-github-actions/release-please-action@v4
        id: release
        with:
          release-type: python
          package-name: my-package

      - name: Build and publish (on release)
        if: ${{ steps.release.outputs.release_created }}
        run: |
          pip install build twine
          python -m build
          twine upload dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
```

### Manual Tag-Based Release

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      id-token: write    # for trusted publishing (OIDC)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: |
          pip install build
          python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        # No password needed — uses OIDC trusted publishing
```

---

## Self-Hosted Runners

### Setup

```bash
# On the runner machine:
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.316.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.316.0/actions-runner-linux-x64-2.316.0.tar.gz
tar xzf actions-runner-linux-x64-2.316.0.tar.gz
./config.sh --url https://github.com/OWNER/REPO --token TOKEN
./run.sh
```

### Using Self-Hosted Runners

```yaml
jobs:
  gpu-training:
    runs-on: [self-hosted, linux, gpu, high-memory]
    steps:
      - uses: actions/checkout@v4
      - run: python train.py
```

### Security Considerations

> [!warning] Self-hosted runner security
> Never use self-hosted runners with public repos — PRs from forks can execute arbitrary code. For public repos, use GitHub-hosted runners exclusively.

```yaml
# Only allow self-hosted runners for internal branches
jobs:
  build:
    runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-latest' || 'self-hosted' }}
```

### Runner Labels for Routing

```yaml
# Register runner with labels
./config.sh --url ... --token ... --labels "linux,x64,high-memory,us-central1"

# Use in workflow
runs-on: [self-hosted, high-memory, us-central1]
```

---

## Cost Optimization

### Timeout (Prevent Runaway Jobs)

```yaml
jobs:
  test:
    timeout-minutes: 20   # fail fast vs 6-hour GitHub default
    runs-on: ubuntu-latest
    steps:
      - timeout-minutes: 10   # step-level
        run: pytest
```

### Cancel Redundant Runs

> [!warning] Cancel-in-progress kills deploys
>
> Setting `cancel-in-progress: true` at the workflow level cancels any in-flight run when a new push arrives. This is safe for PR checks but dangerous for deploy workflows -- cancelling a deployment mid-flight can leave infrastructure in an inconsistent state. Use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` to limit cancellation to PR events only.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Skip CI

```yaml
# Commit message-based skip:
# git commit -m "chore: update docs [skip ci]"

on:
  push:
    branches: [main]

jobs:
  test:
    if: >-
      !contains(github.event.head_commit.message, '[skip ci]') &&
      !contains(github.event.head_commit.message, '[ci skip]')
    runs-on: ubuntu-latest
    steps:
      - run: pytest
```

### Path Filtering (Skip Unaffected Jobs)

```yaml
on:
  push:
    paths:
      - "src/**"
      - "tests/**"
      - "pyproject.toml"
    paths-ignore:
      - "docs/**"
      - "**.md"
      - ".gitignore"
```

### Use Caching Aggressively

```yaml
# Cache Python env — saves 30-60s per run
- uses: actions/cache@v4
  with:
    path: .venv
    key: venv-${{ runner.os }}-py${{ matrix.python-version }}-${{ hashFiles('pyproject.toml') }}

# Cache Docker layers — saves 2-5 min per build
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha        # GitHub Actions cache backend
    cache-to: type=gha,mode=max
```

### Smaller Runners When Possible

```yaml
# Use ubuntu-latest (not larger) for lint/test
# Reserve larger runners for actual builds
jobs:
  lint:
    runs-on: ubuntu-latest    # cheapest
  build:
    runs-on: ubuntu-latest-4-cores   # larger for Docker builds
```

---

### Complete Pattern: PR to Test to Deploy

```yaml
# .github/workflows/full-pipeline.yml
name: Full Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  id-token: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  PYTHON_VERSION: "3.12"
  REGISTRY: us-central1-docker.pkg.dev
  PROJECT: my-project
  REPO: docker
  SERVICE: my-service
  REGION: us-central1

jobs:
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
      - run: pytest --cov=src --cov-report=xml --junit-xml=results.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results.xml

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    outputs:
      image: ${{ steps.image.outputs.value }}
    steps:
      - uses: actions/checkout@v4
      - id: image
        run: |
          echo "value=${{ env.REGISTRY }}/${{ env.PROJECT }}/${{ env.REPO }}/${{ env.SERVICE }}:${{ github.sha }}" >> $GITHUB_OUTPUT
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

  deploy-staging:
    name: Deploy Staging
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.myapp.com
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}-staging
          region: ${{ env.REGION }}
          image: ${{ needs.build.outputs.image }}

  deploy-production:
    name: Deploy Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ needs.build.outputs.image }}
```

---

### See Also

- [github-actions-fundamentals](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-fundamentals) — workflow anatomy, triggers, runners, core concepts
- [github-actions-data-engineering](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-data-engineering) — data pipeline CI/CD, dbt, Workload Identity
- [terraform-plan-apply-destroy](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-plan-apply-destroy) — Terraform workflow details
- [environment-management-strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — How GitHub Actions environments fit into the full promotion workflow
