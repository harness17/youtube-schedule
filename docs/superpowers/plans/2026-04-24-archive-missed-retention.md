# アーカイブ・見逃し保持ポリシー刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 🔔 notify=1 の ended 動画を 90 日保持、viewed_at で通常 30 日扱いに戻す cleanup ロジックに刷新し、アーカイブ/お気に入りタブで既読カードを視覚的に区別する。

**Architecture:** `deleteExpiredEnded` の引数を `{ defaultThreshold, notifyThreshold }` に変更し、SQL 条件式で 2 段階判定。フロントは `ScheduleCard` に `isViewed` prop を追加し、App.jsx の `renderTabCard` で `item.viewedAt != null` を渡す。

**Tech Stack:** Electron, better-sqlite3, React, Vitest, React Testing Library

Spec: [`2026-04-24-archive-missed-spec-clarification.md`](../specs/2026-04-24-archive-missed-spec-clarification.md)

---

## ファイル構成

| 操作   | パス                                              | 役割                                                            |
| ------ | ------------------------------------------------- | --------------------------------------------------------------- |
| Modify | `src/main/repositories/videoRepository.js`        | `deleteExpiredEnded` の SQL 条件式と引数を刷新                  |
| Modify | `src/main/services/schedulerService.js`           | `NOTIFY_RETENTION_MS` 追加。`deleteExpiredEnded` に両閾値を渡す |
| Modify | `src/renderer/components/ScheduleCard.jsx`        | `isViewed` prop を受けて薄表示＋「見た」バッジ                  |
| Modify | `src/renderer/src/App.jsx`                        | `renderTabCard` で `isViewed={item.viewedAt != null}` を渡す    |
| Modify | `tests/main/repositories/videoRepository.test.js` | 既存テスト更新 + notify 保持テスト追加                          |
| Modify | `tests/main/services/schedulerService.test.js`    | `deleteExpiredEnded` 呼び出し引数を検証                         |
| Modify | `tests/renderer/ScheduleCard.test.jsx`            | `isViewed` の視覚表現テスト                                     |
| Modify | `CLAUDE.md`                                       | 保持ポリシー表を更新                                            |

---

## Task 1: Repository の保持ポリシー刷新

**Files:**

- Modify: `src/main/repositories/videoRepository.js:93-98,200-202`
- Test: `tests/main/repositories/videoRepository.test.js:103-122`

- [ ] **Step 1: 既存テストを新 API に合わせて更新 + notify 90日保持テストを追加**

`tests/main/repositories/videoRepository.test.js` の `deleteExpiredEnded` ブロック（103〜122 行目付近）を以下に置き換える。

```javascript
it('deleteExpiredEnded removes ended videos older than default threshold', () => {
  const now = 1_700_000_000_000
  repo.upsert(sampleVideo({ id: 'old', status: 'ended', lastCheckedAt: now - 31 * 24 * 3600e3 }))
  repo.upsert(sampleVideo({ id: 'fresh', status: 'ended', lastCheckedAt: now - 10 * 24 * 3600e3 }))
  const removed = repo.deleteExpiredEnded({
    defaultThreshold: now - 30 * 24 * 3600e3,
    notifyThreshold: now - 90 * 24 * 3600e3
  })
  expect(removed).toBe(1)
  expect(repo.getById('old')).toBeNull()
  expect(repo.getById('fresh')).not.toBeNull()
})

it('deleteExpiredEnded keeps favorited videos even when expired', () => {
  const now = 1_700_000_000_000
  repo.upsert(sampleVideo({ id: 'fav', status: 'ended', lastCheckedAt: now - 90 * 24 * 3600e3 }))
  repo.toggleFavorite('fav')
  const removed = repo.deleteExpiredEnded({
    defaultThreshold: now - 30 * 24 * 3600e3,
    notifyThreshold: now - 90 * 24 * 3600e3
  })
  expect(removed).toBe(0)
  expect(repo.getById('fav')).not.toBeNull()
})

it('deleteExpiredEnded keeps notify=1 unread videos up to 90 days', () => {
  const now = 1_700_000_000_000
  // 45日前 ended + notify=1 + 未読 → 残る
  repo.upsert(sampleVideo({ id: 'n45', status: 'ended', lastCheckedAt: now - 45 * 24 * 3600e3 }))
  repo.toggleNotify('n45')
  // 95日前 ended + notify=1 + 未読 → 消える
  repo.upsert(sampleVideo({ id: 'n95', status: 'ended', lastCheckedAt: now - 95 * 24 * 3600e3 }))
  repo.toggleNotify('n95')
  const removed = repo.deleteExpiredEnded({
    defaultThreshold: now - 30 * 24 * 3600e3,
    notifyThreshold: now - 90 * 24 * 3600e3
  })
  expect(removed).toBe(1)
  expect(repo.getById('n45')).not.toBeNull()
  expect(repo.getById('n95')).toBeNull()
})

it('deleteExpiredEnded drops notify=1 back to default threshold when viewed', () => {
  const now = 1_700_000_000_000
  // 45日前 ended + notify=1 + 既読 → 30日過ぎなので消える
  repo.upsert(sampleVideo({ id: 'v45', status: 'ended', lastCheckedAt: now - 45 * 24 * 3600e3 }))
  repo.toggleNotify('v45')
  repo.markViewed('v45', now - 40 * 24 * 3600e3)
  const removed = repo.deleteExpiredEnded({
    defaultThreshold: now - 30 * 24 * 3600e3,
    notifyThreshold: now - 90 * 24 * 3600e3
  })
  expect(removed).toBe(1)
  expect(repo.getById('v45')).toBeNull()
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm run test -- tests/main/repositories/videoRepository.test.js
```

