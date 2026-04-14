import { describe, expect, it } from 'vitest'
import {
    GENERATE_MANUSCRIPT_DEFAULT_HELPER_TEXT,
    GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT,
    GENERATE_MANUSCRIPT_NEAR_LIMIT_CHARS,
    GENERATE_MANUSCRIPT_NEAR_LIMIT_HELPER_TEXT,
    getGenerateManuscriptHelperText,
    truncateGenerateManuscriptPaste,
} from './generate-manuscript-guardrails'
import { MAX_STORY_MANUSCRIPT_CHARS } from './prompt-budget'

describe('generate manuscript guardrails', () => {
    it('returns the default helper copy while comfortably under the limit', () => {
        expect(getGenerateManuscriptHelperText(2_000)).toBe(GENERATE_MANUSCRIPT_DEFAULT_HELPER_TEXT)
    })

    it('returns the near-limit helper copy before the hard stop', () => {
        expect(getGenerateManuscriptHelperText(GENERATE_MANUSCRIPT_NEAR_LIMIT_CHARS)).toBe(
            GENERATE_MANUSCRIPT_NEAR_LIMIT_HELPER_TEXT,
        )
    })

    it('returns the hard-stop helper copy at the limit', () => {
        expect(getGenerateManuscriptHelperText(MAX_STORY_MANUSCRIPT_CHARS)).toBe(
            GENERATE_MANUSCRIPT_LIMIT_HELPER_TEXT,
        )
    })

    it('truncates pasted text and preserves the overflow for follow-up actions', () => {
        const result = truncateGenerateManuscriptPaste({
            currentText: 'A'.repeat(MAX_STORY_MANUSCRIPT_CHARS - 3),
            pastedText: 'BCDEF',
            selectionStart: MAX_STORY_MANUSCRIPT_CHARS - 3,
            selectionEnd: MAX_STORY_MANUSCRIPT_CHARS - 3,
        })

        expect(result.nextText).toBe('A'.repeat(MAX_STORY_MANUSCRIPT_CHARS - 3) + 'BCD')
        expect(result.overflowText).toBe('EF')
        expect(result.didOverflow).toBe(true)
        expect(result.caretPosition).toBe(MAX_STORY_MANUSCRIPT_CHARS)
    })

    it('lets paste continue unchanged when the selection creates enough room', () => {
        const result = truncateGenerateManuscriptPaste({
            currentText: 'HelloWorld',
            pastedText: 'Comic',
            selectionStart: 5,
            selectionEnd: 10,
        })

        expect(result.nextText).toBe('HelloComic')
        expect(result.overflowText).toBe('')
        expect(result.didOverflow).toBe(false)
        expect(result.caretPosition).toBe(10)
    })
})
