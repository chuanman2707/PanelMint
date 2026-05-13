# PanelMint OSS Phase 3 Billing Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove PanelMint's in-app credit, billing, usage accounting, and Premium render tier systems so local OSS generation has one render mode and no monetization gates.

**Architecture:** Delete billing concepts from the schema first, then remove runtime callers by flow before deleting helper modules and routes. Keep `User` as the local owner record, keep provider API-key Settings until Phase 4, and keep rate limiting. Image generation becomes one WaveSpeed model path with character sheets always eligible after analysis approval.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma/Postgres, Vitest, GitNexus MCP.

---

## File Structure

Core schema and SQL:

- Modify `prisma/schema.prisma`: remove billing/usage/render-tier fields and models.
- Modify `prisma/postgres-baseline.sql`: match the simplified schema for fresh local setup.
- Modify `prisma/migrations/20260330104038_init/migration.sql`: align the initial migration with the simplified OSS schema.

Local user:

- Modify `src/lib/local-user.ts`: remove credit starter behavior and return only local owner identity.
- Modify `src/hooks/useLocalUser.tsx`: remove credit/tier fields from client type.
- Modify tests in `src/lib/__tests__/local-user.test.ts`, `src/hooks/useLocalUser.test.tsx`, and `src/app/api/local-user/route.test.ts`.

Generation request and create UI:

- Modify `src/lib/validators/generate.ts`: remove `imageModelTier`.
- Modify `src/components/GenerateForm.tsx`: remove credits, cost estimate, Standard/Premium selector.
- Modify `src/components/GenerateForm.test.tsx`.
- Modify `src/app/(app)/create/page.tsx`: stop passing credit props.
- Modify `src/app/(app)/create/useCreateWorkflow.ts`: stop sending `imageModelTier`.
- Modify `src/app/(app)/create/useCreateWorkflow.test.tsx`.

Backend routes:

- Modify `src/app/api/generate/route.ts`.
- Modify `src/app/api/generate/route.test.ts`.
- Modify `src/app/api/generate/[runId]/approve-analysis/route.ts`.
- Modify `src/app/api/generate/[runId]/approve-analysis/route.test.ts`.
- Modify `src/app/api/generate/[runId]/generate-images/route.ts`.
- Modify `src/app/api/generate/[runId]/generate-images/route.test.ts`.
- Modify `src/app/api/episodes/[episodeId]/retry/route.ts`.
- Modify `src/app/api/episodes/[episodeId]/retry/route.test.ts`.
- Modify `src/app/api/characters/[characterId]/generate-sheet/route.ts`.
- Modify `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`.

Pipeline and AI:

- Modify `src/lib/pipeline/orchestrator.ts`.
- Modify `src/lib/pipeline/panel-image-executor.ts`.
- Modify `src/lib/pipeline/character-sheet-step.ts`.
- Modify `src/lib/pipeline/image-gen.ts`.
- Modify `src/lib/ai/llm.ts`.
- Modify `src/lib/ai/character-design.ts`.
- Modify related tests in `src/lib/__tests__`.

Deleted billing/usage runtime:

- Delete `src/lib/billing.ts`.
- Delete `src/lib/credit-catalog.ts`.
- Delete `src/lib/usage.ts`.
- Delete credit/usage API routes and tests under `src/app/api/user`.
- Delete `src/lib/__tests__/billing.test.ts`.
- Delete `src/lib/__tests__/usage.test.ts`.
- Modify `package.json` `test:critical`.

UI cleanup:

- Modify `src/components/layout/Sidebar.tsx`.
- Rewrite `src/app/(app)/settings/page.tsx` to provider/API-key settings only.
- Modify `src/components/dashboard/DashboardSections.tsx`.
- Modify `src/components/public/public-content.ts`.
- Modify `src/components/public/PublicSections.tsx`.
- Modify `src/components/public/LandingPageClient.tsx`.
- Modify `src/components/ui/NeoNavbar.tsx`.
- Modify `src/app/(public)/layout.tsx`.
- Delete `src/app/(public)/pricing/page.tsx`.
- Delete `src/app/(app)/dashboard/pricing/page.tsx`.
- Delete `src/app/(app)/payment/status/page.tsx`.
- Modify public/page tests if pricing links are asserted.

## Safety Rules For Every Task

- Before editing any listed function, class, or method, run GitNexus impact on that symbol with `direction: "upstream"` and report risk in the task notes.
- If GitNexus reports HIGH or CRITICAL risk, stop and state the risk before editing that symbol.
- Do not touch the existing dirty image/storage changes unless the task explicitly modifies the same file. If a same-file edit is needed, preserve the existing dirty changes.
- Use `apply_patch` for manual edits.
- Commit after each task with only the files from that task.

---

### Task 1: Remove Billing Schema

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `prisma/postgres-baseline.sql`
- Modify: `prisma/migrations/20260330104038_init/migration.sql`

- [ ] **Step 1: Run impact checks before schema edits**

Run GitNexus MCP impacts:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "User", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "Project", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "PipelineEvent", direction: "upstream", includeTests: true, maxDepth: 2 })
```

Expected: GitNexus may not resolve Prisma models cleanly. If it returns candidates or not found, record that and continue with file-level schema cleanup.

- [ ] **Step 2: Edit Prisma schema**

In `prisma/schema.prisma`, remove these `User` fields:

```prisma
  credits                  Int                 @default(300)
  accountTier              String              @default("free")
  lifetimePurchasedCredits Int                 @default(0)
  creditTransactions       CreditTransaction[]
  usageRecords             UsageRecord[]
