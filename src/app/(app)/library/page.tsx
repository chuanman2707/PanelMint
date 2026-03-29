'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DashboardEmptyState, DashboardGrid, DashboardLoadingGrid, type EpisodeItem } from '@/components/dashboard/DashboardSections'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

type StatusFilter = 'all' | 'done' | 'active' | 'error'

export default function LibraryPage() {
    const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [query, setQuery] = useState('')

    useEffect(() => {
        let active = true

        const loadEpisodes = async () => {
            try {
                const res = await fetch('/api/episodes')
                if (!res.ok || !active) return
                const data = await res.json()
                setEpisodes(data.episodes || [])
            } catch {
                if (active) setEpisodes([])
            } finally {
                if (active) setLoading(false)
            }
        }

        void loadEpisodes()

        return () => {
            active = false
        }
    }, [])

    const visibleEpisodes = useMemo(() => {
        return episodes.filter((episode) => {
            const matchesQuery = !query.trim()
                || episode.projectName.toLowerCase().includes(query.toLowerCase())
                || episode.artStyle.toLowerCase().includes(query.toLowerCase())

            if (!matchesQuery) return false
            if (statusFilter === 'done') return episode.status === 'done'
            if (statusFilter === 'error') return episode.status === 'error'
            if (statusFilter === 'active') return episode.status !== 'done' && episode.status !== 'error'
            return true
        })
    }, [episodes, query, statusFilter])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/episodes/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setEpisodes((prev) => prev.filter((episode) => episode.id !== id))
            }
        } catch {
            // no-op
        } finally {
            setDeletingId(null)
        }
    }

    const getEpisodeHref = (episode: EpisodeItem) => {
        if (episode.status === 'done') return `/read/${episode.id}`
        return `/create?resume=${episode.id}`
    }

    const statusVariant = (status: string) => {
        if (status === 'done') return 'success'
        if (status === 'error') return 'danger'
        return 'warning'
    }

    const statusLabel = (status: string) => {
        if (status === 'done') return 'Complete'
        if (status === 'error') return 'Error'
        return 'In Progress'
    }

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    return (
        <div className="mx-auto max-w-[1240px] space-y-8 p-6 md:p-8">
            <NeoCard className="bg-[var(--neo-bg-panel)]" noHover>
                <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                        <NeoTag tone="cyan">ARCHIVE // MY LIBRARY</NeoTag>
                        <h1 className="mt-6 font-display text-[clamp(2.4rem,5vw,4.2rem)] font-black uppercase leading-[0.9] tracking-[-0.06em] text-black">
                            Every chapter in one shelf.
                        </h1>
                        <p className="mt-4 max-w-2xl text-base leading-8 text-[color:rgba(9,9,11,0.76)]">
                            Search by title or style, jump back into unfinished runs, or open completed chapters in the reader and editor.
                        </p>
                    </div>
                    <Link href="/create">
                        <NeoButton size="lg">
                            <Icon name="sparkles" size={18} />
                            New chapter
                        </NeoButton>
                    </Link>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <label className="flex items-center gap-3 border-[var(--neo-border-width)] border-black bg-white px-4 py-3 shadow-[var(--neo-shadow-button)]">
                        <Icon name="search" size={18} />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search title, style, status"
                            className="w-full bg-transparent text-sm text-black outline-none placeholder:text-black/45"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'done', 'active', 'error'] as const).map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setStatusFilter(filter)}
                                className={`border-[var(--neo-border-width-sm)] px-4 py-2 font-display text-xs font-black uppercase tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-150 ${statusFilter === filter ? 'border-black bg-[var(--neo-accent-yellow)] shadow-[var(--neo-shadow-button)]' : 'border-black bg-white hover:-translate-y-0.5'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
            </NeoCard>

            {loading && <DashboardLoadingGrid />}

            {!loading && episodes.length === 0 && (
                <DashboardEmptyState onCreate={() => { window.location.href = '/create' }} />
            )}

            {!loading && visibleEpisodes.length > 0 && (
                <DashboardGrid
                    episodes={visibleEpisodes}
                    deletingId={deletingId}
                    getEpisodeHref={getEpisodeHref}
                    onDelete={handleDelete}
                    statusVariant={statusVariant}
                    statusLabel={statusLabel}
                    timeAgo={timeAgo}
                />
            )}
        </div>
    )
}
