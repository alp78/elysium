---
title: "04 - gcloud Configurations"
tags: [gcp, gcloud]
aliases: [gcloud config, gcloud configurations, GCP project switching, named configurations]
description: "How to use gcloud named configurations, property scopes, environment overrides, and on-disk config files safely, with live local output from a disposable SDK root."
created: 2026-04-13
updated: 2026-04-15
status: complete
---

# gcloud Configurations

> [!abstract]- Summary
> `gcloud` configurations are named property sets that control the CLI defaults for account, project, region, zone, and related settings when a command does not pass explicit flags. In multi-project work, they are the main guardrail against wrong-environment mistakes because they let you switch an entire context atomically instead of rewriting individual properties one by one.
>
> This note explains the difference between named configurations and the properties stored inside them, shows how environment variables override on-disk values, and traces where Cloud SDK keeps the active `config_<name>` files. The local commands and path projections were rerun on April 15, 2026 with Google Cloud SDK `563.0.0` inside a disposable `CLOUDSDK_CONFIG` root seeded with `alexper.recovery@gmail.com` and `dagflow-poc`, so the walkthrough stays current without mutating the normal per-user SDK directory.

> [!warning]- Live-run boundary
> On April 15, 2026 the configuration create, activate, delete, property, override, and file-path examples in this note were rerun locally inside a temporary SDK root. The live outputs now reflect a disposable local profile that stores `dagflow-poc`, not the older `bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com` context.

> [!note]- Glossary
> **named configuration**
>
> A saved group of `gcloud` properties such as `core/project`, `core/account`, `compute/region`, and `compute/zone`.
>
> **active configuration**
>
> The one configuration that `gcloud` is currently reading for default values in the current process.
>
> **default configuration**
>
> The built-in configuration named `default` that Cloud SDK initializes for you.
>
> **property**
>
> A single CLI setting such as `core/project` or `run/region`.
>
> **property section**
>
> The namespace that groups related properties, such as `core`, `compute`, `run`, `auth`, or `storage`.
>
> **`CLOUDSDK_ACTIVE_CONFIG_NAME`**
>
> An environment variable that overrides which named configuration is active for the current shell session or process.
>
> **`CLOUDSDK_CORE_PROJECT`**
>
> An environment variable that overrides the `core/project` property without editing the property file on disk.
>
> **configuration file location**
>
> The directory and `config_<name>` files where Cloud SDK stores named configurations.
>
> **`gcloud config set`**
>
> The command that writes a property value to the active configuration, or to the whole installation when `--installation` is used.
>
> **`gcloud config unset`**
>
> The command that removes a property from the active configuration, or from the whole installation when `--installation` is used.
>
> **`gcloud config configurations`**
>
> The command group used to create, list, describe, activate, and delete named configurations.

## PowerShell / Linux

The `gcloud config` subcommands are the same on PowerShell, Bash, and other shells. The only platform-specific difference in this note is how environment variables are assigned before the command runs.

### gcloud | inspect and manage named configurations

Named configurations are the unit of context switching in Cloud SDK. Each configuration has its own property file, and only one configuration is active at a time unless a session-level override changes it for the current process.

| Output column | Meaning |
|---|---|
| `NAME` | The configuration name stored under the `configurations/` directory. |
| `IS_ACTIVE` | Whether this configuration is the current effective configuration for the command being executed. |
| `ACCOUNT` | The default account stored in `core/account` for that configuration. |
| `PROJECT` | The default project stored in `core/project` for that configuration. |
| `COMPUTE_DEFAULT_ZONE` | The default Compute Engine zone stored in `compute/zone`. |
| `COMPUTE_DEFAULT_REGION` | The default Compute Engine region stored in `compute/region`. |

#### List the configurations currently available

Before any multi-project or multi-account work, and before creating or deleting a configuration. It is typically triggered by you need to see which saved contexts exist and which one is active right now. Read-only `gcloud` command. It reads the local Cloud SDK configuration store and does not call a resource-specific API. Inventory the available named configurations and confirm the current default context.

*List every configuration in the current Cloud SDK root and mark the active one.*

```bash
gcloud config configurations list
```

