# Phase B: テストカバレッジ拡充（安全網）

作成日: 2026-05-27
対象リリース: v1.21.0
担当: Codex（実装）／ Claude Code（設計・レビュー）
親ロードマップ: `2026-05-27-debt-repayment-roadmap.md`

## Why

Phase C/A の大規模リファクタを安心して進めるための **安全網** を作る。現状 YouTom は IPC 層と auth.js の自動検証が薄く、リファクタ後の regression を手動「動作確認」で担保している。テストが揃えば `npm run test` だけで構造的な壊れを検出できる。

## Goal（構造カバレッジ）

1. 全 IPC channel に最低 1 件のテストが存在する（既存 playlist/openFolder 以外を網羅）
2. `src/main/auth.js` の全公開関数に最低 1 件のテストが存在する（`startAuthFlow` 含む）

達成判定は本 spec 末尾の「IPC channel ↔ test ファイル対応表」と「auth.js export ↔ test 対応表」がすべて埋まることで行う。coverage% は副次指標で、目標値は置かない。

## スコープ

新規・拡張するテストファイル 6 本：

| ファイル | 状態 | 対象 channel / 関数 |
|---|---|---|
| `tests/main/auth.test.js` | 新規 | `credentialsExist` / `getCredentialsPath` / `importCredentialsFromFile` / `loadSavedCredentials`（経由: `getAuthenticatedClient`）/ `saveCredentials`（経由: `startAuthFlow`）/ `logout` / `startAuthFlow`（state mismatch / 非callback 404 / success / error の 4 ケース） |
| `tests/main/ipc/authHandlers.test.js` | 新規 | `auth:check` / `auth:login` / `auth:logout` / `auth:importCredentials` |
| `tests/main/ipc/videoHandlers.test.js` | 新規 | `schedule:get` / `schedule:feed` / `schedule:refresh` / `diag:rssFailureRate` / `diag:quotaStatus` / `videos:listMissed` / `videos:listArchive` / `videos:addManual` / `videos:listFavorites` / `videos:saveFavoriteOrder` / `videos:searchByText` / `videos:markViewed` / `videos:clearViewed` / `videos:toggleFavorite` / `videos:toggleNotify` / `channels:togglePin` / `channels:listAll` / `channels:addManual` / `channels:delete` / `channels:syncNow` |
| `tests/main/ipc/settingsHandlers.test.js` | 新規 | `settings:get` / `settings:set` / `settings:export` / `settings:import` / `favorites:export` / `favorites:import` |
| `tests/main/ipc/statsHandlers.test.js` | 新規 | `stats:channelActivity` |
| `tests/main/ipc/appHandlers.test.js` | 拡張 | 既存: `shell:openFolder`。追加: `shell:openExternal`（http/https allowlist 含む / file: 等は弾く）/ `notification:show` / `app:version` / `schedule:resetDatabase` / `updater:quitAndInstall` / `updater:checkNow`（dev/prod 分岐） |

## 実装パターン

既存 `playlistHandlers.test.js` / `appHandlers.test.js` が確立した「`vi.hoisted` で `ipcMain.handle` を Map にキャプチャ → 各 channel を invoke してアサート」を踏襲する。

### IPC handler テストの典型形

```js
const { handlers, ipcMainHandle } = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler))
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle },
  app: { getVersion: () => '0.0.0-test', getPath: () => '/tmp' },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  Notification: { isSupported: () => false },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

const { registerXxxHandlers } = await import('../../../src/main/ipc/xxxHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}
```

### auth.js テストの方針

`startAuthFlow` は HTTP server + googleapis + electron.shell を含むので最も重い。次の方針で mock する：

- `googleapis` の `google.auth.OAuth2` クラスを mock し、`generateAuthUrl` / `getToken` / `setCredentials` のみスタブ
- `electron.shell.openExternal` を spy（実際のブラウザは開かない）
- `http.createServer` は本物を使い、`http.get(`http://127.0.0.1:3456/callback?...`)` でリクエストをシミュレート
- 4 ケース：
  1. **success**: state 一致 + code あり → `getToken` が呼ばれ token.json に書かれることを検証
  2. **state mismatch**: state を改ざんしたリクエストで `Error('state mismatch')` で reject
  3. **non-callback**: `/favicon.ico` 等にリクエストを送ると 404 が返り、auth flow は継続する
  4. **error**: callback に `?error=access_denied` で reject

mock 複雑度が想定以上だった場合のフォールバック：state 生成・URL 構築・callback 解析を auth.js の内部関数として export し、それを unit test する「軽め」案に切り替える。spec 内で許容する。

### auth.js の他の関数

- `credentialsExist`: ファイル存在チェックのみ。`fs/promises` を mock して `access` の成功/失敗で挙動を検証
- `getCredentialsPath`: 戻り値のパス確認
- `importCredentialsFromFile`: 正常 JSON / 不正 JSON / バリデーション失敗の 3 ケース
- `loadSavedCredentials`（`getAuthenticatedClient` 経由）: refresh_token あり / なし / 読み込みエラーの 3 ケース。chmod 0o600 の best-effort 呼び出しも検証
- `saveCredentials`（`startAuthFlow` 経由でカバー）: mode 0o600 付きで書き込まれることを検証
- `logout`: token.json 削除の成功 / 既に無い時の握り潰しを検証

