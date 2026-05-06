import { MAX_STORY_MANUSCRIPT_CHARS } from '@/lib/prompt-budget'

export const GENERATE_MANUSCRIPT_NEAR_LIMIT_CHARS = MAX_STORY_MANUSCRIPT_CHARS - 500

export const GENERATE_MANUSCRIPT_DEFAULT_HELPER_TEXT =
    `Để generate ổn định, mỗi chapter nên dưới ${MAX_STORY_MANUSCRIPT_CHARS} ký tự. Truyện dài hơn nên tách thành nhiều chapter nhỏ.`

export const GENERATE_MANUSCRIPT_NEAR_LIMIT_HELPER_TEXT =
    'Bạn đang gần chạm giới hạn. Nên cắt chapter ở một điểm dừng tự nhiên.'

export const GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT =
    'Chapter này quá dài cho một lần generate. Hãy tách thành phần tiếp theo để tránh lỗi và kiểm soát tiến trình tốt hơn.'

export const GENERATE_MANUSCRIPT_LIMIT_BLOCK_TEXT =
    'Chapter này quá dài để xử lý an toàn trong một lần generate.'

export const GENERATE_MANUSCRIPT_PASTE_OVERFLOW_NOTICE =
    `Phần vượt quá ${MAX_STORY_MANUSCRIPT_CHARS} ký tự đã không được thêm vào.`

export const GENERATE_MANUSCRIPT_SPLIT_TIP =
    'Mẹo: Mỗi chapter nên là một đoạn truyện hoàn chỉnh, tập trung vào 1 cảnh lớn hoặc 1 nhịp chuyển quan trọng.'

interface TruncateGenerateManuscriptPasteArgs {
    currentText: string
    pastedText: string
    selectionStart: number
    selectionEnd: number
}

export function isGenerateManuscriptAtLimit(charCount: number) {
    return charCount >= MAX_STORY_MANUSCRIPT_CHARS
}

export function isGenerateManuscriptNearLimit(charCount: number) {
    return (
        charCount >= GENERATE_MANUSCRIPT_NEAR_LIMIT_CHARS
        && charCount < MAX_STORY_MANUSCRIPT_CHARS
    )
}

export function getGenerateManuscriptHelperText(charCount: number) {
    if (isGenerateManuscriptAtLimit(charCount)) {
        return GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT
    }

    if (isGenerateManuscriptNearLimit(charCount)) {
        return GENERATE_MANUSCRIPT_NEAR_LIMIT_HELPER_TEXT
    }

    return GENERATE_MANUSCRIPT_DEFAULT_HELPER_TEXT
}

export function truncateGenerateManuscriptPaste({
    currentText,
    pastedText,
    selectionStart,
    selectionEnd,
}: TruncateGenerateManuscriptPasteArgs) {
    const safeSelectionStart = Math.max(0, Math.min(selectionStart, currentText.length))
    const safeSelectionEnd = Math.max(safeSelectionStart, Math.min(selectionEnd, currentText.length))
    const beforeSelection = currentText.slice(0, safeSelectionStart)
    const afterSelection = currentText.slice(safeSelectionEnd)
    const availableChars = Math.max(
        0,
        MAX_STORY_MANUSCRIPT_CHARS - (beforeSelection.length + afterSelection.length),
    )
    const acceptedText = pastedText.slice(0, availableChars)
    const overflowText = pastedText.slice(acceptedText.length)

    return {
        nextText: `${beforeSelection}${acceptedText}${afterSelection}`,
        overflowText,
        didOverflow: overflowText.length > 0,
        caretPosition: beforeSelection.length + acceptedText.length,
    }
}