```text
NAME     IS_ACTIVE  ACCOUNT                     PROJECT      COMPUTE_DEFAULT_ZONE  COMPUTE_DEFAULT_REGION
default  True       alexper.recovery@gmail.com  dagflow-poc
```

The fresh SDK root already contains `default`, and that configuration is active. In the April 15 disposable root, only `core/account` and `core/project` were seeded, so the Compute columns are blank. That means commands needing a region or zone would still require explicit flags unless you set those properties later.

#### Create a scratch configuration

When you need a separate context for another project, account, workflow, or temporary test. It is typically triggered by you want to stop overwriting the properties of the currently active configuration. State-changing local command. It writes a new `config_<name>` file under the Cloud SDK configuration root. Create an isolated property container so different environments do not share one mutable default profile.

*Create a new named configuration for scratch work.*

```bash
gcloud config configurations create p5-scratch
```

```text
Created [p5-scratch].
Activated [p5-scratch].
```

`create` activates the new configuration by default. That behavior is operationally important because the moment the command succeeds, every following `gcloud` command in the same shell starts reading `p5-scratch` unless you switch back.

#### Inspect a newly created configuration

Immediately after creation, or whenever you want to verify exactly which properties a named configuration contains. It is typically triggered by you need to know whether a configuration is still empty or already carries inherited-looking defaults from prior edits. Read-only command against the local Cloud SDK store. It does not change the active configuration. Show the exact saved properties for one configuration file.

| Output field | Meaning |
|---|---|
| `is_active` | Whether the named configuration is the current effective configuration. |
| `name` | The configuration name being described. |
| `properties` | The saved property map for that configuration. An empty object means the configuration has no custom values yet. |

*Describe the just-created configuration before any properties are set.*

```bash
gcloud config configurations describe p5-scratch
```

```text
is_active: true
name: p5-scratch
properties: {}
```

A new configuration starts empty. `gcloud` does not clone the prior configuration's project, region, or account automatically; you must set the properties you want this configuration to own.

#### Switch back to another saved configuration

After temporary work is complete, or when you need to move from one environment context to another. It is typically triggered by the active configuration does not match the environment you intend to operate on next. State-changing local command. It flips the active configuration pointer but does not edit the property values inside any configuration file. Make one saved configuration become the current default context for subsequent commands.

> [!danger] Wrong-project risk after switching into production
>
> If you activate a production configuration for one task and forget to switch back, every later `gcloud` command in that shell inherits the production project, account, and regional defaults.

> [!success] Switch by name, then verify by value
>
> Use named configurations for atomic switching, then immediately confirm the result with `gcloud config configurations list` or `gcloud config get-value project` before any state-changing command.

*Activate a different saved configuration and make it the session default.*

```bash
gcloud config configurations activate default
```

```text
Activated [default].
```

Activation changes which property file `gcloud` reads by default. It does not merge configurations. The new active configuration's saved values simply replace the old active configuration's defaults.

#### Delete a non-active configuration

After a temporary configuration is no longer needed and you have already switched to a different active configuration. It is typically triggered by scratch, migration, or incident-specific configurations have become clutter and should not remain selectable. State-changing local command. The target configuration must not be active at deletion time. Remove an unused configuration file and reduce the risk of switching into a stale context later.

*Delete the earlier scratch configuration after switching away from it.*

```bash
gcloud config configurations delete p5-scratch --quiet
```

```text
The following configurations will be deleted:
 - p5-scratch
WARNING: Failed to delete universe descriptor for universe domain googleapis.com: A SQLite error occurred while querying the universe descriptor with universe domain [googleapis.com]. Request exception: Could not delete attribute [googleapis.com] from config store [hidden_gcloud_config_universe_descriptor_data_cache].
Deleted [p5-scratch].
```

The live run returned a local cache-cleanup warning for the hidden universe-descriptor SQLite store, but the configuration deletion itself still succeeded because the command ended with `Deleted [p5-scratch].` This is a local CLI cache warning, not a cloud-side failure.

