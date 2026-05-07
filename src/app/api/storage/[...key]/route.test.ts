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
        expect(mocks.read).toHaveBeenCalledWith('users/u/panel.png')
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
