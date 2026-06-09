# Phase 2c-1 — 手動メン限動画登録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メンバー限定配信など RSS・購読 API で自動検出できない動画を、URL/ID の手動入力で登録して YouTom に追跡させる。

**Architecture:** migration 010 で `videos.is_membership_only` を追加。手動登録は入力文字列を `resolveVideoId` で 11 桁の動画 ID に正規化し、`videos.list` で実在検証してから `is_membership_only=1, source='manual'` で DB に upsert する。以後はスケジューラが通常動画と同様に upcoming→live→ended を追跡する。upsert の ON CONFLICT は `is_membership_only` を `MAX` で保持し、再フェッチでフラグが消えないようにする。

**Tech Stack:** Electron + React、better-sqlite3、googleapis（YouTube Data API v3）、Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-05-15-youtom-codex-harness-design.md` §4.4（Task 2c）

**Branch:** `feature/manual-membership-video`（develop から切る）

**担当:** Task 1-6・10 = Claude（DB 契約・main ロジック・API 検証）、Task 7-9 = Codex（UI）。Task 7-9 は `/codex-handoff` 経由で依頼する。

**npm 注意:** テスト実行時に `better-sqlite3` の rebuild が EBUSY で落ちることがある。その場合 `npm_config_cache=<temp-dir>/npm-cache` を付けて再実行する。

---

## File Structure

```
src/main/db/migrations/010_membership_flag.js   Task 1 新規 — is_membership_only カラム
src/main/db/schema.js                           Task 1 修正 — m010 登録
src/main/lib/resolveVideoId.js                  Task 2 新規 — URL/ID → 動画ID
src/main/repositories/videoRepository.js        Task 3 修正 — upsert/rowToVideo に is_membership_only
src/main/services/schedulerService.js           Task 4,6 修正 — addManualVideo、manual 動画の追跡
src/main/ipc/videoHandlers.js                   Task 5 修正 — videos:addManual ハンドラ
src/preload/index.js                            Task 5 修正 — addManual 公開
src/renderer/components/SettingsModal.jsx       Task 7 修正 — メンバー限定セクション
src/renderer/components/ScheduleCard.jsx        Task 8 修正 — 🔒 バッジ
src/renderer/hooks/useTabState.js               Task 9 修正 — メン限フィルタ
src/renderer/src/App.jsx                        Task 9 修正 — フィルタ配線
tests/main/resolveVideoId.test.js               Task 2 新規
tests/main/videoRepository.membership.test.js   Task 3 新規
```

---

## Task 1: migration 010 — `is_membership_only` カラム追加

**Files:**
- Create: `src/main/db/migrations/010_membership_flag.js`
- Modify: `src/main/db/schema.js`

- [ ] **Step 1: migration ファイルを作成**

`src/main/db/migrations/010_membership_flag.js`：

```js
export const version = 10

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN is_membership_only INTEGER NOT NULL DEFAULT 0;
  `)
}
```

`is_membership_only` は 0/1。手動登録した動画に 1 を立てる。

- [ ] **Step 2: schema.js に登録**

`src/main/db/schema.js` の import 行と配列に m010 を追加する。現状：

```js
import * as m008 from './migrations/008_video_duration.js'
import * as m009 from './migrations/009_video_published_at.js'

export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009]
```

変更後：

```js
import * as m008 from './migrations/008_video_duration.js'
import * as m009 from './migrations/009_video_published_at.js'
import * as m010 from './migrations/010_membership_flag.js'

export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010]
```

- [ ] **Step 3: テストが通ることを確認**

Run: `cd <repo-root> && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6`
Expected: 全テスト pass（migration 配列は repository テストの in-memory DB で実行される）

- [ ] **Step 4: コミット**

```bash
git add src/main/db/migrations/010_membership_flag.js src/main/db/schema.js
git commit -m "feat(db): add migration 010 for is_membership_only flag"
```

---

## Task 2: `resolveVideoId` — URL/ID から動画 ID を取り出す

