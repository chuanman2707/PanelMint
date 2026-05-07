# PanelMint OSS Phase 4 BYOK Provider Simplification Design

Date: 2026-05-07
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 4 makes WaveSpeed provider configuration local and unambiguous.

After this phase, `WAVESPEED_API_KEY` in `.env` is the only API key source for both LLM and image generation. PanelMint OSS no longer stores provider API keys in the database, no longer exposes an in-app key management screen, and no longer requires `ENCRYPTION_SECRET` for provider secrets.

## 2. Baseline Assumption

This design assumes Phase 3 billing removal is implemented.

Credits, pricing, payment, usage accounting, and Premium render mode are no longer part of the active product baseline. Phase 4 should not reintroduce any billing, usage, or tier behavior while changing provider configuration.

## 3. Current Behavior

The app still has two provider key sources:

1. A user-stored WaveSpeed key in `User.apiKey`.
2. A fallback `WAVESPEED_API_KEY` environment variable.

`getProviderConfig(userId)` checks the user record first, decrypts `User.apiKey` when needed, and falls back to `WAVESPEED_API_KEY` only when no DB key exists.

Settings still exposes an Advanced API key flow where the local user can save, validate, or remove a provider key. `/api/user/api-key` reads and writes this database key. `ENCRYPTION_SECRET`, `src/lib/crypto.ts`, and `scripts/migrate-encrypt-api-keys.ts` exist only to support stored user provider secrets.

This conflicts with the OSS v1 contract because a local single-user app should have one obvious BYOK path: configure `.env`, then run the app.

## 4. Impact Notes

GitNexus impact analysis found the central runtime change is high risk:

- `getProviderConfig`: HIGH risk, 6 direct callers, 4 affected pipeline processes.
- Direct callers include character API routes, character sheet routes, `runAnalyzeStep`, `runStoryboardStep`, `runImageGenStep`, and `runCharacterSheetStep`.
- Affected processes include analyze, storyboard, image generation, and character sheet generation.

The API-key helper cleanup is lower risk:

- `getLocalUserApiKey`: LOW risk, 1 direct caller, only `/api/user/api-key`.
- `setLocalUserApiKey`: LOW risk, 1 direct caller, only `/api/user/api-key`.
- `getEnvValidationReport`: LOW risk, 1 direct caller, `/api/health`.

Implementation should change provider resolution first, then remove the now-dead API-key route/UI/helpers/schema. It should not delete shared provider types before pipeline tests are adjusted.

## 5. Target Behavior

`WAVESPEED_API_KEY` is the only key source.

The app does not read, write, decrypt, validate, mask, or store provider API keys in the database.

There is no in-app WaveSpeed key management UI. Settings must not imply that PanelMint has a platform-managed fallback key, a custom key override, or a stored key state.

Generation flows use this provider path:

```text
pipeline or route -> getProviderConfig -> WAVESPEED_API_KEY -> WaveSpeed API
```

If `WAVESPEED_API_KEY` is missing, setup and health surfaces should report that clearly before generation. If generation reaches a provider call without the key, the thrown error should name `WAVESPEED_API_KEY` and explain that it must be set in `.env`.

## 6. Scope

Phase 4 should include:

- Simplify provider config to read from environment variables only.
- Keep WaveSpeed as the only provider.
- Preserve provider defaults for LLM model, image model, base URL, and any fallback image model needed by current image generation code.
- Remove database reads from `getProviderConfig`.
- Remove DB-stored provider key helpers from `local-user`.
- Remove `hasApiKey` if no caller remains.
- Remove `/api/user/api-key` and its tests.
- Remove API-key request validators if no caller remains.
- Remove Advanced API key Settings UI and related client state/copy.
- Remove `User.apiKey` and `User.apiProvider` from Prisma schema, baseline SQL, and migration history.
- Remove `ENCRYPTION_SECRET` from required environment validation when no runtime feature still needs encrypted secrets.
- Delete encryption helper tests, encryption helper code, and key migration script if they have no remaining callers.
- Update README and `.env.example` copy so WaveSpeed BYOK is documented as `.env` configuration, not an in-app stored key.
- Update provider and health tests.

## 7. Non-Scope

Phase 4 should not:

- Replace Inngest with a local worker. That is Phase 5.
- Replace Cloudflare R2 or complete local storage cleanup. That belongs to later worker/storage phases.
- Add multiple AI providers.
- Add a new UI location for entering API keys.
- Preserve DB-stored API keys for compatibility.
- Add a key validation endpoint just for setup.
- Reintroduce usage logging, credit checks, tiers, or billing copy removed in Phase 3.

## 8. Provider Config Design

`src/lib/api-config.ts` remains the single provider config module.

It should export:

- `ApiProvider = 'wavespeed'`.
- `ProviderConfig`.
- `getProviderConfig`.
- Provider defaults or a small helper for provider display metadata if active UI still needs it.

`getProviderConfig` may keep its current `userId` parameter temporarily to reduce caller churn, but it must not query `prisma.user`. If kept, `userId` is metadata only and must not affect key selection.

The function should:

1. Read `process.env.WAVESPEED_API_KEY?.trim()`.
2. Throw a clear setup error when missing.
3. Return the WaveSpeed config with env/model defaults.

`src/lib/ai/llm.ts` should use this shared provider config path when no explicit config is passed. It should not keep a second private provider-default implementation that can drift from `api-config`.

## 9. Database Changes

Remove these fields from `User`:

- `apiKey`
- `apiProvider`

Update these database artifacts consistently:

