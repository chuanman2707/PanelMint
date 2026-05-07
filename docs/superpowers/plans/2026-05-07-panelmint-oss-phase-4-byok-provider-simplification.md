# PanelMint OSS Phase 4 BYOK Provider Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `WAVESPEED_API_KEY` in `.env` the only runtime provider key source and remove DB-stored WaveSpeed API-key behavior from PanelMint OSS.

**Architecture:** First centralize WaveSpeed config in `src/lib/api-config.ts` and make LLM/image/pipeline callers use that `.env`-only contract. Then tighten health/error messages around local BYOK setup, remove the Settings API-key UI and `/api/user/api-key` storage path, and finally remove provider key columns from the fresh-install schema and docs.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma/Postgres, Vitest, GitNexus MCP.

---

## File Structure

Provider config and LLM:

- Create: `src/lib/__tests__/api-config.test.ts`
- Modify: `src/lib/api-config.ts`
- Modify: `src/lib/ai/llm.ts`
- Modify: `src/lib/ai/llm.test.ts`

Health and environment validation:

- Modify: `src/lib/env-validation.ts`
- Modify: `src/lib/__tests__/env-validation.test.ts`
- Modify: `src/app/api/health/route.test.ts`

Provider error wording:

- Modify: `src/lib/pipeline/orchestrator.ts`
- Modify: `src/lib/__tests__/orchestrator-analyze-step.test.ts`
- Modify: `src/lib/pipeline/image-gen.ts`
- Modify: `src/lib/__tests__/image-gen-flow.test.ts`

Settings and API-key storage cleanup:

- Create: `src/app/(app)/settings/page.test.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/lib/local-user.ts`
- Delete: `src/app/api/user/api-key/route.ts`
- Delete: `src/app/api/user/api-key/route.test.ts`
- Delete: `src/lib/validators/user.ts`
- Delete: `src/lib/crypto.ts`
- Delete: `src/lib/__tests__/crypto.test.ts`
- Delete: `scripts/migrate-encrypt-api-keys.ts`

Schema and docs:

- Modify: `prisma/schema.prisma`
- Modify: `prisma/postgres-baseline.sql`
- Modify: `prisma/migrations/20260330104038_init/migration.sql`
- Modify: `.env.example`
- Modify: `README.md`

## Safety Rules For Every Task

- Before editing any function, class, method, or component listed in a task, run GitNexus impact on that symbol with `direction: "upstream"` and `includeTests: true`.
- If GitNexus reports HIGH or CRITICAL risk, stop and report the blast radius before editing that symbol.
- Do not reset or discard existing dirty changes. This worktree currently has uncommitted Phase 3 image/storage changes; preserve them when editing overlapping files such as `src/lib/pipeline/image-gen.ts`.
- Use `apply_patch` for manual edits.
- Commit after each task with only that task's files staged.

---

### Task 1: Centralize Provider Config On `.env`

**Files:**

- Create: `src/lib/__tests__/api-config.test.ts`
- Modify: `src/lib/api-config.ts`
- Modify: `src/lib/ai/llm.ts`
- Modify: `src/lib/ai/llm.test.ts`

- [ ] **Step 1: Run impact checks**

Run GitNexus MCP impacts:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "getProviderConfig", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "callLLM", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: `getProviderConfig` is HIGH risk with direct pipeline and character route callers. Report the direct callers and affected processes before editing.

- [ ] **Step 2: Add failing provider-config tests**

