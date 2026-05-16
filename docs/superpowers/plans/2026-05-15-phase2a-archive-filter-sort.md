# Phase 2a — アーカイブ絞り込み・ソート強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アーカイブタブに折り畳み式フィルタバー（チャンネル / 期間 / 配信タイプ）とソート切替（新しい順 / 古い順 / チャンネル名 / 再生時間）を追加する。

**Architecture:** バックエンドは `listArchive` SQL を動的生成に書き換え、`videos.duration` カラムを migration 008 で追加、`videos.list` の既存呼び出しに `contentDetails` part を足して再生時間を 0 クォータで取得。フロントは `ArchiveFilterBar` コンポーネント新設、フィルタ状態を `electron-store` に永続化。

**Tech Stack:** Electron + React、better-sqlite3、electron-store、Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-05-15-youtom-codex-harness-design.md` §4.2

**Branch:** `feature/archive-filter-sort`（develop から切る）

**担当:** Task 1-5 = Claude（DB 契約の中核）、Task 6-9 = Codex（フロント）。Task 6-9 は `/codex-handoff` 経由で依頼する。

---

## File Structure

```
src/main/db/migrations/008_video_duration.js   Task 1 新規 — duration カラム追加
src/main/db/schema.js                          Task 1 修正 — m008 を登録
src/main/lib/parseDuration.js                  Task 2 新規 — ISO8601 → 秒
src/main/services/schedulerService.js          Task 3 修正 — toVideoRecord/toRssVideoRecord に duration
src/main/fetchers/videoDetailsFetcher.js       Task 3 修正 — part に contentDetails 追加
src/main/repositories/videoRepository.js       Task 3,4 修正 — upsert に duration、listArchive 動的SQL化、rowToVideo
src/main/ipc/videoHandlers.js                  Task 5 修正 — listArchive opts 拡張
src/main/ipc/settingsHandlers.js               Task 8 修正 — archiveFilters get/set
src/preload/index.js                           Task 5,8 修正 — contextBridge 公開
src/renderer/components/ArchiveFilterBar.jsx   Task 6 新規 — 折り畳みフィルタUI
src/renderer/hooks/useTabState.js              Task 7 修正 — フィルタ状態 + buildArchiveOptions
src/renderer/src/App.jsx                       Task 9 修正 — ArchiveFilterBar 配線
tests/main/parseDuration.test.js               Task 2 新規
tests/main/videoRepository.archive.test.js     Task 4 新規
tests/renderer/ArchiveFilterBar.test.jsx       Task 6 新規
```

---

## Task 1: migration 008 — `videos.duration` カラム追加

**Files:**
- Create: `src/main/db/migrations/008_video_duration.js`
- Modify: `src/main/db/schema.js`

- [ ] **Step 1: migration ファイルを作成**

`src/main/db/migrations/008_video_duration.js`：

```js
export const version = 8

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN duration INTEGER;
  `)
}
```

`duration` は秒数。NULL = 未取得（既存アーカイブ、RSS 由来）。ソートでは NULL を末尾に置く。インデックスはアーカイブが既に `status='ended'` で絞られ件数が限定的なため不要。

- [ ] **Step 2: schema.js に登録**

`src/main/db/schema.js` を以下に変更（import 行追加と配列追加）：

```js
import * as m001 from './migrations/001_initial.js'
import * as m002 from './migrations/002_import_from_store.js'
import * as m003 from './migrations/003_archive_favorites.js'
import * as m004 from './migrations/004_notify_flag.js'
import * as m005 from './migrations/005_channel_accumulation.js'
import * as m006 from './migrations/006_favorite_order.js'
import * as m007 from './migrations/007_video_source.js'
import * as m008 from './migrations/008_video_duration.js'

export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008]
```

- [ ] **Step 3: マイグレーション適用を確認**

Run: `npm run dev` を起動 → 起動ログにマイグレーションエラーが出ないこと、アプリが正常に立ち上がることを確認。確認後アプリを閉じる。

- [ ] **Step 4: コミット**

```bash
git add src/main/db/migrations/008_video_duration.js src/main/db/schema.js
git commit -m "feat(db): add migration 008 for videos.duration column"
```

---

## Task 2: ISO 8601 duration パーサ

