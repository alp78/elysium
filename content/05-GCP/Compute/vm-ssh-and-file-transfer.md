---
type: concept
category: gcp
technology: [gcp, compute-engine]
tags: [concept, gcp, compute-engine, ssh, security]
aliases: [gcloud compute ssh, gcloud compute scp, IAP tunnel, VM remote access, VM file transfer]
keywords: [gcloud compute ssh, IAP, Identity-Aware Proxy, tunnel-through-iap, scp, file transfer, remote command, secure copy, no public IP, pscp, permission denied, sudo cp, SSH into VM]
description: "How to SSH into Compute Engine VMs through the IAP tunnel (no public IP required), run remote commands non-interactively, and copy files to and from VMs using gcloud compute scp."
related: [vm-lifecycle, disks-and-snapshots, service-accounts-and-iam, vpc-service-controls, gcloud-authentication]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# VM SSH and File Transfer — Secure Remote Access

`gcloud compute ssh` and `gcloud compute scp` provide secure, certificate-based access to Compute Engine VMs through Google's Identity-Aware Proxy (IAP) tunnel. The IAP tunnel routes traffic through Google's internal network, meaning VMs do not need a public IP address — a significant security improvement over traditional public SSH. This is the production-standard access method for GCE VMs.

## SSH into a VM

```bash
# SSH into a VM (through IAP tunnel — no public IP needed)
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
# --tunnel-through-iap = route through Identity-Aware Proxy
# IAP tunnel: your SSH traffic goes through Google's proxy → GCP internal network → VM
# The VM does NOT need a public IP. This is the secure way to access VMs.
```

> [!tip] No Public IP Required
> Using `--tunnel-through-iap` means your VM can have no external IP address at all. This eliminates an entire attack surface — the VM is completely unreachable from the public internet, yet you can still SSH into it using your gcloud credentials.

## Running Remote Commands Non-Interactively

```bash
# Run a command without interactive session
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
  --command="free -h && df -h && sudo docker stats --no-stream"
# --command = execute this string remotely and return the output
# Multiple commands with && = only runs next if previous succeeded
# Use case: quick health check without opening an interactive session
```

## Copying Files To and From VMs

```bash
# Copy files to/from a VM
gcloud compute scp local_file.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap
gcloud compute scp data-pipeline-airflow:/tmp/output.csv ./local/ --zone=europe-west1-b --tunnel-through-iap
# scp = secure copy (over SSH)
# Direction: local → remote OR remote → local (the hostname: prefix determines direction)

# Copy multiple files
gcloud compute scp file1.py file2.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap

# Recursive directory copy
gcloud compute scp --recurse ./dags/ data-pipeline-airflow:/tmp/dags/ --zone=europe-west1-b --tunnel-through-iap
```

## Handling Permission Errors on SCP

> [!warning] Permission Errors on SCP
> `gcloud compute scp` logs in as your username, which may not have write access to the target directory (e.g., `/opt/airflow/dags/` owned by UID 50000). Fix:
> ```bash
> # Step 1: SCP to /tmp/ (writable by everyone)
> gcloud compute scp local_file.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap
> # Step 2: SSH in and sudo cp to the target
> gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap \
>   --command="sudo cp /tmp/local_file.py /opt/airflow/dags/ && sudo chown 50000:0 /opt/airflow/dags/local_file.py"
> ```
> On Windows with `pscp`, remember: it doesn't expand `~` — always use absolute paths.

## IAP Tunnel Architecture

```
Your machine ──► Google IAP Proxy ──► GCP Internal Network ──► VM (private IP only)
```

IAP authenticates you using your gcloud credentials and your IAM role (`roles/iap.tunnelResourceAccessor`). The VM never sees a public IP connection — all traffic is internal to Google's network after the IAP proxy.

## Prerequisites for IAP Access

- `roles/iap.tunnelResourceAccessor` IAM role on the project or VM resource
- `compute.googleapis.com` API enabled (see [[gcp-projects-and-apis]])
- Firewall rule allowing IAP's IP range (`35.235.240.0/20`) on TCP port 22

## Related

- [[vm-lifecycle]] — Starting and stopping the VMs you SSH into
- [[disks-and-snapshots]] — Using serial console when SSH is unavailable
- [[service-accounts-and-iam]] — IAM roles required for IAP tunnel access
- [[vpc-service-controls]] — VPC-SC may restrict IAP access patterns
- [[gcloud-authentication]] — Your gcloud credentials are used for IAP authentication

## References

- [IAP TCP forwarding documentation](https://cloud.google.com/iap/docs/using-tcp-forwarding)
- [gcloud compute ssh reference](https://cloud.google.com/sdk/gcloud/reference/compute/ssh)
