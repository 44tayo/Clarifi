import { useCallback, useEffect, useRef, useState } from 'react'

import { acquireMicStream, formatMicCaptureError } from '../lib/microphones'

const MAX_DICTATION_MS = 90_000

export type DictationState = 'idle' | 'recording' | 'transcribing'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.split(',')[1] : result
      if (!base64) reject(new Error('empty_audio'))
      else resolve(base64)
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(blob)
  })
}

function pickRecorderMime(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return undefined
}

/**
 * One-shot Whisper dictation: record → stop → paste transcript into a text field.
 * Uses Clarifi's dictation:transcribe IPC (Groq whisper-large-v3-turbo).
 */
export function useWhisperDictation(options: {
  disabled?: boolean
  onTranscript: (text: string) => void
  onError?: (message: string) => void
}) {
  const { disabled = false, onTranscript, onError } = options
  const [state, setState] = useState<DictationState>('idle')
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  onTranscriptRef.current = onTranscript
  onErrorRef.current = onError

  const cleanupStream = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => () => cleanupStream(), [cleanupStream])

  const finishAndTranscribe = useCallback(async (blob: Blob) => {
    setState('transcribing')
    try {
      if (blob.size < 256) {
        onErrorRef.current?.('No speech captured — try again.')
        setState('idle')
        return
      }
      const audioBase64 = await blobToBase64(blob)
      const result = (await window.electronAPI.invoke('dictation:transcribe', {
        audioBase64,
        format: 'webm',
      })) as { text?: string; error?: string }

      if (result.error) {
        const message =
          result.error === 'not_authenticated' || result.error === 'auth_expired'
            ? 'Connect your account to use dictation.'
            : result.error === 'dictation_disabled'
              ? 'Dictation is turned off in Settings.'
              : result.error === 'network_error'
                ? 'You appear offline. Try again when you reconnect.'
                : 'Could not transcribe audio. Please try again.'
        onErrorRef.current?.(message)
        setState('idle')
        return
      }
      const text = result.text?.trim()
      if (!text) {
        onErrorRef.current?.('No speech detected — try again.')
        setState('idle')
        return
      }
      onTranscriptRef.current(text)
    } catch (error) {
      onErrorRef.current?.(formatMicCaptureError(error))
    } finally {
      setState('idle')
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream()
      setState('idle')
      return
    }
    recorder.stop()
  }, [cleanupStream])

  const startRecording = useCallback(async () => {
    if (disabled || state !== 'idle') return
    try {
      await window.electronAPI.invoke('permissions:request-microphone')
      const stream = await acquireMicStream()
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickRecorderMime()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        cleanupStream()
        setState('idle')
        onErrorRef.current?.('Recording failed. Please try again.')
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        cleanupStream()
        void finishAndTranscribe(blob)
      }

      recorder.start(250)
      setState('recording')
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop()
        }
      }, MAX_DICTATION_MS)
    } catch (error) {
      cleanupStream()
      setState('idle')
      onErrorRef.current?.(formatMicCaptureError(error))
    }
  }, [cleanupStream, disabled, finishAndTranscribe, state])

  const toggle = useCallback(() => {
    if (state === 'recording') {
      stopRecording()
      return
    }
    if (state === 'idle') {
      void startRecording()
    }
  }, [startRecording, state, stopRecording])

  return {
    state,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    toggle,
    stop: stopRecording,
  }
}
