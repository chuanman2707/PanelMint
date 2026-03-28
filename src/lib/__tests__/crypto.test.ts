import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, isEncrypted, maskApiKey } from '../crypto'

describe('Crypto Module (PBKDF2)', () => {
    describe('encrypt / decrypt', () => {
        it('should encrypt and decrypt a simple string', () => {
            const original = 'sk-or-v1-abc123def456'
            const encrypted = encrypt(original)
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe(original)
        })

        it('should produce hex format iv:authTag:encrypted', () => {
            const encrypted = encrypt('test-key')
            const parts = encrypted.split(':')
            expect(parts).toHaveLength(3)
            parts.forEach(part => {
                expect(part).toMatch(/^[0-9a-f]+$/i)
            })
        })

        it('should produce different ciphertexts for the same input (random IV)', () => {
            const original = 'sk-or-v1-same-key'
            const encrypted1 = encrypt(original)
            const encrypted2 = encrypt(original)
            expect(encrypted1).not.toBe(encrypted2)
            expect(decrypt(encrypted1)).toBe(original)
            expect(decrypt(encrypted2)).toBe(original)
        })

        it('should throw on empty string', () => {
            expect(() => encrypt('')).toThrow('Cannot encrypt empty value')
        })

        it('should handle unicode characters', () => {
            const original = '日本語のキー🔑'
            const encrypted = encrypt(original)
            expect(decrypt(encrypted)).toBe(original)
        })

        it('should handle long API keys', () => {
            const original = 'sk-or-v1-' + 'a'.repeat(200)
            const encrypted = encrypt(original)
            expect(decrypt(encrypted)).toBe(original)
        })

        it('should throw on invalid format', () => {
            expect(() => decrypt('not-valid')).toThrow('Invalid encrypted data format')
            expect(() => decrypt('')).toThrow('Cannot decrypt empty value')
        })
    })

    describe('isEncrypted', () => {
        it('should return true for encrypted values (hex:hex:hex)', () => {
            const encrypted = encrypt('test-key')
            expect(isEncrypted(encrypted)).toBe(true)
        })

        it('should return false for plaintext API keys', () => {
            expect(isEncrypted('sk-or-v1-abc123')).toBe(false)
        })

        it('should return false for short strings', () => {
            expect(isEncrypted('abc')).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(isEncrypted('')).toBe(false)
        })
    })

    describe('maskApiKey', () => {
        it('should mask a normal API key', () => {
            expect(maskApiKey('sk-or-v1-abc123def456')).toBe('sk-or-v...456')
        })

        it('should handle short keys', () => {
            expect(maskApiKey('short')).toBe('***')
        })
    })
})
