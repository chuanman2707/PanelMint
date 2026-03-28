import { callLLM } from '@/lib/ai/llm'
import { getArtStylePrompt } from '@/lib/ai/prompts'
import { imageRateLimiter } from '@/lib/utils/rate-limiter'
import { getStorage, buildStorageKey } from '@/lib/storage'
import type { ProviderConfig } from '@/lib/api-config'
import { logUsage } from '@/lib/usage'

// ─── Types ──────────────────────────────────────────────

export interface PanelImageInput {
    panelId: string
    description: string
    characters: string[]
    shotType: string
    location: string
    artStyle: string
    characterDescriptions?: string
    /** Character identity anchors as structured JSON context */
    characterCanon?: string
    /** Reference images (character sheets) for consistency */
    referenceImages?: string[]
    /** Scene mood/lighting context */
    mood?: string
    lighting?: string
    providerConfig: ProviderConfig
    userId?: string
    episodeId?: string
}

// ─── Constants ──────────────────────────────────────────

const MAX_PROMPT_CHARS = 1500
const WAVESPEED_MAX_RETRIES = 3
const WAVESPEED_BASE_DELAY_MS = 3_000
const WAVESPEED_POLL_INTERVAL_MS = 2_000
const WAVESPEED_POLL_MAX_ATTEMPTS = 60 // 2min max poll

/** Webtoon portrait dimensions */
const WEBTOON_WIDTH = 1024
const WEBTOON_HEIGHT = 1536

/** NO TEXT enforcement rule — injected into every image prompt */
const NO_TEXT_RULE = 'Generate ONLY the visual scene. Do NOT include any text, speech bubbles, captions, sound effects, or written words in the image. The image must contain ONLY visual elements.'

// ─── Errors ─────────────────────────────────────────────

export class ContentFilterError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ContentFilterError'
    }
}

export class ServiceError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ServiceError'
    }
}

// ─── Helpers ────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function trimPromptToBudget(prompt: string, maxChars: number = MAX_PROMPT_CHARS): string {
    if (prompt.length <= maxChars) return prompt
    console.warn(`[ImageGen] Prompt too long (${prompt.length} chars), trimming to ${maxChars}`)
    return prompt.slice(0, maxChars - 3) + '...'
}

// ─── Main Export ────────────────────────────────────────

/**
 * Generate a single panel image. This is the ONLY entry point for image generation.
 * Page-level generation is removed — each panel = 1 image (webtoon format).
 */
export async function generatePanelImage(input: PanelImageInput): Promise<string> {
    const imagePrompt = await buildSinglePanelPrompt(input)
    const trimmedPrompt = trimPromptToBudget(imagePrompt)
    await imageRateLimiter.acquire()

    const { provider } = input.providerConfig
    console.log(`[ImageGen] Provider: ${provider} | Panel: ${input.panelId}`)

    let url: string

    if (provider === 'wavespeed') {
        url = await generateImageWavespeed(
            input.panelId,
            trimmedPrompt,
            input.providerConfig,
            input.referenceImages,
            input.userId,
            input.episodeId,
        )
    } else {
        // Legacy providers (BYOK backward compat)
        url = await generateImageLegacy(input.panelId, trimmedPrompt, input.providerConfig, input.userId, input.episodeId)
    }

    // Log usage after successful image generation
    if (input.userId) {
        logUsage({
            userId: input.userId,
            type: 'image_gen',
            model: input.providerConfig.imageModel,
            metadata: JSON.stringify({ panelId: input.panelId }),
        })
    }

    return url
}

// ─── Prompt Builder ─────────────────────────────────────

/**
 * Build structured prompt for a single panel.
 * Injects character identity anchors, scene context, and NO TEXT enforcement.
 */
async function buildSinglePanelPrompt(input: PanelImageInput): Promise<string> {
    const {
        description, artStyle, characterDescriptions, characters,
        shotType, location, characterCanon, mood, lighting,
    } = input

    const charContext = characterCanon || characterDescriptions || characters.join(', ')

    const prompt = `Create a single webtoon panel image.
Style: ${getArtStylePrompt(artStyle)}
Shot type: ${shotType}
Scene: ${description}
Characters: ${charContext}
Location: ${location}
Mood: ${mood || 'neutral'}
Lighting: ${lighting || 'natural'}

CRITICAL RULES:
1. ${NO_TEXT_RULE}
2. Maintain EXACT character appearances from identity anchors — same hair, eyes, clothing, build.
3. Use portrait orientation (tall, vertical format suitable for webtoon vertical scrolling).
4. Include character poses, expressions, environment details matching the mood and lighting.

Output ONLY the prompt text for the image generation model.`

    const result = await callLLM(prompt, {
        temperature: 0.6,
        maxTokens: 500,
        providerConfig: input.providerConfig,
    })

    // Append NO TEXT rule to the final prompt to double-enforce
    const finalPrompt = result.trim() + `\n\n${NO_TEXT_RULE}`
    console.log(`[ImageGen] Panel prompt: ${finalPrompt.slice(0, 150)}...`)
    return finalPrompt
}