```

Remove this `Project` field:

```prisma
  imageModel String?
```

Delete both full models:

```prisma
model CreditTransaction {
  id           String   @id @default(uuid())
  userId       String
  amount       Int
  reason       String
  balance      Int
  episodeId    String?
  providerTxId String?  @unique
  operationKey String?  @unique @map("operation_key") @db.Text
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("credit_transactions")
}

model UsageRecord {
  id        String   @id @default(uuid())
  userId    String
  type      String
  model     String
  tokens    Int?
  cost      Float?
  metadata  String?  @db.Text
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("usage_records")
}
```

Remove this `PipelineEvent` field:

```prisma
  creditOperationKey String?     @unique @map("credit_operation_key") @db.Text
```

- [ ] **Step 3: Edit baseline SQL**

In `prisma/postgres-baseline.sql`, remove:

```sql
    "credits" INTEGER NOT NULL DEFAULT 300,
    "accountTier" TEXT NOT NULL DEFAULT 'free',
    "lifetimePurchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "imageModel" TEXT,
    "credit_operation_key" TEXT,
```

Delete `CREATE TABLE "credit_transactions"` and `CREATE TABLE "usage_records"` blocks.

Delete indexes and foreign keys for:

```sql
credit_transactions_providerTxId_key
credit_transactions_operation_key_key
credit_transactions_userId_createdAt_idx
usage_records_userId_createdAt_idx
pipeline_events_credit_operation_key_key
credit_transactions_userId_fkey
usage_records_userId_fkey
```

- [ ] **Step 4: Edit initial migration SQL**

Apply the same SQL removals in `prisma/migrations/20260330104038_init/migration.sql`.

- [ ] **Step 5: Validate schema formatting**

Run:

```bash
npx prisma format
npx prisma validate
```

Expected: both pass.

- [ ] **Step 6: Commit schema cleanup**

```bash
git add prisma/schema.prisma prisma/postgres-baseline.sql prisma/migrations/20260330104038_init/migration.sql
git commit -m "refactor: remove billing schema"
```

---

### Task 2: Simplify Local User Shape

**Files:**

- Modify: `src/lib/local-user.ts`
- Modify: `src/hooks/useLocalUser.tsx`
- Modify: `src/lib/__tests__/local-user.test.ts`
- Modify: `src/hooks/useLocalUser.test.tsx`
- Modify: `src/app/api/local-user/route.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "getOrCreateLocalUser", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "LocalUserProvider", direction: "upstream", includeTests: true, maxDepth: 2 })
```

Expected: `getOrCreateLocalUser` is HIGH risk because many routes call it. Report that before edits.

- [ ] **Step 2: Remove billing fields from local user module**

In `src/lib/local-user.ts`:

Remove:

```ts
import { STARTER_CREDITS } from './billing'
```

Change `LocalUser` to:

```ts
export interface LocalUser {
    id: string
    email: string
    name: string | null
}
```

Change `mapLocalUser` to:

```ts
function mapLocalUser(user: LocalUser): LocalUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
    }
}
```

Every Prisma `select` in `getOrCreateLocalUser` should select only:

```ts
select: {
    id: true,
    email: true,
    name: true,
}
```

The `tx.user.create` call should use:

```ts
const created = await tx.user.create({
    data: {
        email: LOCAL_USER_EMAIL,
        name: LOCAL_USER_NAME,
    },
    select: {
        id: true,
        email: true,
        name: true,
    },
})
```

Delete the `tx.creditTransaction.create` starter bonus block entirely.

- [ ] **Step 3: Remove billing fields from hook type**

In `src/hooks/useLocalUser.tsx`, change `LocalUser` to:

```ts
interface LocalUser {
    id: string
    email: string
    name: string | null
}
```

- [ ] **Step 4: Update local user tests**

In `src/lib/__tests__/local-user.test.ts`, remove `creditTransaction` mocks and `vi.mock('@/lib/billing')`. Local user fixtures should be:

```ts
const userRecord = {
    id: 'user-1',
    email: 'local@panelmint.dev',
    name: 'Local Creator',
}
```

Expected assertions:

```ts
expect(result).toEqual(userRecord)
expect(prismaMock.creditTransaction?.create).toBeUndefined()
```

If the optional chained assertion is awkward because the mock object still declares `creditTransaction`, delete that mock key instead and assert the create call data has no `credits` or `accountTier`:

```ts
expect(prismaMock.user.create).toHaveBeenCalledWith({
    data: {
        email: 'local@panelmint.dev',
        name: 'Local Creator',
    },
    select: {
        id: true,
        email: true,
        name: true,
    },
})
```

- [ ] **Step 5: Update hook and route tests**

In `src/hooks/useLocalUser.test.tsx`, replace helper with:

```ts
function localUser(id: string) {
    return {
        id,
        email: `${id}@example.test`,
        name: 'Local Creator',
    }
}
```

In `src/app/api/local-user/route.test.ts`, expected JSON should be:

```ts
{
    user: {
        id: 'user-1',
        email: 'local@panelmint.dev',
        name: 'Local Creator',
    },
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/__tests__/local-user.test.ts src/hooks/useLocalUser.test.tsx src/app/api/local-user/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit local user cleanup**

```bash
git add src/lib/local-user.ts src/hooks/useLocalUser.tsx src/lib/__tests__/local-user.test.ts src/hooks/useLocalUser.test.tsx src/app/api/local-user/route.test.ts
git commit -m "refactor: simplify local user shape"
```

---

### Task 3: Remove Render Tier From Create Request And Form

**Files:**

- Modify: `src/lib/validators/generate.ts`
- Modify: `src/lib/validators/generate.test.ts`
- Modify: `src/components/GenerateForm.tsx`
- Modify: `src/components/GenerateForm.test.tsx`
- Modify: `src/app/(app)/create/page.tsx`
- Modify: `src/app/(app)/create/useCreateWorkflow.ts`
- Modify: `src/app/(app)/create/useCreateWorkflow.test.tsx`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "generateRequestSchema", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "GenerateForm", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "useCreateWorkflow", direction: "upstream", includeTests: true, maxDepth: 2 })
```

- [ ] **Step 2: Update request schema test first**

In `src/lib/validators/generate.test.ts`, add or update a test:

```ts
it('ignores removed image model tier input', () => {
    const parsed = generateRequestSchema.parse({
        text: 'story',
        artStyle: 'manga',
        pageCount: 15,
        imageModelTier: 'premium',
    })

    expect(parsed).toEqual({
        text: 'story',
        artStyle: 'manga',
        pageCount: 15,
    })
})
```

- [ ] **Step 3: Run schema test to verify failure**

Run:

```bash
npm test -- src/lib/validators/generate.test.ts
```

Expected before implementation: FAIL if `imageModelTier` is still returned.

- [ ] **Step 4: Remove render tier from schema**

In `src/lib/validators/generate.ts`, delete:

```ts
import { IMAGE_MODEL_TIERS } from '@/lib/credit-catalog'
```

Change schema to:

```ts
export const generateRequestSchema = z.object({
    text: z.string()
        .trim()
        .min(1, 'Text is required')
        .max(
            MAX_STORY_MANUSCRIPT_CHARS,
            GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT,
        ),
    artStyle: artStyleSchema.optional().default('manga'),
    pageCount: z.coerce.number().int().min(5, 'pageCount must be between 5 and 30').max(30, 'pageCount must be between 5 and 30').optional().default(15),
})
```

- [ ] **Step 5: Update create workflow**

In `src/app/(app)/create/useCreateWorkflow.ts`, change handler signature to:

```ts
const handleGenerate = useCallback(async (text: string, artStyle: string, pageCount: number) => {
```

Change request body to:

```ts
body: JSON.stringify({ text, artStyle, pageCount }),
```

Update tests to call:

```ts
await result.current.handleGenerate('story', 'manga', 15)
```

Delete the old insufficient credit test and replace it with:

```ts
it('surfaces generation API errors', async () => {
    fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'WaveSpeed API key is missing' }), { status: 400 }),
    )

    const { result } = renderHook(() => useCreateWorkflow({ resumeId: null }))

    await act(async () => {
        await result.current.handleGenerate('story', 'manga', 15)
    })

    expect(result.current.error).toBe('WaveSpeed API key is missing')
    expect(result.current.state).toBe('input')
})
```

- [ ] **Step 6: Update GenerateForm props and submit**

In `src/components/GenerateForm.tsx`, remove imports from `next/link` and `@/lib/credit-catalog`.

Change props:

```ts
interface GenerateFormProps {
    onGenerate: (text: string, artStyle: string, pageCount: number) => void
    isLoading: boolean
    disabled?: boolean
}

