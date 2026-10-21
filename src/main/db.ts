import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'node:path'

let database: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!database) {
    database = new DatabaseSync(join(app.getPath('userData'), 'pdf-reader.db'))
    database.exec('PRAGMA journal_mode = WAL')
    database.exec('PRAGMA foreign_keys = ON')
    migrate(database)
  }
  return database
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      added_at INTEGER NOT NULL,
      last_read_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reading_state (
      document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
      page INTEGER NOT NULL,
      scroll_offset REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page INTEGER NOT NULL,
      label TEXT NOT NULL,
      anchor_text TEXT,
      word_index INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_translations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page INTEGER NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      provider TEXT NOT NULL,
      detected_source_language TEXT,
      anchor_text TEXT,
      word_index INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS translation_cache (
      cache_key TEXT PRIMARY KEY,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      provider TEXT NOT NULL,
      detected_source_language TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_document ON bookmarks(document_id, page);
    CREATE INDEX IF NOT EXISTS idx_translations_document ON saved_translations(document_id, created_at);
  `)
}
