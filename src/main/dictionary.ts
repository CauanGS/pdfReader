import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { app } from 'electron'

const IRREGULAR_VERBS: Record<string, string> = {
  am: 'be',
  is: 'be',
  are: 'be',
  was: 'be',
  were: 'be',
  been: 'be',
  being: 'be',
  has: 'have',
  had: 'have',
  having: 'have',
  does: 'do',
  did: 'do',
  done: 'do',
  doing: 'do',
  went: 'go',
  gone: 'go',
  said: 'say',
  made: 'make',
  took: 'take',
  taken: 'take',
  came: 'come',
  saw: 'see',
  seen: 'see',
  knew: 'know',
  known: 'know',
  got: 'get',
  gotten: 'get',
  gave: 'give',
  given: 'give',
  found: 'find',
  thought: 'think',
  told: 'tell',
  became: 'become',
  left: 'leave',
  felt: 'feel',
  brought: 'bring',
  began: 'begin',
  begun: 'begin',
  kept: 'keep',
  held: 'hold',
  wrote: 'write',
  written: 'write',
  stood: 'stand',
  heard: 'hear',
  meant: 'mean',
  met: 'meet',
  ran: 'run',
  paid: 'pay',
  sat: 'sit',
  spoke: 'speak',
  spoken: 'speak',
  led: 'lead',
  read: 'read',
  grew: 'grow',
  grown: 'grow',
  lost: 'lose',
  fell: 'fall',
  fallen: 'fall',
  sent: 'send',
  built: 'build',
  understood: 'understand',
  drew: 'draw',
  drawn: 'draw',
  broke: 'break',
  broken: 'break',
  spent: 'spend',
  rose: 'rise',
  risen: 'rise',
  drove: 'drive',
  driven: 'drive',
  bought: 'buy',
  wore: 'wear',
  worn: 'wear',
  chose: 'choose',
  chosen: 'choose',
  ate: 'eat',
  eaten: 'eat',
  drank: 'drink',
  drunk: 'drink',
  slept: 'sleep',
  flew: 'fly',
  flown: 'fly',
  forgot: 'forget',
  forgotten: 'forget',
  lay: 'lie',
  lain: 'lie',
  sought: 'seek',
  fought: 'fight',
  taught: 'teach',
  caught: 'catch',
  threw: 'throw',
  thrown: 'throw',
  woke: 'wake',
  woken: 'wake'
}

const FALLBACK_DICTIONARY: Record<string, string> = {
  a: 'um',
  an: 'um',
  and: 'e',
  because: 'porque',
  be: 'ser',
  file: 'arquivo',
  for: 'para',
  from: 'de',
  have: 'ter',
  he: 'ele',
  in: 'em',
  is: 'é',
  it: 'isso',
  of: 'de',
  pdf: 'PDF',
  she: 'ela',
  that: 'que',
  the: 'o',
  they: 'eles',
  this: 'este',
  to: 'para',
  we: 'nós',
  will: 'vai',
  with: 'com'
}

interface WikDictRow {
  trans_list: string
}

let wikdict: DatabaseSync | null = null
let wikdictUnavailable = false

function getWikDict(): DatabaseSync | null {
  if (wikdict || wikdictUnavailable) return wikdict
  if (!app.isReady()) return null
  const path = app.isPackaged
    ? join(process.resourcesPath, 'dictionaries', 'en-pt.sqlite3')
    : join(app.getAppPath(), 'resources', 'dictionaries', 'en-pt.sqlite3')
  try {
    wikdict = new DatabaseSync(path, { readOnly: true })
  } catch {
    wikdictUnavailable = true
    console.warn('Dicionário local WikDict indisponível em', path)
  }
  return wikdict
}

function translateWikdict(entry: string): string | null {
  const db = getWikDict()
  if (!db) return null
  const row = db
    .prepare('SELECT trans_list FROM simple_translation WHERE written_rep = ? LIMIT 1')
    .get(entry) as WikDictRow | undefined
  if (!row?.trans_list) return null
  const senses = row.trans_list.split('|').map((sense) => sense.trim()).filter(Boolean)
  return senses.slice(0, 3).join(', ')
}

function candidatesFor(word: string): string[] {
  const candidates: string[] = []
  if (IRREGULAR_VERBS[word]) candidates.push(IRREGULAR_VERBS[word])
  if (word.startsWith('un') && word.length > 5) candidates.push(word.slice(2))
  if (word.startsWith('un') && word.length > 5) {
    const base = word.slice(2)
    if (base.endsWith('ies') && base.length > 4) candidates.push(`${base.slice(0, -3)}y`)
    if (base.endsWith('es') && base.length > 3) candidates.push(base.slice(0, -2))
    if (base.endsWith('ed') && base.length > 3) candidates.push(base.slice(0, -2))
    if (base.endsWith('ing') && base.length > 4) candidates.push(base.slice(0, -3))
  }
  if (word.endsWith("'s")) candidates.push(word.slice(0, -2))
  if (word.endsWith("s")) candidates.push(word.slice(0, -1))
  if (word.endsWith('ies') && word.length > 4) candidates.push(`${word.slice(0, -3)}y`)
  if (word.endsWith('es') && word.length > 3) candidates.push(word.slice(0, -2))
  if (word.endsWith('ed') && word.length > 3) {
    candidates.push(word.slice(0, -2))
    candidates.push(word.slice(0, -1))
  }
  if (word.endsWith('ing') && word.length > 4) {
    candidates.push(word.slice(0, -3))
    candidates.push(`${word.slice(0, -3)}e`)
  }
  if (word.endsWith('ly') && word.length > 3) candidates.push(word.slice(0, -2))
  return candidates
}

export function lookupWord(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z'’-]/g, '')
    .replace(/^[’'-]+|[’'-]+$/g, '')
  if (!cleaned) return null

  const direct = translateWikdict(cleaned)
  if (direct) return direct

  for (const candidate of candidatesFor(cleaned)) {
    const translated = translateWikdict(candidate)
    if (translated) return translated
  }

  return FALLBACK_DICTIONARY[cleaned] ?? null
}