Expected: 4 件 FAIL（古い API シグネチャでは通らない）

- [ ] **Step 3: `markViewed` が引数付き now を受けられるか確認**

`src/main/repositories/videoRepository.js` の `markViewed` を確認。現状 `now = Date.now()` がデフォルトかチェックする。

```bash
grep -n "markViewed\|markViewedStmt" src/main/repositories/videoRepository.js
```

デフォルト引数で `now = Date.now()` になっていない場合は、このタスクで `markViewed(id, now = Date.now())` に拡張する。

- [ ] **Step 4: `deleteExpiredStmt` と `deleteExpiredEnded` を刷新**

`src/main/repositories/videoRepository.js:93-98` を以下に置き換える。

```javascript
const deleteExpiredStmt = db.prepare(`
    DELETE FROM videos
    WHERE status = 'ended'
      AND is_favorite = 0
      AND (
        (notify = 1 AND viewed_at IS NULL AND COALESCE(ended_at, last_checked_at) < @notifyThreshold)
        OR
        ((notify = 0 OR viewed_at IS NOT NULL) AND COALESCE(ended_at, last_checked_at) < @defaultThreshold)
      )
  `)
```

続けて `deleteExpiredEnded` 関数（200-202 行目付近）を置き換える。

```javascript
    deleteExpiredEnded({ defaultThreshold, notifyThreshold }) {
      const result = deleteExpiredStmt.run({ defaultThreshold, notifyThreshold })
      return result.changes
    },
```

- [ ] **Step 5: `markViewed` シグネチャ調整（必要な場合のみ）**

Step 3 で `markViewed(id)` のみなら、以下に拡張する。

```javascript
    markViewed(id, now = Date.now()) {
      markViewedStmt.run({ id, now })
    },
```

- [ ] **Step 6: テストを実行してパスを確認**

```bash
npm run test -- tests/main/repositories/videoRepository.test.js
```

Expected: PASS（新規 2 件含む 4 件）

- [ ] **Step 7: コミット**

```bash
git add src/main/repositories/videoRepository.js tests/main/repositories/videoRepository.test.js
git commit -m "feat(repo): notify=1 未読動画の保持を90日に延長"
```

---

## Task 2: SchedulerService から両閾値を渡す

**Files:**

- Modify: `src/main/services/schedulerService.js:1-10,198-203`
- Test: `tests/main/services/schedulerService.test.js:155-181`

- [ ] **Step 1: schedulerService テストを新 API に合わせて更新**

`tests/main/services/schedulerService.test.js` で `deleteExpiredEnded` が呼ばれる箇所（155-181 行目付近）を確認し、呼び出し引数を検証する。

該当テスト (`runs cleanup` など) の `expect(mocks.videoRepo.deleteExpiredEnded).toHaveBeenCalledTimes(1)` の直後に以下を追加する。

```javascript
expect(mocks.videoRepo.deleteExpiredEnded).toHaveBeenCalledWith(
  expect.objectContaining({
    defaultThreshold: expect.any(Number),
    notifyThreshold: expect.any(Number)
  })
)
```

さらに閾値差が 60 日（90日 - 30日）であることを確認するテストを 1 件追加する。

