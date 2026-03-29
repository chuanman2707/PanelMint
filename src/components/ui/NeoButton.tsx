import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const buttonVariants = cva(
    "neo-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--neo-radius)] border-[var(--neo-border-width)] border-[var(--neo-ink)] font-display text-sm font-extrabold uppercase tracking-tight text-[var(--neo-ink)] shadow-[var(--neo-shadow-button)] transition-[transform,box-shadow,background-color,color] duration-100 focus-visible:outline-none focus-visible:shadow-[var(--neo-shadow-focus)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0",
    {
        variants: {
            variant: {
                primary: "bg-[var(--neo-accent-yellow)]",
                secondary: "bg-[var(--neo-bg-surface)]",
                success: "bg-[var(--neo-accent-lime)]",
                ghost: "border-transparent bg-transparent shadow-none hover:bg-[var(--neo-bg-panel)] hover:shadow-none",
                danger: "bg-[var(--neo-accent-pink)]"
            },
            size: {
                sm: "h-10 px-3 text-xs",
                default: "h-12 px-5",
                md: "h-12 px-5",
                lg: "h-14 px-7 text-base",
                xl: "h-16 px-9 text-lg",
                icon: "h-12 w-12",
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

const NeoButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref as never}
                {...props}
            />
        )
    }
)
NeoButton.displayName = "NeoButton"

export { NeoButton, buttonVariants }
