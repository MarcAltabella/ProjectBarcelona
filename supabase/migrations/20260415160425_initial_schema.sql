create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists internal;

create type public.document_class as enum (
  'CSP',
  'IB',
  'ICF',
  'CRF',
  'CSR',
  'eTMF',
  'Regulatory',
  'Synopsis',
  'Patient_Questionnaire',
  'Info_Sheet',
  'Medical_Publication',
  'NOISE'
);

create type public.internal_document_class as enum (
  'CSP_full',
  'CSP_synopsis',
  'IB',
  'ICF',
  'CRF_patient_form',
  'CSR',
  'eTMF_index',
  'eTMF_site_ops',
  'eTMF_monitoring',
  'eTMF_regulatory_correspondence',
  'DSUR',
  'DSMB_charter',
  'DSMB_minutes',
  'SmPC',
  'Ethics_approval',
  'Medical_publication',
  'Administrative_noise'
);

create type public.document_status as enum (
  'current',
  'superseded',
  'unknown'
);

create type public.relation_type as enum (
  'BELONGS_TO_STUDY',
  'ABOUT_PRODUCT',
  'HAS_DOCUMENT_TYPE',
  'IN_FAMILY',
  'SUPERSEDES',
  'SUPERSEDED_BY',
  'DUPLICATE_OF',
  'NEAR_DUPLICATE_OF',
  'REFERS_TO',
  'MENTIONS_SITE',
  'MENTIONS_PATIENT',
  'MENTIONS_SAFETY_EVENT',
  'ISSUED_BY',
  'SENT_TO',
  'APPROVES',
  'IMPLEMENTS_AMENDMENT',
  'RELATED_TO',
  'CONTRADICTS',
  'HAS_ALERT'
);

create type public.entity_type as enum (
  'Study',
  'Product',
  'DocumentFamily',
  'Version',
  'Site',
  'Patient',
  'SafetyEvent',
  'RegulatoryBody',
  'Country',
  'Person',
  'ArtifactType'
);

create type public.alert_type as enum (
  'LOW_CONFIDENCE_CLASSIFICATION',
  'AMBIGUOUS_CLASSIFICATION',
  'SUPERSEDED_DOCUMENT',
  'DUPLICATE_DOCUMENT',
  'NEAR_DUPLICATE_DOCUMENT',
  'CONTRADICTION',
  'MISSING_EXPECTED_LINK',
  'SUSPICIOUS_NOISE',
  'ISOLATED_DOCUMENT'
);

