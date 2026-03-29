---
type: how-to
category: security
technology: [sql-server, gcp]
tags: [sql, gcp, sql-server, tsql]
aliases: [SQL Server authentication, service account hardening, SQL Server Audit, login hardening, sa disable, dedicated logins, GCP service account, IAM least privilege, TLS SQL Server, network encryption, firewall rules, SQL Server security, LGIF, LGIS, failed login, brute force detection]
keywords: [SQL Server authentication, sa disable, CREATE LOGIN, CREATE USER, GRANT, DENY, schema permissions, GCP service account, IAM roles, roles/storage.objectAdmin, roles/monitoring.metricWriter, SQL Server Audit, server audit, audit specification, sys.fn_get_audit_file, LGIF, LGIS, failed login detection, brute force, TLS 1.2, forceencryption, mssql-conf, GCP firewall rules, allow-sql-internal, IAP tunnel, sys.dm_exec_connections, encrypt_option, quarterly security review, orphaned users, sysadmin members]
description: "How to harden SQL Server 2022 on GCP: creating a dedicated GCP service account with minimal IAM roles, setting up application-specific SQL logins with least-privilege permissions, enabling TLS 1.2 encryption, configuring GCP firewall rules, setting up SQL Server Audit for login and data access events, and running a quarterly security review."
related: [tde-encryption, server-configuration, high-availability-overview, essential-dba-queries]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# SQL Server Authentication and Security Hardening

SQL Server security has three distinct identity layers that must each be hardened independently. Vulnerabilities at any layer can expose data even when the other layers are correct.

### Identity Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     GCP IAM Layer                                │
│                                                                  │
│  Service Account: analytics-sql-sa@data-platform-prod.iam.gsvc │
│  Roles:                                                          │
│    ├── roles/storage.objectAdmin  (GCS backup read/write)        │
│    ├── roles/monitoring.metricWriter (Datadog / Cloud Monitoring)│
│    └── (nothing else)                                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                     Linux OS Layer                               │
│                                                                  │
│  User: mssql (uid=999, runs sqlservr process)                    │
│  User: airflow (runs DAG tasks via SSH)                          │
│  User: dd-agent (Datadog monitoring)                             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                     SQL Server Layer                             │
│                                                                  │
│  Login: sa (disabled after setup — emergency use only)           │
│  Login: pipeline_svc (Python pipeline — bronze/silver/gold)      │
│  Login: dashboard_svc (Blazor dashboard — read-only)             │
│  Login: airflow_svc (Airflow health checks and job metadata)     │
│  Login: datadog_svc (Datadog SQL Server integration)             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Part 1: GCP Service Account Hardening

By default, GCP Compute Engine VMs use the default Compute Engine service account with `roles/editor` — an overly broad permission set that violates least privilege. Any process on the VM (backup scripts, monitoring agents, pipeline jobs) inherits the VM's GCP service account permissions.

#### gcloud iam service-accounts create — dedicated SA for SQL Server VM

```bash
# Create the service account
gcloud iam service-accounts create analytics-sql-sa \
  --display-name="Analytics SQL Server" \
  --description="Dedicated SA for SQL Server VM — minimal permissions"

# Verify creation
gcloud iam service-accounts list --filter="email:analytics-sql-sa"
# Expected output:
# EMAIL                                                              DISABLED
# analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com      False
```

#### gcloud projects add-iam-policy-binding — assign minimum IAM roles

```bash
# GCS backup access (read/write to backup bucket)
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Cloud Monitoring metric writer (for Datadog and custom metrics)
gcloud projects add-iam-policy-binding data-platform-prod \
  --member="serviceAccount:analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"

# Verify assigned roles
gcloud projects get-iam-policy data-platform-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
# Expected output:
# ROLE
# roles/monitoring.metricWriter
# roles/storage.objectAdmin
```

#### gcloud compute instances set-service-account — remove default SA from VM

