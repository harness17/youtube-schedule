# Project Collaboration Profile（YouTom）

`cross-agent-harness.md` を YouTom に適用するためのプロジェクト固有設定。

## プロジェクト

- 名前: YouTom
- 種別: Electron + React デスクトップアプリ、SQLite、YouTube Data API v3、RSS fetcher
- 主な検証対象: `src/main/`、`src/preload/`、`src/renderer/`、`tests/`、DB migrations、IPC contracts
- 注意領域: OAuth credentials、token、YouTube API quota、SQLite migration、Electron native module、配布・署名・SmartScreen

## 担当境界

| 条件 | 振り先 |
|------|--------|
| 単一 renderer component / hook / test、仕様明確 | Codex |
| main / preload / renderer をまたぐ IPC contract 変更 | Claude Code が設計し、Codex は限定実装 |
| SQLite migration、DB cleanup、retention policy 変更 | Claude Code が設計・migration、Codex は呼び出し側やテスト修正 |
| YouTube API quota や自動 polling を変える変更 | Claude Code + user |
| UI 実動確認、Electron 起動、配布前確認 | 実装者がセルフ確認し、反対側がレビュー |
| release / publish / store package / SmartScreen 判断 | user |

## Verify コマンド

通常のセルフ verify:

```powershell
npm run lint
npm run test
npm run build
```

実動確認が必要な場合:

```powershell
npm run dev
```

`better-sqlite3` の ABI mismatch を避けるため、直接 `electron .` や `npx electron` で起動しない。

## レビュー観点

### 動作

- 完成条件を満たしているか
- 既存タブ（予定・ライブ / 見逃し / アーカイブ / お気に入り）を壊していないか
- エラー表示、loading、empty state、重複操作の扱いに穴がないか

### 契約

- IPC handler、preload API、renderer 呼び出しの契約が一致しているか
- migration と repository / row mapper / tests が一致しているか
- RSS primary + API fallback の取得戦略を崩していないか
- `deriveStatus` と archive / visible list の意味が一致しているか

### テスト

- 変更範囲に応じた Vitest が追加・更新されているか
- `npm run lint`、`npm run test`、`npm run build` が pass するか
- DB migration 変更では既存 DB と新規 DB の両方を考慮しているか

### セキュリティ・運用

- `credentials.json`、`credentials_D.json`、`token.json`、`.env` をコミットしていないか
- YouTube API quota 消費を見積もり、polling / refresh / user-controlled count に上限があるか
- raw token、internal path、stack trace を UI に出していないか
- release package に開発用 secret や不要ファイルが混ざっていないか

### スタイル

- Prettier 設定（single quote / no semicolon / printWidth 100）に揃っているか
- unrelated cleanup や依頼外ファイル変更が混ざっていないか
- `git add -A` / `git add .` を使わず、変更ファイルを個別指定しているか

## YouTom 固有の重大指摘

以下は原則として merge / publish ブロッカーにする。

- OAuth credentials、token、secret、`.env` の混入
- YouTube API quota を大きく増やす自動処理に上限・説明がない
- IPC contract 変更で main / preload / renderer / event 発火・購読ペアのうち片側だけが更新されている
- SQLite migration が既存 DB を壊す、または rollback / compatibility の説明がない
- `better-sqlite3` ABI mismatch を誘発する起動・検証手順
- `npm run lint` / `npm run test` / `npm run build` の失敗を残した merge
- 置き換え対象の旧コンポーネント・テストが dead code として残置されている

## レビュー必須チェック項目

レビュー側は以下を機械的にチェックし、抜けがあれば 🔴 指摘とする。

- **IPC 4 点対称**: main handler / preload exposure / renderer 呼び出し / event 発火・購読ペアの一致（event ペアが該当しない request/response 型 IPC は handoff に `N/A と理由` を明記）
- **dead code 残置**: 置き換え対象の旧ファイル・旧テストが working tree に残っていないか
- **handoff 完成条件の網羅**: 全項目が verify されているか
- **テスト数の変化が意味的に妥当**: 単に「+N 件」だけでなく、削除した範囲のテストも整理されているか

## ブレスト初期チェックリスト（YouTom 固有）

YouTube 関連の機能を新規にブレストするとき、最初に以下を確定してから設計に入る。

- **OAuth スコープ拡張の要否**: 必要なら検証申請（sensitive scope の場合）コスト・スケジュールをユーザーに提示。SignPath 再申請が進行中の現状では、scope 拡張は別フェーズで切り分ける
- **YouTube API クォータ**: 想定アクセス頻度 × ユーザー数 × ユニット数の見積もりを行う（グローバルルール `~/.claude/rules/api-quota-design.md` 参照。repo 内に同名ファイルは置かない）
- **取得対象の API 制限**: `playlists.list?mine=true` に "Watch Later" / "Liked Videos" が含まれない等の YouTube 仕様制限を spec 段階で確認・周知
- **既存タブ・既存 IPC・既存 DB との影響範囲**: union 表示・タブ統合などの選択肢は早めにスクリーンショット・モックでユーザー認知を合わせる
