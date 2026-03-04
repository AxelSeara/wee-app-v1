# Testing

## Stack

- `vitest`
- tests unitarios en `src/test`

## Comandos

```bash
npm run test
```

Modo watch:

```bash
npm run test:watch
```

## Cobertura funcional actual

## `src/test/classify.test.ts`

Valida:
- normalización de texto
- detección de temas (incluye fallback `misc`)
- clickbait fuerte
- penalización por falta de fuente
- scoring en fuente reputada
- detección de subtemas

## `src/test/duplicates.test.ts`

Valida:
- canonicalización de URL (tracking params, host/path)
- claves duplicadas entre variantes (`http/https`, `m.`)
- clave relajada sin query

## `src/test/topicForum.test.ts`

Valida:
- precisión de detección (evitar falsos positivos)
- ranking del timeline por señal temática real

## Qué no está cubierto todavía

- tests E2E de flujos UI (`login` -> `share` -> `post detail` -> `vote`).
- tests de integración FE/BE contra Supabase (RLS, permisos y errores).
- tests de integración de `enrichUrl` con respuestas remotas.
- tests i18n de copy crítico (ES/EN/GL) en componentes principales.

## Recomendación mínima siguiente

1. Añadir pruebas de integración para `useAppData` (mock store).
2. Añadir test de merge de duplicados en import/export.
3. Añadir E2E ligero con Playwright para flujo crítico.
