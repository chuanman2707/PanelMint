'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'
import {
    ACTION_CREDIT_COSTS,
    estimateGenerationCredits,
    type ImageModelTier,
} from '@/lib/credit-catalog'

const CREATE_DRAFT_STORAGE_KEY = 'panelmint:create-draft:v1'

const ART_STYLES = [
    { value: 'manga', label: 'Manga' },
    { value: 'webtoon', label: 'Webtoon' },
    { value: 'chinese-comic', label: 'Manhua' },
    { value: 'realistic', label: 'Realistic' },
    { value: 'american-comic', label: 'Comic' },
]

interface GenerateFormProps {
    onGenerate: (text: string, artStyle: string, pageCount: number, imageModelTier: ImageModelTier) => void
    isLoading: boolean
    credits: number
    accountTier: string
    disabled?: boolean
}

export function GenerateForm({ onGenerate, isLoading, credits, accountTier, disabled = false }: GenerateFormProps) {
    const [text, setText] = useState('')
    const [artStyle, setArtStyle] = useState('manga')
    const [pageCount, setPageCount] = useState(15)
    const [imageModelTier, setImageModelTier] = useState<ImageModelTier>('standard')
    const hasHydratedDraft = useRef(false)

    useEffect(() => {
        try {
            const savedDraft = window.localStorage.getItem(CREATE_DRAFT_STORAGE_KEY)
            if (!savedDraft) return

            const parsed = JSON.parse(savedDraft) as {
                text?: string
                artStyle?: string
                pageCount?: number
                imageModelTier?: ImageModelTier
            }

            if (typeof parsed.text === 'string') {
                setText(parsed.text)
            }

            if (ART_STYLES.some((style) => style.value === parsed.artStyle)) {
                setArtStyle(parsed.artStyle as string)
            }

            if (typeof parsed.pageCount === 'number' && parsed.pageCount >= 5 && parsed.pageCount <= 30) {
                setPageCount(parsed.pageCount)
            }

            if (parsed.imageModelTier === 'standard' || parsed.imageModelTier === 'premium') {
                setImageModelTier(parsed.imageModelTier)
            }
        } catch {
            window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY)
        } finally {
            hasHydratedDraft.current = true
        }
    }, [])

    useEffect(() => {
        if (!hasHydratedDraft.current) return

        const isDefaultDraft = !text && artStyle === 'manga' && pageCount === 15 && imageModelTier === 'standard'

        if (isDefaultDraft) {
            window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY)
            return
        }

        window.localStorage.setItem(
            CREATE_DRAFT_STORAGE_KEY,
            JSON.stringify({
                text,
                artStyle,
                pageCount,
                imageModelTier,
            }),
        )
    }, [artStyle, imageModelTier, pageCount, text])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim() || isLoading || disabled) return
        onGenerate(text.trim(), artStyle, pageCount, imageModelTier)
    }

    const charCount = text.length
    const estimatedCredits = estimateGenerationCredits(pageCount, imageModelTier)
    const canAffordEstimate = credits >= estimatedCredits

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-8 pb-10">
            {/* Credits Overview Box */}
            <div className="rounded-[var(--neo-radius)] border-4 border-black bg-white p-5 shadow-[var(--neo-shadow-button)] relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-black">
                        Available Balance
                    </p>
                    <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-accent-green)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                        {accountTier === 'paid' ? 'Pro' : 'Free'}
                    </span>
                </div>
                <div className="flex items-end justify-between">
                    <p className="text-4xl font-bold font-mono text-black">
                        {credits.toLocaleString()}
                    </p>
                    {!canAffordEstimate && (
                        <Link href="/settings?tab=credits" className="text-xs font-bold uppercase tracking-widest text-[var(--neo-accent-danger)] hover:underline border-b-2 border-transparent hover:border-[var(--neo-accent-danger)] pb-0.5 transition-colors">
                            Top Up Required →
                        </Link>
                    )}
                </div>
            </div>

            {/* Input Area */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-bold uppercase tracking-widest text-black">
                        Story Manuscript
                    </label>
                    <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm font-mono">
                        {charCount} chars
                    </span>
                </div>
                <div className="relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste your story or novel text here... The engine will analyze scene by scene."
                        rows={12}
                        disabled={isLoading || disabled}
                        className="w-full resize-none rounded-[var(--neo-radius)] border-4 border-black bg-white p-5 font-mono text-sm leading-relaxed text-black shadow-inner outline-none transition-colors focus:border-[var(--neo-accent-green)] focus:ring-4 focus:ring-[var(--neo-accent-green)] disabled:opacity-50"
                    />
                    {!text.trim() && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
                            <Icon name="book" size={64} className="text-black" />
                        </div>
                    )}
                </div>
            </div>

            {/* Configuration */}
            <div className="space-y-6 rounded-[var(--neo-radius-lg)] border-4 border-black bg-white p-6 shadow-[var(--neo-shadow-card)]">

                {/* Art Style */}
                <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-black">
                        Art Style
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {ART_STYLES.map((style) => (
                            <button
                                key={style.value}
                                type="button"
                                onClick={() => setArtStyle(style.value)}
                                disabled={isLoading || disabled}
                                className={`rounded-[var(--neo-radius-full)] border-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${artStyle === style.value
                                        ? 'border-black bg-black text-white shadow-[var(--neo-shadow-button)] translate-x-1'
                                        : 'border-black bg-white text-black hover:bg-[var(--neo-accent-green)] hover:-translate-y-0.5'
                                    } disabled:opacity-50`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Page Count Slide */}
                <div className="space-y-4 pt-6 border-t-2 border-black border-dashed">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold uppercase tracking-widest text-black">
                            Export Length
                        </label>
                        <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-accent-rainbow)] px-4 py-1.5 text-sm font-bold font-mono shadow-sm">
                            {pageCount} panels
                        </span>
                    </div>
                    <input
                        type="range"
                        min={5}
                        max={30}
                        step={1}
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value))}
                        disabled={isLoading || disabled}
                        className="w-full h-4 rounded-full appearance-none border-2 border-black bg-white accent-black cursor-ew-resize hover:bg-[var(--neo-bg-canvas)] disabled:opacity-50 transition-colors"
                    />
                </div>

                {/* Render Quality */}
                <div className="space-y-4 pt-6 border-t-2 border-black border-dashed">
                    <label className="text-sm font-bold uppercase tracking-widest text-black">
                        Render Quality
                    </label>
                    <div className="grid gap-4">
                        <button
                            type="button"
                            onClick={() => setImageModelTier('standard')}
                            disabled={isLoading || disabled}
                            className={`flex items-center justify-between rounded-[var(--neo-radius)] border-2 p-4 text-left transition-all ${imageModelTier === 'standard'
                                    ? 'border-black bg-black text-white shadow-[var(--neo-shadow-button)] translate-x-1'
                                    : 'border-black bg-white hover:bg-[var(--neo-accent-green)]'
                                } disabled:opacity-50`}
                        >
                            <span className="font-bold uppercase tracking-wider text-sm">Standard</span>
                            <span className={`font-mono text-xs font-bold ${imageModelTier === 'standard' ? 'text-gray-300' : 'text-gray-700'}`}>{ACTION_CREDIT_COSTS.standard_image}/img</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (accountTier === 'paid') setImageModelTier('premium')
                            }}
                            disabled={isLoading || disabled || accountTier !== 'paid'}
                            className={`flex items-center justify-between rounded-[var(--neo-radius)] border-2 p-4 text-left transition-all relative overflow-hidden ${accountTier !== 'paid'
                                    ? 'cursor-not-allowed border-black bg-[var(--neo-bg-canvas)] opacity-80'
                                    : imageModelTier === 'premium'
                                        ? 'border-black bg-black text-[var(--neo-accent-rainbow)] shadow-[var(--neo-shadow-button)] translate-x-1'
                                        : 'border-black bg-white hover:bg-[var(--neo-accent-green)] text-black'
                                } disabled:opacity-50`}
                        >
                            {accountTier !== 'paid' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--neo-bg-canvas)]/50 backdrop-blur-sm pointer-events-none z-10">
                                    <span className="rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black flex items-center gap-2 shadow-sm">
                                        <Icon name="lock" size={14} /> Requires Pro
                                    </span>
                                </div>
                            )}
                            <span className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 relative z-0">
                                Premium <Icon name="crown" size={16} className={imageModelTier === 'premium' ? 'text-[var(--neo-accent-rainbow)]' : 'text-[#63c7f9]'} />
                            </span>
                            <span className={`font-mono text-xs font-bold relative z-0 ${imageModelTier === 'premium' ? 'text-gray-300' : 'text-gray-700'}`}>{ACTION_CREDIT_COSTS.premium_image}/img</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Run Action */}
            <div className="space-y-5 border-t-4 border-black pt-6">
                <div className="flex items-center justify-between bg-black text-white p-4 rounded-[var(--neo-radius-lg)] shadow-[var(--neo-shadow-button)]">
                    <span className="text-sm font-bold uppercase tracking-widest">Est. Cost</span>
                    <span className="text-2xl font-bold font-mono text-[var(--neo-accent-green)]">-{estimatedCredits} <span className="text-sm text-gray-400">cR</span></span>
                </div>

                {!canAffordEstimate && (
                    <div className="rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-accent-danger)] p-4 text-center text-sm font-bold uppercase tracking-widest text-white shadow-sm flex items-center justify-center gap-2">
                        <Icon name="alert" size={18} /> Insufficient credits
                    </div>
                )}

                <NeoButton
                    type="submit"
                    variant={!text.trim() || isLoading || disabled || !canAffordEstimate ? 'secondary' : 'primary'}
                    size="xl"
                    disabled={!text.trim() || isLoading || disabled || !canAffordEstimate}
                    className="w-full text-xl py-6"
                >
                    {isLoading ? (
                        <>
                            <div className="weo-spinner mr-3 border-white border-t-transparent" />
                            Executing...
                        </>
                    ) : (
                        <>
                            <Icon name="zap" size={24} className="mr-2" />
                            Initialize Engine
                        </>
                    )}
                </NeoButton>
            </div>
        </form>
    )
}
