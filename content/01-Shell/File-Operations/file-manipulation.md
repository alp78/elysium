---
title: "File Manipulation"
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell]
aliases: [cp, mv, rm, chmod, chown, mkdir, file permissions, safe delete, file ownership]
keywords: [cp, mv, rm, chmod, chown, mkdir, rsync, file copy, file move, delete, permissions, ownership, octal permissions, safe delete, trash, archive mode, disk usage, docker permissions, airflow uid]
description: "Safe file copying, moving, and deletion patterns for production environments. Covers rsync archive mode, chmod octal notation, chown for Docker/Airflow containers, and the safe delete pattern using a trash directory."
parent: "[[domain-data-and-files]]"
links:
  - "[[navigation-and-listing]]"
  - "[[reading-file-contents]]"
  - "[[grep-and-pattern-matching]]"
  - "[[awk-data-processing]]"
  - "[[sed-stream-editing]]"
  - "[[date-and-time-handling]]"
  - "[[finding-files]]"
  - "[[compression]]"
  - "[[data-transfer]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# File Manipulation — Moving Data Safely

> [!quote]
> "Unix was not designed to stop you from doing stupid things, because that would also stop you from doing clever things."
>
> — **Douglas Gwyn**
>
> "Only wimps use tape backup. Real men just upload their important stuff on ftp and let the rest of the world mirror it."
>
> — **Linus Torvalds**, Usenet post (1996)

Copying, moving, and deleting files seems trivial until you accidentally overwrite a production dataset, delete a directory that was still being written to, or run out of disk space mid-copy because you did not check first. Production file operations require explicit safety habits.

## Linux file manipulation tools

Linux provides dedicated single-purpose tools for each file operation: `cp` for copying, `mv` for moving and renaming, `rm` for deletion, `rsync` for resumable transfers, `rename` for batch renames, `mkdir` for directory creation, `chmod` for permissions, `chown` for ownership, `du` for directory size, and `df` for disk space. Each tool has a narrow contract — composing them correctly is where safe file handling begins.

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

`cp` copies files and directories. Without flags it copies a single file. With `-r` it copies directories recursively. With `-a` it preserves all metadata (timestamps, permissions, symlinks).

#### Copy a single file

Copies `source.txt` to `dest.txt`. If `dest.txt` already exists it is silently overwritten — use `-i` to prompt before overwrite or `-n` to skip.

```bash
cp source.txt dest.txt
```

#### Copy a directory recursively

`-r` enables recursive copy. All subdirectories and files are copied, but metadata (timestamps, permissions) is not preserved — use `-a` for that.

```bash
cp -r source_dir/ dest_dir/
```

#### Archive copy preserving all metadata

`-a` (archive) combines `-r` with full metadata preservation: timestamps, permissions, ownership, and symlinks. Use this when copying pipeline data directories — downstream processes often rely on modification times for change detection.

```bash
cp -a source_dir/ dest_dir/
```

> [!warning] cp -r does not preserve timestamps
>
> Plain `cp -r` copies files but resets `mtime` to the current time. If a downstream
> process uses `find -newer` or `stat` to detect changes, every file appears "new" after
> a `cp -r` copy. Always use `cp -a` for data directories.

> [!success] Use cp -a for data directories
>
> `cp -a source_dir/ dest_dir/` preserves timestamps and permissions, keeping downstream change-detection logic intact.

#### Skip existing files (no-clobber)

`-n` prevents overwriting an existing destination file. The copy is silently skipped if the target already exists.

```bash
cp -n source.txt dest.txt
```

#### Copy only when source is newer

`-u` copies only if the source modification time is newer than the destination, or if the destination does not exist. Useful for incremental updates.

