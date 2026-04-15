-- Allow anonymous read access to all public tables and views for the frontend
create policy "anon_read_documents" on public.documents for select to anon using (true);
create policy "anon_read_studies" on public.studies for select to anon using (true);
create policy "anon_read_products" on public.products for select to anon using (true);
create policy "anon_read_entities" on public.entities for select to anon using (true);
create policy "anon_read_document_entities" on public.document_entities for select to anon using (true);
create policy "anon_read_relations" on public.relations for select to anon using (true);
create policy "anon_read_alerts" on public.alerts for select to anon using (true);
create policy "anon_read_document_families" on public.document_families for select to anon using (true);
