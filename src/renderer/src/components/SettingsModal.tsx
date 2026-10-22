import { useState } from 'react'
import type { PublicSettings, SettingsUpdate } from '@shared/types'

interface SettingsModalProps {
  settings: PublicSettings
  onClose: () => void
  onSave: (update: SettingsUpdate) => Promise<void>
}

export function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [targetLanguage, setTargetLanguage] = useState(settings.targetLanguage)
  const [darkMode, setDarkMode] = useState(settings.darkMode)
  const [darkPreset, setDarkPreset] = useState(settings.darkPreset)
  const [textColorEnabled, setTextColorEnabled] = useState(settings.pageTextColor != null)
  const [textColor, setTextColor] = useState(settings.pageTextColor ?? '#0c0c0c')
  const [bgColorEnabled, setBgColorEnabled] = useState(settings.pageBgColor != null)
  const [bgColor, setBgColor] = useState(settings.pageBgColor ?? '#ffffff')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const update: SettingsUpdate = {
        targetLanguage: targetLanguage.trim() || 'pt-BR',
        darkMode,
        darkPreset,
        pageTextColor: textColorEnabled ? textColor : '',
        pageBgColor: bgColorEnabled ? bgColor : ''
      }
      await onSave(update)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleTextColorInteraction = (nextColor: string) => {
    setTextColor(nextColor)
    setTextColorEnabled(true)
    if (darkMode) setDarkMode(false)
  }

  const handleBgColorInteraction = (nextColor: string) => {
    setBgColor(nextColor)
    setBgColorEnabled(true)
    if (darkMode) setDarkMode(false)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <h2>Configurações</h2>

        <div className="field">
          <label htmlFor="api-key">Tradução</label>
          <div className="hint">
            Dicionário local EN→PT (offline, palavras únicas) — base WikDict, CC BY-SA 4.0.
            Não é necessária nenhuma chave nem conexão com a internet.
          </div>
        </div>

        <div className="field">
          <label htmlFor="target-language">Idioma de destino</label>
          <input
            id="target-language"
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            placeholder="pt-BR"
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(event) => setDarkMode(event.target.checked)}
            />{' '}
            Aplicar Modo escuro ao PDF
          </label>
        </div>

        <div className="field">
          <label htmlFor="dark-preset">Preset do Modo escuro</label>
          <select
            id="dark-preset"
            value={darkPreset}
            onChange={(event) => setDarkPreset(event.target.value as 'soft' | 'contrast')}
            disabled={!darkMode}
          >
            <option value="soft">Suave (inversão equilibrada)</option>
            <option value="contrast">Alto contraste</option>
          </select>
          <div className="hint">
            A recolorização atual inverte as cores da página. Imagens também são invertidas —
            uma preservação seletiva de imagens está prevista para uma próxima iteração.
          </div>
        </div>

        <div className="field">
          <label htmlFor="page-text-color">Cor da fonte da página</label>
          {darkMode && (
            <div className="settings-status warning">
              Clique numa cor para desligar o Modo escuro automaticamente.
            </div>
          )}
          <div className="color-row">
            <input
              type="checkbox"
              checked={textColorEnabled}
              onChange={(event) => {
                setTextColorEnabled(event.target.checked)
                if (event.target.checked && darkMode) setDarkMode(false)
              }}
            />
            <input
              id="page-text-color"
              type="color"
              value={textColor}
              onChange={(event) => handleTextColorInteraction(event.target.value)}
            />
          </div>
          <div className="hint">
            Recoloriza o texto escuro da página no modo claro. Desmarcado = cor original do PDF.
          </div>
        </div>

        <div className="field">
          <label htmlFor="page-bg-color">Cor de fundo da página</label>
          <div className="color-row">
            <input
              type="checkbox"
              checked={bgColorEnabled}
              onChange={(event) => {
                setBgColorEnabled(event.target.checked)
                if (event.target.checked && darkMode) setDarkMode(false)
              }}
            />
            <input
              id="page-bg-color"
              type="color"
              value={bgColor}
              onChange={(event) => handleBgColorInteraction(event.target.value)}
            />
          </div>
          <div className="hint">
            Substitui o fundo branco da página no modo claro. O conteúdo (texto e imagens) é
            preservado.
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
