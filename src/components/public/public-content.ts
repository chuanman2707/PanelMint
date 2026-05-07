export const HERO_TERMINAL_LINES = [
    'BOOT_SEQUENCE // CALIBRATING PANELS',
    'ANALYSIS_GATE // READY',
    'STORYBOARD_LOCK // READY',
]

export const HERO_SIGNAL_STRIP = [
    'STORYBOARD GATES',
    'LOCAL WAVESPEED KEY',
    'LOCAL IMMERSIVE ROUTES',
    'SINGLE RENDER MODE',
]

export const FEATURE_ROWS = [
    {
        title: 'Review before render',
        copy: 'Approve characters, locations, and storyboard panels before the image pass starts.',
        tone: 'cyan' as const,
    },
    {
        title: 'Local WaveSpeed key',
        copy: 'Use your own WaveSpeed account key so generation runs through the local workspace configuration.',
        tone: 'yellow' as const,
    },
    {
        title: 'Immersive reading + editing',
        copy: 'Reader and editor routes stay local, full-screen, and detached from app chrome.',
        tone: 'lime' as const,
    },
]

export const ENGINE_SPECS = [
    {
        label: 'Input mode',
        value: 'Long-form story prompts',
        copy: 'Paste manuscript-length text and keep the review loop visible end to end.',
    },
    {
        label: 'Review gates',
        value: 'Analysis + storyboard approvals',
        copy: 'Nothing jumps to render until the creator signs off on structure and scene beats.',
    },
    {
        label: 'Output',
        value: 'Reader + editor surfaces',
        copy: 'Ship readable pages first, then refine balloons and pacing without leaving the app.',
    },
    {
        label: 'Provider ownership',
        value: 'WaveSpeed account key',
        copy: 'Render requests use the WaveSpeed account key configured for this local OSS workspace.',
    },
]
