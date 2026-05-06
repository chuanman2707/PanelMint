import type * as React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GenerateForm } from '@/components/GenerateForm'
import { render, screen } from '@/test/render'

function renderGenerateForm(overrides: Partial<React.ComponentProps<typeof GenerateForm>> = {}) {
    const onGenerate = vi.fn()
    const view = render(
        <GenerateForm
            onGenerate={onGenerate}
            isLoading={false}
            {...overrides}
        />,
    )
    return { onGenerate, ...view }
}

describe('GenerateForm', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('describes export length in pages instead of panels', () => {
        renderGenerateForm()

        expect(screen.getByText('15 pages')).toBeInTheDocument()
        expect(screen.queryByText('15 panels')).not.toBeInTheDocument()
    })

    it('submits trimmed manuscript text with the default generation options', async () => {
        const { onGenerate, user } = renderGenerateForm()

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
        )
    })

    it('does not render credit or premium controls', () => {
        renderGenerateForm()

        expect(screen.queryByText(/available balance/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/premium/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/insufficient credits/i)).not.toBeInTheDocument()
    })

    it('cleans up the DOM between tests', () => {
        expect(document.body).toBeEmptyDOMElement()
    })
})
