---
type: reference
category: terraform
technology: [terraform, gcp, bigquery, firestore, dataflow]
tags: [infrastructure, terraform, iac, bigquery, gcp, firestore]
aliases:
  - terraform data services
  - BigQuery terraform blocks
  - Firestore terraform blocks
  - Dataflow terraform blocks
  - GCP data terraform
  - google_bigquery_dataset terraform
  - google_bigquery_table terraform
  - google_firestore_database terraform
  - google_dataflow_job terraform
keywords:
  - google_bigquery_dataset
  - google_bigquery_table
  - google_bigquery_routine
  - google_bigquery_data_transfer_config
  - google_bigquery_connection
  - google_bigquery_reservation
  - google_bigquery_reservation_assignment
  - google_bigquery_dataset_iam_member
  - google_firestore_database
  - google_firestore_index
  - google_firestore_document
  - google_firestore_backup_schedule
  - google_firebaserules_ruleset
  - google_dataflow_job
  - google_dataflow_flex_template_job
  - google_sql_database_instance
  - google_sql_database
  - google_sql_user
  - google_logging_project_sink
  - google_logging_project_exclusion
  - google_monitoring_alert_policy
  - google_monitoring_notification_channel
  - google_monitoring_uptime_check_config
  - google_monitoring_metric_descriptor
  - google_monitoring_dashboard
  - google_billing_budget
  - BigQuery dataset
  - BigQuery table schema
  - BigQuery partitioning
  - BigQuery clustering
  - BigQuery view
  - BigQuery materialized view
  - BigQuery UDF
  - BigQuery external table
  - BigQuery scheduled query
  - BigQuery slots reservation
  - Firestore native mode
  - Firestore composite index
  - Firestore backup schedule
  - Dataflow batch job
  - Dataflow streaming job
  - Dataflow flex template
  - Cloud SQL PostgreSQL
  - log sink BigQuery
  - monitoring alert policy
  - billing budget threshold
  - time partitioning
  - range partitioning
  - ingestion time partitioning
  - data warehouse
  - GCP data services
description: "Atomic Terraform block library for GCP data services — BigQuery datasets, tables, views, materialized views, UDFs, external tables, scheduled queries, reservations, Firestore databases, indexes, backup schedules, Dataflow batch and streaming jobs, Cloud SQL instances, log sinks, monitoring alert policies, and billing budgets. Every argument is commented inline."
related:
  - "[[terraform-iam-and-secrets]]"
  - "[[terraform-networking]]"
  - "[[terraform-cloud-run]]"
  - "[[terraform-variables-and-outputs]]"
  - "[[terraform-state-management]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform — GCP Data Services Block Library

This note is an atomic block library for GCP data services. Each block is self-contained, production-ready, and commented argument by argument. Copy a block, swap names, wire in your variables, and apply. Blocks are grouped by service and then by resource type within each service. Every section opens with a brief **when to use** paragraph so you can scan quickly.

---

## BigQuery Blocks

BigQuery is GCP's serverless, columnar data warehouse. You interact with it through datasets (logical namespaces), tables (storage), and jobs (queries, loads, exports). Terraform manages the schema, partitioning, IAM, and supplementary features — but does not run queries directly.

---

### Dataset

Use `google_bigquery_dataset` whenever you need a new logical namespace. A dataset is the container for tables, views, routines, and models. You must create a dataset before you can create any child resources. The `location` is immutable after creation — choose the region that co-locates with your Dataflow jobs and GCS buckets to avoid inter-region egress.

```hcl
# creates a BigQuery dataset for the analytics warehouse
resource "google_bigquery_dataset" "analytics" {
  dataset_id                  = "analytics"                    # identifier used in SQL: project.analytics.table
  friendly_name               = "Analytics Warehouse"          # human-readable label shown in BigQuery Console
  description                 = "Central analytics warehouse containing fact and dimension tables." # dataset description
  location                    = var.region                     # region where data physically lives; immutable after creation
  default_table_expiration_ms = null                           # null = tables persist forever; set to e.g. 2592000000 for 30 days
  delete_contents_on_destroy  = false                          # safety: prevents accidental deletion of tables when the resource is destroyed

  labels = {
    env  = var.environment  # e.g. "prod", "staging" — used for cost allocation and filtering
    team = "data"           # team label for cost attribution
  }

  # grant a service account read access at the dataset level
  access {
    role          = "READER"                           # READER, WRITER, or OWNER at dataset scope
    user_by_email = var.reader_service_account_email   # e.g. "pipeline@my-project.iam.gserviceaccount.com"
  }

  # grant a specific user editor access (e.g. a data engineer)
  access {
    role          = "WRITER"            # WRITER grants bigquery.tables.create/update/delete within the dataset
    user_by_email = var.editor_email    # individual user email; prefer service accounts in production
  }
}
```

---

### Table — Native with Time Partitioning and Clustering

