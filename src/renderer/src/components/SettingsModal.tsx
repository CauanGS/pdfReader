import { useState } from 'react'
import type { PublicSettings, SettingsUpdate, TranslationProviderId } from '@shared/types'

interface SettingsModalProps {
  settings: PublicSettings
  onClose: () => void
  onSave: (update: SettingsUpdate) => Promise<void>
}

export function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [provider, setProvider] = useState<TranslationProviderId>(settings.provider)
  const [targetLanguage, setTargetLanguage] = useState(settings.targetLanguage)
  const [darkMode, setDarkMode] = useState(settings.darkMode)
  const [darkPreset, setDarkPreset] = useState(settings.darkPreset)
  const [apiKey, setApiKey] = useState('')
  const [removeKey, setRemoveKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const update: SettingsUpdate = {
        provider,
        targetLanguage: targetLanguage.trim() || 'pt-BR',
        darkMode,
        darkPreset
      }
      if (removeKey) update.googleApiKey = ''
      else if (apiKey.trim()) update.googleApiKey = apiKey.trim()
      await onSave(update)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <h2>Configurações</h2>

        <div className="field">
          <label htmlFor="provider">Provider de tradução</label>
          <select
            id="provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as TranslationProviderId)}
          >
            <option value="google">Google Cloud Translation v2 (recomendado)</option>
            <option value="local">Dicionário local EN→PT (offline, palavras únicas)</option>
          </select>
          <div className="hint">
            O Dicionário local funciona sem internet e sem chave, cobrindo palavras únicas
            (EN→PT, base WikDict — CC BY-SA 4.0). Frases exigem um Provider online.
          </div>
        </div>

        <div className="field">
          <label htmlFor="api-key">Chave da API do Google Cloud Translation</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            placeholder={settings.hasGoogleApiKey ? 'Chave configurada — digite para substituir' : 'Cole sua API key'}
            onChange={(event) => {
              setApiKey(event.target.value)
              setRemoveKey(false)
            }}
            disabled={removeKey}
          />
          {settings.hasGoogleApiKey && (
            <div className="settings-status ok">
              Chave armazenada com segurança pelo sistema.
            </div>
          )}
          {settings.hasGoogleApiKey && (
            <label className="hint">
              <input
                type="checkbox"
                checked={removeKey}
                onChange={(event) => setRemoveKey(event.target.checked)}
              />{' '}
              Remover a chave salva
            </label>
          )}
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
