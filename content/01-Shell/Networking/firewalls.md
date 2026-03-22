---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [concept, foundations, bash, networking, linux, security, gcp]
aliases: [ufw, iptables, firewall, GCP firewall, network security, defense in depth, Windows Firewall]
keywords: [ufw, iptables, firewall, GCP firewall rules, VPC firewall, allow rule, deny rule, default deny, port 1433, SQL Server firewall, IAP firewall, defense in depth, VPC Service Controls, New-NetFirewallRule, Get-NetFirewallRule, network security]
description: "Configuring Linux ufw, GCP VPC firewall rules, and Windows Firewall for secure database and infrastructure access. Covers the defense-in-depth model: VPC firewall + OS firewall + strong authentication + no public IP."
related: ["[[connectivity-testing]]", "[[iap-tunneling]]", "[[socket-inspection]]", "[[environment-variables]]" ]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Firewalls — Controlling Access to Your Data

Every production database should be accessible ONLY from authorized sources. A SQL Server port open to the internet is a security incident waiting to happen. Firewalls are your perimeter defense — and relying on only one layer is not enough.

## Linux (ufw — Uncomplicated Firewall)

```bash
# Check firewall status
sudo ufw status verbose
# Shows: active/inactive, default policies, all rules

# Allow SQL Server from a specific subnet only
sudo ufw allow from 10.132.0.0/24 to any port 1433 proto tcp
# from 10.132.0.0/24 = only the VPC subnet (not the internet)
# port 1433 = SQL Server
# proto tcp = TCP protocol
# This is how you should configure database access — never "allow 1433 from anywhere"

# Allow SSH (for IAP tunneling)
sudo ufw allow from 35.235.240.0/20 to any port 22 proto tcp
# 35.235.240.0/20 = Google's IAP IP range
# Only allows SSH from Google's tunnel, not from the internet

# Deny everything by default, then allow specific traffic
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
# This is the correct default: deny all incoming, allow all outgoing
# Then add specific allow rules for the services you need

# View rules with numbers (for deletion)
sudo ufw status numbered
# Delete a specific rule
sudo ufw delete 3

# Check if GCP firewall is blocking (from any machine with gcloud)
gcloud compute firewall-rules list --format="table(name,direction,allowed[].map().firewall_rule().ip_protocol.list():label=PROTOCOL,allowed[].map().firewall_rule().ports.list():label=PORTS,sourceRanges.list():label=SRC_RANGES)"
```

## Defense in Depth

> [!warning] Never Rely on a Single Firewall Layer
> Never rely on a single firewall. Your SQL Server should be protected by ALL of these:
> 1. **GCP VPC firewall**: Block port 1433 from external IPs at the network level
> 2. **Linux ufw/iptables**: Block port 1433 from unauthorized internal IPs at the OS level
> 3. **SQL Server login**: Require strong passwords and specific login names
> 4. **No public IP**: Remove the VM's external IP entirely — use IAP tunneling for SSH
> 5. **VPC Service Controls**: Prevent data exfiltration from the project (GCP Enterprise)
>
> If any ONE layer fails or is misconfigured, the others still protect you.

> [!tip] IAP Firewall Rule
> For [[iap-tunneling]] to work, you must have a GCP firewall rule allowing TCP port 22 from the IAP IP range `35.235.240.0/20`. Without this rule, `gcloud compute ssh` will time out even if the VM is running.

## PowerShell (Windows Firewall)

```powershell
# List active firewall rules
Get-NetFirewallRule | Where-Object Enabled -eq True |
    Select-Object DisplayName, Direction, Action | Sort-Object DisplayName

# Allow SQL Server from specific IP
New-NetFirewallRule -DisplayName "SQL Server - Pipeline" `
    -Direction Inbound -LocalPort 1433 -Protocol TCP -Action Allow `
    -RemoteAddress "10.132.0.0/24"

# Remove a rule
Remove-NetFirewallRule -DisplayName "SQL Server - Pipeline"

# Block everything by default
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block
```

## Related
- [[connectivity-testing]] — diagnose "connection timed out" (firewall) vs "connection refused" (no service)
- [[iap-tunneling]] — access VMs without opening public ports at all
- [[socket-inspection]] — verify which ports are actually listening before writing firewall rules
- [[environment-variables]] — never hardcode credentials in firewall rule scripts