Create `src/lib/__tests__/api-config.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import {
    getProviderConfig,
    WAVESPEED_PROVIDER_SETUP_ERROR,
} from '@/lib/api-config'

describe('getProviderConfig', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.clearAllMocks()
    })

    it('loads WaveSpeed config from environment variables only', async () => {
        vi.stubEnv('WAVESPEED_API_KEY', '  ws-env-key  ')
        vi.stubEnv('LLM_MODEL', ' custom-llm ')
        vi.stubEnv('IMAGE_MODEL', ' custom-image ')

        await expect(getProviderConfig('user-1')).resolves.toEqual({
            provider: 'wavespeed',
            apiKey: 'ws-env-key',
            llmModel: 'custom-llm',
            imageModel: 'custom-image',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })

        expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('throws a local setup error when WAVESPEED_API_KEY is missing', async () => {
        vi.stubEnv('WAVESPEED_API_KEY', '')

        await expect(getProviderConfig('user-1')).rejects.toThrow(WAVESPEED_PROVIDER_SETUP_ERROR)
        expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 3: Run provider-config test to verify it fails**

Run:

```bash
npm test -- src/lib/__tests__/api-config.test.ts
```

Expected: FAIL because current `getProviderConfig` queries `prisma.user` and does not read `LLM_MODEL` / `IMAGE_MODEL` in `src/lib/api-config.ts`.

- [ ] **Step 4: Add failing LLM shared-config test**

Modify `src/lib/ai/llm.test.ts` so the top of the file mocks `getProviderConfig` before importing `callLLM`.

Replace the import block with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getProviderConfig: vi.fn(),
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

import { callLLM } from '@/lib/ai/llm'
```

Replace the existing `beforeEach` with:

```ts
beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.getProviderConfig.mockResolvedValue({
        provider: 'wavespeed',
        apiKey: 'env-provider-key',
        llmModel: 'env-llm-model',
        imageModel: 'env-image-model',
        baseUrl: 'https://api.wavespeed.ai/api/v3',
    })
})
```

Add this test before the long-running storyboard test:

```ts
it('uses shared provider config when no explicit config is passed', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/wavespeed-ai/any-llm')) {
            return new Response(JSON.stringify({
                data: { id: 'task-env-config' },
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({
            data: {
                status: 'completed',
                output: 'Configured response',
            },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })
    })
    vi.stubGlobal('fetch', fetchMock)

    const resultPromise = callLLM('Use shared config')

    await vi.runAllTimersAsync()

    await expect(resultPromise).resolves.toBe('Configured response')
    expect(mocks.getProviderConfig).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: 'Bearer env-provider-key',
    })

    const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        model?: string
    }
    expect(submitBody.model).toBe('env-llm-model')
})
```

In the long-running storyboard test, add this assertion after `await expect(resultPromise).resolves.toBe('Storyboard ready')`:

```ts
expect(mocks.getProviderConfig).not.toHaveBeenCalled()
```

- [ ] **Step 5: Run LLM test to verify it fails**

Run:

```bash
npm test -- src/lib/ai/llm.test.ts
```

Expected: FAIL because `src/lib/ai/llm.ts` still uses private `getPlatformProviderConfig` instead of importing runtime `getProviderConfig`.

- [ ] **Step 6: Simplify `src/lib/api-config.ts`**

Replace the contents of `src/lib/api-config.ts` with:

```ts
/**
 * WaveSpeed provider configuration for the local OSS runtime.
 *
 * WAVESPEED_API_KEY in .env is the only runtime API key source.
 */

export type ApiProvider = 'wavespeed'

export interface ProviderConfig {
    provider: ApiProvider
    apiKey: string
    llmModel: string
    imageModel: string
    baseUrl: string
    userId?: string
}

export const WAVESPEED_PROVIDER_SETUP_ERROR =
    'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.'

const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3'
const DEFAULT_LLM_MODEL = 'bytedance-seed/seed-1.6-flash'
const DEFAULT_IMAGE_MODEL = 'wavespeed-ai/flux-kontext-pro/multi'

function readEnvValue(key: string): string | null {
    const value = process.env[key]?.trim()
    return value || null
}

export async function getProviderConfig(userId?: string): Promise<ProviderConfig> {
    const apiKey = readEnvValue('WAVESPEED_API_KEY')
    if (!apiKey) {
        throw new Error(WAVESPEED_PROVIDER_SETUP_ERROR)
    }

    return {
        provider: 'wavespeed',
        apiKey,
        llmModel: readEnvValue('LLM_MODEL') ?? DEFAULT_LLM_MODEL,
        imageModel: readEnvValue('IMAGE_MODEL') ?? DEFAULT_IMAGE_MODEL,
        baseUrl: WAVESPEED_BASE_URL,
        ...(userId ? { userId } : {}),
    }
}

export function getProviderInfo(provider: ApiProvider) {
    const info = {
        wavespeed: {
            name: 'WaveSpeed AI',
            description: 'Unified provider for text generation and multi-reference image generation.',
            llmModel: 'Seed 1.6 Flash',
            imageModel: 'FLUX Kontext Pro Multi',
            configuration: 'Configured with WAVESPEED_API_KEY in .env',
            risk: 'none' as const,
            setupUrl: 'https://wavespeed.ai/accesskey',
        },
    }
    return info[provider]
}
```

