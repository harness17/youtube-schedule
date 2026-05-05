import nodeFetch from 'node-fetch'

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{20,30}$/
const HANDLE_RE = /^@[^/\s]+$/

export function uploadsPlaylistIdFromChannelId(channelId) {
  return `UU${channelId.slice(2)}`
}

export function parseChannelInput(raw) {
  const input = String(raw ?? '').trim()
  if (!input) {
    throw new Error('チャンネルIDまたはURLを入力してください')
  }

  if (CHANNEL_ID_RE.test(input)) return input

  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error('チャンネルID、または /channel/UC... 形式のURLを入力してください')
  }

  const match = url.pathname.match(/\/channel\/(UC[A-Za-z0-9_-]{20,30})(?:\/|$)/)
  if (!match) {
    throw new Error('チャンネルID、/channel/UC... 形式のURL、または @handle を入力してください')
  }
  return match[1]
}

function getHandleUrl(raw) {
  const input = String(raw ?? '').trim()
  if (HANDLE_RE.test(input)) {
    return `https://www.youtube.com/@${encodeURIComponent(input.slice(1))}`
  }

  try {
    const url = new URL(input)
    if (url.hostname.endsWith('youtube.com') && /^\/@[^/\s]+/.test(url.pathname)) {
      return url.toString()
    }
  } catch {
    // direct channel ID parsing will report the final validation error
  }

  return null
}

function extractChannelFromHtml(html) {
  const channelId =
    html.match(/"channelId":"(UC[A-Za-z0-9_-]{20,30})"/)?.[1] ??
    html.match(/"externalId":"(UC[A-Za-z0-9_-]{20,30})"/)?.[1] ??
    html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,30})/)?.[1]
  if (!channelId) return null

  const title =
    html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/\s*-\s*YouTube\s*$/, '')
  return { id: channelId, title: title ? decodeHtml(title) : null }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function resolveHandle(raw, fetchImpl) {
  const url = getHandleUrl(raw)
  if (!url) return null

  const res = await fetchImpl(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YouTubeScheduleViewer)' }
  })
  if (!res.ok) {
    throw new Error(`@handle の解決に失敗しました（HTTP ${res.status}）`)
  }
  const html = await res.text()
  const resolved = extractChannelFromHtml(html)
  if (!resolved) {
    throw new Error('@handle からチャンネルIDを取得できませんでした')
  }
  return resolved
}

export async function normalizeManualChannelInput(
  { input, title } = {},
  { fetchImpl = nodeFetch } = {}
) {
  let id
  let resolvedTitle = null
  try {
    id = parseChannelInput(input)
  } catch (err) {
    const resolved = await resolveHandle(input, fetchImpl)
    if (!resolved) throw err
    id = resolved.id
    resolvedTitle = resolved.title
  }
  const safeTitle = String(title ?? '').trim()
  return {
    id,
    title: safeTitle || resolvedTitle || id,
    uploadsPlaylistId: uploadsPlaylistIdFromChannelId(id)
  }
}