```bash
# Assign the dedicated SA to the VM (requires VM stop/start)
gcloud compute instances stop analytics-sql --zone=europe-west1-b

gcloud compute instances set-service-account analytics-sql --zone=europe-west1-b \
  --service-account=analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com \
  --scopes=cloud-platform

gcloud compute instances start analytics-sql --zone=europe-west1-b
```

#### gcloud auth list — verify service account from inside VM

```bash
# SSH into the VM
gcloud compute ssh analytics-sql --zone=europe-west1-b --tunnel-through-iap

# Check which service account is active
curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email
# Expected output:
# analytics-sql-sa@data-platform-prod.iam.gserviceaccount.com

# Check available scopes
curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/scopes
# Expected output:
# https://www.googleapis.com/auth/cloud-platform
```

## Part 2: SQL Server Login Hardening

#### CREATE LOGIN / CREATE USER — dedicated logins per application

```sql
-- ============================================================
-- Create dedicated logins for each application
-- Run as sa (one last time before disabling)
-- ============================================================

-- 1. Pipeline service account (Python pipeline — full DML on bronze/silver/gold)
CREATE LOGIN pipeline_svc WITH PASSWORD = 'P!pel1ne$ecure2026', CHECK_POLICY = ON;
GO

USE analytics_db;
CREATE USER pipeline_svc FOR LOGIN pipeline_svc;

-- Grant schema-level permissions
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::bronze TO pipeline_svc;
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::silver TO pipeline_svc;
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::gold TO pipeline_svc;
GRANT CREATE TABLE TO pipeline_svc;  -- For initial table creation

-- Deny access to sensitive system views
DENY VIEW SERVER STATE TO pipeline_svc;
GO

-- 2. Dashboard service account (Blazor — read-only on gold + silver)
CREATE LOGIN dashboard_svc WITH PASSWORD = 'D@shb0ard$ecure2026', CHECK_POLICY = ON;
GO

USE analytics_db;
CREATE USER dashboard_svc FOR LOGIN dashboard_svc;
GRANT SELECT ON SCHEMA::gold TO dashboard_svc;
GRANT SELECT ON SCHEMA::silver TO dashboard_svc;

-- Explicitly deny writes
DENY INSERT, UPDATE, DELETE ON SCHEMA::gold TO dashboard_svc;
DENY INSERT, UPDATE, DELETE ON SCHEMA::silver TO dashboard_svc;
DENY INSERT, UPDATE, DELETE ON SCHEMA::bronze TO dashboard_svc;
GO

-- 3. Airflow service account (health checks and job metadata)
CREATE LOGIN airflow_svc WITH PASSWORD = 'A!rfl0w$ecure2026', CHECK_POLICY = ON;
GO

USE analytics_db;
CREATE USER airflow_svc FOR LOGIN airflow_svc;
GRANT SELECT ON SCHEMA::gold TO airflow_svc;  -- Read scores for validation
GRANT EXECUTE ON SCHEMA::dbo TO airflow_svc;   -- Run health check stored procs
GO

-- 4. Datadog monitoring account (read-only system views)
CREATE LOGIN datadog_svc WITH PASSWORD = 'D@tad0g$ecure2026', CHECK_POLICY = ON;
GO

USE analytics_db;
CREATE USER datadog_svc FOR LOGIN datadog_svc;
GRANT SELECT ON SCHEMA::dbo TO datadog_svc;

USE master;
GRANT VIEW SERVER STATE TO datadog_svc;     -- DMVs for performance monitoring
GRANT VIEW DATABASE STATE TO datadog_svc;   -- Database-level DMVs
GO

-- 5. Disable sa login (use dedicated logins from now on)
ALTER LOGIN sa DISABLE;
GO

-- Verify all logins
SELECT
    name,
    type_desc,
    is_disabled,
    create_date,
    modify_date,
    LOGINPROPERTY(name, 'PasswordLastSetTime') AS password_last_set
FROM sys.server_principals
WHERE type IN ('S', 'U')
ORDER BY create_date;
-- Expected output:
-- name            type_desc       is_disabled  create_date
-- sa              SQL_LOGIN       1            2024-01-15 (disabled)
-- pipeline_svc    SQL_LOGIN       0            2026-03-10
-- dashboard_svc   SQL_LOGIN       0            2026-03-10
-- airflow_svc     SQL_LOGIN       0            2026-03-10
-- datadog_svc     SQL_LOGIN       0            2026-03-10
```

