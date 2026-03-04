# Design Rules (automatizables)

## Guardrails activos
Se añade script `npm run design:lint` (`scripts/design_lint.mjs`) con reglas:
- `DL001`: todo `<button>` debe declarar `type` explícito (`button|submit|reset`).
- `DL002`: evitar `style={{...}}` inline salvo allowlist justificada (topic colors dinámicos, ancho barra de nivel y ocultar input file).
- `DL003`: asegurar bloques de foco visibles en CSS global para:
  - controles base (`button/a/input/select/textarea`)
  - chips accionables (`.chip-action`)
  - nav lateral (`.side-nav-btn`)
  - menú usuario (`.user-menu-item`)
  - pills topbar (`.nav-pill`)
  - trigger notificaciones (`.notification-trigger`)

## Reglas recomendadas para equipo
- No crear estilos ad-hoc por pantalla para variantes de botón/input/card; extender clases base.
- Mantener espaciado en escala 4/8px.
- Empty/error/loading deben usar patrón reusable (`empty-state`, `error-banner` o equivalente).
- Todo control interactivo debe tener foco visible y target táctil >= 36px.
- Evitar mezclar botones y links con apariencia indistinguible.

## Checklist de PR UX
- ¿La pantalla mantiene jerarquía (título > meta > acción primaria > secundaria)?
- ¿Hay estados loading, empty y error legibles y accionables?
- ¿El flujo de teclado (tab/enter/escape) funciona?
- ¿Se mantiene consistencia de microcopy y capitalización?
- ¿Responsive sin overflow horizontal?

## Component consolidation tasks
1. Unificar header de sección (`.section-head`) entre Home/Topic/Detail con una variante compacta.
2. Consolidar formularios con patrón único `form-field` (label + control + helper/error).
3. Consolidar estado vacío reusable (icono + título + guidance + CTA opcional).
4. Consolidar menú contextual (profile/comments/settings) en una base compartida de dropdown panel.
5. Consolidar tarjetas informativas secundarias (`settings-card`, `detail-side-card`, `home-users-block`) bajo un mismo token de superficie/borde.

## Comandos
- `npm run design:lint`
- `npm run test`
- `npm run build`
