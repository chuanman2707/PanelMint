import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getProviderConfig: vi.fn(),
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

import { callLLM } from '@/lib/ai/llm'

describe('callLLM WaveSpeed polling', () => {
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

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('uses shared provider config when no explicit config is passed', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

    it('keeps polling long-running storyboard jobs beyond 60 seconds and uses throughput priority', async () => {
        let pollCount = 0
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url.includes('/wavespeed-ai/any-llm')) {
                return new Response(JSON.stringify({
                    data: { id: 'task-storyboard' },
                }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            pollCount += 1

            if (pollCount < 70) {
                return new Response(JSON.stringify({
                    data: { status: 'processing' },
                }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            return new Response(JSON.stringify({
                data: {
                    status: 'completed',
                    output: 'Storyboard ready',
                },
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        const resultPromise = callLLM('Render a long storyboard', {
            maxTokens: 16_384,
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        await vi.runAllTimersAsync()

        await expect(resultPromise).resolves.toBe('Storyboard ready')
        expect(mocks.getProviderConfig).not.toHaveBeenCalled()

        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
            priority?: string
        }

        expect(submitBody.priority).toBe('throughput')
        expect(pollCount).toBeGreaterThanOrEqual(70)
    })
})