- [ ] **Step 7: Make `callLLM` use shared provider config**

In `src/lib/ai/llm.ts`, change the file header comment to:

```ts
/**
 * LLM wrapper for WaveSpeed.
 *
 * Text generation uses the official WaveSpeed "any-llm" endpoint with the
 * shared local provider config from WAVESPEED_API_KEY.
 */
```

Change the import to:

```ts
import { getProviderConfig, type ProviderConfig } from '@/lib/api-config'
```

In `callLLM`, replace:

```ts
const providerConfig = options?.providerConfig ?? getPlatformProviderConfig()
```

with:

```ts
const providerConfig = options?.providerConfig ?? await getProviderConfig()
```

Delete the entire private `getPlatformProviderConfig` function from `src/lib/ai/llm.ts`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/lib/__tests__/api-config.test.ts src/lib/ai/llm.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit provider config centralization**

Run:

```bash
git add src/lib/__tests__/api-config.test.ts src/lib/api-config.ts src/lib/ai/llm.ts src/lib/ai/llm.test.ts
git commit -m "refactor: centralize wavespeed env config"
```

---

### Task 2: Make Health Report Generation Readiness Without Startup Crashes

**Files:**

- Modify: `src/lib/env-validation.ts`
- Modify: `src/lib/__tests__/env-validation.test.ts`
- Modify: `src/app/api/health/route.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "getEnvValidationReport", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "validateEnv", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: `getEnvValidationReport` affects `/api/health`; `validateEnv` affects startup through Prisma import. Report any HIGH or CRITICAL risk before editing.

- [ ] **Step 2: Update env-validation tests first**

Replace `src/lib/__tests__/env-validation.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getEnvValidationReport, validateEnv } from '@/lib/env-validation'

