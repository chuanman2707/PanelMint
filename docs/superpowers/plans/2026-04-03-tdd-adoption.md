# TDD Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a sustainable test-driven development workflow across this Next.js codebase without freezing product delivery, starting with `src/lib` and `src/app/api`, then expanding into `src/components` and `src/hooks`.

**Architecture:** Keep TDD closest to business logic first. Preserve the existing fast Vitest node lane for `src/lib` and API routes, add a DOM lane for React component and hook tests, and enforce a repo-level rule that every behavior change starts with a failing test. Roll out incrementally by folder so the team can keep shipping while hardening critical paths.

**Tech Stack:** Next.js 16, React 19, Vitest 4, TypeScript 5, Clerk, Prisma, Inngest, Testing Library, jsdom.

---

## Current Baseline

- `npm test` currently passes with `41` files and `168` tests.
- `vitest.config.ts` only includes `src/**/*.test.ts`, so `.test.tsx` files are not part of the suite yet.
- `src/lib` already has healthy coverage patterns in `src/lib/__tests__`.
- `src/app/api` has partial route tests, with strong examples in `src/app/api/generate/route.test.ts` and `src/app/api/user/credits/route.test.ts`.
- `src/components` and `src/hooks` currently have no test lane.

## File Map

**Infrastructure and standards**

- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `README.md`
- Create: `src/test/setup-dom.ts`
- Create: `src/test/render.tsx`
- Create: `docs/testing/tdd-standards.md`
- Create: `.github/pull_request_template.md`
- Create: `.github/workflows/test.yml`

**Backend TDD rollout**

- Create: `src/lib/__tests__/api-handler.test.ts`
- Create: `src/lib/__tests__/api-validate.test.ts`
- Create: `src/lib/__tests__/env-validation.test.ts`
- Create: `src/lib/progress/episode-progress-snapshot.test.ts`
- Create: `src/lib/episodes/delete-episode.ts`
- Create: `src/lib/__tests__/delete-episode.test.ts`
- Modify: `src/app/api/episodes/[episodeId]/route.ts`
- Create: `src/app/api/episodes/[episodeId]/route.test.ts`
- Create: `src/app/api/user/usage/route.test.ts`

**Frontend and hook TDD rollout**

- Create: `src/components/GenerateForm.test.tsx`
- Create: `src/components/ReviewAnalysis.test.tsx`
- Create: `src/components/ReviewStoryboard.test.tsx`
- Create: `src/hooks/useAuth.test.tsx`
- Create: `src/app/(app)/create/useCreateWorkflow.test.tsx`

## Task 1: Add a DOM test lane for components and hooks

**Files:**

- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `src/test/setup-dom.ts`
- Create: `src/test/render.tsx`
- Test: `src/components/GenerateForm.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GenerateForm } from './GenerateForm'

describe('GenerateForm', () => {
    it('submits trimmed manuscript with the default options', async () => {
        const onGenerate = vi.fn()
        const user = userEvent.setup()

        render(
            <GenerateForm
                onGenerate={onGenerate}
                isLoading={false}
                credits={9_999}
                accountTier="paid"
            />,
        )

        await user.type(
            screen.getByPlaceholderText(/paste your story or novel text here/i),
            '  Hero enters the temple.  ',
        )

        await user.click(screen.getByRole('button', { name: /initialize engine/i }))

        expect(onGenerate).toHaveBeenCalledWith(
            'Hero enters the temple.',
            'manga',
            15,
            'standard',
        )
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/GenerateForm.test.tsx`

Expected: FAIL because `.test.tsx` is not included yet, `jsdom` is not configured yet, or Testing Library packages are missing.

