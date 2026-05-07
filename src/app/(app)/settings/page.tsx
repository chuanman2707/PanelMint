'use client'

import { useLocalUser } from '@/hooks/useLocalUser'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

const WAVESPEED_SETUP_URL = 'https://wavespeed.ai/accesskey'

export default function SettingsPage() {
    const { user } = useLocalUser()

    return (
        <div className="mx-auto max-w-7xl p-6 md:p-10">
            <header className="mb-10">
                <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-black uppercase leading-none tracking-[-0.06em]">
                    Settings <span className="text-[var(--neo-accent-cyan)]">_Terminal</span>
                </h1>
                <p className="mt-4 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-black/55">
                    Local profile and WaveSpeed environment setup.
                </p>
            </header>

            <div className="grid gap-6 md:grid-cols-12">
                <NeoCard className="md:col-span-5" noHover>
                    <div className="mb-8 flex items-start justify-between gap-6">
                        <div>
                            <NeoTag tone="lime">LOCAL_PROFILE</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Workspace Identity</h2>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] shadow-[var(--neo-shadow-button)]">
                            <Icon name="user" size={26} />
                        </div>
                    </div>

                    <div className="grid gap-6">
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Display name</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm uppercase">
                                {user?.name || 'Local Creator'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Contact uplink</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm">
                                {user?.email || 'local@panelmint.dev'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Render mode</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-lime)] px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                Single local WaveSpeed mode
                            </div>
                        </div>
                    </div>
                </NeoCard>

                <NeoCard className="bg-[var(--neo-bg-panel)] md:col-span-7" noHover>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <NeoTag tone="cyan">WaveSpeed AI</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Environment Provider</h2>
                            <p className="mt-3 max-w-2xl text-sm text-black/70">
                                PanelMint reads the WaveSpeed key from <code className="font-mono">WAVESPEED_API_KEY</code> in <code className="font-mono">.env</code>. The app does not store provider keys in the database.
                            </p>
                        </div>
                        <NeoTag tone="lime">.env only</NeoTag>
                    </div>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">LLM protocol</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                Seed 1.6 Flash
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Image protocol</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                FLUX Kontext Pro Multi
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Required env</p>
                            <p className="mt-3 break-all font-mono text-sm">WAVESPEED_API_KEY</p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Health check</p>
                            <p className="mt-3 font-mono text-sm">/api/health</p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] px-4 py-4 md:col-span-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">WaveSpeed account</p>
                            <p className="mt-3 text-sm text-black/80">
                                Generate a WaveSpeed key, set it in <code className="font-mono">.env</code>, and restart the app before generating comics.
                            </p>
                            <a className="mt-3 block break-all font-mono text-sm font-bold underline underline-offset-4" href={WAVESPEED_SETUP_URL} target="_blank" rel="noreferrer">
                                {WAVESPEED_SETUP_URL}
                            </a>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
