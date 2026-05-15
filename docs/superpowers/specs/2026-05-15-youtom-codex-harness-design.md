# YouTom 開発プラン — Codex 共同開発ハーネス整備 + 保留課題対応

作成日: 2026-05-15
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
現在バージョン: v1.14.1
ブランド: YouTom（旧 youtube-schedule、2026-05-15 リブランド完了）

---

## 1. 全体ロードマップ

| Phase | 主題 | リリース | 期限 |
|-------|------|---------|------|
| Phase 0 | Codex 共同開発ハーネス整備 | （内部整備のみ） | Phase 1 開始前 |
| Phase 1 | Node 20 deprecation + useEffect 警告 + feature/membership 判断 | v1.14.2 | 2026-06-02 ハード期限 |
| Phase 2a + 2b | アーカイブ絞り込み・ソート + 統計ビュー | v1.15.0 | なし |
| Phase 2c | メン限完全対応 | v1.16.0 | なし |

Phase 0 を最初に完成させ、Phase 1 の最初のタスクを Codex に振ることで動作確認を兼ねる。

---

## 2. Phase 0 — Codex 共同開発ハーネス整備

技術記事プロジェクト（`H:/ClaudeCode/技術記事`）の cross-agent-review パターンを、コード開発向けに翻案する。

### 2.1 ファイル構成

```
youtube-schedule/
├── AGENTS.md                       既存。Codex 向け実行ガイド（拡張する）
├── CLAUDE.md                       既存。Claude 向け（拡張する）
├── CLAUDE_CODE_HANDOFF.md          ★新規。相互ハンドオフ log（追記式）
├── .claude/
│   ├── rules/
│   │   ├── release-checklist.md    既存
│   │   ├── cross-agent-review.md   ★新規。役割分担・merge ゲート 4 条件
│   │   └── handoff-protocol.md     ★新規。プロジェクト固有の handoff 運用
│   └── skills/
│       ├── release/                既存
│       ├── verify/                 既存
│       ├── codex-handoff/          ★新規。Codex への作業依頼テンプレ生成
│       └── cross-review/           ★新規。レビュー側スキル
└── .agents/
    └── skills/
        └── implement-task/         ★新規。Codex 側実装スキル mirror
```

### 2.2 役割分担

| フェーズ | 担当 | 理由 |
|---------|------|------|
| 仕様・設計 | Claude Code | ユーザー対話・ブレストの主体 |
| 実装（小〜中タスク） | Codex | 1 タスク完結型の実装に強い |
| 実装（広範囲・横断的） | Claude Code | 複数ファイル・契約変更を伴うもの |
| 単体テスト追加 | Codex（実装と同時） | TDD 的に書きやすい |
| 実動確認（`npm run dev`・ブラウザ操作） | Claude Code | Playwright MCP・electron 起動の検証主体 |
| レビュー（コード読み） | 相互（作成者の反対側） | 技術記事と同じく相互チェック |
| リリース作業 | Claude Code（`/release` スキル所有） | スキル統一 |
| ハンドオフ更新 | 作業した側 | 完了直後に更新 |

**タスク振り分けの判定基準：**

| 条件 | 振り先 |
|------|--------|
| 単一ファイル or 限定された範囲、仕様明確 | Codex |
| Electron main/renderer 跨ぎ、IPC contract 変更 | Claude Code |
| DB マイグレーション新設 | Claude Code（migration ファイル）→ Codex（呼び出し側修正） |
| UI 検証が必要 | 実装は Codex、検証は Claude Code |
| 設計判断が未確定 | Claude Code が先に設計、その後 Codex に振る |

### 2.3 Merge ゲート 4 条件

develop へ merge する前に 4 条件すべてが揃っていることを必須とする。

