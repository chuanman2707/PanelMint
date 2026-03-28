import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { validateEnv } from './env-validation'

const isNextBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

if (process.env.NODE_ENV === 'production' && !isNextBuildPhase) {
    validateEnv()
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL?.trim()
        || (process.env.NODE_ENV === 'test'
            ? 'postgresql://postgres:postgres@127.0.0.1:5432/weoweo?schema=public'
            : null)

    if (!connectionString) {
        throw new Error('DATABASE_URL is required to initialize Prisma.')
    }

    const adapter = new PrismaPg(connectionString)
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
