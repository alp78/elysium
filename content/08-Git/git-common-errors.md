---
type: troubleshooting
category: git
technology: [git, github]
tags: [git]
aliases:
  - "non-fast-forward"
  - "detached HEAD"
  - "merge conflict"
  - "permission denied publickey"
  - "fatal not a git repository"
  - "refusing to merge unrelated histories"
  - "remote hung up unexpectedly"
  - "cannot lock ref"
  - "updates were rejected"
  - "your local changes would be overwritten"
  - "HEAD detached at origin/main"
  - "pathspec did not match any file"
  - "LF will be replaced by CRLF"
  - "git push rejected after rebase"
  - "squash merge shows branch as not merged"
  - "git common errors"
  - "git troubleshooting"
  - "git error messages"
keywords:
  [
    git errors,
    git troubleshooting,
    non-fast-forward,
    detached HEAD,
    merge conflict,
    permission denied publickey,
    SSH key,
    force push,
    force-with-lease,
    rebase,
    stash,
    git reset,
    git restore,
    git revert,
    git rm cached,
    gitignore tracked files,
    unrelated histories,
    lock file,
    CRLF LF line endings,
    github actions secret,
    GCP_SA_KEY,
    squash merge,
    reflog,
    git branch deleted,
    amend commit,
    accidentally committed,
    large file push,
    http postBuffer,
    conflict modify delete,
  ]
description: "Reference guide for 25 common Git and GitHub error messages — what causes each error and the exact commands to fix it, covering push rejections, detached HEAD, SSH failures, merge conflicts, lock files, line endings, accidental commits, and more."
related:
  - "[[git-recovery-and-undo]]"
  - "[[git-branching-and-merging]]"
  - "[[git-daily-workflow]]"
  - "[[git-history-and-inspection]]"
  - "[[github-actions-ci-cd]]"
  - "[[gitignore-patterns]]"
  - "[[pull-requests-and-code-review]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Common Errors & How to Fix Them

This note covers 25 common Git and GitHub error messages encountered in day-to-day data engineering work. Each entry explains why the error happens and provides the exact commands to resolve it. Related recovery techniques are in [[git-recovery-and-undo]]; branch and merge mechanics are in [[git-branching-and-merging]]. To practice diagnosing these errors in realistic scenarios, work through [[git-problems]].

---

## GitHub Actions: "google-github-actions/auth failed: must specify exactly one of workload_identity_provider or credentials_json"

**Cause:** The `GCP_SA_KEY` secret is missing, empty, or not accessible to the workflow. GitHub Actions secrets are not passed to workflows triggered from forks (including Dependabot PRs). The `${{ secrets.GCP_SA_KEY }}` expression resolves to an empty string, and the auth action fails because it receives neither authentication method.

**Fix: check if the secret exists**

```bash
gh secret list
```

Look for `GCP_SA_KEY` in the output. Verify the secret is actually configured.

**Fix: set the secret from the service account key file**

```bash
gh secret set GCP_SA_KEY < your-ci-key.json
```

Paste the entire JSON contents of your GCP service account key. Upload the service account key as a GitHub secret.

**Fix: re-run the failed workflow**

```bash
gh run rerun <RUN_ID>
```

`run rerun` re-executes a failed workflow run. Try the deployment again now that the secret is set.

> [!warning] Fork and Dependabot Workflows
> If the workflow was triggered by a fork or Dependabot, secrets are intentionally blocked by GitHub. You'll need to merge the PR first, then the push-to-main workflow will have access to secrets.

---

## "Your branch is behind origin/main"

**Cause:** Your local branch is outdated.

**Fix: pull the latest changes**

```bash
git pull origin main
```

`pull` does fetch + merge from the main branch on the remote. Downloads the latest from GitHub and merges it.

---

## "Merge conflict in filename.py"

See [[git-branching-and-merging]] for full conflict resolution steps. Open the file, resolve the conflict markers, `git add` the resolved file, then `git commit`.

---

## "Failed to push: rejected — non-fast-forward"

**Cause:** Someone pushed to the same branch since your last pull.

