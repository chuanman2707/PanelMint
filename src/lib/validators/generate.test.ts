import { describe, expect, it } from 'vitest'
import { GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT } from '@/lib/generate-manuscript-guardrails'
import { generateRequestSchema } from './generate'
import { MAX_STORY_MANUSCRIPT_CHARS } from '@/lib/prompt-budget'

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
            text: 'x'.repeat(MAX_STORY_MANUSCRIPT_CHARS + 1),
        })).toThrowError(GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT)
    })

    it('ignores removed render-mode input', () => {
        const removedRenderModeKey = 'imageModel' + 'Tier'
        const parsed = generateRequestSchema.parse({
            text: 'story',
            artStyle: 'manga',
            pageCount: 15,
            [removedRenderModeKey]: 'retired-render-mode',
        })

        expect(parsed).toEqual({
            text: 'story',
            artStyle: 'manga',
            pageCount: 15,
        })
    })
})
