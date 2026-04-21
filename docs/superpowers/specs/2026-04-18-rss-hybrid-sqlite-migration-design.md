# RSS ハイブリッド取得 + SQLite 保持移行 設計

作成日: 2026-04-18
対象: YouTube Schedule Viewer v1.4.0
目的: リアルタイム性向上（B）と保持方式刷新（C）を同時達成する

---

## 背景

### 現状

- 取得: `subscriptions.list`(~7U) → `playlistItems.list`(1U/ch) → `videos.list`(1U/50件) ≒ 431U/回
- 保持: `electron-store` に JSON フラット保存、TTL 24h、`filterStale()` で取得時フィルタ
- ポーリング: 2h 間隔
- RSS: 2026-04-18 の作業記録で「全チャンネル 404」として廃止

### 本設計での検証結果（2026-04-18）

- 複数チャンネルで RSS を再検証した結果、UA の有無に関わらず **HTTP 200** が返る
- 昨日投稿分まで正常にフィードに含まれており、RSS は現在稼働中
- 前回の 404 記録は一時的な障害か誤判定だった可能性が高い
- ただし再度 404 化するリスクは残るため、プライマリを RSS、フォールバックを API にしたハイブリッド構成とする

---

## 方針サマリー

| 軸             | 採用                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| 取得方式       | RSS ファースト + `playlistItems.list` フォールバック（①+⑥ ハイブリッド） |
| ポーリング間隔 | 30 分（現状 2h から短縮）                                                |
| 保持方式       | SQLite (`better-sqlite3`) 一本化、electron-store は設定専用に縮退        |
| インフラ       | 追加なし（デスクトップアプリ単体で完結）                                 |

**期待効果:**

- RSS 全成功時のクォータ消費 ~1U/回、日次 48U（現状 5,172U の 1%）
- 30min 間隔へ短縮しつつクォータに大幅な余裕
- 動画単位の差分管理・履歴保持・インデックス付きクエリが可能に

---

## 1. アーキテクチャ

