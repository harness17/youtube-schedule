# YouTom 共同開発ハンドオフ

最終更新: 2026-05-21
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、汎用ハーネスは `.claude/rules/cross-agent-harness.md`、YouTom 固有 profile は `.claude/rules/project-collaboration-profile.md` を参照。

既存の `.claude/rules/cross-agent-review.md` は旧運用メモとして残し、相互依頼・レビュー・merge 判断はこのファイルと profile に集約する。

---

## 2026-05-21 09:56 修正完了（Phase 2 軽微指摘 3 件 — Codex 作成）

- 対象: `feature/playlist-sync-phase2`
- 作成者: Codex
- 主題: Claude Code クロスレビュー軽微指摘 3 件の反映
- 変更ファイル:
  - `src/main/index.js`
  - `src/main/services/playlistPolling.js`
  - `src/main/ipc/playlistHandlers.js`
  - `src/main/services/playlistSyncService.js`
  - `tests/main/services/playlistPolling.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
  - `tests/main/services/playlistSyncService.test.js`
- 実装概要:
  - 軽微1: playlist polling を認証済み時のみ開始。未認証・ログアウト時は既存 timer を clear して kick しない。
  - 軽微2: `playlist:setConfig` は `{ ok: true }` を即時返却し、初回 refresh は background 実行。完了時は `playlist:updated`、失敗時は `playlist:error` を送信。
  - 軽微3: playlist 取り込み時に `videoDetailsFetcher.fetch()` で `videos.list` 詳細をバッチ取得し、`deriveStatus()` で `upcoming/live/ended` を補正。
- 追加・更新テスト:
  - 未認証時に playlist polling が既存 timer を停止し、refresh kick も interval 登録も行わないこと。
  - `playlist:setConfig` が refresh 完了を待たず `{ ok: true }` を返し、background refresh 完了後に `playlist:updated` を送ること。
  - playlist 取り込み後、`videos.list` 詳細に基づいて `upcoming` / `live` status と時刻・視聴者数が保存されること。
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（40 files / 343 passed）
  - ✅ `npm run build`
- 実動確認:
  - 未実施。今回の変更は main process / IPC / service の単体テスト対象で、renderer UI 変更・DB migration 変更なし。
- 残リスク:
  - `videos.list` 追加消費は 500 件で最大 10 units。Phase 2 設計の許容範囲内だが、Phase 3 UI では refresh 中表示と quota error 表示を確認すること。
- 次アクション:
  - Claude Code が本修正差分を再レビューし、ユーザーが merge 判断を行う。

---

## 2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 2 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase2`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（39 files / 340 passed）
- 完成条件 8 項目: ✅ 全て満たす
- **🔴 重大指摘: なし**

### 設計判断の良い点

- 🟢 `PlaylistFetchError` クラスでエラーを型付け化（`QUOTA_EXCEEDED` / `PLAYLIST_NOT_FOUND` / `NOT_AUTHENTICATED` / `PLAYLIST_NOT_CONFIGURED` / `FETCH_FAILED`）。renderer が分岐しやすい
- 🟢 `Promise.race` でタイムアウト（15秒）。fetcher が無限待ちにならない
- 🟢 ページング処理で `pageToken=null` を検出して終了（無限ループ防止）
- 🟢 fetcher → upsert → applyDiff の順序契約を `playlistSyncService.doRefresh()` 内で厳守。Phase 1 申し送り遵守
- 🟢 `channelRepository.ensureChannel()` 追加で未登録チャンネル自動 INSERT。同時に `maxSyncStmt` を `uploads_playlist_id != ''` で絞り、subscription cache の 24h タイムスタンプ計算が `ensureChannel` 由来の空 uploads_playlist_id で破壊されないよう保護
- 🟢 `playlistSyncService.refresh()` に `inFlight` deduplication を導入。重複リクエストを 1 実行に集約
- 🟢 `refreshIfDue()` で `lastSyncedAt` を確認し 24h 未満ならスキップ。起動直後の二重実行回避
- 🟢 IPC エラーは `{ error: 'CODE' }` 形式で統一（既存パターン踏襲）
- 🟢 preload で `onUpdated(cb)` がリスナー解除関数を返す（メモリリーク回避の正攻法）
- 🟢 scheduler timer は `playlistRefreshTimer` として完全独立。`refreshTimer`（30 分）と干渉しない

### 🟡 軽微指摘（merge ブロッカーではない）

- 🟡 軽微1: ログイン/ログアウトで `initScheduler(null)` → `startPlaylistPolling()` が即座にキックされ、未認証 skip を返す。挙動は正しいが、空キックが起動時とログアウト時の 2 回走る。Phase 3 で UI が出来てから「未認証状態は polling を開始しない」最適化を検討
- 🟡 軽微2: `playlist:setConfig` 経由の初回 refresh は IPC ハンドラ完了まで待つ（同期的）。プレイリストが 500 件超だと UI が数秒固まる可能性。Phase 3 で「設定保存は即時、refresh は非同期トリガー」分離を検討
- 🟡 軽混3: `toVideoRecord` で `status: 'ended'` を固定。プレイリストに upcoming/live が含まれる場合、status が実態と乖離する。`playlist` 由来の動画は schedule タブに混ざらない設計なので実害なしだが、Phase 3 で `videos.list` を使って status 補正する余地あり

### 触ってはいけない範囲の確認

- ✅ migration 012 改変なし
- ✅ `videos_fts` トリガー / cleanup ポリシー未変更
- ✅ renderer 配下未変更
- ✅ OAuth スコープ（`youtube.readonly`）据え置き
- ✅ `release.yml` / `ci.yml` 未変更
- ✅ 既存 30 分ポーリングロジック未変更
- ✅ 他 feature ブランチ巻き戻しなし
- ✅ `channelRepository.js` の `maxSyncStmt` 変更は `ensureChannel` 追加に伴う必須の整合性修正で、handoff 「未登録チャンネル INSERT」許可範囲内

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ✅ 🔴 なし |
| ④ | ユーザー merge 指示 | ⏳ 待ち |

merge OK 判断後の手順:
1. `feature/playlist-sync-phase2` → `develop` に no-ff merge
2. Phase 3 依頼セクションを新規追加（UI: PlaylistTab + SettingsModal 拡張 + エクスポートモーダル）

### Phase 3 設計時の申し送り

