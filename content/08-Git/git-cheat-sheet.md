---
type: reference
category: reference
technology: [git]
tags: [git, github]
aliases: [Git cheat sheet, git quick reference]
keywords: [git, cheat sheet, quick reference, status, add, commit, push, pull, branch, merge, rebase, stash, reset, revert, log, diff, blame, cherry-pick, reflog, tag, gh, github cli]
description: "Exhaustive CLI reference for Git and GitHub CLI — config, staging, committing, branching, merging, rebasing, remotes, history, stashing, undo, tags, and gh commands."
related:
  - "[[git-daily-workflow]]"
  - "[[git-branching-and-merging]]"
  - "[[git-recovery-and-undo]]"
  - "[[pull-requests-and-code-review]]"
  - "[[git-common-errors]]"
  - "[[git-setup-and-config]]"
  - "[[git-remote-management]]"
  - "[[git-tagging-and-releases]]"
created: 2026-03-22
updated: 2026-03-23
status: stable
---

# Git Cheat Sheet

## CLI Anatomy

```
git [--global-flags] COMMAND [--command-flags] [ARGS]
```

| Global Flag | Description |
|---|---|
| `--version` | Print Git version |
| `--help` | Show help |
| `-C PATH` | Run as if started in this directory |
| `-c KEY=VAL` | Set a config value for this invocation only |
| `--no-pager` | Don't pipe output through a pager |
| `--git-dir=PATH` | Set path to `.git` directory |
| `--work-tree=PATH` | Set path to working tree |
| `--exec-path` | Print path to git executables |
| `--bare` | Treat repository as a bare repository |

---

## Global Config

### `git config` — Read and Write Configuration

```
git config [OPTIONS] [SECTION.KEY [VALUE]]
```

| Flag | Description |
|---|---|
| `--global` | User-level config (`~/.gitconfig`) |
| `--local` | Repo-level config (`.git/config`) — default |
| `--system` | System-level config (`/etc/gitconfig`) |
| `--list` | List all config variables and their values |
| `--list --show-origin` | List with the file that defines each value |
| `--get KEY` | Get value of a single key |
| `--get-all KEY` | Get all values for a multi-valued key |
| `--unset KEY` | Remove a key |
| `--unset-all KEY` | Remove all values for a multi-valued key |
| `--add KEY VAL` | Add without removing existing values |
| `-e, --edit` | Open config file in editor |
| `--show-origin` | Show origin file alongside values |
| `--show-scope` | Show scope (system/global/local/worktree) |
| `--type TYPE` | Value type: `bool`, `int`, `bool-or-int`, `path`, `expiry-date`, `color` |

#### Essential settings

| Key | Example Value | Purpose |
|---|---|---|
| `user.name` | `"Ada Lovelace"` | Commit author name |
| `user.email` | `"ada@example.com"` | Commit author email |
| `user.signingkey` | `ABCD1234` | GPG key for signing |
| `commit.gpgsign` | `true` | Sign all commits |
| `core.editor` | `"code --wait"` | Default editor |
| `core.autocrlf` | `input` | Line ending conversion (`true`/`false`/`input`) |
| `core.excludesfile` | `~/.gitignore_global` | Global gitignore |
| `core.pager` | `"delta"` | Pager program for diffs/log |
| `core.whitespace` | `fix` | Handle trailing whitespace |
| `init.defaultBranch` | `main` | Default branch for `git init` |
| `pull.rebase` | `true` | Always rebase on pull |
| `push.default` | `current` | Default push behavior |
| `push.autoSetupRemote` | `true` | Auto-set upstream on push |
| `fetch.prune` | `true` | Auto-prune on fetch |
| `rebase.autosquash` | `true` | Auto-arrange fixup!/squash! commits |
| `rebase.autostash` | `true` | Auto-stash before rebase |
| `merge.ff` | `false` | Always create merge commits |
| `merge.tool` | `vimdiff` | Merge conflict resolution tool |
| `diff.tool` | `vimdiff` | Diff viewer |
| `alias.lg` | `log --oneline --graph --all` | Custom alias |
| `credential.helper` | `osxkeychain` / `manager` | Credential storage |
| `url."git@github.com:".insteadOf` | `"https://github.com/"` | SSH instead of HTTPS |
| `color.ui` | `auto` | Colored output |
| `log.date` | `relative` | Date format in log |

```bash
# Common setup commands
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.editor "code --wait"
git config --global push.autoSetupRemote true

# List all config with origins
git config --list --show-origin --show-scope

# Read a single value
git config --get user.email
git config --global --get core.editor

# Edit config directly
git config --global --edit
```

#### Credential helpers

```bash
git config --global credential.helper osxkeychain       # macOS
git config --global credential.helper manager            # Windows (Git Credential Manager)
git config --global credential.helper store              # Plaintext file (~/.git-credentials) — insecure
git config --global credential.helper cache              # In-memory, 15 min default
git config --global credential.helper "cache --timeout=3600"
```

---

## Staging and Committing

### `git add` — Stage Changes

```
git add [OPTIONS] [PATHSPEC...]
```

| Flag | Description |
|---|---|
| `.` | Stage all changes in current directory (new, modified, deleted) |
| `-A, --all` | Stage all changes in entire working tree |
| `-p, --patch` | Interactively select hunks to stage |
| `-u, --update` | Stage modifications and deletions only (not untracked files) |
| `-i, --interactive` | Interactive staging menu |
| `-n, --dry-run` | Show what would be added without staging |
| `-f, --force` | Allow adding ignored files |
| `-e, --edit` | Open diff in editor; edit hunks manually |
| `--chmod=+x` | Set executable bit on staged file |
| `--intent-to-add` | Register path but don't stage content (useful for `git diff`) |

```bash
git add .                              # Stage all in cwd
git add -A                             # Stage all in repo
git add src/                           # Stage entire directory
git add -p                             # Interactive hunk selection
git add -p FILE                        # Selective staging for one file
git add -u                             # Stage only tracked file changes
git add -n .                           # Dry run: see what would be staged
git add -f .env.example                # Force-add an ignored file
```

---

### `git commit` — Record Changes

