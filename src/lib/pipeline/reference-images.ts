/**
 * Reference image collection for panel generation.
 * Collects character sheet images for each character in a panel.
 * Adapted from waoowaoo collectPanelReferenceImages pattern.
 */

import { matchCharacterName } from '@/lib/utils/character-match'
import { getStorage } from '@/lib/storage'

interface StoredImageReference {
    imageUrl: string | null
    storageKey?: string | null
}

interface CharacterWithImage {
    name: string
    imageUrl: string | null
    storageKey?: string | null
    appearances?: Array<{
        imageUrl: string | null
        storageKey?: string | null
        isDefault: boolean
    }>
}

function getReferenceImage(character: CharacterWithImage): StoredImageReference | null {
    const defaultAppearance = character.appearances
        ?.find((appearance) => appearance.isDefault && (appearance.imageUrl || appearance.storageKey))

    if (defaultAppearance) {
        return {
            imageUrl: defaultAppearance.imageUrl,
            storageKey: defaultAppearance.storageKey,
        }
    }

    if (!character.imageUrl && !character.storageKey) {
        return null
    }

    return {
        imageUrl: character.imageUrl,
        storageKey: character.storageKey,
    }
}

async function resolveReferenceImageUrl(reference: StoredImageReference | null): Promise<string | null> {
    if (!reference) return null
    if (reference.storageKey) {
        return getStorage().getSignedUrl(reference.storageKey)
    }
    return reference.imageUrl
}

/**
 * Collect reference images for a panel based on its characters.
 * Returns URLs for character sheets of characters present in the panel.
 * wavespeed.ai FLUX Kontext Multi supports up to 5 reference images.
 */
export async function collectPanelReferenceImages(
    panelCharacterNames: string[],
    projectCharacters: CharacterWithImage[],
): Promise<string[]> {
    const refs: string[] = []

    for (const charName of panelCharacterNames) {
        const match = projectCharacters.find((c) =>
            matchCharacterName(c.name, charName)
        )
        if (!match) continue

        const url = await resolveReferenceImageUrl(getReferenceImage(match))
        if (url) refs.push(url)
        if (refs.length === 5) break
    }

    // FLUX Kontext Multi supports up to 5 reference images
    return refs.slice(0, 5)
}

export function findMissingReferenceCharacters(
    panelCharacterNames: string[],
    projectCharacters: CharacterWithImage[],
): string[] {
    const missing = new Set<string>()

    for (const charName of panelCharacterNames) {
        const match = projectCharacters.find((character) =>
            matchCharacterName(character.name, charName)
        )

        if (!match) continue
        if (!getReferenceImage(match)) {
            missing.add(match.name)
        }
    }

    return [...missing]
}
