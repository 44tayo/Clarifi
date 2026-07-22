import { useCallback, useEffect, useMemo, useState } from 'react'

import { enumerateMicrophones, type MicOption } from '../lib/microphones'
import { DropdownSelect } from './ui/DropdownSelect'
import {
  DICTATION_OUTPUT_LANGUAGE_OPTIONS,
  OUTPUT_LANGUAGE_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
} from '../lib/languages'
import { useAudioPreferences } from '../hooks/useAudioPreferences'
import { useCalendar } from '../hooks/useCalendar'

type SettingsPanelProps = {
  onClose: () => void
  calendarEnabled?: boolean
}

const TRANSCRIPTION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto — multi-speaker (recommended)' },
  { value: 'dual', label: '1:1 — Me / Them' },
  { value: 'group', label: 'Group — system audio only' },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function SettingsPanel({ onClose, calendarEnabled = false }: SettingsPanelProps) {
  const { prefs, update } = useAudioPreferences()
  const { status: calendarStatus, refresh: refreshCalendar, openConnect } = useCalendar(calendarEnabled)
  const [mics, setMics] = useState<MicOption[]>([])

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

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-panel">
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

          <label className="settings-field">
            <span>Transcription mode</span>
            <DropdownSelect
              value={prefs?.transcriptionMode ?? 'auto'}
              options={TRANSCRIPTION_MODE_OPTIONS}
              onChange={(transcriptionMode) =>
                void update({
                  transcriptionMode: transcriptionMode as 'auto' | 'dual' | 'group',
                })
              }
              aria-label="Transcription mode"
            />
          </label>

          <label className="settings-field settings-checkbox-row">
            <span>Show microphone picker before each meeting</span>
            <input
              type="checkbox"
              checked={!prefs?.skipMicPicker}
              onChange={(event) => void update({ skipMicPicker: !event.target.checked })}
            />
          </label>
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

          <label className="settings-field">
            <span>Voice dictation language</span>
            <DropdownSelect
              value={prefs?.dictationLanguage ?? 'auto'}
              options={SPOKEN_LANGUAGE_OPTIONS.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
              onChange={(dictationLanguage) => void update({ dictationLanguage })}
              aria-label="Voice dictation language"
            />
          </label>

          <label className="settings-field">
            <span>Dictation output language</span>
            <DropdownSelect
              value={prefs?.dictationOutputLanguage ?? 'same'}
              options={DICTATION_OUTPUT_LANGUAGE_OPTIONS.map((option) => ({
                value: option.code,
                label: option.label,
              }))}
              onChange={(dictationOutputLanguage) => void update({ dictationOutputLanguage })}
              aria-label="Dictation output language"
            />
          </label>
        </div>

        <div className="settings-section">
          <h3>Calendar</h3>
          <p className="settings-section-hint">
            Connect Google Calendar or Microsoft Outlook to see upcoming meetings and pre-fill
            titles from your schedule.
          </p>

          {!calendarEnabled ? (
            <p className="settings-calendar-note">Sign in to your Clarifi account to connect a calendar.</p>
          ) : (
            <>
              <div className="settings-calendar-status">
                <div className="settings-calendar-provider">
                  <span>Google Calendar</span>
                  <span className={calendarStatus.google.connected ? 'settings-calendar-on' : 'settings-calendar-off'}>
                    {calendarStatus.google.connected
                      ? calendarStatus.google.accountEmail ?? 'Connected'
                      : 'Not connected'}
                  </span>
                </div>
                <div className="settings-calendar-provider">
                  <span>Microsoft Outlook</span>
                  <span
                    className={
                      calendarStatus.microsoft.connected ? 'settings-calendar-on' : 'settings-calendar-off'
                    }
                  >
                    {calendarStatus.microsoft.connected
                      ? calendarStatus.microsoft.accountEmail ?? 'Connected'
                      : 'Not connected'}
                  </span>
                </div>
              </div>

              <div className="settings-calendar-actions">
                <button type="button" className="link-btn" onClick={() => void openConnect('google')}>
                  {calendarStatus.google.connected ? 'Reconnect Google' : 'Connect Google'}
                </button>
                <button type="button" className="link-btn" onClick={() => void openConnect('microsoft')}>
                  {calendarStatus.microsoft.connected ? 'Reconnect Outlook' : 'Connect Outlook'}
                </button>
                <button type="button" className="link-btn" onClick={() => void refreshCalendar()}>
                  Refresh meetings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
