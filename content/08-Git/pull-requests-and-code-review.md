---
type: how-to
category: git
technology: [git, github]
tags: [git]
aliases: [pull request, PR, code review, gh pr, GitHub CLI, PR workflow, merge PR, squash merge]
keywords: [pull request, PR, code review, gh pr create, gh pr merge, squash merge, rebase merge, draft PR, branch protection, auto-merge, force-with-lease, merge conflict, PR workflow, github cli, gh pr checkout]
description: "Pull request creation, review, and merge workflows using GitHub CLI — including squash merge, handling diverged branches with rebase, branch protection rules, and resolving 'not mergeable' errors."
related:
  - "[[git-daily-workflow]]"
  - "[[git-branching-and-merging]]"
  - "[[git-recovery-and-undo]]"
  - "[[github-actions-ci-cd]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Pull Requests and Code Review

Pull requests (PRs) are GitHub's mechanism for proposing changes. They let teammates review your code, discuss it, and approve it before merging. This note covers the complete PR lifecycle from creation to merge, including recovery from common failure modes.

## Creating a PR

```bash
# Create a PR from the current branch to main
gh pr create --title "Add daily signal fetcher" --body "Fetches PE, yield from yfinance."
# gh — GitHub CLI tool
# pr create — create a new pull request
# --title "..." — the PR title
# --body "..." — the PR description/body

# Create a PR targeting a specific base branch
gh pr create --title "Fix bug" --body "Details" --base develop
# --base develop — target the develop branch instead of the default (main)

# Create a draft PR (work in progress)
gh pr create --draft --title "WIP: new feature"
# --draft — mark as draft: cannot be merged until marked ready
```

## Reviewing and Merging PRs

```bash
# List all open pull requests
gh pr list
# pr list — show all open PRs in the repository

# View details of a specific PR
gh pr view 42
# pr view — show title, body, status, checks, reviews
# 42 — the PR number

# Check out a PR's branch locally for testing
gh pr checkout 42
# pr checkout — download and switch to the PR's branch
# 42 — the PR number
# In plain English: Download PR #42's code to my machine so I can test it.

# Squash-merge a PR and delete the remote branch
gh pr merge 42 --squash --delete-branch
# pr merge — merge the pull request
# 42 — the PR number
# --squash — combine all commits into one
# --delete-branch — delete the branch on GitHub after merging

# Standard merge (preserves all commits)
gh pr merge --merge
# --merge — standard merge with full commit history preserved

# Rebase merge (linear history, no merge commit)
gh pr merge --rebase
# --rebase — replay PR commits onto the base branch
```

## Merge Strategy Comparison

| Strategy | History | When to Use |
|----------|---------|------------|
| `--squash` | One clean commit per PR on main | Default for most teams — clean history |
| `--merge` | Full branch history preserved | When audit trail of individual commits matters |
| `--rebase` | Linear history, no merge commit | Clean history + individual commits visible |

> [!tip] After Squash Merge
> After `gh pr merge --squash`, `git branch -d` may warn the branch isn't merged (different SHA). This is normal — squash creates a new combined commit with a different SHA. The changes ARE on main, just as a different commit. Safe to use `git branch -d` anyway (the warning is cosmetic).

## Preventing "PR is not mergeable" Errors

When another PR is merged into `main` while yours is open, GitHub may block your squash merge with: *"the merge commit cannot be cleanly created."* This happens because your branch has diverged from `main`.

**Option A: Rebase locally before every merge (manual habit)**

```bash
git fetch origin main && git rebase origin/main && git push --force-with-lease
```

Do this right before running `gh pr merge --squash`. Gets you a clean linear history.

**Option B: Configure GitHub to prevent it (recommended for teams)**

Go to your repository **Settings → General → Pull Requests** and enable:

| Setting | What it does |
|---------|--------------|
| **"Always suggest updating pull request branches"** | Adds an **"Update branch"** button on the PR page when it falls behind main — one click to rebase without CLI |
| **"Allow auto-merge"** | Lets PRs merge automatically once all checks pass |

**Option C: Branch protection rule (strictest)**

Branch protection rules work hand-in-hand with [[github-actions-ci-cd]] -- CI checks run on every PR push, and the merge button stays greyed out until they pass. Code review itself is also a powerful [[leadership-and-collaboration|teaching and collaboration tool]], especially for onboarding new team members.

Go to **Settings → Branches → Branch protection rules → Add rule** for `main`:

- Enable **"Require branches to be up to date before merging"**
- GitHub will grey out the merge button until the PR is rebased onto latest `main`
- This forces contributors to always update before merging, avoiding dirty histories

> [!tip] Combining Options B and C
> With both enabled, you click "Update branch" on the PR page (no CLI needed), wait for checks to pass, then merge. If you also enable auto-merge, it all happens automatically.

---

## Real-World Case Study: Rebase a PR After Another PR Was Merged

This scenario happens regularly: you create a feature branch, another PR gets merged into `main` while you're working, and now your PR has merge conflicts that block squash-merge.

### The Situation

1. You're on `main` and have uncommitted changes across 5 files
2. A teammate's PR (`perf/bulk-sql-inserts`) was already merged into `main`
3. You need to move your changes to an existing feature branch (`fix/stock-chart-missing-latest-date`)
4. That feature branch was created *before* the teammate's PR was merged — so it diverges from `main`

### Step 1: Stash uncommitted changes and switch branches

```bash
git stash
git checkout fix/stock-chart-missing-latest-date
git stash pop
```

