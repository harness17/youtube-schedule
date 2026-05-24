# Handoff Protocol

`CLAUDE_CODE_HANDOFF.md` は Codex と Claude Code の共有作業ログ。最新の追記を上に置く。

## 追記するタイミング

- 片方のエージェントへ実装、レビュー、検証を渡すとき。
- 設計方針、触ってよい範囲、検証条件が変わったとき。
- ブロッカー、競合、未解決リスクが出たとき。
- 作業完了時に次の担当者が迷う情報があるとき。

## 追記テンプレート

```md
## YYYY-MM-DD HH:mm 追記（<主題> — <agent> 作成）

- 対象: <branch / worktree / path>
- 作成者: <Codex | Claude Code | user>
- 主題: <一文>
- 触ってよい範囲: <files / directories>
- 触ってはいけない範囲: <unrelated files / user changes>
- 削除すべきファイル: <置き換え対象 / 廃止コンポーネント。なければ「なし」と明記>
- 完成条件:
  - <normal behavior>
  - <preconditions / auth / usage>
  - <error handling>
  - <no-regression checks>
- IPC 契約（該当する場合）:
  - main handler: <channel と signature>
  - preload exposure: <window.api.* の path>
  - renderer 呼び出し: <hook / component>
  - event 発火・購読ペア: <send 側 / on 側。request/response 型 IPC で event ペアが無い場合は `N/A: 理由` を明記>
- 変更内容:
  - <summary>
- セルフ verify: <command and result>
  - `npm run test` が dev サーバ起動中の EPERM で停止した場合、targeted vitest は **暫定の原因切り分け用** に留める。merge 前は dev サーバを停止して `npm run test` 全体を再実行する。再実行で通らない限り merge ゲート ① は未達扱いとし handoff に明記
- 実動確認: <method and result or N/A>
- レビュー観点:
  - <risk-focused checks>
- 未解決:
  - <questions / blockers>
- 次アクション:
  - <one concrete action>
```

## 書き方

- secret、個人情報、環境固有 token は書かない。
- 「何をしたか」だけでなく「次に何を見ればよいか」を書く。
- 検証未実行を成功扱いしない。
- 同じ主題の handoff がある場合は重複作成より追記を優先する。
