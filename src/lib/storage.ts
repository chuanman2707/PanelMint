import { writeFile, mkdir, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'

// ─── Interface ─────────────────────────────────────────

export interface StorageProvider {
    upload(buffer: Buffer, key: string): Promise<string>
    getSignedUrl(key: string, expiresIn?: number): Promise<string>
    delete(key: string): Promise<void>
}

/** Build a storage key: {userId}/{episodeId}/{panelId}-{uuid}.png */
export function buildStorageKey(userId: string, episodeId: string, panelId: string): string {
    return `${userId}/${episodeId}/${panelId}-${randomUUID()}.png`
}

// ─── R2 Storage Provider ───────────────────────────────

export class R2StorageProvider implements StorageProvider {
    private client: import('@aws-sdk/client-s3').S3Client
    private bucket: string
    private publicUrl: string

    constructor() {
        const { S3Client } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3')

        this.bucket = process.env.R2_BUCKET_NAME!
        this.publicUrl = process.env.R2_PUBLIC_URL || ''

        this.client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        })
    }

    async upload(buffer: Buffer, key: string): Promise<string> {
        const { PutObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3')

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }))

        // CRITICAL: Return renderable URL, not just the key.
        // imageUrl is persisted to DB and used directly by <img src=...> in ReviewStoryboard,
        // CanvasEditor, and as reference images in multi-ref generation.
        const url = this.publicUrl ? `${this.publicUrl}/${key}` : await this.getSignedUrl(key)
        console.log(`[Storage] R2 uploaded: ${key} → ${url}`)
        return url
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const { GetObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3')
        const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner') as typeof import('@aws-sdk/s3-request-presigner')

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        })

        return awsGetSignedUrl(this.client, command, { expiresIn })
    }

    async delete(key: string): Promise<void> {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3')

        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }))

        console.log(`[Storage] R2 deleted: ${key}`)
    }
}

// ─── Local Storage Provider (dev fallback) ─────────────

export class LocalStorageProvider implements StorageProvider {
    private baseDir: string

    constructor(baseDir?: string) {
        this.baseDir = baseDir || join(process.cwd(), 'public', 'generated')
    }

    async upload(buffer: Buffer, key: string): Promise<string> {
        const filename = key.split('/').pop() || `${randomUUID()}.png`
        const outputDir = this.baseDir
        await mkdir(outputDir, { recursive: true })
        await writeFile(join(outputDir, filename), buffer)
        console.log(`[Storage] Local saved: ${filename}`)
        return `/generated/${filename}`
    }

    async getSignedUrl(key: string): Promise<string> {
        if (key.startsWith('/generated/')) return key
        return `/generated/${key}`
    }

    async delete(key: string): Promise<void> {
        const filename = key.split('/').pop() || key
        const filePath = join(this.baseDir, filename)
        try {
            await unlink(filePath)
            console.log(`[Storage] Local deleted: ${filename}`)
        } catch {
            // File may not exist — ignore
        }
    }
}

// ─── Factory ───────────────────────────────────────────

let _provider: StorageProvider | null = null

export function createStorageProvider(): StorageProvider {
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
        return new R2StorageProvider()
    }
    return new LocalStorageProvider()
}

/** Singleton storage provider */
export function getStorage(): StorageProvider {
    if (!_provider) {
        _provider = createStorageProvider()
    }
    return _provider
}
