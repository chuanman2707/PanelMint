import { describe, expect, it } from 'vitest'
import { trimPromptToBudget } from '@/lib/pipeline/image-gen'

describe('trimPromptToBudget', () => {
    it('returns the prompt unchanged when under budget', () => {
        expect(trimPromptToBudget('short prompt', 20)).toBe('short prompt')
    })

    it('returns the prompt unchanged when exactly at budget', () => {
        expect(trimPromptToBudget('12345', 5)).toBe('12345')
    })

    it('trims and appends ellipsis when over budget', () => {
        expect(trimPromptToBudget('1234567890', 7)).toBe('1234...')
    })
})
