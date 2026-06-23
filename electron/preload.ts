import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = [
  'ping',
  'audio:start',
  'audio:pause',
  'audio:resume',
  'audio:stop',
  'audio:chunk',
  'dictation:compose',
  'dictation:get-target-app',
  'dictation:session-bootstrap',
  'dictation:capture-target',
  'dictation:session-idle',
  'dictation-pill:ready',
  'dictation-pill:subscribe',
  'dictation-pill:set-interactive',
  'dictation-pill:show',
  'screen:capture',
  'screen:context-enabled',
  'screen:context-status',
  'llm:query',
  'llm:suggest',
  'llm:session-analyze',
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
  'meeting-prompt:dismiss',
  'meeting-prompt:start-recording',
  'prefs:load',
  'prefs:save',
  'prefs:set-active-model',
  'prefs:set-show-model-in-toolbar',
  'prefs:set-active-mode',
  'prefs:set-product-knowledge',
  'prefs:set-work-knowledge',
  'prefs:set-general-knowledge',
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
  'settings:gmail-status',
  'settings:gmail-open-connect',
  'settings:gmail-disconnect',
  'gmail:search',
  'gmail:open-url',
  'hubspot:sync-session',
  'app:reset-onboarding',
  'app:logout',
  'app:quit',
  'app:erase-account-data',
  'keybinds:prefs-load',
  'keybinds:prefs-save',
  'keybinds:reset-one',
  'keybinds:reset-all',
  'memory:settings-get',
  'memory:settings-update',
  'memory:profile-get',
  'memory:profile-update',
  'memory:facts-list',
  'memory:fact-upsert',
  'memory:fact-delete',
  'memory:people-list',
  'memory:people-upsert',
  'memory:people-update',
  'memory:people-delete',
  'memory:pre-session-context',
  'memory:relationship-cards',
  'memory:action-items-list',
  'memory:action-item-complete',
  'memory:briefing-get',
  'memory:briefing-generate',
  'memory:briefing-dismiss',
  'memory:briefing-pin',
  'memory:calendar-status',
  'memory:calendar-connect',
  'memory:calendar-disconnect',
  'memory:calendar-events-today',
  'memory:feedback-record',
  'memory:learning-latest',
  'memory:export',
  'memory:clear-all',
  'memory:apply-retention',
  'proactive:status',
  'proactive:settings-get',
  'proactive:settings-update',
  'proactive:enable',
  'proactive:disable',
  'proactive:suggestions-get',
  'proactive:dismiss',
  'proactive:run-action',
  'proactive:panel-close',
  'proactive:writing-transform',
  'proactive:summarise',
  'proactive:extract-actions',
  'proactive:draft-generate',
  'proactive:draft-export-gmail',
  'proactive:clipboard-get',
  'proactive:action-item-complete',
  'proactive:summarise-transcript',
  'proactive:clear-history',
] as const

const EVENT_CHANNELS = [
  'general-assist:update',
  'live-assist:update',
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
  'permissions:changed',
  'meeting-prompt:show',
  'dictation:session-start',
  'dictation:session-finish',
  'dictation:session-cancel',
  'dictation:blocked-changed',
  'settings:tab',
  'overlay:protection-changed',
  'overlay:tour',
  'proactive:suggestions-update',
  'proactive:clipboard-suggestion',
  'proactive:panel-update',
  'proactive:stream-chunk',
  'proactive:stream-done',
  'proactive:stream-error',
  'gmail:connection-update',
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
