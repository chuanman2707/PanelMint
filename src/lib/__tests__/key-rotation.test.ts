import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateContentMock = vi.fn()
const createdKeys: string[] = []

vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        apiKey: string
        models = {
            generateContent: generateContentMock,
        }

        constructor({ apiKey }: { apiKey: string }) {
            this.apiKey = apiKey
            createdKeys.push(apiKey)
        }
    },
}))

describe('key rotation', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        createdKeys.length = 0
        process.env.GOOGLE_AI_API_KEY = 'key-a,key-b'
    })

    afterEach(() => {
        delete process.env.GOOGLE_AI_API_KEY
    })

    it('creates Google AI clients from the configured key list', async () => {
        const { getGoogleAI } = await import('@/lib/utils/key-rotation')

        const { ai, keyIndex } = getGoogleAI()

        expect(ai).toBeTruthy()
        expect(keyIndex).toBe(0)
        expect(createdKeys).toEqual(['key-a'])
    })

    it('rotates to the next key after a rate-limit error', async () => {
        generateContentMock
            .mockRejectedValueOnce(new Error('429 rate limit'))
            .mockResolvedValueOnce({ ok: true })

        const { withKeyRotation } = await import('@/lib/utils/key-rotation')

        const result = await withKeyRotation((ai) => ai.models.generateContent({
            model: 'gemini-test',
            contents: 'hello',
        }))

        expect(result).toEqual({ ok: true })
        expect(createdKeys).toEqual(['key-a', 'key-b'])
    })

    it('reports cooldown status after a rate-limit event', async () => {
        generateContentMock.mockRejectedValue(new Error('resource_exhausted'))

        const { getRotationStatus, withKeyRotation } = await import('@/lib/utils/key-rotation')

        await expect(withKeyRotation((ai) => ai.models.generateContent({
            model: 'gemini-test',
            contents: 'hello',
        }))).rejects.toThrow()

        const status = getRotationStatus()

        expect(status.total).toBe(2)
        expect(status.available).toBeLessThan(2)
        expect(status.cooldowns.length).toBeGreaterThan(0)
    })
})
