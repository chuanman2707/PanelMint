import type { ReactNode } from 'react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/test/render'
import { LocalUserProvider, useLocalUser } from '@/hooks/useLocalUser'

function wrapper({ children }: { children: ReactNode }) {
    return <LocalUserProvider>{children}</LocalUserProvider>
}

function localUser(id: string, credits: number) {
    return {
        id,
        email: `${id}@panelmint.dev`,
        name: `Creator ${id}`,
        credits,
        accountTier: 'free',
    }
}

function jsonResponse(user: ReturnType<typeof localUser>) {
    return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    })
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })

    return { promise, resolve }
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

    it('keeps the latest refresh result when responses resolve out of order', async () => {
        const initialUser = localUser('local-user-initial', 300)
        const staleUser = localUser('local-user-stale', 100)
        const latestUser = localUser('local-user-latest', 500)
        const staleRefresh = deferred<Response>()
        const latestRefresh = deferred<Response>()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse(initialUser))
            .mockReturnValueOnce(staleRefresh.promise)
            .mockReturnValueOnce(latestRefresh.promise)

        vi.stubGlobal('fetch', fetchMock)

        const { result } = renderHook(() => useLocalUser(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toEqual(initialUser)
        })

        await act(async () => {
            void result.current.refresh()
            void result.current.refresh()
        })

        await act(async () => {
            latestRefresh.resolve(jsonResponse(latestUser))
            await latestRefresh.promise
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toEqual(latestUser)
        })

        await act(async () => {
            staleRefresh.resolve(jsonResponse(staleUser))
            await staleRefresh.promise
        })

        expect(result.current.user).toEqual(latestUser)
    })
})
