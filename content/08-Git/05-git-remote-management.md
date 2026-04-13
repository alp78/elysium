---
title: "05 - Git Remote Repository Management"
tags:
  - git
  - version-control
---

# Git Remote Repository Management

> [!quote]
> "When there is no central 'master' location that contains the source code, you can suddenly host things without the politics that go along with that 'one repo to rule them all' concept."
>
> — **Linus Torvalds**, Git mailing list

> [!abstract]- Summary
>
> Explains how a local Git clone connects to shared repositories through named remotes, remote-tracking refs, and authentication, then shows how to inspect, add, prune, retarget, and push safely across multi-remote workflows.
>
> **Remote model and inspection**
> - Defines remotes, `origin`, `upstream`, remote-tracking branches, tracking relationships, and remote `HEAD`, then inspects configured remotes and fetch state before changing anything
> - Distinguishes local branch state from fetched remote references so the note's commands are read as synchronization controls rather than as magic server updates
>
> **Remote topology and synchronization**
> - Adds, renames, removes, and rewrites remotes; compares single-remote, fork, and multi-remote topologies; and covers fetch-only updates, branch tracking, pruning, and default-branch maintenance
> - Explains how local branches connect to remote counterparts and how stale remote refs accumulate if teams never prune after deletions or renames
>
> **Pushing, deletion, and authentication**
> - Deletes remote branches, force-pushes safely after rebase, and compares HTTPS, PAT, SSH, and URL-management patterns for secure day-to-day remote operations
> - Extends the model to data-engineering repositories where mirroring, deployment remotes, and automation accounts complicate what `push` or `fetch` should target
>
> **Operations and safety**
> - Warnings: mismatched remote URLs, wrong-target pushes, stale remote-tracking branches, default-branch drift, and authentication changes that silently break automation
> - Recommendations: fetch before comparing, prune regularly, name remotes by role, and keep authentication material outside repository config where possible
> - Troubleshooting: remote URL, tracking, auth, pruning, and post-rebase push failures

> [!note]- Glossary
>
> **remote**
> - A named reference to another copy of the repository hosted on a server. Stored in `.git/config` as a URL with a short alias (e.g., `origin`).
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **origin**
> - The default name Git assigns to the remote you cloned from. It is a convention, not a reserved keyword — it can be renamed.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **upstream**
> - The community convention for the original repository when working with a fork. Your fork is `origin`; the project you forked from is `upstream`.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **remote-tracking branch**
> - A local read-only reference (e.g., `origin/main`) that records the state of a branch on a remote at the time of the last fetch. Updated by `git fetch`, never by local commits.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **fetch**
> - Download new commits and refs from a remote into remote-tracking branches without modifying your working directory or local branches. Always safe.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **pull**
> - A compound operation: `git fetch` followed by `git merge` (or `git rebase` if configured). Integrates remote changes into your current branch.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!warning] History rewrite risk
> >
> > This changes or depends on rewritten history. Verify branch ownership and remote state before using the destructive variant of any related command.
>
> ---
>
> **push**
> - Upload local commits to a remote branch. Rejected if the remote has diverged unless force-pushing.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!warning] History rewrite risk
> >
> > This changes or depends on rewritten history. Verify branch ownership and remote state before using the destructive variant of any related command.
>
> ---
>
> **clone**
> - Create a local copy of a remote repository. Sets up `origin` automatically and checks out the default branch.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **fork**
> - A server-side copy of a repository under your own account (GitHub feature). The original becomes `upstream`; your fork becomes `origin`.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **stale ref**
> - A remote-tracking branch that still exists locally but whose corresponding branch has been deleted on the remote. Removed by `git fetch --prune`.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **force-push**
> - Overwrite the remote branch with your local history. `--force` does it unconditionally; `--force-with-lease` adds a safety check.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!warning] History rewrite risk
> >
> > This changes or depends on rewritten history. Verify branch ownership and remote state before using the destructive variant of any related command.
>
> ---
>
> **lease**
> - The last-fetched state of a remote branch. `--force-with-lease` compares the current remote tip against this lease — if they differ, someone else pushed and the force-push is rejected.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] History rewrite risk
> >
> > This changes or depends on rewritten history. Verify branch ownership and remote state before using the destructive variant of any related command.
>
> ---
>
> **tracking branch**
> - A local branch configured to follow a remote-tracking branch. Enables `git pull` and `git push` without specifying the remote and branch name every time. Set with `git push -u` or `git branch --set-upstream-to`.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **pushurl**
> - A separate URL used only for `git push`, overriding the default remote URL for writes while leaving the fetch URL unchanged. Configured with `git remote set-url --push <name> <url>`. Stored as `pushurl` in `.git/config`.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior ask you to choose or interpret this operation deliberately instead of treating nearby Git commands as interchangeable.
>
> > [!info] Policy layer
> >
> > This term usually belongs to shared repository policy or machine defaults. Fixing it locally can hide the real team-wide setting if you do not check the whole policy chain.
>
> ---
>
> **origin/HEAD**
> - A symbolic ref that points to the default branch of a remote (e.g., `origin/HEAD → origin/main`). Set during `git clone` and updated with `git remote set-head`. Used by commands that need to resolve "the remote's default branch" without naming it explicitly.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **mirror**
> - A bare clone that replicates all refs (branches, tags, notes) from a source repository. Created with `git clone --mirror` and updated with `git remote update`. Used for disaster recovery and geographic distribution.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!warning] Pointer semantics matter
> >
> > Git stores this as reference state rather than as a second copy of files. Many confusing behaviors come from moving refs while file contents stay the same.
>
> ---
>
> **deploy key**
> - An SSH key pair scoped to a single repository, granting either read-only or read-write access. Used by CI bots and automation scripts. Cannot be shared across repositories on GitHub.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!danger] Security boundary
> >
> > This term touches authentication, identity, or trust. Treat it as secret or policy material rather than as ordinary repository metadata.
>
> ---
>
> **host alias**
> - An entry in `~/.ssh/config` that maps a custom hostname (e.g., `github-work`) to a real server (`github.com`) with a specific SSH key. Enables multi-account access to the same server.
> - It matters in this note because the workflows for remote inspection, synchronization, branch tracking, and safe push behavior read or change this part of Git's state directly, and misunderstanding it leads to the wrong command or the wrong safety assumption.
>
> > [!danger] Security boundary
> >
> > This term touches authentication, identity, or trust. Treat it as secret or policy material rather than as ordinary repository metadata.

> [!example] Remote Topology Fit
>
> > [!success] Appropriate
> >
> > - Use this note when inspecting or changing remote configuration, onboarding to fork workflows, repairing tracking relationships, or cleaning stale server references.
> > - Use it when local branch state, remote-tracking refs, authentication, and push targets need to be untangled before someone updates the wrong server.
> > - Use it to reason about multi-remote layouts, pruning, default-branch drift, and safe post-rebase push behavior.
>
> > [!failure] Inappropriate
> >
> > - Do not force-push shared branches without lease protection and explicit ownership of the rewrite.
> > - Do not delete remote branches until merged state, active PRs, and deployment impact have been confirmed.
> > - Do not treat `origin` as automatically correct; verify the actual remote role and URL before pushing.

## Conceptual Model

Before running any remote commands, understand the relationship between your working directory, local branches, remote-tracking branches, and the remote server.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    WD["Working Directory<br/>(files on disk)"]
    IDX["Staging Area / Index<br/>(git add)"]
    LOCAL["Local Branches<br/>(main, feature/*)"]
    RTB["Remote-Tracking Branches<br/>(origin/main, upstream/main)"]
    REMOTE["Remote Server<br/>(GitHub / GitLab)"]

    WD -->|"git add"| IDX
    IDX -->|"git commit"| LOCAL
    LOCAL -->|"git push"| REMOTE
    REMOTE -->|"git fetch"| RTB
    RTB -->|"git merge / rebase"| LOCAL
    REMOTE -->|"git pull (fetch + merge)"| LOCAL
