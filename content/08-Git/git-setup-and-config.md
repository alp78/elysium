---
type: concept
category: git
technology: [git, github]
tags: [git, github]
aliases:
  - git config
  - git init
  - git clone
  - git setup
  - git configuration
  - initialize git
  - clone repository
  - git identity
  - git global config
  - what is git
keywords:
  - git config
  - git init
  - git clone
  - repository
  - version control
  - distributed version control
  - git setup
  - user.name
  - user.email
  - init.defaultBranch
  - shallow clone
  - depth
  - staging area
  - HEAD
  - remote
  - commit
  - branch
  - fork
  - pull request
  - SHA hash
  - gitconfig
description: "Core Git concepts glossary, initial identity and global configuration commands, and repository creation and cloning variants including shallow clone for CI/CD."
related:
  - "[[git-daily-workflow]]"
  - "[[git-branching-and-merging]]"
  - "[[gitignore-patterns]]"
  - "[[github-actions-ci-cd]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Setup and Configuration

Git is a distributed version control system. It tracks every change to every file in your project, lets multiple people work on the same codebase simultaneously, and provides tools to merge everyone's work together. This note covers the essential vocabulary, the initial setup every new machine requires, and the commands for creating and cloning repositories.

---

## What is Git? Core Concepts Glossary

Understanding Git's terminology is the foundation for everything else. These terms appear throughout all Git documentation and team communication.

### Git Repository (repo)
A folder tracked by Git. Contains your files plus a hidden `.git` directory that stores the entire history.

*In plain English:* Think of it as a project folder with a complete memory of every change ever made.

### Git Commit
A snapshot of all tracked files at a point in time, identified by a unique SHA hash (e.g., `cd97a43`).

*In plain English:* A save point in a video game. You can always go back to any previous save.

### Git Branch
A movable pointer to a commit. Branches let you work on features without affecting the main code.

*In plain English:* A parallel universe where you can experiment freely. If it works, you merge it back into reality.

See [[git-branching-and-merging]] for full branch management commands.

### Git Remote
A copy of the repository on a server (e.g., GitHub). Named `origin` by default.

*In plain English:* The shared copy on GitHub that everyone syncs with. Your source of truth.

### Git Staging Area (index)
A buffer between your working directory and the next commit. You choose which changes to include.

*In plain English:* A staging table before loading to production. You pick exactly what goes in.

### Git HEAD
A pointer to the current commit you're looking at. Usually points to the tip of your current branch.

*In plain English:* Your "you are here" marker on the timeline.

### Git Working Directory
The actual files on your disk that you edit.

*In plain English:* What you see in your file explorer / VS Code.

### Git Clone
A complete copy of a remote repository, including all history.

*In plain English:* Downloading the entire project with its full memory.

### Git Fork
A personal copy of someone else's repository on GitHub.

*In plain English:* Making your own copy of someone else's project to experiment with.

### Git Pull Request (PR)
A request to merge your branch into another branch, with a review interface.

*In plain English:* Raising your hand and saying "I've finished this work, please review and merge it."

See [[pull-requests-and-code-review]] for the full PR workflow.

### Git SHA / Hash
A 40-character hexadecimal string (often abbreviated to 7 chars) that uniquely identifies a commit.

*In plain English:* A fingerprint for a commit. No two commits have the same one.

---

## Initial Setup and Configuration

These commands configure your Git identity and global preferences. Run them once on each new machine before making your first commit.

### Identity (required before your first commit)

#### git config --global user.name — set author name for all commits

```bash
git config --global user.name "Your Name"
```

- `git` — the Git version control CLI
- `config` — read or write Git configuration
- `--global` — apply to all repos on this machine (stored in `~/.gitconfig`)
- `user.name` — the config key for author name
- `"Your Name"` — your display name for commits

*In plain English:* Tell Git who you are so your teammates know who made each change.

#### git config --global user.email — set author email

```bash
git config --global user.email "your.email@company.com"
```

- `user.email` — must match your GitHub account email for contributions to be linked

*In plain English:* Use the same email as your GitHub account.

> [!warning] Email Must Match GitHub
>
> Email Must Match GitHub Account.
> If your `user.email` does not match the email associated with your GitHub account, your commits will not be linked to your GitHub profile and will not count toward your contribution graph.

### Useful Global Settings

#### git config --global init.defaultBranch main — set default branch name

```bash
git config --global init.defaultBranch main
```

- `init.defaultBranch` — the branch name used when creating new repos

*In plain English:* New repos will start with a branch called `main`.

#### git config core.autocrlf — fix line-ending differences across OS

```bash
git config --global core.autocrlf true
```

- `core.autocrlf` — on Windows: converts LF to CRLF on checkout, CRLF to LF on commit

*In plain English:* Stops Windows/Mac/Linux line-ending differences from polluting your diffs.

> [!tip] Linux and macOS Users
>
> On Linux or macOS, use `core.autocrlf input` instead of `true`. This converts CRLF to LF on commit but does not convert on checkout, keeping your files with Unix line endings.