| # | 条件 | 確認方法 | 担当 |
|---|------|---------|------|
| ① | セルフ verify | `npm run lint && npm run test && npm run build` がすべて pass | 実装者 |
| ② | 相互レビュー記録 | `CLAUDE_CODE_HANDOFF.md` にレビュー結果が残っている | レビュー側 |
| ③ | 重大指摘なし | レビュー指摘のうち 🔴 ラベルが解消済み | 実装者 |
| ④ | ユーザー merge 指示 | ユーザーが明示的に merge OK と言ったか | ユーザー |

**指摘ラベル：**
- 🔴 重大（merge ブロッカー）— 動作不良・セキュリティ・契約違反・テスト失敗
- 🟡 軽微（任意）— 命名・コメント・整形
- 🟢 良好

**実動確認ゲート（補完）：**
DB マイグレーション or UI 変更を伴う場合、Phase ① の前に Claude Code による Playwright 動作確認を追加（既存 `deverop-after.md` ルールに準拠）。

### 2.4 ハンドオフ運用

`CLAUDE_CODE_HANDOFF.md` を単一ファイル追記式で運用する。

**書式：**

```markdown
# Youtom 共同開発ハンドオフ

最終更新: YYYY-MM-DD
対象リポジトリ: H:/ClaudeCode/Youtube/youtube-schedule

---

## YYYY-MM-DD HH:mm 追記（<topic> — <agent> 作成）

- 対象: feature/<branch-name>
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

**更新タイミング：**
1. タスク開始時（作成者が依頼セクションを書く）
2. レビュー完了時（レビュー側が結果セクションを書く）
3. 指摘反映時（実装側が反映状況を書く）
4. Merge 後（次アクションを「完了」に更新）

**肥大化対策：** `handoff-archive.md` ルールに準拠し、10 セクション超または 30 日経過したら `handoffs/archive/YYYY-QN.md` に切り出し。

### 2.5 スキル新設

| スキル | 場所 | 起動方法 | 役割 |
|--------|------|---------|------|
| `codex-handoff` | `.claude/skills/codex-handoff/` | `/codex-handoff` | Codex への依頼テンプレを生成 + `CLAUDE_CODE_HANDOFF.md` に追記 + 既存 `codex-dev` グローバルスキルへ受け渡し |
| `cross-review` | `.claude/skills/cross-review/` | `/cross-review` | レビュー側が呼ぶ。ハンドオフ参照 → 4 観点でレビュー → 結果を handoff に追記 |
| `implement-task` | `.agents/skills/implement-task/` | Codex 側で `/implement-task` | Codex が ハンドオフを読んで実装に入る手順（ブランチ作成→実装→verify→ハンドオフ更新） |

グローバルにある `codex-dev` スキルは **起動** を担当、本リポジトリの `codex-handoff` は **依頼書作成** を担当。両者を連携させる。

### 2.6 Phase 0 成果物と作業順

| 順 | ファイル | 内容 | 担当 |
|---|---------|------|------|
| 1 | `.claude/rules/cross-agent-review.md` | 役割分担表・merge ゲート 4 条件・指摘ラベル定義 | Claude |
| 2 | `.claude/rules/handoff-protocol.md` | handoff の書き方・更新タイミング・アーカイブ閾値 | Claude |
| 3 | `CLAUDE_CODE_HANDOFF.md` | 初期セクション（Phase 1 開始の依頼を兼ねる） | Claude |
| 4 | `AGENTS.md` 追記 | 「共同開発ハーネス」節を追加。cross-agent-review・handoff-protocol を @import | Claude |
| 5 | `CLAUDE.md` 追記 | 同上 | Claude |
| 6 | `.claude/skills/codex-handoff/SKILL.md` | 依頼テンプレ生成スキル | Claude |
| 7 | `.claude/skills/cross-review/SKILL.md` | レビュースキル | Claude |
| 8 | `.agents/skills/implement-task/SKILL.md` | Codex 側実装スキル | Claude（Codex 用に書く）|
| 9 | Phase 0 完了の動作確認 | Phase 1 の最初のタスクを実際に Codex に振って 1 サイクル回す | Claude |

**Phase 0 完了基準：**
- 1〜8 が `develop` にコミット済み
- 9 の「Phase 1 タスク 1 件を Codex で完走」までを Phase 0 完了とする

---

## 3. Phase 1 — 軽量化パス（v1.14.2 hotfix）

### 3.1 スコープ

| # | 内容 | 担当 | 依存 | 期限 |
|---|------|------|------|------|
| A | `actions/checkout@v4` → `@v5`、`actions/setup-node@v4` → `@v5`、`upload-artifact@v4` の v5 系移行 | Codex | なし | 2026-06-02 |
| C | `useEffect missing dependency: refresh` 警告の解消 | Codex | なし | なし |
| D | `feature/membership` ブランチの扱い決定 | Claude | なし | Phase 2 開始前 |

### 3.2 Task A — Node 20 deprecation 対応

完成条件：
- `.github/workflows/ci.yml` と `release.yml` の `actions/checkout` / `actions/setup-node` / `upload-artifact` が v5 系
- `SignPath/github-action-submit-signing-request@v1` は別アクション、v1 が最新かは確認のみ
- CI が develop で green
- リリースワークフロー（tag push 時）は手動テストせず差分レビューのみ

### 3.3 Task C — useEffect 警告解消

完成条件：
- 対象 hook（`useSchedule.js` / `useNotificationCheck.js` のいずれか）の依存配列が ESLint exhaustive-deps を満たす
- 既存テストがすべて通る
- アプリの自動更新動作（30 分ポーリング）が機能することを `npm run dev` で確認

### 3.4 Task D — feature/membership ブランチ処理

完成条件：
- 以下のいずれかを決定：
  - D-1. 破棄（`git branch -D feature/membership`）— Phase 2 で新ブランチから再設計
  - D-2. rebase 試行 → コンフリクト多発時は破棄
- 決定理由を `CLAUDE_CODE_HANDOFF.md` に残す

### 3.5 Phase 1 進行フロー

```
[Claude] Phase 0 完了 → CLAUDE_CODE_HANDOFF.md に Task A 依頼を追記
   ↓