create type public.alert_severity as enum (
  'info',
  'warning',
  'error'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique,
  product_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studies (
  id uuid primary key default gen_random_uuid(),
  study_code text not null unique,
  study_title text,
  phase text,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_families (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies(id) on delete set null,
  family_type text not null,
  canonical_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  file_id uuid unique default gen_random_uuid(),
  file_name text not null,
  storage_path text not null unique,
  extension text,
  mime_type text,
  byte_size bigint,
  sha256 text not null,
  text_extraction_status text not null default 'pending',
  ocr_quality_score numeric(5,4),
  language text,
  study_relevance boolean not null default false,
  internal_label public.internal_document_class,
  final_label public.document_class,
  classification_confidence numeric(5,4),
  classification_explanation text,
  top_2_labels jsonb not null default '[]'::jsonb,
  document_status public.document_status not null default 'unknown',
  version_or_edition text,
  duplicate_group_id uuid,
  near_duplicate_group_id uuid,
  study_id uuid references public.studies(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  family_id uuid references public.document_families(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  canonical_value text not null,
  display_value text not null,
  normalized_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, normalized_value)
);

create table public.document_entities (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  mention_count integer not null default 1,
  confidence numeric(5,4),
  evidence_spans jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, entity_id)
);

create table public.relations (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid not null references public.documents(id) on delete cascade,
  relation_type public.relation_type not null,
  confidence numeric(5,4) not null,
  evidence_type text,
  evidence_spans jsonb not null default '[]'::jsonb,
  source_rule_or_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint relations_source_target_check check (source_document_id <> target_document_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  alert_type public.alert_type not null,
  severity public.alert_severity not null,
  title text not null,
  description text not null,
  evidence_spans jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table internal.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  raw_text text not null,
  normalized_text text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table internal.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  config_json jsonb not null default '{}'::jsonb,
  stats_json jsonb not null default '{}'::jsonb
);

create index idx_documents_sha256 on public.documents (sha256);
create index idx_documents_study_id on public.documents (study_id);
create index idx_documents_product_id on public.documents (product_id);
create index idx_documents_final_label on public.documents (final_label);
create index idx_documents_internal_label on public.documents (internal_label);
create index idx_documents_status on public.documents (document_status);

create index idx_document_families_study_id on public.document_families (study_id);
create index idx_document_families_family_type on public.document_families (family_type);

create index idx_entities_type_normalized on public.entities (entity_type, normalized_value);
create index idx_document_entities_document_id on public.document_entities (document_id);
create index idx_document_entities_entity_id on public.document_entities (entity_id);

create index idx_relations_source on public.relations (source_document_id);
create index idx_relations_target on public.relations (target_document_id);
create index idx_relations_type on public.relations (relation_type);
create index idx_relations_confidence on public.relations (confidence desc);

create index idx_alerts_document_id on public.alerts (document_id);
create index idx_alerts_severity on public.alerts (severity);
create index idx_alerts_type on public.alerts (alert_type);
create index idx_alerts_status on public.alerts (status);

create index idx_studies_product_id on public.studies (product_id);

create index idx_document_chunks_document_id on internal.document_chunks (document_id);
create index idx_document_chunks_document_page on internal.document_chunks (document_id, page_number);
create index idx_document_chunks_embedding on internal.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create trigger set_studies_updated_at
before update on public.studies
for each row
execute function public.set_updated_at();

create trigger set_document_families_updated_at
before update on public.document_families
for each row
execute function public.set_updated_at();

create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

create trigger set_entities_updated_at
before update on public.entities
for each row
execute function public.set_updated_at();

create trigger set_alerts_updated_at
before update on public.alerts
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.studies enable row level security;
alter table public.document_families enable row level security;
alter table public.documents enable row level security;
alter table public.entities enable row level security;
alter table public.document_entities enable row level security;
alter table public.relations enable row level security;
alter table public.alerts enable row level security;

create or replace view public.graph_nodes_v
with (security_invoker = true) as
select
  d.id as node_id,
  'Document'::text as node_type,
  d.file_name as label,
  coalesce(s.study_code, 'unassigned') as group_key,
  d.id as document_id,
  d.study_id,
  d.final_label as document_class,
  d.document_status,
  count(a.id)::int as alert_count,
  max(a.severity::text) as max_alert_severity
from public.documents d
left join public.studies s on s.id = d.study_id
left join public.alerts a on a.document_id = d.id and a.status = 'open'
group by d.id, d.file_name, s.study_code, d.study_id, d.final_label, d.document_status;

create or replace view public.graph_edges_v
with (security_invoker = true) as
select
  r.id as edge_id,
  r.source_document_id as source,
  r.target_document_id as target,
  r.relation_type,
  r.confidence,
  r.relation_type::text as label
from public.relations r;

create or replace view public.document_sidebar_v
with (security_invoker = true) as
select
  d.id as document_id,
  d.file_name,
  d.storage_path,
  d.final_label,
  d.internal_label,
  d.classification_confidence,
  d.classification_explanation,
  d.top_2_labels,
  d.study_relevance,
  d.language,
  d.version_or_edition,
  d.document_status,
  d.duplicate_group_id,
  d.near_duplicate_group_id,
  s.study_code,
  p.product_name,
  count(distinct r.id)::int as relation_count,
  count(distinct a.id)::int as alert_count
from public.documents d
left join public.studies s on s.id = d.study_id
left join public.products p on p.id = d.product_id
left join public.relations r on r.source_document_id = d.id or r.target_document_id = d.id
left join public.alerts a on a.document_id = d.id and a.status = 'open'
group by
  d.id,
  d.file_name,
  d.storage_path,
  d.final_label,
  d.internal_label,
  d.classification_confidence,
  d.classification_explanation,
  d.top_2_labels,
  d.study_relevance,
  d.language,
  d.version_or_edition,
  d.document_status,
  d.duplicate_group_id,
  d.near_duplicate_group_id,
  s.study_code,
  p.product_name;

create or replace view public.alerts_sidebar_v
with (security_invoker = true) as
select
  a.id as alert_id,
  a.document_id,
  d.file_name,
  a.severity,
  a.alert_type,
  a.title,
  a.description,
  s.study_code,
  d.final_label
from public.alerts a
join public.documents d on d.id = a.document_id
left join public.studies s on s.id = d.study_id
where a.status = 'open';

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('raw-documents', 'raw-documents', false, 52428800),
  ('derived-artifacts', 'derived-artifacts', false, 52428800)
on conflict (id) do nothing;
