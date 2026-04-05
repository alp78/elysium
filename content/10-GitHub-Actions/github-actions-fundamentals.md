---
title: "GitHub Actions Fundamentals"
tags:
  - github-actions
  - ci-cd
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
description: "GitHub Actions fundamentals — workflow anatomy, triggers, runners, jobs, steps, secrets, caching, artifacts, and concurrency."
parent: "[[domain-foundations-and-patterns]]"
links:
  - "[[github-actions-patterns]]"
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# GitHub Actions Fundamentals

> [!quote]
> "There should be two tasks for a human being to perform to deploy software into a development, test, or production environment: to pick the version and environment and to press the 'deploy' button."
>
> — **David Farley**, *Continuous Delivery* (2010)

This file is the syntax and concept reference for GitHub Actions. It covers every building block — workflow files, triggers, runners, jobs, steps, expressions, secrets, caching, artifacts, and concurrency — with annotated YAML fragments. For applied workflows (CI pipelines, Cloud Run deployments, dbt CI, Terraform automation), see [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) and [github-actions-data-engineering](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-data-engineering). Workflows are typically triggered by the [daily Git workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — pushes, PRs, and merges fire the events that start CI pipelines.

## Workflow File Anatomy

Every workflow lives at `.github/workflows/<name>.yml`. GitHub discovers all YAML files in that directory automatically — no registration step is needed.

The example below shows the complete structure of a minimal CI workflow with two sequential jobs. Each top-level key is explained in the table that follows.

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.12"
  PROJECT: my-project

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Run ruff
        run: ruff check .

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - name: Run pytest
        run: pytest
```

### Top-Level Keys

| Key | Required | Purpose |
|---|---|---|
| `name` | No | Display name shown in the GitHub UI |
| `on` | Yes | Event triggers — which repository events activate the workflow |
| `env` | No | Workflow-level environment variables, available to all jobs and steps |
| `permissions` | No | Explicit `GITHUB_TOKEN` scope — always declare for least privilege |
| `concurrency` | No | Prevent duplicate runs on the same branch or environment |
| `defaults` | No | Default `run` shell and `working-directory` for all steps |
| `jobs` | Yes | Map of jobs to execute — each job runs on its own runner |

## Triggers (`on`)

The `on:` key defines which repository events activate the workflow. Each trigger type can be filtered by branch, path, tag, or activity type. Multiple triggers can be combined — the workflow runs when any of them fires.

### push

Fires when commits are pushed to a matching branch or when a matching tag is created. Supports glob patterns for branches and tags, and `paths`/`paths-ignore` filters to restrict triggering to specific file changes.

```yaml
on:
  push:
    branches:
      - main
      - "release/**"
    branches-ignore:
      - "docs/**"
    paths:
      - "src/**"
      - "pyproject.toml"
    paths-ignore:
      - "**.md"
    tags:
      - "v*"
```

### pull_request

Fires when a pull request is opened, updated (new commits pushed), or reopened against a matching branch. By default, the workflow runs against the **merge commit** (the result of merging the PR into the base branch), not the PR branch HEAD. The `types:` filter controls which PR activities trigger the workflow — the defaults are `opened`, `synchronize`, and `reopened`.

```yaml
on:
  pull_request:
    branches: [main]
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review
    paths:
      - "src/**"
```

> [!danger] pull_request_target security risk
> `pull_request` runs in the fork's context with **no access to secrets** — safe for untrusted code. `pull_request_target` runs in the **base repo's context** with full secret access and write permissions. If a `pull_request_target` workflow checks out and executes PR code, a malicious PR can exfiltrate secrets.

> [!success] Safe pattern for pull_request_target
> Use `pull_request_target` only for non-code operations (labeling, commenting). Never check out the PR's code (`ref: ${{ github.event.pull_request.head.sha }}`) in a `pull_request_target` workflow. For building/testing fork PRs with secrets, use a two-workflow approval pattern.

### schedule (cron)

Fires on a cron schedule in UTC. Multiple schedules can be defined — each creates an independent trigger. Cron syntax: `minute hour day-of-month month day-of-week`. The minimum interval is 5 minutes.

```yaml
on:
  schedule:
    - cron: "0 6 * * 1-5"
    - cron: "0 0 * * 0"
```

> [!warning] Schedule jitter
> Scheduled workflows may run up to 15 minutes late under heavy load. Do not rely on exact timing for SLA-critical operations.

> [!success] Design for schedule jitter
>
> For SLA-critical operations, use `workflow_dispatch` with explicit timing control, or trigger pipelines from external schedulers (Cloud Scheduler, Airflow) that have guaranteed timing and retry logic. If using `schedule`, design the workflow to be idempotent — safe to run slightly early or late without producing incorrect results.

### workflow_dispatch (manual trigger)

Enables manual triggering from the GitHub UI ("Run workflow" button) or the CLI (`gh workflow run`). Supports typed input parameters — `string`, `boolean`, `choice`, `number`, and `environment` — that the user fills in at trigger time. Access input values with `${{ inputs.<name> }}`.

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

### repository_dispatch (external trigger)

Fires when an external system sends a POST request to the GitHub API. This enables triggering workflows from other CI systems, webhooks, or custom scripts. The `client_payload` field passes arbitrary JSON data into the workflow, accessible via `${{ github.event.client_payload.<key> }}`.

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

Fires when a GitHub Release is published, created, or pre-released. Commonly used to trigger deployment workflows or package publishing.

```yaml
on:
  release:
    types: [published, created, prereleased]
```

### workflow_call (reusable workflow)

Defines a workflow that can be called by other workflows using `uses: ./.github/workflows/<name>.yml`. The called workflow receives typed `inputs` and `secrets` from the caller, and can return `outputs` to the caller. This is the mechanism behind reusable workflows.

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

A workflow can combine multiple triggers. The workflow runs when **any** of the listed events fires. This is common for workflows that should run on both push and PR, plus support manual triggering and a nightly schedule.

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

## Runners

A runner is the virtual machine (or physical machine) that executes a job. The `runs-on:` key specifies which runner to use. GitHub provides hosted runners with pre-installed tools, or teams can register self-hosted runners for specialized hardware or network access.

### GitHub-Hosted Runners

GitHub-hosted runners are ephemeral VMs — each job gets a clean environment. They are the default choice for most workloads. Cost multipliers apply: Linux is 1×, Windows 2×, macOS 10×.

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

Self-hosted runners are machines you manage. Use label arrays to target runners with specific capabilities. For security considerations, see the self-hosted runner section in [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd).

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, gpu]
```

### Larger Runners

GitHub offers larger runners with more CPU cores for compute-heavy jobs. These are only available on Team and Enterprise plans and are billed at higher per-minute rates proportional to the core count.

```yaml
jobs:
  heavy-test:
    runs-on: ubuntu-latest-8-cores
```

## Jobs

A job is a set of steps that execute on the same runner. By default, jobs in a workflow run in **parallel**. Use `needs:` to create dependencies between jobs and enforce sequential execution. Each job gets a fresh runner environment — files and environment variables do not persist between jobs (use artifacts or outputs for cross-job data).

### Basic Job

A minimal job specifies a runner, an optional timeout, and a list of steps. The `timeout-minutes` key is a fail-safe that kills the job if it exceeds the specified duration (default: 360 minutes / 6 hours).

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

The `needs:` key creates a dependency. A job with `needs: build` waits for the `build` job to succeed before starting. Pass an array to wait for multiple jobs. If any dependency fails, the dependent job is skipped unless `if: always()` is set.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "building"

  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - run: echo "testing"

  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]
    steps:
      - run: echo "deploying"
