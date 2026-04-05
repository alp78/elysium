---
tags: [git, github, setup, config]
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
description: "Core Git concepts glossary, initial identity and global configuration commands, and repository creation and cloning variants including shallow clone for CI/CD."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Setup and Configuration

> [!quote]
> "Git proved I could be more than a one-hit wonder."
>
> — **Linus Torvalds**, TED interview (2016)

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

See [git-branching-and-merging](https://alp78.github.io/elysium/08-Git/git-branching-and-merging) for full branch management commands.

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

See [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) for the full PR workflow.

### Git SHA / Hash
A 40-character hexadecimal string (often abbreviated to 7 chars) that uniquely identifies a commit.

*In plain English:* A fingerprint for a commit. No two commits have the same one.

---

## Initial Setup and Configuration

These commands configure your Git identity and global preferences. Run them once on each new machine before making your first commit.

### Identity (required before your first commit)

Set your name and email before making your first commit. Git embeds these values in every commit object — they identify you in `git log` output and link your contributions to your GitHub profile. These settings are stored in `~/.gitconfig` and apply across all repositories on the machine.

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

> [!success] Set the Correct Email from GitHub Settings
>
> Go to GitHub → Settings → Emails to find your verified email address. Use that exact value: `git config --global user.email "your.verified@email.com"`. If you use a privacy noreply address, use that instead.

### Useful Global Settings

These settings are optional but strongly recommended when configuring a new machine. They control default branch naming, line-ending normalization, editor selection, command aliases, and default pull behavior. All use `--global` scope and are written to `~/.gitconfig`.

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

#### git config --global core.editor — set the default text editor

Git opens a text editor when you write commit messages, perform interactive rebases, or edit config files. Without this setting it falls back to the system default (`vi` on Linux/macOS, Notepad on Windows), which surprises many developers.

```bash
git config --global core.editor "code --wait"
```

- `core.editor` — the editor command Git spawns; `--wait` tells VS Code to block until you close the tab

*In plain English:* Write commit messages in VS Code instead of vi. Replace `"code --wait"` with `"nano"`, `"vim"`, or `"notepad"` for other editors.

#### git config --global alias.* — create command shortcuts

Git aliases let you define short names for long or frequently used commands. They are stored under `[alias]` in `~/.gitconfig` and invoked as `git <alias>`.

```bash
git config --global alias.st status
```

```bash
git config --global alias.lg "log --oneline --graph --all --decorate"
```

```bash
git config --global alias.undo "reset --soft HEAD~1"
```

*In plain English:* `git st` runs `git status`, `git lg` shows a compact graph of all branches, and `git undo` moves the last commit back to staged without discarding changes.

#### git config --list — display all configuration values

`git config --list` prints every key-value pair Git knows, merging system, global, and local scopes. Where the same key appears in multiple scopes, the most specific scope wins (local overrides global overrides system).

```bash
git config --list
```

```text
core.autocrlf=true
init.defaultbranch=main
core.editor=code --wait
user.name=Your Name
user.email=your.email@company.com
pull.rebase=false
alias.st=status
alias.lg=log --oneline --graph --all --decorate
```

#### git config --list --show-origin — show which file each setting comes from

Adding `--show-origin` prepends the config file path where each value is defined. Useful for diagnosing unexpected settings — for example, a system-level config silently overriding your global one.

```bash
git config --list --show-origin
```

```text
file:C:/Program Files/Git/etc/gitconfig    core.autocrlf=true
file:C:/Users/you/.gitconfig               user.name=Your Name
file:C:/Users/you/.gitconfig               user.email=your.email@company.com
file:.git/config                           core.repositoryformatversion=0
```

### Credential Caching

By default Git prompts for your HTTPS password on every remote operation. Setting a credential helper eliminates this. The right choice depends on your OS. An alternative to HTTPS credentials entirely is SSH key authentication — see [git-remote-management](https://alp78.github.io/elysium/08-Git/git-remote-management) for SSH key setup.

#### git config credential.helper store — save credentials to a file

Stores your username and password in a plaintext file at `~/.git-credentials`. Simple to configure but anyone with read access to your home directory can read the credentials.

```bash
git config --global credential.helper store
```

> [!warning] credential.helper store is plaintext
>
> `credential.helper store` saves passwords in `~/.git-credentials`. Anyone with access to your home directory can read them. Prefer the OS keychain helper below on any shared or managed machine.

> [!success] Use the OS Credential Manager
>
> On Windows: `git config --global credential.helper manager-core`. On macOS: `git config --global credential.helper osxkeychain`. Both store credentials in the OS secure keychain — no plaintext file.

#### git config credential.helper manager-core — use the OS keychain (recommended)

Stores credentials in the OS secure keychain. On Windows this is Windows Credential Manager; on macOS it is the system Keychain. No plaintext file is written, and credentials survive reboots and shell restarts.

```bash
git config --global credential.helper manager-core
```

| Flag / Key | Syntax | Description |
|---|---|---|
| `--global` | `git config --global <key> <value>` | Write to `~/.gitconfig` — applies to all repos for the current user |
| `--local` | `git config --local <key> <value>` | Write to `.git/config` — applies to the current repo only (default scope) |
| `--system` | `git config --system <key> <value>` | Write to the system-wide config (requires admin); lowest precedence |
| `--list` | `git config --list` | Print all resolved key-value pairs across all scopes |
| `--show-origin` | `git config --list --show-origin` | Show the config file path for each key |
| `--get <key>` | `git config --get user.email` | Print the resolved value of a single key |
| `--unset <key>` | `git config --unset <key>` | Remove a key from the targeted scope |
| `--edit` | `git config --global --edit` | Open the config file in the configured editor |

---

## Creating and Cloning Repositories

Use `git init` to start a new repository from scratch, or `git clone` to download an existing one from a remote. These are the two entry points into any Git workflow.

### Initialize a New Repository

`git init` turns any directory into a Git repository by creating the hidden `.git/` subdirectory. Use this when starting a brand-new project locally. If the project already exists on a remote (GitHub, GitLab), use `git clone` instead.

#### git init — initialize a new repository in the current directory

Running `git init` creates `.git/` with the object store, refs, config, hooks, and the HEAD pointer. The directory itself is untouched — no files are staged or committed yet.

```bash
git init
```

```text
Initialized empty Git repository in /path/to/project/.git/
```

> [!tip] What git init Creates
>
> The `.git/` subdirectory holds all of Git's internal data. Deleting it removes all history from the project without touching your actual files. The working directory is preserved.

| Flag | Syntax | Description |
|---|---|---|
| `-b <name>` / `--initial-branch <name>` | `git init -b main` | Set the name of the first branch (overrides `init.defaultBranch`) |
| `--bare` | `git init --bare` | Create a repository with no working tree — used for server/remote repos |
| `--template <dir>` | `git init --template /path` | Populate `.git/` from a custom template directory |
| `--shared[=<perms>]` | `git init --shared=group` | Set group-write permissions for shared server repositories |

### Clone an Existing Repository

`git clone` downloads a repository from a remote URL to your local machine, including all branches, tags, and the full commit history. The remote is automatically registered as `origin`. For performance-sensitive workflows (CI/CD, large monorepos), use shallow or branch-limited clones.

#### git clone — download a complete copy of a remote repository

Clones all branches and the full history into a new directory named after the repository.

```bash
git clone https://github.com/org/repo.git
```

```text
Cloning into 'repo'...
remote: Enumerating objects: 1024, done.
remote: Counting objects: 100% (1024/1024), done.
remote: Compressing objects: 100% (512/512), done.
Receiving objects: 100% (1024/1024), 2.40 MiB | 8.12 MiB/s, done.
Resolving deltas: 100% (380/380), done.
```

#### git clone URL folder — clone into a specific directory

Clones the repository into `my-folder` instead of the default directory name derived from the URL.

```bash
git clone https://github.com/org/repo.git my-folder
```

#### git clone --branch — clone and check out a specific branch

Clones the full repository but checks out the specified branch immediately. Combine with `--single-branch` to avoid fetching all other remote branches, reducing download size.

```bash
git clone --branch develop https://github.com/org/repo.git
```

```bash
git clone --branch develop --single-branch https://github.com/org/repo.git
```

#### git clone --depth 1 — shallow clone, latest commit only

Downloads only the most recent commit rather than the full history. Dramatically reduces clone time and disk usage for large repositories.

```bash
git clone --depth 1 https://github.com/org/repo.git
```

> [!tip] Shallow Clones for CI/CD
>
> Shallow clones with `--depth 1` are the standard approach in [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) pipelines. Cloning the full history of a large repository adds unnecessary time to every pipeline run. GitHub Actions uses `actions/checkout` with `fetch-depth: 1` by default for this reason.

> [!warning] Shallow Clone Limitations
>
> A shallow clone cannot `git push` to the original remote without first unshallowing. It also cannot run `git bisect` or other commands that require full history traversal.

> [!success] Unshallow When Full History Is Needed
>
> Run `git fetch --unshallow` to convert a shallow clone into a full clone. After that, all Git history commands (`git bisect`, `git log --all`, `git push`) work normally.

| Flag | Syntax | Description |
|---|---|---|
| `--depth <n>` | `git clone --depth 1 <url>` | Shallow clone: fetch only the last N commits |
| `-b` / `--branch <name>` | `git clone -b develop <url>` | Check out the specified branch after cloning |
| `--single-branch` | `git clone --single-branch -b main <url>` | Fetch only the specified branch; omit all other remote refs |
| `--bare` | `git clone --bare <url>` | Clone without a working tree (for server/mirror repos) |
| `--mirror` | `git clone --mirror <url>` | Clone all refs including remote tracking; implies `--bare` |
| `--recurse-submodules` | `git clone --recurse-submodules <url>` | Automatically initialize and clone all submodules |
| `--shallow-submodules` | `git clone --shallow-submodules <url>` | Shallow-clone each submodule to depth 1 |

---

## Pre-Commit Hooks — Automated Quality Gates

Git hooks are scripts that execute automatically at lifecycle events — before a commit, before a push, after a merge, etc. The `pre-commit` framework makes hook management declarative and shareable across the team via a versioned YAML configuration file.

### pre-commit Framework — run checks before every commit

The `pre-commit` framework manages Git hook scripts that run automatically before each commit is created. If any hook fails, the commit is aborted. This catches secrets, lint errors, and formatting issues at the developer's machine before they reach the repository.

> [!abstract] What Pre-Commit Hooks Do
>
> Git hooks are scripts that run automatically at specific points in the Git workflow. Pre-commit hooks run BEFORE the commit is created — if they fail, the commit is aborted. This catches secrets, lint errors, and formatting issues before they reach the repo.

#### pip install pre-commit — install the framework

Install the `pre-commit` Python package into your active environment. This makes the `pre-commit` CLI available for configuring and running hooks.

```bash
pip install pre-commit
```

#### .pre-commit-config.yaml — define which hooks to run

Create this file in the repository root. Each entry under `repos` points to a hook repository and specifies which hook IDs to enable. Pin the `rev` to a stable tag to ensure reproducible behaviour across the team.

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

> [!tip] Hooks for Data Engineering Teams
>
> - **gitleaks** — blocks commits containing API keys, passwords, GCP key files
> - **ruff** — Python linting and formatting (replaces flake8 + black + isort)
> - **terraform_fmt** — enforces consistent Terraform formatting
> - **sqlfluff** — SQL linting (add via `repo: https://github.com/sqlfluff/sqlfluff`)

#### pre-commit install — register hooks in the local repository

Writes the hook scripts into `.git/hooks/`. After this, the configured checks run automatically before every `git commit` in this repository. Must be run once per clone.

```bash
pre-commit install
```

```text
pre-commit installed at .git/hooks/pre-commit
```

#### pre-commit run --all-files — run all hooks against every file

Runs the full hook suite against every file in the repository, not just staged changes. Use this on first setup to validate the entire codebase, or in CI pipelines where there is no staged diff.

```bash
pre-commit run --all-files
```

#### pre-commit run \<hook\> --all-files — run a single hook by name

Targets one specific hook ID, bypassing the rest of the suite. Useful for debugging a failing check or testing a newly added hook in isolation.

```bash
pre-commit run gitleaks --all-files
```

> [!warning] Hooks Run Locally Only
>
> Pre-commit hooks run on each developer's machine and can be bypassed with `git commit --no-verify`. For mandatory enforcement, run the same checks in GitHub Actions CI — hooks are the fast first line of defense, CI is the mandatory second line.

> [!success] Mirror Hook Checks in CI
>
> Add the same `pre-commit run --all-files` step to your GitHub Actions workflow. This ensures secrets scanning, linting, and format checks are enforced even if a developer bypasses local hooks with `--no-verify`.

| Flag | Syntax | Description |
|---|---|---|
| `--all-files` | `pre-commit run --all-files` | Run hooks against all repository files (not just staged) |
| `--files <path>` | `pre-commit run --files src/foo.py` | Run hooks against specific files only |
| `--hook-stage <stage>` | `pre-commit run --hook-stage push` | Target a specific stage (`commit`, `push`, `merge-commit`) |
| `--verbose` | `pre-commit run --verbose` | Show full hook output even for passing checks |
| `--show-diff-on-failure` | `pre-commit run --show-diff-on-failure` | Display the diff of auto-fixed files when a hook fails |

---

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — status, add, commit, push, pull commands for everyday work
- [git-branching-and-merging](https://alp78.github.io/elysium/08-Git/git-branching-and-merging) — creating, switching, merging, and deleting branches
- [git-remote-management](https://alp78.github.io/elysium/08-Git/git-remote-management) — adding remotes, SSH key authentication, push/pull/fetch
- [gitignore-patterns](https://alp78.github.io/elysium/08-Git/gitignore-patterns) — excluding files from Git tracking and Git LFS for large files
- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — CI/CD pipelines that use `git clone` and repository operations
- [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) — the PR workflow built on top of branches and remotes

## References

- [Git Official Documentation — git-config](https://git-scm.com/docs/git-config)
- [Git Official Documentation — git-init](https://git-scm.com/docs/git-init)
- [Git Official Documentation — git-clone](https://git-scm.com/docs/git-clone)
- [Pro Git Book — Getting Started: First-Time Git Setup](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)
