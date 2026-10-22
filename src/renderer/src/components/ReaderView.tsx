import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  Bookmark,
  DocumentRecord,
  PublicSettings,
  ReadingState,
  SavedTranslation,
  SettingsUpdate
} from '@shared/types'
import { pdfjsLib } from '@renderer/lib/pdf'
import {
  firstVisibleWordInPage,
  selectionInfoFromWindow,
  type TextSelectionInfo
} from '@renderer/lib/selection'
import { PdfPage } from './PdfPage'
import { BookmarksPanel } from './BookmarksPanel'
import { TranslationsSidebar } from './TranslationsSidebar'
import { TranslationPopover, type TranslationPopoverState } from './TranslationPopover'

interface PageDimensions {
  width: number
  height: number
}

interface ReaderViewProps {
  document: DocumentRecord
  settings: PublicSettings
  onBack: () => void
  onDocumentUpdate: (document: DocumentRecord) => void
  onUpdateSettings: (update: SettingsUpdate) => Promise<void>
  onOpenSettings: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.15

function cleanErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}

export function ReaderView({
  document,
  settings,
  onBack,
  onDocumentUpdate,
  onUpdateSettings,
  onOpenSettings
}: ReaderViewProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [dimensions, setDimensions] = useState<PageDimensions[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [readingState, setReadingState] = useState<ReadingState | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [translations, setTranslations] = useState<SavedTranslation[]>([])
  const [translationMode, setTranslationMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [popover, setPopover] = useState<TranslationPopoverState | null>(null)
  const [immersive, setImmersive] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const restoredRef = useRef(false)
  const currentPageRef = useRef(1)
  const saveTimerRef = useRef<number | null>(null)

  const registerPageRef = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    if (element) pageRefs.current.set(pageNumber, element)
    else pageRefs.current.delete(pageNumber)
  }, [])

  useEffect(() => {
    let cancelled = false
    restoredRef.current = false
    pageRefs.current.clear()
    setPdf(null)
    setDimensions([])
    setLoadError(null)
    setCurrentPage(1)
    currentPageRef.current = 1

    const task = pdfjsLib.getDocument({ url: `pdfreader://document/${document.id}` })
    task.promise
      .then(async (loaded) => {
        if (cancelled) {
          return
        }
        const pageDimensions: PageDimensions[] = []
        for (let pageNumber = 1; pageNumber <= loaded.numPages; pageNumber += 1) {
          const page = await loaded.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1 })
          pageDimensions.push({ width: viewport.width, height: viewport.height })
          if (cancelled) return
        }
        if (cancelled) return
        setPdf(loaded)
        setDimensions(pageDimensions)
        if (loaded.numPages !== document.pageCount) {
          const updated = await window.pdfReader.library.setPageCount(document.id, loaded.numPages)
          if (updated && !cancelled) onDocumentUpdate(updated)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(cleanErrorMessage(error))
      })

    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [document.id, onDocumentUpdate])

  useEffect(() => {
    let cancelled = false
    void window.pdfReader.reading.get(document.id).then((state) => {
      if (!cancelled) setReadingState(state)
    })
    void window.pdfReader.bookmarks.list(document.id).then((list) => {
      if (!cancelled) setBookmarks(list)
    })
    void window.pdfReader.translations.list(document.id).then((list) => {
      if (!cancelled) setTranslations(list)
    })
    return () => {
      cancelled = true
    }
  }, [document.id])

  useEffect(() => {
    if (!pdf || dimensions.length === 0 || restoredRef.current) return
    restoredRef.current = true
    const page = readingState?.page ?? 1
    const offset = readingState?.scrollOffset ?? 0
    const timer = window.setTimeout(() => {
      const container = scrollRef.current
      const element = pageRefs.current.get(page)
      if (container && element) {
        container.scrollTop = element.offsetTop + offset * element.offsetHeight
        currentPageRef.current = page
        setCurrentPage(page)
      }
    }, 140)
    return () => window.clearTimeout(timer)
  }, [pdf, dimensions, readingState])

  const scrollToAnchor = useCallback((page: number, wordIndex: number | null) => {
    const container = scrollRef.current
    const pageElement = pageRefs.current.get(page)
    if (!container || !pageElement) return
    let targetTop = pageElement.offsetTop - 12
    if (wordIndex != null) {
      const wordElement = pageElement.querySelector<HTMLElement>(
        `[data-word-index="${wordIndex}"]`
      )
      if (wordElement) {
        const containerRect = container.getBoundingClientRect()
        const wordRect = wordElement.getBoundingClientRect()
        targetTop = container.scrollTop + (wordRect.top - containerRect.top) - 140
      }
    }
    container.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' })
    currentPageRef.current = page
    setCurrentPage(page)
  }, [])

  const goToPage = useCallback(
    (page: number) => {
      const total = pdf?.numPages ?? 1
      const clamped = Math.min(Math.max(page, 1), total)
      const container = scrollRef.current
      const element = pageRefs.current.get(clamped)
      if (container && element) {
        container.scrollTo({ top: Math.max(element.offsetTop - 12, 0), behavior: 'smooth' })
      }
      currentPageRef.current = clamped
      setCurrentPage(clamped)
    },
    [pdf]
  )

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container || dimensions.length === 0) return
    let visiblePage = 1
    for (const [pageNumber, element] of pageRefs.current) {
      if (element.offsetTop <= container.scrollTop + 80) {
        visiblePage = Math.max(visiblePage, pageNumber)
      }
    }
    if (visiblePage !== currentPageRef.current) {
      currentPageRef.current = visiblePage
      setCurrentPage(visiblePage)
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      const element = pageRefs.current.get(visiblePage)
      if (!element) return
      const offset = Math.min(
        Math.max((container.scrollTop - element.offsetTop) / element.offsetHeight, 0),
        1
      )
      void window.pdfReader.reading.save({
        documentId: document.id,
        page: visiblePage,
        scrollOffset: offset,
        updatedAt: Date.now()
      })
    }, 500)
  }, [dimensions.length, document.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const element = pageRefs.current.get(currentPageRef.current)
      if (element && scrollRef.current) {
        scrollRef.current.scrollTop = element.offsetTop - 12
      }
    }, 160)
    return () => window.clearTimeout(timer)
  }, [scale])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (popover) setPopover(null)
      else if (immersive) setImmersive(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [popover, immersive])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const step = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP
      setScale((value) =>
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((value + step).toFixed(2))))
      )
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  const handleTranslateSelection = useCallback(async (info: TextSelectionInfo) => {
    setPopover({
      text: info.text,
      page: info.page,
      wordIndex: info.wordIndex,
      rect: info.rect,
      loading: true,
      error: null,
      result: null
    })
    try {
      const result = await window.pdfReader.translate({ text: info.text })
      setPopover((previous) =>
        previous && previous.text === info.text
          ? { ...previous, loading: false, result }
          : previous
      )
    } catch (error) {
      const message = cleanErrorMessage(error)
      setPopover((previous) =>
        previous ? { ...previous, loading: false, error: message } : previous
      )
    }
  }, [])

  const handleSaveTranslation = async () => {
    if (!popover?.result) return
    const saved = await window.pdfReader.translations.save({
      documentId: document.id,
      page: popover.page,
      sourceText: popover.text,
      translatedText: popover.result.translatedText,
      provider: popover.result.provider,
      detectedSourceLanguage: popover.result.detectedSourceLanguage,
      anchorText: popover.text.length <= 90 ? popover.text : null,
      wordIndex: popover.wordIndex
    })
    setTranslations((previous) => [saved, ...previous])
    setSidebarCollapsed(false)
    setPopover(null)
  }

  const handleAddBookmark = async () => {
    const selection = selectionInfoFromWindow()
    let page = currentPageRef.current
    let wordIndex: number | null = null
    let anchorText: string | null = null

    if (selection) {
      page = selection.page
      wordIndex = selection.wordIndex
      anchorText = selection.text.slice(0, 140)
    } else {
      const pageElement = pageRefs.current.get(page)
      if (pageElement) {
        const found = firstVisibleWordInPage(pageElement)
        if (found != null) {
          wordIndex = found
          const wordElement = pageElement.querySelector<HTMLElement>(
            `[data-word-index="${found}"]`
          )
          anchorText = wordElement?.textContent ?? null
        }
      }
    }

    const bookmark = await window.pdfReader.bookmarks.add({
      documentId: document.id,
      page,
      label: anchorText ?? `Página ${page}`,
      anchorText,
      wordIndex
    })
    setBookmarks((previous) => [...previous, bookmark])
    setBookmarksOpen(true)
    window.getSelection()?.removeAllRanges()
  }

  const handleJumpToBookmark = (bookmark: Bookmark) => {
    scrollToAnchor(bookmark.page, bookmark.wordIndex)
  }

  const handleJumpToTranslation = (translation: SavedTranslation) => {
    scrollToAnchor(translation.page, translation.wordIndex)
  }

  const handleRemoveBookmark = async (bookmark: Bookmark) => {
    await window.pdfReader.bookmarks.remove(bookmark.id)
    setBookmarks((previous) => previous.filter((item) => item.id !== bookmark.id))
  }

  const handleRemoveTranslation = async (translation: SavedTranslation) => {
    await window.pdfReader.translations.remove(translation.id)
    setTranslations((previous) => previous.filter((item) => item.id !== translation.id))
  }

  const handleSelectionMouseDown = () => {
    if (popover) setPopover(null)
  }

  useEffect(() => {
    if (!translationMode) setPopover(null)
  }, [translationMode])

  const totalPages = pdf?.numPages ?? document.pageCount ?? 0
  const zoomPercent = Math.round(scale * 100)

  if (loadError) {
    return (
      <div className="reader">
        <header className="toolbar">
          <button className="btn ghost" onClick={onBack}>
            ← Biblioteca
          </button>
          <div className="doc-title">{document.title}</div>
        </header>
        <div className="empty-state">
          <h2>Não foi possível abrir o PDF</h2>
          <p className="error-text">{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`reader ${immersive ? 'immersive' : ''}`}>
      <header className="toolbar">
        <button className="btn ghost" onClick={onBack}>
          ← Biblioteca
        </button>
        <div className="doc-title" title={document.title}>
          {document.title}
        </div>

        <div className="toolbar-group">
          <button
            className="btn ghost icon"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Página anterior"
          >
            ‹
          </button>
          <span className="page-indicator">
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '…'}
          </span>
          <button
            className="btn ghost icon"
            onClick={() => goToPage(currentPage + 1)}
            disabled={totalPages > 0 && currentPage >= totalPages}
            title="Próxima página"
          >
            ›
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="btn ghost icon"
            onClick={() => setScale((value) => Math.max(MIN_SCALE, Number((value - SCALE_STEP).toFixed(2))))}
            title="Diminuir zoom"
          >
            −
          </button>
          <span className="page-indicator">{zoomPercent}%</span>
          <button
            className="btn ghost icon"
            onClick={() => setScale((value) => Math.min(MAX_SCALE, Number((value + SCALE_STEP).toFixed(2))))}
            title="Aumentar zoom"
          >
            +
          </button>
        </div>

        <div className="toolbar-spacer" />

        <button className="btn" onClick={handleAddBookmark} disabled={!pdf}>
          + Marcador
        </button>
        <button
          className={`btn ${translationMode ? 'active' : ''}`}
          onClick={() => setTranslationMode((value) => !value)}
          disabled={!pdf}
          title="Selecione uma palavra ou frase para traduzir"
        >
          Tradução
        </button>
        <button
          className={`btn ${!sidebarCollapsed ? 'active' : ''}`}
          onClick={() => setSidebarCollapsed((value) => !value)}
          title="Traduções salvas"
        >
          Traduções ({translations.length})
        </button>
        <button
          className={`btn ${bookmarksOpen ? 'active' : ''}`}
          onClick={() => setBookmarksOpen((value) => !value)}
          title="Marcadores"
        >
          Marcadores ({bookmarks.length})
        </button>
        <button
          className={`btn ghost icon ${immersive ? 'active' : ''}`}
          onClick={() => setImmersive(true)}
          title="Tela cheia do texto (Esc para sair)"
        >
          ⛶
        </button>
        <button
          className="btn ghost icon"
          onClick={() => void onUpdateSettings({ darkMode: !settings.darkMode })}
          title={settings.darkMode ? 'Desativar modo escuro' : 'Ativar modo escuro'}
        >
          {settings.darkMode ? '☾' : '☀'}
        </button>
        <button className="btn ghost icon" onClick={onOpenSettings} title="Configurações">
          ⚙
        </button>
      </header>

      <div className="reader-body">
        <TranslationsSidebar
          translations={translations}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarCollapsed(true)}
          onJump={handleJumpToTranslation}
          onRemove={(translation) => void handleRemoveTranslation(translation)}
        />

        <div
          className="reader-scroll"
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleSelectionMouseDown}
        >
          {!pdf && (
            <div className="empty-state">
              <span className="spinner" /> Carregando documento…
            </div>
          )}
          <div className="pages">
            {pdf &&
              dimensions.map((_dimension, index) => (
                <PdfPage
                  key={index + 1}
                  pdf={pdf}
                  pageNumber={index + 1}
                  scale={scale}
                  darkMode={settings.darkMode}
                  darkPreset={settings.darkPreset}
                  pageBgColor={settings.pageBgColor}
                  pageTextColor={settings.pageTextColor}
                  translationMode={translationMode}
                  registerRef={registerPageRef}
                  onTranslateSelection={(info) => void handleTranslateSelection(info)}
                />
              ))}
          </div>
        </div>

        {bookmarksOpen && (
          <BookmarksPanel
            bookmarks={bookmarks}
            onClose={() => setBookmarksOpen(false)}
            onJump={handleJumpToBookmark}
            onRemove={(bookmark) => void handleRemoveBookmark(bookmark)}
          />
        )}
      </div>

      {immersive && (
        <>
          <button
            className="btn ghost immersive-exit"
            onClick={() => setImmersive(false)}
            title="Sair da tela cheia (Esc)"
          >
            ✕ Sair da tela cheia
          </button>
          <div className="immersive-hud">
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '…'}
          </div>
        </>
      )}

      {popover && (
        <TranslationPopover
          state={popover}
          onClose={() => setPopover(null)}
          onSave={() => void handleSaveTranslation()}
        />
      )}
    </div>
  )
}
