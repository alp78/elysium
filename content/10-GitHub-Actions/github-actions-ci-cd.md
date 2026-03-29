---
type: how-to
category: git
technology: [git, github, gcp]
tags: [ci-cd, gcp, git, github-actions]
aliases: [GitHub Actions, CI/CD, workflow, gh run, workflow_dispatch, matrix testing, secrets management]
keywords: [GitHub Actions, workflow, YAML, trigger, push, pull_request, schedule, workflow_dispatch, matrix, secrets, GCP_SA_KEY, gh run, gh workflow run, deploy, Cloud Run, Artifact Registry, google-github-actions/auth]
description: "GitHub Actions CI/CD workflows for data engineering teams — triggers, matrix testing, secrets management, GCP authentication, and monitoring workflow runs with the GitHub CLI."
related:
  - "[[pull-requests-and-code-review]]"
  - "[[git-daily-workflow]]"
  - "[[terraform-registry-and-ci]]"
  - "[[image-management]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions CI/CD

GitHub Actions automates workflows (build, test, deploy) triggered by events like pushes, PRs, schedules, or manual triggers. Workflows are defined in YAML files in `.github/workflows/`.

### How GitHub Actions Connects to Git

Common trigger events:

- `push` to main — triggers deployment (e.g., deploy pipeline + dashboard to Cloud Run)
- `pull_request` opened/updated — triggers tests and linting (see [[pull-requests-and-code-review]] for the PR conventions that pair with these checks)
- `schedule` (cron) — triggers periodic jobs (e.g., nightly data refresh)
- `workflow_dispatch` — manual trigger via GitHub UI or CLI

---

### Monitoring Workflows with GitHub CLI

```bash
# List recent workflow runs with status
gh run list
# gh — GitHub CLI
# run list — list workflow runs (success/failure/in-progress)

# View details of a specific run
gh run view 12345
# run view — show run summary
# 12345 — the run ID

# View full logs of a run
gh run view 12345 --log
# --log — include step-by-step logs

# Watch the most recent run in real time
gh run watch
# run watch — stream live output

# Manually trigger a workflow
gh workflow run deploy.yml
# workflow run — trigger a workflow (must have workflow_dispatch trigger)
# deploy.yml — the workflow filename
```

---

### Common CI/CD Patterns for Data Teams

- On push to main: deploy pipeline container and dashboard to Cloud Run
- On PR: run unit tests, linting, SQL validation (for dbt-specific checks, see [[dbt-ci-cd]])
- On schedule: run data pipeline (e.g., daily at market close)
- On tag (`v*`): create a GitHub Release with changelog
- Matrix builds: test across Python 3.10, 3.11, 3.12 in parallel

> [!tip] Keep Secrets in GitHub, Not in Code
> Keep secrets (DB passwords, API keys) in GitHub Settings > Secrets. Reference them in workflows as `${{ secrets.MY_SECRET }}`.

---

## Secrets Management

GitHub Actions secrets are encrypted values stored at the repo (or org) level. Workflows reference them as `${{ secrets.SECRET_NAME }}` — they are never printed in logs.

```bash
# List all secrets configured for the repo
gh secret list
# secret list — show names of all configured secrets (values are never shown)

# Create or update a secret from a file
gh secret set GCP_SA_KEY < service-account-key.json
# secret set — create or overwrite a secret
# GCP_SA_KEY — the secret name referenced in workflows
# < service-account-key.json — read the value from a file instead of typing it

# Create a secret by pasting a value
gh secret set DD_API_KEY
# Prompts you to paste the value interactively (never visible in shell history)

# Delete a secret
gh secret delete OLD_SECRET
# secret delete — remove a secret permanently
```

#### google-github-actions/auth@v2 — authenticate to GCP using a stored secret

```yaml
steps:
  - uses: google-github-actions/auth@v2
    with:
      credentials_json: ${{ secrets.GCP_SA_KEY }}
```

The `credentials_json` field receives the full JSON content of the service account key. The action uses it to authenticate with GCP for deployments.

