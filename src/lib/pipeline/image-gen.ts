import { PROMPTS, getArtStylePrompt } from '@/lib/ai/prompts'
import { imageRateLimiter } from '@/lib/utils/rate-limiter'
import { buildStorageKey, buildStorageProxyUrl, getStorage } from '@/lib/storage'
import type { ProviderConfig } from '@/lib/api-config'

// ─── Types ──────────────────────────────────────────────

export interface PanelImageInput {
    panelId: string
    description: string
    characters: string[]
    shotType: string
    location: string
    sourceExcerpt?: string | null
    mustKeep?: string[]
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

export interface StoredImageAsset {
    imageUrl: string
    storageKey: string | null
}

// ─── Constants ──────────────────────────────────────────

const MAX_PROMPT_CHARS = 1500
const WAVESPEED_MAX_RETRIES = 3
const WAVESPEED_BASE_DELAY_MS = 3_000
// Image polling runs inside a local worker lock, so it must resolve
// comfortably before stale-job reclaim can retry the same panel.
export const WAVESPEED_IMAGE_POLL_TIMEOUT_MS = 210_000
const WAVESPEED_POLL_INITIAL_DELAY_MS = 2_000
const WAVESPEED_POLL_MAX_DELAY_MS = 10_000
const WAVESPEED_POLL_LOG_INTERVAL_MS = 60_000
const WAVESPEED_TEXT_TO_IMAGE_FALLBACK_MODEL = 'bytedance/seedream-v4'

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

export class WaveSpeedTimeoutError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaveSpeedTimeoutError'
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

function trimSectionToBudget(
    value: string | null | undefined,
    maxChars: number,
    fallback: string,
    label: string,
): string {
    const normalized = value?.trim() || fallback
    if (normalized.length <= maxChars) return normalized
    console.warn(`[ImageGen] ${label} too long (${normalized.length} chars), trimming to ${maxChars}`)
    return normalized.slice(0, maxChars - 3) + '...'
}

function buildDeterministicPrompt(
    stylePrompt: string,
    sceneContext: string,
    charContext: string,
    enrichedPanelBlocks: string,
): string {
    return [
        `Art style: ${stylePrompt}.`,
        sceneContext,
        enrichedPanelBlocks,
        `Character canon: ${charContext}`,
    ].join('\n')
}

function resolveWaveSpeedImageStrategy(input: PanelImageInput): {
    model: string
    referenceImages?: string[]
} {
    const referenceImages = input.referenceImages?.filter(Boolean)
    if (referenceImages?.length) {
        return {
            model: input.providerConfig.imageModel,
            referenceImages,
        }
    }

    return {
        model: input.providerConfig.imageFallbackModel ?? WAVESPEED_TEXT_TO_IMAGE_FALLBACK_MODEL,
    }
}

// ─── Main Export ────────────────────────────────────────

/**
 * Generate a single panel image. This is the ONLY entry point for image generation.
 * Page-level generation is removed — each panel = 1 image (webtoon format).
 */
export async function generatePanelImage(input: PanelImageInput): Promise<StoredImageAsset> {
    const imagePrompt = await buildSinglePanelPrompt(input)
    await imageRateLimiter.acquire()

    const { provider } = input.providerConfig
    const strategy = resolveWaveSpeedImageStrategy(input)
    console.log(`[ImageGen] Provider: ${provider} | Panel: ${input.panelId}`)

    if (provider !== 'wavespeed') {
        throw new Error(`Unsupported image provider: ${provider}`)
    }

    const url = await generateImageWavespeed(
        input.panelId,
        strategy.model,
        imagePrompt,
        input.providerConfig,
        strategy.referenceImages,
        input.userId,
        input.episodeId,
    )

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
        shotType, location, sourceExcerpt, mustKeep,
        characterCanon, mood, lighting,
    } = input

    const stylePrompt = trimSectionToBudget(getArtStylePrompt(artStyle), 600, 'manga illustration', 'art style')
    const charContext = trimSectionToBudget(
        characterCanon || characterDescriptions || characters.join(', '),
        1_200,
        'No recurring characters in this panel.',
        'character canon',
    )
    const sceneContext = [
        `Shot type: ${trimSectionToBudget(shotType, 80, 'medium', 'shot type')}`,
        `Location: ${trimSectionToBudget(location, 200, 'unspecified', 'location')}`,
        `Mood: ${trimSectionToBudget(mood, 120, 'neutral', 'mood')}`,
        `Lighting: ${trimSectionToBudget(lighting, 160, 'natural', 'lighting')}`,
    ].join('\n')
    const enrichedPanelBlocks = [
        `Source excerpt: ${trimSectionToBudget(
            sourceExcerpt,
            1_000,
            'No source excerpt provided. Stay conservative and grounded in the scene description.',
            'source excerpt',
        )}`,
        `Must keep: ${trimSectionToBudget(
            mustKeep?.length ? mustKeep.join('; ') : null,
            400,
            'No explicit must-keep constraints provided.',
            'must-keep constraints',
        )}`,
        `Description: ${trimSectionToBudget(description, 1_200, 'No panel description provided.', 'panel description')}`,
        `Visible characters: ${trimSectionToBudget(
            characters.length ? characters.join(', ') : null,
            240,
            'None',
            'visible characters',
        )}`,
    ].join('\n')

