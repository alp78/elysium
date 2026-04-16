---
title: "26 - Environments - C#"
tags: [csharp, dotnet, environments, dependencies]
aliases: [dotnet environments, nuget, .csproj, global.json, dotnet SDK]
description: "C#/.NET environment and dependency management — project creation, NuGet packages, dependency pinning, global.json SDK control, Docker multi-stage builds, CI/CD, GCP deployment, and anti-patterns."
created: 2026-03-30
updated: 2026-04-16
status: complete
---

# Environments - C#

> [!quote] Working Rule
>
> "Dependency management is the dark matter of software engineering — invisible but responsible for most of the catastrophic failures."
>
> — **Attributed to various DevOps practitioners**

> [!abstract]- Summary
>
> - In .NET, the working environment is the combination of `.csproj`, `global.json`, package sources, runtime target, and deployment packaging.
> - `dotnet restore` resolves packages into the global NuGet cache, while `packages.lock.json` and `dotnet restore --locked-mode` make the restore deterministic.
> - `Directory.Packages.props` centralizes package versions across a solution, and `Directory.Build.props` centralizes shared build policy.
> - `dotnet publish` creates the deployable artifact. Use framework-dependent publish for containers and `--self-contained` only for hosts that do not already provide the runtime.
> - Multi-stage Dockerfiles, `actions/setup-dotnet` in CI, and Terraform for Cloud Run or VM delivery are part of the environment contract, not post-build details.
> - Private feeds belong in `nuget.config` with secret-backed credentials. On Google Cloud, Artifact Registry is typically the container registry in this flow, not the NuGet feed itself.

> [!note]- Glossary
>
> **`.csproj`**
> - The project file declares `TargetFramework`, build properties, project references, and `PackageReference` entries.
> - It does not select the SDK. SDK selection comes from `global.json` and the installed toolchain.
>
> ---
>
> **`dotnet restore`**
> - Resolves every declared package source, downloads missing packages into the global NuGet cache, and writes `obj/project.assets.json`.
> - With `<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>`, it also maintains `packages.lock.json`; CI should enforce that file with `dotnet restore --locked-mode`.
>
> ---
>
> **NuGet**
> - NuGet is the .NET package manager and resolves transitive dependencies from `PackageReference` entries.
> - The global cache is shared across projects. Clearing it with `dotnet nuget locals all --clear` affects every project on the machine.
>
> ---
>
> **`global.json`**
> - `global.json` pins the SDK band for the repository and controls roll-forward policy.
> - Place it at the repo root or a parent directory that intentionally scopes every project below it.
>
> ---
>
> **`packages.lock.json`**
> - This optional lock file records exact resolved versions and content hashes.
> - It is distinct from `obj/project.assets.json`, which is a generated restore artifact and should not be committed.
>
> ---
>
> **`Directory.Packages.props`**
> - Central Package Management (CPM) stores shared package versions once per solution.
> - When CPM is enabled, individual projects keep `<PackageReference Include="..."/>` entries but usually drop per-project `Version` attributes.
>
> ---
>
> **`Directory.Build.props`**
> - MSBuild imports this file automatically from the solution root upward.
> - Use it for shared build policy such as nullable context, analyzers, warnings-as-errors, and lock-file enforcement.
>
> ---
>
> **`dotnet publish`**
> - `dotnet publish` creates the artifact that should be copied to a server or runtime image.
> - Use framework-dependent publish for containers that already provide the runtime. Use `--self-contained` for bare-metal or locked-down hosts that do not.
>
> ---
>
> **Docker**
> - The final container image should contain published output plus a runtime image, not the SDK and source tree.
> - Copy project files and restore before copying the full source tree so Docker can reuse the restore layer.
>
> ---
>
> **GitHub Actions**
> - CI should install the SDK from `global.json`, restore in locked mode, then build, test, and publish with `--no-restore` or `--no-build` where appropriate.
> - Pin the action to a trusted ref. The examples below use `actions/setup-dotnet@v5`.
>
> ---
>
> **Private feed**
> - A private NuGet source belongs in `nuget.config` under `<packageSources>`.
> - Keep credentials in CI secrets or local environment variables rather than committing them in `nuget.config`.
>
> ---
>
> **Artifact Registry**
> - In Google Cloud delivery flows, Artifact Registry is commonly the registry for the final container image referenced by Cloud Run or GKE.
> - Keep that concern separate from private NuGet feeds. The build can restore packages from one service and push the container image to Artifact Registry afterward.

