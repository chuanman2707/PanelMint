import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'

// Discriminated union of all pipeline job shapes
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
    | { type: 'generate-images'; episodeId: string; panelIds?: string[] }

function getUniqueIds(values: string[] | undefined): string[] {
    if (!values?.length) return []
    return [...new Set(values.filter(Boolean))]
}

export async function enqueueAnalyze(
    data: Omit<Extract<PipelineJobData, { type: 'analyze' }>, 'type'>,
) {
    return inngest.send({
        id: `analyze:${data.episodeId}`,
        name: 'episode/analyze.requested',
        data,
    })
}

export async function enqueueStoryboard(episodeId: string) {
    return inngest.send({
        id: `storyboard:${episodeId}`,
        name: 'episode/storyboard.requested',
        data: { episodeId },
    })
}

async function getImageFanoutPayload(episodeId: string, panelIds: string[]) {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
            project: {
                select: {
                    userId: true,
                },
            },
        },
    })

    if (!episode?.project.userId) {
        throw new Error(`Episode ${episodeId} is missing a project owner.`)
    }

    const panels = await prisma.panel.findMany({
        where: {
            id: { in: panelIds },
            page: { episodeId },
        },
        select: {
            id: true,
            generationAttempt: true,
        },
    })

    return {
        userId: episode.project.userId,
        panels: panels.map((panel) => ({
            panelId: panel.id,
            attempt: panel.generationAttempt + 1,
        })),
    }
}

function buildImageGenerationEventId(episodeId: string, panels: Array<{ panelId: string; attempt: number }>) {
    const suffix = panels
        .map((panel) => `${panel.panelId}:${panel.attempt}`)
        .sort()
        .join(',')

    return `image-generation:${episodeId}:${suffix}`
}

export async function enqueueImageGen(episodeId: string, panelIds?: string[]) {
    const uniquePanelIds = getUniqueIds(panelIds)

    if (uniquePanelIds.length === 0) {
        return []
    }

    const payload = await getImageFanoutPayload(episodeId, uniquePanelIds)

    return inngest.send({
        id: buildImageGenerationEventId(episodeId, payload.panels),
        name: 'episode/image-generation.requested',
        data: {
            episodeId,
            userId: payload.userId,
            panels: payload.panels,
        },
    })
}

export async function cancelEpisodePipelineJobs(episodeId: string) {
    await inngest.send({
        id: `cancel:${episodeId}`,
        name: 'episode/cancel.requested',
        data: { episodeId },
    })

    return 1
}