export function GenerateForm({ onGenerate, isLoading, disabled = false }: GenerateFormProps) {
```

Remove `imageModelTier` state and draft persistence. Draft parsing should ignore old keys:

```ts
const parsed = JSON.parse(savedDraft) as {
    text?: string
    artStyle?: string
    pageCount?: number
}
```

Default draft check should be:

```ts
const isDefaultDraft = !text && artStyle === 'manga' && pageCount === 15
```

Stored draft should be:

```ts
JSON.stringify({
    text,
    artStyle,
    pageCount,
})
```

Submit should call:

```ts
onGenerate(text.trim(), artStyle, pageCount)
```

Remove the whole credits overview box, render quality section, estimated cost box, and insufficient credits block.

Submit disabled logic becomes:

```ts
const isSubmitDisabled = !text.trim() || isLoading || disabled || isAtCharLimit
```

- [ ] **Step 7: Update CreatePage**

In `src/app/(app)/create/page.tsx`, remove:

```ts
const { user } = useLocalUser()
```

Remove these props from `<GenerateForm>`:

```tsx
credits={user?.credits ?? 0}
accountTier={user?.accountTier ?? 'free'}
```

Remove the `useLocalUser` import if unused.

- [ ] **Step 8: Update GenerateForm tests**

Use this render helper:

```tsx
function renderGenerateForm(overrides: Partial<React.ComponentProps<typeof GenerateForm>> = {}) {
    const onGenerate = vi.fn()
    render(
        <GenerateForm
            onGenerate={onGenerate}
            isLoading={false}
            {...overrides}
        />,
    )
    return { onGenerate }
}
```

Replace insufficient-credit test with:

```ts
it('does not render credit or premium controls', () => {
    renderGenerateForm()

    expect(screen.queryByText(/available balance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/premium/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/insufficient credits/i)).not.toBeInTheDocument()
})
```

Submit assertion should expect:

```ts
expect(onGenerate).toHaveBeenCalledWith('Once upon a time', 'manga', 15)
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
npm test -- src/lib/validators/generate.test.ts src/components/GenerateForm.test.tsx 'src/app/(app)/create/useCreateWorkflow.test.tsx'
```

Expected: PASS.

- [ ] **Step 10: Commit create flow cleanup**

```bash
git add src/lib/validators/generate.ts src/lib/validators/generate.test.ts src/components/GenerateForm.tsx src/components/GenerateForm.test.tsx 'src/app/(app)/create/page.tsx' 'src/app/(app)/create/useCreateWorkflow.ts' 'src/app/(app)/create/useCreateWorkflow.test.tsx'
git commit -m "refactor: remove render tiers from create flow"
```

---

### Task 4: Remove Billing Gates From API Routes

**Files:**

- Modify: `src/app/api/generate/route.ts`
- Modify: `src/app/api/generate/route.test.ts`
- Modify: `src/app/api/generate/[runId]/approve-analysis/route.ts`
- Modify: `src/app/api/generate/[runId]/approve-analysis/route.test.ts`
- Modify: `src/app/api/generate/[runId]/generate-images/route.ts`
- Modify: `src/app/api/generate/[runId]/generate-images/route.test.ts`
- Modify: `src/app/api/episodes/[episodeId]/retry/route.ts`
- Modify: `src/app/api/episodes/[episodeId]/retry/route.test.ts`
- Modify: `src/app/api/characters/[characterId]/generate-sheet/route.ts`
- Modify: `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "POST", file_path: "src/app/api/generate/route.ts", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "POST", file_path: "src/app/api/generate/[runId]/approve-analysis/route.ts", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "POST", file_path: "src/app/api/generate/[runId]/generate-images/route.ts", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "POST", file_path: "src/app/api/episodes/[episodeId]/retry/route.ts", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "POST", file_path: "src/app/api/characters/[characterId]/generate-sheet/route.ts", direction: "upstream", includeTests: true, maxDepth: 2 })
```

- [ ] **Step 2: Update generate route tests first**

In `src/app/api/generate/route.test.ts`, remove billing mocks and premium-block test. Add:

```ts
it('creates a queued generation without credit checks or render tier gates', async () => {
    mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1', email: 'local@panelmint.dev', name: 'Local Creator' })
    mocks.checkRateLimit.mockResolvedValue(null)
    mocks.prisma.episode.findFirst.mockResolvedValue(null)
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma))
    mocks.prisma.project.create.mockResolvedValue({
        id: 'project-1',
        episodes: [{ id: 'episode-1' }],
    })

    const res = await POST(new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        body: JSON.stringify({
            text: 'A story',
            artStyle: 'manga',
            pageCount: 15,
        }),
    }))

    expect(res.status).toBe(200)
    expect(mocks.prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.not.objectContaining({ imageModel: expect.anything() }),
    }))
    expect(mocks.enqueueAnalyze).toHaveBeenCalledWith(expect.objectContaining({
        episodeId: 'episode-1',
        userId: 'user-1',
    }))
})
```

- [ ] **Step 3: Update generate route**

In `src/app/api/generate/route.ts`, remove import from `@/lib/billing` and `AppError` if no longer used.

Parse:

```ts
const {
    text,
    artStyle: normalizedArtStyle,
    pageCount: clampedPageCount,
} = await parseJsonBody(request, generateRequestSchema)
```

Delete Premium gate and kickoff credit check.

Project create data should not include `imageModel`.

Pipeline event metadata should not include `imageModelTier`.

- [ ] **Step 4: Update approve-analysis route**

In `src/app/api/generate/[runId]/approve-analysis/route.ts`, remove `normalizeImageModelTier` import and project lookup for `imageModel`.

Replace the enqueue block with:

```ts
const [storyboardResult, characterSheetResult] = await Promise.allSettled([
    enqueueStoryboard(runId),
    enqueueCharacterSheets(runId),
])
```

Replace final character-sheet error branch with:

```ts
if (characterSheetResult.status === 'rejected') {
    console.error('[Pipeline] Failed to enqueue character sheets:', characterSheetResult.reason)
}
```

Update tests so character sheets are always enqueued after analysis approval.

- [ ] **Step 5: Update generate-images route**

In `src/app/api/generate/[runId]/generate-images/route.ts`, remove billing imports and `AppError` if unused.

When loading episode, project select only needs:

```ts
project: {
    select: {
        id: true,
    },
},
```

Delete the Premium-only missing-reference check block. Delete total credit cost calculation and `checkCredits`.

Keep existing panel validation, status updates, event recording, and enqueue behavior.

Update tests by deleting:

```ts
it('returns 409 when premium rendering requires character sheets that are not ready', ...)
```

Add an assertion that generation queues even when characters lack sheets:

```ts
expect(response.status).toBe(200)
expect(mocks.enqueueImageGen).toHaveBeenCalled()
```

- [ ] **Step 6: Update retry route**

In `src/app/api/episodes/[episodeId]/retry/route.ts`, remove billing imports and `AppError` if unused.

Episode lookup no longer needs `imageModel`:

```ts
include: {
    project: { select: { id: true } },
},
```

Delete total credit cost and `checkCredits`.

Update tests by replacing the `returns 402 when the user lacks credits` test with:

```ts
it('queues failed panels without checking credits', async () => {
    const res = await POST(new NextRequest('http://localhost/api/episodes/episode-1/retry', {
        method: 'POST',
        body: JSON.stringify({}),
    }), { params: Promise.resolve({ episodeId: 'episode-1' }) })

    expect(res.status).toBe(200)
    expect(mocks.enqueueImageGen).toHaveBeenCalledWith('episode-1', ['panel-1'])
})
```

- [ ] **Step 7: Update manual character sheet route**

In `src/app/api/characters/[characterId]/generate-sheet/route.ts`, remove billing import, `operationKey`, `refundOperationKey`, and `charged` logic.

Route body should be:

```ts
const providerConfig = await getProviderConfig(localUser.id)

