---
title: "05 - dbt: CI/CD"
tags: [pipeline, dbt, github-actions]
status: stable
updated: 2026-03-23
description: "GitHub Actions CI with slim builds and manifest diffing, Workload Identity Federation, pre-commit hooks, and CD via Git pull or Docker rebuild."
---

# dbt: CI/CD

> [!quote]
> "The longer you wait to integrate, the more it costs and the more unpredictable the cost becomes."
>
> — **Mary Poppendieck**, *Lean Software Development* (2003)

> [!abstract]- Summary
>
> Explains how to build a safe dbt CI/CD path using state-aware selection, manifest management, keyless cloud auth, pre-commit enforcement, GitHub Actions workflows, and deployment patterns that keep transformation changes reviewable before they reach production orchestration.
>
> **CI goals and state-aware selection**
> - Defines the goals of dbt CI, covers slim builds, `state:modified+`, deferred state, and manifest management so pull requests validate only what changed without losing DAG awareness
> - Explains how production artifacts are saved and then reused in CI to keep feedback fast while still preserving realistic dependency context
>
> **Identity, preflight, and workflow automation**
> - Covers Workload Identity Federation, GCP setup, GitHub Actions auth steps, and dbt pre-commit hooks so CI can run with short-lived credentials and catch simple errors before expensive warehouse execution begins
> - Connects local developer hygiene with hosted CI so the pipeline enforces the same transformation quality expectations across both environments
>
> **Deployment and orchestration patterns**
> - Covers full dbt CI and CD workflow files plus Airflow deployment patterns such as git-pull-based and Docker-rebuild-based release models so teams can choose how transformed code reaches the orchestrator safely
> - Emphasizes deployment as a controlled promotion path, not just a post-merge shell script, especially when warehouse credentials and scheduler runtimes differ from local development
>
> **Operations and safety**
> - Warnings: stale manifest state, over-broad cloud credentials, CI that rebuilds too much or too little, pre-commit checks that diverge from hosted CI, and Airflow deployment patterns that make rollback or reproducibility unclear
> - Recommendations: keep artifacts versioned and explicit, prefer keyless auth, validate only the affected subgraph where possible, align local hooks with hosted CI, and choose a deployment path that makes runtime state observable and repeatable

> [!note]- Glossary
>
> **CI/CD**
> - The automation path that validates dbt changes before merge and promotes approved code into production execution environments.
> - It matters here because the note is about making dbt delivery repeatable, reviewable, and safe rather than manual and ad hoc.
>
> > [!warning] Automation scales current habits
> >
> > CI/CD is only as safe as the assumptions already encoded in the project. It amplifies good layering and testing, but it also amplifies sloppy operational patterns.
>
> ---
>
> **Slim build**
> - A dbt CI strategy that executes only changed nodes and the necessary dependent graph instead of rebuilding the entire project.
> - It matters here because fast, selective validation is one of the main reasons dbt CI remains practical in larger projects.
>
> > [!info] Speed through graph-aware selectivity
> >
> > Slim builds work because dbt understands dependencies. They are an optimization of scope, not a reduction in model rigor.
>
> ---
>
> **State selection**
> - A selector mode that compares the current branch to saved dbt artifacts and targets only modified resources and their graph neighborhood.
> - It matters here because most scalable dbt CI depends on comparing current code to a trusted prior state.
>
> > [!warning] CI trust depends on artifact quality
> >
> > If the saved state does not truly represent production or the intended baseline, slim CI can validate the wrong set of models and create false confidence.
>
> ---
>
> **Manifest**
> - The dbt artifact that records project graph metadata, configs, and node definitions for a given state.
> - It matters here because manifests are the backbone of deferred execution and state-aware CI selection.
>
> > [!warning] Treat manifests as versioned runtime inputs
> >
> > A manifest used in CI is part of the execution contract, not just an incidental file. Save and retrieve it deliberately so comparisons are meaningful.
>
> ---
>
> **Deferred state**
> - A dbt execution mode where unchanged upstream refs can resolve against another environment's artifacts instead of being rebuilt locally.
> - It matters here because defer is what makes slim CI realistic when only a subset of the graph should be validated in a PR.
>
> > [!warning] Environment substitution must be explicit
> >
> > Deferred refs are powerful, but they also change what relation a model points at. Teams should know exactly which environment is being trusted as the comparison baseline.
>
> ---
>
> **Workload Identity Federation**
> - A keyless cloud authentication mechanism that exchanges GitHub-issued identity for short-lived warehouse or cloud credentials.
> - It matters here because secure dbt CI/CD should avoid long-lived service-account keys wherever possible.
>
> > [!danger] Identity scope is deployment risk
> >
> > Keyless auth is safer than static secrets only when the trust mapping is narrow and intentional. Broad federation rules simply move the blast radius to a different control plane.
>
> ---
>
> **Pre-commit hook**
> - A local repository automation step that runs before commit to catch formatting, linting, or simple validation issues early.
> - It matters here because fast local checks reduce noisy CI failures and make warehouse-backed validation more focused.
>
> > [!info] Cheap failures first
> >
> > The best pre-commit checks catch problems before the code even reaches CI. They should complement, not replace, the deeper hosted pipeline.
>
> ---
>
> **GitHub Actions workflow**
> - A version-controlled automation definition that runs dbt CI or CD logic in response to repository events.
> - It matters here because the note's reference pipeline uses GitHub Actions as the hosted control plane for validation and promotion.
>
> > [!warning] Workflow code is production logic
> >
> > dbt CI/CD behavior is defined in YAML just as much as in SQL. Workflow changes deserve the same review rigor as transformation code changes.
>
> ---
>
> **Artifact persistence**
> - The practice of saving build outputs such as manifests so later runs can compare against or defer to prior state.
> - It matters here because dbt CI/CD depends on carrying trustworthy execution context across runs, not just rerunning commands blindly.
>
> > [!warning] Missing artifacts degrade selectivity
> >
> > If artifacts are not saved predictably, teams fall back to broad rebuilds or inconsistent state assumptions, both of which weaken CI quality.
>
> ---
>
> **Airflow deployment pattern**
> - The mechanism by which updated dbt code is made available to the Airflow runtime, such as pulling git state or rebuilding a container image.
> - It matters here because shipping validated dbt code into the orchestrator is the final step that makes CI/CD operationally complete.
>
> > [!warning] Deploy path defines rollback story
> >
> > A deployment method is not just a delivery convenience. It determines how reproducible runtime state is and how easy it will be to roll back after a bad release.
>
> ---
>
> **Keyless auth**
> - An authentication approach that avoids storing long-lived static credentials in CI systems by exchanging short-lived identity tokens instead.
> - It matters here because dbt CI/CD often needs warehouse access, and reducing secret sprawl is a major operational safety improvement.
>
> > [!danger] Safer by design, not by default
> >
> > Keyless auth is a strong pattern, but it still needs careful trust boundaries, branch restrictions, and provider-side policy so the right runs get the right access.
>
> ---
>
> **Rollback path**
> - The documented method for returning production execution to a known-good dbt version after a bad deployment.
> - It matters here because CI/CD design is incomplete unless teams know how to back out a broken change cleanly in the orchestrated runtime.
>
> > [!warning] Deploy confidence needs reversal capability
> >
> > Fast promotion without a clear rollback story is just accelerated risk. Delivery pipelines should make the reverse move understandable as well as the forward one.

