---
type: reference
category: reference
technology: [docker]
tags: [docker]
aliases: [Docker cheat sheet, docker quick reference, container cheat sheet]
keywords: [docker, cheat sheet, quick reference, container, compose, image, build, run, logs, exec, ps, stop, rm, prune, volume, network, dockerfile, buildx]
description: "Exhaustive CLI reference for Docker and Docker Compose — container lifecycle, image management, volumes, networks, Dockerfile instructions, and system cleanup."
related:
  - "[[container-lifecycle]]"
  - "[[docker-compose]]"
  - "[[image-management]]"
created: 2026-03-22
updated: 2026-03-23
status: stable
---

# Docker Cheat Sheet

## CLI Anatomy

```
docker [GLOBAL_OPTIONS] COMMAND [OPTIONS] [ARGS]
```

| Global Option | Effect |
|---|---|
| `--config PATH` | Custom client config directory (default `~/.docker`) |
| `-c, --context NAME` | Use named Docker context |
| `-D, --debug` | Enable debug output |
| `-H, --host HOST` | Daemon socket to connect to (`unix:///var/run/docker.sock`, `tcp://host:2376`) |
| `-l, --log-level` | Log level: `debug`, `info`, `warn`, `error`, `fatal` |
| `--tls / --tlsverify` | TLS options for remote daemons |

---

## Container Lifecycle

### `docker run` — Full Anatomy

```
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

| Flag | Description |
|---|---|
| `-d, --detach` | Run in background, print container ID |
| `-it` | `-i` keeps STDIN open; `-t` allocates a pseudo-TTY — combine for interactive shells |
| `--rm` | Automatically remove container when it exits |
| `--name NAME` | Assign a name instead of a random one |
| `-p, --publish HOST:CONTAINER` | Map host port to container port (`8080:80`, `127.0.0.1:8080:80`) |
| `-P, --publish-all` | Publish all exposed ports to random host ports |
| `-v, --volume SRC:DST[:opts]` | Bind mount or named volume (`ro`, `z`, `Z`) |
| `--mount type=...,src=...,dst=...` | Explicit mount syntax (preferred for clarity) |
| `-e, --env KEY=VAL` | Set environment variable (repeatable) |
| `--env-file FILE` | Read environment variables from a file |
| `--network NETWORK` | Connect to a network (`bridge`, `host`, `none`, or named) |
| `--restart POLICY` | Restart policy: `no`, `always`, `on-failure[:N]`, `unless-stopped` |
| `--memory LIMIT` | Memory limit (`512m`, `2g`) |
| `--memory-swap LIMIT` | Total memory + swap limit (`-1` = unlimited swap) |
| `--cpus DECIMAL` | Number of CPUs (`0.5`, `2`) |
| `--cpu-shares INT` | Relative CPU weight (default 1024) |
| `--user USER[:GROUP]` | Run as this user/group |
| `--workdir DIR` | Working directory inside container |
| `--entrypoint CMD` | Override the image ENTRYPOINT |
| `--privileged` | Give extended privileges (full host device access) |
| `--read-only` | Mount container root filesystem as read-only |
| `--label KEY=VAL` | Set metadata label |
| `--health-cmd CMD` | Command to test container health |
| `--health-interval DUR` | Time between health checks (default `30s`) |
| `--health-retries N` | Consecutive failures before `unhealthy` (default `3`) |
| `--pull POLICY` | Pull image before run: `always`, `missing` (default), `never` |
| `--init` | Run an init process (PID 1) to reap zombies |
| `--hostname NAME` | Set container hostname |
| `--add-host HOST:IP` | Add entry to `/etc/hosts` |
| `--dns IP` | Custom DNS server |
| `--log-driver DRIVER` | Logging driver (`json-file`, `syslog`, `fluentd`, `none`) |
| `--log-opt KEY=VAL` | Driver-specific log options |
| `--tmpfs PATH` | Mount a tmpfs at path |
| `--devices PATH` | Map host device into container |
| `--cap-add CAP` | Add Linux capability |
| `--cap-drop CAP` | Drop Linux capability |
| `--security-opt OPT` | Security options (`no-new-privileges`, `seccomp=profile.json`) |
| `--pid MODE` | PID namespace: `host` |
| `--ipc MODE` | IPC namespace: `host`, `shareable`, `container:ID` |
| `--ulimit TYPE=SOFT:HARD` | Set ulimits (`nofile=1024:1024`) |
| `--runtime RUNTIME` | Container runtime (`runc`, `nvidia`) |
| `--platform OS/ARCH` | Force a specific platform image |
| `--stop-timeout SEC` | Timeout before SIGKILL on stop (default `10`) |
| `--stop-signal SIGNAL` | Signal to stop the container (default `SIGTERM`) |
| `--cidfile FILE` | Write container ID to file |

**Minimal variant**

```bash
docker run --rm -it ubuntu:24.04 bash
```

**Production variant**

```bash
docker run -d \
  --name api \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --env-file .env.production \
  --mount type=volume,src=api-data,dst=/data \
  --memory 512m --cpus 1 \
  --read-only \
  --tmpfs /tmp \
  --user 1001:1001 \
  --health-cmd "curl -sf http://localhost:8080/health || exit 1" \
  --health-interval 30s \
  --security-opt no-new-privileges \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  myregistry.io/api:1.2.3
