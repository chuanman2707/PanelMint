import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
    routes: [] as string[],
    options: null as null | { signInUrl: string; signUpUrl: string },
}))

vi.mock('@clerk/nextjs/server', () => ({
    createRouteMatcher: (routes: string[]) => {
        state.routes = routes
        return (request: { nextUrl: { pathname: string } }) => {
            const pathname = request.nextUrl.pathname
            return routes.some((route) => {
                if (route === '/') return pathname === '/'
                if (route.endsWith('(.*)')) {
                    const prefix = route.slice(0, -4)
                    return pathname === prefix || pathname.startsWith(prefix)
                }
                return pathname === route
            })
        }
    },
    clerkMiddleware: (
        handler: (auth: { protect: () => Promise<void> }, request: { nextUrl: { pathname: string } }) => Promise<void>,
        options: { signInUrl: string; signUpUrl: string },
    ) => {
        state.options = options
        return handler
    },
}))

import proxy from './proxy'

describe('proxy route contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers the expected public route allowlist', () => {
        expect(state.routes).toEqual([
            '/',
            '/pricing(.*)',
            '/legal(.*)',
            '/auth(.*)',
            '/api/auth(.*)',
            '/api/health',
            '/api/inngest(.*)',
            '/api/webhooks/clerk',
        ])

        expect(state.options).toEqual({
            signInUrl: '/auth/signin',
            signUpUrl: '/auth/signup',
        })
    })

    it('does not protect public marketing routes', async () => {
        const protect = vi.fn()

        await proxy({ protect } as never, { nextUrl: { pathname: '/' } } as never)
        await proxy({ protect } as never, { nextUrl: { pathname: '/pricing' } } as never)
        await proxy({ protect } as never, { nextUrl: { pathname: '/legal' } } as never)

        expect(protect).not.toHaveBeenCalled()
    })

    it('protects authenticated app and immersive routes', async () => {
        const protect = vi.fn(async () => {})

        await proxy({ protect } as never, { nextUrl: { pathname: '/dashboard' } } as never)
        await proxy({ protect } as never, { nextUrl: { pathname: '/library' } } as never)
        await proxy({ protect } as never, { nextUrl: { pathname: '/read/ep_123' } } as never)
        await proxy({ protect } as never, { nextUrl: { pathname: '/editor/ep_123' } } as never)

        expect(protect).toHaveBeenCalledTimes(4)
    })
})
