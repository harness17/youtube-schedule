# YouTom プレイリスト取り込み 設計仕様

- 作成日: 2026-05-21
- 作成者: Claude Code（ユーザーとブレインストーミング）
- 対象リリース: v1.19.0 以降候補
- ステータス: scope reduced to import-only, implementation in progress

## 目的

YouTube 上のユーザー作成プレイリスト 1 つを「YouTom プレイリスト」として取り込み、YouTom 内で参照・整理する。
機能スコープは **YouTube プレイリスト → YouTom 取り込み専用** とし、YouTom から YouTube への反映導線は持たない。

## 非目標

- OAuth スコープを `youtube.readonly` から拡張すること
- YouTube 側プレイリストへの自動書き込み（`playlistItems.insert`）
- YouTom のお気に入りを YouTube プレイリストへ手動反映するエクスポート機能
- お気に入りタブとプレイリストタブの統合
- 複数プレイリスト同時同期
- 既存タブ（`schedule` / `missed` / `archive` / `favorites` / `new-videos`）の挙動変更

## 制約

- OAuth スコープは `youtube.readonly` 据え置き（Google 検証申請を回避）
- 既存 DB スキーマを破壊しない（追加のみ）
- 既存 `SchedulerService` のクォータ消費を大きく増やさない（自動同期 24h 周期）

## 全体像

```
[YouTube] --playlistItems.list--> playlistFetcher
   ↓ 既存動画と diff
playlistRepository（videos に in_playlist フラグ追加 + playlist_removed_at）
   ↓
IPC（playlist:get / playlist:refresh / playlist:cleanup）
   ↓
PlaylistTab（通常表示 / 削除済みフィルタ / 一括削除）

SettingsModal「📂 プレイリスト」タブ:
  - playlists.list?mine=true で自分のプレイリスト一覧取得（24h キャッシュ）
  - ドロップダウン選択
  - 「YouTube でプレイリストを作成」外部リンク誘導
```

## コンポーネント

| 種別      | パス                                                | 役割                                                                                                                         |
| --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| service   | `src/main/services/playlistFetcher.js`              | `playlistItems.list` ページング取得・diff                                                                                    |
| repo      | `src/main/repositories/playlistRepository.js`       | `in_playlist` / `playlist_removed_at` 操作、設定行管理                                                                       |
| IPC       | `src/main/ipc/playlistHandlers.js`                  | `playlist:get` / `playlist:refresh` / `playlist:cleanup` / `playlist:deleteOne` / `playlist:listMine` / `playlist:setConfig` |
| hook      | `src/renderer/hooks/usePlaylist.js`                 | 取得・再同期トリガー                                                                                                         |
| UI        | `src/renderer/components/PlaylistTab.jsx`           | 同期結果の表示、削除済みフィルタ、一括削除                                                                                   |
| UI        | `src/renderer/components/SettingsModal.jsx`（拡張） | プレイリスト設定タブ追加                                                                                                     |
| scheduler | `src/main/services/schedulerService.js`（拡張）     | 24h 周期でプレイリスト同期もキック                                                                                           |

## データ設計（migration 005）

```sql
ALTER TABLE videos ADD COLUMN in_playlist INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN playlist_added_at INTEGER;
ALTER TABLE videos ADD COLUMN playlist_removed_at INTEGER;

CREATE INDEX idx_videos_in_playlist ON videos(in_playlist);
CREATE INDEX idx_videos_playlist_removed ON videos(playlist_removed_at);

CREATE TABLE playlist_sync_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  playlist_id TEXT NOT NULL,
  playlist_title TEXT,
  last_synced_at INTEGER,
  enabled INTEGER DEFAULT 1
);
```

### 同期ロジック（playlistFetcher 擬似コード）

```
P = playlistItems.list で取得した現在の動画ID集合
D = videos WHERE in_playlist=1 の動画ID集合

新規追加 (P - D):
  - videos に UPSERT
  - in_playlist=1, playlist_added_at=now, playlist_removed_at=NULL

削除検出 (D - P):
  - in_playlist=0, playlist_removed_at=now（行は残す）

復活検出 (P ∩ D で playlist_removed_at IS NOT NULL):
  - playlist_removed_at=NULL, in_playlist=1
```

