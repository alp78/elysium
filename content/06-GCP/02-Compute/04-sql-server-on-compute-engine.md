---
title: "04 - SQL Server on Compute Engine"
tags: [gcp, compute, sql-server]
aliases: [SQL Server on GCE, SQL Server VM GCP, stoxx-db GCE deployment]
description: "End-to-end deployment of SQL Server 2022 on a Compute Engine VM with dedicated disks for data, log, and TempDB — including the stoxx_db split-file layout and the bronze/silver/gold-only stoxx provisioning workflow."
created: 2026-04-12
updated: 2026-04-13
status: complete
---

# SQL Server on Compute Engine

> [!quote] The cloud is just a different datacenter
>
> "The same applies to cloud installations when SQL Server is running within VMs. After all, the cloud is just a different datacenter managed by an external provider."
>
> Source: Dmitri Korotkevitch | *SQL Server Advanced Troubleshooting and Performance Tuning*

> [!abstract]- Summary
>
> Covers the full self-managed SQL Server 2022 deployment pattern on Compute Engine, using `stoxx-vm` in `bq-wh-nb` with dedicated disks, private IAP access, Linux package installation, engine configuration, data publication, startup automation, teardown, and cost analysis.
>
> **Prerequisites and storage layout**
> - Build on the mounted disk layout from page 03: `/mnt/sqldata` on `stoxx-data` (100 GB `pd-ssd`), `/mnt/sqllog` on `stoxx-log` (20 GB `pd-ssd`), and `/mnt/sqltempdb` on `stoxx-tempdb` (20 GB `pd-ssd`)
> - Replace Docker-managed storage from the local `stoxx-db` reference with independent VM disks so data files, transaction log, and TempDB have separate IOPS, snapshot cadence, and resize boundaries
>
> **Package installation and bootstrap**
> - Import the Microsoft GPG key, register the SQL Server 2022 and `prod` APT repositories with `signed-by=`, install `mssql-server`, run non-interactive `mssql-conf setup`, install `mssql-tools18`, and verify build `16.0.4245.2`
> - Depend on Cloud NAT for outbound package access and use `sqlcmd -C` because the initial Linux deployment uses a self-signed TLS certificate
>
> **Engine and platform configuration**
> - Configure SQL Server on Ubuntu with `mssql-conf`, dedicated data, log, TempDB, and backup paths, firewall rules, and IAP/private-port access to `1433`
> - Keep the instance private with `--no-address` and reach it through port forwarding and local tools mapped to `localhost`
>
> **Database restore and publish workflow**
> - Recreate the `stoxx_db` reference layout on the VM, then run a separate publish path that seeds `stoxx` with only the `bronze`, `silver`, and `gold` schemas while excluding `demo_stc`
> - Validate schema inventory and row counts, take a compressed post-cutover backup, and drop the temporary `stoxx_seed` database only after the final target is confirmed
>
> **Startup, teardown, and cost**
> - Attach a metadata startup script that refuses to start SQL Server unless all required mounts are present, then logs actions through `google-guest-agent`
> - Use the ordered teardown sequence to stop SQL Server, stop the VM, detach and delete data disks, remove snapshots and firewall rules, and finally delete the instance
> - Review the monthly cost breakdown, scheduled start and stop savings, and Cloud SQL for SQL Server cost comparison
>
> **Operations and safety**
> - Warnings: non-interactive GPG import needs `gpg --batch`, Ubuntu 22.04 repo files need `signed-by=`, `sa` passwords must satisfy complexity policy, local `sqlcmd` needs `-C` without a CA-signed cert, and boot-time startup must verify disk mounts before service start
> - Recommendations table: the cost section contrasts always-on GCE, scheduled stop and start savings, and Cloud SQL for SQL Server pricing to frame the management-versus-cost tradeoff
> - Troubleshooting: 5 failure modes covering `/dev/tty` GPG import failures, `NO_PUBKEY` APT errors, weak `sa` password setup failures, self-signed TLS validation failures, and mount-dependent startup safety

> [!note]- Glossary
>
> **Compute Engine**
> - Google Cloud's virtual-machine platform for running guest operating systems and software on managed infrastructure.
> - It matters here because SQL Server is deployed as a normal Linux workload on a standard VM rather than as a managed database service.
>
> > [!info] Cloud does not remove fundamentals
> >
> > Running SQL Server on Compute Engine keeps the same core responsibilities as any other VM deployment: storage layout, package management, networking, startup order, and recovery planning.
>
> ---
>
> **persistent disk**
> - Google Cloud's durable block storage that remains attached to or independent from a VM across restarts and resize operations.
> - It matters because the deployment separates SQL Server data, log, and TempDB onto distinct disks with different operational roles.
>
> > [!info] Storage survives the process
> >
> > SQL Server can stop or the VM can reboot without erasing the database files. That persistence is what makes snapshotting, restore, and independent growth possible.
>
> ---
>
> **Cloud NAT**
> - A Google Cloud network service that gives private VMs outbound internet access without assigning them public IP addresses.
> - It matters because `stoxx-vm` needs package access to Microsoft repositories while still remaining private behind `--no-address`.
>
> > [!warning] Private VM still needs egress
> >
> > A private VM cannot install packages from the internet unless some outbound path exists. Cloud NAT solves that without exposing the VM to inbound public traffic.
>
> ---
>
> **filegroup**
> - A logical SQL Server container that holds one or more data files and acts as the placement target for tables and indexes.
> - It matters because the note reproduces a multi-file, multi-filegroup layout rather than collapsing all data into one default file.
>
> > [!info] Objects land in filegroups
> >
> > SQL Server places objects into filegroups, not directly into files. Filegroup design is the layer that lets you distribute storage intentionally.
>
> ---
>
> **data file (MDF)**
> - The primary SQL Server data file that every database must have and that anchors the PRIMARY filegroup.
> - It matters because the VM deployment uses the MDF as the base file around which additional NDF files and filegroups are organized.
>
> > [!info] One primary anchor
> >
> > A database has exactly one MDF. Expansion beyond that uses additional data files rather than extra primary files.
>
> ---
>
> **secondary data file (NDF)**
> - An additional SQL Server data file used to extend storage inside an existing or separate filegroup.
> - It matters because the note mirrors the reference layout by distributing user data across multiple files rather than relying on one large MDF.
>
> > [!info] Scale data laterally
> >
> > NDF files let you add capacity and distribute I/O within a filegroup design. They are the normal way to grow complex SQL Server layouts.
>
> ---
>
> **transaction log (LDF)**
> - SQL Server's sequential write-ahead log that records every committed or pending transaction change.
> - It matters because recoverability, crash recovery, and point-in-time restore depend on keeping the log isolated, durable, and correctly sized.
>
> > [!danger] Log health is recovery health
> >
> > If the log chain is broken or the log volume is mishandled, restore options collapse quickly. The log is not just a write buffer; it is the recovery backbone.
>
> ---
>
> **TempDB**
> - SQL Server's shared temporary database for sorts, spills, work tables, row versioning, and session-scoped temporary objects.
> - It matters because TempDB has heavy transient I/O and therefore benefits from its own disk rather than competing with user data or the transaction log.
>
> > [!info] Busy but disposable
> >
> > TempDB is performance-critical even though it is not durable business data. Isolating it improves runtime behavior without changing recovery planning.
>
> ---
>
> **recovery model**
> - The SQL Server setting that determines how transaction log truncation and backup-based recovery behave for a database.
> - It matters because the deployed databases need the right balance between log growth, backup cadence, and point-in-time restore capability.
>
> > [!warning] Recovery model changes operations
> >
> > Switching between `SIMPLE`, `FULL`, and `BULK_LOGGED` changes backup and restore expectations immediately. It is an operational choice, not a cosmetic setting.
>
> ---
>
> **collation**
> - The rule set that defines how SQL Server compares and sorts text, including case, accent, and supplementary-character behavior.
> - It matters because the deployment fixes database text semantics up front with `Latin1_General_100_CI_AS_SC_UTF8`.
>
> > [!warning] Collation is foundational
> >
> > Collation choices affect comparisons, indexing behavior, and string semantics. Changing them later is disruptive, so the initial choice matters.
>
> ---
>
> **IOPS**
> - Input and output operations per second, a storage-performance measure for how many read or write operations a disk can sustain.
> - It matters because the note deliberately allocates separate IOPS budgets to data, log, and TempDB by placing them on different SSD volumes.
>
> > [!info] Storage performance is partitioned
> >
> > Separating workloads across disks is a practical way to keep one hot path from consuming another path's IOPS budget.
>
> ---
>
> **`mssql-conf`**
> - The SQL Server on Linux configuration utility that writes instance settings into `/var/opt/mssql/mssql.conf`.
> - It matters because the deployment uses it both for the initial non-interactive setup and for later instance-level configuration changes.
>
> > [!warning] Many changes need restart
> >
> > `mssql-conf` writes configuration state, but many settings do not take effect until the SQL Server service is restarted. Treat it as configuration, not immediate runtime mutation.
>
> ---
>
> **`sqlcmd`**
> - The command-line client for sending T-SQL batches and scripts to SQL Server from Linux or Windows shells.
> - It matters because almost every validation, restore, publication, inventory, and backup step in the note is executed through `sqlcmd`.
>
> > [!warning] Local TLS still applies
> >
> > Even local connections can fail certificate validation when SQL Server uses a self-signed cert. That is why this note repeatedly uses `-C` for trusted local administration.
>
> ---
>
> **IAP tunnel**
> - Identity-Aware Proxy TCP forwarding from a local machine to a private VM port over Google's authenticated proxy path.
> - It matters because the VM has no public IP, so local administration of SQL Server on port `1433` depends on IAP rather than direct ingress.
>
> > [!info] Private SQL needs transport
> >
> > A private database port is still usable from a workstation when IAP forwards the traffic. Security comes from identity-gated access instead of public reachability.
>
> ---
>
> **port forwarding**
> - A networking pattern that binds a local port and relays its traffic to a remote port through a tunnel.
> - It matters because local tools connect to `localhost` while the tunnel carries the traffic to SQL Server on the VM.
>
> > [!info] Local tools stay normal
> >
> > Port forwarding lets SSMS, `sqlcmd`, and similar tools behave as if the database were local. The tunnel hides the private network path from the client application.
>
> ---
>
> **startup script**
> - A bash script stored in Compute Engine instance metadata and executed by the guest agent during VM boot.
> - It matters because the deployment uses boot-time verification to ensure SQL Server does not start unless every required mount exists.
>
> > [!danger] Missing mounts can corrupt placement
> >
> > If SQL Server starts without the intended mount points, it can recreate files in the wrong location on the boot disk. Startup checks prevent that class of silent failure.
>
> ---
>
> **Developer Edition**
> - The full-featured, non-production SQL Server edition licensed for development and testing workloads.
> - It matters because the note installs Developer Edition to retain Enterprise-level capabilities while keeping the environment legally limited to non-production use.
>
> > [!warning] Features do not equal license rights
> >
> > Developer Edition exposes advanced features, but that does not make it production-licensed. Operational capability and licensing permission are separate concerns.
>
> ---
>
> **medallion schema**
> - A layered data-model pattern in which `bronze`, `silver`, and `gold` schemas represent progressively refined versions of the data.
> - It matters because the final `stoxx` publication intentionally copies only these three schema layers and excludes the source-only `demo_stc` objects.
>
> > [!info] Publication is selective
> >
> > The target VM database is not a byte-for-byte copy of the local source. It is a curated publication that keeps only the medallion-serving layers.

> [!example] Self-Managed SQL Fit
>
> > [!success] Appropriate
> >
> > - Use this pattern for self-managed SQL Server workloads that need full control over edition, file layout, restore workflow, disk placement, startup sequence, and cost profile.
> > - Use it when dedicated data, log, and TempDB disks, private IAP-only access, and VM-level operating-system control are explicit requirements.
> > - Use it when the team is prepared to own package management, storage layout, startup safety, backup, firewalling, and teardown discipline.
>
> > [!failure] Inappropriate
> >
> > - Do not choose this route when managed patching, managed HA, and service simplicity matter more than low-level control.
> > - Do not use Developer Edition assumptions for production licensing decisions.
> > - Do not allow SQL Server to start when required mount points are missing or storage layout is not yet verified.

## Conceptual Model

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
    subgraph GCE["GCE: europe-west1-b / bq-wh-nb"]
        VM["stoxx-vm<br/>e2-medium | Ubuntu 22.04<br/>10.132.0.8 (private)"]
        SS["SQL Server 2022<br/>RTM-CU24 / 16.0.4245.2<br/>port 1433"]
        VM --> SS

        subgraph DISKS["Persistent Disks"]
            D1["stoxx-data (sdd)<br/>100 GB pd-ssd<br/>/mnt/sqldata<br/>PRIMARY + FG_Current<br/>+ FG_Archive + backups"]
            D2["stoxx-log (sdb)<br/>20 GB pd-ssd<br/>/mnt/sqllog<br/>LDF transaction log"]
            D3["stoxx-tempdb (sdc)<br/>20 GB pd-ssd<br/>/mnt/sqltempdb<br/>TempDB (8 ROWS + 1 LOG)"]
            D4["stoxx-boot (sda)<br/>50 GB pd-balanced<br/>/ (boot)"]
        end

        SS --> D1
        SS --> D2
        SS --> D3
        VM --> D4
    end

    subgraph NET["Network"]
        FW1["allow-sql-server-iap<br/>tcp:1433 ← 35.235.240.0/20<br/>tag: sql-server"]
        FW2["allow-sql-internal<br/>tcp:1433 ← 10.128.0.0/9<br/>tag: stoxx-db"]
        NAT["Cloud NAT: stoxx-nat<br/>stoxx-router<br/>Outbound internet"]
    end

    subgraph LOCAL["Local Workstation"]
        PS["PowerShell<br/>Start-Process powershell.exe<br/>gcloud start-iap-tunnel"]
        SQLCMD["sqlcmd.exe<br/>tcp:127.0.0.1,1435<br/>-l 60 -C"]
        PS -->|"localhost:1435 →<br/>IAP WebSocket →<br/>VM:1433"| SQLCMD
    end

    FW1 --> GCE
    LOCAL --> FW1
    NAT --> GCE
