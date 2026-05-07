import type { ProviderConfig } from '@/lib/api-config'
import { getStorage } from '@/lib/storage'

export interface ReferenceImageCandidate {
    imageUrl: string | null
    storageKey?: string | null
}

function isRemoteUrl(value: string): boolean {
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

        const hostname = url.hostname.toLowerCase()
        const host = hostname.replace(/^\[|\]$/g, '')
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
        if (host === '::' || host === '::1') return false
        if (host.startsWith('::ffff:')) return false
        if (host === '0.0.0.0') return false
        if (host.startsWith('fc') || host.startsWith('fd')) return false
        if (host.startsWith('fe80:')) return false
        if (/^127\./.test(host)) return false
        if (/^10\./.test(host)) return false
        if (/^192\.168\./.test(host)) return false
        if (/^169\.254\./.test(host)) return false

        const private172 = host.match(/^172\.(\d+)\./)
        if (private172) {
            const secondOctet = Number(private172[1])
            if (secondOctet >= 16 && secondOctet <= 31) return false
        }

        return true
    } catch {
        return false
    }
}

async function uploadReferenceToWaveSpeed(
    reference: ReferenceImageCandidate,
    config: ProviderConfig,
): Promise<string | null> {
    if (!reference.storageKey) return null

    try {
        const file = await getStorage().read(reference.storageKey)
        const formData = new FormData()
        const filename = reference.storageKey.split('/').pop() || 'reference.png'
        const bytes = file.buffer.buffer.slice(
            file.buffer.byteOffset,
            file.buffer.byteOffset + file.buffer.byteLength,
        ) as ArrayBuffer
        formData.append('file', new Blob([bytes], { type: file.contentType }), filename)

        const response = await fetch(`${config.baseUrl}/media/upload/binary`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: formData,
        })

        if (!response.ok) {
            console.warn(`[WaveSpeed] reference upload failed: ${response.status}`)
            return null
        }

        const data = await response.json() as {
            data?: { download_url?: string }
        }

        return data.data?.download_url ?? null
    } catch (error) {
        console.warn('[WaveSpeed] reference upload failed:', error)
        return null
    }
}

export async function prepareWaveSpeedReferenceImages(
    references: ReferenceImageCandidate[],
    config: ProviderConfig,
): Promise<string[]> {
    const urls: string[] = []

    for (const reference of references) {
        if (reference.storageKey) {
            const uploadedUrl = await uploadReferenceToWaveSpeed(reference, config)
            if (uploadedUrl) urls.push(uploadedUrl)
        } else if (reference.imageUrl && isRemoteUrl(reference.imageUrl)) {
            urls.push(reference.imageUrl)
        }

        if (urls.length === 5) break
    }

    return urls
}
