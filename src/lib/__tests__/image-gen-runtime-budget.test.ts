import { describe, expect, it } from 'vitest'

import { WAVESPEED_IMAGE_POLL_TIMEOUT_MS } from '@/lib/pipeline/image-gen'

describe('WaveSpeed image runtime budget', () => {
    it('keeps panel polling inside the local worker stale-lock window', () => {
        expect(WAVESPEED_IMAGE_POLL_TIMEOUT_MS).toBeLessThan(15 * 60_000)
    })
})
