/**
 * アーカイブタブのチャンネル絞り込み（archiveFilters.channelIds）に対する
 * 「このチャンネルのみ」トグルの純粋ロジック。
 *
 * 非アーカイブタブは selectedChannel の単純比較で済むため、ここには含めない。
 */

/** channelIds がそのチャンネル単独だけを選択中かどうか */
export function isArchiveChannelOnly(channelIds, channelId) {
  return channelIds.length === 1 && channelIds[0] === channelId
}

/**
 * 「このチャンネルのみ」ボタン押下後の channelIds を返す。
 * すでにそのチャンネル単独なら空（解除）、それ以外はそのチャンネル単独へ置換する。
 */
export function toggleArchiveChannelOnly(channelIds, channelId) {
  return isArchiveChannelOnly(channelIds, channelId) ? [] : [channelId]
}
