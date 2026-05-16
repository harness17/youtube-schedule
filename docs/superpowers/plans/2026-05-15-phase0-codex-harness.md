# Phase 0 — Codex 共同開発ハーネス整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTom リポジトリに Codex × Claude Code 共同開発ハーネスを構築し、Phase 1 以降のタスクを安全に Codex に振れる状態にする。

**Architecture:** 技術記事プロジェクト（`H:/ClaudeCode/技術記事`）の cross-agent-review パターンをコード開発向けに翻案。役割分担表・merge ゲート4条件・handoff 運用・3 つのスキル（codex-handoff / cross-review / implement-task）を整備する。

**Tech Stack:** Markdown ルールファイル + Claude Code skills（SKILL.md 形式）+ Codex 互換 skill（`.agents/skills/`）。コード変更なし。

**Spec:** `docs/superpowers/specs/2026-05-15-youtom-codex-harness-design.md`

**Branch:** `develop`（このリポジトリの慣習に従い、Phase 0 はハーネス整備のみのため feature ブランチを切らず develop で直接進める）

---

## File Structure

```
youtube-schedule/
├── .claude/
│   ├── rules/
│   │   ├── cross-agent-review.md       Task 1 新規 — 役割分担・merge ゲート・指摘ラベル
│   │   └── handoff-protocol.md         Task 2 新規 — handoff 書式・更新タイミング・アーカイブ
│   └── skills/
│       ├── codex-handoff/SKILL.md      Task 6 新規 — Codex への依頼テンプレ生成
│       └── cross-review/SKILL.md       Task 7 新規 — レビュー側スキル
├── .agents/
│   └── skills/
│       └── implement-task/SKILL.md     Task 8 新規 — Codex 側実装スキル
├── CLAUDE_CODE_HANDOFF.md              Task 3 新規 — 相互ハンドオフ log
├── AGENTS.md                           Task 4 修正 — ハーネス節追加
└── CLAUDE.md                           Task 5 修正 — ハーネス節追加
```

各タスクは独立した 1 ファイル単位で作成し、タスクごとにコミットする。

---

## Task 1: `.claude/rules/cross-agent-review.md` 作成

**Files:**
- Create: `.claude/rules/cross-agent-review.md`

- [ ] **Step 1: ファイルを作成**

以下の内容で `.claude/rules/cross-agent-review.md` を新規作成する。

````markdown
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
````

- [ ] **Step 2: 内容を確認**

`Read` で作成したファイルを読み返し、表の列揃え崩れ・誤字がないか確認。

- [ ] **Step 3: コミット**

```bash
git add .claude/rules/cross-agent-review.md
git commit -m "docs(rules): add cross-agent-review for Codex/Claude co-development"
```

---

## Task 2: `.claude/rules/handoff-protocol.md` 作成

**Files:**
- Create: `.claude/rules/handoff-protocol.md`

- [ ] **Step 1: ファイルを作成**

````markdown
# Handoff Protocol ルール（YouTom 共同開発）

Codex / Claude Code 間のハンドオフ運用ルール。グローバルの `handoff-capture.md` / `handoff-archive.md` をプロジェクト固有に具体化する。

## ファイル

`CLAUDE_CODE_HANDOFF.md`（リポジトリ直下、単一ファイル追記式）

## セクション書式

新しいタスクごとに以下のテンプレを最上部に追記する（最新が上）。

```markdown
## YYYY-MM-DD HH:mm 追記（<topic> — <agent> 作成）

- 対象: feature/<branch-name> または develop
- 作成者: ClaudeCode | Codex
- 主題: <1行>
- 変更ファイル: <list>
- レビュー担当: <反対側>
- 触ってよい範囲: <files>
- セルフ verify: ✅/❌ (lint/test/build)
- 実動確認: ✅/❌/N/A
- レビュー観点:
  - <観点1>
  - <観点2>

### レビュー結果（YYYY-MM-DD, レビュー側）
- 公開可否: 🟢 / 🔴 / 🟡
- 重大指摘:
- 軽微指摘:

### 反映状況（YYYY-MM-DD, 実装側）
| 指摘 | 反映内容 |
|------|---------|

### Merge ゲート 4 条件
| ①セルフ | ②相互レビュー | ③重大指摘 | ④ユーザー指示 |
|---------|-------------|----------|-------------|
| ✅ | ✅ | 🟢 残なし | ❌ 未指示 |

### 次アクション
- <次の人がやること>
```

