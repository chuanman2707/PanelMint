# PLAN: weoweo MVP → SaaS Migration (Webtoon Platform)

> Từ localhost MVP → SaaS kinh doanh được. Webtoon vertical-scroll format.
> Pay-as-you-go credits — platform quản lý API keys, user chỉ mua credits.
> Docker Compose + managed DB, scale từng bước.

## Competitive Advantage

**Automated novel-to-manga pipeline:** User paste 1 chapter truyện web → LLM tự detect nhân vật, phong cảnh, chia panel → generate ảnh → output webtoon strip.

Competitors (Anifusion, Dashtoon, LlamaGen) yêu cầu tạo từng character, từng page thủ công, giới hạn ~4000 chars/prompt. weoweo tự động hóa toàn bộ.

## Key Decisions (from CEO Review)

| Decision | Rationale |
|---|---|
| **Webtoon** (vertical scroll) thay vì manga panels | Đơn giản hóa pipeline — không cần layout engine. Mỗi panel = 1 ảnh. Stack dọc + text blocks. |
| **Cấm LLM tạo text trong ảnh** | LLM viết chữ xấu như giun. Ảnh chỉ chứa visual. Text chèn ở bước cuối bởi user. |
| **Pay-as-you-go credits** | Platform quản lý API keys. User mua credits, platform trả API cost. Đơn giản UX — không cần setup API key. |
| **Docker Compose + managed DB** | Thay all-in-one Docker. Dễ scale worker tách biệt DB. |
| **Panel = đơn vị cơ bản** | Bỏ concept "page" (multi-panel). Mỗi panel = 1 scene = 1 ảnh full-width. |
| **R2** (Cloudflare) cho cloud storage | Cost-effective, S3-compatible. Signed URLs cho security. |
| **Polar.sh** cho payment (thay SePay) | International từ ngày 1, hosted checkout, Stripe underneath, cá nhân OK, zero payment UI to build. |
| **wavespeed.ai** cho image generation | Hỗ trợ FLUX Kontext (multi-ref images), Seedream V4, Imagen 4. Giá $0.006-0.04/image. OpenRouter chỉ dùng cho LLM calls. |
| **Credit system Phase 1** (không defer) | Pipeline cần check credits từ đầu. Chạy free = abuse risk. |

### Key Decisions (from Eng Review)

| Decision | Rationale |
|---|---|
| **Refactor call chain**: bỏ `generatePageImage()` + `buildPagePrompt()`, dùng `generatePanelImage()` duy nhất | Explicit > clever. 1 entry point thay vì 2. |
| **Giữ model Page như "Scene" grouping** | Không cần schema migration. Page = Scene = nhóm panels cùng bối cảnh. |
| **Client-side rendering** (CSS vertical stack) thay server-side assembly | Server-side (sharp) ngốn RAM khủng — 10 users × image processing = OOM trên 4GB VPS. |
| **Fix 4 critical error gaps trong Phase 1** | Boil the lake — error handling tốn vài phút với CC, không defer. |
| **Extract `matchCharacterName()` helper** | DRY — 2 nơi dùng cùng fuzzy matching logic. |
| **Eager load panels + characters trước vòng lặp** | N+1 queries: 40 queries → 1 query. Managed DB có network latency. |
| **Optimistic Concurrency** cho credit deduction | `updateMany` + `gte` condition thay vì `SELECT FOR UPDATE` (Prisma không native support row locks). |
| **Hard chapter limit** (20,000 chars MVP) | Chunking cần stateful context passing — defer. Clear error UX thay vì silent fail. |

---

## Tình trạng hiện tại (đã có)

| Component | Status | Chi tiết |
|---|---|---|
| Database | ✅ MySQL 8 | Prisma 7, schema đầy đủ. Phase 1-2: MySQL in Docker (dev). Phase 3: migrate to managed DB (PlanetScale/Railway) |
| Job Queue | ✅ BullMQ + Redis 7 | 3 job types: analyze, storyboard, generate-images |
| Auth | ✅ Session-based | bcrypt, encrypted API keys, 30-day sessions |
| Docker | ✅ docker-compose | 3 services (MySQL, Redis, App+Worker) |
| Pipeline | ✅ 3-step | Analyze → Storyboard → Image Gen |
| Character Design | ✅ Partial | `generateCharacterDescription` + `generateCharacterSheet` exist |
| Image Gen | ✅ Multi-provider | **Pivot:** wavespeed.ai (image gen) + OpenRouter (LLM only) |
| Unit Tests | ✅ 5 tests | Vitest: api-auth, crypto, errors, rate-limit, request-security |

## Những gì CẦN LÀM (gaps)

| Gap | Priority | Phase |
|---|---|---|
| Webtoon pipeline refactor (panel = 1 ảnh, bỏ page concept) | 🔴 Critical | 1 |
| Character consistency via JSON identity anchors (waoowaoo pattern) | 🔴 Critical | 1 |
| Reference images truyền vào API calls (via wavespeed.ai multi-ref) | 🔴 Critical | 1 |
| Image gen prompt: CẤM text/speech bubbles | 🔴 Critical | 1 |
| Image gen pivot: wavespeed.ai (FLUX Kontext, Seedream V4) | 🔴 Critical | 1 |
| Credit system (pay-as-you-go) — **moved to Phase 1** | 🔴 Critical | 1 |
| Long chapter: hard limit 20,000 chars (reject với clear error) | 🟡 Important | 1 |
| R2 Cloud Storage thay local filesystem (signed URLs) | 🔴 Critical | 2 |
| SSE Task Progress streaming (+ initial state on connect) | 🟡 Important | 2 |
| Usage Tracking (API calls per user) | 🟡 Important | 2 |
| Payment integration (Polar.sh) | 🔴 Critical | 3 |
| Admin dashboard (revenue, cost, abuse monitoring) | 🟡 Important | 3 |
| Docker Compose production deploy | 🟠 Phase 3 | 3 |
| E2E Tests (Playwright) | 🟡 Important | Xuyên suốt |

---

## UI Architecture (from Design Review)

### Screen Map & Navigation

