/**
 * OpenRouter Image Generation via Seedream 4.5
 *
 * Uses OpenRouter's chat completions endpoint with modalities: ["image"]
 * to generate images via ByteDance Seedream model.
 *
 * Env vars:
 *   OPENROUTER_API_KEY=sk-or-...
 *   IMAGE_MODEL=bytedance-seed/seedream-4.5  (default)
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

interface OpenRouterImageResponse {
    choices?: Array<{
        message?: {
            content?: string | null
            images?: Array<{
                image_url: { url: string }  // data:image/png;base64,...
            }>
        }
    }>
    error?: { message?: string; code?: number }
}

/**
 * Generate an image via OpenRouter using Seedream or other image model.
 * Returns the local file path (relative to /public).
 */
export async function generateImageViaOpenRouter(
    id: string,
    prompt: string,
    options?: {
        model?: string
        aspectRatio?: string
        outputDir?: string  // relative to /public, default 'generated'
    },
): Promise<{ imageUrl: string; imageBase64: string }> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set in .env')

    const model = options?.model ?? process.env.IMAGE_MODEL ?? 'bytedance-seed/seedream-4.5'
    const outputSubDir = options?.outputDir ?? 'generated'

    console.log(`[OpenRouter] Generating image with ${model} (${prompt.length} chars)`)

    const body: Record<string, unknown> = {
        model,
        messages: [
            { role: 'user', content: prompt },
        ],
        modalities: ['image'],
    }

    // Add aspect ratio if supported
    if (options?.aspectRatio) {
        body.image_config = { aspect_ratio: options.aspectRatio }
    }

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://weoweo.app',
            'X-Title': 'WeOweo Comic Generator',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenRouter image gen failed (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as OpenRouterImageResponse

    if (data.error) {
        throw new Error(`OpenRouter error: ${data.error.message ?? JSON.stringify(data.error)}`)
    }

    // Extract base64 image from response
    const imageBase64 = extractBase64FromResponse(data)
    if (!imageBase64) {
        console.error('[OpenRouter] Failed to parse image from response:', JSON.stringify(data).slice(0, 500))
        throw new Error('OpenRouter did not return an image')
    }

    // Save to local file
    const outputDir = join(process.cwd(), 'public', outputSubDir)
    await mkdir(outputDir, { recursive: true })
    const filename = `${id}.png`
    await writeFile(join(outputDir, filename), Buffer.from(imageBase64, 'base64'))
    console.log(`[OpenRouter] Saved image: ${outputSubDir}/${filename}`)

    return {
        imageUrl: `/${outputSubDir}/${filename}`,
        imageBase64,
    }
}

/**
 * Extract base64 image data from OpenRouter response.
 * Format: message.images[].image_url.url = "data:image/png;base64,..."
 */
function extractBase64FromResponse(data: OpenRouterImageResponse): string | null {
    const message = data.choices?.[0]?.message
    if (!message) return null

    // Primary: message.images[] (Seedream, Flux, etc.)
    if (message.images?.length) {
        const img = message.images[0]
        const url = img.image_url?.url
        if (url) {
            // data:image/png;base64,... format
            if (url.startsWith('data:')) {
                const base64Part = url.split(',')[1]
                if (base64Part) return base64Part
            }
            // raw base64 string
            if (url.length > 1000 && !url.startsWith('http')) return url
        }
    }

    // Fallback: content contains inline base64 data URL
    if (message.content && typeof message.content === 'string') {
        if (message.content.startsWith('data:image/')) {
            return message.content.split(',')[1] ?? null
        }
        const match = message.content.match(/data:image\/\w+;base64,([A-Za-z0-9+/=]+)/)
        if (match?.[1]) return match[1]
    }

    return null
}
