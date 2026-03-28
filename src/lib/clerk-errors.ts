type ClerkErrorLike =
    | {
        code?: string
        message?: string
        longMessage?: string
        errors?: Array<{
            code?: string
            message?: string
            longMessage?: string
        }>
    }
    | null
    | undefined

function getPrimaryError(error: ClerkErrorLike) {
    if (!error) return null

    if (Array.isArray(error.errors) && error.errors.length > 0) {
        return error.errors[0]
    }

    return error
}

export function getClerkErrorMessage(error: ClerkErrorLike, fallback: string): string {
    const primary = getPrimaryError(error)
    if (!primary) return fallback

    if (typeof primary.longMessage === 'string' && primary.longMessage.trim()) {
        return primary.longMessage
    }

    if (typeof primary.message === 'string' && primary.message.trim()) {
        return primary.message
    }

    return fallback
}

export function hasClerkErrorCode(error: ClerkErrorLike, targetCode: string): boolean {
    if (!error) return false

    if (Array.isArray(error.errors)) {
        return error.errors.some((item) => item.code === targetCode)
    }

    return error.code === targetCode
}