## 更新タイミング

| タイミング | 誰が | 何を |
|-----------|------|------|
| タスク開始時 | 作成者 | 依頼セクション（対象・主題・変更ファイル・レビュー観点）を追記 |
| セルフ verify 完了時 | 作成者 | セルフ verify を ✅ に更新 |
| 実動確認完了時 | 検証担当 | 実動確認を ✅ に更新 |
| レビュー完了時 | レビュー側 | レビュー結果セクションを追記 |
| 指摘反映時 | 実装側 | 反映状況テーブルを追記 |
| Merge 後 | merge 実行者 | 次アクションを「完了」に更新 |

## アーカイブ閾値

グローバルの `handoff-archive.md` に準拠。

- セクション 10 を超えた、または最古セクションが 30 日以上前 → `handoffs/archive/YYYY-QN.md` に切り出し
- 切り出し後、元ファイルには 1 行サマリ + archive へのリンクを残す

## status 用語

ハンドオフ全体の状態を文書頭に記載する場合、3 値のみ使う。

- `active` — 後続作業・レビュー・merge 指示待ちが残っている
- `completed` — Merge 完了・後続作業が別ハンドオフに移譲済み
- `blocked` — 外部確認待ち・ユーザー判断待ちで前進できない
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add .claude/rules/handoff-protocol.md
git commit -m "docs(rules): add handoff-protocol for Codex/Claude co-development"
```

---

## Task 3: `CLAUDE_CODE_HANDOFF.md` 作成（初期セクション）

**Files:**
- Create: `CLAUDE_CODE_HANDOFF.md`

- [ ] **Step 1: ファイルを作成**

````markdown
# YouTom 共同開発ハンドオフ

最終更新: 2026-05-15
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、役割分担と merge ゲートは `.claude/rules/cross-agent-review.md` を参照。

---

## 2026-05-15 — Phase 0 完了通知（Claude 作成）

- 対象: develop
- 作成者: ClaudeCode
- 主題: Codex 共同開発ハーネス整備（cross-agent-review / handoff-protocol / 3 スキル）
- 変更ファイル:
  - `.claude/rules/cross-agent-review.md`
  - `.claude/rules/handoff-protocol.md`
  - `.claude/skills/codex-handoff/SKILL.md`
  - `.claude/skills/cross-review/SKILL.md`
  - `.agents/skills/implement-task/SKILL.md`
  - `AGENTS.md`（追記）
  - `CLAUDE.md`（追記）
  - `CLAUDE_CODE_HANDOFF.md`（このファイル）
- レビュー担当: なし（ハーネス整備自体は単独実装）
- セルフ verify: ✅
- 実動確認: N/A（ドキュメントのみ）

### 次アクション

Phase 1 Task A（Node 20 deprecation 対応）の依頼セクションを Claude が下に追記し、Codex に振る。
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add CLAUDE_CODE_HANDOFF.md
git commit -m "docs: add CLAUDE_CODE_HANDOFF.md with Phase 0 initial section"
```

---

## Task 4: `AGENTS.md` にハーネス節を追加

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 既存内容を確認**

`Read` で現在の `AGENTS.md` を読む。「## ブランチ戦略」セクションが末尾にあることを確認。

- [ ] **Step 2: 「## ブランチ戦略」の直後に新セクションを追加**

`Edit` で末尾の「master への直接コミット禁止。」の後に以下を追加する。

````markdown

## 共同開発ハーネス（Codex × Claude Code）

このリポジトリは Codex と Claude Code が共同で開発する。役割分担・merge ゲート・指摘ラベルは以下のルールに従う。

@.claude/rules/cross-agent-review.md
@.claude/rules/handoff-protocol.md

**Codex が作業を開始するときの流れ：**

1. `CLAUDE_CODE_HANDOFF.md` の最新セクションを読み、自分宛ての依頼があるか確認
2. `.agents/skills/implement-task/SKILL.md` の手順に従い、ブランチを切って実装
3. セルフ verify（`npm run lint && npm run test && npm run build`）を通す
4. ハンドオフのセルフ verify を ✅ に更新
5. レビュー依頼を残してターンを Claude に渡す

