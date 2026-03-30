---
type: concept
category: engineering-practice
technology: [git, github-actions, docker]
tags: [ci-cd, docker, github-actions, git]
aliases: [GitHub Actions, CI/CD pipelines, continuous integration, continuous deployment, GHA]
keywords: [github actions, ci/cd, workflow, pipeline, matrix testing, deployment, docker build, artifact registry, cloud run, automated testing, pre-commit hooks]
description: "GitHub Actions CI/CD workflow patterns for data engineering — building Docker images, running tests, deploying to Cloud Run, and managing infrastructure with Terraform."
related:
  - "[[github-actions-ci-cd]]"
  - "[docker-compose](/09-Docker/docker-compose)"
  - "[image-management](/09-Docker/image-management)"
  - "[terraform-plan-apply-destroy](/07-Terraform/Fundamentals/terraform-plan-apply-destroy)"
  - "[git-daily-workflow](/08-Git/git-daily-workflow)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GitHub Actions CI/CD Workflows

GitHub Actions automates build, test, and deployment pipelines triggered by repository events (push, PR, schedule, manual dispatch). For data engineering teams, the key workflows are: building and pushing [Docker images](/09-Docker/docker-compose), running pipeline tests, deploying to [Cloud Run](/06-GCP/Serverless/cloud-run-jobs-vs-services) via [Terraform-managed infrastructure](/07-Terraform/GCP-Resources/terraform-cloud-run), and validating [Terraform changes](/07-Terraform/Fundamentals/terraform-plan-apply-destroy).

### Workflow YAML Structure

Every workflow is a YAML file in `.github/workflows/`:

```yaml
name: Deploy Pipeline
on:
  push:
    branches: [main]
  workflow_dispatch:  # manual trigger

jobs:
  build-and-deploy:
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      id-token: write  # for GCP Workload Identity Federation

    steps:
      - uses: actions/checkout@v4

      # Authenticate using Workload Identity Federation (see [gcloud-authentication](/06-GCP/Core/gcloud-authentication))
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.SA_EMAIL }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker europe-west1-docker.pkg.dev

      - name: Build and push
        run: |
          docker build -t europe-west1-docker.pkg.dev/$PROJECT/repo/pipeline:${{ github.sha }} .
          docker push europe-west1-docker.pkg.dev/$PROJECT/repo/pipeline:${{ github.sha }}

      - name: Deploy to Cloud Run Job
        run: |
          gcloud run jobs update pipeline-job \
            --image europe-west1-docker.pkg.dev/$PROJECT/repo/pipeline:${{ github.sha }} \
            --region europe-west1
```

## Key Patterns

### Matrix Testing

Run tests across multiple Python versions or configurations in parallel:

```yaml
strategy:
  matrix:
    python-version: ["3.11", "3.12"]
    os: [ubuntu-22.04]
```

### Manual Workflow Dispatch with Inputs

Trigger workflows manually with parameters — useful for running specific pipeline steps:

```yaml
on:
  workflow_dispatch:
    inputs:
      steps:
        description: "Pipeline steps to run (e.g., 1-5)"
        required: true
        default: "1-9"
      environment:
        description: "Target environment"
        type: choice
        options: [dev, staging, prod]
```

### Pre-commit Hooks

Enforce code quality before commits even reach GitHub:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/psf/black
    rev: 24.1.1
    hooks:
      - id: black

  - repo: https://github.com/PyCQA/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
```

> [!warning] Secrets management
>
> Never hardcode credentials in workflow files. Use GitHub Secrets (`${{ secrets.NAME }}`) for API keys, passwords, and service account credentials. For GCP, prefer [Workload Identity Federation](/06-GCP/Core/gcloud-authentication) over service account key files.

## Related

- [[github-actions-ci-cd]] — data pipeline project-specific workflow configurations
- [git-daily-workflow](/08-Git/git-daily-workflow) — Git workflow that feeds into CI/CD
- [image-management](/09-Docker/image-management) — Docker image build and push patterns
- [terraform-plan-apply-destroy](/07-Terraform/Fundamentals/terraform-plan-apply-destroy) — Terraform in CI/CD pipelines
