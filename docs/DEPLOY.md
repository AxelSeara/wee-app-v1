# Deploy

## Opción recomendada: Vercel (gratis)

Esta app es SPA estática (Vite + HashRouter), así que encaja directo en Vercel.

## Pasos

1. Sube el repo a GitHub.
2. Entra en [Vercel](https://vercel.com) y conecta el repo.
3. Configuración del proyecto:
- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
4. Variable de entorno:
- No definir `VITE_BASE_PATH` (o dejarla vacía) para base `/`.
5. Variables Supabase obligatorias:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY`)
6. Deploy.

Notas:
- Al usar `HashRouter`, no necesitas reglas especiales de rewrites para refresh.
- Datos de comunidad se guardan en Supabase (compartidos entre usuarios).
- Si falta configuración Supabase, la app muestra error de backend.

## Opción alternativa: GitHub Pages

## 1) Configurar base path

En esta app, `vite.config.ts` usa:

```ts
base: process.env.VITE_BASE_PATH ?? "/"
```

Para Pages necesitas `VITE_BASE_PATH="/REPO_NAME/"`.

## 2) Build local

```bash
VITE_BASE_PATH=/REPO_NAME/ npm run build
```

## 3) Publicar `dist/`

Puedes usar una rama `gh-pages` o GitHub Actions.

Ejemplo con `gh-pages` package (opcional):

```bash
npm i -D gh-pages
```

Añade script en `package.json`:

```json
{
  "scripts": {
    "deploy:gh": "VITE_BASE_PATH=/REPO_NAME/ npm run build && gh-pages -d dist"
  }
}
```

Luego:

```bash
npm run deploy:gh
```

En GitHub -> Settings -> Pages:
- Source: rama `gh-pages` (root)

## Validación post-deploy

- Login/registro funcionan con Supabase Auth.
- Compartir enlace crea post o mergea duplicado.
- Voto bloqueado hasta abrir fuente.
- Perfil permite editar avatar/alias.
- “Mis publicaciones” permite eliminar post propio.
- Settings guarda preferencias (si existe `user_preferences`).
- Cambio de idioma (ES/EN/GL) persiste por usuario.

## Limitación importante

El frontend es estático, pero depende totalmente de backend Supabase:
- sin tablas SQL v2 no funciona correctamente.
- capacidades admin globales requieren SQL v3 adicional.
