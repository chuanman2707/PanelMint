# Stitch UI Migration Plan — NeoComic Ink Design System

## Overview

**What:** Migrate 10 Stitch UI screens (project `3145441628265278542`) into the panelmint Next.js 16 codebase.
**Why:** Apply the "NeoComic Ink" design system consistently across all pages for MVP readiness.
**How:** Lock the route/auth shell contract first (`(public)` + `(app)` + `(immersive)`) → download HTML from each Stitch screen as pixel-perfect reference → convert to React/Next.js components → integrate with existing business logic.

**Project Type:** WEB (Next.js 16 App Router)
**Primary Agent:** `frontend-specialist`
**Design System:** NeoComic Ink ("Analog Futurist" — Electric Yellow primary, 4px hard block shadows, Space Grotesk headlines)

---

## Success Criteria

| Criteria | Measurement |
|---|---|
| All 10 screens implemented | Visual match against Stitch screenshots |
| 4 missing pages created | Pricing, Payment Status, Legal/Terms, My Library routes work |
| Design tokens updated | NeoComic Ink tokens in `design-tokens.css` |
| Consistent component library | All pages use shared Neo-* components |
| No build errors | `npm run build` passes |
| Navigation complete | Sidebar updated with all new routes |
| Route contract locked | Public/app/immersive redirects and shells behave as designed |
| Automated regressions added | Vitest route tests + Playwright core flows pass |

---

## Tech Stack

| Layer | Current | Action |
|---|---|---|
| Framework | Next.js 16 App Router | Keep |
| Auth | Clerk | Keep |
| Styling | Tailwind CSS + CSS Custom Properties (`--neo-*`) | Update tokens |
| Fonts | Space Grotesk (display) + Space Mono (mono) | Add Inter (body) |
| Components | `src/components/ui/` (NeoButton, NeoCard, etc.) | Extend |

---

## Stitch Screens → Weoweo Mapping

| # | Stitch Screen | Screen ID | Target Route | File(s) | Status |
|---|---|---|---|---|---|
| 1 | Landing Page | `c62a6262` | `/` (public) | `src/app/(public)/page.tsx` | **[NEW]** — current `/` is Dashboard |
| 2 | Dashboard | `d227d84d` | `/dashboard` | `src/app/(app)/dashboard/page.tsx` | **[MOVE]** from `src/app/page.tsx` |
| 3 | My Library | `5770aa4c` | `/library` | `src/app/(app)/library/page.tsx` | **[NEW]** |
| 4 | Create Workspace | `1c5bc0bd` | `/create` | `src/app/(app)/create/page.tsx` | **[REWRITE]** |
| 5 | Comic Detail / Reader | `9a129e9b` | `/read/[episodeId]` | `src/app/(immersive)/read/[episodeId]/page.tsx` | **[REWRITE]** |
| 6 | Settings | `0a5bae19` | `/settings` | `src/app/(app)/settings/page.tsx` | **[REWRITE]** |
| 7 | Authentication Wrapper | `cd8e239a` | `/auth/signin`, `/auth/signup` | `src/app/auth/signin/page.tsx`, `signup/page.tsx` | **[REWRITE]** |
| 8 | Pricing | `4eedf319` | `/pricing` | `src/app/(public)/pricing/page.tsx` | **[NEW]** |
| 9 | Payment Status | `a20013a3` | `/payment/status` | `src/app/(app)/payment/status/page.tsx` | **[NEW]** |
| 10 | Legal / Terms | `e0689d8a` | `/legal` | `src/app/(public)/legal/page.tsx` | **[NEW]** |

> **Route Groups:** `(public)` = no auth required, no sidebar. `(app)` = auth required, sidebar layout. `(immersive)` = auth required, no sidebar, full-screen reader/editor surfaces.
> ✅ **APPROVED** — User confirmed route restructure approach (2026-03-29).
> ✅ **REVISED** — User approved Phase 1.5, protected immersive routes, `/dashboard` as canonical app home, and automated route/E2E coverage (2026-03-29).

---

## File Structure (After Migration)

