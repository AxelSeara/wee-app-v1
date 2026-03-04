# Wee

Wee es una app de curación de noticias para microcomunidades: compartir enlaces, agrupar por temas, reducir ruido y premiar el contenido útil.

## Qué hace hoy

- Publicación rápida de enlaces desde navbar (modal).
- Clasificación heurística por tema y subtema (sin IA).
- Detección y fusión de duplicados por URL canónica.
- Aura de noticia visible (`1..100`) para priorizar el feed.
- Puntuación interna de influencia por usuario (`1000..10000`, no visible para usuarios).
- Votos (solo tras abrir fuente), comentarios y aura en comentarios.
- Perfil de usuario, edición de alias/avatar y página separada de publicaciones.
- Idiomas de interfaz: Español, English, Galego.
- Telemetría básica en Vercel Analytics (sin PII): navegación, compartir, abrir fuente, voto y comentario.

## Stack

- Vite + React + TypeScript
- React Router con `HashRouter` (compatible con GitHub Pages)
- Estado con hooks y capa de datos `useAppData`
- Persistencia remota en Supabase (backend relacional)
- Animaciones con Framer Motion
- Tests unitarios con Vitest

## Ejecutar en local

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm run test
```

Reporte rápido de AURA (desde export JSON):

```bash
npm run aura:report -- --input ./export.json --limit 30 --format csv --output ./aura_report.csv
```

## Rutas principales

- `/#/login`
- `/#/home`
- `/#/topic/:topic`
- `/#/post/:postId`
- `/#/share`
- `/#/profile/:userId`
- `/#/profile/:userId/posts`
- `/#/settings`

## Deploy rápido

- Vercel (recomendado): no definas `VITE_BASE_PATH`.
- GitHub Pages: usa `VITE_BASE_PATH=/NOMBRE_REPO/` en build.

Más detalle en [docs/DEPLOY.md](docs/DEPLOY.md).

## Telemetría de uso (Vercel)

- Integrado `@vercel/analytics` para métricas básicas de producto.
- Eventos enviados:
  - `page_view`
  - `share_link`
  - `open_source`
  - `rate_post`
  - `comment_post`
- No se envían alias, IDs de usuario, texto de comentarios ni URLs completas.
- Para activarlo en producción, habilita **Analytics** en tu proyecto de Vercel.

## Metadata de noticias (imagen/título)

Para mejorar el scraping en producción, Wee usa una Edge Function de Supabase (`unfurl`) con cache en base de datos.

- Guía paso a paso: [docs/SUPABASE_UNFURL.md](docs/SUPABASE_UNFURL.md)
- SQL cache: [docs/sql/supabase_unfurl_cache_v1.sql](docs/sql/supabase_unfurl_cache_v1.sql)

## AURA ruleset v2 (feature flag)

- `VITE_AURA_RULESET_VERSION=v1|v2` (default `v1`)
- Debug de indexado: añade `?debug=1` en la URL para obtener breakdown completo en la respuesta de publicación.
- Documentación:
  - [docs/aura_audit.md](docs/aura_audit.md)
  - [docs/aura_rules_v2.md](docs/aura_rules_v2.md)

## Supabase (backend de pruebas reales)

Variables de entorno esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado)
- `VITE_SUPABASE_ANON_KEY` (compatibilidad)
- `VITE_REQUIRE_REMOTE=1` (opcional en local para forzar backend remoto; en producción ya se fuerza automáticamente)

La app incluye una comprobación rápida en `Ajustes > Backend (Supabase)`.

`BE v2` (recomendado) usa backend relacional:

- `profiles`
- `profile_private` (opcional pero recomendado)
- `posts`
- `comments`
- `post_votes`
- `post_shares` (v2)
- `post_opens` (v2)
- `comment_aura` (v2)

Con este modo, usuarios/noticias/comentarios/votos se comparten entre navegadores/sesiones autenticadas.

SQL base sugerido (idéntico al que ya estás usando en pruebas):

