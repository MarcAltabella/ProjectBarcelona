# Hackathon Context

## Summary

The end product is not just a classifier. The end product is an interactive document intelligence graph.

The center of the product should be a graph that shows all relevant documents and the relationships between them. Classification exists to support graph quality, navigation, alerts, and explanation. The system should ingest the full corpus, classify each document, extract entities and relationships, detect issues, and expose all of that through a graph-first UI.

### Product shape

- Center: interactive graph of files, entities, versions, and relationships
- Left sidebar: document details when a file is clicked
- Right sidebar: alerts, warnings, contradictions, outdated versions, duplicates, low-confidence classifications, and missing-linked-document signals

### Source-of-truth assumptions

- Use the actual folder contents as the working corpus: `93` files
- Normalize all formats, including `pdf` and `docx`
- Treat filenames as weak evidence only
- Treat out-of-study but clinically worded documents as `NOISE` unless judging later says otherwise
- Optimize for explainability and relationship discovery, not only label accuracy

## Product Goal

The graph should answer questions like:

- Which documents belong to the same study?
- Which files are different versions of the same artifact?
- Which files refer to the same product, protocol, amendment, site, patient, safety event, or submission?
- Which documents are likely outdated, duplicated, contradictory, or misfiled?
- Which documents are most related to the currently selected file?

The system should let a user click any file and immediately understand:

- what the file most likely is
- why it was classified that way
- which other files it connects to
- whether it creates risk or requires review

## Tech Stack

### Database decision

We do **not** need a dedicated graph database for the hackathon build.

We also do **not** need a separate vector database product.

The recommended setup is:

- **Primary database:** `Supabase Postgres`
- **Vector storage if needed:** `pgvector` inside Supabase Postgres
- **File storage:** `Supabase Storage`
- **Frontend graph rendering:** `React Flow`

### Why this is the right choice

- The corpus is small enough that a graph database adds complexity without a clear payoff
- The graph can be modeled cleanly with relational tables plus explicit edge tables
- Semantic retrieval is useful, but it does not justify a separate vector database for hackathon scope
- Supabase gives us Postgres, storage, APIs, auth if needed, and optional vector search in one place
- This keeps the architecture easier to build, debug, explain, and demo

### Application stack

- Frontend: `Next.js App Router` with TypeScript
- UI components: `shadcn/ui`
- Graph visualization: `React Flow` for controlled node-edge rendering and sidebar integration
- Styling: `Tailwind CSS`
- Data fetching: `TanStack Query`
- Client state: `Zustand` for graph filters, active node, sidebar state, and alert filters
- Backend/API: `Next.js` route handlers for the app API surface

### Intelligence stack

- Document processing: `Python 3.11`
- PDF extraction: `pdftotext`
- DOCX extraction: Python `zipfile` and XML parsing, with `python-docx` optional if needed
- HTML parsing: `BeautifulSoup`
- CSV parsing: Python `csv` and `pandas`
- Similarity and retrieval: `scikit-learn` TF-IDF baseline plus optional embeddings
- Database writes from pipeline: `psycopg` or `supabase-py`
- Embeddings: OpenAI API for text-to-embedding only
- Reasoning and arbitration: Anthropic model for hard classification and relation-resolution cases only

### Database stack

- Database: `Supabase Postgres`
- Extension: `pgvector` for semantic similarity only if we decide to store embeddings
- Storage: `Supabase Storage`
- Structured queries: standard SQL
- Graph representation: explicit `nodes` and `edges` tables or graph-oriented relational tables
- API access from app: `@supabase/supabase-js`

### Data and graph representation

- Primary system of record: Supabase tables
- Primary graph format for UI: JSON node-edge payloads generated from database records
- Output artifacts: normalized document records, graph payload, alerts payload, evidence payload

### Why this stack

