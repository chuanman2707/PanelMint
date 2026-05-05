# PanelMint OSS Phase 2 Auth Removal Design

Date: 2026-05-05
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 2 removes authentication as a product, runtime, and API concept from the local OSS v1 path.

The intended local user experience is direct: clone the repo, configure local services, start the app, and use PanelMint without login, signup, signout, hosted identity, webhooks, or auth-gated routes.

This phase is more aggressive than only replacing Clerk with a fake session. Clerk must be removed completely from the v1 runtime path and dependency graph, and auth-facing names must be removed from the main runtime path.

## 2. Current Behavior

The app currently uses Clerk as the session authority.

Server-side API and page access flows through `src/lib/api-auth.ts`, which imports Clerk server helpers, resolves a Clerk user ID, and syncs or finds a domain user record.

Client shell state flows through `src/hooks/useAuth.tsx`, which imports Clerk client hooks, checks signed-in state, fetches `/api/auth/me`, and exposes `signout`.

The root layout wraps the app in `ClerkProvider`. `src/proxy.ts` uses Clerk middleware to protect app and immersive routes. Auth pages live under `src/app/auth/**`. Legacy auth API routes live under `src/app/api/auth/**`. Clerk webhook handling lives under `src/app/api/webhooks/clerk/route.ts`.

Environment validation and health output still treat Clerk keys as required or expected in some cases. `package.json` depends on `@clerk/nextjs`.

## 3. Impact Notes

GitNexus impact analysis before this spec found:

- `requireAuth`: HIGH risk, 20 direct callers, 33 impacted symbols when tests are included.
- `requirePageSession`: LOW risk, 1 direct caller, 2 impacted symbols when tests are included.

The direct `requireAuth` callers cover generation, analysis approval, storyboard approval, image generation, retry, cancel, episode listing, characters, usage, credits, API key settings, editor save, and progress/status routes.

Repository search also shows `User` and `userId` are not only auth identity concepts. They currently anchor project ownership, pipeline runs, queue payloads, usage records, credit transactions, provider config, and storage keys.

Because of that, Phase 2 removes auth-facing behavior and naming, but it does not delete the `users` table or all `userId` foreign keys. The remaining user row is a transitional local ownership record, not a login account.

## 4. Target Behavior

A local user can open app routes and API-backed workflows without signing in.

There are no signin, signup, signout, password reset, Clerk webhook, or hosted identity screens in the v1 local path.

The main app no longer has an authenticated/signed-out state. It has a local workspace state. The app resolves a single local owner record as needed, creating it if it does not exist.

API routes still associate projects, episodes, characters, usage, credits, pipeline runs, and storage keys with a stable owner ID until later phases simplify the data model. That owner ID comes from the local workspace resolver, not an auth provider.

Clerk environment variables are not required in local or production mode for OSS v1. The health endpoint reports local auth-free runtime status.

The package no longer depends on `@clerk/nextjs`.

## 5. Scope

Phase 2 should include:

- Remove `@clerk/nextjs` from `package.json` and `package-lock.json`.
- Remove `ClerkProvider` from `src/app/layout.tsx`.
- Remove Clerk middleware from `src/proxy.ts`; delete the proxy if it no longer has a non-auth purpose.
- Delete or fully remove from the v1 path the auth pages under `src/app/auth/**`.
- Delete or fully remove from the v1 path legacy auth action routes under `src/app/api/auth/**`.
- Delete the Clerk webhook route under `src/app/api/webhooks/clerk/route.ts`.
- Delete Clerk-specific error helpers such as `src/lib/clerk-errors.ts`.
- Replace `src/hooks/useAuth.tsx` with local workspace/user state, using non-auth naming such as `useLocalUser` or `useWorkspaceUser`.
- Replace `/api/auth/me` with a local workspace/user endpoint such as `/api/local-user`.
- Replace server auth resolution with a local owner resolver such as `getOrCreateLocalUser`.
- Keep API ownership checks, but remove auth wording from runtime helper, type, hook, route, and file names.
- Remove signout UI and copy from navigation or account surfaces.
- Update env validation and health output so Clerk is not required or reported as the runtime auth provider.
- Update `.env.example` to remove Clerk variables entirely.
- Update README or setup docs if they still mention Clerk as a current local requirement.
- Update tests that mock Clerk, auth pages, auth APIs, proxy protection, or signed-out state.