```
git commit [OPTIONS] [FILE...]
```

| Flag | Description |
|---|---|
| `-m MSG` | Commit message (repeatable for subject + body) |
| `-a, --all` | Stage all tracked modified/deleted files then commit |
| `--amend` | Modify the last commit (message, staged content, or both) |
| `--no-edit` | Amend without changing the message |
| `--allow-empty` | Create commit even with no changes |
| `--allow-empty-message` | Commit without a message |
| `--fixup=COMMIT` | Create a fixup commit for `--autosquash` |
| `--squash=COMMIT` | Create a squash commit for `--autosquash` |
| `--signoff, -s` | Append `Signed-off-by` trailer |
| `-S, --gpg-sign` | GPG-sign the commit |
| `--no-gpg-sign` | Disable signing for this commit |
| `--verbose, -v` | Show diff in commit message editor |
| `--dry-run` | Show what would be committed |
| `--reset-author` | Reset author date/identity with `--amend` |
| `--author="Name <email>"` | Override commit author |
| `--date=DATE` | Override commit date |
| `--no-verify` | Skip pre-commit and commit-msg hooks |
| `--trailer KEY:VAL` | Add trailer to commit message |

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve null pointer in parser" -m "Closes #42"  # Multi-paragraph
git commit -am "fix: quick patch for tracked files"    # Stage + commit tracked changes
git commit --amend -m "correct: fixed commit message"  # Rewrite last commit message
git commit --amend --no-edit                           # Add staged changes to last commit
git commit --allow-empty -m "chore: trigger CI"
git commit --fixup HEAD~1                              # Mark as fixup for previous commit
git commit --signoff -m "docs: update readme"
git commit --author="Bot <bot@ci.example.com>" -m "chore: automated update"
```

---

### `git status` — Working Tree Status

```
git status [OPTIONS] [PATHSPEC...]
```

| Flag | Description |
|---|---|
| `-s, --short` | Short format output |
| `-b, --branch` | Show branch info in short format |
| `--porcelain[=v2]` | Machine-readable output |
| `-u, --untracked-files[=MODE]` | Show untracked: `no`, `normal`, `all` |
| `--ignored[=MODE]` | Show ignored files |
| `--ahead-behind` | Show counts vs upstream |

```bash
git status                             # Standard output
git status -sb                         # Short + branch info
git status --porcelain=v2              # Scripting-friendly
```

---

### `git diff` — Show Changes

```
git diff [OPTIONS] [COMMIT] [--] [PATHSPEC...]
```

| Flag / Form | Description |
|---|---|
| `git diff` | Unstaged changes (working tree vs index) |
| `git diff --staged` | Staged changes (index vs HEAD) — alias: `--cached` |
| `git diff HEAD` | All uncommitted changes (working tree + staged vs HEAD) |
| `git diff BRANCH1..BRANCH2` | Changes between tips of two branches |
| `git diff BRANCH1...BRANCH2` | Changes since common ancestor (three-dot) |
| `git diff COMMIT` | Working tree vs commit |
| `git diff COMMIT1 COMMIT2` | Between two commits |
| `--stat` | Summary: files changed, insertions, deletions |
| `--name-only` | Only file names |
| `--name-status` | File names with change type (M/A/D/R) |
| `--word-diff` | Word-level diff |
| `--word-diff=color` | Color-only word diff |
| `-U N` | N lines of context (default 3) |
| `--ignore-space-change` | Ignore whitespace amount changes |
| `--ignore-all-space` | Ignore all whitespace |
| `-w` | Alias for `--ignore-all-space` |
| `-- PATH` | Limit to specific path(s) |
| `--diff-filter=ACM` | Filter by change type: A=Added, C=Copied, D=Deleted, M=Modified, R=Renamed |

```bash
git diff                               # Unstaged
git diff --staged                      # Staged
git diff HEAD                          # All changes since last commit
git diff main..feature                 # Branch comparison
git diff main...feature                # Only feature-branch changes
git diff --stat HEAD~5..HEAD          # Summary of last 5 commits
git diff --name-only HEAD~1            # Files changed in last commit
git diff -w --word-diff src/           # Word diff, ignore whitespace
git diff HEAD -- src/app.js            # Single file diff vs HEAD
```

---

### `git rm` and `git mv`

```bash
git rm FILE                            # Remove from index and working tree
git rm --cached FILE                   # Remove from index only (keep file on disk)
git rm -r DIR/                         # Recursively remove directory
git rm -f FILE                         # Force remove (even if modified)
git rm --dry-run FILE                  # Preview what would be removed

