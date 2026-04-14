/**
 * LLM wrapper for WaveSpeed.
 *
 * Text generation uses the official WaveSpeed "any-llm" endpoint with a
 * WaveSpeed API key. If no providerConfig is passed, the platform-managed key
 * is used.
 */

import type { ProviderConfig } from '@/lib/api-config'
import { logUsage } from '@/lib/usage'

const WAVESPEED_ANY_LLM_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/any-llm'
const WAVESPEED_POLL_URL = 'https://api.wavespeed.ai/api/v3/predictions'
const THROUGHPUT_TOKEN_THRESHOLD = 12_000
const LATENCY_POLL_TIMEOUT_MS = 2 * 60_000
const THROUGHPUT_POLL_TIMEOUT_MS = 10 * 60_000
const POLL_INITIAL_DELAY_MS = 1_000
const POLL_MAX_DELAY_MS = 5_000

type WaveSpeedPriority = 'latency' | 'throughput'

export async function callLLM(
    prompt: string,
    options?: {
        model?: string
        systemPrompt?: string
        maxTokens?: number
        temperature?: number
        providerConfig?: ProviderConfig
        priority?: WaveSpeedPriority
        pollTimeoutMs?: number
    }
): Promise<string> {
    const providerConfig = options?.providerConfig ?? getPlatformProviderConfig()
    return callLLMWaveSpeed(prompt, {
        ...options,
        providerConfig,
    })
}

function getPlatformProviderConfig(): ProviderConfig {
    const apiKey = process.env.WAVESPEED_API_KEY?.trim()
    if (!apiKey) {
        throw new Error('WAVESPEED_API_KEY is required for LLM generation.')
    }

    return {
        provider: 'wavespeed',
        apiKey,
        llmModel: process.env.LLM_MODEL?.trim() || 'bytedance-seed/seed-1.6-flash',
        imageModel: process.env.IMAGE_MODEL?.trim() || 'wavespeed-ai/flux-kontext-pro/multi',
        baseUrl: 'https://api.wavespeed.ai/api/v3',
    }
}

async function callLLMWaveSpeed(
    prompt: string,
    options: {
        model?: string
        systemPrompt?: string
        maxTokens?: number
        temperature?: number
        providerConfig?: ProviderConfig
        priority?: WaveSpeedPriority
        pollTimeoutMs?: number
    }
): Promise<string> {
    const config = options.providerConfig!
    const model = options.model ?? config.llmModel
    const maxTokens = options.maxTokens ?? 8192
    const priority = options.priority
        ?? (maxTokens >= THROUGHPUT_TOKEN_THRESHOLD ? 'throughput' : 'latency')
    const pollTimeoutMs = options.pollTimeoutMs
        ?? (priority === 'throughput' ? THROUGHPUT_POLL_TIMEOUT_MS : LATENCY_POLL_TIMEOUT_MS)
    console.log(`[LLM] wavespeed/${model} (${prompt.length} chars)`)

    const res = await fetch(WAVESPEED_ANY_LLM_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            system_prompt: options.systemPrompt,
            model,
            temperature: options.temperature ?? 0.7,
            max_tokens: maxTokens,
            priority,
            reasoning: false,
            enable_sync_mode: false,
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`LLM API error (wavespeed, ${res.status}): ${err.slice(0, 300)}`)
    }

    const data = await res.json() as {
        data?: {
            id?: string
            status?: string
            error?: string
            outputs?: unknown[]
        }
    }

    const taskId = data.data?.id
    if (!taskId) {
        throw new Error(`LLM API error (wavespeed): missing task id in response ${JSON.stringify(data).slice(0, 300)}`)
    }

    const text = await pollWaveSpeedTextResult(config.apiKey, taskId, {
        timeoutMs: pollTimeoutMs,
    })
    console.log(`[LLM] Response: ${text.length} chars`)

    if (config.userId) {
        logUsage({
            userId: config.userId,
            type: 'llm_call',
            model,
            tokens: prompt.length + text.length,
        })
    }

    return text
}

async function pollWaveSpeedTextResult(
    apiKey: string,
    taskId: string,
    options: { timeoutMs: number },
): Promise<string> {
    const startedAt = Date.now()
    let attempt = 0
    let delayMs = POLL_INITIAL_DELAY_MS
    let lastStatus = 'created'

    while (Date.now() - startedAt <= options.timeoutMs) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
            delayMs = Math.min(delayMs + 500, POLL_MAX_DELAY_MS)
        }
        attempt += 1

        const res = await fetch(`${WAVESPEED_POLL_URL}/${taskId}/result`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(`LLM result polling failed (${res.status}): ${err.slice(0, 300)}`)
        }

        const data = await res.json() as {
            data?: {
                status?: string
                outputs?: unknown[]
                output?: unknown
                text?: string
                response?: string
                error?: string
            }
        }

        const status = data.data?.status
        if (status && status !== lastStatus) {
            lastStatus = status
            console.log(`[LLM] Task ${taskId} status=${status} after ${Date.now() - startedAt}ms`)
        }
        if (status === 'completed') {
            const directText = extractTextOutput(data.data)
            if (!directText) {
                throw new Error(`LLM completed but returned no text output: ${JSON.stringify(data).slice(0, 300)}`)
            }
            return directText
        }

        if (status === 'failed') {
            throw new Error(`LLM task failed: ${data.data?.error || 'Unknown error'}`)
        }
    }

    throw new Error(
        `LLM task timed out after ${options.timeoutMs}ms while waiting for WaveSpeed result (last status: ${lastStatus}, taskId: ${taskId}).`,
    )
}

function extractTextOutput(data?: {
    outputs?: unknown[]
    output?: unknown
    text?: string
    response?: string
}): string | null {
    if (!data) return null
    if (typeof data.text === 'string' && data.text.trim()) return data.text.trim()
    if (typeof data.response === 'string' && data.response.trim()) return data.response.trim()
    if (typeof data.output === 'string' && data.output.trim()) return data.output.trim()
    if (Array.isArray(data.outputs)) {
        for (const output of data.outputs) {
            if (typeof output === 'string' && output.trim()) return output.trim()
            if (output && typeof output === 'object') {
                const record = output as Record<string, unknown>
                for (const key of ['text', 'content', 'output', 'response']) {
                    const value = record[key]
                    if (typeof value === 'string' && value.trim()) return value.trim()
                }
            }
        }
    }
    return null
}
