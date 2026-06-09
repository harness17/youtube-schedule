import { ipcMain } from 'electron'

export function registerStatsHandlers({ getStatsRepo, getDbBroken }) {
  ipcMain.handle('stats:channelActivity', () => {
    if (getDbBroken?.()) {
      return {
        unwatchedPinned: [],
        silentChannels: [],
        frequencyRanking: [],
        viewedRates: [],
        dbBroken: true
      }
    }
    const repo = getStatsRepo()
    if (!repo) return { error: 'NOT_INITIALIZED' }
    return repo.getChannelActivity()
  })
}
