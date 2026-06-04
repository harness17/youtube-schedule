# YouTom 共同開発ハンドオフ

最終更新: 2026-06-04
対象リポジトリ: `H:/ClaudeCode/Youtube/youtube-schedule`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、汎用ハーネスは `.claude/rules/cross-agent-harness.md`、YouTom 固有 profile は `.claude/rules/project-collaboration-profile.md` を参照。

既存の `.claude/rules/cross-agent-review.md` は旧運用メモとして残し、相互依頼・レビュー・merge 判断はこのファイルと profile に集約する。

---

## 2026-06-04 21:49 実装完了（Phase A Slice 4 — useTabState 純粋ヘルパー抽出 — Codex 作成）

- 対象計画: `docs/plans/2026-06-04-phase-a-slice4-tabstate-helpers.md`
- 対象: `develop` / `H:/ClaudeCode/Youtube/youtube-schedule`
- 作成者: Codex
- 主題: `useTabState.js` 内の副作用なし計算ロジック 5 点を `tabStateHelpers.js` へ抽出し、focused unit test を追加。
- 変更したファイル:
  - `src/renderer/src/tabStateHelpers.js`（新規）
  - `tests/renderer/tabStateHelpers.test.js`（新規）
  - `src/renderer/hooks/useTabState.js`
  - `docs/plans/2026-06-04-phase-a-slice4-tabstate-helpers.md`
  - `CLAUDE_CODE_HANDOFF.md`
- 実装概要:
  - `resolvePeriod` / `groupFavoritesBySection` / `groupMissedBySection` / `buildTabChannelList` / `applyFavoriteReorder` を純粋 helper として抽出。
  - `useTabState.js` は抽出関数を import して呼び出す形に差し替え。public return shape の key 名・順序・型は変更なし。
  - `arrayMove` は `useTabState.js` 内で `reorderFavorites` の旧 callback 以外に使用なしを確認し、`tabStateHelpers.js` 側へ import 移動。
  - `sortSettingsChannels` は `buildTabChannelList` 側へ移動し、`useTabState.js` からの直接 import を削除。
- 完成条件:
  - ✅ `src/renderer/src/tabStateHelpers.js` 新規作成
  - ✅ `tests/renderer/tabStateHelpers.test.js` 新規作成（19 tests）
  - ✅ `src/renderer/hooks/useTabState.js` が抽出 helper を利用
  - ✅ `useTabState` の public return shape は変更なし（return ブロックは未変更）
  - ✅ IPC・UI・既存外部インターフェース変更なし
  - ✅ lint / test / build 全パス
- IPC 契約:
  - N/A: renderer hook 内の純粋計算抽出のみ。main / preload / renderer IPC 呼び出し / event 発火・購読ペアはいずれも変更なし。
- セルフ verify:
  - ✅ `npm run test -- tests/renderer/tabStateHelpers.test.js`（1 file / 19 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（67 files / 561 passed）
  - ✅ `npm run build`
  - ✅ `Select-String src/renderer/hooks/useTabState.js -Pattern "arrayMove|sortSettingsChannels"` → 該当なし
- 実動確認:
  - N/A: UI・IPC・DB 変更なしの renderer helper 抽出。計画の verify は lint/test/build まで。
- レビュー観点:
  - `applyFavoriteReorder()` が旧 setState callback と同じ scope 内並び替えを維持しているか。
  - `buildTabChannelList()` の selectedChannel 補完と pinned-first sort が旧 `tabChannels` useMemo と同等か。
  - `useTabState` の public return shape に差分がないか。
- 未解決:
  - 作業開始時点で `CLAUDE_CODE_HANDOFF.md` は既に modified。今回の追記以外の既存差分は巻き戻していない。
- 次アクション:
  - Claude Code: Slice 4 の cross-review。問題なければユーザー判断で次スライスまたは Phase A 完了判断へ進む。

---

## 2026-06-04 レビュー完了（Phase A Slice 3 — App.jsx タブ描画分割 — Claude Code レビュー）

- レビュー対象コミット: `8185311`
- レビューア: Claude Code
- レビュー結論: **🔴 重大指摘なし。🟢 全チェック通過**

### IPC 4 点対称チェック

- N/A: 本 Slice は純 renderer 再構成。main / preload は無変更。IPC contract の追加・変更なし。

### dead code 残置チェック

- `function SortableFavoriteCard` / `function renderTabCard` / `function renderFavoriteSection` — App.jsx に 0 件 ✅
- 旧定義のテストファイルも残置なし ✅

### handoff 完成条件の網羅

- `App.jsx` 914 行（handoff 記載通り）✅
- `appTabsModel.js`・`channelFilter.js`・7 コンポーネントすべて存在 ✅
- `getVisibleTabs(false)` が `['feed', 'favorites']` を返す（mode:both の favorites が含まれる）— plan との差異は Codex が handoff に記録済み ✅
- lint ✅ / test 542 pass ✅ / build ✅

### テスト数の変化

- Slice 2 後: 62 files / 528 tests
- Slice 3 後: 66 files / 542 tests（+4 files / +14 tests）
- 追加テスト内訳: appTabsModel (2), channelFilter 追加分 (1), TabCard (3), AppTabFeed (4), AppTabArchive (4) = 14 件。削除すべき旧テストなし（renderTabCard 等は App.jsx 内にテスト対象なし）✅

### 動作観点

- Slice 3 は UI 構成変更なし・IPC なし。Electron 起動確認は Slice 4 以降で UI 変更がある場合に実施する
- `cardCtx` / `favoriteCardCtx` の分離（reorderMode を favoriteCardCtx にのみ追加）が正しく行われている ✅
- `TabCard` の `showViewedButton: true` デフォルトは、AppTabFeed が `extraProps={{ showViewedButton: false }}` で上書きしているため feed タブでの表示は正しい ✅
- `AppTabArchive` の `TabCard` は extraProps 指定なしのため `showViewedButton: true` が引き継がれる（アーカイブタブでは viewed ボタンが必要）✅
- `FavoriteSection` の `extraProps` で `showStatusBadge` / `showViewedButton` を `item.status` から分岐しているのは正しい ✅

### 軽微所見（merge ブロッカーなし）

- 🟡 `TabCard` の `showViewedButton` デフォルトを `true` にしているため、将来タブが増えた際に意図せず表示されるリスクがある。現時点では feed の extraProps で明示的に `false` を渡しているため問題なし。将来の注意点として残す。

### merge ゲート

- ✅ ① セルフ verify（Codex）+ Claude Code verify
- ✅ ② 相互レビュー記録（本セクション）
- ✅ ③ 🔴 重大指摘なし
- ⏳ ④ ユーザー merge 指示待ち

---

## 2026-06-03 21:26 実装完了（Phase A Slice 3 — App.jsx タブ描画分割 — Codex 作成）

- 対象計画: `docs/plans/2026-06-03-phase-a-slice3-app-tab-split.md`
- 変更したファイル:
  - `src/renderer/src/App.jsx`
  - `src/renderer/src/channelFilter.js`
  - `src/renderer/src/appTabsModel.js`
  - `src/renderer/components/SortableFavoriteCard.jsx`
  - `src/renderer/components/TabCard.jsx`
  - `src/renderer/components/MissedSectionNav.jsx`
  - `src/renderer/components/FavoritesSectionNav.jsx`
  - `src/renderer/components/AppTabFeed.jsx`
  - `src/renderer/components/AppTabArchive.jsx`
  - `tests/renderer/channelFilter.test.js`
  - `tests/renderer/appTabsModel.test.js`
  - `tests/renderer/TabCard.test.jsx`
  - `tests/renderer/AppTabFeed.test.jsx`
  - `tests/renderer/AppTabArchive.test.jsx`
- 実装概要:
  - `App.jsx` から `SortableFavoriteCard`、共通 `TabCard`、favorites DnD section、missed/favorites section nav、feed/archive タブ本文を分離。
  - タブ定義を `appTabsModel.js` に移し、表示タブと認証解除時の full-mode 判定を同じ定義から導出。
  - `channelFilter.js` に非アーカイブ用の `isSelectedChannelOnly()` を追加し、`App.jsx` の絞り込み判定から利用。
  - `App.jsx` は 914 行。`function SortableFavoriteCard` / `function renderTabCard` / `function renderFavoriteSection` / インライン feed タブ配列の残存なし。
- verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（66 files / 542 passed）
  - ✅ `npm run build`
  - ✅ `(Get-Content src/renderer/src/App.jsx).Count` → 914
  - ✅ 旧定義残存チェック 0 件
- 実動確認:
  - 未実施。今回の計画 Step 10 は `lint/test/build` と静的残存チェックまでで、Electron 起動確認は含めていない。
- 注意点:
  - 計画 Step 2 のテスト文面は `getVisibleTabs(false) === ['feed']` だったが、同じ計画内の `APP_TABS` 設計と既存 `App.jsx` は `favorites` を `mode: 'both'` として未認証時も表示していた。UI 構成変更禁止・既存挙動維持を優先し、テストは `['feed', 'favorites']` にした。
  - `cardCtx` は計画通り毎 render で組み立てる。React.memo / useMemo 最適化は本スライス対象外。
- 次アクション:
  - Claude Code: Slice 3 の cross-review。特に favorites DnD 境界、未認証時 favorites 表示維持判断、抽出コンポーネントの props 境界を確認。

---

## 2026-06-03 21:00 レビュー完了（Phase A Slice 2 — SettingsModal タブ UI 分割 — Claude Code レビュー）

- レビューア: Claude Code
- レビュー結論: **🔴 重大指摘なし。軽微1件を修正後コミット済み**
- 確認結果:
  - SettingsModal.jsx 500行（完成条件ちょうど達成）
  - `window.api.xxx` 呼び出しが全て SettingsModal.jsx に残存。子コンポーネントへの漏れなし
  - `renderDisplay` / `renderConnection` / `renderChannels` / `renderChannelRow` / `renderData` / `renderAbout` の関数定義残留なし
  - 同期ボタン（`onSyncChannelsNow`）は元々 `renderChannels` 内にあり、Channels タブに移動したのは正しい（UI 変更なし）
  - SettingsTabChannels の flat props + styles 1オブジェクト設計は計画通り
- 軽微修正（Claude Code が直接修正）:
  - `SettingsTabConnection.jsx` PropTypes の vestigial な `onSyncChannelsNow` / `isSyncingChannels: isRequired` を削除（使用されていない props で runtime 警告の原因）
  - コミット: `090b675 refactor: Phase A Slice 2 — SettingsModal 5タブを個別コンポーネントに分割`
- verify（修正後）:
  - ✅ `npm run lint`
  - ✅ `npm run test`（62 files / 528 passed）
  - ✅ `npm run build`
- merge ゲート:
  - ✅ ① セルフ verify（Codex）+ Claude Code verify
  - ✅ ② 相互レビュー記録（本セクション）
  - ✅ ③ 🔴 重大指摘なし
  - ⏳ ④ ユーザー merge 指示待ち
- 次アクション:
  - ユーザーが merge OK を出したら `develop` は Slice 2 完了として Slice 3（App.jsx 整理 or useTabState 整理）へ移行

---

## 2026-06-03 20:56 実装完了（Phase A Slice 2 — SettingsModal タブ UI 分割 — Codex 作成）

- 対象: `develop` / `H:/ClaudeCode/Youtube/youtube-schedule`
- 作成者: Codex
- 主題: `SettingsModal.jsx` の5タブ描画関数を独立コンポーネントへ分割し、IPC 呼び出しは親コンポーネントに維持。
- 触ったファイル:
  - `src/renderer/components/SettingsModal.jsx` — renderXxx 関数を削除し、各 SettingsTab コンポーネント呼び出しへ差し替え。`handleOpenExternal` / `handleResetDatabase` / `handleLogout` と `styles` prop を追加
  - `src/renderer/components/SettingsTabDisplay.jsx`（新規）— 表示タブ
  - `src/renderer/components/SettingsTabChannels.jsx`（新規）— チャンネルタブ、`renderChannelRow` はファイル内ローカル関数として移動
  - `src/renderer/components/SettingsTabData.jsx`（新規）— データタブ
  - `src/renderer/components/SettingsTabConnection.jsx`（新規）— 接続タブ
  - `src/renderer/components/SettingsTabAbout.jsx`（新規）— アプリ情報タブ
  - `tests/renderer/SettingsTabDisplay.test.jsx`（新規）
  - `tests/renderer/SettingsTabChannels.test.jsx`（新規）
  - `tests/renderer/SettingsTabData.test.jsx`（新規）
  - `tests/renderer/SettingsTabConnection.test.jsx`（新規）
  - `tests/renderer/SettingsTabAbout.test.jsx`（新規）
- 完成条件:
  - ✅ 5タブを個別コンポーネントへ分割し、文言・スタイル値・主要構造は旧 JSX を移動
  - ✅ `SettingsModal.jsx` は 500 行
  - ✅ `window.api.xxx` 呼び出しは `SettingsModal.jsx` に残し、子は callback props のみ使用
  - ✅ `renderDisplay` / `renderConnection` / `renderChannels` / `renderChannelRow` / `renderData` / `renderAbout` の関数定義は残存なし
  - ✅ 各タブの smoke / 代表 interaction test を追加
- IPC 契約: N/A（renderer component 分割のみ。main handler / preload exposure / event 発火・購読ペアは変更なし）
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（62 files / 528 passed）
  - ✅ `npm run build`
  - ✅ `(Get-Content src/renderer/components/SettingsModal.jsx).Count` → 500
  - ✅ 旧 render 関数名の `Select-String` → 該当なし
  - ✅ `src/renderer/components/SettingsTab*.jsx` の `window.api` 検索 → 該当なし
- 実動確認: N/A（UI component 分割のみ。Electron 起動確認は反対側レビューまたは次の UI 実動確認で実施）
- レビュー観点:
  - 旧 JSX の文言・スタイル・ボタン挙動が移動前と同等か
  - `SettingsTabChannels` の flat props が今後の Slice 3/4 で過剰結合にならないか
  - `SettingsModal.jsx` の 500 行ちょうどが今後の小変更で再超過しないか
- 未解決:
  - Codex セッションからの `git add` / `git commit` は `.git/index.lock` 作成が `Permission denied` で失敗。`.git` ACL に Deny があり、変更は未 stage のまま残っている。
- 次アクション:
  - ユーザーまたは権限のあるローカル環境: 個別ファイル指定で stage して commit。
  - Claude Code: Phase A Slice 2 を cross-review。問題なければユーザー判断で次スライスへ進む。

---

## 2026-06-03 20:21 レビュー完了・merge 済み（Phase A Slice 1 — Claude Code 作成）

- 対象: `feature/phase-a-settings-modal-model` → develop へ merge 完了
- レビューア: Claude Code
- レビュー結論: **🔴 重大指摘なし。軽微1件を修正後 merge 済み**
- 確認結果:
  - `sortSettingsChannels` / `getSettingsChannelGroups` / メッセージ helper の4関数は旧インライン実装と完全等価
  - `SETTINGS_TAB_KEYS` の PropTypes.oneOf 順序変化は値の有無のみ検査のため影響なし
  - `{showSettings && <SettingsModal ... />}` 条件レンダリングにより initialTab は都度リセットされることを App.jsx で確認
  - テスト7件が正常系・null 入力・大文字小文字・手動チャンネル除外・全エラーコードを網羅
- 軽微修正（Claude Code が追加コミット）:
  - `useTabState.js` の `sortFn`（ロケール指定なし・null ガードなし）を `sortSettingsChannels` import に統一
  - コミット: `05dcc4f fix: useTabState sortFn を sortSettingsChannels に統一し ja ロケール・null ガードを追加`
- verify（修正後）:
  - ✅ `npm run lint`
  - ✅ `npm run test`（57 files / 514 passed）
  - ✅ `npm run build`
- merge ゲート:
  - ✅ ① セルフ verify（Codex）＋ 追加修正後 verify（Claude Code）
  - ✅ ② 相互レビュー記録（本セクション）
  - ✅ ③ 🔴 重大指摘なし
  - ✅ ④ ユーザー merge 指示（「軽微修正を対応後マージ」）
- 次アクション:
  - 次スライスは `SettingsModal` の tab UI component 分割（Slice 2）。Codex に依頼する場合は `/codex-handoff` で起票。

---

## 2026-06-03 11:24 完了（Phase A Slice 1: SettingsModal 表示モデル抽出 — Codex 作成）

- 対象: `feature/phase-a-settings-modal-model`
- 作成者: Codex
- 主題: Phase A renderer 分割の設計 spec を追加し、最初の小スライスとして `SettingsModal.jsx` からタブ定義・チャンネル分類・手動動画追加メッセージを純粋 helper へ抽出。
- 触ったファイル:
  - `docs/superpowers/specs/2026-06-03-phase-a-renderer-split-design.md`（新規）— Phase A の目的、Non-goal、Slice 1〜4、verify を定義
  - `docs/superpowers/specs/2026-05-27-debt-repayment-roadmap.md` — Phase A spec へのリンク更新
  - `src/renderer/src/settingsModalModel.js`（新規）— `SETTINGS_TABS` / `SETTINGS_TAB_KEYS` / `sortSettingsChannels` / `getSettingsChannelGroups` / 手動動画メッセージ helper
  - `src/renderer/components/SettingsModal.jsx` — local helper / 定数を新 model module 参照へ差し替え
  - `tests/renderer/settingsModalModel.test.js`（新規）— タブキー、並び替え、分類、検索、メッセージ変換の focused test
- 完成条件:
  - ✅ Phase A spec を追加し、renderer 分割にスコープ限定
  - ✅ UI / IPC / DB schema / 設定ファイル形式 / 外部 API 呼び出しは変更なし
  - ✅ `SettingsModal` の表示モデル helper を純粋関数化し、focused unit test を追加
  - ✅ 既存 modal の表示文言・操作意味を維持
- IPC 契約: N/A（renderer 内部 helper 抽出のみ。main handler / preload exposure / renderer IPC 呼び出し / event 発火・購読ペアはいずれも変更なし）
- セルフ verify:
  - ✅ `npm run test -- tests/renderer/settingsModalModel.test.js`（1 file / 7 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（57 files / 514 passed）
  - ✅ `npm run build`
- 公開アーティファクト確認:
  - ✅ `public-artifact-privacy.md` を確認
  - ✅ 追加 spec / 変更 doc / 関連ソースに対し、指定 sensitive pattern の `rg` スキャンで該当なし
- 実動確認: N/A（UI 表示の意味を変えない renderer helper 抽出のみ。Electron 起動確認は次の UI component 分割スライスで実施推奨）
- レビュー観点:
  - `SettingsModal.jsx` の `sortSettingsChannels` 差し替えが元の pinned-first/title-sort と同等か
  - `getSettingsChannelGroups()` が手動追加チャンネルを検索対象から外す既存挙動を維持しているか
  - Phase A spec の Slice 2〜4 が十分に小さく、UI component 分割で props 過多にならないか
- 未解決:
  - `CLAUDE_CODE_HANDOFF.md` には作業開始前から 2026-05-30 の handoff 追記差分が未コミットで存在。今回の追記では巻き戻していない。
  - ブランチ作成時、`codex/...` refs はローカル制約で作成できなかったため、repo 既存命名に合わせて `feature/phase-a-settings-modal-model` を使用。
- 次アクション:
  - Claude Code: Phase A Slice 1 を cross-review。問題なければユーザー判断で develop へ merge。次スライスは `SettingsModal` の tab UI component 分割。

---

## 2026-05-30 17:52 実装完了（配信カード「このチャンネルのみ」絞り込みボタン — Claude Code 作成）

- 対象: `feature/channel-only-filter`（develop から分岐、commit `5e8f323`）
- 作成者: Claude Code
- 主題: 配信カードのチャンネル欄に「🔍 このチャンネルのみ」ボタンを追加。クリックでそのチャンネルだけに絞り込む（上部セレクト/ArchiveFilterBar に反映、同挙動）。
- 設計 doc: `docs/superpowers/specs/2026-05-29-channel-only-filter-button-design.md`（同ブランチで実態反映済み）
- 触ってよい範囲: `src/renderer/src/channelFilter.js`, `src/renderer/components/ScheduleCard.jsx`, `src/renderer/components/ScheduleList.jsx`, `src/renderer/src/App.jsx`, `tests/renderer/{channelFilter,ScheduleCard,ScheduleList}.test.*`
- 触ってはいけない範囲: useTabState のフィルタ状態管理本体、上部セレクトボックス / ArchiveFilterBar の UI、playlist / stats タブ
- 削除すべきファイル: なし（純粋な機能追加）
- 完成条件:
  - schedule/missed/favorites: ボタン押下で `setSelectedChannel` 単独選択トグル → 上部セレクトに反映、`filteredLive/Missed/Favorites` 再計算
  - archive: ボタン押下で `archiveFilters.channelIds` をそのチャンネル単独へ置換トグル → `[archiveFilters]` effect で `runArchiveSearch` 再検索、ArchiveFilterBar に反映
  - トグル解除: 選択中カード再押下で all / channelIds 空に戻る
  - ハイライト: 選択中カードはボタンがハイライト + ラベル「このチャンネルだけ表示中」
  - 後方互換: feed / playlist / stats はボタン非表示（`onFilterChannel` 未指定）
  - 既存タブ・既存ボタン（📌/⭐/🔔/✓）を壊さない
- IPC 契約: N/A（renderer 内で完結。main / preload / IPC / DB / migration の変更なし）
- 変更内容:
  - `channelFilter.js`（新規）: `isArchiveChannelOnly` / `toggleArchiveChannelOnly`（archive トグル純粋関数。テスト容易性のため App から抽出）
  - `ScheduleCard.jsx`: `onFilterChannel` / `isChannelFiltered` props 追加、チャンネル行（📌優先ボタンの左隣）にボタン。`channelId` 無し or `onFilterChannel` 未指定で非表示
  - `App.jsx`: `handleFilterChannel` / `isChannelFiltered`（activeTab 分岐）、`renderTabCard` と `ScheduleList` に中継、feed は `onFilterChannel: undefined` で抑止
  - `ScheduleList.jsx`: props 中継（schedule タブ用）
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（56 files / 507 passed。新規: 純粋関数 8 + ScheduleCard 6 + ScheduleList 3）
  - ✅ `npm run build`
- 実動確認: `npm run dev` で boot clean（better-sqlite3 rebuild OK / main・preload・renderer ビルド成功 / electron 起動）。GPU・disk cache の環境ノイズエラーのみ。**クリック→フィルタの目視確認は本環境では不可**（Electron は MCP Playwright 非対応・画面視認不可）→ 自動テスト + コード検査で代替。develop 実行での目視確認を依頼。
- レビュー観点（Codex 向け）:
  - App seam（自動テスト外）: `handleFilterChannel` / `isChannelFiltered` の activeTab 分岐、`setSelectedChannel` / `setArchiveFilters` の呼び分けが `filterItem` / `[archiveFilters]` effect と整合するか
  - feed 抑止: `extraProps` が spread 末尾で `onFilterChannel: undefined` を上書きし、feed でボタンが出ないか
  - 後方互換: PlaylistTab / StatsTab に `onFilterChannel` を渡していない（ボタン非表示）か
  - dead code 残置・依頼外変更なし。doc の変更ファイル表が実態と一致（純粋関数抽出で 4 → 実質 5 + テスト 3）
- 未解決: なし
- 次アクション: ✅ 2026-05-30 ユーザー目視確認後 develop へ `--no-ff` merge 完了（Codex 事前レビューはユーザー判断でスキップ）。残: origin への push / `feature/channel-only-filter` 削除はユーザー指示待ち

---

## 2026-05-29 10:54 レビュー完了（Phase C Slice 3: videoRepository query 分離 — Claude Code 作成）

- 対象: `feature/phase-c-slice3-repo-queries`（Codex commit `cfd308a`）
- 作成者: Claude Code
- 主題: Slice 3 の独立レビュー。read query 分離が SQL の意味を変えず、public API と既存テストを維持しているかを確認。
- レビュー結果: 🟢 良好（🔴 重大指摘なし / 🟡 軽微指摘なし）
- 確認したこと:
  - SQL verbatim 移動: `videoQueries.js` の全 read statement（`listVisible` / `listMissed` / `listFavorites` / `listFeed` / `searchByText` / `listArchive` の動的 SQL）と read 専用定数・`escapeLikeQuery`・`rowToVideo` が移動元と文字列・パラメータ単位で一致。
  - composition: `videoRepository.js` は `return { ...queries, <write群> }` で read API を再公開し、write statement と write-side read-back 用の private `getByIdStmt` / `getByIdForFavStmt` を保持。public API 名・引数・戻り値に変化なし。
  - import 切替: `playlistRepository.js` の `rowToVideo` import を `./videoQueries.js` に変更済み。再 export shim なし。`statsRepository.js` はローカル mapper のため変更不要を確認。
  - dead code 残置なし・依頼外ファイル変更なし。
  - 既存 videoRepository 系 3 テスト（`videoRepository.test.js` / `videoRepository.membership.test.js` / `videoRepository.archive.test.js`）は無修正 = SQL 意味不変の証跡。
  - 新規 `videoQueries.test.js` は `createVideoQueries` を直接呼び、`listVisible`（live/upcoming 抽出）/ `listArchive`（channel + period + text 複合フィルタ）/ `searchByText`（LIKE `%`・`_` エスケープ）を focused に検証。
- 独立 verify（Slice 3 ブランチで Claude Code が再実行）:
  - ✅ `npm run lint`
  - ✅ `npm run test`（54 files / 487 passed — Codex の主張と一致）
  - ✅ `npm run build`
- merge ゲート:
  - ① セルフ verify: ✅
  - ② 相互レビュー記録: ✅（本セクション）
  - ③ 🔴 重大指摘なし: ✅
  - ④ ユーザー merge 指示: ⏳ 待ち