**Fix: pull, rebase, then push**

```bash
git pull --rebase && git push
```

`--rebase` replays your commits on top of the remote changes. `&&` pushes only if the pull succeeded. Downloads what they pushed, puts your changes on top, then sends it.

---

## "Detached HEAD"

**Cause:** You checked out a specific commit (not a branch). Any new commits will be orphaned.

**Fix: create a branch from the detached state**

```bash
git checkout -b my-new-branch
```

`-b` creates a new branch at the current position. You're floating in history — this creates a branch under your feet so your work isn't lost.

---

## "Committed to wrong branch"

**Fix: move the last commit to the correct branch**

```bash
git log --oneline -1              # note the SHA
git reset --soft HEAD~1           # undo commit (keep changes staged)
git stash                         # shelve the changes
git checkout correct-branch       # switch to right branch
git stash pop                     # bring changes back
git commit -m "my message"        # commit on correct branch
```

For example: if you committed to `main` instead of your feature branch, this sequence moves it over cleanly. See [[git-recovery-and-undo]] for more reset scenarios.

---

## "Accidentally deleted a file"

**Fix: restore from the last commit**

```bash
git restore filename.py
```

Brings back the file from your last save point (the most recent commit).

---

## "Need to undo a push"

**Fix: revert and push (safe for shared branches)**

```bash
git revert HEAD && git push
```

`revert HEAD` creates an undo commit for the last change. This undoes the last pushed commit by creating an "anti-commit" and pushing it. Unlike `git reset`, revert is safe on shared branches because it doesn't rewrite history.

> [!tip] Revert vs Reset
> Use `git revert` when undoing pushed commits on shared branches. Use `git reset` only on commits that haven't been pushed yet. See [[git-recovery-and-undo]] for details.

---

## "Accidentally committed a large file"

**Fix: undo commit, stop tracking, recommit**

```bash
git reset --soft HEAD~1
# add the file to .gitignore
git rm --cached large_file.csv
git commit -m "remove large file"
```

Undo the commit, stop tracking the big file, and redo the commit without it.

> [!warning] Large File History
> This removes the file from the next commit but does NOT erase it from Git history. If the file is too large for GitHub's limit, you may need BFG Repo-Cleaner to purge it from all history.

---

## "Squash merge shows branch as not merged"

After `gh pr merge --squash`, `git branch -d` warns the branch isn't merged. This is normal — squash creates a new combined commit with a different SHA. The changes ARE on main, just as a different commit. Safe to use `git branch -d` anyway (the warning is cosmetic).

See [[pull-requests-and-code-review]] for squash merge workflow details.

---

## "git status says up to date but I'm missing changes"

**Cause:** "Up to date with origin/main" means your local matches what was LAST FETCHED. If someone pushed after your last fetch, you won't see it.

**Fix: fetch first, then check status**

```bash
git fetch && git status
```

`fetch` refreshes your view of the remote without merging anything. Updates your knowledge of what's on GitHub, then checks again.

---

## "fatal: not a git repository"

**Cause:** You're running a git command outside of any repo, or you `cd`'d into the wrong folder.

**Fix: navigate to the right folder**

```bash
cd /path/to/your/repo && git status
```

Navigate to the repo directory first. If you're unsure where the repo is, look for a `.git` folder.

---

## "error: pathspec 'branch-name' did not match any file(s) known to git"

**Cause:** The branch doesn't exist locally. It might be a remote branch you haven't fetched yet.

**Fix: fetch first, then switch**

```bash
git fetch && git switch branch-name
```

`fetch` downloads remote branch references. `switch` creates a local tracking branch automatically if a remote one exists. The branch is on GitHub but not yet local — download it first.

---

## "fatal: refusing to merge unrelated histories"

**Cause:** Two repos with no common ancestor (e.g., you initialized locally AND on GitHub separately).

**Fix: allow unrelated histories**

```bash
git pull origin main --allow-unrelated-histories
```

`--allow-unrelated-histories` forces Git to merge two independent histories. These repos started separately but you want to combine them.

---

## "error: your local changes would be overwritten by merge/checkout"