- [ ] **Step 3: Write the minimal config and helpers**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        environmentMatchGlobs: [
            ['src/components/**/*.test.tsx', 'jsdom'],
            ['src/hooks/**/*.test.tsx', 'jsdom'],
            ['src/app/**/*.test.tsx', 'jsdom'],
        ],
        setupFiles: ['src/test/setup-dom.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
```

```ts
// src/test/setup-dom.ts
import '@testing-library/jest-dom/vitest'
```

```ts
// src/test/render.tsx
export { render, screen, within, waitFor } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
```

```json
// package.json (devDependencies)
{
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.1.0",
  "@testing-library/user-event": "^14.5.2",
  "jsdom": "^25.0.1"
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/GenerateForm.test.tsx`

Expected: PASS

- [ ] **Step 5: Run the full suite to make sure the new lane did not break node tests**

Run: `npm test`

Expected: PASS with both existing `.test.ts` files and the new `.test.tsx` file included.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup-dom.ts src/test/render.tsx src/components/GenerateForm.test.tsx
git commit -m "test: add vitest dom lane for components and hooks"
```

## Task 2: Add repo-level TDD standards and PR proof requirements

**Files:**

- Modify: `README.md`
- Create: `docs/testing/tdd-standards.md`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write the standards document**

```md
# TDD Standards

## Non-negotiables
1. Write the failing test first.
2. Run the targeted test and watch it fail for the expected reason.
3. Write the minimal implementation.
4. Re-run the targeted test until it passes.
5. Run the owning folder suite before opening a PR.

## Folder ownership
- `src/lib`: pure logic and business rules
- `src/app/api`: route contracts only
- `src/components`: user-visible interactions and states
- `src/hooks`: client state transitions and side effects
```

- [ ] **Step 2: Add a short TDD section to the README**

```md
## TDD Workflow

This repo uses test-driven development for all new features, bug fixes, and behavior changes.

1. Write the failing test first.
2. Confirm it fails for the expected reason.
3. Write the smallest possible implementation.
4. Re-run the targeted test.
5. Run `npm test` before pushing.
```

- [ ] **Step 3: Add a PR template that requires TDD proof**

```md
## TDD Proof

- Failing test(s) written first:
- Why the test failed initially:
- Minimal implementation added:
- Targeted test command run:
- Full suite command run:

## Review Notes

- Risky folders touched:
- New mocks introduced:
- Follow-up tests intentionally deferred:
```

- [ ] **Step 4: Verify the docs are wired correctly**

Run: `rg -n "TDD Workflow|TDD Standards|TDD Proof" README.md docs/testing/tdd-standards.md .github/pull_request_template.md`

Expected: matching lines in all three files.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/testing/tdd-standards.md .github/pull_request_template.md
git commit -m "docs: add repo tdd standards and pr checklist"
```

## Task 3: Close the highest-value `src/lib` gaps first

**Files:**

- Create: `src/lib/__tests__/api-handler.test.ts`
- Create: `src/lib/__tests__/api-validate.test.ts`
- Create: `src/lib/__tests__/env-validation.test.ts`
- Create: `src/lib/progress/episode-progress-snapshot.test.ts`
- Test: `src/lib/__tests__/api-handler.test.ts`
- Test: `src/lib/__tests__/api-validate.test.ts`
- Test: `src/lib/__tests__/env-validation.test.ts`
- Test: `src/lib/progress/episode-progress-snapshot.test.ts`

- [ ] **Step 1: Write the failing `api-handler` test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
    assertTrustedRequestOrigin: vi.fn(),
    buildErrorResponse: vi.fn(() => NextResponse.json({ error: 'boom' }, { status: 500 })),
}))

vi.mock('@/lib/request-security', () => ({
    assertTrustedRequestOrigin: mocks.assertTrustedRequestOrigin,
}))

vi.mock('@/lib/errors', () => ({
    buildErrorResponse: mocks.buildErrorResponse,
}))

import { apiHandler } from '@/lib/api-handler'

describe('apiHandler', () => {
    it('validates trusted origin before invoking the route handler', async () => {
        const handler = vi.fn(async () => NextResponse.json({ ok: true }))
        const wrapped = apiHandler(handler)

        const response = await wrapped(new NextRequest('http://localhost/api/health'), { params: Promise.resolve({}) })

        expect(response.status).toBe(200)
        expect(mocks.assertTrustedRequestOrigin).toHaveBeenCalled()
        expect(handler).toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Write the failing `api-validate` and env tests**

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/api-validate'

describe('parseJsonBody', () => {
    it('surfaces the first zod issue path in the error message', async () => {
        const request = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({ pageCount: 99 }),
            headers: { 'content-type': 'application/json' },
        })

        await expect(parseJsonBody(request, z.object({
            pageCount: z.number().max(30),
        }))).rejects.toMatchObject({
            message: 'pageCount: Too big: expected number to be <=30',
        })
    })
})
```

```ts
import { describe, expect, it, vi } from 'vitest'
import { getEnvValidationReport } from '@/lib/env-validation'

describe('getEnvValidationReport', () => {
    it('marks production as not ready when platform credentials are missing', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('ENCRYPTION_SECRET', 'secret')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toContain('WAVESPEED_API_KEY')
    })
})
```

- [ ] **Step 3: Run the targeted lib tests to verify they fail**

Run: `npm test -- src/lib/__tests__/api-handler.test.ts src/lib/__tests__/api-validate.test.ts src/lib/__tests__/env-validation.test.ts src/lib/progress/episode-progress-snapshot.test.ts`

Expected: FAIL because the tests do not exist yet or because the behavior is not fully covered.

- [ ] **Step 4: Write the minimal tests and supporting assertions**

```ts
// src/lib/progress/episode-progress-snapshot.test.ts
import { describe, expect, it, vi } from 'vitest'

const prisma = {
    episode: {
        findUnique: vi.fn(),
    },
}

vi.mock('@/lib/prisma', () => ({ prisma }))

import { getEpisodeProgressSnapshot } from './episode-progress-snapshot'

describe('getEpisodeProgressSnapshot', () => {
    it('returns a minimal snapshot for the episode progress bar', async () => {
        prisma.episode.findUnique.mockResolvedValue({
            status: 'imaging',
            progress: 72,
            error: null,
        })

        await expect(getEpisodeProgressSnapshot('ep_1')).resolves.toEqual({
            status: 'imaging',
            progress: 72,
            error: null,
        })
    })
})
```

- [ ] **Step 5: Run the targeted tests to verify they pass**

Run: `npm test -- src/lib/__tests__/api-handler.test.ts src/lib/__tests__/api-validate.test.ts src/lib/__tests__/env-validation.test.ts src/lib/progress/episode-progress-snapshot.test.ts`

Expected: PASS

- [ ] **Step 6: Run the full `src/lib` lane**

Run: `npm test -- src/lib/__tests__ src/lib/*.test.ts src/lib/validators/generate.test.ts src/lib/progress/episode-progress-snapshot.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/__tests__/api-handler.test.ts src/lib/__tests__/api-validate.test.ts src/lib/__tests__/env-validation.test.ts src/lib/progress/episode-progress-snapshot.test.ts
git commit -m "test: close high-value src/lib coverage gaps"
```

## Task 4: Establish the `src/app/api` rollout pattern with a thin-route pilot

**Files:**

- Create: `src/lib/episodes/delete-episode.ts`
- Create: `src/lib/__tests__/delete-episode.test.ts`
- Modify: `src/app/api/episodes/[episodeId]/route.ts`
- Create: `src/app/api/episodes/[episodeId]/route.test.ts`
- Create: `src/app/api/user/usage/route.test.ts`

- [ ] **Step 1: Write the failing domain test for episode deletion**

```ts
import { describe, expect, it, vi } from 'vitest'

const prisma = {
    episode: {
        delete: vi.fn(),
        count: vi.fn(),
    },
    project: {
        delete: vi.fn(),
    },
}

vi.mock('@/lib/prisma', () => ({ prisma }))

import { deleteEpisodeForProject } from '@/lib/episodes/delete-episode'

describe('deleteEpisodeForProject', () => {
    it('deletes the parent project when the deleted episode was the final chapter', async () => {
        prisma.episode.count.mockResolvedValue(0)

        await deleteEpisodeForProject({ episodeId: 'ep_1', projectId: 'proj_1' })

        expect(prisma.episode.delete).toHaveBeenCalledWith({ where: { id: 'ep_1' } })
        expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'proj_1' } })
    })
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- src/lib/__tests__/delete-episode.test.ts 'src/app/api/episodes/[episodeId]/route.test.ts' src/app/api/user/usage/route.test.ts`

Expected: FAIL because the domain helper and route tests do not exist yet.

- [ ] **Step 3: Write the minimal implementation and route contract tests**

```ts
// src/lib/episodes/delete-episode.ts
import { prisma } from '@/lib/prisma'

export async function deleteEpisodeForProject({
    episodeId,
    projectId,
}: {
    episodeId: string
    projectId: string
}) {
    await prisma.episode.delete({ where: { id: episodeId } })

    const remainingEpisodes = await prisma.episode.count({
        where: { projectId },
    })

    if (remainingEpisodes === 0) {
        await prisma.project.delete({ where: { id: projectId } })
    }
}
```

```ts
// src/app/api/episodes/[episodeId]/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireEpisodeOwner: vi.fn(),
    deleteEpisodeForProject: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
    requireEpisodeOwner: mocks.requireEpisodeOwner,
}))

vi.mock('@/lib/episodes/delete-episode', () => ({
    deleteEpisodeForProject: mocks.deleteEpisodeForProject,
}))

import { DELETE } from './route'

describe('DELETE /api/episodes/[episodeId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user_1' }, error: null })
        mocks.requireEpisodeOwner.mockResolvedValue({
            error: null,
            episode: { id: 'ep_1', projectId: 'proj_1' },
        })
    })

    it('deletes the episode through the shared domain helper', async () => {
        const response = await DELETE(
            new NextRequest('http://localhost/api/episodes/ep_1', { method: 'DELETE' }),
            { params: Promise.resolve({ episodeId: 'ep_1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.deleteEpisodeForProject).toHaveBeenCalledWith({
            episodeId: 'ep_1',
            projectId: 'proj_1',
        })
    })
})
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- src/lib/__tests__/delete-episode.test.ts 'src/app/api/episodes/[episodeId]/route.test.ts' src/app/api/user/usage/route.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/episodes/delete-episode.ts src/lib/__tests__/delete-episode.test.ts 'src/app/api/episodes/[episodeId]/route.ts' 'src/app/api/episodes/[episodeId]/route.test.ts' src/app/api/user/usage/route.test.ts
git commit -m "test: establish thin-route tdd pattern for api handlers"
```

## Task 5: Roll TDD into critical client flows

**Files:**

- Create: `src/components/GenerateForm.test.tsx`
- Create: `src/components/ReviewAnalysis.test.tsx`
- Create: `src/components/ReviewStoryboard.test.tsx`
- Create: `src/hooks/useAuth.test.tsx`
- Create: `src/app/(app)/create/useCreateWorkflow.test.tsx`

- [ ] **Step 1: Write the failing `useCreateWorkflow` test**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateWorkflow } from './useCreateWorkflow'

describe('useCreateWorkflow', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('returns to input and exposes the API error when generation fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'Insufficient credits' }), { status: 402 }),
        ))

        const { result } = renderHook(() => useCreateWorkflow({ resumeId: null }))

        await act(async () => {
            await result.current.handleGenerate('story', 'manga', 15, 'standard')
        })

        await waitFor(() => {
            expect(result.current.state).toBe('input')
            expect(result.current.error).toBe('Insufficient credits')
        })
    })
})
```

- [ ] **Step 2: Write the failing `useAuth` test**

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/hooks/useAuth'

describe('useAuth', () => {
    it('clears the user when Clerk is loaded but signed out', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
        )

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toBeNull()
        })
    })
})
```

