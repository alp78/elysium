---
tags: [git, github]
type: reference
technology: git
status: stable
updated: 2026-03-23
description: "Comprehensive catalog of Git and GitHub problems in distributed data engineering teams — 25 issues ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures."
---

# Git and GitHub Problems in Distributed Teams

Git is the backbone of collaborative data engineering, but its power comes with footguns that multiply in distributed teams. When multiple engineers edit Airflow DAGs, SQL migrations, Terraform configs, and dbt models in the same repository, every problem below becomes a near-certainty. In a regulated financial index platform where audit trails matter and broken main means no index publication, these problems range from career-defining incidents to daily friction. This note catalogs each one with actionable prevention and recovery.

---

## Critical — Data Loss / Security Breach

### Secrets Committed to Repository

**What happens**

An engineer clones a new machine, copies their GCP service account JSON into the project root for a quick test, and runs `git add . && git commit -m "wip"`. The key is now in history. They delete the file in the next commit — but the secret is still fully accessible via `git log` or `git show`. On a GitHub-hosted repo, automated bots scan for API keys within seconds of every push.

**Root cause**

Git stores the entire working tree snapshot at every commit. Deleting a file in a subsequent commit only removes it from the working tree — the blob still exists in the object store and every clone carries it. History-rewriting tools must be used to truly expunge it, and even then every existing clone retains the data until re-cloned.

**Consequences**

- GCP service account key exfiltrated — attacker spins up compute, exfiltrates BigQuery financial data
- SQL Server password exposed — direct access to index calculation database; potential EU BMR audit violation
- Airflow connection credentials leaked — pipeline hijacked, poisoned index outputs
- If repo ever becomes public (permissions misconfiguration), exploit happens within minutes of exposure
- Incident must be reported under GDPR/SFDR if client data was accessible via the leaked credential
- Rotating credentials during market hours disrupts live index publication pipeline

**Prevention protocol**

1. Add a comprehensive `.gitignore` before the first commit (see template below).

2. Install `gitleaks` as a pre-commit hook:

```bash
# Install gitleaks
brew install gitleaks           # macOS
# or: choco install gitleaks    # Windows

# Install pre-commit framework
pip install pre-commit

# .pre-commit-config.yaml (repo root)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

```bash
# Enable for repo
pre-commit install

# Test it works
pre-commit run gitleaks --all-files
```

3. Enable GitHub secret scanning (Settings → Security → Secret scanning → Enable). GitHub Advanced Security scans every push and alerts on 100+ secret patterns from major cloud providers.

4. Add `detect-secrets` as a second layer:

```bash
pip install detect-secrets
detect-secrets scan > .secrets.baseline
# Add .secrets.baseline to version control

# Add to .pre-commit-config.yaml:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

5. Use environment variables or a secrets manager (HashiCorp Vault, GCP Secret Manager, Azure Key Vault) — never files on disk in the project directory.

6. `.gitignore` template for data engineering repos:

```gitignore
# Secrets & credentials
.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
service-account*.json
*-service-account.json
credentials.json
gcp_key*.json
secrets/
.secrets/

# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.venv/
venv/
env/
*.so

# dbt
target/
dbt_packages/
logs/
.dbt/profiles.yml

# Terraform
.terraform/
*.tfstate
*.tfstate.backup
*.tfvars
!example.tfvars
.terraform.lock.hcl   # optional — many teams commit this

# Airflow
airflow.cfg
airflow.db
standalone_admin_password.txt
logs/
plugins/

# Data files (use LFS or object storage instead)
*.parquet
*.csv
*.xlsx
*.db
*.sqlite
*.dump
*.sql.gz

# IDE
.idea/
.vscode/settings.json
*.suo
*.ntvs*
*.njsproj
*.sln.docstates
.DS_Store

# Node / frontend (C# API tooling)
node_modules/
dist/

# C# build artifacts
bin/
obj/
*.user
*.suo
.vs/
```

**Fix procedure**

> [!danger] Rotate Credentials First
>
> Rotate credentials FIRST — assume the secret is compromised the moment you discover it. Do not clean history before rotating. Cleaning history is housekeeping; rotating is security.

1. **Immediately rotate all exposed credentials.** Do not skip this step.

```bash
# Revoke the specific GCP key
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=SA_NAME@PROJECT.iam.gserviceaccount.com

# Create new key, store in Secret Manager — not a file
gcloud iam service-accounts keys create - \
  --iam-account=SA_NAME@PROJECT.iam.gserviceaccount.com \
  | gcloud secrets create my-sa-key --data-file=-
```

2. **Identify what was committed and in which commits:**

```bash
git log --all --full-history --diff-filter=A -- "*.json"
git log --oneline --all -S "service_account" -- .
```

3. **Clean history with `git filter-repo`** (preferred over `git filter-branch`):

```bash
pip install git-filter-repo

# Remove a specific file from all history
git filter-repo --path credentials.json --invert-paths

# Remove a file matching a pattern
git filter-repo --path-glob '*service-account*.json' --invert-paths

# Replace a literal secret string throughout history
git filter-repo --replace-text <(echo 'AIzaSy...ACTUAL_KEY==>REDACTED')
```

4. **Alternatively, use BFG Repo Cleaner** (faster for large repos):