- IPC エラー形式 `{ error: 'CODE' }` を renderer 側で分岐表示（NOT_AUTHENTICATED / PLAYLIST_NOT_CONFIGURED / QUOTA_EXCEEDED / PLAYLIST_NOT_FOUND）
- `playlist:setConfig` の初回 refresh が長時間ブロックしうる点をデバウンス + ローディング UI で吸収
- `playlist:updated` イベントを購読してタブ自動更新（unsubscribe 必須）
- 軽微3 の status 補正は Phase 3 で必要ないなら見送り（プレイリストタブだけで使うため）

---

## 2026-05-21 09:38 完了（プレイリスト同期 Phase 2 — Codex 作成）

- 対象: `feature/playlist-sync-phase2`
- 作成者: Codex
- 主題: YouTube プレイリスト 1 件を取り込む fetcher + IPC + scheduler 統合
- 触ってよい範囲:
  - `src/main/fetchers/playlistFetcher.js`
  - `src/main/services/playlistSyncService.js`
  - `src/main/ipc/playlistHandlers.js`
  - `src/main/index.js`
  - `src/preload/index.js`
  - `src/main/services/schedulerService.js`
  - `src/main/repositories/channelRepository.js`
  - `src/main/repositories/playlistRepository.js`（復活差分計算用の削除済み ID 取得のみ）
  - `tests/main/fetchers/playlistFetcher.test.js`
  - `tests/main/services/playlistSyncService.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
  - `tests/main/services/schedulerService.test.js`
  - `tests/main/repositories/channelRepository.test.js`
  - `tests/main/repositories/playlistRepository.test.js`
- 触ってはいけない範囲:
  - migration 012
  - `videos_fts` / cleanup policy
  - renderer UI
  - OAuth scope
  - `.github/workflows/release.yml` / `.github/workflows/ci.yml`
  - 他 feature ブランチ
- 完成条件:
  - `playlistFetcher` が `playlists.list?mine=true` と `playlistItems.list` ページングを提供し、403 quota / 404 playlist not found を識別可能にする
  - `playlistSyncService.refresh()` が設定確認、playlist 取得、実データ `videoRepository.upsert()`、未登録チャンネル `ensureChannel()`、diff 適用、最終同期時刻更新を行う
  - fetcher → upsert → applyDiff の順序契約を守る
  - IPC contract と preload の `window.api.playlist.*` を一致させる
  - scheduler から既存 30 分ポーリングとは独立して 24h 周期の playlist 同期を起動し、`playlist:updated` を通知する
  - 既存 319 テストを含む全テストを pass させる
- 変更内容:
  - `createPlaylistFetcher()` を追加。OAuth client は既存 auth client を受け取り、内部で `google.youtube({ version: 'v3', auth })` を生成する形にした
  - `createPlaylistSyncService()` を追加。playlist item snippet から空スタブではない動画レコードを作り、`videoRepo.upsert()` 後に `playlistRepo.applyDiff()` を呼ぶ
  - `channelRepository.ensureChannel(id, title, syncAt)` を追加し、playlist 由来の未登録チャンネルを `uploads_playlist_id=''` の最小行で INSERT する。空 uploads playlist は購読キャッシュ時刻の MAX から除外した
  - `playlistRepository.getRemovedPlaylistVideoIds()` を追加し、削除済みから復活した動画を `restored` として数えられるようにした
  - `playlistHandlers` と preload の `playlist` API を追加。`playlist:setConfig` は初回 refresh をトリガーし、`playlist:refresh` は未設定/未認証をエラーコードで返す
  - `SchedulerService` に `refreshPlaylist()` / `refreshPlaylistIfDue()` を追加し、`src/main/index.js` で独立 24h timer と起動時 due check を配線した
  - fetcher / sync service / IPC / scheduler delegation / repository helper の Vitest を追加・更新
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（39 files / 340 passed）
  - ✅ `npm run build`
- 実動確認: N/A（Phase 2 は main/preload の fetcher・IPC・scheduler 統合のみ。UI 実動確認は Phase 3 で実施予定）
- レビュー観点:
  - fetcher → upsert → applyDiff の呼び出し順が維持されているか
  - playlist item snippet 由来の動画メタデータで `videos` 必須カラムを満たしているか
  - `ensureChannel()` の `uploads_playlist_id=''` が既存 subscription cache 判定に悪影響を与えないか
  - `playlist:updated` / preload contract が Phase 3 UI から使いやすい形になっているか
  - scheduler の playlist 24h timer が既存 schedule 30 分 timer と独立しているか
- 未解決:
  - なし
- 次アクション:
  - Claude Code: `/cross-review` で Phase 2 実装をレビュー

---

## 2026-05-21 依頼（プレイリスト同期 Phase 2: fetcher + IPC + scheduler 統合 — Claude Code → Codex）

- 対象: `develop` から `feature/playlist-sync-phase2` を切る
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: YouTube プレイリスト 1 件を取り込む fetcher・IPC・scheduler 統合（UI は Phase 3 で別依頼）
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（**着手前に必読**。IPC contract と同期ロジックはここで確定済み）
- 前提: Phase 1（commit `60e50e1`）が develop に merge 済み。`playlistRepository` / migration 012 / `buildWatchUrl` ヘルパが利用可能

### 触ってよい範囲

- 新規:
  - `src/main/fetchers/playlistFetcher.js` — `playlists.list?mine=true` と `playlistItems.list` のページング取得
  - `src/main/services/playlistSyncService.js` — fetcher 結果と `playlistRepository.applyDiff` の橋渡し（diff 計算 + 実データ upsert）
  - `src/main/ipc/playlistHandlers.js`
  - `tests/main/fetchers/playlistFetcher.test.js`
  - `tests/main/services/playlistSyncService.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
- 変更最小限:
  - `src/main/index.js` — `playlistHandlers` 登録 + `playlistRepository` インスタンス化
  - `src/preload/index.js` — `window.api.playlist.*` を contextBridge で公開
  - `src/main/services/schedulerService.js` — 24h 周期で `playlistSyncService.refresh()` をキック（既存 30 分ポーリングは触らない）
  - `src/main/repositories/channelsRepository.js`（必要なら）— 未登録チャンネルを最小行で INSERT する関数追加

### 触ってはいけない範囲

- migration 012（Phase 1 完了済み）の改変
- 既存 30 分ポーリングのロジック
- `videos_fts` トリガー / cleanup ポリシー
- renderer 配下すべて（UI は Phase 3）
- OAuth スコープ（`youtube.readonly` 据え置き）
- `release.yml` / `ci.yml`
- 他 feature ブランチ

