# PanelMint OSS Phase 2 Auth Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Clerk and auth as a runtime, API, dependency, and UX concept while preserving a transitional single local owner record for data consistency.

**Architecture:** Introduce a local owner module that creates or resolves one deterministic local owner row and exposes ownership lookup helpers. Replace auth-shaped server and client entrypoints with local workspace naming, then delete Clerk providers, middleware, routes, pages, tests, environment keys, and dependency entries. Keep `User`/`userId` as transitional ownership schema terms until later phases collapse billing, provider keys, queue, storage, and pipeline contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/Postgres, Vitest, npm, GitNexus.

---

## Current Baseline

- `src/lib/api-auth.ts` imports Clerk server helpers and exports `requireAuth`, `requirePageSession`, and ownership helpers.
- `src/lib/auth.ts` mixes Clerk sync helpers, auth types, user API key helpers, and preferences.
- `src/hooks/useAuth.tsx` imports Clerk client hooks and fetches `/api/auth/me`.
- `src/app/layout.tsx` wraps children in `ClerkProvider`.
- `src/proxy.ts` uses Clerk middleware for protected routes.
- Auth routes and pages exist under `src/app/auth/**`, `src/app/api/auth/**`, and `src/app/api/webhooks/clerk/route.ts`.
- `@clerk/nextjs` is present in `package.json` and `package-lock.json`.
- The worktree may contain unrelated user changes. Do not stage or modify unrelated files.

## File Map

**Create**

- `src/lib/local-user.ts` - local owner resolver, API key helpers, preferences helpers, and ownership lookup helpers.
- `src/lib/__tests__/local-user.test.ts` - resolver and ownership helper tests.
- `src/hooks/useLocalUser.tsx` - client workspace/local owner context.
- `src/hooks/useLocalUser.test.tsx` - client hydration and refresh tests.
- `src/app/api/local-user/route.ts` - local owner endpoint replacing `/api/auth/me`.
- `src/app/api/local-user/route.test.ts` - endpoint test.
- Missing route tests:
  - `src/app/api/episodes/route.test.ts`
  - `src/app/api/user/usage/summary/route.test.ts`
  - `src/app/api/generate/[runId]/result/route.test.ts`
  - `src/app/api/generate/[runId]/cancel/route.test.ts`
  - `src/app/api/editor/[episodeId]/save-bubbles/route.test.ts`
  - `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`

**Modify**

- `package.json`
- `package-lock.json`
- `.env.example`
- `README.md`
- `src/app/layout.tsx`
- `src/app/(app)/create/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(immersive)/editor/[episodeId]/page.tsx`
- `src/app/(immersive)/editor/[episodeId]/page.test.ts`
- `src/app/(public)/layout.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/page.test.ts`
- `src/app/api/health/route.ts`
- `src/app/api/health/route.test.ts`
- all direct route callers listed in Task 4
- existing route tests listed in Task 4
- `src/components/layout/Providers.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/public/LandingPageClient.tsx`
- `src/components/public/PublicSections.tsx`
- `src/components/ui/NeoNavbar.tsx`
- `src/lib/env-validation.ts`
- `src/lib/api-config.ts` only if comments still describe user BYOK as account/auth behavior

**Delete**

- `src/lib/api-auth.ts`
- `src/lib/auth.ts`
- `src/lib/clerk-errors.ts`
- `src/lib/__tests__/api-auth.test.ts`
- `src/lib/__tests__/auth.test.ts`
- `src/hooks/useAuth.tsx`
- `src/hooks/useAuth.test.tsx`
- `src/proxy.ts`
- `src/proxy.test.ts`
- `src/app/auth/**`
- `src/app/api/auth/**`
- `src/app/api/webhooks/clerk/route.ts`
- auth API tests under `src/app/api/auth/**`

## GitNexus Impact Gate

Known pre-plan impact from the spec:

- `requireAuth`: HIGH risk, 20 direct callers, 33 impacted symbols including tests.
- `requirePageSession`: LOW risk, one direct caller.

Before editing each existing function/class/module, run GitNexus impact for the symbol being changed. If impact is HIGH or CRITICAL, report the blast radius before editing. At minimum, run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "requireAuth", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "requirePageSession", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "useAuth", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "AuthProvider", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Before every commit, run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "staged" })
```

## Task 1: Add Local Owner Core

**Files:**

- Create: `src/lib/local-user.ts`
- Create: `src/lib/__tests__/local-user.test.ts`
- Later delete: `src/lib/api-auth.ts`, `src/lib/auth.ts`, `src/lib/__tests__/api-auth.test.ts`, `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Run required impact checks**

Run the GitNexus impact calls from the GitNexus Impact Gate for `requireAuth` and `requirePageSession`.

Expected: `requireAuth` reports HIGH risk. Report that the direct route caller conversion is handled in Tasks 4 and 5 before editing.

- [ ] **Step 2: Write failing tests for local owner creation and lookup**

