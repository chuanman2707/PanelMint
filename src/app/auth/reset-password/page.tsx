'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoInput } from '@/components/ui/NeoInput'
import { NeoCard } from '@/components/ui/NeoCard'
import { Icon } from '@/components/ui/icons'
import { MIN_PASSWORD_LENGTH } from '@/lib/security-policy'
import { getClerkErrorMessage } from '@/lib/clerk-errors'

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

                const targetUrl = decorateUrl('/')
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
        <div className="min-h-screen px-4 py-8 md:px-6">
            <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center gap-6 lg:grid-cols-[0.95fr_0.8fr]">
                <div className="rounded-[32px] border border-[var(--weo-stroke-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,255,255,0.72))] p-8 shadow-[var(--weo-shadow-lg)] animate-fade-in-up md:p-10">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--weo-accent-glow)] text-[var(--weo-accent-from)]">
                        <Icon name="shield" size={26} />
                    </div>
                    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                        Account recovery
                    </p>
                    <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight text-[var(--weo-text-primary)]">
                        Reset your password without losing your current workspace.
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-[var(--weo-text-secondary)]">
                        We&apos;ll email you a secure recovery link. Open it on the same device if possible, then choose a new password.
                    </p>
                </div>

                <NeoCard className="animate-fade-in-up p-7 md:p-8">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--weo-tone-neutral-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--weo-text-secondary)]">
                            <Icon name="shield" size={14} className="text-[var(--weo-accent-from)]" />
                            Reset password
                        </div>
                        <h2 className="mt-5 text-3xl font-semibold text-[var(--weo-text-primary)]">
                            {step === 'request'
                                ? 'Send reset code'
                                : step === 'verify'
                                    ? 'Verify reset code'
                                    : 'Choose new password'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
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
                            <div className="flex items-start gap-2 rounded-[20px] bg-[var(--weo-tone-danger-bg)] px-4 py-3 text-sm text-[var(--weo-tone-danger-fg)]">
                                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="flex items-start gap-2 rounded-[20px] bg-[var(--weo-tone-neutral-bg)] px-4 py-3 text-sm text-[var(--weo-text-secondary)]">
                                <Icon name="badge-check" size={16} className="mt-0.5 shrink-0 text-[var(--weo-accent-from)]" />
                                {notice}
                            </div>
                        )}

                        <NeoButton type="submit" variant="primary" size="lg" disabled={loading || fetchStatus === 'fetching'} className="w-full">
                            {loading ? <span className="weo-spinner mr-2" /> : null}
                            {step === 'request'
                                ? 'Send Reset Code'
                                : step === 'verify'
                                    ? 'Verify Code'
                                    : 'Update Password'}
                        </NeoButton>
                    </form>

                    <div className="mt-6 rounded-[20px] border border-[var(--weo-stroke-soft)] bg-white/70 px-4 py-3 text-sm text-[var(--weo-text-secondary)]">
                        Remembered it?{' '}
                        <Link
                            href="/auth/signin"
                            className="font-semibold text-[var(--weo-text-primary)] hover:text-[var(--weo-accent-from)]"
                        >
                            Back to sign in
                        </Link>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
