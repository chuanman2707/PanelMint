import { describe, expect, it, vi } from 'vitest'
import { LandingPageClient } from '@/components/public/LandingPageClient'

vi.mock('@/components/public/LandingPageClient', () => ({
    LandingPageClient: vi.fn(() => null),
}))

import LandingPage from './page'

describe('LandingPage', () => {
    it('renders the public landing page without server-side identity checks', () => {
        const page = LandingPage()

        expect(page).toMatchObject({
            type: LandingPageClient,
            props: {},
        })
    })
})
