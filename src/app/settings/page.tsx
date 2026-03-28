'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Input'
import { Surface } from '@/components/ui/Surface'

type Provider = 'openrouter' | 'nvidia'
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

const PROVIDERS: Array<{
    id: Provider
    name: string
    description: string
    llm: string
    imageGen: string
    pricing: string
    risk: string | null
    setupUrl: string
    keyPrefix: string
}> = [
    {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Best quality & reliability',
        llm: 'Gemini 2.5 Flash',
        imageGen: 'SeedReam 4.5',
        pricing: '~$0.003/image',
        risk: null,
        setupUrl: 'https://openrouter.ai/keys',
        keyPrefix: 'sk-or-',
    },
    {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        description: 'Free but experimental',
        llm: 'Nemotron 3 Super 120B',
        imageGen: 'FLUX.1 Dev',
        pricing: 'Free (rate-limited)',
        risk: 'Account may be suspended if abused. Use at your own risk.',
        setupUrl: 'https://build.nvidia.com',
        keyPrefix: 'nvapi-',
    },
]

function formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(value)
}

function formatCredits(value: number): string {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatTransactionTime(value: string): string {
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function SettingsPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const packagesRef = useRef<HTMLDivElement | null>(null)

    const initialTab = searchParams.get('tab') === 'advanced' ? 'advanced' : 'credits'
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

    const [creditsData, setCreditsData] = useState<CreditsResponse | null>(null)
    const [creditsLoading, setCreditsLoading] = useState(true)
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

    const [selectedProvider, setSelectedProvider] = useState<Provider>('openrouter')
    const [apiKey, setApiKey] = useState('')
    const [maskedKey, setMaskedKey] = useState('')
    const [hasKey, setHasKey] = useState(false)
    const [currentProvider, setCurrentProvider] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const [validating, setValidating] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        const nextTab = searchParams.get('tab') === 'advanced' ? 'advanced' : 'credits'
        setActiveTab(nextTab)
    }, [searchParams])

    useEffect(() => {
        let active = true

        const loadCredits = async () => {
            try {
                const res = await fetch('/api/user/credits')
                if (!res.ok) throw new Error('Failed')
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
                if (data.provider && data.provider !== 'wavespeed') {
                    setCurrentProvider(data.provider)
                    setSelectedProvider(data.provider)
                } else {
                    setCurrentProvider(data.provider ?? null)
                }
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
        if (tab === 'credits') {
            params.set('tab', 'credits')
        } else {
            params.set('tab', 'advanced')
        }
        router.replace(`${pathname}?${params.toString()}`)
    }

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
                setMessage({ type: 'success', text: `API key saved securely (${selectedProvider})` })
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save API key' })
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

            if (data.valid) {
                setMessage({ type: 'success', text: 'API key is valid and working' })
            } else {
                setMessage({ type: 'error', text: data.error || 'API key validation failed' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Validation failed' })
        } finally {
            setValidating(false)
        }
    }

    const handleDeleteKey = async () => {
        try {
            const res = await fetch('/api/user/api-key', { method: 'DELETE' })
            if (res.ok) {
                setHasKey(false)
                setMaskedKey('')
                setCurrentProvider(null)
                setApiKey('')
                setMessage({ type: 'success', text: 'API key removed' })
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove API key' })
        }
    }

    const activeProviderInfo = PROVIDERS.find((provider) => provider.id === selectedProvider) ?? PROVIDERS[0]
    const selectedPackage = useMemo(
        () => creditsData?.packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
        [creditsData?.packages, selectedPackageId],
    )

    return (
        <div className="mx-auto max-w-[1180px] animate-fade-in space-y-6 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--weo-tone-neutral-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--weo-text-secondary)]">
                        <Icon name="wallet" size={14} className="text-[var(--weo-accent-from)]" />
                        Billing workspace
                    </span>
                    <h1 className="mt-5 text-4xl font-semibold text-[var(--weo-text-primary)] tracking-tight">
                        Credits & Billing
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--weo-text-secondary)]">
                        Platform-managed credits now power the default creation flow. Manage balance, select top-up packages, and review every debit and refund in one place.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-[var(--weo-stroke-soft)] bg-white/70 p-1.5 shadow-[var(--weo-shadow-sm)]">
                    <button
                        type="button"
                        onClick={() => switchTab('credits')}
                        className={`weo-pill ${activeTab === 'credits' ? 'weo-pill-active' : ''}`}
                    >
                        Credits
                    </button>
                    <button
                        type="button"
                        onClick={() => switchTab('advanced')}
                        className={`weo-pill ${activeTab === 'advanced' ? 'weo-pill-active' : ''}`}
                    >
                        Advanced API
                    </button>
                </div>
            </div>

            {activeTab === 'credits' && (
                <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                        <Surface variant="elevated" className="relative overflow-hidden">
                            <div
                                className="absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
                                style={{ background: 'radial-gradient(circle, var(--weo-accent-from), transparent 70%)' }}
                            />
                            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                                <div className="space-y-4">
                                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--weo-accent-glow)] text-[var(--weo-accent-from)]">
                                        <Icon name="wallet" size={20} />
                                    </div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--weo-text-muted)]">
                                        Current balance
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <p className="text-5xl font-semibold tracking-tight text-[var(--weo-text-primary)]">
                                            {creditsLoading ? '...' : formatCredits(creditsData?.balance ?? 0)}
                                        </p>
                                        <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
                                            style={{
                                                background: (creditsData?.accountTier ?? 'free') === 'paid'
                                                    ? 'var(--weo-tone-success-bg)'
                                                    : 'var(--weo-tone-info-bg)',
                                                color: (creditsData?.accountTier ?? 'free') === 'paid'
                                                    ? 'var(--weo-tone-success-fg)'
                                                    : 'var(--weo-tone-info-fg)',
                                            }}
                                        >
                                            {(creditsData?.accountTier ?? 'free') === 'paid' ? 'Paid' : 'Free'}
                                        </span>
                                    </div>
                                    <p className="max-w-xl text-sm leading-7 text-[var(--weo-text-secondary)]">
                                        Premium rendering unlocks automatically after your first successful top-up. Your current lifetime purchased credits: {formatCredits(creditsData?.lifetimePurchasedCredits ?? 0)}.
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-xs text-[var(--weo-text-secondary)]">
                                        <span className="rounded-full bg-[var(--weo-tone-neutral-bg)] px-3 py-1.5 font-semibold">
                                            Built-in credits stay default
                                        </span>
                                        <span className="rounded-full bg-[var(--weo-tone-neutral-bg)] px-3 py-1.5 font-semibold">
                                            Premium unlocks after first purchase
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    icon="sparkles"
                                    onClick={() => packagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                >
                                    Buy Credits
                                </Button>
                            </div>
                        </Surface>

                        <Surface variant="card" className="space-y-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                                    Usage key
                                </p>
                                <h2 className="mt-2 text-lg font-semibold text-[var(--weo-text-primary)]">
                                    What each action costs
                                </h2>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-[22px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-3">
                                    <p className="flex items-center gap-2 font-semibold text-[var(--weo-text-primary)]">
                                        <Icon name="file-text" size={16} className="text-[var(--weo-accent-from)]" />
                                        LLM writing step
                                    </p>
                                    <p className="text-sm text-[var(--weo-text-secondary)]">{creditsData?.priceBook.llmGeneration ?? 80} credits</p>
                                </div>
                                <div className="rounded-[22px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-3">
                                    <p className="flex items-center gap-2 font-semibold text-[var(--weo-text-primary)]">
                                        <Icon name="image" size={16} className="text-[var(--weo-accent-from)]" />
                                        Standard image
                                    </p>
                                    <p className="text-sm text-[var(--weo-text-secondary)]">{creditsData?.priceBook.standardImage ?? 40} credits</p>
                                </div>
                                <div className="rounded-[22px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-3">
                                    <p className="flex items-center gap-2 font-semibold text-[var(--weo-text-primary)]">
                                        <Icon name="crown" size={16} className="text-[var(--weo-accent-from)]" />
                                        Premium image
                                    </p>
                                    <p className="text-sm text-[var(--weo-text-secondary)]">{creditsData?.priceBook.premiumImage ?? 250} credits</p>
                                </div>
                            </div>
                        </Surface>
                    </div>

                    <div ref={packagesRef} className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
                        <div className="grid gap-4 lg:grid-cols-3">
                            {(creditsData?.packages ?? []).map((pkg) => {
                                const selected = selectedPackageId === pkg.id
                                const featured = pkg.id === 'publisher'
                                return (
                                    <Surface
                                        key={pkg.id}
                                        variant={featured ? 'elevated' : 'card'}
                                        interactive
                                        onClick={() => setSelectedPackageId(pkg.id)}
                                        className={`relative flex h-full flex-col justify-between gap-5 ${selected ? 'ring-1 ring-[var(--weo-accent-from)] -translate-y-0.5' : ''}`}
                                    >
                                        {featured && (
                                            <div className="absolute left-4 top-4 rounded-full bg-[var(--weo-accent-glow)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--weo-accent-from)]">
                                                Featured
                                            </div>
                                        )}
                                        {pkg.savingsLabel && (
                                            <div
                                                className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                                                style={{
                                                    background: featured ? 'var(--weo-tone-warning-bg)' : 'var(--weo-bg-muted)',
                                                    color: featured ? 'var(--weo-tone-warning-fg)' : 'var(--weo-text-secondary)',
                                                }}
                                            >
                                                {pkg.savingsLabel}
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                                                    {pkg.name}
                                                </p>
                                                <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--weo-text-primary)]">
                                                    {formatUsd(pkg.priceUsd)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-semibold text-[var(--weo-accent-from)]">
                                                    {formatCredits(pkg.credits)}
                                                </p>
                                                <p className="text-sm text-[var(--weo-text-secondary)]">
                                                    credits added instantly after successful checkout
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            variant={selected ? 'primary' : 'secondary'}
                                            icon={selected ? 'check' : 'sparkles'}
                                            onClick={() => setSelectedPackageId(pkg.id)}
                                        >
                                            {selected ? 'Selected' : `Choose ${pkg.name}`}
                                        </Button>
                                    </Surface>
                                )
                            })}
                        </div>

                        <Surface variant="card" className="space-y-5">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                                    Selected package
                                </p>
                                <h2 className="mt-2 text-xl font-semibold text-[var(--weo-text-primary)]">
                                    {selectedPackage ? `${selectedPackage.name} top-up` : 'Pick a package'}
                                </h2>
                            </div>

                            {selectedPackage ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-[22px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.12em] text-[var(--weo-text-muted)]">
                                                Price
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--weo-text-primary)]">
                                                {formatUsd(selectedPackage.priceUsd)}
                                            </p>
                                        </div>
                                        <div className="rounded-[22px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.12em] text-[var(--weo-text-muted)]">
                                                Credits
                                            </p>
                                            <p className="mt-2 font-semibold text-[var(--weo-text-primary)]">
                                                {formatCredits(selectedPackage.credits)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-[24px] border border-[var(--weo-stroke-soft)] bg-[linear-gradient(135deg,rgba(251,94,71,0.1),rgba(255,255,255,0.86))] px-4 py-4 text-sm text-[var(--weo-text-secondary)]">
                                        <p className="mb-2 flex items-center gap-2 font-semibold text-[var(--weo-text-primary)]">
                                            <Icon name="credit-card" size={16} className="text-[var(--weo-accent-from)]" />
                                            Checkout hook point
                                        </p>
                                        <p className="leading-6">
                                            This UI is ready for Polar checkout wiring. When the payment route lands, this selected package becomes the payload sent into checkout and upgrades the account to Paid on success.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-[var(--weo-text-secondary)]">
                                    Choose a package card to preview the checkout summary.
                                </p>
                            )}
                        </Surface>
                    </div>

                    <Surface className="space-y-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                                    Transaction history
                                </p>
                                <h2 className="mt-2 text-xl font-semibold text-[var(--weo-text-primary)]">
                                    Every credit movement in one ledger
                                </h2>
                            </div>
                            <p className="text-xs text-[var(--weo-text-muted)]">
                                Credits, refunds, and welcome bonus all land here.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {(creditsData?.transactions ?? []).length > 0 ? (
                                (creditsData?.transactions ?? []).map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="grid gap-4 rounded-[24px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-4 md:grid-cols-[1.1fr_auto_auto]"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${transaction.direction === 'credit'
                                                    ? 'bg-[var(--weo-tone-success-bg)] text-[var(--weo-tone-success-fg)]'
                                                    : 'bg-[var(--weo-tone-neutral-bg)] text-[var(--weo-text-secondary)]'
                                                    }`}>
                                                    <Icon name={transaction.direction === 'credit' ? 'coins' : 'wallet'} size={16} />
                                                </span>
                                                <p className="font-semibold text-[var(--weo-text-primary)]">
                                                    {transaction.label}
                                                </p>
                                                {transaction.providerTxId && (
                                                    <span className="rounded-full bg-[var(--weo-surface-inset)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--weo-text-muted)]">
                                                        purchase
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-[var(--weo-text-muted)]">
                                                {formatTransactionTime(transaction.createdAt)}
                                            </p>
                                        </div>

                                        <div className="text-left md:text-right">
                                            <p
                                                className={`font-semibold ${transaction.direction === 'credit'
                                                    ? 'text-[var(--weo-tone-success-fg)]'
                                                    : 'text-[var(--weo-text-primary)]'
                                                    }`}
                                            >
                                                {transaction.amount >= 0 ? '+' : ''}
                                                {formatCredits(transaction.amount)} credits
                                            </p>
                                            <p className="mt-1 text-xs text-[var(--weo-text-muted)]">
                                                Balance {formatCredits(transaction.balance)}
                                            </p>
                                        </div>

                                        <div className="flex items-center md:justify-end">
                                            <div className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                                                style={{
                                                    background: transaction.direction === 'credit'
                                                        ? 'var(--weo-tone-success-bg)'
                                                        : 'var(--weo-surface-inset)',
                                                    color: transaction.direction === 'credit'
                                                        ? 'var(--weo-tone-success-fg)'
                                                        : 'var(--weo-text-secondary)',
                                                }}
                                            >
                                                {transaction.direction}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-[24px] border border-[var(--weo-stroke-soft)] bg-white/76 px-4 py-6 text-sm text-[var(--weo-text-secondary)]">
                                    No transactions yet. Your welcome bonus and future top-ups will appear here.
                                </div>
                            )}
                        </div>
                    </Surface>
                </div>
            )}

            {activeTab === 'advanced' && (
                <div className="space-y-6">
                    <Surface className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="rounded-[18px] bg-[var(--weo-tone-warning-bg)] p-2">
                                <Icon name="key" size={18} className="text-[var(--weo-tone-warning-fg)]" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-[var(--weo-text-primary)]">Optional API Providers</h2>
                                <p className="text-sm leading-6 text-[var(--weo-text-secondary)]">
                                    Built-in credits are the default. Only use BYOK if you want to route requests through your own provider setup.
                                </p>
                            </div>
                        </div>
                    </Surface>

                    <Surface>
                        <h2 className="mb-4 text-xl font-semibold text-[var(--weo-text-primary)] tracking-tight">Choose Provider</h2>

                        <div className="grid grid-cols-1 gap-3 mb-5 md:grid-cols-2">
                            {PROVIDERS.map((provider) => (
                                <button
                                    key={provider.id}
                                    type="button"
                                    onClick={() => setSelectedProvider(provider.id)}
                                    className={`cursor-pointer rounded-[24px] border p-4 text-left transition-all ${selectedProvider === provider.id
                                        ? 'border-[var(--weo-accent-from)] bg-[var(--weo-accent-glow)] shadow-[var(--weo-shadow-sm)]'
                                        : 'border-[var(--weo-border-subtle)] bg-white/76 hover:border-[var(--weo-border-default)]'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-sm text-[var(--weo-text-primary)]">{provider.name}</span>
                                        {currentProvider === provider.id && hasKey && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--weo-tone-success-bg)] text-[var(--weo-tone-success-fg)]">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--weo-text-muted)] mb-2">{provider.description}</p>
                                    <div className="space-y-1">
                                        <p className="text-[11px] text-[var(--weo-text-secondary)]">
                                            LLM: <span className="font-medium">{provider.llm}</span>
                                        </p>
                                        <p className="text-[11px] text-[var(--weo-text-secondary)]">
                                            Image: <span className="font-medium">{provider.imageGen}</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-[var(--weo-tone-info-fg)]">
                                            {provider.pricing}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {activeProviderInfo.risk && (
                            <div className="mb-4 flex items-start gap-2 rounded-[20px] bg-[var(--weo-tone-warning-bg)] px-3 py-2.5 text-xs text-[var(--weo-tone-warning-fg)]">
                                <Icon name="alert" size={14} className="shrink-0 mt-0.5" />
                                {activeProviderInfo.risk}
                            </div>
                        )}

                        {hasKey && currentProvider === selectedProvider && (
                            <div className="mb-4 flex items-center gap-2 rounded-[20px] border border-[var(--weo-stroke-soft)] bg-white/76 px-3 py-2.5">
                                <Icon name="check" size={14} className="text-[var(--weo-tone-success-fg)] shrink-0" />
                                <span className="text-sm text-[var(--weo-text-secondary)] flex-1 font-mono">
                                    {showKey ? maskedKey : maskedKey.replace(/[^.]/g, '*')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="text-[var(--weo-text-muted)] hover:text-[var(--weo-text-secondary)] transition-colors cursor-pointer"
                                >
                                    <Icon name={showKey ? 'eye-off' : 'eye'} size={16} />
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <TextInput
                                id="api-key"
                                type="password"
                                placeholder={`${activeProviderInfo.keyPrefix}...`}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                hint={`Get your key from ${activeProviderInfo.setupUrl.replace('https://', '')}`}
                            />

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSaveKey}
                                    loading={saving}
                                    disabled={!apiKey.trim()}
                                >
                                    {hasKey && currentProvider === selectedProvider ? 'Update Key' : 'Save Key'}
                                </Button>

                                {hasKey && currentProvider === selectedProvider && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleValidateKey}
                                            loading={validating}
                                            icon="refresh"
                                        >
                                            Validate
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={handleDeleteKey}
                                            icon="trash"
                                        >
                                            Remove
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {message && (
                            <div className={`mt-4 flex items-start gap-2 rounded-[20px] px-3 py-2.5 text-sm ${message.type === 'success'
                                ? 'bg-[var(--weo-tone-success-bg)] text-[var(--weo-tone-success-fg)]'
                                : 'bg-[var(--weo-tone-danger-bg)] text-[var(--weo-tone-danger-fg)]'
                                }`}>
                                <Icon name={message.type === 'success' ? 'check' : 'alert'} size={16} className="shrink-0 mt-0.5" />
                                {message.text}
                            </div>
                        )}
                    </Surface>

                    <Surface>
                        <div className="mb-3 flex items-center gap-3">
                            <Icon name="shield" size={18} className="text-[var(--weo-text-muted)]" />
                            <h2 className="text-xl font-semibold text-[var(--weo-text-primary)]">Security</h2>
                        </div>
                        <ul className="space-y-2 text-sm text-[var(--weo-text-secondary)]">
                            <li className="flex items-start gap-2">
                                <Icon name="check" size={14} className="text-[var(--weo-tone-success-fg)] shrink-0 mt-0.5" />
                                Your key is encrypted with AES-256-GCM (PBKDF2 100K iterations)
                            </li>
                            <li className="flex items-start gap-2">
                                <Icon name="check" size={14} className="text-[var(--weo-tone-success-fg)] shrink-0 mt-0.5" />
                                Key is never displayed in plaintext or logged to console
                            </li>
                            <li className="flex items-start gap-2">
                                <Icon name="check" size={14} className="text-[var(--weo-tone-success-fg)] shrink-0 mt-0.5" />
                                Key is decrypted only at runtime when calling the AI API
                            </li>
                            <li className="flex items-start gap-2">
                                <Icon name="check" size={14} className="text-[var(--weo-tone-success-fg)] shrink-0 mt-0.5" />
                                Each user&apos;s key is fully isolated from other accounts
                            </li>
                        </ul>
                    </Surface>
                </div>
            )}
        </div>
    )
}