- `Next.js` keeps the demo app, API surface, and deploy path simple
- `React Flow` is fast enough for a graph-centric demo and easier to control than a heavier graph database UI
- `Python` is the practical choice for heterogeneous file parsing and extraction
- `Supabase Postgres` is enough to represent the graph cleanly without introducing graph database overhead
- `pgvector` inside Supabase is enough if we need semantic related-document lookup
- OpenAI is reserved for embeddings, not for the whole pipeline
- Anthropic is reserved for reasoning-heavy arbitration, not for the whole pipeline

## Concrete Database Design

### Supabase Storage buckets

- `raw-documents`
  - original uploaded corpus files
- `derived-artifacts`
  - extracted text, normalized text, graph payload exports, and debug artifacts

### Postgres extensions

- `pgcrypto`
  - for UUID generation and hashing utilities
- `vector`
  - only if we enable embeddings for semantic fallback retrieval

### Database schemas

- `public`
  - only frontend-safe read models and API-facing tables/views
- `internal`
  - pipeline-owned raw text, chunks, evidence, and operational tables

### Access model

- The Python pipeline writes using the Supabase `service_role`
- The Next.js server reads from `public`
- Raw extracted text and chunk payloads stay in `internal`
- `public` should expose only graph-safe, sidebar-safe, and alert-safe data
- `internal` should not be exposed to the browser

### Core enums

#### `public.document_class`

- `CSP`
- `IB`
- `ICF`
- `CRF`
- `CSR`
- `eTMF`
- `Regulatory`
- `Synopsis`
- `Patient_Questionnaire`
- `Info_Sheet`
- `Medical_Publication`
- `NOISE`

#### `public.internal_document_class`

- `CSP_full`
- `CSP_synopsis`
- `IB`
- `ICF`
- `CRF_patient_form`
- `CSR`
- `eTMF_index`
- `eTMF_site_ops`
- `eTMF_monitoring`
- `eTMF_regulatory_correspondence`
- `DSUR`
- `DSMB_charter`
- `DSMB_minutes`
- `SmPC`
- `Ethics_approval`
- `Medical_publication`
- `Administrative_noise`

#### `public.document_status`

- `current`
- `superseded`
- `unknown`

#### `public.relation_type`

- `BELONGS_TO_STUDY`
- `ABOUT_PRODUCT`
- `HAS_DOCUMENT_TYPE`
- `IN_FAMILY`
- `SUPERSEDES`
- `SUPERSEDED_BY`
- `DUPLICATE_OF`
- `NEAR_DUPLICATE_OF`
- `REFERS_TO`
- `MENTIONS_SITE`
- `MENTIONS_PATIENT`
- `MENTIONS_SAFETY_EVENT`
- `ISSUED_BY`
- `SENT_TO`
- `APPROVES`
- `IMPLEMENTS_AMENDMENT`
- `RELATED_TO`
- `CONTRADICTS`
- `HAS_ALERT`

#### `public.entity_type`

- `Study`
- `Product`
- `DocumentFamily`
- `Version`
- `Site`
- `Patient`
- `SafetyEvent`
- `RegulatoryBody`
- `Country`
- `Person`
- `ArtifactType`

#### `public.alert_type`

- `LOW_CONFIDENCE_CLASSIFICATION`
- `AMBIGUOUS_CLASSIFICATION`
- `SUPERSEDED_DOCUMENT`
- `DUPLICATE_DOCUMENT`
- `NEAR_DUPLICATE_DOCUMENT`
- `CONTRADICTION`
- `MISSING_EXPECTED_LINK`
- `SUSPICIOUS_NOISE`
- `ISOLATED_DOCUMENT`

#### `public.alert_severity`

- `info`
- `warning`
- `error`

### Core tables

#### `documents`

One row per file.

Schema: `public.documents`

Primary purpose:

- canonical document record for the UI and graph

Key columns:

