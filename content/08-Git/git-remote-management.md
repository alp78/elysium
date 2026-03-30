---
type: how-to
category: git
technology: [git, github]
tags: [git, github]
aliases: [git remote, git fetch, upstream, force-with-lease, fork workflow, git remote -v, git fetch origin, git fetch prune, safe force push, origin remote]
keywords: [git remote, remote repositories, git fetch, git push, fetch prune, force-with-lease, upstream, fork, origin, remote tracking, git remote add, git remote -v, prune deleted branches, safe push, overwrite remote branch, fork workflow, synchronize fork]
description: "How to manage git remote connections — view, add, fetch, prune, and safely force-push to remote repositories including upstream fork synchronization."
related: ["[git-daily-workflow](/08-Git/git-daily-workflow)", "[git-branching-and-merging](/08-Git/git-branching-and-merging)", "[pull-requests-and-code-review](/08-Git/pull-requests-and-code-review)", "[git-recovery-and-undo](/08-Git/git-recovery-and-undo)"]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Remote Repository Management

Git remotes are named references to copies of a repository hosted on a server (typically GitHub). Every cloned repo starts with one remote — `origin` — pointing at the URL you cloned from. Forked repos commonly add a second remote called `upstream` to track the original project. This note covers every essential remote operation: inspecting remotes, adding new ones, fetching, pruning stale branches, and safely force-pushing after a rebase.

## Viewing Configured Remotes

#### git remote -v — show all configured remotes and URLs

```bash
git remote -v
```

- `remote` — manage remote connections
- `-v` — verbose: show both fetch and push URLs for each remote

Typical output after cloning from a fork:

```
origin    https://github.com/your-username/repo.git (fetch)
origin    https://github.com/your-username/repo.git (push)
upstream  https://github.com/original-org/repo.git (fetch)
upstream  https://github.com/original-org/repo.git (push)
```

> [!abstract] What origin Means
>
> What "origin" means.
> `origin` is just the conventional default name Git assigns to the remote you cloned from. It is not special — you can rename it. `upstream` is the community convention for the original repo when working with a fork.

## Adding a Remote (Fork Workflow)

#### git remote add upstream — register a fork's upstream remote

```bash
git remote add upstream https://github.com/original/repo.git
```

- `add` — register a new named remote
- `upstream` — the name assigned to this remote (convention for the original repo you forked from)
- `https://...` — the URL of the remote repository

This is step one in the fork workflow. After adding `upstream`, you can fetch changes from the original project and merge them into your fork.

### Fork Workflow Explained

When you fork a repository on GitHub, your fork becomes `origin`. The original repository becomes `upstream`. The typical workflow:

1. Fork the repo on GitHub
2. Clone your fork: `git clone https://github.com/your-username/repo.git`
3. Add the original as upstream: `git remote add upstream https://github.com/original/repo.git`
4. Fetch upstream changes: `git fetch upstream`
5. Merge upstream into your local main: `git merge upstream/main`
6. Push the updated main to your fork: `git push origin main`
7. Create feature branches off your updated main and open PRs against `upstream`

> [!tip] Verify after adding
>
> Run `git remote -v` after `git remote add` to confirm both `origin` and `upstream` are listed correctly before fetching.

## Fetching: Download Without Merging

#### git fetch origin — download new branches without touching working files

```bash
git fetch origin
```

- `fetch` — download remote refs and objects without modifying your working directory or local branches
- `origin` — the remote name to fetch from

Fetch is always safe. It updates your remote-tracking branches (e.g., `origin/main`) but never changes your local branches or working files. Use it to inspect what's new before deciding to merge or rebase.

> [!info] Fetch vs Pull
>
> `git pull` = `git fetch` + `git merge` in one step. Prefer `git fetch` when you want to inspect changes first. Use `git pull` when you trust the incoming changes and want to integrate immediately. See [git-daily-workflow](/08-Git/git-daily-workflow) for the full daily workflow.

