// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import nock from 'nock'
import { createRssFetcher } from '../../../src/main/fetchers/rssFetcher'

const RSS_HOST = 'https://www.youtube.com'
const RSS_PATH = '/feeds/videos.xml'

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <author><name>Channel A</name></author>
  <entry><yt:videoId>VID1</yt:videoId><title>t1</title><link href="https://www.youtube.com/watch?v=VID1" /><media:group><media:description>d1</media:description></media:group></entry>
  <entry><yt:videoId>VID2</yt:videoId><title>t2</title></entry>
</feed>`

describe('RssFetcher', () => {
  beforeEach(() => nock.cleanAll())
  afterEach(() => nock.cleanAll())

  it('returns videoIds on 200', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC1' }).reply(200, sampleXml)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC1')
    expect(res.success).toBe(true)
    expect(res.videoIds).toEqual(['VID1', 'VID2'])
    expect(res.channelTitle).toBe('Channel A')
    expect(res.entries[0]).toEqual(
      expect.objectContaining({
        id: 'VID1',
        title: 't1',
        description: 'd1',
        channelTitle: 'Channel A'
      })
    )
    expect(res.httpStatus).toBe(200)
  })

  it('returns success:false with reason http_404 on 404', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC2' }).reply(404)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC2')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('http_404')
    expect(res.httpStatus).toBe(404)
  })

  it('returns success:false with reason timeout when server is slow', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC3' }).delay(200).reply(200, sampleXml)
    const fetcher = createRssFetcher({ timeoutMs: 50 })
    const res = await fetcher.fetch('UC3')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('timeout')
  })

  it('returns success:false with reason parse on malformed XML', async () => {
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC4' }).reply(200, '<not-xml>')
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC4')
    expect(res.success).toBe(false)
    expect(res.reason).toBe('parse')
  })

  it('returns success:true with empty list on empty feed', async () => {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`
    nock(RSS_HOST).get(RSS_PATH).query({ channel_id: 'UC5' }).reply(200, emptyXml)
    const fetcher = createRssFetcher({ timeoutMs: 3000 })
    const res = await fetcher.fetch('UC5')
    expect(res.success).toBe(true)
    expect(res.videoIds).toEqual([])
  })
})
