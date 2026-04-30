# YouTube Schedule Viewer

YouTube の登録チャンネルの配信予定・ライブ中の動画を一覧表示する Windows デスクトップアプリです。
Youtubeが日時順にもならなくて一覧性がカスなのにキレて作りました。

![スクリーンショット](https://github.com/harness17/youtube-schedule/releases/download/v1.9.0/screenshot.png)

## 機能

### 予定・ライブ

- 登録チャンネルの配信予定・ライブ中の動画を日付グループで一覧表示
- ライブ中の配信を最上部に表示（赤枠ハイライト）
- 🔔 お知らせ登録 — 気になる配信にフラグを立てると終了後に「見逃し」タブへ自動移動。登録した配信は一覧の先頭に表示 + オレンジ左ボーダーで強調
- ⭐ お気に入り登録 — 登録した配信は一覧の先頭に表示 + オレンジ左ボーダーで強調
- 📌 チャンネル推し設定 — カード上に📌ボタンを常時表示、推し中はゴールドボーダー＋チャンネル名を強調表示して一覧の先頭に
- チャンネル管理モーダル — チャンネル一覧をまとめて検索・推し設定
- チャンネル名クリックで YouTube のチャンネルページを開く
- 配信開始 5 分前のデスクトップ通知（お知らせ登録した配信のみ）
- タイトル・チャンネル名での検索、チャンネルフィルター（タブ切り替え時に選択を維持）
- **チャンネル自動蓄積** — 登録チャンネル以外の動画でも、一度表示されたチャンネルは次回から自動的に取得対象に追加

### 見逃し・アーカイブ

- **見逃しタブ** — お知らせ登録した配信のうち未視聴のものを一覧表示。✓ で視聴済みマーク（お知らせ動画は 90 日間保持）。起動直後からタブバッジに件数表示
- **アーカイブタブ** — 過去配信の全件一覧 + タイトル・チャンネル名・説明文の部分一致検索（日本語対応）・無限スクロール。チャンネルフィルターは登録済み全チャンネルを表示
- **お気に入りタブ** — ⭐ した動画を期限なく保持。未配信（配信予定/ライブ中）・通常（終了済み未視聴）・視聴済みの 3 セクションに自動分類。タブ横のナビボタンで各セクションへジャンプ（その他の過去配信は 30 日で自動削除）
- 視聴済み動画をアーカイブ・お気に入りタブで薄く表示（既読バッジ）

### 設定（⚙️ ボタン）

- **⚙️ 基本タブ** — ダークモード切り替え・自動アップデートの確認・ログアウト
- **📌 チャンネルタブ** — チャンネル一覧の検索・推し設定（設定モーダルに統合）
- **📦 データ管理タブ** — 設定（優先チャンネル＋テーマ）のエクスポート・インポート、お気に入り（viewedAt含む）のエクスポート・インポート

### その他

- ダークモード対応（デザインシステムによるテーマ切り替え）
- ライブ配信カードの点滅アニメーション
- 自動アップデート（新バージョンが出るとアプリ内バナーで通知）

---

## インストーラー版を使う（推奨）

### 1. インストーラーをダウンロードする

[Releases](https://github.com/harness17/youtube-schedule/releases) から最新の `youtube-schedule-X.X.X-setup.exe` をダウンロードして実行します。

> Node.js は不要です。

> #### ⚠️ Windows セキュリティの警告が出た場合
>
> インストール時に「**Windows によって PC が保護されました**」と表示されることがあります。
> これはコード署名証明書のないアプリに表示される一般的な警告で、ウイルスではありません。
>
> **回避手順：**
>
> 1. 「**詳細情報**」をクリック
> 2. 「**実行**」ボタンをクリック
>
> ※ コード署名（SignPath.io）の導入作業中です。将来のバージョンでは警告が出なくなる予定です。

### 2. OAuth 認証情報を取得する

このアプリは YouTube Data API を使うため、自分用の OAuth クライアントが必要です。

1. [Google Cloud Console](https://console.cloud.google.com/) で新しいプロジェクトを作成する
2. **API とサービス → ライブラリ** から「YouTube Data API v3」を有効にする
3. **API とサービス → 認証情報 → 認証情報を作成 → OAuth クライアント ID** を選択する
4. OAuth 同意画面の設定：
   - ユーザーの種類：**外部**
   - アプリ名・メールアドレスを入力
   - スコープに `youtube.readonly` を追加
   - テストユーザーに自分の Google アカウントを追加
5. アプリケーションの種類：**デスクトップアプリ** を選択してクライアントを作成する
6. **JSON をダウンロード** し、ファイル名を `credentials.json` に変更する

### 3. credentials.json を配置する

ダウンロードした `credentials.json` を以下のフォルダに配置します。

```
C:\Users\<ユーザー名>\AppData\Roaming\youtube-schedule\credentials.json
```

> **ヒント：** アプリを起動すると案内画面が表示され、「フォルダを開く」ボタンでエクスプローラーから直接配置できます。

### 4. アプリを起動する

アプリを起動するとブラウザで Google 認証画面が開きます。自分の Google アカウントでログインして「許可」すると、以降は自動でログイン状態が維持されます。

---

## ソースからセットアップ（開発者向け）

### 1. リポジトリをクローン

```bash
git clone https://github.com/harness17/youtube-schedule.git
cd youtube-schedule
npm install
```

### 2. credentials.json を取得して配置する

上記「OAuth 認証情報を取得する」の手順で `credentials.json` を取得し、プロジェクトのルートに配置します。

```
youtube-schedule/
├── credentials.json   ← ここに配置
├── src/
└── ...
```

> `credentials.json` は `.gitignore` に含まれているため、誤ってコミットされることはありません。

### 3. アプリを起動する

```bash
npm run dev
```

---

## 開発コマンド

```bash
npm run dev            # 開発サーバー起動
npm run lint           # ESLint チェック（warning も 0 件必須）
npm run test           # テスト実行
npm run test:coverage  # カバレッジ付きテスト実行
npm run build:win      # Windows 向けパッケージング
```

---

## 技術スタック

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [electron-vite](https://electron-vite.org/)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)

## コード署名

このプロジェクトのリリースバイナリは [SignPath Foundation](https://signpath.io/solutions/open-source-community) によるコード署名を使用しています。

[![Signed by SignPath Foundation](https://signpath.io/assets/favicon-50x50.png)](https://signpath.io/solutions/open-source-community)

## 注意事項

- YouTube の閲覧専用スコープ（`youtube.readonly`）のみを使用します
- API クォータを節約するため、RSS フィードを優先して使用します
- `credentials.json` と `token.json` は絶対にリポジトリにコミットしないでください