**Files:**
- Create: `src/main/lib/resolveVideoId.js`
- Test: `tests/main/resolveVideoId.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/resolveVideoId.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { resolveVideoId } from '../../src/main/lib/resolveVideoId.js'

describe('resolveVideoId', () => {
  it('returns a bare 11-char video id as-is', () => {
    expect(resolveVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a watch URL', () => {
    expect(resolveVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a watch URL with extra params', () => {
    expect(resolveVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe(
      'dQw4w9WgXcQ'
    )
  })

  it('extracts id from a youtu.be short URL', () => {
    expect(resolveVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a /live/ URL', () => {
    expect(resolveVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('trims surrounding whitespace', () => {
    expect(resolveVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for empty or non-string input', () => {
    expect(resolveVideoId('')).toBeNull()
    expect(resolveVideoId(null)).toBeNull()
    expect(resolveVideoId(undefined)).toBeNull()
  })

  it('returns null when no valid id can be extracted', () => {
    expect(resolveVideoId('https://www.youtube.com/')).toBeNull()
    expect(resolveVideoId('not a url or id')).toBeNull()
    expect(resolveVideoId('too-short')).toBeNull()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run test -- resolveVideoId 2>&1 | tail -12`
Expected: FAIL（`resolveVideoId` が存在しない）

- [ ] **Step 3: 実装を書く**

`src/main/lib/resolveVideoId.js`：

```js
// YouTube 動画 ID は 11 文字（英数・ハイフン・アンダースコア）。
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

// 入力（生の動画 ID または各種 YouTube URL）から 11 桁の動画 ID を取り出す。
// 取り出せない場合は null を返す。
export function resolveVideoId(input) {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  // 生の動画 ID
  if (VIDEO_ID_RE.test(trimmed)) return trimmed

  let url
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  // watch?v=ID
  const vParam = url.searchParams.get('v')
  if (vParam && VIDEO_ID_RE.test(vParam)) return vParam

  // youtu.be/ID, /live/ID, /shorts/ID, /embed/ID — パス末尾セグメント
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (last && VIDEO_ID_RE.test(last)) return last

  return null
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run test -- resolveVideoId 2>&1 | tail -12`
Expected: PASS（8 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/main/lib/resolveVideoId.js tests/main/resolveVideoId.test.js
git commit -m "feat(main): add resolveVideoId URL/ID parser"
```

---

## Task 3: `videoRepository` に `is_membership_only` を配線

**Files:**
- Modify: `src/main/repositories/videoRepository.js`
- Test: `tests/main/videoRepository.membership.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/main/videoRepository.membership.test.js`：

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

function videoRecord(overrides) {
  return {
    id: 'v1',
    channelId: 'c1',
    channelTitle: 'Channel One',
    title: 'Title',
    description: '',
    thumbnail: '',
    status: 'upcoming',
    scheduledStartTime: 5000,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://example.com',
    firstSeenAt: 1000,
    lastCheckedAt: 1000,
    duration: null,
    publishedAt: null,
    source: 'api',
    ...overrides
  }
}

describe('videoRepository is_membership_only', () => {
  let db, repo
  beforeEach(() => {
    db = makeDb()
    repo = createVideoRepository(db)
  })

  it('defaults isMembershipOnly to false when not provided', () => {
    repo.upsert(videoRecord({ id: 'v1' }))
    expect(repo.getById('v1').isMembershipOnly).toBe(false)
  })

  it('stores and returns isMembershipOnly true', () => {
    repo.upsert(videoRecord({ id: 'v1', isMembershipOnly: true, source: 'manual' }))
    const video = repo.getById('v1')
    expect(video.isMembershipOnly).toBe(true)
    expect(video.source).toBe('manual')
  })

  it('keeps isMembershipOnly true after a later upsert that omits the flag', () => {
    repo.upsert(videoRecord({ id: 'v1', isMembershipOnly: true, source: 'manual' }))
    // スケジューラの再フェッチ相当（フラグ無し・status 更新）
    repo.upsert(videoRecord({ id: 'v1', status: 'live', actualStartTime: 6000 }))
    expect(repo.getById('v1').isMembershipOnly).toBe(true)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run test -- videoRepository.membership 2>&1 | tail -12`
Expected: FAIL（`isMembershipOnly` が保存・返却されない）

- [ ] **Step 3: upsert SQL に `is_membership_only` を追加**

`src/main/repositories/videoRepository.js` の `upsertStmt`：

INSERT カラムリストに `is_membership_only` を追加（`published_at` の後）、VALUES に `@isMembershipOnly`、ON CONFLICT DO UPDATE SET に `MAX` 保持の行を追加。

INSERT 部：

```sql
      url, first_seen_at, last_checked_at, ended_at, duration, published_at,
      is_membership_only, source
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt,
      CASE WHEN @status = 'ended' THEN @lastCheckedAt ELSE NULL END,
      @duration, @publishedAt, @isMembershipOnly, @source
    )
```