```
src/
├── app/
│   ├── (public)/                    # [NEW] Public route group
│   │   ├── layout.tsx               # [NEW] No sidebar, public navbar
│   │   ├── page.tsx                 # [NEW] Landing Page (Stitch: c62a6262)
│   │   ├── pricing/
│   │   │   └── page.tsx             # [NEW] Pricing (Stitch: 4eedf319)
│   │   └── legal/
│   │       └── page.tsx             # [NEW] Legal/Terms (Stitch: e0689d8a)
│   ├── (app)/                       # [NEW] Authenticated route group
│   │   ├── layout.tsx               # [MOVE] Sidebar layout from current setup
│   │   ├── dashboard/
│   │   │   └── page.tsx             # [MOVE] from src/app/page.tsx
│   │   ├── library/
│   │   │   └── page.tsx             # [NEW] My Library (Stitch: 5770aa4c)
│   │   ├── create/
│   │   │   ├── page.tsx             # [REWRITE] (Stitch: 1c5bc0bd)
│   │   │   └── useCreateWorkflow.ts # [KEEP] existing logic
│   │   ├── settings/
│   │   │   └── page.tsx             # [REWRITE] (Stitch: 0a5bae19)
│   │   └── payment/
│   │       └── status/
│   │           └── page.tsx         # [NEW] Payment Status (Stitch: a20013a3)
│   ├── (immersive)/                 # [NEW] Protected, no-sidebar route group
│   │   ├── layout.tsx               # [NEW] auth gate without app chrome
│   │   ├── read/
│   │   │   └── [episodeId]/
│   │   │       └── page.tsx         # [MOVE+REWRITE] Reader (Stitch: 9a129e9b)
│   │   └── editor/
│   │       └── [episodeId]/
│   │           └── page.tsx         # [MOVE] existing editor under immersive shell
│   ├── auth/                        # [KEEP] route structure
│   │   ├── signin/page.tsx          # [REWRITE] (Stitch: cd8e239a)
│   │   ├── signup/page.tsx          # [REWRITE]
│   │   └── ...                      # [KEEP] callback, reset, update
│   ├── api/                         # [KEEP] as-is
│   ├── layout.tsx                   # [MODIFY] root layout = global-only providers
│   └── globals.css                  # [MODIFY] update imports
├── components/
│   ├── ui/                          # [EXTEND] shared components
│   │   ├── NeoButton.tsx            # [REWRITE] match NeoComic Ink spec
│   │   ├── NeoCard.tsx              # [REWRITE] 4px borders, hard shadows
│   │   ├── NeoInput.tsx             # [REWRITE] focus states
│   │   ├── NeoTag.tsx               # [NEW] pill tags, monospace
│   │   ├── NeoTerminalHeader.tsx    # [NEW] terminal-style panel headers
│   │   ├── NeoBentoGrid.tsx         # [NEW] bento box grid layout
│   │   ├── NeoNavbar.tsx            # [NEW] public page navbar
│   │   └── ...                      # [KEEP] Modal, icons, etc.
│   ├── dashboard/
│   │   └── DashboardSections.tsx    # [REWRITE] match Stitch Dashboard
│   ├── layout/
│   │   ├── Sidebar.tsx              # [REWRITE] add Library, Pricing nav
│   │   └── Providers.tsx            # [MODIFY] app-only auth shell helper, no global sidebar ownership
│   └── ...                          # [KEEP] other components
├── e2e/                             # [NEW] Playwright route + UX regression coverage
├── styles/
│   ├── design-tokens.css            # [REWRITE] NeoComic Ink tokens
│   └── semantic-classes.css         # [REWRITE] match NeoComic Ink spec
└── ...
```

---

## Task Breakdown

### Phase 0: Foundation — Design Tokens & Core Components
> **Priority:** P0 (Critical) — All other phases depend on this
> **Agent:** `frontend-specialist`

#### Task 0.1: Update Design Tokens
- [ ] **INPUT:** NeoComic Ink design system spec from Stitch
- [ ] **OUTPUT:** Updated `src/styles/design-tokens.css`
- [ ] **VERIFY:** CSS custom properties match NeoComic Ink spec

**Key changes:**
```diff
- --neo-shadow-button: 0 4px 14px rgba(0,0,0,0.1);    /* Soft blur */
+ --neo-shadow-button: 4px 4px 0 #09090B;               /* Hard offset */
- --neo-shadow-card: 0 8px 30px rgba(0,0,0,0.08);
+ --neo-shadow-card: 8px 8px 0 #09090B;
- --neo-bg-canvas: #F9F8F3;
+ --neo-bg-canvas: #fbf9f4;
+ --neo-accent-yellow: #FFD500;                          /* Electric Yellow */
+ --neo-accent-cyan: #63C7F9;
+ --neo-accent-pink: #FF6B6B;
+ --neo-accent-lime: #7BE495;
- --neo-border-width: 2px;
+ --neo-border-width: 4px;
+ --neo-border-width-sm: 2px;
```

#### Task 0.2: Rewrite Semantic Classes
- [ ] **INPUT:** Design tokens + NeoComic Ink component spec
- [ ] **OUTPUT:** Updated `src/styles/semantic-classes.css`
- [ ] **VERIFY:** Button hover = translate(4px, 4px), shadow disappears. Focus = yellow shadow.

#### Task 0.3: Rewrite Core UI Components
- [ ] **INPUT:** Stitch HTML + design spec
- [ ] **OUTPUT:** Updated `NeoButton.tsx`, `NeoCard.tsx`, `NeoInput.tsx`
- [ ] **VERIFY:** Components render with 4px borders, hard shadows, correct hover/press animations

#### Task 0.4: Create New Shared Components
- [ ] **INPUT:** Stitch HTML patterns
- [ ] **OUTPUT:** `NeoTag.tsx`, `NeoTerminalHeader.tsx`, `NeoBentoGrid.tsx`, `NeoNavbar.tsx`
- [ ] **VERIFY:** Components render correctly in isolation

#### Task 0.5: Add Inter Font to Root Layout
- [ ] **INPUT:** NeoComic Ink typography spec (Inter for body)
- [ ] **OUTPUT:** Updated `src/app/layout.tsx` — import Inter from `next/font/google`
- [ ] **VERIFY:** Body text renders in Inter, headlines in Space Grotesk

---

### Phase 1: Route Architecture — Public/App Split
> **Priority:** P0 (Critical)
> **Agent:** `frontend-specialist`

#### Task 1.1: Create Route Groups
- [ ] **INPUT:** Current flat route structure
- [ ] **OUTPUT:** `src/app/(public)/layout.tsx`, `src/app/(app)/layout.tsx`
- [ ] **VERIFY:** Public pages have no sidebar/auth spinner. App pages have sidebar.

#### Task 1.2: Move Dashboard to `(app)/dashboard`
- [ ] **INPUT:** `src/app/page.tsx` + `src/components/dashboard/DashboardSections.tsx`
- [ ] **OUTPUT:** `src/app/(app)/dashboard/page.tsx`
- [ ] **VERIFY:** `/dashboard` route works and becomes canonical app home for authenticated users

#### Task 1.3: Update Sidebar Navigation
- [ ] **INPUT:** Current Sidebar + new routes
- [ ] **OUTPUT:** Updated `Sidebar.tsx` with Dashboard, Library, Create, Settings, Pricing entry points
- [ ] **VERIFY:** All app-shell nav items link to correct routes and active-state logic no longer assumes `/` is dashboard

