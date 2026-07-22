import { useEffect, useRef, useState } from 'react'

import {
  enumerateMicrophones,
  resolvePreferredMicId,
  type MicOption,
} from '../lib/microphones'
import { DropdownSelect } from './ui/DropdownSelect'

type MicPickerModalProps = {
  open: boolean
  error?: string | null
  permissionDenied?: boolean
  onClose: () => void
  onStart: (deviceId: string, label: string, skipNextTime: boolean) => Promise<void>
}

export function MicPickerModal({
  open,
  error,
  permissionDenied = false,
  onClose,
  onStart,
}: MicPickerModalProps) {
  const [mics, setMics] = useState<MicOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [skipNextTime, setSkipNextTime] = useState(false)
  const [starting, setStarting] = useState(false)
  const userSelectedRef = useRef(false)
  const preferredIdRef = useRef('')
  const startingRef = useRef(false)

  useEffect(() => {
    startingRef.current = starting
  }, [starting])

  useEffect(() => {
    if (!open) {
      userSelectedRef.current = false
      setStarting(false)
      return
    }

    setSkipNextTime(false)
    let cancelled = false

    void (async () => {
      const [inputs, prefs] = await Promise.all([
        enumerateMicrophones(),
        window.electronAPI.invoke('audio:get-preferences') as Promise<{
          preferredMicrophoneId?: string
        }>,
      ])
      if (cancelled) return

      const preferredId = prefs?.preferredMicrophoneId ?? ''
      preferredIdRef.current = preferredId
      setMics(inputs)
      setSelectedId(resolvePreferredMicId(inputs, preferredId))
    })()

    const onDeviceChange = () => {
      if (startingRef.current) return
      void enumerateMicrophones().then((inputs) => {
        if (cancelled) return
        setMics(inputs)
        setSelectedId((current) => {
          if (userSelectedRef.current && inputs.some((mic) => mic.deviceId === current)) {
            return current
          }
          return resolvePreferredMicId(inputs, preferredIdRef.current)
        })
      })
    }

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
    }
  }, [open])

  if (!open) return null

  const selected = mics.find((mic) => mic.deviceId === selectedId)

  const handleStart = async () => {
    setStarting(true)
    startingRef.current = true
    try {
      await onStart(selectedId, selected?.label ?? 'System default', skipNextTime)
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  return (
    <div className="mic-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="mic-picker-title">
      <div className="mic-picker-card">
        <h2 id="mic-picker-title">Select microphone</h2>
        <p>You can change this later in Settings during a meeting.</p>
        {error ? <p className="mic-picker-error">{error}</p> : null}
        {permissionDenied ? (
          <button
            type="button"
            className="link-btn mic-picker-settings-link"
            onClick={() => void window.electronAPI.invoke('permissions:open-microphone-settings')}
          >
            Open Microphone Settings
          </button>
        ) : null}
        <div className="mic-picker-field">
          <DropdownSelect
            value={selectedId}
            options={
              mics.length === 0
                ? [{ value: '', label: 'System default' }]
                : mics.map((mic) => ({ value: mic.deviceId, label: mic.label }))
            }
            onChange={(deviceId) => {
              userSelectedRef.current = true
              setSelectedId(deviceId)
            }}
            placeholder="System default"
            aria-label="Microphone"
            disabled={starting}
          />
        </div>
        <div className="mic-picker-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={starting}
            onClick={() => void handleStart()}
          >
            {starting ? 'Starting…' : 'Start meeting'}
          </button>
          <label className="mic-picker-skip-row">
            <input
              type="checkbox"
              checked={skipNextTime}
              disabled={starting}
              onChange={(event) => setSkipNextTime(event.target.checked)}
            />
            Don&apos;t show again
          </label>
          <button type="button" className="link-btn" disabled={starting} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