### 保持ポリシー（cleanup 拡張）

既存（`is_favorite` 永久 / `notify` 90日 / 通常 30日）に追加：

- `in_playlist=1` → **永久保持**（`is_favorite` 同等）
- `playlist_removed_at IS NOT NULL` → cleanup の自動削除対象外（ユーザーが「削除済みを一括削除」UI で明示削除するまで残す）

## クォータ設計

| API                        | ユニット/回 | 用途                 | 頻度            |
| -------------------------- | ----------- | -------------------- | --------------- |
| `playlists.list?mine=true` | 1           | 設定モーダル開いた時 | 24h キャッシュ  |
| `playlistItems.list`       | 1 / 50件    | 同期 1 回            | 自動 24h + 手動 |

最悪ケース：プレイリスト 500 件 → 10 ページ → 10 ユニット/同期。
1 日最大 10 ユニット（自動）+ 任意手動。既存スケジューラ消費（数百ユニット/日）に対し誤差。

`api-quota-design.md` の安全係数 0.6 を保つ。

## 同期タイミング

| トリガー | 頻度                                                 | 取得         |
| -------- | ---------------------------------------------------- | ------------ |
| 自動     | 24h（SchedulerService に組込み）                     | 全件 diff    |
| 手動     | プレイリストタブ「🔄 同期」ボタン（デバウンス 3 秒） | 全件 diff    |
| 初回     | 設定で選択直後                                       | 全件取り込み |

## エラー処理

| 状況                 | 挙動                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| 403 quotaExceeded    | 既存クォータバナーに「プレイリスト同期もリセット待ち」併記                |
| 404 playlistNotFound | UI で「プレイリストが削除/非公開化された可能性」エラー → 設定で再選択誘導 |
| ネットワークエラー   | 既存リトライ機構に乗せる                                                  |
| 認証エラー           | 既存 `auth:check` フローに合流                                            |

## UI

### 独立タブ「📂 プレイリスト」（App.jsx のタブ列最後尾）

```
┌─────────────────────────────────────────────────┐
│ 📂 YouTom プレイリスト「お気に入り動画」(32件)   │
│ 最終同期: 5分前  [🔄 同期] [⚙️ 設定]            │
├─────────────────────────────────────────────────┤
│ フィルタ: [全て] [削除済みのみ ●3]              │
│           [💡 削除済みを一括削除]                │
├─────────────────────────────────────────────────┤
│ ScheduleCard 一覧                                │
│  - 通常動画: 既存表示                            │
│  - playlist_removed_at IS NOT NULL の動画:       │
│    「⚠️ プレイリストから削除済み」バッジ + 🗑    │
└─────────────────────────────────────────────────┘
```

- `ScheduleCard` 拡張 prop:
  - `isRemovedFromPlaylist: bool`（バッジ表示）
  - `onDeleteFromYoutom: (id) => void`（行ごと削除）
- 「削除済みを一括削除」は確認モーダル経由で `playlist_removed_at IS NOT NULL` の行を物理削除

### 設定モーダル「📂 プレイリスト」タブ

```
☑ 同期を有効にする

同期するプレイリスト:
[選択: お気に入り動画 (24件)            ▼]

プレイリストが無い場合:
[📂 YouTube でプレイリストを作成] (外部リンク)
 作成後にこの画面の選択肢を更新してください
```

- ドロップダウンは `playlists.list?mine=true` 結果（24h キャッシュ）
- 「YouTube で作成」は `https://www.youtube.com/feed/playlists` を外部ブラウザで開く
- お気に入りエクスポートは設計過程で検討したが、自動双方向同期にならず手動運用の負担が大きいため削除した

### ダークモード

既存 CSS 変数に乗せる。新規スタイルは `playlist-*` プレフィックスで衝突回避。