Use `google_bigquery_table` for native tables (data stored in BigQuery's managed columnar storage). Time partitioning dramatically reduces query cost for time-series data — BigQuery only scans partitions that match the query filter. Clustering further sorts data within each partition, reducing bytes read for high-cardinality filters.

```hcl
# fact table partitioned by event date and clustered by user and event type
resource "google_bigquery_table" "events_fact" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset; implicit dependency
  table_id            = "events_fact"                                  # table name used in SQL queries
  description         = "One row per user event, partitioned by event_date." # visible in BigQuery Console
  deletion_protection = true                                           # prevents terraform destroy from deleting the table

  labels = {
    env = var.environment  # environment label for cost tracking
  }

  # time-based partitioning: splits table into daily segments by the event_date column
  time_partitioning {
    type                     = "DAY"         # DAY is the most common; also HOUR, MONTH, YEAR
    field                    = "event_date"  # the DATE or TIMESTAMP column to partition by; null = ingestion time
    require_partition_filter = true          # forces queries to include a partition filter — prevents full-table scans
    expiration_ms            = null          # null = partitions never expire; set e.g. 7776000000 for 90 days
  }

  # clustering: physically sorts rows within each partition by these columns (up to 4)
  clustering = ["user_id", "event_type"]  # most selective columns first; matches common WHERE clause patterns

  # JSON array defining every column: name, type, mode, description
  schema = jsonencode([
    {
      name        = "event_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique event identifier (UUID)"
    },
    {
      name        = "event_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Calendar date of the event — used as the partition key"
    },
    {
      name        = "event_timestamp"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "Full UTC timestamp of the event"
    },
    {
      name        = "user_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "User identifier — first clustering column"
    },
    {
      name        = "event_type"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Event category (e.g. page_view, purchase) — second clustering column"
    },
    {
      name        = "properties"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Flexible key-value bag for event-specific attributes"
    },
    {
      name        = "revenue_usd"
      type        = "NUMERIC"
      mode        = "NULLABLE"
      description = "Revenue attributed to this event in USD; null for non-revenue events"
    }
  ])
}
```

---

### Table — Range Partitioning

Use range partitioning when your natural partition key is an integer (e.g. a shard ID, account tier, or sequential customer ID range) rather than a date. BigQuery creates a partition per range interval and queries only touch relevant buckets.

```hcl
# dimension table range-partitioned by account_tier_id
resource "google_bigquery_table" "accounts_by_tier" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id            = "accounts_by_tier"                             # table name
  deletion_protection = false                                          # allow destroy in non-prod environments

  # range partitioning: divides the table into integer-keyed buckets
  range_partitioning {
    field = "account_tier_id"  # integer column used to determine the partition

    range {
      start    = 1     # inclusive lower bound of the first partition
      end      = 1000  # exclusive upper bound of the last partition
      interval = 100   # each partition covers 100 consecutive IDs (1-100, 101-200, …)
    }
  }

  schema = jsonencode([
    {
      name        = "account_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Globally unique account identifier"
    },
    {
      name        = "account_tier_id"
      type        = "INTEGER"
      mode        = "REQUIRED"
      description = "Numeric tier used as the range partition key (1-999)"
    },
    {
      name        = "account_name"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Human-readable account name"
    },
    {
      name        = "created_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "Account creation timestamp in UTC"
    }
  ])
}
```

---

### Table — Ingestion-Time Partitioning

Use ingestion-time partitioning when you load data into BigQuery via streaming inserts or batch loads and do not have an explicit date column. BigQuery automatically assigns a partition based on the load timestamp and exposes `_PARTITIONTIME` as a pseudo-column for filtering.

```hcl
# raw events table using ingestion-time partitioning (no explicit date column required)
resource "google_bigquery_table" "raw_events" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id            = "raw_events"                                   # raw landing zone for streaming inserts
  deletion_protection = false                                          # allow teardown in dev/staging

  # ingestion-time partitioning: field is omitted, BigQuery uses load time
  time_partitioning {
    type          = "DAY"              # partition granularity: DAY, HOUR, MONTH, or YEAR
    field         = null               # null = use ingestion time (_PARTITIONTIME pseudo-column)
    expiration_ms = 7776000000         # expire partitions after 90 days (90 × 86400 × 1000 ms)
  }

  schema = jsonencode([
    {
      name        = "raw_payload"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Raw JSON string received from the event source"
    },
    {
      name        = "source_system"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Identifier for the upstream system that produced the event"
    },
    {
      name        = "received_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "UTC timestamp when the payload was received by the ingestion layer"
    }
  ])
}
```

---

### External Table (GCS-backed)

Use an external table when data lives in GCS and you want to query it with SQL without loading it into BigQuery native storage. This is ideal for Parquet files produced by Dataflow, CSV exports from other systems, or JSON log archives. External tables do not support partitioning as efficiently as native tables, so use them for exploration or low-frequency queries.

```hcl
# external table pointing to Parquet files in GCS — query without loading data into BigQuery
resource "google_bigquery_table" "external_parquet" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id            = "external_parquet_events"                      # table name visible in SQL
  deletion_protection = false                                          # dropping the table does not delete GCS files

  # external_data_configuration links the table to GCS rather than BigQuery storage
  external_data_configuration {
    source_format = "PARQUET"  # format: PARQUET, CSV, NEWLINE_DELIMITED_JSON, AVRO, ORC

    # glob patterns pointing to GCS objects; can include multiple URIs
    source_uris = [
      "gs://${var.data_bucket}/exports/events/*.parquet",  # all Parquet files under this prefix
    ]

    # for Parquet, schema auto-detection reads column names and types from file metadata
    autodetect = true  # set to false and provide schema = jsonencode([...]) for explicit control

    hive_partitioning_options {
      mode                     = "AUTO"                       # AUTO infers partition keys from directory structure
      source_uri_prefix        = "gs://${var.data_bucket}/exports/events/"  # root prefix for partition discovery
      require_partition_filter = false                        # set to true to enforce partition pruning in queries
    }
  }
}

# external table pointing to CSV files — explicit schema, no auto-detection
resource "google_bigquery_table" "external_csv" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id   = "external_csv_accounts"                        # table name

  external_data_configuration {
    source_format = "CSV"  # comma-separated values

    source_uris = [
      "gs://${var.data_bucket}/exports/accounts/*.csv",  # all CSV files under prefix
    ]

    autodetect = false  # explicit schema defined below

    csv_options {
      quote             = "\""   # character used to quote fields containing delimiters
      skip_leading_rows = 1      # number of header rows to ignore (1 = skip column header)
      field_delimiter   = ","    # column separator
      allow_quoted_newlines = false  # whether newlines inside quoted strings are allowed
    }
  }

  schema = jsonencode([
    { name = "account_id",   type = "STRING",  mode = "REQUIRED", description = "Account identifier" },
    { name = "account_name", type = "STRING",  mode = "NULLABLE", description = "Account display name" },
    { name = "created_at",   type = "STRING",  mode = "NULLABLE", description = "ISO-8601 creation timestamp as string" }
  ])
}
```

---

### View

Use a `google_bigquery_table` with a `view` block to define a SQL view. Views are virtual — they store only the query definition, not data. Use views to expose a clean, stable interface on top of raw or partitioned tables, apply row-level filters, or join multiple tables into a denormalized shape.

```hcl
# SQL view that surfaces only the last 30 days of events with basic transformations
resource "google_bigquery_table" "events_last_30d" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id            = "v_events_last_30d"                            # convention: prefix views with "v_"
  deletion_protection = false                                          # views can be safely recreated

  view {
    # SQL that defines the view — references the underlying fact table
    query = <<-SQL
      SELECT
        event_id,
        event_date,
        user_id,
        event_type,
        revenue_usd
      FROM
        `${var.project_id}.analytics.events_fact`
      WHERE
        event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    SQL

    use_legacy_sql = false  # always false for standard SQL; legacy SQL is deprecated
  }
}
```

---

### Materialized View

Use a materialized view when a view is too slow because its underlying query is expensive and runs frequently. BigQuery pre-computes and caches the result and automatically refreshes it when the base table changes. Materialized views must query a single base table and cannot use non-deterministic functions.

```hcl
# materialized view: pre-aggregated daily revenue by event type — auto-refreshed
resource "google_bigquery_table" "mv_daily_revenue" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  table_id            = "mv_daily_revenue_by_type"                     # prefix with "mv_" for clarity
  deletion_protection = false                                          # safe to recreate from definition

  materialized_view {
    # aggregation query over the partitioned fact table
    query = <<-SQL
      SELECT
        event_date,
        event_type,
        COUNT(*)                     AS event_count,
        SUM(IFNULL(revenue_usd, 0))  AS total_revenue_usd
      FROM
        `${var.project_id}.analytics.events_fact`
      GROUP BY
        event_date,
        event_type
    SQL

    enable_refresh      = true   # allow BigQuery to auto-refresh when the base table changes
    refresh_interval_ms = 1800000  # minimum refresh interval in ms (1800000 ms = 30 minutes)
  }
}
```

---

### Routine (UDF) — SQL and JavaScript

Use `google_bigquery_routine` to define reusable functions (UDFs) or stored procedures. SQL UDFs are fast and portable. JavaScript UDFs are slower but useful for complex string manipulation or external library logic. Store routines in a shared utilities dataset so all datasets can call them.

```hcl
# SQL UDF: normalises an email address to lowercase and strips whitespace
resource "google_bigquery_routine" "normalize_email" {
  dataset_id   = google_bigquery_dataset.analytics.dataset_id  # dataset that owns the routine
  routine_id   = "normalize_email"                              # function name in SQL: dataset.normalize_email(...)
  routine_type = "SCALAR_FUNCTION"                              # SCALAR_FUNCTION or PROCEDURE
  language     = "SQL"                                          # SQL or JAVASCRIPT

  # input argument definition
  arguments {
    name      = "raw_email"  # parameter name referenced in the function body
    data_type = jsonencode({ typeKind = "STRING" })  # argument type as JSON TypeKind
  }

  return_type = jsonencode({ typeKind = "STRING" })  # return type of the function

  # function body: pure SQL expression
  definition_body = "LOWER(TRIM(raw_email))"  # strips whitespace and lowercases the email
}

# JavaScript UDF: parses a custom event property string using regex
resource "google_bigquery_routine" "extract_campaign" {
  dataset_id   = google_bigquery_dataset.analytics.dataset_id  # parent dataset
  routine_id   = "extract_campaign"                             # callable as dataset.extract_campaign(...)
  routine_type = "SCALAR_FUNCTION"                              # returns a single value per row
  language     = "JAVASCRIPT"                                   # JavaScript engine runs in BigQuery sandbox

  arguments {
    name      = "properties_json"                              # JSON string containing event properties
    data_type = jsonencode({ typeKind = "STRING" })
  }

  return_type = jsonencode({ typeKind = "STRING" })  # returns the campaign name or null

  # JavaScript function body — must return the same type as return_type
  definition_body = <<-JS
    try {
      var obj = JSON.parse(properties_json);
      return obj.campaign || null;
    } catch (e) {
      return null;
    }
  JS
}
```

---

### Dataset IAM Member

Use `google_bigquery_dataset_iam_member` to grant roles at the dataset level. This is additive — it does not replace the access blocks inside the dataset resource. Prefer this resource when you need to grant access from a module or when the grantee is determined at runtime.

```hcl
# grant a service account dataEditor access to the analytics dataset
resource "google_bigquery_dataset_iam_member" "pipeline_editor" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id  # target dataset
  project    = var.project_id                                 # GCP project containing the dataset
  role       = "roles/bigquery.dataEditor"                    # can create/update/delete tables; cannot run queries
  member     = "serviceAccount:${var.pipeline_sa_email}"      # principal to grant; format: serviceAccount:email
}

# grant a group read-only access to browse and query the dataset
resource "google_bigquery_dataset_iam_member" "analysts_viewer" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id  # target dataset
  project    = var.project_id                                 # GCP project
  role       = "roles/bigquery.dataViewer"                    # can list and read tables; cannot modify
  member     = "group:${var.analyst_group_email}"             # Google Group email; format: group:email
}

# grant a user the BigQuery User role at project level (required to run queries)
resource "google_project_iam_member" "analyst_bq_user" {
  project = var.project_id           # GCP project
  role    = "roles/bigquery.user"    # allows running jobs and reading results; combined with dataViewer grants full read access
  member  = "group:${var.analyst_group_email}"  # same group as above
}
```

---

### Scheduled Query (Data Transfer Service)

Use `google_bigquery_data_transfer_config` to run a SQL query on a schedule without Airflow or Cloud Scheduler. This is the BigQuery-native way to run daily aggregation jobs, snapshot tables, or move data between datasets. The service account must have bigquery.admin or a combination of editor + job user roles.

```hcl
# daily aggregation: insert yesterday's revenue summary into a reporting table at 02:00 UTC
resource "google_bigquery_data_transfer_config" "daily_revenue_agg" {
  display_name           = "Daily Revenue Aggregation"             # name visible in BigQuery Data Transfers UI
  location               = var.region                              # must match the dataset region
  data_source_id         = "scheduled_query"                       # always "scheduled_query" for SQL-based transfers
  schedule               = "every 24 hours"                        # cron-like schedule; also accepts "every day 02:00"
  destination_dataset_id = google_bigquery_dataset.analytics.dataset_id  # target dataset for the query results

  # params block contains the SQL query and write disposition
  params = {
    query = <<-SQL
      INSERT INTO `${var.project_id}.analytics.daily_revenue`
      SELECT
        DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)  AS report_date,
        event_type,
        SUM(IFNULL(revenue_usd, 0))               AS total_revenue_usd,
        COUNT(*)                                   AS event_count
      FROM
        `${var.project_id}.analytics.events_fact`
      WHERE
        event_date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      GROUP BY
        event_type
    SQL

    destination_table_name_template = "daily_revenue"  # target table within the destination dataset
    write_disposition               = "WRITE_APPEND"   # WRITE_APPEND or WRITE_TRUNCATE
    partitioning_field              = "report_date"    # column to use for partitioning the destination table
  }

  service_account_name = var.pipeline_sa_email  # SA used to execute the query; must have editor + bigquery.jobUser
}
```

---

### BigQuery Connection (Federated Query — Cloud SQL)

Use `google_bigquery_connection` to let BigQuery query Cloud SQL or Cloud Spanner in place as if they were BigQuery tables. This enables JOIN queries between BigQuery data and live operational database tables without ETL. Connection credentials are stored securely in Cloud SQL's connector.

```hcl
# federated query connection from BigQuery to a Cloud SQL PostgreSQL instance
resource "google_bigquery_connection" "cloudsql_federated" {
  connection_id = "cloudsql-analytics-conn"  # identifier for this connection; referenced in EXTERNAL_QUERY()
  project       = var.project_id             # GCP project
  location      = var.region                 # must match the BigQuery dataset and Cloud SQL instance region
  description   = "Federated query connection to the Cloud SQL PostgreSQL analytics replica."

  cloud_sql {
    instance_id = google_sql_database_instance.analytics_pg.connection_name  # Cloud SQL connection name
    database    = "analytics"                                                  # database name within the instance
    type        = "POSTGRES"                                                   # POSTGRES or MYSQL

    credential {
      username = var.cloudsql_user      # database user with SELECT privileges
      password = var.cloudsql_password  # password for the user; use Secret Manager + data source in production
    }
  }
}
```

---

### BigQuery Reservation (Editions — Committed Slots)

Use `google_bigquery_reservation` when you want dedicated slot capacity (Enterprise or Enterprise Plus editions) instead of on-demand pricing. Assign the reservation to projects or folders so their queries consume committed slots first, with on-demand as overflow.

```hcl
# create a slot reservation for the data engineering team (100 baseline slots)
resource "google_bigquery_reservation" "de_team" {
  name              = "de-team-reservation"          # reservation name
  project           = var.project_id                 # project that owns the reservation
  location          = var.region                     # region; must match the datasets using this reservation
  slot_capacity     = 100                            # baseline slots; always available to assigned projects
  edition           = "ENTERPRISE"                   # STANDARD, ENTERPRISE, or ENTERPRISE_PLUS
  ignore_idle_slots = false                          # false = idle slots are shared with org; true = reserved exclusively
}

# assign the reservation to a specific project so its queries use committed slots
resource "google_bigquery_reservation_assignment" "de_project_assignment" {
  assignee    = "projects/${var.project_id}"                       # resource to assign: projects/X, folders/X, or organizations/X
  job_type    = "QUERY"                                            # QUERY, PIPELINE, or ML_EXTERNAL
  reservation = google_bigquery_reservation.de_team.id            # reservation to assign to
}
```

---

## Firestore Blocks

Firestore is GCP's serverless, scalable NoSQL document database. Native mode Firestore is the recommended choice for new projects. Terraform can manage the database instance, composite indexes, backup schedules, and security rules — but document data itself is managed at runtime (or seeded via `null_resource`).

---

### Firestore Database

Use `google_firestore_database` to provision the Firestore instance. A GCP project can have one default database (`(default)`) or multiple named databases. Native mode is strongly preferred — Datastore mode is for legacy Datastore migrations only.

```hcl
# provision a Firestore native-mode database in the project region
resource "google_firestore_database" "main" {
  project                     = var.project_id    # GCP project; Firestore is project-scoped
  name                        = "(default)"        # "(default)" or a custom name like "analytics-db"
  location_id                 = var.region         # must match the App Engine location if App Engine is enabled
  type                        = "FIRESTORE_NATIVE"  # FIRESTORE_NATIVE or DATASTORE_MODE (legacy)
  concurrency_mode            = "OPTIMISTIC"        # OPTIMISTIC (default) or PESSIMISTIC (serializable transactions)
  app_engine_integration_mode = "DISABLED"          # ENABLED only if you use App Engine; DISABLED for standalone Firestore

  deletion_policy = "DELETE"  # DELETE = allow terraform destroy; ABANDON = orphan the db without deleting
}
```

---

### Firestore Index

Use `google_firestore_index` to create composite indexes required for queries that filter or order by multiple fields. Firestore does not auto-create composite indexes — if a query needs one and it does not exist, the query fails with an error pointing to the Firebase console. Define all required indexes in Terraform to catch this at apply time.

```hcl
# composite index: query sessions by user_id, ordered by created_at descending
resource "google_firestore_index" "sessions_by_user" {
  project    = var.project_id                        # GCP project
  database   = google_firestore_database.main.name   # target database; "(default)" or named
  collection = "sessions"                            # Firestore collection this index applies to

  # fields define the query pattern this index supports
  fields {
    field_path = "user_id"   # first filter field
    order      = "ASCENDING" # ASCENDING or DESCENDING; for equality filters, ASCENDING is conventional
  }

  fields {
    field_path = "created_at"  # second field — the one being ordered
    order      = "DESCENDING"  # most recent sessions first
  }
}

# composite index: filter by status and sort by priority for a task queue pattern
resource "google_firestore_index" "tasks_by_status_priority" {
  project    = var.project_id
  database   = google_firestore_database.main.name
  collection = "tasks"

  fields {
    field_path = "status"    # equality filter field (e.g. WHERE status = "pending")
    order      = "ASCENDING"
  }

  fields {
    field_path = "priority"   # ordering field (e.g. ORDER BY priority ASC)
    order      = "ASCENDING"  # lowest priority number = highest urgency
  }

  fields {
    field_path = "__name__"  # always include __name__ as the final field for stable pagination
    order      = "ASCENDING"
  }
}
```

---

### Firestore Document Seed (via null_resource + gcloud)

Terraform's `google_firestore_document` resource exists but is limited — it cannot easily handle subcollections or complex merge semantics. The most reliable pattern for seeding initial config documents is a `null_resource` with a `local-exec` provisioner running `gcloud firestore` or a small Python script. This runs once at creation time.

```hcl
# seed an application config document in Firestore at first apply
resource "null_resource" "seed_app_config" {
  # triggers: re-run the provisioner only when the document content changes
  triggers = {
    config_hash = sha256(jsonencode({          # hash the desired document content
      feature_flags = {
        new_dashboard = true
        beta_api      = false
      }
      maintenance_mode = false
      max_upload_mb    = 50
    }))
    database = google_firestore_database.main.name  # re-run if the database changes
  }

  provisioner "local-exec" {
    # write the document using gcloud — runs on the machine executing terraform apply
    command = <<-BASH
      gcloud firestore documents create \
        projects/${var.project_id}/databases/${google_firestore_database.main.name}/documents/config/app \
        --project=${var.project_id} \
        --document-id=app \
        --data='featureFlags.newDashboard=true,featureFlags.betaApi=false,maintenanceMode=false,maxUploadMb=50' \
        2>/dev/null || \
      gcloud firestore documents update \
        projects/${var.project_id}/databases/${google_firestore_database.main.name}/documents/config/app \
        --project=${var.project_id} \
        --data='featureFlags.newDashboard=true,featureFlags.betaApi=false,maintenanceMode=false,maxUploadMb=50'
    BASH
    # the || update pattern handles both first-run (create) and idempotent update scenarios
  }

  depends_on = [google_firestore_database.main]  # ensure the database exists before seeding
}
```

---

### Firestore Backup Schedule

Use `google_firestore_backup_schedule` to automatically export Firestore data to GCS on a daily or weekly schedule. Backups protect against accidental deletions and data corruption. GCP stores backups in a managed bucket — you do not provision the bucket yourself.

```hcl
# daily Firestore backup retained for 7 days
resource "google_firestore_backup_schedule" "daily" {
  project  = var.project_id                      # GCP project
  database = google_firestore_database.main.name  # target database

  retention = "604800s"  # retention period in seconds: 604800s = 7 days

  daily_recurrence {}  # empty block = run every day at a GCP-managed time
}

# weekly Firestore backup retained for 14 weeks
resource "google_firestore_backup_schedule" "weekly" {
  project  = var.project_id
  database = google_firestore_database.main.name

  retention = "8467200s"  # 8467200s = 98 days ≈ 14 weeks

  weekly_recurrence {
    day = "SUNDAY"  # day of week: MONDAY through SUNDAY
  }
}
```

---

### Firestore Security Rules

Use `google_firebaserules_ruleset` and `google_firebaserules_release` together to deploy Firestore security rules from Terraform. Rules are defined in a `.rules` file checked into source control. This approach keeps rules version-controlled and prevents manual edits from drifting.

```hcl
# upload Firestore security rules from a local file
resource "google_firebaserules_ruleset" "firestore_rules" {
  project = var.project_id  # GCP project with Firebase enabled

  source {
    files {
      name    = "firestore.rules"                  # logical file name within the ruleset
      content = file("${path.module}/firestore.rules")  # read rules from the local filesystem
    }
  }
}

# release the ruleset to the Firestore database — this makes it active
resource "google_firebaserules_release" "firestore_release" {
  name         = "cloud.firestore"                            # always "cloud.firestore" for Firestore
  ruleset_name = google_firebaserules_ruleset.firestore_rules.name  # ruleset to activate
  project      = var.project_id
}
```

Example `firestore.rules` file (managed alongside Terraform, not by it):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // authenticated users can read their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // config documents are read-only for all authenticated users
    match /config/{document} {
      allow read: if request.auth != null;
      allow write: if false;  // only writable via Terraform / backend service
    }
  }
}
```

---

## Dataflow Blocks

Dataflow is GCP's managed Apache Beam execution environment. It runs both batch and streaming pipelines. Terraform manages the job resource — the pipeline code itself is packaged as a Dataflow template (classic or Flex) stored in GCS or Artifact Registry.

---

### Dataflow Job — Batch (Classic Template)

Use `google_dataflow_job` for a batch pipeline that reads data, transforms it, and writes results. Classic templates are pre-compiled JAR or Python packages stored in GCS. Use them when you are running a standard Google-provided template (e.g. GCS to BigQuery, Pub/Sub to GCS).

```hcl
# batch Dataflow job: load Parquet files from GCS into a BigQuery table using a Google template
resource "google_dataflow_job" "gcs_to_bq_batch" {
  name              = "gcs-to-bq-events-${var.environment}"  # job name; must be unique within the project/region
  project           = var.project_id                          # GCP project
  region            = var.region                              # region where workers are provisioned
  zone              = "${var.region}-b"                       # specific zone within the region for workers

  # path to the classic template spec file in GCS
  template_gcs_path = "gs://dataflow-templates-${var.region}/latest/GCS_Avro_to_BigQuery"  # Google-provided template

  # template-specific parameters; keys depend on the chosen template
  parameters = {
    inputFileSpec    = "gs://${var.data_bucket}/exports/events/*.avro"   # source files glob
    outputTableSpec  = "${var.project_id}:analytics.events_fact"          # destination BigQuery table
    outputDeadletterTable = "${var.project_id}:analytics.events_fact_errors"  # bad-record destination
  }

  # GCS path for temporary files (staging, temp data); must be in the same region as the job
  temp_gcs_location = "gs://${var.temp_bucket}/dataflow/tmp"  # cleaned up after job completion

  # machine type for worker VMs; n1-standard-4 is a balanced default for most batch workloads
  machine_type = "n1-standard-4"  # larger machine = more memory/CPU per worker; fewer workers needed

  max_workers = 10   # maximum number of worker VMs Dataflow can scale up to
  num_workers = 2    # initial number of workers at job start; Dataflow autoscales between this and max_workers

  # service account that worker VMs run as; must have read access to GCS and write access to BigQuery
  service_account_email = var.dataflow_sa_email  # e.g. "dataflow@my-project.iam.gserviceaccount.com"

  network    = var.network_name    # VPC network name for worker VMs
  subnetwork = "regions/${var.region}/subnetworks/${var.subnet_name}"  # full subnetwork self-link format

  on_delete = "drain"  # "drain" = finish in-flight work before stopping; "cancel" = stop immediately
}
```

---

### Dataflow Flex Template Job

Use `google_dataflow_flex_template_job` for custom pipelines packaged as Docker containers. Flex templates are more flexible than classic templates — they support dynamic parameters, Python or Java, and can include arbitrary dependencies. The template spec (JSON) points to the container image in Artifact Registry.

```hcl
# Dataflow Flex Template job running a custom Python pipeline container
resource "google_dataflow_flex_template_job" "custom_pipeline" {
  name                      = "custom-pipeline-${var.environment}"  # unique job name
  project                   = var.project_id                         # GCP project
  region                    = var.region                             # Dataflow region
  container_spec_gcs_path   = "gs://${var.templates_bucket}/flex-templates/custom-pipeline.json"  # Flex template spec in GCS

  # pipeline parameters passed into the container at startup
  parameters = {
    input_subscription = "projects/${var.project_id}/subscriptions/${var.pubsub_subscription}"  # Pub/Sub source
    output_table       = "${var.project_id}:analytics.processed_events"                           # BigQuery destination
    window_size        = "5m"                                                                     # tumbling window size
    num_shards         = "10"                                                                     # output file sharding for GCS sinks
  }

  # worker configuration options
  additional_experiments          = ["enable_prime"]                 # experimental features; "enable_prime" uses Dataflow Prime auto-scaling
  machine_type                    = "n1-standard-4"                  # worker VM type
  max_workers                     = 20                               # maximum worker count
  num_workers                     = 3                                # starting worker count
  service_account_email           = var.dataflow_sa_email            # worker service account
  network                         = var.network_name                 # VPC network
  subnetwork                      = "regions/${var.region}/subnetworks/${var.subnet_name}"  # subnetwork
  temp_location                   = "gs://${var.temp_bucket}/dataflow/tmp"  # GCS temp path
  enable_streaming_engine         = false                            # false for batch; true for streaming Flex jobs
  ip_configuration                = "WORKER_IP_PRIVATE"             # WORKER_IP_PRIVATE = workers have no public IPs

  on_delete = "drain"  # drain in-flight work on terraform destroy; "cancel" for immediate stop
}
```

---

### Dataflow Job — Streaming

Use `google_dataflow_job` with streaming parameters when you need a continuously running pipeline (Pub/Sub to BigQuery, Pub/Sub to GCS, etc.). Streaming jobs do not terminate — `on_delete = "drain"` is critical to ensure in-flight messages are committed before the job stops.

```hcl
# streaming Dataflow job: Pub/Sub to BigQuery, runs continuously
resource "google_dataflow_job" "pubsub_to_bq_streaming" {
  name    = "pubsub-to-bq-streaming-${var.environment}"  # job name
  project = var.project_id
  region  = var.region

  # Google-provided streaming template: Pub/Sub Topic to BigQuery
  template_gcs_path = "gs://dataflow-templates-${var.region}/latest/PubSub_to_BigQuery"

  parameters = {
    inputTopic          = "projects/${var.project_id}/topics/${var.input_topic}"  # Pub/Sub source topic
    outputTableSpec     = "${var.project_id}:analytics.raw_events"                 # BigQuery destination
    outputDeadletterTable = "${var.project_id}:analytics.raw_events_deadletter"   # failed message sink
  }

  temp_gcs_location = "gs://${var.temp_bucket}/dataflow/tmp"  # required temp location

  machine_type = "n1-standard-2"  # streaming jobs are typically memory-bound; start small and scale
  max_workers  = 5                 # streaming jobs autoscale based on Pub/Sub backlog
  num_workers  = 1                 # start with a single worker; Dataflow scales up as backlog grows

  service_account_email = var.dataflow_sa_email  # SA needs Pub/Sub subscriber + BigQuery dataEditor

  network    = var.network_name
  subnetwork = "regions/${var.region}/subnetworks/${var.subnet_name}"

  # streaming-specific: update allows replacing a running job without message loss (same job name)
  # set update = true when deploying a new version of a running streaming job
  # update = false  # default; set to true only for in-place streaming job updates

  on_delete = "drain"  # CRITICAL for streaming: drains in-flight Pub/Sub messages before shutdown
}
```

---

## Cloud SQL Blocks

Cloud SQL is GCP's managed relational database service. These blocks cover the most common configuration: a PostgreSQL instance with private IP (no public endpoint), automated backups, and a read replica. Use this alongside BigQuery for operational workloads that require transactions.

---

### Cloud SQL Instance (PostgreSQL)

Use `google_sql_database_instance` to provision the database server. Private IP configuration requires a VPC peering connection (`google_service_networking_connection`) to exist first. High availability (`REGIONAL`) provisions a standby instance in a second zone with automatic failover.

```hcl
# Cloud SQL PostgreSQL instance with private IP and automated backups
resource "google_sql_database_instance" "analytics_pg" {
  name                = "analytics-pg-${var.environment}"  # instance name; globally unique within GCP
  project             = var.project_id                      # GCP project
  region              = var.region                          # instance region; immutable after creation
  database_version    = "POSTGRES_15"                       # major version; POSTGRES_14 or POSTGRES_15 are current LTS
  deletion_protection = true                                # prevents accidental terraform destroy

  settings {
    tier              = "db-custom-2-7680"  # machine type: db-custom-{vCPU}-{RAM_MB}; 2 vCPU, 7.5 GB RAM
    availability_type = "REGIONAL"          # REGIONAL = HA with standby; ZONAL = single zone, no failover
    disk_type         = "PD_SSD"            # PD_SSD for production; PD_HDD for dev/archive workloads
    disk_size         = 100                 # initial disk size in GB; Cloud SQL auto-grows if storage_auto_resize enabled
    disk_autoresize   = true                # automatically expand disk when 90% full; no downtime required

    # backup configuration
    backup_configuration {
      enabled                        = true       # enable automated daily backups
      start_time                     = "02:00"    # UTC time to start the backup window (HH:MM format)
      point_in_time_recovery_enabled = true       # enables WAL archiving for point-in-time recovery
      transaction_log_retention_days = 7          # days of WAL logs to retain for PITR
      backup_retention_settings {
        retained_backups = 14     # number of daily backups to retain
        retention_unit   = "COUNT"  # COUNT = retain N backups; TIME = retain for duration
      }
    }

    # maintenance window: when Cloud SQL applies version updates and maintenance
    maintenance_window {
      day          = 7   # 1=Monday … 7=Sunday; Sunday maintenance minimises weekday disruption
      hour         = 3   # UTC hour; 3 AM UTC = low-traffic window for most EU/US workloads
      update_track = "stable"  # "stable" = slower rollout; "canary" = early updates
    }

    # private IP configuration — no public endpoint
    ip_configuration {
      ipv4_enabled    = false  # disable public IP; workers connect via private IP only
      private_network = var.network_self_link  # VPC network self-link; requires VPC peering to servicenetworking.googleapis.com

      # SSL enforcement
      ssl_mode = "ENCRYPTED_ONLY"  # ENCRYPTED_ONLY = TLS required but cert not verified; TRUSTED_CLIENT_CERTIFICATE_REQUIRED = mTLS
    }

    # database flags: PostgreSQL server configuration parameters
    database_flags {
      name  = "max_connections"  # maximum concurrent database connections
      value = "200"              # adjust based on connection pool size; default is ~100
    }

    database_flags {
      name  = "log_min_duration_statement"  # log queries slower than N milliseconds
      value = "1000"                         # 1000 ms = log queries taking longer than 1 second
    }

    database_flags {
      name  = "cloudsql.enable_pg_cron"  # enable pg_cron extension for scheduled SQL jobs
      value = "on"
    }
  }

  depends_on = [var.private_service_connection]  # VPC peering must exist before private IP allocation
}
```

---

### Cloud SQL Database

Use `google_sql_database` to create a named database (schema namespace) within the Cloud SQL instance. Each logical application or service should have its own database to isolate data and permissions.

```hcl
# create the analytics database within the Cloud SQL instance
resource "google_sql_database" "analytics" {
  name      = "analytics"                                     # database name; used in connection strings
  instance  = google_sql_database_instance.analytics_pg.name  # parent Cloud SQL instance
  project   = var.project_id                                  # GCP project
  charset   = "UTF8"                                          # character encoding; UTF8 is the universal default for PostgreSQL
  collation = "en_US.UTF8"                                    # collation for string sorting; en_US.UTF8 is most compatible
}
```

---

### Cloud SQL User

Use `google_sql_user` to provision database users. In production, generate the password with `random_password` and store it in Secret Manager rather than hardcoding it. IAM database authentication is also available for Cloud SQL PostgreSQL and is preferred for service accounts.

```hcl
# generate a secure random password for the application database user
resource "random_password" "db_password" {
  length           = 32    # 32-character password
  special          = true  # include special characters for complexity
  override_special = "!#$%&*()-_=+[]{}<>:?"  # safe subset of special chars that work in most connection strings
}