#### git config pull.rebase false — set merge as default pull strategy

```bash
git config --global pull.rebase false
```

- `pull.rebase false` — when pulling, merge by default (not rebase)

*In plain English:* When syncing with the team, merge their changes into yours (don't rewrite your history).

#### git config --list --show-origin — view all current configuration

```bash
git config --list
```

- `--list` — display all configuration values from all scopes (system, global, local)

*In plain English:* Check what Git is configured to do.

### Credential Caching

> [!tip] Avoid Re-entering Your Password
>
> Run `git config --global credential.helper store` to avoid re-entering your password. On Windows, use `manager-core` for the Windows Credential Manager.

```bash
# All platforms — store credentials to disk (simple, less secure)
git config --global credential.helper store

# Windows — use Windows Credential Manager (recommended on Windows)
git config --global credential.helper manager-core
```

---

## Creating and Cloning Repositories

### Initialize a New Repository

#### git init — initialize a new repository in the current directory

```bash
git init
```

- `init` — create the hidden `.git` folder, start tracking this directory

*In plain English:* Start tracking this folder with Git.

> [!tip] What git init Creates
>
> Running `git init` creates a hidden `.git/` subdirectory containing all of Git's internal data: the object store, refs, config, hooks, and HEAD pointer. Deleting this folder removes all Git history from the project without touching your actual files.

### Clone an Existing Repository

#### git clone — download a complete copy of a remote repository

```bash
git clone https://github.com/org/repo.git
```

- `clone` — download the repo including all branches and full history
- `https://...` — the remote repository URL

*In plain English:* Download the project from GitHub to your computer.

#### git clone URL folder — clone into a specific directory

```bash
git clone https://github.com/org/repo.git my-folder
```

- `my-folder` — custom directory name (instead of the repo name)

*In plain English:* Download the project into a specific folder name.

#### git clone --depth 1 — shallow clone, latest commit only

```bash
git clone --depth 1 https://github.com/org/repo.git
```

- `--depth 1` — download only the latest commit, skip full history

*In plain English:* Quick download without the full history. Good for CI/CD.

> [!tip] Shallow Clones for CI/CD
>
> Shallow Clones in CI/CD Pipelines.
> Shallow clones with `--depth 1` are the standard approach in [[github-actions-ci-cd]] pipelines. Cloning the full history of a large repository adds unnecessary time to every pipeline run. GitHub Actions uses `actions/checkout` with `fetch-depth: 1` by default for this reason.

> [!warning] Shallow Clone Limitations
>
> A shallow clone cannot be used as the basis for a `git push` to the original remote without first unshallowing (`git fetch --unshallow`). It also cannot run `git bisect` or other commands that require full history traversal.

---

## Pre-Commit Hooks — Automated Quality Gates

### pre-commit Framework — run checks before every commit

> [!info] What Pre-Commit Hooks Do
>
> Git hooks are scripts that run automatically at specific points in the Git workflow. Pre-commit hooks run BEFORE the commit is created — if they fail, the commit is aborted. This catches secrets, lint errors, and formatting issues before they reach the repo.

```bash
# Install the pre-commit framework
pip install pre-commit
```

Create `.pre-commit-config.yaml` in the repo root:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.88.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
```

```bash
# Install hooks into .git/hooks/
pre-commit install

# Run against all files (first time or CI)
pre-commit run --all-files

# Run a specific hook
pre-commit run gitleaks --all-files
```

> [!tip] Hooks for Data Engineering Teams
>
> - **gitleaks** — blocks commits containing API keys, passwords, GCP key files
> - **ruff** — Python linting and formatting (replaces flake8 + black + isort)
> - **terraform_fmt** — enforces consistent Terraform formatting
> - **sqlfluff** — SQL linting (add via `repo: https://github.com/sqlfluff/sqlfluff`)

> [!warning] Hooks Run Locally Only
>
> Pre-commit hooks run on each developer's machine. They can be bypassed with `git commit --no-verify`. For mandatory enforcement, run the same checks in GitHub Actions CI — hooks are the fast first line of defense, CI is the mandatory second line.

---

## Related

- [[git-daily-workflow]] — status, add, commit, push, pull commands for everyday work
- [[git-branching-and-merging]] — creating, switching, merging, and deleting branches
- [[gitignore-patterns]] — excluding files from Git tracking and Git LFS for large files
- [[github-actions-ci-cd]] — CI/CD pipelines that use `git clone` and repository operations
- [[pull-requests-and-code-review]] — the PR workflow built on top of branches and remotes

## References

- [Git Official Documentation — git-config](https://git-scm.com/docs/git-config)
- [Git Official Documentation — git-init](https://git-scm.com/docs/git-init)
- [Git Official Documentation — git-clone](https://git-scm.com/docs/git-clone)
- [Pro Git Book — Getting Started: First-Time Git Setup](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)