## Why environment boundaries matter

C# projects already isolate package references per `.csproj`, so the usual failure mode is not "two apps need different package versions." It is that one machine restores with the wrong SDK, one pipeline sees a different package source, or one deployment target expects a runtime layout that the publish step never produced.

Treat the environment as a chain: `global.json` selects the SDK, `.csproj` and imported props files define build and dependency policy, `nuget.config` defines package sources, `dotnet publish` creates the artifact, and Docker, GitHub Actions, or Terraform move that artifact into the target platform.

## Project bootstrap and restore

### Create a project and inspect package references

`dotnet new` creates the project skeleton, and `dotnet add package` records a dependency in the project file before the next restore. Application repositories should prefer exact versions such as `13.0.3`; floating ranges are harder to reason about in CI and production.

*Create a console project in the scratch workspace.*
```powershell
dotnet new console -n EnvDemo
```
```text
The template "Console App" was created successfully.

Processing post-creation actions...
Restoring C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\EnvDemo.csproj:
  Determining projects to restore...
  Restored C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\EnvDemo.csproj (in 52 ms).
Restore succeeded.
```

After adding a package, `dotnet list package` shows the requested and resolved versions that the project is currently using.

*List the direct package references after adding `Newtonsoft.Json`.*
```powershell
dotnet list package
```
```text
  Determining projects to restore...
  Restored C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\EnvDemo.csproj (in 153 ms).
Project 'EnvDemo' has the following package references
   [net10.0]:
   Top-level Package      Requested   Resolved
   > Newtonsoft.Json      13.0.3      13.0.3
```

The resulting `.csproj` is small by design: one `PropertyGroup` for build policy and one `ItemGroup` for dependencies. For multi-project repositories, keep the `.sln` at the root and move shared policy into `Directory.Packages.props` and `Directory.Build.props` instead of repeating it in every project file.

*Project file after adding a pinned package reference.*
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>
```
```text
Reference snippet from the scratch project after package installation and lock-file enablement.
```

### Run `dotnet restore` explicitly

`dotnet build` can restore implicitly, but an explicit `dotnet restore` step makes package-source failures, credential errors, and lock drift visible before compilation starts. It also makes the CI pipeline easier to cache and reason about.

*Run an explicit restore for the current project.*
```powershell
dotnet restore
```
```text
  Determining projects to restore...
  All projects are up-to-date for restore.
