'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { MIN_PASSWORD_LENGTH } from '@/lib/security-policy'
import { getClerkErrorMessage } from '@/lib/clerk-errors'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoInput } from '@/components/ui/NeoInput'

export default function ResetPasswordPage() {
    const router = useRouter()
    const { signIn, fetchStatus } = useSignIn()
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [step, setStep] = useState<'request' | 'verify' | 'password'>('request')

    const finishResetFlow = async () => {
        if (!signIn) return

        const { error: finalizeError } = await signIn.finalize({
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
            setError(getClerkErrorMessage(finalizeError, 'Password updated, but we could not finish signing you in'))
        }
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!signIn) return

        setLoading(true)
        setError('')

        try {
            if (step === 'request') {
                if (!email) return

                const { error: createError } = await signIn.create({ identifier: email })
                if (createError) {
                    setError(getClerkErrorMessage(createError, 'Unable to start password reset'))
                    return
                }

                const { error: sendCodeError } = await signIn.resetPasswordEmailCode.sendCode()
                if (sendCodeError) {
                    setError(getClerkErrorMessage(sendCodeError, 'Unable to send reset code'))
                    return
                }

                setStep('verify')
                setNotice('We sent a reset code to your email. Enter it below to continue.')
                return
            }

            if (step === 'verify') {
                if (!code) return

                const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code })
                if (verifyError) {
                    setError(getClerkErrorMessage(verifyError, 'Invalid reset code'))
                    return
                }

                setStep('password')
                setNotice('Code verified. Choose your new password.')
                return
            }

            if (password.length < MIN_PASSWORD_LENGTH) {
                setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
                return
            }

            if (password !== confirmPassword) {
                setError('Passwords do not match')
                return
            }

            const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({ password })
            if (passwordError) {
                setError(getClerkErrorMessage(passwordError, 'Unable to update password'))
                return
            }

            if (signIn.status === 'complete') {
                setNotice('Password updated. Signing you in...')
                await finishResetFlow()
                return
            }

            if (signIn.status === 'needs_second_factor') {
                setError('Password updated. This account still requires another sign-in step. Sign in again to continue.')
                return
            }

            setError('Password updated, but the sign-in flow is not complete yet.')
        } catch {
            setError('Unable to continue password reset')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[var(--neo-bg-canvas)] px-4 py-8 md:px-6">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#09090B_0.5px,transparent_0.5px)] bg-[size:24px_24px] opacity-[0.05]" />
            <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-ink)] px-4 py-3 text-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-card)] md:px-6">
                <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[var(--neo-accent-lime)] md:text-sm">
                    COMIC_OS // TERMINAL
                </Link>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)]/70">
                    Account recovery
                </span>
            </header>

            <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-5xl items-center gap-6 py-8 lg:grid-cols-[0.95fr_0.8fr]">
                <div className="rounded-[var(--neo-radius-lg)] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] p-8 shadow-[var(--neo-shadow-card)] md:p-10">
                    <div className="inline-flex h-14 w-14 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] text-[var(--neo-ink)] shadow-[var(--neo-shadow-card)]">
                        <Icon name="shield" size={26} />
                    </div>
                    <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--neo-ink)]/55">
                        Account recovery
                    </p>
                    <h1 className="mt-3 max-w-md text-4xl font-black uppercase leading-tight tracking-tighter text-[var(--neo-ink)]">
                        Reset your password without losing your current workspace.
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-[var(--neo-ink)]/75">
                        We&apos;ll email you a secure recovery code. Open it on the same device if possible, then choose a new password.
                    </p>
                </div>

                <NeoCard noHover className="p-0">
                    <div className="border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-6 py-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--neo-ink)]/60">
                            Reset password
                        </span>
                    </div>
                    <div className="px-6 py-8 md:px-8">
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-[var(--neo-ink)]">
                            {step === 'request'
                                ? 'Send reset code'
                                : step === 'verify'
                                    ? 'Verify reset code'
                                    : 'Choose new password'}
                        </h2>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                            {step === 'request' ? (
                                <NeoInput
                                    id="email"
                                    type="email"
                                    label="Email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                    autoFocus
                                    disabled={loading || fetchStatus === 'fetching'}
                                />
                            ) : null}

                            {step === 'verify' ? (
                                <NeoInput
                                    id="code"
                                    type="text"
                                    label="Reset code"
                                    placeholder="6-digit code"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    required
                                    autoFocus
                                    disabled={loading || fetchStatus === 'fetching'}
                                />
                            ) : null}

                            {step === 'password' ? (
                                <>
                                    <NeoInput
                                        id="password"
                                        type="password"
                                        label="New password"
                                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="new-password"
                                        required
                                        autoFocus
                                        disabled={loading || fetchStatus === 'fetching'}
                                    />
                                    <NeoInput
                                        id="confirm-password"
                                        type="password"
                                        label="Confirm password"
                                        placeholder="Repeat your password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        autoComplete="new-password"
                                        required
                                        disabled={loading || fetchStatus === 'fetching'}
                                    />
                                </>
                            ) : null}

                            {error && (
                                <div className="flex items-start gap-3 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-pink)] px-4 py-3 text-sm font-bold text-[var(--neo-ink)] shadow-[var(--neo-shadow-button)]">
                                    <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {notice && (
                                <div className="flex items-start gap-3 border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-lime)] px-4 py-3 text-sm font-bold text-[var(--neo-ink)] shadow-[var(--neo-shadow-button)]">
                                    <Icon name="badge-check" size={16} className="mt-0.5 shrink-0" />
                                    {notice}
                                </div>
                            )}

                            <NeoButton type="submit" variant="primary" size="lg" disabled={loading || fetchStatus === 'fetching'} className="w-full">
                                {loading ? <span className="weo-spinner mr-2 border-black border-t-transparent" /> : null}
                                {step === 'request'
                                    ? 'Send Reset Code'
                                    : step === 'verify'
                                        ? 'Verify Code'
                                        : 'Update Password'}
                            </NeoButton>
                        </form>

                        <div className="mt-6 border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-3 text-sm text-[var(--neo-ink)]/75">
                            Remembered it?{' '}
                            <Link
                                href="/auth/signin"
                                className="font-semibold text-[var(--neo-ink)] underline decoration-[var(--neo-accent-yellow)] decoration-2 underline-offset-4"
                            >
                                Back to sign in
                            </Link>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
