/**
 * AI Character Design — generates structured JSON identity anchor + character sheet.
 * Adapted from waoowaoo pattern for character consistency.
 *
 * Character description outputs structured JSON (not just text paragraph)
 * for use as identity anchors in image generation prompts.
 */

import { callLLM } from '@/lib/ai/llm'
import { safeParseJsonObject } from '@/lib/utils/json-repair'
import { generatePanelImage } from '@/lib/pipeline/image-gen'
import type { ProviderConfig } from '@/lib/api-config'

// ─── Types ──────────────────────────────────────────────

export interface CharacterIdentityJson {
    name: string
    ageRange: string
    gender: string
    bodyBuild: string
    hairColor: string
    hairStyle: string
    eyeColor: string
    skinTone: string
    clothing: string
    distinctiveFeatures: string[]
    visualPrompt: string
}

export interface CharacterDesignResult {
    description: string
    identityJson: CharacterIdentityJson
}

export interface CharacterSheetResult {
    imageUrl: string
}

// ─── Generate Structured Character Description ──────────

/**
 * Uses LLM to create a structured JSON identity anchor for character consistency.
 * Returns both a visual prompt and structured fields for image generation.
 */
export async function generateCharacterDescription(
    name: string,
    context: string,
    existingDescription?: string,
    providerConfig?: ProviderConfig,
): Promise<CharacterDesignResult> {
    const prompt = `/no_think
You are a character designer for webtoon/comic creation. Output ONLY valid JSON, no explanations.

Character name: ${name}
Story context: ${context}
${existingDescription ? `Current brief description: ${existingDescription}` : ''}

Create a DETAILED structured identity anchor for this character. This will be used to maintain character consistency across all panels.

Output as JSON:
{
  "name": "${name}",
  "ageRange": "e.g. '25-30'",
  "gender": "male | female | other",
  "bodyBuild": "e.g. 'lean athletic', 'petite', 'tall muscular'",
  "hairColor": "e.g. 'jet black', 'warm chestnut brown'",
  "hairStyle": "e.g. 'short, messy, swept right'",
  "eyeColor": "e.g. 'dark brown', 'warm amber'",
  "skinTone": "e.g. 'warm tan', 'fair porcelain'",
  "clothing": "full default outfit description with colors and materials",
  "distinctiveFeatures": ["unique visual trait 1", "unique visual trait 2"],
  "visualPrompt": "A complete 150-200 word visual description paragraph combining ALL the above details, suitable for image generation. Be specific enough that an artist could draw this character identically every time."
}

RULES:
- Use SPECIFIC colors (e.g. "warm amber eyes" not "brown eyes")
- Infer reasonable defaults from context if not explicitly described
- For martial arts/wuxia/xianxia: default to traditional East Asian features and robes
- distinctiveFeatures should include scars, tattoos, accessories, mannerisms
- visualPrompt must be a flowing paragraph that could stand alone as a character reference`

    const response = await callLLM(prompt, {
        temperature: 0.5,
        maxTokens: 800,
        providerConfig,
    })

    try {
        const json = safeParseJsonObject(response) as Record<string, unknown>
        const identityJson: CharacterIdentityJson = {
            name: String(json.name || name),
            ageRange: String(json.ageRange || ''),
            gender: String(json.gender || ''),
            bodyBuild: String(json.bodyBuild || ''),
            hairColor: String(json.hairColor || ''),
            hairStyle: String(json.hairStyle || ''),
            eyeColor: String(json.eyeColor || ''),
            skinTone: String(json.skinTone || ''),
            clothing: String(json.clothing || ''),
            distinctiveFeatures: Array.isArray(json.distinctiveFeatures)
                ? json.distinctiveFeatures.map(String)
                : [],
            visualPrompt: String(json.visualPrompt || ''),
        }

        return {
            description: identityJson.visualPrompt || response.trim(),
            identityJson,
        }
    } catch {
        // Fallback: treat entire response as description text
        console.warn(`[CharDesign] JSON parse failed for ${name}, using raw text`)
        return {
            description: response.trim(),
            identityJson: {
                name,
                ageRange: '',
                gender: '',
                bodyBuild: '',
                hairColor: '',
                hairStyle: '',
                eyeColor: '',
                skinTone: '',
                clothing: '',
                distinctiveFeatures: [],
                visualPrompt: response.trim(),
            },
        }
    }
}

// ─── Generate Character Sheet (Reference Image) ─────────

/**
 * Generates a character sheet reference image.
 * Uses wavespeed.ai (or legacy provider) for image generation.
 */
export async function generateCharacterSheet(
    characterId: string,
    description: string,
    artStyle: string = 'webtoon',
    providerConfig?: ProviderConfig,
    userId?: string,
    episodeId?: string,
): Promise<CharacterSheetResult> {
    if (!providerConfig) {
        return { imageUrl: '' }
    }

    const imageUrl = await generatePanelImage({
        panelId: `char-${characterId}`,
        description: `Full-body character reference sheet on clean white background: ${description}`,
        characters: [],
        shotType: 'full-body',
        location: 'clean white background, studio lighting',
        artStyle,
        providerConfig,
        userId,
        episodeId,
    })

    return { imageUrl }
}
