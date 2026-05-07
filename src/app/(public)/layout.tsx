import Link from 'next/link'
import { NeoNavbar } from '@/components/ui/NeoNavbar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--neo-bg-canvas)]">
            <NeoNavbar />
            <div>{children}</div>
            <footer className="border-t-[var(--neo-border-width)] border-black bg-[var(--neo-bg-canvas)]">
                <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-6">
                    <div>
                        <p className="font-display text-2xl font-black uppercase tracking-[-0.05em] text-black">
                            COMIC_OS
                        </p>
                        <p className="mt-2 max-w-xl font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[color:rgba(9,9,11,0.56)]">
                            NeoComic Ink public access layer
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:rgba(9,9,11,0.62)]">
                        <Link href="/legal">Legal</Link>
                        <Link href="/dashboard">Open app</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
