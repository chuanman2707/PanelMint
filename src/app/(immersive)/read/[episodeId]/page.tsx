'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ComicReader, type PageData } from '@/components/ComicReader'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { Icon } from '@/components/ui/icons'

export default function ReadPage({ params }: { params: Promise<{ episodeId: string }> }) {
    const { episodeId } = use(params)
    const router = useRouter()
    const [pages, setPages] = useState<PageData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/generate/${episodeId}/result`)
                if (!res.ok) throw new Error('Failed to load comic')
                const data = await res.json()
                setPages(data.pages)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [episodeId])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--neo-ink)] p-4">
                <NeoCard className="flex items-center gap-5 border-white bg-black px-8 py-6 text-white" noHover>
                    <div className="weo-spinner h-10 w-10 border-white border-t-transparent" />
                    <span className="font-display text-2xl font-black uppercase tracking-tight text-[var(--neo-accent-yellow)]">
                        Accessing Archive...
                    </span>
                </NeoCard>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--neo-ink)] p-4">
                <NeoCard className="w-full max-w-md border-white bg-black px-8 py-12 text-center text-white" noHover>
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center border-[var(--neo-border-width)] border-white bg-[var(--neo-accent-pink)] shadow-[8px_8px_0_0_#fff]">
                        <Icon name="alert" size={48} className="text-white" />
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tight">Archive Corrupted</h2>
                    <p className="mt-6 border-[var(--neo-border-width-sm)] border-[var(--neo-accent-pink)] bg-[#111] p-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--neo-accent-pink)]">
                        {error}
                    </p>
                    <Link href="/dashboard" className="mt-8 block">
                        <NeoButton className="w-full">
                            <Icon name="arrow-left" size={18} />
                            Abort to Dashboard
                        </NeoButton>
                    </Link>
                </NeoCard>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--neo-ink)] text-white selection:bg-[var(--neo-accent-yellow)] selection:text-black">
            <ComicReader
                pages={pages}
                title="ARCHIVE_VISUALIZER"
                onBack={() => router.push('/dashboard')}
            />
            <style jsx global>{`
                body::-webkit-scrollbar {
                    width: 16px;
                }
                body::-webkit-scrollbar-track {
                    background: #09090b;
                    border-left: 2px solid #333;
                }
                body::-webkit-scrollbar-thumb {
                    background-color: #ffd500;
                    border-left: 2px solid #000;
                    border-right: 2px solid #000;
                }
            `}</style>
        </div>
    )
}
