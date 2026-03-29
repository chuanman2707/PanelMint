import * as React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface NeoCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    highlight?: 'rainbow' | 'green' | 'none'
    children: React.ReactNode
    noHover?: boolean
}

export const NeoCard = React.forwardRef<HTMLDivElement, NeoCardProps>(
    ({ className, highlight = 'none', children, noHover = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative overflow-hidden rounded-[var(--neo-radius-lg)] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] p-6 shadow-[var(--neo-shadow-card)]",
                    noHover ? "" : "transition-transform duration-150 hover:-translate-y-1",
                    className
                )}
                {...props}
            >
                {highlight === 'rainbow' && (
                    <div className="absolute left-0 right-0 top-0 h-3 bg-[var(--neo-accent-rainbow)]" />
                )}
                {highlight === 'green' && (
                    <div className="absolute left-0 right-0 top-0 h-3 bg-[var(--neo-accent-lime)]" />
                )}
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        )
    }
)
NeoCard.displayName = "NeoCard"
