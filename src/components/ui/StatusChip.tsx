type ChipVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface StatusChipProps {
    variant?: ChipVariant
    children: React.ReactNode
    className?: string
}

export function StatusChip({ variant = 'neutral', children, className = '' }: StatusChipProps) {
    return (
        <span className={`weo-chip weo-chip-${variant} ${className}`} role="status">
            {children}
        </span>
    )
}
