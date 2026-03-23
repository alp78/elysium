---
tags: [pipeline, observability, dbt]
type: reference
technology: [dbt]
status: stable
updated: 2026-03-23
description: "dbt docs generate, exposures, lineage graph, static hosting on GCS, Dataplex/DataHub integration, and regulatory traceability for EU BMR."
related:
  - "[[gcp-data-lineage-and-catalog]]"
  - "[[eu-bmr-benchmark-regulation]]"
  - "[[dbt-core-concepts]]"
  - "[[dbt-observability]]"
  - "[[dbt-testing-framework]]"
---

# dbt: Documentation and Lineage

dbt documentation is generated from the same source-of-truth that runs your transformations. Every model description, column annotation, and exposure definition is version-controlled alongside SQL, making the docs auditable by the same review process that governs the code.

---

## Generating and Serving Docs

### Generate

```bash
dbt docs generate --target prod
```

Produces two files in `target/`:
- `manifest.json` — the compiled DAG with all node metadata.
- `catalog.json` — column types and row counts queried from the warehouse information schema.

### Serve Locally

```bash
dbt docs serve --port 8080
```

Opens the lineage graph and documentation browser at `http://localhost:8080`.

### Automate in CI/CD

```yaml
# In .github/workflows/dbt-cd.yml — after dbt run succeeds
- name: Generate dbt docs
  run: dbt docs generate --target prod

- name: Upload docs to GCS
  run: |
    gsutil -m rsync -r target/ gs://fin-dbt-docs/latest/
    gsutil web set -m index.html gs://fin-dbt-docs
```

> [!tip] Run `dbt docs generate` after `dbt run` so that `catalog.json` reflects the freshly materialized tables, not stale schema information.

---

## Model Descriptions

Descriptions live in `.yml` files co-located with models. They render as rich text in the docs browser and can include Markdown.

```yaml
# models/marts/esg/schema.yml
version: 2

models:
  - name: fct_esg_scores
    description: >
      Daily ESG scores per issuer, aggregated from multiple provider feeds
      (MSCI, Sustainalytics, ISS). Scores are normalised to a 0–100 scale
      using the methodology defined in `{{ doc('esg_score_normalisation') }}`.
    config:
      tags: [esg, regulatory]
    columns:
      - name: issuer_id
        description: "LEI (Legal Entity Identifier) of the issuer."
        tests:
          - not_null
          - unique
      - name: environmental_score
        description: "Normalised environmental pillar score (0–100)."
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 100
      - name: score_date
        description: "Business date for which the score is valid."
        tests:
          - not_null
```

---

## Doc Blocks

Long methodological descriptions that are reused across multiple models belong in doc blocks, stored in `.md` files inside the `models/` directory.

```markdown
<!-- models/docs/esg_methodology.md -->
{% docs esg_score_normalisation %}
## ESG Score Normalisation

Raw provider scores are mapped to a common 0–100 scale using a min-max
normalisation applied per pillar per universe. The transformation follows
the EU Sustainable Finance Disclosure Regulation (SFDR) Article 8/9
classification framework:

1. Raw scores are Z-scored within each provider's universe.
2. Scores are winsorised at the 2nd and 98th percentile.
3. Winsorised scores are linearly scaled to [0, 100].

Reference: `stg_esg_provider_raw` → `int_esg_normalised` → `fct_esg_scores`.
{% enddocs %}
```

Reference in `schema.yml`:

```yaml
description: "See {{ doc('esg_score_normalisation') }} for full methodology."
```

---

## Lineage Graph Visualisation

The dbt docs browser renders an interactive DAG. Nodes are coloured by resource type (source, model, test, exposure). Clicking a node shows its SQL, description, and column definitions.

### Useful Lineage Selectors

Navigate the lineage from the command line to understand dependency scope before making changes:

```bash
# Show everything upstream of the ESG fact table
dbt ls --select +fct_esg_scores

# Show everything downstream of a staging model
dbt ls --select stg_esg_msci+

# Show the full subgraph between two nodes
dbt ls --select stg_esg_msci+,+fct_index_weights
```

The same selector syntax works in the docs graph's search bar.

---

## Exposures

Exposures declare downstream consumers of dbt models. They appear in the lineage graph as terminal nodes, making it immediately visible which dashboards or APIs depend on a given model.

### Dashboard Exposure

```yaml
# models/exposures.yml
version: 2

exposures:
  - name: esg_index_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: >
      Executive ESG Index Dashboard showing daily score trends, benchmark
      comparisons, and constituent-level drill-down for the FTSE ESG index.
    depends_on:
      - ref('fct_esg_scores')
      - ref('fct_index_weights')
      - ref('dim_issuers')
    owner:
      name: Portfolio Analytics Team
      email: portfolio-analytics@example.com

  - name: index_calculation_api
    type: application
    maturity: high
    url: https://api.internal/v2/index
    description: >
      Real-time index calculation API. Reads `fct_index_weights` via BigQuery
      Storage API. Any breaking schema change requires a coordinated API release.
    depends_on:
      - ref('fct_index_weights')
      - ref('fct_esg_scores')
    owner:
      name: Quant Engineering
      email: quant-eng@example.com

  - name: eu_bmr_regulatory_feed
    type: ml
    maturity: high
    description: >
      Automated data feed to the EU BMR reporting system. Sends daily benchmark
      methodology data derived from `fct_index_composition` and `fct_esg_scores`.
      See [[eu-bmr-benchmark-regulation]] for compliance context.
    depends_on:
      - ref('fct_index_composition')
      - ref('fct_esg_scores')
    owner:
      name: Regulatory Reporting
      email: reg-reporting@example.com
```

