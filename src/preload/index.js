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
  getMembershipChannels: () => ipcRenderer.invoke('membership:getChannels'),
  setMembershipChannels: (channels) => ipcRenderer.invoke('membership:setChannels', channels),
  resolveChannel: (input) => ipcRenderer.invoke('membership:resolveChannel', input),
  membershipRefresh: (opts) => ipcRenderer.invoke('membership:refresh', opts),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info)),
  onUpdaterError: (cb) => ipcRenderer.on('updater:error', (_, msg) => cb(msg)),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall')
})
