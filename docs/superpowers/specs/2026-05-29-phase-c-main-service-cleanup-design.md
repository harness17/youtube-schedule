# Phase C: main 側サービス層整理

作成日: 2026-05-29
対象: YouTom v1.22.0

## 目的

Phase B で張った IPC / auth テスト網を土台に、main 側の巨大化した service / repository を段階的に分離する。目的は新機能追加ではなく、次の renderer 分割（Phase A）前に main process の責務境界を読みやすくすること。

## 背景

`schedulerService.js` は購読チャンネル解決、RSS 収集、API details 取得、孤立 live 救済、cleanup、quota 状態、archive backfill、手動動画追加、playlist refresh 委譲を 1 ファイルで持っている。`videoRepository.js` も表示用 query、archive query、favorite/import、cleanup を同居している。

Phase C はこれらを一度に置換せず、既存の IPC contract と DB schema を固定したまま小さな分離を積む。

## Non-goal

- renderer / preload / IPC channel の変更
- DB migration 追加
- YouTube API 呼び出し回数の増加
- cleanup retention policy の変更
- UI 表示やタブ構成の変更
- TypeScript 化

## 完成条件

1. `schedulerService.refresh()` の外部挙動を維持したまま、動画レコード変換、cleanup、quota 状態管理が独立 module に分かれている。
2. `imminentPoller` は `schedulerService` ではなく動画レコード変換 module に依存する。
3. 分離 module は focused unit test を持つ。
4. 既存 `schedulerService` / `imminentPoller` / repository tests が pass する。
5. `npm run lint` / `npm run test` / `npm run build` が pass する。

## スライス

### Slice 1: scheduler helper 抽出

- `videoRecordMapper`: YouTube API detail / RSS entry を DB record に変換する pure mapper。
- `schedulerMaintenance`: cleanup interval、retention threshold、quota exceeded state を扱う maintenance helper。
- `schedulerService`: refresh orchestration の公開 API は維持し、helper を組み込むだけに留める。

### Slice 2: refresh phase 分離

候補:

- channel resolution
- RSS collection + playlist fallback
- recheck target planning
- orphan live check

この段階では関数分離に留め、service class や DI 構造の大変更は避ける。

### Slice 3: videoRepository query 整理

候補:

- visible/missed/archive/favorites/feed の read query を query module に分離
- favorite/import/write operations は repository に残す

SQL の意味が変わるため、Slice 1/2 の verify 後に扱う。

## リスクと対策

- `toVideoRecord` の import 元変更で通知ポーラーが壊れる: `imminentPoller` focused test で検出する。
- cleanup / quota metadata key の文字列変更: constants を module に閉じ込め、既存 key 名を維持する。
- scope creep: Slice 1 では DB schema、IPC、renderer、SQL の意味を変更しない。

## Verify

```powershell
npm run lint
npm run test
npm run build
```
