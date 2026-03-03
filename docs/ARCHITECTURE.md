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
5. `lib/store.ts` persiste en IndexedDB (o localStorage fallback).
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
- valor interno de influencia (`userInfluenceAuraById`).

## Persistencia

- Primario: IndexedDB vía `idb`.
- Fallback: localStorage.
- Almacenamiento local por navegador/dispositivo.

## Módulos clave

- `lib/classify.ts`: motor heurístico (puro y testeable).
- `lib/topicForum.ts`: ranking específico para timeline de tema.
- `lib/enrich.ts`: extracción de metadata de enlaces.
- `lib/i18n.ts`: traducciones ES/EN/GL.
- `lib/store.ts`: acceso a datos local-first.

## Extensibilidad

- Clasificador desacoplado: se puede sustituir por API futura.
- Estructura de tipos estable para migrar a backend compartido.
- UI basada en componentes con props tipadas (sin `any`).
