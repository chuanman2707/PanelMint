import {
    runAnalyzeStep,
    runImageGenStep,
    runStoryboardStep,
} from '@/lib/pipeline/orchestrator'
import {
    getCharacterSheetDispatchPayloads,
    runCharacterSheetStep,
} from '@/lib/pipeline/character-sheet-step'
import { enqueuePipelineJob, type PipelineJobRecord } from '@/lib/queue/repository'

function parsePayload<T>(job: PipelineJobRecord): T {
    return JSON.parse(job.payload) as T
}

export async function handlePipelineJob(job: PipelineJobRecord): Promise<void> {
    switch (job.type) {
        case 'analyze': {
            await runAnalyzeStep(parsePayload(job))
            return
        }
        case 'storyboard': {
            const payload = parsePayload<{ episodeId: string }>(job)
            await runStoryboardStep(payload.episodeId)
            return
        }
        case 'character-sheets-parent': {
            const payload = parsePayload<{ episodeId: string }>(job)
            const dispatch = await getCharacterSheetDispatchPayloads(payload.episodeId)

            await Promise.all(dispatch.characterIds.map((characterId) =>
                enqueuePipelineJob({
                    episodeId: payload.episodeId,
                    userId: dispatch.userId,
                    type: 'character-sheet',
                    payload: {
                        episodeId: payload.episodeId,
                        userId: dispatch.userId,
                        characterId,
                    },
                    dedupeKey: `character-sheet:${payload.episodeId}:${characterId}`,
                    maxAttempts: 2,
                }),
            ))
            return
        }
        case 'character-sheet': {
            await runCharacterSheetStep(parsePayload(job))
            return
        }
        case 'image-generation-parent': {
            const payload = parsePayload<{ episodeId: string; panelIds: string[] }>(job)

            await Promise.all(payload.panelIds.map((panelId) =>
                enqueuePipelineJob({
                    episodeId: payload.episodeId,
                    userId: job.userId,
                    type: 'image-panel',
                    payload: {
                        episodeId: payload.episodeId,
                        userId: job.userId,
                        panelId,
                    },
                    dedupeKey: `image-panel:${payload.episodeId}:${panelId}`,
                    maxAttempts: 2,
                }),
            ))
            return
        }
        case 'image-panel': {
            const payload = parsePayload<{ episodeId: string; panelId: string }>(job)
            await runImageGenStep(payload.episodeId, [payload.panelId])
            return
        }
        default: {
            const exhaustive: never = job.type
            throw new Error(`Unsupported pipeline job type: ${exhaustive}`)
        }
    }
}
