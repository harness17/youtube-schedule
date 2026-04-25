# SignPath.io コード署名 — セットアップ手順

SignPath.io の OSS 無料プランを使って Windows インストーラーにコード署名する手順です。  
署名済みになると SmartScreen の「Windows によって PC が保護されました」警告が出なくなります。

---

## 1. OSSプランを申請する

1. https://about.signpath.io/product/open-source にアクセス
2. 「Apply for free」をクリックして申請フォームを送信
   - GitHub リポジトリ URL: `https://github.com/harness17/youtube-schedule`
   - OSS ライセンスがある公開リポジトリであれば審査通過しやすい
3. 数日以内にメールで承認通知が届く

---

## 2. SignPath でプロジェクトを作成する

承認後、SignPath の管理画面で以下を設定する。

### Organization ID を確認する
- 管理画面右上のアカウント名 → **Organization Settings**
- `Organization ID` をメモしておく（後で GitHub Secret に登録する）

### Project を作成する
- **Projects → New Project**
- Project Slug: `youtube-schedule`

### Artifact Configuration を作成する
- プロジェクト内の **Artifact Configurations → New**
- Slug: `installer`
- Type: `Windows Installer (MSI/NSIS)`
- 対象ファイルのパス: `*.exe`

### Signing Policy を作成する
- **Signing Policies → New**
- Slug: `release-signing`
- Certificate: SignPath が発行した OV 証明書を選択
- Allowed Origin: **GitHub Actions** を選択してリポジトリ URL を登録

---

## 3. GitHub Secrets を設定する

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** から以下を追加する。

| Secret 名 | 値 |
|-----------|-----|
| `SIGNPATH_API_TOKEN` | SignPath 管理画面の **CI User → API Token** から取得 |
| `SIGNPATH_ORGANIZATION_ID` | 手順 2 でメモした Organization ID |

---

## 4. 動作確認

1. 新しいタグをプッシュして Release ワークフローを起動する
2. GitHub Actions のログで `Sign with SignPath` ステップが実行されることを確認
3. SignPath 管理画面の **Signing Requests** に新しいリクエストが届くのを確認
4. GitHub Releases にアップロードされた `.exe` をダウンロードしてインストール
5. SmartScreen 警告が出ないことを確認

---

## トラブルシューティング

**`Sign with SignPath` ステップがスキップされる**  
→ `SIGNPATH_API_TOKEN` または `SIGNPATH_ORGANIZATION_ID` が GitHub Secrets に未登録。

**SignPath でリクエストが Rejected になる**  
→ Signing Policy の `Allowed Origin` にリポジトリが登録されていないか、CI User に権限がない。  
→ SignPath の Signing Policy 設定を見直す。

**署名後も SmartScreen が出る**  
→ OV 証明書では初回は出ることがある。ダウンロード数が増えると消える（評判スコアが蓄積されるため）。  
→ 即時解消したい場合は EV 証明書が必要（有料・年 3〜5 万円）。
