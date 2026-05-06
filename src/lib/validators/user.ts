import { z } from 'zod'

export const validApiProviders = ['wavespeed'] as const

export const apiKeyRequestSchema = z.object({
    apiKey: z.string().trim().min(1, 'API key is required'),
    provider: z.enum(validApiProviders, {
        message: 'Provider must be: wavespeed',
    }),
})

export type ApiKeyRequest = z.infer<typeof apiKeyRequestSchema>
