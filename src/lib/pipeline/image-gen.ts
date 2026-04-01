import { callLLM } from '@/lib/ai/llm'
import { PROMPTS, getArtStylePrompt } from '@/lib/ai/prompts'
import { imageRateLimiter } from '@/lib/utils/rate-limiter'
import { buildStorageKey, buildStorageProxyUrl, getStorage } from '@/lib/storage'
import type { ProviderConfig } from '@/lib/api-config'
import { logUsage } from '@/lib/usage'

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
const WAVESPEED_LLM_MAX_PROMPT_CHARS = 10_000
const WAVESPEED_LLM_TARGET_PROMPT_CHARS = 9_000
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

function buildPromptFromSections(
    stylePrompt: string,
    sceneContext: string,
    charContext: string,
    enrichedPanelBlocks: string,
): string {
    return PROMPTS.buildPageImagePrompt
        .replace('{style}', stylePrompt)
        .replace('{scene_context}', sceneContext)
        .replace('{character_canon}', charContext)
        .replace('{enriched_panel_blocks}', enrichedPanelBlocks)
}

function buildCompactPrompt(
    stylePrompt: string,
    sceneContext: string,
    charContext: string,
    enrichedPanelBlocks: string,
): string {
    return [
        'Write one concise English prompt for a single webtoon panel image.',
        `Art style: ${stylePrompt}`,
        sceneContext,
        `Character canon:\n${charContext}`,
        `Panel data:\n${enrichedPanelBlocks}`,
        'Return only the final image prompt. Keep it factual, grounded in the source excerpt, and do not include text, captions, speech bubbles, or written words in the image. Max 1500 characters.',
    ].join('\n\n')
}

function ensureLLMPromptBudget(
    stylePrompt: string,
    sceneContext: string,
    charContext: string,
    enrichedPanelBlocks: string,
): string {
    const fullPrompt = buildPromptFromSections(stylePrompt, sceneContext, charContext, enrichedPanelBlocks)
    if (fullPrompt.length <= WAVESPEED_LLM_TARGET_PROMPT_CHARS) {
        return fullPrompt
    }

    console.warn(
        `[ImageGen] LLM image prompt input too long (${fullPrompt.length} chars), switching to compact prompt budget`,
    )

    let compactCharContext = trimSectionToBudget(charContext, 1_600, 'No recurring characters in this panel.', 'character canon')
    let compactPanelBlocks = trimSectionToBudget(
        enrichedPanelBlocks,
        3_800,
        'Description: No panel description provided.',
        'panel data',
    )
    let compactPrompt = buildCompactPrompt(stylePrompt, sceneContext, compactCharContext, compactPanelBlocks)

    if (compactPrompt.length > WAVESPEED_LLM_TARGET_PROMPT_CHARS) {
        const overflow = compactPrompt.length - WAVESPEED_LLM_TARGET_PROMPT_CHARS
        compactPanelBlocks = trimSectionToBudget(
            compactPanelBlocks,
            Math.max(1_200, compactPanelBlocks.length - overflow),
            'Description: No panel description provided.',
            'panel data',
        )
        compactPrompt = buildCompactPrompt(stylePrompt, sceneContext, compactCharContext, compactPanelBlocks)
    }

    if (compactPrompt.length > WAVESPEED_LLM_TARGET_PROMPT_CHARS) {
        const overflow = compactPrompt.length - WAVESPEED_LLM_TARGET_PROMPT_CHARS
        compactCharContext = trimSectionToBudget(
            compactCharContext,
            Math.max(400, compactCharContext.length - overflow),
            'No recurring characters in this panel.',
            'character canon',
        )
        compactPrompt = buildCompactPrompt(stylePrompt, sceneContext, compactCharContext, compactPanelBlocks)
    }

    if (compactPrompt.length > WAVESPEED_LLM_MAX_PROMPT_CHARS) {
        compactPanelBlocks = trimSectionToBudget(
            compactPanelBlocks,
            1_200,
            'Description: No panel description provided.',
            'panel data',
        )
        compactCharContext = trimSectionToBudget(
            compactCharContext,
            400,
            'No recurring characters in this panel.',
            'character canon',
        )
        compactPrompt = buildCompactPrompt(stylePrompt, sceneContext, compactCharContext, compactPanelBlocks)
    }

    return compactPrompt
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
    console.log(`[ImageGen] Provider: ${provider} | Panel: ${input.panelId}`)

    if (provider !== 'wavespeed') {
        throw new Error(`Unsupported image provider: ${provider}`)
    }

    const url = await generateImageWavespeed(
        input.panelId,
        imagePrompt,
        input.providerConfig,
        input.referenceImages,
        input.userId,
        input.episodeId,
    )

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
        shotType, location, sourceExcerpt, mustKeep,
        characterCanon, mood, lighting,
    } = input

    const stylePrompt = trimSectionToBudget(getArtStylePrompt(artStyle), 600, 'manga illustration', 'art style')
    const charContext = trimSectionToBudget(
        characterCanon || characterDescriptions || characters.join(', '),
        3_200,
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
        `Description: ${trimSectionToBudget(description, 3_000, 'No panel description provided.', 'panel description')}`,
        `Source excerpt: ${trimSectionToBudget(
            sourceExcerpt,
            2_400,
            'No source excerpt provided. Stay conservative and grounded in the scene description.',
            'source excerpt',
        )}`,
        `Must keep: ${trimSectionToBudget(
            mustKeep?.length ? mustKeep.join('; ') : null,
            800,
            'No explicit must-keep constraints provided.',
            'must-keep constraints',
        )}`,
        `Visible characters: ${trimSectionToBudget(
            characters.length ? characters.join(', ') : null,
            240,
            'None',
            'visible characters',
        )}`,
    ].join('\n')

    const prompt = ensureLLMPromptBudget(stylePrompt, sceneContext, charContext, enrichedPanelBlocks)

    const result = await callLLM(prompt, {
        temperature: 0.6,
        maxTokens: 500,
        providerConfig: input.providerConfig,
    })

    const promptBudget = MAX_PROMPT_CHARS - NO_TEXT_RULE.length - 2
    const trimmedPrompt = trimPromptToBudget(result.trim(), promptBudget)
    const finalPrompt = `${trimmedPrompt}\n\n${NO_TEXT_RULE}`
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
): Promise<StoredImageAsset> {
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
