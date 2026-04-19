---
title: "05 - Data Transfer"
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [shell]
aliases: [rsync, scp, gcloud scp, gsutil, gcloud storage, bcp, sqlcmd export, file transfer, data movement, robocopy]
keywords: [rsync, scp, gcloud compute scp, gsutil, gcloud storage, bcp, sqlcmd, file transfer, data movement, trailing slash, resume transfer, delta transfer, parallel transfer, bandwidth limit, checksum, GCS upload, GCS sync, SQL Server export, CSV export, bulk copy, parallel bcp, bwlimit, rsync exclude, dry run, robocopy, Robocopy MIR, Robocopy exit codes, Invoke-Sqlcmd, Export-Csv, IPG, inter-packet gap]
description: "Complete guide to data transfer tools for data engineering: rsync and Robocopy for local/remote transfers, scp for quick copies, gcloud compute scp for GCE VMs, gsutil and gcloud storage for GCS, bcp for SQL Server bulk export/import, and sqlcmd/Invoke-Sqlcmd for query-based export."
created: 2026-03-22
updated: 2026-04-15
status: complete
---

# Data Transfer

> [!quote]+
>
> "Never underestimate the bandwidth of a station wagon full of tapes hurtling down the highway."
>
> — **Andrew S. Tanenbaum**, *Computer Networks* (1981)

> [!abstract]- Summary
>
> Reference for choosing local sync, SSH copy, GCS copy, and SQL export tools in shell-heavy data workflows.
>
> - Use `cp` or `Copy-Item` for one-shot local files.
> - Use `rsync` or `Robocopy` when directory state must converge, resume, or be previewed before deletion.
> - Use `scp` only for small SSH copies; use `gcloud compute scp` or `gcloud storage` when Google Cloud resources are involved.
> - Use `bcp` for bulk SQL Server export and import, and use `sqlcmd` or `Invoke-Sqlcmd` when the output is query-shaped rather than table-shaped.
> - Treat `--delete`, `/MIR`, and `gsutil rsync -d` as destructive. The live captures below show local success paths first and explicit blocker output where cloud or SQL targets were unavailable in this worker environment.

> [!note]- Glossary
>
> **`rsync`**
>
> - Unix-family file synchronization tool that copies data locally or over a remote shell while comparing source and destination state.
> - Used when directory contents must converge over time, metadata must be preserved, or interrupted copies must resume cleanly.
> - A trailing slash on the source changes the copy scope, and that distinction becomes dangerous when `--delete` is involved.
>
> ---
>
> **Delta transfer**
>
> - Transfer strategy in which a synchronization tool sends only changed portions of a file instead of retransmitting the whole file.
> - Used to reduce bandwidth and elapsed time when both sides already contain related file versions.
> - The benefit depends on the protocol, the tool, and whether the destination already has a valid baseline file.
>
> ---
>
> **`scp`**
>
> - SSH-based file copy client for moving files between a local machine and a remote host.
> - Used for quick one-off remote copies when you do not need dry runs, delta transfer, or resumability.
> - Uppercase `-P` sets the port and lowercase `-p` preserves timestamps and modes, which is the opposite of `ssh`.
>
> ---
>
> **`gcloud compute scp`**
>
> - Google Cloud CLI wrapper around SSH copy for Compute Engine instances.
> - Used when the destination is a GCE VM and you want the CLI to handle project, zone, SSH key, and IAP-related details.
> - Copy into a user-writable directory such as `/tmp` first when the final destination requires elevated privileges on the VM.
>
> ---
>
> **`gsutil`**
>
> - Legacy Python-based Google Cloud Storage CLI for object copy, listing, and synchronization.
> - Used heavily in existing scripts that already rely on `gsutil cp` or `gsutil rsync`.
> - `gsutil rsync -d` deletes destination-only objects, so preview destructive syncs with `-n` first.
>
> ---
>
> **`gcloud storage`**
>
> - Modern Cloud Storage command group inside the main `gcloud` CLI.
> - Used for new GCS automation where you want one actively developed CLI surface instead of a separate legacy tool.
> - It is the better default for new scripts, but it still needs a real bucket path and valid Google Cloud access before any transfer can begin.
>
> ---
>
> **`bcp`**
>
> - SQL Server bulk-copy client for moving table or query data between SQL Server and flat files.
> - Used when throughput matters more than convenience, especially for large exports, staging loads, and repeatable bulk data movement.
> - A successful process exit is not enough to trust the result; row counts and any `-e` error file still need explicit validation.
>
> ---
>
> **`sqlcmd` / `Invoke-Sqlcmd`**
>
> - SQL Server scripting clients for running T-SQL non-interactively from shell or PowerShell.
> - Used when you need query-driven exports, administrative automation, or object-based PowerShell output before handing the result to `Export-Csv`.
> - `sqlcmd` emits text-oriented output that may need cleanup, whereas `Invoke-Sqlcmd` returns objects but still depends on the `SqlServer` module and a reachable server.
>
> ---
>
> **`Robocopy`**
>
> - Windows-native file copy utility for large directory trees, mirroring, retry control, restartable behavior, and logging.
> - Used when PowerShell workflows need durable directory replication rather than a simple file copy.
> - Exit codes below 8 are not failures by default, and `/MIR` removes destination-only content unless you preview with `/L` first.
>
> ---
>
> **Bandwidth limiting**
>
> - Deliberate control over transfer throughput so a job does not saturate a shared link.
> - Used to protect production traffic or office-hour network capacity during long-running copies.
> - `rsync`, `scp`, and `Robocopy` express this control differently, so do not assume their flags use the same units or behavior.

