import { useCallback, useEffect, useMemo, useState } from 'react'

import { listChatThreadKeys, purgeChatThreads } from '../../shared/chatRetention'
import { labelForBundleId } from '../../shared/meetingDetection'
import { enumerateMicrophones, type MicOption } from '../lib/microphones'
import { DropdownSelect } from './ui/DropdownSelect'
import { OUTPUT_LANGUAGE_OPTIONS, SPOKEN_LANGUAGE_OPTIONS } from '../lib/languages'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useAudioPreferences } from '../hooks/useAudioPreferences'
import { useCalendar } from '../hooks/useCalendar'
import { GoogleCalendarIcon, OutlookCalendarIcon } from './icons/CalendarBrandIcons'

type SettingsPanelProps = {
  onClose: () => void
  calendarEnabled?: boolean
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const MIC_STT_ENGINE_OPTIONS = [
  { value: 'deepgram', label: 'Deepgram live (recommended)' },
  { value: 'whisper', label: 'Whisper (legacy fallback)' },
]

export function SettingsPanel({ onClose, calendarEnabled = false }: SettingsPanelProps) {
  const { prefs, update } = useAudioPreferences()
  const {
    status: updateStatus,
    check: checkForUpdates,
    download: downloadUpdate,
    install: installUpdate,
  } = useAppUpdate()
  const { status: calendarStatus, refresh: refreshCalendar, openConnect, disconnect } =
    useCalendar(calendarEnabled)
  const [mics, setMics] = useState<MicOption[]>([])
  const [auditRows, setAuditRows] = useState<
    Array<{ id: string; at: number; scope: string; citationCount: number; ok: boolean }>
  >([])
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null)

  const micOptions = useMemo(
    () => [
      { value: '', label: 'System default' },
      ...mics.map((mic) => ({ value: mic.deviceId, label: mic.label })),
    ],
    [mics],
  )

  const refreshMics = useCallback(async () => {
    try {
      setMics(await enumerateMicrophones())
    } catch {
      setMics([])
    }
  }, [])

  useEffect(() => {
    void refreshMics()
    const onDeviceChange = () => void refreshMics()
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
  }, [refreshMics])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const refreshAudit = useCallback(async () => {
    try {
      const rows = (await window.electronAPI.invoke('chat:audit-list')) as Array<{
        id: string
        at: number
        scope: string
        citationCount: number
        ok: boolean
      }>
      setAuditRows(Array.isArray(rows) ? rows.slice(0, 20) : [])
    } catch {
      setAuditRows([])
    }
  }, [])

  useEffect(() => {
    void refreshAudit()
  }, [refreshAudit])

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-panel-header">
          <h2>Settings</h2>
          <button type="button" className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settings-section">
          <h3>Appearance</h3>
          <p className="settings-section-hint">
            Clarifi stays on brand blue — choose light, dark, or match your Mac.
          </p>
          <div className="settings-field">
            <span>Theme</span>
            <DropdownSelect
              value={prefs?.theme ?? 'light'}
              options={THEME_OPTIONS}
              onChange={(theme) =>
                void update({ theme: theme as 'light' | 'dark' | 'system' })
              }
              aria-label="Theme"
            />
          </div>
          <label className="settings-field settings-checkbox-row">
            <span>Meeting start reminders</span>
            <input
              type="checkbox"
              checked={prefs?.meetingRemindersEnabled ?? true}
              onChange={(event) =>
                void update({ meetingRemindersEnabled: event.target.checked })
              }
              aria-label="Meeting start reminders"
            />
          </label>
          <p className="settings-section-hint">
            When a calendar event is about to start, Clarifi asks if you want to record — it never
            starts capture without you.
          </p>
          <label className="settings-field settings-checkbox-row">
            <span>Prompt when a call starts</span>
            <input
              type="checkbox"
              checked={prefs?.meetingDetectionEnabled ?? true}
              onChange={(event) =>
                void update({ meetingDetectionEnabled: event.target.checked })
              }
              aria-label="Prompt when a call starts"
            />
          </label>
          <p className="settings-section-hint">
            When Zoom, Meet in a browser, Teams, or another call app uses your mic — and Clarifi is
            not already recording — Clarifi offers Start Clarifi. It never starts capture without
            you. Keep Clarifi running in the menu bar (closing the window is fine; Quit stops
            detection). Packaged builds can start hidden at login while this is on.
          </p>
          {(prefs?.meetingDetectionMutedBundleIds?.length ?? 0) > 0 ? (
            <div className="settings-muted-apps">
              <p className="settings-section-hint">Muted apps (no call prompts):</p>
              <ul className="settings-muted-list">
                {prefs!.meetingDetectionMutedBundleIds.map((bundleId) => (
                  <li key={bundleId} className="settings-muted-row">
                    <span>{labelForBundleId(bundleId).appName}</span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() =>
                        void update({
                          meetingDetectionMutedBundleIds:
                            prefs!.meetingDetectionMutedBundleIds.filter((id) => id !== bundleId),
                        })
                      }
                    >
                      Unmute
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="settings-section">
          <h3>Audio</h3>
          <p className="settings-section-hint">
            Choose which microphone Clarifi uses for your side of the call.
          </p>

          <label className="settings-field">
            <span>Microphone</span>
            <DropdownSelect
              value={prefs?.preferredMicrophoneId ?? ''}
              options={micOptions}
              onChange={(deviceId) => {
                const match = mics.find((mic) => mic.deviceId === deviceId)
                void update({
                  preferredMicrophoneId: deviceId,
                  preferredMicrophoneLabel: match?.label ?? '',
                })
              }}
              aria-label="Microphone"
            />
          </label>

          <button type="button" className="link-btn" onClick={() => void refreshMics()}>
            Refresh microphone list
          </button>

          <label className="settings-field settings-checkbox-row">
            <span>Show microphone picker before each meeting</span>
            <input
              type="checkbox"
              checked={!prefs?.skipMicPicker}
              onChange={(event) => void update({ skipMicPicker: !event.target.checked })}
            />
          </label>

          <label className="settings-field">
            <span>Mic transcription</span>
            <DropdownSelect
              value={prefs?.micSttEngine ?? 'deepgram'}
              options={MIC_STT_ENGINE_OPTIONS}
              onChange={(micSttEngine) =>
                void update({ micSttEngine: micSttEngine as 'whisper' | 'deepgram' })
              }
              aria-label="Mic transcription engine"
            />
          </label>
          <p className="settings-section-hint">
            Deepgram live streams your mic word-by-word for near-instant captions — use headphones
            for best accuracy. Whisper is a legacy fallback if live transcription has connectivity
            issues.
          </p>
        </div>

        <div className="settings-section">
          <h3>Language</h3>
          <p className="settings-section-hint">
            Clarifi supports transcription and notes in {SPOKEN_LANGUAGE_OPTIONS.length - 1}{' '}
            languages.
          </p>

          <label className="settings-field">
            <span>Meeting audio language</span>
            <DropdownSelect
              value={prefs?.transcriptionLanguage ?? 'auto'}
              options={SPOKEN_LANGUAGE_OPTIONS.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
              onChange={(transcriptionLanguage) => void update({ transcriptionLanguage })}
              aria-label="Meeting audio language"
            />
          </label>

          <label className="settings-field">
            <span>Notes &amp; summary language</span>
            <DropdownSelect
              value={prefs?.outputLanguage ?? 'en'}
              options={OUTPUT_LANGUAGE_OPTIONS.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
              onChange={(outputLanguage) => void update({ outputLanguage })}
              aria-label="Notes and summary language"
            />
          </label>
        </div>

        <div className="settings-section">
          <h3>Calendars</h3>
          <p className="settings-section-hint">
            Connect Google Calendar or Microsoft Outlook to see upcoming meetings (titles, times, and
            attendees), pre-fill titles, get reminders before a call, and search contacts when naming
            speakers or sharing. Clarifi requests read-only access, never starts recording without
            you, and does not edit your calendar or contacts or share notes with attendees
            automatically. Disconnect anytime. See how we handle Google data in our{' '}
            <button
              type="button"
              className="settings-inline-link"
              onClick={() => void window.electronAPI.invoke('auth:open-legal', 'privacy')}
            >
              Privacy Policy
            </button>
            .
          </p>

          {!calendarEnabled ? (
            <p className="settings-calendar-note">Sign in to your Clarifi account to connect a calendar.</p>
          ) : (
            <>
              <div className="settings-calendar-cards">
                <div
                  className={`settings-calendar-card${
                    calendarStatus.google.connected ? ' is-connected' : ''
                  }`}
                >
                  <div className="settings-calendar-card-main">
                    <GoogleCalendarIcon size={40} className="settings-calendar-logo" />
                    <div className="settings-calendar-card-copy">
                      <div className="settings-calendar-card-title">
                        <strong>Google Calendar</strong>
                        <span
                          className={
                            calendarStatus.google.connected
                              ? 'settings-calendar-on'
                              : 'settings-calendar-off'
                          }
                        >
                          {calendarStatus.google.connected ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      <span className="settings-calendar-card-sub">
                        {calendarStatus.google.connected
                          ? calendarStatus.google.accountEmail ?? 'Linked to Clarifi'
                          : 'Connect your Google account'}
                      </span>
                    </div>
                  </div>
                  <div className="settings-calendar-card-actions">
                    <button
                      type="button"
                      className={calendarStatus.google.connected ? 'btn btn-secondary' : 'btn btn-primary'}
                      onClick={() => void openConnect('google')}
                    >
                      {calendarStatus.google.connected ? 'Reconnect' : 'Connect'}
                    </button>
                    {calendarStatus.google.connected ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void disconnect('google')}
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                </div>

                <div
                  className={`settings-calendar-card${
                    calendarStatus.microsoft.connected ? ' is-connected' : ''
                  }`}
                >
                  <div className="settings-calendar-card-main">
                    <OutlookCalendarIcon size={40} className="settings-calendar-logo" />
                    <div className="settings-calendar-card-copy">
                      <div className="settings-calendar-card-title">
                        <strong>Outlook Calendar</strong>
                        <span
                          className={
                            calendarStatus.microsoft.connected
                              ? 'settings-calendar-on'
                              : 'settings-calendar-off'
                          }
                        >
                          {calendarStatus.microsoft.connected ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      <span className="settings-calendar-card-sub">
                        {calendarStatus.microsoft.connected
                          ? calendarStatus.microsoft.accountEmail ?? 'Linked to Clarifi'
                          : 'Connect your Microsoft account'}
                      </span>
                    </div>
                  </div>
                  <div className="settings-calendar-card-actions">
                    <button
                      type="button"
                      className={
                        calendarStatus.microsoft.connected ? 'btn btn-secondary' : 'btn btn-primary'
                      }
                      onClick={() => void openConnect('microsoft')}
                    >
                      {calendarStatus.microsoft.connected ? 'Reconnect' : 'Connect'}
                    </button>
                    {calendarStatus.microsoft.connected ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void disconnect('microsoft')}
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="settings-calendar-actions">
                <button type="button" className="link-btn" onClick={() => void refreshCalendar()}>
                  Refresh meetings
                </button>
              </div>
            </>
          )}
        </div>

        <div className="settings-section">
          <h3>Chat privacy</h3>
          <p className="settings-section-hint">
            Clear local Ask/Chat threads on this device, and review recent chat sends (scope only —
            no message bodies).
          </p>
          <div className="settings-calendar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const keys = listChatThreadKeys(Object.keys(window.localStorage))
                const removed = purgeChatThreads(window.localStorage, keys)
                void window.electronAPI.invoke('chat:threads-purge')
                setPrivacyMessage(`Removed ${removed} local chat thread${removed === 1 ? '' : 's'}.`)
              }}
            >
              Purge local chat threads
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                void window.electronAPI.invoke('chat:audit-purge').then(() => {
                  setAuditRows([])
                  setPrivacyMessage('Cleared local chat audit log.')
                })
              }}
            >
              Clear chat audit
            </button>
            <button type="button" className="link-btn" onClick={() => void refreshAudit()}>
              Refresh audit
            </button>
          </div>
          {privacyMessage ? <p className="settings-section-hint">{privacyMessage}</p> : null}
          {auditRows.length > 0 ? (
            <ul className="settings-section-hint">
              {auditRows.map((row) => (
                <li key={row.id}>
                  {new Date(row.at).toLocaleString()} · {row.scope} · citations {row.citationCount} ·{' '}
                  {row.ok ? 'ok' : 'error'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-section-hint">No chat audit events yet.</p>
          )}
        </div>

        <div className="settings-section">
          <h3>About &amp; updates</h3>
          <p className="settings-section-hint">
            Clarifi {updateStatus.currentVersion || '—'}
            {updateStatus.lastCheckedAt
              ? ` · Last checked ${new Date(updateStatus.lastCheckedAt).toLocaleString()}`
              : ''}
          </p>
          {!updateStatus.packaged ? (
            <p className="settings-section-hint">
              In-app updates run in the installed (packaged) app. Dev builds stay on this version.
            </p>
          ) : null}
          <div className="settings-calendar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={updateStatus.checking}
              onClick={() => void checkForUpdates()}
            >
              {updateStatus.checking ? 'Checking…' : 'Check for updates'}
            </button>
            {updateStatus.availableVersion && !updateStatus.downloaded ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  updateStatus.downloadPercent != null && updateStatus.downloadPercent < 100
                }
                onClick={() => void downloadUpdate()}
              >
                {updateStatus.downloadPercent != null && updateStatus.downloadPercent < 100
                  ? `Downloading… ${Math.round(updateStatus.downloadPercent)}%`
                  : `Update to ${updateStatus.availableVersion}`}
              </button>
            ) : null}
            {updateStatus.downloaded ? (
              <button type="button" className="btn btn-primary" onClick={() => void installUpdate()}>
                Restart to install
              </button>
            ) : null}
          </div>
          {updateStatus.error ? (
            <p className="settings-section-hint settings-update-error" role="alert">
              Couldn’t check for updates. {updateStatus.error}
            </p>
          ) : null}
          {updateStatus.packaged &&
          !updateStatus.checking &&
          !updateStatus.availableVersion &&
          !updateStatus.error &&
          updateStatus.lastCheckedAt ? (
            <p className="settings-section-hint">You’re on the latest version.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