- `id`
- `file_id`
- `file_name`
- `storage_path`
- `extension`
- `mime_type`
- `byte_size`
- `sha256`
- `text_extraction_status`
- `ocr_quality_score`
- `language`
- `study_relevance`
- `internal_label`
- `final_label`
- `classification_confidence`
- `classification_explanation`
- `top_2_labels`
- `document_status`
- `version_or_edition`
- `duplicate_group_id`
- `near_duplicate_group_id`
- `study_id`
- `product_id`
- `created_at`
- `updated_at`

Recommended types and constraints:

- `id uuid primary key default gen_random_uuid()`
- `file_name text not null`
- `storage_path text not null unique`
- `sha256 text not null`
- `study_relevance boolean not null default false`
- `internal_label public.internal_document_class`
- `final_label public.document_class`
- `classification_confidence numeric(5,4)`
- `document_status public.document_status not null default 'unknown'`

Indexes:

- `idx_documents_sha256`
- `idx_documents_study_id`
- `idx_documents_final_label`
- `idx_documents_internal_label`
- `idx_documents_status`

#### `document_chunks`

Chunked content for semantic retrieval and evidence linking.

Schema: `internal.document_chunks`

Key columns:

- `id`
- `document_id`
- `chunk_index`
- `page_number`
- `raw_text`
- `normalized_text`
- `embedding` using `vector` only if embeddings are enabled

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `document_id uuid not null references public.documents(id) on delete cascade`
- `chunk_index integer not null`
- `page_number integer`
- `raw_text text not null`
- `normalized_text text not null`
- `embedding vector(1536)` only if OpenAI embeddings are used

Indexes:

- `idx_document_chunks_document_id`
- `idx_document_chunks_document_page`
- `idx_document_chunks_embedding` using HNSW only if embeddings are enabled

#### `document_families`

Families like protocol family, consent family, IB family.

Schema: `public.document_families`

Key columns:

- `id`
- `study_id`
- `family_type`
- `canonical_name`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `study_id uuid references public.studies(id) on delete set null`
- `family_type text not null`
- `canonical_name text not null`

Indexes:

- `idx_document_families_study_id`
- `idx_document_families_family_type`

#### `entities`

Canonical entities extracted from documents.

Schema: `public.entities`

Key columns:

- `id`
- `entity_type`
- `canonical_value`
- `display_value`
- `normalized_value`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `entity_type public.entity_type not null`
- `canonical_value text not null`
- `display_value text not null`
- `normalized_value text not null`

Constraint:

- unique on `(entity_type, normalized_value)`

Indexes:

- `idx_entities_type_normalized`

Examples:

- study IDs
- products
- sites
- patients
- safety events
- regulators
- persons

#### `document_entities`

Join table between documents and entities.

Schema: `public.document_entities`

Key columns:

- `id`
- `document_id`
- `entity_id`
- `mention_count`
- `confidence`
- `evidence_spans`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `document_id uuid not null references public.documents(id) on delete cascade`
- `entity_id uuid not null references public.entities(id) on delete cascade`
- `mention_count integer not null default 1`
- `confidence numeric(5,4)`
- `evidence_spans jsonb`

Constraint:

- unique on `(document_id, entity_id)`

Indexes:

- `idx_document_entities_document_id`
- `idx_document_entities_entity_id`

#### `relations`

Graph edge table.

Schema: `public.relations`

Key columns:

- `id`
- `source_document_id`
- `target_document_id`
- `relation_type`
- `confidence`
- `evidence_type`
- `evidence_spans`
- `source_rule_or_model`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `source_document_id uuid not null references public.documents(id) on delete cascade`
- `target_document_id uuid not null references public.documents(id) on delete cascade`
- `relation_type public.relation_type not null`
- `confidence numeric(5,4) not null`
- `evidence_type text`
- `evidence_spans jsonb`
- `source_rule_or_model text not null`

Constraint:

- check `source_document_id <> target_document_id`

Indexes:

- `idx_relations_source`
- `idx_relations_target`
- `idx_relations_type`
- `idx_relations_confidence`

#### `alerts`

All warnings and risk items shown in the right sidebar.

Schema: `public.alerts`