```javascript
it('calls cleanup with 30d default and 90d notify thresholds', async () => {
  const mocks = createMocks()
  const svc = createService(mocks)
  await svc.refresh()
  const call = mocks.videoRepo.deleteExpiredEnded.mock.calls[0][0]
  expect(call.defaultThreshold - call.notifyThreshold).toBe(60 * 24 * 3600 * 1000)
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm run test -- tests/main/services/schedulerService.test.js
```

Expected: 新規追加分が FAIL

- [ ] **Step 3: `NOTIFY_RETENTION_MS` 定数を追加して両閾値を渡す**

`src/main/services/schedulerService.js:6` 付近に定数を追加。

```javascript
const ENDED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const NOTIFY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
```

`maybeCleanup` 関数（198-203 行目）を以下に置き換える。

```javascript
function maybeCleanup(now) {
  const last = Number(metaRepo.get(CLEANUP_META_KEY) ?? 0)
  if (now - last < CLEANUP_INTERVAL_MS) return
  videoRepo.deleteExpiredEnded({
    defaultThreshold: now - ENDED_RETENTION_MS,
    notifyThreshold: now - NOTIFY_RETENTION_MS
  })
  metaRepo.set(CLEANUP_META_KEY, String(now), now)
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
npm run test -- tests/main/services/schedulerService.test.js
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/main/services/schedulerService.js tests/main/services/schedulerService.test.js
git commit -m "feat(scheduler): NOTIFY_RETENTION_MS=90日を追加しcleanupに両閾値を渡す"
```

---

## Task 3: ScheduleCard に `isViewed` prop を追加

**Files:**

- Modify: `src/renderer/components/ScheduleCard.jsx:31-41,64-77,250-275`
- Test: `tests/renderer/ScheduleCard.test.jsx`

- [ ] **Step 1: 失敗するテストを追加**

`tests/renderer/ScheduleCard.test.jsx` の末尾（最後の `})` 直前）に以下を追加する。既存テストで使っている `sampleItem` 等のヘルパーに合わせて調整する。

```javascript
it('「見た」バッジを isViewed=true のとき表示する', () => {
  const item = { ...sampleItem(), viewedAt: 1_700_000_000_000 }
  render(<ScheduleCard item={item} isViewed={true} />)
  expect(screen.getByText('見た')).toBeInTheDocument()
})

it('isViewed=true のときカードの opacity が下がる', () => {
  const item = { ...sampleItem(), viewedAt: 1_700_000_000_000 }
  const { container } = render(<ScheduleCard item={item} isViewed={true} />)
  const card = container.firstChild
  expect(card).toHaveStyle({ opacity: '0.6' })
})

it('isViewed=false のときバッジは表示されない', () => {
  render(<ScheduleCard item={sampleItem()} isViewed={false} />)
  expect(screen.queryByText('見た')).not.toBeInTheDocument()
})
```

既存テストファイルに `sampleItem` が未定義なら、ファイル先頭の既存テストで使われているフィクスチャを参照して合わせる（例：`makeItem()` 等）。

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm run test -- tests/renderer/ScheduleCard.test.jsx
```

Expected: 3 件 FAIL

- [ ] **Step 3: `ScheduleCard` に `isViewed` prop を追加**

`src/renderer/components/ScheduleCard.jsx:31-41` の関数シグネチャに `isViewed` を追加。

```javascript
export default function ScheduleCard({
  item,
  darkMode = false,
  watched = false,
  onToggleWatch,
  onToggleFavorite,
  onMarkViewed,
  onTogglePin,
  isPinned = false,
  showViewedButton = false,
  isViewed = false
}) {
```

カードルートの `style`（`:64-77`）に `opacity` を追加する。

```javascript
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: cardBg,
        borderRadius: '8px',
        boxShadow: isLive ? '0 0 0 2px #FF0000' : '0 1px 4px rgba(0,0,0,0.1)',
        marginBottom: '8px',
        position: 'relative',
        borderLeft: isPinned ? '4px solid #FFD700' : undefined,
        opacity: isViewed ? 0.6 : 1
      }}
    >
