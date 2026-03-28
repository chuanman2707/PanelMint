/**
 * Reference image collection for panel generation.
 * Collects character sheet images for each character in a panel.
 * Adapted from waoowaoo collectPanelReferenceImages pattern.
 */

import { matchCharacterName } from '@/lib/utils/character-match'

interface CharacterWithImage {
    name: string
    imageUrl: string | null
    appearances?: { imageUrl: string | null; isDefault: boolean }[]
}

/**
 * Collect reference images for a panel based on its characters.
 * Returns URLs for character sheets of characters present in the panel.
 * wavespeed.ai FLUX Kontext Multi supports up to 5 reference images.
 */
export function collectPanelReferenceImages(
    panelCharacterNames: string[],
    projectCharacters: CharacterWithImage[],
): string[] {
    const refs: string[] = []

    for (const charName of panelCharacterNames) {
        const match = projectCharacters.find((c) =>
            matchCharacterName(c.name, charName)
        )
        if (!match) continue

        // Prefer default appearance image, fall back to character imageUrl
        const appearanceUrl = match.appearances
            ?.find((a) => a.isDefault && a.imageUrl)
            ?.imageUrl
        const url = appearanceUrl || match.imageUrl

        if (url) refs.push(url)
    }

    // FLUX Kontext Multi supports up to 5 reference images
    return refs.slice(0, 5)
}