- 次アクション:
  - ユーザー merge 指示後、Slice 2（`feature/phase-c-slice2-refresh-phases`）+ Slice 3 を develop へ束ね merge → v1.22.0。Slice 1 は develop 反映済み。

---

## 2026-05-29 10:46 完了（Phase C Slice 3: videoRepository query 分離 — Codex 作成）

- 対象: `feature/phase-c-slice3-repo-queries`
- 作成者: Codex
- 主題: `videoRepository.js` の read query を `videoQueries.js` へ分離し、repository は write 操作と query composition に絞った。
- 触ってよい範囲:
  - `src/main/repositories/videoRepository.js`
  - `src/main/repositories/videoQueries.js`
  - `src/main/repositories/playlistRepository.js`
  - `tests/main/repositories/videoQueries.test.js`
  - `CLAUDE_CODE_HANDOFF.md`
- 触ってはいけない範囲:
  - SQL の意味変更
  - read 系 public メソッド名・引数・戻り値
  - write 操作の挙動
  - 既存 videoRepository 系 3 テストの内容
  - renderer / preload / IPC / DB migration / schedulerService
- 削除すべきファイル: なし
- 完成条件:
  - `createVideoQueries(db)` が read API（`getById` / `getByIds` / `count` / `listVisible` / `listMissed` / `listArchive` / `listFavorites` / `listFeed` / `searchByText` / `listBackfillTargetIds` / `listManualTrackingIds`）を公開
  - `createVideoRepository(db)` は `return { ...queries, <write群> }` で既存 API を維持
  - `rowToVideo` / read 専用定数 / `escapeLikeQuery` は `videoQueries.js` へ移動
  - `playlistRepository.js` の `rowToVideo` import は `./videoQueries.js` に切替。`statsRepository.js` は `videoRepository` import ではなくローカル mapper だったため変更なし
  - 既存 3 テストは無修正で pass
  - 新規 `videoQueries.test.js` で `listVisible`、`listArchive` フィルタ、`searchByText` LIKE エスケープを直接検証
- IPC 契約:
  - N/A: repository 内部の分離のみ。IPC handler / preload exposure / renderer 呼び出し / event 発火・購読ペアは変更なし
- 変更内容:
  - `videoQueries.js` を追加し、read statement、`rowToVideo`、`escapeLikeQuery`、read method を移動
  - `videoRepository.js` から read statement/method を除去し、write statement/method と raw row 参照用 `getByIdStmt` を残した
  - `playlistRepository.js` の mapper import を新 module へ変更
  - `videoQueries.test.js` を追加
- セルフ verify:
  - ✅ `npx vitest run tests/main/repositories/videoQueries.test.js tests/main/repositories/videoRepository.test.js tests/main/videoRepository.membership.test.js tests/main/videoRepository.archive.test.js`（4 files / 72 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（54 files / 487 passed）
  - ✅ `npm run build`
- 実動確認: N/A（repository 内部リファクタのみ。UI / IPC / DB schema 変更なし）
- レビュー観点:
  - `videoQueries.js` の SQL・パラメータ・`rowToVideo` mapping が移動元と一致しているか
  - `videoRepository.js` に write が残り、read は `...queries` 経由で再公開されているか
  - `playlistRepository.js` の import 切替に漏れがなく、shim が追加されていないか
  - 依頼外ファイル・SQL 意味変更・既存テスト修正が混ざっていないか
- 未解決:
  - なし
- 次アクション:
  - Claude Code: `/cross-review` で Phase C Slice 3 をレビュー。問題なければユーザー判断で Slice 1/2/3 を develop へ merge → v1.22.0。

---

## 2026-05-29 10:42 依頼（Phase C Slice 3: videoRepository query 分離 — Claude Code 作成）

- 対象: **`feature/phase-c-slice2-refresh-phases` から `feature/phase-c-slice3-repo-queries` を切って作業すること**（Slice 2 の上に stack する。理由: Slice 3 を develop へ merge すれば Slice 1/2/3 が 1 回の merge で揃い、handoff ファイルの衝突も避けられる）
- 作成者: Claude Code
- 担当: **Codex（実装＋テスト）**
- 親 spec: `docs/superpowers/specs/2026-05-29-phase-c-main-service-cleanup-design.md`（Slice 3）
- 主題: `src/main/repositories/videoRepository.js` の read query を新規 module `videoQueries.js` へ分離し、repository には write 操作を残す。**SQL 文字列は逐語移動し、意味を一切変えない**。

### 背景

`videoRepository.js`（437 行）は read query（visible / missed / archive / favorites / feed / search / getById(s) / count / backfill 対象 / manual 追跡）と write（upsert / markViewed / toggleFavorite / setFavorite / importAsFavorite / toggleNotify / markEnded / deleteExpiredEnded / saveFavoriteOrder / backfillMeta）を同居させている。Slice 3 は read を分離する。Slice 1/2 と異なり SQL 意味変更リスクがあるため最後に回した。

### スコープ

1. **新規 `src/main/repositories/videoQueries.js` を作り、read 系を逐語移動する**
   - `export function createVideoQueries(db)` が次を返す: `getById` / `getByIds` / `count` / `listVisible` / `listMissed` / `listArchive` / `listFavorites` / `listFeed` / `searchByText` / `listBackfillTargetIds` / `listManualTrackingIds`。
   - read 専用の定数（`UPCOMING_GRACE_MS` / `UPCOMING_FUTURE_MS` / `LIVE_MAX_DURATION_MS` / `RSS_ONLY_VISIBLE_MS`）と `escapeLikeQuery`、`rowToVideo` も videoQueries へ移す。
   - **prepared statement の SQL 文字列・パラメータ・`rowToVideo` のマッピングを 1 文字も変えない**。`listArchive` の動的 SQL 構築（where/dateExpr/orderBy）もそのまま移す。
2. **`videoRepository.js` は write を残し、read を composition で再公開する**
   - `createVideoRepository(db)` 内で `const queries = createVideoQueries(db)` を生成し、`return { ...queries, <write 群> }` とする。**公開 API（`videoRepo.listVisible()` 等）を不変に保ち、呼び出し側（schedulerService / imminentPoller / videoHandlers / playlistSyncService）を変更しない**。
   - `toggleFavorite` / `toggleNotify` が update 後に参照する raw row 用 `getByIdStmt`、`setFavorite` の `getByIdForFavStmt` は write 側の内部処理なので repository に残してよい。
3. **`rowToVideo` の import 元を更新する**
   - `src/main/repositories/playlistRepository.js:1` の `import { rowToVideo } from './videoRepository.js'` を `'./videoQueries.js'` に変更する（唯一の外部参照。re-export shim は作らない）。
   - `statsRepository.js` が `rowToVideo` を `videoRepository` から import していないか確認し、していれば同様に更新する（grep 上ヒットしているため要確認）。

### 触ってよい範囲

- `src/main/repositories/videoRepository.js`
- `src/main/repositories/videoQueries.js`（新規）
- `src/main/repositories/playlistRepository.js`（import 行のみ）
- `src/main/repositories/statsRepository.js`（`rowToVideo` import がある場合のみ、import 行のみ）
- `tests/main/repositories/videoQueries.test.js`（新規・最小）
- `CLAUDE_CODE_HANDOFF.md`（完了追記）

### 触ってはいけない範囲

- SQL の意味（where 条件・JOIN・ORDER BY・パラメータ・閾値計算）
- read 系の public メソッド名・引数シグネチャ・戻り値形（`rowToVideo` 経由のオブジェクト形）
- write 操作の挙動
- 既存テスト `tests/main/repositories/videoRepository.test.js` / `tests/main/videoRepository.membership.test.js` / `tests/main/videoRepository.archive.test.js` の**内容**（これらは composition 経由でそのまま pass すること。書き換え禁止）
- renderer / preload / IPC channel / DB migration / schedulerService（Slice 2 の領域）

### 削除すべきファイル

なし（read を新モジュールへ移すだけ。videoRepository から移動した旧定義の残置は不可）。

### 完成条件

- `videoQueries.js` の read query は移動元と SQL・パラメータ・マッピングが完全一致。
- `createVideoRepository(db)` の公開 API（read + write 全メソッド）が呼び出し側から見て不変。
- 既存 3 つの videoRepository テストが**無修正で pass**する（SQL 意味不変の証明）。
- `playlistRepository` / `statsRepository` の `rowToVideo` 参照が新モジュールを指し、動作する。
- 新規 `videoQueries.test.js` が `createVideoQueries(db)` を直接構築し、代表的な read（`listVisible` の live/upcoming 抽出、`listArchive` の channel/期間/検索フィルタ、`searchByText` の LIKE エスケープ）を最小検証する。
- DB schema / IPC contract / renderer 変更なし。

### IPC 契約

- N/A: repository 内部の分離のみ。IPC handler（videoHandlers）の呼び出し先メソッド名・戻り値は不変（理由: composition で API を保つ）。

### verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認: 任意。SQL 意味は既存テストで担保するが、不安があれば `npm run dev` で archive/favorites/見逃しタブが表示されることを確認してよい。

### 既知リスク

- read を移す際に SQL 文字列やパラメータ名（`@liveThreshold` 等）を取りこぼすと既存テストが落ちる → 既存 3 テストが安全網。
- `listArchive` は動的 SQL のため移動ミスが起きやすい。where 配列・`dateExpr`・`orderBy` マップを逐語移送する。
- `rowToVideo` の移動で playlist/stats repository の import が壊れる → 完成条件に明記。

### レビュー観点（Claude Code が後で見る）

- read query が逐語移動で SQL 意味不変か（既存 3 テスト無修正 pass ＋ diff 目視）
- composition で public API が保たれ、呼び出し側無変更か
- write が repository に残り、read が queries に移ったか（責務分離が実際に起きているか）
- `rowToVideo` 参照切り替えに漏れがないか
- 依頼外の cleanup・SQL 改変が混ざっていないか

### 次アクション

- Codex: 上記スコープで実装＋テスト → verify → handoff に完了追記。
- Claude Code: `/cross-review` でレビュー。問題なければ Slice 1/2/3 を揃えてユーザー判断で develop へ merge → v1.22.0。

---

## 2026-05-29 10:38 レビュー完了（Phase C Slice 2 — Claude Code 作成）

- 対象: `feature/phase-c-slice2-refresh-phases`
- 作成者: Claude Code
- レビュー結論: **依頼スコープ・完成条件を全て満たす。🔴 / 🟡 なし、merge 可（ユーザー判断待ち）**
- 確認結果:
  - `refreshTargetPlanner.planRefreshTargets` は抽出元とロジック一致。`target` の構築 `Array.from(new Set([...newIds, ...recheckIds, ...manualIds]))` で集合・順序を維持。stale 定数は `RECHECK_STALE_MS` に閉じ込め、`>` 厳密判定・`status !== 'ended'` 条件を保持
  - `rescueOrphanLives` は orphan 救済ブロックを逐語抽出。`rssIdSet`/`fetchedIds` フィルタ、`videoFetcher.fetch`→`upsert`→`markEnded` の I/O 副作用、`scheduler.orphanCheck` / `.summary` ログ payload が不変。authed パス内（`!authClient` 早期 return より後）の呼び出し位置も維持
  - `doRefresh` が resolveChannels → collectVideoIds → planRefreshTargets → details fetch/upsert → rescueOrphanLives → maybeCleanup の薄い orchestrator になっている
  - 非ゴール遵守: renderer / preload / IPC / DB migration / retention / quota 判定 / YouTube API 呼び出し回数いずれも変更なし。`resolveChannels` / `collectVideoIds` も未変更
  - dead code 残置なし。依頼外ファイル変更なし
- planner test 評価: forceFullRecheck 分岐、live/upcoming/stale 抽出、**境界（STALE=閾値超で対象 / FRESH=閾値ちょうどで非対象 / ENDED_STALE=ended 除外）**、new 順序、manual 合流＋dedup を網羅。良好
- 独立 verify（Codex セルフ申告を再現）:
  - ✅ `npm run lint`
  - ✅ `npm run test`（53 files / 484 passed、Slice 1 比 +1 file +4 tests）
  - ✅ `npm run build`
- 対応した指摘: なし
- 次アクション:
  - ユーザー: `develop` への merge 可否を判断（merge ゲート ①②③ 充足、④ 待ち）
  - 以降は Slice 3（`videoRepository` query 整理。SQL 意味変更リスクあり、spec の最終スライス）

---

## 2026-05-29 10:34 完了（Phase C Slice 2: refresh phase 分離 — Codex 作成）

- 対象: `feature/phase-c-slice2-refresh-phases`
- 作成者: Codex
- 主題: `schedulerService.doRefresh()` の recheck target 計画を純粋関数へ抽出し、orphan live 救済を schedulerService クロージャ内の名前付き関数へ分離した。
- 触ってよい範囲:
  - `src/main/services/schedulerService.js`
  - `src/main/services/refreshTargetPlanner.js`
  - `tests/main/services/refreshTargetPlanner.test.js`
  - `CLAUDE_CODE_HANDOFF.md`
- 触ってはいけない範囲:
  - renderer / preload / IPC channel
  - DB migration / cleanup retention policy / quota 判定
  - `videoRepository` SQL
  - YouTube API 呼び出し回数・順序の意味変更
- 削除すべきファイル: なし
- 完成条件:
  - `refresh()` / RSS-only / 認証あり / orphan 救済 / manual ID 合流の外部挙動を維持
  - `target` は既存と同じ `newIds -> recheckIds -> manualIds` 順序で重複排除
  - `scheduler.videoDetails` と `scheduler.orphanCheck.summary` のログキー・値の意味を維持
  - DB schema / IPC contract / renderer は変更なし
- IPC 契約:
  - N/A: main service 内部のリファクタのみ。request/response、preload exposure、renderer 呼び出し、event 発火・購読ペアはいずれも変更なし。
- 変更内容:
  - `refreshTargetPlanner.js` を追加し、`planRefreshTargets({ videoIds, known, manualIds, forceFullRecheck, now })` と `RECHECK_STALE_MS` を定義
  - `schedulerService.js` の既存 recheck target 算出を `planRefreshTargets` 呼び出しへ置換
  - orphan live 救済処理を `createSchedulerService` クロージャ内の `rescueOrphanLives` へ抽出し、I/O・logger event・ログ payload を維持
  - `refreshTargetPlanner.test.js` を追加し、force full recheck / live・upcoming・stale / new 抽出 / manual 合流 / 重複排除と順序を検証
- セルフ verify:
  - ✅ `npx vitest run tests/main/services/refreshTargetPlanner.test.js tests/main/services/schedulerService.test.js tests/main/services/imminentPoller.test.js`（3 files / 44 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（53 files / 484 passed）
  - ✅ `npm run build`
- 実動確認: N/A（main service 内部リファクタのみ。UI / IPC / DB schema 変更なし）
- レビュー観点:
  - `planRefreshTargets` の `target` 順序が旧 inline 実装と一致しているか
  - `rescueOrphanLives` 抽出で `videoFetcher.fetch` 呼び出し回数、`upsert`、`markEnded`、`scheduler.orphanCheck.summary` が変わっていないか
  - 依頼外ファイル・unrelated cleanup が混ざっていないか
- 未解決:
  - なし
- 次アクション:
  - Claude Code: `/cross-review` で Phase C Slice 2 をレビュー。問題なければユーザー判断で merge / Slice 3 へ進む。

---

## 2026-05-29 10:30 依頼（Phase C Slice 2: refresh phase 分離 — Claude Code 作成）

- 対象: `develop` から `feature/phase-c-slice2-refresh-phases` を切って作業すること
- 作成者: Claude Code
- 担当: **Codex（実装＋テスト）**
- 親 spec: `docs/superpowers/specs/2026-05-29-phase-c-main-service-cleanup-design.md`（Slice 2）
- 主題: `schedulerService.doRefresh()` 内にインライン展開されている「recheck target 計画」と「orphan live 救済」を関数分離し、`doRefresh` を薄い orchestrator にする。Slice 1（helper 抽出）の続き。

### 背景

`resolveChannels` / `collectVideoIds` は既に名前付き関数として分離済み。残るインラインフェーズは 2 つ：

1. **recheck target 計画**（現 `schedulerService.js` 172〜187 行付近）: `known` / `forceFullRecheck` / `manualIds` から `videoFetcher.fetch` に渡す `target` を算出する純粋ロジック。
2. **orphan live 救済**（現 211〜243 行付近）: RSS から消えた live/upcoming を `videos.list` で再確認し、API からも消えていれば `markEnded` する I/O フェーズ。

### スコープ（この 2 点のみ。それ以上は広げない）

1. **`refreshTargetPlanner.js`（新規 module・純粋関数）として recheck 計画を抽出する**
   - 関数例: `planRefreshTargets({ videoIds, known, manualIds, forceFullRecheck, now })` → `{ target, newIds, recheckIds }` を返す。
   - `doRefresh` 側はこの戻り値の `newIds.length` / `recheckIds.length` を既存どおりログ（`scheduler.videoDetails`）に渡す。**ログのキー・値の意味を変えない**。
   - stale 判定の定数 `24 * 60 * 60 * 1000` は planner 内に `RECHECK_STALE_MS` として閉じ込める。
   - `target` の構築は現状と同じ `Array.from(new Set([...newIds, ...recheckIds, ...manualIds]))` の順序・重複排除を維持する。
   - focused unit test を `tests/main/services/refreshTargetPlanner.test.js` に追加（forceFullRecheck 分岐 / live・upcoming・stale 抽出 / new 抽出 / manual 合流 / 重複排除）。
2. **orphan live 救済を `schedulerService.js` 内の名前付き関数へ抽出する**
   - 例: `rescueOrphanLives(yt, { orphanIds, fetchedIds, now })` を `createSchedulerService` クロージャ内の関数として切り出し、`doRefresh` から呼ぶだけにする。
   - **新規 module 化や DI 構造変更はしない**（I/O が `videoFetcher` / `videoRepo` / `logger` に密結合のため、クロージャ内関数に留める）。orphan の I/O 挙動・`logger.withTiming` の event 名・ログ内容を変えない。

### 触ってよい範囲

- `src/main/services/schedulerService.js`
- `src/main/services/refreshTargetPlanner.js`（新規）
- `tests/main/services/refreshTargetPlanner.test.js`（新規）
- `tests/main/services/schedulerService.test.js`（既存テストが通る範囲での最小追記のみ。既存ケースの書き換え禁止）
- `CLAUDE_CODE_HANDOFF.md`（完了追記）

### 触ってはいけない範囲

- `resolveChannels` / `collectVideoIds`（既に分離済み。今回は触らない）
- renderer / preload / IPC channel
- DB migration / cleanup retention policy / quota 判定（Slice 1 の `schedulerMaintenance` 領域）
- `videoRepository` SQL の意味変更（Slice 3 に延期）
- YouTube API 呼び出し回数・順序（`videoFetcher.fetch` の呼び出し回数を増やさない）
- `service class` 化・DI コンテナ導入などの構造大変更

### 削除すべきファイル

なし（インラインコードを関数へ移すだけ。旧定義の残置は不可）。

### 完成条件

- `refresh()` / RSS-only パス / 認証ありパス / orphan 救済 / manual 追跡 ID 合流の外部挙動と副作用が不変。
- `planRefreshTargets` の戻り値で算出される `target` が、現行 `doRefresh` の `target` と同一集合・同一順序になる。
- `scheduler.videoDetails` ログの `target` / `newIds` / `recheckIds` の値が現行と一致する。
- orphan 救済の `markEnded` 件数・`scheduler.orphanCheck.summary` ログ内容が現行と一致する。
- DB schema / IPC contract / YouTube API 呼び出し回数 / renderer は変更なし。
- 新規 planner の focused unit test と既存 `schedulerService` / `imminentPoller` tests が pass。

### IPC 契約

- N/A: request/response・preload exposure・renderer 呼び出し・event 発火/購読ペアいずれも変更なし（理由: main service 内部のリファクタのみ）。

### verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認: 原則 N/A（main service 内部リファクタ・UI/IPC 変更なし）。ただし orphan 救済ロジックに触れるため、不安があれば `npm run dev` で起動エラーが出ないことだけ確認してよい。

### 既知リスク

- planner 抽出で `target` の順序が変わると `videoFetcher.fetch` の引数順が変わる（機能影響はないが、テストが順序依存だと落ちる）。順序維持を完成条件に含めた。
- stale 判定 `now - v.lastCheckedAt > 24h` と `v.status !== 'ended'` の組み合わせを取りこぼすと recheck 対象がずれる。planner test で網羅する。
- orphan 救済を module 化すると DI が膨らむ。今回はクロージャ内関数に留める方針。

### レビュー観点（Claude Code が後で見る）

- `target` 集合・順序が現行と完全一致するか（planner test ＋ schedulerService test で担保）
- orphan 救済の I/O 副作用（upsert / markEnded）とログが不変か
- `doRefresh` がフェーズ呼び出しだけの薄い orchestrator になっているか
- 依頼外ファイル変更・unrelated cleanup が混ざっていないか

### 次アクション

- Codex: 上記スコープで実装＋テスト → verify → handoff に完了追記。
- Claude Code: `/cross-review` でレビュー。問題なければ Slice 3（`videoRepository` query 整理）へ。

---

## 2026-05-29 10:23 レビュー完了（Phase C Slice 1 — Claude Code 作成）

- 対象: `feature/phase-c-main-service-cleanup`
- 作成者: Claude Code
- レビュー結論: **想定プラン（spec Slice 1 完成条件 1〜5）を全て満たす。🔴 なし、merge 可（ユーザー判断待ち）**
- 確認結果:
  - `videoRecordMapper.js` の `toVideoRecord` / `toRssVideoRecord` は抽出元とバイト一致。挙動不変
  - `schedulerMaintenance.js` の cleanup interval / 30日・90日 threshold / quota status 判定は元実装と同一。`nowProvider` 注入はテスタビリティ向上の additive 変更で外部挙動に影響なし
  - 非ゴール遵守: renderer / preload / IPC channel / DB migration / retention policy / YouTube API 呼び出し回数いずれも変更なし。`getQuotaStatus` の公開シグネチャ維持
  - IPC 4 点対称: 変更なしのため N/A（diag:quotaStatus 経路は不変）
  - dead code: 置き換え対象の旧定義は schedulerService から除去済み。残置なし
- 独立 verify（handoff のセルフ申告を再現）:
  - ✅ `npm run lint`
  - ✅ `npm run test`（52 files / 480 passed）
  - ✅ `npm run build`
- レビューで対応した指摘:
  - 🟡 `schedulerService.js:7` の `export { toVideoRecord } from './videoRecordMapper.js'` は呼び出し元ゼロ（imminentPoller・テストとも mapper を直 import）。後方互換 re-export だが内部コードで dead export のため削除。削除後 lint / test（480 passed）再通過を確認
- 次アクション:
  - ユーザー: Phase C Slice 1 の `develop` への merge 可否を判断（merge ゲート ①②③ は充足、④ 待ち）
  - 以降は Slice 2（refresh phase 分離）→ Slice 3（videoRepository query 整理）

---

## 2026-05-29 10:16 完了（Phase C Slice 1: main サービス層 helper 抽出 — Codex 作成）

- 対象: `feature/phase-c-main-service-cleanup`
- 作成者: Codex
- 主題: Phase C の第一スライスとして、`schedulerService` から動画レコード変換と cleanup/quota 状態管理を分離し、後続の refresh phase 分離に備える
- 触ってよい範囲:
  - `src/main/services/schedulerService.js`
  - `src/main/services/imminentPoller.js`
  - `src/main/services/videoRecordMapper.js`
  - `src/main/services/schedulerMaintenance.js`
  - `tests/main/services/videoRecordMapper.test.js`
  - `tests/main/services/schedulerMaintenance.test.js`
  - `docs/superpowers/specs/2026-05-27-debt-repayment-roadmap.md`
  - `docs/superpowers/specs/2026-05-29-phase-c-main-service-cleanup-design.md`
- 触ってはいけない範囲:
  - renderer / preload / IPC channel
  - DB migrations / cleanup retention policy
  - YouTube API fetcher 呼び出し回数
  - `videoRepository` SQL の意味変更（Slice 3 に延期）
- 削除すべきファイル: なし
- 完成条件:
  - `refresh()`、RSS-only、playlist refresh、archive backfill、manual add、quota status の外部 API と副作用を維持する
  - DB schema、IPC contract、YouTube API 呼び出し回数、renderer は変更しない
  - quota error の握り潰しと記録、通常 error の再 throw、backfill abort を維持する
  - `schedulerService` / `imminentPoller` / 新規 helper tests と全体 verify を通す
- IPC 契約:
  - N/A: request/response channel、preload exposure、renderer 呼び出し、event 発火・購読ペアは変更なし
- 変更内容:
  - `videoRecordMapper.js` を追加し、YouTube API detail / RSS entry から DB record への変換を `schedulerService` から抽出
  - `schedulerMaintenance.js` を追加し、cleanup interval / 30日・90日 retention threshold / quota exceeded metadata 判定を抽出
  - `imminentPoller` の `toVideoRecord` 依存を `schedulerService` から mapper module へ変更
  - 後方互換のため `schedulerService.js` から `toVideoRecord` re-export は維持
  - Phase C spec を追加し、ロードマップの Phase C リンクを更新
  - helper module の focused unit test を追加
- セルフ verify:
  - ✅ `npx vitest run tests/main/services/videoRecordMapper.test.js tests/main/services/schedulerMaintenance.test.js tests/main/services/schedulerService.test.js tests/main/services/imminentPoller.test.js`（4 files / 48 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（52 files / 480 passed）
  - ✅ `npm run build`
