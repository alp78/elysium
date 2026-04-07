---
title: "MOC: Terraform"
tags:
  - moc
  - terraform
  - hcl
  - gcp
  - infrastructure
---

# MOC: Terraform

Infrastructure as code from HCL syntax to production GCP provisioning —
19 pages covering language fundamentals, resource configuration, composition
patterns, and a copy-paste block library. Expand any section to browse contents.

> [!guide]- Language and Workflow
>
> [[domain-language-and-workflow]]
>
> HCL syntax fundamentals, variable and output management, provider configuration, state management, and the core plan/apply/destroy workflow.

> [!guide]- GCP Resources
>
> [[domain-gcp-resources]]
>
> Terraform configurations for provisioning GCP infrastructure — networking, compute instances, IAM and secrets, Cloud Run services, and container registry with CI integration.

> [!guide]- Patterns and Reference
>
> [[domain-patterns-and-reference]]
>
> Reusable Terraform patterns — conditional resources, dependency management, module composition — plus a cheat sheet and troubleshooting guide.

> [!guide]- Block Library
>
> [[domain-block-library]]
>
> Copy-paste Terraform block templates for GCP resources — foundation and networking, compute and storage, data services, IAM, secrets, and serverless.

## Cross-References

- [GCP](https://alp78.github.io/elysium/06-GCP/moc-gcp) — The GCP services these Terraform configs provision
- [GitHub Actions](https://alp78.github.io/elysium/10-GitHub-Actions/moc-github-actions) — CI/CD pipelines that run terraform plan/apply
- [Data Architecture](https://alp78.github.io/elysium/14-Data-Architecture/moc-data-architecture) — Architecture decisions that drive infrastructure choices
