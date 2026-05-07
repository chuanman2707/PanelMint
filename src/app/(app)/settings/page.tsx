'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalUser } from '@/hooks/useLocalUser'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoInput } from '@/components/ui/NeoInput'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

type Provider = 'wavespeed'

const PROVIDERS = [
    {
        id: 'wavespeed' as const,
        name: 'WaveSpeed AI',
        description: 'Local provider key for text generation and multi-reference image generation.',
        llm: 'Seed 1.6 Flash',
        imageGen: 'FLUX Kontext Pro Multi',
        setupUrl: 'https://wavespeed.ai/accesskey',
        keyPrefix: 'ws_',
    },
]

export default function SettingsPage() {
    const { user } = useLocalUser()
    const mountedRef = useRef(true)
    const [selectedProvider] = useState<Provider>('wavespeed')
    const [apiKey, setApiKey] = useState('')
    const [maskedKey, setMaskedKey] = useState('')
    const [hasKey, setHasKey] = useState(false)
    const [currentProvider, setCurrentProvider] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const [validating, setValidating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const loadApiKey = useCallback(async () => {
        const res = await fetch('/api/user/api-key')
        const data = await res.json()

        if (!mountedRef.current) return

        setHasKey(!!data.hasKey)
        setMaskedKey(data.maskedKey || '')
        setCurrentProvider(data.provider ?? 'wavespeed')
    }, [])

    useEffect(() => {
        setLoading(true)
        void loadApiKey()
            .catch(() => {
                if (mountedRef.current) {
                    setHasKey(false)
                    setMaskedKey('')
                    setCurrentProvider(null)
                }
            })
            .finally(() => {
                if (mountedRef.current) {
                    setLoading(false)
                }
            })
    }, [loadApiKey])

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

    return (
        <div className="mx-auto max-w-7xl p-6 md:p-10">
            <header className="mb-10">
                <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-black uppercase leading-none tracking-[-0.06em]">
                    Settings <span className="text-[var(--neo-accent-cyan)]">_Terminal</span>
                </h1>
                <p className="mt-4 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-black/55">
                    Configure the local WaveSpeed provider key used by this workspace.
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
                                {user?.name || 'Operator_Zero'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-black/55">Contact uplink</p>
                            <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-3 font-mono text-sm">
                                {user?.email || 'operator@panelmint.io'}
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
                            <NeoTag tone="cyan">{activeProviderInfo.name}</NeoTag>
                            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight">Provider API Key</h2>
                            <p className="mt-3 max-w-2xl text-sm text-black/70">
                                {activeProviderInfo.description} Leave the field empty unless you want to replace the stored key.
                            </p>
                        </div>
                        <NeoTag tone={hasKey ? 'lime' : 'default'}>{loading ? 'Checking' : hasKey ? 'Key stored' : 'No key stored'}</NeoTag>
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
                                {saving ? 'Saving...' : 'Save Key'}
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

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Stored key</p>
                            <p className="mt-3 break-all font-mono text-sm">{hasKey ? maskedKey : 'No local key stored'}</p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-white px-4 py-4">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/55">Provider</p>
                            <p className="mt-3 font-display text-lg font-bold uppercase tracking-tight">
                                {currentProvider || activeProviderInfo.name}
                            </p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-cyan)] px-4 py-4 md:col-span-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">WaveSpeed account</p>
                            <p className="mt-3 text-sm text-black/80">
                                Generation requests use the WaveSpeed account behind this key.
                            </p>
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
        </div>
    )
}
