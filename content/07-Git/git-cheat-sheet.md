---
type: reference
category: reference
technology: [git]
tags: [reference, cheat-sheet, git]
aliases: [Git cheat sheet, git quick reference]
keywords: [git, cheat sheet, quick reference, status, add, commit, push, pull, branch, merge, rebase, stash, reset, revert, log, diff, blame]
description: "Quick reference cheat sheet for daily Git operations — status, staging, committing, branching, merging, and recovery."
related:
  - "[[git-daily-workflow]]"
  - "[[git-branching-and-merging]]"
  - "[[git-recovery-and-undo]]"
  - "[[pull-requests-and-code-review]]"
  - "[[git-common-errors]]"
  - "[[git-setup-and-config]]"
  - "[[git-remote-management]]"
  - "[[git-tagging-and-releases]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Cheat Sheet

## Daily Workflow

```bash
git status                         # Show working tree status
git diff                           # Unstaged changes
git diff --staged                  # Staged changes
git add FILE                       # Stage specific file
git commit -m "feat: description"  # Commit with conventional message
git push origin BRANCH             # Push to remote
git pull --rebase origin main      # Pull with rebase (clean history)
```

See [[git-daily-workflow]].

## Branching

```bash
git branch                         # List local branches
git branch -a                      # List all (including remote)
git checkout -b feat/new-feature   # Create and switch
git switch feat/new-feature        # Switch (modern syntax)
git branch -d BRANCH               # Delete merged branch
git branch -D BRANCH               # Force delete unmerged branch
```

## Merging

```bash
git merge BRANCH                   # Standard merge (creates merge commit)
git rebase main                    # Rebase current branch onto main
git merge --squash BRANCH          # Squash all commits into one
```

See [[git-branching-and-merging]].

## Recovery

```bash
git stash                          # Stash uncommitted changes
git stash pop                      # Restore stashed changes
git reset --soft HEAD~1            # Undo last commit, keep changes staged
git revert COMMIT                  # Create inverse commit (safe)
git reflog                         # View all HEAD movements (disaster recovery)
git checkout COMMIT -- FILE        # Restore specific file from commit
```

See [[git-recovery-and-undo]].

## History

```bash
git log --oneline -20              # Last 20 commits, compact
git log --graph --oneline --all    # Visual branch graph
git diff main..BRANCH              # Changes between branches
git blame FILE                     # Who changed each line
git show COMMIT                    # Full commit details
```

See [[git-history-and-inspection]].

## GitHub CLI

```bash
gh pr create --title "Title" --body "Description"  # Create PR
gh pr list                         # List open PRs
gh pr checkout NUMBER              # Check out PR locally
gh pr merge NUMBER --squash        # Squash merge PR
gh workflow run WORKFLOW            # Trigger workflow manually
```

See [[pull-requests-and-code-review]].

## Branch Naming Convention

| Prefix | Use |
|--------|-----|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code restructuring |
| `docs/` | Documentation |
| `chore/` | Maintenance |
| `hotfix/` | Urgent production fix |