**Cause:** You have uncommitted changes in files that the operation needs to modify.

**Fix: stash, then retry**

```bash
git stash                     # shelve your changes
git checkout other-branch     # or git pull, git merge, etc.
git stash pop                 # bring your changes back
```

Unsaved changes are in the way. Shelve them, do the operation, bring them back. See [[git-daily-workflow]] for stash usage patterns.

---

## "fatal: the remote end hung up unexpectedly" (large push)

**Cause:** You're pushing a repo or file that exceeds the HTTP buffer size (common with large files or initial pushes of big repos).

**Fix: increase the buffer size**

```bash
git config --global http.postBuffer 524288000
```

`http.postBuffer` increases the maximum HTTP POST size to 500 MB. The push is too big for the default buffer — make it bigger.

> [!tip] Alternative for Large Files
> For truly large assets, consider [[gitignore-patterns]] to keep them out of the repo, or use Git LFS (Large File Storage) rather than increasing the buffer.

---

## "Permission denied (publickey)"

**Cause:** Your SSH key isn't configured or isn't added to your GitHub account.

**Fix: check your SSH setup**

```bash
ssh -T git@github.com         # test SSH connection
ssh-add -l                    # list loaded SSH keys
```

If no keys are listed, generate one and add it to GitHub:

```bash
ssh-keygen -t ed25519 -C "your@email.com"
```

Then add the public key to GitHub under **Settings > SSH and GPG Keys**.

> [!info] HTTPS Alternative
> If SSH setup is blocked by your network, switch the remote to HTTPS: `git remote set-url origin https://github.com/owner/repo.git` and use a Personal Access Token as your password.

---

## "CONFLICT (modify/delete)" during merge or rebase

**Cause:** One branch modified a file while the other branch deleted it. Git doesn't know which wins.

**Fix: decide — keep or delete**

```bash
git rm filename.py            # accept the deletion
# OR
git add filename.py           # keep the file (resolve content manually first)
git rebase --continue         # or git merge --continue
```

One side deleted the file, the other edited it. You must pick one outcome explicitly, then continue.

---

## "fatal: cannot lock ref" or "unable to create ... .lock"

**Cause:** A previous git operation crashed and left a lock file behind. Or another git process is running.

**Fix: remove the stale lock file**

```bash
rm -f .git/refs/heads/branch-name.lock
```

Or for the index lock:

```bash
rm -f .git/index.lock
```

A previous git command crashed mid-operation and left a lock. Remove it and retry.

> [!warning] Check for Running Processes First
> Before deleting the lock file, confirm no other git process (e.g., a GUI client, IDE plugin, or background script) is currently running against this repo. Deleting an active lock can corrupt the operation in progress.

---

## "git push rejected after rebase"

**Cause:** Rebase rewrites commit SHAs. The remote still has the old commits, so Git sees a divergence.

**Fix: force push with safety**

```bash
git push --force-with-lease
```

`--force-with-lease` force-pushes BUT only if no one else has pushed to the branch since your last fetch. It is the safe alternative to `--force`. Your rebase changed the history — force-push, but make sure you're not overwriting someone else's work.

> [!warning] Never Force-Push to main
> Only force-push to your own feature branches. Never force-push to `main` or any shared branch. See [[git-branching-and-merging]] for branch protection rules.

---

## "git pull results in merge commits I don't want"

**Cause:** `git pull` does a fetch + merge by default, creating merge commits that clutter history.

**Fix: use rebase instead of merge**

```bash
git pull --rebase origin main
```

`--rebase` replays your local commits on top of the fetched changes instead of merging. Instead of creating merge commits, puts your changes on top cleanly.

#### git config pull.rebase true — avoid merge commits on pull

```bash
git config --global pull.rebase true
```

---

## "warning: LF will be replaced by CRLF" (Windows)

**Cause:** Windows uses CRLF (`\r\n`) line endings, Unix uses LF (`\n`). Git is auto-converting.

**Fix: configure line ending behavior**

On Windows — converts to CRLF on checkout, LF on commit:

```bash
git config --global core.autocrlf true
```