```

### Parallel Jobs

Jobs without `needs:` run in parallel by default. In this example, `lint` and `type-check` start simultaneously. The `test` job waits for both to complete.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo "linting"

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: echo "type checking"

  test:
    needs: [lint, type-check]
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing"
```

### Job-Level Conditionals

The `if:` key on a job evaluates an expression before the job starts. The job is skipped entirely if the expression is false. Status functions (`failure()`, `success()`, `always()`, `cancelled()`) check the result of dependent jobs.

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
    if: failure()
    steps:
      - run: echo "send alert"
```

### Matrix Strategy

A matrix generates multiple parallel job instances from a set of variable combinations. Each combination runs as a separate job on its own runner. The `include:` key adds extra combinations, and `exclude:` removes specific ones.

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
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

> [!info] Matrix behavior
> - `fail-fast: false` — by default, GitHub cancels all remaining matrix jobs when one fails. Setting `false` lets all combinations run to completion.
> - `max-parallel: 4` — limits concurrent matrix jobs. Useful for rate-limited APIs or to control runner costs.
> - `include:` adds extra variable combinations beyond the Cartesian product. `exclude:` removes specific combinations from the product.

### Job Outputs

Job outputs pass data from one job to another via the `needs` context. The producing job declares `outputs:` mapping output names to step output expressions. The consuming job reads them with `${{ needs.<job-id>.outputs.<name> }}`.

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

## Steps

Steps are the individual units of work within a job. They execute sequentially in the order defined. A step either invokes a reusable action (`uses:`) or runs a shell command (`run:`). Each step runs in its own process but shares the runner's filesystem with other steps in the same job.

### uses (action)

The `uses:` key invokes a reusable action from the GitHub Marketplace, a public repository, or a local path. Actions accept parameters via the `with:` key. Common setup actions include `actions/checkout` (clone the repository), `actions/setup-python` (install a Python version), and `actions/setup-node` (install Node.js).

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
    with:
      fetch-depth: 0
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

> [!info] fetch-depth
> `fetch-depth: 0` clones the full Git history. The default (`1`) is a shallow clone — sufficient for builds but insufficient for `git log`, changelog generation, or tools that read commit timestamps.

### run (shell command)

The `run:` key executes a shell command. Use `|` for multi-line commands. Shell steps run in `bash` by default on Linux/macOS runners (`set -eo pipefail` is applied). For shell scripting best practices, see [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting). The `shell:` key overrides the default — options include `bash`, `sh`, `python`, `pwsh`, and `cmd`.

```yaml
steps:
  - name: Single line
    run: echo "hello"

  - name: Multi-line
    run: |
      pip install -r requirements.txt
      pip install -r requirements-dev.txt

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

