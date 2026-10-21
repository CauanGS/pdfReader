import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
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
    const docId = process.env.PDFREADER_OPEN
    const url = docId
      ? `${process.env.ELECTRON_RENDERER_URL}/?doc=${encodeURIComponent(docId)}`
      : process.env.ELECTRON_RENDERER_URL
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env.PDFREADER_SHOT) {
    const shot = process.env.PDFREADER_SHOT
    mainWindow.once('ready-to-show', () => mainWindow?.show())
    void mainWindow.webContents
      .executeJavaScript(
        `(async () => {
          try {
            const waitFor = async (predicate, timeout) => {
              const start = Date.now()
              while (Date.now() - start < timeout) {
                const value = predicate()
                if (value) return value
                await new Promise((resolve) => setTimeout(resolve, 400))
              }
              return null
            }
            const translateButton = await waitFor(
              () =>
                [...document.querySelectorAll('button')]
                  .filter((b) => b.textContent.trim() === 'Tradução' && !b.disabled)
                  .at(0) ?? null,
              20000
            )
            if (!translateButton) return 'botão Tradução não encontrado'
            translateButton.click()
            await new Promise((resolve) => setTimeout(resolve, 300))
            if (!translateButton.classList.contains('active')) {
              translateButton.click()
              await new Promise((resolve) => setTimeout(resolve, 300))
            }
            const words = await waitFor(
              () =>
                [...document.querySelectorAll('[data-word-index]')].find(
                  (w) => w.textContent.trim() === 'file'
                ) ?? null,
              20000
            )
            if (!words) return 'palavra file não encontrada'
            const range = document.createRange()
            range.selectNode(words)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            words.closest('.pdf-page').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            const popover = await waitFor(() => document.querySelector('.translation-popover'), 8000)
            if (!popover) return 'popover ausente'
            const popoverText = popover.textContent.trim().slice(0, 200)
            const saveButton = [...popover.querySelectorAll('button')].find((b) =>
              b.textContent.includes('Salvar')
            )
            if (saveButton) saveButton.click()
            await new Promise((resolve) => setTimeout(resolve, 1200))
            const sidebarItem = document.querySelector('.translation-item')
            const marcadorButton = [...document.querySelectorAll('button')].find((b) =>
              b.textContent.trim().startsWith('+ Marcador')
            )
            marcadorButton?.click()
            await new Promise((resolve) => setTimeout(resolve, 800))
            const bookmarkItem = document.querySelector('.bookmark-item')
            return (
              'popover: ' +
              popoverText +
              ' || sidebar: ' +
              (sidebarItem ? sidebarItem.textContent.trim().slice(0, 80) : 'vazia') +
              ' || marcador: ' +
              (bookmarkItem ? bookmarkItem.textContent.trim().slice(0, 80) : 'vazio')
            )
          } catch (error) {
            return 'ERR ' + error.message
          }
        })()`,
        false
      )
      .then((value) => console.log('[traducao-test]', String(value)))
      .catch((error) => console.log('[traducao-test-erro]', String(error)))
    const captureWithRetry = async (attempt = 0): Promise<void> => {
      if (!mainWindow) return
      try {
        const image = await mainWindow.webContents.capturePage()
        await writeFile(shot, image.toPNG())
        console.log('shot: captura salva em', shot)
        app.quit()
      } catch (error) {
        if (attempt >= 15) {
          console.error('shot: falhou após retries', error)
          app.exit(1)
          return
        }
        setTimeout(() => void captureWithRetry(attempt + 1), 800)
      }
    }
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => void captureWithRetry(), 26000)
    })
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
