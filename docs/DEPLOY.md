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
5. Deploy.

Notas:
- Al usar `HashRouter`, no necesitas reglas especiales de rewrites para refresh.
- Datos son locales por navegador/dispositivo (no compartidos entre usuarios).

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

- Login funciona y persiste sesión local.
- Compartir enlace crea post o mergea duplicado.
- Voto bloqueado hasta abrir fuente.
- Perfil permite editar avatar/alias.
- “Mis publicaciones” permite eliminar post propio.
- Settings export/import JSON funciona.
- Cambio de idioma (ES/EN/GL) persiste por usuario.

## Limitación importante (para tests de comunidad)

Aunque esté online en Vercel o Pages, sigue siendo local-first:
- cada usuario guarda datos en su navegador
- no hay sincronización entre personas sin backend compartido

Para comunidad real multiusuario compartida necesitas backend free (por ejemplo Supabase/Firestore free tier).
