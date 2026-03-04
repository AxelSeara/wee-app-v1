# Aura System Review (2026-03-04)

## 1) Mapa del flujo actual (código real)

### Dónde nace Aura (post)
- `src/lib/classify.ts`
  - `scoreInterest(...)` (Aura visible `interestScore`, `1..100`)
  - `classifyPost(...)` compone `qualityScore + interestScore + rationale + flags`
- Call sites:
  - `src/App.tsx` -> `onShareUrl(...)` usa `classifyPost(...)` antes de `createPost(...)`
  - `src/App.tsx` respeta `VITE_AURA_RULESET_VERSION=v1|v2`

### Dónde impacta ranking/selección
- Home:
  - `src/pages/HomePage.tsx`
  - orden de feed ahora por `scoreHomeFeedPost(...)` (`src/lib/auraEngine.ts`)
- Tema:
  - `src/lib/topicForum.ts` usa `scoreTopicPost(...)` (`src/lib/auraEngine.ts`)
- Detail/related:
  - `src/pages/PostDetailPage.tsx` y `src/components/PostDetailModal.tsx` priorizan por `qualityScore`/`interestScore`

### Dónde se calcula reputación de usuario
- `src/lib/appData.ts`
  - `userQualityValueById` via `computeUserQualityScore(...)`
  - `userInfluenceAuraById` via `computeUserInfluenceScore(...)`
- El valor interno (`1000..10000`) pondera votos y ranking, no visible al usuario final.

### Persistencia (DB/local)
- `src/lib/store.ts`
  - `posts.quality_score`, `posts.interest_score`, `posts.quality_label`
  - `post_votes`, `comment_aura`, `post_shares`, `post_opens`
- Los cálculos de aura/reputación se hacen en FE y se persisten los resultados del post.

### UI
- Tarjetas y detalle muestran Aura de post:
  - `src/components/PostCard.tsx`
  - `src/pages/PostDetailPage.tsx`
- Perfil/comunidad consume stats derivados:
  - `src/pages/ProfilePage.tsx`
  - `src/pages/HomePage.tsx`

## 2) Invariantes recomendadas

1. `interestScore` siempre en `1..100`.
2. `qualityScore` siempre en `0..100`.
3. `userInfluenceAuraById` siempre en `1000..10000`.
4. Cálculo determinista: mismo input + mismo timestamp => mismo output.
5. Degradación segura: con datos faltantes no hay crash, solo penalización controlada.
6. Recalcular no duplica efectos (idempotencia en score, sin acumulación fantasma).
7. Votos de baja diversidad no deben dominar el ranking.
8. Señales antiguas pesan menos (decaimiento temporal explícito).

## 3) Threat modeling (gaming)

### Vector: sockpuppets + burst voting
- Impacto: Alto (sube ranking artificial).
- Probabilidad: Alta en comunidades pequeñas.
- Mitigación aplicada:
  - límite de votos contados por ventana/día,
  - penalización por burst,
  - multiplicador de diversidad (2 cuentas no pesan como 10 reales).

### Vector: repost/duplicado por mismo autor
- Impacto: Medio-Alto.
- Probabilidad: Alta.
- Mitigación actual + propuesta:
  - penalización por duplicado en calidad,
  - penalización acumulada en reputación de autor.

### Vector: granja de cuentas antiguas inactivas con reputación alta
- Impacto: Medio.
- Probabilidad: Media.
- Mitigación aplicada:
  - factor de staleness con half-life en reputación.

### Vector: clickbait con engagement corto
- Impacto: Alto (captura feed).
- Probabilidad: Alta.
- Mitigación actual:
  - cap de Aura para clickbait,
  - penalizaciones de texto/estructura/metadatos,
  - en feed pesa más calidad y evidencia que voto puro.

### Vector: brigading coordinado en tema único (echo chamber)
- Impacto: Medio.
- Probabilidad: Media.
- Mitigación sugerida siguiente iteración:
  - bonus de diversidad de autores por tema,
  - cap de influencia por cluster de votantes recurrentes.

## 4) Incentivos actuales (y riesgos)

