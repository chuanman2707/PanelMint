import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    runAnalyzeStep: vi.fn(),
    runStoryboardStep: vi.fn(),
    runImageGenStep: vi.fn(),
    getCharacterSheetDispatchPayloads: vi.fn(),
    runCharacterSheetStep: vi.fn(),
    enqueuePipelineJob: vi.fn(),
}))

vi.mock('@/lib/pipeline/orchestrator', () => ({
    runAnalyzeStep: mocks.runAnalyzeStep,
    runStoryboardStep: mocks.runStoryboardStep,
    runImageGenStep: mocks.runImageGenStep,
}))

vi.mock('@/lib/pipeline/character-sheet-step', () => ({
    getCharacterSheetDispatchPayloads: mocks.getCharacterSheetDispatchPayloads,
    runCharacterSheetStep: mocks.runCharacterSheetStep,
}))

vi.mock('@/lib/queue/repository', () => ({
    enqueuePipelineJob: mocks.enqueuePipelineJob,
}))

import { handlePipelineJob } from '@/lib/queue/handlers'
import type { PipelineJobRecord } from '@/lib/queue/repository'

function job(type: PipelineJobRecord['type'], payload: Record<string, unknown>): PipelineJobRecord {
    return {
        id: `job-${type}`,
        episodeId: 'ep-1',
        userId: 'user-1',
        type,
        payload: JSON.stringify(payload),
        status: 'running',
        attempts: 1,
        maxAttempts: 3,
        availableAt: new Date(),
        lockedAt: new Date(),
        lockedBy: 'worker-1',
        lastError: null,
        dedupeKey: `${type}:ep-1`,
    }
}

describe('handlePipelineJob', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCharacterSheetDispatchPayloads.mockResolvedValue({
            userId: 'user-1',
            characterIds: ['char-1', 'char-2'],
        })
        mocks.enqueuePipelineJob.mockResolvedValue({ id: 'child-job' })
    })

    it('runs analyze payloads', async () => {
        await handlePipelineJob(job('analyze', {
            episodeId: 'ep-1',
            userId: 'user-1',
            projectId: 'project-1',
            text: 'chapter',
            artStyle: 'webtoon',
            pageCount: 12,
        }))

        expect(mocks.runAnalyzeStep).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            text: 'chapter',
        }))
    })

    it('fans out character sheet jobs', async () => {
        await handlePipelineJob(job('character-sheets-parent', { episodeId: 'ep-1' }))

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledTimes(2)
        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            type: 'character-sheet',
            dedupeKey: 'character-sheet:ep-1:char-1',
        }))
    })

    it('runs one image panel job', async () => {
        await handlePipelineJob(job('image-panel', {
            episodeId: 'ep-1',
            userId: 'user-1',
            panelId: 'panel-1',
        }))

        expect(mocks.runImageGenStep).toHaveBeenCalledWith('ep-1', ['panel-1'])
    })
})
