---
type: reference
category: data-formats
technology: [python, kafka, protobuf, avro]
tags: [data-architecture, architecture, pipeline, python]
aliases: [serialization, data formats comparison, format decision matrix, JSON vs Parquet, Avro vs Protobuf, MessagePack, Pickle, compression codecs, Snappy, Zstd, Gzip, LZ4]
keywords: [serialization, json, yaml, csv, parquet, avro, protobuf, messagepack, pickle, compression, snappy, zstd, gzip, lz4, schema, binary format, text format, kafka, gRPC, data lake, format comparison, encoding, decoding, schema evolution, cross-language]
description: "Comprehensive comparison of every serialization format a data engineer encounters — JSON, YAML, CSV, MessagePack, Protobuf, Avro, Parquet, and Pickle — with a format decision matrix and compression codec comparison (Snappy, LZ4, Zstd, Gzip)."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Serialization Formats

> [!quote]
> "Schema is the contract between writer and reader. Get it wrong and your data lake becomes a data landfill."
>
> — **Doug Cutting** (co-creator of Avro and Hadoop)

Serialization is the bridge between in-memory data structures and persistent storage or network transmission. This note covers every serialization format a data engineer encounters, from human-readable (JSON, YAML) to high-performance binary (Protobuf, Avro, MessagePack). For detailed JSON and CSV handling, see [CSV processing with awk](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing). For Parquet-specific operations, see parquet files.

### Serialization Format Decision Matrix

Choose your format based on the primary constraint: speed, size, schema enforcement, cross-language support, or human readability.

| Format | Speed | Size | Schema | Cross-Language | Best For |
|---|---|---|---|---|---|
| JSON | Slow | Large | No | Excellent | APIs, configs, debugging |
| YAML | Slow | Large | No | Good | Config files (Airflow, Docker, K8s) |
| CSV | Moderate | Large | No | Excellent | Tabular data exchange |
| MessagePack | Fast | Small | No | Good | Fast JSON replacement (internal APIs) |
| Protobuf | Fastest | Smallest | Required | Excellent | gRPC, cross-service communication |
| Avro | Fast | Small | Embedded | Good | Kafka, streaming, schema evolution |
| Parquet | Fast read | Smallest | Embedded | Good | Analytics, data lakes |
| Pickle | Fast | Medium | No | Python only | Python-to-Python (never untrusted data) |

