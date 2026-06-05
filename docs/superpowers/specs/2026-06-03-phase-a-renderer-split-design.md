# Phase A: renderer 巨大コンポーネント解体

作成日: 2026-06-03
対象リリース: v1.23.0
担当: Codex（実装）／ Claude Code（レビュー）
親ロードマップ: `2026-05-27-debt-repayment-roadmap.md`

## 目的

Phase B/C で main 側とテスト網を整えた後、renderer 側の巨大化した責務を小さく分ける。目的は新機能追加ではなく、`SettingsModal.jsx`、`App.jsx`、`useTabState.js` の変更コストとレビュー負荷を下げること。

## 背景

renderer には UI、タブ状態、IPC 呼び出し、表示用の分類ロジックが同居している。特に `SettingsModal.jsx` は設定タブ、チャンネル管理、認証導線、データ操作、アプリ情報を 1 ファイルで持ち、`App.jsx` はタブ描画とアクション中継をまとめて抱えている。Phase A は一度に置換せず、既存 UI と IPC contract を固定したまま純粋ロジックと小さな UI 単位を段階的に抽出する。

## Non-goal

- UI デザイン、タブ構成、文言の大幅変更
- main / preload / IPC channel の変更
- DB migration 追加
- YouTube API 呼び出し回数の増加
- TypeScript 化
- CSS フレームワーク導入

## 完成条件

1. `SettingsModal.jsx` は表示モデル、タブ単位 UI、イベント処理の境界が分かれている。
2. `App.jsx` はタブ描画とタブ別アクション中継を小さな helper / component へ分け、既存タブの挙動を維持する。
3. `useTabState.js` は archive、favorites、channel filter などの純粋な状態更新 helper を外へ出し、hook 本体は IPC と state orchestration に寄せる。
4. 抽出した純粋関数には focused unit test がある。
5. `npm run lint` / `npm run test` / `npm run build` が pass する。

## スライス

### Slice 1: SettingsModal 表示モデル抽出

- `settingsModalModel.js` を追加し、タブ定義、チャンネル並び替え、購読/手動追加チャンネル分類、手動動画追加メッセージを純粋関数へ抽出する。
- `SettingsModal.jsx` は抽出関数を呼ぶだけにし、UI と IPC 呼び出しの意味を変えない。
- focused test で正常系、空値、検索、手動追加チャンネル、未知エラーを検証する。

### Slice 2: SettingsModal タブ UI 分割

- display / channels / data / connection / about を小さな component に分ける。
- 既存 inline style は初回スライスでは維持し、style system の再設計を混ぜない。
- props は必要最小限にし、IPC 呼び出しを無理に移動しない。

### Slice 3: App tab rendering 分割

- タブ定義、タブごとの empty/loading/render 分岐、`renderTabCard` 周辺を helper / component に分ける。
- `selectedChannel` と archive channel filter の挙動は既存テストで固定する。

### Slice 4: useTabState 状態更新 helper 抽出

- archive filter 正規化、favorites 並び替え、チャンネルリスト抽出などを pure helper 化する。
- hook の public return shape は維持し、呼び出し側を変更しない。

## リスクと対策

| リスク                                           | 緩和                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| UI 分割で props が膨らみ、かえって読みにくくなる | Slice 1 は純粋関数だけに留め、component 分割は次スライスで実測する      |
| 既存タブの表示条件が変わる                       | renderer test を既存挙動の regression として使い、UI 文言変更を混ぜない |
| IPC contract の片側更新が混ざる                  | Phase A の Non-goal とし、必要になった場合は別 handoff で設計する       |
| App/useTabState を同時に触りすぎる               | Slice 3 と Slice 4 を分け、1 スライス 1 責務にする                      |

## Verify

```powershell
npm run lint
npm run test
npm run build
```
