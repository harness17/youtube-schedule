---
name: release
description: >
  Electron アプリ（youtube-schedule）のバージョン更新・タグ打ち・GitHub リリース発行を行う。
  「リリース」「ビルドして公開」「バージョン上げて」「v1.x.x にして」などと言われたら必ずこのスキルを使う。
  patch / minor / major どのバンプか明示されていない場合はユーザーに確認してから進める。
---

# release スキル

## 概要

`v*` タグを push すると GitHub Actions（`.github/workflows/release.yml`）が
Windows インストーラーをビルドして GitHub Releases に自動公開する。
このスキルはその前段の「バージョン管理とタグ操作」を担う。

## 前提

- ブランチ: `master`（直接コミット運用）
- ビルド: GitHub Actions `windows-latest` で `npm run build:win -- --publish always`
- 成果物: `youtube-schedule-X.X.X-setup.exe`

---

## 手順

### 1. バンプ種別を確認

ユーザーが明示していなければ必ず聞く。

| 種別 | 例 | 変更内容 |
|------|----|---------|
| patch | バグ修正のみ | `1.0.0` → `1.0.1` |
| minor | 後方互換の新機能 | `1.0.0` → `1.1.0` |
| major | 破壊的変更 | `1.0.0` → `2.0.0` |

現在のバージョンは `package.json` の `"version"` を読んで確認する。

### 2. package.json のバージョンを更新

`Edit` ツールで `"version"` の値だけを変更する。

### 3. コミット

```bash
git add package.json
git commit -m "chore: bump version to X.X.X

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### 4. タグ作成 → master + タグを push

```bash
git tag vX.X.X
git push origin master --tags
```

### 5. GitHub Actions の完了を待つ

```bash
gh run watch --repo harness17/youtube-schedule \
  $(gh run list --repo harness17/youtube-schedule --limit 1 --json databaseId --jq '.[0].databaseId')
```

失敗した場合はログを確認して原因を調査する。

```bash
gh run view <run-id> --repo harness17/youtube-schedule --log-failed 2>&1 | tail -60
```

### 6. ドラフト公開

Actions 完了後、リリースがドラフト状態のままなら公開する。

```bash
gh release edit vX.X.X --repo harness17/youtube-schedule \
  --draft=false \
  --title "vX.X.X" \
  --notes "$(cat <<'EOF'
## 変更内容
- ...
EOF
)"
```

リリースノートの内容はコミット差分から要約して記載する。

---

## よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `Cannot create symbolic link` | Windows でシンボリックリンク作成不可 | ローカルビルド不可。GitHub Actions を使う（このスキルの想定動作） |
| `403 Forbidden` on release create | `GITHUB_TOKEN` に `contents: write` がない | `.github/workflows/release.yml` の `permissions` を確認 |
| ワークフローがトリガーされない | タグが古いコミットを指している | タグを削除して再作成: `git tag -d vX.X.X && git push origin :refs/tags/vX.X.X && git tag vX.X.X && git push origin vX.X.X` |
