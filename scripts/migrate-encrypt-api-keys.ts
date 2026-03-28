/**
 * Migration script: Encrypt existing plaintext API keys
 *
 * Usage: npx tsx scripts/migrate-encrypt-api-keys.ts
 *
 * Safe to run multiple times — skips already-encrypted keys.
 */

import { PrismaClient } from '@prisma/client'

// We can't use the @/ alias here since this runs outside Next.js
// So we import crypto functions directly
import { createCipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET || 'weoweo-dev-secret-change-in-production'
    const salt = process.env.ENCRYPTION_SALT || 'weoweo-dev-salt-change-in-production'
    return scryptSync(salt, secret, 32)
}

function encrypt(plaintext: string): string {
    const key = getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    const authTag = cipher.getAuthTag()
    const combined = Buffer.concat([iv, encrypted, authTag])
    return combined.toString('base64')
}

function isEncrypted(value: string): boolean {
    if (value.length < 44) return false
    try {
        const buf = Buffer.from(value, 'base64')
        return buf.length > IV_LENGTH + TAG_LENGTH
    } catch {
        return false
    }
}

async function main() {
    const prisma = new PrismaClient()

    try {
        const users = await prisma.user.findMany({
            where: { apiKey: { not: null } },
            select: { id: true, email: true, apiKey: true },
        })

        console.log(`Found ${users.length} users with API keys`)

        let migrated = 0
        let skipped = 0

        for (const user of users) {
            if (!user.apiKey) continue

            if (isEncrypted(user.apiKey)) {
                console.log(`  [SKIP] ${user.email} — already encrypted`)
                skipped++
                continue
            }

            const encrypted = encrypt(user.apiKey)
            await prisma.user.update({
                where: { id: user.id },
                data: { apiKey: encrypted },
            })

            console.log(`  [OK] ${user.email} — key encrypted`)
            migrated++
        }

        console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}`)
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
})
