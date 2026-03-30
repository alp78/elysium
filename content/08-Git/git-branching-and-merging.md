---
type: concept
category: git
technology: [git]
tags: [git]
aliases: [git branch, git merge, git rebase, git checkout, branching strategy, merge strategies]
keywords: [git, branch, merge, rebase, checkout, switch, stash, feature branch, branching strategy, merge commit, fast-forward, squash merge]
description: "Git branching and merging strategies — creating feature branches, switching branches, stashing work, merging, rebasing, and recovery techniques."
related:
  - "[git-daily-workflow](/08-Git/git-daily-workflow)"
  - "[git-recovery-and-undo](/08-Git/git-recovery-and-undo)"
  - "[merge-vs-rebase-vs-squash](/08-Git/merge-vs-rebase-vs-squash)"
  - "[git-cheat-sheet](/08-Git/git-cheat-sheet)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Branching and Merging

Branching isolates work so that multiple features, fixes, and experiments can proceed in parallel without interfering with each other. Merging integrates completed work back into the main branch.

### Creating and Switching Branches

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

See [merge-vs-rebase-vs-squash](/08-Git/merge-vs-rebase-vs-squash) for a detailed comparison of when to use each strategy. Once a branch is merged, [pull-requests-and-code-review](/08-Git/pull-requests-and-code-review) covers the PR workflow that typically wraps these merge operations in a review process.

### Standard Merge
```bash
git checkout main
git merge feature/pulse-chart-fix
# Creates a merge commit preserving both histories
```

### Rebase (linear history)
```bash
git checkout feature/pulse-chart-fix
git rebase main
# Replays your commits on top of main's latest
```

> [!warning] Never Rebase Shared Branches
>
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts and confusion. Only rebase local/private branches.

### Git Branch Recovery Techniques

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

See [git-recovery-and-undo](/08-Git/git-recovery-and-undo) for detailed recovery workflows.

## Related

- [git-daily-workflow](/08-Git/git-daily-workflow) — Status, staging, committing, pushing
- [git-recovery-and-undo](/08-Git/git-recovery-and-undo) — Detailed recovery techniques
- [merge-vs-rebase-vs-squash](/08-Git/merge-vs-rebase-vs-squash) — Comparison table of merge strategies