- [ ] **Step 3: Run the targeted client tests to verify they fail**

Run: `npm test -- src/components/GenerateForm.test.tsx src/components/ReviewAnalysis.test.tsx src/components/ReviewStoryboard.test.tsx src/hooks/useAuth.test.tsx 'src/app/(app)/create/useCreateWorkflow.test.tsx'`

Expected: FAIL because the tests do not exist yet and client-specific mocks are not in place yet.

- [ ] **Step 4: Implement the minimal client test helpers and cases**

```tsx
// Example assertions to add during this task
expect(screen.getByText(/available balance/i)).toBeInTheDocument()
expect(screen.getByRole('button', { name: /initialize engine/i })).toBeDisabled()
expect(screen.getByText(/insufficient credits/i)).toBeInTheDocument()
```

```tsx
// Example for ReviewAnalysis / ReviewStoryboard
expect(onApprove).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ name: 'Linh' }),
]))
```

- [ ] **Step 5: Run the targeted client suite to verify it passes**

Run: `npm test -- src/components/GenerateForm.test.tsx src/components/ReviewAnalysis.test.tsx src/components/ReviewStoryboard.test.tsx src/hooks/useAuth.test.tsx 'src/app/(app)/create/useCreateWorkflow.test.tsx'`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/GenerateForm.test.tsx src/components/ReviewAnalysis.test.tsx src/components/ReviewStoryboard.test.tsx src/hooks/useAuth.test.tsx 'src/app/(app)/create/useCreateWorkflow.test.tsx'
git commit -m "test: cover core client workflows with tdd"
```

## Task 6: Add CI enforcement after the critical lanes are stable

**Files:**

- Create: `.github/workflows/test.yml`
- Modify: `package.json`

- [ ] **Step 1: Add explicit scripts for local verification**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:critical": "vitest run src/lib/__tests__ src/app/api/generate/route.test.ts src/app/api/user/credits/route.test.ts src/components/GenerateForm.test.tsx src/hooks/useAuth.test.tsx"
  }
}
```

