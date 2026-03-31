---
type: reference
category: reference
technology: [git]
tags: [git]
aliases: [merge vs rebase, rebase vs squash, git merge strategies]
keywords: [merge, rebase, squash, git, merge commit, fast-forward, history, linear, clean history, comparison]
description: "Comparison of Git merge strategies — standard merge, rebase, and squash merge — with guidance on when to use each."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Merge vs Rebase vs Squash

> [!quote]
> "I want clean history, but that really means (a) clean and (b) history."
>
> — **Linus Torvalds**, Git mailing list

Three strategies for integrating changes from one branch into another. Each produces a different commit history shape.

### Merge vs rebase vs squash — comparison table

| Strategy | History Shape | Preserves Individual Commits? | Creates Merge Commit? | Best For |
|----------|--------------|------|------|----------|
| **Merge** | Non-linear (merge commits) | Yes | Yes | Feature branches where commit history is meaningful |
| **Rebase** | Linear | Yes (replayed) | No | Keeping a clean, linear main branch |
| **Squash** | Linear (single commit) | No (collapsed into one) | No | Small features or fixups where individual commits add noise |

### git merge — standard merge with merge commit

A standard merge joins two branches by creating a new commit with two parents. It preserves the complete history of both branches — every individual commit on the feature branch remains visible in the log. This is the default merge behavior in Git.

```bash
git checkout main
git merge feat/new-feature
```

Creates a merge commit that preserves the full branch topology. Both parent histories remain visible in `git log --graph`.

**Use when:** The branch has meaningful intermediate commits that reviewers or future debuggers will want to see.

### git rebase — replay commits for linear history

Rebasing detaches your commits from where they originally branched off and replays them one by one on top of the target branch's latest commit. The result is a clean, linear history with no merge commits — as if you started your work after everyone else finished theirs. Because each replayed commit gets a new SHA, rebasing rewrites history.

```bash
git checkout feat/new-feature
git rebase main
git checkout main
git merge feat/new-feature  # fast-forward merge
```

Replays your commits on top of main's latest commit. Creates a linear history without merge commits.

> [!warning] Never Rebase Shared Branches
>
> Rebasing rewrites commit hashes. If others have pulled your branch, rebase will cause conflicts. Only rebase local/private branches.

**Use when:** You want a linear history and the branch is private to you.

### git merge --squash — collapse branch into single commit

Squash merging takes all the commits on a feature branch and condenses them into a single new commit on the target branch. The individual commit history from the branch is discarded — only the final combined result appears in the target's log. This is ideal when a branch has many small "work in progress" commits that would clutter the main branch history.

```bash
git checkout main
git merge --squash feat/new-feature
git commit -m "feat: add new feature"
```

Collapses all branch commits into a single commit on main. The branch history is discarded.

**Use when:** The branch has many small "wip" or "fix typo" commits that add noise to main's history.

> [!warning] Squash loses individual commit history
>
> After a squash merge, all individual commits on the feature branch are collapsed into one. If you need to bisect or revert a specific change from within that branch later, you cannot — you can only revert the entire squash commit. For branches with multiple meaningful changes, consider a standard merge or rebase instead.

> [!warning] Binary file merge conflicts
>
> Merge conflicts in binary files (images, compiled assets, Parquet files) cannot be resolved with text merge tools. Git will report the conflict but the file contents are meaningless to diff. You must choose one version entirely (`git checkout --ours file` or `git checkout --theirs file`) or replace the file manually.

### Decision guide — which merge strategy by scenario

| Scenario | Recommended |
|----------|-------------|
| Multi-commit feature with meaningful history | Merge |
| Single developer, clean linear history preferred | Rebase |
| Many small fixup commits, only the end result matters | Squash |
| Hotfix with 1-2 commits | Rebase or Squash |
| Long-lived branch with many contributors | Merge |
