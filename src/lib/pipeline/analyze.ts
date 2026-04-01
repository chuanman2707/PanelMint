import { callLLM } from '@/lib/ai/llm'
import { PROMPTS } from '@/lib/ai/prompts'
import { safeParseJsonObject, safeParseJsonArray } from '@/lib/utils/json-repair'
import type { ProviderConfig } from '@/lib/api-config'
import {
    MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS,
    MAX_STORYBOARD_CHARACTER_LINE_CHARS,
} from '@/lib/prompt-budget'

// ─── Character Identity Anchor ──────────────────────────

export interface CharacterIdentityAnchor {
    ageRange: string
    gender: string
    bodyBuild: string
    hairSignature: string
    faceSignature: string
    outfitDefault: string
}

export interface AnalyzedCharacter {
    name: string
    aliases: string | null
    description: string
    identityAnchor?: CharacterIdentityAnchor
}

export interface AnalyzedLocation {
    name: string
    description: string
}

// ─── Scene Context ──────────────────────────────────────

export interface PageSceneContext {
    timeOfDay: string
    weather: string
    dominantMood: string
    colorTone: string
    pageRole: string
}

// ─── Panel & Page ───────────────────────────────────────

export interface AnalyzedPanel {
    description: string
    shotType: string
    characters: string[]
    location: string
    sourceExcerpt: string
    mustKeep: string[]
    mood: string
    lighting: string
    /** Dialogue text for this panel — displayed separately, NOT in the image */
    dialogue: string | null
}

export interface AnalyzedPage {
    summary: string
    content: string
    characters: string[]
    location: string
    dialogue: { speaker: string; text: string }[]
    panels: AnalyzedPanel[]
    sceneContext: PageSceneContext
}

export interface StoryAnalysis {
    characters: AnalyzedCharacter[]
    locations: AnalyzedLocation[]
    pages: AnalyzedPage[]
}

const MAX_RETRIES = 3

function wrapStoryText(text: string): string {
    return `<story_text>\n${text}\n</story_text>`
}

function trimWithEllipsis(value: string, maxChars: number): string {
    if (value.length <= maxChars) return value
    return `${value.slice(0, maxChars - 3)}...`
}

function buildStoryboardCharacterContext(characters: AnalyzedCharacter[]): string {
    if (characters.length === 0) return 'None'

    const lines = characters.map((character) =>
        trimWithEllipsis(
            `${character.name}: ${character.description || 'No description'}`,
            MAX_STORYBOARD_CHARACTER_LINE_CHARS,
        ),
    )

    const joined = lines.join('\n')
    if (joined.length <= MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS) {
        return joined
    }

    console.warn(
        `[Pipeline] Storyboard character context too long (${joined.length} chars), trimming to ${MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS}`,
    )

    return trimWithEllipsis(joined, MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS)
}

async function callLLMWithJsonRetry<T>(
    prompt: string,
    parser: (raw: string) => T,
    options: { temperature?: number; maxTokens?: number; providerConfig?: ProviderConfig; systemPrompt?: string },
): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const response = await callLLM(prompt, {
            ...options,
            temperature: (options.temperature ?? 0.3) + (attempt - 1) * 0.1,
            providerConfig: options.providerConfig,
        })

        console.log(`[Pipeline] LLM response (attempt ${attempt}, ${response.length} chars)`)

        try {
            return parser(response)
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            console.warn(`[Pipeline] JSON parse attempt ${attempt} failed: ${lastError.message}`)
            console.warn('[Pipeline] Raw response preview:', response.slice(0, 500))

            if (attempt < MAX_RETRIES) {
                const fixPrompt = `/no_think
The following text was supposed to be valid JSON but it has syntax errors. Fix it and return ONLY the corrected valid JSON, nothing else.

Broken JSON:
${response}`

                const fixed = await callLLM(fixPrompt, { temperature: 0.1, maxTokens: options.maxTokens ?? 4096, providerConfig: options.providerConfig })
                try {
                    return parser(fixed)
                } catch {
                    console.warn('[Pipeline] Fix attempt also failed, retrying from scratch...')
                }
            }
        }
    }

    throw lastError ?? new Error('JSON parse failed after retries')
}

