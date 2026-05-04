import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations, getSchemaVersion } from '../../../src/main/db/migrate'

describe('db/migrate', () => {
  let db

  beforeEach(() => {
    db = openDatabase(':memory:')
  })
  afterEach(() => closeDatabase(db))

  it('creates schema_version tracking table from scratch', () => {
    runMigrations(db)
    expect(getSchemaVersion(db)).toBeGreaterThanOrEqual(1)
  })

  it('creates videos/channels/rss_fetch_log/meta tables', () => {
    runMigrations(db)
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r) => r.name)
    expect(rows).toEqual(
      expect.arrayContaining(['channels', 'meta', 'rss_fetch_log', 'schema_version', 'videos'])
    )
  })

  it('is idempotent - running migrations twice does not fail', () => {
    runMigrations(db)
    const v1 = getSchemaVersion(db)
    runMigrations(db)
    const v2 = getSchemaVersion(db)
    expect(v2).toBe(v1)
  })

  it('creates videos indexes', () => {
    runMigrations(db)
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='videos'`)
      .all()
      .map((r) => r.name)
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_videos_status_sched',
        'idx_videos_channel',
        'idx_videos_actual_start'
      ])
    )
  })

  it('migration 003 adds favorite/viewed/ended_at columns to videos', () => {
    runMigrations(db)
    const cols = db
      .prepare(`PRAGMA table_info(videos)`)
      .all()
      .map((r) => r.name)
    expect(cols).toEqual(expect.arrayContaining(['viewed_at', 'is_favorite', 'ended_at']))
  })

  it('migration 006 adds favorite_order column to videos', () => {
    runMigrations(db)
    const cols = db
      .prepare(`PRAGMA table_info(videos)`)
      .all()
      .map((r) => r.name)
    expect(cols).toContain('favorite_order')
  })

  it('migration 003 adds is_pinned column to channels', () => {
    runMigrations(db)
    const cols = db
      .prepare(`PRAGMA table_info(channels)`)
      .all()
      .map((r) => r.name)
    expect(cols).toContain('is_pinned')
  })

  it('migration 003 creates videos_fts virtual table and triggers', () => {
    runMigrations(db)
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((r) => r.name)
    expect(tables).toContain('videos_fts')
    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`)
      .all()
      .map((r) => r.name)
    expect(triggers).toEqual(expect.arrayContaining(['videos_ai', 'videos_au', 'videos_ad']))
  })

  it('migration 003 backfills ended_at for pre-existing ended rows', () => {
    db.exec(`
      CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE videos (
        id                   TEXT PRIMARY KEY,
        channel_id           TEXT NOT NULL,
        channel_title        TEXT NOT NULL,
        title                TEXT NOT NULL,
        description          TEXT,
        thumbnail            TEXT,
        status               TEXT NOT NULL,
        scheduled_start_time INTEGER,
        actual_start_time    INTEGER,
        concurrent_viewers   INTEGER,
        url                  TEXT NOT NULL,
        first_seen_at        INTEGER NOT NULL,
        last_checked_at      INTEGER NOT NULL
      );
      CREATE TABLE channels (
        id                        TEXT PRIMARY KEY,
        title                     TEXT,
        uploads_playlist_id       TEXT NOT NULL,
        last_subscription_sync_at INTEGER NOT NULL
      );
      CREATE TABLE rss_fetch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        success INTEGER NOT NULL,
        http_status INTEGER,
        error_message TEXT
      );
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (1), (2);
      INSERT INTO videos (id, channel_id, channel_title, title, status, url, first_seen_at, last_checked_at)
        VALUES ('legacy', 'UC1', 'C', 't', 'ended', 'u', 1000, 5000);
    `)
    runMigrations(db)
    const row = db.prepare(`SELECT ended_at FROM videos WHERE id = 'legacy'`).get()
    expect(row.ended_at).toBe(5000)
  })
})
