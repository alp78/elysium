---
type: how-to
category: git
technology: [git, github]
tags: [git]
aliases: [git workflow, git status, git add, git commit, git push, git pull, conventional commits, git diff, git fetch, feature branch workflow, daily git]
keywords: [git, status, add, commit, push, pull, rebase, diff, stage, conventional commits, feat, fix, refactor, daily workflow, version control, git add -p, interactive staging, git push -u, upstream tracking, git fetch, git pull --rebase, amend commit, unstage, git status -s, short status, git diff --staged, feature branch, squash merge, gh pr create, GitHub CLI]
description: "The complete daily Git workflow for data engineering teams — from checking status through staging, committing, pushing, and pulling, plus the full feature branch workflow, conventional commit conventions, team rules, and a decision tree for when things go wrong."
related:
  - "[[git-branching-and-merging]]"
  - "[[git-recovery-and-undo]]"
  - "[[git-cheat-sheet]]"
  - "[[pull-requests-and-code-review]]"
  - "[[git-setup-and-config]]"
  - "[[git-common-errors]]"
  - "[[gitignore-patterns]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Daily Workflow

Git is not optional for data engineering. Every SQL migration, every DAG definition, every pipeline configuration, and every [[hcl-syntax-basics|Terraform module]] must be version-controlled. These are the commands you run dozens of times per day. For a condensed quick-reference, see [[git-cheat-sheet]].

## Step 1: Check What's Changed

**Show the state of the working directory and staging area:**

```bash
git status
# Shows: current branch, staged changes, unstaged changes, untracked files
# In plain English: What's changed since my last save point?
```

**Compact one-line-per-file status:**

```bash
git status -s
# -s = short format: M = modified, A = added, ?? = untracked
# Left column = staged, right column = unstaged
```

**View changes in detail:**

```bash
git diff                    # unstaged changes (what you've modified but not staged)
git diff --staged           # staged changes (what will be in the next commit)
git diff main...HEAD        # all changes on your branch vs main (PR preview)
```

**View recent history:**

```bash
git log --oneline -20
# --oneline = compact format (hash + first line of message)
# -20 = last 20 commits

# With branch topology:
git log --oneline --graph --decorate -20
```

## Step 2: Stage Changes (Choose What to Commit)

**Stage a specific file for the next commit:**

```bash
git add filename.py
# add = move a file from "modified" to "staged" (ready to commit)
# In plain English: Mark this file to be included in the next save point.
```

**Stage all changes in specific directories:**

```bash
git add src/transforms/ tests/
# Stage everything in these directories
```

**Stage ALL changes (new, modified, and deleted):**

```bash
git add -A
# -A = all: stage every change across the entire repo
# In plain English: Mark everything for the next save. Use with caution.
```

> [!warning] Avoid `git add -A` or `git add .` in Production Repos
> In repos with sensitive files (.env, credentials), stage specific files by name instead. Use [[gitignore-patterns|.gitignore]] as a safety net, not as your primary defense against committing secrets or large files.

**Interactive staging (choose individual changes within files):**

```bash
git add -p
# -p = patch mode: shows each change hunk and asks y/n to stage it
# In plain English: Review each change one by one and pick which ones to include.
```

**Unstage a file (remove from staging area, keep changes):**

```bash
git reset HEAD filename.py
# reset HEAD = move the staging pointer back
# In plain English: Oops, I didn't mean to include that file. Remove it from staging.

# Modern alternative:
git restore --staged filename.py
```

## Step 3: Commit (Create a Save Point)

**Create a commit with a message:**

```bash
git commit -m "fix: correct timezone handling in OHLCV transform"
# commit = create a new snapshot of all staged changes
# -m "..." = the commit message (inline, no editor opens)
```

**Create a commit with title and body:**

```bash
git commit -m "feat: add daily signal fetcher" -m "Fetches PE, yield, and momentum from yfinance."
# First -m = the subject line
# Second -m = the body (longer description)
```

**Amend the last commit (rewrite it):**

```bash
git commit --amend -m "fix: correct timezone handling"
# --amend = replace the last commit with a new one (rewrites history)
# In plain English: Fix a typo in my last commit message or add forgotten files.
```

> [!warning] Never Amend a Pushed Commit
> Never amend a commit that has already been pushed, unless you are the only one working on the branch. Amending rewrites history and will cause conflicts for anyone who has pulled the original.

### Conventional Commit Format

Use present tense imperative ("add", "fix", "update" — not "added", "fixed"). Keep the first line under 72 characters.

| Prefix | Use | Example |
|--------|-----|---------|
| `feat:` | New feature or functionality | `feat: add daily signal fetcher` |
| `fix:` | Bug fix | `fix: prevent forward-fill beyond today's date` |
| `refactor:` | Code restructuring (no behavior change) | `refactor: read symbols from DB instead of files` |
| `docs:` | Documentation only | `docs: add pipeline architecture diagram` |
| `test:` | Adding or updating tests | `test: add unit tests for signal transforms` |
| `chore:` | Maintenance (dependencies, configs) | `chore: update yfinance to 0.2.31` |
| `ci:` | CI/CD changes | `ci: add Python 3.12 to test matrix` |

## Step 4: Push (Upload to GitHub)

**Upload local commits to the remote branch:**

```bash
git push
# push = send your local commits to the tracked remote branch
# In plain English: Send your save points to GitHub so the team can see them.
```

**Push a new branch and set up tracking:**

```bash
git push -u origin feat/my-feature
# -u = set upstream: link the local branch to the remote branch
# origin = the remote name (GitHub)
# feat/my-feature = the branch name
# After this, plain "git push" works without specifying origin/branch
```

**Delete a branch on GitHub:**

