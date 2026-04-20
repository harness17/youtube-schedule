# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

YouTube 配信予定ビューア — Electron + React のデスクトップアプリ。YouTube Data API v3（OAuth 認証）と RSS フィードを使って配信スケジュールを表示する。

## コマンド

```bash
npm run dev          # 開発サーバー起動（electron-vite dev）
npm run build        # Vite ビルド
npm run build:win    # Windows パッケージング
npm run format       # Prettier で全ファイル整形
npm run lint         # ESLint チェック
npm run test         # Vitest テスト実行（1回）
npm run test:watch   # Vitest テスト監視モード
```

## コードスタイル

Prettier で管理。デフォルトから外れる設定：

- `singleQuote: true` — シングルクォートを使う
- `semi: false` — セミコロンなし
- `printWidth: 100` — 行幅 100 文字
- `trailingComma: 'none'` — 末尾カンマなし
- インデント: 2 スペース

## Electron アーキテクチャ

```
Main プロセス（src/main/）   ← Node.js 環境、ファイル/API アクセス可
  └─ IPC（ipcMain/ipcRenderer）
Renderer プロセス（src/renderer/）  ← ブラウザ環境、直接 Node.js 不可
Preload スクリプト（src/preload/）  ← contextBridge で API を安全に公開
```

- Renderer から Node.js API や YouTube API を直接呼ばない。必ず Main プロセス経由で IPC を使う。
- 新しい機能を追加するときは contextBridge への公開も忘れずに。

## YouTube データ取得戦略

- **RSS プライマリ + playlistItems フォールバック**：`RssFetcher` が RSS フィードを取得（0クォータ）し、失敗時は `PlaylistItemsFetcher`（1ユニット/ch）へ自動フォールバック。
- **SchedulerService がオーケストレーション**：`src/main/services/schedulerService.js` が取得→DB保存→IPC通知を 30分ごとに自動実行。
- **SQLite でデータ保持**：動画データは `userData/schedule.db`（better-sqlite3）に UPSERT。`electron-store` は設定専用（`src/main/store.js`）に縮退済み。
- **チャンネルキャッシュ 24h**：`subscriptions.list` は 24h に 1 回のみ実行。
- **status 判定は `deriveStatus`**：`src/main/services/videoStatus.js` が `upcoming/live/ended` を判定。ended は `listVisible()` には出ないが DB には残り、アーカイブ機能で参照される。

## アーカイブ・お気に入り機能（migration 003）

`userData/schedule.db` のテーブル構成（migration 003 追加分）：

| カラム/テーブル | 説明 |
|---|---|
| `videos.viewed_at` | 手動「見た」マークのタイムスタンプ |
| `videos.is_favorite` | お気に入りフラグ（0/1） |
| `videos.ended_at` | ended になった時刻（初回のみセット） |
| `channels.is_pinned` | 推しチャンネルフラグ |
| `videos_fts` | FTS5 仮想テーブル（title + description 全文検索） |

- **保持ポリシー**：ended 動画は `is_favorite=0` かつ `ended_at < 30日前` で cleanup。お気に入りは永久保持。
- **cleanup タイミング**：`SchedulerService.refresh()` の末尾で 24h ごとに実行。
- **FTS 同期**：INSERT/UPDATE/DELETE トリガーで `videos_fts` を自動更新。

### タブ構成（App.jsx）

| タブキー | 内容 |
|---|---|
| `schedule` | 既存の予定・ライブ一覧（ScheduleList）|
| `missed` | `ended` かつ `viewed_at IS NULL` の見逃し一覧 |
| `archive` | 全 ended 動画＋FTS5 全文検索ボックス |
| `favorites` | `is_favorite=1` の動画一覧 |

### ScheduleCard の追加 props

| prop | 型 | 説明 |
|---|---|---|
| `isFavorite` | bool | item から自動取得。⭐ ボタンのスタイルに使用 |
| `onToggleFavorite` | func | `(id) => void` |
| `showViewedButton` | bool | ✓ ボタンを表示するか（アーカイブ系タブのみ true）|
| `onMarkViewed` | func | `(id, viewed: bool) => void` |
| `isPinned` | bool | チャンネルが推し済みなら 📌 バッジを表示 |

## 認証ファイル

以下は `.gitignore` 済みのため、リポジトリには存在しない：

- `credentials.json` — OAuth クライアント ID/シークレット（Google Cloud Console からダウンロード）
- `token.json` — ユーザー認証トークン（認証後に自動生成）
- `.env` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## コミット前チェック（必須）

`git commit` を実行する前に必ず以下を確認する。エラーがあれば修正してからコミットする。

```bash
npm run lint   # ESLint エラーが 0 件であること（warning は許容）
npm run test   # 全テストがパスすること
```

- `/verify` スキルを使うと lint + test を一括実行できる
- CI と同じチェックをローカルで先に通すことで、push 後の CI 失敗を防ぐ

## ブランチ戦略

- **develop** — 日常の開発はここで行う
- **feature/xxx** — 機能単位で develop から切って develop にマージ
- **master** — 安定版のみ。develop からマージしてリリース

master への直接コミット禁止。