| Command | Flag or argument | Syntax | Description |
|---|---|---|---|
| `create` | `CONFIGURATION_NAME` | `gcloud config configurations create p5-scratch` | Name of the configuration file to create. |
| `create` | `--activate` | `gcloud config configurations create my-config --activate` | Activates the new configuration after creation. This is the default behavior. |
| `create` | `--no-activate` | `gcloud config configurations create my-config --no-activate` | Creates the configuration without switching into it. |
| `list` | `--filter` | `gcloud config configurations list --filter="IS_ACTIVE=True"` | Filters the listed configurations with a Boolean expression. |
| `list` | `--limit` | `gcloud config configurations list --limit=5` | Restricts the number of returned rows. |
| `list` | `--sort-by` | `gcloud config configurations list --sort-by=NAME` | Sorts rows by one or more fields. |
| `describe` | `CONFIGURATION_NAME` | `gcloud config configurations describe p5-scratch` | Shows the properties saved in one named configuration. |
| `describe` | `--all` | `gcloud config configurations describe p5-scratch --all` | Includes unset properties in the output. |
| `activate` | `CONFIGURATION_NAME` | `gcloud config configurations activate default` | Makes one configuration become active. |
| `delete` | `CONFIGURATION_NAMES...` | `gcloud config configurations delete p5-scratch` | Deletes one or more configurations that are not currently active. |

### gcloud | inspect and modify configuration properties

Properties are the actual values stored inside a configuration. `gcloud config configurations` chooses which profile is active; `gcloud config set`, `get-value`, `list`, and `unset` inspect or modify the contents of that profile.

| Property | Type | Meaning |
|---|---|---|
| `core/account` | string | Default account used for CLI authentication. |
| `core/project` | string | Default GCP project ID used when `--project` is not passed. |
| `compute/region` | string | Default Compute Engine region used by commands that accept a region. |
| `compute/zone` | string | Default Compute Engine zone used by commands that accept a zone. |
| `run/region` | string | Default Cloud Run region. |
| `core/disable_usage_reporting` | boolean | Whether anonymous Cloud SDK usage reporting is disabled. |

#### Inspect the active configuration's saved properties

Before troubleshooting odd command defaults, and before changing any property. It is typically triggered by you need to know which default values the current configuration will inject into later commands. Read-only local command against the active configuration file. Show the exact property values currently saved in the active configuration.

*Print all currently set properties for the active configuration.*

```bash
gcloud config list
```

```text
[accessibility]
screen_reader = False
[core]
account = alexper.recovery@gmail.com
disable_usage_reporting = True
project = dagflow-poc

Your active configuration is: [default]
```

Only properties that are currently set are shown by default. This is why `config list` is much shorter than `config configurations describe --all`: it behaves like an operational snapshot of the values that will actually affect commands now. In the rerun disposable root, that snapshot contains only the core account and project defaults.

#### Read one property directly

When you only need one default value and do not want the full property dump. It is typically triggered by you want a fast assertion in a script, prompt helper, or manual preflight check. Read-only local command. It fetches one property from the effective configuration state. Return a single value that can be checked, piped, or embedded in automation.

> [!info] `get-value` is a compatibility alias
>
> Local command help identifies `gcloud config get-value` as an alias for `gcloud config get` kept for backwards compatibility, and notes that it is an internal implementation detail. It is still widely used in scripts because it returns a clean scalar value.

*Return only the active default project ID.*

```bash
gcloud config get-value project
```

```text
dagflow-poc
```

This is the fastest way to confirm project context before a destructive command. It returns just the scalar property value with no section headers.

#### Set the default project

During initial workstation setup, after switching to a new environment, or when a script should inherit one project implicitly. It is typically triggered by the active configuration does not yet point at the project you intend to operate on. State-changing local command. It writes `core/project` into the active configuration file. Make future `gcloud` commands default to `dagflow-poc` without repeating `--project`.

*Write the default project into the active configuration.*

```bash
gcloud config set project dagflow-poc
```

```text
WARNING: You do not appear to have access to project [dagflow-poc] or it does not exist.
Updated property [core/project].
```

The change is local to the active configuration unless `--installation` is used. Other named configurations keep their own `core/project` values. In a disposable SDK root with no copied credential cache, `gcloud` may warn that it cannot verify project access even though the local property write still succeeds.

#### Set a service-specific property

