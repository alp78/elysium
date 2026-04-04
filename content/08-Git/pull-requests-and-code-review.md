---
tags: [git, github]
aliases: [pull request, PR, code review, gh pr, GitHub CLI, PR workflow, merge PR, squash merge]
description: "Pull request creation, review, and merge workflows using GitHub CLI — including squash merge, handling diverged branches with rebase, branch protection rules, and resolving 'not mergeable' errors."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Pull Requests and Code Review

> [!quote]
> "Given enough eyeballs, all bugs are shallow."
>
> — **Eric S. Raymond**, *The Cathedral and the Bazaar* (1999) (Linus's Law)

Pull requests (PRs) are GitHub's mechanism for proposing changes. They let teammates review your code, discuss it, and approve it before merging. This note covers the complete PR lifecycle from creation to merge, including recovery from common failure modes.

### Creating a PR

> [!info] gh pr create — open a new pull request from the current branch
> - `--title` / `--body` — set the PR title and description
> - `--base` — target a branch other than the default (e.g., `develop`)
> - `--draft` — mark as work-in-progress; cannot be merged until marked ready

```bash
gh pr create --title "Add daily signal fetcher" --body "Fetches PE, yield from yfinance."

# Target a specific base branch
gh pr create --title "Fix bug" --body "Details" --base develop

# Create a draft PR (work in progress)
gh pr create --draft --title "WIP: new feature"
```

### Reviewing and Merging PRs

> [!info] gh pr — review and merge pull requests
> - `pr list` — show all open PRs in the repository
> - `pr view 42` — show title, body, status, checks, and reviews for PR #42
> - `pr checkout 42` — download and switch to PR #42's branch for local testing
> - `pr merge 42` — merge the pull request (combine with `--squash`, `--merge`, or `--rebase`)
> - `--delete-branch` — delete the branch on GitHub after merging

```bash
gh pr list
gh pr view 42
gh pr checkout 42

# Squash-merge and delete the remote branch
gh pr merge 42 --squash --delete-branch

# Standard merge (preserves all commits)
gh pr merge --merge

# Rebase merge (linear history, no merge commit)
gh pr merge --rebase
```

> [!warning] Draft PRs block merge
>
> A `--draft` PR cannot be merged until explicitly marked as "Ready for review" via the GitHub UI or `gh pr ready`. CI checks still run on draft PRs, but the merge button is disabled. This prevents accidental merges of incomplete work.

> [!success] Mark Ready When All Work Is Complete
>
> Run `gh pr ready <number>` or click "Ready for review" in the GitHub UI once your branch is complete and all CI checks pass. This unblocks the merge button and signals to reviewers that the PR is ready for evaluation.

### Merge Strategy Comparison

| Strategy | History | When to Use |
|----------|---------|------------|
| `--squash` | One clean commit per PR on main | Default for most teams — clean history |
| `--merge` | Full branch history preserved | When audit trail of individual commits matters |
| `--rebase` | Linear history, no merge commit | Clean history + individual commits visible |

> [!tip] After Squash Merge
>
> After `gh pr merge --squash`, `git branch -d` may warn the branch isn't merged (different SHA). This is normal — squash creates a new combined commit with a different SHA. The changes ARE on main, just as a different commit. Safe to use `git branch -d` anyway (the warning is cosmetic).

### Preventing "PR is not mergeable" Errors

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

Branch protection rules work hand-in-hand with [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) -- CI checks run on every PR push, and the merge button stays greyed out until they pass. Code review itself is also a powerful [teaching and collaboration tool](https://alp78.github.io/elysium/15-DataOps/leadership-and-collaboration), especially for onboarding new team members.

Go to **Settings → Branches → Branch protection rules → Add rule** for `main`:

- Enable **"Require branches to be up to date before merging"**
- GitHub will grey out the merge button until the PR is rebased onto latest `main`
- This forces contributors to always update before merging, avoiding dirty histories

> [!tip] Combining Options B and C
>
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
>
> If the stashed changes touch the same lines that differ between branches, `git stash pop` will produce merge conflicts. This is expected — the stash is still preserved (not dropped) when conflicts occur, so your work is safe.

> [!success] Resolve Conflict Markers, Then Drop the Stash
>
> Open each conflicted file, edit the `<<<<<<<`/`=======`/`>>>>>>>` markers to keep the correct code, then run `git add <file>` and `git stash drop` to finalize. Your stash remains available until you explicitly drop it.

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

### Feature Branch Team Workflow

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

### Team Rules

- Never push directly to main — always use PRs
- Never force-push to shared branches
- Pull before you push to avoid conflicts
- Keep PRs small and focused — one feature per PR
- Write descriptive PR descriptions explaining WHY, not just WHAT
- Delete branches after merging (use `--delete-branch` flag)
- Use branch protection rules on main: require reviews, passing CI, no force-push
- Tag releases so you can always find what's deployed

---

### GitHub CLI — Issue Commands

```bash
gh issue list                          # Open issues
gh issue list --state all --label bug
gh issue list --author "@me" --assignee "@me"
gh issue view 99                       # View issue
gh issue view 99 --web

gh issue create --title "Bug: crash on login" --body "Steps to reproduce..."
gh issue create --label bug --assignee alice --milestone v2.0
gh issue create --template bug_report.md

gh issue edit 99 --title "new title"
gh issue edit 99 --add-label "confirmed" --remove-label "needs-triage"
gh issue edit 99 --assignee alice

gh issue comment 99 --body "Fixed in #42"
gh issue close 99 --comment "Closed by #42" --reason completed
gh issue reopen 99
gh issue pin 99
gh issue transfer 99 REPO
gh issue delete 99 --yes
```

---

### GitHub CLI — Release Commands

```bash
gh release list                         # List releases
gh release view TAG                     # View release details
gh release view --json tagName,body,assets

gh release create TAG                   # Create release (prompts for details)
gh release create v1.2.0 --title "v1.2.0" --notes "Release notes"
gh release create v1.2.0 --notes-file CHANGELOG.md
gh release create v1.2.0 --draft        # Draft release
gh release create v1.2.0 --prerelease   # Pre-release
gh release create v1.2.0 ./dist/*.tar.gz  # Attach assets
gh release create v1.2.0 ./bin/app#"Linux binary"  # Named asset

gh release edit TAG --title "new title" --notes "new notes"
gh release edit TAG --draft=false        # Publish draft

gh release upload TAG FILE [FILE...]    # Upload additional assets
gh release delete TAG --yes             # Delete release
gh release delete TAG --cleanup-tag --yes  # Also delete the git tag
```

---

### GitHub CLI — Repo Commands

```bash
gh repo clone OWNER/REPO               # Clone a repo
gh repo clone OWNER/REPO -- --depth 1  # With git flags after --

gh repo create NAME --public           # Create public repo
gh repo create NAME --private --clone  # Private + clone locally
gh repo create NAME --template OWNER/TEMPLATE

gh repo fork OWNER/REPO                # Fork to your account
gh repo fork OWNER/REPO --clone        # Fork + clone
gh repo fork OWNER/REPO --remote       # Add upstream remote

gh repo view                           # View current repo
gh repo view OWNER/REPO --web          # Open in browser

gh repo sync                           # Sync fork with upstream
gh repo sync --branch main

gh repo rename NEW_NAME
gh repo archive                        # Archive repo
gh repo delete --confirm

gh repo list [OWNER]                   # List your/org repos
gh repo list --fork --source --archived

gh repo set-default OWNER/REPO         # Set default repo for gh commands
```

---

### GitHub CLI — Auth Commands

```bash
gh auth login                          # Interactive login (browser or token)
gh auth login --with-token < token.txt # Non-interactive with token
gh auth login --hostname ENTERPRISE_URL  # GitHub Enterprise

gh auth logout                         # Remove stored credentials
gh auth logout --hostname HOST

gh auth status                         # Show current authentication state
gh auth status --show-token            # Include token value

gh auth token                          # Print current token
gh auth refresh                        # Refresh token scopes
gh auth refresh --scopes repo,read:org
gh auth setup-git                      # Configure git to use gh as credential helper
```

---

### gh api — Raw REST and GraphQL

```bash
# GET request
gh api repos/OWNER/REPO

# POST request
gh api repos/OWNER/REPO/issues -f title="Bug" -f body="Description"

# PATCH
gh api -X PATCH repos/OWNER/REPO -f description="new description"

# DELETE
gh api -X DELETE repos/OWNER/REPO/issues/comments/COMMENT_ID

# With pagination
gh api repos/OWNER/REPO/issues --paginate

# JSON output fields
gh api repos/OWNER/REPO --jq '.stargazers_count'
gh api repos/OWNER/REPO --jq '[.name, .description]'

# GraphQL
gh api graphql -f query='
  query($login: String!) {
    user(login: $login) {
      name
      bio
      repositories(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes { name stargazerCount }
      }
    }
  }
' -f login=octocat

# Template output
gh api repos/OWNER/REPO --template '{{.full_name}}: {{.stargazers_count}} stars'

# Flags
# -H, --header KEY:VAL   Add request header
# -f, --field KEY=VAL    Add string parameter
# -F, --raw-field KEY=VAL  Add raw (typed) parameter
# -q, --jq EXPR          Filter with jq
# --paginate             Fetch all pages
# --input FILE           Read JSON body from file
# --cache DURATION       Cache response
# --silent               Don't print response
# --include              Include response headers
```

---

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — the daily workflow that feeds into PRs
- [git-branching-and-merging](https://alp78.github.io/elysium/08-Git/git-branching-and-merging) — creating and managing branches
- [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) — stash and reflog for recovery
- [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — the CI/CD that runs on PRs

## References

- [GitHub CLI pr commands](https://cli.github.com/manual/gh_pr)
- [About pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
