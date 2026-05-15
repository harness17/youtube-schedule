// YouTube contentDetails.duration（ISO 8601, 例 "PT1H2M3S"）を秒数へ変換する。
// 解析できない場合や空入力は null を返す（duration 未取得を表す）。
export function parseDuration(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return null
  const [, h, m, s] = match
  if (h === undefined && m === undefined && s === undefined) return null
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
}
