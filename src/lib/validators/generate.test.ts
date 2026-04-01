import { describe, expect, it } from 'vitest'
import { generateRequestSchema } from './generate'

describe('generateRequestSchema', () => {
    it('normalizes legacy art style aliases before validation', () => {
        const parsed = generateRequestSchema.parse({
            text: 'A chapter opening',
            artStyle: 'chinese-comic',
        })

        expect(parsed.artStyle).toBe('manhua')
    })

    it('accepts canonical styles exposed by the UI', () => {
        const parsed = generateRequestSchema.parse({
            text: 'A chapter opening',
            artStyle: 'manhwa',
        })

        expect(parsed.artStyle).toBe('manhwa')
    })

    it('still rejects unsupported art styles', () => {
        expect(() => generateRequestSchema.parse({
            text: 'A chapter opening',
            artStyle: 'realistic',
        })).toThrowError(/Invalid option/)
    })

    it('rejects manuscripts that exceed the WaveSpeed prompt limit', () => {
        expect(() => generateRequestSchema.parse({
            text: 'x'.repeat(9_501),
        })).toThrowError(/WaveSpeed prompt limit of 9500 characters/)
    })
})
