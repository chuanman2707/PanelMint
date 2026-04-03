import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    include: ['src/**/*.test.ts'],
                    environment: 'node',
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    include: ['src/**/*.test.tsx'],
                    environment: 'jsdom',
                    setupFiles: ['./src/test/setup-dom.ts'],
                },
            },
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
