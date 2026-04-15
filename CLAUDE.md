# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 実装詳細（IPC ハンドラー一覧・キャッシュロジック・データフロー）は [`docs/architecture.md`](docs/architecture.md) を参照。
> ソースファイルを読む前にまずこちらを確認すること。

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

### 通常チャンネル（RSS ファースト）

- **RSS ファースト**：`search.list` は 1 回 100 クォータ消費するため、まず RSS フィードで取得する。
- RSS フィードには **メンバーシップ限定動画が含まれない**。
- RSS フェッチは **1チャンネルあたり5秒タイムアウト**。詰まったチャンネルはスキップして他を続行する（`youtube-api.js: RSS_TIMEOUT_MS`）。

### メンバーシップ限定チャンネル（search.list）

- メンバー限定配信を取得したいチャンネルは `electron-store` の `membershipChannels` に登録する。
- 登録上限は **4チャンネル**（クォータ計算: 100 × 4 × 12回/日 = 4,800ユニット。手動更新分を含めても日次上限 10,000 に収まる）。
- **自動更新は 2時間ごと・upcoming のみ**（`membership:refresh` IPC、`includeLive: false`）。
- **手動更新は live + upcoming**（`includeLive: true`）。
- チャンネル解決は `resolveChannel()` — URL / チャンネルID / `@ハンドル` を受け付けて `channels.list` で名前を解決する。

### 更新フロー

| トリガー               | 処理                                                             | クォータ               |
| ---------------------- | ---------------------------------------------------------------- | ---------------------- |
| 起動時・`schedule:get` | キャッシュ優先（2時間 TTL）、期限切れなら RSS 取得               | 0〜36 ユニット         |
| 10分自動タイマー       | RSS のみ更新（`schedule:refresh`）                               | ~36 ユニット           |
| 2時間自動タイマー      | メンバーシップ upcoming のみ（`membership:refresh`）             | 100 × N ユニット       |
| 手動「更新」ボタン     | RSS + メンバーシップ live+upcoming の両方（`handleFullRefresh`） | ~36 + 200 × N ユニット |

### キャッシュ設計

- RSS・メンバーシップ共に **`{ data, timestamp }` 形式**で保存（`src/main/store.js`）。
- **TTL: 2時間**。起動時に期限切れキャッシュは破棄して再取得する。
- 旧形式（タイムスタンプなし）は自動的に期限切れ扱い（移行処理不要）。

### クォータ超過時の挙動

- `schedule:refresh` / `membership:refresh` が 403 を返したとき `error: 'QUOTA_EXCEEDED'` を返す。
- UI は**消えないバナー**で表示し、YouTube のリセット時刻（太平洋時間深夜 = JST 翌日 17:00 頃）を案内する。
- 更新ボタンの連打防止：`isRefreshingRef`（useRef）で同時実行を1回に限定。

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