Key columns:

- `id`
- `document_id`
- `alert_type`
- `severity`
- `title`
- `description`
- `evidence_spans`
- `status`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `document_id uuid not null references public.documents(id) on delete cascade`
- `alert_type public.alert_type not null`
- `severity public.alert_severity not null`
- `title text not null`
- `description text not null`
- `evidence_spans jsonb`
- `status text not null default 'open'`

Indexes:

- `idx_alerts_document_id`
- `idx_alerts_severity`
- `idx_alerts_type`
- `idx_alerts_status`

#### `studies`

Canonical study records.

Schema: `public.studies`

Key columns:

- `id`
- `study_code`
- `study_title`
- `phase`
- `product_id`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `study_code text not null unique`
- `study_title text`
- `phase text`
- `product_id uuid references public.products(id) on delete set null`

Indexes:

- `idx_studies_product_id`

#### `products`

Canonical investigational products.

Schema: `public.products`

Key columns:

- `id`
- `product_code`
- `product_name`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `product_code text unique`
- `product_name text not null`

#### `pipeline_runs`

Operational table for reproducibility.

Schema: `internal.pipeline_runs`

Key columns:

- `id`
- `run_type`
- `started_at`
- `completed_at`
- `status`
- `config_json`

Recommended types:

- `id uuid primary key default gen_random_uuid()`
- `run_type text not null`
- `started_at timestamptz not null default now()`
- `completed_at timestamptz`
- `status text not null`
- `config_json jsonb not null default '{}'::jsonb`
- `stats_json jsonb not null default '{}'::jsonb`

### Optional materialized views

- `graph_nodes_v`
- `graph_edges_v`
- `document_sidebar_v`
- `alerts_sidebar_v`

These views simplify the frontend and keep rendering logic out of the client.

### Recommended read models

#### `public.graph_nodes_v`

One row per node rendered in React Flow.

Should include:

- `node_id`
- `node_type`
- `label`
- `group_key`
- `document_id`
- `study_id`
- `document_class`
- `document_status`
- `alert_count`
- `max_alert_severity`

#### `public.graph_edges_v`

One row per rendered edge.

Should include:

- `edge_id`
- `source`
- `target`
- `relation_type`
- `confidence`
- `label`

#### `public.document_sidebar_v`

One row per document with prejoined left-sidebar data.

Should include:

- document metadata
- classification summary
- top entities
- top relation counts
- duplicate and alert summaries

#### `public.alerts_sidebar_v`

Pre-filtered alert rows for the right sidebar.

Should include:

- `alert_id`
- `document_id`
- `file_name`
- `severity`
- `alert_type`
- `title`
- `description`
- `study_code`
- `final_label`

## Graph-First Data Model

Model the corpus as a graph, not a flat table.

### Node types

- `Document`
- `Study`
- `Product`
- `DocumentFamily`
- `Version`
- `Site`
- `Patient`
- `SafetyEvent`
- `RegulatoryBody`
- `Country`
- `Person`
- `ArtifactType`

### Core node examples

- A protocol file is a `Document`
- `BIORCE-ONC-2023-001` is a `Study`
- `BRC-471 (Lumitanib)` is a `Product`
- all protocol versions for the same study belong to one `DocumentFamily`
- `ES-01` is a `Site`
- `BIORCE-SAE-2023-008` is a `SafetyEvent`

### Edge types

- `BELONGS_TO_STUDY`
- `ABOUT_PRODUCT`
- `HAS_DOCUMENT_TYPE`
- `IN_FAMILY`
- `SUPERSEDES`
- `SUPERSEDED_BY`
- `DUPLICATE_OF`
- `NEAR_DUPLICATE_OF`
- `REFERS_TO`
- `MENTIONS_SITE`
- `MENTIONS_PATIENT`
- `MENTIONS_SAFETY_EVENT`
- `ISSUED_BY`
- `SENT_TO`
- `APPROVES`
- `IMPLEMENTS_AMENDMENT`
- `RELATED_TO`
- `CONTRADICTS`
- `HAS_ALERT`

