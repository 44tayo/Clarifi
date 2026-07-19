import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = [
  'ping',
  'auth:connection-status',
  'auth:open-connect',
  'auth:open-dashboard',
  'meetings:list',
  'meetings:get',
  'meetings:create',
  'meetings:update',
  'meetings:delete',
  'meetings:enhance',
  'audio:start',
  'audio:pause',
  'audio:resume',
  'audio:stop',
  'audio:status',
  'audio:chunk',
  'audio:session-transcript',
  'audio:get-preferences',
  'audio:set-preferences',
] as const

const SEND_CHANNELS = [] as const

const ON_CHANNELS = [
  'transcript:update',
  'transcription:activity',
  'auth:connected',
  'meetings:changed',
  'meetings:enhanced',
  'audio:prefs-changed',
] as const

type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
type SendChannel = (typeof SEND_CHANNELS)[number]
type OnChannel = (typeof ON_CHANNELS)[number]

function assertChannel<T extends readonly string[]>(
  allowed: T,
  channel: string,
): channel is T[number] {
  return (allowed as readonly string[]).includes(channel)
}

contextBridge.exposeInMainWorld('electronAPI', {
  invoke(channel: InvokeChannel, data?: unknown) {
    if (!assertChannel(INVOKE_CHANNELS, channel)) {
      throw new Error(`Blocked invoke channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, data)
  },
  send(channel: SendChannel, data: unknown) {
    if (!assertChannel(SEND_CHANNELS, channel)) {
      throw new Error(`Blocked send channel: ${channel}`)
    }
    ipcRenderer.send(channel, data)
  },
  on(channel: OnChannel, callback: (...args: unknown[]) => void) {
    if (!assertChannel(ON_CHANNELS, channel)) {
      throw new Error(`Blocked on channel: ${channel}`)
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },
})