```bash
# Download BFG
curl -O https://repo1.maven.org/maven2/com/madgik/bfg/1.14.0/bfg-1.14.0.jar

# Remove the specific file from all history
java -jar bfg-1.14.0.jar --delete-files credentials.json my-repo.git

# Remove files by pattern
java -jar bfg-1.14.0.jar --delete-files '*.json' my-repo.git

# Replace secret text (create a file with replacement rules)
echo 'AIzaSy...ACTUAL_KEY==>***REMOVED***' > replacements.txt
java -jar bfg-1.14.0.jar --replace-text replacements.txt my-repo.git

# After BFG, clean up and push
cd my-repo
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

5. **Force all teammates to re-clone** — do not pull, their local histories still contain the secret.

6. **Audit access logs** in GCP/Azure/GitHub to determine if the credential was used by unauthorized parties. File an incident report per your security policy.

---

### Force Push to Main/Shared Branch

**What happens**

Three engineers push commits to main over a morning. A fourth engineer, working on a local branch, runs `git rebase main` and then force-pushes a hotfix directly to main (`git push --force origin main`). The remote main now points to a commit that does not contain the other three engineers' work. Their commits are orphaned — not shown in `git log`, not in CI, not in any deployment.

**Root cause**

`git push --force` (or `--force-with-lease` without a current ref) replaces the remote branch tip with the local ref unconditionally. The commits that were on the remote but not in the local history become unreachable — still in the object store briefly, but no branch points to them, and they are garbage collected eventually.

**Consequences**

- Airflow DAG changes silently disappear — scheduled jobs run with old logic
- SQL migrations already pushed by teammates are lost; deployed environments diverge from history
- EU BMR audit trail broken — commits that were "approved" are no longer in main's history
- Engineers who already pulled now have local branches based on commits that are no longer on main; their next push fails with "rejected non-fast-forward"
- Recovery requires force-pushing again (using `git reflog`), creating a confusing history

**Prevention protocol**

1. **Enable branch protection on `main` via GitHub** (self-hosted GitHub supports all these settings):

```bash
# Using GitHub CLI — run once per repo
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/tests","ci/lint"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_linear_history=false
```

2. **Also protect `develop` and any `release/*` branches** using the same command.

3. Server-side protection on self-hosted Git (if using bare repos or Gitea):

```bash
git config --global receive.denyNonFastForwards true
# In the repo's config on the server:
git config receive.denyDeletes true
```

4. Warn yourself locally with an alias:

```bash
git config --global alias.fpush '!echo "WARNING: Force pushing. Are you sure? (ctrl-c to abort)" && read && git push --force-with-lease'
```

**Fix procedure**

1. **Find the lost commits using reflog on a machine that had them:**

> [!tip] Reflog Recovers for ~90 Days
>
> Even after `git reset --hard` or a force-push, orphaned commits remain in the local object store for ~90 days. `git reflog` shows every HEAD movement — the "lost" commits are still there. Act fast: `git gc --prune=now` or expiration permanently destroys them.

```bash
# On any engineer's machine that had pulled the commits
git reflog --all | grep "the lost commit message or timestamp"

# Or browse the full log
git reflog show origin/main
```

2. **Identify the correct commit hash** — the one that was the remote tip before the force push.

3. **Restore main** (you must temporarily disable branch protection in GitHub if admins enforce it):

```bash
git checkout main
git reset --hard <correct-commit-hash>
git push --force-with-lease origin main
# Re-enable branch protection immediately after
```

4. **Verify** all teammates' work is restored:

```bash
git log --oneline -20
git log --all --graph --oneline -30
```

5. **Post-incident:** document the incident, run a blameless retro, confirm branch protection is active for all protected branches.

---

### Accidental `git reset --hard` on Wrong Branch

**What happens**

An engineer has been on `main` all morning reviewing code. They start a new feature, forget to create a branch, make three commits including two SQL migrations and a dbt model change, then realize the mistake. Panicking, they try `git reset --hard origin/main` to "undo" the bad commits — and watch the three commits vanish.

**Root cause**

`git reset --hard <ref>` moves the current branch pointer to `<ref>` AND updates the working tree and index to match. Commits that were ahead of `<ref>` become unreachable from any branch. They remain in the object store until garbage collection (default: 90 days for unreachable commits), which is why `git reflog` can recover them.

**Consequences**

- SQL migrations written from memory are difficult to recreate exactly — Flyway/Liquibase versioning means a recreation needs a new version number
- Hours of dbt model work lost
- If the engineer panics and runs `git gc` or `git gc --prune=now`, recovery is impossible
- Psychological impact: engineers become risk-averse, avoid Git operations they don't fully understand

**Prevention protocol**

1. **Always check your branch before destructive operations:**

```bash
git config --global alias.whichbranch '!git branch --show-current && git status --short'
git whichbranch
```

2. **Show branch in your shell prompt.** For bash (`~/.bashrc`):

```bash
parse_git_branch() {
  git branch 2>/dev/null | grep '^*' | sed 's/* //'
}
PS1='\u@\h:\w \[\033[33m\]$(parse_git_branch)\[\033[00m\] $ '
```

For zsh with Oh My Zsh: the `git` plugin and themes like `agnoster` show branch by default.

3. **Create a "nuke with confirmation" alias** instead of using bare `reset --hard`:

```bash
git config --global alias.nuke '!f() { echo "About to reset --hard to $1 on branch $(git branch --show-current). Type YES to confirm: " && read ans && [ "$ans" = "YES" ] && git reset --hard "$1" || echo "Aborted."; }; f'
# Usage:
git nuke origin/main
```

4. **Never work directly on main.** Enforce via a pre-commit hook:

> [!warning] Block Direct Main Commits
>
> Branch protection rules on GitHub only block pushes. A local pre-commit hook blocks the commit BEFORE it's created — catching the mistake at the earliest possible point. This hook exits with error 1, which aborts the commit.

```bash
# .git/hooks/pre-commit (make executable: chmod +x)
#!/bin/bash
branch=$(git branch --show-current)
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "ERROR: Committing directly to $branch is not allowed."
  echo "Create a feature branch: git checkout -b feature/your-feature"
  exit 1
fi
```

**Fix procedure**

> [!warning] Do Not Run gc After Reset
>
> Do NOT run `git gc`, `git gc --prune=now`, or `git prune` after an accidental reset. This permanently destroys the orphaned commits. Recovery depends on the reflog being intact.

1. **Open the reflog immediately:**

```bash
git reflog
# Output looks like:
# a1b2c3d HEAD@{0}: reset: moving to origin/main
# e4f5g6h HEAD@{1}: commit: add V005__add_index_column.sql
# i7j8k9l HEAD@{2}: commit: add dbt model for ESG score calc
# m0n1o2p HEAD@{3}: commit: feat: initial migration scaffold
```

2. **Identify the commit you want to restore** — it will be the last commit before the reset.

```bash
# Inspect the commit to verify it's the right one
git show e4f5g6h
```

3. **Create a branch at that commit to rescue the work:**

```bash
git checkout -b rescue/lost-migrations e4f5g6h
```

4. **Verify all your work is there:**

```bash
git log --oneline rescue/lost-migrations
git diff main rescue/lost-migrations
```

5. **Open a PR from `rescue/lost-migrations` into main** as normal, so the work goes through code review before merging.

6. Alternatively, if you just want your working tree back and were on main:

```bash
git reset --hard e4f5g6h   # the "last good" HEAD@{N} entry
```

---

### Merge Conflict Resolved by Accepting Wrong Side

**What happens**

Two engineers are working on the same dbt model `models/finance/index_calculation.sql`. One adds a new weighting formula for ESG scores; the other refactors the join condition. Both open PRs. When the second PR is merged, there is a conflict. The merging engineer, under time pressure, clicks "Accept Current" in VS Code for every conflict — silently discarding their colleague's new weighting formula. The model passes CI (syntax is valid), the PR is merged, and the wrong index calculation runs in production for two days before anyone notices the ESG score outputs changed.

**Root cause**

Git does not know which side of a conflict is "correct" — it only marks regions where both histories modified the same lines. The engineer resolving the conflict must understand the intent of both changes. Tools that offer one-click "Accept All Theirs" or "Accept All Ours" encourage reckless resolution when the engineer lacks context.

**Consequences**

- Index calculated with stale logic — potential reporting error under EU BMR
- Silent data quality issue: tests pass because the SQL is syntactically valid
- Hard to detect: requires manual comparison of output vs expected, or data quality monitoring
- Peer trust eroded: the engineer whose work was discarded finds out only via code review or production monitoring
- Revert and re-merge requires a new PR and review cycle, delaying the release

**Prevention protocol**

1. **Use a 3-way merge tool.** In VS Code (built-in since 1.69):

```bash
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
```

VS Code's merge editor shows "Incoming", "Current", and the merged result simultaneously. Use "Accept Both" or manually edit the result pane.

2. **Never use `--no-edit` or `--strategy-option=theirs` on dbt models or SQL:**

> [!danger] Strategy Merge Silently Discards Changes
>
> `git merge -X theirs` accepts the other branch's version for every conflict without showing conflict markers. Your changes are silently discarded — no warning, no diff, no undo. Never use this on logic files (SQL, Python, dbt models). Resolve conflicts manually.

```bash
# DANGEROUS — silently accepts one whole side
git merge -X theirs feature/esg-refactor   # DO NOT DO THIS for logic files
```

3. **Run model tests after every merge resolution:**

```bash
# dbt test after resolving conflicts in dbt models
dbt test --select index_calculation+

# SQL linting
sqlfluff lint models/finance/index_calculation.sql
```

4. **Require PR review even for merge commits.** In CONTRIBUTING.md:

> All merge conflict resolutions in `models/`, `dags/`, or `migrations/` must be reviewed by the original author of the conflicting changes before the PR is merged.

5. **Reduce conflict surface area** by modularizing: one concept per file, small models, ref() chains in dbt instead of one monolithic SQL file.

**Fix procedure**

1. **Identify the bad merge commit:**

```bash
git log --oneline --merges -10
# a1b2c3d (HEAD -> main) Merge pull request #142 from feature/esg-refactor
```

2. **Inspect what was lost:**

```bash
# Compare the merge commit's two parents
git diff a1b2c3d^1 a1b2c3d^2 -- models/finance/index_calculation.sql
# Or compare with the feature branch tip
git show feature/esg-refactor:models/finance/index_calculation.sql
```

3. **Revert the bad merge commit** (preserve history rather than rewriting):

```bash
git revert -m 1 a1b2c3d
# -m 1 means "keep the mainline (first parent) and revert the merge"
# This creates a new commit that undoes the merge
```

4. **Create a corrected feature branch** with the proper merge resolution:

```bash
git checkout -b fix/esg-merge-resolution main
git merge feature/esg-refactor
# Resolve conflicts carefully this time, involving both authors
dbt test --select index_calculation+
git commit
```

5. **Open a new PR**, tag both original authors as reviewers, reference the incident in the PR description.

---

### Large Binary Files Committed (Repo Bloat)

**What happens**

A data engineer exports a 400 MB Parquet file from BigQuery for local testing and runs `git add data/ && git commit -m "test data"`. Six months and 30 engineers later, `git clone` takes 45 minutes, CI workers spend 8 minutes just fetching the repo, and a Windows engineer hits `MAX_PATH` errors unpacking delta-compressed blob chains.

**Root cause**

Git stores each version of every file as a compressed blob in `.git/objects/`. Binary files (Parquet, CSV, images, compiled artifacts) do not delta-compress well — each version is essentially a full copy. The pack file grows with every commit. Even if the files are deleted, the blobs remain until `git gc` with `--prune` after all branches/refs are removed.

**Consequences**

- `git clone` times balloon: a 5 GB repo can take 30+ minutes on a 100 Mbps connection
- CI pipeline startup time dominated by git fetch, not actual work
- GitHub storage limits hit on enterprise plan; self-hosted runner disk space consumed
- Developers on slow connections (home office, travel) effectively locked out
- Audit-required history exports become unwieldy

**Prevention protocol**

1. **Set up Git LFS** for binary patterns before any large files are committed:

```bash
# Install LFS
git lfs install

# Track patterns in .gitattributes
git lfs track "*.parquet"
git lfs track "*.csv"
git lfs track "*.xlsx"
git lfs track "*.db"
git lfs track "*.sqlite"
git lfs track "*.dump"
git lfs track "*.zip"
git lfs track "*.tar.gz"
git lfs track "*.jar"
git lfs track "data/**"

# .gitattributes is now updated — commit it
git add .gitattributes
git commit -m "chore: configure Git LFS for binary data files"
```

2. **Add a pre-commit hook that blocks large files:**

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-added-large-files
        args: ['--maxkb=500']   # block files > 500 KB
```

3. **Set a global threshold as a soft warning:**

```bash
git config --global core.bigFileThreshold 50m
```

4. **Never store test data in the repo.** Use a shared object store (GCS bucket, Azure Blob, S3) and download fixtures in CI setup steps. Reference data by hash, not by path in git.

5. **`.gitattributes` template for data engineering repos:**

```gitattributes
# Binary data files — use LFS
*.parquet filter=lfs diff=lfs merge=lfs -text
*.csv filter=lfs diff=lfs merge=lfs -text
*.xlsx filter=lfs diff=lfs merge=lfs -text
*.db filter=lfs diff=lfs merge=lfs -text
*.sqlite filter=lfs diff=lfs merge=lfs -text
*.dump filter=lfs diff=lfs merge=lfs -text
*.zip filter=lfs diff=lfs merge=lfs -text
*.tar.gz filter=lfs diff=lfs merge=lfs -text
data/** filter=lfs diff=lfs merge=lfs -text

# Python — treat as text with LF
*.py text eol=lf
*.sql text eol=lf
*.tf text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.json text eol=lf

# C# — text with CRLF on Windows
*.cs text eol=crlf
*.csproj text eol=crlf
*.sln text eol=crlf

# Compiled artifacts — binary, do not diff
*.pyc binary
*.pyd binary
*.dll binary
*.exe binary
*.so binary
```

**Fix procedure**

1. **Identify the large files in history:**

```bash
# List top 20 largest blobs by size
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | sort -k3 -rn \
  | head -20
```

2. **Remove with BFG Repo Cleaner** (faster than `git filter-repo` for blobs):

```bash
# First, make a fresh bare clone
git clone --mirror https://github.com/org/repo.git repo-mirror.git

# Run BFG — remove files larger than 10MB
java -jar bfg-1.14.0.jar --strip-blobs-bigger-than 10M repo-mirror.git

# Or remove specific files
java -jar bfg-1.14.0.jar --delete-files '*.parquet' repo-mirror.git

# Expire old refs and repack
cd repo-mirror.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push cleaned history
git push
```

3. **Alternatively with git filter-repo:**

```bash
git filter-repo --strip-blobs-bigger-than 10M
```

4. **Set up LFS after cleaning:**

```bash
git lfs install
git lfs track "*.parquet"
git add .gitattributes && git commit -m "chore: add LFS tracking for data files"
```

5. **Require all teammates to re-clone** the repository after the rewrite.

---

## High — Team Velocity / Code Quality

### Long-Lived Feature Branches

**What happens**

A senior engineer opens a branch `feature/refactor-index-pipeline` that touches Airflow DAG orchestration, dbt models, Python transformation code, and two SQL migrations. It sits open for 3 weeks while other work merges to main. By day 21, main has 47 new commits. The merge conflict resolution takes a full day, breaks CI three times, and the PR reviewer can no longer meaningfully evaluate 2,400 lines of changes.

**Root cause**

Long-lived branches accumulate "merge debt" — every commit to main that touches shared files increases the probability and complexity of merge conflicts. Beyond the technical problem, a 3-week branch is a code review anti-pattern: no reviewer can hold the full context of 2,400 lines in working memory, so review becomes superficial.

**Consequences**

- Merge conflicts are complex and time-consuming to resolve correctly (see Problem 4)
- CI green on the branch does not mean CI green after merge — integration surprises
- Blocked PRs for other engineers who depend on the refactored code
- Reviewer fatigue: large PRs receive less scrutiny, more bugs slip through
- In a regulated environment, a single 2,400-line PR is a weak audit trail vs 6 small PRs with clear purpose

**Prevention protocol**

1. **Set a PR size limit.** Enforce via GitHub Action:

```yaml
# .github/workflows/pr-size.yml
name: PR Size Check
on: [pull_request]
jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check PR size
        run: |
          LINES=$(gh pr diff ${{ github.event.pull_request.number }} | wc -l)
          if [ "$LINES" -gt 800 ]; then
            echo "PR too large: $LINES lines changed. Max 800. Please split."
            exit 1
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

2. **Rebase daily against main** to minimize divergence:

```bash
git fetch origin
git rebase origin/main
# Resolve any conflicts as they arise (small, daily = manageable)
```

3. **Use trunk-based development with feature flags** for large features. Merge incomplete work behind a flag, toggled off in production.

4. **Decompose large tasks** before starting. A refactor touching DAGs + dbt + SQL + Python is 4 PRs minimum.

**Fix procedure** (splitting a mega-branch)

1. **Identify logical groupings of commits:**

```bash
git log --oneline feature/refactor-index-pipeline ^main
```

2. **Create sub-branches and cherry-pick:**

```bash
# Part 1: SQL migrations only
git checkout -b feature/refactor-migrations main
git cherry-pick <migration-commit-1> <migration-commit-2>

# Part 2: dbt models
git checkout -b feature/refactor-dbt-models main
git cherry-pick <dbt-commit-1> <dbt-commit-2> <dbt-commit-3>

# Continue for DAG changes, Python changes, etc.
```

3. **Open small PRs in dependency order** and merge sequentially.

---

### Merge Conflicts in Shared Files

**What happens**

Two engineers are both assigned tickets that touch `dags/index_calculation_dag.py`. One adds a new task dependency; the other changes the schedule interval and adds a sensor. Both push PRs on the same day. The second to merge faces a conflict in the DAG file — and neither engineer is available to help resolve it because one is in a 3-hour client meeting.

**Root cause**

When two branches modify the same lines (or adjacent lines) of the same file, Git cannot automatically determine the correct merged state. This is a mathematical inevitability — Git's merge algorithm is line-based, and it cannot understand the semantic intent of either change.

**Consequences**

- Airflow DAG conflict resolution delay blocks pipeline deployment
- Incorrect resolution can introduce circular dependencies or invalid DAG structure, causing Airflow to fail at parse time
- Engineers blocked waiting for each other, reducing throughput

**Prevention protocol**

1. **Set up CODEOWNERS** to ensure shared file owners are notified before work begins:

```
# .github/CODEOWNERS

# Global fallback
* @data-team-leads

# Airflow DAGs — notify DAG owner
/dags/ @airflow-admin @data-engineering-lead

# Terraform — infrastructure team must review
/terraform/ @infra-team

# dbt models — model owners
/models/finance/ @quant-team
/models/esg/ @esg-data-team

# SQL migrations — DBA must approve
/migrations/ @dba-team @data-engineering-lead

# C# API
/src/Api/ @backend-team

# CI/CD
/.github/ @devops-team
```

2. **Communicate before editing shared files.** Post in the team Slack channel: `@channel editing dags/index_calculation_dag.py for ticket DATA-451, ETA 2h`.

3. **Modularize shared files.** Split large DAGs into task-group files imported by the main DAG. Split large dbt models into refs.

4. **Rebase before pushing a PR** to absorb upstream changes early:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease origin feature/my-branch
```

**Fix procedure**

```bash
# Start merge tool (VS Code)
git mergetool --tool=vscode

# Or manually: after editing conflict markers, stage the file
git add dags/index_calculation_dag.py

# Verify the DAG is valid before committing
python -c "from dags.index_calculation_dag import dag; print(dag)"

# Complete the merge
git commit
```

For systematic conflict resolution:
1. Understand both changes — read both sets of commit messages
2. Apply both changes in the correct order (semantic merge, not line merge)
3. Run all relevant tests before marking the conflict resolved

---

### Broken Main Branch

**What happens**

A PR is approved and merged. The CI suite on main fails 3 minutes later. All open PRs now show "branch is out of date with main — merge before merging". The afternoon's deployment window is blocked. Four engineers are waiting on the hotfix.

**Root cause**

Most broken mains come from: (a) a PR that passed CI on its branch but had an integration conflict with a recently merged PR, (b) flaky CI that passed intermittently, or (c) a branch that wasn't required to be up-to-date with main before merge. The "require branches to be up to date" GitHub setting prevents case (c) but increases merge queue pressure.

**Consequences**

- All open PRs are blocked from merging until main is fixed
- No deployments can proceed during a broken main window
- If the break is in a migration or infrastructure change, it can cascade to staging environment
- SLA breach if the broken main coincides with a scheduled index publication window
- Fixes themselves can introduce new problems if done hastily

**Prevention protocol**

1. **Require status checks AND up-to-date branches** in GitHub branch protection:
   - Settings → Branches → main → Require status checks: add all CI jobs
   - Check "Require branches to be up to date before merging"

2. **Use a merge queue** (GitHub feature) to serialize merges and run CI on the post-merge state, not just the branch state.

3. **Block direct pushes to main** — all changes via PR.

4. **Monitor main health** with a Slack notification on CI failure:

```yaml
# .github/workflows/notify-broken-main.yml
on:
  push:
    branches: [main]
jobs:
  notify:
    if: failure()
    steps:
      - uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: '{"text":"🚨 main is BROKEN — PR #${{ github.event.pull_request.number }}. All merges blocked."}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

**Fix procedure**

1. **Identify the breaking commit with `git bisect`:**

```bash
git checkout main
git bisect start
git bisect bad HEAD              # current HEAD is broken
git bisect good <last-known-good-hash>  # last known good commit

# Git checks out a midpoint commit. Run your test:
python -m pytest tests/ --tb=short -q
git bisect good   # if tests pass
git bisect bad    # if tests fail

# Repeat until bisect identifies the exact bad commit
# Git prints: "abcdef1234 is the first bad commit"
git bisect reset  # return to original HEAD
```

2. **Revert the bad merge commit:**

```bash
git revert -m 1 <bad-merge-commit-hash>
git push origin main   # requires admin bypass of branch protection or a hotfix PR
```

3. **Open a hotfix PR** with the proper fix (do not push directly to main even in an emergency — the audit trail matters).

4. **Unblock the merge queue** once CI is green on main.

---

### PR Review Bottleneck

**What happens**

An engineer submits a PR at 9 AM on Tuesday. The designated reviewer is in sprint planning until 11 AM, then lunch, then a 1:1, and gets to the PR at 4 PM. By then, the branch is stale against main (2 new merges), there are 3 nit comments, and the reviewer approves "with changes." The engineer addresses changes and re-requests review the next morning. The PR merges on Thursday afternoon — 4 days for a 150-line change.

**Root cause**

No SLA on reviews, CODEOWNERS with a single required reviewer, and no backup reviewer assignment. Reviewers treat PR review as lower priority than their own work.

**Consequences**

- Branches go stale while waiting, increasing merge conflict probability
- Engineers context-switch back to the PR after 2 days, losing their original intent
- Sprint velocity appears lower than actual coding output
- For urgent hotfixes, a bottleneck can delay a production fix beyond an acceptable SLA

**Prevention protocol**

1. **Configure automatic reviewer assignment** using GitHub's review assignment settings:
   - Settings → Code Review → Auto-assign → Round robin or load balance
   - Set a maximum of 2 required reviewers per PR

2. **Add backup reviewers in CODEOWNERS:**

```
# Require at least one of these two for any dbt model change
/models/ @senior-analyst @data-engineer-2
```

3. **Establish and communicate a PR SLA** in CONTRIBUTING.md:

> PRs smaller than 400 lines: first review within 4 business hours.
> PRs larger than 400 lines: first review within 1 business day.
> Hotfix PRs labeled `priority:urgent`: review within 30 minutes.

4. **Auto-assign via GitHub Action** when a PR is opened:

```yaml
# .github/workflows/auto-assign.yml
name: Auto Assign Reviewer
on:
  pull_request:
    types: [opened, ready_for_review]
jobs:
  assign:
    runs-on: ubuntu-latest
    steps:
      - uses: hmarr/auto-approve-action@v3   # replace with actual auto-assign action
      - uses: actions/github-script@v7
        with:
          script: |
            const reviewers = ['engineer-a', 'engineer-b', 'engineer-c'];
            const random = reviewers[Math.floor(Math.random() * reviewers.length)];
            github.rest.pulls.requestReviewers({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
              reviewers: [random]
            });
```

5. **Keep PRs small** — the single most effective way to speed up review is to reduce PR size.

---

### Rebase vs Merge Confusion

**What happens**

Half the team uses `git pull --rebase`, the other half uses `git pull` (merge). The result: main's history is a mix of merge commits, linear rebased sequences, and occasional duplicate commits (when someone rebases a branch that was already merged). `git log --graph` looks like a bowl of spaghetti. `git bisect` hits merge commits and becomes unreliable.

**Root cause**

Git supports multiple history-integration strategies, each with different behavior. The confusion stems from not understanding what each actually does under the hood.

#### What `git rebase main` Actually Does (Step by Step)

When you are on a local feature branch and run `git rebase main`, Git rewrites your branch's history so it looks like you just created it from the latest version of main. Here is exactly what happens:

1. **Finds the common ancestor** — Git looks back through history to find the exact commit where your feature branch originally diverged from main.

2. **Sets aside your work** — Git temporarily saves all commits you made on your feature branch since that divergence point (stored internally as patches).

3. **Moves the base** — Git fast-forwards your feature branch so its new starting point is the latest commit on main. This is the "re-base" — literally changing the base commit.

4. **Reapplies your commits** — Git takes your saved commits and replays them one by one on top of the new base. Each commit is recreated as a **brand new commit** (new SHA hash) even though the code changes are identical.

```
BEFORE rebase:                    AFTER rebase:

main:    A - B - C - D            main:    A - B - C - D
              \                                         \
feature:       E - F - G          feature:               E' - F' - G'
```

Note: E', F', G' are **new commits** — same code diff, but different SHA hashes than E, F, G. The originals become orphaned (recoverable via `git reflog` for ~30 days).

#### What `git merge main` Does (Contrast)

```
BEFORE merge:                     AFTER merge:

main:    A - B - C - D            main:    A - B - C - D
              \                                \         \
feature:       E - F - G          feature:      E - F - G - M (merge commit)
```

Merge creates a new "merge commit" (M) that ties the two histories together. No existing commits are rewritten. In a busy project, these merge commits accumulate and make `git log --graph` look like a tangled web.

#### Why Rebase Exists

The primary goal is a **clean, linear history**. With rebase, main's log reads as a straight sequence of commits — easy to read, easy to `git bisect`, easy to audit (EU BMR requires traceable methodology changes).

> [!danger] Golden Rule of Rebasing
>
> The Golden Rule of Rebasing.
> **Never rebase a branch that you have already pushed to a shared remote if others might be basing their work on it.** Because rebase creates brand new commits (different SHAs), teammates who pulled the original commits will have diverged histories. Their next `git pull` will see conflicts between the old commits and the new rebased ones — even though the code is identical. This causes severe history conflicts and lost work. Only rebase **local, private** feature branches before you open a pull request.

#### Handling Conflicts During Rebase

When Git reapplies your commits one by one, any commit that touches lines also changed on main will produce a conflict. Unlike merge (one conflict resolution for everything), rebase may require you to resolve conflicts **for each commit** being replayed:

```bash
# Conflict appears during rebase
git rebase main
# CONFLICT in models/int_daily_returns.sql

# 1. Resolve the conflict in your editor
# 2. Stage the resolved file
git add models/int_daily_returns.sql

# 3. Continue replaying the remaining commits
git rebase --continue

# If you want to abort and go back to pre-rebase state:
git rebase --abort
```

> [!warning] Multiple Conflicts per Rebase
>
> If your branch has 10 commits and 3 of them touch the same file that changed on main, you may need to resolve conflicts 3 separate times — once per commit being replayed. This is why keeping branches short-lived (fewer commits to replay) dramatically reduces rebase pain.

**Consequences**

- `git bisect` unreliable on complex merge histories
- Duplicate commits appear when a branch is rebased after some of its commits were already cherry-picked
- Teammates' work destroyed if someone rebases a shared branch (Golden Rule violation)
- Onboarding confusion: new engineers don't know which strategy to follow
- `git log` is harder to use for audit purposes under EU BMR

**Prevention protocol**

1. **Pick one strategy and document it.** Recommendation for data engineering teams:

   - **Trunk-based development:** use rebase (`git pull --rebase`) for updating feature branches, squash-merge into main via PR
   - This gives a linear main history, easy to bisect and audit
   - The Golden Rule is naturally satisfied: you only rebase your own local branch before the PR, then squash-merge deletes the branch

2. **Set team-wide Git config** via a setup script (`scripts/git-setup.sh`):

```bash
#!/bin/bash
# Team Git configuration — run once after cloning
# Usage: bash scripts/git-setup.sh

echo "Configuring Git for [Team Name] standards..."

# Always rebase when pulling (prevents merge commits on feature branches)
git config pull.rebase true

# Autostash before rebase
git config rebase.autoStash true

# Squash merge by default (set in GitHub UI, but also local preference)
git config merge.ff only   # prevent accidental local merges

# Better diff algorithm
git config diff.algorithm histogram

# Standardize line endings
git config core.autocrlf input   # macOS/Linux: convert CRLF to LF on commit
# git config core.autocrlf true  # Windows: convert to CRLF on checkout, LF on commit

# Default branch name
git config init.defaultBranch main

# Show branch in pull output
git config branch.autoSetupRebase always

echo "Done. Current config:"
git config --list --local
```

3. **Add to `CONTRIBUTING.md`:**

> This repo uses squash-merge via PRs. Feature branches are rebased, not merged, from main. Do not create local merge commits — use `git pull --rebase`.

**Fix procedure** (untangling an already-messy history is impractical for large repos)

```bash
# For future PRs, ensure squash merge in GitHub settings:
# Settings → General → Pull Requests → Allow squash merging (only, disable others)

# To clean up a specific branch before PR:
git checkout feature/my-branch
git rebase -i origin/main
# In the interactive editor, squash/fixup all commits into one clean commit
```

---

### Detached HEAD Work Lost

**What happens**

An engineer runs `git checkout v2.3.1` to investigate a production tag. They find the bug, make a fix, commit it — then switch to main with `git checkout main`. The "you are in detached HEAD" warning in red is ignored because they've seen it a hundred times without understanding it. The fix commits are now orphaned — no branch points to them, and after a `git gc`, they are gone.

**Root cause**

"Detached HEAD" means HEAD points directly to a commit SHA rather than to a branch ref. When you switch branches, HEAD moves to the new branch — the commit you made in detached state is no longer reachable from any ref. Git retains it in the reflog for ~30 days but will eventually prune it.

**Consequences**

- Hotfix commit lost — engineer must re-implement the fix from memory
- If the fix was complex (index calculation edge case), recreation is error-prone
- Time lost rediscovering the root cause

**Prevention protocol**

1. **Pre-commit hook warning for detached HEAD:**

```bash
# .git/hooks/pre-commit
#!/bin/bash
branch=$(git symbolic-ref HEAD 2>/dev/null)
if [ -z "$branch" ]; then
  echo "WARNING: You are in detached HEAD state!"
  echo "Commits made here will be lost when you switch branches."
  echo "Create a branch first: git checkout -b hotfix/your-fix"
  echo "To proceed anyway: git commit --no-verify"
  exit 1
fi
```

2. **Shell PS1 that shows DETACHED state visually:**

```bash
parse_git_state() {
  local branch
  branch=$(git symbolic-ref --short HEAD 2>/dev/null) || branch="DETACHED:$(git rev-parse --short HEAD 2>/dev/null)"
  echo "$branch"
}
PS1='\u@\h:\w \[\033[33m\]$(parse_git_state)\[\033[00m\] $ '
```

3. **Standard procedure when checking out a tag:** always create a branch immediately:

```bash
# Instead of:
git checkout v2.3.1

# Do:
git checkout -b hotfix/v2.3.1-investigate v2.3.1
```

**Fix procedure**

```bash
# Find the orphaned commit in reflog
git reflog
# Look for "commit: your commit message" after "checkout: moving from ... to ..."

# Example output:
# abc1234 HEAD@{0}: checkout: moving from abc1234 to main
# abc1234 HEAD@{1}: commit: fix: correct ESG score edge case

# Create a branch at the orphaned commit
git checkout -b recovery/esg-hotfix abc1234

# Continue work and open a PR
```

---

## Moderate — Operational Pain

### `.gitignore` Missing Entries

**What happens**

A new engineer joins and opens the project in IntelliJ IDEA. A `.idea/` directory is created with workspace settings. They run `git add . && git commit -m "initial setup"` and push their IDE config to main. Three other engineers now see their IDE settings overwritten on next pull. The `__pycache__` directories also get committed, causing spurious diffs on every Python change.

**Root cause**

`.gitignore` was not created comprehensively at project inception, or was created without considering all tools used by the team. Once a file is tracked by Git, adding it to `.gitignore` has no effect — the file must first be untracked with `git rm --cached`.

**Consequences**

- Repository cluttered with IDE files, build artifacts, and cache directories
- Spurious diffs: every `git status` shows changed files that aren't meaningful
- CI may fail if build artifacts from one run interfere with another
- Sensitive local config (`.env.local`, database connection strings) accidentally committed

**Prevention protocol**

1. **Use the comprehensive `.gitignore` from Problem 1** above at project creation.

2. **Untrack files already committed:**

```bash
# Untrack a specific file without deleting it locally
git rm --cached .idea/workspace.xml

# Untrack an entire directory
git rm --cached -r __pycache__/
git rm --cached -r .terraform/

# Commit the removal
git commit -m "chore: remove IDE and cache files from tracking"
```

3. **Global gitignore for personal IDE files** (each engineer does this once):

```bash
# Create a global gitignore
cat >> ~/.gitignore_global << 'EOF'
.idea/
.vscode/
*.suo
.DS_Store
Thumbs.db
EOF

git config --global core.excludesFile ~/.gitignore_global
```

4. **Use the pre-commit `check-added-large-files` and `check-merge-conflict` hooks** from `pre-commit-hooks` to catch common mistakes.

---

### Commit Message Anarchy

**What happens**

Three months into the project, `git log --oneline` on main reads: `fix`, `wip`, `test`, `asdf`, `changes`, `fix2`, `final`, `final_final`, `deploy this please`, `Revert "fix2"`. When a bug is reported in the index calculation, the team spends 90 minutes reading diffs to understand what changed and why, work that meaningful commit messages would have made trivial.

**Root cause**

No enforced commit message convention, no pre-commit hook validation, and a culture where commit messages are seen as overhead rather than documentation.

**Consequences**

- `git bisect` still works technically, but engineers cannot skim log to identify the relevant commit
- `git blame` shows commit SHAs that lead to useless messages — context of why a change was made is lost
- EU BMR audit trail requires traceability: commit messages that reference tickets and describe intent are part of that trail
- Automated changelog generation (from conventional commits) is impossible

**Prevention protocol**

1. **Adopt Conventional Commits:** `<type>(<scope>): <description>`

   Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`

   Examples:
   - `feat(esg): add Scope 3 emissions to index weighting model`
   - `fix(migrations): correct V005 column type from INT to DECIMAL(18,6)`
   - `chore(deps): upgrade dbt-bigquery to 1.7.4`

2. **Enforce with commitlint:**

```bash
npm install -g @commitlint/cli @commitlint/config-conventional

# commitlint.config.js (repo root)
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [
      'dags', 'migrations', 'models', 'terraform', 'api', 'pipeline', 'esg', 'deps', 'ci'
    ]],
    'body-max-line-length': [1, 'always', 120]
  }
};
```

```bash
# .pre-commit-config.yaml
  - repo: https://github.com/commitizen-tools/commitizen
    rev: v3.13.0
    hooks:
      - id: commitizen
        stages: [commit-msg]
```

3. **Enforce squash merge on GitHub** so that PR titles (which must pass title linting) become the commit messages on main. This is the most practical approach for a team that finds commit-level linting too restrictive.

---

### Stale Branches Accumulate

**What happens**

After a year, the repository has 230 branches. Engineers are afraid to delete branches in case "something important is still there." `git branch -r` output scrolls for 8 screens. New engineers looking at open branches have no idea what's active vs abandoned. The branch list is noise.

**Root cause**

No branch cleanup policy, no auto-delete on merge, and cultural fear of losing work (usually unfounded — merged branches are redundant to main).

**Consequences**

- Cognitive overhead: engineers waste time scanning branch lists
- CI/CD webhooks may trigger on abandoned branches unnecessarily
- Repository management UI is cluttered
- Branches with sensitive names (e.g., `fix/client-X-data-issue`) linger visibly

**Prevention protocol**

1. **Enable auto-delete merged branches** in GitHub:
   - Settings → General → Pull Requests → Automatically delete head branches ✓

2. **Scheduled cleanup script** (run monthly via a GitHub Action or cron):

```bash
#!/bin/bash
# scripts/cleanup-stale-branches.sh
# Lists and optionally deletes branches merged >30 days ago

DAYS=30
CUTOFF=$(date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${DAYS}d +%Y-%m-%d)

echo "=== Branches merged before $CUTOFF ==="
git fetch --prune origin

# List remote branches merged into main, older than cutoff
for branch in $(git branch -r --merged origin/main | grep -v 'HEAD|main|release|develop'); do
  branch_name="${branch#origin/}"
  last_commit=$(git log -1 --format="%ci" "origin/$branch_name" 2>/dev/null | cut -d' ' -f1)
  if [[ "$last_commit" < "$CUTOFF" ]]; then
    echo "$branch_name (last commit: $last_commit)"
  fi
done

# To delete (uncomment and run with --delete flag):
# git branch -r --merged origin/main | grep -v 'HEAD|main|release|develop' | \
#   sed 's/origin\///' | xargs -I{} git push origin --delete {}
```

3. **Branch naming convention with owner prefix**: `feature/DATA-451-esg-weighting` — the ticket number makes stale detection easier.

---

### Wrong Branch Deployment

**What happens**

A developer completes a staging test and means to push to the `staging` branch but accidentally pushes to `production`. A half-tested migration runs against the production database during market hours.

**Root cause**

Manual deployment steps, similar branch names (`staging`, `production`, `prod`, `release`), and no safeguard preventing direct pushes to deployment-linked branches.

**Consequences**

- Untested code or migrations deployed to production
- Potential data corruption in index calculation database
- EU BMR violation if a change alters the index calculation logic without approved change record
- Emergency rollback required during market hours

**Prevention protocol**

1. **Branch naming convention:** enforce a strict and distinct naming scheme:
   - `main` — reviewed, approved code
   - `release/v2.4.0` — release candidates
   - Never `production`, `prod`, or `staging` as branch names tied to direct-push deployments

2. **Deploy only via PR merge triggers** in CI/CD — never direct pushes:

```yaml
# .github/workflows/deploy-prod.yml
on:
  push:
    branches: [main]   # only merge to main triggers prod deploy
```

3. **Environment protection rules** in GitHub Actions:
   - Settings → Environments → production → Required reviewers: add 2 senior engineers
   - This gates any workflow job targeting `production` environment behind a manual approval

4. **Pre-push hook reminder:**

```bash
# .git/hooks/pre-push
#!/bin/bash
remote="$1"
while read local_ref local_sha remote_ref remote_sha; do
  if [[ "$remote_ref" =~ "refs/heads/main" ]]; then
    echo "You are pushing to MAIN. Are you pushing via a PR merge? (y/n)"
    read ans
    if [ "$ans" != "y" ]; then
      echo "Aborted. Use a PR."
      exit 1
    fi
  fi
done
```

---

### Cherry-Pick Conflicts

**What happens**

A critical bugfix for an index calculation rounding error is merged to main as commit `abc1234`. The fix also needs to be applied to `release/v2.3.x` (a maintenance branch for currently-live indices). Cherry-picking the commit results in conflicts because `release/v2.3.x` has different surrounding code from when the fix was written.

**Root cause**

Cherry-pick applies the diff of a single commit to a different base. If the context lines (the lines surrounding the change) differ between the cherry-pick target and the original commit's parent, conflicts arise. This is expected and not a Git bug — it reflects genuine code divergence.

**Consequences**

- Hotfix deployment to the maintenance branch is delayed
- If resolved incorrectly, the fix may not actually work in the v2.3.x context
- Duplicate work: the engineer must understand both the original fix and the v2.3.x codebase state

**Prevention protocol**

1. **Document the cherry-pick procedure** for hotfixes in CONTRIBUTING.md.
2. **Write hotfixes as small, self-contained commits** with minimal context dependencies — easier to cherry-pick cleanly.
3. **Consider a backport PR** instead of cherry-pick — merge the fix to a backport branch targeting `release/v2.3.x`, allowing code review of the adaptation.

**Fix procedure** (safe cherry-pick with conflict resolution):

```bash
# Checkout the release branch
git checkout release/v2.3.x
git pull origin release/v2.3.x

# Cherry-pick with a flag that stages conflicts but doesn't auto-commit
git cherry-pick -x abc1234
# -x appends "(cherry picked from commit abc1234)" to the commit message

# If conflict arises:
git status
# Edit conflicted files to apply the fix logic in the v2.3.x context
git add <resolved-files>
git cherry-pick --continue
# Or to abort and take a different approach:
git cherry-pick --abort

# Push to a branch and open a backport PR for review
git push origin release/v2.3.x-hotfix-rounding
gh pr create --base release/v2.3.x --title "fix(backport): index rounding error for v2.3.x"
```

---

### SQL Migration Ordering Conflicts

**What happens**

Two engineers work on separate tickets simultaneously. Engineer A creates `migrations/V005__add_esg_score_column.sql`; Engineer B creates `migrations/V005__add_index_weight_column.sql`. Both PRs pass CI. Both merge to main within 10 minutes of each other. Flyway now fails: duplicate version number V005. The staging environment is broken and migrations cannot run until manually resolved.

**Root cause**

Sequential integer version numbering has a race condition inherent to parallel development. Two engineers independently pick the "next" number at the same time.

**Consequences**

- Staging and production migrations blocked until the conflict is manually resolved
- One migration must be renumbered — a schema change to Flyway's versioning metadata
- If both were already applied to one environment, the rename causes Flyway to see a "missing" migration
- Engineering time lost; release delayed

**Prevention protocol**

1. **Use timestamp-based naming** instead of sequential integers:

```
V20260323_1430__add_esg_score_column.sql     # YYYYMMDD_HHMM
V20260323_1445__add_index_weight_column.sql
```

This virtually eliminates collision (two engineers would need to create a migration in the same minute to collide).

2. **Coordinate via a shared channel** before writing migrations: `@channel creating migration for ticket DATA-451, approx timestamp V20260323_1430`.

3. **CI validation script** to catch duplicate migration numbers:

```bash
#!/bin/bash
# scripts/validate-migrations.sh
# Fails CI if any two migrations share a version number

MIGRATION_DIR="migrations"
DUPLICATES=$(ls "$MIGRATION_DIR"/V*.sql 2>/dev/null \
  | sed 's|.*/V\([0-9_]*\)__.*|\1|' \
  | sort | uniq -d)

