-- Community multi-tenant v5 + custom auth/session
-- Run this once in Supabase SQL Editor (after previous schema migrations).

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- 1) Core community/auth tables
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules_text text,
  invite_policy text not null default 'admins_only' check (invite_policy in ('admins_only', 'members_allowed')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid
);

create table if not exists public.community_users (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  password_hash text not null,
  avatar_url text,
  language text not null default 'es' check (language in ('es', 'en', 'gl')),
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'left', 'kicked')),
  unique (community_id, normalized_alias)
);

create index if not exists community_users_community_idx on public.community_users(community_id);

create table if not exists public.community_user_roles (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.community_users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null,
  token text not null,
  created_by uuid references public.community_users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique (code),
  unique (token)
);

create index if not exists community_invites_community_idx on public.community_invites(community_id);
create index if not exists community_invites_code_upper_idx on public.community_invites(upper(code));

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.community_users(id) on delete cascade,
  session_token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists sessions_user_idx on public.sessions(user_id, community_id);
create index if not exists sessions_active_idx on public.sessions(community_id, user_id, revoked_at, expires_at);

-- 2) Ensure a default "test" community exists
with upserted as (
  insert into public.communities(name, description, rules_text, invite_policy)
  values (
    'test',
    'Comunidad migrada por v5 para pruebas',
    'Comparte enlaces útiles, añade contexto y respeta al resto.',
    'admins_only'
  )
  on conflict do nothing
  returning id
)
select 1;

-- 3) Backfill existing profiles -> community_users (preserve UUID ids)
do $$
declare
  v_test_community uuid;
begin
  select id into v_test_community
  from public.communities
  where lower(name) = 'test'
  order by created_at asc
  limit 1;

  if v_test_community is null then
    raise exception 'test community not found';
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    insert into public.community_users (
      id,
      community_id,
      alias,
      normalized_alias,
      password_hash,
      avatar_url,
      language,
      created_at,
      status
    )
    select
      p.id,
      v_test_community,
      p.alias,
      lower(regexp_replace(unaccent(p.alias), '\\s+', ' ', 'g')),
      coalesce(nullif(pp.auth_email, ''), 'migrated') || ':' || p.id::text,
      p.avatar_url,
      coalesce(pp.language, 'es'),
      p.created_at,
      'active'
    from public.profiles p
    left join public.profile_private pp on pp.user_id = p.id
    on conflict (id) do nothing;

    -- Resolve possible normalized alias collisions inside the same community.
    with ranked as (
      select
        id,
        community_id,
        normalized_alias,
        row_number() over (partition by community_id, normalized_alias order by created_at asc, id asc) as rn
      from public.community_users
      where community_id = v_test_community
    )
    update public.community_users cu
    set normalized_alias = cu.normalized_alias || '-' || ranked.rn::text,
        alias = cu.alias || ' ' || ranked.rn::text
    from ranked
    where cu.id = ranked.id
      and ranked.rn > 1;

    insert into public.community_user_roles(community_id, user_id, role)
    select
      v_test_community,
      p.id,
      case when coalesce(p.role, 'member') = 'admin' then 'admin' else 'member' end
    from public.profiles p
    on conflict (community_id, user_id) do nothing;
  end if;

  -- Ensure at least one admin in test community.
  if not exists (
    select 1 from public.community_user_roles
    where community_id = v_test_community and role = 'admin'
  ) then
    insert into public.community_user_roles(community_id, user_id, role)
    select v_test_community, cu.id, 'admin'
    from public.community_users cu
    where cu.community_id = v_test_community
    order by cu.created_at asc
    limit 1
    on conflict (community_id, user_id) do update set role = 'admin';
  end if;

  -- Ensure default invite exists.
  insert into public.community_invites(community_id, code, token, created_by, created_at)
  values (
    v_test_community,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    null,
    now()
  )
  on conflict do nothing;
end $$;

-- 4) Add tenant key to social tables + backfill
-- Helper: resolves test community id once.
create or replace function public._v5_test_community_id()
returns uuid
language sql
stable
as $$
  select id from public.communities where lower(name) = 'test' order by created_at asc limit 1;
$$;

alter table if exists public.posts add column if not exists community_id uuid;
update public.posts set community_id = public._v5_test_community_id() where community_id is null;
alter table if exists public.posts alter column community_id set not null;
alter table if exists public.posts drop constraint if exists posts_community_id_fkey;
alter table if exists public.posts add constraint posts_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.posts drop constraint if exists posts_user_id_fkey;
alter table if exists public.posts add constraint posts_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
create index if not exists posts_community_created_idx on public.posts(community_id, created_at desc);
create index if not exists posts_community_topic_idx on public.posts(community_id, topic_v2);