```
APP SCREEN MAP
═══════════════════════════════════════════════════════
  /                    Dashboard — project list + gallery
  /create              Create — paste chapter → pipeline
  /editor/[id]         Editor — canvas with text bubbles
  /read/[id]           Reader — webtoon vertical scroll  ← MAJOR REFACTOR
  /settings            Settings — Profile tab (no more API keys)
  /settings?tab=credits Credits — balance, buy, transaction history  ← NEW
  /auth/signin         Sign in
  /auth/signup         Sign up
═══════════════════════════════════════════════════════
```

### Sidebar Changes

```
SIDEBAR (220px fixed)
┌──────────────────────┐
│ [Logo] weoweo        │
│ 💰 12 credits        │  ← NEW: credit balance chip, click → /settings?tab=credits
├──────────────────────┤
│ 📊 Dashboard         │
│ ✨ Create             │
│ ⚙️  Settings          │
│                      │
│ ── bottom ──         │
│ [Buy Credits]        │  ← replaces "Upgrade to Pro"
│ [User] [Logout]      │
└──────────────────────┘
```

### Webtoon Reader Layout (`/read/[id]`)

```
┌─────────────────────────────────────┐
│  ← Back            Chapter 3    ⋯  │  ← sticky header (48px, thin, glassmorphism)
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     PANEL 1 IMAGE             │  │  full-width, lazy loaded
│  │     (1024×1536, portrait)     │  │  IntersectionObserver for lazy load
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌ text-block ───────────────────┐  │
│  │ "Anh Minh bước vào quán..."  │  │  text block between panels
│  └───────────────────────────────┘  │  Surface variant, --weo-bg-surface
│                                     │
│  ┌───────────────────────────────┐  │
│  │     PANEL 2 IMAGE             │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌ text-block ───────────────────┐  │
│  │ "Cô ấy ngồi ở góc..."       │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │     (loading skeleton)        │  │  skeleton shimmer while loading
│  └───────────────────────────────┘  │
│                                     │
│           — Hết —                   │
│  [← Previous Chapter] [Next →]      │
└─────────────────────────────────────┘

Panel gap: --weo-space-2 (8px)
Text block: padding --weo-space-4, font 16px, max-width 640px centered
Container: max-width 768px centered, bg --weo-bg-canvas
```

### Settings Page Redesign (`/settings`)

```
┌─────────────────────────────────────┐
│  Settings                           │
├─────────────────────────────────────┤
│  [Profile]  [Credits]  [Security]   │  ← tab navigation
├─────────────────────────────────────┤
│                                     │
│  CREDITS TAB:                       │
│  ┌───────────────────────────────┐  │
│  │  Balance: 12 credits          │  │  Surface elevated
│  │  [Buy Credits]                │  │  Button primary
│  └───────────────────────────────┘  │
│                                     │
│  Transaction History                │
│  ┌───────────────────────────────┐  │
│  │ -2  Panel generation  3m ago  │  │
│  │ -1  Chapter analysis  5m ago  │  │
│  │ +50 Purchase        yesterday │  │
│  └───────────────────────────────┘  │
│                                     │
│  PROFILE TAB:                       │
│  Display name, email, password      │
│                                     │
│  SECURITY TAB:                      │
│  Sessions, delete account           │
└─────────────────────────────────────┘
```

### Interaction State Table

```
FEATURE              | LOADING              | EMPTY                 | ERROR                | SUCCESS            | PARTIAL
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Dashboard            | Skeleton cards (3×)  | "No chapters yet.     | "Couldn't load       | Gallery grid with  | —
(project list)       | shimmer animation    |  Paste your first     |  projects" + retry   | episode cards      |
                     |                      |  chapter!" + CTA →    |                      |                    |
                     |                      |  /create              |                      |                    |
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Create               | ProgressBar with     | Pre-filled textarea   | StatusChip danger +  | Success screen:    | "8/20 panels done,
(pipeline)           | step name: Analyzing |  placeholder: "Paste  |  specific message:   | "Chapter ready!"   |  3 failed content
                     | → Storyboarding →    |  your chapter here... |  - "Chapter too long |  [View Webtoon]    |  filter" + refund
                     | Generating panels    |  (5,000-20,000 words) |    — split into      |  [Edit in Canvas]  |  info
                     |                      |  " + word count       |    sections"         |                    |
                     |                      |                       |  - "Insufficient     |                    |
                     |                      |                       |    credits" + buy    |                    |
                     |                      |                       |  - "Service error"   |                    |
                     |                      |                       |    + retry           |                    |
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Webtoon Reader       | Skeleton panels      | "This chapter has no  | "Couldn't load       | Full vertical      | Live reader:
(/read/[id])         | (shimmer, portrait   |  panels yet.          |  chapter" + retry    | scroll with all    | show completed
                     |  aspect ratio)       |  [Generate Now]"      |  + back to dashboard | panels + text      | panels, shimmer
                     |                      |                       |                      | blocks + "Hết"     | skeleton at bottom
                     |                      |                       |                      |                    | "Generating 9/20"
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Settings/Credits     | Spinner on balance   | "No transactions      | "Couldn't load       | Balance + history  | —
                     |                      |  yet. Generate your   |  credits" + retry    | list               |
                     |                      |  first chapter!"      |                      |                    |
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Credit Purchase      | "Processing..." with | —                     | "Payment failed.     | "✓ 50 credits      | —
                     | disabled button      |                       |  Please try again."  |  added!" + confetti |
                     |                      |                       |                      |  animation         |
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
Character Review     | "Analyzing           | "No characters found  | "Analysis failed"    | Character cards    | "Found 5 chars,
(mid-pipeline)       |  characters..."      |  — try a different    |  + retry             | with identity      |  2 without sheets"
                     |                      |  chapter"             |                      | anchors + sheets   |
---------------------|----------------------|-----------------------|----------------------|--------------------|--------------------
SSE Connection       | —                    | —                     | "Connection lost.    | Live progress      | Reconnecting...
                     |                      |                       |  Reconnecting..."    | updates            | (auto-retry 3×)
                     |                      |                       |  (auto-retry)        |                    |
```

### User Journey & Onboarding

```
FIRST-TIME USER FLOW:
1. Sign up → account gets 10 free starter credits
2. Welcome toast: "🎉 You have 10 free credits — enough to generate your first chapter!"
3. Guided to /create with pre-filled example hint
4. Paste chapter → see cost estimate → generate
5. Live reader: watch panels appear in real-time
6. After first chapter: "Loved it? [Buy more credits]"

RETURNING USER FLOW:
1. Dashboard shows recent projects
2. Click "Create" → paste chapter → credit estimate
3. If sufficient: generate immediately
4. If insufficient: "Need X more credits" → inline buy CTA
5. View completed webtoon → share or edit
```

