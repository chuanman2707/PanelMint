import { prisma } from '@/lib/prisma'
import { analyzeCharactersAndLocations, splitIntoPagesWithPanels } from './analyze'
import { ServiceError } from './image-gen'
import { executePanelImageGeneration } from './panel-image-executor'
import { getProviderConfig, type ProviderConfig } from '@/lib/api-config'
import { recordPipelineEvent, syncPipelineRunState } from './run-state'

// Statuses that indicate an episode is already being processed
const PROCESSING_STATUSES = ['analyzing', 'storyboarding', 'imaging']

/** Progress now flows through episode + pipeline table writes, not Redis pub/sub. */
async function emitProgress(episodeId: string, data: {
    status: string
    progress: number
    currentPanel?: number
    totalPanels?: number
    error?: string
}): Promise<void> {
    void episodeId
    void data
}

/** Hard limit for chapter text length (Phase 1) */
const MAX_CHAPTER_LENGTH = 20_000

interface PipelineInput {
    projectId: string
    episodeId: string
    userId: string
    text: string
    artStyle: string
    pageCount: number
}

// -- Step 1: Analyze story -> extract characters, locations --
// After completion: status = 'review_analysis' (waits for user approval)
export async function runAnalyzeStep(input: PipelineInput): Promise<void> {
    const { projectId, episodeId, userId, text } = input

    // Hard limit: reject chapters exceeding 20,000 chars
    if (text.length > MAX_CHAPTER_LENGTH) {
        await setEpisodeError(
            episodeId,
            userId,
            new Error(`Chapter quá dài (${text.length} ký tự, tối đa ${MAX_CHAPTER_LENGTH}). Hãy chia thành nhiều phần.`),
            'analyze',
        )
        return
    }

    // Load provider config
    let providerConfig: ProviderConfig
    try {
        providerConfig = await getProviderConfig(userId)
    } catch (error) {
        await setEpisodeError(episodeId, userId, error, 'analyze')
        return
    }

    // DB status check as safety net (e.g. after server restart)
    const existing = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { status: true },
    })
    if (existing && PROCESSING_STATUSES.includes(existing.status)) {
        console.warn(`[Pipeline] Episode ${episodeId} already in status "${existing.status}". Skipping.`)
        return
    }

    console.log(`[Pipeline] Step 1: Analyzing episode ${episodeId}`)

    try {
        await recordPipelineEvent({
            episodeId,
            userId,
            step: 'analyze',
            status: 'started',
            metadata: {
                projectId,
                textLength: text.length,
                requestedPageCount: input.pageCount,
            },
        })

        await updateEpisode(episodeId, userId, 'analyzing', 5)

        const { characters, locations } = await analyzeCharactersAndLocations(text, providerConfig)

        // Save characters with identity anchors
        const savedCharacters = []
        for (const char of characters) {
            const saved = await prisma.character.create({
                data: {
                    projectId,
                    name: char.name,
                    aliases: char.aliases,
                    description: char.description,
                    identityJson: char.identityAnchor
                        ? JSON.stringify(char.identityAnchor)
                        : null,
                },
            })
            savedCharacters.push(saved)
        }
        for (const loc of locations) {
            await prisma.location.create({
                data: {
                    projectId,
                    name: loc.name,
                    description: loc.description,
                },
            })
        }

        // STOP -- wait for user to review characters + locations.
        // The initial analyze prompt already returns identity anchors, so extra
        // per-character LLM refinement should stay off the critical path.
        await updateEpisode(episodeId, userId, 'review_analysis', 25)
        await recordPipelineEvent({
            episodeId,
            userId,
            step: 'analyze',
            status: 'completed',
            metadata: {
                characterCount: characters.length,
                locationCount: locations.length,
            },
        })
        console.log(`[Pipeline] Step 1 complete. ${characters.length} characters, ${locations.length} locations. Waiting for user review.`)

    } catch (err) {
        console.error('[Pipeline] Analyze step error:', err)
        await setEpisodeError(episodeId, userId, err, 'analyze')
        throw err
    }
}