```sql
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique,
  avatar_url text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  url text,
  canonical_url text,
  title text,
  text text,
  source_domain text,
  topics text[] not null default array['misc']::text[],
  subtopics text[] not null default '{}',
  quality_label text not null,
  quality_score int not null,
  interest_score int not null,
  flags text[] not null default '{}',
  rationale text[] not null default '{}',
  normalized_text text not null default ''
);

create table if not exists profile_private (
  user_id uuid primary key references profiles(id) on delete cascade,
  auth_email text,
  language text,
  privacy_consent_at timestamptz,
  privacy_policy_version text
);

create unique index if not exists posts_canonical_url_unique
on posts (canonical_url) where canonical_url is not null;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists post_votes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1,1)),
  voted_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_shares (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  share_count int not null default 1,
  last_shared_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_opens (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  opened_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists comment_aura (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
```

RLS mínimo (lectura abierta de comunidad + escritura solo del usuario autenticado):

```sql
alter table profiles enable row level security;
alter table profile_private enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_votes enable row level security;
alter table post_shares enable row level security;
alter table post_opens enable row level security;
alter table comment_aura enable row level security;

create policy "profiles_read" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "profile_private_read_own" on profile_private for select using (auth.uid() = user_id);
create policy "profile_private_write_own" on profile_private for insert with check (auth.uid() = user_id);
create policy "profile_private_update_own" on profile_private for update using (auth.uid() = user_id);

create policy "posts_read" on posts for select using (true);
create policy "posts_insert_own" on posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on posts for update using (auth.uid() = user_id);
create policy "posts_delete_own" on posts for delete using (auth.uid() = user_id);

create policy "comments_read" on comments for select using (true);
create policy "comments_insert_own" on comments for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on comments for update using (auth.uid() = user_id);
create policy "comments_delete_own" on comments for delete using (auth.uid() = user_id);

create policy "votes_read" on post_votes for select using (true);
create policy "votes_insert_own" on post_votes for insert with check (auth.uid() = user_id);
create policy "votes_update_own" on post_votes for update using (auth.uid() = user_id);
create policy "votes_delete_own" on post_votes for delete using (auth.uid() = user_id);

create policy "shares_read" on post_shares for select using (true);
create policy "shares_insert_own" on post_shares for insert with check (auth.uid() = user_id);
create policy "shares_update_own" on post_shares for update using (auth.uid() = user_id);
create policy "shares_delete_own" on post_shares for delete using (auth.uid() = user_id);

create policy "opens_read" on post_opens for select using (true);
create policy "opens_insert_own" on post_opens for insert with check (auth.uid() = user_id);
create policy "opens_update_own" on post_opens for update using (auth.uid() = user_id);
create policy "opens_delete_own" on post_opens for delete using (auth.uid() = user_id);

create policy "comment_aura_read" on comment_aura for select using (true);
create policy "comment_aura_insert_own" on comment_aura for insert with check (auth.uid() = user_id);
create policy "comment_aura_update_own" on comment_aura for update using (auth.uid() = user_id);
create policy "comment_aura_delete_own" on comment_aura for delete using (auth.uid() = user_id);
```

Para capacidades admin globales (gestión de roles, borrado de terceros, moderación transversal), aplica el **SQL v3** de admin además de este bloque v2.

Si las miniaturas no se guardan en posts existentes, aplica esta migración:

- [docs/sql/supabase_posts_preview_metadata_v1.sql](docs/sql/supabase_posts_preview_metadata_v1.sql)

Tabla opcional para ajustes por usuario (recomendada para guardar filtros):

```sql
create table if not exists user_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  preferred_topics text[] not null default '{}',
  blocked_domains text[] not null default '{}',
  blocked_keywords text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;
create policy "preferences_read_own" on user_preferences for select using (auth.uid() = user_id);
create policy "preferences_write_own" on user_preferences for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on user_preferences for update using (auth.uid() = user_id);
```

## Documentación

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Unfurl Supabase](docs/SUPABASE_UNFURL.md)
- [Aura y scoring](docs/AURA_AND_SCORING.md)
- [Flujos UX](docs/UX_FLOWS.md)
- [Testing](docs/TESTING.md)
- [Deploy](docs/DEPLOY.md)

## Limitación importante

Wee depende de Supabase para el flujo completo BE/FE. Si faltan variables `VITE_SUPABASE_*` o tablas SQL, la app no funcionará correctamente.
