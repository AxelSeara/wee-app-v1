# Aura y scoring

## Resumen rápido

Wee usa dos niveles:
- Calidad de noticia (`qualityScore`, `qualityLabel`): mide fiabilidad del contenido.
- Aura de noticia (`interestScore` visible `1..100`): prioriza qué ve primero la comunidad.

Además existe un valor interno por usuario (`userInfluenceAuraById`, `1000..10000`) que pondera sus votos. Este valor no se muestra al usuario final.

## 1) Clasificación base de noticia (`src/lib/classify.ts`)

### Entrada
- `url`
- `title`
- `text`
- `createdAt` (opcional, para recencia)

### Salida
- `topics[]`
- `subtopics[]`
- `qualityLabel`
- `qualityScore`
- `interestScore` (Aura visible)
- `flags[]`
- `rationale[]`

### Detección de tema y subtema
- Diccionario por temas (`TOPIC_KEYWORDS`) y ubicaciones (`LOCATION_KEYWORDS`).
- Señal por keyword con pesos (frases pesan más que términos sueltos).
- Hints por dominio (`TOPIC_DOMAIN_HINTS`).
- Ponderación por campo: título pesa más que texto y URL.
- Si no hay señal: `misc`.
- Subtemas por raíces (`tech/ai`, `economy/inflation`, etc.) solo si el tema raíz fue detectado.

### Detección clickbait
Señales:
- patrones (`"no vas a creer"`, `"you won't believe"`, `"URGENTE"`, `"!!!"`, etc.)
- exceso de emojis
- ratio alto de mayúsculas

Regla:
- señal fuerte => `qualityLabel = clickbait`

### Cálculo de calidad (`qualityScore`)
Base y ajustes:
- reputación de dominio (Tier A/Tier B)
- penalización por red social (ajustada para `x.com` con o sin contexto adicional)
- bonus por URL y HTTPS
- penalización por falta de fuente
- longitud útil de título/texto
- evidencia (números/fechas, cita con atribución)
- penalización por claims no verificados
- penalización por sensacionalismo/clickbait

Rango final: `0..100`.

### Etiqueta de calidad
- clickbait fuerte => `clickbait`
- `>= 75` => `high`
- `>= 50` => `medium`
- resto => `low`

### Cálculo de Aura visible (`interestScore`)
Factores:
- peso base por tema (`TOPIC_WEIGHTS`)
- calidad de noticia
- longitud/contexto
- recencia por horas

Reglas:
- resultado se clampa y redondea a `1..100`
- si clickbait, Aura se limita (`clickbaitMax`)

Fórmula (simplificada):

`interest = 30 + 0.85*topicBoost + 22*((quality-50)/50) + contextBoost + recencyBoost`

Donde:
- `contextBoost = 8*tanh(textLength/220) - 2` (satura para evitar premiar texto muy largo sin límite).
- `recencyBoost = 12*exp(-ageHours/48) - 2.5` (decaimiento continuo, sin saltos bruscos por tramos).

## 2) Ranking en Home

En `HomePage.tsx` se ordena el feed con una mezcla:
- calidad (`qualityScore`)
- Aura visible (`interestScore`)
- valor de calidad del autor (`userQualityValueById`)
- recencia
- evidencia (`flags`)
- bonus de colaboración (varios contribuidores)
- penalización clickbait
- feedback ponderado por Aura interna de cada votante

Mejoras matemáticas aplicadas:
- recencia continua: `14*exp(-ageHours/26) - 3`.
- voto ponderado por reputación con **suavizado bayesiano**:
  - peso por votante: `0.6 + (influence/10000)^1.25 * 1.4`
  - `posterior = weightedVote / (totalWeight + 3.5)`
  - `confidence = totalWeight / (totalWeight + 5)`
  - `feedbackScore = posterior * 22 * confidence`
- Esto evita que 1-2 votos extremos cambien demasiado el ranking.

## 3) Ranking en páginas de tema

`src/lib/topicForum.ts`:
- `topicSignalStrength` del tema concreto
- calidad + Aura visible del post
- recencia
- bonus por colaboración
- feedback con suavizado
- penalización si señal de tema débil

Fórmula principal (simplificada):

`score = signalScore + qualityBase + interestBase + recency + collaboration + feedback - weakPenalty`

Con:
- `signalScore = (1 - exp(-signal/2.2)) * 42` (señal temática fuerte sin crecer infinito).
- `feedback = (voteSum/(nVotes+3))*12` (prior para pocos votos).

## 4) Aura interna del usuario (no visible)

`useAppData` calcula `userInfluenceAuraById` (`1000..10000`) con:
- señal de calidad agregada
- consistencia (ratio alta vs baja calidad)
- volumen de publicaciones (con saturación)
- delta de votos por publicación (con saturación)
- penalización por duplicados repetidos

Uso:
- al ponderar votos en Home (`weightedFeedback`), usuarios más fiables pesan más.

Modelo interno resumido:
- `qualityLift = 2500 * sigmoid((qualitySignal-52)/10.5)`
- `volumeLift = 900 * (1 - exp(-postCount/14))`
- `voteLift = 1100 * tanh(voteDeltaPerPost/2.4)`
- `raw = 1000 + qualityLift + volumeLift + voteLift - duplicatePenalty*35`
- clamp final a `1000..10000`

## 5) Calidad del autor (`userQualityValueById`)

Se usa media bayesiana para reducir volatilidad en usuarios con pocos posts:

`blended = (sampleMean*n + priorMean*priorWeight)/(n+priorWeight)`

Luego se ajusta por consistencia (penalizando % de posts de baja calidad/clickbait).

## 6) Señales de duplicado y penalización

Cuando se comparte un enlace ya existente:
- se fusiona al mismo hilo
- se registra contribución del usuario
- si el mismo usuario repite enlace, se guarda señal de penalización interna en `rationale` y afecta scoring interno de usuario

## 7) Recomendaciones para seguir mejorando (sin IA)

- Añadir lista de dominios por vertical (salud/ciencia/economía) con mantenimiento mensual.
- Añadir parser de estructura de titulares (factual vs. opinativo/sensacional).
- Añadir fiabilidad temporal: penalizar noticias antiguas recicladas sin contexto.
- Introducir umbral mínimo de evidencia para que un post pueda entrar en destacados.
- Calibrar pesos por dataset real de comunidad para reducir sesgo por volumen.
