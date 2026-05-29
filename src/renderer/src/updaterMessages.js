// 更新チェックのエラーをユーザー向け日本語メッセージに変換する。
// main プロセスは内部コード（例: 'UPDATE_CHECK_FAILED'）を送る場合と、
// 既に日本語化済みの文字列（開発環境スキップ通知など）を送る場合がある。
// 既知コードは日本語へ変換し、未知の値・既に日本語の文字列はそのまま返す。
const UPDATER_ERROR_MESSAGES = {
  UPDATE_CHECK_FAILED: '更新の確認に失敗しました。時間をおいて再試行してください。'
}

export function updaterErrorMessage(codeOrText) {
  return UPDATER_ERROR_MESSAGES[codeOrText] ?? codeOrText
}
