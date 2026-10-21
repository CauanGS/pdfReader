export interface TextSelectionInfo {
  text: string
  page: number
  wordIndex: number | null
  rect: DOMRect
}

function elementFromNode(node: Node): HTMLElement | null {
  if (node instanceof HTMLElement) return node
  return node.parentElement
}

export function selectionInfoFromRange(range: Range): TextSelectionInfo | null {
  const text = range.toString().replace(/\s+/g, ' ').trim()
  if (!text) return null

  const startElement = elementFromNode(range.startContainer)
  const wordElement = startElement?.closest<HTMLElement>('[data-word-index]') ?? null
  const pageElement = startElement?.closest<HTMLElement>('[data-page-number]') ?? null
  const page = pageElement ? Number(pageElement.dataset.pageNumber) : NaN
  if (!Number.isFinite(page)) return null

  const wordIndex = wordElement ? Number(wordElement.dataset.wordIndex) : NaN
  const rect = range.getBoundingClientRect()

  return {
    text,
    page,
    wordIndex: Number.isFinite(wordIndex) ? wordIndex : null,
    rect
  }
}

export function selectionInfoFromWindow(): TextSelectionInfo | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  return selectionInfoFromRange(selection.getRangeAt(0))
}

export function firstVisibleWordInPage(pageElement: HTMLElement): number | null {
  const words = pageElement.querySelectorAll<HTMLElement>('[data-word-index]')
  const viewportHeight = window.innerHeight
  for (const word of words) {
    const rect = word.getBoundingClientRect()
    if (rect.bottom > 96 && rect.top < viewportHeight - 24) {
      return Number(word.dataset.wordIndex)
    }
  }
  const first = words.item(0)
  return first ? Number(first.dataset.wordIndex) : null
}
