# Global User + Multi-Community flow report

## Scope
Implemented incremental migration from `community-scoped auth` to `global auth + community picker`, while preserving existing post/comment data flow.

## P0
- Added global auth primitives and session model:
  - `global_users`, `global_sessions`, `community_members`, `community_profiles`, `user_settings`.
  - SQL: `supabase/sql/community_v6_global_multi.sql`.
- Added backend endpoints in Edge Function:
  - `/auth/register_global`
  - `/auth/login_global`
  - `/auth/logout_global`
  - `/communities/list`
  - `/user/settings/update`
  - `/community/enter`
  - `/community/create_global`
  - `/community/join/by_invite`
- Preserved existing community-scoped data endpoints (`/data/*`) and re-used them after `community/enter`.

## P1
- Frontend flow updated:
  - `/login` => global auth page (`src/pages/AuthPage.tsx`).
  - `/communities` => picker page (`src/pages/CommunitiesPickerPage.tsx`) with:
    - cards for my communities
    - create community CTA
    - join by code/link CTA with preview + confirm
    - “Entrar siempre aquí” support via `default_community_id + skip_picker`.
- Route guards:
  - no global session => `/login`
  - global session + no active community => `/communities`
  - global session + active community => `/home`
- Fallback on lost access (kicked/invalid active session):
  - clears active community session and pushes user back to picker flow.

## P2
- Navbar update:
  - Added `Mis comunidades` entry in profile dropdown (`src/components/TopBar.tsx`).
- Added deterministic navigation helpers + tests:
  - `src/lib/communityNavigation.ts`
  - `src/test/community-navigation.test.ts`

## Tests
- `npm run test -- src/test/community-navigation.test.ts`
- `npm run build`

## Changed files (key)
- Backend:
  - `supabase/functions/community-api/index.ts`
  - `supabase/sql/community_v6_global_multi.sql`
- Frontend/session/api:
  - `src/lib/communitySession.ts`
  - `src/lib/communityApi.ts`
  - `src/lib/appData.ts`
  - `src/lib/communityNavigation.ts`
  - `src/App.tsx`
  - `src/pages/RequireAuth.tsx`
  - `src/components/TopBar.tsx`
  - `src/pages/AuthPage.tsx`
  - `src/pages/CommunitiesPickerPage.tsx`

## Notes
- This is an incremental migration. Legacy community-scoped auth endpoints remain for compatibility.
- Existing social data still relies on `community_users` as author IDs; `community_profiles` bridges global users to those records.