```

---

### Start / Stop / Lifecycle Commands

```bash
docker start CONTAINER [CONTAINER...]       # Start one or more stopped containers
docker start -a -i CONTAINER               # Attach + interactive on start
docker stop CONTAINER [CONTAINER...]        # Graceful stop: SIGTERM, then SIGKILL after 10s
docker stop -t 30 CONTAINER               # Custom timeout (seconds) before SIGKILL
docker restart CONTAINER                   # Stop + start
docker restart --time 5 CONTAINER         # Restart with 5s stop timeout
docker pause CONTAINER                     # Suspend all processes (SIGSTOP cgroup freeze)
docker unpause CONTAINER                   # Resume paused container
docker kill CONTAINER                      # Send SIGKILL immediately
docker kill -s SIGUSR1 CONTAINER          # Send custom signal
docker rm CONTAINER [CONTAINER...]         # Remove stopped container(s)
docker rm -f CONTAINER                    # Force remove running container
docker rm -v CONTAINER                    # Remove container + anonymous volumes
docker container prune                     # Remove all stopped containers
docker container prune --filter "until=24h"  # Remove containers stopped >24h ago
```

---

### `docker exec` — Run Command in Running Container

```
docker exec [OPTIONS] CONTAINER COMMAND [ARG...]
```

| Flag | Description |
|---|---|
| `-i, --interactive` | Keep STDIN open |
| `-t, --tty` | Allocate pseudo-TTY |
| `-u, --user USER` | Run as user |
| `-w, --workdir DIR` | Working directory |
| `-e, --env KEY=VAL` | Set environment variable |
| `-d, --detach` | Run in background |
| `--privileged` | Run with elevated privileges |

```bash
docker exec -it CONTAINER bash            # Interactive shell
docker exec -it -u root CONTAINER bash    # Shell as root
docker exec -w /app CONTAINER ls -la     # Run in specific directory
docker exec -e DEBUG=1 CONTAINER ./run   # With extra env var
docker exec CONTAINER cat /etc/hosts     # Non-interactive one-off
```

---

### `docker logs` — Fetch Container Logs

```
docker logs [OPTIONS] CONTAINER
```

| Flag | Description |
|---|---|
| `-f, --follow` | Stream output continuously |
| `--tail N` | Show last N lines (default `all`) |
| `--since TIME` | Show logs since timestamp or relative (`30m`, `2h`, `2026-01-01T00:00:00`) |
| `--until TIME` | Show logs before timestamp |
| `-t, --timestamps` | Show timestamps |
| `--details` | Show extra attributes set with `--log-opt` |

```bash
docker logs -f CONTAINER                  # Follow all logs
docker logs --tail 100 CONTAINER          # Last 100 lines
docker logs --since 10m CONTAINER         # Last 10 minutes
docker logs -t --since 1h CONTAINER       # With timestamps, last hour
docker logs --since 2026-01-15T00:00:00 --until 2026-01-15T06:00:00 CONTAINER
```

---

### `docker inspect` — Return Low-Level Metadata

```bash
docker inspect CONTAINER                  # Full JSON output
docker inspect --format '{{.State.Status}}' CONTAINER        # Container status
docker inspect --format '{{.NetworkSettings.IPAddress}}' CONTAINER
docker inspect --format '{{json .HostConfig.Binds}}' CONTAINER
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' CONTAINER
docker inspect --format '{{.Config.Env}}' CONTAINER          # Environment variables
docker inspect IMAGE                      # Inspect an image
```

---

### Other Container Commands

```bash
docker stats                               # Live CPU/mem/net/IO for all containers
docker stats --no-stream                  # One-shot snapshot
docker stats CONTAINER [CONTAINER...]     # Specific containers only
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