const { imageUrl, storageKey } = await generateCharacterSheet(
    character.id,
    character.description,
    character.project.artStyle,
    providerConfig,
    localUser.id,
)

if (!imageUrl) {
    throw new Error(`Character sheet returned no image for ${character.name}`)
}

await prisma.character.update({
    where: { id: characterId },
    data: { imageUrl, storageKey },
})

return NextResponse.json({ imageUrl })
```

Update tests to remove billing mocks and assert no credit behavior.

- [ ] **Step 8: Run route tests**

Run:

```bash
npm test -- src/app/api/generate/route.test.ts 'src/app/api/generate/[runId]/approve-analysis/route.test.ts' 'src/app/api/generate/[runId]/generate-images/route.test.ts' 'src/app/api/episodes/[episodeId]/retry/route.test.ts' 'src/app/api/characters/[characterId]/generate-sheet/route.test.ts'
```

Expected: PASS.

- [ ] **Step 9: Commit route cleanup**

```bash
git add src/app/api/generate/route.ts src/app/api/generate/route.test.ts 'src/app/api/generate/[runId]/approve-analysis/route.ts' 'src/app/api/generate/[runId]/approve-analysis/route.test.ts' 'src/app/api/generate/[runId]/generate-images/route.ts' 'src/app/api/generate/[runId]/generate-images/route.test.ts' 'src/app/api/episodes/[episodeId]/retry/route.ts' 'src/app/api/episodes/[episodeId]/retry/route.test.ts' 'src/app/api/characters/[characterId]/generate-sheet/route.ts' 'src/app/api/characters/[characterId]/generate-sheet/route.test.ts'
git commit -m "refactor: remove billing gates from routes"
```

---

### Task 5: Remove Billing And Usage From Pipeline

**Files:**

- Modify: `src/lib/pipeline/orchestrator.ts`
- Modify: `src/lib/pipeline/panel-image-executor.ts`
- Modify: `src/lib/pipeline/character-sheet-step.ts`
- Modify: `src/lib/pipeline/image-gen.ts`
- Modify: `src/lib/ai/llm.ts`
- Modify: `src/lib/ai/character-design.ts`
- Modify: `src/lib/__tests__/orchestrator-analyze-step.test.ts`
- Modify: `src/lib/__tests__/orchestrator-image-step.test.ts`
- Modify: `src/lib/__tests__/panel-image-executor.test.ts`
- Modify: `src/lib/__tests__/character-sheet-step.test.ts`
- Modify: `src/lib/__tests__/image-gen-flow.test.ts`
- Modify: `src/lib/__tests__/image-gen.test.ts`
- Modify: `src/lib/ai/llm.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "runAnalyzeStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runStoryboardStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runImageGenStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "executePanelImageGeneration", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runCharacterSheetStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "generatePanelImage", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "callLLMWaveSpeed", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: several HIGH/CRITICAL risks. Report them before editing.

