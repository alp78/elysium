---
title: "07 - .gitignore Patterns"
tags:
  - git
  - github
  - gitignore
  - security
aliases: [.gitignore, gitignore, git ignore, exclude files, git rm --cached]
description: "How to use .gitignore to exclude files from version control, patterns for Python data engineering projects, how to stop tracking already-committed files, and what to do if secrets were accidentally committed."
created: 2026-03-22
updated: 2026-04-05
status: complete
---

# .gitignore Patterns

> [!quote]
> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."
>
> — **Antoine de Saint-Exupery**, *Terre des hommes* (1939)

The `.gitignore` file tells Git which files to never track. Critical for keeping secrets, build artifacts, and large files out of your repo. Once a file is committed, `.gitignore` alone does not remove it from history — you must also stop tracking it.

## .gitignore Basics

Place `.gitignore` at the repo root (or in subdirectories for scoped rules) and commit it so all collaborators share the same ignore configuration.

### Example .gitignore for a Python Data Engineering Project

A minimal `.gitignore` covering Python environments, data files, IDE directories, and Terraform secrets.

```gitignore
.env
*.pyc
__pycache__/
data/
*.log
venv/
.venv/
.idea/
.vscode/
node_modules/
terraform.tfvars
*.tfstate
*.tfstate.backup
.terraform/
service-account-key.json
*.json.key
```

Each line is a pattern. Git will ignore matching files.

### Pattern Syntax

The glob-style pattern syntax used in `.gitignore` is shared with shell expansion. For a deeper look at how `*`, `**`, and `?` work, see [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing).

| Pattern | Matches |
|---------|---------|
| `.env` | A file named exactly `.env` anywhere in the repo |
| `*.pyc` | All `.pyc` files anywhere in the repo |
| `__pycache__/` | Any directory named `__pycache__` |
| `data/` | The `data` directory at repo root |
| `!data/sample.csv` | Exception — track this one file even though `data/` is ignored |
| `*.log` | All log files |
| `secrets/**` | Everything inside a `secrets/` directory |
| `/terraform.tfvars` | Only `terraform.tfvars` at the repo root (not in subdirs) |

> [!warning] Negation patterns are order-sensitive
>
> A `!` pattern (e.g., `!data/sample.csv`) only works if a preceding line ignores the parent. If the parent directory itself is ignored with a trailing slash (`data/`), Git never looks inside it, and the negation has no effect. To negate a file inside an ignored directory, ignore the contents with `data/*` (no trailing slash) instead, then negate the specific file.

> [!success] Ignore Contents, Not the Directory, to Allow Exceptions
>
> Replace `data/` with `data/*` in your `.gitignore`, then add `!data/sample.csv` on the next line. Git will enter the directory to apply the exception, and only the specific file will be tracked.

