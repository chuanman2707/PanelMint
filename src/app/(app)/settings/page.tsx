'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoInput } from '@/components/ui/NeoInput'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

type Provider = 'wavespeed'
type SettingsTab = 'credits' | 'advanced'

interface CreditPackage {
    id: string
    name: string
    priceUsd: number
    credits: number
    savingsLabel: string | null
}

interface CreditTransactionItem {
    id: string
    amount: number
    balance: number
    reason: string
    label: string
    createdAt: string
    providerTxId: string | null
    direction: 'credit' | 'debit'
}

interface CreditsResponse {
    balance: number
    accountTier: string
    lifetimePurchasedCredits: number
    priceBook: {
        llmGeneration: number
        standardImage: number
        premiumImage: number
    }
    packages: CreditPackage[]
    transactions: CreditTransactionItem[]
}

const PROVIDERS = [
    {
        id: 'wavespeed' as const,
        name: 'WaveSpeed AI',
        description: 'Unified provider for text generation and multi-reference image generation.',
        llm: 'Seed 1.6 Flash',
        imageGen: 'FLUX Kontext Pro Multi',
        pricing: 'Project configured',
        setupUrl: 'https://wavespeed.ai/accesskey',
        keyPrefix: 'ws_',
    },
]

function formatUsd(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(value)
}