if [ -n "$DUPLICATES" ]; then
  echo "ERROR: Duplicate migration version numbers found:"
  echo "$DUPLICATES"
  exit 1
fi
echo "Migration version check passed."
```

```yaml
# .github/workflows/validate-migrations.yml
- name: Validate migration versions
  run: bash scripts/validate-migrations.sh
```

4. **Consider Liquibase with `changeset` IDs** based on author+timestamp rather than sequential numbers.

---

### Git LFS Misconfigured

**What happens**

A new engineer clones the repo on a machine where `git lfs` is not installed. All LFS-tracked files appear as 134-byte pointer text files instead of their actual content. They open a Parquet file in a Python script, get a confusing error, spend an hour debugging, and eventually discover LFS was never set up on their machine. Meanwhile, if they accidentally commit the pointer file as content, other users will pull a broken file.

**Root cause**

Git LFS is an extension — `git lfs install` must be run once per machine before cloning, or `git lfs pull` must be run after cloning on a machine with LFS newly installed. The pointer file mechanism is working as designed, but without the LFS client, the abstraction is invisible.

**Consequences**

- Pipelines fail with cryptic errors when they try to read pointer files as data
- CI failures if LFS is not installed in the runner environment
- Pointer files accidentally committed as content corrupt the LFS object

**Prevention protocol**

1. **Document LFS setup in onboarding checklist** (CONTRIBUTING.md):

```markdown
### Prerequisites
Before cloning this repository:
1. Install Git LFS: `brew install git-lfs` (macOS) or `choco install git-lfs` (Windows)
2. Enable LFS: `git lfs install`
3. Then clone: `git clone ...`
```

2. **CI/CD runner setup** — install LFS in Docker image or runner setup step:

```yaml
- name: Setup Git LFS
  run: |
    git lfs install
    git lfs pull
