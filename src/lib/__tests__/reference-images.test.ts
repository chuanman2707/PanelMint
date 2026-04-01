import { describe, it, expect, vi } from 'vitest'
import { collectPanelReferenceImages } from '@/lib/pipeline/reference-images'

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({
        getSignedUrl: vi.fn(async (key: string) => `signed:${key}`),
    }),
}))

describe('collectPanelReferenceImages', () => {
    const characters = [
        {
            name: 'Anh Minh',
            imageUrl: '/generated/char-1.png',
            storageKey: 'characters/anh-minh.png',
            appearances: [{ imageUrl: '/appearances/minh-default.png', storageKey: 'appearances/minh-default.png', isDefault: true }],
        },
        {
            name: 'Thanh Thu',
            imageUrl: '/generated/char-2.png',
            storageKey: 'characters/thanh-thu.png',
            appearances: [{ imageUrl: null, isDefault: true }],
        },
        {
            name: 'Ngộ Xuân',
            imageUrl: null,
            appearances: [],
        },
    ]

    it('returns character sheet URLs for characters in panel', async () => {
        const refs = await collectPanelReferenceImages(['Anh Minh', 'Thanh Thu'], characters)
        // Anh Minh: uses default appearance image
        // Thanh Thu: falls back to character imageUrl
        expect(refs).toEqual(['signed:appearances/minh-default.png', 'signed:characters/thanh-thu.png'])
    })

    it('returns empty array when no characters have sheets', async () => {
        const refs = await collectPanelReferenceImages(['Ngộ Xuân'], characters)
        expect(refs).toEqual([])
    })

    it('requires at least a multi-token overlap to avoid substring collisions', async () => {
        const refs = await collectPanelReferenceImages(['Minh'], characters)
        expect(refs).toEqual([])
    })

    it('limits to 5 reference images (FLUX Kontext Multi max)', async () => {
        const manyChars = Array.from({ length: 8 }, (_, i) => ({
            name: `Char ${i}`,
            imageUrl: `/img/${i}.png`,
            storageKey: `characters/${i}.png`,
            appearances: [],
        }))
        const names = manyChars.map((c) => c.name)
        const refs = await collectPanelReferenceImages(names, manyChars)
        expect(refs.length).toBe(5)
    })

    it('prefers default appearance image over character imageUrl', async () => {
        const refs = await collectPanelReferenceImages(['Anh Minh'], characters)
        expect(refs).toEqual(['signed:appearances/minh-default.png'])
    })
})