### Credit Check in Create Flow

```
/create — before pipeline starts:
┌─────────────────────────────────────┐
│  Estimated cost: ~15 credits        │  ← based on chapter length estimate
│  Your balance:   12 credits         │
│                                     │
│  ⚠️ Not enough credits (need 3 more)│
│  [Buy Credits]                      │
└─────────────────────────────────────┘

When sufficient:
┌─────────────────────────────────────┐
│  Estimated cost: ~15 credits        │
│  Your balance:   50 credits         │
│                                     │
│  [✨ Generate Webtoon]              │  ← primary CTA
└─────────────────────────────────────┘
```

### Wait State During Generation

```
/create — pipeline running (SSE updates):
┌─────────────────────────────────────┐
│  ✨ Generating your webtoon...      │
│                                     │
│  ████████░░░░░░░░░░░░  8/20 panels  │
│                                     │
│  Currently: Generating panel 9      │
│  ⏱ ~3 minutes remaining            │
│                                     │
│  [View progress in reader →]        │  ← opens /read/[id] in live mode
└─────────────────────────────────────┘
```

### Design Token Usage for New UI (from Design Review)

```
NEW ELEMENT                    | COMPONENT        | TOKEN / CLASS
-------------------------------|------------------|---------------------------
Credit balance chip (sidebar)  | StatusChip       | weo-chip-info, --weo-text-primary
Buy Credits button (sidebar)   | Button primary   | weo-btn-primary (crimson gradient)
Transaction row                | Surface card     | weo-surface-card, hover lift
Webtoon panel gap              | spacing          | --weo-space-2 (8px)
Text block (between panels)    | Surface panel    | --weo-bg-surface, --weo-space-4 padding
Reader sticky header           | Surface          | weo-surface + backdrop blur
Skeleton panel (loading)       | custom           | shimmer animation, portrait aspect ratio
Cost estimate banner           | Surface elevated | weo-surface-elevated, --weo-accent-from
Insufficient credits alert     | StatusChip       | weo-chip-warning
Success confetti               | custom           | animate-fade-in-up
Settings tabs                  | custom           | --weo-text-secondary (inactive), --weo-accent-from (active)
Progress bar (generation)      | ProgressBar      | existing component, crimson fill
```

Tất cả UI mới phải dùng existing design tokens từ `design-tokens.css` và semantic classes từ `semantic-classes.css`. KHÔNG tạo mới color values, spacing values, hoặc font sizes ngoài hệ thống.

### Responsive Design (from Design Review)

```
BREAKPOINTS:
  Mobile:  ≤ 768px  — primary reading device for webtoons
  Tablet:  769-1024px
  Desktop: > 1024px

MOBILE (≤ 768px):
  Sidebar: HIDDEN entirely
  Navigation: bottom tab bar (48px, 3 tabs: Dashboard, Create, Settings)
  Credit balance: in bottom tab bar, next to Settings
  Reader: NO bottom nav — immersive fullscreen reading
    - Panels: 100vw edge-to-edge (no padding)
    - Text blocks: 16px padding horizontal, font 15px
    - Sticky header: tap to show/hide (auto-hide on scroll down, show on scroll up)
    - Panel images: width 100%, height auto (maintain aspect ratio)
  Create: single column, textarea full width
  Settings: tabs stack vertically if needed

TABLET (769-1024px):
  Sidebar: collapsed to icons only (60px)
  Reader: max-width 768px centered, 16px side padding
  Dashboard: 2-column gallery grid

DESKTOP (> 1024px):
  Sidebar: full 220px with labels
  Reader: max-width 768px centered
  Dashboard: 3-column gallery grid
```

### Accessibility

```
REQUIREMENTS:
  - Touch targets: minimum 44×44px (all buttons, nav items, tabs)
  - Keyboard nav: Tab through sidebar → content → interactive elements
  - Focus ring: --weo-accent-from (crimson) outline, 2px, offset 2px
  - ARIA: role="navigation" on sidebar, role="main" on content area
  - Reader: aria-label on panels ("Panel 1 of 20"), img alt from panel description
  - Color contrast: --weo-text-primary on --weo-bg-canvas = 15.2:1 ✅ (WCAG AAA)
  - Reduced motion: @media (prefers-reduced-motion) — disable all animations
  - Screen reader: text blocks are readable (not in images), panel descriptions available
  - Skip to content: link for keyboard users to bypass sidebar
```

### Purchase Flow — MVP (from Design Review)

```
"Buy Credits" button → Polar.sh Hosted Checkout:
┌─────────────────────────────────────┐
│  Mua Credits                        │
│                                     │
│  [10 credits — $2.50]              │
│  [50 credits — $10.00] ← phổ biến   │
│  [200 credits — $35.00]            │
│                                     │
│  Click → Redirect to Polar.sh       │
│  (Stripe-powered checkout page)      │
│                                     │
│  Credits cộng tự động sau thanh toán│
│  via webhook                         │
└─────────────────────────────────────┘
```

### Resolved Design Decisions (Pass 7 + Audit)

| Decision | Choice | Rationale |
|---|---|---|
| Reader text font | Plus Jakarta Sans 16px/1.7 | Consistent with app UI, short dialogue blocks don't need serif |
| Payment method (MVP) | **Polar.sh** hosted checkout | International, Stripe-powered, zero payment UI to build, cá nhân OK |
| Payment method (future) | Polar.sh (already international) | Scale tự động với Stripe |
| Mobile nav | Bottom tab bar (3 tabs) | Sidebar hidden on mobile, reader is immersive fullscreen |
| Credit balance placement | Sidebar top (below logo) | Always visible, click to go to credits tab |
| Credits page location | Settings tab | No nav clutter, clean hierarchy |
| Free starter credits | 10 credits per new account | First-time UX: experience pipeline before buying |
| Dark/light mode | Dark only (MVP) | Matches manga/webtoon reading convention |
| Image gen provider | **wavespeed.ai** | FLUX Kontext multi-ref, Seedream V4. OpenRouter = LLM only |
| Credit race condition | **Optimistic concurrency** (`updateMany` + `gte`) | Prisma không support native `SELECT FOR UPDATE` |
| Long chapters | **Hard limit 20,000 chars** | Reject với clear error. Chunking = defer |
| SSE reconnect | **Fetch current state on connect** | Standard SSE pattern, không để client bị "treo" |

