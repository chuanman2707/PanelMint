import { Inngest } from 'inngest'

export const inngest = new Inngest({
    id: 'panelmint',
    checkpointing: {
        // Keep checkpointing comfortably below Vercel's max duration.
        maxRuntime: '240s',
    },
})
