import { randomUUID } from 'crypto'
import { hostname } from 'os'
import { handlePipelineJob } from '@/lib/queue/handlers'
import {
    claimPipelineJobs,
    completePipelineJob,
    failPipelineJob,
    type PipelineJobRecord,
} from '@/lib/queue/repository'

const DEFAULT_CLAIM_LIMIT = 3
const DEFAULT_STALE_AFTER_MS = 15 * 60_000
const DEFAULT_POLL_INTERVAL_MS = 1_000
const BASE_RETRY_DELAY_MS = 5_000

export function createWorkerId(): string {
    return `${hostname()}:${process.pid}:${randomUUID()}`
}

export function getRetryDelayMs(job: Pick<PipelineJobRecord, 'attempts'>): number {
    return BASE_RETRY_DELAY_MS * Math.max(1, job.attempts)
}

export async function runWorkerOnce(input: {
    workerId: string
    claimLimit?: number
    staleAfterMs?: number
}): Promise<number> {
    const jobs = await claimPipelineJobs({
        workerId: input.workerId,
        limit: input.claimLimit ?? DEFAULT_CLAIM_LIMIT,
        staleAfterMs: input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
    })

    await Promise.all(jobs.map(async (job) => {
        try {
            await handlePipelineJob(job)
            await completePipelineJob({
                jobId: job.id,
                workerId: input.workerId,
            })
        } catch (error) {
            await failPipelineJob({
                jobId: job.id,
                workerId: input.workerId,
                error,
                attempts: job.attempts,
                maxAttempts: job.maxAttempts,
                retryDelayMs: getRetryDelayMs(job),
            })
        }
    }))

    return jobs.length
}

export async function runWorkerLoop(input: {
    workerId?: string
    pollIntervalMs?: number
    signal?: AbortSignal
} = {}): Promise<void> {
    const workerId = input.workerId ?? createWorkerId()
    const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

    console.log(`[Worker] started ${workerId}`)

    while (!input.signal?.aborted) {
        const count = await runWorkerOnce({ workerId })
        if (count === 0) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        }
    }

    console.log(`[Worker] stopped ${workerId}`)
}
