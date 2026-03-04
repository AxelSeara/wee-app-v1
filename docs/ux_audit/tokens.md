# Design System Light (tokens + mapeo)

## Estado actual
Los tokens base existen en `:root` dentro de `src/styles/global.css`:
- Color: `--bg-*`, `--panel-*`, `--line`, `--ink-*`, `--brand`, `--accent-*`, `--danger/success/warning`.
- Radius: `--radius-md`, `--radius-lg`.
- Motion: `--motion-fast/base/slow`, `--ease-*`.

## Propuesta mínima (compatible)

### Color
- `--color-bg-canvas`: actual `--bg-0`
- `--color-bg-surface`: actual `--panel-0`
- `--color-bg-surface-elevated`: actual `--panel-1`
- `--color-border-default`: actual `--line`
- `--color-text-primary`: actual `--ink-0`
- `--color-text-secondary`: actual `--ink-1`
- `--color-accent-primary`: actual `--brand`
- `--color-status-success/warning/danger`: actuales `--success/--warning/--danger`

### Tipografía
- Familia display: `Rajdhani`
- Familia body: `Space Grotesk`
- Escala recomendada:
  - `--font-size-xs: 0.75rem`
  - `--font-size-sm: 0.875rem`
  - `--font-size-md: 1rem`
  - `--font-size-lg: 1.125rem`
  - `--font-size-xl: 1.375rem`

### Espaciado (8pt-friendly)
- `--space-1: 0.25rem`
- `--space-2: 0.5rem`
- `--space-3: 0.75rem`
- `--space-4: 1rem`
- `--space-5: 1.25rem`

### Shape/Elevation
- Radio: `--radius-md`, `--radius-lg`
- Sombra card base: estandarizar a una capa principal + una interna sutil.

### Motion
- Hover/press: `--motion-fast`
- Entrada panel/modales: `--motion-base`
- Evitar animaciones simultáneas en exceso en la misma vista.

## Mapeo inmediato a componentes
- `Button`: usar siempre `.btn` + modificadores (`.btn-primary`, `.btn-icon-compact`).
- `Input`: estandarizar estilos base de `input/select/textarea` + `.form-field` para label+control.
- `Card`: mantener base de `post-card`/`settings-card` y converger gradualmente en un patrón común de borde/radio/padding.

## Qué no se cambia en esta fase
- No se cambia branding, paleta base ni familia tipográfica principal.
- No se rehace arquitectura de componentes ni layout macro.
