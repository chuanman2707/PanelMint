'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { FREE_SIGNUP_CREDITS } from '@/lib/credit-catalog'
import { getClerkErrorMessage, hasClerkErrorCode } from '@/lib/clerk-errors'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoInput } from '@/components/ui/NeoInput'

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
            ? '/dashboard'
            : new URLSearchParams(window.location.search).get('from') || '/dashboard'

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
        <div className="relative min-h-screen overflow-hidden bg-[var(--neo-bg-canvas)] px-4 py-8 md:px-6">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#09090B_0.5px,transparent_0.5px)] bg-[size:24px_24px] opacity-[0.05]" />
            <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-ink)] px-4 py-3 text-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-card)] md:px-6">
                <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[var(--neo-accent-lime)] md:text-sm">
                    COMIC_OS // TERMINAL
                </Link>
                <div className="flex items-center gap-4">
                    <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)]/70 md:block">
                        SYSTEM_STATUS: NOMINAL
                    </span>
                    <Link href="/auth/signup" className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--neo-accent-lime)] underline underline-offset-4">
                        Create Account
                    </Link>
                </div>
            </header>

            <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center gap-10 py-8 lg:grid-cols-[1fr_0.9fr]">
                <section className="space-y-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] shadow-[var(--neo-shadow-card)]">
                        <Icon name="sparkles" size={30} />
                    </div>
                    <div className="space-y-4">
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--neo-ink)]/55">
                            panelmint
                        </p>
                        <h1 className="max-w-md text-5xl font-black uppercase leading-[0.92] tracking-tighter md:text-7xl">
                            Pick up your next comic chapter.
                        </h1>
                        <p className="max-w-lg text-lg font-medium leading-8 text-[var(--neo-ink)]/80">
                            Sign back in to continue generation, review storyboards, and keep credits and billing in one clean workflow.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <NeoCard noHover>
                            <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em]">
                                <Icon name="wallet" size={18} className="text-[var(--neo-accent-lime)]" />
                                Credits stay visible
                            </span>
                            <p className="mt-3 text-sm leading-7 text-[var(--neo-ink)]/75">
                                See balance and package options before you commit to a render.
                            </p>
                        </NeoCard>
                        <NeoCard noHover>
                            <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em]">
                                <Icon name="shield" size={18} className="text-[var(--neo-accent-lime)]" />
                                Trust-first workflow
                            </span>
                            <p className="mt-3 text-sm leading-7 text-[var(--neo-ink)]/75">
                                Review characters, panels, and billing cues in one consistent workspace.
                            </p>
                        </NeoCard>
                    </div>
                </section>

                <NeoCard noHover className="p-0">
                    <div className="flex items-center justify-between border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-6 py-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--neo-ink)]/60">
                            Security Protocol v4.0.1
                        </span>
                        <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--neo-ink)]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--neo-ink)]" />
                        </div>
                    </div>
                    <div className="px-6 pt-10 pb-8 md:px-8">
                        <div className="text-center">
                            <h2 className="text-4xl font-black uppercase leading-none tracking-tighter text-[var(--neo-ink)] md:text-5xl">
                                Welcome back
                            </h2>
                            <div className="mt-4 flex justify-center">
                                <div className="h-1 w-12 bg-[var(--neo-accent-yellow)]" />
                            </div>
                            <p className="mt-5 text-sm font-medium text-[var(--neo-ink)]/70">
                                New here?{' '}
                                <Link href="/auth/signup" className="font-bold text-[var(--neo-ink)] underline decoration-[var(--neo-accent-yellow)] decoration-2 underline-offset-4">
                                    Create an account
                                </Link>{' '}
                                and get {FREE_SIGNUP_CREDITS} starter credits.
                            </p>
                        </div>

                        <form onSubmit={needsEmailCode ? handleVerifyCode : handleSubmit} className="mt-8 space-y-5">
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
                                    <div className="flex justify-end">
                                        <Link
                                            href="/auth/reset-password"
                                            className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--neo-ink)]/55 underline underline-offset-4 transition-colors hover:text-[var(--neo-ink)]"
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
                                <div className="flex items-start gap-3 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-pink)] px-4 py-3 text-sm font-bold text-[var(--neo-ink)] shadow-[var(--neo-shadow-button)]">
                                    <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {notice && (
                                <div className="flex items-start gap-3 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-lime)] px-4 py-3 text-sm font-bold text-[var(--neo-ink)] shadow-[var(--neo-shadow-button)]">
                                    <Icon name="badge-check" size={18} className="mt-0.5 shrink-0" />
                                    {notice}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <NeoButton
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    disabled={loading || fetchStatus === 'fetching'}
                                    className="w-full"
                                >
                                    {loading ? <div className="weo-spinner mr-2 border-black border-t-transparent" /> : null}
                                    {needsEmailCode ? 'Verify Email' : 'Sign In'}
                                </NeoButton>
                                {needsEmailCode ? (
                                    <NeoButton
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        disabled={loading || fetchStatus === 'fetching'}
                                        onClick={handleResetFlow}
                                    >
                                        Resend
                                    </NeoButton>
                                ) : null}
                            </div>
                        </form>

                        <div className="mt-8 border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-4 text-center text-sm font-medium text-[var(--neo-ink)]/70">
                            Need an account?{' '}
                            <Link href="/auth/signup" className="font-bold text-[var(--neo-ink)] underline decoration-[var(--neo-accent-yellow)] decoration-2 underline-offset-4">
                                Create one here.
                            </Link>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
