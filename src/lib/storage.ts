import { randomUUID } from 'crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { dirname, join, resolve, sep } from 'path'

export interface StoredFile {
    buffer: Buffer
    contentType: string
}

export interface StorageProvider {
    upload(buffer: Buffer, key: string, options?: { contentType?: string }): Promise<string>
    read(key: string): Promise<StoredFile>
    getSignedUrl(key: string, expiresIn?: number): Promise<string>
    delete(key: string): Promise<void>
}

const IMAGE_CONTENT_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
}

export function getStorageBaseDir(): string {
    return resolve(process.env.PANELMINT_STORAGE_DIR?.trim() || join(process.cwd(), '.panelmint', 'generated'))
}

export function normalizeStorageKey(key: string): string {
    const slashNormalized = key.replace(/\\/g, '/')
    if (!slashNormalized || slashNormalized.startsWith('/')) {
        throw new Error('Invalid storage key')
    }

    const normalized = slashNormalized.replace(/^\/+/, '')
    if (!normalized || normalized.split('/').some((segment) => segment === '..' || segment === '')) {
        throw new Error('Invalid storage key')
    }

    return normalized
}

export function resolveStoragePath(key: string): string {
    const baseDir = getStorageBaseDir()
    const filePath = resolve(baseDir, normalizeStorageKey(key))

    if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${sep}`)) {
        throw new Error('Invalid storage key')
    }

    return filePath
}

export function getContentTypeForStorageKey(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase() ?? ''
    return IMAGE_CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

export function buildStorageKey(userId: string, episodeId: string, panelId: string, extension = 'png'): string {
    const lowerExtension = extension.toLowerCase()
    const safeExtension = IMAGE_CONTENT_TYPES[lowerExtension] ? lowerExtension : 'png'

    return `users/${userId}/episodes/${episodeId}/panels/${panelId}-${randomUUID()}.${safeExtension}`
}

export function buildStorageProxyUrl(key: string): string {
    const encodedKey = normalizeStorageKey(key)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')

    return `/api/storage/${encodedKey}`
}

export class LocalStorageProvider implements StorageProvider {
    async upload(buffer: Buffer, key: string): Promise<string> {
        const normalizedKey = normalizeStorageKey(key)
        const filePath = resolveStoragePath(normalizedKey)

        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, buffer)

        return normalizedKey
    }

    async read(key: string): Promise<StoredFile> {
        const normalizedKey = normalizeStorageKey(key)
        const filePath = resolveStoragePath(normalizedKey)
        const fileStat = await stat(filePath)

        if (!fileStat.isFile()) {
            throw new Error('Not found')
        }

        return {
            buffer: await readFile(filePath),
            contentType: getContentTypeForStorageKey(normalizedKey),
        }
    }

    async getSignedUrl(key: string): Promise<string> {
        return buildStorageProxyUrl(key)
    }

    async delete(key: string): Promise<void> {
        try {
            await unlink(resolveStoragePath(key))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error
            }
        }
    }
}

let provider: StorageProvider | null = null

export function createStorageProvider(): StorageProvider {
    return new LocalStorageProvider()
}

export function getStorage(): StorageProvider {
    if (!provider) {
        provider = createStorageProvider()
    }

    return provider
}
