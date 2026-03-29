'use client'

import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface UseTypewriterTextOptions {
    speed?: number
    startDelay?: number
}

export function useTypewriterText(lines: string[], options: UseTypewriterTextOptions = {}) {
    const { speed = 22, startDelay = 260 } = options
    const prefersReducedMotion = usePrefersReducedMotion()
    const joinedText = lines.join('\n')
    const [typedLength, setTypedLength] = useState(0)
    const [showCursor, setShowCursor] = useState(true)

    useEffect(() => {
        if (prefersReducedMotion) {
            return
        }

        let timeoutId: number | undefined
        let resetFrame = 0
        let index = 0

        const typeNextCharacter = () => {
            index += 1
            setTypedLength(index)

            if (index < joinedText.length) {
                timeoutId = window.setTimeout(typeNextCharacter, speed)
            }
        }

        resetFrame = window.requestAnimationFrame(() => {
            setTypedLength(0)
            timeoutId = window.setTimeout(typeNextCharacter, startDelay)
        })

        return () => {
            window.cancelAnimationFrame(resetFrame)
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [joinedText, prefersReducedMotion, speed, startDelay])

    useEffect(() => {
        if (prefersReducedMotion) {
            return
        }

        const intervalId = window.setInterval(() => {
            setShowCursor((value) => !value)
        }, 460)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [prefersReducedMotion])

    return {
        typedText: prefersReducedMotion ? joinedText : joinedText.slice(0, typedLength),
        showCursor: prefersReducedMotion ? false : showCursor,
    }
}
