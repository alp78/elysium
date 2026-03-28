---
type: reference
category: github-actions
technology:
  - github
  - github-actions
  - yaml
tags: [ci-cd, github-actions]
aliases:
  - GitHub Actions
  - workflows
  - triggers
  - runners
  - GITHUB_TOKEN
  - actions/cache
  - artifacts
  - concurrency
  - reusable workflows
keywords:
  - github actions
  - workflow
  - yaml
  - trigger
  - runner
  - job
  - step
  - secret
  - artifact
  - cache
  - concurrency
  - matrix
  - expression
  - context
  - environment variable
  - GITHUB_TOKEN
  - permissions
  - schedule
  - workflow_dispatch
  - pull_request
  - push
  - release
  - workflow_call
  - needs
  - if conditional
description: "GitHub Actions fundamentals — workflow anatomy, triggers, runners, jobs, steps, secrets, caching, artifacts, and concurrency."
related:
  - "[[github-actions-patterns]]"
  - "[[github-actions-data-engineering]]"
  - "[[git-daily-workflow]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions Fundamentals

> [!abstract] Summary
> GitHub Actions automates software workflows directly in a repository. A **workflow** is a YAML file in `.github/workflows/` that defines when to run (triggers), where to run (runners), and what to run (jobs and steps). Workflows are typically triggered by the [[git-daily-workflow|daily Git workflow]] -- pushes, PRs, and merges fire the events that start CI pipelines.

---

## Workflow File Anatomy

Every workflow lives at `.github/workflows/<name>.yml`. GitHub discovers all files in that directory automatically.

```yaml
# .github/workflows/ci.yml

name: CI                          # Display name in GitHub UI

on:                               # Trigger(s)
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:                              # Workflow-level environment variables
  PYTHON_VERSION: "3.12"
  PROJECT: my-project

permissions:                      # GITHUB_TOKEN permissions (least privilege)
  contents: read
  pull-requests: write

concurrency:                      # Prevent parallel runs on same branch
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest        # Runner
    timeout-minutes: 10           # Fail-safe
    steps:
      - uses: actions/checkout@v4
      - name: Run ruff
        run: ruff check .

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint                   # Depends on lint job
    steps:
      - uses: actions/checkout@v4
      - name: Run pytest
        run: pytest
```

### Top-Level Keys

| Key | Required | Purpose |
|-----|----------|---------|
| `name` | No | Display name in GitHub UI |
| `on` | Yes | Triggers |
| `env` | No | Workflow-level environment variables |
| `permissions` | No | GITHUB_TOKEN scope |
| `concurrency` | No | Prevent duplicate runs |
| `defaults` | No | Default `run` shell/working-directory |
| `jobs` | Yes | Map of jobs to execute |

---

## Triggers (`on`)

### push

```yaml
on:
  push:
    branches:
      - main
      - "release/**"       # glob patterns supported
    branches-ignore:
      - "docs/**"
    paths:                 # only trigger if these paths changed
      - "src/**"
      - "pyproject.toml"
    paths-ignore:
      - "**.md"
    tags:
      - "v*"               # trigger on version tags
```

### pull_request

```yaml
on:
  pull_request:
    branches: [main]
    types:                 # default: opened, synchronize, reopened
      - opened
      - synchronize
      - reopened
      - ready_for_review
    paths:
      - "src/**"
```

> [!note] `pull_request` vs `pull_request_target`
> `pull_request` runs in the fork's context (no access to secrets). `pull_request_target` runs in the base repo's context (has secrets but unsafe with untrusted code).

### schedule (cron)

```yaml
on:
  schedule:
    - cron: "0 6 * * 1-5"   # 06:00 UTC Mon–Fri
    - cron: "0 0 * * 0"     # midnight UTC every Sunday
```

Cron syntax: `minute hour day-of-month month day-of-week`

> [!warning] Schedule jitter
> Scheduled workflows may run up to 15 minutes late under heavy load. Do not rely on exact timing for SLA-critical operations.

### workflow_dispatch (manual trigger)

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        default: staging
        type: choice
        options: [dev, staging, prod]
      dry_run:
        description: "Dry run (no actual changes)"
        required: false
        default: "false"
        type: boolean
      version:
        description: "Docker image tag"
        required: true
        type: string
```

Access inputs with `${{ inputs.environment }}`.

### repository_dispatch (external trigger)

```yaml
on:
  repository_dispatch:
    types: [data-pipeline-complete, model-trained]
```

Trigger via API:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{"event_type":"data-pipeline-complete","client_payload":{"run_id":"123"}}'
```

