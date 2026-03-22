---
type: reference
category: reference
technology: [terraform]
tags: [reference, cheat-sheet, terraform, iac]
aliases: [Terraform cheat sheet, tf cheat sheet, Terraform quick reference]
keywords: [terraform, cheat sheet, quick reference, init, plan, apply, destroy, state, import, workspace, hcl]
description: "Quick reference cheat sheet for Terraform CLI commands — init, plan, apply, destroy, state management, and importing existing resources."
related:
  - "[[terraform-plan-apply-destroy]]"
  - "[[terraform-state-management]]"
  - "[[hcl-syntax-basics]]"
  - "[[terraform-variables-and-outputs]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Cheat Sheet

Quick reference for the Terraform CLI. Follow wikilinks for detailed explanations.

## Core Workflow

```bash
terraform init          # Download providers, initialize backend
terraform plan          # Preview changes (dry run)
terraform apply         # Execute changes (prompts for confirmation)
terraform apply -auto-approve  # Skip confirmation (CI/CD only)
terraform destroy       # Tear down all managed resources
```

See [[terraform-plan-apply-destroy]].

## State Management

```bash
terraform state list                     # List all resources in state
terraform state show RESOURCE_ADDRESS    # Show resource details
terraform state rm RESOURCE_ADDRESS      # Remove resource from state (does NOT delete it)
terraform import RESOURCE_ADDRESS GCP_ID # Import existing resource into state
terraform state mv OLD_ADDRESS NEW_ADDRESS  # Rename resource in state
```

See [[terraform-state-management]].

## Variables

```bash
# Pass variables via CLI
terraform apply -var="project_id=my-project" -var="region=europe-west1"

# Pass variables via file
terraform apply -var-file="prod.tfvars"
```

See [[terraform-variables-and-outputs]].

## Outputs

```bash
terraform output                  # Show all outputs
terraform output -raw OUTPUT_NAME # Get raw value (for scripts)
terraform output -json            # JSON format
```

## Common Flags

| Flag | Purpose |
|------|---------|
| `-target=RESOURCE` | Only plan/apply a specific resource |
| `-refresh=false` | Skip state refresh (faster, use carefully) |
| `-parallelism=N` | Limit concurrent operations |
| `-lock=false` | Disable state locking (emergency only) |

## File Organization

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, backend |
| `variables.tf` | Input variables |
| `outputs.tf` | Output values |
| `network.tf` | VPC, subnets, firewall |
| `compute.tf` | VMs, disks |
| `iam.tf` | Service accounts, IAM bindings |
| `run.tf` | Cloud Run services/jobs |

See [[hcl-syntax-basics]].
