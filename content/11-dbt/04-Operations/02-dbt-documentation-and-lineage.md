---
title: "02 - dbt: Documentation and Lineage"
tags: [pipeline, observability, dbt]
status: stable
updated: 2026-03-23
description: "dbt docs generate, exposures, lineage graph, static hosting on GCS, Dataplex/DataHub integration, and regulatory traceability for EU BMR."
---

# dbt: Documentation and Lineage

> [!quote]
> "The grain declaration becomes a binding contract on the design."
>
> — **Ralph Kimball**, *The Data Warehouse Toolkit* (2013)

> [!abstract]- Summary
>
> Explains how dbt turns model metadata into living documentation and lineage, covering local doc generation, reusable descriptions, exposure mapping, static hosting, versioned publication, and integration into broader data-catalog workflows.
>
> **Documentation generation and authoring**
> - Covers `dbt docs generate`, local serving, CI/CD automation, model descriptions, and doc blocks so documentation is produced from the same project state that executes transformations
> - Explains how descriptions, reusable narrative blocks, and model metadata become part of the version-controlled analytical interface rather than a separate wiki or slide deck
>
> **Lineage and consumer mapping**
> - Covers lineage graph visualization, selector-driven lineage inspection, and exposures so dependencies are visible both inside the dbt DAG and out to dashboards or other consumer systems
> - Connects lineage to trust, reviewability, and impact analysis instead of treating the docs site as a passive catalog
>
> **Publishing and integration patterns**
> - Covers static-site hosting such as GCS, versioned docs publication, GitHub Pages alternatives, and integration with broader data catalog or methodology traceability workflows
> - Emphasizes that docs publication is an operational delivery concern, not only a developer convenience, once consumers depend on the lineage view externally
>
> **Operations and safety**
> - Warnings: undocumented published models, stale generated docs, missing exposures, lineage gaps from hard-coded relations, and externally hosted docs that drift from the actual project state
> - Recommendations: generate docs from CI, keep descriptions close to code, register exposures for real consumers, and treat docs hosting and versioning as part of the production analytical surface

> [!note]- Glossary
>
> **dbt docs**
> - The generated documentation site built from dbt project metadata, model SQL, tests, sources, and lineage information.
> - It matters here because the note is about turning project metadata into a browsable, operationally useful interface for the warehouse graph.
>
> > [!info] Same source of truth as execution
> >
> > dbt docs are valuable because they are generated from the same code and metadata that drive model execution. That keeps documentation closer to reality than separate manual knowledge bases.
>
> ---
>
> **`dbt docs generate`**
> - The dbt command that builds the manifest and catalog artifacts needed for the documentation site.
> - It matters here because documentation only becomes publishable after the project metadata and warehouse introspection artifacts are generated.
>
> > [!warning] Generated artifacts can go stale
> >
> > If docs generation is not wired into a reliable workflow, consumers may browse lineage and schema information that no longer reflects the current project state.
>
> ---
>
> **`dbt docs serve`**
> - The dbt command that serves generated documentation locally for inspection.
> - It matters here because local serving is usually the fastest way to verify documentation, lineage, and exposure changes before publishing them broadly.
>
> > [!info] Local preview surface
> >
> > Serving docs locally is the equivalent of previewing a UI before deploy. It is cheap and catches metadata mistakes early.
>
> ---
>
> **Model description**
> - The human-readable metadata attached to a model or column in YAML that explains semantics, grain, and intended use.
> - It matters here because the docs site is only as useful as the descriptions embedded into the project.
>
> > [!warning] Published models need real prose
> >
> > A generated docs site with empty or vague descriptions is still a broken interface. Good lineage without semantic explanation only solves half the discoverability problem.
>
> ---
>
> **Doc block**
> - A reusable documentation fragment that can be referenced across models or columns to avoid repeating common text.
> - It matters here because reusable narrative is one of the main ways large dbt projects keep documentation consistent across many related models.
>
> > [!info] Reuse for narrative metadata
> >
> > Doc blocks do for documentation what macros do for SQL: they reduce drift by centralizing repeated content in one maintained location.
>
> ---
>
> **Lineage graph**
> - The graph visualization of dbt dependencies showing how sources, models, tests, and exposures connect.
> - It matters here because lineage is the operational view that lets engineers see upstream and downstream impact before making changes.
>
> > [!warning] Only as accurate as the DAG
> >
> > Hard-coded table references and missing metadata create lineage blind spots. The graph is trustworthy only when dependencies are expressed through dbt primitives.
>
> ---
>
> **Selector**
> - A dbt expression used to target nodes by name, tag, path, graph relationship, or other metadata.
> - It matters here because selectors are one of the practical ways teams inspect lineage slices and reason about impact in the docs and CLI surfaces.
>
> > [!info] Operational way to navigate the graph
> >
> > Selectors are not just execution tools. They are also a way to think about and inspect model neighborhoods in a large project.
>
> ---
>
> **Exposure**
> - A dbt metadata object that represents a downstream dashboard, notebook, app, or other consumer of a model.
> - It matters here because exposures extend lineage beyond dbt itself and make consumer impact visible in the docs site.
>
> > [!warning] Missing exposures hide real blast radius
> >
> > If dashboards and apps are not declared as exposures, lineage stops at the mart and change impact looks smaller than it really is.
>
> ---
>
> **Static hosting**
> - The pattern of publishing generated dbt docs as a static website on infrastructure such as GCS or GitHub Pages.
> - It matters here because documentation is only operationally useful when the right audience can reach the generated site consistently.
>
> > [!warning] Publishing is part of documentation quality
> >
> > Great generated docs that are hard to access or rarely updated fail as an operational surface just as surely as undocumented models do.
>
> ---
>
> **Versioned docs**
> - Separate published documentation builds aligned to different project or model versions.
> - It matters here because consumers sometimes need to inspect lineage and schema as they existed for a specific release, not only the latest state.
>
> > [!info] Historical documentation context
> >
> > Versioning docs becomes important when model interfaces evolve. It gives reviewers and consumers a way to compare current and prior analytical surfaces clearly.
>
> ---
>
> **Data catalog integration**
> - The linkage between dbt-generated metadata and broader enterprise catalog or governance systems.
> - It matters here because dbt docs are often one layer of a larger metadata and lineage ecosystem rather than the only discovery surface.
>
> > [!info] dbt as metadata producer
> >
> > dbt often owns the freshest transformation metadata, but other systems may own stewardship, glossary, or governance workflows. Integration keeps those layers aligned.
>
> ---
>
> **Methodology traceability**
> - The ability to trace published analytical outputs back to documented transformation logic, assumptions, and model lineage.
> - It matters here because documentation and lineage are especially valuable in regulated or methodology-heavy data domains where explainability matters.
>
> > [!warning] Trust requires traceability
> >
> > In high-stakes reporting, consumers do not just need a table name. They need to know how it was built, what it depends on, and where to inspect the logic behind it.

