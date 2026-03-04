# Topic Rules v2

## Taxonomía

Topics soportados por v2:
- `politics`, `economy`, `tech`, `science`, `health`, `climate`, `sports`, `culture`, `education`, `local`, `geopolitics`, `war`, `general`

Compatibilidad:
- `topic_v2` puede ser `general`.
- el campo legacy `topics[]` mantiene `misc` cuando `topic_v2=general`.

## Feature flag

- `VITE_TOPIC_RULESET_VERSION=v1|v2`
- default: `v1`

## Señales y pesos

Config en:
- `/Users/axelsearagomez/Desktop/test de proyecto/config/topics_v2.json`
- `/Users/axelsearagomez/Desktop/test de proyecto/config/topic_conflicts_v2.json`
- `/Users/axelsearagomez/Desktop/test de proyecto/config/site_profiles_v2.json`

Prioridad de señales:

1. Metadata estructurada (peso alto)
- JSON-LD: `articleSection`, `keywords`, `about`, `genre`, `isPartOf`
- Meta: `article:section`, `news_keywords`, `parsely-section`, `sailthru.tags`

2. Estructura del sitio (peso medio)
- URL patterns por topic
- breadcrumbs
- rel=tag
- perfiles por dominio

3. Keywords/diccionarios (peso medio-bajo)
- keywords en title/body
- hints por dominio
- gazetteer local

4. Conflictos / desambiguación
- reglas explícitas (`madrid+real+liga`, `apple+iphone`, etc.)

## Umbrales

- `MIN_SCORE` (`thresholds.min_score`):
  - si top score < MIN => `topic_v2=general`
- `DELTA` (`thresholds.delta`):
  - si `top - second < DELTA` => `ambiguous=true` y selecciona hasta 2 topics
- `max_topics`: límite superior de selección

## Output v2 (no-breaking)

`ClassifyOutput` añade:
- `topic_v2`
- `topic_candidates_v2`: `[{topic, score}]`
- `topic_explanation_v2`: señales disparadas, pesos y evidencias
- `topic_version`

Persistencia (`posts`):
- `topic_v2 TEXT`
- `topic_candidates_v2 JSONB`
- `topic_explanation_v2 JSONB`
- `topic_version TEXT`

Migración:
- `/Users/axelsearagomez/Desktop/test de proyecto/supabase/sql/topic_v3.sql`

## Depuración

- Indexado con `?debug=1`:
  - devuelve `topic_explanation_v2` y candidatos en el resultado del share.
  - logging estructurado:
    - `{url, domain, topic_v2, candidates_top3, fired_signals}`

Admin view simple:
- en detalle de noticia (admin), panel con `topic_v2`, candidatos y estado `ambiguous/resolved`.

## Backfill

Script opcional:
- `/Users/axelsearagomez/Desktop/test de proyecto/scripts/recompute_topics_v2.mjs`

Ejemplo:
- `node scripts/recompute_topics_v2.mjs --limit 200 --since 2026-01-01`

Requisitos:
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Cómo ajustar reglas sin tocar código

1. Añadir keywords/topics:
- editar `config/topics_v2.json` en `keyword_mappings` o `meta_mappings`.

2. Añadir patrón URL:
- editar `url_patterns` del topic.

3. Añadir dominio especial:
- editar `config/site_profiles_v2.json`.

4. Añadir desambiguación:
- editar `config/topic_conflicts_v2.json` (`boost`/`penalize`).
