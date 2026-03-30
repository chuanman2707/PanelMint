import { Icon } from '@/components/ui/icons'

const DASHBOARD_PACKAGES = [
    {
        id: 'sketchbook',
        tag: 'UNIT_PACK: 01',
        mode: 'ONE_TIME_DEPLOYMENT',
        name: 'Sketchbook',
        price: '$19',
        unit: '/credit_drop',
        credits: '500 credits',
        accent: 'cyan' as const,
        highlight: null,
        features: [
            'Standard AI model access',
            '720p panel resolution',
            'Cloud storage (30 days)',
        ],
    },
    {
        id: 'graphic-novel',
        tag: 'SUBSCRIPTION_CORE: v2',
        mode: 'MONTHLY_PROTOCOL',
        name: 'Graphic Novel',
        price: '$49',
        unit: '/mo',
        credits: '2,500 credits / mo',
        accent: 'yellow' as const,
        highlight: 'Most deployed',
        features: [
            'Priority render pipeline',
            '4K upscaling enabled',
            'Infinite storage protocol',
            'Custom style embedding',
        ],
    },
    {
        id: 'anthology',
        tag: 'UNIT_PACK: MAX',
        mode: 'BULK_INJECTION',
        name: 'Anthology',
        price: '$149',
        unit: '/drop',
        credits: '10,000 credits',
        accent: 'lime' as const,
        highlight: null,
        features: [
            'Dedicated GPU core',
            'Unmasked engine controls',
            'API direct connection',
        ],
    },
] as const

function accentClasses(accent: (typeof DASHBOARD_PACKAGES)[number]['accent']) {
    if (accent === 'yellow') {
        return {
            text: 'text-[var(--neo-accent-yellow)]',
            badge: 'bg-[var(--neo-accent-yellow)] text-black',
            border: 'border-[var(--neo-accent-yellow)]/70',
        }
    }

    if (accent === 'lime') {
        return {
            text: 'text-[var(--neo-accent-lime)]',
            badge: 'bg-[var(--neo-accent-lime)] text-black',
            border: 'border-[var(--neo-accent-lime)]/70',
        }
    }

    return {
        text: 'text-[var(--neo-accent-cyan)]',
        badge: 'bg-[var(--neo-accent-cyan)] text-black',
        border: 'border-[var(--neo-accent-cyan)]/70',
    }
}

export default function DashboardPricingPage() {
    return (
        <main className="mx-auto max-w-[1240px] p-6 md:p-8">
            <section className="overflow-hidden border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-canvas)] shadow-[var(--neo-shadow-card)]">
                <div className="border-b-[var(--neo-border-width)] border-[var(--neo-ink)] px-6 py-6 md:px-8">
                    <div className="flex flex-col gap-5">
                        <div className="h-8 w-8 border-l-[var(--neo-border-width)] border-t-[var(--neo-border-width)] border-[var(--neo-ink)]" />
                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="font-display text-[clamp(3.2rem,7vw,5.8rem)] font-black uppercase leading-[0.86] tracking-[-0.08em] text-[var(--neo-ink)]">
                                Fuel The
                            </h1>
                            <span className="inline-flex border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] px-4 py-2 font-display text-[clamp(3.2rem,7vw,5.8rem)] font-black uppercase leading-[0.86] tracking-[-0.08em] text-[var(--neo-ink)] shadow-[6px_6px_0_var(--neo-ink)]">
                                Engine
                            </span>
                        </div>
                        <div className="max-w-4xl border-l-4 border-[var(--neo-accent-pink)] pl-4">
                            <p className="font-mono text-[clamp(1rem,2.2vw,2rem)] uppercase leading-[1.55] tracking-[0.12em] text-black/58">
                                Storyboards, panels, and full volumes. Select your package type to deploy assets to the render farm.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-8 md:px-8 md:py-10">
                    <div className="grid gap-6 xl:grid-cols-3">
                        {DASHBOARD_PACKAGES.map((pkg, index) => {
                            const accent = accentClasses(pkg.accent)

                            return (
                                <article
                                    key={pkg.id}
                                    className={`relative flex h-full flex-col border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white shadow-[6px_6px_0_var(--neo-ink)] ${
                                        index === 1 ? 'xl:-mt-6' : ''
                                    }`}
                                >
                                    {pkg.highlight ? (
                                        <div className="absolute left-4 top-0 -translate-y-1/2 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-pink)] px-4 py-1 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[4px_4px_0_var(--neo-ink)]">
                                            {pkg.highlight}
                                        </div>
                                    ) : null}

                                    <div className="flex items-center justify-between border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-black px-4 py-3">
                                        <span className={`font-mono text-xs font-bold uppercase tracking-[0.16em] ${accent.text}`}>
                                            {pkg.tag}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-[#ff8d8d]" />
                                            <span className="h-3 w-3 rounded-full bg-[#ffd84d]" />
                                        </div>
                                    </div>

                                    <div className="flex h-full flex-col gap-6 p-5 md:p-6">
                                        <div>
                                            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-black/45">
                                                {pkg.mode}
                                            </p>
                                            <h2 className="mt-4 max-w-[8ch] font-display text-[clamp(2.2rem,4vw,3.6rem)] font-black uppercase leading-[0.88] tracking-[-0.07em] text-[var(--neo-ink)]">
                                                {pkg.name}
                                            </h2>
                                        </div>

                                        <div className="flex items-end gap-2">
                                            <span className="font-display text-[clamp(3rem,6vw,4.8rem)] font-black leading-none tracking-[-0.08em] text-[var(--neo-ink)]">
                                                {pkg.price}
                                            </span>
                                            <span className="pb-2 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black/35">
                                                {pkg.unit}
                                            </span>
                                        </div>

                                        <div className={`w-fit border-[var(--neo-border-width-sm)] px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.12em] ${accent.badge} ${accent.border}`}>
                                            {pkg.credits}
                                        </div>

                                        <div className="mt-auto space-y-4 border-t-[var(--neo-border-width-sm)] border-black/10 pt-2">
                                            {pkg.features.map((feature) => (
                                                <div key={feature} className="flex items-start gap-3">
                                                    <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--neo-accent-lime)] text-[var(--neo-accent-lime)]">
                                                        <Icon name="check" size={12} />
                                                    </span>
                                                    <span className="font-mono text-sm uppercase leading-6 tracking-[0.08em] text-black/72">
                                                        {feature}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>
        </main>
    )
}