Copying one file on one machine is trivial. Moving a directory tree between environments, mirroring a landing zone without deleting the wrong target, or exporting a SQL dataset before uploading it to object storage is where tool choice and flag discipline matter.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart TD
    A([What are you transferring?]) --> B{Single file,<br>local machine}
    A --> C{Large or repeated<br>directory, local}
    A --> D{To / from<br>GCE VM}
    A --> E{To / from<br>Cloud Storage}
    A --> F{SQL Server<br>table or query}
    A --> G{Quick remote<br>SSH copy}

    B --> B1[cp / Copy-Item]
    C --> C1[rsync / Robocopy]
    D --> D1[gcloud compute scp]
    E --> E1[gcloud storage]
    F --> F1[bcp / Invoke-Sqlcmd]
    G --> G1[scp]

    style A fill:#1a1b26,stroke:#7aa2f7,color:#c0caf5
    style B fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style C fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style D fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style E fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style F fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style G fill:#1a1b26,stroke:#565f89,color:#c0caf5
    style B1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style C1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style D1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style E1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style F1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style G1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
```

## Linux file transfer tools

### Linux | choosing `cp` or `rsync` | local copies with explicit intent

Use `cp` when the job is a one-shot file copy and there is no need to reconcile two directory trees. Move to `rsync` as soon as you need archive semantics, previewable deletion, filtering, or repeatability.

#### Copy a single file when no reconciliation is needed

`cp` is the right tool for a direct file copy on one machine. The verbose flag is enough to prove what moved without adding a separate verification command.

```bash
mkdir -p /tmp/vault-transfer-demo-linux/cp-dest
printf 'single\n' | tee /tmp/vault-transfer-demo-linux/single.txt >/dev/null
cp -v /tmp/vault-transfer-demo-linux/single.txt /tmp/vault-transfer-demo-linux/cp-dest/
```
```text
'/tmp/vault-transfer-demo-linux/single.txt' -> '/tmp/vault-transfer-demo-linux/cp-dest/single.txt'
```

#### Synchronize a directory when state must converge

`rsync -av` is the safer default once a directory tree has to be copied repeatedly. The archive flag preserves timestamps and permissions while the trailing slash keeps the copy scoped to the directory contents rather than nesting the source directory under the destination.

```bash
rm -rf /tmp/vault-transfer-demo-linux
mkdir -p /tmp/vault-transfer-demo-linux/src/project /tmp/vault-transfer-demo-linux/dest
printf 'alpha\n' > /tmp/vault-transfer-demo-linux/src/project/report.csv
printf 'notes\n' > /tmp/vault-transfer-demo-linux/src/project/notes.txt
printf 'one\n' > /tmp/vault-transfer-demo-linux/src/extra.log
rsync -av /tmp/vault-transfer-demo-linux/src/ /tmp/vault-transfer-demo-linux/dest/
```
```text
sending incremental file list
extra.log
project/
project/notes.txt
project/report.csv

sent 318 bytes  received 85 bytes  806.00 bytes/sec
total size is 16  speedup is 0.04
```

#### Preview deletions before a mirror run

`rsync --delete` is valuable only when you are certain the destination should exactly match the source. Dry-run it first so the output shows what would be removed before anything destructive happens.

```bash
mkdir -p /tmp/vault-transfer-demo-linux/dest
printf 'stale\n' | tee /tmp/vault-transfer-demo-linux/dest/obsolete.txt >/dev/null
rsync -avzn --delete /tmp/vault-transfer-demo-linux/src/ /tmp/vault-transfer-demo-linux/dest/
```
```text
sending incremental file list
deleting obsolete.txt
./

sent 161 bytes  received 32 bytes  386.00 bytes/sec
total size is 16  speedup is 0.08 (DRY RUN)
```

### Linux | `rsync` | selective and path-safe synchronization

Once the basic sync path works, `rsync` becomes the tool for precise transfer scopes. The next two captures show the two failure-prevention habits that matter most: filter deliberately and dry-run the source path when you are uncertain about trailing slashes.

#### Limit the transfer set with include and exclude rules

When only one file type belongs downstream, lead with `--include` rules and end with `--exclude='*'`. That prevents mixed staging directories from leaking support files into the transfer.

```bash
mkdir -p /tmp/vault-transfer-demo-linux/filter-src/sub /tmp/vault-transfer-demo-linux/filter-dest
printf 'id,value\n1,10\n' > /tmp/vault-transfer-demo-linux/filter-src/sub/part-000.parquet
printf 'skip\n' > /tmp/vault-transfer-demo-linux/filter-src/sub/readme.txt
rsync -av --include='*.parquet' --include='*/' --exclude='*' /tmp/vault-transfer-demo-linux/filter-src/ /tmp/vault-transfer-demo-linux/filter-dest/
```
```text
sending incremental file list
sub/
sub/part-000.parquet

sent 177 bytes  received 39 bytes  432.00 bytes/sec
total size is 14  speedup is 0.06
```

#### Dry-run a source path without the trailing slash

If you omit the trailing slash on the source, `rsync` plans to create a nested `src/` directory at the destination. A dry run makes that mistake visible before you mutate the target tree.

```bash
rm -rf /tmp/vault-transfer-demo-linux/nested
mkdir -p /tmp/vault-transfer-demo-linux/nested
rsync -avn /tmp/vault-transfer-demo-linux/src /tmp/vault-transfer-demo-linux/nested/
```
```text
sending incremental file list
src/
src/extra.log
src/project/
src/project/notes.txt
src/project/report.csv