Steps support `if:` conditions, `env:` variables, and `continue-on-error:`. The `if: always()` pattern ensures a cleanup step runs even if previous steps failed. The `continue-on-error: true` flag lets the workflow proceed even if the step fails — but use it carefully.

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

The `id:` key assigns a unique identifier to a step. Subsequent steps read its outputs via `${{ steps.<id>.outputs.<name> }}`. Outputs are set by writing `key=value` to the `$GITHUB_OUTPUT` file.

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

## Expressions and Contexts

Expressions are evaluated at runtime using the `${{ }}` syntax. They access context objects (`github`, `secrets`, `env`, `steps`, `needs`, `matrix`, `runner`, `job`), perform comparisons, and call built-in functions. Expressions are used in `if:` conditions, `env:` values, `with:` parameters, and anywhere YAML values accept dynamic content.

### Expression Syntax

The `${{ }}` wrapper is required in most YAML value positions. Inside `if:` conditions, the wrapper is optional — GitHub evaluates the expression automatically.

```yaml
${{ github.sha }}
${{ secrets.MY_SECRET }}
${{ env.MY_VAR }}
${{ steps.my-step.outputs.result }}
${{ needs.build.outputs.tag }}
${{ matrix.python-version }}
```

### Operators

Comparison and logical operators work within expressions. Built-in functions provide string matching, formatting, and JSON conversion.

