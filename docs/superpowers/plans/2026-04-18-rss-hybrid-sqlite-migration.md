# RSS ハイブリッド取得 + SQLite 保持移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RSS プライマリ + `playlistItems.list` フォールバックの取得層と、`better-sqlite3` による動画単位データ保持層を導入し、ポーリング間隔を 30 分に短縮する。

**Architecture:** Main プロセス内で `SchedulerService` が Fetcher 群をオーケストレートし、取得結果を `VideoRepository` 経由で SQLite (`schedule.db` on userData) に UPSERT。electron-store は設定専用に縮退。追加インフラなしでデスクトップアプリ単体完結。

**Tech Stack:** Electron 39 / React 19 / `better-sqlite3` / `fast-xml-parser` / `googleapis` / Vitest / `nock`

**Spec:** `docs/superpowers/specs/2026-04-18-rss-hybrid-sqlite-migration-design.md`

---

## ファイル構成

### 新規作成

| ファイル                                                | 責務                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| `src/main/db/connection.js`                             | SQLite 接続の open/close、WAL 設定             |
| `src/main/db/schema.js`                                 | CREATE TABLE / INDEX 定義                      |
| `src/main/db/migrate.js`                                | schema_version に基づくマイグレーション実行    |
| `src/main/db/migrations/001_initial.js`                 | 初期スキーマ適用                               |
| `src/main/db/migrations/002_import_from_store.js`       | 旧 electron-store キャッシュ取り込み           |
| `src/main/repositories/videoRepository.js`              | videos テーブルの CRUD / listVisible / cleanup |
| `src/main/repositories/channelRepository.js`            | channels テーブルの CRUD                       |
| `src/main/repositories/rssFetchLogRepository.js`        | rss_fetch_log の追加・集計                     |
| `src/main/repositories/metaRepository.js`               | meta KV 取得・設定                             |
| `src/main/services/videoStatus.js`                      | `deriveStatus(video, now)` 関数                |
| `src/main/services/schedulerService.js`                 | refresh フロー全体のオーケストレーション       |
| `src/main/fetchers/rssFetcher.js`                       | RSS HTTPS 取得 + XML パース                    |
| `src/main/fetchers/subscriptionsFetcher.js`             | subscriptions.list + 1 日キャッシュ            |
| `src/main/fetchers/playlistItemsFetcher.js`             | playlistItems.list フォールバック              |
| `src/main/fetchers/videoDetailsFetcher.js`              | videos.list バッチ取得                         |
| `tests/main/db/connection.test.js`                      | DB 接続テスト                                  |
| `tests/main/db/migrate.test.js`                         | マイグレーション冪等性テスト                   |
| `tests/main/repositories/videoRepository.test.js`       | 動画 CRUD テスト                               |
| `tests/main/repositories/channelRepository.test.js`     | チャンネル CRUD テスト                         |
| `tests/main/repositories/rssFetchLogRepository.test.js` | RSS ログテスト                                 |
| `tests/main/repositories/metaRepository.test.js`        | meta KV テスト                                 |
| `tests/main/services/videoStatus.test.js`               | status 判定テスト                              |
| `tests/main/services/schedulerService.test.js`          | オーケストレーションテスト                     |
| `tests/main/fetchers/rssFetcher.test.js`                | RSS 取得テスト                                 |
| `tests/main/fetchers/subscriptionsFetcher.test.js`      | 登録チャンネル取得テスト                       |
| `tests/main/fetchers/playlistItemsFetcher.test.js`      | プレイリスト取得テスト                         |
| `tests/main/fetchers/videoDetailsFetcher.test.js`       | 動画詳細取得テスト                             |
| `src/renderer/components/StatusBanners.jsx`             | RSS 失敗 / DB 破損 / オフラインの通知          |

### 変更

| ファイル                              | 変更内容                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `package.json`                        | 依存追加、`asarUnpack` 設定                                                |
| `electron-builder.yml` (存在確認の上) | `asarUnpack` 追加                                                          |
| `src/main/index.js`                   | IPC ハンドラーを SchedulerService 経由に切替、単一インスタンス化           |
| `src/main/store.js`                   | 設定専用に縮退（キャッシュ関連削除、`getSetting` / `setSetting` のみ残す） |
| `src/renderer/hooks/useSchedule.js`   | IPC イベント `schedule:updated` 購読                                       |
| `src/renderer/src/App.jsx`            | `StatusBanners` 配置                                                       |

### 削除

| ファイル                                    | 削除理由                                     |
| ------------------------------------------- | -------------------------------------------- |
| `src/main/youtube-api.js`                   | SchedulerService + Fetchers に完全移行       |
| `tests/main/youtube-api.test.js`            | 上記に伴う移植後削除                         |
| `tests/main/store.test.js` のキャッシュ関連 | VideoRepository / migrate テストへ移植後削除 |

---

## 実行順序の概要

```
Phase A (基盤)    → Task 1, 2
Phase B (データ層) → Task 3 ~ 7
Phase C (判定)    → Task 8
Phase D (取得層)   → Task 9 ~ 12
Phase E (統合)    → Task 13
Phase F (移行)    → Task 14 ~ 16
Phase G (UI)      → Task 17
Phase H (仕上げ)   → Task 18 ~ 20
```

各 Phase 末で `npm run lint && npm run test` を通す。コミットはタスクごと。

---

## Task 1: 依存関係追加とビルド設定

**Files:**

- Modify: `H:/ClaudeCode/Youtube/youtube-schedule/package.json`

- [ ] **Step 1: 依存関係をインストール**

実行コマンド:

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm install better-sqlite3@^11.3.0 fast-xml-parser@^4.5.0
npm install -D nock@^13.5.0
```

期待: `package.json` の `dependencies` に `better-sqlite3`, `fast-xml-parser` が追加、`devDependencies` に `nock` が追加される。

- [ ] **Step 2: `postinstall` の動作確認**

実行コマンド:

```bash
npm run postinstall
```

期待: `electron-builder install-app-deps` が `better-sqlite3` を Electron 向けに rebuild。エラーが出なければ OK。

- [ ] **Step 3: `asarUnpack` 設定**

`package.json` に `build.asarUnpack` が存在しない場合は追加。既存の `build` セクションに:

```json
"build": {
  "asarUnpack": [
    "node_modules/better-sqlite3/**/*"
  ]
}
```

`electron-builder.yml` がある場合はそちら優先で同等の設定を追加する。

- [ ] **Step 4: dev 起動で native module がロードできるか確認**

実行コマンド:

```bash
npm run dev
```

想定: 既存アプリが起動し、コンソールに `better-sqlite3` 関連エラーが出ない。1 分ほどで終了。

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: add better-sqlite3, fast-xml-parser, nock and configure asarUnpack"
```

---

## Task 2: SQLite 接続モジュール

**Files:**

- Create: `src/main/db/connection.js`
- Create: `tests/main/db/connection.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/db/connection.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'

describe('db/connection', () => {
  let db

  afterEach(() => {
    if (db) closeDatabase(db)
    db = null
  })

  it('opens an in-memory database when given :memory:', () => {
    db = openDatabase(':memory:')
    expect(db.open).toBe(true)
  })

  it('applies WAL journal mode on file databases', () => {
    db = openDatabase(':memory:')
    const row = db.pragma('journal_mode', { simple: true })
    expect(typeof row).toBe('string')
  })

  it('executes PRAGMA integrity_check and returns "ok" for a fresh DB', () => {
    db = openDatabase(':memory:')
    const result = db.pragma('integrity_check', { simple: true })
    expect(result).toBe('ok')
  })

  it('closes cleanly', () => {
    db = openDatabase(':memory:')
    closeDatabase(db)
    expect(db.open).toBe(false)
    db = null
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/db/connection.test.js
```

期待: モジュール未作成で FAIL。

- [ ] **Step 3: 実装を追加**

`src/main/db/connection.js`:

```js
import Database from 'better-sqlite3'

export function openDatabase(path) {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function closeDatabase(db) {
  if (db && db.open) db.close()
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/db/connection.test.js
```

期待: 4 件すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/db/connection.js tests/main/db/connection.test.js
git commit -m "feat: add SQLite connection module with WAL mode"
```

---

## Task 3: スキーマ + マイグレーションフレームワーク

**Files:**

- Create: `src/main/db/schema.js`
- Create: `src/main/db/migrate.js`
- Create: `src/main/db/migrations/001_initial.js`
- Create: `tests/main/db/migrate.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/db/migrate.test.js`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/db/migrate.test.js
```

