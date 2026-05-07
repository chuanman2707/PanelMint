'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocalUser } from '@/hooks/useLocalUser'
import { Icon } from '@/components/ui/icons'
import { NeoButton, cn } from '@/components/ui/NeoButton'
import { NeoTag } from '@/components/ui/NeoTag'

const NAV_ITEMS = [
    { href: '/dashboard', icon: 'layout-grid', label: 'Dashboard' },
    { href: '/create', icon: 'sparkles', label: 'Create' },
    { href: '/library', icon: 'book', label: 'My Library' },
    { href: '/settings', icon: 'settings', label: 'Settings' },
] as const

export function Sidebar() {
    const pathname = usePathname()
    const { user } = useLocalUser()
    const activeHref = NAV_ITEMS.reduce<string | null>((bestMatch, item) => {
        const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)

        if (!matches) {
            return bestMatch
        }

        if (!bestMatch || item.href.length > bestMatch.length) {
            return item.href
        }

        return bestMatch
    }, null)

    return (
        <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-64 md:flex-col md:border-r-[var(--neo-border-width)] md:border-[var(--neo-ink)] md:bg-[var(--neo-bg-canvas)] md:p-4">
            <div className="flex h-full flex-col gap-5">
                <div className="space-y-1">
                    <Link href="/dashboard" className="block font-display text-xl font-black uppercase tracking-tight leading-tight">
                        COMIC_ENGINE_V1
                    </Link>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">
                        Local workspace
                    </p>
                </div>

                <nav className="flex flex-1 flex-col gap-3">
                    {NAV_ITEMS.map((item) => {
                        const active = activeHref === item.href

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'neo-pressable flex items-center gap-3 rounded-[var(--neo-radius)] border-[var(--neo-border-width-sm)] border-transparent px-4 py-3 font-display text-sm font-bold uppercase tracking-tight text-[var(--neo-ink)]',
                                    active
                                        ? 'border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] shadow-[2px_2px_0_var(--neo-ink)]'
                                        : 'hover:bg-[var(--neo-accent-cyan)]/20',
                                )}
                            >
                                <Icon name={item.icon} size={18} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <Link href="/create">
                    <NeoButton className="w-full">New Project</NeoButton>
                </Link>

                <div className="mt-auto border-t-[var(--neo-border-width-sm)] border-[rgba(9,9,11,0.2)] pt-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)]">
                            <Icon name="user" size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                                {user?.name || user?.email?.split('@')[0] || 'Creator'}
                            </p>
                            <NeoTag tone="lime" className="mt-1">
                                Local workspace
                            </NeoTag>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
