---
type: how-to
category: git
technology: [git, github]
tags: [git]
aliases: [merge conflict, conflict markers, resolve conflicts, git merge abort, conflict resolution, git mergetool, rebase conflict, three-way merge, accept incoming, accept current]
keywords: [merge conflict, conflict markers, resolve conflict, git merge abort, git mergetool, rebase continue, rebase abort, conflict resolution, three-way merge, HEAD, incoming changes, stash pop conflict, VS Code merge tool, accept current, accept incoming, prevent merge conflicts, conflict markers explanation]
description: "How to understand, resolve, and prevent git merge conflicts — including conflict marker syntax, step-by-step resolution, git mergetool with VS Code, and rebase conflict resolution with a real-world case study."
related: ["[[git-branching-and-merging]]", "[[git-remote-management]]", "[[git-recovery-and-undo]]", "[[pull-requests-and-code-review]]"]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Merge Conflict Resolution

Merge conflicts occur when two branches modify the same lines in the same file and Git cannot automatically decide which version to keep. They arise during `git merge`, `git rebase`, `git cherry-pick`, and `git stash pop`. This note explains conflict marker syntax, the step-by-step resolution process, tooling options, and prevention strategies.

## What a Merge Conflict Looks Like

When Git encounters a conflict, it edits the affected file and inserts conflict markers:

```
<<<<<<< HEAD
start_date = "2024-01-01"
=======
start_date = "2023-06-01"
>>>>>>> feat/new-history
```

#### Reading the markers

| Marker | Meaning |
|--------|---------|
| `<<<<<<< HEAD` | Start of your current branch's version |
| `=======` | Divider between the two versions |
| `>>>>>>> feat/new-history` | End of the incoming branch's version |

Everything between `<<<<<<< HEAD` and `=======` is what your current branch (HEAD) has. Everything between `=======` and `>>>>>>> feat/new-history` is what the incoming branch has. Git is saying: "These two versions disagree. You decide which one to keep."

> [!info] Conflict markers in different contexts
> The marker labels change depending on the operation:
> - **`git merge`**: `HEAD` = your branch, `>>>>>>> branch-name` = the branch being merged in
> - **`git rebase`**: `HEAD` = the target branch (main), `>>>>>>> commit-sha (message)` = your commit being replayed
> - **`git stash pop`**: `Updated upstream` = the branch you switched to, `Stashed changes` = your stashed work

## Step-by-Step Resolution Process

1. Identify conflicted files:

   ```bash
   git status
   ```

   Files with conflicts are listed under "Unmerged paths" with `both modified`.

2. Open each conflicted file in your editor.

3. Find every `<<<<<<<` / `=======` / `>>>>>>>` block.

4. Edit the file to the correct final version — remove the markers and keep the desired code. You may keep one side, the other side, or combine both.

5. Stage each resolved file:

   ```bash
   git add filename.py
   ```

6. Complete the merge:

   ```bash
   git commit
   ```

   Git will pre-populate the commit message with merge information. You can edit it or accept the default.

> [!warning] Do not leave conflict markers in your code
> If you stage a file that still contains `<<<<<<<` markers, Git will accept the commit — but the file will be broken. Always verify the file is clean before running `git add`.

## Aborting a Merge

#### Cancel a merge and return to the state before merging started

```bash
git merge --abort
```

- `--abort` — cancel the in-progress merge entirely, restore the working directory to its pre-merge state

Use this when you start a merge, find the conflicts too complex to resolve now, and want to step back and reconsider your approach (e.g., rebase instead of merge, or coordinate with the teammate who made the conflicting changes).

> [!tip] Abort is always safe
> `git merge --abort` is completely safe. It restores your working directory exactly to where it was before you ran `git merge`. No work is lost.

## Visual Merge Tools

#### Launch the configured visual merge tool

```bash
git mergetool
```

- `mergetool` — opens the configured GUI tool for side-by-side conflict resolution across all conflicted files

### VS Code Integration

VS Code has excellent built-in merge conflict resolution. When a file with conflict markers is open, VS Code displays inline action buttons above each conflict block:

