# Progress

## Rules

- A milestone item should be marked complete only when it is both implemented and verified.
- Every time a milestone changes, append a log entry under that milestone with a timestamp and a 1-2 line explanation.
- Keep logs short and factual.

## Milestone 1: Project Foundation

- [x] `1.1` Finalize architecture and database schema design
- [ ] `1.2` Set up Supabase project
- [ ] `1.3` Configure environment variables and local development workflow
- [ ] `1.4` Create initial SQL schema and migrations
- [ ] `1.5` Set up Supabase Storage buckets
- [ ] `1.6` Verify database connectivity, storage access, and base schema

### Logs

- `2026-04-15 17:35:30 +02:00` Designed the concrete hackathon architecture around `Next.js + Python + Supabase Postgres + Supabase Storage`. Chose relational graph modeling over a dedicated graph database, with optional `pgvector` only for semantic fallback retrieval.
- `2026-04-15 17:35:30 +02:00` Expanded the schema design in `context/context_hackathon.md` with schemas, enums, tables, keys, indexes, views, and the end-to-end pipeline so implementation can start directly from it.

## Milestone 2: Document Ingestion Pipeline

- [ ] `2.1` Register corpus files in the database
- [ ] `2.2` Upload raw files to storage or map local file registry for development
- [ ] `2.3` Extract text from `md`, `txt`, `html`, `csv`, `pdf`, and `docx`
- [ ] `2.4` Store normalized text and structural metadata
- [ ] `2.5` Create chunking strategy for evidence spans and semantic retrieval
- [ ] `2.6` Verify extraction quality on representative clean, OCR, multilingual, and tabular files

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No ingestion work implemented yet.

## Milestone 3: Classification and Entity Extraction

- [ ] `3.1` Implement study relevance detection
- [ ] `3.2` Implement internal document taxonomy classification
- [ ] `3.3` Implement entity extraction for studies, products, versions, sites, patients, safety events, regulators, and people
- [ ] `3.4` Add ambiguity handling and confidence scoring
- [ ] `3.5` Add optional LLM arbitration for low-confidence cases
- [ ] `3.6` Verify classification and extraction on edge-case documents

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No classification or entity extraction work implemented yet.

## Milestone 4: Graph and Alert Engine

- [ ] `4.1` Implement document family inference
- [ ] `4.2` Implement deterministic edge generation
- [ ] `4.3` Implement semantic related-document linking
- [ ] `4.4` Implement duplicate and near-duplicate detection
- [ ] `4.5` Implement superseded-version and contradiction detection
- [ ] `4.6` Generate alert records and graph-ready payloads
- [ ] `4.7` Verify graph quality and alert quality on representative document clusters

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No graph or alert logic implemented yet.

## Milestone 5: Backend and API Layer

- [ ] `5.1` Create backend routes for graph data
- [ ] `5.2` Create backend routes for document sidebar data
- [ ] `5.3` Create backend routes for alerts
- [ ] `5.4` Create backend routes for related-document retrieval
- [ ] `5.5` Verify API responses against the designed output contracts

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No backend or API implementation started yet.

## Milestone 6: Frontend Graph Application

- [ ] `6.1` Set up `Next.js`, `Tailwind CSS`, and `shadcn/ui`
- [ ] `6.2` Implement central graph canvas with `React Flow`
- [ ] `6.3` Implement left document-intelligence sidebar
- [ ] `6.4` Implement right alerts sidebar
- [ ] `6.5` Add filters for study, class, severity, and relation type
- [ ] `6.6` Verify graph interactions, node clicks, edge clicks, and sidebar loading

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No frontend work implemented yet.

## Milestone 7: Integration, Validation, and Polish

- [ ] `7.1` Run the full pipeline on all corpus files
- [ ] `7.2` Validate that graph nodes, edges, and alerts are persisted correctly
- [ ] `7.3` Validate that related documents and explanations are useful in the UI
- [ ] `7.4` Optimize graph readability and default filtering
- [ ] `7.5` Fix high-priority pipeline and UI issues
- [ ] `7.6` Freeze the demo-ready build

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. Integration and validation work will begin after the core pipeline and app are in place.