ON CONFLICT 部に追加（`published_at = ...` の行の後、`source = excluded.source` の前）：

```sql
      published_at = COALESCE(excluded.published_at, videos.published_at),
      is_membership_only = MAX(excluded.is_membership_only, videos.is_membership_only),
      source = excluded.source,
```

`MAX` により、一度 1 になったフラグは後続の upsert（フラグ 0）でも 0 に戻らない。

- [ ] **Step 4: `upsert()` メソッドに `isMembershipOnly` デフォルトを追加**

同ファイルの `upsert(video)` メソッド。現状：

```js
    upsert(video) {
      upsertStmt.run({
        ...video,
        duration: video.duration ?? null,
        publishedAt: video.publishedAt ?? null,
        source: video.source ?? 'api'
      })
    },
```

変更後（`isMembershipOnly` を 0/1 へ正規化。better-sqlite3 は boolean を直接バインドできないため数値にする）：

```js
    upsert(video) {
      upsertStmt.run({
        ...video,
        duration: video.duration ?? null,
        publishedAt: video.publishedAt ?? null,
        isMembershipOnly: video.isMembershipOnly ? 1 : 0,
        source: video.source ?? 'api'
      })
    },
```

- [ ] **Step 5: `rowToVideo` に `isMembershipOnly` を追加**

同ファイルの `rowToVideo`。`duration` / `publishedAt` を返している箇所に追加：

```js
      duration: row.duration ?? null,
      publishedAt: row.published_at ?? null,
      isMembershipOnly: row.is_membership_only === 1,
      isFavorite: row.is_favorite === 1,
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run test -- videoRepository.membership 2>&1 | tail -12`
Expected: PASS（3 テスト）