# create the application database user
resource "google_sql_user" "app_user" {
  name     = "app_service"                                        # PostgreSQL username
  instance = google_sql_database_instance.analytics_pg.name       # parent Cloud SQL instance
  project  = var.project_id                                       # GCP project
  password = random_password.db_password.result                   # generated password from above
}

# store the password in Secret Manager so applications can retrieve it at runtime
resource "google_secret_manager_secret" "db_password" {
  secret_id = "analytics-db-password"  # secret identifier; referenced by Cloud Run and other services
  project   = var.project_id

  replication {
    auto {}  # GCP manages replication across regions automatically
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id  # parent secret
  secret_data = random_password.db_password.result           # the actual password value
}
```

---

## Monitoring and Logging Blocks

Cloud Monitoring and Cloud Logging provide observability for GCP resources and custom application metrics. These blocks configure log exports, alert policies, notification channels, and dashboards declaratively.

---

### Log Sink (Export to BigQuery)

Use `google_logging_project_sink` to export logs to BigQuery, GCS, or Pub/Sub for long-term retention and analysis. Logs stay in Cloud Logging for only 30 days (default) — a BigQuery sink lets you query historical logs with SQL. The sink creates a service account that needs write access to the destination.

```hcl
# export all BigQuery audit logs to a BigQuery dataset for compliance and analysis
resource "google_logging_project_sink" "bq_audit_to_bq" {
  name        = "bq-audit-logs-to-bigquery"                         # sink name; unique within the project
  project     = var.project_id                                       # source project whose logs are exported
  description = "Export BigQuery data access audit logs to BigQuery for 90-day SQL-queryable retention."

  # destination: BigQuery dataset to receive the exported logs
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.analytics.dataset_id}"

  # inclusion filter: only export BigQuery data access logs (not all project logs)
  filter = <<-FILTER
    resource.type="bigquery_dataset" OR resource.type="bigquery_project"
    AND logName=~"projects/${var.project_id}/logs/cloudaudit.googleapis.com%2Fdata_access"
  FILTER

  bigquery_options {
    use_partitioned_tables = true  # write logs into daily partitioned tables; reduces query cost significantly
  }

  unique_writer_identity = true  # creates a dedicated SA for this sink; recommended over shared identity
}