- 実動確認: N/A（main service helper 抽出のみ。renderer / UI / IPC contract 変更なし）
- レビュー観点:
  - `schedulerMaintenance.clearQuotaExceeded()` が従来どおり「記録済みのときだけ空文字で clear」になっているか
  - `toVideoRecord` re-export を残した判断が後方互換として妥当か
  - Phase C spec の Slice 2/3 境界が十分に小さいか
  - 公開 artifact として spec/handoff に不要な個人情報・secret が混入していないか
- 未解決:
  - `videoRepository` query 整理は未着手。SQL 意味変更リスクがあるため Slice 3 に延期
  - `schedulerService.refresh()` の channel/RSS/recheck/orphan phase 分離は Slice 2 に延期
- 次アクション:
  - Claude Code: `/cross-review` で Phase C Slice 1 をレビュー。問題なければユーザー判断で merge / v1.22.0 に進める

---

## 2026-05-27 22:30 依頼（Phase B: テストカバレッジ拡充 — Claude Code 作成）

- 対象: `develop` から `feature/phase-b-test-coverage` を切って作業すること
- 作成者: Claude Code
- 担当: **Codex（実装）**
- 主題: 全 IPC channel と `src/main/auth.js` 公開関数に最低 1 件のテストを追加し、Phase C/A の大規模リファクタに備えた安全網を整える
- 親 spec: `docs/superpowers/specs/2026-05-27-phase-b-test-coverage-design.md`
- 親ロードマップ: `docs/superpowers/specs/2026-05-27-debt-repayment-roadmap.md`
- 触ってよい範囲:
  - `tests/main/auth.test.js`（新規）
  - `tests/main/ipc/authHandlers.test.js`（新規）
  - `tests/main/ipc/videoHandlers.test.js`（新規）
  - `tests/main/ipc/settingsHandlers.test.js`（新規）
  - `tests/main/ipc/statsHandlers.test.js`（新規）
  - `tests/main/ipc/appHandlers.test.js`（既存に追記。openFolder の既存テストは保持）
  - 上記テストを成立させるために必要な最小限の prod 側変更（例：state 生成ロジックを auth.js 内で関数化するなど）。**ただし prod 側変更が発生する場合は、その理由と差分の小ささを handoff の「変更内容」に明記する**
- 触ってはいけない範囲:
  - 既存 `tests/main/ipc/playlistHandlers.test.js`、`tests/main/services/channelInput.test.js`、`tests/main/ipc/appHandlers.test.js` の **既存テスト内容**（追記のみ可、書き換え不可）
  - `src/main/auth.js` 以外の prod コードのリファクタ（テスト書きやすさのための prod 改変は最小限。広い責務移動は Phase C で扱う）
  - `src/renderer/` 配下（Phase A の範囲）
  - migration ファイル
- 削除すべきファイル: なし
- 完成条件:
  - **構造ゴール**: spec 末尾の「IPC channel × test ファイル対応表」「auth.js export × test 対応表」がすべて「済」になる
  - **テスト総数**: `npm run test` でテストファイル 45 → 50（新規 5）、テスト件数 390 → **440〜470 件**を目標
  - **既存破壊なし**: 既存 390 件のテストが 1 件も赤くならない
  - `npm run lint`（`--max-warnings=0`）、`npm run test`、`npm run build` がすべて pass
  - `startAuthFlow` のテストは spec の「重め」案（http.createServer 実機 + googleapis mock）で書く。mock 複雑度が想定以上だった場合は spec 内で許容している「軽め」案（内部ロジックを export して unit test）へフォールバックしてよい。**フォールバックを採った場合は handoff にその判断と prod 側 export 追加箇所を明記する**
- IPC 契約: N/A（IPC contract 変更なし、テスト追加のみ）
- 変更内容（実装完了時に Codex が埋める）:
  - 追加:
    - `tests/main/auth.test.js`（17 tests）: `credentialsExist` / `getCredentialsPath` / `importCredentialsFromFile` / `getAuthenticatedClient` / `startAuthFlow` / `logout`
    - `tests/main/ipc/authHandlers.test.js`（11 tests）: `auth:check` / `auth:login` / `auth:logout` / `auth:importCredentials`
    - `tests/main/ipc/videoHandlers.test.js`（20 tests）: schedule / diag / videos / channels の各 IPC channel
    - `tests/main/ipc/settingsHandlers.test.js`（15 tests）: settings / favorites import/export
    - `tests/main/ipc/statsHandlers.test.js`（4 tests）: `stats:channelActivity`
  - 追記:
    - `tests/main/ipc/appHandlers.test.js`（既存 1 → 12 tests）: `shell:openExternal` / `notification:show` / `app:version` / `schedule:resetDatabase` / updater 系
  - `docs/superpowers/specs/2026-05-27-phase-b-test-coverage-design.md` の達成判定表を全て `済` に更新
  - prod 側変更: なし
  - フォールバック採否: 不採用。`startAuthFlow` は spec の「重め」案（実 HTTP server + `googleapis` mock + `electron.shell.openExternal` spy）で実装
  - ブランチ作成: `git switch -c feature/phase-b-test-coverage` は `.git/refs/heads/feature/phase-b-test-coverage.lock` の Permission denied で失敗。`.git` 配下への書き込みが sandbox/ACL で拒否されるため、working tree は `develop` 表示のまま変更を作成
- セルフ verify（Codex 実行）:
  - ✅ `npx vitest run tests/main/auth.test.js tests/main/ipc/authHandlers.test.js tests/main/ipc/videoHandlers.test.js tests/main/ipc/settingsHandlers.test.js tests/main/ipc/statsHandlers.test.js tests/main/ipc/appHandlers.test.js`（6 files / 79 passed）
  - ✅ `npm run lint`
  - ✅ `npm run test`（50 files / 468 passed）
  - ✅ `npm run build`
- 実動確認: N/A（テスト追加のみ、UI/挙動は変わらない）
- レビュー観点（Claude Code 側）:
  - 対応表が spec の通り全て埋まっているか
  - mock の漏れで偶発的に CI が pass しているケースがないか（特に `electron` mock の `app.getPath` 未定義で import エラーが出ていないか）
  - prod 側変更が最小限に留まっているか
  - Prettier スタイル（single quote / no semicolon / printWidth 100）に揃っているか
  - テスト命名が「何をしたとき何になるか」で書かれているか（`tests do X when Y` 形式、`test1` 等の無意味な名前はないか）
- 既知リスク:
  - `vi.mock('electron', …)` の `app` / `dialog` / `shell` / `Notification` が網羅されないと import 時にエラー。spec の「実装パターン」セクションにテンプレートあり
  - `googleapis` のモック方法は spec で具体化済み（`generateAuthUrl` / `getToken` / `setCredentials` のみスタブ）
  - `better-sqlite3` の ABI mismatch は今後発生するなら `npm install better-sqlite3 --no-save` で復旧可（2026-05-27 セッションで確認済み）
- 未解決:
  - なし（spec で許容範囲を明示済み）
- 次アクション:
  - Codex: `feature/phase-b-test-coverage` を develop から切って実装。完了したらこのセクションの「変更内容」「セルフ verify」「フォールバック採否」を埋め、status を `ready_for_review` にして Claude Code にレビュー依頼
  - その後 Claude Code が cross-review → ユーザー merge 指示 → v1.21.0 リリース

### Cross-review 結果（2026-05-27 23:00 — Claude Code）

ブランチを develop → `feature/phase-b-test-coverage` に移し、追加 5 テストファイル + appHandlers 拡張をその上に乗せた状態でレビュー。Codex が develop 上で直接作業した点は、`.git/refs/heads/` の Permission denied による失敗の代替なので不問。次回以降は worktree か `git switch -c` を必ず先に通すよう運用 note を残したい。

verify 再実行: `npm run lint` ✅ / `npm run test`（50 files / 468 tests passed） ✅ / `npm run build` ✅

**🔴 重大: なし**（merge ブロッカーなし）

**🟡 軽微（任意 follow-up）**:
1. `tests/main/auth.test.js`: spec の「`chmod 0o600` best-effort 呼び出しを検証」が抜けている。`getAuthenticatedClient` のテストで `fs.chmod(TOKEN_PATH, 0o600)` が呼ばれることをアサートすれば spec 完全準拠
2. `tests/main/ipc/videoHandlers.test.js`: `schedule:get` の `dbBroken: true` / `NOT_INITIALIZED` 分岐や、`videos:addManual` の `NOT_AUTHENTICATED` 分岐などの異常系は個別テスト未実装。spec の「最低 1 件」基準は満たしているが、Phase C で IPC 層を触る前に増やすと安心
3. `tests/main/ipc/authHandlers.test.js` line 132 の `auth:login still returns authenticated when no client is loaded after flow`: これは現状コード挙動を固定するテストだが、`startAuthFlow` が成功して client が null のとき `isAuthenticated: true` を返すのは仕様か実装上の小バグか判断が分かれる。**仕様確認が必要 → user 判断待ち**

**🟢 良好**:
- spec 通り全 IPC channel + auth.js 全公開関数に最低 1 件のテストあり、対応表「済」化と整合
- `vi.hoisted` + `vi.mock('electron', …)` パターンが 6 ファイルで一貫
- テスト命名「does X when Y」形式で意図が読める
- Prettier スタイル準拠（single quote / no semi / printWidth 100）
- `fs.mkdtemp` + `afterEach` cleanup が auth / settings テストで適切
- `startAuthFlow` を spec の「重め」案で実装（実 HTTP server + googleapis mock + 5 ケース。fallback 不採用）
- happy path + 異常系（state mismatch / REFRESH_FAILED / canceled dialog / validation error）両方をカバー
- prod コードは 1 行も触っていない（spec の最小変更原則を完全遵守）

判定: **merge 可**。軽微 3 件は別 commit で fix するか、Phase C 着手時に follow-up するかの user 判断待ち。

---

## 2026-05-26 23:45 完了（全体点検による更新安定化＋UI小整理 — Codex 作成）

- 対象: `feature/imminent-live-poller-and-cleanup`
- 作成者: Codex
- 主題: 全体レビューとして、手動更新/バックグラウンド更新の失敗時に UI 状態が固まるリスクを潰し、動画カードのボタンCSSと未定義CSS変数を整理

### 触った範囲

- `src/main/index.js`
- `src/preload/index.js`
- `src/renderer/hooks/useSchedule.js`
- `src/renderer/components/ScheduleCard.jsx`
- `src/renderer/src/assets/main.css`
- `tests/renderer/hooks/useSchedule.test.js`（新規）

### IPC 契約

- main event 発火: `schedule:error`（`{ error: 'REFRESH_FAILED' }`）
- preload exposure: `window.api.onScheduleError(cb)`
- renderer 購読: `useSchedule`
- 既存 `schedule:updated` は維持。手動 refresh は event 遅延/欠落でも `load()` を直接呼ぶようにして loading を解除する。

### 変更内容

- `useSchedule.refresh()` が `schedule:refresh` の `{ error }` 結果を見て `loading=false` に戻すよう修正。
- 手動 refresh 成功後に `load()` を直接実行し、`schedule:updated` event だけに依存しないようにした。
- `schedule:error` を preload から renderer に公開し、バックグラウンド更新失敗を `useSchedule.error` に反映。
- `schedule:error` の payload を raw `err.message` ではなく汎用コード `REFRESH_FAILED` に変更。
- `ScheduleCard` の「開く」ボタンを `.yt-action-btn--open` に寄せ、inline style を削減。
- `.yt-drag-handle` の未定義 `--sub-text` を既存トークン `--sub` に修正。
- `useSchedule` の mount / refresh 成功 / refresh 失敗 / event reload / error event の回帰テストを追加。

### セルフ verify

- ✅ `npx vitest run tests/renderer/hooks/useSchedule.test.js tests/renderer/ScheduleCard.test.jsx`（2 files / 33 passed）
- ✅ `npm run lint`
- ✅ `npm run test`（44 files / 387 passed）
- ✅ `npm run build`
- ✅ `git diff --check`

### 実動確認

- `npm run dev` は承認付きで実行し、Electron プロセス生成までは確認。
- 20秒確認枠でタイムアウトしたため画面目視までは未確認。残った YouTom Electron プロセスは停止済み。

### レビュー観点

- `schedule:error` の IPC 4 点対称（send / preload / renderer / test）が適切か。
- 手動 refresh 成功時の `load()` 直接実行により、既存 `schedule:updated` event と二重 reload しても副作用がないか。
- `.yt-action-btn--open` が既存の dark/light 表示と一致しているか（実機目視推奨）。

### 未解決

- Electron 画面の目視確認は未完了。

### 次アクション

- Claude Code: 上記観点で cross-review。
- ユーザー: 必要に応じて `npm run dev` を長めに起動してヘッダー/カードボタン/更新操作を目視確認。

---

## 2026-05-26 23:50 レビュー結果（Codex リファクタへの cross-review — Claude Code 作成）

- 対象: `feature/imminent-live-poller-and-cleanup`
- レビューア: Claude Code
- 観点: cross-agent-harness の merge ゲート 4 条件 + project profile のレビュー必須チェック項目

### Merge ゲート確認

- ✅ ① セルフ verify: `npm run lint` / `npm run test`（44 files / 387 passed）/ `npm run build` 全部 pass
- ✅ ② 相互レビュー記録: 本セクションで記録
- ✅ ③ 重大指摘なし（後述）
- ⏳ ④ ユーザー merge 指示: 待ち

### IPC 4 点対称チェック（schedule:error）

- main 発火: `src/main/index.js:212` `mainWindow?.webContents.send('schedule:error', { error: 'REFRESH_FAILED' })` ✓
- preload exposure: `src/preload/index.js:30` `onScheduleError(cb)` ✓
- renderer 購読: `src/renderer/hooks/useSchedule.js:64` `window.api.onScheduleError?.(...)` ✓
- 購読解除ペア: useEffect cleanup で `offError?.()` ✓
- テスト: `tests/renderer/hooks/useSchedule.test.js` `onScheduleError` モック + 5 ケース ✓

### 指摘

🟢 **良好**

- `schedule:error` payload を `err.message`（内部情報漏洩リスクあり）から `REFRESH_FAILED` の汎用コードに変更 — グローバル `security-coding.md` の「エラー漏洩防止」に整合
- `.yt-drag-handle` の未定義 CSS 変数 `--sub-text` → `--sub` 修正は真のバグ修正（CSS 変数フォールバックで色が inherit になっていた）
- `useSchedule.refresh()` で `schedule:updated` event だけに依存せず `await load()` を直接呼ぶ変更で、event 遅延・欠落時に loading 表示が固まるリスクが解消
- `ScheduleCard` の「開く」ボタン inline style → `.yt-action-btn--open` 化は、既存の `.yt-action-btn--notify` / `--fav` / `--viewed` と同じパターンで一貫性あり

🟡 **軽微（merge ブロッカーではない）**

- `useSchedule.refresh()` 成功時、`await load()` と main 側 `schedule:updated` event 経由の `load()` が二重で走る（`videoHandlers.js` の `schedule:refresh` handler が成功時に event を send するため）。動作は正しいが `getSchedule` / `getFeed` の IPC 呼び出しが 1 回多い。気になる場合は refresh 中フラグでイベント駆動の load を抑制する案あり。本 PR では deferred で良い
- `imminentPoller` は失敗時に `schedule:error` を発火しない（`tick()` が `{ error: 'FETCH_FAILED' }` を返すのみ）。バックグラウンド処理として現状のログ留めで十分だが、UI 通知統一を目指すなら follow-up

🔴 **重大** — なし

### 既存機能の回帰確認

- 既存タブ（schedule / missed / archive / favorites / playlist）に影響する変更なし
- `schedule:get` / `schedule:refresh` の戻り値契約は維持（success `{ ok: true }`、失敗 `{ error: 'REFRESH_FAILED' }`）
- `useSchedule.test.js` の 5 ケース（mount / refresh success / refresh error / updated event / error event）で IPC 契約の振る舞いを固定化

### Merge 判断

🟢 **Merge 可** — 重大指摘なし、verify pass、IPC 4 点対称、テスト追加済み。ユーザー指示を待って `develop` へ merge。

### ユーザーへの実機確認推奨項目（merge 前）

- `npm run dev` 起動後に：
  - 「↺ 更新」ボタンを押下 → スピナーが消えて新データが描画される
  - ヘッダー / 動画カードの「開く」ボタンの色味がダーク / ライト両方で従来通り
  - ライブ予定動画の 5 分前頃に🔔ありの状態で待機 → 開始から 1 分以内にデスクトップ通知が出る（imminent poller）

### 次アクション

1. ユーザー: 実機確認 → merge 判断
2. Merge 後: `develop` へ反映 → リリース判断は別セッション

---

## 2026-05-26 23:35 完了（ライブ通知遅延の改善＋全体点検 — Claude Code 作成）

- 対象: `feature/imminent-live-poller-and-cleanup`
- 作成者: Claude Code
- 主題: 配信開始通知の最大遅延を 30 分 → 1 分に短縮する直前ポーラーを追加。並行して dead code 整理と App.jsx ヘッダー UI の CSS 一元化

### 変更したファイル

- `src/main/services/imminentPoller.js`（新規）
- `src/main/services/schedulerService.js`（`toVideoRecord` を named export 化）
- `src/main/index.js`（ポーラーの起動・停止配線）
- `src/renderer/src/App.jsx`（`isAuthenticated` を実値で渡すように修正／ヘッダーボタン inline style を CSS class に置換／未使用 const を削除）
- `src/renderer/src/assets/main.css`（`.yt-header-btn` / `.yt-header-mode` CSS クラスを追加）
- `tests/main/services/imminentPoller.test.js`（新規・12 件）

### 実装概要

- `createImminentPoller`: 1 分間隔で `videoRepo.listVisible()` から `status==='live'` または `scheduledStartTime` が `now-5min ～ now+20min` の `upcoming` を抽出し、`videoFetcher.fetch` で再取得→`upsert`。status が変わった動画があれば `schedule:updated` を webContents 経由で renderer に送る。
- クォータガード: `isQuotaError` で 403 quotaExceeded を握り潰し（schedulerService と同じ判定）、対象 0 件のときは API を呼ばない。
- `inFlight` フラグで重複起動を防止。
- App.jsx の `useNotificationCheck({ isAuthenticated: true })` ハードコードを実値の `isAuthenticated` に修正。これで簡易→フル遷移時にライブベースラインが正しくリセットされる。
- ヘッダーの `更新` / `⚙️` / モード表示の inline style（darkMode ternary 含む）を CSS クラスに置換。既存の `--live-red` / `--btn-bg` / `--btn-color` / `--border` トークンに揃え、ダークモード切替が CSS 側に一本化される。

### IPC 契約

- 既存の `schedule:updated` を流用（main→renderer の send/on ペアは既存）。新規 IPC channel は追加していない。

### クォータ試算

- 1 分間隔 × 24h = 1,440 リクエスト/日 が最悪値（対象 0 件時は呼ばないので実際はもっと少ない）。
- videos.list は 50 件まで 1 ユニット → 1 日 1,440 ユニット (上限 10,000 / 安全枠 6,000 内)。

### Verify 結果

- ✅ `npm run lint`（max-warnings=0）
- ✅ `npm run test`（43 files / 382 passed、imminentPoller 12 件追加）
- ✅ `npm run build`

### 実動確認

- `npm run dev` 未実行。Electron 内部実装（main プロセスのポーラー）が主のため、ブラウザ preview ツールでは検証不可。実動確認はユーザー側で次回 `npm run dev` 時に推奨：
  - ライブ開始予定時刻の 5 分前以降にアプリを起動し、配信開始から 1 分以内に通知が出るか
  - ヘッダーの 更新 / ⚙️ / モードバッジの色がダーク/ライトの両方で従来と同じか

### レビュー観点

- imminentPoller の `inFlight` ガードが二重起動を防げているか（fetch が遅延した状況での挙動）
- `videoRepo.upsert` が `notify` / `is_favorite` を保持していること（schema.sql で UPDATE 句に含まれていないので安全だが念のため）
- ヘッダー CSS クラス変更で旧 inline 色と完全一致しているか（実機で目視）

### 未解決

- なし

### 次アクション

- ユーザー: `npm run dev` で実動確認
- ユーザー判断後に develop merge

---

## 2026-05-24 17:02 完了（プレイリストタブヘッダー集約 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: PlaylistTab ヘッダーから取得/設定ボタンを撤去し、プレイリスト選択ドロップダウンを直置きする最小構成へ変更

### 変更したファイル

- `src/renderer/components/PlaylistTab.jsx`
- `src/renderer/components/PlaylistSettings.jsx`（削除）
- `src/renderer/src/assets/main.css`
- `tests/renderer/PlaylistTab.test.jsx`
- `tests/renderer/PlaylistSettings.test.jsx`（削除）
- `CLAUDE_CODE_HANDOFF.md`

### 実装概要

- `PlaylistSettings` の listMine 取得、`playlist:setConfig` 保存、`playlist:updated` / `playlist:error` 購読を `PlaylistTab` に inline 移植。
- PlaylistTab ヘッダーを「📂 プレイリスト」+ select + YouTube 仕様注記 + 小さな「最終取得」表記に再構成。
- 「🔄 取得」「⚙️ 設定」ボタン、`showSettings` state、設定パネル、`PlaylistSettings` import を撤去。
- select 変更時は `playlist:setConfig` を呼び、既存 main 側の同 ID 再保存時 `service.refresh()` 挙動を維持。`playlistHandlers.js` は変更なし。
- 個別削除 🗑 と `applyVideoUpdate` による楽観更新ロジックは維持。

### Verify 結果

- ✅ `npx vitest run tests/renderer/PlaylistTab.test.jsx`（1 file / 9 passed）
- ✅ `npm run lint`
- ✅ `npm run test`（42 files / 370 passed）
- ✅ `npm run build`

補足: `npm run test` の pretest で Node 24.14.0 用に `better-sqlite3` binding rebuild が走り、成功後に全テスト通過。EPERM は発生していない。

### 実動確認結果

- `npm run dev` は未実行。今回の依頼完了条件はセルフ verify（lint / test / build）まで。

### 残リスク

- 実 Electron 画面での見た目確認は未実施。テストでは取得/設定ボタン非表示、select 常時表示、注記/最終取得表示、setConfig 呼び出し、個別削除、楽観更新を確認済み。

### 次アクション

1. Claude Code: `/cross-review`
2. ユーザー: 必要に応じて `npm run dev` 実動確認
3. ユーザー判断後に develop merge

---

## 2026-05-24 依頼（プレイリストタブヘッダーをドロップダウン1個に集約 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`
- 主題: PlaylistTab ヘッダーから「🔄 取得」「⚙️ 設定」ボタンを削除し、その位置にプレイリスト選択ドロップダウンを直置き。PlaylistSettings コンポーネントは廃止して PlaylistTab に inline 化

### ユーザー判断

「取得、設定ボタンを削除してその位置にセレクトボックスを置けないか？ そこまで簡略化して良い」

### 触ってよい範囲

- 削除:
  - `src/renderer/components/PlaylistSettings.jsx`
  - `tests/renderer/PlaylistSettings.test.jsx`
- 変更:
  - `src/renderer/components/PlaylistTab.jsx` — ヘッダー再構成（dropdown 直置き + 注記）、設定パネル / toggle / 取得ボタン関連 state 撤去
  - `tests/renderer/PlaylistTab.test.jsx` — 新仕様向けテスト

### 触ってはいけない範囲

- main process / preload / IPC contract
- `usePlaylist` の取得・楽観更新ロジック本体
- DB / migration / OAuth スコープ
- 他タブ・他コンポーネント

### 完成条件

1. **PlaylistTab ヘッダー構成**:
   ```
   📂 プレイリスト
   [ドロップダウン: 選んだプレイリスト名 ▼]
   ※「後で見る」「高評価動画」は YouTube 仕様により取得できません
   ```
   - 「🔄 取得」「⚙️ 設定」ボタン削除
   - ドロップダウン直下に注記
2. **挙動**:
   - ドロップダウン選択 → `playlist:setConfig` 呼び出し（同 ID 再選択でも refresh が走る形に。setConfig は同 ID なら clear はしないが refresh は走る既存挙動でよい）
   - 同 ID 再選択を「手動取得」代わりに使えるよう、`setConfig` IPC が同 ID でも `service.refresh()` を呼ぶ既存挙動を確認・維持
3. **未認証時 / プレイリストなし時**:
   - ドロップダウンに「ログインしてください」 or 「プレイリストを選択」プレースホルダー
   - その下に「プレイリストが選ばれていません」等の empty 文言
4. **「最終取得: X分前」表記** はヘッダー下部（ドロップダウン + 注記の下）に小さく残す。完全削除でもよいが、ユーザーが取得タイミングを把握する手がかりとして 残置推奨
5. **個別削除 🗑** は維持（楽観更新パターン）
6. **エラー表示** はヘッダー直下に維持（既存）
7. **`PlaylistSettings.jsx` 完全削除**:
   - import 元（PlaylistTab）からの参照を外す
   - ファイル / テスト削除
   - PlaylistSettings の機能（ドロップダウン取得・config 更新・onUpdated/onError 購読）を PlaylistTab に inline 移植
8. `npm run lint` / `npm run test` / `npm run build` 全パス

### 「最終取得」表記の判断

ユーザーが取得ボタンを消したい意図は「自動でやるから手動制御は要らない」。最終取得時刻は「データの鮮度」を確認する情報として有用なので残置（小さい灰色テキストで）。完全削除を望むなら別途指示。

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### 既知リスク

- 「同 ID 再選択で取得」UX が分かりにくい可能性。注記に「※選択し直すと再取得します」追記するか、24h 自動同期に任せる
- `PlaylistSettings.jsx` 削除に伴い import 残骸が他ファイルに無いか確認（SettingsModal は既に外している）