git mv SRC DST                         # Rename/move file (updates index)
git mv -f SRC DST                      # Force overwrite destination
```

---

### `git restore` — Discard Changes

```
git restore [OPTIONS] [PATHSPEC...]
```

| Flag | Description |
|---|---|
| `-s, --source TREE` | Restore from this tree-ish (default: index or HEAD) |
| `-S, --staged` | Restore the index (unstage) |
| `-W, --worktree` | Restore working tree (default) |
| `-p, --patch` | Interactively select hunks to restore |
| `--` | Separate pathspec from options |

```bash
git restore FILE                       # Discard unstaged changes in FILE
git restore .                          # Discard all unstaged changes
git restore --staged FILE              # Unstage FILE (keep changes in working tree)
git restore --staged .                 # Unstage everything
git restore --source HEAD~2 FILE       # Restore FILE from 2 commits ago
git restore -p FILE                    # Interactively discard hunks
```

---

## Branching

### `git branch` — Manage Branches

```
git branch [OPTIONS] [BRANCH] [START_POINT]
```

| Flag | Description |
|---|---|
| (none) | List local branches |
| `-a, --all` | List all branches (local + remote) |
| `-r, --remotes` | List remote-tracking branches |
| `-v` | Show last commit on each branch |
| `-vv` | Show upstream tracking info |
| `--merged [COMMIT]` | Branches merged into current or COMMIT |
| `--no-merged [COMMIT]` | Branches not merged |
| `-d, --delete BRANCH` | Delete merged branch |
| `-D BRANCH` | Force delete (even if unmerged) |
| `-m, --move OLD NEW` | Rename branch |
| `-M OLD NEW` | Force rename |
| `-c, --copy OLD NEW` | Copy branch |
| `-C OLD NEW` | Force copy |
| `-u, --set-upstream-to REMOTE/BRANCH` | Set upstream tracking |
| `--unset-upstream` | Remove upstream tracking |
| `--contains COMMIT` | Branches containing this commit |
| `--sort KEY` | Sort: `-committerdate`, `refname`, `version:refname` |
| `--format TEMPLATE` | Custom output format |

```bash
git branch                             # List local
git branch -a                          # List all (local + remote)
git branch -vv                         # Show upstream tracking
git branch --merged main               # Branches merged into main
git branch --no-merged main            # Not yet merged
git branch -d feature/login            # Delete merged branch
git branch -D feature/abandoned        # Force delete
git branch -m old-name new-name        # Rename
git branch --set-upstream-to origin/main main   # Set tracking
git branch --contains abc1234          # Which branches have this commit
git branch --sort=-committerdate       # Sort by most recent commit
```

---

### `git switch` — Switch Branches (Modern)

```
git switch [OPTIONS] BRANCH
```

| Flag | Description |
|---|---|
| `-c, --create BRANCH` | Create and switch |
| `-C BRANCH` | Force create (reset if exists) |
| `--detach` | Detach HEAD at commit |
| `--orphan BRANCH` | Create orphan branch (no history) |
| `-t, --track` | Set upstream tracking when creating |
| `--no-track` | Don't set upstream tracking |
| `-q, --quiet` | Suppress feedback messages |
| `-m, --merge` | Merge local changes into new branch |
| `--discard-changes` | Throw away local modifications |

```bash
git switch main                        # Switch to main
git switch -c feat/new-feature         # Create and switch
git switch -c feat/based --track origin/main  # Create tracking branch
git switch --detach v1.2.0             # Detach at a tag
git switch --orphan gh-pages           # New empty branch
```

---

### `git checkout` — Legacy Branch / File Switching

```bash
git checkout BRANCH                    # Switch branch
git checkout -b BRANCH                 # Create and switch
git checkout -b BRANCH origin/BRANCH  # Track remote branch
git checkout -B BRANCH START           # Force create/reset
git checkout COMMIT -- FILE            # Restore file from commit
git checkout HEAD -- .                 # Restore all tracked files to HEAD
git checkout --                        # Discard all unstaged changes (dangerous)
git checkout --detach COMMIT           # Detach HEAD
```

> Prefer `git switch` and `git restore` for clarity. `git checkout` mixes branch switching and file restoration.

---

## Merging and Rebasing

### `git merge` — Join Branches

```
git merge [OPTIONS] [COMMIT...]
```

| Flag | Description |
|---|---|
| `--no-ff` | Always create merge commit (even for fast-forward) |
| `--ff-only` | Only merge if fast-forward is possible; else abort |
| `--squash` | Squash all branch commits into one staged changeset (no merge commit) |
| `--no-commit` | Perform merge but stop before committing |
| `--abort` | Abort in-progress merge |
| `--continue` | Continue after resolving conflicts |
| `--quit` | Abort merge, leave index as-is |
| `-m MSG` | Set merge commit message |
| `-s, --strategy STRATEGY` | Merge strategy: `recursive`, `resolve`, `octopus`, `ours`, `subtree` |
| `-X, --strategy-option OPT` | Strategy option: `ours`, `theirs`, `patience`, `diff-algorithm=`, `ignore-all-space` |
| `--log[=N]` | Include short log of merged commits in message |
| `--stat` | Show diffstat |
| `--verify-signatures` | Verify commit signatures |
| `--allow-unrelated-histories` | Merge repos with no common ancestor |
| `--rerere-autoupdate` | Apply recorded conflict resolutions automatically |

```bash
git merge feature/login                # Merge into current branch
git merge --no-ff feature/login        # Force merge commit
git merge --ff-only origin/main        # Safe pull-style merge
git merge --squash feature/spike       # Squash into one commit
git merge --no-commit --no-ff feature  # Inspect before committing
git merge -X theirs feature            # Auto-resolve conflicts with "their" side
git merge --allow-unrelated-histories other-repo/main
git merge --abort                      # Bail out of conflicted merge
```

---

### `git rebase` — Reapply Commits

```
git rebase [OPTIONS] [UPSTREAM [BRANCH]]
```

| Flag | Description |
|---|---|
| `-i, --interactive` | Interactive rebase — reorder, squash, edit, drop commits |
| `--onto NEW_BASE` | Rebase onto a different base |
| `--abort` | Abort and return to pre-rebase state |
| `--continue` | Continue after resolving conflicts |
| `--skip` | Skip current conflicting commit |
| `--quit` | Abort but leave HEAD where it is |
| `--autosquash` | Auto-arrange `fixup!` / `squash!` commits |
| `--autostash` | Stash changes before rebase, restore after |
| `--no-verify` | Skip pre-rebase hook |
| `--exec CMD` | Run command after each rebased commit |
| `-S, --gpg-sign` | GPG-sign rebased commits |
| `--rebase-merges` | Preserve merge commits in interactive rebase |
| `--update-refs` | Update intermediate branch refs during rebase |
| `-r, --rebase-merges` | Include merge commits |
| `-f, --force-rebase` | Re-run all commits even if already up-to-date |
| `-m, --merge` | Use merge strategy |
| `-X OPTION` | Pass strategy option |

```bash
git rebase main                        # Rebase current branch onto main
git rebase -i HEAD~5                   # Interactive: last 5 commits
git rebase -i --autosquash main        # Auto-arrange fixups
git rebase --onto main feature~3 feature  # Graft 3 commits onto main
git rebase --abort                     # Give up
git rebase --continue                  # After resolving conflict
git rebase --exec "npm test" main      # Run tests after each commit
git rebase --autostash main            # Stash dirty state first
```

#### Interactive rebase commands

| Command | Abbreviation | Effect |
|---|---|---|
| `pick` | `p` | Use commit as-is |
| `reword` | `r` | Use commit, edit its message |
| `edit` | `e` | Use commit, pause to amend |
| `squash` | `s` | Meld into previous commit, edit combined message |
| `fixup` | `f` | Meld into previous commit, discard this message |
| `fixup -C` | — | Meld, use only this commit's message |
| `drop` | `d` | Remove this commit entirely |
| `exec` | `x` | Run shell command |
| `break` | `b` | Pause here (useful for `--edit`) |
| `label` | `l` | Label current HEAD |
| `reset` | `t` | Reset HEAD to a label |
| `merge` | `m` | Create a merge commit |

---

### `git cherry-pick` — Apply Specific Commits

```
git cherry-pick [OPTIONS] COMMIT [COMMIT...]
```

| Flag | Description |
|---|---|
| `-n, --no-commit` | Apply changes but don't commit |
| `-x` | Append original commit reference to message |
| `-e, --edit` | Edit commit message |
| `-s, --signoff` | Add Signed-off-by |
| `--abort` | Abort in-progress cherry-pick |
| `--continue` | Continue after resolving conflict |
| `--skip` | Skip current and continue |
| `--quit` | Abort, leave HEAD as-is |
| `-m N, --mainline N` | When cherry-picking a merge commit, N is parent number |
| `--strategy-option OPT` | Conflict resolution: `ours`, `theirs` |
| `--allow-empty` | Allow cherry-picking empty commits |

```bash
git cherry-pick abc1234                 # Apply single commit
git cherry-pick abc1234 def5678         # Multiple commits
git cherry-pick abc1234..def5678        # Range (exclusive of abc1234)
git cherry-pick abc1234^..def5678       # Range (inclusive)
git cherry-pick -n abc1234              # Apply without committing
git cherry-pick -x abc1234             # Include "cherry picked from..." in message
git cherry-pick --abort                 # Cancel
git cherry-pick --continue              # After resolving conflict
```

---

## Remote Operations

### `git remote` — Manage Remote Connections

```bash
git remote                             # List remote names
git remote -v                          # List with URLs
git remote add NAME URL                # Add a remote
git remote add origin https://github.com/user/repo.git
git remote add upstream https://github.com/upstream/repo.git
git remote remove NAME                 # Remove a remote
git remote rename OLD NEW              # Rename a remote
git remote set-url NAME URL            # Change URL
git remote set-url --push NAME URL     # Change push URL only
git remote get-url NAME                # Print URL
git remote show NAME                   # Detailed info (tracked branches, fetch/push)
git remote prune NAME                  # Remove stale remote-tracking references
git remote update                      # Fetch from all remotes
git remote update --prune              # Fetch all + prune
```

---

### `git fetch` — Download Without Merging

```
git fetch [OPTIONS] [REMOTE] [REFSPEC...]
```

| Flag | Description |
|---|---|
| `--all` | Fetch from all remotes |
| `--prune, -p` | Remove remote-tracking branches that no longer exist on remote |
| `--tags, -t` | Fetch all tags |
| `--no-tags` | Don't fetch tags |
| `--depth N` | Limit fetch to N commits deep (shallow clone) |
| `--unshallow` | Convert shallow clone to full |
| `--dry-run` | Show what would be fetched |
| `-q, --quiet` | Quiet output |
| `--recurse-submodules` | Also fetch submodules |
| `-j N, --jobs N` | Parallel fetch jobs |
| `--atomic` | Use atomic transaction |

```bash
git fetch                              # Fetch from origin
git fetch origin                       # Explicit
git fetch origin main                  # Fetch specific branch
git fetch --all --prune                # All remotes, prune deleted branches
git fetch --tags                       # Also fetch all tags
git fetch origin refs/pull/42/head:pr-42   # Fetch GitHub PR locally
```

---

### `git pull` — Fetch and Integrate

```
git pull [OPTIONS] [REMOTE] [REFSPEC]
```

| Flag | Description |
|---|---|
| `--rebase[=false/true/merges/interactive]` | Rebase instead of merge |
| `--no-rebase` | Force merge even if `pull.rebase=true` |
| `--ff-only` | Fail if not fast-forward |
| `--no-ff` | Always create merge commit |
| `--autostash` | Stash dirty changes before pull, restore after |
| `--prune` | Remove stale remote-tracking refs |
| `--tags` | Fetch tags |
| `--depth N` | Deepen shallow clone |
| `-q, --quiet` | Suppress output |
| `-v, --verbose` | Verbose |
| `-j N` | Parallel jobs for submodules |

```bash
git pull                               # Pull from upstream of current branch
git pull origin main                   # Explicit remote and branch
git pull --rebase                      # Rebase instead of merge (clean history)
git pull --rebase=interactive          # Interactive rebase on pull
git pull --ff-only                     # Only if fast-forward possible
git pull --autostash --rebase          # Stash, pull, unstash
git pull --prune                       # Also prune deleted branches
```

---

### `git push` — Full Anatomy

```
git push [OPTIONS] [REMOTE] [REFSPEC]
```

| Flag | Description |
|---|---|
| `-u, --set-upstream` | Set upstream tracking for this branch |
| `--force, -f` | Force push — overwrites remote history (DESTRUCTIVE) |
| `--force-with-lease` | Force push only if remote matches expected state (safer) |
| `--force-with-lease=REFNAME:EXPECTED` | Check specific ref/value |
| `--force-if-includes` | Require that remote changes are integrated locally |
| `--tags` | Push all tags |
| `--follow-tags` | Push only reachable, annotated tags |
| `--delete, -d` | Delete remote branch or tag |
| `--dry-run` | Show what would be pushed without pushing |
| `--porcelain` | Machine-readable output |
| `-q, --quiet` | Suppress output |
| `-v, --verbose` | Verbose output |
| `--push-option=OPT` | Transmit string to server-side hooks |
| `--no-verify` | Skip pre-push hook |
| `--mirror` | Mirror all refs to remote |
| `--prune` | Remove remote branches that don't exist locally |
| `--recurse-submodules=check/on-demand` | Submodule handling |
| `--atomic` | Atomic push for multiple refs |

```bash
# First push + set upstream
git push -u origin feat/new-feature

