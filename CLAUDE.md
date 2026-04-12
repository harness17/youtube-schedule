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

- **RSS ファースト**：`search.list` は 1 回 100 クォータ消費するため、まず RSS フィードで取得する。
- **API 呼び出しは最小限**：手動更新や RSS に含まれない情報取得時のみ `youtube-api.js` 経由で呼ぶ。
- キャッシュは `electron-store` で管理（`src/main/store.js`）。

## 認証ファイル

以下は `.gitignore` 済みのため、リポジトリには存在しない：

- `credentials.json` — OAuth クライアント ID/シークレット（Google Cloud Console からダウンロード）
- `token.json` — ユーザー認証トークン（認証後に自動生成）
- `.env` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## ブランチ戦略

- **develop** — 日常の開発はここで行う
- **feature/xxx** — 機能単位で develop から切って develop にマージ
- **master** — 安定版のみ。develop からマージしてリリース

master への直接コミット禁止。
