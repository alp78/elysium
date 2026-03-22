---
type: concept
category: git
technology: [git]
tags: [concept, git, version-control, branching]
aliases: [git branch, git merge, git rebase, git checkout, branching strategy, merge strategies]
keywords: [git, branch, merge, rebase, checkout, switch, stash, feature branch, branching strategy, merge commit, fast-forward, squash merge]
description: "Git branching and merging strategies — creating feature branches, switching branches, stashing work, merging, rebasing, and recovery techniques."
related:
  - "[[git-daily-workflow]]"
  - "[[git-recovery-and-undo]]"
  - "[[merge-vs-rebase-vs-squash]]"
  - "[[git-cheat-sheet]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Branching and Merging

Branching isolates work so that multiple features, fixes, and experiments can proceed in parallel without interfering with each other. Merging integrates completed work back into the main branch.

## Creating and Switching Branches

```bash
# Create and switch to a new branch
git checkout -b feature/pulse-chart-fix
# -b = create the branch if it doesn't exist

# Switch branches
git checkout main
# or: git switch main (modern syntax, less overloaded than checkout)
```

## Stashing Uncommitted Work

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

See [[merge-vs-rebase-vs-squash]] for a detailed comparison.

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
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts and confusion. Only rebase local/private branches.

## Recovery Techniques

```bash
# Undo the last commit (keep the changes staged)
git reset --soft HEAD~1
# HEAD~1 = one commit back
# --soft = keep changes staged (ready to re-commit with a different message)

# Discard all uncommitted changes (⚠️ DESTRUCTIVE)
git checkout -- .
# Reverts all modified tracked files to the last commit
# Does NOT affect untracked files

# Recover from disaster (the reflog — Git's undo history)
git reflog
# Shows: every HEAD movement (commits, checkouts, resets, rebases)
# If you accidentally reset --hard or deleted a branch, the commits are still there
git checkout <hash-from-reflog>
# Recovers the "lost" commit — nothing in Git is truly deleted for 30 days
```

See [[git-recovery-and-undo]] for detailed recovery workflows.

## Related

- [[git-daily-workflow]] — Status, staging, committing, pushing
- [[git-recovery-and-undo]] — Detailed recovery techniques
- [[merge-vs-rebase-vs-squash]] — Comparison table of merge strategies
