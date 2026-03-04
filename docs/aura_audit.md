# AURA Audit (v1 current)

Fecha: 2026-03-04

## 1) Dónde se calcula AURA y calidad

- Cálculo principal:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/classify.ts`
  - Funciones:
    - `scoreQuality(input, normalizedText, sourceDomain)`
    - `scoreInterest(topics, qualityScore, clickbait, createdAt, textLength)`
    - `classifyPost(input, createdAt)`
- Call sites directos:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/App.tsx:291`
  - `classifyPost({ url, title: derivedTitle, text: description }, createdAt)`

## 2) Dónde se definen reglas y cómo se aplican

### Reglas/config actuales (hardcoded)
- `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/classify.ts`
  - `TOPIC_KEYWORDS`, `LOCATION_KEYWORDS`
  - `CLICKBAIT_PATTERNS`
  - `TIER_A_DOMAINS`, `TIER_B_DOMAINS`, `SOCIAL_DOMAINS`
  - `TOPIC_WEIGHTS`
  - `QUALITY_WEIGHTS`, `QUALITY_BASE`, `QUALITY_CAPS`
  - `AURA_BASE`, `AURA_CAPS`
  - `TOPIC_DOMAIN_HINTS`, `TOPIC_EXCLUSIONS`, `TOPIC_PHRASE_SIGNALS`, `TOPIC_CONTEXT_CLUES`
  - `SUBTOPIC_KEYWORDS`

### Aplicación
- `classifyPost` hace:
  1. Normalización (`normalizeInputText`)
  2. `sourceDomain` (`safeDomainFromUrl`)
  3. `extractHosts`
  4. Temas/subtemas (`detectTopicsFromInput` + `detectSubtopics`)
  5. Calidad (`scoreQuality`)
  6. Aura visible (`scoreInterest`)
  7. Label (`qualityLabelFromScore`)
  8. `rationale` combinando tema + calidad + aura

## 3) Inputs reales que usa el scoring

En publicación de link, hoy el clasificador usa:
- `url`
- `title` derivado de metadata/enrich (`derivedTitle`)
- `text` = descripción metadata (`metadata.description`)
- `createdAt`

Rutas de enriquecimiento:
- `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/enrich.ts`
  - `edgeUnfurl` (Supabase Edge Function `unfurl`)
  - `microlink`, `jsonlink`, `noembed`, `youtube oEmbed`
- `/Users/axelsearagomez/Desktop/test de proyecto/supabase/functions/unfurl/index.ts`
  - extrae `og:*`, `twitter:*`, `description`, `title`, `image`, `site_name`, JSON-LD image, canonicalización y cache

Nota: `classifyPost` **no** recibe ni parsea HTML completo actualmente; solo usa `url/title/text`.

## 4) Persistencia (BD) y UI

### Persistencia
- Escritura en backend:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/store.ts`
  - `postToRow` mapea a columnas:
    - `quality_label`, `quality_score`, `interest_score`, `flags`, `rationale`, `topics`, `subtopics`, `normalized_text`, etc.
- Lectura en backend:
  - `listPosts` selecciona mismas columnas.
- Creación de post:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/App.tsx:302-323`

### Dónde se muestra en UI
- Feed card:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/components/PostCard.tsx`
- Detalle noticia:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/pages/PostDetailPage.tsx`
- Detalle modal:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/components/PostDetailModal.tsx`
- Ranking/ordenación y agregados:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/pages/HomePage.tsx`
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/topicForum.ts`

## 5) Flujo (diagrama texto)

1. Usuario pega URL (`ShareLinkModal` / `SharePage` / `TopicPage`).
2. `App.onShareUrl`:
   - Canonicaliza URL y verifica duplicados por URL.
   - Si no existe duplicado: llama `enrichUrl`.
3. `enrichUrl` obtiene metadata (`title`, `description`, `image`, `siteName`).
4. `classifyPost` calcula `topics/subtopics/qualityScore/interestScore/flags/rationale`.
5. `createPost` persiste en `posts` (Supabase).
6. UI consume `listPosts`, ordena con calidad+aura y muestra badges/tooltips.

## 6) Reglas actuales con pesos y umbrales (v1)

### Calidad (`scoreQuality`)
- Base: `52`
- Fuente:
  - URL presente `+5`
  - HTTPS `+2`
  - sin URL `-14` + flag `no_source`
  - no HTTPS `-4` + flag `insecure_source`
- Reputación:
  - Tier A `+25`
  - Tier B `+15`
- Social:
  - X/Twitter con contexto `-4`, sin contexto `-8`
  - resto social con contexto `-8`, sin contexto `-12`
  - flag `social_media`
- Texto/título:
  - título informativo (20..110) `+4`
  - título corto `<8` `-8`
  - título largo `>160` `-4`
  - texto contexto (80..1200) `+6`
  - texto corto `<30` `-12`
  - texto bajo contexto `<80` `-6`
  - sin título + muy corto `-8`
- Evidencia:
  - números/fechas `+4`
  - cita + atribución `+6`
- Riesgo:
  - unverified claim `-10` + flag `unverified_claim`
  - puntuación excesiva `-5`
  - clickbait fuerte `-40` + flag `sensational`
  - clickbait moderado `-14` + flag `sensational_soft`
- Clamp calidad: `0..100`

### Label calidad
- Clickbait fuerte => `clickbait`
- `>=75` => `high`
- `>=50` => `medium`
- resto => `low`

### Aura visible (`scoreInterest`)
- Base: `30`
- `topicBoost = avg(TOPIC_WEIGHTS)`
- `qualityNormalized = (qualityScore - 50)/50`
- `contextBoost = 8*tanh(textLength/220)-2`
- `recencyBoost = 12*exp(-ageHours/48)-2.5`
- Fórmula:
  - `score += topicBoost*0.85 + qualityNormalized*22 + contextBoost + recencyBoost`
- Clamp: `1..100`
- Si clickbait fuerte: cap `<=55`

## 7) Problemas principales detectados

1. Explainability parcial:
- Hay `rationale` textual, pero no breakdown estructurado por regla (rule_id, delta, evidencia).

2. Sin feature flag de ruleset:
- No existe `AURA_RULESET_VERSION`; cualquier cambio impacta a todos.

3. Inputs limitados para robustez editorial:
- El scoring no evalúa HTML estructural de la noticia (schema.org NewsArticle, author/publisher/imprint, overlays/ad intrusivos).

4. Duplicados por contenido no cubiertos:
- Hay dedupe por URL/canonical en flujo de share, pero no por hash de contenido normalizado.

5. Curiosity-gap y mismatch título/cuerpo incompletos:
- Clickbait cubre patrones básicos; falta regla explícita de `title/body mismatch` y triggers de curiosity gap más finos.

6. Reputación no configurable:
- Tier lists hardcoded en código; no hay allowlist/blocklist/primary_sources configurable sin deploy.

7. Logging de clasificación no estructurado:
- No existe log estándar `{url, domain, aura, fired_rules}` para depuración.

8. Debug de indexado no disponible:
- No hay modo `?debug=1` que devuelva breakdown completo sin revisar logs.

9. Posible sesgo de dominio:
- Reputación fuerte por marca +25/+15 puede sobrerrepresentar cabeceras y penalizar medios emergentes sin historial.

10. Cobertura de tests aún limitada para rebalanceo:
- Hay tests base de clickbait/reputación/subtemas, pero no fixtures amplios 20-50 casos, ni reporte comparativo v1/v2.