```

`dotnet restore` always writes `obj/project.assets.json`. That file is a generated restore artifact, not the source-controlled dependency contract.

*Compare the generated restore artifact with the committed lock file.*
```powershell
Get-Item -LiteralPath .\obj\project.assets.json, .\packages.lock.json | ForEach-Object { "{0} {1}" -f $_.Name, $_.Length }
```
```text
project.assets.json 23032
packages.lock.json 318
```

## Deterministic dependency control

### Pin the SDK with `global.json`

The target framework in `.csproj` says what the app compiles for. `global.json` says which SDK should do the compiling. Keep it at the repository root so local development, CI, and release builds resolve the same SDK band.

*Create a repository-level SDK pin.*
```powershell
dotnet new globaljson --sdk-version 10.0.201 --roll-forward latestFeature
```
```text
The template "global.json file" was created successfully.
```

*Generated `global.json` with an explicit roll-forward policy.*
```json
{
  "sdk": {
    "rollForward": "latestFeature",
    "version": "10.0.201"
  }
}
```
```text
Reference snippet generated from the scratch repository root.
```

### Lock package resolution with `packages.lock.json`

For deployable applications, exact package pins are not enough. You also need the resolved transitive graph captured in `packages.lock.json` and enforced with `dotnet restore --locked-mode`. Without that combination, CI can still accept package-graph drift that never ran on the developer machine.

*Lock-file settings belong in the shared project or shared build props.*
```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
</PropertyGroup>
```
```text
Reference snippet. Place this in the project file or a shared props file before generating the lock file.
```

*A minimal `packages.lock.json` records requested and resolved versions plus a content hash.*
```json
{
  "version": 1,
  "dependencies": {
    "net10.0": {
      "Newtonsoft.Json": {
        "type": "Direct",
        "requested": "[13.0.3, )",
        "resolved": "13.0.3",
        "contentHash": "HrC5BXdl00IP9zeV+0Z848QWPAoCr9P3bDEZguI+gkLcBKAOxix/tLEAAHC+UvDNPv4a2d18lOReHMOagPa+zQ=="
      }
    }
  }
}
```
```text
Reference snippet generated after `dotnet restore` with lock files enabled.
```

*Fail restore if the lock file no longer matches the project definition.*
```powershell
dotnet restore --locked-mode
```
```text
  Determining projects to restore...
  Restored C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\EnvDemo.csproj (in 157 ms).
```

### Centralize package versions with `Directory.Packages.props`

When a solution has more than one application or library, Central Package Management (CPM) belongs at the solution root. Each project still declares what it depends on, but `Directory.Packages.props` becomes the single version ledger for shared packages.

*Central Package Management in the solution root.*
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Serilog.AspNetCore" Version="8.0.3" />
  </ItemGroup>
</Project>
```
```text
Reference snippet. Commit this file beside the `.sln` so every child project resolves the same package versions.
```

### Share build defaults with `Directory.Build.props`

`Directory.Build.props` handles the other half of shared solution policy: warnings, nullable context, analyzer level, and lock enforcement. Keep package versions in `Directory.Packages.props` and build defaults in `Directory.Build.props` so the intent stays obvious.

*Shared MSBuild policy for every project below the solution root.*
```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest</AnalysisLevel>
    <RestoreLockedMode>true</RestoreLockedMode>
  </PropertyGroup>
</Project>
```
```text
Reference snippet. MSBuild imports this file automatically from the current directory upward.
```

## Feed and credential configuration

### Keep private feed definitions in `nuget.config`

`nuget.config` is the package-source contract for the repository. Commit source URLs, source names, and the intended precedence. Do not commit usable credentials. Reference environment variables or provision the source during CI setup instead.

*Repository-scoped private-feed configuration with secret-backed credentials.*
```xml
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="internal" value="https://pkgs.example.com/nuget/v3/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <internal>
      <add key="Username" value="%NUGET_USERNAME%" />
      <add key="ClearTextPassword" value="%NUGET_PAT%" />
    </internal>
  </packageSourceCredentials>
</configuration>
```
```text
Reference snippet. The committed file is safe only if the environment variables are supplied externally by each developer machine or CI job.
```

The local machine state should always confirm what the CLI will actually query. `dotnet nuget list source` and `dotnet nuget locals all --list` show the currently registered sources and cache paths.

*Inspect the active NuGet sources and local caches.*
```powershell
dotnet nuget list source
dotnet nuget locals all --list
```
```text
Registered Sources:
  1.  nuget.org [Enabled]
      https://api.nuget.org/v3/index.json
  2.  Microsoft Visual Studio Offline Packages [Enabled]
      C:\Program Files (x86)\Microsoft SDKs\NuGetPackages\
http-cache: C:\Users\aperi\AppData\Local\NuGet\v3-cache
global-packages: C:\Users\aperi\.nuget\packages\
temp: C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\NuGetScratch
plugins-cache: C:\Users\aperi\AppData\Local\NuGet\plugins-cache
```

### Keep Artifact Registry separate from the NuGet feed