```

3. **Verification commands:**

```bash
# Verify LFS is active
git lfs version

# See which files are tracked by LFS
git lfs ls-files

# Verify LFS files are downloaded (not pointers)
git lfs status

# Pull LFS objects if missing
git lfs pull

# Check for LFS pointer files accidentally committed as content
git lfs fsck
```

4. **Pre-commit hook to catch pointer files committed as content:**

```bash
# Check staged files aren't LFS pointers committed as real files
for f in $(git diff --cached --name-only); do
  if git check-attr filter "$f" | grep -q "lfs"; then
    if head -1 "$f" 2>/dev/null | grep -q "version https://git-lfs.github.com/spec"; then
      echo "ERROR: $f appears to be an LFS pointer file being committed as content."
      echo "Run: git lfs pull"
      exit 1
    fi
  fi
done
```

---

## Low — Annoyances / Culture Issues

### Blame Culture

**What happens**

A production incident occurs: the ESG score calculation has been off for two weeks. Someone runs `git blame models/esg/score_calculation.sql` and pastes the author's name in the incident Slack channel: "DATA-451 was merged by @engineer-name — they introduced this." The engineer, who was implementing a spec approved by the quant team, feels publicly shamed. Future engineers avoid touching shared files to avoid future blame.

**Root cause**

`git blame` shows authorship, not intent, context, or the organizational decision that led to the code. Used punitively, it discourages ownership, transparency in commits, and willingness to touch shared code.

**Consequences**

- Engineers stop writing self-contained commits with clear scope (hiding their tracks)
- Fear of touching legacy code — technical debt compounds
- Psychological safety eroded; retention risk
- Incident root cause analysis becomes adversarial rather than systemic

**Prevention protocol**

1. **Reframe `git blame` as `git annotate`** — same output, different mental model. It shows "who can explain this code", not "who is at fault."

2. **Blameless post-mortems:** document the procedure. The five whys lead to systemic causes, not individuals.

3. **Use richer history tools for context:**

```bash
# See full commit messages for each line (more context than blame)
git log -p --follow -S "esg_score_weight" -- models/esg/score_calculation.sql