When one command group such as Cloud Run, Compute Engine, or Dataproc should inherit a service-local default. It is typically triggered by repeated commands keep needing the same region or zone flag. State-changing local command. It writes one non-`core` property into the active configuration file. Reduce repeated flags for one service surface without changing unrelated defaults.

*Set the default Cloud Run region in the active configuration.*

```bash
gcloud config set run/region europe-west1
```

```text
Updated property [run/region].
```

This change affects commands that respect `run/region`. It does not change Compute Engine defaults such as `compute/region` or `compute/zone`.

#### Unset a property you no longer want inherited

When a saved default has become misleading, stale, or too specific for the next workload. It is typically triggered by you keep inheriting a region, zone, or project that should no longer be implicit. State-changing local command. It removes one property from the active configuration file. Force future commands to require an explicit flag or to fall back to another precedence source.

*Remove the saved Cloud Run region from the active configuration.*

```bash
gcloud config unset run/region
```

```text
Unset property [run/region].
```

Once a property is unset, it disappears from later `gcloud config list` and `gcloud config configurations describe` output for that configuration unless another precedence source such as an environment variable or per-command flag supplies it at runtime.

| Command | Flag or argument | Syntax | Description |
|---|---|---|---|
| `list` | `[SECTION/PROPERTY]` | `gcloud config list compute/` | Limits the output to one section or one property. |
| `list` | `--all` | `gcloud config list compute/ --all` | Includes unset properties for the requested section. |
| `list` | `--filter` | `gcloud config list --filter="name:project"` | Filters listed property rows. |
| `list` | `--limit` | `gcloud config list --limit=10` | Restricts the number of listed rows. |
| `list` | `--sort-by` | `gcloud config list --sort-by=name` | Sorts listed rows by field. |
| `get-value` | `SECTION/PROPERTY` | `gcloud config get-value project` | Returns one property value as a scalar. `core/` is optional for `project`. |
| `set` | `SECTION/PROPERTY` | `gcloud config set run/region europe-west1` | Identifies which property to write. |
| `set` | `VALUE` | `gcloud config set project dagflow-poc` | The value written into the selected property. |
| `set` | `--installation` | `gcloud config set project dagflow-poc --installation` | Writes the property across the whole Cloud SDK installation instead of only the active configuration. |
| `unset` | `SECTION/PROPERTY` | `gcloud config unset run/region` | Identifies which property to remove. |
| `unset` | `--installation` | `gcloud config unset project --installation` | Removes the property across the whole installation instead of only the active configuration. |

### gcloud | override configuration with environment variables

Environment variables sit outside the configuration files on disk. They are useful for one shell session, CI jobs, or wrapper scripts because they change effective values without permanently editing a named configuration.

For the live examples below, the session also contained a second saved configuration named `p5-override` whose `core/project` property was set to `override-demo-project`. That second profile is what makes the process-level configuration override visible in the output.

> [!info] Official precedence rules
>
> Google Cloud's configuration guide documents `CLOUDSDK_CONFIG` as the way to move the entire SDK root, and the startup topic documents that `CLOUDSDK_ACTIVE_CONFIG_NAME` selects the active configuration for the current process. The same startup topic also defines the `CLOUDSDK_SECTION_PROPERTY` pattern, which is why `CLOUDSDK_CORE_PROJECT` overrides `core/project` without rewriting the property file.

> [!danger] Session variables silently beat the activated configuration
>
> If a shell exports `CLOUDSDK_ACTIVE_CONFIG_NAME` or `CLOUDSDK_CORE_PROJECT`, `gcloud` will honor those values even when `gcloud config configurations activate` already pointed somewhere else. This is a common source of "the CLI says one thing, but it is using another" confusion in CI runners and long-lived terminals.

> [!success] Clear overrides when the task ends
>
> Use session-scoped overrides only for bounded work, then remove them with `Remove-Item Env:VARIABLE` in PowerShell or `unset VARIABLE` in Bash so later commands fall back to the saved named configuration again.

| Override | Scope | Meaning |
|---|---|---|
| `CLOUDSDK_ACTIVE_CONFIG_NAME` | Whole `gcloud` process | Chooses which named configuration is active for that process. |
| `CLOUDSDK_CORE_PROJECT` | One property | Overrides only `core/project` for that process. |
| `CLOUDSDK_SECTION_PROPERTY` | One property | General pattern for overriding any property through the environment. |
| `config.properties.<section>.<property>.source.name` | Output field | Shows whether a value came from the property file or the environment. |

