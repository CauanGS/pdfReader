import { useCallback, useEffect, useState } from 'react'
import type { DocumentRecord, PublicSettings, SettingsUpdate } from '@shared/types'
import { LibraryView } from './components/LibraryView'
import { ReaderView } from './components/ReaderView'
import { SettingsModal } from './components/SettingsModal'

export default function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importing, setImporting] = useState(false)

  const refreshLibrary = useCallback(async () => {
    const list = await window.pdfReader.library.list()
    setDocuments(list)
  }, [])

  useEffect(() => {
    void refreshLibrary()
    void window.pdfReader.settings.get().then(setSettings)
    const requestedId = new URLSearchParams(window.location.search).get('doc')
    if (requestedId) {
      void window.pdfReader.library.get(requestedId).then((document) => {
        if (document) setActiveDocument(document)
      })
    }
  }, [refreshLibrary])

  const handleImport = async () => {
    setImporting(true)
    try {
      const document = await window.pdfReader.library.import()
      if (document) {
        await refreshLibrary()
        setActiveDocument(document)
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setImporting(false)
    }
  }

  const handleRemove = async (document: DocumentRecord) => {
    const confirmed = window.confirm(
      `Remover "${document.title}" da biblioteca? O arquivo original não será apagado.`
    )
    if (!confirmed) return
    try {
      await window.pdfReader.library.remove(document.id)
      if (activeDocument?.id === document.id) setActiveDocument(null)
      await refreshLibrary()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDocumentUpdate = useCallback((document: DocumentRecord) => {
    setDocuments((previous) =>
      previous.map((item) => (item.id === document.id ? document : item))
    )
    setActiveDocument((previous) => (previous?.id === document.id ? document : previous))
  }, [])

  const handleUpdateSettings = useCallback(async (update: SettingsUpdate) => {
    const next = await window.pdfReader.settings.update(update)
    setSettings(next)
  }, [])

  const handleBack = () => {
    setActiveDocument(null)
    void refreshLibrary()
  }

  if (!settings) {
    return (
      <div className="empty-state">
        <span className="spinner" /> Carregando…
      </div>
    )
  }

  return (
    <>
      {activeDocument ? (
        <ReaderView
          document={activeDocument}
          settings={settings}
          onBack={handleBack}
          onDocumentUpdate={handleDocumentUpdate}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <LibraryView
          documents={documents}
          onOpen={setActiveDocument}
          onImport={() => void handleImport()}
          onRemove={(document) => void handleRemove(document)}
          onOpenSettings={() => setSettingsOpen(true)}
          importing={importing}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={handleUpdateSettings}
        />
      )}
    </>
  )
}