# Normal push after upstream is set
git push

# Force push after rebase (prefer --force-with-lease)
git push --force-with-lease origin feature/rebased

# Delete remote branch
git push origin --delete old-feature
git push origin :old-feature             # Equivalent shorthand

# Push a specific local branch to a differently-named remote branch
git push origin local-branch:remote-branch

# Push a tag
git push origin v1.2.0

# Push all tags
git push --tags

# Delete a remote tag
git push origin --delete v1.0.0-beta
git push origin :refs/tags/v1.0.0-beta

# Dry run
git push --dry-run origin main

# Push to multiple remotes
git push origin main && git push backup main
```

---

## History and Inspection

### `git log` — Show Commit History

```
git log [OPTIONS] [REVISION RANGE] [[--] PATH]
```

| Flag / Form | Description |
|---|---|
| `--oneline` | Compact one-line per commit |
| `--graph` | ASCII branch/merge graph |
| `--all` | Show all branches and tags |
| `--decorate` | Show ref names next to commits |
| `--stat` | Diffstat for each commit |
| `-p, --patch` | Full diff for each commit |
| `--format=FORMAT` | Custom format (see below) |
| `--pretty=FORMAT` | Alias for `--format` |
| `-N` | Limit to N commits |
| `--author=PATTERN` | Filter by author (regex) |
| `--committer=PATTERN` | Filter by committer |
| `--since=DATE` | After this date (`2 weeks ago`, `2026-01-01`) |
| `--until=DATE` | Before this date |
| `--after=DATE` | Alias for `--since` |
| `--before=DATE` | Alias for `--until` |
| `--grep=PATTERN` | Filter by commit message |
| `--all-match` | All `--grep` patterns must match (default: any) |
| `--invert-grep` | Show commits NOT matching `--grep` |
| `-S STRING` | Pickaxe: commits that add/remove STRING |
| `-G REGEX` | Pickaxe: commits where diff matches REGEX |
| `--diff-filter=FILTER` | Filter by change type |
| `--follow -- FILE` | Follow renames |
| `--no-merges` | Exclude merge commits |
| `--merges` | Only merge commits |
| `--first-parent` | Follow first parent only (useful for main branch) |
| `--simplify-by-decoration` | Only commits with associated refs |
| `--ancestry-path A..B` | Only on ancestry path between A and B |
| `--date=FORMAT` | Date format: `relative`, `short`, `iso`, `rfc`, `unix` |
| `--name-only` | Show only file names changed |
| `--name-status` | Show file names with change type |
| `--abbrev-commit` | Abbreviate commit hashes |
| `--full-diff` | Show full diff even for paths |
| `--cc` | Show combined diff for merge commits |
| `--reverse` | Show oldest first |

```bash
git log                                # Standard log
git log --oneline -20                  # Last 20, compact
git log --oneline --graph --all        # Visual branch graph
git log --oneline --decorate --graph --all   # Full graph with labels
git log --stat HEAD~10..HEAD           # Diffstats for last 10 commits
git log -p --follow -- src/old-name.js # History with renames + full diff
git log --author="Ada" --since="2 weeks ago"
git log --grep="fix" --no-merges
git log -S "function parseToken"       # When was this string added/removed
git log --diff-filter=D --name-only    # Files that were deleted
git log main..feature                  # Commits on feature not on main
git log --first-parent main            # Linear main branch history
git log --format="%h %an %ar %s"       # Custom: hash author date subject
git log --format="%H" -- src/          # All commit hashes touching src/
```

#### `--format` placeholders

| Placeholder | Meaning |
|---|---|
| `%H` | Full commit hash |
| `%h` | Abbreviated hash |
| `%T` | Tree hash |
| `%an` | Author name |
| `%ae` | Author email |
| `%ar` | Author date, relative |
| `%ad` | Author date (respects `--date=`) |
| `%cn` | Committer name |
| `%cr` | Committer date, relative |
| `%s` | Subject (first line of message) |
| `%b` | Body |
| `%D` | Ref names |
| `%Cred` | Switch to red color |
| `%Cgreen` | Switch to green |
| `%Cblue` | Switch to blue |
| `%Creset` | Reset color |
| `%n` | Newline |

---

### `git show` — Show Object Details

```bash
git show COMMIT                        # Full diff + metadata for commit
git show COMMIT:FILE                   # File content at a commit
git show --stat COMMIT                 # Summary only
git show --name-only COMMIT            # File names only
git show HEAD~3                        # Three commits ago
git show v1.2.0                        # Tag object
git show BRANCH:path/to/file           # File from another branch
```

---

### `git blame` — Line-by-Line Authorship

```
git blame [OPTIONS] [-L START,END] FILE
```

| Flag | Description |
|---|---|
| `-L START,END` | Restrict to line range (`-L 10,20`, `-L /regex/,+10`) |
| `-w` | Ignore whitespace changes |
| `-M` | Detect moved lines within the file |
| `-C` | Detect copied lines from other files in same commit |
| `-C -C` | Also search parent commits for copies |
| `-C -C -C` | Search all commits |
| `--show-email` | Show author email instead of name |
| `--show-stats` | Print statistics |
| `--porcelain` | Machine-readable output |
| `-s` | Suppress author name and timestamp |
| `-e` | Show email |
| `--since=DATE` | Ignore commits before date |
| `--reverse START..END` | Show when line was last present |
| `-n, --show-number` | Show line number in original file |

```bash
git blame FILE                         # Annotate whole file
git blame -L 50,100 FILE               # Lines 50-100 only
git blame -L '/function auth/',+20 FILE  # From regex match, next 20 lines
git blame -w -M FILE                   # Ignore whitespace, detect moves
git blame -C -C FILE                   # Detect copies from other files
git blame v1.0..HEAD -- FILE           # Blame within a range
```

---

### Other Inspection Commands

```bash
git shortlog                           # Summarize log by author
git shortlog -sn                       # Count commits per author, sorted
git shortlog -sne                      # With emails
git shortlog -sn HEAD~100..HEAD        # Last 100 commits

