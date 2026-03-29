import { AppShell } from '@/components/layout/AppShell'
import { Providers } from '@/components/layout/Providers'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Providers>
            <AppShell>{children}</AppShell>
        </Providers>
    )
}