// ── Step 2: Split story + generate enriched panel descriptions ──
// Creates pages + panels with sourceExcerpt, mustKeep, mood, lighting, sceneContext, dialogue
export async function runStoryboardStep(episodeId: string): Promise<void> {
    console.log(`[Pipeline] Step 2: Generating enriched storyboard for episode ${episodeId}`)

    try {
        const episode = await prisma.episode.findUniqueOrThrow({
            where: { id: episodeId },
            include: { project: true },
        })

        const userId = episode.project.userId!

        await recordPipelineEvent({
            episodeId,
            userId,
            step: 'storyboard',
            status: 'started',
            metadata: {
                projectId: episode.projectId,
            },
        })

        await updateEpisode(episodeId, userId, 'storyboarding', 30)

        const providerConfig = await getProviderConfig(userId)

        const dbCharacters = await prisma.character.findMany({
            where: { projectId: episode.projectId },
        })

        const characters = dbCharacters.map((c) => ({
            name: c.name,
            aliases: c.aliases,
            description: c.description || '',
        }))

        const pageCount = episode.pageCount || 15

        await updateEpisode(episodeId, userId, 'storyboarding', 35)

        // 1 LLM call → pages + enriched panels together
        const pages = await splitIntoPagesWithPanels(
            episode.novelText || '',
            characters,
            pageCount,
            providerConfig,
        )

        // Check for 0 panels
        const totalPanels = pages.reduce((sum, p) => sum + p.panels.length, 0)
        if (totalPanels === 0) {
            await setEpisodeError(
                episodeId,
                userId,
                new Error('Could not extract scenes from chapter. Try a different chapter or check formatting.'),
                'storyboard',
            )
            return
        }

        await updateEpisode(episodeId, userId, 'storyboarding', 45)

        // Save pages + panels to DB with enriched fields including dialogue
        for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
            const page = pages[pageIdx]

            const dbPage = await prisma.page.create({
                data: {
                    episodeId,
                    pageIndex: pageIdx,
                    summary: page.summary,
                    content: page.content,
                    characters: JSON.stringify(page.characters),
                    location: page.location,
                    screenplay: JSON.stringify(page.dialogue),
                    sceneContext: JSON.stringify(page.sceneContext),
                },
            })

            for (let panelIdx = 0; panelIdx < page.panels.length; panelIdx++) {
                const panel = page.panels[panelIdx]
                await prisma.panel.create({
                    data: {
                        pageId: dbPage.id,
                        panelIndex: panelIdx,
                        shotType: panel.shotType,
                        description: panel.description,
                        dialogue: panel.dialogue ?? null,
                        characters: JSON.stringify(panel.characters),
                        location: panel.location,
                        sourceExcerpt: panel.sourceExcerpt || null,
                        mustKeep: panel.mustKeep?.length
                            ? JSON.stringify(panel.mustKeep)
                            : null,
                        mood: panel.mood || null,
                        lighting: panel.lighting || null,
                        status: 'pending',
                    },
                })
            }
        }

        // STOP — wait for user to review storyboard
        await updateEpisode(episodeId, userId, 'review_storyboard', 50)
        await recordPipelineEvent({
            episodeId,
            userId,
            step: 'storyboard',
            status: 'completed',
            metadata: {
                pageCount: pages.length,
                panelCount: totalPanels,
            },
        })
        console.log(`[Pipeline] Step 2 complete. ${pages.length} pages, ${totalPanels} panels. Waiting for review.`)

    } catch (err) {
        console.error('[Pipeline] Storyboard step error:', err)
        const episode = await prisma.episode.findUnique({
            where: { id: episodeId },
            include: { project: { select: { userId: true } } },
        })
        if (episode?.project.userId) {
            await setEpisodeError(episodeId, episode.project.userId, err, 'storyboard')
        }
        throw err
    }
}