git reflog                             # Show history of HEAD movements
git reflog show BRANCH                 # Reflog for specific branch
git reflog --date=iso                  # With absolute timestamps

git rev-parse HEAD                     # Resolve to full SHA
git rev-parse --short HEAD             # Short SHA
git rev-parse --abbrev-ref HEAD        # Current branch name
git rev-parse --show-toplevel          # Repository root
git rev-parse --is-inside-work-tree    # Check if inside a repo
git rev-parse HEAD~3                   # SHA of 3 commits ago

git cat-file -t OBJECT                 # Type of object (blob/tree/commit/tag)
git cat-file -p OBJECT                 # Pretty-print object content
git ls-tree HEAD                       # List files in tree at HEAD
git ls-tree -r HEAD --name-only        # All files recursively
git count-objects -vH                  # Repository size details
```

---

## Stashing

### `git stash` — Save and Restore Work in Progress

```
git stash [SUBCOMMAND] [OPTIONS]
```

**push (default when just running `git stash`)**

```bash
git stash                              # Stash tracked changes (staged + unstaged)
git stash push -m "WIP: feature auth" # Named stash
git stash push -u                      # Include untracked files
git stash push -u -m "with untracked"
git stash push -k                      # Keep staged changes (only stash unstaged)
git stash push -p                      # Interactively select hunks to stash
git stash push -- src/                 # Stash only specific path(s)
git stash push --include-untracked -- src/
```

#### Other stash subcommands

| Subcommand | Description |
|---|---|
| `pop [stash@{N}]` | Apply and remove (default: most recent) |
| `apply [stash@{N}]` | Apply but keep in stash list |
| `list` | Show all stashes |
| `show [stash@{N}]` | Show diffstat |
| `show -p [stash@{N}]` | Show full diff |
| `drop [stash@{N}]` | Remove a specific stash |
| `clear` | Remove ALL stashes |
| `branch BRANCH [stash@{N}]` | Create branch from stash, then drop stash |

```bash
git stash list                         # All stashes
git stash show                         # Diffstat of latest stash
git stash show -p                      # Full diff of latest
git stash show stash@{2}               # Specific stash
git stash pop                          # Apply + remove latest
git stash pop stash@{1}               # Specific stash
git stash apply stash@{0}             # Apply without removing
git stash drop stash@{2}              # Remove specific stash
git stash clear                        # Nuke all stashes
git stash branch fix/restore-wip       # New branch from latest stash
```

---

## Undoing and Recovery

### `git reset` — Move HEAD and Optionally Index/Working Tree

```
git reset [OPTIONS] [COMMIT] [--] [PATHSPEC]
```

| Mode | Index (staging) | Working Tree | Use When |
|---|---|---|---|
| `--soft COMMIT` | Unchanged | Unchanged | Undo commit, keep all as staged |
| `--mixed COMMIT` | Reset to COMMIT | Unchanged | Undo commit + unstage (default) |
| `--hard COMMIT` | Reset to COMMIT | Reset to COMMIT | Discard everything (DESTRUCTIVE) |
| `--merge COMMIT` | Reset | Keep uncommitted | Abort failed merge, keep work |
| `--keep COMMIT` | Reset | Keep if no conflict | Switch commit, preserve local changes |

```bash
git reset --soft HEAD~1                # Undo last commit, keep staged
git reset HEAD~1                       # Undo last commit, unstage changes (--mixed)
git reset --hard HEAD~1                # Discard last commit entirely
git reset --hard HEAD                  # Discard ALL uncommitted changes
git reset --hard origin/main           # Reset to match remote
git reset HEAD FILE                    # Unstage FILE (same as: git restore --staged FILE)
git reset abc1234                      # Reset HEAD to specific commit (mixed)
```

> `--hard` discards work permanently (unless in reflog within 30 days).

---

### `git revert` — Create Undo Commits

```
git revert [OPTIONS] COMMIT [COMMIT...]
```

| Flag | Description |
|---|---|
| `-n, --no-commit` | Stage revert but don't commit |
| `-m N, --mainline N` | For merge commits: N=1 (keep first parent) or N=2 |
| `-e, --edit` | Open editor for revert message (default) |
| `--no-edit` | Don't open editor |
| `--abort` | Cancel in-progress revert |
| `--continue` | Continue after conflict resolution |
| `--skip` | Skip current commit |
| `-s, --signoff` | Add Signed-off-by |

```bash
git revert HEAD                        # Revert last commit
git revert abc1234                     # Revert specific commit
git revert HEAD~3..HEAD                # Revert last 3 commits (creates 3 revert commits)
git revert -n HEAD~3..HEAD             # Stage all reverts, commit once
git revert -m 1 MERGE_COMMIT          # Revert a merge commit (keep first parent)
git revert --no-edit HEAD~2..HEAD      # No editor prompts
```

---

### `git clean` — Remove Untracked Files

```
git clean [OPTIONS] [PATH]
```

| Flag | Description |
|---|---|
| `-n, --dry-run` | Show what would be removed |
| `-f, --force` | Required to actually delete |
| `-d` | Also remove untracked directories |
| `-x` | Also remove ignored files |
| `-X` | Remove ONLY ignored files |
| `-i, --interactive` | Interactive mode |
| `-q, --quiet` | Report only errors |
| `-e PATTERN` | Exclude pattern |

```bash
git clean -n                           # Preview: show what would be removed
git clean -nd                          # Preview including directories
git clean -ndx                         # Preview including ignored files
git clean -f                           # Remove untracked files
git clean -fd                          # Remove untracked files + directories
git clean -fdx                         # Remove everything including ignored
git clean -fX                          # Remove only ignored files (clean build artifacts)
git clean -i                           # Interactive
```

---

### Recovery with `git reflog`

```bash
git reflog                             # All HEAD movements with index
git reflog show BRANCH                 # Reflog for specific branch
git reflog --all                       # All refs