> [!example] Delivery Pipeline Readiness
>
> > [!success] Controlled Promotion
> >
> > - Use this pattern when dbt changes must move from pull request to production through repeatable validation, short-lived cloud auth, and an explicit promotion path into Airflow or another execution surface.
> > - Lean on slim builds, saved manifests, and aligned local hooks when you need fast feedback without losing graph awareness or reproducibility.
>
> > [!failure] Automated Chaos
> >
> > - Avoid formal CI/CD if the project still lacks basic testing, layering, or artifact discipline, because the pipeline will only automate unstable behavior faster.
> > - Do not treat deployment automation as complete just because code reaches production; rollback, state provenance, and credential scope still need to be visible and controlled.

### dbt CI Goals

| Goal | Mechanism |
|------|-----------|
| Catch compilation errors on every PR | `dbt compile` against dev BigQuery dataset |
| Run only affected models and tests | Slim CI with `state:modified+` selector |
| Avoid full-project cost on each PR | Download production `manifest.json` as baseline |
| Enforce SQL style | sqlfluff pre-commit hook |
| Authenticate without long-lived keys | Workload Identity Federation |

---

### dbt Slim Build: State-Based Selection

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

> [!tip] State-modified CI optimization
>
> `state:modified+` is the single biggest CI cost-saver for large projects. A 300-model ESG project may touch only 4-8 models per PR, so CI runs in 2-3 minutes instead of 45.

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

### dbt Pre-Commit Hooks

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

> [!note] Pre-commit hook requirements
>
> `dbt compile` in the pre-commit hook requires a working `profiles.yml` pointing at a dev target. Use environment variables so the hook works on every developer's machine without checking in credentials.

---

### Full dbt CI Workflow: dbt-ci.yml

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

### Full dbt CD Workflow: dbt-cd.yml

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

### Airflow CD Pattern A — Git Pull on Worker

The Airflow worker clones or pulls the latest `main` branch before each DAG run. Simple, but couples Airflow worker access to GitHub.

```python
from airflow.operators.bash import BashOperator

pull_dbt = BashOperator(
    task_id="git_pull_dbt",
    bash_command="cd /opt/dbt/financial_indices && git pull origin main",
)
```

**Risk:** A broken commit on `main` breaks the next scheduled run. Mitigate by tagging releases and checking out tags instead of `main`.

### Airflow CD Pattern B — Docker Image Rebuild

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

- [github-actions-data-engineering](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-data-engineering)
- [github-actions-patterns](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-patterns)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-airflow-integration](https://alp78.github.io/elysium/11-dbt/Operations/dbt-airflow-integration)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