Access payload: `${{ github.event.client_payload.run_id }}`

### release

```yaml
on:
  release:
    types: [published, created, prereleased]
```

### workflow_call (reusable workflow)

```yaml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      GCP_SA_KEY:
        required: true
    outputs:
      image_tag:
        description: "Built Docker image tag"
        value: ${{ jobs.build.outputs.tag }}
```

### Multiple Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: "0 2 * * *"
```

---

## Runners

### GitHub-Hosted Runners

| Label | OS | Notes |
|-------|----|-------|
| `ubuntu-latest` | Ubuntu 22.04 | Fastest, cheapest |
| `ubuntu-22.04` | Ubuntu 22.04 | Pinned version |
| `ubuntu-20.04` | Ubuntu 20.04 | Legacy |
| `windows-latest` | Windows Server 2022 | ~2× cost |
| `macos-latest` | macOS 14 (arm64) | ~10× cost |
| `macos-13` | macOS 13 (x64) | Intel-based |

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
```

### Self-Hosted Runners

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, gpu]   # labels as array
```

### Runner Spec (Larger Runners)

```yaml
jobs:
  heavy-test:
    runs-on: ubuntu-latest-8-cores   # GitHub-hosted larger runner
```

---

## Jobs

### Basic Job

```yaml
jobs:
  my-job:
    name: "My Job"
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      JOB_VAR: value
    steps:
      - run: echo "hello"
```

### Sequential Jobs (needs)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "building"

  test:
    runs-on: ubuntu-latest
    needs: build              # waits for build to succeed
    steps:
      - run: echo "testing"

  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]      # waits for both
    steps:
      - run: echo "deploying"
```

### Parallel Jobs

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo "linting"

  type-check:
    runs-on: ubuntu-latest    # runs in parallel with lint
    steps:
      - run: echo "type checking"

  test:
    needs: [lint, type-check] # waits for both parallel jobs
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing"
```

### Job-Level Conditionals

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - run: echo "deploying to prod"

  notify-failure:
    runs-on: ubuntu-latest
    needs: deploy
    if: failure()             # only runs if deploy failed
    steps:
      - run: echo "send alert"
```

### Matrix Strategy

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false        # don't cancel others if one fails
      max-parallel: 4
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
        os: [ubuntu-latest, windows-latest]
        include:
          - python-version: "3.12"
            os: ubuntu-latest
            experimental: true
        exclude:
          - python-version: "3.10"
            os: windows-latest
    steps:
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
```

### Job Outputs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.tag.outputs.value }}
    steps:
      - name: Set tag
        id: tag
        run: echo "value=sha-${{ github.sha }}" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.image_tag }}"
```

---

## Steps

### uses (action)

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
    with:
      fetch-depth: 0          # full history (needed for git log)
      ref: ${{ github.head_ref }}

  - name: Setup Python
    uses: actions/setup-python@v5
    with:
      python-version: "3.12"
      cache: pip

  - name: Setup Node
    uses: actions/setup-node@v4
    with:
      node-version: "20"
      cache: npm
```

### run (shell command)

```yaml
steps:
  - name: Single line
    run: echo "hello"

  - name: Multi-line
    run: |
      pip install -r requirements.txt
      pip install -r requirements-dev.txt
    # Shell steps run in bash by default — apply the same
    # set -e / set -o pipefail practices from [[defensive-scripting]]

  - name: With custom shell
    shell: python
    run: |
      import sys
      print(f"Python {sys.version}")

  - name: PowerShell (Windows)
    shell: pwsh
    run: Write-Host "Windows runner"
```

### Step-level env and conditionals

```yaml
steps:
  - name: Deploy
    if: github.ref == 'refs/heads/main'
    env:
      API_KEY: ${{ secrets.PROD_API_KEY }}
      TARGET: production
    run: ./deploy.sh

  - name: Always clean up
    if: always()
    run: ./cleanup.sh

  - name: Continue even if failure
    continue-on-error: true
    run: ./optional-check.sh
```

### Step IDs and Outputs

```yaml
steps:
  - name: Get version
    id: version
    run: |
      VERSION=$(python -c "import tomllib; print(tomllib.load(open('pyproject.toml','rb'))['project']['version'])")
      echo "value=$VERSION" >> $GITHUB_OUTPUT

  - name: Use version
    run: echo "Building version ${{ steps.version.outputs.value }}"
```

---

## Expressions and Contexts

### Expression Syntax

```yaml
# In YAML values
${{ <expression> }}

