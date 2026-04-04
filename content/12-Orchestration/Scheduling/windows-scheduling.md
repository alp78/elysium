---
tags: [orchestration, scheduling, task-scheduler]
aliases:
  - Task Scheduler
  - schtasks
  - scheduled task
  - Windows scheduling
  - ScheduledJob
  - Register-ScheduledTask
description: "Exhaustive reference for scheduling tasks on Windows using schtasks.exe, the PowerShell ScheduledTasks module, and PSScheduledJob. Covers all trigger types, data engineering patterns (SSIS, sqlcmd, Python pipelines), event-based triggers, error notification, and a comparison with Linux cron."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Windows Task Scheduling — Complete Reference

> [!quote]
> "The first rule of any technology used in a business is that automation applied to an efficient operation will magnify the efficiency. The second is that automation applied to an inefficient operation will magnify the inefficiency."
>
> — **Bill Gates**

Windows task scheduling is the platform-native mechanism for running scripts, programs, and pipelines on a schedule. It encompasses three overlapping tools: **schtasks.exe** (legacy CLI), the **PowerShell ScheduledTasks module** (modern, object-oriented wrapper over the Task Scheduler COM API), and **PSScheduledJob** (PowerShell-centric jobs with native output streaming). This note covers all three in depth, with data engineering patterns for SSIS, sqlcmd, and Python pipelines, event-based triggers, and a mapping to Linux cron equivalents.

---

### Windows Task Scheduler Core Concepts

Task Scheduler (the Windows service `Schedule`) stores tasks as XML files under `C:\Windows\System32\Tasks\`. Each task contains four components:

| Component | Purpose |
|-----------|---------|
| **Trigger** | When the task fires (schedule, event, logon, idle) |
| **Action** | What to execute (program, script, COM handler, email, message) |
| **Condition** | Pre-conditions that must hold for the task to run |
| **Settings** | Behavior rules (retries, timeouts, multi-instance policy) |

> [!info] Task XML Location
> Tasks created by users live under `C:\Windows\System32\Tasks\` and can be exported/imported via `schtasks /query /xml` or the GUI's Export/Import commands. Storing these XML files in source control is a valid infrastructure-as-code approach for Windows schedulers.

---

## schtasks.exe — Full Reference

`schtasks.exe` is the built-in command-line interface to Task Scheduler, available on every Windows version without additional modules. It covers the full CRUD lifecycle and is useful in cmd scripts, batch files, and contexts where PowerShell is restricted.

### Verbs

| Verb | Action |
|------|--------|
| `/create` | Create a new scheduled task |
| `/query` | List tasks and their status |
| `/change` | Modify an existing task |
| `/delete` | Remove a task |
| `/run` | Trigger a task immediately |
| `/end` | Terminate a running task instance |
| `/showsid` | Display the SID for a task account |

### Query — Inspect Existing Tasks

#### List all tasks on the local machine in table format
```cmd
schtasks /query /fo TABLE /v
```

#### List all tasks in CSV format (easier to parse in scripts)
```cmd
schtasks /query /fo CSV /v > tasks-export.csv
```

#### Export a specific task as XML (for source control)
```cmd
schtasks /query /tn "BackupDB" /xml > BackupDB.xml
```

#### Query tasks on a remote machine
```cmd
schtasks /query /s SQLSERVER01 /u DOMAIN\Admin /p Password /fo TABLE
```

### Create — All Trigger Types

Every `/create` call requires at minimum: `/sc` (schedule type), `/tn` (task name), `/tr` (task run — the program or script to execute).

#### MINUTE — run every N minutes
```cmd
:: Run every 15 minutes, indefinitely
schtasks /create /sc MINUTE /mo 15 /tn "Poll-API" /tr "C:\Scripts\poll_api.py" /f
```

#### HOURLY — run every N hours
```cmd
:: Run once per hour starting at :30
schtasks /create /sc HOURLY /mo 1 /st 00:30 /tn "Hourly-ETL" /tr "C:\Scripts\run_etl.bat" /f
```

#### DAILY — run once a day at a fixed time
```cmd
:: Run every day at 02:00 AM as a service account, with highest privileges
schtasks /create ^
  /sc DAILY ^
  /tn "BackupDB" ^
  /tr "\"C:\Program Files\Scripts\backup_db.ps1\"" ^
  /st 02:00 ^
  /ru "DOMAIN\svc-etl" ^
  /rp "ServiceAccountPassword" ^
  /rl HIGHEST ^
  /f
```

> [!warning] Quoting Paths with Spaces
> When the script path contains spaces, wrap the entire path in escaped quotes inside the `/tr` value: `/tr "\"C:\My Scripts\run.ps1\""`. Without this, Task Scheduler truncates the path at the first space.

> [!success] Fix: store scripts in paths without spaces, or always use escaped quotes
> Place pipeline scripts under `C:\Scripts\` or `C:\Pipelines\` (no spaces) to avoid quoting issues entirely. When spaces are unavoidable, construct the `/tr` value as `"/tr \"\"C:\My Scripts\run.ps1\"\""`. With the PowerShell module, set `-Execute` and `-Argument` as separate parameters — spaces in the `-Execute` path are handled correctly by `New-ScheduledTaskAction`.

#### WEEKLY — run on specific days
```cmd
:: Every Monday and Wednesday at 06:00
schtasks /create ^
  /sc WEEKLY /d MON,WED /st 06:00 ^
  /tn "Weekly-Report" ^
  /tr "powershell.exe -ExecutionPolicy Bypass -File C:\Scripts\report.ps1" ^
  /ru SYSTEM /f
```

#### MONTHLY — run on specific day of month
```cmd
:: 1st day of every month at midnight
schtasks /create ^
  /sc MONTHLY /d 1 /mo * /st 00:00 ^
  /tn "Monthly-Rollup" ^
  /tr "C:\Scripts\monthly_rollup.bat" /f

