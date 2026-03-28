'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoInput } from '@/components/ui/NeoInput'
import { NeoCard } from '@/components/ui/NeoCard'
import Link from 'next/link'
import { FREE_SIGNUP_CREDITS } from '@/lib/credit-catalog'
import { getClerkErrorMessage, hasClerkErrorCode } from '@/lib/clerk-errors'

export default function SignInPage() {
    const router = useRouter()
    const { signIn, fetchStatus } = useSignIn()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [loading, setLoading] = useState(false)
    const [needsEmailCode, setNeedsEmailCode] = useState(false)

    const completeSignIn = async () => {
        if (!signIn) return

        const fromPath = typeof window === 'undefined'
            ? '/'
            : new URLSearchParams(window.location.search).get('from') || '/'
        const { error: finalizeError } = await signIn.finalize({
            navigate: ({ session, decorateUrl }) => {
                if (session?.currentTask) {
                    router.replace('/auth/update-password')
                    return
                }

                const targetUrl = decorateUrl(fromPath)
                if (targetUrl.startsWith('http')) {
                    window.location.href = targetUrl
                    return
                }

                router.replace(targetUrl)
            },
        })

        if (finalizeError) {
            setError(getClerkErrorMessage(finalizeError, 'Unable to finish sign in'))
        }
    }

    const sendSecondFactorEmail = async () => {
        if (!signIn) return

        const emailFactorAvailable = signIn.supportedSecondFactors?.some(
            (factor) => factor.strategy === 'email_code',
        )

        if (!emailFactorAvailable) {
            setError('This account needs an extra sign-in step that this screen does not support yet.')
            return
        }

        const { error: sendError } = await signIn.mfa.sendEmailCode()
        if (sendError) {
            setError(getClerkErrorMessage(sendError, 'Unable to send verification code'))
            return
        }

        setNeedsEmailCode(true)
        setNotice('We sent a verification code to your email. Enter it below to finish signing in.')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password || !signIn) return

        setLoading(true)
        setError('')
        setNotice('')

        const { error: signInError } = await signIn.password({
            identifier: email,
            password,
        })

        if (signIn.status === 'complete') {
            await completeSignIn()
            setLoading(false)
            return
        }

        if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
            await sendSecondFactorEmail()
            setLoading(false)
            return
        }

        if (signInError) {
            if (hasClerkErrorCode(signInError, 'form_password_compromised')) {
                await sendSecondFactorEmail()
            } else {
                setError(getClerkErrorMessage(signInError, 'Invalid email or password'))
            }
        } else {
            setError('Unable to finish sign in')
        }

        setLoading(false)
    }

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!code || !signIn) return

        setLoading(true)
        setError('')

        const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code })
        if (verifyError) {
            setError(getClerkErrorMessage(verifyError, 'Invalid verification code'))
            setLoading(false)
            return
        }

        if (signIn.status === 'complete') {
            await completeSignIn()
        } else {
            setError('Unable to finish sign in')
        }

        setLoading(false)
    }

    const handleResetFlow = async () => {
        if (!signIn) return

        await signIn.reset()
        setNeedsEmailCode(false)
        setCode('')
        setError('')
        setNotice('')
    }

    return (
        <div className="min-h-screen px-4 py-8 md:px-6 bg-[var(--neo-bg-canvas)]">
            <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">

                {/* Value Proposition */}
                <div className="p-8 md:p-10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[var(--neo-radius-lg)] border-2 border-black bg-[var(--neo-accent-green)] text-black shadow-[var(--neo-shadow-button)]">
                        <Icon name="sparkles" size={32} />
                    </div>
                    <p className="mt-8 text-sm font-bold uppercase tracking-widest text-gray-500">
                        weoweo
                    </p>
                    <h1 className="mt-4 max-w-md text-5xl font-bold font-display uppercase leading-tight tracking-tight text-black">
                        Pick up your next comic chapter.
                    </h1>
                    <p className="mt-6 max-w-lg text-lg font-bold text-gray-600">
                        Sign back in to continue generation, review storyboards, and keep credits and billing in one clean workflow.
                    </p>

                    <div className="mt-10 grid gap-4 sm:grid-cols-2">
                        <NeoCard highlight="none" noHover className="p-5 border-2 border-black shadow-[var(--neo-shadow-button)]">
                            <span className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wider">
                                <Icon name="wallet" size={18} className="text-[var(--neo-accent-green)] stroke-[3]" />
                                Credits stay visible
                            </span>
                            <p className="mt-3 text-sm text-gray-600">
                                See balance and package options before you commit to a render.
                            </p>
                        </NeoCard>
                        <NeoCard highlight="none" noHover className="p-5 border-2 border-black shadow-[var(--neo-shadow-button)]">
                            <span className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wider">
                                <Icon name="shield" size={18} className="text-[var(--neo-accent-green)] stroke-[3]" />
                                Trust-first workflow
                            </span>
                            <p className="mt-3 text-sm text-gray-600">
                                Review characters, panels, and billing cues in one consistent workspace.
                            </p>
                        </NeoCard>
                    </div>
                </div>

                {/* Login Form */}
                <NeoCard className="p-8 md:p-10">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-bg-canvas)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
                            <Icon name="user" size={14} />
                            Sign in
                        </div>
                        <h2 className="mt-6 text-4xl font-bold font-display uppercase text-black tracking-tight">
                            Welcome back
                        </h2>
                        <p className="mt-3 text-sm font-bold text-gray-600">
                            New here? <Link href="/auth/signup" className="text-black underline hover:text-[var(--neo-accent-green)]">Create an account</Link> and get {FREE_SIGNUP_CREDITS} starter credits.
                        </p>
                    </div>

                    <form onSubmit={needsEmailCode ? handleVerifyCode : handleSubmit} className="space-y-5">
                        <NeoInput
                            id="email"
                            type="email"
                            label="Email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                            autoFocus
                            disabled={needsEmailCode || loading || fetchStatus === 'fetching'}
                        />

                        {!needsEmailCode ? (
                            <div className="space-y-2">
                                <NeoInput
                                    id="password"
                                    type="password"
                                    label="Password"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    disabled={loading || fetchStatus === 'fetching'}
                                />
                                <div className="flex justify-end mt-2">
                                    <Link
                                        href="/auth/reset-password"
                                        className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <NeoInput
                                id="code"
                                type="text"
                                label="Verification code"
                                placeholder="6-digit code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                autoComplete="one-time-code"
                                required
                                autoFocus
                                disabled={loading || fetchStatus === 'fetching'}
                            />
                        )}

                        {error && (
                            <div className="flex items-start gap-3 rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-accent-danger)] px-4 py-3 text-sm font-bold text-white shadow-[var(--neo-shadow-button)]">
                                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="flex items-start gap-3 rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-accent-green)] px-4 py-3 text-sm font-bold text-black shadow-[var(--neo-shadow-button)]">
                                <Icon name="badge-check" size={18} className="mt-0.5 shrink-0" />
                                {notice}
                            </div>
                        )}

                        <NeoButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            disabled={loading || fetchStatus === 'fetching'}
                            className="w-full mt-4"
                        >
                            {loading ? <div className="weo-spinner mr-2 border-white border-t-transparent" /> : null}
                            {needsEmailCode ? 'Verify And Continue' : 'Sign In'}
                        </NeoButton>

                        {needsEmailCode ? (
                            <NeoButton
                                type="button"
                                variant="secondary"
                                size="lg"
                                disabled={loading || fetchStatus === 'fetching'}
                                className="w-full"
                                onClick={() => void handleResetFlow()}
                            >
                                Use a different sign-in
                            </NeoButton>
                        ) : null}
                    </form>

                    <div className="mt-8 rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] px-4 py-4 text-center text-sm font-bold text-gray-600">
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/auth/signup"
                            className="text-black underline hover:text-[var(--neo-accent-green)] transition-colors"
                        >
                            Sign up here.
                        </Link>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
