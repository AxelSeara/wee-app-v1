# AURA Rules v2 (incremental, no IA)

## Objetivo
Mantener compatibilidad con el flujo actual y mejorar robustez/explicabilidad del scoring.

- Contrato conservado:
  - `qualityScore`: `0..100`
  - `interestScore` (Aura visible): `1..100`
  - `qualityLabel`: `clickbait | high | medium | low`
- Feature flag:
  - `VITE_AURA_RULESET_VERSION=v1|v2`
  - default: `v1`

## Configuración de dominio (configurable)
Se pueden ajustar por env vars CSV:

- `VITE_AURA_ALLOWLIST_HIGH`
- `VITE_AURA_ALLOWLIST_MID`
- `VITE_AURA_BLOCKLIST`
- `VITE_AURA_PRIMARY_SOURCES`

Si no se define, usa defaults en `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/classify.ts`.

## Reglas v2 de calidad
Base: `50`

### 1) Procedencia / confianza
- `v2.domain_allowlist_high`: `+22`
- `v2.domain_allowlist_mid`: `+12`
- `v2.domain_blocklist`: `-28`
- `v2.domain_unknown_soft_penalty`: `-6`
- Social:
  - `v2.social_media_penalty`: `-4..-11` según dominio/contexto

### 2) Metadatos y estructura
- `v2.schema_news_article`: `+9`
- `v2.publisher_author_contact`: `+8`
- `v2.publisher_or_author_partial`: `+4`
- `v2.valid_publication_date`: `+4`
- `v2.future_publication_penalty`: `-15`
- `v2.low_text_density`: `-12`
- `v2.good_text_density`: `+4`

### 3) Evidencia
- `v2.numeric_evidence`: `+4`
- `v2.quote_attribution`: `+6`
- `v2.primary_sources_bonus`: `+8`
- `v2.no_outbound_low_rep`: `-10`

### 4) Anti-clickbait
- `v2.curiosity_gap_penalty`: `-8`
- `v2.title_body_mismatch`: `-9`
- `v2.clickbait_soft`: `-16`
- `v2.clickbait_strong`: `-42`

### 5) Duplicados / sindicación
- `v2.duplicate_canonical_penalty`: `-6`
- `v2.duplicate_content_penalty`: `-14`

### 6) Intrusividad
- `v2.intrusive_overlay_penalty`: `-8`
- `v2.ad_ratio_penalty`: `-6`

## Aura visible (v1/v2)
Fórmula conservada para no romper ranking:

- base `30`
- `+ 0.85 * topicBoost`
- `+ 22 * ((qualityScore - 50)/50)`
- `+ contextBoost` (`8*tanh(textLen/220)-2`)
- `+ recencyBoost` (`12*exp(-ageHours/48)-2.5`)
- clamp `1..100`
- si clickbait fuerte: cap `<=55`

## Explainability
Cada clasificación incluye breakdown estructurado opcional (`debugBreakdown`) con:

- `baseScore`
- `adjustments[]` (`ruleId`, `delta`, `evidence`)
- `finalScore`
- `firedRules[]`

Persistencia compatible (sin cambiar schema de `posts`):

- flags especiales:
  - `aura_ruleset:v1|v2`
  - `quality_breakdown:<base64-json>`
  - `aura_breakdown:<base64-json>`

## Debug runtime
- `?debug=1` en la URL activa debug de indexado.
- Se rellena `debugBreakdown` en respuesta de publicación.
- Se expone último breakdown en `window.__WEE_LAST_AURA_DEBUG__`.

## Reporte rápido de reglas
Script:

- `npm run aura:report -- --input <json_export> --limit 30 --format json`
- `npm run aura:report -- --input <json_export> --limit 30 --format csv --output aura_report.csv`

Entrada esperada:
- export JSON con `posts[]` que contenga flags de breakdown.