---

## Phase 1: Character Consistency + Webtoon Pipeline

> Mục tiêu: Nhân vật nhất quán giữa các panel. Pivot sang webtoon format.
> Output: mỗi panel = 1 ảnh full-width, KHÔNG có text trong ảnh.

### 1.1 Webtoon Pipeline Refactor

#### [MODIFY] [orchestrator.ts](src/lib/pipeline/orchestrator.ts)

**Trước:** `runImageGenStep()` tạo 1 ảnh/page (gồm nhiều panels)
**Sau:** Tạo 1 ảnh/panel (mỗi panel = 1 scene riêng)

- Bỏ logic group panels theo page trong image gen step
- Mỗi panel gọi `generatePanelImage()` riêng (đã tồn tại)
- **Client-side rendering:** Frontend CSS vertical stack (panels + text blocks). Không cần server-side assembly (OOM risk trên 4GB VPS)
- Save từng panel image riêng (Phase 1: local filesystem, Phase 2: migrate lên R2). Frontend lazy load

#### [MODIFY] [analyze.ts](src/lib/pipeline/analyze.ts)

- `splitIntoPagesWithPanels()` → rename thành `splitIntoScenes()` hoặc `splitIntoPanels()`
- Output: flat list of panels (không group theo page)
- Mỗi panel có: description, characters, location, mood, lighting, dialogue (tách riêng)

#### [MODIFY] [image-gen.ts](src/lib/pipeline/image-gen.ts)

- **PIVOT:** Bỏ `generateImageNvidia()`, thêm `generateImageWavespeed()`
- **OpenRouter:** Giữ lại CHỈ cho LLM calls (analyze, storyboard). KHÔNG dùng cho image gen.
- `buildSinglePanelPrompt()`: thêm rule **"NO text, NO speech bubbles, NO letters, NO words, VISUAL ONLY"**
- `buildPagePrompt()` → deprecated hoặc remove (không cần multi-panel page nữa)
- Output size: **1024x1024 hoặc 1024x1536** (portrait, phù hợp webtoon vertical)
- **wavespeed.ai models:** FLUX Kontext Pro Multi (up to 5 ref images) hoặc Seedream V4
- **Pricing:** $0.006-0.04/image depending on model

#### [MODIFY] [schema.prisma](prisma/schema.prisma)

- Model `Panel`: thêm `dialogue String? @db.Text` — text sẽ hiển thị riêng, không trong ảnh
- Model `Episode`: thêm `format String @default("webtoon")` — future-proof cho manga format
- Consider: bỏ model `Page` hoặc giữ lại chỉ như logical grouping (không ảnh hưởng image gen)

### 1.2 Character Consistency (waoowaoo pattern)

#### [MODIFY] [character-design.ts](src/lib/ai/character-design.ts)

- `generateCharacterDescription()`: output structured JSON identity anchor (không chỉ text paragraph)
  ```json
  {
    "name": "Anh Minh",
    "ageRange": "25-30",
    "gender": "male",
    "bodyBuild": "lean athletic",
    "hairColor": "jet black",
    "hairStyle": "short, messy, swept right",
    "eyeColor": "dark brown",
    "skinTone": "warm tan",
    "clothing": "white dress shirt, rolled sleeves, dark jeans",
    "distinctiveFeatures": ["scar on left eyebrow", "silver ring on right hand"],
    "visualPrompt": "A lean athletic young man in his late 20s with jet black messy hair..."
  }
  ```
- `generateCharacterSheet()`: truyền `referenceImages` param vào API call

#### [MODIFY] [schema.prisma](prisma/schema.prisma)

- `Character.identityJson`: đảm bảo lưu structured JSON (đã có field, cần populate đúng format)
- `CharacterAppearance`: thêm `imageUrls` (multi-candidate), `selectedIndex`, `referenceImageUrl`

### 1.3 Reference Image Injection

#### [NEW] [reference-images.ts](src/lib/pipeline/reference-images.ts)

Adapt từ waoowaoo `collectPanelReferenceImages`:
- Input: panel info + project characters
- Collect: character sheet images cho mỗi nhân vật trong panel
- Collect: location image (nếu có)
- Output: `string[]` URLs → truyền vào image gen API

#### [MODIFY] [image-gen.ts](src/lib/pipeline/image-gen.ts)

**wavespeed.ai FLUX Kontext Multi-Ref:**
- `generateImageWavespeed()`: call wavespeed.ai REST API
  - Model: `flux-kontext-pro-multi` (supports up to 5 reference images)
  - Params: `images[]` (character sheet URLs) + `prompt` (panel description + identity anchors)
  - Fallback: `seedream-v4` nếu FLUX unavailable
- Reference images = character sheet URLs cho mỗi nhân vật trong panel
- **Luôn truyền ref images** — wavespeed.ai native support image-to-image

**Bỏ:**
- `generateImageNvidia()` → remove (replaced by wavespeed.ai)
- `generateImageOpenRouter()` → remove image gen capability (giữ LLM routing only)

### 1.4 Structured Prompt Context

#### [MODIFY] [image-gen.ts](src/lib/pipeline/image-gen.ts)

- `buildSinglePanelPrompt()`:
  - Build structured JSON context: characters (với identity anchors), location, shot type, mood, lighting
  - Inject JSON vào prompt thay vì concatenate strings
  - **CRITICAL RULE trong prompt:** `"Generate ONLY the visual scene. Do NOT include any text, speech bubbles, captions, or written words in the image. The image must contain ONLY visual elements."`

### 1.5 Error Handling Fixes

#### [MODIFY] [orchestrator.ts](src/lib/pipeline/orchestrator.ts)

1. **Long chapter handling:** Hard limit 20,000 chars. If exceeds, reject with clear error: "Chapter quá dài (tối đa 20,000 ký tự). Hãy chia thành nhiều phần."
2. **Empty panels:** If `splitIntoScenes()` returns 0 panels, set episode error "Could not extract scenes from chapter. Try a different chapter or check formatting."
3. **Bad API key (platform-side):** Catch auth errors (401/403) from wavespeed.ai, log alert, throw `ServiceError` with message "Generation service temporarily unavailable. Please try again later."