#### Task 1.4: Update Root Redirect Logic
- [ ] **INPUT:** Clerk auth state
- [ ] **OUTPUT:** Root `/` shows Landing Page (public) or redirects to `/dashboard` (authed)
- [ ] **VERIFY:** Anon users see Landing, authed users see Dashboard

---

### Phase 1.5: Route Contract & Protected Immersive Surfaces
> **Priority:** P0 (Critical)
> **Agent:** `frontend-specialist`

#### Task 1.5.1: Move Shell Ownership Out of Root Providers
- [ ] **INPUT:** `src/app/layout.tsx`, `src/components/layout/Providers.tsx`, current app-shell behavior
- [ ] **OUTPUT:** Root layout becomes global-only; app shell ownership moves into `(app)/layout.tsx`
- [ ] **VERIFY:** Public routes do not mount sidebar or app auth-loading chrome

#### Task 1.5.2: Update Clerk Middleware + Route Allowlist
- [ ] **INPUT:** `src/proxy.ts`, auth redirect rules
- [ ] **OUTPUT:** Explicit public allowlist for `/`, `/pricing`, `/legal`, plus protected handling for `(app)` and `(immersive)` routes
- [ ] **VERIFY:** Anonymous users can reach all public routes; protected routes still redirect to `/auth/signin?from=...`

#### Task 1.5.3: Create Protected `(immersive)` Group
- [ ] **INPUT:** Current `read` + `editor` routes and auth requirements
- [ ] **OUTPUT:** `src/app/(immersive)/layout.tsx`, migrated `read/[episodeId]`, migrated `editor/[episodeId]`
- [ ] **VERIFY:** Reader/editor stay protected, render without sidebar, and keep full-screen UX

#### Task 1.5.4: Normalize Canonical App Home + Return Paths
- [ ] **INPUT:** Current hardcoded `/` links in sidebar, create, read, editor, and related surfaces
- [ ] **OUTPUT:** All app return paths target `/dashboard`
- [ ] **VERIFY:** No authenticated exit path incorrectly returns to the public landing page

#### Task 1.5.5: Lock Redirect Matrix in Tests
- [ ] **INPUT:** Route contract decisions from Phase 1 + 1.5
- [ ] **OUTPUT:** Route regression tests for anonymous vs authenticated navigation
- [ ] **VERIFY:** `/`, `/dashboard`, `/library`, `/create`, `/settings`, `/payment/status`, `/read/[episodeId]`, `/editor/[episodeId]`, `/pricing`, `/legal` all match the approved contract

---

### Phase 2: Landing Page (Public)
> **Priority:** P1 (High)
> **Agent:** `frontend-specialist`
> **Stitch Reference:** Screen `c62a6262` (5846px tall, full-scroll landing)

#### Task 2.1: Download & Analyze Landing Page HTML
- [ ] **INPUT:** Stitch screen HTML URL
- [ ] **OUTPUT:** Reference HTML saved, section structure documented
- [ ] **VERIFY:** HTML downloaded successfully

#### Task 2.2: Build Landing Page
- [ ] **INPUT:** Stitch reference HTML + NeoComic Ink design tokens
- [ ] **OUTPUT:** `src/app/(public)/page.tsx` with all sections
- [ ] **VERIFY:** Visual match with Stitch screenshot. All sections present.

#### Task 2.3: Create Public Navbar
- [ ] **INPUT:** Landing page navigation needs
- [ ] **OUTPUT:** `NeoNavbar.tsx` — Logo, nav links, CTA button
- [ ] **VERIFY:** Navbar appears on all public pages. Responsive.

---

### Phase 3: Dashboard + My Library
> **Priority:** P1 (High)
> **Agent:** `frontend-specialist`

#### Task 3.1: Rewrite Dashboard
- [ ] **INPUT:** Stitch `d227d84d` HTML + existing `DashboardSections.tsx` logic
- [ ] **OUTPUT:** Rewritten `DashboardSections.tsx` + Dashboard page
- [ ] **VERIFY:** API calls work, episodes load, filter works, delete works, and fetch/delete failures show explicit error states instead of silent empty UI

#### Task 3.2: Create My Library Page
- [ ] **INPUT:** Stitch `5770aa4c` HTML
- [ ] **OUTPUT:** `src/app/(app)/library/page.tsx`
- [ ] **VERIFY:** Page renders under app shell, derives completed comics from existing episode/project data, and handles empty/error states explicitly

---

### Phase 4: Creator + Comic Reader
> **Priority:** P1 (High)
> **Agent:** `frontend-specialist`

#### Task 4.1: Rewrite Create Workspace Page
- [ ] **INPUT:** Stitch `1c5bc0bd` HTML + existing `useCreateWorkflow.ts` logic
- [ ] **OUTPUT:** Rewritten `src/app/(app)/create/page.tsx`
- [ ] **VERIFY:** Form submits, workflow hooks still work, cancel calls the server cancel endpoint, and done/error exits return to `/dashboard`

#### Task 4.2: Rewrite GenerateForm Component
- [ ] **INPUT:** Stitch visual reference + existing `GenerateForm.tsx` logic
- [ ] **OUTPUT:** Rewritten `src/components/GenerateForm.tsx`
- [ ] **VERIFY:** All form fields work, UI art-style values normalize to the API contract, and credit gating remains correct

#### Task 4.3: Rewrite Comic Reader
- [ ] **INPUT:** Stitch `9a129e9b` HTML + existing `ComicReader.tsx` logic
- [ ] **OUTPUT:** Rewritten `(immersive)/read/[episodeId]/page.tsx` + `ComicReader.tsx`
- [ ] **VERIFY:** Episode data loads, panels render, navigation between panels works, and reader error/exit paths resolve to `/dashboard` deterministically

---

### Phase 5: Auth + Payments
> **Priority:** P2 (Medium)
> **Agent:** `frontend-specialist`