```yaml
${{ github.ref == 'refs/heads/main' }}
${{ github.event_name != 'schedule' }}

${{ github.ref == 'refs/heads/main' && github.event_name == 'push' }}
${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop' }}

${{ contains(github.ref, 'release') }}
${{ startsWith(github.ref, 'refs/tags/v') }}
${{ endsWith(github.actor, '-bot') }}
${{ format('sha-{0}', github.sha) }}
${{ toJSON(matrix) }}
${{ fromJSON(steps.data.outputs.json) }}
```

### Status Functions

Status functions check the result of previous steps or dependent jobs. They are used in `if:` conditions to control conditional execution.

```yaml
if: success()
if: failure()
if: cancelled()
if: always()
```

- `success()` — default when no `if:` is specified. Runs only if all previous steps succeeded.
- `failure()` — runs if at least one previous step or dependent job failed.
- `cancelled()` — runs if the workflow was cancelled.
- `always()` — runs regardless of status. Use for cleanup, notifications, or artifact uploads.

### github Context

The `github` context contains information about the workflow run, the triggering event, the repository, and the actor. It is available in every step.

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

## Environment Variables

Environment variables can be set at three levels: workflow, job, and step. Lower levels override higher levels when names collide. GitHub also provides built-in variables (`GITHUB_SHA`, `GITHUB_REF`, etc.) that are always available.

### Levels

Variables declared at the workflow level are available in all jobs and steps. Job-level variables override workflow-level variables of the same name, and step-level variables override both.

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

`GITHUB_ENV` sets environment variables dynamically for all subsequent steps in the same job. Write `KEY=VALUE` to the `$GITHUB_ENV` file in a step, and all later steps can read `$KEY` as a regular environment variable.

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

## Secrets

Secrets are encrypted values stored at the repository, environment, or organization level. Workflows access them via `${{ secrets.NAME }}`. GitHub redacts secret values from logs automatically. Secrets are not passed to workflows triggered from forks.

### Types of Secrets

GitHub supports three scopes for secrets, each with different visibility:

- **Repository secrets** — available to all workflows in the repo. Created in Settings → Secrets.
- **Environment secrets** — only available when the job declares `environment: <name>`. Environment secrets override repository secrets of the same name.
- **Organization secrets** — shared across repositories in the org. Requires org admin access. Can be scoped to specific repositories.

### Accessing Secrets

Always pass secrets through `env:` variables, never inline in `run:` commands. Inline secrets appear in the `run:` field of the workflow log (the command itself is logged even though the value is redacted).

```yaml
steps:
  - name: Use secret
    env:
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    run: ./connect.sh
```

> [!danger] Secrets inline in run commands
> `run: curl -H "Authorization: ${{ secrets.TOKEN }}" ...` expands the secret into the shell command, which is logged. Even though GitHub redacts known secret values, partial matches or encoding can leak.

> [!success] Pass secrets via env
> Assign the secret to an `env:` variable and reference it as `$TOKEN` in the `run:` script. The env variable is injected into the process environment without appearing in the command text.

### Environment Secrets

Environment secrets are scoped to a specific GitHub environment. They are only available when the job declares `environment:`. This enables per-stage secrets (e.g., `PROD_API_KEY` only available in the `production` environment).

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

## GITHUB_TOKEN

GitHub automatically creates a short-lived token (`GITHUB_TOKEN`) for each workflow run. This token authenticates API calls to the GitHub REST and GraphQL APIs. It expires when the workflow completes.

### Default Permissions

Default permissions vary by organization settings — some orgs grant read-write, others restrict to read-only. Because the default is unpredictable, always declare explicit `permissions:` at the workflow or job level.

### Permissions Block

The `permissions:` key restricts the `GITHUB_TOKEN` to only the scopes the workflow needs. Start with `permissions: {}` (no permissions) and add only what is required.

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

