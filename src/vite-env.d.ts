/// <reference types="vite/client" />

type ElectronInvoke =
  | 'ping'
  | 'auth:connection-status'
  | 'auth:open-connect'
  | 'auth:open-dashboard'
  | 'meetings:list'
  | 'meetings:get'
  | 'meetings:create'
  | 'meetings:update'
  | 'meetings:delete'
  | 'meetings:enhance'
  | 'audio:start'
  | 'audio:pause'
  | 'audio:resume'
  | 'audio:stop'
  | 'audio:status'
  | 'audio:chunk'
  | 'audio:session-transcript'
  | 'audio:get-preferences'
  | 'audio:set-preferences'

type ElectronEvent =
  | 'transcript:update'
  | 'transcription:activity'
  | 'auth:connected'
  | 'meetings:changed'
  | 'meetings:enhanced'
  | 'audio:prefs-changed'

interface Window {
  electronAPI: {
    send(channel: string, data: unknown): void
    on(channel: ElectronEvent, callback: (...args: unknown[]) => void): () => void
    invoke(channel: ElectronInvoke, data?: unknown): Promise<unknown>
  }
}
