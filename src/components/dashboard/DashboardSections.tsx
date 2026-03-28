'use client'

import Link from 'next/link'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function neoCn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface EpisodeItem {
    id: string
    name: string
    status: string
    progress: number
    projectName: string
    artStyle: string
    panelCount: number
    createdAt: string
    error: string | null
}

export const FILTER_PILLS = ['All', 'Manga', 'Webtoon', 'Manhwa', 'Featured']

interface DashboardHeroProps {
    onCreate: () => void
    episodeCount: number
    completedCount: number
    inProgressCount: number
}

export function DashboardHero({
    onCreate,
    episodeCount,
    completedCount,
    inProgressCount,
}: DashboardHeroProps) {
    return (
        <NeoCard className="mb-10" highlight="rainbow">
            <div className="grid gap-10 xl:grid-cols-[1.5fr_1fr] xl:items-center">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black shadow-[var(--neo-shadow-button)]">
                        <Icon name="badge-check" size={16} className="text-[var(--neo-accent-green)]" />
                        Creator workspace
                    </span>
                    <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight font-display tracking-tight text-black md:text-5xl uppercase">
                        Comics without the hassle.
                    </h1>
                    <p className="mt-4 max-w-xl text-lg font-bold text-gray-600">
                        Draft faster, review storyboards with confidence, and keep render costs visible before you spend credits.
                    </p>
                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                        <NeoButton variant="primary" size="xl" onClick={onCreate}>
                            <Icon name="sparkles" size={20} />
                            Start a New Chapter
                        </NeoButton>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 rounded-[var(--neo-radius-lg)] border-2 border-black bg-[var(--neo-bg-canvas)] p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Library</p>
                        <p className="mt-2 text-5xl font-bold tracking-tight text-black font-mono">{episodeCount}</p>
                        <p className="mt-2 text-sm font-bold text-gray-600">Total chapters created</p>
                    </div>
                    <div className="rounded-[var(--neo-radius-lg)] border-2 border-black bg-white p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Ready</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-black font-mono">{completedCount}</p>
                    </div>
                    <div className="rounded-[var(--neo-radius-lg)] border-2 border-black bg-[var(--neo-accent-green)] p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-black">In Progress</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-black font-mono">{inProgressCount}</p>
                    </div>
                </div>
            </div>
        </NeoCard>
    )
}

interface DashboardToolbarProps {
    activeFilter: string
    episodeCount: number
    filteredCount: number
    onFilterChange: (pill: string) => void
}

export function DashboardToolbar({
    activeFilter,
    episodeCount,
    filteredCount,
    onFilterChange,
}: DashboardToolbarProps) {
    return (
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Browse chapters
                </p>
                <p className="mt-2 text-sm font-bold text-black">
                    Showing {filteredCount} of {episodeCount}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {FILTER_PILLS.map(pill => (
                    <button
                        key={pill}
                        onClick={() => onFilterChange(pill)}
                        className={neoCn(
                            "rounded-[var(--neo-radius-full)] border-2 border-black px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-transform hover:-translate-y-1",
                            activeFilter === pill
                                ? "bg-black text-white shadow-[var(--neo-shadow-button)]"
                                : "bg-white text-black hover:shadow-sm"
                        )}
                    >
                        {pill}
                    </button>
                ))}
            </div>
        </div>
    )
}

