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
                    <label htmlFor={id} className="block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--neo-ink)]">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    id={id}
                    className={cn(
                        "flex h-12 w-full rounded-[var(--neo-radius)] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] px-4 py-2 text-[15px] text-[var(--neo-ink)] outline-none transition-[background-color,box-shadow] duration-100 placeholder:text-black/40 focus-visible:bg-[var(--neo-bg-panel-soft)] focus-visible:shadow-[var(--neo-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-[var(--neo-accent-danger)] focus-visible:shadow-[8px_8px_0_var(--neo-accent-pink)]",
                        className
                    )}
                    ref={ref}
                    aria-invalid={error ? 'true' : undefined}
                    {...props}
                />
                {error && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--neo-accent-danger)]">{error}</p>}
                {hint && !error && <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/60">{hint}</p>}
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
                    <label htmlFor={id} className="block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--neo-ink)]">
                        {label}
                    </label>
                )}
                <textarea
                    id={id}
                    className={cn(
                        "flex min-h-[120px] w-full rounded-[var(--neo-radius)] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] px-4 py-3 text-[15px] text-[var(--neo-ink)] outline-none transition-[background-color,box-shadow] duration-100 placeholder:text-black/40 focus-visible:bg-[var(--neo-bg-panel-soft)] focus-visible:shadow-[var(--neo-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-[var(--neo-accent-danger)] focus-visible:shadow-[8px_8px_0_var(--neo-accent-pink)]",
                        className
                    )}
                    ref={ref}
                    aria-invalid={error ? 'true' : undefined}
                    {...props}
                />
                {error && <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--neo-accent-danger)]">{error}</p>}
                {hint && !error && <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/60">{hint}</p>}
            </div>
        )
    }
)
NeoTextarea.displayName = "NeoTextarea"
