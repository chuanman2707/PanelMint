'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'
import { artStyleOptions, normalizeArtStyle, type ArtStyle } from '@/lib/art-styles'
import {
    ACTION_CREDIT_COSTS,
    estimateGenerationCredits,
    type ImageModelTier,
} from '@/lib/credit-catalog'
import {
    MAX_STORY_MANUSCRIPT_CHARS,
    getStoryboardPanelBudget,
} from '@/lib/prompt-budget'
import {
    GENERATE_MANUSCRIPT_LIMIT_BLOCK_TEXT,
    GENERATE_MANUSCRIPT_PASTE_OVERFLOW_NOTICE,
    GENERATE_MANUSCRIPT_SPLIT_TIP,
    getGenerateManuscriptHelperText,
    isGenerateManuscriptAtLimit,
    isGenerateManuscriptNearLimit,
    truncateGenerateManuscriptPaste,
} from '@/lib/generate-manuscript-guardrails'

const CREATE_DRAFT_STORAGE_KEY = 'panelmint:create-draft:v1'

interface GenerateFormProps {
    onGenerate: (text: string, artStyle: string, pageCount: number, imageModelTier: ImageModelTier) => void
    isLoading: boolean
    credits: number
    accountTier: string
    disabled?: boolean
}

export function GenerateForm({ onGenerate, isLoading, credits, accountTier, disabled = false }: GenerateFormProps) {
    const [text, setText] = useState('')
    const [artStyle, setArtStyle] = useState<ArtStyle>('manga')
    const [pageCount, setPageCount] = useState(15)
    const [imageModelTier, setImageModelTier] = useState<ImageModelTier>('standard')
    const [pasteOverflowText, setPasteOverflowText] = useState('')
    const [pasteOverflowStatus, setPasteOverflowStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
    const hasHydratedDraft = useRef(false)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

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
                setText(parsed.text.slice(0, MAX_STORY_MANUSCRIPT_CHARS))
            }

            const normalizedArtStyle = normalizeArtStyle(parsed.artStyle)
            if (normalizedArtStyle) {
                setArtStyle(normalizedArtStyle)
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
        if (!text.trim() || isLoading || disabled || text.length >= MAX_STORY_MANUSCRIPT_CHARS) return
        onGenerate(text.trim(), artStyle, pageCount, imageModelTier)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = e.clipboardData.getData('text')
        const selectionStart = e.currentTarget.selectionStart ?? text.length
        const selectionEnd = e.currentTarget.selectionEnd ?? text.length
        const truncatedPaste = truncateGenerateManuscriptPaste({
            currentText: text,
            pastedText,
            selectionStart,
            selectionEnd,
        })

        if (!truncatedPaste.didOverflow) {
            setPasteOverflowText('')
            setPasteOverflowStatus('idle')
            return
        }

        e.preventDefault()
        setText(truncatedPaste.nextText)
        setPasteOverflowText(truncatedPaste.overflowText)
        setPasteOverflowStatus('idle')

        requestAnimationFrame(() => {
            textareaRef.current?.setSelectionRange(
                truncatedPaste.caretPosition,
                truncatedPaste.caretPosition,
            )
        })
    }

    const handleUseOverflowForChapterTwo = async () => {
        if (!pasteOverflowText) return

        try {
            await navigator.clipboard.writeText(pasteOverflowText)
            setPasteOverflowStatus('copied')
        } catch {
            setPasteOverflowStatus('failed')
        }
    }

    const charCount = text.length
    const isNearCharLimit = isGenerateManuscriptNearLimit(charCount)
    const isAtCharLimit = isGenerateManuscriptAtLimit(charCount)
    const manuscriptHelperText = getGenerateManuscriptHelperText(charCount)
    const storyboardBudget = getStoryboardPanelBudget({
        manuscriptChars: charCount,
        pageCount,
    })
    const estimatedCredits = estimateGenerationCredits(pageCount, imageModelTier, charCount)
    const canAffordEstimate = credits >= estimatedCredits
    const isSubmitDisabled = !text.trim() || isLoading || disabled || !canAffordEstimate || isAtCharLimit

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
                    <span
                        className={`rounded-[var(--neo-radius-full)] border-2 border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm font-mono ${
                            isAtCharLimit
                                ? 'bg-[var(--neo-accent-danger)] text-white'
                                : isNearCharLimit
                                    ? 'bg-[var(--neo-accent-yellow)] text-black'
                                    : 'bg-white text-black'
                        }`}
                    >
                        {charCount} / {MAX_STORY_MANUSCRIPT_CHARS} chars
                    </span>
                </div>
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Paste your story or novel text here... The engine will analyze scene by scene."
                        rows={12}
                        maxLength={MAX_STORY_MANUSCRIPT_CHARS}
                        disabled={isLoading || disabled}
                        className="w-full resize-none rounded-[var(--neo-radius)] border-4 border-black bg-white p-5 font-mono text-sm leading-relaxed text-black shadow-inner outline-none transition-colors focus:border-[var(--neo-accent-green)] focus:ring-4 focus:ring-[var(--neo-accent-green)] disabled:opacity-50"
                    />
                    {!text.trim() && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
                            <Icon name="book" size={64} className="text-black" />
                        </div>
                    )}
                </div>
                <p className={`text-sm leading-6 ${isAtCharLimit ? 'font-semibold text-[var(--neo-accent-danger)]' : isNearCharLimit ? 'font-medium text-black' : 'text-black/70'}`}>
                    {manuscriptHelperText}
                </p>
                {pasteOverflowText && (
                    <div className="rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-accent-yellow)] p-4 shadow-sm">
                        <p className="text-sm font-semibold text-black">
                            {GENERATE_MANUSCRIPT_PASTE_OVERFLOW_NOTICE}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void handleUseOverflowForChapterTwo()}
                                className="rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-black transition-transform hover:-translate-y-0.5"
                            >
                                Dùng phần này làm Chapter 2
                            </button>
                            {pasteOverflowStatus === 'copied' && (
                                <span className="text-xs font-medium text-black/80">
                                    Đã copy phần vượt giới hạn. Khi tạo chapter tiếp theo, chỉ cần paste lại.
                                </span>
                            )}
                            {pasteOverflowStatus === 'failed' && (
                                <span className="text-xs font-medium text-black/80">
                                    Không thể copy tự động trên trình duyệt này. Hãy giữ lại phần bị cắt để dùng cho chapter tiếp theo.
                                </span>
                            )}
                        </div>
                    </div>
                )}
                <div className="rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/55">
                        Mẹo chia chapter
                    </p>
                    <p className="mt-2 text-sm leading-6 text-black/75">
                        {GENERATE_MANUSCRIPT_SPLIT_TIP}
                    </p>
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
                        {artStyleOptions.map((style) => (
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
                            {pageCount} pages
                        </span>
                    </div>
                    <p className="text-xs font-medium text-black/70">
                        Storyboard target: about {storyboardBudget.targetTotalPanels} panels total
                    </p>
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
                    variant={isSubmitDisabled ? 'secondary' : 'primary'}
                    size="xl"
                    disabled={isSubmitDisabled}
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
                {isAtCharLimit && (
                    <p className="text-center text-sm font-semibold text-[var(--neo-accent-danger)]">
                        {GENERATE_MANUSCRIPT_LIMIT_BLOCK_TEXT}
                    </p>
                )}
            </div>
        </form>
    )
}