describe('env-validation', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('marks generation as not ready when WAVESPEED_API_KEY is missing', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toContain('WAVESPEED_API_KEY')
        expect(report.checks.DATABASE_URL).toBe('configured')
        expect(report.checks.WAVESPEED_API_KEY).toBe('missing')
        expect(report.checks.ENCRYPTION_SECRET).toBeUndefined()
    })

    it('does not crash startup validation when only WAVESPEED_API_KEY is missing', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        expect(() => validateEnv()).not.toThrow()
    })

    it('throws a startup error only for true startup requirements', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', '')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        expect(() => validateEnv()).toThrowError(
            '[Startup] Missing required env vars: DATABASE_URL',
        )
    })

    it('requires the rest of the R2 credentials once any R2 variable is configured', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('R2_ACCOUNT_ID', 'account-id')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toEqual(
            expect.arrayContaining([
                'R2_ACCESS_KEY_ID',
                'R2_SECRET_ACCESS_KEY',
                'R2_BUCKET_NAME',
            ]),
        )
        expect(report.checks.R2_ACCOUNT_ID).toBe('configured')
        expect(report.checks.R2_PUBLIC_URL).toBe('optional')
    })

    it('keeps production origin warnings separate from readiness', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('INNGEST_EVENT_KEY', 'event-key')
        vi.stubEnv('INNGEST_SIGNING_KEY', 'signing-key')
        vi.stubEnv('ALLOWED_ORIGINS', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(true)
        expect(report.warnings).toContain(
            'ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.',
        )
    })
})
```

- [ ] **Step 3: Update health route tests first**

In `src/app/api/health/route.test.ts`, remove `ENCRYPTION_SECRET` from both mocked `checks` objects.

Change the second test name to:

```ts
it('returns degraded when generation env is missing', async () => {
```

In that test, change `requiredMissing` to:

```ts
requiredMissing: ['WAVESPEED_API_KEY'],
```

Change the final expectation to:

```ts
await expect(response.json()).resolves.toMatchObject({
    status: 'degraded',
    details: {
        missingRequiredEnv: ['WAVESPEED_API_KEY'],
    },
    checks: {
        env: {
            WAVESPEED_API_KEY: 'missing',
        },
    },
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/__tests__/env-validation.test.ts src/app/api/health/route.test.ts
```

Expected: FAIL because `ENCRYPTION_SECRET` is still required and `validateEnv` still throws based on all health-required env vars.

- [ ] **Step 5: Update env validation implementation**

Replace `src/lib/env-validation.ts` with:

```ts
const STARTUP_REQUIRED = ['DATABASE_URL'] as const
const GENERATION_REQUIRED = ['WAVESPEED_API_KEY'] as const
const PROD_QUEUE_REQUIRED = [
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
] as const
const OPTIONAL_R2_REQUIRED = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
] as const
const OPTIONAL_R2_OPTIONAL = ['R2_PUBLIC_URL'] as const

export interface EnvValidationReport {
    ready: boolean
    requiredMissing: string[]
    warnings: string[]
    checks: Record<string, 'configured' | 'missing' | 'optional'>
}

function hasValue(key: string): boolean {
    return Boolean(process.env[key]?.trim())
}

function missing(keys: readonly string[]): string[] {
    return keys.filter((key) => !hasValue(key))
}

export function getEnvValidationReport(): EnvValidationReport {
    const requiredMissing: string[] = [
        ...missing(STARTUP_REQUIRED),
        ...missing(GENERATION_REQUIRED),
    ]

    if (process.env.NODE_ENV === 'production') {
        requiredMissing.push(...missing(PROD_QUEUE_REQUIRED))
    }

    const anyR2Configured = [...OPTIONAL_R2_REQUIRED, ...OPTIONAL_R2_OPTIONAL].some((key) => hasValue(key))
    if (anyR2Configured) {
        requiredMissing.push(...missing(OPTIONAL_R2_REQUIRED))
    }

    const warnings: string[] = []
    if (process.env.NODE_ENV === 'production' && !hasValue('ALLOWED_ORIGINS')) {
        warnings.push('ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.')
    }

    const checks: EnvValidationReport['checks'] = {}
    for (const key of STARTUP_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of GENERATION_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of PROD_QUEUE_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of OPTIONAL_R2_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'optional'
    }
    for (const key of OPTIONAL_R2_OPTIONAL) {
        checks[key] = hasValue(key) ? 'configured' : 'optional'
    }
    checks.ALLOWED_ORIGINS = hasValue('ALLOWED_ORIGINS') ? 'configured' : 'optional'

    return {
        ready: requiredMissing.length === 0,
        requiredMissing: [...new Set(requiredMissing)],
        warnings,
        checks,
    }
}

export function validateEnv(): void {
    const requiredMissing = missing(STARTUP_REQUIRED)
    if (requiredMissing.length > 0) {
        throw new Error(
            `[Startup] Missing required env vars: ${requiredMissing.join(', ')}\n` +
            'Copy .env.example to .env and set the required values.',
        )
    }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/__tests__/env-validation.test.ts src/app/api/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit health/env readiness**

Run:

```bash
git add src/lib/env-validation.ts src/lib/__tests__/env-validation.test.ts src/app/api/health/route.test.ts
git commit -m "refactor: report wavespeed env readiness"
```

---

### Task 3: Replace Platform/Settings Error Copy With Local BYOK Copy

**Files:**

- Modify: `src/lib/pipeline/orchestrator.ts`
- Modify: `src/lib/__tests__/orchestrator-analyze-step.test.ts`
- Modify: `src/lib/pipeline/image-gen.ts`
- Modify: `src/lib/__tests__/image-gen-flow.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "runAnalyzeStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "generatePanelImage", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "ServiceError", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: `runAnalyzeStep` and `generatePanelImage` may be HIGH risk because they sit on generation paths. Report the direct callers and affected processes before editing.

- [ ] **Step 2: Add failing analyze missing-key test**

In `src/lib/__tests__/orchestrator-analyze-step.test.ts`, add this test after the existing test:

```ts
it('persists WAVESPEED_API_KEY setup errors without stale Settings copy', async () => {
    mocks.getProviderConfig.mockRejectedValueOnce(
        new Error('WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.'),
    )

    await runAnalyzeStep({
        projectId: 'project-1',
        episodeId: 'episode-1',
        userId: 'user-1',
        text: 'A training day at the academy.',
        artStyle: 'manhua',
        pageCount: 5,
    })

    expect(mocks.prisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'episode-1' },
        data: {
            status: 'error',
            error: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
        },
    })
    expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
        episodeId: 'episode-1',
        userId: 'user-1',
        step: 'analyze',
        status: 'failed',
        metadata: {
            error: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
        },
    })
    expect(mocks.analyzeCharactersAndLocations).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Add failing image auth-copy test**

In `src/lib/__tests__/image-gen-flow.test.ts`, change the import to:

```ts
import { ContentFilterError, generatePanelImage, ServiceError } from '@/lib/pipeline/image-gen'
```

Add this test before the content filter test:

```ts
it('reports WaveSpeed auth failures as local .env setup errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response('invalid token', {
            status: 401,
            headers: { 'content-type': 'text/plain' },
        }))
    vi.stubGlobal('fetch', fetchMock)

    try {
        let caught: unknown
        try {
            await generatePanelImage({
                panelId: 'panel-auth',
                description: 'Hero reveal',
                characters: ['Thanh Thu'],
                shotType: 'medium',
                location: 'forest',
                artStyle: 'webtoon',
                providerConfig: {
                    provider: 'wavespeed',
                    apiKey: 'bad-key',
                    llmModel: 'bytedance-seed/seed-1.6-flash',
                    imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                    baseUrl: 'https://api.wavespeed.ai/api/v3',
                },
            })
        } catch (error) {
            caught = error
        }

        expect(caught).toBeInstanceOf(ServiceError)
        expect(caught).toHaveProperty(
            'message',
            'WaveSpeed rejected WAVESPEED_API_KEY. Check the key in .env and restart the app.',
        )
        expect(consoleError).toHaveBeenCalledWith(
            '[ImageGen] wavespeed.ai auth error - check WAVESPEED_API_KEY in .env',
        )
        expect(consoleError.mock.calls.flat().join(' ')).not.toContain('platform API key')
    } finally {
        consoleError.mockRestore()
    }
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/__tests__/orchestrator-analyze-step.test.ts src/lib/__tests__/image-gen-flow.test.ts
```

Expected: FAIL because `runAnalyzeStep` rewrites provider errors to Settings copy and `submitWavespeedTask` says "bad platform API key" / "Generation service temporarily unavailable".

- [ ] **Step 5: Preserve provider setup errors in analyze**

In `src/lib/pipeline/orchestrator.ts`, replace the provider config catch in `runAnalyzeStep`:

```ts
} catch {
    await setEpisodeError(
        episodeId,
        userId,
        new Error('API key not configured. Please add your API key in Settings.'),
        'analyze',
    )
    return
}
```

with:

```ts
} catch (error) {
    await setEpisodeError(episodeId, userId, error, 'analyze')
    return
}
```

- [ ] **Step 6: Update image auth failure wording**

In `src/lib/pipeline/image-gen.ts`, replace:

```ts
if (res.status === 401 || res.status === 403) {
    console.error('[ImageGen] wavespeed.ai auth error — bad platform API key')
    throw new ServiceError('Generation service temporarily unavailable. Please try again later.')
}
```

with:

```ts
if (res.status === 401 || res.status === 403) {
    console.error('[ImageGen] wavespeed.ai auth error - check WAVESPEED_API_KEY in .env')
    throw new ServiceError('WaveSpeed rejected WAVESPEED_API_KEY. Check the key in .env and restart the app.')
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/lib/__tests__/orchestrator-analyze-step.test.ts src/lib/__tests__/image-gen-flow.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit error wording cleanup**

Run:

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/__tests__/orchestrator-analyze-step.test.ts src/lib/pipeline/image-gen.ts src/lib/__tests__/image-gen-flow.test.ts
git commit -m "fix: use local wavespeed key errors"
```

---

### Task 4: Remove Settings API-Key Management UI

**Files:**

- Create: `src/app/(app)/settings/page.test.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Run impact check**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "SettingsPage", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: Settings is a page-level component. If GitNexus reports candidates, choose `src/app/(app)/settings/page.tsx`.

- [ ] **Step 2: Add failing Settings UI test**

Create `src/app/(app)/settings/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useLocalUser', () => ({
    useLocalUser: () => ({
        user: {
            id: 'user-1',
            email: 'local@panelmint.dev',
            name: 'Local Creator',
        },
    }),
}))

