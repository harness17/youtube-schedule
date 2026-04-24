export function createPlaylistItemsFetcher({ timeoutMs = 10000 } = {}) {
  return {
    async fetch(yt, uploadsPlaylistId, maxResults = 15) {
      try {
        const res = await Promise.race([
          yt.playlistItems.list({
            part: ['contentDetails'],
            playlistId: uploadsPlaylistId,
            maxResults
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('playlistItems.list timeout')), timeoutMs)
          )
        ])
        return (res.data.items || []).map((item) => item.contentDetails.videoId)
      } catch {
        return []
      }
    }
  }
}
