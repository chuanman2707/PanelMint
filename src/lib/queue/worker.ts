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

async function runClaimedJob(job: PipelineJobRecord, workerId: string): Promise<void> {
    try {
        await handlePipelineJob(job)
    } catch (error) {
        await failPipelineJob({
            jobId: job.id,
            workerId,
            error,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            retryDelayMs: getRetryDelayMs(job),
        })
        return
    }

    const completed = await completePipelineJob({
        jobId: job.id,
        workerId,
    })

    if (!completed) {
        console.warn(`[Worker] skipped completion for unowned job ${job.id}`)
    }
}

async function waitForPollInterval(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0 || signal?.aborted) return

    await new Promise<void>((resolve) => {
        const done = () => {
            clearTimeout(timeout)
            signal?.removeEventListener('abort', done)
            resolve()
        }

        const timeout = setTimeout(done, ms)
        signal?.addEventListener('abort', done, { once: true })
    })
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

    const results = await Promise.allSettled(
        jobs.map((job) => runClaimedJob(job, input.workerId)),
    )
    const failures = results.filter((result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    )

    if (failures.length === 1) throw failures[0].reason
    if (failures.length > 1) {
        throw new AggregateError(
            failures.map((failure) => failure.reason),
            'One or more pipeline jobs failed after handler completion.',
        )
    }

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
            await waitForPollInterval(pollIntervalMs, input.signal)
        }
    }

    console.log(`[Worker] stopped ${workerId}`)
}
