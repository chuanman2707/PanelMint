import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--neo-radius-full)] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 border-2 border-black shadow-[var(--neo-shadow-button)]",
    {
        variants: {
            variant: {
                primary: "bg-black text-white hover:bg-black/90",
                secondary: "bg-white text-black hover:bg-gray-50",
                success: "bg-[var(--neo-accent-green)] text-black hover:bg-green-400",
                ghost: "border-transparent shadow-none hover:bg-black/5 hover:text-black",
                danger: "bg-[var(--neo-accent-danger)] text-white hover:bg-red-500"
            },
            size: {
                sm: "h-9 px-3 text-xs",
                default: "h-11 px-6",
                md: "h-11 px-6",
                lg: "h-14 px-8 text-lg",
                xl: "h-16 px-10 text-xl",
                icon: "h-11 w-11",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

// Framer Motion transition for soft brutalism
const EASE = [0.22, 1, 0.36, 1] as const
const TRANSITION = { duration: 0.2, ease: EASE }
const HOVER_LIFT = { y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transition: TRANSITION }
const PRESS_SCALE = { scale: 0.98, transition: TRANSITION }

const MotionButton = motion.create('button')

const NeoButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        if (asChild) {
            return (
                <Slot
                    className={cn(buttonVariants({ variant, size, className }))}
                    ref={ref}
                    {...props}
                />
            )
        }

        return (
            <MotionButton
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                whileHover={variant !== 'ghost' ? HOVER_LIFT : undefined}
                whileTap={PRESS_SCALE}
                {...props as any}
            />
        )
    }
)
NeoButton.displayName = "NeoButton"

export { NeoButton, buttonVariants }