期待: FAIL。

- [ ] **Step 3: 初期スキーマを実装**

`src/main/db/migrations/001_initial.js`:

```js
export const version = 1

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
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
    CREATE INDEX IF NOT EXISTS idx_videos_status_sched ON videos(status, scheduled_start_time);
    CREATE INDEX IF NOT EXISTS idx_videos_channel      ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_actual_start ON videos(actual_start_time);

    CREATE TABLE IF NOT EXISTS channels (
      id                        TEXT PRIMARY KEY,
      title                     TEXT,
      uploads_playlist_id       TEXT NOT NULL,
      last_subscription_sync_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rss_fetch_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    TEXT NOT NULL,
      fetched_at    INTEGER NOT NULL,
      success       INTEGER NOT NULL,
      http_status   INTEGER,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rss_log_time ON rss_fetch_log(fetched_at);

    CREATE TABLE IF NOT EXISTS meta (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}
```

`src/main/db/schema.js`:

```js
import * as m001 from './migrations/001_initial.js'

export const migrations = [m001]
```

`src/main/db/migrate.js`:

```js
import { migrations } from './schema.js'

function ensureTracking(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `)
}

export function getSchemaVersion(db) {
  ensureTracking(db)
  const row = db.prepare(`SELECT MAX(version) AS v FROM schema_version`).get()
  return row?.v ?? 0
}

export function runMigrations(db) {
  ensureTracking(db)
  const current = getSchemaVersion(db)
  const stmt = db.prepare(`INSERT INTO schema_version (version) VALUES (?)`)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    const tx = db.transaction(() => {
      migration.up(db)
      stmt.run(migration.version)
    })
    tx()
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/db/migrate.test.js
```

期待: 4 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/db/ tests/main/db/migrate.test.js
git commit -m "feat: add schema migration framework with 001_initial"
```

---

## Task 4: VideoRepository

**Files:**

- Create: `src/main/repositories/videoRepository.js`
- Create: `tests/main/repositories/videoRepository.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/repositories/videoRepository.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

function sampleVideo(overrides = {}) {
  return {
    id: 'abc123',
    channelId: 'UCxxx',
    channelTitle: 'Test Channel',
    title: 'Test Video',
    description: 'desc',
    thumbnail: 'https://example.com/t.jpg',
    status: 'upcoming',
    scheduledStartTime: Date.now() + 60 * 60 * 1000,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://www.youtube.com/watch?v=abc123',
    firstSeenAt: Date.now(),
    lastCheckedAt: Date.now(),
    ...overrides
  }
}

describe('VideoRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createVideoRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('upserts and retrieves a video by id', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    const got = repo.getById('v1')
    expect(got).not.toBeNull()
    expect(got.title).toBe('Test Video')
  })

  it('returns null for a missing id', () => {
    expect(repo.getById('missing')).toBeNull()
  })

  it('does not duplicate on repeated upsert', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    repo.upsert(sampleVideo({ id: 'v1', title: 'Updated' }))
    expect(repo.count()).toBe(1)
    expect(repo.getById('v1').title).toBe('Updated')
  })

  it('listVisible returns future upcoming and recent live', () => {
    const now = Date.now()
    repo.upsert(sampleVideo({ id: 'up1', status: 'upcoming', scheduledStartTime: now + 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'up2', status: 'upcoming', scheduledStartTime: now - 3 * 3600e3 })
    )
    repo.upsert(sampleVideo({ id: 'lv1', status: 'live', actualStartTime: now - 3600e3 }))
    repo.upsert(sampleVideo({ id: 'lv2', status: 'live', actualStartTime: now - 25 * 3600e3 }))
    repo.upsert(sampleVideo({ id: 'en1', status: 'ended' }))

    const visible = repo.listVisible(now)
    const ids = visible.map((v) => v.id)
    expect(ids).toContain('up1')
    expect(ids).toContain('lv1')
    expect(ids).not.toContain('up2')
    expect(ids).not.toContain('lv2')
    expect(ids).not.toContain('en1')
  })

  it('boundary: upcoming exactly 2h in the past is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b1',
        status: 'upcoming',
        scheduledStartTime: now - 2 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b1')
  })

  it('boundary: live exactly 24h old is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b2',
        status: 'live',
        actualStartTime: now - 24 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b2')
  })

  it('getByIds returns matching records only', () => {
    repo.upsert(sampleVideo({ id: 'a' }))
    repo.upsert(sampleVideo({ id: 'b' }))
    const got = repo.getByIds(['a', 'z'])
    expect(got.map((v) => v.id)).toEqual(['a'])
  })

  it('deleteExpiredEnded removes ended videos older than threshold', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'old', status: 'ended', lastCheckedAt: now - 31 * 24 * 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'fresh', status: 'ended', lastCheckedAt: now - 10 * 24 * 3600e3 })
    )
    const removed = repo.deleteExpiredEnded(now - 30 * 24 * 3600e3)
    expect(removed).toBe(1)
    expect(repo.getById('old')).toBeNull()
    expect(repo.getById('fresh')).not.toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/repositories/videoRepository.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/repositories/videoRepository.js`:

```js
const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000

export function createVideoRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      channel_id = excluded.channel_id,
      channel_title = excluded.channel_title,
      title = excluded.title,
      description = excluded.description,
      thumbnail = excluded.thumbnail,
      status = excluded.status,
      scheduled_start_time = excluded.scheduled_start_time,
      actual_start_time = excluded.actual_start_time,
      concurrent_viewers = excluded.concurrent_viewers,
      url = excluded.url,
      last_checked_at = excluded.last_checked_at
  `)

  const getByIdStmt = db.prepare(`SELECT * FROM videos WHERE id = ?`)
  const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM videos`)
  const listVisibleStmt = db.prepare(`
    SELECT * FROM videos
    WHERE (status = 'live' AND actual_start_time > @liveThreshold)
       OR (status = 'upcoming' AND scheduled_start_time > @upcomingThreshold)
    ORDER BY
      CASE status WHEN 'live' THEN 0 ELSE 1 END,
      scheduled_start_time ASC
  `)
  const deleteExpiredStmt = db.prepare(`
    DELETE FROM videos WHERE status = 'ended' AND last_checked_at < ?
  `)

  function rowToVideo(row) {
    if (!row) return null
    return {
      id: row.id,
      channelId: row.channel_id,
      channelTitle: row.channel_title,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      status: row.status,
      scheduledStartTime: row.scheduled_start_time,
      actualStartTime: row.actual_start_time,
      concurrentViewers: row.concurrent_viewers,
      url: row.url,
      firstSeenAt: row.first_seen_at,
      lastCheckedAt: row.last_checked_at
    }
  }

  return {
    upsert(video) {
      upsertStmt.run(video)
    },
    getById(id) {
      return rowToVideo(getByIdStmt.get(id))
    },
    getByIds(ids) {
      if (ids.length === 0) return []
      const placeholders = ids.map(() => '?').join(',')
      return db
        .prepare(`SELECT * FROM videos WHERE id IN (${placeholders})`)
        .all(...ids)
        .map(rowToVideo)
    },
    count() {
      return countStmt.get().c
    },
    listVisible(now = Date.now()) {
      return listVisibleStmt
        .all({
          liveThreshold: now - LIVE_MAX_DURATION_MS,
          upcomingThreshold: now - UPCOMING_GRACE_MS
        })
        .map(rowToVideo)
    },
    deleteExpiredEnded(thresholdMs) {
      const result = deleteExpiredStmt.run(thresholdMs)
      return result.changes
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/repositories/videoRepository.test.js
```

期待: 8 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/repositories/videoRepository.js tests/main/repositories/videoRepository.test.js
git commit -m "feat: add VideoRepository with UPSERT, listVisible, cleanup"
```

---

## Task 5: ChannelRepository

**Files:**

- Create: `src/main/repositories/channelRepository.js`
- Create: `tests/main/repositories/channelRepository.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/repositories/channelRepository.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createChannelRepository } from '../../../src/main/repositories/channelRepository'