export function DashboardLoadingGrid() {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="rounded-[var(--neo-radius-lg)] border-2 border-black bg-white shadow-[var(--neo-shadow-card)] animate-pulse overflow-hidden flex flex-col h-[360px]">
                    <div className="h-48 border-b-2 border-black bg-[var(--neo-bg-canvas)]" />
                    <div className="flex-1 p-5 space-y-4">
                        <div className="h-6 w-3/4 rounded bg-gray-200 border-2 border-transparent" />
                        <div className="h-4 w-1/2 rounded bg-gray-200 border-2 border-transparent" />
                        <div className="mt-auto flex gap-3 pt-4 border-t-2 border-black border-dashed">
                            <div className="h-11 flex-1 rounded-[var(--neo-radius-full)] bg-gray-200" />
                            <div className="h-11 flex-1 rounded-[var(--neo-radius-full)] bg-gray-200" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

interface DashboardEmptyStateProps {
    onCreate: () => void
}

export function DashboardEmptyState({ onCreate }: DashboardEmptyStateProps) {
    return (
        <NeoCard className="text-center py-20 px-6">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[var(--neo-radius-lg)] border-2 border-black bg-[var(--neo-accent-green)] shadow-[var(--neo-shadow-button)]">
                <Icon name="book" size={40} className="text-black" />
            </div>
            <h3 className="text-3xl font-bold uppercase font-display tracking-tight text-black mb-4">
                Your workspace is empty
            </h3>
            <p className="mx-auto max-w-md text-base font-bold text-gray-600 mb-8">
                Start with one chapter, review the AI analysis, and see how simple comic generation can be.
            </p>
            <NeoButton variant="primary" size="lg" onClick={onCreate}>
                <Icon name="sparkles" size={20} />
                Create First Chapter
            </NeoButton>
        </NeoCard>
    )
}

interface DashboardGridProps {
    episodes: EpisodeItem[]
    deletingId: string | null
    getEpisodeHref: (ep: EpisodeItem) => string
    onDelete: (id: string, name: string) => void
    statusVariant: (status: string) => 'success' | 'danger' | 'warning'
    statusLabel: (status: string) => string
    timeAgo: (dateStr: string) => string
}

export function DashboardGrid({
    episodes,
    deletingId,
    getEpisodeHref,
    onDelete,
    statusVariant,
    statusLabel,
    timeAgo,
}: DashboardGridProps) {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {episodes.map(ep => (
                <div key={ep.id} className="rounded-[var(--neo-radius-lg)] border-2 border-black bg-white shadow-[var(--neo-shadow-card)] transition-transform hover:-translate-y-1 flex flex-col h-full overflow-hidden relative">
                    {/* Header Image Area */}
                    <div className="relative h-48 border-b-2 border-black bg-[var(--neo-bg-canvas)] flex items-center justify-center">
                        <div className="absolute top-4 left-4 rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-sm">
                            {ep.artStyle}
                        </div>
                        <div className="absolute top-4 right-4">
                            <span className={neoCn(
                                "rounded-[var(--neo-radius-full)] border-2 border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm",
                                ep.status === 'done' ? "bg-[var(--neo-accent-green)] text-black" :
                                    ep.status === 'error' ? "bg-[var(--neo-accent-danger)] text-white" :
                                        "bg-white text-black"
                            )}>
                                {statusLabel(ep.status)}
                            </span>
                        </div>
                        <Icon name="image" size={48} className="text-gray-300 opacity-50" />

                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(ep.id, ep.projectName) }}
                            disabled={deletingId === ep.id}
                            className="absolute right-4 bottom-4 z-10 flex h-10 w-10 items-center justify-center rounded-[var(--neo-radius-full)] border-2 border-transparent bg-white text-[var(--neo-accent-danger)] opacity-0 shadow-[var(--neo-shadow-button)] transition-all hover:border-black hover:bg-[var(--neo-accent-danger)] hover:text-white group-hover:opacity-100 peer-hover:opacity-100 focus:opacity-100"
                            title="Delete comic"
                        >
                            {deletingId === ep.id
                                ? <div className="weo-spinner w-4 h-4" />
                                : <Icon name="trash" size={16} />
                            }
                        </button>
                    </div>
                    {/* Content */}
                    <div className="p-6 flex flex-col flex-1">
                        <Link href={getEpisodeHref(ep)} className="block mb-3">
                            <h3 className="line-clamp-2 text-2xl font-bold uppercase text-black font-display tracking-tight hover:underline">
                                {ep.projectName}
                            </h3>
                        </Link>
                        <p className="line-clamp-2 text-sm font-bold text-gray-500 mb-6 flex-1">
                            {ep.error ? ep.error : ep.status === 'done' ? 'Ready for reading.' : 'In pipeline.'}
                        </p>

                        {/* Progress Bar (Neo style) */}
                        {ep.status !== 'done' && (
                            <div className="mb-6 h-4 w-full rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-bg-canvas)] overflow-hidden">
                                <div
                                    className="h-full bg-[var(--neo-accent-green)] border-r-2 border-black transition-all duration-300"
                                    style={{ width: `${Math.max(5, ep.progress)}%` }}
                                />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-5 border-t-2 border-black border-dashed">
                            {ep.status === 'done' ? (
                                <>
                                    <Link href={`/read/${ep.id}`} className="flex-1">
                                        <NeoButton variant="primary" className="w-full">
                                            <Icon name="eye" size={16} /> Read
                                        </NeoButton>
                                    </Link>
                                    <Link href={`/editor/${ep.id}`} className="flex-1">
                                        <NeoButton variant="secondary" className="w-full">
                                            <Icon name="edit" size={16} /> Edit
                                        </NeoButton>
                                    </Link>
                                </>
                            ) : (
                                <Link href={getEpisodeHref(ep)} className="w-full flex-1">
                                    <NeoButton variant={ep.status === 'error' ? 'danger' : 'primary'} className="w-full">
                                        {ep.status === 'error' ? 'Retry' : 'Continue'} <Icon name="arrow-right" size={16} />
                                    </NeoButton>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