# Examples
${{ github.sha }}
${{ secrets.MY_SECRET }}
${{ env.MY_VAR }}
${{ steps.my-step.outputs.result }}
${{ needs.build.outputs.tag }}
${{ matrix.python-version }}
```

### Operators

```yaml
# Comparison
${{ github.ref == 'refs/heads/main' }}
${{ github.event_name != 'schedule' }}

# Logical
${{ github.ref == 'refs/heads/main' && github.event_name == 'push' }}
${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop' }}

# Functions
${{ contains(github.ref, 'release') }}
${{ startsWith(github.ref, 'refs/tags/v') }}
${{ endsWith(github.actor, '-bot') }}
${{ format('sha-{0}', github.sha) }}
${{ toJSON(matrix) }}
${{ fromJSON(steps.data.outputs.json) }}
```

### Status Functions (job/step conditionals)

```yaml
if: success()          # default — previous steps succeeded
if: failure()          # at least one previous step failed
if: cancelled()        # workflow was cancelled
if: always()           # always run regardless of status
```

### github Context

| Expression | Value |
|-----------|-------|
| `github.sha` | Full commit SHA |
| `github.ref` | Branch/tag ref (`refs/heads/main`) |
| `github.ref_name` | Short ref name (`main`) |
| `github.event_name` | Trigger name (`push`, `pull_request`) |
| `github.actor` | User/app that triggered |
| `github.repository` | `owner/repo` |
| `github.run_id` | Unique run ID |
| `github.run_number` | Sequential run number |
| `github.workflow` | Workflow name |
| `github.workspace` | Runner workspace path |
| `github.event` | Full event payload |
| `github.token` | GITHUB_TOKEN value |

### runner Context

```yaml
${{ runner.os }}         # Linux, Windows, macOS
${{ runner.arch }}       # X64, ARM64
${{ runner.temp }}       # Temp directory
${{ runner.tool_cache }} # Tool cache directory
```

### job Context

```yaml
${{ job.status }}        # success, failure, cancelled
```

### steps Context

```yaml
${{ steps.<step-id>.outputs.<name> }}   # step output
${{ steps.<step-id>.outcome }}          # success, failure, skipped, cancelled
${{ steps.<step-id>.conclusion }}       # final result including continue-on-error
```

### needs Context

```yaml
${{ needs.<job-id>.outputs.<name> }}    # job output
${{ needs.<job-id>.result }}            # success, failure, skipped, cancelled
```

---

## Environment Variables

### Levels

```yaml
env:                          # Workflow level — available to all jobs
  REGISTRY: ghcr.io

jobs:
  build:
    env:                      # Job level — available to all steps in job
      IMAGE: my-app
    steps:
      - name: Build
        env:                  # Step level — only this step
          DOCKERFILE: prod.Dockerfile
        run: docker build -f $DOCKERFILE -t $REGISTRY/$IMAGE .
```

### Dynamic Variables (GITHUB_ENV)

Set a variable for all subsequent steps in the same job:

```yaml
steps:
  - name: Set dynamic var
    run: |
      IMAGE_TAG="sha-${GITHUB_SHA::8}"
      echo "IMAGE_TAG=$IMAGE_TAG" >> $GITHUB_ENV

  - name: Use dynamic var
    run: echo "Image: $IMAGE_TAG"   # available as env var
```

### GITHUB_OUTPUT (step outputs)

```yaml
steps:
  - name: Compute tag
    id: compute
    run: |
      TAG="v$(date +%Y%m%d)-${GITHUB_SHA::8}"
      echo "tag=$TAG" >> $GITHUB_OUTPUT

  - name: Use tag
    run: echo "${{ steps.compute.outputs.tag }}"
```

### GITHUB_STEP_SUMMARY (job summary)

```yaml
steps:
  - name: Write summary
    run: |
      echo "## Test Results" >> $GITHUB_STEP_SUMMARY
      echo "| Test | Result |" >> $GITHUB_STEP_SUMMARY
      echo "|------|--------|" >> $GITHUB_STEP_SUMMARY
      echo "| unit | ✅ passed |" >> $GITHUB_STEP_SUMMARY
```

### Built-in Environment Variables

| Variable | Description |
|---------|-------------|
| `GITHUB_SHA` | Commit SHA |
| `GITHUB_REF` | Branch/tag ref |
| `GITHUB_REF_NAME` | Short ref name |
| `GITHUB_WORKSPACE` | Checkout path |
| `GITHUB_REPOSITORY` | `owner/repo` |
| `GITHUB_ACTOR` | Triggering user |
| `GITHUB_RUN_ID` | Unique run ID |
| `GITHUB_RUN_NUMBER` | Sequential number |
| `GITHUB_TOKEN` | Auto-provisioned token |
| `RUNNER_OS` | `Linux`, `Windows`, `macOS` |
| `CI` | Always `true` |

---

## Secrets

### Types of Secrets

- **Repository secrets**: available to all workflows in the repo
- **Environment secrets**: only available when `environment:` is specified
- **Organization secrets**: shared across repos (requires org admin)

### Accessing Secrets

```yaml
steps:
  - name: Use secret
    env:
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    run: ./connect.sh

  # Never pass secrets directly in run commands (they appear in logs)
  # BAD:  run: curl -H "Authorization: ${{ secrets.TOKEN }}" ...
  # GOOD: env: TOKEN: ${{ secrets.TOKEN }}  then use $TOKEN in run
```

### Environment Secrets

```yaml
jobs:
  deploy:
    environment: production     # must match GitHub environment name
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        env:
          PROD_API_KEY: ${{ secrets.PROD_API_KEY }}  # env secret
        run: ./deploy.sh
```

---

## GITHUB_TOKEN

GitHub auto-creates a short-lived token for each workflow run.

### Default Permissions

Default permissions vary by org settings. Best practice: always declare explicitly.

### Permissions Block

```yaml
permissions:
  contents: read        # read repo contents
  pull-requests: write  # comment on PRs
  issues: write
  packages: write       # push to GitHub Packages (GHCR)
  id-token: write       # OIDC — required for Workload Identity
  checks: write
  statuses: write
  deployments: write
  actions: read
  security-events: write
```

Set at workflow level (applies to all jobs) or per-job:

```yaml
jobs:
  comment-pr:
    permissions:
      pull-requests: write
      contents: read
    runs-on: ubuntu-latest
```

### Using GITHUB_TOKEN

```yaml
steps:
  - name: Comment on PR
    uses: actions/github-script@v7
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      script: |
        github.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: 'Tests passed!'
        })
