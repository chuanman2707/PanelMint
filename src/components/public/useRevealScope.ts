'use client'

import { RefObject, useEffect } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const REVEAL_SELECTOR = '[data-neo-reveal]'

function isNearViewport(element: HTMLElement) {
    const bounds = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight

    return bounds.top < viewportHeight * 0.9 && bounds.bottom > viewportHeight * 0.1
}

export function useRevealScope(scopeRef: RefObject<HTMLElement | null>) {
    const prefersReducedMotion = usePrefersReducedMotion()

    useEffect(() => {
        const scope = scopeRef.current

        if (!scope) {
            return
        }

        const targets = Array.from(scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))

        if (!targets.length) {
            scope.dataset.motionReady = 'false'
            return
        }

        if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
            targets.forEach((target) => {
                target.dataset.visible = 'true'
            })
            scope.dataset.motionReady = 'false'
            return
        }

        targets.forEach((target) => {
            target.dataset.visible = isNearViewport(target) ? 'true' : 'false'
        })
        scope.dataset.motionReady = 'true'

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return
                    }

                    const target = entry.target as HTMLElement
                    target.dataset.visible = 'true'
                    observer.unobserve(target)
                })
            },
            {
                rootMargin: '0px 0px -12% 0px',
                threshold: 0.18,
            },
        )

        targets.forEach((target) => {
            if (target.dataset.visible !== 'true') {
                observer.observe(target)
            }
        })

        return () => {
            observer.disconnect()
            delete scope.dataset.motionReady
        }
    }, [prefersReducedMotion, scopeRef])

    return prefersReducedMotion
}
