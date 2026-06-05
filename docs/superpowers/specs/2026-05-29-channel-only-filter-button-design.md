# 配信カード「このチャンネルのみ」フィルターボタン — 設計

- 作成日: 2026-05-29
- ステータス: 実装完了（`feature/channel-only-filter` ブランチ）。次フェイズと同時リリース予定
- 対象: `src/renderer/components/ScheduleCard.jsx` ほか
- 実装メモ: テスト容易性のため archive トグルロジックを純粋関数 `channelFilter.js` に抽出した。当初 doc の「4 ファイル」から、本体 3 + 新規純粋関数 1 + テスト 3 に増えている（下表参照）

## 目的

配信カードのチャンネル欄から、そのチャンネルだけに絞り込む操作をワンクリックで行えるようにする。現状はチャンネルを絞るには上部のセレクトボックス（非アーカイブタブ）または ArchiveFilterBar（アーカイブタブ）を開いて選ぶ必要があり、カードを見ながら「この配信者だけ見たい」と思ったときの導線がない。

## スコープ

### 対象タブ

チャンネルフィルターが実際に効くタブにのみボタンを出す。

- 予定・ライブ（schedule）
- 見逃し（missed）
- お気に入り（favorites）
- アーカイブ（archive）

### 非スコープ・対象外タブ

- **feed（新着動画）**: 現状チャンネル絞り込み機構を持たない（`feedVideos` は `filterItem` を通さず raw 描画され、`tabChannels` も空で上部セレクトボックスが出ない）。ボタンを出しても no-op になるため対象外とする。feed への絞り込み機構新設は本フェイズのスコープ外。
- **playlist / stats**: `selectedChannel` フィルターを持たないため対象外。
- 複数チャンネルの累積選択（OR 絞り込み）。
- 上部セレクトボックス・ArchiveFilterBar 自体の UI 変更。

feed / playlist / stats は後述の通り `onFilterChannel` を渡さないことでボタンが描画されない。

## UI

ScheduleCard のチャンネル行（チャンネル名 + 「📌 チャンネル優先」ボタン）に、**「📌 チャンネル優先」の左隣**へボタンを追加する。

- 通常時ラベル: `🔍 このチャンネルのみ`
- 選択中ラベル: `🔍 このチャンネルだけ表示中`（ハイライト表示でトグル解除可能なことを示す）
- スタイルは既存「📌 チャンネル優先」ボタンと同じ pill 型を踏襲（light/dark 両対応）

## 挙動

ScheduleCard は自分がどのタブにいるかを知らない。タブごとの差異は **App.jsx が `activeTab` に応じてハンドラと判定関数を生成し、prop として渡す**ことで吸収する。

| タブ | クリック時の動作 | 「選択中」判定 |
|------|----------------|--------------|
| schedule / missed / favorites | `setSelectedChannel(channelId)`。すでに選択中なら `'all'` に戻す | `selectedChannel === item.channelId` |
| archive | `setArchiveFilters({ ...filters, channelIds: [channelId] })`。すでに単独選択中なら `channelIds: []` に戻す | `channelIds.length === 1 && channelIds[0] === item.channelId` |

- 非アーカイブタブでは上部セレクトボックスに反映され、既存のチャンネル絞り込みと完全に同じ挙動になる。
- アーカイブタブでは ArchiveFilterBar の channelIds に反映され、`useTabState` の `[archiveFilters]` 監視 effect 経由で再検索（`runArchiveSearch`）が走る。period などの他フィルターは保持する。
- アーカイブで複数チャンネルを選択中の状態でボタンを押した場合は、そのチャンネル単独へ置換する（「選択中」とは判定されないため、押下＝置換）。

## App ↔ 子コンポーネントの契約

`isChannelFiltered` の算出は App.jsx に一本化し、**判定関数 `isChannelFiltered(channelId): boolean` を 1 つだけ定義**して子へ渡す。二重定義しない。