# grant the sink's service account permission to write to the BigQuery dataset
resource "google_bigquery_dataset_iam_member" "sink_writer" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id  # target dataset
  project    = var.project_id
  role       = "roles/bigquery.dataEditor"                    # sink needs to create tables and insert rows
  member     = google_logging_project_sink.bq_audit_to_bq.writer_identity  # auto-generated SA for this sink
}

# export application logs to GCS for archival (cheaper long-term storage than BigQuery)
resource "google_logging_project_sink" "app_logs_to_gcs" {
  name        = "app-logs-to-gcs-archive"
  project     = var.project_id
  description = "Archive Cloud Run application logs to GCS for 365-day retention."

  destination = "storage.googleapis.com/${var.archive_bucket}"  # GCS bucket destination (no trailing slash)

  filter = "resource.type=\"cloud_run_revision\""  # only Cloud Run logs

  unique_writer_identity = true
}

# grant the GCS sink SA write access to the archive bucket
resource "google_storage_bucket_iam_member" "sink_gcs_writer" {
  bucket = var.archive_bucket                                              # target GCS bucket
  role   = "roles/storage.objectCreator"                                   # create objects; cannot delete or overwrite
  member = google_logging_project_sink.app_logs_to_gcs.writer_identity    # sink's service account
}
```

---

### Log Exclusion

Use `google_logging_project_exclusion` to drop high-volume, low-value logs before they consume Cloud Logging quota or fill your exported sinks. Common exclusions are DEBUG-level application logs, health check requests, and Cloud Run container lifecycle events.

```hcl
# exclude DEBUG-level logs from all Cloud Run services to reduce log volume
resource "google_logging_project_exclusion" "debug_logs" {
  name        = "exclude-debug-logs"                           # exclusion name
  project     = var.project_id                                  # GCP project
  description = "Drop DEBUG severity logs from Cloud Run to reduce Cloud Logging costs."

  # logs matching this filter are dropped — never stored or exported
  filter = <<-FILTER
    resource.type="cloud_run_revision"
    AND severity=DEBUG
  FILTER

  disabled = false  # true = temporarily disable the exclusion without deleting it
}