#### pymssql, ADO.NET — update connection strings with dedicated logins

| Application | Config Location | Old | New |
|-------------|----------------|-----|-----|
| Python Pipeline | `pipeline/.env` | `SA_PASSWORD=...` | `SQL_LOGIN=pipeline_svc; SQL_PASSWORD=...` |
| Blazor Dashboard | `dashboard/appsettings.json` | `User Id=sa` | `User Id=dashboard_svc` |
| Airflow DAGs | Airflow Connection `mssql_project` | `login=sa` | `login=airflow_svc` |
| Datadog Agent | `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` | `username: sa` | `username: datadog_svc` |

## Part 3: TLS Encryption for Connections

#### TLS Encryption — network path client → IAP tunnel → VM → SQL Server

```
┌─────────────────────┐    IAP Tunnel     ┌─────────────────────┐
│  Developer Laptop   │◄────────────────►│  analytics-sql VM            │
│  (SSMS / ADS)       │   (port 1433)    │  (no public IP)      │
└─────────────────────┘                   │                      │
                                          │  10.0.1.x            │
┌─────────────────────┐    VPC Internal   │  europe-west1-b      │
│  Cloud Run          │◄────────────────►│                      │
│  (Pipeline)         │   Serverless VPC  │  Firewall Rules:     │
│  10.8.0.x           │   Connector       │  ├── allow-sql-      │
└─────────────────────┘                   │  │   internal        │
                                          │  │   (10.0.0.0/8)    │
┌─────────────────────┐    VPC Internal   │  ├── allow-iap       │
│  Cloud Run          │◄────────────────►│  │   (35.235.240.0/20)│
│  (Dashboard)        │   Serverless VPC  │  └── deny-all-       │
│  10.8.0.x           │   Connector       │      ingress         │
└─────────────────────┘                   └─────────────────────┘

┌─────────────────────┐    VPC Internal
│  Airflow VM         │◄────────────────►  (same VPC)
│  10.0.2.x           │   (port 1433)
└─────────────────────┘
```

#### openssl req -x509 — generate TLS certificate for SQL Server

```bash
# SSH into the SQL Server VM
gcloud compute ssh analytics-sql --zone=europe-west1-b --tunnel-through-iap

# Generate a self-signed certificate (valid for 3 years)
sudo openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout /etc/ssl/private/mssql.key \
  -out /etc/ssl/certs/mssql.pem \
  -days 1095 \
  -subj "/CN=analytics-sql.europe-west1-b.c.data-platform-prod.internal"

# Set correct ownership and permissions
sudo chown mssql:mssql /etc/ssl/private/mssql.key /etc/ssl/certs/mssql.pem
sudo chmod 400 /etc/ssl/private/mssql.key
sudo chmod 444 /etc/ssl/certs/mssql.pem
```

#### mssql-conf set network.tlscert/tlskey — force TLS 1.2 on SQL Server

