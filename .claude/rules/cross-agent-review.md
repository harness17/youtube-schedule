# Cross-Agent Review ルール（YouTom 共同開発）

Codex と Claude Code で開発を分担するときの役割分担・merge ゲート・指摘ラベルを定める。

## 役割分担

| フェーズ | 担当 | 理由 |
|---------|------|------|
| 仕様・設計 | Claude Code | ユーザー対話・ブレストの主体 |
| 実装（小〜中タスク） | Codex | 1 タスク完結型の実装に強い |
| 実装（広範囲・横断的） | Claude Code | 複数ファイル・契約変更を伴うもの |
| 単体テスト追加 | Codex（実装と同時） | TDD 的に書きやすい |
| 実動確認（`npm run dev`・ブラウザ操作） | Claude Code | Playwright MCP・electron 起動の検証主体 |
| レビュー（コード読み） | 相互（作成者の反対側） | 相互チェックで盲点を拾う |
| リリース作業 | Claude Code（`/release` スキル所有） | スキル統一 |
| ハンドオフ更新 | 作業した側 | 完了直後に更新 |

## タスク振り分けの判定基準

| 条件 | 振り先 |
|------|--------|
| 単一ファイル or 限定された範囲、仕様明確 | Codex |
| Electron main/renderer 跨ぎ、IPC contract 変更 | Claude Code |
| DB マイグレーション新設 | Claude Code（migration ファイル）→ Codex（呼び出し側修正） |
| UI 検証が必要 | 実装は Codex、検証は Claude Code |
| 設計判断が未確定 | Claude Code が先に設計、その後 Codex に振る |

## Merge ゲート 4 条件

`develop` へ merge する前に 4 条件すべてが揃っていること。

| # | 条件 | 確認方法 | 担当 |
|---|------|---------|------|
| ① | セルフ verify | `npm run lint && npm run test && npm run build` がすべて pass | 実装者 |
| ② | 相互レビュー記録 | `CLAUDE_CODE_HANDOFF.md` にレビュー結果が残っている | レビュー側 |
| ③ | 重大指摘なし | レビュー指摘のうち 🔴 ラベルが解消済み | 実装者 |
| ④ | ユーザー merge 指示 | ユーザーが明示的に merge OK と言ったか | ユーザー |

## レビュー必須チェック項目（移動済み）

レビュー側の機械的チェック項目は `.claude/rules/project-collaboration-profile.md` の「レビュー観点」に集約した。本ファイルは旧運用メモとして残しているため、最新の判断材料はそちらを参照。

## 指摘ラベル

- 🔴 **重大**（merge ブロッカー）— 動作不良・セキュリティ・契約違反・テスト失敗・既存機能の破壊
- 🟡 **軽微**（任意）— 命名・コメント・整形・読みやすさ
- 🟢 **良好**

## 実動確認ゲート（補完）

以下に該当する場合、Phase ① の前に Claude Code による Playwright 動作確認を必須とする。

- DB マイグレーション（新規 migration ファイル追加）
- UI 変更（タブ追加・コンポーネント変更・スタイル変更）
- IPC handler の追加・変更

確認は `deverop-after.md`（グローバル）のチェックリストに従う。
