import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSchedule: () => ipcRenderer.invoke('schedule:get'),
  refreshSchedule: () => ipcRenderer.invoke('schedule:refresh'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info)),
  onUpdaterError: (cb) => ipcRenderer.on('updater:error', (_, msg) => cb(msg))
})
