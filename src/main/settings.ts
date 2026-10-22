import type { PublicSettings, SettingsUpdate } from '@shared/types'
import { getDb } from './db'

const DEFAULT_SETTINGS = {
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

function readColor(key: string): string | null {
  const value = readSetting(key)
  return value && value.trim() ? value.trim() : null
}

export function getPublicSettings(): PublicSettings {
  const darkPreset = (readSetting('dark_preset') as 'soft' | 'contrast' | null) ?? DEFAULT_SETTINGS.darkPreset
  return {
    sourceLanguage: readSetting('source_language') ?? DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: readSetting('target_language') ?? DEFAULT_SETTINGS.targetLanguage,
    darkMode: (readSetting('dark_mode') ?? String(DEFAULT_SETTINGS.darkMode)) === 'true',
    darkPreset,
    pageBgColor: readColor('page_bg_color'),
    pageTextColor: readColor('page_text_color')
  }
}

export function updateSettings(update: SettingsUpdate): PublicSettings {
  if (update.sourceLanguage) writeSetting('source_language', update.sourceLanguage)
  if (update.targetLanguage) writeSetting('target_language', update.targetLanguage)
  if (typeof update.darkMode === 'boolean') writeSetting('dark_mode', String(update.darkMode))
  if (update.darkPreset) writeSetting('dark_preset', update.darkPreset)
  if (typeof update.pageBgColor === 'string') {
    const value = update.pageBgColor.trim()
    if (value) writeSetting('page_bg_color', value)
    else deleteSetting('page_bg_color')
  }
  if (typeof update.pageTextColor === 'string') {
    const value = update.pageTextColor.trim()
    if (value) writeSetting('page_text_color', value)
    else deleteSetting('page_text_color')
  }
  return getPublicSettings()
}
