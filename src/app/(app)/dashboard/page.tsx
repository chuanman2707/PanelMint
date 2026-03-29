'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardEmptyState, DashboardGrid, DashboardHero, DashboardLoadingGrid, DashboardToolbar, type EpisodeItem } from '@/components/dashboard/DashboardSections'

export default function DashboardPage() {
    const router = useRouter()
    const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [activeFilter, setActiveFilter] = useState('All')

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

    const filteredEpisodes = activeFilter === 'All'
        ? episodes
        : episodes.filter((episode) => episode.artStyle.toLowerCase().includes(activeFilter.toLowerCase()))

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    const completedCount = episodes.filter((episode) => episode.status === 'done').length
    const inProgressCount = episodes.filter((episode) => episode.status !== 'done' && episode.status !== 'error').length

    return (
        <div className="mx-auto max-w-[1240px] p-6 md:p-8">
            <DashboardHero
                onCreate={() => router.push('/create')}
                episodeCount={episodes.length}
                completedCount={completedCount}
                inProgressCount={inProgressCount}
            />

            <DashboardToolbar
                activeFilter={activeFilter}
                episodeCount={episodes.length}
                filteredCount={filteredEpisodes.length}
                onFilterChange={setActiveFilter}
            />

            {loading && <DashboardLoadingGrid />}

            {!loading && episodes.length === 0 && (
                <DashboardEmptyState onCreate={() => router.push('/create')} />
            )}

            {!loading && filteredEpisodes.length > 0 && (
                <DashboardGrid
                    episodes={filteredEpisodes}
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
