'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react'

interface LocalUser {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}

interface LocalUserContextType {
    user: LocalUser | null
    loading: boolean
    refresh: () => Promise<void>
}

const LocalUserContext = createContext<LocalUserContextType | null>(null)

export function LocalUserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<LocalUser | null>(null)
    const [loading, setLoading] = useState(true)
    const userRef = useRef<LocalUser | null>(null)
    const refreshSeqRef = useRef(0)

    useEffect(() => {
        userRef.current = user
    }, [user])

    const refresh = useCallback(async () => {
        const refreshSeq = refreshSeqRef.current + 1
        refreshSeqRef.current = refreshSeq
        const shouldBlockUi = !userRef.current
        if (shouldBlockUi) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/local-user', { cache: 'no-store' })
            if (!res.ok) {
                if (refreshSeqRef.current === refreshSeq && shouldBlockUi) setUser(null)
                return
            }

            const data = await res.json() as { user?: LocalUser | null }
            if (refreshSeqRef.current !== refreshSeq) return
            setUser(data.user ?? null)
        } catch {
            if (refreshSeqRef.current === refreshSeq && shouldBlockUi) setUser(null)
        } finally {
            if (refreshSeqRef.current !== refreshSeq) return
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return (
        <LocalUserContext.Provider value={{ user, loading, refresh }}>
            {children}
        </LocalUserContext.Provider>
    )
}

export function useLocalUser() {
    const ctx = useContext(LocalUserContext)
    if (!ctx) throw new Error('useLocalUser must be used within LocalUserProvider')
    return ctx
}