Create `src/lib/__tests__/local-user.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => {
    const prisma = {
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            findFirst: vi.fn(),
        },
        creditTransaction: {
            create: vi.fn(),
        },
        episode: {
            findFirst: vi.fn(),
        },
        project: {
            findFirst: vi.fn(),
        },
        character: {
            findFirst: vi.fn(),
        },
    }

    prisma.$transaction.mockImplementation(async (input: unknown) => {
        if (typeof input === 'function') {
            return input(prisma)
        }
        return Promise.all(input as Promise<unknown>[])
    })

    return { prismaMock: prisma }
})

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}))

vi.mock('@/lib/billing', () => ({
    FREE_SIGNUP_CREDITS: 300,
}))

import {
    getLocalCharacter,
    getLocalEpisode,
    getLocalProject,
    getOrCreateLocalUser,
    LOCAL_USER_EMAIL,
} from '@/lib/local-user'

describe('getOrCreateLocalUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(prismaMock)
            }
            return Promise.all(input as Promise<unknown>[])
        })
    })

    it('returns the deterministic local owner when it already exists', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toEqual({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('reuses the only existing user to preserve local projects', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: 'existing-user-1',
                email: 'old@example.com',
                name: 'Existing Creator',
                credits: 120,
                accountTier: 'paid',
            },
        ])

        await expect(getOrCreateLocalUser()).resolves.toMatchObject({
            id: 'existing-user-1',
            email: 'old@example.com',
        })

        expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('creates a deterministic local owner when no reusable owner exists', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findMany.mockResolvedValue([])
        prismaMock.user.create.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toMatchObject({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            credits: 300,
        })

        expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                email: LOCAL_USER_EMAIL,
                name: 'Local Creator',
                authUserId: null,
                credits: 300,
                accountTier: 'free',
            }),
        }))
        expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'local-user-1',
                amount: 300,
                reason: 'starter_bonus',
                balance: 300,
            }),
        })
    })
})

describe('local ownership helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404-style errors for missing local episode ownership', async () => {
        prismaMock.episode.findFirst.mockResolvedValue(null)

        const result = await getLocalEpisode('user-1', 'episode-404')

        expect(result.episode).toBeNull()
        expect(result.error?.status).toBe(404)
    })

    it('returns owned records for episode, project, and character lookups', async () => {
        prismaMock.episode.findFirst.mockResolvedValue({ id: 'ep-1', projectId: 'project-1', status: 'queued' })
        prismaMock.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-1' })
        prismaMock.character.findFirst.mockResolvedValue({ id: 'char-1', projectId: 'project-1' })

        await expect(getLocalEpisode('user-1', 'ep-1')).resolves.toMatchObject({
            episode: { id: 'ep-1' },
            error: null,
        })
        await expect(getLocalProject('user-1', 'project-1')).resolves.toMatchObject({
            project: { id: 'project-1' },
            error: null,
        })
        await expect(getLocalCharacter('user-1', 'char-1')).resolves.toMatchObject({
            character: { id: 'char-1' },
            error: null,
        })
    })
})
```

- [ ] **Step 3: Run the failing test**

Run:

```bash
npm test -- src/lib/__tests__/local-user.test.ts
```

Expected: FAIL because `@/lib/local-user` does not exist.

- [ ] **Step 4: Implement the local owner module**

Create `src/lib/local-user.ts`:

```ts
import { NextResponse } from 'next/server'
import { FREE_SIGNUP_CREDITS } from './billing'
import { decrypt, encrypt, isEncrypted } from './crypto'
import { prisma } from './prisma'

export const LOCAL_USER_EMAIL = 'local@panelmint.dev'
export const LOCAL_USER_NAME = 'Local Creator'

const LOCAL_USER_PASSWORD_PLACEHOLDER = '__local_owner__'

const localUserSelect = {
    id: true,
    email: true,
    name: true,
    credits: true,
    accountTier: true,
}

export interface LocalUser {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}

function mapLocalUser(user: LocalUser): LocalUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        accountTier: user.accountTier,
    }
}

function notFoundError() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function getOrCreateLocalUser(): Promise<LocalUser> {
    return prisma.$transaction(async (tx) => {
        const localUser = await tx.user.findUnique({
            where: { email: LOCAL_USER_EMAIL },
            select: localUserSelect,
        })

        if (localUser) {
            return mapLocalUser(localUser)
        }

        const existingUsers = await tx.user.findMany({
            take: 2,
            orderBy: { createdAt: 'asc' },
            select: localUserSelect,
        })

        if (existingUsers.length === 1) {
            return mapLocalUser(existingUsers[0])
        }

        const created = await tx.user.create({
            data: {
                email: LOCAL_USER_EMAIL,
                name: LOCAL_USER_NAME,
                authUserId: null,
                passwordHash: LOCAL_USER_PASSWORD_PLACEHOLDER,
                credits: FREE_SIGNUP_CREDITS,
                accountTier: 'free',
                lifetimePurchasedCredits: 0,
            },
            select: localUserSelect,
        })

        await tx.creditTransaction.create({
            data: {
                userId: created.id,
                amount: FREE_SIGNUP_CREDITS,
                reason: 'starter_bonus',
                balance: created.credits,
                operationKey: `starter_bonus:local:${created.id}`,
            },
        })

        return mapLocalUser(created)
    })
}

export async function getLocalEpisode(localUserId: string, episodeId: string) {
    const episode = await prisma.episode.findFirst({
        where: {
            id: episodeId,
            project: { userId: localUserId },
        },
        select: {
            id: true,
            projectId: true,
            status: true,
        },
    })

    if (!episode) {
        return { episode: null, error: notFoundError() }
    }

    return { episode, error: null }
}

export async function getLocalProject(localUserId: string, projectId: string) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: localUserId,
        },
        select: { id: true, userId: true },
    })

    if (!project) {
        return { project: null, error: notFoundError() }
    }

    return { project, error: null }
}

export async function getLocalCharacter(localUserId: string, characterId: string) {
    const character = await prisma.character.findFirst({
        where: {
            id: characterId,
            project: { userId: localUserId },
        },
        select: {
            id: true,
            projectId: true,
        },
    })

    if (!character) {
        return { character: null, error: notFoundError() }
    }

    return { character, error: null }
}

export async function getLocalUserApiKey(localUserId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: localUserId },
        select: { apiKey: true },
    })
    const raw = user?.apiKey ?? null
    if (!raw) return null

    if (!isEncrypted(raw)) return raw

    try {
        return decrypt(raw)
    } catch (err) {
        console.error('[LocalUser] Failed to decrypt API key - possible key corruption or wrong ENCRYPTION_SECRET', err)
        return null
    }
}

export async function setLocalUserApiKey(localUserId: string, apiKey: string | null, provider?: string) {
    await prisma.user.update({
        where: { id: localUserId },
        data: {
            apiKey: apiKey ? encrypt(apiKey) : null,
            apiProvider: provider ?? null,
        },
    })
}

export async function getLocalUserPreferences(localUserId: string) {
    const user = await prisma.user.findUnique({
        where: { id: localUserId },
        select: { preferences: true },
    })
    if (!user?.preferences) return null
    try {
        return JSON.parse(user.preferences) as Record<string, unknown>
    } catch {
        return null
    }
}

export async function setLocalUserPreferences(localUserId: string, preferences: Record<string, unknown>) {
    await prisma.user.update({
        where: { id: localUserId },
        data: { preferences: JSON.stringify(preferences) },
    })
}
```