# Recover a dropped commit
git reflog                             # Find the SHA (e.g. HEAD@{3} = abc1234)
git checkout -b recovery abc1234       # Create branch at that commit
git cherry-pick abc1234                # Or just cherry-pick it

# Recover after accidental hard reset
git reset --hard HEAD@{1}             # Go back one reflog entry

# Recover deleted branch
git reflog | grep "branch-name"        # Find last SHA
git checkout -b branch-name abc1234   # Recreate
```

---

## Tags

### `git tag` — Manage Tags

```
git tag [OPTIONS] [TAGNAME] [COMMIT]
```

| Flag | Description |
|---|---|
| `-a, --annotate` | Create annotated tag (recommended for releases) |
| `-m MSG` | Tag message (implies `-a`) |
| `-s, --sign` | GPG-signed annotated tag |
| `-d, --delete TAGNAME` | Delete local tag |
| `-l, --list [PATTERN]` | List tags (supports glob: `v1.*`) |
| `--sort KEY` | Sort: `version:refname`, `-version:refname`, `creatordate` |
| `--contains COMMIT` | Tags containing a commit |
| `--merged COMMIT` | Tags merged into commit |
| `-f, --force` | Replace existing tag |
| `-v, --verify` | Verify GPG signature |
| `--format TEMPLATE` | Custom output format |

```bash
git tag                                # List all tags
git tag -l "v1.*"                      # Glob pattern
git tag --sort=-version:refname        # Sort newest semantic version first
git tag --sort=-creatordate            # Sort by creation date