- `git stash` — shelve all uncommitted changes (staged and unstaged) into a temporary storage
- `git checkout fix/stock-chart-missing-latest-date` — switch to the feature branch
- `git stash pop` — re-apply the shelved changes onto the new branch

> [!warning] Stash Pop Can Conflict
> If the stashed changes touch the same lines that differ between branches, `git stash pop` will produce merge conflicts. This is expected — the stash is still preserved (not dropped) when conflicts occur, so your work is safe.

### Step 2: Resolve stash pop conflicts

When `git stash pop` produces conflicts, files will contain conflict markers:

```
<<<<<<< Updated upstream     ← what's on the current branch
            rows = []
            skipped = 0
=======                      ← separator
            inserts = []
            updates = []
>>>>>>> Stashed changes      ← your stashed work
```

After resolving:

```bash
git add ingestion/loaders/load_ohlcv.py    # stage each resolved file
git stash drop                              # manually drop the stash (pop didn't auto-drop due to conflicts)
```

### Step 3: Commit and push the feature branch

```bash
git add -A
git commit -m "fix: resolve missing volume and stale OHLCV data across pipeline and dashboard"
git push -u origin fix/stock-chart-missing-latest-date
```

### Step 4: Create the PR and attempt squash-merge

```bash
gh pr create --title "fix: resolve missing volume and stale OHLCV data" --body "..."
gh pr merge 7 --squash
```

#### But it fails

```
Pull request #7 is not mergeable: the merge commit cannot be cleanly created.
```

Why: your branch diverged from `main` before the other PR was merged. Git cannot automatically reconcile the differences.

### Step 5: Rebase onto the updated main

```bash
git fetch origin main
git rebase origin/main
```

- `git fetch origin main` — download the latest `main` from GitHub without merging
- `git rebase origin/main` — replay your branch's commits on top of the latest `main`

Git will pause at each conflicting commit:

```
Auto-merging ingestion/loaders/load_ohlcv.py
CONFLICT (content): Merge conflict in ingestion/loaders/load_ohlcv.py
error: could not apply f55889d... fix: resolve missing volume...
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
```

### Step 6: Resolve rebase conflicts

Open the conflicted file. During rebase, the markers mean:

```
<<<<<<< HEAD                 ← what's on main (the "base" during rebase)
            rows = []        ← old code from merged PR
=======
            inserts = []     ← your feature branch changes
            updates = []
>>>>>>> f55889d (fix: ...)
```

Then continue the rebase:

```bash
git add ingestion/loaders/load_ohlcv.py
git rebase --continue
```

- `git add` — mark the file as resolved
- `git rebase --continue` — apply the resolution and move to the next commit (if any)

#### Other rebase escape hatches
- `git rebase --abort` — cancel the rebase entirely and go back to the state before you started
- `git rebase --skip` — skip the current commit (use only if the commit is no longer needed)

### Step 7: Force-push and squash-merge

After rebase, your local branch has been rewritten (new commit SHAs), so a normal push is rejected. Use `--force-with-lease`:

```bash
git push --force-with-lease origin fix/stock-chart-missing-latest-date
gh pr merge 7 --squash
```

- `--force-with-lease` — force-push but only if no one else has pushed to this branch since your last fetch. Safer than `--force` because it won't overwrite a teammate's work.

### Why this works

| Step | What happens |
|------|-------------|
| `git stash` + `pop` | Moves uncommitted work across branches |
| `git rebase origin/main` | Replays your commits on top of the latest main, creating a linear history |
| Resolve conflicts | You manually pick the correct code when Git can't auto-merge |
| `--force-with-lease` | Updates the remote branch with the rewritten (rebased) history |
| `gh pr merge --squash` | Squashes all commits into one clean commit on main |

### Key Takeaways

1. **Stash pop conflicts are normal** when branches have diverged — your work is safe in the stash until you `git stash drop`
2. **Rebase before merge** when your PR falls behind `main` — it creates a clean linear history
3. **Always use `--force-with-lease`** instead of `--force` when pushing rebased branches
4. **Conflict markers differ** between stash pop (`Updated upstream` / `Stashed changes`) and rebase (`HEAD` = target branch / commit SHA = your commit)
5. **`git rebase --abort`** is your safety net — it undoes the entire rebase if things go wrong

---

## Feature Branch Team Workflow

```
1. git checkout main && git pull
2. git checkout -b feat/my-feature
3. Make changes, commit frequently with clear messages
4. git push -u origin feat/my-feature
5. gh pr create --title 'Add feature X'
6. Teammates review, you address feedback with new commits
7. gh pr merge --squash --delete-branch
8. git checkout main && git pull && git branch -d feat/my-feature
```

## Team Rules

- Never push directly to main — always use PRs
- Never force-push to shared branches
- Pull before you push to avoid conflicts
- Keep PRs small and focused — one feature per PR
- Write descriptive PR descriptions explaining WHY, not just WHAT
- Delete branches after merging (use `--delete-branch` flag)
- Use branch protection rules on main: require reviews, passing CI, no force-push
- Tag releases so you can always find what's deployed

## Related

- [[git-daily-workflow]] — the daily workflow that feeds into PRs
- [[git-branching-and-merging]] — creating and managing branches
- [[git-recovery-and-undo]] — stash and reflog for recovery
- [[github-actions-ci-cd]] — the CI/CD that runs on PRs

## References

- [GitHub CLI pr commands](https://cli.github.com/manual/gh_pr)
- [About pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