docker top CONTAINER                       # Running processes inside container
docker top CONTAINER aux                  # With custom ps options

docker port CONTAINER                      # List port mappings
docker port CONTAINER 80                  # Mapping for specific port

docker cp SRC CONTAINER:DST               # Copy from host into container
docker cp CONTAINER:SRC DST              # Copy from container to host
docker cp - CONTAINER:DST                # Stream tar from stdin

docker update --memory 1g --cpus 2 CONTAINER   # Update resource limits live
docker update --restart always CONTAINER        # Change restart policy live

docker rename OLD_NAME NEW_NAME           # Rename a container

docker wait CONTAINER                      # Block until container stops, print exit code
docker attach CONTAINER                   # Attach stdin/stdout/stderr to running container
docker diff CONTAINER                     # Show filesystem changes (A=added, C=changed, D=deleted)
```

---

### `docker container ls` — List Containers

```
docker container ls [OPTIONS]     (alias: docker ps)
```

| Flag | Description |
|---|---|
| `-a, --all` | Show all containers (default shows running only) |
| `-q, --quiet` | Only display IDs |
| `-n N` | Show N last created containers |
| `-l, --latest` | Show latest created container |
| `-s, --size` | Show file sizes |
| `--filter KEY=VAL` | Filter by field (see below) |
| `--format TEMPLATE` | Custom Go template output |
| `--no-trunc` | Don't truncate output |

```bash
docker ps                                  # Running containers
docker ps -a                              # All containers
docker ps -aq                             # All container IDs (useful for bulk ops)
docker ps --filter status=exited          # Only stopped
docker ps --filter name=api               # By name pattern
docker ps --filter ancestor=nginx         # Containers using an image
docker ps --filter label=env=production   # By label
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Bulk remove all stopped containers
docker rm $(docker ps -aq -f status=exited)
```

---

## Image Management

### `docker build` — Build an Image from a Dockerfile

```
docker build [OPTIONS] PATH | URL | -
```

| Flag | Description |
|---|---|
| `-t, --tag NAME:TAG` | Name and tag the image (repeatable) |
| `-f, --file FILE` | Path to Dockerfile (default `./Dockerfile`) |
| `--no-cache` | Do not use cache when building |
| `--build-arg KEY=VAL` | Set a build-time ARG variable (repeatable) |
| `--target STAGE` | Build up to a specific multi-stage target |
| `--platform OS/ARCH` | Target platform (`linux/amd64`, `linux/arm64`) |
| `--pull` | Always pull a newer version of the base image |
| `--progress TYPE` | Progress output: `auto`, `plain`, `tty`, `quiet` |
| `--secret id=ID,src=FILE` | Expose secret to build (BuildKit required) |
| `--ssh default` | Forward SSH agent socket to build |
| `--label KEY=VAL` | Set image metadata label |
| `--network MODE` | Network mode during build (`host`, `none`, `bridge`) |
| `--compress` | Compress build context with gzip |
| `--squash` | Squash newly built layers (experimental) |
| `--cache-from IMAGE` | Images to consider as cache sources |
| `--cache-to TYPE=...` | Export cache to location |
| `--output type=...` | Export build result outside image store |
| `--iidfile FILE` | Write image ID to file |
| `-q, --quiet` | Suppress build output, print image ID on success |

```bash
# Minimal
docker build -t myapp:latest .

