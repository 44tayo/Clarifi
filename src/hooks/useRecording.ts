import { useCallback, useEffect, useRef, useState } from 'react'

import { acquireMicStream } from '../lib/microphones'
import type { RecordingState, TranscriptEntry } from '../types/meeting'

function computeRms(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const normalized = (data[i]! - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / data.length)
}

function mediaRecorderOptions(): MediaRecorderOptions | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType }
  }
  return undefined
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useRecording(meetingId: string | null) {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [activity, setActivity] = useState<string>('silent')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    void window.electronAPI.invoke('audio:status').then((status) => {
      const data = status as { isRecording?: boolean; isPaused?: boolean; meetingId?: string }
      if (data.isRecording && data.meetingId === meetingId) {
        setState(data.isPaused ? 'paused' : 'recording')
      }
    })
  }, [meetingId])

  const stopMicCapture = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null
  }, [])

  const startRecorder = useCallback((stream: MediaStream) => {
    streamRef.current = stream

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioContextRef.current = audioContext
    analyserRef.current = analyser

    const recorder = new MediaRecorder(stream, mediaRecorderOptions())
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = async (event) => {
      if (!event.data.size) return
      const buffer = await event.data.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!)
      }
      const rms = analyserRef.current ? computeRms(analyserRef.current) : undefined
      await window.electronAPI.invoke('audio:chunk', {
        base64: btoa(binary),
        source: 'mic',
        rms,
      })
    }

    recorder.start(1000)
  }, [])

  const startMicCapture = useCallback(async () => {
    await window.electronAPI.invoke('permissions:request-microphone')
    const prefs = (await window.electronAPI.invoke('audio:get-preferences')) as {
      preferredMicrophoneId?: string
    }
    const deviceId = prefs.preferredMicrophoneId?.trim()
    const stream = await acquireMicStream(deviceId || undefined)
    startRecorder(stream)
  }, [startRecorder])

  const stopMicCaptureRef = useRef(stopMicCapture)
  const startMicCaptureRef = useRef(startMicCapture)
  stopMicCaptureRef.current = stopMicCapture
  startMicCaptureRef.current = startMicCapture

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
      stopMicCaptureRef.current()
      setState('idle')
    })
    const offSessionPaused = window.electronAPI.on('audio:session-paused', () => {
      stopMicCaptureRef.current()
      setState('paused')
    })
    const offSessionResumed = window.electronAPI.on('audio:session-resumed', () => {
      void startMicCaptureRef.current().then(() => setState('recording'))
    })
    return () => {
      offTranscript()
      offActivity()
      offStopped()
      offSessionPaused()
      offSessionResumed()
    }
  }, [])

  const start = useCallback(
    async (overrideMeetingId?: string) => {
      const id = overrideMeetingId ?? meetingId
      if (!id) return
      setTranscript([])

      await window.electronAPI.invoke('permissions:request-microphone')
      const prefs = (await window.electronAPI.invoke('audio:get-preferences')) as {
        preferredMicrophoneId?: string
      }
      const deviceId = prefs.preferredMicrophoneId?.trim()

      let sessionStarted = false
      let stream: MediaStream | null = null
      try {
        stream = await acquireMicStream(deviceId || undefined)
        await window.electronAPI.invoke('audio:start', { meetingId: id })
        sessionStarted = true
        startRecorder(stream)
        stream = null
        setState('recording')
      } catch (error) {
        stopStream(stream)
        stopMicCapture()
        if (sessionStarted) {
          await window.electronAPI.invoke('audio:stop', { abort: true })
        }
        throw error
      }
    },
    [meetingId, startRecorder, stopMicCapture],
  )

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
