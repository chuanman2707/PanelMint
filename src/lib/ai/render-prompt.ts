/**
 * Lightweight prompt template renderer with validation.
 * Replaces raw .replace() chains to catch missing variables.
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(vars)) {
        result = result.replaceAll(`{${key}}`, value)
    }
    const missing = result.match(/\{[a-zA-Z_]+\}/g)
    if (missing) {
        throw new Error(`Missing template variables: ${missing.join(', ')}`)
    }
    return result
}