```bash
# Set TLS certificate and key paths
sudo /opt/mssql/bin/mssql-conf set network.tlscert /etc/ssl/certs/mssql.pem
sudo /opt/mssql/bin/mssql-conf set network.tlskey /etc/ssl/private/mssql.key

# Force TLS 1.2 minimum (disable TLS 1.0 and 1.1)
sudo /opt/mssql/bin/mssql-conf set network.tlsprotocols 1.2

# Force encryption for ALL connections (clients cannot opt out)
sudo /opt/mssql/bin/mssql-conf set network.forceencryption 1

# Verify the settings before restart
sudo cat /var/opt/mssql/mssql.conf
# Expected to include:
# [network]
# tlscert = /etc/ssl/certs/mssql.pem
# tlskey = /etc/ssl/private/mssql.key
# tlsprotocols = 1.2
# forceencryption = 1

# Restart SQL Server to apply
sudo systemctl restart mssql-server

# Verify TLS is working from the error log
sudo cat /var/opt/mssql/log/errorlog | grep -i "encrypt|certificate|TLS"
# Expected lines:
# ... Successfully loaded certificate [Thumbprint=...]
# ... Server is listening on ... using encryption
```

#### Encrypt=yes;TrustServerCertificate=no — update connection strings for TLS

```python
# Python pipeline — pyodbc connection string with TLS
connection_string = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=10.0.1.x,1433;"
    "DATABASE=analytics_db;"
    "UID=pipeline_svc;"
    "PWD=P!pel1ne$ecure2026;"
    "Encrypt=yes;"
    "TrustServerCertificate=yes;"  # Required for self-signed certs
)
```

```json
// Blazor dashboard — appsettings.json
{
  "ConnectionStrings": {
    "AnalyticsDb": "Server=10.0.1.x,1433;Database=analytics_db;User Id=dashboard_svc;Password=...;Encrypt=True;TrustServerCertificate=True;"
  }
}
```

#### sys.dm_exec_connections encrypt_option — verify encrypted connections

```sql
-- Check that all active connections are encrypted
SELECT
    session_id,
    encrypt_option,
    auth_scheme,
    client_net_address,
    program_name,
    login_name
FROM sys.dm_exec_connections
ORDER BY session_id;
-- Expected: encrypt_option = 'TRUE' for ALL rows

-- Count encrypted vs unencrypted
SELECT encrypt_option, COUNT(*) AS connection_count
FROM sys.dm_exec_connections
GROUP BY encrypt_option;
-- Expected: only TRUE
```

### Part 4: GCP Firewall Rules

```bash
# Rule 1: Allow SQL Server access from VPC internal networks only
gcloud compute firewall-rules create allow-sql-internal \
  --network=analytics-vpc \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:1433 \
  --source-ranges=10.0.0.0/8 \
  --target-tags=sql-server \
  --description="Allow SQL Server 1433 from VPC internal ranges only" \
  --priority=1000

# Rule 2: IAP tunnel access (for developer SSH and SSMS via tunnel)
gcloud compute firewall-rules describe allow-iap-ingress 2>/dev/null || \
gcloud compute firewall-rules create allow-iap-ingress \
  --network=analytics-vpc \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:22,tcp:1433 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=sql-server \
  --description="Allow IAP tunnel access for SSH and SQL Server" \
  --priority=900

# Rule 3: Deny all other ingress
gcloud compute firewall-rules create deny-all-ingress-sql \
  --network=analytics-vpc \
  --direction=INGRESS \
  --action=DENY \
  --rules=tcp:1433 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=sql-server \
  --description="Deny all external SQL Server access" \
  --priority=2000

# List all firewall rules for sql-server tag
gcloud compute firewall-rules list \
  --filter="targetTags:sql-server" \
  --format="table(name, direction, priority, sourceRanges, allowed)"
# Expected output:
# NAME                    DIRECTION  PRIORITY  SOURCE_RANGES       ALLOWED
# allow-iap-ingress       INGRESS    900       35.235.240.0/20     tcp:22,tcp:1433
# allow-sql-internal      INGRESS    1000      10.0.0.0/8          tcp:1433
# deny-all-ingress-sql    INGRESS    2000      0.0.0.0/0           tcp:1433

# Confirm the VM has no external IP
gcloud compute instances describe analytics-sql --zone=europe-west1-b \
  --format="get(networkInterfaces[0].accessConfigs)"
# Expected: empty output (no accessConfigs = no external IP)
```

