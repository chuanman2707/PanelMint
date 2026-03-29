'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignUp } from '@clerk/nextjs'
import { MIN_PASSWORD_LENGTH } from '@/lib/security-policy'
import { FREE_SIGNUP_CREDITS } from '@/lib/credit-catalog'
import { getClerkErrorMessage } from '@/lib/clerk-errors'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoInput } from '@/components/ui/NeoInput'

export default function SignUpPage() {
    const router = useRouter()
    const { signUp, fetchStatus } = useSignUp()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [loading, setLoading] = useState(false)
    const [needsVerification, setNeedsVerification] = useState(false)

    const buildIncompleteSignUpMessage = () => {
        if (!signUp) {
            return 'Account verification is not complete yet'
        }

        if (signUp.missingFields.length > 0) {
            return `Clerk still needs: ${signUp.missingFields.join(', ')}.`
        }

        if (signUp.unverifiedFields.length > 0) {
            return `Still waiting for verification: ${signUp.unverifiedFields.join(', ')}.`
        }

        return 'Account verification is not complete yet'
    }

    const completeSignUp = async () => {
        if (!signUp) return false

        const { error: finalizeError } = await signUp.finalize({
            navigate: ({ session, decorateUrl }) => {
                if (session?.currentTask) {
                    router.replace('/auth/update-password')
                    return
                }

                const targetUrl = decorateUrl('/dashboard')
                if (targetUrl.startsWith('http')) {
                    window.location.href = targetUrl
                    return
                }

                router.replace(targetUrl)
            },
        })

        if (finalizeError) {
            setError(getClerkErrorMessage(finalizeError, buildIncompleteSignUpMessage()))
            return false
        }

        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password || !signUp) return

        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
            return
        }

        setLoading(true)
        setError('')
        setNotice('')

        const { error: signUpError } = await signUp.password({
            emailAddress: email,
            password,
            unsafeMetadata: name.trim() ? { name: name.trim() } : undefined,
        })

        if (signUpError) {
            setError(getClerkErrorMessage(signUpError, 'Unable to create account'))
            setLoading(false)
            return
        }

        if (signUp.status === 'complete') {
            await completeSignUp()
            setLoading(false)
            return
        }

        const { error: sendCodeError } = await signUp.verifications.sendEmailCode()
        if (sendCodeError) {
            setError(getClerkErrorMessage(sendCodeError, 'Unable to send verification code'))
            setLoading(false)
            return
        }

        setNeedsVerification(true)
        setNotice('Check your inbox for a verification code, then enter it below to finish creating your account.')
        setLoading(false)
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!code || !signUp) return

        setLoading(true)
        setError('')

        const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code })
        if (verifyError) {
            setError(getClerkErrorMessage(verifyError, 'Invalid verification code'))
            setLoading(false)
            return
        }

        const completed = await completeSignUp()
        if (!completed && signUp.status !== 'complete') {
            setError(buildIncompleteSignUpMessage())
        }

        setLoading(false)
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
                    <Link href="/auth/signin" className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--neo-accent-lime)] underline underline-offset-4">
                        Sign In
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
                            Start creating instantly.
                        </h1>
                        <p className="max-w-lg text-lg font-medium leading-8 text-[var(--neo-ink)]/80">
                            Create your account, review AI output before rendering, and keep the cost of every chapter visible from day one.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <NeoCard noHover>
                            <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em]">
                                <Icon name="coins" size={18} className="text-[var(--neo-accent-lime)]" />
                                {FREE_SIGNUP_CREDITS} starter credits
                            </span>
                            <p className="mt-3 text-sm leading-7 text-[var(--neo-ink)]/75">
                                Enough to explore the workflow before your first top-up.
                            </p>
                        </NeoCard>
                        <NeoCard noHover>
                            <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em]">
                                <Icon name="badge-check" size={18} className="text-[var(--neo-accent-cyan)]" />
                                Premium unlock path
                            </span>
                            <p className="mt-3 text-sm leading-7 text-[var(--neo-ink)]/75">
                                Premium rendering unlocks automatically after your first successful purchase.
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
                                Join us
                            </h2>
                            <div className="mt-4 flex justify-center">
                                <div className="h-1 w-12 bg-[var(--neo-accent-yellow)]" />
                            </div>
                            <p className="mt-5 text-sm font-medium text-[var(--neo-ink)]/70">
                                You&apos;ll receive {FREE_SIGNUP_CREDITS} starter credits right after signup.
                            </p>
                        </div>

                        <form onSubmit={needsVerification ? handleVerify : handleSubmit} className="mt-8 space-y-5">
                            <NeoInput
                                id="name"
                                type="text"
                                label="Name"
                                placeholder="Your name (optional)"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                autoFocus
                                disabled={needsVerification || loading || fetchStatus === 'fetching'}
                            />

                            <NeoInput
                                id="email"
                                type="email"
                                label="Email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                disabled={needsVerification || loading || fetchStatus === 'fetching'}
                            />

                            {!needsVerification ? (
                                <NeoInput
                                    id="password"
                                    type="password"
                                    label="Password"
                                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    disabled={loading || fetchStatus === 'fetching'}
                                />
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

                            <NeoButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={loading || fetchStatus === 'fetching'}
                                className="w-full"
                            >
                                {loading ? <div className="weo-spinner mr-2 border-black border-t-transparent" /> : null}
                                {needsVerification ? 'Verify Email' : 'Create Account'}
                            </NeoButton>
                        </form>

                        <div className="mt-8 border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-4 text-center text-sm font-medium text-[var(--neo-ink)]/70">
                            Already have an account?{' '}
                            <Link
                                href="/auth/signin"
                                className="font-bold text-[var(--neo-ink)] underline decoration-[var(--neo-accent-yellow)] decoration-2 underline-offset-4"
                            >
                                Sign in here.
                            </Link>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
