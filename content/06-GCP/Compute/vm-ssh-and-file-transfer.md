---
type: concept
category: gcp
technology: [gcp, compute-engine]
tags: [infrastructure, gcp, compute-engine]
aliases: [gcloud compute ssh, gcloud compute scp, IAP tunnel, VM remote access, VM file transfer]
keywords: [gcloud compute ssh, IAP, Identity-Aware Proxy, tunnel-through-iap, scp, file transfer, remote command, secure copy, no public IP, pscp, permission denied, sudo cp, SSH into VM]
description: "How to SSH into Compute Engine VMs through the IAP tunnel (no public IP required), run remote commands non-interactively, and copy files to and from VMs using gcloud compute scp."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# VM SSH and File Transfer — Secure Remote Access

> [!quote]
> "Amateurs hack systems, professionals hack people."
>
> — **Bruce Schneier**, *Secrets and Lies* (2000)

`gcloud compute ssh` and `gcloud compute scp` provide secure, certificate-based access to Compute Engine VMs through Google's Identity-Aware Proxy (IAP) tunnel. The IAP tunnel routes traffic through Google's internal network, meaning VMs do not need a public IP address — a significant security improvement over traditional public SSH. This is the production-standard access method for GCE VMs.

### SSH into a Compute Engine VM via IAP

`--tunnel-through-iap` routes SSH traffic through Google's Identity-Aware Proxy into the GCP internal network, so the VM does not need a public IP. This is the secure, production-standard way to access VMs.

```bash
# SSH into a VM (through IAP tunnel — no public IP needed)
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
```

> [!tip] No Public IP Required
>
> Using `--tunnel-through-iap` means your VM can have no external IP address at all. This eliminates an entire attack surface — the VM is completely unreachable from the public internet, yet you can still SSH into it using your gcloud credentials.

### Running Remote Commands Non-Interactively on a VM

`--command` executes the given string remotely and returns the output without opening an interactive session. Chain multiple commands with `&&` (each runs only if the previous succeeded). Useful for quick health checks.

```bash
# Run a command without interactive session
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap \
  --command="free -h && df -h && sudo docker stats --no-stream"
```

### Copying Files To and From VMs with gcloud compute scp

The `scp` and `rsync` patterns here mirror the general [data-transfer](https://alp78.github.io/elysium/01-Shell/File-Operations/data-transfer) commands, but routed through the IAP tunnel. For VM provisioning via infrastructure-as-code, see [terraform-compute](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-compute).

`scp` performs secure copy over SSH. The `hostname:` prefix determines the direction: local to remote or remote to local.

```bash
# Copy files to/from a VM
gcloud compute scp local_file.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap
gcloud compute scp data-pipeline-airflow:/tmp/output.csv ./local/ --zone=europe-west1-b --tunnel-through-iap

# Copy multiple files
gcloud compute scp file1.py file2.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap

# Recursive directory copy
gcloud compute scp --recurse ./dags/ data-pipeline-airflow:/tmp/dags/ --zone=europe-west1-b --tunnel-through-iap
```

### Handling Permission Errors on SCP

> [!warning] Permission Errors on SCP
>
> `gcloud compute scp` logs in as your username, which may not have write access to the target directory (e.g., `/opt/airflow/dags/` owned by UID 50000). Fix:
> ```bash
> # Step 1: SCP to /tmp/ (writable by everyone)
> gcloud compute scp local_file.py data-pipeline-airflow:/tmp/ --zone=europe-west1-b --tunnel-through-iap
> # Step 2: SSH in and sudo cp to the target
> gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap \
>   --command="sudo cp /tmp/local_file.py /opt/airflow/dags/ && sudo chown 50000:0 /opt/airflow/dags/local_file.py"
> ```
> On Windows with `pscp`, remember: it doesn't expand `~` — always use absolute paths.

### IAP Tunnel Architecture for VM Access

```text
Your machine ──► Google IAP Proxy ──► GCP Internal Network ──► VM (private IP only)
```

IAP authenticates you using your gcloud credentials and your IAM role (`roles/iap.tunnelResourceAccessor`). The VM never sees a public IP connection — all traffic is internal to Google's network after the IAP proxy. For the full tunnel mechanics including port forwarding and troubleshooting, see [iap-tunneling](https://alp78.github.io/elysium/01-Shell/Networking/iap-tunneling).

### Prerequisites for IAP Access

- `roles/iap.tunnelResourceAccessor` IAM role on the project or VM resource
- `compute.googleapis.com` API enabled (see [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis))
- Firewall rule allowing IAP's IP range (`35.235.240.0/20`) on TCP port 22

## Related

- [vm-lifecycle](https://alp78.github.io/elysium/06-GCP/Compute/vm-lifecycle) — Starting and stopping the VMs you SSH into
- [disks-and-snapshots](https://alp78.github.io/elysium/06-GCP/Compute/disks-and-snapshots) — Using serial console when SSH is unavailable
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — IAM roles required for IAP tunnel access
- [vpc-service-controls](https://alp78.github.io/elysium/06-GCP/Security/vpc-service-controls) — VPC-SC may restrict IAP access patterns
- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/Core/gcloud-authentication) — Your gcloud credentials are used for IAP authentication

## References

- [IAP TCP forwarding documentation](https://cloud.google.com/iap/docs/using-tcp-forwarding)
- [gcloud compute ssh reference](https://cloud.google.com/sdk/gcloud/reference/compute/ssh)
