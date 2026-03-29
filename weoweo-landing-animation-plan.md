# Weoweo Landing Animation Upgrade Plan (Revised)

**Parent plan:** [stitch-ui-migration.md](/Users/binhan/weoweo/stitch-ui-migration.md) Phase 2 (Landing Page)  
**Status:** Revised after autoplan-style review  
**Date:** 2026-03-29

## Objective

Add motion to the public landing experience that feels mechanical, tactile, and NeoComic Ink native without breaking the current route/auth contract or introducing unnecessary animation infrastructure.

This plan covers the public marketing surface only:

- `/`
- `/pricing`
- public navbar anchor behavior

This plan does **not** include dashboard, reader, editor, settings, or app-shell animation work.

## Why This Revision Exists

The previous plan was directionally right about the desired aesthetic, but it overfit the solution to GSAP and underfit the current repo reality:

- [`src/app/(public)/page.tsx`](/Users/binhan/weoweo/src/app/(public)/page.tsx) is a **server component** because it handles `auth()` and redirects authenticated users to `/dashboard`.
- `/pricing` is already a real public route and is referenced by the public navbar, the app sidebar, and Clerk middleware allowlist.
- The repo already has a global reduced-motion baseline in [`src/app/globals.css`](/Users/binhan/weoweo/src/app/globals.css).
- The current animation requirement is mostly reveal, stagger, typing, and lightweight parallax. That does not justify a new animation runtime yet.

## Recommendation

Use a **native hybrid approach**:

- **Triggering/orchestration:** small client-side React hooks with `IntersectionObserver`, scroll listeners only where truly needed, and explicit refs.
- **Motion language:** CSS keyframes and transitions using `steps()` and hard transforms in [`src/styles/semantic-classes.css`](/Users/binhan/weoweo/src/styles/semantic-classes.css).
- **Server/client boundary:** keep the page-level auth redirect in the server page, then render a dedicated client island for animated sections.
- **Route compatibility:** keep `/pricing` as a first-class route; do not delete it to force a single-page landing.

This is the cleanest complete option for the current codebase:

- zero new dependency
- zero new license surface
- no library mismatch with the stepped visual language
- explicit control over reduced-motion and SSR visibility

## Option Review

| Option | Verdict | Why |
|---|---|---|
| CSS scroll-driven API only | Reject for now | Browser support and sequencing limits are not worth the constraint, especially for typing and scroll-spy behavior. |
| GSAP + ScrollTrigger | Reject for Phase 1 | Solves a broader problem than we currently have, adds bundle weight, and pushes a server page toward a larger client runtime too early. |
| Framer Motion everywhere | Reject for this surface | The repo already has `framer-motion`, but the landing motion language wants discrete stepped transitions more than library-driven tweening. |
| Native React hooks + CSS `steps()` | **Choose** | Best fit for the tactile aesthetic, smallest blast radius, easiest to keep explicit and SSR-safe. |

## Approved Premises

1. The motion goal is to make the landing page feel like a comic production console, not a generic polished SaaS site.
2. The public route contract stays intact: `/` remains the landing page and `/pricing` remains directly reachable.
3. The pricing content may appear on the landing page, but it must come from shared components rather than route deletion.
4. Reduced-motion users must see final states immediately, not invisible or half-animated content.
5. This phase stops at public marketing surfaces. Dashboard counters and app-shell animations are a follow-up plan.

## What Already Exists

| Existing asset | File | Reuse in this plan |
|---|---|---|
| Public landing shell with auth redirect | [`src/app/(public)/page.tsx`](/Users/binhan/weoweo/src/app/(public)/page.tsx) | Keep server-side redirect logic; move animation concerns below it. |
| Public pricing route | [`src/app/(public)/pricing/page.tsx`](/Users/binhan/weoweo/src/app/(public)/pricing/page.tsx) | Keep route; extract shared pricing section instead of duplicating or deleting. |
| Public navbar | [`src/components/ui/NeoNavbar.tsx`](/Users/binhan/weoweo/src/components/ui/NeoNavbar.tsx) | Extend to support hash links on `/` and route links elsewhere. |
| Mechanical press interaction | [`src/styles/semantic-classes.css`](/Users/binhan/weoweo/src/styles/semantic-classes.css) | Reuse `steps()` motion language as the base for entrances and reveals. |
| Reduced-motion baseline | [`src/app/globals.css`](/Users/binhan/weoweo/src/app/globals.css) | Preserve and extend so reveal classes resolve to visible final state. |
| Pricing route allowlist | [`src/proxy.ts`](/Users/binhan/weoweo/src/proxy.ts) | Preserve route contract; no auth regression. |

## Architecture

### Server / Client Split

Keep auth and redirect ownership on the server:

```text
src/app/(public)/page.tsx          (server)
  -> auth()
  -> redirect('/dashboard') if authed
  -> render <LandingPageClient />

src/app/(public)/pricing/page.tsx  (server)
  -> render shared <PricingSection standalone />
```

Move landing-only motion into an explicit client island:

