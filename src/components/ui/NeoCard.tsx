import * as React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const EASE = [0.22, 1, 0.36, 1] as const
const TRANSITION = { duration: 0.2, ease: EASE }
const HOVER_LIFT = { y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transition: TRANSITION }

interface NeoCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
    highlight?: 'rainbow' | 'green' | 'none'
    children: React.ReactNode
    noHover?: boolean
}

export const NeoCard = React.forwardRef<HTMLDivElement, NeoCardProps>(
    ({ className, highlight = 'none', children, noHover = false, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                whileHover={noHover ? undefined : HOVER_LIFT}
                className={cn(
                    "relative bg-white border-2 border-black rounded-[var(--neo-radius-lg)] p-6 shadow-[var(--neo-shadow-card)] overflow-hidden",
                    className
                )}
                {...props}
            >
                {highlight === 'rainbow' && (
                    <div className="absolute top-0 left-0 right-0 h-2 bg-[var(--neo-accent-rainbow)]" />
                )}
                {highlight === 'green' && (
                    <div className="absolute top-0 left-0 right-0 h-2 bg-[var(--neo-accent-green)]" />
                )}
                <div className="relative z-10">
                    {children}
                </div>
            </motion.div>
        )
    }
)
NeoCard.displayName = "NeoCard"
