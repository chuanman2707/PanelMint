import { Icon } from './ui/icons'
import { NeoCard } from './ui/NeoCard'
import { Marquee } from './ui/Marquee'

interface ProgressBarProps {
    phase: string
    progress: number
    totalPanels: number
    completedPanels: number
}

const PHASE_CONFIG: Record<string, { label: string; icon: string; bg: string }> = {
    analyzing: { label: 'ANALYZING STORY', icon: 'book', bg: 'bg-[var(--neo-accent-green)]' },
    scripting: { label: 'CREATING SCRIPT', icon: 'file-text', bg: 'bg-[var(--neo-accent-green)]' },
    storyboarding: { label: 'STORYBOARDING', icon: 'layout-grid', bg: 'bg-[var(--neo-accent-green)]' },
    imaging: { label: 'GENERATING IMAGES', icon: 'image', bg: 'bg-[#63c7f9]' }, // Cyan for processing
    composing: { label: 'ADDING DIALOGUE', icon: 'edit', bg: 'bg-[var(--neo-accent-pink)]' }, // Pink for finalize
    done: { label: 'COMPLETE', icon: 'check', bg: 'bg-white' },
    error: { label: 'CRITICAL ERROR', icon: 'alert', bg: 'bg-[var(--neo-accent-danger)]' },
}

export function ProgressBar({ phase, progress, totalPanels, completedPanels }: ProgressBarProps) {
    const config = PHASE_CONFIG[phase] || { label: phase.toUpperCase(), icon: 'loader', bg: 'bg-white' }

    return (
        <NeoCard className="overflow-hidden border-4 border-black p-0 shadow-[8px_8px_0_0_rgba(0,0,0,1)] bg-white transform-gpu rotate-[-1deg] hover:rotate-0 transition-transform duration-300">
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b-4 border-black bg-white px-4 py-3">
                <div className="flex space-x-2">
                    <div className="h-4 w-4 rounded-full border-2 border-black bg-[var(--neo-accent-danger)] shadow-sm" />
                    <div className="h-4 w-4 rounded-full border-2 border-black bg-[#ffd500] shadow-sm" />
                    <div className="h-4 w-4 rounded-full border-2 border-black bg-[var(--neo-accent-green)] shadow-sm" />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-black font-mono flex items-center gap-2">
                    <Icon name="terminal" size={14} /> Progress_Terminal.exe
                </div>
                <div className="w-8" />
            </div>

            {/* Marquee Banner */}
            <div className={`border-b-4 border-black py-2.5 overflow-hidden ${config.bg}`}>
                <Marquee
                    items={[config.label, config.label, config.label, config.label]}
                    speed={40}
                    className="text-2xl font-bold font-display uppercase tracking-widest text-black py-1"
                />
            </div>

            {/* Terminal Body */}
            <div className="bg-black p-8 font-mono text-base md:text-lg text-[var(--neo-accent-green)] shadow-inner relative overflow-hidden">
                {/* Scanline effect */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] z-10 opacity-20"></div>

                <div className="mb-8 flex items-center gap-4">
                    <Icon name={config.icon} size={32} className={phase !== 'done' && phase !== 'error' ? 'animate-pulse' : ''} />
                    <span className="font-bold tracking-widest">[{progress}%] EXECUTING_PHASE: {phase.toUpperCase()}...</span>
                </div>

                <div className="space-y-4 opacity-90 border-l-2 border-[var(--neo-accent-green)] pl-4 ml-2">
                    <p className="flex justify-between border-b border-dashed border-[var(--neo-accent-green)]/30 pb-2">
                        <span>&gt; COMPLETED_PANELS</span>
                        <span>{completedPanels}</span>
                    </p>
                    <p className="flex justify-between border-b border-dashed border-[var(--neo-accent-green)]/30 pb-2">
                        <span>&gt; TOTAL_TARGET</span>
                        <span>{totalPanels || 'CALCULATING'}</span>
                    </p>
                    <p className="flex justify-between pb-2">
                        <span>&gt; ENGINE_STATUS</span>
                        <span className={phase !== 'done' && phase !== 'error' ? 'animate-pulse' : ''}>
                            {phase === 'done' ? 'OFFLINE' : phase === 'error' ? 'HALTED' : 'ONLINE & RENDERING'}
                        </span>
                    </p>
                </div>

                <div className="mt-8 text-xs opacity-50">
                    <p>WEO-OH CORE V2.0.4. Do not close browser window during generation.</p>
                </div>
            </div>
        </NeoCard>
    )
}
