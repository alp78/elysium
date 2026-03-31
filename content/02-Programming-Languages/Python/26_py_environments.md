---
type: reference
category: programming-languages
technology: [python]
tags: [python, venv, pip, environments, dependencies]
aliases: [virtual environments, venv, pip, requirements.txt, pyenv, python environments]
keywords: [venv, pip, pip-tools, requirements.txt, pyenv, virtualenv, site-packages, pip freeze, pip install, docker python, cloud run python]
description: "Python environment and dependency management — venv creation, pip workflows, requirements.txt lifecycle, pyenv version management, Docker/CI/CD/GCP deployment patterns, and anti-patterns."
related:
  - "[[programming-languages-index]]"
created: 2026-03-30
updated: 2026-03-30
status: complete
---

# 26. Environments — Python

> [!quote]
> "Dependency management is the dark matter of software engineering — invisible but responsible for most of the catastrophic failures."
>
> — **Attributed to various DevOps practitioners**

## venv — why virtual environments exist

Two projects. Same machine. Project A needs `pandas==1.5.3` for a legacy ETL pipeline. Project B needs `pandas==2.1.4` for a new data lakehouse. Without isolation, `pip install pandas==2.1.4` overwrites 1.5.3 globally — and Project A silently breaks at 2 AM when the nightly batch job runs.

The system Python is shared across every project, every user, and every tool on the machine. On Linux, the OS itself depends on specific package versions — `apt` and `yum` use system Python internally. One careless `pip install` can corrupt the package manager that keeps the server patched.

Virtual environments solve this by creating a self-contained Python installation per project. Each venv has its own `python` binary, its own `pip`, and its own `site-packages` directory. Packages installed in one venv are invisible to every other venv and to the system Python.

> [!danger] The System Python Trap
>
> Installing packages with `pip install` outside a virtual environment modifies
> the system Python. On Linux, this can break OS tools that depend on specific
> package versions (`apt`, `yum` use system Python internally). On macOS,
> `pip install --user` partially helps but still pollutes the global namespace.
> ALWAYS use a virtual environment. There is no exception.

## venv — create and activate virtual environments

#### python -m venv — create a new virtual environment

```bash
# Create a virtual environment in the .venv directory
python -m venv .venv
```

> [!info] What python -m venv creates on disk
>
> The `.venv/` directory contains:
> - `Scripts/` (Windows) or `bin/` (Linux/macOS) — `python`, `pip`, `activate` scripts
> - `Lib/site-packages/` (Windows) or `lib/pythonX.Y/site-packages/` (Linux) — installed packages
> - `include/` — C header files for compiling extensions
> - `pyvenv.cfg` — configuration file pointing to the base Python installation
>
> The entire directory is 10-20 MB when empty. It grows as you install packages.

#### activate — switch your shell to use the virtual environment

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (Git Bash / MSYS2)
source .venv/Scripts/activate

# Linux / macOS
source .venv/bin/activate
```

> [!info] What activation actually does
>
> Activation does two things:
> 1. Prepends `.venv/Scripts/` (or `.venv/bin/`) to your `PATH` — so `python` and `pip` resolve to the venv copies
> 2. Sets the `VIRTUAL_ENV` environment variable — so tools can detect that a venv is active
>
> Your terminal prompt changes to show `(.venv)` as a visual indicator.
> Activation is a shell-level change — it only affects the current terminal session.

#### deactivate — exit the virtual environment

```bash
# Return to system Python
deactivate
```

> [!warning] Never Commit the venv Folder
>
> The `.venv/` directory contains platform-specific binaries (compiled C extensions,
> Python interpreter symlinks). It is NOT portable between machines, operating systems,
> or even Python versions. Add `.venv/` to `.gitignore` immediately after creation.
> The `requirements.txt` file is what gets committed — it's the reproducible
> specification, not the venv itself.

#### .gitignore — standard entries for Python projects

```bash
# Add to .gitignore immediately after creating the project
echo ".venv/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
echo ".mypy_cache/" >> .gitignore
```

> [!tip] VS Code Auto-Detection
>
> VS Code automatically detects `.venv/` in the project root and offers to select
> it as the Python interpreter. If you name your venv something else (like `env/`
> or `myenv/`), VS Code may not find it automatically. Stick with `.venv/`.

## pip — install packages into the virtual environment

#### pip install — add a package

```bash
# Install latest version
pip install pandas

# Install exact version (pinned)
pip install pandas==2.1.4

# Install version range
pip install "pandas>=2.0,<3.0"

