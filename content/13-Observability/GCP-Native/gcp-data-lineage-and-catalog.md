---
type: reference
category: observability
technology:
  - gcp
  - dataplex
  - bigquery
  - python
  - dataflow
tags: [monitoring, observability, python, bigquery, gcp]
aliases:
  - data lineage
  - data catalog
  - Dataplex
  - Data Catalog
  - lineage API
  - column-level lineage
  - data discovery
  - metadata management
  - data governance
  - tag templates
  - business glossary
  - data quality
  - auto-discovery
keywords:
  - data lineage
  - data catalog
  - Dataplex
  - BigQuery lineage
  - column-level lineage
  - data governance
  - metadata management
  - tag templates
  - business glossary
  - data discovery
  - Lineage API
  - OpenLineage
  - data quality scans
  - auto-discovery
  - GCP observability
  - impact analysis
  - GDPR lineage
  - PII tracking
  - data mesh governance
  - Dataplex lakes
  - Dataplex zones
  - Dataplex assets
  - data catalog search
  - lineage events
  - lineage processes
  - data quality rules
  - schema discovery
  - entry groups
  - data assets
  - Cloud Composer lineage
  - Spark OpenLineage
description: >
  Definitive reference for achieving full end-to-end data lineage and cataloging
  within GCP. Covers Dataplex unified governance, Data Catalog tag templates and
  business glossary, automatic and custom lineage via the Lineage API, OpenLineage
  integration for Airflow/Spark/dbt, data quality scans, impact analysis workflows,
  and a comparison of GCP-native vs open-source alternatives. Dense with gcloud
  commands, Python SDK examples, YAML configurations, and actionable checklists.
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Data Lineage and Catalog — Definitive Reference

> [!quote]
> "Data lineage is the Rosetta Stone for analytics teams — it lets you trace any number back to its source and understand every transformation along the way."
> — **Maxime Beauchemin**, creator of Apache Airflow and Apache Superset

---

## Why Lineage and Cataloging Matter for Data Engineers

### The Two Core Questions

Data engineering builds pipelines. Lineage and cataloging answer the two questions that make those pipelines trustworthy and understandable at scale.