## IPC コントラクト

| チャンネル           | 引数                                     | 戻り値                                                         | 役割                   |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| `playlist:listMine`  | なし                                     | `[{ id, title, itemCount }]`                                   | 設定モーダル選択肢     |
| `playlist:setConfig` | `{ playlistId, playlistTitle, enabled }` | `{ ok: true }`                                                 | 設定保存               |
| `playlist:getConfig` | なし                                     | `{ playlistId, playlistTitle, lastSyncedAt, enabled } \| null` | 現在設定取得           |
| `playlist:get`       | `{ filter: 'all' \| 'removed' }`         | `[video...]`                                                   | タブ表示用             |
| `playlist:refresh`   | なし                                     | `{ added, removed, restored }`                                 | 手動同期               |
| `playlist:cleanup`   | なし                                     | `{ deleted: number }`                                          | 削除済み一括削除       |
| `playlist:deleteOne` | `videoId`                                | `{ deleted: number }`                                          | 削除済み動画の個別削除 |

## テスト方針

### Vitest 追加対象

| 対象                             | 観点                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `playlistRepository`             | UPSERT、削除フラグ立ち、復活、削除済み一括削除、空 DB    |
| `playlistFetcher`                | ページング、diff（追加/削除/復活）、403/404 ハンドリング |
| `playlistHandlers`               | IPC 入出力、設定未登録時の挙動                           |
| `PlaylistTab`                    | empty / loading / error / データあり / 削除済みフィルタ  |
| `SettingsModal` プレイリストタブ | ドロップダウン選択、作成リンク                           |
| migration 005                    | 既存 DB の ALTER 適用、ロールバック可能性確認            |

### 実動確認（Claude Code 側）

- `npm run dev` 起動
- 設定モーダルでプレイリスト選択 → 取り込み
- プレイリストタブで一覧表示
- YouTube 側で動画削除 → 手動同期 → バッジ表示
- 削除済みフィルタ・一括削除
- ダークモード崩れ確認

## リスク・未確定事項

- **`playlists.list?mine=true` のレスポンスサイズ:** プレイリスト数 100 超のユーザーで `maxResults` 制限に当たる可能性。MVP では先頭 50 件のみ表示・上限超過時に「YouTube で直接 URL を確認してください」案内を出す
- **動画メタデータの欠落:** プレイリストに含まれる動画が登録チャンネル外の場合、`videos.channel_id` が未登録チャンネルを指す。`channels` テーブルへの自動 INSERT が必要かは migration 005 設計時に確認
- **メン限・限定公開動画:** プレイリストに含まれていても API から取得できないケースがある。skip + ログでよい
- **YouTom から YouTube へ反映できないことの期待値:** `youtube.readonly` を維持するため、取り込み専用であることを UI とリリースノートで明示する
- **`new-videos` 簡易モードとの両立:** 簡易モード時にプレイリストタブを表示するかは UX 判断必要（MVP では通常モードのみ表示）

## 段階リリース案

| Phase   | 内容                                             |
| ------- | ------------------------------------------------ |
| Phase 1 | migration 005 + playlistRepository + 単体テスト  |
| Phase 2 | playlistFetcher + IPC + scheduler 統合           |
| Phase 3 | PlaylistTab + 削除済みフィルタ + 一括削除 UI     |
| Phase 4 | SettingsModal プレイリストタブ + 取り込み専用 UX |
| Phase 5 | 実動確認 + リリースノート + v1.19.0 タグ         |

各 Phase は Codex 実装 → Claude Code レビュー（`/cross-review`）→ ユーザー merge 判断。

## 関連

- 既存設計判断: `decisions/YouTomの統計集計をis_manualと活動時刻MAXで行うのは既存スキーマを壊さず整理判断を出すため`
- 制約根拠: OAuth `youtube.readonly` 維持 → 検証申請回避 → SignPath 蓄積中に変動要因を増やさない
- 関連 rule: `.claude/rules/api-quota-design.md` / `data-design-review.md` / `cross-agent-harness.md`