```bash
cp -u source.txt dest.txt
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

`rsync` is the standard tool for large or resumable file copies. If interrupted, re-run the same command — it picks up where it left off by comparing checksums. The `-a` flag enables archive mode (recursive + preserve all attributes).

#### Copy a file with progress display

`-ah` enables archive mode and human-readable output. `--progress` prints per-file transfer speed and a running byte count.

```bash
rsync -ah --progress source.tar.gz dest/
```

#### Sync a directory, deleting removed files from destination

`--delete` removes destination files no longer present in the source. Always dry-run before using `--delete` to confirm the source path is correct.

```bash
rsync -ah --delete src/ dest/
```

> [!danger] rsync trailing slash behavior
>
> A trailing `/` on the source means "copy the **contents** of this directory." No
> trailing `/` means "copy the **directory itself**."
>
> | Command | Result |
> |---|---|
> | `rsync -a src/ dest/` | Files land directly in `dest/` |
> | `rsync -a src dest/` | Creates `dest/src/` containing the files |
>
> Combined with `--delete`, a wrong trailing slash can **wipe the destination directory**.

> [!success] Always dry-run before --delete
>
> `rsync -avn --delete src/ dest/` shows exactly what would be transferred and deleted
> without touching any files. Make this a habit before any `rsync --delete` operation.

#### Dry-run preview

`-n` simulates the transfer and prints every file that would be sent or deleted without making any changes to either side.

```bash
rsync -avn --delete src/ dest/
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

`mv` renames files on the same filesystem using a single `rename()` syscall — instantaneous regardless of file size. When source and destination are on different filesystems, `mv` falls back to copy + delete.

#### Rename a file

On the same filesystem, `mv` is a single `rename()` syscall — instantaneous regardless of file size.

```bash
mv old.txt new.txt
```

#### Move a file to another directory

If the destination directory does not exist, `mv` renames the file to that name rather than moving it inside. Verify the destination path exists first.

```bash
mv file.txt /other/dir/
```

> [!warning] mv across filesystems is not atomic
>
> Same-filesystem `mv` is a single syscall — it either succeeds or fails, nothing in
> between. Cross-filesystem `mv` is copy-then-delete. If the copy fails (disk full,
> permission error), you end up with a partial file at the destination and the original
> still at the source.

> [!success] Use rsync for critical cross-filesystem moves
>
> `rsync -a src dst && rm src` gives you a verified copy before deletion. Interruption leaves the source intact.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-i` | `mv -i src dst` | Interactive: prompt before overwrite |
| `-n` | `mv -n src dst` | No-clobber: refuse to overwrite existing |
| `-u` | `mv -u src dst` | Move only when source is newer |
| `-v` | `mv -v src dst` | Verbose: print each moved file |
| `-f` | `mv -f src dst` | Force: never prompt |

### Linux | rename | batch rename with Perl regex

The Perl-based `rename` utility applies a regex substitution to every matching filename. Install with `apt install rename` (Debian/Ubuntu). Not installed by default.

#### Batch rename file extensions

The Perl `s/old/new/` regex is applied to each matching filename. Only the filename is modified — the directory path is unchanged. The `.csv$` anchor prevents matching `.csv` embedded in the middle of a name.

```bash
rename 's/\.csv$/.csv.bak/' *.csv
```

> [!warning] Two different rename utilities
>
> Debian/Ubuntu ship the **Perl rename** (`rename 's/old/new/' files`). RHEL/CentOS ship
> the **util-linux rename** (`rename old new files`) — completely different syntax. Check
> which you have with `rename --version`. If you need portability, use a `for` loop with
> `mv` instead.

> [!success] Portable alternative using a for loop
>
> ```bash
> for f in *.csv; do mv "$f" "${f%.csv}.csv.bak"; done
> ```
> Works on any system without the `rename` utility.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-n` | `rename -n 's/old/new/' *` | Dry-run: show what would be renamed |
| `-v` | `rename -v 's/old/new/' *` | Verbose: print each rename |
| `-f` | `rename -f 's/old/new/' *` | Force: overwrite existing targets |

### Linux | rm | delete files and directories safely

`rm` permanently deletes files and directories. There is no system trash for `rm` — deletion is immediate and unrecoverable without a backup. Safe delete patterns replace direct `rm -rf` with a move-to-staging approach that preserves a recovery window.

#### Delete a single file

`rm` permanently deletes the file with no trash or undo. The space is reclaimed immediately on most filesystems.

```bash
rm file.txt
```

#### Delete a directory recursively

`-r` traverses the directory tree and removes all files and subdirectories. No confirmation is requested.

```bash
rm -r directory/
```

#### Force delete without confirmation

