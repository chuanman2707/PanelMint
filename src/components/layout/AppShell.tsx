'use client'

import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from './Sidebar'
import { NeoTerminalHeader } from '@/components/ui/NeoTerminalHeader'

export function AppShell({ children }: { children: React.ReactNode }) {
    const { loading, user } = useAuth()

    if (loading && !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--neo-bg-canvas)]">
                <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] px-6 py-4 shadow-[var(--neo-shadow-card)]">
                    <div className="flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[var(--neo-ink)]">
                        <span className="weo-spinner h-5 w-5" />
                        Loading workspace
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--neo-bg-canvas)] md:pl-64">
            <Sidebar />
            <div className="min-h-screen">
                <NeoTerminalHeader title="COMIC_OS // TERMINAL" searchPlaceholder="CMD_SEARCH..." />
                <main className="min-h-[calc(100vh-69px)]">{children}</main>
            </div>
        </div>
    )
}