:: Last day of every month (use /d LASTDAY)
schtasks /create /sc MONTHLY /d LASTDAY /st 23:30 /tn "EOM-Archive" /tr "C:\Scripts\archive.bat" /f
```

#### ONCE — run a single time
```cmd
:: Fire exactly once on 2026-04-01 at 09:00
schtasks /create /sc ONCE /sd 04/01/2026 /st 09:00 /tn "One-Time-Migration" /tr "C:\Scripts\migrate.ps1" /f
```

#### ONSTART — run at every system startup
```cmd
:: Restart a monitoring agent on boot, run as SYSTEM
schtasks /create /sc ONSTART /tn "Start-Monitor" /tr "C:\Agents\monitor.exe" /ru SYSTEM /f
```

#### ONLOGON — run when any user logs on
```cmd
:: Sync drive mappings for any user
schtasks /create /sc ONLOGON /tn "Drive-Map" /tr "C:\Scripts\map_drives.bat" /f
```

#### ONIDLE — run when the machine is idle for N minutes
```cmd
:: Run data quality scan when idle for 10 minutes
schtasks /create /sc ONIDLE /i 10 /tn "Idle-DQ-Scan" /tr "C:\Scripts\dq_scan.ps1" /f
```

#### ONEVENT — run on a Windows Event Log entry
```cmd
:: Trigger on Event ID 1000 in Application log (failure event)
schtasks /create ^
  /sc ONEVENT ^
  /ec Application ^
  /mo "*[System[EventID=1000]]" ^
  /tn "On-App-Error" ^
  /tr "C:\Scripts\notify_on_error.ps1" ^
  /ru SYSTEM /f
```

### Change — Modify Existing Tasks

#### Change the run time of an existing task
```cmd
schtasks /change /tn "BackupDB" /st 03:00
```

#### Disable a task without deleting it
```cmd
schtasks /change /tn "BackupDB" /disable
```

#### Re-enable a disabled task
```cmd
schtasks /change /tn "BackupDB" /enable
```

#### Change the run-as user
```cmd
schtasks /change /tn "BackupDB" /ru "DOMAIN\new-svc-account" /rp "NewPassword"
```

### Delete

```cmd
:: Delete with confirmation prompt
schtasks /delete /tn "BackupDB"

:: Delete without prompt (/f = force)
schtasks /delete /tn "BackupDB" /f

:: Delete an entire task folder and all tasks inside it
schtasks /delete /tn "\MyFolder\*" /f
```

### Run and End

```cmd
:: Trigger a task on demand (does not reset its schedule)
schtasks /run /tn "BackupDB"

:: Stop a currently running task instance
schtasks /end /tn "BackupDB"
```

### Import from XML

```cmd
:: Create a task from a previously exported XML file
schtasks /create /tn "BackupDB" /xml "BackupDB.xml" /f
```

---

## PowerShell ScheduledTasks Module

The `ScheduledTasks` module (built into Windows 8+ / Server 2012+) exposes Task Scheduler through PowerShell objects. It supports the full feature set of the GUI and produces scriptable, version-controllable task definitions.

> [!tip] Check Module Availability
> `Get-Module -ListAvailable ScheduledTasks` — if it returns nothing, you are on Windows 7 or Server 2008 R2. Use `schtasks.exe` or install RSAT.

### Core Cmdlets

| Cmdlet | Purpose |
|--------|---------|
| `New-ScheduledTaskTrigger` | Define when a task fires |
| `New-ScheduledTaskAction` | Define what a task runs |
| `New-ScheduledTaskPrincipal` | Define who the task runs as |
| `New-ScheduledTaskSettingsSet` | Define behavioral settings |
| `Register-ScheduledTask` | Create (register) the task |
| `Set-ScheduledTask` | Modify a registered task |
| `Unregister-ScheduledTask` | Delete a task |
| `Get-ScheduledTask` | Retrieve task objects |
| `Get-ScheduledTaskInfo` | Retrieve last-run results and next-run time |
| `Start-ScheduledTask` | Run a task on demand |
| `Stop-ScheduledTask` | Terminate a running task |
| `Enable-ScheduledTask` | Enable a disabled task |
| `Disable-ScheduledTask` | Disable without deleting |
| `Export-ScheduledTask` | Export task XML |

### New-ScheduledTaskTrigger — All Trigger Types

#### Daily trigger
```powershell
# Fire every day at 02:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
```

#### Weekly trigger
```powershell
# Every Monday at 06:00 AM
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "06:00"

# Multiple days
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Wednesday,Friday -At "08:00"
```

#### Repeating trigger (every N minutes, using RepetitionInterval)
```powershell
# Fire at startup, then repeat every 30 minutes indefinitely
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Repetition = (New-CimInstance -ClassName MSFT_TaskRepetitionPattern `
    -ClientOnly -Namespace Root/Microsoft/Windows/TaskScheduler `
    -Property @{
        Interval   = "PT30M"   # ISO 8601 duration: 30 minutes
        Duration   = "PT0S"    # PT0S = indefinite
        StopAtDurationEnd = $false
    })
```

> [!info] ISO 8601 Duration Strings
> Task Scheduler uses ISO 8601 duration format: `PT15M` = 15 minutes, `PT1H` = 1 hour, `P1D` = 1 day, `P1DT2H30M` = 1 day, 2 hours, 30 minutes.

#### Once trigger
```powershell
$trigger = New-ScheduledTaskTrigger -Once -At "2026-04-01 09:00"
```

#### At logon
```powershell
# Any user
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Specific user only
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "DOMAIN\jdoe"
```

#### At startup
```powershell
$trigger = New-ScheduledTaskTrigger -AtStartup
```

#### Event-based trigger (via CIM, not natively in New-ScheduledTaskTrigger)
```powershell
# Event triggers require building the CIM object directly
$eventTrigger = New-CimInstance -ClassName MSFT_TaskEventTrigger `
    -ClientOnly -Namespace Root/Microsoft/Windows/TaskScheduler `
    -Property @{
        Enabled      = $true
        Subscription = '<QueryList><Query Id="0" Path="Application"><Select Path="Application">*[System[EventID=1000]]</Select></Query></QueryList>'
        Delay        = "PT1M"   # Wait 1 minute after event before firing
    }
