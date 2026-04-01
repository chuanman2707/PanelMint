import { describe, expect, it, vi } from 'vitest'
import { buildCharacterCanon } from '@/lib/pipeline/character-canon'

describe('buildCharacterCanon', () => {
    it('builds canon text for matching characters', () => {
        const canon = buildCharacterCanon(
            [
                {
                    name: 'Anh Minh',
                    description: 'Tall swordsman',
                    identityJson: JSON.stringify({
                        ageRange: 'adult',
                        gender: 'male',
                        bodyBuild: 'lean',
                    }),
                },
                {
                    name: 'Thanh Thu',
                    description: 'Mage',
                    identityJson: null,
                },
            ],
            ['Anh Minh'],
        )

        expect(canon).toContain('Anh Minh [adult, male, lean]: Tall swordsman')
        expect(canon).not.toContain('Thanh Thu')
    })

    it('ignores malformed identityJson without throwing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const canon = buildCharacterCanon(
            [
                {
                    name: 'Anh Minh',
                    description: 'Tall swordsman',
                    identityJson: '{"ageRange":"adult"',
                },
            ],
            ['Anh Minh'],
        )

        expect(canon).toBe('Anh Minh: Tall swordsman')
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockRestore()
    })

    it('returns an empty canon string when the panel has no characters', () => {
        const canon = buildCharacterCanon(
            [
                {
                    name: 'Anh Minh',
                    description: 'Tall swordsman',
                    identityJson: null,
                },
            ],
            [],
        )

        expect(canon).toBe('')
    })
})
