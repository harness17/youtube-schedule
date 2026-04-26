# YouTube Schedule — アプリケーション仕様書

バージョン: **1.9.1**  
最終更新: 2026-04-26

---

## 目次

1. [概要](#1-概要)
2. [技術スタック](#2-技術スタック)
3. [アーキテクチャ](#3-アーキテクチャ)
4. [画面・UI 構成](#4-画面ui-構成)
5. [機能仕様](#5-機能仕様)
6. [IPC インターフェース](#6-ipc-インターフェース)
7. [データベース設計](#7-データベース設計)
8. [データ取得戦略](#8-データ取得戦略)
9. [保持ポリシー・クリーンアップ](#9-保持ポリシークリーンアップ)
10. [セキュリティ](#10-セキュリティ)
11. [自動アップデート](#11-自動アップデート)
12. [ビルド・リリース](#12-ビルドリリース)

---

## 1. 概要

YouTube 登録チャンネルの **配信予定・ライブ中動画** を一覧表示する Windows/Mac/Linux 対応デスクトップアプリ。

| 項目             | 内容                                           |
| ---------------- | ---------------------------------------------- |
| プラットフォーム | Electron 39.2.6（Windows / macOS / Linux）     |
| 言語             | JavaScript (ES Modules) + React 19             |
| データソース     | YouTube Data API v3（OAuth 2.0）+ RSS フィード |
| ローカル DB      | SQLite（better-sqlite3 12.9.0）                |
| リポジトリ       | https://github.com/harness17/youtube-schedule  |

### 主な機能

- Google アカウントでログインし、登録チャンネルの配信予定・ライブを自動収集
- RSS（0 クォータ）を優先取得し、失敗時は YouTube API にフォールバック
- 推しチャンネル設定・お知らせ（🔔）・お気に入り（⭐）・アーカイブ・見逃し管理
- 30 分ごとの自動リフレッシュ＋手動更新
- ダークモード対応・自動アップデート

---

## 2. 技術スタック

### フロントエンド

| パッケージ           | バージョン | 役割              |
| -------------------- | ---------- | ----------------- |
| React                | 19.2.1     | UI フレームワーク |
| Vite                 | 7.2.6      | ビルドツール      |
| @vitejs/plugin-react | 5.2.0      | JSX 変換          |
| ESLint               | 9.39.1     | 静的解析          |
| Prettier             | 3.7.4      | コード整形        |

### メインプロセス

| パッケージ               | バージョン | 役割                       |
| ------------------------ | ---------- | -------------------------- |
| Electron                 | 39.2.6     | デスクトップフレームワーク |
| electron-vite            | 5.0.0      | Electron 用 Vite           |
| electron-builder         | 26.0.12    | パッケージング             |
| electron-updater         | 6.8.3      | 自動アップデート           |
| better-sqlite3           | 12.9.0     | SQLite ドライバ（同期）    |
| electron-store           | 8.2.0      | 設定永続化（JSON）         |
| googleapis               | 171.4.0    | YouTube Data API v3        |
| @google-cloud/local-auth | 3.0.1      | OAuth 認証フロー           |
| fast-xml-parser          | 4.5.6      | RSS XML パース             |
| dotenv                   | 17.4.1     | 環境変数読み込み           |
| @electron/rebuild        | 4.0.3      | ネイティブ依存リビルド     |

### テスト

| パッケージ                | バージョン | 役割             |
| ------------------------- | ---------- | ---------------- |
| Vitest                    | 4.1.4      | ユニットテスト   |
| @vitest/coverage-v8       | 4.1.4      | カバレッジ       |
| @testing-library/react    | 16.3.2     | React テスト     |
| @testing-library/jest-dom | 6.9.1      | DOM アサーション |
| jsdom                     | 29.0.2     | DOM 実装         |
| nock                      | 13.5.6     | HTTP モック      |

---

## 3. アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  Renderer プロセス（ブラウザ環境）                 │
│  src/renderer/                                  │
│  ├─ src/App.jsx          メインUI・タブ管理      │
│  ├─ hooks/                                      │
│  │  ├─ useSchedule.js    スケジュール取得        │
│  │  ├─ useAuth.js        認証状態管理            │
│  │  ├─ useDarkMode.js    ダークモード永続化      │
│  │  ├─ useNotificationCheck.js  通知チェック     │
│  │  └─ useTabState.js    タブ状態・無限スクロール│
│  └─ components/                                 │
│     ├─ ScheduleList.jsx   予定・ライブ一覧       │
│     ├─ ScheduleCard.jsx   カードコンポーネント   │
│     ├─ StatusBanners.jsx  状態バナー             │
│     ├─ AuthScreen.jsx     認証画面               │
│     ├─ SettingsModal.jsx  設定モーダル（3タブ）  │
│     ├─ ErrorBoundary.jsx  エラー境界             │
│     ├─ Toast.jsx          トースト通知           │
│     ├─ BackToTop.jsx      トップへ戻るボタン     │
│     ├─ CredentialsSetupScreen.jsx  認証情報案内  │
│     └─ UpdateBanner.jsx   自動更新バナー         │
├─────────────────────────────────────────────────┤
│  Preload スクリプト（contextBridge）              │
│  src/preload/index.js                           │
│  → window.api として Renderer に公開            │
├─────────────────────────────────────────────────┤
│  Main プロセス（Node.js 環境）                   │
│  src/main/                                      │
│  ├─ index.js         アプリ初期化・ポーリング    │
│  ├─ auth.js          OAuth 認証                 │
│  ├─ logger.js        構造化ログ                 │
│  ├─ store.js         electron-store             │
│  ├─ ipc/             IPC ハンドラー（責務別）   │
│  │  ├─ authHandlers.js      auth:*              │
│  │  ├─ videoHandlers.js     schedule:* videos:* channels:* diag:* │
│  │  ├─ settingsHandlers.js  settings:* favorites:* │
│  │  └─ appHandlers.js       app:* shell:* notification:* updater:* │
│  ├─ db/              SQLite 管理                │
│  │  ├─ connection.js DB 接続・WAL設定           │
│  │  ├─ migrate.js    マイグレーション           │
│  │  ├─ schema.js     テーブル定義               │
│  │  └─ migrations/   001〜005                  │
│  ├─ repositories/    DB アクセス層              │
│  │  ├─ videoRepository.js                      │
│  │  ├─ channelRepository.js                    │
│  │  ├─ metaRepository.js                       │
│  │  └─ rssFetchLogRepository.js                │
│  ├─ fetchers/        外部データ取得             │
│  │  ├─ rssFetcher.js                           │
│  │  ├─ playlistItemsFetcher.js                 │
│  │  ├─ videoDetailsFetcher.js                  │
│  │  └─ subscriptionsFetcher.js                 │
│  └─ services/                                   │
│     ├─ schedulerService.js  定期取得           │
│     ├─ settingsPorter.js    設定インポートエクスポート │
│     └─ videoStatus.js       状態判定           │
└─────────────────────────────────────────────────┘
         ↕ IPC（ipcMain / ipcRenderer）
```

### データフロー

```
YouTube Data API v3 ─┐
RSS フィード ─────────┤→ Fetchers → SchedulerService → SQLite DB
                      │                                    ↓
                      └──────────────────────── IPC → Renderer UI
```

### 主要設計原則

- **Renderer から Node.js API・外部 API を直接呼ばない**。必ず Main プロセス経由で IPC を使う
- **contextBridge** で `window.api` を安全に公開（`contextIsolation: true`, `nodeIntegration: false`）
- **RSS プライマリ取得**（クォータ 0）で API クォータを節約し、失敗時のみ API フォールバック

---

## 4. 画面・UI 構成

### 4.1 認証画面（AuthScreen）

`credentials.json` が存在しない場合、または未認証の場合に表示。

| 状態                    | 表示内容                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `CREDENTIALS_NOT_FOUND` | credentials.json の配置手順を案内。「フォルダを開く」ボタン |
| 未認証                  | 「Google でログイン」ボタン                                 |
| 認証エラー              | エラーメッセージ + 再ログインボタン                         |

### 4.2 メイン画面（App）

#### ヘッダー（行 1）

| 要素                      | 機能                                 |
| ------------------------- | ------------------------------------ |
| アプリタイトル            | 表示のみ                             |
| バージョン番号            | `app:version` IPC で取得             |
| 🔄 更新ボタン             | 手動リフレッシュ（デバウンス付き）   |
| 🚪 ログアウトボタン       | `auth:logout` IPC → 認証画面に戻る   |
| 🌙/☀ ダークモード切り替え | `settings:set darkMode` IPC で永続化 |

#### ヘッダー（行 2）

| 要素                         | 表示タブ      | 機能                                         |
| ---------------------------- | ------------- | -------------------------------------------- |
| 🔍 検索ボックス              | 全タブ        | タイトル・チャンネル名のリアルタイム絞り込み |
| チャンネル選択ドロップダウン | schedule のみ | チャンネル単位でフィルター                   |
| 📌 チャンネル管理ボタン      | schedule のみ | チャンネル管理モーダルを開く                 |

#### タブ構成

| タブキー    | 表示名       | 表示内容                                              | フィルタ条件                                        |
| ----------- | ------------ | ----------------------------------------------------- | --------------------------------------------------- |
| `schedule`  | 予定・ライブ | live セクション + upcoming セクション（日付グループ） | キーワード + チャンネル選択                         |
| `missed`    | 見逃し       | お知らせ登録済みで未視聴の終了配信                    | `status='ended' AND notify=1 AND viewed_at IS NULL` |
| `archive`   | アーカイブ   | 全終了配信（無限スクロール・全文検索）                | `status='ended'`                                    |
| `favorites` | お気に入り   | お気に入り登録済みの動画                              | `is_favorite=1`                                     |

### 4.3 ScheduleCard（動画カード）

各タブで共通して使用するカードコンポーネント。

#### 表示内容

| 項目                          | 条件                                 |
| ----------------------------- | ------------------------------------ |
| サムネイル                    | 常時                                 |
| チャンネル名                  | 常時。推し済みなら金色（#D4A017）    |
| 動画タイトル                  | 常時                                 |
| ステータスバッジ              | live / upcoming                      |
| 配信開始時刻 / カウントダウン | upcoming のみ                        |
| 同時視聴者数                  | live のみ                            |
| 推し済みゴールドボーダー      | `isPinned=true` 時、左枠 4px #FFD700 |
| 既読（薄表示）                | `viewedAt != null` 時、opacity 60%   |
| 「見た」バッジ                | `viewedAt != null` 時                |

#### ボタン

| ボタン         | 動作                                | 表示条件                                           |
| -------------- | ----------------------------------- | -------------------------------------------------- |
| YouTube で開く | `shell:openExternal` で外部ブラウザ | 常時                                               |
| 🔔 お知らせ    | `videos:toggleNotify` → 5分前通知   | 常時                                               |
| ⭐ お気に入り  | `videos:toggleFavorite`             | 常時                                               |
| ✓ 見た         | `videos:markViewed` / `clearViewed` | `showViewedButton=true` 時（アーカイブ系タブのみ） |
| 📌 推し設定    | `channels:togglePin`                | 常時                                               |

#### ScheduleCard props

| prop               | 型     | 説明                                  |
| ------------------ | ------ | ------------------------------------- |
| `item`             | object | 動画データ                            |
| `darkMode`         | bool   | ダークモード                          |
| `watched`          | bool   | `item.isNotify`。🔔 スタイル切り替え  |
| `onToggleWatch`    | func   | `(id) => void`                        |
| `isFavorite`       | bool   | ⭐ スタイル切り替え                   |
| `onToggleFavorite` | func   | `(id) => void`                        |
| `showViewedButton` | bool   | ✓ ボタンを表示するか                  |
| `onMarkViewed`     | func   | `(id, viewed: bool) => void`          |
| `isPinned`         | bool   | 推し済みフラグ                        |
| `onTogglePin`      | func   | `(channelId) => void`                 |
| `isViewed`         | bool   | `item.viewedAt != null`。既読スタイル |
| `showStatusBadge`  | bool   | upcoming/live バッジを表示するか      |

### 4.4 設定モーダル（SettingsModal）

ヘッダーの ⚙️ ボタンで開く。3タブ構成。

#### タブ構成

| タブキー    | ラベル         | 内容                                                                 |
| ----------- | -------------- | -------------------------------------------------------------------- |
| `general`   | ⚙️ 基本        | ダークモード切り替え・アップデート確認・自動アップデート・バージョン情報・ログアウト |
| `channels`  | 📌 チャンネル  | チャンネル一覧の検索・推し設定（SettingsModal に統合）              |
| `data`      | 📦 データ管理  | 設定エクスポート/インポート・お気に入りエクスポート/インポート・DBリセット |

#### チャンネルタブの動作フロー

1. **モーダルを開く**
   - `channels:listAll` IPC で DB から全チャンネル取得
   - `is_pinned DESC → title ASC` でソートしたスナップショットを `channels` に格納

2. **トグル**（`handleTogglePin(channelId)`）
   - `channels:togglePin` IPC 実行
   - `channels` の `isPinned` のみ更新（**リスト順は変わらない**）
   - モーダルを閉じて再度開いたときに最新状態でソートされる

3. **閉じて再度開く**
   - `useEffect([open])` が再実行され、最新状態で再ソート

#### チャンネルタブのカラースキーム

| 状態           | ライト                            | ダーク                            |
| -------------- | --------------------------------- | --------------------------------- |
| 推し済み行     | rgba(212,144,10,0.06) 背景        | rgba(255,201,64,0.08) 背景        |
| 「優先中」ボタン | #d4900a 色・太字                 | #ffc940 色・太字                  |
| 「優先」ボタン | グレー背景                        | グレー背景                        |

### 4.5 StatusBanners

| バナー                         | 表示条件                                   |
| ------------------------------ | ------------------------------------------ |
| DB 破損                        | `dbBroken=true`                            |
| オフライン                     | `navigator.onLine = false`                 |
| RSS 失敗率警告                 | `diag:rssFailureRate` が閾値超過           |
| クォータ超過                   | YouTube API 403 応答                       |
| アップデート（ダウンロード中） | `updater:update-available`                 |
| アップデート（完了）           | `updater:update-downloaded` + 再起動ボタン |

---

## 5. 機能仕様

### 5.1 スケジュール表示（schedule タブ）

- **live セクション**：`status='live'` の動画を推しチャンネル優先・開始時刻順でリスト表示
- **upcoming セクション**：`status='upcoming'` の動画を日付グループ（年月日ヘッダー付き）で表示
- **推しチャンネル優先ソート**：`pinnedChannelIds.has(channelId)` が true の動画を先頭に

### 5.2 お知らせ機能（🔔）

1. upcoming 動画の 🔔 をタップ → `notify = 1` に設定
2. 60 秒ごとのポーリングで通知タイミングを監視
3. 開始時刻の **5 分前〜開始時刻** の間にデスクトップ通知を発火（1 回のみ）
4. 配信終了後、`notify=1 AND viewed_at IS NULL` なら「見逃し」タブに表示
5. 保持期間：**90 日**（viewed_at を設定すると 30 日に短縮）

```javascript
const THRESHOLD = 5 * 60 * 1000 // 5分
const remaining = scheduledStartTime - Date.now()
if (remaining > 0 && remaining <= THRESHOLD) {
  window.api.showNotification('もうすぐ配信開始', `${channel}「${title}」が5分後に始まります`)
}
```

### 5.3 お気に入り機能（⭐）

- ⭐ タップ → `is_favorite` 反転
- **永久保持**（クリーンアップで削除されない）
- favorites タブに `is_favorite=1` の全動画を表示
- ソート：推しチャンネル優先 → 開始時刻降順

### 5.4 視聴済みマーク（✓）

- ✓ タップ → `viewed_at = CURRENT_TIMESTAMP` / NULL 切り替え
- 見逃しタブで「見た」を押すと即リストから消える
- 視聴済みカードは opacity 60% で薄表示 + 「見た」バッジ

### 5.5 アーカイブ（archive タブ）

- `status='ended'` の全動画を `ended_at DESC` 順で表示
- **無限スクロール**：Intersection Observer で下端到達時に 50 件追加取得
- **全文検索**：300ms デバウンスで LIKE 検索（日本語対応）
  - 検索対象トグル：タイトル / チャンネル名 / 説明文
  - 検索時は limit=200・ペアジネーション無効

### 5.6 見逃し（missed タブ）

- 条件：`status='ended' AND notify=1 AND viewed_at IS NULL AND 開始時刻 < now`
- ソート：推しチャンネル優先 → 開始時刻降順（最新のものが上）
- 「見た」ボタンで即リストから除外

### 5.7 推しチャンネル設定

- 📌 ボタンまたはチャンネル管理モーダルで設定
- 推し済みチャンネルの動画はすべてのタブで先頭表示
- ScheduleCard の左枠が金色（#FFD700）、チャンネル名が金色（#D4A017）

### 5.8 ダークモード

- トグルボタンで切り替え
- `settings:set darkMode` IPC で electron-store に永続化
- 次回起動時に `settings:get darkMode` で復元

### 5.9 手動更新

- 「更新」ボタン → デバウンス後に `schedule:refresh` IPC
- 更新完了後 `schedule:updated` イベントで Renderer に通知

---

## 6. IPC インターフェース

### 認証系

| チャネル      | 方向   | 入力 | 出力                                          | 説明                                |
| ------------- | ------ | ---- | --------------------------------------------- | ----------------------------------- |
| `auth:check`  | invoke | —    | `{isAuthenticated, error?, credentialsPath?}` | 認証状態確認                        |
| `auth:login`  | invoke | —    | `{isAuthenticated, error?}`                   | OAuth フロー開始                    |
| `auth:logout` | invoke | —    | `{isAuthenticated: false}`                    | token.json 削除・スケジューラー停止 |

### スケジュール系

| チャネル                 | 方向       | 入力                        | 出力                                            | 説明                     |
| ------------------------ | ---------- | --------------------------- | ----------------------------------------------- | ------------------------ |
| `schedule:get`           | invoke     | —                           | `{live: Video[], upcoming: Video[], dbBroken?}` | 現在の表示データ取得     |
| `schedule:refresh`       | invoke     | `{forceFullRecheck?: bool}` | —                                               | 手動リフレッシュ         |
| `schedule:resetDatabase` | invoke     | —                           | —                                               | DB 削除→再初期化         |
| `schedule:updated`       | on（受信） | —                           | —                                               | 自動リフレッシュ完了通知 |

### 動画系

| チャネル                | 方向   | 入力                                              | 出力           | 説明                                  |
| ----------------------- | ------ | ------------------------------------------------- | -------------- | ------------------------------------- |
| `videos:listMissed`     | invoke | —                                                 | `Video[]`      | 見逃し一覧取得                        |
| `videos:listArchive`    | invoke | `{limit?, offset?}`                               | `Video[]`      | アーカイブ一覧（デフォルト limit=50） |
| `videos:listFavorites`  | invoke | —                                                 | `Video[]`      | お気に入り一覧取得                    |
| `videos:searchByText`   | invoke | `query, {title?, channel?, description?, limit?}` | `Video[]`      | LIKE 検索                             |
| `videos:markViewed`     | invoke | `id`                                              | `bool`         | 視聴済みマーク                        |
| `videos:clearViewed`    | invoke | `id`                                              | `bool`         | 視聴済み解除                          |
| `videos:toggleFavorite` | invoke | `id`                                              | `bool \| null` | お気に入り反転                        |
| `videos:toggleNotify`   | invoke | `id`                                              | `bool \| null` | お知らせ反転                          |

### チャンネル系

| チャネル             | 方向   | 入力 | 出力           | 説明                                         |
| -------------------- | ------ | ---- | -------------- | -------------------------------------------- |
| `channels:togglePin` | invoke | `id` | `bool \| null` | 推し設定反転                                 |
| `channels:listAll`   | invoke | —    | `Channel[]`    | 全チャンネル取得（`is_pinned DESC, id ASC`） |

### 設定・エクスポート系

| チャネル            | 方向   | 入力 | 出力                                                      | 説明                                     |
| ------------------- | ------ | ---- | --------------------------------------------------------- | ---------------------------------------- |
| `settings:get`      | invoke | `key, defaultValue` | any                                    | electron-store から取得                  |
| `settings:set`      | invoke | `key, value`        | —                                      | electron-store に保存                    |
| `settings:export`   | invoke | —    | `{success?, canceled?, error?}`                           | 設定 JSON を保存ダイアログでエクスポート |
| `settings:import`   | invoke | —    | `{success?, canceled?, error?, darkMode?, pinnedChannels?}` | 設定 JSON を開くダイアログでインポート   |
| `favorites:export`  | invoke | —    | `{success?, canceled?, error?, count?}`                   | お気に入り JSON をエクスポート           |
| `favorites:import`  | invoke | —    | `{success?, canceled?, error?, applied?, skipped?}`       | お気に入り JSON をインポート             |

### システム系

| チャネル                 | 方向   | 入力                | 出力                 | 説明                               |
| ------------------------ | ------ | ------------------- | -------------------- | ---------------------------------- |
| `diag:rssFailureRate`    | invoke | —                   | `number`             | 過去 24h の RSS 失敗率（0〜1）     |
| `notification:show`      | invoke | `{title, body}`     | —                    | デスクトップ通知                   |
| `app:version`            | invoke | —                   | `string`             | アプリバージョン                   |
| `shell:openFolder`       | invoke | `filePath`          | `{success}`          | 親フォルダをエクスプローラーで開く |
| `shell:openExternal`     | invoke | `url`               | `{success?, error?}` | http/https のみ外部ブラウザで開く  |
| `updater:quitAndInstall` | invoke | —                   | —                    | アップデートを適用して再起動       |
| `updater:checkNow`       | invoke | —                   | —                    | 手動でアップデートを確認           |

### アップデーター系（受信イベント）

| チャネル                    | 説明                                 |
| --------------------------- | ------------------------------------ |
| `updater:update-available`  | 新バージョン検出（ダウンロード開始） |
| `updater:update-downloaded` | ダウンロード完了（インストール可能） |
| `updater:error`             | アップデートエラー                   |

### スケジューラー系（受信イベント）

| チャネル           | 説明                                 |
| ------------------ | ------------------------------------ |
| `schedule:updated` | 自動リフレッシュ完了通知             |
| `schedule:error`   | リフレッシュ失敗通知（`{message}`）  |

---

## 7. データベース設計

DB ファイルパス：`{userData}/schedule.db`  
PRAGMA 設定：`journal_mode = WAL`、`foreign_keys = ON`

### 7.1 テーブル一覧

| テーブル         | 説明                                       |
| ---------------- | ------------------------------------------ |
| `videos`         | 動画データ（メインテーブル）               |
| `channels`       | チャンネルデータ                           |
| `rss_fetch_log`  | RSS 取得ログ                               |
| `meta`           | システムメタデータ（KV ストア）            |
| `videos_fts`     | FTS5 全文検索仮想テーブル（migration 003） |
| `schema_version` | マイグレーション管理                       |

### 7.2 videos テーブル

| カラム                 | 型      | 制約               | 説明                                        |
| ---------------------- | ------- | ------------------ | ------------------------------------------- |
| `id`                   | TEXT    | PRIMARY KEY        | YouTube 動画 ID                             |
| `channel_id`           | TEXT    | NOT NULL           | チャンネル ID                               |
| `channel_title`        | TEXT    | NOT NULL           | チャンネルタイトル                          |
| `title`                | TEXT    | NOT NULL           | 動画タイトル                                |
| `description`          | TEXT    | DEFAULT ''         | 動画説明                                    |
| `thumbnail`            | TEXT    | —                  | サムネイル URL                              |
| `status`               | TEXT    | NOT NULL           | `'live'` / `'upcoming'` / `'ended'`         |
| `scheduled_start_time` | INTEGER | —                  | 予定開始時刻（Unix ms）                     |
| `actual_start_time`    | INTEGER | —                  | 実際の開始時刻（Unix ms）                   |
| `concurrent_viewers`   | INTEGER | —                  | ライブ同時視聴者数                          |
| `url`                  | TEXT    | NOT NULL           | `https://youtube.com/watch?v={id}`          |
| `first_seen_at`        | INTEGER | NOT NULL           | 初検出時刻（Unix ms）                       |
| `last_checked_at`      | INTEGER | NOT NULL           | 最終確認時刻（Unix ms）                     |
| `viewed_at`            | INTEGER | DEFAULT NULL       | 視聴済みマーク時刻（Unix ms）※migration 003 |
| `is_favorite`          | INTEGER | NOT NULL DEFAULT 0 | お気に入りフラグ（0/1）※migration 003       |
| `ended_at`             | INTEGER | DEFAULT NULL       | ended 化時刻（初回のみ）※migration 003      |
| `notify`               | INTEGER | NOT NULL DEFAULT 0 | お知らせフラグ（0/1）※migration 004         |

**インデックス：**

| インデックス名            | 対象カラム                       | migration |
| ------------------------- | -------------------------------- | --------- |
| `idx_videos_status_sched` | `(status, scheduled_start_time)` | 001       |
| `idx_videos_channel`      | `(channel_id)`                   | 001       |
| `idx_videos_actual_start` | `(actual_start_time)`            | 001       |
| `idx_videos_favorite`     | `(is_favorite)`                  | 003       |
| `idx_videos_viewed`       | `(viewed_at)`                    | 003       |
| `idx_videos_ended_at`     | `(ended_at)`                     | 003       |
| `idx_videos_notify`       | `(notify)`                       | 004       |

**FTS5 同期トリガー（migration 003）：**

| トリガー名  | タイミング   | 処理                         |
| ----------- | ------------ | ---------------------------- |
| `videos_ai` | AFTER INSERT | `videos_fts` に挿入          |
| `videos_ad` | AFTER DELETE | `videos_fts` から削除        |
| `videos_au` | AFTER UPDATE | `videos_fts` から削除→再挿入 |

### 7.3 channels テーブル

| カラム                      | 型      | 制約               | 説明                                                 |
| --------------------------- | ------- | ------------------ | ---------------------------------------------------- |
| `id`                        | TEXT    | PRIMARY KEY        | チャンネル ID                                        |
| `title`                     | TEXT    | —                  | チャンネルタイトル                                   |
| `uploads_playlist_id`       | TEXT    | —                  | アップロード再生リスト ID（nullable、migration 005） |
| `last_subscription_sync_at` | INTEGER | —                  | 購読リスト同期時刻（Unix ms）                        |
| `is_pinned`                 | INTEGER | NOT NULL DEFAULT 0 | 推しフラグ（0/1）※migration 003                      |

**インデックス：**

| インデックス名        | 対象カラム    |
| --------------------- | ------------- |
| `idx_channels_pinned` | `(is_pinned)` |

### 7.4 rss_fetch_log テーブル

| カラム          | 型      | 制約                      | 説明                                                                    |
| --------------- | ------- | ------------------------- | ----------------------------------------------------------------------- |
| `id`            | INTEGER | PRIMARY KEY AUTOINCREMENT | ログ ID                                                                 |
| `channel_id`    | TEXT    | NOT NULL                  | チャンネル ID                                                           |
| `fetched_at`    | INTEGER | NOT NULL                  | 取得試行時刻（Unix ms）                                                 |
| `success`       | INTEGER | NOT NULL                  | 0 = 失敗 / 1 = 成功                                                     |
| `http_status`   | INTEGER | —                         | HTTP ステータスコード                                                   |
| `error_message` | TEXT    | —                         | エラー理由（`timeout` / `network` / `parse` / `http_404` / `http_XXX`） |

**インデックス：**`idx_rss_log_time` on `(fetched_at)`

### 7.5 meta テーブル

| カラム       | 型      | 制約        | 説明                                                  |
| ------------ | ------- | ----------- | ----------------------------------------------------- |
| `key`        | TEXT    | PRIMARY KEY | キー（例: `last_cleanup_at`、`last_full_refresh_at`） |
| `value`      | TEXT    | NOT NULL    | 値（文字列）                                          |
| `updated_at` | INTEGER | NOT NULL    | 更新時刻（Unix ms）                                   |

### 7.6 videos_fts 仮想テーブル（FTS5）

| カラム        | 説明                           |
| ------------- | ------------------------------ |
| `rowid`       | `videos` の rowid にマッピング |
| `title`       | 全文検索対象                   |
| `description` | 全文検索対象                   |

トークナイザー：`unicode61`  
※アーカイブ検索は現在 LIKE 検索で実装（日本語部分一致対応のため）

### 7.7 マイグレーション履歴

| バージョン | ファイル                      | 内容                                                                                 |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| 001        | `001_initial.js`              | `videos` / `channels` / `rss_fetch_log` / `meta` テーブル作成                        |
| 002        | `002_import_from_store.js`    | 旧 `scheduleCache`（electron-store）から SQLite へのデータ移行                       |
| 003        | `003_archive_favorites.js`    | `viewed_at` / `is_favorite` / `ended_at` / `is_pinned` / `videos_fts` / トリガー追加 |
| 004        | `004_notify_flag.js`          | `notify` カラム・インデックス追加                                                    |
| 005        | `005_channel_accumulation.js` | `channels.uploads_playlist_id` を nullable 化・チャンネル自動蓄積対応                |

---

## 8. データ取得戦略

### 8.1 リフレッシュサイクル

| 項目                 | 値                                            |
| -------------------- | --------------------------------------------- |
| 自動リフレッシュ間隔 | 30 分（`REFRESH_INTERVAL_MS = 1,800,000 ms`） |
| 起動時動作           | 認証済みなら即時リフレッシュ                  |
| 手動リフレッシュ     | 「更新」ボタン → `schedule:refresh` IPC       |

### 8.2 フェーズ別処理（SchedulerService.refresh）

```
Phase 1: resolveChannels()
  → subscriptions.list で登録チャンネル取得（24h キャッシュ）
  → channels テーブルに UPSERT（syncSubscriptions）

Phase 2: collectVideoIds()
  → 各チャンネルに対して並列実行（最大 10 並列）
  → [プライマリ] RSS フィード取得（タイムアウト 3 秒）
  → [フォールバック] RSS 失敗時 → playlistItems.list（タイムアウト 10 秒）
  → rss_fetch_log に記録

Phase 3: doRefresh()
  → 新規 ID + リチェック対象（live/upcoming で未チェック）の video details 取得
  → videos.list（50件バッチ、タイムアウト 15 秒）
  → deriveStatus() で status 判定
  → videos テーブルに UPSERT
  → チャンネル情報を channels テーブルに自動蓄積（upsertSeen）

Phase 4: orphanCheck()
  → RSS から消えた live/upcoming を videos.list で再確認
  → API からも消えていれば markEnded() で強制終了

Phase 5: maybeCleanup()（24h ごと）
  → deleteExpiredEnded() で期限切れ ended を削除
```

### 8.3 RSS フェッチャー

| 項目         | 値                                                         |
| ------------ | ---------------------------------------------------------- |
| URL          | `https://www.youtube.com/feeds/videos.xml?channel_id={id}` |
| User-Agent   | `Mozilla/5.0 (compatible; YouTubeScheduleViewer)`          |
| タイムアウト | 3,000 ms                                                   |
| パーサー     | fast-xml-parser                                            |
| 取得件数     | 最新 15 件                                                 |
| クォータ消費 | **0 ユニット**                                             |

**失敗理由（error_message 値）：**

| 値         | 原因                   |
| ---------- | ---------------------- |
| `timeout`  | AbortError（3 秒超過） |
| `network`  | ネットワーク接続エラー |
| `http_404` | HTTP 404               |
| `http_XXX` | その他 HTTP エラー     |
| `parse`    | XML パース失敗         |

### 8.4 PlaylistItems フェッチャー（フォールバック）

| 項目         | 値                           |
| ------------ | ---------------------------- |
| API メソッド | `youtube.playlistItems.list` |
| part         | `['contentDetails']`         |
| maxResults   | 15                           |
| タイムアウト | 10,000 ms                    |
| クォータ消費 | 1 ユニット / チャンネル      |

### 8.5 Subscriptions フェッチャー

| 項目           | 値                                            |
| -------------- | --------------------------------------------- |
| API メソッド   | `youtube.subscriptions.list`                  |
| part           | `['snippet']`                                 |
| mine           | `true`                                        |
| maxResults     | 50（ページネーションで全件取得）              |
| キャッシュ TTL | 24 時間（`last_subscription_sync_at` で判定） |
| クォータ消費   | 1 ユニット                                    |

### 8.6 Video Details フェッチャー

| 項目         | 値                                    |
| ------------ | ------------------------------------- |
| API メソッド | `youtube.videos.list`                 |
| part         | `['snippet', 'liveStreamingDetails']` |
| バッチサイズ | 50 件                                 |
| タイムアウト | 15,000 ms                             |
| クォータ消費 | 1 ユニット / 50 動画                  |

### 8.7 ステータス判定ロジック（deriveStatus）

```
actualEndTime あり                        → 'ended'
actualStartTime あり かつ 経過 < 24h     → 'live'
actualStartTime あり かつ 経過 ≥ 24h     → 'ended'
liveBroadcastContent = 'upcoming'
  かつ scheduledStartTime > now - 2h      → 'upcoming'
上記以外                                  → 'ended'
```

定数：

- `UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000`（2 時間）
- `LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000`（24 時間）

---

## 9. 保持ポリシー・クリーンアップ

### 保持ルール

| 条件                               | 保持期間                                              |
| ---------------------------------- | ----------------------------------------------------- |
| `is_favorite = 1`                  | **永久保持**                                          |
| `notify = 1 AND viewed_at IS NULL` | **90 日**（`NOTIFY_RETENTION_MS = 7,776,000,000 ms`） |
| 上記以外（通常の ended）           | **30 日**（`ENDED_RETENTION_MS = 2,592,000,000 ms`）  |

> 「見た」ボタンで `viewed_at` をセットすると、`notify=1` でも 30 日扱いに戻る。

### クリーンアップ SQL

```sql
DELETE FROM videos
WHERE status = 'ended'
  AND is_favorite = 0
  AND (
    (notify = 1 AND viewed_at IS NULL AND ended_at < :now - :NOTIFY_RETENTION_MS)
    OR
    ((notify = 0 OR viewed_at IS NOT NULL) AND ended_at < :now - :ENDED_RETENTION_MS)
  )
```

**実行タイミング：** `refresh()` 末尾で 24 時間ごと（`meta.last_cleanup_at` で判定）

---

## 10. セキュリティ

### Electron セキュリティ設定

| 設定               | 値      |
| ------------------ | ------- |
| `contextIsolation` | `true`  |
| `nodeIntegration`  | `false` |
| `sandbox`          | `true`  |
| `webSecurity`      | `true`  |

### 認証ファイル管理

| ファイル           | 保存先                        | 内容                                       | .gitignore |
| ------------------ | ----------------------------- | ------------------------------------------ | ---------- |
| `credentials.json` | `{userData}/credentials.json` | OAuth クライアント ID/シークレット         | ✅         |
| `token.json`       | `{userData}/token.json`       | refresh_token のみ保存                     | ✅         |
| `.env`             | プロジェクトルート            | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✅         |

### 外部 URL オープン制限

`shell:openExternal` は `http://` または `https://` スキームのみ許可。

---

## 11. 自動アップデート

GitHub Releases からバイナリを自動取得（electron-updater）。

| フェーズ         | イベント                    | UI 表示                               |
| ---------------- | --------------------------- | ------------------------------------- |
| アップデート検出 | `updater:update-available`  | 「ダウンロード中...」バナー           |
| ダウンロード完了 | `updater:update-downloaded` | 「再起動して更新を適用」ボタン        |
| ボタン押下       | —                           | `updater:quitAndInstall` IPC → 再起動 |

---

## 12. ビルド・リリース

### 開発コマンド

```bash
npm run dev          # 開発サーバー起動（electron-vite + electron-rebuild）
npm run build        # Vite ビルド
npm run build:win    # Windows インストーラー生成（electron-builder）
npm run format       # Prettier 整形
npm run lint         # ESLint チェック
npm run test         # Vitest 単体テスト
npm run test:watch   # Vitest 監視モード
```

### ブランチ戦略

```
feature/xxx  →  develop  →  master（リリース時のみ）
```

- 日常開発は `develop` または `feature/xxx` ブランチ
- `master` への直接コミット禁止
- リリース時：`develop → master` マージ → `vX.X.X` タグ push → GitHub Actions が自動ビルド・公開

### バージョニング

| 種別  | 例            | 適用条件              |
| ----- | ------------- | --------------------- |
| patch | 1.7.0 → 1.7.1 | バグ修正・UI 改善のみ |
| minor | 1.7.0 → 1.8.0 | 後方互換の新機能追加  |
| major | 1.7.0 → 2.0.0 | 破壊的変更            |

### CI/CD

- **CI ワークフロー**（`.github/workflows/ci.yml`）：push/PR 時に lint + test を実行（Node.js 24）
- **Release ワークフロー**（`.github/workflows/release.yml`）：`v*` タグ push 時に Windows インストーラーをビルドして GitHub Releases に draft 公開（Node.js 24）

### ネイティブ依存リビルド

`better-sqlite3` は Electron の Node.js バージョンに合わせてリビルドが必要。

```bash
# predev / pretest スクリプトで自動実行される
node scripts/rebuild-native.js
```

> ⚠️ `npx electron` や `electron .` で直接起動すると ABI ミスマッチが発生する。**必ず `npm run dev` を使うこと。**

---

## 付録：ディレクトリ構成

```
youtube-schedule/
├─ src/
│  ├─ main/
│  │  ├─ index.js                  アプリ初期化・DB初期化・ポーリング
│  │  ├─ auth.js                   OAuth 認証フロー
│  │  ├─ logger.js                 構造化ログ（JSON Lines、7日保持）
│  │  ├─ store.js                  electron-store 設定管理
│  │  ├─ ipc/                      IPC ハンドラー（責務別に分割）
│  │  │  ├─ authHandlers.js        auth:check / auth:login / auth:logout
│  │  │  ├─ videoHandlers.js       schedule:* / videos:* / channels:* / diag:*
│  │  │  ├─ settingsHandlers.js    settings:* / favorites:*
│  │  │  └─ appHandlers.js         app:* / shell:* / notification:* / updater:*
│  │  ├─ db/
│  │  │  ├─ connection.js          DB 接続・WAL・外部キー設定
│  │  │  ├─ migrate.js             マイグレーション実行
│  │  │  ├─ schema.js              テーブル DDL
│  │  │  └─ migrations/
│  │  │     ├─ 001_initial.js
│  │  │     ├─ 002_import_from_store.js
│  │  │     ├─ 003_archive_favorites.js
│  │  │     ├─ 004_notify_flag.js
│  │  │     └─ 005_channel_accumulation.js
│  │  ├─ repositories/
│  │  │  ├─ videoRepository.js
│  │  │  ├─ channelRepository.js
│  │  │  ├─ metaRepository.js
│  │  │  └─ rssFetchLogRepository.js
│  │  ├─ fetchers/
│  │  │  ├─ rssFetcher.js
│  │  │  ├─ playlistItemsFetcher.js
│  │  │  ├─ videoDetailsFetcher.js
│  │  │  └─ subscriptionsFetcher.js
│  │  └─ services/
│  │     ├─ schedulerService.js    定期取得オーケストレーション
│  │     ├─ settingsPorter.js      設定・お気に入りのエクスポート/インポート
│  │     └─ videoStatus.js         ステータス判定
│  ├─ renderer/
│  │  ├─ src/
│  │  │  ├─ App.jsx                メイン UI（タブ切り替え・状態管理）
│  │  │  └─ main.jsx               React エントリーポイント
│  │  ├─ components/
│  │  │  ├─ AuthScreen.jsx         認証画面
│  │  │  ├─ BackToTop.jsx          トップへ戻るボタン
│  │  │  ├─ CredentialsSetupScreen.jsx  credentials.json 配置案内
│  │  │  ├─ ErrorBoundary.jsx      React エラー境界
│  │  │  ├─ ScheduleCard.jsx       動画カード
│  │  │  ├─ ScheduleList.jsx       予定・ライブ一覧
│  │  │  ├─ SettingsModal.jsx      設定モーダル（3タブ）
│  │  │  ├─ StatusBanners.jsx      状態バナー群
│  │  │  ├─ Toast.jsx              トースト通知
│  │  │  └─ UpdateBanner.jsx       自動更新バナー
│  │  └─ hooks/
│  │     ├─ useAuth.js             認証状態管理
│  │     ├─ useDarkMode.js         ダークモード永続化
│  │     ├─ useNotificationCheck.js  配信前通知チェック（60s ポーリング）
│  │     ├─ useSchedule.js         スケジュールデータ取得
│  │     └─ useTabState.js         タブ状態・無限スクロール・検索デバウンス
│  └─ preload/
│     └─ index.js                  contextBridge（window.api）
├─ docs/
│  └─ spec.md                      本仕様書
├─ scripts/
│  └─ rebuild-native.js            electron-rebuild スクリプト
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                    lint + test（Node.js 24）
│     └─ release.yml               Windows ビルド・Releases 公開（Node.js 24）
├─ .claude/
│  ├─ rules/                       Claude Code ルール群
│  └─ skills/                      カスタムスキル群
├─ CLAUDE.md                       Claude Code 向け開発ガイド
├─ package.json
└─ README.md
```
