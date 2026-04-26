---
name: verify
description: ESLint チェック・Vitest テスト・本番ビルドを実行して問題がないか確認する。実装完了後やコミット前に使う。
---

以下を順番に実行してください。

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm run lint
npm run test
npm run build
```

- ESLint エラーまたは warning があれば内容を報告し、修正案を提示する。
- テストが失敗していればどのテストが失敗したか報告し、原因を調査する。
- `npm run build` でビルドエラーが出た場合は内容を報告し、修正案を提示する。
- 3 つすべて問題なければ「lint・test・build がすべてパスしました」と報告する。
