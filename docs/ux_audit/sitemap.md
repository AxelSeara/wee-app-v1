# Sitemap UX (estado actual)

## Rutas principales
- `/#/login`
  - Estado `landing`: claim + CTAs (crear cuenta / login).
  - Estado `login`: alias + contraseña + errores inline.
  - Estado `register`: alias + contraseña + confirmación + idioma + privacidad + subida avatar + usuarios existentes.
- `/#/home`
  - Topbar global.
  - Sidebar izquierda: navegación por secciones + búsqueda + usuarios activos.
  - Secciones: popular, topics, news, community.
  - Estados: loading (skeleton), contenido, vacíos parciales por bloque.
- `/#/topic/:topic`
  - Header hilo + KPIs + ajustes tema.
  - Form inline para añadir URL al hilo.
  - Layout 2 columnas: timeline (izquierda), chat/comentarios del tema (derecha).
  - Estados: sin posts, con posts, modo borrar comentarios (admin).
- `/#/post/:postId`
  - Detalle noticia (2 columnas): contenido principal + relacionados/timeline.
  - Acciones: abrir fuente, votar, comentar, ajustar temas, moderación admin.
  - Estados: no encontrado, con imagen/sin imagen, sin URL, tooltip Aura.
- `/#/share`
  - Form simple de URL.
  - Detección de duplicado previa al submit.
  - Estado procesando.
- `/#/profile/:userId`
  - Cabecera usuario + avatar + alias + stats (solo admin ve score interno).
  - Si es propio: cambiar avatar/alias, logout.
  - Si no es propio: comentarios recientes + publicaciones.
- `/#/profile/:userId/posts`
  - Tabs: publicadas / mejor calidad / más Aura.
  - Grid de posts + borrado (propio/admin).
- `/#/settings`
  - Preferencias de temas/filtros.
  - Idioma.
  - Ruido feed (open/balanced/strict).
  - Backup import/export.
  - Privacidad y borrado de datos.
  - Estado backend Supabase (check conexión).

## Patrones transversales
- Modal share (`ShareLinkModal`) desde topbar.
- Toast global (`Toast`).
- Footer con modal About (`AppFooter`).
- Menú de notificaciones (`NotificationsMenu`).
- Transiciones de página (`PageTransition` + `AnimatePresence`).
- Carga inicial/sin datos (`AppSkeleton`).