### Edge scoring

Each edge should store:

- `confidence`
- `evidence_spans`
- `evidence_type`
- `source_rule_or_model`

This matters because the UI should be able to explain why two files are connected.

## Classification as a Supporting Layer

Classification should remain in the system, but as one layer of the graph pipeline.

### Internal taxonomy

- `CSP_full`
- `CSP_synopsis`
- `IB`
- `ICF`
- `CRF_patient_form`
- `CSR`
- `eTMF_index`
- `eTMF_site_ops`
- `eTMF_monitoring`
- `eTMF_regulatory_correspondence`
- `DSUR`
- `DSMB_charter`
- `DSMB_minutes`
- `SmPC`
- `Ethics_approval`
- `Medical_publication`
- `Administrative_noise`

### Final hackathon classes

Collapse internal labels into the final hackathon labels for scoring, but keep the richer internal taxonomy in the graph. The internal label is more useful for graph edges and sidebar explanations than the coarse final label.

### Why classification still matters

Classification supports:

- graph node styling and grouping
- recommended related documents
- alert logic
- ambiguity handling
- left-sidebar explanation
- right-sidebar risk surfacing

## Extraction and Normalization Pipeline

### File ingestion

Extract text from:

- `md`
- `txt`
- `html`
- `csv`
- `pdf`
- `docx`

### Preserve structure

Retain:

- headings
- section labels
- tables
- form field names
- page markers
- repeated header/footer text
- line-level fragments that reveal OCR damage
- file extension
- document length

### OCR cleanup and normalization

Normalize:

- repeated spaces
- broken words
- OCR confusions like `0/o`, `1/i`
- corrupted accents
- study IDs
- product names
- protocol versions
- amendment numbers
- site IDs
- patient IDs
- SAE IDs

### Language detection

Track language per file and per chunk when possible, because multilingual regulatory letters and embedded foreign lab reports should still connect correctly into the graph.

## Signal Families for Building Relationships

### Strong signals for document typing

- document structure and section names
- form layout and field labels
- explicit phrases like `Investigator Brochure`, `Informed Consent Form`, `Case Report Form`, `Clinical Study Report`, `DSUR`, `DSMB Charter`
- protocol-like semantics: eligibility, endpoints, statistics, schedule of assessments
- CSR-like semantics: synopsis, efficacy, safety, discussion, conclusions
- eTMF-like semantics: filing index, monitoring, deviation log, acknowledgements, correspondence routing

### Strong signals for graph relationships

- same study ID
- same product
- same amendment number
- same version chain
- same site
- same patient code
- same SAE reference
- same vault reference or filing artifact
- explicit supersedes language
- explicit attachment/distribution language
- direct mention of another document type or edition

### Strong negative signals

- publication title-author-abstract pattern
- press release language
- CV, invoice, lease, job posting, vendor contract patterns
- unrelated study IDs or unrelated sponsor/product

These negative signals are important because they reduce false links in the graph, which is more damaging than a slightly imperfect class label.

## Relationship Extraction Strategy

### Stage 1: entity extraction

Extract from each document:

- study IDs
- product names
- protocol numbers
- amendment numbers
- version/edition numbers
- dates
- site IDs
- patient IDs
- SAE IDs
- regulatory authority names
- person names
- country and language indicators

### Stage 2: document family inference

Group documents into document families using:

- same study
- same artifact type
- similar titles or content
- version history language
- supersedes/replaces wording

Examples:

- protocol v1.0, amendment 1, amendment 2, and synopsis fax should connect within one protocol family
- ICF v2.0 and ICF v2.1 should connect within one consent family
- refiled eTMF indexes should connect as duplicates or retained re-filings

### Stage 3: edge creation

Create deterministic edges first:

