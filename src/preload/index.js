import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSchedule: () => ipcRenderer.invoke('schedule:get'),
  refreshSchedule: () => ipcRenderer.invoke('schedule:refresh'),
  addToWatchLater: (videoId) => ipcRenderer.invoke('schedule:addToWatchLater', videoId),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
})
