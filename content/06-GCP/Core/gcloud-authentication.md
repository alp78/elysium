---
type: concept
category: gcp
technology: [gcp, gcloud]
tags: [infrastructure, gcp]
aliases: [gcloud auth, GCP authentication, Application Default Credentials, ADC, gcloud login]
keywords: [gcloud auth login, application-default, ADC, OAuth2, service account authentication, key file, workload identity, GOOGLE_APPLICATION_CREDENTIALS, metadata server, gcloud auth list, access token, credential search order]
description: "How GCP authentication works with gcloud CLI: interactive login, Application Default Credentials (ADC), service account key files, and the credential search order that client libraries follow."
related: [gcloud-configurations, iam-service-accounts, gcloud-projects-and-apis, cloud-run-configuration]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Authentication with gcloud CLI

GCP uses OAuth 2.0 tokens for authentication. Every gcloud command sends a token that identifies who you are and what you are authorized to do. Understanding the two types of credentials — user credentials and Application Default Credentials (ADC) — prevents the most common "permission denied" errors in pipeline development.

## How It Works

There are three authentication flows: interactive login for humans, Application Default Credentials for code/SDKs, and service account activation for CI/CD and production environments. The gcloud CLI commands are identical on Linux and Windows.

## Authentication Commands

**Interactive login (human user):**

```bash
# Interactive login (you, the human)
gcloud auth login
# Opens a browser → you log in with your Google account → gcloud receives an OAuth token
# This token is stored in ~/.config/gcloud/ and refreshed automatically
# Use for: interactive work (debugging, ad-hoc queries, infrastructure changes)
```

**Application Default Credentials (what your code uses):**

```bash
# Application Default Credentials (ADC) — what your CODE uses
gcloud auth application-default login
# DIFFERENT from gcloud auth login!
# gcloud auth login = credentials for the gcloud CLI itself
# application-default login = credentials for client libraries (Python google-cloud-*, Go, Java)
# Your pipeline code calls BigQuery via the Python SDK, which reads ADC
# If you only run gcloud auth login, your pipeline still gets "permission denied"
```

**Service account authentication (for production and CI/CD):**

```bash
# Service account authentication (for production VMs and containers)
gcloud auth activate-service-account --key-file=key.json
# Authenticates as a service account using a JSON key file
# Use for: CI/CD pipelines, automated scripts, non-interactive environments
# In production: prefer Workload Identity (no key files) over key files
```

For creating and managing the service accounts referenced here, see [[service-accounts-and-iam]]. In GitHub Actions, [[github-actions-workflows|Workload Identity Federation]] eliminates key files entirely for CI/CD authentication.

**View and manage credentials:**

```bash
# View current identity
gcloud auth list
# Shows all authenticated accounts and which one is active (marked with *)

# Print access token (for debugging API calls directly)
gcloud auth print-access-token
# Use case: testing API calls with curl
# curl -H "Authorization: Bearer $(gcloud auth print-access-token)" https://bigquery.googleapis.com/...

# Revoke credentials (security: when leaving a project or shared machine)
gcloud auth revoke
# Removes stored credentials for the active account
```

## The ADC Credential Search Order

> [!info] The ADC Search Order
> When your Python code does `google.auth.default()` (covered in [[17_py_gcp]]), it searches for credentials in this exact order:
> 1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to a JSON key file)
> 2. Application Default Credentials from `gcloud auth application-default login`
> 3. GCE metadata server (automatic on VMs and Cloud Run — no setup needed)
> 4. GKE Workload Identity (automatic in Kubernetes pods)
>
> **On GCE VMs and Cloud Run, you never need key files.** The metadata server provides credentials automatically. Key files are only for local development and non-GCP environments. Every key file is a security liability — they don't expire, can be leaked in git repos, and grant permanent access.

> [!tip] Best Practice
> Use `GOOGLE_APPLICATION_CREDENTIALS` locally for development, and rely on the metadata server in production. Never commit key files to source control.

## Gotchas and Edge Cases

- `gcloud auth login` and `gcloud auth application-default login` are **different credentials** for different purposes. You often need both for local development.
- Service account key files (`key.json`) do not expire. If leaked, attackers have permanent access until the key is explicitly deleted. See [[service-accounts-and-iam]] for key rotation.
- On [[vm-lifecycle|Compute Engine VMs]] and [[cloud-run-jobs-vs-services|Cloud Run]], the metadata server provides credentials automatically — no key files needed.

## Related

- [[gcloud-configurations]] — Manage multiple project contexts
- [[service-accounts-and-iam]] — Create and manage service accounts, IAM bindings and roles
- [[gcp-projects-and-apis]] — Set the active project for authentication context

For a comprehensive gcloud command reference, see [[gcloud-cheat-sheet]].

## References

- [gcloud auth documentation](https://cloud.google.com/sdk/gcloud/reference/auth)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
