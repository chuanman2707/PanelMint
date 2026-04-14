export const MAX_STORY_MANUSCRIPT_CHARS = 6_500
export const MAX_STORYBOARD_CHARACTER_CONTEXT_CHARS = 3_500
export const MAX_STORYBOARD_CHARACTER_LINE_CHARS = 450

interface StoryboardPanelBudgetArgs {
    manuscriptChars: number
    pageCount: number
}

export function getStoryboardPanelBudget({
    manuscriptChars,
    pageCount,
}: StoryboardPanelBudgetArgs) {
    const normalizedChars = Math.max(0, manuscriptChars)
    const normalizedPages = Math.max(1, pageCount)
    const maxPanelsPerPage = normalizedPages <= 8 && normalizedChars >= 3_500
        ? 3
        : 2
    const targetTotalPanels = Math.min(
        normalizedPages * maxPanelsPerPage,
        Math.max(normalizedPages, Math.ceil(normalizedChars / 550)),
    )

    return {
        minPanelsPerPage: 1,
        maxPanelsPerPage,
        targetTotalPanels,
    }
}
