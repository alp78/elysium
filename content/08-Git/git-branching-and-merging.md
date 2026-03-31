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
> — **Linus Torvalds**

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

```bash
# Stash uncommitted changes (save for later)
git stash push -m "WIP: pulse chart refactor"
# Saves your changes to a stack and reverts the working directory to clean
# Use case: "I need to switch to main for a hotfix but don't want to commit yet"

git stash list              # see all stashes
git stash pop               # restore the most recent stash and remove it
git stash apply stash@{2}   # apply a specific stash without removing it
```

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

### Rebase (linear history)

Rebasing takes every commit on your branch and re-applies them one by one on top of the target branch's latest commit. The result is a perfectly linear history — it looks like you started your work after the latest main commit, even if you actually started weeks ago. The trade-off: every replayed commit gets a new SHA hash, which means you're rewriting history.

```bash
git checkout feature/pulse-chart-fix
git rebase main
# Replays your commits on top of main's latest
```

> [!warning] Never Rebase Shared Branches
>
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts and confusion. Only rebase local/private branches.

### Git Branch Recovery Techniques

The reflog is Git's safety net — it records every time HEAD moves (commits, checkouts, resets, rebases) for approximately 90 days. Even if you delete a branch or run `reset --hard`, the commits still exist in the reflog. You can recover almost anything that was ever committed by finding its hash in the reflog.

```bash
# Undo the last commit (keep the changes staged)
git reset --soft HEAD~1
# HEAD~1 = one commit back
# --soft = keep changes staged (ready to re-commit)
```

> [!danger] checkout -- Destroys Uncommitted Work
>
> `git checkout -- .` permanently deletes ALL uncommitted changes to tracked files. Unlike `reset --hard`, there is NO reflog recovery — uncommitted work was never recorded by Git. Use `git stash` first if you might need the changes back.

```bash
# Discard all uncommitted changes (DESTRUCTIVE — no recovery)
git checkout -- .
# Does NOT affect untracked files
```

```bash
# Recover from disaster (the reflog — Git's undo history)
git reflog
# Shows every HEAD movement (commits, checkouts, resets, rebases)
git checkout <hash-from-reflog>
# Recovers "lost" committed work — survives ~90 days
```

See [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) for detailed recovery workflows.

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — Status, staging, committing, pushing
- [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) — Detailed recovery techniques
- [merge-vs-rebase-vs-squash](https://alp78.github.io/elysium/08-Git/merge-vs-rebase-vs-squash) — Comparison table of merge strategies
