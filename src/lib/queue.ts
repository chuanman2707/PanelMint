import { enqueuePipelineJob, cancelEpisodeJobs } from '@/lib/queue/repository'
import { getEpisodeOwner, getUniqueIds } from '@/lib/queue/fanout'

export type PipelineJobData =
    | {
        type: 'analyze'
        episodeId: string
        userId: string
        projectId: string
        text: string
        artStyle: string
        pageCount: number
      }
    | { type: 'storyboard'; episodeId: string }
    | { type: 'character-sheets-parent'; episodeId: string }
    | { type: 'character-sheet'; episodeId: string; userId: string; characterId: string }
    | { type: 'image-generation-parent'; episodeId: string; panelIds: string[] }
    | { type: 'image-panel'; episodeId: string; userId: string; panelId: string }

export async function enqueueAnalyze(
    data: Omit<Extract<PipelineJobData, { type: 'analyze' }>, 'type'>,
) {
    return enqueuePipelineJob({
        episodeId: data.episodeId,
        userId: data.userId,
        type: 'analyze',
        payload: data,
        dedupeKey: `analyze:${data.episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueStoryboard(episodeId: string) {
    const userId = await getEpisodeOwner(episodeId)

    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'storyboard',
        payload: { episodeId },
        dedupeKey: `storyboard:${episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueCharacterSheets(episodeId: string) {
    const userId = await getEpisodeOwner(episodeId)

    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'character-sheets-parent',
        payload: { episodeId },
        dedupeKey: `character-sheets-parent:${episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueImageGen(episodeId: string, panelIds?: string[]) {
    const uniquePanelIds = getUniqueIds(panelIds)
    if (uniquePanelIds.length === 0) return []

    const userId = await getEpisodeOwner(episodeId)
    const stablePanelKey = [...uniquePanelIds].sort().join(',')

    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'image-generation-parent',
        payload: {
            episodeId,
            panelIds: uniquePanelIds,
        },
        dedupeKey: `image-generation-parent:${episodeId}:${stablePanelKey}`,
        maxAttempts: 2,
    })
}

export async function cancelEpisodePipelineJobs(episodeId: string) {
    return cancelEpisodeJobs(episodeId)
}
