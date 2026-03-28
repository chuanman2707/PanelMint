export interface GenerationStatus {
    phase: string
    progress: number
    totalPanels: number
    completedPanels: number
    error?: string | null
    pageCount?: number
    characters?: Array<{ id: string; name: string; aliases: string | null; description: string | null; imageUrl: string | null; identityJson: string | null }>
    locations?: Array<{ id: string; name: string; description: string | null }>
    pages?: Array<{ id: string; pageIndex: number; summary: string; content: string; location: string | null }>
    panels?: Array<{
        id: string
        pageIndex: number
        panelIndex: number
        description: string | null
        shotType: string | null
        characters: string | null
        location: string | null
        approved: boolean
        approvedPrompt: string | null
        status: string
        imageUrl: string | null
        sourceExcerpt: string | null
        mustKeep: string | null
        mood: string | null
        lighting: string | null
    }>
}

export const ACTIVE_PROGRESS_PHASES = new Set(['analyzing', 'storyboarding', 'imaging'])

export function isActiveProgressPhase(phase: string): boolean {
    return ACTIVE_PROGRESS_PHASES.has(phase)
}
