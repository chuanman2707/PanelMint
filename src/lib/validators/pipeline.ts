import { z } from 'zod'

export const generateImagesRequestSchema = z.object({
    panelIds: z.array(z.string().min(1)).max(200).optional(),
})

export const approveStoryboardRequestSchema = z.object({
    panels: z.array(
        z.object({
            id: z.string().min(1),
            approved: z.boolean(),
            editedPrompt: z.string().nullable().optional(),
        }),
    ).min(1, 'panels array is required'),
})

export const approveAnalysisRequestSchema = z.object({
    characters: z.array(
        z.object({
            id: z.string().min(1),
            name: z.string().trim().min(1, 'character.name is required'),
            aliases: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
        }),
    ).optional().default([]),
    locations: z.array(
        z.object({
            id: z.string().min(1),
            name: z.string().trim().min(1, 'location.name is required'),
            description: z.string().nullable().optional(),
        }),
    ).optional().default([]),
})

export const retryRequestSchema = z.object({
    panelIds: z.array(z.string().min(1)).max(200).optional(),
})

export const saveBubblesRequestSchema = z.object({
    panelId: z.string().min(1, 'panelId is required'),
    bubbles: z.array(
        z.object({
            id: z.string().optional(),
            bubbleIndex: z.coerce.number().int().nonnegative(),
            speaker: z.string().nullable(),
            content: z.string(),
            bubbleType: z.string(),
            positionX: z.coerce.number(),
            positionY: z.coerce.number(),
            width: z.coerce.number(),
            height: z.coerce.number(),
        }),
    ).max(50, 'Too many bubbles (max 50)'),
})

export type GenerateImagesRequest = z.infer<typeof generateImagesRequestSchema>
export type ApproveStoryboardRequest = z.infer<typeof approveStoryboardRequestSchema>
export type ApproveAnalysisRequest = z.infer<typeof approveAnalysisRequestSchema>
export type RetryRequest = z.infer<typeof retryRequestSchema>
export type SaveBubblesRequest = z.infer<typeof saveBubblesRequestSchema>
