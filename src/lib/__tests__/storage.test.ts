import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import {
    LocalStorageProvider,
    buildStorageKey,
    buildStorageProxyUrl,
    createStorageProvider,
    getContentTypeForStorageKey,
    getStorageBaseDir,
    normalizeStorageKey,
} from '@/lib/storage'

vi.mock('fs/promises')

describe('local storage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('PANELMINT_STORAGE_DIR', '/tmp/panelmint-generated')
        vi.mocked(mkdir).mockResolvedValue(undefined as unknown as string)
        vi.mocked(writeFile).mockResolvedValue(undefined)
        vi.mocked(readFile).mockResolvedValue(Buffer.from('image'))
        vi.mocked(stat).mockResolvedValue({ isFile: () => true } as never)
        vi.mocked(unlink).mockResolvedValue(undefined)
    })

    it('normalizes safe relative keys', () => {
        expect(normalizeStorageKey('users/u/episodes/e/panel.png')).toBe('users/u/episodes/e/panel.png')
    })

    it('rejects path traversal and absolute keys', () => {
        expect(() => normalizeStorageKey('../secret.png')).toThrow('Invalid storage key')
        expect(() => normalizeStorageKey('..\\secret.png')).toThrow('Invalid storage key')
        expect(() => normalizeStorageKey('/tmp/secret.png')).toThrow('Invalid storage key')
        expect(() => normalizeStorageKey('C:\\tmp\\secret.png')).toThrow('Invalid storage key')
    })

    it('uploads under PANELMINT_STORAGE_DIR and returns the normalized key', async () => {
        const provider = new LocalStorageProvider()
        const buffer = Buffer.from('image')

        await expect(provider.upload(buffer, 'users/u/panel.png')).resolves.toBe('users/u/panel.png')
        expect(writeFile).toHaveBeenCalledWith(
            '/tmp/panelmint-generated/users/u/panel.png',
            buffer,
        )
    })

    it('defaults generated assets under the local workspace', () => {
        vi.stubEnv('PANELMINT_STORAGE_DIR', '')

        expect(getStorageBaseDir()).toBe(join(process.cwd(), '.panelmint', 'generated'))
    })

    it('reads local files with content type', async () => {
        const provider = new LocalStorageProvider()
        await expect(provider.read('users/u/panel.png')).resolves.toMatchObject({
            contentType: 'image/png',
            buffer: expect.any(Buffer),
        })
    })

    it('builds storage proxy URLs', () => {
        expect(buildStorageProxyUrl('users/u/panel 1.png')).toBe('/api/storage/users/u/panel%201.png')
    })

    it('maps image extensions to content type', () => {
        expect(getContentTypeForStorageKey('a.webp')).toBe('image/webp')
        expect(getContentTypeForStorageKey('a.txt')).toBe('application/octet-stream')
    })

    it('always creates local storage provider', () => {
        expect(createStorageProvider()).toBeInstanceOf(LocalStorageProvider)
    })

    it('builds nested panel storage keys', () => {
        expect(buildStorageKey('user-1', 'episode-1', 'panel-1')).toMatch(
            /^users\/user-1\/episodes\/episode-1\/panels\/panel-1-.+\.png$/,
        )
    })
})
