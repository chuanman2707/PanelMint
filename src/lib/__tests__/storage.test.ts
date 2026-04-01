import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LocalStorageProvider, buildStorageKey, buildStorageProxyUrl, createStorageProvider } from '@/lib/storage'
import { writeFile, mkdir, unlink } from 'fs/promises'

vi.mock('fs/promises')

describe('LocalStorageProvider', () => {
    beforeEach(() => {
        vi.mocked(mkdir).mockResolvedValue(undefined as unknown as string)
        vi.mocked(writeFile).mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('saves buffer to local filesystem and returns URL path', async () => {
        const provider = new LocalStorageProvider()
        const buffer = Buffer.from('fake-image-data')
        const key = 'user123/episode456/panel789-abc.png'

        const url = await provider.upload(buffer, key)

        expect(mkdir).toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalled()
        expect(url).toMatch(/^\/generated\//)
        expect(url).toContain('.png')
    })

    it('getSignedUrl returns the path as-is for local storage', async () => {
        const provider = new LocalStorageProvider()
        const url = await provider.getSignedUrl('some/key.png')

        expect(url).toBe('/generated/key.png')
    })

    it('delete removes file from filesystem', async () => {
        vi.mocked(unlink).mockResolvedValue(undefined)
        const provider = new LocalStorageProvider()
        await provider.delete('test/key.png')

        expect(unlink).toHaveBeenCalled()
    })
})

describe('createStorageProvider', () => {
    it('returns LocalStorageProvider when R2 env vars are not set', () => {
        delete process.env.R2_ACCOUNT_ID
        const provider = createStorageProvider()
        expect(provider).toBeInstanceOf(LocalStorageProvider)
    })
})

describe('buildStorageKey', () => {
    it('builds a nested png key using user and episode identifiers', () => {
        const key = buildStorageKey('user-1', 'episode-1', 'panel-1')
        expect(key).toMatch(/^user-1\/episode-1\/panel-1-.+\.png$/)
    })
})

describe('buildStorageProxyUrl', () => {
    it('builds a stable storage proxy URL from a storage key', () => {
        expect(buildStorageProxyUrl('user-1/episode-1/panel-1.png')).toBe('/api/storage/user-1/episode-1/panel-1.png')
    })
})
