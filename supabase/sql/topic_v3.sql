-- Topic v3 fields (non-breaking)
alter table if exists public.posts
  add column if not exists topic_v2 text,
  add column if not exists topic_candidates_v2 jsonb,
  add column if not exists topic_explanation_v2 jsonb,
  add column if not exists topic_version text;

create index if not exists posts_topic_v2_idx on public.posts (topic_v2);
create index if not exists posts_topic_version_idx on public.posts (topic_version);