- [ ] **Step 2: Update pipeline tests first**

Replace billing mock assertions with negative import-free behavior.

In `src/lib/__tests__/orchestrator-analyze-step.test.ts`, remove `vi.mock('@/lib/billing', ...)`. Replace assertions:

```ts
expect(mocks.checkCredits).toHaveBeenCalledTimes(1)
expect(mocks.deductCredits).toHaveBeenCalledTimes(1)
```

with:

```ts
expect(mocks.analyzeCharactersAndLocations).toHaveBeenCalled()
expect(mocks.recordPipelineEvent).toHaveBeenCalledWith(expect.objectContaining({
    step: 'analyze',
    status: 'completed',
}))
```

In `src/lib/__tests__/orchestrator-image-step.test.ts`, remove billing mocks and refund assertions. Keep assertions that panels are processed and episode state updates.

In `src/lib/__tests__/panel-image-executor.test.ts`, remove billing mocks. Add:

```ts
it('generates a panel image without billing calls', async () => {
    mocks.generatePanelImage.mockResolvedValue({
        imageUrl: '/generated/panel-1.png',
        storageKey: 'panel-1.png',
    })

    const result = await executePanelImageGeneration(baseInput())

    expect(result).toBe('done')
    expect(mocks.prisma.panel.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            imageUrl: '/generated/panel-1.png',
            storageKey: 'panel-1.png',
            status: 'done',
        }),
    }))
})
```

In `src/lib/__tests__/character-sheet-step.test.ts`, remove billing mocks and assert failed generation records a failed event without refund.

- [ ] **Step 3: Remove billing from orchestrator**

In `src/lib/pipeline/orchestrator.ts`, delete billing import:

```ts
import {
    ACTION_CREDIT_COSTS,
    checkCredits,
    deductCredits,
    InsufficientCreditsError,
    getImageGenerationCreditCost,
    normalizeImageModelTier,
} from '@/lib/billing'
```

