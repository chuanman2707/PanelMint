import { describe, it, expect } from 'vitest'
import { AppError, buildErrorResponse } from '../errors'

describe('Error System', () => {
    describe('AppError', () => {
        it('should create error with status code', () => {
            const err = new AppError('Test error', 400, 'BAD_REQUEST')
            expect(err.message).toBe('Test error')
            expect(err.statusCode).toBe(400)
            expect(err.code).toBe('BAD_REQUEST')
        })

        it('should have static factory methods', () => {
            expect(AppError.badRequest('bad').statusCode).toBe(400)
            expect(AppError.unauthorized().statusCode).toBe(401)
            expect(AppError.forbidden().statusCode).toBe(403)
            expect(AppError.notFound('User').statusCode).toBe(404)
            expect(AppError.conflict('exists').statusCode).toBe(409)
            expect(AppError.tooManyRequests().statusCode).toBe(429)
        })

        it('should include resource name in notFound message', () => {
            const err = AppError.notFound('Episode')
            expect(err.message).toBe('Episode not found')
        })
    })

    describe('buildErrorResponse', () => {
        it('should handle AppError', async () => {
            const res = buildErrorResponse(AppError.badRequest('Missing field'))
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Missing field')
            expect(body.code).toBe('BAD_REQUEST')
        })

        it('should handle Prisma P2002 errors', async () => {
            const prismaError = { code: 'P2002', message: 'Unique constraint' }
            const res = buildErrorResponse(prismaError)
            expect(res.status).toBe(409)
        })

        it('should handle generic errors as 500', async () => {
            const res = buildErrorResponse(new Error('something broke'))
            expect(res.status).toBe(500)
            const body = await res.json()
            expect(body.code).toBe('INTERNAL_ERROR')
        })
    })
})
