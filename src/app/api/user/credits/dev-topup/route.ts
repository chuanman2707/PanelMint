import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { CREDIT_PACKAGES, grantCredits } from '@/lib/billing'

const devTopUpRequestSchema = z.object({
    packageId: z.string().refine((value) => value in CREDIT_PACKAGES, {
        message: 'Unknown package id',
    }),
})

export const POST = apiHandler(async (request) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { packageId } = await parseJsonBody(request, devTopUpRequestSchema)
    const selectedPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]

    await grantCredits(auth.user.id, selectedPackage.credits, 'purchase', {
        accountTier: 'paid',
        incrementLifetimePurchasedCredits: true,
    })

    return NextResponse.json({
        ok: true,
        packageId: selectedPackage.id,
        creditsAdded: selectedPackage.credits,
        accountTier: 'paid',
    })
})