> [!tip] Use a Language-Specific Template
>
> GitHub maintains a curated collection of `.gitignore` templates for dozens of languages and frameworks at [github/gitignore](https://github.com/github/gitignore). When creating a repository on GitHub, you can also select a template from the UI.

## Stop Tracking Committed Files

Once a file is committed, adding it to `.gitignore` has no effect on that file — Git continues to track it. Use `git rm --cached` to remove it from the index without deleting it from disk, then commit the updated `.gitignore`.

### git rm --cached — untrack a committed file

`git rm --cached` removes a file from Git's staging area (index) while leaving it on the filesystem. After running this command and committing, Git treats the file as untracked going forward.

#### Untrack a single file

```bash
git rm --cached .env
```

```text
rm '.env'
```

Stage `.gitignore` and commit the removal:

```bash
git add .gitignore
```

```bash
git commit -m "chore: stop tracking .env, add to .gitignore"
```

```text
[main 4d3e2f1] chore: stop tracking .env, add to .gitignore
 2 files changed, 1 insertion(+), 1 deletion(-)
```

```bash
git push
```

> [!warning] History Is Not Erased
>
> `git rm --cached` removes the file from future commits only. It remains in all previous commits — anyone with repository access can still retrieve it from the history.

> [!success] Scrub History with BFG or filter-repo for Secrets
>
> If the file contained sensitive data, use `git filter-repo --path <file> --invert-paths` or BFG Repo-Cleaner to remove it from all historical commits. Then force-push and require all collaborators to re-clone.

| Flag | Syntax | Description |
|---|---|---|
| `--cached` | `git rm --cached <file>` | Remove from index only; keep file on disk |
| `-r` | `git rm -r --cached <dir>` | Recurse into directories |
| `-f` / `--force` | `git rm -f <file>` | Override the up-to-date check; force removal |
| `-n` / `--dry-run` | `git rm -n <file>` | Show what would be removed without removing |
| `-q` / `--quiet` | `git rm -q <file>` | Suppress output |

## Accidentally Committed Sensitive Files

To stop tracking files that are already in the repository, remove them from Git's index and update `.gitignore` in the same commit.

> [!todo] Remove accidentally committed files
>
> 1. Add the paths to `.gitignore`
> 2. Remove from Git's index with `git rm -r --cached` — files stay on disk
> 3. Stage `.gitignore` and commit
> 4. Push

Append the ignored paths to `.gitignore`:

```bash
echo "docs/logos/" >> .gitignore
echo "*.log" >> .gitignore
```

The `-r` flag recurses into directories; `--cached` removes from the index only, leaving files on disk:

```bash
git rm -r --cached docs/logos/
```

```bash
git add .gitignore
```

```bash
git commit -m "chore: stop tracking logos, add to .gitignore"
```

```bash
git push
```

## If Secrets Were Accidentally Committed

Secrets that have been committed exist in Git history permanently until the history is rewritten. Rotation and history scrubbing are separate steps — both are required.

> [!warning] Rotate First, Then Scrub
>
> If you accidentally committed secrets (API keys, passwords), **rotate them immediately** — before scrubbing the history. Anyone who fetched the repo has already seen them.

> [!success] Rotate in Your Cloud Console Before Any Git Work
>
> Go to GCP IAM, Azure Key Vault, or your secrets manager and revoke the exposed key immediately. Only after the old credential is invalidated should you proceed to clean the Git history with BFG or `git filter-repo`.

Use one of these tools to remove secrets from all history:

### git filter-repo — recommended

`git filter-repo` is the officially recommended replacement for the deprecated `git filter-branch`. It rewrites every commit in the repository's history, removing or modifying files across all branches and tags.

#### Remove a file from all history

```bash
git filter-repo --path path/to/secret.json --invert-paths
```

```bash
git push --force --all
```

### BFG Repo-Cleaner — faster alternative

BFG is a separate Java tool designed for history scrubbing. It is faster than `git filter-repo` on large repositories but requires Java and cannot perform all types of rewrites.

#### Delete files with BFG

Download the BFG jar and run it against the repository:

```bash
java -jar bfg.jar --delete-files secret-file.json
```

Clean up dangling objects:

```bash
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

```bash
git push --force --all
```

### git filter-branch — deprecated

`git filter-branch` is built into Git but deprecated since Git 2.24 in favour of `git filter-repo`. Documented here as a reference for older environments only.

#### Remove a file with filter-branch

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret.json' \
  --prune-empty --tag-name-filter cat -- --all
```

```bash
git push --force --all
```

> [!warning] Force-Push After Rewrite
>
> After using any history rewrite tool, you must force-push all branches. This is destructive — every collaborator must reclone or run `git fetch --all && git reset --hard origin/main`.

> [!success] Notify the Team Before Force-Pushing Rewritten History
>
> Announce the history rewrite in your team channel before force-pushing. Share the instruction for collaborators: `git fetch --all && git reset --hard origin/main` (or re-clone). Any local branch based on the old history must be rebased onto the new commits.

See [git-remote-management](https://alp78.github.io/elysium/08-Git/git-remote-management) for force-push options and safer alternatives.

## Removing Unwanted Contributors (Co-Authored-By)

Git commit messages can include `Co-Authored-By` trailers. GitHub parses these and automatically adds the referenced person to the repository's **Contributors** list.

```
Co-Authored-By: Some Bot <noreply@example.com>
```

If this was added to any commit that was ever pushed to GitHub (even on a deleted branch), GitHub may cache that user as a contributor.

### Step 1: Verify the trailer exists

Search all reachable commits for the unwanted trailer. `--all` searches all branches and tags; `--format="%H %B"` prints the full commit hash and body; `grep -i` is case-insensitive.

```bash
git log --all --format="%H %B" | grep -i "Co-Authored-By"
```

### Step 2: Scrub from history

Use `git filter-repo` or BFG as above. Even after removing the trailer from all commits and force-pushing, the contributor badge may persist — GitHub's contributor cache is sticky.

See [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) for history rewriting procedures.

## Terraform Files — Critical to Gitignore

Terraform state and variable files contain infrastructure secrets (passwords, API keys, service account credentials) and must never be committed.

### Patterns for Terraform projects

Files like `.env` contain [environment-variables](https://alp78.github.io/elysium/01-Shell/Scripting/environment-variables) that configure local development and CI/CD — they should always be gitignored because they often hold secrets or machine-specific paths.

The Terraform variables file containing passwords and API keys must be gitignored. Omit `.terraform.lock.hcl` only if you do not want to commit the dependency lock file (most teams do commit it).

```gitignore
terraform.tfvars
*.tfstate
*.tfstate.backup
.terraform/
.terraform.lock.hcl
```

See [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) for context on what `terraform.tfvars` contains.

## Global .gitignore

A global `.gitignore` (configured via `core.excludesfile`) applies ignore rules across all repositories on your machine without modifying per-repo `.gitignore` files. This is the right place to ignore editor directories, OS artifacts, and credential files.

### git config — set global excludes file

Set the path to your global ignore file. Git will merge its rules with every repository's local `.gitignore`.

#### Set the global excludes path

```bash
git config --global core.excludesfile ~/.gitignore_global
```

#### ~/.gitignore_global — recommended patterns

```gitignore
.DS_Store
Thumbs.db
desktop.ini
.env
*.key
*.pem
*.p12
*.pfx
.idea/
.vscode/
```

### Checking Ignored Files

Use these commands to diagnose which patterns are affecting specific files and to audit what Git considers ignored or tracked.

#### git check-ignore -v — explain why a file is ignored

The `-v` flag (verbose) prints the `.gitignore` file, line number, and matching pattern alongside the file path.

```bash
git check-ignore -v path/to/file
```

```text
.gitignore:3:*.pyc	path/to/file.pyc
```

#### git status --ignored — list all ignored files

```bash
git status --ignored
```

```text
On branch main
nothing to commit, working tree clean

Ignored files:
  (use "git add -f <file>..." to include in what was committed)

	.idea/
	__pycache__/
	data/
```

#### git ls-files — list tracked files

```bash
git ls-files
```

```text
.gitignore
README.md
src/main.py
```

| Flag | Syntax | Description |
|---|---|---|
| `-v` | `git check-ignore -v <path>` | Verbose: show which `.gitignore` rule matches |
| `-n` / `--non-matching` | `git check-ignore -n <path>` | Show non-ignored paths too (use with `-v`) |
| `--stdin` | `git check-ignore --stdin` | Read file paths from standard input |
| `-q` | `git check-ignore -q <path>` | Exit code only: 0 = ignored, 1 = not ignored |
| `--ignored` | `git status --ignored` | Include ignored files in `git status` output |
| `--porcelain` | `git status --porcelain` | Machine-parseable output |

## Git LFS — Large File Storage

> [!info] When to Use Git LFS
>
> Git stores every version of every file in full. A 500 MB Parquet file changed 10 times = 5 GB of repo history. Git LFS replaces large files with lightweight pointers in the repo, storing the actual content on a separate server. Use for binary files, data samples, model artifacts, and any file > 10 MB.

### git lfs track — configure large file tracking

`git lfs track` registers file patterns in `.gitattributes`, instructing Git to manage matching files through LFS rather than storing them directly in the object database. The `.gitattributes` file must itself be committed.

#### Install LFS (once per machine)

```bash
git lfs install
```

#### Track file patterns

Each call to `git lfs track` appends a rule to `.gitattributes`. Commit `.gitattributes` before adding any large files.

```bash
git lfs track "*.parquet"
```

```bash
git lfs track "*.pkl"
```

```bash
git lfs track "*.csv"
```

```bash
git lfs track "data/samples/**"
```

Verify the tracking rules:

```bash
cat .gitattributes
```

#### Commit .gitattributes and push LFS files

LFS tracking only takes effect after `.gitattributes` is committed. Large files can then be added and pushed normally — LFS uploads content to the LFS server automatically.

```bash
git add .gitattributes
```

```bash
git commit -m "chore: configure Git LFS for data files"
```

```bash
git add data/sample.parquet
```

```bash
git commit -m "feat: add sample data for testing"
```

```bash
git push
```

> [!warning] LFS Must Be Set Up Before First Commit
>
> If you commit a large file BEFORE running `git lfs track`, it goes into regular Git history. You must then use `git lfs migrate` to retroactively move it to LFS — which rewrites history and requires a force-push.

> [!success] Migrate Existing Large Files to LFS
>
> Run `git lfs migrate import --include="*.parquet" --everything` to retroactively move large files into LFS across all history. Then force-push with `git push --force --all` and require teammates to re-clone.

| Flag | Syntax | Description |
|---|---|---|
| `--lockable` | `git lfs track --lockable "*.psd"` | Mark pattern as lockable (requires LFS locking) |
| `--not-lockable` | `git lfs track --not-lockable "*.psd"` | Remove lockable attribute |
| `--filename` | `git lfs track --filename <file>` | Match an exact filename rather than a glob |

### Migrating Existing Files to LFS

If large files were committed before configuring LFS, use `git lfs migrate` to retroactively move them into LFS. This rewrites history and requires a force-push.

#### git lfs ls-files — verify LFS-managed files

```bash
git lfs ls-files
```

#### git lfs migrate import — move existing files to LFS

`--include` specifies which patterns to migrate; `--everything` processes all branches and tags:

```bash
git lfs migrate import --include="*.parquet" --everything
```

```bash
git push --force --all
```

> [!tip] GitHub LFS Storage Limits
>
> Free GitHub accounts get 1 GB LFS storage + 1 GB bandwidth/month. Each additional 50 GB data pack costs $5/month. For large datasets, store in GCS and reference by path — Git LFS is for files that must be versioned alongside code (test fixtures, model artifacts), not for production data.

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — the daily workflow that benefits from a clean .gitignore
- [git-remote-management](https://alp78.github.io/elysium/08-Git/git-remote-management) — force-push after history rewrite
- [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) — history rewriting with filter-repo and BFG
- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — CI secrets that must never be committed
- [terraform-variables-and-outputs](https://alp78.github.io/elysium/07-Terraform/Fundamentals/terraform-variables-and-outputs) — terraform.tfvars that must be gitignored

## References

- [gitignore documentation](https://git-scm.com/docs/gitignore)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
