import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callLLM } from '@/lib/ai/llm'

describe('callLLM WaveSpeed polling', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
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
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        await vi.runAllTimersAsync()

        await expect(resultPromise).resolves.toBe('Storyboard ready')

        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
            priority?: string
        }

        expect(submitBody.priority).toBe('throughput')
        expect(pollCount).toBeGreaterThanOrEqual(70)
    })
})
