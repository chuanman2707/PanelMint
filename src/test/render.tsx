import '@/test/setup-dom'

import { cleanup, render as rtlRender, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

export { cleanup, renderHook, screen, waitFor, within }

export function render(ui: ReactElement, options?: Parameters<typeof rtlRender>[1]) {
    return {
        user: userEvent.setup(),
        ...rtlRender(ui, options),
    }
}