# With specific Dockerfile and build args
docker build -t myapp:1.0 -f docker/Dockerfile.prod \
  --build-arg VERSION=1.0 \
  --build-arg COMMIT_SHA=$(git rev-parse --short HEAD) \
  --no-cache .

# Multi-stage: build only the 'test' stage
docker build --target test -t myapp:test .

# Multi-platform (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myregistry.io/myapp:latest --push .

# With secret (BuildKit)
DOCKER_BUILDKIT=1 docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -t myapp:latest .
```

---

### Image Commands

```bash
docker images                              # List images (alias: docker image ls)
docker images -a                          # Include intermediate layers
docker images -q                          # IDs only
docker images --filter dangling=true      # Untagged/dangling images only
docker images --filter reference="myapp:*"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

docker pull IMAGE[:TAG]                   # Pull from registry (default tag: latest)
docker pull IMAGE:TAG --platform linux/arm64
docker pull --all-tags REPOSITORY         # Pull all tags

docker push REGISTRY/IMAGE:TAG            # Push to registry
docker push --all-tags REGISTRY/IMAGE     # Push all tags

docker tag SOURCE TARGET                   # Create alias tag
docker tag myapp:latest myregistry.io/myapp:1.0

docker rmi IMAGE [IMAGE...]               # Remove image(s)
docker rmi -f IMAGE                       # Force remove (even if tagged)

docker image prune                         # Remove dangling images
docker image prune -a                     # Remove all unused images
docker image prune -a --filter "until=72h"

docker save IMAGE -o archive.tar          # Export image(s) to tar archive
docker save IMAGE | gzip > archive.tar.gz # Compressed export
docker save img1 img2 -o multi.tar        # Multiple images

docker load -i archive.tar                # Import image from archive
docker load < archive.tar                 # From stdin

docker history IMAGE                       # Show image layers
docker history --no-trunc IMAGE           # Full commands
docker history --format "table {{.ID}}\t{{.CreatedBy}}\t{{.Size}}" IMAGE

docker image inspect IMAGE                # Full image metadata JSON
docker image inspect --format '{{.Config.Cmd}}' IMAGE
docker image inspect --format '{{.RootFS.Layers}}' IMAGE  # Layer digests
```

---

### Buildx — Extended Build Capabilities

```bash
docker buildx ls                           # List builders
docker buildx create --name mybuilder --use  # Create and activate builder
docker buildx inspect --bootstrap          # Inspect/bootstrap current builder
docker buildx rm mybuilder                # Remove builder

# Multi-platform build and push
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t myregistry.io/myapp:latest \
  --push .

# Build with cache export to registry
docker buildx build \
  --cache-from type=registry,ref=myregistry.io/myapp:cache \
  --cache-to type=registry,ref=myregistry.io/myapp:cache,mode=max \
  -t myregistry.io/myapp:latest \
  --push .

