function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2)
}

export function createSubscriptionsFetcher() {
  return {
    async fetch(yt) {
      const channels = []
      let pageToken = undefined
      do {
        const res = await yt.subscriptions.list({
          part: ['snippet'],
          mine: true,
          maxResults: 50,
          pageToken
        })
        for (const item of res.data.items || []) {
          const id = item.snippet?.resourceId?.channelId
          if (!id) continue
          channels.push({
            id,
            title: item.snippet.title ?? null,
            uploadsPlaylistId: uploadsPlaylistId(id)
          })
        }
        pageToken = res.data.nextPageToken
      } while (pageToken)
      return channels
    }
  }
}
