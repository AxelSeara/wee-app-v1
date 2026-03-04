-- Wee v6: global user auth + multi-community memberships (Netflix-like picker)
-- Run after community_v5.sql

create extension if not exists pgcrypto;

create table if not exists public.global_users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  username text not null unique,
  username_norm text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.global_users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','left','kicked')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_profiles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.global_users(id) on delete cascade,
  community_user_id uuid not null unique references public.community_users(id) on delete cascade,
  display_name text not null,
  display_name_norm text not null,
  avatar_url text,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  unique (community_id, user_id),
  unique (community_id, display_name_norm)
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.global_users(id) on delete cascade,
  default_community_id uuid references public.communities(id) on delete set null,
  skip_picker boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.global_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.global_users(id) on delete cascade,
  session_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists global_sessions_user_idx on public.global_sessions(user_id, expires_at desc);

alter table if exists public.community_users add column if not exists global_user_id uuid references public.global_users(id) on delete set null;

-- Backfill global users from existing community_users.
with ranked as (
  select
    cu.id as community_user_id,
    cu.community_id,
    coalesce(nullif(cu.alias, ''), 'user') as base_alias,
    regexp_replace(lower(coalesce(nullif(cu.alias,''), 'user')), '\s+', ' ', 'g') as alias_norm,
    row_number() over (
      partition by regexp_replace(lower(coalesce(nullif(cu.alias,''), 'user')), '\s+', ' ', 'g')
      order by cu.created_at, cu.id
    ) as alias_seq
  from public.community_users cu
),
usernames as (
  select
    community_user_id,
    community_id,
    case
      when alias_seq = 1 then alias_norm
      else alias_norm || '-' || alias_seq::text
    end as username
  from ranked
)
insert into public.global_users (id, username, username_norm, password_hash, created_at)
select
  gen_random_uuid(),
  u.username,
  u.username,
  '',
  now()
from usernames u
left join public.community_users cu on cu.id = u.community_user_id
where cu.global_user_id is null
on conflict (username_norm) do nothing;

-- Link each community_user -> global_user and create membership/profile rows.
with pick_user as (
  select
    cu.id as community_user_id,
    cu.community_id,
    coalesce(nullif(cu.alias, ''), 'user') as alias,
    regexp_replace(lower(coalesce(nullif(cu.alias,''), 'user')), '\s+', ' ', 'g') as alias_norm,
    row_number() over (
      partition by regexp_replace(lower(coalesce(nullif(cu.alias,''), 'user')), '\s+', ' ', 'g')
      order by cu.created_at, cu.id
    ) as alias_seq
  from public.community_users cu
  where cu.global_user_id is null
),
resolved as (
  select
    p.community_user_id,
    p.community_id,
    p.alias,
    case
      when p.alias_seq = 1 then p.alias_norm
      else p.alias_norm || '-' || p.alias_seq::text
    end as username_norm
  from pick_user p
)
update public.community_users cu
set global_user_id = gu.id
from resolved r
join public.global_users gu on gu.username_norm = r.username_norm
where cu.id = r.community_user_id
  and cu.global_user_id is null;

insert into public.community_members (community_id, user_id, status, joined_at)
select cu.community_id, cu.global_user_id, 'active', coalesce(cu.created_at, now())
from public.community_users cu
where cu.global_user_id is not null
on conflict (community_id, user_id) do nothing;

insert into public.community_profiles (
  community_id,
  user_id,
  community_user_id,
  display_name,
  display_name_norm,
  avatar_url,
  language,
  created_at
)
select
  cu.community_id,
  cu.global_user_id,
  cu.id,
  coalesce(nullif(cu.alias, ''), 'user'),
  regexp_replace(lower(coalesce(nullif(cu.alias,''), 'user')), '\s+', ' ', 'g'),
  cu.avatar_url,
  coalesce(cu.language, 'es'),
  coalesce(cu.created_at, now())
from public.community_users cu
where cu.global_user_id is not null
on conflict (community_id, user_id) do nothing;

-- RLS: deny direct browser access (Edge Function service-role path only).
alter table public.global_users enable row level security;
alter table public.community_members enable row level security;
alter table public.community_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.global_sessions enable row level security;

drop policy if exists global_users_no_access on public.global_users;
create policy global_users_no_access on public.global_users for all using (false) with check (false);
drop policy if exists community_members_no_access on public.community_members;
create policy community_members_no_access on public.community_members for all using (false) with check (false);
drop policy if exists community_profiles_no_access on public.community_profiles;
create policy community_profiles_no_access on public.community_profiles for all using (false) with check (false);
drop policy if exists user_settings_no_access on public.user_settings;
create policy user_settings_no_access on public.user_settings for all using (false) with check (false);
drop policy if exists global_sessions_no_access on public.global_sessions;
create policy global_sessions_no_access on public.global_sessions for all using (false) with check (false);