#### Override the active configuration for one PowerShell session

During CI, debugging, or temporary shell work where you must not persist a context switch to disk. It is typically triggered by you need a different configuration only for the current process, not for every later shell. PowerShell environment variable assignment followed by a read-only `gcloud` command. The configuration files on disk are not edited. Make `gcloud` behave as if a different named configuration were active for this session only.

*Temporarily force `gcloud` to use `p5-override` as the active configuration for this PowerShell process.*

```powershell
$env:CLOUDSDK_ACTIVE_CONFIG_NAME = 'p5-override'
gcloud config configurations list
```

```text
NAME         IS_ACTIVE  ACCOUNT                     PROJECT                COMPUTE_DEFAULT_ZONE  COMPUTE_DEFAULT_REGION
default      False      alexper.recovery@gmail.com  dagflow-poc
p5-override  True       alexper.recovery@gmail.com  override-demo-project
```

The on-disk active configuration had already been switched back to `default`, but this process-level override made `p5-override` the effective configuration for the command. On Linux or macOS, the equivalent pattern is `CLOUDSDK_ACTIVE_CONFIG_NAME=p5-override gcloud config configurations list`.

#### Override only the project value for one PowerShell session

When you want to keep the active configuration but temporarily replace just one property, usually `core/project`. It is typically triggered by A wrapper script or shell session needs a different project default without editing the saved configuration file. PowerShell environment variable assignment followed by a read-only `gcloud info` command that exposes the property's source metadata. Prove that the effective project value came from the environment rather than the property file.

| Output field | Meaning |
|---|---|
| `config.properties.core.project.value` | The effective project value `gcloud` will use. |
| `config.properties.core.project.source.name` | The precedence source that supplied the value. |
| `config.properties.core.project.source.value` | The human-readable description of that precedence source. |

*Override `core/project` for the current PowerShell process and inspect the resulting source metadata.*

```powershell
$env:CLOUDSDK_CORE_PROJECT = 'dagflow-poc'
gcloud info --format="json(config.properties.core.project)"
```

```text
{
  "config": {
    "properties": {
      "core": {
        "project": {
          "source": {
            "name": "ENVIRONMENT",
            "value": "environment"
          },
          "value": "dagflow-poc"
        }
      }
    }
  }
}
```

The value stayed `dagflow-poc`, but the source changed from the property file to `ENVIRONMENT`. That is the key operational point: the environment can change the effective project without mutating the configuration file. On Linux or macOS, the equivalent pattern is `CLOUDSDK_CORE_PROJECT=dagflow-poc gcloud info --format="json(config.properties.core.project)"`.

| Command or variable | Flag or variable | Syntax | Description |
|---|---|---|---|
| environment | `CLOUDSDK_ACTIVE_CONFIG_NAME` | `$env:CLOUDSDK_ACTIVE_CONFIG_NAME = 'p5-override'` | Overrides the active named configuration for the current process. |
| environment | `CLOUDSDK_CORE_PROJECT` | `$env:CLOUDSDK_CORE_PROJECT = 'dagflow-poc'` | Overrides only the `core/project` property for the current process. |
| environment | `CLOUDSDK_SECTION_PROPERTY` | `CLOUDSDK_RUN_REGION=europe-west1` | General naming pattern for overriding a property through the environment. |
| `gcloud info` | `--format` | `gcloud info --format="json(config.properties.core.project)"` | Limits the output to the exact fields needed for precedence inspection. |

### gcloud | inspect configuration file locations

Every named configuration lives as a file on disk. The active file name follows the pattern `config_<configuration-name>`, and the containing root is either the normal per-user Cloud SDK directory or whatever directory `CLOUDSDK_CONFIG` points to.