```

## Installing SQL Server 2022 on Ubuntu

All commands execute on `stoxx-vm` via `gcloud compute ssh stoxx-vm --tunnel-through-iap`. The VM has no external IP (`--no-address`); outbound internet access is provided by Cloud NAT (`stoxx-nat` / `stoxx-router` in `europe-west1`), created before installation.

> [!warning] GPG key import fails over SSH --command with /dev/tty
>
> The standard one-liner `curl ... | gpg --dearmor | sudo tee ...` fails when run via `--command=` because `gpg` tries to open `/dev/tty` for passphrase prompts, which is not available in a non-interactive SSH session.
>
> **Fix:** two-step approach — save the ASC key to a temp file first, then convert with `--batch`.

> [!success] Two-step GPG import for non-interactive SSH
>
> ```bash
> curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
>   | sudo tee /tmp/microsoft.asc > /dev/null
> sudo gpg --batch --yes --dearmor \
>   -o /usr/share/keyrings/microsoft-prod.gpg /tmp/microsoft.asc
> ```

### Ubuntu | SQL Server 2022 | install

#### Import Microsoft GPG key

**When to run:** before adding any Microsoft package repository on Ubuntu 22.04.
**Trigger:** fresh VM with no Microsoft packages installed.
**Context:** executed via `gcloud compute ssh stoxx-vm --tunnel-through-iap --command="..."`. Requires internet access via Cloud NAT. Read-only side effect: writes `/usr/share/keyrings/microsoft-prod.gpg`.
**Purpose:** establish the cryptographic trust anchor for Microsoft's APT repository so that subsequent `apt-get install` commands can verify package signatures.

*Import the Microsoft GPG key in two steps to avoid the `/dev/tty` error in non-interactive SSH.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | sudo tee /tmp/microsoft.asc > /dev/null
    sudo gpg --batch --yes --dearmor \
      -o /usr/share/keyrings/microsoft-prod.gpg /tmp/microsoft.asc
    echo 'GPG key imported successfully'
  "
```

```text
GPG key imported successfully
```

#### Add SQL Server 2022 APT repository

**When to run:** immediately after GPG key import.
**Trigger:** first-time SQL Server installation on the VM.
**Context:** `gcloud compute ssh --command` on the VM. Writes to `/etc/apt/sources.list.d/mssql-server-2022.list`. The `signed-by=` field is required on Ubuntu 22.04 — without it, APT rejects the repo with `NO_PUBKEY EB3E94ADBE1229CF`.
**Purpose:** register the Microsoft SQL Server 2022 package repository so `apt-get` can discover the `mssql-server` package.

> [!warning] Missing signed-by causes NO_PUBKEY error on Ubuntu 22.04
>
> Ubuntu 22.04's APT requires `signed-by=/path/to/key.gpg` in the repo definition. Writing the list file as downloaded from Microsoft (without `signed-by=`) causes `apt-get update` to fail with `NO_PUBKEY EB3E94ADBE1229CF`.

> [!success] Override the repo file with signed-by field
>
> Write the repository entry manually using `echo ... | sudo tee` to include the `signed-by=` field pointing to the imported GPG key.

*Write the SQL Server 2022 APT repo file with the required `signed-by` field and refresh the package index.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    echo 'deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] \
https://packages.microsoft.com/ubuntu/22.04/mssql-server-2022 jammy main' \
      | sudo tee /etc/apt/sources.list.d/mssql-server-2022.list
    sudo apt-get update -q
  " 2>&1 | grep -E 'deb \[|Get:|Hit:|Err:'
```

```text
deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/ubuntu/22.04/mssql-server-2022 jammy main
Get:5 https://packages.microsoft.com/ubuntu/22.04/mssql-server-2022 jammy InRelease [3624 B]
Get:6 https://packages.microsoft.com/ubuntu/22.04/mssql-server-2022 jammy/main amd64 Packages [10.8 kB]
```

#### Install SQL Server package

**When to run:** after the APT repository is registered and `apt-get update` has completed.
**Trigger:** initial installation; also used to upgrade an existing instance to a new cumulative update.
**Context:** `gcloud compute ssh --command` on the VM. Requires `sudo`. Downloads ~600 MB from packages.microsoft.com. The service is not started automatically — setup requires a subsequent `mssql-conf setup` call.
**Purpose:** install the `mssql-server` binary package on the VM.

*Install `mssql-server` and show the final lines of the package manager output.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo apt-get install -y mssql-server 2>&1 | tail -15"
```

```text
to complete the setup of Microsoft SQL Server
+--------------------------------------------------------------+

Processing triggers for man-db (2.10.2-1) ...
Processing triggers for libc-bin (2.35-0ubuntu3.13) ...

Running kernel seems to be up-to-date.

No services need to be restarted.
No containers need to be restarted.
No user sessions are running outdated binaries.
No VM guests are running outdated hypervisor (qemu) binaries on this host.
```

#### Run mssql-conf setup

**When to run:** once after package installation, before starting the service for the first time.
**Trigger:** first-time setup. Also required after `mssql-server` version upgrades that reset the EULA acceptance.
**Context:** `gcloud compute ssh --command` on the VM. Uses environment variables to pass edition and SA password non-interactively (the `-n` flag suppresses the interactive prompt). The SA password must satisfy SQL Server's complexity policy: ≥8 characters, with uppercase, lowercase, digit, and special character.
**Purpose:** set the SQL Server edition (Developer), accept the EULA, configure the SA login password, and start the service.

> [!warning] SA password complexity required
>
> SQL Server enforces Windows password policy by default on Linux. A password that is too simple (e.g., `Password1`) causes setup to fail silently or with a cryptic error.

> [!success] Use a strong password and verify with sqlcmd
>
> The password `Stoxx@VM2024!` satisfies the policy. After setup, verify connectivity with `sqlcmd -S localhost -U sa -P '<password>' -C -Q "SELECT @@VERSION"`.

*Run non-interactive setup using environment variables to select Developer edition and set the SA password.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo MSSQL_SA_PASSWORD='<password>' MSSQL_PID='Developer' \
    /opt/mssql/bin/mssql-conf -n setup accept-eula"
```

```text
ForceFlush is enabled for this instance.
Failed to open password policy registry path. Using default password policy values.
BulkAdmin AllowedPathsList cleared (path filtering disabled)
ForceFlush feature is enabled for log durability.
Created symlink /etc/systemd/system/multi-user.target.wants/mssql-server.service → /lib/systemd/system/mssql-server.service.
The license terms for this product can be found in
/usr/share/doc/mssql-server or downloaded from: https://aka.ms/useterms

The privacy statement can be viewed at:
https://go.microsoft.com/fwlink/?LinkId=853010&clcid=0x409

Configuring SQL Server...
Setup has completed successfully. SQL Server is now starting.
```

The "Failed to open password policy registry path" line is expected on Linux — SQL Server falls back to its built-in default policy (8-character minimum with complexity). "ForceFlush is enabled" confirms write-ahead logging durability is active.

#### Verify SQL Server is running

**When to run:** immediately after `mssql-conf setup` completes.
**Trigger:** post-installation smoke test; also after any restart.
**Context:** `gcloud compute ssh --command` on the VM. Read-only systemctl query. No permissions beyond SSH access required.
**Purpose:** confirm the service is active and record the initial resource footprint (PID and memory).

*Check systemd service status for `mssql-server`.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo systemctl status mssql-server --no-pager"
```

```text
● mssql-server.service - Microsoft SQL Server Database Engine
     Loaded: loaded (/lib/systemd/system/mssql-server.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2026-04-12 19:34:44 UTC; 9s ago
       Docs: https://docs.microsoft.com/en-us/sql/linux
   Main PID: 3413 (sqlservr)
      Tasks: 150
     Memory: 612.6M
        CPU: 11.974s
     CGroup: /system.slice/mssql-server.service
             ├─3413 /opt/mssql/bin/sqlservr
             └─3443 /opt/mssql/bin/sqlservr
```

`Active: active (running)` confirms the service started. The two `sqlservr` PIDs (3413 and 3443) are normal — the outer process is the supervisor and the inner process is the SQL Server engine. Initial memory of 612.6 MB reflects the default `max server memory` setting; this will be tuned in the server configuration note.

#### Install mssql-tools18 and unixODBC

**When to run:** after `mssql-server` is running; before any local `sqlcmd` calls from the VM.
**Trigger:** first-time setup. Tools are not installed as part of the server package.
**Context:** requires a second Microsoft repository (`prod.list`) for the tools package. The `mssql-tools18` package provides `sqlcmd` and `bcp` at `/opt/mssql-tools18/bin/`.
**Purpose:** install `sqlcmd` so SQL commands can be executed directly on the VM via SSH.

*Register the Microsoft `prod` APT repository and install `mssql-tools18` and `unixodbc-dev`.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
      | sudo tee /tmp/mssql-prod.list
    echo \"deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] \
https://packages.microsoft.com/ubuntu/22.04/prod jammy main\" \
      | sudo tee /etc/apt/sources.list.d/mssql-prod.list
    sudo apt-get update -q && \
    sudo ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev 2>&1 | tail -5
  "
```

```text
Get:5 https://packages.microsoft.com/ubuntu/22.04/prod jammy InRelease [3632 B]
Get:7 https://packages.microsoft.com/ubuntu/22.04/prod jammy/main arm64 Packages [144 kB]
Get:8 https://packages.microsoft.com/ubuntu/22.04/prod jammy/main amd64 Packages [324 kB]
No services need to be restarted.
No user sessions are running outdated binaries.
```

#### Add tools to PATH and verify connectivity

**When to run:** after `mssql-tools18` is installed.
**Trigger:** first-time setup. Also required in any new shell session on the VM until the `~/.bashrc` change takes effect.
**Context:** appends to `~/.bashrc`. The `-C` flag trusts the self-signed server certificate (required for all local connections without a CA-issued cert). `@@VERSION` returns the full SQL Server build string confirming the installed version.
**Purpose:** make `sqlcmd` available on PATH and confirm SQL Server accepts connections.

*Add `/opt/mssql-tools18/bin` to PATH and query `@@VERSION` to confirm the installed build.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    echo 'export PATH=\"\$PATH:/opt/mssql-tools18/bin\"' >> ~/.bashrc
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C \
      -Q \"SELECT @@VERSION AS version\"
  "
```

```text
Microsoft SQL Server 2022 (RTM-CU24) (KB5080999) - 16.0.4245.2 (X64)
	Feb 25 2026 15:01:38
	Copyright (C) 2022 Microsoft Corporation
	Developer Edition (64-bit) on Linux (Ubuntu 22.04.5 LTS) <X64>

(1 rows affected)
```

SQL Server 2022 RTM-CU24 (KB5080999, build 16.0.4245.2, released 2026-02-25) is running on Ubuntu 22.04.5 LTS. Developer Edition includes all Enterprise features and is licensed for development and testing only — not for production workloads.

> [!info] The `-C` flag (trust server certificate)
>
> SQL Server on Linux generates a self-signed TLS certificate during setup. Without `-C`, `sqlcmd` rejects the connection with "SSL Provider: [error:0A000086:SSL routines::certificate verify failed]". The flag is appropriate for local connections where the certificate identity is not meaningful. For production remote connections, install a CA-signed certificate and remove `-C`.

| Flag | Syntax | Description |
|---|---|---|
| `-S` | `-S <host>` or `-S <host>,<port>` | Server address. Use `localhost` for local connections; use `tcp:127.0.0.1,<port>` when connecting through a forwarded port. |
| `-U` | `-U sa` | Login name. `sa` is the SQL Server Administrator account. |
| `-P` | `-P '<password>'` | Password for the login. |
| `-C` | `-C` | Trust the server's self-signed TLS certificate without CA validation. |
| `-Q` | `-Q "query"` | Execute a query and exit immediately. |
| `-q` | `-q "query"` | Execute a query but remain in interactive mode. |
| `-d` | `-d stoxx_db` | Connect to a specific database on login. |
| `-l` | `-l 60` | Login timeout in seconds. Default is 30 s; set to 60 s when connecting through an IAP tunnel. |
| `-s` | `-s'|'` | Column separator. Use `'|'` for pipe-separated output suitable for markdown table conversion. |
| `-i` | `-i script.sql` | Execute a SQL script file. |
| `-o` | `-o output.txt` | Write output to a file instead of stdout. |

> [!example]- Terraform equivalent — Cloud NAT (prerequisite for apt-get)
>
> ```hcl
> resource "google_compute_router" "stoxx_router" {
>   name    = "stoxx-router"
>   region  = "europe-west1"
>   network = "default"
>   project = "bq-wh-nb"
>   description = "Router for stoxx-vm outbound NAT"
> }
>
> resource "google_compute_router_nat" "stoxx_nat" {
>   name                               = "stoxx-nat"
>   router                             = google_compute_router.stoxx_router.name
>   region                             = "europe-west1"
>   project                            = "bq-wh-nb"
>   nat_ip_allocate_option             = "AUTO_ONLY"
>   source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
> }
> ```

## Configuring SQL Server File Paths

After installation, SQL Server defaults to `/var/opt/mssql/data/` for all files. The three `mssql-conf set` commands redirect default locations to the dedicated persistent disks before any user databases are created. All three settings require a service restart to take effect.

### Ubuntu | mssql-conf | configure file locations

#### Set default data and log directories

**When to run:** immediately after installation, before creating any user databases.
**Trigger:** initial server setup; also if the data disk mount point changes.
**Context:** `gcloud compute ssh --command`. Each `mssql-conf set` writes a key-value pair to `/var/opt/mssql/mssql.conf`. Requires `sudo`. Changes take effect after `systemctl restart mssql-server`.
**Purpose:** redirect SQL Server's default data file location to `/mnt/sqldata`, log file location to `/mnt/sqllog`, and crash dump location to `/mnt/sqldata/dump`.

*Set `defaultdatadir`, `defaultlogdir`, and `defaultdumpdir` to the dedicated persistent disk mount points.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    echo '=== Set default data dir ==='
    sudo /opt/mssql/bin/mssql-conf set filelocation.defaultdatadir /mnt/sqldata
    echo '=== Set default log dir ==='
    sudo /opt/mssql/bin/mssql-conf set filelocation.defaultlogdir /mnt/sqllog
    echo '=== Set default dump dir ==='
    sudo /opt/mssql/bin/mssql-conf set filelocation.defaultdumpdir /mnt/sqldata/dump
  "
