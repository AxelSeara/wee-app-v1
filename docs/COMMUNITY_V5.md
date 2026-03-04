# Community Auth v5 (multi-tenant, sin Supabase Auth)

## 1) SQL en Supabase

Ejecuta este archivo completo en SQL Editor:

- `supabase/sql/community_v5.sql`

Qué hace:
- Crea `communities`, `community_users`, `community_user_roles`, `community_invites`, `sessions`.
- Migra datos existentes a comunidad `test`.
- Añade `community_id` a tablas sociales y backfill.
- Mantiene códigos de invitación case-insensitive (normalizados a uppercase).

## 2) Deploy Edge Function

Desde local:

```bash
SUPABASE_ACCESS_TOKEN='TU_TOKEN' npx supabase functions deploy community-api --project-ref gvtynecqpplzuletwduu
```

## 3) Variables en Vercel

En `Project > Settings > Environment Variables`:

- `VITE_SUPABASE_URL=https://gvtynecqpplzuletwduu.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=...`

Opcional:
- `VITE_AURA_RULESET_VERSION=v2`
- `VITE_TOPIC_RULESET_VERSION=v2`

Marca: `Production`, `Preview`, `Development`.
Luego: redeploy.

## 4) Flujo UX implementado

- Entrada: `Crear comunidad` / `Unirse a comunidad`.
- Unirse: preview con nombre de comunidad + botón confirmar.
- Tras confirmar: login/registro por alias+password dentro de esa comunidad.
- Navbar: `Wee | {CommunityName}` + menú `Comunidad`.
- Ruta nueva: `/#/community` con miembros (admins marcados) + normas (`rules_text`).

## 5) Decisiones

- Invite code: case-insensitive, persistido en uppercase.
- Expiración invite: por defecto no expira (`expires_at = null`), opcional por acción explícita.
- Kick: cambia `status='kicked'`; puede re-unirse con invite/código válido.

## 6) Tests

```bash
npm run test -- --run
```

Incluye cobertura mínima para:
- normalización alias
- normalización código invite
- regla “último admin no puede salir”
