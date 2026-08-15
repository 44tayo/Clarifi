import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('detectionBannerAPI', {
  takeNotes: () => ipcRenderer.invoke('meeting:detection-take-notes'),
  dismiss: () => ipcRenderer.invoke('meeting:detection-dismiss'),
  openApp: () => ipcRenderer.invoke('meeting:detection-open-app'),
  muteApp: () => ipcRenderer.invoke('meeting:detection-mute-app'),
  openSettings: () => ipcRenderer.invoke('meeting:detection-open-settings'),
  setMenuOpen: (open: boolean) => ipcRenderer.invoke('meeting:detection-menu-open', open),
})
