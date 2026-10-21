import { contextBridge, ipcRenderer } from 'electron'
import type {
  PdfReaderApi,
  ReadingState,
  AddBookmarkInput,
  SaveTranslationInput,
  SettingsUpdate,
  TranslateRequest
} from '@shared/types'
import { IPC } from '@shared/types'

const api: PdfReaderApi = {
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    import: () => ipcRenderer.invoke(IPC.libraryImport),
    remove: (id: string) => ipcRenderer.invoke(IPC.libraryRemove, id),
    get: (id: string) => ipcRenderer.invoke(IPC.libraryGet, id),
    setPageCount: (id: string, pageCount: number) =>
      ipcRenderer.invoke(IPC.librarySetPageCount, id, pageCount)
  },
  reading: {
    get: (documentId: string) => ipcRenderer.invoke(IPC.readingGet, documentId),
    save: (state: ReadingState) => ipcRenderer.invoke(IPC.readingSave, state)
  },
  bookmarks: {
    list: (documentId: string) => ipcRenderer.invoke(IPC.bookmarksList, documentId),
    add: (input: AddBookmarkInput) => ipcRenderer.invoke(IPC.bookmarksAdd, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.bookmarksRemove, id)
  },
  translations: {
    list: (documentId: string) => ipcRenderer.invoke(IPC.translationsList, documentId),
    save: (input: SaveTranslationInput) => ipcRenderer.invoke(IPC.translationsSave, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.translationsRemove, id)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (update: SettingsUpdate) => ipcRenderer.invoke(IPC.settingsUpdate, update)
  },
  translate: (request: TranslateRequest) => ipcRenderer.invoke(IPC.translate, request)
}

contextBridge.exposeInMainWorld('pdfReader', api)