- `BELONGS_TO_STUDY`
- `ABOUT_PRODUCT`
- `MENTIONS_SITE`
- `MENTIONS_PATIENT`
- `MENTIONS_SAFETY_EVENT`
- `SUPERSEDES`
- `SUPERSEDED_BY`
- `DUPLICATE_OF`

Then create probabilistic semantic edges:

- `RELATED_TO`
- `REFERS_TO`
- `IMPLEMENTS_AMENDMENT`
- `CONTRADICTS`

### Stage 4: graph confidence

Each edge should have confidence tiers:

- high confidence: explicit ID or explicit textual relationship
- medium confidence: strong semantic or structural match
- low confidence: weaker semantic similarity only

Only high and medium confidence edges should appear by default in the center graph. Low-confidence edges can appear in the left sidebar under review suggestions.

## Duplicate, Version, and Contradiction Detection

These are not side tasks. They are core graph features.

### Duplicate detection

- compute exact hashes
- compute normalized near-duplicate similarity
- compare extracted text, not just raw bytes

### Version chain detection

Parse:

- version
- edition
- amendment
- effective date
- superseded or current status
- re-file or retained-copy notes

### Contradiction detection

Flag but do not overwrite classification:

- mismatched edition in header vs footer
- impossible date logic
- mixed study IDs inside one document
- patient consent date before document version date
- internal safety or filing inconsistencies

Contradictions should become alert nodes or alert records attached to the document.

## UI Model

### Center graph

The graph should be the main canvas.

Visual grouping should support:

- by study
- by document family
- by document class
- by alert severity

Node styling should reflect:

- document class
- confidence
- noise vs in-scope
- current vs superseded
- alert severity

Edge styling should reflect:

- relationship type
- confidence
- contradiction or risk status

### Left sidebar: document intelligence panel

When clicking a file node, show:

- file name
- detected document class
- classification confidence
- brief explanation of why it got that label
- study and product detected
- version/edition/amendment
- current or superseded status
- duplicate status
- language
- key extracted entities
- top related documents
- evidence snippets supporting main edges
- top-2 candidate labels when ambiguity exists

This panel should answer: "What is this file, and how does it connect?"

### Right sidebar: alerts and warnings

This should show prioritized issues across the graph:

- superseded document still active in graph context
- low-confidence classification
- ambiguous class
- contradiction detected
- duplicate or near-duplicate
- missing expected linked document
- unrelated but clinically similar noise
- out-of-study document linked too strongly

Alerts should be filterable by:

- severity
- study
- document type
- alert type

This panel should answer: "What needs attention right now?"

## Pipeline

### Stage 0: corpus ingestion

- upload raw files to `Supabase Storage/raw-documents` or register local files during development
- create one row in `documents` per file
- compute hash, extension, mime type, and file metadata

### Stage 1: extraction

- parse every file into normalized text plus structural metadata
- store raw extracted fields and cleaned fields separately
- compute per-document parsing confidence and OCR degradation signals
- write extracted artifacts to `derived-artifacts`
- write document metadata back into `documents`
- create `document_chunks` rows

### Stage 2: document classification

- detect study relevance
- generate candidate internal classes using rules
- score classes with structure, regex, and semantic similarity
- use Anthropic model arbitration only for ambiguous cases
- write final class plus explanation and evidence spans
- persist label decisions into `documents`

### Stage 3: entity extraction

- extract studies, products, versions, sites, patients, safety events, people, regulators, and dates
- standardize all extracted entities into canonical forms
- upsert canonical entities into `entities`
- write mentions into `document_entities`
- upsert canonical studies and products into `studies` and `products`

### Stage 4: relationship building

- create deterministic edges from explicit references
- create semantic edges from similarity and shared entities
- suppress weak edges by default
- write graph edges into `relations`
- assign document families into `document_families`

### Stage 5: alert generation

- generate alerts from contradiction rules
- generate alerts from duplicates and superseded versions
- generate alerts from low-confidence or ambiguous classification
- generate alerts from suspiciously isolated or weakly connected files
- persist them into `alerts`

