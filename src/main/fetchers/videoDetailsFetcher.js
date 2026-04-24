export function createVideoDetailsFetcher({ timeoutMs = 15000 } = {}) {
  return {
    async fetch(yt, videoIds) {
      if (videoIds.length === 0) return []
      const results = []
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50)
        const res = await Promise.race([
          yt.videos.list({
            part: ['snippet', 'liveStreamingDetails'],
            id: batch.join(',')
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('videos.list timeout')), timeoutMs)
          )
        ])
        results.push(...(res.data.items || []))
      }
      return results
    }
  }
}
