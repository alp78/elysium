---
type: concept
category: git
technology: [git]
tags: [git]
aliases: [git branch, git merge, git rebase, git checkout, branching strategy, merge strategies]
keywords: [git, branch, merge, rebase, checkout, switch, stash, feature branch, branching strategy, merge commit, fast-forward, squash merge]
description: "Git branching and merging strategies — creating feature branches, switching branches, stashing work, merging, rebasing, and recovery techniques."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Branching and Merging

> [!quote]
> "In git, we like branches so much that once you realize you have to have a special branch anyway, you might as well have many."
>
> — **Linus Torvalds**, Git mailing list

Branching isolates work so that multiple features, fixes, and experiments can proceed in parallel without interfering with each other. Merging integrates completed work back into the main branch.

### Creating and Switching Branches

A branch is an independent line of development. Creating a branch copies your current position in history and lets you make changes without affecting the main line. Switching branches changes your working directory to reflect the state of that branch — all files update to match the branch's latest commit. If you have uncommitted changes that conflict with the target branch, Git refuses to switch.

> [!tip] Prefer git switch over git checkout
>
> `git switch` (Git 2.23+) is the modern replacement for `git checkout` when switching branches. Unlike `checkout`, `switch` cannot accidentally discard uncommitted work — it refuses to switch if there are conflicts. Use `git switch -c branch` to create, `git switch branch` to switch.

```bash
# Create and switch to a new branch (modern)
git switch -c feature/pulse-chart-fix

# Or the traditional way (still works)
git checkout -b feature/pulse-chart-fix

# Switch branches
git switch main
```

### Stashing Uncommitted Work

A stash is a temporary storage area for uncommitted changes. When you stash, Git saves your modified tracked files and staged changes onto a stack, then reverts your working directory to a clean state matching the last commit. You can re-apply stashed changes later on the same branch or a different one. Stashing is essential when you need to switch branches mid-work without committing half-finished code.

> [!info] Stash saves and restores work
>
> Saves your changes to a stack and reverts the working directory to clean. Use case: you need to switch to main for a hotfix but don't want to commit yet.

```bash
git stash push -m "WIP: pulse chart refactor"

git stash list              # see all stashes
git stash pop               # restore the most recent stash and remove it
git stash apply stash@{2}   # apply a specific stash without removing it
```

> [!warning] Stash skips untracked files
>
> By default `git stash` only saves modified tracked files. New files that have never been staged are left behind. Use `git stash -u` (or `--include-untracked`) to stash untracked files too. Without `-u`, switching branches after stashing can leave orphan files in your working directory.

## Merging Strategies

Merging is how completed work on one branch gets integrated into another. Git offers several strategies: a standard merge creates a merge commit that joins two branch histories, a rebase replays your commits on top of the target branch for a linear history, and a squash merge condenses all branch commits into a single commit on the target. The choice affects how your project history reads — merge preserves the full branching story, rebase makes it look like everyone worked sequentially.

See [merge-vs-rebase-vs-squash](https://alp78.github.io/elysium/08-Git/merge-vs-rebase-vs-squash) for a detailed comparison of when to use each strategy. Once a branch is merged, [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) covers the PR workflow that typically wraps these merge operations in a review process.

### Standard Merge

A standard merge creates a new "merge commit" that has two parents — the tip of both branches. This preserves the complete history of both branches, showing exactly when they diverged and when they were joined. Fast-forward merges (when the target branch has no new commits) skip the merge commit entirely and just move the pointer forward.

```bash
git checkout main
git merge feature/pulse-chart-fix
# Creates a merge commit preserving both histories
```

> [!tip] Use --no-ff for explicit merges
>
> If main has not advanced since your branch was created, Git performs a fast-forward merge (no merge commit). Use `git merge --no-ff` to force a merge commit even when fast-forward is possible. This keeps the branch boundary visible in `git log --graph`.

### Rebase (linear history)

Rebasing takes every commit on your branch and re-applies them one by one on top of the target branch's latest commit. The result is a perfectly linear history — it looks like you started your work after the latest main commit, even if you actually started weeks ago. The trade-off: every replayed commit gets a new SHA hash, which means you're rewriting history.

```bash
git checkout feature/pulse-chart-fix
git rebase main
# Replays your commits on top of main's latest
```

> [!danger] -D force-deletes without checking
>
> `git branch -d` refuses to delete a branch that hasn't been merged — this is a safety check. `git branch -D` (uppercase) bypasses the check and force-deletes unconditionally. If the branch has unmerged commits and hasn't been pushed, that work is only recoverable via `git reflog` for ~90 days.

> [!warning] Never Rebase Shared Branches
>
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts and confusion. Only rebase local/private branches.

### Git Branch Recovery Techniques

The reflog is Git's safety net — it records every time HEAD moves (commits, checkouts, resets, rebases) for approximately 90 days. Even if you delete a branch or run `reset --hard`, the commits still exist in the reflog. You can recover almost anything that was ever committed by finding its hash in the reflog.

> [!info] Undo last commit, keep changes
>
> `--soft` keeps your changes staged (ready to re-commit). `HEAD~1` means one commit back. Use this when you committed too early or with the wrong message.

```bash
git reset --soft HEAD~1
```

> [!danger] checkout -- Destroys Uncommitted Work
>
> `git checkout -- .` permanently deletes ALL uncommitted changes to tracked files. Unlike `reset --hard`, there is NO reflog recovery — uncommitted work was never recorded by Git. Use `git stash` first if you might need the changes back.

```bash
# Discard all uncommitted changes (DESTRUCTIVE — no recovery)
git checkout -- .
# Does NOT affect untracked files
```

> [!info] Reflog recovers lost commits
>
> The reflog shows every HEAD movement (commits, checkouts, resets, rebases). Even "deleted" commits survive here for approximately 90 days.

```bash
git reflog
git checkout <hash-from-reflog>
```

See [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) for detailed recovery workflows.

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — Status, staging, committing, pushing
- [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) — Detailed recovery techniques
- [merge-vs-rebase-vs-squash](https://alp78.github.io/elysium/08-Git/merge-vs-rebase-vs-squash) — Comparison table of merge strategies
