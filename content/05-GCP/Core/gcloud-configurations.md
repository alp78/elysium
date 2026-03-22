---
type: concept
category: gcp
technology: [gcp, gcloud]
tags: [concept, gcp, configuration, multi-project, workflow]
aliases: [gcloud config, gcloud configurations, GCP project switching, named configurations]
keywords: [gcloud config configurations, gcloud config set, project switching, named configurations, multi-project, dev staging production, gcloud config list, activate configuration, environment safety, production protection]
description: "How to use gcloud named configurations to safely manage multiple GCP projects (dev, staging, production) and switch between them without error-prone manual config changes."
related: [gcloud-authentication, gcloud-projects-and-apis, gcloud-output-formatting]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# gcloud Configurations — Managing Multiple Projects

If you work across multiple GCP projects (dev, staging, production), switching `gcloud config set project` back and forth is error-prone. Named configurations solve this — each configuration is a named set of gcloud settings (project, region, zone, account) that you can switch between instantly.

## Creating and Switching Configurations

**Create named configurations for each environment:**

```bash
# Create configurations
gcloud config configurations create project-prod
gcloud config set project data-platform-prod
gcloud config set compute/region europe-west1
gcloud config set compute/zone europe-west1-b
gcloud config set account your-email@domain.com

gcloud config configurations create data-pipeline-dev
gcloud config set project data-pipeline-dev-sandbox
gcloud config set compute/region europe-west1
gcloud config set compute/zone europe-west1-b
```

**List and switch configurations:**

```bash
# List all configurations
gcloud config configurations list
# NAME         IS_ACTIVE  ACCOUNT                PROJECT
# project-prod   True       you@domain.com         data-platform-prod
# data-pipeline-dev    False      you@domain.com         data-pipeline-dev-sandbox

# Switch between configurations
gcloud config configurations activate data-pipeline-dev
# Now ALL gcloud commands target the dev project — no --project flag needed

# Override project for a single command (without switching)
gcloud compute instances list --project=data-pipeline-dev-sandbox
# --project = override the active configuration for this one command
# Use case: "Quick check on dev without switching away from prod"

# View current configuration
gcloud config list
# Shows: account, project, region, zone, and all other settings
```

**Basic project and region settings (without named configurations):**

```bash
# Set the active project
gcloud config set project data-platform-prod
# - config set = modify gcloud configuration
# - project = the GCP project ID (not display name)

# Set default region and zone
gcloud config set compute/region europe-west1
gcloud config set compute/zone europe-west1-b
```

## Protecting Production with Visual Cues

> [!warning] Protect Production
> Color-code your terminal based on which configuration is active. Add this to `~/.bashrc`:
> ```bash
> gcloud_env() {
>     local project=$(gcloud config get-value project 2>/dev/null)
>     case "$project" in
>         *prod*) echo -e "\033[31m[PROD]\033[0m" ;;  # RED for production
>         *dev*)  echo -e "\033[32m[DEV]\033[0m" ;;   # GREEN for dev
>         *)      echo -e "\033[33m[$project]\033[0m" ;; # YELLOW for unknown
>     esac
> }
> PS1='$(gcloud_env) \w\$ '
> ```
> Now your prompt shows `[PROD]` in red when targeting production — a visual safety net against running a destructive command in the wrong project.

## Why It Matters

Without named configurations, switching projects requires remembering to set project, region, zone, and account individually. One forgotten `gcloud config set project` means your next command hits the wrong environment. With named configurations, switching is atomic — one command changes everything.

## Related

- [[gcloud-authentication]] — Authentication context per configuration
- [[gcp-projects-and-apis]] — Project metadata and API management
- [[gcloud-output-formatting]] — Extract configuration details programmatically

## References

- [gcloud config configurations documentation](https://cloud.google.com/sdk/gcloud/reference/config/configurations)
