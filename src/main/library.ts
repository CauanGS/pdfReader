import { app, dialog } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  AddBookmarkInput,
  Bookmark,
  DocumentRecord,
  ReadingState,
  SaveTranslationInput,
  SavedTranslation
} from '@shared/types'
import { getDb } from './db'

interface DocumentRow {
  id: string
  title: string
  original_path: string
  file_name: string
  stored_path: string
  page_count: number
  file_size: number
  sha256: string
  added_at: number
  last_read_at: number | null
}

function mapDocument(row: unknown): DocumentRecord {
  const r = row as DocumentRow
  return {
    id: r.id,
    title: r.title,
    originalPath: r.original_path,
    fileName: r.file_name,
    pageCount: r.page_count,
    fileSize: r.file_size,
    sha256: r.sha256,
    addedAt: r.added_at,
    lastReadAt: r.last_read_at
  }
}

export function listDocuments(): DocumentRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM documents ORDER BY COALESCE(last_read_at, added_at) DESC')
    .all()
  return rows.map(mapDocument)
}

export function getDocument(id: string): DocumentRecord | null {
  const row = getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id)
  return row ? mapDocument(row) : null
}

export function getStoredPath(id: string): string | null {
  const row = getDb().prepare('SELECT stored_path FROM documents WHERE id = ?').get(id) as
    | { stored_path: string }
    | undefined
  return row?.stored_path ?? null
}

export async function importDocument(): Promise<DocumentRecord | null> {
  const result = await dialog.showOpenDialog({
    title: 'Importar PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const sourcePath = result.filePaths[0]
  const buffer = await readFile(sourcePath)
  const sha256 = createHash('sha256').update(buffer).digest('hex')

  const existing = getDb().prepare('SELECT * FROM documents WHERE sha256 = ?').get(sha256)
  if (existing) return mapDocument(existing)

  const libraryDir = join(app.getPath('userData'), 'library')
  await mkdir(libraryDir, { recursive: true })
  const storedPath = join(libraryDir, `${sha256}.pdf`)
  await writeFile(storedPath, buffer)

  const id = randomUUID()
  const fileStat = await stat(sourcePath)
  const fileName = basename(sourcePath)
  const title = basename(sourcePath, extname(sourcePath))
  const addedAt = Date.now()

  getDb()
    .prepare(
      `INSERT INTO documents
        (id, title, original_path, file_name, stored_path, page_count, file_size, sha256, added_at, last_read_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`
    )
    .run(id, title, sourcePath, fileName, storedPath, fileStat.size, sha256, addedAt)

  return getDocument(id)
}

export async function removeDocument(id: string): Promise<void> {
  const storedPath = getStoredPath(id)
  getDb().prepare('DELETE FROM documents WHERE id = ?').run(id)
  if (storedPath) {
    await unlink(storedPath).catch(() => undefined)
  }
}

export function updatePageCount(id: string, pageCount: number): DocumentRecord | null {
  getDb().prepare('UPDATE documents SET page_count = ? WHERE id = ?').run(pageCount, id)
  return getDocument(id)
}

export function getReadingState(documentId: string): ReadingState | null {
  const row = getDb()
    .prepare('SELECT * FROM reading_state WHERE document_id = ?')
    .get(documentId) as
    | { document_id: string; page: number; scroll_offset: number; updated_at: number }
    | undefined
  if (!row) return null
  return {
    documentId: row.document_id,
    page: row.page,
    scrollOffset: row.scroll_offset,
    updatedAt: row.updated_at
  }
}

export function saveReadingState(state: ReadingState): ReadingState {
  const updatedAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO reading_state (document_id, page, scroll_offset, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(document_id) DO UPDATE SET
         page = excluded.page,
         scroll_offset = excluded.scroll_offset,
         updated_at = excluded.updated_at`
    )
    .run(state.documentId, state.page, state.scrollOffset, updatedAt)
  getDb().prepare('UPDATE documents SET last_read_at = ? WHERE id = ?').run(updatedAt, state.documentId)
  return { ...state, updatedAt }
}

export function listBookmarks(documentId: string): Bookmark[] {
  const rows = getDb()
    .prepare('SELECT * FROM bookmarks WHERE document_id = ? ORDER BY page ASC, created_at ASC')
    .all(documentId) as Array<{
    id: string
    document_id: string
    page: number
    label: string
    anchor_text: string | null
    word_index: number | null
    created_at: number
  }>
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    page: r.page,
    label: r.label,
    anchorText: r.anchor_text,
    wordIndex: r.word_index,
    createdAt: r.created_at
  }))
}

export function addBookmark(input: AddBookmarkInput): Bookmark {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO bookmarks (id, document_id, page, label, anchor_text, word_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.documentId, input.page, input.label, input.anchorText, input.wordIndex, Date.now())
  return {
    id,
    documentId: input.documentId,
    page: input.page,
    label: input.label,
    anchorText: input.anchorText,
    wordIndex: input.wordIndex,
    createdAt: Date.now()
  }
}

export function removeBookmark(id: string): void {
  getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
}

export function listTranslations(documentId: string): SavedTranslation[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM saved_translations WHERE document_id = ? ORDER BY created_at DESC'
    )
    .all(documentId) as Array<{
    id: string
    document_id: string
    page: number
    source_text: string
    translated_text: string
    provider: string
    detected_source_language: string | null
    anchor_text: string | null
    word_index: number | null
    created_at: number
  }>
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    page: r.page,
    sourceText: r.source_text,
    translatedText: r.translated_text,
    provider: r.provider,
    detectedSourceLanguage: r.detected_source_language,
    anchorText: r.anchor_text,
    wordIndex: r.word_index,
    createdAt: r.created_at
  }))
}

export function saveTranslation(input: SaveTranslationInput): SavedTranslation {
  const id = randomUUID()
  const createdAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO saved_translations
        (id, document_id, page, source_text, translated_text, provider, detected_source_language, anchor_text, word_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.documentId,
      input.page,
      input.sourceText,
      input.translatedText,
      input.provider,
      input.detectedSourceLanguage,
      input.anchorText,
      input.wordIndex,
      createdAt
    )
  return {
    id,
    documentId: input.documentId,
    page: input.page,
    sourceText: input.sourceText,
    translatedText: input.translatedText,
    provider: input.provider,
    detectedSourceLanguage: input.detectedSourceLanguage,
    anchorText: input.anchorText,
    wordIndex: input.wordIndex,
    createdAt
  }
}

export function removeTranslation(id: string): void {
  getDb().prepare('DELETE FROM saved_translations WHERE id = ?').run(id)
}