- [ ] **Step 5: Run the local owner test**

Run:

```bash
npm test -- src/lib/__tests__/local-user.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit local owner core**

Run GitNexus staged detection before committing:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "staged" })
```

Then run:

```bash
git add src/lib/local-user.ts src/lib/__tests__/local-user.test.ts
git commit -m "feat: add local owner resolver"
```

Expected: commit only includes the two local owner files.

## Task 2: Replace Client Auth State With Local User State

**Files:**

- Create: `src/hooks/useLocalUser.tsx`
- Create: `src/hooks/useLocalUser.test.tsx`
- Create: `src/app/api/local-user/route.ts`
- Create: `src/app/api/local-user/route.test.ts`
- Modify: `src/components/layout/Providers.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(app)/create/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `package.json`
- Later delete: `src/hooks/useAuth.tsx`, `src/hooks/useAuth.test.tsx`

- [ ] **Step 1: Run required impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "useAuth", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "AuthProvider", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: direct callers include `Sidebar`, `AppShell`, `SettingsPage`, `CreatePage`, and the hook test.

- [ ] **Step 2: Write the local user endpoint test**

Create `src/app/api/local-user/route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

import { GET } from './route'

describe('GET /api/local-user', () => {
    it('returns the local owner without a session', async () => {
        mocks.getOrCreateLocalUser.mockResolvedValue({
            id: 'local-user-1',
            email: 'local@panelmint.dev',
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        const response = await GET(
            new NextRequest('http://localhost/api/local-user'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            },
        })
    })
})
```

- [ ] **Step 3: Create the local user endpoint**

Create `src/app/api/local-user/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { getOrCreateLocalUser } from '@/lib/local-user'

export const GET = apiHandler(async () => {
    const user = await getOrCreateLocalUser()
    return NextResponse.json({ user })
})
```

- [ ] **Step 4: Write the local user hook test**

Create `src/hooks/useLocalUser.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/test/render'
import { LocalUserProvider, useLocalUser } from '@/hooks/useLocalUser'

function wrapper({ children }: { children: ReactNode }) {
    return <LocalUserProvider>{children}</LocalUserProvider>
}

describe('useLocalUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('hydrates the local owner from /api/local-user', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            user: {
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))

        const { result } = renderHook(() => useLocalUser(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toEqual({
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            })
        })
    })

    it('keeps loading false and user null when hydration fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

        const { result } = renderHook(() => useLocalUser(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toBeNull()
        })
    })
})
```

- [ ] **Step 5: Create the local user hook**

Create `src/hooks/useLocalUser.tsx`:

```tsx
'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react'

interface LocalUser {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}

interface LocalUserContextType {
    user: LocalUser | null
    loading: boolean
    refresh: () => Promise<void>
}

const LocalUserContext = createContext<LocalUserContextType | null>(null)

export function LocalUserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<LocalUser | null>(null)
    const [loading, setLoading] = useState(true)
    const userRef = useRef<LocalUser | null>(null)

    useEffect(() => {
        userRef.current = user
    }, [user])

    const refresh = useCallback(async () => {
        const shouldBlockUi = !userRef.current
        if (shouldBlockUi) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/local-user', { cache: 'no-store' })
            if (!res.ok) {
                if (shouldBlockUi) setUser(null)
                return
            }

            const data = await res.json() as { user?: LocalUser | null }
            setUser(data.user ?? null)
        } catch {
            if (shouldBlockUi) setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return (
        <LocalUserContext.Provider value={{ user, loading, refresh }}>
            {children}
        </LocalUserContext.Provider>
    )
}

export function useLocalUser() {
    const ctx = useContext(LocalUserContext)
    if (!ctx) throw new Error('useLocalUser must be used within LocalUserProvider')
    return ctx
}
```

- [ ] **Step 6: Replace provider and component imports**

Modify `src/components/layout/Providers.tsx`:

```tsx
'use client'

import { LocalUserProvider } from '@/hooks/useLocalUser'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <LocalUserProvider>
            {children}
        </LocalUserProvider>
    )
}
```

Modify `src/components/layout/AppShell.tsx` import and hook call:

```tsx
import { useLocalUser } from '@/hooks/useLocalUser'
```

```tsx
const { loading, user } = useLocalUser()
```

Modify `src/components/layout/Sidebar.tsx` import and hook call:

```tsx
import { useLocalUser } from '@/hooks/useLocalUser'
```

```tsx
const { user } = useLocalUser()
```

Remove the signout button block from `src/components/layout/Sidebar.tsx`. Keep the local user display block, but change account copy to workspace copy:

```tsx
<NeoTag tone="lime" className="mt-1">
    {(user?.accountTier ?? 'free') === 'paid' ? 'Local paid tier' : 'Local workspace'}