[Codex] Task A 実装 → セルフ verify → handoff 更新
   ↓
[Claude] レビュー → 結果を handoff に記録 → merge OK 判断をユーザーに仰ぐ
   ↓
[ユーザー] merge 指示
   ↓
[Claude] develop へ merge
   ↓
（Task C も同じフロー）
   ↓
[Claude] Task D 判断 → ユーザー確認 → 実行
   ↓
[Claude] v1.14.2 リリース（/release スキル）
```

### 3.6 Phase 1 完了基準

- Task A・C・D 完了
- v1.14.2 がリリース済み（master tag + GitHub Release）
- `CLAUDE_CODE_HANDOFF.md` に 1 サイクル分の記録が残っている

---

## 4. Phase 2 — メン限完全対応 + アーカイブ詳細化

### 4.1 スコープと実行順

| 順 | 内容 | 規模 | 担当主体 | リリース |
|---|------|------|---------|---------|
| 2a | アーカイブ絞り込み・ソート強化 | 小〜中（UI 中心） | Codex | v1.15.0 |
| 2b | アーカイブ統計ビュー | 中（新タブ追加） | Codex 実装 / Claude UI 検証 | v1.15.0 内 |
| 2c | メン限完全対応 | 大（DB + 手動 ID 登録 + API 検証） | Claude 主導 + Codex 分担 | v1.16.0 |

### 4.2 Task 2a — アーカイブ絞り込み・ソート強化

完成条件：
- アーカイブタブ上部にフィルタバー追加
  - チャンネル絞り込み（複数選択ドロップダウン）
  - 期間絞り込み（プリセット：7日 / 30日 / 90日 / カスタム範囲）
  - 配信タイプ絞り込み（プレミア / 通常ライブ / 配信予定だったが流れた）
- ソート切替（新しい順 / 古い順 / チャンネル名 / 再生時間）
- 既存の FTS5 検索ボックスと併用可能
- フィルタ状態は `electron-store` に保存（再起動後も復元）
- 既存テスト + 新フィルタ用テスト追加

設計判断：
- 配信タイプは既存 `videos` テーブルから派生可能か検証 → 不可なら migration 005 で `video_type` カラム追加
- 再生時間は YouTube API の `contentDetails.duration` 取得が必要 → クォータ消費するので「アーカイブ時に一度だけ取得」する方針

担当分割：
- Codex: フィルタ UI コンポーネント・ソートロジック・テスト
- Claude: migration 必要性の判断・`contentDetails` 取得タイミング設計・Playwright 検証

### 4.3 Task 2b — アーカイブ統計ビュー

完成条件：
- 新タブ `statistics`（または archive タブ内のサブビュー）追加
- 表示項目：
  - チャンネル別配信頻度（直近 30 日 / 90 日）— 棒グラフ
  - 時間帯ヒートマップ（曜日 × 時刻、配信開始時刻分布）
  - お気に入り率（チャンネル別 `is_favorite=1 / 全動画`）
  - 月別配信本数推移（折れ線）
- 統計はクライアント側集計（SQL aggregate）、API 追加呼び出しなし
- グラフライブラリ：Recharts（依存追加） or 自作 SVG

設計判断（Claude 確認事項）：
- Recharts 追加可否（バンドルサイズ +50KB 程度）vs 自作 SVG
- 統計の計算頻度：開く度に毎回 / 1 時間キャッシュ
- レイアウト：全画面 1 タブ / archive タブ内サブビュー

担当分割：
- Claude: グラフライブラリ選定 + レイアウト設計
- Codex: SQL aggregate 関数追加・コンポーネント実装・テスト

### 4.4 Task 2c — メン限完全対応

完成条件：
- 手動動画 ID 登録 UI（設定画面に新セクション）
  - 動画 URL or ID を入力 → API で `videos.list` 検証 → DB に登録
  - メン限フラグ `is_membership_only` カラム追加（migration 005 or 006）
- メン限動画も既存タブ（schedule / missed / archive）で混在表示
- バッジ表示：メン限動画には 🔒 アイコン
- 通知も対応（メン限予約配信開始時に通知）
- 設定画面で「メン限動画」フィルタ ON/OFF
- API 検証タスク：`search.list eventType:upcoming` がメン限予約配信を返すか
  - 返す場合：プール自動追加機能を残す
  - 返さない場合：手動登録 UI のみで対応

設計判断（Claude 主導）：
- `feature/membership` の遺産（`membershipWatchPool`）を再利用するか / 破棄して新規実装か
- API 検証の確実な手段（メンバーシップ登録済みアカウントが必要）
- DB スキーマ：既存 `videos` に `is_membership_only` を追加 vs 新テーブル

担当分割：
- Claude: 設計・API 検証（手動）・migration ファイル・main プロセス側のメン限取得ロジック
- Codex: 設定画面 UI（手動登録フォーム）・バッジ表示・フィルタ・テスト

### 4.5 Phase 2 完了基準

- v1.15.0 リリース（2a + 2b 含む）
- v1.16.0 リリース（2c 含む）
- 各タスクで Phase 0 ハーネス（merge ゲート 4 条件・handoff 運用）を経由
- メン限対応の API 検証結果がドキュメント化されている（成功 / 失敗どちらでも）

---

## 5. 参考プロジェクト

技術記事プロジェクト（`H:/ClaudeCode/技術記事`）の cross-agent-review 運用が直接的なベース。

- `AGENTS.md` / `CLAUDE.md` の役割記述
- `CLAUDE_CODE_HANDOFF.md` の追記式 log
- `.claude/rules/cross-agent-review.md` の公開ゲート 4 条件
- `.claude/skills/article-review/`, `.agents/skills/article-review/` の対称的 skill 配置

技術記事プロジェクトでは作成・レビューが対称（どちらも記事を作って相互レビュー）だったが、本プロジェクトでは Claude が設計・検証主体、Codex が実装主体という非対称配分にする。
