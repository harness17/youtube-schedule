# 運用負債返済ロードマップ（v1.21〜v1.23）

作成日: 2026-05-27
対象: YouTom v1.20.1 以降の保守リリース 3 本

## 背景

v1.20.1 までで OAuth セキュリティと配布安定性は固まった。次の 3 リリースは新機能ではなく **運用負債の返済** に充てる。理由は (a) Phase A/C の大規模リファクタを安全に進める下地が要る、(b) ポートフォリオ的にも「機能追加だけでなく保守判断ができる」証跡を残せる、(c) ユーザー価値（DL 数）よりまず内部品質を上げないと次の機能追加でコストが膨らむ。

## フェーズ全体像

| 順 | フェーズ | リリース | 主成果 | 触る場所 |
|---|---|---|---|---|
| 1 | **B: テストカバレッジ拡充**（安全網） | v1.21.0 | 全 IPC channel と auth.js 公開関数に最低 1 件のテスト | tests/main/ |
| 2 | **C: main 側サービス層整理** | v1.22.0 | schedulerService フェーズ分離 / videoRepository クエリ責務再配置 | src/main/services, src/main/repositories |
| 3 | **A: 巨大コンポーネント解体** | v1.23.0 | SettingsModal(1106行)/App.jsx(1040行)/useTabState(544行) を責務単位で分割 | src/renderer/ |

順序の根拠：
- **B が先**：A/C のリファクタは regression リスクが大きい。事前にテスト網を張っておくと「壊れていないこと」を機械的に確認できる
- **C を B の次**：main 側のサービス層は IPC handler 越しに renderer から呼ばれる。先に main 側の責務を整理すると、A での renderer 側分割で IPC 呼び出しの意味が変わる事態を避けられる
- **A が最後**：renderer の分割は最大規模かつ視覚的影響が出やすい。B/C が固まった上で取り組む

## 各フェーズの spec

- Phase B: `docs/superpowers/specs/2026-05-27-phase-b-test-coverage-design.md`（このセッションで作成）
- Phase C: 次セッションで spec 化
- Phase A: 次々セッションで spec 化

各フェーズは独立した spec → plan → 実装 → release のサイクルを回す。

## Non-goal（このロードマップに含めないもの）

- インサイト機能拡充（stats タブの分析強化など）
- 新規 OAuth スコープ拡張
- マルチプラットフォーム配布（macOS/Linux）
- TypeScript 化（負債だが、3 フェーズの中に含めると規模が膨らみすぎる）

これらは v1.24+ の議題として保留する。

## 担当境界

- 設計（spec 作成）: Claude Code
- 実装（テスト追加・リファクタ）: Codex
- レビュー: 相互
- リリース判断: user

`.claude/rules/project-collaboration-profile.md` の担当境界に従う。
