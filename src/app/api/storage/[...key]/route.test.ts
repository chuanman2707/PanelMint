import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    read: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({ read: mocks.read }),
}))

import { GET } from './route'

describe('GET /api/storage/[...key]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.read.mockResolvedValue({
            buffer: Buffer.from('image-bytes'),
            contentType: 'image/png',
        })
    })

    it('serves local storage bytes', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/storage/users/u/panel.png'),
            { params: Promise.resolve({ key: ['users', 'u', 'panel.png'] }) },
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/png')
        await expect(response.arrayBuffer()).resolves.toEqual(
            Uint8Array.from(Buffer.from('image-bytes')).buffer,
        )
        expect(mocks.read).toHaveBeenCalledWith('users/u/panel.png')
    })

    it('rejects traversal keys', async () => {
        mocks.read.mockRejectedValue(new Error('Invalid storage key'))

        const response = await GET(
            new NextRequest('http://localhost/api/storage/%2e%2e/secret.png'),
            { params: Promise.resolve({ key: ['%2e%2e', 'secret.png'] }) },
        )

        expect(response.status).toBe(404)
        expect(mocks.read).toHaveBeenCalledWith('../secret.png')
    })

    it('returns 404 for missing keys', async () => {
        mocks.read.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }))

        const response = await GET(
            new NextRequest('http://localhost/api/storage/users/u/missing.png'),
            { params: Promise.resolve({ key: ['users', 'u', 'missing.png'] }) },
        )

        expect(response.status).toBe(404)
    })
})
