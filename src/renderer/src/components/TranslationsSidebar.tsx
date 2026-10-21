import type { SavedTranslation } from '@shared/types'
import { formatProvider } from '@renderer/lib/format'

interface TranslationsSidebarProps {
  translations: SavedTranslation[]
  collapsed: boolean
  onClose: () => void
  onJump: (translation: SavedTranslation) => void
  onRemove: (translation: SavedTranslation) => void
}

export function TranslationsSidebar({
  translations,
  collapsed,
  onClose,
  onJump,
  onRemove
}: TranslationsSidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2>Traduções salvas</h2>
        <button className="btn ghost icon" onClick={onClose} title="Recolher sidebar">
          ‹
        </button>
      </div>
      <div className="sidebar-list">
        {translations.length === 0 ? (
          <div className="sidebar-empty">
            Ative o Modo tradução, selecione uma palavra ou frase e salve a tradução para vê-la
            aqui.
          </div>
        ) : (
          translations.map((translation) => (
            <div key={translation.id} className="translation-item">
              <div className="source-text">{translation.sourceText}</div>
              <div className="translated-text">{translation.translatedText}</div>
              <div className="item-footer">
                <span className="badge">{formatProvider(translation.provider)}</span>
                <div className="toolbar-group">
                  <button
                    className="btn ghost icon"
                    title="Ir para a palavra"
                    onClick={() => onJump(translation)}
                  >
                    ↪
                  </button>
                  <button
                    className="btn ghost icon danger"
                    title="Remover tradução"
                    onClick={() => onRemove(translation)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="bookmark-meta">
                <span>Página {translation.page}</span>
                {translation.anchorText && <span>“{translation.anchorText}”</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
