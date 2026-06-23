import { useEffect, useState } from 'react'

import './meeting-prompt.css'

export function MeetingPrompt() {
  const [visible, setVisible] = useState(false)
  const [appName, setAppName] = useState('Meeting')

  useEffect(() => {
    const onShow = (...args: unknown[]) => {
      const payload = args[0] as { appName?: string }
      setAppName(payload?.appName ?? 'Meeting')
      setVisible(true)
    }
    window.electronAPI.on('meeting-prompt:show', onShow)
  }, [])

  if (!visible) return null

  return (
    <div className="meeting-prompt">
      <div className="meeting-prompt-copy">
        <span className="meeting-prompt-title">Record with Clarifi?</span>
        <span className="meeting-prompt-sub">{appName}</span>
      </div>
      <div className="meeting-prompt-actions">
        <button
          type="button"
          className="meeting-prompt-dismiss"
          onClick={() => void window.electronAPI.invoke('meeting-prompt:dismiss')}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="meeting-prompt-start"
          onClick={() => void window.electronAPI.invoke('meeting-prompt:start-recording')}
        >
          Start
        </button>
      </div>
    </div>
  )
}
