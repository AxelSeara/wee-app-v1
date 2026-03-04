# UX/UI Audit Report (heurístico)

## Resumen ejecutivo
- El producto tiene identidad visual consistente (dark editorial/comunidad) y buena base de componentes reutilizados.
- Los principales problemas están en consistencia de detalle (espaciado, estados vacíos, affordance/focus en elementos secundarios y densidad en pantallas de hilo/detalle).
- Hay deuda de guardrails: faltan reglas automatizadas para evitar que reaparezcan estilos ad-hoc y regresiones de accesibilidad.

## Hallazgos por heurística

### A) Jerarquía visual
Fortalezas
- Tipografía y branding estables en `src/styles/global.css` (Rajdhani + Space Grotesk).
- Escalas visuales razonables en cards/listados.

Problemas
- Variaciones de espaciado no sistemáticas entre layouts de auth/settings/detail/topic (`src/styles/global.css`: `.auth-*`, `.settings-*`, `.detail-*`, `.topic-*`).
- Estados vacíos mezclan formatos (`<p class="hint">` vs `article.empty-state`) sin patrón único (`CommentsPanel`, `TopicPage`, `UserPostsPage`).

### B) Navegación e IA
Fortalezas
- IA clara en rutas principales y menú lateral (Home).
- `HashRouter` correcto para static hosting.

Problemas
- En algunos bloques hay múltiples acciones compitiendo en la cabecera (detalle y topic settings), reduciendo escaneabilidad (`PostDetailPage`, `TopicPage`).
- Enlaces/botones visualmente similares en algunos contextos (`.link-btn` vs `.btn`), creando fricción leve de affordance.

### C) Interacciones y feedback
Fortalezas
- Buen feedback de acciones: toasts + loading dots + skeleton global.
- Votación condicionada por abrir fuente está implementada.

Problemas
- En estados vacíos de comentarios/fuentes faltaba guidance accionable en algunos paneles.
- Algunas interacciones tienen foco visual global, pero elementos secundarios no tenían ring dedicado consistente (chips/menús laterales/items de menú).

### D) Consistencia de componentes
Fortalezas
- Reutilización real de `TopBar`, `PostCard`, `CommentsPanel`, `Avatar`, `Icon`.

Problemas
- Inputs/labels en forms no siguen un único patrón semántico/visual en todas las páginas.
- Existen muchos estilos por clase específica de pantalla; dificulta evolución y crea riesgo de drift visual.

### E) Accesibilidad básica
Fortalezas
- Hay `:focus-visible` global y botones con `aria-label` en varios puntos.

Problemas
- Foco en controles compuestos (chips y nav lateral) no estaba uniformado.
- Estados de error dependen mucho de color (`.error`, `.warning`) con poca jerarquía extra.

### F) Responsive
Fortalezas
- Breakpoints para `800/1024/640` y layout adaptativo en Home/Topic/Detail.

Problemas
- En pantallas pequeñas algunos bloques conservan densidad alta de controles en cabeceras (topic/detail).
- Riesgo de truncado con tooltips contextualizados en cards contiguas (ya mitigado parcialmente, pero sensible a z-index/overflow).

### G) Contenido UI (copy)
Fortalezas
- Tono comunitario cercano, no excesivamente formal.

Problemas
- Conviven microcopies muy directos con otros más técnicos (especialmente en settings/backend).

### H) Performance percibida
Fortalezas
- Skeletons y motion ya presentes.

Problemas
- Skeleton global se re-renderiza en eventos amplios de datos; percepción de recarga total en acciones puntuales (no resuelto en este batch porque requiere capa de estado más granular).

## Riesgos clave
- Riesgo de regresión visual alto por ausencia de design lint.
- Riesgo a11y medio por focos incompletos en componentes secundarios.
- Riesgo de inconsistencia UI medio-alto por expansión de estilos de pantalla sin reglas compartidas.

## Evidencias (rutas)
- Sistema de estilos globales: `src/styles/global.css`
- Navegación global: `src/components/TopBar.tsx`
- Listado base: `src/components/PostCard.tsx`
- Detalle noticia: `src/pages/PostDetailPage.tsx`
- Hilo tema/chat: `src/pages/TopicPage.tsx`
- Comentarios reutilizables: `src/components/CommentsPanel.tsx`
- Auth: `src/pages/LoginPage.tsx`
- Settings: `src/pages/SettingsPage.tsx`
