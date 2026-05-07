import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useLocalUser', () => ({
    useLocalUser: () => ({
        user: {
            id: 'user-1',
            email: 'local@panelmint.dev',
            name: 'Local Creator',
        },
    }),
}))

import SettingsPage from './page'

describe('SettingsPage', () => {
    it('shows local workspace settings without API-key management controls', () => {
        render(<SettingsPage />)

        expect(screen.getByText(/Workspace Identity/i)).toBeInTheDocument()
        expect(screen.getAllByText(/WAVESPEED_API_KEY/i).length).toBeGreaterThan(0)
        expect(screen.queryByLabelText(/Provider API key/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Save Key/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Validate/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Remove Key/i })).not.toBeInTheDocument()
        expect(screen.queryByText(/fallback/i)).not.toBeInTheDocument()
    })
})