# Install with optional extras
pip install "uvicorn[standard]"
```

#### pip install -r — install from a requirements file

```bash
# Install all production dependencies
pip install -r requirements.txt

# Install dev dependencies (which include production deps)
pip install -r requirements-dev.txt
```

#### pip install -e — editable/development install

> [!info] Editable installs for local package development
>
> `pip install -e .` installs the current project in "editable" mode — Python
> imports the package directly from your source directory instead of copying
> files into `site-packages`. Changes to your source code take effect immediately
> without reinstalling. This requires a `pyproject.toml` or `setup.py` in the project root.

```bash
# Install current project in editable mode
pip install -e .

# Install with dev extras in editable mode
pip install -e ".[dev]"
```

> [!danger] pip install Without a venv
>
> Running `pip install pandas` without an active virtual environment installs
> to the system Python or user site-packages. This is the #1 source of
> "it works on my machine" problems. If your terminal prompt doesn't show
> `(.venv)` before the path, STOP and activate your environment first.

> [!info] Transitive Dependencies
>
> When you install `pandas`, pip also installs `numpy`, `python-dateutil`, and
> `tzdata` — pandas' own dependencies. These are "transitive dependencies."
> You asked for one package; pip installed four. This is expected behavior,
> but it means your environment contains packages you never explicitly requested.
> `pip freeze` captures all of them.

## pip freeze — pin and freeze dependencies

#### pip freeze — snapshot all installed packages

```bash
# Write all installed packages with exact versions to requirements.txt
pip freeze > requirements.txt
```

> [!tip] pip freeze Captures Everything
>
> `pip freeze` outputs ALL packages — your direct dependencies AND their transitive
> dependencies. This is intentional: it makes the environment fully reproducible.
> But it also means upgrading one package requires re-freezing the entire tree.
> Tools like `pip-compile` from `pip-tools` separate "what you asked for" from
> "what got installed" — maintaining both an abstract `requirements.in` and a
> pinned `requirements.txt`.

#### pip-tools pip-compile — separate abstract from pinned dependencies

Create a `requirements.in` with your direct dependencies (loose constraints), then compile to a fully pinned `requirements.txt`:

```
# requirements.in — what you actually need
pandas>=2.0
fastapi>=0.100
pyodbc>=5.0
```

```bash
pip install pip-tools
pip-compile requirements.in --output-file requirements.txt
```

> [!info] pip-compile workflow
>
> `pip-compile` reads `requirements.in` (your direct dependencies with loose version
> constraints) and resolves the full dependency tree into `requirements.txt` (every
> package with exact pinned versions). To upgrade, run `pip-compile --upgrade`.
> This gives you the best of both worlds: readable intent in `.in`, reproducibility in `.txt`.

#### pip install --constraint — constrain without installing

```bash
# Constrain versions across multiple requirements files
pip install -r requirements.txt -c constraints.txt
```

> [!danger] Unpinned Dependencies in Production
>
> A `requirements.txt` with `pandas>=2.0` is a ticking time bomb. Today it installs
> 2.1.4. Next month, 2.2.0 is released with a breaking change in `DataFrame.merge()`.
> Your pipeline breaks in production with no code change. ALWAYS pin exact versions
> for production: `pandas==2.1.4`. Use ranges only in library development, never
> in application deployment.

## pip — upgrade and manage installed packages

#### pip install --upgrade — upgrade a package to latest

```bash
# Upgrade pip itself — do this FIRST in every new venv
python -m pip install --upgrade pip

# Upgrade a specific package
pip install --upgrade pandas
```

> [!tip] Upgrade pip First
>
> A freshly created venv ships with whatever pip version came with your Python
> installation — often months or years old. Old pip has slower dependency resolution,
> missing security fixes, and worse error messages. First command in any new venv:
> `python -m pip install --upgrade pip`

#### pip list --outdated — find packages with newer versions

```bash
# Show all packages that have newer versions available
pip list --outdated
```

#### pip show — inspect a single package

```bash
# Show package metadata: version, location, dependencies, dependents
pip show pandas
```

```
Name: pandas
Version: 2.1.4
Summary: Powerful data structures for data analysis
Home-page: https://pandas.pydata.org
Location: .venv/lib/python3.12/site-packages
Requires: numpy, python-dateutil, tzdata
Required-by:
```

#### pip uninstall — remove a package

```bash
# Remove a package (does NOT remove its transitive dependencies)
pip uninstall pandas
```

> [!warning] pip uninstall Doesn't Clean Up
>
> `pip uninstall pandas` removes pandas but leaves numpy, python-dateutil, and
> tzdata behind — even if nothing else needs them. Over time, the venv accumulates
> orphaned packages. The cleanest approach: delete the venv, recreate it, and
> install from `requirements.txt`. This is why pinned requirements matter —
> they let you rebuild a clean environment in seconds.

#### pip check — verify dependency compatibility

```bash
# Verify all installed packages have compatible dependencies
pip check
```

#### pip cache purge — clear the download cache

```bash
# Clear cached wheel files to free disk space
pip cache purge
```

## pip — inspect the active environment

#### python --version and which python — confirm what's active

```bash
# Check Python version
python --version

