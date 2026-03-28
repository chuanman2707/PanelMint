'use client'

import { useState, useCallback } from 'react'

interface PageInfo {
    id: string
    pageIndex: number
    imageUrl: string | null
}

interface ExportBarProps {
    canvasRef: React.MutableRefObject<any>
    pages: PageInfo[]
    episodeName: string
}

export function ExportBar({ canvasRef, pages, episodeName }: ExportBarProps) {
    const [exporting, setExporting] = useState(false)

    const exportCurrentPNG = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
        downloadFile(dataUrl, `${episodeName}_page_${pages[0]?.pageIndex ?? 0 + 1}.png`)
    }, [canvasRef, episodeName, pages])

    const exportAllPDF = useCallback(async () => {
        setExporting(true)
        try {
            const { jsPDF } = await import('jspdf')
            const canvas = canvasRef.current
            if (!canvas) return

            // Generate current page as preview
            const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [800, 1100],
            })

            // For now, export single current page
            // Full multi-page export requires switching pages programmatically
            pdf.addImage(dataUrl, 'PNG', 0, 0, 800, 1100)

            pdf.save(`${episodeName}.pdf`)
        } catch (err) {
            console.error('PDF export failed:', err)
        } finally {
            setExporting(false)
        }
    }, [canvasRef, episodeName])

    return (
        <div className="flex items-center gap-3 py-2 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)] w-full">
            <span className="text-xs text-[var(--text-muted)]">Export:</span>

            <button
                onClick={exportCurrentPNG}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
            >
                PNG (current page)
            </button>

            <button
                onClick={exportAllPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
            >
                {exporting ? (
                    <>
                        <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Exporting...
                    </>
                ) : (
                    <>PDF</>
                )}
            </button>
        </div>
    )
}

function downloadFile(dataUrl: string, filename: string) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
