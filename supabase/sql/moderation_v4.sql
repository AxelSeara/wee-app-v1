-- Moderation + anti-spam v4 (additive)
-- Run after base schema + admin_v3.sql

create extension if not exists pgcrypto;

-- 1) Post moderation fields
alter table if exists public.posts
  add column if not exists status text not null default 'active',
  add column if not exists removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_reason text;

alter table if exists public.posts
  drop constraint if exists posts_status_check;
alter table if exists public.posts
  add constraint posts_status_check check (status in ('active', 'collapsed', 'removed'));

create index if not exists posts_status_idx on public.posts(status);

-- 2) Reports table
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.post_reports enable row level security;

-- Members can report; admins can read all reports; users can read own reports.
drop policy if exists "post_reports_insert_own" on public.post_reports;
create policy "post_reports_insert_own"
on public.post_reports
for insert
with check (auth.uid() = reporter_id);

drop policy if exists "post_reports_read_own" on public.post_reports;
create policy "post_reports_read_own"
on public.post_reports
for select
using (auth.uid() = reporter_id);

drop policy if exists "post_reports_admin_read" on public.post_reports;
create policy "post_reports_admin_read"
on public.post_reports
for select
using (public.is_admin(auth.uid()));

-- 3) Removed visibility in RLS (admins can still see everything)
drop policy if exists "posts_read" on public.posts;
create policy "posts_read"
on public.posts
for select
using (
  public.is_admin(auth.uid())
  or status <> 'removed'
);

-- 4) Only admins can move a post to removed/collapsed.
create or replace function public.enforce_post_status_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('removed', 'collapsed') and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can set removed/collapsed status';
  end if;
  if old.status in ('removed', 'collapsed') and new.status <> old.status and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can restore moderated posts';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_post_status_moderation on public.posts;
create trigger trg_enforce_post_status_moderation
before update on public.posts
for each row
execute function public.enforce_post_status_moderation();

-- 5) DB rate limiting table + RPC
create table if not exists public.rate_limit_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_user_action_created_idx
  on public.rate_limit_events(user_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

drop policy if exists "rate_limit_events_insert_own" on public.rate_limit_events;
create policy "rate_limit_events_insert_own"
on public.rate_limit_events
for insert
with check (auth.uid() = user_id);

drop policy if exists "rate_limit_events_read_own" on public.rate_limit_events;
create policy "rate_limit_events_read_own"
on public.rate_limit_events
for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

create or replace function public.consume_rate_limit(
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns table(allowed boolean, remaining int, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count int;
  v_oldest timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return query select false, 0, p_window_seconds;
    return;
  end if;

  v_window_start := v_now - make_interval(secs => p_window_seconds);

  select count(*)::int, min(created_at)
    into v_count, v_oldest
  from public.rate_limit_events
  where user_id = v_uid
    and action = p_action
    and created_at >= v_window_start;

  if v_count >= p_limit then
    return query
      select
        false,
        0,
        greatest(1, ceil(extract(epoch from ((coalesce(v_oldest, v_now) + make_interval(secs => p_window_seconds)) - v_now)))::int);
    return;
  end if;

  insert into public.rate_limit_events(user_id, action, created_at)
  values (v_uid, p_action, v_now);

  return query select true, greatest(0, p_limit - (v_count + 1)), 0;
end;
$$;

grant execute on function public.consume_rate_limit(text, int, int) to authenticated;
