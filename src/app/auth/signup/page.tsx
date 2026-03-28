'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSignUp } from '@clerk/nextjs'
import { Icon } from '@/components/ui/icons'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoInput } from '@/components/ui/NeoInput'
import { NeoCard } from '@/components/ui/NeoCard'
import Link from 'next/link'
import { MIN_PASSWORD_LENGTH } from '@/lib/security-policy'
import { FREE_SIGNUP_CREDITS } from '@/lib/credit-catalog'
import { getClerkErrorMessage } from '@/lib/clerk-errors'

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

    const completeSignUp = async () => {
        if (!signUp) return

        const { error: finalizeError } = await signUp.finalize({
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
            setError(getClerkErrorMessage(finalizeError, 'Unable to finish account creation'))
        }
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

        if (signUp.status === 'complete') {
            await completeSignUp()
        } else {
            setError('Account verification is not complete yet')
        }

        setLoading(false)
    }

    return (
        <div className="min-h-screen px-4 py-8 md:px-6 bg-[var(--neo-bg-canvas)]">
            <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">

                {/* Value Proposition */}
                <div className="p-8 md:p-10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[var(--neo-radius-lg)] border-2 border-black bg-[var(--neo-accent-green)] text-black shadow-[var(--neo-shadow-button)]" style={{ background: 'var(--neo-accent-rainbow)' }}>
                        <Icon name="sparkles" size={32} />
                    </div>
                    <p className="mt-8 text-sm font-bold uppercase tracking-widest text-gray-500">
                        weoweo
                    </p>
                    <h1 className="mt-4 max-w-md text-5xl font-bold font-display uppercase leading-tight tracking-tight text-black">
                        Start creating instantly.
                    </h1>
                    <p className="mt-6 max-w-lg text-lg font-bold text-gray-600">
                        Create your account, review AI output before rendering, and keep the cost of every chapter visible from day one.
                    </p>

                    <div className="mt-10 space-y-4">
                        <NeoCard highlight="none" noHover className="p-5 border-2 border-black shadow-[var(--neo-shadow-button)]">
                            <span className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wider">
                                <Icon name="coins" size={18} className="text-[var(--neo-accent-green)] stroke-[3]" />
                                {FREE_SIGNUP_CREDITS} starter credits
                            </span>
                            <p className="mt-3 text-sm text-gray-600">
                                Enough to explore the workflow before your first top-up.
                            </p>
                        </NeoCard>
                        <NeoCard highlight="none" noHover className="p-5 border-2 border-black shadow-[var(--neo-shadow-button)]">
                            <span className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wider">
                                <Icon name="badge-check" size={18} className="text-[#63c7f9] stroke-[3]" />
                                Premium unlock path
                            </span>
                            <p className="mt-3 text-sm text-gray-600">
                                Premium rendering unlocks automatically after your first successful purchase.
                            </p>
                        </NeoCard>
                    </div>
                </div>

                {/* Signup Form */}
                <NeoCard className="p-8 md:p-10">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 rounded-[var(--neo-radius-full)] border-2 border-black bg-[var(--neo-bg-canvas)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
                            <Icon name="user" size={14} />
                            Create account
                        </div>
                        <h2 className="mt-6 text-4xl font-bold font-display uppercase text-black tracking-tight">
                            Join us
                        </h2>
                        <p className="mt-3 text-sm font-bold text-gray-600">
                            You&apos;ll receive {FREE_SIGNUP_CREDITS} starter credits right after signup.
                        </p>
                    </div>

                    <form onSubmit={needsVerification ? handleVerify : handleSubmit} className="space-y-5">
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
                            {needsVerification ? 'Verify Email' : 'Create Account'}
                        </NeoButton>
                    </form>

                    <div className="mt-8 rounded-[var(--neo-radius)] border-2 border-black bg-[var(--neo-bg-canvas)] px-4 py-4 text-center text-sm font-bold text-gray-600">
                        Already have an account?{' '}
                        <Link
                            href="/auth/signin"
                            className="text-black underline hover:text-[var(--neo-accent-green)] transition-colors"
                        >
                            Sign in here.
                        </Link>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
