'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'

export interface PageData {
    id: string
    index: number
    imageUrl: string | null
    summary: string | null
    panelCount: number
    status: string
}

interface ComicReaderProps {
    pages: PageData[]
    title?: string
    onBack?: () => void
    liveStatus?: { completedPages: number; totalPages: number }
}

export function ComicReader({ pages, title, onBack, liveStatus }: ComicReaderProps) {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col pb-20">
            {/* Top Navigation */}
            <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b-4 border-[#333] px-4 py-4 shadow-[0_4px_0_0_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between mx-auto max-w-3xl">
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest text-white border-2 border-transparent hover:border-white transition-all hover:bg-white hover:text-black"
                        >
                            <Icon name="arrow-left" size={16} /> Back
                        </button>
                    ) : <div />}

                    <h2 className="text-xl md:text-2xl font-bold font-display uppercase tracking-tight text-[#ffd500] truncate px-4">
                        {title || 'DOCUMENT VIEW'}
                    </h2>

                    <span className="rounded-full border-2 border-[#333] bg-black px-4 py-2 text-xs font-bold font-mono text-white hidden sm:block">
                        {pages.length} PAGES
                    </span>
                </div>
            </div>

            {liveStatus && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 border-4 border-black bg-[linear-gradient(45deg,#ffd500_25%,transparent_25%,transparent_50%,#ffd500_50%,#ffd500_75%,transparent_75%,transparent_100%)] bg-[size:20px_20px] px-8 py-4 shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:bg-[size:40px_40px] transition-all">
                    <div className="bg-black text-white px-4 py-2 flex items-center gap-3 border-2 border-black font-mono shadow-[2px_2px_0_0_#fff]">
                        <div className="weo-spinner h-4 w-4 border-[#ffd500] border-t-transparent" />
                        <span className="text-sm font-bold uppercase tracking-widest text-[#ffd500]">
                            RENDER ACTIVE [{liveStatus.completedPages}/{liveStatus.totalPages}]
                        </span>
                    </div>
                </div>
            )}

            <div className="flex flex-col mt-12 px-4 sm:px-0" style={{ gap: '2rem' }}>
                {pages.map((page) => (
                    <PageView key={page.id} page={page} />
                ))}
            </div>

            <div className="pt-24 pb-10 flex flex-col items-center px-4">
                <div className="h-24 w-1.5 bg-[#333] mb-8" />
                <h3 className="text-4xl font-bold font-display uppercase tracking-tight text-white mb-8 text-center">
                    End of sequence
                </h3>
                {onBack && (
                    <NeoButton variant="primary" onClick={onBack} size="xl" className="w-full max-w-sm text-2xl py-8 shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <Icon name="layout-grid" size={24} className="mr-3" /> DASHBOARD
                    </NeoButton>
                )}
            </div>
        </div>
    )
}

function PageView({ page }: { page: PageData }) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.unobserve(el)
                }
            },
            { threshold: 0.1 }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            ref={ref}
            className={`relative w-full ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out`}
        >
            {page.imageUrl ? (
                <div className="relative overflow-hidden border-4 border-[#333] bg-[#111] shadow-[12px_12px_0_0_#000]">
                    <img
                        src={page.imageUrl}
                        alt={page.summary || `Page ${page.index + 1}`}
                        className="block h-auto w-full"
                        loading="lazy"
                    />
                    <div className="absolute top-4 left-4 rounded-none border-4 border-black bg-[#ffd500] px-4 py-2 text-sm font-bold font-mono tracking-widest text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transform -rotate-2">
                        P{page.index + 1}
                    </div>
                </div>
            ) : (
                <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-4 border-4 border-dashed border-[#444] bg-black px-6 text-center text-[#999] shadow-[12px_12px_0_0_#000]">
                    {page.status === 'generating' ? (
                        <>
                            <div className="flex items-center justify-center w-20 h-20 border-4 border-[#ffd500] animate-[spin_3s_linear_infinite] mb-6">
                                <div className="w-10 h-10 border-4 border-[#ffd500] animate-[spin_2s_reverse_linear_infinite]" />
                            </div>
                            <span className="text-xl md:text-2xl font-bold font-display uppercase tracking-widest text-white">
                                Compiling Output
                            </span>
                            <span className="text-sm font-mono uppercase tracking-widest bg-[#222] px-3 py-1 border border-[#333] mt-2 text-[#ffd500]">
                                {page.panelCount} blocks requested
                            </span>
                        </>
                    ) : page.status === 'error' ? (
                        <>
                            <div className="flex h-20 w-20 items-center justify-center border-4 border-white bg-[#dc2626] shadow-[6px_6px_0_0_#fff]">
                                <Icon name="alert" size={40} className="text-white" />
                            </div>
                            <span className="text-2xl font-bold uppercase tracking-widest font-display text-[#dc2626] mt-6 bg-[#222] px-4 py-1">
                                Render Failed
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="flex h-24 w-24 items-center justify-center border-4 border-[#333] bg-[#111] rounded-none rotate-45 mb-6">
                                <Icon name="image" size={32} className="text-[#333] -rotate-45" />
                            </div>
                            <span className="text-2xl font-bold font-display uppercase tracking-widest text-[#555] mt-2">
                                Frame {page.index + 1}
                            </span>
                            <span className="text-sm font-bold font-mono uppercase tracking-widest text-[#444] border-t border-b border-[#333] px-4 py-1 mt-2">
                                {page.panelCount} panels
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
