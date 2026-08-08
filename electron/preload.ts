import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = [
  'ping',
  'auth:connection-status',
  'auth:open-connect',
  'auth:open-sign-in',
  'auth:open-dashboard',
  'auth:open-legal',
  'calendar:status',
  'calendar:events',
  'calendar:open-meeting-url',
  'calendar:contacts-search',
  'calendar:contacts-invalidate',
  'contacts:list-local',
  'contacts:upsert',
  'calendar:open-connect',
  'calendar:disconnect',
  'meetings:list',
  'meetings:get',
  'meetings:create',
  'meetings:update',
  'meetings:delete',
  'meetings:enhance',
  'meetings:sync',
  'meetings:seed-demo-artifact',
  'meetings:speaker-snippet',
  'folders:list',
  'folders:create',
  'folders:rename',
  'folders:delete',
  'meetings:set-folders',
  'tags:list-all',
  'meetings:set-tags',
  'meetings:set-template',
  'meetings:export',
  'share:publish',
  'share:access',
  'share:invite',
  'share:list-shared',
  'share:get-item',
  'share:accept-invite',
  'chat:send',
  'chat:audit-list',
  'chat:audit-purge',
  'chat:threads-purge',
  'audio:start',
  'audio:pause',
  'audio:resume',
  'audio:stop',
  'audio:status',
  'audio:chunk',
  'audio:mic-pcm-chunk',
  'audio:session-transcript',
  'audio:get-preferences',
  'audio:set-preferences',
  'audio:list-microphones',
  'dictation:transcribe',
  'onboarding:get',
  'onboarding:save',
  'onboarding:complete',
  'permissions:status',
  'permissions:request-microphone',
  'permissions:open-microphone-settings',
  'permissions:open-system-audio-settings',
  'widget:show',
  'widget:hide',
  'widget:close',
  'widget:focus-main',
  'widget:open-meeting',
  'widget:stop-recording',
  'widget:pause-recording',
  'widget:resume-recording',
  'widget:expand',
  'widget:collapse',
  'widget:set-panel',
  'widget:get-session',
  'widget:update-notes',
  'widget:rename-speaker',
  'error:report',
  'enhance:retry-pending',
  'update:get-status',
  'update:check',
  'update:download',
  'update:install',
] as const

const SEND_CHANNELS = [] as const

const ON_CHANNELS = [
  'transcript:update',
  'transcript:interim',
  'transcription:activity',
  'auth:connected',
  'meetings:changed',
  'meetings:enhanced',
  'meetings:needs-connect',
  'audio:prefs-changed',
  'widget:state',
  'widget:navigate-meeting',
  'audio:stopped',
  'audio:session-paused',
  'audio:session-resumed',
  'calendar:reminder-start',
  'meeting:detection-start',
  'chat:delta',
  'update:available',
  'update:progress',
  'update:downloaded',
  'update:error',
  'update:not-available',
  'update:status',
  'update:menu-check',
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