# Build for local Docker daemon (single platform)
docker buildx build --load -t myapp:latest .
```

---

## Docker Compose

### `docker compose up` — Full Anatomy

```
docker compose [OPTIONS] up [UP_OPTIONS] [SERVICE...]
```

**Compose global options** (before the subcommand):

| Flag | Description |
|---|---|
| `-f, --file FILE` | Compose file(s) (repeatable, merged in order) |
| `-p, --project-name NAME` | Project name (default: directory name) |
| `--profile PROFILE` | Enable service profiles (repeatable) |
| `--env-file FILE` | Specify `.env` file |
| `--project-directory PATH` | Alternate working directory |
| `--ansi WHEN` | Control ANSI color: `never`, `always`, `auto` |
| `--progress TYPE` | Progress output: `auto`, `tty`, `plain`, `quiet` |

#### `up` options

| Flag | Description |
|---|---|
| `-d, --detach` | Run in background |
| `--build` | Build images before starting |
| `--no-build` | Skip building, fail if image doesn't exist |
| `--force-recreate` | Recreate containers even if config hasn't changed |
| `--no-recreate` | Don't recreate if already running |
| `--no-deps` | Don't start linked dependencies |
| `--scale SERVICE=N` | Set number of replicas for a service |
| `--remove-orphans` | Remove containers for services not in compose file |
| `--wait` | Wait for all services to be healthy before returning |
| `--wait-timeout N` | Timeout in seconds when using `--wait` (default `0` = unlimited) |
| `--pull POLICY` | Pull image policy: `always`, `missing`, `never` |
| `--quiet-pull` | Pull without printing progress |
| `--timestamps` | Show timestamps in log output |
| `--no-color` | Disable color in output |
| `--no-log-prefix` | Don't print service name prefix in logs |
| `-t, --timeout SEC` | Use this timeout when shutting down |
| `--renew-anon-volumes, -V` | Recreate anonymous volumes instead of reusing |

```bash
# Start all services detached
docker compose up -d

# Rebuild then start
docker compose up -d --build

# Full production restart
docker compose up -d --build --force-recreate --remove-orphans

# Scale a service
docker compose up -d --scale worker=4

# Wait for health checks
docker compose up -d --wait --wait-timeout 120

# Use non-default files
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Enable a profile
docker compose --profile debug up -d
```

---

### Compose Subcommands

```bash
# DOWN — stop and remove containers, networks
docker compose down                        # Keep volumes and images
docker compose down -v                    # Also remove named volumes
docker compose down --rmi local           # Remove images built locally
docker compose down --rmi all             # Remove all referenced images
docker compose down --remove-orphans

# PS — list services
docker compose ps                          # Running services
docker compose ps -a                      # All (including stopped)
docker compose ps --services              # Service names only
docker compose ps --filter status=running

# LOGS
docker compose logs                        # All services
docker compose logs -f SERVICE            # Follow specific service
docker compose logs --tail 50 SERVICE
docker compose logs -t SERVICE            # With timestamps

# EXEC — run command in a running service container
docker compose exec SERVICE bash          # Interactive shell
docker compose exec -u root SERVICE bash
docker compose exec -w /app SERVICE ls
docker compose exec -e DEBUG=1 SERVICE ./run
docker compose exec --index=2 SERVICE bash  # When scaled (select replica)

# RUN — run one-off command in a new container
docker compose run --rm SERVICE bash
docker compose run --rm --no-deps SERVICE python manage.py migrate
docker compose run --rm -e CI=true SERVICE pytest
docker compose run --rm -p 8080:8080 SERVICE  # With port mapping

# BUILD
docker compose build                       # Build all service images
docker compose build SERVICE              # Build specific service
docker compose build --no-cache           # No cache
docker compose build --pull               # Always pull base images
docker compose build --progress plain     # Verbose output

# PULL
docker compose pull                        # Pull all images
docker compose pull SERVICE               # Specific service

# RESTART
docker compose restart                     # Restart all
docker compose restart SERVICE            # Specific service
docker compose restart -t 5 SERVICE       # Custom stop timeout

# STOP / START / PAUSE / UNPAUSE
docker compose stop SERVICE
docker compose start SERVICE
docker compose pause SERVICE
docker compose unpause SERVICE

# CONFIG — validate and view merged config
docker compose config                      # Full resolved config
docker compose config --services          # Service names
docker compose config --volumes           # Volume names
docker compose config --quiet             # Validate only (exit code signals errors)