### レビュー観点

- ヘッダーがドロップダウン + 注記の最小構成になっているか
- 取得/設定ボタン・showSettings state 完全撤去
- PlaylistSettings.jsx / test 削除済み、参照残なし
- 楽観更新ロジック（前回タスク）が壊れていない
- 注記文言「※「後で見る」「高評価動画」は…」が表示される

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review`
3. ユーザー実動確認 → develop merge

---

## 2026-05-24 16:53 完了（プレイリスト楽観更新化 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: PlaylistTab のお気に入り/通知/既読/個別削除を local state 更新に変更し、操作ごとの全件 IPC 再取得を避ける

### 変更したファイル

- `src/renderer/hooks/usePlaylist.js`
- `src/renderer/components/PlaylistTab.jsx`
- `src/renderer/hooks/useTabState.js`
- `tests/renderer/PlaylistTab.test.jsx`
- `tests/renderer/hooks/usePlaylist.test.js`
- `CLAUDE_CODE_HANDOFF.md`

### 実装概要

- `usePlaylist.applyVideoUpdate(id, patch)` を追加し、`videos` / `removedVideos` の両方へ state setter だけで patch を反映するようにした。
- `PlaylistTab` の `handleCardAction` を撤去し、⭐ / 🔔 / ✓ は親 action の返り値を受けて `applyVideoUpdate` する形に変更した。
- `useTabState.handleToggleNotify()` と `handleMarkViewed()` が更新後の値を返すようにし、既存タブの local patch 挙動は維持した。
- `usePlaylist.deleteOne()` は `playlist:deleteOne` 後に `videos` / `removedVideos` を `filter` で除去し、reload しないようにした。
- `refresh` / `reload` は明示的な全件再取得用途として維持した。

### Verify 結果

- ✅ `npm run lint`
- ⚠️ `npm run test` は未完了。pretest の `better-sqlite3` rebuild で `better_sqlite3.node` がロックされ、`EPERM: operation not permitted, unlink ...better_sqlite3.node` で停止。`H:\ClaudeCode\Youtube\youtube-schedule\node_modules\electron\dist\electron.exe` のプロセスが起動中のため、ユーザー側で dev サーバ / Electron を停止してから再実行が必要。
- ✅ `npx vitest run tests/renderer/hooks/usePlaylist.test.js tests/renderer/PlaylistTab.test.jsx`（2 files / 15 passed）
- ✅ `npm run build`

### 実動確認結果

- `npm run dev` は未実行。上記と同じ Electron プロセスロックがあるため、起動中の dev サーバを止めてから確認する必要がある。

### 残リスク

- full `npm run test` はロック解除後の再実行が必要。
- UI 実動確認は未実施。テストでは toggle / 個別削除後に `playlist:get` が再呼び出しされないことを確認済み。

### 次アクション

1. ユーザー: 起動中の `npm run dev` / YouTom Electron を停止
2. Codex または Claude Code: `npm run test` を再実行
3. Claude Code: `/cross-review`
4. ユーザー: 実動確認後に develop merge 判断

---

## 2026-05-24 依頼（プレイリストタブで楽観的更新化 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`
- 主題: PlaylistTab のお気に入り/通知/既読ボタン押下時に走る `reload()` を撤去し、他タブと同じく optimistic な local state 更新で再描画する

### ユーザー判断

「お気に入りや通知ボタンを押すたびに画面遷移が走っているのか？ 他ページに合わせてそういうのはなしにしてほしい」

→ 現状: `PlaylistTab` の `handleCardAction` が toggle 後に `usePlaylist.load()` 呼び出し → 全件 IPC 再取得 → リスト全体が再描画され画面遷移っぽく見える
→ 既存タブは `useTabState` 内の handleToggleFavorite 等が `setMissedVideos((prev) => prev.map(patchFn))` のパターンで再取得なしの楽観更新

### 触ってよい範囲

- `src/renderer/hooks/usePlaylist.js` — `applyVideoUpdate(id, patch)` 関数を追加し、`videos` / `removedVideos` 配列の対応要素を patch
- `src/renderer/components/PlaylistTab.jsx` — `handleCardAction` を撤去、各 toggle で「action 呼び出し → 返り値で applyVideoUpdate」
- `src/renderer/hooks/useTabState.js` — `handleToggleNotify` / `handleMarkViewed` が新値を return するよう微修正（既存 favorite と同パターン）
- `tests/renderer/PlaylistTab.test.jsx` / `tests/renderer/hooks/usePlaylist.test.js` — テスト更新

### 触ってはいけない範囲

- main process / preload / IPC contract
- `usePlaylist.load` / `refresh` / `deleteOne` の既存挙動（明示同期/削除では reload を残してよい）
- 他タブ（schedule / missed / archive / favorites）の挙動
- OAuth スコープ

### 完成条件

1. `usePlaylist.applyVideoUpdate(id, patch)` 追加（state setter のみ、IPC 呼び出しなし）
2. PlaylistTab の各 toggle:
   - `onToggleFavorite(id)` → 返却 newVal で `applyVideoUpdate(id, { isFavorite: newVal })`
   - `onToggleWatch(id)` → 返却 newVal で `applyVideoUpdate(id, { isNotify: newVal })`
   - `onMarkViewed(id, viewed)` → `applyVideoUpdate(id, { viewedAt: viewed ? Date.now() : null })`
3. useTabState の `handleToggleNotify` / `handleMarkViewed` が新値を return（既存 favorite と同パターン）
4. 個別削除 `deleteOne` は配列から要素を取り除く（filter）。reload より local 操作のほうが「画面遷移」っぽさが減る
5. 取得（`refresh`）ボタンは全件再取得が目的なので reload を維持
6. `npm run lint` / `npm run test` / `npm run build` 全パス
7. テストで「toggle 後に IPC `playlist:get` が再呼び出しされない」ことを確認

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### レビュー観点

- toggle 押下後に `playlist:get` IPC が呼ばれていないこと（test で getConfig/get 呼び出しカウント確認）
- local state 更新で UI が即時反映
- 既存 4 タブの挙動が無傷
- `videos` と `removedVideos` の両方が patch 対象

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review`
3. ユーザー実動確認 → develop merge

---

## 2026-05-24 16:39 完了（プレイリスト切替時クリア — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: プレイリスト切替時に旧プレイリスト由来の動画が混在する問題を解消

### 変更したファイル

- `src/main/repositories/playlistRepository.js`
- `src/main/ipc/playlistHandlers.js`
- `tests/main/repositories/playlistRepository.test.js`
- `tests/main/ipc/playlistHandlers.test.js`
- `CLAUDE_CODE_HANDOFF.md`

### 実装概要

- `playlistRepository.clearAllPlaylistFlags()` を追加し、全 `videos` の `in_playlist` / `playlist_added_at` / `playlist_removed_at` のみをリセットするようにした。
- `playlist:setConfig` で保存前の config を読み、既存 `playlistId` と新規 `payload.playlistId` が異なる場合だけ `clearAllPlaylistFlags()` を呼ぶようにした。
- 同じ playlistId の再保存と初回設定では clear しない。
- `is_favorite` / `notify` は触らず、既存のお気に入り・通知・アーカイブ系フラグを保持する。

### Verify 結果

- ✅ `npm run lint`
- ✅ `npm run test`（43 files / 370 passed）
- ✅ `npm run build`

補足: 対象テスト初回実行時、既存の Electron プロセスが `better_sqlite3.node` をロックしていたため、`youtube-schedule` 配下の Electron プロセスのみ終了してから再実行。以後 `better-sqlite3 Node binding is ready.` で全体 test は通過。

### 実動確認結果

- `npm run dev` は未実行。今回の完了条件は lint / test / build のセルフ verify まで。

### 残リスク

- プレイリスト切替直後から refresh 完了まで、プレイリストタブが一時的に空になる可能性はある。既知リスク通り、取得中表示で吸収する前提。

### 次アクション

1. Claude Code: `/cross-review`
2. ユーザー: 必要に応じて `npm run dev` 実動確認
3. ユーザー判断後に develop merge

---

## 2026-05-24 依頼（プレイリスト切替時の旧データクリア — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`
- 主題: プレイリスト切替時に旧プレイリスト由来の動画が残る問題を解消し、常に「対象プレイリストの内容のみ」表示にする

### ユーザー判断

「取得したら対象のプレイリストに登録された配信のみを表示で良い。それぞれのプレイリストの内容を合算する必要はない」

→ プレイリスト A（200 件）→ B（50 件）に切り替えた場合、現状は A の 200 件が `playlist_removed_at` 付きで残り、B の 50 件と混ざって表示される。これを「切替後は B の内容だけ」にする

### 触ってよい範囲

- `src/main/repositories/playlistRepository.js` — `clearAllPlaylistFlags()` 関数追加
- `src/main/ipc/playlistHandlers.js` — `playlist:setConfig` で playlist_id 変更を検知して clear を呼ぶ
- `tests/main/repositories/playlistRepository.test.js`
- `tests/main/ipc/playlistHandlers.test.js`

### 触ってはいけない範囲

- 既存 IPC contract（追加のみ、breaking 変更しない）
- renderer（main 側でクリアすれば自動で表示反映される）
- DB migration（既存カラム再利用、新規不要）
- OAuth スコープ
- 既存 favorites / notify / archive 系の挙動

### 完成条件

1. **`playlistRepository.clearAllPlaylistFlags()`** 追加:
   - すべての videos に対し `in_playlist=0, playlist_added_at=NULL, playlist_removed_at=NULL` で UPDATE
   - 戻り値: `{ cleared: number }`（変更件数）
   - お気に入り (`is_favorite`) や通知 (`notify`) などの既存フラグは触らない
2. **`playlist:setConfig` ハンドラ修正**:
   - 現在の config を取得 → 新しい `payload.playlistId` と異なる場合のみ `clearAllPlaylistFlags()` を呼ぶ
   - 同じ playlist_id を再保存した場合（enabled toggle 等）はクリアしない
   - 初回設定（既存 config なし）もクリア不要
3. **テスト**:
   - clearAllPlaylistFlags: in_playlist と playlist_removed_at がリセット、is_favorite と notify は保持される
   - playlist:setConfig: 既存 playlistId と異なる playlistId 設定 → clear が呼ばれる
   - 同じ playlistId 再保存 → clear が呼ばれない
   - 初回設定 → clear が呼ばれない
4. `npm run lint` / `npm run test` / `npm run build` 全パス

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### 既知リスク

- 動画行は残してフラグだけクリア。is_favorite=1 や notify=1 の動画は別タブで引き続き残る
- clear 直後で fetch 完了前の数秒間、プレイリストタブが空に見える（取得中表示があるので問題なし）

### レビュー観点

- clear が触るカラムが `in_playlist` / `playlist_added_at` / `playlist_removed_at` のみ
- 既存 playlistId と新規 playlistId の比較ロジックが正しい

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review`
3. ユーザー実動確認 → develop merge

---

## 2026-05-24 16:29 完了（プレイリストタブ UI 簡素化 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: ユーザー判断に合わせてプレイリストタブの UI をさらに簡素化

### 変更したファイル

- `src/renderer/components/PlaylistTab.jsx`
- `src/renderer/components/PlaylistSettings.jsx`
- `src/renderer/src/assets/main.css`
- `tests/renderer/PlaylistTab.test.jsx`
- `tests/renderer/PlaylistSettings.test.jsx`
- `CLAUDE_CODE_HANDOFF.md`

### 実装概要

- `PlaylistTab` から「削除済みのみ」フィルタ行、一括削除ボタン、一括削除 confirm、関連 state / handler を削除。
- 削除済み動画は通常リストに混在表示したまま、個別 🗑 と confirm モーダルは維持。
- プレイリスト UI 文言を「同期」から「取得」へ変更（取得ボタン、取得中、最終取得、Toast、未取得表示）。
- `PlaylistSettings` をドロップダウン（ラベル「取得するプレイリスト」）と注記中心に簡素化。
- プレイリスト選択保存は常に `enabled: true` を送る形にし、「同期を有効にする」チェックボックスと「YouTube でプレイリストを作成」リンクを削除。
- 旧フィルタ行・旧設定アクション用の未使用 CSS クラスを削除。
- main process / preload / DB / IPC contract は変更なし。`playlist:cleanup` / `deleteRemoved` / `cleanupRemoved` 本体は残置。

### Verify 結果

- ✅ `npm run lint`
- ✅ `npm run test`（43 files / 366 passed）
- ✅ `npm run build`

補足: `npm run test -- tests/renderer/PlaylistTab.test.jsx tests/renderer/PlaylistSettings.test.jsx` の初回 pretest で `better-sqlite3` Node binding rebuild が実行され成功。EPERM は出ていない。全体 test では `better-sqlite3 Node binding is ready.`。

### 実動確認結果

- `npm run dev` は未実行。今回の依頼完了条件はセルフ verify（lint / test / build）まで。

### 残リスク

- Electron 実画面でのダークモード崩れ確認は未実施。CSS 上は旧フィルタ行関連クラスを削除し、既存のボタン・パネルスタイルに寄せている。

### 次アクション

1. Claude Code: `/cross-review`
2. ユーザー: 必要に応じて `npm run dev` 実動確認
3. ユーザー判断後に develop merge

---

## 2026-05-24 依頼（プレイリストタブ UI 簡素化 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`
- 主題: ユーザー判断で UI をさらに削ぎ落とす:
  1. 「削除済みのみ」フィルタ削除（フィルタ行全体を撤去）
  2. 「同期」文言を「取得」に統一
  3. 設定パネルはプレイリスト選択ドロップダウン + 注記のみ

### ユーザー判断（要約）

- 「削除済みのもののみってのはいらない」
- 「テキストの同期も取得でいい」
- 「メニューとして出さなくても取得するプレイリストのセレクトボックスだけで事足りる」

### 触ってよい範囲

- `src/renderer/components/PlaylistTab.jsx` — フィルタ行・一括削除モーダル・関連 state 撤去、文言「同期」→「取得」
- `src/renderer/components/PlaylistSettings.jsx` — 「同期を有効にする」チェックボックスと「YouTube でプレイリストを作成」外部リンク削除、ドロップダウン + 注記のみ残す
- `tests/renderer/PlaylistTab.test.jsx` / `tests/renderer/PlaylistSettings.test.jsx` — 撤去機能のテスト削除、新動作テスト追加

### 触ってはいけない範囲

- `playlist:cleanup` IPC handler / `playlistRepository.deleteRemoved()` 本体（残しておく。将来再使用の可能性）
- `usePlaylist.cleanupRemoved` 関数（残置 OK）
- 個別削除（`deleteOne`）は維持
- main process / preload / DB
- 注記「※「後で見る」「高評価動画」は YouTube 仕様により取得できません」は **維持**

### 完成条件

#### PlaylistTab

1. フィルタ行（`[全て] [削除済みのみ ●N] [💡 削除済みを一括削除]`）を完全削除
2. カードリスト表示 = `is_favorite=1 OR in_playlist=1 OR playlist_removed_at IS NOT NULL` のまま（削除済みは ⚠️バッジで識別、混在表示）
3. 削除済みカードの個別 🗑（confirm モーダル付き）は維持
4. 一括削除モーダル・state（`confirmingCleanup`）・関連 handler を削除
5. ヘッダーの `[🔄 同期]` ボタン → `[🔄 取得]`
6. 「同期中...」表示 → 「取得中...」
7. Toast「プレイリストを同期しました」→「プレイリストを取得しました」
8. ヘッダー文言「最終同期: ...」→「最終取得: ...」

#### PlaylistSettings

9. 「同期を有効にする」チェックボックス削除（プレイリスト選択時に常に enabled=true で保存）
10. 「📂 YouTube でプレイリストを作成」外部リンクボタン削除
11. 残る要素: ドロップダウン（ラベル「取得するプレイリスト」）+ 注記のみ
12. Toast「プレイリスト同期設定を保存しました」→「プレイリストを設定しました」

#### 共通

13. lint / test / build パス
14. 既存テストで「削除済みフィルタ・一括削除・enabled toggle・外部リンク」関連を更新／削除

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### レビュー観点

- フィルタ行関連の state / handler / モーダル / CSS クラスに残骸がないか
- 文言「同期 → 取得」の漏れ（Toast / ボタン / aria-label / placeholder すべて）
- PlaylistSettings がドロップダウンと注記だけのシンプル構成になっているか
- ダークモード崩れなし

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review`
3. ユーザー実動確認 → develop merge

---

## 2026-05-24 16:19 完了（プレイリスト設定をタブ内に移動 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: 設定モーダルではなく `PlaylistTab` 内で `PlaylistSettings` を表示する配置へ変更

### 変更したファイル

- `src/renderer/components/PlaylistTab.jsx`
- `src/renderer/src/App.jsx`
- `src/renderer/src/assets/main.css`
- `tests/renderer/PlaylistTab.test.jsx`
- `CLAUDE_CODE_HANDOFF.md`

### 実装概要

- `PlaylistTab` に `PlaylistSettings` を import し、未設定時は設定パネルを最初から表示するよう変更。
- 設定済み時はヘッダーの `⚙️ 設定` ボタンで `PlaylistSettings` パネルを開閉するよう変更。
- `App.jsx` の `openSettings('playlist')` 導線を削除し、`PlaylistTab` へ `isAuthenticated` を渡す形に変更。
- 設定パネル用の軽い CSS を追加。
- `PlaylistTab.test.jsx` に未設定時の設定パネル表示、設定済み時の toggle テストを追加。
- `SettingsModal.jsx` は確認済み。`PlaylistSettings` import / `playlist` タブ / `📂 プレイリスト` 設定タブ表示は残っていない。

### Verify 結果

- ✅ `npm run lint`
- ✅ `npm run test`（43 files / 366 passed）
- ✅ `npm run build`

補足: `npm run test -- tests/renderer/PlaylistTab.test.jsx` 初回実行時に `pretest` が `better-sqlite3` Node binding rebuild を実行したが、EPERM は出ず成功。以後の全体 test では `better-sqlite3 Node binding is ready.`。

### 実動確認結果

- Electron 実動確認（`npm run dev`）は未実施。今回の依頼範囲ではセルフ verify まで実施。

### 残リスク

- UI 実動確認では未確認のため、Claude Code cross-review またはユーザー実動確認でプレイリストタブ内の設定パネル表示、ダークモード、設定保存後の再読み込みを目視確認する。

### 次アクション

1. Claude Code: `/cross-review`
2. ユーザー: 必要に応じて `npm run dev` で実動確認
3. ユーザー判断後に develop merge

---

## 2026-05-24 依頼（プレイリスト設定をタブ内に移動 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: 設定モーダルから「📂 プレイリスト」タブを撤去し、設定 UI を PlaylistTab 内に移動

### ユーザー判断

「設定を置くのは設定モーダルじゃなくてプレイリストタブ内でいい」

理由（推測）: プレイリスト設定はプレイリストタブを使うときに変更したい流れが自然、設定モーダルに分散させると導線が遠い

### 触ってよい範囲

- `src/renderer/components/SettingsModal.jsx` — 「📂 プレイリスト」タブ定義と PlaylistSettings の import を削除
- `src/renderer/components/PlaylistTab.jsx` — `PlaylistSettings` を import して `showSettings` state で開閉表示
- `src/renderer/src/App.jsx` — `openSettings('playlist')` を呼んでいる箇所があれば「プレイリストタブを開いて設定パネル展開」フローに変更（PlaylistTab に `defaultSettingsOpen` prop を渡す等）
- `tests/renderer/PlaylistTab.test.jsx` — 設定 UI 表示・開閉テスト追加
- `tests/renderer/SettingsModal.test.jsx`（あれば）— プレイリストタブ削除に追従

### 触ってはいけない範囲

- `PlaylistSettings.jsx` の中身本体（設定 UI の挙動はそのまま使い回し）
- main process / preload / IPC contract
- 既存タブ動作

### 完成条件

1. **設定モーダル**から「📂 プレイリスト」タブ削除。残るタブは `表示 / チャンネル / データ / 接続 / アプリ情報` の 5 個
2. **PlaylistTab** の挙動:
   - **未設定時**: empty state を「⚙️ 設定パネル」が**最初から開いた状態**で表示。中に `PlaylistSettings` を描画して、ここからプレイリスト選択できる
   - **設定済み時**: ヘッダーの `[⚙️ 設定]` ボタンで `PlaylistSettings` パネルを展開・折り畳み（toggle）。クリックで開く/閉じる
3. `PlaylistSettings` の中身（チェックボックス + ドロップダウン + 注記 + YouTube 作成リンク）はそのまま流用
4. 開閉状態は component state（永続化不要）
5. 既存テスト pass、新規テストで未設定/設定済みの settings UI が出ること、開閉動作を確認
6. `npm run lint` / `npm run test` / `npm run build` 全パス

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### レビュー観点

- 設定モーダルからプレイリストタブが完全に消え、6 → 5 タブになる
- `openSettings('playlist')` のような呼び出しが残っていないか
- PlaylistTab の empty state がユーザーを設定動線に自然に誘導するか
- ヘッダー「⚙️ 設定」ボタンが toggle として機能するか
- ダークモード崩れなし

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review`
3. ユーザー実動確認 → develop merge

---

## 2026-05-24 クロスレビュー結果（プレイリスト取り込み専用化 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase3-4`（取り込み専用化、未コミット）
- セルフ verify 再実行: ✅ `npm run lint` / ✅ `npm run test`（43 files / 365 passed）
- **🔴 重大指摘: なし**
- 過去 UX 統合レビューは superseded

### 確認事項

| 項目 | 状態 |
|------|------|
| `FavoritePlaylistTab.jsx` / `PlaylistExportModal.jsx` + テスト削除 | ✅ |
| `playlist:exportFavorites` IPC 削除 | ✅（preload `exportFavorites` は別チャンネル `favorites:export` の既存機能なので残存正常） |
| `PlaylistSettings.jsx` のエクスポートボタン削除 | ✅ |
| App.jsx の `handleToggleFavoriteWithPlaylistHint` / `playlistSyncToastShown` 撤去 | ✅ |
| お気に入りタブ = `is_favorite=1` のみ（素の状態） | ✅ |
| 📂 プレイリストタブ = 取り込み専用、タブ列最後尾（お気に入りの後ろ） | ✅ |
| 設定モーダル「📂 プレイリスト」タブ・同期設定維持 | ✅ |
| spec doc 更新（取り込み専用スコープへ） | ✅ |

### 🟢 良好な実装

- FavoritePlaylistTab を完全に削除して App.jsx の dangling import が出ていない
- 復活した PlaylistTab は export 関連の痕跡なし
- 既存タブ並び `feed / schedule / missed / archive / stats / favorites / playlist` の末尾配置がユーザー要望通り
- 設定モーダルの「📂 プレイリスト」タブ短縮済み、はみ出し解消見込み
- 365 件のテストは縮小後でも妥当な範囲（UX 統合の 374 から FavoritePlaylistTab.test + PlaylistExportModal.test + exportFavorites IPC test の分を引いた数）

### 触ってはいけない範囲の確認

- ✅ main process / DB / migration / OAuth スコープ未変更
- ✅ 既存タブ（schedule / missed / archive / stats / new-videos）未変更
- ✅ `release.yml` / `ci.yml` 未変更
- ✅ usePlaylist 取り込み・同期・削除動線本体は維持

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ✅ 🔴 なし |
| ④ | ユーザー merge 指示 | ⏳ 実動確認後 |

### 次アクション

ユーザーが `npm run dev` で実動確認 → 問題なければ develop merge → Phase 5（v1.19.0 リリース）

---

## 2026-05-24 16:06 完了（プレイリスト取り込み専用化 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: ユーザー判断に基づき、プレイリスト同期を YouTube → YouTom の取り込み専用へ縮小。エクスポートを全廃し、⭐ お気に入り統合を解除して 📂 プレイリストをタブ列最後尾へ独立復活。
- 触ってよい範囲: playlist renderer UI / playlist IPC export 削除 / preload export 削除 / tests / spec doc / handoff
- 触ってはいけない範囲: OAuth scope / DB migration / `usePlaylist` の取り込み・同期・削除動線本体 / 既存タブ挙動（export 削除以外の IPC contract）

### 完成条件

- 通常動作: ⭐ お気に入りタブは `is_favorite=1` のみを表示する従来仕様へ戻し、📂 プレイリストタブは ⭐ の後ろ、タブ列最後尾に表示する。
- usage preconditions: OAuth `youtube.readonly` 据え置き。プレイリスト未設定時は empty state から設定へ誘導する。
- error handling: `usePlaylist` の error 表示、手動同期、一括削除、個別削除 confirm を独立 PlaylistTab 内で維持する。
- no-regression checks: schedule / missed / archive / stats / new-videos のタブ挙動は変更せず、`playlist:exportFavorites` と renderer export UI だけを撤去する。

### 変更したファイル

