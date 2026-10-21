import type { Bookmark } from '@shared/types'

interface BookmarksPanelProps {
  bookmarks: Bookmark[]
  onClose: () => void
  onJump: (bookmark: Bookmark) => void
  onRemove: (bookmark: Bookmark) => void
}

export function BookmarksPanel({
  bookmarks,
  onClose,
  onJump,
  onRemove
}: BookmarksPanelProps) {
  return (
    <div className="bookmarks-panel">
      <div className="sidebar-header">
        <h2>Marcadores</h2>
        <button className="btn ghost icon" onClick={onClose} title="Fechar marcadores">
          ✕
        </button>
      </div>
      <div className="sidebar-list">
        {bookmarks.length === 0 ? (
          <div className="sidebar-empty">
            Nenhum marcador ainda. Selecione uma palavra ou posicione a página e use “Marcador”.
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="bookmark-item">
              <div className="bookmark-label">{bookmark.label}</div>
              <div className="bookmark-meta">
                <span>Página {bookmark.page}</span>
                <div className="toolbar-group">
                  <button
                    className="btn ghost icon"
                    title="Ir para o marcador"
                    onClick={() => onJump(bookmark)}
                  >
                    ↪
                  </button>
                  <button
                    className="btn ghost icon danger"
                    title="Remover marcador"
                    onClick={() => onRemove(bookmark)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
