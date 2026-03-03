# Modelo de datos

## Entidades principales

### User

```ts
interface User {
  id: string;
  alias: string;
  language?: "es" | "en" | "gl";
  avatarDataUrl?: string;
  avatarColor?: string;
  initials?: string;
  createdAt: number;
}
```

Notas:
- `avatarDataUrl` guarda imagen en base64 (local-only).
- Si no hay imagen, se usa `avatarColor` + `initials`.

### Post

```ts
type QualityLabel = "high" | "medium" | "low" | "clickbait";

interface Post {
  id: string;
  userId: string;
  createdAt: number;

  canonicalUrl?: string;
  url?: string;
  title?: string;
  text?: string;

  previewTitle?: string;
  previewDescription?: string;
  previewImageUrl?: string;
  previewSiteName?: string;

  sourceDomain?: string;
  extractedHosts?: string[];

  shareCount?: number;
  contributorUserIds?: string[];
  contributorCounts?: Record<string, number>;

  openedByUserIds?: string[];
  feedbacks?: Array<{
    userId: string;
    vote: 1 | -1;
    votedAt: number;
  }>;

  comments?: Array<{
    id: string;
    userId: string;
    text: string;
    createdAt: number;
    auraUserIds?: string[];
  }>;

  topics: string[];
  subtopics?: string[];

  qualityLabel: QualityLabel;
  qualityScore: number; // 0..100
  interestScore: number; // Aura visible 1..100
  flags: string[];
  rationale: string[];
  normalizedText: string;
}
```

Notas:
- `canonicalUrl` se usa para deduplicar enlaces equivalentes.
- `contributorCounts` permite saber quién compartió duplicados y cuántas veces.
- `openedByUserIds` bloquea voto hasta abrir fuente externa.
- `preview*` guarda metadata para mejorar visualización de tarjetas y detalle.

### UserPreferences

```ts
interface UserPreferences {
  userId: string;
  preferredTopics: string[];
  blockedDomains: string[];
  blockedKeywords: string[];
}
```

### ExportBundle

```ts
interface ExportBundle {
  users: User[];
  posts: Post[];
  preferences: UserPreferences[];
}
```

## Persistencia

Implementada en `src/lib/store.ts`.

IndexedDB (primario):
- `users` (keyPath `id`, index `by-createdAt`)
- `posts` (keyPath `id`, indexes `by-createdAt`, `by-userId`)
- `preferences` (keyPath `userId`)

Fallback localStorage:
- `news-curation-ls-users`
- `news-curation-ls-posts`
- `news-curation-ls-preferences`
- sesión activa: `news-curation-active-user-id`

## Reglas de deduplicación

1. Se canonicaliza URL (`canonicalizeUrl`) eliminando tracking params (`utm_*`, `fbclid`, etc.), `hash`, y normalizando host (`www.`, `m.`, `twitter.com` -> `x.com`).
2. Se generan claves flexibles (`duplicateUrlKeys`):
- clave completa con query ordenada
- clave relajada sin query
3. Si entra duplicado:
- no se crea nuevo post
- se mergea en el post existente
- se suman contribuyentes y contador
- se fusionan feedbacks/comentarios/rationale/topics/subtopics

## Integridad y límites

- `interestScore` se redondea y clampa a `1..100`.
- `qualityScore` se clampa a `0..100`.
- import JSON evita duplicados por `id` y por URL canónica.

## Derivados en memoria (no persistidos como entidad propia)

`useAppData` mantiene estructuras derivadas para ranking y UX:

- `userQualityValueById`: valor agregado de calidad por autor.
- `userInfluenceAuraById`: influencia interna para ponderar votos (`1000..10000`).
- `userCommunityStatsById`: nivel, badges, aura comunitaria y progresión.
