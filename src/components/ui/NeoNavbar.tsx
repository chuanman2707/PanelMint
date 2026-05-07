'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActiveSection } from '@/components/public/useActiveSection'
import { Icon } from './icons'
import { NeoButton, cn } from './NeoButton'

const DEFAULT_NAV_ITEMS = [
    { href: '/', label: 'Home' },
    { href: '/legal', label: 'Legal' },
]

const LANDING_SECTION_IDS = ['features', 'cta']

const LANDING_NAV_ITEMS = [
    { href: '#features', label: 'Features', sectionId: 'features' },
    { href: '/legal', label: 'Legal' },
] as const

export function NeoNavbar() {
    const pathname = usePathname()
    const activeSection = useActiveSection(LANDING_SECTION_IDS)
    const navItems = pathname === '/' ? LANDING_NAV_ITEMS : DEFAULT_NAV_ITEMS

    const isActiveItem = (item: (typeof navItems)[number]) => {
        if ('sectionId' in item) {
            return activeSection === item.sectionId
        }

        return item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    }

    return (
        <header className="sticky top-0 z-40 border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-ink)] text-[var(--neo-accent-lime)]">
            <div className="neo-scanlines">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:flex-nowrap md:px-6">
                    <div className="flex min-w-0 items-center gap-4 md:gap-6">
                        <Link href="/" className="min-w-0 truncate font-mono text-xs font-bold uppercase tracking-[0.24em] text-[var(--neo-accent-lime)] md:text-sm">
                            COMIC_OS // TERMINAL
                        </Link>
                        <div className="hidden items-center gap-5 lg:flex">
                            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)] underline underline-offset-4">
                                SYSTEM_STATUS: NOMINAL
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)]/70">
                                ENGINE_v2.4
                            </span>
                        </div>
                    </div>
                    <nav className="hidden items-center gap-2 md:flex">
                    {navItems.map((item) => {
                        const active = isActiveItem(item)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'rounded-[var(--neo-radius)] border-[var(--neo-border-width-sm)] border-transparent px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-all hover:-translate-y-0.5 hover:bg-white/10 hover:text-white',
                                    active && 'border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] text-[var(--neo-ink)] shadow-[2px_2px_0_var(--neo-ink)]',
                                )}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                    </nav>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 sm:flex-nowrap">
                        <div className="hidden items-center gap-3 sm:flex">
                            <button type="button" className="transition-colors hover:text-white" aria-label="Terminal">
                                <Icon name="terminal" size={18} />
                            </button>
                            <button type="button" className="transition-colors hover:text-white" aria-label="Notifications">
                                <Icon name="notifications" size={18} />
                            </button>
                            <button type="button" className="transition-colors hover:text-white" aria-label="Workspace">
                                <Icon name="user" size={18} />
                            </button>
                        </div>
                        <Link href={pathname === '/' ? '#cta' : '/create'} className="shrink-0">
                            <NeoButton size="sm">Get Started</NeoButton>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    )
}