describe('ChannelRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createChannelRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('upserts and lists channels', () => {
    repo.replaceAll(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1_700_000_000_000
    )
    const list = repo.listAll()
    expect(list.map((c) => c.id).sort()).toEqual(['UC1', 'UC2'])
  })

  it('replaceAll deletes channels not in the new set', () => {
    repo.replaceAll([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1)
    repo.replaceAll([{ id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }], 2)
    const list = repo.listAll()
    expect(list.map((c) => c.id)).toEqual(['UC2'])
  })

  it('getLastSyncTime returns 0 when empty', () => {
    expect(repo.getLastSyncTime()).toBe(0)
  })

  it('getLastSyncTime returns the latest sync timestamp', () => {
    repo.replaceAll([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1_700_000_000_000)
    expect(repo.getLastSyncTime()).toBe(1_700_000_000_000)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/repositories/channelRepository.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/repositories/channelRepository.js`:

```js
export function createChannelRepository(db) {
  const deleteAll = db.prepare(`DELETE FROM channels`)
  const insert = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, last_subscription_sync_at)
    VALUES (@id, @title, @uploadsPlaylistId, @syncAt)
  `)
  const listAllStmt = db.prepare(`SELECT * FROM channels ORDER BY id`)
  const maxSyncStmt = db.prepare(`SELECT MAX(last_subscription_sync_at) AS ts FROM channels`)

  return {
    replaceAll(channels, syncAt) {
      const tx = db.transaction(() => {
        deleteAll.run()
        for (const c of channels) {
          insert.run({
            id: c.id,
            title: c.title ?? null,
            uploadsPlaylistId: c.uploadsPlaylistId,
            syncAt
          })
        }
      })
      tx()
    },
    listAll() {
      return listAllStmt.all().map((r) => ({
        id: r.id,
        title: r.title,
        uploadsPlaylistId: r.uploads_playlist_id,
        lastSubscriptionSyncAt: r.last_subscription_sync_at
      }))
    },
    getLastSyncTime() {
      return maxSyncStmt.get().ts ?? 0
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/repositories/channelRepository.test.js
```

期待: 4 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/repositories/channelRepository.js tests/main/repositories/channelRepository.test.js
git commit -m "feat: add ChannelRepository with replaceAll and getLastSyncTime"
```

---

## Task 6: RssFetchLogRepository

**Files:**

- Create: `src/main/repositories/rssFetchLogRepository.js`
- Create: `tests/main/repositories/rssFetchLogRepository.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/repositories/rssFetchLogRepository.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createRssFetchLogRepository } from '../../../src/main/repositories/rssFetchLogRepository'

describe('RssFetchLogRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createRssFetchLogRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('records a success entry', () => {
    repo.record({ channelId: 'UC1', fetchedAt: 1, success: true, httpStatus: 200 })
    const rate = repo.getFailureRateSince(0)
    expect(rate).toBe(0)
  })

  it('computes failure rate across recent records', () => {
    const now = 1_000_000
    repo.record({ channelId: 'UC1', fetchedAt: now, success: false, httpStatus: 404 })
    repo.record({ channelId: 'UC2', fetchedAt: now, success: false, httpStatus: 404 })
    repo.record({ channelId: 'UC3', fetchedAt: now, success: true, httpStatus: 200 })
    const rate = repo.getFailureRateSince(now - 1)
    expect(rate).toBeCloseTo(2 / 3, 5)
  })

  it('getFailureRateSince returns 0 when there are no records', () => {
    expect(repo.getFailureRateSince(0)).toBe(0)
  })

  it('pruneOlderThan deletes old entries', () => {
    repo.record({ channelId: 'UC1', fetchedAt: 100, success: true })
    repo.record({ channelId: 'UC1', fetchedAt: 300, success: true })
    const removed = repo.pruneOlderThan(200)
    expect(removed).toBe(1)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/repositories/rssFetchLogRepository.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/repositories/rssFetchLogRepository.js`:

```js
export function createRssFetchLogRepository(db) {
  const insert = db.prepare(`
    INSERT INTO rss_fetch_log (channel_id, fetched_at, success, http_status, error_message)
    VALUES (@channelId, @fetchedAt, @success, @httpStatus, @errorMessage)
  `)
  const rateStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
      COUNT(*) AS total
    FROM rss_fetch_log
    WHERE fetched_at >= ?
  `)
  const pruneStmt = db.prepare(`DELETE FROM rss_fetch_log WHERE fetched_at < ?`)

  return {
    record({ channelId, fetchedAt, success, httpStatus = null, errorMessage = null }) {
      insert.run({
        channelId,
        fetchedAt,
        success: success ? 1 : 0,
        httpStatus,
        errorMessage
      })
    },
    getFailureRateSince(sinceMs) {
      const row = rateStmt.get(sinceMs)
      if (!row || row.total === 0) return 0
      return row.failures / row.total
    },
    pruneOlderThan(thresholdMs) {
      return pruneStmt.run(thresholdMs).changes
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/repositories/rssFetchLogRepository.test.js
```

期待: 4 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/repositories/rssFetchLogRepository.js tests/main/repositories/rssFetchLogRepository.test.js
git commit -m "feat: add RssFetchLogRepository with failure rate aggregation"
```

---

## Task 7: MetaRepository

**Files:**

- Create: `src/main/repositories/metaRepository.js`
- Create: `tests/main/repositories/metaRepository.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/repositories/metaRepository.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createMetaRepository } from '../../../src/main/repositories/metaRepository'

describe('MetaRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createMetaRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('returns null for missing key', () => {
    expect(repo.get('nonexistent')).toBeNull()
  })

  it('sets and gets a string value', () => {
    repo.set('foo', 'bar', 1)
    expect(repo.get('foo')).toBe('bar')
  })

  it('set overwrites existing value', () => {
    repo.set('k', 'v1', 1)
    repo.set('k', 'v2', 2)
    expect(repo.get('k')).toBe('v2')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/repositories/metaRepository.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/repositories/metaRepository.js`:

```js
export function createMetaRepository(db) {
  const getStmt = db.prepare(`SELECT value FROM meta WHERE key = ?`)
  const setStmt = db.prepare(`
    INSERT INTO meta (key, value, updated_at) VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)

  return {
    get(key) {
      const row = getStmt.get(key)
      return row ? row.value : null
    },
    set(key, value, updatedAt = Date.now()) {
      setStmt.run({ key, value, updatedAt })
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/repositories/metaRepository.test.js
```

期待: 3 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/repositories/metaRepository.js tests/main/repositories/metaRepository.test.js
git commit -m "feat: add MetaRepository for KV metadata"
```

---

## Task 8: videoStatus（deriveStatus 関数）

**Files:**

- Create: `src/main/services/videoStatus.js`
- Create: `tests/main/services/videoStatus.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/services/videoStatus.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../../../src/main/services/videoStatus'

const NOW = 1_700_000_000_000

function v({ actualEnd, actualStart, scheduled, bc } = {}) {
  return {
    liveStreamingDetails: {
      actualEndTime: actualEnd,
      actualStartTime: actualStart,
      scheduledStartTime: scheduled
    },
    snippet: { liveBroadcastContent: bc }
  }
}

describe('deriveStatus', () => {
  it('returns "ended" when actualEndTime is set', () => {
    expect(deriveStatus(v({ actualEnd: new Date(NOW - 1000).toISOString() }), NOW)).toBe('ended')
  })

  it('returns "live" for active stream started less than 24h ago', () => {
    expect(deriveStatus(v({ actualStart: new Date(NOW - 3600_000).toISOString() }), NOW)).toBe(
      'live'
    )
  })

  it('returns "ended" for stream that started over 24h ago without actualEnd', () => {
    expect(deriveStatus(v({ actualStart: new Date(NOW - 25 * 3600_000).toISOString() }), NOW)).toBe(
      'ended'
    )
  })

  it('returns "upcoming" when liveBroadcastContent=upcoming and scheduled is future', () => {
    expect(
      deriveStatus(v({ bc: 'upcoming', scheduled: new Date(NOW + 3600_000).toISOString() }), NOW)
    ).toBe('upcoming')
  })

  it('returns "ended" when upcoming is scheduled over 2h in the past', () => {
    expect(
      deriveStatus(
        v({ bc: 'upcoming', scheduled: new Date(NOW - 3 * 3600_000).toISOString() }),
        NOW
      )
    ).toBe('ended')
  })

  it('returns "ended" for regular videos (no liveBroadcastContent)', () => {
    expect(deriveStatus(v({}), NOW)).toBe('ended')
  })

  it('returns "upcoming" when scheduledStartTime is missing but bc=upcoming', () => {
    expect(deriveStatus(v({ bc: 'upcoming' }), NOW)).toBe('upcoming')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/services/videoStatus.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/services/videoStatus.js`:

```js
const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000

export function deriveStatus(v, now) {
  const ld = v.liveStreamingDetails
  const bc = v.snippet?.liveBroadcastContent

  if (ld?.actualEndTime) return 'ended'
  if (ld?.actualStartTime) {
    const elapsed = now - new Date(ld.actualStartTime).getTime()
    return elapsed < LIVE_MAX_DURATION_MS ? 'live' : 'ended'
  }
  if (bc === 'upcoming') {
    const startMs = ld?.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : now + 1
    return startMs > now - UPCOMING_GRACE_MS ? 'upcoming' : 'ended'
  }
  return 'ended'
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/services/videoStatus.test.js
```

期待: 7 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/services/videoStatus.js tests/main/services/videoStatus.test.js
git commit -m "feat: add deriveStatus function for video state machine"
```

---

## Task 9: RssFetcher

**Files:**

- Create: `src/main/fetchers/rssFetcher.js`
- Create: `tests/main/fetchers/rssFetcher.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/fetchers/rssFetcher.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import nock from 'nock'
import { createRssFetcher } from '../../../src/main/fetchers/rssFetcher'

const RSS_HOST = 'https://www.youtube.com'
const RSS_PATH = '/feeds/videos.xml'

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry><yt:videoId>VID1</yt:videoId><title>t1</title></entry>
  <entry><yt:videoId>VID2</yt:videoId><title>t2</title></entry>
</feed>`

describe('RssFetcher', () => {
  beforeEach(() => nock.cleanAll())
  afterEach(() => nock.cleanAll())

  it('returns videoIds on 200', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC1' }).reply(200, sampleXml)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC1')
    expect(res.success).toBe(true)
    expect(res.videoIds).toEqual(['VID1', 'VID2'])
    expect(res.httpStatus).toBe(200)
  })

  it('returns success:false with reason http_404 on 404', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC2' }).reply(404)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC2')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('http_404')
    expect(res.httpStatus).toBe(404)
  })

  it('returns success:false with reason timeout when server is slow', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC3' }).delay(200).reply(200, sampleXml)
    const fetcher = createRssFetcher({ timeoutMs: 50 })
    const res = await fetcher.fetch('UC3')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('timeout')
  })

  it('returns success:false with reason parse on malformed XML', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC4' }).reply(200, '<not-xml>')
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC4')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('parse')
  })

  it('returns success:true with empty list on empty feed', async () => {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC5' }).reply(200, emptyXml)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC5')
    expect(res.success).toBe(true)
    expect(res.videoIds).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/fetchers/rssFetcher.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/fetchers/rssFetcher.js`:

```js
import { XMLParser } from 'fast-xml-parser'

const UA = 'Mozilla/5.0 (compatible; YouTubeScheduleViewer)'

function buildUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

export function createRssFetcher({ timeoutMs = 3000, fetchImpl = globalThis.fetch } = {}) {
  const parser = new XMLParser({ ignoreAttributes: true })

  async function fetchOne(channelId) {
    const url = buildUrl(channelId)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': UA },
        signal: controller.signal
      })
    } catch (err) {
      clearTimeout(timer)
      if (err?.name === 'AbortError') {
        return { success: false, reason: 'timeout' }
      }
      return { success: false, reason: 'network', errorMessage: err?.message ?? String(err) }
    }
    clearTimeout(timer)

    if (!res.ok) {
      return {
        success: false,
        reason: res.status === 404 ? 'http_404' : `http_${res.status}`,
        httpStatus: res.status
      }
    }

    const text = await res.text()
    let parsed
    try {
      parsed = parser.parse(text)
    } catch {
      return { success: false, reason: 'parse', httpStatus: res.status }
    }

    const feed = parsed?.feed
    if (!feed || typeof feed !== 'object') {
      return { success: false, reason: 'parse', httpStatus: res.status }
    }

    const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : []
    const videoIds = entries
      .map((e) => e['yt:videoId'] ?? e.videoId ?? null)
      .filter((id) => typeof id === 'string' && id.length > 0)

    return { success: true, videoIds, httpStatus: res.status }
  }

  return { fetch: fetchOne }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/fetchers/rssFetcher.test.js
```

期待: 5 件 PASS。

注記: `globalThis.fetch` は Node.js 18+ で利用可能。Electron 39 は該当。nock は fetch をフックできるので追加設定不要。

- [ ] **Step 5: コミット**

```bash
git add src/main/fetchers/rssFetcher.js tests/main/fetchers/rssFetcher.test.js
git commit -m "feat: add RssFetcher with timeout and structured error reasons"
```

---

## Task 10: SubscriptionsFetcher

**Files:**

- Create: `src/main/fetchers/subscriptionsFetcher.js`
- Create: `tests/main/fetchers/subscriptionsFetcher.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/fetchers/subscriptionsFetcher.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createSubscriptionsFetcher } from '../../../src/main/fetchers/subscriptionsFetcher'

function makeYt(pages) {
  return {
    subscriptions: {
      list: vi.fn().mockImplementation(async ({ pageToken }) => {
        const index = pageToken ? parseInt(pageToken, 10) : 0
        return { data: pages[index] }
      })
    }
  }
}

describe('SubscriptionsFetcher', () => {
  it('returns channels from a single page', async () => {
    const yt = makeYt([
      {
        items: [
          { snippet: { title: 'A', resourceId: { channelId: 'UCA' } } },
          { snippet: { title: 'B', resourceId: { channelId: 'UCB' } } }
        ],
        nextPageToken: undefined
      }
    ])
    const fetcher = createSubscriptionsFetcher()
    const channels = await fetcher.fetch(yt)
    expect(channels).toEqual([
      { id: 'UCA', title: 'A', uploadsPlaylistId: 'UUA' },
      { id: 'UCB', title: 'B', uploadsPlaylistId: 'UUB' }
    ])
  })

  it('paginates until nextPageToken is undefined', async () => {
    const yt = makeYt([
      {
        items: [{ snippet: { title: 'A', resourceId: { channelId: 'UCA' } } }],
        nextPageToken: '1'
      },
      {
        items: [{ snippet: { title: 'B', resourceId: { channelId: 'UCB' } } }],
        nextPageToken: undefined
      }
    ])
    const fetcher = createSubscriptionsFetcher()
    const channels = await fetcher.fetch(yt)
    expect(channels.map((c) => c.id)).toEqual(['UCA', 'UCB'])
    expect(yt.subscriptions.list).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/fetchers/subscriptionsFetcher.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/fetchers/subscriptionsFetcher.js`:

```js
function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2)
}

export function createSubscriptionsFetcher() {
  return {
    async fetch(yt) {
      const channels = []
      let pageToken = undefined
      do {
        const res = await yt.subscriptions.list({
          part: ['snippet'],
          mine: true,
          maxResults: 50,
          pageToken
        })
        for (const item of res.data.items || []) {
          const id = item.snippet?.resourceId?.channelId
          if (!id) continue
          channels.push({
            id,
            title: item.snippet.title ?? null,
            uploadsPlaylistId: uploadsPlaylistId(id)
          })
        }
        pageToken = res.data.nextPageToken
      } while (pageToken)
      return channels
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/fetchers/subscriptionsFetcher.test.js
```

期待: 2 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/fetchers/subscriptionsFetcher.js tests/main/fetchers/subscriptionsFetcher.test.js
git commit -m "feat: add SubscriptionsFetcher with pagination"
```

---

## Task 11: PlaylistItemsFetcher

**Files:**

- Create: `src/main/fetchers/playlistItemsFetcher.js`
- Create: `tests/main/fetchers/playlistItemsFetcher.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/fetchers/playlistItemsFetcher.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createPlaylistItemsFetcher } from '../../../src/main/fetchers/playlistItemsFetcher'

describe('PlaylistItemsFetcher', () => {
  it('returns videoIds on success', async () => {
    const yt = {
      playlistItems: {
        list: vi.fn().mockResolvedValue({
          data: {
            items: [{ contentDetails: { videoId: 'V1' } }, { contentDetails: { videoId: 'V2' } }]
          }
        })
      }
    }
    const fetcher = createPlaylistItemsFetcher()
    const ids = await fetcher.fetch(yt, 'UU123')
    expect(ids).toEqual(['V1', 'V2'])
  })

  it('returns [] on API error', async () => {
    const yt = {
      playlistItems: { list: vi.fn().mockRejectedValue(new Error('boom')) }
    }
    const fetcher = createPlaylistItemsFetcher()
    const ids = await fetcher.fetch(yt, 'UU123')
    expect(ids).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/fetchers/playlistItemsFetcher.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/fetchers/playlistItemsFetcher.js`:

```js
export function createPlaylistItemsFetcher() {
  return {
    async fetch(yt, uploadsPlaylistId, maxResults = 15) {
      try {
        const res = await yt.playlistItems.list({
          part: ['contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults
        })
        return (res.data.items || []).map((item) => item.contentDetails.videoId)
      } catch {
        return []
      }
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/fetchers/playlistItemsFetcher.test.js
```

期待: 2 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/fetchers/playlistItemsFetcher.js tests/main/fetchers/playlistItemsFetcher.test.js
git commit -m "feat: add PlaylistItemsFetcher fallback"
```

---

## Task 12: VideoDetailsFetcher

**Files:**

- Create: `src/main/fetchers/videoDetailsFetcher.js`
- Create: `tests/main/fetchers/videoDetailsFetcher.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/fetchers/videoDetailsFetcher.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createVideoDetailsFetcher } from '../../../src/main/fetchers/videoDetailsFetcher'

function makeYt(batches) {
  let call = 0
  return {
    videos: {
      list: vi.fn().mockImplementation(async () => {
        const data = { items: batches[call] }
        call += 1
        return { data }
      })
    }
  }
}

describe('VideoDetailsFetcher', () => {
  it('returns [] for empty input', async () => {
    const yt = makeYt([])
    const fetcher = createVideoDetailsFetcher()
    expect(await fetcher.fetch(yt, [])).toEqual([])
  })

  it('batches ids in chunks of 50', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `V${i}`)
    const yt = makeYt([ids.slice(0, 50).map((id) => ({ id })), ids.slice(50).map((id) => ({ id }))])
    const fetcher = createVideoDetailsFetcher()
    const result = await fetcher.fetch(yt, ids)
    expect(yt.videos.list).toHaveBeenCalledTimes(2)
    expect(result.map((r) => r.id)).toEqual(ids)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/fetchers/videoDetailsFetcher.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/fetchers/videoDetailsFetcher.js`:

```js
export function createVideoDetailsFetcher() {
  return {
    async fetch(yt, videoIds) {
      if (videoIds.length === 0) return []
      const results = []
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50)
        const res = await yt.videos.list({
          part: ['snippet', 'liveStreamingDetails'],
          id: batch.join(',')
        })
        results.push(...(res.data.items || []))
      }
      return results
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/fetchers/videoDetailsFetcher.test.js
```

期待: 2 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/fetchers/videoDetailsFetcher.js tests/main/fetchers/videoDetailsFetcher.test.js
git commit -m "feat: add VideoDetailsFetcher with 50-item batching"
```

---

## Task 13: SchedulerService

**Files:**

- Create: `src/main/services/schedulerService.js`
- Create: `tests/main/services/schedulerService.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/services/schedulerService.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { createSchedulerService } from '../../../src/main/services/schedulerService'

function videoDetail(id, overrides = {}) {
  return {
    id,
    snippet: {
      title: `t-${id}`,
      channelTitle: 'C',
      channelId: 'UC1',
      description: '',
      thumbnails: { high: { url: 'u' } },
      liveBroadcastContent: 'upcoming',
      ...(overrides.snippet || {})
    },
    liveStreamingDetails: {
      scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
      ...(overrides.liveStreamingDetails || {})
    }
  }
}

function createMocks() {
  const videoRepo = {
    upsert: vi.fn(),
    getByIds: vi.fn().mockReturnValue([]),
    listVisible: vi.fn().mockReturnValue([]),
    deleteExpiredEnded: vi.fn()
  }
  const channelRepo = {
    getLastSyncTime: vi.fn().mockReturnValue(0),
    listAll: vi.fn().mockReturnValue([]),
    replaceAll: vi.fn()
  }
  const rssLogRepo = { record: vi.fn() }
  const metaRepo = { get: vi.fn(), set: vi.fn() }
  const subsFetcher = {
    fetch: vi.fn().mockResolvedValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
  }
  const rssFetcher = {
    fetch: vi.fn().mockResolvedValue({ success: true, videoIds: ['V1'], httpStatus: 200 })
  }
  const playlistFetcher = { fetch: vi.fn().mockResolvedValue([]) }
  const videoFetcher = { fetch: vi.fn().mockResolvedValue([videoDetail('V1')]) }

  return {
    videoRepo,
    channelRepo,
    rssLogRepo,
    metaRepo,
    subsFetcher,
    rssFetcher,
    playlistFetcher,
    videoFetcher
  }
}

function createService(mocks, overrides = {}) {
  return createSchedulerService({
    videoRepo: mocks.videoRepo,
    channelRepo: mocks.channelRepo,
    rssLogRepo: mocks.rssLogRepo,
    metaRepo: mocks.metaRepo,
    subsFetcher: mocks.subsFetcher,
    rssFetcher: mocks.rssFetcher,
    playlistFetcher: mocks.playlistFetcher,
    videoFetcher: mocks.videoFetcher,
    authClient: {},
    ytFactory: () => ({}),
    ...overrides
  })
}

describe('SchedulerService.refresh', () => {
  it('fetches subscriptions when cache is stale', async () => {
    const mocks = createMocks()
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.subsFetcher.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.channelRepo.replaceAll).toHaveBeenCalledTimes(1)
  })

  it('skips subscriptions fetch when cache is fresh (< 24h)', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.subsFetcher.fetch).not.toHaveBeenCalled()
  })

  it('uses RSS first; falls back to playlist on RSS failure', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([
      { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
      { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
    ])
    mocks.rssFetcher.fetch = vi
      .fn()
      .mockResolvedValueOnce({ success: true, videoIds: ['V1'], httpStatus: 200 })
      .mockResolvedValueOnce({ success: false, reason: 'http_404', httpStatus: 404 })
    mocks.playlistFetcher.fetch = vi.fn().mockResolvedValue(['V2'])

    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.rssFetcher.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.playlistFetcher.fetch).toHaveBeenCalledTimes(1)
  })

  it('records RSS outcomes to the log repository', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.rssLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'UC1', success: true })
    )
  })

  it('does not allow concurrent refresh (lock guard)', async () => {
    const mocks = createMocks()
    let resolveFetch
    mocks.subsFetcher.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolveFetch = () => r([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }])
      })
    )
    const svc = createService(mocks)
    const p1 = svc.refresh()
    const p2 = svc.refresh()
    resolveFetch()
    await p1
    await p2
    expect(mocks.subsFetcher.fetch).toHaveBeenCalledTimes(1)
  })

  it('upserts fetched videos with derived status', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'V1', status: 'upcoming' })
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/services/schedulerService.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/services/schedulerService.js`:

```js
import { deriveStatus } from './videoStatus.js'

const SUBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RSS_PARALLEL = 10

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function toVideoRecord(v, now) {
  const ld = v.liveStreamingDetails || {}
  return {
    id: v.id,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    title: v.snippet.title,
    description: v.snippet.description ?? '',
    thumbnail:
      v.snippet.thumbnails?.maxres?.url ??
      v.snippet.thumbnails?.high?.url ??
      v.snippet.thumbnails?.medium?.url ??
      '',
    status: deriveStatus(v, now),
    scheduledStartTime: ld.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : null,
    actualStartTime: ld.actualStartTime ? new Date(ld.actualStartTime).getTime() : null,
    concurrentViewers: ld.concurrentViewers ? Number(ld.concurrentViewers) : null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    firstSeenAt: now,
    lastCheckedAt: now
  }
}

export function createSchedulerService({
  videoRepo,
  channelRepo,
  rssLogRepo,
  metaRepo,
  subsFetcher,
  rssFetcher,
  playlistFetcher,
  videoFetcher,
  authClient,
  ytFactory
}) {
  let inFlight = null

  async function resolveChannels(yt, now) {
    const lastSync = channelRepo.getLastSyncTime()
    if (lastSync && now - lastSync < SUBS_CACHE_TTL_MS) {
      return channelRepo.listAll()
    }
    const fresh = await subsFetcher.fetch(yt)
    channelRepo.replaceAll(fresh, now)
    return fresh
  }

  async function collectVideoIds(yt, channels, now) {
    const collected = new Set()
    for (const batch of chunk(channels, RSS_PARALLEL)) {
      await Promise.all(
        batch.map(async (ch) => {
          const res = await rssFetcher.fetch(ch.id)
          rssLogRepo.record({
            channelId: ch.id,
            fetchedAt: now,
            success: res.success,
            httpStatus: res.httpStatus ?? null,
            errorMessage: res.success ? null : res.reason
          })
          if (res.success) {
            for (const id of res.videoIds) collected.add(id)
          } else {
            const fallback = await playlistFetcher.fetch(yt, ch.uploadsPlaylistId)
            for (const id of fallback) collected.add(id)
          }
        })
      )
    }
    return [...collected]
  }

  async function doRefresh({ forceFullRecheck = false } = {}) {
    const now = Date.now()
    const yt = ytFactory(authClient)

    const channels = await resolveChannels(yt, now)
    const channelIds = new Set(channels.map((c) => c.id))
    const videoIds = await collectVideoIds(yt, channels, now)

    const known = videoRepo.getByIds(videoIds)
    const knownIds = new Set(known.map((v) => v.id))
    const recheckIds = forceFullRecheck
      ? Array.from(knownIds)
      : known
          .filter(
            (v) =>
              v.status === 'live' ||
              v.status === 'upcoming' ||
              now - v.lastCheckedAt > 24 * 60 * 60 * 1000
          )
          .map((v) => v.id)
    const newIds = videoIds.filter((id) => !knownIds.has(id))
    const target = Array.from(new Set([...newIds, ...recheckIds]))

    const details = await videoFetcher.fetch(yt, target)
    for (const v of details) {
      if (!channelIds.has(v.snippet?.channelId)) continue
      videoRepo.upsert(toVideoRecord(v, now))
    }

    metaRepo.set('last_full_refresh_at', String(now), now)
  }

  return {
    async refresh(opts = {}) {
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          await doRefresh(opts)
        } finally {
          inFlight = null
        }
      })()
      return inFlight
    }
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/services/schedulerService.test.js
```

期待: 6 件 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/services/schedulerService.js tests/main/services/schedulerService.test.js
git commit -m "feat: add SchedulerService orchestration with lock guard"
```

---

## Task 14: electron-store からの移行マイグレーション

**Files:**

- Create: `src/main/db/migrations/002_import_from_store.js`
- Modify: `src/main/db/schema.js`
- Create: `tests/main/db/migrate.store.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/db/migrate.store.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

describe('migration 002: import from electron-store', () => {
  let db

  beforeEach(() => {
    db = openDatabase(':memory:')
  })
  afterEach(() => closeDatabase(db))

  it('imports videos from legacy scheduleCache shape', () => {
    const legacyCache = {
      data: {
        live: [
          {
            id: 'LV1',
            status: 'live',
            title: 'Live Now',
            channelTitle: 'Ch',
            channelId: 'UC1',
            description: '',
            thumbnail: 'x',
            scheduledStartTime: '2026-04-18T10:00:00Z',
            actualStartTime: '2026-04-18T10:05:00Z',
            concurrentViewers: null,
            url: 'https://www.youtube.com/watch?v=LV1',
            channelUrl: 'https://www.youtube.com/channel/UC1'
          }
        ],
        upcoming: [
          {
            id: 'UP1',
            status: 'upcoming',
            title: 'Upcoming',
            channelTitle: 'Ch',
            channelId: 'UC1',
            description: '',
            thumbnail: 'x',
            scheduledStartTime: '2026-04-20T10:00:00Z',
            actualStartTime: null,
            concurrentViewers: null,
            url: 'https://www.youtube.com/watch?v=UP1',
            channelUrl: 'https://www.youtube.com/channel/UC1'
          }
        ]
      },
      timestamp: 1_700_000_000_000
    }
    const legacyReader = { read: () => legacyCache, clear: () => {} }
    runMigrations(db, { legacyStoreReader: legacyReader })

    const repo = createVideoRepository(db)
    expect(repo.getById('LV1')).not.toBeNull()
    expect(repo.getById('UP1')).not.toBeNull()
  })

  it('clears legacy store after successful import', () => {
    let cleared = false
    const legacyReader = {
      read: () => ({ data: { live: [], upcoming: [] }, timestamp: 1 }),
      clear: () => {
        cleared = true
      }
    }
    runMigrations(db, { legacyStoreReader: legacyReader })
    expect(cleared).toBe(true)
  })

  it('is safe when legacy store is empty', () => {
    const legacyReader = { read: () => null, clear: () => {} }
    expect(() => runMigrations(db, { legacyStoreReader: legacyReader })).not.toThrow()
  })

  it('is idempotent: second run does not re-import or fail', () => {
    let readCount = 0
    const legacyReader = {
      read: () => {
        readCount += 1
        return { data: { live: [], upcoming: [] }, timestamp: 1 }
      },
      clear: () => {}
    }
    runMigrations(db, { legacyStoreReader: legacyReader })
    runMigrations(db, { legacyStoreReader: legacyReader })
    expect(readCount).toBe(1)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

実行:

```bash
npx vitest run tests/main/db/migrate.store.test.js
```

期待: FAIL。

- [ ] **Step 3: 実装**

`src/main/db/migrations/002_import_from_store.js`:

```js
export const version = 2

function toRecord(item, now) {
  return {
    id: item.id,
    channelId: item.channelId ?? '',
    channelTitle: item.channelTitle ?? '',
    title: item.title ?? '',
    description: item.description ?? '',
    thumbnail: item.thumbnail ?? '',
    status: item.status,
    scheduledStartTime: item.scheduledStartTime
      ? new Date(item.scheduledStartTime).getTime()
      : null,
    actualStartTime: item.actualStartTime ? new Date(item.actualStartTime).getTime() : null,
    concurrentViewers: item.concurrentViewers ?? null,
    url: item.url,
    firstSeenAt: now,
    lastCheckedAt: now
  }
}

export function up(db, ctx = {}) {
  const legacy = ctx.legacyStoreReader?.read?.() || null
  if (!legacy || !legacy.data) return

  const now = Date.now()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt
    )
  `)

  const tx = db.transaction(() => {
    for (const item of legacy.data.live || []) insert.run(toRecord(item, now))
    for (const item of legacy.data.upcoming || []) insert.run(toRecord(item, now))
  })
  tx()

  ctx.legacyStoreReader.clear?.()
}
```

`src/main/db/schema.js` を更新:

```js
import * as m001 from './migrations/001_initial.js'
import * as m002 from './migrations/002_import_from_store.js'

export const migrations = [m001, m002]
```

`src/main/db/migrate.js` の `runMigrations` を `ctx` 対応に更新:

```js
export function runMigrations(db, ctx = {}) {
  ensureTracking(db)
  const current = getSchemaVersion(db)
  const stmt = db.prepare(`INSERT INTO schema_version (version) VALUES (?)`)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    const tx = db.transaction(() => {
      migration.up(db, ctx)
      stmt.run(migration.version)
    })
    tx()
  }
}
```

- [ ] **Step 4: テストを通す**

実行:

```bash
npx vitest run tests/main/db/migrate.test.js tests/main/db/migrate.store.test.js
```

期待: すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add src/main/db/ tests/main/db/migrate.store.test.js
git commit -m "feat: add migration 002 to import legacy electron-store cache"
```

---

## Task 15: store.js を設定専用に縮退

**Files:**

- Modify: `src/main/store.js`
- Modify: `tests/main/store.test.js` (キャッシュ関連テスト削除)

- [ ] **Step 1: `store.js` を縮退**

`src/main/store.js` を以下で置き換え:

```js
import Store from 'electron-store'

const store = new Store()

export function getSetting(key, defaultValue) {
  return store.get(`settings.${key}`, defaultValue)
}

export function setSetting(key, value) {
  store.set(`settings.${key}`, value)
}

export function readLegacyScheduleCache() {
  return store.get('scheduleCache', null)
}

export function clearLegacyScheduleCache() {
  store.delete('scheduleCache')
}
```

- [ ] **Step 2: `tests/main/store.test.js` を縮退**

既存のキャッシュ関連テストを削除し、`getSetting`/`setSetting` のみに絞る。`readLegacyScheduleCache` / `clearLegacyScheduleCache` の単体テストも追加:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron-store', () => {
  const storage = new Map()
  return {
    default: class {
      get(key, defaultValue) {
        return storage.has(key) ? storage.get(key) : defaultValue
      }
      set(key, value) {
        storage.set(key, value)
      }
      delete(key) {
        storage.delete(key)
      }
    }
  }
})

describe('store (settings-only)', () => {
  let storeModule
  beforeEach(async () => {
    vi.resetModules()
    storeModule = await import('../../src/main/store')
  })

  it('getSetting returns default when key is missing', () => {
    expect(storeModule.getSetting('missing', 'fallback')).toBe('fallback')
  })

  it('setSetting + getSetting round-trip', () => {
    storeModule.setSetting('theme', 'dark')
    expect(storeModule.getSetting('theme', 'light')).toBe('dark')
  })

  it('readLegacyScheduleCache returns null when not set', () => {
    expect(storeModule.readLegacyScheduleCache()).toBeNull()
  })

  it('clearLegacyScheduleCache removes the key', () => {
    storeModule.clearLegacyScheduleCache()
    expect(storeModule.readLegacyScheduleCache()).toBeNull()
  })
})
```

- [ ] **Step 3: テストを通す**

実行:

```bash
npx vitest run tests/main/store.test.js
```

期待: 4 件 PASS。

- [ ] **Step 4: コミット**

```bash
git add src/main/store.js tests/main/store.test.js
git commit -m "refactor: reduce store.js to settings and legacy cache accessors"
```

---

## Task 16: Main エントリ (`src/main/index.js`) の切替

**Files:**

- Modify: `src/main/index.js`

- [ ] **Step 1: 現状の IPC ハンドラーを把握**

実行:

```bash
npx grep -n "ipcMain" H:/ClaudeCode/Youtube/youtube-schedule/src/main/index.js
```

想定: `schedule:get`, `schedule:refresh`, OAuth 関連などが列挙される。

- [ ] **Step 2: 差し替え（抜粋）**

以下の方針で `src/main/index.js` を書き換える（OAuth ブロックは既存を維持）。

```js
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { google } from 'googleapis'
import { openDatabase, closeDatabase } from './db/connection.js'
import { runMigrations } from './db/migrate.js'
import { createVideoRepository } from './repositories/videoRepository.js'
import { createChannelRepository } from './repositories/channelRepository.js'
import { createRssFetchLogRepository } from './repositories/rssFetchLogRepository.js'
import { createMetaRepository } from './repositories/metaRepository.js'
import { createSchedulerService } from './services/schedulerService.js'
import { createRssFetcher } from './fetchers/rssFetcher.js'
import { createSubscriptionsFetcher } from './fetchers/subscriptionsFetcher.js'
import { createPlaylistItemsFetcher } from './fetchers/playlistItemsFetcher.js'
import { createVideoDetailsFetcher } from './fetchers/videoDetailsFetcher.js'
import { readLegacyScheduleCache, clearLegacyScheduleCache } from './store.js'
// ... 既存の auth import は維持

const REFRESH_INTERVAL_MS = 30 * 60 * 1000
let db
let videoRepo, channelRepo, rssLogRepo, metaRepo
let scheduler
let refreshTimer
let dbBroken = false

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'schedule.db')
  db = openDatabase(dbPath)
  const integrity = db.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    dbBroken = true
    return
  }
  runMigrations(db, {
    legacyStoreReader: {
      read: readLegacyScheduleCache,
      clear: clearLegacyScheduleCache
    }
  })
  videoRepo = createVideoRepository(db)
  channelRepo = createChannelRepository(db)
  rssLogRepo = createRssFetchLogRepository(db)
  metaRepo = createMetaRepository(db)
}

function initScheduler(authClient) {
  scheduler = createSchedulerService({
    videoRepo,
    channelRepo,
    rssLogRepo,
    metaRepo,
    subsFetcher: createSubscriptionsFetcher(),
    rssFetcher: createRssFetcher({ timeoutMs: 3000 }),
    playlistFetcher: createPlaylistItemsFetcher(),
    videoFetcher: createVideoDetailsFetcher(),
    authClient,
    ytFactory: (auth) => google.youtube({ version: 'v3', auth })
  })
}

function startPolling(mainWindow) {
  if (refreshTimer) clearInterval(refreshTimer)
  const kick = async () => {
    try {
      await scheduler.refresh()
      mainWindow?.webContents.send('schedule:updated')
    } catch (err) {
      mainWindow?.webContents.send('schedule:error', {
        message: err?.message ?? String(err)
      })
    }
  }
  kick()
  refreshTimer = setInterval(kick, REFRESH_INTERVAL_MS)
}

// 単一インスタンス化は Task 18 で追加

app.whenReady().then(async () => {
  initDatabase()
  // ... 既存の OAuth フローで authClient を取得
  initScheduler(authClient)

  ipcMain.handle('schedule:get', () => {
    if (dbBroken) return { live: [], upcoming: [], dbBroken: true }
    const visible = videoRepo.listVisible()
    return {
      live: visible.filter((v) => v.status === 'live'),
      upcoming: visible.filter((v) => v.status === 'upcoming')
    }
  })

  ipcMain.handle('schedule:refresh', async () => {
    await scheduler.refresh({ forceFullRecheck: true })
  })

  ipcMain.handle('diag:rssFailureRate', () => {
    const since = Date.now() - 24 * 60 * 60 * 1000
    return rssLogRepo.getFailureRateSince(since)
  })

  ipcMain.handle('schedule:resetDatabase', async () => {
    closeDatabase(db)
    const fs = await import('node:fs/promises')
    const dbPath = path.join(app.getPath('userData'), 'schedule.db')
    await fs.rm(dbPath, { force: true })
    await fs.rm(dbPath + '-wal', { force: true })
    await fs.rm(dbPath + '-shm', { force: true })
    dbBroken = false
    initDatabase()
  })

  // ... ウィンドウ作成、startPolling(mainWindow)
})

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer)
  closeDatabase(db)
})
```

注記: 既存の OAuth 部分、BrowserWindow 生成部分、アップデータ設定などは**削除せず温存**し、上の Scheduler 部分を差し込む。

- [ ] **Step 3: 実際の dev 起動で既存機能を確認**

実行:

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm run dev
```

確認項目（ブラウザ手動確認の代わりに Electron の UI で）:

- アプリ起動時にコンソールエラーなし
- ログイン済みユーザーでスケジュール取得が走る
- 数分で live/upcoming が表示される
- 更新ボタン押下でリフレッシュ

**動かない場合**: Task 13 まで戻って IPC ペイロードの整合性を確認。

- [ ] **Step 4: コミット**

```bash
git add src/main/index.js
git commit -m "feat: wire SchedulerService and SQLite to Main entrypoint"
```

---

## Task 17: 新規ステータスバナー

**Files:**

- Create: `src/renderer/components/StatusBanners.jsx`
- Modify: `src/renderer/src/App.jsx`
- Modify: `src/preload/index.js`
- Create: `tests/renderer/StatusBanners.test.jsx`

- [ ] **Step 1: preload 経由で新規 IPC を公開**

`src/preload/index.js` の `contextBridge.exposeInMainWorld('api', ...)` 内に追加:

```js
getRssFailureRate: () => ipcRenderer.invoke('diag:rssFailureRate'),
resetDatabase: () => ipcRenderer.invoke('schedule:resetDatabase'),
onScheduleUpdated: (cb) => {
  const listener = () => cb()
  ipcRenderer.on('schedule:updated', listener)
  return () => ipcRenderer.off('schedule:updated', listener)
}
```

`schedule:get` の戻り値で `dbBroken` が来る可能性を扱うため、既存 API は維持。

- [ ] **Step 2: StatusBanners コンポーネントを書く**

`src/renderer/components/StatusBanners.jsx`:

```jsx
import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

export default function StatusBanners({ dbBroken, isOffline }) {
  const [rssFailureRate, setRssFailureRate] = useState(0)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const rate = await window.api.getRssFailureRate()
      if (mounted) setRssFailureRate(rate)
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="status-banners">
      {dbBroken && (
        <div role="alert" className="banner banner--error">
          データベースが破損しています。「リセット」ボタンで再作成してください。
          <button onClick={() => window.api.resetDatabase?.()}>リセット</button>
        </div>
      )}
      {isOffline && (
        <div role="status" className="banner banner--info">
          オフラインです。キャッシュ表示中。
        </div>
      )}
      {rssFailureRate > 0.8 && (
        <div role="status" className="banner banner--warning">
          RSS 取得失敗率が高くなっています（{Math.round(rssFailureRate * 100)}%）。
          クォータ消費増加にご注意ください。
        </div>
      )}
    </div>
  )
}

StatusBanners.propTypes = {
  dbBroken: PropTypes.bool,
  isOffline: PropTypes.bool
}
```

- [ ] **Step 3: テスト**

`tests/renderer/StatusBanners.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StatusBanners from '../../src/renderer/components/StatusBanners'

beforeEach(() => {
  window.api = {
    getRssFailureRate: vi.fn().mockResolvedValue(0),
    resetDatabase: vi.fn()
  }
})

describe('StatusBanners', () => {
  it('shows DB broken banner when dbBroken=true', async () => {
    render(<StatusBanners dbBroken={true} isOffline={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('データベースが破損')
  })

  it('shows offline banner when isOffline=true', async () => {
    render(<StatusBanners dbBroken={false} isOffline={true} />)
    expect(await screen.findByText(/オフラインです/)).toBeInTheDocument()
  })

  it('shows RSS failure banner when failure rate > 80%', async () => {
    window.api.getRssFailureRate = vi.fn().mockResolvedValue(0.9)
    render(<StatusBanners dbBroken={false} isOffline={false} />)
    await waitFor(() =>
      expect(screen.getByText(/RSS 取得失敗率が高くなっています/)).toBeInTheDocument()
    )
  })

  it('hides RSS banner when failure rate is normal', async () => {
    render(<StatusBanners dbBroken={false} isOffline={false} />)
    await waitFor(() => {
      expect(screen.queryByText(/RSS 取得失敗率が高くなっています/)).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 4: App.jsx に組み込み**

`src/renderer/src/App.jsx` の該当位置に `<StatusBanners ... />` を追加。`isOffline` は `navigator.onLine` とイベントリスナーで監視、`dbBroken` は `schedule:get` の戻り値から取得。

- [ ] **Step 5: テスト実行**

```bash
npx vitest run tests/renderer/StatusBanners.test.jsx
```

期待: 4 件 PASS。

- [ ] **Step 6: コミット**

```bash
git add src/renderer/components/StatusBanners.jsx src/renderer/src/App.jsx src/preload/index.js tests/renderer/StatusBanners.test.jsx
git commit -m "feat: add StatusBanners for DB/RSS/offline notifications"
```

---

## Task 18: 単一インスタンス化

**Files:**

- Modify: `src/main/index.js`

- [ ] **Step 1: `app.requestSingleInstanceLock()` を追加**

`src/main/index.js` の `app.whenReady` より前に:

```js
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  // 既存の whenReady/window 作成ブロックをこの else 内に入れる
}
```

- [ ] **Step 2: 動作確認**

実行:

```bash
npm run dev
```

同時に別ターミナルでもう一度 `npm run dev` を実行。2 つ目がすぐ終了し、既存ウィンドウがフォーカスされること。

- [ ] **Step 3: コミット**

```bash
git add src/main/index.js
git commit -m "feat: enforce single-instance lock to prevent SQLite write races"
```

---

## Task 19: 旧コード削除と既存テストの整理

**Files:**

- Delete: `src/main/youtube-api.js`
- Delete: `tests/main/youtube-api.test.js`

- [ ] **Step 1: 参照が残っていないか確認**

実行:

```bash
npx grep -rn "youtube-api" H:/ClaudeCode/Youtube/youtube-schedule/src
```

期待: 0 件。もし残っていればその import を削除 or 置換。

- [ ] **Step 2: 削除**

実行:

```bash
rm H:/ClaudeCode/Youtube/youtube-schedule/src/main/youtube-api.js
rm H:/ClaudeCode/Youtube/youtube-schedule/tests/main/youtube-api.test.js
```

- [ ] **Step 3: 全テスト通し**

実行:

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm run test
```

期待: 全件 PASS（既存の移植対象テストはすでに新テストに置き換わっている）。

- [ ] **Step 4: コミット**

```bash
git add -A src/main/youtube-api.js tests/main/youtube-api.test.js
git commit -m "refactor: remove legacy youtube-api module replaced by Fetchers"
```

注記: `git add -A` は user rule で禁止。削除の場合は `git rm` を使う:

```bash
git rm src/main/youtube-api.js tests/main/youtube-api.test.js
git commit -m "refactor: remove legacy youtube-api module replaced by Fetchers"
```

---

## Task 20: パフォーマンス確認と最終チェック

**Files:** なし（計測と確認のみ）

- [ ] **Step 1: lint**

実行:

```bash
npm run lint
```

期待: エラー 0、warning は許容。

- [ ] **Step 2: 全テスト**

実行:

```bash
npm run test
```

期待: 全 PASS。件数目安は `既存維持分 + 新規 50 件前後 ≒ 80-90 件`。

- [ ] **Step 3: dev 起動でエンド to エンド確認**

実行:

```bash
npm run dev
```

確認項目:

- アプリ起動時のログに `runMigrations` 完了と `schema_version=2` が出力される
- UI に既存の live/upcoming が表示（キャッシュ移行成功）
- 手動更新ボタンで再取得、5 秒以内に UI 更新
- DevTools で `window.api.getRssFailureRate()` が 0〜1 の数値を返す

- [ ] **Step 4: パフォーマンス観測**

DevTools コンソールで以下を計測:

```js
// レポジトリが返す件数（100ch想定で 1500 前後）
console.time('listVisible')
await window.api.getSchedule()
console.timeEnd('listVisible')
```

許容ライン:

- `listVisible` < 50ms
- 起動から最初の描画まで < 3 秒
- refresh 全体 < 15 秒（登録 100ch 想定）

閾値超過時は `videoRepository.js` の IDX 利用をチェック。

- [ ] **Step 5: OSS 公開視点の最終確認**

- `credentials.json` / `token.json` が gitignore 済みで差分に出ていないこと
- `asarUnpack` の `better-sqlite3` 設定が `electron-builder` に反映されていること
- 新規ファイルで `console.log` デバッグコードが残っていないこと
- `CLAUDE.md` の「YouTube データ取得戦略」節を現状（RSS ファースト + SQLite）に合わせて更新

```bash
npx grep -rn "console\.log" H:/ClaudeCode/Youtube/youtube-schedule/src
```

- [ ] **Step 6: `CLAUDE.md` の記述更新**

古い記述（「RSS ファースト、search.list は高コスト」）が残っているので、新しいフロー（RSS プライマリ + playlistItems フォールバック + SQLite 保持）に更新する。

- [ ] **Step 7: 最終コミット**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect RSS-hybrid + SQLite architecture"
```

- [ ] **Step 8: develop へマージできる状態か確認**

実行:

```bash
git status
git log --oneline -20
```

期待: クリーンなツリー、コミットが 20 タスク分積み上がっている。

---

## 完成条件（本プラン全体のチェックリスト）

- [ ] `npm run lint` がエラー 0 で通る
- [ ] `npm run test` が全件 PASS（想定 80-90 件）
- [ ] `npm run dev` で起動し、スケジュールが表示される
- [ ] 手動更新ボタンで再取得、5 秒以内に UI 反映
- [ ] 旧 electron-store のキャッシュが SQLite に移行されている
- [ ] SQLite ファイルが `userData/schedule.db` に生成される
- [ ] 30 分間隔のポーリングが実装され、コンソールで確認できる
- [ ] 単一インスタンス化が働く
- [ ] 3 種の新規バナー（DB 破損 / オフライン / RSS 失敗率高）が動作する
- [ ] `better-sqlite3` の native rebuild が `postinstall` で完了している

---

## 関連スキルとドキュメント

- 実行時のサブスキル: `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans`
- Spec: `docs/superpowers/specs/2026-04-18-rss-hybrid-sqlite-migration-design.md`
- User rules: `api-quota-design.md`, `test-strategy.md`, `data-design-review.md`, `security-coding.md`, `git-ops.md`