# TOP — display running processes
docker compose top
docker compose top SERVICE

# PORT — print public port for a service
docker compose port SERVICE PRIVATE_PORT

# KILL / RM
docker compose kill -s SIGTERM            # Send signal to services
docker compose rm -f -v                   # Remove stopped containers + volumes

# COPY
docker compose cp SERVICE:SRC DST        # Copy from service to host
docker compose cp SRC SERVICE:DST        # Copy from host to service
```

---

## Volume Management

### Volume Commands

```bash
docker volume create VOLUME                # Create a named volume
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.1,rw \
  --opt device=:/data/nfs \
  nfs-volume

docker volume ls                           # List volumes
docker volume ls -q                       # IDs only
docker volume ls --filter dangling=true   # Unused volumes
docker volume ls --filter driver=local

docker volume inspect VOLUME              # Full metadata
docker volume inspect --format '{{.Mountpoint}}' VOLUME   # Host path

docker volume rm VOLUME [VOLUME...]       # Remove volume(s)
docker volume prune                        # Remove all unused volumes
docker volume prune --filter "label!=keep"
```

---

### Mount Types Comparison

| Attribute | `-v / --volume` | `--mount type=bind` | `--mount type=volume` | `--mount type=tmpfs` |
|---|---|---|---|---|
| Syntax | `src:dst:opts` | explicit key=value | explicit key=value | explicit key=value |
| Source | host path or volume name | host path (must exist or be created) | Docker-managed volume | none (in-memory) |
| Created if missing | Yes (volume), No (bind) | No — error | Yes | n/a |
| Read-only | `:ro` | `readonly` | `readonly` | — |
| Propagation | `:shared,:slave` | `bind-propagation=` | — | — |
| Recommended for | quick CLI work | explicit bind mounts | production volumes | ephemeral, secret files |

```bash
# Named volume
docker run --mount type=volume,src=mydata,dst=/data IMAGE

# Bind mount (absolute host path required)
docker run --mount type=bind,src=$(pwd)/config,dst=/etc/app/config,readonly IMAGE

# tmpfs (stored in memory, never written to disk)
docker run --mount type=tmpfs,dst=/tmp,tmpfs-size=100m IMAGE

# Volume with old -v syntax equivalents
docker run -v mydata:/data IMAGE                    # Named volume
docker run -v $(pwd)/config:/etc/config:ro IMAGE    # Bind, read-only
docker run -v /tmp IMAGE                            # Anonymous volume
```

---

## Network Management

### Network Commands

```bash
docker network create NETWORK             # Create network (default driver: bridge)
docker network create --driver bridge NETWORK
docker network create --driver overlay --attachable NETWORK   # Swarm overlay
docker network create \
  --driver bridge \
  --subnet 192.168.100.0/24 \
  --gateway 192.168.100.1 \
  --ip-range 192.168.100.128/25 \
  --label env=production \
  mynet

docker network ls                          # List networks
docker network ls --filter driver=bridge
docker network ls -q

docker network inspect NETWORK            # Full metadata
docker network inspect --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}' NETWORK

docker network rm NETWORK [NETWORK...]    # Remove network(s)
docker network prune                       # Remove unused networks
docker network prune --filter "until=24h"

docker network connect NETWORK CONTAINER          # Attach container to network
docker network connect --ip 192.168.100.10 NETWORK CONTAINER  # With static IP
docker network connect --alias myalias NETWORK CONTAINER

docker network disconnect NETWORK CONTAINER       # Detach container from network
docker network disconnect -f NETWORK CONTAINER    # Force
```

### Built-in Network Drivers

| Driver | Description |
|---|---|
| `bridge` | Default; isolated network on host with NAT |
| `host` | Container shares host network stack (no isolation) |
| `none` | Disables all networking |
| `overlay` | Multi-host networking (Docker Swarm) |
| `macvlan` | Assign MAC address; appear as physical devices on network |
| `ipvlan` | Like macvlan but shares host MAC address |

---

## System and Cleanup

```bash
docker system df                           # Disk usage summary
docker system df -v                       # Verbose (per image/container/volume)

