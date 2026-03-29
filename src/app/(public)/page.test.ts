import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    redirect: vi.fn((target: string) => {
        throw new Error(`REDIRECT:${target}`)
    }),
}))

vi.mock('@clerk/nextjs/server', () => ({
    auth: mocks.auth,
}))

vi.mock('next/navigation', () => ({
    redirect: mocks.redirect,
}))

import LandingPage from './page'

describe('LandingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirects authenticated users to /dashboard', async () => {
        mocks.auth.mockResolvedValue({ userId: 'user_123' })

        await expect(LandingPage()).rejects.toThrow('REDIRECT:/dashboard')
        expect(mocks.redirect).toHaveBeenCalledWith('/dashboard')
    })

    it('renders the public landing page for anonymous users', async () => {
        mocks.auth.mockResolvedValue({ userId: null })

        const page = await LandingPage()

        expect(page).toBeTruthy()
        expect(mocks.redirect).not.toHaveBeenCalled()
    })
})
