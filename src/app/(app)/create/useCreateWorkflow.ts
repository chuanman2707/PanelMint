'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type GenerationStatus, isActiveProgressPhase } from '@/lib/progress/types'

export type CreateState =
    | 'input'
    | 'analyzing'
    | 'review_analysis'
    | 'storyboarding'
    | 'review_storyboard'
    | 'imaging'
    | 'done'

interface UseCreateWorkflowArgs {
    resumeId: string | null
}

const INITIAL_STATUS: GenerationStatus = {
    phase: 'analyzing',
    progress: 0,
    totalPanels: 0,
    completedPanels: 0,
}

export function useCreateWorkflow({ resumeId }: UseCreateWorkflowArgs) {
    const [state, setState] = useState<CreateState>('input')
    const [runId, setRunId] = useState<string | null>(null)
    const [status, setStatus] = useState<GenerationStatus>(INITIAL_STATUS)
    const [error, setError] = useState<string | null>(null)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
        }
    }, [])

    const applyStatus = useCallback((statusData: GenerationStatus) => {
        setStatus(statusData)

        if (statusData.phase === 'review_analysis') {
            stopPolling()
            setState('review_analysis')
            return false
        }

        if (statusData.phase === 'review_storyboard') {
            stopPolling()
            setState('review_storyboard')
            return false
        }

        if (statusData.phase === 'done') {
            stopPolling()
            setState('done')
            return false
        }

        if (statusData.phase === 'error') {
            stopPolling()
            setError(statusData.error || 'An error occurred')
            setState('input')
            return false
        }

        if (isActiveProgressPhase(statusData.phase)) {
            setState(statusData.phase as CreateState)
            return true
        }

        return false
    }, [stopPolling])

    const pollStatus = useCallback(async (id: string) => {
        try {
            const statusRes = await fetch(`/api/generate/${id}/status`)
            if (!statusRes.ok) return true

            const statusData = await statusRes.json() as GenerationStatus
            return applyStatus(statusData)
        } catch {
            return true
        }
    }, [applyStatus])

    const startPolling = useCallback((id: string) => {
        stopPolling()
        pollingRef.current = setInterval(() => {
            void pollStatus(id)
        }, 3000)
    }, [pollStatus, stopPolling])

    useEffect(() => {
        if (!resumeId) return

        let active = true
        setRunId(resumeId)

        const loadResume = async () => {
            try {
                const res = await fetch(`/api/generate/${resumeId}/status`)
                if (!res.ok) {
                    if (active) setError('Failed to load episode')
                    return
                }

                const data = await res.json() as GenerationStatus
                if (!active) return

                const shouldContinue = applyStatus(data)
                if (shouldContinue) {
                    startPolling(resumeId)
                }
            } catch {
                if (active) setError('Failed to resume episode')
            }
        }

        void loadResume()

        return () => {
            active = false
            stopPolling()
        }
    }, [applyStatus, resumeId, startPolling, stopPolling])

    useEffect(() => () => {
        stopPolling()
    }, [stopPolling])

    const handleGenerate = useCallback(async (text: string, artStyle: string, pageCount: number, imageModelTier: 'standard' | 'premium') => {
        setState('analyzing')
        setError(null)
        setStatus(INITIAL_STATUS)

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, artStyle, pageCount, imageModelTier }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `HTTP ${res.status}`)
            }

            const { runId: newRunId } = await res.json()
            setRunId(newRunId)
            startPolling(newRunId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
            setState('input')
        }
    }, [startPolling])

    const handleApproveAnalysis = useCallback(async (
        characters: Array<{ id: string; name: string; aliases: string | null; description: string | null }>,
        locations: Array<{ id: string; name: string; description: string | null }>,
    ) => {
        if (!runId) return
        setIsActionLoading(true)

        try {
            const res = await fetch(`/api/generate/${runId}/approve-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characters, locations }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Approve failed')
            }

            setState('storyboarding')
            setStatus((prev) => ({ ...prev, phase: 'storyboarding', progress: 30 }))
            startPolling(runId)
        } catch (err) {
            try {
                const statusRes = await fetch(`/api/generate/${runId}/status`)
                if (statusRes.ok) {
                    const statusData = await statusRes.json() as GenerationStatus
                    const shouldContinue = applyStatus(statusData)
                    if (shouldContinue) {
                        startPolling(runId)
                    }
                }
            } catch {
                // Keep the original error if status reconciliation fails.
            }

            setError(err instanceof Error ? err.message : 'Approve failed')
        } finally {
            setIsActionLoading(false)
        }
    }, [applyStatus, runId, startPolling])

    const handleApproveStoryboard = useCallback(async (
        panelApprovals: { id: string; approved: boolean; editedPrompt: string | null }[],
    ) => {
        if (!runId) return false
        setIsActionLoading(true)

        try {
            const res = await fetch(`/api/generate/${runId}/approve-storyboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ panels: panelApprovals }),
            })

            if (!res.ok) throw new Error('Save failed')

            const statusRes = await fetch(`/api/generate/${runId}/status`)
            if (statusRes.ok) {
                const statusData = await statusRes.json() as GenerationStatus
                applyStatus(statusData)
            }
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed')
            return false
        } finally {
            setIsActionLoading(false)
        }
    }, [applyStatus, runId])

    const handleGenerateImages = useCallback(async (panelIds?: string[]) => {
        if (!runId) return
        setIsActionLoading(true)

        try {
            const res = await fetch(`/api/generate/${runId}/generate-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(panelIds ? { panelIds } : {}),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Generate failed')
            }

            setState('imaging')
            startPolling(runId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generate failed')
        } finally {
            setIsActionLoading(false)
        }
    }, [runId, startPolling])

    return {
        state,
        runId,
        status,
        error,
        isActionLoading,
        handleGenerate,
        handleApproveAnalysis,
        handleApproveStoryboard,
        handleGenerateImages,
        clearError: () => setError(null),
        cancelWorkflow: async () => {
            stopPolling()
            if (!runId) {
                setState('input')
                setStatus(INITIAL_STATUS)
                return true
            }

            setIsActionLoading(true)

            try {
                const res = await fetch(`/api/generate/${runId}/cancel`, {
                    method: 'POST',
                })

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Cancel failed')
                }

                setRunId(null)
                setStatus(INITIAL_STATUS)
                setState('input')
                setError(null)
                return true
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Cancel failed')
                return false
            } finally {
                setIsActionLoading(false)
            }
        },
        stopPolling,
    }
}
