'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { BubbleToolbar } from './BubbleToolbar'
import { ExportBar } from './ExportBar'
import { DialoguePanel } from './DialoguePanel'

interface BubbleData {
    id?: string
    bubbleIndex: number
    speaker: string | null
    content: string
    bubbleType: string
    positionX: number
    positionY: number
    width: number
    height: number
}

interface PanelInfo {
    id: string
    panelIndex: number
    description: string | null
    bubbles: BubbleData[]
}

interface PageInfo {
    id: string
    pageIndex: number
    imageUrl: string | null
    summary: string | null
    dialogue: { speaker: string | null; text: string }[]
    panels: PanelInfo[]
}

interface CanvasEditorProps {
    episodeId: string
    episodeName: string
    pages: PageInfo[]
}

// Canvas dimensions
const CANVAS_W = 800
const CANVAS_H = 1100

export function CanvasEditor({ episodeId, episodeName, pages }: CanvasEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<any>(null)
    const [currentPageIdx, setCurrentPageIdx] = useState(0)
    const [saving, setSaving] = useState(false)
    const [selectedObj, setSelectedObj] = useState<any>(null)
    const canvasContainerRef = useRef<HTMLDivElement>(null)

    const currentPage = pages[currentPageIdx]

    // Track which dialogues are already used as bubbles on the current canvas
    const usedTexts = useMemo(() => {
        const texts = new Set<string>()
        const allBubbles = currentPage?.panels.flatMap(p => p.bubbles) || []
        for (const b of allBubbles) {
            texts.add(b.content.slice(0, 30))
        }
        return texts
    }, [currentPage])


    // Initialize Fabric canvas
    useEffect(() => {
        let mounted = true

        async function init() {
            const fabric = await import('fabric')
            if (!mounted || !canvasRef.current) return

            const canvas = new fabric.Canvas(canvasRef.current, {
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundColor: '#1a1a1a',
                selection: true,
            })

            canvas.on('selection:created', (e: any) => setSelectedObj(e.selected?.[0] || null))
            canvas.on('selection:updated', (e: any) => setSelectedObj(e.selected?.[0] || null))
            canvas.on('selection:cleared', () => setSelectedObj(null))

            // Auto-save on object move/scale
            canvas.on('object:modified', () => {
                saveBubblesFromCanvas(canvas, currentPage)
            })

            fabricRef.current = canvas
            loadPage(canvas, currentPage)
        }

        init()

        return () => {
            mounted = false
            if (fabricRef.current) {
                fabricRef.current.dispose()
                fabricRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load page when switching
    useEffect(() => {
        if (fabricRef.current && currentPage) {
            loadPage(fabricRef.current, currentPage)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageIdx])

    const loadPage = useCallback(async (canvas: any, page: PageInfo) => {
        const fabric = await import('fabric')
        canvas.clear()
        canvas.backgroundColor = '#1a1a1a'

        // Load page image as background
        if (page.imageUrl) {
            try {
                const img = await fabric.FabricImage.fromURL(page.imageUrl, { crossOrigin: 'anonymous' })
                const scale = Math.min(CANVAS_W / img.width!, CANVAS_H / img.height!)
                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    left: (CANVAS_W - img.width! * scale) / 2,
                    top: (CANVAS_H - img.height! * scale) / 2,
                    selectable: false,
                    evented: false,
                    hoverCursor: 'default',
                })
                canvas.add(img)
                canvas.sendObjectToBack(img)
            } catch (err) {
                console.error('Failed to load page image:', err)
            }
        }

        // Load existing bubbles
        const allBubbles = page.panels.flatMap((p) => p.bubbles)
        for (const bubble of allBubbles) {
            addBubbleToCanvas(canvas, bubble)
        }

        canvas.renderAll()
    }, [])

    const addBubbleToCanvas = async (canvas: any, bubble: BubbleData) => {
        const fabric = await import('fabric')

        const x = bubble.positionX * CANVAS_W
        const y = bubble.positionY * CANVAS_H
        const w = Math.max(bubble.width * CANVAS_W, 100)
        const pad = 14

        const speakerLine = bubble.speaker ? `${bubble.speaker}\n` : ''
        const fullText = speakerLine + bubble.content

        if (bubble.bubbleType === 'sfx') {
            // SFX: Standalone bold text, no background shape
            const textbox = new fabric.Textbox(fullText, {
                left: x - w / 2,
                top: y - 20,
                width: w,
                fontSize: 28,
                fontWeight: 'bold',
                fontFamily: 'Impact, Arial Black, sans-serif',
                fill: '#ffffff',
                textAlign: 'center',
                splitByGrapheme: true,
                paintFirst: 'stroke',
                stroke: '#000000',
                strokeWidth: 3,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 6, offsetX: 2, offsetY: 2 }),
            })
                ; (textbox as any).__bubbleData = { ...bubble, _originalType: bubble.bubbleType }
            textbox.on('changed', () => {
                const page = pages[currentPageIdx]
                if (page) saveBubblesFromCanvas(canvas, page)
            })
            canvas.add(textbox)
            return
        }

        // Determine style based on bubble type
        let fillColor = 'rgba(255, 255, 255, 0.95)'
        let strokeColor = 'rgba(0, 0, 0, 0.2)'
        let textColor = '#111111'
        let fontStyle: 'normal' | 'italic' = 'normal'

        if (bubble.bubbleType === 'thought') {
            fillColor = 'rgba(240, 235, 255, 0.94)'
            strokeColor = 'rgba(120, 100, 200, 0.35)'
            textColor = '#2a2a3a'
            fontStyle = 'italic'
        } else if (bubble.bubbleType === 'narration') {
            fillColor = 'rgba(15, 15, 15, 0.88)'
            strokeColor = 'rgba(255, 255, 255, 0.1)'
            textColor = '#ffffff'
            fontStyle = 'italic'
        }

        // Create textbox first to measure height
        const textbox = new fabric.Textbox(fullText, {
            left: x - w / 2 + pad,
            top: y + pad,
            width: w - pad * 2,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
            fontStyle,
            fill: textColor,
            textAlign: 'center',
            splitByGrapheme: true,
        })

        const textH = textbox.height || 30
        let bgShape: any
        let tail: any = null

        if (bubble.bubbleType === 'narration') {
            // Narration: Rectangle with slight rounding (caption box style)
            bgShape = new fabric.Rect({
                left: x - w / 2,
                top: y,
                width: w,
                height: textH + pad * 2,
                fill: fillColor,
                rx: 4,
                ry: 4,
                stroke: strokeColor,
                strokeWidth: 1,
                selectable: false,
                evented: false,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 6, offsetX: 0, offsetY: 2 }),
            })
        } else {
            // Speech / Thought: Ellipse (oval bubble)
            const ellipseRx = w / 2 + 10
            const ellipseRy = (textH + pad * 2) / 2 + 6
            bgShape = new fabric.Ellipse({
                left: x - ellipseRx,
                top: y - 6,
                rx: ellipseRx,
                ry: ellipseRy,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: 1.5,
                selectable: false,
                evented: false,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 10, offsetX: 0, offsetY: 3 }),
            })

            if (bubble.bubbleType === 'speech') {
                // Speech tail: triangle pointing down-left
                const tailY = y - 6 + ellipseRy * 2 - 6
                tail = new fabric.Path(
                    `M 0 0 Q 8 18 -6 22 Q 2 14 12 0 Z`,
                    {
                        left: x - 8,
                        top: tailY,
                        fill: fillColor,
                        stroke: strokeColor,
                        strokeWidth: 1,
                        selectable: false,
                        evented: false,
                    }
                )
            } else {
                // Thought: Small circles trailing down
                const circleY = y - 6 + ellipseRy * 2
                const c1 = new fabric.Circle({
                    left: x - 6,
                    top: circleY,
                    radius: 5,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                })
                const c2 = new fabric.Circle({
                    left: x - 12,
                    top: circleY + 12,
                    radius: 3,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                })
                // Group the small circles as the tail
                tail = { type: 'thought_dots', c1, c2 }
            }
        }

        // Link textbox to bg shape
        ; (textbox as any).__linkedRect = bgShape
            ; (textbox as any).__linkedTail = tail
            ; (textbox as any).__bubbleData = { ...bubble, _originalType: bubble.bubbleType }

        const syncShapeToTextbox = () => {
            const tLeft = textbox.left || 0
            const tTop = textbox.top || 0
            const tW = (textbox.width || w) * (textbox.scaleX || 1)
            const tH = (textbox.height || 30) * (textbox.scaleY || 1)
            const centerX = tLeft + tW / 2

            if (bubble.bubbleType === 'narration') {
                bgShape.set({
                    left: tLeft - pad,
                    top: tTop - pad,
                    width: tW + pad * 2,
                    height: tH + pad * 2,
                    scaleX: 1,
                    scaleY: 1,
                })
            } else {
                const eRx = tW / 2 + pad + 10
                const eRy = tH / 2 + pad + 6
                bgShape.set({
                    left: centerX - eRx,
                    top: tTop + tH / 2 - eRy,
                    rx: eRx,
                    ry: eRy,
                })
            }
            bgShape.setCoords()

            if (tail) {
                if (tail.type === 'thought_dots') {
                    const bBottom = (bgShape.top || 0) + (bgShape.ry ? bgShape.ry * 2 : bgShape.height || 0)
                    tail.c1.set({ left: centerX - 6, top: bBottom })
                    tail.c2.set({ left: centerX - 12, top: bBottom + 12 })
                    tail.c1.setCoords()
                    tail.c2.setCoords()
                } else {
                    const bBottom = (bgShape.top || 0) + (bgShape.ry ? bgShape.ry * 2 : bgShape.height || 0) - 6
                    tail.set({ left: centerX - 8, top: bBottom })
                    tail.setCoords()
                }
            }
        }

        textbox.on('moving', syncShapeToTextbox)
        textbox.on('scaling', syncShapeToTextbox)
        textbox.on('changed', () => {
            syncShapeToTextbox()
            canvas.renderAll()
            const page = pages[currentPageIdx]
            if (page) saveBubblesFromCanvas(canvas, page)
        })

        canvas.add(bgShape)
        if (tail) {
            if (tail.type === 'thought_dots') {
                canvas.add(tail.c1)
                canvas.add(tail.c2)
            } else {
                canvas.add(tail)
            }
        }
        canvas.add(textbox)
    }

    const handleAddBubble = useCallback(async (type: string) => {
        if (!fabricRef.current) return
        const canvas = fabricRef.current

        const newBubble: BubbleData = {
            bubbleIndex: Date.now(),
            speaker: type === 'narration' || type === 'sfx' ? null : '',
            content: type === 'sfx' ? 'BOOM!' : 'Nhập text...',
            bubbleType: type,
            positionX: 0.5,
            positionY: 0.4,
            width: type === 'sfx' ? 0.2 : 0.28,
            height: 0.08,
        }

        await addBubbleToCanvas(canvas, newBubble)
        canvas.renderAll()
    }, [currentPageIdx, pages])

    const handleDeleteSelected = useCallback(() => {
        if (!fabricRef.current || !selectedObj) return
        const canvas = fabricRef.current
        // Also remove linked rect and tail
        if (selectedObj.__linkedRect) canvas.remove(selectedObj.__linkedRect)
        const t = selectedObj.__linkedTail
        if (t) {
            if (t.type === 'thought_dots') {
                canvas.remove(t.c1)
                canvas.remove(t.c2)
            } else {
                canvas.remove(t)
            }
        }
        canvas.remove(selectedObj)
        setSelectedObj(null)
        canvas.renderAll()
        saveBubblesFromCanvas(canvas, currentPage)
    }, [selectedObj, currentPage])

    const saveBubblesFromCanvas = async (canvas: any, page: PageInfo) => {
        setSaving(true)
        try {
            const objects = canvas.getObjects()
            const bubbles: BubbleData[] = []

            for (const obj of objects) {
                if (!(obj as any).__bubbleData) continue
                const data = (obj as any).__bubbleData
                const left = obj.left || 0
                const top = obj.top || 0
                const w = (obj.width || 80) * (obj.scaleX || 1)
                const h = (obj.height || 40) * (obj.scaleY || 1)

                bubbles.push({
                    ...data,
                    positionX: (left + w / 2) / CANVAS_W,
                    positionY: (top + h / 2) / CANVAS_H,
                    width: w / CANVAS_W,
                    height: h / CANVAS_H,
                })
            }

            const panelId = page.panels[0]?.id
            if (!panelId) return

            await fetch(`/api/editor/${page.id}/save-bubbles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ panelId, bubbles }),
            })
        } catch (err) {
            console.error('Save failed:', err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex h-full">
            {/* Left Sidebar — Page Selector */}
            <div className="w-48 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-y-auto">
                <div className="p-3 border-b border-[var(--border)]">
                    <a href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Quay lại
                    </a>
                    <h2 className="text-sm font-medium text-[var(--text-primary)] mt-2 truncate">{episodeName}</h2>
                </div>
                <div className="flex-1 p-2 space-y-2">
                    {pages.map((page, idx) => (
                        <button
                            key={page.id}
                            onClick={() => setCurrentPageIdx(idx)}
                            className={`w-full rounded-lg overflow-hidden border-2 transition-all ${idx === currentPageIdx
                                ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30'
                                : 'border-transparent hover:border-[var(--border)]'
                                }`}
                        >
                            {page.imageUrl ? (
                                <img src={page.imageUrl} alt={`Trang ${idx + 1}`} className="w-full h-auto" />
                            ) : (
                                <div className="w-full aspect-[3/4] bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                                    Trang {idx + 1}
                                </div>
                            )}
                            <div className="text-[10px] text-center py-1 text-[var(--text-muted)]">
                                Trang {idx + 1}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Center — Canvas */}
            <div className="flex-1 flex flex-col items-center bg-[#0d0d0d] overflow-auto">
                <BubbleToolbar
                    onAddBubble={handleAddBubble}
                    onDelete={handleDeleteSelected}
                    hasSelection={!!selectedObj}
                    saving={saving}
                />
                <div
                    ref={canvasContainerRef}
                    className="flex-1 flex items-center justify-center p-4"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                    onDrop={(e) => {
                        e.preventDefault()
                        try {
                            const data = JSON.parse(e.dataTransfer.getData('application/json'))
                            if (data && data.text) {
                                // Calculate drop position relative to canvas
                                const canvasEl = canvasRef.current
                                if (canvasEl) {
                                    const rect = canvasEl.getBoundingClientRect()
                                    const posX = (e.clientX - rect.left) / rect.width
                                    const posY = (e.clientY - rect.top) / rect.height
                                    const bubble: BubbleData = {
                                        bubbleIndex: Date.now(),
                                        speaker: data.speaker || null,
                                        content: data.text,
                                        bubbleType: data.type || 'speech',
                                        positionX: Math.max(0.1, Math.min(0.9, posX)),
                                        positionY: Math.max(0.1, Math.min(0.9, posY)),
                                        width: 0.28,
                                        height: 0.08,
                                    }
                                    addBubbleToCanvas(fabricRef.current, bubble)
                                    fabricRef.current?.renderAll()
                                }
                            }
                        } catch { /* ignore bad drag data */ }
                    }}
                >
                    <div className="shadow-2xl rounded-lg overflow-hidden">
                        <canvas ref={canvasRef} />
                    </div>
                </div>
                <ExportBar
                    canvasRef={fabricRef}
                    pages={pages}
                    episodeName={episodeName}
                />
            </div>

            {/* Right Sidebar — Dialogue Panel */}
            <DialoguePanel
                dialogues={currentPage?.dialogue || []}
                onAddDialogue={(speaker, text, type) => {
                    if (!fabricRef.current) return
                    const bubble: BubbleData = {
                        bubbleIndex: Date.now(),
                        speaker,
                        content: text,
                        bubbleType: type,
                        positionX: 0.5,
                        positionY: 0.4,
                        width: 0.28,
                        height: 0.08,
                    }
                    addBubbleToCanvas(fabricRef.current, bubble)
                    fabricRef.current.renderAll()
                }}
                usedTexts={usedTexts}
            />
        </div>
    )
}
