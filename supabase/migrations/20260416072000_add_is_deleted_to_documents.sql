alter table public.documents
add column if not exists is_deleted boolean;

create index if not exists idx_documents_is_deleted on public.documents (is_deleted);
