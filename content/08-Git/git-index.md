---
type: index
category: git
technology: [git, github]
tags: [git]
aliases: [Git Index, Git Section, Version Control Index, GitHub Index]
keywords: [git, github, version control, branching, merging, pull requests, code review, ci/cd, github actions, gitignore, tagging, remote, merge conflicts, troubleshooting]
description: "Index for all Git and GitHub notes covering setup, daily workflow, branching, merging, pull requests, CI/CD, conflict resolution, error troubleshooting, and release management."
related:
  - "[[index|Elysium]]"
  - "[[github-actions-workflows]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git and GitHub

Git is the version control system; GitHub is the collaboration platform. Together they form the coordination layer for every data engineering team — code review, schema migrations, automated deployments, and cross-timezone handoffs all flow through Git. This section covers everything from initial setup to advanced troubleshooting.

## Setup and Concepts

| Note | Description |
|------|-------------|
| [[git-setup-and-config]] | Core Git concepts (repository, commit, branch, HEAD, SHA), initial configuration, creating and cloning repos |

## Daily Workflow

| Note | Description |
|------|-------------|
| [[git-daily-workflow]] | Status, diff, staging, committing, pushing, pulling — the commands you run every day |
| [[gitignore-patterns]] | Pattern syntax, common templates, stop tracking files, remove accidentally committed secrets |

## Branching and Merging

| Note | Description |
|------|-------------|
| [[git-branching-and-merging]] | Branch creation, switching, deletion, merge strategies, stashing |
| [[git-merge-conflicts]] | Conflict markers, step-by-step resolution, merge abort, VS Code mergetool, rebase conflicts, prevention |

## Collaboration

| Note | Description |
|------|-------------|
| [[pull-requests-and-code-review]] | PR creation, review checklists, branch protection, squash merge, real-world rebase case study |
| [[git-remote-management]] | Remotes, upstream forks, fetch vs pull, fetch --prune, force-with-lease safe push |
| [[git-tagging-and-releases]] | Lightweight vs annotated tags, semantic versioning, pushing tags, tag-driven CI/CD |

## History and Inspection

| Note | Description |
|------|-------------|
| [[git-history-and-inspection]] | Log formatting, blame, show, diff, bisect, pickaxe search |

## Recovery and Troubleshooting

| Note | Description |
|------|-------------|
| [[git-recovery-and-undo]] | Restore, revert, reset, reflog, cherry-pick, interactive rebase, recovering lost work |
| [[git-common-errors]] | 25+ error scenarios with exact error messages, causes, and fixes |
| [[git-problems]] | Additional Git problem scenarios and solutions |

## CI/CD

| Note | Description |
|------|-------------|
| [[github-actions-ci-cd]] | Workflow triggers, secrets, matrix builds, Cloud Run deploy, Terraform CI, troubleshooting |

See also: [[git-cheat-sheet]]

## Key Concepts

- **[[git-setup-and-config]]** — Start here if you are new to Git
- **[[git-daily-workflow]]** — The 5-command cycle you repeat dozens of times per day
- **[[pull-requests-and-code-review]]** — How distributed data teams coordinate safely
- **[[git-common-errors]]** — When something goes wrong, this is your first stop

## Cross-References

- **Engineering Practice** — [[github-actions-workflows]] covers workflow patterns in more depth
- **CI/CD** — [[github-actions-ci-cd]] shows real CI/CD for data pipelines
- **Leadership** — [[leadership-and-collaboration]] covers code review as a leadership skill

> *This table renders in Obsidian via Dataview. On the web, browse the notes listed above or use the Explorer sidebar.*
