---
title: "MOC: Git"
tags:
  - moc
  - git
  - version-control
---

# MOC: Git

Git is the version control backbone for every pipeline, DAG, migration, and Terraform module in the data platform. This MOC organizes the section into three workflow stages: daily commands, branching and collaboration, and recovery and reference material.

## Daily Workflow — Setup, Staging, Committing, and Pushing

The commands you run dozens of times per day. Start here to understand Git's core concepts, configure your identity, and master the add/commit/push cycle.

* [[git-setup-and-config]] — Git vocabulary glossary, initial identity and global configuration, repository creation with git init, and cloning variants including shallow clone for CI/CD

* [[git-daily-workflow]] — the full daily cycle from git status through staging, committing with conventional commit messages, pushing, pulling with rebase, the feature branch workflow, and interactive staging with git add -p

* [[gitignore-patterns]] — .gitignore syntax for Python data engineering projects, stopping tracking on already-committed files with git rm --cached, and emergency response when secrets are accidentally committed

## Branching & Collaboration — Branches, Merging, Remotes, PRs, and Tags

How teams work in parallel without stepping on each other. Covers branch creation and switching, merge strategies, remote management, pull request workflows, conflict resolution, and tagging releases.

* [[git-branching-and-merging]] — creating and switching branches, stashing work, merge commits vs fast-forward vs squash, rebasing onto main, and when to choose each merge strategy

* [[git-remote-management]] — viewing and adding remotes, fetching and pruning stale branches, safely force-pushing with --force-with-lease after a rebase, and synchronizing forks with upstream

* [[git-merge-conflicts]] — conflict marker syntax, step-by-step resolution process, git mergetool with VS Code, rebase conflict resolution, and prevention strategies

* [[pull-requests-and-code-review]] — creating PRs with GitHub CLI, squash merge and rebase merge workflows, branch protection rules, handling diverged branches, and resolving not-mergeable errors

* [[git-tagging-and-releases]] — lightweight vs annotated tags, pushing tags to GitHub, semantic versioning conventions, and marking production releases

## Recovery & Reference — Undo, History, Errors, and Quick Reference

When things go wrong, and the tools for investigating what happened. Covers every undo method from safe to destructive, history inspection, common error messages, and the full cheat sheet.

* [[git-history-and-inspection]] — git log with filters, graph views, and date ranges, git diff for staged and unstaged changes, git blame for line-by-line authorship, and git show for individual commits

* [[git-recovery-and-undo]] — the undo decision tree, git restore for unstaging, git revert for safe public undo, git reset --soft/--mixed/--hard, reflog for recovering lost commits, and stash for temporary shelving

* [[git-common-errors]] — diagnostic reference for error messages like non-fast-forward, detached HEAD, permission denied, refusing to merge unrelated histories, and push rejected after rebase

* [[git-problems]] — 25 Git and GitHub problems in distributed teams ranked by severity, from secrets committed to repository through force-push to main, with root cause analysis and recovery procedures

* [[git-cheat-sheet]] — exhaustive CLI reference for every Git and GitHub CLI command covering config, staging, committing, branching, merging, rebasing, remotes, history, stashing, undo, and tags

## Cross-References

- [[github-actions-workflows]] — Workflow patterns for GitHub Actions in depth
- [[github-actions-ci-cd]] — Real CI/CD pipelines for data engineering deployments
- [[leadership-and-collaboration]] — Code review as a leadership and collaboration skill