### 完成条件

1. **playlistFetcher** が以下を提供する:
   - `listMyPlaylists(oauth2Client)` → `[{ id, title, itemCount }]`（先頭 50 件、ページングは未対応で OK。51 件目以降は無視 + ログ）
   - `fetchPlaylistItems(oauth2Client, playlistId)` → `[{ videoId, snippet... }]`（500 件超は pageToken で全件取得、`maxResults=50`）
   - 403 quotaExceeded / 404 playlistNotFound を識別可能なエラーで throw（既存 fetcher のエラー形式に揃える）

2. **playlistSyncService.refresh()** が以下を実施する:
   - 設定取得 → `enabled=false` または未登録ならスキップ
   - `fetchPlaylistItems()` で現在のプレイリスト動画リストを取得
   - **各動画について `videoRepository.upsert()` で実データを書き込む（applyDiff より前に必ず実行）**
   - 動画のチャンネル ID が `channels` テーブル未登録なら `channelsRepository` で最小行を INSERT
   - `playlistRepository.getPlaylistVideoIds()` と diff 計算
   - `playlistRepository.applyDiff({ added, removed, restored })`
   - `playlistRepository.updateLastSyncedAt(now)`
   - 戻り値: `{ added: number, removed: number, restored: number }`

3. **IPC handlers**（`playlistHandlers.js`）:
   - `playlist:listMine` → `playlistFetcher.listMyPlaylists()` の結果を返す
   - `playlist:setConfig` → `playlistRepository.setConfig()` を呼び、`refresh` をトリガー（初回取り込み）
   - `playlist:getConfig` → `playlistRepository.getConfig()`
   - `playlist:get` → `playlistRepository.listPlaylistVideos({ filter })`
   - `playlist:refresh` → `playlistSyncService.refresh()`（手動同期、デバウンスは renderer 側で実装するため main では受けたら即実行）
   - `playlist:cleanup` → `playlistRepository.deleteRemoved()`
   - `playlist:exportFavorites` → `videoRepository.listFavorites()` から URL 配列を生成

4. **preload** で上記 IPC を `window.api.playlist.*` として公開

5. **schedulerService 統合**:
   - 既存 30 分ポーリングとは独立した 24h タイマーで `playlistSyncService.refresh()` を呼ぶ
   - アプリ起動直後にも 1 回呼ぶ（前回同期から 24h 経過していれば）
   - `schedule:updated` IPC イベントは既存通り。`playlist:updated` IPC イベントを別途追加して renderer に同期完了を通知

6. **テスト**:
   - `playlistFetcher`: モック化された googleapis client で `listMyPlaylists` / `fetchPlaylistItems` の正常系、403/404、ページング（51 件超）
   - `playlistSyncService`: in-memory DB で fetcher をモックし、初回取り込み・差分追加・削除・復活・未登録チャンネルの自動 INSERT
   - `playlistHandlers`: 各 IPC の正常系と異常系（未設定時の `playlist:refresh` 等）
   - 全テスト pass + 既存 319 テストも pass

7. `npm run lint` / `npm run test` / `npm run build` 全パス

8. **触ってはいけない範囲を変更していない**

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認（`npm run dev`）は Phase 3 で UI 完成後に Claude Code 側で実施。

### 既知リスク・申し送り

- **fetcher → applyDiff の順序契約**: fetcher が取得した動画は `videoRepository.upsert(real)` を applyDiff より前に必ず実行する。これを破ると空スタブが残る（Phase 1 レビュー軽微1 で指摘済み）
- **未登録チャンネル**: プレイリストに含まれる動画のチャンネルが `channels` テーブル未登録の場合、最小行（`id`, `title`, `uploads_playlist_id=''`, `last_subscription_sync_at=now`）を INSERT。既存の `channelsRepository` に類似関数がなければ `ensureChannel(id, title)` を追加
- **OAuth client**: `src/main/ipc/authHandlers.js` 等で初期化されている googleapis OAuth2 client インスタンスを再利用する。新規に作らない
- **クォータ**: 1 同期で `playlistItems.list` 最大 10 ユニット（500件 / 50件ページ）。24h 周期なので余裕あり。403 受領時は scheduler 側で次回 24h まで再試行しない
- **`playlists.list` キャッシュ**: spec では 24h キャッシュとしたが、Phase 2 では実装簡略化のため毎回 API 呼び出しで OK。キャッシュは Phase 3 設定モーダル実装時にまとめて検討
- **`playlist:updated` IPC**: renderer がまだ存在しないが、Phase 3 で必要になるので Phase 2 で発火側を実装しておく

### レビュー観点（Claude Code が cross-review でチェックする）

- fetcher → upsert → applyDiff の順序契約が守られているか
- 未登録チャンネル INSERT が channels の必須カラム制約を満たすか
- 403/404 のハンドリングが既存パターンに揃っているか
- IPC contract が preload と main で一致しているか
- scheduler 統合で既存 30 分ポーリングのタイミングを乱していないか
- 既存 319 テストが引き続き pass するか
- ページング処理が無限ループしないか（pageToken なし時の終了条件）

### 次アクション

1. Codex: 設計確認 → 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` でレビュー
3. ユーザー判断後に Phase 3（UI）依頼

### 関連

- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- Phase 1 commit: `60e50e1`
- Phase 1 レビュー申し送り: 同 handoff の Phase 1 クロスレビュー結果セクション参照

---

## 2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 1 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase1`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（36 files / 319 passed）
- 完成条件 5 項目: ✅ 全て満たす
- **🔴 重大指摘: なし**

### 設計判断の良い点

- 🟢 spec 指定の migration 005 が既存 011 と衝突するため 012 へリネーム。判断と理由を `My-Skill-Graph` decision に記録済み、追従可能
- 🟢 `in_playlist` に `NOT NULL DEFAULT 0` を付与（spec より厳しいが安全側）
- 🟢 `playlist_sync_config` の CHECK 制約を実テストで違反確認（複数行 INSERT が throw）
- 🟢 migration backward-compat テストで「migration 003+004 適用済み相当の旧 DB」に対して既存行が温存されることを実証
- 🟢 `applyDiff` で「同一 ID が removed + restored 両方にある場合は restored 勝ち」のエッジケースをテスト化
- 🟢 `deleteRemoved` は `in_playlist=0 AND playlist_removed_at IS NOT NULL` の両条件を要求し、`in_playlist=1` だが何らかの理由で removed_at が残った "inconsistent" 行を保護
- 🟢 `videoRepository` の `rowToVideo` を module-scope export 化して再利用（独立実装回避を完成条件通り遵守）
- 🟢 `applyDiff` 全体が `db.transaction` で囲まれ、原子性確保