// ── Step 3: Generate images per PANEL (webtoon: 1 panel = 1 image) ──
export async function runImageGenStep(episodeId: string, panelIds?: string[]): Promise<void> {
    console.log(`[Pipeline] Step 3: Generating panel images for episode ${episodeId}`)

    try {
        const episode = await prisma.episode.findUniqueOrThrow({
            where: { id: episodeId },
            include: { project: true },
        })

        if (episode.status === 'error') {
            console.warn(`[Pipeline] Episode ${episodeId} is already cancelled/errored. Skipping image generation.`)
            return
        }

        const providerConfig = await getProviderConfig(episode.project.userId!)
        const artStyle = episode.project.artStyle || 'webtoon'
        const userId = episode.project.userId!
        const isChildInvocation = Boolean(panelIds?.length === 1)

        await updateEpisode(episodeId, userId, 'imaging', 50)

        // EAGER LOAD: all characters + all panels in one query (avoids N+1)
        const dbCharacters = await prisma.character.findMany({
            where: { projectId: episode.projectId },
            include: {
                appearances: {
                    where: { isDefault: true },
                    select: { imageUrl: true, isDefault: true },
                },
            },
        })

        const allPanels = await prisma.panel.findMany({
            where: {
                page: {
                    episodeId,
                },
                ...(panelIds?.length ? { id: { in: panelIds } } : {}),
                approved: true,
                imageUrl: null,
                status: { in: ['queued', 'pending', 'error', 'generating'] },
            },
            include: {
                page: { select: { sceneContext: true, characters: true } },
            },
            orderBy: [
                { page: { pageIndex: 'asc' } },
                { panelIndex: 'asc' },
            ],
        })

        if (allPanels.length === 0) {
            console.log('[Pipeline] No panels need image generation')
            if (!isChildInvocation) {
                await recordPipelineEvent({
                    episodeId,
                    userId,
                    step: 'image_gen',
                    status: 'completed',
                    metadata: { panelCount: 0, reason: 'no_panels' },
                })
            }
            await updateEpisode(episodeId, userId, 'done', 100)
            return
        }

        const totalPanels = allPanels.length
        console.log(`[Pipeline] Generating images for ${totalPanels} panels`)

        if (!isChildInvocation) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: 'image_gen',
                status: 'started',
                metadata: {
                    panelIds: allPanels.map((panel) => panel.id),
                    panelCount: totalPanels,
                },
            })
        }

        let completedPanels = 0
        let failedPanels = 0

        for (const panel of allPanels) {
            const latestEpisodeState = await prisma.episode.findUnique({
                where: { id: episodeId },
                select: { status: true },
            })

            if (latestEpisodeState?.status === 'error') {
                console.warn(`[Pipeline] Episode ${episodeId} cancelled while imaging. Stopping before remaining panels.`)
                return
            }

            try {
                const result = await executePanelImageGeneration({
                    panel,
                    dbCharacters,
                    providerConfig,
                    artStyle,
                    userId,
                    episodeId,
                })

                if (result === 'done') {
                    completedPanels++
                    console.log(`[Pipeline] Panel ${completedPanels}/${totalPanels}: image generated`)
                } else if (result === 'skipped') {
                    console.warn(`[Pipeline] Panel ${panel.id} skipped because it was cancelled or already reserved`)
                    continue
                } else {
                    failedPanels++
                    if (result === 'content_filtered') {
                        console.warn(`[Pipeline] Panel ${panel.id} blocked by content filter`)
                    } else {
                    console.error(`[Pipeline] Panel ${panel.id} image gen failed`)
                    }
                }
            } catch (err) {
                if (err instanceof ServiceError) {
                    console.error(`[Pipeline] Service error — stopping pipeline:`, err.message)
                    await setEpisodeError(episodeId, userId, err, 'image_gen')
                    return
                }
                throw err
            }

            const summary = await getEpisodeImageGenerationSummary(episodeId)
            const progress = getImageGenerationProgress(summary)
            await updateEpisode(episodeId, userId, 'imaging', progress)
        }

        const finalEpisodeState = await prisma.episode.findUnique({
            where: { id: episodeId },
            select: { status: true },
        })

        if (finalEpisodeState?.status === 'error') {
            console.warn(`[Pipeline] Episode ${episodeId} cancelled before completion state update.`)
            return
        }

        const summary = await getEpisodeImageGenerationSummary(episodeId)

        if (summary.remainingPanels === 0) {
            if (!isChildInvocation) {
                await recordPipelineEvent({
                    episodeId,
                    userId,
                    step: 'image_gen',
                    status: 'completed',
                    metadata: {
                        completedPanels,
                        failedPanels,
                        remainingPanels: summary.remainingPanels,
                    },
                })
            }
            await updateEpisode(episodeId, userId, 'done', 100)
            console.log(`[Pipeline] Complete! ${completedPanels} panels generated, ${failedPanels} failed.`)
        } else if (summary.activePanels === 0) {
            if (!isChildInvocation) {
                await recordPipelineEvent({
                    episodeId,
                    userId,
                    step: 'image_gen',
                    status: 'completed',
                    metadata: {
                        completedPanels,
                        failedPanels,
                        remainingPanels: summary.remainingPanels,
                    },
                })
            }
            await updateEpisode(episodeId, userId, 'review_storyboard', 50)
            console.log(`[Pipeline] Partial: ${completedPanels} done, ${summary.remainingPanels} remaining.`)
        }

    } catch (err) {
        console.error('[Pipeline] Image gen step error:', err)
        const episode = await prisma.episode.findUnique({
            where: { id: episodeId },
            include: { project: { select: { userId: true } } },
        })
        if (episode?.project.userId) {
            await setEpisodeError(episodeId, episode.project.userId, err, 'image_gen')
        }
        throw err
    }
}

