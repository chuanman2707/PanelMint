// Storyboard types — kept for DB + UI shapes
// The actual storyboard generation is now merged into analyze.ts (splitIntoPagesWithPanels)

export interface PanelDescription {
    pageIndex: number
    panelIndex: number
    description: string
    shotType: string
    characters: string[]
    location: string
    dialogue: { speaker: string | null; text: string; type: string }[]
}

// Re-export AnalyzedPanel from analyze for convenience
export type { AnalyzedPanel } from './analyze'
