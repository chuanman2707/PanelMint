import { cn } from './NeoButton'

interface NeoTagProps {
    children: React.ReactNode
    tone?: 'default' | 'yellow' | 'cyan' | 'pink' | 'lime' | 'ink' | 'paper'
    className?: string
}

const toneClasses: Record<NonNullable<NeoTagProps['tone']>, string> = {
    default: 'bg-[var(--neo-bg-panel)] text-[var(--neo-ink)]',
    yellow: 'bg-[var(--neo-accent-yellow)] text-[var(--neo-ink)]',
    cyan: 'bg-[var(--neo-accent-cyan)] text-[var(--neo-ink)]',
    pink: 'bg-[var(--neo-accent-pink)] text-[var(--neo-ink)]',
    lime: 'bg-[var(--neo-accent-lime)] text-[var(--neo-ink)]',
    ink: 'bg-[var(--neo-ink)] text-[var(--neo-accent-lime)]',
    paper: 'bg-[var(--neo-bg-canvas)] text-[var(--neo-ink)]',
}

export function NeoTag({ children, tone = 'default', className }: NeoTagProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
                toneClasses[tone],
                className,
            )}
        >
            {children}
        </span>
    )
}