## Part 5: SQL Server Audit

#### SQL Server Audit architecture — server audit → specification → log

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SQL Server Audit System                       │
│                                                                      │
│  Server Audit (project_audit)                                          │
│  ├── Target: FILE (/var/opt/mssql/audit/)                           │
│  ├── Max Size: 100 MB per file                                       │
│  ├── Max Rollover Files: 10 (total ~1 GB)                            │
│  │                                                                   │
│  ├── Server Audit Specification (audit_logins)                       │
│  │   ├── FAILED_LOGIN_GROUP         (failed login attempts)          │
│  │   ├── SUCCESSFUL_LOGIN_GROUP     (successful logins)              │
│  │   ├── DATABASE_PERMISSION_CHANGE_GROUP (GRANT/DENY/REVOKE)       │
│  │   └── SERVER_ROLE_MEMBER_CHANGE_GROUP (role membership changes)   │
│  │                                                                   │
│  └── Database Audit Specification (audit_data_access)                │
│      ├── SELECT ON gold.* BY public    (all reads of gold schema)    │
│      ├── INSERT ON silver.* BY public  (all writes to silver)        │
│      └── DELETE ON bronze.* BY public  (all deletes from bronze)     │
│                                                                      │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
        /var/opt/mssql/audit/
        ├── project_audit_*.sqlaudit  (binary audit files)
                   │
                   ▼
        ┌──────────────────────┐
        │  GCP Ops Agent       │
        │  (Cloud Logging)     │
        │                      │
        │  → Cloud Logging     │
        │  → BigQuery sink     │
        │  → Alert policies    │
        └──────────────────────┘
```

#### CREATE SERVER AUDIT — file-based audit with max size and rollover

```sql
-- Create server-level audit
CREATE SERVER AUDIT project_audit
TO FILE (
    FILEPATH = '/var/opt/mssql/audit/',
    MAXSIZE = 100 MB,
    MAX_ROLLOVER_FILES = 10,       -- Keep 10 files (1 GB total)
    RESERVE_DISK_SPACE = OFF
)
WITH (
    QUEUE_DELAY = 1000,            -- 1 second flush delay
    ON_FAILURE = CONTINUE          -- Don't crash SQL Server if audit fails
);
GO

-- Enable the audit
ALTER SERVER AUDIT project_audit WITH (STATE = ON);
GO

-- Verify audit is active
SELECT name, status_desc, audit_file_path, queue_delay, on_failure_desc
FROM sys.server_audits;
```

#### CREATE SERVER AUDIT SPECIFICATION — login and permission events

```sql
CREATE SERVER AUDIT SPECIFICATION audit_logins
FOR SERVER AUDIT project_audit
ADD (FAILED_LOGIN_GROUP),                    -- Failed login attempts
ADD (SUCCESSFUL_LOGIN_GROUP),                -- Successful logins
ADD (DATABASE_PERMISSION_CHANGE_GROUP),      -- GRANT, DENY, REVOKE statements
ADD (SERVER_ROLE_MEMBER_CHANGE_GROUP),       -- sp_addsrvrolemember, ALTER SERVER ROLE
ADD (LOGIN_CHANGE_PASSWORD_GROUP),           -- Password changes
ADD (SERVER_PRINCIPAL_CHANGE_GROUP),         -- CREATE/ALTER/DROP LOGIN
ADD (DATABASE_PRINCIPAL_CHANGE_GROUP)        -- CREATE/ALTER/DROP USER
WITH (STATE = ON);
GO
```

#### CREATE DATABASE AUDIT SPECIFICATION — data access events

```sql
USE analytics_db;
GO

