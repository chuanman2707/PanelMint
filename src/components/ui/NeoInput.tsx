import * as React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

export const NeoInput = React.forwardRef<HTMLInputElement, NeoInputProps>(
    ({ className, label, error, hint, id, type, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label htmlFor={id} className="text-sm font-bold text-black uppercase tracking-wider block">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    id={id}
                    className={cn(
                        "flex h-12 w-full rounded-[var(--neo-radius)] border-2 border-black bg-white px-4 py-2 text-base ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow",
                        error && "border-[var(--neo-accent-danger)] focus-visible:ring-[var(--neo-accent-danger)]",
                        className
                    )}
                    ref={ref}
                    aria-invalid={error ? 'true' : undefined}
                    {...props}
                />
                {error && <p className="text-sm font-medium text-[var(--neo-accent-danger)]">{error}</p>}
                {hint && !error && <p className="text-sm text-gray-600">{hint}</p>}
            </div>
        )
    }
)
NeoInput.displayName = "NeoInput"

export interface NeoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    error?: string
    hint?: string
}

export const NeoTextarea = React.forwardRef<HTMLTextAreaElement, NeoTextareaProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label htmlFor={id} className="text-sm font-bold text-black uppercase tracking-wider block">
                        {label}
                    </label>
                )}
                <textarea
                    id={id}
                    className={cn(
                        "flex min-h-[80px] w-full rounded-[var(--neo-radius)] border-2 border-black bg-white px-4 py-3 text-base ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow",
                        error && "border-[var(--neo-accent-danger)] focus-visible:ring-[var(--neo-accent-danger)]",
                        className
                    )}
                    ref={ref}
                    aria-invalid={error ? 'true' : undefined}
                    {...props}
                />
                {error && <p className="text-sm font-medium text-[var(--neo-accent-danger)]">{error}</p>}
                {hint && !error && <p className="text-sm text-gray-600">{hint}</p>}
            </div>
        )
    }
)
NeoTextarea.displayName = "NeoTextarea"