sent 188 bytes  received 33 bytes  442.00 bytes/sec
total size is 16  speedup is 0.07 (DRY RUN)
```

Use these flags when the baseline examples need tighter control.

| Flag | Syntax | Purpose |
|---|---|---|
| `-a` | `rsync -a src/ dst/` | Preserve recursion, symlinks, permissions, and timestamps. |
| `-n` | `rsync -n src/ dst/` | Show the plan without copying or deleting anything. |
| `-P` | `rsync -P src/ dst/` | Keep partial files and show transfer progress. |
| `--delete` | `rsync --delete src/ dst/` | Remove destination-only files during reconciliation. |
| `--exclude` | `rsync --exclude='*.log' src/ dst/` | Drop matching paths from the transfer set. |
| `--include` | `rsync --include='*.parquet' src/ dst/` | Permit specific paths before the final catch-all exclude. |
| `--bwlimit` | `rsync --bwlimit=50000 src/ dst/` | Cap throughput in KB/s on shared links. |
| `-c` | `rsync -c src/ dst/` | Compare checksums instead of relying only on size and mtime. |

### Linux | `scp` | quick remote copy over SSH

`scp` is best kept narrow: one file, one host, one immediate copy. If the target is unreachable or the job must resume, stop and switch to a better transport instead of forcing `scp` into a workflow it does not fit.

#### Inspect the local OpenSSH client

The OpenSSH build in WSL prints usage text when invoked without arguments. That is still enough to confirm the client exists and to inspect the important switches before you connect to a real host.

```bash
scp 2>&1 | sed -n '1,4p'
```
```text
usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]
           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]
           [-P port] [-S program] [-X sftp_option] source ... target