```

```text
=== Set default data dir ===
SQL Server needs to be restarted in order to apply this setting. Please run
'systemctl restart mssql-server.service'.
Note that sp_reload_mssqlconf can be used to apply a limited subset of settings without restarting the service.
=== Set default log dir ===
SQL Server needs to be restarted in order to apply this setting. Please run
'systemctl restart mssql-server.service'.
Note that sp_reload_mssqlconf can be used to apply a limited subset of settings without restarting the service.
=== Set default dump dir ===
SQL Server needs to be restarted in order to apply this setting. Please run
'systemctl restart mssql-server.service'.
```

The repeated restart prompt is expected and correct — all three settings will be applied in a single restart in the next step.

#### Set ownership and restart SQL Server

**When to run:** after all `mssql-conf set` commands are complete, before any database creation.
**Trigger:** initial setup. Also after adding new disk mount points or changing the `mssql` user's UID.
**Context:** `gcloud compute ssh --command` with `sudo`. The `mssql` system user owns all SQL Server files. Without this ownership, SQL Server cannot write to the mount points and database creation fails with an OS error.
**Purpose:** transfer ownership of all three mount points to `mssql:mssql` and restart the service so the new file path configuration takes effect.

*Change ownership of all three disk mount points to the `mssql` system user and restart the service.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    echo '=== Set ownership ==='
    sudo chown -R mssql:mssql /mnt/sqldata /mnt/sqllog /mnt/sqltempdb
    ls -la /mnt/ | grep -E 'sqldata|sqllog|sqltempdb'
    echo '=== Restart SQL Server ==='
    sudo systemctl restart mssql-server
    sleep 5
    sudo systemctl status mssql-server --no-pager | head -12
  "
```

```text
=== Set ownership ===
drwxr-xr-x  4 mssql mssql 4096 Apr 12 19:35 sqldata
drwxr-xr-x  3 mssql mssql 4096 Apr 12 19:04 sqllog
drwxr-xr-x  3 mssql mssql 4096 Apr 12 19:04 sqltempdb
=== Restart SQL Server ===
● mssql-server.service - Microsoft SQL Server Database Engine
     Loaded: loaded (/lib/systemd/system/mssql-server.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2026-04-12 19:35:53 UTC; 5s ago
       Docs: https://docs.microsoft.com/en-us/sql/linux
   Main PID: 4568 (sqlservr)
      Tasks: 141
     Memory: 544.2M
        CPU: 6.279s
```

New PID 4568 confirms the restart completed. Memory of 544.2 MB is lower than immediately after first startup because SQL Server has not yet started user activity.

#### Verify mssql.conf settings

**When to run:** after restart, to confirm the configuration file contains the expected values before database creation.
**Trigger:** post-restart verification; also useful for debugging if databases are created in the wrong location.
**Context:** `gcloud compute ssh --command` with `sudo cat`. Read-only. The file is at `/var/opt/mssql/mssql.conf`.
**Purpose:** confirm that all three `filelocation` keys are written correctly in the configuration file.

*Read the current `/var/opt/mssql/mssql.conf` to confirm file path settings.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo cat /var/opt/mssql/mssql.conf"
```

```text
[sqlagent]
enabled = false

[EULA]
accepteula = Y

[filelocation]
defaultdatadir = /mnt/sqldata
defaultlogdir = /mnt/sqllog
defaultdumpdir = /mnt/sqldata/dump
```

All three `filelocation` keys point to the dedicated disk mount points. `sqlagent = false` is the default; SQL Server Agent can be enabled separately when scheduled jobs are needed.

| Flag | Syntax | Description |
|---|---|---|
| `set` | `mssql-conf set <section>.<key> <value>` | Write a key-value pair to `/var/opt/mssql/mssql.conf`. Most settings require restart. |
| `get` | `mssql-conf get <section>.<key>` | Read the current value of a setting. |
| `unset` | `mssql-conf unset <section>.<key>` | Remove a setting, reverting to the SQL Server default. |
| `list` | `mssql-conf list` | List all configured (non-default) settings. |
| `setup` | `mssql-conf setup` | Run the interactive first-time setup wizard (edition selection, EULA, SA password). |
| `-n` | `mssql-conf -n setup` | Non-interactive setup; reads edition and password from environment variables. |
| `traceflag` | `mssql-conf traceflag <N> on/off` | Enable or disable a SQL Server trace flag persistently. |

## Configuring TempDB

TempDB is SQL Server's shared temporary workspace used by all sessions for operations including sorts, hash joins, row version store (required by RCSI), temporary tables, and work tables from the query optimizer. On a single-disk system, TempDB competes with user data files for I/O, creating latency spikes during high-sort or high-version-store activity. Placing TempDB on its own disk (`/mnt/sqltempdb`) isolates this I/O entirely.

The default TempDB on Linux ships with 8 equally-sized data files (SQL Server 2019+ default) and 1 log file. Moving all files to `/mnt/sqltempdb` requires changing each file's `FILENAME` attribute via `ALTER DATABASE tempdb MODIFY FILE`, then restarting the service — TempDB files cannot be moved while SQL Server is running.

### Ubuntu | TempDB | configure files

#### Move TempDB files to dedicated disk

**When to run:** after `mssql-conf` file path configuration and before creating any user databases. TempDB must be on its dedicated disk before production-level RCSI workloads begin.
**Trigger:** initial server setup. Also required if the TempDB disk is replaced or remounted.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. T-SQL DDL — modifies the system catalog but does not move files on disk until the next restart. Requires `sysadmin` rights. Changes take effect after `systemctl restart mssql-server`.
**Purpose:** redirect all 8 TempDB data files and the TempDB log file from the default `/var/opt/mssql/data/` path to `/mnt/sqltempdb/`.

> [!info]- T-SQL clause breakdown
>
> - `USE master` — required because `tempdb` cannot be the active database for DDL affecting its own files.
> - `ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev', FILENAME = '/mnt/sqltempdb/tempdb.mdf')` — changes the path recorded in the system catalog for logical file `tempdev`. The physical file is not moved until the next SQL Server restart.
> - The 8 data file names follow the pattern `tempdev`, `tempdev2` … `tempdev8`; the log file is named `templog`.

*Move all 9 TempDB files (8 ROWS data files + 1 LOG file) to `/mnt/sqltempdb/`.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
USE master;
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev',  FILENAME = '/mnt/sqltempdb/tempdb.mdf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev2', FILENAME = '/mnt/sqltempdb/tempdb2.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev3', FILENAME = '/mnt/sqltempdb/tempdb3.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev4', FILENAME = '/mnt/sqltempdb/tempdb4.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev5', FILENAME = '/mnt/sqltempdb/tempdb5.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev6', FILENAME = '/mnt/sqltempdb/tempdb6.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev7', FILENAME = '/mnt/sqltempdb/tempdb7.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'tempdev8', FILENAME = '/mnt/sqltempdb/tempdb8.ndf');
ALTER DATABASE tempdb MODIFY FILE (NAME = 'templog',  FILENAME = '/mnt/sqltempdb/templog.ldf');
\""
```

```text
Changed database context to 'master'.
The file "tempdev" has been modified in the system catalog. The new path will be used the next time the database is started.
The file "tempdev2" has been modified in the system catalog. The new path will be used the next time the database is started.
The file "templog" has been modified in the system catalog. The new path will be used the next time the database is started.
```

The message "The new path will be used the next time the database is started" is expected for all 9 files. After restart, SQL Server creates the files at the new path and deletes the old ones from `/var/opt/mssql/data/`.

#### Restart and verify TempDB file placement

**When to run:** immediately after all 9 `MODIFY FILE` statements succeed.
**Trigger:** required for TempDB file moves to take effect.
**Context:** `gcloud compute ssh --command`. Restart is the only way to apply TempDB file moves. The `sys.master_files` catalog view reflects the actual physical path after restart.
**Purpose:** apply the file moves and confirm all 9 TempDB files are on `/mnt/sqltempdb/`.

*Restart SQL Server and verify TempDB file placement via `sys.master_files`.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    sudo systemctl restart mssql-server && sleep 8
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C \
      -Q \"SELECT name, physical_name, size*8/1024 AS size_mb, \
                growth*8/1024 AS growth_mb, type_desc \
             FROM sys.master_files WHERE database_id = 2 ORDER BY file_id\" \
      -s'|'
  "
```

| name | physical_name | size_mb | growth_mb | type_desc |
|---|---|---|---|---|
| tempdev | /mnt/sqltempdb/tempdb.mdf | 136 | 64 | ROWS |
| templog | /mnt/sqltempdb/templog.ldf | 64 | 64 | LOG |
| tempdev2 | /mnt/sqltempdb/tempdb2.ndf | 136 | 64 | ROWS |
| tempdev3 | /mnt/sqltempdb/tempdb3.ndf | 136 | 64 | ROWS |
| tempdev4 | /mnt/sqltempdb/tempdb4.ndf | 136 | 64 | ROWS |
| tempdev5 | /mnt/sqltempdb/tempdb5.ndf | 136 | 64 | ROWS |
| tempdev6 | /mnt/sqltempdb/tempdb6.ndf | 136 | 64 | ROWS |
| tempdev7 | /mnt/sqltempdb/tempdb7.ndf | 136 | 64 | ROWS |
| tempdev8 | /mnt/sqltempdb/tempdb8.ndf | 136 | 64 | ROWS |

*(9 rows affected)*

All 9 files are on `/mnt/sqltempdb/`. The 8 ROWS files are 136 MB each (1,088 MB total for data) with 64 MB autogrowth; the LOG file starts at 64 MB with 64 MB autogrowth.

> [!info] Why TempDB gets its own disk
>
> TempDB is the most heavily written system database on an active SQL Server instance. It handles four distinct I/O streams simultaneously:
>
> - **Sort spills** — queries that exceed the memory grant write sort runs to TempDB.
> - **Hash join spills** — large joins that exceed the grant write hash buckets to TempDB.
> - **Row version store** — `READ_COMMITTED_SNAPSHOT` and `SNAPSHOT ISOLATION` write every modified row version to TempDB. On a write-heavy OLAP workload, this can exceed 1 GB/min.
> - **Temporary tables and table variables** — application code that creates and populates large `#temp` tables writes to TempDB.
>
> Mixing TempDB I/O with user data I/O on the same disk creates latency spikes that affect all queries. A dedicated pd-ssd provides isolated IOPS (up to 30 IOPS/GB on GCE) so TempDB pressure does not degrade user reads and writes.
>
> Using 8 equally-sized data files (the SQL Server 2019+ default) eliminates SGAM and PFS contention that occurs with a single TempDB file under concurrent workloads. All 8 files must be the same size so SQL Server's proportional-fill algorithm distributes writes evenly across them.

## Creating the stoxx_db Database

`stoxx_db` is the reference production-pattern database whose layout replicates the Docker container `stoxx-db`. The filegroup design separates hot/active data from cold/historical data, and places the transaction log on a dedicated disk:

- **PRIMARY** — one MDF file on `/mnt/sqldata/`. Holds the system catalog objects only.
- **FG_Current** (default filegroup) — two NDF files on `/mnt/sqldata/`. Holds active pricing data, current index compositions, and live signals. Two files distribute I/O across two ROWS allocations within the same disk.
- **FG_Archive** — one NDF file on `/mnt/sqldata/`. Holds historical data accessed infrequently (OHLCV history, archive-period signals). Separate filegroup enables future migration to cheaper cold storage by moving only the archive filegroup.
- **LOG** — one LDF file on `/mnt/sqllog/`. Sequential writes to the transaction log do not benefit from multiple files; a single LDF on a dedicated disk achieves optimal throughput.

### Ubuntu | stoxx_db | create and configure

#### Create stoxx_db with full filegroup layout

**When to run:** after TempDB is configured and all disk mount points are confirmed.
**Trigger:** initial database creation.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. DDL executed as `sa`. `CREATE DATABASE` with explicit file specifications overrides the `defaultdatadir` and `defaultlogdir` settings from `mssql-conf` — the per-file `FILENAME` parameters take precedence.
**Purpose:** create the `stoxx_db` database with the exact file layout matching the Docker baseline: PRIMARY + FG_Current (2 files) + FG_Archive, log on a separate disk.

> [!info]- CREATE DATABASE clause breakdown
>
> - `ON PRIMARY (NAME=..., FILENAME=..., SIZE=128MB, MAXSIZE=1024MB, FILEGROWTH=64MB)` — creates the primary data file in the PRIMARY filegroup. `SIZE` sets the initial allocation (pre-allocated on disk). `MAXSIZE` caps growth to prevent runaway autogrowth from filling the disk. `FILEGROWTH=64MB` specifies a fixed increment rather than a percentage to keep growth events predictable.
> - `FILEGROUP FG_Current (NAME=..., ...)` — creates a named filegroup with two NDF files. SQL Server distributes new extent allocations across files within a filegroup using proportional fill, so both files must be the same size.
> - `FILEGROUP FG_Archive (...)` — a separate filegroup for cold/historical data. Keeping it separate allows independent filegroup-level backups and future migration to read-only storage.
> - `LOG ON (NAME=..., FILENAME=..., SIZE=256MB, ...)` — the transaction log. A single LDF per database is the standard pattern; the path points to the dedicated log disk.

*Create `stoxx_db` replicating the Docker container layout with 3 data filegroups and a dedicated log file.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
CREATE DATABASE stoxx_db
ON PRIMARY
  (NAME = stoxx_db_Primary,
   FILENAME = '/mnt/sqldata/stoxx_db_Primary.mdf',
   SIZE = 128MB, MAXSIZE = 1024MB, FILEGROWTH = 64MB),
FILEGROUP FG_Current
  (NAME = stoxx_db_Current_01,
   FILENAME = '/mnt/sqldata/stoxx_db_Current_01.ndf',
   SIZE = 256MB, MAXSIZE = 4096MB, FILEGROWTH = 128MB),
  (NAME = stoxx_db_Current_02,
   FILENAME = '/mnt/sqldata/stoxx_db_Current_02.ndf',
   SIZE = 256MB, MAXSIZE = 4096MB, FILEGROWTH = 128MB),
