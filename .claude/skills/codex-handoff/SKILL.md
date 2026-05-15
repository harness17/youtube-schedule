---
name: codex-handoff
description: Codex に作業を依頼する。`CLAUDE_CODE_HANDOFF.md` に依頼セクションを追記し、`codex-dev` グローバルスキルを起動して Codex を立ち上げる。「Codex に振って」「Codex でやって」「ハンドオフ作って」と言われたら使う。
---

# /codex-handoff

Codex への作業依頼を作成し、ハンドオフファイルに記録するスキル。

## 起動条件

ユーザーが以下のいずれかを言ったとき：
- 「Codex に振って」「Codex でやって」
- 「ハンドオフ作って」「依頼書作って」
- タスク振り分け基準（`.claude/rules/cross-agent-review.md`）で Codex 担当と判断したとき

## 手順

### 1. 振り分け確認

タスクが本当に Codex 向きか、`.claude/rules/cross-agent-review.md` の判定基準で確認する。Claude Code が握るべきタスク（IPC contract 変更・DB migration 新設・横断的リファクタ）なら、ユーザーに「これは Claude が握った方がよさそう」と提案する。

### 2. 依頼内容を整理

ユーザーと対話し、以下を確定する：

- 主題（1 行）
- 変更すべきファイル（推定でよい）
- 完成条件（スプリントコントラクト、`sprint-contract.md` ルール準拠）
- 触ってよい範囲・触ってはいけない範囲
- レビュー観点（Claude が後でレビューするときの着眼点）

### 3. ブランチ名を提案

`feature/<topic-kebab>` 形式。例：`feature/upgrade-actions-v5`、`feature/use-effect-deps`。

### 4. `CLAUDE_CODE_HANDOFF.md` に追記

`handoff-protocol.md` のテンプレに従い、最上部（既存セクションの上）に依頼セクションを追記する。

### 5. Codex を起動

グローバルの `codex-dev` スキルを起動し、Codex に作業を渡す。Codex は `.agents/skills/implement-task/SKILL.md` の手順に従って実装する。

### 6. ユーザーに完了報告

「依頼を `CLAUDE_CODE_HANDOFF.md` に追記し、Codex を起動しました」とユーザーに伝える。

## 注意

- 完成条件を曖昧なまま渡さない（「いい感じに」「適切に」は禁止）
- Codex が判断に迷いそうな箇所は依頼セクションで先に明示する
- `develop` への merge は依頼セクションに「Claude が merge する」と明記し、Codex がやらないようにする
