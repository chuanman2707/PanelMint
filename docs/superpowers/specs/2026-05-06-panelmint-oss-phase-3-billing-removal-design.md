# PanelMint OSS Phase 3 Billing Removal Design

Date: 2026-05-06
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 3 removes the in-app money system from PanelMint OSS.

After this phase, the local app no longer has credits, pricing, payment, usage accounting, paid tiers, or Premium render mode. A user can create comics locally with their own WaveSpeed API key. Any real cost is paid directly through the user's WaveSpeed account, not through PanelMint credits.

## 2. Current Behavior

The app still behaves partly like a SaaS product.

The local user has `credits`, `accountTier`, and `lifetimePurchasedCredits`. The database has credit transaction and usage record tables. The create form shows a credit balance, estimates credit cost, blocks submit when the balance is too low, and locks Premium render behind a paid tier.

Backend routes and pipeline steps still call `checkCredits`, `deductCredits`, and `refundCredits`. LLM and image generation still call `logUsage`.

Public and app UI still exposes pricing, payment-status, credit packs, transaction history, and usage/cost copy.

## 3. Impact Notes

GitNexus impact analysis found the core cleanup is high risk:

- `deductCredits`: CRITICAL risk, 5 direct callers, 5 affected pipeline processes.
- `checkCredits`: HIGH risk, 6 direct callers, 3 affected pipeline processes.
- `refundCredits`: HIGH risk, 3 direct callers, 3 affected pipeline processes.
- `logUsage`: CRITICAL risk, 2 direct callers, 8 affected generation processes.
- `generatePanelImage`: HIGH risk, 2 direct callers, 4 affected generation processes.

Because of this, implementation must remove callers carefully by flow. It should not delete shared files first and then chase build errors.

## 4. Target Behavior

The app has one simple local generation path:

```text
input story -> analyze -> review analysis -> storyboard -> review storyboard -> generate images -> read/edit
```

No action is blocked by PanelMint credits.

There is no credit balance, no top-up, no checkout, no pricing page, no payment status page, no credit ledger, and no internal usage/cost log.

There is one image generation mode. The request payload no longer needs `imageModelTier`, the project no longer stores `imageModel`, and the UI no longer shows Standard/Premium choices.

Character sheets are no longer a Premium-only feature. After analysis approval, the app should enqueue character sheet generation for characters that have descriptions. If a character sheet fails, the error should be recorded, but storyboard progress should not be undone.

## 5. Scope

Phase 3 should include:

- Remove credit checks from generate, analyze, storyboard, image generation, retry, and character sheet paths.
- Remove credit deduction and refund behavior from pipeline code.
- Remove usage logging from LLM and image generation.
- Delete billing and usage helper modules after all runtime callers are gone.
- Delete credit, usage, pricing, and payment routes from the local v1 path.
- Remove credit, pricing, payment, and Premium tier UI from Create, Settings, Sidebar, Dashboard, and public pages.
- Simplify generation request validation so it accepts story text, art style, and page count only.
- Simplify image generation to one WaveSpeed image model.
- Update tests to assert generation is not blocked by credits and does not call billing helpers.
- Update Prisma schema and baseline SQL to remove billing, usage, and render-tier schema.

## 6. Non-Scope

Phase 3 should not:

- Replace Inngest or implement the local worker. That is Phase 5.
- Remove DB-stored provider API key behavior. That is Phase 4.
- Replace Cloudflare R2/local storage behavior unless a billing removal edit touches the same code path.
- Collapse the `User` table entirely. It still acts as the local owner record.
- Remove rate limiting. Local limits still protect accidental repeated requests.

## 7. Database Changes

Remove these fields and relations from `User`:

- `credits`
- `accountTier`
- `lifetimePurchasedCredits`
- `creditTransactions`
- `usageRecords`

Remove these models:

- `CreditTransaction`
- `UsageRecord`

Remove this field from `Project`:

- `imageModel`

Remove this field from `PipelineEvent`:

- `creditOperationKey`

Update `prisma/postgres-baseline.sql` and the Prisma migration history consistently. Because this is an OSS local cleanup, destructive schema changes are acceptable. Existing local databases may need to be reset or migrated with dropped columns/tables.

## 8. Backend Flow Changes

`src/app/api/generate/route.ts` should create the project and episode without checking credits, without checking paid tier, and without writing `imageModel`.

`runAnalyzeStep` and `runStoryboardStep` should run provider calls without credit preflight or deduction.

`runImageGenStep` should find approved panels, generate images, update status, and handle errors without checking total credit cost or per-panel credit balance.

`executePanelImageGeneration` should reserve the panel, call image generation, update panel status, and record pipeline events without deducting or refunding credits.

`runCharacterSheetStep` and manual character sheet generation should call WaveSpeed and update character images without charging or refunding credits.

Retry routes should validate ownership and panel state, then enqueue work. They should not check a balance.

