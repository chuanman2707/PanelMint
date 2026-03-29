export const HERO_TERMINAL_LINES = [
    'BOOT_SEQUENCE // CALIBRATING PANELS',
    'ANALYSIS_GATE // READY',
    'STORYBOARD_LOCK // READY',
]

export const HERO_SIGNAL_STRIP = [
    'STORYBOARD GATES',
    'PAYMENT-READY UI',
    'PROTECTED IMMERSIVE ROUTES',
    'CREDIT-AWARE GENERATION',
]

export const FEATURE_ROWS = [
    {
        title: 'Review before render',
        copy: 'Approve characters, locations, and storyboard panels before the image pass starts.',
        tone: 'cyan' as const,
    },
    {
        title: 'Credit-aware workspace',
        copy: 'Every package, render tier, and payment handoff is visible before you commit.',
        tone: 'yellow' as const,
    },
    {
        title: 'Immersive reading + editing',
        copy: 'Reader and editor routes stay protected, full-screen, and detached from app chrome.',
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
        label: 'Spend control',
        value: 'Visible credit economics',
        copy: 'Package pricing and render cost stay honest, surfaced, and easy to inspect.',
    },
]

export const PACKAGES = [
    { name: 'Starter', credits: '500', price: '$12', highlight: 'default' as const, copy: 'Good for a first chapter and review pass.' },
    { name: 'Publisher', credits: '2,500', price: '$49', highlight: 'yellow' as const, copy: 'Best value for regular storyboard + render cycles.' },
    { name: 'Studio', credits: '7,500', price: '$129', highlight: 'cyan' as const, copy: 'For teams iterating across multiple episodes.' },
]

export const COST_ITEMS = [
    ['Writing step', '80 credits'],
    ['Standard image', '40 credits / panel'],
    ['Premium image', '250 credits / panel'],
] as const
