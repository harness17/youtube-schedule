# YouTube Schedule Viewer

YouTube の登録チャンネルの配信予定・ライブ中の動画を一覧表示する Electron デスクトップアプリです。

## 動作要件

- Node.js 20 以上
- Google アカウント（YouTube を使用しているもの）

## セットアップ

### 1. リポジトリをクローン

```bash
git clone <repo-url>
cd youtube-schedule
npm install
```

### 2. Google Cloud で OAuth 認証情報を取得

このアプリは YouTube Data API を使用するため、自分用の OAuth クライアントを作成する必要があります。

#### 手順

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、新しいプロジェクトを作成する

2. **API とサービス** → **ライブラリ** から「YouTube Data API v3」を有効にする

3. **API とサービス** → **認証情報** → **認証情報を作成** → **OAuth クライアント ID** を選択する

4. OAuth 同意画面の設定を求められたら以下を設定する：
   - ユーザーの種類：**外部**
   - アプリ名・メールアドレスを入力
   - スコープに `youtube.readonly` を追加
   - テストユーザーに自分の Google アカウントを追加

5. アプリケーションの種類：**デスクトップアプリ** を選択してクライアントを作成する

6. **JSON をダウンロード** して、ファイル名を `credentials.json` に変更する

7. `credentials.json` をプロジェクトのルートに配置する

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

初回起動時にブラウザで Google 認証画面が開きます。自分の Google アカウントでログインして「許可」すると、以降は自動でログイン状態が維持されます。

---

## 開発

```bash
npm run dev          # 開発サーバー起動
npm run lint         # ESLint チェック
npm run test         # テスト実行
npm run test:coverage  # カバレッジ付きテスト実行
```

## ビルド

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

ビルドした実行ファイルの隣に `credentials.json` を配置すれば動作します。

## 技術スタック

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [electron-vite](https://electron-vite.org/)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)

## 注意事項

- このアプリは YouTube の閲覧専用スコープ（`youtube.readonly`）のみを使用します
- API クォータを節約するため、RSS フィードを優先して使用します
- `credentials.json` と `token.json` は絶対にリポジトリにコミットしないでください
