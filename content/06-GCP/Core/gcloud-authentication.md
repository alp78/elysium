---
type: concept
category: gcp
technology: [gcp, gcloud]
tags: [infrastructure, gcp, gcloud]
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

### How GCP Authentication Works

There are three authentication flows: interactive login for humans, Application Default Credentials for code/SDKs, and service account activation for CI/CD and production environments. The gcloud CLI commands are identical on Linux and Windows.

## Authentication Commands

#### gcloud auth login — interactive authentication for human users

Opens a browser for Google account login. The OAuth token is stored in `~/.config/gcloud/` and refreshed automatically. Use for interactive work (debugging, ad-hoc queries, infrastructure changes).

```bash
gcloud auth login
```

#### gcloud auth application-default login — ADC for application code

> [!warning] ADC is different from `gcloud auth login`
> - `gcloud auth login` = credentials for the **gcloud CLI** itself
> - `application-default login` = credentials for **client libraries** (Python `google-cloud-*`, Go, Java)
> - Your pipeline code calls BigQuery via the Python SDK, which reads ADC
> - If you only run `gcloud auth login`, your pipeline still gets "permission denied"

```bash
gcloud auth application-default login
```

#### gcloud auth activate-service-account — SA key for production and CI/CD

Authenticates as a service account using a JSON key file. Use for CI/CD pipelines, automated scripts, and non-interactive environments. In production, prefer Workload Identity (no key files) over key files.

```bash
gcloud auth activate-service-account --key-file=key.json
```

For creating and managing the service accounts referenced here, see [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam). In GitHub Actions, [Workload Identity Federation](/10-GitHub-Actions/github-actions-workflows) eliminates key files entirely for CI/CD authentication.

#### gcloud auth list, revoke, print-access-token — view and manage credentials

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

### The ADC Credential Search Order

> [!info] The ADC Search Order
>
> When your Python code does `google.auth.default()` (covered in [17_py_gcp](/02-Programming-Languages/Python/17_py_gcp)), it searches for credentials in this exact order:
> 1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to a JSON key file)
> 2. Application Default Credentials from `gcloud auth application-default login`
> 3. GCE metadata server (automatic on VMs and Cloud Run — no setup needed)
> 4. GKE Workload Identity (automatic in Kubernetes pods)
>
> **On GCE VMs and Cloud Run, you never need key files.** The metadata server provides credentials automatically. Key files are only for local development and non-GCP environments. Every key file is a security liability — they don't expire, can be leaked in git repos, and grant permanent access.

> [!tip] Best Practice
>
> Use `GOOGLE_APPLICATION_CREDENTIALS` locally for development, and rely on the metadata server in production. Never commit key files to source control.

> [!danger] SA Key Files Never Expire
>
> Service Account Key Files Are Permanent Credentials.
> Unlike OAuth tokens, SA key files never expire. A leaked key file in a git repo, a Docker image layer, or a log file grants permanent access until the key is explicitly revoked in the GCP console. Attackers actively scan public repos for GCP key patterns. If you suspect a key was leaked, immediately delete the key in IAM, then rotate all secrets the SA had access to. See [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam) for key rotation procedures.

### GCP Authentication Gotchas and Edge Cases

> [!warning] ADC Token Caching Issues
>
> ADC Token Caching Can Cause Stale Permissions.
> `gcloud auth application-default login` caches the token in `~/.config/gcloud/application_default_credentials.json`. If your IAM roles change after login, the cached token still carries the old scopes until it refreshes (up to 1 hour). Force a refresh with `gcloud auth application-default login` again. This is a frequent source of "works on my machine but fails in CI" issues.

- `gcloud auth login` and `gcloud auth application-default login` are **different credentials** for different purposes. You often need both for local development.
- Service account key files (`key.json`) do not expire. If leaked, attackers have permanent access until the key is explicitly deleted. See [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam) for key rotation.
- On [Compute Engine VMs](/06-GCP/Compute/vm-lifecycle) and [Cloud Run](/06-GCP/Serverless/cloud-run-jobs-vs-services), the metadata server provides credentials automatically — no key files needed.

## Related

- [gcp-identity-and-connection-patterns](/06-GCP/Security/gcp-identity-and-connection-patterns) — Complete identity model, OAuth2 flows, credential types, and connection patterns
- [gcloud-configurations](/06-GCP/Core/gcloud-configurations) — Manage multiple project contexts
- [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam) — Create and manage service accounts, IAM bindings and roles
- [gcp-projects-and-apis](/06-GCP/Core/gcp-projects-and-apis) — Set the active project for authentication context

For a comprehensive gcloud command reference, see [gcloud-cheat-sheet](/06-GCP/gcloud-cheat-sheet).

## References

- [gcloud auth documentation](https://cloud.google.com/sdk/gcloud/reference/auth)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
