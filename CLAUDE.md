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

## アーカイブ・お気に入り・お知らせ機能（migration 003 / 004）

`userData/schedule.db` のテーブル構成（migration 003・004 追加分）：

| カラム/テーブル      | migration | 説明                                                  |
| -------------------- | --------- | ----------------------------------------------------- |
| `videos.viewed_at`   | 003       | 手動「見た」マークのタイムスタンプ                    |
| `videos.is_favorite` | 003       | お気に入りフラグ（0/1）                               |
| `videos.ended_at`    | 003       | ended になった時刻（初回のみセット）                  |
| `channels.is_pinned` | 003       | 推しチャンネルフラグ                                  |
| `videos_fts`         | 003       | FTS5 仮想テーブル（title + description 全文検索）     |
| `videos.notify`      | 004       | お知らせ登録フラグ（0/1）。見逃しタブの絞り込みに使用 |

- **保持ポリシー**：cleanup は以下の順で判定。
  1. `is_favorite=1` → 永久保持
  2. `notify=1 AND viewed_at IS NULL` → 90日保持（`NOTIFY_RETENTION_MS`）
  3. それ以外 → 30日保持（`ENDED_RETENTION_MS`）
     ユーザーが ✓（見た）を押すと notify=1 でも 30日扱いに戻る。
- **cleanup タイミング**：`SchedulerService.refresh()` の末尾で 24h ごとに実行。
- **FTS 同期**：INSERT/UPDATE/DELETE トリガーで `videos_fts` を自動更新。
- **orphan live 検出**：refresh 時に RSS から消えた live/upcoming 動画を `videos.list` で再確認。API からも消えていれば `markEnded()` で ended に落とす（メンバー限定化・削除対応）。

### タブ構成（App.jsx）

| タブキー    | 内容                                                          |
| ----------- | ------------------------------------------------------------- |
| `schedule`  | 既存の予定・ライブ一覧（ScheduleList）                        |
| `missed`    | `ended` かつ `notify=1` かつ `viewed_at IS NULL` の見逃し一覧 |
| `archive`   | 全 ended 動画＋FTS5 全文検索ボックス                          |
| `favorites` | `is_favorite=1` の動画一覧                                    |

### ScheduleCard の props

| prop               | 型   | 説明                                                                             |
| ------------------ | ---- | -------------------------------------------------------------------------------- |
| `watched`          | bool | `item.isNotify` を渡す。🔔 ボタンのスタイルに使用                                |
| `onToggleWatch`    | func | `(id) => void`。`handleToggleNotify` を渡す                                      |
| `isFavorite`       | bool | item から自動取得。⭐ ボタンのスタイルに使用                                     |
| `onToggleFavorite` | func | `(id) => void`                                                                   |
| `showViewedButton` | bool | ✓ ボタンを表示するか（アーカイブ系タブのみ true）                                |
| `onMarkViewed`     | func | `(id, viewed: bool) => void`                                                     |
| `isPinned`         | bool | チャンネルが推し済みなら 📌 バッジを表示                                         |
| `isViewed`         | bool | `item.viewedAt != null` を渡す。アーカイブ・お気に入りで既読バッジ＋薄表示に使用 |

## リリースルール

@.claude/rules/release-checklist.md

## 認証ファイル

以下は `.gitignore` 済みのため、リポジトリには存在しない：

- `credentials.json` — OAuth クライアント ID/シークレット（Google Cloud Console からダウンロード）
- `token.json` — ユーザー認証トークン（認証後に自動生成）
- `.env` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## コミット前チェック（必須）

`git commit` を実行する前に必ず以下を確認する。エラーがあれば修正してからコミットする。

```bash
npm run lint    # ESLint エラーが 0 件であること（warning は許容）
npm run test    # 全テストがパスすること
npm run build   # Vite ビルドエラーが出ないこと
```

- `/verify` スキルを使うと lint + test + build を一括実行できる
- CI と同じチェックをローカルで先に通すことで、push 後の CI 失敗を防ぐ

## 実動確認（機能追加・DB変更時）

新機能追加や DB マイグレーションを伴うコミットの後は、必ず `npm run dev` でアプリを起動して実動確認を行う。

```bash
npm run dev   # predev で electron-rebuild が自動実行される
```

⚠️ `electron .` や `npx electron` で直接起動すると better-sqlite3 の ABI ミスマッチが発生する。**必ず `npm run dev` を使うこと。**

確認チェックリスト：

- [ ] アプリが起動してメイン画面が表示される
- [ ] 「予定・ライブ」タブが正常に表示される
- [ ] 新しいタブ（見逃し / アーカイブ / お気に入り）が表示・切り替えできる
- [ ] ⭐ / ✓ / 📌 ボタンが期待通りに動作する
- [ ] コンソールにエラーが出ていない（Ctrl+Shift+I で確認）

## ブランチ戦略

- **develop** — 日常の開発はここで行う
- **feature/xxx** — 機能単位で develop から切って develop にマージ
- **master** — 安定版のみ。develop からマージしてリリース

master への直接コミット禁止。
