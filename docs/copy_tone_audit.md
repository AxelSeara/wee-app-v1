# Tone Refresh Audit (ES/EN/GL)

## 1) Inventario i18n (fuentes de strings)
- `src/pages/*` y `src/components/*` usan `pick(language, es, en, gl?)`.
- Fallback GL gestionado en `src/lib/i18n.ts` (`GL_MAP` + `pick`).
- Mensajes de acciones globales/toasts/errores: `src/App.tsx`.
- Traducciones de racionales/rank/badges: `src/lib/i18n.ts`.

## 2) Strings modificadas por archivo (resumen)
- `src/pages/LoginPage.tsx`: landing, crear/unirse comunidad, login, registro, errores de formulario.
- `src/pages/InvitePage.tsx`: preview de invitación, errores, CTA de unión.
- `src/pages/HomePage.tsx`: onboarding, empty states, labels de secciones, CTAs.
- `src/pages/CommunityPage.tsx`: ajustes de comunidad, invites, feedback de copia/guardado.
- `src/pages/TopicPage.tsx`: timeline/chat, empty states, acciones rápidas.
- `src/pages/PostDetailPage.tsx`: detail, report/moderación, ayudas de voto/fuente.
- `src/pages/SharePage.tsx`: flujo de compartir, duplicados y CTA.
- `src/pages/ProfilePage.tsx`: edición de perfil y mensajes de feedback.
- `src/pages/UserPostsPage.tsx`: tabs, vacíos, confirmaciones.
- `src/pages/SettingsPage.tsx`: copy completo de ajustes, backup, backend status.
- `src/components/TopBar.tsx`: branding secundario y menú perfil/comunidad.
- `src/components/ShareLinkModal.tsx`: modal de compartir + feedback duplicados.
- `src/components/PostCard.tsx`: tooltip de Aura + moderación.
- `src/components/PostDetailModal.tsx`: copy completo i18n (antes tenía hardcodes).
- `src/components/CommentsPanel.tsx`: formularios y estados de comentarios.
- `src/components/TopicBlock.tsx`: badges/recencia/acciones.
- `src/components/NotificationsMenu.tsx`: notificaciones y empty state.
- `src/components/AppFooter.tsx`: about/modal + manifiesto de producto.
- `src/components/FiltersBar.tsx`: migrado de hardcode a i18n.
- `src/App.tsx`: toasts/errores de acciones globales y backend messaging.
- `src/lib/i18n.ts`: ampliación `GL_MAP` para nuevas frases ES.

Diff completo:
- Ejecuta `git diff` para ver todos los cambios exactos de copy por línea.

## 3) Antes/Después (20 ejemplos representativos)
1. ES: `Primeros 3 pasos` -> `Empieza en 3 pasos`
2. ES: `Listo` -> `Vamos`
3. ES: `Popular del grupo` -> `Lo que está sonando`
4. ES: `Aún no hay publicaciones` -> `Aún no hay nada por aquí`
5. ES: `Temas activos` -> `Temas en marcha`
6. ES: `Comparte un enlace` -> `Comparte un link`
7. ES: `No pudimos publicar ahora. Inténtalo de nuevo.` -> `Ups, no se pudo publicar ahora. Prueba otra vez.`
8. ES: `Modo eliminar: activo` -> `Modo borrar: activo`
9. ES: `Pásalo por Wee...` -> `Pásalo por Wee y se queda en su tema...`
10. ES: `Qué es Wee` -> mantiene título, texto explicado en tono colega.
11. EN: `Create account` kept, but supporting text moved to casual helper tone.
12. EN: `Could not publish right now.` -> `Oops, couldn't post right now. Try again.`
13. EN: `No updates yet.` -> `All quiet for now.`
14. EN: `Topic timeline with contextual chat...` -> `Topic timeline + chat: all in context, no getting lost.`
15. EN: `Sign in to comment.` -> kept intent with shorter call-to-action style.
16. GL: `Convidáronte a Wee` kept, supporting copy simplified and naturalized.
17. GL: `Aínda non hai nada por aquí` (nuevo empty state más humano).
18. GL: `A túa valoración axuda ao grupo...` (feedback claro y cercano).
19. GL: `Todo tranquilo por agora.` (empty notifications).
20. GL: `Déixao ao teu gusto...` (settings intro simplificado).

## 4) Unificación terminológica
- Se fija uso de `Comunidad` (evitando alternancia confusa con `Grupo` en labels principales).
- Se mantiene `Aura` como señal central.
- Se estandariza `link` en acciones rápidas de compartir.

## 5) Verificación hardcode
Chequeo realizado:
- `rg` sobre `src/pages`, `src/components`, `src/App.tsx` para detectar texto visible fuera de `pick(...)`.
- Se migró `FiltersBar` a i18n.
- Se migró `PostDetailModal` a i18n completo.

Resultado:
- No quedan hardcodes de copy principal en UI fuera de i18n.
- Se mantienen literales técnicos intencionales (`URL`, `https://...`, nombres de estado/telemetría, logs).
