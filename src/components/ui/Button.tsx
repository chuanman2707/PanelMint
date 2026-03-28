import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './icons'
import { NeoButton } from './NeoButton'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    icon?: string
    iconRight?: string
    loading?: boolean
    children: ReactNode
}

export function Button({
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading,
    disabled,
    children,
    className = '',
    ...props
}: ButtonProps) {
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16

    // Map old variants to Neo variants
    const neoVariant = variant === 'danger' ? 'danger' :
        variant === 'ghost' ? 'ghost' :
            variant === 'secondary' ? 'secondary' : 'primary';

    const neoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default';

    return (
        <NeoButton
            variant={neoVariant}
            size={neoSize}
            className={className}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading ? (
                <span className="weo-spinner mr-2" />
            ) : icon ? (
                <Icon name={icon} size={iconSize} className="shrink-0 mr-2" />
            ) : null}
            <span className="truncate">{children}</span>
            {iconRight && !loading && (
                <Icon name={iconRight} size={iconSize} className="shrink-0 ml-2" />
            )}
        </NeoButton>
    )
}
