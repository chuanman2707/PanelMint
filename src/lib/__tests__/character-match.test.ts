import { describe, it, expect } from 'vitest'
import { matchCharacterName } from '@/lib/utils/character-match'

describe('matchCharacterName', () => {
    it('matches exact name', () => {
        expect(matchCharacterName('Anh Minh', 'Anh Minh')).toBe(true)
    })

    it('matches case insensitive', () => {
        expect(matchCharacterName('anh minh', 'ANH MINH')).toBe(true)
        expect(matchCharacterName('Li Qingqiu', 'li qingqiu')).toBe(true)
    })

    it('matches partial name (substring)', () => {
        expect(matchCharacterName('Anh Minh', 'Minh')).toBe(true)
        expect(matchCharacterName('Minh', 'Anh Minh')).toBe(true)
    })

    it('returns false for non-matching names', () => {
        expect(matchCharacterName('Anh Minh', 'Thanh Thu')).toBe(false)
        expect(matchCharacterName('Li', 'Wang')).toBe(false)
    })

    it('handles whitespace trimming', () => {
        expect(matchCharacterName('  Anh Minh  ', 'Anh Minh')).toBe(true)
    })
})