FILEGROUP FG_Archive
  (NAME = stoxx_db_Archive_01,
   FILENAME = '/mnt/sqldata/stoxx_db_Archive_01.ndf',
   SIZE = 128MB, MAXSIZE = 2048MB, FILEGROWTH = 64MB)
LOG ON
  (NAME = stoxx_db_Log,
   FILENAME = '/mnt/sqllog/stoxx_db_Log.ldf',
   SIZE = 256MB, MAXSIZE = 2048MB, FILEGROWTH = 128MB);
\""
```

No output from `CREATE DATABASE` indicates success — SQL Server emits no rows for DDL statements when they complete without error.

#### Configure filegroups

**When to run:** immediately after `CREATE DATABASE` succeeds.
**Trigger:** initial setup. These properties are not set by `CREATE DATABASE` and must be configured separately.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. Three `ALTER DATABASE` statements. `AUTOGROW_ALL_FILES` syntax does not use the `SET` keyword — this is a common syntax error.
**Purpose:** make `FG_Current` the default filegroup so tables created without an explicit `ON <filegroup>` clause land on the active data disk; enable `AUTOGROW_ALL_FILES` on both user filegroups so all files in each filegroup grow simultaneously rather than sequentially.

> [!warning] AUTOGROW_ALL_FILES syntax error — no SET keyword
>
> `ALTER DATABASE stoxx_db MODIFY FILEGROUP FG_Current SET AUTOGROW_ALL_FILES` raises Msg 156, "Incorrect syntax near the keyword 'SET'".

> [!success] Correct syntax omits SET
>
> `ALTER DATABASE stoxx_db MODIFY FILEGROUP FG_Current AUTOGROW_ALL_FILES;`

*Set FG_Current as the default filegroup and enable AUTOGROW_ALL_FILES on both user filegroups.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
ALTER DATABASE stoxx_db MODIFY FILEGROUP FG_Current DEFAULT;
PRINT 'FG_Current is now default filegroup';
ALTER DATABASE stoxx_db MODIFY FILEGROUP FG_Current AUTOGROW_ALL_FILES;
PRINT 'AUTOGROW_ALL_FILES enabled on FG_Current';
ALTER DATABASE stoxx_db MODIFY FILEGROUP FG_Archive AUTOGROW_ALL_FILES;
PRINT 'AUTOGROW_ALL_FILES enabled on FG_Archive';
\""
```

```text
The filegroup property 'DEFAULT' has been set.
The filegroup property 'AUTOGROW_ALL_FILES' has been set.
The filegroup property 'AUTOGROW_ALL_FILES' has been set.
Filegroup configuration complete
```

`AUTOGROW_ALL_FILES` on `FG_Current` ensures that when the filegroup hits its autogrowth threshold, both `stoxx_db_Current_01.ndf` and `stoxx_db_Current_02.ndf` grow by 128 MB simultaneously — maintaining proportional fill balance. Without this setting, SQL Server grows only the fullest file, degrading I/O distribution over time.

#### Set database options

**When to run:** immediately after filegroup configuration.
**Trigger:** initial setup. These options are not inherited from a model database template — they must be set explicitly.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. Each `ALTER DATABASE` statement is idempotent. `READ_COMMITTED_SNAPSHOT ON` briefly acquires a schema lock on `stoxx_db` and requires no other connections during the `ALTER`. `COLLATE` is a one-time setting at creation; changing it later requires rebuilding all string-column indexes.
**Purpose:** enable the production configuration: FULL recovery for point-in-time restore, RCSI for optimistic read concurrency, snapshot isolation for read consistency under write contention, UTF-8 collation, Query Store for workload analysis, and compatibility level 160 for SQL Server 2022 optimizer features.

*Set all six database-level options in a single sqlcmd call.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
ALTER DATABASE stoxx_db SET RECOVERY FULL;
PRINT 'RECOVERY FULL set';
ALTER DATABASE stoxx_db SET READ_COMMITTED_SNAPSHOT ON;
PRINT 'READ_COMMITTED_SNAPSHOT ON set';
ALTER DATABASE stoxx_db SET ALLOW_SNAPSHOT_ISOLATION ON;
PRINT 'ALLOW_SNAPSHOT_ISOLATION ON set';
ALTER DATABASE stoxx_db COLLATE Latin1_General_100_CI_AS_SC_UTF8;
PRINT 'Collation set';
ALTER DATABASE stoxx_db SET QUERY_STORE = ON;
PRINT 'QUERY_STORE ON set';
ALTER DATABASE stoxx_db SET COMPATIBILITY_LEVEL = 160;
PRINT 'Compatibility level 160 set';
\""
```

```text
RECOVERY FULL set
READ_COMMITTED_SNAPSHOT ON set
ALLOW_SNAPSHOT_ISOLATION ON set
Collation set
QUERY_STORE ON set
Compatibility level 160 set
```

#### Verify database file layout

**When to run:** after all database configuration steps complete.
**Trigger:** post-creation verification; run this query whenever a discrepancy between the documented and actual layout is suspected.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. Read-only query against `stoxx_db.sys.database_files` and `stoxx_db.sys.filegroups`. Returns one row per file.
**Purpose:** confirm that all 5 files match the Docker baseline in path, filegroup assignment, initial size, autogrowth increment, maximum size, and file type.

*Query `sys.database_files` joined to `sys.filegroups` to produce a complete file layout report.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
SELECT
    f.name        AS logical_name,
    f.physical_name,
    fg.name       AS filegroup,
    f.size*8/1024 AS size_mb,
    f.growth*8/1024 AS growth_mb,
    f.max_size*8/1024 AS maxsize_mb,
    f.type_desc
FROM stoxx_db.sys.database_files f
LEFT JOIN stoxx_db.sys.filegroups fg ON f.data_space_id = fg.data_space_id
ORDER BY f.file_id;
\" -s'|'"
```

| logical_name | physical_name | filegroup | size_mb | growth_mb | maxsize_mb | type_desc |
|---|---|---|---|---|---|---|
| stoxx_db_Primary | /mnt/sqldata/stoxx_db_Primary.mdf | PRIMARY | 128 | 64 | 1024 | ROWS |
| stoxx_db_Log | /mnt/sqllog/stoxx_db_Log.ldf | NULL | 256 | 128 | 2048 | LOG |
| stoxx_db_Current_01 | /mnt/sqldata/stoxx_db_Current_01.ndf | FG_Current | 256 | 128 | 4096 | ROWS |
| stoxx_db_Current_02 | /mnt/sqldata/stoxx_db_Current_02.ndf | FG_Current | 256 | 128 | 4096 | ROWS |
| stoxx_db_Archive_01 | /mnt/sqldata/stoxx_db_Archive_01.ndf | FG_Archive | 128 | 64 | 2048 | ROWS |

*(5 rows affected)*

The layout matches the Docker baseline exactly. `filegroup = NULL` for the log file is correct — transaction log files do not belong to a filegroup in SQL Server's catalog; they use a separate data space.

> [!info] Filegroup design rationale
>
> **FG_Current (default):** Active pricing data, live index compositions, and current signals land here automatically — any `CREATE TABLE` without an explicit `ON <filegroup>` clause uses the default. Two NDF files allow SQL Server's proportional-fill algorithm to spread new extent allocations across both files, doubling the effective write parallelism within the disk.
>
> **FG_Archive:** Cold and historical data is explicitly placed in this filegroup via `CREATE TABLE ... ON FG_Archive`. Separating it from FG_Current means the archive filegroup can be marked `READ_ONLY` after a period closes, eliminating its log overhead and enabling filegroup-level backups of just the archive tier.
>
> **LOG on `/mnt/sqllog`:** Transaction log writes are sequential by design — SQL Server writes to the end of the LDF in strict LSN order. A dedicated disk eliminates latency from competing random reads from the data disk. The FULL recovery model preserves every log record for point-in-time restore and log shipping.

#### Verify database options

**When to run:** after setting all six database options.
**Trigger:** post-setup confirmation; also useful during audits to compare GCE and Docker instances.
**Context:** read-only query against `sys.databases`. Returns one row.
**Purpose:** confirm all six configured options match the Docker baseline settings.

*Query `sys.databases` for all configured option columns on `stoxx_db`.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
SELECT
    name,
    recovery_model_desc,
    collation_name,
    compatibility_level,
    is_read_committed_snapshot_on,
    snapshot_isolation_state_desc,
    is_query_store_on
FROM sys.databases
WHERE name = 'stoxx_db';
\" -s'|'"
```

| name | recovery_model_desc | collation_name | compatibility_level | is_read_committed_snapshot_on | snapshot_isolation_state_desc | is_query_store_on |
|---|---|---|---|---|---|---|
| stoxx_db | FULL | Latin1_General_100_CI_AS_SC_UTF8 | 160 | 1 | ON | 1 |

*(1 rows affected)*

All six settings match the Docker baseline: FULL recovery, UTF-8 collation, SQL Server 2022 compatibility (160), RCSI enabled (`is_read_committed_snapshot_on = 1`), snapshot isolation active (`ON`), and Query Store enabled (`is_query_store_on = 1`).

## Remote Connectivity via IAP Tunnel

`stoxx-vm` has no external IP address (`--no-address`). Remote `sqlcmd` connections from a local workstation reach port 1433 through GCP's Identity-Aware Proxy TCP forwarding layer. The IAP service acts as a broker: the local `gcloud` client opens a WebSocket connection to `tunnel.cloudproxy.app`, the IAP service verifies IAM credentials, and the connection is forwarded to the VM's port 1433 over the internal network. No public firewall rule exposing port 1433 is needed.

> [!warning] gcloud start-iap-tunnel WinError 10038 on Windows
>
> On Windows, running `gcloud compute start-iap-tunnel` in a bash shell (Git Bash / WSL2) fails with `WinError 10038: An operation was attempted on something that is not a socket`. This is a known issue with Python socket handling when gcloud's Python runtime bridges the Windows socket API through a POSIX-emulation layer.

> [!success] Launch the IAP tunnel via a PowerShell subprocess
>
> Invoke `gcloud` inside a native `powershell.exe` process launched via `Start-Process`. This sidesteps the socket bridging issue because gcloud runs in a Windows-native environment.
>
> ```powershell
> $proc = Start-Process -NoNewWindow -FilePath "powershell.exe" `
>   -ArgumentList @("-Command", "gcloud compute start-iap-tunnel stoxx-vm 1433 `
>     --local-host-port=localhost:1435 --zone=europe-west1-b --project=bq-wh-nb") `
>   -PassThru
> Write-Output "IAP tunnel PID: $($proc.Id)"
> Start-Sleep 15
> netstat -ano | findstr 1435
> ```

### Windows | IAP tunnel | connect to SQL Server

#### Start IAP tunnel on local port 1435

**When to run:** before any local `sqlcmd` session targeting `stoxx-vm`. The tunnel must be running in the background for the duration of the session.
**Trigger:** whenever a local SQL Client (sqlcmd, SSMS, Azure Data Studio) needs to connect to `stoxx-vm`.
**Context:** PowerShell on the local workstation. Requires `gcloud` CLI authenticated with an account that has `roles/iap.tunnelResourceAccessor` on the project. The `allow-sql-server-iap` firewall rule must exist (see Firewall Rules section).
**Purpose:** open a local TCP listener on `localhost:1435` that forwards to `stoxx-vm:1433` through the IAP service.

*Start the IAP tunnel via a PowerShell subprocess and confirm the local port is listening.*

```powershell
$proc = Start-Process -NoNewWindow -FilePath "powershell.exe" -ArgumentList @(
    "-Command",
    "gcloud compute start-iap-tunnel stoxx-vm 1433 --local-host-port=localhost:1435 --zone=europe-west1-b --project=bq-wh-nb"
) -PassThru
Write-Output "IAP tunnel PID: $($proc.Id)"
Start-Sleep 15
netstat -ano | findstr 1435
```

```text
IAP tunnel PID: 13640
WARNING:
To increase the performance of the tunnel, consider installing NumPy.
Testing if tunnel connection works.
  TCP    127.0.0.1:1435         0.0.0.0:0              LISTENING       18136
  TCP    [::1]:1435             [::]:0                 LISTENING       18136
```

`LISTENING` on both `127.0.0.1:1435` and `[::1]:1435` confirms the local port is open. The NumPy warning is informational — the tunnel functions without NumPy but throughput may be lower for bulk operations.

#### Connect from local machine

**When to run:** after the IAP tunnel is established on `localhost:1435`.
**Trigger:** any interactive SQL session, schema inspection, or ad-hoc query from the local workstation.
**Context:** `sqlcmd.exe` (ODBC 18 driver) on the local Windows workstation. The `-l 60` login timeout is required — the IAP WebSocket handshake takes longer than the default 30-second timeout. Use `tcp:` prefix to force TCP protocol and avoid named-pipe fallback.
**Purpose:** confirm end-to-end connectivity from the local workstation through IAP to `stoxx-vm`, verifying server identity.

*Connect via the IAP tunnel and query `@@SERVERNAME` and `@@VERSION` to confirm identity.*

```powershell
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\sqlcmd.exe" `
  -S "tcp:127.0.0.1,1435" -U sa -P "<password>" -C -l 60 `
  -Q "SELECT @@SERVERNAME AS server_name, @@VERSION AS version"
```

```text
stoxx-vm                 Microsoft SQL Server 2022 (RTM-CU24) (KB5080999) - 16.0.4245.2 (X64)
	Feb 25 2026 15:01:38
	Copyright (C) 2022 Microsoft Corporation
	Developer Edition (64-bit) on Linux (Ubuntu 22.04.5 LTS) <X64>

(1 rows affected)
```

`@@SERVERNAME = stoxx-vm` confirms the connection reached the correct VM. The version string matches the locally-verified install.

#### Verify stoxx_db remotely

**When to run:** after confirming basic connectivity.
**Trigger:** post-deployment verification; also after a full backup/restore cycle to confirm file placement.
**Context:** `sqlcmd.exe` with `-d stoxx_db` to set the initial database context. Same IAP tunnel process must still be running.
**Purpose:** confirm that `stoxx_db` and all its files are accessible through the remote connection.

