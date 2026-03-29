import * as React from 'react'
import { clsx } from 'clsx'
import { NeoCard } from './NeoCard'

type SurfaceVariant = 'default' | 'card' | 'elevated'

interface SurfaceProps extends Omit<React.ComponentPropsWithoutRef<typeof NeoCard>, 'highlight' | 'noHover'> {
    variant?: SurfaceVariant
    interactive?: boolean
}

const variantClasses: Record<SurfaceVariant, string> = {
    default: 'bg-[var(--neo-bg-surface)]',
    card: 'bg-[var(--neo-bg-surface)]',
    elevated: 'bg-[var(--neo-bg-panel)]',
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
    ({ className, variant = 'default', interactive = false, children, ...props }, ref) => {
        return (
            <NeoCard
                ref={ref}
                noHover={!interactive}
                className={clsx(
                    'px-6 py-6 text-[var(--neo-ink)]',
                    variantClasses[variant],
                    className,
                )}
                {...props}
            >
                {children}
            </NeoCard>
        )
    },
)

Surface.displayName = 'Surface'