#### [MODIFY] [image-gen.ts](src/lib/pipeline/image-gen.ts)

- Extract `matchCharacterName(a: string, b: string): boolean` helper → `src/lib/utils/character-match.ts`
- Replace 2 inline usages in `orchestrator.ts`

#### [MODIFY] [orchestrator.ts](src/lib/pipeline/orchestrator.ts)

- **Eager load:** Load all panels + characters in 1 query before image gen loop
- Remove `generatePageImage()` call → use `generatePanelImage()` for each panel
- Remove `buildPagePrompt()` (dead code after refactor)

### 1.6 Credit System (Pay-as-you-go) ← moved from Phase 3

#### [MODIFY] [schema.prisma](prisma/schema.prisma)

```prisma
model User {
  // ... existing fields
  credits    Int    @default(10)  // current credit balance (10 free starter credits)
}

model CreditTransaction {
  id           String   @id @default(uuid())
  userId       String
  amount       Int      // positive = top-up, negative = deduction
  reason       String   // 'purchase', 'panel_generation', 'character_design', 'refund'
  balance      Int      // balance after transaction
  episodeId    String?  // link to episode for tracking/refund
  providerTxId String?  @unique // payment provider transaction ID (idempotency)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("credit_transactions")
}
```

#### [NEW] [billing.ts](src/lib/billing.ts)

```typescript
// Credit costs (configurable)
const CREDIT_COSTS = {
  analyze_chapter: 1,    // 1 credit per chapter analysis
  generate_panel: 2,     // 2 credits per panel image
  character_sheet: 3,    // 3 credits per character sheet
}

async function checkCredits(userId: string, required: number): Promise<boolean>
async function deductCredits(userId: string, amount: number, reason: string): Promise<void>
async function refundCredits(userId: string, amount: number, reason: string): Promise<void>
```

- **Optimistic Concurrency (NO row locks):**
```typescript
// Atomic update — safe against race conditions without SELECT FOR UPDATE
const result = await prisma.user.updateMany({
  where: { id: userId, credits: { gte: amount } },
  data: { credits: { decrement: amount } }
});
if (result.count === 0) throw new InsufficientCreditsError();
// Then log CreditTransaction...
```

- **Pre-check:** Trước khi bắt đầu pipeline, estimate total credits needed (panels × cost). Check + reserve.
- **Refund:** Nếu panel generation fail, refund credits cho panel đó.

#### Error handling:
- `InsufficientCreditsError` → trả về user-friendly message + link mua thêm credits
- Mid-pipeline out-of-credits → stop generation, save progress, refund unused credits

---

## Phase 2: SaaS Infrastructure

> Mục tiêu: Ready cho nhiều user concurrent, cloud-native.

### 2.1 Cloud Storage (R2)

#### [NEW] [storage.ts](src/lib/storage.ts)

```typescript
interface StorageProvider {
  upload(buffer: Buffer, key: string): Promise<string> // returns URL
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
  delete(key: string): Promise<void>
}
```

- Implement R2 via `@aws-sdk/client-s3` (S3-compatible)
- Key format: `{userId}/{episodeId}/{panelId}-{uuid}.png` — UUID prevents enumeration
- Dev fallback: local filesystem
- **Security:** Dùng signed URLs cho panel images (không public read)

#### [MODIFY] [image-gen.ts](src/lib/pipeline/image-gen.ts)

- `saveBase64()` và `downloadAndSave()` → gọi `storage.upload()` thay vì `writeFile`
- Return R2 URL thay vì local path

### 2.2 SSE Task Progress

#### [NEW] [route.ts](src/app/api/episodes/[episodeId]/progress/route.ts)

- SSE endpoint: `GET /api/episodes/:episodeId/progress`
- Stream: `{ status, progress, currentPanel, totalPanels, error }`
- Auth check: chỉ owner xem được progress
- **On connect:** MUST fetch current progress from DB và gửi initial payload ngay lập tức (tránh client bị "treo" khi F5)

#### [MODIFY] [orchestrator.ts](src/lib/pipeline/orchestrator.ts)

- Emit progress qua Redis pub/sub: `episode:${episodeId}:progress`
- Progress data: panel đang generate, panel đã xong, tổng panels

### 2.3 Usage Tracking

#### [MODIFY] [schema.prisma](prisma/schema.prisma)

```prisma
model UsageRecord {
  id        String   @id @default(uuid())
  userId    String
  type      String   // 'llm_call', 'image_gen'
  model     String   // 'gemini-2.0-flash', 'seedream-4.5'
  tokens    Int?     // input+output tokens for LLM
  metadata  String?  @db.Text
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("usage_records")
}
```

#### [MODIFY] [llm.ts](src/lib/ai/llm.ts) + [image-gen.ts](src/lib/pipeline/image-gen.ts)

- Log UsageRecord sau mỗi API call
- Track: model, tokens, timestamp

#### [NEW] [route.ts](src/app/api/user/usage/route.ts)

- `GET /api/user/usage` — lịch sử usage
- `GET /api/user/usage/summary` — tổng hợp trong tháng

---

## Phase 3: Business + Deploy

> Mục tiêu: Users trả tiền (Polar.sh), admin monitoring, deploy production.
> Credit system đã có từ Phase 1.6 — Phase 3 chỉ cần payment integration + admin.

### 3.1 Payment Integration (Polar.sh)

#### [NEW] [polar.ts](src/lib/polar.ts)

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })

// Credit packages
const CREDIT_PACKAGES = [
  { credits: 10, priceId: 'price_xxx', label: '10 credits' },
  { credits: 50, priceId: 'price_yyy', label: '50 credits', popular: true },
  { credits: 200, priceId: 'price_zzz', label: '200 credits' },
]
```

#### [NEW] [route.ts](src/app/api/payments/checkout/route.ts)

- `POST /api/payments/checkout` → creates Polar.sh checkout session
- Redirect user to Polar.sh hosted checkout page
- `successUrl`: `/settings?tab=credits&success=true`

#### [NEW] [route.ts](src/app/api/webhooks/polar/route.ts)

- Polar.sh webhook endpoint
- **Verify webhook signature** (Polar provides HMAC signature in headers)
- On `checkout.completed` → credit user credits
- **Idempotency:** Check `providerTxId` (CreditTransaction.providerTxId) before crediting

#### UI Changes (from Design Review — updated):

```
"Buy Credits" button → Redirect to Polar.sh hosted checkout:
┌─────────────────────────────────────┐
│  Mua Credits                        │
│                                     │
│  [10 credits — $2.50]              │
│  [50 credits — $10.00] ← phổ biến  │
│  [200 credits — $35.00]            │
│                                     │
│  → Redirects to Polar.sh checkout   │
│    (Stripe-powered, card/intl)      │
│                                     │
│  Credits cộng tự động sau thanh toán│
└─────────────────────────────────────┘
```

### 3.2 Admin Dashboard

#### [NEW] [page.tsx](src/app/admin/page.tsx)

Admin-only page (`/admin`) — protected by admin role check.

```
┌─────────────────────────────────────────────────┐
│  Admin Dashboard                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  REVENUE (this month)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Revenue  │  │ API Cost │  │ Profit   │     │
│  │ $1,200   │  │ $180     │  │ $1,020   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                 │
│  USER ACTIVITY                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ User    │ Credits │ API Calls │ Status  │   │
│  │ user1   │ 48      │ 320       │ Normal  │   │
│  │ user2   │ 2       │ 1,200     │ ⚠️ High │   │
│  │ user3   │ 150     │ 45        │ Normal  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ABUSE DETECTION                                │
│  • Flag users: API calls/hour > threshold       │
│  • Flag users: credits near 0 but high usage    │
│  • View per-user usage breakdown (model, cost)  │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### [NEW] [route.ts](src/app/api/admin/stats/route.ts)

- `GET /api/admin/stats` — aggregate revenue, cost, user activity
- Query `CreditTransaction` (revenue) + `UsageRecord` (cost)
- **Admin auth:** hardcoded admin email in env or `User.role` field

### 3.3 Docker Compose Production Deploy

#### [MODIFY] [docker-compose.yml](docker-compose.yml)

Production docker-compose:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [redis]
    restart: unless-stopped

  worker:
    build: .
    command: node dist/workers/index.js
    env_file: .env
    depends_on: [redis]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes: ["redis-data:/data"]
    restart: unless-stopped

volumes:
  redis-data:
```

- **MySQL:** Production dùng managed DB (PlanetScale hoặc Railway MySQL) — không cần trong container. **Dev:** thêm `mysql:8` service vào `docker-compose.dev.yml`
- **Redis:** Giữ local vì chỉ dùng cho BullMQ queue + pub/sub (không persistent data)
- **App + Worker:** Tách riêng — có thể scale worker independently

#### [MODIFY] [Dockerfile](Dockerfile)

- Multi-stage build: deps → build → runtime
- Production: `next start` (standalone output)
- Worker: separate entrypoint

---

## Phase E2E: End-to-End Tests (xuyên suốt)

### Setup

#### [NEW] [playwright.config.ts](playwright.config.ts)

Standard Playwright config, baseURL `http://localhost:3000`

#### [MODIFY] [package.json](package.json)

- Thêm `@playwright/test` vào devDependencies
- Thêm script: `"test:e2e": "playwright test"`

### E2E Test Cases

| Test File | Covers | Phase |
|---|---|---|
| `e2e/auth.spec.ts` | Register → Login → Session → Logout, invalid credentials, protected routes | 1 |
| `e2e/project-crud.spec.ts` | Create/delete/edit project | 1 |
| `e2e/webtoon-pipeline.spec.ts` | Paste chapter → analyze → storyboard → generate panels → view webtoon | 1 |
| `e2e/character-consistency.spec.ts` | Create character → generate sheet → verify consistent across panels | 1 |
| `e2e/usage-credits.spec.ts` | Generate content → usage tracked → credits deducted → insufficient credits error | 2-3 |

### Unit Tests (Vitest, thêm mới — FULL SPECS from Eng Review)

#### `orchestrator.test.ts` — Pipeline orchestration (Phase 1)
```
describe('runAnalyzeStep')
  ✓ extracts characters and locations from chapter text (mock LLM)
  ✓ handles provider config missing → sets episode error with clear message
  ✓ handles chapter exceeding LLM context → chunked analysis or clear error
  ✓ handles LLM returning 0 characters → warning log, continues
  ✓ handles character sheet gen failure → partial success (chars without sheets)
  ✓ skips if episode already in processing status

describe('runStoryboardStep')
  ✓ creates panels with dialogue field separated
  ✓ handles 0 panels returned → episode error
  ✓ handles LLM hallucinating nonexistent characters → filters to known chars

describe('runImageGenStep')
  ✓ generates 1 image per panel (not per page)
  ✓ passes reference images to API calls
  ✓ handles content filter blocking panel → marks panel, continues others
  ✓ handles all panels failing → episode error, refunds credits
  ✓ handles storage save failure → retry 2x, then error
  ✓ handles insufficient credits mid-pipeline → stops, refunds unused
  ✓ eager loads all panels + characters before loop (no N+1)
```

#### `image-gen.test.ts` — Image generation (Phase 1)
```
describe('generatePanelImage')
  ✓ builds prompt with NO TEXT enforcement rule
  ✓ passes reference images to wavespeed.ai FLUX Kontext API
  ✓ uses portrait size (1024x1536)
  ✓ saves via StorageProvider interface (local in Phase 1, R2 in Phase 2)

describe('generateImageWavespeed')
  ✓ calls wavespeed.ai REST API with correct model
  ✓ passes up to 5 reference images via images[] param
  ✓ handles 429 rate limit → retry with backoff
  ✓ handles content filter → throws ContentFilterError
  ✓ handles empty response → throws with debug info
  ✓ handles bad platform API key → throws ServiceError + alert log
  ✓ falls back to seedream-v4 when FLUX unavailable
```

#### `character-design.test.ts` — Character identity (Phase 1)
```
describe('generateCharacterDescription')
  ✓ returns structured JSON identity anchor (not just text)
  ✓ JSON includes required fields: name, ageRange, gender, hairColor, etc.

describe('generateCharacterSheet')
  ✓ passes reference images to image gen API
```

#### `reference-images.test.ts` — Reference image collection (Phase 1)
```
describe('collectPanelReferenceImages')
  ✓ returns character sheet URLs for characters in panel
  ✓ returns empty array when no characters have sheets
  ✓ uses matchCharacterName() for fuzzy matching
```