</NeoTag>
```

Modify `src/app/(app)/create/page.tsx`:

```tsx
import { useLocalUser } from '@/hooks/useLocalUser'
```

```tsx
const { user } = useLocalUser()
```

Modify `src/app/(app)/settings/page.tsx`:

```tsx
import { useLocalUser } from '@/hooks/useLocalUser'
```

```tsx
const { user, refresh } = useLocalUser()
```

- [ ] **Step 7: Update the critical test script**

Modify `package.json`:

```json
"test:critical": "vitest run src/lib/__tests__ src/app/api/generate/route.test.ts src/app/api/user/credits/route.test.ts src/components/GenerateForm.test.tsx src/hooks/useLocalUser.test.tsx"
```

- [ ] **Step 8: Run client and endpoint tests**

Run:

```bash
npm test -- src/app/api/local-user/route.test.ts src/hooks/useLocalUser.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit local client state**

Run GitNexus staged detection, then:

```bash
git add package.json src/app/api/local-user src/hooks/useLocalUser.tsx src/hooks/useLocalUser.test.tsx src/components/layout/Providers.tsx src/components/layout/AppShell.tsx src/components/layout/Sidebar.tsx 'src/app/(app)/create/page.tsx' 'src/app/(app)/settings/page.tsx'
git commit -m "feat: replace auth hook with local user state"
```

Expected: commit contains the local endpoint, hook, provider, component updates, and script update.

## Task 3: Replace Page Session Usage

**Files:**

- Modify: `src/app/(immersive)/editor/[episodeId]/page.tsx`
- Modify: `src/app/(immersive)/editor/[episodeId]/page.test.ts`

- [ ] **Step 1: Write the failing editor page test update**

In `src/app/(immersive)/editor/[episodeId]/page.test.ts`, replace the auth mock with:

```ts
const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        episode: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))
```

In `beforeEach`, use:

```ts
mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
```

Update the first assertion:

```ts
expect(mocks.getOrCreateLocalUser).toHaveBeenCalled()
```

Rename the test:

```ts
it('queries the episode through the local owner boundary', async () => {
```

- [ ] **Step 2: Run the failing editor test**

Run:

```bash
npm test -- 'src/app/(immersive)/editor/[episodeId]/page.test.ts'
```

Expected: FAIL because `page.tsx` still imports `requirePageSession`.

- [ ] **Step 3: Replace editor page session resolver**

Modify `src/app/(immersive)/editor/[episodeId]/page.tsx`:

```ts
import { getOrCreateLocalUser } from '@/lib/local-user'
```

Replace:

```ts
const user = await requirePageSession(`/editor/${episodeId}`)
```

with:

```ts
const user = await getOrCreateLocalUser()
```

- [ ] **Step 4: Run the editor test**

Run:

```bash
npm test -- 'src/app/(immersive)/editor/[episodeId]/page.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit page session replacement**

Run GitNexus staged detection, then:

```bash
git add 'src/app/(immersive)/editor/[episodeId]/page.tsx' 'src/app/(immersive)/editor/[episodeId]/page.test.ts'
git commit -m "feat: use local owner for editor page"
```

Expected: commit contains only editor page and test changes.

## Task 4: Replace API Route Ownership Entrypoints

**Files:**

- Modify every direct route caller listed below.
- Create missing route tests listed below.
- Modify existing route tests to mock `@/lib/local-user`, not `@/lib/api-auth`.

- [ ] **Step 1: Run the required impact check**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "requireAuth", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: HIGH risk with the direct route callers below. Report this before edits.

- [ ] **Step 2: Apply the server route replacement table**

For each route, replace auth imports and local variables exactly as shown by the table:

| File | New local user code | Ownership helper |
| --- | --- | --- |
| `src/app/api/generate/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/characters/route.ts` | `const localUser = await getOrCreateLocalUser()` in `GET` and `POST` | `getLocalProject(localUser.id, projectId)` |
| `src/app/api/episodes/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/user/usage/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/user/credits/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/user/api-key/route.ts` | `const localUser = await getOrCreateLocalUser()` in `GET`, `POST`, `DELETE` | none |
| `src/app/api/characters/[characterId]/route.ts` | `const localUser = await getOrCreateLocalUser()` in `GET`, `PUT`, `DELETE` | `getLocalCharacter(localUser.id, characterId)` |
| `src/app/api/episodes/[episodeId]/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, episodeId)` |
| `src/app/api/user/usage/summary/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/user/credits/dev-topup/route.ts` | `const localUser = await getOrCreateLocalUser()` | none |
| `src/app/api/generate/[runId]/status/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/generate/[runId]/result/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/generate/[runId]/generate-images/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/generate/[runId]/approve-storyboard/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/generate/[runId]/approve-analysis/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/generate/[runId]/cancel/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, runId)` |
| `src/app/api/editor/[episodeId]/save-bubbles/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, episodeId)` |
| `src/app/api/characters/[characterId]/generate-sheet/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalCharacter(localUser.id, characterId)` |
| `src/app/api/episodes/[episodeId]/retry/route.ts` | `const localUser = await getOrCreateLocalUser()` | `getLocalEpisode(localUser.id, episodeId)` |

Use this import pattern:

```ts
import {
    getLocalCharacter,
    getLocalEpisode,
    getLocalProject,
    getOrCreateLocalUser,
} from '@/lib/local-user'
```

Only import the functions each file uses.

Replace this pattern:

```ts
const auth = await requireAuth()
if (auth.error) return auth.error
```

with:

```ts
const localUser = await getOrCreateLocalUser()
```

Replace every `auth.user.id` with `localUser.id`, and every `auth.user.accountTier` with `localUser.accountTier`.

Replace ownership calls:

```ts
const ownership = await requireEpisodeOwner(auth.user.id, runId)
const ownership = await requireProjectOwner(auth.user.id, projectId)
const ownership = await requireCharacterOwner(auth.user.id, characterId)
```

with:

```ts
const ownership = await getLocalEpisode(localUser.id, runId)
const ownership = await getLocalProject(localUser.id, projectId)
const ownership = await getLocalCharacter(localUser.id, characterId)
```

- [ ] **Step 3: Update API key route helper imports**

In `src/app/api/user/api-key/route.ts`, replace:

```ts
import { getUserApiKey, setUserApiKey } from '@/lib/auth'
import { requireAuth } from '@/lib/api-auth'
```

with:

```ts
import {
    getLocalUserApiKey,
    getOrCreateLocalUser,
    setLocalUserApiKey,
} from '@/lib/local-user'
```

Then replace:

```ts
const dbUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { apiKey: true, apiProvider: true },
})