## 6. Non-Scope

Phase 2 must not become a full data-model collapse.

This phase should not:

- Delete the Prisma `User` model.
- Remove every `userId` foreign key from projects, runs, usage, credits, queue payloads, or storage keys.
- Rewrite pipeline ownership, queue contracts, or storage key layout beyond what auth removal requires.
- Remove billing or credit behavior. That belongs to Phase 3.
- Remove DB-stored provider API key behavior. That belongs to Phase 4.
- Replace Inngest or implement the local worker. That belongs to Phase 5.
- Remove usage records or analytics tables.

Implementation may remove clearly auth-specific fields such as `authUserId` only if the change is small, well-tested, and does not trigger a broad migration rewrite. Otherwise, schema cleanup should be deferred to a later data-model simplification phase.

## 7. Local Ownership Architecture

The app should have one central local owner resolver.

Recommended shape:

```ts
getOrCreateLocalUser(): Promise<LocalUser>
```

The resolver should upsert a stable local owner record with deterministic values, for example:

- email: `local@panelmint.dev`
- name: `Local Creator`
- account tier: existing default tier
- credits: existing default credit behavior until Phase 3 removes credit gates

The exact function and type names can be chosen during implementation, but runtime names must use local owner or workspace vocabulary. Phase 2 must replace auth-shaped runtime symbols such as `requireAuth`, `requirePageSession`, `AuthResult`, `SessionUser`, `ExternalAuthUser`, `AuthProvider`, and `useAuth`.

The current `src/lib/api-auth.ts` and `src/hooks/useAuth.tsx` files should be deleted, renamed, or replaced so the v1 runtime no longer carries auth/session file names. Compatibility wrappers using auth names are not acceptable in the final Phase 2 state.

The explicit exception is the transitional data model root: `User`, `users`, and `userId` may remain as ownership schema terms until a later data-model simplification phase.

Ownership helpers should continue to verify that an episode, project, or character belongs to the local owner ID. In a single-user app this is not access control against another logged-in person; it is data consistency and stale-ID protection.

## 8. Client Architecture

The client shell should stop representing login state.

The replacement for `useAuth` should expose:

- `user` or `localUser`
- `loading`
- `refresh`

It should not expose `signout`.

The provider should fetch the local user endpoint once on app load, create or receive the stable local owner, and let existing UI read display name, tier, and transitional credits until later phases remove billing surfaces.

Sidebar/account UI should no longer show a signout button. Any wording like "signed in", "account", "login", or "auth" should be removed from the local v1 user journey unless it appears in a migration note.

## 9. Route And API Behavior

App and immersive routes are no longer protected by middleware.

Public landing should not call Clerk server helpers or redirect based on signed-in state. It may render as a public entry page or redirect to `/dashboard` by product choice, but the decision must not depend on auth.

The local user endpoint replaces `/api/auth/me`. Existing client consumers should move to the new endpoint.

Legacy auth action routes should be deleted or made unavailable from the v1 path. If Next.js route deletion creates test or build churn, implementation should prefer deletion and update tests rather than retaining dead 410 responses that still describe Clerk.

Webhook routes for Clerk should be deleted.