> [!danger] Missing Secret Produces a Cryptic Error, Not a Clear Failure
> When `GCP_SA_KEY` is missing or empty, the expression `${{ secrets.GCP_SA_KEY }}` resolves to an empty string. The `google-github-actions/auth` action then fails with `must specify exactly one of workload_identity_provider or credentials_json` -- not "secret is missing." Always verify secrets exist with `gh secret list` before debugging authentication failures.

#### Common secrets for GCP projects

| Secret name | What it contains | Used by |
|------------|-----------------|---------|
| `GCP_SA_KEY` | Service account key JSON (entire file contents) | `google-github-actions/auth` for GCP authentication |
| `DD_API_KEY` | Datadog API key | Pipeline containers for APM/log shipping |
| `DB_PASSWORD` | Database SA password | Pipeline and dashboard containers |

#### Important rules

- Never commit secret files (`.json` keys, `.env` files) to Git — add them to `.gitignore`
- Secrets are not passed to workflows triggered from **forks** (including Dependabot) — this is a GitHub security feature
- When a secret is missing or empty, the `${{ secrets.NAME }}` expression resolves to an empty string, which causes actions like `google-github-actions/auth` to fail with a cryptic error
- Rotate secrets periodically — delete the old key in GCP/Datadog, generate a new one, update the GitHub secret

---

> [!warning] Secrets Resolve to Empty String When Missing
> GitHub Actions does not fail when a secret is undefined -- `${{ secrets.UNDEFINED }}` silently becomes `""`. This means a typo in a secret name will not produce a "missing variable" error but will instead cause downstream actions to receive blank credentials. Use `gh secret list` to verify secret names match exactly.

### Example: Build and Deploy to Cloud Run

This workflow builds a Docker image, pushes it to Artifact Registry, and deploys to Cloud Run on every push to main:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker europe-west1-docker.pkg.dev --quiet

      - name: Build and push image
        run: |
          docker build -t europe-west1-docker.pkg.dev/${{ vars.PROJECT_ID }}/data-pipeline/pipeline:latest .
          docker push europe-west1-docker.pkg.dev/${{ vars.PROJECT_ID }}/data-pipeline/pipeline:latest

      - name: Update Cloud Run job
        run: |
          gcloud run jobs update data-pipeline-pipeline \
            --image europe-west1-docker.pkg.dev/${{ vars.PROJECT_ID }}/data-pipeline/pipeline:latest \
            --region europe-west1
```

### Example: Quartz Static Site Deployment to GitHub Pages

From the vault's Quartz publishing guide:

```yaml
name: Deploy Quartz to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Build Quartz
        run: npx quartz build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-22.04
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Example: Matrix Testing Across Python Versions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: pytest tests/
```

---

## Troubleshooting Common Errors

### "google-github-actions/auth failed: must specify exactly one of workload_identity_provider or credentials_json"

**Cause:** The `GCP_SA_KEY` secret is missing, empty, or not accessible to the workflow. GitHub Actions secrets are not passed to workflows triggered from forks (including Dependabot PRs).

```bash
# Fix: check if the secret exists
gh secret list
# Look for GCP_SA_KEY in the output

# Fix: set the secret from the service account key file
gh secret set GCP_SA_KEY < your-ci-key.json

# Fix: re-run the failed workflow
gh run rerun <RUN_ID>
```

> [!info] Fork and Dependabot PRs
> If the workflow was triggered by a fork or Dependabot, secrets are intentionally blocked by GitHub. You'll need to merge the PR first, then the push-to-main workflow will have access to secrets.

---

### Re-running Failed Workflows

```bash
# Re-run a specific workflow run
gh run rerun <RUN_ID>

# Re-run only the failed jobs in a run
gh run rerun <RUN_ID> --failed

# Watch the re-run
gh run watch
```

## Related

- [[pull-requests-and-code-review]] — PR events that trigger workflows
- [[terraform-registry-and-ci]] — the CI service account used by these workflows
- [[image-management]] — the Docker build/push commands used in workflows
- [[gitignore-patterns]] — what to gitignore to avoid leaking secrets

## References

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
- [GitHub CLI run commands](https://cli.github.com/manual/gh_run)
