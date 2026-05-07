import type { ProviderConfig } from '@/lib/api-config'
import { getStorage } from '@/lib/storage'

export interface ReferenceImageCandidate {
    imageUrl: string | null
    storageKey?: string | null
}

function isRemoteUrl(value: string): boolean {
    return value.startsWith('https://') || value.startsWith('http://')
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
        formData.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.contentType }), filename)

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