- `prisma/schema.prisma`
- `prisma/postgres-baseline.sql`
- Prisma migration files or a new destructive migration, depending on the repository's migration policy at implementation time

This is a breaking local schema cleanup. Existing local databases that contain stored keys will not preserve them. Users must move their WaveSpeed key into `.env` before or during upgrade.

## 10. API And Helper Cleanup

Delete `/api/user/api-key` from the local v1 path.

Expected deletions if no other callers remain:

- `src/app/api/user/api-key/route.ts`
- `src/app/api/user/api-key/route.test.ts`
- `src/lib/validators/user.ts`
- `src/lib/crypto.ts`
- `src/lib/__tests__/crypto.test.ts`
- `scripts/migrate-encrypt-api-keys.ts`

Expected local-user cleanup:

- Remove `getLocalUserApiKey`.
- Remove `setLocalUserApiKey`.
- Remove `decrypt`, `encrypt`, and `isEncrypted` imports.
- Keep local owner, project, episode, character, and preferences helpers.

## 11. UI Changes

Settings should no longer contain:

- Advanced API tab or section.
- Provider API key input.
- Save, validate, reveal, or remove key controls.
- Stored key status.
- Provider fallback copy.
- Links that imply an in-app key management flow.

If Settings remains after Phase 3, it should focus only on valid local app settings or profile/preference surfaces. Phase 4 does not need to invent a large replacement settings experience.

Create/generation UI should not ask for a key. If it references setup readiness, it should point users to `.env` and `WAVESPEED_API_KEY`.

## 12. Health And Env Validation

Environment validation should match the local OSS contract.

`DATABASE_URL` remains required for the app.

`WAVESPEED_API_KEY` should be required for generation readiness. The health endpoint should make missing WaveSpeed configuration easy to diagnose, with `WAVESPEED_API_KEY` reported as missing rather than a generic provider error.

`ENCRYPTION_SECRET` should not be required unless a remaining runtime feature explicitly needs encryption after API-key storage is removed.

The health endpoint should keep reporting:

- Database status.
- Env check statuses.
- Runtime identity as local single-user.
- Queue status as the current active queue system until Phase 5 replaces it.

## 13. Error Handling

Missing `WAVESPEED_API_KEY` should produce a clear setup error:

```text
WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.
```

Invalid, expired, rate-limited, or rejected WaveSpeed keys should continue to surface through the existing provider error handling. The app should preserve the current behavior of storing useful error state on the relevant episode, pipeline run, event, character, or panel.

Because `/api/user/api-key` is deleted, key validation happens through health/setup checks and real provider calls, not through a Settings validate button.

## 14. Test Strategy

Update focused tests for:

- `getProviderConfig` returns WaveSpeed config from `WAVESPEED_API_KEY`.
- `getProviderConfig` does not query `prisma.user`.
- `getProviderConfig` throws a clear setup error when `WAVESPEED_API_KEY` is missing.
- `callLLM` uses the shared provider config path when no config is passed.
- Analyze, storyboard, image generation, and character sheet flows still pass provider config through correctly.
- Character route and character sheet route mocks no longer assume DB-stored keys.
- Settings no longer renders Advanced API key controls.
- `/api/user/api-key` route tests are deleted with the route.
- Env validation no longer requires `ENCRYPTION_SECRET`.
- Health reports missing `WAVESPEED_API_KEY` clearly.
- Prisma schema and baseline no longer contain `apiKey` or `apiProvider`.

Required verification:

```bash
npm test
npm run build
rg -n "apiKey|apiProvider|getLocalUserApiKey|setLocalUserApiKey|/api/user/api-key|ENCRYPTION_SECRET|encrypt\\(|decrypt\\(|isEncrypted|migrate-encrypt-api-keys|Advanced API|stored key|platform-managed|fallback key" src prisma scripts README.md .env.example package.json
```

The final `rg` should return no active runtime, schema, script, or test matches for DB-stored API-key behavior. Documentation-only mentions in historical specs are allowed outside the searched active paths.

Before committing implementation changes, run GitNexus change detection and confirm the affected scope matches Phase 4 provider simplification.

## 15. Migration And Compatibility Notes

This phase intentionally breaks compatibility with DB-stored provider keys.

Existing local users must copy their WaveSpeed key into `.env` as `WAVESPEED_API_KEY`. The implementation should not attempt to read old `User.apiKey`, decrypt it, or migrate it to another store.

Fresh local installs should only need `.env` and Postgres setup. They should not need `ENCRYPTION_SECRET`.

If Prisma migration history cannot be rewritten safely on the active branch, implementation may add a destructive migration that drops `apiKey` and `apiProvider`. The chosen migration path must keep fresh `prisma db push` and build/test behavior consistent.

## 16. Definition Of Done

Phase 4 is done when:

- `WAVESPEED_API_KEY` is the only runtime API key source.
- Runtime provider config no longer reads or writes `User.apiKey` or `User.apiProvider`.
- The app no longer stores provider API keys in the database.
- Settings no longer exposes API-key management or fallback-key copy.
- `/api/user/api-key` is gone from the local v1 app path.
- `ENCRYPTION_SECRET` is not required unless a remaining runtime feature explicitly needs it.
- Prisma schema and baseline no longer contain `apiKey` or `apiProvider`.
- Provider, pipeline, health, and Settings tests reflect `.env`-only WaveSpeed configuration.
- README and `.env.example` describe the same `.env` BYOK contract.
- `npm test` and `npm run build` pass.
- GitNexus change detection confirms the affected scope matches Phase 4.