docker system info                         # Full daemon configuration and stats
docker system info --format '{{.ServerVersion}}'

docker system prune                        # Remove stopped containers, unused networks, dangling images
docker system prune -a                    # + all unused images (not just dangling)
docker system prune -a --volumes          # + unused volumes (DESTRUCTIVE)
docker system prune --filter "until=72h"  # Only resources older than 72h
docker system prune -af --filter "label!=keep"  # Respecting labels

# Individual pruning
docker container prune                     # Stopped containers
docker image prune -a                     # Unused images
docker volume prune                        # Unused volumes
docker network prune                       # Unused networks

# Manual full cleanup sequence
docker container prune -f
docker image prune -af
docker volume prune -f
docker network prune -f
```

### Exit Code Reference

| Code | Signal | Meaning |
|---|---|---|
| `0` | — | Clean exit |
| `1` | — | Application error |
| `125` | — | Docker daemon error |
| `126` | — | Command cannot be invoked |
| `127` | — | Command not found |
| `130` | SIGINT | Ctrl+C / interrupted |
| `137` | SIGKILL | Killed — often OOM |
| `139` | SIGSEGV | Segmentation fault |
| `143` | SIGTERM | Graceful stop (docker stop) |

---

## Dockerfile Reference

### Every Instruction

| Instruction | Syntax | Notes |
|---|---|---|
| `FROM` | `FROM IMAGE[:TAG] [AS name]` | Must be first; `AS name` for multi-stage |
| `RUN` | `RUN command` or `RUN ["exec", "arg"]` | Creates a new layer; shell vs exec form |
| `CMD` | `CMD ["exec", "arg"]` or `CMD command` | Default command; overridden by `docker run CMD` |
| `ENTRYPOINT` | `ENTRYPOINT ["exec", "arg"]` | Fixed executable; `CMD` appended as args |
| `COPY` | `COPY [--chown=U:G] SRC... DST` | Copy from build context |
| `ADD` | `ADD [--chown=U:G] SRC... DST` | Like COPY + auto-extracts tar + supports URLs |
| `ENV` | `ENV KEY=VALUE` | Set environment variable (persists in image) |
| `ARG` | `ARG NAME[=default]` | Build-time variable; not persisted in image |
| `WORKDIR` | `WORKDIR /path` | Sets working directory; creates if missing |
| `EXPOSE` | `EXPOSE PORT[/protocol]` | Document intended port (does NOT publish) |
| `VOLUME` | `VOLUME ["/data"]` | Create mount point; auto-creates anonymous volume |
| `USER` | `USER user[:group]` | Switch user for subsequent instructions |
| `LABEL` | `LABEL key=value` | Add metadata key-value pairs |
| `HEALTHCHECK` | `HEALTHCHECK [opts] CMD command` | Define health probe |
| `SHELL` | `SHELL ["executable", "params"]` | Override default shell for RUN/CMD/ENTRYPOINT |
| `STOPSIGNAL` | `STOPSIGNAL signal` | Signal to stop the container |
| `ONBUILD` | `ONBUILD INSTRUCTION` | Trigger instruction when image used as base |

---

### CMD vs ENTRYPOINT Interaction

| Dockerfile | `docker run IMAGE` | `docker run IMAGE arg` |
|---|---|---|
| `ENTRYPOINT ["ep"]` + `CMD ["default"]` | `ep default` | `ep arg` |
| `ENTRYPOINT ["ep"]` only | `ep` | `ep arg` |
| `CMD ["cmd"]` only | `cmd` | `arg` (CMD replaced) |
| Neither | error (no command) | `arg` |
| `ENTRYPOINT` shell form + `CMD` | CMD ignored | CMD ignored |

> Use `ENTRYPOINT` for the fixed executable and `CMD` for default arguments. Always prefer exec form (`["..."]`) for both — shell form wraps in `/bin/sh -c`, which makes signal handling unreliable.

---

### COPY vs ADD

| Feature | `COPY` | `ADD` |
|---|---|---|
| Copy from context | Yes | Yes |
| Copy from URL | No | Yes |
| Auto-extract `.tar*` | No | Yes |
| Transparent / auditable | Yes | No |
| **Recommendation** | **Prefer for local files** | Only for tar extraction |

---

### Multi-Stage Build Pattern

```dockerfile
# Stage 1: Build
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/bin/server ./cmd/server

