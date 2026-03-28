import { z } from 'zod'

export const createCharacterRequestSchema = z.object({
    projectId: z.string().trim().min(1, 'projectId is required'),
    name: z.string().trim().min(1, 'name is required'),
    description: z.preprocess((value) => {
        if (typeof value !== 'string') return value
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }, z.string().max(10_000).nullable().optional()),
})

export const updateCharacterRequestSchema = z.object({
    name: z.string().trim().min(1, 'name is required').optional(),
    description: z.preprocess((value) => {
        if (typeof value !== 'string') return value
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }, z.string().max(10_000).nullable().optional()),
}).refine(
    (data) => data.name !== undefined || data.description !== undefined,
    { message: 'At least one field must be provided' },
)

export type CreateCharacterRequest = z.infer<typeof createCharacterRequestSchema>
export type UpdateCharacterRequest = z.infer<typeof updateCharacterRequestSchema>