**Files:**
- Create: `src/main/lib/parseDuration.js`
- Test: `tests/main/parseDuration.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/parseDuration.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { parseDuration } from '../../src/main/lib/parseDuration.js'

describe('parseDuration', () => {
  it('parses hours, minutes, seconds', () => {
    expect(parseDuration('PT1H2M3S')).toBe(3723)
  })

  it('parses minutes and seconds only', () => {
    expect(parseDuration('PT15M30S')).toBe(930)
  })

  it('parses seconds only', () => {
    expect(parseDuration('PT45S')).toBe(45)
  })

  it('parses hours only', () => {
    expect(parseDuration('PT2H')).toBe(7200)
  })

  it('returns 0 for PT0S', () => {
    expect(parseDuration('PT0S')).toBe(0)
  })

  it('returns null for null / undefined / empty', () => {
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
    expect(parseDuration('')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseDuration('garbage')).toBeNull()
    expect(parseDuration('P1D')).toBeNull()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- parseDuration`
Expected: FAIL（`parseDuration` が存在しない）

- [ ] **Step 3: 実装を書く**

`src/main/lib/parseDuration.js`：

```js
// YouTube contentDetails.duration（ISO 8601, 例 "PT1H2M3S"）を秒数へ変換する。
// 解析できない場合や空入力は null を返す（duration 未取得を表す）。
export function parseDuration(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return null
  const [, h, m, s] = match
  if (h === undefined && m === undefined && s === undefined) return null
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- parseDuration`
Expected: PASS（7 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/main/lib/parseDuration.js tests/main/parseDuration.test.js
git commit -m "feat(main): add ISO 8601 duration parser"
```

---

## Task 3: duration を fetcher・レコード・upsert に配線

**Files:**
- Modify: `src/main/fetchers/videoDetailsFetcher.js`
- Modify: `src/main/services/schedulerService.js`
- Modify: `src/main/repositories/videoRepository.js`

- [ ] **Step 1: videoDetailsFetcher に contentDetails part を追加**

`src/main/fetchers/videoDetailsFetcher.js` の `part` 配列を変更：

```js
yt.videos.list({
  part: ['snippet', 'liveStreamingDetails', 'contentDetails'],
  id: batch.join(',')
}),
```

（`videos.list` は part を増やしてもクォータ 1 ユニット/回のまま。追加コスト 0。）

- [ ] **Step 2: schedulerService の toVideoRecord に duration を追加**

`src/main/services/schedulerService.js` の先頭に import を追加：

```js
import { deriveStatus } from './videoStatus.js'
import { parseDuration } from '../lib/parseDuration.js'
```

`toVideoRecord` の return オブジェクトに `duration` を追加（`source: 'api'` の前）：

```js
    url: `https://www.youtube.com/watch?v=${v.id}`,
    firstSeenAt: now,
    lastCheckedAt: now,
    duration: parseDuration(v.contentDetails?.duration),
    source: 'api'
  }
}
```

- [ ] **Step 3: toRssVideoRecord に duration: null を追加**

同ファイルの `toRssVideoRecord` の return オブジェクトにも追加（`source` の前、RSS 由来は duration 不明なので null）：

```js
    firstSeenAt: Number.isNaN(feedTime) ? now : feedTime,
    lastCheckedAt: now,
    duration: null,
    source: 'rss'
```

- [ ] **Step 4: upsert SQL に duration カラムを追加**

`src/main/repositories/videoRepository.js` の `upsertStmt`：

INSERT のカラムリストに `duration` を追加（`source` の前）、VALUES に `@duration` を追加、`ON CONFLICT DO UPDATE SET` に `duration` 行を追加：

```sql
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at, ended_at, duration, source
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt,
      CASE WHEN @status = 'ended' THEN @lastCheckedAt ELSE NULL END,
      @duration, @source
    )
    ON CONFLICT(id) DO UPDATE SET
      ...
      concurrent_viewers = excluded.concurrent_viewers,
      url = excluded.url,
      last_checked_at = excluded.last_checked_at,
      duration = COALESCE(excluded.duration, videos.duration),
      source = excluded.source,
      ended_at = CASE ...