`-f` suppresses all prompts and ignores non-existent files. Combined with `-r`, this is the most dangerous shell command — verify the path before running.

```bash
rm -rf directory/
```

#### Safe delete — move to staging area instead

Move the target to a timestamped trash directory rather than deleting immediately. Verify the staging area, then delete.

```bash
mv directory/ /tmp/delete_me_$(date +%Y%m%d)/
```

> [!warning] Never rm -rf directly in scripts
>
> Use the trash pattern instead:
> ```bash
> TRASH_DIR="/tmp/trash_$(date +%Y%m%d_%H%M%S)"
> mkdir -p "$TRASH_DIR"
> mv "$TARGET_DIR" "$TRASH_DIR/"
> echo "Moved to $TRASH_DIR — delete manually after verification"
> ```
> This gives you a recovery window. In production, the cost of a 30-second delay to verify is infinitely less than the cost of accidentally deleting a database backup directory.

> [!success] Enable set -euo pipefail before any delete logic
>
> `set -u` prevents the catastrophic `rm -rf $UNDEFINED/` expansion. `trap EXIT` ensures cleanup runs even on error. See [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting).

> [!info] trash-cli — freedesktop-compatible trash on Linux
>
> `trash-put file.txt` moves files to the XDG trash (`~/.local/share/Trash`) instead of permanent deletion. Install with `apt install trash-cli`. Use `trash-restore` to recover. Not a substitute for backup, but prevents accidental single-file deletions in interactive use.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-r` | `rm -r dir/` | Recursive: delete directory and contents |
| `-f` | `rm -f file` | Force: no error if absent, no prompt |
| `-rf` | `rm -rf dir/` | Force recursive deletion (use with extreme caution) |
| `-i` | `rm -i file` | Interactive: prompt before each deletion |
| `-v` | `rm -v file` | Verbose: print each deleted file |
| `--` | `rm -- -file` | End of options: allows deleting files starting with `-` |

### Linux | mkdir | create directory trees

`mkdir` creates directories. Without flags it fails if the directory already exists or if parent directories are missing. The `-p` flag makes it idempotent and handles nested paths.

#### Create a directory

Creates `mydir` in the current directory. Fails if `mydir` already exists or if parent directories are missing — use `-p` to handle both.

```bash
mkdir mydir
```

#### Create nested directories with parents

`-p` creates parent directories as needed and suppresses "already exists" errors — making it safe to run repeatedly. Combined with [brace expansion](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing), a single command creates an entire [medallion-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) directory tree.

```bash
mkdir -p /data/pipeline/{bronze,silver,gold}/staging
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-p` | `mkdir -p path/to/dir` | Create parents as needed; no error if exists |
| `-m` | `mkdir -m 750 dir` | Set permissions at creation time |
| `-v` | `mkdir -v dir` | Verbose: print each created directory |

### Linux | chmod | set file permissions

`chmod` sets read/write/execute permissions. Octal notation (e.g., `755`) sets all three permission groups at once. Symbolic notation (e.g., `u+x`) modifies specific bits without affecting the rest.

#### Set permissions with octal notation

Octal notation sets all three permission groups (owner, group, others) simultaneously. `755` gives the owner read/write/execute and gives group and others read/execute.

```bash
chmod 755 script.sh
```

#### Add execute bit with symbolic notation

`+x` adds the execute bit for all three permission groups without changing any other bits. Use this to make a script runnable without touching read/write permissions.

```bash
chmod +x script.sh
```

#### Modify specific permission bits

Comma-separated symbolic expressions are applied atomically. `u+w` adds write for the owner; `g-w` removes write for the group.

```bash
chmod u+w,g-w file
```

> [!warning] chmod follows symlinks
>
> `chmod 600 my_link` changes permissions on the **target file**, not the symlink itself.
> On most Linux filesystems, symlink permissions are ignored entirely — the target's
> permissions govern access. This surprises people who expect the symlink to act as a
> permission barrier.

> [!success] Use -h to change the symlink itself
>
> `chmod -h` (where supported) changes the symlink's own permissions, not the target. Availability varies by OS — check `man chmod` on your system.

> [!info] Octal permission patterns
>
> - `755` — scripts and executables (owner can write, everyone can read/execute)
> - `644` — data files and configs (owner can write, everyone can read)
> - `600` — secrets and key files (only owner can read/write)
> - `700` — private directories (only owner can enter)
> - Each digit = read (4) + write (2) + execute (1)

| Flag | Syntax | Description |
|------|--------|-------------|
| `-R` | `chmod -R 755 dir/` | Recursive: apply to all files in directory |
| `-v` | `chmod -v 644 file` | Verbose: show permission change for each file |
| `-c` | `chmod -c 644 file` | Report only files whose permissions actually changed |
| `--reference` | `chmod --reference=ref file` | Copy permissions from reference file |

### Linux | chown | change file ownership

`chown` changes the owner and group of a file. The `user:group` syntax sets both at once. `-R` applies recursively to all files in a directory tree.

#### Change owner and group of a file

Sets the owner to `user` and the group to `group` in a single operation. Both `user` and `group` must exist on the system.

```bash
chown user:group file.txt
```

#### Fix Airflow container permissions on a bind mount

The UID `50000` is Airflow's default container user. Verify with `docker inspect` if using a custom image. For the full [container-lifecycle](https://alp78.github.io/elysium/09-Docker/container-lifecycle) including bind mounts and volume management, see the Docker section.

```bash
chown -R 50000:0 /opt/airflow/dags/
```

> [!tip] Docker bind mount permission fix
>
> The most common Docker permission error in data engineering is an Airflow or pipeline container unable to write to a host-mounted directory. Fix it with `chown -R <uid>:0 /path/`. The UID 50000 is Airflow's default — verify for custom images.

| Flag | Syntax | Description |
|------|--------|-------------|
| `-R` | `chown -R user:group dir/` | Recursive: apply to all files in directory |
| `-v` | `chown -v user file` | Verbose: show change for each file |
| `-c` | `chown -c user file` | Report only files that actually changed |
| `--reference` | `chown --reference=ref file` | Copy ownership from reference file |
| `-h` | `chown -h user symlink` | Change ownership of the symlink itself, not the target |

### Linux | du | check directory size

`du` (disk usage) reports how much disk space a file or directory occupies. `-s` gives a summary total, `-h` makes it human-readable. For a full disk investigation workflow including `du` vs `df` discrepancies and inode exhaustion, see [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing).

#### Get total size of a directory

`-s` prints only the summary total (not per-file sizes). `-h` formats the result as human-readable K/M/G.

```bash
du -sh /var/opt/mssql/data/
```

#### List subdirectory sizes, sorted largest first

`--max-depth=1` prints sizes for immediate subdirectories only, avoiding per-file recursion. Piped to `sort -rh` to rank by descending human-readable size.

```bash
du -h --max-depth=1 /var/opt/mssql/ | sort -rh
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