*Connect to `stoxx_db` via the IAP tunnel and list all database files.*

```powershell
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\sqlcmd.exe" `
  -S "tcp:127.0.0.1,1435" -U sa -d stoxx_db -P "<password>" -C -l 60 `
  -Q "SELECT name, physical_name, size*8/1024 AS size_mb, type_desc FROM sys.database_files ORDER BY file_id"
```

| name | physical_name | size_mb | type_desc |
|---|---|---|---|
| stoxx_db_Primary | /mnt/sqldata/stoxx_db_Primary.mdf | 128 | ROWS |
| stoxx_db_Log | /mnt/sqllog/stoxx_db_Log.ldf | 256 | LOG |
| stoxx_db_Current_01 | /mnt/sqldata/stoxx_db_Current_01.ndf | 256 | ROWS |
| stoxx_db_Current_02 | /mnt/sqldata/stoxx_db_Current_02.ndf | 256 | ROWS |
| stoxx_db_Archive_01 | /mnt/sqldata/stoxx_db_Archive_01.ndf | 128 | ROWS |

*(5 rows affected)*

All five files are visible and report the expected sizes. `stoxx_db` is ready for schema deployment and data loading.

> [!warning] Never expose port 1433 via a public firewall rule
>
> SQL Server's port 1433 must never be reachable from `0.0.0.0/0` on any internet-facing interface. The `allow-sql-server-iap` firewall rule limits source ranges to `35.235.240.0/20` (GCP's IAP proxy range only), ensuring no direct internet path to the database.

> [!success] Use IAP tunnel for all remote SQL Server access
>
> All SQL Client connections from outside the VPC must go through `gcloud compute start-iap-tunnel`. For SSMS or Azure Data Studio, the same tunnel on `localhost:1435` works identically — set the server address to `127.0.0.1,1435` in the connection dialog.

## Firewall Rules

Two firewall rules govern TCP access to port 1433 on `stoxx-vm`. Neither rule exposes SQL Server to the public internet.

### GCP | firewall | SQL Server access rules

#### Create IAP TCP tunnel firewall rule

**When to run:** before the first IAP tunnel connection attempt. Without this rule, the tunnel handshake succeeds but the TCP connection to port 1433 is dropped at the VM's network interface.
**Trigger:** initial deployment; without this rule `gcloud start-iap-tunnel` reports "Testing if tunnel connection works" but the connection never reaches `sqlservr`.
**Context:** `gcloud compute firewall-rules create`. Requires `compute.firewalls.create` IAM permission. Source range `35.235.240.0/20` is GCP's fixed IAP proxy IP block — all IAP TCP forwarding originates from this range. Target tag `sql-server` is already applied to `stoxx-vm`.
**Purpose:** allow GCP's IAP proxy to forward TCP:1433 connections to VMs tagged `sql-server`.

*Create the firewall rule allowing IAP TCP tunnel access to port 1433.*

```bash
gcloud compute firewall-rules create allow-sql-server-iap \
  --project=bq-wh-nb \
  --allow=tcp:1433 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=sql-server \
  --description="Allow IAP TCP tunnel to SQL Server port 1433" \
  --format="table(name,network,direction,priority,allowed,disabled)"
```

```text
Creating firewall...
..Created [https://www.googleapis.com/compute/v1/projects/bq-wh-nb/global/firewalls/allow-sql-server-iap].
done.
NAME                  NETWORK  DIRECTION  PRIORITY  ALLOW     DISABLED
allow-sql-server-iap  default  INGRESS    1000      tcp:1433  False
```

#### Create internal SQL Server firewall rule

**When to run:** when other GCE VMs in the same VPC (e.g., application servers, Airflow workers) need to connect to SQL Server directly over the internal network without IAP.
**Trigger:** deployment of any workload that connects to `stoxx-vm:1433` from inside the `default` VPC network.
**Context:** source range `10.128.0.0/9` covers all `default` subnet ranges in all GCP regions (europe-west1 subnet is `10.132.0.0/20`). Target tag `stoxx-db` must be applied to `stoxx-vm` to receive this rule.
**Purpose:** allow internal VPC traffic on TCP:1433 to reach VMs tagged `stoxx-db`.

*Create the internal-only SQL Server access rule for VPC-internal clients.*

```bash
gcloud compute firewall-rules create allow-sql-internal \
  --project=bq-wh-nb \
  --allow=tcp:1433 \
  --source-ranges=10.128.0.0/9 \
  --target-tags=stoxx-db \
  --description="Allow internal VPC access to SQL Server port 1433" \
  --format="table(name,network,direction,priority,allowed,disabled)"
```

```text
Creating firewall...
..Created [https://www.googleapis.com/compute/v1/projects/bq-wh-nb/global/firewalls/allow-sql-internal].
done.
NAME                NETWORK  DIRECTION  PRIORITY  ALLOW     DISABLED
allow-sql-internal  default  INGRESS    1000      tcp:1433  False
```

#### List SQL Server firewall rules

**When to run:** during deployment verification and during security audits.
**Trigger:** any change to the firewall configuration; routine verification of the attack surface.
**Context:** `gcloud compute firewall-rules list` with a filter. Read-only.
**Purpose:** confirm both rules are present and that no rule exists with `sourceRanges = 0.0.0.0/0` for port 1433.

*List all firewall rules matching `stoxx` or `sql` in the project.*

```bash
gcloud compute firewall-rules list \
  --project=bq-wh-nb \
  --filter="name~stoxx OR name~sql" \
  --format="table(name,direction,allowed,sourceRanges,targetTags,disabled)"
```

```text
NAME                  DIRECTION  ALLOWED                                     SOURCE_RANGES        TARGET_TAGS     DISABLED
allow-sql-internal    INGRESS    [{'IPProtocol': 'tcp', 'ports': ['1433']}]  ['10.128.0.0/9']     ['stoxx-db']    False
allow-sql-server-iap  INGRESS    [{'IPProtocol': 'tcp', 'ports': ['1433']}]  ['35.235.240.0/20']  ['sql-server']  False
```

Both rules are active. Source ranges are restricted to IAP proxy IPs and the internal VPC CIDR — no public access is exposed.

> [!danger] Never create a firewall rule allowing 0.0.0.0/0 on port 1433
>
> Exposing SQL Server's default port to the internet enables automated brute-force attacks against the `sa` login and SQL Server vulnerabilities. Internet-facing SQL Server instances are compromised within minutes on average.

> [!success] Use IAP for all remote access
>
> The `allow-sql-server-iap` rule restricts source to `35.235.240.0/20` (GCP IAP only). No credential can reach port 1433 directly from the internet — authentication happens at the GCP IAP layer (IAM) before the TCP connection is established.

*To delete a firewall rule during teardown:*

```bash
gcloud compute firewall-rules delete allow-sql-server-iap --project=bq-wh-nb --quiet
gcloud compute firewall-rules delete allow-sql-internal --project=bq-wh-nb --quiet
```

| Flag | Syntax | Description |
|---|---|---|
| `--allow` | `--allow=tcp:1433` | Protocol and port to permit. |
| `--source-ranges` | `--source-ranges=35.235.240.0/20` | CIDR blocks allowed as source. Use `35.235.240.0/20` for IAP. |
| `--target-tags` | `--target-tags=sql-server` | Apply rule only to VMs with this network tag. |
| `--direction` | `--direction=INGRESS` | Default is INGRESS. |
| `--priority` | `--priority=1000` | Lower number = higher priority. Default 1000. |
| `--disabled` | `--disabled` | Create the rule in disabled state. |
| `--quiet` | `--quiet` | Skip confirmation prompt on destructive commands. |

> [!example]- Terraform equivalent
>
> ```hcl
> resource "google_compute_firewall" "allow_sql_server_iap" {
>   name        = "allow-sql-server-iap"
>   network     = "default"
>   project     = "bq-wh-nb"
>   description = "Allow IAP TCP tunnel to SQL Server port 1433"
>   direction   = "INGRESS"
>   priority    = 1000
>
>   allow {
>     protocol = "tcp"
>     ports    = ["1433"]
>   }
>
>   source_ranges = ["35.235.240.0/20"]
>   target_tags   = ["sql-server"]
> }
>
> resource "google_compute_firewall" "allow_sql_internal" {
>   name        = "allow-sql-internal"
>   network     = "default"
>   project     = "bq-wh-nb"
>   description = "Allow internal VPC access to SQL Server port 1433"
>   direction   = "INGRESS"
>   priority    = 1000
>
>   allow {
>     protocol = "tcp"
>     ports    = ["1433"]
>   }
>
>   source_ranges = ["10.128.0.0/9"]
>   target_tags   = ["stoxx-db"]
> }
> ```

## Backup and Restore

SQL Server backups on GCE write to `/mnt/sqldata/backup/` (on the `stoxx-data` persistent disk). This co-locates backups with the data files for simplicity; in a production setup, backups would be streamed to Cloud Storage via `gcloud storage cp` or a third-party SQL Server backup tool. The backup is verified with `RESTORE HEADERONLY` and tested with a full restore to a different database name (`stoxx_db_restored`).

### Ubuntu | backup | full backup and restore

#### Create backup directory

**When to run:** once after `stoxx_db` is created.
**Trigger:** initial setup. The `mssql` user must own the backup directory for `BACKUP DATABASE` to write to it.
**Context:** `gcloud compute ssh --command` with `sudo`. No SQL Server interaction.
**Purpose:** create `/mnt/sqldata/backup/` and transfer ownership to `mssql:mssql`.

*Create the backup directory and set ownership to the `mssql` system user.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo mkdir -p /mnt/sqldata/backup && sudo chown mssql:mssql /mnt/sqldata/backup"
```

No output on success.

#### Full backup with compression

**When to run:** before any schema changes or data loading; on a recurring schedule via the startup script or SQL Agent.
**Trigger:** manual backup before a deployment; first backup after initial database setup.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. `BACKUP DATABASE` is state-changing — it creates the `.bak` file on disk. `WITH COMPRESSION` reduces backup size by up to 70% for data-heavy databases. `STATS=10` emits a progress line every 10% completion.
**Purpose:** create a full backup of `stoxx_db` to `/mnt/sqldata/backup/stoxx_db_full.bak`.

> [!info]- BACKUP DATABASE clause breakdown
>
> - `TO DISK = '/mnt/sqldata/backup/stoxx_db_full.bak'` — output file path. The `mssql` user must have write access.
> - `WITH INIT` — overwrite an existing backup set in the file rather than appending. Prevents the file from growing indefinitely with successive backups.
> - `COMPRESSION` — enables backup compression. SQL Server 2022 uses zlib by default; compatible with all RESTORE operations. Reduces the 968 MB database to a 728 KB file here (near-empty database with only system pages).
> - `STATS=10` — print progress messages at 10% intervals during the backup. Useful for monitoring long-running backups of large databases.

*Take a full compressed backup of `stoxx_db` with progress output.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
BACKUP DATABASE stoxx_db
TO DISK = '/mnt/sqldata/backup/stoxx_db_full.bak'
WITH INIT, COMPRESSION, STATS=10;
\""
```

```text
19 percent processed.
38 percent processed.
42 percent processed.
54 percent processed.
60 percent processed.
72 percent processed.
81 percent processed.
90 percent processed.
100 percent processed.
Processed 576 pages for database 'stoxx_db', file 'stoxx_db_Primary' on file 1.
Processed 48 pages for database 'stoxx_db', file 'stoxx_db_Current_01' on file 1.
Processed 48 pages for database 'stoxx_db', file 'stoxx_db_Current_02' on file 1.
Processed 32 pages for database 'stoxx_db', file 'stoxx_db_Archive_01' on file 1.
Processed 2 pages for database 'stoxx_db', file 'stoxx_db_Log' on file 1.
BACKUP DATABASE successfully processed 706 pages in 0.334 seconds (16.502 MB/sec).
```

706 pages total (576 primary + 48+48 current + 32 archive + 2 log). The database contains only SQL Server system pages since no user data has been loaded — hence the small compressed size of 728 KB at 16.502 MB/sec.

#### Verify backup file and header

**When to run:** immediately after each backup to confirm the file was written and the backup set is readable.
**Trigger:** post-backup verification step in any backup procedure.
**Context:** `gcloud compute ssh --command`. `RESTORE HEADERONLY` is read-only — it reads the backup set metadata without restoring data. Returns one row per backup set in the file.
**Purpose:** confirm the backup file exists on disk and that SQL Server can read its header (BackupName, BackupType, Compressed).

*List the backup file and read its backup set header.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="
    echo '--- Backup file ---'
    ls -lh /mnt/sqldata/backup/
    echo '--- RESTORE HEADERONLY ---'
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C \
      -Q \"RESTORE HEADERONLY FROM DISK = '/mnt/sqldata/backup/stoxx_db_full.bak'\" \
      -s'|' 2>&1 | awk -F'|' '{print \$1\"|\"\$2\"|\"\$3\"|\"\$4\"|\"\$5}'
  "
```

```text
--- Backup file ---
total 728K
-rw-rw---- 1 mssql mssql 728K Apr 12 19:52 stoxx_db_full.bak

