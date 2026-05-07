import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    claimPipelineJobs: vi.fn(),
    completePipelineJob: vi.fn(),
    failPipelineJob: vi.fn(),
    handlePipelineJob: vi.fn(),
}))

vi.mock('@/lib/queue/repository', () => ({
    claimPipelineJobs: mocks.claimPipelineJobs,
    completePipelineJob: mocks.completePipelineJob,
    failPipelineJob: mocks.failPipelineJob,
}))

vi.mock('@/lib/queue/handlers', () => ({
    handlePipelineJob: mocks.handlePipelineJob,
}))

import { runWorkerOnce } from '@/lib/queue/worker'

describe('queue worker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('claims and completes jobs', async () => {
        const job = { id: 'job-1', attempts: 1, maxAttempts: 3 }
        mocks.claimPipelineJobs.mockResolvedValue([job])
        mocks.handlePipelineJob.mockResolvedValue(undefined)

        await runWorkerOnce({ workerId: 'worker-1', claimLimit: 1, staleAfterMs: 60_000 })

        expect(mocks.handlePipelineJob).toHaveBeenCalledWith(job)
        expect(mocks.completePipelineJob).toHaveBeenCalledWith({
            jobId: 'job-1',
            workerId: 'worker-1',
        })
    })

    it('records retryable job failures', async () => {
        const error = new Error('boom')
        const job = { id: 'job-1', attempts: 1, maxAttempts: 3 }
        mocks.claimPipelineJobs.mockResolvedValue([job])
        mocks.handlePipelineJob.mockRejectedValue(error)

        await runWorkerOnce({ workerId: 'worker-1', claimLimit: 1, staleAfterMs: 60_000 })

        expect(mocks.failPipelineJob).toHaveBeenCalledWith({
            jobId: 'job-1',
            workerId: 'worker-1',
            error,
            attempts: 1,
            maxAttempts: 3,
            retryDelayMs: 5_000,
        })
    })

    it('does not mark a completed handler as failed when completion update fails', async () => {
        const error = new Error('complete failed')
        const job = { id: 'job-1', attempts: 1, maxAttempts: 3 }
        mocks.claimPipelineJobs.mockResolvedValue([job])
        mocks.handlePipelineJob.mockResolvedValue(undefined)
        mocks.completePipelineJob.mockRejectedValue(error)

        await expect(runWorkerOnce({
            workerId: 'worker-1',
            claimLimit: 1,
            staleAfterMs: 60_000,
        })).rejects.toThrow('complete failed')

        expect(mocks.failPipelineJob).not.toHaveBeenCalled()
    })
})
