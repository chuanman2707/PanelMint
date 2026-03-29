'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { GenerateForm } from '@/components/GenerateForm'
import { ProgressBar } from '@/components/ProgressBar'
import { ReviewAnalysis } from '@/components/ReviewAnalysis'
import { ReviewStoryboard } from '@/components/ReviewStoryboard'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { NeoButton } from '@/components/ui/NeoButton'
import { Icon } from '@/components/ui/icons'
import { useAuth } from '@/hooks/useAuth'
import { useCreateWorkflow } from './useCreateWorkflow'

export default function CreatePage() {
    const router = useRouter()
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

    const handleCancel = async () => {
        const cancelled = await cancelWorkflow()
        if (cancelled) {
            router.push('/dashboard')
        }
    }

    return (
        <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[minmax(360px,480px)_1fr]">
            <aside className="border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-canvas)] p-6 shadow-[4px_0_0_var(--neo-ink)] lg:min-h-[calc(100vh-64px)] lg:border-b-0 lg:border-r-[var(--neo-border-width)] md:p-8">
                <NeoTag tone="cyan">Creator Engine</NeoTag>
                <h1 className="mt-5 flex flex-col items-start gap-2 text-[clamp(2.35rem,4vw,4.25rem)] font-black uppercase leading-[0.9] tracking-[-0.045em]">
                    <span className="whitespace-nowrap">PANEL_GEN_01</span>
                    <span className="inline-block whitespace-nowrap bg-[var(--neo-ink)] px-3 text-[var(--neo-accent-cyan)]">
                        Workspace
                    </span>
                </h1>
                <p className="mt-4 max-w-md font-mono text-[12px] uppercase tracking-[0.16em] text-black/65">
                    Input raw narrative data. The engine will render sequential art assets based on terminal parameters.
                </p>

                <div className="mt-8">
                    <GenerateForm
                        onGenerate={handleGenerate}
                        isLoading={state !== 'input' && state !== 'done'}
                        credits={user?.credits ?? 0}
                        accountTier={user?.accountTier ?? 'free'}
                        disabled={state !== 'input'}
                    />
                </div>
            </aside>

            <section className="neo-grid-paper min-h-[calc(100vh-64px)] p-6 md:p-8">
                {error ? (
                    <div className="mb-8 flex items-start gap-4 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-pink)] p-5 shadow-[var(--neo-shadow-button)]">
                        <Icon name="alert" size={24} className="mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="font-display text-lg font-black uppercase tracking-tight">Engine Halted</p>
                            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em]">{error}</p>
                        </div>
                        <button type="button" onClick={clearError} className="border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-white p-2">
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                ) : null}

                {state === 'input' ? (
                    <div className="flex min-h-full items-center justify-center">
                        <NeoCard className="w-full max-w-xl bg-[var(--neo-ink)] text-white" noHover>
                            <div className="border-b-[var(--neo-border-width-sm)] border-white/20 pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <span className="h-3 w-3 rounded-full bg-[var(--neo-accent-pink)]" />
                                        <span className="h-3 w-3 rounded-full bg-[var(--neo-accent-yellow)]" />
                                        <span className="h-3 w-3 rounded-full bg-[var(--neo-accent-lime)]" />
                                    </div>
                                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neo-accent-cyan)]">
                                        PREVIEW_BUFFER::IDLE
                                    </span>
                                </div>
                            </div>
                            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                                <Icon name="terminal" size={72} className="text-[var(--neo-accent-cyan)]" />
                                <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--neo-accent-lime)]">
                                    Awaiting narrative stream...
                                </p>
                                <p className="mt-3 max-w-md text-sm text-white/65">
                                    The engine is idling. Provide prompt data, choose your visual protocol, and execute generation.
                                </p>
                            </div>
                        </NeoCard>
                    </div>
                ) : null}

                {(state === 'analyzing' || state === 'storyboarding' || state === 'imaging') ? (
                    <div className="mx-auto max-w-2xl pt-8 md:pt-14">
                        <ProgressBar
                            phase={status.phase}
                            progress={status.progress}
                            totalPanels={status.totalPanels}
                            completedPanels={status.completedPanels}
                        />
                        <div className="mt-10 text-center">
                            <button
                                type="button"
                                onClick={() => void handleCancel()}
                                className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55 transition-colors hover:text-[var(--neo-accent-danger)]"
                            >
                                [ Terminate Process ]
                            </button>
                        </div>
                    </div>
                ) : null}

                {state === 'review_analysis' && status.characters && status.locations && status.pages ? (
                    <div className="mx-auto max-w-3xl pb-20">
                        <ReviewAnalysis
                            characters={status.characters}
                            locations={status.locations}
                            pages={status.pages}
                            pageCount={status.pageCount || 15}
                            onApprove={handleApproveAnalysis}
                            isLoading={isActionLoading}
                        />
                    </div>
                ) : null}

                {state === 'review_storyboard' && status.panels ? (
                    <div className="mx-auto max-w-4xl pb-20">
                        <ReviewStoryboard
                            panels={status.panels}
                            onApproveAll={handleApproveStoryboard}
                            onGenerateAll={() => handleGenerateImages()}
                            onGeneratePanel={(panelId) => handleGenerateImages([panelId])}
                            isApproving={isActionLoading}
                            isGenerating={isActionLoading}
                        />
                    </div>
                ) : null}

                {state === 'done' && runId ? (
                    <div className="mx-auto max-w-xl pt-10">
                        <NeoCard className="bg-white px-8 py-14 text-center" highlight="green">
                            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-button)]">
                                <Icon name="check" size={44} />
                            </div>
                            <h2 className="text-4xl font-black uppercase tracking-tight">Sequence Complete</h2>
                            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-black/65">
                                Your comic has been written, storyboarded, and generated.
                            </p>
                            <div className="mt-8 space-y-4">
                                <Link href={`/read/${runId}`} className="block">
                                    <NeoButton className="w-full">
                                        <Icon name="eye" size={18} />
                                        Read Full Chapter
                                    </NeoButton>
                                </Link>
                                <Link href="/dashboard" className="block">
                                    <NeoButton variant="secondary" className="w-full">
                                        <Icon name="layout-grid" size={18} />
                                        Return to Dashboard
                                    </NeoButton>
                                </Link>
                            </div>
                        </NeoCard>
                    </div>
                ) : null}
            </section>
        </div>
    )
}
