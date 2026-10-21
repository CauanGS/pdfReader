import type { CSSProperties } from 'react'
import type { TranslateResult } from '@shared/types'
import { formatProvider } from '@renderer/lib/format'

export interface TranslationPopoverState {
  text: string
  page: number
  wordIndex: number | null
  rect: DOMRect
  loading: boolean
  error: string | null
  result: TranslateResult | null
}

interface TranslationPopoverProps {
  state: TranslationPopoverState
  onClose: () => void
  onSave: () => void
}

export function TranslationPopover({ state, onClose, onSave }: TranslationPopoverProps) {
  const width = Math.min(340, window.innerWidth - 24)
  const left = Math.max(
    12,
    Math.min(state.rect.left + state.rect.width / 2 - width / 2, window.innerWidth - width - 12)
  )
  const placeBelow = state.rect.top < 250
  const style: CSSProperties = placeBelow
    ? { left, top: state.rect.bottom + 10, width }
    : { left, top: state.rect.top - 10, width, transform: 'translateY(-100%)' }

  return (
    <div className="translation-popover" style={style} onMouseDown={(event) => event.stopPropagation()}>
      <div className="popover-source">{state.text}</div>

      {state.loading && (
        <div className="doc-meta">
          <span className="spinner" /> Traduzindo…
        </div>
      )}

      {state.error && <div className="error-text">{state.error}</div>}

      {state.result && !state.loading && (
        <>
          <div className="popover-result">{state.result.translatedText}</div>
          <div className="doc-meta">
            <span className="badge">{formatProvider(state.result.provider)}</span>
            {state.result.detectedSourceLanguage && (
              <span>detectado: {state.result.detectedSourceLanguage}</span>
            )}
            {state.result.fromCache && <span>cache</span>}
          </div>
        </>
      )}

      <div className="popover-actions">
        <button className="btn ghost" onClick={onClose}>
          Fechar
        </button>
        <button className="btn primary" onClick={onSave} disabled={!state.result || state.loading}>
          Salvar na sidebar
        </button>
      </div>
    </div>
  )
}