#### Task 5.1: Rewrite Auth Pages
- [ ] **INPUT:** Stitch `cd8e239a` HTML + Clerk integration
- [ ] **OUTPUT:** Rewritten `signin/page.tsx`, `signup/page.tsx`
- [ ] **VERIFY:** Clerk SignIn/SignUp components render within NeoComic Ink wrapper

#### Task 5.2: Create Pricing Page
- [ ] **INPUT:** Stitch `4eedf319` HTML
- [ ] **OUTPUT:** `src/app/(public)/pricing/page.tsx`
- [ ] **VERIFY:** Pricing tiers display, CTA buttons link to auth/payment

#### Task 5.3: Create Payment Status Page
- [ ] **INPUT:** Stitch `a20013a3` HTML
- [ ] **OUTPUT:** `src/app/(app)/payment/status/page.tsx`
- [ ] **VERIFY:** Success/failure states render correctly

#### Task 5.4: Rewrite Settings Page
- [ ] **INPUT:** Stitch `0a5bae19` HTML + existing settings logic (737 lines)
- [ ] **OUTPUT:** Rewritten `src/app/(app)/settings/page.tsx`
- [ ] **VERIFY:** All tabs work (API keys, credits, provider config)

---

### Phase 6: Supporting Pages
> **Priority:** P3 (Low)
> **Agent:** `frontend-specialist`

#### Task 6.1: Create Legal/Terms Page
- [ ] **INPUT:** Stitch `e0689d8a` HTML
- [ ] **OUTPUT:** `src/app/(public)/legal/page.tsx`
- [ ] **VERIFY:** Page renders, content is readable, navigation works

---

## Phase X: Verification

### Automated Tests
```bash
# 1. Build verification — must pass with zero errors
npm run build

# 2. Lint check
npm run lint

# 3. Existing + new route/API regression tests
npx vitest run

# 4. Type check
npx tsc --noEmit

# 5. Browser/E2E regression suite
npx playwright test
```

### Route/API Regression Coverage
- [ ] Add `src/app/api/episodes/route.test.ts`
- [ ] Add `src/app/api/episodes/[episodeId]/route.test.ts`
- [ ] Add `src/app/api/generate/[runId]/status/route.test.ts`
- [ ] Add `src/app/api/generate/[runId]/result/route.test.ts`
- [ ] Add `src/app/api/generate/[runId]/cancel/route.test.ts`
- [ ] Add regression coverage for create-form art-style normalization
- [ ] Add regression coverage for create-flow cancel behavior

### Playwright Coverage
- [ ] Add `playwright.config.ts`
- [ ] Add `e2e/route-shell.spec.ts` for public/app/immersive redirect behavior
- [ ] Add `e2e/create-reader-flow.spec.ts`
- [ ] Add `e2e/auth-and-redirects.spec.ts`
- [ ] Add `e2e/settings-billing.spec.ts`

### Visual Verification (Browser)
For each screen, compare against Stitch screenshots after automated regressions pass:
1. Open each route in browser
2. Compare layout, colors, typography, spacing against Stitch reference
3. Test interactive elements (hover, click, focus states)
4. Test responsive behavior (resize browser)

### Manual Verification (User)
- [ ] Navigate all routes: `/`, `/dashboard`, `/library`, `/create`, `/read/[id]`, `/editor/[id]`, `/settings`, `/pricing`, `/payment/status`, `/legal`, `/auth/signin`
- [ ] Verify anonymous vs authenticated behavior on `/`, `/dashboard`, `/pricing`, `/legal`
- [ ] Test full comic creation flow: Create → Generate → Review → Read
- [ ] Verify Clerk auth flow: Sign up → Sign in → Sign out
- [ ] Check Sidebar navigation completeness
- [ ] Verify mobile responsiveness (resize to 375px width)

### Rule Compliance
- [ ] No purple/violet hex codes in any CSS
- [ ] No 1px borders on structural elements (minimum 2px)
- [ ] No soft shadows (blur > 0) on card/button elements
- [ ] Hard offset shadows on all interactive elements
- [ ] Space Grotesk for headlines, Inter for body, Monospace for data/tags

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Settings page is 737 lines — complex rewrite | High | Preserve all business logic, only change JSX/CSS |
| Clerk auth components have limited styling | Medium | Use Clerk's `appearance` prop for customization |
| Route group migration may break shell ownership and auth redirects | High | Add Phase 1.5, explicit route matrix, and route regression tests before screen fan-out |
| Public landing may accidentally stay behind auth wall | High | Update `src/proxy.ts` allowlist before page work ships |
| `/dashboard` contract may regress hardcoded return paths | High | Normalize all authenticated exit links during Phase 1.5 and cover them in Playwright |
| Stitch HTML may not convert cleanly to React | Medium | Use as visual reference, code React from scratch |

---

## Dependencies

```
Phase 0 (Foundation)
  └──► Phase 1 (Routes)
        └──► Phase 1.5 (Route Contract + Immersive Protection)
              ├──► Phase 2 (Landing)
              ├──► Phase 3 (Dashboard + Library)
              ├──► Phase 4 (Creator + Reader)
              ├──► Phase 5 (Auth + Payments)
              └──► Phase 6 (Legal)
                    └──► Phase X (Verification: Vitest + Playwright + Visual QA)
```

Phase 0, 1, and 1.5 are sequential blockers. Phases 2–6 can only fan out after the route contract, middleware allowlist, and canonical `/dashboard` app-home semantics are locked.

---

## /autoplan Continuation Context

- Prior `/autoplan` work stopped after Phase 2 because the previous session hit quota.
- Preserved handoff:
  - `Phase 2 complete. Codex: 9 concerns. Claude subagent: 10 issues. Consensus: 7/7 confirmed gaps. Passing to Phase 3.`
