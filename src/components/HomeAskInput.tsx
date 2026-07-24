import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'

const SPRING =
  'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
const SMOOTH =
  'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out'

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

type HomeAskInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder?: string
  disabled?: boolean
  sending?: boolean
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
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

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
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

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  )
}

export const HomeAskInput = forwardRef<HTMLDivElement, HomeAskInputProps>(
  function HomeAskInput(
    {
      value,
      onChange,
      onSubmit,
      placeholder = 'Ask about your meetings…',
      disabled = false,
      sending = false,
    },
    ref,
  ) {
    const [expanded, setExpanded] = useState(false)
    const [smooth, setSmooth] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [audioData, setAudioData] = useState<number[]>(() => Array(5).fill(0))
    const [containerHeight, setContainerHeight] = useState(116)
    const [textareaHeight, setTextareaHeight] = useState(68)
    const [scrolling, setScrolling] = useState(false)

    const rootRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const topFadeRef = useRef<HTMLDivElement>(null)
    const bottomFadeRef = useRef<HTMLDivElement>(null)
    const valueRef = useRef(value)
    const streamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const rafRef = useRef<number | null>(null)
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

    useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)

    useEffect(() => {
      valueRef.current = value
    }, [value])

    const hasValue = value.trim().length > 0
    const showArrow = (hasValue || sending) && !isRecording
    const showStop = isRecording
    const showMic = !hasValue && !isRecording && !sending

    const updateFades = useCallback(() => {
      const el = textareaRef.current
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      if (topFadeRef.current) {
        topFadeRef.current.style.opacity = String(Math.min(scrollTop / 20, 1))
      }
      if (bottomFadeRef.current) {
        const bottomScroll = scrollHeight - clientHeight - scrollTop
        bottomFadeRef.current.style.opacity = String(
          Math.min(Math.max(bottomScroll - 16, 0) / 10, 1),
        )
      }
    }, [])

    const setValue = useCallback(
      (next: string) => {
        setSmooth(true)
        onChange(next)
      },
      [onChange],
    )

    const expand = useCallback(() => {
      if (disabled) return
      setSmooth(false)
      setExpanded(true)
    }, [disabled])

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
      setAudioData(Array(5).fill(0))
    }, [])

    const startRecording = useCallback(async () => {
      if (disabled || sending) return
      setSmooth(false)
      setExpanded(true)

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
        const bands = new Array(5).fill(0)
        const step = Math.floor(dataArray.length / 5) || 1
        for (let i = 0; i < 5; i += 1) {
          let sum = 0
          for (let j = 0; j < step; j += 1) sum += dataArray[i * step + j] ?? 0
          bands[i] = sum / step / 255
        }
        setAudioData(bands)
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
        setValue((baseline + (interim ? ` ${interim}` : '')).trim())
      }
      recognition.onerror = () => stopRecording()
      recognition.onend = () => stopRecording()
      recognitionRef.current = recognition
      recognition.start()
    }, [disabled, sending, setValue, stopRecording])

    useEffect(() => () => stopRecording(), [stopRecording])

    useEffect(() => {
      if ((hasValue || sending) && !expanded) {
        setSmooth(false)
        setExpanded(true)
      }
    }, [hasValue, sending, expanded])

    useEffect(() => {
      if (!expanded || isRecording) return undefined
      const timer = window.setTimeout(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        const length = el.value.length
        el.setSelectionRange(length, length)
      }, 50)
      return () => window.clearTimeout(timer)
    }, [expanded, isRecording])

    useEffect(() => {
      const el = textareaRef.current
      if (!el) return
      const previous = el.style.height
      el.style.transition = 'none'
      el.style.height = '0px'
      const scrollHeight = el.scrollHeight
      el.style.height = previous
      void el.offsetHeight
      el.style.transition = ''
      const next = Math.max(68, Math.min(scrollHeight, 160))
      el.style.height = `${next}px`
      setTextareaHeight(next)
      setScrolling(scrollHeight > 160)
      window.setTimeout(updateFades, 0)
    }, [value, expanded, updateFades])

    useEffect(() => {
      setContainerHeight(Math.max(116, textareaHeight + 48))
      window.setTimeout(updateFades, 0)
    }, [textareaHeight, updateFades])

    useEffect(() => {
      if (!isRecording || !textareaRef.current) return
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight
    }, [value, isRecording])

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
      if (rootRef.current?.contains(event.relatedTarget as Node)) return
      if (!value.trim() && !isRecording && !sending) {
        setSmooth(false)
        setExpanded(false)
      }
    }

    const handleSubmit = () => {
      const text = value.trim()
      if (!text || disabled || sending || isRecording) return
      setSmooth(false)
      onSubmit(text)
      setExpanded(false)
    }

    const onAction = () => {
      if (isRecording) {
        stopRecording()
        return
      }
      if (hasValue) {
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
      if (event.key === 'Escape' && !value.trim() && !isRecording) {
        setSmooth(false)
        setExpanded(false)
      }
    }

    return (
      <div
        ref={rootRef}
        className="home-prompt"
        onBlur={handleBlur}
        style={{
          maxWidth: expanded ? 480 : 320,
          transition: smooth ? 'max-width 0.15s ease-out' : 'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <div
          className={`home-prompt-card${expanded ? ' is-expanded' : ''}`}
          style={{
            height: expanded ? containerHeight : 48,
            transition: smooth ? SMOOTH : SPRING,
          }}
          onMouseDown={(event) => {
            if (!expanded || event.target === textareaRef.current || isRecording) return
            event.preventDefault()
            textareaRef.current?.focus()
          }}
        >
          <textarea
            ref={textareaRef}
            className={`home-prompt-textarea${expanded ? ' is-visible' : ''}${
              scrolling ? ' is-scrolling' : ''
            }`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onScroll={updateFades}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Ask Clarifi about your meetings"
            disabled={disabled || isRecording || sending}
            style={{
              transition: smooth
                ? 'height 0.15s ease-out'
                : 'opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          />

          <div ref={topFadeRef} className="home-prompt-fade home-prompt-fade-top" />
          <div
            ref={bottomFadeRef}
            className="home-prompt-fade home-prompt-fade-bottom"
            style={{
              top: `${textareaHeight - 32}px`,
              transition: smooth
                ? 'top 0.15s ease-out'
                : 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          />

          <button
            type="button"
            className={`home-prompt-collapsed${expanded ? ' is-hidden' : ''}`}
            onClick={expand}
            disabled={disabled}
            aria-label="Open ask input"
          >
            {placeholder}
          </button>

          <div
            className={`home-prompt-wave${isRecording ? ' is-visible' : ''}`}
            aria-hidden={!isRecording}
          >
            {audioData.map((level, index) => (
              <span
                key={index}
                className="home-prompt-wave-bar"
                style={{ height: `${Math.max(4, level * 24)}px` }}
              />
            ))}
          </div>

          <button
            type="button"
            className="home-prompt-action"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={onAction}
            disabled={disabled || (sending && !isRecording)}
            aria-label={showArrow ? 'Send' : showStop ? 'Stop recording' : 'Use voice input'}
          >
            <span
              className={`home-prompt-action-icon${showArrow ? ' is-visible' : ''}`}
              aria-hidden
            >
              {sending && !isRecording ? <span className="home-prompt-spinner" /> : <ArrowUpIcon />}
            </span>
            <span
              className={`home-prompt-action-icon${showMic ? ' is-visible' : ''}`}
              aria-hidden
            >
              <MicIcon />
            </span>
            <span
              className={`home-prompt-action-icon${showStop ? ' is-visible' : ''}`}
              aria-hidden
            >
              <StopIcon />
            </span>
          </button>
        </div>
      </div>
    )
  },
)
