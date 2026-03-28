import { z } from 'zod'
import { IMAGE_MODEL_TIERS } from '@/lib/credit-catalog'

export const validArtStyles = ['manga', 'manhua', 'manhwa', 'comic', 'webtoon'] as const

export const generateRequestSchema = z.object({
    text: z.string().trim().min(1, 'Text is required').max(100_000, 'Text exceeds maximum length of 100,000 characters'),
    artStyle: z.enum(validArtStyles).optional().default('manga'),
    pageCount: z.coerce.number().int().min(5, 'pageCount must be between 5 and 30').max(30, 'pageCount must be between 5 and 30').optional().default(15),
    imageModelTier: z.enum(IMAGE_MODEL_TIERS).optional().default('standard'),
})

export type GenerateRequest = z.infer<typeof generateRequestSchema>