```

### New-ScheduledTaskAction

```powershell
# Run a PowerShell script
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -File `"C:\Scripts\backup.ps1`"" `
    -WorkingDirectory "C:\Scripts"

# Run a Python script inside a virtualenv
$action = New-ScheduledTaskAction `
    -Execute "C:\Pipelines\venv\Scripts\python.exe" `
    -Argument "C:\Pipelines\run_pipeline.py --env prod" `
    -WorkingDirectory "C:\Pipelines"

# Run sqlcmd
$action = New-ScheduledTaskAction `
    -Execute "sqlcmd.exe" `
    -Argument "-S SQLSERVER01 -d master -E -i `"C:\Scripts\backup.sql`" -o `"C:\Logs\backup.log`""
```

### New-ScheduledTaskPrincipal

```powershell
# Run as SYSTEM (no password needed, no interactive logon)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Run as a service account (stored password in Credential Manager)
$principal = New-ScheduledTaskPrincipal `
    -UserId "DOMAIN\svc-etl" `
    -LogonType Password `
    -RunLevel Highest

# Run as current user only when logged on (interactive, can show windows)
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType InteractiveToken `
    -RunLevel Limited
```

### New-ScheduledTaskSettingsSet

```powershell
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `   # Kill task after 2 hours
    -RestartCount 3 `                               # Retry up to 3 times on failure
    -RestartInterval (New-TimeSpan -Minutes 5) `    # Wait 5 minutes between retries
    -StartWhenAvailable `                           # Run ASAP if missed start time
    -MultipleInstances IgnoreNew `                  # Don't start if already running
    -DisallowStartIfOnBatteries $false `            # Run even on battery power
    -StopIfGoingOnBatteries $false `                # Don't stop on battery switch
    -WakeToRun $false `                             # Don't wake computer to run
    -RunOnlyIfNetworkAvailable $false `             # Run even without network
    -Priority 7                                     # Normal priority (0=highest, 10=lowest)
```

#### MultipleInstances options

| Value | Behavior |
|-------|---------|
| `IgnoreNew` | Skip new invocation if already running |
| `Parallel` | Allow multiple simultaneous instances |
| `Queue` | Queue new instance; run after current finishes |
| `StopExisting` | Kill the running instance and start a new one |

### Register-ScheduledTask — Putting It Together

```powershell
# Full registration with all components
Register-ScheduledTask `
    -TaskName "ETL-Daily-Backup" `
    -TaskPath "\DataEngineering\" `        # Folder in Task Scheduler tree
    -Trigger $trigger `
    -Action $action `
    -Principal $principal `
    -Settings $settings `
    -Description "Nightly database backup via sqlcmd, runs at 02:00 AM" `
    -Force                                 # Overwrite if task already exists
```

### Get-ScheduledTask and Get-ScheduledTaskInfo

```powershell
# List all tasks
Get-ScheduledTask

# Filter by folder path
Get-ScheduledTask -TaskPath "\DataEngineering\"

# Filter by name pattern
Get-ScheduledTask | Where-Object { $_.TaskName -like "ETL-*" }

# Get last run result and next scheduled run
Get-ScheduledTaskInfo -TaskName "ETL-Daily-Backup"

# Check last run result code (0 = success)
$info = Get-ScheduledTaskInfo -TaskName "ETL-Daily-Backup"
Write-Host "Last result: $($info.LastTaskResult)"
Write-Host "Next run:    $($info.NextRunTime)"
Write-Host "Last run:    $($info.LastRunTime)"
```