```
┌──────────────────────────────────────────────────────┐
│ Renderer (React)                                      │
│   useSchedule → IPC("schedule:get" / "schedule:refresh") │
└──────────────────────┬───────────────────────────────┘
                       │ IPC
┌──────────────────────▼───────────────────────────────┐
│ Main プロセス                                          │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │ SchedulerService │◄──►│ VideoRepository      │   │
│  │ (取得オーケスト)  │    │ (SQLite データ層)     │   │
│  └────────┬─────────┘    └──────────────────────┘   │
│           │                                           │
│  ┌────────▼────────────────────────────────┐        │
│  │ Fetchers                                 │        │
│  │  ├─ SubscriptionsFetcher (1日キャッシュ) │        │
│  │  ├─ RssFetcher          (プライマリ)     │        │
│  │  ├─ PlaylistItemsFetcher (フォールバック)│        │
│  │  └─ VideoDetailsFetcher (videos.list)   │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### コンポーネント責務

| コンポーネント     | 責務                                 | 現状からの変化                     |
| ------------------ | ------------------------------------ | ---------------------------------- |
| `SchedulerService` | 取得フロー全体のオーケストレーション | 新規（現 `fetchSchedule` を昇格）  |
| `Fetchers/*`       | 各データソースからの生データ取得のみ | 新規（現 `youtube-api.js` を分解） |
| `VideoRepository`  | SQLite への CRUD、期限切れ除外クエリ | 新規（`store.js` から分離）        |
| `SettingsStore`    | 設定のみ electron-store に残す       | 現 `store.js` を縮小               |

### 設計原則

- Fetcher は状態を持たない。取得のみ。永続化は Repository に任せる
- SchedulerService は純粋な合成。どの Fetcher をどの順で呼ぶかのロジックのみ
- electron-store は設定専用に縮退。キャッシュ責務は SQLite に全面委譲

### ネイティブバインディング対応

`better-sqlite3` が native module のため以下を追加する。

- `@electron/rebuild` を `postinstall` に追加
- `electron-builder` の `asarUnpack` に `better-sqlite3` のネイティブモジュールを指定
- GitHub Actions のリリースビルドは `npm install` 時に自動 rebuild で対応可能

---

## 2. SQLite スキーマ

### テーブル構成

#### 2.1 `videos` — 動画単位の正データ

```sql
CREATE TABLE videos (
  id                    TEXT PRIMARY KEY,
  channel_id            TEXT NOT NULL,
  channel_title         TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  thumbnail             TEXT,
  status                TEXT NOT NULL,               -- 'upcoming' | 'live' | 'ended'
  scheduled_start_time  INTEGER,                     -- unix ms
  actual_start_time     INTEGER,
  concurrent_viewers    INTEGER,
  url                   TEXT NOT NULL,
  first_seen_at         INTEGER NOT NULL,
  last_checked_at       INTEGER NOT NULL
);
CREATE INDEX idx_videos_status_sched ON videos(status, scheduled_start_time);
CREATE INDEX idx_videos_channel      ON videos(channel_id);
CREATE INDEX idx_videos_actual_start ON videos(actual_start_time);
```

#### 2.2 `channels` — 登録チャンネルキャッシュ

```sql
CREATE TABLE channels (
  id                          TEXT PRIMARY KEY,
  title                       TEXT,
  uploads_playlist_id         TEXT NOT NULL,
  last_subscription_sync_at   INTEGER NOT NULL
);
```

#### 2.3 `rss_fetch_log` — RSS 健全性観測

```sql
CREATE TABLE rss_fetch_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id    TEXT NOT NULL,
  fetched_at    INTEGER NOT NULL,
  success       INTEGER NOT NULL,
  http_status   INTEGER,
  error_message TEXT
);
CREATE INDEX idx_rss_log_time ON rss_fetch_log(fetched_at);
```

#### 2.4 `meta` — KV 形式の汎用メタデータ

```sql
CREATE TABLE meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- 用途: 'schema_version', 'last_full_refresh_at', etc.
```

### 主要クエリ

```sql
-- UI 表示用: live + 未来の upcoming を一発取得
SELECT * FROM videos
WHERE (status = 'live'     AND actual_start_time > :live_threshold)
   OR (status = 'upcoming' AND scheduled_start_time > :upcoming_threshold)
ORDER BY
  CASE status WHEN 'live' THEN 0 ELSE 1 END,
  scheduled_start_time ASC;

-- 差分取得判定
SELECT id FROM videos WHERE id IN (?, ?, ?, ...);

-- 定期クリーンアップ（1 日 1 回）
DELETE FROM videos
WHERE status = 'ended' AND last_checked_at < :thirty_days_ago;
```

### データ保持ポリシー

| データ種別                          | 保持期間           | 理由                           |
| ----------------------------------- | ------------------ | ------------------------------ |
| `videos` (status='ended')           | 30 日              | 将来の配信履歴検索機能の土台   |
| `videos` (status='live'/'upcoming') | 無期限             | 次回取得時の状態遷移判定に必要 |
| `channels`                          | 1 日ごとに洗い替え | 登録解除反映                   |
| `rss_fetch_log`                     | 30 日              | 直近の健全性のみ               |

### マイグレーション

- 起動時に `meta.schema_version` を読み、古ければ順次適用
- 初回 v1.4.0 起動時: 既存 `electron-store` の `scheduleCache` から videos テーブルへ 1 回だけ転記、完了後 `scheduleCache` キー削除
- 冪等設計（失敗しても再試行可能）

---

## 3. データフロー

### 3.1 定期自動更新（30 分間隔）

```
[Timer] SchedulerService.refresh()
  ↓
Step 1: 登録チャンネル解決
  SELECT FROM channels WHERE last_subscription_sync_at > now - 24h
    ├─ ヒット → DB の channels を使う (0U)
    └─ 古い  → subscriptions.list で洗い替え (~7U)
  ↓
Step 2: 各チャンネルから videoId 収集（並列 10）
  for ch in channels:
    try RssFetcher.fetch(ch.id)     // 0U, タイムアウト 3 秒
      ├─ ok  → videoIds             [log success]
      └─ ng  → PlaylistItemsFetcher // 1U     [log fail]
  ↓
Step 3: 差分抽出
  既知 = SELECT id FROM videos WHERE id IN (?)
  新規 = collected - 既知
  要再確認 = 既知 ∩ (status='live' OR 'upcoming' OR last_checked_at > 24h)
  ↓
Step 4: videos.list で詳細取得（50 件バッチ）
  対象 = 新規 ∪ 要再確認 (~1U/50 件)
  UPSERT videos, 戻り値から status 判定
  ↓
Step 5: Renderer への通知
  IPC: 'schedule:updated' → useSchedule が再読込
```

**クォータ試算（登録 100ch、RSS 全成功、差分 5 本）:**

- Step 1: 0U（キャッシュヒット）
- Step 2: 0U（RSS）
- Step 3: 0U（ローカル）
- Step 4: 1U
- 合計: 1U/回、30min 間隔で日次 48U

### 3.2 ユーザー手動更新

定期更新との差異は以下のみ。

- 全既知 video を強制再確認対象にする（live 鮮度優先）
- デバウンス 5 秒（現状仕様踏襲）

### 3.3 video の状態遷移

```
                      ┌──────────────────┐
       [新規検知] ──→ │    upcoming      │
                      │ (scheduledStart  │
                      │   が未来)         │
                      └─────┬────────────┘
                            │ actualStartTime 検知
                            ▼
                      ┌──────────────────┐
                      │      live        │
                      └─────┬────────────┘
                            │ actualEndTime 検知
                            │  OR scheduled が 2h+ 前かつ
                            │     liveBroadcastContent='none'
                            │  OR actualStartTime から 24h 経過
                            ▼
                      ┌──────────────────┐
                      │      ended       │
                      │  30 日後に DELETE │
                      └──────────────────┘
```

### 3.4 status 判定ロジック

```js
function deriveStatus(v, now) {
  const ld = v.liveStreamingDetails
  const bc = v.snippet?.liveBroadcastContent

  if (ld?.actualEndTime) return 'ended'
  if (ld?.actualStartTime) {
    const elapsed = now - new Date(ld.actualStartTime).getTime()
    return elapsed < 24 * 3600_000 ? 'live' : 'ended'
  }
  if (bc === 'upcoming') {
    const startMs = ld?.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : now + 1
    return startMs > now - 2 * 3600_000 ? 'upcoming' : 'ended'
  }
  return 'ended'
}
```

現状の `toScheduleItem` + インラインフィルタを統合した形で、ロジックは保存。既存テストの観点を継続活用する。

### 3.5 エラー・フォールバック経路

| エラー                                | 影響範囲 | 対処                                                            |
| ------------------------------------- | -------- | --------------------------------------------------------------- |
| RSS タイムアウト（3 秒）              | 該当 1ch | `playlistItems.list` へ自動 fallback                            |
| RSS 404                               | 該当 1ch | 同上                                                            |
| RSS XML パース失敗                    | 該当 1ch | 同上 + `rss_fetch_log` にエラー記録                             |
| `playlistItems.list` 失敗             | 該当 1ch | 空配列でスキップ                                                |
| `videos.list` 429/403（クォータ超過） | 全体     | 取得中断・バナー表示・SQLite の既存データで継続動作             |
| `subscriptions.list` 失敗             | 全体     | `channels` の古いキャッシュで継続動作                           |
| SQLite 破損                           | 全体     | 起動時に `PRAGMA integrity_check`、NG なら DB リセット + 再取得 |

**原則:** いかなる失敗も「SQLite の現データで UI は描画可能」を保つ。

### 3.6 初回起動・移行時の動作

```
起動
  ↓
schema_version チェック
  ├─ null  → テーブル作成 + electron-store から移行 or 空
  └─ < 1   → マイグレーション適用
  ↓
UI 描画（SQLite からの読み出し、空なら「更新ボタン」案内）
  ↓
バックグラウンドで初回取得開始
```

移行失敗時も SQLite は空のまま起動し、初回取得が走るので実害なし。

---

## 4. エラーハンドリング / UI 通知

| 状況                        | UI 表示                                        | 消える条件           | 現状比較 |
| --------------------------- | ---------------------------------------------- | -------------------- | -------- |
| クォータ超過（403）         | 永続バナー + リセット時刻（JST）               | 翌日リセット時刻到達 | 既存踏襲 |
| 認証切れ（401）             | 再ログインボタン付きバナー                     | 再認証成功           | 既存踏襲 |
| RSS 連続失敗率 > 80%（24h） | 警告バナー「RSS 失敗増加中」                   | 失敗率低下           | 新規     |
| DB 破損検知                 | モーダル「DB リセットします」 + OK で再作成    | ユーザー操作         | 新規     |
| ネットワーク全断            | 小さなトースト「オフライン、キャッシュ表示中」 | オンライン復帰       | 新規     |

### 単一インスタンス化

`better-sqlite3` の WAL モードは同一プロセス内では安全だが、複数プロセスからの書き込みはレースリスクあり。`app.requestSingleInstanceLock()` で単一インスタンス化する。

---

## 5. テスト戦略

> テストケースを先に宣言してから実装する（ユーザールール `test-strategy.md` 準拠）。

### レイヤー別方針

| レイヤー                                       | テスト手法                             | モック対象                              |
| ---------------------------------------------- | -------------------------------------- | --------------------------------------- |
| `VideoRepository`                              | Vitest + in-memory SQLite (`:memory:`) | なし                                    |
| `RssFetcher`                                   | Vitest + `msw` or `nock`               | HTTPS レスポンス                        |
| `PlaylistItemsFetcher` / `VideoDetailsFetcher` | Vitest                                 | `googleapis` mock                       |
| `SchedulerService`                             | Vitest                                 | Fetchers + Repository を `vi.mock`      |
| マイグレーション                               | Vitest                                 | 旧 electron-store 形式を fixture で投入 |

### テストケース一覧（実装前の宣言）

**VideoRepository:**

1. 正常: UPSERT したレコードが取得できる
2. 正常: status='upcoming' + 未来の時刻のみが `listVisible()` で返る
3. 境界値: `scheduled_start_time` がちょうど `now - 2h` の upcoming は除外
4. 境界値: `actual_start_time` がちょうど `now - 24h` の live は除外
5. 異常系: 存在しない id の GET で null
6. 冪等性: 同じ UPSERT を 2 回実行しても件数が増えない
7. 冪等性: マイグレーションを 2 回実行しても失敗しない

**RssFetcher:** 8. 正常: 200 + 有効 XML で videoId リストが返る 9. 異常系: 404 で `{ success: false, reason: 'http_404' }` 10. 異常系: 3 秒タイムアウトで `{ success: false, reason: 'timeout' }` 11. 異常系: XML パース失敗で `{ success: false, reason: 'parse' }` 12. 境界値: 空フィード（entry 0 件）で `{ success: true, videoIds: [] }`

**SchedulerService:** 13. 正常: RSS 全成功シナリオで videos.list 呼び出し回数が最小化される 14. 正常: RSS 一部失敗 → 失敗 ch だけ playlistItems.list が呼ばれる 15. 権限: OAuth 失効時は Fetcher に到達せずバナー表示用イベント発火 16. 冪等性: 同じデータで 2 回 refresh しても DB に変化なし 17. 競合: refresh 中にもう一度 refresh されても二重実行されない（ロックガード）

**マイグレーション:** 18. 旧 `scheduleCache` が存在する状態で起動 → videos テーブルに転記される 19. 転記後 `scheduleCache` キーが削除される 20. 失敗しても `schema_version` は更新されない（再試行可能）21. 新規インストール（store 空）でも正常起動

### テストで使わないもの

- OAuth 実認証（全テストで `authClient` はモック）
- YouTube 実 API（すべての YT 呼び出しはモック化）
- Electron 実行環境（Main プロセスのロジックは純粋 JS モジュールとして抽出し `app.getPath` 等は注入可能な形にする）

### 既存テストの扱い

現状 50 件のうち以下は移植または削除対象。

- `filterStale` 系 → Repository クエリテストへ移植
- electron-store `getCache`/`setCache` 系 → マイグレーションテストへ統合
- RSS タイムアウトテスト（v1.3.1 追加分）→ `RssFetcher` テストへ移植

### パフォーマンス確認（実装後）

- 登録 100ch × 15 本 = 1500 レコード規模で `listVisible()` が 50ms 以内
- 起動時の SQLite 初期化が 200ms 以内
- 30min 間隔の refresh が 15 秒以内に完了

### CI / コミット前チェック

現状ルール踏襲。

```bash
npm run lint
npm run test   # 上記 21 件 + 既存移植後 ≒ 70 件前後
```

---

## 6. スコープ外（YAGNI で保留）

以下はこの設計の範囲外とし、必要になった時点で別スプリントで扱う。

- WebSub (PubSubHubbub) による Push 通知取り込み（中継サーバーが必要）
- サードパーティミラー (Invidious / Piped) 対応
- 配信履歴検索 UI（SQLite 土台は準備するが UI は後続）
- 非表示チャンネル / お気に入りチャンネル機能

---

## 7. リスクと対処

| リスク                                       | 影響                                               | 対処                                                  |
| -------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| RSS が再度 404 化する                        | クォータ消費が playlistItems ベースに戻る（≒現状） | 自動 fallback で継続動作、`rss_fetch_log` で検知      |
| `better-sqlite3` の native rebuild 失敗      | リリースビルド失敗                                 | PR 前に 3 OS 分の `build:*` をローカル or CI で検証   |
| electron-store マイグレーション失敗          | 初回起動で既存データ消失                           | 冪等設計 + 失敗時は SQLite 空で継続、初回取得で再構築 |
| 30min 間隔でも OAuth トークンが refresh 失敗 | 認証切れバナーで停止                               | 既存の再ログイン UI を流用                            |

---

## 8. 関連ドキュメント

- `CLAUDE.md` — プロジェクト規約
- `.claude/rules/api-quota-design.md` — クォータ設計ルール
- `.claude/rules/test-strategy.md` — テスト観点ルール
- My-Skill-Graph: `decisions/` に本設計の要点を分割記録予定
