---
type: reference
category: git
technology: [git]
tags: [git]
aliases: [git log, git diff, git blame, git show, git history, inspect commits, git log graph]
keywords: [git log, git diff, git blame, git show, oneline, graph, author, since, file history, commit history, diff staged, blame, who changed, inspect commit, show file at commit, bisect, shortlog]
description: "Commands for viewing and inspecting Git history — git log with filters and graph views, git diff for staged/unstaged changes, git blame for authorship, and git show for individual commits."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git History and Inspection

> [!quote]
> "The past is never dead. It's not even past."
> — **William Faulkner**, *Requiem for a Nun* (1951)

Git's history inspection tools — `git log`, `git diff`, `git blame`, and `git show` — are essential for understanding what changed, when, and by whom. These are the commands you reach for during code review, debugging, and post-incident analysis.

## git log — The Commit Timeline

The commit log is a reverse-chronological list of every commit in the current branch's history, showing who made each change, when, and why (the commit message). Each entry includes a SHA hash (a unique commit identifier), author, date, and message. The log is your primary tool for understanding how a codebase evolved over time.

```bash
# Compact one-line-per-commit history
git log --oneline

# Last 10 commits
git log --oneline -10

# ASCII branch graph of all branches
git log --oneline --graph --all

# Filter by author and date range
git log --author="alice" --since="2 weeks ago"

# History of a specific file (-- separates paths from branches)
git log -- path/to/file.py

# Branch topology with decorations
git log --oneline --graph --decorate -20
```

### git log — Useful Log Formats

```bash
# Show commit count per author
git shortlog -sn
# -s = summary (count only), -n = sort by count

# Show commits with their full diff
git log -p -- path/to/file.py
# -p = patch: include the full diff for each commit

# Search commit messages for a keyword
git log --grep="fix" --oneline
# --grep="fix" — only show commits where the message contains "fix"

# Find commits that added or removed a specific string (pickaxe)
git log -S "deadlock" --oneline
# -S "deadlock" — show commits that changed the count of this string
# Useful for: "When was this function/variable introduced or removed?"
```

---

## git diff — What Changed

> [!info] Two-dot vs three-dot diff
>
> `git diff main..branch` compares the tips directly. `git diff main...branch` (three dots) shows only what changed on the branch since it diverged from main — this is what you want for PR previews.

```bash
# Unstaged changes (working directory vs last commit)
git diff

# Staged changes (what goes into the next commit)
git diff --staged                   # synonym: --cached

# All changes on your branch vs main (from divergence point)
git diff main...feat/my-branch

# Changes from the last 3 commits
git diff HEAD~3

# Summary: only filenames that changed
git diff --name-only main...HEAD
```

### git diff — Output Interpretation

```
diff --git a/pipeline/load.py b/pipeline/load.py
index 3c4a5b6..7d8e9f0 100644
--- a/pipeline/load.py         ← old version
+++ b/pipeline/load.py         ← new version
@@ -42,7 +42,9 @@              ← line numbers: -42 (old start), +42 (new start), 7/9 lines shown
 def load_ohlcv(data):
-    rows = []                  ← red: deleted line
+    inserts = []               ← green: added line
+    updates = []               ← green: added line
     for row in data:
```

---

## git blame — Who Changed Each Line

Blame shows who last modified each line of a file and in which commit. Despite the name, it is a diagnostic tool, not an accusation — it answers "who wrote this line and when?" which is essential for understanding why code looks the way it does. Combined with `git show`, blame lets you trace any line back to the commit that introduced it.

> [!info] Blame traces line authorship
>
> Annotates each line with the commit, author, and date of last change. Despite the name, it is a diagnostic tool — use it to understand why code looks the way it does.

```bash
git blame src/transform.py
```

#### git blame — output format

```
^cd97a43 (alice 2026-03-10 14:22:31 +0100  42) def transform_ohlcv(df):
7b8c9d0e (bob   2026-03-12 09:15:42 +0100  43)     df = df.dropna()
```

Each line shows: `commit-sha (author date line-number) code`

```bash
# Blame ignoring whitespace changes
git blame -w src/transform.py
# -w — ignore whitespace-only changes

# Show original commit (useful after file renames)
git blame -C src/transform.py
# -C — detect lines moved from other files in the same commit
```

---

### git show — Inspect a Commit

> [!info] Show inspects any commit or file
>
> Displays the full metadata and diff for a specific commit. The `ref:path` syntax retrieves a file's content at any point in history — useful for comparing current code against a known-good version.

```bash
# Full details of a specific commit
git show cd97a43

# File content at a specific commit
git show HEAD:src/config.py

# Content at a specific branch or tag
git show main:src/config.py
git show v1.0.0:src/config.py
```

---

## Finding Changes Quickly

### When Did a Bug Appear? — git bisect

Bisect uses binary search to find the exact commit that introduced a bug. You tell Git "this commit is good" and "this commit is bad," and it automatically checks out the midpoint for you to test. After a few iterations, it pinpoints the exact commit that broke things — far faster than checking every commit manually.

```bash
git bisect start
git bisect bad              # current commit is broken
git bisect good abc1234     # this old commit was working
# Git checks out middle commits. Test each one:
git bisect good   # or bad
# Repeat until Git finds the culprit
git bisect reset
```

Git plays "hot or cold" with your commits (binary search) to find exactly where the bug was introduced. Works on any codebase size in O(log n) steps.

> [!warning] Bisect requires full history
>
> `git bisect` needs access to the full commit range between the good and bad commits. It does not work in shallow clones (`--depth 1`). Run `git fetch --unshallow` first if needed. Also, if your test at a bisect checkpoint is flaky, marking a commit incorrectly as good/bad will send bisect down the wrong path.

### What Files Changed in a PR? — diff summary

```bash
# Files changed between main and current branch
git diff --name-only main...HEAD

# Files changed with line count statistics
git diff --stat main...HEAD
```

### Who Changed This? — blame + log combination

```bash
# Find who last changed a specific line (e.g., line 42)
git blame -L 42,42 src/transform.py

# Then get the full commit details
git show <commit-sha>

# Or see what else that commit touched
git show <commit-sha> --stat
```

---

### Quick Reference Cheat Sheet

| Command | Purpose |
|---------|---------|
| `git log --oneline -20` | Last 20 commits, compact |
| `git log --oneline --graph --all` | All branches visualized |
| `git log --author="alice"` | Only alice's commits |
| `git log -- file.py` | Commits that touched this file |
| `git log -S "keyword"` | Commits that added/removed a string |
| `git diff` | Unstaged changes |
| `git diff --staged` | Staged changes (what's in next commit) |
| `git diff main...HEAD` | All changes on your branch vs main |
| `git blame file.py` | Who wrote each line |
| `git show abc1234` | Full details of a commit |
| `git show HEAD:file.py` | File content at HEAD |

## Related

- [git-daily-workflow](https://alp78.github.io/elysium/08-Git/git-daily-workflow) — the daily git commands that generate history
- [git-recovery-and-undo](https://alp78.github.io/elysium/08-Git/git-recovery-and-undo) — using reflog and bisect to recover or diagnose
- [pull-requests-and-code-review](https://alp78.github.io/elysium/08-Git/pull-requests-and-code-review) — diff commands used during code review

## References

- [git log](https://git-scm.com/docs/git-log)
- [git diff](https://git-scm.com/docs/git-diff)
- [git blame](https://git-scm.com/docs/git-blame)
- [git show](https://git-scm.com/docs/git-show)
