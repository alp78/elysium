---
type: troubleshooting
category: observability
technology: [datadog, docker, gcp, sql-server, terraform]
tags: [monitoring, observability, sql, terraform, docker, datadog, gcp]
aliases: [Datadog Troubleshooting, DD Agent Troubleshooting, Datadog Common Issues]
keywords: [agent not appearing, invalid API key, APM traces missing, no logs, COS filesystem, read-only opt, ghost hosts, ghost host, INACTIVE host, Windows line endings, CRLF, bash\r, terraform apply metadata, VM reset, dd-api-key missing, Airflow VM, startup script, Cloud Run metrics not showing, pipeline logs not in Datadog, Cloud Logging]
description: "Troubleshooting guide for Datadog agent issues on the data platform — covering agent not appearing, missing APM traces, no logs, COS filesystem constraints, ghost hosts, and Windows line ending issues."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Datadog Troubleshooting

> [!quote]
> "A good culture can work around broken tooling, but the opposite rarely holds true."
> — **Niall Richard Murphy**

Common issues with the Datadog agent and observability setup for the data platform. For pipeline-specific errors (missing APM traces root cause), see also common pipeline errors.

---

## Agent Not Appearing in Datadog

```bash
# SSH into VM
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap

# Check agent is running
docker ps | grep dd-agent

# Check agent status
docker exec dd-agent agent status

# Check agent logs for errors
docker logs dd-agent --tail 50
```

#### Datadog Agent Not Appearing — common issues and fixes

- **No container:** API key is empty in VM metadata. Check `terraform output` and re-apply.
- **"Invalid API key":** Wrong key in `terraform.tfvars`. API keys are 32 chars, not 40. The Application key is 40 chars — do not confuse them.
- **Agent unhealthy:** Normal for the first ~2 minutes while checks initialize.

---

## APM Traces Not Appearing

#### Step 1 — Check dd-agent is running on the Airflow VM

```powershell
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b \
  --tunnel-through-iap --command="sudo docker ps -a --filter name=dd-agent"
```

**Step 2 — If dd-agent is not running**, the most likely cause is missing `dd-api-key` in VM metadata. This happened during the Cloud SQL to SQL VM migration — the key was added to the SQL VM but accidentally omitted from the Airflow VM.

**Step 3 — Fix: add `dd-api-key` to Airflow VM metadata** in `infra/compute.tf`:

```hcl
metadata = {
  startup-script = replace(file("${path.module}/scripts/airflow-startup.sh"), "\r\n", "\n")
  dd-api-key     = var.dd_api_key    # ← THIS LINE
  enable-oslogin = "TRUE"
}
```

#### Step 4 — Apply and reset the VM

```powershell
terraform -chdir=infra apply -target="google_compute_instance.airflow"
gcloud compute instances reset data-pipeline-airflow --zone=europe-west1-b
```

> [!warning] Apply does not restart the VM
>
> `terraform apply` only updates the VM's **metadata** stored in GCP — it does NOT restart the VM or re-run the startup script. The startup script only executes on boot. You must manually reset the VM after applying metadata changes.

#### Step 5 — Wait 2–3 minutes, then verify

```powershell
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b \
  --tunnel-through-iap --command="sudo docker ps"
```

All 5 containers (4 Airflow + dd-agent) should show status `Up`.

#### If dd-agent is running but traces still don't appear

1. Check APM status: `docker exec dd-agent agent status | grep -A 10 "APM Agent"`
   - Expected: `Status: Running`, `Receiver: 0.0.0.0:8126`
2. Check firewall: verify `data-pipeline-allow-apm` exists allowing TCP 8126 from `10.0.0.0/24`
3. Check port mapping: dd-agent must have `-p 8126:8126` (not just Docker network exposure)
4. Check `DD_APM_NON_LOCAL_TRAFFIC`: must be `true`
5. Check Cloud Run VPC: must have `egress = "PRIVATE_RANGES_ONLY"`
6. Test connectivity from the VM: `curl -s http://localhost:8126/info | head -5`

---

### terraform apply Updated Metadata But Agent Did Not Restart

`terraform apply` only updates the VM's **metadata** stored in GCP — it does NOT restart the VM or re-run the startup script. The startup script only executes on boot.

If you changed metadata (e.g., added `dd-api-key`, updated startup script), manually reset the VM:

```powershell
gcloud compute instances reset data-pipeline-airflow --zone=europe-west1-b
```

Wait 2–3 minutes for the startup script to complete. Then verify:

```powershell
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b \
  --tunnel-through-iap --command="sudo docker ps"
```

---

### No Logs Appearing in Datadog Log Explorer

```bash
# Check agent log collection status
docker exec dd-agent agent status | grep -A 20 "Logs Agent"
```

Expected: `Logs: xx logs sent`. If 0:

- Docker socket may not be mounted: check `-v /var/run/docker.sock:/var/run/docker.sock:ro`
- `DD_LOGS_ENABLED` not set to `true`

In Datadog, use **Logs > Live Tail** (not Log Explorer) to see logs in real time. New accounts may show an onboarding wizard — Live Tail bypasses it.

For SQL Server log collection issues, see [datadog-sql-server-logs](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-logs).

---

### COS Read-Only Filesystem Constraints for dd-agent

Container-Optimized OS has a **read-only root filesystem**. Paths like `/opt` are not writable:

