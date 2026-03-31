---
type: how-to
category: git
technology: [git]
tags: [git, github]
aliases: [git reset, git revert, git reflog, git stash, undo commit, recover lost commit, git undo]
keywords: [git reset, git revert, git reflog, git restore, git stash, reset --soft, reset --hard, reset --mixed, HEAD~1, reflog, recover, undo, cherry-pick, lost commit, detached HEAD, branch deleted, merge conflict abort]
description: "Complete guide to undoing changes in Git — safe methods (restore, revert) and destructive methods (reset --hard), using reflog to recover lost commits, and stash for temporary shelving."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Recovery and Undo

> [!quote]
> "Nobody actually creates perfect code the first time around, except me. But there's only one of me."
> — **Linus Torvalds**, Git mailing list

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

> [!info] Restore reverts to last commit
>
> `git restore` reverts a file to its last committed state. With `--staged`, it unstages a file without discarding your working directory changes.

```bash
# Discard uncommitted changes to a file
git restore filename.py

# Unstage without discarding changes
git restore --staged filename.py

# Older syntax (same effect as restore)
git checkout -- filename.py
```

---

### Safe: Revert a Commit (Creates a New Undo Commit)

> [!info] Revert creates an undo commit
>
> `git revert` creates a NEW commit that reverses the changes from a specific commit. History is preserved — safe for pushed/shared branches.

```bash
# Undo a specific commit
git revert abc1234

# Revert the most recent commit
git revert HEAD
```

> [!tip] Revert is the Safe Way
>
> `git revert` is the SAFE way to undo work on shared branches. It doesn't rewrite history. Anyone who already pulled still has a consistent view — they just see your new "undo" commit arrive.

---

### Careful: Reset (Rewrites History)

> [!info] Reset modes control what survives
>
> - `--soft` — keeps changes staged (ready to re-commit)
> - `--mixed` (default) — keeps changes in working directory but unstages them
> - `--hard` — discards ALL changes permanently

```bash
# Undo last commit, keep changes staged
git reset --soft HEAD~1

# Undo last commit, keep changes unstaged (default)
git reset --mixed HEAD~1

# Undo last commit and DELETE all changes (destructive)
git reset --hard HEAD~1
```

> [!warning] Hard Reset Is Destructive
>
> `git reset --hard` is DESTRUCTIVE.
> Uncommitted work is permanently lost. Only use on local, unpushed commits.

> [!danger] Nuclear option destroys everything
>
> Resets your local branch to match the remote exactly. All local changes AND all local-only commits are permanently destroyed.

```bash
git reset --hard origin/main
```

---

### Recover: Reflog — Git's Safety Net

> [!info] Reflog is Git's safety net
>
> The reflog records all recent HEAD movements (commits, resets, checkouts). Even "deleted" commits appear here for approximately 90 days. Find the SHA of your lost work, then recover it.

```bash
# View all recent HEAD movements
git reflog

# Recover a lost commit by SHA from the reflog
git reset --hard abc1234
```

> [!tip] Even Hard Reset Is Recoverable
>
> Even `--hard` is Recoverable.
> Even after `git reset --hard`, your work is usually recoverable via reflog for up to 90 days.

---

### Stash — Temporarily Shelve Work

> [!info] git stash — temporarily shelve all modified tracked files
> - `git stash` — save changes to a stack and revert working directory to clean state
> - `git stash push -m "label"` — stash with a descriptive message
> - `git stash list` — show all items on the stash stack
> - `git stash pop` — apply the top stash entry and remove it from the stack
> - `git stash apply` — apply the top stash entry but keep it on the stack
> - `git stash apply stash@{N}` — apply a specific stash by index (0 is most recent)
> - `git stash drop stash@{N}` — remove a specific stash entry
> - `git stash clear` — delete ALL stash entries (see danger callout below)

```bash
git stash
git stash push -m "WIP: pulse fetcher refactor"
git stash list
git stash pop
git stash apply
git stash apply stash@{2}
git stash drop stash@{2}
git stash clear
```

> [!danger] stash clear Deletes ALL Stashes
>
> `git stash clear` permanently removes every entry in the stash stack — not just the top one. There is no undo. If you meant to drop just one entry, use `git stash drop stash@{N}` with the specific index. Always run `git stash list` first to verify what's in the stack.

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

> [!info] Revert then push for shared branches
>
> Creates an "anti-commit" that reverses the last change, then pushes it. Safe for shared branches because it preserves history.

```bash
git revert HEAD && git push
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

> [!warning] Stash Preserved on Conflict
>
> Stash Is Still Preserved on Conflict.
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

Cherry-picking copies a single commit from one branch and applies it as a new commit on your current branch. Unlike merging (which brings in an entire branch's history), cherry-pick lets you surgically extract exactly one commit. This is useful when a bug fix landed on a different branch and you need just that fix without everything else.

> [!info] Cherry-pick copies one commit
>
> Copies the changes from a specific commit and applies them as a new commit on your current branch. Useful for extracting a single bug fix from a different branch without merging everything else.

```bash
git cherry-pick abc1234
```

> [!warning] Cherry-pick creates duplicate commits
>
> The cherry-picked commit gets a new SHA on your branch. If you later merge the source branch, Git may flag the duplicated changes as a conflict. Cherry-pick sparingly — prefer merging or rebasing entire branches when possible.

### Advanced: Interactive Rebase

Interactive rebase lets you rewrite your recent commit history — reorder commits, combine multiple commits into one (squash), edit commit messages, or drop commits entirely. It opens an editor showing your recent commits as a todo list where you choose what to do with each one. This is a powerful cleanup tool before pushing or opening a PR.

> [!info] Interactive rebase rewrites history
>
> Opens an editor showing your recent commits as a todo list. You can reorder, squash (combine), edit messages, or drop commits entirely. Powerful cleanup tool before pushing or opening a PR.

```bash
git rebase -i HEAD~5
```

> [!danger] Dropping a commit is permanent
>
> If you change `pick` to `drop` (or delete a line) in the interactive rebase editor, that commit's changes are permanently removed from the branch. Unlike `git reset --soft`, the changes are not preserved in your working directory. If you drop the wrong commit, use `git reflog` to find the pre-rebase state and `git reset --hard` to restore it.

> [!warning] Only Rebase Unpushed Commits
>
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

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — status, staging, committing, pushing
- [git-branching-and-merging](https://alp78.github.io/elysium/08-Git/git-branching-and-merging) — creating branches and merge strategies
- [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) — PR merge conflicts and rebase workflows
- [git-history-and-inspection](https://alp78.github.io/elysium/08-Git/git-history-and-inspection) — log, blame, show for understanding what changed

## References

- [git reflog](https://git-scm.com/docs/git-reflog)
- [git reset](https://git-scm.com/docs/git-reset)
- [git revert](https://git-scm.com/docs/git-revert)