- **Accept Current Change** — keep the HEAD (your branch) version
- **Accept Incoming Change** — keep the incoming branch's version
- **Accept Both Changes** — append both versions sequentially
- **Compare Changes** — open a diff view

To configure VS Code as the default merge tool globally:

```bash
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
```

After this, `git mergetool` opens VS Code for every conflicted file.

## Rebase Conflict Resolution

Conflicts during `git rebase` work the same way mechanically, but the workflow continues differently than a merge. Git pauses the rebase at each conflicting commit and waits for you to resolve.

#### After resolving conflicts in a rebasing file, continue the rebase

```bash
git add filename.py
git rebase --continue
```

- `git add` — mark the file as resolved (same as in merge resolution)
- `git rebase --continue` — apply the resolution and replay the next commit in the sequence

#### Other rebase escape hatches

```bash
git rebase --abort   # Cancel the entire rebase, restore pre-rebase state
git rebase --skip    # Skip the current commit (use only if that commit is no longer needed)
```

> [!warning] Rebase --abort vs Merge --abort
> Both abort commands are safe and restore your prior state. Remember: after a `git rebase`, commit SHAs change — you will need to `git push --force-with-lease` to update the remote. See [[git-remote-management]] for safe force-push usage.

## Real-World Case Study: Rebase a PR After Another PR Was Merged

This scenario happens regularly: you open a PR, a teammate's PR gets merged into `main` while yours is open, and now GitHub blocks your squash-merge with "the merge commit cannot be cleanly created."

### The Situation

1. You are on a feature branch (`fix/stock-chart-missing-latest-date`) with committed changes
2. A teammate's PR (`perf/bulk-sql-inserts`) was merged into `main` while you were working
3. Your branch now diverges from `main` and the PR is unmergeable

### Step 1: Stash Uncommitted Changes and Switch Branches

```bash
git stash
git checkout fix/stock-chart-missing-latest-date
git stash pop
```

- `git stash` — shelve all uncommitted changes (staged and unstaged) into temporary storage
- `git checkout fix/stock-chart-missing-latest-date` — switch to the feature branch
- `git stash pop` — re-apply the shelved changes onto the new branch

> [!warning] Stash pop can produce conflicts
> If the stashed changes touch the same lines that differ between branches, `git stash pop` will produce merge conflicts. This is expected — the stash is still preserved (not dropped) when conflicts occur, so your work is safe.

### Step 2: Resolve Stash Pop Conflicts

When `git stash pop` produces conflicts, the markers label the sides differently:

```
<<<<<<< Updated upstream     ← what's on the current branch
            rows = []
            skipped = 0
=======                      ← separator
            inserts = []
            updates = []
>>>>>>> Stashed changes      ← your stashed work
```

#### Resolution approach
- Open each conflicted file
- Remove the conflict markers and keep the correct version
- In most cases you want your stashed changes (they contain the new work)
- Verify: if the branch has old code and `main` has newer refactored code, you may need to combine both

After resolving:

```bash
git add ingestion/loaders/load_ohlcv.py    # stage each resolved file
git stash drop                              # manually drop the stash (pop didn't auto-drop due to conflicts)
```

### Step 3: Commit, Push, and Attempt Squash-Merge

```bash
git add -A
git commit -m "fix: resolve missing volume and stale OHLCV data across pipeline and dashboard"
git push -u origin fix/stock-chart-missing-latest-date
gh pr merge 7 --squash
```

#### The merge fails

```
Pull request #7 is not mergeable: the merge commit cannot be cleanly created.
```

Your branch diverged from `main` before the other PR was merged. Git cannot automatically reconcile the differences.

### Step 4: Rebase onto the Updated Main

```bash
git fetch origin main
git rebase origin/main
```

- `git fetch origin main` — download the latest `main` from GitHub without merging
- `git rebase origin/main` — replay your branch's commits on top of the latest `main`

Git pauses at each conflicting commit:

```
Auto-merging ingestion/loaders/load_ohlcv.py
CONFLICT (content): Merge conflict in ingestion/loaders/load_ohlcv.py
error: could not apply f55889d... fix: resolve missing volume...
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
```