### Stage 6: graph payload generation

- convert documents, entities, edges, and alerts into frontend-ready JSON
- ensure every graph object can be traced back to source evidence
- optionally materialize `graph_nodes_v` and `graph_edges_v` views

### Stage 7: UI rendering

- load graph into React Flow
- render sidebars from precomputed metadata
- support node click, edge click, filtering, and alert-driven navigation

## Complete Technical Pipeline

### Offline intelligence pipeline

This is the recommended execution path for the hackathon.

- Python pipeline scans the corpus
- Python extracts, normalizes, classifies, and links documents
- Python writes all structured outputs into Supabase
- Next.js app reads already-processed graph data from Supabase

This is better than trying to classify and link files live in the browser or during every API request.

### Runtime application pipeline

When the UI loads:

- fetch graph nodes and edges from Supabase-backed API routes
- fetch alerts separately for the right sidebar
- on document click, fetch document detail payload for the left sidebar
- on graph filters, re-query only the needed subgraph

### Related-document retrieval pipeline

For "most related documents" in the left sidebar:

1. use explicit edges first
2. use shared entities second
3. use semantic similarity from `pgvector` only as fallback

This keeps retrieval explainable and avoids over-relying on opaque embedding similarity.

## API Surface

Recommended route handlers:

- `GET /api/graph`
  - returns nodes and edges for the current filters
- `GET /api/documents/:id`
  - returns full left-sidebar payload
- `GET /api/alerts`
  - returns right-sidebar alerts with filters
- `GET /api/documents/:id/related`
  - returns ranked related documents

## Recommendation Summary

### Do we need a graph database?

No. Not for this scope.

Use Supabase Postgres with explicit graph tables. It is simpler, faster to ship, and easier to explain.

### Do we need a vector database?

Not as a separate product.

Use `pgvector` inside Supabase only for fallback semantic retrieval and ambiguous related-document ranking.

### Final recommended architecture

- `Next.js` + TypeScript frontend
- `shadcn/ui` + `Tailwind CSS`
- `React Flow` for graph visualization
- `Supabase Postgres` as the main database
- `Supabase Storage` for raw and derived files
- `pgvector` only if semantic retrieval is needed
- `Python 3.11` offline pipeline for extraction, classification, entity extraction, and edge generation
- OpenAI for embeddings only
- Anthropic for hard classification or relation arbitration cases

## Output Contracts

### Document-level output

Produce one row or object per file with:

- `file_name`
- `study_relevance`
- `internal_label`
- `final_label`
- `confidence`
- `top_2_labels`
- `is_noise`
- `study_id_detected`
- `product_detected`
- `language`
- `version_or_edition`
- `document_status`
- `duplicate_group_id`
- `near_duplicate_group_id`
- `flags`
- `summary_explanation`

### Graph-level output

Produce graph-ready data with:

- `nodes`
- `edges`
- `alerts`
- `evidence_spans`

Each document node should link cleanly to the UI sidebars without extra computation at render time.

## Assumptions

- External API use is allowed, so LLM arbitration can be used for hard cases
- OpenAI is used for embeddings
- Anthropic is used for reasoning-heavy arbitration
- The graph is the main product; classification is a supporting layer
- Internal taxonomy should remain richer than the hackathon scoring labels
- If judging later clarifies different mappings for DSUR, DSMB, SmPC, ethics approvals, or monitoring documents, the collapse map changes but the graph model does not
- Accuracy, explainability, and relationship discovery matter more than implementing a heavy production-grade backend

## Database Recommendation Summary

- Use `Supabase Postgres` as the system of record
- Use `Supabase Storage` for raw and derived file assets
- Use relational graph modeling through `documents`, `entities`, `relations`, and `alerts`
- Do not add a dedicated graph database
- Add `pgvector` only if semantic fallback retrieval is needed
- Keep raw text and chunk storage in the `internal` schema
- Expose only frontend-safe read models through `public`