```bash
git push origin --delete feat/old-branch
# --delete = remove the specified branch from the remote
# In plain English: Remove a branch from GitHub (e.g., after a PR is merged).
```

## Step 5: Pull (Download from GitHub)

**Download and merge the team's latest changes:**

```bash
git pull
# pull = shorthand for git fetch + git merge (download + integrate)
# In plain English: Download the team's latest changes and merge them into your work.
```

**Download and rebase (cleaner history, no merge commits):**

```bash
git pull --rebase
# --rebase = replay your local commits on top of the remote changes instead of merging
# In plain English: Download latest changes, then replay your work on top. Cleaner history.
```

**Download new data without merging (safe inspection):**

```bash
git fetch
# fetch = download from remote but don't touch your files
# Updates remote-tracking branches (origin/main etc.)
# In plain English: Check what the team has done, but don't touch my files yet.
```

> [!tip] Fetch Is Always Safe
> `git fetch` is always safe — it never modifies your files. `git pull` might cause [[git-merge-conflicts|merge conflicts]]. When in doubt, fetch first and inspect with `git log origin/main --oneline`.

## The Feature Branch Workflow (Complete Cycle)

This is the standard workflow used by data engineering teams:

```
1. Pull latest main         git checkout main && git pull
2. Create feature branch    git checkout -b feat/my-feature
3. Make changes             (edit files, run tests)
4. Stage and commit         git add file.py && git commit -m "feat: ..."
5. Push branch              git push -u origin feat/my-feature
6. Create PR                gh pr create --title 'Add feature X'
7. Team reviews             (address feedback with new commits)
8. Merge                    gh pr merge --squash --delete-branch
9. Clean up locally         git checkout main && git pull && git branch -d feat/my-feature
```

Pushing a branch or opening a PR typically triggers [[github-actions-fundamentals|GitHub Actions]] CI workflows -- linting, tests, and builds that validate the change before review. For dbt projects specifically, [[dbt-ci-cd]] runs model compilation and test checks on every PR.

## Rules for Distributed Data Teams

- **Never push directly to main** — always use PRs
- **Never force-push to shared branches** — use `--force-with-lease` on personal branches only
- **Pull before you push** to avoid conflicts
- **Keep PRs small and focused** — one feature per PR
- **Write descriptive PR descriptions** explaining WHY, not just WHAT
- **Delete branches after merging** — use `--delete-branch` flag
- **Use branch protection rules on main** — require reviews, passing CI, no force-push
- **Tag releases** so you can always find what's deployed (see [[git-tagging-and-releases]])
- **Keep `.gitignore` comprehensive from day one** (see [[gitignore-patterns]])
- **Never commit secrets** — use environment variables and secret managers

## When Things Go Wrong: Decision Tree

| Situation | Solution |
|-----------|----------|
| **Haven't committed yet?** | `git restore file` (discard) or `git stash` (save for later) |
| **Committed but not pushed?** | `git reset --soft HEAD~1` (redo) or `git commit --amend` (fix) |
| **Pushed but not merged?** | `git revert SHA` (safe undo) or `--force-with-lease` if you're alone on the branch |
| **Merged to main?** | `git revert SHA` (create an undo commit) — never rewrite main's history |
| **Lost a commit?** | `git reflog` — Git's safety net, remembers everything for ~90 days |

See [[git-recovery-and-undo]] for detailed recovery procedures and [[git-common-errors]] for specific error messages.

## Best Practices for Data Pipeline Teams

> [!tip] Best Practices
> 1. **Never commit credentials.** Add to [[gitignore-patterns|.gitignore]]: `*.env`, `*.json` (service account keys), `secrets/`. Use `git-secrets` to scan for AWS/GCP keys before each commit.
> 2. **SQL migrations in git.** Number them sequentially: `V001__create_ohlcv.sql`, `V002__add_signals.sql`. Never modify a committed migration — create a new one. See the dbt and migration notes for versioning patterns.
> 3. **DAG files in git.** Airflow reads DAGs from a directory — changes are deployed by updating the files. Version them in git, deploy via [[github-actions-ci-cd|CI/CD]] or SCP.
> 4. **Large data files.** If you must track data files, use Git LFS: `git lfs track "*.parquet"`. Otherwise, keep data in GCS and reference it by URI.

## Quick Reference

| Action | Command |
|--------|---------|
| What's changed? | `git status` |
| Compact status | `git status -s` |
| Stage a file | `git add file` |
| Stage everything | `git add -A` |
| Interactive stage | `git add -p` |
| Unstage a file | `git restore --staged file` |
| Commit | `git commit -m 'msg'` |
| Amend last commit | `git commit --amend -m 'msg'` |
| Push | `git push` |
| Push new branch | `git push -u origin branch` |
| Pull (merge) | `git pull` |
| Pull (rebase) | `git pull --rebase` |
| Fetch only | `git fetch` |
| Delete remote branch | `git push origin --delete branch` |

## Related

- [[git-setup-and-config]] — Initial Git setup and core concepts
- [[git-branching-and-merging]] — Creating branches and merge strategies
- [[git-merge-conflicts]] — Resolving conflicts step by step
- [[git-recovery-and-undo]] — Stash, reset, revert, and reflog
- [[git-remote-management]] — Remotes, upstream forks, fetch vs pull
- [[git-tagging-and-releases]] — Tagging releases for deployment
- [[pull-requests-and-code-review]] — PR workflow and GitHub CLI
- [[github-actions-ci-cd]] — Automated testing and deployment
- [[git-common-errors]] — 25+ error scenarios with fixes
- [[gitignore-patterns]] — Keeping secrets and junk out of the repo
- [[git-cheat-sheet]] — One-page quick reference