```

タイトル行付近（既存の title 表示 JSX）に「見た」バッジを追加する。タイトルと同じ行に並べる：

```javascript
{
  isViewed && (
    <span
      style={{
        fontSize: '11px',
        padding: '2px 6px',
        marginLeft: '6px',
        borderRadius: '4px',
        background: darkMode ? '#555' : '#ddd',
        color: darkMode ? '#fff' : '#333',
        verticalAlign: 'middle'
      }}
    >
      見た
    </span>
  )
}
```

挿入位置はタイトル `<div>` または `<h3>` の直後。既存のタイトル JSX を読んで適切な箇所に入れること。

最後に PropTypes（250-275 行目付近）に追加：

```javascript
isViewed: PropTypes.bool
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
npm run test -- tests/renderer/ScheduleCard.test.jsx
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/renderer/components/ScheduleCard.jsx tests/renderer/ScheduleCard.test.jsx
git commit -m "feat(ui): ScheduleCard に isViewed prop と既読バッジを追加"
```

---

## Task 4: App.jsx で `isViewed` を渡す

**Files:**

- Modify: `src/renderer/src/App.jsx:413-429,1090-1114`

- [ ] **Step 1: `renderTabCard` で `isViewed` を渡す**

`src/renderer/src/App.jsx:413-429` の `renderTabCard` を以下に置き換える。

```javascript
function renderTabCard(item, extraProps = {}) {
  return (
    <ScheduleCard
      key={item.id}
      item={item}
      darkMode={darkMode}
      watched={item.isNotify}
      isPinned={pinnedChannelIds.has(item.channelId)}
      onToggleWatch={handleToggleNotify}
      onToggleFavorite={handleToggleFavorite}
      onMarkViewed={handleMarkViewed}
      onTogglePin={handleTogglePin}
      showViewedButton={true}
      isViewed={item.viewedAt != null}
      {...extraProps}
    />
  )
}
```

- [ ] **Step 2: missed タブでは `isViewed` を渡さない（常に未読なので不要）**

missed タブは `viewed_at IS NULL` のみ出るため `item.viewedAt != null` は常に false。挙動は変わらないが明示的に省略したい場合、`missedVideos` の `renderTabCard` 呼び出しで `isViewed={false}` を上書き指定することも可能。今回は **変更しない**（デフォルトのまま全タブ統一ロジックで十分）。

- [ ] **Step 3: ビルド＋全テストを確認**

```bash
npm run lint
npm run test
npm run build
```

Expected: すべてパス

- [ ] **Step 4: 実動確認**

```bash
npm run dev
```

手動チェック：

- [ ] アーカイブタブで既読の動画が薄表示＋「見た」バッジ
- [ ] お気に入りタブで同様
- [ ] 見逃しタブで「見た」ボタンを押すとカードが消える
- [ ] 見逃しタブに既読バッジは出ない（そもそも未読のみ表示）

- [ ] **Step 5: コミット**

```bash
git add src/renderer/src/App.jsx
git commit -m "feat(ui): アーカイブ・お気に入りタブで既読を視覚化"
```

---

## Task 5: CLAUDE.md の保持ポリシーを更新

**Files:**

- Modify: `H:/ClaudeCode/Youtube/youtube-schedule/CLAUDE.md`

- [ ] **Step 1: 保持ポリシー節を更新**

`CLAUDE.md` の「保持ポリシー」記述を検索。

```bash
grep -n "保持ポリシー\|30日\|ENDED_RETENTION" CLAUDE.md
```

該当行を以下に置き換える。

```markdown
- **保持ポリシー**：cleanup は以下の順で判定。
  1. `is_favorite=1` → 永久保持
  2. `notify=1 AND viewed_at IS NULL` → 90日保持（`NOTIFY_RETENTION_MS`）
  3. それ以外 → 30日保持（`ENDED_RETENTION_MS`）
     ユーザーが ✓（見た）を押すと notify=1 でも 30日扱いに戻る。
- **cleanup タイミング**：`SchedulerService.refresh()` の末尾で 24h ごとに実行。
```

ScheduleCard props の表にも `isViewed` を追加する。既存表の直後か該当行の下に挿入：

```markdown
| `isViewed` | bool | `item.viewedAt != null` を渡す。アーカイブ・お気に入りで既読バッジ＋薄表示に使用 |
```

- [ ] **Step 2: lint 確認＋コミット**

```bash
npm run lint
git add CLAUDE.md docs/superpowers/plans/2026-04-24-archive-missed-retention.md
git commit -m "docs: 保持ポリシー90日/30日の二段階を CLAUDE.md に反映"
```

---

## 最終チェック

- [ ] `npm run lint` クリーン
- [ ] `npm run test` 全件パス
- [ ] `npm run build` エラーなし
- [ ] `npm run dev` で実動確認済み（アーカイブ／お気に入りの既読表示・見逃しの「見た」消去）
- [ ] develop にプッシュ（`git push origin develop`）

---

## 非目標（再掲）

- 見逃しタブの「残り X 日」表示
- アーカイブの未見フィルタ
- 手動削除 UI

これらは今回のプランに含めない。
