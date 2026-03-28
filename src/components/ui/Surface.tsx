import * as React from 'react'
import { clsx } from 'clsx'
import { NeoCard } from './NeoCard'

type SurfaceVariant = 'default' | 'card' | 'elevated'

interface SurfaceProps extends Omit<React.ComponentPropsWithoutRef<typeof NeoCard>, 'highlight' | 'noHover'> {
    variant?: SurfaceVariant
    interactive?: boolean
}

const variantClasses: Record<SurfaceVariant, string> = {
    default: 'border border-[var(--weo-stroke-soft)] bg-white/88 shadow-[var(--weo-shadow-sm)]',
    card: 'border border-[var(--weo-stroke-soft)] bg-white/88 shadow-[var(--weo-shadow-sm)]',
    elevated: 'border border-[var(--weo-stroke-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,255,255,0.82))] shadow-[var(--weo-shadow-lg)]',
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
    ({ className, variant = 'default', interactive = false, children, ...props }, ref) => {
        return (
            <NeoCard
                ref={ref}
                noHover={!interactive}
                className={clsx(
                    'rounded-[28px] border px-6 py-6 text-[var(--weo-text-primary)]',
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
