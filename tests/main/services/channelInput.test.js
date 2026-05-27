import { describe, it, expect, vi } from 'vitest'
import {
  normalizeManualChannelInput,
  parseChannelInput
} from '../../../src/main/services/channelInput'

const CHANNEL_ID = 'UC1234567890123456789012'

describe('channelInput', () => {
  it('accepts a raw channel ID', () => {
    expect(parseChannelInput(CHANNEL_ID)).toBe(CHANNEL_ID)
  })

  it('extracts a channel ID from /channel URL', () => {
    expect(parseChannelInput(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toBe(CHANNEL_ID)
  })

  it('resolves a raw handle from YouTube HTML', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<meta property="og:title" content="Handle Channel"><script>{"channelId":"UCabcdefghijklmnopqrstuv"}</script>'
    })
    await expect(
      normalizeManualChannelInput({ input: '@nnsenchi' }, { fetchImpl })
    ).resolves.toEqual({
      id: 'UCabcdefghijklmnopqrstuv',
      title: 'Handle Channel',
      uploadsPlaylistId: 'UUabcdefghijklmnopqrstuv'
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://www.youtube.com/@nnsenchi', expect.any(Object))
  })

  it('normalizes title and uploads playlist ID for manual channels', async () => {
    await expect(
      normalizeManualChannelInput({ input: CHANNEL_ID, title: ' My Channel ' })
    ).resolves.toEqual({
      id: CHANNEL_ID,
      title: 'My Channel',
      uploadsPlaylistId: 'UU1234567890123456789012'
    })
  })

  // regression: hostname.endsWith('youtube.com') 緩判定で
  // evil-youtube.com が allowlist を通過していた問題への固定テスト
  it('rejects look-alike hostnames like evil-youtube.com', async () => {
    const fetchImpl = vi.fn()
    await expect(
      normalizeManualChannelInput({ input: 'https://www.evil-youtube.com/@handle' }, { fetchImpl })
    ).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  // regression: http:// 形式のハンドル URL は強制的に拒否する
  it('rejects non-https YouTube handle URLs', async () => {
    const fetchImpl = vi.fn()
    await expect(
      normalizeManualChannelInput({ input: 'http://www.youtube.com/@handle' }, { fetchImpl })
    ).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
