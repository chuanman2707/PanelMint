/**
 * Fuzzy character name matching — extracted from orchestrator.ts
 * Used in reference image collection and character filtering.
 */

export function matchCharacterName(a: string, b: string): boolean {
    const la = a.toLowerCase().trim()
    const lb = b.toLowerCase().trim()
    if (!la || !lb) return false
    if (la === lb) return true

    const tokenize = (value: string) => value
        .split(/[\s._-]+/)
        .map((token) => token.trim())
        .filter(Boolean)

    const aTokens = tokenize(la)
    const bTokens = tokenize(lb)

    if (aTokens.length < 2 || bTokens.length < 2) {
        return false
    }

    const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens
    const longer = aTokens.length <= bTokens.length ? bTokens : aTokens

    return shorter.every((token) => longer.includes(token))
}