- Phase 1 and Phase 2 section-level artifacts were not preserved in this file, so the eng review below is grounded in:
  - the surviving handoff summary,
  - the approved design doc at `~/.gstack/projects/panelmint/binhan-main-design-20260323-183438.md`,
  - the live repo state on `main` as of 2026-03-29.

## Phase 3 — Eng Review

### Step 0: Scope Challenge

**Working assumption:** this is still a UI migration, not a stealth backend expansion. The plan only stays safe if route ownership, auth boundaries, and return-path semantics are treated as first-class architecture work instead of incidental page moves.

#### What already exists

| Sub-problem | Existing code | Reuse decision | Notes |
|---|---|---|---|
| Global auth boundary | `src/proxy.ts`, `src/lib/api-auth.ts` | Reuse + modify | Clerk middleware already protects almost every non-auth route. Public pages will not exist until the allowlist changes. |
| Global shell + sidebar | `src/components/layout/Providers.tsx`, `src/components/layout/Sidebar.tsx`, `src/hooks/useAuth.tsx` | Replace ownership, reuse data seams | Current shell is pathname-based and renders sidebar for every non-`/auth` route. |
| Dashboard list/delete behavior | `src/app/page.tsx`, `src/app/api/episodes/route.ts`, `src/app/api/episodes/[episodeId]/route.ts` | Reuse logic, move route | Existing dashboard already owns list/delete/CTA behavior; the route is what changes. |
| Create workflow | `src/app/create/page.tsx`, `src/app/create/useCreateWorkflow.ts`, `/api/generate/*` routes/tests | Reuse logic, tighten contracts | This is already a state machine with route/API coupling. It is not a pure visual swap. |
| Reader/editor ownership | `src/app/read/[episodeId]/page.tsx`, `src/components/ComicReader.tsx`, `src/app/editor/[episodeId]/page.tsx` | Reuse data/auth patterns, redesign shell contract | Both are protected experiences, but neither fits the future public/app split cleanly. |
| Billing/settings data | `src/app/settings/page.tsx`, `src/app/api/user/credits/route.ts`, `src/app/api/user/api-key/route.ts`, `src/lib/billing.ts` | Reuse heavily | Settings already carries credits, BYOK CRUD, and purchase history. |
| UI wrappers | `src/components/ui/Button.tsx`, `Input.tsx`, `Surface.tsx`, `NeoButton.tsx`, `NeoCard.tsx`, `NeoInput.tsx` | Reuse wrappers, do not duplicate | There is already a compatibility layer. The migration should consolidate it instead of creating a third layer. |
| Tokens and semantics | `src/styles/design-tokens.css`, `src/styles/semantic-classes.css`, `src/app/globals.css` | Reuse + rewrite carefully | Repo still mixes legacy `--weo-*` consumers with newer `--neo-*` consumers. |

#### Complexity check

- The plan already touches 10 route/page targets before counting shared shell, tokens, and wrapper components.
- The current hot-zone UI files alone total `2217` lines (`settings`, `create`, `dashboard`, `reader`, `sidebar`, token files, and the Neo wrappers).
- The document says "Phases 2–6 can be done in parallel after Phase 1", but that is false in the current repo because `/`, sidebar ownership, auth middleware, and return-path assumptions couple all of those phases together.

#### Search check

- `[Layer 1]` Next.js App Router route groups and nested layouts already solve the public/app split. Do not keep the current pathname-based shell once route groups land.
- `[Layer 1]` Public-vs-protected redirects belong at the route/middleware boundary, not as a client-side afterthought inside migrated pages.

**EUREKA:** everyone will be tempted to treat this as "port 10 screens from Stitch." In this repo, the risky part is not HTML conversion. The risky part is replacing the root shell contract (`Providers` + `Sidebar` + Clerk middleware + hardcoded `/` assumptions). Until that contract is explicit, every page migration stays coupled.

#### Scope verdict

- Keep the 10-screen migration scope.
- Insert a new **Phase 1.5: Route Contract & Shell Ownership** before any screen-specific implementation.
- Reclassify the rest of the work into:
  - shell contract,
  - canonical navigation/redirect matrix,
  - screen migrations,
  - regression tests.

### Step 0.5 — Dual Voices

#### CODEX SAYS (eng — architecture challenge)

Codex surfaced these concerns during a deep repo inspection before the pass hit diminishing returns:

1. The plan is already stale on framework versioning: the document says Next.js 15, while the repo is on Next.js `16.2.1`.
2. The new public routes will never render until `src/proxy.ts` stops protecting everything except `/auth` and a few APIs.
3. The current shell contract in `src/components/layout/Providers.tsx` is incompatible with route groups because it still renders sidebar + auth loading state on every non-`/auth` path.
4. Root-path assumptions are spread across `Sidebar`, create success, reader error, and editor back-link, so the claim that later phases can run in parallel is false.
5. The design-token migration is underspecified because the repo still has live `--weo-*` consumers and wrapper components that bridge old and new styling.
6. `/library` and especially `/payment/status` are not "just page adds" unless the data contract is made explicit.

#### CLAUDE SUBAGENT (eng — independent review)

1. `Critical` Public/app split is incomplete because Clerk middleware and the global shell still treat almost every non-`/auth` route as protected + sidebar-bearing.
2. `High` Protected non-sidebar experiences are not designed; `read` and `editor` need their own immersive protected grouping.
3. `High` "Keep existing create logic" currently preserves two real bugs: art-style enum drift and local-only cancel behavior.
4. `High` Pricing/payment routes are not backed by a real checkout/status flow today.
5. `Medium` Test strategy is too shallow; manual browser checks will miss the riskiest regressions.
6. `Medium` Error paths are underspecified and some current screens already collapse failures into silent empty UI.
7. `Medium` Settings rewrite is not a skin swap; it needs structure before markup replacement.