# See all changes to a specific function over time
git log --all -p -G "def calculate_esg_score"

# Follow a file through renames
git log --follow --oneline -- models/esg/score_calculation.sql

# Blame with context: show more lines, ignore whitespace changes
git blame -C -C -w -L 40,80 models/esg/score_calculation.sql
# -C -C finds code moved from other files
```

4. **Add change rationale to commits and PRs** — require the PR description to explain "why", not just "what."

---

### Inconsistent Git Config Across Team

**What happens**

An engineer on Windows with `core.autocrlf=true` commits a Python file. Every line ending changes from LF to CRLF. The next engineer on macOS pulls the file and their Git shows every line as changed (CRLF → LF). A 200-line SQL migration shows 200 "changes" in every diff — purely whitespace. CI lint runs fail on line ending checks.

**Root cause**

Git config is personal and machine-level by default. `autocrlf`, `merge.ff`, `pull.rebase`, `diff.algorithm`, and editor settings vary widely across team members. Git provides no built-in mechanism to enforce per-repo config on all clones.

**Consequences**

- Spurious diffs from line ending changes obscure real changes in code review
- Different merge strategies produce different history topology
- `git bisect` and `git blame` produce inconsistent results depending on who runs them
- Onboarding friction: new engineers must manually configure Git before contributing

**Prevention protocol**

1. **Use `.gitattributes`** (see Problem 5) to normalize line endings at the repository level — this is enforced for everyone regardless of local config.

2. **Provide a team standardization script** (from Problem 10, adapted):

```bash
#!/bin/bash
# scripts/git-setup.sh — Run once per machine after cloning

