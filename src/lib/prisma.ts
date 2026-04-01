import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { validateEnv } from './env-validation'

const isNextBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const BUILD_FALLBACK_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/panelmint?schema=public'

if (process.env.NODE_ENV === 'production' && !isNextBuildPhase) {
    validateEnv()
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient
    prismaPool?: Pool
}

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL?.trim()
        || ((process.env.NODE_ENV === 'test' || isNextBuildPhase)
            ? BUILD_FALLBACK_DATABASE_URL
            : null)

    if (!connectionString) {
        throw new Error('DATABASE_URL is required to initialize Prisma.')
    }

    const pool = process.env.NODE_ENV === 'production'
        ? new Pool({ connectionString })
        : (globalForPrisma.prismaPool ??= new Pool({ connectionString }))

    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
