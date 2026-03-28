/**
 * Fuzzy character name matching — extracted from orchestrator.ts
 * Used in reference image collection and character filtering.
 */

export function matchCharacterName(a: string, b: string): boolean {
    const la = a.toLowerCase().trim()
    const lb = b.toLowerCase().trim()
    if (la === lb) return true
    if (la.includes(lb) || lb.includes(la)) return true
    return false
}