--- RESTORE HEADERONLY ---
BackupName              | BackupDescription | BackupType | ExpirationDate | Compressed
------------------------|-------------------|------------|----------------|----------
stoxx_db Full Backup    | NULL              | 1          | NULL           | 1
```

`BackupType = 1` is a full database backup. `Compressed = 1` confirms compression was applied. `ExpirationDate = NULL` means no expiration — the file will not be automatically overwritten by a new backup to the same media family without `WITH INIT`.

#### Restore to stoxx_db_restored

**When to run:** to test backup recoverability; to create a parallel copy of the database for testing or debugging.
**Trigger:** post-backup recoverability test; disaster recovery drill.
**Context:** `gcloud compute ssh --command` with `sqlcmd`. `RESTORE DATABASE` is state-changing — it creates new database files at the `MOVE` target paths. `WITH REPLACE` overwrites the target database if it already exists.
**Purpose:** restore `stoxx_db` backup to a new database `stoxx_db_restored` with all 5 files moved to distinct names to avoid conflicts with the source database files.

> [!info]- RESTORE DATABASE clause breakdown
>
> - `FROM DISK = '...'` — the backup file to restore from.
> - `WITH MOVE 'logical_name' TO 'new_path'` — required when restoring to a different database name; otherwise SQL Server tries to write to the same file paths as the original, which are already in use. One `MOVE` clause per file.
> - `STATS=10` — progress output at 10% intervals.
> - `REPLACE` — drop and recreate the target database if it exists. Safe to use when restoring to a test database name that may have been restored previously.

*Restore the full backup to `stoxx_db_restored` with all 5 files moved to distinct paths.*

```bash
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<password>' -C -Q \"
RESTORE DATABASE stoxx_db_restored
FROM DISK = '/mnt/sqldata/backup/stoxx_db_full.bak'
WITH
  MOVE 'stoxx_db_Primary'   TO '/mnt/sqldata/stoxx_db_restored_Primary.mdf',
  MOVE 'stoxx_db_Current_01' TO '/mnt/sqldata/stoxx_db_restored_Current_01.ndf',
  MOVE 'stoxx_db_Current_02' TO '/mnt/sqldata/stoxx_db_restored_Current_02.ndf',
  MOVE 'stoxx_db_Archive_01' TO '/mnt/sqldata/stoxx_db_restored_Archive_01.ndf',
  MOVE 'stoxx_db_Log'        TO '/mnt/sqllog/stoxx_db_restored_Log.ldf',
  STATS=10, REPLACE;
\""
```

```text
19 percent processed.
38 percent processed.
57 percent processed.
76 percent processed.
95 percent processed.
100 percent processed.
Processed 576 pages for database 'stoxx_db_restored', file 'stoxx_db_Primary' on file 1.
Processed 48 pages for database 'stoxx_db_restored', file 'stoxx_db_Current_01' on file 1.
Processed 48 pages for database 'stoxx_db_restored', file 'stoxx_db_Current_02' on file 1.
Processed 32 pages for database 'stoxx_db_restored', file 'stoxx_db_Archive_01' on file 1.
Processed 2 pages for database 'stoxx_db_restored', file 'stoxx_db_Log' on file 1.
RESTORE DATABASE successfully processed 706 pages in 1.346 seconds (4.094 MB/sec).
```

706 pages restored successfully. The same page count as the backup confirms restore fidelity. Throughput of 4.094 MB/sec (lower than backup's 16.502 MB/sec) reflects the overhead of creating and initializing new database files versus reading from an existing one.

## Provisioning the stoxx Database

The operational target on `stoxx-vm` is not `stoxx_db`. It is `stoxx`, carrying only the `bronze`, `silver`, and `gold` schemas from the local source database while preserving the VM split-file layout on `/mnt/sqldata` and `/mnt/sqllog`. This workflow creates a named sysadmin login, restores the local `stoxx` source backup into a temporary `stoxx_seed` database, runs the VM migration script from `/opt/stoxx/ddl/`, validates the final `stoxx` file layout and row counts, and then removes the seed database.

### Ubuntu | sysadmin and migration | provision bronze, silver, and gold

Run this workflow from an interactive shell on `stoxx-vm` reached via `gcloud compute ssh stoxx-vm --zone=europe-west1-b --tunnel-through-iap`. The procedure uses Linux's host-level password-reset path to recover `sa`, creates the named `dba_break_glass` sysadmin login, and then uses that named login for every restore, migration, validation, and backup command. The pre-existing `stoxx_db` database remains untouched by this workflow.

> [!warning] `set-sa-password` refuses to run while SQL Server is active
>
> On this Ubuntu 22.04 host and SQL Server 2022 build, `mssql-conf -n set-sa-password` exits immediately if `mssql-server` is still running.

> [!success] Stop the engine first, then restart it after the reset
>
> The safe recovery sequence is: stop `mssql-server`, reset `sa` with `MSSQL_SA_PASSWORD` in the process environment, write the generated secrets to a root-only file, then start the engine again and verify service health before attempting any T-SQL login.

> [!danger] Do not write generated credentials to instance metadata or the vault
>
> Instance metadata is readable from inside the VM, and markdown notes persist long after the emergency access need has passed. Either pattern turns a break-glass secret into a standing credential leak.

> [!success] Persist the generated credentials in a root-only file on the VM
>
> This pattern writes `SA_PWD`, `BREAK_GLASS_LOGIN`, and `BREAK_GLASS_PWD` to `/root/.stoxx_sql_login.env` under `umask 077`. That keeps the generated credentials available for the remainder of the provisioning workflow without exposing them through shell history, metadata, or documentation.

#### Reset the SA password and write a root-only credential file

**When to run:** when the original SQL admin password is unknown and no tested named sysadmin exists on the instance.
**Trigger:** failed authentication for `sa`, missing instance metadata for the original bootstrap password, or post-bootstrap drift where the only surviving admin path is host root.
**Context:** Ubuntu shell on the VM as `root`. State-changing. Requires stopping `mssql-server` first. The generated passwords are stored locally on the VM in `/root/.stoxx_sql_login.env`.
**Purpose:** recover SQL administrative access without rebuilding the VM and stage the generated credentials for the named login created in the next step.

*Stop the engine, generate fresh `sa` and break-glass passwords, write them to `/root/.stoxx_sql_login.env`, and run `mssql-conf -n set-sa-password`.*

```bash
sudo systemctl stop mssql-server

umask 077

SA_PWD=$(python3 - <<'PY'
import secrets
print("Sa!2026" + secrets.token_hex(10))
PY
)

BREAK_GLASS_PWD=$(python3 - <<'PY'
import secrets
print("Bg!2026" + secrets.token_hex(10))
PY
)

cat > /root/.stoxx_sql_login.env <<EOF
SA_PWD=$SA_PWD
BREAK_GLASS_LOGIN=dba_break_glass
BREAK_GLASS_PWD=$BREAK_GLASS_PWD
EOF

MSSQL_SA_PASSWORD="$SA_PWD" /opt/mssql/bin/mssql-conf -n set-sa-password
ls -l /root/.stoxx_sql_login.env
systemctl is-active mssql-server
```

```text
ForceFlush is enabled for this instance.
Failed to open password policy registry path. Using default password policy values.
BulkAdmin AllowedPathsList cleared (path filtering disabled)
ForceFlush feature is enabled for log durability.
Configuring SQL Server...
The system administrator password has been changed.
Please run 'sudo systemctl start mssql-server' to start SQL Server.
-rw------- 1 root root 113 Apr 13 12:54 /root/.stoxx_sql_login.env
inactive
```

The password reset completed successfully, the credential file was written with `0600` semantics, and the service remained stopped as expected. On this build, `mssql-conf` does not auto-start SQL Server after `set-sa-password`, so a manual `systemctl start` is required before any T-SQL login can succeed.

#### Restart SQL Server after the password reset

**When to run:** immediately after `set-sa-password` completes.
**Trigger:** the password reset command finishes with the engine still inactive.
**Context:** Ubuntu shell on the VM as `root`. State-changing at the service level but not at the database level. Read-only from SQL Server's metadata perspective once the service is back up.
**Purpose:** bring the database engine back online and confirm that the reset did not leave the service in a failed startup state.

*Start `mssql-server` again and inspect the first 12 lines of service status.*

```bash
sudo systemctl start mssql-server
sleep 8
sudo systemctl status mssql-server --no-pager | head -12
```

```text
● mssql-server.service - Microsoft SQL Server Database Engine
     Loaded: loaded (/lib/systemd/system/mssql-server.service; enabled; vendor preset: enabled)
     Active: active (running) since Mon 2026-04-13 12:55:10 UTC; 13s ago
       Docs: https://docs.microsoft.com/en-us/sql/linux
   Main PID: 19605 (sqlservr)
      Tasks: 151
     Memory: 642.0M
        CPU: 13.693s
     CGroup: /system.slice/mssql-server.service
             ├─19605 /opt/mssql/bin/sqlservr
             └─19608 /opt/mssql/bin/sqlservr
```

The engine returned to `active (running)` state cleanly, and the new PID pair confirms a fresh startup after the `sa` reset. Memory usage at 642 MB is a normal immediately-after-start footprint for this instance.

#### Create the named `dba_break_glass` sysadmin login

**When to run:** immediately after `sa` access has been restored.
**Trigger:** successful service restart and the need to move away from using `sa` for all subsequent administration.
**Context:** Ubuntu shell on the VM. State-changing T-SQL executed through `sqlcmd` using the freshly reset `sa` credential sourced from `/root/.stoxx_sql_login.env`.
**Purpose:** create a stable named sysadmin login, grant it `sysadmin`, and make the rest of the provisioning workflow independent of the default `sa` account.

*Create `dba_break_glass` if it does not already exist, add it to `sysadmin`, and list both admin logins with their role state.*

```bash
source /root/.stoxx_sql_login.env

cat > /tmp/create_break_glass.sql <<SQL
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'dba_break_glass')
BEGIN
    CREATE LOGIN [dba_break_glass]
        WITH PASSWORD = N'$BREAK_GLASS_PWD',
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF,
             DEFAULT_DATABASE = [master];
END;
IF IS_SRVROLEMEMBER(N'sysadmin', N'dba_break_glass') <> 1
BEGIN
    ALTER SERVER ROLE [sysadmin] ADD MEMBER [dba_break_glass];
END;
SELECT name, type_desc, is_disabled, IS_SRVROLEMEMBER(N'sysadmin', name) AS is_sysadmin
FROM sys.server_principals
WHERE name IN (N'sa', N'dba_break_glass')
ORDER BY name;
SQL

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$SA_PWD" -C -b -W -s "|" -h -1 \
  -i /tmp/create_break_glass.sql
```

```text
dba_break_glass|SQL_LOGIN|0|1
sa|SQL_LOGIN|0|1
```

Both logins are enabled (`is_disabled = 0`) and both are currently members of `sysadmin` (`is_sysadmin = 1`). That is the safe Linux pattern: create and test a named sysadmin first, then decide separately whether `sa` should later be disabled or renamed.

#### Verify the named sysadmin login directly

**When to run:** immediately after the named login is created and added to `sysadmin`.
**Trigger:** completion of the `CREATE LOGIN` / `ALTER SERVER ROLE` step.
**Context:** Ubuntu shell on the VM. Read-only T-SQL through `sqlcmd`, authenticated as the new named login.
**Purpose:** prove that the named login works before it is used for restore and migration operations.

*Connect as `dba_break_glass` and confirm the login name, `sysadmin` membership, and default database.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "SET NOCOUNT ON; SELECT ORIGINAL_LOGIN() AS login_name, IS_SRVROLEMEMBER(N'sysadmin') AS is_sysadmin, DB_NAME() AS current_db;"
```

```text
dba_break_glass|1|master
```

The session authenticated as `dba_break_glass`, inherited `sysadmin = 1`, and landed in `master` as expected from the login definition. From this point onward the provisioning workflow no longer depends on `sa`.

#### Inspect the instance before provisioning the new `stoxx` database

**When to run:** before restoring the source backup and before creating the final target database.
**Trigger:** successful break-glass login validation.
**Context:** Ubuntu shell on the VM. Read-only T-SQL executed as `dba_break_glass`.
**Purpose:** confirm the current database inventory and verify that `stoxx` does not already exist before the migration creates it.

*List every database on the instance before the `stoxx_seed` restore.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "SET NOCOUNT ON; SELECT name, state_desc, recovery_model_desc FROM sys.databases ORDER BY database_id;"
```

```text
master|ONLINE|SIMPLE
tempdb|ONLINE|SIMPLE
model|ONLINE|FULL
msdb|ONLINE|SIMPLE
stoxx_db|ONLINE|FULL
```

Before the provisioning run, the instance contains only the system databases plus the earlier `stoxx_db` lab database. There is no existing `stoxx` target yet, so the migration can create it side-by-side without overwriting another database.

#### Verify the staged `stoxx` source backup

**When to run:** before any restore from the local source backup.
**Trigger:** the `stoxx` backup file has been copied to `/mnt/sqldata/backup/incoming/`.
**Context:** Ubuntu shell on the VM. Read-only restore metadata operation through `sqlcmd`.
**Purpose:** prove that SQL Server can read the staged backup before spending time on the full restore.

*Run `RESTORE VERIFYONLY` against the staged local `stoxx` backup.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "RESTORE VERIFYONLY FROM DISK = '/mnt/sqldata/backup/incoming/stoxx_local_20260413_143719.bak';"
```

```text
The backup set on file 1 is valid.
```

The staged backup is readable and structurally valid. This is the minimum recoverability check required before the side-by-side `stoxx_seed` restore.

#### Inspect the logical files inside the staged `stoxx` backup

**When to run:** immediately after `RESTORE VERIFYONLY` succeeds and before writing the `MOVE` clauses for the seed restore.
**Trigger:** recoverability has been confirmed and the restore path is about to be executed.
**Context:** Ubuntu shell on the VM. Read-only restore metadata inspection through `sqlcmd`.
**Purpose:** retrieve the logical file names that must be referenced in the `RESTORE DATABASE ... WITH MOVE ...` statement.

*Run `RESTORE FILELISTONLY` against the staged local `stoxx` backup.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "RESTORE FILELISTONLY FROM DISK = '/mnt/sqldata/backup/incoming/stoxx_local_20260413_143719.bak';"
```

```text
stoxx|/var/opt/mssql/data/stoxx.mdf|D|PRIMARY|746586112|35184372080640|1|0|0|76D72DD3-4E60-40AC-8234-6B36ECBBD9F3|0|0|57409536|4096|1|NULL|397000001744800001|CD1461BC-5D79-4AF8-AAE8-A411A130329A|0|1|NULL|NULL
stoxx_log|/var/opt/mssql/data/stoxx_log.ldf|L|NULL|1082130432|2199023255552|2|0|0|BAA74412-3CC0-4B9F-BCDC-919F176B37E7|0|0|0|4096|0|NULL|0|00000000-0000-0000-0000-000000000000|0|1|NULL|NULL
demo_stc_xtp|/var/opt/mssql/data/demo_stc_xtp|S|demo_stc_xtp_fg|0|0|65537|397000006737600003|0|FAC2827A-4A1A-492E-A129-F3F23BDC0C93|0|0|985399296|4096|2|NULL|0|00000000-0000-0000-0000-000000000000|0|1|NULL|NULL

