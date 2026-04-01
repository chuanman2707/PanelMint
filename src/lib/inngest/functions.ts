import { prisma } from '@/lib/prisma'
import { inngest } from './client'
import {
    runAnalyzeStep,
    runImageGenStep,
    runStoryboardStep,
} from '@/lib/pipeline/orchestrator'
import {
    getCharacterSheetDispatchPayloads,
    runCharacterSheetStep,
} from '@/lib/pipeline/character-sheet-step'
import type { PipelineJobData } from '@/lib/queue'

type AnalyzePayload = Omit<Extract<PipelineJobData, { type: 'analyze' }>, 'type'>
type StoryboardPayload = Omit<Extract<PipelineJobData, { type: 'storyboard' }>, 'type'>
type ImageGenerationPayload = {
    episodeId: string
    userId: string
    panels: Array<{
        panelId: string
        attempt: number
    }>
}
type ImagePanelPayload = {
    episodeId: string
    panelId: string
    userId: string
    attempt: number
}
type CharacterSheetParentPayload = {
    episodeId: string
}
type CharacterSheetPayload = {
    episodeId: string
    userId: string
    characterId: string
}

async function linkRunToInngestExecution(episodeId: string, inngestRunId: string) {
    await prisma.pipelineRun.updateMany({
        where: { episodeId },
        data: { inngestRunId },
    })
}

const cancellation = [
    {
        event: 'episode/cancel.requested',
        if: 'async.data.episodeId == event.data.episodeId',
        timeout: '24h',
    },
]

export const analyzeEpisodeFunction = inngest.createFunction(
    {
        id: 'episode-analyze',
        cancelOn: cancellation,
        triggers: [{ event: 'episode/analyze.requested' }],
    },
    async ({ event, runId, step }) => {
        const payload = event.data as AnalyzePayload

        await step.run('link-analyze-run', async () => {
            await linkRunToInngestExecution(payload.episodeId, runId)
        })

        await step.run('run-analyze-step', async () => {
            await runAnalyzeStep(payload)
        })

        return { ok: true }
    },
)

export const storyboardEpisodeFunction = inngest.createFunction(
    {
        id: 'episode-storyboard',
        cancelOn: cancellation,
        triggers: [{ event: 'episode/storyboard.requested' }],
    },
    async ({ event, runId, step }) => {
        const payload = event.data as StoryboardPayload

        await step.run('link-storyboard-run', async () => {
            await linkRunToInngestExecution(payload.episodeId, runId)
        })

        await step.run('run-storyboard-step', async () => {
            await runStoryboardStep(payload.episodeId)
        })

        return { ok: true }
    },
)

export const imageGenerationParentFunction = inngest.createFunction(
    {
        id: 'episode-image-generation-parent',
        cancelOn: cancellation,
        triggers: [{ event: 'episode/image-generation.requested' }],
    },
    async ({ event, runId, step }) => {
        const payload = event.data as ImageGenerationPayload

        await step.run('link-image-parent-run', async () => {
            await linkRunToInngestExecution(payload.episodeId, runId)
        })

        const payloads = await step.run('fan-out-image-panels', async () => {
            if (!payload.panels.length) {
                return []
            }

            return payload.panels.map((panel) => ({
                id: `image-panel:${panel.panelId}:${panel.attempt}`,
                name: 'episode/image-panel.requested',
                data: {
                    episodeId: payload.episodeId,
                    panelId: panel.panelId,
                    userId: payload.userId,
                    attempt: panel.attempt,
                },
            }))
        })

        if (payloads.length > 0) {
            await step.run('send-image-panel-events', async () => {
                await inngest.send(payloads)
            })
        }

        return {
            episodeId: payload.episodeId,
            scheduledPanels: payloads.length,
        }
    },
)

export const imagePanelFunction = inngest.createFunction(
    {
        id: 'episode-image-panel',
        cancelOn: cancellation,
        concurrency: {
            key: 'event.data.userId',
            limit: 2,
        },
        triggers: [{ event: 'episode/image-panel.requested' }],
    },
    async ({ event, runId, step }) => {
        const payload = event.data as ImagePanelPayload

        await step.run('link-image-panel-run', async () => {
            await linkRunToInngestExecution(payload.episodeId, runId)
        })

        await step.run(`run-image-panel-${payload.panelId}`, async () => {
            await runImageGenStep(payload.episodeId, [payload.panelId])
        })

        return { ok: true }
    },
)

export const characterSheetParentFunction = inngest.createFunction(
    {
        id: 'episode-character-sheet-parent',
        cancelOn: cancellation,
        triggers: [{ event: 'episode/character-sheets.requested' }],
    },
    async ({ event, step }) => {
        const payload = event.data as CharacterSheetParentPayload

        const dispatchPayload = await step.run('fan-out-character-sheets', async () => {
            return getCharacterSheetDispatchPayloads(payload.episodeId)
        })

        const characterEvents = dispatchPayload.characterIds.map((characterId) => ({
            id: `character-sheet:${payload.episodeId}:${characterId}`,
            name: 'episode/character-sheet.requested',
            data: {
                episodeId: payload.episodeId,
                userId: dispatchPayload.userId,
                characterId,
            },
        }))

        if (characterEvents.length > 0) {
            await step.run('send-character-sheet-events', async () => {
                await inngest.send(characterEvents)
            })
        }

        return {
            episodeId: payload.episodeId,
            scheduledCharacters: characterEvents.length,
        }
    },
)

export const characterSheetFunction = inngest.createFunction(
    {
        id: 'episode-character-sheet',
        cancelOn: cancellation,
        concurrency: {
            key: 'event.data.userId',
            limit: 1,
        },
        triggers: [{ event: 'episode/character-sheet.requested' }],
    },
    async ({ event, step, attempt }) => {
        const payload = event.data as CharacterSheetPayload

        await step.run(`run-character-sheet-${payload.characterId}`, async () => {
            await runCharacterSheetStep({
                ...payload,
                attempt: attempt + 1,
            })
        })

        return { ok: true }
    },
)

export const inngestFunctions = [
    analyzeEpisodeFunction,
    storyboardEpisodeFunction,
    characterSheetParentFunction,
    characterSheetFunction,
    imageGenerationParentFunction,
    imagePanelFunction,
]
