import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('detectionBannerAPI', {
  takeNotes: () => ipcRenderer.invoke('meeting:detection-take-notes'),
  dismiss: () => ipcRenderer.invoke('meeting:detection-dismiss'),
})