Delete credit preflight/deduction blocks from `runAnalyzeStep` and `runStoryboardStep`.

In `runImageGenStep`, delete:

```ts
const imageModelTier = normalizeImageModelTier(episode.project.imageModel)
const imageCreditCost = getImageGenerationCreditCost(imageModelTier)
```

Delete total and per-panel credit checks. Call `executePanelImageGeneration` without `imageModelTier`:

```ts
const result = await executePanelImageGeneration({
    panel,
    dbCharacters,
    providerConfig,
    artStyle,
    userId,
    episodeId,
})
```

In `setEpisodeError`, change message selection to:

```ts
const message = err instanceof Error
    ? err.message
    : 'Unknown pipeline error'
```

- [ ] **Step 4: Remove billing from panel executor**

In `src/lib/pipeline/panel-image-executor.ts`, remove billing import and `ImageModelTier` type import.

Change input interface:

```ts
interface ExecutePanelImageGenerationInput {
    panel: PanelRecord
    dbCharacters: PanelCharacter[]
    providerConfig: ProviderConfig
    artStyle: string
    userId: string
    episodeId: string
}
```

Delete `imageCreditCost`, `imageCreditReason`, `imageOperationKey`, `refundOperationKey`, and the `deductCredits` try/catch block.

Pipeline event metadata should remove `imageModelTier`. Event calls should not pass `creditOperationKey`.

Failure handlers should update panel status and record events without refunds.

- [ ] **Step 5: Remove billing from character sheet step**

In `src/lib/pipeline/character-sheet-step.ts`, remove billing import.

Delete operation key and charged/refund logic. Keep event step name.

Started event metadata:

```ts
metadata: {
    attempt,
    characterId: character.id,
    characterName: character.name,
},
```

Completed event should not pass `creditOperationKey`.

Failed event should not refund.

- [ ] **Step 6: Remove usage logging and render tier from image generation**

In `src/lib/pipeline/image-gen.ts`, remove:

```ts
import type { ImageModelTier } from '@/lib/credit-catalog'
import { logUsage } from '@/lib/usage'
```

Remove `imageModelTier?: ImageModelTier` from `PanelImageInput`.

Delete `WAVESPEED_STANDARD_IMAGE_MODEL` if no longer used.

Replace `resolveWaveSpeedImageStrategy` with:

```ts
function resolveWaveSpeedImageStrategy(input: PanelImageInput): {
    model: string
    referenceImages?: string[]
} {
    return {
        model: input.providerConfig.imageModel,
        referenceImages: input.referenceImages,
    }
}
```

Delete the `logUsage` block after successful image generation.

- [ ] **Step 7: Remove usage logging from LLM**

In `src/lib/ai/llm.ts`, remove:

```ts
import { logUsage } from '@/lib/usage'
```

Delete the `if (config.userId) { logUsage(...) }` block after text polling.

- [ ] **Step 8: Update character design**

In `src/lib/ai/character-design.ts`, remove any `imageModelTier: 'standard'` property passed into `generatePanelImage`.

The call should pass provider config and identity inputs only:

```ts
await generatePanelImage({
    panelId: characterId,
    description,
    characters: [],
    shotType: 'portrait',
    location: '',
    artStyle,
    providerConfig,
    userId,
    episodeId,
})
```

Keep any existing required fields the function still expects.

- [ ] **Step 9: Run pipeline tests**

Run:

```bash
npm test -- src/lib/__tests__/orchestrator-analyze-step.test.ts src/lib/__tests__/orchestrator-image-step.test.ts src/lib/__tests__/panel-image-executor.test.ts src/lib/__tests__/character-sheet-step.test.ts src/lib/__tests__/image-gen-flow.test.ts src/lib/__tests__/image-gen.test.ts src/lib/ai/llm.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit pipeline cleanup**

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/pipeline/panel-image-executor.ts src/lib/pipeline/character-sheet-step.ts src/lib/pipeline/image-gen.ts src/lib/ai/llm.ts src/lib/ai/character-design.ts src/lib/__tests__/orchestrator-analyze-step.test.ts src/lib/__tests__/orchestrator-image-step.test.ts src/lib/__tests__/panel-image-executor.test.ts src/lib/__tests__/character-sheet-step.test.ts src/lib/__tests__/image-gen-flow.test.ts src/lib/__tests__/image-gen.test.ts src/lib/ai/llm.test.ts
git commit -m "refactor: remove billing from generation pipeline"
```

---

### Task 6: Delete Billing And Usage Modules And Routes

**Files:**

