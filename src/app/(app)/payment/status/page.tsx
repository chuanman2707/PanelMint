'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { NeoButton } from '@/components/ui/NeoButton'
import { NeoCard } from '@/components/ui/NeoCard'
import { NeoTag } from '@/components/ui/NeoTag'
import { Icon } from '@/components/ui/icons'

export default function PaymentStatusPage() {
    const searchParams = useSearchParams()
    const status = searchParams.get('status') ?? 'success'
    const packageName = searchParams.get('package') ?? 'Publisher'
    const credits = searchParams.get('credits') ?? '2,500'

    const isSuccess = status === 'success'
    const isPending = status === 'pending'

    return (
        <div className="mx-auto max-w-[1240px] p-6 md:p-8">
            <div className="mb-8">
                <NeoTag tone="ink">SYSTEM STATUS / ARCHIVE_021</NeoTag>
                <h1 className="mt-6 font-display text-[clamp(2.4rem,5vw,4.2rem)] font-black uppercase leading-[0.92] tracking-[-0.06em] text-black">
                    Transaction log
                </h1>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                <NeoCard className={isSuccess ? 'bg-[var(--neo-accent-lime)]' : 'bg-white'} noHover>
                    <NeoTag tone={isSuccess ? 'ink' : 'paper'}>{isSuccess ? 'Approved' : 'Queued'}</NeoTag>
                    <div className="mt-8 flex h-full flex-col justify-between gap-8">
                        <div>
                            <div className="flex h-20 w-20 items-center justify-center border-[var(--neo-border-width)] border-black bg-white shadow-[var(--neo-shadow-button)]">
                                <Icon name={isSuccess ? 'check' : 'clock'} size={40} className="text-black" />
                            </div>
                            <h2 className="mt-6 font-display text-4xl font-black uppercase tracking-[-0.05em] text-black">
                                {isSuccess ? 'Credits secured' : 'Checkout pending'}
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-[color:rgba(9,9,11,0.76)]">
                                Package: {packageName}. Expected balance change: {credits} credits.
                            </p>
                        </div>
                        <div className="grid gap-3">
                            <Link href="/settings?tab=credits">
                                <NeoButton className="w-full">
                                    <Icon name="wallet" size={16} />
                                    Open credits workspace
                                </NeoButton>
                            </Link>
                            <Link href="/dashboard">
                                <NeoButton variant="secondary" className="w-full">
                                    <Icon name="layout-grid" size={16} />
                                    Return to dashboard
                                </NeoButton>
                            </Link>
                        </div>
                    </div>
                </NeoCard>

                <NeoCard className={isPending ? 'bg-[var(--neo-accent-yellow)]' : 'bg-white'} noHover>
                    <NeoTag tone={isPending ? 'ink' : 'paper'}>{isPending ? 'Attention' : 'Fallback state'}</NeoTag>
                    <div className="mt-8 flex h-full flex-col justify-between gap-8">
                        <div>
                            <div className="flex h-20 w-20 items-center justify-center border-[var(--neo-border-width)] border-black bg-white shadow-[var(--neo-shadow-button)]">
                                <Icon name={status === 'failed' ? 'alert' : 'credit-card'} size={40} className="text-black" />
                            </div>
                            <h2 className="mt-6 font-display text-4xl font-black uppercase tracking-[-0.05em] text-black">
                                {status === 'failed' ? 'Payment failed' : 'Integration note'}
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-[color:rgba(9,9,11,0.76)]">
                                This screen is designed for the future checkout callback. In the current repo, it remains a UI contract rather than a fully wired payment backend.
                            </p>
                        </div>
                        <div className="border-[var(--neo-border-width)] border-black bg-black p-5 text-[var(--neo-accent-lime)] shadow-[var(--neo-shadow-button)]">
                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
                                Route contract
                            </p>
                            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-[color:rgba(123,228,149,0.76)]">
                                Protected app page. Honest copy until checkout lands.
                            </p>
                        </div>
                    </div>
                </NeoCard>
            </div>
        </div>
    )
}