# exclude Cloud Run health check requests (200 OK from /healthz) — extremely high volume, zero signal
resource "google_logging_project_exclusion" "health_check_logs" {
  name        = "exclude-health-check-requests"
  project     = var.project_id
  description = "Drop successful health check requests from Cloud Run load balancer probes."

  filter = <<-FILTER
    resource.type="cloud_run_revision"
    AND httpRequest.requestUrl=~"^/healthz"
    AND httpRequest.status=200
  FILTER

  disabled = false
}
```

---

### Monitoring Alert Policy

Use `google_monitoring_alert_policy` to create alerting conditions on GCP metrics. Alert policies consist of conditions (the metric threshold) and notification channels (where to send alerts). Keep conditions specific to avoid alert fatigue.

```hcl
# alert when BigQuery bytes scanned per day exceeds a cost threshold
resource "google_monitoring_alert_policy" "bq_bytes_scanned" {
  display_name = "BigQuery — Daily Bytes Scanned Exceeds Threshold"  # alert name shown in console and notifications
  project      = var.project_id                                       # GCP project
  combiner     = "OR"                                                 # OR = alert if any condition fires; AND = all conditions must fire

  conditions {
    display_name = "Daily bytes scanned > 1 TB"  # condition name; appears in alert details

    condition_threshold {
      filter = "resource.type = \"bigquery_project\" AND metric.type = \"bigquery.googleapis.com/storage/table_count\""
      # more useful filter for bytes scanned:
      # "resource.type = \"global\" AND metric.type = \"bigquery.googleapis.com/job/completed_row_count\""

      comparison      = "COMPARISON_GT"     # COMPARISON_GT = greater than; also LT, GE, LE, EQ, NE
      threshold_value = 1099511627776.0     # 1 TB in bytes (1024^4); alert if daily scan exceeds this
      duration        = "0s"                # 0s = alert immediately; "300s" = must persist for 5 min before alerting

      aggregations {
        alignment_period     = "86400s"         # aggregate over 24 hours (1 day) — daily scanned bytes
        per_series_aligner   = "ALIGN_SUM"      # SUM bytes within the alignment period
        cross_series_reducer = "REDUCE_SUM"     # SUM across all series (all users, all queries)
      }
    }
  }

  # link to notification channels defined below
  notification_channels = [
    google_monitoring_notification_channel.email_data_team.id,  # send to email channel
  ]

  alert_strategy {
    auto_close = "86400s"  # auto-resolve the alert after 24 hours if it stops firing; prevents stale alerts
  }

  documentation {
    content   = "Daily BigQuery bytes scanned has exceeded 1 TB. Review recent scheduled queries and ad-hoc scans for unexpectedly large table reads. Use partition filters to reduce scan volume."  # runbook text shown in alert UI
    mime_type = "text/markdown"  # markdown is rendered in the Cloud Console alert detail page
  }
}

