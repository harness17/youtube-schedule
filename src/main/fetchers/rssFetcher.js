import nodeFetch from 'node-fetch'
import { XMLParser } from 'fast-xml-parser'

const UA = 'Mozilla/5.0 (compatible; YouTubeScheduleViewer)'

function buildUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

export function createRssFetcher({ timeoutMs = 3000, fetchImpl = nodeFetch } = {}) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })

  async function fetchOne(channelId) {
    const url = buildUrl(channelId)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': UA },
        signal: controller.signal
      })
    } catch (err) {
      clearTimeout(timer)
      if (err?.name === 'AbortError') {
        return { success: false, reason: 'timeout' }
      }
      return { success: false, reason: 'network', errorMessage: err?.message ?? String(err) }
    }
    clearTimeout(timer)

    if (!res.ok) {
      return {
        success: false,
        reason: res.status === 404 ? 'http_404' : `http_${res.status}`,
        httpStatus: res.status
      }
    }

    const text = await res.text()
    let parsed
    try {
      parsed = parser.parse(text)
    } catch {
      return { success: false, reason: 'parse', httpStatus: res.status }
    }

    const feed = parsed?.feed
    // empty feed is returned as empty string by fast-xml-parser
    if (feed === undefined || feed === null) {
      return { success: false, reason: 'parse', httpStatus: res.status }
    }
    // empty feed (no entries) is valid
    if (typeof feed === 'string') {
      return { success: true, videoIds: [], httpStatus: res.status }
    }
    if (typeof feed !== 'object') {
      return { success: false, reason: 'parse', httpStatus: res.status }
    }

    const rawEntries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : []
    const channelTitle =
      typeof feed.author?.name === 'string'
        ? feed.author.name
        : typeof feed.title === 'string'
          ? feed.title
          : null
    const entries = rawEntries
      .map((e) => {
        const id = e['yt:videoId'] ?? e.videoId ?? null
        if (typeof id !== 'string' || id.length === 0) return null
        const media = e['media:group'] ?? {}
        return {
          id,
          title: e.title ?? media['media:title'] ?? '',
          description: media['media:description'] ?? '',
          url:
            typeof e.link?.href === 'string'
              ? e.link.href
              : `https://www.youtube.com/watch?v=${id}`,
          published: e.published ?? null,
          updated: e.updated ?? null,
          channelTitle
        }
      })
      .filter(Boolean)
    const videoIds = entries
      .map((e) => e.id)
      .filter((id) => typeof id === 'string' && id.length > 0)

    return { success: true, videoIds, entries, channelTitle, httpStatus: res.status }
  }

  return { fetch: fetchOne }
}