#### ENG DUAL VOICES — CONSENSUS TABLE

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude   Codex   Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               no      no      CONFIRMED GAP
  2. Test coverage sufficient?         no      no      CONFIRMED GAP
  3. Performance risks addressed?      partial partial CONFIRMED GAP
  4. Security threats covered?         partial partial CONFIRMED GAP
  5. Error paths handled?              no      no      CONFIRMED GAP
  6. Deployment risk manageable?       risky   risky   CONFIRMED GAP
═══════════════════════════════════════════════════════════════
CONFIRMED = both voices identify the same problem shape.
Current result: 6/6 confirmed gaps.
```

### 1. Architecture Review

#### Issue 1 — Shell ownership is missing

**Finding:** the plan adds `(public)` and `(app)` route groups, but the live shell is still owned by `src/components/layout/Providers.tsx`, which wraps everything except `/auth` in `AuthProvider + Sidebar`. If that ownership stays in place, landing/pricing/legal will still get auth loading and sidebar chrome.

**Auto-decision:** move shell ownership into route-group layouts and shrink `src/app/layout.tsx` to global concerns only (fonts, `ClerkProvider`, CSS imports).

**Recommended target topology**

```text
src/app/layout.tsx
└── global only
    ├── ClerkProvider
    ├── fonts + globals.css
    └── no sidebar decisions

src/app/(public)/layout.tsx
├── marketing/public chrome
├── no AuthProvider
└── routes: /, /pricing, /legal

src/app/(app)/layout.tsx
├── AuthProvider
├── Sidebar
└── routes: /dashboard, /library, /create, /settings, /payment/status

src/app/(immersive)/layout.tsx
├── protected, no sidebar
└── routes: /read/[episodeId], /editor/[episodeId]

