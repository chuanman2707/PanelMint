import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GenerateForm } from '@/components/GenerateForm'
import { render, screen } from '@/test/render'

describe('GenerateForm', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('submits trimmed manuscript text with the default generation options', async () => {
        const onGenerate = vi.fn()
        const { user } = render(
            <GenerateForm
                onGenerate={onGenerate}
                isLoading={false}
                credits={1000}
                accountTier="free"
            />,
        )

        await user.type(
            screen.getByPlaceholderText(
                'Paste your story or novel text here... The engine will analyze scene by scene.',
            ),
            '   The opening scene needs a reset.   ',
        )
        await user.click(screen.getByRole('button', { name: 'Initialize Engine' }))

        expect(onGenerate).toHaveBeenCalledTimes(1)
        expect(onGenerate).toHaveBeenCalledWith(
            'The opening scene needs a reset.',
            'manga',
            15,
            'standard',
        )
    })

    it('disables submission and shows the credit warning when the estimate exceeds the balance', async () => {
        const onGenerate = vi.fn()
        const { user } = render(
            <GenerateForm
                onGenerate={onGenerate}
                isLoading={false}
                credits={0}
                accountTier="free"
            />,
        )

        await user.type(
            screen.getByPlaceholderText(
                'Paste your story or novel text here... The engine will analyze scene by scene.',
            ),
            'A short opening scene.',
        )

        expect(screen.getByRole('button', { name: 'Initialize Engine' })).toBeDisabled()
        expect(screen.getByText('Insufficient credits')).toBeInTheDocument()
        expect(onGenerate).not.toHaveBeenCalled()
    })

    it('cleans up the DOM between tests', () => {
        expect(document.body).toBeEmptyDOMElement()
    })
})
