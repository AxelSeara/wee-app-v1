# Backlog UX/UI priorizado

| Issue | Severidad | Impacto | Esfuerzo | Ubicación | Fix recomendado | Criterios de aceptación |
|---|---|---|---|---|---|---|
| Focus no uniforme en controles secundarios | P1 | Alto (a11y/usabilidad) | Quick win (1-2h) | `global.css`, `TopBar`, cards/chips | Unificar `:focus-visible` y anillos por componente | Tab visible en nav/chips/dropdowns sin pérdida de contexto |
| Estados vacíos heterogéneos | P1 | Alto | Quick win (1-2h) | `CommentsPanel`, `TopicPage`, `UserPostsPage` | Patrón `empty-state` con microcopy y CTA contextual | Todos los vacíos críticos muestran título + guía + tono consistente |
| Formularios con patrones mixtos | P1 | Medio-alto | Quick win (1-2h) | `LoginPage`, `SharePage`, `SettingsPage` | Introducir `form-field`, helper/error consistente | Labels, spacing y altura de controles consistentes |
| Cabeceras densas en Topic/Detail | P2 | Medio | Medium (0.5-1d) | `TopicPage`, `PostDetailPage` | Separar acciones primarias/secundarias y simplificar barra superior | Escaneado más rápido y menos saltos de línea en móvil |
| Variantes de cards no consolidadas | P2 | Medio | Medium (1-2d) | `global.css` + componentes | Crear base de card surface y migrar gradualmente | Menos overrides y look más coherente entre áreas |
| Mensajes técnicos en Settings mezclados con copy usuario | P2 | Medio | Medium (0.5d) | `SettingsPage` | Reescribir microcopy y mover detalle técnico a tooltip/info | Comprensión en <5s por usuario no técnico |
| Skeleton global demasiado invasivo tras acciones locales | P1 | Alto | Large (multi-day) | `useAppData` + capas fetch/update | Carga granular por recurso/acción y optimistic updates | Añadir comentario no dispara skeleton global completo |
| Faltan tests E2E básicos de navegación teclado | P2 | Medio | Large (multi-day) | infra QA | Añadir Playwright/Cypress smoke de tab/focus/forms | Suite pasa en CI y detecta regresiones de foco |
| Consolidar sistema de motion (duraciones/easing por tipo) | P3 | Medio | Medium (0.5-1d) | `global.css`, `lib/motion` | Definir tokens por intención (hover, enter, emphasize) | Animaciones percibidas coherentes en toda la app |
| IA de navegación secundaria en Home mejorable | P3 | Medio | Medium (1d) | `HomePage` | Revisar orden y jerarquía de side nav vs contenido | Usuarios encuentran sección objetivo en <=2 interacciones |

## Quick wins implementados en este batch
- Focus visible reforzado en controles secundarios.
- Patrón de form field aplicado en pantallas clave.
- Empty states mínimos mejorados en comentarios/hilos/listado usuario.
- Guardrail automatizado `design:lint` añadido.

## No incluido en este batch
- Reestructura de IA global.
- Refactor grande de cards/layout.
- Infra visual regression tests (pendiente de stack E2E).
