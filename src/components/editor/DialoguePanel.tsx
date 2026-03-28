'use client'

import { useState, useCallback } from 'react'

interface DialogueItem {
    speaker: string | null
    text: string
}

interface DialoguePanelProps {
    dialogues: DialogueItem[]
    onAddDialogue: (speaker: string | null, text: string, type: string) => void
    usedTexts: Set<string>
}

export function DialoguePanel({ dialogues, onAddDialogue, usedTexts }: DialoguePanelProps) {
    const [collapsed, setCollapsed] = useState(false)

    if (dialogues.length === 0) {
        return (
            <div className="w-56 border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col">
                <div className="p-3 border-b border-[var(--border)]">
                    <h3 className="text-xs font-medium text-[var(--text-muted)]">Dialogues</h3>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-xs text-[var(--text-muted)] text-center">
                        No dialogues for this page
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`${collapsed ? 'w-10' : 'w-56'} border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col transition-all`}>
            {/* Header */}
            <div className="p-2 border-b border-[var(--border)] flex items-center gap-1">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? '◀' : '▶'}
                </button>
                {!collapsed && (
                    <h3 className="text-xs font-medium text-[var(--text-muted)]">
                        Dialogues ({dialogues.length})
                    </h3>
                )}
            </div>

            {!collapsed && (
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {dialogues.map((d, idx) => {
                        const isUsed = usedTexts.has(d.text.slice(0, 30))
                        const type = d.speaker ? 'speech' : 'narration'
                        const icon = d.speaker ? 'S' : 'N'

                        return (
                            <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify({
                                        speaker: d.speaker,
                                        text: d.text,
                                        type,
                                    }))
                                    e.dataTransfer.effectAllowed = 'copy'
                                }}
                                className={`rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${isUsed
                                    ? 'border-[var(--border)] opacity-50'
                                    : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-white/5'
                                    }`}
                            >
                                <div className="p-2">
                                    {/* Speaker + type badge */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="text-[10px]">{icon}</span>
                                        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate">
                                            {d.speaker || 'Narration'}
                                        </span>
                                        {isUsed && (
                                            <span className="text-[9px] text-green-400 ml-auto">ok</span>
                                        )}
                                    </div>

                                    {/* Text preview */}
                                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                                        {d.text}
                                    </p>

                                    {/* Add button */}
                                    {!isUsed && (
                                        <button
                                            onClick={() => onAddDialogue(d.speaker, d.text, type)}
                                            className="mt-1.5 w-full text-[10px] py-1 rounded bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                                        >
                                            + Add to canvas
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
