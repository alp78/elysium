---
type: how-to
category: git
technology: [git, github]
tags: [git]
aliases: [git tag, annotated tag, semantic versioning, release tags, lightweight tag, git push tags, version label, tag a release, SemVer git]
keywords: [git tag, tagging, annotated tag, lightweight tag, release, versioning, semantic versioning, semver, v1.0.0, git push tags, push tag to github, list tags, mark release, tag message, tag annotation, production release, git tag -a]
description: "How to create lightweight and annotated git tags, push them to GitHub, and use semantic versioning to mark production releases."
related: ["[[git-daily-workflow]]", "[[git-history-and-inspection]]", "[[pull-requests-and-code-review]]", "[[github-actions-ci-cd]]"]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Git Tagging and Releases

Git tags are named pointers to specific commits, used to mark significant points in a repository's history — most commonly production releases. Unlike branches, tags do not move as new commits are added. A tag always points to the same commit. This note covers lightweight tags, annotated tags, pushing tags to GitHub, and the semantic versioning convention used to name them.

## Lightweight vs Annotated Tags

Git has two types of tags:

| Type | What it stores | When to use |
|------|---------------|-------------|
| **Lightweight** | A name pointing to a commit SHA — nothing more | Quick local markers, temporary references |
| **Annotated** | A full Git object with tagger name, email, date, and a message | Production releases — preferred |

> [!tip] Use annotated tags for releases
> Annotated tags are stored as full objects in the Git database with metadata. They can be signed with GPG, show up properly in `git describe`, and are the standard for marking software releases. Use lightweight tags only for temporary local bookmarks.

## Creating Tags

**Create a lightweight tag on the current commit:**

```bash
git tag v1.0.0
```

- `tag` — create a named reference pointing to a commit
- `v1.0.0` — the tag name (convention: prefix with `v`, use semantic versioning)

**Create an annotated tag with a message (preferred for releases):**

```bash
git tag -a v1.0.0 -m "First production release"
```

- `-a` — annotated: stores the tagger's name, email, date, and message as a full Git object
- `v1.0.0` — the tag name
- `-m "..."` — the tag message describing this release

**Tag a specific past commit (not just HEAD):**

```bash
git tag -a v0.9.0 -m "Beta release" abc1234
```

- `abc1234` — the commit SHA to tag (use `git log --oneline` to find it)

## Listing Tags

**Show all tags in the repository:**

```bash
git tag
```

Running `git tag` with no arguments lists all tag names alphabetically. To see tag details including the message:

```bash
git tag -n
```

- `-n` — show the first line of each tag's annotation message alongside the tag name

> [!info] Tags are local until pushed
> Tags created with `git tag` exist only in your local repository. They are **not** pushed automatically with `git push`. You must explicitly push them — see the Pushing Tags section below.

## Pushing Tags to GitHub

**Push a single tag to the remote:**

```bash
git push origin v1.0.0
```

- `origin` — the remote name
- `v1.0.0` — the specific tag to push. Tags are not included in regular `git push` — you must name them explicitly, or use `--tags`.

**Push all local tags to the remote:**

```bash
git push origin --tags
```

- `--tags` — push every local tag that does not yet exist on the remote

> [!warning] --tags pushes all tags including drafts
> `git push origin --tags` pushes every tag, including work-in-progress or test tags you may have created locally. For cleaner release workflows, push individual tags by name (`git push origin v1.0.0`) rather than using `--tags`.

## Semantic Versioning Context

Git itself has no opinion on tag naming. The data engineering community convention is **semantic versioning (SemVer)**: `vMAJOR.MINOR.PATCH`.

| Part | Increment when... | Example |
|------|--------------------|---------|
| `MAJOR` | Breaking changes — existing pipelines or APIs stop working | `v1.0.0` → `v2.0.0` |
| `MINOR` | New features added in a backwards-compatible way | `v1.0.0` → `v1.1.0` |
| `PATCH` | Backwards-compatible bug fixes | `v1.0.0` → `v1.0.1` |

Pre-release versions use a hyphen suffix: `v1.0.0-beta.1`, `v1.0.0-rc.2`.

**Typical release workflow:**

```bash
# 1. Ensure main is up to date and all PRs are merged
git checkout main
git pull

# 2. Create the annotated release tag
git tag -a v1.2.0 -m "Add OHLCV fetcher for Asian markets; fix forward-fill bug"

# 3. Push the tag to GitHub
git push origin v1.2.0
```

After pushing, GitHub automatically creates a **Release** entry visible in the repository's Releases tab. You can then edit the release on GitHub to add release notes, attach binaries, or mark it as a pre-release.

## Deleting Tags

**Delete a local tag:**

```bash
git tag -d v1.0.0-draft
```

**Delete a tag on the remote:**

```bash
git push origin --delete v1.0.0-draft
```

> [!warning] Deleting pushed tags affects others
> If collaborators have already fetched a tag, deleting it from the remote does not remove it from their local repos. Coordinate with your team before deleting published tags.

## Integration with GitHub Actions

Tags are a common CI/CD trigger. When you push a tag matching a pattern like `v*`, a GitHub Actions workflow can automatically build, test, and deploy. See [[github-actions-ci-cd]] for workflow configuration.

Example trigger block in a GitHub Actions workflow:

```yaml
on:
  push:
    tags:
      - 'v*'
```

This fires the workflow whenever a tag starting with `v` is pushed — covering `v1.0.0`, `v2.3.1`, etc.

## Quick Reference: Tagging Commands

| Goal | Command |
|------|---------|
| Create lightweight tag | `git tag v1.0.0` |
| Create annotated tag | `git tag -a v1.0.0 -m "Release message"` |
| Tag a past commit | `git tag -a v0.9.0 abc1234 -m "msg"` |
| List all tags | `git tag` |
| List tags with messages | `git tag -n` |
| Push one tag | `git push origin v1.0.0` |
| Push all tags | `git push origin --tags` |
| Delete local tag | `git tag -d v1.0.0` |
| Delete remote tag | `git push origin --delete v1.0.0` |
| Inspect a tag | `git show v1.0.0` |

## Related

- [[git-daily-workflow]] — the commit workflow that precedes tagging a release
- [[git-history-and-inspection]] — `git show`, `git log` to find the commit to tag
- [[pull-requests-and-code-review]] — merging the PR before tagging the release
- [[github-actions-ci-cd]] — triggering deployments automatically on tag push