git tag v1.0.0                         # Lightweight tag at HEAD
git tag v1.0.0 abc1234                 # Lightweight tag at commit
git tag -a v1.0.0 -m "Release 1.0.0"  # Annotated tag
git tag -s v1.0.0 -m "Signed release" # Signed tag

git tag -d v1.0.0                      # Delete local tag
git tag -f v1.0.0                      # Move existing tag to HEAD

# Push / delete remote tags
git push origin v1.0.0                 # Push single tag
git push --tags                        # Push all local tags
git push --follow-tags                 # Push only reachable annotated tags (recommended)
git push origin --delete v1.0.0-beta  # Delete remote tag
git push origin :refs/tags/v1.0.0-beta  # Equivalent delete

# Show tag
git show v1.0.0                        # Annotated tag details + tagged commit
```

---

## GitHub CLI (`gh`)

### `gh pr create` — Full Anatomy

```
gh pr create [OPTIONS]
```

| Flag | Description |
|---|---|
| `-t, --title TITLE` | PR title |
| `-b, --body BODY` | PR body text |
| `-F, --body-file FILE` | Read body from file |
| `-B, --base BRANCH` | Target branch (default: repo default branch) |
| `-H, --head BRANCH` | Source branch (default: current) |
| `-d, --draft` | Create as draft PR |
| `-r, --reviewer LOGIN[,...]` | Request reviewers |
| `-a, --assignee LOGIN[,...]` | Assign users |
| `-l, --label NAME[,...]` | Add labels |
| `-m, --milestone NAME` | Add to milestone |
| `-p, --project NAME` | Add to project |
| `--fill` | Auto-fill title/body from commit messages |
| `--fill-first` | Use first commit's subject and body |
| `--no-maintainer-edit` | Prevent maintainer from editing |
| `-w, --web` | Open in browser instead |
| `--template FILE` | Use PR template |
| `--recover FILE` | Resume failed PR creation |

```bash
gh pr create --title "feat: add login" --body "Adds OAuth login flow"
gh pr create --fill                    # Auto-fill from commits
gh pr create --draft --fill            # Draft PR
gh pr create -B main -H feat/login -r alice,bob -l "enhancement"
gh pr create --body-file PULL_REQUEST_TEMPLATE.md
```

---

### `gh pr merge` — Full Anatomy

```
gh pr merge [NUMBER | URL | BRANCH] [OPTIONS]
```

| Flag | Description |
|---|---|
| `--merge` | Merge commit |
| `--squash` | Squash and merge |
| `--rebase` | Rebase and merge |
| `-d, --delete-branch` | Delete branch after merge |
| `--auto` | Enable auto-merge (merges when checks pass) |
| `--disable-auto` | Disable auto-merge |
| `-b, --body BODY` | Merge commit message body |
| `-t, --subject SUBJECT` | Merge commit subject |
| `--admin` | Merge even if checks haven't passed (admin rights) |
| `--match-head-commit SHA` | Ensure HEAD matches SHA before merging |

```bash
gh pr merge 42 --squash --delete-branch
gh pr merge --rebase --delete-branch   # Merge current branch's PR
gh pr merge 42 --merge --auto          # Auto-merge when checks pass
gh pr merge 42 --squash -t "feat: login" -b "Implements OAuth"
```

---

### GitHub CLI — Pull Request Commands

```bash
# List / view
gh pr list                             # Open PRs
gh pr list --state all                 # All states
gh pr list --author "@me"             # My PRs
gh pr list --label bug                 # By label
gh pr list --base main                 # Targeting main
gh pr list --draft                     # Draft PRs
gh pr view 42                          # PR details
gh pr view 42 --web                    # Open in browser
gh pr view --json title,body,reviews   # JSON fields
gh pr diff 42                          # Show diff

# Checkout
gh pr checkout 42                      # Check out PR branch locally
gh pr checkout 42 --detach             # Detached HEAD

# Status
gh pr status                           # Status of PRs involving you
gh pr checks 42                        # CI check status
gh pr checks 42 --watch                # Watch checks until complete

# Review
gh pr review 42 --approve              # Approve
gh pr review 42 --request-changes -b "Needs tests"
gh pr review 42 --comment -b "LGTM"
gh pr ready 42                         # Mark draft PR as ready

# Edit / close
gh pr edit 42 --title "new title" --body "updated body"
gh pr edit 42 --add-label "bug" --remove-label "wip"
gh pr edit 42 --add-reviewer alice
gh pr close 42                         # Close without merging
gh pr close 42 --comment "Not needed"
gh pr reopen 42
gh pr lock 42 --reason resolved
```

---

### GitHub CLI — Issue Commands

```bash
gh issue list                          # Open issues
gh issue list --state all --label bug
gh issue list --author "@me" --assignee "@me"
gh issue view 99                       # View issue
gh issue view 99 --web

gh issue create --title "Bug: crash on login" --body "Steps to reproduce..."
gh issue create --label bug --assignee alice --milestone v2.0
gh issue create --template bug_report.md