// ── Step 1a: Extract characters + locations (LLM Call 1) ──
export async function analyzeCharactersAndLocations(text: string, providerConfig?: ProviderConfig) {
    console.log('[Pipeline] Step 1a: Extracting characters and locations (with identity anchors)...')

    const analysis = await callLLMWithJsonRetry(
        wrapStoryText(text),
        (raw) => safeParseJsonObject(raw),
        {
            temperature: 0.3,
            maxTokens: 8192,
            providerConfig,
            systemPrompt: PROMPTS.analyzeStory,
        },
    )

    const characters: AnalyzedCharacter[] = (
        (analysis.characters as Record<string, unknown>[]) || []
    ).map((c) => ({
        name: String(c.name || ''),
        aliases: c.aliases ? String(c.aliases) : null,
        description: String(c.description || ''),
        identityAnchor: c.identityAnchor
            ? {
                ageRange: String((c.identityAnchor as Record<string, unknown>).ageRange || ''),
                gender: String((c.identityAnchor as Record<string, unknown>).gender || ''),
                bodyBuild: String((c.identityAnchor as Record<string, unknown>).bodyBuild || ''),
                hairSignature: String((c.identityAnchor as Record<string, unknown>).hairSignature || ''),
                faceSignature: String((c.identityAnchor as Record<string, unknown>).faceSignature || ''),
                outfitDefault: String((c.identityAnchor as Record<string, unknown>).outfitDefault || ''),
            }
            : undefined,
    }))

    const locations: AnalyzedLocation[] = (
        (analysis.locations as Record<string, unknown>[]) || []
    ).map((l) => ({
        name: String(l.name || ''),
        description: String(l.description || ''),
    }))

    console.log(`[Pipeline] Found ${characters.length} characters, ${locations.length} locations`)
    return { characters, locations }
}

// ── Step 2: Split into pages WITH enriched panel descriptions (LLM Call 2) ──
export async function splitIntoPagesWithPanels(
    text: string,
    characters: AnalyzedCharacter[],
    pageCount: number,
    providerConfig?: ProviderConfig,
): Promise<AnalyzedPage[]> {
    console.log(`[Pipeline] Step 2: Splitting into ${pageCount} pages with enriched panels...`)

    const characterNames = buildStoryboardCharacterContext(characters)
    const systemPrompt = PROMPTS.splitToPagesWithPanels
        .replace(/{page_count}/g, String(pageCount))
        .replace('{characters}', characterNames)

    const rawPages = await callLLMWithJsonRetry(
        wrapStoryText(text),
        (raw) => safeParseJsonArray(raw, 'pages'),
        {
            temperature: 0.4,
            maxTokens: 16384,
            providerConfig,
            systemPrompt,
        },
    )

    const pages: AnalyzedPage[] = rawPages.map((raw: Record<string, unknown>) => ({
        summary: String(raw.summary || ''),
        content: String(raw.content || ''),
        characters: Array.isArray(raw.characters) ? raw.characters.map(String) : [],
        location: String(raw.location || ''),
        dialogue: Array.isArray(raw.dialogue)
            ? raw.dialogue.map((d: Record<string, unknown>) => ({
                speaker: String(d.speaker || ''),
                text: String(d.text || ''),
            }))
            : [],
        sceneContext: raw.sceneContext
            ? {
                timeOfDay: String((raw.sceneContext as Record<string, unknown>).timeOfDay || 'day'),
                weather: String((raw.sceneContext as Record<string, unknown>).weather || 'clear'),
                dominantMood: String((raw.sceneContext as Record<string, unknown>).dominantMood || 'neutral'),
                colorTone: String((raw.sceneContext as Record<string, unknown>).colorTone || 'natural'),
                pageRole: String((raw.sceneContext as Record<string, unknown>).pageRole || 'setup'),
            }
            : { timeOfDay: 'day', weather: 'clear', dominantMood: 'neutral', colorTone: 'natural', pageRole: 'setup' },
        panels: Array.isArray(raw.panels)
            ? raw.panels.map((p: Record<string, unknown>) => ({
                description: String(p.description || ''),
                shotType: String(p.shotType || p.shot_type || 'medium'),
                characters: Array.isArray(p.characters) ? p.characters.map(String) : [],
                location: String(p.location || raw.location || ''),
                sourceExcerpt: String(p.sourceExcerpt || p.source_excerpt || ''),
                mustKeep: (() => {
                    const mk = p.mustKeep || p.must_keep
                    return Array.isArray(mk) ? mk.map(String) : []
                })(),
                mood: String(p.mood || ''),
                lighting: String(p.lighting || ''),
                dialogue: p.dialogue ? String(p.dialogue) : null,
            }))
            : [{
                description: String(raw.summary || raw.content || ''),
                shotType: 'medium',
                characters: Array.isArray(raw.characters) ? raw.characters.map(String) : [],
                location: String(raw.location || ''),
                sourceExcerpt: '',
                mustKeep: [],
                mood: '',
                lighting: '',
                dialogue: null,
            }],
    }))

    const totalPanels = pages.reduce((sum, p) => sum + p.panels.length, 0)
    console.log(`[Pipeline] Split into ${pages.length} pages with ${totalPanels} total panels (requested: ${pageCount} pages)`)
    return pages
}
