import {
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
import { useWhisperDictation } from '../hooks/useWhisperDictation'
import { DictationWaveformButton } from './DictationWaveformButton'

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
  const [dictationError, setDictationError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const dictation = useWhisperDictation({
    disabled: disabled || sending,
    onTranscript: (text) => {
      setDictationError(null)
      const base = valueRef.current.trim()
      onChange(base ? `${base} ${text}` : text)
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    onError: (message) => setDictationError(message),
  })

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

  useEffect(() => {
    if (!dictationError) return undefined
    const timer = window.setTimeout(() => setDictationError(null), 4000)
    return () => window.clearTimeout(timer)
  }, [dictationError])

  const selectedModel = MODELS.find((model) => model.id === modelId) ?? MODELS[0]
  const hasValue = value.trim().length > 0 || attachments.length > 0
  const dictationBusy = dictation.isRecording || dictation.isTranscribing
  const showSend = hasValue || sending

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
    if ((!message && attachments.length === 0) || disabled || sending || dictationBusy) return
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
        <DictationWaveformButton
          active={dictation.isRecording}
          busy={dictation.isTranscribing}
          disabled={disabled || sending}
          onClick={dictation.toggle}
        />

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
          placeholder={
            dictation.isRecording
              ? 'Listening…'
              : dictation.isTranscribing
                ? 'Transcribing…'
                : placeholder
          }
          disabled={disabled || dictationBusy || sending}
          aria-label="Chat message"
          rows={1}
        />

        <div className="chat-capsule-controls">
          <div className="chat-capsule-menu">
            <button
              type="button"
              className="chat-capsule-model"
              disabled={disabled || dictationBusy}
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
            disabled={disabled || dictationBusy || attachments.length >= MAX_ATTACHMENTS}
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

          {showSend ? (
            <button
              type="button"
              className="chat-capsule-action is-send"
              disabled={disabled || sending || dictationBusy || !hasValue}
              aria-label="Send"
              onClick={handleSubmit}
            >
              {sending ? <span className="chat-capsule-spinner" /> : <ArrowUpIcon />}
            </button>
          ) : null}
        </div>
      </div>

      {dictationError ? <p className="chat-capsule-dictation-error">{dictationError}</p> : null}
    </div>
  )
}
