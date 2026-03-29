import { Icon } from './icons'
import { cn } from './NeoButton'

interface NeoTerminalHeaderProps {
    title: string
    subtitle?: string
    searchPlaceholder?: string
    className?: string
}

export function NeoTerminalHeader({
    title,
    subtitle = 'SYSTEM_STATUS: NOMINAL',
    searchPlaceholder,
    className,
}: NeoTerminalHeaderProps) {
    return (
        <header className={cn('neo-terminal-bar neo-scanlines sticky top-0 z-30 flex items-center justify-between px-5 py-3', className)}>
            <div className="relative z-10 flex min-w-0 items-center gap-6">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[var(--neo-accent-lime)] md:text-sm">
                    {title}
                </span>
                <div className="hidden items-center gap-6 md:flex">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)] underline underline-offset-4">
                        {subtitle}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)]/70">
                        ENGINE_v2.4
                    </span>
                </div>
            </div>
            <div className="relative z-10 flex items-center gap-3 text-[var(--neo-accent-lime)]">
                {searchPlaceholder ? (
                    <label className="hidden items-center gap-2 border-[var(--neo-border-width-sm)] border-[var(--neo-accent-lime)]/30 bg-black/30 px-3 py-1.5 sm:flex">
                        <input
                            aria-label={searchPlaceholder}
                            readOnly
                            placeholder={searchPlaceholder}
                            className="w-36 bg-transparent font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--neo-accent-lime)] outline-none placeholder:text-[var(--neo-accent-lime)]/45"
                        />
                        <Icon name="terminal" size={16} />
                    </label>
                ) : null}
                <button type="button" className="transition-colors hover:text-white" aria-label="Terminal">
                    <Icon name="terminal" size={18} />
                </button>
                <button type="button" className="transition-colors hover:text-white" aria-label="Notifications">
                    <Icon name="notifications" size={18} />
                </button>
                <button type="button" className="transition-colors hover:text-white" aria-label="Account">
                    <Icon name="user" size={18} />
                </button>
            </div>
        </header>
    )
}