```js
// App.jsx
function handleFilterChannel(channelId) { /* activeTab で分岐（上表） */ }
function isChannelFiltered(channelId) { /* activeTab で分岐（上表） */ }
```

- `renderTabCard(item)`: 内部で `isChannelFiltered(item.channelId)` を呼んで bool を解決し、`onFilterChannel={handleFilterChannel}` と `isChannelFiltered={...bool}` を ScheduleCard に渡す。
  - ただし **feed の呼び出しだけ `onFilterChannel={undefined}` で上書き**してボタンを抑止する（feed も renderTabCard 経由のため）。
- `ScheduleList`: `onFilterChannel={handleFilterChannel}` と判定関数 `isChannelFiltered`（関数のまま）を受け取り、各 ScheduleCard へ `isChannelFiltered={isChannelFiltered(item.channelId)}` として渡す。

## ScheduleCard の新 props

```js
onFilterChannel?: (channelId: string) => void  // 未指定ならボタン非表示（後方互換）
isChannelFiltered?: boolean                      // ハイライト・ラベル切替
```

- `onFilterChannel` が渡らない呼び出し（feed / PlaylistTab / StatsTab）ではボタンが描画されない。既存呼び出しは変更不要で後方互換。
- `item.channelId` が無い動画ではボタンを出さない（チャンネル名 span が YouTube リンクにならないのと同じ条件）。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/channelFilter.js` | **（新規）** archive の channelIds トグル純粋関数 `isArchiveChannelOnly` / `toggleArchiveChannelOnly`。テスト容易性のため App から抽出 |
| `src/renderer/components/ScheduleCard.jsx` | ボタン追加、`onFilterChannel` / `isChannelFiltered` props と PropTypes |
| `src/renderer/src/App.jsx` | `handleFilterChannel` / `isChannelFiltered`（activeTab で分岐、archive は `channelFilter.js` を使用）を定義。`renderTabCard` に中継（feed 呼び出しのみ `onFilterChannel: undefined` で抑止）。`ScheduleList` に中継 |
| `src/renderer/components/ScheduleList.jsx` | `onFilterChannel` と判定関数 `isChannelFiltered` を受け取り、各 ScheduleCard へ中継。PropTypes 追加 |
| `tests/renderer/channelFilter.test.js` | **（新規）** 純粋関数の境界テスト 8 件 |
| `tests/renderer/ScheduleCard.test.jsx` | ボタンの表示有無・onClick・ハイライト切替のテスト 6 件追加 |
| `tests/renderer/ScheduleList.test.jsx` | 中継テスト 3 件追加 |

## 完成条件

- 正常系1: schedule / missed / favorites タブでボタン押下 → 上部セレクトボックスが該当チャンネルに変わり、そのチャンネルのみ表示される
- 正常系2: archive タブでボタン押下 → ArchiveFilterBar が該当チャンネル単独に置換され、再検索される
- トグル: 該当チャンネルのみを選択中のカードで再押下 → 「すべて」（all / channelIds 空）に戻る
- ハイライト: 選択中チャンネルのカードはボタンがハイライトされ、ラベルが「このチャンネルだけ表示中」になる
- 後方互換: feed / playlist / stats タブにはボタンが出ない
- 副作用なし: 既存タブの表示・並び・既存ボタン（📌/⭐/🔔/✓）を壊さない
- 検証: `npm run lint` / `npm run test` / `npm run build` がすべて pass。`npm run dev` で対象 4 タブの実動確認

## テスト観点（ScheduleCard 単体）

- `onFilterChannel` 未指定 → ボタンが描画されない
- `onFilterChannel` 指定 → ボタンが描画され、クリックで `item.channelId` を引数に呼ばれる
- `isChannelFiltered=true` → ハイライト用クラス/スタイルとラベル「このチャンネルだけ表示中」になる
- `item.channelId` が無い → ボタンが描画されない

## リリース連携

次フェイズと同時リリースのため、リリースノートに新機能として「配信カードからワンクリックでそのチャンネルだけに絞り込めるボタンを追加」を 1 行加える。README「機能」セクションの更新も対象。
