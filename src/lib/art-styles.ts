export const validArtStyles = ['manga', 'manhua', 'manhwa', 'comic', 'webtoon'] as const

export type ArtStyle = (typeof validArtStyles)[number]

export const artStyleOptions: Array<{ value: ArtStyle; label: string }> = [
    { value: 'manga', label: 'Manga' },
    { value: 'manhua', label: 'Manhua' },
    { value: 'manhwa', label: 'Manhwa' },
    { value: 'comic', label: 'Comic' },
    { value: 'webtoon', label: 'Webtoon' },
]

const artStyleAliasMap: Record<string, ArtStyle> = {
    'american-comic': 'comic',
    'chinese-comic': 'manhua',
}

const validArtStyleSet = new Set<string>(validArtStyles)

export function normalizeArtStyle(value: unknown): ArtStyle | null {
    if (typeof value !== 'string') return null

    const normalizedValue = value.trim().toLowerCase()

    if (validArtStyleSet.has(normalizedValue)) {
        return normalizedValue as ArtStyle
    }

    return artStyleAliasMap[normalizedValue] ?? null
}