```

#### Expect an immediate failure when no SSH service is reachable

This capture targets `127.0.0.1` deliberately so the failure happens locally and predictably. The error proves the transport failed before any copy semantics mattered.

```bash
printf 'demo\n' | tee /tmp/vault-transfer-demo-linux/scp-demo.txt >/dev/null
scp -v -o ConnectTimeout=3 /tmp/vault-transfer-demo-linux/scp-demo.txt demo@127.0.0.1:/tmp/scp-demo.txt 2>&1 | sed -n '1,12p'
```
```text
Executing: program /usr/bin/ssh host 127.0.0.1, user demo, command sftp
OpenSSH_9.6p1 Ubuntu-3ubuntu13.15, OpenSSL 3.0.13 30 Jan 2024
debug1: Reading configuration data /etc/ssh/ssh_config
debug1: /etc/ssh/ssh_config line 19: include /etc/ssh/ssh_config.d/*.conf matched no files
debug1: /etc/ssh/ssh_config line 21: Applying options for *
debug1: Connecting to 127.0.0.1 [127.0.0.1] port 22.
debug1: connect to address 127.0.0.1 port 22: Connection refused
ssh: connect to host 127.0.0.1 port 22: Connection refused
scp: Connection closed
```

Keep this lookup table nearby when you need the exact `scp` flag semantics.

| Flag | Syntax | Purpose |
|---|---|---|
| `-P` | `scp -P 2222 src user@host:/dst` | Set the remote SSH port. |
| `-p` | `scp -p src user@host:/dst` | Preserve modification times and modes. |
| `-i` | `scp -i ~/.ssh/key src user@host:/dst` | Use a specific identity file. |
| `-r` | `scp -r dir user@host:/dst` | Copy a directory recursively. |
| `-l` | `scp -l 50000 src user@host:/dst` | Throttle bandwidth in Kbit/s. |
| `-C` | `scp -C src user@host:/dst` | Enable SSH-level compression. |
| `-o` | `scp -o ConnectTimeout=3 src user@host:/dst` | Pass raw SSH options through to the client. |

## PowerShell file transfer tools

### PowerShell | `Robocopy` | directory replication

`Robocopy` is the Windows tool for durable directory work. The important differences from Unix tooling are its success-oriented exit codes and its ability to preview or restart long directory jobs without switching to a different command family.

#### Copy a tree and preserve empty subdirectories

`/E` is the baseline flag when the destination should reproduce the source tree, including empty directories. The captured exit code is `1`, which is still a successful copy in Robocopy terms.

> [!info] Robocopy status is not Unix-style success or failure
>
> Robocopy return codes from `0` through `7` are non-failure states that describe what happened during reconciliation. Treat `$LASTEXITCODE -ge 8` as the failure boundary; a script that treats any non-zero value as an error will misclassify normal copy results.

```powershell
$base = Join-Path $env:TEMP 'vault-transfer-demo-ps'
$src = Join-Path $base 'src-clean'
$dst = Join-Path $base 'dst-clean'
Remove-Item -LiteralPath $src,$dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $src 'sub') -Force | Out-Null
New-Item -ItemType Directory -Path $dst -Force | Out-Null
'one' | Set-Content -Path (Join-Path $src 'sub\file1.txt')
'two' | Set-Content -Path (Join-Path $src 'root.txt')
'ROBOCOPY_RECURSIVE_CLEAN'
Robocopy $src $dst /E /R:1 /W:1
"LASTEXITCODE=$LASTEXITCODE"
```
```text
ROBOCOPY_RECURSIVE_CLEAN

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

  Started : Tuesday, April 14, 2026 11:20:01
   Source : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\src-clean\
     Dest : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\dst-clean\

  Options : *.* /S /E /DCOPY:DA /COPY:DAT /R:1 /W:1

	    New File  		       5	root.txt
	  New Dir          1	C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\src-clean\sub\
	    New File  		       5	file1.txt

               Total    Copied   Skipped  Mismatch    FAILED    Extras
   Files :         2         2         0         0         0         0
LASTEXITCODE=1
```

#### Preview `/MIR` before allowing deletions

`/MIR` is the Robocopy equivalent of `rsync --delete`. Pair it with `/L` first so the job reports what it would purge without touching the destination.

```powershell
$base = Join-Path $env:TEMP 'vault-transfer-demo-ps'
$src = Join-Path $base 'src'
$dst = Join-Path $base 'dst'
Remove-Item -LiteralPath $src,$dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $src 'sub') -Force | Out-Null
New-Item -ItemType Directory -Path $dst -Force | Out-Null
'one' | Set-Content -Path (Join-Path $src 'sub\file1.txt')
'two' | Set-Content -Path (Join-Path $src 'root.txt')
'stale' | Set-Content -Path (Join-Path $dst 'orphan.txt')
'ROBOCOPY_MIRROR_PREVIEW'
Robocopy $src $dst /MIR /L /R:1 /W:1
"LASTEXITCODE=$LASTEXITCODE"
```
```text
ROBOCOPY_MIRROR_PREVIEW

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

  Started : Tuesday, April 14, 2026 11:12:35
   Source : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\src\
     Dest : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\dst\

  Options : *.* /L /S /E /DCOPY:DA /COPY:DAT /PURGE /MIR /R:1 /W:1

	  *EXTRA File 		       7	orphan.txt

               Total    Copied   Skipped  Mismatch    FAILED    Extras
   Files :         2         0         2         0         0         1
LASTEXITCODE=2
```

#### Use restartable mode for interruption-prone links

`/Z` keeps Robocopy in restartable mode so an interrupted job can resume instead of restarting the whole file. The live run below stays local, but the option line confirms the mode that would be used on a real network copy.

```powershell
$base = Join-Path $env:TEMP 'vault-transfer-demo-ps'
$src = Join-Path $base 'src3'
$dst = Join-Path $base 'dst3'
Remove-Item -LiteralPath $src,$dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $src 'sub') -Force | Out-Null
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Set-Content -Path (Join-Path $src 'sub\large.txt') -Value ('x' * 5000)
'ROBOCOPY_RESTARTABLE_ONLY'
Robocopy $src $dst /E /Z /R:1 /W:1
"LASTEXITCODE=$LASTEXITCODE"
```
```text
ROBOCOPY_RESTARTABLE_ONLY

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

  Started : Tuesday, April 14, 2026 11:16:31
   Source : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\src3\
     Dest : C:\Users\aperi\AppData\Local\Temp\vault-transfer-demo-ps\dst3\

  Options : *.* /S /E /DCOPY:DA /COPY:DAT /Z /R:1 /W:1

	    New File  		    5002	large.txt

               Total    Copied   Skipped  Mismatch    FAILED    Extras
   Files :         1         1         0         0         0         0
LASTEXITCODE=1
```

#### Do not combine `/IPG` with `/MT`

Bandwidth throttling and multithreaded copy are separate operational choices in Robocopy. The command below fails immediately because `/IPG` and `/MT` are mutually exclusive.

```powershell
$base = Join-Path $env:TEMP 'vault-transfer-demo-ps'
$src = Join-Path $base 'src2'
$dst = Join-Path $base 'dst2'
Remove-Item -LiteralPath $src,$dst -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $src 'sub') -Force | Out-Null
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Set-Content -Path (Join-Path $src 'sub\large.txt') -Value ('x' * 5000)
'ROBOCOPY_RESTARTABLE'
Robocopy $src $dst /E /Z /IPG:10 /MT:4 /R:1 /W:1
"LASTEXITCODE=$LASTEXITCODE"
```
```text
ROBOCOPY_RESTARTABLE

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

The /IPG option cannot be used with the /MT option.
The /LFSM option cannot be used with the /MT or /EFSRAW options.
Warning: Failed to query volume space; /LFSM will not monitor for low free space.
       Simple Usage :: ROBOCOPY source destination /MIR

****  /MIR can DELETE files as well as copy them !
LASTEXITCODE=16
```

Use this table for the switches you reach for most often in PowerShell copy jobs.

| Switch | Syntax | Purpose |
|---|---|---|
| `/E` | `Robocopy src dst /E` | Copy all subdirectories, including empty ones. |
| `/MIR` | `Robocopy src dst /MIR` | Mirror the tree and delete destination extras. |
| `/L` | `Robocopy src dst /L` | Preview the operation without copying or deleting. |
| `/Z` | `Robocopy src dst /Z` | Use restartable mode for interrupted copies. |
| `/IPG:n` | `Robocopy src dst /IPG:20` | Insert an inter-packet gap as a crude throttle. |
| `/MT:n` | `Robocopy src dst /MT:16` | Use multiple threads for faster local or LAN copies. |
| `/R:n` | `Robocopy src dst /R:3` | Limit retry attempts on failed copies. |
| `/W:n` | `Robocopy src dst /W:5` | Limit wait time between retries. |
| `/LOG:file` | `Robocopy src dst /LOG:copy.log` | Write a durable log file for later review. |

Robocopy exit codes are lookup data, not Unix-style success or failure states.

| Exit code range | Meaning | Automation action |
|---|---|---|
| `0` | Nothing copied and no differences detected. | Treat as success. |
| `1` to `7` | Files copied, extras detected, or other non-fatal states. | Treat as success and inspect the summary if needed. |
| `8` or higher | At least one real failure occurred. | Treat as failure. |

### PowerShell | `scp` | quick remote copy over OpenSSH

PowerShell can call the same OpenSSH `scp` client that Linux uses. The useful distinction is not syntax but operational context: on Windows you usually prefer `Robocopy` for directory work and reserve `scp` for small SSH-bound copies.

#### Inspect the local OpenSSH client

The Windows OpenSSH build also prints usage text when invoked without arguments, which is enough to confirm the client is available.

```powershell
$PSStyle.OutputRendering = 'PlainText'
$ansi = [char]27 + '\[[0-9;]*m'
scp 2>&1 | ForEach-Object { $_.ToString() -replace $ansi, '' } | Select-Object -First 4
```
```text
usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]
           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]
           [-P port] [-S program] [-X sftp_option] source ... target
```

#### Connection refusal is a transport problem, not a copy problem

This call points at `127.0.0.1` intentionally. The refusal happens before any file-transfer logic can succeed, which is the correct signal to switch from path debugging to host or service debugging.

```powershell
$PSStyle.OutputRendering = 'PlainText'
$ansi = [char]27 + '\[[0-9;]*m'
$demo = Join-Path $env:TEMP 'scp-demo.txt'
'demo' | Set-Content -Path $demo
scp -v -o ConnectTimeout=3 $demo demo@127.0.0.1:/tmp/scp-demo.txt 2>&1 |
    ForEach-Object { $_.ToString() -replace $ansi, '' } |
    Select-Object -Last 6
```
```text
debug1: identity file C:\\Users\\aperi/.ssh/id_xmss-cert type -1
debug1: identity file C:\\Users\\aperi/.ssh/id_dsa type -1
debug1: identity file C:\\Users\\aperi/.ssh/id_dsa-cert type -1
debug1: kex_exchange_identification: write: Connection refused
banner exchange: Connection to UNKNOWN port -1: Connection refused
C:\WINDOWS\System32\OpenSSH\scp.exe: Connection closed
```

## GCP transfer tools

The worker environment contains the Google Cloud CLIs, so the page can show real local client behavior. The live GCP transfer examples below stop at explicit blocker boundaries because this isolated run has no approved demo project, VM, or bucket to mutate.

### Linux | `gcloud compute scp` | transfers to Compute Engine

`gcloud compute scp` is the right wrapper when the destination is a Compute Engine VM. It handles the Google Cloud metadata that raw `scp` does not know about, but it still needs a selected account, project, and instance.

#### Confirm the CLI installation before you target a VM

The version check proves the local CLI surface exists before you spend time debugging project or zone errors.

```bash
gcloud version | sed -n '1,4p'
```
```text
Google Cloud SDK 563.0.0
alpha 2026.03.27
beta 2026.03.27
bq 2.1.31
```

#### Stop when there is no active account or project context

This dry run uses a fake project and a local file. The command never reaches a VM because the CLI stops earlier and reports the missing authenticated account explicitly.

```bash
printf 'demo\n' | tee /tmp/vault-transfer-demo-linux/gcloud-scp.txt >/dev/null
CLOUDSDK_CORE_DISABLE_PROMPTS=1 gcloud compute scp /tmp/vault-transfer-demo-linux/gcloud-scp.txt demo-vm:/tmp/gcloud-scp.txt --zone=europe-west1-b --project=demo-does-not-exist-123456 --dry-run 2>&1 | sed -n '1,12p'
```
```text
ERROR: (gcloud.compute.scp) You do not currently have an active account selected.
Please run:

  $ gcloud auth login

to obtain new credentials.

If you have already logged in with a different account, run:

  $ gcloud config set account ACCOUNT

to select an already authenticated account to use.
```

These are the switches most likely to matter once the project and VM actually exist.

| Flag | Syntax | Purpose |
|---|---|---|
| `--zone` | `--zone=europe-west1-b` | Select the VM zone when it is not already configured. |
| `--project` | `--project=my-project` | Override the active Google Cloud project. |
| `--recurse` | `--recurse` | Copy a directory tree instead of a single file. |
| `--tunnel-through-iap` | `--tunnel-through-iap` | Route the copy through Identity-Aware Proxy. |
| `--internal-ip` | `--internal-ip` | Use the VM's internal address when that route is valid. |
| `--ssh-key-file` | `--ssh-key-file=~/.ssh/key` | Force a specific SSH identity file. |

### Linux | `gsutil` | legacy Cloud Storage workflows

`gsutil` remains common in older scripts and operations playbooks. Its CLI is available locally here, but safe demonstration stops at fake bucket paths because this run has no approved Cloud Storage target.

#### Inspect the installed `gsutil` client

`gsutil version -l` is a quick preflight that proves the client, Python runtime, and WSL environment are wired correctly.

```bash
gsutil version -l | sed -n '1,6p'
```
```text
gsutil version: 5.36
checksum: d2b58d0fd013f0b3ec07e8a797aa6208 (OK)
boto version: 2.49.0
python version: 3.12.3 (main, Mar  3 2026, 12:15:18) [GCC 13.3.0]
OS: Linux 6.6.87.2-microsoft-standard-WSL2
multiprocessing available: True
```

#### Require a real bucket before you attempt a transfer

The copy path is not the first problem to solve if the bucket does not exist. The CLI fails early with a direct 404 so you can correct the resource definition before you script around it.

```bash
gsutil ls gs://demo-does-not-exist-123456 2>&1 | sed -n '1,10p'
```
```text
BucketNotFoundException: 404 gs://demo-does-not-exist-123456 bucket does not exist.
```

Use this lookup table when you need the legacy `gsutil` syntax on an existing codebase.

| Command or flag | Syntax | Purpose |
|---|---|---|
| `cp` | `gsutil cp file gs://bucket/path` | Copy one or more objects to or from GCS. |
| `-m` | `gsutil -m cp -r dir gs://bucket/path` | Parallelize a recursive copy. |
| `rsync -r` | `gsutil rsync -r dir gs://bucket/path` | Synchronize only new or changed files. |
| `-n` | `gsutil rsync -n dir gs://bucket/path` | Preview the sync plan without mutating the bucket. |
| `-d` | `gsutil rsync -d dir gs://bucket/path` | Delete destination-only objects during sync. |
| `-z` | `gsutil cp -z csv,json file gs://bucket/path` | Gzip selected text file types on upload. |

### PowerShell | `gcloud storage` | modern Cloud Storage workflows

`gcloud storage` is the cleaner default for new automation because it keeps Cloud Storage operations inside the main Google Cloud CLI. The local help surface is runnable here even though the worker has no real bucket to write to.

#### Confirm the command group is installed

The help text proves the command group exists before you spend time debugging permissions or path spelling.

```powershell
$PSStyle.OutputRendering = 'PlainText'
gcloud storage --help 2>&1 | Select-Object -First 8
```
```text
NAME
    gcloud storage - create and manage Cloud Storage buckets and objects

SYNOPSIS
    gcloud storage GROUP | COMMAND [GCLOUD_WIDE_FLAG ...]

DESCRIPTION
    The gcloud storage command group lets you create and manage Cloud Storage
```

#### Treat a 404 as a resource-definition problem first

This command fails on a deliberately fake bucket. That is still useful because it proves the CLI can run locally and shows the exact blocker you need to clear before attempting a live upload or sync.

```powershell
$PSStyle.OutputRendering = 'PlainText'
gcloud storage ls gs://demo-does-not-exist-123456 2>&1 | Select-Object -First 10
```
```text
ERROR: (gcloud.storage.ls) gs://demo-does-not-exist-123456 not found: 404.
```

### `gcloud storage` vs `gsutil` | choose the active CLI on purpose

Both CLIs remain useful, but they solve different operational problems in a mature estate. Keep `gsutil` where legacy scripts already depend on it, and prefer `gcloud storage` for new work so the command surface stays inside one actively maintained CLI.

| Question | `gsutil` | `gcloud storage` |
|---|---|---|
| Best fit | Existing operational scripts and entrenched runbooks | New automation and new operator workflows |
| Runtime model | Separate legacy CLI implemented in Python | Command group inside the main `gcloud` CLI |
| Common sync command | `gsutil rsync -r src gs://bucket/path` | `gcloud storage rsync src gs://bucket/path --recursive` |
| Operational risk to watch | `rsync -d` deletes destination-only objects | Resource names and auth still must be valid before any copy starts |

## SQL Server data transfer

This worker environment exposes the SQL Server client tools on Windows, so the live SQL captures below use PowerShell rather than WSL. They show real client presence first and then stop at explicit connection blockers because no local SQL Server instance was available to export from safely.

### PowerShell | `bcp` | bulk copy between SQL Server and files

`bcp` is the fastest path between SQL Server and flat files when you need raw throughput. It is also unforgiving: the client can be present and healthy locally while every real export or import still blocks on server reachability and schema correctness.

#### Verify that the bulk-copy client is installed

`bcp -v` is the fastest preflight when you need to confirm the client is on the Windows host before you build the export command.

```powershell
$PSStyle.OutputRendering = 'PlainText'
bcp -v 2>&1
```
```text
BCP - Bulk Copy Program for Microsoft SQL Server.
Copyright (C) Microsoft Corporation. All Rights Reserved.
Version: 17.0.1000.7
```

#### Export and import stay blocked until a server answers

This call points at `127.0.0.1,1435` intentionally so the blocker is explicit and local. The failure happens before any file is written, which is the right signal to fix connectivity before you reason about delimiters or row counts.

```powershell
$PSStyle.OutputRendering = 'PlainText'
bcp "SELECT 1 AS value" queryout NUL -S tcp:127.0.0.1,1435 -U sa -P badpass -d master -c -t "," -l 2 2>&1 |
    Select-Object -First 8
```
```text
SQLState = 08001, NativeError = 258
Error = [Microsoft][ODBC Driver 18 for SQL Server]TCP Provider: The wait operation timed out.

SQLState = 08001, NativeError = 258
Error = [Microsoft][ODBC Driver 18 for SQL Server]A network-related or instance-specific error has occurred while establishing a connection to tcp:127.0.0.1,1435. Server is not found or not accessible. Check if instance name is correct and if SQL Server is configured to allow remote connections. For more information see SQL Server Books Online.
SQLState = S1T00, NativeError = 0
Error = [Microsoft][ODBC Driver 18 for SQL Server]Login timeout expired
```

Use these flags when you are writing the real bulk-copy command against a reachable SQL Server instance.

| Flag or mode | Syntax | Purpose |
|---|---|---|
| `queryout` | `bcp "SELECT ..." queryout file.csv ...` | Export a query result to a file. |
| `out` | `bcp db.schema.table out file.csv ...` | Export an entire table faster than `queryout`. |
| `in` | `bcp db.schema.table in file.csv ...` | Import a flat file into SQL Server. |
| `-c` | `-c` | Use character mode for readable text output. |
| `-t ","` | `-t ","` | Set the field delimiter explicitly. |
| `-r "\n"` | `-r "\n"` | Set the row terminator explicitly. |
| `-F 2` | `-F 2` | Skip the header row on import. |
| `-b 10000` | `-b 10000` | Batch commits during import. |
| `-e errors.log` | `-e errors.log` | Capture rejected rows in a separate file. |

### PowerShell | `sqlcmd` | query-oriented exports

`sqlcmd` is the lighter-weight option when you want query-driven output instead of the highest-throughput bulk client. It remains a text client, so the first job is always to prove the connection works before you start shaping delimiters and headers.

#### Inspect the client syntax before writing the query

The help text confirms the installed client version and the connection flags available on this host.

```powershell
$PSStyle.OutputRendering = 'PlainText'
sqlcmd -? 2>&1 | Select-Object -First 8
```
```text
Microsoft (R) SQL Server Command Line Tool
Version 17.0.1000.7 NT
Copyright (C) 2025 Microsoft Corporation. All rights reserved.

usage: Sqlcmd            [-U login id]          [-P password]
  [-S server]            [-H hostname]          [-E trusted connection]
  [-N[s|m|o] Encrypt Connection]
  [-C Trust Server Certificate]
```

#### Timeout errors mean the connection failed before the query ran

The login timeout below is a transport-level blocker. Until the server responds, changing `-s`, `-W`, or `-h` does nothing useful.

```powershell
$PSStyle.OutputRendering = 'PlainText'
sqlcmd -S tcp:127.0.0.1,1435 -l 2 -Q "SELECT 1" 2>&1 | Select-Object -First 8
```
```text
Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : TCP Provider: The wait operation timed out.
.
Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : Login timeout expired.
Sqlcmd: Error: Microsoft ODBC Driver 18 for SQL Server : A network-related or instance-specific error has occurred while establishing a connection to tcp:127.0.0.1,1435. Server is not found or not accessible. Check if instance name is correct and if SQL Server is configured to allow remote connections. For more information see SQL Server Books Online..
```

These are the `sqlcmd` switches that matter most for export-oriented usage.

| Flag | Syntax | Purpose |
|---|---|---|
| `-Q` | `-Q "SELECT ..."` | Run a query and exit immediately. |
| `-o file.csv` | `-o file.csv` | Write output to a file. |
| `-s ","` | `-s ","` | Set the column separator. |
| `-W` | `-W` | Trim trailing spaces from text output. |
| `-h -1` | `-h -1` | Suppress repeating headers. |
| `-l 2` | `-l 2` | Keep connection timeout short during diagnostics. |
| `-C` | `-C` | Trust the server certificate when encryption is enabled. |

### PowerShell | `Invoke-Sqlcmd` | object-based exports

`Invoke-Sqlcmd` is the PowerShell-native path when you want objects that can flow directly to `Export-Csv`. The prerequisite is a working `SqlServer` module on the host, and the second prerequisite is still a reachable SQL Server instance.

#### Confirm the `SqlServer` module is available

The module was installed in this attempt so the note could capture real local client evidence rather than stopping at a missing-command blocker.

```powershell
$PSStyle.OutputRendering = 'PlainText'
Get-Command Invoke-Sqlcmd | Format-Table -HideTableHeaders Name,Version,Source
```
```text
Invoke-Sqlcmd 22.4.5.1 SqlServer
```

#### The cmdlet still requires a reachable SQL Server instance

Once the module exists, the next blocker is exactly what it should be: the server endpoint itself. The catch block below preserves the raw connection error instead of fabricating a fake result set.

```powershell
$PSStyle.OutputRendering = 'PlainText'
try {
    Invoke-Sqlcmd -ServerInstance "127.0.0.1,1435" -Query "SELECT 1" -TrustServerCertificate -ConnectionTimeout 2 -ErrorAction Stop
} catch {
    $_.Exception.Message
}
```
```text
A network-related or instance-specific error occurred while establishing a connection to SQL Server. The server was not found or was not accessible. Verify that the instance name is correct and that SQL Server is configured to allow remote connections. (provider: TCP Provider, error: 0 - No connection could be made because the target machine actively refused it.)
```

## Transfer strategy and best practices

### Prefer the simplest local tool that matches the job

#### Use `cp` or `Copy-Item` for one-shot files

If the job is a single local file copy and there is no destination reconciliation, the direct file-copy tools are enough. They are faster to read, easier to audit, and do not imply mirror semantics that the operation does not need.

#### Use `rsync` or `Robocopy` when directories must converge

Repeated directory jobs should move immediately to `rsync` or `Robocopy` because both tools can enumerate changes, preserve metadata, and show you the plan before anything destructive happens. The live `rsync -av` and `Robocopy /E` captures above are the safe defaults to start from.

#### Treat mirrors as destructive maintenance operations

`rsync --delete` and `Robocopy /MIR` are not normal copy commands. They are reconciliation commands that remove destination-only data, so run the preview forms first and only drop `-n` or `/L` once the file list is unquestionably correct.

### Choose the remote-aware client that understands the destination

#### Use `scp` only for small, one-off SSH copies

`scp` is appropriate when the destination is reachable over SSH and the copy is simple enough that resume, delta transfer, and preview are not required. The local connection-refused captures above show how quickly it fails when the remote service itself is absent.

#### Use `gcloud compute scp` for Compute Engine VMs

Once the remote endpoint is a GCE instance, let `gcloud compute scp` carry the project, zone, and SSH-account context instead of reproducing that logic manually. The blocker output above also shows why this command is the right diagnostic surface: it tells you when auth or project state is missing before any transfer begins.

#### Use `gcloud storage` for new GCS automation and keep `gsutil` for legacy scripts

The CLIs overlap, but they serve different operational contexts. Keep `gsutil` where it is already embedded in runbooks, and use `gcloud storage` for new scripts so Cloud Storage work remains inside the main `gcloud` command surface.

#### Export from SQL Server before handing the file to cloud tooling

SQL Server extraction and cloud transfer are two separate responsibilities. Use `bcp`, `sqlcmd`, or `Invoke-Sqlcmd` to materialize a trustworthy file first, validate the row counts or result shape, and only then pass the artifact to GCS tooling.

### Apply controls that protect long-running transfers

#### Prefer restartable tools for large files

For large transfers, restart behavior matters more than peak throughput. `rsync -P`, `Robocopy /Z`, and the resumable behavior in modern cloud CLIs reduce the operational cost of packet loss or a dropped session.

#### Add bandwidth controls when production traffic shares the link

Throttle intentionally when the copy shares a business-hours link. On Linux, `rsync --bwlimit` is explicit. On Windows, `Robocopy /IPG:n` slows the sender, but the live failure above shows why it must not be combined with `/MT`.

Use this table when deciding whether transfer-time compression is worth the CPU cost.

| Data type | Compress during transfer? | Why |
|---|---|---|
| CSV, JSON, XML | Usually yes | Text compresses well and can reduce network time sharply. |
| Parquet, ORC | Usually no | The files are already internally compressed. |
| `.tar.gz`, `.zip` | No | Recompressing an archive wastes CPU with little gain. |
| SQL backups (`.bak`) | Depends | Prefer server-side backup compression when the platform supports it. |

## Data Transfer Warnings

- `rsync --delete` and `Robocopy /MIR` remove destination-only data. Always preview them with `-n` or `/L` first.
- `gsutil rsync -d` deletes cloud objects that are not present at the source. There is no safety net in the note's examples because no demo bucket was available.
- `bcp` needs explicit text-mode and delimiter flags if you expect a portable CSV-shaped file. Otherwise you can end up with output that is unreadable or difficult to parse.
- `scp` has no resume support. If the copy is large or failure-prone, switch to `rsync` or a cloud-aware client instead of retrying from zero.

## Data Transfer Troubleshooting

### Local filesystem sync issues

#### `rsync` created `dst/src` instead of syncing into `dst`

This is the trailing-slash mistake shown in the live dry run above. `rsync src dst/` copies the directory itself, whereas `rsync src/ dst/` copies the contents. If you are unsure, dry-run the exact source path before the live copy.

#### `Robocopy` returned `16` before copying anything

The live `Robocopy /Z /IPG:10 /MT:4` capture shows this failure mode directly. The problem is not permissions or path spelling; it is an invalid flag combination. Remove either `/IPG` or `/MT` and rerun the job.

### Remote and cloud transfer issues

#### `scp` failed with connection refused

That message means the SSH service itself did not accept the session. Fix host reachability, port selection, or the remote SSH daemon first; changing source or destination paths will not help until the transport exists.

#### `gcloud compute scp` could not fetch the resource

The worker capture stopped even earlier than VM lookup because no active Google Cloud account was selected. In real operations, clear the auth and project context first, then validate the instance name and `--zone`.

#### GCS commands returned `404`

The `gsutil ls` and `gcloud storage ls` captures show a clean resource-definition blocker. Correct the bucket name before you investigate permissions or transfer flags.

### SQL client issues

#### `bcp` or `sqlcmd` timed out before the export began

Both clients failed before any query work happened because `127.0.0.1,1435` did not answer. Until the endpoint is reachable, changing delimiters, headers, or file names is noise.

#### `Invoke-Sqlcmd` still failed after the module was installed

Installing the `SqlServer` module only clears the client-side prerequisite. The final blocker remains the same as `sqlcmd`: a reachable SQL Server instance that accepts the connection you are attempting.

## Data Transfer Cross-References

- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — complete data movement topology and tool selection framework
- [iap-tunneling](https://alp78.github.io/elysium/01-Shell/05-Networking/05-iap-tunneling) — opening IAP tunnels for rsync and scp to GCE VMs
- [compression](https://alp78.github.io/elysium/01-Shell/02-File-Operations/04-compression) — compress data before or during transfer
- [connecting-to-gcp-resources](https://alp78.github.io/elysium/01-Shell/05-Networking/06-connecting-to-gcp-resources) — complete GCP connection guide including GCS
- [file-manipulation](https://alp78.github.io/elysium/01-Shell/02-File-Operations/02-file-manipulation) — local file operations before transfer