## Pruning: Clean Up Deleted Remote Branches

#### git fetch --prune — remove stale remote-tracking references

```bash
git fetch --prune
```

- `--prune` — after fetching, delete any local remote-tracking branches that no longer exist on the remote

When teammates delete branches on GitHub (e.g., after merging a PR), those branches linger in your local repo as `origin/feat/old-branch`. `--prune` cleans them up.

> [!tip] Make pruning automatic
>
> Configure Git to always prune on fetch:
> ```bash
> git config --global fetch.prune true
> ```
> After this, every `git fetch` automatically prunes without needing the flag.

## Safe Force-Push After Rebase

#### git push --force-with-lease — safe force-push after rebase

```bash
git push --force-with-lease
```

- `--force-with-lease` — overwrite the remote branch with your local branch, BUT only if the remote branch still matches what you last fetched. If someone else pushed in the meantime, the push is rejected.

This is the correct way to push a branch after rebasing. Rebasing rewrites commit SHAs, which means a normal `git push` will be rejected (the remote and local histories have diverged). `--force-with-lease` resolves this while protecting teammates.

> [!warning] Never Force-Push Shared Branches
>
> Never force-push to main or shared branches.
> `git push --force` and `git push --force-with-lease` overwrite remote history. They are only safe on your own personal feature branches. **Never force-push to `main`, `master`, or any branch other people have checked out.** If `main` needs a commit removed, use `git revert` instead — see [git-recovery-and-undo](/08-Git/git-recovery-and-undo).

### Difference Between --force and --force-with-lease

| Command | Behaviour |
|---------|-----------|
| `git push --force` | Unconditionally overwrites the remote branch. Dangerous. |
| `git push --force-with-lease` | Overwrites only if the remote branch tip matches your last-fetched state. Rejects if someone else pushed. |

Always use `--force-with-lease`. The only reason to use bare `--force` is if you deliberately want to discard someone else's pushed commits, which is almost never the right call.

> [!warning] force-with-lease Requires Recent Fetch
>
> `--force-with-lease` checks against your last-fetched remote state. If you haven't fetched in hours, someone else's push won't be detected — the lease is stale. Always run `git fetch origin` immediately before `git push --force-with-lease` to ensure you have the latest remote state.

### Common Force-Push Scenario: Rebase Then Push

After rebasing your feature branch onto the latest main (to resolve PR merge conflicts), the standard sequence is:

```bash
git fetch origin main
git rebase origin/main
# resolve any conflicts, then:
git push --force-with-lease origin feat/your-branch
```

See [git-branching-and-merging](/08-Git/git-branching-and-merging) for the full rebase workflow and [git-merge-conflicts](/08-Git/git-merge-conflicts) for conflict resolution during rebase.

### Quick Reference: Remote Commands

| Goal | Command |
|------|---------|
| List remotes | `git remote -v` |
| Add upstream remote | `git remote add upstream <URL>` |
| Rename a remote | `git remote rename origin old-origin` |
| Remove a remote | `git remote remove upstream` |
| Fetch all remotes | `git fetch --all` |
| Fetch and prune | `git fetch --prune` |
| Safe force-push | `git push --force-with-lease` |
| Delete remote branch | `git push origin --delete feat/branch-name` |

## Related

- [git-daily-workflow](/08-Git/git-daily-workflow) — everyday fetch, pull, push cycle
- [git-branching-and-merging](/08-Git/git-branching-and-merging) — rebase workflow that requires force-push
- [pull-requests-and-code-review](/08-Git/pull-requests-and-code-review) — PRs and the fork contribution model
- [git-merge-conflicts](/08-Git/git-merge-conflicts) — resolving conflicts during rebase before force-pushing
- [git-recovery-and-undo](/08-Git/git-recovery-and-undo) — `git revert` as the safe alternative to force-push on shared branches
