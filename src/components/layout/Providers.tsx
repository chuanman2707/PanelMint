'use client'

import { LocalUserProvider } from '@/hooks/useLocalUser'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <LocalUserProvider>
            {children}
        </LocalUserProvider>
    )
}
