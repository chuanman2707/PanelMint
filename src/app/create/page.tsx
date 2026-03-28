'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { GenerateForm } from '@/components/GenerateForm'
import { ProgressBar } from '@/components/ProgressBar'
import { ReviewAnalysis } from '@/components/ReviewAnalysis'
import { ReviewStoryboard } from '@/components/ReviewStoryboard'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { useCreateWorkflow } from './useCreateWorkflow'
import { useAuth } from '@/hooks/useAuth'

export default function CreatePage() {
    const searchParams = useSearchParams()
    const resumeId = searchParams.get('resume')
    const { user } = useAuth()
    const {
        state,
        runId,
        status,
        error,
        isActionLoading,
        handleGenerate,
        handleApproveAnalysis,
        handleApproveStoryboard,
        handleGenerateImages,
        clearError,
        cancelWorkflow,
    } = useCreateWorkflow({ resumeId })

    return (
        <div className="flex min-h-screen flex-col lg:flex-row bg-[var(--neo-bg-canvas)] lg:pl-[240px]"> {/* Fixed sidebar padding if layout structure varies */}

            {/* Split Pane: Left - Controls */}
            <div className="w-full lg:w-[480px] shrink-0 border-r-2 border-black bg-[var(--neo-bg-canvas)] p-6 md:p-8 flex flex-col min-h-screen z-10 shadow-[4px_0_0_rgba(0,0,0,1)] relative">
                <div className="mb-8">
                    <span className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black shadow-sm">
                        <Icon name="sparkles" size={14} className="text-[var(--neo-accent-green)]" />
                        Creator Engine
                    </span>
                    <h1 className="mt-5 text-5xl font-bold font-display uppercase tracking-tight text-black">
                        New<br />Chapter
                    </h1>
                </div>

                <GenerateForm
                    onGenerate={handleGenerate}
                    isLoading={state !== 'input' && state !== 'done'}
                    credits={user?.credits ?? 0}
                    accountTier={user?.accountTier ?? 'free'}
                    disabled={state !== 'input'} // disable form if not input state
                />
            </div>

            {/* Split Pane: Right - Output & Terminal */}
            <div className="flex-1 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] p-6 md:p-8 min-h-screen lg:overflow-y-auto lg:h-screen lg:relative">
                {error && (
                    <div className="mb-8 flex items-start gap-4 rounded-[var(--neo-radius)] border-4 border-black bg-[var(--neo-accent-danger)] p-5 text-sm font-bold text-white shadow-[var(--neo-shadow-button)]">
                        <Icon name="alert" size={24} className="shrink-0 mt-0.5 animate-pulse" />
                        <span className="flex-1 uppercase tracking-wider">{error}</span>
                        <button onClick={clearError} className="shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center p-1 bg-black text-[var(--neo-accent-danger)] rounded-full border-2 border-transparent hover:border-white">
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                )}

                {state === 'input' && (
                    <div className="flex h-full items-center justify-center opacity-30 mt-20 lg:mt-0">
                        <div className="text-center">
                            <Icon name="terminal" size={64} className="mx-auto mb-6 text-black" />
                            <p className="text-sm font-bold uppercase tracking-widest text-black">Awaiting Input Sequence</p>
                        </div>
                    </div>
                )}

                {(state === 'analyzing' || state === 'storyboarding' || state === 'imaging') && (
                    <div className="mx-auto max-w-2xl pt-10 lg:pt-20">
                        <ProgressBar
                            phase={status.phase}
                            progress={status.progress}
                            totalPanels={status.totalPanels}
                            completedPanels={status.completedPanels}
                        />
                        <div className="mt-10 text-center">
                            <button
                                onClick={cancelWorkflow}
                                className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[var(--neo-accent-danger)] hover:underline transition-colors"
                            >
                                [ Terminate Process ]
                            </button>
                        </div>
                    </div>
                )}

                {state === 'review_analysis' && status.characters && status.locations && status.pages && (
                    <div className="mx-auto max-w-3xl pb-20 animate-fade-in-up">
                        <ReviewAnalysis
                            characters={status.characters}
                            locations={status.locations}
                            pages={status.pages}
                            pageCount={status.pageCount || 15}
                            onApprove={handleApproveAnalysis}
                            isLoading={isActionLoading}
                        />
                    </div>
                )}

                {state === 'review_storyboard' && status.panels && (
                    <div className="mx-auto max-w-4xl pb-20 animate-fade-in-up">
                        <ReviewStoryboard
                            panels={status.panels}
                            onApproveAll={handleApproveStoryboard}
                            onGenerateAll={() => handleGenerateImages()}
                            onGeneratePanel={(panelId) => handleGenerateImages([panelId])}
                            isApproving={isActionLoading}
                            isGenerating={isActionLoading}
                        />
                    </div>
                )}

                {state === 'done' && runId && (
                    <div className="mx-auto max-w-lg pt-20 text-center animate-fade-in-up">
                        <NeoCard highlight="green" className="py-16 px-8 bg-white">
                            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[var(--neo-radius-full)] border-4 border-black bg-[var(--neo-accent-green)] shadow-[var(--neo-shadow-button)]">
                                <Icon name="check" size={48} className="text-black stroke-[3]" />
                            </div>
                            <h3 className="mb-4 text-4xl font-bold font-display uppercase tracking-tight text-black">
                                Sequence Complete
                            </h3>
                            <p className="mb-10 text-sm font-bold text-gray-600 uppercase tracking-widest">
                                Your comic has been written, storyboarded, and generated.
                            </p>
                            <div className="flex flex-col gap-4">
                                <Link href={`/read/${runId}`}>
                                    <NeoButton variant="primary" size="xl" className="w-full">
                                        <Icon name="eye" size={20} /> Read Full Chapter
                                    </NeoButton>
                                </Link>
                                <Link href="/">
                                    <NeoButton variant="secondary" size="lg" className="w-full">
                                        <Icon name="layout-grid" size={18} /> Return to Dashboard
                                    </NeoButton>
                                </Link>
                            </div>
                        </NeoCard>
                    </div>
                )}
            </div>
        </div>
    )
}
