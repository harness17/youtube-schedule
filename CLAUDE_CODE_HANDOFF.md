# YouTom 共同開発ハンドオフ

最終更新: 2026-05-15
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、役割分担と merge ゲートは `.claude/rules/cross-agent-review.md` を参照。

---

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
