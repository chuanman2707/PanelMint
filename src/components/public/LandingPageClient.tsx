'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'
import { CtaSection, EngineSpecsSection, FeatureSection, PricingSection, SignalStrip } from './PublicSections'
import { HERO_TERMINAL_LINES } from './public-content'
import { useRevealScope } from './useRevealScope'
import { useTypewriterText } from './useTypewriterText'

export function LandingPageClient() {
    const mainRef = useRef<HTMLElement | null>(null)
    const gridRef = useRef<HTMLDivElement | null>(null)
    const terminalPlaneRef = useRef<HTMLDivElement | null>(null)
    const prefersReducedMotion = useRevealScope(mainRef)
    const { typedText, showCursor } = useTypewriterText(HERO_TERMINAL_LINES)

    useEffect(() => {
        if (prefersReducedMotion || typeof window === 'undefined') {
            return
        }

        let frame = 0

        const updateParallax = () => {
            frame = 0
            const scrollY = window.scrollY
            const gridOffset = Math.min(scrollY * 0.14, 72)
            const planeOffset = Math.min(scrollY * 0.08, 40)

            if (gridRef.current) {
                gridRef.current.style.transform = `translate3d(0, ${gridOffset}px, 0)`
            }

            if (terminalPlaneRef.current) {
                terminalPlaneRef.current.style.transform = `translate3d(0, ${planeOffset}px, 0)`
            }
        }

        const handleScroll = () => {
            if (!frame) {
                frame = window.requestAnimationFrame(updateParallax)
            }
        }

        updateParallax()
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            window.removeEventListener('scroll', handleScroll)
            if (frame) {
                window.cancelAnimationFrame(frame)
            }
        }
    }, [prefersReducedMotion])

    return (
        <main ref={mainRef} className="neo-motion-scope overflow-hidden">
            <section className="relative overflow-hidden border-b-[var(--neo-border-width)] border-black bg-[var(--neo-bg-canvas)]">
                <div
                    ref={gridRef}
                    aria-hidden="true"
                    className="neo-grid-paper pointer-events-none absolute inset-0 opacity-70"
                    style={{ maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)' }}
                />
                <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,213,0,0.18),transparent)]" />
                <div className="mx-auto grid min-h-[calc(100svh-81px)] max-w-[1360px] gap-12 px-4 py-12 md:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,0.82fr)] lg:items-center lg:py-16">
                    <div className="relative z-10 max-w-[40rem]">
                        <NeoTag tone="yellow">V_01. ENGINE READY</NeoTag>
                        <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.22em] text-[color:rgba(9,9,11,0.54)]">
                            COMIC_OS // PUBLIC ACCESS LAYER
                        </p>
                        <h1 className="mt-4 max-w-[9ch] font-display text-[clamp(4rem,9vw,8rem)] font-black uppercase leading-[0.84] tracking-[-0.08em] text-black">
                            Turn text into ink.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:rgba(9,9,11,0.78)]">
                            Weoweo turns long-form story input into a guided comic workflow: analyze, review, storyboard, render, then read and edit inside one tactile workspace.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <NeoButton asChild size="lg">
                                <Link href="/create">
                                    <Icon name="sparkles" size={18} />
                                    Start locally
                                </Link>
                            </NeoButton>
                            <NeoButton asChild variant="secondary" size="lg">
                                <Link href="#pricing">
                                    <Icon name="wallet" size={18} />
                                    See pricing
                                </Link>
                            </NeoButton>
                        </div>
                        <div className="mt-10 flex flex-wrap gap-3">
                            <NeoTag tone="ink">SYSTEM_STATUS: NOMINAL</NeoTag>
                            <NeoTag tone="cyan">ENGINE_v2.4</NeoTag>
                            <NeoTag tone="default">LOCAL OSS</NeoTag>
                        </div>
                    </div>

                    <div ref={terminalPlaneRef} className="relative z-10">
                        <NeoCard className="neo-scanlines overflow-hidden bg-[var(--neo-bg-panel)] p-0" noHover>
                            <div data-neo-reveal="scanline" data-visible="true" className="neo-scanline-pulse border-b-[var(--neo-border-width)] border-black bg-black px-5 py-4 text-[var(--neo-accent-lime)]">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]">
                                        COMIC_OS // TERMINAL
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full border border-white/20 bg-[#ff6b6b]" />
                                        <span className="h-3 w-3 rounded-full border border-white/20 bg-[#ffd500]" />
                                        <span className="h-3 w-3 rounded-full border border-white/20 bg-[#7be495]" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-5 p-6">
                                <div className="border-[var(--neo-border-width)] border-black bg-white p-5 shadow-[var(--neo-shadow-card)]">
                                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[color:rgba(9,9,11,0.56)]">
                                        Terminal boot
                                    </p>
                                    <div className="mt-4 border-[var(--neo-border-width-sm)] border-black bg-black px-4 py-4 font-mono text-xs uppercase tracking-[0.18em] text-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-button)]">
                                        <div className="whitespace-pre-wrap break-words">
                                            {typedText}
                                            <span className={`inline-block w-3 text-center ${showCursor ? 'opacity-100' : 'opacity-0'}`}>_</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    {[
                                        ['INPUT', 'Story', 'white'],
                                        ['PIPELINE', 'Review', 'cyan'],
                                        ['OUTPUT', 'Reader', 'lime'],
                                    ].map(([label, value, tone]) => (
                                        <div
                                            key={label}
                                            className={`border-[var(--neo-border-width)] border-black p-5 xl:p-6 shadow-[var(--neo-shadow-button)] ${
                                                tone === 'cyan'
                                                    ? 'bg-[var(--neo-accent-cyan)]'
                                                    : tone === 'lime'
                                                        ? 'bg-[var(--neo-accent-lime)]'
                                                        : 'bg-white'
                                            }`}
                                        >
                                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/70">
                                                {label}
                                            </p>
                                            <p className="mt-3 font-display text-2xl font-black uppercase tracking-[-0.05em] text-black xl:text-3xl">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-[var(--neo-border-width)] border-black bg-white p-5 shadow-[var(--neo-shadow-card)]">
                                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[color:rgba(9,9,11,0.56)]">
                                        Live workflow
                                    </p>
                                    <div className="mt-4 grid gap-3">
                                        {['Paste manuscript', 'Approve analysis', 'Review storyboard', 'Render pages', 'Read or edit'].map((step, index) => (
                                            <div key={step} className="flex items-center gap-3 border-[var(--neo-border-width-sm)] border-black bg-[var(--neo-bg-canvas)] px-4 py-3">
                                                <span className="flex h-8 w-8 items-center justify-center border-[var(--neo-border-width-sm)] border-black bg-[var(--neo-accent-yellow)] font-mono text-xs font-bold">
                                                    0{index + 1}
                                                </span>
                                                <span className="font-display text-base font-black uppercase tracking-[-0.03em] text-black">
                                                    {step}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </NeoCard>
                    </div>
                </div>
            </section>

            <SignalStrip />
            <FeatureSection />
            <EngineSpecsSection />
            <PricingSection />
            <CtaSection />
        </main>
    )
}