- `src/renderer/src/App.jsx`
- `src/renderer/components/PlaylistTab.jsx`（新規）
- `src/renderer/components/PlaylistSettings.jsx`
- `src/renderer/components/SettingsModal.jsx`
- `src/main/ipc/playlistHandlers.js`
- `src/preload/index.js`
- `tests/renderer/PlaylistTab.test.jsx`（新規）
- `tests/renderer/PlaylistSettings.test.jsx`
- `tests/main/ipc/playlistHandlers.test.js`
- `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- 削除: `src/renderer/components/FavoritePlaylistTab.jsx`
- 削除: `src/renderer/components/PlaylistExportModal.jsx`
- 削除: `tests/renderer/FavoritePlaylistTab.test.jsx`
- 削除: `tests/renderer/PlaylistExportModal.test.jsx`

### 実装概要

- `App.jsx` から `FavoritePlaylistTab`、`handleToggleFavoriteWithPlaylistHint`、`playlistSyncToastShown` 導線を撤去し、従来のお気に入り一覧・並び替え UI を復元。
- タブ定義に `{ key: 'playlist', label: '📂 プレイリスト', mode: 'full' }` を ⭐ お気に入りの後ろへ追加し、`PlaylistTab` を render。
- `PlaylistTab` は `usePlaylist(active)` を使い、ヘッダー、同期/設定ボタン、全て/削除済みフィルタ、削除済み一括削除、個別 🗑 confirm、未設定 empty state を提供。エクスポート導線は持たない。
- `PlaylistSettings` / `SettingsModal` から playlist export modal と export ボタンを削除し、ドロップダウン同期設定と YouTube プレイリスト作成リンクは維持。
- `playlist:exportFavorites` IPC と preload `playlist.exportFavorites` を削除。`playlist:deleteOne` など取り込み専用の削除動線は維持。
- spec doc を「取り込み専用」スコープへ更新し、エクスポートは検討後削除した設計経緯として短く記録。

### セルフ verify

- ✅ `npm run lint`
- ✅ `npm run test`（43 files / 365 passed）
- ✅ `npm run build`

### 実動確認

- Electron 実動確認（`npm run dev`）は未実施。今回の完了指定 verify は lint/test/build まで。Claude Code 側レビュー時にタブ列最後尾、設定モーダル、同期/削除操作の実画面確認を推奨。

### レビュー観点

- ⭐ お気に入りタブが playlist union ではなく `is_favorite=1` のみになっているか。
- 📂 プレイリストタブが ⭐ お気に入りの後ろ、タブ列最後尾にあるか。
- `playlist:exportFavorites` / `PlaylistExportModal` / `FavoritePlaylistTab` / 初回 toast の参照が残っていないか。
- 設定モーダル「📂 プレイリスト」でドロップダウン同期設定と作成リンクが継続しているか。

### 未解決

- なし。コミットは作成していない。

### 次アクション

- Claude Code: `/cross-review` で取り込み専用化差分をレビューし、必要なら `npm run dev` で実動確認。

---

## 2026-05-24 依頼（プレイリスト同期スコープ縮小: 取り込み専用化 + タブ分離 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`（UX 統合分まで未コミットで残っている上に修正）
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: ユーザー判断で「双方向同期は厳しい、取り込み専用に絞る」とスコープ縮小。エクスポート機能を全削除し、タブ統合を元に戻して 📂 プレイリストを独立タブ（タブ列の末尾）にする
- 制約据え置き: OAuth `youtube.readonly`、書き込み API なし

### ユーザー判断（要約）

- 自動で双方向同期できないならエクスポート手動運用は受け入れがたい
- 機能スコープを「YouTube プレイリストを YouTom に読み込むだけ」に絞る
- 📂 プレイリストタブはタブ列の **一番うしろ**（⭐ お気に入りより後）に配置

### 触ってよい範囲（削除 / 復帰 / 変更）

**削除（エクスポート関連を全廃）**:
- `src/renderer/components/PlaylistExportModal.jsx` + `tests/renderer/PlaylistExportModal.test.jsx`
- `src/renderer/components/FavoritePlaylistTab.jsx` + `tests/renderer/FavoritePlaylistTab.test.jsx`（統合タブを廃止）
- `src/main/ipc/playlistHandlers.js` 内の `playlist:exportFavorites` ハンドラ
- `src/preload/index.js` 内の `playlist.exportFavorites`
- `src/renderer/components/PlaylistSettings.jsx` 内の「📤 ⭐お気に入りをエクスポート」ボタンおよび関連 state
- `src/renderer/src/App.jsx` 内の `handleToggleFavoriteWithPlaylistHint` および `playlistSyncToastShown` 関連ロジック
- `tests/main/ipc/playlistHandlers.test.js` の exportFavorites 関連テスト

**新規作成（独立 📂 プレイリストタブを復活）**:
- `src/renderer/components/PlaylistTab.jsx` — 取り込み専用の閲覧タブ
- `tests/renderer/PlaylistTab.test.jsx`

**変更**:
- `src/renderer/src/App.jsx`:
  - お気に入りタブを元の `is_favorite=1` のみのシンプル仕様に戻す（FavoritePlaylistTab を import せず既存 favorites JSX を復元）
  - タブ列に `{ key: 'playlist', label: '📂 プレイリスト', mode: 'full' }` を **末尾**（`favorites` の **後ろ**）に追加
  - `playlist` タブ active 時に `PlaylistTab` を render
- `src/renderer/components/SettingsModal.jsx`: 「📂 プレイリスト」タブラベルは現状維持。export ボタン削除に伴う state 整理

### 触ってはいけない範囲

- main process / preload / IPC contract（`exportFavorites` 削除以外は変更しない）
- DB migration / videos_fts / cleanup
- OAuth スコープ
- 他タブ（schedule / missed / archive / stats / new-videos）
- `usePlaylist.js` の挙動本体（取り込み・同期・削除動線はそのまま）

### 完成条件

1. ⭐ お気に入りタブが Phase 3+4 着手前の状態（`is_favorite=1` のみ）に戻る
2. 📂 プレイリストタブが復活し、タブ列の **最後尾**（⭐ お気に入りの後ろ）に表示される
3. PlaylistTab の構成:
   - ヘッダー: 設定状況 + `[🔄 同期]` `[⚙️ 設定]` ボタン
   - フィルタ: `[全て]` `[削除済みのみ ●N]` + 削除済み選択時のみ `[💡 削除済みを一括削除]`
   - カード: ScheduleCard 再利用、削除済みは ⚠️ バッジ + 個別 🗑（confirm モーダル付き）
   - エクスポートボタンなし
   - 未設定時の empty state（設定誘導）
4. 設定モーダル「📂 プレイリスト」タブのドロップダウン同期設定は維持。「📤 ⭐お気に入りをエクスポート」ボタンのみ削除
5. App.jsx から `handleToggleFavoriteWithPlaylistHint` / `playlistSyncToastShown` 関連を撤去。⭐ on/off は元の `handleToggleFavorite` のみ
6. 既存テストを通す。削除されるテストファイル分テスト数は減ってよい（FavoritePlaylistTab.test.jsx / PlaylistExportModal.test.jsx / exportFavorites IPC テスト）
7. `npm run lint` / `npm run test` / `npm run build` 全パス

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### spec doc 更新

`docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md` のヘッダー・目的・コンポーネント表・UI セクションを「取り込み専用」に書き換える。エクスポート関連の記述は「設計過程で検討したが、書き込みスコープ拡張コストを避けるため削除」と短く残してよい

### 既知リスク

- ユーザー DB に `playlistSyncToastShown` 設定が残るが、機能廃止のためそのまま放置で可（既存設定は無害）
- FavoritePlaylistTab を消す前に App.jsx から確実に参照を外すこと（dangling import 防止）

### レビュー観点

- App.jsx の favorites タブが Phase 3+4 着手前の挙動と同等か
- 📂 プレイリストタブがタブ列の最後尾にあるか
- PlaylistTab に export 関連の残骸がないか
- 設定モーダル「📂 プレイリスト」タブのドロップダウン・同期設定は機能継続
- 既存テストが pass、削除した範囲のテストファイルが gone

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` で再レビュー → 既存「2026-05-24 クロスレビュー結果（UX 統合）」セクションは superseded として記録
3. ユーザー判断後 develop merge → 実動確認 → v1.19.0 リリース

---

## 2026-05-24 クロスレビュー結果（プレイリスト UX 統合 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase3-4`（UX 統合変更、未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（45 files / 374 passed、+6 件）
- 完成条件: ほぼ充足
- **🔴 重大指摘: なし**
- **🟡 軽微指摘: 1 件**（dead code 残存）

### 🟡 軽微1: PlaylistTab.jsx / PlaylistTab.test.jsx が dead code として残存

- `src/renderer/components/PlaylistTab.jsx` と `tests/renderer/PlaylistTab.test.jsx` が untracked のまま
- App.jsx は新 `FavoritePlaylistTab` を import しており PlaylistTab を参照していない
- テストは独立して pass しているが、内容は古い独立タブ向け
- **Karpathy 原則「自分が作ったゴミだけ片付ける」**: PlaylistTab は Phase 3+4 で Codex 自身が作ったファイルなので、UX 統合で不要になった以上削除すべき
- 影響: merge 後にコード読みで混乱を招く
- 修正案: 両ファイル削除（Claude Code 側で merge 前に直接削除可）

### 🟢 良好な実装

- `mergeFavoriteAndPlaylist` で `is_favorite=1` と `in_playlist=1` を union/dedup、`isInPlaylist` / `isRemovedFromPlaylist` を merged item に付与
- フィルタ: 全て / お気に入りのみ / プレイリストのみ / 削除済み の 4 状態
- セクション分割（予定・配信中 / 通常 / 視聴済み）を視覚的に維持
- `handleToggleFavoriteWithPlaylistHint`: 新規 ⭐ on かつプレイリスト設定済みかつ初回のみ Toast、`playlistSyncToastShown` で永続化（spec 通り）
- 並び替えモードは `is_favorite=1` 動画のみ対象（spec 通り）
- 個別削除 confirm モーダル + 一括削除モーダル共存
- 設定モーダルタブラベル「📂 プレイリスト」短縮済み（はみ出し解消見込み）
- 既存お気に入りフィルタ（searchQuery / selectedChannel / hideMembershipVideos）も維持

### 触ってはいけない範囲の確認

- ✅ main process / preload / IPC contract 未変更
- ✅ DB migration / videos_fts / cleanup 未変更
- ✅ OAuth スコープ据え置き
- ✅ 他タブ未変更
- ✅ `release.yml` / `ci.yml` 未変更

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ✅ 🔴 なし（🟡 1 件は dead code 削除推奨） |
| ④ | ユーザー merge 指示 | ⏳ 待ち |

### 次アクション（推奨）

1. PlaylistTab.jsx / PlaylistTab.test.jsx 削除（Claude Code 側で直接実行可）
2. `npm run dev` でユーザー実動確認（プレイリスト同期コントロール / フィルタ / バッジ / Toast / 設定モーダルタブ列）
3. 問題なければ develop merge → Phase 5（v1.19.0 リリース）

---

## 2026-05-24 15:36 完了（プレイリスト UX 統合 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: ユーザーフィードバックに基づき、📂 プレイリストタブを廃止して ⭐ お気に入りタブへ統合し、設定モーダルのタブラベルはみ出しを解消。
- 触ってよい範囲: renderer UI / hooks / tests / handoff
- 触ってはいけない範囲: main process / preload / IPC contract / DB migration / OAuth scope（変更なし）

### 完成条件

- 通常動作: ⭐ お気に入りタブで `is_favorite=1 OR in_playlist=1 OR playlist_removed_at IS NOT NULL` を dedup 表示し、⭐ / 📂 / ⚠️ バッジを複合表示する。
- usage preconditions: プレイリスト未設定時もお気に入りは通常表示し、設定済み時のみ同期・エクスポート導線を出す。
- error handling: 既存 `usePlaylist` の error 表示、個別削除 confirm、一括削除 confirm を統合タブ内で維持する。
- no-regression checks: main/preload/IPC contract は変更せず、既存タブの ScheduleCard text 回帰を避けるため collection badge は統合タブ限定表示にした。

### 変更したファイル

- `src/renderer/src/App.jsx`
- `src/renderer/components/FavoritePlaylistTab.jsx`（新規）
- `src/renderer/components/ScheduleCard.jsx`
- `src/renderer/components/SettingsModal.jsx`
- `src/renderer/hooks/useTabState.js`
- `src/renderer/src/assets/main.css`
- `tests/renderer/FavoritePlaylistTab.test.jsx`（新規）
- `tests/renderer/ScheduleCard.test.jsx`

### 実装概要

- App タブ列から `📂 プレイリスト` を削除し、`favorites` タブを `FavoritePlaylistTab` に差し替えた。
- `FavoritePlaylistTab` で `listFavorites` 由来の `favoriteVideos` と `usePlaylist()` の `videos` を renderer 側で union/dedup。表示順は既存お気に入り順を優先し、プレイリストのみ動画を後続に追加。
- 統合タブにヘッダー、同期、`📤 YouTube に反映（コピー）`、設定、フィルタ（全て / ⭐ / 📂 / ⚠️）、削除済み一括削除、個別 🗑 confirm を実装。
- ScheduleCard に `showCollectionBadges` / `isInPlaylist` を追加し、⭐ / 📂 バッジは統合タブ限定表示。⚠️ 削除済みバッジと 🗑 は既存 PlaylistTab 動線と同じ contract。
- ⭐ on 時にプレイリスト設定済みかつ `playlistSyncToastShown !== true` の場合だけ toast を出し、`settings:set` で 1 回限定化。
- SettingsModal のタブラベルを `📂 プレイリスト` に短縮。
- 既存お気に入り並び替えは `is_favorite=1` 動画のみ対象。プレイリストのみ動画は表示対象だが drag 対象外。

### セルフ verify

- ✅ `npm run lint`
- ✅ `npm run test`（45 files / 374 passed）
- ✅ `npm run build`

### 実動確認

- Electron 実動確認（`npm run dev`）は未実施。今回のユーザー指定 verify は lint/test/build まで。UI 実動確認は Claude Code 側レビュー時に設定モーダル幅、統合タブ操作、エクスポートモーダルを確認してほしい。

### レビュー観点

- 統合タブの union/dedup が同一動画を 1 枚にし、⭐📂 複合バッジを出しているか。
- フィルタ `⭐ お気に入りのみ` / `📂 プレイリストのみ` / `⚠️ 削除済み` が意図通りの subset か。
- 初回 toast が「プレイリスト設定済み + favorite on + 未表示」の条件だけで出るか。
- `📤 YouTube に反映（コピー）` の export modal が既存 PlaylistExportModal と同じ挙動か。
- 設定モーダルの 6 タブが 1280px 想定で重ならないか。

### 未解決

- なし。コミットは作成していない。

### 次アクション

- Claude Code: `/cross-review` で UX 統合差分をレビューし、必要なら `npm run dev` で実動確認。

---

## 2026-05-24 依頼（プレイリスト同期 UX 統合: タブ統合 + ラベル修正 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`（Phase 3+4 補修まで含む全変更が未コミットで残っている上に追加）
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: ユーザーから「想定と違う」フィードバック。📂 プレイリストタブを ⭐ お気に入りタブに統合し、同期感のある UX に変える。設定モーダルのタブラベルはみ出しも解消する
- 関連: Phase 3+4 補修まで完了済み。本依頼はそれを土台に UX 再構成
- 制約据え置き: OAuth `youtube.readonly`、書き込み API は呼ばない、`is_favorite` と `in_playlist` の DB フラグは別保持（後方互換）

### ユーザーフィードバック（要約）

1. お気に入りタブと YouTube プレイリストの同期機能のはずだったが、現状は別タブ・別世界の独立読み取り機能になっている
2. 設定モーダルの「📂 プレイリスト同期」タブが他タブと重なってはみ出している（スクリーンショット確認済み）

### 触ってよい範囲

- 変更:
  - `src/renderer/src/App.jsx` — 📂 プレイリストタブを削除、⭐ お気に入りタブを統合ハブ化
  - `src/renderer/components/SettingsModal.jsx` — タブラベル「📂 プレイリスト同期」→「📂 プレイリスト」に短縮
  - `src/renderer/components/PlaylistTab.jsx` → 削除 or `FavoritesTab.jsx` などに移植
  - `src/renderer/hooks/usePlaylist.js` — お気に入りタブから利用するため API を再構成
  - `src/renderer/components/ScheduleCard.jsx` — `isInPlaylist` バッジ prop 追加（既存 `isRemovedFromPlaylist` と並列）
  - `src/renderer/src/assets/main.css` — お気に入りタブ用の playlist 同期コントロール CSS
  - `tests/renderer/**` — 既存 PlaylistTab テストを統合タブ向けに書き換え
- 新規（必要に応じて）:
  - `src/renderer/components/FavoritesTab.jsx`（既存 favorites 表示 JSX を App.jsx から切り出す形でもよい）

### 触ってはいけない範囲

- main process / preload / IPC contract（既存通り。`videos:listFavorites` と `playlist:*` を組み合わせるだけ）
- DB migration / videos_fts / cleanup
- OAuth スコープ
- 他タブ（schedule / missed / archive / stats / new-videos）の挙動

### 完成条件

#### Q1-A: タブ統合

1. App.jsx タブ列から **「📂 プレイリスト」を削除**。タブ数を 7→6 に減らす
2. **⭐ お気に入り**タブの内容を「お気に入り + プレイリスト同期ハブ」に再構成:
   - **ヘッダー**:
     - プレイリスト未設定時: `📂 YouTube プレイリスト: 未設定 [⚙️ 設定で連携]`
     - プレイリスト設定済み: `📂 YouTube プレイリスト「<title>」(N件) / 最終同期: <相対時刻> / [🔄 同期] [📤 YouTubeに反映（コピー）] [⚙️ 設定]`
   - **フィルタ行**: `[全て] [⭐ お気に入りのみ] [📂 プレイリストのみ] [⚠️ 削除済み ●<count>]` ＋ 削除済み選択時のみ `[💡 削除済みを一括削除]`
   - **カードリスト**: 表示対象 = `is_favorite=1 OR in_playlist=1 OR playlist_removed_at IS NOT NULL`（dedup、視覚的優先度: お気に入り→プレイリスト在中→削除済み）
   - 既存お気に入りの「並び順カスタマイズ」セクションナビ（`favoriteVideos.length > 0` 時のもの）は維持
3. **カードバッジ**: ScheduleCard に渡す:
   - `isFavorite` (既存): ⭐ 表示
   - `isInPlaylist` (新規): 📂 表示
   - `isRemovedFromPlaylist` (既存): ⚠️ 表示 + 🗑 ボタン（個別削除モーダル既存）
4. **個別削除** / **一括削除** ボタンは PlaylistTab 既存の動線をお気に入りタブに移植

#### Q3-A: 初回 Toast

5. ⭐ on（`is_favorite=0 → 1`）でかつ`settings.playlistSyncToastShown !== true` のとき、Toast 表示:
   - 文言: 「⭐ お気に入りに追加しました。YouTube プレイリストに反映するには『📤 YouTube に反映』ボタンからコピーしてください」
   - 表示後、`settings:set` で `playlistSyncToastShown = true` を永続化（既存 settings IPC を使用、`settings.js` パターン参照）
   - プレイリスト未設定時は Toast を出さない（誘導が無意味）

#### Q4: 設定モーダルラベル

6. **SettingsModal タブ列**で「📂 プレイリスト同期」→「📂 プレイリスト」に短縮
7. 内部の `PlaylistSettings` パネル見出しは「📂 YouTube プレイリスト同期設定」など説明的にしてよい（タブラベルとパネル内見出しを分離）
8. 6 タブ（表示・チャンネル・データ・プレイリスト・接続・アプリ情報）が横並びで切れずに表示されることを目視確認（実動は Claude Code 側）

#### 共通

9. プレイリスト未設定時でも ⭐ お気に入りは普通に動く（後方互換）
10. ダークモード対応（既存 `playlist-*` CSS を継続活用）
11. 既存 368 テストを引き続き pass。統合タブ向けに必要なら書き換え
12. `npm run lint` / `npm run test` / `npm run build` 全パス

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

### 既知リスク

- **表示優先度の dedup**: 同じ動画が is_favorite=1 かつ in_playlist=1 のときカードは 1 枚。バッジは ⭐📂 両方
- **`playlistSyncToastShown` 設定キー**: 既存 settings の命名規則に合わせる。`store.js` で扱う形でも `settings:set` 経由でも可
- **既存お気に入り並び順カスタマイズ**: in_playlist のみ動画は並び順カスタマイズに含めるか? → MVP では「並び順カスタマイズは `is_favorite=1` 動画のみ対象」に限定して良い
- **PlaylistTab.test.jsx**: ファイル削除 + FavoritesTab 用テスト新規作成 or 改名
- **テスト負荷**: 統合タブの empty / loading / フィルタ各種 / プレイリスト未設定 / 個別削除 / 一括削除 / 初回 Toast / 再表示時 Toast 抑止 をカバー

### レビュー観点