```

*Remote-tracking branches are the bridge between local and remote. `git fetch` updates them from the server. `git merge` or `git rebase` integrates those updates into your local branches. `git push` sends your local commits to the server. The working directory and staging area are never touched by fetch — only by merge, rebase, or checkout.*

> [!info] Remote-Tracking Branches Are Read-Only Snapshots
>
> You cannot commit directly to `origin/main`. It is a local pointer that Git updates during `git fetch` to reflect the remote's state. To integrate remote changes into your work, you merge or rebase from the remote-tracking branch into your local branch.

## Viewing Configured Remotes

A remote is a named connection stored in `.git/config` that maps a short alias to a URL. Every cloned repository starts with one remote — `origin` — pointing at the URL used during `git clone`. Inspecting remotes tells you where your data goes when you push and where it comes from when you fetch.

### Git | remote | inspect and manage named remote connections

`git remote` lists and manages named remote connections. Without flags it prints remote names only. With `-v` it shows the full fetch and push URLs. With `show` it provides detailed tracking and push configuration.

#### List all remotes with fetch and push URLs

**When to run:** When you need to verify which remotes are configured and where they point.
**Trigger:** Start of work on a new clone, after adding or modifying remotes, or when diagnosing push/fetch failures.
**Context:** Local read-only command. No network access, no state change.
**Purpose:** Confirm the remote alias-to-URL mapping before running any network operations.

*Print every configured remote with both its fetch URL (used by `git fetch`) and push URL (used by `git push`).*

```bash
git remote -v
```

```text
origin	https://github.com/alp78/git-lab.git (fetch)
origin	https://github.com/alp78/git-lab.git (push)
```

> [!info] Fetch and Push URLs Can Differ
>
> By default, fetch and push URLs are identical. Some organizations configure separate push URLs (e.g., an internal mirror for reads, GitHub for writes) using `git remote set-url --push <name> <url>`. The `-v` output shows both so you can verify the routing.

#### Show detailed remote information

**When to run:** When you need to see which branches are tracked, which local branches are configured for pull/push, and whether any refs are stale.
**Trigger:** Diagnosing why `git pull` targets the wrong branch, or verifying branch tracking configuration after setup.
**Context:** Requires network access to query the remote for HEAD and branch state. Read-only.
**Purpose:** Full diagnostic of the remote connection including branch tracking, push targets, and stale-ref detection.

*Display the fetch/push URLs, tracked remote branches, local pull/push configuration, and HEAD branch for a named remote.*

```bash
git remote show origin
```

```text
* remote origin
  Fetch URL: https://github.com/alp78/git-lab.git
  Push  URL: https://github.com/alp78/git-lab.git
  HEAD branch: main
  Remote branches:
    demo/force-push-lease tracked
    demo/remote-ops       tracked
    feat/add-signals      tracked
    main                  tracked
  Local branches configured for 'git pull':
    demo/force-push-lease  merges with remote demo/force-push-lease
    demo/remote-ops        merges with remote demo/remote-ops
    feat/add-signals       merges with remote feat/add-signals
    main                   merges with remote main
  Local refs configured for 'git push':
    demo/force-push-lease pushes to demo/force-push-lease (up to date)
    demo/remote-ops       pushes to demo/remote-ops       (up to date)
    feat/add-signals      pushes to feat/add-signals      (up to date)
    main                  pushes to main                  (up to date)