On Mac/Linux — converts CRLF to LF on commit, no conversion on checkout:

```bash
git config --global core.autocrlf input
```

Stop the warnings by telling Git how to handle line endings for your OS.

> [!tip] .gitattributes is More Reliable
> For cross-platform teams, commit a `.gitattributes` file to the repo that enforces line endings per file type, rather than relying on each developer's local config.

---

## "error: failed to push some refs — hint: updates were rejected"

**Cause:** The remote branch has commits your local branch doesn't. This is NOT the same as a merge conflict — you just need to incorporate the remote changes first.

**Fix: pull (rebase) then push**

```bash
git fetch origin
git rebase origin/main        # or origin/your-branch
git push
```

Someone pushed before you. Rebase your work on top of theirs, then push.

---

## "HEAD detached at origin/main" after fetch

**Cause:** You accidentally ran `git checkout origin/main` (a remote ref) instead of `git checkout main`.

**Fix: switch to the local branch**

```bash
git switch main
```

You're looking at the remote pointer instead of your local branch. Switch to the real one.

---

## "Deleted branch before squash-merging the PR"

**Cause:** You deleted the local and/or remote feature branch before merging the PR on GitHub. The PR may auto-close when its head branch disappears.

#### Scenario

```bash
git checkout main && git pull
git branch -D feat/my-feature              # delete local branch
git push origin --delete feat/my-feature   # delete remote branch
# PR #26 is now closed and the branch is gone!
```

**Fix: restore the branch from the commit SHA and reopen the PR**

```bash
# 1. Find the SHA — git told you when it deleted the branch:
#    "Deleted branch feat/my-feature (was ec9ff69)"
#    Or find it with:
git reflog | grep feat/my-feature

# 2. Recreate the branch at that exact commit
git branch feat/my-feature ec9ff69

# 3. Push it back to the remote
git push origin feat/my-feature

# 4. Reopen the PR (it reconnects to the restored branch)
gh pr reopen 26
```

- `reflog` — Git's local undo history; records every HEAD movement even after branch deletion
- `git branch <name> <sha>` — creates a branch pointing at a specific commit
- `gh pr reopen` — reopens a closed PR; works as long as the head branch exists on the remote

#### If `git push` says "Everything up-to-date"

The remote may still have a stale ref. Force it:

```bash
git push origin ec9ff69:refs/heads/feat/my-feature
```

This explicitly creates the remote ref from the SHA, bypassing the tracking cache.

The commits aren't lost even after deletion. Git remembers the SHA via reflog. Recreate the branch, push it, reopen the PR, then squash-merge normally.

> [!tip] Safe Deletion Order
> Always merge/squash the PR on GitHub FIRST, then delete the branch. GitHub's "Delete branch" button after merge is the safest workflow.

---

## "Forgot to include a file in the last commit"

**Scenario:** You committed and pushed, then realized you forgot to stage `.gitignore` (or any other file).

**Step 1: Stage the missing file**

```bash
git add .gitignore
```

**Step 2: Amend the previous commit**

```bash
git commit --amend --no-edit
```

`--amend` rewrites the last commit to include the newly staged file. `--no-edit` keeps the original commit message unchanged.

**Step 3: Force-push (since the commit SHA changed)**

```bash
git push --force-with-lease
```

`--force-with-lease` overwrites the remote branch only if nobody else has pushed since your last fetch.

> [!warning] Only Amend Your Own Feature Branch
> Only amend commits on your own feature branch. Never amend commits on `main` or shared branches — other developers may have already pulled the original commit.

Amending replaces the last commit with a new one that includes the extra file. Since the commit hash changes, you need to force-push. `--force-with-lease` is the safe way to do it.

---

## "Accidentally committed files that should be ignored"

**Scenario:** You committed and pushed binary files, secrets, or build artifacts that should have been in `.gitignore`. The files are now tracked by Git even though you don't want them in the repo.

**Step 1: Add the paths to `.gitignore`**

```bash
echo "docs/logos/" >> .gitignore
echo "*.log" >> .gitignore
```

