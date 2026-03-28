import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { prisma } from '@/lib/prisma'
import { syncDomainUserFromAuthUser, type ExternalAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const event = await verifyWebhook(request)

        if (event.type === 'user.created' || event.type === 'user.updated') {
            await syncDomainUserFromAuthUser(event.data as ExternalAuthUser)
        }

        if (event.type === 'user.deleted' && event.data.id) {
            await prisma.user.updateMany({
                where: { authUserId: event.data.id },
                data: { authUserId: null },
            })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[Clerk Webhook] Verification failed', error)
        return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
    }
}
