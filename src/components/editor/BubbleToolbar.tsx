'use client'

interface BubbleToolbarProps {
    onAddBubble: (type: string) => void
    onDelete: () => void
    hasSelection: boolean
    saving: boolean
}

export function BubbleToolbar({ onAddBubble, onDelete, hasSelection, saving }: BubbleToolbarProps) {
    return (
        <div className="flex items-center gap-2 py-2 px-4 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-full">
            <span className="text-xs text-[var(--text-muted)] mr-2">Add:</span>

            <button
                onClick={() => onAddBubble('speech')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 text-[var(--text-primary)] transition-colors"
                title="Speech Bubble"
            >
                Speech
            </button>

            <button
                onClick={() => onAddBubble('thought')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 text-[var(--text-primary)] transition-colors"
                title="Thought Bubble"
            >
                Thought
            </button>

            <button
                onClick={() => onAddBubble('narration')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 text-[var(--text-primary)] transition-colors"
                title="Narration Box"
            >
                Narration
            </button>

            <button
                onClick={() => onAddBubble('sfx')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 text-[var(--text-primary)] transition-colors"
                title="SFX Text"
            >
                SFX
            </button>

            <div className="flex-1" />

            {saving && (
                <span className="text-[10px] text-[var(--accent)] flex items-center gap-1">
                    <span className="w-2 h-2 border border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    Saving...
                </span>
            )}

            {hasSelection && (
                <button
                    onClick={onDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                >
                    Delete
                </button>
            )}
        </div>
    )
}
