import { describe, expect, it, vi } from 'vitest'

import { ReviewAnalysis } from '@/components/ReviewAnalysis'
import { render, screen } from '@/test/render'

describe('ReviewAnalysis', () => {
    it('submits edited characters and locations through onApprove', async () => {
        const onApprove = vi.fn()
        const { user } = render(
            <ReviewAnalysis
                characters={[{
                    id: 'char-1',
                    name: 'Linh',
                    aliases: null,
                    description: 'Black coat and silver eyes',
                    imageUrl: null,
                    identityJson: null,
                }]}
                locations={[{
                    id: 'loc-1',
                    name: 'Temple',
                    description: 'Ancient hall',
                }]}
                pages={[{
                    id: 'page-1',
                    pageIndex: 0,
                    summary: 'Linh enters the hall.',
                    content: 'Linh walks into the ruined temple.',
                    location: 'Temple',
                }]}
                pageCount={1}
                onApprove={onApprove}
                isLoading={false}
            />,
        )

        await user.clear(screen.getByDisplayValue('Linh'))
        await user.type(screen.getByDisplayValue(''), 'Linh Tran')
        await user.clear(screen.getByDisplayValue('Ancient hall'))
        await user.type(screen.getByDisplayValue(''), 'Ancient temple hall')
        await user.click(screen.getByRole('button', { name: /approve setup & storyboard/i }))

        expect(onApprove).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    id: 'char-1',
                    name: 'Linh Tran',
                    description: 'Black coat and silver eyes',
                }),
            ],
            [
                expect.objectContaining({
                    id: 'loc-1',
                    name: 'Temple',
                    description: 'Ancient temple hall',
                }),
            ],
        )
    })
})