## 10. Environment And Health

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SIGNING_SECRET` are removed from `.env.example` and from required env validation.

`/api/health` should report local runtime status. Its runtime details should no longer say `auth: clerk`. A valid local value is `auth: none` or `identity: local-single-user`.

The health endpoint should not include notes that position Clerk, Vercel, Neon, Inngest, or R2 as the default target. Phase 2 should fix Clerk health output directly; broader queue/storage notes can remain only if they are clearly transitional and consistent with the roadmap.

## 11. Error Handling

The local owner resolver should fail clearly if the database is unavailable, because local user creation depends on Prisma and Postgres.

API routes should return the existing structured API error behavior for database failures. They should not return `401 Unauthorized` for missing login state in normal local use.

If local owner creation fails because of unexpected duplicate local records, implementation should choose one deterministic record or repair by stable unique key rather than blocking the user behind an auth-style error.

Deleted auth pages and routes should not be reachable from app navigation. Direct requests may return 404 through normal Next.js routing.

## 12. Test Strategy

Required focused tests:

- Local owner resolver creates the default owner when absent.
- Local owner resolver returns the existing owner when present.
- API user/workspace endpoint returns the local owner without auth mocks.
- Client local user hook hydrates from the local endpoint and no longer imports Clerk.
- Layout renders without `ClerkProvider`.
- Proxy/middleware tests are deleted or rewritten to assert no auth protection remains.
- Health/env tests assert Clerk keys are not required and auth runtime is local/none.
- Public landing tests no longer mock Clerk.

Required route coverage:

- Run or update tests for every direct `requireAuth` caller equivalent from GitNexus impact analysis. The required route set is:

  - `src/app/api/generate/route.ts`
  - `src/app/api/characters/route.ts`
  - `src/app/api/episodes/route.ts`
  - `src/app/api/user/usage/route.ts`
  - `src/app/api/user/credits/route.ts`
  - `src/app/api/user/api-key/route.ts`
  - `src/app/api/characters/[characterId]/route.ts`
  - `src/app/api/episodes/[episodeId]/route.ts`
  - replacement for `src/app/api/auth/me/route.ts`
  - `src/app/api/user/usage/summary/route.ts`
  - `src/app/api/user/credits/dev-topup/route.ts`
  - `src/app/api/generate/[runId]/status/route.ts`
  - `src/app/api/generate/[runId]/result/route.ts`
  - `src/app/api/generate/[runId]/generate-images/route.ts`
  - `src/app/api/generate/[runId]/approve-storyboard/route.ts`
  - `src/app/api/generate/[runId]/approve-analysis/route.ts`
  - `src/app/api/generate/[runId]/cancel/route.ts`
  - `src/app/api/editor/[episodeId]/save-bubbles/route.ts`
  - `src/app/api/characters/[characterId]/generate-sheet/route.ts`
  - `src/app/api/episodes/[episodeId]/retry/route.ts`

  The implementation plan may group these routes by shared helper changes, but it must not skip any route family.
- Existing ownership tests should continue to prove stale or wrong episode/project/character IDs return 404.

Required verification:

```bash
npm test
npm run build
! (rg --files src | rg "src/app/auth|src/app/api/auth|src/app/api/webhooks/clerk|src/lib/api-auth|src/hooks/useAuth|src/lib/clerk-errors")
! rg -n "@clerk/nextjs|ClerkProvider|clerkMiddleware|useClerk|useUser|verifyWebhook|CLERK_|requireAuth|requirePageSession|useAuth|AuthProvider|SessionUser|AuthResult|ExternalAuthUser|/api/auth|/auth/|sign[- ]?in|sign[- ]?up|signout|sign out|login|logout" src package.json .env.example
```

Both negated `rg` commands should exit `0` by finding no matches. Documentation-only mentions are allowed only outside this command's runtime targets and must not describe Clerk or auth as a current local requirement.

Before committing implementation changes, run GitNexus change detection to confirm the affected symbols and flows match the expected auth removal scope.

## 13. Migration And Compatibility Notes

This phase intentionally breaks hosted auth compatibility. That is acceptable because PanelMint OSS v1 is a local single-user application.

Existing local database rows linked to Clerk identities can remain usable if they are associated with the selected local owner record during implementation. The implementation plan should decide whether to:

- reuse the first existing user as the local owner, or
- create a new deterministic local owner and leave old users untouched.

The recommended path is to reuse an existing user when exactly one user exists, and otherwise create or select the deterministic local owner by stable email. This avoids losing local projects during migration while keeping behavior deterministic for fresh installs.

No data migration is required for fresh local installs beyond normal Prisma sync.

## 14. Likely Files Affected

Expected core changes:

- `package.json`
- `package-lock.json`
- `.env.example`
- `src/app/layout.tsx`
- `src/proxy.ts`
- create or replace with local naming: `src/lib/local-user.ts`
- create or replace with local naming: ownership helper module for episodes, projects, and characters
- create or replace with local naming: `src/hooks/useLocalUser.tsx` or `src/hooks/useWorkspaceUser.tsx`
- `src/lib/auth.ts`, only for deleting auth-provider sync code or moving remaining local-owner utilities
- `src/components/layout/Providers.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/app/(public)/page.tsx`
- `src/app/api/health/route.ts`
- `src/lib/env-validation.ts`

Expected deletions or replacements:

- `src/app/auth/**`
- `src/app/api/auth/**`
- `src/app/api/webhooks/clerk/route.ts`
- `src/lib/api-auth.ts`
- `src/hooks/useAuth.tsx`
- `src/lib/clerk-errors.ts`
- `src/proxy.test.ts` if proxy is deleted
- Clerk-specific auth tests

Expected test updates:

- replacement for `src/lib/__tests__/api-auth.test.ts` using local-owner naming
- replacement for `src/hooks/useAuth.test.tsx` using local-user or workspace-user naming
- `src/app/(public)/page.test.ts`
- `src/app/api/health/route.test.ts`
- Route tests that mock `requireAuth`
- Component tests that expect signed-out or signout behavior

Names may change during implementation if the plan chooses different local-user file names, but auth/session file names must not remain in the runtime path.

## 15. Risks

The largest risk is partial removal: deleting Clerk imports while leaving auth terminology, dead auth routes, or signed-out UI in place. That would satisfy build cleanup but not the OSS product goal.

The second risk is overreaching into full schema collapse. Deleting `User` and `userId` in this phase would touch billing, usage, provider config, queue payloads, storage, and pipeline execution all at once. That work should be designed separately after Phase 3 through Phase 5 remove the dependencies that currently hang off `userId`.

The third risk is hidden tests or mocks preserving old assumptions. Tests should move away from mocking auth and toward asserting local owner behavior.

## 16. Definition Of Done

Phase 2 is done when:

- The app runs locally without Clerk env vars.
- `@clerk/nextjs` is absent from `package.json` and `package-lock.json`.
- `src/**` has no imports from `@clerk/nextjs`.
- Root layout has no `ClerkProvider`.
- Middleware no longer protects routes with Clerk.
- Auth pages are gone from the local v1 route tree.
- Auth action APIs and Clerk webhook APIs are gone from the local v1 route tree.
- Client state uses local workspace/user naming, not `useAuth` or signed-in/signed-out concepts.
- Runtime helpers and types no longer use auth/session names such as `requireAuth`, `requirePageSession`, `AuthResult`, `SessionUser`, or `ExternalAuthUser`.
- Runtime file names no longer include auth-specific files such as `src/lib/api-auth.ts`, `src/hooks/useAuth.tsx`, or `src/lib/clerk-errors.ts`.
- App navigation has no signout action.
- API routes resolve a stable local owner without session cookies or hosted identity.
- Existing project, episode, character, generation, retry, progress, reader, and editor flows still use a stable owner ID for data consistency.
- `.env.example` no longer includes Clerk variables.
- `/api/health` no longer reports Clerk as the auth runtime.
- Tests no longer mock Clerk.
- Required verification commands pass, or any remaining non-runtime matches are documented.