```

---

## Artifacts

Artifacts persist data beyond a job's lifetime, enabling cross-job data sharing and post-run downloads.

### Upload Artifact

```yaml
steps:
  - name: Run tests with coverage
    run: pytest --cov=src --cov-report=xml

  - name: Upload coverage report
    uses: actions/upload-artifact@v4
    with:
      name: coverage-report
      path: coverage.xml
      retention-days: 7        # default 90, max 90
      if-no-files-found: error # warn | ignore | error
```

### Upload Multiple Files

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: build-outputs
    path: |
      dist/
      reports/*.html
      !reports/internal-*.html   # exclude pattern
```

### Download Artifact (same workflow)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "artifact content" > output.txt
      - uses: actions/upload-artifact@v4
        with:
          name: my-artifact
          path: output.txt

  use-artifact:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: my-artifact
          path: ./downloaded/

      - run: cat ./downloaded/output.txt
```

### Download All Artifacts

```yaml
- uses: actions/download-artifact@v4
  with:
    path: all-artifacts/   # downloads all artifacts into subdirs by name
```

---

## Caching

Cache dependencies across runs to speed up workflows.

### actions/cache

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

The `key` is the exact match. `restore-keys` are prefix-match fallbacks (most specific first).

### Python (pip)

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: pip              # built-in cache support

# Or manual:
- uses: actions/cache@v4
  with:
    path: |
      ~/.cache/pip
      .venv
    key: ${{ runner.os }}-py3.12-${{ hashFiles('**/pyproject.toml', '**/requirements*.txt') }}
    restore-keys: |
      ${{ runner.os }}-py3.12-
```

### Node (npm)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: npm              # built-in

# Or manual:
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Docker Layer Caching

```yaml
- uses: actions/cache@v4
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-

- uses: docker/build-push-action@v5
  with:
    cache-from: type=local,src=/tmp/.buildx-cache
    cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

# Prevent cache from growing unbounded
- name: Move cache
  run: |
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

### uv (fast Python package manager)

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: ${{ runner.os }}-uv-${{ hashFiles('**/uv.lock') }}
    restore-keys: |
      ${{ runner.os }}-uv-
```

---

## Concurrency

### Cancel Redundant Runs

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This cancels any running workflow with the same name + branch when a new one starts.

### Per-Environment Serialization

```yaml
concurrency:
  group: deploy-${{ github.event.inputs.environment }}
  cancel-in-progress: false   # queue instead of cancel for deploys
```

### Job-Level Concurrency

```yaml
jobs:
  deploy:
    concurrency:
      group: production-deploy
      cancel-in-progress: false
```

