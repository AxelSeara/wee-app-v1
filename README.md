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
- Persistencia local: IndexedDB (`idb`) + fallback a localStorage
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

## Supabase (backend de pruebas reales)

Variables de entorno esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado)
- `VITE_SUPABASE_ANON_KEY` (compatibilidad)

La app incluye una comprobación rápida en `Ajustes > Backend (Supabase)`.

Para el modo remoto actual, crea esta tabla:

```sql
create table if not exists app_state (
  id text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
```

Para `BE v1` (recomendado), usa RLS solo para usuarios autenticados:

```sql
alter table app_state enable row level security;

drop policy if exists "app_state_open_read" on app_state;
drop policy if exists "app_state_open_write" on app_state;
drop policy if exists "app_state_open_update" on app_state;

create policy "app_state_auth_read" on app_state for select using (auth.uid() is not null);
create policy "app_state_auth_write" on app_state for insert with check (auth.uid() is not null);
create policy "app_state_auth_update" on app_state for update using (auth.uid() is not null);
```

`BE v1` usa Supabase Auth para login/registro en modo remoto, y no persiste `passwordHash` en backend compartido.

## Documentación

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Aura y scoring](docs/AURA_AND_SCORING.md)
- [Flujos UX](docs/UX_FLOWS.md)
- [Testing](docs/TESTING.md)
- [Deploy](docs/DEPLOY.md)

## Limitación importante

Wee es local-first. Aunque se publique en Vercel/GitHub Pages, cada navegador guarda su propia base de datos local. Sin backend compartido no hay sincronización real entre usuarios.
