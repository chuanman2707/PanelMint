import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'

export const LEGAL_SECTIONS = [
    {
        title: 'Service use',
        body: 'You are responsible for the story material and prompts you submit. Do not upload content you do not have the right to process or republish.',
    },
    {
        title: 'Generation output',
        body: 'Generated comic pages may require review and editing before publication. Weoweo exposes approval gates so you can validate narrative and visual direction before rendering.',
    },
    {
        title: 'Provider key',
        body: 'Generation requests use the WaveSpeed key configured for this local workspace. PanelMint stores the provider key and generation project data only.',
    },
    {
        title: 'Workspace security',
        body: 'The local workspace keeps account state inside the app shell. Keep any optional provider API keys secure and remove custom keys immediately if you suspect compromise.',
    },
]

export default function LegalPage() {
    return (
        <main className="mx-auto max-w-[920px] px-4 py-14 md:px-6 md:py-16">
            <NeoCard className="bg-[var(--neo-bg-canvas)]" noHover>
                <NeoTag tone="ink">DOC_ID: TOX-772-LGL</NeoTag>
                <div className="mt-8 border-b-[var(--neo-border-width)] border-black pb-6">
                    <h1 className="font-display text-[clamp(2.6rem,5vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.06em] text-black">
                        Legal protocols.
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-[color:rgba(9,9,11,0.76)]">
                        This page outlines the current operating assumptions for the MVP UI migration and the responsibilities attached to account use, generated content, and provider-key settings.
                    </p>
                </div>

                <div className="mt-8 grid gap-5">
                    {LEGAL_SECTIONS.map((section, index) => (
                        <section key={section.title} className="border-[var(--neo-border-width)] border-black bg-white p-6 shadow-[var(--neo-shadow-button)]">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:rgba(9,9,11,0.56)]">
                                Section 0{index + 1}
                            </p>
                            <h2 className="mt-3 font-display text-2xl font-black uppercase tracking-[-0.04em] text-black">
                                {section.title}
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-[color:rgba(9,9,11,0.76)]">
                                {section.body}
                            </p>
                        </section>
                    ))}
                </div>
            </NeoCard>
        </main>
    )
}