    const promptBudget = MAX_PROMPT_CHARS - NO_TEXT_RULE.length - 2
    const deterministicPrompt = buildDeterministicPrompt(
        stylePrompt,
        sceneContext,
        charContext,
        enrichedPanelBlocks,
    )
    const trimmedPrompt = trimPromptToBudget(deterministicPrompt, promptBudget)
    const finalPrompt = `${trimmedPrompt}\n\n${NO_TEXT_RULE}`
    console.log(`[ImageGen] Panel prompt: ${finalPrompt.slice(0, 150)}...`)
    return finalPrompt
}

// ─── wavespeed.ai Image Generation ──────────────────────
// Async API: submit task → poll for result

async function generateImageWavespeed(
    panelId: string,
    model: string,
    prompt: string,
    config: ProviderConfig,
    referenceImages?: string[],
    userId?: string,
    episodeId?: string,
): Promise<StoredImageAsset> {
    console.log(`[ImageGen] wavespeed.ai model: ${model} (refs: ${referenceImages?.length ?? 0})`)

    for (let attempt = 1; attempt <= WAVESPEED_MAX_RETRIES; attempt++) {
        try {
            const taskId = await submitWavespeedTask(config, model, prompt, referenceImages)
            const outputUrl = await pollWavespeedResult(config, taskId)
            return downloadAndSave(panelId, outputUrl, userId, episodeId)
        } catch (err) {
            if (err instanceof ContentFilterError) throw err
            if (err instanceof ServiceError) throw err
            if (err instanceof WaveSpeedTimeoutError) throw err

            const isRetryable = attempt < WAVESPEED_MAX_RETRIES
            if (isRetryable) {
                const delay = WAVESPEED_BASE_DELAY_MS * Math.pow(2, attempt - 1)
                console.warn(`[ImageGen] wavespeed.ai attempt ${attempt} failed, retrying in ${delay / 1000}s:`, err)
                await sleep(delay)
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
        console.error('[ImageGen] wavespeed.ai auth error - check WAVESPEED_API_KEY in .env')
        throw new ServiceError('WaveSpeed rejected WAVESPEED_API_KEY. Check the key in .env and restart the app.')
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
    const startedAt = Date.now()
    let attempt = 0
    let delayMs = WAVESPEED_POLL_INITIAL_DELAY_MS
    let lastStatus = 'created'
    let lastProgressLogAt = startedAt

    while (Date.now() - startedAt <= WAVESPEED_IMAGE_POLL_TIMEOUT_MS) {
        if (attempt > 0) {
            await sleep(delayMs)
            delayMs = Math.min(delayMs + 1_000, WAVESPEED_POLL_MAX_DELAY_MS)
        }
        attempt += 1

        let res: Response
        try {
            res = await fetch(resultUrl, {
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
            })
        } catch (error) {
            console.warn(`[ImageGen] wavespeed.ai poll network error for task ${taskId}, retrying...`, error)
            continue
        }

        if (!res.ok) {
            console.warn(`[ImageGen] wavespeed.ai poll error (${res.status}) for task ${taskId}, retrying...`)
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
        if (status && status !== lastStatus) {
            lastStatus = status
            console.log(`[ImageGen] wavespeed.ai task ${taskId} status=${status} after ${Date.now() - startedAt}ms`)
        }

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

        if (Date.now() - lastProgressLogAt >= WAVESPEED_POLL_LOG_INTERVAL_MS) {
            console.log(`[ImageGen] wavespeed.ai task ${taskId} still ${status || 'processing'} after ${Date.now() - startedAt}ms (${attempt} polls)`)
            lastProgressLogAt = Date.now()
        }
    }

    throw new WaveSpeedTimeoutError(
        `wavespeed.ai task timed out after ${WAVESPEED_IMAGE_POLL_TIMEOUT_MS}ms while waiting for result (last status: ${lastStatus}, taskId: ${taskId})`,
    )
}

// ─── File Storage Helpers ───────────────────────────────
// Uses StorageProvider (R2 in production, local in dev)

async function downloadAndSave(panelId: string, sourceImageUrl: string, userId?: string, episodeId?: string): Promise<StoredImageAsset> {
    const res = await fetch(sourceImageUrl)
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const key = userId && episodeId
        ? buildStorageKey(userId, episodeId, panelId)
        : `${panelId}.png`
    const storage = getStorage()
    const storedValue = await storage.upload(buffer, key)
    const persistedImageUrl = storedValue.startsWith('http://') || storedValue.startsWith('https://') || storedValue.startsWith('/')
        ? storedValue
        : buildStorageProxyUrl(key)
    console.log(`[ImageGen] Saved: ${key}`)
    return {
        imageUrl: persistedImageUrl,
        storageKey: key,
    }
}
