# YouTom 共同開発ハンドオフ

最終更新: 2026-05-20
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、汎用ハーネスは `.claude/rules/cross-agent-harness.md`、YouTom 固有 profile は `.claude/rules/project-collaboration-profile.md` を参照。

既存の `.claude/rules/cross-agent-review.md` は旧運用メモとして残し、相互依頼・レビュー・merge 判断はこのファイルと profile に集約する。

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
