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
- **status 判定は `deriveStatus`**：`src/main/services/videoStatus.js` が `upcoming/live/ended` を判定。ended は DB に残らず `listVisible()` で除外。

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
