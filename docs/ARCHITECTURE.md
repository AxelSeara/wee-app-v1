# Arquitectura

## Capas

- `src/pages`: vistas por ruta.
- `src/components`: UI reutilizable.
- `src/lib`: dominio (clasificación, ranking, i18n, persistencia, utilidades).
- `src/test`: tests unitarios.

## Flujo de publicación

1. Usuario comparte URL desde modal/navbar o `/share`.
2. `lib/enrich.ts` intenta extraer metadata (título, descripción, imagen, sitio).
3. `lib/classify.ts` ejecuta clasificación heurística (tema/subtema, calidad, Aura).
4. `lib/utils.ts` canonicaliza URL y detecta duplicados.
5. `lib/store.ts` persiste en Supabase (tablas relacionales).
6. `lib/appData.ts` recalcula métricas de comunidad y ranking.

## Router y navegación

- `HashRouter` para despliegue SPA en hosting estático.
- Rutas protegidas con `RequireAuth`.
- Transiciones de navegación con `PageTransition` (Framer Motion).

## Estado de aplicación

`useAppData` es la capa central de datos y operaciones:

- sesión local y usuarios,
- CRUD de publicaciones,
- merge de duplicados,
- feedback/comentarios,
- preferencias de usuario,
- métricas comunitarias (`userCommunityStatsById`),
- valor interno de influencia (`userInfluenceAuraById`),
- control de roles y moderación (`admin/member`).

## Seguridad (modelo backend)

- Auth: Supabase Auth (email sintético por alias + contraseña).
- Autorización: RLS en tablas `profiles`, `posts`, `comments`, `post_votes`, `post_shares`, `post_opens`, `comment_aura`, `user_preferences`.
- Roles:
  - `member` por defecto.
  - `admin` gestionable con policies/SQL v3 (opcional).
- En SQL v2, la mayoría de escrituras de moderación quedan acotadas a recursos propios.
- En SQL v3, se habilitan capacidades admin globales (borrar/editar de terceros, roles).

## Persistencia

- Primario: Supabase Postgres (backend compartido).
- `localStorage` solo para sesión activa en cliente (`news-curation-active-user-id`) y estado visual menor.

## Módulos clave

- `lib/classify.ts`: motor heurístico (puro y testeable).
- `lib/topicForum.ts`: ranking específico para timeline de tema.
- `lib/enrich.ts`: extracción de metadata de enlaces.
- `lib/i18n.ts`: traducciones ES/EN/GL.
- `lib/store.ts`: acceso a datos backend-first (Supabase).

## Extensibilidad

- Clasificador desacoplado: se puede sustituir por API futura.
- Estructura de tipos estable para extender SQL (RPC, moderation logs, analytics, etc.).
- UI basada en componentes con props tipadas (sin `any`).