#### Last task result codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Incorrect function call or unknown error |
| `0x41301` | Task is currently running |
| `0x41303` | Task has not yet run |
| `0x41306` | Task was terminated by user |
| `0xFFFFFFFF` | Task ran but returned an error (check your script's exit code) |

> [!tip] Translating Exit Codes
> Your script's exit code maps directly to `LastTaskResult`. Always use `exit 0` on success and `exit 1` (or a non-zero code) on failure in PowerShell scripts to make this field meaningful.

### Modify and Delete

```powershell
# Update the trigger on an existing task
$newTrigger = New-ScheduledTaskTrigger -Daily -At "03:00"
Set-ScheduledTask -TaskName "ETL-Daily-Backup" -Trigger $newTrigger

# Update the action
Set-ScheduledTask -TaskName "ETL-Daily-Backup" -Action $newAction

# Disable / enable
Disable-ScheduledTask -TaskName "ETL-Daily-Backup"
Enable-ScheduledTask  -TaskName "ETL-Daily-Backup"

# Delete without prompt
Unregister-ScheduledTask -TaskName "ETL-Daily-Backup" -Confirm:$false

# Delete all tasks in a folder
Get-ScheduledTask -TaskPath "\DataEngineering\" |
    Unregister-ScheduledTask -Confirm:$false
```

### Export / Import for Source Control

```powershell
# Export to XML
Export-ScheduledTask -TaskName "ETL-Daily-Backup" | Out-File "ETL-Daily-Backup.xml" -Encoding UTF8

# Import from XML on another machine
$xml = Get-Content "ETL-Daily-Backup.xml" -Raw
Register-ScheduledTask -Xml $xml -TaskName "ETL-Daily-Backup" -Force
```

> [!tip] Infrastructure as Code
> Store exported task XMLs in a `tasks/` folder in your project repository. During CI/CD deployment, use `Register-ScheduledTask -Xml` to idempotently apply task definitions to target servers. This makes scheduled task configuration auditable and reproducible.

---

### Complete Example — Schedule a Python Pipeline on Windows

This example schedules a Python ETL pipeline that uses a virtual environment, logs to a timestamped file, and sends an email notification on failure.

```powershell
# === Schedule a Python ETL Pipeline ===
# Runs every day at 01:30 AM as a service account

$taskName   = "Python-ETL-Pipeline"
$taskFolder = "\DataEngineering\"
$pythonExe  = "C:\Pipelines\etl-venv\Scripts\python.exe"
$scriptPath = "C:\Pipelines\run_etl.py"
$logDir     = "C:\Logs\ETL"
$logFile    = "$logDir\etl-%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%.log"  # yyyyMMdd suffix

# Ensure log directory exists (run once during setup)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Action: python.exe with log redirection handled in the wrapper script
$action = New-ScheduledTaskAction `
    -Execute $pythonExe `
    -Argument "`"$scriptPath`" --env prod --log-dir `"$logDir`"" `
    -WorkingDirectory "C:\Pipelines"

# Trigger: daily at 01:30
$trigger = New-ScheduledTaskTrigger -Daily -At "01:30"

# Principal: service account, run whether or not user is logged on
$principal = New-ScheduledTaskPrincipal `
    -UserId "DOMAIN\svc-etl" `
    -LogonType Password `
    -RunLevel Highest

# Settings: 3-hour timeout, retry twice on failure, start if missed
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -DisallowStartIfOnBatteries $false

# Register the task (requires elevation)
Register-ScheduledTask `
    -TaskName  $taskName `
    -TaskPath  $taskFolder `
    -Action    $action `
    -Trigger   $trigger `
    -Principal $principal `
    -Settings  $settings `
    -Description "Nightly Python ETL pipeline. Logs to $logDir." `
    -Force

Write-Host "Task '$taskName' registered in '$taskFolder'."
```

> [!warning] Password Storage
> When using `LogonType Password`, the service account password is stored encrypted in the task definition by the Task Scheduler service (using DPAPI). The password is not retrievable in plaintext but must be re-entered if changed. Consider using a Group Managed Service Account (gMSA) with `LogonType Password` and no explicit password — Windows manages gMSA passwords automatically.

> [!success] Fix: use a gMSA or SYSTEM account to eliminate password management entirely
> Create a Group Managed Service Account with `New-ADServiceAccount` and grant it logon-as-a-batch-job rights. Register the task with `-UserId "DOMAIN\svc-etl$"` (note the trailing `$`) and `-LogonType Password` but no `-Password` parameter — the domain controller rotates the password automatically. Alternatively, run under `SYSTEM` if the task does not need network credentials.

---

### Complete Example — Schedule a SQL Server Backup with sqlcmd

```powershell
# === Schedule nightly SQL Server backup via sqlcmd ===

$taskName  = "SQLServer-NightlyBackup"
$sqlServer = "SQLSERVER01"
$database  = "OperationsDB"
$backupDir = "\\BACKUPSERVER\SQLBackups"
$scriptDir = "C:\DBScripts"
$sqlScript = "$scriptDir\backup_full.sql"

# The SQL script (create this file separately):
# BACKUP DATABASE [OperationsDB]
# TO DISK = N'\\BACKUPSERVER\SQLBackups\OperationsDB_FULL_$(Get-Date -Format yyyyMMdd).bak'
# WITH COMPRESSION, STATS = 10;

$action = New-ScheduledTaskAction `
    -Execute "sqlcmd.exe" `
    -Argument "-S $sqlServer -d master -E -i `"$sqlScript`" -o `"C:\Logs\backup_$(Get-Date -Format yyyyMMdd).log`" -b" `
    -WorkingDirectory $scriptDir
# -E = Windows Authentication (trusted connection)
# -b = exit with error code on SQL errors (makes LastTaskResult non-zero on failure)

$trigger   = New-ScheduledTaskTrigger -Daily -At "02:00"
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 30) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName  $taskName `
    -TaskPath  "\DataEngineering\" `
    -Action    $action `
    -Trigger   $trigger `
    -Principal $principal `
    -Settings  $settings `
    -Description "Full backup of $database to $backupDir via sqlcmd. Runs at 02:00 daily." `
    -Force
```

> [!tip] sqlcmd -b Flag
> The `-b` flag is critical: it makes `sqlcmd` exit with a non-zero code when SQL errors occur. Without `-b`, a backup failure still exits with code `0`, causing Task Scheduler to report success.

---

## PowerShell Scheduled Jobs (PSScheduledJob)

PSScheduledJob (`Register-ScheduledJob`) is a PowerShell-centric alternative that integrates with the PowerShell job infrastructure (`Get-Job`, `Receive-Job`). It stores job results locally and allows you to retrieve script output long after the job completes — useful for debugging pipelines.

> [!info] PSScheduledJob vs ScheduledTask
>
> Use `Register-ScheduledJob` when you need to inspect rich PowerShell output objects (not just exit codes) after the job runs. Use `Register-ScheduledTask` for everything else — it is more configurable and runs any executable, not just PowerShell scripts.

### Register-ScheduledJob

```powershell
# Import the module (auto-imported on PS 3.0+, explicit for clarity)
Import-Module PSScheduledJob

# Define a trigger
$trigger = New-JobTrigger -Daily -At "03:00"

# Define options (analogous to ScheduledTask settings)
$options = New-ScheduledJobOption `
    -RunElevated `                   # Run with elevated privileges
    -RequireNetwork `                # Only run if network is available
    -StartIfOnBattery `              # Run even on battery
    -ContinueIfGoingOnBattery `     # Don't stop on battery switch
    -IdleTimeout (New-TimeSpan -Minutes 10) `
    -MultipleInstancePolicy IgnoreNew

# Register the job
Register-ScheduledJob `
    -Name "ETL-ScheduledJob" `
    -ScriptBlock {
        # All PowerShell output here is captured and retrievable via Receive-Job
        param($Server, $Database)
        Import-Module SqlServer
        $result = Invoke-Sqlcmd -ServerInstance $Server -Database $Database `
            -Query "EXEC usp_RunETL"
        Write-Output $result
    } `
    -ArgumentList "SQLSERVER01", "OperationsDB" `
    -Trigger $trigger `
    -ScheduledJobOption $options `
    -Credential (Get-Credential "DOMAIN\svc-etl") `
    -MaxResultCount 7   # Keep results from last 7 runs
```