src/app/auth/*
└── auth-only chrome
```

#### Issue 2 — Public routes require a redirect matrix, not just folders

**Finding:** the repo currently protects every non-auth route in `src/proxy.ts`. The plan mentions root redirect logic, but it does not specify the full contract for anonymous vs authenticated navigation.

**Auto-decision:** add an explicit route matrix to the plan:

| Route | Anonymous | Authenticated |
|---|---|---|
| `/` | render landing | redirect to `/dashboard` |
| `/pricing` | render public page | render public page |
| `/legal` | render public page | render public page |
| `/dashboard` | redirect to `/auth/signin?from=%2Fdashboard` | render app shell |
| `/library` | redirect to signin | render app shell |
| `/create` | redirect to signin | render app shell |
| `/settings` | redirect to signin | render app shell |
| `/payment/status` | redirect to signin unless intentionally publicized later | render app shell |
| `/read/[episodeId]` | redirect to signin | render immersive protected shell |
| `/editor/[episodeId]` | redirect to signin | render immersive protected shell |

#### Issue 3 — `read` and `editor` cannot stay as undefined shell exceptions

**Finding:** the current plan keeps `read` at root and says `editor` is keep-as-is. That preserves ambiguous shell behavior forever.

**Auto-decision:** add `(immersive)` as a protected no-sidebar route group and move both `read` and `editor` under the same ownership model, even if their URLs stay unchanged.

#### Issue 4 — "Parallel after Phase 1" is incorrect

**Finding:** current code assumes `/` is the dashboard in multiple places. Screen migrations cannot safely fan out until that contract is fixed.

**Auto-decision:** insert this sequence:

1. Phase 0: tokens + wrapper compatibility
2. Phase 1: route groups + middleware allowlist + canonical app home
3. Phase 1.5: redirect matrix + shell ownership + immersive routes
4. Phase 2A: dashboard/library/create/read/settings/auth updates for the new contract
5. Phase 2B: marketing pages (`/`, `/pricing`, `/legal`)
6. Phase 3: verification + regression tests

#### Architecture ASCII dependency graph

```text
                +---------------------------+
                | src/app/layout.tsx        |
                | ClerkProvider + globals   |
                +-------------+-------------+
                              |
      +-----------------------+------------------------+
      |                        |                        |
      v                        v                        v
+----------------+   +----------------+      +--------------------+
| (public)       |   | (app)          |      | (immersive)        |
| no AuthProvider|   | AuthProvider   |      | auth gate only     |
| no Sidebar     |   | Sidebar        |      | no Sidebar         |
+-------+--------+   +--------+-------+      +----------+---------+
        |                     |                         |
        |                     |                         |
        v                     v                         v
   /, /pricing, /legal   /dashboard, /library,    /read/[episodeId],
                         /create, /settings,      /editor/[episodeId]
                         /payment/status

Critical supporting contracts:
- src/proxy.ts: public-route allowlist + protected-route redirects
- src/components/layout/Sidebar.tsx: canonical app home must become /dashboard
- hardcoded return paths: create success, reader error, editor back link
```

### 2. Code Quality Review

#### Issue 5 — Preserve logic seams before visual rewrite

**Finding:** `src/app/settings/page.tsx` is `736` lines and mixes tab state, credits data, BYOK CRUD, and UI composition. `src/app/create/page.tsx` is smaller, but still drives a multi-phase workflow on top of `useCreateWorkflow`.

**Auto-decision:** split large page rewrites into:

- route container,
- data/view-model hook,
- presentational sections.

That keeps the Stitch migration explicit and testable instead of producing larger client monoliths.

#### Issue 6 — Token migration needs a compatibility plan

**Finding:** the repo still has active `--weo-*` consumers (`reset-password`, `update-password`, large parts of `settings`, `Surface`, `Button`, `Input`) alongside `--neo-*` consumers.

**Auto-decision:** keep a temporary compatibility layer during the migration:

- rewrite `design-tokens.css` and `semantic-classes.css`,
- keep wrapper components (`Button`, `Input`, `Surface`) pointing at the new Neo primitives,
- do not attempt a hard cut to neo-only tokens in the same migration.

### 3. Test Review

#### Test framework detection

- `CLAUDE.md` says tests are Vitest in node mode.
- `package.json` confirms `vitest run`.
- Existing tests cover APIs and libs well, but there is no browser E2E framework and no client-component test harness.

#### CODE PATH COVERAGE

```text
CODE PATH COVERAGE
===========================
[+] Route contract / shell ownership
    ├── [GAP] [→E2E] anon "/" renders landing with no sidebar
    ├── [GAP] [→E2E] authed "/" redirects to "/dashboard"
    ├── [GAP] [→E2E] "/pricing" + "/legal" bypass Clerk middleware
    └── [GAP] [→E2E] "/read/:id" + "/editor/:id" stay protected but immersive

[+] Dashboard surface
    ├── [GAP] [→E2E] "/dashboard" list + delete flow after route move
    ├── [GAP]         dashboard load failure shows error, not empty state
    ├── [GAP]         delete failure restores UI state or message
    └── [GAP]         nav + CTA return paths use "/dashboard", not "/"

[+] Create workflow
    ├── [★★  TESTED] POST /api/generate happy path + premium gate — src/app/api/generate/route.test.ts
    ├── [★★★ TESTED] approve-analysis ownership + validation — src/app/api/generate/[runId]/approve-analysis/route.test.ts
    ├── [★★  TESTED] approve-storyboard ownership — src/app/api/generate/[runId]/approve-storyboard/route.test.ts
    ├── [★★  TESTED] generate-images subset queueing — src/app/api/generate/[runId]/generate-images/route.test.ts
    ├── [★★  TESTED] retry failed panels — src/app/api/episodes/[episodeId]/retry/route.test.ts
    ├── [GAP] [CRITICAL] cancel button actually calls POST /api/generate/[runId]/cancel
    ├── [GAP] [CRITICAL] UI art-style values normalize to the API enum set
    └── [GAP] [→E2E] resume/done/error exits return to "/dashboard"

[+] Reader / editor immersive flows
    ├── [★   TESTED] editor ownership boundary — src/app/editor/[episodeId]/page.test.ts
    ├── [GAP] [→E2E] reader loads result under protected immersive layout
    ├── [GAP]         reader error CTA targets "/dashboard"
    └── [GAP]         editor back-link stops assuming "/"

[+] Billing / settings / payments
    ├── [★★  TESTED] /api/user/credits route — src/app/api/user/credits/route.test.ts
    ├── [★★  TESTED] /api/user/api-key route — src/app/api/user/api-key/route.test.ts
    ├── [GAP]         settings tab query-param persistence after rewrite
    ├── [GAP] [→E2E] pricing CTA path is honest about auth/payment state
    ├── [GAP] [→E2E] payment-status success / failure / abandon states
    └── [GAP]         direct route tests for episodes list/delete + status/result/cancel

[+] Design token compatibility
    ├── [GAP]         legacy --weo-* pages remain readable during token migration
    └── [GAP]         wrapper components preserve API while visuals change

─────────────────────────────────
COVERAGE: 7/22 paths tested (32%)
  Code paths: 7/12 (58%)
  User flows: 0/10 (0%)
QUALITY:  ★★★: 1  ★★: 5  ★: 1
GAPS: 15 paths need tests (8 need E2E)
─────────────────────────────────
```

#### Test requirements added to the plan

1. Add missing direct route tests:
   - `src/app/api/episodes/route.test.ts`
   - `src/app/api/episodes/[episodeId]/route.test.ts`
   - `src/app/api/generate/[runId]/status/route.test.ts`
   - `src/app/api/generate/[runId]/result/route.test.ts`
   - `src/app/api/generate/[runId]/cancel/route.test.ts`
2. Add regression coverage for the create flow contract:
   - extract art-style normalization into a pure helper and test it in Vitest,
   - wire cancel through the existing cancel endpoint and regression-test the client-side call path.
3. Add browser-level coverage:
   - `playwright.config.ts`
   - `e2e/route-shell.spec.ts`
   - `e2e/create-reader-flow.spec.ts`
   - `e2e/auth-and-redirects.spec.ts`
   - `e2e/settings-billing.spec.ts`
4. Keep manual visual QA, but only after the route and auth regressions are guarded by automated tests.

#### Test plan artifact

- Written to: `/Users/binhan/.gstack/projects/panelmint/binhan-main-eng-review-test-plan-20260329-090043.md`

### 4. Performance Review

#### Issue 7 — Public pages should not pay app-shell hydration tax

**Finding:** the current root `Providers` wrapper hydrates auth state and app chrome globally. If the landing/pricing/legal pages keep that wrapper, they will pay an unnecessary `/api/auth/me` roundtrip and spinner risk.

**Auto-decision:** public pages must be server/static-first and should not mount the app shell or `AuthProvider`.

#### Issue 8 — Large client pages need bounded hydration

**Finding:** `settings`, `create`, and the full-scroll landing page can easily become large client bundles if the Stitch port is done as one giant JSX paste.

**Auto-decision:** constrain hydration:

- keep landing/pricing/legal mostly server-rendered,
- push stateful logic into smaller islands,
- lazy-load only where the runtime behavior needs it.

## Failure Modes Registry

| New codepath / contract | Realistic production failure | Test covers it? | Error handling exists? | User sees | Status |
|---|---|---|---|---|---|
| Public `/` after route split | Clerk middleware still redirects to signin | No | No | Wrong auth wall instead of landing | Gap |
| Public pages under old shell | Sidebar + auth spinner still render on marketing routes | No | No | Wrong chrome / slow first paint | Gap |
| Create cancel flow | UI says "terminated" but backend jobs keep running and may keep charging | No | No | Misleading success, hidden backend work | **Critical gap** |
| Dashboard episode fetch | Fetch fails and user sees an empty workspace instead of an error | No | No | Silent false empty state | **Critical gap** |
| Root return paths | Read/create/editor exit links send users to landing instead of dashboard | No | Partial | Wrong destination | Gap |
| Payment status page | UI implies a real payment state, but no checkout/session lookup exists | No | No | Misleading product state | Gap |

## NOT in Scope

- Real checkout session creation, webhook verification, and credit-grant wiring.
  - Rationale: the current migration plan is about UI replacement; real payment orchestration deserves its own backend feature plan unless explicitly pulled in.
- Full rewrite of the editor experience.
  - Rationale: only the shell contract and exit path need alignment for this migration.
- Global purge of every legacy `--weo-*` usage.
  - Rationale: keep compatibility during the migration, then schedule cleanup once the NeoComic system is stable.
- Pipeline/backend quality improvements unrelated to the UI shell contract.
  - Rationale: preserve scope discipline; this review only pulls backend items that are necessary to keep the migrated UI honest.

## Cross-Phase Themes

- **Theme: shell ownership was underspecified.**
  - The Phase 2 handoff said `7/7` design gaps were confirmed.
  - The eng review independently found the same ambiguity in route groups, sidebar scope, and public-vs-protected page ownership.
- **Theme: this is not just a visual migration.**
  - Current repo coupling around `/`, Clerk middleware, and return paths turns "screen porting" into navigation-contract work.
- **Theme: state completeness is still the biggest execution risk.**
  - Loading, empty, error, success, cancel, and payment states remain more underdescribed than the happy-path layouts.

## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | Eng | Move shell ownership from `Providers` into route-group layouts and keep root layout global-only. | P5 explicit over clever | The current pathname-based shell conflicts with public routes and immersive protected pages. | Keep sidebar logic in the root provider tree. |
| 2 | Eng | Add a protected `(immersive)` route group for `read` and `editor`. | P1 completeness | Both routes are authenticated but should not inherit the app sidebar forever. | Leave them as root-level shell exceptions. |
| 3 | Eng | Treat `/dashboard` as the canonical app home and update every hardcoded `/` return path. | P1 completeness | Once `/` becomes landing, ad hoc fixes create regressions across create/read/editor/sidebar. | Patch paths opportunistically during each page rewrite. |
| 4 | Eng | Insert Phase 1.5 for middleware + route matrix + shell ownership before page work fans out. | P3 pragmatic | Later phases are currently coupled; pretending they are parallel will slow implementation and QA. | Start screen migrations immediately after the token work. |
| 5 | Eng | Keep payment/pricing UI honest unless real checkout backend is added in the same plan. | P4 DRY | The repo has credits history, not a finished checkout/status flow. | Ship payment-status as if it were already fully backed. |
| 6 | Eng | Add missing route tests plus Playwright coverage for route/auth/shell regressions. | P1 completeness | Current Vitest coverage is mostly API/lib-only and misses the riskiest UI regressions. | Rely on build/lint/manual browser checks only. |
| 7 | Eng | Preserve a temporary `--weo-*` compatibility layer during token migration. | P3 pragmatic | The repo still has live legacy consumers and wrapper components. | Hard-cut the entire app to neo-only tokens in one pass. |

## Completion Summary

- Step 0: Scope Challenge — scope accepted, but with a mandatory new Phase 1.5 for route contract ownership
- Architecture Review: 4 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 15 gaps identified
- Performance Review: 2 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items written (`TODOS.md` does not exist in this repo; deferred items remain in this plan)
- Failure modes: 2 critical gaps flagged
- Outside voice: ran (`codex` + independent subagent)
- Lake Score: 7/7 recommendations chose the complete option

> **Phase 3 complete.** Codex: 6 concerns. Claude subagent: 7 issues. Consensus: 6/6 confirmed gaps. Passing to Phase 4.

## Phase 4 — Final Approval Gate

### /autoplan Review Complete

#### Plan Summary

This migration is directionally right, but it is not safe to execute as written. The hidden work is not "convert 10 Stitch screens"; it is replacing the app shell contract so public pages, protected app pages, and immersive protected pages each have explicit ownership.

The safe implementation order is now:

1. tokens + wrapper compatibility,
2. middleware/public-route allowlist,
3. route groups + app home contract,
4. immersive protected routes,
5. page migrations,
6. regression tests.

#### Decisions Made: 7 total (7 auto-decided, 0 taste decisions left)

#### Auto-Decided

- Shell ownership moves into route-group layouts.
- `/dashboard` becomes canonical app home.
- `read` and `editor` move under a protected immersive contract.
- Later phases no longer start in parallel immediately after Phase 1.
- Payment/pricing UI must stay honest unless backend checkout/status work is added.
- Route/auth/shell regressions get automated coverage.
- Legacy token compatibility stays in place during the migration.

#### Review Scores

- CEO: prior session reportedly complete, but its detailed artifacts were not preserved in this file
- Design: prior session reportedly complete; handoff says `7/7` confirmed gaps
- Eng: 8 review issues found, 15 explicit test gaps, 2 critical failure modes
- Eng Voices: Codex `6` concerns, Claude subagent `7` issues, Consensus `6/6` confirmed gaps

#### Cross-Phase Themes

- Shell ownership and route semantics are the highest-confidence problem.
- "Visual-only" scope is hiding real navigation/auth coupling.
- Failure states and recovery paths are still less explicit than the happy path.

#### Deferred

- Real checkout/webhook/payment-status backend
- Full editor redesign
- Full legacy-token purge
- Non-UI pipeline improvements

#### Approval options

- `A)` Approve as-is
- `B)` Approve with overrides
- `C)` Interrogate specific decisions
- `D)` Revise the plan and re-run affected sections
- `E)` Reject and start over
