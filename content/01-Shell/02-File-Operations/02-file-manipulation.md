---
title: "02 - File Manipulation"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [cp, mv, rm, chmod, chown, mkdir, file permissions, safe delete, file ownership]
keywords: [cp, mv, rm, chmod, chown, mkdir, rsync, file copy, file move, delete, permissions, ownership, octal permissions, safe delete, trash, archive mode, disk usage, docker permissions, airflow uid]
description: "Safe file copying, moving, and deletion patterns for production environments. Covers rsync archive mode, chmod octal notation, chown for Docker/Airflow containers, and the safe delete pattern using a trash directory."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# File Manipulation

> [!quote]+
>
> "Unix was not designed to stop you from doing stupid things, because that would also stop you from doing clever things."
>
> — **Douglas Gwyn**

> [!abstract]- Summary
>
> Use archive-preserving copies when metadata matters, `rsync` when transfer integrity matters, same-filesystem renames when atomic publication matters, and staged deletion when a path could be wrong. The Linux and PowerShell sections below keep the command surfaces separate, use disposable fixtures, and verify every state-changing example with live output.

> [!note]- Glossary
>
> **`cp`**
> - The standard Linux command for copying files and directories; `-r` copies trees and `-a` preserves metadata such as timestamps, modes, ownership, and symlinks.
> - Use it for local copies where you control both paths and do not need resumable transfer logic.
> - Plain recursive copies are not archive copies; use `cp -a` when downstream jobs rely on original metadata.
>
> ---
>
> **`rsync`**
> - A file-transfer tool that compares source and destination state and copies only what is needed.
> - Use it for large local copies, network transfers, resumable jobs, and exact synchronization with `--delete`.
> - A trailing slash on the source changes the copy boundary; with `--delete`, the wrong slash can prune the wrong destination tree.
>
> ---
>
> **`mv`**
> - The Linux move and rename command.
> - Use it for in-place renames and same-filesystem publish steps after writing to a temporary path.
> - Same-filesystem moves are fast renames; cross-filesystem moves degrade into copy-then-delete and lose the all-or-nothing behavior.
>
> ---
>
> **`rm`**
> - The Linux command for permanent deletion.
> - Use it for deliberate removal when you have already verified the path and recovery story.
> - `rm -rf` is immediate and has no recycle bin; in automation, move targets into a trash directory first.
>
> ---
>
> **Trash pattern**
> - A safe-delete workflow that moves the target into a dedicated staging directory before final removal.
> - Use it in scripts when the delete path comes from variables, globs, or upstream logic.
> - The pattern only helps if you inspect the staging directory before the final `rm -rf`.
>
> ---
>
> **`chmod`**
> - The Linux command for changing permission bits with octal or symbolic notation.
> - Use it to make scripts executable, lock down secrets, or normalize file modes in deployment steps.
> - Mode changes only behave predictably on filesystems that support Unix permissions; FAT32, exFAT, and some mounted Windows paths do not.
>
> ---
>
> **`chown`**
> - The Linux command for changing file ownership.
> - Use it when a service account, container UID, or deployment user must own a path.
> - Ownership changes usually require root or `sudo`, and container bind mounts fail if the host path owner does not match the runtime UID.
>
> ---
>
> **`rename` (Perl)**
> - A batch renamer that applies a Perl substitution expression to filenames.
> - Use it for consistent pattern-based renames when the Perl implementation is installed.
> - Debian and Ubuntu ship a different `rename` utility than several RHEL-family systems, so verify the implementation with `rename --version`.
>
> ---
>
> **`du` / `df`**
> - `du` reports how much disk space a path consumes; `df` reports how much free space and inode capacity the underlying filesystem still has.
> - Use `du` to find the heavy directories and `df` to confirm whether the filesystem itself can absorb more writes.
> - Byte usage and inode usage can fail independently, so large write jobs should check both `df -h` and `df -i`.
>
> ---
>
> **`icacls`**
> - The Windows ACL tool for viewing, granting, removing, and resetting NTFS permissions.
> - Use it when directory access depends on inherited Windows permissions rather than Unix mode bits.
> - Grant entries need inheritance flags such as `(OI)(CI)` if the permission should cascade to child files and folders.
>
> ---
>
> **`Remove-Item`**
> - The PowerShell cmdlet for deleting files and directories.
> - Use it for deliberate file-system cleanup after you have inspected the target path or previewed with `-WhatIf`.
> - `Remove-Item -Recurse -Force` has no recycle bin and sometimes needs a .NET fallback when other processes still hold handles.

## Linux file manipulation tools

Linux keeps file manipulation in small, explicit utilities. The demonstrations below were run in WSL against disposable paths under `/tmp/elysium-file-manipulation`, so the output shows real command behavior without touching production data.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#7aa2f7', 'primaryTextColor': '#c0caf5', 'primaryBorderColor': '#3b4261', 'lineColor': '#7dcfff', 'secondaryColor': '#1a1b26', 'tertiaryColor': '#16161e', 'background': '#1a1b26', 'mainBkg': '#1a1b26', 'nodeBorder': '#3b4261', 'clusterBkg': '#16161e', 'titleColor': '#c0caf5', 'edgeLabelBackground': '#1a1b26', 'attributeBackgroundColorEven': '#16161e', 'attributeBackgroundColorOdd': '#1a1b26'}}}%%
flowchart TD
    A([Need to delete a file or directory?]) --> B{Is this inside a script?}
    B -- Yes --> C[Use trash pattern]
    B -- No --> D{Do you have a backup?}
    D -- No --> C
    D -- Yes --> E{Single file or whole directory?}
    E -- Single file --> F[rm file.txt]
    E -- Directory --> G{Are you certain of the path?}
    G -- No --> C
    G -- Yes --> H[rm -rf dir/]
    C --> I([Verify TRASH_DIR, then rm -rf])

    style A fill:#7aa2f7,color:#1a1b26
    style C fill:#9ece6a,color:#1a1b26
    style F fill:#e0af68,color:#1a1b26
    style H fill:#f7768e,color:#1a1b26
    style I fill:#9ece6a,color:#1a1b26
