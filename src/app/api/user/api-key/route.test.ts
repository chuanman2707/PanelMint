import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalUserApiKey: vi.fn(),
    setLocalUserApiKey: vi.fn(),
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalUserApiKey: mocks.getLocalUserApiKey,
    setLocalUserApiKey: mocks.setLocalUserApiKey,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { DELETE, GET, POST } from './route'

describe('/api/user/api-key', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalUserApiKey.mockResolvedValue('sk-live-1234')
        mocks.prisma.user.findUnique.mockResolvedValue({
            apiKey: 'encrypted',
            apiProvider: 'wavespeed',
        })
        mocks.setLocalUserApiKey.mockResolvedValue(undefined)
    })

    it('returns masked key metadata for the signed-in user', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/user/api-key', {
                method: 'GET',
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            select: { apiKey: true, apiProvider: true },
        })
        expect(mocks.getLocalUserApiKey).toHaveBeenCalledWith('user-1')
        await expect(response.json()).resolves.toMatchObject({
            hasKey: true,
            maskedKey: 'sk-liv...1234',
            provider: 'wavespeed',
        })
    })

    it('validates the provider key when validate=true is requested', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('{}', { status: 200 }),
        ))

        const response = await GET(
            new NextRequest('http://localhost/api/user/api-key?validate=true', {
                method: 'GET',
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ valid: true })
    })

    it('returns 400 when provider is invalid', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/user/api-key', {
                method: 'POST',
                body: JSON.stringify({ apiKey: 'sk-test', provider: 'invalid' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(400)
        expect(mocks.setLocalUserApiKey).not.toHaveBeenCalled()
    })

    it('stores a trimmed key for a valid provider', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/user/api-key', {
                method: 'POST',
                body: JSON.stringify({ apiKey: '  ws-live-1234  ', provider: 'wavespeed' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.setLocalUserApiKey).toHaveBeenCalledWith('user-1', 'ws-live-1234', 'wavespeed')
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            provider: 'wavespeed',
        })
    })

    it('clears the stored API key on DELETE', async () => {
        const response = await DELETE(
            new NextRequest('http://localhost/api/user/api-key', {
                method: 'DELETE',
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.setLocalUserApiKey).toHaveBeenCalledWith('user-1', null)
    })
})