## Artifacts

Artifacts persist data beyond a job's lifetime, enabling cross-job data sharing and post-run downloads. Unlike cache (which speeds up dependency installation), artifacts are build **outputs** — test results, coverage reports, compiled binaries, or Docker images. Default retention is 90 days.

> [!info] Artifacts vs cache
> **Artifacts** persist build outputs across jobs and workflows. Use for test results, coverage reports, and binaries. Default 90-day retention. Free storage up to plan limits.
> **Cache** restores dependency directories between runs. Use for pip, npm, and Docker layer caches. Entries expire after 7 days of no access. 10 GB limit per repository.

### Upload Artifact

`actions/upload-artifact@v4` uploads files from the runner to GitHub's artifact storage. The `retention-days` parameter controls how long the artifact is kept (default 90, max 90). The `if-no-files-found` parameter controls behavior when the path matches no files.

```yaml
steps:
  - name: Run tests with coverage
    run: pytest --cov=src --cov-report=xml

  - name: Upload coverage report
    uses: actions/upload-artifact@v4
    with:
      name: coverage-report
      path: coverage.xml
      retention-days: 7
      if-no-files-found: error
```

### Upload Multiple Files

Use YAML multi-line syntax with glob patterns. Prefix a pattern with `!` to exclude files.

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

`actions/download-artifact@v4` retrieves artifacts uploaded earlier in the same workflow. The consuming job must declare `needs:` on the producing job. Downloaded files are placed in the specified `path:` directory.

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

## Caching

Caching stores dependency directories between workflow runs, avoiding repeated downloads. GitHub-hosted runners start with a clean environment on every job, so without caching, every run installs dependencies from scratch.

> [!info] Cache limits
> - Cache entries expire after **7 days** of no access.
> - Total cache size per repository is limited to **10 GB**. Oldest entries are evicted first when the limit is reached.
> - Caches are **not portable across operating systems** — a cache built on Linux cannot be restored on Windows.

### actions/cache

The `actions/cache@v4` action saves and restores a directory based on a computed key. The `key` must be an exact match to restore the cache. `restore-keys` provides ordered prefix-match fallbacks — if the exact key misses, GitHub restores the most recent cache matching the prefix.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

### Python (pip)

Many `setup-*` actions have built-in cache support via a `cache:` parameter, requiring less configuration than the explicit `actions/cache` action.

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: pip

The manual `actions/cache` approach gives more control over what is cached (e.g., including `.venv`):
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

Node.js caching follows the same pattern — use the built-in `cache: npm` parameter or the explicit `actions/cache` action.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: npm

Manual approach:
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Docker Layer Caching

Docker layer caching stores BuildKit layers between runs, avoiding rebuilds of unchanged layers. The rotate pattern (`rm old && mv new old`) prevents the cache directory from growing unbounded.

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

- name: Rotate cache
  run: |
    rm -rf /tmp/.buildx-cache
    mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```

### uv (fast Python package manager)

[uv](https://github.com/astral-sh/uv) is a Rust-based Python package manager that is significantly faster than pip. Cache the `~/.cache/uv` directory keyed on `uv.lock`.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: ${{ runner.os }}-uv-${{ hashFiles('**/uv.lock') }}
    restore-keys: |
      ${{ runner.os }}-uv-
```

## Concurrency

Concurrency groups prevent duplicate workflow runs from executing simultaneously. Only one run per group is active at a time. For detailed patterns and gotchas, see the Concurrency section in [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd).

### Cancel Redundant Runs

The most common pattern for CI workflows: cancel the in-progress run when a new push to the same branch arrives. The group name combines the workflow name and branch ref, creating a separate lane per branch.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Per-Environment Serialization

For deployment workflows, queue rather than cancel. Setting `cancel-in-progress: false` ensures a running deployment finishes before the next one starts — preventing partial deployments.