### 🟡 軽微指摘（merge ブロッカーではない）

- 🟡 軽微1: `insertStubStmt` が新規動画に `channel_id=''`, `status='ended'` の空スタブを作る。Phase 2 fetcher が実データを upsert してから applyDiff を呼ぶ前提なら `INSERT OR IGNORE` で no-op になる。ただし呼び出し順を間違えると空スタブが残るため、Phase 2 設計時に「fetcher は applyDiff より前に必ず upsert」を契約として明文化する必要あり
- 🟡 軽微2: 完成条件で「変更最小限: `src/main/db/index.js`」と書いたが実体は `src/main/db/schema.js` だった。Codex は正しいファイルを修正した（私の handoff 側の記述ミス）。今後の handoff では実体ファイル名を確認してから書く
- 🟡 軽微3: stub 動画の URL に `https://www.youtube.com/watch?v=${id}` を埋め込む処理が `applyDiff` 内に直接書かれている。URL 組立てが今後別箇所でも必要になるなら `src/main/services/videoUrl.js` 等に抽出余地あり（YAGNI 観点では現状で OK）

### 触ってはいけない範囲の確認

- ✅ 既存 migration 001〜011 改変なし
- ✅ cleanup ロジック未変更
- ✅ fetcher / IPC / preload / renderer 未変更
- ✅ `release.yml` / `ci.yml` 未変更
- ✅ 他 feature ブランチ巻き戻しなし

### Merge 判断（4 条件）

| #   | 条件                | 状態                        |
| --- | ------------------- | --------------------------- |
| ①   | セルフ verify       | ✅ lint / test / build pass |
| ②   | 相互レビュー記録    | ✅ 本セクション             |
| ③   | 重大指摘なし        | ✅ 🔴 なし                  |
| ④   | ユーザー merge 指示 | ⏳ 待ち                     |

merge OK 判断後の手順:

1. `feature/playlist-sync-phase1` → `develop` に no-ff merge
2. Phase 2 依頼セクションを新規追加（fetcher + IPC + scheduler 統合）

### Phase 2 設計時の申し送り

- fetcher は `playlistRepo.applyDiff` を呼ぶ**前**に `videoRepo.upsert` で各動画の実データを書き込むこと（軽微1 の回避）
- 未登録チャンネルが含まれる動画は `channels` テーブルに最小行を自動 INSERT する設計が必要（spec の Phase 1 既知リスク参照）

---

## 2026-05-21 09:14 完了（プレイリスト同期 Phase 1 — Codex 作成）

- 対象: `feature/playlist-sync-phase1`
- 作成者: Codex
- 主題: YouTube プレイリスト 1 件を取り込むための DB スキーマ追加と `playlistRepository` 実装
- 触ってよい範囲:
  - `src/main/db/schema.js`
  - `src/main/db/migrations/012_playlist_sync.js`
  - `src/main/repositories/videoRepository.js`
  - `src/main/repositories/playlistRepository.js`
  - `tests/main/db/migrations/012_playlist_sync.test.js`
  - `tests/main/repositories/playlistRepository.test.js`
- 触ってはいけない範囲:
  - 既存 migration 001〜011
  - cleanup ロジック本体
  - fetcher / IPC / preload / renderer UI
  - `release.yml` / `ci.yml`
- 完成条件:
  - migration が `videos.in_playlist` / `playlist_added_at` / `playlist_removed_at`、関連 index、`playlist_sync_config` を追加する
  - `playlistRepository` が config 操作、playlist 動画一覧、diff 適用、削除済み一括削除、playlist ID 集合取得を提供する
  - `applyDiff` 全体を `better-sqlite3` transaction で包み、SQL は prepared statement を使う
  - `videoRepository` の `rowToVideo` を export して playlist 側で再利用し、row mapper を重複実装しない
  - 既存 migration と既存 DB データを破壊しない
- 変更内容:
  - 既存リポジトリには migration 005〜011 が既に存在したため、ハンドオフ上の「005_playlist_sync」相当を **`012_playlist_sync.js`** として追加
  - `src/main/db/schema.js` に migration 012 を登録
  - `videoRepository.js` の `rowToVideo` を top-level export に移動し、既存 repository 内の利用はそのまま維持
  - `playlistRepository.js` を新規追加。`getConfig` / `setConfig` / `updateLastSyncedAt` / `listPlaylistVideos` / `applyDiff` / `deleteRemoved` / `getPlaylistVideoIds` を実装
  - Phase 1 は fetcher 未実装のため、`applyDiff.added/restored` は既存行が無い場合に最小スタブ行を `INSERT OR IGNORE` し、playlist フラグを更新する
  - migration test と repository test を追加し、空 DB、004-era DB からの昇格、config 単一行制約、追加/削除/復活、空集合、重複 ID、削除+復活同時、削除済み一括削除を確認
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（36 files / 319 passed）
  - ✅ `npm run build`
- 実動確認: N/A（Phase 1 は読み取り・データ層のみ。UI 実動確認は Phase 3 以降）
- レビュー観点:
  - ハンドオフ指定の migration 番号 005 は現行 repo の既存 migration と衝突していたため、012 採番でよいか
  - `applyDiff` の同一 ID が `removed` と `restored` に同時指定された場合、現在 playlist に存在する扱いとして restored を勝たせる挙動でよいか
  - スタブ行の `status='ended'` / 空 channel/title は Phase 2 fetcher が metadata upsert で補完する前提でよいか
- 未解決:
  - cleanup の playlist 保持ポリシー反映はハンドオフ通り Phase 2 以降
  - fetcher / IPC / preload / UI は未実装
- 次アクション:
  - Claude Code が `/cross-review` で Phase 1 差分をレビューし、ユーザー merge 判断後に Phase 2 へ進む

---

## 2026-05-21 依頼（プレイリスト同期 Phase 1: migration 005 + playlistRepository — Claude Code → Codex）

- 対象: `develop` または `feature/playlist-sync-phase1`（推奨）
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: YouTube プレイリスト 1 件を取り込むための DB スキーマ追加と repository 実装（読み取り専用機能。fetcher / IPC / UI は Phase 2 以降で別依頼）
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（**着手前に必読**。SQL・カラム・保持ポリシーはすべてここで確定済み）

### 触ってよい範囲