# Check WHICH Python binary is running (Linux/macOS)
which python

# Check WHICH Python binary is running (Windows)
where python

# Check pip version and which Python it's attached to
pip --version
```

> [!question] Which Python Am I Using?
>
> Run `which python` (or `where python` on Windows) and check the output.
> If it points to `/usr/bin/python` or `C:\Python312\python.exe` — you're on
> the system Python, NOT in a venv. If it points to `.venv/bin/python` or
> `.venv/Scripts/python.exe` — you're in the venv. This is the first thing to
> check when "it works on my machine but not in CI" — the CI runner may be
> using a different Python than you think.

#### sys.prefix — programmatic venv check

```python
# Confirm venv is active from within Python
import sys
sys.prefix  # Prefix
sys.base_prefix  # Base prefix
sys.prefix != sys.base_prefix  # In venv
```

#### pip list — all installed packages

```bash
# List all packages in the active environment
pip list

# Same output as pip freeze (pinned format)
pip list --format=freeze
```

#### Locating a package on disk

```python
# Find where a package is physically installed
import pandas
pandas.__file__
# .venv/lib/python3.12/site-packages/pandas/__init__.py
```

## requirements.txt — the dependency specification lifecycle

#### requirements.txt — production dependencies (pinned)

> [!danger] requirements.txt Without Pinned Versions
>
> ```
> # BAD — will break eventually
> pandas
> polars
> fastapi
> ```
>
> ```
> # GOOD — reproducible forever
> pandas==2.1.4
> polars==0.20.5
> fastapi==0.109.0
> ```
>
> The first format installs "whatever is latest today." The second installs
> exactly what you tested against. In production, the first is a guaranteed
> future outage. The second is a guaranteed identical environment.

```
# requirements.txt — production dependencies (pinned)
pandas==2.1.4
polars==0.20.5
pyodbc==5.1.0
pydantic==2.5.3
tenacity==8.2.3
sqlalchemy==2.0.25
fastapi==0.109.0
uvicorn==0.27.0
```

#### requirements-dev.txt — development extras that extend production

```
# requirements-dev.txt — development extras
-r requirements.txt
pytest==7.4.4
pytest-cov==4.1.0
black==24.1.0
mypy==1.8.0
ruff==0.1.14
```

> [!tip] requirements-dev.txt Extends Production
>
> The `-r requirements.txt` line at the top of `requirements-dev.txt` includes
> all production dependencies plus adds dev tools. This ensures developers
> test against the SAME package versions that run in production, plus they
> get pytest, linters, and formatters.

#### Full lifecycle — create, install, freeze, rebuild

```bash
# 1. Create and activate
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# 2. Upgrade pip
python -m pip install --upgrade pip

# 3. Install from requirements
pip install -r requirements.txt

# 4. Add a new dependency
pip install httpx==0.27.0

# 5. Re-freeze to capture the addition
pip freeze > requirements.txt

# 6. Commit the updated requirements.txt
git add requirements.txt
git commit -m "Add httpx for async HTTP client"
```

#### Updating a single package

```bash
# Upgrade one package, then re-freeze
pip install --upgrade pandas
pip freeze > requirements.txt
```

#### Comments and line options in requirements files

```
# Comments start with #
# Blank lines are ignored

# Editable install of a local package
-e .

# Install from a Git repository
-e git+https://github.com/org/repo.git@v2.0#egg=mypackage

# Constrain file
-c constraints.txt

# Index URL override
--extra-index-url https://pypi.company.com/simple/
```

## pyenv — manage multiple Python versions

#### Why the Python minor version matters

> [!warning] Python 3.x Minor Version Matters
>
> Python 3.9 and 3.12 are not interchangeable. Match expressions (3.10+),
> `tomllib` (3.11+), exception groups (3.11+), and significant performance
> improvements (3.11 is 25% faster than 3.10) mean the minor version choice
> affects both features and speed. Pin your Python version in CI
> (`actions/setup-python@v5` with `python-version: '3.12'`) and in Docker
> (`FROM python:3.12-slim`). Never use `python:latest`.

#### python --version — check what's installed

```bash
# Check the active Python version
python --version
# Python 3.12.0

