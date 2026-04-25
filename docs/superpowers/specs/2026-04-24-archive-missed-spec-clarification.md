# アーカイブ・見逃し機能 仕様整理

作成日: 2026-04-24

## 背景

migration 003 / 004 でアーカイブ・見逃し・お気に入り・お知らせ機能を実装した。タブ構成と DB カラムは定着したが、以下の点が実装時に暗黙で決まっており、挙動として曖昧だった。

- 🔔（notify）を付けた配信も 30 日で自動削除される（見逃し一覧から自然消滅する）
- アーカイブタブが「全 ended 閲覧」なのか「見終わった履歴」なのかが未定義
- `viewed_at` が missed タブの絞り込み専用になっており、アーカイブで既読/未読の区別が無い

本ドキュメントで挙動を確定させ、cleanup ルールと UI 表現を更新する。

## タブの役割（確定）

| タブ             | 条件                                                | 位置づけ                                    |
| ---------------- | --------------------------------------------------- | ------------------------------------------- |
| 予定・ライブ     | upcoming + live                                     | リアルタイム用                              |
| 見逃し（missed） | `status='ended' AND notify=1 AND viewed_at IS NULL` | 🔔 を付けたのに見られなかった配信の拾い上げ |
| アーカイブ       | `status='ended'` すべて（missed 含む）              | 過去配信の閲覧・検索用倉庫                  |
| お気に入り       | `is_favorite=1`                                     | 永久保存棚                                  |

アーカイブは「見終わった履歴」ではなく「全 ended の倉庫」。missed と重複表示は意図通り。

## 保持ポリシー（変更）

cleanup は `SchedulerService.refresh()` 末尾で 24h ごとに実行。以下の順で判定する。

```
1. is_favorite = 1                     → 永久保持
2. notify = 1 AND viewed_at IS NULL    → 90 日保持
3. それ以外                             → 30 日保持
```

### 各状態の遷移

- 🔔 を付けた配信は、見逃しを消し損ねても 90 日まで残る
- ユーザーが ✓（見た）を押すと `viewed_at` がセットされ、missed から消える。同時に保持期間は 30 日扱いに戻る
- ⭐ を付ければ永久保持（notify の有無は無関係）

### cleanup SQL（実装方針）

現状の `deleteExpiredStmt` を 1 本から 2 本に分ける、または以下のような条件式に更新する：

```sql
DELETE FROM videos
WHERE status = 'ended'
  AND is_favorite = 0
  AND (
    (notify = 1 AND viewed_at IS NULL AND COALESCE(ended_at, last_checked_at) < @notifyThreshold)
    OR
    ((notify = 0 OR viewed_at IS NOT NULL) AND COALESCE(ended_at, last_checked_at) < @defaultThreshold)
  )
```

- `@notifyThreshold` = now − 90 日
- `@defaultThreshold` = now − 30 日

定数は `schedulerService.js` に `NOTIFY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000` を追加。既存の `ENDED_RETENTION_MS = 30日` はそのまま使用。

## 既読の視覚表現（新規）

アーカイブタブで `viewed_at IS NOT NULL` の動画を視覚的に区別する。

- ScheduleCard に `isViewed` prop を追加（bool）
- `isViewed=true` のカードは：
  - サムネイル・タイトル行の透明度を下げる（例: `opacity: 0.6`）
  - 「見た」バッジをタイトル近傍に表示
- `isViewed` は `item.viewedAt != null` を渡す
- 既存の `showViewedButton` prop とは独立（✓ ボタンの表示制御と、既読表示は別軸）

missed タブは定義上 `viewed_at IS NULL` しか出ないため影響なし。favorites タブでも `isViewed` を渡して既読を視覚化する。schedule タブでは `isViewed` を渡さない。

## ボタンの有効範囲（現状維持・明文化）

| ボタン            | schedule | missed | archive | favorites |
| ----------------- | -------- | ------ | ------- | --------- |
| 🔔 notify         | ○        | ○      | ○       | ○         |
| ⭐ favorite       | ○        | ○      | ○       | ○         |
| ✓ viewed          | ×        | ○      | ○       | ○         |
| 📌 pin（channel） | ○        | ○      | ○       | ○         |

`showViewedButton` を true にするのは missed / archive / favorites。⭐ は永久保持なので viewed_at を付けても削除対象にはならないが、「見終わった／まだ」の目印として使える。

## 影響範囲

### 変更するファイル

- `src/main/repositories/videoRepository.js` — `deleteExpiredStmt` の条件式を更新。`deleteExpired({ defaultThreshold, notifyThreshold })` で 2 つの閾値を受け取る
- `src/main/services/schedulerService.js` — `NOTIFY_RETENTION_MS` 定数を追加。cleanup 時に両閾値を渡す
- `src/renderer/src/App.jsx` — アーカイブタブで ScheduleCard に `isViewed` を渡す
- `src/renderer/src/components/ScheduleCard.jsx` — `isViewed` prop を受けて薄表示＋バッジ。PropTypes 追加
- `CLAUDE.md` — 保持ポリシー表を更新

### 変更しないもの

- DB スキーマ（カラム追加なし）
- IPC / preload API（既存の `markViewed`, `toggleFavorite`, `toggleNotify` をそのまま使用）
- missed / archive の SELECT クエリ（条件は変わらない）

## テスト観点

- **正常系**: notify=1 の動画は 30 日経過しても残る（90 日経過で消える）
- **遷移**: notify=1 の動画に viewed_at をセットすると 30 日扱いに戻る（31 日経過で消える）
- **お気に入り優先**: is_favorite=1 の動画は notify や viewed_at の状態に関わらず永久保持
- **境界値**: ended_at = 30 日ちょうど前 / 90 日ちょうど前での挙動
- **UI**: アーカイブタブで `viewedAt != null` のカードが薄表示＋バッジ表示される
- **UI**: missed タブには既読バッジが出ない（定義上）

## 非目標

- 見逃しタブに「保持残り X 日」の表示（複雑化するため今回はやらない）
- アーカイブのフィルタ機能（「未見のみ」切替）は今回やらない
- 手動削除 UI（アーカイブからの個別削除）は今回やらない

---

関連判断:

- `decisions/メンバー限定配信を対象外にしたのはAPI発見経路がないため.md`

案件: YouTube Schedule Viewer
