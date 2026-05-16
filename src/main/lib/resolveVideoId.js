// YouTube 動画 ID は 11 文字（英数・ハイフン・アンダースコア）。
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

// 入力（生の動画 ID または各種 YouTube URL）から 11 桁の動画 ID を取り出す。
// 取り出せない場合は null を返す。
export function resolveVideoId(input) {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  // 生の動画 ID
  if (VIDEO_ID_RE.test(trimmed)) return trimmed

  let url
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  // watch?v=ID
  const vParam = url.searchParams.get('v')
  if (vParam && VIDEO_ID_RE.test(vParam)) return vParam

  // youtu.be/ID, /live/ID, /shorts/ID, /embed/ID — パス末尾セグメント
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (last && VIDEO_ID_RE.test(last)) return last

  return null
}