const apiKey = await getUserApiKey(auth.user.id)
```

with:

```ts
const dbUser = await prisma.user.findUnique({
    where: { id: localUser.id },
    select: { apiKey: true, apiProvider: true },
})

const apiKey = await getLocalUserApiKey(localUser.id)
```

Replace `setUserApiKey(auth.user.id, ...)` with `setLocalUserApiKey(localUser.id, ...)`.

- [ ] **Step 4: Create missing route tests**

Create `src/app/api/episodes/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        episode: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET } from './route'

describe('GET /api/episodes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.episode.findMany.mockResolvedValue([])
    })

    it('lists episodes for the local owner', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/episodes'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.episode.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { project: { userId: 'user-1' } },
        }))
    })
})
```

Create `src/app/api/user/usage/summary/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        usageRecord: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET } from './route'

describe('GET /api/user/usage/summary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.usageRecord.findMany.mockResolvedValue([
            { type: 'llm_call', model: 'seed', tokens: 120, cost: 0.02 },
            { type: 'image_gen', model: 'flux', tokens: null, cost: 0.08 },
        ])
    })

    it('summarizes usage for the local owner', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/user/usage/summary'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.usageRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ userId: 'user-1' }),
        }))
        await expect(response.json()).resolves.toMatchObject({
            llmCalls: 1,
            imageGens: 1,
            totalTokens: 120,
            totalCost: 0.1,
        })
    })
})
```

Create `src/app/api/generate/[runId]/result/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET } from './route'

describe('GET /api/generate/[runId]/result', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({ episode: { id: 'ep-1' }, error: null })
        mocks.prisma.episode.findUnique.mockResolvedValue({ pages: [] })
    })

    it('returns result pages through the local owner boundary', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/generate/ep-1/result'),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
    })
})
```

Create `src/app/api/generate/[runId]/cancel/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    cancelEpisodePipelineJobs: vi.fn(),
    syncPipelineRunState: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        episode: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        panel: {
            updateMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/queue', () => ({
    cancelEpisodePipelineJobs: mocks.cancelEpisodePipelineJobs,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    syncPipelineRunState: mocks.syncPipelineRunState,
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/generate/[runId]/cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({ episode: { id: 'ep-1' }, error: null })
        mocks.cancelEpisodePipelineJobs.mockResolvedValue(2)
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'queued' })
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => input(mocks.prisma))
    })

    it('cancels an owned local episode', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/cancel', { method: 'POST' }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.syncPipelineRunState).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-1',
            runStatus: 'cancelled',
        }))
    })
})
```

Create `src/app/api/editor/[episodeId]/save-bubbles/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    prisma: {
        panel: {
            findFirst: vi.fn(),
        },
        speechBubble: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { POST } from './route'

describe('POST /api/editor/[episodeId]/save-bubbles', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({ episode: { id: 'ep-1' }, error: null })
        mocks.prisma.panel.findFirst.mockResolvedValue({ id: 'panel-1' })
    })

    it('saves bubbles for an episode owned by the local owner', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/editor/ep-1/save-bubbles', {
                method: 'POST',
                body: JSON.stringify({
                    panelId: 'panel-1',
                    bubbles: [{
                        bubbleIndex: 0,
                        speaker: null,
                        content: 'Hello',
                        bubbleType: 'speech',
                        positionX: 0.5,
                        positionY: 0.5,
                        width: 0.3,
                        height: 0.2,
                    }],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.speechBubble.createMany).toHaveBeenCalled()
    })
})
```

Create `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalCharacter: vi.fn(),
    getProviderConfig: vi.fn(),
    deductCredits: vi.fn(),
    refundCredits: vi.fn(),
    generateCharacterSheet: vi.fn(),
    prisma: {
        character: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalCharacter: mocks.getLocalCharacter,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterSheet: mocks.generateCharacterSheet,
}))

vi.mock('@/lib/billing', () => ({
    ACTION_CREDIT_COSTS: { standard_image: 40 },
    deductCredits: mocks.deductCredits,
    refundCredits: mocks.refundCredits,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { POST } from './route'

describe('POST /api/characters/[characterId]/generate-sheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalCharacter.mockResolvedValue({ character: { id: 'char-1' }, error: null })
        mocks.getProviderConfig.mockResolvedValue({ apiKey: 'ws-key', provider: 'wavespeed' })
        mocks.deductCredits.mockResolvedValue(true)
        mocks.generateCharacterSheet.mockResolvedValue({ imageUrl: '/image.png', storageKey: 'key' })
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'Hero',
            project: { artStyle: 'manga' },
        })
    })

    it('generates a sheet for a character owned by the local owner', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/characters/char-1/generate-sheet', { method: 'POST' }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalCharacter).toHaveBeenCalledWith('user-1', 'char-1')
        expect(mocks.generateCharacterSheet).toHaveBeenCalledWith(
            'char-1',
            'Hero',
            'manga',
            expect.anything(),
            'user-1',
        )
    })
})
```

- [ ] **Step 5: Update existing route tests to local-user mocks**

For existing route tests that currently mock `@/lib/api-auth`, replace the mock shape with `@/lib/local-user`.

Use this pattern for route tests that only need the local user:

```ts
const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    // existing mocks stay here
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

