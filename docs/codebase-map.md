# コードベースマップ — 開発者ガイド

> spec.md が「何を作るか」を定義するのに対し、このドキュメントは「どこに何があるか・どう動くか」を説明する。

---

## ディレクトリ構成（クイックリファレンス）

```
src/
├── main/                    ← Node.js プロセス（ファイル・DB・API アクセス）
│   ├── index.js             ← エントリ。DB 初期化・IPC ハンドラー登録・ウィンドウ生成
│   ├── store.js             ← electron-store（設定値の永続化）
│   ├── logger.js            ← winston ロガー設定
│   ├── auth.js              ← OAuth 2.0 認証フロー（PKCE + ローカルサーバー）
│   ├── ipc/                 ← IPC ハンドラー（機能別に分割）
│   │   ├── authHandlers.js      auth:check / auth:login / auth:logout
│   │   ├── videoHandlers.js     videos:* / schedule:* / channels:* / diag:*
│   │   ├── settingsHandlers.js  settings:* / favorites:*
│   │   └── appHandlers.js       app:* / shell:* / notification:* / updater:*
│   ├── db/                  ← SQLite 層
│   │   ├── connection.js        better-sqlite3 接続シングルトン
│   │   ├── schema.js            CREATE TABLE 定義
│   │   ├── migrate.js           マイグレーションランナー
│   │   └── migrations/          001_initial.js … 004_notify.js
│   ├── repositories/        ← DB 操作（SQL を隠蔽）
│   │   ├── videoRepository.js   動画の CRUD・FTS・ページング
│   │   ├── channelRepository.js チャンネルの CRUD・ピン管理
│   │   ├── metaRepository.js    cleanup 実行日時などのメタデータ
│   │   └── rssFetchLogRepository.js RSS 取得ログ
│   ├── fetchers/            ← 外部データ取得
│   │   ├── rssFetcher.js        YouTube RSS（0 クォータ）
│   │   ├── subscriptionsFetcher.js  登録チャンネル一覧（24h キャッシュ）
│   │   ├── playlistItemsFetcher.js  動画一覧（RSS 失敗時のフォールバック）
│   │   └── videoDetailsFetcher.js   個別動画詳細（orphan live 検出用）
│   └── services/
│       ├── schedulerService.js  30 分ポーリング・フェーズ別取得オーケストレーション
│       ├── videoStatus.js       upcoming / live / ended ステータス判定ロジック
│       └── settingsPorter.js    設定・お気に入りの JSON エクスポート/インポート
│
├── preload/
│   └── index.js             ← contextBridge で window.api を Renderer に公開
│
└── renderer/
    ├── src/
    │   ├── App.jsx          ← ルートコンポーネント。タブ表示・フィルター UI
    │   └── main.jsx         ← ReactDOM.render エントリ
    ├── hooks/
    │   ├── useAuth.js           認証状態管理（checkAuth → login → refresh）
    │   ├── useDarkMode.js       ダークモード（electron-store 永続化）
    │   ├── useSchedule.js       schedule:get / schedule:updated 受信
    │   ├── useTabState.js       タブ別データ・検索・チャンネルフィルター
    │   └── useNotificationCheck.js  配信前 60s ポーリング通知
    └── components/
        ├── ScheduleCard.jsx     動画カード（⭐/🔔/✓/📌 ボタン付き）
        ├── ScheduleList.jsx     予定・ライブタブの日付グループ一覧
        ├── SettingsModal.jsx    設定モーダル（基本 / チャンネル / データ管理）
        ├── AuthScreen.jsx       未ログイン画面
        ├── CredentialsSetupScreen.jsx  credentials.json 未配置案内
        ├── StatusBanners.jsx    DBエラー・オフラインバナー
        ├── Toast.jsx            トースト通知
        ├── UpdateBanner.jsx     自動更新バナー
        ├── BackToTop.jsx        トップへ戻るボタン
        └── ErrorBoundary.jsx    React エラー境界
```

---

## プロセス間通信（IPC）全一覧

Renderer から呼ぶ API は `window.api.*`（preload/index.js で定義）。

