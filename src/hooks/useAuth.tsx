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
import { useClerk, useUser } from '@clerk/nextjs'

interface AuthUser {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}

interface AuthContextType {
    user: AuthUser | null
    loading: boolean
    signout: () => Promise<void>
    refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn, user: clerkUser } = useUser()
    const { signOut } = useClerk()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const userRef = useRef<AuthUser | null>(null)
    const clerkUserId = clerkUser?.id ?? null

    useEffect(() => {
        userRef.current = user
    }, [user])

    const refresh = useCallback(async () => {
        if (!isLoaded) {
            if (!userRef.current) {
                setLoading(true)
            }
            return
        }

        if (!isSignedIn || !clerkUserId) {
            setUser(null)
            setLoading(false)
            return
        }

        const shouldBlockUi = !userRef.current
        if (shouldBlockUi) {
            setLoading(true)
        }

        try {
            const res = await fetch('/api/auth/me', {
                cache: 'no-store',
            })

            if (res.ok) {
                const data = await res.json()
                setUser(data.user)
            } else if (shouldBlockUi) {
                setUser(null)
            }
        } catch {
            if (shouldBlockUi) {
                setUser(null)
            }
        } finally {
            setLoading(false)
        }
    }, [clerkUserId, isLoaded, isSignedIn])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const signout = useCallback(async () => {
        setUser(null)
        setLoading(true)
        await signOut({ redirectUrl: '/auth/signin' })
    }, [signOut])

    const value: AuthContextType = {
        user,
        loading,
        signout,
        refresh,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