echo "Setting up Git for data-engineering-repo..."

# Core behavior
git config pull.rebase true
git config rebase.autoStash true
git config merge.ff only
git config diff.algorithm histogram
git config core.autocrlf input        # LF on commit; local files as-is

# Helpful defaults
git config branch.autoSetupRebase always
git config push.default current
git config fetch.prune true           # delete stale remote-tracking branches on fetch
git config rerere.enabled true        # remember conflict resolutions

# Aliases
git config alias.lg "log --oneline --graph --decorate --all"
git config alias.st "status --short --branch"
git config alias.recent "branch --sort=-committerdate -v"
git config alias.undo "reset HEAD~1 --mixed"

echo "Git configured. Run 'git lg' to verify."
```

3. Add `scripts/git-setup.sh` to CONTRIBUTING.md onboarding steps.

---

### Overwritten PR During Rebase

**What happens**

An engineer submits a PR. A reviewer adds line-level comments. While the reviewer is writing a longer review comment, the author rebases the branch and force-pushes. The reviewer's comment references a commit SHA that no longer exists. GitHub shows "This pull request has new commits" — the reviewer loses their place, and some comments become "outdated" immediately, creating confusion.

**Root cause**

`git push --force-with-lease` during an active review rewrites the branch history. GitHub can display outdated comments but loses the diff context. Reviewers experience this as the rug being pulled out.

**Consequences**

- Reviewer frustration; review may restart from scratch
- Risk of comments being dismissed as "outdated" without being addressed
- Author-reviewer communication breakdown
- Review turnaround time increases

**Prevention protocol**

1. **Policy:** do not force-push to a branch during active review. Communicate in the PR: "rebasing now, heads up @reviewer."

2. **During review, use merge instead of rebase** to incorporate upstream changes:

```bash
# While PR is under review — do this instead of rebase:
git fetch origin
git merge origin/main   # creates a merge commit but doesn't rewrite history
# Reviewer can continue seeing the original commits unchanged
```

3. **Reserve rebase/force-push for BEFORE requesting review**, or AFTER all reviews are complete and you're doing a final cleanup.

4. **Configure GitHub to notify reviewers of force pushes** (Settings → Notifications).

---

### Partial Staging Mistakes

**What happens**

An engineer is fixing two unrelated bugs simultaneously: one in a dbt model and one in a Python transformer. They use `git add -p` to stage only the dbt fix, but accidentally include one hunk of the Python fix that imports a module not yet committed. The resulting commit compiles in isolation but the import fails at runtime, breaking CI.

**Root cause**

`git add -p` (patch mode) shows hunks in sequence. It is easy to accidentally press `y` on a hunk that should be `n`, especially in a large file with many hunks. The staged snapshot is not the same as the working tree, and engineers rarely verify the staged snapshot before committing.

**Consequences**

- CI fails on a commit that "looked clean" to the author
- Broken commits in PR history (even if not on main) are confusing for reviewers
- If the mistake reaches main via a fast-merge, it breaks main

**Prevention protocol**

1. **Always inspect staged changes before committing:**

```bash
git diff --staged        # see exactly what is about to be committed
git diff --staged --stat # summary view
```

2. **Use VS Code's Source Control panel** for staging — selecting individual lines and hunks visually is less error-prone than interactive patch mode.

3. **Two-branch strategy for simultaneous fixes:**

```bash
# Branch for dbt fix
git stash
git checkout -b fix/dbt-model-null-handling main
git stash pop
git add -p   # now only one fix exists, staging is simpler
```

4. **Pre-commit hook that runs a syntax/import check:**

```bash
# .pre-commit-config.yaml
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-merge-conflict
      - id: debug-statements
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
```

---

### Tag Mismanagement

**What happens**

After 18 months of development, the repo has 3 inconsistent tags (`v1`, `release-2023-11`, `production-deploy`), no tags for the last 8 months of releases, and no way to answer the question: "what exact code is running in production right now?" When a production incident occurs, the team cannot determine the deployed commit without consulting deployment logs.

**Root cause**

No tagging policy, no automation creating tags on release, and team members not seeing tagging as part of the deployment workflow.

**Consequences**

- Cannot reproduce a production environment — critical for incident investigation
- EU BMR requires traceability from index output to the calculation code that produced it; missing tags break this chain
- Rollback requires guessing the right commit rather than using a known good tag
- `git describe` does not work reliably without consistent tags

**Prevention protocol**

1. **Adopt semantic versioning:** `MAJOR.MINOR.PATCH` — `v2.4.1`

2. **Automate tagging in CI on merge to main:**

```yaml
# .github/workflows/tag-release.yml
name: Tag Release
on:
  push:
    branches: [main]

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get next version
        id: version
        run: |
          LATEST=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
          MAJOR=$(echo $LATEST | cut -d. -f1 | tr -d v)
          MINOR=$(echo $LATEST | cut -d. -f2)
          PATCH=$(echo $LATEST | cut -d. -f3)
          echo "new_tag=v${MAJOR}.${MINOR}.$((PATCH+1))" >> $GITHUB_OUTPUT

      - name: Create tag
        run: |
          git tag ${{ steps.version.outputs.new_tag }}
          git push origin ${{ steps.version.outputs.new_tag }}
