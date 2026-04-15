# アーキテクチャ概要

> このファイルを読めば `src/main/` の主要ファイルを読み直さずに実装の全体像を把握できる。

---

## ファイル責務マップ

| ファイル | 責務 |
|---------|------|
| `src/main/index.js` | IPC ハンドラー定義・AutoUpdater・ウィンドウ管理 |
| `src/main/store.js` | electron-store ラッパー。キャッシュ・設定・メンバーシップ永続化 |
| `src/main/youtube-api.js` | YouTube Data API v3 / RSS フェッチ。純粋関数のみ |
| `src/main/auth.js` | OAuth 2.0 認証フロー・token.json 管理 |
| `src/preload/index.js` | contextBridge で Renderer に API を公開 |
| `src/renderer/hooks/useSchedule.js` | スケジュールデータの取得・状態管理 React Hook |
| `src/renderer/src/App.jsx` | タイマー制御・手動更新ハンドラー |

---

## IPC ハンドラー一覧

| チャネル | 呼び出し元 | 処理内容 |
|---------|-----------|---------|
| `schedule:get` | 初回ロード（useEffect） | RSS キャッシュ優先。期限切れなら RSS 再取得 |
| `schedule:refresh` | 10分自動タイマー | RSS 強制再取得。メンバーシップはキャッシュ使用 |
| `membership:refresh` | 2時間自動タイマー / 手動更新ボタン | メンバーシップ強制再取得。RSS はキャッシュ使用 |
| `auth:check` | 起動時 | credentials.json 存在確認 + token 有効性確認 |
| `auth:login` | 認証画面 | OAuth ブラウザフロー開始 |
| `auth:logout` | 設定画面 | token.json 削除 |
| `membership:getChannels` | 設定画面 | 登録済みメンバーシップチャンネル一覧 |
| `membership:setChannels` | 設定画面 | 登録チャンネルを保存 |
| `membership:resolveChannel` | 設定画面 | URL/@ハンドル → channelId 解決 |
| `settings:get` / `settings:set` | 各コンポーネント | ダークモード等の設定値 |
| `shell:openExternal` | リンククリック | 外部ブラウザで URL を開く |
| `shell:openFolder` | 設定画面 | credentials フォルダをエクスプローラーで開く |
| `app:version` | ヘッダー | package.json のバージョン文字列 |
| `updater:quitAndInstall` | アップデートバナー | 再起動してアップデート適用 |
| `notification:show` | App.jsx | デスクトップ通知 |

---

## キャッシュ設計

### 保存形式（electron-store）

```
scheduleCache    : { data: { live, upcoming }, timestamp }  ← RSS スケジュール
membershipCache  : { data: { live, upcoming }, timestamp }  ← メンバーシップスケジュール
membershipWatchPool : string[]                              ← 追跡中の動画ID
membershipChannels  : [{ channelId, channelTitle }]        ← 登録チャンネル
settings.*          : 各種設定値（ダークモード等）
```

### TTL

- RSS・メンバーシップ共通: **2時間**（`CACHE_TTL_MS = 2 * 60 * 60 * 1000`）
- `getCache()` ← TTL チェック済み。期限切れなら null
- `getMembershipCacheData()` ← TTL チェック済み。期限切れなら null
- `getMembershipCache()` ← 生エントリ返却（TTL チェックなし。membership:refresh 内部専用）

### `schedule:get` のキャッシュ判定ロジック（重要）

```
rssCache = getCache()              // null なら期限切れ
memCacheData = getMembershipCacheData()  // null なら期限切れ

if (rssCache !== null) → キャッシュ返却（RSS が有効な間は API 呼ばない）
else                  → RSS 再取得（メンバーシップキャッシュが残っていても RSS は再取得する）
```

**注意:** 旧実装は `if (rssCache || memCacheEntry)` で判定していたため、
RSS が期限切れでもメンバーシップキャッシュが残っていると RSS を再取得せず
`mergeSchedules(null, memData)` になり表示が激減するバグがあった。

---

## データ取得フロー

### 通常スケジュール（RSS ファースト）

```
subscriptions.list → [channelId × N]
  └─ RSS feed (parallel, 5s timeout each) → videoId[]
       └─ videos.list (batch 50) → { live[], upcoming[] }
```

クォータ消費: `~4 (subscriptions) + 0 (RSS) + N/50 (videos.list)` ≒ 36ユニット

### メンバーシップスケジュール（発見 + 追跡）

```
発見フェーズ: search.list(upcoming, per channel) → 新規IDを membershipWatchPool に追加
追跡フェーズ: videos.list(watchPool全件) → 状態判定
  actualStartTime あり + actualEndTime なし → live
  scheduledStartTime > now               → upcoming
  actualEndTime あり / 6時間超過の未開始  → プールから削除
```

クォータ消費: `100 × チャンネル数（発見）+ N/50（追跡）` ≒ 400ユニット（4ch）

### 手動更新フロー（`handleFullRefresh` in App.jsx）

```
schedule:refresh（RSS 強制取得）
  └─ membership:refresh（メンバーシップ強制取得、includeLive: true）
       └─ mergeSchedules(rssData, memData) → UI 反映
```

---

## mergeSchedules の動作

```js
// 重複動画IDは後勝ち（メンバーシップ側が上書き）
liveMap = new Map([...rss.live, ...mem.live])
upcomingMap = new Map([...rss.upcoming, ...mem.upcoming])
// upcoming は scheduledStartTime 昇順にソート
```

---

## クォータ設計

| 更新種別 | 間隔 | 消費量 |
|---------|------|-------|
| 自動 RSS | 10分 | ~36ユニット |
| 自動メンバーシップ | 2時間 | ~402ユニット（4ch） |
| 手動更新 | ユーザー操作 | ~438ユニット |

日次最大（理論値）: 36×144 + 402×12 ≒ 10,008 → 手動更新を含めると超過リスクあり。
→ クォータ超過（403）は `error: 'QUOTA_EXCEEDED'` を返し UI に永続バナーを表示。

---

## 認証ファイルのパス

- `credentials.json` / `token.json`: `app.getPath('userData')` = `%APPDATA%\youtube-schedule\`
- アップデート時に消えない設計（`resources/` 配下ではなく userData）