```text
src/components/public/LandingPageClient.tsx     [NEW]
  -> HeroSection
  -> FeatureSection
  -> EngineSpecsSection
  -> PricingSection
  -> CTASection

src/components/public/hooks/useSectionReveal.ts [NEW]
src/components/public/hooks/useTypewriterText.ts [NEW]
src/components/public/hooks/useActiveSection.ts [NEW]
```

### Content Reuse Strategy

Do not fork pricing content between routes.

Instead:

- extract a shared `PricingSection`
- render it inside the landing page
- render it inside `/pricing` with route-specific framing copy if needed

This keeps the approved "hybrid single-page" feel while preserving route compatibility and avoiding duplicated pricing markup.

## Motion System

### Motion Principles

- **Stepped, not floaty**
- **Short, deliberate, tactile**
- **Triggered by visibility or explicit state**
- **No hidden content by default on the server**

### Motion Primitives

Add these reusable primitives to [`src/styles/semantic-classes.css`](/Users/binhan/weoweo/src/styles/semantic-classes.css):

- `.neo-reveal-panel`
  - panel reveal from `translateY(24px) rotate(-2deg)` to rest
  - stepped transition timing
- `.neo-reveal-stamp`
  - scale from `0.92` to `1`
  - hard shadow grows into place
- `.neo-reveal-drop`
  - short top-down drop for grid cards
- `.neo-scanline-pulse`
  - brief opacity pulse for terminal bars on first reveal
- `.neo-anchor-target`
  - `scroll-margin-top` tuned for the sticky navbar
- `.neo-motion-safe`
  - helper class for states that must immediately resolve to visible when motion is reduced or disabled

### Reduced Motion Rule

The landing page must never rely on global `animation-duration: 0.01ms` alone.

Instead:

- animated initial states are only activated inside a mounted motion-enabled client container
- reduced-motion mode renders the final visible state immediately
- no SSR path should ship content hidden behind `opacity: 0`

### Hook Behavior

#### `useSectionReveal`

Purpose:

- attach `IntersectionObserver`
- mark sections/cards as visible when they enter the viewport
- optionally apply a small stagger to sibling items

Rules:

- explicit refs, no DOM-wide class queries
- once-only by default for landing sections
- no observer attached in reduced-motion mode

#### `useTypewriterText`

Purpose:

- hero terminal boot sequence
- type deterministic strings character-by-character
- expose a blink cursor state

Rules:

- start once on initial mount
- stop cleanly on unmount
- render full text immediately when reduced motion is enabled

#### `useActiveSection`

Purpose:

- scroll-spy for `#features`, `#pricing`, and `#cta`
- keep navbar active state in sync with viewport position on `/`

Rules:

- only active on the landing route
- fallback to pathname-based route active state on non-landing public pages

## Implementation Plan

### Phase 0: Scope Lock and Shared Section Extraction

**Priority:** P0

- [ ] Keep `/pricing` live and public. No redirect-only replacement.
- [ ] Extract the public landing into a dedicated client component:
  - [`src/app/(public)/page.tsx`](/Users/binhan/weoweo/src/app/(public)/page.tsx) stays server-side
  - `LandingPageClient.tsx` becomes the animated surface
- [ ] Extract shared public sections:
  - `PricingSection`
  - `FeatureSection`
  - `EngineSpecsSection`
  - `CTASection`
- [ ] Reuse `PricingSection` in both `/` and `/pricing`.

**Verification**

- anonymous users still see `/`
- authenticated users still redirect to `/dashboard`
- `/pricing` still renders directly and stays on the public allowlist

### Phase 1: Motion Primitives and Navbar Contract

**Priority:** P0

- [ ] Extend [`src/styles/semantic-classes.css`](/Users/binhan/weoweo/src/styles/semantic-classes.css) with the motion primitives above.
- [ ] Update [`src/components/ui/NeoNavbar.tsx`](/Users/binhan/weoweo/src/components/ui/NeoNavbar.tsx):
  - landing route uses anchors: `#features`, `#pricing`, `#cta`
  - other public routes keep normal route links
  - active state becomes section-aware on `/`
- [ ] Add `scroll-margin-top` handling for anchored sections.
- [ ] Fix narrow-width overflow while touching navbar text and CTA group.

**Verification**

- anchor clicks do not land under the sticky navbar
- active nav pill follows the current section on `/`
- non-home public pages keep stable route navigation

### Phase 2: P0 Motion Pass

**Priority:** P0

Ship the high-value motion first:

- [ ] comic panel reveal on section enter
- [ ] staggered grid/card drops for features and pricing cards
- [ ] subtle button bounce-back after the existing press effect

Implementation notes:

- section/card visibility is driven by `useSectionReveal`
- stepped feel lives in CSS, not in a JS animation library
- pricing cards and feature cards should share the same reveal contract

**Verification**

- content remains readable before JS hydration
- first reveal feels mechanical, not eased like a default tween
- no visible jank during repeated scrolls

### Phase 3: P1 Motion Pass

**Priority:** P1

