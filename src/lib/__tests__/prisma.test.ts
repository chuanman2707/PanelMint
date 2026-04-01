import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('prisma bootstrap', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllEnvs()
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:5432/panelmint?schema=public')
        delete process.env.NEXT_PHASE
        delete (globalThis as { prisma?: unknown }).prisma
        delete (globalThis as { prismaPool?: unknown }).prismaPool
    })

    it('initializes PrismaPg with a pg Pool', async () => {
        const PoolMock = vi.fn(function Pool(this: { options?: unknown }, options: unknown) {
            this.options = options
        })
        const PrismaPgMock = vi.fn()
        const PrismaClientMock = vi.fn(function PrismaClient() {})

        vi.doMock('pg', () => ({
            Pool: PoolMock,
        }))
        vi.doMock('@prisma/adapter-pg', () => ({
            PrismaPg: PrismaPgMock,
        }))
        vi.doMock('@prisma/client', () => ({
            PrismaClient: PrismaClientMock,
        }))

        await import('@/lib/prisma')

        expect(PoolMock).toHaveBeenCalledWith({
            connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/panelmint?schema=public',
        })
        expect(PrismaPgMock).toHaveBeenCalledWith(PoolMock.mock.instances[0])
        expect(PrismaClientMock).toHaveBeenCalledWith({
            adapter: PrismaPgMock.mock.results[0]?.value,
        })
    })
})