- [ ] **Step 2: Add a minimal GitHub Actions workflow**

```yml
name: test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Verify the new workflow locally**

Run: `npm test && npm run build`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/test.yml
git commit -m "ci: enforce repo test and build checks"
```

## Rollout Checklist

### Phase 0: Baseline and socialization

- [ ] Confirm `npm test` is green on the shared branch before starting the rollout.
- [ ] Share `docs/testing/tdd-standards.md` with everyone who opens PRs.
- [ ] Make the PR template visible before enforcing review rules.

### Phase 1: Infrastructure

- [ ] `.test.tsx` files run inside Vitest.
- [ ] `jsdom` and Testing Library are installed and stable.
- [ ] `src/test/setup-dom.ts` and `src/test/render.tsx` are in place.

### Phase 2: Backend-first adoption

- [ ] All new `src/lib` changes start with a failing test.
- [ ] High-value missing tests exist for `api-handler`, `api-validate`, `env-validation`, and episode progress snapshots.
- [ ] New business logic in routes is extracted into `src/lib` before it grows.
- [ ] `src/app/api/episodes/[episodeId]/route.ts` and `src/app/api/user/usage/route.ts` have route contract tests.

### Phase 3: Client adoption

- [ ] `GenerateForm` is covered for submit, disable, and credit-warning behaviors.
- [ ] `useCreateWorkflow` is covered for success, resume, cancel, and error transitions.
- [ ] `useAuth` is covered for signed-out, signed-in, and fetch-failure transitions.
- [ ] `ReviewAnalysis` and `ReviewStoryboard` have interaction tests for the approval path.

