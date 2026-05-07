'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'
import { artStyleOptions, normalizeArtStyle, type ArtStyle } from '@/lib/art-styles'
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
    onGenerate: (text: string, artStyle: string, pageCount: number) => void
    isLoading: boolean
    disabled?: boolean
}

export function GenerateForm({ onGenerate, isLoading, disabled = false }: GenerateFormProps) {
    const [text, setText] = useState('')
    const [artStyle, setArtStyle] = useState<ArtStyle>('manga')
    const [pageCount, setPageCount] = useState(15)
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
        } catch {
            window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY)
        } finally {
            hasHydratedDraft.current = true
        }
    }, [])

    useEffect(() => {
        if (!hasHydratedDraft.current) return

        const isDefaultDraft = !text && artStyle === 'manga' && pageCount === 15

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
            }),
        )
    }, [artStyle, pageCount, text])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim() || isLoading || disabled || isGenerateManuscriptAtLimit(text.length)) return
        onGenerate(text.trim(), artStyle, pageCount)
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
    const isSubmitDisabled = !text.trim() || isLoading || disabled || isAtCharLimit

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-8 pb-10">
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
            </div>

            {/* Run Action */}
            <div className="space-y-5 border-t-4 border-black pt-6">
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