- お気に入り union 表示の dedup が正しい（同 ID は 1 枚）
- バッジ表示優先度がスペックと一致
- フィルタ切替で正しい部分集合が出る
- プレイリスト未設定時の hero ヘッダーが既存お気に入りの動作を壊さない
- 設定モーダル 6 タブが 1280px 想定で収まる
- 初回 Toast の 1 回制限が settings の永続化で確実に効く

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` で再レビュー
3. ユーザー判断後 develop merge → 実動確認 → v1.19.0 リリース

### 関連

- スクリーンショット: 設定モーダル「📂 プレイリスト同」が「接続」と重なる症状
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（本依頼で UX 再構成。spec 内のタブ統合方針はこの handoff を正とする）
- 既存 PlaylistTab 実装: 移植元として参照

---

## 2026-05-24 クロスレビュー結果（Phase 2.5 + 3+4 補修 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 補修 `feature/playlist-sync-phase3-4`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（44 files / 368 passed、+5 件）
- **🔴 重大指摘: なし**（前回 2 件すべて解消）

### 解消確認

- 🔴 重大1（個別 🗑 が一括削除を開く）→ ✅ 解消
  - `PlaylistTab.jsx` で `confirmingDelete` state を追加し、カード🗑 押下で個別の confirm モーダル
  - モーダル文言 `「{title}」を削除します。` で動画タイトル表示（誤削除防止 OK）
  - 確認後 `deleteOne(id)` → `reload()` → トースト「動画を削除しました」
  - 既存「一括削除」ボタンは別 state（`confirmingCleanup`）で共存
- 🔴 重大2（`playlist:error` が renderer に届かない）→ ✅ 解消
  - preload `onError(cb)` 追加（unsubscribe 関数返却の正攻法）
  - `usePlaylist` で購読 → `error` state 反映 → `PlaylistTab` の error 表示に出る

### IPC 3 点一致

- main: `ipcMain.handle('playlist:deleteOne', ...)` 存在
- preload: `playlist.deleteOne(videoId)` + `playlist.onError(cb)` 公開
- renderer: `usePlaylist.deleteOne` 経由で呼び出し
→ ✅ 一致

### 🟢 良好な実装

- `deleteOneRemovedStmt` の WHERE 句に `in_playlist = 0 AND playlist_removed_at IS NOT NULL` を強制。active な動画を誤削除する経路なし
- `deleteOne` の戻り値が `{ deleted: count }` で `deleteRemoved` と一貫
- `usePlaylist.deleteOne` が `optional chaining` で preload 未公開時も安全に no-op
- 個別 confirm モーダルが「キャンセル」ボタンを必ず提供

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass（368 件） |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ✅ 🔴 0 件 |
| ④ | ユーザー merge 指示 | ⏳ 待ち |

### Phase 5（リリース）への申し送り

- DB migration + UI 追加 → `release-checklist.md` 通り Claude Code 側で `npm run dev` 実動確認必須:
  - プレイリスト未設定時の empty state + 設定誘導
  - 設定モーダル「📂 プレイリスト同期」でドロップダウン → 初回取り込み（非同期）
  - PlaylistTab で削除済みフィルタ → 個別 🗑 → タイトル付き confirm → 削除
  - 一括削除ボタンの動作（共存確認）
  - エクスポートモーダル（コピー + .txt ダウンロード）
  - ダークモード
- v1.19.0 リリース内容: 統計タブ（既存）+ プレイリスト同期（今回）

---

## 2026-05-24 11:02 修正完了（Phase 2.5 + 3+4 補修 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: プレイリスト同期 Phase 3+4 クロスレビューの 🔴 重大 2 件（個別削除 IPC 不足、`playlist:error` preload 未公開）を補修。

### 変更したファイル

- `src/main/repositories/playlistRepository.js`
- `src/main/ipc/playlistHandlers.js`
- `src/preload/index.js`
- `src/renderer/hooks/usePlaylist.js`
- `src/renderer/components/PlaylistTab.jsx`
- `tests/main/repositories/playlistRepository.test.js`
- `tests/main/ipc/playlistHandlers.test.js`
- `tests/renderer/hooks/usePlaylist.test.js`
- `tests/renderer/PlaylistTab.test.jsx`

### 実装概要

- `playlistRepository.deleteOne(videoId)` を追加し、`id = @id AND in_playlist = 0 AND playlist_removed_at IS NOT NULL` の行だけ DELETE するようにした。active な動画・存在しない ID は `{ deleted: 0 }`。
- `playlist:deleteOne` IPC を追加し、未初期化時は `{ error: 'NOT_INITIALIZED' }` を返すようにした。既存 `playlist:cleanup` は変更なし。
- preload の `window.api.playlist` に `deleteOne(videoId)` と `onError(cb)` を追加。`onError` は `onUpdated` と同じ unsubscribe 関数返却パターン。
- `usePlaylist.deleteOne(videoId)` を追加し、削除後に `load()` で再取得するようにした。既存 `onError` 動線は preload 公開により実イベント購読可能になった。
- `PlaylistTab` の削除済みカード 🗑 は一括削除モーダルではなく、個別確認モーダル「この動画を YouTom から削除しますか？」を開くよう変更。確認文に対象動画タイトルを表示し、確定時に `deleteOne(id)` を呼ぶ。一括削除ボタンは削除済みフィルタ内に残した。

### Verify 結果

- ✅ `npm run lint`
- ✅ `npm run test`（44 files / 368 passed）
- ✅ `npm run build`

### 実動確認

- Electron 実動確認（`npm run dev`）は未実施。今回の依頼完了条件は lint/test/build までで、UI 挙動は renderer tests で個別削除モーダル・toast・再読込を確認済み。

### 残リスク・レビュー観点

- Claude Code cross-review では、`deleteOne` の WHERE 句が active 動画を削除しないこと、preload `onError` の unsubscribe、個別 🗑 と一括削除ボタンの分離、IPC contract の main/preload/renderer 一致を確認してほしい。
- コミットは作成していない。merge 判断はユーザー指示待ち。

### 次アクション

1. Claude Code: `/cross-review` で再レビュー
2. ユーザー: レビュー結果確認後、develop merge 可否を判断

---

## 2026-05-22 依頼（プレイリスト同期 Phase 2.5 + 3+4 補修: IPC 拡張 + 個別削除/onError 配線 — Claude Code → Codex）

- 対象: 同ブランチ `feature/playlist-sync-phase3-4`（既に Phase 3+4 の renderer 変更が未コミットで残っている）
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: Phase 3+4 クロスレビュー🔴 重大 2 件の解消。**Phase 2 で私（Claude Code）が IPC 設計漏れを起こしたのが原因**。Codex は責任ない
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- 関連レビュー: 同 handoff 内「2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 3+4 — Claude Code 作成）」

### 解消する 🔴 重大指摘

1. **個別 🗑 ボタンが一括削除モーダルを開く（UX 違反）** — `playlist:deleteOne(videoId)` IPC が存在しないため、Codex は一括 cleanup にフォールバックせざるを得なかった
2. **`playlist:error` イベントが renderer に届かない** — preload に `onError` が未公開

### 触ってよい範囲

- 変更:
  - `src/main/ipc/playlistHandlers.js` — `playlist:deleteOne` ハンドラ追加
  - `src/main/repositories/playlistRepository.js` — `deleteOne(videoId)` 関数追加（`in_playlist=0 AND playlist_removed_at IS NOT NULL` の行のみ削除）
  - `src/preload/index.js` — `playlist.deleteOne` と `playlist.onError` を公開
  - `src/renderer/hooks/usePlaylist.js` — `deleteOne(videoId)` 関数を返す。`onError` を活用したエラー表示
  - `src/renderer/components/PlaylistTab.jsx` — 個別 🗑 を確認モーダル + `deleteOne` 呼び出しに変更（一括削除は別ボタンとして残す）
  - `tests/main/ipc/playlistHandlers.test.js`
  - `tests/main/repositories/playlistRepository.test.js`
  - `tests/renderer/hooks/usePlaylist.test.js`
  - `tests/renderer/PlaylistTab.test.jsx`

### 触ってはいけない範囲

- 既存 fetcher / sync service / scheduler / migration
- 他タブ・コンポーネント
- OAuth スコープ
- 既存 `playlist:cleanup`（一括削除）の挙動

### 完成条件

1. **`playlistRepository.deleteOne(videoId)`**: 指定 ID の行を `in_playlist=0 AND playlist_removed_at IS NOT NULL` の場合のみ DELETE。それ以外（active な動画）は変更せず `{ deleted: 0 }` を返す
2. **`playlist:deleteOne` IPC**: 引数 `videoId`、戻り値 `{ deleted: number }`。削除成功時は `playlist:updated` イベントを別途 send する必要なし（renderer 側で reload で対応）
3. **preload `playlist.deleteOne(videoId)`**: ipcRenderer.invoke で main を呼ぶ
4. **preload `playlist.onError(cb)`**: `playlist:error` イベントを購読、unsubscribe 関数を返す（既存 `onUpdated` と同じパターン）
5. **`usePlaylist.deleteOne(videoId)`**: `window.api.playlist.deleteOne` 呼び出し → `reload()` で再取得
6. **`PlaylistTab` 個別削除**:
   - 削除済みカードの 🗑 ボタン → 確認モーダル「この動画を YouTom から削除しますか？」（タイトル表示も推奨）
   - 確認 → `usePlaylist.deleteOne(id)` 呼び出し → トースト「動画を削除しました」
   - 既存「💡 削除済みを一括削除」ボタンは残す（フィルタが「削除済みのみ」のとき表示）
7. **`onError` 動線**: バックグラウンド `playlist:error` 受信 → `usePlaylist` の error state に反映 → `PlaylistTab` の error 表示に出る
8. **テスト**:
   - `playlistRepository.deleteOne`: active な動画は消えない、削除済み 1 件のみ消える、存在しない ID は no-op
   - `playlist:deleteOne` IPC: 正常系、未初期化エラー
   - `usePlaylist.deleteOne`: 呼び出し後に reload が走る
   - `PlaylistTab`: 個別 🗑 → 確認モーダル → 削除 → トースト → 再読込
   - 既存 363 テストが引き続き pass
9. `npm run lint` / `npm run test` / `npm run build` 全パス

### 既知リスク

- **個別削除モーダル UX**: confirm 内に動画タイトルを表示する。誤削除を減らすため
- **`onError` の payload 形式**: main 側は `{ message: 'CODE' }` を送っている（`playlistPolling.js` / `playlistHandlers.js`）。renderer の `playlistErrorCode()` は既に `payload.error ?? payload.message ?? payload.code` をフォールバック確認しているのでそのまま動くはず
- **`playlist:cleanup` の挙動**: 既存通り「削除済みを全件 DELETE」。個別削除と一括削除は別 IPC として共存させる

### レビュー観点（Claude Code が cross-review でチェックする）

- `deleteOne` が active な動画を誤って消さない（WHERE 句に `in_playlist=0 AND playlist_removed_at IS NOT NULL`）
- preload `onError` の unsubscribe 関数が正しく動く
- `PlaylistTab` 個別削除 confirm モーダルが意図通り個別動画 ID で発火する
- 既存「一括削除」ボタンが壊れていない
- IPC contract が main / preload / renderer の 3 点一致

### 次アクション

1. Codex: 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` で再レビュー
3. ユーザー判断後、Phase 3+4 ブランチを develop に merge → Phase 5（リリース v1.19.0）へ

### 関連