### Retrieve Job Results

```powershell
# List all scheduled jobs
Get-ScheduledJob

# Get the job object
$job = Get-Job -Name "ETL-ScheduledJob" | Sort-Object PSBeginTime -Descending | Select-Object -First 1

# Check status
$job.State     # Completed, Failed, Running, NotStarted

# Retrieve output (objects written to pipeline inside the ScriptBlock)
$results = Receive-Job -Job $job -Keep   # -Keep so you can retrieve again later

# Or retrieve output from a specific historical run stored on disk
$storedJob = Get-Job -Name "ETL-ScheduledJob"
$storedJob | Receive-Job -Keep
```

#### Job result storage location
```
C:\Users\<username>\AppData\Local\Microsoft\Windows\PowerShell\ScheduledJobs\
  ETL-ScheduledJob\
    Output\
      1\   ← run 1 results
      2\   ← run 2 results
      ...
      7\   ← run 7 (MaxResultCount limit)
```

### Manage Scheduled Jobs

```powershell
# Disable without deleting
Get-ScheduledJob -Name "ETL-ScheduledJob" | Disable-ScheduledJob

# Re-enable
Get-ScheduledJob -Name "ETL-ScheduledJob" | Enable-ScheduledJob

# Update trigger
$newTrigger = New-JobTrigger -Weekly -DaysOfWeek Monday -At "06:00"
Get-ScheduledJob -Name "ETL-ScheduledJob" | Set-ScheduledJob -Trigger $newTrigger

# Permanently remove
Get-ScheduledJob -Name "ETL-ScheduledJob" | Unregister-ScheduledJob
```

---

## Event-Based Triggers

### Trigger on Windows Event Log Entry

Use ONEVENT triggers to react to system events — application errors, service state changes, security events.

#### schtasks approach
```cmd
:: Trigger when SQL Server writes Event ID 18456 (login failure) to Application log
schtasks /create ^
  /sc ONEVENT ^
  /ec Application ^
  /mo "*[System[Provider[@Name='MSSQLSERVER'] and EventID=18456]]" ^
  /tn "Alert-SQLLoginFailure" ^
  /tr "powershell.exe -File C:\Scripts\alert_login_failure.ps1" ^
  /ru SYSTEM /f
```

#### PowerShell approach with CIM
```powershell
# Build the WMI event filter subscription XML
$eventSubscription = @'
<QueryList>
  <Query Id="0" Path="Application">
    <Select Path="Application">
      *[System[Provider[@Name='MSSQLSERVER'] and EventID=18456]]
    </Select>
  </Query>
</QueryList>
'@

$eventTrigger = New-CimInstance `
    -ClassName  MSFT_TaskEventTrigger `
    -ClientOnly `
    -Namespace  Root/Microsoft/Windows/TaskScheduler `
    -Property @{
        Enabled      = $true
        Subscription = $eventSubscription
        Delay        = "PT30S"   # Wait 30 seconds after event before firing
    }

$action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                -Argument "-File C:\Scripts\alert_login_failure.ps1"
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -MultipleInstances Queue

Register-ScheduledTask `
    -TaskName  "Alert-SQLLoginFailure" `
    -TaskPath  "\Monitoring\" `
    -Trigger   $eventTrigger `
    -Action    $action `
    -Principal $principal `
    -Settings  $settings `
    -Force
```

### Trigger on File System Changes (FileSystemWatcher)

Task Scheduler has no native file-watch trigger. Use a persistent PowerShell process with `FileSystemWatcher` as a lightweight alternative — typically run as a Windows Service or a background scheduled task at startup.

```powershell
# === File System Watcher — watch a drop folder and process new CSV files ===
# Run this script via a Task Scheduler ONSTART task (perpetual process)

$watchFolder  = "C:\DataDrop\Incoming"
$processScript = "C:\Scripts\process_csv.ps1"
$logFile      = "C:\Logs\file-watcher.log"

function Write-Log {
    param($Message)
    "$((Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) $Message" | Tee-Object -FilePath $logFile -Append
}

# Create watcher
$watcher                      = New-Object System.IO.FileSystemWatcher
$watcher.Path                 = $watchFolder
$watcher.Filter               = "*.csv"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents  = $true

# Register Created event
$action = {
    $filePath = $Event.SourceEventArgs.FullPath
    Write-Log "New file detected: $filePath"

    # Brief delay to ensure file write is complete before processing
    Start-Sleep -Seconds 2

    try {
        & "C:\Scripts\process_csv.ps1" -FilePath $filePath
        Write-Log "Processed: $filePath"
    } catch {
        Write-Log "ERROR processing $filePath`: $_"
    }
}

Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action | Out-Null

Write-Log "FileSystemWatcher started. Watching: $watchFolder"

