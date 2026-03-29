---
type: reference
category: git
technology: [git]
tags: [git, github]
aliases: [.gitignore, gitignore, git ignore, exclude files, git rm --cached]
keywords: [.gitignore, gitignore, patterns, exclude, secrets, .env, credentials, pyc, pycache, venv, node_modules, git rm --cached, BFG, filter-branch, stop tracking, git secrets, accidentally committed]
description: "How to use .gitignore to exclude files from version control, patterns for Python data engineering projects, how to stop tracking already-committed files, and what to do if secrets were accidentally committed."
related:
  - "[[git-daily-workflow]]"
  - "[[github-actions-ci-cd]]"
  - "[[pull-requests-and-code-review]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# .gitignore Patterns

The `.gitignore` file tells Git which files to never track. Critical for keeping secrets, build artifacts, and large files out of your repo. Once a file is committed, `.gitignore` alone does not remove it from history — you must also stop tracking it.

### Example .gitignore for a Python Data Engineering Project

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

The glob-style pattern syntax used in `.gitignore` is shared with shell expansion. For a deeper look at how `*`, `**`, and `?` work, see [[brace-expansion-and-globbing]].

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

---

### Stop Tracking a File That's Already Committed

Adding a file to `.gitignore` only prevents **new** files from being tracked. Files already committed are still tracked even after adding them to `.gitignore`.

```bash
# Stop tracking a file but keep it on disk
git rm --cached .env
# rm — remove from Git tracking
# --cached — only remove from the index (staging area), keep the file on disk
# .env — the file to stop tracking
# In plain English: Stop tracking this file (but don't delete it from my computer). Use after adding it to .gitignore.
```

Then commit the removal:

```bash
git add .gitignore
git commit -m "chore: stop tracking .env, add to .gitignore"
git push
```

> [!warning] History Is Not Erased
>
> This Does NOT Erase History.
> `git rm --cached` removes the file from future commits. It remains in previous commits. If the file contained secrets, anyone with repository access can still see them in the history.

---

## Accidentally Committed Sensitive Files

### Step 1: Add the paths to .gitignore

```bash
echo "docs/logos/" >> .gitignore
echo "*.log" >> .gitignore
```

### Step 2: Remove the files from Git's index (but keep them on disk)

```bash
git rm -r --cached docs/logos/
# rm — remove from Git
# -r — recursive (for directories)
# --cached — only remove from the index (staging area), not from your filesystem
```

### Step 3: Commit and push

```bash
git add .gitignore
git commit -m "chore: stop tracking logos, add to .gitignore"
git push
```

---

## If Secrets Were Accidentally Committed

> [!warning] Rotate First, Then Scrub
>
> If you accidentally committed secrets (API keys, passwords), **rotate them immediately** — before scrubbing the history. Anyone who fetched the repo has already seen them.

Then use one of these tools to remove them from ALL history:

#### BFG Repo-Cleaner (simpler, faster)

```bash
# Download BFG
java -jar bfg.jar --delete-files secret-file.json

# Clean up and push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force --all
```

#### git filter-branch (built-in but slower)

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret.json' \
  --prune-empty --tag-name-filter cat -- --all

git push --force --all
```

> [!warning] Force-Push After Rewrite
>
> Force-Push After History Rewrite.
> After using BFG or `filter-branch`, you must force-push all branches. This is destructive — every collaborator must reclone or run `git fetch --all && git reset --hard origin/main`.

---

## Removing Unwanted Contributors (Co-Authored-By)

Git commit messages can include `Co-Authored-By` trailers. GitHub parses these and automatically adds the referenced person to the repository's **Contributors** list.

```
Co-Authored-By: Some Bot <noreply@example.com>
```

If this was added to any commit that was ever pushed to GitHub (even on a deleted branch), GitHub may cache that user as a contributor.

### Step 1: Verify the trailer exists

Search all reachable commits for the unwanted trailer:

```bash
git log --all --format="%H %B" | grep -i "Co-Authored-By"
# --all — search all branches and tags, not just the current branch
# --format="%H %B" — print the full commit hash and full commit body
# grep -i "Co-Authored-By" — case-insensitive search for the trailer
```

### Step 2: Scrub from history

Use BFG or `filter-branch` as above. Even after removing the trailer from all commits and force-pushing, the contributor badge may persist — GitHub's contributor cache is sticky.

---

### terraform.tfvars — Critical to Gitignore

Files like `.env` contain [[environment-variables]] that configure local development and CI/CD -- they should always be gitignored because they often hold secrets or machine-specific paths.

The Terraform variables file containing passwords and API keys must be gitignored:

```
# In infra/.gitignore or root .gitignore
terraform.tfvars
*.tfstate
*.tfstate.backup
.terraform/
.terraform.lock.hcl  # only if you don't want to commit the lock file
```

See [[terraform-variables-and-outputs]] for context on what `terraform.tfvars` contains.

---

## Global .gitignore

Set up a global `.gitignore` for files you never want to commit on ANY project:

```bash
git config --global core.excludesfile ~/.gitignore_global
```

#### ~/.gitignore_global

```
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

---

### Checking What's Ignored

```bash
# Check if a specific file is being ignored (and why)
git check-ignore -v path/to/file
# -v = verbose: shows which .gitignore line is causing the ignore

# List all ignored files
git status --ignored

# See git's view of what's tracked
git ls-files
```

---

## Git LFS — Large File Storage

### Git LFS — tracking large files without bloating the repo

> [!info] When to Use Git LFS
>
> Git stores every version of every file in full. A 500 MB Parquet file changed 10 times = 5 GB of repo history. Git LFS replaces large files with lightweight pointers in the repo, storing the actual content on a separate server. Use for binary files, data samples, model artifacts, and any file > 10 MB.

```bash
# Install Git LFS (once per machine)
git lfs install

# Track file patterns — creates/updates .gitattributes
git lfs track "*.parquet"
git lfs track "*.pkl"
git lfs track "*.csv"
git lfs track "data/samples/**"

# Verify tracking rules
cat .gitattributes
```

```bash
# Commit the .gitattributes file (must be tracked by Git)
git add .gitattributes
git commit -m "chore: configure Git LFS for data files"

# Then add and commit large files normally
git add data/sample.parquet
git commit -m "feat: add sample data for testing"
git push   # LFS uploads the file to the LFS server
```

> [!warning] LFS Must Be Set Up Before First Commit
>
> If you commit a large file BEFORE running `git lfs track`, it goes into regular Git history. You must then use `git lfs migrate` to retroactively move it to LFS — which rewrites history and requires a force-push.

```bash
# Check which files are managed by LFS
git lfs ls-files

# Migrate existing large files to LFS (rewrites history)
git lfs migrate import --include="*.parquet" --everything
```

> [!tip] GitHub LFS Storage Limits
>
> Free GitHub accounts get 1 GB LFS storage + 1 GB bandwidth/month. Each additional 50 GB data pack costs $5/month. For large datasets, store in GCS and reference by path — Git LFS is for files that must be versioned alongside code (test fixtures, model artifacts), not for production data.

---

## Related

- [[git-daily-workflow]] — the daily workflow that benefits from a clean .gitignore
- [[github-actions-ci-cd]] — CI secrets that must never be committed
- [[terraform-variables-and-outputs]] — terraform.tfvars that must be gitignored

## References

- [gitignore documentation](https://git-scm.com/docs/gitignore)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
