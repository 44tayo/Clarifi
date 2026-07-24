import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

import {
  chatSelectableModels,
  normalizeChatEffort,
  type ChatEffort,
} from '../../shared/chatOptions'
import { DEFAULT_ACTIVE_MODEL_ID } from '../../shared/builtin-models'

export type ChatAttachmentPayload = {
  id: string
  name: string
  previewUrl: string
  imageBase64: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
}

export type ChatPromptSubmit = {
  message: string
  model: string
  effort: ChatEffort
  images: Array<{
    imageBase64: string
    mimeType: ChatAttachmentPayload['mimeType']
  }>
}

type ChatPromptInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (payload: ChatPromptSubmit) => void
  placeholder?: string
  disabled?: boolean
  sending?: boolean
  onFocus?: () => void
  autoFocus?: boolean
  className?: string
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult:
    | ((event: {
        resultIndex: number
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
      }) => void)
    | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}

const MODELS = chatSelectableModels()
const MAX_ATTACHMENTS = 6

function fileToAttachment(file: File): Promise<ChatAttachmentPayload | null> {
  return new Promise((resolve) => {
    const mime = file.type
    if (
      mime !== 'image/png' &&
      mime !== 'image/jpeg' &&
      mime !== 'image/gif' &&
      mime !== 'image/webp'
    ) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.split(',')[1] : result
      if (!base64) {
        resolve(null)
        return
      }
      resolve({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        imageBase64: base64,
        mimeType: mime,
      })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2.5 3.75 5 6.25 7.5 3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: 'rotate(45deg)' }}
    >
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  )
}

export function ChatPromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything…',
  disabled = false,
  sending = false,
  onFocus,
  autoFocus = false,
  className = '',
}: ChatPromptInputProps) {
  const [modelId, setModelId] = useState(DEFAULT_ACTIVE_MODEL_ID)
  const [attachments, setAttachments] = useState<ChatAttachmentPayload[]>([])
  const [modelOpen, setModelOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    },
    [],
  )

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setModelOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 120)}px`
  }, [value, attachments.length])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  const selectedModel = MODELS.find((model) => model.id === modelId) ?? MODELS[0]
  const hasValue = value.trim().length > 0 || attachments.length > 0
  const showSend = (hasValue || sending) && !isRecording

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    setIsRecording(false)
  }, [])

  useEffect(() => () => stopRecording(), [stopRecording])

  const startRecording = useCallback(async () => {
    if (disabled || sending) return
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return
    }
    streamRef.current = stream
    setIsRecording(true)

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioCtx = new AudioCtx()
    audioContextRef.current = audioCtx
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    audioCtx.createMediaStreamSource(stream).connect(analyser)
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(dataArray)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      stopRecording()
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    let baseline = valueRef.current
    recognition.onresult = (event) => {
      let interim = ''
      let finalChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (!result) continue
        if (result.isFinal) finalChunk += result[0].transcript
        else interim += result[0].transcript
      }
      if (finalChunk) baseline += (baseline ? ' ' : '') + finalChunk
      onChange((baseline + (interim ? ` ${interim}` : '')).trim())
    }
    recognition.onerror = () => stopRecording()
    recognition.onend = () => stopRecording()
    recognitionRef.current = recognition
    recognition.start()
  }, [disabled, onChange, sending, stopRecording])

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const remaining = MAX_ATTACHMENTS - attachments.length
    const next: ChatAttachmentPayload[] = []
    for (const file of Array.from(fileList).slice(0, remaining)) {
      const attachment = await fileToAttachment(file)
      if (attachment) next.push(attachment)
    }
    if (next.length) setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS))
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  const handleSubmit = () => {
    const message = value.trim()
    if ((!message && attachments.length === 0) || disabled || sending || isRecording) return
    onSubmit({
      message: message || 'Describe these images.',
      model: selectedModel?.id ?? DEFAULT_ACTIVE_MODEL_ID,
      effort: normalizeChatEffort('medium'),
      images: attachments.map((item) => ({
        imageBase64: item.imageBase64,
        mimeType: item.mimeType,
      })),
    })
    attachments.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setAttachments([])
  }

  const onSideAction = () => {
    if (isRecording) {
      stopRecording()
      return
    }
    if (showSend) {
      handleSubmit()
      return
    }
    void startRecording()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(event.target.files)
    event.target.value = ''
  }

  return (
    <div
      ref={rootRef}
      className={`chat-capsule${focused ? ' is-focused' : ''}${
        attachments.length > 0 ? ' has-attachments' : ''
      }${className ? ` ${className}` : ''}`}
    >
      {attachments.length > 0 ? (
        <ul className="chat-capsule-attachments" aria-label="Attachments">
          {attachments.map((item) => (
            <li key={item.id} className="chat-capsule-attachment">
              <img src={item.previewUrl} alt={item.name} />
              <button
                type="button"
                className="chat-capsule-attachment-remove"
                aria-label={`Remove ${item.name}`}
                onClick={() => removeAttachment(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="chat-capsule-row">
        <textarea
          ref={textareaRef}
          className="chat-capsule-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true)
            onFocus?.()
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isRecording || sending}
          aria-label="Chat message"
          rows={1}
        />

        <div className="chat-capsule-controls">
          <div className="chat-capsule-menu">
            <button
              type="button"
              className="chat-capsule-model"
              disabled={disabled}
              aria-expanded={modelOpen}
              aria-haspopup="listbox"
              onClick={() => setModelOpen((open) => !open)}
            >
              <span>{selectedModel?.label.replace(/^Claude\s+/i, '') ?? 'Model'}</span>
              <ChevronIcon />
            </button>
            {modelOpen ? (
              <ul className="chat-capsule-menu-list" role="listbox" aria-label="Model">
                {MODELS.map((model) => (
                  <li key={model.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={model.id === selectedModel?.id}
                      className={`chat-capsule-menu-item${
                        model.id === selectedModel?.id ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        setModelId(model.id)
                        setModelOpen(false)
                      }}
                    >
                      {model.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            className="chat-capsule-icon-btn"
            disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
            aria-label="Attach image"
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            hidden
            onChange={onFileChange}
          />

          <button
            type="button"
            className={`chat-capsule-action${showSend ? ' is-send' : ''}${
              isRecording ? ' is-stop' : ''
            }`}
            disabled={disabled || (sending && !isRecording)}
            aria-label={showSend ? 'Send' : isRecording ? 'Stop recording' : 'Use voice input'}
            onClick={onSideAction}
          >
            {sending && !isRecording ? (
              <span className="chat-capsule-spinner" />
            ) : isRecording ? (
              <StopIcon />
            ) : showSend ? (
              <ArrowUpIcon />
            ) : (
              <MicIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
