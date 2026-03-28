/**
 * LLM wrapper — Multi-provider (OpenAI-compatible)
 *
 * Supports: OpenRouter + NVIDIA NIM (both OpenAI chat/completions format)
 * Falls back to Google Gemini SDK if no provider config (dev mode only).
 */

import type { ProviderConfig } from '@/lib/api-config'
import { withKeyRotation } from '@/lib/utils/key-rotation'
import { GoogleGenAI } from '@google/genai'
import { logUsage } from '@/lib/usage'

export async function callLLM(
    prompt: string,
    options?: {
        model?: string
        systemPrompt?: string
        maxTokens?: number
        temperature?: number
        providerConfig?: ProviderConfig
    }
): Promise<string> {
    // If provider config given, use OpenAI-compat path
    if (options?.providerConfig) {
        return callLLMOpenAI(prompt, options)
    }

    // Dev fallback: use Google Gemini SDK with server key rotation
    return callLLMGemini(prompt, options)
}

/**
 * OpenAI-compatible path (OpenRouter + NVIDIA NIM)
 */
async function callLLMOpenAI(
    prompt: string,
    options: {
        model?: string
        systemPrompt?: string
        maxTokens?: number
        temperature?: number
        providerConfig?: ProviderConfig
    }
): Promise<string> {
    const config = options.providerConfig!
    const model = options.model ?? config.llmModel
    console.log(`[LLM] ${config.provider}/${model} (${prompt.length} chars)`)

    const messages: Array<{ role: string; content: string }> = []
    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const llmKey = config.llmApiKey || config.apiKey
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${llmKey}`,
        'Content-Type': 'application/json',
    }

    // OpenRouter-specific headers (also used by wavespeed for LLM routing)
    if (config.provider === 'openrouter' || config.provider === 'wavespeed') {
        headers['HTTP-Referer'] = 'https://weoweo.app'
        headers['X-Title'] = 'weoweo'
    }

    // Build request body
    const requestMaxTokens = options.maxTokens ?? 8192
    const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: requestMaxTokens,
        temperature: options.temperature ?? 0.7,
    }

    // NVIDIA Nemotron: disable reasoning mode + force non-empty content
    // Per NVIDIA docs, chat_template_kwargs goes directly in the body
    if (config.provider === 'nvidia') {
        body.chat_template_kwargs = {
            enable_thinking: false,
            force_nonempty_content: true,
        }
    }

    // wavespeed baseUrl is for image gen — LLM calls go through OpenRouter
    const llmBaseUrl = config.provider === 'wavespeed'
        ? 'https://openrouter.ai/api/v1'
        : config.baseUrl

    const res = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`LLM API error (${config.provider}, ${res.status}): ${err.slice(0, 300)}`)
    }

    const data = await res.json() as {
        choices?: Array<{ message?: { content?: string | null; reasoning_content?: string; reasoning?: string } }>
    }

    const msg = data.choices?.[0]?.message
    // Nemotron may return content=null with reasoning_content instead
    const text = msg?.content || msg?.reasoning_content || msg?.reasoning || ''
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

/**
 * Google Gemini SDK path (dev/testing fallback only)
 */
async function callLLMGemini(
    prompt: string,
    options?: {
        model?: string
        systemPrompt?: string
        maxTokens?: number
        temperature?: number
    }
): Promise<string> {
    const model = options?.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash'
    console.log(`[LLM] gemini-sdk/${model} (${prompt.length} chars)`)

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
    if (options?.systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: options.systemPrompt }] })
        contents.push({ role: 'model', parts: [{ text: 'Understood.' }] })
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] })

    const text = await withKeyRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: {
                maxOutputTokens: options?.maxTokens ?? 8192,
                temperature: options?.temperature ?? 0.7,
            },
        })
        return response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    })

    console.log(`[LLM] Response: ${text.length} chars`)
    return text
}
