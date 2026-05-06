import type { CSSProperties } from 'react'
import Link from 'next/link'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'
import { ENGINE_SPECS, FEATURE_ROWS, HERO_SIGNAL_STRIP } from './public-content'

function revealDelay(index: number) {
    return { ['--neo-reveal-delay' as string]: `${index * 90}ms` } as CSSProperties
}

interface FeatureSectionProps {
    id?: string
}

export function FeatureSection({ id = 'features' }: FeatureSectionProps) {
    return (
        <section id={id} className="neo-anchor-target mx-auto max-w-[1240px] px-4 py-20 md:px-6 md:py-24">
            <div data-neo-reveal="panel" className="max-w-3xl">
                <NeoTag tone="cyan">GUIDED REVIEW LOOP</NeoTag>
                <h2 className="mt-6 max-w-[14ch] font-display text-[clamp(2.5rem,5vw,4rem)] font-black uppercase leading-[0.9] tracking-[-0.06em] text-black">
                    Every pass stays visible before the render starts.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[color:rgba(9,9,11,0.74)]">
                    The public surface should feel like a print room checklist: inspect the structure, lock the storyboard, then render with your local WaveSpeed key.
                </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div
                    data-neo-reveal="panel"
                    style={revealDelay(1)}
                    className="neo-grid-paper overflow-hidden border-[var(--neo-border-width)] border-black bg-[var(--neo-bg-canvas)] p-6 shadow-[var(--neo-shadow-card)] md:p-8"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <NeoTag tone="ink">PRINT ROOM VIEW</NeoTag>
                        <NeoTag tone="paper">Section-first workflow</NeoTag>
                    </div>
                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        {[
                            ['Analysis lock', 'Verify characters, locations, and story intent before any panel imagery is generated.'],
                            ['Storyboard review', 'Approve panel beats in sequence so pacing and camera logic are intentional.'],
                            ['Provider ownership', 'WaveSpeed requests stay tied to your own account key outside this workspace.'],
                            ['Local finish', 'Reader and editor live inside the local workspace, not bolted onto the marketing shell.'],
                        ].map(([title, copy], index) => (
                            <div key={title} className="border-[var(--neo-border-width-sm)] border-black bg-white px-4 py-4 shadow-[var(--neo-shadow-button)]">
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[color:rgba(9,9,11,0.48)]">
                                    0{index + 1}
                                </p>
                                <h3 className="mt-3 font-display text-xl font-black uppercase tracking-[-0.04em] text-black">
                                    {title}
                                </h3>
                                <p className="mt-3 text-sm leading-7 text-[color:rgba(9,9,11,0.72)]">
                                    {copy}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-6">
                    {FEATURE_ROWS.map((feature, index) => (
                        <NeoCard
                            key={feature.title}
                            data-neo-reveal="drop"
                            style={revealDelay(index + 2)}
                            className="h-full bg-white"
                        >
                            <NeoTag tone={feature.tone}>{feature.title}</NeoTag>
                            <h3 className="mt-6 font-display text-3xl font-black uppercase tracking-[-0.05em] text-black">
                                {feature.title}
                            </h3>
                            <p className="mt-4 text-base leading-7 text-[color:rgba(9,9,11,0.74)]">
                                {feature.copy}
                            </p>
                        </NeoCard>
                    ))}
                </div>
            </div>
        </section>
    )
}

export function SignalStrip() {
    return (
        <section className="border-y-[var(--neo-border-width)] border-black bg-black text-[var(--neo-accent-lime)]">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 font-mono text-[11px] font-bold uppercase tracking-[0.24em] md:px-6">
                {HERO_SIGNAL_STRIP.map((item) => (
                    <span key={item}>{item}</span>
                ))}
            </div>
        </section>
    )
}

interface EngineSpecsSectionProps {
    id?: string
}

export function EngineSpecsSection({ id = 'engine-specs' }: EngineSpecsSectionProps) {
    return (
        <section id={id} className="mx-auto max-w-[1240px] px-4 py-20 md:px-6 md:py-24">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div data-neo-reveal="panel" className="space-y-6">
                    <NeoTag tone="yellow">ENGINE SPECS</NeoTag>
                    <h2 className="max-w-[12ch] font-display text-[clamp(2.2rem,4vw,3.4rem)] font-black uppercase leading-[0.9] tracking-[-0.05em] text-black">
                        Built like a print console, not a prompt roulette wheel.
                    </h2>
                    <p className="max-w-xl text-base leading-8 text-[color:rgba(9,9,11,0.72)]">
                        The system earns trust by making each render step visible. Every section should feel like a labeled station in a production pipeline rather than an abstract AI promise.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    {ENGINE_SPECS.map((spec, index) => (
                        <div
                            key={spec.label}
                            data-neo-reveal="panel"
                            style={revealDelay(index)}
                            className="border-[var(--neo-border-width)] border-black bg-white px-5 py-6 shadow-[var(--neo-shadow-card)]"
                        >
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:rgba(9,9,11,0.52)]">
                                {spec.label}
                            </p>
                            <h3 className="mt-4 font-display text-2xl font-black uppercase tracking-[-0.04em] text-black">
                                {spec.value}
                            </h3>
                            <p className="mt-4 text-sm leading-7 text-[color:rgba(9,9,11,0.7)]">
                                {spec.copy}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

interface CtaSectionProps {
    id?: string
}

export function CtaSection({ id = 'cta' }: CtaSectionProps) {
    return (
        <section id={id} className="neo-anchor-target border-y-[var(--neo-border-width)] border-black bg-black px-4 py-20 text-[var(--neo-accent-lime)] md:px-6 md:py-24">
            <div
                data-neo-reveal="panel"
                className="neo-scanlines mx-auto max-w-[1160px] overflow-hidden border-[var(--neo-border-width)] border-[var(--neo-accent-lime)]/45 bg-[linear-gradient(135deg,rgba(123,228,149,0.12),rgba(0,0,0,0.9))] px-6 py-8 shadow-[var(--neo-shadow-card)] md:px-10 md:py-10"
            >
                <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                    <div>
                        <NeoTag tone="paper">START THE FIRST PASS</NeoTag>
                        <h2 className="mt-6 max-w-[12ch] font-display text-[clamp(2.5rem,5vw,4.2rem)] font-black uppercase leading-[0.9] tracking-[-0.06em] text-white">
                            Bring the manuscript in. Keep the approval loop human.
                        </h2>
                    </div>
                    <div>
                        <p className="max-w-xl text-base leading-8 text-[color:rgba(255,255,255,0.78)]">
                            Start in the local workspace, inspect each gate before render, and keep the route handoff clean from landing to dashboard to immersive reading.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <NeoButton asChild size="lg">
                                <Link href="/create">
                                    <Icon name="sparkles" size={18} />
                                    Start locally
                                </Link>
                            </NeoButton>
                            <NeoButton asChild variant="secondary" size="lg">
                                <Link href="/legal">
                                    <Icon name="file-text" size={18} />
                                    Legal terms
                                </Link>
                            </NeoButton>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