- [ ] hero terminal boot typing
- [ ] ink stamp entrance for selected hero and pricing accents
- [ ] scanline pulse on terminal-style headers when first revealed

Implementation notes:

- only one hero typing sequence
- scanline pulse should be brief, not constant visual noise
- stamp entrance is reserved for high-signal cards, not every block on the page

**Verification**

- hero copy stays legible if typing is skipped
- repeated visits do not retrigger distracting motion unless explicitly intended

### Phase 4: P2 Motion Pass

**Priority:** P2

- [ ] lightweight background parallax for the landing hero grid only
- [ ] optional hero-image depth shift if the page gains illustrated assets later

Guardrails:

- no dashboard counters in this phase
- no app-shell motion in this phase
- parallax ships only if it passes performance QA on mobile

**Verification**

- no scroll-linked frame drops on mobile
- parallax remains subtle and decorative, never required for comprehension

### Phase 5: Final Verification

**Priority:** P0

- [ ] `npm run build`
- [ ] route contract smoke tests for `/`, `/pricing`, `/legal`, `/dashboard`
- [ ] landing redirect test remains valid for authenticated users
- [ ] manual reduced-motion QA
- [ ] responsive QA for navbar, hero, pricing, and anchors

## Verification Matrix

| Area | What to verify | Expected result |
|---|---|---|
| Server/client boundary | Authenticated request to `/` | Redirects to `/dashboard`; no client-only auth logic added to landing. |
| Public contract | Anonymous request to `/pricing` | Route still renders directly. |
| Anchor behavior | Click `Pricing` on `/` | Scrolls to the pricing section with the heading visible below the navbar. |
| Reduced motion | Browser with `prefers-reduced-motion: reduce` | All sections render immediately without hidden placeholders. |
| Hydration | First load of `/` | No flash of invisible content before motion setup. |
| Visual language | Section reveals and card entries | Feels stepped and mechanical, not soft-bezier or springy. |

## Failure Modes Registry

| New codepath / contract | Realistic failure | Preventive decision |
|---|---|---|
| Client landing island | Hydration mismatch or duplicated auth ownership | Keep auth redirect on the server page and pass only display data into the client island. |
| Shared pricing section | `/` and `/pricing` drift apart over time | Render both from the same extracted section component. |
| Motion initial states | Reduced-motion or no-JS users see invisible sections | Gate hidden states behind a mounted motion-enabled container only. |
| Scroll-spy navbar | Active state flickers or highlights the wrong section | Use explicit section refs and tuned `rootMargin`, not generic scroll math. |
| Sticky header anchors | Sections land under the navbar | Add anchor-safe `scroll-margin-top` utilities to each target section. |
| Parallax pass | Mobile scroll jank | Keep parallax P2 and ship only after device QA. |

## Not in Scope

- Dashboard stat counters
- Sidebar/app-shell animations
- Reader/editor motion work
- Modal animation refactors
- Replacing the existing `framer-motion` modal usage
- Adding GSAP unless this plan proves insufficient after implementation

## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|---|---|---|---|---|
| 1 | Strategy | Keep `/pricing` as a live route and share its content with the landing page. | P1 completeness | This preserves the current public contract while still achieving the approved hybrid landing experience. | Delete `/pricing` and force all pricing traffic to `/#pricing`. |
| 2 | Strategy | Do not add GSAP for Phase 1. | P4 DRY | The current requirements are covered by native browser APIs plus CSS `steps()`. | Add a new animation runtime before proving the need. |
| 3 | Architecture | Keep [`src/app/(public)/page.tsx`](/Users/binhan/weoweo/src/app/(public)/page.tsx) as a server auth gate and move motion below it. | P5 explicit | This avoids mixing redirect logic with client-side animation concerns. | Convert the full landing page into a client component. |
| 4 | Architecture | Build a dedicated landing client island with small explicit hooks. | P5 explicit | Focused hooks are easier to reason about than one generic DOM-query animation helper. | One mega-hook that discovers and animates arbitrary classes. |
| 5 | Design | Encode the mechanical feel in CSS `steps()` motion primitives. | P1 completeness | The brand language depends more on stepped timing than on library sophistication. | Default bezier/spring motion. |
| 6 | Scope | Limit this plan to public marketing surfaces. | P3 pragmatic | Pulling dashboard/app-shell motion into the same plan would blur verification and widen the blast radius. | Include dashboard counters and app-wide motion in the first pass. |

## Final Build Order

1. Extract shared landing/pricing sections.
2. Introduce the landing client island and section refs.
3. Add motion primitives and reduced-motion-safe states.
4. Upgrade navbar anchors and scroll-spy behavior.
5. Ship P0 reveals and stagger.
6. Add hero typing and terminal accents.
7. Add parallax only if performance stays clean.
8. Run route, reduced-motion, and responsive verification.

## Outcome

This revised plan keeps the approved landing upgrade, removes the unnecessary dependency jump, respects the current route/auth architecture, and focuses implementation on the highest-value mechanical motion first.
