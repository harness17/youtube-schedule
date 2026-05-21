export function startPlaylistPolling({
  authClient,
  scheduler,
  mainWindow,
  logger,
  intervalMs,
  getTimer,
  setTimer,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}) {
  const existingTimer = getTimer()
  if (existingTimer) clearIntervalFn(existingTimer)
  setTimer(null)

  if (!authClient) return false

  const kick = async () => {
    try {
      const result = await scheduler.refreshPlaylistIfDue()
      if (!result?.skipped) {
        mainWindow?.webContents.send('playlist:updated', result)
      }
    } catch (err) {
      logger?.error('playlistScheduler.kick.error', { error: err })
      mainWindow?.webContents.send('playlist:error', {
        message: err?.code ?? 'REFRESH_FAILED'
      })
    }
  }

  kick()
  setTimer(setIntervalFn(kick, intervalMs))
  return true
}
