import { z } from 'zod'
import { IMAGE_MODEL_TIERS } from '@/lib/credit-catalog'
import { normalizeArtStyle, validArtStyles } from '@/lib/art-styles'
import { GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT } from '@/lib/generate-manuscript-guardrails'
import { MAX_STORY_MANUSCRIPT_CHARS } from '@/lib/prompt-budget'

const artStyleSchema = z.preprocess(
    (value) => normalizeArtStyle(value) ?? value,
    z.enum(validArtStyles),
)

export const generateRequestSchema = z.object({
    text: z.string()
        .trim()
        .min(1, 'Text is required')
        .max(
            MAX_STORY_MANUSCRIPT_CHARS,
            GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT,
        ),
    artStyle: artStyleSchema.optional().default('manga'),
    pageCount: z.coerce.number().int().min(5, 'pageCount must be between 5 and 30').max(30, 'pageCount must be between 5 and 30').optional().default(15),
    imageModelTier: z.enum(IMAGE_MODEL_TIERS).optional().default('standard'),
})

export type GenerateRequest = z.infer<typeof generateRequestSchema>