import SettingsPage from './page'

describe('SettingsPage', () => {
    it('shows local workspace settings without API-key management controls', () => {
        render(<SettingsPage />)

        expect(screen.getByText(/Workspace Identity/i)).toBeInTheDocument()
        expect(screen.getAllByText(/WAVESPEED_API_KEY/i).length).toBeGreaterThan(0)
        expect(screen.queryByLabelText(/Provider API key/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Save Key/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Validate/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Remove Key/i })).not.toBeInTheDocument()
        expect(screen.queryByText(/stored key/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/fallback/i)).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 3: Run Settings test to verify it fails**

Run:

```bash
npm test -- 'src/app/(app)/settings/page.test.tsx'
```

Expected: FAIL because Settings currently renders API-key input and stored-key controls.

- [ ] **Step 4: Rewrite Settings page without API-key state**

Replace `src/app/(app)/settings/page.tsx` with:

```tsx
'use client'

import { useLocalUser } from '@/hooks/useLocalUser'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

const WAVESPEED_SETUP_URL = 'https://wavespeed.ai/accesskey'

export default function SettingsPage() {
    const { user } = useLocalUser()

    return (
        <div className="mx-auto max-w-7xl p-6 md:p-10">
            <header className="mb-10">
                <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-black uppercase leading-none tracking-[-0.06em]">
                    Settings <span className="text-[var(--neo-accent-cyan)]">_Terminal</span>
                </h1>
                <p className="mt-4 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-black/55">
                    Local workspace identity and WaveSpeed environment setup.
                </p>
            </header>

            <div className="grid gap-6 md:grid-cols-12">
                <NeoCard className="md:col-span-5" noHover>
                    <div className="mb-8 flex items-start justify-between gap-6">
                        <div>
                            <NeoTag tone="lime">LOCAL_PROFILE</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Workspace Identity</h2>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] shadow-[var(--neo-shadow-button)]">
                            <Icon name="user" size={26} />
                        </div>
                    </div>

                    <div className="grid gap-6">
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Display name</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm uppercase">
                                {user?.name || 'Local Creator'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Contact uplink</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm">
                                {user?.email || 'local@panelmint.dev'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Render mode</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-lime)] px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                Single local WaveSpeed mode
                            </div>
                        </div>
                    </div>
                </NeoCard>

                <NeoCard className="bg-[var(--neo-bg-panel)] md:col-span-7" noHover>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <NeoTag tone="cyan">WaveSpeed AI</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Environment Provider</h2>
                            <p className="mt-3 max-w-2xl text-sm text-black/70">
                                PanelMint reads the WaveSpeed key from <code className="font-mono">WAVESPEED_API_KEY</code> in <code className="font-mono">.env</code>. The app does not store provider keys in the database.
                            </p>
                        </div>
                        <NeoTag tone="lime">.env only</NeoTag>
                    </div>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">LLM protocol</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                Seed 1.6 Flash
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Image protocol</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                FLUX Kontext Pro Multi
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Required env</p>
                            <p className="mt-3 break-all font-mono text-sm">WAVESPEED_API_KEY</p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Health check</p>
                            <p className="mt-3 font-mono text-sm">/api/health</p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] px-4 py-4 md:col-span-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">WaveSpeed account</p>
                            <p className="mt-3 text-sm text-black/80">
                                Generate a WaveSpeed key, set it in <code className="font-mono">.env</code>, and restart the app before generating comics.
                            </p>
                            <a className="mt-3 block break-all font-mono text-sm font-bold underline underline-offset-4" href={WAVESPEED_SETUP_URL} target="_blank" rel="noreferrer">
                                {WAVESPEED_SETUP_URL}
                            </a>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
```

- [ ] **Step 5: Run Settings test**

Run:

```bash
npm test -- 'src/app/(app)/settings/page.test.tsx'
```

Expected: PASS.

- [ ] **Step 6: Commit Settings cleanup**

Run:

```bash
git add 'src/app/(app)/settings/page.tsx' 'src/app/(app)/settings/page.test.tsx'
git commit -m "refactor: remove settings api key management"
```

---

### Task 5: Delete DB-Stored API-Key Route And Encryption Helpers

**Files:**

- Modify: `src/lib/local-user.ts`
- Delete: `src/app/api/user/api-key/route.ts`
- Delete: `src/app/api/user/api-key/route.test.ts`
- Delete: `src/lib/validators/user.ts`
- Delete: `src/lib/crypto.ts`
- Delete: `src/lib/__tests__/crypto.test.ts`
- Delete: `scripts/migrate-encrypt-api-keys.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "getLocalUserApiKey", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "setLocalUserApiKey", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "hasApiKey", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: `getLocalUserApiKey` and `setLocalUserApiKey` should only affect `/api/user/api-key`. If `hasApiKey` has no callers after Task 1, remove it with `api-config` cleanup already done.

- [ ] **Step 2: Remove local-user API-key helpers**

In `src/lib/local-user.ts`, remove this import:

```ts
import { decrypt, encrypt, isEncrypted } from './crypto'
```

Delete these functions:

```ts
export async function getLocalUserApiKey(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
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

export async function setLocalUserApiKey(userId: string, apiKey: string | null, provider?: string) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            apiKey: apiKey ? encrypt(apiKey) : null,
            apiProvider: provider ?? null,
        },
    })
}
```

Do not modify the local owner, ownership, or preferences helpers.

- [ ] **Step 3: Delete dead API-key storage files**

Run:

```bash
rm src/app/api/user/api-key/route.ts
rm src/app/api/user/api-key/route.test.ts
rm src/lib/validators/user.ts
rm src/lib/crypto.ts
rm src/lib/__tests__/crypto.test.ts
rm scripts/migrate-encrypt-api-keys.ts
```

- [ ] **Step 4: Run dead-reference scan**

Run:

```bash
rg -n "getLocalUserApiKey|setLocalUserApiKey|apiKeyRequestSchema|validApiProviders|from './crypto'|from '@/lib/crypto'|migrate-encrypt-api-keys|/api/user/api-key" src scripts
```

Expected: no matches.

- [ ] **Step 5: Run focused local-user tests**

Run:

```bash
npm test -- src/lib/__tests__/local-user.test.ts src/app/api/local-user/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API-key storage deletion**

