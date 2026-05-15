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
