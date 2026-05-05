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

    useEffect(() => {
        userRef.current = user
    }, [user])

    const refresh = useCallback(async () => {
        const shouldBlockUi = !userRef.current
        if (shouldBlockUi) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/local-user', { cache: 'no-store' })
            if (!res.ok) {
                if (shouldBlockUi) setUser(null)
                return
            }

            const data = await res.json() as { user?: LocalUser | null }
            setUser(data.user ?? null)
        } catch {
            if (shouldBlockUi) setUser(null)
        } finally {
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