- Delete: `src/lib/billing.ts`
- Delete: `src/lib/credit-catalog.ts`
- Delete: `src/lib/usage.ts`
- Delete: `src/lib/__tests__/billing.test.ts`
- Delete: `src/lib/__tests__/usage.test.ts`
- Delete: `src/app/api/user/credits/route.ts`
- Delete: `src/app/api/user/credits/route.test.ts`
- Delete: `src/app/api/user/credits/dev-topup/route.ts`
- Delete: `src/app/api/user/credits/dev-topup/route.test.ts`
- Delete: `src/app/api/user/usage/route.ts`
- Delete: `src/app/api/user/usage/route.test.ts`
- Delete: `src/app/api/user/usage/summary/route.ts`
- Delete: `src/app/api/user/usage/summary/route.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Confirm no runtime callers remain**

Run:

```bash
rg -n "@/lib/billing|@/lib/credit-catalog|@/lib/usage|checkCredits|deductCredits|refundCredits|grantCredits|logUsage" src
```

Expected before deletion: only files planned for deletion, or no matches.

- [ ] **Step 2: Delete files**

Use `apply_patch` delete hunks for each file:

```text
*** Delete File: src/lib/billing.ts
*** Delete File: src/lib/credit-catalog.ts
*** Delete File: src/lib/usage.ts
*** Delete File: src/lib/__tests__/billing.test.ts
*** Delete File: src/lib/__tests__/usage.test.ts
*** Delete File: src/app/api/user/credits/route.ts
*** Delete File: src/app/api/user/credits/route.test.ts
*** Delete File: src/app/api/user/credits/dev-topup/route.ts
*** Delete File: src/app/api/user/credits/dev-topup/route.test.ts
*** Delete File: src/app/api/user/usage/route.ts
*** Delete File: src/app/api/user/usage/route.test.ts
*** Delete File: src/app/api/user/usage/summary/route.ts
*** Delete File: src/app/api/user/usage/summary/route.test.ts
```

- [ ] **Step 3: Update critical test script**

In `package.json`, change `test:critical` from:

```json
"test:critical": "vitest run src/lib/__tests__ src/app/api/generate/route.test.ts src/app/api/user/credits/route.test.ts src/components/GenerateForm.test.tsx src/hooks/useLocalUser.test.tsx"
```

to:

```json
"test:critical": "vitest run src/lib/__tests__ src/app/api/generate/route.test.ts src/components/GenerateForm.test.tsx src/hooks/useLocalUser.test.tsx"
```

- [ ] **Step 4: Run deletion verification**

Run:

```bash
rg -n "@/lib/billing|@/lib/credit-catalog|@/lib/usage|checkCredits|deductCredits|refundCredits|grantCredits|logUsage" src
npm test -- src/app/api/generate/route.test.ts src/components/GenerateForm.test.tsx src/hooks/useLocalUser.test.tsx
```

Expected: `rg` returns no matches; tests PASS.

- [ ] **Step 5: Commit module and route deletion**

```bash
git add package.json src/lib/billing.ts src/lib/credit-catalog.ts src/lib/usage.ts src/lib/__tests__/billing.test.ts src/lib/__tests__/usage.test.ts src/app/api/user/credits/route.ts src/app/api/user/credits/route.test.ts src/app/api/user/credits/dev-topup/route.ts src/app/api/user/credits/dev-topup/route.test.ts src/app/api/user/usage/route.ts src/app/api/user/usage/route.test.ts src/app/api/user/usage/summary/route.ts src/app/api/user/usage/summary/route.test.ts
git commit -m "refactor: delete billing and usage routes"
```

---

### Task 7: Remove Pricing And Credit UI

**Files:**

- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/components/dashboard/DashboardSections.tsx`
- Modify: `src/components/public/public-content.ts`
- Modify: `src/components/public/PublicSections.tsx`
- Modify: `src/components/public/LandingPageClient.tsx`
- Modify: `src/components/ui/NeoNavbar.tsx`
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/app/(public)/page.test.ts`
- Delete: `src/app/(public)/pricing/page.tsx`
- Delete: `src/app/(app)/dashboard/pricing/page.tsx`
- Delete: `src/app/(app)/payment/status/page.tsx`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "Sidebar", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "SettingsPage", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "PricingSection", direction: "upstream", includeTests: true, maxDepth: 2 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "NeoNavbar", direction: "upstream", includeTests: true, maxDepth: 2 })
```

- [ ] **Step 2: Clean Sidebar**

In `src/components/layout/Sidebar.tsx`, remove pricing nav item:

```ts
{ href: '/dashboard/pricing', icon: 'wallet', label: 'Pricing' },
```

Remove:

```ts
const creditBalance = (user?.credits ?? 0).toLocaleString()
```

Replace credit text under app title with:

```tsx
<p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">
    Local workspace
</p>
```

Replace account tag with:

```tsx
<NeoTag tone="lime" className="mt-1">
    Local workspace
</NeoTag>
```

- [ ] **Step 3: Rewrite Settings to one provider tab**

In `src/app/(app)/settings/page.tsx`, remove all credit package imports, credit state, credit fetch, top-up handler, tab state, credit UI, plan status card, and ledger.

Keep the existing API-key functions and provider card. Header copy should become:

```tsx
<p className="mt-4 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-black/55">
    Configure the local WaveSpeed provider key used by this workspace.
</p>
```

Main content should render only the provider/API key section and current key status. Keep `/api/user/api-key` behavior unchanged for Phase 4.

- [ ] **Step 4: Remove public pricing data**

In `src/components/public/public-content.ts`, replace:

```ts
'PAYMENT-READY UI'
'CREDIT-AWARE GENERATION'
```

with:

```ts
'LOCAL WAVE_SPEED KEY'
'SINGLE RENDER MODE'
```

Remove `PACKAGES` and `COST_ITEMS` exports.

Replace credit feature row:

```ts
{
    title: 'Local generation',
    copy: 'Generation runs from your local app with your own WaveSpeed API key.',
    tone: 'yellow' as const,
}
```

Replace spend control spec:

```ts
{
    label: 'Cost source',
    value: 'WaveSpeed account',
    copy: 'PanelMint does not sell credits. API usage is billed by WaveSpeed directly.',
}
```