- Phase 3+4 レビュー: 同 handoff の「2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 3+4 — Claude Code 作成）」
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`

---

## 2026-05-22 検証完了（Phase 2c-1 Task 10 Step 2: search.list メン限可視性 — Claude Code 作成）

- 作成者: Claude Code
- 主題: Phase 2c-1 で未検証だった「`search.list` がメンバー限定コンテンツを返すか」の実機検証
- 経緯: 2026-05-17 の Phase 2c-1 完了報告で Task 10 Step 2 は「⛔ 未検証」（メン限予約配信のあるチャンネルが当時見つからず）。今回ユーザーが現在ライブ中のメン限配信を提供し、検証を実施できた。

### 検証方法

- ユーザーの OAuth トークン（`youtube.readonly`）で一時スクリプトから API を直接呼び出し（検証後スクリプトは削除済み）
- 対象: メン限配信動画 `MJCn-L5HnO8`（Patra Channel / 周防パトラ、チャンネル `UCeLzT-7b2PBcunJplmWtoDg`、uploads playlist `UUeLzT-7b2PBcunJplmWtoDg`）— 検証時点でライブ中
- クォータ消費: `videos.list` 1 + `search.list` ×4 + `channels.list` 1 + `playlistItems.list` ×2 = 約 403 ユニット（一回限り）

### 検証結果

| API 呼び出し | 対象メン限動画を返したか |
|---|---|
| `videos.list`（動画 ID 指定） | ✅ **返す**。title・channelId・liveStreamingDetails すべて取得可。`privacyStatus` は `public`（メン限ゲートは privacy とは別扱い） |
| `search.list eventType=live` | ❌ 返さない（結果 0 件。ライブ中のメン限配信が唯一の live なのに 0 件） |
| `search.list eventType=upcoming` | ❌ 返さない（freechat 枠 1 件のみヒット、メン限は含まれず） |
| `search.list eventType=completed` | ❌ 返さない（通常配信 5 件のみ） |
| `search.list`（eventType 無し・order=date） | ❌ 返さない |
| `playlistItems.list`（uploads playlist・100 件取得） | ❌ 返さない（全件 `privacyStatus: public`。メン限は含まれず） |

### 結論（Plan 2c-2 への確定申し送り）

- **メン限コンテンツは YouTube Data API の discovery / listing 系エンドポイントから完全に除外される**。`search.list`（全 eventType）も `playlistItems.list`（uploads playlist）も、メンバー本人のトークンでメン限を一切返さない。Step 2 は「未検証」から「**検証完了・否定**」に確定。
- メン限動画を取得できるのは `videos.list`（動画 ID を既に知っている場合）のみ。ID を発見する経路が API に存在しない。RSS も公開フィードのためメン限は含まれない。
- したがって **Plan 2c-2「メン限チャンネル自動巡回」はどの形でも成立しない**（`search.list` 方式も uploads playlist 巡回方式も discovery が不可能）。
- → **ユーザーが URL/ID を手動入力する現行 Phase 2c-1 方式が、メン限追跡の唯一の現実解**。Plan 2c-2 は自動巡回を破棄して再設計が必要（着手前にユーザー判断を仰ぐ）。

### Changes

- コード変更なし（検証のみ）。`CLAUDE_CODE_HANDOFF.md` に本セクションを追記。
- 一時スクリプト `tmp_verify_membership_search.mjs` は作成・実行後に削除済み。

---

## 2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 3+4 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase3-4`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint` / ✅ `npm run test`（44 files / 363 passed）
- 完成条件大部分: ✅ 充足（PlaylistTab / PlaylistSettings / PlaylistExportModal / usePlaylist 全て実装、テスト追加、ダークモード対応）
- **🔴 重大指摘: 2 件**（いずれも私の Phase 2 設計漏れが起因。Codex は handoff 制約「main/preload は触らない」を正しく遵守した結果）

### 🔴 重大1: 個別 🗑 ボタンが一括削除モーダルを開く（UX 違反）

- `PlaylistTab.jsx` L160: `onDeleteFromYoutom={item.isRemovedFromPlaylist ? () => setConfirmingCleanup(true) : undefined}`
- spec 「カード単位の 🗑 ボタンで個別削除」が「全削除済み一括削除」を開く実装になっている
- ユーザーが「この動画だけ消したい」と思って 🗑 を押すと「削除済みを全部消す？」と聞かれる体験
- **原因**: Phase 2 IPC contract に `playlist:deleteOne(videoId)` を入れ忘れた私の設計漏れ。Codex は「main/preload 触らない」制約下でこの実装にせざるを得なかった
- **修正案**: 別 mini-handoff で main/preload 側に IPC 追加 → renderer 側で繋ぎ込み

### 🔴 重大2: `playlist:error` イベントが renderer に届かない

- main process は `playlist:error` を emit する（`playlistHandlers` の setConfig 失敗・`playlistPolling` のキック失敗時）
- preload は `onUpdated` のみ公開。`onError` 未公開
- `usePlaylist` は `window.api.playlist.onError?.(...)` で optional chaining しているため、コール自体は安全だが**バックグラウンドエラーが UI に表示されない**
- 影響: 24h スケジューラの失敗（クォータ超過・プレイリスト削除等）、`setConfig` 後の非同期 refresh 失敗が無音
- **原因**: Phase 2 軽微2 修正時に main 側で `playlist:error` 発火を追加したが、preload の onError 公開を忘れた私の設計漏れ
- **修正案**: 別 mini-handoff で preload に `onError` 公開を追加

### 🟢 良好な実装

- `PLAYLIST_ERROR_MESSAGES` 定数で IPC エラーコードの日本語マッピングを集約
- `usePlaylist` の useEffect cleanup で `unsubscribeUpdated()` / `unsubscribeError()` を呼ぶ（メモリリーク防止）
- `markRemoved` で active 動画と削除済み動画の境界を明示
- `PlaylistExportModal` でコピー・ダウンロード両対応、お気に入り 0 件時のメッセージあり
- 未認証 / 未設定の empty state が分岐済み
- propTypes で props 契約を文書化

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ❌ **🔴 2 件あり** |
| ④ | ユーザー merge 指示 | ⏳ 重大指摘解消後に判断 |

### 次アクション（推奨）

Phase 3+4 ブランチをそのまま merge せず、IPC 拡張の Phase 2.5 を挟む:

1. **Phase 2.5（IPC 拡張）**:
   - `playlist:deleteOne(videoId)` IPC handler 追加（`playlistRepository.deleteOne(videoId)` 必要）
   - preload に `deleteOne` と `onError` 公開
   - main / preload / テスト
2. **Phase 3+4 補修**:
   - `usePlaylist` に `deleteOne` 呼び出し追加
   - `PlaylistTab` の 🗑 を個別削除（confirm モーダル「この動画を YouTom から削除しますか？」）に変更
3. 統合 verify → 同 Phase 3+4 ブランチに合流 → merge

Phase 2.5 は私（Claude Code）の設計漏れに起因するので、依頼 handoff の冒頭にその旨を記録すること。

---

## 2026-05-21 15:49 完了（プレイリスト同期 Phase 3+4 — Codex 作成）

- 対象: `feature/playlist-sync-phase3-4`
- 作成者: Codex
- 主題: プレイリスト同期 renderer UI 一式（PlaylistTab + SettingsModal 拡張 + エクスポートモーダル）の統合実装
- 触ってよい範囲:
  - `src/renderer/hooks/usePlaylist.js`
  - `src/renderer/components/PlaylistTab.jsx`
  - `src/renderer/components/PlaylistSettings.jsx`
  - `src/renderer/components/PlaylistExportModal.jsx`
  - `src/renderer/components/ScheduleCard.jsx`
  - `src/renderer/components/SettingsModal.jsx`
  - `src/renderer/src/App.jsx`
  - `src/renderer/src/assets/main.css`
  - `tests/renderer/**`
- 触ってはいけない範囲:
  - main process / preload / IPC contract / DB migration / OAuth scope / CI・release 設定
- 完成条件:
  - 「📂 プレイリスト」タブを full mode のタブ列に追加し、設定済み/未設定/同期中/エラー/削除済みフィルタを表示する。
  - SettingsModal に「📂 プレイリスト同期」タブを追加し、プレイリスト選択、同期有効化、外部リンク、⭐エクスポートを扱う。
  - `ScheduleCard` の `isRemovedFromPlaylist` / `onDeleteFromYoutom` は optional で、未指定時は既存タブに影響しない。
  - IPC エラーコードを日本語メッセージへ変換して表示する。
  - `playlist:updated` / `playlist:error` 購読は cleanup で unsubscribe する実装にする。
  - 既存テストと build を壊さない。
- 変更内容:
  - `usePlaylist` を追加し、`playlist:getConfig` / `playlist:get(all)` / `playlist:get(removed)` / `playlist:refresh` / `playlist:cleanup` と `playlist:updated` / `playlist:error` イベントを統合。`rowToVideo` が playlist removed field を返さないため、removed 一覧の ID と照合して `isRemovedFromPlaylist` を renderer 側で付与。
  - `PlaylistTab` を追加。未設定 empty state、設定済みヘッダー、手動同期、削除済みフィルタ、一括削除 confirm、既存 `ScheduleCard` 再利用を実装。
  - `PlaylistSettings` を追加。`playlist:listMine` の選択肢、未認証無効化、`playlist:setConfig` 後の「同期中...」表示、イベント反映、YouTube playlist 外部リンク、エクスポート起動を実装。
  - `PlaylistExportModal` を追加。`playlist:exportFavorites` の URL 改行表示、0件表示、コピー、`youtom-favorites-YYYY-MM-DD.txt` ダウンロードを実装。
  - `ScheduleCard` に削除済みバッジと optional 削除ボタンを追加。既存タブから prop 未指定時は no-op。
  - `SettingsModal` と `App.jsx` に playlist UI を接続し、`playlist-*` CSS を追加。
  - renderer tests を追加・更新（PlaylistTab / PlaylistSettings / PlaylistExportModal / usePlaylist / ScheduleCard）。
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（44 files / 363 passed）
  - ✅ `npm run build`
- 実動確認:
  - 未実施。依頼どおり Codex はセルフ verify のみ。Electron 実動確認は Claude Code 側。
- レビュー観点:
  - `window.api.playlist.onError` は renderer 側で購読・cleanup する実装にしたが、現ブランチの `src/preload/index.js` には `onError` 公開が見当たらない。main/preload は触らない条件のため、実動確認時に `playlist:error` が renderer へ届くか要確認。
  - 現 IPC contract は個別削除 channel を持たず `playlist:cleanup` のみ。カード上の 🗑 は削除済み confirm を開き、実削除は一括 cleanup になる。
  - `rowToVideo` が `playlist_removed_at` を返さないため、UI の削除済み判定は `all` と `removed` の 2 回取得で補完している。
  - ダークモードは `playlist-*` クラスで既存 CSS 変数に追従。実画面で SettingsModal の 6 タブ幅と PlaylistTab ヘッダー幅を確認する。
- 未解決:
  - 上記 `onError` preload 公開有無と個別削除 contract は Claude Code 側レビュー対象。
- 次アクション:
  - Claude Code が `/cross-review` と `npm run dev` 実動確認（設定選択 → 初回同期 → タブ表示 → 削除済みフィルタ → エクスポート）を行う。

---

## 2026-05-21 依頼（プレイリスト同期 Phase 3+4: UI 統合実装 — Claude Code → Codex）

- 対象: `develop` から `feature/playlist-sync-phase3-4` を切る
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: プレイリスト同期の renderer UI 一式（PlaylistTab + SettingsModal 拡張 + エクスポートモーダル）
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（**着手前に必読**。UI モックと挙動はここで確定済み）
- 前提: Phase 2（commit `8f44409`）が develop に merge 済み。`window.api.playlist.*` IPC と `playlist:updated` / `playlist:error` イベントが利用可能

### Phase 3 と 4 を統合した理由

両者ともに renderer 配下の UI 実装で、PlaylistTab（取り込み結果表示）と SettingsModal（設定）は同じ UX フローの両端。IPC エラー分岐・`playlist:updated` 購読・unsubscribe 処理を 1 回で整理した方が一貫性が出る。

### 触ってよい範囲

- 新規:
  - `src/renderer/hooks/usePlaylist.js` — 取得・同期・エラー状態管理、`playlist:updated` / `playlist:error` 購読
  - `src/renderer/components/PlaylistTab.jsx` — タブ本体（一覧 + 削除済みフィルタ + 一括削除）
  - `src/renderer/components/PlaylistSettings.jsx` — SettingsModal 内に差し込むタブパネル
  - `src/renderer/components/PlaylistExportModal.jsx` — ⭐ エクスポート専用モーダル（コピーボタン + .txt ダウンロード）
  - `tests/renderer/PlaylistTab.test.jsx`
  - `tests/renderer/PlaylistSettings.test.jsx`
  - `tests/renderer/PlaylistExportModal.test.jsx`
  - `tests/renderer/hooks/usePlaylist.test.js`
- 変更最小限:
  - `src/renderer/src/App.jsx` — `playlist` タブを追加（schedule/missed/archive/favorites/new-videos と並列）
  - `src/renderer/components/SettingsModal.jsx` — 「📂 プレイリスト同期」タブを追加して `PlaylistSettings` を差し込み、`PlaylistExportModal` 起動ボタン
  - `src/renderer/components/ScheduleCard.jsx` — `isRemovedFromPlaylist`（バッジ）と `onDeleteFromYoutom`（行削除）prop を追加。既存タブで使われていない場合は no-op
  - `src/renderer/src/assets/main.css`（または該当 CSS）— `playlist-*` プレフィックスでスタイル追加

### 触ってはいけない範囲

- main process / preload / IPC contract（Phase 2 で確定済み）
- 既存タブ（schedule / missed / archive / favorites / new-videos）のレイアウト・動作
- DB migration / videos_fts / cleanup
- OAuth スコープ
- `release.yml` / `ci.yml`
- 他 feature ブランチ

### 完成条件

#### Phase 3: PlaylistTab

1. ヘッダーのタブ列に **「📂 プレイリスト」タブ** が追加され、クリックで表示が切り替わる（既存 5 タブの右側）
2. プレイリスト未設定時は **「設定からプレイリストを選択してください」+ 設定モーダルを開くボタン** を表示
3. 設定済み時:
   - ヘッダー: `📂 YouTom プレイリスト「<title>」(N件) / 最終同期: <相対時刻> / [🔄 同期] [⚙️ 設定]`
   - フィルタ: `[全て] [削除済みのみ ●<count>]` ボタン
   - 削除済みフィルタ時に `[💡 削除済みを一括削除]` ボタン表示（confirm モーダル経由）
4. カードリストは既存 `ScheduleCard` を再利用。削除済み動画は `⚠️ プレイリストから削除済み` バッジ + 個別 🗑 ボタン
5. ⭐ お気に入り・✓ 既読・🔔 通知ボタンは既存通り動作（既存タブと同じ）
6. 同期中はスピナー表示、エラー時は IPC エラーコードから日本語メッセージに変換して表示
   - `NOT_AUTHENTICATED` → 「ログインしてください」
   - `PLAYLIST_NOT_CONFIGURED` → 「設定からプレイリストを選択してください」
   - `QUOTA_EXCEEDED` → 「YouTube API クォータ上限に達しました。翌日 17:00 (JST) 頃にリセットされます」（既存クォータバナーと同じ文言基調）
   - `PLAYLIST_NOT_FOUND` → 「プレイリストが削除/非公開化されている可能性があります。設定で再選択してください」
   - その他 → 「同期に失敗しました」+ エラーコード末尾

#### Phase 4: SettingsModal + Export

7. SettingsModal に **「📂 プレイリスト同期」タブ** を追加（既存 ⚙️ 基本 / 📌 チャンネル / 📦 データ管理 と並列）
8. パネル構成:
   - 「同期を有効にする」チェックボックス
   - 「同期するプレイリスト」ドロップダウン（`playlist:listMine` で取得、ローディング表示あり）
   - ドロップダウン未認証時は「ログインしてください」と無効化
   - 「YouTube でプレイリストを作成」外部リンク（`shell:openExternal` 経由で `https://www.youtube.com/feed/playlists`）
   - 「📤 ⭐お気に入りをエクスポート」ボタン → `PlaylistExportModal` 起動
9. ドロップダウン選択 → `playlist:setConfig` 呼び出し → IPC は即時 `{ ok: true }` 返却（Phase 2 非同期化済み）
10. `setConfig` 後は「同期中...」を表示し、`playlist:updated` イベント受信で「完了」表示に切り替え。`playlist:error` 受信でエラー表示
11. **エクスポートモーダル**:
    - `playlist:exportFavorites` の結果（URL 配列）を改行区切りで `<textarea>` に表示
    - 補足テキスト: 「YouTube プレイリストに追加するには、各動画ページの『＋ 保存』から手動で追加してください」
    - `[📋 コピー]` ボタン（`navigator.clipboard.writeText`）
    - `[💾 .txt でダウンロード]` ボタン（Blob + a タグで実装、ファイル名 `youtom-favorites-YYYY-MM-DD.txt`）
    - お気に入り 0 件時は「お気に入りがありません」を表示

#### 共通

12. ダークモード対応（`playlist-*` クラスで既存 CSS 変数に乗せる）
13. `playlist:updated` / `playlist:error` イベントは `usePlaylist` フック内で購読・unsubscribe（メモリリーク防止。preload の `onUpdated` は unsubscribe 関数を返すので useEffect cleanup で呼ぶ）
14. テスト:
    - `usePlaylist`: 取得・同期・エラー状態遷移、unsubscribe 呼び出し確認
    - `PlaylistTab`: empty / loading / error / データあり / 削除済みフィルタ / 一括削除確認モーダル
    - `PlaylistSettings`: ドロップダウンローディング / 未認証無効化 / setConfig 後のイベント反映
    - `PlaylistExportModal`: お気に入りあり / 0 件 / コピー / ダウンロード
    - 既存 343 テストが引き続き pass
15. `npm run lint` / `npm run test` / `npm run build` 全パス

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認（`npm run dev`）は Claude Code 側で実施。

### 既知リスク

- **ScheduleCard 拡張**: 既存タブで `isRemovedFromPlaylist` / `onDeleteFromYoutom` を渡していないので、両 prop はオプション扱いで undefined のとき何も表示しない設計にする
- **タブ列の幅**: 1280px 想定で 6 タブが収まることを確認（statistics タブが既にあるなら 7 タブ）。収まらない場合はオーバーフロー時の挙動を既存パターンに合わせる
- **モバイル/縮小幅**: 既存設計はモバイル非対応のため考慮不要
- **`playlist:updated` イベント発火タイミング**: scheduler の 24h 定期実行と手動同期で複数回発火する。`usePlaylist` はイベント受信時に `playlist:get` を再実行する設計で良い
- **エクスポートのファイル名**: `.txt` ダウンロード時のファイル名は `youtom-favorites-${YYYY-MM-DD}.txt` 形式で固定
- **`shell:openExternal` 存在確認**: 既存 `window.api.openExternal()` が利用可能（`SettingsModal.jsx` の手動追加 channel URL 説明等で使われているはず）

### レビュー観点（Claude Code が cross-review でチェックする）

- PlaylistTab の empty / loading / error / 削除済みフィルタの 4 状態が網羅されているか
- IPC エラーコードのユーザー向け文言変換が抜けなく対応されているか
- `usePlaylist` の useEffect cleanup で `playlist:updated` / `playlist:error` リスナーが unsubscribe されるか
- `ScheduleCard` の新 prop が既存タブに影響を与えていないか（undefined のとき完全 no-op）
- ダークモードで `playlist-*` スタイルが既存変数に正しく追従するか
- エクスポートモーダルのコピー・ダウンロード両方が動くか（クリップボード権限など）
- タブ列が 1280px に収まるか

### 次アクション

1. Codex: 設計確認 → 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` でレビュー → `npm run dev` で実動確認（プレイリスト選択 → 取り込み → タブ表示 → 削除済みフィルタ → エクスポート）
3. ユーザー判断後に Phase 5（リリース v1.19.0）へ

### 関連

- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- Phase 1 commit: `60e50e1`
- Phase 2 commit: `8f44409`
- Phase 2 修正コミット（軽微3件）: 同上に含まれる
- preload API: `src/preload/index.js` の `playlist.*`

---

## 2026-05-21 09:56 修正完了（Phase 2 軽微指摘 3 件 — Codex 作成）

- 対象: `feature/playlist-sync-phase2`
- 作成者: Codex
- 主題: Claude Code クロスレビュー軽微指摘 3 件の反映
- 変更ファイル:
  - `src/main/index.js`
  - `src/main/services/playlistPolling.js`
  - `src/main/ipc/playlistHandlers.js`
  - `src/main/services/playlistSyncService.js`
  - `tests/main/services/playlistPolling.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
  - `tests/main/services/playlistSyncService.test.js`
- 実装概要:
  - 軽微1: playlist polling を認証済み時のみ開始。未認証・ログアウト時は既存 timer を clear して kick しない。
  - 軽微2: `playlist:setConfig` は `{ ok: true }` を即時返却し、初回 refresh は background 実行。完了時は `playlist:updated`、失敗時は `playlist:error` を送信。
  - 軽微3: playlist 取り込み時に `videoDetailsFetcher.fetch()` で `videos.list` 詳細をバッチ取得し、`deriveStatus()` で `upcoming/live/ended` を補正。
- 追加・更新テスト:
  - 未認証時に playlist polling が既存 timer を停止し、refresh kick も interval 登録も行わないこと。
  - `playlist:setConfig` が refresh 完了を待たず `{ ok: true }` を返し、background refresh 完了後に `playlist:updated` を送ること。
  - playlist 取り込み後、`videos.list` 詳細に基づいて `upcoming` / `live` status と時刻・視聴者数が保存されること。
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（40 files / 343 passed）
  - ✅ `npm run build`
- 実動確認:
  - 未実施。今回の変更は main process / IPC / service の単体テスト対象で、renderer UI 変更・DB migration 変更なし。
- 残リスク:
  - `videos.list` 追加消費は 500 件で最大 10 units。Phase 2 設計の許容範囲内だが、Phase 3 UI では refresh 中表示と quota error 表示を確認すること。
- 次アクション:
  - Claude Code が本修正差分を再レビューし、ユーザーが merge 判断を行う。

---

## 2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 2 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase2`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（39 files / 340 passed）
- 完成条件 8 項目: ✅ 全て満たす
- **🔴 重大指摘: なし**

### 設計判断の良い点

- 🟢 `PlaylistFetchError` クラスでエラーを型付け化（`QUOTA_EXCEEDED` / `PLAYLIST_NOT_FOUND` / `NOT_AUTHENTICATED` / `PLAYLIST_NOT_CONFIGURED` / `FETCH_FAILED`）。renderer が分岐しやすい
- 🟢 `Promise.race` でタイムアウト（15秒）。fetcher が無限待ちにならない
- 🟢 ページング処理で `pageToken=null` を検出して終了（無限ループ防止）
- 🟢 fetcher → upsert → applyDiff の順序契約を `playlistSyncService.doRefresh()` 内で厳守。Phase 1 申し送り遵守
- 🟢 `channelRepository.ensureChannel()` 追加で未登録チャンネル自動 INSERT。同時に `maxSyncStmt` を `uploads_playlist_id != ''` で絞り、subscription cache の 24h タイムスタンプ計算が `ensureChannel` 由来の空 uploads_playlist_id で破壊されないよう保護
- 🟢 `playlistSyncService.refresh()` に `inFlight` deduplication を導入。重複リクエストを 1 実行に集約
- 🟢 `refreshIfDue()` で `lastSyncedAt` を確認し 24h 未満ならスキップ。起動直後の二重実行回避
- 🟢 IPC エラーは `{ error: 'CODE' }` 形式で統一（既存パターン踏襲）
- 🟢 preload で `onUpdated(cb)` がリスナー解除関数を返す（メモリリーク回避の正攻法）
- 🟢 scheduler timer は `playlistRefreshTimer` として完全独立。`refreshTimer`（30 分）と干渉しない

### 🟡 軽微指摘（merge ブロッカーではない）

- 🟡 軽微1: ログイン/ログアウトで `initScheduler(null)` → `startPlaylistPolling()` が即座にキックされ、未認証 skip を返す。挙動は正しいが、空キックが起動時とログアウト時の 2 回走る。Phase 3 で UI が出来てから「未認証状態は polling を開始しない」最適化を検討
- 🟡 軽微2: `playlist:setConfig` 経由の初回 refresh は IPC ハンドラ完了まで待つ（同期的）。プレイリストが 500 件超だと UI が数秒固まる可能性。Phase 3 で「設定保存は即時、refresh は非同期トリガー」分離を検討
- 🟡 軽混3: `toVideoRecord` で `status: 'ended'` を固定。プレイリストに upcoming/live が含まれる場合、status が実態と乖離する。`playlist` 由来の動画は schedule タブに混ざらない設計なので実害なしだが、Phase 3 で `videos.list` を使って status 補正する余地あり

### 触ってはいけない範囲の確認

- ✅ migration 012 改変なし
- ✅ `videos_fts` トリガー / cleanup ポリシー未変更
- ✅ renderer 配下未変更
- ✅ OAuth スコープ（`youtube.readonly`）据え置き
- ✅ `release.yml` / `ci.yml` 未変更
- ✅ 既存 30 分ポーリングロジック未変更
- ✅ 他 feature ブランチ巻き戻しなし
- ✅ `channelRepository.js` の `maxSyncStmt` 変更は `ensureChannel` 追加に伴う必須の整合性修正で、handoff 「未登録チャンネル INSERT」許可範囲内

### Merge 判断（4 条件）

| # | 条件 | 状態 |
|---|------|------|
| ① | セルフ verify | ✅ lint / test / build pass |
| ② | 相互レビュー記録 | ✅ 本セクション |
| ③ | 重大指摘なし | ✅ 🔴 なし |
| ④ | ユーザー merge 指示 | ⏳ 待ち |

merge OK 判断後の手順:
1. `feature/playlist-sync-phase2` → `develop` に no-ff merge
2. Phase 3 依頼セクションを新規追加（UI: PlaylistTab + SettingsModal 拡張 + エクスポートモーダル）

### Phase 3 設計時の申し送り

- IPC エラー形式 `{ error: 'CODE' }` を renderer 側で分岐表示（NOT_AUTHENTICATED / PLAYLIST_NOT_CONFIGURED / QUOTA_EXCEEDED / PLAYLIST_NOT_FOUND）
- `playlist:setConfig` の初回 refresh が長時間ブロックしうる点をデバウンス + ローディング UI で吸収
- `playlist:updated` イベントを購読してタブ自動更新（unsubscribe 必須）
- 軽微3 の status 補正は Phase 3 で必要ないなら見送り（プレイリストタブだけで使うため）

---

## 2026-05-21 09:38 完了（プレイリスト同期 Phase 2 — Codex 作成）

- 対象: `feature/playlist-sync-phase2`
- 作成者: Codex
- 主題: YouTube プレイリスト 1 件を取り込む fetcher + IPC + scheduler 統合
- 触ってよい範囲:
  - `src/main/fetchers/playlistFetcher.js`
  - `src/main/services/playlistSyncService.js`
  - `src/main/ipc/playlistHandlers.js`
  - `src/main/index.js`
  - `src/preload/index.js`
  - `src/main/services/schedulerService.js`
  - `src/main/repositories/channelRepository.js`
  - `src/main/repositories/playlistRepository.js`（復活差分計算用の削除済み ID 取得のみ）
  - `tests/main/fetchers/playlistFetcher.test.js`
  - `tests/main/services/playlistSyncService.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
  - `tests/main/services/schedulerService.test.js`
  - `tests/main/repositories/channelRepository.test.js`
  - `tests/main/repositories/playlistRepository.test.js`
- 触ってはいけない範囲:
  - migration 012
  - `videos_fts` / cleanup policy
  - renderer UI
  - OAuth scope
  - `.github/workflows/release.yml` / `.github/workflows/ci.yml`
  - 他 feature ブランチ
- 完成条件:
  - `playlistFetcher` が `playlists.list?mine=true` と `playlistItems.list` ページングを提供し、403 quota / 404 playlist not found を識別可能にする
  - `playlistSyncService.refresh()` が設定確認、playlist 取得、実データ `videoRepository.upsert()`、未登録チャンネル `ensureChannel()`、diff 適用、最終同期時刻更新を行う
  - fetcher → upsert → applyDiff の順序契約を守る
  - IPC contract と preload の `window.api.playlist.*` を一致させる
  - scheduler から既存 30 分ポーリングとは独立して 24h 周期の playlist 同期を起動し、`playlist:updated` を通知する
  - 既存 319 テストを含む全テストを pass させる
- 変更内容:
  - `createPlaylistFetcher()` を追加。OAuth client は既存 auth client を受け取り、内部で `google.youtube({ version: 'v3', auth })` を生成する形にした
  - `createPlaylistSyncService()` を追加。playlist item snippet から空スタブではない動画レコードを作り、`videoRepo.upsert()` 後に `playlistRepo.applyDiff()` を呼ぶ
  - `channelRepository.ensureChannel(id, title, syncAt)` を追加し、playlist 由来の未登録チャンネルを `uploads_playlist_id=''` の最小行で INSERT する。空 uploads playlist は購読キャッシュ時刻の MAX から除外した
  - `playlistRepository.getRemovedPlaylistVideoIds()` を追加し、削除済みから復活した動画を `restored` として数えられるようにした
  - `playlistHandlers` と preload の `playlist` API を追加。`playlist:setConfig` は初回 refresh をトリガーし、`playlist:refresh` は未設定/未認証をエラーコードで返す
  - `SchedulerService` に `refreshPlaylist()` / `refreshPlaylistIfDue()` を追加し、`src/main/index.js` で独立 24h timer と起動時 due check を配線した
  - fetcher / sync service / IPC / scheduler delegation / repository helper の Vitest を追加・更新
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（39 files / 340 passed）
  - ✅ `npm run build`
- 実動確認: N/A（Phase 2 は main/preload の fetcher・IPC・scheduler 統合のみ。UI 実動確認は Phase 3 で実施予定）
- レビュー観点:
  - fetcher → upsert → applyDiff の呼び出し順が維持されているか
  - playlist item snippet 由来の動画メタデータで `videos` 必須カラムを満たしているか
  - `ensureChannel()` の `uploads_playlist_id=''` が既存 subscription cache 判定に悪影響を与えないか
  - `playlist:updated` / preload contract が Phase 3 UI から使いやすい形になっているか
  - scheduler の playlist 24h timer が既存 schedule 30 分 timer と独立しているか
- 未解決:
  - なし
- 次アクション:
  - Claude Code: `/cross-review` で Phase 2 実装をレビュー

---

## 2026-05-21 依頼（プレイリスト同期 Phase 2: fetcher + IPC + scheduler 統合 — Claude Code → Codex）

- 対象: `develop` から `feature/playlist-sync-phase2` を切る
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: YouTube プレイリスト 1 件を取り込む fetcher・IPC・scheduler 統合（UI は Phase 3 で別依頼）
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（**着手前に必読**。IPC contract と同期ロジックはここで確定済み）
- 前提: Phase 1（commit `60e50e1`）が develop に merge 済み。`playlistRepository` / migration 012 / `buildWatchUrl` ヘルパが利用可能

### 触ってよい範囲

- 新規:
  - `src/main/fetchers/playlistFetcher.js` — `playlists.list?mine=true` と `playlistItems.list` のページング取得
  - `src/main/services/playlistSyncService.js` — fetcher 結果と `playlistRepository.applyDiff` の橋渡し（diff 計算 + 実データ upsert）
  - `src/main/ipc/playlistHandlers.js`
  - `tests/main/fetchers/playlistFetcher.test.js`
  - `tests/main/services/playlistSyncService.test.js`
  - `tests/main/ipc/playlistHandlers.test.js`
- 変更最小限:
  - `src/main/index.js` — `playlistHandlers` 登録 + `playlistRepository` インスタンス化
  - `src/preload/index.js` — `window.api.playlist.*` を contextBridge で公開
  - `src/main/services/schedulerService.js` — 24h 周期で `playlistSyncService.refresh()` をキック（既存 30 分ポーリングは触らない）
  - `src/main/repositories/channelsRepository.js`（必要なら）— 未登録チャンネルを最小行で INSERT する関数追加

### 触ってはいけない範囲

- migration 012（Phase 1 完了済み）の改変
- 既存 30 分ポーリングのロジック
- `videos_fts` トリガー / cleanup ポリシー
- renderer 配下すべて（UI は Phase 3）
- OAuth スコープ（`youtube.readonly` 据え置き）
- `release.yml` / `ci.yml`
- 他 feature ブランチ

### 完成条件

1. **playlistFetcher** が以下を提供する:
   - `listMyPlaylists(oauth2Client)` → `[{ id, title, itemCount }]`（先頭 50 件、ページングは未対応で OK。51 件目以降は無視 + ログ）
   - `fetchPlaylistItems(oauth2Client, playlistId)` → `[{ videoId, snippet... }]`（500 件超は pageToken で全件取得、`maxResults=50`）
   - 403 quotaExceeded / 404 playlistNotFound を識別可能なエラーで throw（既存 fetcher のエラー形式に揃える）

2. **playlistSyncService.refresh()** が以下を実施する:
   - 設定取得 → `enabled=false` または未登録ならスキップ
   - `fetchPlaylistItems()` で現在のプレイリスト動画リストを取得
   - **各動画について `videoRepository.upsert()` で実データを書き込む（applyDiff より前に必ず実行）**
   - 動画のチャンネル ID が `channels` テーブル未登録なら `channelsRepository` で最小行を INSERT
   - `playlistRepository.getPlaylistVideoIds()` と diff 計算
   - `playlistRepository.applyDiff({ added, removed, restored })`
   - `playlistRepository.updateLastSyncedAt(now)`
   - 戻り値: `{ added: number, removed: number, restored: number }`

3. **IPC handlers**（`playlistHandlers.js`）:
   - `playlist:listMine` → `playlistFetcher.listMyPlaylists()` の結果を返す
   - `playlist:setConfig` → `playlistRepository.setConfig()` を呼び、`refresh` をトリガー（初回取り込み）
   - `playlist:getConfig` → `playlistRepository.getConfig()`
   - `playlist:get` → `playlistRepository.listPlaylistVideos({ filter })`
   - `playlist:refresh` → `playlistSyncService.refresh()`（手動同期、デバウンスは renderer 側で実装するため main では受けたら即実行）
   - `playlist:cleanup` → `playlistRepository.deleteRemoved()`
   - `playlist:exportFavorites` → `videoRepository.listFavorites()` から URL 配列を生成

4. **preload** で上記 IPC を `window.api.playlist.*` として公開

5. **schedulerService 統合**:
   - 既存 30 分ポーリングとは独立した 24h タイマーで `playlistSyncService.refresh()` を呼ぶ
   - アプリ起動直後にも 1 回呼ぶ（前回同期から 24h 経過していれば）
   - `schedule:updated` IPC イベントは既存通り。`playlist:updated` IPC イベントを別途追加して renderer に同期完了を通知

6. **テスト**:
   - `playlistFetcher`: モック化された googleapis client で `listMyPlaylists` / `fetchPlaylistItems` の正常系、403/404、ページング（51 件超）
   - `playlistSyncService`: in-memory DB で fetcher をモックし、初回取り込み・差分追加・削除・復活・未登録チャンネルの自動 INSERT
   - `playlistHandlers`: 各 IPC の正常系と異常系（未設定時の `playlist:refresh` 等）
   - 全テスト pass + 既存 319 テストも pass

7. `npm run lint` / `npm run test` / `npm run build` 全パス

8. **触ってはいけない範囲を変更していない**

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認（`npm run dev`）は Phase 3 で UI 完成後に Claude Code 側で実施。

### 既知リスク・申し送り

- **fetcher → applyDiff の順序契約**: fetcher が取得した動画は `videoRepository.upsert(real)` を applyDiff より前に必ず実行する。これを破ると空スタブが残る（Phase 1 レビュー軽微1 で指摘済み）
- **未登録チャンネル**: プレイリストに含まれる動画のチャンネルが `channels` テーブル未登録の場合、最小行（`id`, `title`, `uploads_playlist_id=''`, `last_subscription_sync_at=now`）を INSERT。既存の `channelsRepository` に類似関数がなければ `ensureChannel(id, title)` を追加
- **OAuth client**: `src/main/ipc/authHandlers.js` 等で初期化されている googleapis OAuth2 client インスタンスを再利用する。新規に作らない
- **クォータ**: 1 同期で `playlistItems.list` 最大 10 ユニット（500件 / 50件ページ）。24h 周期なので余裕あり。403 受領時は scheduler 側で次回 24h まで再試行しない
- **`playlists.list` キャッシュ**: spec では 24h キャッシュとしたが、Phase 2 では実装簡略化のため毎回 API 呼び出しで OK。キャッシュは Phase 3 設定モーダル実装時にまとめて検討
- **`playlist:updated` IPC**: renderer がまだ存在しないが、Phase 3 で必要になるので Phase 2 で発火側を実装しておく

### レビュー観点（Claude Code が cross-review でチェックする）

- fetcher → upsert → applyDiff の順序契約が守られているか
- 未登録チャンネル INSERT が channels の必須カラム制約を満たすか
- 403/404 のハンドリングが既存パターンに揃っているか
- IPC contract が preload と main で一致しているか
- scheduler 統合で既存 30 分ポーリングのタイミングを乱していないか
- 既存 319 テストが引き続き pass するか
- ページング処理が無限ループしないか（pageToken なし時の終了条件）

### 次アクション

1. Codex: 設計確認 → 実装 → セルフ verify → ハンドオフに完了セクション追記
2. Claude Code: `/cross-review` でレビュー
3. ユーザー判断後に Phase 3（UI）依頼

### 関連

- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- Phase 1 commit: `60e50e1`
- Phase 1 レビュー申し送り: 同 handoff の Phase 1 クロスレビュー結果セクション参照

---

## 2026-05-21 クロスレビュー結果（プレイリスト同期 Phase 1 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 実装 `feature/playlist-sync-phase1`（未コミット）
- セルフ verify 再実行: ✅ `npm run lint`（warning 0） / ✅ `npm run test`（36 files / 319 passed）
- 完成条件 5 項目: ✅ 全て満たす
- **🔴 重大指摘: なし**

### 設計判断の良い点

- 🟢 spec 指定の migration 005 が既存 011 と衝突するため 012 へリネーム。判断と理由を `My-Skill-Graph` decision に記録済み、追従可能
- 🟢 `in_playlist` に `NOT NULL DEFAULT 0` を付与（spec より厳しいが安全側）
- 🟢 `playlist_sync_config` の CHECK 制約を実テストで違反確認（複数行 INSERT が throw）
- 🟢 migration backward-compat テストで「migration 003+004 適用済み相当の旧 DB」に対して既存行が温存されることを実証
- 🟢 `applyDiff` で「同一 ID が removed + restored 両方にある場合は restored 勝ち」のエッジケースをテスト化
- 🟢 `deleteRemoved` は `in_playlist=0 AND playlist_removed_at IS NOT NULL` の両条件を要求し、`in_playlist=1` だが何らかの理由で removed_at が残った "inconsistent" 行を保護
- 🟢 `videoRepository` の `rowToVideo` を module-scope export 化して再利用（独立実装回避を完成条件通り遵守）
- 🟢 `applyDiff` 全体が `db.transaction` で囲まれ、原子性確保

### 🟡 軽微指摘（merge ブロッカーではない）

- 🟡 軽微1: `insertStubStmt` が新規動画に `channel_id=''`, `status='ended'` の空スタブを作る。Phase 2 fetcher が実データを upsert してから applyDiff を呼ぶ前提なら `INSERT OR IGNORE` で no-op になる。ただし呼び出し順を間違えると空スタブが残るため、Phase 2 設計時に「fetcher は applyDiff より前に必ず upsert」を契約として明文化する必要あり
- 🟡 軽微2: 完成条件で「変更最小限: `src/main/db/index.js`」と書いたが実体は `src/main/db/schema.js` だった。Codex は正しいファイルを修正した（私の handoff 側の記述ミス）。今後の handoff では実体ファイル名を確認してから書く
- 🟡 軽微3: stub 動画の URL に `https://www.youtube.com/watch?v=${id}` を埋め込む処理が `applyDiff` 内に直接書かれている。URL 組立てが今後別箇所でも必要になるなら `src/main/services/videoUrl.js` 等に抽出余地あり（YAGNI 観点では現状で OK）

### 触ってはいけない範囲の確認

- ✅ 既存 migration 001〜011 改変なし
- ✅ cleanup ロジック未変更
- ✅ fetcher / IPC / preload / renderer 未変更
- ✅ `release.yml` / `ci.yml` 未変更
- ✅ 他 feature ブランチ巻き戻しなし

### Merge 判断（4 条件）

| #   | 条件                | 状態                        |
| --- | ------------------- | --------------------------- |
| ①   | セルフ verify       | ✅ lint / test / build pass |
| ②   | 相互レビュー記録    | ✅ 本セクション             |
| ③   | 重大指摘なし        | ✅ 🔴 なし                  |
| ④   | ユーザー merge 指示 | ⏳ 待ち                     |

merge OK 判断後の手順:

1. `feature/playlist-sync-phase1` → `develop` に no-ff merge
2. Phase 2 依頼セクションを新規追加（fetcher + IPC + scheduler 統合）

### Phase 2 設計時の申し送り

- fetcher は `playlistRepo.applyDiff` を呼ぶ**前**に `videoRepo.upsert` で各動画の実データを書き込むこと（軽微1 の回避）
- 未登録チャンネルが含まれる動画は `channels` テーブルに最小行を自動 INSERT する設計が必要（spec の Phase 1 既知リスク参照）

---

## 2026-05-21 09:14 完了（プレイリスト同期 Phase 1 — Codex 作成）

- 対象: `feature/playlist-sync-phase1`
- 作成者: Codex
- 主題: YouTube プレイリスト 1 件を取り込むための DB スキーマ追加と `playlistRepository` 実装
- 触ってよい範囲:
  - `src/main/db/schema.js`
  - `src/main/db/migrations/012_playlist_sync.js`
  - `src/main/repositories/videoRepository.js`
  - `src/main/repositories/playlistRepository.js`
  - `tests/main/db/migrations/012_playlist_sync.test.js`
  - `tests/main/repositories/playlistRepository.test.js`
- 触ってはいけない範囲:
  - 既存 migration 001〜011
  - cleanup ロジック本体
  - fetcher / IPC / preload / renderer UI
  - `release.yml` / `ci.yml`
- 完成条件:
  - migration が `videos.in_playlist` / `playlist_added_at` / `playlist_removed_at`、関連 index、`playlist_sync_config` を追加する
  - `playlistRepository` が config 操作、playlist 動画一覧、diff 適用、削除済み一括削除、playlist ID 集合取得を提供する
  - `applyDiff` 全体を `better-sqlite3` transaction で包み、SQL は prepared statement を使う
  - `videoRepository` の `rowToVideo` を export して playlist 側で再利用し、row mapper を重複実装しない
  - 既存 migration と既存 DB データを破壊しない
- 変更内容:
  - 既存リポジトリには migration 005〜011 が既に存在したため、ハンドオフ上の「005_playlist_sync」相当を **`012_playlist_sync.js`** として追加
  - `src/main/db/schema.js` に migration 012 を登録
  - `videoRepository.js` の `rowToVideo` を top-level export に移動し、既存 repository 内の利用はそのまま維持
  - `playlistRepository.js` を新規追加。`getConfig` / `setConfig` / `updateLastSyncedAt` / `listPlaylistVideos` / `applyDiff` / `deleteRemoved` / `getPlaylistVideoIds` を実装
  - Phase 1 は fetcher 未実装のため、`applyDiff.added/restored` は既存行が無い場合に最小スタブ行を `INSERT OR IGNORE` し、playlist フラグを更新する
  - migration test と repository test を追加し、空 DB、004-era DB からの昇格、config 単一行制約、追加/削除/復活、空集合、重複 ID、削除+復活同時、削除済み一括削除を確認
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（36 files / 319 passed）
  - ✅ `npm run build`
- 実動確認: N/A（Phase 1 は読み取り・データ層のみ。UI 実動確認は Phase 3 以降）
- レビュー観点:
  - ハンドオフ指定の migration 番号 005 は現行 repo の既存 migration と衝突していたため、012 採番でよいか
  - `applyDiff` の同一 ID が `removed` と `restored` に同時指定された場合、現在 playlist に存在する扱いとして restored を勝たせる挙動でよいか
  - スタブ行の `status='ended'` / 空 channel/title は Phase 2 fetcher が metadata upsert で補完する前提でよいか
- 未解決:
  - cleanup の playlist 保持ポリシー反映はハンドオフ通り Phase 2 以降
  - fetcher / IPC / preload / UI は未実装
- 次アクション:
  - Claude Code が `/cross-review` で Phase 1 差分をレビューし、ユーザー merge 判断後に Phase 2 へ進む

---

## 2026-05-21 依頼（プレイリスト同期 Phase 1: migration 005 + playlistRepository — Claude Code → Codex）

- 対象: `develop` または `feature/playlist-sync-phase1`（推奨）
- 作成者: Claude Code（設計）／実装担当: Codex
- 主題: YouTube プレイリスト 1 件を取り込むための DB スキーマ追加と repository 実装（読み取り専用機能。fetcher / IPC / UI は Phase 2 以降で別依頼）
- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`（**着手前に必読**。SQL・カラム・保持ポリシーはすべてここで確定済み）

### 触ってよい範囲

- 新規: `src/main/db/migrations/005_playlist_sync.js`（既存 migration ファイル命名規則に合わせる。確認: `src/main/db/migrations/` 配下）
- 新規: `src/main/repositories/playlistRepository.js`
- 新規: `tests/main/repositories/playlistRepository.test.js`
- 新規: `tests/main/db/migrations/005_playlist_sync.test.js`
- 変更最小限: `src/main/db/index.js`（migration 配列に 005 を追加するだけ）

### 触ってはいけない範囲

- 既存 migration 001〜004 の改変
- 既存 `videos` テーブルのデータ削除を伴う ALTER
- `videos_fts` トリガー
- `cleanup` ロジック本体（Phase 2 で別途修正）
- 他の未マージ feature ブランチ
- `release.yml` / `ci.yml`

### 完成条件

1. **migration 005** が以下を実施する:
   - `videos` テーブルに `in_playlist INTEGER DEFAULT 0`、`playlist_added_at INTEGER`、`playlist_removed_at INTEGER` を追加
   - `idx_videos_in_playlist`、`idx_videos_playlist_removed` インデックス作成
   - `playlist_sync_config` テーブル新規作成（CHECK 制約で id=1 単一行）
2. **playlistRepository** が以下の関数を提供する（命名は既存 repo に合わせる）:
   - `getConfig()` → `{ playlistId, playlistTitle, lastSyncedAt, enabled } | null`
   - `setConfig({ playlistId, playlistTitle, enabled })` → void
   - `updateLastSyncedAt(timestamp)` → void
   - `listPlaylistVideos({ filter: 'all' | 'removed' })` → `videos[]`（既存 videos の row mapper を再利用）
   - `applyDiff({ added: videoId[], removed: videoId[], restored: videoId[] })` → void（トランザクション内で UPSERT / フラグ更新）
   - `deleteRemoved()` → `{ deleted: number }`（`playlist_removed_at IS NOT NULL` の行を物理削除）
   - `getPlaylistVideoIds()` → `Set<string>`（diff 計算用に in_playlist=1 の ID 集合を返す）
3. **テスト**:
   - migration 005 を空 DB に適用 → スキーマ確認
   - migration 005 を既存 003+004 適用済み DB に適用 → 既存データ温存確認
   - `applyDiff` の追加/削除/復活シナリオ（境界: 空集合、重複 ID、復活と削除同時）
   - `deleteRemoved` が `in_playlist=1` の行を消さないこと
   - `getConfig` が未登録時に null を返すこと
   - `setConfig` が単一行制約で複数行を作らないこと
4. `npm run lint` / `npm run test` / `npm run build` 全パス
5. **触ってはいけない範囲を変更していない**

### Verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認は Phase 3 以降で UI が出来てから Claude Code 側で実施するため、Phase 1 は不要。

### 既知リスク

- **既存 DB 互換性:** `ALTER TABLE ADD COLUMN` で既存行は DEFAULT 0 が入る。これは `is_favorite` と同じパターンで既存実装あり、参考: `migration 003`
- **トランザクション境界:** `applyDiff` は1つのトランザクションで全件処理する。途中失敗時は全ロールバック
- **row mapper の重複:** 既存 `videoRepository` の row mapper を import 再利用する（独立実装しない）
- **`channels` テーブル外部キー:** プレイリストに含まれる動画のチャンネルが未登録の場合、`videos.channel_id` が孤立する可能性。Phase 2 fetcher 側で `channels` を必要に応じて自動 INSERT する想定。Phase 1 はカラム追加のみで FK 整合は問わない

### レビュー観点（Claude Code が cross-review でチェックする）

- migration 005 が既存 DB を破壊しないか
- `playlistRepository` の SQL に SQL インジェクション余地がないか（プリペアド使用）
- トランザクション境界が `applyDiff` 全体を包んでいるか
- 既存 `videoRepository` の row mapper を再利用しているか（重複実装していないか）
- テストが境界値（空集合・復活・削除同時）を網羅しているか
- `playlist_sync_config` の CHECK 制約が単一行を保証しているか

### 次アクション

1. Codex: スキーマ確認 → migration 005 実装 → playlistRepository 実装 → テスト追加 → セルフ verify → 完了セクション追記
2. Claude Code: `/cross-review` でレビュー
3. ユーザー判断後に Phase 2（fetcher + IPC + scheduler 統合）を別依頼で着手

### 関連

- 設計仕様: `docs/superpowers/specs/2026-05-21-youtom-playlist-sync-design.md`
- 既存 migration: `src/main/db/migrations/`
- 既存 repo パターン: `src/main/repositories/videoRepository.js` / `statsRepository.js`

---

## 2026-05-21 00:16 機能追加（チャンネル「今すぐ同期」ボタン — Claude Code 作成）

- 作成者: Claude Code
- 主題: subscriptions.list の 24h キャッシュをバイパスして即座にチャンネル同期削除を反映するボタン
- ユーザー要望: 「沈黙チャンネルで対象を排除した後、反映されるタイミングが分からないと不便」+「ボタンは沈黙チャンネルにも追加」
- 変更:
  - `SchedulerService.resolveChannels` / `doRefresh` に `forceSubscriptionsResync` オプションを追加。true の場合 `lastSync` キャッシュチェックをスキップして subscriptions.list を即時取得
  - 新 IPC `channels:syncNow` を `videoHandlers.js` に追加（`scheduler.refresh({ forceSubscriptionsResync: true })` を呼んで `schedule:updated` を送信）
  - preload に `syncChannelsNow()` を公開
  - SettingsModal の「📌 チャンネル」タブ「優先チャンネル」セクションヘッダー下に「🔄 今すぐ同期」ボタン追加（disabled when 同期中/未認証）
  - StatsTab の「沈黙チャンネル」セクションヘッダー横に「🔄 今すぐ同期」ボタン追加。完了後 `reloadStats` も呼ぶ
  - App.jsx に `handleSyncChannelsNow({ reloadStatsAfter })` ハンドラと `isSyncingChannels` state を追加。toast でフィードバック
  - 既存の 30分自動ポーリング・24h キャッシュは変更なし
- テスト追加:
  - schedulerService: forceSubscriptionsResync で fresh cache でも subsFetcher.fetch が呼ばれる
  - StatsTab: 同期ボタン表示・クリックで onSyncNow 呼び出し・syncing=true で disabled
- セルフ verify: ✅ lint / ✅ test（34 files / 309 passed、+3 件）/ ✅ build
- 実動確認: ユーザーが Electron 閉じてからセルフ verify 実行、未確認の動作確認は次回 npm run dev で

---

## 2026-05-20 23:52 ユーザー指示反映（沈黙判定を投稿活動ベースに変更 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 沈黙判定は「配信のみ」ではなく「投稿活動全般（配信＋動画投稿）」を基準にする
- ユーザーフィードバック: 「投稿が指定日以内にあったら対象にしていい」— 動画投稿しか出していないチャンネルでも、最近の投稿があれば「生きている」と判断し、60日超活動なしのチャンネルだけを沈黙対象にしたい
- 対応:
  - `silentChannelsStmt` の活動時刻計算を `LIVE_ACTIVITY_AT`（actual/scheduled のみ）から `ANY_ACTIVITY_AT = COALESCE(v.actual_start_time, v.scheduled_start_time, v.published_at, 0)` に変更
  - 結果: 動画投稿のみのチャンネルも投稿日で評価される。直近60日に投稿があれば沈黙対象外、60日超なしなら沈黙対象
  - 投稿実績ゼロ（subscriptions だけ同期で videos レコードなし）は引き続き除外
  - UI note: 「直近60日以上、配信・動画投稿のないチャンネル」に再変更
  - empty state: 「60日以上活動のないチャンネルはありません」に変更
  - テスト更新: `excludes channels that have never livestreamed from silent list` を `includes channels with any old activity (upload or livestream) in silent list` にリネーム。UC_OLD_UPLOAD の期待を `not.toContain` → `toContain` に反転、UC_NO_DATA（動画レコードなし）が除外されることも確認
  - 推し見落とし / 配信頻度ランキング は引き続き配信のみ
- セルフ verify: ✅ lint / ✅ test（34 files / 306 passed）/ ✅ build
- レビュー観点: セクションごとに活動時刻の定義が違う（沈黙=投稿全般 / 他=配信のみ）ため、コード上のコメントで意図を明確化

---

## 2026-05-20 23:46 ユーザー指示反映（沈黙チャンネルから配信実績ゼロを除外 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 沈黙チャンネルセクションが「配信したこと無いチャンネル」まで対象にして実用にならなかった問題の修正
- ユーザーフィードバック: 「動画投稿しているサイトは対象外にして。配信したこと無いチャンネルまで対象にするとメチャクチャになる」
- 対応:
  - `silentChannelsStmt` の HAVING を `last_activity_at IS NULL OR last_activity_at = 0 OR last_activity_at <= @threshold` から **`last_activity_at > 0 AND last_activity_at <= @threshold`** に変更
  - 結果: 「過去に1回でも配信実績があるチャンネル」のうち「最新配信が60日以上前」のみを対象にする
  - ORDER BY からも `last_activity_at IS NULL DESC` 条件を削除（NULL ケースが HAVING で除外されるため不要）
  - UI note 文言: 「過去に配信したが直近60日以上配信していないチャンネル」に変更してニュアンスを明確化
  - テスト更新: `excludes regular video uploads` の UC_UPLOAD 期待を `toContain` → `not.toContain` に反転。さらに `excludes channels that have never livestreamed from silent list` テストを追加（200日前の動画投稿のみ vs 200日前の配信実績で挙動差を確認）
- セルフ verify: ✅ lint / ✅ test（34 files / 306 passed、+1 件）/ ✅ build
- レビュー観点: 配信実績ゼロのチャンネルは「沈黙」ではなく「そもそも対象外」という意味づけが UI 文言と一致しているか

---

## 2026-05-20 23:25 ユーザー指示反映（配信のみフィルタ化 — Claude Code 作成）

- 作成者: Claude Code
- 主題: インサイトタブの 3 セクションを「配信（ライブ・プレミア）のみ」に絞る
- ユーザーフィードバック: 配信頻度ランキングに通常の動画投稿が含まれていた。「配信なら配信のみにしてほしい」、対象は3セクション全部
- 対応:
  - `statsRepository.js` の WHERE 句で `(v.actual_start_time IS NOT NULL OR v.scheduled_start_time IS NOT NULL)` を追加
  - 活動時刻の基準を `MAX(actual_start_time, published_at)` から `COALESCE(actual_start_time, scheduled_start_time, 0)` に変更（配信に限定したため published_at は不要）
  - StatsTab.jsx の note 文言を「配信のみ」に統一: 「直近30日の未視聴配信」「60日以上配信実績のないチャンネル」「直近90日の配信件数（ライブ・プレミアのみ）」
  - empty state も「60日以上配信していないチャンネルはありません」に変更
  - テスト更新: published_at 依存テストを削除、`scheduled_start_time` のみで未開始配信が活動扱いになるテストと、通常動画投稿が除外されるテストを追加
- セルフ verify: ✅ lint / ✅ test（34 files / 305 passed）/ ✅ build
- レビュー観点: 配信判定が actual/scheduled の有無依存なので、もし将来 RSS から取得した動画にも scheduled_start_time が誤って付与されるケースが出たら誤検知の可能性あり（現状の `videoStatus.js` ではないため問題なし）

---

## 2026-05-20 20:45 ユーザー指示反映（タブ名変更・サブナビ追加 — Claude Code 作成）

- 作成者: Claude Code
- 主題: 実動確認後のユーザーフィードバック反映
- ユーザーフィードバック:
  - 当初の「視聴行動グラフ」イメージとは違うが、現実装はチャンネル整理機能として有用
  - 「統計」名は実態（推し見落とし/沈黙/頻度ランキング）と合わないため変更
  - 沈黙チャンネルにも YouTube リンクを追加してほしい
  - サブナビを追加して、どの項目があるか分かるようにしてほしい
- 対応:
  - タブ名: `📊 統計` → `💡 インサイト`（App.jsx）
  - StatsTab に **サブナビバー**（推し見落とし / 沈黙チャンネル / 配信頻度ランキング）を追加、各セクションは排他表示に変更。サブナビボタンには件数バッジ表示
  - 沈黙チャンネル行の title 部分を `yt-stats-row-link` ボタン化、クリックで `https://www.youtube.com/channel/{id}` を openExternal
  - main.css に `.yt-stats-subnav` `.yt-stats-row-link` 系スタイル追加
  - StatsTab.test.jsx をサブナビ切替テストに更新（3→ 3 件、内訳変更）
- セルフ verify: ✅ lint / ✅ test（34 files / 304 passed、+1 件）/ ✅ build
- 残課題: 「視聴行動グラフ」（推しチャンネル別視聴率、月別視聴本数推移）は別スプリント候補として inbox/strategies に温存予定

---

## 2026-05-20 19:10 クロスレビュー結果（統計タブ実装 — Claude Code 作成）

- レビュアー: Claude Code
- 対象: Codex 作成の統計タブ実装（未コミット）
- セルフ verify 再実行: ✅ `npm run lint` / ✅ `npm run test`（34 files / 303 passed）/ ✅ `npm run build`
- IPC 三点一致: ✅
  - preload `getChannelActivityStats()` → ipc `stats:channelActivity` → repo `getChannelActivity()`
  - preload `openExternal`, `deleteChannel` も既存定義あり
- 完成条件 8項目: ✅ 全て満たす
- レビュー所見:
  - 🟢 設定モーダル「📌 チャンネル」タブとの役割重複なし。設定は能動的管理、統計は結果ベース整理判断で補完関係
  - 🟢 集計 SQL は `deleted_at IS NULL` で論理削除チャンネルを除外しており適切
  - 🟢 `MAX(actual_start, published_at)` の組み合わせ判定で RSS/API/ライブ差分を吸収
  - 🟢 ダークモード対応・loading/error/empty 3状態網羅
  - 🟢 既存 IPC（`channels:setPinned`/`channels:delete`）再利用、新規 IPC は集計用1件に限定
  - 🟡 軽微1: 削除・推し解除に確認ダイアログなし。`handleStatsDeleteChannel` は元に戻せないが、再追加で復活可能なので merge ブロッカーではない。今後の懸念事項として記録
  - 🟡 軽微2: `unwatchedPinned` の SQL は `MAX(actual_start, published_at) >= 30日前` で、status=`upcoming`/`live` の動画も含まれる。完成条件 ① の文面（「直近30日に公開した動画」）より広いが、「推し見落としチェック」の趣旨としては upcoming/live も拾うのが妥当。仕様意図と一致と判断
  - 🟡 軽微3: SQL の `MAX(COALESCE(...), COALESCE(...))` 形式は actual_start_time / published_at の個別 index を活かせず scan になる。現状の DB サイズなら問題なし。将来 1万件超で遅延が出たら計算列 + index 追加で対応
- 🔴 重大指摘: **なし**
- 設計判断の良い点:
  - 「推し見落とし」を ScheduleCard で表示することで既存のお気に入り/お知らせ操作と一貫
  - 「沈黙チャンネル」を pinned/manual/other で分類し、整理対象を絞り込みやすい
  - 「配信頻度ランキング」のクリックで YouTube チャンネルページへ遷移、整理判断の確認動線として機能
- merge 判断: ユーザー指示待ち（4条件のうち ①②③ クリア、④ ユーザー判断）

---

## 2026-05-20 18:59 完了（統計タブ実装 — Codex 作成）

- 対象: `develop` / `H:/ClaudeCode/Youtube/youtube-schedule`
- 作成者: Codex
- 主題: チャンネル整理支援ダッシュボード「📊 統計」タブの限定実装
- 触ったファイル:
  - `src/main/repositories/statsRepository.js`（新規）— `stats:channelActivity` 用の集計 SQL
  - `src/main/ipc/statsHandlers.js`（新規）— `stats:channelActivity` IPC handler
  - `src/main/index.js` — stats repository / handler 登録
  - `src/preload/index.js` — `getChannelActivityStats()` 公開
  - `src/renderer/hooks/useStats.js`（新規）— 統計データ取得 hook
  - `src/renderer/components/StatsTab.jsx`（新規）— 統計タブ UI
  - `src/renderer/src/App.jsx` — 「📊 統計」タブ追加、StatsTab 接続
  - `src/renderer/src/assets/main.css` — 統計タブ用スタイル
  - `tests/main/repositories/statsRepository.test.js`（新規）— 境界値・分類テスト
  - `tests/renderer/StatsTab.test.jsx`（新規）— 空状態 / データあり smoke test
  - `CLAUDE_CODE_HANDOFF.md` — 本完了セクション追記
- 実装で判断した点:
  - 手動追加チャンネル判定は `channels.source` ではなく migration 011 の `channels.is_manual` を使用。`channels.source` カラムは存在しない。
  - 活動日時は `MAX(COALESCE(actual_start_time, 0), COALESCE(published_at, 0))` を各動画の基準にして、ライブ実績と RSS/API の投稿日差分を吸収。
  - 推し見落としは直近30日を `>= now - 30d`、沈黙は60日以上を `<= now - 60d`、頻度ランキングは直近90日を `>= now - 90d` として境界値を含める。
  - 配信頻度ランキングは handoff 指示通り DB 上の件数を母数とし、その旨を UI の note / tooltip に表示。
  - 削除済みチャンネル（`channels.deleted_at IS NOT NULL`）は統計対象から除外。
- セルフ verify:
  - ✅ `npm run lint`
  - ✅ `npm run test`（34 files / 303 passed）
  - ✅ `npm run build`
- 実動確認: N/A（handoff 指示どおり Codex はセルフ verify のみ。Electron 実動確認は Claude Code 側予定）
- レビュー観点:
  - `statsRepository` の集計 SQL が想定データ量で十分か、特に `MAX(COALESCE(actual_start_time, 0), COALESCE(published_at, 0))` 式の index 利用と FULL SCAN 許容範囲。
  - 統計タブの「推し解除」「手動追加削除」が設定モーダルのチャンネル管理と役割重複しすぎていないか。
  - 誤操作防止として削除/推し解除に確認ダイアログを足すべきか。
  - ダークモードのコントラストと 1280px 幅でのタブ列収まり。
- 未解決:
  - `CLAUDE_CODE_HANDOFF.md` には作業開始前から、過去セクションを `docs/handoffs/archive/` へ退避する未コミット差分と `docs/handoffs/` untracked が存在。今回の完了追記では巻き戻していない。
- 次アクション:
  - Claude Code: `/cross-review` で統計タブ実装をレビューし、必要なら実動確認（`npm run dev`）で UI 操作を確認。

---

## アーカイブ

過去セクションはセクション過多を避けるため、以下へ退避済み。

- `docs/handoffs/archive/CLAUDE_CODE_HANDOFF-2026-05-20-pre-cleanup.md` — 2026-05-15 Phase 0 から 2026-05-20 18:42 までの全履歴を含む cleanup 前スナップショット

運用方針:

- このルートファイルには現在進行中の依頼・レビュー・未解決ゲートだけを残す。
- 完了済みセクションは cleanup 時に `docs/handoffs/archive/` へ退避する。
- 古い履歴を参照する必要がある場合は、上記アーカイブを検索する。

---

## 2026-05-20 19:00 依頼（チャンネル整理支援ダッシュボード「📊 統計」タブの実装 — Claude Code → Codex）

- 作成者: Claude Code（設計）／実装担当: Codex
- ブランチ: `develop`（または `feature/stats-tab` を切ってもよい）
- worktree: `H:/ClaudeCode/Youtube/youtube-schedule`

### 目的

ユーザーが推しチャンネル・手動追加チャンネル・お気に入りを「結果を見ながら整理する」ための専用タブを追加する。設定モーダルの「📌 チャンネル」タブ（能動的に追加・推す場）と役割を分け、本タブは「活動量を見て整理判断する場」とする。

### 背景

- 既存タブ構成（App.jsx）: `schedule` / `missed` / `archive` / `favorites` / `new-videos`（簡易モード時）
- 推しチャンネル（`channels.is_pinned=1`）、お気に入り動画（`videos.is_favorite=1`）、手動追加チャンネル（`channels.source='manual'` 想定 — 既存スキーマを確認）、`viewed_at` / `notify` / `published_at` / `ended_at` の集計から、ユーザーの整理判断に役立つ指標を出す
- 既存の `videos_fts` / cleanup ポリシー（30日/90日/お気に入り永久）には触らない

### 完成条件

1. ヘッダーのタブ列に **「📊 統計」タブ** が追加され、クリックで表示が切り替わる
2. タブ内に **3セクション** が縦に並ぶ:
   - **① 推し見落としチェック**: `is_pinned=1` のチャンネルが直近30日に公開した動画のうち `viewed_at IS NULL` のものを ScheduleCard ベースで一覧表示。空なら「見逃しなし ✨」の empty state
   - **② 沈黙チャンネル**: 各チャンネルの最終 `published_at`（または最終 `actual_start`）から **60日以上経過** したチャンネルを「📌 推し / 🖐 手動追加 / その他」に分類。各分類ごとに件数バッジ + チャンネル名・最終配信日・アクションボタン（推し解除 / 手動追加削除）の行リスト
   - **③ 配信頻度ランキング**: 全チャンネルの直近90日の公開動画数（または `live`/`upcoming`/`ended` 全て含む配信数）を多い順に最大20件表示。推しバッジ付き、行クリックで YouTube チャンネルページを開く
3. アクションボタンは既存 IPC（`channels:setPinned` 等）を再利用。新規 IPC は **集計用1件** に限定する: `stats:channelActivity()` → `{ unwatchedPinned, silentChannels, frequencyRanking }`
4. データ取得は `useStats.js` hook 経由。タブ切替時にロード、`schedule:updated` で再取得
5. 既存4タブ（schedule / missed / archive / favorites）の動作・スタイルを変更しない
6. ダークモード対応
7. Vitest テストを以下に追加:
   - 集計クエリの境界値テスト（29日 / 30日 / 31日、59日 / 60日 / 61日、89日 / 90日 / 91日）
   - 推し / 手動追加 / その他の分類テスト
   - StatsTab レンダリング smoke test（空状態 / データあり）
8. `npm run lint` / `npm run test` / `npm run build` 全パス

### 対象ファイル

**新規作成**

- `src/main/repositories/statsRepo.js`（または `src/main/services/statsService.js`） — 集計 SQL を集約
- `src/main/ipc/statsHandlers.js`（または `videoHandlers.js` に同居） — `stats:channelActivity` IPC
- `src/renderer/src/hooks/useStats.js`
- `src/renderer/src/components/StatsTab.jsx`
- `tests/main/statsRepo.test.js`
- `tests/renderer/StatsTab.test.jsx`

**変更**

- `src/main/index.js`（IPC 登録）
- `src/preload/index.js`（API 公開）
- `src/renderer/src/App.jsx`（タブ追加）
- `src/renderer/src/components/ScheduleCard.jsx`（再利用可能なら触らない、props 追加が必要なら最小限）

### 触ってよい範囲

- 上記「対象ファイル」のリスト
- `App.jsx` のタブ切替ロジック（既存タブの定義は変更しない、追加のみ）
- 既存スタイルの再利用（CSS Modules / Tailwind / styled — 既存方針に合わせる）

### 触ってはいけない範囲

- 既存 DB migration（`migrations/001..004`）の改変
- 既存 IPC handler の signature 変更
- `videos_fts` トリガー / cleanup ポリシー
- 既存タブのレイアウト / 並び
- `release.yml` / `ci.yml`
- 別 feature/branch の未マージ変更
- 未 push のローカルコミット `64fc89f`（SignPath メモ） / `2c1c4d1`（クォータリセット修正）を巻き戻さない

### verify コマンド

```powershell
npm run lint
npm run test
npm run build
```

実動確認（Claude Code 側で実施予定 — Codex はセルフ verify のみで OK）:

```powershell
npm run dev
```

### 既知リスク

- **チャンネルの「手動追加」フラグ**: スキーマに `channels.source` カラムがあるか未確認。なければ `subscriptions.list` 由来かどうかを別経路で判定する必要あり。実装着手時に `src/main/db/migrations/` と `channelsRepo.js` を読んで確認すること
- **`videos.published_at` vs `actual_start`**: 沈黙判定の基準時刻はどちらを使うか要判断。RSS 由来の動画は `published_at`、ライブは `actual_start` がより新しい。両方の MAX を取るのが正解
- **配信頻度の母数**: 削除済み / メン限化された動画を `videos` テーブルから消していないため、過去90日の DB 件数 = 実配信数 とは限らない。今回は「DB 上の件数」を母数とし、その旨をツールチップで補足する
- **タブ列の幅**: タブが多くなりつつあるためモバイル想定はないが、横幅 1280px で全タブが収まることを確認
- **テストの DB**: `better-sqlite3` の in-memory DB を使う既存パターンに合わせる（`tests/main/` の他テスト参照）

### レビュー観点（Claude Code が cross-review でチェックする）

- 設定モーダル「📌 チャンネル」タブとの役割重複がないか
- アクションボタンの誤操作防止（推し解除の確認ダイアログ要否）
- 集計クエリの N+1 / 不要な FULL SCAN がないか
- ダークモードでコントラスト破綻していないか
- 空状態 / loading / error の3状態が網羅されているか
- IPC 契約の preload / main / renderer 三点一致

### 次アクション

1. Codex: スキーマ確認 → 実装 → セルフ verify → ハンドオフに完了セクション追記（実装ファイル一覧・自己検証結果）
2. Claude Code: `/cross-review` で review → 🔴 解消後にユーザー判断で develop へ統合
3. ユーザー: 動作確認 → v1.18.0 リリースに含める判断

---

---
