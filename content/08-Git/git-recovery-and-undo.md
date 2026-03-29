---
type: how-to
category: git
technology: [git]
tags: [git, github]
aliases: [git reset, git revert, git reflog, git stash, undo commit, recover lost commit, git undo]
keywords: [git reset, git revert, git reflog, git restore, git stash, reset --soft, reset --hard, reset --mixed, HEAD~1, reflog, recover, undo, cherry-pick, lost commit, detached HEAD, branch deleted, merge conflict abort]
description: "Complete guide to undoing changes in Git — safe methods (restore, revert) and destructive methods (reset --hard), using reflog to recover lost commits, and stash for temporary shelving."
related:
  - "[[git-daily-workflow]]"
  - "[[git-branching-and-merging]]"
  - "[[pull-requests-and-code-review]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Recovery and Undo

Everyone makes mistakes. Git has several ways to undo things, ranging from completely safe to permanently destructive. The key is matching the right tool to the situation.

### Decision Tree: Which Git Undo to Use

| Situation | Safe Action |
|-----------|-------------|
| Haven't committed yet | `git restore` (discard) or `git stash` (save for later) |
| Committed but not pushed | `git reset --soft` (redo) or `git commit --amend` (fix) |
| Pushed but not merged | `git revert` (safe undo) or force-push if you're the only one on the branch |
| Merged to main | `git revert` (create an undo commit). Never rewrite main's history. |
| Lost a commit | `git reflog` (Git's safety net, remembers everything for ~90 days) |

---

### Safe: Discard Uncommitted Changes

```bash
# Discard uncommitted changes to a file
git restore filename.py
# restore — restore a file to its last committed state
# In plain English: Undo my changes to this file — go back to how it was at my last save.

# Unstage a file without discarding changes
git restore --staged filename.py
# --staged — operate on the staging area (not the working directory)
# In plain English: Remove this file from the staging area but keep my changes.

# Discard changes (older syntax)
git checkout -- filename.py
# checkout -- = older syntax for git restore. Same effect.
```

---

### Safe: Revert a Commit (Creates a New Undo Commit)

```bash
# Create a new commit that undoes a specific commit
git revert abc1234
# revert — create a NEW commit that reverses the changes from the specified commit. History is preserved.
# In plain English: Undo a specific commit by creating a new "anti-commit". Safe to use on pushed/shared branches.

# Revert the most recent commit
git revert HEAD
# HEAD — the most recent commit
```

> [!tip] Revert is the Safe Way
> `git revert` is the SAFE way to undo work on shared branches. It doesn't rewrite history. Anyone who already pulled still has a consistent view — they just see your new "undo" commit arrive.

---

### Careful: Reset (Rewrites History)

```bash
# Undo last commit, keep changes staged
git reset --soft HEAD~1
# reset — move the branch pointer backward
# --soft — keep changes from the undone commit in the staging area (ready to re-commit)
# HEAD~1 — one commit before HEAD
# In plain English: Undo my last commit but keep all changes staged. Useful for re-doing a commit message.

# Undo last commit, keep changes unstaged (default mode)
git reset --mixed HEAD~1
# --mixed — keep changes in the working directory but unstage them (default behavior)
# In plain English: Undo my last commit, un-stage the changes, but keep the file modifications.

# Undo last commit and DELETE all changes (destructive)
git reset --hard HEAD~1
# --hard — discard ALL changes from the undone commit. Permanently deleted.
# In plain English: Undo my last commit and throw away all the changes. Gone forever.
```

> [!warning] `git reset --hard` is DESTRUCTIVE
> Uncommitted work is permanently lost. Only use on local, unpushed commits.

```bash
# Reset local branch to match remote exactly (nuclear option)
git reset --hard origin/main
# origin/main — the remote branch to match. All local changes and commits are lost.
# In plain English: Make my local branch identical to what's on GitHub. Everything local is gone.
```

---

### Recover: Reflog — Git's Safety Net

```bash
# Show a log of all recent HEAD movements
git reflog
# reflog — reference log: shows all recent HEAD movements (commits, resets, checkouts).
# Even "deleted" commits appear here for ~90 days.
# In plain English: Git's secret diary — it remembers everything, even things you thought you deleted.

# Recover a lost commit found in reflog
git reset --hard abc1234
# abc1234 — the SHA found in reflog. Resets to that commit, recovering your work.
# In plain English: I accidentally deleted something — reflog showed me the commit, now I'm recovering it.
```

> [!tip] Even `--hard` is Recoverable
> Even after `git reset --hard`, your work is usually recoverable via reflog for up to 90 days.

---

### Stash — Temporarily Shelve Work

```bash
# Stash all modified tracked files
git stash
# stash — save modified tracked files to a stack and revert the working directory to clean state
# In plain English: Put my current work aside so I can do something else. I'll come back to it.

# Stash with a descriptive message
git stash push -m "WIP: pulse fetcher refactor"
# push — explicitly push to the stash stack
# -m "..." — a label to identify this stash
# In plain English: Same as stash but with a label so I remember what this was.

# List all stashed entries
git stash list
# list — show all items on the stash stack

# Apply the most recent stash and remove it from the stack
git stash pop
# pop — apply the top stash entry and delete it from the stack

# Apply the most recent stash but keep it on the stack
git stash apply
# apply — apply the top stash entry but keep it in the stack

# Apply a specific stash without removing it
git stash apply stash@{2}
# stash@{2} — the stash index (0 is most recent)

# Delete a specific stash entry
git stash drop stash@{2}
# drop — remove a stash entry

# Delete ALL stash entries
git stash clear
# clear — empty the entire stash stack
```

---

## Common Error Fixes

### "Committed to wrong branch"

```bash
git log --oneline -1              # note the SHA
git reset --soft HEAD~1           # undo commit (keep changes staged)
git stash                         # shelve the changes
git checkout correct-branch       # switch to right branch
git stash pop                     # bring changes back
git commit -m "my message"        # commit on correct branch
```

### "Accidentally deleted a file"

```bash
# Restore from the last commit
git restore filename.py
```

### "Need to undo a push"

```bash
# Revert and push (safe for shared branches)
git revert HEAD && git push
# revert HEAD — create an undo commit for the last change
# In plain English: Undo my last pushed commit by creating an "anti-commit" and pushing it.
```

### "Accidentally committed a large file"

```bash
git reset --soft HEAD~1
# add the file to .gitignore
git rm --cached large_file.csv
git commit -m "remove large file"
```

### Stash pop causes conflicts

When `git stash pop` produces conflicts, files will contain conflict markers:

```
<<<<<<< Updated upstream     ← what's on the current branch
            rows = []
            skipped = 0
=======                      ← separator
            inserts = []
            updates = []
>>>>>>> Stashed changes      ← your stashed work
```

> [!warning] Stash Is Still Preserved on Conflict
> When `git stash pop` conflicts, the stash entry is NOT auto-dropped. Your work is safe. After resolving, manually drop it: `git stash drop`.

```bash
git add ingestion/loaders/load_ohlcv.py    # stage each resolved file
git stash drop                              # manually drop the stash (pop didn't auto-drop due to conflicts)
```

### "Deleted branch before squash-merging the PR"

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

### "fatal: cannot lock ref" or lock file error

```bash
# Remove the stale lock file
rm -f .git/refs/heads/branch-name.lock
# Or for index lock:
rm -f .git/index.lock
# In plain English: A previous git command crashed mid-operation and left a lock. Remove it.
```

---

### Advanced: Cherry-pick

```bash
# Apply a specific commit onto the current branch
git cherry-pick abc1234
# cherry-pick — copy the changes from a specific commit and apply them as a new commit
# abc1234 — the commit SHA to copy
# In plain English: Copy one specific commit from another branch onto mine.
```

### Advanced: Interactive Rebase

```bash
# Reorder, squash, edit, or drop the last 5 commits
git rebase -i HEAD~5
# rebase — replay commits
# -i — interactive: opens an editor to choose what to do with each commit
# HEAD~5 — the last 5 commits
# In plain English: Let me rearrange, combine, or delete my last 5 commits.
```

> [!warning] Only Rebase Unpushed Commits
> Interactive rebase rewrites history. Only use on commits that haven't been pushed to a shared branch.

### Advanced: Bisect — Find the Breaking Commit

```bash
git bisect start
git bisect bad              # current commit is broken
git bisect good abc1234     # this old commit was working
# Git checks out middle commits. Test each one:
git bisect good   # or bad
# Repeat until Git finds the culprit
git bisect reset
```

Git plays "hot or cold" with your commits to find exactly where the bug was introduced.

## Related

- [[git-daily-workflow]] — status, staging, committing, pushing
- [[git-branching-and-merging]] — creating branches and merge strategies
- [[pull-requests-and-code-review]] — PR merge conflicts and rebase workflows
- [[git-history-and-inspection]] — log, blame, show for understanding what changed

## References

- [git reflog](https://git-scm.com/docs/git-reflog)
- [git reset](https://git-scm.com/docs/git-reset)
- [git revert](https://git-scm.com/docs/git-revert)
