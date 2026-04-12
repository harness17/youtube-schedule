---
name: verify
description: ESLint チェックと Vitest テストを実行して問題がないか確認する。実装完了後やコミット前に使う。
---

以下を順番に実行してください。

```bash
cd H:/ClaudeCode/Youtube/youtube-schedule
npm run lint
npm run test
```

- ESLint エラーがあれば内容を報告し、修正案を提示する。
- テストが失敗していればどのテストが失敗したか報告し、原因を調査する。
- どちらも問題なければ「lint と test がすべてパスしました」と報告する。