> [!tip] Format Selection Guide
> - **APIs and configs** → JSON (universal) or YAML (human-friendly config)
> - **Data lake and analytics** → Parquet (columnar, compressed, schema embedded). For loading Parquet into BigQuery, see [data-loading-and-export](https://alp78.github.io/elysium/06-GCP/BigQuery/data-loading-and-export).
> - **Kafka / streaming** → Avro (schema evolution, compact, widely supported)
> - **gRPC / microservices** → Protobuf (fastest, smallest, strongly typed)
> - **Internal Python pipelines** → MessagePack (drop-in JSON replacement, 2-5x faster)
> - **Quick Python object persistence** → Pickle (but NEVER deserialize from untrusted sources)

### Compression Codecs

| Codec | Speed | Ratio | Best For |
|---|---|---|---|
| **gzip** | Slow | Best (70-80% reduction) | Archival, cold storage, network transfer |
| **zstd** | Fast | Very good (65-75% reduction) | Default choice — best speed/ratio trade-off |
| **snappy** | Fastest | Moderate (50-60% reduction) | Hot data, frequent reads, Parquet default in Spark |
| **lz4** | Fastest | Moderate (50-60% reduction) | Real-time systems, message queues |

> [!info] Default Codec Recommendation
>
> Use **zstd** as the default compression codec for Parquet files and data
> archives. It compresses nearly as well as gzip but decompresses 5-10x
> faster. Snappy is faster to decompress but compresses 15-20% less.
> The only reason to use gzip in 2026 is backward compatibility with
> systems that don't support zstd (increasingly rare).

## Format Details

### JSON

- **Text format, human-readable**
- No schema — any shape is valid
- Universal: every language, every tool, every API
- Verbose: field names repeat for every record
- Slow: string parsing is expensive at scale
- Best for: [JSON and CSV processing](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing)

### YAML

- **Text format, even more human-readable than JSON**
- Superset of JSON — all JSON is valid YAML
- Standard for config files: Airflow DAGs, Docker Compose, Kubernetes manifests, GitHub Actions
- Dangerous: YAML has implicit type coercion (`yes` → `true`, `1.0` → float, `2026-03-10` → date object)
- Never use YAML for data exchange — use JSON

> [!warning] YAML Implicit Type Coercion
> YAML silently converts strings: `yes`, `no`, `on`, `off`, `true`, `false` → boolean; `2026-03-10` → date object; `1e5` → 100000.0 (float). This breaks when a field value happens to look like a boolean or date. Always quote strings in YAML config files when they contain ambiguous values.

### CSV

- **Text format, tabular**
- No schema, no types — all values are strings
- Universal: Excel, SQL Server bulk insert, pandas, every ETL tool
- Large: no compression, no column pruning
- Best for: data exchange with external parties, human inspection, SQL Server `BULK INSERT`
- See [CSV processing with awk](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing) for parsing recipes

### MessagePack

- **Binary format, schema-less**
- Drop-in replacement for JSON: same data model, 2-5x smaller, 2-5x faster to encode/decode
- Cross-language: Python (`msgpack`), Go, Java, Rust, JavaScript all have native support
- Not human-readable — use JSON for debugging, MessagePack for production internal APIs
- Best for: internal microservice APIs where you control both sides and want speed without Protobuf's schema requirement

### Protobuf (Protocol Buffers)

- **Binary format, requires `.proto` schema file**
- Google's internal format, open-sourced
- Smallest size, fastest serialization of any general format
- Strongly typed: schema enforced at compile time
- Schema evolution: fields are numbered, not named — adding field #4 doesn't break readers expecting fields 1-3
- Best for: gRPC services, cross-team APIs where both teams are managed (schema contract required), high-throughput cross-service messaging

> [!info] Protobuf schema example
>
> ```protobuf
> message OHLCVRecord {
>   string symbol = 1;
>   string trade_date = 2;
>   double close_price = 3;
>   int64 volume = 4;
> }
> ```
> Fields are identified by their number (1, 2, 3), not their name. You can rename a field without breaking backward compatibility. You can add new fields without breaking old readers (they ignore unknown field numbers).

### Avro

- **Binary format, schema embedded in the file/message**
- The standard for Kafka streaming pipelines
- Schema evolution: readers can use a different schema version than writers — field additions and removals are handled gracefully
- Schema registry: Confluent Schema Registry tracks Avro schema versions for Kafka topics
- Best for: Kafka message payloads, data lake ingestion where schema evolves over time, any streaming system where schema drift is expected

### Parquet

- **Binary, columnar format, schema embedded**
- See parquet files for detailed coverage
- Best for: analytical queries, data lakes, pipelines that need fast column-selective reads
- Used by BigQuery external tables, Spark, Hive, Presto, Snowflake, DuckDB
- For reading and writing Parquet in Python, see [10_py_serialization_formats](https://alp78.github.io/elysium/02-Programming-Languages/Python/10_py_serialization_formats); for C#, see [10_cs_serialization_formats](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/10_cs_serialization_formats); for lower-level file I/O patterns, see [09_py_fileio_serialization](https://alp78.github.io/elysium/02-Programming-Languages/Python/09_py_fileio_serialization)

> [!warning] Parquet Row Group Sizing
>
> Row groups that are too small (1,000 rows) create excessive metadata
> overhead — each row group has its own statistics, column chunks, and
> page headers. Row groups that are too large (100M rows) prevent
> effective predicate pushdown — the query must scan the entire group
> even if only 1% of rows match the filter. Target 128 MB per row group
> (Parquet default) or 50K-1M rows for typical financial datasets.

### Pickle

- **Python-specific binary format**
- Fastest Python object serialization — saves any Python object including custom classes
- No cross-language support
- **Security risk**: `pickle.load()` on untrusted data executes arbitrary code — it's a known remote code execution vector

> [!warning] Never Unpickle Untrusted Data
> `pickle.load()` can execute arbitrary Python code. If an attacker controls a `.pkl` file you load, they own your process. Only use Pickle for Python-to-Python workflows where you control both the writer and the reader and the data never travels over a network or through untrusted storage.

> [!danger] Pickle Arbitrary Code Execution
>
> `pickle.loads(untrusted_bytes)` can execute ARBITRARY Python code.
> A crafted pickle payload can `import os; os.system('rm -rf /')`.
> This is not a theoretical risk — it is trivially exploitable.
> NEVER use pickle for: inter-system communication, user-uploaded files,
> data from external APIs, or any source you don't fully control.
> Pickle is safe ONLY for Python-to-Python within a single trusted system
> (e.g., caching intermediate pipeline results on the same machine).

---

### Compression Codec Comparison

Compression is orthogonal to format — most formats support multiple codecs. Choose based on the dominant constraint. For a deeper treatment of [compression](https://alp78.github.io/elysium/01-Shell/File-Operations/compression) algorithms (snappy, gzip, zstd, lz4) and their trade-offs beyond serialization, see the dedicated compression note.

| Codec | Compress Speed | Decompress Speed | Ratio | Best For |
|---|---|---|---|---|
| None | Instant | Instant | 1x | Debugging, already-compressed data |
| Snappy | Very fast | Very fast | 1.5-2x | Parquet default, streaming |
| LZ4 | Very fast | Fastest | 1.5-2x | Real-time processing |
| Zstd | Fast | Fast | 2-4x | Best overall for storage |
| Gzip | Slow | Moderate | 2-3x | Maximum compatibility |

> [!tip] Compression Recommendations
> - **New Parquet files** → Zstd (best ratio, still fast, growing support)
> - **Kafka messages** → Snappy or LZ4 (latency-sensitive — compress/decompress speed matters)
> - **Maximum compatibility** → Gzip (every tool supports it)
> - **Already compressed** → None (JPEG, ZIP, already-Parquet — compressing twice wastes CPU)

---

## Related Notes

- [CSV processing with awk](https://alp78.github.io/elysium/01-Shell/Text-Processing/awk-data-processing) — Practical JSON and CSV processing in Bash, Python, PowerShell
- parquet files — Parquet inspection, CSV↔Parquet conversion, partitioning and clustering
- [date-and-time-handling](https://alp78.github.io/elysium/01-Shell/Text-Processing/date-and-time-handling) — Date formats and ISO 8601 for file naming conventions


## Related
- [data-flow-architecture](https://alp78.github.io/elysium/14-Data-Architecture/Pipeline-Patterns/data-flow-architecture) — format selection matrix by pipeline scenario and data movement topology

## References

- [Apache Parquet format](https://parquet.apache.org/)
- [Apache Avro specification](https://avro.apache.org/docs/current/spec.html)
- [Protocol Buffers (Protobuf)](https://protobuf.dev/)
- [MessagePack](https://msgpack.org/)
- [Zstd compression](https://facebook.github.io/zstd/)
