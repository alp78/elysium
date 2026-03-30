---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash, linux, powershell]
aliases: [cp, mv, rm, chmod, chown, mkdir, file permissions, safe delete, file ownership]
keywords: [cp, mv, rm, chmod, chown, mkdir, rsync, file copy, file move, delete, permissions, ownership, octal permissions, safe delete, trash, archive mode, disk usage, docker permissions, airflow uid]
description: "Safe file copying, moving, and deletion patterns for production environments. Covers rsync archive mode, chmod octal notation, chown for Docker/Airflow containers, and the safe delete pattern using a trash directory."
related: ["[[navigation-and-listing]]", "[[finding-files]]", "[[compression]]", "[[brace-expansion-and-globbing]]", "[[data-transfer]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# File Manipulation — Moving Data Safely

Copying, moving, and deleting files seems trivial until you accidentally overwrite a production dataset, delete a directory that was still being written to, or run out of disk space mid-copy because you did not check first. Production file operations require explicit safety habits.

## Linux — cp, mv, rm, rsync

#### cp — copy files and directories

> [!info] cp basic usage
>
> `cp` copies files. Without flags it copies a single file. Add `-r` for
> directories (required — `cp` refuses to copy a directory without it).

```bash
cp source.txt dest.txt
cp -r source_dir/ dest_dir/
```

#### cp -a — archive copy preserving all metadata

> [!info] Archive mode preserves metadata
>
> `-a` (archive) combines `-r` with full metadata preservation: timestamps,
> permissions, ownership, and symlinks. Use this when copying pipeline data directories —
> downstream processes often rely on modification times for change detection.

```bash
cp -a source_dir/ dest_dir/
```

> [!warning] cp -r does not preserve timestamps
>
> Plain `cp -r` copies files but resets `mtime` to the current time. If a downstream
> process uses `find -newer` or `stat` to detect changes, every file appears "new" after
> a `cp -r` copy. Always use `cp -a` for data directories.

#### rsync — copy with progress, resume, and selective sync

> [!info] rsync resumable file copies
>
> `rsync` is the standard tool for large or resumable file copies. If interrupted,
> re-run the same command — it picks up where it left off by comparing checksums. The `-a`
> flag enables archive mode (recursive + preserve all attributes).

```bash
rsync -ah --progress source.tar.gz dest/
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
> Always dry-run first: `rsync -ah --delete --dry-run src/ dest/`

> [!tip] Preview with --dry-run
>
> `rsync -avn --delete src/ dest/` shows exactly what would be transferred and deleted
> without touching any files. Make this a habit before any `rsync --delete` operation.

#### mv — move and rename files

> [!info] mv rename behavior
>
> `mv` renames files on the same filesystem using a single `rename()` syscall —
> instantaneous regardless of file size. When source and destination are on different
> filesystems, `mv` falls back to copy + delete (equivalent to `cp -a` then `rm`).

```bash
mv old.txt new.txt
mv file.txt /other/dir/
```

> [!warning] mv across filesystems is not atomic
>
> Same-filesystem `mv` is a single syscall — it either succeeds or fails, nothing in
> between. Cross-filesystem `mv` is copy-then-delete. If the copy fails (disk full,
> permission error), you end up with a partial file at the destination and the original
> still at the source. For critical files, use `rsync` + verify + `rm` instead.

#### rename — batch rename files with Perl regex

> [!info] Perl rename utility
>
> The Perl-based `rename` utility applies a regex substitution to every matching
> filename. Install with `apt install rename` (Debian/Ubuntu). Not installed by default.

```bash
rename 's/\.csv$/.csv.bak/' *.csv
```

> [!warning] Two different rename utilities
>
> Debian/Ubuntu ship the **Perl rename** (`rename 's/old/new/' files`). RHEL/CentOS ship
> the **util-linux rename** (`rename old new files`) — completely different syntax. Check
> which you have with `rename --version`. If you need portability, use a `for` loop with
> `mv` instead.

### rm — safe delete pattern with trash directory

```bash
# Delete
rm file.txt               # delete a single file
rm -r directory/           # delete a directory recursively
rm -rf directory/          # force delete recursively (no confirmation)

# Safer alternative — move to staging area instead of deleting
mv directory/ /tmp/delete_me_$(date +%Y%m%d)/
```

> [!tip] Prerequisites
>
> Before writing delete logic in scripts, enable [[defensive-scripting|set -euo pipefail]] -- `set -u` prevents the catastrophic `rm -rf $UNDEFINED` expansion, and `trap EXIT` ensures cleanup runs even on error.

> [!warning] Never rm -rf directly in scripts
>
> Use this pattern instead:
> ```bash
> TRASH_DIR="/tmp/trash_$(date +%Y%m%d_%H%M%S)"
> mkdir -p "$TRASH_DIR"
> mv "$TARGET_DIR" "$TRASH_DIR/"
> echo "Moved to $TRASH_DIR — delete manually after verification"
> ```
> This gives you a recovery window. In production, the cost of a 30-second delay to verify is infinitely less than the cost of accidentally deleting a database backup directory.

#### mkdir -p — create directory trees with brace expansion

> [!info] mkdir -p is idempotent
>
> `-p` creates parent directories as needed and suppresses "already exists"
> errors — making it idempotent (safe to run repeatedly). Combined with
> [[brace-expansion-and-globbing|brace expansion]], a single command creates an entire
> [medallion-architecture](/14-Data-Architecture/Pipeline-Patterns/medallion-architecture) directory tree.

```bash
mkdir -p /data/pipeline/{bronze,silver,gold}/staging
```

#### chmod — set file permissions with octal or symbolic notation

> [!info] chmod permission notation
>
> `chmod` sets read/write/execute permissions. Octal notation (e.g., `755`) sets
> all three permission groups at once. Symbolic notation (e.g., `u+x`) modifies specific
> bits without affecting the rest.

```bash
chmod 755 script.sh
chmod +x script.sh
chmod u+w,g-w file
```

> [!warning] chmod follows symlinks
>
> `chmod 600 my_link` changes permissions on the **target file**, not the symlink itself.
> On most Linux filesystems, symlink permissions are ignored entirely — the target's
> permissions govern access. This surprises people who expect the symlink to act as a
> permission barrier.

> [!info] Octal permission patterns
>
> - `755` — scripts and executables (owner can write, everyone can read/execute)
> - `644` — data files and configs (owner can write, everyone can read)
> - `600` — secrets and key files (only owner can read/write)
> - `700` — private directories (only owner can enter)
> - Each digit = read (4) + write (2) + execute (1)

#### chown — change file ownership for Docker and multi-user environments

> [!info] chown ownership changes
>
> `chown` changes the owner and group of a file. The `user:group` syntax sets
> both at once. `-R` applies recursively to all files in a directory tree.

```bash
chown user:group file.txt
chown -R 50000:0 /home/airflow/dags/
```

> [!tip] Docker bind mount permission fix
>
> The most common Docker permission error in data engineering is an Airflow or pipeline container unable to write to a host-mounted directory. Fix it with:
> ```bash
> chown -R 50000:0 /opt/airflow/dags/
> ```
> The UID 50000 is Airflow's default container user. Verify with `docker inspect` if using a custom image. For the full [[container-lifecycle]] including bind mounts and volume management, see the Docker section.

#### du -sh — check directory size before copying or deleting

> [!tip] Check size before copy or delete
>
> Always check the size of what you're about to copy or delete. `-s` gives a
> summary total, `-h` makes it human-readable. For a full disk investigation workflow
> including `du` vs `df` discrepancies and inode exhaustion, see
> [[navigation-and-listing]].

```bash
du -sh /var/opt/mssql/data/
du -h --max-depth=1 /var/opt/mssql/ | sort -rh
```

#### df -h — check free space before writing

> [!warning] Check free space before writing
>
> SQL Server **stops** when the disk is full. Always verify free space before
> large copies or data imports. For the full disk-full runbook, see
> sql server disk full.

```bash
df -h
```

## PowerShell — Copy-Item, Move-Item, Remove-Item, New-Item

#### Copy-Item — copy files and directories

> [!info] Copy-Item basics
>
> `Copy-Item` copies files. Add `-Recurse` for directories. Unlike `cp -a`, it
> does NOT preserve timestamps by default — the copy gets the current timestamp.

```powershell
Copy-Item source.txt dest.txt
Copy-Item -Path source_dir -Destination dest_dir -Recurse
```

#### Move-Item, Rename-Item — move and rename files

> [!info] Move-Item and Rename-Item
>
> `Move-Item` moves files between paths. `Rename-Item` renames within the same
> directory. Like Linux `mv`, same-drive moves are instant renames; cross-drive moves
> are copy + delete.

```powershell
Move-Item old.txt new.txt
Rename-Item old.txt new.txt
```

#### Remove-Item — delete files and directories

> [!warning] Verify before Remove-Item
>
> Always verify contents before removing. `Remove-Item -Recurse -Force`
> is the PowerShell equivalent of `rm -rf` — no confirmation, no recovery.

```powershell
Get-ChildItem directory | Format-Table Name
Remove-Item directory -Recurse -Force
```

> [!danger] Remove-Item -Recurse intermittent bug
>
> On Windows, `Remove-Item -Recurse` occasionally fails with "directory is not empty"
> when files are still being released by antivirus or indexing processes. The workaround
> is `Remove-Item -Recurse -Force -ErrorAction SilentlyContinue` in a retry loop, or
> use `[System.IO.Directory]::Delete($path, $true)` for reliable recursive deletion.

#### New-Item — create directories with parent creation

> [!info] New-Item with -Force
>
> `-Force` creates parent directories as needed (like `mkdir -p`). Returns the
> created item object.

```powershell
New-Item -ItemType Directory -Path "C:\data\pipeline\bronze" -Force
```

## Related
- [[navigation-and-listing]] — check what's there before moving it
- [[brace-expansion-and-globbing]] — create directory trees with brace expansion
- [[compression]] — compress before transferring large directories
- [[data-transfer]] — rsync for remote file transfers with resume support
- [[defensive-scripting]] — `set -euo pipefail` prevents silent failures in delete scripts