**重要：** Merge ゲート 4 条件のうち ④（ユーザー merge 指示）はユーザーが明示するまで満たされない。Codex 自身が `develop` へ merge することはしない。
````

- [ ] **Step 3: 内容を確認**

`Read` で `AGENTS.md` を再読し、@import 行が正しく追加されているか確認。

- [ ] **Step 4: コミット**

```bash
git add AGENTS.md
git commit -m "docs(agents): add co-development harness section with rule imports"
```

---

## Task 5: `CLAUDE.md` にハーネス節を追加

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 既存内容を確認**

`Read` で現在の `CLAUDE.md` を読む。「## ブランチ戦略」セクションが末尾にあることを確認。

- [ ] **Step 2: 「## ブランチ戦略」の直後に新セクションを追加**

`Edit` で末尾の「master への直接コミット禁止。」の後に以下を追加する。

````markdown

## 共同開発ハーネス（Codex × Claude Code）

このリポジトリは Codex と Claude Code が共同で開発する。役割分担・merge ゲート・指摘ラベルは以下のルールに従う。

@.claude/rules/cross-agent-review.md
@.claude/rules/handoff-protocol.md

**Claude Code が作業を開始するときの流れ：**

1. ユーザーの依頼を聞いたら、タスク振り分け基準（cross-agent-review.md）で Codex に振るか自分で握るか判断
2. Codex に振るなら `/codex-handoff` スキルで依頼セクションを `CLAUDE_CODE_HANDOFF.md` に追記
3. 自分で実装する場合は通常のフローで進め、レビューを Codex に依頼
4. Codex の作業完了後は `/cross-review` スキルでレビュー
5. Merge 判断はユーザー指示を待つ

**最新の引き継ぎ：** `CLAUDE_CODE_HANDOFF.md` を参照する。
````

- [ ] **Step 3: 内容を確認**

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add co-development harness section with rule imports"
```

---

## Task 6: `.claude/skills/codex-handoff/SKILL.md` 作成

**Files:**
- Create: `.claude/skills/codex-handoff/SKILL.md`

- [ ] **Step 1: ディレクトリを作成し、SKILL.md を書く**

`Write` で以下の内容で作成する。

````markdown
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
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add .claude/skills/codex-handoff/SKILL.md
git commit -m "feat(skills): add /codex-handoff for Codex task delegation"
```

---

## Task 7: `.claude/skills/cross-review/SKILL.md` 作成

**Files:**
- Create: `.claude/skills/cross-review/SKILL.md`

- [ ] **Step 1: ファイルを作成**

````markdown
---
name: cross-review
description: Codex（または Claude）が作成したコード変更を相互レビューする。`CLAUDE_CODE_HANDOFF.md` の依頼を読み、4 観点（動作・契約・テスト・スタイル）で確認し、結果をハンドオフに追記する。「レビューして」「クロスレビュー」「Codex の作業を確認」と言われたら使う。
---

# /cross-review

共同開発の相互レビュースキル。

## 起動条件

- Codex が実装を完了し、ハンドオフのセルフ verify が ✅ になったとき
- ユーザーが「レビューして」「クロスレビュー」と言ったとき

## レビュー 4 観点

各観点で 🔴（重大）/ 🟡（軽微）/ 🟢（良好）を判定する。

### 観点 1: 動作

- 完成条件（スプリントコントラクト）を満たしているか
- 既存機能を壊していないか（既存テストが通る）
- エラー処理・境界値の扱いに穴がないか

### 観点 2: 契約

- IPC handler 名・引数・返り値が他から呼ばれている形と一致しているか
- DB schema 変更があれば migration の整合性
- contextBridge の公開漏れがないか

### 観点 3: テスト

- 完成条件に対応するテストが追加されているか
- ハッピーパスだけでなく異常系・境界値をカバーしているか（`test-strategy.md` ルール参照）

### 観点 4: スタイル

- Prettier 設定（singleQuote / no semi / printWidth 100 / no trailing comma）に従っているか
- ESLint 警告 0 件
- コメントが過剰でないか（`karpathy-coding-principles.md` 参照）

