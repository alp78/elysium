---
type: concept
category: python
technology: [python]
tags: [pipeline, python]
aliases: [venv, virtual environment, pip, requirements.txt, pip-compile, pip-tools, Python environment]
keywords: [python, virtual environment, venv, pip, requirements.txt, pip freeze, pip-compile, pip-tools, package management, isolation, dependencies, reproducible builds]
description: "Python virtual environment management — creating isolated environments with venv, installing dependencies, pinning versions with pip-compile, and ensuring reproducible builds."
related:
  - "[[python-pipeline-execution]]"
  - "[[docker-compose]]"
  - "[[image-management]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Python Virtual Environments

Python is the language of data engineering — not because it is the fastest, but because it has the richest ecosystem of data libraries (pandas, pyarrow, sqlalchemy) and the deepest integration with cloud services. Managing environments correctly prevents the most common source of "it works on my machine" failures.

## Creating and Activating

```bash
# Create a virtual environment
python3 -m venv .venv
# Creates an isolated Python environment in .venv/
# All packages installed here are separate from the system Python

# Activate the environment
source .venv/bin/activate        # Linux
.venv\Scripts\Activate.ps1      # PowerShell
```

## Installing Dependencies

```bash
# Install dependencies from requirements.txt
pip install -r requirements.txt
# -r = read requirements from file

# Install a specific package
pip install pandas==2.2.0 pyodbc sqlalchemy
# Always pin major versions in requirements.txt for production

# Upgrade pip itself (do this first in fresh environments)
pip install --upgrade pip
```

## Freezing and Pinning Dependencies

```bash
# Freeze current dependencies (capture exact versions)
pip freeze > requirements.txt
# Captures: package==version for every installed package
# This ensures reproducible builds — the same versions everywhere
```

> [!tip] pip freeze vs pip-compile
> `pip freeze` captures EVERYTHING including transitive dependencies. This makes the file noisy and hard to maintain. The professional approach:
> 1. Maintain `requirements.in` with your direct dependencies (what YOU import)
> 2. Use `pip-compile` (from `pip-tools`) to resolve and lock all transitive dependencies
> ```bash
> pip install pip-tools
> echo "pandas>=2.2\npyodbc\nsqlalchemy>=2.0" > requirements.in
> pip-compile requirements.in -o requirements.txt
> ```
> Now `requirements.txt` has exact versions for everything, and `requirements.in` is the human-readable source of truth.

## Related

- [[python-pipeline-execution]] — Running, profiling, and linting pipelines
- [[image-management]] — Python dependencies in Docker images
