import { matchCharacterName } from '@/lib/utils/character-match'

export interface CharacterCanonSource {
    name: string
    description: string | null
    identityJson: string | null
}

function parseIdentityJson(identityJson: string | null): Record<string, string> | null {
    if (!identityJson) return null

    try {
        const parsed = JSON.parse(identityJson)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, string>
        }
    } catch (error) {
        console.warn('[Pipeline] Ignoring malformed character identity JSON:', error)
    }

    return null
}

export function buildCharacterCanon(
    dbCharacters: CharacterCanonSource[],
    panelCharNames: string[],
): string {
    const filtered = panelCharNames.length > 0
        ? dbCharacters.filter((character) =>
            panelCharNames.some((name) => matchCharacterName(character.name, name))
        )
        : dbCharacters

    return filtered.map((character) => {
        const identity = parseIdentityJson(character.identityJson)
        const identityParts = [
            identity?.ageRange,
            identity?.gender,
            identity?.bodyBuild,
        ].filter(Boolean)
        const anchor = identityParts.length > 0
            ? ` [${identityParts.join(', ')}]`
            : ''

        return `${character.name}${anchor}: ${character.description || 'No description'}`
    }).join('\n\n')
}
