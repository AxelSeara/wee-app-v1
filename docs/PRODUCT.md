# Producto

## Visión

Wee busca que grupos pequeños compartan noticias en un espacio más útil que un chat: menos enlaces perdidos, más contexto y mejor señal comunitaria.

## Problemas que ataca

- Enlaces dispersos en WhatsApp/X sin seguimiento.
- Duplicados del mismo link en distintas conversaciones.
- Dificultad para separar contenido útil de ruido/clickbait.
- Falta de continuidad temática.

## Propuesta de valor

- Hilos por tema y subtema.
- Dedupe automático por URL canónica.
- Ranking combinado de calidad, Aura, actualidad y colaboración.
- Votación tras abrir fuente para reforzar verificación.
- Comentarios con Aura para mejorar el contexto.

## Principios de producto

- Publicar en segundos.
- Leer rápido en Home y profundizar solo cuando se necesite.
- Priorizar colaboración positiva (no castigo visible).
- Reglas transparentes de clasificación y puntuación.

## Estado actual (MVP avanzado)

- Auth local por alias + avatar + idioma de perfil.
- Auth local con contraseña obligatoria y validación mínima de seguridad.
- Primer usuario registrado pasa a rol `admin`.
- Home con navegación lateral por secciones (`Popular`, `Temas`, `Noticias`, `Comunidad`).
- Página de noticia (`/post/:postId`) con foco en contexto y acción comunitaria.
- Perfil separado de publicaciones (`/profile/:userId` y `/profile/:userId/posts`).
- Ajustes simplificados (idioma, ruido, temas y filtros).
- Soporte i18n en ES/EN/GL.

## Roles y permisos

- `member`:
  - puede publicar, comentar, votar y ver perfiles.
  - en perfiles de otros usuarios ve publicaciones y comentarios recientes.
- `admin`:
  - puede cambiar tema de una noticia.
  - puede renombrar temas globalmente.
  - puede eliminar noticias y comentarios.
  - puede eliminar usuarios.
  - puede ver métricas de perfil de otros usuarios.
  - puede nombrar o retirar admins (sin dejar la comunidad sin admins).

## Norte del producto

Crear microcomunidades activas que prefieran compartir primero en Wee para:

- mantener el contexto vivo,
- curar mejor la información,
- detectar calidad de forma colectiva y explicable.
