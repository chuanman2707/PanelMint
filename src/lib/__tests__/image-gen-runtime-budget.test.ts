import { describe, expect, it } from 'vitest'

import { WAVESPEED_IMAGE_POLL_TIMEOUT_MS } from '@/lib/pipeline/image-gen'

describe('WaveSpeed image runtime budget', () => {
    it('keeps panel polling below the Inngest step runtime envelope', () => {
        expect(WAVESPEED_IMAGE_POLL_TIMEOUT_MS).toBeLessThan(240_000)
    })
})
