# Supabase Unfurl (Edge Function + Cache)

Esta guía activa extracción de metadata server-side para mejorar imagen/título/descripción de noticias en producción.

## 1) Ejecutar SQL de cache

En Supabase SQL Editor, ejecuta:

- [`docs/sql/supabase_unfurl_cache_v1.sql`](/Users/axelsearagomez/Desktop/test de proyecto/docs/sql/supabase_unfurl_cache_v1.sql)

## 2) Desplegar Edge Function

Requisitos: Supabase CLI instalada y sesión iniciada.

```bash
supabase login
supabase link --project-ref gvtynecqpplzuletwduu
supabase functions deploy unfurl
```

La función está en:

- [`supabase/functions/unfurl/index.ts`](/Users/axelsearagomez/Desktop/test de proyecto/supabase/functions/unfurl/index.ts)

## 3) Verificar en local

1. Asegúrate de tener `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`.
2. Ejecuta:

```bash
npm run dev
```

3. Comparte una URL desde la app.
4. Comprueba en Supabase que `link_metadata_cache` recibe filas.

## 4) Verificar en producción (Vercel)

En Vercel, confirma variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Redeploy y prueba compartir una noticia.

## Notas

- La app ahora intenta `Edge Function unfurl` primero en `enrich.ts`.
- Si la función falla, cae al método anterior (microlink/jsonlink/noembed) para no romper UX.
- TTL de cache por defecto: 12 horas.
