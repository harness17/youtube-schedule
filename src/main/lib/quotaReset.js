// YouTube Data API のクォータ超過（403 quotaExceeded）の判定とリセット時刻計算。
//
// クォータは太平洋時間の深夜0時にリセットされる。これは 08:00 UTC（PST, UTC-8）。
// 夏時間（PDT, UTC-7）でも YouTube の集計は太平洋標準時基準のため 08:00 UTC で扱う。

const QUOTA_RESET_UTC_HOUR = 8

// 403 かつメッセージ／理由に "quota" を含むエラーをクォータ超過とみなす。
// GaxiosError は code / status に 403、message と cause.errors[0].reason を持つ。
export function isQuotaError(err) {
  if (!err) return false
  const code = err.code ?? err.status ?? err.response?.status
  if (Number(code) !== 403) return false
  const message = String(err.message ?? err.cause?.message ?? '')
  const reason = String(err.errors?.[0]?.reason ?? err.cause?.errors?.[0]?.reason ?? '')
  return /quota/i.test(message) || /quota/i.test(reason)
}

// 指定時刻の直後に来るクォータリセット時刻（epoch ms）を返す。
export function nextQuotaReset(from = Date.now()) {
  const reset = new Date(from)
  reset.setUTCHours(QUOTA_RESET_UTC_HOUR, 0, 0, 0)
  if (reset.getTime() <= from) {
    reset.setUTCDate(reset.getUTCDate() + 1)
  }
  return reset.getTime()
}