gh issue edit 99 --title "new title"
gh issue edit 99 --add-label "confirmed" --remove-label "needs-triage"
gh issue edit 99 --assignee alice

gh issue comment 99 --body "Fixed in #42"
gh issue close 99 --comment "Closed by #42" --reason completed
gh issue reopen 99
gh issue pin 99
gh issue transfer 99 REPO
gh issue delete 99 --yes
```

---

### GitHub CLI — Workflow Commands

```bash
gh workflow list                        # List all workflows
gh workflow list --all                  # Including disabled
gh workflow view WORKFLOW               # Workflow details
gh workflow view WORKFLOW --yaml        # Show YAML definition

gh workflow run WORKFLOW                # Trigger manually (if workflow_dispatch)
gh workflow run WORKFLOW --ref BRANCH
gh workflow run WORKFLOW -f "param=value"
gh workflow run WORKFLOW --json         # JSON input

gh workflow enable WORKFLOW
gh workflow disable WORKFLOW

gh run list                             # Recent workflow runs
gh run list --workflow WORKFLOW
gh run list --status failure
gh run list --branch main --limit 20
gh run view RUN_ID                      # Run details
gh run view RUN_ID --log                # Full log output
gh run view RUN_ID --log-failed        # Only failed step logs
gh run watch RUN_ID                     # Live watch
gh run cancel RUN_ID                    # Cancel running workflow
gh run rerun RUN_ID                     # Re-run all jobs
gh run rerun RUN_ID --failed            # Re-run only failed jobs
gh run download RUN_ID                  # Download artifacts
gh run download RUN_ID -n ARTIFACT_NAME
```

---

### GitHub CLI — Release Commands

```bash
gh release list                         # List releases
gh release view TAG                     # View release details
gh release view --json tagName,body,assets

gh release create TAG                   # Create release (prompts for details)
gh release create v1.2.0 --title "v1.2.0" --notes "Release notes"
gh release create v1.2.0 --notes-file CHANGELOG.md
gh release create v1.2.0 --draft        # Draft release
gh release create v1.2.0 --prerelease   # Pre-release
gh release create v1.2.0 ./dist/*.tar.gz  # Attach assets
gh release create v1.2.0 ./bin/app#"Linux binary"  # Named asset

gh release edit TAG --title "new title" --notes "new notes"
gh release edit TAG --draft=false        # Publish draft

gh release upload TAG FILE [FILE...]    # Upload additional assets
gh release delete TAG --yes             # Delete release
gh release delete TAG --cleanup-tag --yes  # Also delete the git tag
```

---

### GitHub CLI — Repo Commands

```bash
gh repo clone OWNER/REPO               # Clone a repo
gh repo clone OWNER/REPO -- --depth 1  # With git flags after --

gh repo create NAME --public           # Create public repo
gh repo create NAME --private --clone  # Private + clone locally
gh repo create NAME --template OWNER/TEMPLATE

gh repo fork OWNER/REPO                # Fork to your account
gh repo fork OWNER/REPO --clone        # Fork + clone
gh repo fork OWNER/REPO --remote       # Add upstream remote

gh repo view                           # View current repo
gh repo view OWNER/REPO --web          # Open in browser

gh repo sync                           # Sync fork with upstream
gh repo sync --branch main

gh repo rename NEW_NAME
gh repo archive                        # Archive repo
gh repo delete --confirm

gh repo list [OWNER]                   # List your/org repos
gh repo list --fork --source --archived

gh repo set-default OWNER/REPO         # Set default repo for gh commands
```

---

### GitHub CLI — Auth Commands

```bash
gh auth login                          # Interactive login (browser or token)
gh auth login --with-token < token.txt # Non-interactive with token
gh auth login --hostname ENTERPRISE_URL  # GitHub Enterprise

gh auth logout                         # Remove stored credentials
gh auth logout --hostname HOST

gh auth status                         # Show current authentication state
gh auth status --show-token            # Include token value

gh auth token                          # Print current token
gh auth refresh                        # Refresh token scopes
gh auth refresh --scopes repo,read:org
gh auth setup-git                      # Configure git to use gh as credential helper
```

---

### `gh api` — Raw REST and GraphQL

```bash
# GET request
gh api repos/OWNER/REPO

# POST request
gh api repos/OWNER/REPO/issues -f title="Bug" -f body="Description"

# PATCH
gh api -X PATCH repos/OWNER/REPO -f description="new description"

# DELETE
gh api -X DELETE repos/OWNER/REPO/issues/comments/COMMENT_ID

# With pagination
gh api repos/OWNER/REPO/issues --paginate

# JSON output fields
gh api repos/OWNER/REPO --jq '.stargazers_count'
gh api repos/OWNER/REPO --jq '[.name, .description]'

# GraphQL
gh api graphql -f query='
  query($login: String!) {
    user(login: $login) {
      name
      bio
      repositories(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes { name stargazerCount }
      }
    }
  }
' -f login=octocat

# Template output
gh api repos/OWNER/REPO --template '{{.full_name}}: {{.stargazers_count}} stars'

# Flags
# -H, --header KEY:VAL   Add request header
# -f, --field KEY=VAL    Add string parameter
# -F, --raw-field KEY=VAL  Add raw (typed) parameter
# -q, --jq EXPR          Filter with jq
# --paginate             Fetch all pages
# --input FILE           Read JSON body from file
# --cache DURATION       Cache response
# --silent               Don't print response
# --include              Include response headers
```

---

### Branch Naming Conventions

| Prefix | Use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code restructuring without behavior change |
| `docs/` | Documentation changes |
| `chore/` | Maintenance, build, tooling |
| `test/` | Adding or fixing tests |
| `ci/` | CI/CD pipeline changes |
| `perf/` | Performance improvements |
| `hotfix/` | Urgent production fix (from main/release) |
| `release/` | Release preparation |
| `spike/` | Exploratory / throwaway experiment |

---

## Related

- [[git-daily-workflow]]
- [[git-branching-and-merging]]
- [[git-recovery-and-undo]]
- [[pull-requests-and-code-review]]
- [[git-common-errors]]
- [[git-setup-and-config]]
- [[git-remote-management]]
- [[git-tagging-and-releases]]