#### `billing.test.ts` — Credit system (Phase 1)
```
describe('checkCredits')
  ✓ returns true when sufficient
  ✓ returns false when insufficient

describe('deductCredits')
  ✓ deducts correct amount, creates transaction record
  ✓ uses optimistic concurrency (updateMany + gte) — NO row locks
  ✓ prevents negative balance

describe('refundCredits')
  ✓ adds credits back, creates transaction with 'refund' reason
```

#### `storage.test.ts` — StorageProvider (Phase 1: local, Phase 2: R2)
```
describe('LocalStorageProvider')
  ✓ saves buffer to local filesystem, returns path
  ✓ uses UUID-based filename (not enumerable)
  ✓ handles disk write failure → throws StorageError

describe('R2StorageProvider') — Phase 2
  ✓ uploads buffer to R2, returns URL
  ✓ handles network failure → throws StorageError
  ✓ getSignedUrl returns signed URL with correct expiry
```

#### `utils.test.ts` — Shared helpers (Phase 1)
```
describe('matchCharacterName')
  ✓ matches exact name
  ✓ matches partial name (fuzzy)
  ✓ case insensitive
  ✓ returns false for non-matching names
```

---

## Error & Rescue Registry (updated — reflects wavespeed.ai pivot + resolved gaps)

```
METHOD/CODEPATH              | FAILURE MODE                   | RESCUED? | USER SEES
-----------------------------|--------------------------------|----------|-------------------
analyzeCharactersAndLocations| LLM timeout                    | ✅ retry | "Analysis timed out, retrying..."
                             | Malformed JSON response        | ✅       | jsonrepair auto-fix
                             | Content filter                 | ✅ FIXED | Specific error message
                             | Chapter exceeds LLM context    | ✅ FIXED | Hard limit 20,000 chars error
splitIntoScenes              | 0 panels returned              | ✅ FIXED | "Could not extract scenes" error
                             | LLM hallucinates characters    | ✅ FIXED | Filters to known chars only
generateImageWavespeed       | 429 rate limit                 | ✅       | Transparent retry with backoff
                             | Content filter                 | ✅       | "Panel blocked by content filter"
                             | Empty response                 | ✅       | Error with debug info
                             | 500/502/503                    | ✅       | Retry 3x with backoff
                             | Bad platform API key           | ✅ FIXED | "Service temporarily unavailable"
                             | FLUX unavailable               | ✅       | Fallback to seedream-v4
StorageProvider              | Save failure (local/R2)        | ❌ Phase2| Retry 2x then error
                             | Quota exceeded                 | ❌ Phase2| Specific error
deductCredits                | Race condition (concurrent)    | ✅ FIXED | Optimistic concurrency (updateMany + gte)
                             | Insufficient mid-pipeline      | ✅ FIXED | Stops generation, refunds unused
```

**Remaining gaps:** Storage error handling — addressed in Phase 2 with R2 implementation.

---

## Security Checklist

- [ ] R2 image URLs: dùng UUID keys + signed URLs (không public, không enumerable)
- [ ] Platform API keys (wavespeed.ai, OpenRouter): store in env vars, never expose to client
- [ ] Prompt injection: sanitize novel text trước khi gửi LLM (strip HTML tags minimum)
- [ ] Credit system: **Optimistic concurrency** (`updateMany` + `gte`) — NO row locks
- [ ] Rate limiting: per-user rate limit trên pipeline API (BullMQ limiter)
- [ ] IDOR check: mọi API route phải verify `userId` match session
- [ ] Polar.sh webhook: verify HMAC signature + `providerTxId` idempotency
- [ ] Admin routes: protect with admin role/email check

---

## Performance Notes

- **Memory budget:** 4GB VPS, 10 concurrent users. Mỗi panel image ~2MB buffer. Cần streaming upload to R2 thay vì buffer toàn bộ.
- **Redis:** Tăng maxmemory lên 128MB (từ 64MB). BullMQ + pub/sub cho 10 users cần ~50-80MB.
- **N+1 queries:** `runImageGenStep()` cần eager load characters + panels. Dùng Prisma `include`.
- **LLM calls per chapter (20 panels):** ~25 API calls. Rate limit: max 2 concurrent chapters per VPS.

---

## Observability (minimum for launch)

- [ ] Structured JSON logging (thay `console.log`)
- [ ] Mọi log line có `episodeId` + `userId`
- [ ] Metric: `pipeline_duration_seconds` (per step)
- [ ] Alert: episodes stuck in `analyzing`/`storyboarding`/`imaging` >10 minutes
- [ ] Health check endpoint: `/api/health` (đã có)

---

## Deployment Checklist

- [ ] Managed MySQL setup (PlanetScale/Railway)
- [ ] R2 bucket + API credentials
- [ ] VPS setup (4GB RAM minimum)
- [ ] Docker Compose deploy
- [ ] SSL/domain setup
- [ ] Prisma migration against production DB
- [ ] Seed data (credit packages, default settings)
- [ ] Smoke test: register → paste chapter → generate → view webtoon

---

## Thứ tự thực hiện

```
Phase 1 (Webtoon Pipeline + Credits)
├── 1.1 Webtoon pipeline refactor (panel = 1 image, bỏ page gen)
│   ├── Modify orchestrator.ts (1 image/panel)
│   ├── Modify analyze.ts (splitIntoScenes)
│   ├── Modify image-gen.ts (NO TEXT rule, portrait size, wavespeed.ai)
│   └── Schema: Panel.dialogue, Episode.format
├── 1.2 Character consistency (JSON identity anchors)
│   ├── Modify character-design.ts (structured JSON output)
│   └── Schema: CharacterAppearance fields
├── 1.3 Reference image injection (wavespeed.ai FLUX Kontext)
│   ├── New: reference-images.ts
│   └── New: generateImageWavespeed() (multi-ref support)
├── 1.4 Structured prompt context
│   └── Modify image-gen.ts (JSON context + NO TEXT enforcement)
├── 1.5 Error handling (hard limit 20k chars, empty panels, bad API key)
├── 1.6 Credit system (optimistic concurrency)
│   ├── Schema: User.credits + CreditTransaction (episodeId, providerTxId)
│   ├── New: billing.ts (check/deduct/refund)
│   └── Pre-check + refund on failure
└── Tests: unit + E2E for pipeline + credits

Phase 2 (SaaS Infrastructure)
├── 2.1 R2 Cloud Storage (signed URLs)
│   ├── New: r2-storage-provider.ts (implement StorageProvider)
│   ├── Modify: image-gen.ts (upload to R2)
│   └── Security: signed URLs, UUID keys
├── 2.2 SSE Task Progress (+ initial state on connect)
│   ├── New: progress SSE endpoint
│   └── Modify: orchestrator.ts (Redis pub/sub)
├── 2.3 Usage Tracking
│   ├── Schema: UsageRecord
│   └── Modify: llm.ts + image-gen.ts (log usage)
└── Tests: unit + E2E

Phase 3 (Business + Deploy)
├── 3.1 Payment (Polar.sh)
│   ├── New: polar.ts (SDK integration)
│   ├── New: checkout + webhook routes
│   └── Webhook signature verify + idempotency
├── 3.2 Admin Dashboard
│   ├── New: /admin page (revenue, cost, abuse)
│   └── New: /api/admin/stats route
├── 3.3 Docker Compose Production
│   ├── Modify: docker-compose.yml (app + worker + redis)
│   ├── Modify: Dockerfile (multi-stage)
│   └── Managed MySQL setup
└── Tests: E2E payment + admin flow
```

