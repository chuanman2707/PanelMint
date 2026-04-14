import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    callLLM: vi.fn(),
}))

vi.mock('@/lib/ai/llm', () => ({
    callLLM: mocks.callLLM,
}))

import {
    analyzeCharactersAndLocations,
    splitIntoPagesWithPanels,
    type AnalyzedCharacter,
} from '@/lib/pipeline/analyze'
import {
    MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS,
    getStoryboardPanelBudget,
} from '@/lib/prompt-budget'

describe('analyze prompt budgeting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the character analysis user prompt under the provider prompt limit', async () => {
        const longStory = 'Lăng Tiêu thức tỉnh quang hệ. '.repeat(260)

        mocks.callLLM.mockResolvedValueOnce(JSON.stringify({
            characters: [
                {
                    name: 'Lăng Tiêu',
                    aliases: null,
                    description: 'young mage',
                    identityAnchor: {
                        ageRange: '18-year-old boy',
                        gender: 'male',
                        bodyBuild: 'lean',
                        hairSignature: 'black hair',
                        faceSignature: 'focused eyes',
                        outfitDefault: 'school uniform',
                    },
                },
            ],
            locations: [
                { name: 'classroom', description: 'magic classroom' },
            ],
        }))

        await analyzeCharactersAndLocations(longStory, {
            provider: 'wavespeed',
            apiKey: 'wavespeed-key',
            llmModel: 'bytedance-seed/seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })

        expect(mocks.callLLM).toHaveBeenCalledTimes(1)
        const [prompt, options] = mocks.callLLM.mock.calls[0] as [string, { systemPrompt?: string }]
        expect(prompt.length).toBeLessThan(10_000)
        expect(prompt).toContain('<story_text>')
        expect(options.systemPrompt).toContain('You are a story analyst for comic/manga creation.')
    })

    it('keeps the page-splitting user prompt under the provider prompt limit', async () => {
        const longStory = 'Mạc Phàm nhìn lên thức tỉnh la bàn và nghe tiếng bàn tán. '.repeat(110)
        const characters: AnalyzedCharacter[] = [
            { name: 'Lăng Tiêu', aliases: null, description: 'A'.repeat(1_200) },
            { name: 'Mạc Phàm', aliases: null, description: 'B'.repeat(1_200) },
            { name: 'Mục Bạch', aliases: null, description: 'C'.repeat(1_200) },
        ]

        mocks.callLLM.mockResolvedValueOnce(JSON.stringify([
            {
                summary: 'Opening',
                content: 'Classroom awakening scene',
                characters: ['Lăng Tiêu'],
                location: 'classroom',
                dialogue: [],
                sceneContext: {
                    timeOfDay: 'morning',
                    weather: 'clear',
                    dominantMood: 'tense',
                    colorTone: 'cool blue',
                    pageRole: 'setup',
                },
                panels: [
                    {
                        description: 'Lăng Tiêu đứng trên bục giảng.',
                        shotType: 'medium',
                        characters: ['Lăng Tiêu'],
                        location: 'classroom',
                        sourceExcerpt: 'Ling Xiao stands at the awakening podium.',
                        mustKeep: ['school setting'],
                        mood: 'tense',
                        lighting: 'indoor daylight',
                        dialogue: null,
                    },
                ],
            },
        ]))

        await splitIntoPagesWithPanels(longStory, characters, 5, {
            provider: 'wavespeed',
            apiKey: 'wavespeed-key',
            llmModel: 'bytedance-seed/seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })

        expect(mocks.callLLM).toHaveBeenCalledTimes(1)
        const [prompt, options] = mocks.callLLM.mock.calls[0] as [string, { systemPrompt?: string }]
        expect(prompt.length).toBeLessThan(10_000)
        expect(prompt).toContain('<story_text>')
        expect(options.systemPrompt).toContain('Given a story text, split it into EXACTLY 5 sequential pages suitable for a comic.')
        expect(options.systemPrompt).toContain('Lăng Tiêu: ')
        expect(options.systemPrompt?.length ?? 0).toBeLessThan(10_000)
        expect(options.systemPrompt).toContain('...')
        expect(options.systemPrompt).toMatch(new RegExp(`.{0,${MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS + 5000}}`, 's'))
    })

    it('keeps short-chapter storyboard prompts lean', async () => {
        const shortStory = 'Lăng Tiêu gặp sư phụ ở sân sau và nhận mệnh lệnh đầu tiên. '.repeat(20)

        mocks.callLLM.mockResolvedValueOnce(JSON.stringify([
            {
                summary: 'Opening',
                content: 'Lăng Tiêu nhận lệnh.',
                characters: ['Lăng Tiêu'],
                location: 'courtyard',
                dialogue: [],
                sceneContext: {
                    timeOfDay: 'morning',
                    weather: 'clear',
                    dominantMood: 'calm',
                    colorTone: 'warm gold',
                    pageRole: 'setup',
                },
                panels: [
                    {
                        description: 'Lăng Tiêu đứng trước sư phụ.',
                        shotType: 'medium',
                        characters: ['Lăng Tiêu'],
                        location: 'courtyard',
                        sourceExcerpt: 'Ling Xiao receives his first order.',
                        mustKeep: ['quiet scene'],
                        mood: 'calm',
                        lighting: 'morning light',
                        dialogue: null,
                    },
                ],
            },
        ]))

        await splitIntoPagesWithPanels(shortStory, [], 15, {
            provider: 'wavespeed',
            apiKey: 'wavespeed-key',
            llmModel: 'bytedance-seed/seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })

        expect(getStoryboardPanelBudget({
            manuscriptChars: shortStory.length,
            pageCount: 15,
        })).toEqual({
            minPanelsPerPage: 1,
            maxPanelsPerPage: 2,
            targetTotalPanels: 15,
        })

        const [, options] = mocks.callLLM.mock.calls[0] as [string, { systemPrompt?: string }]
        expect(options.systemPrompt).toContain('Each page should have 1-2 panels')
        expect(options.systemPrompt).toContain('Target about 15 total panels across the whole chapter')
    })
})