- 新規: `src/main/db/migrations/005_playlist_sync.js`（既存 migration ファイル命名規則に合わせる。確認: `src/main/db/migrations/` 配下）
- 新規: `src/main/repositories/playlistRepository.js`
- 新規: `tests/main/repositories/playlistRepository.test.js`
- 新規: `tests/main/db/migrations/005_playlist_sync.test.js`
- 変更最小限: `src/main/db/index.js`（migration 配列に 005 を追加するだけ）

### 触ってはいけない範囲

- 既存 migration 001〜004 の改変
- 既存 `videos` テーブルのデータ削除を伴う ALTER
- `videos_fts` トリガー
- `cleanup` ロジック本体（Phase 2 で別途修正）
- 他の未マージ feature ブランチ
- `release.yml` / `ci.yml`

### 完成条件

1. **migration 005** が以下を実施する:
   - `videos` テーブルに `in_playlist INTEGER DEFAULT 0`、`playlist_added_at INTEGER`、`playlist_removed_at INTEGER` を追加
   - `idx_videos_in_playlist`、`idx_videos_playlist_removed` インデックス作成
   - `playlist_sync_config` テーブル新規作成（CHECK 制約で id=1 単一行）
2. **playlistRepository** が以下の関数を提供する（命名は既存 repo に合わせる）:
   - `getConfig()` → `{ playlistId, playlistTitle, lastSyncedAt, enabled } | null`
   - `setConfig({ playlistId, playlistTitle, enabled })` → void
   - `updateLastSyncedAt(timestamp)` → void
   - `listPlaylistVideos({ filter: 'all' | 'removed' })` → `videos[]`（既存 videos の row mapper を再利用）
   - `applyDiff({ added: videoId[], removed: videoId[], restored: videoId[] })` → void（トランザクション内で UPSERT / フラグ更新）
   - `deleteRemoved()` → `{ deleted: number }`（`playlist_removed_at IS NOT NULL` の行を物理削除）
   - `getPlaylistVideoIds()` → `Set<string>`（diff 計算用に in_playlist=1 の ID 集合を返す）
3. **テスト**:
   - migration 005 を空 DB に適用 → スキーマ確認
   - migration 005 を既存 003+004 適用済み DB に適用 → 既存データ温存確認
   - `applyDiff` の追加/削除/復活シナリオ（境界: 空集合、重複 ID、復活と削除同時）
   - `deleteRemoved` が `in_playlist=1` の行を消さないこと
   - `getConfig` が未登録時に null を返すこと
   - `setConfig` が単一行制約で複数行を作らないこと
4. `npm run lint` / `npm run test` / `npm run build` 全パス
5. **触ってはいけない範囲を変更していない**

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認は Phase 3 以降で UI が出来てから Claude Code 側で実施するため、Phase 1 は不要。

### 既知リスク

- **既存 DB 互換性:** `ALTER TABLE ADD COLUMN` で既存行は DEFAULT 0 が入る。これは `is_favorite` と同じパターンで既存実装あり、参考: `migration 003`
- **トランザクション境界:** `applyDiff` は1つのトランザクションで全件処理する。途中失敗時は全ロールバック
- **row mapper の重複:** 既存 `videoRepository` の row mapper を import 再利用する（独立実装しない）
- **`channels` テーブル外部キー:** プレイリストに含まれる動画のチャンネルが未登録の場合、`videos.channel_id` が孤立する可能性。Phase 2 fetcher 側で `channels` を必要に応じて自動 INSERT する想定。Phase 1 はカラム追加のみで FK 整合は問わない

### レビュー観点（Claude Code が cross-review でチェックする）

- migration 005 が既存 DB を破壊しないか
- `playlistRepository` の SQL に SQL インジェクション余地がないか（プリペアド使用）
- トランザクション境界が `applyDiff` 全体を包んでいるか
- 既存 `videoRepository` の row mapper を再利用しているか（重複実装していないか）
- テストが境界値（空集合・復活・削除同時）を網羅しているか
- `playlist_sync_config` の CHECK 制約が単一行を保証しているか

### 次アクション

1. Codex: スキーマ確認 → migration 005 実装 → playlistRepository 実装 → テスト追加 → セルフ verify → 完了セクション追記
2. Claude Code: `/cross-review` でレビュー
3. ユーザー判断後に Phase 2（fetcher + IPC + scheduler 統合）を別依頼で着手

### 関連

- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- 既存 migration: `src/main/db/migrations/`
- 既存 repo パターン: `src/main/repositories/videoRepository.js` / `statsRepository.js`

---

## 2026-05-21 00:16 機能追加（チャンネル「今すぐ同期」ボタン — Claude Code 作成）

- 作成者: Claude Code
- 主題: subscriptions.list の 24h キャッシュをバイパスして即座にチャンネル同期削除を反映するボタン
- ユーザー要望: 「沈黙チャンネルで対象を排除した後、反映されるタイミングが分からないと不便」+「ボタンは沈黙チャンネルにも追加」
- 変更:
  - `SchedulerService.resolveChannels` / `doRefresh` に `forceSubscriptionsResync` オプションを追加。true の場合 `lastSync` キャッシュチェックをスキップして subscriptions.list を即時取得
  - 新 IPC `channels:syncNow` を `videoHandlers.js` に追加（`scheduler.refresh({ forceSubscriptionsResync: true })` を呼んで `schedule:updated` を送信）
  - preload に `syncChannelsNow()` を公開
  - SettingsModal の「📌 チャンネル」タブ「優先チャンネル」セクションヘッダー下に「🔄 今すぐ同期」ボタン追加（disabled when 同期中/未認証）
  - StatsTab の「沈黙チャンネル」セクションヘッダー横に「🔄 今すぐ同期」ボタン追加。完了後 `reloadStats` も呼ぶ
  - App.jsx に `handleSyncChannelsNow({ reloadStatsAfter })` ハンドラと `isSyncingChannels` state を追加。toast でフィードバック
  - 既存の 30分自動ポーリング・24h キャッシュは変更なし
- テスト追加:
  - schedulerService: forceSubscriptionsResync で fresh cache でも subsFetcher.fetch が呼ばれる
  - StatsTab: 同期ボタン表示・クリックで onSyncNow 呼び出し・syncing=true で disabled
- セルフ verify: ✅ lint / ✅ test（34 files / 309 passed、+3 件）/ ✅ build
- 実動確認: ユーザーが Electron 閉じてからセルフ verify 実行、未確認の動作確認は次回 npm run dev で