## 手順

### 1. ハンドオフを読む

`CLAUDE_CODE_HANDOFF.md` の最新セクションから対象・変更ファイル・レビュー観点を確認。

### 2. 変更ファイルを順に読む

`Read` で各ファイルを読み、4 観点でチェック。

### 3. 既存テストを実行

`npm run lint && npm run test && npm run build` を走らせて確認。失敗するなら 🔴 重大指摘。

### 4. 実動確認が必要なら Playwright

UI 変更・DB 変更を含むなら `npm run dev` で起動して動作確認（`deverop-after.md` ルール）。

### 5. ハンドオフにレビュー結果を追記

`handoff-protocol.md` の書式に従い、「### レビュー結果（YYYY-MM-DD, レビュー側）」セクションを該当セクションに追記。

### 6. ユーザーに報告

- 公開可否（🟢 merge 可 / 🔴 修正必須 / 🟡 軽微指摘あり）
- 重大指摘の要約
- 次アクション（Codex に修正を返すか、ユーザー merge 指示待ちか）

## 注意

- 「読みやすさ」など主観的な指摘は 🟡 軽微に留める
- 動作確認なしで 🟢 を出さない（テスト pass だけでは不十分なケースが多い）
- Codex の判断を尊重しつつ、契約と動作の事実は厳しく見る
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add .claude/skills/cross-review/SKILL.md
git commit -m "feat(skills): add /cross-review for mutual code review"
```

---

## Task 8: `.agents/skills/implement-task/SKILL.md` 作成（Codex 側）

**Files:**
- Create: `.agents/skills/implement-task/SKILL.md`

- [ ] **Step 1: ディレクトリを作成し、SKILL.md を書く**

````markdown
---
name: implement-task
description: Codex がハンドオフ依頼を受けて実装に入るときに使う。ブランチ作成・実装・セルフ verify・ハンドオフ更新の一連の流れを定義する。
---

# /implement-task（Codex 側）

`CLAUDE_CODE_HANDOFF.md` に書かれた依頼を読んで実装に入るスキル。

## 起動条件

- Codex が起動された直後、最初に `CLAUDE_CODE_HANDOFF.md` を読んだとき
- ユーザーから「実装して」「進めて」と言われたとき

## 手順

### 1. ハンドオフ依頼を読む

`CLAUDE_CODE_HANDOFF.md` 最上部のセクションを読み、以下を確認：

- 自分宛て（Codex）の依頼か
- 主題と完成条件
- 触ってよい範囲・触ってはいけない範囲
- 提案されたブランチ名

### 2. ブランチを切る

```bash
git checkout develop
git pull origin develop
git checkout -b <提案されたブランチ名>
```

### 3. 完成条件を再確認

スプリントコントラクト形式で完成条件を自分の言葉で書き出し、ユーザーに合意を取る（`sprint-contract.md` ルール準拠）。

完成条件が曖昧な場合はユーザーに確認する。「いい感じに」「適切に」は禁止。

### 4. 実装

- 1 つの完成条件 → 1 つのコミットを基本とする
- テストを先に書く（TDD、`test-strategy.md` ルール準拠）
- `git add -A` / `git add .` は使わない（`git-ops.md` ルール）。個別ファイル指定

### 5. セルフ verify

```bash
npm run lint    # error / warning 0 件
npm run test    # 全テスト pass
npm run build   # ビルドエラーなし
```

すべて pass しなければコミットしない。

### 6. ハンドオフを更新

`CLAUDE_CODE_HANDOFF.md` の該当セクションを編集：

- セルフ verify を ✅ に更新
- 実装内容の概要を追記
- 次アクションを「Claude によるレビュー」に更新

### 7. push してターンを返す

```bash
git push -u origin <branch-name>
```

ユーザーに「実装完了、レビューを Claude にお願いしたい」と報告。

## 禁止事項

- `develop` / `master` へ直接 commit・push しない
- `git add -A` / `.` を使わない
- `--no-verify` で pre-commit hook をスキップしない
- 完成条件にない機能を勝手に追加しない（`karpathy-coding-principles.md` 準拠）
- ハンドオフの「触ってはいけない範囲」に手を出さない
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add .agents/skills/implement-task/SKILL.md
git commit -m "feat(agents): add Codex-side /implement-task skill"
```

