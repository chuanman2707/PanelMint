'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
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

    const refresh = useCallback(async () => {
        if (!isLoaded) {
            setLoading(true)
            return
        }

        if (!isSignedIn || !clerkUser) {
            setUser(null)
            setLoading(false)
            return
        }

        setLoading(true)

        try {
            const res = await fetch('/api/auth/me', {
                cache: 'no-store',
            })

            if (res.ok) {
                const data = await res.json()
                setUser(data.user)
            } else {
                setUser(null)
            }
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [clerkUser, isLoaded, isSignedIn])

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
