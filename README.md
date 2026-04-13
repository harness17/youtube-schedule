# YouTube Schedule Viewer

YouTube の登録チャンネルの配信予定・ライブ中の動画を一覧表示する Windows デスクトップアプリです。
Youtubeが日時順にもならなくて一覧性がカスなのにキレて作りました。

![スクリーンショット](https://github.com/harness17/youtube-schedule/releases/download/v1.3.0/screenshot.png)

## 機能

- 登録チャンネルの配信予定・ライブ中の動画を日付グループで一覧表示
- ライブ中の配信を最上部に表示（赤枠ハイライト）
- 配信開始 5 分前のデスクトップ通知
- タイトル・チャンネル名での検索、チャンネルフィルター
- ダークモード対応
- 自動アップデート（新バージョンが出るとアプリ内バナーで通知）

---

## インストーラー版を使う（推奨）

### 1. インストーラーをダウンロードする

[Releases](https://github.com/harness17/youtube-schedule/releases) から最新の `youtube-schedule-X.X.X-setup.exe` をダウンロードして実行します。

> Node.js は不要です。

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
npm run lint           # ESLint チェック
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

## 注意事項

- YouTube の閲覧専用スコープ（`youtube.readonly`）のみを使用します
- API クォータを節約するため、RSS フィードを優先して使用します
- `credentials.json` と `token.json` は絶対にリポジトリにコミットしないでください