---

## Timeout and Error Handling

### Timeout

```yaml
jobs:
  test:
    timeout-minutes: 30       # job-level timeout
    runs-on: ubuntu-latest
    steps:
      - name: Long test
        timeout-minutes: 20   # step-level timeout
        run: pytest --timeout=1200
```

### continue-on-error

```yaml
steps:
  - name: Optional lint check
    continue-on-error: true
    run: ruff check . --output-format=github

  - name: Always runs next
    run: echo "lint step result: ${{ steps.lint.outcome }}"
```

### Retry with a Third-Party Action

```yaml
- uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 30
    command: ./flaky-network-call.sh
```

### Manual Retry Pattern

The retry loop below follows the same [[defensive-scripting|defensive shell patterns]] used in production scripts -- short-circuit on success, log on failure, and cap retries.

```yaml
- name: Retry on failure
  run: |
    for i in 1 2 3; do
      ./network-call.sh && break || {
        echo "Attempt $i failed, retrying..."
        sleep 10
      }
    done
```

---

## Complete Example: Python Data Pipeline CI

```yaml
# .github/workflows/ci.yml
name: Data Pipeline CI

on:
  push:
    branches: [main, develop]
    paths:
      - "src/**"
      - "tests/**"
      - "pyproject.toml"
      - "requirements*.txt"
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
  workflow_dispatch:

env:
  PYTHON_VERSION: "3.12"
  UV_VERSION: "0.4.0"

permissions:
  contents: read
  pull-requests: write
  checks: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-lint-${{ hashFiles('**/pyproject.toml') }}

      - name: Install lint tools
        run: pip install ruff mypy

      - name: Ruff lint
        run: ruff check . --output-format=github

      - name: Ruff format check
        run: ruff format --check .

      - name: Type check
        run: mypy src/

  test:
    name: Test (Python ${{ matrix.python-version }})
    runs-on: ubuntu-latest
    needs: lint
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - uses: actions/cache@v4
        id: cache
        with:
          path: .venv
          key: ${{ runner.os }}-py${{ matrix.python-version }}-${{ hashFiles('**/pyproject.toml') }}

      - name: Install dependencies
        if: steps.cache.outputs.cache-hit != 'true'
        run: |
          python -m venv .venv
          . .venv/bin/activate
          pip install -e ".[dev]"

      - name: Run tests
        run: |
          . .venv/bin/activate
          pytest tests/ \
            --cov=src \
            --cov-report=xml \
            --cov-report=term-missing \
            --junit-xml=test-results.xml \
            -v

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: matrix.python-version == '3.12'
        with:
          name: coverage-report
          path: coverage.xml
          retention-days: 7

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.python-version }}
          path: test-results.xml
          retention-days: 7

  report:
    name: Coverage Report
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'pull_request'
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          name: coverage-report

      - name: Post coverage comment
        uses: MishaKav/pytest-coverage-comment@main
        with:
          pytest-xml-coverage-path: coverage.xml
          github-token: ${{ secrets.GITHUB_TOKEN }}

  build-check:
    name: Build Verification
    runs-on: ubuntu-latest
    needs: test
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

      - name: Build Docker image (no push)
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: my-pipeline:test
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      - name: Move cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

---

## Quick Reference: Common Patterns

```yaml
# Checkout with full git history
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

# Get short SHA
- run: echo "SHORT_SHA=${GITHUB_SHA::8}" >> $GITHUB_ENV

# Conditional step on main branch
- if: github.ref == 'refs/heads/main'
  run: ./deploy.sh

# Conditional step on PR
- if: github.event_name == 'pull_request'
  run: ./pr-checks.sh

# Conditional step on tag
- if: startsWith(github.ref, 'refs/tags/v')
  run: ./release.sh

# Pass secret as env var (not inline in run)
- env:
    MY_SECRET: ${{ secrets.MY_SECRET }}
  run: ./use-secret.sh

# Write multi-line output
- id: data
  run: |
    echo "key1=value1" >> $GITHUB_OUTPUT
    echo "key2=value2" >> $GITHUB_OUTPUT

# Dynamic matrix from script
- id: set-matrix
  run: echo "matrix=$(python scripts/get-matrix.py)" >> $GITHUB_OUTPUT
```

---

## See Also

- [[github-actions-patterns]] — matrix builds, reusable workflows, deployment strategies
- [[github-actions-data-engineering]] — data pipeline CI/CD, Workload Identity, dbt CI
- [[git-daily-workflow]] — branching strategy that pairs with these workflows