alter table if exists public.comments add column if not exists community_id uuid;
update public.comments c
set community_id = p.community_id
from public.posts p
where p.id = c.post_id and c.community_id is null;
alter table if exists public.comments alter column community_id set not null;
alter table if exists public.comments drop constraint if exists comments_community_id_fkey;
alter table if exists public.comments add constraint comments_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.comments drop constraint if exists comments_user_id_fkey;
alter table if exists public.comments add constraint comments_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
create index if not exists comments_community_post_created_idx on public.comments(community_id, post_id, created_at desc);

alter table if exists public.post_votes add column if not exists community_id uuid;
update public.post_votes pv
set community_id = p.community_id
from public.posts p
where p.id = pv.post_id and pv.community_id is null;
alter table if exists public.post_votes alter column community_id set not null;
alter table if exists public.post_votes drop constraint if exists post_votes_community_id_fkey;
alter table if exists public.post_votes add constraint post_votes_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.post_votes drop constraint if exists post_votes_user_id_fkey;
alter table if exists public.post_votes add constraint post_votes_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
alter table if exists public.post_votes drop constraint if exists post_votes_pkey;
alter table if exists public.post_votes add constraint post_votes_pkey primary key (community_id, post_id, user_id);

alter table if exists public.post_shares add column if not exists community_id uuid;
update public.post_shares ps
set community_id = p.community_id
from public.posts p
where p.id = ps.post_id and ps.community_id is null;
alter table if exists public.post_shares alter column community_id set not null;
alter table if exists public.post_shares drop constraint if exists post_shares_community_id_fkey;
alter table if exists public.post_shares add constraint post_shares_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.post_shares drop constraint if exists post_shares_user_id_fkey;
alter table if exists public.post_shares add constraint post_shares_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
alter table if exists public.post_shares drop constraint if exists post_shares_pkey;
alter table if exists public.post_shares add constraint post_shares_pkey primary key (community_id, post_id, user_id);

alter table if exists public.post_opens add column if not exists community_id uuid;
update public.post_opens po
set community_id = p.community_id
from public.posts p
where p.id = po.post_id and po.community_id is null;
alter table if exists public.post_opens alter column community_id set not null;
alter table if exists public.post_opens drop constraint if exists post_opens_community_id_fkey;
alter table if exists public.post_opens add constraint post_opens_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.post_opens drop constraint if exists post_opens_user_id_fkey;
alter table if exists public.post_opens add constraint post_opens_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
alter table if exists public.post_opens drop constraint if exists post_opens_pkey;
alter table if exists public.post_opens add constraint post_opens_pkey primary key (community_id, post_id, user_id);

alter table if exists public.comment_aura add column if not exists community_id uuid;
update public.comment_aura ca
set community_id = c.community_id
from public.comments c
where c.id = ca.comment_id and ca.community_id is null;
alter table if exists public.comment_aura alter column community_id set not null;
alter table if exists public.comment_aura drop constraint if exists comment_aura_community_id_fkey;
alter table if exists public.comment_aura add constraint comment_aura_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.comment_aura drop constraint if exists comment_aura_user_id_fkey;
alter table if exists public.comment_aura add constraint comment_aura_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
alter table if exists public.comment_aura drop constraint if exists comment_aura_pkey;
alter table if exists public.comment_aura add constraint comment_aura_pkey primary key (community_id, comment_id, user_id);

alter table if exists public.post_reports add column if not exists community_id uuid;
update public.post_reports pr
set community_id = p.community_id
from public.posts p
where p.id = pr.post_id and pr.community_id is null;
alter table if exists public.post_reports alter column community_id set not null;
alter table if exists public.post_reports drop constraint if exists post_reports_community_id_fkey;
alter table if exists public.post_reports add constraint post_reports_community_id_fkey foreign key (community_id) references public.communities(id) on delete cascade;
alter table if exists public.post_reports drop constraint if exists post_reports_reporter_id_fkey;
alter table if exists public.post_reports add constraint post_reports_reporter_id_fkey foreign key (reporter_id) references public.community_users(id) on delete cascade;
alter table if exists public.post_reports drop constraint if exists post_reports_post_id_reporter_id_key;
alter table if exists public.post_reports add constraint post_reports_post_id_reporter_id_key unique (community_id, post_id, reporter_id);

alter table if exists public.rate_limit_events add column if not exists community_id uuid;
update public.rate_limit_events set community_id = public._v5_test_community_id() where community_id is null;
alter table if exists public.rate_limit_events alter column community_id set not null;
alter table if exists public.rate_limit_events drop constraint if exists rate_limit_events_user_id_fkey;
alter table if exists public.rate_limit_events add constraint rate_limit_events_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
create index if not exists rate_limit_events_community_user_action_idx on public.rate_limit_events(community_id, user_id, action, created_at desc);