beforeEach(() => {
    mocks.getOrCreateLocalUser.mockResolvedValue({
        id: 'user-1',
        accountTier: 'free',
    })
})
```

Use this pattern for tests that also need episode/project/character ownership:

```ts
const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    getLocalProject: vi.fn(),
    getLocalCharacter: vi.fn(),
    // existing mocks stay here
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
    getLocalProject: mocks.getLocalProject,
    getLocalCharacter: mocks.getLocalCharacter,
}))
```

Update assertions:

```ts
expect(mocks.getLocalProject).toHaveBeenCalledWith('user-1', 'project-1')
expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
expect(mocks.getLocalCharacter).toHaveBeenCalledWith('user-1', 'char-1')
```

Delete any "returns 401 when no session" tests. Replace them with local owner tests, because Phase 2 has no signed-out state.

Existing tests to update:

- `src/app/api/generate/route.test.ts`
- `src/app/api/characters/route.test.ts`
- `src/app/api/characters/[characterId]/route.test.ts`
- `src/app/api/episodes/[episodeId]/route.test.ts`
- `src/app/api/generate/[runId]/status/route.test.ts`
- `src/app/api/generate/[runId]/generate-images/route.test.ts`
- `src/app/api/generate/[runId]/approve-storyboard/route.test.ts`
- `src/app/api/generate/[runId]/approve-analysis/route.test.ts`
- `src/app/api/user/credits/route.test.ts`
- `src/app/api/user/credits/dev-topup/route.test.ts`
- `src/app/api/user/usage/route.test.ts`
- `src/app/api/user/api-key/route.test.ts`
- `src/app/api/episodes/[episodeId]/progress/route.test.ts`
- `src/app/api/episodes/[episodeId]/retry/route.test.ts`

- [ ] **Step 6: Run the direct caller route test set**

Run:

```bash
npm test -- \
  src/app/api/generate/route.test.ts \
  src/app/api/characters/route.test.ts \
  'src/app/api/characters/[characterId]/route.test.ts' \
  src/app/api/episodes/route.test.ts \
  'src/app/api/episodes/[episodeId]/route.test.ts' \
  src/app/api/user/usage/route.test.ts \
  src/app/api/user/usage/summary/route.test.ts \
  src/app/api/user/credits/route.test.ts \
  src/app/api/user/credits/dev-topup/route.test.ts \
  src/app/api/user/api-key/route.test.ts \
  'src/app/api/generate/[runId]/status/route.test.ts' \
  'src/app/api/generate/[runId]/result/route.test.ts' \
  'src/app/api/generate/[runId]/generate-images/route.test.ts' \
  'src/app/api/generate/[runId]/approve-storyboard/route.test.ts' \
  'src/app/api/generate/[runId]/approve-analysis/route.test.ts' \
  'src/app/api/generate/[runId]/cancel/route.test.ts' \
  'src/app/api/editor/[episodeId]/save-bubbles/route.test.ts' \
  'src/app/api/characters/[characterId]/generate-sheet/route.test.ts' \
  'src/app/api/episodes/[episodeId]/retry/route.test.ts' \
  'src/app/api/episodes/[episodeId]/progress/route.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Commit API route conversion**

Run GitNexus staged detection, then:

```bash
git add src/app/api src/lib/local-user.ts src/lib/__tests__/local-user.test.ts
git commit -m "feat: resolve api routes through local owner"
```

Expected: commit includes direct route caller updates and route tests.

## Task 5: Remove Clerk Runtime Routes, Middleware, And Public Auth Links

**Files:**

- Modify: `src/app/layout.tsx`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/page.test.ts`
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/components/public/LandingPageClient.tsx`
- Modify: `src/components/public/PublicSections.tsx`
- Modify: `src/components/ui/NeoNavbar.tsx`
- Delete: `src/proxy.ts`
- Delete: `src/proxy.test.ts`
- Delete: `src/app/auth/**`
- Delete: `src/app/api/auth/**`
- Delete: `src/app/api/webhooks/clerk/route.ts`
- Delete: `src/lib/clerk-errors.ts`

- [ ] **Step 1: Run impact checks for layout and public page symbols**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "RootLayout", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "LandingPage", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: review any HIGH/CRITICAL result before editing.

- [ ] **Step 2: Remove ClerkProvider from root layout**

Modify `src/app/layout.tsx` by deleting:

```ts
import { ClerkProvider } from '@clerk/nextjs'
```

Replace the body content with plain children:

```tsx
<body className="antialiased bg-[var(--neo-bg-canvas)] text-[var(--neo-ink)] min-h-screen">
  {children}
</body>
```

- [ ] **Step 3: Remove public landing auth redirect**

Modify `src/app/(public)/page.tsx` to:

```tsx
import { LandingPageClient } from '@/components/public/LandingPageClient'

export default async function LandingPage() {
    return <LandingPageClient />
}
```

Modify `src/app/(public)/page.test.ts` to:

```ts
import { describe, expect, it } from 'vitest'
import LandingPage from './page'

describe('LandingPage', () => {
    it('renders the public landing page without auth checks', async () => {
        const page = await LandingPage()

        expect(page).toBeTruthy()
    })
})
```

