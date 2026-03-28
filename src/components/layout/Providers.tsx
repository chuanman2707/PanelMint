'use client'

import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { usePathname } from 'next/navigation'

function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { loading } = useAuth()
    const isAuthPage = pathname.startsWith('/auth')

    // Auth pages: no sidebar, full screen
    if (isAuthPage) {
        return <>{children}</>
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="weo-spinner" style={{ width: 24, height: 24 }} />
            </div>
        )
    }

    // App pages: sidebar + main content
    return (
        <div className="min-h-screen">
            <Sidebar />
            <main className="ml-[220px] min-h-screen">
                {children}
            </main>
        </div>
    )
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AppShell>{children}</AppShell>
        </AuthProvider>
    )
}
