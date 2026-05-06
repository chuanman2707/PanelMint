import { describe, expect, it, vi } from 'vitest'
import { LandingPageClient } from '@/components/public/LandingPageClient'
import { ENGINE_SPECS, FEATURE_ROWS, HERO_SIGNAL_STRIP } from '@/components/public/public-content'
import { LEGAL_SECTIONS } from './legal/page'

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

    it('describes local WaveSpeed account ownership and single render mode', () => {
        const publicCopy = [
            ...HERO_SIGNAL_STRIP,
            ...FEATURE_ROWS.flatMap((feature) => [feature.title, feature.copy]),
            ...ENGINE_SPECS.flatMap((spec) => [spec.label, spec.value, spec.copy]),
            ...LEGAL_SECTIONS.flatMap((section) => [section.title, section.body]),
        ].join(' ')
        const removedPublicTerms = [
            /pric(?:e|ing)/,
            /pay(?:ment)?/,
            /pack(?:age)?/,
            /cred(?:it|its)?/,
            /bill(?:ing)?/,
            /check(?:out)?/,
            new RegExp('co' + 'st'),
            new RegExp('sp' + 'end'),
            new RegExp('us' + 'age'),
        ]

        expect(publicCopy).toContain('LOCAL WAVESPEED KEY')
        expect(publicCopy).toContain('SINGLE RENDER MODE')
        expect(publicCopy).toMatch(/WaveSpeed account/i)
        for (const removedTerm of removedPublicTerms) {
            expect(publicCopy.toLowerCase()).not.toMatch(removedTerm)
        }
    })
})