```

`duration = COALESCE(excluded.duration, videos.duration)` とすることで、後続の更新で duration が null になっても既存値を消さない（live 中は contentDetails.duration が PT0S や未確定のことがあるため、一度取れた値を保持する）。

- [ ] **Step 5: upsert の引数に duration デフォルトを追加**

同ファイルの `upsert(video)` メソッド：

```js
    upsert(video) {
      upsertStmt.run({ ...video, duration: video.duration ?? null, source: video.source ?? 'api' })
```

- [ ] **Step 6: rowToVideo に duration を追加**

同ファイルの `rowToVideo`：

```js
      source: row.source ?? 'api',
      duration: row.duration ?? null,
      isFavorite: row.is_favorite === 1,
```

- [ ] **Step 7: 既存テストが通ることを確認**

Run: `npm run test`
Expected: 全 PASS（既存 223 件。upsert を呼ぶ既存テストが duration 追加で壊れないこと。壊れる場合はテストの video オブジェクトに `duration` が無くても Step 5 のデフォルトで吸収されるはず）

- [ ] **Step 8: 起動確認**

Run: `npm run dev` で起動 → コンソールエラーなし → アプリを閉じる

- [ ] **Step 9: コミット**

```bash
git add src/main/fetchers/videoDetailsFetcher.js src/main/services/schedulerService.js src/main/repositories/videoRepository.js
git commit -m "feat(main): fetch and persist video duration via contentDetails"
```

---

## Task 4: `listArchive` を動的 SQL に書き換え（フィルタ + ソート）

**Files:**
- Modify: `src/main/repositories/videoRepository.js`
- Test: `tests/main/videoRepository.archive.test.js`

`listArchive` は現在 1 個の固定 prepared statement。複数チャンネル `IN` 句・動的 `ORDER BY`・期間/タイプフィルタを入れるため、呼び出しごとに SQL 文字列を組み立てて `db.prepare()` する方式に変える（アーカイブ取得はユーザー操作トリガーかつデバウンス済みなので prepare コストは無視できる）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/videoRepository.archive.test.js`：

```js
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrations } from '../../src/main/db/schema.js'
import { createVideoRepository } from '../../src/main/repositories/videoRepository.js'

function makeDb() {
  const db = new Database(':memory:')
  for (const m of migrations) m.up(db)
  return db
}

function insertEndedVideo(repo, overrides) {
  repo.upsert({
    id: 'v1',
    channelId: 'c1',
    channelTitle: 'Channel One',
    title: 'Title',
    description: '',
    thumbnail: '',
    status: 'ended',
    scheduledStartTime: null,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://example.com',
    firstSeenAt: 1000,
    lastCheckedAt: 1000,
    duration: null,
    source: 'api',
    ...overrides
  })
}

describe('listArchive filters and sort', () => {
  let db, repo
  beforeEach(() => {
    db = makeDb()
    repo = createVideoRepository(db)
  })

  it('filters by multiple channels', () => {
    insertEndedVideo(repo, { id: 'a', channelId: 'c1' })
    insertEndedVideo(repo, { id: 'b', channelId: 'c2' })
    insertEndedVideo(repo, { id: 'c', channelId: 'c3' })
    const rows = repo.listArchive({ channelIds: ['c1', 'c3'] })
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('filters by video type live-done (actual_start_time present)', () => {
    insertEndedVideo(repo, { id: 'aired', actualStartTime: 5000 })
    insertEndedVideo(repo, { id: 'notaired', actualStartTime: null, scheduledStartTime: 5000 })
    const rows = repo.listArchive({ videoType: 'live-done' })
    expect(rows.map((r) => r.id)).toEqual(['aired'])
  })

  it('filters by video type didnt-air', () => {
    insertEndedVideo(repo, { id: 'aired', actualStartTime: 5000 })
    insertEndedVideo(repo, { id: 'notaired', actualStartTime: null, scheduledStartTime: 5000 })
    const rows = repo.listArchive({ videoType: 'didnt-air' })
    expect(rows.map((r) => r.id)).toEqual(['notaired'])
  })

  it('filters by period (ended_at within range)', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'recent', lastCheckedAt: 9000 })
    const rows = repo.listArchive({ periodStart: 5000 })
    expect(rows.map((r) => r.id)).toEqual(['recent'])
  })

  it('sorts by duration descending with NULL last', () => {
    insertEndedVideo(repo, { id: 'short', lastCheckedAt: 1000, duration: 60 })
    insertEndedVideo(repo, { id: 'long', lastCheckedAt: 2000, duration: 600 })
    insertEndedVideo(repo, { id: 'unknown', lastCheckedAt: 3000, duration: null })
    const rows = repo.listArchive({ sort: 'duration' })
    expect(rows.map((r) => r.id)).toEqual(['long', 'short', 'unknown'])
  })

  it('sorts by oldest first', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'new', lastCheckedAt: 9000 })
    const rows = repo.listArchive({ sort: 'oldest' })
    expect(rows.map((r) => r.id)).toEqual(['old', 'new'])
  })

  it('defaults to newest first when no sort given', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'new', lastCheckedAt: 9000 })
    const rows = repo.listArchive({})
    expect(rows.map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('keeps text query working alongside filters', () => {
    insertEndedVideo(repo, { id: 'match', channelId: 'c1', title: 'special keyword' })
    insertEndedVideo(repo, { id: 'nomatch', channelId: 'c1', title: 'other' })
    const rows = repo.listArchive({ query: 'keyword', channelIds: ['c1'] })
    expect(rows.map((r) => r.id)).toEqual(['match'])
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- videoRepository.archive`
Expected: FAIL（`listArchive` が `channelIds` / `videoType` / `periodStart` / `sort` を解釈しない）

- [ ] **Step 3: `listArchiveStmt` 固定文を削除し、動的ビルダーに置き換える**

`src/main/repositories/videoRepository.js` の `const listArchiveStmt = db.prepare(...)` ブロック（70-84 行付近）を削除する。

`listArchive` メソッド（252 行付近）を以下に書き換える：

```js
    listArchive({
      limit = 50,
      offset = 0,
      query = '',
      channelId = null,
      channelIds = null,
      videoType = 'all',
      periodStart = null,
      periodEnd = null,
      sort = 'newest',
      title = true,
      channel = true,
      description = false
    } = {}) {
      const likeQuery = escapeLikeQuery(query)
      const params = {
        limit,
        offset,
        query: likeQuery,
        searchTitle: title ? 1 : 0,
        searchChannel: channel ? 1 : 0,
        searchDesc: description ? 1 : 0
      }
      const where = [`status = 'ended'`]

      // チャンネル絞り込み: channelIds（複数）を優先、無ければ channelId（単一・後方互換）
      const ids = Array.isArray(channelIds) && channelIds.length > 0
        ? channelIds
        : channelId && channelId !== 'all'
          ? [channelId]
          : []
      if (ids.length > 0) {
        const placeholders = ids.map((_, i) => `@ch${i}`).join(', ')
        where.push(`channel_id IN (${placeholders})`)
        ids.forEach((id, i) => {
          params[`ch${i}`] = id
        })
      }

      // 配信タイプ
      if (videoType === 'live-done') {
        where.push(`actual_start_time IS NOT NULL`)
      } else if (videoType === 'didnt-air') {
        where.push(`actual_start_time IS NULL AND scheduled_start_time IS NOT NULL`)
      }

      // 期間（ended_at 基準、欠損時は last_checked_at にフォールバック）
      if (typeof periodStart === 'number') {
        where.push(`COALESCE(ended_at, last_checked_at) >= @periodStart`)
        params.periodStart = periodStart
      }
      if (typeof periodEnd === 'number') {
        where.push(`COALESCE(ended_at, last_checked_at) <= @periodEnd`)
        params.periodEnd = periodEnd
      }

      // テキスト検索
      where.push(`(
        @query = ''
        OR (
          (@searchTitle AND title LIKE '%' || @query || '%' ESCAPE '!')
          OR (@searchChannel AND channel_title LIKE '%' || @query || '%' ESCAPE '!')
          OR (@searchDesc AND description LIKE '%' || @query || '%' ESCAPE '!')
        )
      )`)

      const orderBy = {
        newest: `COALESCE(ended_at, last_checked_at) DESC`,
        oldest: `COALESCE(ended_at, last_checked_at) ASC`,
        channel: `channel_title COLLATE NOCASE ASC, COALESCE(ended_at, last_checked_at) DESC`,
        duration: `duration IS NULL, duration DESC`
      }[sort] ?? `COALESCE(ended_at, last_checked_at) DESC`

      const sql = `
        SELECT * FROM videos
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT @limit OFFSET @offset
      `
      return db.prepare(sql).all(params).map(rowToVideo)
    },
```

`duration IS NULL, duration DESC` は SQLite で `duration IS NULL` が 0/1 を返すため、NULL（=1）が後ろに来る。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- videoRepository.archive`
Expected: PASS（8 テスト）

- [ ] **Step 5: 全テスト確認**

Run: `npm run test`
Expected: 全 PASS（既存 223 + parseDuration 7 + archive 8）

- [ ] **Step 6: コミット**

```bash
git add src/main/repositories/videoRepository.js tests/main/videoRepository.archive.test.js
git commit -m "feat(main): rewrite listArchive with dynamic filters and sort"
```

---

## Task 5: IPC ハンドラと preload を拡張

**Files:**
- Modify: `src/main/ipc/videoHandlers.js`
- Modify: `src/preload/index.js`

- [ ] **Step 1: videoHandlers の listArchive ハンドラを確認**

`src/main/ipc/videoHandlers.js` の `ipcMain.handle('videos:listArchive', ...)`（82 行付近）は `repo.listArchive(opts ?? {})` をそのまま渡している。`listArchive` が新パラメータを受けるようになったため**ハンドラ側の変更は不要**（opts をそのまま透過する）。コードを読んで確認するだけ。

- [ ] **Step 2: preload の listArchive 公開を確認**

`src/preload/index.js` で `listArchive` が `contextBridge` 経由で公開されているか確認する。既存（`window.api.listArchive`）が使われているので公開済みのはず。`Read` で確認し、引数を素通しする形なら変更不要。

- [ ] **Step 3: 変更が無ければこのタスクはスキップ。あれば最小修正してコミット**

このタスクは確認タスク。`videos:listArchive` は opts を透過するだけなので通常は変更不要。確認の結果コード変更が発生しなければコミットも不要（次のタスクへ）。

---

## Task 6: `ArchiveFilterBar` コンポーネント（Codex 担当）

**Files:**
- Create: `src/renderer/components/ArchiveFilterBar.jsx`
- Test: `tests/renderer/ArchiveFilterBar.test.jsx`

折り畳み式フィルタバー。「絞り込み ▼」ボタンで開閉、アクティブなフィルタ数をバッジ表示。

**Props（インターフェース定義 — Task 7・9 と一致させること）:**

```
ArchiveFilterBar({
  channels,        // [{ id, title }] アーカイブに含まれるチャンネル一覧
  filters,         // { channelIds: string[], videoType: 'all'|'live-done'|'didnt-air',
                   //   period: 'all'|'7d'|'30d'|'90d'|'custom', customStart: number|null, customEnd: number|null }
  sort,            // 'newest'|'oldest'|'channel'|'duration'
  onChangeFilters, // (nextFilters) => void
  onChangeSort     // (nextSort) => void
})
```

- [ ] **Step 1: 失敗するテストを書く**

`tests/renderer/ArchiveFilterBar.test.jsx`：

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArchiveFilterBar } from '../../src/renderer/components/ArchiveFilterBar.jsx'

const baseFilters = {
  channelIds: [],
  videoType: 'all',
  period: 'all',
  customStart: null,
  customEnd: null
}

function setup(overrides = {}) {
  const onChangeFilters = vi.fn()
  const onChangeSort = vi.fn()
  render(
    <ArchiveFilterBar
      channels={[
        { id: 'c1', title: 'Channel One' },
        { id: 'c2', title: 'Channel Two' }
      ]}
      filters={baseFilters}
      sort="newest"
      onChangeFilters={onChangeFilters}
      onChangeSort={onChangeSort}
      {...overrides}
    />
  )
  return { onChangeFilters, onChangeSort }
}

describe('ArchiveFilterBar', () => {
  it('is collapsed by default (filter controls hidden)', () => {
    setup()
    expect(screen.queryByLabelText('配信タイプ')).not.toBeInTheDocument()
  })

  it('expands when the toggle button is clicked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    expect(screen.getByLabelText('配信タイプ')).toBeInTheDocument()
  })

  it('shows active filter count badge', () => {
    setup({ filters: { ...baseFilters, videoType: 'live-done', period: '30d' } })
    // videoType と period の 2 つがアクティブ
    expect(screen.getByRole('button', { name: /絞り込み/ })).toHaveTextContent('2')
  })

  it('calls onChangeSort when sort select changes', () => {
    const { onChangeSort } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.change(screen.getByLabelText('並び替え'), { target: { value: 'duration' } })
    expect(onChangeSort).toHaveBeenCalledWith('duration')
  })

  it('calls onChangeFilters when video type changes', () => {
    const { onChangeFilters } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.change(screen.getByLabelText('配信タイプ'), { target: { value: 'didnt-air' } })
    expect(onChangeFilters).toHaveBeenCalledWith(
      expect.objectContaining({ videoType: 'didnt-air' })
    )
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- ArchiveFilterBar`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: コンポーネントを実装**

`src/renderer/components/ArchiveFilterBar.jsx` を作成。要件：

- `useState` で開閉状態 `expanded` を管理（デフォルト false）
- トグルボタン: テキストは「絞り込み」。アクティブフィルタ数 > 0 ならバッジ（数値）を含める。`▼`/`▲` で開閉表示
- アクティブフィルタ数 = 次の合計: `channelIds.length > 0 ? 1 : 0` + `videoType !== 'all' ? 1 : 0` + `period !== 'all' ? 1 : 0`
- 展開時のコントロール:
  - 「並び替え」`<select aria-label="並び替え">`: 新しい順(`newest`)/古い順(`oldest`)/チャンネル名(`channel`)/再生時間(`duration`)
  - 「配信タイプ」`<select aria-label="配信タイプ">`: すべて(`all`)/ライブ配信済み(`live-done`)/流れた配信(`didnt-air`)
  - 「期間」`<select aria-label="期間">`: すべて(`all`)/7日(`7d`)/30日(`30d`)/90日(`90d`)/カスタム(`custom`)
  - period が `custom` のとき: `<input type="date">` を 2 つ（開始・終了）。変更時は epoch ms に変換して `customStart`/`customEnd` に入れる
  - チャンネル絞り込み: `channels` を列挙したチェックボックス群。チェック状態は `channelIds` に含まれるか
- どのコントロールを変えても、変更後の filters オブジェクト全体を `onChangeFilters` に渡す（ソートだけ `onChangeSort`）
- スタイルは既存コンポーネント（`SettingsModal.jsx` 等）の CSS クラス命名に合わせる。新規 class は最小限

実装は既存の `src/renderer/components/` のスタイル・記法（関数コンポーネント、named export、`semi: false`、`singleQuote`）に合わせること。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- ArchiveFilterBar`
Expected: PASS（5 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/renderer/components/ArchiveFilterBar.jsx tests/renderer/ArchiveFilterBar.test.jsx
git commit -m "feat(renderer): add ArchiveFilterBar component"
```

---

## Task 7: `useTabState` にフィルタ状態を追加（Codex 担当）

**Files:**
- Modify: `src/renderer/hooks/useTabState.js`

- [ ] **Step 1: フィルタ状態を追加**

`useTabState` 内、`selectedChannel` の useState 付近に以下を追加：

```js
  const [archiveFilters, setArchiveFilters] = useState({
    channelIds: [],
    videoType: 'all',
    period: 'all',
    customStart: null,
    customEnd: null
  })
  const [archiveSort, setArchiveSort] = useState('newest')
```

- [ ] **Step 2: period を epoch 範囲へ変換するヘルパーを追加**

`buildArchiveOptions` の直前に追加：

```js
  // フィルタの period 種別を { periodStart, periodEnd } の epoch ms へ変換する
  function resolvePeriod(filters) {
    const dayMs = 24 * 60 * 60 * 1000
    if (filters.period === 'custom') {
      return { periodStart: filters.customStart, periodEnd: filters.customEnd }
    }
    const presets = { '7d': 7, '30d': 30, '90d': 90 }
    const days = presets[filters.period]
    if (!days) return { periodStart: null, periodEnd: null }
    return { periodStart: Date.now() - days * dayMs, periodEnd: null }
  }
```

- [ ] **Step 3: `buildArchiveOptions` を拡張**

```js
  function buildArchiveOptions({ limit = ARCHIVE_LIMIT, offset = 0, query = searchQuery } = {}) {
    const { periodStart, periodEnd } = resolvePeriod(archiveFilters)
    return {
      ...SEARCH_TARGETS,
      limit,
      offset,
      query: query.trim(),
      channelIds: archiveFilters.channelIds,
      videoType: archiveFilters.videoType,
      periodStart,
      periodEnd,
      sort: archiveSort,
      // 後方互換: 単一チャンネル選択も channelIds に寄せたため channelId は送らない
      channelId: null
    }
  }
```

- [ ] **Step 4: フィルタ/ソート変更時にアーカイブを再取得**

`selectedChannel` の変更で再検索している既存の useEffect（142 行付近）に倣い、`archiveFilters` と `archiveSort` でも再検索する useEffect を追加：

```js
  useEffect(() => {
    if (activeTab === 'archive') runArchiveSearch(searchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveFilters, archiveSort])
```

- [ ] **Step 5: フィルタ状態を戻り値に追加**

`useTabState` の return オブジェクトに追加：

```js
    archiveFilters,
    setArchiveFilters,
    archiveSort,
    setArchiveSort,
```

- [ ] **Step 6: テストを実行**

Run: `npm run test`
Expected: 全 PASS（既存テストが壊れないこと）

- [ ] **Step 7: コミット**

```bash
git add src/renderer/hooks/useTabState.js
git commit -m "feat(renderer): add archive filter and sort state to useTabState"
```

---

## Task 8: フィルタ状態を electron-store に永続化（Codex 担当）

**Files:**
- Modify: `src/main/ipc/settingsHandlers.js`
- Modify: `src/preload/index.js`
- Modify: `src/renderer/hooks/useTabState.js`

- [ ] **Step 1: settingsHandlers に archiveFilters の get/set を追加**

`src/main/ipc/settingsHandlers.js` を `Read` で確認し、既存の `settings:get` / `settings:set` パターンに合わせて `archiveFilters` を読み書きできるようにする。既存の `settings:get` が任意キーを受ける汎用ハンドラなら**追加不要**（`getSetting('archiveFilters', default)` がそのまま使える）。汎用でなくキー固定なら、`archiveFilters` 用の get/set を既存パターンに合わせて追加する。

- [ ] **Step 2: preload を確認**

`settings:get` / `settings:set` が preload で公開済みか確認。公開済みなら変更不要。

- [ ] **Step 3: useTabState で初期値をロード、変更時に保存**

`archiveFilters` / `archiveSort` の useState 初期化を、起動時に `window.api` 経由でロードした値で行う。electron-store アクセスは非同期 IPC のため、`useState` の初期値はデフォルトのまま、`useEffect` で初回ロードして `setArchiveFilters` / `setArchiveSort` する：

```js
  // 起動時に保存済みフィルタを復元
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = await window.api.getSetting?.('archiveFilters', null)
      if (!cancelled && saved) {
        if (saved.filters) setArchiveFilters(saved.filters)
        if (saved.sort) setArchiveSort(saved.sort)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // フィルタ/ソート変更時に保存
  useEffect(() => {
    window.api.setSetting?.('archiveFilters', { filters: archiveFilters, sort: archiveSort })
  }, [archiveFilters, archiveSort])
```

`window.api.getSetting` / `setSetting` の正確な名前は Step 2 の確認結果に合わせること。

- [ ] **Step 4: テスト**

Run: `npm run test`
Expected: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add src/main/ipc/settingsHandlers.js src/preload/index.js src/renderer/hooks/useTabState.js
git commit -m "feat: persist archive filters to electron-store"
```

---

## Task 9: `App.jsx` に `ArchiveFilterBar` を配線 + 動作確認（Codex 実装 / Claude 検証）

**Files:**
- Modify: `src/renderer/src/App.jsx`

- [ ] **Step 1: App.jsx でアーカイブタブに ArchiveFilterBar を配置**

`App.jsx` を `Read` し、archive タブのレンダリング箇所（検索ボックスと `ScheduleList`/`ScheduleCard` 群の間）に `ArchiveFilterBar` を挿入する。

- import 追加: `import { ArchiveFilterBar } from '../components/ArchiveFilterBar.jsx'`
- `useTabState` の戻り値から `archiveFilters` / `setArchiveFilters` / `archiveSort` / `setArchiveSort` を受け取る
- `channels` prop には、アーカイブに出ているチャンネル一覧を渡す（`useTabState` が既に持つ `channels` または `tabChannels` を流用。既存の `selectedChannel` ドロップダウンに使っているチャンネルリストと同じソースを使う）
- 配置：archive タブの検索ボックス直下

```jsx
{activeTab === 'archive' && (
  <ArchiveFilterBar
    channels={archiveChannelList}
    filters={archiveFilters}
    sort={archiveSort}
    onChangeFilters={setArchiveFilters}
    onChangeSort={setArchiveSort}
  />
)}
```

`archiveChannelList` の正確なソースは App.jsx の既存実装（チャンネル絞り込みドロップダウンが使っている配列）に合わせること。

- [ ] **Step 2: 既存のチャンネル絞り込みドロップダウンの扱い**

App.jsx に既存の単一チャンネル絞り込み（`selectedChannel`）UI がアーカイブタブにある場合、ArchiveFilterBar のチャンネル複数選択と重複する。重複する場合は archive タブでは旧ドロップダウンを非表示にし、ArchiveFilterBar に一本化する。feed/schedule など他タブで使っているなら他タブでは残す。判断に迷ったら DONE_WITH_CONCERNS で報告。

- [ ] **Step 3: lint + test + build**

Run: `npm run lint && npm run test && npm run build`
Expected: すべて PASS

- [ ] **Step 4: 起動して実動確認（Claude が Playwright で実施）**

Run: `npm run dev`

確認チェックリスト（`deverop-after.md` 準拠）：
- [ ] アプリ起動、アーカイブタブを開く
- [ ] 「絞り込み ▼」ボタンが検索ボックス下に表示される
- [ ] クリックで展開、ソート・配信タイプ・期間・チャンネルのコントロールが出る
- [ ] ソートを「再生時間」に変えるとリストが並び替わる（duration 取得済みの動画があれば）
- [ ] 配信タイプ「流れた配信」でリストが絞られる
- [ ] 期間「7日」でリストが絞られる
- [ ] チャンネルを複数選択して絞り込める
- [ ] アクティブフィルタ数がボタンにバッジ表示される
- [ ] FTS 検索ボックスとフィルタが併用できる
- [ ] アプリを再起動するとフィルタ・ソート状態が復元される
- [ ] コンソールにエラーが出ていない

- [ ] **Step 5: コミット**

```bash
git add src/renderer/src/App.jsx
git commit -m "feat(renderer): wire ArchiveFilterBar into archive tab"
```

---

## Self-Review Checklist（プラン作成者が完了後に確認）

- [ ] **Spec coverage:** spec §4.2 の完成条件すべてに対応タスクがあるか
  - 折り畳み式フィルタバー → Task 6 ✓
  - チャンネル複数絞り込み → Task 4（SQL）+ Task 6（UI）✓
  - 期間絞り込み → Task 4 + Task 6/7 ✓
  - 配信タイプ 2 種 → Task 4 + Task 6 ✓
  - ソート 4 種 → Task 4 + Task 6 ✓
  - 再生時間（migration + fetcher） → Task 1, 2, 3 ✓
  - FTS 併用 → Task 4（query 句保持）✓
  - electron-store 永続化 → Task 8 ✓
  - テスト追加 → Task 2, 4, 6 ✓

- [ ] **Placeholder scan:** "TBD" 等なし。「正確な名前は確認結果に合わせる」系は確認タスク（Task 5/8）として明示済み

- [ ] **Type consistency:** filters オブジェクトの形（`channelIds` / `videoType` / `period` / `customStart` / `customEnd`）が Task 6・7・9 で一致。`sort` 値（`newest`/`oldest`/`channel`/`duration`）が Task 4・6・7 で一致。listArchive パラメータ（`channelIds` / `videoType` / `periodStart` / `periodEnd` / `sort`）が Task 4・7 で一致

---

## 完了基準

- 9 タスクすべての commit が `feature/archive-filter-sort` に積まれている
- `npm run lint && npm run test && npm run build` がすべて pass
- Task 9 Step 4 の Playwright チェックリストが全項目 ✓
- merge ゲート 4 条件を満たし、ユーザー merge 指示後に develop へ