**Step 2: Remove the files from Git's index (but keep them on disk)**

```bash
git rm -r --cached docs/logos/
```

- `rm` — remove from Git
- `-r` — recursive (for directories)
- `--cached` — only remove from the index (staging area), **not** from your filesystem
- The files will remain on disk but Git will stop tracking them

**Step 3: Commit and push**

```bash
git add .gitignore
git commit -m "chore: stop tracking logos, add to .gitignore"
git push
```

> [!warning] Secrets Require History Rewrite
> This does NOT erase the files from Git history — they remain in previous commits. If you accidentally committed secrets (API keys, passwords), you need `git filter-branch` or [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to purge them from all history, then force-push.

`.gitignore` only prevents **new** files from being tracked. Files already committed are still tracked even after adding them to `.gitignore`. The `git rm --cached` command tells Git to forget about them without deleting them from your disk. See [[gitignore-patterns]] for how to structure `.gitignore` correctly from the start.

---

## Quick Reference Table

| Error / Symptom | Root Cause | Fix |
|---|---|---|
| `google-github-actions/auth failed` | Missing `GCP_SA_KEY` secret | `gh secret set GCP_SA_KEY < key.json` |
| `Your branch is behind origin/main` | Local outdated | `git pull origin main` |
| `non-fast-forward` push rejected | Remote has newer commits | `git pull --rebase && git push` |
| Detached HEAD | Checked out a commit, not a branch | `git checkout -b my-new-branch` |
| Committed to wrong branch | — | `reset --soft`, stash, switch, pop, recommit |
| Accidentally deleted a file | — | `git restore filename.py` |
| Need to undo a push | — | `git revert HEAD && git push` |
| Accidentally committed large file | — | `reset --soft`, `git rm --cached`, recommit |
| `fatal: not a git repository` | Wrong directory | `cd /path/to/repo` |
| `pathspec did not match` | Remote branch not fetched | `git fetch && git switch branch-name` |
| `refusing to merge unrelated histories` | Two repos with no common ancestor | `git pull --allow-unrelated-histories` |
| Local changes overwritten | Uncommitted changes blocking operation | `git stash` → operate → `git stash pop` |
| Remote end hung up (large push) | HTTP buffer too small | `git config --global http.postBuffer 524288000` |
| `Permission denied (publickey)` | SSH key missing or not added | `ssh-keygen`, add to GitHub Settings |
| `CONFLICT (modify/delete)` | One branch modified, other deleted | `git rm` or `git add`, then `--continue` |
| `cannot lock ref` | Stale lock file from crashed process | `rm -f .git/index.lock` |
| Push rejected after rebase | Rebase rewrote SHAs | `git push --force-with-lease` |
| Unwanted merge commits on pull | `git pull` defaults to merge | `git pull --rebase` or `pull.rebase true` |
| `LF will be replaced by CRLF` | Windows/Unix line ending mismatch | `git config --global core.autocrlf true` |
| `updates were rejected` | Remote has commits you don't | `git fetch && git rebase origin/main && git push` |
| `HEAD detached at origin/main` | Checked out remote ref instead of branch | `git switch main` |
| Deleted branch before merging PR | Branch deleted, PR auto-closed | `git reflog` → recreate branch → `gh pr reopen` |
| Forgot a file in last commit | — | `git add file`, `git commit --amend --no-edit`, force-push |
| Committed files that should be ignored | `.gitignore` added too late | `git rm -r --cached`, update `.gitignore`, recommit |

---

## Related Notes

- [[git-recovery-and-undo]] — Full undo and recovery reference (reset, revert, reflog, stash)
- [[git-branching-and-merging]] — Branch creation, merging, and conflict resolution
- [[git-daily-workflow]] — Everyday commit, push, and pull patterns
- [[git-history-and-inspection]] — Inspecting logs, diff, and blame
- [[github-actions-ci-cd]] — CI/CD secrets, workflow triggers, and authentication
- [[gitignore-patterns]] — Structuring `.gitignore` and stopping tracked files
- [[pull-requests-and-code-review]] — PR workflow, squash merges, branch deletion