# Block indefinitely — task runs perpetually, restarted on reboot by Task Scheduler
while ($true) { Start-Sleep -Seconds 60 }
```

```powershell
# Register the watcher script as an ONSTART task
$action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                -Argument "-ExecutionPolicy Bypass -NonInteractive -File `"C:\Scripts\file-watcher.ps1`""
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 0) # No timeout

Register-ScheduledTask -TaskName "FileWatcher-DataDrop" -TaskPath "\DataEngineering\" `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
```

> [!warning] FileSystemWatcher and network shares
>
> `FileSystemWatcher` does not reliably detect changes on UNC paths or mapped drives. For network share monitoring, poll the directory with `Get-ChildItem` on a scheduled interval instead.

> [!success] Fix: poll network shares with Get-ChildItem on a short interval
> Schedule a task to run every 1–5 minutes that calls `Get-ChildItem -Path "\\server\share\incoming" -Filter "*.csv"` and compares results against a state file of already-processed files. This is more reliable than `FileSystemWatcher` on network paths and survives transient network interruptions.

### Trigger on Service Failure

Windows Services have built-in failure recovery actions (restart, run a program, reboot). For a scheduled-task-based approach using event triggers:

```powershell
# Trigger when a specific Windows Service fails (Event ID 7034 = service crashed)
$subscription = @'
<QueryList>
  <Query Id="0" Path="System">
    <Select Path="System">
      *[System[Provider[@Name='Service Control Manager'] and EventID=7034]]
      and *[EventData[Data[@Name='param1']='MyServiceName']]
    </Select>
  </Query>
</QueryList>
'@

# Action: restart the service
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-Command `"Start-Service 'MyServiceName'; Write-EventLog -LogName Application -Source 'TaskScheduler' -EventId 9999 -EntryType Warning -Message 'MyServiceName auto-restarted by scheduled task'`""

# ... (register task as above using $subscription as event trigger)
```

---

## Data Engineering Patterns on Windows

### Scheduling SSIS Packages

SQL Server Agent is the preferred scheduler for SSIS, but Task Scheduler works when SQL Server Agent is unavailable.

```powershell
# === Schedule an SSIS package via DTExec ===
# DTExec is installed with SQL Server Integration Services

$action = New-ScheduledTaskAction `
    -Execute "DTExec.exe" `
    -Argument "/F `"C:\SSIS\Packages\LoadDimCustomer.dtsx`" /REPORTING EW /SET `"\Package.Variables[User::TargetDate].Properties[Value]`";`"$(Get-Date -Format yyyy-MM-dd)`"" `
    -WorkingDirectory "C:\SSIS\Packages"
# /F = file path to .dtsx package
# /REPORTING EW = report errors and warnings
# /SET = override package variable at runtime

$trigger   = New-ScheduledTaskTrigger -Daily -At "04:00"
$principal = New-ScheduledTaskPrincipal -UserId "DOMAIN\svc-ssis" -LogonType Password -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable

Register-ScheduledTask -TaskName "SSIS-LoadDimCustomer" -TaskPath "\DataEngineering\" `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
```

> [!info] SQL Agent vs Task Scheduler for SSIS
>
> SQL Server Agent is strongly preferred for SSIS: it captures package execution history, supports SQL Server Agent alerts, and integrates with SSIS Catalog (SSISDB) deployment model. Use Task Scheduler for SSIS only when running DTSX file-system packages on machines without SQL Server Agent.

### Scheduling Python Pipelines with Virtual Environments

```powershell
# === Python pipeline with venv, environment variables, and structured logging ===

# Wrapper batch file approach (recommended for env var injection)
$wrapperScript = @"
@echo off
REM Set environment variables for the pipeline
set PIPELINE_ENV=prod
set DB_SERVER=SQLSERVER01
set BQ_PROJECT=my-gcp-project
set GCP_SA_KEY=C:\Secrets\sa-key.json

REM Activate virtual environment
call C:\Pipelines\etl-venv\Scripts\activate.bat

REM Run the pipeline with output logging
python C:\Pipelines\run_pipeline.py --env %PIPELINE_ENV% >> C:\Logs\pipeline_%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%.log 2>&1

REM Capture exit code and deactivate
set EXITCODE=%ERRORLEVEL%
call deactivate
exit /b %EXITCODE%
"@

$wrapperPath = "C:\Pipelines\run_pipeline_wrapper.bat"
Set-Content -Path $wrapperPath -Value $wrapperScript -Encoding ASCII

$action    = New-ScheduledTaskAction -Execute $wrapperPath -WorkingDirectory "C:\Pipelines"
$trigger   = New-ScheduledTaskTrigger -Daily -At "01:00"
$principal = New-ScheduledTaskPrincipal -UserId "DOMAIN\svc-etl" -LogonType Password -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName "Python-ETL-Prod" -TaskPath "\DataEngineering\" `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
```

> [!tip] Wrapper batch file for Python
>
> Directly invoking `python.exe` from Task Scheduler works, but a `.bat` wrapper lets you inject environment variables, activate a venv, redirect both stdout and stderr to a log file with a timestamp, and capture the exit code cleanly — all in one place.

### Logging and Monitoring Scheduled Tasks

```powershell
# === Monitor all DataEngineering tasks and report failures ===
function Get-TaskHealthReport {
    param([string]$TaskPath = "\DataEngineering\")

    Get-ScheduledTask -TaskPath $TaskPath | ForEach-Object {
        $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath
        [PSCustomObject]@{
            Name           = $_.TaskName
            State          = $_.State
            LastResult     = $info.LastTaskResult
            LastRun        = $info.LastRunTime
            NextRun        = $info.NextRunTime
            Status         = if ($info.LastTaskResult -eq 0) { "OK" } else { "FAILED ($($info.LastTaskResult))" }
        }
    }
}

# Print to console
Get-TaskHealthReport | Format-Table -AutoSize

# Export to CSV for monitoring dashboard
Get-TaskHealthReport | Export-Csv "C:\Logs\task-health-$(Get-Date -Format yyyyMMdd).csv" -NoTypeInformation

# Alert on failures
$failures = Get-TaskHealthReport | Where-Object { $_.LastResult -ne 0 -and $_.LastResult -ne 267011 }
# 267011 = 0x41303 = task has never run — exclude from failure alerts
if ($failures) {
    $body = $failures | Format-Table | Out-String
    Send-MailMessage `
        -From "noreply@company.com" `
        -To "data-team@company.com" `
        -Subject "ALERT: Scheduled Task Failures on $env:COMPUTERNAME" `
        -Body $body `
        -SmtpServer "smtp.company.com"
}
```

### Error Handling and Email Notification Pattern

A reusable pattern: wrap any pipeline script in a try/catch that sends an email on failure and exits with a non-zero code.

```powershell
# === Pipeline wrapper with email notification on failure ===
# Place this boilerplate at the top of any scheduled pipeline script

param(
    [string]$Env      = "prod",
    [string]$LogDir   = "C:\Logs"
)

$ErrorActionPreference = "Stop"
$logFile = Join-Path $LogDir "pipeline-$(Get-Date -Format yyyyMMddHHmmss).log"

function Write-Log {
    param($Message, $Level = "INFO")
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

function Send-AlertEmail {
    param($Subject, $Body)
    try {
        Send-MailMessage `
            -From    "alerts@company.com" `
            -To      "data-team@company.com" `
            -Subject $Subject `
            -Body    $Body `
            -SmtpServer "smtp.company.com"
    } catch {
        Write-Log "Failed to send alert email: $_" "ERROR"
    }
}