| window.api メソッド     | IPC チャンネル           | ハンドラー       |
| ----------------------- | ------------------------ | ---------------- |
| `checkAuth()`           | `auth:check`             | authHandlers     |
| `login()`               | `auth:login`             | authHandlers     |
| `logout()`              | `auth:logout`            | authHandlers     |
| `getSchedule()`         | `schedule:get`           | videoHandlers    |
| `refreshSchedule()`     | `schedule:refresh`       | videoHandlers    |
| `listMissed()`          | `videos:listMissed`      | videoHandlers    |
| `listArchive(opts)`     | `videos:listArchive`     | videoHandlers    |
| `listFavorites()`       | `videos:listFavorites`   | videoHandlers    |
| `searchByText(q, opts)` | `videos:searchByText`    | videoHandlers    |
| `markViewed(id)`        | `videos:markViewed`      | videoHandlers    |
| `clearViewed(id)`       | `videos:clearViewed`     | videoHandlers    |
| `toggleFavorite(id)`    | `videos:toggleFavorite`  | videoHandlers    |
| `toggleNotify(id)`      | `videos:toggleNotify`    | videoHandlers    |
| `togglePin(id)`         | `channels:togglePin`     | videoHandlers    |
| `listAllChannels()`     | `channels:listAll`       | videoHandlers    |
| `getSetting(key)`       | `settings:get`           | settingsHandlers |
| `setSetting(key, val)`  | `settings:set`           | settingsHandlers |
| `exportSettings()`      | `settings:export`        | settingsHandlers |
| `importSettings()`      | `settings:import`        | settingsHandlers |
| `exportFavorites()`     | `favorites:export`       | settingsHandlers |
| `importFavorites()`     | `favorites:import`       | settingsHandlers |
| `openExternal(url)`     | `shell:openExternal`     | appHandlers      |
| `getVersion()`          | `app:version`            | appHandlers      |
| `quitAndInstall()`      | `updater:quitAndInstall` | appHandlers      |
| `checkUpdateNow()`      | `updater:checkNow`       | appHandlers      |
| `getRssFailureRate()`   | `diag:rssFailureRate`    | videoHandlers    |
| `resetDatabase()`       | `schedule:resetDatabase` | videoHandlers    |

**Push イベント（Main → Renderer）:**

| ipcRenderer.on イベント     | 発火タイミング                     |
| --------------------------- | ---------------------------------- |
| `schedule:updated`          | schedulerService の refresh 完了後 |
| `updater:update-available`  | 新バージョン検出                   |
| `updater:update-downloaded` | ダウンロード完了                   |
| `updater:error`             | アップデーターエラー               |

---

## データフロー

### 起動時の初期化シーケンス

```
main/index.js
  └─ db/migrate.js          DB マイグレーション（001〜004）
  └─ IPC ハンドラー登録（ipc/*.js）
  └─ BrowserWindow 生成

Renderer 起動
  └─ useAuth.checkAuth()    → ログイン済み？
      Yes → useSchedule.getSchedule()  → DB から live/upcoming 取得
           useTabState.loadAllDbChannels()  → ピン済みチャンネル取得
           useTabState（missed バッジ）→ listMissed()
      No  → AuthScreen 表示
```

### スケジュール更新フロー（30 分ポーリング）

```
schedulerService.refresh()
  ├─ subscriptionsFetcher（24h キャッシュ）→ チャンネル一覧
  ├─ rssFetcher（0 クォータ）→ 各チャンネルの配信 RSS
  │   └─ 失敗時 playlistItemsFetcher（フォールバック）
  ├─ videoRepository.upsert()  → DB に保存
  ├─ orphan live 検出 → videoDetailsFetcher → markEnded()
  ├─ cleanup（24h ごと）→ 30日/90日 保持ポリシーで削除
  └─ ipcMain.emit('schedule:updated')
       └─ useSchedule の onScheduleUpdated コールバック
            └─ getSchedule() → live/upcoming を再取得して useState 更新
```

### ユーザー操作（例：⭐ タップ）のフロー

```
ScheduleCard onToggleFavorite(id)
  └─ useTabState.handleToggleFavorite(id)
      └─ window.api.toggleFavorite(id)   ← IPC
          └─ videoHandlers → videoRepository.toggleFavorite(id)
      ← newVal（0 or 1）返却
      └─ updateVideo(id, { isFavorite: newVal })   ← useSchedule の live/upcoming 更新
      └─ setMissedVideos / setArchiveVideos / setFavoriteVideos  ← 各タブを同期
```

---

## State 管理マップ