For Google Cloud delivery, the private NuGet feed and the container registry are different concerns. Restore packages from a service that exposes a NuGet v3 endpoint, then publish the built container image to Artifact Registry for Cloud Run, GKE, or other container platforms. Keeping those boundaries explicit avoids hiding package credentials inside deployment infrastructure.

## Inspect SDKs and cache paths

### Confirm the active SDK and installed SDK inventory

`dotnet --version` tells you which SDK the CLI resolved for the current directory. `dotnet --list-sdks` tells you what is installed. When those disagree with `global.json`, the machine is not in the state the repository expects.

*Show the active SDK and all installed SDKs.*
```powershell
dotnet --version
dotnet --list-sdks
```
```text
10.0.201
10.0.201 [C:\Program Files\dotnet\sdk]
```

### Linux or WSL cache paths

When Linux shells are in scope, show Linux paths directly. This matters for container builds, CI images, and WSL-backed local development.

*Print the global NuGet cache path from Linux or WSL.*
```bash
printf "%s\n" "$HOME/.nuget/packages"
```
```text
/home/alex/.nuget/packages
```

### Windows PowerShell cache paths

On Windows, the same cache lives under the user profile. Keep the Windows and Linux examples separate when both platforms are relevant so path handling stays unambiguous.

*Print the global NuGet cache path from PowerShell.*
```powershell
Write-Output "$HOME\.nuget\packages"
```
```text
C:\Users\aperi\.nuget\packages
```

## Build, publish, and container packaging

### Publish the deployment artifact

`dotnet build` is a compilation step. `dotnet publish` is the deployment artifact step. Dockerfiles, VM copy operations, and release pipelines should consume published output, not a raw `bin` directory.

*Publish the application and inspect the output directory.*
```powershell
dotnet publish -c Release -o .\publish
Get-ChildItem -LiteralPath .\publish | Sort-Object Name | Select-Object -First 6 | ForEach-Object { "{0} {1}" -f $_.Name, $_.Length }
```
```text
  Determining projects to restore...
  All projects are up-to-date for restore.
  EnvDemo -> C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\bin\Release\net10.0\EnvDemo.dll
  EnvDemo -> C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\publish\
EnvDemo.deps.json 1027
EnvDemo.dll 4608
EnvDemo.exe 162304
EnvDemo.pdb 11720
EnvDemo.runtimeconfig.json 342
Newtonsoft.Json.dll 712464
```

### Use `self-contained` publish only when the target lacks the runtime

`--self-contained` bundles the runtime into the output and is appropriate for locked-down VMs, bare-metal hosts, or offline targets that cannot rely on a preinstalled runtime. It is usually the wrong choice for a container image based on `mcr.microsoft.com/dotnet/runtime` or `mcr.microsoft.com/dotnet/aspnet`, because the image already supplies the runtime layer.

*Command shape for a self-contained Linux publish.*
```powershell
dotnet publish -c Release -r linux-x64 --self-contained true
```
```text
Reference command. Use this for VM or bare-metal targets that do not already provide the required .NET runtime.
```

### Build containers as multi-stage images

The correct container pattern is `restore` and `publish` in the SDK stage, then copy only the published output into the final runtime stage. Copy project files before copying the full source tree so Docker can reuse the restore layer across normal source edits.

*Framework-dependent multi-stage container build for a console app.*
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY EnvDemo.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "EnvDemo.dll"]
```
```text
Reference snippet. For ASP.NET Core applications, replace the final image with `mcr.microsoft.com/dotnet/aspnet:<version>`.
```

## CI and deployment infrastructure

### Use GitHub Actions to restore, build, test, and publish

CI should install the SDK from `global.json`, restore in locked mode, then avoid repeated implicit restores by using `--no-restore` and `--no-build` in later steps. As of 2026-04-16, the official `actions/setup-dotnet` repository is on the `v5` major line; pin a full commit SHA in production if the pipeline is security-sensitive.

*Baseline GitHub Actions workflow for a locked .NET build.*
```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v5
        with:
          global-json-file: global.json
          cache: true

      - run: dotnet restore --locked-mode
      - run: dotnet build --configuration Release --no-restore
      - run: dotnet test --configuration Release --no-build
      - run: dotnet publish --configuration Release --no-build --output ./artifacts/publish