// ─── wavespeed.ai Image Generation ──────────────────────
// Async API: submit task → poll for result

async function generateImageWavespeed(
    panelId: string,
    prompt: string,
    config: ProviderConfig,
    referenceImages?: string[],
    userId?: string,
    episodeId?: string,
): Promise<string> {
    const hasRefs = referenceImages && referenceImages.length > 0
    // Use multi-ref model when we have reference images, otherwise text-to-image
    const model = hasRefs
        ? config.imageModel // flux-kontext-pro/multi
        : (config.imageFallbackModel || 'bytedance/seedream-v4')

    console.log(`[ImageGen] wavespeed.ai model: ${model} (refs: ${referenceImages?.length ?? 0})`)

    for (let attempt = 1; attempt <= WAVESPEED_MAX_RETRIES; attempt++) {
        try {
            const taskId = await submitWavespeedTask(config, model, prompt, referenceImages)
            const outputUrl = await pollWavespeedResult(config, taskId)
            return downloadAndSave(panelId, outputUrl, userId, episodeId)
        } catch (err) {
            if (err instanceof ContentFilterError) throw err
            if (err instanceof ServiceError) throw err

            const isRetryable = attempt < WAVESPEED_MAX_RETRIES
            if (isRetryable) {
                const delay = WAVESPEED_BASE_DELAY_MS * Math.pow(2, attempt - 1)
                console.warn(`[ImageGen] wavespeed.ai attempt ${attempt} failed, retrying in ${delay / 1000}s:`, err)
                await sleep(delay)

                // If FLUX failed, try fallback model
                if (hasRefs && attempt === WAVESPEED_MAX_RETRIES - 1 && config.imageFallbackModel) {
                    console.warn(`[ImageGen] FLUX unavailable, falling back to ${config.imageFallbackModel}`)
                    const taskId = await submitWavespeedTask(config, config.imageFallbackModel, prompt)
                    const outputUrl = await pollWavespeedResult(config, taskId)
                    return downloadAndSave(panelId, outputUrl, userId, episodeId)
                }
                continue
            }

            throw err
        }
    }

    throw new Error('Image gen failed (wavespeed): max retries exceeded')
}

async function submitWavespeedTask(
    config: ProviderConfig,
    model: string,
    prompt: string,
    referenceImages?: string[],
): Promise<string> {
    const url = `${config.baseUrl}/${model}`

    const body: Record<string, unknown> = {
        prompt,
        width: WEBTOON_WIDTH,
        height: WEBTOON_HEIGHT,
    }

    // Multi-ref: pass reference images for character consistency
    if (referenceImages && referenceImages.length > 0) {
        body.images = referenceImages
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (res.status === 401 || res.status === 403) {
        console.error('[ImageGen] wavespeed.ai auth error — bad platform API key')
        throw new ServiceError('Generation service temporarily unavailable. Please try again later.')
    }

    if (res.status === 429) {
        throw new Error(`wavespeed.ai rate limited (429)`)
    }

    if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`wavespeed.ai submit failed (${res.status}): ${errBody.slice(0, 300)}`)
    }

    const data = await res.json() as {
        code: number
        data?: { id?: string }
    }

    const taskId = data.data?.id
    if (!taskId) {
        throw new Error(`wavespeed.ai no task ID in response: ${JSON.stringify(data).slice(0, 300)}`)
    }

    console.log(`[ImageGen] wavespeed.ai task submitted: ${taskId}`)
    return taskId
}

