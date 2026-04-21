import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSchedule: () => ipcRenderer.invoke('schedule:get'),
  refreshSchedule: () => ipcRenderer.invoke('schedule:refresh'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),
  getVersion: () => ipcRenderer.invoke('app:version'),
  openFolder: (filePath) => ipcRenderer.invoke('shell:openFolder', filePath),
  getSetting: (key, defaultValue) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info)),
  onUpdaterError: (cb) => ipcRenderer.on('updater:error', (_, msg) => cb(msg)),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  getRssFailureRate: () => ipcRenderer.invoke('diag:rssFailureRate'),
  resetDatabase: () => ipcRenderer.invoke('schedule:resetDatabase'),
  onScheduleUpdated: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('schedule:updated', listener)
    return () => ipcRenderer.off('schedule:updated', listener)
  },
  listMissed: () => ipcRenderer.invoke('videos:listMissed'),
  listArchive: (opts) => ipcRenderer.invoke('videos:listArchive', opts),
  listFavorites: () => ipcRenderer.invoke('videos:listFavorites'),
  searchByText: (query, opts) => ipcRenderer.invoke('videos:searchByText', query, opts),
  markViewed: (id) => ipcRenderer.invoke('videos:markViewed', id),
  clearViewed: (id) => ipcRenderer.invoke('videos:clearViewed', id),
  toggleFavorite: (id) => ipcRenderer.invoke('videos:toggleFavorite', id),
  toggleNotify: (id) => ipcRenderer.invoke('videos:toggleNotify', id),
  togglePin: (id) => ipcRenderer.invoke('channels:togglePin', id),
  listAllChannels: () => ipcRenderer.invoke('channels:listAll')
})
