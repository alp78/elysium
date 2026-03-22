---
type: reference
category: reference
technology: [docker]
tags: [reference, cheat-sheet, docker]
aliases: [Docker cheat sheet, docker quick reference, container cheat sheet]
keywords: [docker, cheat sheet, quick reference, container, compose, image, build, run, logs, exec, ps, stop, rm, prune]
description: "Quick reference cheat sheet for Docker and Docker Compose commands — container lifecycle, image management, logs, and cleanup."
related:
  - "[[container-lifecycle]]"
  - "[[docker-compose]]"
  - "[[image-management]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Docker Cheat Sheet

## Container Lifecycle

```bash
docker ps                          # Running containers
docker ps -a                       # All containers (including stopped)
docker start CONTAINER             # Start stopped container
docker stop CONTAINER              # Graceful stop (SIGTERM, then SIGKILL after 10s)
docker restart CONTAINER           # Stop + start
docker rm CONTAINER                # Remove stopped container
docker logs CONTAINER --tail 100 -f  # Follow last 100 lines
docker exec -it CONTAINER bash     # Shell into running container
docker stats                       # Live resource usage
docker inspect CONTAINER           # Full metadata JSON
```

See [[container-lifecycle]].

## Docker Compose

```bash
docker compose up -d               # Start all services (detached)
docker compose down                # Stop and remove containers
docker compose build               # Rebuild images
docker compose build --no-cache    # Rebuild from scratch
docker compose logs -f SERVICE     # Follow logs for one service
docker compose restart SERVICE     # Restart one service
docker compose ps                  # List running services
```

See [[docker-compose]].

## Image Management

```bash
docker build -t NAME:TAG .         # Build from Dockerfile
docker build -t NAME:TAG -f Dockerfile.prod .  # Specific Dockerfile
docker images                      # List local images
docker tag IMAGE REGISTRY/IMAGE:TAG  # Tag for registry
docker push REGISTRY/IMAGE:TAG     # Push to registry
docker pull IMAGE                  # Pull from registry
docker image inspect IMAGE         # Show layers, size, config
```

See [[image-management]].

## Cleanup

```bash
docker system df                   # Show disk usage
docker system prune -a             # Remove all unused images, containers, networks
docker volume prune                # Remove unused volumes
docker image prune -a              # Remove all unused images
```

> [!warning] Prune with Caution
> `docker system prune -a` removes ALL images not used by a running container. This means you will need to re-pull or rebuild everything. Use `--filter` to scope cleanup.

## Exit Code Reference

| Code | Meaning |
|------|---------|
| 0 | Clean exit |
| 1 | Application error |
| 137 | Killed (SIGKILL) — often OOM |
| 139 | Segfault (SIGSEGV) |
| 143 | Terminated (SIGTERM) — graceful stop |
