import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { CREDIT_PACKAGES, grantCredits } from '@/lib/billing'

const devTopUpRequestSchema = z.object({
    packageId: z.string().refine((value) => value in CREDIT_PACKAGES, {
        message: 'Unknown package id',
    }),
})

export const POST = apiHandler(async (request) => {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const localUser = await getOrCreateLocalUser()

    const { packageId } = await parseJsonBody(request, devTopUpRequestSchema)
    const selectedPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]

    await grantCredits(localUser.id, selectedPackage.credits, 'purchase', {
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
