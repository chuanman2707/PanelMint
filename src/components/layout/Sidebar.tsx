'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Icon } from '@/components/ui/icons'

const NAV_ITEMS = [
    { href: '/', icon: 'layout-grid', label: 'Dashboard' },
    { href: '/create', icon: 'sparkles', label: 'Create' },
    { href: '/settings', icon: 'settings', label: 'Settings' },
]

export function Sidebar() {
    const pathname = usePathname()
    const { user, signout } = useAuth()
    const creditBalance = (user?.credits ?? 0).toLocaleString()

    return (
        <aside className="fixed left-0 top-0 bottom-0 z-40 w-[240px] border-r-2 border-black bg-[var(--neo-bg-canvas)]">
            <div className="flex h-full flex-col p-4 space-y-6">

                {/* Logo Area */}
                <div className="flex items-center gap-3 px-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--neo-radius)] bg-[var(--neo-accent-green)] border-2 border-black">
                        <Icon name="sparkles" size={20} className="text-black" />
                    </div>
                    <div className="min-w-0">
                        <span className="block text-xl font-bold font-display uppercase tracking-tight text-black" style={{ fontFamily: 'var(--font-display)' }}>
                            WEO-OH
                        </span>
                    </div>
                </div>

                {/* Credits Bento */}
                <Link
                    href="/settings?tab=credits"
                    className="block rounded-[var(--neo-radius-lg)] border-2 border-black bg-white p-4 shadow-[var(--neo-shadow-button)] transition-transform duration-200 hover:-translate-y-1"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                Credits
                            </p>
                            <p className="mt-1 text-3xl font-bold tracking-tight text-black font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {creditBalance}
                            </p>
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] text-black">
                            <Icon name="wallet" size={16} />
                        </div>
                    </div>
                    <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[var(--neo-accent-green)]">
                        <Icon name="plus" size={14} />
                        Top up
                    </div>
                </Link>

                {/* Navigation */}
                <nav className="flex-1 space-y-2">
                    <p className="px-2 text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
                        Workspace
                    </p>
                    {NAV_ITEMS.map(item => {
                        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-[var(--neo-radius)] px-3 py-3 text-sm font-bold transition-all duration-200 border-2 ${active
                                        ? 'border-black bg-[var(--neo-accent-green)] shadow-[var(--neo-shadow-button)] translate-x-1'
                                        : 'border-transparent text-gray-700 hover:border-black hover:bg-white hover:translate-x-1 hover:shadow-sm'
                                    }`}
                            >
                                <Icon name={item.icon} size={18} />
                                <span className="uppercase tracking-wide">{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* User Profile Area */}
                <div className="rounded-[var(--neo-radius-lg)] border-2 border-black bg-white p-3 shadow-[var(--neo-shadow-button)]">
                    <div className="flex items-center gap-3 px-2 py-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)]">
                            <Icon name="user" size={18} className="text-black" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-black uppercase">
                                {user?.name || user?.email?.split('@')[0] || 'Creator'}
                            </p>
                            <p className="truncate text-[10px] font-mono text-gray-500" style={{ fontFamily: 'var(--font-mono)' }}>
                                {user?.email || 'Signed in'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={signout}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--neo-radius)] border-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-wider text-black transition-all hover:border-black hover:bg-[var(--neo-accent-danger)] hover:text-white"
                    >
                        <Icon name="logout" size={14} />
                        Sign out
                    </button>
                </div>
            </div>
        </aside>
    )
}
