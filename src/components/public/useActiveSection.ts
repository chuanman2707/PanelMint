'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function useActiveSection(sectionIds: string[]) {
    const pathname = usePathname()
    const [activeSection, setActiveSection] = useState<string | null>(() => {
        if (typeof window === 'undefined') {
            return sectionIds[0] ?? null
        }

        return window.location.hash.replace('#', '') || sectionIds[0] || null
    })

    useEffect(() => {
        if (pathname !== '/') {
            return
        }

        const sections = sectionIds
            .map((id) => document.getElementById(id))
            .filter((section): section is HTMLElement => Boolean(section))

        if (!sections.length || typeof IntersectionObserver === 'undefined') {
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

                if (visibleEntries[0]?.target?.id) {
                    setActiveSection(visibleEntries[0].target.id)
                }
            },
            {
                rootMargin: '-18% 0px -55% 0px',
                threshold: [0.15, 0.3, 0.5, 0.7],
            },
        )

        sections.forEach((section) => observer.observe(section))

        return () => {
            observer.disconnect()
        }
    }, [pathname, sectionIds])

    return pathname === '/' ? activeSection || sectionIds[0] || null : null
}
