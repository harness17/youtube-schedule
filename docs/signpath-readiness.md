# SignPath Foundation OSS コード署名 再申請準備メモ

最終更新: 2026-05-20

[SignPath Foundation](https://signpath.io/solutions/open-source-community) の OSS コード署名は初回申請で「外部信頼シグナル不足」を理由に未承認となった。本ドキュメントは再申請の判断材料となる現状の信頼シグナルを実数で記録し、再申請の閾値を明示する。

---

## 現状の信頼シグナル（2026-05-20 時点）

### リポジトリ

| 指標 | 値 | 備考 |
|------|-----|------|
| リポジトリ作成 | 2026-04-12 | 公開後 約38日 |
| Star 数 | 0 | |
| Fork 数 | 0 | |
| Watcher 数 | 0 | |
| Open Issue | 1 | 自分起票（Zenn/Qiita記事投稿タスク） |
| 外部からの Issue / PR | 0 | |
| 公開リリース数 | 27 | v1.1.0 〜 v1.17.0 |

### 配布実績

| 指標 | 値 |
|------|-----|
| 累計ダウンロード数（全リリース合計） | 約 282 |
| 最新リリース（v1.17.0）DL 数 | 4（公開翌日時点） |
| 最大単体 DL | v1.9.0 の 52 件 |
| 直近5リリース平均 | 約 6.6 件 / リリース |

> DL 数は GitHub Release アセットの累計。インストーラー（`-setup.exe`）と `latest.yml` の合算。

### 外部言及・記事

Zenn 公開記事（YouTom 派生・関連）:

| 記事 | 公開日 | 状態 |
|------|--------|------|
| YouTube Data APIのクォータ枯渇をRSSで99%削減した話 | 2026-05-10 | 公開（READMEから直接リンク済み） |
| その他関連記事 | 2026-04〜05 | Zenn 実サイト 200 確認済み 8本 / 403 が 3本（My-Skill-Graph goals 参照） |

外部メディア（Qiita / Hatena / X 等）からの言及: **0 件**（確認できる範囲で）

### コミュニティ活動

- 外部コントリビューターからの PR: 0
- ユーザーフィードバック由来の Issue: 0
- X（旧Twitter）でのリリース告知投稿: 各バージョンで実施（具体的なエンゲージメント数は未集計）

---

## SignPath 再申請の判断閾値

以下のいずれか1つを満たした段階で再申請を検討する。重み付き判断とし、複数満たせばより通過しやすい。

### Tier A: 単独で再申請理由になる強シグナル

- [ ] **Star 数 10 以上** — 外部認知の明確な証拠
- [ ] **外部からの Issue または PR が 3件以上** — 利用者が実在し関与している証拠
- [ ] **第三者の技術メディアでの言及** — Qiita / Zenn の他者記事、Hatena Bookmark 100usr 以上など

### Tier B: 複数組み合わせで再申請理由になるシグナル

- [ ] 累計 DL **500 件以上**（現在 約282）
- [ ] 単一リリースの DL **100 件以上**（現在の最大は 52）
- [ ] Zenn 公開記事 **15本以上**（現在 8〜11本）
- [ ] X でのリリース告知に外部からの反応（いいね10以上 / リポスト3以上）が継続的に発生

→ Tier B から 2つ以上満たせば再申請に値する。

### 再申請しない判断基準

以下が継続するなら、信頼シグナルが本質的に積み上がっていないため再申請しても通らない可能性が高い:

- 90日経過しても Star が 1桁前半
- DL 数が線形に伸びず、リリース直後のスパイクのみ
- 外部からの反応が一切ない

→ この場合は記事 / SNS / 技術コミュニティでの露出を先に増やす。

---

## 再申請までの導線

### 短期（直近1〜2ヶ月）

1. **Zenn / Qiita 記事の継続投稿** — Open Issue で起票済み。My-Skill-Graph の記事候補ショートリスト（候補S〜W）から週1ペースで投稿
2. **記事内で Youtom への導線を貼る** — クォータ削減記事は既にリンク済み。他の記事でも適切な場面で言及
3. **X でのリリース告知強化** — `release-checklist.md` に従って毎回投稿（既存運用）

### 中期（2〜3ヶ月後）

4. **Tier B 指標の自然増加を待つ**
5. 累計 DL / 記事数 / Star 数 を月次でこのファイルに追記

### 再申請時にやること

- このファイルの最新版を申請理由書として添付できるよう整理
- 過去の申請 ID / 不承認理由（手元に保存があれば）を参照
- SignPath Foundation の最新応募要件（[公式ページ](https://signpath.io/solutions/open-source-community)）を再確認 — 要件は更新される可能性がある

---

## 信頼シグナル定期計測コマンド

PowerShell で `gh` CLI から再取得する場合:

```powershell
gh repo view harness17/youtube-schedule --json stargazerCount,forkCount,createdAt,watchers
gh issue list --repo harness17/youtube-schedule --state all
gh api repos/harness17/youtube-schedule/releases --jq '.[] | {tag: .tag_name, published_at: .published_at, downloads: ([.assets[].download_count] | add)}'
```

累計 DL は出力の `downloads` を合算する。

---

## 関連

- [README コード署名セクション](../README.md#コード署名)
- [.github/signpath-setup.md](../.github/signpath-setup.md) — workflow 側の設定手順
- [.github/workflows/release.yml](../.github/workflows/release.yml) — `Sign with SignPath` ステップ（現在は環境変数未設定でスキップ）