> [!example] Lineage Publication Fit
>
> > [!success] Shared Discoverability
> >
> > - Publish dbt docs and lineage when analysts, engineers, auditors, or downstream owners need to understand model meaning, dependencies, and consumer impact without reading project SQL directly.
> > - Treat exposures, hosted docs, and versioned publication as part of the production interface when other teams rely on the lineage view for review, onboarding, or change assessment.
>
> > [!failure] Metadata Theater
> >
> > - Do not expect generated docs to rescue poorly described models; empty descriptions and missing exposures still produce a catalog that looks complete while explaining very little.
> > - Avoid treating the docs site as authoritative if it is not regenerated reliably from CI against the current project and warehouse state, because stale lineage is operationally misleading.

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

> [!tip] Generate docs after run
>
> Run `dbt docs generate` after `dbt run` so that `catalog.json` reflects the freshly materialized tables, not stale schema information.

---

### dbt Model Descriptions

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

### dbt Doc Blocks

Long methodological descriptions that are reused across multiple models belong in doc blocks, stored in `.md` files inside the `models/` directory.

```markdown
<!-- models/docs/esg_methodology.md -->
{% docs esg_score_normalisation %}
### ESG Score Normalisation Doc Block

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
      See [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/17-Financial-Domain/Regulatory/eu-bmr-benchmark-regulation) for compliance context.
    depends_on:
      - ref('fct_index_composition')
      - ref('fct_esg_scores')
    owner:
      name: Regulatory Reporting
      email: reg-reporting@example.com
```

> [!note] Exposures for impact analysis
>
> Exposures are the primary mechanism for impact analysis. Before changing `fct_esg_scores`, the lineage graph immediately shows that three high-maturity consumers will be affected.

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

- [gcp-data-lineage-and-catalog](https://alp78.github.io/elysium/13-Observability/GCP-Native/gcp-data-lineage-and-catalog)
- [eu-bmr-benchmark-regulation](https://alp78.github.io/elysium/eu-bmr-benchmark-regulation)
- [dbt-core-concepts](https://alp78.github.io/elysium/11-dbt/Foundations/dbt-core-concepts)
- [dbt-observability](https://alp78.github.io/elysium/11-dbt/Operations/dbt-observability)
- [dbt-testing-framework](https://alp78.github.io/elysium/11-dbt/Quality/dbt-testing-framework)
