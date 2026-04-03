import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/test/render'
import { useCreateWorkflow } from './useCreateWorkflow'

describe('useCreateWorkflow', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('returns to input and exposes the API error when generation fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: 'Insufficient credits',
        }), {
            status: 402,
            headers: { 'content-type': 'application/json' },
        })))

        const { result } = renderHook(() => useCreateWorkflow({ resumeId: null }))

        await act(async () => {
            await result.current.handleGenerate('story', 'manga', 15, 'standard')
        })

        await waitFor(() => {
            expect(result.current.state).toBe('input')
            expect(result.current.error).toBe('Insufficient credits')
        })
    })

    it('loads a resumable run into storyboard review without starting polling again', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            phase: 'review_storyboard',
            progress: 45,
            totalPanels: 10,
            completedPanels: 0,
            error: null,
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))

        const { result } = renderHook(() => useCreateWorkflow({ resumeId: 'run-1' }))

        await waitFor(() => {
            expect(result.current.runId).toBe('run-1')
            expect(result.current.state).toBe('review_storyboard')
            expect(result.current.status.phase).toBe('review_storyboard')
        })
    })
})