| 状態               | 持ち主      | 更新タイミング                                     |
| ------------------ | ----------- | -------------------------------------------------- |
| `live`, `upcoming` | useSchedule | 起動時・schedule:updated イベント                  |
| `isAuthenticated`  | useAuth     | checkAuth / login / logout                         |
| `darkMode`         | useDarkMode | SettingsModal の toggle                            |
| `activeTab`        | useTabState | タブバークリック                                   |
| `selectedChannel`  | useTabState | ドロップダウン変更（タブ切替でもリセットしない）   |
| `searchQuery`      | useTabState | 検索ボックス入力                                   |
| `missedVideos`     | useTabState | missed タブ切替・handleMarkViewed                  |
| `archiveVideos`    | useTabState | archive タブ切替・IntersectionObserver             |
| `favoriteVideos`   | useTabState | favorites タブ切替・handleToggleFavorite           |
| `pinnedChannelIds` | useTabState | 初回マウント・handleTogglePin                      |
| `allDbChannels`    | useTabState | loadAllDbChannels（起動時 / SettingsModal 変更後） |

---

## タブ別データ取得戦略

| タブ         | データソース                       | 取得タイミング          | フィルター方式                                   |
| ------------ | ---------------------------------- | ----------------------- | ------------------------------------------------ |
| 予定・ライブ | useSchedule の live/upcoming       | schedule:updated push   | フロントエンド（useMemo）                        |
| 見逃し       | `videos:listMissed`                | タブ切替・markViewed 後 | フロントエンド（useMemo）                        |
| アーカイブ   | `videos:listArchive`（ページング） | タブ切替・スクロール    | チャンネル=フロント / キーワード=FTS5 サーバー側 |
| お気に入り   | `videos:listFavorites`             | タブ切替                | フロントエンド（useMemo）                        |

**アーカイブの検索は FTS5（SQLite 全文検索）をサーバー側で実行する唯一のタブ。**
他タブはすべてフロントエンドの useMemo でフィルタリングする。

---

## お気に入りタブのセクション分類ロジック

```
filteredFavorites
  ├─ 📅 未配信  status === 'upcoming' | 'live'  && viewedAt == null
  ├─ 📋 通常    status === 'ended'               && viewedAt == null
  └─ ✅ 視聴済み viewedAt != null（ステータス問わず）
```

✓ ボタン（`showViewedButton={true}`）は全セクションのカードに表示される。

- 未視聴カードの ✓ → `markViewed(id)` → 視聴済みセクションへ移動
- 視聴済みカードの ✓ 済 → `clearViewed(id)` → 通常セクションへ移動

---

## チャンネルフィルター挙動

`selectedChannel` はタブ切替時にリセットしない（`useTabState.js` 参照）。

タブのデータに選択チャンネルがない場合、`tabChannels` useMemo が `allDbChannels` から補完してドロップダウンに残す。フィルター結果が 0 件の場合は「このチャンネルの配信はありません」を表示する。

---

## DB スキーマ概要（migration 別）

| migration    | 追加内容                                                            |
| ------------ | ------------------------------------------------------------------- |
| 001_initial  | videos・channels テーブル基本形                                     |
| 002_rss_log  | rss_fetch_log テーブル（RSS 取得記録）                              |
| 003_features | viewed_at / is_favorite / ended_at / is_pinned / videos_fts（FTS5） |
| 004_notify   | videos.notify フラグ（見逃しタブ用）                                |

**保持ポリシー（cleanup は 24h ごと）:**

```
is_favorite = 1  →  永久保持
notify = 1 AND viewed_at IS NULL  →  90 日保持
それ以外  →  30 日保持
```

---

## よくある作業パターン

### 新しいボタン/フラグを動画カードに追加する

1. `db/migrations/` に新マイグレーションファイルを追加
2. `videoRepository.js` に取得・更新クエリを追加
3. `videoHandlers.js` に IPC ハンドラーを追加
4. `preload/index.js` に `window.api.xxx` を追加
5. `useTabState.js` のパッチ関数（handleToggleFavorite 等を参考）に追加
6. `ScheduleCard.jsx` に prop と表示ロジックを追加
7. `App.jsx` の `renderTabCard` に prop を渡す

### 新しいタブを追加する

1. `App.jsx` のタブバー配列に `{ key, label }` を追加
2. `useTabState.js` に state・fetchFn・filteredXxx を追加
3. `useTabState.js` の `tabChannels` useMemo の `source` 分岐に追加
4. `App.jsx` に `{activeTab === 'xxx' && ...}` のレンダリングブロックを追加
5. `videoHandlers.js` / `videoRepository.js` に対応 SQL を追加

### IPC を新規追加する

1. `main/ipc/xxxHandlers.js` にハンドラーを追加
2. `main/index.js` で `xxxHandlers(ipcMain, db)` を呼ぶ
3. `preload/index.js` の contextBridge に追加
4. Renderer から `window.api.xxx()` で呼ぶ
