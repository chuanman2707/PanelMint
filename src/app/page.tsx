'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardEmptyState, DashboardGrid, DashboardHero, DashboardLoadingGrid, DashboardToolbar, type EpisodeItem } from '@/components/dashboard/DashboardSections'

export default function DashboardPage() {
  const router = useRouter()
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('All')

  const loadEpisodes = async () => {
    try {
      const res = await fetch('/api/episodes')
      if (res.ok) {
        const data = await res.json()
        setEpisodes(data.episodes || [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    void loadEpisodes()
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setEpisodes(prev => prev.filter(ep => ep.id !== id))
      }
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  const getEpisodeHref = (ep: EpisodeItem) => {
    if (ep.status === 'done') return `/read/${ep.id}`
    if (ep.status === 'error') return `/create?resume=${ep.id}`
    return `/create?resume=${ep.id}`
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
    : episodes.filter(ep =>
      ep.artStyle.toLowerCase().includes(activeFilter.toLowerCase())
    )

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const handleCreate = () => {
    router.push('/create')
  }

  const completedCount = episodes.filter((ep) => ep.status === 'done').length
  const inProgressCount = episodes.filter((ep) => ep.status !== 'done' && ep.status !== 'error').length

  return (
    <div className="mx-auto max-w-[1240px] p-6 md:p-8">
      <DashboardHero
        onCreate={handleCreate}
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
        <DashboardEmptyState onCreate={handleCreate} />
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
