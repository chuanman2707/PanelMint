import { NextResponse } from 'next/server'
import { getUserApiKey, setUserApiKey } from '@/lib/auth'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import type { ApiProvider } from '@/lib/api-config'
import { parseJsonBody } from '@/lib/api-validate'
import { apiKeyRequestSchema, validApiProviders } from '@/lib/validators/user'

function maskKey(key: string): string {
    if (key.length <= 8) return '***'
    return key.slice(0, 6) + '...' + key.slice(-4)
}

const VALID_PROVIDERS: ApiProvider[] = [...validApiProviders]

const VALIDATION_URLS: Record<ApiProvider, string> = {
    wavespeed: 'https://api.wavespeed.ai/api/v3/models',
}

export const GET = apiHandler(async (request) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const dbUser = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { apiKey: true, apiProvider: true },
    })

    const apiKey = await getUserApiKey(auth.user.id)
    const provider = dbUser?.apiProvider ?? null
    const validate = request.nextUrl.searchParams.get('validate')

    if (validate && apiKey && provider) {
        try {
            const validationUrl = VALIDATION_URLS.wavespeed
            if (!validationUrl) {
                return NextResponse.json({ valid: false, error: 'Unknown provider' })
            }
            const res = await fetch(validationUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            })
            if (res.ok) {
                return NextResponse.json({ valid: true })
            }
            return NextResponse.json({ valid: false, error: 'Invalid or expired API key' })
        } catch {
            return NextResponse.json({ valid: false, error: 'Network error during validation' })
        }
    }

    return NextResponse.json({
        hasKey: !!apiKey,
        maskedKey: apiKey ? maskKey(apiKey) : null,
        provider,
    })
})

export const POST = apiHandler(async (request) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { apiKey, provider } = await parseJsonBody(request, apiKeyRequestSchema)

    if (!VALID_PROVIDERS.includes(provider)) {
        return NextResponse.json({ error: 'Provider must be: wavespeed' }, { status: 400 })
    }

    await setUserApiKey(auth.user.id, apiKey, provider)

    return NextResponse.json({
        ok: true,
        maskedKey: maskKey(apiKey),
        provider,
    })
})

export const DELETE = apiHandler(async () => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    await setUserApiKey(auth.user.id, null)

    return NextResponse.json({ ok: true })
})
