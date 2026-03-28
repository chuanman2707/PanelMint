'use client'

import { useState } from 'react'
import { Icon } from './ui/icons'
import { NeoButton } from './ui/NeoButton'
import { NeoCard } from './ui/NeoCard'

interface CharacterData {
    id: string
    name: string
    aliases: string | null
    description: string | null
    imageUrl: string | null
    identityJson: string | null
}

interface LocationData {
    id: string
    name: string
    description: string | null
}

interface PageData {
    id: string
    pageIndex: number
    summary: string
    content: string
    location: string | null
}

interface ReviewAnalysisProps {
    characters: CharacterData[]
    locations: LocationData[]
    pages: PageData[]
    pageCount: number
    onApprove: (characters: CharacterData[], locations: LocationData[]) => void
    isLoading: boolean
}

const IDENTITY_FIELDS = [
    { key: 'ageRange', label: 'Age', icon: 'clock' },
    { key: 'gender', label: 'Gender', icon: 'user' },
    { key: 'bodyBuild', label: 'Build', icon: 'user' },
    { key: 'hairSignature', label: 'Hair', icon: 'eye' },
    { key: 'faceSignature', label: 'Face', icon: 'eye' },
    { key: 'outfitDefault', label: 'Outfit', icon: 'edit' },
]