```bash
# This fails on COS:
-v /opt/datadog-agent/run:/opt/datadog-agent/run:rw

# Use /var/lib instead:
mkdir -p /var/lib/datadog-agent/run
-v /var/lib/datadog-agent/run:/opt/datadog-agent/run:rw
```

This is already handled correctly in the startup script's `docker run` command.

---

### Windows Line Endings (CRLF) Breaking Startup Script

If the VM shows `env: 'bash\r': No such file or directory`, the startup script has Windows CRLF line endings. The fix is in `infra/compute.tf`:

```hcl
metadata = {
  startup-script = replace(file("${path.module}/scripts/airflow-startup.sh"), "\r\n", "\n")
}
```

This `replace()` call strips Windows CR characters before uploading the script as metadata.

---

### Ghost Hosts Appearing in Datadog Infrastructure

When the API key is changed, the old agent may leave a ghost host entry. Ghost hosts show as INACTIVE and auto-disappear after ~2 hours. To list hosts via API:

```bash
curl -s -X GET "https://api.datadoghq.eu/api/v1/hosts?filter=data-pipeline" \
  -H "DD-API-KEY: <api-key>" \
  -H "DD-APPLICATION-KEY: <app-key>"
```

The Docker-internal PostgreSQL IP (e.g., `172.18.0.3`) also appears as a separate host — this is normal, caused by the Autodiscovery Postgres check resolving `%%host%%` to the container's bridge IP. It auto-resolves.

---

### Cloud Run Metrics Not Showing in Datadog

Cloud Run jobs are ephemeral — no Datadog Agent runs inside them. Metrics come from the **GCP Integration** (see [datadog-gcp-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration)). If no Cloud Run metrics appear:

1. Verify GCP Integration is set up in Datadog (**Integrations > Google Cloud Platform**)
2. Check the Datadog SA has `monitoring.viewer` role
3. GCP metrics can take 5–10 minutes to appear after integration setup
4. Use `job_name:data-pipeline-pipeline` as the filter (not `service:data-pipeline-pipeline`)

---

### Pipeline Logs Not Appearing in Datadog

Cloud Run job logs go to **GCP Cloud Logging**, not through dd-agent. They are not available in Datadog's Log Explorer. View them via:

```powershell
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=data-pipeline-pipeline" \
  --limit=50 --format="table(timestamp,textPayload)"
```

---

## Agent Management Commands

### Airflow VM (Docker-based agent on COS)

SSH into the VM first:

```powershell
gcloud compute ssh data-pipeline-airflow --zone=europe-west1-b --tunnel-through-iap
```

| Task | Command |
|------|---------|
| View agent logs | `docker logs dd-agent --tail 50` |
| Full agent status | `docker exec dd-agent agent status` |
| Quick health check | `docker exec dd-agent agent health` |
| Restart agent | `docker restart dd-agent` |
| Test APM port | `curl -s http://localhost:8126/info | head -5` |

### SQL VM (package-based agent on Ubuntu)

SSH into the VM first:

```powershell
gcloud compute ssh data-pipeline-sql --zone=europe-west1-b --tunnel-through-iap
```

| Task | Command |
|------|---------|
| Full agent status | `sudo datadog-agent status` |
| Check SQL Server integration | `sudo datadog-agent check sqlserver` |
| View agent logs | `sudo journalctl -u datadog-agent --no-pager -n 50` |
| Restart agent | `sudo systemctl restart datadog-agent` |
| Stop agent | `sudo systemctl stop datadog-agent` |
| Start agent | `sudo systemctl start datadog-agent` |

### Config File Locations (SQL VM)

| File | Purpose |
|------|---------|
| `/etc/datadog-agent/datadog.yaml` | Main agent config (API key, hostname, tags) |
| `/etc/datadog-agent/conf.d/sqlserver.d/conf.yaml` | SQL Server integration (connection, custom queries) |
| `/etc/datadog-agent/conf.d/sqlserver.d/logs.yaml` | SQL Server log collection |

---

### Disabling Datadog Agents and Integrations

When the trial ends or you want to remove Datadog:

1. Set `dd_api_key = ""` in `terraform.tfvars`
2. Run `terraform apply` — conditional resources are destroyed
3. SSH into Airflow VM and remove the agent: `docker rm -f dd-agent`
4. SSH into SQL VM and stop the agent: `sudo systemctl disable datadog-agent && sudo systemctl stop datadog-agent`
5. Revert Dockerfile entrypoint:
   ```dockerfile
   ENTRYPOINT ["python", "utils/run_pipeline.py"]
   ```
6. Remove `ddtrace>=2.10.0` from `requirements.txt`
7. Rebuild and push the pipeline image
8. The logger and run_pipeline trace code no-ops automatically (`ImportError` guard)

One `terraform apply` + one image rebuild cleans up everything.

---

## Related Notes

- [datadog-architecture-overview](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-architecture-overview) — full observability architecture
- [datadog-agent-airflow-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-airflow-vm) — Airflow VM agent setup
- [datadog-agent-sql-vm](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-agent-sql-vm) — SQL VM agent setup
- [datadog-apm-traces](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-apm-traces) — APM trace instrumentation
- [datadog-sql-server-logs](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-sql-server-logs) — SQL Server log collection
- [datadog-gcp-integration](https://alp78.github.io/elysium/13-Observability/Datadog/datadog-gcp-integration) — GCP Cloud Run metrics integration
- common pipeline errors — project-specific error reference including Datadog issues
