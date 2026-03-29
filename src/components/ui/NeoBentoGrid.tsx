import { cn } from './NeoButton'

interface NeoBentoGridProps {
    children: React.ReactNode
    className?: string
}

export function NeoBentoGrid({ children, className }: NeoBentoGridProps) {
    return (
        <div className={cn('grid gap-6 md:gap-8', className)}>
            {children}
        </div>
    )
}
