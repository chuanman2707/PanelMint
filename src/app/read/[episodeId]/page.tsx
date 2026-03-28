'use client'

import { useState, useEffect, use } from 'react'
import { ComicReader, type PageData } from '@/components/ComicReader'
import { Icon } from '@/components/ui/icons'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoButton } from '@/components/ui/NeoButton'
import Link from 'next/link'

export default function ReadPage({ params }: { params: Promise<{ episodeId: string }> }) {
    const { episodeId } = use(params)
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
        load()
    }, [episodeId])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 bg-[#09090b]">
                <NeoCard className="flex items-center gap-5 px-8 py-6 border-white bg-black">
                    <div className="weo-spinner w-10 h-10 border-white border-t-transparent" />
                    <span className="text-2xl font-bold font-display uppercase tracking-widest text-white">
                        Accessing Archive...
                    </span>
                </NeoCard>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
                <NeoCard highlight="none" className="max-w-md w-full py-12 px-8 text-center border-4 border-white bg-black">
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[var(--neo-radius-full)] border-4 border-white bg-[#dc2626] shadow-[8px_8px_0_0_#fff]">
                        <Icon name="alert" size={48} className="text-white stroke-[3]" />
                    </div>
                    <h3 className="mb-4 text-4xl font-bold font-display uppercase tracking-tight text-white">
                        Archive Corrupted
                    </h3>
                    <p className="mb-10 text-sm font-bold font-mono text-[#dc2626] bg-[#111] p-4 border-2 border-dashed border-[#dc2626] uppercase tracking-wider">{error}</p>
                    <Link href="/">
                        <NeoButton variant="primary" size="xl" className="w-full text-lg">
                            <Icon name="arrow-left" size={20} /> ABORT TO DASHBOARD
                        </NeoButton>
                    </Link>
                </NeoCard>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#09090B] text-white selection:bg-[#ffd500] selection:text-black">
            <ComicReader
                pages={pages}
                title="WEO-OH VISUALIZER"
                onBack={() => window.history.back()}
            />
            {/* Custom scrollbar injection specifically for reader */}
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