| Path or variable | Meaning |
|---|---|
| `config.paths.global_config_dir` | The root Cloud SDK directory currently in use by the process. |
| `config.paths.active_config_path` | The full path to the active configuration file currently being read. |
| `config_<name>` | The file naming pattern used for named configurations under the `configurations/` directory. |
| `%APPDATA%\\gcloud` | The normal Windows Cloud SDK root when `CLOUDSDK_CONFIG` is not set. |
| `~/.config/gcloud` | The normal Linux and macOS Cloud SDK root when `CLOUDSDK_CONFIG` is not set. |
| `CLOUDSDK_CONFIG` | The environment variable that replaces the default Cloud SDK root with a custom directory. |

#### Print the Cloud SDK root currently in use

When configuration behavior looks inconsistent across shells, or when you suspect a custom SDK root is in effect. It is typically triggered by A configuration appears to exist in one shell but not in another, or paths in logs do not match the expected user profile. Read-only diagnostic command. It prints metadata about the current Cloud SDK installation and active configuration root. Show which directory `gcloud` is actually using as its configuration home.

*Return the current Cloud SDK configuration root directory.*

```bash
gcloud info --format="get(config.paths.global_config_dir)"
```

```text
C:\Users\aperi\AppData\Local\Temp\codex-gcloud-config-1c6f0b7462cc44dfaa637e7d19ec5025
```

This live output confirms that the session was running under a disposable SDK root rather than the normal per-user root. If `CLOUDSDK_CONFIG` were unset, the Windows path would normally live under `%APPDATA%\gcloud`.

#### Print the exact active configuration file path

When you need to confirm which `config_<name>` file is currently being read. It is typically triggered by the effective configuration seems different from what `activate` last reported, or you are auditing session-level overrides. Read-only diagnostic command. It prints one path projection from `gcloud info`. Identify the exact configuration file currently backing the active context.

*Return the full path to the active configuration file.*

```bash
gcloud info --format="get(config.paths.active_config_path)"
```

```text
C:\Users\aperi\AppData\Local\Temp\codex-gcloud-config-1c6f0b7462cc44dfaa637e7d19ec5025\configurations\config_default
```

The file naming pattern is explicit: the active named configuration `default` maps to `config_default`. A configuration named `prod-eu` would map to `config_prod-eu` under the same `configurations/` directory.

| Command or variable | Flag or variable | Syntax | Description |
|---|---|---|---|
| `gcloud info` | `--format` | `gcloud info --format="get(config.paths.global_config_dir)"` | Projects one path field from the full `gcloud info` output. |
| `gcloud info` | `--format` | `gcloud info --format="get(config.paths.active_config_path)"` | Projects the full path to the active configuration file. |
| environment | `CLOUDSDK_CONFIG` | `CLOUDSDK_CONFIG=/tmp/my-sdk-root` | Replaces the normal per-user Cloud SDK root with a custom directory. |

## Related

- [gcloud-cli-setup](https://alp78.github.io/elysium/06-GCP/01-Core/00-gcloud-cli-setup) — Install the SDK, initialize authentication, and verify the local CLI
- [gcp-resource-hierarchy](https://alp78.github.io/elysium/06-GCP/01-Core/01-gcp-resource-hierarchy) — Understand the project boundary that `core/project` points at
- [gcp-apis-and-services](https://alp78.github.io/elysium/06-GCP/01-Core/02-gcp-apis-and-services) — Enable or disable the APIs that the active project context depends on
- [gcloud-authentication](https://alp78.github.io/elysium/06-GCP/01-Core/03-gcloud-authentication) — Understand which account a configuration should store and how credentials are resolved
- [gcloud-output-formatting](https://alp78.github.io/elysium/06-GCP/01-Core/05-gcloud-output-formatting) — Format configuration and diagnostic output for scripts and automation
- [gcloud-help-and-discovery](https://alp78.github.io/elysium/06-GCP/01-Core/06-gcloud-help-and-discovery) — Use the help system, topics, and release tracks to discover commands safely

## gcloud Configurations References

- [Google Cloud SDK configurations guide](https://cloud.google.com/sdk/docs/configurations)
- [gcloud config configurations reference](https://cloud.google.com/sdk/gcloud/reference/config/configurations)
- [gcloud config set reference](https://cloud.google.com/sdk/gcloud/reference/config/set)
- [gcloud startup and environment variables](https://cloud.google.com/sdk/gcloud/reference/topic/startup)
