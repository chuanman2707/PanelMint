import { describe, it, expect } from 'vitest'
import { collectPanelReferenceImages } from '@/lib/pipeline/reference-images'

describe('collectPanelReferenceImages', () => {
    const characters = [
        {
            name: 'Anh Minh',
            imageUrl: '/generated/char-1.png',
            appearances: [{ imageUrl: '/appearances/minh-default.png', isDefault: true }],
        },
        {
            name: 'Thanh Thu',
            imageUrl: '/generated/char-2.png',
            appearances: [{ imageUrl: null, isDefault: true }],
        },
        {
            name: 'Ngộ Xuân',
            imageUrl: null,
            appearances: [],
        },
    ]

    it('returns character sheet URLs for characters in panel', () => {
        const refs = collectPanelReferenceImages(['Anh Minh', 'Thanh Thu'], characters)
        // Anh Minh: uses default appearance image
        // Thanh Thu: falls back to character imageUrl
        expect(refs).toEqual(['/appearances/minh-default.png', '/generated/char-2.png'])
    })

    it('returns empty array when no characters have sheets', () => {
        const refs = collectPanelReferenceImages(['Ngộ Xuân'], characters)
        expect(refs).toEqual([])
    })

    it('uses matchCharacterName for fuzzy matching', () => {
        const refs = collectPanelReferenceImages(['Minh'], characters)
        expect(refs).toEqual(['/appearances/minh-default.png'])
    })

    it('limits to 5 reference images (FLUX Kontext Multi max)', () => {
        const manyChars = Array.from({ length: 8 }, (_, i) => ({
            name: `Char ${i}`,
            imageUrl: `/img/${i}.png`,
            appearances: [],
        }))
        const names = manyChars.map((c) => c.name)
        const refs = collectPanelReferenceImages(names, manyChars)
        expect(refs.length).toBe(5)
    })

    it('prefers default appearance image over character imageUrl', () => {
        const refs = collectPanelReferenceImages(['Anh Minh'], characters)
        expect(refs).toEqual(['/appearances/minh-default.png'])
    })
})
