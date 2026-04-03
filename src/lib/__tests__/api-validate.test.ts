import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { parseJsonBody } from '@/lib/api-validate'

describe('parseJsonBody', () => {
    it('returns a bad request error for invalid JSON', async () => {
        const request = new Request('http://localhost/api/test', {
            method: 'POST',
            body: '{bad json',
            headers: { 'content-type': 'application/json' },
        })

        await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({
            message: 'Invalid JSON body',
            statusCode: 400,
        })
    })

    it('surfaces the first validation path in the error message', async () => {
        const request = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({
                episode: {
                    pageCount: 99,
                },
            }),
            headers: { 'content-type': 'application/json' },
        })

        await expect(parseJsonBody(request, z.object({
            episode: z.object({
                pageCount: z.number().max(30),
            }),
        }))).rejects.toMatchObject({
            message: 'episode.pageCount: Too big: expected number to be <=30',
            statusCode: 400,
        })
    })

    it('treats an unreadable empty body as an empty object when allowed', async () => {
        const request = new Request('http://localhost/api/test', {
            method: 'POST',
            body: '',
            headers: { 'content-type': 'application/json' },
        })

        await expect(parseJsonBody(request, z.object({}), { allowEmptyBody: true })).resolves.toEqual({})
    })
})
