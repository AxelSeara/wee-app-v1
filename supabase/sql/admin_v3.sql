-- Admin v3 policies (non-breaking, additive)
-- Apply after your base v2 schema + RLS policies.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

-- Allow admins to manage roles and profile moderation.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
on public.profiles
for delete
using (public.is_admin(auth.uid()));

-- Allow admins to moderate all posts/comments/votes/shares/opens/comment aura.
drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update"
on public.posts
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete"
on public.posts
for delete
using (public.is_admin(auth.uid()));

drop policy if exists "comments_admin_update" on public.comments;
create policy "comments_admin_update"
on public.comments
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "comments_admin_delete" on public.comments;
create policy "comments_admin_delete"
on public.comments
for delete
using (public.is_admin(auth.uid()));

drop policy if exists "votes_admin_delete" on public.post_votes;
create policy "votes_admin_delete"
on public.post_votes
for delete
using (public.is_admin(auth.uid()));

drop policy if exists "shares_admin_delete" on public.post_shares;
create policy "shares_admin_delete"
on public.post_shares
for delete
using (public.is_admin(auth.uid()));

drop policy if exists "opens_admin_delete" on public.post_opens;
create policy "opens_admin_delete"
on public.post_opens
for delete
using (public.is_admin(auth.uid()));

drop policy if exists "comment_aura_admin_delete" on public.comment_aura;
create policy "comment_aura_admin_delete"
on public.comment_aura
for delete
using (public.is_admin(auth.uid()));