// ── Helpers ──

async function getEpisodeImageGenerationSummary(episodeId: string) {
    const [totalPanels, completedPanels, failedPanels, contentFilteredPanels, activePanels, remainingPanels] = await Promise.all([
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
            },
        }),
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
                status: 'done',
            },
        }),
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
                status: 'error',
                imageUrl: null,
            },
        }),
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
                status: 'content_filtered',
            },
        }),
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
                imageUrl: null,
                status: { in: ['queued', 'pending', 'generating'] },
            },
        }),
        prisma.panel.count({
            where: {
                page: { episodeId },
                approved: true,
                imageUrl: null,
                status: { notIn: ['content_filtered', 'done'] },
            },
        }),
    ])

    return {
        totalPanels,
        completedPanels,
        failedPanels,
        contentFilteredPanels,
        activePanels,
        remainingPanels,
    }
}

function getImageGenerationProgress(summary: Awaited<ReturnType<typeof getEpisodeImageGenerationSummary>>) {
    if (summary.totalPanels === 0) {
        return 100
    }

    const processedPanels =
        summary.completedPanels
        + summary.failedPanels
        + summary.contentFilteredPanels

    return 50 + Math.round((processedPanels / summary.totalPanels) * 45)
}

async function updateEpisode(
    episodeId: string,
    userId: string,
    status: string,
    progress: number,
    extra?: { currentPanel?: number; totalPanels?: number },
) {
    await prisma.episode.update({
        where: { id: episodeId },
        data: { status, progress },
    })
    await syncPipelineRunState({
        episodeId,
        userId,
        episodeStatus: status,
    })
    await emitProgress(episodeId, { status, progress, ...extra })
}

async function setEpisodeError(
    episodeId: string,
    userId: string,
    err: unknown,
    step?: string,
) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error'

    await prisma.episode.update({
        where: { id: episodeId },
        data: {
            status: 'error',
            error: message,
        },
    }).catch(console.error)

    await syncPipelineRunState({
        episodeId,
        userId,
        episodeStatus: 'error',
        runStatus: 'failed',
        currentStep: step ?? null,
        error: message,
        completedAt: new Date(),
    })

    if (step) {
        await recordPipelineEvent({
            episodeId,
            userId,
            step,
            status: 'failed',
            metadata: { error: message },
        })
    }

    await emitProgress(episodeId, { status: 'error', progress: 0, error: message })
}
