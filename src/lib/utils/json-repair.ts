import { jsonrepair } from 'jsonrepair'

function stripMarkdownFence(input: string): string {
    let cleaned = input
        // Strip thinking blocks from models like qwen3.5-plus
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        // Strip markdown code fences
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/g, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

    // If there's still non-JSON text before the first { or [, strip it
    const firstJson = cleaned.search(/[\[{]/)
    if (firstJson > 0) {
        cleaned = cleaned.slice(firstJson)
    }

    return cleaned
}

function extractJsonSubstring(input: string): string {
    const firstBrace = input.indexOf('{')
    const firstBracket = input.indexOf('[')
    if (firstBrace === -1 && firstBracket === -1) return input

    const isObject = firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)
    const openChar = isObject ? '{' : '['
    const closeChar = isObject ? '}' : ']'
    const start = isObject ? firstBrace : firstBracket

    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < input.length; i++) {
        const ch = input[i]
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === openChar) depth++
        else if (ch === closeChar) {
            depth--
            if (depth === 0) return input.slice(start, i + 1)
        }
    }
    return input
}

export function safeParseJson(input: string): unknown {
    const cleaned = stripMarkdownFence(input.trim())
    try { return JSON.parse(cleaned) } catch { /* continue */ }
    const extracted = extractJsonSubstring(cleaned)
    try { return JSON.parse(extracted) } catch { /* continue */ }
    try {
        return JSON.parse(jsonrepair(extracted))
    } catch (err) {
        console.error('[JSON Parse] All attempts failed. Input preview:', extracted.slice(0, 300))
        throw err
    }
}

export function safeParseJsonArray(
    input: string,
    fallbackKey?: string,
): Record<string, unknown>[] {
    const result = safeParseJson(input)
    if (Array.isArray(result)) {
        return result.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    }
    if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>
        const keys = fallbackKey ? [fallbackKey] : Object.keys(obj)
        for (const key of keys) {
            const value = obj[key]
            if (Array.isArray(value)) {
                return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            }
        }
    }
    throw new Error('Expected JSON array from LLM output')
}

export function safeParseJsonObject(input: string): Record<string, unknown> {
    const result = safeParseJson(input)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        return result as Record<string, unknown>
    }
    throw new Error('Expected JSON object from LLM output')
}
