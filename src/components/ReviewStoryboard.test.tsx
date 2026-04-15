import { describe, expect, it, vi } from 'vitest'

import { ReviewStoryboard } from '@/components/ReviewStoryboard'
import { render, screen, waitFor } from '@/test/render'

describe('ReviewStoryboard', () => {
    it('approves all panels and saves the review payload', async () => {
        const onApproveAll = vi.fn()
        const { user } = render(
            <ReviewStoryboard
                panels={[
                    {
                        id: 'panel-1',
                        pageIndex: 0,
                        panelIndex: 0,
                        description: 'Linh opens the temple door.',
                        shotType: 'wide',
                        characters: JSON.stringify(['Linh']),
                        location: 'Temple',
                        approved: false,
                        approvedPrompt: null,
                        status: 'draft',
                        imageUrl: null,
                        sourceExcerpt: null,
                        mustKeep: JSON.stringify([]),
                        mood: null,
                        lighting: null,
                    },
                ]}
                onApproveAll={onApproveAll}
                onGenerateAll={vi.fn()}
                onGeneratePanel={vi.fn()}
                isApproving={false}
                isGenerating={false}
            />,
        )

        await user.click(screen.getByRole('button', { name: /approve all/i }))
        await user.click(screen.getByRole('button', { name: /save checks/i }))

        expect(onApproveAll).toHaveBeenCalledWith([
            {
                id: 'panel-1',
                approved: true,
                editedPrompt: null,
            },
        ])
    })

    it('queues generation for approved panels after saving the latest review state', async () => {
        const onApproveAll = vi.fn()
        const onGenerateAll = vi.fn()
        const { user } = render(
            <ReviewStoryboard
                panels={[
                    {
                        id: 'panel-2',
                        pageIndex: 0,
                        panelIndex: 0,
                        description: 'Linh steps into the light.',
                        shotType: 'medium',
                        characters: JSON.stringify(['Linh']),
                        location: 'Temple',
                        approved: true,
                        approvedPrompt: null,
                        status: 'draft',
                        imageUrl: null,
                        sourceExcerpt: null,
                        mustKeep: JSON.stringify([]),
                        mood: null,
                        lighting: null,
                    },
                ]}
                onApproveAll={onApproveAll}
                onGenerateAll={onGenerateAll}
                onGeneratePanel={vi.fn()}
                isApproving={false}
                isGenerating={false}
            />,
        )

        await user.click(screen.getByRole('button', { name: /render approved \(1\)/i }))

        expect(onApproveAll).toHaveBeenCalledTimes(1)
        await waitFor(() => {
            expect(onGenerateAll).toHaveBeenCalledTimes(1)
        })
    })

    it('waits for storyboard save to finish before generating images', async () => {
        let resolveSave: ((value: boolean) => void) | null = null
        const onApproveAll = vi.fn(() => new Promise<boolean>((resolve) => {
            resolveSave = resolve
        }))
        const onGenerateAll = vi.fn()
        const { user } = render(
            <ReviewStoryboard
                panels={[
                    {
                        id: 'panel-3',
                        pageIndex: 0,
                        panelIndex: 0,
                        description: 'Linh pauses before the gate.',
                        shotType: 'medium',
                        characters: JSON.stringify(['Linh']),
                        location: 'Temple',
                        approved: true,
                        approvedPrompt: null,
                        status: 'draft',
                        imageUrl: null,
                        sourceExcerpt: null,
                        mustKeep: JSON.stringify([]),
                        mood: null,
                        lighting: null,
                    },
                ]}
                onApproveAll={onApproveAll}
                onGenerateAll={onGenerateAll}
                onGeneratePanel={vi.fn()}
                isApproving={false}
                isGenerating={false}
            />,
        )

        await user.click(screen.getByRole('button', { name: /render approved \(1\)/i }))

        expect(onApproveAll).toHaveBeenCalledTimes(1)
        expect(onGenerateAll).not.toHaveBeenCalled()

        resolveSave?.(true)
        await waitFor(() => {
            expect(onGenerateAll).toHaveBeenCalledTimes(1)
        })
    })
})
