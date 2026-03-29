'use client'

import Link from 'next/link'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { Icon } from '@/components/ui/icons'

export default function UpdatePasswordPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[var(--neo-bg-canvas)] px-4 py-8 md:px-6">
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#09090B_0.5px,transparent_0.5px)] bg-[size:24px_24px] opacity-[0.05]" />
            <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-ink)] px-4 py-3 text-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-card)] md:px-6">
                <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[var(--neo-accent-lime)] md:text-sm">
                    COMIC_OS // TERMINAL
                </Link>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neo-accent-lime)]/70">
                    Secure your account
                </span>
            </header>

            <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-5xl items-center gap-6 py-8 lg:grid-cols-[0.95fr_0.8fr]">
                <div className="rounded-[var(--neo-radius-lg)] border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-surface)] p-8 shadow-[var(--neo-shadow-card)] md:p-10">
                    <div className="inline-flex h-14 w-14 items-center justify-center border-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-accent-yellow)] text-[var(--neo-ink)] shadow-[var(--neo-shadow-card)]">
                        <Icon name="shield" size={26} />
                    </div>
                    <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--neo-ink)]/55">
                        Secure your account
                    </p>
                    <h1 className="mt-3 max-w-md text-4xl font-black uppercase leading-tight tracking-tighter text-[var(--neo-ink)]">
                        Password updates now happen in the reset flow.
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-[var(--neo-ink)]/75">
                        The old email-link recovery screen was removed during the Clerk migration. Start a new reset flow and you can verify the code and set a new password on one page.
                    </p>
                </div>

                <NeoCard noHover className="p-0">
                    <div className="border-b-[var(--neo-border-width)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-6 py-3">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--neo-ink)]/60">
                            Update password
                        </span>
                    </div>
                    <div className="px-6 py-8 md:px-8">
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-[var(--neo-ink)]">
                            Restart password reset
                        </h2>

                        <div className="mt-5 space-y-5">
                            <div className="border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-4 text-sm leading-7 text-[var(--neo-ink)]/75">
                                If you arrived from an older recovery email, that link will not work anymore. Start over below and Clerk will send you a fresh reset code.
                            </div>
                            <Link href="/auth/reset-password" className="block">
                                <NeoButton variant="primary" size="lg" className="w-full">
                                    Start Reset Flow
                                </NeoButton>
                            </Link>
                        </div>

                        <div className="mt-6 border-[var(--neo-border-width-sm)] border-[var(--neo-ink)] bg-[var(--neo-bg-panel)] px-4 py-3 text-sm text-[var(--neo-ink)]/75">
                            Need to restart?{' '}
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