**"Where did this number come from?"** — This is the lineage question. When a finance director asks why the weekly revenue figure dropped 12% and the data engineer needs to trace that number backward through five transformations, two intermediate tables, an API ingestion job, and a source system change made by a vendor three days ago — lineage is the only tool that makes that investigation fast instead of agonizing. Without lineage, root cause analysis is a manual archaeology exercise. Tools like [dbt's lineage graph](https://alp78.github.io/elysium/11-dbt/Operations/dbt-documentation-and-lineage) complement GCP-native lineage by providing transformation-level column tracing within the dbt model DAG.

**"What data do we have, and what does it mean?"** — This is the cataloging question. When a new data scientist joins and needs to find "something about daily trading volume" they should be able to search a catalog and find a well-described, owner-tagged, freshness-SLA'd table in under two minutes. Without a catalog, they spend weeks asking people in Slack and building duplicate datasets from the same raw sources. A well-maintained catalog is a prerequisite for building a genuine [self-service-data-platform](https://alp78.github.io/elysium/15-DataOps/self-service-data-platform), where consumers can discover and use data without blocking on engineering support.

Together, lineage and cataloging are the observability layer for your data — the equivalent of distributed tracing and service documentation for your pipelines. See [gcp-pipeline-health-and-sla](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-pipeline-health-and-sla) for the broader observability framework these fit into.

### Compliance Drivers

| Regulation | Lineage Requirement | Catalog Requirement |
|---|---|---|
| GDPR (Article 17) | Right to erasure requires knowing everywhere PII flows — you cannot erase what you cannot find | Tag PII columns so erasure automation knows what to delete |
| GDPR (Article 30) | Records of processing activities must document data flows | Catalog entries serve as the formal inventory |
| SOX | Financial data transformations must be auditable end-to-end | Ownership tags create accountable stewards |
| BCBS 239 | Banks must demonstrate data lineage for risk aggregation reports | Column-level lineage satisfies regulatory review |
| DORA (Digital Operational Resilience Act) | Critical data dependencies must be documented | Catalog + lineage creates the dependency map |

> [!warning] GDPR and PII Tracking
> If you process EU personal data, implementing lineage is not optional — it is a compliance requirement. Every pipeline that touches PII must be tracked. Use tag templates with a `pii_columns` field and set up lineage for all ingestion paths. Failure to track PII flows makes Article 17 erasure requests operationally impossible to fulfill correctly.

### Operational Drivers

- **Impact analysis before schema changes**: Before renaming a column or changing a data type, query lineage to see all downstream tables, views, Dataflow jobs, dashboards, and scheduled queries that will break.
- **Root cause analysis when data is wrong**: Trace a bad metric backward through lineage to find the pipeline step where incorrect data was introduced.
- **Onboarding acceleration**: New team members can self-serve through the catalog instead of blocking senior engineers for weeks.
- **Dead asset discovery**: Find tables that have not been read by any downstream process in 90+ days and are candidates for deletion.
- **Cost attribution**: Attach ownership tags to tables; join with BigQuery slot usage to show each team what their data costs.
- **Data mesh governance**: See [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — in a domain-oriented ownership model, the catalog is how one domain publishes its data products for other domains to discover.

---

## GCP Lineage and Catalog Landscape

### Tool Overview

| Tool | Purpose | Lineage | Catalog | Quality |
|---|---|---|---|---|
| Dataplex | Unified governance platform | Yes (via Lineage API) | Yes (built-in) | Yes (auto + custom rules) |
| Data Catalog | Metadata discovery and tagging | No (deprecated in favor of Dataplex) | Yes | No |
| BigQuery | Analytics warehouse | Automatic column-level lineage | Via Dataplex | Via assertions / INFORMATION_SCHEMA |
| Dataflow | Stream/batch processing | Reports lineage to API automatically | No | No |
| Cloud Composer (Airflow) | Orchestration | Via OpenLineage or custom callbacks | No | No |
| Dataproc (Spark) | Distributed processing | Via OpenLineage listener | No | No |
| dbt | Transformation layer | Via manifest.json + Lineage API | Via docs | Via tests |

> [!note] Data Catalog vs Dataplex
> Cloud Data Catalog is the legacy product. Dataplex is the current unified platform that subsumes catalog functionality. All new projects should use Dataplex. Existing Data Catalog tag templates, tags, and entries are still supported and accessible via the Dataplex API surface. The Data Catalog API is not deprecated — it is now part of Dataplex's unified API.

### Dataplex as the Convergence Point

All GCP lineage and metadata ultimately surfaces in Dataplex. BigQuery automatic lineage writes to the Lineage API. Dataflow writes to the Lineage API. Your custom pipelines should write to the Lineage API. Dataplex reads from the Lineage API and makes it searchable, visualizable, and linkable to catalog entries.

```
External Sources          Processing Layer          Governance Layer
─────────────────         ─────────────────         ─────────────────────────────────
SQL Server    ──────────► Dataflow         ────────► Lineage API  ◄──── BQ Auto Lineage
REST APIs     ──────────► Cloud Composer   ────────►      │
GCS Files     ──────────► Dataproc/Spark   ────────►      │        Dataplex
                          dbt              ────────►      ▼       ┌────────────────────┐
                                                   ┌──────────┐  │ Search & Discovery │
BigQuery      ──────────────────────────────────── ► Catalog  ├─►│ Tag Templates      │
(auto lineage)                                     │ Entries  │  │ Business Glossary  │
                                                   └──────────┘  │ Quality Scans      │
                                                                  │ Lineage Explorer   │
                                                                  └────────────────────┘
```

### API Relationships

- `dataplex.googleapis.com` — Lake/zone/asset management, catalog entries, search, glossary, quality scans
- `datalineage.googleapis.com` — Lineage processes, runs, and events (the lineage graph)
- `datacatalog.googleapis.com` — Tag templates and tags (shared surface with Dataplex)

All three APIs must be enabled for a complete setup.

---

## Dataplex — Unified Data Governance

### Setting Up Dataplex

#### Enable required APIs

```bash
gcloud services enable dataplex.googleapis.com
gcloud services enable datalineage.googleapis.com
gcloud services enable datacatalog.googleapis.com
gcloud services enable bigquery.googleapis.com
```

#### Verify APIs are active

```bash
gcloud services list --enabled \
  --filter="name:(dataplex OR datalineage OR datacatalog)" \
  --format="table(name,state)"
```

#### Grant required roles to the service account that will manage Dataplex

```bash
# Dataplex admin for lake/zone/asset management
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:dataplex-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dataplex.admin"

# Lineage admin for creating processes/runs/events
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:dataplex-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datalineage.admin"

# Data Catalog admin for tag template management
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:dataplex-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datacatalog.admin"
```

See [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) for the principle of least privilege approach — pipelines that only report lineage need `roles/datalineage.producer`, not full admin.

### Creating Dataplex Lakes

A **lake** is the top-level logical grouping. Typically one lake per environment (dev, staging, prod) or one per major business domain.

```bash
# Create the production analytics lake
gcloud dataplex lakes create analytics-lake \
  --location=us-central1 \
  --display-name="Analytics Data Lake" \
  --description="Central governance for all analytics pipelines" \
  --labels="env=prod,team=data-platform"

# List lakes to verify
gcloud dataplex lakes list \
  --location=us-central1 \
  --format="table(name,displayName,state,createTime)"
```

### Creating Zones

Zones within a lake represent data lifecycle stages. The **RAW** zone holds data as-ingested from sources. The **CURATED** zone holds validated, transformed, business-ready data. Add a consumption zone for reporting/BI assets.

```bash
# Raw landing zone — accepts any format, schema optional
gcloud dataplex zones create raw-zone \
  --lake=analytics-lake \
  --location=us-central1 \
  --type=RAW \
  --resource-location-type=SINGLE_REGION \
  --display-name="Raw Landing Zone" \
  --description="Unvalidated data as received from source systems" \
  --labels="stage=raw"

# Curated zone — validated schemas required for BigQuery datasets
gcloud dataplex zones create curated-zone \
  --lake=analytics-lake \
  --location=us-central1 \
  --type=CURATED \
  --resource-location-type=SINGLE_REGION \
  --display-name="Curated Analytics Zone" \
  --description="Validated, transformed data ready for analytics use" \
  --labels="stage=curated"

# Consumption zone — BI-ready tables, reporting datasets
gcloud dataplex zones create consumption-zone \
  --lake=analytics-lake \
  --location=us-central1 \
  --type=CURATED \
  --resource-location-type=SINGLE_REGION \
  --display-name="Consumption Zone" \
  --description="Aggregated, business-facing datasets for dashboards and reporting" \
  --labels="stage=consumption"

# Verify zones
gcloud dataplex zones list \
  --lake=analytics-lake \
  --location=us-central1 \
  --format="table(name,displayName,type,state)"
```

### Attaching Assets

Assets are the actual data resources — BigQuery datasets or GCS buckets — that Dataplex governs.

```bash
# Attach a BigQuery dataset to the curated zone
gcloud dataplex assets create bq-analytics \
  --lake=analytics-lake \
  --zone=curated-zone \
  --location=us-central1 \
  --resource-type=BIGQUERY_DATASET \
  --resource-name=projects/PROJECT_ID/datasets/analytics \
  --display-name="Analytics Dataset" \
  --description="Core analytics tables: prices, positions, returns" \
  --discovery-enabled \
  --discovery-schedule="0 6 * * *" \
  --labels="domain=analytics,criticality=high"

# Attach a GCS bucket to the raw zone
gcloud dataplex assets create gcs-raw-ingest \
  --lake=analytics-lake \
  --zone=raw-zone \
  --location=us-central1 \
  --resource-type=STORAGE_BUCKET \
  --resource-name=projects/PROJECT_ID/buckets/raw-ingest-bucket \
  --display-name="Raw Ingest Bucket" \
  --discovery-enabled \
  --discovery-schedule="0 */4 * * *"

# List assets
gcloud dataplex assets list \
  --lake=analytics-lake \
  --zone=curated-zone \
  --location=us-central1 \
  --format="table(name,displayName,resourceSpec.type,state,discoverySpec.enabled)"
```

> [!tip] Discovery Scheduling
> Set discovery to run slightly after your main pipeline loads complete. If your ETL finishes by 05:00, schedule discovery at 06:00 so newly created tables and columns are discovered before business users arrive. For GCS buckets with frequent ingest, every 4 hours is a reasonable frequency to keep the catalog fresh without excessive scanning costs.

### Auto-Discovery in Detail

When discovery is enabled, Dataplex crawls attached assets and automatically:
- Discovers new tables and GCS partitions
- Extracts schema (column names, data types, descriptions from BigQuery schema definitions)
- Creates catalog entries for every discovered entity
- Updates entries when schemas change
- Detects and catalogs partition structures

#### Trigger discovery manually after a schema change

```bash
gcloud dataplex assets run-discovery \
  --lake=analytics-lake \
  --zone=curated-zone \
  --location=us-central1 \
  --asset=bq-analytics
```

#### Check the last discovery status

```bash
gcloud dataplex assets describe bq-analytics \
  --lake=analytics-lake \
  --zone=curated-zone \
  --location=us-central1 \
  --format="yaml(discoveryStatus)"
```

### Dataplex Data Discovery and Search

Once assets are attached and discovery has run, all catalog entries are searchable.

```bash
# Full-text search across all catalog entries
gcloud dataplex entries search "daily prices" \
  --location=us-central1 \
  --order-by="update_time desc"

# Filter search to BigQuery tables only
gcloud dataplex entries search "trading volume" \
  --location=us-central1 \
  --filter="entry_type=BIGQUERY_TABLE"

# Lookup a specific entry by fully qualified name
gcloud dataplex entries lookup \
  'projects/PROJECT_ID/locations/us-central1/entryGroups/@bigquery/entries/PROJECT_ID.analytics.daily_prices'
```

#### Python SDK for programmatic discovery

```python
from google.cloud import dataplex_v1

catalog_client = dataplex_v1.CatalogServiceClient()

# Search for entries containing "price"
request = dataplex_v1.SearchEntriesRequest(
    name="projects/PROJECT_ID/locations/us-central1",
    query="price",
    page_size=50,
    order_by="update_time desc",
)

results = catalog_client.search_entries(request=request)
for entry in results:
    print(f"{entry.fully_qualified_name}: {entry.display_name}")
    if entry.description:
        print(f"  Description: {entry.description}")
```

#### Entry Groups

Dataplex organizes catalog entries into entry groups. BigQuery entries live in the `@bigquery` system entry group. GCS objects live in `@gcs`. You can create custom entry groups for external systems.

```bash
# Create an entry group for an external SQL Server database
gcloud dataplex entry-groups create sqlserver-prod \
  --location=us-central1 \
  --display-name="SQL Server Production" \
  --description="On-premises SQL Server production database"

# Create a custom catalog entry for an external table
gcloud dataplex entries create sqlserver-market-data \
  --entry-group=sqlserver-prod \
  --location=us-central1 \
  --entry-type=projects/PROJECT_ID/locations/us-central1/entryTypes/generic \
  --display-name="Market Data Table" \
  --fully-qualified-name="sqlserver:analytics_db.dbo.market_data"
```

---

## Data Catalog — Tagging and Business Context

### Tag Templates

Tag templates define the schema of metadata you want to attach to data assets. Think of them as custom fields you can apply to any catalog entry.

#### Create a comprehensive pipeline metadata tag template

```bash
gcloud data-catalog tag-templates create pipeline-metadata \
  --location=us-central1 \
  --display-name="Pipeline Metadata" \
  --field=id=owner,display-name="Data Owner",type=string,required=true \
  --field=id=owning_team,display-name="Owning Team",type=string,required=true \
  --field=id=refresh_frequency,display-name="Refresh Frequency",type='enum(hourly|daily|weekly|monthly|quarterly|on-demand)' \
  --field=id=sla_hours,display-name="Freshness SLA (hours)",type=double \
  --field=id=pii_columns,display-name="PII Columns",type=string \
  --field=id=pii_classification,display-name="PII Classification",type='enum(none|low|medium|high|critical)' \
  --field=id=source_system,display-name="Source System",type=string \
  --field=id=data_classification,display-name="Data Classification",type='enum(public|internal|confidential|restricted)' \
  --field=id=retention_days,display-name="Retention (days)",type=double \
  --field=id=business_criticality,display-name="Business Criticality",type='enum(low|medium|high|critical)'
```

#### Create a separate quality metadata template

```bash
gcloud data-catalog tag-templates create quality-metadata \
  --location=us-central1 \
  --display-name="Quality Metadata" \
  --field=id=quality_score,display-name="Latest Quality Score (%)",type=double \
  --field=id=last_quality_scan,display-name="Last Quality Scan",type=timestamp \
  --field=id=quality_scan_id,display-name="Dataplex Scan ID",type=string \
  --field=id=known_issues,display-name="Known Data Issues",type=string \
  --field=id=issue_ticket,display-name="Issue Tracker Link",type=string
```

#### Apply a tag to a BigQuery table

```bash
# First, look up the entry resource name
ENTRY=$(gcloud data-catalog entries lookup \
  --linked-resource='//bigquery.googleapis.com/projects/PROJECT_ID/datasets/analytics/tables/daily_prices' \
  --format='value(name)')

# Apply the pipeline metadata tag
gcloud data-catalog tags create \
  --entry="$ENTRY" \
  --tag-template=pipeline-metadata \
  --tag-template-location=us-central1 \
  --fields="owner=jane.smith@company.com,owning_team=data-platform,refresh_frequency=daily,sla_hours=2.0,pii_columns=none,pii_classification=none,source_system=market-data-api,data_classification=internal,retention_days=2555,business_criticality=high"
```

### Python SDK for Bulk Tagging

Applying tags one at a time via gcloud is impractical for hundreds of tables. Use the Python SDK for bulk operations.

```python
from google.cloud import datacatalog_v1
from google.protobuf import timestamp_pb2
import datetime

def bulk_tag_tables(project_id: str, location: str, tag_template_id: str, table_tags: list[dict]):
    """
    Apply tag template to multiple BigQuery tables.

    table_tags: list of dicts with keys:
      - dataset: BigQuery dataset name
      - table: BigQuery table name
      - fields: dict of field_id -> value
    """
    client = datacatalog_v1.DataCatalogClient()
    tag_template_name = (
        f"projects/{project_id}/locations/{location}"
        f"/tagTemplates/{tag_template_id}"
    )

    for table_info in table_tags:
        linked_resource = (
            f"//bigquery.googleapis.com/projects/{project_id}"
            f"/datasets/{table_info['dataset']}/tables/{table_info['table']}"
        )

        try:
            # Look up the catalog entry
            entry = client.lookup_entry(
                request=datacatalog_v1.LookupEntryRequest(
                    linked_resource=linked_resource
                )
            )

            # Build the tag
            tag = datacatalog_v1.Tag()
            tag.template = tag_template_name

            for field_id, value in table_info["fields"].items():
                tag_field = datacatalog_v1.TagField()
                if isinstance(value, str):
                    tag_field.string_value = value
                elif isinstance(value, float):
                    tag_field.double_value = value
                elif isinstance(value, bool):
                    tag_field.bool_value = value
                elif isinstance(value, datetime.datetime):
                    ts = timestamp_pb2.Timestamp()
                    ts.FromDatetime(value)
                    tag_field.timestamp_value = ts
                tag.fields[field_id] = tag_field

            # Create the tag
            created_tag = client.create_tag(parent=entry.name, tag=tag)
            print(f"Tagged {table_info['dataset']}.{table_info['table']}: {created_tag.name}")

        except Exception as e:
            print(f"ERROR tagging {table_info['dataset']}.{table_info['table']}: {e}")


# Usage
tables_to_tag = [
    {
        "dataset": "analytics",
        "table": "daily_prices",
        "fields": {
            "owner": "data-platform-team@company.com",
            "owning_team": "data-platform",
            "refresh_frequency": "daily",
            "sla_hours": 2.0,
            "pii_columns": "none",
            "pii_classification": "none",
            "source_system": "market-data-api",
            "data_classification": "internal",
            "business_criticality": "high",
        },
    },
    {
        "dataset": "analytics",
        "table": "customer_positions",
        "fields": {
            "owner": "risk-team@company.com",
            "owning_team": "risk",
            "refresh_frequency": "hourly",
            "sla_hours": 0.5,
            "pii_columns": "customer_id,account_number",
            "pii_classification": "high",
            "source_system": "portfolio-system",
            "data_classification": "confidential",
            "business_criticality": "critical",
        },
    },
]

bulk_tag_tables(
    project_id="my-project",
    location="us-central1",
    tag_template_id="pipeline-metadata",
    table_tags=tables_to_tag,
)
```

#### Search for tables by tag values

```python
def find_tables_by_owner(project_id: str, location: str, owner: str) -> list[str]:
    """Return all catalog entries owned by a given person or team."""
    client = datacatalog_v1.DataCatalogClient()

    request = datacatalog_v1.SearchCatalogRequest(
        scope=datacatalog_v1.SearchCatalogRequest.Scope(
            include_project_ids=[project_id]
        ),
        query=f'tag:pipeline-metadata.owner="{owner}"',
    )

    results = []
    for page in client.search_catalog(request=request).pages:
        for result in page.results:
            results.append(result.relative_resource_name)
    return results


def find_pii_tables(project_id: str, location: str) -> list[str]:
    """Return all tables tagged with non-none PII classification."""
    client = datacatalog_v1.DataCatalogClient()

    # Search for tables where pii_classification is not 'none'
    request = datacatalog_v1.SearchCatalogRequest(
        scope=datacatalog_v1.SearchCatalogRequest.Scope(
            include_project_ids=[project_id]
        ),
        query='tag:pipeline-metadata.pii_classification:(low OR medium OR high OR critical)',
    )

    return [r.relative_resource_name for r in client.search_catalog(request=request)]
```

> [!tip] Tag Search Syntax
> The Data Catalog search syntax supports: `tag:TEMPLATE_ID.FIELD_ID=VALUE` for exact match, `tag:TEMPLATE_ID.FIELD_ID:(val1 OR val2)` for enum matching, `type=TABLE` to restrict to BigQuery tables, `name:partial_name` for name matching. Combine predicates with AND/OR. This is more expressive than BigQuery `INFORMATION_SCHEMA` for business metadata queries.

### Programmatic Tag Updates (Upsert Pattern)

```python
def upsert_tag(client, entry_name: str, tag_template_name: str, fields: dict):
    """Create or update a tag on a catalog entry."""
    # List existing tags to find one for this template
    existing_tag = None
    for tag in client.list_tags(parent=entry_name):
        if tag.template == tag_template_name:
            existing_tag = tag
            break

    # Build the tag object
    tag = datacatalog_v1.Tag()
    tag.template = tag_template_name
    for field_id, value in fields.items():
        tag_field = datacatalog_v1.TagField()
        tag_field.string_value = str(value)  # Simplified; use proper typing
        tag.fields[field_id] = tag_field

    if existing_tag:
        tag.name = existing_tag.name
        updated = client.update_tag(tag=tag)
        return updated
    else:
        created = client.create_tag(parent=entry_name, tag=tag)
        return created
```

### Business Glossary

The Dataplex business glossary is a formal dictionary of business terms with agreed definitions. It is the source of truth when two teams disagree on what "revenue" or "active user" means.

#### Create a glossary

```bash
gcloud dataplex glossaries create finance-glossary \
  --location=us-central1 \
  --display-name="Finance Domain Glossary" \
  --description="Approved definitions for all finance domain metrics and dimensions"
```

#### Create glossary terms

```bash
gcloud dataplex glossaries terms create market-cap \
  --glossary=finance-glossary \
  --location=us-central1 \
  --display-name="Market Capitalization" \
  --description="The total market value of a company's outstanding shares of stock. Calculated as the current share price multiplied by the total number of outstanding shares. Excludes treasury shares."

gcloud dataplex glossaries terms create daily-return \
  --glossary=finance-glossary \
  --location=us-central1 \
  --display-name="Daily Return" \
  --description="The percentage change in an asset's price over a single trading day. Calculated as (close_price - prev_close_price) / prev_close_price. Uses adjusted closing prices to account for corporate actions."

gcloud dataplex glossaries terms create aum \
  --glossary=finance-glossary \
  --location=us-central1 \
  --display-name="Assets Under Management (AUM)" \
  --description="The total market value of investments managed on behalf of clients. Calculated daily at market close using official closing prices. Excludes cash and money market holdings unless explicitly specified."

gcloud dataplex glossaries terms create active-user \
  --glossary=finance-glossary \
  --location=us-central1 \
  --display-name="Active User" \
  --description="A registered user who has logged in at least once in the past 30 calendar days AND completed at least one meaningful action (trade, quote request, or report download). Bots and service accounts are excluded."
```

#### List all terms in a glossary

```bash
gcloud dataplex glossaries terms list \
  --glossary=finance-glossary \
  --location=us-central1 \
  --format="table(name,displayName,updateTime)"
```

> [!warning] Glossary Governance Process
> A business glossary only has value if the process for adding and modifying terms is controlled. Establish a review process: proposed terms require sign-off from the domain data steward before being published. Unofficial definitions added without review create confusion rather than clarity. Treat glossary terms as a formal specification, not a wiki.

#### Link glossary terms to BigQuery columns via tags

Create a column-level tag template that links to a glossary term:

```bash
gcloud data-catalog tag-templates create column-semantics \
  --location=us-central1 \
  --display-name="Column Business Semantics" \
  --field=id=glossary_term,display-name="Glossary Term",type=string \
  --field=id=business_definition,display-name="Business Definition",type=string \
  --field=id=calculation_notes,display-name="Calculation Notes",type=string
```

Apply it to a specific column (column-level tagging):

```python
from google.cloud import datacatalog_v1

client = datacatalog_v1.DataCatalogClient()

# Look up the table entry
entry = client.lookup_entry(
    request=datacatalog_v1.LookupEntryRequest(
        linked_resource="//bigquery.googleapis.com/projects/PROJECT_ID/datasets/analytics/tables/daily_prices"
    )
)

# Create a column-level tag
tag = datacatalog_v1.Tag()
tag.template = "projects/PROJECT_ID/locations/us-central1/tagTemplates/column-semantics"
tag.column = "close_price"  # Target the specific column

tag.fields["glossary_term"].string_value = "Daily Return"
tag.fields["business_definition"].string_value = (
    "Adjusted closing price as of market close. "
    "Source: Refinitiv feed, adjusted for splits and dividends."
)
tag.fields["calculation_notes"].string_value = (
    "Price is adjusted retroactively when corporate actions occur. "
    "Always use adj_close_price for return calculations, never raw_close_price."
)

client.create_tag(parent=entry.name, tag=tag)
```

---

## Data Lineage — End-to-End Tracing

### Automatic Lineage (Zero-Config for BigQuery)

BigQuery captures lineage automatically for every SQL operation that reads from tables and writes to tables. This includes:
- `INSERT INTO ... SELECT FROM`
- `CREATE TABLE AS SELECT`
- `CREATE OR REPLACE TABLE AS SELECT`
- `MERGE` statements
- Scheduled queries
- `bq cp` operations
- Dataflow jobs writing to BigQuery (via the Dataflow BigQuery connector)

> [!note] BigQuery lineage gaps
>
> What BigQuery lineage does NOT capture automatically:
> - Reads via `bq extract` (export to GCS) are not tracked
> - External table reads are tracked if they are BigQuery external tables, not if the read bypasses BigQuery
> - Python code that reads BigQuery rows via the Storage Read API and writes to a different system is not tracked
> - `TRUNCATE TABLE` followed by `INSERT` may not create a link if done as separate statements across sessions

#### View lineage in the console
BigQuery Studio → Select a table → "Lineage" tab → Visual graph of upstream sources and downstream consumers.

#### Query lineage via gcloud

```bash
# Find all sources that feed into a target table
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --target='bigquery:projects/PROJECT_ID/datasets/analytics/tables/daily_returns' \
  --direction=UPSTREAM

# Find all downstream consumers of a source table
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --source='bigquery:projects/PROJECT_ID/datasets/analytics/tables/daily_prices' \
  --direction=DOWNSTREAM

# List lineage processes (pipelines registered in the system)
gcloud dataplex lineage processes list \
  --location=us-central1 \
  --format="table(name,displayName,createTime)"

# List runs for a specific process
gcloud dataplex lineage runs list \
  --location=us-central1 \
  --process=PROCESS_ID \
  --format="table(name,displayName,state,startTime,endTime)"

# List lineage events for a specific run
gcloud dataplex lineage events list \
  --location=us-central1 \
  --process=PROCESS_ID \
  --run=RUN_ID
```

### Column-Level Lineage

BigQuery tracks which source columns feed which target columns in SQL transformations. This is the most powerful lineage feature for compliance and root cause analysis.

**Example: Trace a single metric backward through column lineage**

```sql
-- This transformation in BigQuery is automatically tracked at the column level:
CREATE OR REPLACE TABLE analytics.daily_returns AS
SELECT
  d.trade_date,
  d.symbol,
  d.close_price,                                                   -- from daily_prices.close_price
  LAG(d.close_price) OVER (PARTITION BY d.symbol ORDER BY d.trade_date) AS prev_close,
  SAFE_DIVIDE(
    d.close_price - LAG(d.close_price) OVER (PARTITION BY d.symbol ORDER BY d.trade_date),
    LAG(d.close_price) OVER (PARTITION BY d.symbol ORDER BY d.trade_date)
  ) AS daily_return                                                -- derived from daily_prices.close_price
FROM analytics.daily_prices d;
```

After this query runs, the Lineage API records that `daily_returns.daily_return` is derived from `daily_prices.close_price`.

#### Query column-level lineage via the Python SDK

```python
from google.cloud import datacatalog_lineage_v1

client = datacatalog_lineage_v1.LineageClient()

# Search for links where a specific target column is referenced
response = client.search_links(
    request=datacatalog_lineage_v1.SearchLinksRequest(
        parent="projects/PROJECT_ID/locations/us-central1",
        target=datacatalog_lineage_v1.EntityReference(
            fully_qualified_name="bigquery:PROJECT_ID.analytics.daily_returns"
        ),
    )
)

for link in response.links:
    print(f"Source: {link.source.fully_qualified_name}")
    print(f"Target: {link.target.fully_qualified_name}")
    print(f"  Links: {link.name}")
```

### Lineage API — Custom Lineage for Non-BigQuery Sources

For any pipeline step that involves systems outside BigQuery — SQL Server ingestion, REST API pulls, CSV file processing, transformations in Python — you must report lineage explicitly using the Lineage API.

#### Core concepts — Lineage API — Custom Lineage for Non-BigQuery Sources
- **Process**: A logical pipeline (e.g., "daily-market-data-ingestion"). Created once, reused across runs.
- **Run**: A single execution of the process (e.g., the 2026-03-22 run). Created per execution.
- **LineageEvent**: A specific data transfer within a run. Contains one or more `EventLink` objects, each with a source and target `EntityReference`.

#### Reporting lineage for a SQL Server → BigQuery pipeline

```python
import time
from google.cloud import datacatalog_lineage_v1
from google.protobuf import timestamp_pb2


def get_or_create_process(
    client: datacatalog_lineage_v1.LineageClient,
    project_id: str,
    location: str,
    process_name: str,
    display_name: str,
    attributes: dict | None = None,
) -> datacatalog_lineage_v1.Process:
    """Get an existing process by display name or create it if absent."""
    parent = f"projects/{project_id}/locations/{location}"

    for process in client.list_processes(parent=parent):
        if process.display_name == display_name:
            return process

    return client.create_process(
        parent=parent,
        process=datacatalog_lineage_v1.Process(
            display_name=display_name,
            attributes={
                k: datacatalog_lineage_v1.Value(string_value=v)
                for k, v in (attributes or {}).items()
            },
        ),
    )


class LineageReporter:
    """
    Reusable context manager for reporting data lineage to the GCP Lineage API.

    Usage:
        with LineageReporter(project_id, location, "my-pipeline", "ETL") as reporter:
            # ... run your pipeline ...
            reporter.add_link(
                source_fqn="sqlserver:analytics_db.dbo.market_data",
                target_fqn="bigquery:project.dataset.table",
            )
    """

    def __init__(
        self,
        project_id: str,
        location: str,
        pipeline_name: str,
        pipeline_type: str = "etl",
        run_display_name: str | None = None,
    ):
        self.project_id = project_id
        self.location = location
        self.pipeline_name = pipeline_name
        self.pipeline_type = pipeline_type
        self.run_display_name = run_display_name or f"run-{int(time.time())}"
        self.client = datacatalog_lineage_v1.LineageClient()
        self.process = None
        self.run = None
        self._links: list[datacatalog_lineage_v1.EventLink] = []

    def __enter__(self):
        parent = f"projects/{self.project_id}/locations/{self.location}"

        # Get or create the process
        self.process = get_or_create_process(
            self.client,
            self.project_id,
            self.location,
            self.pipeline_name,
            self.pipeline_name,
            attributes={"pipeline_type": self.pipeline_type},
        )

        # Create a run for this execution
        now = timestamp_pb2.Timestamp(seconds=int(time.time()))
        self.run = self.client.create_run(
            parent=self.process.name,
            run=datacatalog_lineage_v1.Run(
                display_name=self.run_display_name,
                start_time=now,
                state=datacatalog_lineage_v1.Run.State.STARTED,
            ),
        )
        return self

    def add_link(self, source_fqn: str, target_fqn: str):
        """Register a source → target data flow."""
        self._links.append(
            datacatalog_lineage_v1.EventLink(
                source=datacatalog_lineage_v1.EntityReference(
                    fully_qualified_name=source_fqn
                ),
                target=datacatalog_lineage_v1.EntityReference(
                    fully_qualified_name=target_fqn
                ),
            )
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._links:
            now = timestamp_pb2.Timestamp(seconds=int(time.time()))
            self.client.create_lineage_event(
                parent=self.run.name,
                lineage_event=datacatalog_lineage_v1.LineageEvent(
                    links=self._links,
                    start_time=now,
                    end_time=now,
                ),
            )

        # Mark run as completed or failed
        new_state = (
            datacatalog_lineage_v1.Run.State.FAILED
            if exc_type is not None
            else datacatalog_lineage_v1.Run.State.COMPLETED
        )
        run_update = datacatalog_lineage_v1.Run()
        run_update.name = self.run.name
        run_update.state = new_state
        run_update.end_time = timestamp_pb2.Timestamp(seconds=int(time.time()))
        self.client.update_run(
            run=run_update,
            update_mask={"paths": ["state", "end_time"]},
        )

        return False  # Do not suppress exceptions


# Usage in an ingestion pipeline
def ingest_market_data(trade_date: str):
    with LineageReporter(
        project_id="my-project",
        location="us-central1",
        pipeline_name="daily-market-data-ingestion",
        pipeline_type="ingestion",
        run_display_name=f"run-{trade_date}",
    ) as reporter:

        # ... actual ingestion logic here ...

        # Register the data flow
        reporter.add_link(
            source_fqn="sqlserver:analytics_db.dbo.market_data",
            target_fqn="bigquery:my-project.analytics.daily_prices",
        )
        # Can add multiple links for multi-source pipelines
        reporter.add_link(
            source_fqn="gcs:raw-ingest-bucket/market-data/2026-03-22/prices.csv",
            target_fqn="bigquery:my-project.analytics.daily_prices",
        )
```

#### Fully qualified name conventions for common systems

```
BigQuery:       bigquery:PROJECT_ID.DATASET.TABLE
GCS:            gcs:BUCKET_NAME/PATH/TO/OBJECT
Cloud Spanner:  spanner:projects/P/instances/I/databases/D/tables/T
Cloud SQL:      cloudsql:PROJECT_ID:REGION:INSTANCE_NAME/DATABASE/TABLE
SQL Server:     sqlserver:SERVER_NAME.DATABASE_NAME.SCHEMA_NAME.TABLE_NAME
PostgreSQL:     postgresql:HOST:PORT/DATABASE/SCHEMA/TABLE
REST API:       https://api.example.com/v1/endpoint
Kafka:          kafka:BROKER_HOST/TOPIC_NAME
```

### Integration with Cloud Composer (Airflow)

Report lineage from Airflow task callbacks so every DAG run is represented in the Lineage API.

```python
from airflow.models import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
import time
from google.cloud import datacatalog_lineage_v1
from google.protobuf import timestamp_pb2

PROJECT_ID = "my-project"
LOCATION = "us-central1"


def report_lineage_callback(context, source_fqn: str, target_fqn: str):
    """Airflow on_success_callback that reports lineage."""
    client = datacatalog_lineage_v1.LineageClient()
    parent = f"projects/{PROJECT_ID}/locations/{LOCATION}"
    dag_id = context["dag"].dag_id
    run_id = context["run_id"]

    # Get or create process for this DAG
    process = get_or_create_process(
        client, PROJECT_ID, LOCATION, dag_id, dag_id,
        attributes={"orchestrator": "airflow"}
    )

    # Create a run for this DAG run
    now_ts = timestamp_pb2.Timestamp(seconds=int(time.time()))
    run = client.create_run(
        parent=process.name,
        run=datacatalog_lineage_v1.Run(
            display_name=run_id,
            start_time=now_ts,
            state=datacatalog_lineage_v1.Run.State.COMPLETED,
            end_time=now_ts,
        ),
    )

    # Create lineage event
    client.create_lineage_event(
        parent=run.name,
        lineage_event=datacatalog_lineage_v1.LineageEvent(
            links=[
                datacatalog_lineage_v1.EventLink(
                    source=datacatalog_lineage_v1.EntityReference(
                        fully_qualified_name=source_fqn
                    ),
                    target=datacatalog_lineage_v1.EntityReference(
                        fully_qualified_name=target_fqn
                    ),
                )
            ],
            start_time=now_ts,
            end_time=now_ts,
        ),
    )


with DAG(
    dag_id="daily-market-data-ingestion",
    schedule_interval="0 5 * * 1-5",
    start_date=days_ago(1),
    catchup=False,
) as dag:

    ingest_task = PythonOperator(
        task_id="ingest_market_data",
        python_callable=lambda **ctx: None,  # your actual callable
        on_success_callback=lambda ctx: report_lineage_callback(
            ctx,
            source_fqn="sqlserver:analytics_db.dbo.market_data",
            target_fqn="bigquery:my-project.analytics.daily_prices",
        ),
    )
```

See [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) for the full pattern of using Airflow callbacks for observability.

### OpenLineage Integration

OpenLineage is the open standard for lineage metadata interchange. Airflow, Spark, dbt, and Flink all have OpenLineage emitters. GCP's Lineage API accepts OpenLineage events natively, making it a universal sink.

#### Airflow + OpenLineage

```bash
pip install "apache-airflow-providers-openlineage>=1.0.0"
```

In `airflow.cfg` or environment variables:

```ini
[openlineage]
transport = {"type": "http", "url": "https://datalineage.googleapis.com", "auth": {"type": "google_cloud"}}
namespace = my-airflow-namespace
```

Or via environment variables:

```bash
export OPENLINEAGE_URL="https://datalineage.googleapis.com"
export OPENLINEAGE_NAMESPACE="production-airflow"
# Authentication uses Application Default Credentials automatically
```

With this configuration, Airflow automatically reports lineage for all operators that support OpenLineage extraction (BigQuery, Postgres, MySQL, Snowflake, and more).

#### Spark + OpenLineage

Add the OpenLineage Spark listener to your Dataproc job submission:

```bash
gcloud dataproc jobs submit pyspark gs://my-bucket/jobs/transform.py \
  --cluster=my-cluster \
  --region=us-central1 \
  --jars=https://repo1.maven.org/maven2/io/openlineage/openlineage-spark_2.12/1.18.0/openlineage-spark_2.12-1.18.0.jar \
  --properties="spark.extraListeners=io.openlineage.spark.agent.OpenLineageSparkListener,spark.openlineage.transport.type=http,spark.openlineage.transport.url=https://datalineage.googleapis.com,spark.openlineage.namespace=dataproc-production"
```

Or in `SparkSession` configuration:

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("daily-transform") \
    .config("spark.extraListeners", "io.openlineage.spark.agent.OpenLineageSparkListener") \
    .config("spark.openlineage.transport.type", "http") \
    .config("spark.openlineage.transport.url", "https://datalineage.googleapis.com") \
    .config("spark.openlineage.namespace", "dataproc-production") \
    .getOrCreate()

# All DataFrame reads/writes are now tracked automatically
df = spark.read.parquet("gs://raw-ingest-bucket/market-data/")
result = df.filter("close_price > 0").groupBy("symbol").agg({"close_price": "avg"})
result.write.format("bigquery").option("table", "my-project.analytics.avg_prices").save()
# The GCS → BQ lineage is automatically captured by the listener
```

#### dbt + Lineage API

dbt's `manifest.json` contains full column-level lineage between dbt models. Parse it and push to the Lineage API:

```python
import json
from pathlib import Path
from google.cloud import datacatalog_lineage_v1
from google.protobuf import timestamp_pb2
import time


def push_dbt_lineage_to_gcp(
    manifest_path: str,
    project_id: str,
    bq_project: str,
    bq_dataset: str,
    location: str = "us-central1",
):
    """Parse dbt manifest.json and push model lineage to GCP Lineage API."""
    manifest = json.loads(Path(manifest_path).read_text())
    client = datacatalog_lineage_v1.LineageClient()
    parent = f"projects/{project_id}/locations/{location}"

    # Create a process for dbt
    process = get_or_create_process(
        client, project_id, location, "dbt-transformations", "dbt-transformations",
        attributes={"tool": "dbt"}
    )

    now_ts = timestamp_pb2.Timestamp(seconds=int(time.time()))
    run = client.create_run(
        parent=process.name,
        run=datacatalog_lineage_v1.Run(
            display_name=f"dbt-run-{int(time.time())}",
            start_time=now_ts,
            state=datacatalog_lineage_v1.Run.State.COMPLETED,
            end_time=now_ts,
        ),
    )

    links = []
    nodes = manifest.get("nodes", {})

    for node_id, node in nodes.items():
        if node["resource_type"] != "model":
            continue

        target_fqn = f"bigquery:{bq_project}.{bq_dataset}.{node['name']}"

        # Get upstream dependencies
        for dep_id in node.get("depends_on", {}).get("nodes", []):
            dep_node = nodes.get(dep_id) or manifest.get("sources", {}).get(dep_id)
            if dep_node:
                if dep_node["resource_type"] == "source":
                    src_schema = dep_node.get("source_name", "unknown")
                    src_name = dep_node.get("name", "unknown")
                    source_fqn = f"bigquery:{bq_project}.{src_schema}.{src_name}"
                else:
                    source_fqn = f"bigquery:{bq_project}.{bq_dataset}.{dep_node['name']}"

                links.append(
                    datacatalog_lineage_v1.EventLink(
                        source=datacatalog_lineage_v1.EntityReference(
                            fully_qualified_name=source_fqn
                        ),
                        target=datacatalog_lineage_v1.EntityReference(
                            fully_qualified_name=target_fqn
                        ),
                    )
                )

    if links:
        client.create_lineage_event(
            parent=run.name,
            lineage_event=datacatalog_lineage_v1.LineageEvent(
                links=links,
                start_time=now_ts,
                end_time=now_ts,
            ),
        )
        print(f"Pushed {len(links)} dbt lineage links to GCP")


# Run after dbt build
push_dbt_lineage_to_gcp(
    manifest_path="target/manifest.json",
    project_id="my-project",
    bq_project="my-project",
    bq_dataset="dbt_prod",
    location="us-central1",
)
```

See [dbt-transformation-layer](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) for the full dbt operational model this integrates with.

### Lineage Visualization

#### Console views — Lineage Visualization
- BigQuery Studio → Table → Lineage tab: shows immediate upstream/downstream with one hop
- Dataplex → Lineage Explorer: full multi-hop cross-system lineage graph, filterable by time range

#### Programmatic lineage traversal — "Show everything upstream of the executive dashboard"

```bash
# Direct upstream links (one hop)
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --target='bigquery:projects/PROJECT_ID/datasets/reporting/tables/executive_dashboard' \
  --direction=UPSTREAM

# For multi-hop traversal, use the Python SDK in a loop
```

```python
from google.cloud import datacatalog_lineage_v1
from collections import defaultdict, deque


def traverse_lineage(
    project_id: str,
    location: str,
    starting_fqn: str,
    direction: str = "UPSTREAM",  # or "DOWNSTREAM"
    max_hops: int = 10,
) -> dict:
    """
    BFS traversal of the lineage graph.
    Returns dict of {fqn: [upstream_fqns]} for all reachable nodes.
    """
    client = datacatalog_lineage_v1.LineageClient()
    parent = f"projects/{project_id}/locations/{location}"

    visited = set()
    graph = defaultdict(list)
    queue = deque([(starting_fqn, 0)])

    while queue:
        current_fqn, hop = queue.popleft()
        if current_fqn in visited or hop >= max_hops:
            continue
        visited.add(current_fqn)

        if direction == "UPSTREAM":
            request = datacatalog_lineage_v1.SearchLinksRequest(
                parent=parent,
                target=datacatalog_lineage_v1.EntityReference(
                    fully_qualified_name=current_fqn
                ),
            )
            for link in client.search_links(request=request).links:
                src = link.source.fully_qualified_name
                graph[current_fqn].append(src)
                queue.append((src, hop + 1))
        else:
            request = datacatalog_lineage_v1.SearchLinksRequest(
                parent=parent,
                source=datacatalog_lineage_v1.EntityReference(
                    fully_qualified_name=current_fqn
                ),
            )
            for link in client.search_links(request=request).links:
                tgt = link.target.fully_qualified_name
                graph[current_fqn].append(tgt)
                queue.append((tgt, hop + 1))

    return dict(graph)


# Find all data sources that feed the executive dashboard
upstream_graph = traverse_lineage(
    project_id="my-project",
    location="us-central1",
    starting_fqn="bigquery:my-project.reporting.executive_dashboard",
    direction="UPSTREAM",
)

print("Full upstream lineage:")
for node, sources in upstream_graph.items():
    for src in sources:
        print(f"  {src} → {node}")
```

---

## Data Quality with Dataplex

### Auto Data Quality Scans

Dataplex data quality scans run rules against BigQuery tables on a schedule and produce pass/fail results with row-level details.

#### Define quality rules in YAML

```yaml
# quality-rules.yaml
rules:
  # Completeness rules
  - column: symbol
    dimension: COMPLETENESS
    threshold: 1.0
    nonNullExpectation: {}

  - column: trade_date
    dimension: COMPLETENESS
    threshold: 1.0
    nonNullExpectation: {}

  - column: close_price
    dimension: COMPLETENESS
    threshold: 0.99  # Allow 1% null — some instruments close early
    nonNullExpectation: {}

  # Validity rules
  - column: close_price
    dimension: VALIDITY
    threshold: 1.0
    rangeExpectation:
      minValue: "0.001"
      maxValue: "999999"

  - column: volume
    dimension: VALIDITY
    threshold: 1.0
    rangeExpectation:
      minValue: "0"

  - column: trade_date
    dimension: VALIDITY
    threshold: 1.0
    rangeExpectation:
      minValue: "2000-01-01"
      maxValue: "2030-12-31"

  # Uniqueness rules
  - column: symbol
    dimension: UNIQUENESS
    threshold: 1.0
    uniquenessExpectation: {}

  # Row-level conditions
  - dimension: VALIDITY
    threshold: 1.0
    rowConditionExpectation:
      sqlExpression: "close_price > 0 AND volume >= 0 AND open_price > 0"

  - dimension: VALIDITY
    threshold: 0.99
    rowConditionExpectation:
      sqlExpression: "high_price >= low_price AND high_price >= close_price AND low_price <= close_price"

  # Freshness via aggregate condition
  - dimension: FRESHNESS
    threshold: 1.0
    tableConditionExpectation:
      sqlExpression: "DATE_DIFF(CURRENT_DATE(), MAX(trade_date), DAY) <= 1"
```

#### Create the data quality scan

```bash
gcloud dataplex datascans create data-quality daily-prices-quality \
  --location=us-central1 \
  --data-source-resource='//bigquery.googleapis.com/projects/PROJECT_ID/datasets/analytics/tables/daily_prices' \
  --display-name="Daily Prices Quality Scan" \
  --data-quality-spec-file=quality-rules.yaml \
  --on-demand

# Schedule it to run daily after the ETL completes
gcloud dataplex datascans update daily-prices-quality \
  --location=us-central1 \
  --schedule="0 7 * * 1-5"

# Run it manually to test
gcloud dataplex datascans run daily-prices-quality \
  --location=us-central1

# Check status of the last job
gcloud dataplex datascans jobs list \
  --datascan=daily-prices-quality \
  --location=us-central1 \
  --limit=5 \
  --format="table(name,state,startTime,endTime)"

# Get detailed results of the latest job
JOB_ID=$(gcloud dataplex datascans jobs list \
  --datascan=daily-prices-quality \
  --location=us-central1 \
  --limit=1 \
  --format='value(name)' | awk -F'/' '{print $NF}')

gcloud dataplex datascans jobs describe "$JOB_ID" \
  --datascan=daily-prices-quality \
  --location=us-central1 \
  --format="yaml(dataQualityResult)"
```

#### Quality scan result structure (YAML output)

```yaml
dataQualityResult:
  passed: true
  score: 97.3
  dimensions:
    - dimension: COMPLETENESS
      passed: true
      score: 100.0
    - dimension: VALIDITY
      passed: false
      score: 97.3  # Below 99% threshold for one rule
    - dimension: UNIQUENESS
      passed: true
      score: 100.0
  rules:
    - rule:
        column: close_price
        dimension: VALIDITY
        rangeExpectation:
          minValue: '0.001'
          maxValue: '999999'
      passed: false
      evaluatedCount: 15200
      passedCount: 14891
      failedCount: 309
      passRatio: 0.9797
      failingRowsQuery: >
        SELECT * FROM `analytics.daily_prices`
        WHERE NOT (close_price > 0.001 AND close_price < 999999)
        LIMIT 1000
```

> [!tip] Failing Rows Query
> The `failingRowsQuery` field in the quality result is a runnable BigQuery SQL that returns the actual failing rows. Copy this into BigQuery Studio and run it to immediately see which records failed and why. This is far faster than manually constructing a debug query.

### Alerting on Quality Failures

Quality scan results publish metrics to Cloud Monitoring. Set up alerts for quality degradation.

```bash
# Create an alerting policy for quality score drop
gcloud monitoring alert-policies create \
  --display-name="Data Quality Score Alert" \
  --condition-display-name="Quality score below 95%" \
  --condition-filter='resource.type="dataplex.googleapis.com/DataScan" AND metric.type="dataplex.googleapis.com/datascan/data_quality/score"' \
  --condition-threshold-value=95 \
  --condition-threshold-comparison=COMPARISON_LT \
  --condition-duration=0s \
  --notification-channels=projects/PROJECT_ID/notificationChannels/CHANNEL_ID \
  --documentation-content="A Dataplex data quality scan has reported a score below 95%. Check the scan results in the Dataplex console."
```

See [gcp-cloud-monitoring-deep-dive](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive) for the full monitoring setup, and [gcp-pipeline-health-and-sla](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-pipeline-health-and-sla) for integrating quality metrics into pipeline SLA dashboards.

### Custom Quality Checks (Python)

For sources outside BigQuery — SQL Server, PostgreSQL, APIs — run quality checks in Python and optionally push results back to Dataplex.

```python
import dataclasses
from typing import Callable
import pyodbc  # or psycopg2, etc.
from google.cloud import monitoring_v3
import time


@dataclasses.dataclass
class QualityCheck:
    name: str
    query: str
    threshold: float  # Expected value (e.g., 0 for zero failures)
    comparison: str   # "equal", "lte", "gte"
    description: str


class SQLServerQualityRunner:
    """Run quality checks against SQL Server and report metrics to Cloud Monitoring."""

    def __init__(self, connection_string: str, project_id: str):
        self.conn_str = connection_string
        self.project_id = project_id
        self.monitoring_client = monitoring_v3.MetricServiceClient()
        self.project_name = f"projects/{project_id}"

    def run_check(self, check: QualityCheck) -> tuple[bool, float]:
        """Run a single quality check. Returns (passed, actual_value)."""
        conn = pyodbc.connect(self.conn_str)
        cursor = conn.cursor()
        cursor.execute(check.query)
        row = cursor.fetchone()
        actual_value = float(row[0]) if row else 0.0
        conn.close()

        if check.comparison == "equal":
            passed = actual_value == check.threshold
        elif check.comparison == "lte":
            passed = actual_value <= check.threshold
        elif check.comparison == "gte":
            passed = actual_value >= check.threshold
        else:
            passed = False

        return passed, actual_value

    def run_all(self, checks: list[QualityCheck]) -> dict:
        """Run all checks and return a summary report."""
        results = {}
        for check in checks:
            passed, value = self.run_check(check)
            results[check.name] = {"passed": passed, "value": value, "check": check}
            self._report_metric(check.name, 1.0 if passed else 0.0)
            status = "PASS" if passed else "FAIL"
            print(f"[{status}] {check.name}: {value} (threshold: {check.threshold})")
        return results

    def _report_metric(self, check_name: str, passed: float):
        """Write quality pass/fail to a custom Cloud Monitoring metric."""
        series = monitoring_v3.TimeSeries()
        series.metric.type = "custom.googleapis.com/data_quality/check_passed"
        series.metric.labels["check_name"] = check_name
        series.metric.labels["source"] = "sqlserver"
        series.resource.type = "global"
        series.resource.labels["project_id"] = self.project_id

        now = time.time()
        point = monitoring_v3.Point(
            {
                "interval": {"end_time": {"seconds": int(now)}},
                "value": {"double_value": passed},
            }
        )
        series.points = [point]
        self.monitoring_client.create_time_series(
            name=self.project_name, time_series=[series]
        )


# Define checks for an external SQL Server source
checks = [
    QualityCheck(
        name="market_data_null_close_price",
        query="SELECT COUNT(*) FROM dbo.market_data WHERE close_price IS NULL AND trade_date = CAST(GETDATE() AS DATE)",
        threshold=0,
        comparison="equal",
        description="No null close prices on today's trading date",
    ),
    QualityCheck(
        name="market_data_row_count",
        query="SELECT COUNT(*) FROM dbo.market_data WHERE trade_date = CAST(GETDATE() AS DATE)",
        threshold=100,
        comparison="gte",
        description="At least 100 instruments loaded for today",
    ),
    QualityCheck(
        name="market_data_negative_prices",
        query="SELECT COUNT(*) FROM dbo.market_data WHERE close_price < 0",
        threshold=0,
        comparison="equal",
        description="No negative prices anywhere in the table",
    ),
    QualityCheck(
        name="market_data_future_dates",
        query="SELECT COUNT(*) FROM dbo.market_data WHERE trade_date > CAST(GETDATE() AS DATE)",
        threshold=0,
        comparison="equal",
        description="No records with future trade dates",
    ),
]

runner = SQLServerQualityRunner(
    connection_string="DRIVER={ODBC Driver 18 for SQL Server};SERVER=my-server;DATABASE=analytics_db;Authentication=ActiveDirectoryServicePrincipal",
    project_id="my-project",
)
results = runner.run_all(checks)

# Fail the pipeline if any check fails
if not all(r["passed"] for r in results.values()):
    failed = [name for name, r in results.items() if not r["passed"]]
    raise ValueError(f"Quality checks failed: {failed}")
```

### Querying Quality Results in BigQuery

Dataplex writes scan results to BigQuery when configured. Query them for trend analysis:

```sql
-- Quality score trend over time for a specific scan
SELECT
  DATE(job_start_time) AS scan_date,
  data_quality_result.score AS quality_score,
  COUNTIF(r.passed) AS rules_passed,
  COUNT(r) AS rules_total,
  ARRAY_AGG(
    IF(NOT r.passed, r.rule.column || ': ' || r.rule.dimension, NULL) IGNORE NULLS
  ) AS failing_rules
FROM
  `PROJECT_ID.dataplex_scans.daily_prices_quality`,
  UNNEST(data_quality_result.rules) AS r
WHERE
  job_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Find tables with the lowest quality scores across all scans
SELECT
  scan_id,
  data_source_resource,
  AVG(data_quality_result.score) AS avg_score,
  MIN(data_quality_result.score) AS min_score,
  COUNT(*) AS scan_count
FROM
  `PROJECT_ID.dataplex_scans.*`
WHERE
  job_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY 1, 2
ORDER BY avg_score ASC
LIMIT 20;
```

---

## Impact Analysis — Before You Change Anything

Impact analysis is the discipline of querying lineage before making changes to understand what will break.

> [!warning] Impact analysis before schema changes
>
> Renaming a column, changing a data type, or dropping a table without checking downstream lineage has caused production outages at every data team that has not enforced this practice. Make lineage impact analysis a mandatory step in your change management process — equivalent to running tests before deploying code.

### Pre-Change Impact Analysis Workflow

#### Step 1: Identify all downstream consumers of a table

```bash
# What downstream tables, jobs, and processes depend on this table?
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --source='bigquery:projects/PROJECT_ID/datasets/analytics/tables/daily_prices' \
  --direction=DOWNSTREAM \
  --format="json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for link in data.get('links', []):
    print(f'  Consumer: {link[\"target\"][\"fullyQualifiedName\"]}')
    print(f'  Via process: {link.get(\"name\", \"unknown\")}')
"
```

#### Step 2: Check if any scheduled queries reference the table

```sql
-- Find all BigQuery scheduled queries that reference a specific table
SELECT
  display_name,
  query,
  schedule,
  state
FROM
  `region-us-central1`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE
  job_type = 'QUERY'
  AND LOWER(query) LIKE '%daily_prices%'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY 1, 2, 3, 4
ORDER BY 1;

-- Find all views that reference the table
SELECT
  table_schema,
  table_name,
  view_definition
FROM
  `PROJECT_ID.INFORMATION_SCHEMA.VIEWS`
WHERE
  LOWER(view_definition) LIKE '%daily_prices%';
```

#### Step 3: Find all Dataflow jobs that read this table

```bash
gcloud dataflow jobs list \
  --region=us-central1 \
  --filter="name~daily-prices OR name~daily_prices" \
  --format="table(id,name,currentState,startTime)"
```

#### Step 4: Assess the blast radius before making the change

```python
def get_impact_summary(project_id: str, location: str, table_fqn: str) -> dict:
    """Produce an impact summary for a proposed change to a table."""
    graph = traverse_lineage(project_id, location, table_fqn, direction="DOWNSTREAM")

    all_downstream = set()
    for targets in graph.values():
        all_downstream.update(targets)

    bq_tables = [n for n in all_downstream if n.startswith("bigquery:")]
    external = [n for n in all_downstream if not n.startswith("bigquery:")]

    return {
        "table": table_fqn,
        "total_downstream_nodes": len(all_downstream),
        "bigquery_tables_affected": len(bq_tables),
        "external_systems_affected": len(external),
        "downstream_bigquery": bq_tables,
        "downstream_external": external,
    }

impact = get_impact_summary(
    "my-project", "us-central1",
    "bigquery:my-project.analytics.daily_prices"
)
print(f"Changing daily_prices will affect {impact['total_downstream_nodes']} downstream assets")
print(f"BigQuery tables: {impact['bigquery_tables_affected']}")
print(f"External systems: {impact['external_systems_affected']}")
```

### Decommissioning Analysis

Before decommissioning a pipeline or table, verify it has no active consumers:

```bash
# Check if a table has any downstream links (should return empty if safe to delete)
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --source='bigquery:projects/PROJECT_ID/datasets/analytics/tables/old_deprecated_table' \
  --direction=DOWNSTREAM

# Check when the table was last read via BigQuery audit logs
gcloud logging read \
  'protoPayload.methodName="google.cloud.bigquery.v2.JobService.InsertJob" AND protoPayload.serviceData.jobCompletedEvent.job.jobConfiguration.query.destinationTable.tableId="old_deprecated_table"' \
  --freshness=90d \
  --format="table(timestamp,protoPayload.authenticationInfo.principalEmail)"
```

See [gcp-cloud-trace-and-logging](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-trace-and-logging) for the full audit log query patterns.

### Building Impact Analysis into CI/CD

Add a pre-merge check that queries lineage for any table being modified in a dbt or SQL migration:

```python
# .github/scripts/check_lineage_impact.py
import sys
import subprocess
import json

def check_impact(table_fqn: str, max_downstream: int = 10) -> bool:
    """Fail CI if a table change affects more than max_downstream consumers."""
    result = subprocess.run(
        [
            "gcloud", "dataplex", "lineage", "search-links",
            "--location=us-central1",
            f"--source={table_fqn}",
            "--direction=DOWNSTREAM",
            "--format=json",
        ],
        capture_output=True,
        text=True,
    )
    data = json.loads(result.stdout)
    link_count = len(data.get("links", []))

    if link_count > max_downstream:
        print(f"WARNING: {table_fqn} has {link_count} downstream consumers.")
        print("This change requires explicit review and notification of downstream owners.")
        print("Downstream consumers:")
        for link in data["links"]:
            print(f"  - {link['target']['fullyQualifiedName']}")
        return False
    return True

# Called from CI with the list of modified tables
modified_tables = sys.argv[1:]
all_clear = all(
    check_impact(f"bigquery:my-project.dbt_prod.{table}")
    for table in modified_tables
)
sys.exit(0 if all_clear else 1)
```

---

## Lineage Gaps — What Is Not Captured

> [!warning] Lineage instrumentation gaps
>
> Every team that implements lineage discovers gaps: processing paths that write to BigQuery without going through a tracked process. Maintain an explicit inventory of lineage gaps alongside the lineage you do have.

| Pipeline Path | Auto-Captured? | How to Fill the Gap |
|---|---|---|
| BQ → BQ via SQL | Yes | No action needed |
| Dataflow → BQ (via BQ connector) | Yes | No action needed |
| GCS → BQ via `bq load` | Yes (partial) | Verify via Lineage API |
| SQL Server → BQ via custom Python | No | Add `LineageReporter` to ingestion code |
| REST API → GCS | No | Add lineage event when file is written |
| GCS → BQ via Dataform | Partial | Use OpenLineage or custom event |
| Spark (Dataproc) → BQ | No (without OpenLineage) | Add OpenLineage listener |
| Looker dashboards reading BQ | No | Looker does not report to Lineage API |
| Python scripts using Storage Read API | No | Add manual lineage event |
| dbt models | No (automatic) | Parse manifest.json and push |

#### Document your gaps in a tracking table

```sql
-- Create a gap registry in BigQuery
CREATE TABLE IF NOT EXISTS governance.lineage_gaps (
  gap_id STRING,
  pipeline_name STRING,
  source_system STRING,
  target_system STRING,
  gap_description STRING,
  severity STRING,  -- 'low', 'medium', 'high', 'critical'
  remediation_plan STRING,
  target_resolution_date DATE,
  status STRING,    -- 'open', 'in-progress', 'resolved'
  owner STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

---

## Comparison: GCP-Native vs Open-Source Lineage Tools

| Tool | Type | Lineage | Catalog | Quality | Cost | Best For |
|---|---|---|---|---|---|---|
| Dataplex + Lineage API | GCP-native | Yes (auto + custom) | Yes | Yes | Included in GCP usage | GCP-centric stacks, no Kubernetes ops overhead |
| Apache Atlas | Open-source | Yes | Yes | No | Free (self-hosted) | Hadoop/Hive-heavy stacks |
| OpenMetadata | Open-source | Yes (via OpenLineage) | Yes | Yes | Free (self-hosted) | Multi-cloud, rich UI, active community |
| DataHub (LinkedIn) | Open-source | Yes | Yes | No | Free (self-hosted) | Large-scale metadata management, ML feature lineage |
| Amundsen (Lyft) | Open-source | Limited | Yes | No | Free (self-hosted) | Data discovery focus, simpler setup |
| Collibra | Commercial | Yes | Yes | Yes | $$$$ | Enterprise with compliance requirements, large governance teams |
| Alation | Commercial | Yes | Yes | Limited | $$$ | Self-service analytics, business-facing catalog |
| Monte Carlo | Commercial | Limited | Limited | Yes (observability) | $$$ | Data reliability/observability focus, incident alerting |

### Decision Guide

#### Choose GCP-native Dataplex when
- Your data stack is primarily on GCP
- You want zero operational overhead — no Kubernetes clusters to manage
- You are already paying for BigQuery and Dataflow; lineage is included
- Your compliance requirements are met by GCP audit logging and lineage records
- Your team is small and cannot dedicate engineering time to operating open-source infrastructure

#### Choose OpenMetadata or DataHub when
- You have a multi-cloud or hybrid stack (AWS, Azure, on-prem, GCP)
- You need deeper integrations with tools GCP does not natively cover (Snowflake, Redshift, Tableau, Looker — note Looker is GCP-native but DataHub has better lineage extraction)
- You want a richer, more customizable UI for data discovery
- Your data platform team has Kubernetes operational expertise

#### Choose Collibra or Alation when
- You have a large governance team and need workflow management (approval workflows, stewardship assignments)
- You need a business-facing catalog with deep business glossary and policy management
- Your compliance team requires a dedicated governance platform with audit trails beyond what GCP provides
- Budget is not a constraint

> [!note] Hybrid Approach
> Many mature data teams use Dataplex for the technical lineage and quality layer (it is integrated and zero-ops) while using OpenMetadata or a commercial tool as the business-facing discovery and governance layer, with a sync layer between them. This gives the best of both: automated technical lineage from GCP with a richer catalog UI for business users.

---

## Complete Setup Checklist

### Phase 1: Foundation (Day 1)

- [ ] Enable Dataplex, Data Catalog, and Lineage APIs
  ```bash
  gcloud services enable dataplex.googleapis.com datalineage.googleapis.com datacatalog.googleapis.com
  ```
- [ ] Create IAM roles for governance service account (`roles/dataplex.admin`, `roles/datalineage.admin`, `roles/datacatalog.admin`)
- [ ] Create Dataplex Lake with environment label (`env=prod`)
- [ ] Create Raw, Curated, and Consumption zones within the lake
- [ ] Attach all BigQuery datasets as assets with `--discovery-enabled`
- [ ] Attach all GCS buckets as assets with `--discovery-enabled`
- [ ] Verify auto-discovery runs and populates catalog entries

### Phase 2: Tagging (Week 1)

- [ ] Create `pipeline-metadata` tag template (owner, team, refresh frequency, SLA, PII, classification, retention, criticality)
- [ ] Create `quality-metadata` tag template (score, scan ID, last scan, known issues)
- [ ] Create `column-semantics` tag template for column-level business definitions
- [ ] Tag all production BigQuery tables using the bulk tagging Python script
- [ ] Identify and tag all tables with PII columns
- [ ] Set up a process to tag new tables automatically when pipelines are deployed

### Phase 3: Glossary (Week 2)

- [ ] Create Dataplex business glossary for each domain (finance, risk, operations, etc.)
- [ ] Define the top 20 most-contested business terms in each domain
- [ ] Establish governance process: who approves new terms, how conflicts are resolved
- [ ] Link glossary terms to the relevant BigQuery columns via column-level tags

### Phase 4: Lineage (Week 2-3)

- [ ] Verify BigQuery automatic lineage is capturing SQL transformations (check console Lineage tab)
- [ ] Identify all non-BigQuery pipeline steps (SQL Server ingestions, API pulls, CSV loads)
- [ ] Add `LineageReporter` to each non-BQ pipeline
- [ ] Add OpenLineage listener to all Dataproc Spark jobs
- [ ] Configure Airflow OpenLineage provider for Cloud Composer
- [ ] Parse dbt `manifest.json` and push lineage after each `dbt build`
- [ ] Document remaining lineage gaps in `governance.lineage_gaps` table

### Phase 5: Quality (Week 3-4)

- [ ] Define quality rules YAML for each critical production table
- [ ] Create Dataplex data quality scans for all critical tables
- [ ] Schedule quality scans to run after ETL completion
- [ ] Configure Cloud Monitoring alerts for quality score below threshold
- [ ] Connect quality scan results to Slack/PagerDuty via notification channels
- [ ] Build quality score dashboard in Looker or Grafana

### Phase 6: Operationalization (Month 2)

- [ ] Add lineage impact check to PR/MR review process for table schema changes
- [ ] Add lineage impact check to CI/CD pipeline for dbt model changes
- [ ] Build an internal data discovery portal using Data Catalog search API
- [ ] Schedule quarterly lineage gap review meetings
- [ ] Run dead asset analysis (tables with no downstream links, not read in 90 days)
- [ ] Integrate tag coverage metrics into platform health dashboard

---

## Operational Procedures

### Monthly Governance Review

```bash
# Count tagged vs untagged tables
bq query --nouse_legacy_sql '
SELECT
  COUNT(*) AS total_tables,
  COUNTIF(ddl LIKE "%CLUSTER%") AS clustered_tables
FROM `PROJECT_ID.INFORMATION_SCHEMA.TABLES`
WHERE table_type = "BASE TABLE"
'

# Find tables with no lineage upstream (potential dead-ends or undocumented sources)
# This requires joining lineage API results with INFORMATION_SCHEMA
```

```python
def find_orphaned_tables(project_id: str, dataset: str, location: str) -> list[str]:
    """Find BigQuery tables with no upstream lineage links (undocumented sources)."""
    from google.cloud import bigquery, datacatalog_lineage_v1

    bq_client = bigquery.Client(project=project_id)
    lineage_client = datacatalog_lineage_v1.LineageClient()
    parent = f"projects/{project_id}/locations/{location}"

    tables = list(bq_client.list_tables(dataset))
    orphaned = []

    for table in tables:
        fqn = f"bigquery:{project_id}.{dataset}.{table.table_id}"
        request = datacatalog_lineage_v1.SearchLinksRequest(
            parent=parent,
            target=datacatalog_lineage_v1.EntityReference(fully_qualified_name=fqn),
        )
        response = lineage_client.search_links(request=request)
        if not list(response.links):
            orphaned.append(table.table_id)

    return orphaned
```

### Lineage API Quotas and Limits

| Limit | Value | Notes |
|---|---|---|
| Lineage events per project per day | 10,000 | Sufficient for most pipelines; request increase if needed |
| Links per lineage event | 100 | Batch large fan-out pipelines into multiple events |
| Process/run retention | 90 days | Events older than 90 days are purged from the API |
| Search results per page | 100 | Use pagination for large result sets |
| Concurrent API requests | 100 RPS | Back off with exponential retry on 429 errors |

> [!tip] Lineage Retention and Archiving
> The Lineage API retains events for 90 days. If you need longer retention for compliance (SOX, BCBS 239), archive lineage events to BigQuery immediately after creation. The `LineageReporter` class above can be extended to write a copy of each event to a `governance.lineage_events` BigQuery table before calling the Lineage API.

### Troubleshooting Common Issues

#### Auto-discovery not finding new tables
```bash
# Check discovery status
gcloud dataplex assets describe ASSET_NAME \
  --lake=LAKE --zone=ZONE --location=us-central1 \
  --format="yaml(discoveryStatus)"

# Trigger manual discovery
gcloud dataplex assets run-discovery ASSET_NAME \
  --lake=LAKE --zone=ZONE --location=us-central1
```

#### Lineage not appearing for a BigQuery transformation
```bash
# Check if the job was captured in the Lineage API
gcloud dataplex lineage search-links \
  --location=us-central1 \
  --target='bigquery:projects/PROJECT_ID/datasets/DATASET/tables/TABLE'

# If empty, check that the BigQuery job completed (not cancelled) and was a DML job
# SELECT-only queries without a destination table do not create lineage
```

#### Tag template field validation errors
```bash
# List tag template fields to verify correct field IDs
gcloud data-catalog tag-templates describe pipeline-metadata \
  --location=us-central1 \
  --format="yaml(fields)"
```

#### Permission denied on Lineage API
```bash
# Verify the service account has the lineage producer role
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.role:datalineage" \
  --format="table(bindings.role,bindings.members)"
```

---

## Related Notes

- [data-warehouse-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-warehouse-architecture) — BigQuery design patterns that the lineage layer governs
- [data-lake-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-lake-architecture) — GCS organization that Dataplex discovery crawls
- [data-mesh-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Architectures/data-mesh-architecture) — Domain-oriented data products that the catalog makes discoverable
- [gcp-pipeline-health-and-sla](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-pipeline-health-and-sla) — SLA monitoring that integrates quality scan metrics
- [gcp-cloud-monitoring-deep-dive](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-monitoring-deep-dive) — Setting up alerts for quality failures and lineage gaps
- [gcp-cloud-trace-and-logging](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-cloud-trace-and-logging) — Audit logs for BigQuery access, source of truth for lineage validation
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — IAM roles for Dataplex, Lineage API, and Data Catalog
- [querying-and-cost-optimization](https://alp78.github.io/elysium/06-GCP/BigQuery/querying-and-cost-optimization) — Using catalog tags for cost attribution and slot optimization
- [dbt-transformation-layer](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/dbt-transformation-layer) — dbt manifest lineage integration and model tagging
- [airflow-core-concepts](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-core-concepts) — Airflow OpenLineage provider and callback patterns for lineage reporting