CREATE DATABASE AUDIT SPECIFICATION audit_data_access
FOR SERVER AUDIT project_audit
ADD (SELECT ON SCHEMA::gold BY public),        -- Track all reads of gold schema
ADD (INSERT ON SCHEMA::silver BY public),       -- Track all writes to silver
ADD (UPDATE ON SCHEMA::silver BY public),       -- Track all updates to silver
ADD (DELETE ON SCHEMA::bronze BY public),       -- Track all deletes from bronze
ADD (EXECUTE ON SCHEMA::dbo BY public),         -- Track stored procedure execution
ADD (SCHEMA_OBJECT_CHANGE_GROUP)                -- Track DDL changes
WITH (STATE = ON);
GO
```

#### sys.fn_get_audit_file — query audit logs

```sql
-- Recent events (last 1 hour)
SELECT TOP 50
    event_time,
    action_id,
    CASE action_id
        WHEN 'LGIS' THEN 'Login Succeeded'
        WHEN 'LGIF' THEN 'Login Failed'
        WHEN 'G '   THEN 'GRANT'
        WHEN 'D '   THEN 'DENY'
        WHEN 'R '   THEN 'REVOKE'
        WHEN 'SL'   THEN 'SELECT'
        WHEN 'IN'   THEN 'INSERT'
        WHEN 'UP'   THEN 'UPDATE'
        WHEN 'DL'   THEN 'DELETE'
        WHEN 'EX'   THEN 'EXECUTE'
        WHEN 'CR'   THEN 'CREATE'
        WHEN 'AL'   THEN 'ALTER'
        WHEN 'DR'   THEN 'DROP'
        ELSE action_id
    END AS action_desc,
    succeeded,
    server_principal_name,
    database_name,
    schema_name,
    object_name,
    statement,
    client_ip
FROM sys.fn_get_audit_file('/var/opt/mssql/audit/*.sqlaudit', DEFAULT, DEFAULT)
WHERE event_time > DATEADD(HOUR, -1, GETUTCDATE())
ORDER BY event_time DESC;
```

#### sys.fn_get_audit_file FAILED_LOGIN_GROUP — detect brute-force attacks

```sql
-- Alert on brute-force attempts: >10 failed logins from same IP in 1 hour
SELECT
    client_ip,
    COUNT(*) AS failed_attempts,
    MIN(event_time) AS first_attempt,
    MAX(event_time) AS last_attempt,
    DATEDIFF(SECOND, MIN(event_time), MAX(event_time)) AS attack_duration_seconds,
    COUNT(DISTINCT server_principal_name) AS distinct_logins_tried
FROM sys.fn_get_audit_file('/var/opt/mssql/audit/*.sqlaudit', DEFAULT, DEFAULT)
WHERE action_id = 'LGIF'  -- Login Failed
  AND event_time > DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY client_ip
HAVING COUNT(*) > 10
ORDER BY failed_attempts DESC;

-- Detect credential stuffing: multiple different usernames from same IP
SELECT
    client_ip,
    STRING_AGG(DISTINCT server_principal_name, ', ') AS attempted_logins,
    COUNT(*) AS total_attempts
FROM sys.fn_get_audit_file('/var/opt/mssql/audit/*.sqlaudit', DEFAULT, DEFAULT)
WHERE action_id = 'LGIF'
  AND event_time > DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY client_ip