```yaml
concurrency:
  group: deploy-${{ github.event.inputs.environment }}
  cancel-in-progress: false
```

### Job-Level Concurrency

```yaml
jobs:
  deploy:
    concurrency:
      group: production-deploy
      cancel-in-progress: false
```

## Timeout and Error Handling

Timeouts and error handling control how jobs respond to slow or failing steps. Without explicit timeouts, a hanging job consumes billable minutes for up to 6 hours (the default job timeout).

### Timeout

Timeouts can be set at the job or step level. The step-level timeout overrides the job-level timeout for that step. Always set `timeout-minutes` on long-running jobs to prevent runaway billing.

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

The `continue-on-error: true` flag on a step lets the workflow proceed even if the step fails. The step's `outcome` will be `failure`, but its `conclusion` (which accounts for `continue-on-error`) will be `success`. Use this for optional checks that shouldn't block the pipeline.

> [!warning] continue-on-error masks real failures
> If used carelessly, `continue-on-error: true` silently swallows errors. Always check `${{ steps.<id>.outcome }}` in a later step to handle the failure explicitly.

> [!success] Check outcome explicitly
> Reference `steps.<id>.outcome` (the raw result before `continue-on-error` is applied) rather than `steps.<id>.conclusion` (which is always `success` when `continue-on-error: true`).

```yaml
steps:
  - name: Optional lint check
    continue-on-error: true
    run: ruff check . --output-format=github

  - name: Always runs next
    run: echo "lint step result: ${{ steps.lint.outcome }}"
```

### Retry with a Third-Party Action

The `nick-fields/retry` action wraps a command with automatic retry logic, useful for flaky network calls or rate-limited APIs.

```yaml
- uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 30
    command: ./flaky-network-call.sh
```

### Manual Retry Pattern

The retry loop below follows the same [defensive shell patterns](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) used in production scripts -- short-circuit on success, log on failure, and cap retries.

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

## Complete Example: Python Data Pipeline CI

This workflow combines all the concepts from this page into a production-ready CI pipeline for a Python data project. It runs lint → test (matrix across Python versions) → coverage report → Docker build verification, with caching, artifacts, concurrency control, and conditional execution.

The workflow file lives at `.github/workflows/ci.yml`.

```yaml
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

## Quick Reference

Common step patterns for copy-paste use. Each snippet is a standalone step fragment.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- run: echo "SHORT_SHA=${GITHUB_SHA::8}" >> $GITHUB_ENV

- if: github.ref == 'refs/heads/main'
  run: ./deploy.sh

- if: github.event_name == 'pull_request'
  run: ./pr-checks.sh

- if: startsWith(github.ref, 'refs/tags/v')
  run: ./release.sh

- env:
    MY_SECRET: ${{ secrets.MY_SECRET }}
  run: ./use-secret.sh

- id: data
  run: |
    echo "key1=value1" >> $GITHUB_OUTPUT
    echo "key2=value2" >> $GITHUB_OUTPUT

- id: set-matrix
  run: echo "matrix=$(python scripts/get-matrix.py)" >> $GITHUB_OUTPUT
```

## Related

**GitHub Actions chapter:**
- [[github-actions-ci-cd]] — secrets management, caching, concurrency, environments, security best practices
- [[github-actions-patterns]] — matrix builds, reusable workflows, deployment strategies
- [[github-actions-data-engineering]] — data pipeline CI/CD, Workload Identity, dbt CI

**Git (Chapter 08):**
- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — branching strategy that pairs with these workflows

**Shell (Chapter 01):**
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — shell practices applied in `run:` steps

**GCP (Chapter 06):**
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — IAM and Workload Identity Federation for OIDC auth

## References

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [GitHub Actions contexts and expressions](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [actions/cache documentation](https://github.com/actions/cache)
- [actions/upload-artifact documentation](https://github.com/actions/upload-artifact)
- [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments)