### Comportamientos premiados
- publicar con fuente/evidencia,
- mantener calidad sostenida,
- recibir votos de usuarios confiables,
- participación comunitaria con señales positivas.

### Incentivos perversos detectados
- sobreoptimizar volumen en vez de calidad (si no hay decay/caps),
- votar en masa entre pocas cuentas,
- explotar publicaciones antiguas de alta reputación.

## 5) Rediseño incremental aplicado (sin romper contrato)

Separación explícita:
- `PostQualityScore` (ya existente en `classify.ts`)
- `PostAura/InterestScore` (ya existente en `classify.ts`)
- `UserReputationScore` interno (`1000..10000`) ahora centralizado y con decay

Nuevos elementos aplicados en `src/lib/auraEngine.ts`:
- Decaimiento temporal:
  - reputación y calidad de autor usan half-life por post.
- Rate limits/caps:
  - cap de votos contados por día,
  - burst penalty en ventana corta.
- Anti-dominancia histórica:
  - `stalenessFloor + stalenessHalfLife` en reputación.
- Outliers:
  - clamp de señal de feedback (`maxAbsScore`).
- Config versionable:
  - `config/aura_runtime_v2.json`.

## 6) Fórmulas concretas (resumen)

### Señal de voto ponderado
- `weight(user) = base + ((influence-min)/(max-min))^exp * (maxWeight-base)`
- `posterior = weightedVote / (totalWeight + priorWeight)`
- `confidence = totalWeight / (totalWeight + confidencePivot)`
- `feedback = posterior * scoreScale * confidence * diversityMultiplier - burstPenalty`
- `feedback = clamp(feedback, -maxAbsScore, +maxAbsScore)`

### Score feed
- `feed = quality*wq + aura*wa + authorQuality*wu + recency + evidence + collaboration + clickbaitPenalty + feedback`

### Reputación autor
- features con decay: `avgQuality`, `highRate`, `poorRate`, `duplicateRate`, `voteDelta`
- `raw = start + qualityLift(sigmoid) + volumeLift(exp) + voteLift(tanh) - duplicateHit`
- `normalized = start + (raw-start) * stalenessMultiplier`
- clamp final a `[1000,10000]`

### Escenarios rápidos
- Caso A: post fiable + votos diversos -> sube feed notablemente.
- Caso B: votos rápidos de 2 cuentas -> efecto reducido por `lowDiversityMultiplier` + burst.
- Caso C: autor con buen histórico pero inactivo meses -> reputación se enfría.
- Caso D: autor nuevo con 1 post bueno -> mejora moderada, sin salto extremo.
- Caso E: duplicados repetidos -> reputación cae por penalización acumulada.

## 7) Calibración semanal (sin IA)

1. Ajustar parámetros en `config/aura_runtime_v2.json`.
2. Registrar por post: `qualityScore`, `interestScore`, `feedback`, flags y top reglas.
3. Reporte semanal:
   - usar `npm run aura:report -- --input <export.json> --limit 50`.
4. Revisar KPIs:
   - ratio de clickbait top-20,
   - diversidad de votantes top-20,
   - share de autores nuevos en top-20,
   - varianza de score por tema.
5. Aplicar microajustes (<10%) y validar con tests de regresión.

## 8) Gaps de tests detectados

Faltaban pruebas de:
- invariantes en señal de feedback con outliers,
- penalización por baja diversidad + burst,
- decay temporal en reputación,
- límites de reputación interna.

Añadido:
- `src/test/aura-engine.test.ts` con tests unitarios y casos de gaming.

## 9) Hallazgos priorizados

### P0
- Ausencia de módulo único para lógica de reputación/ranking (antes disperso).
  - Estado: resuelto con `src/lib/auraEngine.ts`.

### P1
- Parámetros embebidos en varios archivos y difícil calibración.
  - Estado: resuelto con `config/aura_runtime_v2.json`.
- Vulnerabilidad parcial a brigading por baja diversidad.
  - Estado: mitigado con diversity multiplier + burst penalty + caps.

### P2
- Falta de observabilidad comparativa entre semanas.
  - Estado: mitigado parcialmente (`aura:report` existente + guía de calibración). Recomendado: dashboard dedicado en próxima iteración.
