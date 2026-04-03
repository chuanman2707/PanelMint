import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/test/render'
import { AuthProvider, useAuth } from '@/hooks/useAuth'

const mocks = vi.hoisted(() => ({
    useUser: vi.fn(),
    useClerk: vi.fn(),
    signOut: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
    useUser: mocks.useUser,
    useClerk: mocks.useClerk,
}))

function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
}

describe('useAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useClerk.mockReturnValue({ signOut: mocks.signOut })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('clears the user and stops loading when Clerk is loaded but signed out', async () => {
        mocks.useUser.mockReturnValue({
            isLoaded: true,
            isSignedIn: false,
            user: null,
        })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toBeNull()
        })
    })

    it('hydrates the domain user from /api/auth/me when the session is signed in', async () => {
        mocks.useUser.mockReturnValue({
            isLoaded: true,
            isSignedIn: true,
            user: { id: 'clerk-user-1' },
        })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            user: {
                id: 'user-1',
                email: 'linh@example.com',
                name: 'Linh',
                credits: 120,
                accountTier: 'paid',
            },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
            expect(result.current.user).toEqual({
                id: 'user-1',
                email: 'linh@example.com',
                name: 'Linh',
                credits: 120,
                accountTier: 'paid',
            })
        })
    })
})
