// YouTube Data API のクォータ超過（403 quotaExceeded）の判定とリセット時刻計算。
//
// クォータは太平洋時間（America/Los_Angeles）の深夜 0:00 にリセットされる。
// PST（UTC-8, 冬）と PDT（UTC-7, 夏）で UTC 換算が 1 時間ずれるため、
// 固定の UTC 時刻ではなく Intl API で正しいタイムゾーンを解決する。

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

const LA_PARTS_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

function laPartsAt(epochMs) {
  const out = {}
  for (const p of LA_PARTS_FMT.formatToParts(new Date(epochMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  // en-CA は 24:00 ではなく 00:00 を返すが、念のため正規化する。
  if (out.hour === 24) out.hour = 0
  return out
}

// 指定時刻の直後に来るクォータリセット時刻（epoch ms）を返す。
// LA タイムゾーンでの「次の 0:00」を、PST/PDT 切替を含めて正しく解決する。
export function nextQuotaReset(from = Date.now()) {
  const now = laPartsAt(from)
  // 「LA 時間として組み立てた値を UTC として扱った epoch」と元 epoch の差で
  // その時点の LA UTC オフセット（負値）を求める。
  const nowAsUtc = Date.UTC(now.year, now.month - 1, now.day, now.hour, now.minute, now.second)
  const offset = nowAsUtc - from

  // LA の翌日 0:00 を UTC として組み立て、オフセット分を引いて真の UTC epoch にする。
  const nextLaMidnightAsUtc = Date.UTC(now.year, now.month - 1, now.day + 1, 0, 0, 0)
  let candidate = nextLaMidnightAsUtc - offset

  // DST 境界をまたぐとオフセットが変わるため、候補時刻における LA hour で再評価して補正する。
  const drift = laPartsAt(candidate).hour
  if (drift !== 0) {
    const shift = drift < 12 ? -drift : 24 - drift
    candidate += shift * 3600_000
  }

  // 念のため from 以下になっていないか確認。
  if (candidate <= from) candidate += 24 * 3600_000
  return candidate
}
