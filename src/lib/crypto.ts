/**
 * API Key Encryption (AES-256-GCM + PBKDF2)
 *
 * Uses PBKDF2 with 100K iterations (same as waoowaoo) for key derivation.
 * Format: iv:authTag:encrypted (hex) — easy to debug, same as waoowaoo.
 *
 * Requires ENCRYPTION_SECRET env var in production.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const KEY_LENGTH = 32
const PBKDF2_ITERATIONS = 100_000
const SALT = 'weoweo-api-key-salt-v1'

function deriveEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_SECRET is not configured. Cannot encrypt API keys in production.')
        }
        // Dev-only fallback — NEVER use in production
        return crypto.pbkdf2Sync('weoweo-dev-secret-DO-NOT-USE-IN-PROD', SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
    }
    return crypto.pbkdf2Sync(secret, SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt a plaintext API key.
 * Returns: "iv:authTag:encrypted" (hex-encoded)
 */
export function encrypt(plaintext: string): string {
    if (!plaintext || plaintext.trim() === '') {
        throw new Error('Cannot encrypt empty value')
    }

    const key = deriveEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    return [
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted.toString('hex'),
    ].join(':')
}

/**
 * Decrypt an encrypted API key.
 * Expects: "iv:authTag:encrypted" (hex-encoded)
 */
export function decrypt(ciphertext: string): string {
    if (!ciphertext || ciphertext.trim() === '') {
        throw new Error('Cannot decrypt empty value')
    }

    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format (expected iv:authTag:encrypted)')
    }

    const [ivHex, authTagHex, encryptedHex] = parts
    const key = deriveEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ])

    return decrypted.toString('utf8')
}

/**
 * Check if a string looks like our encrypted format (hex:hex:hex).
 */
export function isEncrypted(value: string): boolean {
    if (!value || value.length < 10) return false
    const parts = value.split(':')
    return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p))
}

/**
 * Mask an API key for display: "sk-or-v1-abc...xyz"
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '***'
    return `${key.slice(0, 7)}...${key.slice(-3)}`
}