function formatCredits(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatTransactionTime(value: string) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export default function SettingsPage() {
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const packagesRef = useRef<HTMLDivElement | null>(null)

    const initialTab = searchParams.get('tab') === 'advanced' ? 'advanced' : 'credits'
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
    const [creditsData, setCreditsData] = useState<CreditsResponse | null>(null)
    const [creditsLoading, setCreditsLoading] = useState(true)
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
    const [selectedProvider, setSelectedProvider] = useState<Provider>('wavespeed')
    const [apiKey, setApiKey] = useState('')
    const [maskedKey, setMaskedKey] = useState('')
    const [hasKey, setHasKey] = useState(false)
    const [currentProvider, setCurrentProvider] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const [validating, setValidating] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        setActiveTab(searchParams.get('tab') === 'advanced' ? 'advanced' : 'credits')
    }, [searchParams])

    useEffect(() => {
        let active = true

        const loadCredits = async () => {
            try {
                const res = await fetch('/api/user/credits')
                if (!res.ok) throw new Error('Failed to load credits')
                const data = await res.json() as CreditsResponse
                if (!active) return
                setCreditsData(data)
                setSelectedPackageId((current) => current ?? data.packages[1]?.id ?? data.packages[0]?.id ?? null)
            } catch {
                if (active) setCreditsData(null)
            } finally {
                if (active) setCreditsLoading(false)
            }
        }

        const loadApiKey = async () => {
            try {
                const res = await fetch('/api/user/api-key')
                const data = await res.json()
                if (!active) return
                setHasKey(!!data.hasKey)
                setMaskedKey(data.maskedKey || '')
                setCurrentProvider(data.provider ?? 'wavespeed')
            } catch {
                if (active) setHasKey(false)
            }
        }

        void Promise.all([loadCredits(), loadApiKey()])

        return () => {
            active = false
        }
    }, [])

    const switchTab = (tab: SettingsTab) => {
        setActiveTab(tab)
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.replace(`${pathname}?${params.toString()}`)
    }

    const selectedPackage = useMemo(
        () => creditsData?.packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
        [creditsData?.packages, selectedPackageId],
    )

    const handleSaveKey = async () => {
        if (!apiKey.trim()) return
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch('/api/user/api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKey.trim(), provider: selectedProvider }),
            })
            const data = await res.json()

            if (res.ok) {
                setHasKey(true)
                setMaskedKey(data.maskedKey || '')
                setCurrentProvider(selectedProvider)
                setApiKey('')
                setMessage({ type: 'success', text: `API key saved securely (${selectedProvider}).` })
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save key.' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save API key.' })
        } finally {
            setSaving(false)
        }
    }

    const handleValidateKey = async () => {
        setValidating(true)
        setMessage(null)

        try {
            const res = await fetch('/api/user/api-key?validate=true')
            const data = await res.json()
            setMessage({
                type: data.valid ? 'success' : 'error',
                text: data.valid ? 'API key is valid and working.' : (data.error || 'API key validation failed.'),
            })
        } catch {
            setMessage({ type: 'error', text: 'Validation failed.' })
        } finally {
            setValidating(false)
        }
    }

    const handleDeleteKey = async () => {
        try {
            const res = await fetch('/api/user/api-key', { method: 'DELETE' })
            if (!res.ok) throw new Error('Delete failed')
            setHasKey(false)
            setMaskedKey('')
            setCurrentProvider(null)
            setApiKey('')
            setMessage({ type: 'success', text: 'API key removed.' })
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove API key.' })
        }
    }

    const activeProviderInfo = PROVIDERS.find((provider) => provider.id === selectedProvider) ?? PROVIDERS[0]
    const accountTier = (creditsData?.accountTier ?? user?.accountTier ?? 'free') === 'paid' ? 'Executive' : 'Free'
    const usagePercent = Math.min(100, Math.round(((creditsData?.balance ?? 0) / 5000) * 100))

    return (
        <div className="mx-auto max-w-7xl p-6 md:p-10">
            <header className="mb-10">
                <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-black uppercase leading-none tracking-[-0.06em]">
                    Settings <span className="text-[var(--neo-accent-cyan)]">_Terminal</span>
                </h1>
                <p className="mt-4 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-black/55">
                    Configure output parameters, manage cryptographic identity keys, and oversee subscription allocations.
                </p>
            </header>

            <div className="mb-10 flex flex-wrap gap-3">
                <NeoButton variant={activeTab === 'credits' ? 'primary' : 'secondary'} size="sm" onClick={() => switchTab('credits')}>
                    Credits
                </NeoButton>
                <NeoButton variant={activeTab === 'advanced' ? 'primary' : 'secondary'} size="sm" onClick={() => switchTab('advanced')}>
                    Advanced API
                </NeoButton>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
                <NeoCard className="md:col-span-8" noHover>
                    <div className="mb-8 flex items-start justify-between gap-6">
                        <div>
                            <NeoTag tone="lime">SECURE_PROFILE_V3</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Identity Core</h2>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] shadow-[var(--neo-shadow-button)]">
                            <Icon name="user" size={26} />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Display name</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm uppercase">
                                {user?.name || 'Operator_Zero'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Contact uplink</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm">
                                {user?.email || 'operator@panelmint.io'}
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Bio data</p>
                            <div className="min-h-[132px] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm leading-6">
                                Constructing narratives through machine logic, review-first approvals, and consistent character control.
                            </div>
                        </div>
                    </div>
                </NeoCard>

                <NeoCard className="bg-[#c3c0ff] md:col-span-4" noHover>
                    <NeoTag>SUBSCRIPTION_LINK</NeoTag>
                    <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Plan Status</h2>
                    <div className="mt-8 space-y-6">
                        <div className="border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-white/50 px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Current tier</p>
                            <p className="mt-2 text-4xl font-black uppercase tracking-tight">{accountTier}</p>
                        </div>
                        <div>
                            <div className="mb-2 flex justify-between font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                                <span>Engine credits</span>
                                <span>{formatCredits(creditsData?.balance ?? 0)} / 5,000</span>
                            </div>
                            <div className="h-6 overflow-hidden border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white">
                                <div className="h-full border-r-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)]" style={{ width: `${usagePercent}%` }} />
                            </div>
                        </div>
                        <NeoButton variant="secondary" className="w-full" onClick={() => packagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                            Upgrade Tier
                        </NeoButton>
                    </div>
                </NeoCard>
            </div>

            {activeTab === 'credits' ? (
                <div className="mt-8 space-y-8">
                    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
                        <NeoCard className="bg-[var(--neo-accent-yellow)]" noHover>
                            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <p className="font-display text-5xl font-black uppercase tracking-tight md:text-7xl">
                                        {creditsLoading ? '...' : formatCredits(creditsData?.balance ?? 0)}
                                    </p>
                                    <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                                        Ink_Credits
                                    </p>
                                    <div className="mt-6 inline-block bg-[var(--neo-ink)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                        READY_FOR_GENERATION: {(creditsData?.accountTier ?? 'free') === 'paid' ? 'HIGH_FIDELITY_ENABLED' : 'STANDARD_ONLY'}
                                    </div>
                                </div>
                                <NeoButton onClick={() => packagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                                    Buy Credits
                                </NeoButton>
                            </div>
                        </NeoCard>

                        <NeoCard className="bg-[var(--neo-bg-panel)]" noHover>
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Usage key</p>
                            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight">What each action costs</h2>
                            <div className="mt-6 space-y-3">
                                {[
                                    ['LLM writing step', `${creditsData?.priceBook.llmGeneration ?? 80} credits`, 'file-text'],
                                    ['Standard image', `${creditsData?.priceBook.standardImage ?? 40} credits`, 'image'],
                                    ['Premium image', `${creditsData?.priceBook.premiumImage ?? 120} credits`, 'crown'],
                                ].map(([label, value, icon]) => (
                                    <div key={label} className="flex items-center justify-between border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-white px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Icon name={icon} size={18} />
                                            <span className="font-display text-sm font-bold uppercase tracking-tight">{label}</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </NeoCard>
                    </div>

                    <section ref={packagesRef}>
                        <div className="mb-6 flex items-end justify-between gap-4">
                            <div>
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Credit packs</p>
                                <h2 className="mt-2 text-4xl font-black uppercase tracking-tight">Fuel the render farm</h2>
                            </div>
                            <NeoTag tone="cyan">
                                Lifetime purchased: {formatCredits(creditsData?.lifetimePurchasedCredits ?? 0)}
                            </NeoTag>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {(creditsData?.packages ?? []).map((pkg) => {
                                    const selected = pkg.id === selectedPackageId
                                    return (
                                        <NeoCard
                                            key={pkg.id}
                                            className={selected ? 'bg-[var(--neo-bg-panel)]' : ''}
                                            noHover
                                        >
                                            <div className="flex h-full flex-col justify-between gap-5">
                                                <div>
                                                    <NeoTag tone={selected ? 'yellow' : 'default'}>
                                                        {pkg.savingsLabel || 'ONE_TIME_DEPLOYMENT'}
                                                    </NeoTag>
                                                    <h3 className="mt-4 text-3xl font-black uppercase tracking-tight">{pkg.name}</h3>
                                                    <p className="mt-3 font-display text-5xl font-black tracking-tight">{formatUsd(pkg.priceUsd)}</p>
                                                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black/60">
                                                        {formatCredits(pkg.credits)} credits added instantly after checkout
                                                    </p>
                                                </div>
                                                <NeoButton
                                                    variant={selected ? 'primary' : 'secondary'}
                                                    onClick={() => setSelectedPackageId(pkg.id)}
                                                >
                                                    {selected ? 'Selected' : `Choose ${pkg.name}`}
                                                </NeoButton>
                                            </div>
                                        </NeoCard>
                                    )
                                })}
                            </div>

                            <NeoCard className="bg-[var(--neo-bg-panel)]" noHover>
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Selected package</p>
                                <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">
                                    {selectedPackage ? `${selectedPackage.name} top-up` : 'Pick a package'}
                                </h2>
                                {selectedPackage ? (
                                    <div className="mt-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-white px-4 py-3">
                                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Price</p>
                                                <p className="mt-2 text-xl font-black uppercase">{formatUsd(selectedPackage.priceUsd)}</p>
                                            </div>
                                            <div className="border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-white px-4 py-3">
                                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Credits</p>
                                                <p className="mt-2 text-xl font-black uppercase">{formatCredits(selectedPackage.credits)}</p>
                                            </div>
                                        </div>
                                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                                            <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-tight">
                                                <Icon name="credit-card" size={16} />
                                                Checkout hook point
                                            </p>
                                            <p className="mt-3 text-sm text-black/70">
                                                This UI is ready for payment wiring. The selected package becomes the checkout payload and upgrades the account to paid on success.
                                            </p>
                                        </div>
                                        <NeoButton className="w-full">Initialize purchase</NeoButton>
                                    </div>
                                ) : (
                                    <p className="mt-4 text-sm text-black/70">
                                        Choose a package card to preview the checkout summary.
                                    </p>
                                )}
                            </NeoCard>
                        </div>
                    </section>

                    <NeoCard noHover>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Transaction history</p>
                                <h2 className="mt-2 text-3xl font-black uppercase tracking-tight">Every credit movement in one ledger</h2>
                            </div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/50">
                                Credits, refunds, and welcome bonus all land here.
                            </p>
                        </div>

                        <div className="mt-6 space-y-3">
                            {(creditsData?.transactions ?? []).length > 0 ? (
                                creditsData!.transactions.map((transaction) => (
                                    <div key={transaction.id} className="grid gap-4 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] px-4 py-4 md:grid-cols-[1.1fr_auto_auto]">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <NeoTag tone={transaction.direction === 'credit' ? 'lime' : 'default'}>
                                                    {transaction.direction === 'credit' ? 'Credit' : 'Debit'}
                                                </NeoTag>
                                                <p className="font-display text-sm font-bold uppercase tracking-tight">{transaction.label}</p>
                                            </div>
                                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-black/55">
                                                {formatTransactionTime(transaction.createdAt)}
                                            </p>
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/55">Delta</p>
                                            <p className="mt-2 font-display text-xl font-black uppercase tracking-tight">
                                                {transaction.direction === 'credit' ? '+' : '-'}{formatCredits(Math.abs(transaction.amount))}
                                            </p>
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/55">Balance</p>
                                            <p className="mt-2 font-display text-xl font-black uppercase tracking-tight">
                                                {formatCredits(transaction.balance)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="border-[var(--neo-border-width)] border-dashed border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-8 text-center">
                                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">No ledger entries yet.</p>
                                </div>
                            )}
                        </div>
                    </NeoCard>
                </div>
            ) : null}

            {activeTab === 'advanced' ? (
                <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                    <NeoCard className="bg-[var(--neo-bg-panel)]" noHover>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tight">Access Protocols (API)</h2>
                                <p className="mt-3 max-w-2xl text-sm text-black/70">
                                    Manage the provider key used for text generation and multi-reference image generation in the engine.
                                </p>
                            </div>
                            <NeoTag tone="lime">{activeProviderInfo.name}</NeoTag>
                        </div>

                        <div className="mt-8 grid gap-6 md:grid-cols-2">
                            <div className="space-y-3">
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">LLM protocol</p>
                                <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                    {activeProviderInfo.llm}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Image protocol</p>
                                <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-display text-sm font-bold uppercase tracking-tight">
                                    {activeProviderInfo.imageGen}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <NeoInput
                                id="api-key"
                                type={showKey ? 'text' : 'password'}
                                label="Provider API key"
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={`${activeProviderInfo.keyPrefix}...`}
                                hint={`Get your key from ${activeProviderInfo.setupUrl}`}
                            />

                            <div className="flex flex-wrap gap-3">
                                <NeoButton onClick={handleSaveKey} disabled={!apiKey.trim() || saving}>
                                    {saving ? 'Saving...' : 'Commit Key'}
                                </NeoButton>
                                <NeoButton variant="secondary" onClick={handleValidateKey} disabled={!hasKey || validating}>
                                    {validating ? 'Validating...' : 'Validate'}
                                </NeoButton>
                                <NeoButton variant="secondary" onClick={() => setShowKey((current) => !current)}>
                                    {showKey ? 'Hide' : 'Reveal'} Input
                                </NeoButton>
                                <NeoButton variant="danger" onClick={handleDeleteKey} disabled={!hasKey}>
                                    Remove Key
                                </NeoButton>
                            </div>
                        </div>
                    </NeoCard>

                    <NeoCard noHover>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Current key status</h2>
                        <div className="mt-6 space-y-4">
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-4">
                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Stored key</p>
                                <p className="mt-3 break-all font-mono text-sm">{hasKey ? maskedKey : 'No key stored'}</p>
                            </div>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-4">
                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Provider</p>
                                <p className="mt-3 font-display text-lg font-bold uppercase tracking-tight">
                                    {currentProvider || 'Not configured'}
                                </p>
                            </div>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] px-4 py-4">
                                <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Setup URL</p>
                                <a className="mt-3 block break-all font-mono text-sm font-bold underline underline-offset-4" href={activeProviderInfo.setupUrl} target="_blank" rel="noreferrer">
                                    {activeProviderInfo.setupUrl}
                                </a>
                            </div>
                        </div>

                        {message ? (
                            <div className={`mt-6 border-[var(--neo-border-width)] border-[var(--neo-ink)] px-4 py-4 ${message.type === 'success' ? 'bg-[var(--neo-accent-lime)]' : 'bg-[var(--neo-accent-pink)]'}`}>
                                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">{message.text}</p>
                            </div>
                        ) : null}
                    </NeoCard>
                </div>
            ) : null}
        </div>
    )
}
