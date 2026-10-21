import { safeStorage } from 'electron'
import type { PublicSettings, SettingsUpdate, TranslationProviderId } from '@shared/types'
import { getDb } from './db'

const DEFAULT_SETTINGS = {
  provider: 'google' as TranslationProviderId,
  sourceLanguage: 'auto',
  targetLanguage: 'pt-BR',
  darkMode: true,
  darkPreset: 'soft' as const
}

function readSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function writeSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

function deleteSetting(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
}

export function saveGoogleApiKey(apiKey: string): void {
  if (!apiKey) {
    deleteSetting('google_api_key_enc')
    deleteSetting('google_api_key_plain')
    return
  }
  deleteSetting('google_api_key_plain')
  if (safeStorage.isEncryptionAvailable()) {
    writeSetting('google_api_key_enc', safeStorage.encryptString(apiKey).toString('base64'))
  } else {
    writeSetting('google_api_key_plain', apiKey)
  }
}

export function readGoogleApiKey(): string | null {
  const encrypted = readSetting('google_api_key_enc')
  if (encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
      return null
    }
  }
  return readSetting('google_api_key_plain')
}

export function getPublicSettings(): PublicSettings {
  const provider = (readSetting('provider') as TranslationProviderId | null) ?? DEFAULT_SETTINGS.provider
  const darkPreset = (readSetting('dark_preset') as 'soft' | 'contrast' | null) ?? DEFAULT_SETTINGS.darkPreset
  return {
    provider,
    sourceLanguage: readSetting('source_language') ?? DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: readSetting('target_language') ?? DEFAULT_SETTINGS.targetLanguage,
    darkMode: (readSetting('dark_mode') ?? String(DEFAULT_SETTINGS.darkMode)) === 'true',
    darkPreset,
    hasGoogleApiKey: Boolean(readGoogleApiKey())
  }
}

export function updateSettings(update: SettingsUpdate): PublicSettings {
  if (update.provider) writeSetting('provider', update.provider)
  if (update.sourceLanguage) writeSetting('source_language', update.sourceLanguage)
  if (update.targetLanguage) writeSetting('target_language', update.targetLanguage)
  if (typeof update.darkMode === 'boolean') writeSetting('dark_mode', String(update.darkMode))
  if (update.darkPreset) writeSetting('dark_preset', update.darkPreset)
  if (typeof update.googleApiKey === 'string') saveGoogleApiKey(update.googleApiKey.trim())
  return getPublicSettings()
}
