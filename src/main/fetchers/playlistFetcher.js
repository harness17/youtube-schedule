import { google } from 'googleapis'

export class PlaylistFetchError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'PlaylistFetchError'
    this.code = code
    this.cause = cause
  }
}

function classifyError(err, fallbackMessage) {
  const status = err?.code ?? err?.status ?? err?.response?.status
  const reason = String(err?.errors?.[0]?.reason ?? err?.cause?.errors?.[0]?.reason ?? '')
  const message = String(err?.message ?? '')
  if (Number(status) === 403 && /quota/i.test(`${reason} ${message}`)) {
    return new PlaylistFetchError('QUOTA_EXCEEDED', 'YouTube API quota exceeded', err)
  }
  if (Number(status) === 404) {
    return new PlaylistFetchError('PLAYLIST_NOT_FOUND', 'Playlist not found', err)
  }
  return new PlaylistFetchError('FETCH_FAILED', fallbackMessage, err)
}

function createTimeout(timeoutMs, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs))
}

function mapPlaylist(item) {
  return {
    id: item.id,
    title: item.snippet?.title ?? '',
    itemCount: item.contentDetails?.itemCount ?? 0
  }
}

function mapPlaylistItem(item) {
  const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
  if (!videoId) return null
  return {
    videoId,
    snippet: item.snippet ?? {},
    contentDetails: item.contentDetails ?? {}
  }
}

export function createPlaylistFetcher({
  timeoutMs = 15000,
  ytFactory = (auth) => google.youtube({ version: 'v3', auth: auth ?? undefined }),
  logger = null
} = {}) {
  function yt(oauth2Client) {
    if (!oauth2Client) throw new PlaylistFetchError('NOT_AUTHENTICATED', 'Not authenticated')
    return ytFactory(oauth2Client)
  }

  return {
    async listMyPlaylists(oauth2Client) {
      try {
        const res = await Promise.race([
          yt(oauth2Client).playlists.list({
            part: ['snippet', 'contentDetails'],
            mine: true,
            maxResults: 50
          }),
          createTimeout(timeoutMs, 'playlists.list timeout')
        ])
        if (res.data.nextPageToken) {
          logger?.warn?.('playlistFetcher.listMyPlaylists.truncated', { maxResults: 50 })
        }
        return (res.data.items ?? []).map(mapPlaylist)
      } catch (err) {
        if (err instanceof PlaylistFetchError) throw err
        throw classifyError(err, 'Failed to fetch playlists')
      }
    },

    async fetchPlaylistItems(oauth2Client, playlistId) {
      if (!playlistId) {
        throw new PlaylistFetchError('PLAYLIST_NOT_CONFIGURED', 'Playlist is not configured')
      }
      const client = yt(oauth2Client)
      const results = []
      let pageToken
      try {
        do {
          const res = await Promise.race([
            client.playlistItems.list({
              part: ['snippet', 'contentDetails'],
              playlistId,
              maxResults: 50,
              pageToken
            }),
            createTimeout(timeoutMs, 'playlistItems.list timeout')
          ])
          results.push(...(res.data.items ?? []).map(mapPlaylistItem).filter(Boolean))
          pageToken = res.data.nextPageToken ?? null
        } while (pageToken)
        return results
      } catch (err) {
        if (err instanceof PlaylistFetchError) throw err
        throw classifyError(err, 'Failed to fetch playlist items')
      }
    }
  }
}
