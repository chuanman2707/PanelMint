import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { CanvasEditor } from '@/components/editor/CanvasEditor'
import { requirePageSession } from '@/lib/api-auth'

interface EditorPageProps {
    params: Promise<{ episodeId: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
    const { episodeId } = await params
    const user = await requirePageSession(`/editor/${episodeId}`)

    const episode = await prisma.episode.findFirst({
        where: {
            id: episodeId,
            project: { userId: user.id },
        },
        include: {
            project: true,
            pages: {
                orderBy: { pageIndex: 'asc' },
                include: {
                    panels: {
                        orderBy: { panelIndex: 'asc' },
                        include: {
                            bubbles: {
                                orderBy: { bubbleIndex: 'asc' },
                            },
                        },
                    },
                },
            },
        },
    })

    if (!episode) notFound()

    const pages = episode.pages.map((page) => {
        let dialogue: { speaker: string | null; text: string }[] = []
        try {
            if (page.screenplay) dialogue = JSON.parse(page.screenplay)
        } catch { /* ignore parse errors */ }

        return {
            id: page.id,
            pageIndex: page.pageIndex,
            imageUrl: page.imageUrl,
            summary: page.summary,
            dialogue,
            panels: page.panels.map((panel) => ({
                id: panel.id,
                panelIndex: panel.panelIndex,
                description: panel.description,
                bubbles: panel.bubbles.map((b) => ({
                    id: b.id,
                    bubbleIndex: b.bubbleIndex,
                    speaker: b.speaker,
                    content: b.content,
                    bubbleType: b.bubbleType,
                    positionX: b.positionX,
                    positionY: b.positionY,
                    width: b.width,
                    height: b.height,
                })),
            })),
        }
    })

    return (
        <main className="h-screen overflow-hidden bg-[var(--weo-bg-canvas)]">
            <CanvasEditor
                episodeId={episodeId}
                episodeName={episode.name}
                pages={pages}
            />
        </main>
    )
}
