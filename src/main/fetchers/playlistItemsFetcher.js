export function createPlaylistItemsFetcher() {
  return {
    async fetch(yt, uploadsPlaylistId, maxResults = 15) {
      try {
        const res = await yt.playlistItems.list({
          part: ['contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults
        })
        return (res.data.items || []).map((item) => item.contentDetails.videoId)
      } catch {
        return []
      }
    }
  }
}
