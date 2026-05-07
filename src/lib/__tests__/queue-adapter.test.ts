import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    enqueuePipelineJob: vi.fn(),
    cancelEpisodeJobs: vi.fn(),
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
        panel: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/queue/repository', () => ({
    enqueuePipelineJob: mocks.enqueuePipelineJob,
    cancelEpisodeJobs: mocks.cancelEpisodeJobs,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import {
    cancelEpisodePipelineJobs,
    enqueueAnalyze,
    enqueueCharacterSheets,
    enqueueImageGen,
    enqueueStoryboard,
} from '@/lib/queue'

describe('queue adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.enqueuePipelineJob.mockResolvedValue({ id: 'job-1' })
        mocks.cancelEpisodeJobs.mockResolvedValue(2)
        mocks.prisma.episode.findUnique.mockResolvedValue({
            project: { userId: 'user-1' },
        })
        mocks.prisma.panel.findMany.mockResolvedValue([
            { id: 'panel-2', generationAttempt: 2 },
            { id: 'panel-1', generationAttempt: 0 },
        ])
    })

    it('enqueues analyze jobs in Postgres', async () => {
        await enqueueAnalyze({
            episodeId: 'ep-1',
            userId: 'user-1',
            projectId: 'project-1',
            text: 'chapter',
            artStyle: 'webtoon',
            pageCount: 12,
        })

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'analyze',
            dedupeKey: 'analyze:ep-1',
        }))
    })

    it('enqueues storyboard and character parent jobs', async () => {
        await enqueueStoryboard('ep-1')
        await enqueueCharacterSheets('ep-1')

        expect(mocks.enqueuePipelineJob).toHaveBeenNthCalledWith(1, expect.objectContaining({
            type: 'storyboard',
            dedupeKey: 'storyboard:ep-1',
        }))
        expect(mocks.enqueuePipelineJob).toHaveBeenNthCalledWith(2, expect.objectContaining({
            type: 'character-sheets-parent',
            dedupeKey: 'character-sheets-parent:ep-1',
        }))
    })

    it('deduplicates panel ids and builds stable image parent dedupe key', async () => {
        await enqueueImageGen('ep-1', ['panel-1', 'panel-2', 'panel-1'])

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'image-generation-parent',
            payload: {
                episodeId: 'ep-1',
                panelIds: ['panel-1', 'panel-2'],
            },
            dedupeKey: 'image-generation-parent:ep-1:panel-1,panel-2',
        }))
    })

    it('returns no jobs for empty image panel list', async () => {
        await expect(enqueueImageGen('ep-1', [])).resolves.toEqual([])
        expect(mocks.enqueuePipelineJob).not.toHaveBeenCalled()
    })

    it('cancels active jobs through repository', async () => {
        await expect(cancelEpisodePipelineJobs('ep-1')).resolves.toBe(2)
        expect(mocks.cancelEpisodeJobs).toHaveBeenCalledWith('ep-1')
    })
})
