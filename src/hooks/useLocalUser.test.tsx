import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/test/render'
import { LocalUserProvider, useLocalUser } from '@/hooks/useLocalUser'

function wrapper({ children }: { children: ReactNode }) {
    return <LocalUserProvider>{children}</LocalUserProvider>
}

describe('useLocalUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('hydrates the local owner from /api/local-user', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            user: {
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))

        const { result } = renderHook(() => useLocalUser(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toEqual({
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            })
        })
    })

    it('keeps loading false and user null when hydration fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

        const { result } = renderHook(() => useLocalUser(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toBeNull()
        })
    })
})
