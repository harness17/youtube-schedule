---
name: release
description: >
  Electron アプリ（youtube-schedule）のリリース作業を行う。
  「リリース」「公開して」「バージョン上げて」「v1.x.x にして」などと言われたら必ずこのスキルを使う。
  patch / minor / major どのバンプか明示されていない場合はユーザーに確認してから進める。
---

# release スキル

@../../rules/release-checklist.md

## 概要

`v*` タグを push すると GitHub Actions（`.github/workflows/release.yml`）が
Windows インストーラーをビルドして GitHub Releases に自動公開する。
このスキルはその前段の「バージョン管理・ドキュメント・公開」を担う。

## ブランチ戦略

```
feature/xxx → develop → master（リリース時のみ）
```

- 開発は `develop` または `feature/xxx` で行う
- リリース時のみ develop → master にマージ
- master への直接コミット禁止

---

## 手順

### 1. バンプ種別を確認

ユーザーが明示していなければ必ず聞く。

| 種別  | 例               | 変更内容           |
| ----- | ---------------- | ------------------ |
| patch | バグ修正のみ     | `1.0.0` → `1.0.1`  |
| minor | 後方互換の新機能 | `1.0.0` → `1.1.0`  |
| major | 破壊的変更       | `1.0.0` → `2.0.0`  |

現在のバージョンは `package.json` の `"version"` を読んで確認する。

### 2. 事前検証（/verify）

`/verify` スキルを実行して lint・test・build がすべてパスすることを確認する。
失敗があればリリース作業に進まない。

### 3. README 機能一覧の更新

`README.md` の「機能」セクションを確認し、今回のリリースで追加・変更した機能を反映する。
`release-checklist.md` の「README 機能一覧の更新」ルールに従う。

更新後は develop ブランチでコミットする：

```bash
git add README.md
git commit -m "docs: README に vX.X.X の変更内容を反映

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### 4. package.json のバージョンを更新

`Edit` ツールで `"version"` の値だけを変更する。

```bash
git add package.json
git commit -m "chore: bump version to X.X.X

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### 5. develop → master マージ

```bash
git checkout master
git merge --no-ff develop -m "Release vX.X.X

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### 6. タグ作成 → push

```bash
git tag vX.X.X
git push origin master develop --tags
```

### 7. GitHub Actions の完了を待つ

```bash
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

失敗した場合はログを確認する：

```bash
gh run view <run-id> --log-failed 2>&1 | tail -60
```

### 8. リリースノートを書いて公開

`release-checklist.md` の「リリースノートの作成」ルールに従い、ユーザー視点で内容を整理する。
コミット差分は以下で取得する：

```bash
git log --oneline vX.X.X ^<前バージョンタグ>
```

```bash
gh release edit vX.X.X \
  --draft=false \
  --title "vX.X.X" \
  --notes "$(cat <<'EOF'
## vX.X.X — <主題>

### 新機能
- ...

### バグ修正
- ...
EOF
)"
```

### 9. X（Twitter）投稿テキストを生成

`release-checklist.md` の「X（Twitter）広告テキストの生成」ルールに従い生成する。
生成したテキストをそのままコピーできる形でユーザーに提示する。

### 10. develop との同期

master に README 更新などがあれば develop に戻す：

```bash
git checkout develop
git merge --no-ff master -m "chore: sync develop with master (vX.X.X)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin develop
git checkout master
```

---

## よくあるエラーと対処

| エラー                            | 原因                                       | 対処                                                                                                                             |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot create symbolic link`     | Windows でシンボリックリンク作成不可       | ローカルビルド不可。GitHub Actions を使う                                                                                         |
| `403 Forbidden` on release create | `GITHUB_TOKEN` に `contents: write` がない | `.github/workflows/release.yml` の `permissions` を確認                                                                          |
| ワークフローがトリガーされない    | タグが古いコミットを指している             | `git tag -d vX.X.X && git push origin :refs/tags/vX.X.X && git tag vX.X.X && git push origin vX.X.X`                            |
