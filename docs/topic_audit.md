# Topic Audit (v1 actual)

Fecha: 2026-03-04

## Dónde se calcula el topic

- Motor actual:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/classify.ts`
  - funciones:
    - `topicSignalStrength(normalizedText, topic)`
    - `detectTopics(normalizedText, sourceDomain?)`
    - `detectTopicsFromInput(input, sourceDomain?)`
    - `detectSubtopics(normalizedText, topics)`
- Call site principal:
  - `/Users/axelsearagomez/Desktop/test de proyecto/src/App.tsx` en `onShareUrl`.
  - Se invoca `classifyPost(...)` y se persisten `topics/subtopics`.

## Dónde están diccionarios/reglas actuales

En `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/classify.ts`:

- `TOPIC_KEYWORDS`
- `LOCATION_KEYWORDS`
- `TOPIC_DOMAIN_HINTS`
- `TOPIC_EXCLUSIONS`
- `TOPIC_PHRASE_SIGNALS`
- `TOPIC_CONTEXT_CLUES`
- `SUBTOPIC_KEYWORDS`

Regla actual resumida:
- score por keyword (título/texto/url con pesos)
- boosts por frases/context clues
- boost por dominio
- threshold dinámico para seleccionar 1..5 topics
- fallback `misc`

## Inputs usados hoy

Entrada de clasificación:
- `url`
- `title`
- `text`
- metadata extendida opcional (cuando `enrich/unfurl` la devuelve)

En la práctica, topic v1 usa sobre todo:
- texto combinado (`title + text + url`)
- dominio (`sourceDomain`)

Origen de metadata (pipeline):
- `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/enrich.ts`
- `/Users/axelsearagomez/Desktop/test de proyecto/supabase/functions/unfurl/index.ts`

## Persistencia

Modelo en FE:
- `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/types.ts` (`Post.topics`, `Post.subtopics`)

Persistencia remota:
- `/Users/axelsearagomez/Desktop/test de proyecto/src/lib/store.ts`
- tabla `posts` columnas actuales: `topics`, `subtopics` (entre otras)

## UI

Lectura y visualización de temas:
- Home: `/Users/axelsearagomez/Desktop/test de proyecto/src/pages/HomePage.tsx`
- Tarjetas: `/Users/axelsearagomez/Desktop/test de proyecto/src/components/PostCard.tsx`
- Tema timeline: `/Users/axelsearagomez/Desktop/test de proyecto/src/pages/TopicPage.tsx`
- Detalle noticia: `/Users/axelsearagomez/Desktop/test de proyecto/src/pages/PostDetailPage.tsx`

## Flujo textual actual

1. Usuario pega URL en modal/share/topic page.
2. `App.onShareUrl` canonicaliza y comprueba duplicado.
3. `enrichUrl` obtiene metadata (title/description/image/etc.).
4. `classifyPost` calcula `topics/subtopics` (junto a calidad/aura).
5. `createPost` persiste en `posts`.
6. UI renderiza chips de topic y rutas `/topic/:topic`.

## Problemas detectados en v1

1. No hay `topic_candidates` estructurado para depuración.
2. No hay explicación formal de por qué se eligió tema.
3. No hay umbrales explícitos tipo `MIN_SCORE`/`DELTA`.
4. No hay configuración externa versionable de reglas (está hardcoded).
5. Señales de metadata estructurada (JSON-LD/meta section/breadcrumbs) no están priorizadas como primera clase en topic.
