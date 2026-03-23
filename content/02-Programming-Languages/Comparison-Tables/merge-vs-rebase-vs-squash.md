---
type: reference
category: reference
technology: [git]
tags: [git]
aliases: [merge vs rebase, rebase vs squash, git merge strategies]
keywords: [merge, rebase, squash, git, merge commit, fast-forward, history, linear, clean history, comparison]
description: "Comparison of Git merge strategies — standard merge, rebase, and squash merge — with guidance on when to use each."
related:
  - "[[git-branching-and-merging]]"
  - "[[pull-requests-and-code-review]]"
  - "[[git-daily-workflow]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Merge vs Rebase vs Squash

Three strategies for integrating changes from one branch into another. Each produces a different commit history shape.

## Comparison

| Strategy | History Shape | Preserves Individual Commits? | Creates Merge Commit? | Best For |
|----------|--------------|------|------|----------|
| **Merge** | Non-linear (merge commits) | Yes | Yes | Feature branches where commit history is meaningful |
| **Rebase** | Linear | Yes (replayed) | No | Keeping a clean, linear main branch |
| **Squash** | Linear (single commit) | No (collapsed into one) | No | Small features or fixups where individual commits add noise |

## Standard Merge

```bash
git checkout main
git merge feat/new-feature
```

Creates a merge commit that preserves the full branch topology. Both parent histories remain visible in `git log --graph`.

**Use when:** The branch has meaningful intermediate commits that reviewers or future debuggers will want to see.

## Rebase

```bash
git checkout feat/new-feature
git rebase main
git checkout main
git merge feat/new-feature  # fast-forward merge
```

Replays your commits on top of main's latest commit. Creates a linear history without merge commits.

> [!warning] Never Rebase Shared Branches
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts. Only rebase local/private branches.

**Use when:** You want a linear history and the branch is private to you.

## Squash Merge

```bash
git checkout main
git merge --squash feat/new-feature
git commit -m "feat: add new feature"
```

Collapses all branch commits into a single commit on main. The branch history is discarded.

**Use when:** The branch has many small "wip" or "fix typo" commits that add noise to main's history.

## Decision Guide

| Scenario | Recommended |
|----------|-------------|
| Multi-commit feature with meaningful history | Merge |
| Single developer, clean linear history preferred | Rebase |
| Many small fixup commits, only the end result matters | Squash |
| Hotfix with 1-2 commits | Rebase or Squash |
| Long-lived branch with many contributors | Merge |