- [ ] **Step 4: Replace public auth links with local app links**

Apply these replacements:

| File | Replace | With |
| --- | --- | --- |
| `src/app/(public)/layout.tsx` | `<Link href="/auth/signin">Sign in</Link>` | `<Link href="/dashboard">Open app</Link>` |
| `src/components/public/LandingPageClient.tsx` | `<Link href="/auth/signup">` | `<Link href="/create">` |
| `src/components/public/LandingPageClient.tsx` | `CLERK + NEXT 16` | `LOCAL OSS` |
| `src/components/ui/NeoNavbar.tsx` | `/auth/signin` link/button | remove the whole Sign In link |
| `src/components/ui/NeoNavbar.tsx` | `pathname === '/' ? '#cta' : '/auth/signup'` | `pathname === '/' ? '#cta' : '/create'` |
| `src/components/public/PublicSections.tsx` | `<Link href="/auth/signup">Create account</Link>` | `<Link href="/create">Open workspace</Link>` |
| `src/components/public/PublicSections.tsx` | `<Link href="/auth/signup">` | `<Link href="/create">` |

Also replace user-facing wording:

- `Create account` -> `Open workspace`
- `Start free` -> `Start locally`
- `Sign In` -> remove
- `Account` aria label in `NeoNavbar` -> `Workspace`

- [ ] **Step 5: Delete auth runtime files**

Run:

```bash
git rm -r src/app/auth src/app/api/auth src/app/api/webhooks/clerk
git rm src/lib/clerk-errors.ts src/proxy.ts src/proxy.test.ts
```

Expected: auth pages, auth API routes, Clerk webhook, Clerk error helper, and proxy are staged for deletion.

- [ ] **Step 6: Run public/UI tests**

Run:

```bash
npm test -- 'src/app/(public)/page.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Check no public auth links remain in runtime code**

Run:

```bash
! rg -n "/auth/|sign[- ]?in|sign[- ]?up|login|logout|Clerk|CLERK_" src/app src/components
```

Expected: command exits `0` with no matches.

- [ ] **Step 8: Commit Clerk route and UI removal**

Run GitNexus staged detection, then:

```bash
git add src/app src/components src/proxy.ts src/proxy.test.ts src/lib/clerk-errors.ts
git commit -m "feat: remove clerk routes and auth links"
```

Expected: commit removes runtime auth routes, middleware, public auth links, and Clerk provider usage.

## Task 6: Remove Auth Helper Files And Clerk-Specific Tests

**Files:**

- Delete: `src/lib/api-auth.ts`
- Delete: `src/lib/auth.ts`
- Delete: `src/lib/__tests__/api-auth.test.ts`
- Delete: `src/lib/__tests__/auth.test.ts`
- Delete: `src/hooks/useAuth.tsx`
- Delete: `src/hooks/useAuth.test.tsx`

- [ ] **Step 1: Verify no runtime imports remain**

Run:

```bash
! rg -n "@/lib/api-auth|@/lib/auth|@/hooks/useAuth|requireAuth|requirePageSession|SessionUser|ExternalAuthUser|AuthProvider|useAuth" src
```

Expected: command exits `0`. If it finds matches, return to Tasks 2 through 5 and replace them.

- [ ] **Step 2: Delete old auth helper files and tests**

Run:

```bash
git rm src/lib/api-auth.ts src/lib/auth.ts src/lib/__tests__/api-auth.test.ts src/lib/__tests__/auth.test.ts src/hooks/useAuth.tsx src/hooks/useAuth.test.tsx
```

Expected: old auth helper files and tests are staged for deletion.

- [ ] **Step 3: Run local user tests again**

Run:

```bash
npm test -- src/lib/__tests__/local-user.test.ts src/hooks/useLocalUser.test.tsx src/app/api/local-user/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit auth helper deletion**

Run GitNexus staged detection, then:

```bash
git add src/lib src/hooks src/app/api/local-user package.json
git commit -m "refactor: delete auth helper surface"
```

Expected: commit deletes auth helper files and keeps local-user replacements.

## Task 7: Update Environment, Health, Docs, And Dependency Graph

**Files:**

