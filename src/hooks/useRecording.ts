import { useCallback, useEffect, useRef, useState } from 'react'

import type { RecordingState, TranscriptEntry } from '../types/meeting'

export function useRecording(meetingId: string | null) {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [activity, setActivity] = useState<string>('silent')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    void window.electronAPI.invoke('audio:status').then((status) => {
      const data = status as { isRecording?: boolean; isPaused?: boolean; meetingId?: string }
      if (data.isRecording && data.meetingId === meetingId) {
        setState(data.isPaused ? 'paused' : 'recording')
      }
    })
  }, [meetingId])

  useEffect(() => {
    const offTranscript = window.electronAPI.on('transcript:update', (payload) => {
      const data = payload as { full?: TranscriptEntry[] }
      if (Array.isArray(data.full)) setTranscript(data.full)
    })
    const offActivity = window.electronAPI.on('transcription:activity', (payload) => {
      const data = payload as { state?: string }
      if (data.state) setActivity(data.state)
    })
    const offStopped = window.electronAPI.on('audio:stopped', () => {
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setState('idle')
    })
    return () => {
      offTranscript()
      offActivity()
      offStopped()
    }
  }, [])

  const stopMicCapture = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startMicCapture = useCallback(async () => {
    const prefs = (await window.electronAPI.invoke('audio:get-preferences')) as {
      preferredMicrophoneId?: string
    }
    const deviceId = prefs.preferredMicrophoneId?.trim()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    })
    streamRef.current = stream
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = async (event) => {
      if (!event.data.size) return
      const buffer = await event.data.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!)
      }
      await window.electronAPI.invoke('audio:chunk', {
        base64: btoa(binary),
        source: 'mic',
      })
    }

    recorder.start(1000)
  }, [])

  const start = useCallback(async () => {
    if (!meetingId) return
    setTranscript([])
    await window.electronAPI.invoke('audio:start', { meetingId })
    await startMicCapture()
    setState('recording')
  }, [meetingId, startMicCapture])

  const pause = useCallback(async () => {
    stopMicCapture()
    await window.electronAPI.invoke('audio:pause')
    setState('paused')
  }, [stopMicCapture])

  const resume = useCallback(async () => {
    await window.electronAPI.invoke('audio:resume')
    await startMicCapture()
    setState('recording')
  }, [startMicCapture])

  const stop = useCallback(async () => {
    stopMicCapture()
    await window.electronAPI.invoke('audio:stop')
    setState('idle')
  }, [stopMicCapture])

  return { state, transcript, activity, start, pause, resume, stop }
}