```
```text
Reference workflow. `cache: true` reuses the NuGet global package cache between runs, and `global-json-file` keeps CI aligned with the repository SDK pin.
```

### Provision Cloud Run with Terraform and reference an Artifact Registry image

Terraform does not know anything about NuGet or `dotnet restore`. Its job is to point the platform at the already-built artifact, which in Cloud Run usually means an Artifact Registry image plus runtime configuration and secrets.

*Cloud Run v2 service using an Artifact Registry image and Secret Manager-backed environment variables.*
```hcl
resource "google_cloud_run_v2_service" "pipeline" {
  name     = "data-pipeline"
  location = "us-central1"

  template {
    containers {
      image = "us-central1-docker.pkg.dev/my-project/app-images/data-pipeline:2026-04-16"

      env {
        name  = "DOTNET_ENVIRONMENT"
        value = "Production"
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}
```
```text
Reference snippet. The image is already built and pushed before Terraform runs; Terraform only binds the service to that image and its runtime configuration.
```

## Failure modes and audits

### Review outdated packages deliberately

`dotnet list package --outdated` is for planned upgrade review, not for normal build determinism. Run it on a schedule, decide what to bump, then update the pinned version and lock file in the same change.

*Show packages that have newer versions available on the configured feeds.*
```powershell
dotnet list package --outdated
```
```text
  Determining projects to restore...
  All projects are up-to-date for restore.

The following sources were used:
   https://api.nuget.org/v3/index.json
   C:\Program Files (x86)\Microsoft SDKs\NuGetPackages\

Project `EnvDemo` has the following updates to its packages
   [net10.0]:
   Top-level Package      Requested   Resolved   Latest
   > Newtonsoft.Json      13.0.3      13.0.3     13.0.4
```

### Audit vulnerability status explicitly

Do not rely on restore warnings buried in CI logs. Run `dotnet list package --vulnerable --include-transitive` as a dedicated audit step so the result is visible and can be turned into a release gate.

*Check the direct and transitive graph for known vulnerable packages.*
```powershell
dotnet list package --vulnerable --include-transitive
```
```text
  Determining projects to restore...
  Restored C:\Users\aperi\My Drive\VAULT\VAULT_STYLE_REFACTOR\RUNS\run-20260414-061410\CONTROL\PACKETS\worker-04\016-attempt-03\scratch\env-note-demo\EnvDemo\EnvDemo.csproj (in 153 ms).

The following sources were used:
   https://api.nuget.org/v3/index.json
   C:\Program Files (x86)\Microsoft SDKs\NuGetPackages\

The given project `EnvDemo` has no vulnerable packages given the current sources.
```

### Keep the high-risk boundaries explicit

- Missing `global.json` means the highest installed SDK wins, which is the classic cause of "works locally, fails in CI."
- Committing `packages.lock.json` without `dotnet restore --locked-mode` makes the lock file advisory instead of enforced.
- Putting `COPY . .` before `dotnet restore` in a Dockerfile destroys restore-layer caching and slows every rebuild.
- A private feed that only exists on one developer machine is not an environment; it is a hidden dependency waiting to break CI.
- `dotnet publish --self-contained` inside a runtime image duplicates the runtime that the base image already provides.

## Related

- [File I/O](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/09-cs-fileio-serialization) — File I/O patterns in .NET projects
- [Functional Pipeline](https://alp78.github.io/elysium/02-Programming-Languages/02-CSharp/25-cs-functional-pipeline) — Production pipeline using `.csproj` and NuGet
- [Docker](https://alp78.github.io/elysium/09-Docker/container-lifecycle) — Container build and runtime lifecycle
- [CI/CD](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd) — Pipeline orchestration and release flow
- [Environment Strategy](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — Cross-cutting environment policy
