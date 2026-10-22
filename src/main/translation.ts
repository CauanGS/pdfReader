import { createHash } from 'node:crypto'
import type { TranslateRequest, TranslateResult, TranslationProviderId } from '@shared/types'
import { getDb } from './db'
import { lookupWord } from './dictionary'
import { getPublicSettings } from './settings'

function cacheKey(provider: string, source: string, target: string, text: string): string {
  return createHash('sha256').update(`${provider}|${source}|${target}|${text}`).digest('hex')
}

function readCache(key: string): TranslateResult | null {
  const row = getDb().prepare('SELECT * FROM translation_cache WHERE cache_key = ?').get(key) as
    | {
        translated_text: string
        provider: string
        detected_source_language: string | null
      }
    | undefined
  if (!row) return null
  return {
    translatedText: row.translated_text,
    provider: row.provider as TranslationProviderId,
    detectedSourceLanguage: row.detected_source_language,
    fromCache: true
  }
}

function writeCache(
  key: string,
  text: string,
  result: TranslateResult,
  source: string,
  target: string
): void {
  getDb()
    .prepare(
      `INSERT INTO translation_cache
        (cache_key, source_text, translated_text, provider, detected_source_language, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET translated_text = excluded.translated_text, created_at = excluded.created_at`
    )
    .run(
      key,
      `${source}->${target}:${text}`,
      result.translatedText,
      result.provider,
      result.detectedSourceLanguage,
      Date.now()
    )
}

function isSingleWord(text: string): boolean {
  return !/\s/.test(text.trim()) && /^[a-zA-Z'-]+$/.test(text.trim())
}

export async function translate(request: TranslateRequest): Promise<TranslateResult> {
  const text = request.text.trim()
  if (!text) throw new Error('Selecione uma palavra ou frase para traduzir.')

  const settings = getPublicSettings()
  const source = request.sourceLanguage ?? settings.sourceLanguage
  const target = request.targetLanguage ?? settings.targetLanguage

  const key = cacheKey('local', source, target, text)
  const cached = readCache(key)
  if (cached) return cached

  const translated = lookupWord(text)
  if (!translated) {
    if (isSingleWord(text)) {
      throw new Error('Palavra não encontrada no Dicionário local (EN→PT).')
    }
    throw new Error('O Dicionário local traduz apenas palavras únicas em inglês (EN→PT).')
  }

  const result: TranslateResult = {
    translatedText: translated,
    provider: 'local',
    detectedSourceLanguage: 'en',
    fromCache: false
  }

  writeCache(key, text, result, source, target)
  return result
}
