import { useCallback, useEffect, useState } from 'react'

type ProactiveSettings = {
  enabled: boolean
  analysisIntervalMs: number
  suggestionAutoDismissMs: number
  maxVisibleSuggestions: number
  captureMode: 'full_screen' | 'active_window'
  appWhitelist: string[]
  appBlacklist: string[]
  clipboardPollMs: number
  features: {
    screenWatch: boolean
    writingAssistant: boolean
    autoSummarise: boolean
    actionItems: boolean
    draftGenerator: boolean
  }
}

const INTERVAL_OPTIONS = [
  { value: 8000, label: 'Every 8 seconds' },
  { value: 10000, label: 'Every 10 seconds' },
  { value: 12000, label: 'Every 12 seconds' },
  { value: 15000, label: 'Every 15 seconds' },
  { value: 30000, label: 'Every 30 seconds' },
]

export function ProactiveSettingsPanel() {
  const [settings, setSettings] = useState<ProactiveSettings | null>(null)
  const [whitelistDraft, setWhitelistDraft] = useState('')
  const [blacklistDraft, setBlacklistDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = (await window.electronAPI.invoke('proactive:settings-get')) as {
      settings: ProactiveSettings
    }
    setSettings(result.settings)
    setWhitelistDraft(result.settings.appWhitelist.join(', '))
    setBlacklistDraft(result.settings.appBlacklist.join(', '))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (patch: Partial<ProactiveSettings>) => {
    const result = (await window.electronAPI.invoke('proactive:settings-update', {
      settings: patch,
    })) as { settings: ProactiveSettings }
    setSettings(result.settings)
    setMessage('Settings saved')
  }

  const toggleEnabled = async () => {
    if (!settings) return
    if (settings.enabled) {
      await window.electronAPI.invoke('proactive:disable')
    } else {
      await window.electronAPI.invoke('proactive:enable')
    }
    await load()
    setMessage(settings.enabled ? 'Proactive assist disabled' : 'Proactive assist enabled')
  }

  if (!settings) return null

  return (
    <div className="proactive-settings">
      <div className="settings-section">
        <h2 className="settings-section-title">Proactive assist</h2>
        <p className="settings-section-desc">
          Clarifi watches your screen and offers contextual actions before you ask. All analysis
          runs locally except Claude API calls. Off by default.
        </p>
        {message ? <p className="settings-inline-message">{message}</p> : null}
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Master toggle</div>
        <button
          type="button"
          className={`settings-btn ${settings.enabled ? 'danger' : 'primary'}`}
          onClick={() => void toggleEnabled()}
        >
          {settings.enabled ? 'Disable proactive assist' : 'Enable proactive assist'}
        </button>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Features</div>
        <div className="settings-toggle-list">
          {(
            [
              ['screenWatch', 'Screen awareness'],
              ['writingAssistant', 'Writing assistant'],
              ['autoSummarise', 'Auto-summarisation'],
              ['actionItems', 'Action item extraction'],
              ['draftGenerator', 'Draft generator'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="settings-toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={settings.features[key]}
                onChange={(e) =>
                  void save({
                    features: { ...settings.features, [key]: e.target.checked },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Timing</div>
        <label className="settings-field">
          Screen analysis frequency
          <select
            value={settings.analysisIntervalMs}
            onChange={(e) => void save({ analysisIntervalMs: Number(e.target.value) })}
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          Auto-dismiss suggestions (seconds)
          <select
            value={settings.suggestionAutoDismissMs}
            onChange={(e) =>
              void save({ suggestionAutoDismissMs: Number(e.target.value) })
            }
          >
            <option value={30000}>30</option>
            <option value={60000}>60</option>
            <option value={120000}>120</option>
          </select>
        </label>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">App privacy</div>
        <label className="settings-field">
          Watch only these apps (comma-separated, empty = all)
          <input
            value={whitelistDraft}
            onChange={(e) => setWhitelistDraft(e.target.value)}
            placeholder="Gmail, Slack, Chrome, Outlook"
          />
        </label>
        <label className="settings-field">
          Never watch these apps
          <input
            value={blacklistDraft}
            onChange={(e) => setBlacklistDraft(e.target.value)}
            placeholder="1Password, Keychain Access"
          />
        </label>
        <button
          type="button"
          className="settings-btn"
          onClick={() =>
            void save({
              appWhitelist: whitelistDraft
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              appBlacklist: blacklistDraft
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          Save app lists
        </button>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Capture</div>
        <label className="settings-field">
          Capture mode
          <select
            value={settings.captureMode}
            onChange={(e) =>
              void save({
                captureMode: e.target.value as ProactiveSettings['captureMode'],
              })
            }
          >
            <option value="full_screen">Full screen (display under cursor)</option>
            <option value="active_window">Active window (coming soon)</option>
          </select>
        </label>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">History</div>
        <p className="settings-section-desc">
          Clears proactive screen-watch sessions and saved draft logs from local memory.
        </p>
        <button
          type="button"
          className="settings-btn danger"
          onClick={() =>
            void window.electronAPI
              .invoke('proactive:clear-history')
              .then(() => setMessage('Proactive history cleared'))
          }
        >
          Clear drafted content history
        </button>
      </div>
    </div>
  )
}
