import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { NeoInput, NeoTextarea } from './NeoInput'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    hint?: string
    error?: string
}

export function TextInput({ label, hint, error, id, className = '', ...props }: TextInputProps) {
    return <NeoInput label={label} hint={hint} error={error} id={id} className={className} {...props} />
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    hint?: string
    error?: string
}

export function TextArea({ label, hint, error, id, className = '', ...props }: TextAreaProps) {
    return <NeoTextarea label={label} hint={hint} error={error} id={id} className={className} {...props} />
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    hint?: string
    children: ReactNode
}

export function Select({ label, hint, id, children, className = '', ...props }: SelectProps) {
    return (
        <div className="space-y-2">
            {label && (
                <label htmlFor={id} className="text-sm font-bold text-black uppercase tracking-wider block">{label}</label>
            )}
            <select
                id={id}
                className={`flex h-12 w-full rounded-[var(--neo-radius)] border-2 border-black bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${className}`}
                aria-invalid={props['aria-invalid']}
                {...props}
            >
                {children}
            </select>
            {hint && <p className="text-sm text-gray-600">{hint}</p>}
        </div>
    )
}
