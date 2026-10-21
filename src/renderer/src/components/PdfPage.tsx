import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfjsLib } from '@renderer/lib/pdf'
import { selectionInfoFromWindow, type TextSelectionInfo } from '@renderer/lib/selection'

interface PdfPageProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  darkMode: boolean
  darkPreset: 'soft' | 'contrast'
  translationMode: boolean
  registerRef: (pageNumber: number, element: HTMLDivElement | null) => void
  onTranslateSelection: (info: TextSelectionInfo) => void
}

const DEFAULT_WIDTH = 612
const DEFAULT_HEIGHT = 792

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  darkMode,
  darkPreset,
  translationMode,
  registerRef,
  onTranslateSelection
}: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    startedRef.current = false
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const render = async () => {
      if (startedRef.current) return
      startedRef.current = true
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) {
          startedRef.current = false
          return
        }
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) {
          startedRef.current = false
          return
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        setSize({ width: viewport.width, height: viewport.height })

        const renderTask = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
        })
        await renderTask.promise
        if (cancelled) {
          startedRef.current = false
          return
        }

        const textContent = await page.getTextContent()
        if (cancelled) {
          startedRef.current = false
          return
        }
        const container = textLayerRef.current
        if (!container) {
          startedRef.current = false
          return
        }
        container.innerHTML = ''
        container.style.setProperty('--total-scale-factor', String(viewport.scale))
        container.style.setProperty('--scale-factor', String(viewport.scale))

        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container,
          viewport
        })
        await textLayer.render()
        if (cancelled) {
          startedRef.current = false
          return
        }

        for (const div of textLayer.textDivs) {
          const raw = div.textContent ?? ''
          if (!raw) continue
          div.textContent = ''
          const parts = raw.split(/(\s+)/)
          let wordIndex = 0
          for (const part of parts) {
            if (!part) continue
            if (/^\s+$/.test(part)) {
              div.appendChild(document.createTextNode(part))
              continue
            }
            const span = document.createElement('span')
            span.className = 'pdf-word'
            span.dataset.wordIndex = String(wordIndex)
            span.textContent = part
            div.appendChild(span)
            wordIndex += 1
          }
        }
      } catch (error) {
        startedRef.current = false
        if (!cancelled) {
          console.error(`Falha ao renderizar a página ${pageNumber}`, error)
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void render()
        }
      },
      { root: null, rootMargin: '1400px 0px 1400px 0px', threshold: 0 }
    )
    observer.observe(wrapper)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [pdf, pageNumber, scale])

  const handleMouseUp = () => {
    if (!translationMode) return
    const info = selectionInfoFromWindow()
    if (info && info.page === pageNumber) onTranslateSelection(info)
  }

  const width = size?.width ?? DEFAULT_WIDTH * scale
  const height = size?.height ?? DEFAULT_HEIGHT * scale
  const darkClass = darkMode ? (darkPreset === 'contrast' ? 'dark-contrast' : 'dark-soft') : ''

  return (
    <div
      ref={(element) => {
        wrapperRef.current = element
        registerRef(pageNumber, element)
      }}
      data-page-number={pageNumber}
      className={`pdf-page ${darkClass}`}
      style={{ width, height }}
      onMouseUp={handleMouseUp}
    >
      {!size && (
        <div className="page-placeholder" style={{ width, height }}>
          Página {pageNumber}
        </div>
      )}
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  )
}
