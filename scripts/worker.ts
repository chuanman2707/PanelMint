import { runWorkerLoop } from '@/lib/queue/worker'

const controller = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`[Worker] received ${signal}`)
        controller.abort()
    })
}

runWorkerLoop({ signal: controller.signal }).catch((error) => {
    console.error('[Worker] fatal error', error)
    process.exitCode = 1
})
