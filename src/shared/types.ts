export interface DocumentRecord {
  id: string
  title: string
  originalPath: string
  fileName: string
  pageCount: number
  fileSize: number
  sha256: string
  addedAt: number
  lastReadAt: number | null
}

export interface ReadingState {
  documentId: string
  page: number
  scrollOffset: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  documentId: string
  page: number
  label: string
  anchorText: string | null
  wordIndex: number | null
  createdAt: number
}

export interface SavedTranslation {
  id: string
  documentId: string
  page: number
  sourceText: string
  translatedText: string
  provider: string
  detectedSourceLanguage: string | null
  anchorText: string | null
  wordIndex: number | null
  createdAt: number
}

export type TranslationProviderId = 'google' | 'local'

export interface PublicSettings {
  provider: TranslationProviderId
  sourceLanguage: string
  targetLanguage: string
  darkMode: boolean
  darkPreset: 'soft' | 'contrast'
  hasGoogleApiKey: boolean
}

export interface SettingsUpdate {
  provider?: TranslationProviderId
  sourceLanguage?: string
  targetLanguage?: string
  darkMode?: boolean
  darkPreset?: 'soft' | 'contrast'
  googleApiKey?: string
}

export interface TranslateRequest {
  text: string
  sourceLanguage?: string
  targetLanguage?: string
}

export interface TranslateResult {
  translatedText: string
  provider: TranslationProviderId
  detectedSourceLanguage: string | null
  fromCache: boolean
}

export interface AddBookmarkInput {
  documentId: string
  page: number
  label: string
  anchorText: string | null
  wordIndex: number | null
}

export interface SaveTranslationInput {
  documentId: string
  page: number
  sourceText: string
  translatedText: string
  provider: string
  detectedSourceLanguage: string | null
  anchorText: string | null
  wordIndex: number | null
}

export interface ImportResult {
  document: DocumentRecord
  canceled: boolean
}

export interface PdfReaderApi {
  library: {
    list(): Promise<DocumentRecord[]>
    import(): Promise<DocumentRecord | null>
    remove(id: string): Promise<void>
    get(id: string): Promise<DocumentRecord | null>
    setPageCount(id: string, pageCount: number): Promise<DocumentRecord | null>
  }
  reading: {
    get(documentId: string): Promise<ReadingState | null>
    save(state: ReadingState): Promise<ReadingState>
  }
  bookmarks: {
    list(documentId: string): Promise<Bookmark[]>
    add(input: AddBookmarkInput): Promise<Bookmark>
    remove(id: string): Promise<void>
  }
  translations: {
    list(documentId: string): Promise<SavedTranslation[]>
    save(input: SaveTranslationInput): Promise<SavedTranslation>
    remove(id: string): Promise<void>
  }
  settings: {
    get(): Promise<PublicSettings>
    update(update: SettingsUpdate): Promise<PublicSettings>
  }
  translate(request: TranslateRequest): Promise<TranslateResult>
}

export const IPC = {
  libraryList: 'library:list',
  libraryImport: 'library:import',
  libraryRemove: 'library:remove',
  libraryGet: 'library:get',
  librarySetPageCount: 'library:set-page-count',
  readingGet: 'reading:get',
  readingSave: 'reading:save',
  bookmarksList: 'bookmarks:list',
  bookmarksAdd: 'bookmarks:add',
  bookmarksRemove: 'bookmarks:remove',
  translationsList: 'translations:list',
  translationsSave: 'translations:save',
  translationsRemove: 'translations:remove',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  translate: 'translate:run'
} as const