async function pollWavespeedResult(
    config: ProviderConfig,
    taskId: string,
): Promise<string> {
    const resultUrl = `${config.baseUrl}/predictions/${taskId}`

    for (let i = 0; i < WAVESPEED_POLL_MAX_ATTEMPTS; i++) {
        await sleep(WAVESPEED_POLL_INTERVAL_MS)

        const res = await fetch(resultUrl, {
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
        })

        if (!res.ok) {
            console.warn(`[ImageGen] wavespeed.ai poll error (${res.status}), retrying...`)
            continue
        }

        const data = await res.json() as {
            data?: {
                status?: string
                outputs?: string[]
                error?: string
            }
        }

        const status = data.data?.status

        if (status === 'completed') {
            const outputs = data.data?.outputs
            if (!outputs || outputs.length === 0) {
                throw new Error('wavespeed.ai completed but no outputs')
            }
            console.log(`[ImageGen] wavespeed.ai task completed: ${taskId}`)
            return outputs[0]
        }

        if (status === 'failed') {
            const error = data.data?.error || 'Unknown error'
            if (error.toLowerCase().includes('content') || error.toLowerCase().includes('filter') || error.toLowerCase().includes('safety')) {
                throw new ContentFilterError(`Panel blocked by content filter: ${error}`)
            }
            throw new Error(`wavespeed.ai task failed: ${error}`)
        }

        // Still processing
        if (i % 10 === 9) {
            console.log(`[ImageGen] wavespeed.ai still processing (${i + 1} polls)...`)
        }
    }

    throw new Error(`wavespeed.ai task timed out after ${WAVESPEED_POLL_MAX_ATTEMPTS * WAVESPEED_POLL_INTERVAL_MS / 1000}s`)
}

// ─── Legacy Provider (OpenRouter OpenAI-compat) ─────────
// Kept for BYOK backward compatibility

async function generateImageLegacy(
    panelId: string,
    prompt: string,
    config: ProviderConfig,
    userId?: string,
    episodeId?: string,
): Promise<string> {
    const model = config.imageModel
    console.log(`[ImageGen] Legacy ${config.provider}/${model}`)

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
    }
    if (config.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://weoweo.app'
        headers['X-Title'] = 'weoweo'
    }

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            modalities: ['image'],
            max_tokens: 1,
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Image gen failed (${config.provider}, ${res.status}): ${err.slice(0, 300)}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const message = data.choices?.[0]?.message
    const content = message?.content
    const images = message?.images as Array<{ image_url?: { url?: string }; b64_json?: string }> | undefined

    if (images?.length) {
        for (const img of images) {
            const url = img.image_url?.url
            if (url) {
                if (url.startsWith('data:image/')) {
                    return saveBase64(panelId, url.split(',')[1], userId, episodeId)
                }
                return downloadAndSave(panelId, url, userId, episodeId)
            }
            if (img.b64_json) {
                return saveBase64(panelId, img.b64_json, userId, episodeId)
            }
        }
    }

    if (content) {
        if (typeof content === 'string') {
            if (content.startsWith('data:image/')) {
                return saveBase64(panelId, content.split(',')[1], userId, episodeId)
            }
            if (content.startsWith('http')) {
                return downloadAndSave(panelId, content, userId, episodeId)
            }
            if (content.length > 1000 && !content.includes(' ')) {
                return saveBase64(panelId, content, userId, episodeId)
            }
        }
        if (Array.isArray(content)) {
            for (const part of content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                    const url = part.image_url.url
                    if (url.startsWith('data:image/')) {
                        return saveBase64(panelId, url.split(',')[1], userId, episodeId)
                    }
                    return downloadAndSave(panelId, url, userId, episodeId)
                }
            }
        }
    }

    const finishReason = data.choices?.[0]?.finish_reason
    if (finishReason === 'content_filter') {
        throw new ContentFilterError('Image blocked by content filter')
    }

    throw new Error(`No image in response from ${config.provider}. Keys: message=${message ? Object.keys(message).join(',') : 'null'}`)
}

// ─── File Storage Helpers ───────────────────────────────
// Uses StorageProvider (R2 in production, local in dev)

async function saveBase64(panelId: string, base64: string, userId?: string, episodeId?: string): Promise<string> {
    const storage = getStorage()
    const buffer = Buffer.from(base64, 'base64')
    const key = userId && episodeId
        ? buildStorageKey(userId, episodeId, panelId)
        : `${panelId}.png`
    const url = await storage.upload(buffer, key)
    console.log(`[ImageGen] Saved: ${key}`)
    return url
}

async function downloadAndSave(panelId: string, imageUrl: string, userId?: string, episodeId?: string): Promise<string> {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const key = userId && episodeId
        ? buildStorageKey(userId, episodeId, panelId)
        : `${panelId}.png`
    const storage = getStorage()
    const url = await storage.upload(buffer, key)
    console.log(`[ImageGen] Saved: ${key}`)
    return url
}