> [!note] Exposures are the primary mechanism for impact analysis. Before changing `fct_esg_scores`, the lineage graph immediately shows that three high-maturity consumers will be affected.

---

## Hosting: GCS Static Site

dbt docs is a single-page app. Host it on GCS with public or IAP-restricted access.

```bash
# Upload
gsutil -m rsync -r target/ gs://fin-dbt-docs/latest/

# Set index page
gsutil web set -m index.html gs://fin-dbt-docs

# Make public (internal network only; use IAP for stricter control)
gsutil iam ch allUsers:objectViewer gs://fin-dbt-docs
```

Access at: `https://storage.googleapis.com/fin-dbt-docs/latest/index.html`

### Versioned Docs

```bash
# Archive docs for each production release
RUN_DATE=$(date +%Y%m%d)
gsutil -m rsync -r target/ "gs://fin-dbt-docs/${RUN_DATE}/"

# Update the "latest" pointer
gsutil -m rsync -r target/ gs://fin-dbt-docs/latest/
```

This creates an audit trail of documentation snapshots aligned with production runs, useful for regulatory look-back requests.

### GitHub Pages Alternative

```yaml
# .github/workflows/dbt-cd.yml — additional step
- name: Deploy docs to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./target
    destination_dir: docs
```

---

## Data Catalog Integration

### Dataplex (GCP Native)

Dataplex auto-discovers BigQuery tables. Enrich the catalog with dbt descriptions by syncing `catalog.json` after each production run:

```python
# post_run_catalog_sync.py
import json
from google.cloud import dataplex_v1

with open("target/catalog.json") as f:
    catalog = json.load(f)

client = dataplex_v1.DataplexServiceClient()

for node_id, node in catalog["nodes"].items():
    if node["resource_type"] != "model":
        continue
    table_name = node["relation_name"]
    description = node.get("description", "")
    # Update Dataplex entry description via API
    # ... (entry name derived from BQ table path)
```

Dataplex also supports tagging tables with custom metadata (e.g., `data_sensitivity: confidential`, `regulatory: eu_bmr`).

### DataHub

[DataHub](https://datahubproject.io/) ingests dbt artifacts directly via its `dbt` source connector:

```yaml
# datahub_recipe.yml
source:
  type: dbt
  config:
    manifest_path: /opt/dbt/financial_indices/target/manifest.json
    catalog_path: /opt/dbt/financial_indices/target/catalog.json
    sources_path: /opt/dbt/financial_indices/target/sources.json
    target_platform: bigquery
    node_name_pattern:
      allow: [".*esg.*", ".*index.*"]

sink:
  type: datahub-rest
  config:
    server: http://datahub-gms:8080
```

Run after each production dbt execution:

```bash
datahub ingest -c datahub_recipe.yml
```

DataHub renders the full dbt lineage graph alongside ingested BigQuery schemas, BI tool lineage, and data quality results from elementary.

---

## EU BMR Methodology Traceability

The EU Benchmark Regulation (EU 2016/1011 and its amendments) requires benchmark administrators to maintain documented, auditable methodology records. dbt docs provide a natural traceability layer.

### Traceability Pattern

```
Source data (stg_esg_provider_raw)
  │  ← documented in schema.yml with source freshness tests
  ▼
Normalisation logic (int_esg_normalised)
  │  ← doc block references the exact SFDR normalisation algorithm
  ▼
Benchmark inputs (fct_esg_scores)
  │  ← column-level descriptions explain each pillar weight
  ▼
Index composition (fct_index_composition)
  │  ← exposure declared for eu_bmr_regulatory_feed
  ▼
Regulatory feed (exposure: eu_bmr_regulatory_feed)
     ← auditor can trace from feed back to raw source in one click
```

### Regulatory-Specific Schema Annotations

```yaml
models:
  - name: fct_index_composition
    description: >
      Final constituent weights for the ESG index. This model is the direct
      input to the EU BMR regulatory reporting feed. Methodology changes to
      this model require a Methodology Committee sign-off (see policy REG-007).
    meta:
      regulatory_scope: EU_BMR
      methodology_version: "2.4.1"
      review_frequency: quarterly
      owner_committee: Methodology Committee
    columns:
      - name: constituent_weight
        description: >
          Normalised constituent weight in the index (sum = 1.0 per index per date).
          Calculated per section 4.2 of the Index Methodology Document v2.4.1.
```

The `meta` fields appear in the dbt docs browser and can be exported to the data catalog, giving compliance teams a single source of truth for regulatory model ownership.

---

## Related

- [[gcp-data-lineage-and-catalog]]
- [[eu-bmr-benchmark-regulation]]
- [[dbt-core-concepts]]
- [[dbt-observability]]
- [[dbt-testing-framework]]
