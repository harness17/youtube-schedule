# YouTube Schedule Viewer

YouTube の登録チャンネルの配信予定・ライブ中の動画を一覧表示する Windows デスクトップアプリです。
Youtubeが日時順にもならなくて一覧性がカスなのにキレて作りました。

![スクリーンショット](https://github.com/harness17/youtube-schedule/releases/download/v1.3.0/screenshot.png)

## 機能

- 登録チャンネルの配信予定・ライブ中の動画を日付グループで一覧表示
- ライブ中の配信を最上部に表示（赤枠ハイライト）
- **メンバーシップ限定配信の取得**（⚙️ ボタンからチャンネルを登録）
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

## メンバーシップ限定配信について

YouTube RSS フィードにはメンバーシップ限定動画が含まれないため、専用の設定が必要です。

### 設定方法

1. アプリのヘッダーにある **⚙️ ボタン** をクリックする
2. 取得したいチャンネルの URL / チャンネル ID / `@ハンドル` を入力して「追加」する
3. チャンネル名が自動解決されリストに追加される

**入力例：**

```
https://www.youtube.com/@patra_ch
@patra_ch
UCxxxxxxxxxxxxxxxxxxxxxxxxx
```

### API クォータについて

メンバーシップ限定配信の取得には YouTube Data API の `search.list`（100 ユニット/チャンネル）を使用します。クォータ超過を防ぐため以下の制限があります。

| 更新タイミング     | 内容                      | 消費                |
| ------------------ | ------------------------- | ------------------- |
| 自動（2 時間ごと） | 配信予定のみ取得          | 100 ユニット × 件数 |
| 手動「更新」ボタン | 配信予定 + ライブ中を取得 | 200 ユニット × 件数 |

- **登録上限: 4 チャンネル**（4 件 × 自動 12 回/日 = 4,800 ユニット/日。手動更新分も含めて 1 日 10,000 ユニットの無料枠に収まる計算）
- 通常チャンネルは引き続き RSS フィード（クォータ消費ゼロ）で取得します

---

## 注意事項

- YouTube の閲覧専用スコープ（`youtube.readonly`）のみを使用します
- 通常チャンネルの取得には、YouTube が公式に提供している RSS フィード (`/feeds/videos.xml`) を使用します。YouTube Data API のクォータは消費しません
- メンバーシップ限定配信の取得のみ YouTube Data API（`search.list`）を使用します
- `credentials.json` と `token.json` は絶対にリポジトリにコミットしないでください

---

## ライセンス（主要依存ライブラリ）

| ライブラリ                                                                | ライセンス | 用途                          |
| ------------------------------------------------------------------------- | ---------- | ----------------------------- |
| [Electron](https://www.electronjs.org/)                                   | MIT        | デスクトップアプリ基盤        |
| [React](https://react.dev/)                                               | MIT        | UI フレームワーク             |
| [electron-vite](https://electron-vite.org/)                               | MIT        | ビルドツール                  |
| [googleapis](https://github.com/googleapis/google-api-nodejs-client)      | Apache-2.0 | YouTube Data API クライアント |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | MIT        | RSS XML パーサー              |
| [electron-store](https://github.com/sindresorhus/electron-store)          | MIT        | 設定・キャッシュ永続化        |
| [electron-updater](https://www.electron.build/auto-update)                | MIT        | 自動アップデート              |

Apache-2.0 ライセンスの `googleapis` を含みますが、本アプリはオープンソースでの配布を行うため利用条件を満たしています。