`df` (disk free) shows mounted filesystem usage. Always check free space before large copies or data imports — full disks cause silent data corruption or application failure.

#### Show disk usage for all mounted filesystems

`-h` formats sizes in human-readable units (K, M, G). Reports used, available, and percent-used for every mounted filesystem.

```bash
df -h
```

> [!warning] Check free space before writing
>
> SQL Server **stops** when the disk is full. Always verify free space before large copies or data imports. For the full disk-full runbook, see [sql-server-disk-full](https://alp78.github.io/elysium/04-SQL-Server/Administration/disk-management).

> [!success] Monitor inodes as well as bytes
>
> `df -i` shows inode usage. A filesystem can be 0% full by bytes but 100% full by inodes if millions of tiny files exist, which causes "no space left on device" despite apparent free space.

#### Check inode usage

A filesystem can exhaust inodes before exhausting disk space if millions of small files (logs, cache entries) accumulate. `df -i` reveals this condition — a near-100% `IUse%` with plenty of free bytes means you cannot create new files until inodes are freed.

```bash
df -i
```

| Flag | Syntax | Description |
|------|--------|-------------|
| `-h` | `df -h` | Human-readable sizes |
| `-i` | `df -i` | Show inode usage instead of block usage |
| `-T` | `df -T` | Show filesystem type |
| `-t` | `df -t ext4` | Filter by filesystem type |
| `--total` | `df --total` | Print grand total row |

## PowerShell file manipulation tools

PowerShell provides `Copy-Item`, `Move-Item`, `Rename-Item`, `Remove-Item`, and `New-Item` as the core file manipulation cmdlets. For permissions, use `icacls` (the Windows ACL tool). For disk space, use `Get-PSDrive`. For directory size, use `Get-ChildItem` piped to `Measure-Object`.

### PowerShell | Copy-Item | copy files and directories

`Copy-Item` copies files and directories. Unlike `cp -a`, it does NOT preserve timestamps by default — the copy gets the current timestamp.

#### Copy a file

Copies `source.txt` to `dest.txt`. Overwrites without prompt by default. Unlike `cp -a`, timestamps are reset to the current time.

```powershell
Copy-Item source.txt dest.txt
```

#### Copy a directory recursively

`-Recurse` is required for directories. Without it, `Copy-Item` copies only the directory container and none of its contents.

```powershell
Copy-Item -Path source_dir -Destination dest_dir -Recurse
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

`Move-Item` moves files between paths. Like Linux `mv`, same-drive moves are instant renames; cross-drive moves are copy + delete.

#### Move a file

Renames or moves `old.txt` to `new.txt`. Same-drive moves are instant renames; cross-drive moves are copy + delete.

```powershell
Move-Item old.txt new.txt
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path src` | Source path |
| `-Destination` | `-Destination dst` | Target path |
| `-Force` | `-Force` | Overwrite existing destination |
| `-PassThru` | `-PassThru` | Return moved item object |

### PowerShell | Rename-Item | rename files in place

`Rename-Item` renames a file or directory within the same location without moving it.

#### Rename a file

Renames within the same directory. `-NewName` takes a name only, not a full path — use `Move-Item` to relocate a file.

```powershell
Rename-Item old.txt new.txt
```

#### Batch rename with regex

`Get-ChildItem` pipelines into `Rename-Item` for bulk renames. The scriptblock form of `-NewName` receives the current item as `$_` and returns the new name string.

```powershell
Get-ChildItem *.csv | Rename-Item -NewName { $_.Name -replace '\.csv$', '.csv.bak' }
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Path` | `-Path file` | File to rename |
| `-NewName` | `-NewName name` | New name (not a full path) |
| `-Force` | `-Force` | Overwrite if target exists |
| `-PassThru` | `-PassThru` | Return renamed item object |

### PowerShell | Remove-Item | delete files and directories

`Remove-Item -Recurse -Force` is the PowerShell equivalent of `rm -rf` — no confirmation, no recovery.

#### List contents before deleting

Inspect the directory before removal. Reviewing this output is the last manual check before an irreversible delete operation.

```powershell
Get-ChildItem directory | Format-Table Name
```

#### Delete a directory recursively

`-Recurse` deletes the directory and all its contents. `-Force` suppresses confirmation prompts and removes read-only files.

```powershell
Remove-Item directory -Recurse -Force
```

> [!warning] Verify before Remove-Item
>
> Always verify contents before removing. `Remove-Item -Recurse -Force` has no confirmation prompt and no recycle bin.

> [!success] Use -WhatIf to preview before deleting
>
> `Remove-Item directory -Recurse -Force -WhatIf` lists every file and directory that would be deleted without removing anything. Run this first on any path you are not 100% certain about.

> [!danger] Remove-Item -Recurse intermittent bug
>
> On Windows, `Remove-Item -Recurse` occasionally fails with "directory is not empty"
> when files are still being released by antivirus or indexing processes.

> [!success] Reliable recursive deletion workaround
>
> ```powershell
> [System.IO.Directory]::Delete($path, $true)
> ```
> This .NET call is synchronous and reliable — it waits for file handles to release before completing.

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-Recurse` | `-Recurse` | Delete directory and all contents |
| `-Force` | `-Force` | Delete read-only files, no prompt |
| `-ErrorAction` | `-ErrorAction SilentlyContinue` | Suppress errors (use cautiously) |
| `-WhatIf` | `-WhatIf` | Simulate without deleting |
| `-Filter` | `-Filter *.tmp` | Delete only matching files |

### PowerShell | New-Item | create directories with parent creation

`-Force` creates parent directories as needed (like `mkdir -p`) and returns the created item object.

#### Create a directory

`-Force` creates all missing parent directories and suppresses the error if the directory already exists — equivalent to `mkdir -p` on Linux.

```powershell
New-Item -ItemType Directory -Path "C:\data\pipeline\bronze" -Force
```

| Parameter | Syntax | Description |
|-----------|--------|-------------|
| `-ItemType` | `-ItemType Directory` | Type to create: Directory or File |
| `-Path` | `-Path "C:\path"` | Target path |
| `-Force` | `-Force` | Create parents as needed; no error if exists |
| `-Value` | `-Value "content"` | Initial content when creating a file |

### PowerShell | icacls | manage file and directory permissions

`icacls` is the Windows command-line tool for viewing and editing NTFS access control lists. It is the functional equivalent of `chmod` on Windows.

#### View permissions on a file or directory

Prints the DACL (Discretionary Access Control List) for the path, showing each principal and their assigned access rights.

```powershell
icacls "C:\data\pipeline"
```

#### Grant a user full control

`(OI)(CI)F` grants Full Control with object inheritance (applies to files) and container inheritance (applies to subdirectories), so the permission cascades to all children.

```powershell
icacls "C:\data\pipeline" /grant "DOMAIN\user:(OI)(CI)F"
```

#### Remove all permissions for a user

Removes all ACEs (access control entries) for the specified user. The user will have no access unless they inherit permissions through a group membership.

```powershell
icacls "C:\data\pipeline" /remove "DOMAIN\user"
```

#### Reset permissions to inherited defaults

Removes all explicit ACEs and restores inheritance from the parent directory. `/T` applies the reset recursively to all subdirectories and files.

```powershell
icacls "C:\data\pipeline" /reset /T
```

#### Take ownership of a file or directory

`takeown` reassigns ownership of a file to the current user or a specified account. Required before `icacls` can grant access when you are locked out of your own files (e.g., after restoring from a different machine).

```powershell
takeown /F "C:\data\pipeline" /R /D Y
```

> [!info] icacls permission syntax
>
> - `F` — Full control
> - `M` — Modify
> - `RX` — Read and execute
> - `R` — Read only
> - `W` — Write only
> - `(OI)` — Object inherit: applies to files in the directory
> - `(CI)` — Container inherit: applies to subdirectories
> - `(NP)` — No propagate: does not cascade to children

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

`Get-PSDrive` lists all PowerShell drives including filesystem drives with used/free space. It is the functional equivalent of `df -h` on Linux.

#### Show disk space for all drives

`-PSProvider FileSystem` filters to filesystem drives only, excluding registry and certificate drives. `Used` and `Free` values are in bytes.

```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free
```

#### Show disk space in human-readable GB

Computed properties with `@{N=...; E=...}` convert raw byte values to GB rounded to two decimal places — equivalent to `df -h` output.

```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name,
  @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}},
  @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}
```

### PowerShell | Get-ChildItem + Measure-Object | check directory size

`Get-ChildItem -Recurse` combined with `Measure-Object -Sum Length` calculates total directory size. It is the functional equivalent of `du -sh` on Linux.

#### Get total size of a directory in MB

`Get-ChildItem -Recurse` enumerates every file. `Measure-Object -Sum Length` totals the byte sizes. The computed property converts the result from bytes to MB.

```powershell
Get-ChildItem -Recurse "C:\data\pipeline" |
  Measure-Object -Property Length -Sum |
  Select-Object @{N='TotalMB';E={[math]::Round($_.Sum/1MB,2)}}
```

## Related
- [navigation-and-listing](https://alp78.github.io/elysium/01-Shell/File-Operations/navigation-and-listing) — check what's there before moving it
- [brace-expansion-and-globbing](https://alp78.github.io/elysium/01-Shell/Scripting/brace-expansion-and-globbing) — create directory trees with brace expansion
- [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) — compress before transferring large directories
- [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer) — rsync for remote file transfers with resume support
- [defensive-scripting](https://alp78.github.io/elysium/01-Shell/Scripting/defensive-scripting) — `set -euo pipefail` prevents silent failures in delete scripts