---

## 2026-05-20 23:52 ユーザー指示反映（沈黙判定を投稿活動ベースに変更 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 沈黙判定は「配信のみ」ではなく「投稿活動全般（配信＋動画投稿）」を基準にする
- ユーザーフィードバック: 「投稿が指定日以内にあったら対象にしていい」— 動画投稿しか出していないチャンネルでも、最近の投稿があれば「生きている」と判断し、60日超活動なしのチャンネルだけを沈黙対象にしたい
- 対応:
  - `silentChannelsStmt` の活動時刻計算を `LIVE_ACTIVITY_AT`（actual/scheduled のみ）から `ANY_ACTIVITY_AT = COALESCE(v.actual_start_time, v.scheduled_start_time, v.published_at, 0)` に変更
  - 結果: 動画投稿のみのチャンネルも投稿日で評価される。直近60日に投稿があれば沈黙対象外、60日超なしなら沈黙対象
  - 投稿実績ゼロ（subscriptions だけ同期で videos レコードなし）は引き続き除外
  - UI note: 「直近60日以上、配信・動画投稿のないチャンネル」に再変更
  - empty state: 「60日以上活動のないチャンネルはありません」に変更
  - テスト更新: `excludes channels that have never livestreamed from silent list` を `includes channels with any old activity (upload or livestream) in silent list` にリネーム。UC_OLD_UPLOAD の期待を `not.toContain` → `toContain` に反転、UC_NO_DATA（動画レコードなし）が除外されることも確認
  - 推し見落とし / 配信頻度ランキング は引き続き配信のみ
- セルフ verify: ✅ lint / ✅ test（34 files / 306 passed）/ ✅ build
- レビュー観点: セクションごとに活動時刻の定義が違う（沈黙=投稿全般 / 他=配信のみ）ため、コード上のコメントで意図を明確化

---

## 2026-05-20 23:46 ユーザー指示反映（沈黙チャンネルから配信実績ゼロを除外 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 沈黙チャンネルセクションが「配信したこと無いチャンネル」まで対象にして実用にならなかった問題の修正
- ユーザーフィードバック: 「動画投稿しているサイトは対象外にして。配信したこと無いチャンネルまで対象にするとメチャクチャになる」
- 対応:
  - `silentChannelsStmt` の HAVING を `last_activity_at IS NULL OR last_activity_at = 0 OR last_activity_at <= @threshold` から **`last_activity_at > 0 AND last_activity_at <= @threshold`** に変更
  - 結果: 「過去に1回でも配信実績があるチャンネル」のうち「最新配信が60日以上前」のみを対象にする
  - ORDER BY からも `last_activity_at IS NULL DESC` 条件を削除（NULL ケースが HAVING で除外されるため不要）
  - UI note 文言: 「過去に配信したが直近60日以上配信していないチャンネル」に変更してニュアンスを明確化
  - テスト更新: `excludes regular video uploads` の UC_UPLOAD 期待を `toContain` → `not.toContain` に反転。さらに `excludes channels that have never livestreamed from silent list` テストを追加（200日前の動画投稿のみ vs 200日前の配信実績で挙動差を確認）
- セルフ verify: ✅ lint / ✅ test（34 files / 306 passed、+1 件）/ ✅ build
- レビュー観点: 配信実績ゼロのチャンネルは「沈黙」ではなく「そもそも対象外」という意味づけが UI 文言と一致しているか

---

## 2026-05-20 23:25 ユーザー指示反映（配信のみフィルタ化 — Claude Code 作成）

- 作成者: Claude Code
- 主題: インサイトタブの 3 セクションを「配信（ライブ・プレミア）のみ」に絞る
- ユーザーフィードバック: 配信頻度ランキングに通常の動画投稿が含まれていた。「配信なら配信のみにしてほしい」、対象は3セクション全部
- 対応:
  - `statsRepository.js` の WHERE 句で `(v.actual_start_time IS NOT NULL OR v.scheduled_start_time IS NOT NULL)` を追加
  - 活動時刻の基準を `MAX(actual_start_time, published_at)` から `COALESCE(actual_start_time, scheduled_start_time, 0)` に変更（配信に限定したため published_at は不要）
  - StatsTab.jsx の note 文言を「配信のみ」に統一: 「直近30日の未視聴配信」「60日以上配信実績のないチャンネル」「直近90日の配信件数（ライブ・プレミアのみ）」
  - empty state も「60日以上配信していないチャンネルはありません」に変更
  - テスト更新: published_at 依存テストを削除、`scheduled_start_time` のみで未開始配信が活動扱いになるテストと、通常動画投稿が除外されるテストを追加
- セルフ verify: ✅ lint / ✅ test（34 files / 305 passed）/ ✅ build
- レビュー観点: 配信判定が actual/scheduled の有無依存なので、もし将来 RSS から取得した動画にも scheduled_start_time が誤って付与されるケースが出たら誤検知の可能性あり（現状の `videoStatus.js` ではないため問題なし）

---

## 2026-05-20 20:45 ユーザー指示反映（タブ名変更・サブナビ追加 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 実動確認後のユーザーフィードバック反映
- ユーザーフィードバック:
  - 当初の「視聴行動グラフ」イメージとは違うが、現実装はチャンネル整理機能として有用
  - 「統計」名は実態（推し見落とし/沈黙/頻度ランキング）と合わないため変更
  - 沈黙チャンネルにも YouTube リンクを追加してほしい
  - サブナビを追加して、どの項目があるか分かるようにしてほしい
- 対応:
  - タブ名: `📊 統計` → `💡 インサイト`（App.jsx）
  - StatsTab に **サブナビバー**（推し見落とし / 沈黙チャンネル / 配信頻度ランキング）を追加、各セクションは排他表示に変更。サブナビボタンには件数バッジ表示
  - 沈黙チャンネル行の title 部分を `yt-stats-row-link` ボタン化、クリックで `https://www.youtube.com/channel/{id}` を openExternal
  - main.css に `.yt-stats-subnav` `.yt-stats-row-link` 系スタイル追加
  - StatsTab.test.jsx をサブナビ切替テストに更新（3→ 3 件、内訳変更）
- セルフ verify: ✅ lint / ✅ test（34 files / 304 passed、+1 件）/ ✅ build
- 残課題: 「視聴行動グラフ」（推しチャンネル別視聴率、月別視聴本数推移）は別スプリント候補として inbox/strategies に温存予定

---