export function ReviewAnalysis({
    characters: initialCharacters,
    locations: initialLocations,
    pages,
    pageCount,
    onApprove,
    isLoading,
}: ReviewAnalysisProps) {
    const [characters, setCharacters] = useState(initialCharacters)
    const [locations, setLocations] = useState(initialLocations)
    const [generatingSheet, setGeneratingSheet] = useState<string | null>(null)

    const updateCharacter = (index: number, field: keyof CharacterData, value: string) => {
        setCharacters((prev) => prev.map((c, i) =>
            i === index ? { ...c, [field]: value } : c
        ))
    }

    const handleGenerateSheet = async (characterId: string) => {
        setGeneratingSheet(characterId)
        try {
            const res = await fetch(`/api/characters/${characterId}/generate-sheet`, {
                method: 'POST',
            })
            if (res.ok) {
                const data = await res.json()
                setCharacters((prev) => prev.map((c) =>
                    c.id === characterId ? { ...c, imageUrl: data.imageUrl } : c
                ))
            }
        } catch (err) {
            console.error('Failed to generate sheet:', err)
        } finally {
            setGeneratingSheet(null)
        }
    }

    const updateLocation = (index: number, field: keyof LocationData, value: string) => {
        setLocations((prev) => prev.map((l, i) =>
            i === index ? { ...l, [field]: value } : l
        ))
    }

    return (
        <NeoCard className="p-6 md:p-10 space-y-10 border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] bg-white">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black shadow-sm mb-6">
                    <Icon name="book" size={14} className="text-[var(--neo-accent-green)]" />
                    Story Analysis
                </div>
                <h2 className="text-4xl font-bold font-display uppercase tracking-tight text-black mb-4">
                    Extracted Setup
                </h2>
                <p className="text-sm font-bold text-gray-600">
                    AI extracted characters and locations from your story. Review and dictate changes before building storyboards.
                </p>
            </div>

            {/* Characters */}
            <div className="space-y-4 pt-6 border-t-4 border-black border-dashed">
                <h3 className="flex items-center gap-3 text-2xl font-bold font-display uppercase text-black">
                    <Icon name="user" size={24} className="text-[var(--neo-accent-green)]" />
                    Cast ({characters.length})
                </h3>
                <div className="grid gap-6">
                    {characters.map((char, i) => (
                        <div key={char.id} className="rounded-[var(--neo-radius-lg)] border-4 border-black bg-[var(--neo-bg-canvas)] p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                            <div className="flex flex-col sm:flex-row gap-6">
                                {/* Image Column */}
                                <div className="shrink-0 flex flex-col gap-3">
                                    {char.imageUrl ? (
                                        <img
                                            src={char.imageUrl}
                                            alt={char.name}
                                            className="h-32 w-32 rounded-[var(--neo-radius)] object-cover border-4 border-black shrink-0 bg-white"
                                        />
                                    ) : (
                                        <div className="flex h-32 w-32 items-center justify-center rounded-[var(--neo-radius)] border-4 border-black bg-white">
                                            <Icon name="user" size={40} className="text-gray-300" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleGenerateSheet(char.id)}
                                        disabled={generatingSheet === char.id}
                                        className="w-full rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-accent-green)] py-2 text-[10px] font-bold uppercase tracking-widest text-black shadow-sm hover:translate-y-px transition-transform disabled:opacity-50"
                                    >
                                        {generatingSheet === char.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="weo-spinner w-3 h-3 border-black border-t-transparent" />
                                                Running
                                            </div>
                                        ) : char.imageUrl ? 'Regenerate' : 'Generate'}
                                    </button>
                                </div>
                                {/* Details Column */}
                                <div className="flex-1 min-w-0 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Character Name</label>
                                        <input
                                            value={char.name}
                                            onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                                            className="w-full rounded-[var(--neo-radius)] border-2 border-black bg-white px-4 py-2 font-display text-xl font-bold uppercase tracking-tight text-black outline-none focus:ring-4 focus:ring-[var(--neo-accent-green)] transition-all"
                                            placeholder="Character name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Appearance Prompt</label>
                                        <textarea
                                            value={char.description || ''}
                                            onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                                            rows={2}
                                            className="w-full resize-none rounded-[var(--neo-radius)] border-2 border-black bg-white px-4 py-3 font-mono text-sm leading-relaxed text-black outline-none focus:ring-4 focus:ring-[var(--neo-accent-green)] transition-all"
                                            placeholder="Detailed appearance description (used for image generation)"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Identity Fields */}
                            {char.identityJson && (() => {
                                try {
                                    const identity = JSON.parse(char.identityJson) as Record<string, string>
                                    const fields = IDENTITY_FIELDS
                                        .map(f => ({ ...f, value: identity[f.key] }))
                                        .filter(f => f.value)
                                    if (fields.length === 0) return null
                                    return (
                                        <div className="mt-5 pt-4 border-t-2 border-black border-dashed flex flex-wrap gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-black w-full mb-1 flex items-center gap-2">
                                                <Icon name="key" size={12} className="text-[var(--neo-accent-rainbow)]" /> Identity Anchors
                                            </span>
                                            {fields.map((f, idx) => (
                                                <div key={idx} className="rounded-[var(--neo-radius)] border-2 border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-sm">
                                                    <span className="text-gray-400 mr-1">{f.label}:</span> {f.value}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                } catch { return null }
                            })()}
                        </div>
                    ))}
                </div>
            </div>

            {/* Locations */}
            <div className="space-y-4 pt-8 border-t-4 border-black border-dashed">
                <h3 className="flex items-center gap-3 text-2xl font-bold font-display uppercase text-black">
                    <Icon name="search" size={24} className="text-[#63c7f9]" />
                    Sets & Locations ({locations.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {locations.map((loc, i) => (
                        <div key={loc.id} className="rounded-[var(--neo-radius-lg)] border-4 border-black bg-white p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex flex-col gap-3">
                            <input
                                value={loc.name}
                                onChange={(e) => updateLocation(i, 'name', e.target.value)}
                                className="w-full rounded-[var(--neo-radius)] border-2 border-transparent border-b-black bg-[var(--neo-bg-canvas)] px-3 py-2 font-display text-lg font-bold uppercase tracking-tight text-black outline-none focus:border-black focus:bg-white transition-colors"
                                placeholder="Location name"
                            />
                            <textarea
                                value={loc.description || ''}
                                onChange={(e) => updateLocation(i, 'description', e.target.value)}
                                rows={4}
                                className="w-full flex-1 resize-none rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] px-3 py-3 font-mono text-sm leading-relaxed text-black outline-none focus:bg-white focus:ring-4 focus:ring-[#63c7f9] transition-all"
                                placeholder="Location description"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Pages summary */}
            <div className="space-y-4 pt-8 border-t-4 border-black border-dashed">
                <h3 className="flex items-center gap-3 text-2xl font-bold font-display uppercase text-black">
                    <Icon name="file-text" size={24} className="text-[#ffd500]" />
                    Pacing ({pages.length} / {pageCount})
                </h3>
                <div className="grid gap-3">
                    {pages.map((page) => (
                        <div key={page.id} className="flex gap-4 rounded-[var(--neo-radius)] border-2 border-black bg-white p-4 items-start shadow-[var(--neo-shadow-button)]">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--neo-radius-full)] border-2 border-black bg-black text-sm font-bold text-white font-mono shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                {page.pageIndex + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-black leading-relaxed">{page.summary}</p>
                                {page.location && (
                                    <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#63c7f9]">
                                        <Icon name="search" size={12} /> {page.location}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Approve Button */}
            <div className="pt-8 border-t-4 border-black pb-4 text-center">
                <NeoButton
                    variant="primary"
                    size="xl"
                    onClick={() => onApprove(characters, locations)}
                    disabled={isLoading}
                    className="w-full max-w-lg mx-auto text-xl py-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                >
                    {isLoading ? (
                        <>
                            <div className="weo-spinner mr-3 border-white border-t-transparent w-6 h-6" />
                            PROCESSING...
                        </>
                    ) : (
                        <>
                            <Icon name="check" size={24} className="mr-2" />
                            APPROVE SETUP & STORYBOARD
                        </>
                    )}
                </NeoButton>
            </div>
        </NeoCard>
    )
}