try {
    Write-Log "Pipeline started (env=$Env)"

    # --- Your pipeline logic here ---
    # Import-Module ...
    # Invoke-Sqlcmd ...
    # python ...

    Write-Log "Pipeline completed successfully."
    exit 0

} catch {
    $errorMessage = $_.Exception.Message
    $errorDetails = $_ | Out-String

    Write-Log "Pipeline FAILED: $errorMessage" "ERROR"
    Write-Log $errorDetails "ERROR"

    Send-AlertEmail `
        -Subject "PIPELINE FAILURE on $env:COMPUTERNAME — $(Get-Date -Format 'yyyy-MM-dd HH:mm')" `
        -Body    "Pipeline failed with error:`n`n$errorDetails`n`nLog: $logFile"

    exit 1   # Non-zero exit: Task Scheduler marks LastTaskResult as failed
}
```

### Log Rotation for Scheduled Task Logs

```powershell
# === Rotate logs older than 30 days ===
# Schedule this as a monthly task

$logDir    = "C:\Logs"
$daysOld   = 30
$archiveDir = "C:\Logs\Archive"

New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

Get-ChildItem -Path $logDir -Filter "*.log" -File |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$daysOld) } |
    ForEach-Object {
        Move-Item -Path $_.FullName -Destination $archiveDir -Force
        Write-Host "Archived: $($_.Name)"
    }

# Compress archive logs older than 90 days
Get-ChildItem -Path $archiveDir -Filter "*.log" -File |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } |
    ForEach-Object {
        Compress-Archive -Path $_.FullName -DestinationPath "$($_.FullName).zip" -Force
        Remove-Item -Path $_.FullName
        Write-Host "Compressed: $($_.Name)"
    }
```

---

### When to Use Which Windows Scheduler

| Scheduler | Best For | Avoid When |
|-----------|----------|------------|
| **Task Scheduler** | Windows-native scripts; no SQL Server required; simple triggers; one-off or infrequent jobs | Complex dependencies between jobs; need rich history/alerting out-of-box |
| **SQL Server Agent** | SQL jobs, SSIS packages, database maintenance plans; need SQL-integrated alerting | No SQL Server available; non-database workloads |
| **Apache Airflow** | DAG-based pipelines with cross-system dependencies; need retry logic, SLAs, rich UI | Simple one-step scripts; low-budget environments without containerization |
| **PSScheduledJob** | PowerShell scripts where you need to inspect rich output objects post-run | Non-PowerShell executables; high-frequency jobs |

> [!info] SQL Agent vs Task Scheduler
>
> SQL Server Agent jobs are stored in `msdb` (the system database), run under SQL Server Agent Service account, support multi-step jobs with conditional logic between steps, and write history queryable via `msdb.dbo.sysjobhistory`. For any SQL-centric workload, Agent is the right choice. Task Scheduler is the fallback for machines without SQL Server or for scheduling non-database processes.

---

## Comparison: Linux Cron vs Windows Task Scheduler

### Feature Comparison Table

| Feature | Linux cron | Windows Task Scheduler |
|---------|------------|----------------------|
| Configuration format | Text file (`crontab`) | XML (GUI or PowerShell) |
| Minimum interval | 1 minute | 1 minute (via repetition) |
| Sub-minute scheduling | No (use systemd timers) | No |
| Run at login | No (use `.bashrc` / systemd) | Yes (ONLOGON trigger) |
| Run at boot | Yes (`@reboot`) | Yes (ONSTART trigger) |
| Run on event | No (use auditd / inotifywait) | Yes (ONEVENT trigger) |
| Run when idle | No | Yes (ONIDLE trigger) |
| Conditions | No | Yes (battery, network, idle) |
| Retry on failure | No (external) | Yes (native settings) |
| Multi-instance policy | Parallel only | Configurable (Queue, Ignore, Stop) |
| Credentials | Runs as crontab owner | Configurable (SYSTEM, user, service account) |
| History / last result | `/var/log/syslog` or mail | Native (LastTaskResult, history log) |
| Source control friendly | Yes (text file) | Yes (XML export) |
| Seconds-level granularity | No | No |

### Cron Expression to Task Scheduler Trigger Mapping

| cron expression | Meaning | Task Scheduler equivalent |
|-----------------|---------|--------------------------|
| `* * * * *` | Every minute | `New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1)` |
| `*/15 * * * *` | Every 15 minutes | Repetition interval of PT15M |
| `0 2 * * *` | Daily at 02:00 | `-Daily -At "02:00"` |
| `0 6 * * 1` | Weekly Monday 06:00 | `-Weekly -DaysOfWeek Monday -At "06:00"` |
| `0 0 1 * *` | Monthly, 1st, midnight | `-Monthly -DaysOfMonth 1 -At "00:00"` |
| `@reboot` | At boot | `-AtStartup` |
| `@hourly` | Every hour (`:00`) | `-RepetitionInterval PT1H` |
| `@daily` | Daily at midnight | `-Daily -At "00:00"` |
| `@weekly` | Weekly (Sunday midnight) | `-Weekly -DaysOfWeek Sunday -At "00:00"` |
| `@monthly` | Monthly (1st, midnight) | `-Monthly -DaysOfMonth 1 -At "00:00"` |
| `30 9 * * 1-5` | Weekdays at 09:30 | `-Weekly -DaysOfWeek Mon,Tue,Wed,Thu,Fri -At "09:30"` |
| `0 */4 * * *` | Every 4 hours | Repetition interval PT4H |

> [!tip] systemd timers vs Task Scheduler
>
> Modern Linux uses `systemd` timers rather than cron for new services. Systemd timers support monotonic intervals (e.g., 30 minutes after boot) and calendar-based triggers with second-level precision — features closer to Task Scheduler's capabilities than traditional cron.

### Cron-Like Wrapper for Windows (reference pattern)

If your team is migrating from Linux and prefers cron syntax, this pattern translates a cron expression into a Task Scheduler registration:

```powershell
# Minimal "cron-like" task creator for daily-at-time patterns
function Register-CronStyleTask {
    param(
        [string]$Name,
        [string]$Command,       # Full executable path
        [string]$Arguments,
        [string]$RunAt,         # HH:mm format
        [string[]]$DaysOfWeek = @()   # Empty = daily
    )

    $action    = New-ScheduledTaskAction -Execute $Command -Argument $Arguments
    $trigger   = if ($DaysOfWeek.Count -gt 0) {
                     New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DaysOfWeek -At $RunAt
                 } else {
                     New-ScheduledTaskTrigger -Daily -At $RunAt
                 }
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $Name -TaskPath "\CronJobs\" `
        -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    Write-Host "Registered: $Name (runs at $RunAt$(if ($DaysOfWeek) {" on $($DaysOfWeek -join ',')"}))"
}