```

3. **Manual tagging for major releases:**

```bash
git tag -a v2.4.0 -m "release: index engine v2.4.0 — ESG Scope 3 support"
git push origin v2.4.0
```

4. **Verify deployed version** in each environment:

```bash
# In a pipeline healthcheck endpoint or deployment log:
git describe --tags --dirty
# Output: v2.4.0-3-gabc1234  (3 commits after v2.4.0, dirty working tree)
```

---

### Submodule Pain

**What happens**

The repo uses a Git submodule for a shared Python utilities library. After `git pull`, engineers see the submodule pointing to an old commit. Running shared utility functions produces different results locally vs CI because everyone is on different submodule versions. Updating the submodule is a tribal knowledge step that new engineers skip for weeks.

**Root cause**

Git submodules are a pointer (a `.gitmodules` file + a commit SHA) stored in the parent repo. `git pull` does NOT update submodules by default — it only updates the parent repo's pointer. Engineers must explicitly run `git submodule update --init --recursive` or configure `submodule.recurse`.

**Consequences**

- Silent version skew: everyone thinks they have the same code but they don't
- CI may use a different version than local development
- Debugging shared library issues is extremely difficult when submodule versions differ
- Onboarding complexity: a step that must be explained to every new engineer

**Prevention protocol**

1. **Prefer package managers over submodules** for shared code:
   - Python: publish to a private PyPI (Artifact Registry, Azure Artifacts, Nexus)
   - .NET: publish to a private NuGet feed
   - This gives versioned, reproducible dependencies without submodule complexity

2. **If submodules must be used, configure automatic recursion:**

```bash
git config --global submodule.recurse true
# Now git pull, git checkout, etc. automatically update submodules
```

3. **Always initialize on clone:**

```bash
git clone --recurse-submodules https://github.com/org/repo.git
# Or if already cloned:
git submodule update --init --recursive
```

4. **Verify submodule state:**

```bash
git submodule status
# Output: +abc1234 lib/shared-utils (v1.2.3-4-gabc1234)
# + prefix means the submodule is ahead of the recorded commit
```

5. **Update a submodule to latest:**

```bash
git submodule update --remote lib/shared-utils
git add lib/shared-utils
git commit -m "chore(deps): update shared-utils to latest"
```

---

### Monorepo vs Multi-Repo Friction

**What happens**

The team keeps all code — Airflow DAGs, SQL migrations, Terraform configs, dbt models, Python pipelines, and C# API code — in a single repository. Cross-cutting changes (a new data source requires changes in DAGs, migrations, dbt models, Python, AND the API) are a single PR and easy to review atomically. But the C# team complains that CI takes 25 minutes because Python tests run on every C# change. Terraform engineers get pinged on every dbt PR via CODEOWNERS.

**Root cause**

Monorepos simplify atomic changes and dependency management at the cost of CI efficiency, noisy notifications, and toolchain diversity. Multi-repo setups simplify team autonomy at the cost of cross-repo changes becoming distributed transactions.

**Consequences**

- Monorepo: slow CI for unrelated changes, ownership boundary confusion, merge queue contention
- Multi-repo: cross-service changes require N coordinated PRs, version compatibility management, integration testing across repos is complex

**Decision matrix**

| Factor | Monorepo | Multi-Repo |
|--------|----------|------------|
| Atomic cross-component changes | Easy | Multiple coordinated PRs |
| Team autonomy per domain | Lower | Higher |
| CI speed | Slower (unless path filtering) | Faster per repo |
| Onboarding | One clone | Multiple clones, more context |
| Audit trail | Single timeline | Distributed |
| Dependency management | Shared lockfile | Explicit version pinning |
| Regulated environment | Easier audit | Harder to trace across repos |

For a financial index platform with EU BMR requirements, **monorepo is preferred** — a single audit trail for a release that may span DAGs, migrations, and API changes is significantly easier to trace.

**Prevention protocol**

1. **Monorepo structure for data engineering with CODEOWNERS per folder:**

```
repo-root/
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
├── dags/                    # Airflow DAGs
│   ├── finance/
│   └── esg/
├── migrations/              # Flyway/Liquibase SQL
├── models/                  # dbt models
│   ├── finance/
│   ├── esg/
│   └── staging/
├── pipelines/               # Python transformation code
│   ├── finance/
│   └── esg/
├── terraform/               # Infrastructure
│   ├── environments/
│   └── modules/
└── src/
    └── Api/                 # C# API
