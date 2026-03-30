---
type: concept
category: foundations
technology: [bash, powershell, gcp]
tags: [shell, bash, linux, powershell, gcp, security, networking]
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

### ufw — Linux Uncomplicated Firewall for port access control

#### ufw status — check firewall state and rules

```bash
sudo ufw status verbose
```

#### ufw allow — permit traffic from specific subnets

> [!info] Scope ufw rules to source ranges
>
> Always scope `allow` rules to specific source ranges. `sudo ufw allow 1433`
> (without `from`) opens the port to the **entire internet**. Always specify a source.

```bash
sudo ufw allow from 10.132.0.0/24 to any port 1433 proto tcp
sudo ufw allow from 35.235.240.0/20 to any port 22 proto tcp
```

#### ufw default deny — the correct baseline for production servers

> [!info] Default deny baseline
>
> Set default policy to deny all incoming, allow all outgoing. Then add specific
> `allow` rules for the services you need. This ensures new ports are blocked by default.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

> [!warning] ufw enable can lock you out
>
> If you haven't added a rule allowing SSH **before** running `ufw enable`, you lose SSH
> access immediately. Always run `sudo ufw allow from YOUR_IP to any port 22` (or allow
> IAP range) **before** enabling the firewall.

#### ufw delete — remove rules by number

```bash
sudo ufw status numbered
sudo ufw delete 3
```

#### gcloud compute firewall-rules list — check GCP-level firewall

> [!info] GCP and OS firewalls are separate
>
> GCP VPC firewall rules are separate from OS-level firewalls. Both must allow
> traffic. A common debugging pattern: `ufw` allows port 1433 but the GCP firewall
> doesn't, so `nc -zv` still times out.

```bash
gcloud compute firewall-rules list \
    --format="table(name,direction,allowed,sourceRanges)"
```

### Defense in depth — layered firewall strategy for production databases

> [!warning] Defense in depth
>
> Never rely on a single firewall. Your SQL Server should be protected by ALL of these:
> 1. **GCP VPC firewall**: Block port 1433 from external IPs at the network level (manage declaratively with [terraform-networking](/07-Terraform/GCP-Resources/terraform-networking))
> 2. **Linux ufw/iptables**: Block port 1433 from unauthorized internal IPs at the OS level
> 3. **SQL Server login**: Require strong passwords and specific login names (see [service-accounts-and-iam](/06-GCP/Security/service-accounts-and-iam) for IAM-based access)
> 4. **No public IP**: Remove the VM's external IP entirely — use IAP tunneling for SSH
> 5. **[vpc-service-controls](/06-GCP/Security/vpc-service-controls)**: Prevent data exfiltration from the project (GCP Enterprise)
>
> If any ONE layer fails or is misconfigured, the others still protect you.

> [!tip] IAP firewall rule
>
> For [[iap-tunneling]] to work, you must have a GCP firewall rule allowing TCP port 22 from the IAP IP range `35.235.240.0/20`. Without this rule, `gcloud compute ssh` will time out even if the VM is running.

### PowerShell — Windows Firewall with New-NetFirewallRule

#### Get-NetFirewallRule — list active Windows Firewall rules

```powershell
Get-NetFirewallRule | Where-Object Enabled -eq True |
    Select-Object DisplayName, Direction, Action | Sort-Object DisplayName
```

#### New-NetFirewallRule — allow SQL Server from a specific subnet

> [!info] Scope RemoteAddress to subnet
>
> Always scope `-RemoteAddress` to the VPC subnet. Without it, the rule allows
> connections from any IP.

```powershell
New-NetFirewallRule -DisplayName "SQL Server - Pipeline" `
    -Direction Inbound -LocalPort 1433 -Protocol TCP -Action Allow `
    -RemoteAddress "10.132.0.0/24"
```

#### Set-NetFirewallProfile — block all inbound by default

```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private `
    -DefaultInboundAction Block
```

## Related
- [[connectivity-testing]] — diagnose "connection timed out" (firewall) vs "connection refused" (no service)
- [[iap-tunneling]] — access VMs without opening public ports at all
- [[socket-inspection]] — verify which ports are actually listening before writing firewall rules
- [[environment-variables]] — never hardcode credentials in firewall rule scripts