- Modify: `src/lib/env-validation.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update env validation tests first**

Modify `src/app/api/health/route.test.ts` mocks so `checks` no longer include Clerk keys and runtime auth is local/none:

```ts
checks: {
    DATABASE_URL: 'configured',
    ENCRYPTION_SECRET: 'configured',
    WAVESPEED_API_KEY: 'configured',
    INNGEST_EVENT_KEY: 'configured',
    INNGEST_SIGNING_KEY: 'configured',
    R2_ACCOUNT_ID: 'optional',
    R2_ACCESS_KEY_ID: 'optional',
    R2_SECRET_ACCESS_KEY: 'optional',
    R2_BUCKET_NAME: 'optional',
    R2_PUBLIC_URL: 'optional',
    ALLOWED_ORIGINS: 'configured',
},
```

Update the ready assertion:

```ts
await expect(response.json()).resolves.toMatchObject({
    status: 'ready',
    details: {
        missingRequiredEnv: [],
        notes: ['Local single-user runtime. Auth is disabled for OSS v1.'],
    },
    checks: {
        runtime: {
            queue: 'inngest',
            identity: 'local-single-user',
        },
    },
})
```

Update degraded env mocks to remove Clerk keys and use a missing key already in the report, such as `WAVESPEED_API_KEY`.

- [ ] **Step 2: Update env validation implementation**

Modify `src/lib/env-validation.ts`:

```ts
const CORE_REQUIRED = ['DATABASE_URL', 'ENCRYPTION_SECRET'] as const
const PROD_PLATFORM_REQUIRED = [
    'WAVESPEED_API_KEY',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
] as const
```

Delete these lines:

```ts
checks.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = hasValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') ? 'configured' : 'missing'
checks.CLERK_SECRET_KEY = hasValue('CLERK_SECRET_KEY') ? 'configured' : 'missing'
checks.CLERK_WEBHOOK_SIGNING_SECRET = hasValue('CLERK_WEBHOOK_SIGNING_SECRET') ? 'configured' : 'missing'
```

- [ ] **Step 3: Update health route implementation**

Modify `src/app/api/health/route.ts` runtime output:

```ts
runtime: {
    deployment: process.env.VERCEL ? 'vercel' : 'local',
    queue: 'inngest',
    identity: 'local-single-user',
},
```

Replace `notes` with:

```ts
notes: [
    'Local single-user runtime. Auth is disabled for OSS v1.',
],
```

- [ ] **Step 4: Remove Clerk variables from `.env.example`**

Delete the Clerk section:

```dotenv
# Clerk auth
# API Keys: Clerk Dashboard -> API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
# Webhooks: Clerk Dashboard -> Webhooks -> endpoint /api/webhooks/clerk
CLERK_WEBHOOK_SIGNING_SECRET=whsec_replace_me
```

Do not remove `ENCRYPTION_SECRET` in this phase because DB-stored provider keys are Phase 4.

- [ ] **Step 5: Remove Clerk setup requirements from README**

Edit `README.md` so it no longer presents Clerk as a required setup dependency. Remove rows for:

```md
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser key. |
| `CLERK_SECRET_KEY` | Yes | Clerk server key. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Yes | Verifies Clerk webhooks. |
```

Remove setup text that tells users to configure a Clerk webhook at `/api/webhooks/clerk`.

If the README still has a stack list, replace any current-runtime Clerk item with:

```md
- Single local workspace owner, with no login or hosted auth in OSS v1
```

- [ ] **Step 6: Remove Clerk package**

Run:

```bash
npm uninstall @clerk/nextjs
```

Expected: `package.json` and `package-lock.json` remove `@clerk/nextjs` and its transitive lockfile entries.

- [ ] **Step 7: Run health/env tests**

Run:

```bash
npm test -- src/app/api/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit env, docs, and dependency cleanup**

Run GitNexus staged detection, then:

```bash
git add src/lib/env-validation.ts src/app/api/health/route.ts src/app/api/health/route.test.ts .env.example README.md package.json package-lock.json
git commit -m "chore: remove clerk env and dependency"
```

Expected: commit contains no runtime route conversions; only environment, health, docs, and dependency cleanup.

## Task 8: Full Verification

**Files:**

- No planned file changes unless verification exposes a bug.

- [ ] **Step 1: Run targeted auth-removal grep**

Run:

```bash
! (rg --files src | rg "src/app/auth|src/app/api/auth|src/app/api/webhooks/clerk|src/lib/api-auth|src/hooks/useAuth|src/lib/clerk-errors")
! rg -n "@clerk/nextjs|ClerkProvider|clerkMiddleware|useClerk|useUser|verifyWebhook|CLERK_|requireAuth|requirePageSession|useAuth|AuthProvider|SessionUser|AuthResult|ExternalAuthUser|/api/auth|/auth/|sign[- ]?in|sign[- ]?up|signout|sign out|login|logout" src package.json .env.example
```

Expected: both commands exit `0` with no matches.

- [ ] **Step 2: Run docs sanity grep**

Run:

```bash
rg -n "Clerk|CLERK_|/api/webhooks/clerk|/auth/signin|/auth/signup|Sign in|Sign up" README.md .env.example docs/superpowers/specs/2026-05-05-panelmint-oss-phase-2-auth-removal-design.md
```

Expected: matches are allowed only in the Phase 2 spec as historical/current-behavior context. README and `.env.example` should not contain current Clerk setup instructions.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- \
  src/lib/__tests__/local-user.test.ts \
  src/hooks/useLocalUser.test.tsx \
  src/app/api/local-user/route.test.ts \
  'src/app/(immersive)/editor/[episodeId]/page.test.ts' \
  'src/app/(public)/page.test.ts' \
  src/app/api/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run direct caller route tests**

Run the full route command from Task 4 Step 6.

Expected: PASS.

- [ ] **Step 5: Run critical test script**

Run:

```bash
npm run test:critical
```

Expected: PASS.

- [ ] **Step 6: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Run final GitNexus change detection**

Run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "all" })
```

Expected: affected scope is auth removal, local owner resolution, route ownership calls, env/health, docs, and dependency cleanup. Investigate any unrelated changed symbol before finalizing.

- [ ] **Step 9: Handle verification failures through the owning task**

Do not create a catch-all verification commit. If Step 1 through Step 8 exposes a failure, return to the task that owns the affected file, apply the focused fix there, rerun that task's targeted verification, then rerun Task 8 from Step 1.

## Plan Self-Review

- Spec coverage: tasks cover Clerk dependency removal, root provider removal, middleware deletion, auth page/API/webhook deletion, local owner resolver, local endpoint, client hook renaming, direct route caller conversion, env/health cleanup, README cleanup, tests, grep verification, and GitNexus detection.
- Scope boundary: plan keeps `User`/`userId`, credits, provider DB key fields, Inngest, storage keys, usage records, and billing behavior in place.
- Placeholder scan: no step relies on TBD/TODO/fill-in language. Route conversion uses an explicit route table and replacement snippets.
- Type consistency: `LocalUser`, `getOrCreateLocalUser`, `getLocalEpisode`, `getLocalProject`, `getLocalCharacter`, `getLocalUserApiKey`, `setLocalUserApiKey`, `LocalUserProvider`, and `useLocalUser` names are consistent across tasks.