- [ ] **Step 5: Remove PricingSection**

In `src/components/public/PublicSections.tsx`, remove imports of `COST_ITEMS` and `PACKAGES`. Delete the entire `PricingSection` export.

Replace credit copy inside `FeatureSection` with local cost copy:

```tsx
The public surface should feel like a print room checklist: inspect the structure, lock the storyboard, then render locally with your own WaveSpeed key.
```

Replace `Credit honesty` card title/copy with:

```ts
['Local cost clarity', 'PanelMint does not sell credits; generation uses your WaveSpeed account directly.']
```

- [ ] **Step 6: Update landing client and navbar**

In `src/components/public/LandingPageClient.tsx`, remove pricing imports/render and any link to `#pricing`. If the landing currently renders sections in order, use:

```tsx
<FeatureSection />
<SignalStrip />
<EngineSpecsSection />
<CtaSection />
```

In `src/components/ui/NeoNavbar.tsx`:

```ts
const DEFAULT_NAV_ITEMS = [
    { href: '/', label: 'Home' },
    { href: '/legal', label: 'Legal' },
]

const LANDING_SECTION_IDS = ['features', 'cta']

const LANDING_NAV_ITEMS = [
    { href: '#features', label: 'Features', sectionId: 'features' },
    { href: '/legal', label: 'Legal' },
] as const
```

- [ ] **Step 7: Update public layout footer**

In `src/app/(public)/layout.tsx`, remove:

```tsx
<Link href="/pricing">Pricing</Link>
```

- [ ] **Step 8: Delete pricing/payment pages**

Use `apply_patch` delete hunks for:

```text
*** Delete File: src/app/(public)/pricing/page.tsx
*** Delete File: src/app/(app)/dashboard/pricing/page.tsx
*** Delete File: src/app/(app)/payment/status/page.tsx
```

- [ ] **Step 9: Update public page tests**

In `src/app/(public)/page.test.ts`, remove pricing assertions. Add:

```ts
expect(screen.queryByText(/pricing/i)).not.toBeInTheDocument()
expect(screen.queryByText(/credits/i)).not.toBeInTheDocument()
expect(screen.getByText(/WaveSpeed account/i)).toBeInTheDocument()
```

- [ ] **Step 10: Run UI tests**

Run:

```bash
npm test -- src/app/(public)/page.test.ts src/components/GenerateForm.test.tsx src/hooks/useLocalUser.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit UI cleanup**

```bash
git add src/components/layout/Sidebar.tsx 'src/app/(app)/settings/page.tsx' src/components/dashboard/DashboardSections.tsx src/components/public/public-content.ts src/components/public/PublicSections.tsx src/components/public/LandingPageClient.tsx src/components/ui/NeoNavbar.tsx 'src/app/(public)/layout.tsx' 'src/app/(public)/page.test.ts' 'src/app/(public)/pricing/page.tsx' 'src/app/(app)/dashboard/pricing/page.tsx' 'src/app/(app)/payment/status/page.tsx'
git commit -m "refactor: remove pricing and credit UI"
```

---

### Task 8: Final Sweep And Verification

**Files:**

- Modify any remaining files found by grep that contain active billing, credit, usage, pricing, payment, Premium, or render-tier code.
- Modify tests that still mock deleted Prisma models.

- [ ] **Step 1: Run broad residual search**

Run:

```bash
rg -n "checkCredits|deductCredits|refundCredits|grantCredits|InsufficientCredits|creditTransaction|usageRecord|CreditTransaction|UsageRecord|credits|billing|pricing|payment|checkout|premium|imageModelTier|accountTier|lifetimePurchasedCredits|Project\\.imageModel|imageModel:" src prisma package.json
```

Expected: no active runtime/test/schema matches. If matches remain in active files, remove them. Matches inside ignored docs are not part of this command.

- [ ] **Step 2: Search route files**

Run:

```bash
rg --files src/app | rg "pricing|payment|credits|usage"
```

Expected: no files returned for deleted credit/pricing/payment/usage routes.

- [ ] **Step 3: Regenerate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: PASS.

- [ ] **Step 4: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Run GitNexus change detection**

Run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "all" })
```

Expected: affected scope includes local user shape, create/generate routes, pipeline image/character generation, public/settings UI, and Prisma schema. No unrelated modules should appear.

- [ ] **Step 7: Commit final cleanup**

If Step 1 found and fixed residuals, commit them:

```bash
git add .
git commit -m "chore: finish phase 3 billing removal"
```

If there were no residual file changes after previous commits, skip this commit.

---

## Completion Checklist

- [ ] `User` no longer has credit/tier/purchased fields.
- [ ] `CreditTransaction` and `UsageRecord` no longer exist.
- [ ] `Project.imageModel` no longer exists.
- [ ] `PipelineEvent.creditOperationKey` no longer exists.
- [ ] `src/lib/billing.ts`, `src/lib/credit-catalog.ts`, and `src/lib/usage.ts` are deleted.
- [ ] Generate, retry, analysis, storyboard, image generation, and character sheet flows do not call billing helpers.
- [ ] LLM and image generation do not call `logUsage`.
- [ ] Create form has no credit balance, cost estimate, top-up link, or Premium selector.
- [ ] Settings has no credit tab, packs, top-up, ledger, or plan status.
- [ ] Public/app pricing and payment routes are deleted.
- [ ] There is one render mode.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] GitNexus change detection matches Phase 3 scope.