```

The output is divided into four sections: URLs, remote branches known to your local clone, local branches configured for `git pull` (merge targets), and local refs configured for `git push` (push targets with sync status). The `(up to date)` / `(fast-forwardable)` / `(local out of date)` annotations tell you whether a push or pull is needed.

#### Get the URL of a specific remote

**When to run:** When you need the raw URL for scripting, CI configuration, or verifying the connection target.
**Trigger:** Automating clone/push operations in CI, or confirming which server a remote points to.
**Context:** Local read-only. No network access.
**Purpose:** Retrieve the URL without the formatting overhead of `git remote -v`.

*Print only the URL for the named remote.*

```bash
git remote get-url origin
```

```text
https://github.com/alp78/git-lab.git
```

#### List remote refs without cloning

**When to run:** When you need to inspect what branches and tags exist on a remote without cloning or fetching the full repository.
**Trigger:** Pre-clone inspection, CI branch existence checks, or verifying tag availability before a release.
**Context:** Network read-only. Does not modify any local state. Works even outside a Git repository.
**Purpose:** Enumerate all refs (branches, tags) on a remote server with their current commit SHAs.

*Print all branch heads on the remote with their commit SHAs.*

```bash
git ls-remote --heads origin
```

```text
a2c074528b2d8465aec65ab585e197ea74b4d0af	refs/heads/demo/force-push-lease
f89093f7f8347cf1f8d5c6c0f42e0cc859abc5ea	refs/heads/feat/add-signals
102afc6767649c5b5fa008b000d4d22d0e3a7d62	refs/heads/main
```

Each line shows the full SHA of the branch tip and the ref path. This is useful for CI scripts that need to check whether a branch exists before attempting to check it out or merge from it.

| Flag | Syntax | Description |
|---|---|---|
| `-v` | `git remote -v` | Show fetch and push URLs for each remote |
| `add` | `git remote add <name> <url>` | Register a new named remote |
| `rename` | `git remote rename <old> <new>` | Rename an existing remote (updates all tracking refs) |
| `remove` | `git remote remove <name>` | Remove a remote and delete all its tracking branches |
| `get-url` | `git remote get-url <name>` | Print the URL for a remote |
| `set-url` | `git remote set-url <name> <url>` | Change the URL of an existing remote |
| `set-url --push` | `git remote set-url --push <name> <url>` | Set a separate push URL (fetch URL stays unchanged) |
| `show` | `git remote show <name>` | Detailed info: tracked branches, fetch/push URLs, tracking config |
| `prune` | `git remote prune <name>` | Delete stale remote-tracking refs without fetching |

## Adding and Managing Remotes

Registering a remote tells Git where to find another copy of the repository. The most common use case is the fork workflow, where you connect your fork (`origin`) to the original project (`upstream`) so you can pull in upstream changes. Other use cases include adding deployment remotes, staging servers, or mirror repositories.

### Git | remote add | register a new named remote connection

`git remote add` creates a named alias for a remote URL. It does not download anything — it only records the connection in `.git/config`. Use `git fetch` afterward to download objects and update remote-tracking branches.

#### Add an upstream remote for a fork

**When to run:** Immediately after cloning your fork, before starting any work.
**Trigger:** You forked a repository on GitHub and need to track the original project's changes.
**Context:** Local config change only. No network access. No data downloaded.
**Purpose:** Register the original repository so you can fetch its changes and keep your fork synchronized.

*Register the original repository as `upstream` so you can fetch and merge changes from the source project into your local copy.*

```bash
git remote add upstream https://github.com/alp78/git-lab.git
```

This command produces no output on success. Verify the result:

```bash
git remote -v
```

```text
origin	https://github.com/alp78/git-lab.git (fetch)
origin	https://github.com/alp78/git-lab.git (push)
upstream	https://github.com/alp78/git-lab.git (fetch)
upstream	https://github.com/alp78/git-lab.git (push)
```

> [!tip] Always Verify After Adding a Remote
>
> Run `git remote -v` after every `git remote add` to confirm both the name and URLs are correct. A typo in the URL will only surface later when `git fetch` or `git push` fails with a cryptic authentication or DNS error.

#### Rename an existing remote

**When to run:** When the current remote name is misleading or conflicts with team conventions.
**Trigger:** Reorganizing remote names after inheriting a repository, or aligning with team standards (e.g., renaming `origin` to `fork` when adding the canonical repo as the new `origin`).
**Context:** Local config change only. Updates all remote-tracking branch prefixes (e.g., `upstream/*` becomes `source/*`).
**Purpose:** Change the alias without removing and re-adding the remote.

*Rename the `upstream` remote to `source`. All remote-tracking branches under `upstream/` are automatically renamed to `source/`.*

```bash
git remote rename upstream source
```

```bash
git remote -v
```

```text
origin	https://github.com/alp78/git-lab.git (fetch)
origin	https://github.com/alp78/git-lab.git (push)
source	https://github.com/alp78/git-lab.git (fetch)
source	https://github.com/alp78/git-lab.git (push)
```

#### Change the URL of an existing remote

**When to run:** When the remote repository has moved to a different server, organization, or protocol (e.g., HTTPS to SSH).
**Trigger:** Organization migration, switching from HTTPS to SSH authentication, or correcting a typo in the URL.
**Context:** Local config change only. No network access.
**Purpose:** Update the connection target without removing the remote and losing tracking configuration.

*Change the URL for the `upstream` remote.*

```bash
git remote set-url upstream https://github.com/alp78/git-lab-upstream.git
```

*Verify the change.*

```bash
git remote get-url upstream
```

```text
https://github.com/alp78/git-lab-upstream.git
```

#### Set a separate push URL (split fetch/push)

**When to run:** When you need to fetch from one server but push to a different one — common in enterprise setups where engineers read from a canonical upstream but write to a fork or a different write endpoint.
**Trigger:** Fork workflows where `upstream` should be read-only, mirror setups where a read replica serves fetches but writes go to the primary, or CI configurations where builds fetch from a cache but push artifacts to a different remote.
**Context:** Local config change only. No network access. Modifies the `pushurl` entry in `.git/config` for the named remote. The fetch URL remains unchanged.
**Purpose:** Route `git fetch` and `git push` to different servers through a single remote alias.

By default, a remote has one URL used for both fetch and push. `git remote set-url --push` adds a separate `pushurl` entry, overriding only the push target while leaving the fetch URL intact.

*Configure the `upstream` remote to fetch from the canonical repository but push to your fork.*

```bash
git remote set-url --push upstream https://github.com/alp78/git-lab-fork.git
```

*Verify the split configuration.*

```bash
git remote -v
```

```text
origin	https://github.com/alp78/git-lab.git (fetch)
origin	https://github.com/alp78/git-lab.git (push)
upstream	https://github.com/alp78/git-lab.git (fetch)
upstream	https://github.com/alp78/git-lab-fork.git (push)
```

The `upstream` remote now fetches from the canonical repo (`git-lab.git`) but pushes to the fork (`git-lab-fork.git`). This is visible in `.git/config` as two separate entries:

```text
[remote "upstream"]
    url = https://github.com/alp78/git-lab.git
    pushurl = https://github.com/alp78/git-lab-fork.git
    fetch = +refs/heads/*:refs/remotes/upstream/*
```

> [!tip] When to Use Split URLs
>
> - **Fork workflow with a single remote alias:** Fetch upstream changes and push to your fork under one name. Avoids needing both `origin` and `upstream` remotes.
> - **Read replica / write primary:** Fetch from a fast internal mirror, push to the authoritative GitHub/GitLab instance.
> - **CI with artifact push:** CI fetches source from GitHub, pushes build artifacts or generated docs to a separate registry remote.

> [!warning] Split URLs Can Cause Confusion
>
> When fetch and push URLs differ, `git push` goes to a different server than `git fetch` retrieved from. If you forget the split configuration, you may push to the wrong destination. Always verify with `git remote -v` before the first push after configuring split URLs.

> [!success] Verify Split Configuration Before First Push
>
> Run `git remote -v` and confirm both URLs are correct. The `(fetch)` and `(push)` lines will show different URLs when a `pushurl` is configured.

#### Remove a remote

**When to run:** When a remote is no longer needed — the fork relationship ended, the server was decommissioned, or the remote was added by mistake.
**Trigger:** Cleanup after project restructuring, or removing a temporary deployment remote.
**Context:** Local config change. Deletes the remote entry from `.git/config` and removes all remote-tracking branches under that name (e.g., all `upstream/*` refs). Does not affect the remote server.
**Purpose:** Clean up local configuration and remove stale tracking refs.

*Remove the `upstream` remote and all its tracking branches.*

```bash
git remote remove upstream
```

```bash
git remote -v
```

```text
origin	https://github.com/alp78/git-lab.git (fetch)
origin	https://github.com/alp78/git-lab.git (push)
```

> [!warning] remote remove Deletes All Tracking Branches
>
> `git remote remove <name>` deletes every remote-tracking branch under that name (e.g., `upstream/main`, `upstream/develop`). If you have local branches tracking those refs, they will lose their upstream configuration.

> [!success] Re-add and Re-fetch to Restore
>
> If you removed a remote by mistake, re-add it with `git remote add <name> <url>` and run `git fetch <name>` to restore all tracking branches. No data is lost on the remote server — the deletion is purely local.

### Fork Workflow Explained

When you fork a repository on GitHub, your fork becomes `origin`. The original repository becomes `upstream`. Data flows from `upstream` into your local clone, then out to `origin`, and back to `upstream` via a pull request.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    UP["upstream/main<br/>(original repo)"] -->|"git fetch upstream<br/>+ git merge"| LOCAL["local main<br/>(synced)"]
    LOCAL -->|"git push origin main"| ORIGIN["origin/main<br/>(your fork)"]
    ORIGIN -->|"Pull Request"| UP
```

*The fork workflow forms a triangle: upstream flows into your local clone via fetch + merge, local pushes to your fork (origin), and origin contributes back to upstream via pull requests. Your local clone is the only place where upstream and origin converge.*

> [!todo] Sync Your Fork with Upstream
>
> 1. Fork the repository on GitHub (creates `origin` under your account)
> 2. Clone your fork: `git clone https://github.com/your-username/repo.git`
> 3. Add the original as upstream: `git remote add upstream https://github.com/original-org/repo.git`
> 4. Fetch upstream changes: `git fetch upstream`
> 5. Merge upstream into your local main: `git checkout main && git merge upstream/main`
> 6. Push the updated main to your fork: `git push origin main`
> 7. Create feature branches off your updated main and open PRs against `upstream`

## Remote Topology Models

Different team structures and deployment patterns require different remote configurations. Understanding these topologies helps you set up the right remotes for your workflow.

### Git | remote | common remote topology patterns

#### Single Central Remote (most common)

The simplest model: one remote (`origin`) shared by all team members. Everyone pushes to and fetches from the same repository. Branch protection rules on the server control who can merge to `main`.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    DEV1["Developer A"] -->|push / pull| ORIGIN["origin<br/>(shared repo)"]
    DEV2["Developer B"] -->|push / pull| ORIGIN
    DEV3["CI Bot"] -->|push / pull| ORIGIN
```

*All team members and CI bots interact with a single remote. This is the default for private repositories within an organization.*

#### Fork + Upstream (open source / cross-team)

Each contributor has their own fork (`origin`). The canonical project is `upstream`. Contributors fetch from `upstream`, push to `origin`, and submit pull requests back to `upstream`.

#### Multiple Deployment Remotes

Some teams add remotes for deployment targets — a staging server, a production server, or a documentation host. Each remote points to a different server that auto-deploys on push.

> [!example] Data Engineering: Multiple Deployment Remotes
>
> A data platform team might configure:
>
> - `origin` → GitHub (code review, CI/CD)
> - `staging` → GCP Cloud Source Repository (triggers Airflow DAG deployment to staging)
> - `production` → GCP Cloud Source Repository (triggers Airflow DAG deployment to production)
>
> ```bash
> git remote add staging https://source.developers.google.com/p/project-id/r/dags-staging
> git remote add production https://source.developers.google.com/p/project-id/r/dags-prod
> git push staging main    # deploys to staging
> git push production main # deploys to production (requires approval)
> ```

#### Mirror Remote (exact copy)

A mirror remote is a complete, exact copy of another repository — all branches, tags, and refs are replicated. Mirrors are used for disaster recovery, geographic distribution, or read-only backup.

```bash
git clone --mirror https://github.com/org/repo.git repo-mirror.git
```

A mirror clone creates a bare repository (no working directory) that tracks all refs from the source. To update the mirror:

```bash
cd repo-mirror.git
git remote update --prune
```

> [!info] Mirror vs Clone
>
> A regular `git clone` only creates remote-tracking branches for the remote's branches and checks out the default branch. A `git clone --mirror` copies all refs (branches, tags, notes, stash refs) exactly and configures the remote for `--mirror` push. The mirror is a bare repo — it has no working directory and is intended for replication, not development.

> [!tip] Mirror for Disaster Recovery
>
> Schedule `git remote update --prune` as a cron job on a mirror repository to maintain an up-to-date backup. If the primary repository is lost, the mirror can be promoted to primary by changing its URL in all developers' remotes.

#### Read-Only Remote

A read-only remote is a remote where the user has fetch permission but not push permission. This is the default for `upstream` in fork workflows — you fetch changes from the canonical repository but cannot push to it directly.

Read-only remotes are also used for:

- **Vendor repositories** — tracking an external dependency's source without write access
- **Compliance archives** — a remote that receives pushes only from a CI bot (humans have read-only access)
- **Reference repos** — shared template repositories that teams clone from but never push to

No special Git configuration is needed for a read-only remote — the access control is enforced server-side. If you accidentally try to push, Git returns `remote: Permission denied` or `remote: Repository not found` (GitHub returns "not found" for repositories where you lack push access).

#### Gerrit-Style Push-for-Review

Gerrit is a code review system used in Android, Chromium, and other large projects. Instead of pushing to a branch directly, developers push to a special ref that creates a code review (analogous to a pull request).

```bash
git push origin HEAD:refs/for/main
```

The `refs/for/main` ref is not a branch — it is a Gerrit review queue. Gerrit creates a change, assigns reviewers, and only merges to `main` after approval. This model enforces that **every commit is reviewed before it reaches any branch**, which is stricter than GitHub's PR model where you can push directly to branches you own.

> [!info] Gerrit vs GitHub/GitLab PR Model
>
> | Aspect | Gerrit | GitHub / GitLab |
> |---|---|---|
> | Review unit | Individual commits | Entire branch (PR/MR) |
> | Push target | `refs/for/<branch>` | Feature branch, then open PR |
> | Review granularity | Per-commit review and scoring | Per-PR review |
> | Merge | Submit after review scores pass | Merge button or CLI merge |
> | Amend workflow | `git commit --amend && git push` updates the same review | New commits added to PR |
>
> Gerrit is common in large-scale infrastructure projects with strict per-commit review requirements. Most data-engineering teams use GitHub or GitLab PR workflows instead.

## Fetching: Download Without Merging

`git fetch` downloads objects and refs from a remote without modifying your working directory or local branches. It is always safe — it only updates remote-tracking branches (e.g., `origin/main`), which are local read-only refs that reflect the remote's state at fetch time. This separation between downloading and integrating gives you full control over when and how changes enter your working branch.

### Git | fetch | download remote refs and objects

Use `git fetch` to inspect what has changed on the remote before deciding whether to merge or rebase. This is the foundation of the safe workflow: fetch first, inspect, then integrate.

#### Fetch all branches from a named remote

**When to run:** Before any merge, rebase, or push — to ensure your remote-tracking branches reflect the current remote state.
**Trigger:** Start of a work session, before integrating upstream changes, or before force-pushing.
**Context:** Network read. Updates remote-tracking branches only. Working directory and local branches are untouched.
**Purpose:** Bring your local view of the remote up to date without changing any of your own work.

*Download all new commits from `origin` and update remote-tracking branches.*

```bash
git fetch origin
```

```text
From https://github.com/alp78/git-lab
 * branch            main       -> FETCH_HEAD
```

When there are new commits on multiple branches, the output lists each updated ref:

```text
remote: Enumerating objects: 5, done.
remote: Counting objects: 100% (5/5), done.
remote: Compressing objects: 100% (3/3), done.
Unpacking objects: 100% (3/3), done.
From https://github.com/alp78/git-lab
   06f13ca..102afc6  main -> origin/main
```

The line `06f13ca..102afc6  main -> origin/main` means: the remote-tracking branch `origin/main` was advanced from commit `06f13ca` to `102afc6`. Your local `main` branch was not changed.

> [!info] Fetch vs Pull
>
> `git pull` = `git fetch` + `git merge` (or `git rebase` if configured) in one step. Prefer `git fetch` when you want to inspect changes first — you can review with `git log origin/main..main` or `git diff main origin/main` before integrating. Use `git pull` when you trust the incoming changes and want to integrate immediately.

#### Fetch from all configured remotes

**When to run:** When you have multiple remotes (e.g., `origin` and `upstream`) and need to update all of them in one operation.
**Trigger:** Start of a work session on a fork, or when synchronizing across multiple deployment remotes.
**Context:** Network read to all configured remotes. Updates all remote-tracking branches.
**Purpose:** Bring every remote-tracking branch up to date in a single command.

*Fetch from every configured remote.*

```bash
git fetch --all
```

```text
Fetching origin
Fetching upstream
From https://github.com/alp78/git-lab
   3c60ed4..102afc6  main       -> upstream/main
```

The output shows each remote being fetched in sequence. Only remotes with new data produce detailed output — remotes already up to date show only the `Fetching <name>` line.

| Flag | Syntax | Description |
|---|---|---|
| (none) | `git fetch <remote>` | Fetch all branches from the named remote |
| `--all` | `git fetch --all` | Fetch from every configured remote |
| `--prune` | `git fetch --prune` | Delete stale remote-tracking refs after fetching |
| `--depth` | `git fetch --depth=<n>` | Shallow fetch — only download the last N commits |
| `--unshallow` | `git fetch --unshallow` | Convert a shallow clone into a full clone |
| `--tags` | `git fetch --tags` | Also fetch all tags from the remote |
| `--no-tags` | `git fetch --no-tags` | Do not fetch tags (useful for CI to reduce clone size) |
| `--dry-run` | `git fetch --dry-run` | Show what would be fetched without making changes |
| `--force` | `git fetch --force` | Overwrite local remote-tracking refs even if non-fast-forward |
| `--jobs=<n>` | `git fetch --jobs=4` | Fetch from multiple remotes in parallel |

## Branch Tracking: Connecting Local and Remote Branches

A tracking branch is a local branch configured to follow a specific remote-tracking branch. When tracking is set up, `git pull` and `git push` work without specifying the remote and branch name — Git knows the default target. Tracking also enables `git status` to show how many commits your local branch is ahead of or behind the remote.

### Git | branch tracking | set and inspect upstream tracking

#### Set upstream tracking on first push

**When to run:** When pushing a new local branch to a remote for the first time.
**Trigger:** You created a local branch (`git checkout -b feature/x`) and need to publish it to the remote.
**Context:** Network write. Creates the branch on the remote and configures the local branch to track it.
**Purpose:** Establish the bidirectional link between local and remote branches so future `git push` and `git pull` work without arguments.

*Push the branch and set it to track the remote counterpart.*

```bash
git push -u origin demo/remote-ops
```

```text
remote:
remote: Create a pull request for 'demo/remote-ops' on GitHub by visiting:
remote:      https://github.com/alp78/git-lab/pull/new/demo/remote-ops
remote:
To https://github.com/alp78/git-lab.git
 * [new branch]      demo/remote-ops -> demo/remote-ops
branch 'demo/remote-ops' set up to track 'origin/demo/remote-ops'.
```

The `-u` (or `--set-upstream`) flag does two things: pushes the branch and configures the tracking relationship. After this, `git push` and `git pull` on this branch work without specifying `origin demo/remote-ops`.

#### Inspect branch tracking configuration

**When to run:** When you need to see which local branches track which remote branches, and their sync status.
**Trigger:** Diagnosing why `git push` or `git pull` fails with "no upstream configured", or auditing branch tracking after repository reorganization.
**Context:** Local read-only. No network access.
**Purpose:** See the full mapping of local branches to remote-tracking branches, including ahead/behind counts and `[gone]` markers for deleted remote branches.

*Show all local branches with their tracking information and sync status.*

```bash
git branch -vv
```

```text
  demo/force-push-lease   a2c0745 [origin/demo/force-push-lease] fix: rate limiter threshold
  demo/remote-ops         7ab2d9d [origin/demo/remote-ops: gone] feat: add fetch_data stub
  feat/add-signals        f89093f [origin/feat/add-signals] feat: add moving average function to signals
  feat/airflow-dags       cf7a765 [origin/feat/airflow-dags: gone] feat: add airflow DAG stubs
  feat/terraform-modules  d39180d [origin/feat/terraform-modules: gone] feat: add terraform module stubs
  feature/data-validator  fced9c9 feat: add data validation module
* main                    102afc6 [origin/main] fix: set cache TTL to 300 seconds
```

Each line shows: branch name, commit SHA, tracking info in brackets (`[remote/branch]`), and the latest commit message. Branches marked `[gone]` have tracking configured but the remote branch no longer exists — these should be cleaned up. Branches with no brackets have no upstream tracking configured.

> [!warning] Branches Marked [gone] Need Cleanup
>
> A `[gone]` marker means the remote branch was deleted (typically after a PR was merged) but the local branch still exists and still points to the old tracking ref. These branches accumulate over time and clutter your workspace.

> [!success] Clean Up Gone Branches
>
> Delete local branches whose remote counterpart is gone:
>
> ```bash
> git branch -d feat/airflow-dags
> git branch -d feat/terraform-modules
> ```
>
> Use `-d` (safe delete — only works if the branch is fully merged) or `-D` (force delete — works even if unmerged, use with caution).

| Flag | Syntax | Description |
|---|---|---|
| `-u` / `--set-upstream` | `git push -u origin <branch>` | Push and set upstream tracking |
| `--set-upstream-to` | `git branch --set-upstream-to=origin/<branch>` | Set tracking without pushing |
| `--unset-upstream` | `git branch --unset-upstream` | Remove tracking configuration |
| `-vv` | `git branch -vv` | Show branches with tracking info and sync status |

## Pruning: Clean Up Deleted Remote Branches

When teammates delete branches on the remote (e.g., after a PR is merged), those branches linger in your local repo as stale remote-tracking refs (e.g., `origin/feat/old-branch`). These refs are not automatically removed — you must prune them explicitly. Without regular pruning, your branch list becomes cluttered with references to branches that no longer exist, and commands like `git branch -r` show misleading results.

### Git | fetch --prune | remove stale remote-tracking refs

Remote-tracking refs are snapshots of remote branches at last-fetch time. When the remote branch is deleted, the tracking ref remains until you prune it. `--prune` performs this cleanup as part of a fetch in one step.

#### Fetch and prune stale remote-tracking branches

**When to run:** Regularly — at least once per work session, or after learning that branches were deleted on the remote (e.g., after PR merges).
**Trigger:** `git branch -r` shows branches you know were deleted, or `git remote show origin` reports stale refs.
**Context:** Network read + local ref cleanup. Fetches new commits and simultaneously removes stale remote-tracking refs. Safe to run at any time.
**Purpose:** Keep your local view of the remote accurate by removing references to branches that no longer exist on the server.

*Fetch new objects and remove remote-tracking refs for branches deleted on the remote.*

```bash
git fetch --prune
```

```text
From https://github.com/alp78/git-lab
 - [deleted]         (none)     -> origin/feat/airflow-dags
 - [deleted]         (none)     -> origin/feat/terraform-modules
```

Each `[deleted]` line indicates a remote-tracking ref that was removed because the corresponding branch no longer exists on the remote. The `(none)` in the left column means there is no new ref replacing it — the branch is simply gone.

> [!tip] Make Pruning Automatic
>
> Configure Git to always prune on fetch so you never accumulate stale refs:
>
> ```bash
> git config --global fetch.prune true
> ```
>
> After this, every `git fetch` automatically prunes without needing the `--prune` flag. This is recommended for all developers.

> [!warning] Pruning Does Not Delete Local Branches
>
> `git fetch --prune` only removes remote-tracking refs (e.g., `origin/feat/old-branch`). If you have a local branch `feat/old-branch` tracking that ref, the local branch remains. You must delete it separately with `git branch -d feat/old-branch`.

> [!success] Full Cleanup: Prune Then Delete Local Branches
>
> Run `git fetch --prune` to remove stale tracking refs, then use `git branch -vv` to find local branches marked `[gone]`, and delete them:
>
> ```bash
> git fetch --prune
> git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -d
> ```

## Default-Branch and Remote HEAD Management

When a remote renames its default branch (e.g., `master` → `main`), your local clone retains the old `origin/HEAD` pointer. Commands that implicitly reference the default branch — `git clone`, `git checkout` with no arguments, and some CI tools — will target the stale name until you update the local pointer. This section covers diagnosing and fixing that mismatch, which is a common migration scenario on mature teams.

### Git | remote set-head | update the default branch pointer

`origin/HEAD` is a symbolic ref that tells Git which branch is the default for a remote. It is set during `git clone` and is not automatically updated when the remote changes its default branch.

#### Diagnose a stale default branch pointer

**When to run:** After a `master` → `main` migration on the remote, or when `git remote show origin` reports a different HEAD branch than expected.
**Trigger:** `git clone` checks out the wrong branch, CI scripts reference `origin/HEAD` and get the old name, or `git remote show origin` shows `HEAD branch: main` but `origin/HEAD` still points to `master`.
**Context:** `git remote show origin` queries the remote (network read). `git symbolic-ref` is local only.
**Purpose:** Identify whether the local `origin/HEAD` pointer matches the remote's actual default branch.

*Check what the remote considers its default branch.*

```bash
git remote show origin
```

The `HEAD branch: main` line in the output confirms the remote's current default. Compare this with the local pointer:

*Check the local symbolic ref for origin/HEAD.*

```bash
git symbolic-ref refs/remotes/origin/HEAD
```

```text
refs/remotes/origin/main
```

If this shows `refs/remotes/origin/master` while the remote's HEAD is `main`, the pointer is stale.

#### Auto-detect and update the remote HEAD pointer

**When to run:** After the remote's default branch has been renamed.
**Trigger:** The `HEAD branch` line in `git remote show origin` does not match `git symbolic-ref refs/remotes/origin/HEAD`.
**Context:** Network read to query the remote, then local config change. No branches are modified.
**Purpose:** Automatically update `origin/HEAD` to match the remote's current default branch.

*Let Git query the remote and update the local pointer automatically.*

```bash
git remote set-head origin --auto
```

```text
'origin/HEAD' is unchanged and points to 'main'
```

If the pointer was stale, this output would instead say `origin/HEAD set to main`. After this command, `origin/HEAD` correctly resolves to the remote's current default branch.

#### Manually set the remote HEAD pointer

If `--auto` fails (e.g., network issues) or you want to override the default, set it manually:

```bash
git remote set-head origin main
```

#### Re-point local main branch after remote migration

After updating `origin/HEAD`, if your local `main` branch is still tracking `origin/master`, update the tracking configuration:

```bash
git branch --set-upstream-to=origin/main main
```

> [!tip] Full master → main Migration Checklist (Local Side)
>
> After the remote has renamed `master` to `main`:
>
> 1. `git fetch origin` — download the new `main` ref
> 2. `git remote set-head origin --auto` — update `origin/HEAD`
> 3. `git branch -m master main` — rename local branch
> 4. `git branch --set-upstream-to=origin/main main` — re-point tracking
> 5. `git fetch --prune` — remove stale `origin/master` ref
> 6. Update any CI scripts, hooks, or aliases that reference `master`

> [!warning] CI and Automation May Still Reference the Old Name
>
> Branch name changes on the remote do not propagate to CI configuration files (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`), pre-commit hooks, or local shell aliases. Search your repository and local config for all references to the old branch name after migration.

> [!success] Search for Stale Branch References
>
> ```bash
> grep -r "master" .github/ .gitlab-ci.yml Jenkinsfile Makefile 2>/dev/null
> ```

## Deleting Remote Branches

When a feature branch is no longer needed on the remote (e.g., after a PR is merged, or an experiment is abandoned), delete it to keep the repository clean. This is a remote-state-changing operation — the branch is removed from the server.

### Git | push --delete | remove a branch from the remote

#### Delete a remote branch

**When to run:** After a PR is merged or a feature branch is abandoned and no one else needs it.
**Trigger:** PR merged notification, end of a feature cycle, or repository cleanup.
**Context:** Network write. Removes the branch from the remote server. Other developers will see it disappear on their next `git fetch --prune`. Does not affect local branches.
**Purpose:** Remove a branch from the remote to keep the repository branch list clean and reduce clutter.

*Delete the `demo/remote-ops` branch from the remote.*

```bash
git push origin --delete demo/remote-ops
```

```text
To https://github.com/alp78/git-lab.git
 - [deleted]         demo/remote-ops
```

> [!warning] Deleting a Remote Branch Does Not Delete the Local Branch
>
> `git push origin --delete <branch>` only removes the branch from the remote. Your local branch and its commits are untouched. If you want to delete both, also run `git branch -d <branch>` locally.

> [!success] Delete Both Local and Remote in Sequence
>
> ```bash
> git push origin --delete feat/old-branch
> git branch -d feat/old-branch
> ```

## Safe Force-Push After Rebase

Rebasing a feature branch rewrites its commit SHAs. After rebase, your local branch and the remote branch have diverged — a normal `git push` is rejected because the histories no longer share a common tip. A force-push overwrites the remote with your local history. `--force-with-lease` makes this operation safe by verifying the remote has not moved forward since your last fetch.

### Git | push --force-with-lease | safely overwrite remote after rebase

`--force-with-lease` overwrites the remote branch only if the remote tip matches your last-fetched state. If a teammate pushed commits while you were rebasing, the push is rejected — protecting their work from being overwritten. Always prefer this over bare `--force`.

#### Rebase and force-push a feature branch

**When to run:** After rebasing your feature branch onto the latest main to incorporate upstream changes.
**Trigger:** PR review feedback requesting a rebase, or your feature branch has fallen behind main and you want a clean linear history before merging.
**Context:** Network write. History-rewriting operation — the remote branch will have different commit SHAs after this push. Only safe on personal feature branches that no one else has checked out.
**Purpose:** Update the remote branch to match your rebased local branch without risking overwriting a teammate's commits.

**Before rebase:**

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}, 'gitGraph': {'mainBranchName': 'main'}}}%%
gitGraph TB:
  commit id: "A"
  commit id: "B"
  branch feature
  commit id: "C"
  commit id: "D"
  checkout main
  commit id: "E"
```

*Before rebase: main has advanced to E while feature diverged at B with commits C and D. The feature branch was pushed to origin with SHAs C and D. A normal `git push` will fail because the local feature (about to be rebased) will have different SHAs than what origin expects.*

**After rebase:**

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}, 'gitGraph': {'mainBranchName': 'main'}}}%%
gitGraph TB:
  commit id: "A"
  commit id: "B"
  commit id: "E"
  branch feature
  commit id: "C'" type: HIGHLIGHT
  commit id: "D'" type: HIGHLIGHT
```

*After rebase and force-push: Git replayed C and D on top of E, producing C' and D' (marked green) — the diffs are identical but the SHAs changed because each commit now has a different parent (E instead of B). The result is a clean linear history where the feature work appears to have started after E, eliminating the divergence without a merge commit. The remote branch is overwritten with C' and D' via `--force-with-lease`, which verified that no one else pushed to the remote feature branch since our last fetch.*

The complete sequence for a safe rebase and force-push:

*Step 1 — Fetch the latest remote state to refresh the lease reference.*

```bash
git fetch origin main
```

```text
From https://github.com/alp78/git-lab
 * branch            main       -> FETCH_HEAD
```

*Step 2 — Rebase your feature branch onto the updated main. Resolve any conflicts, then continue.*

```bash
git rebase origin/main
```

```text
Successfully rebased and updated refs/heads/demo/remote-ops.
```

*Step 3 — Verify the rebased history. The feature commits should appear after main's tip with new SHAs.*

```bash
git log --oneline -5
```

```text
7ab2d9d feat: add fetch_data stub
e4ee4ad feat: add remote operations module
102afc6 fix: set cache TTL to 300 seconds
06f13ca merge: add US market holiday calendar
63b9cd5 feat: add US market holiday calendar for 2026
```

Commits `e4ee4ad` and `7ab2d9d` are the rebased versions (new SHAs) of the original `fb72ab0` and `10866fd`. They now sit on top of `102afc6` (main's tip) instead of branching from the earlier `06f13ca`.

*Step 4 — Force-push with lease protection. The push succeeds only if the remote tip matches our last-fetched state.*

```bash
git push --force-with-lease origin demo/remote-ops
```

```text
To https://github.com/alp78/git-lab.git
 + 10866fd...7ab2d9d demo/remote-ops -> demo/remote-ops (forced update)
```

The `+` prefix and `(forced update)` confirm this was a force-push. The SHA range `10866fd...7ab2d9d` shows the old remote tip was replaced by the new one. The three dots (`...`) indicate the histories diverged (as expected after a rebase).

### Difference Between --force and --force-with-lease

`--force` overwrites the remote branch unconditionally, regardless of what others may have pushed. `--force-with-lease` adds a conditional check: the push only proceeds if the remote tip matches your last-fetched state.

| Aspect | `git push --force` | `git push --force-with-lease` |
|---|---|---|
| **Safety** | None — unconditionally overwrites | Verifies remote tip matches last fetch |
| **Risk** | Silently destroys teammate commits | Rejects push if remote advanced |
| **Use case** | Only when you are certain no one else uses the branch | Default for all force-push scenarios |
| **Failure mode** | Never fails (that is the danger) | Fails if someone else pushed — requires re-fetch and review |
| **Recovery** | Requires `git reflog` on the remote (if available) | No recovery needed — the push was rejected |

> [!danger] Never Force-Push Shared Branches
>
> `git push --force` and `git push --force-with-lease` overwrite remote history. They are only safe on personal feature branches that no one else has checked out. **Never force-push to `main`, `master`, or any shared branch.** If `main` needs a commit removed, use `git revert` instead.

> [!success] Use git revert for Shared Branch Corrections
>
> To undo a commit already on `main`, run `git revert <SHA>` and push the resulting revert commit. History is preserved, teammates' local copies remain consistent, and the change is traceable in the audit log.

> [!warning] --force-with-lease Requires a Recent Fetch
>
> `--force-with-lease` checks against your last-fetched remote state. If you haven't fetched in hours, someone else's push won't be detected — the lease is stale. Always run `git fetch origin` immediately before force-pushing.

> [!success] Always Fetch Immediately Before Force-Push
>
> Run `git fetch origin && git push --force-with-lease origin <branch>` as a single sequence. The fetch refreshes the lease reference so the safety check is based on the current remote state, not a stale snapshot.

| Flag | Syntax | Description |
|---|---|---|
| `--force-with-lease` | `git push --force-with-lease` | Overwrite remote only if tip matches last-fetched state |
| `--force` | `git push --force` | Unconditionally overwrite the remote branch (dangerous) |
| `--force-if-includes` | `git push --force-if-includes` | Stricter: verifies all remote commits appear in local reflog |
| `--delete` | `git push origin --delete <branch>` | Delete a branch on the remote |
| `--tags` | `git push --tags` | Push all local tags to the remote |
| `-u` / `--set-upstream` | `git push -u origin <branch>` | Push and set the upstream tracking branch |
| `--no-verify` | `git push --no-verify` | Skip pre-push hooks (use with caution) |
| `--dry-run` | `git push --dry-run` | Show what would be pushed without actually pushing |
| `-v` / `--verbose` | `git push -v` | Show detailed transfer information |

## Authentication and URL Management

Remote connections use either HTTPS or SSH protocols. The choice affects how you authenticate, how URLs are formatted, and how credentials are managed. Both protocols provide the same Git functionality — the difference is purely in the transport and authentication layer.

### Git | remote | authentication protocols and credential management

| Aspect | HTTPS | SSH |
|---|---|---|
| **URL format** | `https://github.com/org/repo.git` | `git@github.com:org/repo.git` |
| **Authentication** | Username + token (PAT) or credential manager | SSH key pair (public key on server, private key locally) |
| **Firewall friendliness** | Uses port 443 — works through most corporate firewalls | Uses port 22 — may be blocked by corporate firewalls |
| **Credential storage** | Git Credential Manager, OS keychain, or environment variable | SSH agent (`ssh-agent`) or key file |
| **Setup complexity** | Lower — just paste a token | Higher — generate key pair, add to GitHub, configure agent |
| **CI/CD preference** | PATs stored as secrets (easy to rotate) | Deploy keys or machine SSH keys |
| **Multi-account** | Different tokens per remote | SSH config with host aliases per account |

> [!tip] Switch Between HTTPS and SSH
>
> If your remote uses HTTPS and you want to switch to SSH (or vice versa), use `git remote set-url`:
>
> ```bash
> # HTTPS to SSH
> git remote set-url origin git@github.com:alp78/git-lab.git
>
> # SSH to HTTPS
> git remote set-url origin https://github.com/alp78/git-lab.git
> ```

> [!warning] Never Commit Credentials or Tokens
>
> PATs, SSH private keys, API tokens, and service account keys must never appear in repository files, commit messages, or CI logs. Use environment variables, secret managers, or Git credential managers.

> [!success] Use Git Credential Manager for HTTPS
>
> Git Credential Manager (GCM) stores HTTPS credentials securely in the OS keychain. Install it and Git will prompt once, then cache the credential for future operations:
>
> ```bash
> git config --global credential.helper manager
> ```

### Git | SSH config | multi-account and advanced authentication

Engineers working across personal, corporate, and automation identities need distinct credentials per remote. SSH host aliases in `~/.ssh/config` solve this by mapping different hostnames to different keys, even when all remotes point to the same server (e.g., `github.com`).

#### Multi-account SSH configuration

When you have two GitHub accounts (e.g., personal and corporate), both resolve to `github.com`. SSH host aliases let you route each to a different key.

> [!info]- ~/.ssh/config for two GitHub accounts
>
> ```text
> # Personal GitHub account
> Host github-personal
>     HostName github.com
>     User git
>     IdentityFile ~/.ssh/id_ed25519_personal
>     IdentitiesOnly yes
>
> # Corporate GitHub account
> Host github-work
>     HostName github.com
>     User git
>     IdentityFile ~/.ssh/id_ed25519_work
>     IdentitiesOnly yes
> ```
>
> - `Host` defines the alias used in remote URLs
> - `HostName` is the actual server
> - `IdentityFile` points to the private key for that identity
> - `IdentitiesOnly yes` prevents SSH from trying other keys in the agent (critical when multiple keys are loaded)

After configuring, use the host alias in remote URLs:

```bash
git remote set-url origin git@github-work:org/repo.git     # corporate
git remote set-url personal git@github-personal:me/repo.git # personal
```

#### Conditional Git identity with includeIf

To automatically set the correct Git user name and email based on the repository location, use `includeIf` in `~/.gitconfig`:

> [!info]- ~/.gitconfig with conditional identity
>
> ```text
> [user]
>     name = Personal Name
>     email = personal@email.com
>
> [includeIf "gitdir:~/work/"]
>     path = ~/.gitconfig-work
> ```
>
> And in `~/.gitconfig-work`:
>
> ```text
> [user]
>     name = Corporate Name
>     email = corporate@company.com
> ```
>
> Any repository cloned under `~/work/` automatically uses the corporate identity. All other repositories use the personal identity.

#### Deploy keys for CI and automation

Deploy keys are SSH keys scoped to a single repository, used by CI bots and automation scripts that need read (or read-write) access to one specific repository without granting access to the entire account.

| Access Type | Mechanism | Scope | Use Case |
|---|---|---|---|
| **Deploy key (read-only)** | SSH key added to a single repo on GitHub/GitLab | One repository, read only | CI pulling source code |
| **Deploy key (read-write)** | SSH key with write access on a single repo | One repository, read-write | CI pushing build artifacts or generated docs |
| **Machine user** | A dedicated GitHub/GitLab account with its own SSH key | Multiple repositories | Bots that operate across repos (e.g., Dependabot-style) |
| **GitHub App installation token** | Short-lived token from a GitHub App | Scoped to repos the app is installed on | Fine-grained, rotatable, auditable CI access |
| **PAT (Personal Access Token)** | HTTPS token scoped by permissions | All repos the user has access to | Quick setup, but broad scope and tied to a person |

> [!warning] Deploy Keys Cannot Be Shared Across Repositories
>
> A deploy key (SSH key pair) can only be added to one repository on GitHub. If you add the same public key to a second repository, GitHub rejects it. Each repository that needs automated access requires its own key pair.

> [!success] Use GitHub App Tokens for Multi-Repo CI
>
> For CI pipelines that interact with multiple repositories, create a GitHub App, install it on the repositories, and generate short-lived installation tokens. These tokens are scoped, rotatable, and not tied to a person — superior to PATs for automation.

#### Bot and service-account remote access patterns

> [!example] Data Engineering: CI Bot Access Pattern
>
> A typical data-engineering CI pipeline needs:
>
> - **Read access** to the main repo (fetch source, dbt models, DAG definitions)
> - **Write access** to push generated artifacts (compiled dbt docs, Airflow DAG bundles, Terraform plan outputs)
> - **Separate identity** from any human engineer (for audit trails)
>
> Configure this with a machine user or GitHub App:
>
> ```bash
> # CI environment — use SSH with a dedicated deploy key
> git clone git@github.com:org/dbt-models.git
>
> # Or use a GitHub App installation token via HTTPS
> git clone https://x-access-token:${GITHUB_APP_TOKEN}@github.com/org/dbt-models.git
> ```
>
> The CI bot's commits should use a dedicated email (e.g., `ci-bot@company.com`) so `git blame` and audit logs distinguish automated from human changes.

## Data-Engineering Remote Patterns

Data engineering teams often manage repositories that go beyond application code — dbt projects, Airflow DAG repositories, Terraform state, migration scripts, and generated artifacts all have specific remote management considerations.

### Git | remote | patterns for data-engineering repositories

> [!example] dbt Project: Shared Repo with Deployment Remote
>
> A dbt project typically uses `origin` for code review and adds a deployment remote for the analytics warehouse CI:
>
> - `origin` → GitHub (PR-based code review, CI linting, dbt compile checks)
> - `deploy` → Internal CI trigger (pushes to `deploy/main` trigger `dbt run` against the warehouse)
>
> The team uses branch protection on `origin/main` to enforce review, and only the CI bot pushes to `deploy`.

> [!example] Airflow DAGs: Fork Workflow for Platform Teams
>
> When the Airflow DAG repository is owned by a platform team, individual data engineers fork the repo:
>
> - `origin` → Personal fork (push feature branches here)
> - `upstream` → Platform team's canonical repo (fetch DAG updates, submit PRs)
>
> This ensures the platform team controls what gets deployed while individual engineers can experiment in their forks without risk.

> [!example] Terraform: Separate Remotes per Environment
>
> Infrastructure-as-code repositories sometimes use separate remotes per environment to enforce deployment gates:
>
> - `origin` → GitHub (code review and PR approval)
> - `staging` → Triggers `terraform plan` and auto-apply in staging
> - `production` → Triggers `terraform plan` with manual approval gate in production
>
> Engineers push to `origin`, and a CI pipeline promotes changes to environment-specific remotes after approval.

> [!example] Migration Scripts: CI Bot as Sole Pusher
>
> Database migration repositories (Alembic, Flyway, Liquibase) often restrict who can push to `main`:
>
> - Engineers push feature branches to `origin` and open PRs
> - The CI bot runs migration dry-runs against a shadow database
> - Only the CI bot merges to `main` after all checks pass
> - `main` pushes trigger production migration execution
>
> In this model, no human should force-push to `main` — the CI bot's identity is the only authorized pusher.

## Troubleshooting and Recovery

Remote operations fail for predictable reasons. This section catalogs the most common failures, their root causes, and the correct recovery steps.

### Git | remote | troubleshooting common remote failures

| Symptom | Root Cause | Fix |
|---|---|---|
| `fatal: 'origin' does not appear to be a git repository` | Remote URL is incorrect or remote was removed | `git remote -v` to check, then `git remote set-url origin <correct-url>` or `git remote add origin <url>` |
| `fatal: Could not read from remote repository` | SSH key not loaded, PAT expired, or network issue | Verify SSH agent (`ssh-add -l`), regenerate PAT, check network connectivity |
| `error: failed to push some refs` | Remote has diverged — your push is rejected | `git fetch origin && git merge origin/<branch>` or rebase, then push again |
| `! [rejected] main -> main (non-fast-forward)` | Local branch is behind the remote | `git pull --rebase origin main && git push` |
| `! [rejected] ... (stale info)` | `--force-with-lease` detected remote changes | `git fetch origin` to refresh the lease, re-inspect, then retry |
| `error: src refspec <branch> does not match any` | Branch does not exist locally or was not committed | Verify branch exists with `git branch -a` and has at least one commit |
| `fatal: The current branch has no upstream branch` | Tracking not configured | `git push -u origin <branch>` to set tracking on first push |
| Branch shows `[gone]` in `git branch -vv` | Remote branch was deleted but local branch remains | `git branch -d <branch>` to delete the local branch |
| `git fetch` shows no output | Remote has no new commits since last fetch | Normal behavior — no action needed |
| `remote: Permission denied` | Insufficient permissions on the remote repository | Verify PAT scopes, SSH key authorization, or repository access settings |

> [!danger] Never Use --force on main to Fix a Rejected Push
>
> If `git push` to `main` is rejected, the correct response is always to fetch and integrate (merge or rebase), not to force-push. Force-pushing `main` overwrites shared history and breaks every teammate's local clone.

> [!success] Safe Recovery from a Rejected Push to main
>
> ```bash
> git fetch origin main
> git rebase origin/main    # or: git merge origin/main
> git push origin main
> ```

## Operating Guidance

These rules summarize the operational principles for safe and effective remote management in a team environment.

1. **Fetch before you push.** Always run `git fetch origin` before any push to ensure your view of the remote is current.
2. **Use `--force-with-lease`, never `--force`.** The lease check costs nothing and prevents overwriting teammate commits.
3. **Fetch immediately before force-pushing.** A stale lease is no lease at all. Run `git fetch origin && git push --force-with-lease` as a single sequence.
4. **Only force-push personal feature branches.** Never force-push `main`, `master`, `develop`, or any branch others have checked out. Use `git revert` for shared-branch corrections.
5. **Enable auto-pruning.** Set `git config --global fetch.prune true` so stale remote-tracking refs are cleaned up automatically on every fetch.
6. **Clean up `[gone]` branches regularly.** After pruning, delete local branches whose remote counterpart was removed.
7. **Verify remote URLs before first fetch or push.** A typo in the URL wastes time with cryptic authentication errors. Run `git remote -v` after any remote configuration change.
8. **Use SSH for interactive work, HTTPS for CI.** SSH avoids token expiry during long sessions; HTTPS tokens are easier to rotate in CI pipelines.
9. **Name remotes by purpose, not by server.** `upstream`, `staging`, `production` are more meaningful than `github`, `gcp`, `aws`.
10. **Never commit credentials.** PATs, SSH keys, and service account tokens belong in credential managers and CI secrets, never in repository files.

## Quick Reference

| Goal | Command |
|---|---|
| List remotes | `git remote -v` |
| Add a remote | `git remote add <name> <url>` |
| Rename a remote | `git remote rename <old> <new>` |
| Change remote URL | `git remote set-url <name> <url>` |
| Remove a remote | `git remote remove <name>` |
| Show remote details | `git remote show <name>` |
| Get remote URL | `git remote get-url <name>` |
| List remote refs | `git ls-remote --heads <remote>` |
| Fetch one remote | `git fetch <remote>` |
| Fetch all remotes | `git fetch --all` |
| Fetch and prune | `git fetch --prune` |
| Set upstream tracking | `git push -u origin <branch>` |
| Inspect tracking | `git branch -vv` |
| Safe force-push | `git push --force-with-lease origin <branch>` |
| Delete remote branch | `git push origin --delete <branch>` |
| Set separate push URL | `git remote set-url --push <name> <url>` |
| Update remote HEAD | `git remote set-head origin --auto` |
| Check local HEAD pointer | `git symbolic-ref refs/remotes/origin/HEAD` |
| Rename local branch | `git branch -m <old> <new>` |
| Re-point tracking | `git branch --set-upstream-to=origin/<branch>` |
| Clone a mirror | `git clone --mirror <url>` |
| Update a mirror | `git remote update --prune` |
| Switch HTTPS to SSH | `git remote set-url origin git@github.com:org/repo.git` |
