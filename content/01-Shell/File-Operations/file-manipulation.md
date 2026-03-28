---
type: concept
category: foundations
technology: [bash, powershell]
tags: [shell, bash]
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

**Copying files:**

```bash
# Copy a file
cp source.txt dest.txt

# Copy a directory recursively
cp -r source_dir/ dest_dir/
# -r = recursive (required for directories)

# Copy preserving metadata (timestamps, permissions, ownership)
cp -a source_dir/ dest_dir/
# -a = archive mode (-r + preserve all attributes)
# Use this when copying pipeline data directories — preserves modification times
# that downstream processes may depend on for change detection

# Copy with progress bar (for large files)
rsync -ah --progress source.tar.gz dest/
# rsync = the Swiss Army knife of file copying
# -a = archive mode (recursive, preserve everything)
# -h = human-readable sizes
# --progress = show transfer progress per file
# rsync also supports resume: if interrupted, re-run the same command and it continues
```

**Moving and renaming:**

```bash
# Move/rename
mv old.txt new.txt
mv file.txt /other/dir/
# mv is atomic on the same filesystem (instant rename, no copy)
# mv across filesystems = copy + delete (slow for large files)

# Rename multiple files (batch rename)
rename 's/\.csv$/.csv.bak/' *.csv
# rename = Perl-based rename utility (install: apt install rename)
# Renames all .csv files to .csv.bak in one command
```

## Safe Delete Pattern

```bash
# Delete — THE MOST DANGEROUS COMMANDS IN YOUR TOOLKIT
rm file.txt               # delete a single file
rm -r directory/           # delete a directory recursively
rm -rf directory/          # force delete recursively (no confirmation)

# STOP. READ THIS BEFORE RUNNING rm -rf:
# 1. Double-check the path. Is it a variable? Is it empty? (see set -u above)
# 2. ls the target first: ls -la /path/to/delete/  — verify it's what you expect
# 3. Consider mv to a staging area instead of rm:
mv directory/ /tmp/delete_me_$(date +%Y%m%d)/
# Now you have a recovery window. Delete from /tmp later.
```

> [!info] Prerequisites
> Before writing delete logic in scripts, enable [[defensive-scripting|set -euo pipefail]] -- `set -u` prevents the catastrophic `rm -rf $UNDEFINED` expansion, and `trap EXIT` ensures cleanup runs even on error.

> [!warning] Never `rm -rf` Directly in Scripts
> Use this pattern instead:
> ```bash
> TRASH_DIR="/tmp/trash_$(date +%Y%m%d_%H%M%S)"
> mkdir -p "$TRASH_DIR"
> mv "$TARGET_DIR" "$TRASH_DIR/"
> echo "Moved to $TRASH_DIR — delete manually after verification"
> ```
> This gives you a recovery window. In production, the cost of a 30-second delay to verify is infinitely less than the cost of accidentally deleting a database backup directory.

## Directory Creation and Permissions

```bash
# Create directory with parents
mkdir -p /data/pipeline/{bronze,silver,gold}/staging
# -p = create parent directories as needed, no error if already exists
# Combined with brace expansion: creates the full [[medallion-architecture]] directory tree

# File permissions — the numeric system
chmod 755 script.sh
# Octal notation: Owner/Group/Others
# 7 = rwx (read 4 + write 2 + execute 1)
# 5 = r-x (read 4 + execute 1)
# Common patterns:
#   755 = scripts and executables (owner can write, everyone can read/execute)
#   644 = data files and configs (owner can write, everyone can read)
#   600 = secrets and key files (only owner can read/write)
#   700 = private directories (only owner can enter)

chmod +x script.sh    # add execute permission for all
chmod u+w,g-w file    # add write for user, remove write for group

# File ownership — critical for Docker and multi-user environments
chown user:group file.txt
chown -R 50000:0 /home/airflow/dags/
# -R = recursive
# 50000:0 = Airflow container runs as UID 50000, GID 0
# If the host directory is owned by root, the Airflow container can't write to it
# This is the #1 cause of "permission denied" in Docker bind mounts
```

> [!tip] Docker Bind Mount Permission Fix
> The most common Docker permission error in data engineering is an Airflow or pipeline container unable to write to a host-mounted directory. Fix it with:
> ```bash
> chown -R 50000:0 /opt/airflow/dags/
> ```
> The UID 50000 is Airflow's default container user. Verify with `docker inspect` if using a custom image. For the full [[container-lifecycle]] including bind mounts and volume management, see the Docker section.

## Disk Usage Analysis

```bash
# Disk usage analysis
du -sh /var/opt/mssql/data/
# -s = summary (total only, not per-file)
# -h = human-readable

du -h --max-depth=1 /var/opt/mssql/ | sort -rh
# --max-depth=1 = immediate children only
# sort -rh = reverse, human-numeric sort (largest first)

df -h
# Disk free space for all mounted filesystems
# CHECK THIS REGULARLY on database servers — SQL Server crashes when disk is full
# For the full disk-full investigation workflow, see the [[sql-server-disk-full]] runbook
```

## PowerShell

```powershell
# Copy
Copy-Item source.txt dest.txt
Copy-Item -Path source_dir -Destination dest_dir -Recurse

# Move/rename
Move-Item old.txt new.txt
Rename-Item old.txt new.txt

# Delete (with the same warning as Linux)
Remove-Item file.txt
Remove-Item directory -Recurse -Force
# ALWAYS verify: Get-ChildItem directory | Format-Table Name BEFORE removing

# Create directory
New-Item -ItemType Directory -Path "C:\data\pipeline\bronze" -Force
# -Force = create parent directories as needed

# Disk usage for a directory
"{0:N2} GB" -f ((Get-ChildItem -Path "C:\data" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1GB)

# Disk free space
Get-PSDrive -PSProvider FileSystem | Format-Table Name,
    @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}},
    @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}}
```

## Related
- [[navigation-and-listing]] — check what's there before moving it
- [[brace-expansion-and-globbing]] — create directory trees with brace expansion
- [[compression]] — compress before transferring large directories
- [[data-transfer]] — rsync for remote file transfers with resume support
- [[defensive-scripting]] — `set -euo pipefail` prevents silent failures in delete scripts