### Step 5: Resolve Rebase Conflicts

Open the conflicted file. During rebase, the markers mean:

```
<<<<<<< HEAD                 ← what's on main (the "base" during rebase)
            rows = []        ← old code from the merged teammate PR
=======
            inserts = []     ← your feature branch changes
            updates = []
>>>>>>> f55889d (fix: ...)
```

Keep your feature branch version (the upsert logic with `inserts` + `updates`) — that is the actual fix. Remove the old code and all conflict markers, then continue:

```bash
git add ingestion/loaders/load_ohlcv.py
git rebase --continue
```

- `git add` — mark the file as resolved
- `git rebase --continue` — apply the resolution and move to the next commit

### Step 6: Force-Push and Squash-Merge

After rebasing, your local branch has been rewritten (new commit SHAs), so a normal `git push` is rejected. Use `--force-with-lease`:

```bash
git push --force-with-lease origin fix/stock-chart-missing-latest-date
gh pr merge 7 --squash
```

- `--force-with-lease` — force-push but only if no one else has pushed to this branch since your last fetch

### Why This Works

| Step | What happens |
|------|-------------|
| `git stash` + `pop` | Moves uncommitted work across branches |
| `git rebase origin/main` | Replays your commits on top of the latest main, creating a linear history |
| Resolve conflicts | You manually pick the correct code when Git cannot auto-merge |
| `--force-with-lease` | Updates the remote branch with the rewritten (rebased) history |
| `gh pr merge --squash` | Squashes all commits into one clean commit on main |

### Key Takeaways

1. **Stash pop conflicts are normal** when branches have diverged — your work is safe in the stash until you `git stash drop`
2. **Rebase before merge** when your PR falls behind `main` — it creates a clean linear history
3. **Always use `--force-with-lease`** instead of `--force` when pushing rebased branches
4. **Conflict markers differ** between stash pop (`Updated upstream` / `Stashed changes`) and rebase (`HEAD` = target branch / commit SHA = your commit)
5. **`git rebase --abort`** is your safety net — it undoes the entire rebase if things go wrong

## Preventing Merge Conflicts

Prevention is better than resolution. Strategies that reduce conflict frequency:

- **Pull from main before starting any new work:**
  ```bash
  git checkout main && git pull && git checkout -b feat/my-feature
  ```
- **Keep PRs small and focused** — one feature or fix per PR. Large PRs take longer to review, increasing the chance that `main` moves ahead.
- **Merge or rebase frequently** — if your branch lives for more than a day or two, periodically rebase onto the latest `main` to stay current.
- **Coordinate on shared files** — if two people are editing the same file for unrelated reasons, communicate and consider sequencing the PRs.
- **Use GitHub's branch update button** — enable "Always suggest updating pull request branches" in repo Settings → General → Pull Requests. This adds a one-click "Update branch" button on the PR page.
- **Enable branch protection rules** — "Require branches to be up to date before merging" forces every PR to be rebased before it can merge. See [[pull-requests-and-code-review]] for setup.

> [!tip] Rebase early, rebase often
> Running `git rebase origin/main` on your feature branch every morning takes 30 seconds when there are no conflicts. It saves hours when you wait until the PR is blocked at merge time.

## Quick Reference: Conflict Resolution Commands

| Goal | Command |
|------|---------|
| See which files have conflicts | `git status` |
| Stage a resolved file | `git add filename.py` |
| Complete the merge | `git commit` |
| Abort the merge | `git merge --abort` |
| Open visual merge tool | `git mergetool` |
| Continue after rebase conflict | `git rebase --continue` |
| Abort the entire rebase | `git rebase --abort` |
| Skip a conflicting commit during rebase | `git rebase --skip` |
| Drop stash after pop conflict | `git stash drop` |

## Related

- [[git-branching-and-merging]] — merge and rebase strategies that trigger conflicts
- [[git-remote-management]] — `--force-with-lease` for pushing after rebase
- [[git-recovery-and-undo]] — aborting, resetting, and recovering from failed merges
- [[pull-requests-and-code-review]] — preventing unmergeable PRs with branch protection rules
