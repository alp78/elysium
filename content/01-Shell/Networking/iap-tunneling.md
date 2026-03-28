---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [shell, bash, gcp]
aliases: [IAP, Identity-Aware Proxy, IAP tunnel, gcloud start-iap-tunnel, iap.tunnelInstances.accessTunnelResourceAccessor]
keywords: [IAP, Identity-Aware Proxy, IAP tunnel, gcloud start-iap-tunnel, gcloud compute ssh, tunnel-through-iap, local-host-port, SQL Server tunnel, SSMS IAP, no public IP, secure connectivity, GCE access, VPN alternative, bastion host alternative, IAP debugging, 35.235.240.0/20, IAP IP range]
description: "Google Cloud IAP (Identity-Aware Proxy) tunneling for secure access to VMs with no public IP. Covers how IAP works at the network level, all tunnel command variants, debugging common failures, and comparison with Cloud VPN and bastion hosts."
related: ["[[connectivity-testing]]", "[[firewalls]]", "[[socket-inspection]]", "[[connecting-to-gcp-resources]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# IAP Tunneling — Secure Connectivity Without Public IPs

Identity-Aware Proxy (IAP) is Google Cloud's way to let you access VMs that have no public IP. It's the backbone of secure GCE connectivity: your SSH sessions, database connections, and even SSMS all travel through IAP when configured correctly. Understanding how IAP tunneling works at the network level — not just "run this gcloud command" — is what separates debugging in minutes from debugging in hours.

## How IAP Tunneling Works — The Full Path

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Your Workstation (Windows)                                                   │
│                                                                              │
│  SSMS ──────► 127.0.0.1:1435 ──────► gcloud (IAP tunnel process)            │
│                (local listener)         │                                    │
│                                         │ HTTPS (port 443)                   │
│                                         ▼                                    │
│                              ┌─────────────────────┐                         │
│                              │ Google IAP Proxy     │                         │
│                              │ (authenticates you   │                         │
│                              │  via OAuth/gcloud)   │                         │
│                              └─────────┬───────────┘                         │
│                                        │ Internal GCP network                │
│                                        ▼                                     │
│                              ┌─────────────────────┐                         │
│                              │ Your VM (10.0.0.3)   │                         │
│                              │ port 1433 (SQL)      │                         │
│                              │ No public IP         │                         │
│                              └─────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────────────┘

Step by step:
1. gcloud opens a LOCAL listener on 127.0.0.1:1435 (your machine)
2. SSMS connects to 127.0.0.1:1435 (thinks it's a local SQL Server)
3. gcloud wraps the TCP traffic in HTTPS and sends it to Google's IAP proxy
4. IAP proxy verifies your Google identity (OAuth token from gcloud auth)
5. IAP proxy checks IAM: does this user have iap.tunnelInstances.accessTunnelResourceAccessor?
6. If authorized, IAP forwards the traffic over GCP's internal network to the VM
7. Traffic arrives at the VM's port 1433 as a normal TCP connection from within the VPC
8. SQL Server processes the query and sends the response back through the same tunnel
```

> [!info] The VM Never Sees Your Real IP
> The VM never sees your workstation's IP address. It sees a connection from an IP in the **GCP internal network** (typically in the `10.x.x.x` or `35.235.240.0/20` range). That's why `ss -tnp` on the VM shows a VPC-internal peer address, not your home IP.

> [!tip] Related pattern
> IAP requires the `iap.tunnelResourceAccessor` IAM role -- see [[service-accounts-and-iam]] for role binding patterns. The firewall rule allowing `35.235.240.0/20` can be managed declaratively with [[terraform-networking]].

## IAP Tunnel Commands — All Variants

#### gcloud compute start-iap-tunnel — port forwarding through IAP

```bash
# SSH through IAP (the most common use case)
# For additional SSH patterns and OS Login configuration, see [[vm-ssh-and-file-transfer]]
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
# Under the hood: opens IAP tunnel on an ephemeral port, then runs SSH through it
# This is a shortcut for: IAP tunnel → SSH → interactive shell

# TCP tunnel to a specific port (for databases, web UIs, etc.)
gcloud compute start-iap-tunnel data-pipeline-sql 1433 \
    --local-host-port=0.0.0.0:1435 \
    --zone=europe-west1-b
# data-pipeline-sql = VM instance name
# 1433 = REMOTE port on the VM (what you want to reach)
# --local-host-port=0.0.0.0:1435 = LOCAL address and port to listen on
#   0.0.0.0 = listen on all interfaces (needed if other machines connect to you)
#   127.0.0.1 = listen on loopback only (more secure, default if omitted)
#   1435 = local port number (use any free port — doesn't have to match remote)
#
# After this command, connect via: SSMS → 127.0.0.1,1435 (or just localhost,1435)
# For sqlcmd through the tunnel, see [[sqlcmd-connection-and-usage]]

# Multiple tunnels simultaneously (different terminals)
# Terminal 1: SQL Server
gcloud compute start-iap-tunnel data-pipeline-sql 1433 --local-host-port=127.0.0.1:1435 --zone=europe-west1-b
# Terminal 2: Airflow webserver
gcloud compute start-iap-tunnel data-pipeline-airflow 8080 --local-host-port=127.0.0.1:8080 --zone=europe-west1-b
# Terminal 3: PostgreSQL (Airflow metadata)
gcloud compute start-iap-tunnel data-pipeline-airflow 5432 --local-host-port=127.0.0.1:5432 --zone=europe-west1-b

# Each tunnel is an independent process — they don't interfere with each other
```

## Debugging IAP Tunnels

```bash
# Symptom: "gcloud compute start-iap-tunnel" hangs
# Cause 1: IAP API not enabled
gcloud services list --enabled | grep iap
# If empty: gcloud services enable iap.googleapis.com

# Cause 2: Missing IAM permission
gcloud projects get-iam-policy YOUR_PROJECT --format=json | grep -A 2 "tunnelResourceAccessor"
# You need: roles/iap.tunnelResourceAccessor on the project or VM

# Cause 3: Firewall blocking IAP's IP range
gcloud compute firewall-rules list --format="table(name,sourceRanges,allowed)" | grep 35.235.240
# IAP uses 35.235.240.0/20 — you need a firewall rule allowing this range to port 22 (SSH)
# and to whatever port you're tunneling (1433 for SQL Server)

# Cause 4: VM is stopped
gcloud compute instances describe data-pipeline-sql --zone=europe-west1-b --format="value(status)"
# Must be RUNNING

# Symptom: Tunnel opens but connections fail
# On the VM, check that the service is actually listening:
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
    --command="ss -tlnp | grep 1433"
# If no output: SQL Server is not running or is listening on a different port

# Symptom: Tunnel drops after a few minutes of inactivity
# IAP has a 10-minute idle timeout. Configure TCP keepalive:
gcloud compute start-iap-tunnel data-pipeline-sql 1433 \
    --local-host-port=127.0.0.1:1435 \
    --zone=europe-west1-b \
    --iap-tunnel-disable-connection-check
# Or configure your SQL client to send keepalive queries
```

## Verifying the Tunnel from Both Ends

```bash
# On your Windows workstation — check the local listener
# PowerShell:
Get-NetTCPConnection -LocalPort 1435 -State Listen
# Should show: gcloud.exe or python.exe (depending on your gcloud installation)

# Or test connectivity:
Test-NetConnection -ComputerName 127.0.0.1 -Port 1435 -InformationLevel Quiet
# True = tunnel is up. False = tunnel process died or port is wrong.

# Linux equivalent:
ss -tlnp | grep 1435
nc -zv 127.0.0.1 1435
```

```bash
# On the VM — check who is connected through the tunnel
ss -tnp | grep :1433
# Example output:
# ESTAB  0  0  10.0.0.3:1433  10.0.0.24:56434
# ESTAB  0  0  10.0.0.3:1433  10.0.0.24:26733
#
# 10.0.0.3 = your VM's internal IP
# 10.0.0.24 = the IAP proxy's internal IP (within GCP's VPC)
# 56434, 26733 = ephemeral ports (one per tunnel/session)
# Two ESTAB lines = two active connections (e.g., two SSMS query windows)
#
# NOTE: You will NOT see your workstation's public IP here.
# IAP terminates the tunnel at its proxy — the VM only sees internal GCP traffic.
```

## IAP vs VPN vs Bastion Host

> [!tip] IAP vs VPN vs Bastion Host
> Three ways to access private VMs. Here's when to use each:
>
> | Approach | Setup Complexity | Cost | Security | Use Case |
> |----------|-----------------|------|----------|----------|
> | **IAP Tunnel** | Low (just gcloud) | Free | High (Google-managed auth, per-user IAM) | Individual developer access, on-demand |
> | **Cloud VPN** | Medium (Terraform) | ~$35/month per tunnel | Medium (network-level, all-or-nothing) | Site-to-site, when many services need access |
> | **Bastion Host** | Medium (extra VM) | VM cost (~$25/month) | Medium (single point of entry) | Legacy setups, when IAP isn't available |
>
> For a small team accessing a few VMs, **IAP is always the right choice**. Zero infrastructure to maintain, zero cost, and per-user audit logging via Cloud Audit Logs.

## Related
- [[firewalls]] — IAP firewall rule for `35.235.240.0/20` on port 22
- [[connectivity-testing]] — diagnose IAP tunnel failures step by step
- [[socket-inspection]] — verify IAP connections visible on the VM side
- [[connecting-to-gcp-resources]] — full guide: IAP + SQL Server, Airflow, BigQuery