- [ ] **Step 7: 全テストを確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6`
Expected: 全 pass。既存の upsert を呼ぶテストは Step 4 のデフォルトで吸収される。

- [ ] **Step 8: コミット**

```bash
git add src/main/repositories/videoRepository.js tests/main/videoRepository.membership.test.js
git commit -m "feat(main): wire is_membership_only through videoRepository"
```

---

## Task 4: `schedulerService` に `addManualVideo` を追加

**Files:**
- Modify: `src/main/services/schedulerService.js`

`schedulerService` は `videoFetcher`・`ytFactory`・`authClient`・`videoRepo`・`toVideoRecord` を持つ。手動登録ロジックはここに置く（`backfillArchiveMeta` と同じ場所）。

- [ ] **Step 1: import を追加**

`src/main/services/schedulerService.js` の先頭、既存 import の下に追加：

```js
import { deriveStatus } from './videoStatus.js'
import { parseDuration } from '../lib/parseDuration.js'
import { resolveVideoId } from '../lib/resolveVideoId.js'
```

（`deriveStatus` / `parseDuration` は既存。`resolveVideoId` を追加。）

- [ ] **Step 2: `addManualVideo` 関数を追加**

`backfillArchiveMeta` 関数の直後（`return {` の直前）に追加：

```js
  // URL/ID で指定された動画を手動登録する。メンバー限定配信など
  // RSS・購読 API で自動検出できない動画を追跡対象に加えるために使う。
  async function addManualVideo(input) {
    const videoId = resolveVideoId(input)
    if (!videoId) {
      return { ok: false, error: 'INVALID_INPUT' }
    }
    if (!authClient) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const yt = ytFactory(authClient)
    let details
    try {
      details = await videoFetcher.fetch(yt, [videoId])
    } catch (err) {
      logger.error('scheduler.addManualVideo.error', { videoId, error: err })
      return { ok: false, error: 'FETCH_FAILED' }
    }
    const item = details.find((v) => v.id === videoId)
    if (!item) {
      // 動画が存在しない / 非公開 / メンバーでないため取得不可
      return { ok: false, error: 'NOT_FOUND' }
    }
    const now = Date.now()
    const record = {
      ...toVideoRecord(item, now),
      isMembershipOnly: true,
      source: 'manual'
    }
    videoRepo.upsert(record)
    logger.info('scheduler.addManualVideo.done', { videoId, status: record.status })
    return { ok: true, video: videoRepo.getById(videoId) }
  }
```

- [ ] **Step 3: `addManualVideo` を返り値に追加**

同ファイルの `return {` ブロック。現状は `backfillArchiveMeta,` と `async refresh(...)` がある。`addManualVideo` を追加：

```js
  return {
    backfillArchiveMeta,
    addManualVideo,
    async refresh(opts = {}) {
```

- [ ] **Step 4: lint と全テストを確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6`
Expected: lint clean、全テスト pass（`addManualVideo` は次タスクの IPC 経由でのみ呼ばれるため、このタスク単体で新規テストは追加しない。動作確認は Task 10 の実機検証で行う）

- [ ] **Step 5: コミット**

```bash
git add src/main/services/schedulerService.js
git commit -m "feat(main): add addManualVideo to schedulerService"
```

---

## Task 5: IPC ハンドラ `videos:addManual` と preload 公開

**Files:**
- Modify: `src/main/ipc/videoHandlers.js`
- Modify: `src/preload/index.js`

- [ ] **Step 1: videoHandlers.js を確認**

`src/main/ipc/videoHandlers.js` を `Read` し、`registerVideoHandlers` がどの依存（`getVideoRepo` 等）を受け取るか、`scheduler` を参照できるかを確認する。`videos:listArchive` ハンドラの近くに新ハンドラを足す。

`scheduler` インスタンスがハンドラから参照できない場合は、`index.js` の `registerAllHandlers` 経由で `getScheduler` ゲッターを渡す形にする（既存の `getMainWindow` / `getVideoRepo` と同じパターン）。`index.js` の `scheduler` はモジュールスコープ変数なので、`videoHandlers` に `getScheduler: () => scheduler` を渡せばよい。

- [ ] **Step 2: `videos:addManual` ハンドラを追加**

`src/main/ipc/videoHandlers.js` の `registerVideoHandlers` 内、`videos:listArchive` ハンドラの後に追加（`getScheduler` は Step 1 で配線したゲッター）：

```js
  ipcMain.handle('videos:addManual', async (_, input) => {
    const scheduler = getScheduler()
    if (!scheduler) return { ok: false, error: 'NOT_AUTHENTICATED' }
    return scheduler.addManualVideo(input)
  })
```

- [ ] **Step 3: index.js で `getScheduler` を配線**

`src/main/index.js` の `registerVideoHandlers(...)` 呼び出しに `getScheduler: () => scheduler` を追加する。`registerVideoHandlers` の引数オブジェクトに合わせること（Step 1 で確認した形）。

- [ ] **Step 4: preload に `addManual` を公開**

`src/preload/index.js` の `listArchive` 公開行（`listArchive: (opts) => ipcRenderer.invoke('videos:listArchive', opts),`）の近くに追加：

```js
  addManualVideo: (input) => ipcRenderer.invoke('videos:addManual', input),
```

- [ ] **Step 5: lint・test・build を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6 && npm_config_cache=<temp-dir>/npm-cache npm run build 2>&1 | tail -3`
Expected: すべて pass

- [ ] **Step 6: コミット**

```bash
git add src/main/ipc/videoHandlers.js src/main/index.js src/preload/index.js
git commit -m "feat(main): add videos:addManual IPC handler"
```

---

## Task 6: 手動登録動画をスケジューラの追跡対象に含める

**Files:**
- Modify: `src/main/services/schedulerService.js`

手動登録した動画は RSS に出ないため、スケジューラの再チェック対象から漏れて status が更新されない恐れがある。`source='manual'` かつ未 ended の動画を明示的に再チェック対象へ加える。

- [ ] **Step 1: videoRepository に manual 動画 ID 取得メソッドを追加**

`src/main/repositories/videoRepository.js` に prepared statement とメソッドを追加。

prepared statement（`backfillTargetIdsStmt` の近く）：

```js
  const manualTrackingIdsStmt = db.prepare(`
    SELECT id FROM videos WHERE source = 'manual' AND status != 'ended'
  `)
```

メソッド（`listBackfillTargetIds` の近く）：

```js
    // 手動登録された未終了の動画 ID（スケジューラの再チェック対象）
    listManualTrackingIds() {
      return manualTrackingIdsStmt.all().map((row) => row.id)
    },
```

- [ ] **Step 2: scheduler の再チェック対象に manual 動画を加える**

`src/main/services/schedulerService.js` の `doRefresh`（`refresh` の実体）内、再チェック ID を組み立てている箇所を `Read` で特定する。`recheckIds` と `newIds` から `target` を作っている付近（`const target = Array.from(new Set([...newIds, ...recheckIds]))` のような行）。

`target` を作る行を、manual 動画 ID も含めるよう変更する：

```js
    const manualIds = videoRepo.listManualTrackingIds()
    const target = Array.from(new Set([...newIds, ...recheckIds, ...manualIds]))
```

これで手動登録動画も毎 refresh で `videos.list` 再取得され、upcoming→live→ended が追跡される。`is_membership_only` は Task 3 の `MAX` 保持により維持される。

- [ ] **Step 3: orphan 判定から manual 動画を除外**

同じ `doRefresh` 内の orphan 検出（`orphanIds` を組み立てる箇所、コメントに「RSS から消えた live/upcoming 動画を救済」とある付近）を `Read` で確認する。orphan 判定は「RSS に居ない visible 動画」を対象にするが、manual 動画は元々 RSS に居ないため毎回 orphan 扱いされる。Step 2 で manual 動画は既に `target` に入り `fetchedIds` に含まれるので、`orphanIds` の既存フィルタ `!fetchedIds.has(id)` で自然に除外される。**コード変更は不要。** `Read` で「manual 動画が Step 2 の target 経由で fetchedIds に入る → orphanIds から外れる」ことを確認するだけ。確認できなければ DONE_WITH_CONCERNS で報告する。

- [ ] **Step 4: lint・test を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6`
Expected: すべて pass

- [ ] **Step 5: コミット**

```bash
git add src/main/repositories/videoRepository.js src/main/services/schedulerService.js
git commit -m "feat(main): track manually-added videos in scheduler refresh"
```

---

## Task 7: SettingsModal に「メンバー限定」セクションを追加（Codex 担当）

**Files:**
- Modify: `src/renderer/components/SettingsModal.jsx`

- [ ] **Step 1: SettingsModal の構造を確認**

`src/renderer/components/SettingsModal.jsx` を `Read`。タブ定義は冒頭の配列（`{ key: 'general', label: '⚙️ 基本' }` など 3 つ）。`activeTab` state と、各タブの本文を出し分ける JSX、`sectionLabelStyle`、既存の「手動追加」セクション（channels タブ内、チャンネル手動追加）を確認する。

- [ ] **Step 2: 新タブ「📺 メンバー限定」を追加**

タブ定義配列に 4 つ目を追加：

```js
const TABS = [
  { key: 'general', label: '⚙️ 基本' },
  { key: 'channels', label: '📌 チャンネル' },
  { key: 'membership', label: '📺 メンバー限定' },
  { key: 'data', label: '📦 データ管理' }
]
```

（実際の配列変数名・既存要素は Step 1 の確認結果に合わせる。）

- [ ] **Step 3: メンバー限定タブの本文を実装**

`activeTab === 'membership'` のときに表示する本文を、他タブの本文 JSX と同じ並びに追加する。内容：

- 見出し（`sectionLabelStyle`）「メン限動画の手動追加」
- 説明文：「メンバー限定配信など、自動で取得できない動画を URL または動画 ID で追加できます。追加にはその動画を視聴できる Google アカウントでのログインが必要です。」
- テキスト入力（`useState` で `manualVideoInput`）＋「追加」ボタン
- 「追加」ボタン押下で `window.api.addManualVideo(manualVideoInput)` を呼ぶ。`useState` の `manualVideoSaving` で二重送信防止
- 結果表示：
  - `{ ok: true, video }` → 「『{video.title}』を追加しました」を成功メッセージで表示し、入力欄をクリア
  - `{ ok: false, error }` → エラーコードを日本語に変換して表示：
    - `INVALID_INPUT` → 「URL または動画 ID の形式が正しくありません」
    - `NOT_AUTHENTICATED` → 「ログインが必要です。基本タブからログインしてください」
    - `NOT_FOUND` → 「動画が見つかりません。非公開、またはこのアカウントで視聴できない可能性があります」
    - `FETCH_FAILED` → 「取得に失敗しました。時間をおいて再試行してください」

スタイル・記法は既存 SettingsModal（関数コンポーネント、`semi: false`、`singleQuote`、`sectionLabelStyle` 等）に合わせる。既存「手動追加」（チャンネル）セクションの入力欄＋ボタンの実装が参考になる。

- [ ] **Step 4: lint・test・build を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6 && npm_config_cache=<temp-dir>/npm-cache npm run build 2>&1 | tail -3`
Expected: すべて pass

- [ ] **Step 5: コミット**

```bash
git add src/renderer/components/SettingsModal.jsx
git commit -m "feat(renderer): add membership video manual-add section to settings"
```

---

## Task 8: `ScheduleCard` に 🔒 バッジを追加（Codex 担当）

**Files:**
- Modify: `src/renderer/components/ScheduleCard.jsx`

- [ ] **Step 1: 既存バッジ表示を確認**

`src/renderer/components/ScheduleCard.jsx` を `Read`。`item.isPinned` で 📌 バッジを出している箇所、`item` の使われ方、PropTypes を確認する。

- [ ] **Step 2: 🔒 バッジを追加**

`item.isMembershipOnly` が true のとき、カードに 🔒 バッジを表示する。既存の 📌 バッジ（`isPinned`）と同じ場所・同じスタイルパターンで、タイトル付近に出す。ツールチップ的に `title="メンバー限定"` を付ける。

PropTypes の `item` shape に追加：

```js
    isMembershipOnly: PropTypes.bool,
```

- [ ] **Step 3: lint・test・build を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6 && npm_config_cache=<temp-dir>/npm-cache npm run build 2>&1 | tail -3`
Expected: すべて pass

- [ ] **Step 4: コミット**

```bash
git add src/renderer/components/ScheduleCard.jsx
git commit -m "feat(renderer): show membership-only badge on card"
```

---

## Task 9: メン限動画の表示フィルタ（Codex 担当）

**Files:**
- Modify: `src/renderer/hooks/useTabState.js`
- Modify: `src/renderer/src/App.jsx`

設定でメン限動画を一覧から隠せるトグルを追加する。`electron-store` の汎用 `settings:get`/`settings:set` を使う（キー名 `hideMembershipVideos`、デフォルト false）。

- [ ] **Step 1: useTabState に hideMembership 状態を追加**

`src/renderer/hooks/useTabState.js` を `Read`。`archiveFilters` 等の state 定義の近くに追加：

```js
  const [hideMembershipVideos, setHideMembershipVideos] = useState(false)
```

起動時に保存値をロードする `useEffect`（`archiveFilters` の復元 useEffect と同じパターン）：

```js
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = await window.api.getSetting?.('hideMembershipVideos', false)
      if (!cancelled) setHideMembershipVideos(saved === true)
    })()
    return () => {
      cancelled = true
    }
  }, [])
```

`setHideMembershipVideos` を呼ぶラッパを用意して保存も行う：

```js
  function toggleHideMembershipVideos(next) {
    setHideMembershipVideos(next)
    window.api.setSetting?.('hideMembershipVideos', next)
  }
```

- [ ] **Step 2: filterItem にメン限除外を組み込む**

`useTabState` 内の `filterItem`（live/upcoming/missed/favorites の絞り込みに使う関数）を `Read` で確認し、`hideMembershipVideos` が true のとき `item.isMembershipOnly` の動画を除外する条件を追加する。

注意：`filteredArchive` は現在 `archiveVideos` をそのまま返す（サーバー側フィルタ済み）。アーカイブもメン限除外を効かせるため、`filteredArchive` を `hideMembershipVideos ? archiveVideos.filter((v) => !v.isMembershipOnly) : archiveVideos` に変更する。

- [ ] **Step 3: 戻り値に追加**

`useTabState` の return に追加：

```js
    hideMembershipVideos,
    toggleHideMembershipVideos,
```

- [ ] **Step 4: SettingsModal にトグルを追加**

`src/renderer/src/App.jsx` で `useTabState` の戻り値から `hideMembershipVideos` / `toggleHideMembershipVideos` を受け取り、`SettingsModal` に props で渡す。`SettingsModal` のメンバー限定タブ（Task 7 で追加）に「メン限動画を一覧に表示しない」チェックボックスを追加し、`hideMembershipVideos` / `toggleHideMembershipVideos` を配線する。

既存の設定トグル（例：通知・自動アップデートのトグル）と同じ UI パターンに合わせる。

- [ ] **Step 5: lint・test・build を確認**

Run: `npm_config_cache=<temp-dir>/npm-cache npm run lint 2>&1 | tail -3 && npm_config_cache=<temp-dir>/npm-cache npm run test 2>&1 | tail -6 && npm_config_cache=<temp-dir>/npm-cache npm run build 2>&1 | tail -3`
Expected: すべて pass

- [ ] **Step 6: コミット**

```bash
git add src/renderer/hooks/useTabState.js src/renderer/src/App.jsx src/renderer/components/SettingsModal.jsx
git commit -m "feat(renderer): add toggle to hide membership-only videos"
```

---

## Task 10: API 検証ゲート（Claude 担当・実機検証）

このタスクは Plan 2c-2（`search.list` 自動巡回）の設計可否を決めるための実機検証。コード変更は無く、検証結果を記録する。

**Files:**
- Modify: `CLAUDE_CODE_HANDOFF.md`（検証結果を記録）

- [ ] **Step 1: 手動登録の実機確認**

`npm run dev` で起動し、ユーザーがメンバーである チャンネルのメン限動画 URL を「メンバー限定」タブの手動追加で登録する。確認：

- メン限動画が追加できる（`{ ok: true }`）
- 追加した動画が schedule または archive タブに表示され、🔒 バッジが付く
- メン限でない通常動画 URL でも追加できる
- 不正な文字列 → 「形式が正しくありません」エラー

- [ ] **Step 2: `search.list` のメン限可視性を検証**

ユーザーがメンバーであるチャンネルに「メンバー限定の予約配信」が現在あるか確認する。あれば、そのチャンネル ID に対して `search.list`（`part=snippet, eventType=upcoming, type=video, channelId=...`）を、ユーザーの OAuth トークンで呼ぶ一時スクリプトを `tmp_verify_membership_search.mjs` 等で作成して実行し、メン限予約配信が結果に含まれるか確認する。検証後その一時スクリプトは削除する。

メンバー限定の予約配信が現時点で存在せず検証できない場合は、その旨を記録して「未検証」とする。

- [ ] **Step 3: 検証結果を `CLAUDE_CODE_HANDOFF.md` に記録**

`handoff-protocol.md` の書式で、以下を記録する：

- 手動登録の実機確認結果（成功/失敗、🔒 バッジ表示の可否）
- `search.list eventType:upcoming` がメン限予約配信を返すか（返す/返さない/未検証）
- Plan 2c-2 への申し送り：返す → 自動巡回は有効、Plan 2c-2 を通常実装。返さない/未検証 → 自動巡回は不確実、Plan 2c-2 は「手動 ID 追跡の延長（チャンネル登録ではなく定期的な手動更新補助）」へ方針変更を検討

- [ ] **Step 4: コミット**

```bash
git add CLAUDE_CODE_HANDOFF.md
git commit -m "docs(handoff): record Phase 2c-1 verification and search.list findings"
```

---

## Self-Review Checklist（プラン作成者が完了後に確認）

- [ ] **Spec coverage:** spec §4.4 Task 2c の手動登録関連すべてに対応タスクがあるか
  - 手動動画 ID 登録 UI → Task 5（IPC）+ Task 7（UI）✓
  - `is_membership_only` カラム → Task 1 ✓
  - メン限動画の混在表示 → Task 4（手動登録で DB に入り通常タブに出る）+ Task 6（追跡）✓
  - 🔒 バッジ → Task 8 ✓
  - メン限フィルタ ON/OFF → Task 9 ✓
  - API 検証 → Task 10 ✓
  - `search.list` 自動巡回 → Plan 2c-2 に分離（本プラン対象外、Task 10 で検証）

- [ ] **Placeholder scan:** "TBD"・"適切に" 等の曖昧表現がないか。「Step 1 で確認」系はすべて確認タスクとして明示済み

- [ ] **Type consistency:** `isMembershipOnly`（JS 側 boolean）と `is_membership_only`（DB 側 0/1）の変換が Task 3 で一貫。`addManualVideo` の戻り値 `{ ok, error, video }` が Task 4・5・7 で一致。エラーコード（`INVALID_INPUT`/`NOT_AUTHENTICATED`/`NOT_FOUND`/`FETCH_FAILED`）が Task 4・7 で一致

---

## 完了基準

- Task 1-10 のコミットが `feature/manual-membership-video` に積まれている
- `npm run lint && npm run test && npm run build` がすべて pass
- メン限動画 URL を手動追加でき、🔒 バッジ付きで表示される（Task 10 実機確認）
- `CLAUDE_CODE_HANDOFF.md` に `search.list` 検証結果が記録され、Plan 2c-2 の方針が決まる
- merge ゲート 4 条件を満たし、ユーザー merge 指示後に develop へ
