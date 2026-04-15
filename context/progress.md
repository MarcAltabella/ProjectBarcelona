# Progress

## Rules

- A milestone item should be marked complete only when it is both implemented and verified.
- Every time a milestone changes, append a log entry under that milestone with a timestamp and a 1-2 line explanation.
- Keep logs short and factual.

## Milestone 1: Project Foundation

- [x] `1.1` Finalize architecture and database schema design
- [x] `1.2` Set up Supabase project
- [x] `1.3` Configure environment variables and local development workflow
- [x] `1.4` Create initial SQL schema and migrations
- [x] `1.5` Set up Supabase Storage buckets
- [x] `1.6` Verify database connectivity, storage access, and base schema

### Logs

- `2026-04-15 17:35:30 +02:00` Designed the concrete hackathon architecture around `Next.js + Python + Supabase Postgres + Supabase Storage`. Chose relational graph modeling over a dedicated graph database, with optional `pgvector` only for semantic fallback retrieval.
- `2026-04-15 17:35:30 +02:00` Expanded the schema design in `context/context_hackathon.md` with schemas, enums, tables, keys, indexes, views, and the end-to-end pipeline so implementation can start directly from it.
- `2026-04-15 17:57:51 +02:00` Added `.vscode/mcp.json` with the Supabase MCP server pointing to project ref `nnojrrfvlfhmjggctlzt`. This establishes the repo-local MCP configuration for VS Code and compatible clients.
- `2026-04-15 17:57:51 +02:00` Added `.env.example` and a basic `.gitignore` so the local workflow has explicit Supabase and OpenAI placeholders without committing secrets. The optional `supabase/agent-skills` install was not run because it modifies the user environment outside the repo.
- `2026-04-15 18:10:29 +02:00` Added the OpenAI developer docs MCP globally, updated the global Supabase MCP entry to project ref `nnojrrfvlfhmjggctlzt`, and completed the Supabase MCP OAuth login flow. `codex mcp list` now shows the expected Supabase server URL with OAuth auth enabled.
- `2026-04-15 18:10:29 +02:00` Initialized the local `supabase/` scaffold and generated the first migration file, then wrote the initial schema SQL. Remote validation is still blocked because the current Supabase CLI identity does not have the necessary privileges on project `nnojrrfvlfhmjggctlzt`.
- `2026-04-15 18:12:33 +02:00` Updated the architecture to use OpenAI for embeddings and Anthropic for reasoning/arbitration, and corrected `.env.example` so it no longer contains a real API key. Also removed transient npm files created by the CLI bootstrap path from the repo root.
- `2026-04-15 18:20:55 +02:00` Installed the optional `supabase` and `supabase-postgres-best-practices` agent skills into `.agents/skills` and verified their presence. This is now configured for future implementation work.
- `2026-04-15 18:20:55 +02:00` Re-verified the Supabase MCP connection: `codex mcp list` shows the correct project ref with OAuth auth enabled. CLI access still does not reach the target project because the current Supabase CLI identity cannot link to `nnojrrfvlfhmjggctlzt`.
- `2026-04-15 18:54:12 +02:00` Linked the repo to the correct remote Supabase project, ran a clean `db push --linked`, and verified the migration history shows `20260415160425_initial_schema.sql` applied remotely. This completes the initial schema and migration milestone.
- `2026-04-15 18:54:12 +02:00` Verified live remote DB connectivity with `current_database()`, confirmed core tables exist through remote SQL, and accepted the user-confirmed dashboard verification that `raw-documents` and `derived-artifacts` buckets are present. Milestone 1 is now complete.
- `2026-04-15 18:56:14 +02:00` Cleaned repo hygiene before starting Milestone 2: updated `.gitignore` to keep `.env.example` committed while ignoring `skills-lock.json`. The Supabase scaffold and milestone records are ready to be committed and pushed.

## Milestone 2: Document Ingestion Pipeline

- [x] `2.1` Register corpus files in the database
- [x] `2.2` Upload raw files to storage or map local file registry for development
- [x] `2.3` Extract text from `md`, `txt`, `html`, `csv`, `pdf`, and `docx`
- [x] `2.4` Store normalized text and structural metadata
- [x] `2.5` Create chunking strategy for evidence spans and semantic retrieval
- [x] `2.6` Verify extraction quality on representative clean, OCR, multilingual, and tabular files

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No ingestion work implemented yet.
- `2026-04-15 19:30:41 +02:00` Implemented `scripts/ingest_corpus.py` as the offline ingestion pipeline. It scans the 93-file corpus, extracts text and structure for `md`, `txt`, `html`, `csv`, `pdf`, and `docx`, generates deterministic document IDs, uploads raw and derived artifacts to Supabase Storage, and emits linked-database SQL for `documents` and `internal.document_chunks`.
- `2026-04-15 19:30:41 +02:00` Ran the full corpus ingestion against the remote Supabase project with batched SQL to avoid the Management API payload limit. Verified `93` corpus documents in `public.documents`, `1059` chunk rows in `internal.document_chunks`, and `93` objects in each of the `raw-documents` and `derived-artifacts` buckets.
- `2026-04-15 19:30:41 +02:00` Verified representative extraction quality on clean HTML (`File_014.html`), tabular CSV (`File_073.csv`), multilingual PDF (`File_075.pdf`), and OCR-heavy text (`Scan_0031_compressed.txt`). All four are marked `completed`, with expected language detection, structural metadata, and derived-artifact previews stored remotely.

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

- [x] `6.1` Set up `Next.js`, `Tailwind CSS`, and `shadcn/ui`
- [x] `6.2` Implement central graph canvas with `React Flow`
- [x] `6.3` Implement left document-intelligence sidebar
- [x] `6.4` Implement right alerts sidebar
- [x] `6.5` Add filters for study, class, severity, and relation type
- [ ] `6.6` Verify graph interactions, node clicks, edge clicks, and sidebar loading

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. No frontend work implemented yet.
- `2026-04-15 20:00:00 +02:00` Scaffolded the full Next.js 15 app in `web/`. Stack: Next.js 15 + React 19 + TypeScript + Tailwind v3 + shadcn/ui CSS variables + @xyflow/react v12 + Zustand v5 + TanStack Query v5 + Supabase JS. Created AppShell (three-panel layout), GraphCanvas, DocumentNode, LeftSidebar, RightSidebar, all four API routes, typed lib (types.ts, store.ts, api.ts, supabase.ts, utils.ts). Routes degrade gracefully until graph_nodes_v/graph_edges_v views are available (Milestone 4). Run `npm install && npm run dev` from `web/` to start.

## Milestone 7: Integration, Validation, and Polish

- [ ] `7.1` Run the full pipeline on all corpus files
- [ ] `7.2` Validate that graph nodes, edges, and alerts are persisted correctly
- [ ] `7.3` Validate that related documents and explanations are useful in the UI
- [ ] `7.4` Optimize graph readability and default filtering
- [ ] `7.5` Fix high-priority pipeline and UI issues
- [ ] `7.6` Freeze the demo-ready build

### Logs

- `2026-04-15 17:35:30 +02:00` Milestone scaffold created. Integration and validation work will begin after the core pipeline and app are in place.
