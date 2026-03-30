import { describe, expect, it } from 'vitest'
import { artStyleOptions, normalizeArtStyle } from './art-styles'

describe('normalizeArtStyle', () => {
    it('maps legacy aliases to canonical values', () => {
        expect(normalizeArtStyle('chinese-comic')).toBe('manhua')
        expect(normalizeArtStyle('american-comic')).toBe('comic')
    })

    it('preserves canonical values', () => {
        expect(normalizeArtStyle('manhwa')).toBe('manhwa')
        expect(normalizeArtStyle('webtoon')).toBe('webtoon')
    })

    it('rejects unsupported legacy values', () => {
        expect(normalizeArtStyle('realistic')).toBeNull()
    })
})

describe('artStyleOptions', () => {
    it('only exposes styles supported by the request schema', () => {
        expect(artStyleOptions.map((option) => option.value)).toEqual([
            'manga',
            'manhua',
            'manhwa',
            'comic',
            'webtoon',
        ])
    })
})