## 2026-05-20 19:10 クロスレビュー結果（統計タブ実装 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 作成の統計タブ実装（未コミット）
- セルフ verify 再実行: ✅ `npm run lint` / ✅ `npm run test`（34 files / 303 passed）/ ✅ `npm run build`
- IPC 三点一致: ✅
  - preload `getChannelActivityStats()` → ipc `stats:channelActivity` → repo `getChannelActivity()`
  - preload `openExternal`, `deleteChannel` も既存定義あり
- 完成条件 8項目: ✅ 全て満たす
- レビュー所見:
  - 🟢 設定モーダル「📌 チャンネル」タブとの役割重複なし。設定は能動的管理、統計は結果ベース整理判断で補完関係
  - 🟢 集計 SQL は `deleted_at IS NULL` で論理削除チャンネルを除外しており適切
  - 🟢 `MAX(actual_start, published_at)` の組み合わせ判定で RSS/API/ライブ差分を吸収
  - 🟢 ダークモード対応・loading/error/empty 3状態網羅
  - 🟢 既存 IPC（`channels:setPinned`/`channels:delete`）再利用、新規 IPC は集計用1件に限定
  - 🟡 軽微1: 削除・推し解除に確認ダイアログなし。`handleStatsDeleteChannel` は元に戻せないが、再追加で復活可能なので merge ブロッカーではない。今後の懸念事項として記録
  - 🟡 軽微2: `unwatchedPinned` の SQL は `MAX(actual_start, published_at) >= 30日前` で、status=`upcoming`/`live` の動画も含まれる。完成条件 ① の文面（「直近30日に公開した動画」）より広いが、「推し見落としチェック」の趣旨としては upcoming/live も拾うのが妥当。仕様意図と一致と判断
  - 🟡 軽微3: SQL の `MAX(COALESCE(...), COALESCE(...))` 形式は actual_start_time / published_at の個別 index を活かせず scan になる。現状の DB サイズなら問題なし。将来 1万件超で遅延が出たら計算列 + index 追加で対応
- 🔴 重大指摘: **なし**
- 設計判断の良い点:
  - 「推し見落とし」を ScheduleCard で表示することで既存のお気に入り/お知らせ操作と一貫
  - 「沈黙チャンネル」を pinned/manual/other で分類し、整理対象を絞り込みやすい
  - 「配信頻度ランキング」のクリックで YouTube チャンネルページへ遷移、整理判断の確認動線として機能
- merge 判断: ユーザー指示待ち（4条件のうち ①②③ クリア、④ ユーザー判断）

---

## 2026-05-20 18:59 完了（統計タブ実装 — Codex 作成）

- 対象: `develop` / `H:/ClaudeCode/Youtube/youtube-schedule`
- 作成者: Codex
- 主題: チャンネル整理支援ダッシュボード「📊 統計」タブの限定実装
- 触ったファイル:
  - `src/main/repositories/statsRepository.js`（新規）— `stats:channelActivity` 用の集計 SQL
  - `src/main/ipc/statsHandlers.js`（新規）— `stats:channelActivity` IPC handler
  - `src/main/index.js` — stats repository / handler 登録
  - `src/preload/index.js` — `getChannelActivityStats()` 公開
  - `src/renderer/hooks/useStats.js`（新規）— 統計データ取得 hook
  - `src/renderer/components/StatsTab.jsx`（新規）— 統計タブ UI
  - `src/renderer/src/App.jsx` — 「📊 統計」タブ追加、StatsTab 接続
  - `src/renderer/src/assets/main.css` — 統計タブ用スタイル
  - `tests/main/repositories/statsRepository.test.js`（新規）— 境界値・分類テスト
  - `tests/renderer/StatsTab.test.jsx`（新規）— 空状態 / データあり smoke test
  - `CLAUDE_CODE_HANDOFF.md` — 本完了セクション追記
- 実装で判断した点:
  - 手動追加チャンネル判定は `channels.source` ではなく migration 011 の `channels.is_manual` を使用。`channels.source` カラムは存在しない。
  - 活動日時は `MAX(COALESCE(actual_start_time, 0), COALESCE(published_at, 0))` を各動画の基準にして、ライブ実績と RSS/API の投稿日差分を吸収。
  - 推し見落としは直近30日を `>= now - 30d`、沈黙は60日以上を `<= now - 60d`、頻度ランキングは直近90日を `>= now - 90d` として境界値を含める。
  - 配信頻度ランキングは handoff 指示通り DB 上の件数を母数とし、その旨を UI の note / tooltip に表示。
  - 削除済みチャンネル（`channels.deleted_at IS NOT NULL`）は統計対象から除外。
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（34 files / 303 passed）
  - ✅ `npm run build`
- 実動確認: N/A（handoff 指示どおり Codex はセルフ verify のみ。Electron 実動確認は Claude Code 側予定）
- レビュー観点:
  - `statsRepository` の集計 SQL が想定データ量で十分か、特に `MAX(COALESCE(actual_start_time, 0), COALESCE(published_at, 0))` 式の index 利用と FULL SCAN 許容範囲。
  - 統計タブの「推し解除」「手動追加削除」が設定モーダルのチャンネル管理と役割重複しすぎていないか。
  - 誤操作防止として削除/推し解除に確認ダイアログを足すべきか。
  - ダークモードのコントラストと 1280px 幅でのタブ列収まり。
- 未解決:
  - `CLAUDE_CODE_HANDOFF.md` には作業開始前から、過去セクションを `docs/handoffs/archive/` へ退避する未コミット差分と `docs/handoffs/` untracked が存在。今回の完了追記では巻き戻していない。
- 次アクション:
  - Claude Code: `/cross-review` で統計タブ実装をレビューし、必要なら実動確認（`npm run dev`）で UI 操作を確認。

---

## アーカイブ

過去セクションはセクション過多を避けるため、以下へ退避済み。

- `docs/handoffs/archive/CLAUDE_CODE_HANDOFF-2026-05-20-pre-cleanup.md` — 2026-05-15 Phase 0 から 2026-05-20 18:42 までの全履歴を含む cleanup 前スナップショット

運用方針:

- このルートファイルには現在進行中の依頼・レビュー・未解決ゲートだけを残す。
- 完了済みセクションは cleanup 時に `docs/handoffs/archive/` へ退避する。
- 古い履歴を参照する必要がある場合は、上記アーカイブを検索する。

---

## 2026-05-20 19:00 依頼（チャンネル整理支援ダッシュボード「📊 統計」タブの実装 — Claude Code → Codex）