# Usage — equivalent to cron "0 2 * * *"
Register-CronStyleTask -Name "nightly-etl" -Command "python.exe" `
    -Arguments "C:\Pipelines\etl.py" -RunAt "02:00"

# Usage — equivalent to cron "0 6 * * 1"
Register-CronStyleTask -Name "weekly-report" -Command "powershell.exe" `
    -Arguments "-File C:\Scripts\report.ps1" -RunAt "06:00" -DaysOfWeek Monday
```

---

## Troubleshooting Common Issues

### Task Runs Successfully Interactively but Fails as Scheduled

1. **Missing environment variables** — Task Scheduler runs in a minimal environment. Explicitly set all required env vars in your script or wrapper.
2. **Wrong working directory** — Always set `-WorkingDirectory` on `New-ScheduledTaskAction`. Relative paths resolve differently in the task context.
3. **Network resources unavailable** — The task may start before the network is ready. Add `RunOnlyIfNetworkAvailable` or use a delay trigger.
4. **32-bit vs 64-bit** — Tasks can run under 32-bit `powershell.exe` even on 64-bit Windows. Use `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` (64-bit) explicitly.

### Task Appears to Run but Does Nothing

- Check `LastTaskResult` with `Get-ScheduledTaskInfo`.
- Add `-b` to `sqlcmd` invocations.
- Add `exit 1` in your script on error (PowerShell `$ErrorActionPreference = "Stop"` and a top-level `try/catch`).

### "The operator or administrator has refused the request" (0x800710E0)

Task Scheduler blocked execution due to a **condition not being met** (battery, network, idle). Check the Conditions tab in the GUI or review your `New-ScheduledTaskSettingsSet` parameters.

### Task Skipped with "Task is already running"

Set `MultipleInstances` to `Queue` (run after current finishes) or increase `ExecutionTimeLimit` if the task legitimately needs more time.

```powershell
# Fix multi-instance skipping
Set-ScheduledTask -TaskName "ETL-Daily" `
    -Settings (New-ScheduledTaskSettingsSet -MultipleInstances Queue -ExecutionTimeLimit (New-TimeSpan -Hours 6))
```

---

### Windows Task Scheduler Quick Reference Cheat Sheet

```powershell
# --- LIST ---
Get-ScheduledTask -TaskPath "\DataEngineering\"
schtasks /query /fo TABLE /v

# --- CREATE (minimal daily) ---
Register-ScheduledTask -TaskName "MyTask" -TaskPath "\MyFolder\" `
    -Action (New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\Scripts\run.ps1") `
    -Trigger (New-ScheduledTaskTrigger -Daily -At "02:00") `
    -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest) `
    -Force

# --- STATUS ---
Get-ScheduledTaskInfo -TaskName "MyTask"

# --- RUN NOW ---
Start-ScheduledTask -TaskName "MyTask"

# --- STOP ---
Stop-ScheduledTask -TaskName "MyTask"

# --- DISABLE / ENABLE ---
Disable-ScheduledTask -TaskName "MyTask"
Enable-ScheduledTask  -TaskName "MyTask"

# --- DELETE ---
Unregister-ScheduledTask -TaskName "MyTask" -Confirm:$false

# --- EXPORT ---
Export-ScheduledTask -TaskName "MyTask" | Out-File "MyTask.xml" -Encoding UTF8

# --- IMPORT ---
Register-ScheduledTask -Xml (Get-Content "MyTask.xml" -Raw) -TaskName "MyTask" -Force
```

---

## Related

- [linux-scheduling](https://alp78.github.io/elysium/12-Orchestration/Scheduling/linux-scheduling) — The Linux equivalent: cron, systemd timers, at, and anacron
- [gcp-scheduling](https://alp78.github.io/elysium/12-Orchestration/Scheduling/gcp-scheduling) — Cloud-based scheduling with Cloud Scheduler for serverless and managed alternatives
- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) — When pipelines outgrow Task Scheduler, Airflow provides DAG-based orchestration with dependencies, retries, and a monitoring UI
