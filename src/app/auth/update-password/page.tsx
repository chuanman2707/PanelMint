'use client'

import Link from 'next/link'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { Icon } from '@/components/ui/icons'

export default function UpdatePasswordPage() {
    return (
        <div className="min-h-screen px-4 py-8 md:px-6">
            <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center gap-6 lg:grid-cols-[0.95fr_0.8fr]">
                <div className="rounded-[32px] border border-[var(--weo-stroke-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,255,255,0.72))] p-8 shadow-[var(--weo-shadow-lg)] animate-fade-in-up md:p-10">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--weo-accent-glow)] text-[var(--weo-accent-from)]">
                        <Icon name="shield" size={26} />
                    </div>
                    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--weo-text-muted)]">
                        Secure your account
                    </p>
                    <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight text-[var(--weo-text-primary)]">
                        Password updates now happen in the reset flow.
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-[var(--weo-text-secondary)]">
                        The old email-link recovery screen was removed during the Clerk migration. Start a new reset flow and you can verify the code and set a new password on one page.
                    </p>
                </div>

                <NeoCard className="animate-fade-in-up p-7 md:p-8">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--weo-tone-neutral-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--weo-text-secondary)]">
                            <Icon name="shield" size={14} className="text-[var(--weo-accent-from)]" />
                            Update password
                        </div>
                        <h2 className="mt-5 text-3xl font-semibold text-[var(--weo-text-primary)]">
                            Restart password reset
                        </h2>
                    </div>

                    <div className="space-y-5">
                        <div className="rounded-[20px] bg-[var(--weo-tone-neutral-bg)] px-4 py-4 text-sm text-[var(--weo-text-secondary)]">
                            If you arrived from an older recovery email, that link will not work anymore. Start over below and Clerk will send you a fresh reset code.
                        </div>
                        <Link href="/auth/reset-password" className="block">
                            <NeoButton variant="primary" size="lg" className="w-full">
                                Start Reset Flow
                            </NeoButton>
                        </Link>
                    </div>

                    <div className="mt-6 rounded-[20px] border border-[var(--weo-stroke-soft)] bg-white/70 px-4 py-3 text-sm text-[var(--weo-text-secondary)]">
                        Need to restart?{' '}
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
