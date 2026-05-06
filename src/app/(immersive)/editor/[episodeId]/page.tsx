import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { CanvasEditor } from '@/components/editor/CanvasEditor'
import { getOrCreateLocalUser } from '@/lib/local-user'

interface EditorPageProps {
    params: Promise<{ episodeId: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
    const { episodeId } = await params
    const user = await getOrCreateLocalUser()

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
        } catch {
            dialogue = []
        }

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
                bubbles: panel.bubbles.map((bubble) => ({
                    id: bubble.id,
                    bubbleIndex: bubble.bubbleIndex,
                    speaker: bubble.speaker,
                    content: bubble.content,
                    bubbleType: bubble.bubbleType,
                    positionX: bubble.positionX,
                    positionY: bubble.positionY,
                    width: bubble.width,
                    height: bubble.height,
                })),
            })),
        }
    })

    return (
        <main className="h-screen overflow-hidden bg-[var(--neo-bg-canvas)]">
            <CanvasEditor episodeId={episodeId} episodeName={episode.name} pages={pages} />
        </main>
    )
}