# Check all available Python binaries (Linux)
ls /usr/bin/python*
```

#### Creating a venv with a specific Python version

```bash
# Use a specific Python version to create the venv
python3.12 -m venv .venv

# On Windows with multiple versions installed via python.org
py -3.12 -m venv .venv
```

#### pyenv — install and switch between Python versions

> [!info] pyenv basics
>
> `pyenv` manages multiple Python installations on a single machine. It intercepts
> the `python` command and routes it to whichever version is configured for the
> current directory. This is useful when different projects require different
> Python minor versions. pyenv works on Linux and macOS; on Windows, use `pyenv-win`.

```bash
# Install pyenv (Linux/macOS via Homebrew)
brew install pyenv

# Install a specific Python version
pyenv install 3.12.0

# Set the global default
pyenv global 3.12.0

# Set a per-directory version (creates .python-version file)
pyenv local 3.11.7

# List installed versions
pyenv versions
```

#### .python-version — per-project Python version pinning

```bash
# Create .python-version in the project root
echo "3.12.0" > .python-version
```

> [!tip] Pin Python version at every level
>
> Pin your Python version in THREE places:
> 1. `.python-version` (or pyenv local) — for local development
> 2. `Dockerfile` — `FROM python:3.12-slim`
> 3. CI/CD — `python-version: '3.12'` in GitHub Actions
>
> If any of these drift, you get "works on my machine" failures.

## docker — Python environments in containers

#### Dockerfile — the standard Python container pattern

> [!tip] No venv in Docker
>
> You do NOT need a virtual environment inside a Docker container. The container
> IS the isolation. Installing directly with `pip install` is correct here —
> there's no system Python to corrupt because the container has only YOUR Python.
> Using a venv inside Docker adds an unnecessary layer and increases image size.

```dockerfile
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (for packages that compile C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (changes more often — separate layer)
COPY . .

CMD ["python", "main.py"]
```

> [!danger] COPY . . Before pip install
>
> If you `COPY . .` before `pip install -r requirements.txt`, Docker invalidates
> the pip install cache every time ANY source file changes — even a one-line fix.
> Always copy `requirements.txt` first, install, THEN copy source code. This way
> pip install is cached unless dependencies actually change.

#### .dockerignore — keep the image lean

```
# .dockerignore — exclude from Docker build context
.venv/
__pycache__/
*.pyc
.git/
.mypy_cache/
.pytest_cache/
.ruff_cache/
tests/
*.md
```

#### Multi-stage build — when you compile wheels

```dockerfile
# Stage 1: Build wheels for packages with C extensions
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y gcc unixodbc-dev
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Stage 2: Install pre-built wheels into clean image
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY . .
CMD ["python", "main.py"]
```

> [!tip] python:3.12-slim vs python:3.12-alpine
>
> `slim` is Debian-based (~150 MB) and has `glibc` — virtually all Python
> packages work out of the box. `alpine` is musl-based (~50 MB) but many
> packages (numpy, pandas, pyodbc) fail to install or require long compile
> times. For data engineering workloads, always use `slim`.

#### FastAPI container — real-world example

```dockerfile
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port and run with uvicorn
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## github-actions — Python environments in CI/CD

#### Basic CI workflow — test on every push

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Lint
        run: ruff check .

      - name: Type check
        run: mypy .

      - name: Test
        run: pytest --cov=src --cov-report=xml
```

> [!tip] Cache pip Downloads in CI
>
> Add `actions/cache@v4` to cache the pip download directory between runs:
> ```yaml
> - uses: actions/cache@v4
>   with:
>     path: ~/.cache/pip
>     key: pip-${{ hashFiles('requirements.txt') }}
> ```
> This avoids re-downloading packages when `requirements.txt` hasn't changed.
> CI time drops from 90s to 15s for large dependency trees.

#### Matrix strategy — test across Python versions

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: |
          pip install --upgrade pip
          pip install -r requirements.txt
          pytest
```

#### Build and push Docker image in CI

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Push to Artifact Registry
        run: |
          gcloud auth configure-docker us-central1-docker.pkg.dev
          docker tag myapp:${{ github.sha }} \
            us-central1-docker.pkg.dev/my-project/repo/myapp:${{ github.sha }}
          docker push \
            us-central1-docker.pkg.dev/my-project/repo/myapp:${{ github.sha }}
```

## gcp — Python environments on Google Cloud Platform

#### Compute Engine VM — standard deployment

> [!info] Compute Engine is just a remote machine
>
> Environment setup on a GCE VM is identical to a local machine: install Python,
> create a venv, install requirements. The only difference is you get there via
> SSH or a startup script instead of opening a terminal.

```bash
# SSH into the VM and set up the environment
gcloud compute ssh my-vm --zone=us-central1-a

# On the VM:
sudo apt update && sudo apt install -y python3.12 python3.12-venv
python3.12 -m venv /opt/app/.venv
source /opt/app/.venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### Cloud Run — Dockerized deployment

```bash
# Build and deploy to Cloud Run (uses Dockerfile)
gcloud builds submit --tag us-central1-docker.pkg.dev/my-project/repo/myapp

gcloud run deploy myapp \
  --image us-central1-docker.pkg.dev/my-project/repo/myapp \
  --region us-central1 \
  --platform managed
```

> [!info] Cloud Run uses the Docker pattern from Section 11
>
> Cloud Run runs containers. Your environment is baked into the Docker image.
> There is no separate "install requirements" step at deployment time — the
> image already has everything. This is why the Dockerfile pattern matters:
> it IS your deployment environment.

#### Cloud Functions — requirements.txt at the repo root

Cloud Functions reads `requirements.txt` automatically from the function's source directory. No Dockerfile needed — GCP installs the dependencies during build.

```
my-function/
  main.py
  requirements.txt
```

```python
# main.py — Cloud Function entry point
import functions_framework
import pandas as pd

@functions_framework.http
def process(request):
    df = pd.read_json(request.get_json())
    return df.describe().to_json()
```

```
# requirements.txt — GCP installs these automatically
pandas==2.1.4
functions-framework==3.5.0
```

> [!danger] Don't SSH Into Composer to pip install
>
> Managed Airflow (Cloud Composer) runs in a controlled environment. Installing
> packages via SSH (`pip install pandas`) is overwritten on the next environment
> update. Use the Composer UI or `gcloud composer environments update` to add
> PyPI packages — these are persisted and managed by GCP.

#### Cloud Composer — managed Airflow package installation

```bash
# Add a PyPI package to Composer (correct way)
gcloud composer environments update my-env \
  --location us-central1 \
  --update-pypi-packages-from-file requirements-composer.txt
```

## terraform — deploying Python environments as infrastructure

> [!info] Terraform Deploys Containers, Not Environments
>
> Terraform doesn't know about venv, pip, or requirements.txt. It deploys
> infrastructure: VMs, Cloud Run services, Cloud Functions. The environment
> is baked INTO the Docker image (see Docker section) or configured via
> platform settings (see GCP section). Terraform's job is to point the
> infrastructure at the right image and set the right environment variables.

#### Cloud Run service with environment variables

```hcl
resource "google_cloud_run_service" "pipeline" {
  name     = "data-pipeline"
  location = "us-central1"

  template {
    spec {
      containers {
        image = "us-central1-docker.pkg.dev/my-project/repo/pipeline:v1.2.3"

        env {
          name  = "DB_CONNECTION_STRING"
          value = var.db_connection_string
        }
        env {
          name  = "ENVIRONMENT"
          value = "production"
        }

        resources {
          limits = {
            memory = "2Gi"
            cpu    = "2"
          }
        }
      }
    }
  }
}
```

#### Cloud Function deployment

```hcl
resource "google_cloudfunctions2_function" "processor" {
  name     = "data-processor"
  location = "us-central1"

  build_config {
    runtime     = "python312"
    entry_point = "process"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source.name
      }
    }
  }

  service_config {
    max_instance_count = 10
    available_memory   = "512Mi"
    timeout_seconds    = 300

    environment_variables = {
      ENVIRONMENT = "production"
    }
  }
}
```

## anti-patterns — common environment mistakes and their fixes

> [!danger] The "Works on My Machine" Root Cause
>
> 90% of "works on my machine" failures trace back to ONE of these:
> 1. Different Python version (3.11 vs 3.12)
> 2. Different package versions (unpinned dependencies)
> 3. Missing environment variable (set locally, not set in CI/production)
>
> Pin versions, freeze dependencies, document env vars. The environment
> that isn't specified is the environment that breaks.

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| `pip install` without venv | Corrupts system Python, breaks other projects | Always create and activate a venv first |
| `requirements.txt` without pinned versions | Environment changes between installs | `pip freeze > requirements.txt` |
| Committing `.venv/` to Git | Bloats repo, platform-specific, not portable | Add `.venv/` to `.gitignore` |
| `pip install` inside Docker with venv | Unnecessary isolation layer, larger image | Install directly — the container IS the isolation |
| Using `python:latest` in Dockerfile | Version changes without notice, breaks builds | Pin: `python:3.12-slim` |
| `pip install --user` as a workaround | Still pollutes global namespace, inconsistent | Use a venv instead |
| Not upgrading pip in new venv | Old resolver, slow installs, bad error messages | `pip install --upgrade pip` as first command |
| Mixing conda and pip in same env | Dependency resolution conflicts, broken state | Pick one package manager per environment |
| `COPY . .` before `pip install` in Docker | Invalidates cache on every source change | Copy `requirements.txt` first, install, then copy source |
| Using `alpine` for data engineering | musl breaks numpy/pandas, long compile times | Use `python:3.12-slim` (Debian-based) |

#### The nuclear option — rebuild from scratch

> [!tip] When in doubt, nuke the venv and rebuild
>
> Virtual environments are disposable. If your environment is in a weird state —
> conflicting packages, orphaned dependencies, mysterious import errors — don't
> debug it. Delete it and rebuild:
> ```bash
> rm -rf .venv
> python -m venv .venv
> source .venv/bin/activate
> pip install --upgrade pip
> pip install -r requirements.txt
> ```
> This takes 30 seconds and guarantees a clean environment. The entire value
> of `requirements.txt` is that it makes venvs disposable.

## cheat sheet — quick reference for venv and pip

| Task | Command |
|---|---|
| Create environment | `python -m venv .venv` |
| Activate (Windows PowerShell) | `.venv\Scripts\Activate.ps1` |
| Activate (Linux / macOS) | `source .venv/bin/activate` |
| Activate (Git Bash) | `source .venv/Scripts/activate` |
| Deactivate | `deactivate` |
| Upgrade pip | `python -m pip install --upgrade pip` |
| Install package | `pip install pandas==2.1.4` |
| Install from spec | `pip install -r requirements.txt` |
| Install editable | `pip install -e .` |
| List packages | `pip list` |
| Show one package | `pip show pandas` |
| Check outdated | `pip list --outdated` |
| Freeze/lock | `pip freeze > requirements.txt` |
| Uninstall | `pip uninstall pandas` |
| Verify compatibility | `pip check` |
| Clear cache | `pip cache purge` |
| Check active Python | `which python` or `where python` |
| Check Python version | `python --version` |
| Confirm venv active | `python -c "import sys; print(sys.prefix)"` |
| Rebuild from scratch | `rm -rf .venv && python -m venv .venv` |

| Spec File | Purpose |
|---|---|
| `requirements.txt` | Pinned production dependencies |
| `requirements-dev.txt` | Dev tools + `-r requirements.txt` |
| `requirements.in` | Abstract deps (input for pip-compile) |
| `constraints.txt` | Version constraints without installing |
| `.python-version` | Pin Python version (pyenv) |
| `.gitignore` | Exclude `.venv/`, `__pycache__/`, `*.pyc` |
| `.dockerignore` | Exclude `.venv/`, `.git/`, tests from image |

| Environment | How Dependencies Are Installed |
|---|---|
| Local dev | `pip install -r requirements.txt` inside `.venv/` |
| Docker | `pip install --no-cache-dir -r requirements.txt` (no venv) |
| GitHub Actions | `pip install -r requirements.txt` after `setup-python@v5` |
| Cloud Run | Baked into Docker image |
| Cloud Functions | GCP reads `requirements.txt` automatically |
| Cloud Composer | `gcloud composer environments update` with PyPI packages |
| Terraform | Deploys infrastructure pointing at container images |

## Related

- [File I/O](https://alp78.github.io/elysium/02-Programming-Languages/Python/09_py_fileio_serialization) — File I/O patterns that run inside these environments
- [Functional Pipeline](https://alp78.github.io/elysium/02-Programming-Languages/Python/25_py_functional_pipeline) — Production pipeline using venv + requirements.txt
- [Docker](https://alp78.github.io/elysium/09-Docker/container-lifecycle) — Docker container management
- [CI/CD](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — CI/CD setup with Python environments
- [Environment Strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — Cross-cutting environment strategy
