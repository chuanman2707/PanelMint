import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const controller = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`[Worker] received ${signal}`)
        controller.abort()
    })
}

async function main() {
    const { runWorkerLoop } = await import('@/lib/queue/worker')
    await runWorkerLoop({ signal: controller.signal })
}

main().catch((error) => {
    console.error('[Worker] fatal error', error)
    process.exitCode = 1
})