```

### Linux | cp | copy files and directories

`cp` is the direct tool for local copies. Use plain `cp` for one file, `cp -r` for a directory tree, and `cp -a` when timestamps, modes, symlinks, and ownership have to survive the copy intact.

#### Copy a single file

This is the baseline local copy. Add `-v` in demonstrations or incident response work when you want the destination path echoed back immediately.

*Run the commands in this section to copy a single file.*
```bash
cp -v /tmp/elysium-file-manipulation/cp-single/source.txt /tmp/elysium-file-manipulation/cp-single/dest.txt
```

```text
'/tmp/elysium-file-manipulation/cp-single/source.txt' -> '/tmp/elysium-file-manipulation/cp-single/dest.txt'
```

#### Copy a directory recursively

`-r` copies the tree structure and file contents, but it is still not archive mode. Use this form for quick copies when you do not care about preserving the original metadata.

*Run the commands in this section to copy a directory recursively.*
```bash
cp -rv /tmp/elysium-file-manipulation/cp-recursive/source_dir /tmp/elysium-file-manipulation/cp-recursive/dest_dir
```

```text
'/tmp/elysium-file-manipulation/cp-recursive/source_dir' -> '/tmp/elysium-file-manipulation/cp-recursive/dest_dir'
'/tmp/elysium-file-manipulation/cp-recursive/source_dir/nested' -> '/tmp/elysium-file-manipulation/cp-recursive/dest_dir/nested'
'/tmp/elysium-file-manipulation/cp-recursive/source_dir/nested/file.txt' -> '/tmp/elysium-file-manipulation/cp-recursive/dest_dir/nested/file.txt'
```

#### Archive copy preserving all metadata

`cp -a` is the safer default for data directories because it preserves the state that downstream tooling often keys on. That includes `mtime`, modes, and symlink shape.

*Run the commands in this section to archive copy preserving all metadata.*
```bash
cp -av /tmp/elysium-file-manipulation/cp-archive/source_dir /tmp/elysium-file-manipulation/cp-archive/dest_dir
```

```text
'/tmp/elysium-file-manipulation/cp-archive/source_dir' -> '/tmp/elysium-file-manipulation/cp-archive/dest_dir'
'/tmp/elysium-file-manipulation/cp-archive/source_dir/config.ini' -> '/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.ini'
'/tmp/elysium-file-manipulation/cp-archive/source_dir/config.link' -> '/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.link'
```

*Run the commands in this section to archive copy preserving all metadata.*
```bash
stat -c '%n %A %y %N' /tmp/elysium-file-manipulation/cp-archive/dest_dir/config.ini /tmp/elysium-file-manipulation/cp-archive/dest_dir/config.link
```

```text
/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.ini -rw-r--r-- 2024-01-02 03:04:00.000000000 +0100 '/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.ini'
/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.link lrwxrwxrwx 2026-04-14 10:49:21.668580698 +0200 '/tmp/elysium-file-manipulation/cp-archive/dest_dir/config.link' -> 'config.ini'
```

#### Skip existing files (no-clobber)

No-clobber copies are intentionally quiet when the destination already exists, so verify the target immediately after the command if you need proof that the original file stayed in place.

*Run the commands in this section to skip existing files (no-clobber).*
```bash
cp -n /tmp/elysium-file-manipulation/cp-noclobber/source.txt /tmp/elysium-file-manipulation/cp-noclobber/dest.txt
```

*Run the commands in this section to skip existing files (no-clobber).*
```bash
cat /tmp/elysium-file-manipulation/cp-noclobber/dest.txt
```

```text
destination-stays
```

#### Copy only when source is newer

`-u` turns `cp` into a simple timestamp-based update step. It is useful in build or staging workflows that do not need `rsync` but still want to avoid replacing newer destinations.

*Run the commands in this section to copy only when source is newer.*
```bash
cp -vu /tmp/elysium-file-manipulation/cp-update/source.txt /tmp/elysium-file-manipulation/cp-update/dest.txt
```

```text
'/tmp/elysium-file-manipulation/cp-update/source.txt' -> '/tmp/elysium-file-manipulation/cp-update/dest.txt'
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-r` | `cp -r src/ dst/` | Recursive copy (required for directories) |
| `-a` | `cp -a src/ dst/` | Archive mode: recursive + preserve all metadata |
| `-n` | `cp -n src dst` | No-clobber: skip if destination exists |
| `-u` | `cp -u src dst` | Update: copy only when source is newer |
| `-v` | `cp -v src dst` | Verbose: print each copied file |
| `-i` | `cp -i src dst` | Interactive: prompt before overwrite |
| `-l` | `cp -l src dst` | Hard link instead of copy |
| `-s` | `cp -s src dst` | Symbolic link instead of copy |
| `-p` | `cp -p src dst` | Preserve mode, ownership, timestamps |
| `--backup` | `cp --backup src dst` | Make a backup of destination if it exists |

### Linux | rsync | resumable copy with checksum verification

Use `rsync` when the copy might be large, remote, restartable, or destructive to the destination. It is the right tool for transfers that need visibility and a dry-run phase before commit.

#### Copy a file with progress display

`--progress` makes a one-off copy observable. In automation, keep the progress output for operator runs and drop it when logs need to stay compact.

*Run the commands in this section to copy a file with progress display.*
```bash
rsync -ah --progress /tmp/elysium-file-manipulation/rsync-progress/source.tar.gz /tmp/elysium-file-manipulation/rsync-progress/dest/
```

```text
sending incremental file list
source.tar.gz
          4.10K 100%    0.00kB/s    0:00:00
          4.10K 100%    0.00kB/s    0:00:00 (xfr#1, to-chk=0/1)
```

#### Sync a directory, deleting removed files from destination

`--delete` makes the destination converge on the source. That is what you want for mirror directories and exactly what you do not want if the source path is wrong, so dry-run this form before the live pass.

*Run the commands in this section to sync a directory, deleting removed files from destination.*
```bash
rsync -avh --delete /tmp/elysium-file-manipulation/rsync-delete/src/ /tmp/elysium-file-manipulation/rsync-delete/dest/
```

```text
sending incremental file list
deleting extra.txt
keep.txt

sent 128 bytes  received 48 bytes  352.00 bytes/sec
total size is 5  speedup is 0.03
```

The source slash controls whether `rsync` copies the directory itself or only its contents:

| Command | Result |
|---|---|
| `rsync -a src/ dest/` | Files land directly in `dest/` |
| `rsync -a src dest/` | Creates `dest/src/` containing the files |

#### Dry-run preview

Dry runs are the last safe place to catch a bad trailing slash, a wrong destination, or an unexpected delete set.

*Run the commands in this section to dry-run preview.*
```bash
rsync -avn --delete /tmp/elysium-file-manipulation/rsync-dryrun/src/ /tmp/elysium-file-manipulation/rsync-dryrun/dest/
```

```text
sending incremental file list
deleting extra.txt
keep.txt

sent 79 bytes  received 28 bytes  214.00 bytes/sec
total size is 5  speedup is 0.05 (DRY RUN)
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-a` | `rsync -a src/ dst/` | Archive mode: recursive + preserve all attributes |
| `-h` | `rsync -h` | Human-readable sizes |
| `-v` | `rsync -v` | Verbose output |
| `-n` / `--dry-run` | `rsync -n` | Simulate without making changes |
| `--progress` | `rsync --progress` | Show per-file transfer progress |
| `--delete` | `rsync --delete src/ dst/` | Delete destination files not in source |
| `-z` | `rsync -z` | Compress data during transfer |
| `-e` | `rsync -e ssh` | Specify remote shell |
| `--exclude` | `rsync --exclude='*.log'` | Exclude files matching pattern |
| `--checksum` | `rsync --checksum` | Skip based on checksum, not mod-time + size |
| `--partial` | `rsync --partial` | Keep partially transferred files on interruption |
| `--bwlimit` | `rsync --bwlimit=1000` | Limit bandwidth (KB/s) |

### Linux | mv | move and rename files

`mv` is the fast path for renames and same-filesystem publishes. When source and destination live on different filesystems, treat it as copy-then-delete and switch to `rsync` if you need verifiable progress or a resumable fallback.

#### Rename a file

This is the standard same-directory rename. Use it after writing a temporary file in the final destination directory so readers never see a partial publish.

*Run the commands in this section to rename a file.*
```bash
mv -v /tmp/elysium-file-manipulation/mv-rename/old.txt /tmp/elysium-file-manipulation/mv-rename/new.txt
```

```text
renamed '/tmp/elysium-file-manipulation/mv-rename/old.txt' -> '/tmp/elysium-file-manipulation/mv-rename/new.txt'
```

#### Move a file to another directory

This form relocates the file into an existing directory. If the target is on another filesystem and the payload is large, prefer `rsync -ah --remove-source-files` so you can watch and verify the transfer.

> [!warning] Cross-filesystem moves stop being atomic
>
> GNU `mv` is only a metadata rename while source and destination stay on the same filesystem. If the destination lives on a different filesystem, `mv` falls back to copying as if by `cp -a` and then removing the source, which means partial progress and cleanup behavior matter again.

*Run the commands in this section to move a file to another directory.*
```bash
mv -v /tmp/elysium-file-manipulation/mv-move/file.txt /tmp/elysium-file-manipulation/mv-move/target-dir/
```

```text
renamed '/tmp/elysium-file-manipulation/mv-move/file.txt' -> '/tmp/elysium-file-manipulation/mv-move/target-dir/file.txt'
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-i` | `mv -i src dst` | Interactive: prompt before overwrite |
| `-n` | `mv -n src dst` | No-clobber: refuse to overwrite existing |
| `-u` | `mv -u src dst` | Move only when source is newer |
| `-v` | `mv -v src dst` | Verbose: print each moved file |
| `-f` | `mv -f src dst` | Force: never prompt |

### Linux | rename | batch rename with Perl regex

The Perl `rename` utility is efficient when you have the expected implementation installed. The portable fallback is still a shell loop around `mv`, which is why both forms are worth keeping on hand.

#### Batch rename file extensions

This form rewrites matching filenames in place. Check `rename --version` first because Debian-family and some RHEL-family systems do not ship the same syntax.

*Run the commands in this section to batch rename file extensions.*
```bash
rename -v 's/\.csv$/.csv.bak/' /tmp/elysium-file-manipulation/rename-perl/*.csv
```

```text
/tmp/elysium-file-manipulation/rename-perl/report-01.csv renamed as /tmp/elysium-file-manipulation/rename-perl/report-01.csv.bak
/tmp/elysium-file-manipulation/rename-perl/report-02.csv renamed as /tmp/elysium-file-manipulation/rename-perl/report-02.csv.bak
```

When you need the same behavior on systems without the Perl utility, a loop around `mv` is the portable fallback.

*Run the commands in this section to batch rename file extensions.*
```bash
for f in /tmp/elysium-file-manipulation/rename-portable/*.csv; do mv -v "$f" "${f%.csv}.csv.bak"; done
```

```text
renamed '/tmp/elysium-file-manipulation/rename-portable/report-01.csv' -> '/tmp/elysium-file-manipulation/rename-portable/report-01.csv.bak'
renamed '/tmp/elysium-file-manipulation/rename-portable/report-02.csv' -> '/tmp/elysium-file-manipulation/rename-portable/report-02.csv.bak'
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-n` | `rename -n 's/old/new/' *` | Dry-run: show what would be renamed |
| `-v` | `rename -v 's/old/new/' *` | Verbose: print each rename |
| `-f` | `rename -f 's/old/new/' *` | Force: overwrite existing targets |

### Linux | rm | delete files and directories safely

`rm` is permanent. For interactive one-off cleanup, `-v` makes the target explicit. For scripts, move the path into a staging directory first and verify it before final deletion.

#### Delete a single file

Use this for a confirmed single-file delete. There is no recycle bin and no rollback.

*Run the commands in this section to delete a single file.*
```bash
rm -v /tmp/elysium-file-manipulation/rm-file/file.txt
```

```text
removed '/tmp/elysium-file-manipulation/rm-file/file.txt'
```

#### Delete a directory recursively

`-r` walks the tree and removes every nested entry. Use it only after inspecting the directory contents.

*Run the commands in this section to delete a directory recursively.*
```bash
rm -rv /tmp/elysium-file-manipulation/rm-directory/directory/
```

```text
removed '/tmp/elysium-file-manipulation/rm-directory/directory/nested/file.txt'
removed directory '/tmp/elysium-file-manipulation/rm-directory/directory/nested'
removed directory '/tmp/elysium-file-manipulation/rm-directory/directory/'
```

#### Force delete without confirmation

`-f` suppresses prompts and ignores missing files. Combined with `-r`, it is the fastest way to remove the wrong tree, so pair it with explicit path checks and `set -u` in scripts.

*Run the commands in this section to force delete without confirmation.*
```bash
rm -rfv /tmp/elysium-file-manipulation/rm-force/directory/
```

```text
removed '/tmp/elysium-file-manipulation/rm-force/directory/nested/file.txt'
removed directory '/tmp/elysium-file-manipulation/rm-force/directory/nested'
removed directory '/tmp/elysium-file-manipulation/rm-force/directory/'
```

#### Safe delete — move to staging area instead

A staged move gives you a recovery window. The live demo uses a fixed trash directory name so the verification stays readable, but the same pattern should be timestamped in production scripts.

> [!tip] Keep the trash directory on the same filesystem
>
> This pattern works best when the staging directory lives on the same volume as the target. In that case the move stays a fast rename; if you send the target to another filesystem, the "safe delete" step turns into a copy-then-remove operation and loses its quick rollback characteristics.

*Run the commands in this section to safe delete — move to staging area instead.*
```bash
mkdir -pv /tmp/elysium-trash-20260414-061410
```

```text
mkdir: created directory '/tmp/elysium-trash-20260414-061410'
```

*Run the commands in this section to safe delete — move to staging area instead.*
```bash
mv -v /tmp/elysium-file-manipulation/rm-safe-delete/directory /tmp/elysium-trash-20260414-061410/
```

```text
renamed '/tmp/elysium-file-manipulation/rm-safe-delete/directory' -> '/tmp/elysium-trash-20260414-061410/directory'
```

*Run the commands in this section to safe delete — move to staging area instead.*
```bash
find /tmp/elysium-trash-20260414-061410 -maxdepth 2 -printf '%P\n' | sort
```

```text
directory
directory/file.txt
```

Use the same pattern in automation, but generate a unique trash path before the move:

*Run the commands in this section to safe delete — move to staging area instead.*
```bash
mkdir -p /tmp/trash_20260414_061410 && mv /tmp/elysium-file-manipulation/rm-script/target /tmp/trash_20260414_061410/ && echo "Moved to /tmp/trash_20260414_061410 — verify before final deletion"
```

```text
Moved to /tmp/trash_20260414_061410 — verify before final deletion
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-r` | `rm -r dir/` | Recursive: delete directory and contents |
| `-f` | `rm -f file` | Force: no error if absent, no prompt |
| `-rf` | `rm -rf dir/` | Force recursive deletion (use with extreme caution) |
| `-i` | `rm -i file` | Interactive: prompt before each deletion |
| `-v` | `rm -v file` | Verbose: print each deleted file |
| `--` | `rm -- -file` | End of options: allows deleting files starting with `-` |

### Linux | mkdir | create directory trees

`mkdir` is simple until the path becomes nested or rerunnable. `-p` is the idempotent form you want in setup scripts and deploy steps.

#### Create a directory

This creates one directory and shows the resulting path immediately.

*Run the commands in this section to create a directory.*
```bash
mkdir -pv /tmp/elysium-file-manipulation/mkdir-single/mydir
```

```text
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-single'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-single/mydir'
```

#### Create nested directories with parents

This is the Linux equivalent of a declarative directory scaffold. It is safe to run repeatedly because existing parents are not treated as errors.

*Run the commands in this section to create nested directories with parents.*
```bash
mkdir -pv /tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/bronze/staging /tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/silver/staging /tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/gold/staging
```

```text
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/bronze'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/bronze/staging'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/silver'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/silver/staging'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/gold'
mkdir: created directory '/tmp/elysium-file-manipulation/mkdir-nested/data/pipeline/gold/staging'
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-p` | `mkdir -p path/to/dir` | Create parents as needed; no error if exists |
| `-m` | `mkdir -m 750 dir` | Set permissions at creation time |
| `-v` | `mkdir -v dir` | Verbose: print each created directory |

### Linux | chmod | set file permissions

`chmod` changes Unix mode bits, not Windows ACLs. Use it on native Linux filesystems for executables, secrets, and deployment artifacts, and move to `icacls` when the backing path is really NTFS, FAT32, or exFAT.

#### Set permissions with octal notation

Octal notation is the compact way to normalize a file or script to a known state.

*Run the commands in this section to set permissions with octal notation.*
```bash
chmod -v 755 /tmp/elysium-file-manipulation/chmod-octal/script.sh
```

```text
mode of '/tmp/elysium-file-manipulation/chmod-octal/script.sh' changed from 0644 (rw-r--r--) to 0755 (rwxr-xr-x)
```

#### Add execute bit with symbolic notation

Symbolic notation is safer when you only want to add one capability and leave the rest of the mode alone.

*Run the commands in this section to add execute bit with symbolic notation.*
```bash
chmod -v +x /tmp/elysium-file-manipulation/chmod-exec/script.sh
```

```text
mode of '/tmp/elysium-file-manipulation/chmod-exec/script.sh' changed from 0644 (rw-r--r--) to 0755 (rwxr-xr-x)
```

#### Modify specific permission bits

This form adjusts only the named subject and permission bits. It is useful when group write access needs to be removed without rewriting the whole mode by hand.

*Run the commands in this section to modify specific permission bits.*
```bash
chmod -v u+w,g-w /tmp/elysium-file-manipulation/chmod-specific/file.txt
```

```text
mode of '/tmp/elysium-file-manipulation/chmod-specific/file.txt' changed from 0444 (r--r--r--) to 0644 (rw-r--r--)
```

Common production patterns:

- `755` for scripts and executables
- `644` for ordinary data files and configs
- `600` for secrets and key material
- `700` for private directories

| Flag | Syntax | Description |
|------|--------|-------------|
| `-R` | `chmod -R 755 dir/` | Recursive: apply to all files in directory |
| `-v` | `chmod -v 644 file` | Verbose: show permission change for each file |
| `-c` | `chmod -c 644 file` | Report only files whose permissions actually changed |
| `--reference` | `chmod --reference=ref file` | Copy permissions from reference file |

### Linux | chown | change file ownership

Ownership fixes are where container runtime mismatches usually surface. These examples were run as root in a disposable WSL fixture because `chown` normally requires elevated rights.

#### Change owner and group of a file

This is the direct fix when the wrong account owns a single file or artifact.

*Run the commands in this section to change owner and group of a file.*
```bash
chown -v root:root /tmp/elysium-file-manipulation/chown-single/file.txt
```

```text
changed ownership of '/tmp/elysium-file-manipulation/chown-single/file.txt' from alex:alex to root:root
```

#### Fix Airflow container permissions on a bind mount

Airflow images commonly run as UID `50000`. If the bind-mounted host path belongs to another user, task logs, DAG parsing, or plugins can fail with `Permission denied`.

*Run the commands in this section to fix Airflow container permissions on a bind mount.*
```bash
chown -Rv 50000:0 /tmp/elysium-file-manipulation/chown-airflow/dags
```

```text
changed ownership of '/tmp/elysium-file-manipulation/chown-airflow/dags/example.py' from root:root to 50000:0
changed ownership of '/tmp/elysium-file-manipulation/chown-airflow/dags' from root:root to 50000:0
```

Verify the container UID with `docker inspect` before applying the same pattern to a real bind mount.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-R` | `chown -R user:group dir/` | Recursive: apply to all files in directory |
| `-v` | `chown -v user file` | Verbose: show change for each file |
| `-c` | `chown -c user file` | Report only files that actually changed |
| `--reference` | `chown --reference=ref file` | Copy ownership from reference file |
| `-h` | `chown -h user symlink` | Change ownership of the symlink itself, not the target |

### Linux | du | check directory size

`du` answers "what is large under this path?" Use it before cleanup and after large copies to see where the bytes actually landed.

#### Get total size of a directory

This is the quick size check before a move, archive, or cleanup window.

*Run the commands in this section to get total size of a directory.*
```bash
du -sh /tmp/elysium-file-manipulation/du/data
```

```text
20K	/tmp/elysium-file-manipulation/du/data
```

#### List subdirectory sizes, sorted largest first

This form shows which immediate child directories are dominating the parent path.

*Run the commands in this section to list subdirectory sizes, sorted largest first.*
```bash
du -h --max-depth=1 /tmp/elysium-file-manipulation/du/data | sort -rh
```

```text
20K	/tmp/elysium-file-manipulation/du/data
8.0K	/tmp/elysium-file-manipulation/du/data/silver
8.0K	/tmp/elysium-file-manipulation/du/data/bronze
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-s` | `du -s dir/` | Summary: print total only, not per-file |
| `-h` | `du -h dir/` | Human-readable sizes (K, M, G) |
| `--max-depth` | `du --max-depth=1 dir/` | Limit recursion depth |
| `-c` | `du -c dir/` | Print grand total at end |
| `-a` | `du -a dir/` | Include all files, not just directories |
| `--exclude` | `du --exclude='*.log' dir/` | Skip files matching pattern |

### Linux | df | check available disk space

`df` answers "can the filesystem behind this path absorb more writes?" Pass a path to limit the report to the filesystem you actually care about, then check inodes separately when a system says it is full but byte usage looks fine.

#### Show disk usage for the target filesystem

This narrows the report to the filesystem that backs `/tmp`.

*Run the commands in this section to show disk usage for the target filesystem.*
```bash
df -h /tmp
```

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/sdf       1007G  2.2G  954G   1% /
```

#### Check inode usage

Bytes are not the only capacity limit. Inode exhaustion blocks new files even when the disk still has free space.

*Run the commands in this section to check inode usage.*
```bash
df -i /tmp
```

```text
Filesystem       Inodes IUsed    IFree IUse% Mounted on
/dev/sdf       67108864 58159 67050705    1% /
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-h` | `df -h` | Human-readable sizes |
| `-i` | `df -i` | Show inode usage instead of block usage |
| `-T` | `df -T` | Show filesystem type |
| `-t` | `df -t ext4` | Filter by filesystem type |
| `--total` | `df --total` | Print grand total row |

## PowerShell file manipulation tools

PowerShell covers the same problem space with cmdlets instead of single-purpose binaries. The examples below use disposable paths under `$env:TEMP\ElysiumFileManipulation` and were captured on PowerShell `7.5.5`.

### PowerShell | Copy-Item | copy files and directories

`Copy-Item` handles ordinary file-system copies well, but there is no single switch that maps to Linux `cp -a` archive semantics across ownership, links, and permission models. In the live file-system run below, `LastWriteTime` stayed intact, so treat metadata behavior as something to verify rather than something to assume away.

#### Copy a file

`-PassThru` makes the copy observable. The follow-up check shows both source and destination timestamps after the copy.

*Run the commands in this section to copy a file.*
```powershell
Copy-Item -Path "$env:TEMP\ElysiumFileManipulation\copy-item-file\source.txt" -Destination "$env:TEMP\ElysiumFileManipulation\copy-item-file\dest.txt" -PassThru | Select-Object Name, LastWriteTime
```

```text
Name     LastWriteTime
----     -------------
dest.txt 02-Jan-24 3:04:00
```

*Run the commands in this section to copy a file.*
```powershell
Get-Item "$env:TEMP\ElysiumFileManipulation\copy-item-file\source.txt", "$env:TEMP\ElysiumFileManipulation\copy-item-file\dest.txt" | Select-Object Name, LastWriteTime
```

```text
Name       LastWriteTime
----       -------------
source.txt 02-Jan-24 3:04:00
dest.txt   02-Jan-24 3:04:00
```

#### Copy a directory recursively

`-Recurse` is required for directory trees. The destination container and its nested file appear in the returned object stream.

*Run the commands in this section to copy a directory recursively.*
```powershell
Copy-Item -Path "$env:TEMP\ElysiumFileManipulation\copy-item-directory\source_dir" -Destination "$env:TEMP\ElysiumFileManipulation\copy-item-directory\dest_dir" -Recurse -PassThru | Select-Object FullName
```

```text
FullName
--------
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\copy-item-directory\dest_dir
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\copy-item-directory\dest_dir\nested
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\copy-item-directory\dest_dir\nested\file.txt
```

*Run the commands in this section to copy a directory recursively.*
```powershell
Get-ChildItem -Recurse "$env:TEMP\ElysiumFileManipulation\copy-item-directory\dest_dir" | Select-Object FullName
```

```text
FullName
--------
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\copy-item-directory\dest_dir\nested
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\copy-item-directory\dest_dir\nested\file.txt
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path src` | Source path(s) |
| `-Destination` | `-Destination dst` | Target path |
| `-Recurse` | `-Recurse` | Copy directories recursively |
| `-Force` | `-Force` | Overwrite read-only files |
| `-Filter` | `-Filter *.csv` | Filter by pattern |
| `-Exclude` | `-Exclude *.tmp` | Exclude matching files |
| `-PassThru` | `-PassThru` | Return copied item objects |

### PowerShell | Move-Item | move files between paths

`Move-Item` is the PowerShell rename and relocation cmdlet. Same-drive moves behave like in-place renames; cross-drive moves still need the same caution as any copy-then-remove workflow.

#### Move a file

The returned object confirms the new path immediately.

*Run the commands in this section to move a file.*
```powershell
Move-Item -Path "$env:TEMP\ElysiumFileManipulation\move-item-file\old.txt" -Destination "$env:TEMP\ElysiumFileManipulation\move-item-file\new.txt" -PassThru | Select-Object Name, FullName
```

```text
Name    FullName
----    --------
new.txt C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\move-item-file\new.txt
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path src` | Source path |
| `-Destination` | `-Destination dst` | Target path |
| `-Force` | `-Force` | Overwrite existing destination |
| `-PassThru` | `-PassThru` | Return moved item object |

### PowerShell | Rename-Item | rename files in place

`Rename-Item` changes the name without changing the containing directory. Use it when the path stays put and only the leaf name changes.

#### Rename a file

This is the direct in-place rename.

*Run the commands in this section to rename a file.*
```powershell
Rename-Item -Path "$env:TEMP\ElysiumFileManipulation\rename-item-file\old.txt" -NewName "new.txt" -PassThru | Select-Object Name, FullName
```

```text
Name    FullName
----    --------
new.txt C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\rename-item-file\new.txt
```

#### Batch rename with regex

The script block form of `-NewName` lets you reuse .NET regex replacement logic across every matching file in the pipeline.

*Run the commands in this section to batch rename with regex.*
```powershell
Get-ChildItem "$env:TEMP\ElysiumFileManipulation\rename-item-batch\*.csv" | Rename-Item -NewName { $_.Name -replace '\.csv$', '.csv.bak' } -PassThru | Select-Object Name
```

```text
Name
----
one.csv.bak
two.csv.bak
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path file` | File to rename |
| `-NewName` | `-NewName name` | New name (not a full path) |
| `-Force` | `-Force` | Overwrite if target exists |
| `-PassThru` | `-PassThru` | Return renamed item object |

### PowerShell | Remove-Item | delete files and directories

`Remove-Item -Recurse -Force` is permanent. Preview uncertain paths with `-WhatIf`, list the target before you delete it, and keep the .NET fallback around for cases where Windows still reports that the directory is not empty.

#### List contents before deleting

This is the last cheap check before an irreversible delete.

*Run the commands in this section to list contents before deleting.*
```powershell
Get-ChildItem "$env:TEMP\ElysiumFileManipulation\remove-item-list\directory" | Format-Table Name
```

```text
Name
----
alpha.txt
beta.txt
```

#### Delete a directory recursively

The delete itself is silent, so verify the result immediately. If Windows still holds a handle open and `Remove-Item` fails, the .NET `Directory.Delete()` call is the fallback worth keeping in your runbook.

*Run the commands in this section to delete a directory recursively.*
```powershell
Remove-Item "$env:TEMP\ElysiumFileManipulation\remove-item-delete\directory" -Recurse -Force
```

*Run the commands in this section to delete a directory recursively.*
```powershell
Test-Path "$env:TEMP\ElysiumFileManipulation\remove-item-delete\directory"
```

```text
False
```

*Run the commands in this section to delete a directory recursively.*
```powershell
[System.IO.Directory]::Delete("$env:TEMP\ElysiumFileManipulation\remove-item-dotnet\directory", $true)
```

*Run the commands in this section to delete a directory recursively.*
```powershell
Test-Path "$env:TEMP\ElysiumFileManipulation\remove-item-dotnet\directory"
```

```text
False
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Recurse` | `-Recurse` | Delete directory and all contents |
| `-Force` | `-Force` | Delete read-only files, no prompt |
| `-ErrorAction` | `-ErrorAction SilentlyContinue` | Suppress errors (use cautiously) |
| `-WhatIf` | `-WhatIf` | Simulate without deleting |
| `-Filter` | `-Filter *.tmp` | Delete only matching files |

### PowerShell | New-Item | create directories with parent creation

`New-Item -ItemType Directory -Force` is the PowerShell equivalent of `mkdir -p`. It creates missing parents and returns the created directory so the path is immediately visible.

#### Create a directory

This creates the full parent chain and returns the final directory object.

*Run the commands in this section to create a directory.*
```powershell
New-Item -ItemType Directory -Path "$env:TEMP\ElysiumFileManipulation\new-item\data\pipeline\bronze" -Force | Select-Object FullName, Name, PSIsContainer
```

```text
FullName                                                                                Name   PSIsContainer
--------                                                                                ----   -------------
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\new-item\data\pipeline\bronze bronze          True
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-ItemType` | `-ItemType Directory` | Type to create: Directory or File |
| `-Path` | `-Path "C:\path"` | Target path |
| `-Force` | `-Force` | Create parents as needed; no error if exists |
| `-Value` | `-Value "content"` | Initial content when creating a file |

### PowerShell | icacls | manage file and directory permissions

`icacls` is the NTFS ACL tool. Use it when access depends on inherited Windows permissions rather than Unix mode bits, and use `takeown` first when you have lost ownership of the target.

#### View permissions on a file or directory

The raw ACL output is machine-specific, but the structure shows which ACEs are inherited and which principal owns which right.

*Run the commands in this section to view permissions on a file or directory.*
```powershell
icacls "$env:TEMP\ElysiumFileManipulation\icacls"
```

```text
C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\icacls S-1-5-21-2737032662-1412455026-3434764341-3764966773:(I)(OI)(CI)(M,DC)
                                                                 ELYSIUM\CodexSandboxUsers:(I)(OI)(CI)(M,DC)
                                                                 S-1-5-21-3124073542-4190037349-2288886573-1349906437:(I)(OI)(CI)(M,DC)
                                                                 NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
                                                                 BUILTIN\Administrators:(I)(OI)(CI)(F)
                                                                 ELYSIUM\Alex:(I)(OI)(CI)(F)

Successfully processed 1 files; Failed processing 0 files
```

#### Grant a user full control

The `(OI)(CI)` flags make the grant flow to files and child directories as well as the directory itself.

*Run the commands in this section to grant a user full control.*
```powershell
icacls "$env:TEMP\ElysiumFileManipulation\icacls" /grant "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F"
```

```text
processed file: C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\icacls
Successfully processed 1 files; Failed processing 0 files
```

#### Remove all permissions for a user

This removes explicit ACEs for the named principal. Inherited permissions can still leave the user effective access through another group.

*Run the commands in this section to remove all permissions for a user.*
```powershell
icacls "$env:TEMP\ElysiumFileManipulation\icacls" /remove "$($env:USERDOMAIN)\$($env:USERNAME)"
```

```text
processed file: C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\icacls
Successfully processed 1 files; Failed processing 0 files
```

#### Reset permissions to inherited defaults

`/reset /T` is the recovery path when explicit grants have drifted too far from the parent directory policy.

*Run the commands in this section to reset permissions to inherited defaults.*
```powershell
icacls "$env:TEMP\ElysiumFileManipulation\icacls" /reset /T
```

```text
processed file: C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\icacls
Successfully processed 1 files; Failed processing 0 files
```

#### Take ownership of a file or directory

Use `takeown` before `icacls` when you are locked out of the path entirely.

*Run the commands in this section to take ownership of a file or directory.*
```powershell
takeown /F "$env:TEMP\ElysiumFileManipulation\icacls" /R /D Y
```

```text
SUCCESS: The file (or folder): "C:\Users\aperi\AppData\Local\Temp\ElysiumFileManipulation\icacls" now owned by user "ELYSIUM\Alex".
```

Permission shorthand:

- `F` for Full control
- `M` for Modify
- `RX` for Read and execute
- `R` for Read
- `W` for Write
- `(OI)` for object inherit
- `(CI)` for container inherit
- `(NP)` for no-propagate

| Flag | Syntax | Description |
|------|--------|-------------|
| `/grant` | `/grant user:perm` | Add permissions (cumulative) |
| `/grant:r` | `/grant:r user:perm` | Replace existing permissions for user |
| `/deny` | `/deny user:perm` | Explicitly deny permissions |
| `/remove` | `/remove user` | Remove all entries for user |
| `/reset` | `/reset` | Reset to inherited permissions |
| `/T` | `/T` | Apply recursively to subdirectories |
| `/C` | `/C` | Continue on errors |
| `/L` | `/L` | Operate on symbolic link itself |
| `/save` | `/save acl.txt` | Save ACL to file for later restore |
| `/restore` | `/restore acl.txt` | Restore ACL from saved file |

`takeown` flags:

| Flag | Syntax | Description |
|------|--------|-------------|
| `/F` | `/F path` | File or directory to take ownership of |
| `/R` | `/R` | Recursive: apply to all files in directory |
| `/D` | `/D Y` | Default answer for confirmation prompts (`Y` = yes) |
| `/A` | `/A` | Give ownership to the Administrators group instead of current user |

### PowerShell | Get-PSDrive | check available disk space

`Get-PSDrive` is the PowerShell-native disk-capacity view. Use raw byte output when another tool needs exact numbers and computed properties when you need a quick operational read.

#### Show disk space for all drives

This keeps the raw byte counts intact.

*Run the commands in this section to show disk space for all drives.*
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free
```

```text
Name          Used         Free
----          ----         ----
C    1777709449216 268719779840
Temp 1777709449216 268719779840
```

#### Show disk space in human-readable GB

This converts the same numbers into operator-friendly gigabytes.

*Run the commands in this section to show disk space in human-readable GB.*
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}}, @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}
```

```text
Name  UsedGB FreeGB
----  ------ ------
C    1655.62 250.26
Temp 1655.62 250.26
```

### PowerShell | Get-ChildItem with Measure-Object | check directory size

This is the PowerShell equivalent of `du -sh`: enumerate the files, sum their byte counts, and project the result into a readable unit.

#### Get total size of a directory in MB

The fixture contains two files totaling 5 MB, which makes the math easy to validate.

*Run the commands in this section to get total size of a directory in MB.*
```powershell
Get-ChildItem -Recurse "$env:TEMP\ElysiumFileManipulation\measure-object" | Measure-Object -Property Length -Sum | Select-Object @{N='TotalMB';E={[math]::Round($_.Sum/1MB,2)}}
```

```text
TotalMB
-------
   5.00
```

## Cross-references

- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/02-File-Operations/01-navigation-and-listing) — check what is present before moving or deleting it
- [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/01-Scripting/05-brace-expansion-and-globbing) — create directory trees efficiently
- [compression](https://alp78.github.io/elysium/01-Shell/02-File-Operations/04-compression) — compress large directories before transfer when bandwidth matters
- [data-transfer](https://alp78.github.io/elysium/01-Shell/02-File-Operations/05-data-transfer) — use `rsync`, `scp`, or object-store tools for remote copies
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/01-Scripting/07-defensive-scripting) — use `set -euo pipefail` to harden delete and move logic
