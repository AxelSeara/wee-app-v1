-- Cache for metadata unfurl (Edge Function `unfurl`)

create table if not exists public.link_metadata_cache (
  canonical_url text primary key,
  final_url text,
  title text,
  description text,
  image_url text,
  site_name text,
  status_code int,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create index if not exists link_metadata_cache_expires_at_idx
  on public.link_metadata_cache (expires_at);

alter table public.link_metadata_cache enable row level security;

-- Clients do not need direct access; Edge Function uses service role.
drop policy if exists "link_metadata_cache_no_select" on public.link_metadata_cache;
drop policy if exists "link_metadata_cache_no_insert" on public.link_metadata_cache;
drop policy if exists "link_metadata_cache_no_update" on public.link_metadata_cache;
drop policy if exists "link_metadata_cache_no_delete" on public.link_metadata_cache;

create policy "link_metadata_cache_no_select"
on public.link_metadata_cache
for select
using (false);

create policy "link_metadata_cache_no_insert"
on public.link_metadata_cache
for insert
with check (false);

create policy "link_metadata_cache_no_update"
on public.link_metadata_cache
for update
using (false)
with check (false);

create policy "link_metadata_cache_no_delete"
on public.link_metadata_cache
for delete
using (false);