### Phase 4: Enforcement

- [ ] CI runs `npm test` and `npm run build` on pull requests.
- [ ] Reviewers reject behavior changes that have no failing-test proof.
- [ ] Coverage thresholds are only introduced after the critical lanes are consistently green.

## Directory Review Standards

### `src/lib`

- Every behavior change must add or update a test before code changes.
- Prefer real inputs and outputs over mock-heavy tests.
- Pure functions should get direct unit tests with edge cases, not integration detours.
- Modules that touch Prisma, queueing, storage, or fetch should mock those boundaries only.
- If a new file is hard to test, that is a design smell. Split the unit before merging.

### `src/app/api`

- Routes should stay thin: auth, request parsing, service call, response.
- Every route change needs contract tests for unauthorized, invalid input, happy path, and downstream failure.
- Business rules belong in `src/lib`, not inline in the route handler.
- Route tests should mock external boundaries, not re-test logic already covered in `src/lib`.

### `src/app/(app)`, `src/app/(public)`, `src/app/(immersive)`

- Page tests should focus on branching behavior such as redirects, empty states, and error states.
- Do not use page tests to cover business logic that should live in hooks or `src/lib`.
- If a page needs extensive mocking to test one branch, extract that branch behind a smaller hook or helper first.

### `src/components`

- Test interaction and observable state, not implementation details.
- Query by accessible role, label, placeholder, and visible text before reaching for test ids.
- Avoid snapshot-only tests for UI primitives.
- Critical flows to prioritize: generate, review analysis, review storyboard, editor save/export actions.
- Cosmetic refactors still need a test when they alter disabled/loading/error behavior.

### `src/hooks`

- Hooks with branching or side effects must have dedicated tests.
- Assert state transitions explicitly: initial, loading, success, failure.
- Prefer `renderHook` plus mocked boundaries over full-page integration tests when the behavior is local to the hook.
- If a hook depends on browser APIs, centralize the stubs in test setup or shared helpers.

### `prisma`

- Do not put untestable business logic inside Prisma call sites.
- New query behavior should be exercised through a service-level test in `src/lib/__tests__`.
- Migration or data repair logic should be pulled behind testable helper functions when possible.

### `scripts`

- Scripts should remain CLI wrappers around testable functions in `src/lib`.
- Any transformation, filtering, or migration logic inside a script needs unit tests in `src/lib/__tests__`.
- Avoid one-off scripts that cannot be safely replayed in a test harness.

## Exit Criteria

- The repo has both node and DOM test lanes.
- The team can point to a standard document and PR template that define TDD proof.
- `src/lib`, `src/app/api`, `src/components`, and `src/hooks` each have at least one current, repo-native example of the desired TDD pattern.
- CI is enforcing the same commands developers are expected to run locally.