HAVING COUNT(DISTINCT server_principal_name) > 3
ORDER BY total_attempts DESC;
```

#### google-cloud-ops-agent — forward SQL Server audit logs to Cloud Logging

```yaml
# /etc/google-cloud-ops-agent/config.yaml
logging:
  receivers:
    sqlserver_errorlog:
      type: files
      include_paths:
        - /var/opt/mssql/log/errorlog
        - /var/opt/mssql/log/errorlog.*
      record_log_name: sqlserver_errorlog
      wildcard_refresh_interval: 60s
    sqlserver_audit:
      type: files
      include_paths:
        - /var/opt/mssql/audit/*.sqlaudit
      record_log_name: sqlserver_audit
      wildcard_refresh_interval: 30s
  service:
    pipelines:
      sql_pipeline:
        receivers:
          - sqlserver_errorlog
          - sqlserver_audit
```

```bash
# Restart Ops Agent to apply
sudo systemctl restart google-cloud-ops-agent

# Verify logs are flowing to Cloud Logging
gcloud logging read 'resource.type="gce_instance" AND logName:"sqlserver_errorlog"' \
  --limit=5 \
  --format="table(timestamp, jsonPayload.message)"
# Expected: recent SQL Server error log entries
```

#### gcloud logging sinks create — sink audit logs to BigQuery

```bash
# Sink audit logs to BigQuery for long-term analysis
gcloud logging sinks create sql-audit-sink \
  bigquery.googleapis.com/projects/data-platform-prod/datasets/security_logs \
  --log-filter='resource.type="gce_instance" AND logName:"sqlserver_audit"'

# Get the sink's service account (needed for BigQuery permissions)
gcloud logging sinks describe sql-audit-sink --format="value(writerIdentity)"
# Expected: serviceAccount:p123456789-123456@gcp-sa-logging.iam.gserviceaccount.com

# Grant the sink SA write access to the BigQuery dataset
bq add-iam-policy-binding \
  --member="serviceAccount:p123456789-123456@gcp-sa-logging.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor" \
  data-platform-prod:security_logs

# Create an alert policy for failed login spikes
gcloud monitoring policies create \
  --display-name="SQL Server Failed Logins Spike" \
  --condition-display-name="Failed logins > 10 in 5 min" \
  --condition-filter='resource.type="gce_instance" AND metric.type="logging.googleapis.com/user/sqlserver_failed_logins"' \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s \
  --notification-channels="projects/data-platform-prod/notificationChannels/CHANNEL_ID" \
  --combiner=OR
```

## Quarterly Security Review

Run this comprehensive review every quarter:

```sql
-- ============================================================
-- QUARTERLY SECURITY REVIEW SCRIPT
-- ============================================================

-- 1. Review all SQL logins
PRINT '=== 1. SQL Server Logins ==='
SELECT name, type_desc, is_disabled, create_date, modify_date,
    LOGINPROPERTY(name, 'PasswordLastSetTime') AS password_last_set,
    LOGINPROPERTY(name, 'DaysUntilExpiration') AS days_until_expiry
FROM sys.server_principals
WHERE type IN ('S', 'U', 'G')
ORDER BY create_date;

-- 2. Check for orphaned users (users without matching logins)
PRINT '=== 2. Orphaned Users ==='
USE analytics_db;
SELECT dp.name AS user_name, dp.type_desc, dp.create_date
FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp ON dp.sid = sp.sid
WHERE dp.type IN ('S', 'U')
  AND sp.sid IS NULL
  AND dp.name NOT IN ('dbo', 'guest', 'INFORMATION_SCHEMA', 'sys');
-- Expected: empty result set

-- 3. Review server role memberships
PRINT '=== 3. Server Role Memberships ==='
SELECT r.name AS role_name, m.name AS member_name, m.type_desc
FROM sys.server_role_members srm
JOIN sys.server_principals r ON srm.role_principal_id = r.principal_id
JOIN sys.server_principals m ON srm.member_principal_id = m.principal_id
ORDER BY r.name, m.name;
-- Expected: only necessary sysadmin members

-- 4. Review database-level permissions
PRINT '=== 4. Database Permissions ==='
USE analytics_db;
SELECT dp.name AS principal_name, dp.type_desc,
    perm.permission_name, perm.state_desc,
    SCHEMA_NAME(o.schema_id) AS schema_name, o.name AS object_name
FROM sys.database_permissions perm
JOIN sys.database_principals dp ON perm.grantee_principal_id = dp.principal_id
LEFT JOIN sys.objects o ON perm.major_id = o.object_id
WHERE dp.name NOT IN ('dbo', 'guest', 'public', 'INFORMATION_SCHEMA', 'sys')
ORDER BY dp.name, schema_name, object_name;

-- 5. Verify TDE is still active and certificate is valid
PRINT '=== 5. TDE Status ==='
SELECT
    db.name,
    db.is_encrypted,
    c.name AS cert_name,
    c.expiry_date AS cert_expiry,
    DATEDIFF(DAY, GETDATE(), c.expiry_date) AS days_until_cert_expiry,
    dek.encryption_state,
    dek.key_algorithm,
    dek.key_length
FROM sys.databases db
JOIN sys.dm_database_encryption_keys dek ON db.database_id = dek.database_id
JOIN sys.certificates c ON dek.encryptor_thumbprint = c.thumbprint
WHERE db.name = 'analytics_db';
-- ALERT if days_until_cert_expiry < 180: renew certificate!

-- 6. Check for unencrypted connections
PRINT '=== 6. Connection Encryption Status ==='
SELECT encrypt_option, COUNT(*) AS connections,
    STRING_AGG(DISTINCT login_name, ', ') AS logins
FROM sys.dm_exec_connections
GROUP BY encrypt_option;
-- Expected: only TRUE

-- 7. Review recent failed logins (last 90 days)
PRINT '=== 7. Failed Login Summary (Last 90 Days) ==='
SELECT client_ip, server_principal_name, COUNT(*) AS failed_count,
    MIN(event_time) AS first_failure, MAX(event_time) AS last_failure
FROM sys.fn_get_audit_file('/var/opt/mssql/audit/*.sqlaudit', DEFAULT, DEFAULT)
WHERE action_id = 'LGIF'
  AND event_time > DATEADD(DAY, -90, GETUTCDATE())
GROUP BY client_ip, server_principal_name
ORDER BY failed_count DESC;

-- 8. Review permission changes (last 90 days)
PRINT '=== 8. Permission Changes (Last 90 Days) ==='
SELECT
    event_time,
    action_id,
    server_principal_name,
    object_name,
    statement
FROM sys.fn_get_audit_file('/var/opt/mssql/audit/*.sqlaudit', DEFAULT, DEFAULT)
WHERE action_id IN ('G ', 'D ', 'R ', 'CR', 'AL', 'DR')
  AND event_time > DATEADD(DAY, -90, GETUTCDATE())
ORDER BY event_time DESC;
```

#### Quarterly security review — checklist of audit actions

| Check | Action if Failed |
|-------|-----------------|
| sa login is disabled | `ALTER LOGIN sa DISABLE;` |
| No orphaned users | `DROP USER <orphaned_user>;` |
| TDE cert expiry > 180 days | Rotate certificate (see [[tde-encryption]]) |
| Password last set > 90 days | `ALTER LOGIN x WITH PASSWORD = '...' MUST_CHANGE` |
| Unexpected sysadmin members | `ALTER SERVER ROLE sysadmin DROP MEMBER <login>` |
| Unencrypted connections found | Verify `forceencryption = 1` in mssql.conf, restart |
| Failed logins from unknown IPs | Update firewall rules, investigate source |

### Related

- [[tde-encryption]] — Encryption at rest for database files
- [[server-configuration]] — OS-level and SQL Server configuration settings
- [[high-availability-overview]] — Certificate-based authentication for AG endpoints
- [[essential-dba-queries]] — DMV queries for monitoring connections and sessions

### References

- [SQL Server Security Best Practices (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/security/security-center-for-sql-server-database-engine-and-azure-sql-database)
- [SQL Server Audit (Microsoft Docs)](https://learn.microsoft.com/en-us/sql/relational-databases/security/auditing/sql-server-audit-database-engine)
- [GCP IAM Best Practices](https://cloud.google.com/iam/docs/using-iam-securely)