alter table if exists public.user_preferences add column if not exists community_id uuid;
update public.user_preferences set community_id = public._v5_test_community_id() where community_id is null;
alter table if exists public.user_preferences alter column community_id set not null;
alter table if exists public.user_preferences drop constraint if exists user_preferences_user_id_fkey;
alter table if exists public.user_preferences add constraint user_preferences_user_id_fkey foreign key (user_id) references public.community_users(id) on delete cascade;
alter table if exists public.user_preferences drop constraint if exists user_preferences_pkey;
alter table if exists public.user_preferences add constraint user_preferences_pkey primary key (community_id, user_id);

-- 5) Keep invite code case-insensitive (store uppercase)
create or replace function public.uppercase_invite_code()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(new.code);
  return new;
end;
$$;

drop trigger if exists trg_uppercase_invite_code on public.community_invites;
create trigger trg_uppercase_invite_code
before insert or update on public.community_invites
for each row
execute function public.uppercase_invite_code();

-- 6) Tighten direct client access (Edge function should be primary access path)
alter table public.communities enable row level security;
alter table public.community_users enable row level security;
alter table public.community_user_roles enable row level security;
alter table public.community_invites enable row level security;
alter table public.sessions enable row level security;

-- Explicit deny-all policies for new auth tables (service-role bypasses RLS in Edge Function).
drop policy if exists communities_no_access on public.communities;
create policy communities_no_access on public.communities for all using (false) with check (false);

drop policy if exists community_users_no_access on public.community_users;
create policy community_users_no_access on public.community_users for all using (false) with check (false);

drop policy if exists community_user_roles_no_access on public.community_user_roles;
create policy community_user_roles_no_access on public.community_user_roles for all using (false) with check (false);

drop policy if exists community_invites_no_access on public.community_invites;
create policy community_invites_no_access on public.community_invites for all using (false) with check (false);

drop policy if exists sessions_no_access on public.sessions;
create policy sessions_no_access on public.sessions for all using (false) with check (false);

-- 7) Social tables: deny direct client access (force Edge Function path with session token)
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_votes enable row level security;
alter table public.post_shares enable row level security;
alter table public.post_opens enable row level security;
alter table public.comment_aura enable row level security;
alter table public.post_reports enable row level security;
alter table public.user_preferences enable row level security;
alter table public.rate_limit_events enable row level security;

drop policy if exists posts_read on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
drop policy if exists posts_admin_update on public.posts;
drop policy if exists posts_admin_delete on public.posts;
drop policy if exists posts_no_access on public.posts;
create policy posts_no_access on public.posts for all using (false) with check (false);

drop policy if exists comments_read on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_update_own on public.comments;
drop policy if exists comments_delete_own on public.comments;
drop policy if exists comments_admin_update on public.comments;
drop policy if exists comments_admin_delete on public.comments;
drop policy if exists comments_no_access on public.comments;
create policy comments_no_access on public.comments for all using (false) with check (false);

drop policy if exists votes_read on public.post_votes;
drop policy if exists votes_insert_own on public.post_votes;
drop policy if exists votes_update_own on public.post_votes;
drop policy if exists votes_delete_own on public.post_votes;
drop policy if exists votes_admin_delete on public.post_votes;
drop policy if exists post_votes_no_access on public.post_votes;
create policy post_votes_no_access on public.post_votes for all using (false) with check (false);

drop policy if exists post_shares_no_access on public.post_shares;
create policy post_shares_no_access on public.post_shares for all using (false) with check (false);

drop policy if exists post_opens_no_access on public.post_opens;
create policy post_opens_no_access on public.post_opens for all using (false) with check (false);

drop policy if exists comment_aura_no_access on public.comment_aura;
create policy comment_aura_no_access on public.comment_aura for all using (false) with check (false);

drop policy if exists post_reports_insert_own on public.post_reports;
drop policy if exists post_reports_read_own on public.post_reports;
drop policy if exists post_reports_admin_read on public.post_reports;
drop policy if exists post_reports_no_access on public.post_reports;
create policy post_reports_no_access on public.post_reports for all using (false) with check (false);

drop policy if exists user_preferences_no_access on public.user_preferences;
create policy user_preferences_no_access on public.user_preferences for all using (false) with check (false);

drop policy if exists rate_limit_events_insert_own on public.rate_limit_events;
drop policy if exists rate_limit_events_read_own on public.rate_limit_events;
drop policy if exists rate_limit_events_no_access on public.rate_limit_events;
create policy rate_limit_events_no_access on public.rate_limit_events for all using (false) with check (false);

-- Optional helper for validation
-- select id, name, invite_policy from public.communities order by created_at desc;