## 9. One Render Mode

Remove `ImageModelTier`, `IMAGE_MODEL_TIERS`, `normalizeImageModelTier`, `canAccessPremium`, `getImageGenerationCreditCost`, `getImageGenerationReason`, and credit cost estimation.

`generatePanelImage` should always use the configured WaveSpeed image model. There should be no Standard/Premium branch and no Premium-only reference image path.

The create form should not persist or submit `imageModelTier`. Saved local drafts should ignore old `imageModelTier` data if it exists.

## 10. UI Changes

Create form:

- Remove available balance.
- Remove estimated credit cost.
- Remove top-up link.
- Remove Standard/Premium selector.
- Remove insufficient credit blocking.

Sidebar:

- Remove pricing nav item.
- Remove credit balance.
- Remove paid/free tier copy.

Settings:

- Remove credits tab, credit packs, dev top-up, ledger, and plan status.
- Keep provider/API-key settings for now because Phase 4 owns provider simplification.

Public pages:

- Remove pricing route and pricing links.
- Remove pricing section from landing.
- Replace credit/payment wording with local generation wording.

App pages:

- Delete dashboard pricing page.
- Delete payment status page.

## 11. Deleted Or Retired Files

Expected deletions:

- `src/lib/billing.ts`
- `src/lib/credit-catalog.ts`
- `src/lib/usage.ts`
- `src/lib/__tests__/billing.test.ts`
- `src/lib/__tests__/usage.test.ts`
- `src/app/api/user/credits/route.ts`
- `src/app/api/user/credits/route.test.ts`
- `src/app/api/user/credits/dev-topup/route.ts`
- `src/app/api/user/credits/dev-topup/route.test.ts`
- `src/app/api/user/usage/route.ts`
- `src/app/api/user/usage/route.test.ts`
- `src/app/api/user/usage/summary/route.ts`
- `src/app/api/user/usage/summary/route.test.ts`
- `src/app/(public)/pricing/page.tsx`
- `src/app/(app)/dashboard/pricing/page.tsx`
- `src/app/(app)/payment/status/page.tsx`

Implementation may find more tests or snapshots that should be deleted instead of rewritten if they only prove billing behavior.

## 12. Error Handling

Missing or invalid WaveSpeed API configuration should remain a clear generation error.

Image generation errors should keep the current panel-level behavior: mark the panel `error` or `content_filtered`, record a pipeline event, and allow retry.

Character sheet failure should record a failed character-sheet event and continue. It should not require a refund because no charge happened.

Retry should fail only for normal validation cases, such as missing episode, wrong local owner, no failed panels, or invalid panel IDs.

## 13. Test Strategy

Update focused tests for:

- Generate route creates a project without credit checks or paid-tier checks.
- Generate request no longer accepts or requires `imageModelTier`.
- Analyze and storyboard steps do not call billing helpers.
- Image generation step does not pre-check or deduct credits.
- Panel image executor updates panel status without billing calls.
- Character sheet generation runs without billing calls.
- Retry route queues panels without credit checks.
- Create form submits without credit props and without insufficient-credit UI.
- Sidebar and Settings no longer show credit/pricing/payment surfaces.
- Public landing no longer links to pricing.
- Prisma schema tests or mocks no longer include `creditTransaction` or `usageRecord`.

Required verification:

```bash
npm test
npm run build
rg -n "checkCredits|deductCredits|refundCredits|grantCredits|InsufficientCredits|creditTransaction|usageRecord|CreditTransaction|UsageRecord|credits|billing|pricing|payment|checkout|premium|imageModelTier|accountTier|lifetimePurchasedCredits" src prisma package.json
```

The final `rg` should return no runtime matches. Documentation-only mentions are allowed in roadmap/spec docs, but not in active source, schema, package scripts, or tests.

Before committing implementation changes, run GitNexus change detection and confirm the affected scope matches this Phase 3 cleanup.

## 14. Migration And Compatibility Notes

This phase intentionally breaks old credit/payment data compatibility.

For fresh local installs, `prisma db push` should create the simplified schema.

For existing local databases, users should either reset the database or apply the destructive schema change. The implementation docs should be honest about this if README or troubleshooting text is touched.

Existing projects that used `Project.imageModel = "premium"` should fall back to the single render mode after the column is removed.

## 15. Definition Of Done

Phase 3 is done when:

- No app action is blocked by PanelMint credits.
- The database schema no longer contains billing, credit, usage, or render-tier fields/tables.
- Runtime code no longer imports billing or usage helpers.
- Create, retry, analyze, storyboard, image generation, and character sheet flows run without credit checks.
- Pricing, payment, credit, and usage routes are gone from the v1 user journey.
- The UI no longer asks users to buy credits or upgrade for Premium.
- The app has one image generation mode.
- Tests and build pass.
- GitNexus change detection confirms the affected scope matches Phase 3.
