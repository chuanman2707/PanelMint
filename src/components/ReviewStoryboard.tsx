'use client'

import { useState } from 'react'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'

interface PanelReviewData {
    id: string
    pageIndex: number
    panelIndex: number
    description: string | null
    shotType: string | null
    characters: string | null
    location: string | null
    approved: boolean
    approvedPrompt: string | null
    status: string
    imageUrl: string | null
    sourceExcerpt: string | null
    mustKeep: string | null
    mood: string | null
    lighting: string | null
}

interface ReviewStoryboardProps {
    panels: PanelReviewData[]
    onApproveAll: (panels: { id: string; approved: boolean; editedPrompt: string | null }[]) => void | Promise<boolean>
    onGenerateAll: () => void
    onGeneratePanel: (panelId: string) => void
    isApproving: boolean
    isGenerating: boolean
}

export function ReviewStoryboard({
    panels: initialPanels,
    onApproveAll,
    onGenerateAll,
    onGeneratePanel,
    isApproving,
    isGenerating,
}: ReviewStoryboardProps) {
    const [panels, setPanels] = useState(() =>
        initialPanels.map((p) => ({
            ...p,
            editedPrompt: p.approvedPrompt ?? p.description ?? '',
            isEditing: false,
            localApproved: p.approved,
        }))
    )

    const approvedCount = panels.filter((p) => p.localApproved).length
    const totalCount = panels.length

    const pageGroups = panels.reduce((acc, panel) => {
        const key = panel.pageIndex
        if (!acc[key]) acc[key] = []
        acc[key].push(panel)
        return acc
    }, {} as Record<number, typeof panels>)

    const toggleApprove = (panelId: string) => {
        setPanels((prev) => prev.map((p) =>
            p.id === panelId ? { ...p, localApproved: !p.localApproved } : p
        ))
    }

    const toggleEdit = (panelId: string) => {
        setPanels((prev) => prev.map((p) =>
            p.id === panelId ? { ...p, isEditing: !p.isEditing } : p
        ))
    }

    const updatePrompt = (panelId: string, text: string) => {
        setPanels((prev) => prev.map((p) =>
            p.id === panelId ? { ...p, editedPrompt: text } : p
        ))
    }

    const approveAll = () => {
        setPanels((prev) => prev.map((p) => ({ ...p, localApproved: true })))
    }

    const handleSaveAndApprove = async () => {
        const result = await onApproveAll(
            panels.map((p) => ({
                id: p.id,
                approved: p.localApproved,
                editedPrompt: p.editedPrompt !== (p.description ?? '') ? p.editedPrompt : null,
            }))
        )

        return result !== false
    }

    const handleGenerateAll = async () => {
        const didSave = await handleSaveAndApprove()
        if (!didSave) return
        onGenerateAll()
    }

    return (
        <div className="w-full space-y-10">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black shadow-sm mb-6">
                    <Icon name="layout-grid" size={14} className="text-[var(--neo-accent-green)]" />
                    Storyboard Review
                </div>
                <h2 className="text-5xl font-bold font-display uppercase tracking-tight text-black mb-4">
                    Director's Cut
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm font-bold text-gray-600 max-w-lg">
                        Review and edit AI-generated panel structures. Lock in prompts and generate images.
                    </p>
                    <div className="rounded-[var(--neo-radius-full)] border-4 border-black bg-white px-5 py-2 text-lg font-bold font-mono text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        PANELS APPROVED: <span className={approvedCount === totalCount ? "text-[var(--neo-accent-green)]" : "text-[var(--neo-accent-danger)]"}>{approvedCount}/{totalCount}</span>
                    </div>
                </div>
            </div>

            {/* Page Groups */}
            <div className="space-y-16">
                {Object.entries(pageGroups)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([pageIndex, pagePanels]) => (
                        <div key={pageIndex} className="relative">
                            <div className="sticky top-0 z-20 flex items-center gap-4 py-4 mb-4 bg-transparent backdrop-blur-sm -mx-4 px-4 lg:-mx-8 lg:px-8">
                                <h3 className="flex items-center gap-3 rounded-[var(--neo-radius-full)] border-4 border-black bg-black px-6 py-2 text-2xl font-bold font-display uppercase text-white shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
                                    <Icon name="file-text" size={24} className="text-[var(--neo-accent-green)]" />
                                    PAGE {Number(pageIndex) + 1}
                                </h3>
                                <div className="h-1 flex-1 bg-black" />
                            </div>

                            <div className="grid gap-8">
                                {pagePanels.map((panel) => (
                                    <div
                                        key={panel.id}
                                        className={`rounded-[var(--neo-radius-lg)] border-4 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-colors overflow-hidden ${panel.localApproved ? 'bg-[var(--neo-accent-green)]' : ''
                                            }`}
                                    >
                                        <div className="flex flex-col md:flex-row">
                                            {/* Preview / Image Section */}
                                            <div className="md:w-1/3 border-b-4 lg:border-b-0 md:border-r-4 border-black bg-black p-4 flex flex-col relative overflow-hidden">
                                                {/* Scanline overlay for the image container */}
                                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] z-10 opacity-20 hidden"></div>

                                                <div className="flex items-center justify-between mb-4 z-20">
                                                    <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1 text-sm font-bold font-mono text-black shadow-sm">
                                                        P{panel.pageIndex + 1}.{panel.panelIndex + 1}
                                                    </span>
                                                    {panel.status === 'done' && (
                                                        <span className="flex items-center gap-1 rounded-[var(--neo-radius-full)] bg-[#ffd500] border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black shadow-sm">
                                                            <Icon name="check" size={12} /> Rendered
                                                        </span>
                                                    )}
                                                </div>

                                                {panel.imageUrl ? (
                                                    <div className="flex-1 relative z-20">
                                                        <img
                                                            src={panel.imageUrl}
                                                            alt={`Panel ${panel.pageIndex + 1}.${panel.panelIndex + 1}`}
                                                            className="w-full h-full object-cover rounded-[var(--neo-radius)] border-2 border-white/20 shadow-inner"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[var(--neo-accent-green)] rounded-[var(--neo-radius)] bg-black/50 text-[var(--neo-accent-green)] p-6 text-center min-h-[200px] z-20">
                                                        {panel.status === 'generating' ? (
                                                            <>
                                                                <div className="weo-spinner w-8 h-8 mb-4 border-[var(--neo-accent-green)] border-t-black" />
                                                                <span className="text-xs font-bold uppercase tracking-widest font-mono">Generating</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Icon name="image" size={32} className="mb-4 opacity-50" />
                                                                <span className="text-[10px] font-bold uppercase tracking-widest font-mono opacity-50">Awaiting Render</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Editor Section */}
                                            <div className={`md:w-2/3 p-6 flex flex-col ${panel.localApproved ? 'bg-white' : ''} transition-colors rounded-r-[var(--neo-radius-md)]`}>
                                                <div className="flex flex-wrap items-center gap-2 mb-6">
                                                    <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-bg-canvas)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                                        {panel.shotType || 'medium'}
                                                    </span>
                                                    {panel.characters && JSON.parse(panel.characters).length > 0 && (
                                                        <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-accent-rainbow)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center gap-1">
                                                            <Icon name="user" size={12} /> {JSON.parse(panel.characters).length} Cast
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex-1 mb-6">
                                                    {panel.isEditing ? (
                                                        <textarea
                                                            value={panel.editedPrompt}
                                                            onChange={(e) => updatePrompt(panel.id, e.target.value)}
                                                            rows={6}
                                                            className="w-full resize-none rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] p-4 font-mono text-sm leading-relaxed text-black shadow-inner outline-none focus:ring-4 focus:ring-black"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-bold text-gray-800 leading-relaxed border-l-4 border-black pl-4">
                                                            {panel.editedPrompt || panel.description || 'No description'}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-wrap items-center gap-3 pt-6 border-t-4 border-black border-dashed mt-auto">
                                                    <NeoButton
                                                        variant={panel.isEditing ? "primary" : "secondary"}
                                                        onClick={() => toggleEdit(panel.id)}
                                                    >
                                                        <Icon name="edit" size={16} />
                                                        {panel.isEditing ? 'Done' : 'Edit Prompt'}
                                                    </NeoButton>

                                                    <NeoButton
                                                        variant={panel.localApproved ? "success" : "ghost"}
                                                        onClick={() => toggleApprove(panel.id)}
                                                    >
                                                        <Icon name="check" size={16} />
                                                        {panel.localApproved ? 'Approved' : 'Approve'}
                                                    </NeoButton>

                                                    <div className="ml-auto w-full sm:w-auto mt-4 sm:mt-0">
                                                        {panel.localApproved && panel.status !== 'generating' && (
                                                            <NeoButton
                                                                variant="primary"
                                                                onClick={() => void (async () => {
                                                                    const didSave = await handleSaveAndApprove()
                                                                    if (!didSave) return
                                                                    onGeneratePanel(panel.id)
                                                                })()}
                                                                disabled={isGenerating}
                                                                className="w-full"
                                                            >
                                                                {panel.status === 'done' ? (
                                                                    <><Icon name="refresh-cw" size={16} /> Re-render</>
                                                                ) : (
                                                                    <><Icon name="zap" size={16} /> Render Panel</>
                                                                )}
                                                            </NeoButton>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Constraints & Sources */}
                                                {(panel.sourceExcerpt || panel.mood || panel.mustKeep) && (
                                                    <div className="mt-6 bg-[var(--neo-bg-canvas)] p-4 border-2 border-black rounded-[var(--neo-radius)] text-xs text-black font-mono flex flex-col gap-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                                        {panel.mustKeep && (() => {
                                                            try {
                                                                const cons = JSON.parse(panel.mustKeep)
                                                                if (cons.length === 0) return null
                                                                return (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <span className="font-bold flex items-center gap-1 text-[var(--neo-accent-danger)]"><Icon name="key" size={12} /> MAINTAIN:</span>
                                                                        {cons.map((c: string) => <span key={c} className="underline decoration-[var(--neo-accent-danger)] border-b-2 border-transparent">{c}</span>)}
                                                                    </div>
                                                                )
                                                            } catch { return null }
                                                        })()}
                                                        {panel.mood && (
                                                            <div className="flex gap-2"><span className="font-bold text-[#63c7f9]">MOOD:</span> {panel.mood}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
            </div>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-6 z-30 mt-16 rounded-[var(--neo-radius-lg)] border-4 border-black bg-white p-6 shadow-[12px_12px_0_0_rgba(0,0,0,1)]">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex w-full md:w-auto gap-4 flex-1">
                        <NeoButton
                            variant="secondary"
                            onClick={approveAll}
                            className="flex-1"
                        >
                            <Icon name="check-square" size={20} /> Approve All
                        </NeoButton>
                        <NeoButton
                            variant="secondary"
                            onClick={() => void handleSaveAndApprove()}
                            disabled={isApproving}
                            className="flex-1"
                        >
                            <Icon name="save" size={20} /> Save Checks
                        </NeoButton>
                    </div>
                    <div className="w-full md:w-auto">
                        <NeoButton
                            variant="primary"
                            size="xl"
                            onClick={() => void handleGenerateAll()}
                            disabled={approvedCount === 0 || isGenerating}
                            className="w-full px-12 py-6 text-xl"
                        >
                            {isGenerating ? (
                                <><div className="weo-spinner mr-3 border-white border-t-transparent" /> RENDERING CLUSTER...</>
                            ) : (
                                <><Icon name="zap" size={24} className="mr-2 text-[#ffd500]" /> RENDER APPROVED ({approvedCount})</>
                            )}
                        </NeoButton>
                    </div>
                </div>
            </div>
        </div>
    )
}