---

## NOT in scope (deferred)

| Item | Rationale |
|---|---|
| Manga panel layout engine | Pivot sang webtoon — đơn giản hóa |
| Auto text bubble placement | User tự chèn text — LLM làm text xấu |
| BYOK (Bring Your Own Key) option | Complexity UX (key setup wizard), support burden nhiều providers. Defer — nếu users yêu cầu |
| Multi-language UI | Vietnamese + English sau khi có users |
| Mobile app | Web-first, responsive design đủ cho webtoon reader |
| Stateful chapter chunking | Defer — MVP dùng hard limit 20,000 chars. Chunking cần seed context passing (complex) |
| SePay QR bank transfer | Replaced by Polar.sh. Có thể add later nếu VN users yêu cầu |

## What already exists (reuse map)

| Sub-problem | Existing code | Status |
|---|---|---|
| Character analysis | `analyze.ts:analyzeCharactersAndLocations()` | Enhance for structured JSON |
| Storyboarding | `analyze.ts:splitIntoPagesWithPanels()` | Refactor → `splitIntoScenes()` |
| Image generation | `image-gen.ts` (multi-provider) | **Pivot:** wavespeed.ai (bỏ NVIDIA/OpenRouter image gen) |
| Reference image collection | `orchestrator.ts:286-293` | Fix: pass to wavespeed.ai FLUX Kontext multi-ref API |
| Character identity anchors | `orchestrator.ts:buildCharacterCanon()` | Enhance JSON format |
| LLM routing | `api-config.ts` + OpenRouter | Reuse — OpenRouter chỉ cho LLM calls |
| Auth + sessions | Session-based with bcrypt | Reuse 100% |
| Job queue | BullMQ pipeline | Reuse 100% |
| Rate limiting | `rate-limiter.ts` | Reuse 100% |
| StorageProvider interface | `providers/storage` (existing abstraction) | Implement R2 provider |

## Dream state delta

```
CURRENT STATE                    AFTER THIS PLAN                12-MONTH IDEAL
─────────────────────────────    ─────────────────────────     ─────────────────────────
Localhost MVP                    Deployed SaaS (VPS)            Multi-region, auto-scale
Manga page layout (complex)     Webtoon vertical (simple)      Both formats supported
Inconsistent characters         JSON identity anchors           LoRA fine-tuned per character
Local filesystem                R2 cloud storage                CDN-backed, global edge
No monetization                 Pay-as-you-go credits           Tiered subs + marketplace
Text in images (ugly)           No text in images               Smart text overlay engine
Manual testing only             Unit + E2E tests                CI/CD + staging + canary
```

## Failure Modes Registry (updated with fixes)

```
CODEPATH              | FAILURE MODE            | RESCUED? | TEST? | USER SEES?           | LOGGED?
----------------------|-------------------------|----------|-------|----------------------|--------
analyzeChars          | LLM timeout             | ✅       | ❌    | Retry message        | ✅
analyzeChars          | Chapter too long        | ✅ FIXED | ❌    | Hard limit error     | ✅
splitIntoScenes       | 0 panels                | ✅ FIXED | ❌    | Clear error message  | ✅
generateImageWS       | Bad platform API key    | ✅ FIXED | ❌    | Service unavailable  | ✅
deductCredits         | Race condition          | ✅ FIXED | ❌    | Optimistic update    | ✅
R2 upload             | Network fail            | ❌ Phase2| ❌    | Retry 2x then error  | ✅
polarWebhook          | Replay/forge            | ✅ FIXED | ❌    | Signature verify     | ✅
```

**1 remaining gap** (R2 upload) — addressed in Phase 2.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | mode: HOLD_SCOPE, 4 critical gaps (fixed in eng review) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 issues, 0 critical gaps (all resolved) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 8/10, 8 decisions made |

**UNRESOLVED:** 0 unresolved decisions.
**VERDICT:** CEO + ENG + DESIGN + AUDIT CLEARED — ready to implement.

---

## Audit Log (Merged)

> All 6 findings from the deep-think audit have been **merged into the plan body**:
>
> | # | Finding | Resolution | Merged into |
> |---|---------|------------|-------------|
> | 1.1 | Ref images qua OpenRouter không work | **Pivot to wavespeed.ai** FLUX Kontext multi-ref | Phase 1.3 |
> | 1.2 | SePay UUID quá dài | **Pivot to Polar.sh** (bỏ SePay) | Phase 3.1 |
> | 1.3 | Prisma SELECT FOR UPDATE | **Optimistic concurrency** `updateMany` + `gte` | Phase 1.6 |
> | 2.1 | Chunking mất trí nhớ | **Hard limit 20,000 chars** (defer chunking) | Phase 1.5 |
> | 2.2 | R2 signed URLs bottleneck | **Giữ signed URLs** (CEO decision) | Phase 2.1 |
> | 2.3 | SSE treo khi F5 | **Fetch initial state on connect** | Phase 2.2 |
> | 2.4 | Webhook security | **Polar.sh HMAC signature** + `providerTxId` idempotency | Phase 3.1 |
> | Schema | CreditTransaction thiếu fields | Added `episodeId` + `providerTxId` | Phase 1.6 |
