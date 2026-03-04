-- Add preview metadata columns to posts for richer cards/detail rendering

alter table public.posts
  add column if not exists preview_title text,
  add column if not exists preview_description text,
  add column if not exists preview_image_url text,
  add column if not exists preview_site_name text;
