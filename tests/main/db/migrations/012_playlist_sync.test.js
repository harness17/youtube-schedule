import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../../src/main/db/connection'
import { runMigrations } from '../../../../src/main/db/migrate'

describe('migration 012 playlist sync', () => {
  let db

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => closeDatabase(db))

  it('adds playlist columns, indexes, and config table on a fresh database', () => {
    runMigrations(db)

    const videoColumns = db
      .prepare(`PRAGMA table_info(videos)`)
      .all()
      .map((row) => row.name)
    expect(videoColumns).toEqual(
      expect.arrayContaining(['in_playlist', 'playlist_added_at', 'playlist_removed_at'])
    )

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'videos'`)
      .all()
      .map((row) => row.name)
    expect(indexes).toEqual(
      expect.arrayContaining(['idx_videos_in_playlist', 'idx_videos_playlist_removed'])
    )

    const configTable = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'playlist_sync_config'`
      )
      .get()
    expect(configTable).toEqual({ name: 'playlist_sync_config' })
  })

  it('preserves existing 004-era video rows when upgrading', () => {
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
        last_checked_at      INTEGER NOT NULL,
        viewed_at            INTEGER,
        is_favorite          INTEGER NOT NULL DEFAULT 0,
        ended_at             INTEGER,
        notify               INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE channels (
        id                        TEXT PRIMARY KEY,
        title                     TEXT,
        uploads_playlist_id       TEXT NOT NULL,
        last_subscription_sync_at INTEGER NOT NULL,
        is_pinned                 INTEGER NOT NULL DEFAULT 0
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
      INSERT INTO schema_version (version) VALUES (1), (2), (3), (4);
      INSERT INTO videos (
        id, channel_id, channel_title, title, status, url, first_seen_at, last_checked_at,
        is_favorite, notify
      ) VALUES (
        'legacy', 'UC1', 'Channel', 'Legacy video', 'ended', 'https://example.com',
        1000, 2000, 1, 1
      );
    `)

    runMigrations(db)

    const row = db.prepare(`SELECT * FROM videos WHERE id = 'legacy'`).get()
    expect(row.title).toBe('Legacy video')
    expect(row.is_favorite).toBe(1)
    expect(row.notify).toBe(1)
    expect(row.in_playlist).toBe(0)
    expect(row.playlist_added_at).toBeNull()
    expect(row.playlist_removed_at).toBeNull()
  })

  it('enforces a single playlist_sync_config row with CHECK id = 1', () => {
    runMigrations(db)

    expect(() => {
      db.prepare(
        `INSERT INTO playlist_sync_config (id, playlist_id, playlist_title) VALUES (2, 'PL2', 'Bad')`
      ).run()
    }).toThrow()
  })
})
