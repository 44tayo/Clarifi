import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = [
  'ping',
  'audio:start',
  'audio:pause',
  'audio:resume',
  'audio:stop',
  'audio:chunk',
  'screen:capture',
  'screen:context-enabled',
  'screen:context-status',
  'llm:query',
  'llm:suggest',
  'llm:session-analyze',
  'llm:sales-live-assist',
  'llm:session-recap',
  'llm:infer-speaker-labels',
  'llm:chat',
  'audio:session-transcript',
  'audio-sessions:load',
  'audio-sessions:save',
  'audio-sessions:delete',
  'audio-sessions:rename',
  'audio-sessions:update-chat',
  'audio-sessions:update-speaker-labels',
  'audio-sessions:open',
  'audio-sessions:chat',
  'auth:validate',
  'auth:open-connect',
  'auth:open-sign-in',
  'auth:connection-status',
  'overlay:set-interactive',
  'overlay:set-height',
  'overlay:set-bounds',
  'overlay:get-bounds',
  'overlay:toggle-follow',
  'overlay:follow-status',
  'overlay:toggle-protection',
  'overlay:protection-status',
  'overlay:ready',
  'overlay:update-suggestions',
  'audio:status',
  'audio:prefs-load',
  'audio:prefs-save',
  'chat:history-load',
  'chat:history-save-session',
  'chat:history-delete-session',
  'chat:history-rename-session',
  'chat:history-archive-session',
  'chat:history-open-session',
  'chat:history-clear',
  'onboarding:status',
  'onboarding:complete',
  'onboarding:get-sign-in-url',
  'onboarding:auth-pane-show',
  'onboarding:auth-pane-hide',
  'onboarding:auth-pane-sync',
  'onboarding:get-billing-url',
  'onboarding:open-billing',
  'onboarding:start-tutorial',
  'onboarding:stop-tutorial',
  'onboarding:begin-live-tour',
  'onboarding:end-live-tour',
  'onboarding:tutorial-signal',
  'permissions:status',
  'permissions:request',
  'permissions:open-settings',
  'prefs:load',
  'prefs:save',
  'prefs:set-active-model',
  'prefs:set-show-model-in-toolbar',
  'prefs:set-active-mode',
  'prefs:set-product-knowledge',
  'prefs:add-mode',
  'prefs:remove-mode',
  'prefs:add-model',
  'prefs:remove-model',
  'settings:open',
  'settings:profile',
  'settings:profile-update',
  'settings:profile-avatar-upload',
  'settings:profile-avatar-remove',
  'settings:open-dashboard',
  'settings:hubspot-status',
  'settings:hubspot-open-connect',
  'settings:hubspot-update',
  'settings:hubspot-disconnect',
  'hubspot:sync-session',
  'app:reset-onboarding',
  'app:logout',
  'app:quit',
  'app:erase-account-data',
  'keybinds:prefs-load',
  'keybinds:prefs-save',
  'keybinds:reset-one',
  'keybinds:reset-all',
] as const

const EVENT_CHANNELS = [
  'sales-assist:update',
  'sales-define:update',
  'suggestions:update',
  'transcript:update',
  'transcription:activity',
  'onboarding:tutorial-event',
  'onboarding:auth-connected',
  'onboarding:mock-nudge',
  'prefs:changed',
  'audio:prefs-changed',
  'chat:history-changed',
  'audio-sessions:changed',
  'audio-sessions:open',
  'chat:session-open',
  'keybind:action',
  'keybinds:prefs-changed',
  'settings:tab',
  'overlay:protection-changed',
  'overlay:tour',
] as const

type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
type EventChannel = (typeof EVENT_CHANNELS)[number]
type AllowedChannel = InvokeChannel | EventChannel

const ALL_CHANNELS: readonly string[] = [...INVOKE_CHANNELS, ...EVENT_CHANNELS]

function assertAllowedChannel(channel: string): asserts channel is AllowedChannel {
  if (!ALL_CHANNELS.includes(channel)) {
    throw new Error(`Channel "${channel}" is not allowed`)
  }
}

const electronAPI = {
  send(channel: string, data: unknown): void {
    assertAllowedChannel(channel)
    ipcRenderer.send(channel, data)
  },

  on(channel: string, callback: (...args: unknown[]) => void): void {
    assertAllowedChannel(channel)
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },

  invoke(channel: string, data?: unknown): Promise<unknown> {
    assertAllowedChannel(channel)
    return ipcRenderer.invoke(channel, data)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: {
      send(channel: string, data: unknown): void
      on(channel: string, callback: (...args: unknown[]) => void): void
      invoke(channel: string, data?: unknown): Promise<unknown>
    }
  }
}

export {}