# alert when Dataflow job fails (streaming job exits unexpectedly)
resource "google_monitoring_alert_policy" "dataflow_job_failed" {
  display_name = "Dataflow — Streaming Job Failed"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Dataflow job state = JOB_STATE_FAILED"

    condition_threshold {
      filter          = "resource.type = \"dataflow_job\" AND metric.type = \"dataflow.googleapis.com/job/is_failed\""
      comparison      = "COMPARISON_GT"  # greater than 0 means at least one job is in a failed state
      threshold_value = 0                # any failure triggers the alert
      duration        = "60s"            # must persist for 60 seconds to avoid transient state flickers

      aggregations {
        alignment_period   = "60s"         # check every 60 seconds
        per_series_aligner = "ALIGN_MAX"   # MAX ensures a brief failure is not averaged away
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email_data_team.id,
    google_monitoring_notification_channel.pubsub_alerts.id,  # also publish to Pub/Sub for automated remediation
  ]

  documentation {
    content   = "A Dataflow streaming job has entered the FAILED state. Check the Dataflow job logs for error details. Common causes: out-of-memory, malformed messages from Pub/Sub, or broken BigQuery schema."
    mime_type = "text/markdown"
  }
}
```

---

### Monitoring Notification Channel

Use `google_monitoring_notification_channel` to define where alert notifications are delivered. Create separate channels for email, PagerDuty, Slack (via Pub/Sub webhook), and Pub/Sub (for programmatic handling).

```hcl
# email notification channel for the data engineering team
resource "google_monitoring_notification_channel" "email_data_team" {
  display_name = "Data Team — Email Alerts"       # channel name shown in alert policy selector
  project      = var.project_id                   # GCP project
  type         = "email"                          # channel type: email, sms, pagerduty, slack, pubsub, webhook_tokenauth

  labels = {
    email_address = var.data_team_email  # recipient email or Google Group email
  }

  enabled = true  # false = disable without deleting; useful for silencing during maintenance
}

# Pub/Sub notification channel for programmatic alert handling (e.g. auto-remediation Cloud Function)
resource "google_monitoring_notification_channel" "pubsub_alerts" {
  display_name = "Alerts — Pub/Sub (Automation)"  # descriptive name indicating its programmatic purpose
  project      = var.project_id
  type         = "pubsub"                          # publish alert payloads to a Pub/Sub topic

  labels = {
    topic = "projects/${var.project_id}/topics/${var.alerts_topic}"  # full Pub/Sub topic resource name
  }

  enabled = true
}
```

---

### Uptime Check

Use `google_monitoring_uptime_check_config` to verify that an HTTP endpoint is reachable and returns the expected response. Uptime checks run from multiple GCP regions and fire an alert if the check fails from a configurable number of regions.

```hcl
# HTTP uptime check for the Cloud Run dashboard service
resource "google_monitoring_uptime_check_config" "dashboard_health" {
  display_name = "Dashboard — HTTP Health Check"  # check name shown in Monitoring console
  project      = var.project_id                   # GCP project
  period       = "60s"                            # how often to run the check: 60s, 300s, 600s, or 900s
  timeout      = "10s"                            # request timeout; must be less than or equal to period

  # HTTP check configuration
  http_check {
    path         = "/healthz"     # URL path to probe; must return 2xx for the check to pass
    port         = 443            # HTTPS on port 443
    use_ssl      = true           # enable HTTPS; set to false for plain HTTP
    validate_ssl = true           # verify the SSL certificate is valid and not expired

    # optional: validate specific content in the response body
    content_matchers {
      content = "ok"              # response body must contain this string (case-sensitive)
      matcher = "CONTAINS_STRING" # CONTAINS_STRING, NOT_CONTAINS_STRING, MATCHES_REGEX, etc.
    }
  }

  # where to send check requests — the monitored resource endpoint
  monitored_resource {
    type = "uptime_url"           # check type; "uptime_url" for generic HTTP endpoints
    labels = {
      project_id = var.project_id                      # GCP project
      host       = var.dashboard_cloud_run_url          # Cloud Run service URL without the https:// scheme
    }
  }

  # regions from which to run the check; multiple regions prevent false positives from regional outages
  selected_regions = ["USA", "EUROPE", "ASIA_PACIFIC"]  # check from three continents
}
```

---

### Custom Metric Descriptor

Use `google_monitoring_metric_descriptor` to register a custom metric type that your application code writes to Cloud Monitoring. Define the metric once in Terraform so it appears in the Metrics Explorer and can be referenced in alert policies and dashboards before any data is written.

```hcl
# custom metric: number of records processed by the ETL pipeline per minute
resource "google_monitoring_metric_descriptor" "pipeline_records_processed" {
  project      = var.project_id                    # GCP project
  display_name = "Pipeline Records Processed"      # human-readable name in Metrics Explorer

  # metric type: must start with "custom.googleapis.com/" or "external.googleapis.com/"
  type        = "custom.googleapis.com/pipeline/records_processed"  # unique metric identifier

  metric_kind = "GAUGE"        # GAUGE = instantaneous value; CUMULATIVE = ever-increasing counter; DELTA = change in interval
  value_type  = "INT64"        # INT64, DOUBLE, STRING, BOOL, DISTRIBUTION
  unit        = "1"            # unit string: "1" = dimensionless count; "By" = bytes; "s" = seconds; "{records}" = custom unit
  description = "Number of records successfully processed by the ETL pipeline in the current reporting interval."

  # labels add dimensions to the metric (e.g. filter by pipeline_name in charts and alerts)
  labels {
    key         = "pipeline_name"  # label key; referenced in metric filters as metric.labels.pipeline_name
    value_type  = "STRING"         # STRING, BOOL, or INT64
    description = "Name of the pipeline writing this metric"
  }

  labels {
    key         = "environment"
    value_type  = "STRING"
    description = "Deployment environment: prod, staging, or dev"
  }
}
```

---

### Monitoring Dashboard

Use `google_monitoring_dashboard` to provision a Cloud Monitoring dashboard as code. Dashboards are defined as JSON (the dashboard spec format used by the GCP API). The easiest workflow is to build the dashboard in the GCP Console, then export the JSON with `gcloud monitoring dashboards describe` and paste it into Terraform.

```hcl
# Cloud Monitoring dashboard for the data pipeline: BigQuery scanned bytes + Dataflow throughput
resource "google_monitoring_dashboard" "data_pipeline" {
  project        = var.project_id  # GCP project
  dashboard_json = jsonencode({    # full dashboard spec as a JSON object

    displayName = "Data Pipeline — Overview"  # dashboard title shown in the Monitoring console

    gridLayout = {
      columns = "2"  # two-column grid layout

      widgets = [
        # widget 1: BigQuery scanned bytes over the last 7 days
        {
          title = "BigQuery — Daily Bytes Scanned"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"global\" metric.type=\"bigquery.googleapis.com/job/completed_row_count\""
                  aggregation = {
                    alignmentPeriod  = "86400s"
                    perSeriesAligner = "ALIGN_SUM"
                  }
                }
              }
              plotType = "LINE"
            }]
            timeshiftDuration = "0s"
            yAxis = { label = "Rows", scale = "LINEAR" }
          }
        },
        # widget 2: Dataflow system lag for streaming jobs
        {
          title = "Dataflow — System Lag (Streaming)"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"dataflow_job\" metric.type=\"dataflow.googleapis.com/job/system_lag\""
                  aggregation = {
                    alignmentPeriod  = "60s"
                    perSeriesAligner = "ALIGN_MEAN"
                  }
                }
              }
              plotType = "LINE"
            }]
            yAxis = { label = "Seconds", scale = "LINEAR" }
          }
        },
        # widget 3: scorecard showing current Firestore read operations per second
        {
          title = "Firestore — Read Ops/s"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "resource.type=\"firestore.googleapis.com/Database\" metric.type=\"firestore.googleapis.com/document/read_count\""
                aggregation = {
                  alignmentPeriod  = "60s"
                  perSeriesAligner = "ALIGN_RATE"
                }
              }
            }
            sparkChartView = { sparkChartType = "SPARK_LINE" }  # mini trend line inside the scorecard
          }
        }
      ]
    }
  })
}
```

---

## Budget Block

Cloud Billing budgets set spending thresholds and trigger notifications or automated actions when costs approach or exceed the budget. Always create a budget for each active GCP project — it is the first line of defence against runaway costs.

---

### Billing Budget

Use `google_billing_budget` to define monthly spend limits with tiered threshold rules. Notifications go to billing admins via email by default, or to a Pub/Sub topic for automated responses (e.g. disabling APIs or shutting down non-essential resources). The budget does not stop spending automatically — it only notifies.

```hcl
# monthly budget for the data platform project with tiered threshold alerts
resource "google_billing_budget" "data_platform" {
  billing_account = var.billing_account_id  # billing account ID (format: XXXXXX-XXXXXX-XXXXXX)
  display_name    = "Data Platform — Monthly Budget"  # budget name visible in the Billing console

  # scope the budget to a specific project rather than the whole billing account
  budget_filter {
    projects = ["projects/${var.project_id}"]  # list of projects; omit for account-wide budget

    # optionally filter to specific services (e.g. only BigQuery costs)
    # services = ["services/95FF-2EF5-5EA1"]  # BigQuery service ID; find IDs in Cloud Billing catalog
  }

  # the budget amount — alert thresholds below are percentages of this amount
  amount {
    specified_amount {
      currency_code = "USD"    # ISO 4217 currency; must match the billing account currency
      units         = "2000"   # budget limit in whole currency units (dollars, euros, etc.)
      nanos         = 0        # fractional units in nanoseconds; 0.50 USD = units=0, nanos=500000000
    }
    # alternatively, use last period's spend as the budget:
    # last_period_amount {}
  }

  # threshold rule 1: notify at 50% of budget (early warning)
  threshold_rules {
    threshold_percent = 0.5          # 0.5 = 50% of the budget amount ($1,000 of $2,000)
    spend_basis       = "CURRENT_SPEND"  # CURRENT_SPEND = actual spend; FORECASTED_SPEND = projected end-of-month spend
  }

  # threshold rule 2: notify at 90% of budget (serious warning)
  threshold_rules {
    threshold_percent = 0.9          # 90% of budget ($1,800 of $2,000)
    spend_basis       = "CURRENT_SPEND"
  }

  # threshold rule 3: notify at 100% of budget (budget exceeded)
  threshold_rules {
    threshold_percent = 1.0          # 100% — budget fully consumed
    spend_basis       = "CURRENT_SPEND"
  }

  # threshold rule 4: notify at 120% based on forecast — acts before overage happens
  threshold_rules {
    threshold_percent = 1.2          # 120% forecasted spend = projected to overshoot budget by 20%
    spend_basis       = "FORECASTED_SPEND"  # fires earlier based on spend trajectory, not actuals
  }

  # notification channels
  all_updates_rule {
    # send budget notifications to a Pub/Sub topic for automated handling
    pubsub_topic = "projects/${var.project_id}/topics/${var.budget_alerts_topic}"  # full Pub/Sub topic name

    # also notify billing account admins and users via email (GCP default behaviour)
    # disable_default_iam_recipients = false  # false = billing admins receive email; true = Pub/Sub only

    monitoring_notification_channels = [
      google_monitoring_notification_channel.email_data_team.id,  # additional email channel
    ]
  }
}
```

---

## Table Schema Reference

Complete schema examples for a fact table and a dimension table, suitable for copy-paste and inline use in `google_bigquery_table.schema`.

### Fact Table Schema (Orders)

```hcl
# schema for an e-commerce orders fact table
schema = jsonencode([
  {
    name        = "order_id"
    type        = "STRING"
    mode        = "REQUIRED"
    description = "Unique order identifier (UUID v4)"
  },
  {
    name        = "order_date"
    type        = "DATE"
    mode        = "REQUIRED"
    description = "Calendar date the order was placed — used as the partition key"
  },
  {
    name        = "order_timestamp"
    type        = "TIMESTAMP"
    mode        = "REQUIRED"
    description = "Exact UTC timestamp when the order was submitted"
  },
  {
    name        = "customer_id"
    type        = "STRING"
    mode        = "REQUIRED"
    description = "Foreign key to dim_customers — first clustering column"
  },
  {
    name        = "product_id"
    type        = "STRING"
    mode        = "REQUIRED"
    description = "Foreign key to dim_products — second clustering column"
  },
  {
    name        = "quantity"
    type        = "INTEGER"
    mode        = "REQUIRED"
    description = "Number of units ordered"
  },
  {
    name        = "unit_price_usd"
    type        = "NUMERIC"
    mode        = "REQUIRED"
    description = "Price per unit at time of purchase in USD (NUMERIC avoids floating-point rounding)"
  },
  {
    name        = "discount_pct"
    type        = "FLOAT64"
    mode        = "NULLABLE"
    description = "Discount percentage applied (0.0-1.0); null if no discount"
  },
  {
    name        = "total_revenue_usd"
    type        = "NUMERIC"
    mode        = "REQUIRED"
    description = "quantity × unit_price_usd × (1 - discount_pct) — pre-computed for query performance"
  },
  {
    name        = "status"
    type        = "STRING"
    mode        = "REQUIRED"
    description = "Order status: pending, confirmed, shipped, delivered, cancelled"
  },
  {
    name        = "channel"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Sales channel: web, mobile, api, partner"
  },
  {
    name        = "metadata"
    type        = "JSON"
    mode        = "NULLABLE"
    description = "Flexible JSON blob for channel-specific or experiment-specific attributes"
  },
  {
    name        = "created_at"
    type        = "TIMESTAMP"
    mode        = "REQUIRED"
    description = "Row insertion timestamp — set by the ETL pipeline"
  },
  {
    name        = "updated_at"
    type        = "TIMESTAMP"
    mode        = "NULLABLE"
    description = "Timestamp of the most recent update to this row; null for append-only loads"
  }
])
```

### Dimension Table Schema (Customers)

```hcl
# schema for a customer dimension table (SCD Type 1 — overwrites on change)
schema = jsonencode([
  {
    name        = "customer_id"
    type        = "STRING"
    mode        = "REQUIRED"
    description = "Surrogate key — matches the customer_id in fact tables"
  },
  {
    name        = "external_id"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Source system customer identifier (e.g. CRM ID); nullable for system-generated customers"
  },
  {
    name        = "email"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Normalised email address (lowercase, trimmed)"
  },
  {
    name        = "first_name"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Customer first name"
  },
  {
    name        = "last_name"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Customer last name"
  },
  {
    name        = "country_code"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "ISO 3166-1 alpha-2 country code (e.g. US, GB, DE)"
  },
  {
    name        = "segment"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Customer segment: enterprise, smb, consumer, trial"
  },
  {
    name        = "acquisition_channel"
    type        = "STRING"
    mode        = "NULLABLE"
    description = "Channel through which the customer was acquired: organic, paid_search, referral, direct"
  },
  {
    name        = "first_order_date"
    type        = "DATE"
    mode        = "NULLABLE"
    description = "Date of the customer's first order; null until first purchase"
  },
  {
    name        = "lifetime_orders"
    type        = "INTEGER"
    mode        = "NULLABLE"
    description = "Total number of orders placed; updated by nightly ETL"
  },
  {
    name        = "lifetime_revenue_usd"
    type        = "NUMERIC"
    mode        = "NULLABLE"
    description = "Sum of all order revenues; updated by nightly ETL"
  },
  {
    name        = "is_active"
    type        = "BOOL"
    mode        = "REQUIRED"
    description = "true if the customer account is currently active"
  },
  {
    name        = "created_at"
    type        = "TIMESTAMP"
    mode        = "REQUIRED"
    description = "Timestamp when this customer record was first created in the warehouse"
  },
  {
    name        = "updated_at"
    type        = "TIMESTAMP"
    mode        = "REQUIRED"
    description = "Timestamp of the most recent ETL update to this row"
  }
])
```

---

## Cross-References

- IAM for pipeline service accounts — [[terraform-iam-and-secrets]]
- VPC and private networking for Cloud SQL and Dataflow workers — [[terraform-networking]]
- Cloud Run jobs that load data into BigQuery — [[terraform-cloud-run]]
- Variable definitions for `var.region`, `var.project_id`, `var.environment` — [[terraform-variables-and-outputs]]
- Managing BigQuery dataset state after manual schema changes — [[terraform-state-management]]
