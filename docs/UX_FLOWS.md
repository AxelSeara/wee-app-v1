# Flujos UX

## Principios UX actuales

- Publicar rápido: modal de compartir en navbar.
- Mantener contexto: cada noticia vive en su hilo por tema.
- Evitar ruido: dedupe automático y aviso previo en publicación.
- Acción comunitaria: votar tras abrir fuente y comentar en contexto.
- Tono cercano y directo para público hispanohablante.

## Ruta por ruta

## `/login`

Objetivo:
- Entrar rápido con alias opcional + avatar opcional.
- Elegir idioma del perfil al crear usuario.
- Elegir usuario existente local.

Puntos clave:
- botón dado para alias aleatorio
- persistencia de sesión local (`activeUserId`)

## `/home`

Secciones:
- Topbar con buscador global, menú de perfil y botón compartir.
- Onboarding de 3 pasos (solo primera vez por usuario).
- Sidebar de navegación interna:
  - Popular
  - Temas
  - Noticias
  - Comunidad
- Bloque `Popular ahora` (ranking comunitario).
- Bloques de temas activos con estilo por tema y señal de recencia (chilis).
- `Noticias recientes`.
- `Comunidad`: top contributors + salud de comunidad.

Interacción:
- click en noticia -> `/post/:postId`
- click en tema -> `/topic/:topic`
- búsqueda por texto/tema/fuente desde navbar

## `/post/:postId`

Layout:
- columna principal (2/3): noticia, metadatos, imagen, extracto, acciones
- lateral (1/3): contexto de tema + timeline relacionada

Mecánicas:
- “Abrir fuente” abre pestaña externa y habilita voto de noticia.
- voto positivo/negativo bloqueado hasta abrir fuente.
- explicación de puntuación en bloque plegable.
- comentarios con aura por comentario.

## `/topic/:topic`

Objetivo:
- vista timeline del hilo temático.

Orden:
- `rankTopicPosts` por señal temática + aura + recencia + colaboración.

Interacción:
- tarjeta de noticia dentro del timeline
- comentarios compactos por item

## `/profile/:userId`

Si es perfil propio:
- cambiar/quitar foto
- editar alias
- acceso a “Mis publicaciones”
- cerrar sesión

Si es perfil de otro usuario:
- solo lectura de publicaciones
- sin mostrar puntuación interna de influencia

## `/profile/:userId/posts`

Objetivo:
- gestionar publicaciones propias o revisar publicaciones de otro usuario.

Puntos clave:
- pestañas: publicadas / mejor calidad / más Aura
- eliminar publicación (solo perfil propio)
- acceso rápido a detalle de noticia

## `/settings`

Objetivo:
- personalizar inicio sin complejidad.

Permite:
- idioma de interfaz (ES/EN/GL)
- temas preferidos
- dominios bloqueados
- palabras bloqueadas
- modo rápido de ruido (abierto/equilibrado/estricto)
- exportar/importar JSON

## Modal “Sobre Wee” (footer)

Explica:
- qué es Wee
- cómo funciona el hilo por tema
- cómo se valida calidad

## Microcopy tone

La app está escrita para público hispanohablante con tono:
- cercano
- directo
- no formal en exceso
- centrado en colaboración y utilidad

## Animación y fluidez

- `framer-motion` en transiciones de página (`PageTransition`)
- modal de compartir y modal about con `AnimatePresence`
- animaciones sutiles en tarjetas/hovers

## Reglas UX funcionales importantes

- Nunca forzar abandono de contexto del foro: la lectura principal ocurre dentro de Wee.
- El voto requiere abrir fuente para fomentar verificación.
- Duplicados no crean ruido: consolidan hilo y contribución.
