---
type: reference
category: git
technology: [git]
tags: [git]
aliases: [git log, git diff, git blame, git show, git history, inspect commits, git log graph]
keywords: [git log, git diff, git blame, git show, oneline, graph, author, since, file history, commit history, diff staged, blame, who changed, inspect commit, show file at commit, bisect, shortlog]
description: "Commands for viewing and inspecting Git history — git log with filters and graph views, git diff for staged/unstaged changes, git blame for authorship, and git show for individual commits."
related:
  - "[[git-daily-workflow]]"
  - "[[git-recovery-and-undo]]"
  - "[[pull-requests-and-code-review]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git History and Inspection

Git's history inspection tools — `git log`, `git diff`, `git blame`, and `git show` — are essential for understanding what changed, when, and by whom. These are the commands you reach for during code review, debugging, and post-incident analysis.

## git log — The Commit Timeline

```bash
# Show compact one-line-per-commit history
git log --oneline
# log — display commit history
# --oneline — abbreviated SHA + message, one commit per line
# In plain English: Show me the list of all save points, one per line.

# Show only the last 10 commits
git log --oneline -10
# -10 — limit output to 10 entries

# Show ASCII branch graph of all branches
git log --oneline --graph --all
# --graph — draw ASCII branch/merge graph
# --all — include all branches (not just the current one)
# In plain English: Draw me a tree of all branches and how they connect.

# Filter commits by author and date range
git log --author="alice" --since="2 weeks ago"
# --author="alice" — only show commits by this author
# --since="2 weeks ago" — only commits after this date

# Show history of a specific file
git log -- path/to/file.py
# -- — separator: everything after is a file path (not a branch name)
# path/to/file.py — only show commits that touched this file
# In plain English: Show me the history of this specific file.

# Pretty log with all decorations (most useful for visualizing branch topology)
git log --oneline --graph --decorate -20
# --decorate — show branch names, tags, HEAD pointer alongside each commit
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

```bash
# Show unstaged changes (working directory vs last commit)
git diff
# diff — show line-by-line differences
# In plain English: What have I changed but not yet staged?

# Show staged changes (what will go into the next commit)
git diff --staged
# --staged — compare staging area vs last commit (synonym: --cached)
# In plain English: What have I staged and am about to commit?

# Show all changes between main and a branch (from divergence point)
git diff main...feat/my-branch
# main...feat/my-branch — three-dot syntax: show changes since the branches diverged
# In plain English: What's different between main and my branch? (Everything I've done on the branch.)

# Show changes from the last 3 commits
git diff HEAD~3
# HEAD~3 — three commits ago

# Show only the filenames that changed (summary view)
git diff --name-only main...HEAD
# --name-only — list only the file names, not the full diff
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

```bash
# Show who last modified each line of a file
git blame src/transform.py
# blame — annotate each line with the commit, author, and date of last change
# In plain English: Who wrote each line of this file? (Not for blaming — for understanding context.)
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

## git show — Inspect a Commit

```bash
# Show full details of a specific commit (message, author, diff)
git show cd97a43
# show — display the commit's metadata and changes
# cd97a43 — the commit SHA (abbreviated)
# In plain English: Show me exactly what this commit changed.

# Show a file's content at a specific commit
git show HEAD:src/config.py
# HEAD:src/config.py — the file src/config.py as it existed at HEAD
# In plain English: Show me what this file looked like at that point in time.

# Show the content at a specific branch/tag
git show main:src/config.py
git show v1.0.0:src/config.py
```

---

## Finding Changes Quickly

### When Did a Bug Appear? — git bisect

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

## Quick Reference Cheat Sheet

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

- [[git-daily-workflow]] — the daily git commands that generate history
- [[git-recovery-and-undo]] — using reflog and bisect to recover or diagnose
- [[pull-requests-and-code-review]] — diff commands used during code review

## References

- [git log](https://git-scm.com/docs/git-log)
- [git diff](https://git-scm.com/docs/git-diff)
- [git blame](https://git-scm.com/docs/git-blame)
- [git show](https://git-scm.com/docs/git-show)
