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
})