(3 rows affected)
```

Three logical files matter to the restore: `stoxx` (primary data), `stoxx_log` (transaction log), and `demo_stc_xtp` (the memory-optimized filegroup container from the source database). All three names must appear in the `MOVE` list when the backup is restored as `stoxx_seed`.

#### Restore the staged backup into `stoxx_seed`

**When to run:** after the backup file has passed `VERIFYONLY` and its logical file names are known.
**Trigger:** the instance is ready to materialize a temporary full-fidelity source database on the VM.
**Context:** Ubuntu shell on the VM. State-changing restore through `sqlcmd` as `dba_break_glass`. The command drops any stale `stoxx_seed` copy first and removes the previous XTP directory if present.
**Purpose:** create a temporary on-VM source database that exactly matches the local `stoxx` backup, so the final migration script can copy only `bronze`, `silver`, and `gold` into the published VM `stoxx`.

> [!info]- Why `stoxx_seed` exists
>
> The source backup contains `bronze`, `silver`, `gold`, and `demo_stc`. Restoring it directly as the final target would bring `demo_stc` into the published VM database and would also preserve the source file layout. The seed pattern restores the full backup under a temporary name, then rebuilds the final `stoxx` in the VM split-file layout from that seed while intentionally leaving `demo_stc` behind.

*Drop any stale `stoxx_seed`, clear the old XTP directory, and restore the staged backup as `stoxx_seed`.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "IF DB_ID(N'stoxx_seed') IS NOT NULL BEGIN ALTER DATABASE [stoxx_seed] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [stoxx_seed]; END;"

rm -rf /mnt/sqldata/stoxx_seed_xtp

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "
RESTORE DATABASE [stoxx_seed]
FROM DISK = '/mnt/sqldata/backup/incoming/stoxx_local_20260413_143719.bak'
WITH
  MOVE 'stoxx'        TO '/mnt/sqldata/stoxx_seed_Primary.mdf',
  MOVE 'stoxx_log'    TO '/mnt/sqllog/stoxx_seed_Log.ldf',
  MOVE 'demo_stc_xtp' TO '/mnt/sqldata/stoxx_seed_xtp',
  REPLACE,
  RECOVERY,
  STATS = 10;"
```

```text
10 percent processed.
Processed 7024 pages for database 'stoxx_seed', file 'stoxx' on file 1.
Processed 12743 pages for database 'stoxx_seed', file 'stoxx_log' on file 1.
Processed 1 pages for database 'stoxx_seed', file 'demo_stc_xtp' on file 1.
100 percent processed.
RESTORE DATABASE successfully processed 19768 pages in 5.805 seconds (26.604 MB/sec).
```

The full local `stoxx` backup is now materialized on the VM as `stoxx_seed`. The restore touched 19,768 pages across the primary data file, log file, and XTP container, giving the migration script a complete local source database to read from.

#### Run the bronze/silver/gold migration script to build the final VM `stoxx`

**When to run:** immediately after `stoxx_seed` is online and before any application traffic points at the VM `stoxx` database.
**Trigger:** successful seed restore and the presence of `/opt/stoxx/ddl/stoxx_bsg_vm_migration.sql` on the VM.
**Context:** Ubuntu shell on the VM. State-changing `sqlcmd -i` execution using `-v` sqlcmd variables to parameterize the source database, target database, and file locations.
**Purpose:** create a new split-layout `stoxx` database on the VM, copy only `bronze`, `silver`, and `gold` from `stoxx_seed`, recreate their defaults, primary keys, and nonclustered indexes, and validate per-table row counts.

*Run the staged migration script against `stoxx_seed` and publish the final VM `stoxx` to `/mnt/sqldata` and `/mnt/sqllog`.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -v SourceDb="stoxx_seed" TargetDb="stoxx" DataDir="/mnt/sqldata" LogDir="/mnt/sqllog" \
     PrimarySizeMB="256" CurrentSizeMB="512" ArchiveSizeMB="256" LogSizeMB="256" \
  -i /opt/stoxx/ddl/stoxx_bsg_vm_migration.sql
```

```text
Changed database context to 'master'.
The filegroup property 'DEFAULT' has been set.
bronze|dim_country|212|212
bronze|dim_index|4|4
bronze|eurostoxx50_ohlcv|50|50
bronze|index_dim|169|169
bronze|oil20_ohlcv|19|19
bronze|pulse|40|40
bronze|pulse_tickers|40|40
bronze|signals_daily|169|169
bronze|signals_quarterly|169|169
bronze|stoxxasia50_ohlcv|50|50
bronze|stoxxusa50_ohlcv|50|50
bronze|trading_calendar|29335|29335
gold|index_performance|5351|5351
gold|scores_daily|635|635
gold|scores_quarterly|176|176
silver|eurostoxx50_ohlcv|67155|67155
silver|index_dim|169|169
silver|oil20_ohlcv|25080|25080
silver|signals_daily|635|635
silver|signals_quarterly|188|188
silver|stoxxasia50_ohlcv|64875|64875
silver|stoxxusa50_ohlcv|66000|66000
Migration complete. The target database stoxx now contains bronze/silver/gold from stoxx_seed with VM split-file layout.
```

Every row-count pair matched exactly, so the published VM `stoxx` database is a complete bronze/silver/gold copy of the seed source. `demo_stc` never entered the target because the migration script reads only those three schemas.

#### Validate the final `stoxx` file layout

**When to run:** immediately after the migration script completes successfully.
**Trigger:** creation of the final VM `stoxx` database.
**Context:** Ubuntu shell on the VM. Read-only T-SQL against `sys.master_files`.
**Purpose:** confirm that the target database really uses the VM split-file layout rather than the original source layout from the backup.

*List the logical files and physical paths for the final VM `stoxx` database.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "SET NOCOUNT ON; SELECT DB_NAME(database_id) AS db_name, name AS logical_name, type_desc, physical_name FROM sys.master_files WHERE DB_NAME(database_id) = N'stoxx' ORDER BY file_id;"
```

```text
stoxx|stoxx_Primary|ROWS|/mnt/sqldata/stoxx_Primary.mdf
stoxx|stoxx_Log|LOG|/mnt/sqllog/stoxx_Log.ldf
stoxx|stoxx_Current_01|ROWS|/mnt/sqldata/stoxx_Current_01.ndf
stoxx|stoxx_Current_02|ROWS|/mnt/sqldata/stoxx_Current_02.ndf
stoxx|stoxx_Archive_01|ROWS|/mnt/sqldata/stoxx_Archive_01.ndf
```

The file placement is correct for the VM design: one primary file, two `FG_Current` files, one archive file, and a separate log file on `/mnt/sqllog`. This is the only intentional structural difference from the local `stoxx` source database.

#### Validate the published schema inventory

**When to run:** after file-layout validation and before any application or demo process targets the new database.
**Trigger:** successful migration script completion.
**Context:** Ubuntu shell on the VM. Read-only T-SQL against the final `stoxx` database.
**Purpose:** verify that only the intended schemas were published into the final target.

*Count the tables per schema in the final VM `stoxx` database.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "SET NOCOUNT ON; SELECT s.name AS schema_name, COUNT(*) AS table_count FROM stoxx.sys.tables t JOIN stoxx.sys.schemas s ON s.schema_id = t.schema_id GROUP BY s.name ORDER BY s.name;"
```

```text
bronze|12
gold|3
silver|7
```

The published target contains exactly the three medallion schemas and no `demo_stc` objects. Table counts match the local source: 12 bronze, 7 silver, and 3 gold.

#### Validate the published row counts

**When to run:** after schema inventory validation and before taking the first on-VM backup of the published database.
**Trigger:** confirmation that only `bronze`, `silver`, and `gold` exist in the final target.
**Context:** Ubuntu shell on the VM. Read-only T-SQL against the final `stoxx` database, authenticated as `dba_break_glass`.
**Purpose:** confirm that every published table contains the same current data volume as the local source after the bronze/silver/gold-only migration.

*Count the rows in every published `bronze`, `silver`, and `gold` table in the final VM `stoxx` database.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "
SET NOCOUNT ON;
SELECT N'bronze', N'dim_country', COUNT_BIG(*) FROM stoxx.bronze.dim_country
UNION ALL SELECT N'bronze', N'dim_index', COUNT_BIG(*) FROM stoxx.bronze.dim_index
UNION ALL SELECT N'bronze', N'eurostoxx50_ohlcv', COUNT_BIG(*) FROM stoxx.bronze.eurostoxx50_ohlcv
UNION ALL SELECT N'bronze', N'index_dim', COUNT_BIG(*) FROM stoxx.bronze.index_dim
UNION ALL SELECT N'bronze', N'oil20_ohlcv', COUNT_BIG(*) FROM stoxx.bronze.oil20_ohlcv
UNION ALL SELECT N'bronze', N'pulse', COUNT_BIG(*) FROM stoxx.bronze.pulse
UNION ALL SELECT N'bronze', N'pulse_tickers', COUNT_BIG(*) FROM stoxx.bronze.pulse_tickers
UNION ALL SELECT N'bronze', N'signals_daily', COUNT_BIG(*) FROM stoxx.bronze.signals_daily
UNION ALL SELECT N'bronze', N'signals_quarterly', COUNT_BIG(*) FROM stoxx.bronze.signals_quarterly
UNION ALL SELECT N'bronze', N'stoxxasia50_ohlcv', COUNT_BIG(*) FROM stoxx.bronze.stoxxasia50_ohlcv
UNION ALL SELECT N'bronze', N'stoxxusa50_ohlcv', COUNT_BIG(*) FROM stoxx.bronze.stoxxusa50_ohlcv
UNION ALL SELECT N'bronze', N'trading_calendar', COUNT_BIG(*) FROM stoxx.bronze.trading_calendar
UNION ALL SELECT N'gold', N'index_performance', COUNT_BIG(*) FROM stoxx.gold.index_performance
UNION ALL SELECT N'gold', N'scores_daily', COUNT_BIG(*) FROM stoxx.gold.scores_daily
UNION ALL SELECT N'gold', N'scores_quarterly', COUNT_BIG(*) FROM stoxx.gold.scores_quarterly
UNION ALL SELECT N'silver', N'eurostoxx50_ohlcv', COUNT_BIG(*) FROM stoxx.silver.eurostoxx50_ohlcv
UNION ALL SELECT N'silver', N'index_dim', COUNT_BIG(*) FROM stoxx.silver.index_dim
UNION ALL SELECT N'silver', N'oil20_ohlcv', COUNT_BIG(*) FROM stoxx.silver.oil20_ohlcv
UNION ALL SELECT N'silver', N'signals_daily', COUNT_BIG(*) FROM stoxx.silver.signals_daily
UNION ALL SELECT N'silver', N'signals_quarterly', COUNT_BIG(*) FROM stoxx.silver.signals_quarterly
UNION ALL SELECT N'silver', N'stoxxasia50_ohlcv', COUNT_BIG(*) FROM stoxx.silver.stoxxasia50_ohlcv
UNION ALL SELECT N'silver', N'stoxxusa50_ohlcv', COUNT_BIG(*) FROM stoxx.silver.stoxxusa50_ohlcv
ORDER BY 1, 2;"
```

```text
bronze|dim_country|212
bronze|dim_index|4
bronze|eurostoxx50_ohlcv|50
bronze|index_dim|169
bronze|oil20_ohlcv|19
bronze|pulse|40
bronze|pulse_tickers|40
bronze|signals_daily|169
bronze|signals_quarterly|169
bronze|stoxxasia50_ohlcv|50
bronze|stoxxusa50_ohlcv|50
bronze|trading_calendar|29335
gold|index_performance|5351
gold|scores_daily|635
gold|scores_quarterly|176
silver|eurostoxx50_ohlcv|67155
silver|index_dim|169
silver|oil20_ohlcv|25080
silver|signals_daily|635
silver|signals_quarterly|188
silver|stoxxasia50_ohlcv|64875
silver|stoxxusa50_ohlcv|66000
```

The published table counts match the local source across all 22 target tables. In aggregate, the VM `stoxx` database now exposes 260,571 rows across the three medallion schemas, with the source-only `demo_stc` layer excluded by design.

#### Back up the provisioned VM `stoxx` database

**When to run:** immediately after the target database has passed row-count and schema validation.
**Trigger:** successful publication of the final `stoxx` database.
**Context:** Ubuntu shell on the VM. State-changing `BACKUP DATABASE` command executed as `dba_break_glass`.
**Purpose:** establish the first on-VM recoverability artifact for the published `stoxx` database before the temporary seed database is dropped.

*Create a full compressed backup of the provisioned VM `stoxx` database.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "BACKUP DATABASE [stoxx] TO DISK = '/mnt/sqldata/backup/stoxx_post_cutover_full.bak' WITH INIT, COMPRESSION, CHECKSUM, STATS = 10;"
```

```text
10 percent processed.
21 percent processed.
30 percent processed.
42 percent processed.
51 percent processed.
60 percent processed.
70 percent processed.
81 percent processed.
90 percent processed.
100 percent processed.
Processed 552 pages for database 'stoxx', file 'stoxx_Primary' on file 1.
Processed 2232 pages for database 'stoxx', file 'stoxx_Current_01' on file 1.
Processed 2192 pages for database 'stoxx', file 'stoxx_Current_02' on file 1.
Processed 48 pages for database 'stoxx', file 'stoxx_Archive_01' on file 1.
Processed 2 pages for database 'stoxx', file 'stoxx_Log' on file 1.
BACKUP DATABASE successfully processed 5026 pages in 0.447 seconds (87.833 MB/sec).
```

The final `stoxx` backup completed successfully and is materially smaller than the restored seed because only the published medallion schemas exist in the target. The resulting file on disk is 11 MB:

```bash
ls -lh /mnt/sqldata/backup/stoxx_post_cutover_full.bak
```

```text
-rw-rw---- 1 mssql mssql 11M Apr 13 12:58 /mnt/sqldata/backup/stoxx_post_cutover_full.bak
```

#### Drop the temporary `stoxx_seed` database and confirm the final inventory

**When to run:** only after the published `stoxx` database has been backed up and validated.
**Trigger:** successful creation of `stoxx_post_cutover_full.bak`.
**Context:** Ubuntu shell on the VM. State-changing `DROP DATABASE` cleanup followed by a read-only inventory query.
**Purpose:** remove the temporary full-source copy so only the published target remains, then confirm the final instance database list.

*Drop `stoxx_seed`, remove its XTP directory, and list the final database inventory on the VM.*

```bash
source /root/.stoxx_sql_login.env

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "IF DB_ID(N'stoxx_seed') IS NOT NULL BEGIN ALTER DATABASE [stoxx_seed] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [stoxx_seed]; END;"