- 作成者: Claude Code（設計）／実装担当: Codex
- ブランチ: `develop`（または `feature/stats-tab` を切ってもよい）
- worktree: `H:/ClaudeCode/Youtube/youtube-schedule`

### 目的

ユーザーが推しチャンネル・手動追加チャンネル・お気に入りを「結果を見ながら整理する」ための専用タブを追加する。設定モーダルの「📌 チャンネル」タブ（能動的に追加・推す場）と役割を分け、本タブは「活動量を見て整理判断する場」とする。

### 背景

- 既存タブ構成（App.jsx）: `schedule` / `missed` / `archive` / `favorites` / `new-videos`（簡易モード時）
- 推しチャンネル（`channels.is_pinned=1`）、お気に入り動画（`videos.is_favorite=1`）、手動追加チャンネル（`channels.source='manual'` 想定 — 既存スキーマを確認）、`viewed_at` / `notify` / `published_at` / `ended_at` の集計から、ユーザーの整理判断に役立つ指標を出す
- 既存の `videos_fts` / cleanup ポリシー（30日/90日/お気に入り永久）には触らない

### 完成条件

1. ヘッダーのタブ列に **「📊 統計」タブ** が追加され、クリックで表示が切り替わる
2. タブ内に **3セクション** が縦に並ぶ:
   - **① 推し見落としチェック**: `is_pinned=1` のチャンネルが直近30日に公開した動画のうち `viewed_at IS NULL` のものを ScheduleCard ベースで一覧表示。空なら「見逃しなし ✨」の empty state
   - **② 沈黙チャンネル**: 各チャンネルの最終 `published_at`（または最終 `actual_start`）から **60日以上経過** したチャンネルを「📌 推し / 🖐 手動追加 / その他」に分類。各分類ごとに件数バッジ + チャンネル名・最終配信日・アクションボタン（推し解除 / 手動追加削除）の行リスト
   - **③ 配信頻度ランキング**: 全チャンネルの直近90日の公開動画数（または `live`/`upcoming`/`ended` 全て含む配信数）を多い順に最大20件表示。推しバッジ付き、行クリックで YouTube チャンネルページを開く
3. アクションボタンは既存 IPC（`channels:setPinned` 等）を再利用。新規 IPC は **集計用1件** に限定する: `stats:channelActivity()` → `{ unwatchedPinned, silentChannels, frequencyRanking }`
4. データ取得は `useStats.js` hook 経由。タブ切替時にロード、`schedule:updated` で再取得
5. 既存4タブ（schedule / missed / archive / favorites）の動作・スタイルを変更しない
6. ダークモード対応
7. Vitest テストを以下に追加:
   - 集計クエリの境界値テスト（29日 / 30日 / 31日、59日 / 60日 / 61日、89日 / 90日 / 91日）
   - 推し / 手動追加 / その他の分類テスト
   - StatsTab レンダリング smoke test（空状態 / データあり）
8. `npm run lint` / `npm run test` / `npm run build` 全パス

### 対象ファイル

**新規作成**

- `src/main/repositories/statsRepo.js`（または `src/main/services/statsService.js`） — 集計 SQL を集約
- `src/main/ipc/statsHandlers.js`（または `videoHandlers.js` に同居） — `stats:channelActivity` IPC
- `src/renderer/src/hooks/useStats.js`
- `src/renderer/src/components/StatsTab.jsx`
- `tests/main/statsRepo.test.js`
- `tests/renderer/StatsTab.test.jsx`

**変更**

- `src/main/index.js`（IPC 登録）
- `src/preload/index.js`（API 公開）
- `src/renderer/src/App.jsx`（タブ追加）
- `src/renderer/src/components/ScheduleCard.jsx`（再利用可能なら触らない、props 追加が必要なら最小限）

### 触ってよい範囲

- 上記「対象ファイル」のリスト
- `App.jsx` のタブ切替ロジック（既存タブの定義は変更しない、追加のみ）
- 既存スタイルの再利用（CSS Modules / Tailwind / styled — 既存方針に合わせる）

### 触ってはいけない範囲

- 既存 DB migration（`migrations/001..004`）の改変
- 既存 IPC handler の signature 変更
- `videos_fts` トリガー / cleanup ポリシー
- 既存タブのレイアウト / 並び
- `release.yml` / `ci.yml`
- 別 feature/branch の未マージ変更
- 未 push のローカルコミット `64fc89f`（SignPath メモ） / `2c1c4d1`（クォータリセット修正）を巻き戻さない

### verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認（Claude Code 側で実施予定 — Codex はセルフ verify のみで OK）:

```powershell
npm run dev
```

### 既知リスク

- **チャンネルの「手動追加」フラグ**: スキーマに `channels.source` カラムがあるか未確認。なければ `subscriptions.list` 由来かどうかを別経路で判定する必要あり。実装着手時に `src/main/db/migrations/` と `channelsRepo.js` を読んで確認すること
- **`videos.published_at` vs `actual_start`**: 沈黙判定の基準時刻はどちらを使うか要判断。RSS 由来の動画は `published_at`、ライブは `actual_start` がより新しい。両方の MAX を取るのが正解
- **配信頻度の母数**: 削除済み / メン限化された動画を `videos` テーブルから消していないため、過去90日の DB 件数 = 実配信数 とは限らない。今回は「DB 上の件数」を母数とし、その旨をツールチップで補足する
- **タブ列の幅**: タブが多くなりつつあるためモバイル想定はないが、横幅 1280px で全タブが収まることを確認
- **テストの DB**: `better-sqlite3` の in-memory DB を使う既存パターンに合わせる（`tests/main/` の他テスト参照）

### レビュー観点（Claude Code が cross-review でチェックする）

- 設定モーダル「📌 チャンネル」タブとの役割重複がないか
- アクションボタンの誤操作防止（推し解除の確認ダイアログ要否）
- 集計クエリの N+1 / 不要な FULL SCAN がないか
- ダークモードでコントラスト破綻していないか
- 空状態 / loading / error の3状態が網羅されているか
- IPC 契約の preload / main / renderer 三点一致

### 次アクション

1. Codex: スキーマ確認 → 実装 → セルフ verify → ハンドオフに完了セクション追記（実装ファイル一覧・自己検証結果）
2. Claude Code: `/cross-review` で review → 🔴 解消後にユーザー判断で develop へ統合
3. ユーザー: 動作確認 → v1.18.0 リリースに含める判断

---

---
