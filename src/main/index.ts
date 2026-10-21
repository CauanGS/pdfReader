import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type {
  AddBookmarkInput,
  ReadingState,
  SaveTranslationInput,
  SettingsUpdate,
  TranslateRequest
} from '@shared/types'
import { IPC } from '@shared/types'
import { getDb } from './db'
import * as library from './library'
import * as settings from './settings'
import { translate } from './translation'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pdfreader',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function registerPdfProtocol(): void {
  protocol.handle('pdfreader', async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'document') {
      return new Response('Not found', { status: 404 })
    }
    const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const storedPath = library.getStoredPath(id)
    if (!storedPath) {
      return new Response('Not found', { status: 404 })
    }
    try {
      const body = Readable.toWeb(createReadStream(storedPath)) as unknown as ReadableStream
      return new Response(body, {
        headers: {
          'content-type': 'application/pdf',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function registerIpc(): void {
  ipcMain.handle(IPC.libraryList, () => library.listDocuments())
  ipcMain.handle(IPC.libraryImport, () => library.importDocument())
  ipcMain.handle(IPC.libraryRemove, (_event, id: string) => library.removeDocument(id))
  ipcMain.handle(IPC.libraryGet, (_event, id: string) => library.getDocument(id))
  ipcMain.handle(IPC.librarySetPageCount, (_event, id: string, pageCount: number) =>
    library.updatePageCount(id, pageCount)
  )
  ipcMain.handle(IPC.readingGet, (_event, documentId: string) => library.getReadingState(documentId))
  ipcMain.handle(IPC.readingSave, (_event, state: ReadingState) => library.saveReadingState(state))
  ipcMain.handle(IPC.bookmarksList, (_event, documentId: string) => library.listBookmarks(documentId))
  ipcMain.handle(IPC.bookmarksAdd, (_event, input: AddBookmarkInput) => library.addBookmark(input))
  ipcMain.handle(IPC.bookmarksRemove, (_event, id: string) => library.removeBookmark(id))
  ipcMain.handle(IPC.translationsList, (_event, documentId: string) =>
    library.listTranslations(documentId)
  )
  ipcMain.handle(IPC.translationsSave, (_event, input: SaveTranslationInput) =>
    library.saveTranslation(input)
  )
  ipcMain.handle(IPC.translationsRemove, (_event, id: string) => library.removeTranslation(id))
  ipcMain.handle(IPC.settingsGet, () => settings.getPublicSettings())
  ipcMain.handle(IPC.settingsUpdate, (_event, update: SettingsUpdate) => settings.updateSettings(update))
  ipcMain.handle(IPC.translate, (_event, request: TranslateRequest) => translate(request))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#101218',
    title: 'Leitor de PDF',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.on(
      'console-message',
      (_event, _level, message, lineNumber, sourceId) => {
        console.log(`[renderer] ${sourceId ?? ''}:${lineNumber ?? ''} ${message}`)
      }
    )
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  getDb()
  registerPdfProtocol()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