# Stage 2: Test
FROM builder AS test
RUN go test ./...

# Stage 3: Production image
FROM gcr.io/distroless/static-debian12 AS production
COPY --from=builder /app/bin/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
```

```bash
docker build --target test -t myapp:test .        # Build only test stage
docker build --target production -t myapp:prod .  # Production image
```

---

### .dockerignore

```
# Dependencies (rebuilt inside image)
node_modules/
vendor/

# Build artifacts
dist/
build/
*.o
*.a

# Version control
.git/
.gitignore

# Secrets and config
.env
.env.*
*.pem
*.key
secrets/

# Local dev files
docker-compose*.yml
*.md
.DS_Store
.vscode/
```

---

### HEALTHCHECK Options

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:8080/health || exit 1

HEALTHCHECK NONE  # Disable inherited healthcheck
```

| Option | Default | Description |
|---|---|---|
| `--interval` | `30s` | Time between checks |
| `--timeout` | `30s` | Timeout per check |
| `--start-period` | `0s` | Grace period before checks count as failures |
| `--retries` | `3` | Consecutive failures to mark `unhealthy` |

---

## Formatting and Filtering

### Go Template Format Examples

```bash
# Containers
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker ps --format "{{.ID}}: {{.Names}} ({{.Status}})"
docker inspect --format '{{.State.Running}}' CONTAINER
docker inspect --format '{{index .Config.Labels "com.example.version"}}' CONTAINER

# Images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"
docker images --format "{{.Repository}}:{{.Tag}}"

# Networks
docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"

# Volumes
docker volume ls --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"

# JSON output (pipe to jq)
docker inspect CONTAINER | jq '.[0].NetworkSettings.Networks'
docker inspect CONTAINER --format '{{json .State}}' | jq
```

### Filter Examples

```bash
# Containers (docker ps --filter)
--filter status=running          # running, paused, exited, dead, created, restarting
--filter name=myapp              # partial name match
--filter label=env=production
--filter ancestor=nginx:latest   # based on this image
--filter before=CONTAINER        # created before this container
--filter since=CONTAINER         # created after this container
--filter publish=8080            # published port
--filter expose=80/tcp           # exposed port

# Images (docker images --filter)
--filter dangling=true           # untagged images
--filter label=maintainer=team
--filter before=IMAGE
--filter since=IMAGE
--filter reference="myapp:*"

# Volumes
--filter dangling=true           # not referenced by any container
--filter label=env=production
--filter name=myvolume

# Prune (docker system prune / image prune / etc.)
--filter until=24h               # older than 24h
--filter until=2026-01-01T00:00:00
--filter label=env=staging       # only matching label
--filter label!=keep             # exclude label
```

---

## Registry Operations

```bash
docker login                               # Login to Docker Hub
docker login myregistry.io                # Login to private registry
docker login -u USER -p PASS myregistry.io
docker logout myregistry.io               # Remove stored credentials

# Typical push workflow
docker build -t myregistry.io/org/myapp:1.0.0 .
docker push myregistry.io/org/myapp:1.0.0
docker tag myregistry.io/org/myapp:1.0.0 myregistry.io/org/myapp:latest
docker push myregistry.io/org/myapp:latest
```

---

## Related

- [[container-lifecycle]]
- [[docker-compose]]
- [[image-management]]