## Non-goal

- 既存 `playlistHandlers.test.js` や他テストの書き直し
- coverage% の計測ツール導入
- E2E / Electron integration テスト
- DB migration の差分テスト（Phase C で schema 整理する際に扱う）
- renderer 側のテスト追加（Phase A の範囲）

## 完成条件

- `npm run lint` pass
- `npm run test` pass、テスト数が現状 390 → **目標 440〜470**
- 既存 45 test file のテストを 1 件も破壊しない
- 本 spec 末尾の対応表（IPC channel × test ファイル、auth.js export × test）がすべて埋まる
- handoff（`CLAUDE_CODE_HANDOFF.md`）に Codex 側の検証結果（lint / test pass、テスト総数、対応表充足）を記録

## リリース

v1.21.0（minor bump）。新機能なしのため patch でも妥当だが、テスト総数 +50 件・テストファイル +5 件は内部構造変化として目立つため minor を提案。最終判断は user。

## リスクと緩和

| リスク | 緩和 |
|---|---|
| `startAuthFlow` の mock 複雑度が想定以上 | spec 内で「軽め」案へのフォールバックを許容。内部ロジックを export する形式に切り替えて単体テスト化 |
| `vi.mock('electron', …)` で `app.getPath` が未 mock のため import 時にエラー | mock の `app` オブジェクトに `getPath: () => '/tmp'` 等を含める。テンプレートを本 spec の「実装パターン」に明示済み |
| `dialog.showSaveDialog` / `showOpenDialog` の戻り値型違いで settings.export/import テストが脆い | Electron 公式型に合わせ `{ canceled: boolean, filePath?: string, filePaths?: string[] }` を返すよう mock |
| CI 時間の増加 | 現在 5〜6s。+50 件で 7〜8s 想定、許容範囲 |

## 達成判定用の対応表（実装後に埋める）

### IPC channel × test ファイル

| channel | テストファイル | 状態 |
|---|---|---|
| `auth:check` | `tests/main/ipc/authHandlers.test.js` | 済 |
| `auth:login` | 同上 | 済 |
| `auth:logout` | 同上 | 済 |
| `auth:importCredentials` | 同上 | 済 |
| `schedule:get` | `tests/main/ipc/videoHandlers.test.js` | 済 |
| `schedule:feed` | 同上 | 済 |
| `schedule:refresh` | 同上 | 済 |
| `schedule:resetDatabase` | `tests/main/ipc/appHandlers.test.js` | 済 |
| `diag:rssFailureRate` | `tests/main/ipc/videoHandlers.test.js` | 済 |
| `diag:quotaStatus` | 同上 | 済 |
| `videos:listMissed` | 同上 | 済 |
| `videos:listArchive` | 同上 | 済 |
| `videos:addManual` | 同上 | 済 |
| `videos:listFavorites` | 同上 | 済 |
| `videos:saveFavoriteOrder` | 同上 | 済 |
| `videos:searchByText` | 同上 | 済 |
| `videos:markViewed` | 同上 | 済 |
| `videos:clearViewed` | 同上 | 済 |
| `videos:toggleFavorite` | 同上 | 済 |
| `videos:toggleNotify` | 同上 | 済 |
| `channels:togglePin` | 同上 | 済 |
| `channels:listAll` | 同上 | 済 |
| `channels:addManual` | 同上 | 済 |
| `channels:delete` | 同上 | 済 |
| `channels:syncNow` | 同上 | 済 |
| `settings:get` | `tests/main/ipc/settingsHandlers.test.js` | 済 |
| `settings:set` | 同上 | 済 |
| `settings:export` | 同上 | 済 |
| `settings:import` | 同上 | 済 |
| `favorites:export` | 同上 | 済 |
| `favorites:import` | 同上 | 済 |
| `stats:channelActivity` | `tests/main/ipc/statsHandlers.test.js` | 済 |
| `shell:openFolder` | `tests/main/ipc/appHandlers.test.js` | 既存 |
| `shell:openExternal` | 同上 | 済 |
| `notification:show` | 同上 | 済 |
| `app:version` | 同上 | 済 |
| `updater:quitAndInstall` | 同上 | 済 |
| `updater:checkNow` | 同上 | 済 |
| `playlist:listMine` 他 7 ch | `tests/main/ipc/playlistHandlers.test.js` | 既存 |

### auth.js export × test

| export | テスト | 状態 |
|---|---|---|
| `credentialsExist` | `tests/main/auth.test.js` | 済 |
| `getCredentialsPath` | 同上 | 済 |
| `importCredentialsFromFile` | 同上 | 済 |
| `getAuthenticatedClient` | 同上 | 済 |
| `startAuthFlow` | 同上（4 ケース） | 済 |
| `logout` | 同上 | 済 |