Run:

```bash
git add src/lib/local-user.ts
git add -u src/app/api/user/api-key src/lib/validators/user.ts src/lib/crypto.ts src/lib/__tests__/crypto.test.ts scripts/migrate-encrypt-api-keys.ts
git commit -m "refactor: delete stored provider key flow"
```

---

### Task 6: Remove Provider Key Schema, Docs, And Run Final Verification

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `prisma/postgres-baseline.sql`
- Modify: `prisma/migrations/20260330104038_init/migration.sql`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "User", direction: "upstream", includeTests: true, maxDepth: 2 })
```

Expected: GitNexus may not resolve Prisma models cleanly. If it returns candidates or not found, record that and continue with schema-file cleanup.

- [ ] **Step 2: Remove provider key fields from Prisma schema**

In `prisma/schema.prisma`, remove these fields from `model User`:

```prisma
  apiKey       String?       @db.Text
  apiProvider  String?
```

- [ ] **Step 3: Remove provider key columns from fresh schema SQL**

In both `prisma/postgres-baseline.sql` and `prisma/migrations/20260330104038_init/migration.sql`, remove these lines from `CREATE TABLE "users"`:

```sql
    "apiKey" TEXT,
    "apiProvider" TEXT,
```

- [ ] **Step 4: Update `.env.example`**

Remove this block:

```dotenv
# App security
ENCRYPTION_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGINS=http://localhost:3000
```

Replace it with:

```dotenv
# App security
ALLOWED_ORIGINS=http://localhost:3000
```

Replace:

```dotenv
# Platform-managed AI provider key
# This repo's target contract is WaveSpeed for both LLM and image generation.
WAVESPEED_API_KEY=
```

with:

```dotenv
# WaveSpeed BYOK provider key
# Required for local generation. Get a key from https://wavespeed.ai/accesskey.
WAVESPEED_API_KEY=
```

- [ ] **Step 5: Update README env copy**

In `README.md`, remove the `ENCRYPTION_SECRET` row from required env vars.

Change the `WAVESPEED_API_KEY` row to:

```markdown
| `WAVESPEED_API_KEY` | Yes for generation | Your WaveSpeed API key from `.env`; used for both LLM and image generation. |
```

In the key setup table, remove the `ENCRYPTION_SECRET` row.

Change the `WAVESPEED_API_KEY` setup row to:

```markdown
| `WAVESPEED_API_KEY` | WaveSpeed -> API Keys | Generate one key and paste it into `.env`. PanelMint does not store provider keys in the database. |
```

Replace any remaining `platform-managed key` wording with:

```markdown
local WaveSpeed key from `WAVESPEED_API_KEY`
```

- [ ] **Step 6: Format and validate Prisma**

Run:

```bash
npx prisma format
npx prisma validate
```

Expected: both pass.

- [ ] **Step 7: Run final active-path scan**

Run:

```bash
rg -n "apiKey|apiProvider|getLocalUserApiKey|setLocalUserApiKey|/api/user/api-key|ENCRYPTION_SECRET|encrypt\\(|decrypt\\(|isEncrypted|migrate-encrypt-api-keys|Advanced API|stored key|platform-managed|fallback key" src prisma scripts README.md .env.example package.json
```

Expected: the first scan may still show `apiKey` where it is the in-memory `ProviderConfig.apiKey` field or a local request-header variable for WaveSpeed calls. Every other term in the scan must have no match. Then run this stricter DB-storage scan:

```bash
rg -n "apiProvider|getLocalUserApiKey|setLocalUserApiKey|/api/user/api-key|ENCRYPTION_SECRET|encrypt\\(|decrypt\\(|isEncrypted|migrate-encrypt-api-keys|Advanced API|stored key|platform-managed|fallback key" src prisma scripts README.md .env.example package.json
```

Expected: no matches.

- [ ] **Step 8: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 9: Run GitNexus change detection before committing**

Run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "all" })
```

Expected: affected scope is provider config, health/env validation, Settings provider UI, local-user API-key helpers, Prisma schema, and related tests/docs. If unrelated execution flows appear, inspect before committing.

- [ ] **Step 10: Commit final schema/docs cleanup**

Run:

```bash
git add prisma/schema.prisma prisma/postgres-baseline.sql prisma/migrations/20260330104038_init/migration.sql .env.example README.md
git commit -m "refactor: remove provider key schema"
```

---

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npx prisma validate` passes.
- [ ] `/api/health` reports missing `WAVESPEED_API_KEY` as degraded/503 without startup crashes.
- [ ] Settings contains no API-key input, validation button, remove button, stored-key status, platform fallback copy, or `/api/user/api-key` fetch.
- [ ] `src/lib/api-config.ts` has no Prisma or crypto imports.
- [ ] `src/lib/local-user.ts` has no API-key helper functions.
- [ ] `prisma/schema.prisma`, `prisma/postgres-baseline.sql`, and `prisma/migrations/20260330104038_init/migration.sql` do not contain `apiKey` or `apiProvider`.
- [ ] GitNexus `detect_changes({ scope: "all" })` matches the Phase 4 provider simplification scope.