---

## Task 9: 統合動作確認（Phase 1 Task A の handoff 作成テスト）

このタスクは Phase 0 完了の最終確認。実際の Codex 起動は Phase 1 で行うため、ここでは「依頼セクション作成」までで止める。

**Files:**
- Modify: `CLAUDE_CODE_HANDOFF.md`

- [ ] **Step 1: `/codex-handoff` スキルを擬似的に手動実行**

`CLAUDE_CODE_HANDOFF.md` の最上部（既存「Phase 0 完了通知」セクションの上）に Phase 1 Task A の依頼セクションを追記する。

````markdown
## 2026-05-15 — Phase 1 Task A 依頼（Claude → Codex）

- 対象: feature/upgrade-actions-v5
- 作成者: ClaudeCode
- 主題: GitHub Actions の Node 20 deprecation 対応（v4 → v5 系移行）
- 変更ファイル:
  - `.github/workflows/ci.yml`
  - `.github/workflows/release.yml`
- レビュー担当: ClaudeCode
- 触ってよい範囲: `.github/workflows/` 配下のみ
- セルフ verify: ❌ 未実施
- 実動確認: N/A
- レビュー観点:
  - `actions/checkout@v4` → `@v5`、`actions/setup-node@v4` → `@v5`、`upload-artifact@v4` → `@v5`
  - `SignPath/github-action-submit-signing-request@v1` は変更不要（最新確認のみ）
  - workflow ファイルの YAML 構文エラーなし
  - CI が develop で green

### 完成条件（スプリントコントラクト）

- `.github/workflows/ci.yml` と `release.yml` の `actions/checkout` / `actions/setup-node` / `upload-artifact` がすべて v5 系
- workflow_dispatch でも push でも CI が green
- リリースワークフローは tag push で動くため手動テスト不要、差分レビューのみ
- Merge は Claude が行う（Codex は push までで止める）

### 次アクション

- Codex が `feature/upgrade-actions-v5` ブランチで実装
````

- [ ] **Step 2: 内容を確認**

- [ ] **Step 3: コミット**

```bash
git add CLAUDE_CODE_HANDOFF.md
git commit -m "docs(handoff): add Phase 1 Task A request for Codex (actions v5 upgrade)"
```

- [ ] **Step 4: ユーザーに Phase 0 完了を報告**

以下を伝える：

- Phase 0 の 8 ファイルが develop にコミット済み
- Phase 1 Task A の依頼が `CLAUDE_CODE_HANDOFF.md` に追加済み
- 次は `codex-dev` グローバルスキルで Codex を起動して Task A を実行する段階

---

## Self-Review Checklist（プラン作成者が完了後に確認）

- [ ] **Spec coverage:** spec の Phase 0 成果物 1〜9 すべてに対応タスクがあるか
  - 成果物 1 → Task 1 ✓
  - 成果物 2 → Task 2 ✓
  - 成果物 3 → Task 3 ✓
  - 成果物 4 → Task 4 ✓
  - 成果物 5 → Task 5 ✓
  - 成果物 6 → Task 6 ✓
  - 成果物 7 → Task 7 ✓
  - 成果物 8 → Task 8 ✓
  - 成果物 9 → Task 9 ✓（依頼セクション作成まで。Codex 実起動は Phase 1）

- [ ] **Placeholder scan:** "TBD"、"TODO"、"実装する"（具体内容なし）がないか

- [ ] **Type consistency:** スキル名（`codex-handoff`、`cross-review`、`implement-task`）が全タスクで一致

- [ ] **コマンド整合:** Prettier・ESLint 設定（singleQuote / no semi / printWidth 100 / no trailing comma）が cross-review SKILL と既存 AGENTS.md で一致

---

## 完了基準

- 9 タスクすべての commit が develop に積まれている
- `git log --oneline -10` で 9 コミット分が確認できる
- `CLAUDE_CODE_HANDOFF.md` に Phase 1 Task A の依頼セクションが書かれている
- ユーザーが「次は Codex を起動して Task A をやろう」と進められる状態
