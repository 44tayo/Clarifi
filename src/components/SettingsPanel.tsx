import {
  DICTATION_OUTPUT_LANGUAGE_OPTIONS,
  OUTPUT_LANGUAGE_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
} from '../lib/languages'
import { useAudioPreferences } from '../hooks/useAudioPreferences'

type SettingsPanelProps = {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { prefs, update } = useAudioPreferences()

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
          <h3>Language</h3>
          <p className="settings-section-hint">
            Clarifi supports transcription and notes in {SPOKEN_LANGUAGE_OPTIONS.length - 1}{' '}
            languages.
          </p>

          <label className="settings-field">
            <span>Meeting audio language</span>
            <select
              value={prefs?.transcriptionLanguage ?? 'auto'}
              onChange={(event) => void update({ transcriptionLanguage: event.target.value })}
            >
              {SPOKEN_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Notes &amp; summary language</span>
            <select
              value={prefs?.outputLanguage ?? 'en'}
              onChange={(event) => void update({ outputLanguage: event.target.value })}
            >
              {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Voice dictation language</span>
            <select
              value={prefs?.dictationLanguage ?? 'auto'}
              onChange={(event) => void update({ dictationLanguage: event.target.value })}
            >
              {SPOKEN_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Dictation output language</span>
            <select
              value={prefs?.dictationOutputLanguage ?? 'same'}
              onChange={(event) => void update({ dictationOutputLanguage: event.target.value })}
            >
              {DICTATION_OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
