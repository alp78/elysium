---
type: index
category: git
technology: [git, github]
tags: [index, git, github, version-control, ci-cd]
aliases: [Git Index, Git Section, Version Control Index, GitHub Index]
keywords: [git, github, version control, branching, merging, pull requests, code review, ci/cd, github actions, gitignore, tagging, remote, merge conflicts, troubleshooting]
description: "Index for all Git and GitHub notes covering setup, daily workflow, branching, merging, pull requests, CI/CD, conflict resolution, error troubleshooting, and release management."
related:
  - "[[Dashboard]]"
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

## Learning Path

1. [[git-setup-and-config]] — Understand concepts and configure Git
2. [[git-daily-workflow]] — Learn the daily add/commit/push cycle
3. [[gitignore-patterns]] — Keep secrets and build artifacts out of the repo
4. [[git-branching-and-merging]] — Work on features without breaking main
5. [[git-merge-conflicts]] — Resolve conflicts confidently
6. [[pull-requests-and-code-review]] — Collaborate through pull requests
7. [[git-remote-management]] — Manage remotes, forks, and upstream repos
8. [[git-history-and-inspection]] — Navigate and search project history
9. [[git-recovery-and-undo]] — Undo mistakes safely
10. [[git-tagging-and-releases]] — Tag releases for deployment
11. [[github-actions-ci-cd]] — Automate testing and deployment
12. [[git-common-errors]] — Reference when you hit an error

## Cross-References

- **Engineering Practice** — [[github-actions-workflows]] covers workflow patterns in more depth
- **CI/CD** — [[github-actions-ci-cd]] shows real CI/CD for data pipelines
- **Leadership** — [[leadership-and-collaboration]] covers code review as a leadership skill

```dataview
TABLE type, status, description
FROM "07-Git"
WHERE type != "index"
SORT file.name ASC
```
