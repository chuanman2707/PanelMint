import { describe, expect, it } from 'vitest'
import { getArtStylePrompt } from './prompts'

describe('getArtStylePrompt', () => {
    it('uses the canonical manhua prompt for legacy chinese-comic records', () => {
        expect(getArtStylePrompt('chinese-comic')).toBe(getArtStylePrompt('manhua'))
    })

    it('supports the canonical manhwa style', () => {
        expect(getArtStylePrompt('manhwa')).toContain('Korean manhwa illustration style')
    })

    it('keeps the legacy realistic prompt for existing records', () => {
        expect(getArtStylePrompt('realistic')).toContain('Realistic cinematic look')
    })
})