rm -rf /mnt/sqldata/stoxx_seed_xtp

/opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U dba_break_glass -P "$BREAK_GLASS_PWD" -C -b -W -s "|" -h -1 \
  -Q "SET NOCOUNT ON; SELECT name, state_desc, recovery_model_desc FROM sys.databases ORDER BY database_id;"
```

```text
master|ONLINE|SIMPLE
tempdb|ONLINE|SIMPLE
model|ONLINE|FULL
msdb|ONLINE|SIMPLE
stoxx_db|ONLINE|FULL
stoxx|ONLINE|FULL
```

The temporary seed copy is gone. The final instance now contains the published VM `stoxx` database alongside the earlier `stoxx_db` lab copy. If the legacy `stoxx_db` should be retired after cutover, back it up first and drop it in a separate maintenance step rather than mixing that destructive cleanup into the provisioning run.

| Flag | Syntax | Description |
|---|---|---|
| `-n` | `mssql-conf -n set-sa-password` | Run `mssql-conf` non-interactively. Required when the new `sa` password is supplied through `MSSQL_SA_PASSWORD`. |
| `-S` | `sqlcmd -S localhost` | Target SQL Server host and optional `,port`. |
| `-U` | `sqlcmd -U dba_break_glass` | SQL login name. |
| `-P` | `sqlcmd -P "$BREAK_GLASS_PWD"` | SQL login password. |
| `-C` | `sqlcmd -C` | Trust the server certificate for local TLS connections. |
| `-b` | `sqlcmd -b` | Exit with a non-zero status on T-SQL errors so shell automation fails fast. |
| `-W` | `sqlcmd -W` | Remove trailing spaces from output. Useful when capturing pipe-delimited tables. |
| `-s` | `sqlcmd -s "|"` | Set the column separator. `|` is convenient for markdown conversion and human scanning. |
| `-h` | `sqlcmd -h -1` | Suppress column headers in output. |
| `-Q` | `sqlcmd -Q "..."` | Execute an inline query and exit. |
| `-i` | `sqlcmd -i /opt/stoxx/ddl/stoxx_bsg_vm_migration.sql` | Execute a SQL script from a file. |
| `-v` | `sqlcmd -v SourceDb="stoxx_seed"` | Set a sqlcmd variable used inside the script via `$(VariableName)` substitution. |

## Startup Script

The startup script is a bash script attached to `stoxx-vm`'s instance metadata under the `startup-script` key. The guest agent (`google-guest-agent`) executes it on every VM boot, before systemd's multi-user target is reached. The script checks that all three disk mount points are present before attempting to start SQL Server, preventing a state where SQL Server starts with missing disk mounts and creates data files in the wrong location.

### GCP | startup script | attach to instance

#### Attach startup script via instance metadata

**When to run:** once after the VM is fully configured, as the final setup step.
**Trigger:** initial deployment; also update after any change to the startup logic.
**Context:** `gcloud compute instances add-metadata` from the local workstation. The script file is read from the local path and stored in the instance metadata. The guest agent retrieves and executes it on the next boot.
**Purpose:** ensure SQL Server starts automatically and safely on every VM boot, with mount point verification before service start.

The startup script checks each required mount with `mountpoint -q` before starting `mssql-server`, and logs all actions to syslog via `logger`. If any mount is missing, the script exits without starting SQL Server, preventing silent data corruption from missing disks.

*Attach the startup script to `stoxx-vm` instance metadata.*

```bash
gcloud compute instances add-metadata stoxx-vm \
  --project=bq-wh-nb \
  --zone=europe-west1-b \
  --metadata-from-file=startup-script="C:/Users/aperi/AppData/Local/Temp/startup-sql.sh"
```

```text
Updated [https://www.googleapis.com/compute/v1/projects/bq-wh-nb/zones/europe-west1-b/instances/stoxx-vm].
```

#### Verify startup script in instance metadata

**When to run:** immediately after attaching, to confirm the correct script content is stored.
**Trigger:** post-attach verification; also to confirm after any metadata update.
**Context:** `gcloud compute instances describe` with `--format="yaml(metadata.items)"`. Read-only.
**Purpose:** confirm the startup-script metadata key contains the expected bash script.

*Describe the instance metadata to verify the startup script is stored correctly.*

```bash
gcloud compute instances describe stoxx-vm \
  --project=bq-wh-nb \
  --zone=europe-west1-b \
  --format="yaml(metadata.items)"
```

```text
metadata:
  items:
  - key: enable-oslogin
    value: 'true'
  - key: startup-script
    value: |
      #!/bin/bash
      # SQL Server startup verification script for stoxx-vm
      # Checks required mounts, starts SQL Server if not running, logs to syslog.

      LOG_TAG="stoxx-sql-startup"
      REQUIRED_MOUNTS=("/mnt/sqldata" "/mnt/sqllog" "/mnt/sqltempdb")

      for mount in "${REQUIRED_MOUNTS[@]}"; do
          if ! mountpoint -q "$mount"; then
              logger -t "$LOG_TAG" "ERROR: Required mount $mount not found. SQL Server will not start."
              exit 1
          fi
          logger -t "$LOG_TAG" "Mount OK: $mount"
      done
```

The `startup-script` key is present and contains the correct script. On the next VM boot, the script will verify all three mounts and start `mssql-server` if it is not already active.

*The full startup script attached to the instance:*

```bash
#!/bin/bash
# SQL Server startup verification script for stoxx-vm
# Checks required mounts, starts SQL Server if not running, logs to syslog.

LOG_TAG="stoxx-sql-startup"
REQUIRED_MOUNTS=("/mnt/sqldata" "/mnt/sqllog" "/mnt/sqltempdb")

for mount in "${REQUIRED_MOUNTS[@]}"; do
    if ! mountpoint -q "$mount"; then
        logger -t "$LOG_TAG" "ERROR: Required mount $mount not found. SQL Server will not start."
        exit 1
    fi
    logger -t "$LOG_TAG" "Mount OK: $mount"
done

if ! systemctl is-active --quiet mssql-server; then
    logger -t "$LOG_TAG" "mssql-server not running. Starting..."
    systemctl start mssql-server
    sleep 5
    if systemctl is-active --quiet mssql-server; then
        logger -t "$LOG_TAG" "mssql-server started successfully."
    else
        logger -t "$LOG_TAG" "ERROR: Failed to start mssql-server. Check journalctl -u mssql-server."
        exit 1
    fi
else
    logger -t "$LOG_TAG" "mssql-server already running (PID $(systemctl show mssql-server --property=MainPID --value))."
fi
```

To view startup script execution logs on the VM: `journalctl -t stoxx-sql-startup` or `grep stoxx-sql-startup /var/log/syslog`.

| Flag | Syntax | Description |
|---|---|---|
| `add-metadata` | `instances add-metadata <vm> --metadata=key=value` | Set a metadata key inline. |
| `--metadata-from-file` | `--metadata-from-file=startup-script=path/to/script.sh` | Read the metadata value from a local file. |
| `--metadata` | `--metadata=startup-script-url=gs://bucket/script.sh` | Reference a script stored in Cloud Storage. |
| `remove-metadata` | `instances remove-metadata <vm> --keys=startup-script` | Remove the startup script. |

> [!example]- Terraform equivalent
>
> ```hcl
> resource "google_compute_instance" "stoxx_vm" {
>   # ... (existing VM config from page 01) ...
>   metadata = {
>     enable-oslogin = "true"
>     startup-script = file("${path.module}/startup-sql.sh")
>   }
> }
> ```

## Full Teardown

> [!todo] Ordered teardown sequence
>
> 1. Stop SQL Server on the VM to flush all dirty pages and close all database files.
> 2. Stop the VM to allow clean disk detachment.
> 3. Detach each data disk before deleting it — GCE requires disks to be detached from all VMs before deletion.
> 4. Delete the data disks.
> 5. Delete any disk snapshots created by snapshot policies.
> 6. Delete snapshot policies.
> 7. Delete firewall rules.
> 8. Delete the VM (`--delete-disks=boot` also removes the boot disk).

```bash
# 1. Stop SQL Server
gcloud compute ssh stoxx-vm --tunnel-through-iap \
  --zone=europe-west1-b --project=bq-wh-nb \
  --command="sudo systemctl stop mssql-server && echo 'SQL Server stopped'"

# 2. Stop the VM
gcloud compute instances stop stoxx-vm \
  --zone=europe-west1-b --project=bq-wh-nb

# 3. Detach data disks
gcloud compute instances detach-disk stoxx-vm \
  --disk=stoxx-data --zone=europe-west1-b --project=bq-wh-nb
gcloud compute instances detach-disk stoxx-vm \
  --disk=stoxx-log --zone=europe-west1-b --project=bq-wh-nb
gcloud compute instances detach-disk stoxx-vm \
  --disk=stoxx-tempdb --zone=europe-west1-b --project=bq-wh-nb

# 4. Delete data disks
gcloud compute disks delete stoxx-data stoxx-log stoxx-tempdb \
  --zone=europe-west1-b --project=bq-wh-nb --quiet

# 5-6. Delete snapshots and snapshot policies (if created in page 03)
# gcloud compute snapshots delete <snapshot-name> --project=bq-wh-nb --quiet
# gcloud compute resource-policies delete stoxx-snapshot-policy \
#   --region=europe-west1 --project=bq-wh-nb --quiet

# 7. Delete firewall rules
gcloud compute firewall-rules delete allow-sql-server-iap allow-sql-internal \
  --project=bq-wh-nb --quiet

# 8. Delete the VM (also deletes the boot disk)
gcloud compute instances delete stoxx-vm \
  --zone=europe-west1-b --project=bq-wh-nb \
  --delete-disks=boot --quiet
```

> [!example]- Terraform equivalent — teardown
>
> ```bash
> terraform destroy -auto-approve
> ```
>
> Terraform's destroy plan covers all `google_compute_instance`, `google_compute_disk`, `google_compute_firewall`, `google_compute_router`, and `google_compute_router_nat` resources defined in the configuration. Resources not managed by Terraform (e.g., manually created firewall rules) must be deleted separately with `gcloud`.

## Cost Estimate

Monthly cost breakdown for the `stoxx-vm` SQL Server deployment in `europe-west1`. Costs are based on GCP published pricing (on-demand, no committed use discount).

| Resource | Type | Size / Spec | Approx. Monthly Cost |
|---|---|---|---|
| stoxx-vm | e2-medium | 2 vCPU, 4 GB RAM | ~$26 |
| stoxx-boot | pd-balanced | 50 GB | ~$5.50 |
| stoxx-data | pd-ssd | 100 GB | ~$18.70 |
| stoxx-log | pd-ssd | 20 GB | ~$3.74 |
| stoxx-tempdb | pd-ssd | 20 GB | ~$3.74 |
| Cloud NAT | stoxx-nat | ~1 GB/month egress | ~$0.05 |
| Snapshots | multi-regional | ~150 GB estimated | ~$3.90 |
| **Total** | | | **~$62** |

> [!tip] Cost optimization: scheduled start/stop
>
> SQL Server VMs do not need to run outside business hours for development and testing workloads. A scheduled stop at 21:00 and start at 07:00 Mon–Fri (Europe/Paris) reduces VM compute hours from 730/month to ~260/month — a saving of ~64% on compute. Disk costs are unaffected (persistent disks are billed regardless of VM state). With scheduled stop/start (from page 01), total monthly cost drops to approximately **~$37**.
>
> For production workloads requiring 24/7 availability, a 1-year committed use discount on the VM reduces compute cost by ~37%.
>
> **Cloud SQL for SQL Server comparison:** A Cloud SQL SQL Server 2022 Standard instance with 2 vCPU / 7.5 GB RAM in europe-west1 costs approximately $285/month (on-demand), including managed HA, automated backups, and maintenance. The self-managed GCE approach at ~$62/month trades operational simplicity for cost savings and full configuration control.

## Related

- [01 — VM Lifecycle](https://alp78.github.io/elysium/Elysium/06-GCP/02-Compute/01-vm-lifecycle) — VM creation, machine type selection, scheduled start/stop
- [02 — VM SSH and File Transfer](https://alp78.github.io/elysium/Elysium/06-GCP/02-Compute/02-vm-ssh-and-file-transfer) — IAP SSH access, SCP, OS Login configuration
- [03 — Disks and Snapshots](https://alp78.github.io/elysium/Elysium/06-GCP/02-Compute/03-disks-and-snapshots) — disk creation, formatting, mounting, snapshot policies
- [04-SQL-Server / 01 — Database Creation and File Layout](https://alp78.github.io/elysium/Elysium/04-SQL-Server/02-Database-Design/01-database-creation-and-file-layout) — the Docker-based `stoxx_db` reference layout this page replicates
- [04-SQL-Server / 01 — Server Configuration](https://alp78.github.io/elysium/Elysium/04-SQL-Server/01-Server-Operations/01-server-configuration) — SQL Server configuration reference (sp_configure, mssql-conf options)

## References

- [SQL Server on Linux documentation](https://learn.microsoft.com/en-us/sql/linux/)
- [Install SQL Server 2022 on Ubuntu](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-ubuntu)
- [Configure SQL Server on Linux with mssql-conf](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-configure-mssql-conf)
- [Compute Engine persistent disk performance](https://cloud.google.com/compute/docs/disks/performance)
- [IAP TCP forwarding](https://cloud.google.com/iap/docs/using-tcp-forwarding)
- [SQL Server on GCE best practices](https://cloud.google.com/compute/docs/instances/sql-server/best-practices)
