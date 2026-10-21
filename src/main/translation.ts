import { createHash } from 'node:crypto'
import type { TranslateRequest, TranslateResult, TranslationProviderId } from '@shared/types'
import { getDb } from './db'
import { lookupWord } from './dictionary'
import { getPublicSettings, readGoogleApiKey } from './settings'

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

interface GoogleTranslationResponse {
  data?: {
    translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>
  }
  error?: {
    message?: string
  }
}

async function googleTranslate(
  text: string,
  source: string,
  target: string,
  apiKey: string
): Promise<TranslateResult> {
  const body = new URLSearchParams({ q: text, target, format: 'text' })
  if (source && source !== 'auto') body.set('source', source)

  let response: Response
  try {
    response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body
      }
    )
  } catch {
    throw new Error('Não foi possível falar com o Google Cloud Translation. Verifique sua conexão.')
  }

  const payload = (await response.json()) as GoogleTranslationResponse
  if (!response.ok) {
    const message = payload.error?.message ?? `Erro HTTP ${response.status}`
    if (response.status === 400 && /API key not valid/i.test(message)) {
      throw new Error('A chave do Google Cloud Translation é inválida. Atualize nas Configurações.')
    }
    throw new Error(`Google Cloud Translation: ${message}`)
  }

  const translation = payload.data?.translations?.[0]
  if (!translation?.translatedText) {
    throw new Error('O Google Cloud Translation não retornou uma tradução.')
  }

  return {
    translatedText: translation.translatedText,
    provider: 'google',
    detectedSourceLanguage: translation.detectedSourceLanguage ?? null,
    fromCache: false
  }
}

export async function translate(request: TranslateRequest): Promise<TranslateResult> {
  const text = request.text.trim()
  if (!text) throw new Error('Selecione uma palavra ou frase para traduzir.')

  const settings = getPublicSettings()
  const source = request.sourceLanguage ?? settings.sourceLanguage
  const target = request.targetLanguage ?? settings.targetLanguage
  const apiKey = readGoogleApiKey()

  let provider: TranslationProviderId = settings.provider
  if (provider === 'google' && !apiKey) {
    if (isSingleWord(text)) {
      provider = 'local'
    } else {
      throw new Error(
        'Configure a chave do Google Cloud Translation nas Configurações para traduzir frases.'
      )
    }
  }

  const key = cacheKey(provider, source, target, text)
  const cached = readCache(key)
  if (cached) return cached

  let result: TranslateResult
  if (provider === 'google') {
    result = await googleTranslate(text, source, target, apiKey as string)
  } else {
    const translated = lookupWord(text)
    if (!translated) {
      throw new Error(
        'Palavra não encontrada no Dicionário local. Configure um Provider online nas Configurações.'
      )
    }
    result = {
      translatedText: translated,
      provider: 'local',
      detectedSourceLanguage: 'en',
      fromCache: false
    }
  }

  writeCache(key, text, result, source, target)
  return result
}
