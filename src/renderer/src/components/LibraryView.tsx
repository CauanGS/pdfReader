import type { DocumentRecord } from '@shared/types'
import { formatBytes, formatDate } from '@renderer/lib/format'

interface LibraryViewProps {
  documents: DocumentRecord[]
  onOpen: (document: DocumentRecord) => void
  onImport: () => void
  onRemove: (document: DocumentRecord) => void
  onOpenSettings: () => void
  importing: boolean
}

export function LibraryView({
  documents,
  onOpen,
  onImport,
  onRemove,
  onOpenSettings,
  importing
}: LibraryViewProps) {
  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>Biblioteca</h1>
          <div className="subtitle">
            {documents.length === 0
              ? 'Nenhum documento importado'
              : `${documents.length} documento${documents.length > 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="library-actions">
          <button className="btn ghost" onClick={onOpenSettings}>
            Configurações
          </button>
          <button className="btn primary" onClick={onImport} disabled={importing}>
            {importing ? 'Importando…' : 'Importar PDF'}
          </button>
        </div>
      </header>

      <div className="library-content">
        {documents.length === 0 ? (
          <div className="empty-state">
            <h2>Sua biblioteca está vazia</h2>
            <p>
              Importe um PDF para começar a ler com modo escuro, retomada automática,
              <br />
              marcadores por palavra e tradução com sidebar.
            </p>
            <button className="btn primary" onClick={onImport} disabled={importing}>
              Importar meu primeiro PDF
            </button>
          </div>
        ) : (
          <div className="document-grid">
            {documents.map((document) => (
              <article
                key={document.id}
                className="document-card"
                onClick={() => onOpen(document)}
              >
                <button
                  className="btn ghost icon card-remove danger"
                  title="Remover da biblioteca"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(document)
                  }}
                >
                  ✕
                </button>
                <h3>{document.title}</h3>
                <div className="doc-meta">
                  <span>
                    {document.pageCount > 0 ? `${document.pageCount} páginas` : 'Carregando páginas'}
                  </span>
                  <span>•</span>
                  <span>{formatBytes(document.fileSize)}</span>
                </div>
                <div className="doc-meta">
                  <span>
                    {document.lastReadAt
                      ? `Lido em ${formatDate(document.lastReadAt)}`
                      : `Importado em ${formatDate(document.addedAt)}`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
