import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function Marquee({
    items,
    speed = 30,
    className
}: {
    items: string[]
    speed?: number
    className?: string
}) {
    return (
        <div className={cn("overflow-hidden whitespace-nowrap bg-[var(--neo-bg-canvas)] text-[var(--neo-ink)] font-mono py-3 font-bold uppercase tracking-widest border-y-[var(--neo-border-width)] border-black", className)}>
            <div
                className="inline-block"
                style={{
                    animationDuration: `${speed}s`,
                    animationName: 'neo-marquee',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite'
                }}
            >
                {items.map((item, i) => (
                    <span key={i} className="mx-6 text-sm md:text-base">{item}</span>
                ))}
                {/* Duplicate for seamless looping */}
                {items.map((item, i) => (
                    <span key={`dup-${i}`} className="mx-6 text-sm md:text-base">{item}</span>
                ))}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes neo-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}} />
        </div>
    )
}