```

2. **Path-filtered CI to speed up builds:**

```yaml
# .github/workflows/ci-python.yml
on:
  push:
    paths:
      - 'dags/**'
      - 'pipelines/**'
      - 'models/**'
      - 'migrations/**'

# .github/workflows/ci-csharp.yml
on:
  push:
    paths:
      - 'src/Api/**'

# .github/workflows/ci-terraform.yml
on:
  push:
    paths:
      - 'terraform/**'
```

3. **CODEOWNERS for ownership clarity:**

```
# .github/CODEOWNERS
/dags/            @airflow-team
/migrations/      @dba-team @data-engineering-lead
/models/          @analytics-engineering-team
/pipelines/       @data-engineering-team
/terraform/       @infra-team
/src/Api/         @backend-team
/.github/         @devops-team
```

4. **If splitting is necessary**, extract the C# API first (most different language, toolchain, and team) while keeping data-domain code (DAGs, dbt, migrations, Python) together where atomic cross-component changes are frequent.

---

## Related

- [git-daily-workflow](/08-Git/git-daily-workflow) — Standard daily Git workflow
- [git-branching-and-merging](/08-Git/git-branching-and-merging) — Branching strategy reference
- [git-recovery-and-undo](/08-Git/git-recovery-and-undo) — Recovery commands
- [git-merge-conflicts](/08-Git/git-merge-conflicts) — Conflict resolution guide
- [pull-requests-and-code-review](/08-Git/pull-requests-and-code-review) — PR best practices
- [github-actions-problems](/10-GitHub-Actions/github-actions-problems) — CI/CD-specific problems (companion note)

---

## Sources

- Navigating Git Conflicts: Best Practices (DEV Community)
- Git Merge Conflicts Resolved: Lessons from a Disaster (PixelFree Studio)
- Database DevOps: Fix Git Before It Breaks Production (Harness)
- Best Git Strategies for Data Engineering Teams (Data Engineer Academy)
- How to Avoid Security Risks After Leaking Credentials on GitHub (GitGuardian)
- Overcoming Git Disasters (Swimm)
- Git Branching Strategies vs Trunk-Based Development (LaunchDarkly)
