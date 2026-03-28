export interface BubbleData {
    id: string
    speaker: string | null
    content: string
    bubbleType: string
    positionX: number
    positionY: number
    width: number
    height: number
}

interface SpeechBubbleProps {
    bubble: BubbleData
}

export function SpeechBubble({ bubble }: SpeechBubbleProps) {
    const { bubbleType, positionX, positionY, width, content, speaker } = bubble

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${positionX * 100}%`,
        top: `${positionY * 100}%`,
        transform: 'translate(-50%, -50%)',
        maxWidth: `${width * 100}%`,
        minWidth: '60px',
    }

    if (bubbleType === 'narration') {
        return (
            <div style={style} className="bubble-appear pointer-events-none">
                <div className="rounded-[18px] border border-white/10 bg-[var(--bubble-narration)] px-3 py-2 text-center text-xs italic leading-relaxed text-white shadow-[var(--weo-shadow-md)]">
                    {content}
                </div>
            </div>
        )
    }

    if (bubbleType === 'sfx') {
        return (
            <div style={style} className="bubble-appear pointer-events-none">
                <span className="text-white font-black text-lg tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    style={{ WebkitTextStroke: '1px rgba(0,0,0,0.5)' }}>
                    {content}
                </span>
            </div>
        )
    }

    if (bubbleType === 'thought') {
        return (
            <div style={style} className="bubble-appear pointer-events-none">
                <div className="relative rounded-[24px] border border-[var(--weo-stroke-soft)] bg-[var(--bubble-thought)] px-4 py-2 shadow-[var(--weo-shadow-sm)]">
                    {speaker && (
                        <span className="mb-0.5 block text-[10px] font-semibold text-[var(--weo-accent-from)]">{speaker}</span>
                    )}
                    <p className="m-0 text-xs italic leading-relaxed text-[var(--weo-text-secondary)]">{content}</p>
                    <div className="absolute -bottom-2 left-6 h-3 w-3 rounded-full border border-[var(--weo-stroke-soft)] bg-[var(--bubble-thought)]" />
                    <div className="absolute -bottom-4 left-4 h-2 w-2 rounded-full border border-[var(--weo-stroke-soft)] bg-[var(--bubble-thought)]" />
                </div>
            </div>
        )
    }

    // Default speech bubble
    return (
        <div style={style} className="bubble-appear pointer-events-none">
            <div className="relative rounded-[20px] border border-[var(--weo-stroke-soft)] bg-[var(--bubble-bg)] px-4 py-2 shadow-[var(--weo-shadow-md)]">
                {speaker && (
                    <span className="mb-0.5 block text-[10px] font-bold text-[var(--weo-text-muted)]">{speaker}</span>
                )}
                <p className="m-0 text-xs leading-relaxed text-[var(--weo-text-primary)]">{content}</p>
                <div className="absolute -bottom-2 left-6 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--bubble-bg)]" />
            </div>
        </div>
    )
}
