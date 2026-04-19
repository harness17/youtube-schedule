export function createVideoDetailsFetcher() {
  return {
    async fetch(yt, videoIds) {
      if (videoIds.length === 0) return []
      const results = []
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50)
        const res = await yt.videos.list({
          part: ['snippet', 'liveStreamingDetails'],
          id: batch.join(',')
        })
        results.push(...(res.data.items || []))
      }
      return results
    }
  }
}
