import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/lib/security-policy'

export const validApiProviders = ['wavespeed'] as const

const emailSchema = z.email('Email must be valid')
    .trim()
    .toLowerCase()
    .max(320, 'Email is too long')

const passwordSchema = z.string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(256, 'Password is too long')

const nameSchema = z.string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name is too long')

export const apiKeyRequestSchema = z.object({
    apiKey: z.string().trim().min(1, 'API key is required'),
    provider: z.enum(validApiProviders, {
        message: 'Provider must be: wavespeed',
    }),
})

export const signinRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
})

export const signupRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema.optional(),
})

export const passwordResetRequestSchema = z.object({
    email: emailSchema,
})

export const passwordUpdateRequestSchema = z.object({
    password: passwordSchema,
})

export type ApiKeyRequest = z.infer<typeof apiKeyRequestSchema>
export type SigninRequest = z.infer<typeof signinRequestSchema>
export type SignupRequest = z.infer<typeof signupRequestSchema>
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>
export type PasswordUpdateRequest = z.infer<typeof passwordUpdateRequestSchema>
