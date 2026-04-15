type EpisodePanelPhaseSnapshot = {
    approved: boolean
    imageUrl: string | null
    status: string
    updatedAt?: Date
}

type EpisodePagePhaseSnapshot = {
    panels: EpisodePanelPhaseSnapshot[]
}

export type EpisodePhaseSnapshot = {
    status: string
    progress: number
    pages: EpisodePagePhaseSnapshot[]
}

export const STALE_IMAGING_PANEL_MS = 15 * 60_000

export function deriveEffectiveEpisodePhase(episode: EpisodePhaseSnapshot) {
    if (episode.status !== 'imaging') {
        return {
            phase: episode.status,
            progress: episode.progress,
        }
    }

    const approvedPanels = episode.pages.flatMap((page) => page.panels).filter((panel) => panel.approved)
    const activePanels = approvedPanels.filter((panel) =>
        panel.imageUrl === null
        && ['queued', 'pending', 'generating'].includes(panel.status)
        && (
            !(panel.updatedAt instanceof Date)
            || Date.now() - panel.updatedAt.getTime() < STALE_IMAGING_PANEL_MS
        )
    )
    const remainingPanels = approvedPanels.filter((panel) =>
        panel.imageUrl === null && !['done', 'content_filtered'].includes(panel.status)
    )

    if (activePanels.length > 0) {
        return {
            phase: episode.status,
            progress: episode.progress,
        }
    }

    if (remainingPanels.length === 0) {
        return {
            phase: 'done',
            progress: 100,
        }
    }

    return {
        phase: 'review_storyboard',
        progress: 50,
    }
}
