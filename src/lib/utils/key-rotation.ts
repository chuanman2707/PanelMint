/**
 * Google AI API Key Rotation
 *
 * Supports multiple API keys via comma-separated GOOGLE_AI_API_KEY env var.
 * When a key hits rate limit (429), it's cooled down for 60s and the next key is used.
 *
 * Usage in .env:
 *   GOOGLE_AI_API_KEY=key1,key2,key3
 */

import { GoogleGenAI } from '@google/genai'

interface KeyState {
    key: string
    cooldownUntil: number  // timestamp when key becomes available again
}

const COOLDOWN_MS = 60_000  // 60 seconds cooldown after rate limit

let keyStates: KeyState[] | null = null
let currentIndex = 0

function initKeys(): KeyState[] {
    if (keyStates) return keyStates

    const raw = process.env.GOOGLE_AI_API_KEY
    if (!raw) throw new Error('GOOGLE_AI_API_KEY is not set')

    const keys = raw.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) throw new Error('GOOGLE_AI_API_KEY has no valid keys')

    keyStates = keys.map(key => ({ key, cooldownUntil: 0 }))
    console.log(`[KeyRotation] Loaded ${keys.length} API key(s)`)
    return keyStates
}

/**
 * Get the next available API key, skipping cooled-down keys.
 * Returns the key string and its index.
 */
function getNextAvailableKey(): { key: string; index: number } {
    const states = initKeys()
    const now = Date.now()

    // Try all keys starting from current index
    for (let i = 0; i < states.length; i++) {
        const idx = (currentIndex + i) % states.length
        if (states[idx].cooldownUntil <= now) {
            currentIndex = idx
            return { key: states[idx].key, index: idx }
        }
    }

    // All keys are on cooldown — find the one that recovers soonest
    const soonest = states.reduce((min, s, i) =>
        s.cooldownUntil < states[min].cooldownUntil ? i : min, 0)
    const waitMs = states[soonest].cooldownUntil - now
    console.warn(`[KeyRotation] All ${states.length} keys on cooldown. Soonest recovery in ${Math.ceil(waitMs / 1000)}s (key ${soonest + 1})`)

    currentIndex = soonest
    return { key: states[soonest].key, index: soonest }
}

/**
 * Mark a key as rate-limited (cooldown for 60 seconds).
 */
function markRateLimited(index: number): void {
    const states = initKeys()
    states[index].cooldownUntil = Date.now() + COOLDOWN_MS
    console.warn(`[KeyRotation] Key ${index + 1}/${states.length} rate-limited, cooling down for ${COOLDOWN_MS / 1000}s`)
}

/**
 * Check if an error is a rate limit error (HTTP 429 or similar).
 */
function isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        return msg.includes('429') ||
            msg.includes('rate limit') ||
            msg.includes('quota') ||
            msg.includes('resource_exhausted') ||
            msg.includes('too many requests')
    }
    return false
}

// Cache of GoogleGenAI instances per key
const aiInstances = new Map<string, GoogleGenAI>()

/**
 * Get a GoogleGenAI instance with automatic key rotation.
 * Returns the instance + key index (for marking rate limits).
 */
export function getGoogleAI(): { ai: GoogleGenAI; keyIndex: number } {
    const { key, index } = getNextAvailableKey()

    if (!aiInstances.has(key)) {
        aiInstances.set(key, new GoogleGenAI({ apiKey: key }))
    }

    return { ai: aiInstances.get(key)!, keyIndex: index }
}

/**
 * Execute a Google AI operation with automatic key rotation and retry.
 * If a key hits rate limit, it's cooled down and the operation retries with the next key.
 */
export async function withKeyRotation<T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
): Promise<T> {
    const states = initKeys()
    const maxAttempts = states.length + 1  // try each key once + 1 retry

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { ai, keyIndex } = getGoogleAI()

        try {
            return await operation(ai)
        } catch (error) {
            if (isRateLimitError(error)) {
                markRateLimited(keyIndex)
                // Move to next key
                currentIndex = (keyIndex + 1) % states.length
                console.log(`[KeyRotation] Retrying with key ${currentIndex + 1}/${states.length} (attempt ${attempt + 2}/${maxAttempts})`)
                continue
            }
            throw error  // non-rate-limit error, propagate immediately
        }
    }

    throw new Error(`[KeyRotation] All ${states.length} keys exhausted after ${maxAttempts} attempts`)
}

/**
 * Get rotation status for debugging.
 */
export function getRotationStatus(): { total: number; available: number; cooldowns: string[] } {
    const states = initKeys()
    const now = Date.now()
    const available = states.filter(s => s.cooldownUntil <= now).length
    const cooldowns = states
        .filter(s => s.cooldownUntil > now)
        .map((s, i) => `key ${i + 1}: ${Math.ceil((s.cooldownUntil - now) / 1000)}s remaining`)

    return { total: states.length, available, cooldowns }
}
